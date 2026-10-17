// Banco de «Asignar folio»: InvoiceModal, PreInvoiceModal y MultiPaymentPicker EXTRAÍDOS de un App.jsx, con sus dependencias
// reales (tokens, estilos, escStack, atraparTab, ConfirmModal, OTRO_CATS, refComplete, toBackendRef) y la base simulada.
// BillToSection y StageLbl van simulados (arrastran el buscador de clientes y el mapa de etapas; aquí no se cambiaron).
// Uso: node gen-banco-folio.mjs <App.jsx> <dirSalida>
// Variantes por URL (v10.84.112: corregir=1|falla y anticipo=f180, «Corregir precio» con P-0600 y F-180): emisor=off|falla|falla1 (falla una vez y luego sí) · cliente=corona|cuadra|saldo (saldo=N, el monto; 5000) · precio0=1 · maquila=1 ·
//   incompleto=1 (a la orden le falta el tipo de producto) · lenta=1 (el cliente tarda 10 s, más que el tope de 8) · falla=1 (la base rechaza) · guarda=lento (asignar tarda 3 s)
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";   // (15-oct) las letras, del propio banco: ninguna página sale a Google Fonts
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
  // v10.84.81 — ConfirmModal regresa el foco a donde estaba al cerrarse (useDevolverFoco); el código anterior no lo tiene
  ...(L.some(l => l.startsWith("function useDevolverFoco(")) ? [fnBlock("useDevolverFoco")] : []),
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
// v10.84.90 — guarda=lento: asignar tarda 3 s (no 150 ms): «mientras guarda» es mientras guarda aunque la máquina vaya lenta (inv-29 fallaba
//   con el candado cargado porque su Esc llegaba DESPUÉS de los 150 ms, ya terminado, y entonces preguntar es lo correcto)
const GUARDA_LENTO = Q.get("guarda") === "lento";
// (v10.84.70) facturas hechas por adelantado y sin orden, como las da list_linkable_invoices_for_order:
//   anticipo=mismo (una del mismo importe) · otro (de otro importe) · ambos · falla (no se pudieron leer) · falla1 (falla una vez)
//   adelantada=1: al abrir no hay ninguna, y al confirmar la base dice que se emitió una mientras se capturaba
const ANTICIPO = Q.get("anticipo") || "", ADELANTADA = Q.get("adelantada") === "1";
const EN_OC = Q.get("oc") === "1";   // v10.84.97 — la orden es una de las 4 de OC-0960
const CAND_MISMO = { doc_number: "F-9135", doc_type: "factura", amount: 66004, balance: 66004, issued_date: "2026-10-02", status: "pendiente",
  cfdi_status: "stamped", dias_sin_orden: 6, monto_cuadra: true, notas: "FACTURA POR ADELANTADO, sin orden de producción. Motivo: PIDE FACTURA PARA HACER EL PEDIDO." };
const CAND_OTRO = { doc_number: "F-9140", doc_type: "factura", amount: 2157.6, balance: 2157.6, issued_date: "2026-10-07", status: "pendiente",
  cfdi_status: "stamped", dias_sin_orden: 1, monto_cuadra: false, notas: "FACTURA POR ADELANTADO, sin orden de producción. Motivo: ANTICIPO DEL 50%." };
// v10.84.112 — corregir=1|falla: «Corregir precio» en la ventana (como Karla); anticipo=f180: F-180 por $70,180 (= $60,500 + IVA), que la base da
//   por «del mismo importe» sólo si la orden ya vale $60,500 (P-0600 de PRIME PET, 15-oct)
const CORREGIR = Q.get("corregir") || "";
let precioActual = 56900;
const CAND_F180 = () => ({ doc_number: "F-180", doc_type: "factura", amount: 70180, balance: 0, issued_date: "2026-10-14", status: "pagada", cfdi_status: "stamped",
  dias_sin_orden: 1, monto_cuadra: Math.abs(Math.round(precioActual * 116) / 100 - 70180) <= 0.02, notas: "FACTURA SIN ORDEN. Motivo: LA BUENA DE P-0600." });
// v10.84.118 — foliada=1|timbrada|cubierta|falla|falla1|lenta|avisos|sinprecio|timbra2|remision · guarda=rechazo (timbra2: al abrir se puede y, ya
//   con un precio, la base dice que la timbraron; remision: RS-1250 por $40,000, sin IVA): «Corregir precio» de una orden YA foliada (P-0648 de
//   GRUPO VISION, F-181 anticipada por $46,400 = $40,000 + IVA, sin timbrar), por la puerta de la base (corregir_precio_revisar, simulada aquí;
//   window.__revisar() dice con qué precios se revisó). guarda=rechazo: corregir_precio_orden contesta lo que la base rechaza (en palabras).
const FOLIADA = Q.get("foliada") || "", GUARDA = Q.get("guarda") || "";
const ORDEN_F = { id: "o2", production_number: "P-0648", client: "GRUPO VISION", client_id: "c2", product_type: "Lonas", product: "Lonas impresas", quantity: 40,
  price: FOLIADA === "sinprecio" ? null : 40000, maq_price: null, order_type: "normal", stage: "in_production", source: "admin", created_by: "secretaria",
  invoice_folio: "F-181", invoice_type: "factura", invoice_pre_assigned: true, payment_status: "unpaid" };
