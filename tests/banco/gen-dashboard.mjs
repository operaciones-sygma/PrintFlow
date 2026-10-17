// Banco del «DASHBOARD» (la vista con la que abren casi todos: `view==="pipeline"` en App): `Pipeline`, `WeeklyReport`, `MaquilaTracker` y la pista de
// Producción, EXTRAÍDOS de App.jsx por extraer.mjs con lo que usan (las fichas, OCard), y montados con la línea de App que monta la vista (lo que
// App les pasa también se prueba). La critique de la noche del 16-oct. La tanda fija el reloj del navegador en el miércoles 14-oct-2026 a las 12:00
// de México (sin eso, «vencida», «estancada» y «los últimos 7 días» cambian con el día en que se corra).
// Lo que la vista pide a App se anota en #log: «accion <id> <acción>».
// Uso: node gen-dashboard.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=secretaria|produccion|karla|admin|vendedor · lectura=no (todavía no se ha leído nada de la base) · caso=temprano (también hay
//   órdenes en Validar, Diseño y Aprobación) | vacio (se leyó y no hay activas) | muchas (las 12 etapas con órdenes) | espera (v10.84.140: más una lista
//   en Salidas que espera a que el cliente pida su factura, vencida el 8) | lista (v10.84.149: más una en Salidas SIN la pausa que llegó el 7 y vencía el
//   8, y tres entregadas el 13 que vencían antes: P-0505 lista a tiempo, P-0506 entregada a las 18:00 del día de su fecha y P-0507 lista tarde) |
//   sinfecha (las entregadas de la semana, sin fecha de entrega)
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
const { codigo, simuladosUsados } = extraer(fuente, ["Pipeline", "WeeklyReport", "MaquilaTracker", "FirstTimeHint", "VIEW_MAXW", "isSec"], { simulados: SIMULADOS });
const menuAncho = /width:sbPlegado\?(\d+):(\d+),flexShrink:0,height:"100vh"/.exec(fuente);
if (!menuAncho) throw new Error("no encuentro el ancho del menú lateral de App");
const contenedor = (L.find(x => x.includes('<div style={{boxSizing:"border-box",width:"100%",maxWidth:view==="board"')) || "").trim();
if (!contenedor) throw new Error("no encuentro el contenedor de las vistas de App");
const montaje = (L.find(x => x.includes('{view==="pipeline"&&<div>')) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje del Dashboard en App (view===\"pipeline\")");
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `// ── lo que toca la base o Storage, simulado (${simuladosUsados.join(", ")}) ──
const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
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
const CASO = Q.get("caso") || "", SIN_LECTURA = Q.get("lectura") === "no";
const T = s => new Date(s).toISOString();
// una orden activa con sus datos; la bitácora con etapa y fecha (getStale mide desde la última)
const o = (pn, x = {}) => ({ id: "OP-" + pn, production_number: pn, client: "CLIENTE " + pn, product_type: "Volantes", product: "VOLANTES", quantity: 1000,
  stage: "ready", priority: "normal", order_type: "interna", price: 2000, created_by: "secretaria", agent: "Genaro", client_phone: "4771234567",
  client_email: "c@c.mx", file_url: "ordenes/" + pn + ".pdf", created_at: T("2026-10-09T09:00:00-06:00"), due_date: "2026-10-28", notes_log: [], comments: [],
  timeline: [{ stage: "draft", date: T("2026-10-09T09:00:00-06:00") }, { stage: x.stage || "ready", date: T("2026-10-14T09:00:00-06:00") }], ...x });
const enMaq = (pn, maq, pos, x = {}) => o(pn, { stage: "in_production", current_machine: maq, machine_queue_position: pos, machine_log: pos === 0 ? [{ machine: maq, started: T("2026-10-14T10:00:00-06:00") }] : [], ...x });
const entregada = (pn, dia, x = {}) => o(pn, { stage: "delivered", delivered_at: T("2026-10-" + dia + "T13:00:00-06:00"), price: 10000, ...x });
const ACTIVAS = [
  o("P-0601", { stage: "placas_listas", client: "PLACAS LISTAS SA" }),
  o("P-0602", { stage: "ready", client: "LA VENCIDA EN LISTAS", due_date: "2026-10-10" }),
  o("P-0603", { stage: "ready" }),
  o("P-0604", { stage: "ready", client: "COSQUIM", priority: "urgente", due_date: "2026-10-15" }),
  enMaq("P-0611", "off_pm74", 0, { client: "DELDHY WESTERN PRODUCTS", due_date: "2026-10-07", price: 1980 }),
  enMaq("P-0612", "off_pm74", 1),
  enMaq("P-0613", "off_pm52", 0),
  enMaq("P-0614", "dig_xerox252", 0),
  o("P-0621", { stage: "packaging" }),
  o("P-0622", { stage: "packaging" }),
  // sin fecha de entrega y 6 días sin avance en Salidas: la estancada
  o("P-0448", { stage: "salidas", client: "JOSE DE JESUS RODRIGUEZ HERNANDEZ", price: 75000, due_date: null, timeline: [{ stage: "salidas", date: T("2026-10-06T12:00:00-06:00") }] }),
  ...["P-0631", "P-0632", "P-0633", "P-0634", "P-0635", "P-0636"].map(pn => o(pn, { stage: "salidas", due_date: "2026-10-20" })),
  o("P-0640", { stage: "maquila_in", client: "REGRESO DE MAQUILA" }),
  // maquilas (su propio flujo)
  o("P-0650", { order_type: "maquila", stage: "maq_sent", price: 0, maq_price: 5000, maq_cost: 2000, maq_provider: "Suajes SA", client: "DOBLADOS DEL CENTRO" }),
  o("P-0662", { order_type: "maquila", stage: "maq_received", price: 0, maq_price: 8000, maq_cost: 4000, maq_provider: "Acabados del Bajío", client: "ACABADOS FINOS", due_date: "2026-10-16" }),
];
const TEMPRANAS = [o("P-0700", { stage: "draft", client: "POR VALIDAR" }), o("P-0701", { stage: "design", client: "EN DISEÑO" }), o("P-0702", { stage: "proof_client", client: "ESPERA AL CLIENTE" })];
const TODAS_LAS_ETAPAS = ["draft", "design", "proof_printing", "proof_client", "ctp", "maquila_out"].map((st, i) => o("P-07" + (10 + i), { stage: st, client: "ETAPA " + st }));
// lo entregado: cinco en los últimos 7 días ($50,000) y una hace 20 días (no cuenta)
const ENTREGADAS = [entregada("P-0500", "10"), entregada("P-0501", "11"), entregada("P-0502", "12"), entregada("P-0503", "13"), entregada("P-0504", "13"),
  o("P-0490", { stage: "delivered", delivered_at: T("2026-09-24T13:00:00-06:00"), price: 99000 })];
const ESPERA_FACTURA = o("P-0645", { stage: "salidas", client: "KFC ESPERA FACTURA", due_date: "2026-10-08", snooze_reason: "El cliente aún no ha pedido factura/remisión", snooze_kind: "awaiting_client_invoice", snoozed_by: "karla", snooze_until: null, snooze_stage: "salidas",
  timeline: [{ to: "salidas", date: T("2026-10-07T12:00:00-06:00") }, { action: "🧾 En espera: el cliente no ha pedido factura", date: T("2026-10-09T10:00:00-06:00") }] });
const LISTA_A_TIEMPO = o("P-0646", { stage: "salidas", client: "LISTA A TIEMPO SIN PAUSA", due_date: "2026-10-08", timeline: [{ to: "salidas", date: T("2026-10-07T12:00:00-06:00") }] });
const ENTREGADAS_TARDE = [entregada("P-0505", "13", { due_date: "2026-10-10", timeline: [{ to: "salidas", date: T("2026-10-09T12:00:00-06:00") }] }),
  o("P-0506", { stage: "delivered", delivered_at: T("2026-10-13T18:00:00-06:00"), due_date: "2026-10-13", price: 10000 }),
  entregada("P-0507", "13", { due_date: "2026-10-10", timeline: [{ to: "salidas", date: T("2026-10-12T12:00:00-06:00") }] })];
const ORDENES = SIN_LECTURA ? [] : CASO === "lista" ? [...ACTIVAS, LISTA_A_TIEMPO, ...ENTREGADAS, ...ENTREGADAS_TARDE] : CASO === "sinfecha" ? [...ACTIVAS, ...ENTREGADAS.map(x => ({ ...x, due_date: null }))]
  : CASO === "espera" ? [...ACTIVAS, ESPERA_FACTURA, ...ENTREGADAS] : CASO === "vacio" ? ENTREGADAS : CASO === "temprano" ? [...TEMPRANAS, ...ACTIVAS, ...ENTREGADAS]
  : CASO === "muchas" ? [...TODAS_LAS_ETAPAS, ...ACTIVAS, ...ENTREGADAS] : [...ACTIVAS, ...ENTREGADAS];`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [orders, setOrders] = useState(ORDENES);
  // window.__cambiar(id, campos): otra persona cambia una orden con la vista abierta (como el tiempo real)
  useEffect(() => { window.__cambiar = (id, x) => { anota("cambiada " + id); setOrders(p => p.map(y => y.id === id ? { ...y, ...x } : y)); }; }, []);
  const user = ROL, userLogin = LOGIN, view = "pipeline", hasFilter = false, orderFilter = null, search = "";
  const viewOrders = orders, filteredOrders = orders, chemicals = [], plates = [], maintenance = [];
  // lo que App sabe de la lectura (v10.84.65): ok = la hora de la última lectura buena; fallo = la de la última que falló
  const lectura = SIN_LECTURA ? { ok: null, fallo: Date.now() } : { ok: Date.now(), fallo: null };
  const handleAction = (id, accion, extra) => anota("accion " + id + " " + accion + (extra ? " " + extra : ""));
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
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco dashboard</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5183), strictPort: true } });
`, "utf8");
console.log("banco del dashboard listo en " + outDir);
