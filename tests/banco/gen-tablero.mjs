// Banco del TABLERO: el Kanban de Producción (con DragCard y el seguimiento de maquila), el tablero de Germán (PreprensaBoard)
// y las fichas (OCard), EXTRAÍDOS de un App.jsx con su lógica real por extraer.mjs (lo que cada uno necesita, sin lista a
// mano) y lo que App hace con lo que piden SIMULADO: soltar una orden en una máquina (onDrop) y cada acción (onAction) se
// anotan en #log y mueven la orden en el estado local, como el optimista de App. La base sólo se toca para el historial de
// una ficha (db.getOrderChangeLog), simulado.
// Uso: node gen-tablero.mjs <App.jsx> <dirSalida>
// Variantes por URL:
//   vista=produccion|german|fichas (por defecto produccion: el Kanban) · rol=produccion|admin|german|karla|… (por defecto
//   el de la vista) · caso=normal|vacio|lleno|mantenimiento (por defecto normal) · mant=off_gto (otra en mantenimiento) · buscar=P-0591 (resalta)
// window.__cambiar(id, {…}) cambia una orden con el tablero abierto (como el tiempo real) · window.__ordenes() las devuelve.
import fs from "node:fs";
import path from "node:path";
import { extraer } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const RAICES = ["Kanban", "DragCard", "MaquilaTracker", "PreprensaBoard", "OCard", "WasteModal", "MaqModal"];   // (las ventanas de merma y maquila, v10.84.59)
const SIMULADOS = ["supabase", "db", "SignedImg", "firmarOrderFile", "propsArchivoFirmado", "useSignedFile", "abrirArchivoFirmado"];
const { codigo, simuladosUsados } = extraer(fuente, RAICES, { simulados: SIMULADOS });
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  `// ── lo que toca la base o Storage, simulado (${simuladosUsados.join(", ")}) ──
const bitacora = [];
const anotar = t => { bitacora.push(t); window.dispatchEvent(new Event("bitacora")); };
const db = { getOrderChangeLog: async () => { anotar("db:getOrderChangeLog"); return []; } };
const supabase = {};
const propsArchivoFirmado = () => ({});
const firmarOrderFile = async src => src;
const IMG = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="#dfe6ee"/></svg>');
function SignedImg({ src, alt, style, onClick, title, fallback }) { return <img src={IMG} alt={alt} style={style} onClick={onClick} title={title} />; }`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `// ── el banco ──
const Q = new URLSearchParams(location.search);
const VISTA = Q.get("vista") || "produccion", CASO = Q.get("caso") || "normal", FALLA = Q.get("falla") || "";   // falla=merma|maquila: la base no la acepta (la ventana sigue abierta, como en App)
const ROL = Q.get("rol") || ({ produccion: "produccion", german: "german", fichas: "produccion" }[VISTA] || "produccion");
// fechas relativas a hoy, para que «vencida» y «hoy» no cambien con el día en que se corre
const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const hace = h => new Date(Date.now() - h * 3600000).toISOString();
const BASE = { client: "SILVIA MARGARITA MARTINEZ HERNANDEZ", client_id: "c1", product: "FORMATO 5 PUNTOS DE SEGURIDAD", product_type: "Formatos",
  quantity: 5000, created_at: hace(120), created_by: "secretaria", due_date: dia(3), paper_type: "BRISTOL", paper_grammage: 180,
  standard_size: "media_carta", ink_front: "4", ink_back: "4", agent: "Manuel", price: 5649, order_type: "interna", priority: "normal",
  plate_status: "new", timeline: [{ stage: "draft" }, { stage: "design" }], notes_log: [], comments: [],
  // con foto, como casi todas las de producción: la miniatura le quita ~46 px al nombre en cada ficha
  image_url: "img1" };
let n = 0;
const orden = (pn, x) => ({ ...BASE, id: "OP-" + pn, production_number: pn, ...x, _n: n++ });
const enMaquina = (pn, maq, pos, x = {}) => orden(pn, { stage: "in_production", current_machine: maq, machine_queue_position: pos,
  machine_log: pos === 0 ? [{ machine: maq, started: hace(2) }] : [], ...x });
const NORMAL = [
  enMaquina("P-0591", "off_pm74", 0, { priority: "urgente", needs_reprint: true, print_version: 1, client: "GOBIERNO DEL ESTADO DE GUANAJUATO" }),
  enMaquina("P-0593", "off_pm74", 1, { client: "RESTAURANTES HAKUNA", product_type: "Menús", quantity: 300 }),
  enMaquina("P-0594", "off_pm74", 2, { client: "ALEJANDRA RODRIGUEZ MANRIQUE IMPRESOS", product_type: "Volantes", quantity: 10000, due_date: dia(-1) }),   // (37 letras, en la cola)
  enMaquina("P-0595", "off_pm52", 0, { client: "LIC. ORLANDO CASAS", product_type: "Hojas membretadas", quantity: 1000 }),
  // la siguiente de la PM52, del mismo tamaño que la activa: al subir queda justo bajo el cursor (el doble clic de producción)
  enMaquina("P-0609", "off_pm52", 1, { client: "LIC. ORLANDO CASAS", product_type: "Hojas membretadas", quantity: 1000 }),
  enMaquina("P-0596", "dig_xerox252", 0, { client: "CERVECERIA MODELO", product_type: "Etiquetas", quantity: 250 }),
  enMaquina("P-0597", "ac_polar115", 0, { client: "CABLESERV MANTENIMIENTO E INSTALACIONES", product_type: "Manteletas", quantity: 20000 }),   // (39 letras, en una de Acabados: las más angostas)
  orden("P-0585", { stage: "packaging", current_machine: "vm_manual", machine_queue_position: 0, machine_log: [{ machine: "vm_manual", started: hace(5) }] }),
  orden("P-0586", { stage: "packaging", current_machine: "vm_manual", machine_queue_position: 1, client: "CABLESERV", product_type: "Tarjetas", quantity: 500 }),
  orden("P-0600", { stage: "ready", priority: "urgente", due_date: dia(0), client: "CASTORES", product_type: "Guías", quantity: 2000 }),
  orden("P-0601", { stage: "ready", due_date: dia(-2), client: "LIC. ORLANDO CASAS", product_type: "Gafettes", quantity: 17 }),
  orden("P-0602", { stage: "ready", due_date: dia(4), client: "GOBIERNO DEL ESTADO DE GUANAJUATO, SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO", product_type: "Reconocimientos", quantity: 1200 }),
  orden("P-0603", { stage: "maquila_in", client: "RESTAURANTES HAKUNA", product_type: "Cajas", quantity: 400, order_type: "interna" }),
  orden("P-0604", { stage: "ready", snooze_reason: "Esperando material o insumo para continuar", snooze_stage: "ready", snoozed_by: "produccion", snooze_kind: "material", snoozed_at: hace(30) }),
  orden("P-0580", { stage: "salidas", client: "LIC. ORLANDO CASAS", quantity: 100, price: 1450 }),
  orden("P-0589", { stage: "salidas", client: "IMPRENTA LEON", product_type: "Libretas", quantity: 60 }),
  orden("P-0605", { stage: "maquila_out", client: "CERVECERIA MODELO", product_type: "Displays", quantity: 50 }),
  // lo de Germán: CTP sin máquina, en el CTP, en la procesadora, placas listas
  orden("P-0599", { stage: "ctp", pantone_front: ["PANTONE 7621 C"] }),
  orden("P-0610", { stage: "ctp", current_machine: "pp_ctp", machine_queue_position: 0, machine_log: [{ machine: "pp_ctp", started: hace(1) }], client: "IMPRENTA LEON" }),
  orden("P-0611", { stage: "ctp", current_machine: "pp_proc", machine_queue_position: 0, machine_log: [{ machine: "pp_proc", started: hace(0.5) }], client: "CABLESERV" }),
  orden("P-0612", { stage: "placas_listas", client: "CASTORES" }),
];
const LLENO = [...NORMAL, ...Array.from({ length: 9 }, (_, i) => enMaquina("P-07" + String(i).padStart(2, "0"), "off_pm74", 3 + i, { client: "CLIENTE EN COLA " + (i + 1) })),
  ...Array.from({ length: 14 }, (_, i) => orden("P-08" + String(i).padStart(2, "0"), { stage: "ready", due_date: dia(i - 3), client: "CLIENTE EN LISTA " + (i + 1) }))];
const ORDENES = CASO === "vacio" ? [] : CASO === "lleno" ? LLENO : NORMAL;
// una máquina en mantenimiento: el registro como lo carga App y MAINT_DOWN como lo llena (useMemo de maintKey)
const MANT = CASO === "mantenimiento" ? [{ id: "m1", machine_id: "off_pm52", started_at: hace(3), ended_at: null, notes: "Rodillo dañado", started_by: "produccion" }] : [];
// mant=<máquina>: además, esa máquina en mantenimiento (p. ej. una libre: mant=off_gto; v10.84.62)
if (Q.get("mant")) MANT.push({ id: "m2", machine_id: Q.get("mant"), started_at: hace(1), ended_at: null, notes: "Cambio de mantilla", started_by: "produccion" });
MAINT_DOWN = new Set(MANT.filter(m => !m.ended_at).map(m => m.machine_id));
// deshacer_ms=1500: cuánto espera el tablero antes de escribir lo que se puede deshacer (v10.84.56; para que las pruebas no
//   esperen 6.5 s). Con un App.jsx anterior la variable no existe y no pasa nada.
try { if (Q.get("deshacer_ms")) DESHACER_MS = Number(Q.get("deshacer_ms")); } catch {}
function Banco() {
  const [ordenes, setOrdenes] = useState(ORDENES);
  // salir del tablero a otra vista (window.__vista("fichas")): lo pendiente de deshacer no se puede perder
  const [vista, setVista] = useState(VISTA);
  const [ventana, setVentana] = useState(null);
  useEffect(() => { window.__vista = v => { anotar("vista:" + v); setVista(v); }; }, []);
  const [, refresca] = useState(0);
  useEffect(() => { const f = () => refresca(x => x + 1); window.addEventListener("bitacora", f); return () => window.removeEventListener("bitacora", f); }, []);
  const ref = useRef(ordenes); ref.current = ordenes;
  useEffect(() => { window.__cambiar = (id, p) => setOrdenes(os => os.map(o => o.id === id || o.production_number === id ? { ...o, ...p } : o)); window.__ordenes = () => ref.current; }, []);
  // mover una orden; si deja una máquina, la fila de esa máquina sube un lugar (lo que hace moveOrderInQueue en la base: la
  //   siguiente queda ACTIVA en el mismo lugar de la pantalla, y ahí es donde cae el segundo clic de un doble clic)
  const mover = (id, f) => setOrdenes(os => { const o = os.find(x => x.id === id); if (!o) return os;
    const n = { ...o, ...f(o, os) }, deja = o.current_machine && o.machine_queue_position != null && n.current_machine !== o.current_machine;
    return os.map(x => x.id === id ? n : deja && x.current_machine === o.current_machine && x.machine_queue_position > o.machine_queue_position
      ? { ...x, machine_queue_position: x.machine_queue_position - 1, ...(x.machine_queue_position - 1 === 0 ? { machine_log: [{ machine: x.current_machine, started: new Date().toISOString() }] } : {}) } : x); });
  // lo que hace App con cada cosa que pide el tablero, en corto (el optimista): mover la orden donde dice
  const onDrop = (id, maq, deshacer) => { anotar("drop:" + (ref.current.find(o => o.id === id)?.production_number || id) + " → " + maq);
    mover(id, (o, os) => maq === "vm_manual" ? { stage: "packaging", current_machine: "vm_manual", machine_queue_position: null }
      : { stage: "in_production", current_machine: maq, machine_queue_position: os.filter(x => x.current_machine === maq && x.machine_queue_position != null).length }); };
  const onAction = (id, accion, arg) => { const pn = ref.current.find(o => o.id === id)?.production_number || id;
    anotar("accion:" + accion + " " + pn + (arg != null ? " " + (typeof arg === "object" ? JSON.stringify(arg) : arg) : ""));
    if (accion === "advance") mover(id, () => arg === "packaging" ? { stage: "packaging", current_machine: "vm_manual", machine_queue_position: null } : { stage: arg, current_machine: null, machine_queue_position: null });
    if (accion === "return_to_ready") mover(id, () => ({ stage: "ready", current_machine: null, machine_queue_position: null }));
    // las ventanas de merma y maquila, las REALES (como App: se cierran cuando se guardó)
    if (accion === "waste" || accion === "send_maquila") setVentana({ tipo: accion, id }); };
  const showToast = (m, t) => anotar("aviso" + (t ? "(" + t + ")" : "") + ": " + m);
  const buscar = Q.get("buscar") || "";
  const match = buscar ? (o => (o.production_number || "").includes(buscar) || (o.client || "").toLowerCase().includes(buscar.toLowerCase())) : null;
  return <div style={{ padding: "14px 16px", fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    {vista === "produccion" && <><Kanban orders={ordenes} match={match} searchText={buscar} onClearSearch={() => anotar("quitar búsqueda")} onDrop={onDrop} onAction={onAction}
      role={ROL} maintenance={MANT} onMaintenance={(t, m) => anotar("mantenimiento:" + t + " " + (m?.id || m))} showToast={showToast} actionLoading={null} />
      <MaquilaTracker orders={ordenes} onAction={onAction} role={ROL} userLogin={ROL} /></>}
    {vista === "german" && <PreprensaBoard orders={ordenes} onDrop={onDrop} onAction={onAction} onPlateRequired={o => anotar("placas:" + o.production_number)} maintenance={MANT} role={ROL} />}
    {vista === "fichas" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(440px,1fr))", gap: 10 }}>
      {ordenes.map(o => <OCard key={o.id} o={o} role={ROL} onAction={onAction} busy={false} noDragHint userLogin={ROL} />)}</div>}
    {ventana?.tipo === "waste" && <WasteModal order={ordenes.find(o => o.id === ventana.id)} onClose={() => { anotar("ventana cerrada"); setVentana(null); }}
      onSave={async (pz, pl, n) => { anotar("merma " + (ordenes.find(o => o.id === ventana.id)?.production_number) + " piezas=" + pz + " pliegos=" + pl + " «" + (n || "") + "»"); await new Promise(r => setTimeout(r, 300)); if (FALLA === "merma") { anotar("la base rechazó la merma"); return; } setVentana(null); }} />}
    {ventana?.tipo === "send_maquila" && <MaqModal order={ordenes.find(o => o.id === ventana.id)} providers={[{ name: "MAKILA", phone: "4771234567", email: "" }]} onClose={() => { anotar("ventana cerrada"); setVentana(null); }}
      onSend={async (prov, ph, em, n) => { anotar("maquila " + (ordenes.find(o => o.id === ventana.id)?.production_number) + " a " + prov); await new Promise(r => setTimeout(r, 300)); if (FALLA === "maquila") { anotar("la base rechazó la maquila"); return; } setVentana(null); }} />}
    <pre id="log" style={{ fontSize: 11, color: C.t2 }}>{bitacora.join("\\n")}</pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco del tablero</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5194), strictPort: true } });
`, "utf8");
console.log("banco del tablero listo en " + outDir + " (" + codigo.length + " caracteres extraídos)");
