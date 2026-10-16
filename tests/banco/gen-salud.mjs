// Banco de «DATOS PENDIENTES» (Lupita y Karla) y «SALUD OPERATIVA» (Dirección): `OperationalHealthView` de App.jsx, EXTRAÍDO por extraer.mjs con lo
// que usa, y montado con la línea de App que lo monta (lo que App le pasa también se prueba). La critique de la noche del 16-oct.
// Las órdenes son de la semana del 12 al 18 de octubre de 2026: la tanda fija el reloj del navegador en el miércoles 14 a las 12:00 de México
// (sin eso, «vencida», «urgente» y «estancada» cambian con el día en que se corra).
// Lo que la vista pide a App se anota en #log: «accion <id> <detail|edit>», «confirm <título>», «toast <texto>», «reload».
// Uso: node gen-salud.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=secretaria|karla|admin · lectura=no (todavía no se ha leído nada de la base: sin órdenes) · caso=calma (nada vencido,
//   urgente ni estancado) | vacio (se leyó y no hay órdenes activas) | muchos (13 sin teléfono del cliente) | mantenimiento (una prensa caída) |
//   estancada (una estancada sin fecha contra una sana de $500,000)
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
const { codigo } = extraer(fuente, ["OperationalHealthView", "VIEW_MAXW"], { simulados: ["supabase", "db"] });
const menuAncho = /width:sbPlegado\?(\d+):(\d+),flexShrink:0,height:"100vh"/.exec(fuente);
if (!menuAncho) throw new Error("no encuentro el ancho del menú lateral de App");
const contenedor = (L.find(x => x.includes('<div style={{boxSizing:"border-box",width:"100%",maxWidth:view==="board"')) || "").trim();
if (!contenedor) throw new Error("no encuentro el contenedor de las vistas de App");
const montaje = (L.find(x => x.includes('{view==="health"&&')) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje de «Datos Pendientes» en App (view===\"health\")");
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `const Q = new URLSearchParams(location.search);
const ROL = Q.get("rol") || "secretaria", LOGIN = { secretaria: "secretaria", karla: "karla", admin: "marcelo" }[ROL] || ROL;
const CASO = Q.get("caso") || "", SIN_LECTURA = Q.get("lectura") === "no";
const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
// la base y lo que firma, de mentira (sólo Dirección los usa: notificar, cancelar una OC huérfana, marcar avisos)
const supabase = { rpc: async (n) => { anota("rpc " + n); return { error: null }; },
  from: () => ({ update: () => ({ eq: () => ({ eq: async () => { anota("update notifications"); return { error: null }; } }) }) }) };
const db = { loadNotifications: async () => [], notify: async (to, id, tipo) => { anota("notify " + to + " " + id + " " + tipo); } };
const T = s => new Date(s).toISOString();
// una orden con TODOS sus datos (teléfono, correo, vendedor, cantidad, archivo): cada caso quita lo que quiere que falte
const o = (id, pn, x = {}) => ({ id, production_number: pn, client: "CLIENTE " + pn, product_type: "Volantes", quantity: 1000, stage: "design",
  priority: "normal", order_type: "interna", price: 1000, created_by: "secretaria", agent: "Genaro", client_phone: "4771234567", client_email: "compras@cliente.mx",
  file_url: "ordenes/" + id + ".pdf", created_at: T("2026-10-12T09:00:00-06:00"), due_date: "2026-10-28",
  timeline: [{ date: T("2026-10-14T09:00:00-06:00"), action: "Actualizada" }], ...x });
const BASE = [
  // vencida hace 7 días, corriendo en la prensa de Gerardo (en la máquina no cuenta como estancada): la prioridad del día
  o("op-611", "P-0611", { client: "DELDHY WESTERN PRODUCTS", stage: "in_production", current_machine: "off_pm74", machine_queue_position: 0, price: 1980, due_date: "2026-10-07",
    timeline: [{ date: T("2026-10-09T10:00:00-06:00"), action: "En máquina" }] }),
  // sin precio, en Salidas esperando su fecha (Lupita la capturó; vendedor Manuel)
  o("op-643", "P-0643", { client: "ANGELES PONCE / PRINT MAGENTA", stage: "salidas", price: 0, agent: "Manuel", created_at: T("2026-10-13T10:00:00-06:00"), due_date: "2026-10-20" }),
  // sin fecha de entrega y 6 días sin avance en Salidas: estancada crítica; el cliente con nombre largo
  o("op-448", "P-0448", { client: "JOSE DE JESUS RODRIGUEZ HERNANDEZ", stage: "salidas", price: 75000, due_date: null,
    timeline: [{ date: T("2026-10-06T12:00:00-06:00"), action: "A Salidas" }] }),
  // urgente (se entrega mañana), lista para máquina
  o("op-660", "P-0660", { client: "COSQUIM", stage: "ready", price: 12000, due_date: "2026-10-15" }),
  // en diseño con Noemí, sin fecha de entrega
  o("op-661", "P-0661", { client: "MAFER", stage: "design", price: 3000, due_date: null }),
  // maquila de Genaro (vendedor con usuario): sin proveedor ni costo
  o("op-650", "P-0650", { client: "DOBLADOS DEL CENTRO", order_type: "maquila", stage: "maq_sent", price: 0, maq_price: 5000, maq_cost: 0, maq_provider: "", agent: "genaro" }),
  // maquila con Lupita (su vendedor, Manuel, no tiene usuario): por enviar al proveedor
  o("op-655", "P-0655", { client: "IMPRESOS LEON", order_type: "maquila", stage: "maq_created", price: 0, maq_price: 3000, maq_cost: 1500, maq_provider: "Suajes SA", agent: "Manuel" }),
  // maquila recibida, con Karla: espera su fecha (no es estancada aunque lleve días quieta)
  o("op-662", "P-0662", { client: "ACABADOS FINOS", order_type: "maquila", stage: "maq_received", price: 0, maq_price: 8000, maq_cost: 4000, maq_provider: "Acabados del Bajío",
    due_date: "2026-10-16", timeline: [{ date: T("2026-10-07T10:00:00-06:00"), action: "Recibida" }] }),
];
const CALMA = [
  o("op-700", "P-0700", { client: "LA DE SIEMPRE", stage: "ready", price: 5000, due_date: "2026-10-28" }),
  o("op-701", "P-0701", { client: "OTRA TRANQUILA", stage: "design", price: 2000, due_date: "2026-10-30" }),
];
const SIN_TEL = Array.from({ length: 13 }, (_, i) => o("op-8" + String(i).padStart(2, "0"), "P-08" + String(i).padStart(2, "0"), { client: "SIN TELEFONO " + (i + 1), client_phone: "" }));
// una estancada sin fecha (P-0448) contra una sana muy cara (P-0702, $500,000): ¿cuál es la prioridad del día?
const ESTANCADA = [BASE.find(x => x.id === "op-448"), o("op-702", "P-0702", { client: "LA MUY CARA", stage: "ready", price: 500000, due_date: "2026-10-30" }), ...CALMA];
const ORDENES = SIN_LECTURA || CASO === "vacio" ? [] : CASO === "calma" ? CALMA : CASO === "muchos" ? [...BASE, ...SIN_TEL] : CASO === "estancada" ? ESTANCADA : BASE;
const MANTENIMIENTO = CASO === "mantenimiento" ? [{ id: "mt1", machine_id: "off_pm52", started_at: T("2026-10-13T08:00:00-06:00"), started_by: "gerardo", notes: "Rodillo dañado" }] : [];
const OCS = ROL === "admin" ? [{ id: "OC-0900", client: "HUERFANA SA", status: "open" }] : [];`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [orders, setOrders] = useState(ORDENES);
  // window.__cambiar(id, campos): otra persona cambia una orden con la vista abierta (como el tiempo real)
  useEffect(() => { window.__cambiar = (id, x) => { anota("cambiada " + id); setOrders(p => p.map(y => y.id === id ? { ...y, ...x } : y)); }; }, []);
  const [notifications, setNotifications] = useState([]);
  const user = ROL, userLogin = LOGIN, view = "health", notifKey = ROL, maintKey = 0;
  const maintenance = MANTENIMIENTO, purchaseOrders = OCS;
  // lo que App sabe de la lectura (v10.84.65): ok = la hora de la última lectura buena; fallo = la de la última que falló
  const lectura = SIN_LECTURA ? { ok: null, fallo: Date.now() } : { ok: Date.now(), fallo: null };
  const handleAction = (id, tipo) => anota("accion " + id + " " + tipo);
  const setConfirmModal = m => { if (m) anota("confirm " + m.title); };
  const showToast = (t) => anota("toast " + t);
  const reload = () => anota("reload");
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
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco datos pendientes</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5184), strictPort: true } });
`, "utf8");
console.log("banco de datos pendientes listo en " + outDir);
