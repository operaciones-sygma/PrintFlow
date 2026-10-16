// Banco de «TODAS» (la lista de todas las órdenes, `view==="orders"` en App: la usan todos los roles para buscar y revisar), con la ficha (OCard) y lo
// que usa, EXTRAÍDOS de App.jsx por extraer.mjs y montados con la línea de App que monta la vista (lo que App le pasa también se prueba). La critique
// del 16-oct. 1002 órdenes como en producción (47 activas, 945 entregadas, 10 canceladas); el reloj fijo lo pone la tanda.
// Lo que la vista pide a App se anota en #log: «accion <id> <acción>», «buscar <texto>», «nueva».
// Uso: node gen-todas.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=secretaria|karla|produccion|admin|vendedor · lectura=no (todavía no se ha leído nada de la base) · buscar=<texto> (el buscador
//   de arriba de App) · caso=pocas (5 órdenes)
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
const montaje = (L.find(x => x.includes('{view==="orders"&&')) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje de «Todas» en App (view===\"orders\")");
// lo que el montaje usa de módulo (la vista nueva, si ya existe)
const RAICES = ["OCard", "EmptyState", "prioSortRecent", "VIEW_MAXW", "isSec", ...(fuente.includes("function VistaTodas(") ? ["VistaTodas"] : [])];
const SIMULADOS = ["supabase", "db", "SignedImg", "firmarOrderFile", "propsArchivoFirmado", "useSignedFile", "abrirArchivoFirmado"];
const { codigo, simuladosUsados } = extraer(fuente, RAICES, { simulados: SIMULADOS });
const menuAncho = /width:sbPlegado\?(\d+):(\d+),flexShrink:0,height:"100vh"/.exec(fuente);
if (!menuAncho) throw new Error("no encuentro el ancho del menú lateral de App");
const contenedor = (L.find(x => x.includes('<div style={{boxSizing:"border-box",width:"100%",maxWidth:view==="board"')) || "").trim();
if (!contenedor) throw new Error("no encuentro el contenedor de las vistas de App");
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `// ── lo que toca la base o Storage, simulado (${simuladosUsados.join(", ")}) ──
const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.slice(-40).join("\\n"); };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
const db = { getOrderChangeLog: async () => [] };
const supabase = {};
const propsArchivoFirmado = () => ({});
const firmarOrderFile = async src => src;
const IMG = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="#dfe6ee"/></svg>');
function SignedImg({ src, alt, style, onClick, title, fallback }) { return <img src={IMG} alt={alt} style={style} onClick={onClick} title={title} />; }
const Q = new URLSearchParams(location.search);
const ROL = Q.get("rol") || "secretaria", LOGIN = { secretaria: "secretaria", karla: "karla", admin: "marcelo", produccion: "gerardo", vendedor: "genaro" }[ROL] || ROL;
const SIN_LECTURA = Q.get("lectura") === "no", BUSCAR = Q.get("buscar") || "", CASO = Q.get("caso") || "";
const T = s => new Date(s).toISOString();
const CLIENTES = ["GOBIERNO DEL ESTADO DE GUANAJUATO", "CERVECERIA MODELO DE MEXICO", "COSQUIM", "PREMIUM RESTAURANT BRANDS", "MUNICIPIO DE LEON", "DELDHY WESTERN PRODUCTS",
  "TRANSPORTES CASTORES DE BAJA", "INMOBILIARIA HOTSSON", "IMPRENTA LEON", "LIC. ORLANDO CASAS", "CABLESERV MANTENIMIENTO E INSTALACIONES", "MAFER"];
const PRODUCTOS = ["Volantes", "Etiquetas", "Formatos", "Hojas membretadas", "Tarjetas", "Folders", "Agendas", "Calendarios"];
const ACTIVAS = ["draft", "design", "proof_client", "ctp", "placas_listas", "ready", "in_production", "packaging", "salidas"];
// la orden n (1 = la más vieja): las 945 más viejas entregadas, 10 canceladas en medio, las 47 más nuevas activas
const orden = n => {
  const pn = "P-" + String(n).padStart(4, "0"), dias = Math.round((1002 - n) * 0.35);
  const creada = new Date(new Date("2026-10-14T10:00:00-06:00").getTime() - dias * 86400000);
  const stage = n > 955 ? ACTIVAS[n % ACTIVAS.length] : n % 95 === 0 ? "cancelled" : "delivered";
  return { id: "OP-" + pn, production_number: pn, client: CLIENTES[n % CLIENTES.length], product_type: PRODUCTOS[n % PRODUCTOS.length], product: PRODUCTOS[n % PRODUCTOS.length].toUpperCase(),
    quantity: 500 + (n % 20) * 250, stage, priority: n % 17 === 0 ? "urgente" : "normal", order_type: "interna", price: 1000 + (n % 30) * 350, created_by: "secretaria",
    agent: n % 3 ? "Genaro" : "Manuel", client_phone: "4771234567", created_at: creada.toISOString(), due_date: new Date(creada.getTime() + 8 * 86400000).toISOString().slice(0, 10),
    delivered_at: stage === "delivered" ? new Date(creada.getTime() + 7 * 86400000).toISOString() : null, notes_log: [], comments: [], image_url: n % 2 ? "img" + n : "",
    timeline: [{ stage: "draft", date: creada.toISOString() }, { stage, date: new Date(creada.getTime() + 86400000).toISOString() }] };
};
const TODAS = CASO === "pocas" ? Array.from({ length: 5 }, (_, i) => orden(998 + i)) : Array.from({ length: 1002 }, (_, i) => orden(i + 1));
const ORDENES = SIN_LECTURA ? [] : TODAS;`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [orders, setOrders] = useState(ORDENES);
  useEffect(() => { window.__cambiar = (id, x) => { anota("cambiada " + id); setOrders(p => p.map(y => y.id === id ? { ...y, ...x } : y)); }; window.__pintada = performance.now(); }, []);
  const [search, setSearchState] = useState(BUSCAR);
  const setSearch = t => { anota("buscar " + t); setSearchState(t); };
  const user = ROL, userLogin = LOGIN, view = "orders", actionLoading = null;
  // lo que hace App con el buscador de arriba: filtra por folio, cliente o producto (searchFilter de App, en corto)
  const s = search.trim().toLowerCase();
  const filteredOrders = s ? orders.filter(o => (o.production_number || "").toLowerCase().includes(s) || (o.client || "").toLowerCase().includes(s) || (o.product_type || "").toLowerCase().includes(s)) : orders;
  const lectura = SIN_LECTURA ? { ok: null, fallo: Date.now() } : { ok: Date.now(), fallo: null };
  const handleAction = (id, accion) => anota("accion " + id + " " + accion);
  const setEditO = () => {}, setView = v => anota("vista " + v);
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
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco todas</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5182), strictPort: true } });
`, "utf8");
console.log("banco de todas listo en " + outDir);
