// LIGAR LA FACTURA POR ADELANTADO DEL MISMO IMPORTE (v10.84.68), con la app REAL (compilada o publicada) contra la base real y SIN
// escribir nada. El caso de Karla (8-oct): P-0585 de TRANSPORTES CASTORES ($7,440 + IVA = $8,630.40) y dos facturas sin orden del
// mismo cliente: F-135 por $8,630.40 (justo el importe) y F-140 por $2,157.60. Al «Asignar Folio y Entregar», la app preguntaba
// primero por F-140 («No es del importe de esta orden, así que no se liga sola») y Karla entendió que F-135 tampoco se ligaba.
// Aquí una orden de prueba (P-9585, sólo en este navegador) con F-9135 (mismo importe) y F-9140 (otro); la lista de candidatas y la
// respuesta de assign_invoice se contestan como la base (el candado «emitida por adelantado» de assign_invoice, leído el 8-oct).
// Lo que DEBE pasar, para Karla:
//  A. Factura sin pago: no se pregunta por F-9140; se llega a «Este trabajo ya se facturó por adelantado… Sí, ligar F-9135».
//  B. Factura pagada en EFECTIVO: no se emite otro folio (assign_invoice_cash no tiene ese candado en la base): se frena, se dice que
//     F-9135 ya es la factura de este trabajo y qué hacer, y assign_invoice_cash no se llama.
//  C. Sin factura del mismo importe (sólo F-9140): sí se pregunta por ella, como antes (el caso del anticipo de P-0544, v10.84.31).
// Uso:  npm run build && node tests/recorrido/ligar-anticipo.mjs            (sirve dist/ en 127.0.0.1:4279)
//       node tests/recorrido/ligar-anticipo.mjs https://produccion.sygma.mx (la app publicada)
//       SOLO=AB corre sólo esos escenarios. Sale con 1 si algo sale MAL.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(RAIZ, "tests/salida/ligar-anticipo"); fs.mkdirSync(OUT, { recursive: true });
const CRED = JSON.parse(fs.readFileSync(process.env.PF_CREDENCIAL || "C:/Users/padil/claude-navegador/credencial-printflow.json", "utf8"));
const LECTURAS = new Set(["client_credit_balance", "get_app_config", "get_client_aliases", "get_client_billing_info",
  "get_client_seller_label", "get_folio_emitter_enabled", "get_last_contact_for_client", "get_pantone_by_code", "get_user_session",
  "list_anticipo_clients", "list_consecutive_cobranza_folios", "list_corona_oc_invoices", "list_linkable_invoices_for_oc",
  "list_linkable_invoices_for_order", "list_linkable_invoices_for_split", "list_stock_clients", "load_credit_ledger",
  "oc_shared_folio_is_cancelled", "ordenes_saldo_consumido", "order_folio_is_cancelled", "pf_archivos_del_bucket", "resolve_client_for_order",
  "search_clients_typeahead", "search_pantone", "sugerencia_folios", "validate_production_number"]);
let base = process.argv[2], servidor = null;
if (!base) { const { preview } = await import("vite"); servidor = await preview({ root: RAIZ, logLevel: "error", preview: { host: "127.0.0.1", port: 4279, strictPort: true } }); base = "http://127.0.0.1:4279"; }
let nav; try { nav = await chromium.launch({ headless: true }); } catch { nav = await chromium.launch({ headless: true, channel: "chrome" }); }
let falla = false; const res = [];
const ok = (nombre, c, x) => { res.push((c ? "BIEN " : "MAL  ") + " " + nombre + (x ? " · " + x : "")); if (!c) falla = true; };
const CASTORES = { client: "TRANSPORTES CASTORES DE BAJA", client_id: "e87e65d3-f59e-4988-b636-b7a9a755d868" };
const ID = "PRUEBA-LIGAR-1";
const cand = (doc_number, amount, monto_cuadra, dias) => ({ doc_number, doc_type: "factura", amount, balance: amount, issued_date: new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10),
  status: "pendiente", cfdi_status: "stamped", dias_sin_orden: dias, monto_cuadra,
  notas: "FACTURA POR ADELANTADO, sin orden de producción. Motivo: PIDE FACTURA PARA HACER EL PEDIDO." });
