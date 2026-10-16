// Banco de «PLANTA» (v10.84.119: el acomodo de las máquinas en el plano de la planta baja). El módulo del plano (src/plano/) se monta tal
// cual, DIFERIDO como en App; de App.jsx se COPIAN por sus anclas el contenedor de las vistas, el montaje de la vista (`view==="plano"`, con lo
// que App le pasa), `navClick`, los atajos de teclado, el Toast y el estilo global, y lo que eso usa sale por extraer.mjs (la guarda de carga,
// TEMA_PLANO, FORMA_ABIERTA…). La base es una tabla `plano_versiones` en memoria con las reglas de la de verdad (docs/migrations/
// v10.84.119_plano_versiones.sql): el autor y las horas los pone «la base», `revision` sube con cada cambio, el nombre es único entre las vivas
// (23505) y borrar es marcar borrado_en.
// Cada llamada se anota en #log: «select lista», «select una <id>», «insert <nombre>», «update <id> <campos>», «toast:<tipo>:<mensaje>»,
//   «vista:<vista>», «print <tamaño>».
// Uso: node gen-plano.mjs <App.jsx> <dirSalida>
// Variantes por URL:
//   rol=produccion|admin (produccion: gerardo) · versiones=0|2 (2: «Acomodo A» de gerardo con la PM-74 movida 3 m, y «Acomodo B» de marcelo con
//   una mesa agregada, la más reciente) · danada=1 (más «Dañada»: una pieza sin nombre ni medidas) · ultima=<id> (la última que se abrió aquí) ·
//   borrador=<id>|original (cambios sin guardar de la otra vez: la PM-74 movida 5 m) · lento=N (segundos de lo lento; 2 por omisión)
//   modo= (con comas) sintabla · listafalla (leer la lista falla siempre) · listafalla1 (sólo la primera vez) · abrirfalla · guardafalla ·
//     insertfalla · sinpermiso (escribir: 42501) · lento (todo tarda) · guardalento (guardar tarda) · borrarfalla · restaurarfalla ·
//     jwt (escribir: la sesión vencida, PGRST301)
// window.__otroGuarda(id) / __otroBorra(id): Marcelo guarda o borra esa versión en otra computadora (sube su revisión) ·
// window.__tabla() las filas · window.__ir(vista) un clic en el menú lateral (el navClick de App) · window.__hoja el HTML de la última hoja
//   que se mandó a imprimir.
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { createRequire } from "node:module";
import { extraer } from "./extraer.mjs";
const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const pedazo = (inicio, fin, que) => {
  const s = L.findIndex(l => l.startsWith(inicio)); if (s < 0) throw new Error("no encuentro " + que);
  if (!fin) return L[s];
  let e = s; while (!L[e].startsWith(fin)) { if (++e > s + 700) throw new Error("sin cierre: " + que); }
  return L.slice(s, e + 1).join("\n");
};
const linea = (trozo, que) => { const l = L.find(x => x.includes(trozo)); if (!l) throw new Error("no encuentro " + que); return l.trim(); };
const contenedor = linea('<div style={{boxSizing:"border-box",width:"100%",maxWidth:view==="board"', "el contenedor de las vistas");
const montaje = linea('{view==="plano"&&', "el montaje de la vista «Planta» (view===\"plano\")");
const navClick = pedazo("  const navClick=", null, "navClick de App");
const atajos = pedazo("  // v10.65.1 — atajos de teclado", "  }, [user]);", "los atajos de teclado de App");
const montajeToast = linea("{toast&&<Toast", "el montaje del Toast");
const iEstilo = L.findIndex((l, i) => l.trim() === "<style>{`" && (L[i - 1] || "").includes("<link href={FNT}"));
if (iEstilo < 0) throw new Error("no encuentro el estilo global de App (<style>{` después de <link href={FNT}>)");
let fEstilo = iEstilo; while (!L[fEstilo].trim().startsWith("`}</style>")) { if (++fEstilo > iEstilo + 200) throw new Error("sin cierre: el estilo global de App"); }
const estiloApp = L.slice(iEstilo, fEstilo + 1).join("\n");
if (/\$\{/.test(estiloApp)) throw new Error("el estilo global de App ahora usa ${…}: el banco lo copia tal cual y no sabría de dónde sale");
const menuAncho = /width:sbPlegado\?(\d+):(\d+),flexShrink:0,height:"100vh"/.exec(fuente);
if (!menuAncho) throw new Error("no encuentro el ancho del menú lateral de App (width:sbPlegado?…:…)");
const menuUmbral = /const sbPlegado=anchoVentana<(\d+)\?/.exec(fuente);
if (!menuUmbral) throw new Error("no encuentro desde qué ancho de ventana App pliega el menú");

// lo que pone el banco (lo de App) y lo que es de React o del navegador; lo demás que use lo copiado se extrae de App
const APP = new Set(["view", "setView", "user", "userLogin", "userName", "showToast", "supabase", "setEditO", "editO", "toast", "setToast", "PlanoPlanta"]);
const REACT = new Set(["React", "useState", "useEffect", "useCallback", "useMemo", "useRef", "useLayoutEffect", "lazy", "Suspense", "Component"]);
const GLOBALES = new Set(["window", "document", "console", "Number", "String", "Error", "Set", "Map", "Date", "JSON", "Math", "Promise", "Array",
  "Object", "isNaN", "parseFloat", "parseInt", "setTimeout", "clearTimeout", "navigator", "location", "undefined", "NaN", "Infinity"]);
function libres(codigo) {
  const ast = parse("function __w(){\n" + codigo + "\n}", { sourceType: "module", plugins: ["jsx"] });
  const fuera = new Set();
  traverse(ast, { "Identifier|JSXIdentifier"(p) {
    if (!p.isReferencedIdentifier() && !(p.isJSXIdentifier() && p.parentPath.isJSXOpeningElement())) return;
    const n = p.node.name;
    if (p.isJSXIdentifier() && /^[a-z]/.test(n)) return;
    if (p.scope.getBinding(n)) return;
    fuera.add(n);
  } });
  return [...fuera];
}
const sueltos = libres([navClick, atajos, "return <>" + contenedor + montaje + "</div>" + montajeToast + "</>;"].join("\n"));
const delModulo = sueltos.filter(n => !APP.has(n) && !REACT.has(n) && !GLOBALES.has(n));
const RAICES = ["C", "Toast", ...delModulo];
const { codigo, nombres, simuladosUsados } = extraer(fuente, RAICES, { simulados: ["supabase"] });
const sinOrigen = delModulo.filter(n => !nombres.includes(n));
if (sinOrigen.length) throw new Error("lo copiado de App usa algo que el banco no sabe de dónde sale: " + sinOrigen.join(", "));
if (/const PlanoPlanta\s*=/.test(codigo)) throw new Error("extraer.mjs trajo el import diferido de App (su ruta es relativa a src/): el banco lo pone");

const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect, lazy, Suspense, Component } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  `import { MAQUINAS } from "../src/plano/plantaBaja.js";`,
  `import { limpiarPiezas } from "../src/lib/plano.js";`,
  `// el módulo del plano, diferido como en App (aquí su ruta es desde el banco)
const PlanoPlanta = lazy(() => import("../src/plano/PlanoPlanta.jsx"));
// ── la base, simulada: la tabla plano_versiones ──
const Q = new URLSearchParams(location.search);
const ROL = Q.get("rol") || "produccion";
const LOGIN = { produccion: "gerardo", admin: "marcelo" }[ROL] || ROL;
const NOMBRE = { produccion: "", admin: "Marcelo" }[ROL] ?? "";
const M = new Set((Q.get("modo") || "").split(",").filter(Boolean));
const LENTO_MS = Number(Q.get("lento") || 2) * 1000;
const bitacora = [];
const anotar = t => { bitacora.push(t); window.dispatchEvent(new Event("bitacora")); };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const AHORA = Date.now();
const iso = minAtras => new Date(AHORA - minAtras * 60000).toISOString();
const ORIGINAL = limpiarPiezas(MAQUINAS).piezas;
const conMovida = (ps, id, dx) => ps.map(p => p.id === id ? { ...p, x: Math.round((p.x + dx) * 10) / 10 } : p);
const MESA = { id: "o-mesa", nombre: "Mesa de empaque", numero: "", x: 500, y: 1800, largo: 240, ancho: 120, giro: 0, forma: null };
let TABLA = [];
if (Q.get("versiones") === "2") TABLA.push(
  { id: "v-1", nombre: "Acomodo A", piezas: conMovida(ORIGINAL, "m-2", 300), revision: 3, creado_por: "gerardo", creado_en: iso(300), actualizado_por: "gerardo", actualizado_en: iso(120), borrado_en: null, borrado_por: null },
  { id: "v-2", nombre: "Acomodo B", piezas: [...ORIGINAL, MESA], revision: 1, creado_por: "marcelo", creado_en: iso(30), actualizado_por: "marcelo", actualizado_en: iso(30), borrado_en: null, borrado_por: null });
if (Q.get("danada") === "1") TABLA.push({ id: "v-3", nombre: "Dañada", piezas: [...ORIGINAL.slice(0, 3), { id: "x1", nombre: "", x: "a" }, { id: "x2", nombre: "Tarima", x: 100, y: 100, largo: -5, ancho: 100 }],
  revision: 1, creado_por: "marcelo", creado_en: iso(10), actualizado_por: "marcelo", actualizado_en: iso(10), borrado_en: null, borrado_por: null });
// lo que esta computadora recuerda (antes de montar)
try {
  if (Q.get("ultima")) localStorage.setItem("pf-plano-ultima", JSON.stringify(Q.get("ultima")));
  const b = Q.get("borrador");
  if (b) {
    const de = b === "original" ? null : TABLA.find(f => f.id === b);
    localStorage.setItem("pf-plano-borrador", JSON.stringify({ versionId: de ? de.id : (b === "original" ? null : b), versionNombre: de ? de.nombre : (b === "original" ? null : "Una que ya no está"),
      piezas: conMovida(de ? de.piezas : ORIGINAL, "m-2", 500), cuando: AHORA - 12 * 60000 }));
  }
} catch { /* sin almacenamiento */ }
let n = 100, lecturasLista = 0;
const sinTablaE = { code: "PGRST205", message: "Could not find the table 'public.plano_versiones' in the schema cache" };
const sinRed = { message: "TypeError: Failed to fetch" };
const sinPermiso = { code: "42501", message: 'new row violates row-level security policy for table "plano_versiones"' };
const proyectar = (f, cols) => { if (!cols || cols === "*") return { ...f }; const o = {}; for (const c of cols.split(",").map(x => x.trim())) o[c] = f[c] === undefined ? null : JSON.parse(JSON.stringify(f[c])); return o; };
const vivas = () => TABLA.filter(f => !f.borrado_en);
async function ejecutar(t, q) {
  await dormir(M.has("lento") || (q.op !== "select" && M.has("guardalento")) ? LENTO_MS : 60);
  if (t !== "plano_versiones") return { data: null, error: { code: "PGRST205", message: "Could not find the table 'public." + t + "'" } };
  if (M.has("sintabla")) return { data: null, error: sinTablaE };
  if (M.has("jwt") && q.op !== "select") return { data: null, error: { code: "PGRST301", message: "JWT expired" } };
  const filas = TABLA.filter(f => q.filtros.every(fn => fn(f)));
  if (q.op === "select") {
    if (!q.uno) {
      lecturasLista++; anotar("select lista");
      if (M.has("listafalla") || (M.has("listafalla1") && lecturasLista === 1)) return { data: null, error: sinRed };
      let r = [...filas];
      if (q.orden) r.sort((a, b) => (a[q.orden[0]] < b[q.orden[0]] ? -1 : a[q.orden[0]] > b[q.orden[0]] ? 1 : 0) * (q.orden[1] ? 1 : -1));
      if (q.lim) r = r.slice(0, q.lim);
      return { data: r.map(f => proyectar(f, q.cols)), error: null };
    }
    anotar("select una " + q.desc.join("&"));
    if (M.has("abrirfalla")) return { data: null, error: sinRed };
    if (q.uno === "single" && filas.length !== 1) return { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } };
    return { data: filas[0] ? proyectar(filas[0], q.cols) : null, error: null };
  }
  if (q.op === "insert") {
    const v = q.valores;
    anotar("insert " + v.nombre);
    if (M.has("insertfalla")) return { data: null, error: sinRed };
    if (M.has("sinpermiso")) return { data: null, error: sinPermiso };
    const nombre = String(v.nombre || "");
    if (nombre !== nombre.trim() || nombre.length < 1 || nombre.length > 80 || !Array.isArray(v.piezas) || v.piezas.length > 500)
      return { data: null, error: { code: "23514", message: 'new row for relation "plano_versiones" violates check constraint' } };
    if (vivas().some(f => f.nombre.toLowerCase() === nombre.toLowerCase())) return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "plano_versiones_nombre_vivo"' } };
    const ahora = new Date().toISOString();
    const f = { id: "v-" + (++n), nombre, piezas: JSON.parse(JSON.stringify(v.piezas)), revision: 1, creado_por: LOGIN, creado_en: ahora, actualizado_por: LOGIN, actualizado_en: ahora, borrado_en: null, borrado_por: null };
    TABLA.push(f);
    const r = proyectar(f, q.cols);
    return { data: q.uno ? r : [r], error: null };
  }
  if (q.op === "update") {
    const v = q.valores;
    anotar("update " + q.desc.join("&") + " " + Object.keys(v).join(","));
    if ("borrado_en" in v && v.borrado_en && M.has("borrarfalla")) return { data: null, error: sinRed };
    if ("borrado_en" in v && !v.borrado_en && M.has("restaurarfalla")) return { data: null, error: sinRed };
    if ("piezas" in v && M.has("guardafalla")) return { data: null, error: sinRed };
    if (M.has("sinpermiso")) return { data: null, error: sinPermiso };
    for (const f of filas) {
      if ("borrado_en" in v && !v.borrado_en && f.borrado_en && vivas().some(o => o.id !== f.id && o.nombre.toLowerCase() === f.nombre.toLowerCase()))
        return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "plano_versiones_nombre_vivo"' } };
    }
    const ahora = new Date().toISOString();
    for (const f of filas) {
      if ("piezas" in v) f.piezas = JSON.parse(JSON.stringify(v.piezas));
      if ("nombre" in v) f.nombre = v.nombre;
      if ("borrado_en" in v) { if (v.borrado_en && !f.borrado_en) { f.borrado_en = ahora; f.borrado_por = LOGIN; } else if (!v.borrado_en) { f.borrado_en = null; f.borrado_por = null; } }
      f.revision += 1; f.actualizado_por = LOGIN; f.actualizado_en = ahora;
    }
    return { data: q.devolver ? filas.map(f => proyectar(f, q.cols)) : null, error: null };
  }
  return { data: null, error: { message: "operación desconocida" } };
}
function consulta(t) {
  const q = { op: "select", cols: "*", filtros: [], desc: [], orden: null, lim: null, valores: null, uno: null, devolver: false };
  const api = {
    select(c) { if (q.op === "select") q.cols = c || "*"; else { q.cols = c || "*"; q.devolver = true; } return api; },
    insert(v) { q.op = "insert"; q.valores = v; return api; },
    update(v) { q.op = "update"; q.valores = v; return api; },
    eq(c, v) { q.filtros.push(f => f[c] === v); q.desc.push(c + "=" + v); return api; },
    is(c, v) { q.filtros.push(f => (f[c] ?? null) === v); q.desc.push(c + " is " + v); return api; },
    order(c, o) { q.orden = [c, o?.ascending !== false]; return api; },
    limit(k) { q.lim = k; return api; },
    single() { q.uno = "single"; return api; },
    maybeSingle() { q.uno = "maybe"; return api; },
    then(bien, mal) { return ejecutar(t, q).then(bien, mal); },
  };
  return api;
}
const supabase = { from: t => consulta(t) };
window.__tabla = () => JSON.parse(JSON.stringify(TABLA));
window.__otroGuarda = id => { const f = TABLA.find(x => x.id === id); if (!f) return; f.piezas = conMovida(f.piezas, "m-5", 100); f.revision += 1; f.actualizado_por = "marcelo"; f.actualizado_en = new Date().toISOString(); anotar("otro guarda " + id); };
window.__otroBorra = id => { const f = TABLA.find(x => x.id === id); if (!f) return; f.borrado_en = new Date().toISOString(); f.borrado_por = "marcelo"; f.revision += 1; anotar("otro borra " + id); };
window.__agregarVersion = nombre => { const ahora = new Date().toISOString(); TABLA.push({ id: "v-" + (++n), nombre, piezas: ORIGINAL, revision: 1, creado_por: "marcelo", creado_en: ahora, actualizado_por: "marcelo", actualizado_en: ahora, borrado_en: null, borrado_por: null }); anotar("otro agrega " + nombre); };
// imprimir: la hoja va a un marco oculto y se llama a print() de ese marco; aquí print() sólo se anota y la hoja se guarda en window.__hoja
new MutationObserver(ms => { for (const m of ms) for (const nodo of m.addedNodes) if (nodo.tagName === "IFRAME" && nodo.hasAttribute("data-plano-hoja")) {
  try { const w = nodo.contentWindow; w.print = () => { window.__hoja = nodo.contentDocument.documentElement.outerHTML; anotar("print " + (/@page\\{size:([^;]+);/.exec(window.__hoja) || [])[1]); }; } catch (e) { anotar("print sin marco: " + e.message); }
} }).observe(document.body, { childList: true });`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [view, setView] = useState(Q.get("vista") || "plano");
  const [editO, setEditO] = useState(null);
  const user = ROL, userLogin = LOGIN, userName = NOMBRE;
  const [toast, setToast] = useState(null);
  const toastSeq = useRef(0);
  const showToast = useCallback((message, type = "success", action = null) => { anotar("toast:" + type + ":" + message); setToast({ message, type, action, id: ++toastSeq.current }); }, []);
  useEffect(() => { anotar("vista:" + view); }, [view]);
  const [log, setLog] = useState([]);
  useEffect(() => { const f = () => setLog([...bitacora]); window.addEventListener("bitacora", f); f(); return () => window.removeEventListener("bitacora", f); }, []);
  ${navClick.trim()}
  useEffect(() => { window.__ir = id => navClick(id); });
  ${atajos.trim()}
  const [anchoVentana, setAnchoVentana] = useState(() => innerWidth);
  useEffect(() => { const f = () => setAnchoVentana(innerWidth); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);
  const sbPlegado = anchoVentana < ${menuUmbral[1]} ? true : Q.get("menu") === "plegado";
  return <div style={{ display: "flex", background: C.canvas, minHeight: "100vh" }}>
${estiloApp}
    <div id="lateral" style={{ width: sbPlegado ? ${menuAncho[1]} : ${menuAncho[2]}, flexShrink: 0, height: "100vh", position: "sticky", top: 0, overflow: "hidden", borderRight: "0.5px solid #ddd" }}>
      <nav id="menu" style={{ display: "flex", flexDirection: "column", gap: 6, padding: 6 }}>
        {[["pipeline", "Dashboard"], ["plano", "Planta"], ["form", "Nueva"]].map(([id, t]) => <button key={id} id={"ir-" + id} title={t} style={{ fontSize: 10, overflow: "hidden", whiteSpace: "nowrap" }} onClick={() => navClick(id)}>{t}</button>)}
      </nav>
    </div>
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div id="barra" style={{ height: 57, flexShrink: 0, borderBottom: "0.5px solid #ddd" }}/>
      ${contenedor}
        {view !== "plano" && <div id="fuera" data-vista={view} style={{ padding: 20 }}>Vista: {view}</div>}
        ${montaje}
        <pre id="log" style={{ fontSize: 10, color: "#666", maxHeight: 140, overflow: "auto" }}>{log.join("\\n")}</pre>
      </div>
    </div>
    ${montajeToast}
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco plano</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}@keyframes toastIn{from{opacity:0}to{opacity:1}}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
const raiz = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({ root: raiz, plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5186), strictPort: true } });
`, "utf8");
console.log("banco del plano listo en " + outDir + " (" + simuladosUsados.length + " simulados; de módulo para lo copiado: " + delModulo.join(", ") + ")");
