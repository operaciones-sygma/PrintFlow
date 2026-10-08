// CUANDO NO SE PUEDE LEER DE LA BASE (v10.84.65). Con la app REAL (compilada o publicada) contra la base real, sin escribir nada
// (las escrituras se cortan en el navegador, como en tablero-errores.mjs; las fallas de lectura se SIMULAN sólo en este
// navegador). La tercera revisión independiente del tablero (P1): «Tablero vacío · 0 trabajando · 15 libres» de 1 a 2 s al entrar
// y siempre que la lectura fallaba, con el punto de conexión en verde. Lo que DEBE pasar:
//  A. la primera lectura tarda: el Dashboard dice «Leyendo de la base…» y el tablero no dice «vacío», «libres» ni «trabajando»;
//     ya leído, si las lecturas de órdenes fallan y la app recarga, lo que se veía se queda, un aviso dice de qué hora es, el punto
//     de conexión deja de decir «En tiempo real», y «Reintentar» (ya sin la falla) quita el aviso;
//  B. la PRIMERA lectura falla: el tablero dice que no se pudo leer (no «vacío») y «Reintentar» lo lee;
//  C. falla sólo la bitácora (order_timeline): tampoco se presenta a medias; lo que se veía se queda, con el aviso;
//  D. falla «Cargar Archivo Completo»: lo que se veía se queda (antes quedaba en blanco) y se puede volver a pedir.
// Uso:  npm run build && node tests/recorrido/lectura-falla.mjs            (sirve dist/ en 127.0.0.1:4277)
//       node tests/recorrido/lectura-falla.mjs https://produccion.sygma.mx (la app publicada)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(RAIZ, "tests/salida/lectura-falla"); fs.mkdirSync(OUT, { recursive: true });
const CRED = JSON.parse(fs.readFileSync(process.env.PF_CREDENCIAL || "C:/Users/padil/claude-navegador/credencial-printflow.json", "utf8"));
const LECTURAS = new Set(["client_credit_balance", "get_app_config", "get_client_aliases", "get_client_billing_info",
  "get_client_seller_label", "get_folio_emitter_enabled", "get_last_contact_for_client", "get_pantone_by_code", "get_user_session",
  "list_anticipo_clients", "list_consecutive_cobranza_folios", "list_corona_oc_invoices", "list_linkable_invoices_for_oc",
  "list_linkable_invoices_for_order", "list_linkable_invoices_for_split", "list_stock_clients", "load_credit_ledger",
  "oc_shared_folio_is_cancelled", "ordenes_saldo_consumido", "order_folio_is_cancelled", "pf_archivos_del_bucket", "resolve_client_for_order",
  "search_clients_typeahead", "search_pantone", "sugerencia_folios", "validate_production_number"]);
let base = process.argv[2], servidor = null;
if (!base) { const { preview } = await import("vite"); servidor = await preview({ root: RAIZ, logLevel: "error", preview: { host: "127.0.0.1", port: 4277, strictPort: true } }); base = "http://127.0.0.1:4277"; }
let nav; try { nav = await chromium.launch({ headless: true }); } catch { nav = await chromium.launch({ headless: true, channel: "chrome" }); }
const cortes = new Set(); let falla = false; const res = [];
const ok = (nombre, c, x) => { res.push((c ? "BIEN " : "MAL  ") + " " + nombre + (x ? " · " + x : "")); if (!c) falla = true; };
// una sesión: `estado` decide, en cada momento, qué lecturas tardan o fallan (sólo en este navegador)
async function entrar(estado) {
  const ctx = await nav.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: false });
  await ctx.addInitScript(() => { window.print = () => {}; window.open = () => null; });
  await ctx.route("**/*", async route => {
    const req = route.request(), url = req.url(), m = req.method();
    if (!/\.supabase\.co\//.test(url)) return route.continue();
    const ruta = url.replace(/^https:\/\/[^/]+/, "").replace(/\?.*$/, "");
    const tabla = (/^\/rest\/v1\/([a-z_]+)$/.exec(ruta) || [])[1];
    if (m === "GET" && tabla && estado.rompe?.includes(tabla)) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "upstream connect error (prueba de lectura caída)" }) });
    if (m === "GET" && tabla === "orders" && estado.retraso) await new Promise(r => setTimeout(r, estado.retraso));
    if (m === "GET" || m === "HEAD" || m === "OPTIONS" || ruta === "/auth/v1/token") return route.continue().catch(() => {});
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
  // la bienvenida del rol («¡Entendido! →») tapa todo al entrar: se cierra con Esc, como en las otras pruebas
  for (let i = 0; i < 2; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(200); }
  return { ctx, p };
}
const texto = p => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const fichas = p => p.evaluate(() => [...document.querySelectorAll("[draggable=true]")].filter(x => x.getClientRects().length).length);
// (el «Despertador» del día sale cuando terminan de cargar los datos, en cualquier momento, y tapa todo: si está, se cierra antes
//   del clic; y si sale justo durante el clic, se reintenta)
const ir = async (p, vista) => { for (let intento = 0; intento < 3; intento++) {
    if (await p.getByText(/escribe SI ENTIENDO/i).count()) { await p.getByPlaceholder(/Escribe aquí/).first().fill("SI ENTIENDO"); await p.waitForTimeout(800); }
    const b = await p.evaluateHandle(v => [...document.querySelectorAll("button[title]")].find(x => x.getAttribute("title").replace(/\s*\(\d+\)\s*$/, "").trim() === v) || null, vista);
    if (!b.asElement()) throw new Error("no encontré la vista «" + vista + "»");
    try { await b.asElement().click({ timeout: 5000 }); return; } catch (e) { if (intento === 2) throw e; await p.waitForTimeout(1500); } } };
