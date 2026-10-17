// Tratar de ROMPER la regla de lo ATRASADO (v10.84.140). Marcelo, 16-oct: «las órdenes que llegan al día de entrega y no se marcan como entregadas
// porque el cliente no ha pedido facturas o remisión no deberían contar como entrega atrasada: da números falsos en reportes y aparece roja en el
// calendario» (las ponen «En espera» con esa razón). Aquí «entregada» se marca al foliar: la orden lista se queda en Salidas (o recibida de maquila)
// mientras el cliente no pide su factura. Sin navegador: la regla sale VIVA de App.jsx con extraer.mjs (vencidaAhora, esperaAlCliente, entregadaATiempo
// y getIncompleteData), con el reloj fijo en el viernes 16-oct-2026 a mediodía de México. Vuelta 1: escritas antes del arreglo (contra el código de
// antes, la regla no existe y sus casos fallan sin tronar la tanda).
// Uso: node tests/romper/atrasos.mjs   ·   SOLO=<regex> corre sólo los casos que coinciden
process.env.TZ = "America/Mexico_City";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extraer } from "../banco/extraer.mjs";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const res = [];
const ok = (n, c, x = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + String(x).replace(/\s+/g, " ").slice(0, 260) : "")); };
// el reloj: viernes 16-oct-2026, 12:00 de México (lo que la regla llame «hoy»)
const AHORA = new Date("2026-10-16T12:00:00-06:00").getTime();
const D0 = Date;
globalThis.Date = class extends D0 { constructor(...a) { if (a.length) super(...a); else super(AHORA); } static now() { return AHORA; } };
const QUIERO = ["vencidaAhora", "esperaAlCliente", "entregadaATiempo", "getIncompleteData", "diagnoseOrder", "getWakeupItems"];
const { codigo } = extraer(fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8"), QUIERO, { simulados: ["supabase"] });
const tmp = path.join(os.tmpdir(), "pf-atrasos-" + process.pid + ".mjs");
fs.writeFileSync(tmp, [...new Set(codigo.match(/\b[A-Z][A-Za-z0-9]*Icon\b/g) || [])].map(i => `const ${i} = () => null;`).join("\n")
  + "\nconst supabase = {};\n" + codigo + "\nexport const F = {" + QUIERO.map(n => `${n}: typeof ${n} === "undefined" ? null : ${n}`).join(", ") + "};\n");
const { F } = await import(pathToFileURL(tmp).href);
fs.rmSync(tmp, { force: true });
const sinRegla = !F.vencidaAhora || !F.entregadaATiempo;
const caso = (n, fn) => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; try { fn(); } catch (e) { ok(n + " (la prueba se cayó)", false, sinRegla ? "la regla no existe en este App.jsx (vuelta 1)" : e.message); } };

// ── las órdenes ──
const T = s => new D0(s).toISOString();
const ESPERA = { snooze_reason: "El cliente aún no ha pedido factura/remisión", snooze_kind: "awaiting_client_invoice", snoozed_by: "karla", snooze_until: null };
const orden = (x = {}) => ({ id: "OP-P-0901", production_number: "P-0901", client: "KFC", stage: "salidas", order_type: "interna", due_date: "2026-10-12", timeline: [], ...x });
const enEspera = (x = {}) => orden({ ...ESPERA, snooze_stage: x.stage || "salidas", ...x });
const lista = (fecha, etapa = "salidas") => ({ to: etapa, date: T(fecha), action: "→ " + etapa });
const pausa = (fecha, texto = "🧾 En espera: el cliente no ha pedido factura") => ({ date: T(fecha), action: texto });
const entregada = (cuando, timeline, x = {}) => orden({ stage: "delivered", delivered_at: T(cuando), due_date: "2026-10-12", timeline, ...x });
const venc = o => F.vencidaAhora(o), aTiempo = o => F.entregadaATiempo(o);

