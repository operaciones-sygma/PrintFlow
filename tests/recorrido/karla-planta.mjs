// KARLA PASA A SALIDAS LO QUE YA ESTÁ LISTO (v10.84.67), con la app REAL (compilada o publicada) contra la base real y SIN escribir
// nada: lo que el banco «planta» no ve porque lo hace App (doAdv con la bitácora y los avisos, las pestañas de «Folios», el
// buscador, la OC y el detalle). Una OC de prueba (OC-PRUEBA-KP: P-9901 en Salidas, P-9902 corriendo en la GTO, P-9903 en
// Empaque) existe sólo en este navegador: se agrega a lo que contesta la base al leer `orders` y `purchase_orders`. Toda
// escritura se corta en el navegador y se anota; las de «pasar a Salidas» se contestan como la base (y la OC de prueba cambia
// con ellas), o se rechazan en el escenario de la falla. Lo que DEBE pasar, para Karla:
//  A. «Folios» tiene «Por foliar» y «En la planta»; si busca P-9902 en «Por foliar» se le dice que sigue en la planta y dónde, con
//     un botón que la lleva; ahí está la OC con «1 de 3 en Salidas» y sus dos órdenes con «Pasar a Salidas»;
//  B. «Pasar las 2 a Salidas» pregunta y, con el sí, la app escribe exactamente lo del «A Salidas» de Gerardo: saca P-9902 de la
//     fila de la GTO, cambia las dos a Salidas con el candado de etapa, anota en la bitácora que las pasó Karla, le avisa a
//     Gerardo (y no a Karla misma), y dice que ya se puede asignar folio a la OC; la OC sale de «En la planta»;
//  C. si la base rechaza el cambio: el aviso dice qué orden y que no pasó, la otra no se intenta, y siguen en la planta;
//  D. en «Órdenes de Compra», la OC dice cuáles faltan y dónde, con el botón; no ofrece «Asignar folio» (sí «Pre-asignar folio»);
//  E. en el detalle de P-9903, «Más» ofrece «Ya está lista: pasar a Salidas» y la pregunta sale ENCIMA del detalle (Esc la cierra
//     y el detalle sigue).
// Uso:  npm run build && node tests/recorrido/karla-planta.mjs            (sirve dist/ en 127.0.0.1:4278)
//       node tests/recorrido/karla-planta.mjs https://produccion.sygma.mx (la app publicada)
//       SOLO=AB corre sólo esos escenarios. Sale con 1 si algo sale MAL.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(RAIZ, "tests/salida/karla-planta"); fs.mkdirSync(OUT, { recursive: true });
const CRED = JSON.parse(fs.readFileSync(process.env.PF_CREDENCIAL || "C:/Users/padil/claude-navegador/credencial-printflow.json", "utf8"));
const LECTURAS = new Set(["client_credit_balance", "get_app_config", "get_client_aliases", "get_client_billing_info",
  "get_client_seller_label", "get_folio_emitter_enabled", "get_last_contact_for_client", "get_pantone_by_code", "get_user_session",
  "list_anticipo_clients", "list_consecutive_cobranza_folios", "list_corona_oc_invoices", "list_linkable_invoices_for_oc",
  "list_linkable_invoices_for_order", "list_linkable_invoices_for_split", "list_stock_clients", "load_credit_ledger",
  "oc_shared_folio_is_cancelled", "ordenes_saldo_consumido", "order_folio_is_cancelled", "pf_archivos_del_bucket", "resolve_client_for_order",
  "search_clients_typeahead", "search_pantone", "sugerencia_folios", "validate_production_number"]);
