// Banco de la LISTA DE ÓRDENES DE COMPRA (`OrdenesCompraView`: Activas e Histórico, y el detalle de una OC), EXTRAÍDA de App.jsx por extraer.mjs con lo
// que usa, y montada con la línea de App que la monta (lo que App le pasa también se prueba). La critique del 16-oct.
// Se anota en #log: «accion <id> <acción>», «abrir-folio <OC>», «nueva-oc», «recargar», «aviso <texto>».
// Uso: node gen-oc-lista.mjs <App.jsx> <dirSalida>   (gen-oc.mjs es otro: el banco del folio de la OC)
// Variantes por URL: rol=karla|admin|secretaria (karla) · lectura=no (todavía no se ha leído nada de la base) · caso=vacio (ninguna OC de varios productos)
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo } = extraer(fuente, ["OrdenesCompraView", "VIEW_MAXW"], { simulados: ["supabase", "db"] });
const montaje = (L.find(x => x.includes('{view==="oc"&&') && x.includes("<OrdenesCompraView")) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje de OrdenesCompraView en App");
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
const Q = new URLSearchParams(location.search);
const ROL = Q.get("rol") || "karla", SIN_LECTURA = Q.get("lectura") === "no", CASO = Q.get("caso") || "";
const T = s => new Date(s).toISOString();
const oc = (id, x = {}) => ({ id, client: "CLIENTE " + id, status: "open", is_simple_oc: false, is_web_oc: false, total: 0, created_at: T("2026-10-14T10:00:00-06:00"), ...x });
const OCS = SIN_LECTURA ? [] : CASO === "vacio" ? [oc("OC-0990", { is_simple_oc: true, client: "UNA SOLA ORDEN SA", status: "in_progress" })] : [
  oc("OC-0970", { client: "HOTSSON", total: 132355.87, delivery_date: "2026-10-25" }),
  oc("OC-0971", { client: "PORTLAND", status: "in_progress", shared_invoice_folio: "F-210", total: 45000 }),
  oc("OC-0972", { client: "CASTORES", status: "in_progress", folios_locked: true, total: 18000 }),
  oc("OC-0950", { client: "COSMOS", status: "completed", completed_at: T("2026-10-02T12:00:00-06:00"), completed_by: "karla", total: 9000 }),
  oc("OC-0951", { client: "CABLESERV", status: "cancelled", cancelled_at: T("2026-10-05T12:00:00-06:00"), cancelled_by: "karla", cancellation_reason: "El cliente canceló el pedido" }),
  oc("OC-0990", { is_simple_oc: true, client: "UNA SOLA ORDEN SA", status: "in_progress" }),
];
const o = (pn, ocId, x = {}) => ({ id: "OP-" + pn, production_number: pn, purchase_order_id: ocId, client: "CLIENTE", product_type: "Volantes", quantity: 1000, stage: "ready", price: 1000, priority: "normal", order_type: "interna", created_at: T("2026-10-12T10:00:00-06:00"), timeline: [], comments: [], notes_log: [], ...x });
const ORDENES = SIN_LECTURA ? [] : [
  o("P-0670", "OC-0970", { client: "HOTSSON", client_agent: "Laura Pérez" }), o("P-0671", "OC-0970", { client: "HOTSSON" }),
  o("P-0672", "OC-0971", { client: "PORTLAND", invoice_folio: "F-210", stage: "delivered" }), o("P-0673", "OC-0971", { client: "PORTLAND", invoice_folio: "F-210", stage: "delivered" }),
  o("P-0674", "OC-0972", { client: "CASTORES" }), o("P-0675", "OC-0972", { client: "CASTORES" }),
  o("P-0660", "OC-0950", { client: "COSMOS", invoice_folio: "F-190", stage: "delivered" }), o("P-0661", "OC-0951", { client: "CABLESERV", stage: "cancelled" }),
  o("P-0690", "OC-0990", { client: "UNA SOLA ORDEN SA" }),
];
const db = { listLinkableInvoicesForOC: async () => [], ocSharedFolioIsCancelled: async () => false };
const supabase = { rpc: async () => ({ data: null, error: null }), from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }) }) }) };`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const view = "oc", user = ROL, userLogin = ({ karla: "karla", admin: "marcelo", secretaria: "lupita" })[ROL] || ROL, orderFilter = null;
  const purchaseOrders = OCS, orders = ORDENES;
  const lectura = SIN_LECTURA ? { ok: null, fallo: Date.now() } : { ok: Date.now(), fallo: null };
  const [pendingOCNavId, setPendingOCNavId] = useState(null);
  const handleAction = (id, a) => anota("accion " + id + " " + a), reload = () => anota("recargar"), showToast = t => anota("aviso " + t);
  const jalarASalidas = x => anota("jalar " + (x?.id || "")), createOC = () => anota("nueva-oc"), addProductToOC = () => anota("agregar"), addExistingToOC = () => anota("agregar-existente");
  const setFolioOCModal = x => anota("abrir-folio " + (x?.oc?.id || "")), setOcMatrixModal = x => anota("plan " + (x?.oc?.id || "")), setMatrixCancelModal = () => anota("cancelar-plan");
  return <div style={{ background: C.canvas, minHeight: "100vh", fontFamily: "'Geist',sans-serif" }}>
    <div id="barra" style={{ height: 57, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderBottom: "0.5px solid #ddd", background: C.bg }}>
      <input id="atras-buscar" placeholder="Buscar orden..." />
    </div>
    <div style={{ padding: 20 }}>
      ${montaje}
    </div>
    <pre id="log" style={{ fontSize: 10, color: "#666", marginTop: 40 }}></pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco OC</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5175), strictPort: true } });
`, "utf8");
console.log("banco de la lista de OC listo en " + outDir);
