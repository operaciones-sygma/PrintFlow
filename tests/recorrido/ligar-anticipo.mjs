// LIGAR LA FACTURA POR ADELANTADO DEL MISMO IMPORTE (v10.84.68), con la app REAL (compilada o publicada) contra la base real y SIN
// escribir nada. El caso de Karla (8-oct): P-0585 de TRANSPORTES CASTORES ($7,440 + IVA = $8,630.40) y dos facturas sin orden del
// mismo cliente: F-135 por $8,630.40 (justo el importe) y F-140 por $2,157.60. Al «Asignar Folio y Entregar», la app preguntaba
// primero por F-140 («No es del importe de esta orden, así que no se liga sola») y Karla entendió que F-135 tampoco se ligaba.
// Aquí una orden de prueba (P-9585, sólo en este navegador) con F-9135 (mismo importe) y F-9140 (otro); la lista de candidatas, el
// candado «emitida por adelantado» (assign_invoice y assign_invoice_cash, que folia por ella) y ligar se contestan como la base.
// v10.84.70 (critique independiente del 8-oct): la ventana lee las candidatas AL ABRIR. Lo que DEBE pasar, para Karla:
//  A. Con F-9135 del mismo importe: lo pregunta al abrir (con la orden al lado), la acción es «Ligar F-9135 y entregar» (sin pagos),
//     y liga sin otro folio.
//  B. «No es de este trabajo»: otra FACTURA no se deja emitir (la base la rechazaría) y lo dice; «Ligar F-9135 a esta orden» regresa.
//  H. (segunda revisión, P1) Se emitió una por adelantado MIENTRAS se capturaba el efectivo: la base rechaza, el diálogo lo dice
//     adentro («No se cobró ni se creó el vale»), ofrece ligar, dice lo capturado que no se cobra, pide reconocerlo, y al ligar la
//     orden queda anotada con lo que no se registró.
//  C. Sólo F-9140 (otro importe): lo dice al abrir con «Facturar por partes»; la completa se emite sin otra pregunta.
//  E. Efectivo y la lectura caída: no se cobra y se dice. F. Efectivo sin una del mismo importe: sigue su camino.
//  G. «Facturar por partes» desde el aviso abre esa ventana; con algo capturado, antes pregunta.
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
// `candidatas`: lo que contesta list_linkable_invoices_for_order para la orden de prueba (la base las ordena: las que cuadran primero),
//   o una función de la vuelta (1, 2…) para lo que cambia mientras se captura. `candado`: la del mismo importe que la base conoce al
//   foliar (por omisión, la que cuadra de `candidatas`).
async function entrar(candidatas, { candado } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: false });
  await ctx.addInitScript(() => { window.print = () => {}; window.open = () => null; });
  const escritas = []; let orden = null, lecturas = 0;
  const mismo = candado || (Array.isArray(candidatas) ? candidatas.find(c => c.monto_cuadra) : null);
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
    if (rpc === "list_linkable_invoices_for_order" && cuerpo?.p_order_id === ID) {
      const lista = typeof candidatas === "function" ? candidatas(++lecturas) : candidatas;
      return lista === "falla"
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "57014", message: "canceling statement due to statement timeout (prueba)" }) })
        : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(lista) });
    }
    if (rpc && LECTURAS.has(rpc)) {
      if (rpc === "get_user_session") { const resp = await route.fetch(); let j = await resp.json().catch(() => null); if (Array.isArray(j) && j[0]) j = [{ ...j[0], role: "karla" }]; return route.fulfill({ response: resp, json: j }); }
      return route.continue();
    }
    escritas.push({ m, a: rpc ? "rpc/" + rpc : tabla || ruta, cuerpo });
    // el candado de la base (assign_invoice, v3.7.465; assign_invoice_cash folia por ella, ensayado el 8-oct): con una factura sin orden
    // del MISMO importe, no acuña folio y lo dice
    if ((rpc === "assign_invoice" || rpc === "assign_invoice_cash") && cuerpo?.p_order_id === ID && mismo)
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "22023", details: null, hint: null,
        message: `Este cliente ya tiene ${mismo.doc_number} emitida por adelantado y sin orden, por $${mismo.amount}, que es justo el importe de esta orden. Ligala a esta orden en vez de emitir un folio nuevo, o se le cobraria dos veces el mismo trabajo.` }) });
    // (v10.84.70) ligar NO se escribe: se contesta como la base cuando liga (la factura queda pendiente y la orden entregada)
    if (rpc === "link_invoice_to_order" && cuerpo?.p_order_id === ID)
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ invoice_status: "pendiente", amount: mismo?.amount ?? null, payment_status: "unpaid", pre_assigned: false }) });
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
// (v10.84.70) a «Folios», la orden de prueba y «Asignar Folio y Entregar»: regresa el diálogo ya abierto (las candidatas se leen al abrir)
async function abrir(p) {
  await despertador(p); await ir(p, "Folios"); await p.waitForTimeout(600);
  await p.getByPlaceholder("Buscar orden...").fill("P-9585"); await p.waitForTimeout(700);
  await p.getByRole("button", { name: /Asignar Folio y Entregar/ }).first().click();
  const dlg = p.getByRole("dialog", { name: /Asignar folio/i }); await dlg.waitFor(); await p.waitForTimeout(900);
  return dlg;
}
// Factura y el pago («No pagada», o efectivo por el total, que ya viene lleno) y «Continuar»
async function capturar(p, dlg, { efectivo = false, entrego = "" } = {}) {
  await dlg.getByRole("button", { name: /^Factura(\s|$)/ }).first().click(); await p.waitForTimeout(300);   // no «Facturar por partes»
  if (efectivo) {
    await dlg.getByRole("button", { name: "Pagada", exact: true }).click(); await p.waitForTimeout(200);
    await dlg.getByRole("radio", { name: "Efectivo" }).first().click(); await p.waitForTimeout(200);
    if (entrego) { await dlg.getByLabel(/Quién entregó el efectivo del pago 1/).fill(entrego); await p.waitForTimeout(150); }
  } else { await dlg.getByRole("button", { name: "No pagada", exact: true }).click(); await p.waitForTimeout(200); }
}
// (v10.84.70, segunda revisión) el botón final de la vista previa dice lo que hace; antes era «Confirmar» para todo
const final = dlg => dlg.getByRole("button", { name: /^(Emitir y entregar|Asignar \S+ y entregar|Ligar \S+ y entregar|Aplicar saldo y entregar|Cargar a stock)/ }).last();
const texto = async dlg => (await dlg.innerText()).replace(/\s+/g, " ");
const esperaEscritura = async (p, escritas, re) => { for (let k = 0; k < 24 && !escritas.some(e => re.test(e.a)); k++) await p.waitForTimeout(250); return escritas.filter(e => re.test(e.a)).length; };
const corre = l => !process.env.SOLO || process.env.SOLO.includes(l);
try {
  // A. con una del MISMO importe (y otra de otro): al abrir lo pregunta con la orden al lado, la acción es ligarla, y liga sin folio
  if (corre("A")) { const { ctx, p, escritas } = await entrar([cand("F-9135", 8630.40, true, 6), cand("F-9140", 2157.60, false, 2)]);
    try {
      const dlg = await abrir(p); const t = await texto(dlg);
      await p.screenshot({ path: path.join(OUT, "A-ligar.png") });
      const liga = dlg.getByRole("button", { name: /^Ligar F-9135 y entregar/ });
      ok("A1 al abrir pregunta si F-9135 es la factura de este trabajo, con la orden al lado, sin preguntar por F-9140",
        /F-9135 es del mismo importe: ¿es la factura de este trabajo\?/.test(t) && /Esta orden/i.test(t) && /P-9585/.test(t) && !/no se liga sola/i.test(t), "«" + t.slice(0, 260) + "»");
      ok("A2 la acción principal es «Ligar F-9135 y entregar» y no se piden pagos", (await liga.count()) === 1 && (await dlg.getByRole("button", { name: "Pagada", exact: true }).count()) === 0);
      await liga.click(); await p.waitForTimeout(700);
      const prev = /Vas a ligar F-9135/.test(await texto(dlg));
      await final(dlg).click();
      const ligadas = await esperaEscritura(p, escritas, /link_invoice_to_order/);
      ok("A3 con su vista previa, liga F-9135 una vez y no intenta emitir otro folio", prev && ligadas === 1 && !escritas.some(e => /rpc\/assign_invoice/.test(e.a)), escritas.map(e => e.a).join(", ") || "nada");
    } catch (e) { ok("A (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
  // B. la misma, pero «No es de este trabajo»: otra factura no se deja emitir (la base la rechazaría), y «Ligar F-9135 a esta orden» regresa
  if (corre("B")) { const { ctx, p, escritas } = await entrar([cand("F-9135", 8630.40, true, 6), cand("F-9140", 2157.60, false, 2)]);
    try {
      const dlg = await abrir(p);
      await dlg.getByRole("button", { name: "No es de este trabajo" }).click(); await p.waitForTimeout(400);
      const advierte = /no deja emitir otra factura por \$8,630\.40/.test(await texto(dlg));
      await capturar(p, dlg, { efectivo: true }); await p.waitForTimeout(300);
      const apagado = await dlg.getByRole("button", { name: /^Continuar/ }).isDisabled();
      const t = await texto(dlg);
      await p.screenshot({ path: path.join(OUT, "B-no-es-de-este-trabajo.png") });
      ok("B1 «No es de este trabajo» avisa que la base no deja emitir otra por $8,630.40", advierte);
      ok("B2 con «Factura», «Continuar» se apaga y dice por qué; no se intenta cobrar ni foliar", apagado && /Mientras F-9135 siga sin ligar/.test(t) && !escritas.some(e => /rpc\/assign_invoice/.test(e.a)), `apagado=${apagado} · ${escritas.map(e => e.a).join(", ") || "nada escrito"}`);
      await dlg.getByRole("button", { name: /^Ligar F-9135 a esta orden$/ }).click(); await p.waitForTimeout(400);
      ok("B3 «Ligar F-9135 a esta orden» regresa a ligar, y dice el efectivo capturado que no se cobraría", (await dlg.getByRole("button", { name: /^Ligar F-9135 y entregar/ }).count()) === 1 && /no se cobra aquí/.test(await texto(dlg)));
    } catch (e) { ok("B (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
  // H. (segunda revisión, P1) se emitió una por adelantado MIENTRAS se capturaba el efectivo: al abrir no hay ninguna; la base la conoce al foliar
  if (corre("H")) { const f = cand("F-9135", 8630.40, true, 0);
    const { ctx, p, escritas } = await entrar(n => n === 1 ? [] : [f], { candado: f });
    try {
      const dlg = await abrir(p);
      await capturar(p, dlg, { efectivo: true, entrego: "Sr. Ramírez" });
      await dlg.getByRole("button", { name: /^Continuar/ }).click(); await p.waitForTimeout(700);
      await final(dlg).click();
      await esperaEscritura(p, escritas, /assign_invoice_cash/); await p.waitForTimeout(1500);
      const t1 = await texto(dlg);
      await p.screenshot({ path: path.join(OUT, "H-rechazo-con-efectivo.png") });
      const liga = dlg.getByRole("button", { name: /^Ligar F-9135 y entregar/ });
      ok("H1 el rechazo sale adentro y dice que no se cobró ni se creó el vale; se intentó cobrar UNA vez", /no dejó emitir otro folio/.test(t1) && /No se cobró ni se creó el vale/.test(t1) && escritas.filter(e => e.a === "rpc/assign_invoice_cash").length === 1, "«" + t1.slice(0, 240) + "»");
      ok("H2 ofrece ligar F-9135, dice el efectivo capturado que ligar no cobra, y no deja ligar sin reconocerlo",
        (await liga.count()) === 1 && /Capturaste \$8,630\.40 en efectivo \(entregó Sr\. Ramírez\)/.test(t1) && /no se cobra aquí/.test(t1) && await liga.isDisabled());
      await dlg.getByLabel("Lo registro en CobranzaFlow").check(); await p.waitForTimeout(250);
      await liga.click(); await p.waitForTimeout(700);
      const prev = /no se cobra aquí/.test(await texto(dlg));
      await final(dlg).click();
      const ligadas = await esperaEscritura(p, escritas, /link_invoice_to_order/); await p.waitForTimeout(1200);
      const nota = escritas.find(e => e.a === "order_timeline" && /NO se registró/.test(JSON.stringify(e.cuerpo || "")));
      const av = await aviso(p);
      await p.screenshot({ path: path.join(OUT, "H-ligada-sin-cobrar.png") });
      ok("H3 la vista previa lo repite; liga una vez; la orden queda anotada con lo que NO se registró, y el aviso lo dice",
        prev && ligadas === 1 && !!nota && /Ramírez/.test(JSON.stringify(nota?.cuerpo || "")) && /NO se registró/.test(av), `vista=${prev} · ligó=${ligadas} · nota=${!!nota} · aviso «${av.slice(0, 160)}»`);
    } catch (e) { ok("H (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
  // E. con efectivo y la lectura de las candidatas caída: no se cobra a ciegas, y se dice
  if (corre("E")) { const { ctx, p, escritas } = await entrar("falla");
    try {
      const dlg = await abrir(p); const avisa = /No se pudo revisar si ya hay una factura por adelantado/.test(await texto(dlg));
      await capturar(p, dlg, { efectivo: true }); await p.waitForTimeout(300);
      const apagado = await dlg.getByRole("button", { name: /^Continuar/ }).isDisabled();
      ok("E1 con efectivo y sin poder revisar: lo dice al abrir, no deja continuar y no cobra", avisa && apagado && !escritas.some(e => e.a === "rpc/assign_invoice_cash"), `avisa=${avisa} · apagado=${apagado}`);
    } catch (e) { ok("E (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
  // F. con efectivo y sin una del mismo importe: el cobro en efectivo sigue su camino (assign_invoice_cash)
  if (corre("F")) { const { ctx, p, escritas } = await entrar([cand("F-9140", 2157.60, false, 2)]);
    try {
      const dlg = await abrir(p); await capturar(p, dlg, { efectivo: true });
      await dlg.getByRole("button", { name: /^Continuar/ }).click(); await p.waitForTimeout(700);
      await final(dlg).click();
      ok("F1 sin una del mismo importe, el efectivo sigue su camino (assign_invoice_cash)", (await esperaEscritura(p, escritas, /assign_invoice_cash/)) === 1, escritas.map(e => e.a).join(", ") || "no llamó nada");
    } catch (e) { ok("F (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
  // C. sólo una de OTRO importe: se dice al abrir, con «Facturar por partes»; la completa se emite sin otra pregunta
  if (corre("C")) { const { ctx, p, escritas } = await entrar([cand("F-9140", 2157.60, false, 2)]);
    try {
      const dlg = await abrir(p); const t0 = await texto(dlg);
      await p.screenshot({ path: path.join(OUT, "C-otro-importe.png") });
      ok("C1 al abrir dice que F-9140 ($2,157.60) es de otro importe y ofrece «Facturar por partes»", /F-9140/.test(t0) && /\$2,157\.60/.test(t0) && (await dlg.getByRole("button", { name: /Facturar por partes/ }).count()) === 1, "«" + t0.slice(0, 220) + "»");
      await capturar(p, dlg); await dlg.getByRole("button", { name: /^Continuar/ }).click(); await p.waitForTimeout(700);
      const prev = /F-9140.*sin ligar/.test(await texto(dlg));
      await final(dlg).click();
      await esperaEscritura(p, escritas, /rpc\/assign_invoice$/); await p.waitForTimeout(600);
      ok("C2 la vista previa dice que F-9140 se queda sin ligar, y al confirmar no sale otra pregunta (se intenta emitir una vez)", prev && !(await dialogos(p)).some(x => /no se liga sola/i.test(x)) && escritas.filter(e => e.a === "rpc/assign_invoice").length === 1);
    } catch (e) { ok("C (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
  // G. «Facturar por partes» desde el aviso lleva a esa ventana, con la orden; con algo capturado, antes pregunta (lo tiraba sin decir)
  if (corre("G")) { const { ctx, p } = await entrar([cand("F-9140", 2157.60, false, 2)]);
    try {
      const dlg = await abrir(p);
      await capturar(p, dlg, { efectivo: true }); await p.waitForTimeout(200);
      await dlg.getByRole("button", { name: /Facturar por partes/ }).click(); await p.waitForTimeout(500);
      const pregunta = p.getByRole("dialog", { name: /Facturar por partes/ });
      const pregunto = (await pregunta.count()) === 1 && /1 pago por \$8,630\.40/.test((await pregunta.innerText()).replace(/\s+/g, " "));
      await p.getByRole("button", { name: "Seguir capturando" }).click(); await p.waitForTimeout(400);
      const sigue = (await dlg.getByLabel("Monto del pago 1").inputValue()).replace(/,/g, "").startsWith("8630.4");
      ok("G2 con un pago capturado, «Facturar por partes» pregunta (dice cuánto se pierde) y «Seguir capturando» lo deja", pregunto && sigue, `preguntó=${pregunto} · sigue=${sigue}`);
      await dlg.getByRole("button", { name: /Facturar por partes/ }).click(); await p.waitForTimeout(500);
      await p.getByRole("button", { name: "Ir a Facturar por partes" }).click(); await p.waitForTimeout(1500);
      const ds = await dialogos(p);
      ok("G1 «Ir a Facturar por partes» cierra «Asignar folio» y abre la de partes", !(await p.getByRole("dialog", { name: /Asignar folio/i }).count()) && ds.some(x => /partes/i.test(x)), "«" + ds.join(" ‖ ").slice(0, 200) + "»");
    } catch (e) { ok("G (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
} finally {
  await nav.close();
  if (servidor) await new Promise(r => servidor.httpServer.close(r));
}
for (const r of res) console.log(r);
console.log(falla ? "\nligar-anticipo: algo salió MAL" : "\nligar-anticipo: todo BIEN");
process.exit(falla ? 1 : 0);
