// Banco de «EN LA PLANTA» (v10.84.67): lo que Karla ve de las órdenes que todavía no llegan a Salidas (`EnLaPlanta`, en su
// vista «Folios»), el aviso de la OC que no se puede foliar entera (`FaltanParaFoliar`), y la pregunta antes de pasar algo a
// Salidas (`preguntaJalar` sobre la `ConfirmModal` real), EXTRAÍDOS de un App.jsx por extraer.mjs con todo lo que usan. Lo
// que hace App al confirmar (doAdv: la fila de la máquina, la bitácora, los avisos) va SIMULADO: la orden pasa a Salidas en el
// estado local, la fila de su máquina sube un lugar, y cada cosa se anota en #log. Lo real de App lo prueba
// tests/recorrido/karla-planta.mjs.
// Uso: node gen-planta.mjs <App.jsx> <dirSalida>
// Variantes por URL:
//   vista=planta|oc (por defecto planta) · oc=OC-0657|OC-0660|OC-0665|OC-LISTA (la OC del aviso) · caso=normal|vacio ·
//   buscar=P-0704 (lo que App filtra con su buscador) · falla=1 (la base rechaza al pasar)
// window.__cambiar(id, {…}) cambia una orden con la pantalla abierta (como el tiempo real) · window.__ordenes() las devuelve.
import fs from "node:fs";
import path from "node:path";
import { extraer } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const RAICES = ["EnLaPlanta", "FaltanParaFoliar", "ConfirmModal", "Toast", "preguntaJalar", "cambioMientrasPregunta"];
const SIMULADOS = ["supabase", "db", "SignedImg", "firmarOrderFile", "propsArchivoFirmado", "useSignedFile", "abrirArchivoFirmado"];
const { codigo, simuladosUsados } = extraer(fuente, RAICES, { simulados: SIMULADOS });
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  `// ── lo que toca la base o Storage, simulado (${simuladosUsados.join(", ") || "nada"}) ──
const bitacora = [];
const anotar = t => { bitacora.push(t); window.dispatchEvent(new Event("bitacora")); };
const db = {};
const supabase = {};
const propsArchivoFirmado = () => ({});
const firmarOrderFile = async src => src;
function SignedImg({ alt, style }) { return <span style={style} aria-label={alt} />; }`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `// ── el banco ──
const Q = new URLSearchParams(location.search);
const VISTA = Q.get("vista") || "planta", CASO = Q.get("caso") || "normal", FALLA = Q.get("falla") === "1";
const OC_VISTA = Q.get("oc") || "OC-0657", BUSCAR = Q.get("buscar") || "";
// fechas relativas a hoy (la fecha LOCAL), para que «ayer» y «hoy» no cambien con la hora en que se corre
const hace = h => new Date(Date.now() - h * 3600000).toISOString();
const ayerA = (hh, mm) => { const x = new Date(); x.setDate(x.getDate() - 1); x.setHours(hh, mm, 0, 0); return x.toISOString(); };
const haceDias = (d, hh, mm) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(hh, mm, 0, 0); return x.toISOString(); };
const hoyA = (hh, mm) => { const x = new Date(); x.setHours(hh, mm, 0, 0); return x.getTime() > Date.now() ? hace(1) : x.toISOString(); };
const dia = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
const BASE = { client: "CERVECERIA MODELO", client_id: "c1", product_type: "Etiquetas", quantity: 5000, created_at: hace(200), created_by: "secretaria",
  due_date: dia(3), agent: "Manuel", price: 5649, order_type: "interna", priority: "normal", timeline: [], machine_log: [], notes_log: [], comments: [] };
const orden = (pn, x) => ({ ...BASE, id: "OP-" + pn, production_number: pn, ...x });
// en una máquina: la activa (pos 0) arrancó a «desde»; las de la fila llegaron a producción a «desde»
const enMaquina = (pn, maq, pos, desde, x = {}) => orden(pn, { stage: "in_production", current_machine: maq, machine_queue_position: pos,
  machine_log: pos === 0 ? [{ machine: maq, started: desde }] : [], timeline: [{ action: "⚙️ Máquina", date: desde, to: "in_production" }], ...x });
const enEmpaque = (pn, desde, x = {}) => orden(pn, { stage: "packaging", current_machine: "vm_manual", machine_queue_position: null,
  machine_log: [{ machine: "vm_manual", started: desde }], timeline: [{ action: "📦 Empaque", date: desde, to: "packaging" }], ...x });
const en = (pn, stage, desde, x = {}) => orden(pn, { stage, timeline: [{ action: stage, date: desde, to: stage }], ...x });
const NORMAL = [
  // OC-0657 (CERVECERIA MODELO): 3 de 5 en Salidas; las 2 que faltan se pueden pasar (una corriendo en la GTO desde ayer, una en Empaque desde hoy)
  en("P-0701", "salidas", hace(30), { purchase_order_id: "OC-0657" }),
  en("P-0702", "salidas", hace(28), { purchase_order_id: "OC-0657", product_type: "Collarines" }),
  en("P-0703", "salidas", hace(26), { purchase_order_id: "OC-0657", product_type: "Cajas" }),
  enMaquina("P-0704", "off_gto", 0, ayerA(16, 20), { purchase_order_id: "OC-0657", product_type: "Etiquetas 10x15" }),
  enEmpaque("P-0705", hoyA(7, 5), { purchase_order_id: "OC-0657", product_type: "Caja plegadiza", quantity: 1000 }),
  // OC-0660 (KFC): 1 en Salidas; falta una en la fila de la PM74 (se puede pasar) y una en CTP (no)
  en("P-0710", "salidas", hace(20), { purchase_order_id: "OC-0660", client: "PREMIUM RESTAURANT BRANDS", product_type: "Manteletas" }),
  enMaquina("P-0711", "off_pm74", 2, hace(5), { purchase_order_id: "OC-0660", client: "PREMIUM RESTAURANT BRANDS", product_type: "Volantes", quantity: 20000 }),
  en("P-0712", "ctp", hace(3), { purchase_order_id: "OC-0660", client: "PREMIUM RESTAURANT BRANDS", product_type: "Bolsas" }),
  // OC-0665 (RESTAURANTES HAKUNA): 1 en Salidas; las otras 2 en la PM74, la que corre y la que sigue: si se pasan juntas, la que
  //   empieza es la de KFC (P-0711), no la segunda de la misma OC
  en("P-0743", "salidas", hace(10), { purchase_order_id: "OC-0665", client: "RESTAURANTES HAKUNA", product_type: "Menús" }),
  enMaquina("P-0741", "off_pm74", 0, hace(1.5), { purchase_order_id: "OC-0665", client: "RESTAURANTES HAKUNA", product_type: "Menús de mesa", quantity: 300 }),
  enMaquina("P-0742", "off_pm74", 1, hace(4), { purchase_order_id: "OC-0665", client: "RESTAURANTES HAKUNA", product_type: "Tarjetas", quantity: 500 }),
  // sueltas que se pueden pasar
  enEmpaque("P-0720", haceDias(2, 10, 15), { client: "CASTORES", product_type: "Guías", quantity: 2000 }),
  enMaquina("P-0721", "off_pm52", 0, hace(3), { client: "LIC. ORLANDO CASAS", product_type: "Hojas membretadas", quantity: 1000 }),
  enMaquina("P-0722", "off_pm52", 1, hace(6), { client: "IMPRENTA LEON", product_type: "Libretas", quantity: 60 }),
  enMaquina("P-0723", "dig_xerox252", 0, hace(2), { client: "CABLESERV", product_type: "Tarjetas de presentación", quantity: 500,
    snooze_reason: "Esperando material o insumo para continuar", snooze_stage: "in_production", snoozed_by: "produccion", snooze_kind: "material", snoozed_at: hace(1) }),
  enEmpaque("P-0731", hace(0.5), { client: "GOBIERNO DEL ESTADO DE GUANAJUATO, SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO", product_type: "Reconocimientos con folio consecutivo y holograma", quantity: 1200 }),
  // (vuelta 2) en producción sin máquina, sin cliente, sin producto y sin cantidad: datos a medias que sí existen
  en("P-0732", "in_production", hace(7), { client: null, product_type: null, product: null, quantity: 0, current_machine: null, machine_queue_position: null }),
  // todavía no llegan a máquina (sin botón)
  en("P-0724", "ready", hace(8), { client: "ALEJANDRA RODRIGUEZ MANRIQUE IMPRESOS", product_type: "Volantes", quantity: 10000 }),
  en("P-0725", "design", hace(9), { client: "RESTAURANTES HAKUNA", product_type: "Cajas" }),
  // en maquila (sin botón)
  en("P-0726", "maq_in_progress", hace(40), { client: "CERVECERIA MODELO", product_type: "Displays", order_type: "maquila", maq_provider: "MAKILA", maq_price: 3000, maq_cost: 2000 }),
  en("P-0727", "maquila_out", hace(30), { client: "IMPRENTA LEON", product_type: "Encuadernado" }),
  // lo que ya no está en la planta: no sale
  orden("P-0728", { stage: "cancelled", cancelled_at: hace(5), current_machine: null }),
  orden("P-0729", { stage: "delivered", delivered_at: hace(5) }),
  en("P-0730", "salidas", hace(4), { client: "LIC. ORLANDO CASAS" }),
];
const ORDENES = CASO === "vacio" ? NORMAL.filter(o => ["salidas", "delivered", "cancelled"].includes(o.stage)) : NORMAL;
// los ids de cada OC del aviso (lo que App le pasa: las órdenes de la OC sin folio y vivas)
const OC_LISTA = [en("P-0750", "salidas", hace(3), { purchase_order_id: "OC-LISTA" }), en("P-0751", "salidas", hace(2), { purchase_order_id: "OC-LISTA" })];
function Banco() {
  const [ordenes, setOrdenes] = useState(VISTA === "oc" && OC_VISTA === "OC-LISTA" ? [...ORDENES, ...OC_LISTA] : ORDENES);
  const [pregunta, setPregunta] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [, refresca] = useState(0);
  useEffect(() => { const f = () => refresca(x => x + 1); window.addEventListener("bitacora", f); return () => window.removeEventListener("bitacora", f); }, []);
  const ref = useRef(ordenes); ref.current = ordenes;
  const jalando = useRef(false);
  useEffect(() => { window.__cambiar = (id, p) => setOrdenes(os => os.map(o => o.id === id || o.production_number === id ? { ...o, ...p } : o)); window.__ordenes = () => ref.current; }, []);
  // lo que hace App (doAdv) al pasar una a Salidas, en corto: sale de su máquina y la fila sube un lugar (moveOrderInQueue)
  const aSalidas = id => setOrdenes(os => { const o = os.find(x => x.id === id); if (!o) return os;
    const deja = o.current_machine && o.current_machine !== "vm_manual" && o.machine_queue_position != null;
    return os.map(x => x.id === id ? { ...x, stage: "salidas", current_machine: null, machine_queue_position: null }
      : deja && x.current_machine === o.current_machine && x.machine_queue_position > o.machine_queue_position
        ? { ...x, machine_queue_position: x.machine_queue_position - 1, ...(x.machine_queue_position - 1 === 0 ? { machine_log: [{ machine: x.current_machine, started: new Date().toISOString() }] } : {}) } : x); });
  const pedir = ids => { const lista = ids.map(id => ref.current.find(o => o.id === id)).filter(Boolean);
    anotar("pide:" + lista.map(o => o.production_number).join(","));
    setPregunta(preguntaJalar(lista, ref.current, async () => {
      jalando.current = true;
      anotar("jalar:" + lista.map(o => o.production_number).join(","));
      await new Promise(r => setTimeout(r, 300));
      if (FALLA) { anotar("la base rechazó"); jalando.current = false; setPregunta(null); setAviso({ m: "❌ " + lista[0].production_number + " no pasó a «Salidas»: la base no lo aceptó.", t: "error" }); return; }
      lista.forEach(o => aSalidas(o.id));
      jalando.current = false; setPregunta(null);
      setAviso({ m: lista.map(o => o.production_number).join(" y ") + (lista.length === 1 ? " ya está en Salidas." : " ya están en Salidas."), t: "success" });
    })); };
  // la pregunta se vence si alguna de sus órdenes cambia con ella abierta (otra persona la movió): se cierra y se dice
  useEffect(() => { if (!pregunta?.jalar || jalando.current) return; const c = cambioMientrasPregunta(pregunta.jalar, ordenes);
    if (c) { anotar("pregunta vencida: " + c); setPregunta(null); setAviso({ m: c, t: "warning" }); } }, [ordenes]);
  const buscar = BUSCAR.toLowerCase();
  const filtradas = buscar ? ordenes.filter(o => (o.production_number || "").toLowerCase().includes(buscar) || (o.client || "").toLowerCase().includes(buscar)) : ordenes;
  const delOC = ordenes.filter(o => o.purchase_order_id === OC_VISTA && !o.invoice_folio && !String(o.stage).includes("cancelled") && !String(o.stage).includes("delivered"));
  return <div style={{ display: "flex", minHeight: "100vh", background: C.canvas, fontFamily: "'Geist',sans-serif" }}>
    {/* la barra de la app (222 px): el contenido mide lo que mide en App */}
    {/* (en el celular la app no enseña la barra) */}
    <div style={{ width: innerWidth < 768 ? 0 : 222, flexShrink: 0, background: C.sf }} aria-hidden="true" />
    <main id="contenido" style={{ flex: 1, minWidth: 0, padding: "14px 16px" }}>
      {VISTA === "planta" && <EnLaPlanta orders={filtradas} todas={ordenes} buscando={BUSCAR} onJalar={pedir} onDetalle={id => anotar("detalle:" + (ref.current.find(o => o.id === id)?.production_number || id))} ocupada={null} />}
      {VISTA === "oc" && <FaltanParaFoliar pendientes={delOC} onJalar={pedir} />}
      {/* como en la OC de App: con todas en Salidas aparece «Asignar folio» */}
      {VISTA === "oc" && delOC.length > 0 && delOC.every(o => ["salidas", "maq_received"].includes(o.stage)) && <button data-accion="asignar-folio-oc" onClick={() => anotar("asignar folio " + OC_VISTA)}>Asignar folio</button>}
      <pre id="log" style={{ fontSize: 11, color: C.t2 }}>{bitacora.join("\\n")}</pre>
    </main>
    {pregunta && <ConfirmModal {...pregunta} onClose={() => { const c = pregunta.onCancel; anotar("pregunta cerrada"); setPregunta(null); if (c) c(); }} />}
    {aviso && <Toast key={aviso.m} message={aviso.m} type={aviso.t} onDone={() => setAviso(null)} />}
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco de en la planta</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5193), strictPort: true } });
`, "utf8");
console.log("banco de en la planta listo en " + outDir + " (" + codigo.length + " caracteres extraídos)");
