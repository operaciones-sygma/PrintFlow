// Banco de «Folio por OC»: AssignOCFolioModal EXTRAÍDO de un App.jsx, con sus dependencias reales (tokens, estilos, escStack,
// atraparTab, ConfirmModal, FolioAutoNote, SaldoFavorAmarreBanner, MultiPaymentPicker, OTRO_CATS, refComplete, toBackendRef)
// y la base simulada. BillToSection va simulado (trae el buscador de clientes).
// Uso: node gen-oc.mjs <App.jsx> <dirSalida>
// Variantes por URL: emisor=off|falla|falla1|falla2 · cliente=corona|cuadra|saldo · pre=1 (pre-asignar) · traslado=no|falla ·
//   ordenes=N (pendientes, por defecto 5) · facturadas=N (ya con folio, por defecto 2) · falla=1 (la base rechaza al confirmar) ·
//   lento=1 (el saldo del cliente y el traslado tardan 2.5 s) · lento=colgado · emisor=colgado (nunca contestan)
import fs from "node:fs";
import path from "node:path";
const [, , srcPath, outDir] = process.argv;
const L = fs.readFileSync(srcPath, "utf8").replace(/\r\n/g, "\n").split("\n");
const find = (pred, desc) => { const i = L.findIndex(pred); if (i < 0) throw new Error("no encuentro " + desc); return i; };
const line = (re, desc) => L[find(l => re.test(l), desc)];
const fnBlock = name => { const s = find(l => l.startsWith("function " + name + "("), name); let e = s; while (L[++e] !== "}") { if (e > s + 2000) throw new Error("sin cierre " + name); } return L.slice(s, e + 1).join("\n"); };
const constBlock = name => { const s = find(l => l.startsWith("const " + name + " ") || l.startsWith("const " + name + "="), name); if (/[;\]]\s*$/.test(L[s]) && !/\[\s*$/.test(L[s])) return L[s]; let e = s; while (!/^\];?\s*$/.test(L[++e])) { if (e > s + 200) throw new Error("sin cierre " + name); } return L.slice(s, e + 1).join("\n"); };
const opcional = (cond, f) => cond ? [f()] : [];
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  line(/^import \{ Broadcast as BroadcastIcon/, "íconos"),
  line(/^const C=\{/, "C"), line(/^const F=\{/, "F"),
  line(/^const inp=/, "inp"), line(/^const lbl=/, "lbl"), line(/^const bt=/, "bt"), line(/^const bs=/, "bs"),
  line(/^const fmt=/, "fmt"),
  line(/^const escStack=/, "escStack"), line(/^if\(typeof document!=="undefined"&&!escStack\._bound\)/, "escStack bind"),
  fnBlock("useEscClose"),
  ...opcional(L.some(l => l.startsWith("const FOCOS_DIALOGO=")), () => line(/^const FOCOS_DIALOGO=/, "FOCOS_DIALOGO")),
  ...opcional(L.some(l => l.startsWith("function atraparTab(")), () => fnBlock("atraparTab")),
  constBlock("OTRO_CATS"), fnBlock("toBackendRef"), fnBlock("refComplete"),
  `const Q = new URLSearchParams(location.search);
const EMISOR = Q.get("emisor") || "on", CLIENTE = Q.get("cliente") || "normal", PRE = Q.get("pre") === "1";
const TRASLADO = Q.get("traslado") || "listo", FALLA = Q.get("falla") === "1";
const N_PEND = Number(Q.get("ordenes") || 5), N_FACT = Number(Q.get("facturadas") || 2);
// lento: el saldo del cliente y el traslado tardan 2.5 s en llegar (lo que se ve y se puede hacer mientras)
const LENTO = Q.get("lento") === "1", COLGADO = Q.get("lento") === "colgado";
// colgado: nunca contestan (la red que se queda pensando): la ventana no puede quedarse esperando para siempre
const tarda = () => COLGADO ? new Promise(() => {}) : new Promise(r => setTimeout(r, LENTO ? 2500 : 0));
let emisorLlamadas = 0;
const db = {
  // falla: nunca se sabe · falla1: la primera consulta falla y la segunda sí contesta (para «Reintentar») · falla2: las dos
  //   primeras fallan (al pasar a Dividir se vuelve a consultar: así «Reintentar» se prueba en Dividir)
  getFolioEmitterEnabled: async () => { emisorLlamadas++; if (EMISOR === "colgado") return new Promise(() => {}); if (EMISOR === "falla") return null; if (EMISOR === "falla1") return emisorLlamadas === 1 ? null : true; if (EMISOR === "falla2") return emisorLlamadas <= 2 ? null : true; return EMISOR !== "off"; },
  getNextFolioSuggestion: async t => EMISOR === "off" ? (t === "factura" ? "D-5781" : "R-1903") : (t === "factura" ? "F-137" : "RS-1250"),
  getClientBillingInfo: async () => (await tarda(), CLIENTE === "corona") ? { billing_mode: "anticipo", current_balance: 30000 }
    : CLIENTE === "cuadra" ? { billing_mode: "stock", current_balance: 0, stock_pool_id: "pool1" }
    : { billing_mode: "normal", current_balance: CLIENTE === "saldo" ? 5000 : 0 },
  trasladoPreviewOC: async () => {
    await tarda();
    if (CLIENTE !== "cuadra") return { aplica: false };
    if (TRASLADO === "falla") throw new Error("timeout");
    if (TRASLADO === "no") return { aplica: true, listo: false, motivo: "Falta la clave SAT de 2 productos." };
    return { aplica: true, listo: true, destino: "Cuadra Silao", destino_id: "d1", distancia_km: 38, total_lineas: 3, lineas: [] };
  },
};
function BillToSection({ onChange }) { return <div style={{ padding: 8, fontSize: 11 }}>Facturar a un tercero (simulado)
  <button id="tercero-medias" onClick={() => onChange({ incomplete: true })}>tercero a medias</button>
  <button id="tercero-listo" onClick={() => onChange({ client_id: "t1", name: "TERCERO SA", rfc: "TSA010101AAA" })}>tercero listo</button></div>; }`,
  ...opcional(L.some(l => l.startsWith("function ConfirmModal(")), () => fnBlock("ConfirmModal")),
  fnBlock("FolioAutoNote"), fnBlock("SaldoFavorAmarreBanner"), fnBlock("MultiPaymentPicker"), fnBlock("AssignOCFolioModal"),
  `const CLIENTES = { normal: "PORTLAND STUDIO", corona: "CERVECERIA MODELO DE MEXICO", cuadra: "CUADRA SA DE CV", saldo: "IMPRENTA LEON" };
const OC = { id: "OC-1003", client: CLIENTES[CLIENTE] || CLIENTES.normal, client_id: "c1" };
const PRODUCTOS = ["Etiquetas colgantes", "Folders", "Bolsa kraft", "Tarjetas de presentación", "Volantes", "Cajas plegadizas", "Stickers", "Manteles"];
const ORDERS = [
  ...Array.from({ length: N_FACT }, (_, i) => ({ id: "of" + i, production_number: "P-05" + (90 + i), product: PRODUCTOS[i % 8], quantity: 1000,
    price: 4200, order_type: "normal", stage: "delivered", invoice_folio: "F-12" + i, invoice_type: "factura" })),
  ...Array.from({ length: N_PEND }, (_, i) => ({ id: "op" + i, production_number: "P-06" + (10 + i), product: PRODUCTOS[(i + 2) % 8], quantity: 500 * (i + 1),
    price: [56900, 12850.5, 3400, 980, 22100, 7600, 15000, 2300][i % 8], order_type: i === 3 ? "maquila" : "normal", maq_price: i === 3 ? 980 : null,
    stage: "salidas", invoice_folio: null })),
];
function Banco() {
  // abrir=1 abre la ventana al cargar y split=1 pasa a «Dividir» (para el detector, que no da clics)
  const [abierto, setAbierto] = useState(Q.get("abrir") === "1");
  useEffect(() => { if (Q.get("split") === "1") setTimeout(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Dividir en N facturas")?.click(), 400); }, []);
  const [log, setLog] = useState([]);
  const anota = t => setLog(l => [...l, t]);
  const confirma = pref => async (...a) => { anota(pref + ":confirm " + JSON.stringify(a)); await new Promise(r => setTimeout(r, 150)); if (FALLA) { anota("toast:error"); return null; } setAbierto(false); return { count: 1 }; };
  return <div style={{ padding: 20, fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    <button id="abrir-oc" onClick={() => setAbierto(true)}>abrir folio por OC</button>
    <pre id="log">{log.join("\\n")}</pre>
    {abierto && <AssignOCFolioModal oc={OC} ocOrders={ORDERS} preAssignedMode={PRE} onConfirmSimple={confirma("simple")} onConfirmSplit={confirma("split")} onClose={() => { anota("cerrado"); setAbierto(false); }} />}
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco folio por OC</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5195), strictPort: true } });
`, "utf8");
console.log("banco de folio por OC listo en " + outDir);
