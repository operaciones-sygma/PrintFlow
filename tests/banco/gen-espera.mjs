// Banco de «EN ESPERA» (la vista de App `view==="espera"`: lo pausado, agrupado por etapa; hoy, sobre todo lo listo que espera a que el cliente pida su
// factura), su /impeccable critique del 16-oct en la noche (v10.84.143). La vista vive DENTRO de App: el generador copia su bloque tal cual (de
// `{view==="espera"&&<div>` hasta antes de `{view==="calendar"&&`) a una función de prueba cuyos parámetros son los nombres de App que el bloque usa, y
// extraer.mjs junta lo de módulo (OCard, EsperaGroupBatchBtn, EmptyState…). Lo que App hace se simula aquí: las órdenes en espera (`snoozeActive`;
// App las toma de las tareas de cada rol), el filtro por motivo, reactivar una (`unsnooze`) o en lote (`unsnoozeBatch`), los grupos plegados.
// Lo que la vista pide a App se anota en #log: «accion <id> <acción>», «reactivar-lote <ids>», «motivo <kind>», «buscar-limpia».
// Uso: node gen-espera.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=karla|admin|secretaria|produccion|vendedor · lectura=no · caso=vacio|solo-factura|mezcla · buscar=<texto>
// Gancho: window.__cambiar(id, campos) cambia una orden con la vista abierta (el tiempo real). El reloj lo fija la tanda (viernes 16-oct-2026, 12:00).
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
// el bloque de la vista en App: de su montaje hasta antes del calendario
const ini = L.findIndex(x => x.trim().startsWith('{view==="espera"&&'));
const fin = L.findIndex((x, i) => i > ini && x.includes('{view==="calendar"&&'));
if (ini < 0 || fin < 0) throw new Error("no encuentro el bloque de «En espera» en App (de view===\"espera\" al calendario)");
const bloque = L.slice(ini, fin).join("\n");
if (!/<\/div>\}\s*$/.test(bloque)) throw new Error("el bloque de «En espera» no termina como se esperaba (</div>})");
// los nombres de App que usa el bloque (si App le agrega otro, el banco truena con «X is not defined» y aquí se agrega)
const DE_APP = ["view", "esperaCount", "search", "setSearch", "esperaOrders", "esperaKindCounts", "esperaEffKind", "setEsperaKindFilter", "esperaShown", "loaded",
  "lectura", "user", "userLogin", "esperaGroupPrefs", "setEsperaGroupOpen", "unsnoozeBatch", "handleAction", "actionLoading", "exitingIds", "orders"];
const PRUEBA = `\nfunction __EnEsperaDeApp({ ${DE_APP.join(", ")} }) {\n  return <>\n${bloque}\n  </>;\n}\n`;
const SIMULADOS = ["supabase", "db", "SignedImg", "firmarOrderFile", "propsArchivoFirmado", "useSignedFile", "abrirArchivoFirmado"];
const { codigo, simuladosUsados } = extraer(fuente + PRUEBA, ["__EnEsperaDeApp", "snoozeActive", "VIEW_MAXW"], { simulados: SIMULADOS });
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
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.slice(-60).join("\\n"); };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
const db = { getOrderChangeLog: async () => [] };
const supabase = {};
const propsArchivoFirmado = () => ({});
const firmarOrderFile = async src => src;
function SignedImg({ alt, style }) { return <span style={style} aria-label={alt} />; }
const Q = new URLSearchParams(location.search);
const ROL = Q.get("rol") || "karla", LOGIN = { secretaria: "secretaria", karla: "karla", admin: "marcelo", produccion: "gerardo", vendedor: "genaro" }[ROL] || ROL;
const SIN_LECTURA = Q.get("lectura") === "no", CASO = Q.get("caso") || "", BUSCAR = Q.get("buscar") || "";
const T = s => new Date(s).toISOString();
const hace = d => new Date(new Date("2026-10-16T12:00:00-06:00").getTime() - d * 86400000).toISOString();
// una orden; «espera» = días que lleva pausada (snoozed_at) y su motivo
const o = (pn, x = {}) => ({ id: "OP-" + pn, production_number: pn, client: "CLIENTE " + pn, product_type: "Volantes", product: "VOLANTES", quantity: 1000, stage: "salidas",
  priority: "normal", order_type: "interna", price: 1000, created_by: "secretaria", agent: "Genaro", client_agent: "Eva Martínez", client_phone: "4771234567", client_lada: "+52",
  created_at: T("2026-09-01T09:00:00-06:00"), due_date: "2026-10-30", notes_log: [], comments: [], image_url: "",
  timeline: [{ to: x.stage || "salidas", date: x.snoozed_at || hace(1), action: "→ " + (x.stage || "salidas") }], ...x });