let revLlamadas = 0; const revisados = [];
window.__revisar = () => revisados.slice();
const revisarFoliada = async (id, precio) => { revLlamadas++; revisados.push(precio);
  await new Promise(r => setTimeout(r, FOLIADA === "lenta" ? 1500 : 120));
  if (FOLIADA === "falla" || (FOLIADA === "falla1" && revLlamadas === 1)) return { error: "sin conexión" };
  if (FOLIADA === "remision") { const factura = { id: "inv1250", folio: "RS-1250", tipo: "remision", importe: 40000, saldo: 40000, cfdi_status: "none", existe: true, conceptos: false };
    return { data: { folio: "RS-1250", precio_hoy: 40000, orden: { id, production_number: "P-0648" }, puede: true, codigo: "con_folio", caso: "con_folio", factura,
      nuevo: precio == null ? null : { precio, importe: precio, diferencia: precio - 40000 }, avisos: [], sin_orden_del_cliente: [] } }; }
  if (FOLIADA === "timbra2" && precio != null) return { data: { folio: "F-181", precio_hoy: 40000, orden: { id, production_number: "P-0648" }, puede: false, codigo: "timbrada",
    porque: "F-181 ya está timbrada ante el SAT: su importe ya no cambia.", camino: "Cancélala en Cancelaciones, luego «Liberar folio» en PrintFlow, corrige el precio y vuelve a asignar folio." } };   // (como lo devuelve revisarPrecioFoliado: el motivo, en palabras)
  const base = { folio: "F-181", precio_hoy: FOLIADA === "sinprecio" ? null : 40000, orden: { id, production_number: "P-0648" } };
  if (FOLIADA === "timbrada") return { data: { ...base, puede: false, codigo: "timbrada", porque: "F-181 ya está timbrada ante el SAT: su importe ya no cambia.",
    camino: "Cancélala en Cancelaciones, luego «Liberar folio» en PrintFlow, corrige el precio y vuelve a asignar folio; si sólo baja y el cliente está de acuerdo, nota de crédito." } };
  const factura = FOLIADA === "sinprecio" ? { folio: "F-181", tipo: "factura", existe: false }
    : { id: "inv181", folio: "F-181", tipo: "factura", importe: 46400, saldo: 46400, cfdi_status: "none", existe: true, conceptos: FOLIADA === "avisos" };
  const caso = FOLIADA === "sinprecio" ? "foliada_sin_precio" : "con_folio";
  const avisosHora = FOLIADA === "avisos" ? ["fuera_de_horario"] : [];
  if (precio == null) return { data: { ...base, puede: true, codigo: caso, caso, factura, nuevo: null, avisos: avisosHora } };
  if (FOLIADA === "cubierta" && precio === 60500) return { data: { ...base, puede: false, codigo: "cubierta",
    cubierta_por: { folio: "F-180", importe: 70180, cfdi_status: "stamped", emitida: "2026-10-14", estado: "pendiente" },
    porque: "F-180 (sin orden, timbrada, $70,180.00, del 14-10-2026) ya cubre este trabajo con el precio nuevo: si F-181 se timbra y es la misma venta, GRUPO VISION tendría dos CFDI.",
    camino: "Avísale a Dirección. Si es el mismo trabajo, F-181 se cancela sin timbrar y P-0648 queda sin folio para ligar F-180; si es otro trabajo del mismo importe, Dirección lo corrige." } };
  const importe = Math.round(precio * 116) / 100;
  return { data: { ...base, puede: true, codigo: caso, caso, factura,
    nuevo: { precio, importe, diferencia: Math.round((importe - (factura.importe || 0)) * 100) / 100 },
    avisos: FOLIADA === "avisos" ? ["con_iva", "cambia_mucho", "sin_orden_de_otro_importe", "fuera_de_horario"] : [],
    sin_orden_del_cliente: FOLIADA === "avisos" ? [{ folio: "F-170", tipo: "factura", importe: 11600, emitida: "2026-10-01", cfdi_status: "stamped", estado: "pendiente" }] : [] } };
};
let candLlamadas = 0;
const cargarCandidatas = async () => { candLlamadas++; await new Promise(r => setTimeout(r, 120));
  if (ADELANTADA) return candLlamadas === 1 ? [] : [CAND_MISMO];
  if (ANTICIPO === "falla") return null;
  if (ANTICIPO === "lenta") { await new Promise(r => setTimeout(r, 9500)); return [CAND_OTRO]; }   // más que el tope de 8 s
  if (ANTICIPO === "falla1") return candLlamadas === 1 ? null : [CAND_OTRO];
  if (ANTICIPO === "f180") return [CAND_F180()];
  return ANTICIPO === "mismo" ? [CAND_MISMO] : ANTICIPO === "otro" ? [CAND_OTRO] : ANTICIPO === "ambos" ? [CAND_MISMO, CAND_OTRO] : []; };