// ── lo de HOY (el calendario, «Con retraso hoy», «Vencidas», las fichas) ──
caso("atr-01-la-lista-que-espera-la-factura-no-esta-vencida", () => {
  const o = enEspera({ timeline: [lista("2026-10-11T10:00:00-06:00")] });
  ok("atr-01-la-lista-que-espera-la-factura-no-esta-vencida", venc(o) === false && F.esperaAlCliente(o) === true, `en Salidas, «En espera: el cliente no ha pedido factura», vencía el 12: vencida ${venc(o)}`);
});
caso("atr-02-en-salidas-sin-la-espera-si-esta-vencida", () => {
  const o = orden();
  ok("atr-02-en-salidas-sin-la-espera-si-esta-vencida", venc(o) === true, `en Salidas sin la espera (falta foliar y entregar), vencía el 12: vencida ${venc(o)}`);
});
caso("atr-03-la-maquila-recibida-que-espera-tampoco", () => {
  const o = enEspera({ stage: "maq_received", order_type: "maquila" });
  ok("atr-03-la-maquila-recibida-que-espera-tampoco", venc(o) === false, `recibida de maquila y en espera de la factura: vencida ${venc(o)}`);
});
caso("atr-04-si-no-esta-lista-la-espera-no-la-salva", () => {
  const o = enEspera({ stage: "in_production" });
  ok("atr-04-si-no-esta-lista-la-espera-no-la-salva", venc(o) === true, `en máquina con la pausa de la factura (no está lista): vencida ${venc(o)}`);
});
caso("atr-05-la-espera-de-otra-etapa-ya-no-cuenta", () => {
  const o = enEspera({ snooze_stage: "packaging" });
  ok("atr-05-la-espera-de-otra-etapa-ya-no-cuenta", venc(o) === true, `la pausa se puso en Empaque y ya está en Salidas (la pausa vence al cambiar de etapa): vencida ${venc(o)}`);
});
caso("atr-06-otra-espera-no-para-el-reloj", () => {
  const o = orden({ snooze_reason: "Esperando material", snooze_kind: "material", snooze_stage: "salidas", snooze_until: null });
  ok("atr-06-otra-espera-no-para-el-reloj", venc(o) === true, `en Salidas con otra pausa (material): vencida ${venc(o)}`);
});
caso("atr-07-entregada-cancelada-sin-fecha-o-fecha-rota", () => {
  const r = [venc(orden({ stage: "delivered" })), venc(orden({ stage: "cancelled" })), venc(orden({ cancelled_at: T("2026-10-13T10:00:00-06:00") })), venc(orden({ due_date: null })), venc(orden({ due_date: "0026-06-01" }))];
  ok("atr-07-entregada-cancelada-sin-fecha-o-fecha-rota", r.every(x => x === false), `entregada, cancelada, con fecha de cancelación, sin fecha, fecha imposible: ${JSON.stringify(r)} (todas deben ser false)`);
});
caso("atr-08-la-de-hoy-vence-a-medianoche", () => {
  const o = orden({ due_date: "2026-10-16" });
  ok("atr-08-la-de-hoy-vence-a-medianoche", venc(o) === false, `vence hoy (16) y son las 12:00: vencida ${venc(o)}`);
});
caso("atr-09-datos-pendientes-vencidas-sin-las-que-esperan", () => {
  const ordenes = [enEspera({ id: "a", production_number: "P-0901" }), orden({ id: "b", production_number: "P-0902", stage: "in_production" }), orden({ id: "c", production_number: "P-0903" })];
  const v = F.getIncompleteData(ordenes).vencidas.map(o => o.production_number);
  ok("atr-09-datos-pendientes-vencidas-sin-las-que-esperan", JSON.stringify(v) === '["P-0902","P-0903"]', `«Vencidas» de Datos Pendientes: ${JSON.stringify(v)} (sin P-0901, que espera la factura del cliente)`);
});

