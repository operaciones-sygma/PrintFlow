// CUANDO LA BASE RECHAZA LO QUE PIDE EL TABLERO (v10.84.59). Con la app REAL (compilada o publicada) contra la base real y las
// escrituras cortadas en el navegador: aprieta «Empaque» en una orden que está corriendo, NO lo deshace, deja que pase la espera
// y que la base «rechace» (la escritura se corta), y mira el aviso y dónde se ve la orden en ese momento. Esto no lo puede probar
// el banco del tablero: el aviso y el regreso de la orden los hace App (doAdv), que el banco simula.
// Lo que DEBE pasar: el aviso dice qué orden y por qué en palabras («no tienes permiso», «sin conexión»), sin nombres internos
// («closeMachineLog update:», «solo lectura» crudo), y la orden ya está otra vez en su máquina cuando sale el aviso (antes se veía
// en Empaque mientras el aviso decía que no se pudo, hasta la recarga).
//
// Uso:  npm run build && node tests/recorrido/tablero-errores.mjs            (sirve dist/ en 127.0.0.1:4275)
//       node tests/recorrido/tablero-errores.mjs https://produccion.sygma.mx (la app publicada)
// Sólo lee: la cuenta claude-pruebas con el rol de producción cambiado en el navegador y TODA escritura cortada (nada llega a la
// base). La orden la escoge del tablero: la primera que esté corriendo. Sale con 1 si el aviso o el lugar de la orden fallan.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(RAIZ, "tests/salida/tablero-errores"); fs.mkdirSync(OUT, { recursive: true });
const CRED = JSON.parse(fs.readFileSync(process.env.PF_CREDENCIAL || "C:/Users/padil/claude-navegador/credencial-printflow.json", "utf8"));
const LECTURAS = new Set(["client_credit_balance", "get_app_config", "get_client_aliases", "get_client_billing_info",
  "get_client_seller_label", "get_folio_emitter_enabled", "get_last_contact_for_client", "get_pantone_by_code", "get_user_session",
  "list_anticipo_clients", "list_consecutive_cobranza_folios", "list_corona_oc_invoices", "list_linkable_invoices_for_oc",
  "list_linkable_invoices_for_order", "list_linkable_invoices_for_split", "list_stock_clients", "load_credit_ledger",
  "oc_shared_folio_is_cancelled", "ordenes_saldo_consumido", "order_folio_is_cancelled", "pf_archivos_del_bucket", "resolve_client_for_order",
  "search_clients_typeahead", "search_pantone", "sugerencia_folios", "validate_production_number"]);