let emisorLlamadas = 0;
const db = {
  getFolioEmitterEnabled: async () => { emisorLlamadas++; if (EMISOR === "falla") return null; if (EMISOR === "falla1") return emisorLlamadas === 1 ? null : true; return EMISOR !== "off"; },
  getNextFolioSuggestion: async t => t === "factura" ? "F-137" : "RS-1250",
  getClientBillingInfo: async () => { if (LENTA) await new Promise(r => setTimeout(r, 10000));   // (v10.84.70) más que el tope de 8 s
    // (v10.84.141: saldoCorona=N, el saldo del cliente Corona; por omisión $30,000, menos que la orden de $56,900)
    return CLIENTE === "corona" ? { billing_mode: "anticipo", current_balance: Number(Q.get("saldoCorona") || 30000) } : CLIENTE === "cuadra" ? { billing_mode: "stock", current_balance: 0, stock_pool_id: "pool1" } : { billing_mode: "normal", current_balance: CLIENTE === "saldo" ? Number(Q.get("saldo") || 5000) : 0 }; },
  loadClientProducts: async () => [{ id: "sku1", name: "Etiqueta Cuadra", sku: "CU-1", stock_actual: 120 }],
};
// simulados: BillToSection (el de verdad trae el buscador de clientes) y StageLbl (el mapa de etapas)
function BillToSection({ onChange }) { return <div style={{ padding: 8, fontSize: 11 }}>Facturar a un tercero (simulado)
  <button id="tercero-medias" onClick={() => onChange({ incomplete: true })}>tercero a medias</button>
  <button id="tercero-listo" onClick={() => onChange({ client_id: "t1", name: "TERCERO SA", rfc: "TSA010101AAA" })}>tercero listo</button></div>; }
const StageLbl = ({ stage }) => <b>{stage}</b>;`,
  fnBlock("ConfirmModal"), fnBlock("FolioAutoNote"), fnBlock("SaldoFavorAmarreBanner"),
  fnBlock("MultiPaymentPicker"),
  // v10.84.96 — el aviso de «no pude revisar las facturas sin orden» (si el App.jsx lo trae)
  ...(L.some(l => l.startsWith("function SinRevisionSinOrden(")) ? [fnBlock("SinRevisionSinOrden")] : []),
  // v10.84.104 — «Continuar» pregunta por las facturas sin orden de otro importe con la regla del folio anticipado
  ...(L.some(l => l.startsWith("function anticiposQuePreguntar(")) ? [fnBlock("anticiposQuePreguntar")] : []),
  fnBlock("InvoiceModal"), fnBlock("PreInvoiceModal"),
  // v10.84.90 — «Confirmar entrega» y «Capturar precio» (el mismo «ocupado desde el clic» que asignar el folio)
  fnBlock("DeliverOnlyModal"), fnBlock("PriceCaptureModal"),
  // v10.84.112 — «Corregir precio» (si el App.jsx lo trae)
  ...(L.some(l => l.startsWith("function CorregirPrecioModal(")) ? [fnBlock("CorregirPrecioModal")] : []),
  `const ORDER = { id: "o1", production_number: "P-0600", client: "PORTLAND STUDIO", client_id: "c1", product_type: INCOMPLETO ? "" : "Etiquetas",
  product: "Etiquetas colgantes", quantity: 5000, price: PRECIO0 ? 0 : (MAQUILA ? null : 56900), maq_price: MAQUILA ? 12000 : null,
  order_type: MAQUILA ? "maquila" : "normal", stage: "salidas", source: "admin", created_by: "secretaria" };