// ── los reportes («Entregas a tiempo» de Analytics) ──
caso("atr-10-entregada-el-dia-de-su-fecha-a-tiempo", () => {
  ok("atr-10-entregada-el-dia-de-su-fecha-a-tiempo", aTiempo(entregada("2026-10-12T18:00:00-06:00", [])) === true, "entregada el 12 a las 18:00, vencía el 12");
});
caso("atr-11-lista-a-tiempo-y-espero-la-factura-a-tiempo", () => {
  const o = entregada("2026-10-15T12:00:00-06:00", [lista("2026-10-11T10:00:00-06:00"), pausa("2026-10-12T09:00:00-06:00")]);
  ok("atr-11-lista-a-tiempo-y-espero-la-factura-a-tiempo", aTiempo(o) === true, `lista el 11, «el cliente no ha pedido factura» el 12, foliada y entregada el 15 (vencía el 12): a tiempo ${aTiempo(o)}`);
});
caso("atr-12-lista-tarde-cuenta-tarde-aunque-esperara", () => {
  const o = entregada("2026-10-15T12:00:00-06:00", [lista("2026-10-13T10:00:00-06:00"), pausa("2026-10-13T11:00:00-06:00")]);
  ok("atr-12-lista-tarde-cuenta-tarde-aunque-esperara", aTiempo(o) === false, `lista el 13 (un día tarde) y luego esperó la factura: a tiempo ${aTiempo(o)} (lo de la planta sí fue tarde)`);
});
// (atr-13, atr-14 y atr-15 afirmaban la regla de antes: la lista a tiempo SIN la pausa de la factura contaba tarde, y la pausa se leía de la bitácora.
//  Se fueron con la decisión de Marcelo del 17-oct, «sí, cuentan como a tiempo»: atr-20 y atr-21.)
caso("atr-16-lista-a-las-2330-del-dia-si-a-las-0030-del-siguiente-no", () => {
  const de = h => aTiempo(entregada("2026-10-15T12:00:00-06:00", [lista(h), pausa("2026-10-13T09:00:00-06:00")]));
  const r = [de("2026-10-12T23:30:00-06:00"), de("2026-10-13T00:30:00-06:00")];
  ok("atr-16-lista-a-las-2330-del-dia-si-a-las-0030-del-siguiente-no", r[0] === true && r[1] === false, `lista el 12 a las 23:30: ${r[0]} (a tiempo); el 13 a las 00:30: ${r[1]} (tarde)`);
});
caso("atr-17-si-regreso-a-produccion-cuenta-la-ultima-vez-que-quedo-lista", () => {
  const o = entregada("2026-10-16T10:00:00-06:00", [lista("2026-10-10T10:00:00-06:00"), { to: "in_production", date: T("2026-10-11T09:00:00-06:00"), action: "→ in_production" },
    lista("2026-10-14T10:00:00-06:00"), pausa("2026-10-14T11:00:00-06:00")]);
  ok("atr-17-si-regreso-a-produccion-cuenta-la-ultima-vez-que-quedo-lista", aTiempo(o) === false, `lista el 10, regresó a máquina el 11, lista otra vez el 14 (vencía el 12): a tiempo ${aTiempo(o)}`);
});
caso("atr-18-sin-bitacora-como-antes", () => {
  const o = entregada("2026-10-15T12:00:00-06:00", []);
  ok("atr-18-sin-bitacora-como-antes", aTiempo(o) === false, `sin su bitácora (el archivo sin cargar), entregada el 15: a tiempo ${aTiempo(o)} (como antes: por el día que se marcó)`);
});
caso("atr-19-la-maquila-recibida-a-tiempo-que-espero", () => {
  const o = entregada("2026-10-15T12:00:00-06:00", [lista("2026-10-12T09:00:00-06:00", "maq_received"), pausa("2026-10-12T10:00:00-06:00")], { stage: "maq_delivered", order_type: "maquila" });
  ok("atr-19-la-maquila-recibida-a-tiempo-que-espero", aTiempo(o) === true, `maquila recibida el 12, esperó la factura, entregada el 15: a tiempo ${aTiempo(o)}`);
});

