// «CORREGIR PRECIO» DE LO YA FOLIADO (v10.84.118), con la app REAL (compilada o publicada) contra la base real y SIN escribir nada: lo que el banco
// «folio» no ve porque lo hace App (de dónde se abre, qué le manda a la base y qué NO hace por su cuenta). La entrega 2 de CobranzaFlow (v3.7.1010,
// aplicada el 15-oct) dejó en la base corregir_precio_revisar (sólo lee) y corregir_precio_orden (corrige, deja el rastro y avisa). Dos órdenes de
// prueba existen sólo en este navegador (se agregan a lo que contesta la base al leer `orders`): P-9911 en máquina con F-9911 anticipada ($1,000 +
// IVA = $1,160) y P-9912 en máquina sin folio ($2,000). Las dos puertas de la base se contestan aquí como lo haría la base para Karla (con la cuenta
// de pruebas, que no es Karla, la de verdad diría «sólo Karla o Dirección»); toda escritura se corta y se anota. Lo que DEBE pasar, para Karla:
//  A. P-9911 (foliada): «Más» del detalle ofrece «Corregir precio» con F-9911; la ventana revisa en la base al abrir (F-9911: $1,160.00 con IVA) y con
//     $1,250 («de $1,160.00 a $1,450.00 con IVA, con el mismo folio»); al guardar llama UNA vez a corregir_precio_orden con el precio, el porqué y lo
//     que se vio (precio $1,000, F-9911, $1,160), sin conceptos; la app NO escribe la orden ni anota ni avisa por su cuenta (lo hace la base: saldrían
//     dobles); dice la nota de la base y se cierra;
//  B. P-9912 (sin folio): sigue por el camino de antes (v10.84.112/115): no pregunta a la base por su factura, escribe el precio con sus condiciones,
//     lo anota en el historial y avisa a Dirección y a quien capturó;
//  C. si la base rechaza (el importe cambió mientras se revisaba), lo dice dentro de la ventana, que sigue abierta con «Volver a revisar»;
//  D. (vuelta 4) si P-9912 recibe su folio con la ventana abierta, la ventana se vuelve a abrir revisando su factura y guarda por la base (no por el
//     camino de antes, que escribiría la orden y avisaría por su cuenta).
// v10.84.174 — LO QUE FALTA DE UNA ORDEN POR PARTES (Marcelo, 3-nov: «en printflow en el archivo no me deja editar el precio»; P-0430). P-9913, entregada: RS-9913 por $10,000 y faltan
//   $14,000 de 70,000 pzas; sus partes también existen sólo en este navegador y el disparador de la base (el resto absorbe el cambio) se simula aquí. Para Dirección:
//  E. desde el Archivo, «Más» ofrece «Corregir precio» con lo que falta; con $12,600 escribe UNA vez el precio de la orden ($22,600), con quién y sus condiciones y sin excluir la entregada; no pasa
//     por la puerta de lo foliado; anota el porqué, avisa a quien capturó, dice en cuánto quedó y el detalle lo dice sin recargar;
//  F. a Karla, desde el mismo lugar, no se le ofrece (por tabla, la base se lo rechaza);
//  G. si lo que falta se factura con la ventana abierta, lo dice y no escribe;
//  H. desde el mismo detalle del Archivo, «Facturar siguiente parte» abre su ventana ENCIMA, con la remisión, lo que falta y sus piezas; Esc regresa al detalle y nada se escribe.
// Uso:  npm run build && node tests/recorrido/corregir-foliada.mjs            (sirve dist/ en 127.0.0.1:4279)
//       node tests/recorrido/corregir-foliada.mjs https://produccion.sygma.mx (la app publicada)
//       SOLO=AB corre sólo esos escenarios. Sale con 1 si algo sale MAL.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { contextoDeSitio } from "./sitio.mjs";   // v10.84.162: la contraseña de sitio de produccion.sygma.mx (sólo contra la app publicada)
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(RAIZ, "tests/salida/corregir-foliada"); fs.mkdirSync(OUT, { recursive: true });
const CRED = JSON.parse(fs.readFileSync(process.env.PF_CREDENCIAL || "C:/Users/padil/claude-navegador/credencial-printflow.json", "utf8"));
const LECTURAS = new Set(["client_credit_balance", "get_app_config", "get_client_aliases", "get_client_billing_info",
  "get_client_seller_label", "get_folio_emitter_enabled", "get_last_contact_for_client", "get_pantone_by_code", "get_user_session",
  "list_anticipo_clients", "list_consecutive_cobranza_folios", "list_corona_oc_invoices", "list_linkable_invoices_for_oc",
  "list_linkable_invoices_for_order", "list_linkable_invoices_for_split", "list_stock_clients", "load_credit_ledger",
  "oc_shared_folio_is_cancelled", "ordenes_saldo_consumido", "order_folio_is_cancelled", "pf_archivos_del_bucket", "resolve_client_for_order",
  "search_clients_typeahead", "search_pantone", "sugerencia_folios", "validate_production_number", "conceptos_para_ligar_en_oc", "a_nombre_de_quien"]);
