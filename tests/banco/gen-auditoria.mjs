// Banco de «AUDITORÍA» (`AuditoriaView`: el consecutivo de folios fiscales —huecos, duplicados, compartidos— y el de órdenes P-; Dirección y Karla),
// EXTRAÍDO por extraer.mjs con lo que usa y montado con la línea de App (con el archivo completo cargado). Su /impeccable critique del 17-oct (v10.84.146).
// Las dos lecturas de CobranzaFlow se simulan: list_consecutive_cobranza_folios (la cartera: lo que no tiene orden, lo cancelado allá) y
// list_corona_oc_invoices (las OC a crédito de Corona).
// Lo que la vista pide a App se anota en #log: «oc <id>», «orden <id>», «rpc <nombre> <tipo>».
// Uso: node gen-auditoria.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=admin|karla · falla=cobranza (la cartera no contesta) · remalpha=1 (v10.84.151: dos remisiones de Alpha, R-1290 y R-1292, con
//   R-1291 faltante)
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
const { codigo, simuladosUsados } = extraer(fuente, ["AuditoriaView", "VIEW_MAXW", "bt"], { simulados: SIMULADOS });
const menuAncho = /width:sbPlegado\?(\d+):(\d+),flexShrink:0,height:"100vh"/.exec(fuente);
if (!menuAncho) throw new Error("no encuentro el ancho del menú lateral de App");
const contenedor = (L.find(x => x.includes('<div style={{boxSizing:"border-box",width:"100%",maxWidth:view==="board"')) || "").trim();
if (!contenedor) throw new Error("no encuentro el contenedor de las vistas de App");
const montaje = (L.find(x => x.includes('{view==="audit"&&')) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje de «Auditoría» en App (view===\"audit\")");
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
const ROL = Q.get("rol") || "admin", FALLA = Q.get("falla") || "";
// la cartera de CobranzaFlow: F-6 sin orden (pendiente), D-6191 cancelada en Alpha
const CARTERA = { factura: [
  { doc_number: "F-6", doc_type: "factura", issued_date: "2026-10-05", client_name: "SIN ORDEN SA", status: "pendiente", amount: 1160, balance: 1160, kind: "cartera" },
  { doc_number: "D-6191", doc_type: "factura", issued_date: "2026-08-20", client_name: "ALPHA CANCELADA", status: "cancelada", amount: 0, balance: 0, kind: "externa" },
], remision: [] };
const supabase = { rpc: async (nombre, args) => {
  anota("rpc " + nombre + " " + ((args && args.p_doc_type) || ""));
  if (nombre === "list_consecutive_cobranza_folios") { if (FALLA === "cobranza") return { data: null, error: { message: "sin red" } }; return { data: CARTERA[(args && args.p_doc_type) || "factura"] || [], error: null }; }
  if (nombre === "list_corona_oc_invoices") return { data: [], error: null };
  return { data: null, error: { message: "rpc no simulada: " + nombre } };
} };
const db = {};
const propsArchivoFirmado = () => ({});
const firmarOrderFile = async src => src;
function SignedImg({ alt, style }) { return <span style={style} aria-label={alt} />; }
const T = s => new Date(s).toISOString();
let n = 0;
const o = (pn, x = {}) => ({ id: "OP-" + pn, production_number: pn, client: "CLIENTE " + pn, product_type: "Volantes", quantity: 1000, stage: "delivered", priority: "normal",
  order_type: "interna", price: 1000, created_by: "secretaria", created_at: T("2026-10-01T09:00:00-06:00"), invoiced_by: "karla", ...x });
const fac = (pn, folio, dia, x = {}) => o(pn, { invoice_folio: folio, invoice_type: "factura", invoiced_at: T("2026-10-" + String(dia).padStart(2, "0") + "T12:00:00-06:00"), delivered_at: T("2026-10-" + String(dia).padStart(2, "0") + "T12:00:00-06:00"), ...x });
const rem = (pn, folio, dia, x = {}) => o(pn, { invoice_folio: folio, invoice_type: "remision", invoiced_at: T("2026-10-" + String(dia).padStart(2, "0") + "T12:00:00-06:00"), ...x });
const ORDENES = [
  // la serie propia F-: F-5 falta (hueco de verdad), F-6 sólo en la cartera, F-7 en dos órdenes sin OC (duplicado), F-8 compartido por la OC-0900, F-9 cancelada
  fac("P-0601", "F-1", 1, { client: "PRIMERA" }), fac("P-0602", "F-2", 2), fac("P-0604", "F-3", 3), fac("P-0605", "F-4", 4),
  fac("P-0606", "F-7", 7, { client: "DUPLICADA UNO" }), fac("P-0607", "F-7", 7, { client: "DUPLICADA DOS" }),
  fac("P-0608", "F-8", 8, { client: "OC COMPARTIDA", purchase_order_id: "OC-0900" }), fac("P-0609", "F-8", 8, { client: "OC COMPARTIDA", purchase_order_id: "OC-0900" }),
  fac("P-0610", "F-9", 9, { client: "CANCELADA CON SU FACTURA", stage: "cancelled", cancelled_at: T("2026-10-10T10:00:00-06:00"), nc_emitted: false }),
  // otra serie de facturas con un número que también existe en la F- (C-3): no es duplicado, cada serie tiene su consecutivo
  fac("P-0611", "C-3", 3, { client: "SERIE C" }),
  // Alpha (D-), con su número viejo H- (las de antes del corte se renumeraron): D-6191 está cancelada en la cartera
  o("H-0590", { invoice_folio: "D-6190", invoice_type: "factura", invoiced_at: T("2026-08-19T12:00:00-06:00"), client: "ALPHA UNO", created_at: T("2026-08-10T09:00:00-06:00") }),
  o("H-0592", { invoice_folio: "D-6192", invoice_type: "factura", invoiced_at: T("2026-08-21T12:00:00-06:00"), client: "ALPHA TRES", created_at: T("2026-08-10T09:00:00-06:00") }),
  // remisiones propias
  rem("P-0612", "RS-1", 1), rem("P-0613", "RS-2", 2), rem("P-0614", "RS-3", 3),
  // v10.84.151 — remisiones de Alpha (antes del corte), con un hueco: R-1291
  ...(Q.get("remalpha") === "1" ? [o("H-0593", { invoice_folio: "R-1290", invoice_type: "remision", invoiced_at: T("2026-08-19T12:00:00-06:00"), client: "ALPHA REMISION UNO", created_at: T("2026-08-10T09:00:00-06:00") }),
    o("H-0594", { invoice_folio: "R-1292", invoice_type: "remision", invoiced_at: T("2026-08-21T12:00:00-06:00"), client: "ALPHA REMISION TRES", created_at: T("2026-08-10T09:00:00-06:00") })] : []),
  // una sin folio (cuenta en la pestaña de órdenes); P-0603 no existe: hueco del consecutivo de órdenes
  o("P-0615", { stage: "ready", client: "SIN FOLIO TODAVIA" }),
];
const OCS = [{ id: "OC-0900", client: "OC COMPARTIDA", shared_invoice_folio: "F-8" }];`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const orders = ORDENES, purchaseOrders = OCS;
  const user = ROL, view = "audit", archiveLoaded = true;
  const loadArchive = () => anota("cargar-archivo");
  const setPendingOCNavId = id => anota("oc " + id), setView = v => anota("vista " + v), setDetailModalId = id => anota("orden " + id);
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
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco auditoria</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5487), strictPort: true } });
`, "utf8");
console.log("banco de auditoria listo en " + outDir);