// ── v10.84.149 (Marcelo, 17-oct, sobre las 45 entregas listas a tiempo y marcadas entregadas unos 4.6 días después SIN la pausa: «sí, cuentan como a
//   tiempo»). A tiempo es haber quedado LISTA a tiempo (llegó a Salidas o regresó de maquila a más tardar el día de su entrega), con o sin la pausa: aquí
//   «entregada» se marca al foliar. Y lo de hoy dice lo mismo que el reporte: la que quedó lista a tiempo y sigue en Salidas (o recibida de maquila) no es
//   «vencida», ni en la Torre. Vuelta 1: escritas antes del arreglo, contra v10.84.148 ──
caso("atr-20-lista-a-tiempo-sin-la-espera-cuenta-a-tiempo", () => {
  const o = entregada("2026-10-15T12:00:00-06:00", [lista("2026-10-11T10:00:00-06:00")]);
  ok("atr-20-lista-a-tiempo-sin-la-espera-cuenta-a-tiempo", aTiempo(o) === true, `lista el 11 sin la pausa, foliada y entregada el 15 (vencía el 12): a tiempo ${aTiempo(o)}`);
});
caso("atr-21-la-pausa-ya-no-cambia-la-cuenta", () => {
  const con = (cuando, tl) => aTiempo(entregada("2026-10-15T12:00:00-06:00", [lista(cuando), ...tl]));
  const a = "2026-10-11T10:00:00-06:00", tarde = "2026-10-13T10:00:00-06:00";
  const r = { sin: con(a, []), factura: con(a, [pausa("2026-10-12T09:00:00-06:00")]), material: con(a, [pausa("2026-10-12T09:00:00-06:00", "🔕 En espera: Esperando material o insumo para continuar · hasta que cambie de etapa")]),
    despues: con(a, [pausa("2026-10-15T13:00:00-06:00")]), tardeSin: con(tarde, []), tardeConFactura: con(tarde, [pausa("2026-10-13T11:00:00-06:00")]) };
  ok("atr-21-la-pausa-ya-no-cambia-la-cuenta", r.sin && r.factura && r.material && r.despues && !r.tardeSin && !r.tardeConFactura,
    `lista el 11: sin pausa ${r.sin}, con la de la factura ${r.factura}, con la de material ${r.material}, con la pausa puesta después de entregar ${r.despues} (todas a tiempo); lista el 13 (tarde): sin pausa ${r.tardeSin}, con la de la factura ${r.tardeConFactura} (las dos tarde)`);
});
caso("atr-22-lista-a-tiempo-en-salidas-no-esta-vencida", () => {
  const o = orden({ timeline: [lista("2026-10-11T10:00:00-06:00")] });
  ok("atr-22-lista-a-tiempo-en-salidas-no-esta-vencida", venc(o) === false, `en Salidas desde el 11 sin la pausa, vencía el 12 (hoy es 16): vencida ${venc(o)} (quedó lista a tiempo: lo que falta es foliar y entregar)`);
});
caso("atr-23-lista-tarde-en-salidas-si-esta-vencida", () => {
  const o = orden({ timeline: [lista("2026-10-13T10:00:00-06:00")] });
  ok("atr-23-lista-tarde-en-salidas-si-esta-vencida", venc(o) === true, `llegó a Salidas el 13, vencía el 12: vencida ${venc(o)} (la planta sí llegó tarde)`);
});
caso("atr-24-la-maquila-recibida-a-tiempo-sin-la-espera-no-esta-vencida", () => {
  const o = orden({ stage: "maq_received", order_type: "maquila", timeline: [lista("2026-10-12T09:00:00-06:00", "maq_received")] });
  ok("atr-24-la-maquila-recibida-a-tiempo-sin-la-espera-no-esta-vencida", venc(o) === false, `recibida de maquila el 12, vencía el 12, sin la pausa: vencida ${venc(o)}`);
});
caso("atr-25-lista-a-tiempo-pero-regreso-a-produccion-si-esta-vencida", () => {
  const o = orden({ stage: "in_production", timeline: [lista("2026-10-11T10:00:00-06:00"), { to: "in_production", date: T("2026-10-13T09:00:00-06:00"), action: "→ in_production" }] });
  ok("atr-25-lista-a-tiempo-pero-regreso-a-produccion-si-esta-vencida", venc(o) === true, `llegó a Salidas el 11 y el 13 regresó a máquina (ya no está lista), vencía el 12: vencida ${venc(o)}`);
});
caso("atr-26-lista-a-las-2330-del-dia-no-vencida-a-las-0030-si", () => {
  const de = h => venc(orden({ timeline: [lista(h)] }));
  const r = [de("2026-10-12T23:30:00-06:00"), de("2026-10-13T00:30:00-06:00")];
  ok("atr-26-lista-a-las-2330-del-dia-no-vencida-a-las-0030-si", r[0] === false && r[1] === true, `en Salidas desde el 12 a las 23:30: vencida ${r[0]} (no); desde el 13 a las 00:30: vencida ${r[1]} (sí)`);
});
caso("atr-27-datos-pendientes-vencidas-sin-la-lista-a-tiempo", () => {
  const ordenes = [orden({ id: "a", production_number: "P-0901", timeline: [lista("2026-10-11T10:00:00-06:00")] }), orden({ id: "b", production_number: "P-0902", stage: "in_production" }),
    orden({ id: "c", production_number: "P-0903", timeline: [lista("2026-10-13T10:00:00-06:00")] })];
  const v = F.getIncompleteData(ordenes).vencidas.map(o => o.production_number);
  ok("atr-27-datos-pendientes-vencidas-sin-la-lista-a-tiempo", JSON.stringify(v) === '["P-0902","P-0903"]', `«Vencidas» de Datos Pendientes: ${JSON.stringify(v)} (sin P-0901, lista a tiempo; con P-0903, lista tarde)`);
});
// (con un folio anticipado, para que la Torre no se quede en «Sin folio de factura»: así se ve qué dice de lo atrasado)
caso("atr-28-la-torre-no-dice-vencida-a-la-lista-a-tiempo", () => {
  const d = F.diagnoseOrder(orden({ invoice_folio: "F-300", timeline: [lista("2026-10-11T10:00:00-06:00")] }));
  ok("atr-28-la-torre-no-dice-vencida-a-la-lista-a-tiempo", !d || d.key !== "late", `en Salidas desde el 11 con su folio anticipado, vencía el 12: la Torre dice «${d ? d.text : "nada"}» (no «Vencida»)`);
});
caso("atr-29-la-torre-si-dice-vencida-a-la-lista-tarde", () => {
  const d = F.diagnoseOrder(orden({ invoice_folio: "F-301", timeline: [lista("2026-10-14T10:00:00-06:00")] }));
  ok("atr-29-la-torre-si-dice-vencida-a-la-lista-tarde", !!d && d.key === "late", `en Salidas desde el 14 con su folio anticipado, vencía el 12: la Torre dice «${d ? d.text : "nada"}» (debe: «Vencida»)`);
});

