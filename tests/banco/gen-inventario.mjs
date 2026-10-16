// Banco del «INVENTARIO CUADRA» (`InventoryModal`: el catálogo de productos a stock, sus movimientos y el historial de órdenes Cuadra), EXTRAÍDO de
// App.jsx por extraer.mjs con lo que usa. La critique del 16-oct. La base va simulada y cada lectura puede fallar por su lado.
// Se anota en #log: «db <función> <dato>», «aviso <texto>» (el showToast de App), «cerrar».
// Uso: node gen-inventario.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=admin|karla|secretaria|produccion (admin) · falla=productos|movimientos|historial|clientes (siempre) o productos-una (sólo la
// primera lectura; también movimientos-una…) o quitar (la base no quita del catálogo) · caso=vacio (catálogo sin productos de verdad)
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo } = extraer(fuente, ["InventoryModal"], { simulados: ["supabase", "db"] });
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
const ROL = Q.get("rol") || "admin", FALLA = Q.get("falla") || "", CASO = Q.get("caso") || "";
const lecturas = {};
// ¿falla esta lectura? «productos» siempre; «productos-una» sólo la primera vez
const falla = que => { lecturas[que] = (lecturas[que] || 0) + 1; return FALLA === que || (FALLA === que + "-una" && lecturas[que] === 1); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const T = s => new Date(s).toISOString();
let PRODUCTOS = CASO === "vacio" ? [] : [
  { id: "p1", name: "Volante Cuadra carta", client_id: "c1", sku: "VOL-CTA", unit_price: 2.5, stock_actual: 1500, active: true },
  { id: "p2", name: "Díptico corporativo", client_id: "c2", stock_pool_id: "pool1", sku: "DIP-01", unit_price: 8, stock_actual: 0, active: true },
  { id: "p3", name: "Etiqueta de caja", client_id: "c1", sku: "ETQ-9", unit_price: 1.2, stock_actual: -20, active: true },
];
const MOVS = CASO === "vacio" ? [] : [
  { id: "m1", client_product_id: "p1", kind: "SOLD", qty: -200, balance_after: 1300, notes: "Venta F-201", created_at: T("2026-10-14T10:00:00-06:00"), created_by: "karla" },
  { id: "m2", client_product_id: "p1", kind: "ADJUST", qty: 50, balance_after: 1500, notes: "Conteo físico", created_at: T("2026-10-14T12:00:00-06:00"), created_by: "gerardo" },
  { id: "m3", client_product_id: "p3", kind: "PRODUCED", qty: 1000, balance_after: 980, notes: null, created_at: T("2026-10-13T09:00:00-06:00"), created_by: "gerardo" },
];
const HIST = CASO === "vacio" ? [] : [
  { id: "OP-P-0660", production_number: "P-0660", client: "CUADRA SA", client_id: "c1", product: "Volante Cuadra carta", quantity: 1000, price: 2500, stage: "stocked", stock_role: "production", stock_loaded: true, client_product_id: "p1", created_at: T("2026-10-10T10:00:00-06:00") },
  { id: "OP-V-1", production_number: null, client: "CUADRA LEÓN", client_id: "c2", product: "Volante Cuadra carta", quantity: 200, price: 500, stage: "delivered", stock_role: "sale", client_product_id: "p1", invoice_folio: "F-201", invoice_type: "factura", invoiced_by: "karla", created_at: T("2026-10-14T10:00:00-06:00") },
];
const CLIENTES = [{ id: "c1", name: "CUADRA SA" }, { id: "c2", name: "CUADRA LEÓN", stock_pool_id: "pool1", pool_name: "Grupo Cuadra" }];
const db = {
  loadClientProducts: async () => { await espera(60); if (falla("productos")) throw new Error("loadClientProducts: la base no contestó"); anota("db loadClientProducts"); return PRODUCTOS.map(x => ({ ...x })); },
  loadStockMovements: async () => { await espera(60); if (falla("movimientos")) throw new Error("loadStockMovements: la base no contestó"); return MOVS.map(x => ({ ...x })); },
  loadCuadraOrdersHistory: async () => { await espera(60); if (falla("historial")) throw new Error("loadCuadraOrdersHistory: la base no contestó"); return HIST.map(x => ({ ...x })); },
  deleteClientProduct: async id => { await espera(150); if (FALLA === "quitar") { anota("db deleteClientProduct " + id + " FALLÓ"); throw new Error("deleteClientProduct: la base no contestó"); } anota("db deleteClientProduct " + id); PRODUCTOS = PRODUCTOS.filter(p => p.id !== id); },
  saveClientProduct: async () => { await espera(60); anota("db saveClientProduct"); },
  recordStockMovement: async m => { await espera(60); anota("db recordStockMovement " + m.kind + " " + m.qty); },
};
const supabase = { rpc: async fn => { await espera(40); if (fn === "list_stock_clients") return falla("clientes") ? { data: null, error: { message: "la base no contestó" } } : { data: CLIENTES, error: null }; return { data: null, error: null }; } };`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [abierto, setAbierto] = useState(true);
  const user = ROL, userLogin = ({ admin: "marcelo", karla: "karla", secretaria: "lupita", produccion: "gerardo" })[ROL] || ROL;
  const showToast = (t, tipo) => anota("aviso " + (tipo ? "(" + tipo + ") " : "") + t);
  return <div style={{ background: C.canvas, minHeight: "100vh", fontFamily: "'Geist',sans-serif" }}>
    <div id="barra" style={{ height: 57, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderBottom: "0.5px solid #ddd", background: C.bg }}>
      <button id="atras-abrir" onClick={() => setAbierto(true)}>Abrir el inventario</button>
      <input id="atras-buscar" placeholder="Buscar orden..." />
    </div>
    {abierto && <InventoryModal user={user} userLogin={userLogin} clients={[]} showToast={showToast} onOpenInvoice={o => anota("factura " + (o?.id || ""))} onClose={() => { anota("cerrar"); setAbierto(false); }} />}
    <pre id="log" style={{ fontSize: 10, color: "#666", marginTop: 40 }}></pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco inventario</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5177), strictPort: true } });
`, "utf8");
console.log("banco del inventario listo en " + outDir);