let base = process.argv[2], servidor = null;
if (!base) { const { preview } = await import("vite"); servidor = await preview({ root: RAIZ, logLevel: "error", preview: { host: "127.0.0.1", port: 4279, strictPort: true } }); base = "http://127.0.0.1:4279"; }
let nav; try { nav = await chromium.launch({ headless: true }); } catch { nav = await chromium.launch({ headless: true, channel: "chrome" }); }
let falla = false; const res = [];
const ok = (nombre, c, x) => { res.push((c ? "BIEN " : "MAL  ") + " " + nombre + (x ? " · " + x : "")); if (!c) falla = true; };
const ahora = Date.now(), iso = h => new Date(ahora - h * 3600000).toISOString();
const dia = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
function fixtures(plantilla) {
  const comun = { ...plantilla, client: "CLIENTE DE PRUEBA CP", client_company: null, purchase_order_id: null, invoice_folio: null, invoice_type: null,
    invoice_pre_assigned: false, grouped_invoice_folio: null, return_covered_by_folio: null, cancelled_at: null, cancelled_by: null, delivered_at: null,
    snooze_reason: null, snoozed_by: null, snooze_stage: null, snooze_until: null, snooze_kind: null, order_type: "interna", stock_role: null,
    has_splits: false, has_matrix_lines: false, created_at: iso(48), due_date: dia(3), quantity: 100, payment_status: "unpaid", credit_applied_at: null,
    oc_invoice_group_id: null, source: null, web_order_ref: null, cart_folio: null, web_folio: null, created_by: "secretaria", agent: "Manuel",
    stage: "in_production", current_machine: "off_gto", machine_queue_position: 3, maq_price: null };
  return [
    { ...comun, id: "PRUEBA-CP-1", production_number: "P-9911", product_type: "Lonas de prueba", price: 1000, invoice_folio: "F-9911", invoice_type: "factura", invoice_pre_assigned: true },
    { ...comun, id: "PRUEBA-CP-2", production_number: "P-9912", product_type: "Volantes de prueba", price: 2000, machine_queue_position: 4 },
    { ...comun, id: "PRUEBA-CP-3", production_number: "P-9913", product_type: "Etiquetas de prueba", price: 24000, quantity: 120000, stage: "delivered", delivered_at: iso(24), invoiced_at: iso(24),
      current_machine: null, machine_queue_position: null, invoice_reason: "Dividida en 1 facturas (splits) · resto por facturar despues" },
  ];
}
// (v10.84.174) las partes de P-9913, como las lee la app de order_invoice_splits
const partesDePrueba = () => { const comun = { order_id: "PRUEBA-CP-3", invoice_pre_assigned: false, cancelled_at: null, cancellation_reason: null, cancelled_by: null, created_at: iso(24) };
  return [{ ...comun, id: "prueba-rs", position: 1, qty_portion: 50000, amount_portion: 10000, doc_type: "remision", invoice_folio: "RS-9913", payment_status: "paid" },
    { ...comun, id: "prueba-resto", position: 2, qty_portion: 70000, amount_portion: 14000, doc_type: "por_facturar", invoice_folio: null, payment_status: "unpaid" }]; };
// lo que la base contestaría a Karla (corregir_precio_revisar) con F-9911 sin timbrar
const revisar = (ordenes, args) => { const o = ordenes.find(x => x.id === args.p_order_id); if (!o) return { puede: false, codigo: "no_existe", porque: "No se encontró la orden." };
  if (!o.invoice_folio) return { puede: true, codigo: "sin_folio", caso: "sin_folio", folio: null, precio_hoy: o.price, factura: null, nuevo: null, avisos: [] };
  const p = args.p_precio_nuevo;
  return { puede: true, codigo: "con_folio", caso: "con_folio", folio: o.invoice_folio, precio_hoy: o.price, orden: { id: o.id, production_number: o.production_number },
    factura: { id: "inv-prueba", folio: o.invoice_folio, tipo: "factura", importe: Math.round(o.price * 116) / 100, saldo: Math.round(o.price * 116) / 100, cfdi_status: "none", existe: true, conceptos: false },
    nuevo: p == null ? null : { precio: p, importe: Math.round(p * 116) / 100, diferencia: Math.round((p - o.price) * 116) / 100 }, avisos: [], sin_orden_del_cliente: [] }; };
