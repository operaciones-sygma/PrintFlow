// Banco del «Plan matriz» de una OC (OCSplitMatrixModal: N facturas × M órdenes, con porciones), su vista (OCMatrixPlanView) y la
// ventana de cancelar una factura o un renglón del plan (MatrixCancelConfirmModal), EXTRAÍDOS de un App.jsx con extraer.mjs y la base
// simulada. v10.84.89 (Karla, 13-oct: «que la OC funcione como facturar por partes: ya hay una factura, ligarla»): los datos son los de
// OC-0960 de PORTLAND LEATHER (P-0592 a P-0595, 80,000 stickers cada uno) y sus facturas hechas sin orden, F-143 y F-155, que cubren
// cada una un pedazo de los cuatro (según sus conceptos timbrados).
// Uso: node gen-plan.mjs <App.jsx> <dirSalida>
// Variantes por URL: emisor=off · ligables=vacio|falla|lento|colgado (las facturas sin orden del cliente) · conf=falla (la base
//   rechaza el plan: la ventana se queda con lo capturado) · confirmar=no (los window.confirm de la ventana contestan «no») ·
//   vista=1 (la vista del plan ya creado, con una factura ligada y pagada y otra creada por el plan) · rol=karla (sin botones de
//   cancelar) · cancelar=ligada|normal|linea (abre la ventana de cancelar esa factura del plan, o un renglón de la ligada) ·
//   previo=todo (v10.84.98: un plan anterior de la OC ya cubre todas las piezas y el dinero de las cuatro órdenes) ·
//   foliada=1 (P-0595 ya tiene folio: sale del plan) · foliada=todas (las cuatro: ninguna entra) · ligables=muchas (7 sin orden) ·
//   planta=1 (v10.84.101: P-0595 todavía en Empaque) · planta=todas (las cuatro todavía en máquina)
import fs from "node:fs";
import path from "node:path";
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
const EMISOR = Q.get("emisor") !== "off", LIGABLES = Q.get("ligables") || "normal", CONF_FALLA = Q.get("conf") === "falla";
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
const db = {
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
    payment_status: "unpaid", ligada: false, cancelled_at: null, lines: [linea("l5", "g2", ORDERS[0].id, 75620, 10586.8), linea("l6", "g2", ORDERS[1].id, 76472, 8411.92)] },
] };
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
        if (CONF_FALLA) { anota("rechazo"); throw new Error("Grupo 1: F-143 ya está ligada a OP-OTRA: no se re-liga"); }   // (v10.84.100: App lanza; antes avisaba abajo)
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
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco plan matriz</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5190), strictPort: true } });
`, "utf8");
console.log("banco del plan matriz listo en " + outDir);