let base = process.argv[2], servidor = null;
if (!base) { const { preview } = await import("vite"); servidor = await preview({ root: RAIZ, logLevel: "error", preview: { host: "127.0.0.1", port: 4275, strictPort: true } }); base = "http://127.0.0.1:4275"; }
let nav; try { nav = await chromium.launch({ headless: true }); } catch { nav = await chromium.launch({ headless: true, channel: "chrome" }); }
const cortes = new Set(); let falla = false;
try {
  const ctx = await nav.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: false });
  await ctx.addInitScript(() => { window.print = () => {}; window.open = () => null; });
  await ctx.route("**/*", async route => {
    const req = route.request(), url = req.url(), m = req.method();
    if (!/\.supabase\.co\//.test(url)) return route.continue();
    const ruta = url.replace(/^https:\/\/[^/]+/, "").replace(/\?.*$/, "");
    if (m === "GET" || m === "HEAD" || m === "OPTIONS" || ruta === "/auth/v1/token") return route.continue();
    if (ruta === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" });
    if (ruta.startsWith("/storage/v1/object/sign/") || ruta.startsWith("/storage/v1/object/list/")) return route.continue();
    const rpc = (/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(ruta) || [])[1];
    if (rpc && LECTURAS.has(rpc)) {
      if (rpc === "get_user_session") { const resp = await route.fetch(); let j = await resp.json().catch(() => null); if (Array.isArray(j) && j[0]) j = [{ ...j[0], role: "produccion" }]; return route.fulfill({ response: resp, json: j }); }
      return route.continue();
    }
    cortes.add(m + " " + (rpc ? "rpc/" + rpc : ruta));
    return route.fulfill({ status: 418, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "solo lectura" }) });
  });
  const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  await p.goto(base, { timeout: 60000 });
  await p.getByText("Sistema de Producción").first().waitFor({ timeout: 20000 });
  await p.getByPlaceholder(/gerardo/).fill(CRED.username);
  await p.locator('input[type="password"]').fill(CRED.password);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.getByText("Operación", { exact: true }).first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(2500);
  for (let i = 0; i < 2; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(200); }
  const boton = await p.evaluateHandle(() => [...document.querySelectorAll("button[title]")].find(x => x.getAttribute("title").replace(/\s*\(\d+\)\s*$/, "").trim() === "Tablero") || null);
  if (!boton.asElement()) throw new Error("no encontré la vista «Tablero»");
  await boton.asElement().click();
  // espera a que el tablero tenga una orden corriendo con su «Empaque» (data-accion="advance", v10.84.56)
  let pn = null;
  for (let k = 0; k < 40 && !pn; k++) { await p.waitForTimeout(500);
    pn = await p.evaluate(() => { const b = [...document.querySelectorAll('button[data-accion="advance"]')].find(x => x.getClientRects().length); if (!b) return null;
      const c = [...document.querySelectorAll("[draggable=true]")].find(x => x.parentElement && x.parentElement.contains(b)); return c ? (c.innerText.match(/P-\d{4}/) || [null])[0] : null; }); }
  if (!pn) { console.log("SALTA  no hay ninguna orden corriendo con «Empaque» en el tablero ahora"); process.exitCode = 0; }
  else {
    const b = await p.evaluateHandle(pn => { const c = [...document.querySelectorAll("[draggable=true]")].find(x => x.innerText.includes(pn)); return c.parentElement.querySelector('button[data-accion="advance"]'); }, pn);
    await b.asElement().scrollIntoViewIfNeeded(); await b.asElement().click();
    let aviso = "", donde = "";
    for (let k = 0; k < 60 && !aviso; k++) { await p.waitForTimeout(250);
      aviso = await p.evaluate(() => { const t = [...document.querySelectorAll("div")].find(d => { const cs = getComputedStyle(d); return cs.position === "fixed" && cs.bottom === "24px" && (d.innerText || "").trim(); }); return t ? t.innerText.replace(/\s+/g, " ").trim() : ""; }); }
    donde = await p.evaluate(pn => { const c = [...document.querySelectorAll("[draggable=true]")].find(x => x.innerText.includes(pn)); return !c ? "no se ve" : c.closest("div[style*='sticky']") ? "en Empaque" : "en su máquina"; }, pn);
    await p.screenshot({ path: path.join(OUT, "aviso-" + pn + ".png") });
    const okAviso = aviso.includes(pn) && /(no tienes permiso|sin conexión|la base no lo aceptó)/.test(aviso) && !/update:|addWaste|closeMachineLog|solo lectura|Error/i.test(aviso);
    const okDonde = donde === "en su máquina";
    console.log((okAviso ? "BIEN " : "MAL  ") + " el aviso: «" + (aviso || "(ninguno en 15 s)") + "»");
    console.log((okDonde ? "BIEN " : "MAL  ") + " cuando sale el aviso, " + pn + " se ve " + donde);
    if (!okAviso || !okDonde) falla = true;
  }
  console.log("escrituras cortadas:", [...cortes].join(", ") || "ninguna");
  await ctx.close();
} catch (e) { console.log("ERROR", e.message.split("\n")[0]); falla = true; }
finally { await nav.close(); if (servidor) await new Promise(r => servidor.httpServer.close(r)); }
if (falla) process.exitCode = 1;