// una sesión de Karla. estado.rechazo: corregir_precio_orden contesta lo que la base rechaza
async function entrar(estado = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: false, ...contextoDeSitio(base) });
  await ctx.addInitScript(() => { window.print = () => {}; window.open = () => null; });
  const escritas = [], puertas = [], partes = partesDePrueba(); let ordenes = null;
  await ctx.route("**/*", async route => { try {
    const req = route.request(), url = req.url(), m = req.method();
    if (!/\.supabase\.co\//.test(url)) return route.continue();
    const ruta = url.replace(/^https:\/\/[^/]+/, "").replace(/\?.*$/, ""), q = new URL(url).searchParams;
    const tabla = (/^\/rest\/v1\/([a-z_]+)$/.exec(ruta) || [])[1];
    if (m === "GET" && tabla === "orders") {
      const resp = await route.fetch(); let j = await resp.json().catch(() => null);
      if (Array.isArray(j)) {
        if (!ordenes && j.length) ordenes = fixtures(j.find(o => o.stage === "in_production") || j[0]);
        const id = (q.get("id") || "").replace(/^eq\./, "");
        if (ordenes && /^PRUEBA-CP/.test(id)) j = ordenes.filter(o => o.id === id);
        else if (ordenes && (q.get("offset") || "0") === "0" && /created_at/.test(q.get("order") || "")) j = [...ordenes, ...j];
      }
      return route.fulfill({ response: resp, json: j });
    }
    // (v10.84.174) las partes de P-9913: en la lista de todas, y cuando la app pregunta por lo que falta de esa orden
    if (m === "GET" && tabla === "order_invoice_splits") {
      if ((q.get("order_id") || "") === "eq.PRUEBA-CP-3") return route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(partes.filter(s => s.doc_type === "por_facturar" && !s.cancelled_at).map(({ id, amount_portion, qty_portion }) => ({ id, amount_portion, qty_portion }))) });
      const resp = await route.fetch(); let j = await resp.json().catch(() => null);
      if (Array.isArray(j) && (q.get("offset") || "0") === "0") j = [...partes, ...j];
      return route.fulfill({ response: resp, json: j });
    }
    if (m === "GET" || m === "HEAD" || m === "OPTIONS" || ruta === "/auth/v1/token") return route.continue().catch(() => {});
    if (ruta === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" });
    if (ruta.startsWith("/storage/v1/object/sign/") || ruta.startsWith("/storage/v1/object/list/")) return route.continue();
    const rpc = (/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(ruta) || [])[1];
    let cuerpo = null; try { cuerpo = req.postDataJSON(); } catch {}
    // las dos puertas de la base, como contestarían a Karla
    if (rpc === "corregir_precio_revisar") { puertas.push({ rpc, args: cuerpo });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(revisar(ordenes || [], cuerpo || {})) }); }
    if (rpc === "corregir_precio_orden") { puertas.push({ rpc, args: cuerpo });
      if (estado.rechazo) return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "22023", message: estado.rechazo, details: null, hint: null }) });
      const o = ordenes.find(x => x.id === cuerpo.p_order_id), antes = o.price; o.price = cuerpo.p_precio_nuevo;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, caso: "con_folio", orden: o.id, production_number: o.production_number,
        precio_antes: antes, precio_despues: o.price, folio: o.invoice_folio, importe_antes: Math.round(antes * 116) / 100, importe_despues: Math.round(o.price * 116) / 100, mismo_folio: true,
        nota: o.production_number + " quedó en $" + o.price.toLocaleString("en-US", { minimumFractionDigits: 2 }) + " sin IVA y " + o.invoice_folio + " en $"
          + (Math.round(o.price * 116) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }) + ", con el mismo folio: ya la puedes timbrar." }) }); }
    if (rpc && LECTURAS.has(rpc)) {
      if (rpc === "get_user_session") { const resp = await route.fetch(); let j = await resp.json().catch(() => null); if (Array.isArray(j) && j[0]) j = [{ ...j[0], role: estado.rol || "karla" }]; return route.fulfill({ response: resp, json: j }); }
      return route.continue();
    }
    const e = { m, a: rpc ? "rpc/" + rpc : tabla || ruta, q: Object.fromEntries(q), cuerpo };
    escritas.push(e);
    // el camino de antes (sin folio): la escritura de la orden de prueba se contesta como la base (con las columnas que pidió)
    if (m === "PATCH" && tabla === "orders" && /^eq\.PRUEBA-CP/.test(q.get("id") || "")) {
      const id = q.get("id").replace(/^eq\./, ""), o = ordenes.find(x => x.id === id), precioAntes = o?.price; if (o) Object.assign(o, cuerpo || {});
      // (v10.84.174) el disparador de la base (sync_post_invoice_edit): lo que falta absorbe el cambio de precio
      if (id === "PRUEBA-CP-3" && cuerpo?.price != null) { const r = partes.find(s => s.doc_type === "por_facturar" && !s.cancelled_at); if (r) r.amount_portion = Math.round((r.amount_portion + cuerpo.price - precioAntes) * 100) / 100; }
      const cols = (q.get("select") || "id").split(",");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o ? [Object.fromEntries(cols.map(cc => [cc, o[cc]]))] : []) });
    }
    if (m === "POST" && (tabla === "order_timeline" || tabla === "notifications") && /PRUEBA-CP/.test(JSON.stringify(cuerpo || ""))) return route.fulfill({ status: 201, body: "" });
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
  // `cambiar`: otra persona mueve una orden de prueba (la próxima lectura de la app ya la ve así)
  return { ctx, p, escritas, puertas, partes, cambiar: (id, x) => Object.assign(ordenes.find(o => o.id === id), x) };
}
const texto = p => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ir = async (p, vista) => { for (let intento = 0; intento < 3; intento++) {
    if (await p.getByText(/escribe SI ENTIENDO/i).count()) { await p.getByPlaceholder(/Escribe aquí/).first().fill("SI ENTIENDO"); await p.waitForTimeout(800); }
    const b = await p.evaluateHandle(v => [...document.querySelectorAll("button[title]")].find(x => x.getAttribute("title").replace(/\s*\(\d+\)\s*$/, "").trim() === v) || null, vista);
    if (!b.asElement()) throw new Error("no encontré la vista «" + vista + "»");
    try { await b.asElement().click({ timeout: 5000 }); return; } catch (e) { if (intento === 2) throw e; await p.waitForTimeout(1500); } } };