const FACTURA = (dias, x = {}) => ({ snooze_reason: "El cliente aún no ha pedido factura/remisión", snooze_kind: "awaiting_client_invoice", snoozed_by: "karla",
  snoozed_at: hace(dias), snooze_until: null, snooze_stage: x.stage || "salidas", ...x });
const BASE = [
  // lo listo que espera al cliente, en Salidas: el orden alfabético NO es el de antigüedad (P-0070 lleva 82 días)
  o("P-0601", { client: "AA PRIMERO EN EL ALFABETO", price: 1500, due_date: "2026-10-28", ...FACTURA(1) }),
  o("P-0070", { client: "TRANSPORTES CASTORES DE BAJA", price: 21700, created_at: T("2026-07-01T09:00:00-06:00"), due_date: "2026-07-30", ...FACTURA(82) }),
  o("P-0389", { client: "PREMIUM RESTAURANT BRANDS", price: 9446, due_date: "2026-09-20", agent: "Manuel", ...FACTURA(33) }),   // de otro vendedor
  o("P-0431", { client: "AUTOBUSES DE LA PIEDAD", price: 1036, due_date: "2026-09-25", ...FACTURA(28) }),
  o("P-0506", { client: "PREMIUM RESTAURANT BRANDS", price: 2500, due_date: "2026-10-05", ...FACTURA(19) }),
  o("P-0600", { client: "ZZ ULTIMO EN EL ALFABETO", price: 3000, due_date: "2026-10-20", ...FACTURA(3) }),
  // y recibidas de maquila
  o("P-0610", { stage: "maq_received", order_type: "maquila", price: 0, maq_price: 6000, maq_cost: 4000, client: "MAQUILA ZETA", ...FACTURA(10, { stage: "maq_received" }) }),
  o("P-0611", { stage: "maq_received", order_type: "maquila", price: 0, maq_price: 2500, maq_cost: 1500, client: "MAQUILA ALFA", ...FACTURA(2, { stage: "maq_received" }) }),
  // pausadas del taller (otros motivos), en Listas: éstas sí se reactivan en lote cuando llega el material (P-0621 ya pasó su entrega: el aviso de atraso)
  o("P-0620", { stage: "ready", client: "ESPERA PAPEL", snooze_reason: "Falta el papel couché 150", snooze_kind: "material", snoozed_by: "gerardo", snoozed_at: hace(5),
    snooze_until: "2026-10-20", snooze_stage: "ready" }),
  o("P-0621", { stage: "ready", client: "ESPERA PAPEL DOS", due_date: "2026-10-15", snooze_reason: "Falta el papel bond 90", snooze_kind: "material", snoozed_by: "gerardo", snoozed_at: hace(4),
    snooze_until: "2026-10-22", snooze_stage: "ready" }),
  // y lo que NO sale: sin pausa, y una pausa que ya venció
  o("P-0630", { stage: "ready", client: "SIN PAUSA" }),
  o("P-0631", { stage: "ready", client: "PAUSA VENCIDA", snooze_reason: "Esperaba autorización", snooze_kind: "authorization", snoozed_by: "secretaria", snoozed_at: hace(9),
    snooze_until: "2026-10-10", snooze_stage: "ready" }),
];
const SOLO_FACTURA = BASE.filter(x => x.snooze_kind === "awaiting_client_invoice");
// caso=mezcla: 4 más en Salidas pausadas por Karla por OTRO motivo (el cliente corrige): ésas sí van en lote (4 o más pide confirmar)
const MEZCLA = ["P-0640", "P-0641", "P-0642", "P-0643"].map((pn, i) => o(pn, { client: "CORRIGE " + "ABCD"[i], snooze_reason: "El cliente corrige el texto", snooze_kind: "client_correction",
  snoozed_by: "karla", snoozed_at: hace(6 + i), snooze_until: null, snooze_stage: "salidas" }));
