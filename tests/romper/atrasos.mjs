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
const QUIERO = ["vencidaAhora", "esperaAlCliente", "entregadaATiempo", "getIncompleteData"];
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
caso("atr-13-lista-a-tiempo-sin-la-espera-cuenta-tarde", () => {
  const o = entregada("2026-10-15T12:00:00-06:00", [lista("2026-10-11T10:00:00-06:00")]);
  ok("atr-13-lista-a-tiempo-sin-la-espera-cuenta-tarde", aTiempo(o) === false, `lista el 11 pero sin la espera de la factura, entregada el 15: a tiempo ${aTiempo(o)} (no se sabe que fuera el cliente)`);
});
caso("atr-14-la-espera-escrita-a-mano-tambien", () => {
  const con = t => aTiempo(entregada("2026-10-15T12:00:00-06:00", [lista("2026-10-11T10:00:00-06:00"), pausa("2026-10-12T09:00:00-06:00", t)]));
  const r = { torre: con("🔕 En espera (Torre): todavia no pide factura el cliente · hasta que cambie de etapa"), kfc: con("🔕 En espera (Torre): KFC, todavia no piden factura · hasta que cambie de etapa"),
    otra: con("🔕 En espera (Torre): Esperando a que Genaro diga si es remision o factura · hasta que cambie de etapa"), material: con("🔕 En espera: Esperando material o insumo para continuar · hasta que cambie de etapa") };
  ok("atr-14-la-espera-escrita-a-mano-tambien", r.torre && r.kfc && !r.otra && !r.material, `las pausas escritas a mano: ${JSON.stringify(r)} (las dos de «no pide factura» sí; la de remisión o factura y la de material, no)`);
});
caso("atr-15-la-espera-puesta-despues-de-entregar-no-cuenta", () => {
  const o = entregada("2026-10-15T12:00:00-06:00", [lista("2026-10-11T10:00:00-06:00"), pausa("2026-10-15T13:00:00-06:00")]);
  ok("atr-15-la-espera-puesta-despues-de-entregar-no-cuenta", aTiempo(o) === false, `la pausa quedó registrada después de entregarla: a tiempo ${aTiempo(o)}`);
});
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

for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\natrasos: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