function Banco() {
  const [m, setM] = useState(null);
  const [orden, setOrden] = useState(ORDER);            // v10.84.112 — el precio puede cambiar con la ventana abierta
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [ordenF, setOrdenF] = useState(ORDEN_F), [foliadaAbierta, setFoliadaAbierta] = useState(false);   // v10.84.118
  const [log, setLog] = useState([]);
  const L = t => setLog(l => [...l, t]);
  // (v10.84.70) lo que la base rechaza vuelve al diálogo como { error } (App ya no lo manda a un aviso que se borra)
  const confirma = pref => async (...a) => { L(pref + ":confirm " + JSON.stringify(a)); await new Promise(r => setTimeout(r, GUARDA_LENTO ? 3000 : 150));
    if (ADELANTADA && pref === "inv") { L("toast:error"); return { error: "Mientras capturabas se registró F-9135 por adelantado, por el mismo importe.", codigo: "adelantada" }; }
    if (FALLA) { L("toast:error"); return { error: "No se asignó el folio: sin conexión. Lo capturado sigue aquí para reintentar." }; } };
  const ligar = async (c, info) => { L("inv:ligar " + c.doc_number + " " + JSON.stringify(info || {})); await new Promise(r => setTimeout(r, 150));
    if (FALLA) { L("toast:error"); return { error: "No se ligó " + c.doc_number + ": sin conexión." }; } };
  return <div style={{ padding: 20, fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    <button id="abrir-inv" onClick={() => setM("inv")}>inv</button>
    <button id="abrir-pre" onClick={() => setM("pre")}>pre</button>
    <button id="abrir-ent" onClick={() => setM("ent")}>ent</button>
    <button id="abrir-precio" onClick={() => setM("precio")}>precio</button>
    <button id="abrir-foliada" onClick={() => setFoliadaAbierta(true)}>foliada</button>
    <pre id="log">{log.join("\\n")}</pre>
    {m === "inv" && <InvoiceModal key={"inv:" + (orden.order_type === "maquila" ? orden.maq_price : orden.price)} order={orden} onConfirm={confirma("inv")} onClose={() => { L("inv:cerrado"); setM(null); }}
      cargarCandidatas={cargarCandidatas} onLigar={ligar} onFacturarPorPartes={() => { L("inv:partes"); setM(null); }}
      ocDeLaOrden={EN_OC ? { id: "OC-0960", n: 4 } : null} onIrALaOC={id => { L("inv:oc " + id); setM(null); }}
      onCorregirPrecio={CORREGIR ? () => { L("inv:corregir"); setCorrigiendo(true); } : null} />}
    {corrigiendo && typeof CorregirPrecioModal !== "undefined" && <CorregirPrecioModal order={orden} cargarCandidatas={cargarCandidatas} onClose={() => { L("corregir:cerrado"); setCorrigiendo(false); }}
      onGuardar={async (nuevo, motivo) => { L("corregir:guardar " + nuevo + " " + motivo); await new Promise(r => setTimeout(r, 300));
        if (CORREGIR === "falla") { L("corregir:rechazo"); return { error: "La base no aceptó el precio: sin conexión. No se cambió." }; }
        // (vuelta 3) como App: la maquila guarda maq_price (el precio al cliente)
        precioActual = nuevo; setOrden(o => ({ ...o, [o.order_type === "maquila" ? "maq_price" : "price"]: nuevo })); setCorrigiendo(false); return null; }} />}
    {foliadaAbierta && typeof CorregirPrecioModal !== "undefined" && <CorregirPrecioModal order={ordenF} revisar={FOLIADA ? revisarFoliada : null}
      onClose={() => { L("corregir:cerrado"); setFoliadaAbierta(false); }}
      onGuardar={async (nuevo, motivo, visto) => { L("corregir:guardar " + nuevo + " " + motivo + " visto=" + JSON.stringify(visto === undefined ? null : visto)); await new Promise(r => setTimeout(r, 300));
        if (GUARDA === "rechazo") { L("corregir:rechazo"); return { error: "El importe de F-181 cambió mientras lo revisabas: ahora es $70,180.00. No se cambió nada." }; }
        setOrdenF(o => ({ ...o, price: nuevo })); setFoliadaAbierta(false); return null; }} />}
    {m === "pre" && <PreInvoiceModal order={ORDER} onConfirm={confirma("pre")} onClose={() => { L("pre:cerrado"); setM(null); }}
      cargarCandidatas={cargarCandidatas} onFacturarPorPartes={() => { L("pre:partes"); setM(null); }}
      ocDeLaOrden={EN_OC ? { id: "OC-0960", n: 4 } : null} onIrALaOC={id => { L("pre:oc " + id); setM(null); }} />}
    {m === "ent" && <DeliverOnlyModal order={{ ...ORDER, invoice_folio: "F-9001", invoice_type: "factura" }} onConfirm={async () => { L("ent:confirm"); await new Promise(r => setTimeout(r, 150)); }}
      onClose={() => { L("ent:cerrado"); setM(null); }} />}
    {m === "precio" && <PriceCaptureModal order={ORDER} onCapture={async v => { L("precio:captura " + v); await new Promise(r => setTimeout(r, 150)); }}
      onSkip={async () => { L("precio:omitir"); await new Promise(r => setTimeout(r, 150)); }} onClose={() => { L("precio:cerrado"); setM(null); }} />}
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco folio</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5199), strictPort: true } });
`, "utf8");
console.log("banco de folio listo en " + outDir);
