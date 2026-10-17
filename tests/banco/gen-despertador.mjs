// Banco del «DESPERTADOR» (la ventana grande que cada quien ve al entrar en el día: `WakeupModal`, con `getWakeupItems`, que usa diagnoseOrder), EXTRAÍDO
// de App.jsx por extraer.mjs con lo que usa, y montado con las líneas de App que lo calculan y lo confirman (el efecto que lo arma, `ackWakeup`, y la
// línea que lo monta): lo que App hace con él también se prueba. La critique del 16-oct. La tanda fija el reloj del navegador.
// Detrás va una «app» con un buscador y botones, para ver que el teclado no se sale de la ventana.
// Se anota en #log: «accion <id> <acción>» (abrir la orden), «rpc log_wakeup_ack <n>» (el registro de la confirmación), «lectura ok|falló».
// Uso: node gen-despertador.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=secretaria|admin|produccion|karla (la de siempre: secretaria) · lectura=falla-primera (la primera lectura falla y la segunda,
// a los 1.5 s, sale bien) · caso=sana (nada pendiente) | confirmado (ya confirmó hoy) · falla=registro (la base no registra la confirmación)
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo } = extraer(fuente, ["WakeupModal", "getWakeupItems", "localDayStr", "hoverLift"], { simulados: ["supabase", "db"] });
// las líneas de App que arman y confirman el Despertador: del efecto que lo calcula (el que hace setWakeupItems(null)) hasta antes de los avisos
const iNull = L.findIndex(x => x.includes("setWakeupItems(null);return}"));
if (iNull < 0) throw new Error("no encuentro el efecto que arma el Despertador en App");
let iIni = iNull; while (iIni > 0 && !/^\s*useEffect\(\(\)=>\{\s*$/.test(L[iIni])) iIni--;
const iFin = L.findIndex((x, i) => i > iNull && /^\s*const \[notifications,setNotifications\]/.test(x));
if (iIni <= 0 || iFin < 0) throw new Error("no encuentro el principio o el fin del Despertador en App");
const deApp = L.slice(iIni, iFin).join("\n");
if (!deApp.includes("const ackWakeup=")) throw new Error("las líneas de App no traen ackWakeup");
const montaje = (L.find(x => x.includes("<WakeupModal ") && !x.includes("<WakeupModal repaso")) || "").trim();
// v10.84.134 — «Tus pendientes de hoy»: el botón de la barra y la ventana en modo repaso (con las versiones de antes no existen: quedan vacíos)
const botonRepaso = (L.find(x => x.includes("setRepasoDespertador(true)")) || "").trim();
const montajeRepaso = (L.find(x => x.includes("<WakeupModal repaso")) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje del Despertador en App");
const LOGIN = { secretaria: "lupita", admin: "marcelo", produccion: "gerardo", karla: "karla", preprensa: "noemi", vendedor: "genaro" };
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
const ROL = Q.get("rol") || "secretaria", LECTURA = Q.get("lectura") || "", CASO = Q.get("caso") || "", FALLA = Q.get("falla") || "";
const LOGIN = ${JSON.stringify(LOGIN)};
const supabase = { rpc: async (fn, args) => { await new Promise(r => setTimeout(r, 40)); anota("rpc " + fn + " " + (args?.p_items_count ?? "")); return FALLA === "registro" ? { data: null, error: { message: "la base no contestó" } } : { data: null, error: null }; } };
const db = {};
const T = s => new Date(s).toISOString();
// la orden con su bitácora: daysInStage mide desde la entrada que la llevó a su etapa («to»). Hoy es el miércoles 14-oct-2026 (lo fija la tanda).
const o = (pn, stage, desde, x = {}) => ({ id: "OP-" + pn, production_number: pn, client: "CLIENTE " + pn, product_type: "Volantes", quantity: 1000, stage, priority: "normal",
  order_type: "interna", price: 1500, created_by: "secretaria", agent: "Manuel", due_date: "2026-10-30", created_at: T("2026-10-01T09:00:00-06:00"), notes_log: [], comments: [],
  timeline: [{ to: stage, date: T(desde), action: "→ " + stage }], ...x });
const HOY = "2026-10-14T09:00:00-06:00", HACE4 = "2026-10-08T09:00:00-06:00", HACE5 = "2026-10-07T09:00:00-06:00";
// datos por capturar: el Despertador NO los pide (los salta desde v10.58.63: SKIP_KEYS)
const DATOS = [
  o("P-0704", "design", HOY, { due_date: null, client: "SIN FECHA P-0704" }),
  o("P-0705", "design", HOY, { due_date: null, client: "SIN FECHA P-0705", agent: "Genaro" }),
  o("P-0707", "design", HOY, { price: 0, client: "SIN PRECIO" }),
];
// trabajo parado: lo que sí despierta (a quien le toca)
const PARADAS = [
  o("P-0611", "packaging", HOY, { needs_reprint: true, price: 2000, client: "REIMPRIMIR SA" }),                       // Gerardo
  o("P-0612", "salidas", HACE4, { price: 3000, client: "SIN FOLIO SA", invoice_folio: null }),                         // Karla
  o("P-0613", "placas_listas", HOY, { due_date: "2026-10-09", price: 4000, client: "VENCIDA SA" }),                    // vencida: Gerardo; Lupita la persigue (es de Manuel)
  o("P-0614", "packaging", HACE5, { price: 5000, client: "QUIETA EN EMPAQUE" }),                                       // Gerardo, 5 días sin avanzar
  o("P-0615", "draft", HOY, { price: 1000, client: "POR VALIDAR" }),                                                   // Gerardo y Noemí
  o("P-0616", "proof_client", HACE4, { price: 6000, client: "EL CLIENTE NO APRUEBA" }),                                // externa: Lupita da seguimiento
];
const SANAS = [
  o("P-0620", "in_production", HOY, { current_machine: "off_pm74", machine_queue_position: 0, client: "EN MAQUINA SA" }),
  o("P-0621", "design", HOY, { client: "EN DISEÑO SA" }),
];
const ORDENES = CASO === "sana" ? SANAS : [...DATOS, ...PARADAS, ...SANAS];`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const user = ROL, userLogin = LOGIN[ROL] || ROL;
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [lectura, setLectura] = useState({ ok: null, fallo: null });
  const [wakeupItems, setWakeupItems] = useState(null);
  // lo que hace App al entrar: lee de la base (la primera vez puede fallar: App marca loaded y lectura.fallo, y la siguiente lectura buena trae las órdenes)
  useEffect(() => {
    if (CASO === "confirmado") { try { localStorage.setItem("pf_wakeup_" + userLogin + "_" + localDayStr(), "1"); } catch (e) {} }
    const bien = () => { anota("lectura ok"); setOrders(ORDENES); setLectura({ ok: Date.now(), fallo: null }); setLoaded(true); };
    const t1 = setTimeout(() => { if (LECTURA === "falla-primera") { anota("lectura falló"); setLectura(l => ({ ...l, fallo: Date.now() })); setLoaded(true); } else bien(); }, 150);
    const t2 = LECTURA === "falla-primera" ? setTimeout(bien, 1500) : null;
    return () => { clearTimeout(t1); if (t2) clearTimeout(t2); };
  }, []);
  const handleAction = (id, accion) => anota("accion " + id + " " + accion);
  // ── de App.jsx: el efecto que arma el Despertador y la confirmación ──
${deApp}
  return <div style={{ background: C.canvas, minHeight: "100vh", fontFamily: "'Geist',sans-serif" }}>
    <div id="barra" style={{ height: 57, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "0 16px", borderBottom: "0.5px solid #ddd", background: C.bg }}>
      <input id="atras-buscar" placeholder="Buscar orden..." style={{ padding: "6px 10px" }} />
      <button id="atras-campana" onClick={() => anota("atrás: campana")}>Notificaciones</button>
      <button id="atras-salir" onClick={() => anota("atrás: salir")}>Salir</button>
      ${botonRepaso}
    </div>
    <div id="lista" style={{ padding: 16 }}>{orders.map(x => <div key={x.id}>{x.production_number} · {x.client}</div>)}</div>
    ${montaje}
    ${montajeRepaso}
    <pre id="log" style={{ fontSize: 10, color: "#666", marginTop: 40 }}></pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco despertador</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5179), strictPort: true } });
`, "utf8");
console.log("banco del Despertador listo en " + outDir);