// `candidatas`: lo que contesta list_linkable_invoices_for_order para la orden de prueba (la base las ordena: las que cuadran primero)
async function entrar(candidatas) {
  const ctx = await nav.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: false });
  await ctx.addInitScript(() => { window.print = () => {}; window.open = () => null; });
  const escritas = []; let orden = null;
  // (todo el manejador en try: si el escenario cierra su contexto con una lectura en camino, route.fetch truena y tumbaba la corrida)
  await ctx.route("**/*", async route => { try {
    const req = route.request(), url = req.url(), m = req.method();
    if (!/\.supabase\.co\//.test(url)) return route.continue();
    const ruta = url.replace(/^https:\/\/[^/]+/, "").replace(/\?.*$/, ""), q = new URL(url).searchParams;
    const tabla = (/^\/rest\/v1\/([a-z_]+)$/.exec(ruta) || [])[1];
    if (m === "GET" && tabla === "orders") {
      const resp = await route.fetch(); let j = await resp.json().catch(() => null);
      if (Array.isArray(j)) {
        if (!orden && j.length) { const t = j.find(o => o.stage === "salidas") || j[0];
          orden = { ...t, ...CASTORES, id: ID, production_number: "P-9585", product_type: "REMISIONES", quantity: 24000, price: 7440, stage: "salidas",
            order_type: "interna", purchase_order_id: null, invoice_folio: null, invoice_type: null, invoice_pre_assigned: false, grouped_invoice_folio: null,
            return_covered_by_folio: null, bill_to_client_id: null, cancelled_at: null, delivered_at: null, snooze_reason: null, snooze_kind: null, snooze_until: null,
            snoozed_by: null, snooze_stage: null, has_splits: false, has_matrix_lines: false, stock_role: null, source: null, payment_status: null, created_at: new Date().toISOString() }; }
        const id = (q.get("id") || "").replace(/^eq\./, "");
        if (orden && id === ID) j = [orden];
        else if (orden && (q.get("offset") || "0") === "0" && /created_at/.test(q.get("order") || "")) j = [orden, ...j];
      }
      return route.fulfill({ response: resp, json: j });
    }
    if (m === "GET" || m === "HEAD" || m === "OPTIONS" || ruta === "/auth/v1/token") return route.continue().catch(() => {});
    if (ruta === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" });
    if (ruta.startsWith("/storage/v1/object/sign/") || ruta.startsWith("/storage/v1/object/list/")) return route.continue();
    const rpc = (/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(ruta) || [])[1];
    let cuerpo = null; try { cuerpo = req.postDataJSON(); } catch {}
    if (rpc === "list_linkable_invoices_for_order" && cuerpo?.p_order_id === ID) return candidatas === "falla"
      ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "57014", message: "canceling statement due to statement timeout (prueba)" }) })
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(candidatas) });
    if (rpc && LECTURAS.has(rpc)) {
      if (rpc === "get_user_session") { const resp = await route.fetch(); let j = await resp.json().catch(() => null); if (Array.isArray(j) && j[0]) j = [{ ...j[0], role: "karla" }]; return route.fulfill({ response: resp, json: j }); }
      return route.continue();
    }
    escritas.push({ m, a: rpc ? "rpc/" + rpc : tabla || ruta, cuerpo });
    // el candado de la base (assign_invoice, v3.7.465): con una factura sin orden del MISMO importe, no acuña folio y lo dice
    const mismo = Array.isArray(candidatas) ? candidatas.find(c => c.monto_cuadra) : null;
    if (rpc === "assign_invoice" && cuerpo?.p_order_id === ID && mismo)
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "22023", details: null, hint: null,
        message: `Este cliente ya tiene ${mismo.doc_number} emitida por adelantado y sin orden, por $${mismo.amount}, que es justo el importe de esta orden. Ligala a esta orden en vez de emitir un folio nuevo, o se le cobraria dos veces el mismo trabajo.` }) });
    return route.fulfill({ status: 418, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "solo lectura" }) });
  } catch { /* el contexto ya se cerró */ } });
  const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  await p.goto(base, { timeout: 60000 });
  await p.getByText("Sistema de Producción").first().waitFor({ timeout: 20000 });
  await p.getByPlaceholder(/gerardo/).fill(CRED.username);
  await p.locator('input[type="password"]').fill(CRED.password);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.getByText("Operación", { exact: true }).first().waitFor({ timeout: 30000 });
  for (let i = 0; i < 2; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(200); }
  return { ctx, p, escritas };
}
const ir = async (p, vista) => { for (let intento = 0; intento < 3; intento++) {
    if (await p.getByText(/escribe SI ENTIENDO/i).count()) { await p.getByPlaceholder(/Escribe aquí/).first().fill("SI ENTIENDO"); await p.waitForTimeout(800); }
    const b = await p.evaluateHandle(v => [...document.querySelectorAll("button[title]")].find(x => x.getAttribute("title").replace(/\s*\(\d+\)\s*$/, "").trim() === v) || null, vista);
    if (!b.asElement()) throw new Error("no encontré la vista «" + vista + "»");
    try { await b.asElement().click({ timeout: 5000 }); return; } catch (e) { if (intento === 2) throw e; await p.waitForTimeout(1500); } } };
