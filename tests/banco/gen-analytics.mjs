// Banco de Analytics EXTRAÍDO de un App.jsx (con extraer.mjs: lo que Analytics necesita, sin lista a mano), con órdenes de fechas fijas.
// La prueba fija el reloj del navegador (13-oct-2026 12:00, hora de México) y su zona horaria (America/Mexico_City): así las cifras se
// pueden comprobar contra cuentas hechas a mano (v10.84.84, los P1 de la critique de Analytics: qué cuenta cada cifra y de qué periodo).
// Uso: node gen-analytics.mjs <App.jsx> <dirSalida>
// Variantes por URL (modo=): normal · vacio (ninguna orden) · sinmaquinas (nadie ha registrado máquina) · sintipo (una entregada sin tipo) · muchas (25 etiquetas más en octubre)
// window.__agregarEntrega(): llega una entrega de hoy ($1,000, Etiquetas), como la manda el realtime con la pantalla abierta.
import fs from "node:fs";
import path from "node:path";
import { extraer } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo, simuladosUsados } = extraer(fuente, ["Analytics"], { simulados: ["supabase"] });
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  `// ── lo que toca la base o Storage, simulado (${simuladosUsados.join(", ")}) ──
const Q = new URLSearchParams(location.search);
const M = new Set((Q.get("modo") || "normal").split(","));
const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.open = u => { anota("open: " + u); return null; };
const supabase = {
  rpc: async fn => { anota("rpc: " + fn); return { data: [], error: null }; },
  storage: { from: () => ({ remove: async ps => ({ data: ps.map(p => ({ name: p })), error: null }),
    createSignedUrl: async p => ({ data: { signedUrl: "https://firmado.test/" + p }, error: null }),
    createSignedUrls: async ps => ({ data: ps.map(p => ({ path: p, error: null, signedUrl: "https://firmado.test/" + p })), error: null }) }) },
  from: t => ({ update: v => ({ eq: async () => { anota("update: " + t + " " + JSON.stringify(v)); return { error: null }; } }) }),
};
// Las órdenes (hora de México, -06:00). Las cuentas que las pruebas esperan están en tests/romper/analytics.mjs.
const ORDEN = (id, pn, o) => ({ id, production_number: pn, client: "CLIENTE", product_type: "Etiquetas", order_type: "internal", price: 0,
  stage: "delivered", created_at: "2026-09-01T10:00:00-06:00", delivered_at: null, due_date: null, machine_log: [], waste_log: [],
  timeline: [], comments: [], ...o });
const SIN_MAQ = M.has("sinmaquinas");
const ml = (machine, started, minutes) => SIN_MAQ ? [] : [{ machine, started, ended: started, minutes }];
const TODAS = [
  // entregadas del 1 al 13 de octubre: $28,000 (interna $20,000; maquila $8,000 con costo $5,000)
  ORDEN("oA", "P-0101", { client: "CERVECERIA MODELO", product_type: "Etiquetas", price: 10000, created_at: "2026-09-20T10:00:00-06:00",
    delivered_at: "2026-10-05T12:00:00-06:00", due_date: "2026-10-06",
    machine_log: [...ml("off_pm52", "2026-10-03T09:00:00-06:00", 120), ...ml("vm_manual", "2026-10-04T09:00:00-06:00", 600)] }),
  ORDEN("oB", "P-0102", { client: "Cervecería Modelo ", product_type: "ETIQUETAS", price: 5000, created_at: "2026-10-01T09:00:00-06:00",
    delivered_at: "2026-10-10T12:00:00-06:00", due_date: "2026-10-08", machine_log: ml("off_pm74", "2026-10-09T09:00:00-06:00", 60) }),
  ORDEN("oC", "P-0103", { client: "GOBIERNO DEL ESTADO", product_type: "Libros", order_type: "maquila", stage: "maq_delivered", maq_price: 8000,
    maq_cost: 5000, created_at: "2026-10-02T09:00:00-06:00", delivered_at: "2026-10-12T23:30:00-06:00", due_date: "2026-10-15" }),
  ORDEN("oS", "P-0104", { client: "CUADRA", product_type: "stock", price: 3000, created_at: "2026-10-02T09:00:00-06:00",
    delivered_at: "2026-10-02T13:00:00-06:00" }),
  ORDEN("oT", "P-0105", { client: "CAJA POPULAR", product_type: "🔴 ATRASADA · FOLLETO AHORRO", price: 2000, created_at: "2024-01-01T09:00:00-06:00",
    delivered_at: "2026-10-03T12:00:00-06:00" }),
  // septiembre: $30,000; del 1 al 13: sólo $6,000. P-0090 se entregó a las 19:00 del 30 (en UTC ya es 1 de octubre)
  ORDEN("oD", "P-0090", { client: "IMPRENTA SUR", product_type: "Folletos", price: 4000, created_at: "2026-09-15T09:00:00-06:00",
    delivered_at: "2026-09-30T19:00:00-06:00", due_date: "2026-09-30" }),
  ORDEN("oE", "P-0091", { client: "CERVECERIA MODELO", product_type: "Etiquetas", price: 6000, created_at: "2026-09-01T09:00:00-06:00",
    delivered_at: "2026-09-05T12:00:00-06:00", due_date: "2026-09-10" }),
  ORDEN("oF", "P-0092", { client: "FARMACIAS", product_type: "POP", price: 20000, created_at: "2026-09-10T09:00:00-06:00",
    delivered_at: "2026-09-20T12:00:00-06:00", due_date: "2026-09-18" }),
  // agosto: seis tipos chicos de $500 (con «Todo» hay 12 tipos: 8 y «Otros»)
  ...["Calendarios", "Libretas", "Cajas", "Volantes", "Gafetes", "Sellos"].map((t, i) => ORDEN("oK" + i, "P-008" + i, { client: "VARIOS " + i,
    product_type: t, price: 500, created_at: "2026-08-01T09:00:00-06:00", delivered_at: "2026-08-1" + i + "T12:00:00-06:00" })),
  // junio: el primer registro de máquina
  ORDEN("oG", "P-0050", { client: "CERVECERIA MODELO", product_type: "Etiquetas", price: 7000, created_at: "2026-06-01T09:00:00-06:00",
    delivered_at: "2026-06-15T12:00:00-06:00", due_date: "2026-06-20", machine_log: ml("off_pm52", "2026-06-10T09:00:00-06:00", 300) }),
  // mayo: la primera entrega, de una orden importada de 2024
  ORDEN("oH", "H-0001", { client: "HISTORICO", product_type: "Etiquetas", price: 1000, created_at: "2024-01-01T09:00:00-06:00",
    delivered_at: "2026-05-20T12:00:00-06:00" }),
  // NO cuentan como ingreso: una cancelada y una en producción, con precio (y la de producción con su máquina corriendo)
  ORDEN("oX", "P-0110", { client: "CERVECERIA MODELO", product_type: "Etiquetas", price: 50000, stage: "cancelled", created_at: "2026-10-04T09:00:00-06:00" }),
  ORDEN("oY", "P-0111", { client: "FARMACIAS", product_type: "POP", price: 30000, stage: "in_production", created_at: "2026-10-06T09:00:00-06:00",
    machine_log: SIN_MAQ ? [] : [{ machine: "off_pm52", started: "2026-10-07T09:00:00-06:00", ended: null, minutes: null }] }),
];
// muchas: 25 etiquetas más entregadas en octubre (el renglón enseña 20 y «y 5 más»), una con un cliente de nombre larguísimo
if (M.has("muchas")) for (let i = 0; i < 25; i++) TODAS.push(ORDEN("oM" + i, "P-02" + String(i).padStart(2, "0"), { client: i === 0 ? "CLIENTE CON UN NOMBRE MUY PERO MUY LARGO QUE NO CABE EN EL RENGLÓN DE LA LISTA, SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE" : "VARIOS M" + i,
  product_type: "Etiquetas", price: i === 0 ? 9000 : 100 + i, created_at: "2026-10-01T09:00:00-06:00", delivered_at: "2026-10-0" + (1 + (i % 9)) + "T12:00:00-06:00" }));
if (M.has("sintipo")) TODAS.push(ORDEN("oN", "P-0106", { client: "SIN NOMBRE", product_type: "", price: 1500, created_at: "2026-10-05T09:00:00-06:00", delivered_at: "2026-10-06T12:00:00-06:00" }));
const ORDERS = M.has("vacio") ? [] : TODAS;`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [ordenes, setOrdenes] = useState(ORDERS);
  window.__agregarEntrega = () => setOrdenes(os => [...os, ORDEN("oZ", "P-0199", { client: "CERVECERIA MODELO", product_type: "Etiquetas", price: 1000,
    created_at: "2026-10-13T09:00:00-06:00", delivered_at: "2026-10-13T11:00:00-06:00" })]);
  return <div style={{ padding: 20, fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    <Analytics orders={ordenes} onReload={() => anota("reload")} />
    <pre id="log"></pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco analytics</title>
<link rel="icon" href="data:,">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5191), strictPort: true } });
`, "utf8");
console.log("banco de analytics listo en " + outDir);