const despertador = async p => { if (await p.getByText(/escribe SI ENTIENDO/i).first().waitFor({ timeout: 8000 }).then(() => true, () => false)) { await p.getByPlaceholder(/Escribe aquí/).first().fill("SI ENTIENDO"); await p.waitForTimeout(800); } };
const esperaFichas = async p => { for (let k = 0; k < 40 && !(await fichas(p)); k++) await p.waitForTimeout(500); return fichas(p); };
const esperaTexto = async (p, re, s = 20) => { for (let k = 0; k < s * 2; k++) { if (re.test(await texto(p))) return true; await p.waitForTimeout(500); } return false; };
const recarga = p => p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
const punto = p => p.evaluate(() => [...document.querySelectorAll('[role="img"][aria-label]')].map(x => x.getAttribute("aria-label")).find(x => /tiempo real|Conectando|Reconectando|No se pudo leer/.test(x)) || "(no está)");
const corre = l => !process.env.SOLO || process.env.SOLO.includes(l);   // SOLO=AB corre sólo esos escenarios
try {
  // ── A: la primera lectura tarda; ya leído, las lecturas fallan; «Reintentar» ──
  if (corre("A")) { const estado = { retraso: 7000 }; const { ctx, p } = await entrar(estado);
    const t0 = await texto(p);
    ok("A · mientras lee, el Dashboard lo dice", /Leyendo de la base/.test(t0), /Leyendo de la base/.test(t0) ? "«Leyendo de la base…»" : "no dice que está leyendo (enseña ceros)");
    await ir(p, "Tablero"); await p.waitForTimeout(1500);
    const t1 = await texto(p), dice1 = ["Tablero vacío", "libres", "trabajando"].filter(x => t1.includes(x));
    await p.screenshot({ path: path.join(OUT, "A1-leyendo.png") });
    ok("A · mientras lee, el tablero no dice que está vacío", dice1.length === 0 && /Leyendo/.test(t1), dice1.length ? "dice " + dice1.map(x => "«" + x + "»").join(", ") : /Leyendo/.test(t1) ? "dice que está leyendo" : "no dice nada de la lectura");
    estado.retraso = 0;
    const n = await esperaFichas(p); await despertador(p);
    if (!n) ok("A · el tablero se leyó", false, "0 fichas después de 20 s");
    else {
      estado.rompe = ["orders"]; await recarga(p);
      const aviso = await esperaTexto(p, /No se pudo leer de la base/);
      const n2 = await fichas(p), t2 = await texto(p), pt = await punto(p);
      await p.screenshot({ path: path.join(OUT, "A2-falla.png") });
      ok("A · con la lectura caída, lo que se veía se queda", n2 === n && !/Tablero vacío/.test(t2), `antes ${n} fichas, después ${n2}${/Tablero vacío/.test(t2) ? "; dice «Tablero vacío»" : ""}`);
      ok("A · un aviso dice que no se pudo leer y de qué hora es lo que se ve", aviso && /Lo que ves es de las \d{1,2}:\d{2}/.test(t2), aviso ? "«" + (t2.match(/No se pudo leer de la base\.[^.]*\./) || [""])[0] + "»" : "ningún aviso en 20 s");
      ok("A · el punto de conexión no dice «En tiempo real»", pt !== "En tiempo real", "dice «" + pt + "»");
      estado.rompe = null;
      const re = p.getByRole("button", { name: "Reintentar" }).first();
      if (await re.count()) { await re.click(); const sigue = !(await esperaTexto(p, /^(?![\s\S]*No se pudo leer de la base)/, 15));
        ok("A · «Reintentar» sin la falla quita el aviso", !sigue, sigue ? "el aviso sigue a los 15 s" : "se fue"); }
      else ok("A · «Reintentar» sin la falla quita el aviso", false, "no hay botón «Reintentar»");
    }
    await ctx.close(); }
  // ── B: la PRIMERA lectura falla ──
  if (corre("B")) { const estado = { rompe: ["orders"] }; const { ctx, p } = await entrar(estado);
    await ir(p, "Tablero");
    const dice = await esperaTexto(p, /No se pudo leer el tablero/);
    const t = await texto(p), malo = ["Tablero vacío", "libres", "trabajando"].filter(x => t.includes(x));
    await p.screenshot({ path: path.join(OUT, "B1-primera-falla.png") });
    ok("B · la primera lectura falla: el tablero lo dice, no dice «vacío»", dice && malo.length === 0, (dice ? "dice «No se pudo leer el tablero»" : "NO lo dice") + (malo.length ? "; y dice " + malo.map(x => "«" + x + "»").join(", ") : ""));
    estado.rompe = null;
    const re = p.getByRole("button", { name: "Reintentar" }).first();
    if (await re.count()) { await re.click(); const n = await esperaFichas(p); ok("B · «Reintentar» lo lee", n > 0, n + " fichas"); }
    else ok("B · «Reintentar» lo lee", false, "no hay botón «Reintentar»");
    await ctx.close(); }
  // ── C: falla sólo la bitácora ──
  if (corre("C")) { const estado = {}; const { ctx, p } = await entrar(estado);
    await ir(p, "Tablero"); const n = await esperaFichas(p); await despertador(p);
    estado.rompe = ["order_timeline"]; await recarga(p);
    const aviso = await esperaTexto(p, /No se pudo leer de la base/); const n2 = await fichas(p);
    ok("C · falla sólo la bitácora: lo que se veía se queda, con el aviso", aviso && n2 === n && n > 0, `${aviso ? "con aviso" : "SIN aviso"}; antes ${n} fichas, después ${n2}`);
    await ctx.close(); }
  // ── D: falla «Cargar Archivo Completo» ──
  if (corre("D")) { const estado = {}; const { ctx, p } = await entrar(estado);
    await ir(p, "Tablero"); const n = await esperaFichas(p); await despertador(p);
    await ir(p, "Archivo"); await p.waitForTimeout(1500);
    const boton = p.getByRole("button", { name: /Cargar Archivo Completo/ }).first();
    if (!(await boton.count())) ok("D · el archivo completo que falla no borra nada", false, "no encontré «Cargar Archivo Completo»");
    else {
      // (el cliente de Supabase reintenta solo un 503 tres veces, a 1, 2 y 4 s: la falla dura más que eso; antes de v10.84.65, al
      //   rendirse, el archivo ponía las órdenes en [] y la pantalla quedaba en blanco hasta la siguiente recarga)
      const pendientes = async () => Number(((await texto(p)).match(/Pendientes \((\d+)\)/) || [])[1] ?? -1);
      const pend0 = await pendientes();
      estado.rompe = ["orders"]; await boton.click();
      const dijo = await esperaTexto(p, /No se pudo cargar el archivo completo/, 25);
      const pend1 = await pendientes(), volvio = await p.getByRole("button", { name: /Cargar Archivo Completo/ }).count();
      await p.screenshot({ path: path.join(OUT, "D1-archivo-falla.png") });
      ok("D · el archivo completo que falla no borra nada y lo dice", dijo && pend1 === pend0 && pend0 > 0 && volvio > 0,
        `${dijo ? "lo dice" : "NO dice nada en 25 s"}; «Pendientes» ${pend0} → ${pend1}; el botón ${volvio ? "regresa" : "NO regresa"}`);
      await ir(p, "Tablero"); await p.waitForTimeout(1500);
      const n2 = await fichas(p), t = await texto(p);
      ok("D · y el tablero sigue como estaba", n2 === n && n > 0 && !/Tablero vacío/.test(t), `antes ${n} fichas, después ${n2}`);
      // ya sin la falla, se puede volver a pedir y carga
      estado.rompe = null; await ir(p, "Archivo"); await p.waitForTimeout(800);
      const b2 = p.getByRole("button", { name: /Cargar Archivo Completo/ }).first(), hay = await b2.count();
      let cargo = false; if (hay) { await b2.click(); for (let k = 0; k < 60 && !cargo; k++) { await p.waitForTimeout(500); cargo = !(await p.getByRole("button", { name: /Cargar Archivo Completo/ }).count()) && !/No se pudo cargar el archivo completo/.test(await texto(p)); } }
      ok("D · y se puede volver a pedir", hay > 0 && cargo, hay ? (cargo ? "el segundo intento lo carga" : "el segundo intento no lo carga") : "el botón ya no está");
    }
    await ctx.close(); }
  console.log(res.join("\n"));
  console.log("escrituras cortadas:", [...cortes].join(", ") || "ninguna");
} catch (e) { console.log(res.join("\n")); console.log("ERROR", e.message.split("\n")[0]); falla = true; }
finally { await nav.close(); if (servidor) await new Promise(r => servidor.httpServer.close(r)); }
if (falla) process.exitCode = 1;