const despertador = async p => { if (await p.getByText(/escribe SI ENTIENDO/i).first().waitFor({ timeout: 8000 }).then(() => true, () => false)) { await p.getByPlaceholder(/Escribe aquí/).first().fill("SI ENTIENDO"); await p.waitForTimeout(800); } };
const dialogos = p => p.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map(d => d.innerText.replace(/\s+/g, " ").trim()));
const aviso = p => p.evaluate(() => { const t = [...document.querySelectorAll("div")].find(d => { const cs = getComputedStyle(d); return cs.position === "fixed" && cs.bottom === "24px" && (d.innerText || "").trim(); }); return t ? t.innerText.replace(/\s+/g, " ").trim() : ""; });
// a «Folios», la orden de prueba, «Asignar Folio y Entregar», Factura, el pago, «Continuar» y «Confirmar»; regresa lo que se vio después
async function asignar(p, { efectivo = false } = {}) {
  await despertador(p); await ir(p, "Folios"); await p.waitForTimeout(600);
  await p.getByPlaceholder("Buscar orden...").fill("P-9585"); await p.waitForTimeout(700);
  await p.getByRole("button", { name: /Asignar Folio y Entregar/ }).first().click();
  const dlg = p.getByRole("dialog", { name: /Asignar folio/i }); await dlg.waitFor(); await p.waitForTimeout(500);
  await dlg.getByRole("button", { name: /^Factura/ }).first().click(); await p.waitForTimeout(300);
  if (efectivo) {
    await dlg.getByRole("button", { name: "Pagada", exact: true }).click(); await p.waitForTimeout(200);
    await dlg.getByRole("radio", { name: "Efectivo" }).first().click(); await p.waitForTimeout(200);
    await dlg.getByLabel("Monto del pago 1").fill("8630.40"); await p.waitForTimeout(200);
  } else { await dlg.getByRole("button", { name: "No pagada", exact: true }).click(); await p.waitForTimeout(200); }
  await dlg.getByRole("button", { name: /^Continuar/ }).click(); await p.waitForTimeout(400);
  await dlg.getByRole("button", { name: /Confirmar/ }).click();
  let vistos = [];
  for (let k = 0; k < 24; k++) { await p.waitForTimeout(250); const d = await dialogos(p); if (d.some(x => /adelantado/i.test(x))) { vistos = d; break; } vistos = d; }
  return vistos;
}
const corre = l => !process.env.SOLO || process.env.SOLO.includes(l);
try {
  if (corre("A")) { const { ctx, p, escritas } = await entrar([cand("F-9135", 8630.40, true, 6), cand("F-9140", 2157.60, false, 2)]);
    try {
      const d = await asignar(p);
      const otroPrimero = d.some(x => /F-9140/.test(x) && /no se liga sola/i.test(x));
      const ofrece = d.some(x => /ya se facturó por adelantado/i.test(x) && /F-9135/.test(x)) && (await p.getByRole("button", { name: /Sí, ligar F-9135/ }).count()) === 1;
      ok("A1 con una del mismo importe no pregunta primero por la de otro importe", !otroPrimero, otroPrimero ? "pregunta por F-9140 («no se liga sola») antes de ofrecer ligar F-9135" : "no pregunta por F-9140");
      ok("A2 llega a «Sí, ligar F-9135»", ofrece, ofrece ? "ofrece ligar F-9135" : "lo que se ve: «" + d.join(" ‖ ").slice(0, 260) + "»");
      ok("A3 no se ligó ni se escribió nada todavía", !escritas.some(e => /link_invoice_to_order|assign_invoice_cash/.test(e.a)), escritas.map(e => e.m + " " + e.a).join(", ") || "nada");
      await p.screenshot({ path: path.join(OUT, "A-ligar.png") });
    } catch (e) { ok("A (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
  if (corre("B")) { const { ctx, p, escritas } = await entrar([cand("F-9135", 8630.40, true, 6), cand("F-9140", 2157.60, false, 2)]);
    try {
      const d = await asignar(p, { efectivo: true });
      // si la app preguntó por la de otro importe, se le contesta «de todos modos» (como haría Karla) para ver adónde lleva
      if (d.some(x => /no se liga sola/i.test(x))) { await p.getByRole("button", { name: /Asignar el folio de todos modos/ }).click().catch(() => {}); await p.waitForTimeout(2500); }
      await p.waitForTimeout(800);
      const a = await aviso(p), d2 = await dialogos(p), todo = a + " ‖ " + d2.join(" ‖ ");
      const efectivoLlamado = escritas.some(e => e.a === "rpc/assign_invoice_cash");
      ok("B1 con efectivo no se emite otro folio (assign_invoice_cash no se llama)", !efectivoLlamado, efectivoLlamado ? "SE LLAMÓ assign_invoice_cash: con la base de verdad, folio nuevo y doble cobro" : "no se llamó");
      // (un aviso que se queda, no un toast que se borra antes de leerlo: detiene un cobro)
      const aviso2 = d2.find(x => /ya se facturó por adelantado/i.test(x) && /F-9135/.test(x) && /efectivo/i.test(x)) || "";
      const botones = await p.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => /ya se facturó por adelantado/i.test(x.innerText)); return d ? [...d.querySelectorAll("button")].map(b => b.innerText.trim()) : []; });
      ok("B2 se queda en pantalla y dice que F-9135 ya es la factura de este trabajo y qué hacer", !!aviso2 && /Quita el pago en efectivo/.test(aviso2), "«" + (aviso2 || todo).slice(0, 280) + "»");
      ok("B3 el aviso tiene un solo botón, «Entendido», y al cerrarlo sigue la ventana de asignar (para quitar el efectivo)", botones.length === 1 && botones[0] === "Entendido" && await (async () => {
        await p.getByRole("button", { name: "Entendido" }).click().catch(() => {}); await p.waitForTimeout(400);
        return (await p.getByRole("dialog", { name: /Asignar folio/i }).count()) === 1 && !(await dialogos(p)).some(x => /ya se facturó por adelantado/i.test(x)); })(), "botones: " + JSON.stringify(botones));
      await p.screenshot({ path: path.join(OUT, "B-efectivo.png") });
    } catch (e) { ok("B (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
  // (vuelta 2) con efectivo y la lectura de las candidatas caída: no se cobra a ciegas
  if (corre("E")) { const { ctx, p, escritas } = await entrar("falla");
    try {
      const d = await asignar(p, { efectivo: true }); await p.waitForTimeout(1500);
      const d2 = await dialogos(p), efectivoLlamado = escritas.some(e => e.a === "rpc/assign_invoice_cash");
      ok("E1 con efectivo y sin poder revisar, no cobra y lo dice", !efectivoLlamado && d2.some(x => /No se pudo revisar/.test(x)), (efectivoLlamado ? "SE LLAMÓ assign_invoice_cash · " : "") + "«" + d2.join(" ‖ ").slice(0, 200) + "»");
    } catch (e) { ok("E (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
  // (vuelta 2) con efectivo y sin una del mismo importe: el cobro en efectivo sigue como siempre (assign_invoice_cash)
  if (corre("F")) { const { ctx, p, escritas } = await entrar([cand("F-9140", 2157.60, false, 2)]);
    try {
      const d = await asignar(p, { efectivo: true });
      if (d.some(x => /no se liga sola/i.test(x))) { await p.getByRole("button", { name: /Asignar el folio de todos modos/ }).click().catch(() => {}); }
      for (let k = 0; k < 20 && !escritas.some(e => e.a === "rpc/assign_invoice_cash"); k++) await p.waitForTimeout(250);
      ok("F1 sin una del mismo importe, el efectivo sigue su camino (assign_invoice_cash)", escritas.some(e => e.a === "rpc/assign_invoice_cash"), escritas.map(e => e.a).join(", ") || "no llamó nada");
    } catch (e) { ok("F (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
  if (corre("C")) { const { ctx, p } = await entrar([cand("F-9140", 2157.60, false, 2)]);
    try {
      const d = await asignar(p);
      ok("C1 sin una del mismo importe, sí pregunta por la de otro importe (el anticipo de P-0544)", d.some(x => /F-9140/.test(x) && /no se liga sola/i.test(x)), "«" + d.join(" ‖ ").slice(0, 200) + "»");
      await p.screenshot({ path: path.join(OUT, "C-otro-importe.png") });
    } catch (e) { ok("C (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
} finally {
  await nav.close();
  if (servidor) await new Promise(r => servidor.httpServer.close(r));
}
for (const r of res) console.log(r);
console.log(falla ? "\nligar-anticipo: algo salió MAL" : "\nligar-anticipo: todo BIEN");
process.exit(falla ? 1 : 0);