const despertador = async p => { if (await p.getByText(/escribe SI ENTIENDO/i).first().waitFor({ timeout: 8000 }).then(() => true, () => false)) { await p.getByPlaceholder(/Escribe aquí/).first().fill("SI ENTIENDO"); await p.waitForTimeout(800); } };
const esperaTexto = async (p, re, s = 20) => { for (let k = 0; k < s * 2; k++) { if (re.test(await texto(p))) return true; await p.waitForTimeout(500); } return false; };
const aviso = p => p.evaluate(() => { const t = [...document.querySelectorAll("div")].find(d => { const cs = getComputedStyle(d); return cs.position === "fixed" && cs.bottom === "24px" && (d.innerText || "").trim(); }); return t ? t.innerText.replace(/\s+/g, " ").trim() : ""; });
const esperaAviso = async (p, re, s = 15) => { let a = ""; for (let k = 0; k < s * 4; k++) { a = await aviso(p); if (re.test(a)) return a; await p.waitForTimeout(250); } return a; };
const dlgCorr = p => p.getByRole("dialog", { name: /Corregir el precio/ });
const textoCorr = async p => ((await dlgCorr(p).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
// a su «Pendientes» → «En la planta», y el detalle de la orden de prueba → «Más» → «Corregir precio»
async function abrirCorregir(p, id, pn) {
  await despertador(p); await ir(p, "Pendientes"); await p.getByRole("tab", { name: /^En la planta/ }).click();
  if (!(await esperaTexto(p, new RegExp(pn)))) throw new Error("no se ve " + pn + " en «En la planta»");
  await p.locator('[data-orden="' + id + '"]').getByRole("button", { name: pn }).click(); await p.waitForTimeout(800);
  await p.getByRole("button", { name: /Más acciones/ }).click(); await p.waitForTimeout(300);
  const item = p.getByRole("menuitem", { name: /Corregir precio/ }); const menu = (await item.count()) ? (await item.innerText()).replace(/\s+/g, " ") : "";
  if (menu) { await item.click(); await dlgCorr(p).waitFor({ timeout: 8000 }); await p.waitForTimeout(900); }
  return menu;
}
// (v10.84.174) al «Archivo» → año → mes → semana → la orden → «Más»; devuelve lo que dice «Corregir precio» (vacío si no está) y, si está, abre su ventana
async function abrirDelArchivo(p, pn) {
  await despertador(p); await ir(p, "Archivo"); await p.waitForTimeout(500);
  const d = new Date(ahora - 24 * 3600000), y = d.getFullYear(), MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  // si no llega, dice en qué paso se quedó y qué botones veía (una caída de 15 s en «un clic» no dice nada)
  const paso = async (nombre, loc) => { if (!(await loc.count())) { await p.screenshot({ path: path.join(OUT, "archivo-sin-" + nombre + ".png") });
      throw new Error("no encontré «" + nombre + "» en el Archivo; veía: " + (await p.getByRole("button").allInnerTexts()).map(t => t.replace(/\s+/g, " ").trim()).filter(t => /\d/.test(t)).slice(0, 12).join(" | ")); }
    await loc.first().click(); await p.waitForTimeout(250); };
  const cargar = p.getByRole("button", { name: /Cargar Archivo Completo/ });   // el Archivo lee el historial completo hasta que se pide
  if (await cargar.count()) { await cargar.click(); await p.getByRole("button", { name: new RegExp("^" + y + "\\b") }).first().waitFor({ timeout: 45000 }); await p.waitForTimeout(300); }
  const semanas = p.getByRole("button", { name: /^(Del|El) \d+/ }), tarjeta = p.locator('[aria-label^="Orden ' + pn + '"]'), mes = p.getByRole("button", { name: new RegExp("^" + MESES[d.getMonth()] + " " + y) });
  // el año y el mes más recientes pueden venir abiertos: tocarlos los cerraría
  if (!(await mes.count())) await paso("el año", p.getByRole("button", { name: new RegExp("^" + y + "\\b") }));
  if (!(await semanas.count())) await paso("el mes", mes);
  for (let i = 0, n = await semanas.count(); i < n && !(await tarjeta.count()); i++) { await semanas.nth(i).click(); await p.waitForTimeout(250); }
  await paso("la orden " + pn, tarjeta); await p.waitForTimeout(600);
  const mas = p.getByRole("button", { name: /Más acciones/ }); if (!(await mas.count())) return "";
  await mas.click(); await p.waitForTimeout(300);
  const item = p.getByRole("menuitem", { name: /Corregir precio/ }); const menu = (await item.count()) ? (await item.innerText()).replace(/\s+/g, " ") : "";
  if (menu) { await item.click(); await dlgCorr(p).waitFor({ timeout: 8000 }); await p.waitForTimeout(500); }
  return menu;
}
const corre = l => !process.env.SOLO || process.env.SOLO.includes(l);
try {
  // ── A: la foliada, por la puerta de la base ──
  if (corre("A")) { const { ctx, p, escritas, puertas } = await entrar();
    try {
      const menu = await abrirCorregir(p, "PRUEBA-CP-1", "P-9911");
      ok("A1 «Más» del detalle ofrece «Corregir precio» con su folio", /Corregir precio/.test(menu) && /F-9911/.test(menu), "«" + menu + "»");
      const al = await textoCorr(p);
      ok("A2 al abrir revisa en la base (corregir_precio_revisar, sin precio) y dice en cuánto está F-9911", puertas.some(x => x.rpc === "corregir_precio_revisar" && x.args?.p_order_id === "PRUEBA-CP-1" && x.args?.p_precio_nuevo == null)
        && /F-9911/.test(al) && /\$1,160\.00/.test(al), "«" + al.slice(0, 200) + "» · " + JSON.stringify(puertas));
      await dlgCorr(p).getByLabel(/Precio correcto/).fill("1250"); await dlgCorr(p).getByLabel(/Por qué cambia/).fill("Se capturó mal: el cliente aceptó $1,250"); await p.waitForTimeout(1200);
      const con = await textoCorr(p);
      ok("A3 con $1,250 revisa ese precio y dice «de $1,160.00 a $1,450.00 con IVA, con el mismo folio»", puertas.some(x => x.rpc === "corregir_precio_revisar" && x.args?.p_precio_nuevo === 1250)
        && /de \$1,160\.00 a \$1,450\.00/.test(con) && /mismo folio/.test(con), "«" + con.slice(0, 260) + "»");
      await dlgCorr(p).getByRole("button", { name: /^Cambiar a/ }).click();
      const a = await esperaAviso(p, /F-9911/);
      const orden = puertas.filter(x => x.rpc === "corregir_precio_orden"), g = orden[0]?.args || {};
      ok("A4 guarda UNA vez por corregir_precio_orden, con el precio, el porqué y lo que se vio ($1,000, F-9911, $1,160), sin conceptos",
        orden.length === 1 && g.p_order_id === "PRUEBA-CP-1" && g.p_precio_nuevo === 1250 && g.p_motivo === "Se capturó mal: el cliente aceptó $1,250"
        && g.p_precio_visto === 1000 && g.p_folio_visto === "F-9911" && g.p_importe_visto === 1160 && g.p_conceptos === null, JSON.stringify(orden));
      const porSuCuenta = escritas.filter(e => /PRUEBA-CP-1/.test(JSON.stringify(e)) && (e.a === "orders" || e.a === "order_timeline" || e.a === "notifications"));
      ok("A5 la app no escribe la orden ni anota ni avisa por su cuenta (la base lo hace: saldrían dobles)", porSuCuenta.length === 0, porSuCuenta.map(e => e.m + " " + e.a).join(" · ") || "nada por su cuenta");
      const sigue = await dlgCorr(p).count();
      ok("A6 dice la nota de la base y se cierra", /P-9911 quedó en \$1,250\.00 sin IVA y F-9911 en \$1,450\.00/.test(a) && !sigue, "aviso «" + a + "» · ventana " + (sigue ? "SIGUE abierta" : "cerrada"));
      await p.screenshot({ path: path.join(OUT, "A-foliada.png") });
    } catch (e) { ok("A (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }

  // ── B: sin folio, el camino de antes ──
  if (corre("B")) { const { ctx, p, escritas, puertas } = await entrar();
    try {
      const menu = await abrirCorregir(p, "PRUEBA-CP-2", "P-9912");
      ok("B1 sin folio, «Más» dice «Antes de facturar»", /Corregir precio/.test(menu) && /Antes de facturar/.test(menu), "«" + menu + "»");
      await dlgCorr(p).getByLabel(/Precio correcto/).fill("2500"); await dlgCorr(p).getByLabel(/Por qué cambia/).fill("Se capturó mal: el cliente aceptó $2,500"); await p.waitForTimeout(600);
      await dlgCorr(p).getByRole("button", { name: /^Cambiar a/ }).click();
      const a = await esperaAviso(p, /P-9912/);
      const parche = escritas.find(e => e.m === "PATCH" && e.a === "orders" && e.q.id === "eq.PRUEBA-CP-2");
      const tl = escritas.filter(e => e.a === "order_timeline" && /PRUEBA-CP-2/.test(JSON.stringify(e.cuerpo))), av = escritas.filter(e => e.a === "notifications" && /PRUEBA-CP-2/.test(JSON.stringify(e.cuerpo)));
      ok("B2 sin preguntar a la base por su factura, escribe el precio con sus condiciones, lo anota y avisa a Dirección y a quien capturó (como v10.84.115)",
        !puertas.length && !!parche && parche.cuerpo?.price === 2500 && parche.q.invoice_folio === "is.null" && tl.length === 1 && av.length === 2 && /2,500/.test(a),
        JSON.stringify({ puertas: puertas.length, parche: parche && { cuerpo: parche.cuerpo, q: parche.q }, anotado: tl.length, avisos: av.map(x => x.cuerpo?.target_role), aviso: a }));
    } catch (e) { ok("B (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }

  // ── C: lo que la base rechaza al guardar ──
  if (corre("C")) { const { ctx, p } = await entrar({ rechazo: "El importe de F-9911 cambió mientras lo revisabas: ahora es $1,392.00. No se cambió nada." });
    try {
      await abrirCorregir(p, "PRUEBA-CP-1", "P-9911");
      await dlgCorr(p).getByLabel(/Precio correcto/).fill("1250"); await dlgCorr(p).getByLabel(/Por qué cambia/).fill("Se capturó mal: el cliente aceptó $1,250"); await p.waitForTimeout(1200);
      await dlgCorr(p).getByRole("button", { name: /^Cambiar a/ }).click(); await p.waitForTimeout(1500);
      const t = await textoCorr(p), sigue = await dlgCorr(p).count();
      ok("C1 el rechazo de la base se dice dentro de la ventana, tal cual, con «Volver a revisar»", sigue === 1 && /El importe de F-9911 cambió mientras lo revisabas/.test(t) && /Volver a revisar/.test(t), "«" + t.slice(0, 260) + "»");
      await p.screenshot({ path: path.join(OUT, "C-rechazo.png") });
    } catch (e) { ok("C (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }

  // ── D (vuelta 4): le asignan folio con la ventana abierta ──
  if (corre("D")) { const { ctx, p, escritas, puertas, cambiar } = await entrar();
    try {
      await abrirCorregir(p, "PRUEBA-CP-2", "P-9912");
      await dlgCorr(p).getByLabel(/Precio correcto/).fill("2500"); await p.waitForTimeout(300);
      cambiar("PRUEBA-CP-2", { invoice_folio: "F-9912", invoice_type: "factura", invoice_pre_assigned: true });   // Karla (en otra pestaña) le asignó folio anticipado
      await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));   // la app relee (como al volver a la pestaña)
      let t = ""; for (let k = 0; k < 40; k++) { t = await textoCorr(p); if (/F-9912/.test(t)) break; await p.waitForTimeout(500); }
      ok("D1 la ventana se vuelve a abrir revisando F-9912 en la base", /F-9912/.test(t) && puertas.some(x => x.rpc === "corregir_precio_revisar" && x.args?.p_order_id === "PRUEBA-CP-2"),
        "«" + t.slice(0, 220) + "» · " + JSON.stringify(puertas));
      await dlgCorr(p).getByLabel(/Precio correcto/).fill("2500"); await dlgCorr(p).getByLabel(/Por qué cambia/).fill("Se capturó mal: el cliente aceptó $2,500"); await p.waitForTimeout(1200);
      await dlgCorr(p).getByRole("button", { name: /^Cambiar a/ }).click(); await esperaAviso(p, /F-9912/);
      const orden = puertas.filter(x => x.rpc === "corregir_precio_orden"), porSuCuenta = escritas.filter(e => /PRUEBA-CP-2/.test(JSON.stringify(e)) && ["orders", "order_timeline", "notifications"].includes(e.a));
      ok("D2 guarda por la base (corregir_precio_orden con F-9912), sin escribir la orden ni avisar por su cuenta",
        orden.length === 1 && orden[0].args?.p_folio_visto === "F-9912" && orden[0].args?.p_precio_nuevo === 2500 && !porSuCuenta.length,
        JSON.stringify({ orden: orden.map(x => x.args), porSuCuenta: porSuCuenta.map(e => e.m + " " + e.a) }));
      await p.screenshot({ path: path.join(OUT, "D-folio-en-medio.png") });
    } catch (e) { ok("D (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }

  // ── E (v10.84.174): Dirección, desde el Archivo, corrige lo que falta de una orden entregada y por partes ──
  if (corre("E")) { const { ctx, p, escritas, puertas } = await entrar({ rol: "admin" });
    try {
      const menu = await abrirDelArchivo(p, "P-9913");
      ok("E1 el detalle abierto desde el Archivo ofrece «Corregir precio» con lo que falta", /Corregir precio/.test(menu) && /Faltan \$14,000\.00 por facturar/.test(menu), "«" + menu + "»");
      const al = await textoCorr(p);
      ok("E2 la ventana dice lo que falta y que lo ya facturado no cambia", /Falta por facturar: \$14,000\.00 sin IVA · 70,000 pzas · \$0\.20 la pieza/.test(al) && /\$10,000\.00\) no cambia/.test(al), "«" + al.slice(0, 260) + "»");
      await p.screenshot({ path: path.join(OUT, "E-lo-que-falta.png") });
      await dlgCorr(p).getByLabel(/Lo que falta, sin IVA/).fill("12600"); await dlgCorr(p).getByLabel(/Por qué cambia/).fill("Lo que falta se cobra a $0.18 la pieza"); await p.waitForTimeout(400);
      const con = await textoCorr(p);
      ok("E3 con $12,600 dice en cuánto queda la orden y a cuánto la pieza", /La orden queda en \$22,600\.00 · \$0\.18 la pieza/.test(con), "«" + con.slice(0, 320) + "»");
      await dlgCorr(p).getByRole("button", { name: /^Cambiar a/ }).click();
      const a = await esperaAviso(p, /P-9913/);
      const parche = escritas.filter(e => e.m === "PATCH" && e.a === "orders" && e.q.id === "eq.PRUEBA-CP-3");
      ok("E4 escribe UNA vez el precio de la orden ($22,600, no $12,600), con quién y sus condiciones, sin excluir la entregada y sin pasar por la puerta de lo foliado",
        parche.length === 1 && parche[0].cuerpo?.price === 22600 && !!parche[0].cuerpo?.last_edited_by && !!parche[0].cuerpo?.last_edited_at && parche[0].q.invoice_folio === "is.null"
        && parche[0].q.price === "eq.24000" && /cancelled/.test(parche[0].q.stage || "") && !/delivered/.test(parche[0].q.stage || "") && !puertas.length, JSON.stringify({ parche, puertas }));
      const tl = escritas.filter(e => e.a === "order_timeline" && /PRUEBA-CP-3/.test(JSON.stringify(e.cuerpo))), av = escritas.filter(e => e.a === "notifications" && /PRUEBA-CP-3/.test(JSON.stringify(e.cuerpo)));
      ok("E5 anota de cuánto a cuánto, lo que falta y el porqué en el historial, y avisa a quien capturó la orden (no a Dirección, que es quien corrige)",
        tl.length === 1 && /\$24,000\.00 → \$22,600\.00/.test(JSON.stringify(tl[0].cuerpo)) && /lo que falta: \$14,000\.00 → \$12,600\.00/.test(JSON.stringify(tl[0].cuerpo)) && /a \$0\.18 la pieza/.test(JSON.stringify(tl[0].cuerpo))
        && av.length === 1 && av[0].cuerpo?.target_role === "secretaria", JSON.stringify({ tl: tl.map(e => e.cuerpo), av: av.map(e => e.cuerpo) }));
      ok("E6 dice en cuánto quedó y la ventana se cierra", /lo que falta quedó en \$12,600\.00 y la orden en \$22,600\.00/.test(a) && !(await dlgCorr(p).count()), "aviso «" + a + "»");
      // una recarga ya en vuelo al guardar puede traer el precio de antes (salió una vez de cuatro). En producción la corrige la recarga del tiempo real que dispara el UPDATE; la orden de
      //   prueba no emite ese evento, así que aquí se hace lo mismo que él: si no dice lo nuevo, que la app relea
      const NUEVO = /Facturado \$10,000\.00 de \$22,600\.00 · faltan \$12,600\.00/; let det = await texto(p);
      if (!NUEVO.test(det)) { await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await esperaTexto(p, NUEVO, 15); det = await texto(p); }
      ok("E7 el detalle ya dice lo nuevo, sin cerrarlo", NUEVO.test(det), det.match(/Facturado.{0,80}/)?.[0] || "(no dice «Facturado»)");
      await p.screenshot({ path: path.join(OUT, "E-corregida.png") });
    } catch (e) { ok("E (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }

  // ── F (v10.84.174): a Karla no se le ofrece ──
  if (corre("F")) { const { ctx, p } = await entrar();
    try {
      const menu = await abrirDelArchivo(p, "P-9913");
      ok("F1 a Karla, en el mismo lugar, no se le ofrece (por tabla, la base se lo rechaza)", !menu, "«" + menu + "»");
    } catch (e) { ok("F (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }

  // ── G (v10.84.174): lo que falta se factura con la ventana abierta ──
  if (corre("G")) { const { ctx, p, escritas, partes } = await entrar({ rol: "admin" });
    try {
      await abrirDelArchivo(p, "P-9913");
      await dlgCorr(p).getByLabel(/Lo que falta, sin IVA/).fill("12600"); await dlgCorr(p).getByLabel(/Por qué cambia/).fill("Lo que falta se cobra a $0.18 la pieza"); await p.waitForTimeout(300);
      const r = partes.find(s => s.doc_type === "por_facturar");   // Karla (en otra pestaña) facturó todo lo que faltaba
      r.cancelled_at = new Date().toISOString(); r.cancellation_reason = "Consumida: facturada completa como parte 3 (RS-9914)";
      partes.push({ ...r, id: "prueba-rs2", position: 3, doc_type: "remision", invoice_folio: "RS-9914", cancelled_at: null, cancellation_reason: null });
      await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      let t = ""; for (let k = 0; k < 40; k++) { t = await textoCorr(p); if (/Ya no falta nada por facturar/.test(t)) break; await p.waitForTimeout(500); }
      const apagado = await dlgCorr(p).getByRole("button", { name: /^Cambiar a/ }).isDisabled();
      const parches = escritas.filter(e => e.m === "PATCH" && e.a === "orders");
      ok("G1 si lo que falta se facturó con la ventana abierta, lo dice, no deja guardar y no escribe", /Ya no falta nada por facturar/.test(t) && apagado && !parches.length, "«" + t.slice(0, 240) + "» · apagado " + apagado);
      await p.screenshot({ path: path.join(OUT, "G-ya-no-falta.png") });
    } catch (e) { ok("G (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }

  // ── H (v10.84.174): «es que está en archivo, ¿la regreso a salidas?»: lo que falta se factura desde el mismo detalle ──
  if (corre("H")) { const { ctx, p, escritas } = await entrar({ rol: "admin" });
    try {
      await abrirDelArchivo(p, "P-9913");   // abre «Corregir precio»; se cierra y se usa el «Más» otra vez
      await p.keyboard.press("Escape"); await p.waitForTimeout(400);
      await p.getByRole("button", { name: /Más acciones/ }).click(); await p.waitForTimeout(300);
      const item = p.getByRole("menuitem", { name: /Facturar siguiente parte/ }), menu = (await item.count()) ? (await item.innerText()).replace(/\s+/g, " ") : "";
      ok("H1 el detalle abierto desde el Archivo ofrece «Facturar siguiente parte» con lo que falta", /Faltan \$14,000\.00 por facturar/.test(menu), "«" + menu + "»");
      await item.click(); const dlg = p.getByRole("dialog", { name: /Facturar siguiente parte/ }); await dlg.waitFor({ timeout: 8000 }); await p.waitForTimeout(600);
      // lo que se ve de verdad: el centro de la ventana es de la ventana, no del detalle que quedó abajo
      const arriba = await dlg.evaluate(d => { const r = d.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && d.contains(e); });
      const tipo = await dlg.getByLabel("Tipo de documento").inputValue(), monto = await dlg.locator("#sp-subtotal").inputValue();
      const tx = ((await dlg.innerText()) || "").replace(/\s+/g, " ");
      ok("H2 la ventana sale ENCIMA del detalle, con la remisión (el tipo de RS-9913), lo que falta y sus piezas", arriba && tipo === "remision" && Number(monto) === 14000 && /70,?000/.test(await dlg.evaluate(d => [...d.querySelectorAll("input")].map(i => i.value).join(" ") + " " + d.innerText)),
        JSON.stringify({ arriba, tipo, monto, tx: tx.slice(0, 160) }));
      await p.screenshot({ path: path.join(OUT, "H-siguiente-parte.png") });
      await p.keyboard.press("Escape"); await p.waitForTimeout(500);
      const cerrada = !(await dlg.count()), detalle = /Facturado \$10,000\.00 de \$24,000\.00/.test(await texto(p));
      const escribio = escritas.filter(e => /facturar_siguiente_parte/.test(e.a) || (e.m === "PATCH" && /PRUEBA-CP-3/.test(JSON.stringify(e.q))));
      ok("H3 Esc cierra la ventana, el detalle sigue y nada se escribió", cerrada && detalle && !escribio.length, JSON.stringify({ cerrada, detalle, escribio }));
    } catch (e) { ok("H (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
} finally {
  await nav.close();
  if (servidor) await new Promise(r => servidor.httpServer.close(r));
}
for (const r of res) console.log(r);
console.log(falla ? "\ncorregir-foliada: algo salió MAL" : "\ncorregir-foliada: todo BIEN");
process.exit(falla ? 1 : 0);
