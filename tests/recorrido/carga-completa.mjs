// LA CARGA COMPLETA NO SE CORTA (v10.84.61). Esta Supabase contesta como máximo 1,000 renglones por consulta, aunque se le pida
// .limit(5000) (medido el 7-oct: order_timeline «0-999/9053»). Después de abrir «Archivo» (o Analítica) la app traía la bitácora
// de TODAS las órdenes en una sola consulta: se cortaba en mayo, las órdenes recientes se quedaban sin bitácora y salían
// «estancadas» desde su creación (P-0540, «10d estancada», un día después de llegar a Salidas). Con la app REAL contra la base
// real y las escrituras cortadas: entra como admin, abre «Archivo», regresa a «Todas», abre el detalle de una orden activa con
// movimientos recientes y mira que no diga «estancada» por una bitácora incompleta, ni antes ni después de una recarga.
//
// Uso:  npm run build && node tests/recorrido/carga-completa.mjs [P-0540]          (sirve dist/ en 127.0.0.1:4276)
//       node tests/recorrido/carga-completa.mjs https://produccion.sygma.mx [P-0540]
// Sólo lee. La orden debe estar activa y haberse movido hace menos de 2 días hábiles (si no, el caso lo dice y se salta).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(RAIZ, "tests/salida/carga-completa"); fs.mkdirSync(OUT, { recursive: true });
const CRED = JSON.parse(fs.readFileSync(process.env.PF_CREDENCIAL || "C:/Users/padil/claude-navegador/credencial-printflow.json", "utf8"));
const LECTURAS = new Set(["client_credit_balance", "get_app_config", "get_client_aliases", "get_client_billing_info",
  "get_client_seller_label", "get_folio_emitter_enabled", "get_last_contact_for_client", "get_pantone_by_code", "get_user_session",
  "list_anticipo_clients", "list_consecutive_cobranza_folios", "list_corona_oc_invoices", "list_linkable_invoices_for_oc",
  "list_linkable_invoices_for_order", "list_linkable_invoices_for_split", "list_stock_clients", "load_credit_ledger",
  "oc_shared_folio_is_cancelled", "ordenes_saldo_consumido", "order_folio_is_cancelled", "pf_archivos_del_bucket", "resolve_client_for_order",
  "search_clients_typeahead", "search_pantone", "sugerencia_folios", "validate_production_number"]);
const args = process.argv.slice(2);
let base = args.find(a => /^https?:/.test(a)), PN = args.find(a => /^P-\d+$/.test(a)) || "P-0540", servidor = null;
if (!base) { const { preview } = await import("vite"); servidor = await preview({ root: RAIZ, logLevel: "error", preview: { host: "127.0.0.1", port: 4276, strictPort: true } }); base = "http://127.0.0.1:4276"; }
let nav; try { nav = await chromium.launch({ headless: true }); } catch { nav = await chromium.launch({ headless: true, channel: "chrome" }); }
let falla = false;
const vista = async (p, nombre) => { const b = await p.evaluateHandle(v => [...document.querySelectorAll("button[title]")].find(x => x.getAttribute("title").replace(/\s*\(\d+\)\s*$/, "").trim() === v) || null, nombre);
  if (!b.asElement()) throw new Error("no encontré la vista «" + nombre + "»"); await b.asElement().click(); };
const encabezado = async p => {
  await vista(p, "Todas"); await p.waitForTimeout(3500);
  const todas = p.locator("button:not([title])", { hasText: /^Todas$/ }); if (await todas.count()) { await todas.first().click(); await p.waitForTimeout(1200); }
  const t = p.locator(`[role="button"][aria-label^="Orden ${PN},"], [role="button"][aria-label^="Orden ${PN} "]`).first();
  if (!(await t.count())) return null;
  await t.scrollIntoViewIfNeeded(); await t.focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(2500);
  const d = p.getByRole("dialog", { name: new RegExp("Detalle de orden " + PN) });
  if (!(await d.count())) return null;
  const txt = await d.evaluate(x => x.innerText.split("\n").slice(0, 12).join(" · "));
  await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  return txt;
};
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
      if (rpc === "get_user_session") { const resp = await route.fetch(); let j = await resp.json().catch(() => null); if (Array.isArray(j) && j[0]) j = [{ ...j[0], role: "admin" }]; return route.fulfill({ response: resp, json: j }); }
      return route.continue();
    }
    return route.fulfill({ status: 418, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "solo lectura" }) });
  });
  const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  // DEPURAR=1 imprime cada respuesta de órdenes y bitácoras con su «Content-Range» (ahí se ve si una consulta se cortó en 1,000)
  if (process.env.DEPURAR) p.on("response", r => { const u = r.url(); if (/\/rest\/v1\/(order_timeline|order_machine_log|orders\?)/.test(u)) console.log("  respuesta", r.status(), u.replace(/^https:\/\/[^/]+/, "").replace(/order_id=in\.[^&]*/, "order_id=in.(…)").slice(0, 110), r.headers()["content-range"] || ""); });
  await p.goto(base, { timeout: 60000 });
  await p.getByText("Sistema de Producción").first().waitFor({ timeout: 20000 });
  await p.getByPlaceholder(/gerardo/).fill(CRED.username);
  await p.locator('input[type="password"]').fill(CRED.password);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.getByText("Operación", { exact: true }).first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(2500);
  const campo = p.getByPlaceholder(/Escribe aquí/);
  // (el «Despertador» sale cuando terminan de cargar los datos, a veces después de los 2.5 s: se le espera hasta 8 s)
  if (await p.getByText(/escribe SI ENTIENDO/i).first().waitFor({ timeout: 8000 }).then(() => true, () => false)) { await campo.first().fill("SI ENTIENDO"); await p.waitForTimeout(800); }
  for (let i = 0; i < 2; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(200); }
  const antes = await encabezado(p);
  if (antes === null) { console.log("SALTA  " + PN + " no está en «Todas» (ya cambió de etapa)"); }
  else {
    console.log("antes de cargar el archivo completo:   " + antes.slice(0, 200));
    // la carga completa: «Cargar Archivo Completo» (el mismo loadArchive que Analytics, Auditoría, Devoluciones y Cancelaciones)
    await vista(p, "Archivo"); await p.waitForTimeout(1500);
    const cargar = p.getByRole("button", { name: /Cargar Archivo Completo/ }).first();
    if (await cargar.count()) { await cargar.click(); await p.waitForTimeout(12000); } else console.log("  (el archivo completo ya estaba cargado)");
    // y una recarga como la que provoca cualquier cambio de otra persona (volver a la pestaña la dispara)
    await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
    await p.waitForTimeout(8000);
    const despues = await encabezado(p);
    console.log("después de cargar el archivo completo: " + (despues || "(no abrió)").slice(0, 200));
    const ok1 = !/estancada|sin avance/.test(antes), ok2 = despues !== null && !/estancada|sin avance/.test(despues);
    console.log((ok1 ? "BIEN " : "MAL  ") + " antes de cargar el archivo completo, " + PN + (ok1 ? " no sale estancada" : " SALE estancada"));
    console.log((ok2 ? "BIEN " : "MAL  ") + " después de cargar el archivo completo, " + PN + (ok2 ? " no sale estancada" : " SALE estancada (la bitácora se cortó)"));
    await p.screenshot({ path: path.join(OUT, PN + ".png") });
    if (!ok1 || !ok2) falla = true;
  }
  await ctx.close();
} catch (e) { console.log("ERROR", e.message.split("\n")[0]); falla = true; }
finally { await nav.close(); if (servidor) await new Promise(r => servidor.httpServer.close(r)); }
if (falla) process.exitCode = 1;
