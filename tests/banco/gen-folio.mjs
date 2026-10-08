// Banco de «Asignar folio»: InvoiceModal, PreInvoiceModal y MultiPaymentPicker EXTRAÍDOS de un App.jsx, con sus dependencias
// reales (tokens, estilos, escStack, atraparTab, ConfirmModal, OTRO_CATS, refComplete, toBackendRef) y la base simulada.
// BillToSection y StageLbl van simulados (arrastran el buscador de clientes y el mapa de etapas; aquí no se cambiaron).
// Uso: node gen-banco-folio.mjs <App.jsx> <dirSalida>
// Variantes por URL: emisor=off|falla|falla1 (falla una vez y luego sí) · cliente=corona|cuadra|saldo · precio0=1 · maquila=1 ·
//   incompleto=1 (a la orden le falta el tipo de producto) · lenta=1 (el cliente tarda 10 s, más que el tope de 8) · falla=1 (la base rechaza)
import fs from "node:fs";
import path from "node:path";
const [, , srcPath, outDir] = process.argv;
const L = fs.readFileSync(srcPath, "utf8").replace(/\r\n/g, "\n").split("\n");
const find = (pred, desc) => { const i = L.findIndex(pred); if (i < 0) throw new Error("no encuentro " + desc); return i; };
const line = (re, desc) => L[find(l => re.test(l), desc)];
const fnBlock = name => { const s = find(l => l.startsWith("function " + name + "("), name); let e = s; while (L[++e] !== "}") { if (e > s + 2000) throw new Error("sin cierre " + name); } return L.slice(s, e + 1).join("\n"); };
const constBlock = name => { const s = find(l => l.startsWith("const " + name + " ") || l.startsWith("const " + name + "="), name); if (/[;\]]\s*$/.test(L[s]) && !/\[\s*$/.test(L[s])) return L[s]; let e = s; while (!/^\];?\s*$/.test(L[++e])) { if (e > s + 200) throw new Error("sin cierre " + name); } return L.slice(s, e + 1).join("\n"); };
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  line(/^import \{ Broadcast as BroadcastIcon/, "íconos"),
  line(/^const C=\{/, "C"), line(/^const F=\{/, "F"),
  line(/^const inp=/, "inp"), line(/^const lbl=/, "lbl"), line(/^const bt=/, "bt"), line(/^const bs=/, "bs"),
  line(/^const fmt=/, "fmt"),
  line(/^const escStack=/, "escStack"), line(/^if\(typeof document!=="undefined"&&!escStack\._bound\)/, "escStack bind"),
  fnBlock("useEscClose"),
  ...(L.some(l => l.startsWith("const FOCOS_DIALOGO=")) ? [line(/^const FOCOS_DIALOGO=/, "FOCOS_DIALOGO"), fnBlock("atraparTab")] : []),
  constBlock("OTRO_CATS"), fnBlock("toBackendRef"), fnBlock("refComplete"),
  line(/^const lumHex=/, "lumHex"), line(/^const tintaAA=/, "tintaAA"), line(/^const escudoDeClics=/, "escudoDeClics"),
  // (v10.84.70) lo nuevo del selector de pagos y de «Asignar folio» (opcional: el App.jsx de antes no lo tiene, y el banco corre con los dos)
  ...(L.some(l => l.startsWith("const METODO_PALABRA=")) ? [line(/^const METODO_PALABRA=/, "METODO_PALABRA"), line(/^const montoLimpio=/, "montoLimpio"), line(/^const faltaDelPago=/, "faltaDelPago")] : []),
  ...(L.some(l => l.startsWith("function useAnchoMinimo(")) ? [fnBlock("useAnchoMinimo")] : []),
  `const Q = new URLSearchParams(location.search);
const EMISOR = Q.get("emisor") || "on", CLIENTE = Q.get("cliente") || "normal";
const PRECIO0 = Q.get("precio0") === "1", MAQUILA = Q.get("maquila") === "1", INCOMPLETO = Q.get("incompleto") === "1";
const LENTA = Q.get("lenta") === "1", FALLA = Q.get("falla") === "1";
// (v10.84.70) facturas hechas por adelantado y sin orden, como las da list_linkable_invoices_for_order:
//   anticipo=mismo (una del mismo importe) · otro (de otro importe) · ambos · falla (no se pudieron leer) · falla1 (falla una vez)
//   adelantada=1: al abrir no hay ninguna, y al confirmar la base dice que se emitió una mientras se capturaba
const ANTICIPO = Q.get("anticipo") || "", ADELANTADA = Q.get("adelantada") === "1";
const CAND_MISMO = { doc_number: "F-9135", doc_type: "factura", amount: 66004, balance: 66004, issued_date: "2026-10-02", status: "pendiente",
  cfdi_status: "stamped", dias_sin_orden: 6, monto_cuadra: true, notas: "FACTURA POR ADELANTADO, sin orden de producción. Motivo: PIDE FACTURA PARA HACER EL PEDIDO." };
const CAND_OTRO = { doc_number: "F-9140", doc_type: "factura", amount: 2157.6, balance: 2157.6, issued_date: "2026-10-07", status: "pendiente",
  cfdi_status: "stamped", dias_sin_orden: 1, monto_cuadra: false, notas: "FACTURA POR ADELANTADO, sin orden de producción. Motivo: ANTICIPO DEL 50%." };
let candLlamadas = 0;
const cargarCandidatas = async () => { candLlamadas++; await new Promise(r => setTimeout(r, 120));
  if (ADELANTADA) return candLlamadas === 1 ? [] : [CAND_MISMO];
  if (ANTICIPO === "falla") return null;
  if (ANTICIPO === "lenta") { await new Promise(r => setTimeout(r, 9500)); return [CAND_OTRO]; }   // más que el tope de 8 s
  if (ANTICIPO === "falla1") return candLlamadas === 1 ? null : [CAND_OTRO];
  return ANTICIPO === "mismo" ? [CAND_MISMO] : ANTICIPO === "otro" ? [CAND_OTRO] : ANTICIPO === "ambos" ? [CAND_MISMO, CAND_OTRO] : []; };
let emisorLlamadas = 0;
const db = {
  getFolioEmitterEnabled: async () => { emisorLlamadas++; if (EMISOR === "falla") return null; if (EMISOR === "falla1") return emisorLlamadas === 1 ? null : true; return EMISOR !== "off"; },
  getNextFolioSuggestion: async t => t === "factura" ? "F-137" : "RS-1250",
  getClientBillingInfo: async () => { if (LENTA) await new Promise(r => setTimeout(r, 10000));   // (v10.84.70) más que el tope de 8 s
    return CLIENTE === "corona" ? { billing_mode: "anticipo", current_balance: 30000 } : CLIENTE === "cuadra" ? { billing_mode: "stock", current_balance: 0, stock_pool_id: "pool1" } : { billing_mode: "normal", current_balance: CLIENTE === "saldo" ? 5000 : 0 }; },
  loadClientProducts: async () => [{ id: "sku1", name: "Etiqueta Cuadra", sku: "CU-1", stock_actual: 120 }],
};
// simulados: BillToSection (el de verdad trae el buscador de clientes) y StageLbl (el mapa de etapas)
function BillToSection({ onChange }) { return <div style={{ padding: 8, fontSize: 11 }}>Facturar a un tercero (simulado)
  <button id="tercero-medias" onClick={() => onChange({ incomplete: true })}>tercero a medias</button>
  <button id="tercero-listo" onClick={() => onChange({ client_id: "t1", name: "TERCERO SA", rfc: "TSA010101AAA" })}>tercero listo</button></div>; }
const StageLbl = ({ stage }) => <b>{stage}</b>;`,
  fnBlock("ConfirmModal"), fnBlock("FolioAutoNote"), fnBlock("SaldoFavorAmarreBanner"),
  fnBlock("MultiPaymentPicker"), fnBlock("InvoiceModal"), fnBlock("PreInvoiceModal"),
  `const ORDER = { id: "o1", production_number: "P-0600", client: "PORTLAND STUDIO", client_id: "c1", product_type: INCOMPLETO ? "" : "Etiquetas",
  product: "Etiquetas colgantes", quantity: 5000, price: PRECIO0 ? 0 : (MAQUILA ? null : 56900), maq_price: MAQUILA ? 12000 : null,
  order_type: MAQUILA ? "maquila" : "normal", stage: "salidas", source: "admin", created_by: "secretaria" };
function Banco() {
  const [m, setM] = useState(null);
  const [log, setLog] = useState([]);
  const L = t => setLog(l => [...l, t]);
  // (v10.84.70) lo que la base rechaza vuelve al diálogo como { error } (App ya no lo manda a un aviso que se borra)
  const confirma = pref => async (...a) => { L(pref + ":confirm " + JSON.stringify(a)); await new Promise(r => setTimeout(r, 150));
    if (ADELANTADA && pref === "inv") { L("toast:error"); return { error: "Mientras capturabas se registró F-9135 por adelantado, por el mismo importe.", codigo: "adelantada" }; }
    if (FALLA) { L("toast:error"); return { error: "No se asignó el folio: sin conexión. Lo capturado sigue aquí para reintentar." }; } };
  const ligar = async (c, info) => { L("inv:ligar " + c.doc_number + " " + JSON.stringify(info || {})); await new Promise(r => setTimeout(r, 150));
    if (FALLA) { L("toast:error"); return { error: "No se ligó " + c.doc_number + ": sin conexión." }; } };
  return <div style={{ padding: 20, fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    <button id="abrir-inv" onClick={() => setM("inv")}>inv</button>
    <button id="abrir-pre" onClick={() => setM("pre")}>pre</button>
    <pre id="log">{log.join("\\n")}</pre>
    {m === "inv" && <InvoiceModal order={ORDER} onConfirm={confirma("inv")} onClose={() => { L("inv:cerrado"); setM(null); }}
      cargarCandidatas={cargarCandidatas} onLigar={ligar} onFacturarPorPartes={() => { L("inv:partes"); setM(null); }} />}
    {m === "pre" && <PreInvoiceModal order={ORDER} onConfirm={confirma("pre")} onClose={() => { L("pre:cerrado"); setM(null); }} />}
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco folio</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5199), strictPort: true } });
`, "utf8");
console.log("banco de folio listo en " + outDir);
