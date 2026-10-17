// Banco de «ARCHIVO» (`Archive`: las órdenes entregadas y canceladas por año → mes → semana, con su ingreso; todos los roles), EXTRAÍDO por extraer.mjs
// con lo que usa y montado con la línea de App que lo monta (con el archivo completo ya cargado). Su /impeccable critique del 17-oct (v10.84.145).
// Lo que la vista pide a App se anota en #log: «accion <id> <acción>», «cargar-archivo».
// Uso: node gen-archivo.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=admin|vendedor|produccion|secretaria · caso=vacio (se leyó y no hay entregadas) · archivo=no (todavía sin cargar)
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
const { codigo, simuladosUsados } = extraer(fuente, ["Archive", "VIEW_MAXW", "bt"], { simulados: SIMULADOS });
const menuAncho = /width:sbPlegado\?(\d+):(\d+),flexShrink:0,height:"100vh"/.exec(fuente);
if (!menuAncho) throw new Error("no encuentro el ancho del menú lateral de App");
const contenedor = (L.find(x => x.includes('<div style={{boxSizing:"border-box",width:"100%",maxWidth:view==="board"')) || "").trim();
if (!contenedor) throw new Error("no encuentro el contenedor de las vistas de App");
const montaje = (L.find(x => x.includes('{view==="archive"&&')) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje del «Archivo» en App (view===\"archive\")");
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
const db = {}, supabase = {};
const propsArchivoFirmado = () => ({});
const firmarOrderFile = async src => src;
function SignedImg({ alt, style }) { return <span style={style} aria-label={alt} />; }
const Q = new URLSearchParams(location.search);
const ROL = Q.get("rol") || "admin", LOGIN = { admin: "marcelo", vendedor: "genaro", produccion: "gerardo", secretaria: "secretaria" }[ROL] || ROL;
const CASO = Q.get("caso") || "", SIN_ARCHIVO = Q.get("archivo") === "no";
const T = s => new Date(s).toISOString();
const o = (pn, x = {}) => ({ id: "OP-" + pn, production_number: pn, client: "CLIENTE " + pn, product_type: "Volantes", product: "VOLANTES", quantity: 1000, stage: "delivered",
  priority: "normal", order_type: "interna", price: 1000, created_by: "secretaria", agent: "Manuel", created_at: T("2026-10-01T09:00:00-06:00"), ...x });
const ORDENES_TODAS = [
  // octubre 2026: dos de Genaro (una la capturó Lupita: él es el vendedor), una de Manuel
  o("P-0901", { client: "DE GENARO POR LUPITA", price: 10000, agent: "Genaro", created_by: "secretaria", delivered_at: T("2026-10-14T12:00:00-06:00"), invoice_folio: "F-150", invoice_type: "factura" }),
  o("P-0902", { client: "DE GENARO", price: 5000, agent: "Genaro", created_by: "genaro", delivered_at: T("2026-10-15T12:00:00-06:00"), invoice_folio: "RS-40", invoice_type: "remision" }),
  o("P-0903", { client: "DE MANUEL", price: 2000, delivered_at: T("2026-10-06T12:00:00-06:00") }),
  // capturada en septiembre, CANCELADA el 13 de octubre, con su factura (la nota de crédito pendiente) y editada después de facturar
  o("P-0904", { client: "CANCELADA EN OCTUBRE", stage: "cancelled", price: 4000, created_at: T("2026-09-20T09:00:00-06:00"), cancelled_at: T("2026-10-13T10:00:00-06:00"),
    invoice_folio: "F-100", invoice_type: "factura", nc_emitted: false, has_post_invoice_edits: true, cancellation_reason: "El cliente ya no lo quiso" }),
  // septiembre: una maquila urgente
  o("P-0905", { client: "MAQUILA URGENTE", order_type: "maquila", price: 0, maq_price: 3000, maq_cost: 1800, priority: "urgente", stage: "maq_delivered", delivered_at: T("2026-09-25T12:00:00-06:00") }),
  // el año pasado
  o("P-0906", { client: "DEL ANIO PASADO", price: 1000, delivered_at: T("2025-12-10T12:00:00-06:00"), created_at: T("2025-12-01T09:00:00-06:00") }),
  // y una activa (no es del archivo)
  o("P-0907", { client: "TODAVIA ACTIVA", stage: "ready" }),
];
// caso=bordes: entregada el 30-sep a las 23:30 de México (en UTC ya es 1-oct) y una el domingo 31 de mayo (una semana de un solo día)
const BORDES = [
  o("P-0908", { client: "A LAS 23:30 DEL 30 DE SEPTIEMBRE", price: 700, delivered_at: T("2026-09-30T23:30:00-06:00") }),
  o("P-0909", { client: "EL DOMINGO 31 DE MAYO", price: 900, delivered_at: T("2026-05-31T12:00:00-06:00") }),
];
const ORDENES = CASO === "vacio" ? ORDENES_TODAS.filter(x => x.stage === "ready") : CASO === "bordes" ? [...ORDENES_TODAS, ...BORDES] : ORDENES_TODAS;`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [orders] = useState(ORDENES);
  const user = ROL, userLogin = LOGIN, view = "archive", search = "", archiveLoaded = !SIN_ARCHIVO;
  const filteredOrders = orders;
  const loadArchive = () => anota("cargar-archivo");
  const handleAction = (id, accion) => anota("accion " + id + " " + accion);
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
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco archivo</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5486), strictPort: true } });
`, "utf8");
console.log("banco del archivo listo en " + outDir);