const ORDENES = SIN_LECTURA ? [] : CASO === "vacio" ? BASE.filter(x => !x.snooze_reason) : CASO === "solo-factura" ? SOLO_FACTURA : CASO === "mezcla" ? [...BASE, ...MEZCLA] : BASE;`,
  `// ── extraído de App.jsx por extraer.mjs (con el bloque de la vista dentro de __EnEsperaDeApp) ──\n` + codigo,
  `function Banco() {
  const [orders, setOrders] = useState(ORDENES);
  useEffect(() => { window.__cambiar = (id, x) => { anota("cambiada " + id); setOrders(p => p.map(y => y.id === id ? { ...y, ...x } : y)); }; }, []);
  const [search, setSearchState] = useState(BUSCAR);
  const setSearch = t => { anota(t ? "buscar " + t : "buscar-limpia"); setSearchState(t); };
  const user = ROL, userLogin = LOGIN, view = "espera", actionLoading = null, loaded = true;
  const lectura = SIN_LECTURA ? { ok: null, fallo: Date.now() } : { ok: Date.now(), fallo: null };
  // App: esperaOrders = myTasks.filter(snoozeActive) (las tareas del rol; aquí todas), y el filtro por motivo (líneas de App, tal cual en corto)
  const s = search.trim().toLowerCase();
  const esperaOrders = orders.filter(x => snoozeActive(x) && (!s || (x.production_number || "").toLowerCase().includes(s) || (x.client || "").toLowerCase().includes(s)));
  const [esperaKindFilter, setEsperaKindFilterState] = useState(null);
  const setEsperaKindFilter = k => { anota("motivo " + k); setEsperaKindFilterState(k); };
  const esperaKindCounts = {}; esperaOrders.forEach(x => { const k = x.snooze_kind || "__none"; esperaKindCounts[k] = (esperaKindCounts[k] || 0) + 1; });
  const esperaEffKind = (esperaKindFilter && esperaKindCounts[esperaKindFilter]) ? esperaKindFilter : null;
  const esperaShown = esperaEffKind ? esperaOrders.filter(x => (x.snooze_kind || "__none") === esperaEffKind) : esperaOrders;
  const esperaCount = esperaOrders.length;
  const [esperaGroupPrefs, setEsperaGroupPrefs] = useState({});
  const setEsperaGroupOpen = (st, abierto) => { anota("grupo " + st + " " + (abierto ? "abierto" : "plegado")); setEsperaGroupPrefs(p => ({ ...p, [st]: abierto })); };
  const exitingIds = new Set();
  const quita = { snooze_reason: null, snoozed_by: null, snooze_stage: null, snooze_until: null, snooze_kind: null };
  const unsnoozeBatch = list => { anota("reactivar-lote " + (list || []).map(x => x.id).join(",")); const ids = (list || []).map(x => x.id); setOrders(p => p.map(x => ids.includes(x.id) ? { ...x, ...quita } : x)); };
  const handleAction = (id, accion) => { anota("accion " + id + " " + accion); if (accion === "unsnooze") setOrders(p => p.map(x => x.id === id ? { ...x, ...quita } : x)); };
  return <div style={{ display: "flex", background: C.canvas, minHeight: "100vh" }}>
    <div id="lateral" style={{ width: ${menuAncho[2]}, flexShrink: 0, height: "100vh", borderRight: "0.5px solid #ddd" }} />
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div id="barra" style={{ height: 57, flexShrink: 0, borderBottom: "0.5px solid #ddd" }} />
      ${contenedor}
        <__EnEsperaDeApp ${DE_APP.map(n => n + "={" + n + "}").join(" ")} />
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
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco en espera</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5484), strictPort: true } });
`, "utf8");
console.log("banco de en espera listo en " + outDir);
