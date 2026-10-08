// Genera un banco de prueba con los modales de «Facturar por partes» EXTRAÍDOS de un App.jsx (actual o de HEAD),
// con sus dependencias reales (tokens, estilos, escStack, ConfirmModal) y la base simulada.
// Uso: node gen-banco.mjs <App.jsx> <dirSalida>
// Variantes por URL (?a=1&b=2): emisor=off · historica=1 · corona=1 · saldo=1 · unapieza=1 · candidatas=0 ·
//   falla=1 (la base responde con error) · folioexiste=0 (el split crea sin preguntar por folios en cobranza)
//   hakuna=1|resto|restoviejo (v10.84.66): P-0571 de RESTAURANTES HAKUNA, 35,000 piezas por $27,560, con las facturas por
//   adelantado F-130 ($18,268.35, 20,000 pzas) y F-131 ($13,701.27, 15,000 pzas), cada una UN centavo arriba de la orden porque
//   el CFDI calcula precio unitario (6 decimales) × cantidad. «1»: todo por facturar; «resto»: F-130 ya ligada con el dinero de
//   la orden (quedan $11,811.43); «restoviejo»: F-130 ligada con el de su CFDI, como antes (quedan $11,811.42).
import fs from "node:fs";
import path from "node:path";
const [, , srcPath, outDir] = process.argv;
const L = fs.readFileSync(srcPath, "utf8").replace(/\r\n/g, "\n").split("\n");
const find = (pred, desc) => { const i = L.findIndex(pred); if (i < 0) throw new Error("no encuentro " + desc); return i; };
const line = (re, desc) => L[find(l => re.test(l), desc)];
const fnBlock = name => { const s = find(l => l.startsWith("function " + name + "("), name); let e = s; while (L[++e] !== "}") { if (e > s + 2000) throw new Error("sin cierre " + name); } return L.slice(s, e + 1).join("\n"); };
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  `import { cuadrarPartes } from "../src/lib/cuadrarPartes.js";`,
  line(/^import \{ Broadcast as BroadcastIcon/, "íconos"),
  line(/^const C=\{/, "C"), line(/^const F=\{/, "F"),
  line(/^const inp=/, "inp"), line(/^const lbl=/, "lbl"), line(/^const bt=/, "bt"), line(/^const bs=/, "bs"),
  line(/^const escStack=/, "escStack"), line(/^if\(typeof document!=="undefined"&&!escStack\._bound\)/, "escStack bind"),
  fnBlock("useEscClose"),
  // desde v10.84.33: la trampa del Tab (no existe en versiones anteriores: se omite si no está)
  ...(L.some(l => l.startsWith("const FOCOS_DIALOGO=")) ? [line(/^const FOCOS_DIALOGO=/, "FOCOS_DIALOGO"), fnBlock("atraparTab")] : []),
  `const Q = new URLSearchParams(location.search);
const EMISOR = Q.get("emisor") !== "off", HIST = Q.get("historica") === "1", CORONA = Q.get("corona") === "1";
const SALDO = Q.get("saldo") === "1", UNAPIEZA = Q.get("unapieza") === "1", SINCAND = Q.get("candidatas") === "0";
const FALLA = Q.get("falla") === "1", FOLIOEXISTE = Q.get("folioexiste") !== "0";
const HAKUNA = Q.get("hakuna") || "";
const db = {
  getFolioEmitterEnabled: async () => EMISOR,
  listLinkableInvoicesForSplit: async () => SINCAND ? [] : HAKUNA ? [
    ...(HAKUNA === "1" ? [{ doc_number: "F-130", doc_type: "factura", amount: 18268.35, issued_date: "2026-10-01", cfdi_status: "stamped", cabe: true, qty_cfdi: 20000 },
      // y una con piezas pero LEJOS de lo que la orden da por ellas (no es redondeo: un precio distinto)
      { doc_number: "F-133", doc_type: "factura", amount: 9999.99, issued_date: "2026-10-02", cfdi_status: "stamped", cabe: true, qty_cfdi: 20000 }] : []),
    { doc_number: "F-131", doc_type: "factura", amount: 13701.27, issued_date: "2026-10-01", cfdi_status: "stamped", cabe: true, qty_cfdi: 15000 },
  ] : [
    { doc_number: "F-90", doc_type: "factura", amount: 6887.5, issued_date: "2026-09-23", cfdi_status: "stamped", cabe: true, qty_cfdi: 0 },
    { doc_number: "F-77", doc_type: "factura", amount: 39602.4, issued_date: "2026-09-20", cfdi_status: "stamped", cabe: true, qty_cfdi: 0 },
    { doc_number: "F-131", doc_type: "factura", amount: 99000, issued_date: "2026-09-29", cfdi_status: "stamped", cabe: false },
  ],
  getClientBillingInfo: async () => CORONA ? { billing_mode: "anticipo", current_balance: 30000 } : { billing_mode: "normal", current_balance: SALDO ? 5000 : 0 },
  getNextFolioSuggestion: async t => t === "factura" ? "D-6001" : "R-900",
};`,
  fnBlock("ConfirmModal"), fnBlock("FolioAutoNote"), fnBlock("SaldoFavorAmarreBanner"),
  L.slice(find(l => l.startsWith("function FacturarSiguienteParteModal("), "FSP"), find(l => l.startsWith("// ─── MATRIX CANCEL CONFIRM MODAL"), "MCC")).join("\n"),
  `const RESTO = UNAPIEZA ? { id: "s2", position: 2, doc_type: "por_facturar", invoice_folio: null, qty_portion: 1, amount_portion: 11.38, cancelled_at: null }
  : { id: "s2", position: 2, doc_type: "por_facturar", invoice_folio: null, qty_portion: 3000, amount_portion: 34140, cancelled_at: null };
const ORDER = { id: "o1", production_number: "P-0531", client: "PORTLAND STUDIO", product: "Etiquetas colgantes", quantity: 5000, price: 56900,
  order_type: "normal", created_by: HIST ? "import-historico" : "secretaria", client_id: "c1", stage: "salidas",
  splits: [{ id: "s1", position: 1, doc_type: "factura", invoice_folio: "F-44", qty_portion: 2000, amount_portion: 22760, cancelled_at: null }, RESTO] };
const ORDER_ULTIMA = { ...ORDER, splits: [{ id: "s9", position: 1, doc_type: "factura", invoice_folio: "F-120", qty_portion: 5000, amount_portion: 56900, cancelled_at: null }] };
const RESTO_H = HAKUNA === "1" ? { id: "h2", position: 1, doc_type: "por_facturar", invoice_folio: null, qty_portion: 35000, amount_portion: 27560, cancelled_at: null }
  : { id: "h2", position: 2, doc_type: "por_facturar", invoice_folio: null, qty_portion: 15000, amount_portion: HAKUNA === "restoviejo" ? 11811.42 : 11811.43, cancelled_at: null };
const ORDER_H = { id: "o2", production_number: "P-0571", client: "RESTAURANTES HAKUNA", product: "Cuponera", quantity: 35000, price: 27560,
  order_type: "normal", created_by: "secretaria", client_id: "c2", stage: "salidas", splits: [RESTO_H] };
const O = HAKUNA ? ORDER_H : ORDER, R = HAKUNA ? RESTO_H : RESTO;
const falla = () => { if (FALLA) throw new Error("La base rechazó la operación (prueba)"); };
function Banco() {
  const [m, setM] = useState(null);
  const [conf, setConf] = useState(null);
  const [log, setLog] = useState([]);
  const L = t => setLog(l => [...l, t]);
  return <div style={{ padding: 20, fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    <button id="abrir-sig" onClick={() => setM("sig")}>sig</button>
    <button id="abrir-split" onClick={() => setM("split")}>split</button>
    <button id="abrir-cancel" onClick={() => setM("cancel")}>cancel</button>
    <button id="abrir-cancel-ultima" onClick={() => setM("cancelUltima")}>cancelUltima</button>
    <pre id="log">{log.join("\\n")}</pre>
    {m === "sig" && <FacturarSiguienteParteModal order={O} resto={R} onClose={() => { L("sig:cerrado"); setM(null); }} onConfirm={async p => { L("sig:confirm " + JSON.stringify(p)); await new Promise(r => setTimeout(r, 150)); falla(); }} />}
    {m === "split" && <SplitInvoiceModal order={{ ...O, splits: [] }} user="karla" userLogin="karla" onClose={() => { L("split:cerrado"); setM(null); }}
      onConfirm={async (payload, opts) => { L("split:intento " + JSON.stringify({ payload, opts })); await new Promise(r => setTimeout(r, 150)); if (FALLA) { L("toast:error"); return; }
        if (FOLIOEXISTE) setConf({ zIndex: 1100, title: "Folio ya existe en cobranza", message: "Uno o más de estos folios ya están registrados en cobranza.", confirmLabel: "Sí, ligar los que ya existen", confirmColor: C.fac, onConfirm: async () => { setConf(null); L("split:ligar"); } });
        else L("split:creado"); }} />}
    {(m === "cancel" || m === "cancelUltima") && <CancelarParteModal order={m === "cancel" ? ORDER : ORDER_ULTIMA} parte={m === "cancel" ? ORDER.splits[0] : ORDER_ULTIMA.splits[0]} onClose={() => { L("cancel:cerrado"); setM(null); }} onConfirm={async x => { L("cancel:confirm " + JSON.stringify(x)); await new Promise(r => setTimeout(r, 150)); falla(); }} />}
    {conf && <ConfirmModal {...conf} onClose={() => { setConf(null); L("conf:cerrado"); }} />}
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5199), strictPort: true } });
`, "utf8");
console.log("banco listo en " + outDir);