// ── vuelta 2 (v10.84.149): el Despertador. Lupita persigue lo VENCIDO de Manuel (no tiene usuario: «tú llevas lo de Manuel»); lo medía con la fecha sola, así
//   que la de Manuel lista a tiempo en Salidas, que sólo espera su folio (de Karla), le salía a ella cada mañana. El 17-oct, 20 de las 21 listas que esperan
//   al cliente eran de Manuel ──
const delDespertador = (rol, ordenes) => F.getWakeupItems(rol, rol, ordenes).map(x => x.o.production_number + ": " + x.why + " → " + x.action);
caso("atr-30-lupita-no-persigue-la-de-manuel-lista-a-tiempo", () => {
  const r = delDespertador("secretaria", [orden({ agent: "Manuel", timeline: [lista("2026-10-11T10:00:00-06:00")] })]);
  ok("atr-30-lupita-no-persigue-la-de-manuel-lista-a-tiempo", r.length === 0, `la de Manuel en Salidas desde el 11 (vencía el 12), sin folio: el Despertador de Lupita trae ${JSON.stringify(r)} (nada: no está vencida y el folio es de Karla)`);
});
caso("atr-31-lupita-si-persigue-la-de-manuel-vencida", () => {
  const r = delDespertador("secretaria", [orden({ agent: "Manuel", stage: "in_production", timeline: [{ to: "in_production", date: T("2026-10-15T09:00:00-06:00"), action: "→ in_production" }] })]);
  ok("atr-31-lupita-si-persigue-la-de-manuel-vencida", r.length === 1 && /Manuel/.test(r[0]), `la de Manuel en máquina, vencía el 12: el Despertador de Lupita trae ${JSON.stringify(r)} (debe traerla: «tú llevas lo de Manuel»)`);
});
caso("atr-32-karla-si-ve-el-folio-de-la-lista-a-tiempo", () => {
  const r = delDespertador("karla", [orden({ agent: "Manuel", timeline: [lista("2026-10-11T10:00:00-06:00")] })]);
  ok("atr-32-karla-si-ve-el-folio-de-la-lista-a-tiempo", r.length === 1 && /folio/i.test(r[0]) && !/Vencida/.test(r[0]), `la misma, para Karla: ${JSON.stringify(r)} (debe: «Sin folio de factura», sin «Vencida»)`);
});

// ── vuelta 3 (v10.84.149): la que va y viene. Cuenta la ÚLTIMA vez que llegó a Salidas (si regresó a máquina, lo primero no estaba listo) ──
const vaYViene = regreso => orden({ timeline: [lista("2026-10-10T10:00:00-06:00"), { to: "in_production", date: T("2026-10-10T15:00:00-06:00"), action: "→ in_production" }, lista(regreso)] });
caso("atr-33-regreso-a-maquina-y-volvio-tarde-esta-vencida", () => {
  const o = vaYViene("2026-10-14T10:00:00-06:00");
  ok("atr-33-regreso-a-maquina-y-volvio-tarde-esta-vencida", venc(o) === true, `en Salidas el 10, a máquina el 10 en la tarde, otra vez en Salidas el 14 (vencía el 12): vencida ${venc(o)}`);
});
caso("atr-34-regreso-a-maquina-y-volvio-a-tiempo-no-esta-vencida", () => {
  const o = vaYViene("2026-10-12T18:00:00-06:00");
  ok("atr-34-regreso-a-maquina-y-volvio-a-tiempo-no-esta-vencida", venc(o) === false, `en Salidas el 10, a máquina el 10 en la tarde, otra vez en Salidas el 12 a las 18:00 (vencía el 12): vencida ${venc(o)}`);
});

for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\natrasos: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
