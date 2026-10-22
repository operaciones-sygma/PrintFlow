// Banco de la «VENTA DESDE INVENTARIO» (el carrito de `InventoryModal` → `BulkSellModal`) y del precio de cada producto del catálogo, EXTRAÍDO de App.jsx
// por extraer.mjs con lo que usa. v10.84.167 (Marcelo, 22-oct-2026: «me llamó la atención que PrintFlow infle el precio por dividirlos… podemos asustar al
// cliente»): el carrito pedía UN total y la base lo repartía por piezas; ahora cada producto lleva su precio. La base va simulada.
// Se anota en #log: «db <función> <json>», «aviso <texto>» (el showToast de App), «cerrar».
// Uso: node gen-venta-inventario.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=admin|karla|secretaria|produccion (karla) · falla=vender (la base rechaza la venta) · falla=precio (la base no guarda el
// precio) · falla=cambiado (alguien más cambió el producto mientras se editaba) · emisor=0 (el folio se teclea, como antes del 1-sep) · lento=1 (la
// venta y guardar el precio tardan 1.5 s: para el doble clic y Esc mientras trabaja) · nombres=raros (vuelta 2: nombres larguísimos, sin espacios, de una
// letra, con acentos, emoji y de derecha a izquierda, del catálogo de break-ui) · muchos=1000 (mil productos más en el catálogo)
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
const ROL = Q.get("rol") || "karla", FALLA = Q.get("falla") || "", EMISOR = Q.get("emisor") !== "0", LENTO = Q.get("lento") === "1";
const RAROS = Q.get("nombres") === "raros", MUCHOS = Number(Q.get("muchos") || 0);
const espera = ms => new Promise(r => setTimeout(r, ms));
const T = s => new Date(s).toISOString();
const POOL = "pool-cuadra";
// Como en producción (22-oct-2026): el apartado de Cuadra con sus tres razones sociales, el papel de china sin impresión por kilo (80 hojas/kg), el
// impreso, la etiqueta y el soporte con su precio de lista, y el cordón todavía sin precio.
let PRODUCTOS = [
  { id: "pb", name: "China blanco (relleno)", sku: "CHIN-BLA", stock_pool_id: POOL, client_id: null, unit_price: 40, stock_actual: 400000, active: true,
    specs: { sell_unit: "kg", units_per_kg: 80, nombre_factura: "PAPEL KRAFT PARA RELLENAR 25", nombre_factura_cliente: { "c-fac": "PAPEL KRAFT BLANCO PARA RELLENO" } }, updated_at: T("2026-10-20T10:00:00-06:00") },
  { id: "pi", name: "China impreso", sku: "CHIN-IMP", stock_pool_id: POOL, client_id: null, unit_price: 0.62, stock_actual: 20000, active: true,
    specs: { nombre_factura: "PAPEL ESTAMPADO CUADRA CHINA" }, updated_at: T("2026-10-20T10:00:00-06:00") },
  { id: "pe", name: "Etiqueta colgante", sku: "ETIQ-COLG", stock_pool_id: POOL, client_id: null, unit_price: 2.1, stock_actual: 50000, active: true,
    specs: { nombre_factura: "ETIQUETA CUADRA COLGANTE 25 CR" }, updated_at: T("2026-10-20T10:00:00-06:00") },
  { id: "ps", name: "Soporte 3-25 (grande)", sku: "SOP-3-25", stock_pool_id: POOL, client_id: null, unit_price: 3.41, stock_actual: 20000, active: true,
    specs: {}, updated_at: T("2026-10-20T10:00:00-06:00") },
  { id: "pc", name: "Cordón para Etiqueta", sku: "CORD-ETIQ", stock_pool_id: POOL, client_id: null, unit_price: null, stock_actual: 4000, active: true,
    specs: {}, updated_at: null },
];
if (RAROS) PRODUCTOS.push(
  { id: "pl", name: "Etiqueta colgante «Edición Navidad» — Niño & Señora 🎄 con cordón dorado extra largo para botas de piel", sku: "ETIQ-NAV-2026-ÑÑ", stock_pool_id: POOL, client_id: null, unit_price: 2.75, stock_actual: 3000, active: true,
    specs: { nombre_factura: "ETIQUETA COLGANTE EDICIÓN NAVIDAD NIÑO Y SEÑORA CON CORDÓN DORADO EXTRA LARGO PARA BOTAS DE PIEL MODELO 2026 TEMPORADA OTOÑO-INVIERNO 🎄" }, updated_at: T("2026-10-20T10:00:00-06:00") },
  { id: "pn", name: "ETIQUETAPARABOTASSINESPACIOSNINGUNOPARAPARTIRLAPALABRAENRENGLONESDELCATALOGO", sku: "SIN-ESP", stock_pool_id: POOL, client_id: null, unit_price: 1, stock_actual: 900, active: true,
    specs: { nombre_factura: "NOMBREENLAFACTURASINESPACIOSQUENOSEPUEDEPARTIRENNINGUNLADOPARAVERSIROMPELATARJETA" }, updated_at: T("2026-10-20T10:00:00-06:00") },
  { id: "px", name: "X", sku: null, stock_pool_id: POOL, client_id: null, unit_price: 0.5, stock_actual: 10, active: true, specs: {}, updated_at: T("2026-10-20T10:00:00-06:00") },
  { id: "pa", name: "ملصق عربي للأحذية", sku: "RTL-01", stock_pool_id: POOL, client_id: null, unit_price: 1.5, stock_actual: 500, active: true,
    specs: { nombre_factura: "ملصق عربي" }, updated_at: T("2026-10-20T10:00:00-06:00") });
