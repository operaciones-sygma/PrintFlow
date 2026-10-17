// Banco de «DINERO EN PROCESO» (Dirección: `WIPDashboard` de App.jsx), EXTRAÍDO por extraer.mjs con lo que usa y montado con la línea de App que lo
// monta (lo que App le pasa también se prueba). La critique del 16-oct en la noche (v10.84.142). La tanda fija el reloj del navegador en el viernes
// 16-oct-2026 a las 12:00 de México.
// Lo que la vista pide a App se anota en #log: «accion <id> <detail|edit>».
// Uso: node gen-wip.mjs <App.jsx> <dirSalida>
// Variantes por URL: lectura=no (todavía no se ha leído nada de la base: sin órdenes) · caso=vacio (se leyó y no hay activas) · caso=centavos|negativo|muchas
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
const { codigo } = extraer(fuente, ["WIPDashboard", "VIEW_MAXW"], { simulados: ["supabase", "db"] });
const menuAncho = /width:sbPlegado\?(\d+):(\d+),flexShrink:0,height:"100vh"/.exec(fuente);
if (!menuAncho) throw new Error("no encuentro el ancho del menú lateral de App");
const contenedor = (L.find(x => x.includes('<div style={{boxSizing:"border-box",width:"100%",maxWidth:view==="board"')) || "").trim();
if (!contenedor) throw new Error("no encuentro el contenedor de las vistas de App");
const montaje = (L.find(x => x.includes('{view==="wip"&&')) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje de «Dinero en Proceso» en App (view===\"wip\")");
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `const Q = new URLSearchParams(location.search);
const CASO = Q.get("caso") || "", SIN_LECTURA = Q.get("lectura") === "no";
const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
const supabase = {}, db = {};
const T = s => new Date(s).toISOString();
// una orden activa; entró a su etapa el 15 (la bitácora con «to», como la arma App)
const o = (pn, x = {}) => ({ id: "OP-" + pn, production_number: pn, client: "CLIENTE " + pn, product_type: "Volantes", quantity: 1000, stage: "ready", priority: "normal",
  order_type: "interna", price: 1000, created_by: "secretaria", agent: "Genaro", created_at: T("2026-10-13T09:00:00-06:00"), due_date: "2026-10-28",
  timeline: [{ to: x.stage || "ready", date: T("2026-10-15T09:00:00-06:00"), action: "→ " + (x.stage || "ready") }], ...x });
const ESPERA = { snooze_reason: "El cliente aún no ha pedido factura/remisión", snooze_kind: "awaiting_client_invoice", snoozed_by: "karla", snooze_until: null };
const ACTIVAS = [
  o("P-0700", { stage: "draft", client: "POR VALIDAR", price: 2000 }),
  o("P-0701", { stage: "design", client: "EN DISEÑO", price: 3000 }),
  o("P-0702", { stage: "ctp", client: "EN CTP", price: 4000 }),
  // capturada hace casi un mes, llegó a Listas ayer: «días en la etapa» es 1, no 26
  o("P-0703", { stage: "ready", client: "VIEJA RECIEN LISTA", price: 5000, created_at: T("2026-09-20T09:00:00-06:00") }),
  ...["P-0720", "P-0721", "P-0722", "P-0723", "P-0724", "P-0725"].map(pn => o(pn, { stage: "ready", client: "LISTA " + pn })),
  o("P-0704", { stage: "in_production", client: "EN LA PM-74", price: 10000, current_machine: "off_pm74", machine_queue_position: 0 }),
  o("P-0705", { stage: "in_production", client: "EN LA PM-52", price: 7000, current_machine: "off_pm52", machine_queue_position: 0 }),
  o("P-0706", { stage: "maq_in_progress", order_type: "maquila", client: "CON EL MAQUILADOR", price: 0, maq_price: 8000, maq_cost: 5000, maq_provider: "Suajes SA" }),
  o("P-0708", { stage: "packaging", client: "EN EMPAQUE", price: 9000 }),
  o("P-0709", { stage: "salidas", client: "POR FOLIAR", price: 12000 }),
  o("P-0712", { stage: "design", client: "SIN PRECIO SA", price: 0 }),
  // listas y «En espera: el cliente no ha pedido factura»: $56,000
  o("P-0707", { stage: "maq_received", order_type: "maquila", client: "MAQUILA ESPERA", price: 0, maq_price: 6000, maq_cost: 4000, maq_provider: "Acabados", ...ESPERA, snooze_stage: "maq_received" }),
  o("P-0710", { stage: "salidas", client: "PRB ESPERA", price: 20000, ...ESPERA, snooze_stage: "salidas" }),
  o("P-0711", { stage: "salidas", client: "KFC ESPERA", price: 30000, ...ESPERA, snooze_stage: "salidas" }),
];
// (y lo que no cuenta: una entregada, una cancelada, una cargada a stock —«En Stock» es final en toda la app— y una con la cancelación a medias)
const OTRAS = [o("P-0690", { stage: "delivered", price: 99000 }), o("P-0691", { stage: "cancelled", price: 88000 }),
  o("P-0692", { stage: "stocked", client: "CARGADA A STOCK", price: 77000 }),
  o("P-0693", { stage: "ready", client: "CANCELADA A MEDIAS", price: 55000, cancelled_at: T("2026-10-15T10:00:00-06:00") })];
// caso=centavos: Captura en $2,000.50 y Pre-prensa en $7,000.50 (lo de arriba, $66,001: redondeada cada zona por su lado sumaría $66,002)
// caso=negativo: P-0700 con precio −$2,000 (la base no tiene CHECK en price): es un precio que falta, no resta
// caso=muchas: 5 más que esperan al cliente ($1,000 cada una); P-0734 lista desde el 1-oct (11 días hábiles) y P-0733 con un nombre de 90 letras
const CENTAVOS = { "P-0700": 2000.5, "P-0701": 3000.5 };
const MAS_ESPERA = ["P-0730", "P-0731", "P-0732", "P-0733", "P-0734"].map(pn => o(pn, { stage: "salidas", client: "ESPERA " + pn, ...ESPERA, snooze_stage: "salidas",
  ...(pn === "P-0733" ? { client: "GRUPO INDUSTRIAL DE EMPAQUES Y ETIQUETAS AUTOADHERIBLES DEL BAJIO SOCIEDAD ANONIMA DE CV" } : {}),
  ...(pn === "P-0734" ? { client: "LA MAS VIEJA", timeline: [{ to: "salidas", date: T("2026-10-01T09:00:00-06:00"), action: "→ salidas" }] } : {}) }));
const ORDENES = SIN_LECTURA ? [] : CASO === "vacio" ? OTRAS
  : [...(CASO === "centavos" ? ACTIVAS.map(x => CENTAVOS[x.production_number] ? { ...x, price: CENTAVOS[x.production_number] } : x)
    : CASO === "negativo" ? ACTIVAS.map(x => x.production_number === "P-0700" ? { ...x, price: -2000 } : x)
    : CASO === "muchas" ? [...ACTIVAS, ...MAS_ESPERA] : ACTIVAS), ...OTRAS];`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [orders, setOrders] = useState(ORDENES);
  useEffect(() => { window.__cambiar = (id, x) => { anota("cambiada " + id); setOrders(p => p.map(y => y.id === id ? { ...y, ...x } : y)); }; }, []);
  const user = "admin", view = "wip";
  const lectura = SIN_LECTURA ? { ok: null, fallo: Date.now() } : { ok: Date.now(), fallo: null };
  const handleAction = (id, tipo) => anota("accion " + id + " " + tipo);
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
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco dinero en proceso</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5174), strictPort: true } });
`, "utf8");
console.log("banco de dinero en proceso listo en " + outDir);
