// Banco de la vista «CANCELACIONES» (`CancelacionesView`: cancelar en lote y el historial; Dirección, Lupita y Karla), EXTRAÍDA por extraer.mjs con lo
// que usa y montada con la línea de App que la monta. Su /impeccable critique del 17-oct en la madrugada (v10.84.144). La tanda `cancelaciones` es otra:
// prueba con Node la parte de la base (src/lib/cancelarEnLote.js); ésta, la pantalla.
// Lo que la vista pide a App se anota en #log: «cancelar <ids> · <motivo>», «detalle <id>», «rpc <nombre>».
// Uso: node gen-cancelaciones-vista.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=admin|secretaria|karla · falla=saldo (la lectura del saldo a favor no contesta) · falla=una (la base rechaza la primera del lote) ·
//   lento=saldo (la lectura del saldo tarda 1.5 s) · lento=colgado (nunca contesta) · lento=tarde (contesta a los 9.5 s)
// Gancho: window.__cambiar(id, campos) cambia una orden con la vista abierta (el tiempo real).
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const SIMULADOS = ["supabase", "db", "SignedImg", "firmarOrderFile", "propsArchivoFirmado", "useSignedFile", "abrirArchivoFirmado"];
const { codigo, simuladosUsados } = extraer(fuente, ["CancelacionesView", "VIEW_MAXW"], { simulados: SIMULADOS });
const menuAncho = /width:sbPlegado\?(\d+):(\d+),flexShrink:0,height:"100vh"/.exec(fuente);
if (!menuAncho) throw new Error("no encuentro el ancho del menú lateral de App");
const contenedor = (L.find(x => x.includes('<div style={{boxSizing:"border-box",width:"100%",maxWidth:view==="board"')) || "").trim();
if (!contenedor) throw new Error("no encuentro el contenedor de las vistas de App");
const montaje = (L.find(x => x.includes('{view==="cancelaciones"&&')) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje de «Cancelaciones» en App (view===\"cancelaciones\")");
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `// ── lo que toca la base o Storage, simulado (${simuladosUsados.join(", ")}) ──
const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.slice(-60).join("\\n"); };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
const Q = new URLSearchParams(location.search);
const ROL = Q.get("rol") || "admin", LOGIN = { admin: "marcelo", secretaria: "secretaria", karla: "karla" }[ROL] || ROL;
const FALLA = Q.get("falla") || "", LENTO = Q.get("lento") || "";
// lo que la base dice del saldo a favor que consumió cada orden (ordenes_saldo_consumido: TABLE(order_id, monto))
const SALDO = { "OP-P-0803": 2500 };
const supabase = { rpc: async (nombre, args) => {
  anota("rpc " + nombre);
  if (nombre === "ordenes_saldo_consumido") {
    if (LENTO === "saldo") await new Promise(r => setTimeout(r, 1500));
    if (LENTO === "colgado") await new Promise(() => {});   // nunca contesta
    if (LENTO === "tarde") await new Promise(r => setTimeout(r, 9500));   // contesta pasado el tope de 8 s
    if (FALLA === "saldo") return { data: null, error: { message: "sin red" } };
    const ids = (args && args.p_order_ids) || [];
    return { data: ids.filter(id => SALDO[id]).map(id => ({ order_id: id, monto: SALDO[id] })), error: null };
  }
  return { data: null, error: { message: "rpc no simulada: " + nombre } };
} };
const db = {};
const propsArchivoFirmado = () => ({});
const firmarOrderFile = async src => src;
function SignedImg({ alt, style }) { return <span style={style} aria-label={alt} />; }
const T = s => new Date(s).toISOString();
const o = (pn, x = {}) => ({ id: "OP-" + pn, production_number: pn, client: "CLIENTE " + pn, product_type: "Volantes", product: "VOLANTES", quantity: 1000, stage: "ready",
  priority: "normal", order_type: "interna", price: 1000, created_by: "secretaria", agent: "Genaro", created_at: T("2026-10-10T09:00:00-06:00"), due_date: "2026-10-28", ...x });
const ORDENES = [
  o("P-0801", { client: "EN LA FILA", stage: "in_production", current_machine: "off_pm74", machine_queue_position: 1, price: 3000, created_at: T("2026-10-15T09:00:00-06:00") }),
  o("P-0802", { client: "FACTURADA SA", stage: "delivered", invoice_folio: "F-120", invoice_type: "factura", price: 5000, delivered_at: T("2026-10-14T12:00:00-06:00"), created_at: T("2026-10-14T09:00:00-06:00") }),
  o("P-0803", { client: "CORONA SA", stage: "salidas", price: 2500, created_at: T("2026-10-13T09:00:00-06:00") }),
  o("P-0804", { client: "SOLO CAPTURADA", stage: "draft", created_at: T("2026-10-12T09:00:00-06:00") }),
  o("P-0805", { client: "POR PARTES", stage: "delivered", has_splits: true, price: 2000, created_at: T("2026-10-11T09:00:00-06:00"),
    splits: [{ id: "s1", position: 1, invoice_folio: "F-121", doc_type: "factura", amount_portion: 1000, qty_portion: 500, cancelled_at: null }, { id: "s2", position: 2, invoice_folio: "F-122", doc_type: "factura", amount_portion: 1000, qty_portion: 500, cancelled_at: null }] }),
  o("P-0806", { client: "EN EL PLAN DE SU OC", stage: "salidas", oc_invoice_group_id: "g-1", purchase_order_id: "OC-0900", created_at: T("2026-10-10T08:00:00-06:00") }),
  o("P-0807", { client: "AGRUPADA", stage: "delivered", grouped_invoice_folio: "F-130", created_at: T("2026-10-09T09:00:00-06:00") }),
  // el historial
  o("P-0790", { client: "CANCELADA CON FOLIO", stage: "cancelled", invoice_folio: "F-100", invoice_type: "factura", nc_emitted: false, cancelled_at: T("2026-10-10T10:00:00-06:00"), cancelled_by: "karla", cancellation_reason: "El cliente ya no lo quiere" }),
  o("P-0791", { client: "CANCELADA SIN FOLIO", stage: "cancelled", cancelled_at: T("2026-10-08T10:00:00-06:00"), cancelled_by: "marcelo", cancellation_reason: "Capturada dos veces" }),
];`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [orders, setOrders] = useState(ORDENES);
  useEffect(() => { window.__cambiar = (id, x) => { anota("cambiada " + id); setOrders(p => p.map(y => y.id === id ? { ...y, ...x } : y)); }; }, []);
  const user = ROL, view = "cancelaciones", archiveLoaded = true;
  const loadArchive = () => anota("cargar-archivo");
  const setDetailModalId = id => anota("detalle " + id);
  // lo que hace App (doCancelOrders): cancela cada una en la base y devuelve las que fallaron (para dejarlas seleccionadas)
  const doCancelOrders = async (ids, reason) => {
    anota("cancelar " + ids.join(",") + " · " + reason);
    await new Promise(r => setTimeout(r, 300));
    const fallan = FALLA === "una" ? [ids[0]] : [];
    setOrders(p => p.map(x => ids.includes(x.id) && !fallan.includes(x.id) ? { ...x, stage: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason, cancelled_by: LOGIN } : x));
    return fallan;
  };
  return <div style={{ display: "flex", background: C.canvas, minHeight: "100vh" }}>
    <div id="lateral" style={{ width: ${menuAncho[2]}, flexShrink: 0, height: "100vh", borderRight: "0.5px solid #ddd" }} />
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div id="barra" style={{ height: 57, flexShrink: 0, borderBottom: "0.5px solid #ddd" }} />
      ${contenedor}
        ${montaje}
        <pre id="log" style={{ fontSize: 10, color: "#666" }}></pre>
      </div>
    </div>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco cancelaciones</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5485), strictPort: true } });
`, "utf8");
console.log("banco de cancelaciones listo en " + outDir);