for (let i = 1; i <= MUCHOS; i++) PRODUCTOS.push({ id: "m" + i, name: "Producto " + String(i).padStart(4, "0"), sku: "M-" + i, stock_pool_id: POOL, client_id: null,
  unit_price: Math.round(i * 37) / 100, stock_actual: 100 + i, active: true, specs: {}, updated_at: T("2026-10-20T10:00:00-06:00") });
const CLIENTES = [
  { id: "c-man", name: "MANUFACTURERA DE BOTAS CUADRA", stock_pool_id: POOL, pool_name: "Cuadra" },
  { id: "c-tie", name: "TIENDAS CUADRA", stock_pool_id: POOL, pool_name: "Cuadra" },
  { id: "c-fac", name: "FABRICA DE ALTA CALIDAD", stock_pool_id: POOL, pool_name: "Cuadra" },
];
const db = {
  loadClientProducts: async () => { await espera(40); anota("db loadClientProducts"); return PRODUCTOS.map(x => ({ ...x, specs: x.specs ? JSON.parse(JSON.stringify(x.specs)) : x.specs })); },
  loadStockMovements: async () => { await espera(40); return []; },
  loadSalidasDelApartado: async () => { await espera(40); return []; },
  loadCuadraOrdersHistory: async () => { await espera(40); return []; },
  deleteClientProduct: async id => { await espera(60); anota("db deleteClientProduct " + id); },
  saveClientProduct: async row => { await espera(60); anota("db saveClientProduct " + JSON.stringify(row)); PRODUCTOS.push({ id: "nuevo", stock_actual: 0, active: true, ...row }); },
  recordStockMovement: async m => { await espera(60); anota("db recordStockMovement " + m.kind + " " + m.qty); },
  getNextFolioSuggestion: async t => { await espera(30); return t === "factura" ? "F-300" : "RS-40"; },
  getFolioEmitterEnabled: async () => { await espera(30); return EMISOR; },
  bulkSellFromStock: async args => {
    await espera(LENTO ? 1500 : 150);
    anota("db bulkSellFromStock " + JSON.stringify({ items: args.items, total_amount: args.total_amount, invoice_type: args.invoice_type, dest_client_id: args.dest_client_id, folio: args.folio,
      payment_status: args.payment_status, pagos: (args.payment_refs || []).map(r => Number(r.amount)) }));
    if (FALLA === "vender") throw new Error("Stock insuficiente para Etiqueta colgante: 50 disponible vs 10000 requerido");
    return { oc_id: "OC-1234", folio: EMISOR ? (args.invoice_type === "factura" ? "F-300" : "RS-40") : args.folio, invoice_type: args.invoice_type, items_count: args.items.length, total_amount: args.total_amount };
  },
  guardarPrecioDeProducto: async (producto, cambios) => {
    await espera(LENTO ? 1500 : 80);
    anota("db guardarPrecioDeProducto " + producto.id + " " + JSON.stringify(cambios));
    if (FALLA === "precio") throw new Error("la base no contestó");
    // lo que dice db.guardarPrecioDeProducto cuando el updated_at ya no es el que se leyó
    if (FALLA === "cambiado") throw new Error("Alguien más cambió este producto mientras lo editabas: ciérralo y vuelve a abrirlo");
    PRODUCTOS = PRODUCTOS.map(p => p.id === producto.id ? { ...p, unit_price: cambios.unit_price, specs: cambios.specs, updated_at: new Date().toISOString() } : p);
  },
};
const supabase = { rpc: async (fn, a) => {
  await espera(30);
  if (fn === "list_stock_clients") return { data: CLIENTES, error: null };
  if (fn === "list_client_agents") return { data: [], error: null };
  if (fn === "get_client_seller_label") return { data: [{ username: "pepechuy", display_name: "Pepe Chuy" }], error: null };
  return { data: null, error: null };
} };`,
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
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco venta de inventario</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5492), strictPort: true } });
`, "utf8");
console.log("banco de la venta de inventario listo en " + outDir);
