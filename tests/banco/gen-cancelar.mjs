// Banco de «LAS PUERTAS DE CANCELAR»: las ventanas que cancelan una orden (`CancelOrderModal`), una orden con folio
// (`CancelInvoicedModal`), una parte de una orden facturada por partes (`CancelarParteModal`) y una línea o una factura entera del
// plan matriz de una OC (`MatrixCancelConfirmModal`), EXTRAÍDAS de un App.jsx por extraer.mjs con todo lo que usan. Lo que hace App
// al confirmar va SIMULADO como lo hace App: el aviso de éxito con sus palabras, y si la base rechaza, lo que App hace con el error.
// Cada paso se anota en #log.
// Uso: node gen-cancelar.mjs <App.jsx> <dirSalida>
// Variantes por URL:
//   saldo=0|corona|falla|lento (lo que contesta ordenes_saldo_consumido al abrir; lento = no contesta en 20 s) · saldoMs=N (lo que tarda)
//   fac=normal|timbrada|cobrada|compartida|sinfactura|falla|lento (lo que contesta pf_price_drop_check sobre el folio de la orden)
//   falla=1 (la base rechaza al confirmar) · lento=1 (la base tarda 4 s al confirmar; lento=N, N segundos) · rol=secretaria|admin
// window.__cambiar(clave, {…}) cambia la orden abierta con la ventana abierta (como el tiempo real).
import fs from "node:fs";
import path from "node:path";
import { extraer } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const RAICES = ["CancelOrderModal", "CancelInvoicedModal", "CancelarParteModal", "MatrixCancelConfirmModal", "Toast"];
const SIMULADOS = ["supabase", "db", "SignedImg", "firmarOrderFile", "propsArchivoFirmado", "useSignedFile", "abrirArchivoFirmado"];
const { codigo, simuladosUsados } = extraer(fuente, RAICES, { simulados: SIMULADOS });
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  `// ── lo que toca la base, simulado (${simuladosUsados.join(", ") || "nada"}) ──
const Q = new URLSearchParams(location.search);
const SALDO = Q.get("saldo") || "0", SALDO_MS = Number(Q.get("saldoMs") || 150), FAC = Q.get("fac") || "normal";
const FALLA = Q.get("falla") === "1", LENTO = Number(Q.get("lento") || 0), ROL = Q.get("rol") || "secretaria";
const bitacora = [];
const anotar = t => { bitacora.push(t); window.dispatchEvent(new Event("bitacora")); };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const supabase = { rpc: async (nombre, args) => { anotar("rpc " + nombre + " " + JSON.stringify(args));
  if (nombre === "ordenes_saldo_consumido") {
    await dormir(SALDO === "lento" ? 20000 : SALDO_MS);
    if (SALDO === "falla") return { data: null, error: { message: "upstream connect error" } };
    return { data: SALDO === "corona" ? [{ order_id: args.p_order_ids[0], monto: 45200 }] : [], error: null };
  }
  await dormir(150);
  return { data: null, error: null }; },
  from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) };
// pf_price_drop_check: lo que la base sabe del folio de la orden (importe, lo cobrado, si es de toda la OC, si está timbrada)
const db = { checkPriceDrop: async (actor, id) => { anotar("check " + id + " " + actor);
  await dormir(FAC === "lento" ? 20000 : 200);
  if (FAC === "falla") throw new Error("upstream connect error");
  if (FAC === "sinfactura") return { aplica: false, motivo: "no hay factura viva con ese folio" };
  const o = Object.values(window.__ordenes ? window.__ordenes() : {}).find(x => x.id === id) || {};
  const conIva = (o.invoice_type || "factura") === "factura";
  const monto = FAC === "compartida" ? 139200 : Math.round((o.price || 0) * (conIva ? 1.16 : 1) * 100) / 100;
  return { aplica: true, folio: o.invoice_folio, monto_factura: monto, cobrado: FAC === "cobrada" ? 30000 : 0, oc_compartida: FAC === "compartida",
    cobro_conciliado: FAC === "cobrada", pagos_registrados: FAC === "cobrada" ? 30000 : 0, timbrada: FAC === "timbrada" }; } };
const propsArchivoFirmado = () => ({});
const firmarOrderFile = async src => src;
function SignedImg({ alt, style }) { return <span style={style} aria-label={alt} />; }`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `// ── el banco ──
const fmtMx = n => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BASE = { client_id: "c1", product: "Etiquetas colgantes", product_type: "Etiquetas", quantity: 5000, order_type: "normal", source: "admin", created_by: "secretaria" };
const DATOS = {
  orden: { ...BASE, id: "o1", production_number: "P-0712", client: "GRUPO TEXTIL LEÓN", price: 18500, stage: "ready" },
  corona: { ...BASE, id: "o2", production_number: "P-0698", client: "CERVECERIA MODELO DE MEXICO", client_company: "CERVECERIA MODELO", price: 45200, quantity: 12000, stage: "delivered" },
  factura: { ...BASE, id: "o3", production_number: "P-0688", client: "PORTLAND STUDIO", price: 56900, stage: "delivered", invoice_folio: "F-131", invoice_type: "factura" },
  remision: { ...BASE, id: "o4", production_number: "P-0690", client: "IMPRENTA LEON", price: 9800, quantity: 1000, stage: "delivered", invoice_folio: "RS-1290", invoice_type: "remision" },
  anticipada: { ...BASE, id: "o5", production_number: "P-0705", client: "CABLESERV", price: 21300, stage: "salidas", invoice_folio: "F-136", invoice_type: "factura", invoice_pre_assigned: true },
  partes: { ...BASE, id: "o6", production_number: "P-0671", client: "KFC (PREMIUM RESTAURANT BRANDS)", price: 56900, quantity: 5000, stage: "delivered", has_splits: true,
    splits: [{ id: "s1", position: 1, invoice_folio: "F-128", doc_type: "factura", amount_portion: 30000, qty_portion: 2600 },
             { id: "s2", position: 2, invoice_folio: "F-133", doc_type: "factura", amount_portion: 26900, qty_portion: 2400 }] },
  ultima: { ...BASE, id: "o7", production_number: "P-0675", client: "HAKUNA", price: 12000, quantity: 2000, stage: "delivered", has_splits: true,
    splits: [{ id: "s3", position: 1, invoice_folio: "F-129", doc_type: "factura", amount_portion: 12000, qty_portion: 2000 },
             { id: "s4", position: 2, invoice_folio: "F-130", doc_type: "factura", amount_portion: 0, qty_portion: 0, cancelled_at: "2026-10-05T10:00:00Z" }] },
  // la orden ya facturada por partes, en manos de Dirección (la cancelación normal la deja pasar y el puente tumba sus facturas)
  facturada: { ...BASE, id: "o10", production_number: "P-0730", client: "KFC (PREMIUM RESTAURANT BRANDS)", price: 35000, stage: "salidas", has_splits: true,
    splits: [{ id: "s5", position: 1, invoice_folio: "F-150", doc_type: "factura", amount_portion: 20000, qty_portion: 3000, payment_status: "paid" },
             { id: "s6", position: 2, invoice_folio: "F-151", doc_type: "factura", amount_portion: 15000, qty_portion: 2000 }] },
  stock: { ...BASE, id: "o11", production_number: "P-0733", client: "HAKUNA", price: 9000, stage: "packaging", stock_loaded: true, stock_role: "production" },
  cola: { ...BASE, id: "o12", production_number: "P-0735", client: "IMPRENTA LEON", price: 7000, stage: "in_production", current_machine: "off_gto", machine_queue_position: 0 },
  siguiente: { ...BASE, id: "o13", production_number: "P-0716", client: "CABLESERV", price: 4000, stage: "in_production", current_machine: "off_gto", machine_queue_position: 1 },
  archivo: { ...BASE, id: "o14", production_number: "P-0737", client: "PORTLAND STUDIO", price: 6000, stage: "ready",
    file_url: "https://x.supabase.co/storage/v1/object/public/order-files/o14/etiqueta-final.pdf", file_name: "etiqueta-final.pdf" },
  // (segunda pasada) la orden sólo en el plan matriz, y la de una OC con folio compartido (las dos, en manos de Dirección)
  matriz: { ...BASE, id: "o15", production_number: "P-0740", client: "TRANSPORTES CASTORES", price: 30000, stage: "salidas", has_matrix_lines: true, purchase_order_id: "OC-0881" },
  ocfolio: { ...BASE, id: "o16", production_number: "P-0742", client: "GOBIERNO DEL ESTADO", price: 50000, stage: "salidas", purchase_order_id: "OC-0950" },
  // la orden con folio anticipado que todavía corre en una máquina (Printmaster 52: en GTO ya corre la de «cola»), con su archivo
  corriendo: { ...BASE, id: "o17", production_number: "P-0744", client: "CABLESERV", price: 21300, stage: "in_production", invoice_folio: "F-138", invoice_type: "factura",
    invoice_pre_assigned: true, current_machine: "off_pm52", machine_queue_position: 0,
    file_url: "https://x.supabase.co/storage/v1/object/public/order-files/o17/arte-final.pdf", file_name: "arte-final.pdf" },
  linea1: { ...BASE, id: "o8", production_number: "P-0720", client: "TRANSPORTES CASTORES", price: 60000, stage: "delivered", has_matrix_lines: true },
  linea2: { ...BASE, id: "o9", production_number: "P-0721", client: "TRANSPORTES CASTORES", price: 60000, stage: "delivered", has_matrix_lines: true },
};
const OC = { id: "OC-0881", client: "TRANSPORTES CASTORES" };
const GRUPO = { id: "g1", position: 1, folio: "F-140", label: "Factura 1", doc_type: "factura", total_amount: 120000,
  lines: [{ id: "l1", order_id: "o8", qty_portion: 3000, amount_portion: 60000 }, { id: "l2", order_id: "o9", qty_portion: 3000, amount_portion: 60000 }] };
// la factura del plan con UNA línea viva (la otra ya se canceló): cancelar esa línea cancela la factura
const GRUPO_ULTIMO = { id: "g2", position: 2, folio: "F-141", label: "Factura 2", doc_type: "factura", total_amount: 30000,
  lines: [{ id: "l3", order_id: "o8", qty_portion: 1500, amount_portion: 30000 }, { id: "l4", order_id: "o9", qty_portion: 1500, amount_portion: 25000, cancelled_at: "2026-10-05T10:00:00Z" }] };
// lento=1: la base tarda 4 s al confirmar; lento=N (N > 1): N segundos (para ver qué dice la ventana cuando no contesta)
// la factura del plan que ya está pagada
const GRUPO_PAGADO = { ...GRUPO, id: "g3", payment_status: "paid" };
const espera = () => dormir(LENTO ? (LENTO === 1 ? 4000 : LENTO * 1000) : 300);
function Banco() {
  const [m, setM] = useState(null);
  const [ordenes, setOrdenes] = useState(DATOS);
  const [toast, setToast] = useState(null);
  const [log, setLog] = useState([]);
  useEffect(() => { const f = () => setLog([...bitacora]); window.addEventListener("bitacora", f); return () => window.removeEventListener("bitacora", f); }, []);
  const vivas = useRef(ordenes); vivas.current = ordenes;
  useEffect(() => { window.__cambiar = (k, cambio) => setOrdenes(o => ({ ...o, [k]: { ...o[k], ...cambio } })); window.__ordenes = () => vivas.current; }, []);
  const aviso = (message, type = "success") => setToast({ id: Date.now(), message, type });
  const cerrar = () => { anotar("cerrado"); setM(null); };
  // lo que hace App al confirmar cada una (src/App.jsx v10.84.73: cancelOrder, el montaje de CancelInvoicedModal, de CancelarParteModal y
  //   del plan matriz): lo que impide cancelar o la base rechaza VUELVE A LA VENTANA ({error}, o la parte lanza); el éxito cierra y avisa en verde
  const alCancelarOrden = async (reason, extra) => { anotar("cancelar-orden " + m.k + " " + JSON.stringify(reason));
    const o = vivas.current[m.k];
    if (o.invoice_folio) return { error: "Mientras tenías la ventana abierta, " + (o.production_number || "la orden") + " recibió el folio " + o.invoice_folio + " en otra sesión. " + (ROL === "admin" ? "Ciérrala y cancélala con «Cancelar con su folio», que se encarga de la factura." : "Con folio, sólo Dirección puede cancelarla.") };
    if (o.stock_loaded) return { error: "No se puede cancelar: esta orden ingresó +" + o.quantity + " al inventario. Primero ajusta el stock (Inventario → Ajustar) y luego cancela." };
    await espera();
    if (FALLA) return { error: "No se canceló " + (o.production_number || "la orden") + ": sin conexión. Lo que escribiste sigue aquí." };
    const quien = o.production_number || "La orden", mas = [extra?.saldo > 0 && "$" + fmtMx(extra.saldo) + " regresaron a la bolsa del cliente", extra?.facturas?.length && "en CobranzaFlow se cancelaron " + extra.facturas.join(", ")].filter(Boolean);
    setM(null); aviso(quien + " cancelada" + (mas.length ? " · " + mas.join(" · ") : ""), "success"); };
  const alCancelarFacturada = async (reason, caso) => { anotar("cancelar-facturada " + m.k + " " + JSON.stringify(reason) + " " + JSON.stringify(caso || {})); await espera();
    const o = vivas.current[m.k];
    if (FALLA) return { error: "No se canceló " + o.production_number + ": sin conexión." };
    setM(null); aviso(o.production_number + " cancelada con su folio " + o.invoice_folio, "success"); };
  const alCancelarParte = async ({ reason, alCancelar }) => { anotar("cancelar-parte " + m.k + " " + m.parte + " " + JSON.stringify({ reason, alCancelar })); await espera();
    if (FALLA) throw new Error("No se canceló la parte: sin conexión.");
    const o = vivas.current[m.k], p = o.splits.find(x => x.id === m.parte), vivasP = o.splits.filter(x => !x.cancelled_at);
    // v10.84.76 — como App: si vuelve a quedar por facturar, el aviso a Karla (con la parte y el importe)
    if (alCancelar === "reabrir") anotar("aviso karla " + p.invoice_folio + " de " + o.production_number + ": $" + fmtMx(p.amount_portion) + " sin IVA vuelven a quedar por facturar · " + reason);
    aviso(vivasP.length === 1 && alCancelar === "perder" ? "Parte " + p.invoice_folio + " cancelada · era la única que quedaba: " + o.production_number + " se canceló"
      : alCancelar === "reabrir" ? "Parte " + p.invoice_folio + " cancelada · sus $" + fmtMx(p.amount_portion) + " vuelven a quedar por facturar"
      : "Parte " + p.invoice_folio + " cancelada · se dio por perdida: " + o.production_number + " queda facturada de menos");
    setM(null); };
  const alCancelarMatriz = async reason => { anotar("cancelar-matriz " + m.k + " " + JSON.stringify(reason)); await espera();
    if (FALLA) return { error: (m.k === "grupo" ? "No se canceló F-140" : "No se canceló la línea") + ": sin conexión." };
    aviso(m.k === "grupo" ? "F-140 cancelada (2 líneas)" : m.k === "lineaUltima" ? "Línea de P-0720 cancelada · era la última: F-141 se canceló" : "Línea de P-0720 cancelada · F-140 baja a lo que queda", "success"); setM(null); };
  const boton = (id, k, texto, extra = {}) => <button id={id} onClick={() => { anotar("abrir " + k); setM({ k, ...extra }); }} style={{ margin: 4 }}>{texto}</button>;
  const o = m && ordenes[m.k];
  const todas = Object.values(ordenes);
  return <div style={{ padding: 20, fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
      {boton("abrir-orden", "orden", "Cancelar orden (sin folio)")}
      {boton("abrir-corona", "corona", "Cancelar orden de Corona (saldo)")}
      {boton("abrir-facturada", "facturada", "Cancelar orden facturada por partes (Dirección)")}
      {boton("abrir-stock", "stock", "Cancelar orden con inventario")}
      {boton("abrir-cola", "cola", "Cancelar orden que corre en GTO")}
      {boton("abrir-archivo", "archivo", "Cancelar orden con archivo")}
      {boton("abrir-factura", "factura", "Cancelar con folio F-131")}
      {boton("abrir-remision", "remision", "Cancelar con remisión RS-1290")}
      {boton("abrir-anticipada", "anticipada", "Cancelar con folio anticipado F-136")}
      {boton("abrir-parte", "partes", "Cancelar la parte F-128 (quedan 2)", { parte: "s1" })}
      {boton("abrir-ultima", "ultima", "Cancelar la parte F-129 (la última)", { parte: "s3" })}
      {boton("abrir-linea", "linea", "Cancelar línea del plan matriz")}
      {boton("abrir-linea-ultima", "lineaUltima", "Cancelar la última línea de F-141")}
      {boton("abrir-grupo", "grupo", "Cancelar factura del plan matriz")}
      {boton("abrir-grupo-pagado", "grupoPagado", "Cancelar factura del plan (pagada)")}
      {boton("abrir-matriz", "matriz", "Cancelar orden del plan matriz (Dirección)")}
      {boton("abrir-ocfolio", "ocfolio", "Cancelar orden de OC con folio F-200 (Dirección)")}
      {boton("abrir-corriendo", "corriendo", "Cancelar con folio anticipado F-138 (corre en GTO)")}
    </div>
    <pre id="log" style={{ fontSize: 10, color: "#666", maxHeight: 120, overflow: "auto" }}>{log.join("\\n")}</pre>
    {m && !m.folio && ["orden", "corona", "facturada", "stock", "cola", "archivo", "matriz", "ocfolio"].includes(m.k) && <CancelOrderModal key={m.k} order={o} orders={todas} role={ROL} actor={ROL}
      folioDeLaOC={m.k === "ocfolio" ? "F-200" : null} onIrAConFolio={reason => { anotar("ir-a-folio " + m.k + " " + JSON.stringify(reason)); setM({ k: m.k, folio: true, motivo: reason }); }}
      onConfirm={alCancelarOrden} onClose={cerrar} />}
    {m && (m.folio || m.k === "factura" || m.k === "remision" || m.k === "anticipada" || m.k === "corriendo") && <CancelInvoicedModal key={m.k + (m.folio ? "-folio" : "")} order={o} orders={todas} actor="admin" motivoInicial={m.motivo} onConfirm={alCancelarFacturada} onClose={cerrar} />}
    {m && (m.k === "partes" || m.k === "ultima") && <CancelarParteModal key={m.k} order={o} parte={o.splits.find(x => x.id === m.parte)} onConfirm={alCancelarParte} onClose={cerrar} />}
    {m && m.k === "linea" && <MatrixCancelConfirmModal kind="line" line={GRUPO.lines[0]} group={GRUPO} order={ordenes.linea1} oc={OC} orders={todas} onConfirm={alCancelarMatriz} onClose={cerrar} />}
    {m && m.k === "lineaUltima" && <MatrixCancelConfirmModal kind="line" line={GRUPO_ULTIMO.lines[0]} group={GRUPO_ULTIMO} order={ordenes.linea1} oc={OC} orders={todas} onConfirm={alCancelarMatriz} onClose={cerrar} />}
    {m && m.k === "grupo" && <MatrixCancelConfirmModal kind="group" group={GRUPO} oc={OC} orders={todas} onConfirm={alCancelarMatriz} onClose={cerrar} />}
    {m && m.k === "grupoPagado" && <MatrixCancelConfirmModal kind="group" group={GRUPO_PAGADO} oc={OC} orders={todas} onConfirm={alCancelarMatriz} onClose={cerrar} />}
    {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco cancelar</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5191), strictPort: true } });
`, "utf8");
console.log("banco de cancelar listo en " + outDir + " (" + simuladosUsados.length + " simulados)");
