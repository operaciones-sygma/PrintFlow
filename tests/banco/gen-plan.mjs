// Banco del «Plan matriz» de una OC (OCSplitMatrixModal: N facturas × M órdenes, con porciones), su vista (OCMatrixPlanView) y la
// ventana de cancelar una factura o un renglón del plan (MatrixCancelConfirmModal), EXTRAÍDOS de un App.jsx con extraer.mjs y la base
// simulada. v10.84.89 (Karla, 13-oct: «que la OC funcione como facturar por partes: ya hay una factura, ligarla»): los datos son los de
// OC-0960 de PORTLAND LEATHER (P-0592 a P-0595, 80,000 stickers cada uno) y sus facturas hechas sin orden, F-143 y F-155, que cubren
// cada una un pedazo de los cuatro (según sus conceptos timbrados).
// Uso: node gen-plan.mjs <App.jsx> <dirSalida>
// Variantes por URL: emisor=off · ligables=vacio|falla|lento|colgado (las facturas sin orden del cliente) · anombre=1|falla (a nombre de quién salió cada factura, v10.84.108) · tercero=1 (con vista=1: F-157 a tercero) · conf=falla|candado (la base
//   rechaza el plan: la ventana se queda con lo capturado) · confirmar=no (los window.confirm de la ventana contestan «no») ·
//   vista=1 (la vista del plan ya creado, con una factura ligada y pagada y otra creada por el plan) · rol=karla (sin botones de
//   cancelar) · cancelar=ligada|normal|linea (abre la ventana de cancelar esa factura del plan, o un renglón de la ligada) ·
//   previo=todo (v10.84.98: un plan anterior de la OC ya cubre todas las piezas y el dinero de las cuatro órdenes) ·
//   foliada=1 (P-0595 ya tiene folio: sale del plan) · foliada=todas (las cuatro: ninguna entra) · ligables=muchas (7 sin orden) ·
//   planta=1 (v10.84.101: P-0595 todavía en Empaque) · planta=todas (las cuatro todavía en máquina) ·
//   conceptos=vacio|falla|falla1|tasa0|lento (v10.84.102: los conceptos timbrados de la factura que se liga) · producto=1 (v10.84.109) · hotsson=1 (v10.84.110: OC-0966 de producción) · redondeo=nuevas|ligadas|sinholgura|mixta (v10.84.111; mixta: sólo 5 sin orden)
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";   // (15-oct) las letras, del propio banco: ninguna página sale a Google Fonts
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo, simuladosUsados } = extraer(fuente, ["OCSplitMatrixModal", "OCMatrixPlanView", "MatrixCancelConfirmModal"], { simulados: ["supabase", "db", "BillToSection"] });
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),   // v10.84.91 — lo que App importa de ./lib/ (las categorías, cuadrarPartes)
  `// ── lo que toca la base, simulado (${simuladosUsados.join(", ")}) ──
const Q = new URLSearchParams(location.search);
const EMISOR = Q.get("emisor") !== "off", LIGABLES = Q.get("ligables") || "normal", CONF_FALLA = Q.get("conf") === "falla", CONF_CANDADO = Q.get("conf") === "candado";
const A_NOMBRE = Q.get("anombre") || "";
const HOTSSON = Q.get("hotsson") === "1";
const REDONDEO = Q.get("redondeo") || "";   // v10.84.111 — nuevas · ligadas · sinholgura: P-0999, 6 piezas por $100, una en cada factura   // v10.84.110 — OC-0966 de producción: P-0621 y P-0623 y las 11 facturas hechas el 13-oct   // v10.84.108 — a_nombre_de_quien: 1 (F-143 y F-155 a nombre de PORTLAND STUDIO) · falla
const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return Q.get("confirmar") !== "no"; };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
let lecturas = 0;
// las facturas sin orden del cliente, como las da list_linkable_invoices_for_oc (monto_cuadra: contra la OC ENTERA)
const LIGABLES_OK = [
  { doc_number: "F-143", doc_type: "factura", amount: 3066.78, balance: 3066.78, issued_date: "2026-10-06", status: "pendiente", cfdi_status: "stamped", dias_sin_orden: 7, monto_cuadra: false, total_oc: 46400 },
  { doc_number: "F-155", doc_type: "factura", amount: 43333.22, balance: 43333.22, issued_date: "2026-10-13", status: "pendiente", cfdi_status: "stamped", dias_sin_orden: 0, monto_cuadra: false, total_oc: 46400 },
  { doc_number: "RS-31", doc_type: "remision", amount: 1400, balance: 0, issued_date: "2026-10-01", status: "pagada", cfdi_status: "none", dias_sin_orden: 12, monto_cuadra: false, total_oc: 40000 },
];
// v10.84.102 — los conceptos timbrados (conceptos_para_ligar_en_oc), como los tiene la base
const CONCEPTOS = Q.get("conceptos") || "normal"; let lecturasConceptos = 0;
const cpt = (line_no, cantidad, valor_unitario, importe, descripcion, iva_rate = 0.16) => ({ line_no, cantidad, valor_unitario, importe, descuento: 0, iva_rate, objeto_imp: "02", descripcion });
const CONCEPTOS_DE = {
  "F-143": [cpt(1, 4380, 0.14, 613.2, "STK-NGO-PN04 STICKER REDONDO NEGRO DE PINOS 4 CM"), cpt(2, 7395, 0.14, 1035.3, "STK-NGO-PRL4 STICKER REDONDO NEGRO PORTLAND 4 CM"),
    cpt(3, 3528, 0.11, 388.08, "STK-NGO-PN03 STICKER REDONDO NEGRO DE PINOS 3 CM"), cpt(4, 5520, 0.11, 607.2, "STK-NGO-PRL3 STICKER REDONDO NEGRO PORTLAND 3 CM")],
  "F-155": [cpt(1, 75620, 0.14, 10586.8, "STK-NGO-PNO4 STICKER REDONDO NEGRO DE PINOS 4 CM"), cpt(2, 72605, 0.14, 10164.7, "STK-NGO-PRL4 STICKER REDONDO NEGRO PORTLAND 4 CM"),
    cpt(3, 76472, 0.11, 8411.92, "STK-NGO-PNO3-STICKER REDONDO NEGRO DE PINOS 3 CM"), cpt(4, 74480, 0.11, 8192.8, "STK-NGO-PRL3 STICKER REDONDO NEGRO PORTLAND 3 CM")],
};
// v10.84.110 — Hotsson (producción, 14-oct): las 11 facturas sin orden de OC-0966 y sus conceptos timbrados
const H = [["F-159", 20177.77, [110, 122.14, 13435.40, "HS HOTSSON HOTEL LEON LIBRETA /AGENDA"], [50, 79.1845, 3959.23, "HS HOTSSON HOTEL LEON  CALENDARIOS"]],
  ["F-160", 12175.01, [60, 122.14, 7328.40, "HS HOTSSON HOTEL SILAO LIBRETA/AGENDA"], [40, 79.1825, 3167.30, "HS HOTSSON HOTEL SILAO CALENDARIO"]],
  ["F-161", 9839.68, [50, 122.14, 6107.00, "CORPORATIVO APITALI GRUPO HOTELERO LIBRETA / AGENDA"], [30, 79.1825, 2375.48, "CORPORATIVO APITALI GRUPO HOTELERO CALENDARIO"]],
  ["F-162", 11256.55, [60, 122.142, 7328.52, "HS HOTSSON SMART LEON-CENTRO MAX LIBRETA / AGENDA"], [30, 79.18, 2375.40, "HS HOTSSON SMART LEON-CENTRO MAX CALENDARIO"]],
  ["F-163", 15790.47, [92, 122.1406, 11236.94, "HS HOTSSON ACAPULCO LIBRETA / AGENDA"], [30, 79.1845, 2375.54, "HS HOTSSON ACAPULCO CALENDARIO"]],
  ["F-164", 11676.62, [50, 122.14, 6107.00, "HS HOTSSON HOTEL TAMPICO Y SMART VALUE TAMPICO LIBRETA / AGE"], [50, 79.181, 3959.05, "HS HOTSSON HOTEL TAMPICO Y SMART VALUE TAMPICO CALENDARIO"]],
  ["F-165", 11676.62, [50, 122.14, 6107.00, "HS HOTSSON HOTEL QUERETARO LIBRETA / AGENDA"], [50, 79.181, 3959.05, "HS HOTSSON HOTEL QUERETARO CALENDARIO"]],
  ["F-166", 12673.39, [70, 122.142, 8549.94, "HS HOTSSON HOTEL IRAPUATO LIBRETA"], [30, 79.18, 2375.40, "HS HOTSSON HOTEL IRAPUATO CALENDARIO"]],
  ["F-167", 11676.62, [50, 122.14, 6107.00, "MORELIA MANSION SOLIS LIBRETA / AGENDA"], [50, 79.181, 3959.05, "MORELIA MANSION SOLIS  CALENDARIO"]],
  ["F-168", 11676.62, [50, 122.14, 6107.00, "LA ARBOLEDA LIBRETA / AGENDA"], [50, 79.181, 3959.05, "LA ARBOLEDA CALENDARIO"]],
  ["F-169", 3736.52, [16, 122.14125, 1954.26, "CORPORATIVO CAPITALI GRUPO HOTELERO LIBRETA / AGENDA"], [16, 79.18, 1266.88, "CORPORATIVO CAPITALI GRUPO HOTELERO CALENDARIO"]]];
const LIGABLES_H = H.map(([doc_number, amount]) => ({ doc_number, doc_type: "factura", amount, balance: amount, issued_date: "2026-10-13", status: "pendiente",
  cfdi_status: "stamped", dias_sin_orden: 1, monto_cuadra: false, total_oc: 114100 }));
for (const [fol, , ...ls] of H) CONCEPTOS_DE[fol] = ls.map(([cantidad, vu, importe, descripcion], k) => cpt(k + 1, cantidad, vu, importe, descripcion));
const db = {
  conceptosParaLigarEnOC: async (ocId, folio) => {
    lecturasConceptos++; anota("lee conceptos " + ocId + " " + folio + " #" + lecturasConceptos);
    if (CONCEPTOS === "lento") await new Promise(r => setTimeout(r, 1500));
    if (CONCEPTOS === "falla" || (CONCEPTOS === "falla1" && lecturasConceptos === 1)) throw new Error("timeout");
    if (CONCEPTOS === "vacio") return [];
    const filas = CONCEPTOS_DE[String(folio || "").trim().toUpperCase()] || [];
    return CONCEPTOS === "tasa0" ? filas.map((x, k) => k === 0 ? { ...x, iva_rate: 0 } : x) : filas;
  },
  // v10.84.108 — a nombre de quién salió cada factura (public.a_nombre_de_quien), por folio en mayúsculas
  aNombreDeQuien: async folios => {
    anota("lee a nombre de " + (folios || []).join(","));
    if (A_NOMBRE === "falla") throw new Error("timeout");
    if (A_NOMBRE !== "1") return {};
    const m = {};
    for (const f of (folios || [])) { const k = String(f || "").trim().toUpperCase(); if (k === "F-143" || k === "F-155") m[k] = { doc_number: k, doc_type: "factura", paga: "PORTLAND LEATHER", a_nombre_de: "PORTLAND STUDIO SA DE CV", a_nombre_de_rfc: "PST010101AAA" }; }
    return m;
  },
  getClientBillingInfo: async () => ({ billing_mode: "normal", current_balance: 0 }),
  getNextFolioSuggestion: async t => EMISOR ? (t === "factura" ? "F-157" : "RS-40") : (t === "factura" ? "D-5781" : "R-1903"),
  getFolioEmitterEnabled: async () => EMISOR,
  listLinkableInvoicesForOC: async ocId => {
    lecturas++; anota("lee ligables " + ocId + " #" + lecturas);
    if (LIGABLES === "colgado") return new Promise(() => {});
    if (LIGABLES === "lento") await new Promise(r => setTimeout(r, 2500));
    if (LIGABLES === "falla" && lecturas === 1) throw new Error("timeout");
    if (LIGABLES === "muchas") return [...LIGABLES_OK, ...[160, 161, 162, 163].map(n => ({ doc_number: "F-" + n, doc_type: "factura", amount: n * 10, balance: n * 10,
      issued_date: "2026-10-1" + (n - 160), status: "pendiente", cfdi_status: "stamped", dias_sin_orden: 1, monto_cuadra: false, total_oc: 46400 }))];   // v10.84.100 — 7 sin orden
    if (HOTSSON) return LIGABLES_H;
    if (REDONDEO === "ligadas" || REDONDEO === "sinholgura" || REDONDEO === "mixta") return (REDONDEO === "mixta" ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6]).map(k => ({ doc_number: "F-30" + k, doc_type: "factura",
      amount: REDONDEO === "sinholgura" ? 19.36 : 19.33, balance: 0, issued_date: "2026-10-14", status: "pendiente", cfdi_status: "stamped", dias_sin_orden: 0, monto_cuadra: false, total_oc: 100 }));
    if (REDONDEO) return [];
    return LIGABLES === "vacio" ? [] : LIGABLES_OK;
  },
};
function BillToSection({ onChange }) { return <div style={{ padding: 8, fontSize: 11 }}>Facturar a un tercero (simulado)
  <button id="tercero-listo" onClick={() => onChange({ client_id: "t1", name: "TERCERO SA", rfc: "TSA010101AAA" })}>tercero listo</button></div>; }
const supabase = {};`,
  codigo,
  `const OC = { id: "OC-0960", client: "PORTLAND LEATHER", client_id: "c1" };
const ORDERS = [
  { id: "OP-MUWX46YVCR4", production_number: "P-0592", product_type: "STICKER #4 REDONDO NEGRO DE PINOS", quantity: 80000, price: 11200, order_type: "interna", stage: "salidas", invoice_folio: null },
  { id: "OP-MUWX8IRJ7IA", production_number: "P-0593", product_type: "STICKER #3 REDONDO NEGRO DE PINOS", quantity: 80000, price: 8800, order_type: "interna", stage: "salidas", invoice_folio: null },
  { id: "OP-MUWXBE2VNZH", production_number: "P-0594", product_type: "STICKER #4 REDONDO NEGRO DE PORTLAND", quantity: 80000, price: 11200, order_type: "interna", stage: "salidas", invoice_folio: null },
  { id: "OP-MUWXDWG1WX6", production_number: "P-0595", product_type: "STICKER #3 REDONDO NEGRO DE PORTLAND", quantity: 80000, price: 8800, order_type: "interna", stage: "salidas", invoice_folio: null },
];
// v10.84.109 — producto=1: cada orden con un producto escrito que no comparte palabras con sus conceptos (como P-0621 de Hotsson, «AGENDAS 2027 …»,
//   con su tipo «LIBRETAS …»): la propuesta tiene que casar también por el tipo
if (Q.get("producto") === "1") for (const o of ORDERS) o.product = "ROLLO DE 1000";
if (Q.get("foliada") === "1") ORDERS[3].invoice_folio = "F-200";
if (Q.get("planta") === "1") ORDERS[3].stage = "packaging";
if (Q.get("planta") === "todas") ORDERS.forEach(o => { o.stage = "in_production"; o.current_machine = "off_pm74"; });
if (Q.get("foliada") === "todas") ORDERS.forEach((o, k) => { o.invoice_folio = "F-20" + k; });
if (Q.get("previo") === "todo") OC.matrix_plan = { groups: [{ id: "g0", cancelled_at: null,
  lines: ORDERS.map((o, k) => ({ id: "l0" + k, order_id: o.id, qty_portion: o.quantity, amount_portion: o.price, cancelled_at: null })) }] };
// la vista del plan ya creado: F-143 ligada (y pagada) y F-157 creada por el plan con lo demás de dos órdenes
const linea = (id, g, o, q, a) => ({ id, oc_invoice_split_group_id: g, order_id: o, qty_portion: q, amount_portion: a, cancelled_at: null });
const PLAN = { alive_count: 2, total_count: 2, groups: [
  { id: "g1", purchase_order_id: "OC-0960", position: 1, folio: "F-143", doc_type: "factura", total_amount: 2643.78, invoice_pre_assigned: false,
    payment_status: "paid", ligada: true, cancelled_at: null, lines: [linea("l1", "g1", ORDERS[0].id, 4380, 613.2), linea("l2", "g1", ORDERS[1].id, 3528, 388.08),
      linea("l3", "g1", ORDERS[2].id, 7395, 1035.3), linea("l4", "g1", ORDERS[3].id, 5520, 607.2)] },
  { id: "g2", purchase_order_id: "OC-0960", position: 2, folio: "F-157", doc_type: "factura", total_amount: 19000, invoice_pre_assigned: false,
    ...(Q.get("tercero") === "1" ? { bill_to_name: "TERCERO SA DE CV", bill_to_rfc: "TSA010101AAA" } : {}),   // v10.84.108 — «Facturar a un tercero»
    payment_status: "unpaid", ligada: false, cancelled_at: null, lines: [linea("l5", "g2", ORDERS[0].id, 75620, 10586.8), linea("l6", "g2", ORDERS[1].id, 76472, 8411.92)] },
] };
// v10.84.110 — hotsson=1: OC-0966 con sus dos órdenes como en producción (P-0621 en Empaque, P-0623 en máquina; precios que no dan centavos exactos)
if (HOTSSON) { Object.assign(OC, { id: "OC-0966", client: "INMOBILIARIA HOTSSON", client_id: "c3" });
  ORDERS.splice(0, ORDERS.length,
    { id: "OP-MV1NON22D08", production_number: "P-0621", product: "AGENDAS 2027 PORTADAS MEDIDA 18.5 X 23 PASTA DURA", product_type: "LIBRETAS ENGARGOLADAS PASTA DURA", quantity: 658, price: 80370, order_type: "interna", stage: "packaging", invoice_folio: null },
    { id: "OP-MV1NXBC9N49", production_number: "P-0623", product: "CALENDARIOS 2027 BASE MEDIDA EXT. 41 X 21", product_type: "CALENDARIOS DE ESCRITORIO", quantity: 426, price: 33730, order_type: "interna", stage: "in_production", current_machine: "manual_2", invoice_folio: null }); }
// v10.84.111 — redondeo=…: una OC de una sola orden de 6 piezas por $100 (la pieza a $16.666…), en Salidas
if (REDONDEO) { Object.assign(OC, { id: "OC-0999", client: "CLIENTE REDONDEO", client_id: "c9" });
  ORDERS.splice(0, ORDERS.length, { id: "OP-REDONDEO1", production_number: "P-0999", product_type: "LONA IMPRESA", quantity: 6, price: 100, order_type: "interna", stage: "salidas", invoice_folio: null }); }
function Banco() {
  const [abierto, setAbierto] = useState(false);
  const [cancelar, setCancelar] = useState(null);
  const rol = Q.get("rol") || "admin";
  useEffect(() => {
    const c = Q.get("cancelar");
    if (c === "ligada") setCancelar({ kind: "group", group: PLAN.groups[0] });
    if (c === "normal") setCancelar({ kind: "group", group: PLAN.groups[1] });
    if (c === "linea") setCancelar({ kind: "line", group: PLAN.groups[0], line: PLAN.groups[0].lines[0], order: ORDERS[0] });
  }, []);
  return <div style={{ padding: 20, fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    <button id="abrir-plan" onClick={() => setAbierto(true)}>abrir plan matriz</button>
    <pre id="log"></pre>
    {Q.get("vista") === "1" && <OCMatrixPlanView matrixPlan={PLAN} ocOrders={ORDERS} role={rol}
      onCancelLine={(l, g, o) => { anota("cancelar-linea " + l.id); setCancelar({ kind: "line", group: g, line: l, order: o }); }}
      onCancelGroup={g => { anota("cancelar-factura " + g.id); setCancelar({ kind: "group", group: g }); }} busy={false}/>}
    {abierto && <OCSplitMatrixModal oc={OC} ocOrders={ORDERS} user="karla" userLogin="karla"
      onConfirm={async plan => { anota("plan:confirm " + JSON.stringify(plan)); await new Promise(r => setTimeout(r, 150));
        if (CONF_FALLA) { anota("rechazo"); throw new Error("Grupo 1: F-143 ya está ligada a OP-OTRA: no se re-liga"); }
    // v10.84.104 — el candado del anticipo de la base, con su texto de verdad (migración v10.84.89, renglón 140)
    if (CONF_CANDADO) { anota("rechazo"); throw new Error("Grupo 1: este cliente ya tiene F-143 hecha sin orden, por $3066.78, que es justo el importe de esta factura del plan. Márcala «Ya tiene factura: ligarla» en vez de emitir un folio nuevo, o se le cobraría dos veces el mismo trabajo."); }   // (v10.84.100: App lanza; antes avisaba abajo)
        setAbierto(false); return { groups_count: plan.groups.length, linked_folios: plan.groups.filter(g => g.ligar).map(g => g.folio) }; }}
      onClose={() => { anota("cerrado"); setAbierto(false); }}/>}
    {cancelar && <MatrixCancelConfirmModal kind={cancelar.kind} line={cancelar.line} group={cancelar.group} order={cancelar.order} oc={OC} orders={ORDERS}
      onConfirm={async r => { anota("cancelar:confirm " + r); setCancelar(null); }} onClose={() => { anota("cancelar:cerrado"); setCancelar(null); }}/>}
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco plan matriz</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5190), strictPort: true } });
`, "utf8");
console.log("banco del plan matriz listo en " + outDir);