let base = process.argv[2], servidor = null;
if (!base) { const { preview } = await import("vite"); servidor = await preview({ root: RAIZ, logLevel: "error", preview: { host: "127.0.0.1", port: 4278, strictPort: true } }); base = "http://127.0.0.1:4278"; }
let nav; try { nav = await chromium.launch({ headless: true }); } catch { nav = await chromium.launch({ headless: true, channel: "chrome" }); }
let falla = false; const res = [];
const ok = (nombre, c, x) => { res.push((c ? "BIEN " : "MAL  ") + " " + nombre + (x ? " · " + x : "")); if (!c) falla = true; };
const OC = "OC-PRUEBA-KP";
const ahora = Date.now(), iso = h => new Date(ahora - h * 3600000).toISOString();
const dia = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
// las órdenes de prueba: se arman sobre una orden real (todas sus columnas) la primera vez que la app lee `orders`
function fixtures(plantilla) {
  const comun = { ...plantilla, client: "CLIENTE DE PRUEBA KP", client_company: null, purchase_order_id: OC, invoice_folio: null, invoice_type: null,
    invoice_pre_assigned: false, grouped_invoice_folio: null, return_covered_by_folio: null, cancelled_at: null, cancelled_by: null, delivered_at: null,
    snooze_reason: null, snoozed_by: null, snooze_stage: null, snooze_until: null, snooze_kind: null, order_type: "interna", stock_role: null,
    has_splits: false, has_matrix_lines: false, created_at: iso(48), due_date: dia(3), price: 1000, quantity: 500, payment_status: null,
    source: null, web_order_ref: null, cart_folio: null, web_folio: null, created_by: "secretaria", agent: plantilla.agent || "Manuel" };
  return [
    { ...comun, id: "PRUEBA-KP-1", production_number: "P-9901", product_type: "Etiquetas de prueba", stage: "salidas", current_machine: null, machine_queue_position: null },
    { ...comun, id: "PRUEBA-KP-2", production_number: "P-9902", product_type: "Volantes de prueba", stage: "in_production", current_machine: "off_gto", machine_queue_position: 0 },
    { ...comun, id: "PRUEBA-KP-3", production_number: "P-9903", product_type: "Cajas de prueba", stage: "packaging", current_machine: "vm_manual", machine_queue_position: null },
  ];
}
// una sesión de Karla. `estado.falla`: la base rechaza el cambio de etapa de las órdenes de prueba
async function entrar(estado = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: false });
  await ctx.addInitScript(() => { window.print = () => {}; window.open = () => null; });
  const escritas = []; let ordenes = null;
  // (todo el manejador en try: si el escenario cierra su contexto con una lectura en camino, route.fetch truena y tumbaba la corrida)
  await ctx.route("**/*", async route => { try {
    const req = route.request(), url = req.url(), m = req.method();
    if (!/\.supabase\.co\//.test(url)) return route.continue();
    const ruta = url.replace(/^https:\/\/[^/]+/, "").replace(/\?.*$/, ""), q = new URL(url).searchParams;
    const tabla = (/^\/rest\/v1\/([a-z_]+)$/.exec(ruta) || [])[1];
    // lo que lee la app, con la OC de prueba agregada (sólo en la primera página de la lista; y si pide una de prueba por id)
    if (m === "GET" && tabla === "orders") {
      const resp = await route.fetch(); let j = await resp.json().catch(() => null);
      if (Array.isArray(j)) {
        if (!ordenes && j.length) ordenes = fixtures(j.find(o => o.stage === "in_production") || j[0]);
        const id = (q.get("id") || "").replace(/^eq\./, "");
        if (ordenes && /^PRUEBA-KP/.test(id)) j = ordenes.filter(o => o.id === id);
        else if (ordenes && (q.get("offset") || "0") === "0" && /created_at/.test(q.get("order") || "")) j = [...ordenes, ...j];
      }
      return route.fulfill({ response: resp, json: j });
    }
    if (m === "GET" && tabla === "purchase_orders") {
      const resp = await route.fetch(); let j = await resp.json().catch(() => null);
      if (Array.isArray(j) && j.length && (q.get("offset") || "0") === "0") j = [{ ...j[0], id: OC, client: "CLIENTE DE PRUEBA KP", status: "open", shared_invoice_folio: null,
        folios_locked: false, folios_lock_reason: null, is_web_oc: false, is_simple_oc: false, matrix_plan: null, total: 3480, notes: null, cancelled_at: null, completed_at: null }, ...j];
      return route.fulfill({ response: resp, json: j });
    }
    if (m === "GET" || m === "HEAD" || m === "OPTIONS" || ruta === "/auth/v1/token") return route.continue().catch(() => {});
    if (ruta === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" });
    if (ruta.startsWith("/storage/v1/object/sign/") || ruta.startsWith("/storage/v1/object/list/")) return route.continue();
    const rpc = (/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(ruta) || [])[1];
    if (rpc && LECTURAS.has(rpc)) {
      if (rpc === "get_user_session") { const resp = await route.fetch(); let j = await resp.json().catch(() => null); if (Array.isArray(j) && j[0]) j = [{ ...j[0], role: "karla" }]; return route.fulfill({ response: resp, json: j }); }
      return route.continue();
    }
    let cuerpo = null; try { cuerpo = req.postDataJSON(); } catch {}
    const e = { m, a: rpc ? "rpc/" + rpc : tabla || ruta, q: Object.fromEntries(q), cuerpo };
    escritas.push(e);
    // lo de «pasar a Salidas» sobre las de prueba: la base lo acepta (o lo rechaza en el escenario de la falla)
    const deIdPrueba = /^eq\.PRUEBA-KP/.test(q.get("id") || "");
    if (rpc === "move_order_in_queue" && /^PRUEBA-KP/.test(cuerpo?.p_order_id || "")) {
      const o = ordenes.find(x => x.id === cuerpo.p_order_id);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ action: "removed_from_queue", old_machine: o?.current_machine, old_position: o?.machine_queue_position, new_active_id: null }) });
    }
    if (m === "PATCH" && tabla === "orders" && deIdPrueba) {
      if (estado.falla) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "XX000", message: "la base no contestó (prueba)" }) });
      const id = q.get("id").replace(/^eq\./, ""), o = ordenes.find(x => x.id === id);
      if (o && (!q.get("stage") || q.get("stage") === "eq." + o.stage)) Object.assign(o, cuerpo || {});
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o ? [{ id }] : []) });
    }
    if (m === "POST" && (tabla === "order_timeline" || tabla === "notifications") && /PRUEBA-KP/.test(JSON.stringify(cuerpo || ""))) return route.fulfill({ status: 201, body: "" });
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
  return { ctx, p, escritas, cambiar: (id, x) => Object.assign(ordenes.find(o => o.id === id), x) };
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
const pestana = (p, nombre) => p.getByRole("tab", { name: new RegExp("^" + nombre) });
// a «Folios» y a la pestaña «En la planta», con la OC de prueba a la vista
async function aLaPlanta(p) { await despertador(p); await ir(p, "Folios"); await pestana(p, "En la planta").click(); return esperaTexto(p, new RegExp(OC)); }
const corre = l => !process.env.SOLO || process.env.SOLO.includes(l);
try {
  // ── A: las pestañas, el buscador y la OC a medias ──
  if (corre("A")) { const { ctx, p } = await entrar();
    try {
      await despertador(p); await ir(p, "Folios"); await p.waitForTimeout(800);
      const tabs = await p.getByRole("tab").allInnerTexts();
      ok("A1 «Folios» tiene «Por foliar» y «En la planta»", tabs.some(t => /^Por foliar/.test(t)) && tabs.some(t => /^En la planta\s*\d+/.test(t)), "pestañas: " + tabs.map(t => "«" + t.replace(/\s+/g, " ") + "»").join(", "));
      await pestana(p, "Por foliar").click();
      await p.getByPlaceholder("Buscar orden...").fill("P-9902"); await p.waitForTimeout(800);
      const t = await texto(p), dice = /P-9902 todavía no llega a Salidas: En GTO 1 Color \(corriendo\)/.test(t);
      ok("A2 buscar una que sigue en la planta lo dice, y dónde", dice && !/Sin órdenes en salida/.test(t), dice ? (/Sin órdenes en salida/.test(t) ? "lo dice, PERO también «Sin órdenes en salida»" : "«P-9902 todavía no llega a Salidas: En GTO 1 Color (corriendo)»") : "NO lo dice: «" + (t.match(/Pendientes de Folio.{0,200}/) || [t.slice(0, 200)])[0] + "»");
      await p.getByRole("button", { name: /Ver en «En la planta»/ }).click(); await p.waitForTimeout(600);
      const g = await p.evaluate(oc => { const e = document.querySelector('[data-oc="' + oc + '"]'); return e ? e.innerText.replace(/\s+/g, " ") : null; }, OC);
      ok("A3 el botón lleva a la OC en «En la planta»", !!g && /1 de 3 en Salidas/.test(g) && /P-9902/.test(g), g ? "«" + g.slice(0, 160) + "»" : "NO se ve la OC de prueba");
      await p.getByPlaceholder("Buscar orden...").fill(""); await p.waitForTimeout(600);
      const b = await p.evaluate(oc => { const e = document.querySelector('[data-oc="' + oc + '"]'); return e ? [...e.querySelectorAll("button")].map(x => x.innerText.trim()).filter(x => /Pasar/.test(x)) : []; }, OC);
      ok("A4 la OC ofrece pasar las dos, y cada una la suya", b.filter(x => /^Pasar a Salidas$/.test(x)).length === 2 && b.some(x => /Pasar las 2 a Salidas/.test(x)), "botones: " + b.join(" · "));
      await p.screenshot({ path: path.join(OUT, "A-en-la-planta.png") });
      // (vuelta 3) la pestaña se recuerda al salir de «Folios» y volver; y en el monitor de 1920 no hay barra horizontal
      await ir(p, "Órdenes de Compra"); await p.waitForTimeout(500); await ir(p, "Folios"); await p.waitForTimeout(600);
      const sel = await p.getByRole("tab", { selected: true }).innerText().catch(() => "");
      ok("A5 al volver a «Folios» sigue en «En la planta»", /^En la planta/.test(sel), "pestaña abierta: «" + sel.replace(/\s+/g, " ") + "»");
      for (const [an, al] of [[1920, 1080], [1366, 768]]) {
        await p.setViewportSize({ width: an, height: al }); await p.waitForTimeout(400);
        const r = await p.evaluate(() => ({ h: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          partidos: [...document.querySelectorAll("[data-orden] button,[data-oc] button")].filter(b => /Pasar/.test(b.textContent) && b.getClientRects().length && b.getBoundingClientRect().height > 48).map(b => b.textContent.trim()) }));
        ok("A6 a " + an + ": sin barra horizontal y los botones en un renglón", !r.h && !r.partidos.length, (r.h ? "CON barra horizontal" : "sin barra horizontal") + (r.partidos.length ? "; partidos: " + r.partidos.join(", ") : ""));
        await p.screenshot({ path: path.join(OUT, "A-en-la-planta-" + an + ".png") });
      }
    } catch (e) { ok("A (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }

  // ── B: pasar las dos de la OC, y lo que la app escribe ──
  if (corre("B")) { const { ctx, p, escritas } = await entrar();
    try {
      if (!(await aLaPlanta(p))) throw new Error("no se ve la OC de prueba en «En la planta»");
      await p.locator('[data-oc="' + OC + '"]').getByRole("button", { name: /Pasar las 2 a Salidas/ }).click(); await p.waitForTimeout(500);
      const d = await p.evaluate(() => { const x = document.querySelector('[role="dialog"]'); return x ? x.innerText.replace(/\s+/g, " ") : ""; });
      ok("B1 pregunta antes, con lo que pasa", /2 órdenes de OC-PRUEBA-KP/.test(d) && /P-9902/.test(d) && /GTO 1 Color/.test(d) && /P-9903/.test(d) && /Empaque/.test(d) && /Gerardo/.test(d) && !escritas.some(e => e.m === "PATCH"),
        d ? "«" + d.slice(0, 220) + "»" + (escritas.some(e => e.m === "PATCH") ? " · y YA ESCRIBIÓ antes de contestar" : "") : "NO PREGUNTA");
      await p.getByRole("button", { name: /Sí, ya están listas/ }).click();
      const a = await esperaAviso(p, /Salidas/);
      const parches = escritas.filter(e => e.m === "PATCH" && e.a === "orders"), cola = escritas.filter(e => e.a === "rpc/move_order_in_queue");
      const tl = escritas.filter(e => e.a === "order_timeline").map(e => e.cuerpo), av = escritas.filter(e => e.a === "notifications").map(e => e.cuerpo);
      const p2 = parches.find(e => e.q.id === "eq.PRUEBA-KP-2"), p3 = parches.find(e => e.q.id === "eq.PRUEBA-KP-3");
      ok("B2 saca a P-9902 de la fila de la GTO", cola.length === 1 && cola[0].cuerpo?.p_order_id === "PRUEBA-KP-2" && cola[0].cuerpo?.p_target_machine == null, cola.length ? cola.map(e => JSON.stringify(e.cuerpo)).join(" ") : "no la sacó de la fila");
      ok("B3 las dos a Salidas, con el candado de etapa", !!p2 && !!p3 && p2.q.stage === "eq.in_production" && p3.q.stage === "eq.packaging" && p2.cuerpo?.stage === "salidas" && p3.cuerpo?.stage === "salidas" && p2.cuerpo?.current_machine === null && p3.cuerpo?.current_machine === null,
        parches.map(e => e.q.id + " (" + e.q.stage + ") → " + JSON.stringify(e.cuerpo)).join(" · ") || "no cambió ninguna");
      ok("B4 la bitácora dice que las pasó Karla", tl.length === 2 && tl.every(x => x.by_user === "karla" && x.to_stage === "salidas" && /la pasó Karla/.test(x.action || "")), tl.map(x => "«" + x.action + "» (" + x.by_user + ")").join(" · ") || "no anotó nada");
      const aGerardo = av.filter(x => x.target_role === "produccion" && /Karla pasó P-990[23] a Salidas/.test(x.message || "")), aKarla = av.filter(x => x.target_role === "karla");
      ok("B5 a Gerardo le llega el aviso (y a Karla no el suyo)", aGerardo.length === 2 && aKarla.length === 0, `a Gerardo: ${aGerardo.length} (${aGerardo.map(x => "«" + x.message.slice(0, 70) + "»").join(" ")}); a Karla misma: ${aKarla.length}`);
      ok("B6 dice que ya se puede foliar la OC", /P-9902/.test(a) && /P-9903/.test(a) && /ya puedes asignar folio a OC-PRUEBA-KP/.test(a), "aviso: «" + a + "»");
      await p.waitForTimeout(500);
      const sigue = await p.locator('[data-oc="' + OC + '"]').count();
      ok("B7 la OC sale de «En la planta»", !sigue, sigue ? "SIGUE en «En la planta»" : "ya no está");
      await p.screenshot({ path: path.join(OUT, "B-pasadas.png") });
    } catch (e) { ok("B (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }

  // ── C: la base rechaza el cambio ──
  if (corre("C")) { const { ctx, p, escritas } = await entrar({ falla: true });
    try {
      if (!(await aLaPlanta(p))) throw new Error("no se ve la OC de prueba en «En la planta»");
      await p.locator('[data-oc="' + OC + '"]').getByRole("button", { name: /Pasar las 2 a Salidas/ }).click(); await p.waitForTimeout(400);
      await p.getByRole("button", { name: /Sí, ya están listas/ }).click();
      const a = await esperaAviso(p, /no pasó a Salidas/);
      const parches = escritas.filter(e => e.m === "PATCH" && e.a === "orders");
      ok("C1 el aviso dice cuál no pasó y que la otra no se intentó", /P-990[23] no pasó a Salidas/.test(a) && /P-990[23] no se intentó\./.test(a) && parches.length === 1 && !/XX000|Error:/.test(a), "aviso: «" + a + "»; cambios intentados: " + parches.length);
      await p.waitForTimeout(2500);
      const g = await p.evaluate(oc => { const e = document.querySelector('[data-oc="' + oc + '"]'); return e ? e.innerText.replace(/\s+/g, " ") : null; }, OC);
      ok("C2 siguen en la planta", !!g && /P-9902/.test(g) && /P-9903/.test(g), g ? "la OC sigue con las dos" : "la OC YA NO SE VE");
      await p.screenshot({ path: path.join(OUT, "C-rechazo.png") });
    } catch (e) { ok("C (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }

  // ── D: la OC dice cuáles faltan ──
  if (corre("D")) { const { ctx, p } = await entrar();
    try {
      await despertador(p); await ir(p, "Órdenes de Compra"); await p.waitForTimeout(800);
      await p.getByText(OC, { exact: true }).first().click(); await p.waitForTimeout(800);
      const nota = await p.evaluate(() => { const e = document.querySelector('[role="note"][aria-label*="asignar folio"]'); return e ? e.innerText.replace(/\s+/g, " ") : null; });
      const asignar = await p.getByRole("button", { name: /^Asignar folio$/ }).count(), pre = await p.getByRole("button", { name: /Pre-asignar folio/ }).count();
      ok("D1 la OC dice cuáles faltan, dónde y ofrece pasarlas", !!nota && /3 órdenes/.test(nota) && /Faltan 2/.test(nota) && /P-9902/.test(nota) && /GTO 1 Color/.test(nota) && /P-9903/.test(nota) && /Empaque/.test(nota) && /pasar las 2 a Salidas/i.test(nota),
        nota ? "«" + nota.slice(0, 220) + "»" : "NO dice nada (el botón de folio sólo desaparece)");
      ok("D2 sin «Asignar folio», con «Pre-asignar folio»", asignar === 0 && pre === 1, `«Asignar folio»: ${asignar}; «Pre-asignar folio»: ${pre}`);
      await p.screenshot({ path: path.join(OUT, "D-la-oc.png") });
    } catch (e) { ok("D (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }

  // ── E: desde el detalle de la orden ──
  if (corre("E")) { const { ctx, p, escritas } = await entrar();
    try {
      if (!(await aLaPlanta(p))) throw new Error("no se ve la OC de prueba en «En la planta»");
      await p.locator('[data-orden="PRUEBA-KP-3"]').getByRole("button", { name: "P-9903" }).click(); await p.waitForTimeout(800);
      await p.getByRole("button", { name: /Más acciones/ }).click(); await p.waitForTimeout(300);
      const menu = await p.getByRole("menu").innerText().catch(() => "");
      ok("E1 «Más» del detalle ofrece pasarla, con dónde sigue", /Ya está lista: pasar a Salidas/.test(menu) && /Empaque/.test(menu), "«" + menu.replace(/\s+/g, " ").slice(0, 200) + "»");
      await p.getByRole("menuitem", { name: /pasar a Salidas/ }).click(); await p.waitForTimeout(500);
      const dos = await p.evaluate(() => document.querySelectorAll('[role="dialog"]').length);
      await p.keyboard.press("Escape"); await p.waitForTimeout(400);
      const uno = await p.evaluate(() => document.querySelectorAll('[role="dialog"]').length);
      ok("E2 la pregunta sale encima del detalle; Esc la cierra y el detalle sigue", dos === 2 && uno === 1 && !escritas.some(e => e.m === "PATCH"), `diálogos: ${dos} con la pregunta, ${uno} después de Esc${escritas.some(e => e.m === "PATCH") ? "; y ESCRIBIÓ" : ""}`);
      await p.screenshot({ path: path.join(OUT, "E-detalle.png") });
    } catch (e) { ok("E (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
  // ── F (vuelta 3): otra persona la mueve con la pregunta abierta ──
  if (corre("F")) { const { ctx, p, escritas, cambiar } = await entrar();
    try {
      if (!(await aLaPlanta(p))) throw new Error("no se ve la OC de prueba en «En la planta»");
      await p.locator('[data-orden="PRUEBA-KP-3"]').getByRole("button", { name: /Pasar a Salidas/ }).click(); await p.waitForTimeout(400);
      const abierta = await p.evaluate(() => document.querySelectorAll('[role="dialog"]').length);
      cambiar("PRUEBA-KP-3", { stage: "salidas", current_machine: null });   // Gerardo la pasó desde el tablero
      await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));   // la app relee (como al volver a la pestaña)
      const a = await esperaAviso(p, /Mientras preguntaba/, 20), queda = await p.evaluate(() => document.querySelectorAll('[role="dialog"]').length);
      ok("F1 la pregunta se cierra sola, lo dice, y no escribe", abierta === 1 && queda === 0 && /P-9903/.test(a) && /Salidas/.test(a) && !escritas.some(e => e.m === "PATCH" || e.a === "rpc/move_order_in_queue"),
        `pregunta ${abierta ? "abierta" : "NO SE ABRIÓ"} → ${queda ? "SIGUE abierta" : "se cerró"}; aviso: «${a}»${escritas.some(e => e.m === "PATCH") ? "; y ESCRIBIÓ" : ""}`);
      await p.screenshot({ path: path.join(OUT, "F-se-vence.png") });
    } catch (e) { ok("F (se cayó)", false, e.message.split("\n")[0]); } finally { await ctx.close(); } }
} finally {
  await nav.close();
  if (servidor) await new Promise(r => servidor.httpServer.close(r));
}
for (const r of res) console.log(r);
console.log(falla ? "\nkarla-planta: algo salió MAL" : "\nkarla-planta: todo BIEN");
process.exit(falla ? 1 : 0);
