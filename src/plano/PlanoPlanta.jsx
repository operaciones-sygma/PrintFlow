// v10.84.119 — «Planta»: el plano de la planta baja para acomodar las máquinas (Marcelo, 16-oct: «que Gerardo pueda hacer un acomodo de
//   máquinas como él lo desee en el área de trabajo, pueda rotar, trasladar máquinas a su gusto, también crear máquinas/objetos adicionales
//   y ponerles medidas; que pueda guardar versiones de acomodos e imprimirlos en PDF; fácil de usarse y entenderlo»).
//   Módulo aparte y DIFERIDO (React.lazy en App: el plano pesa ~60 KB y sólo lo abren Producción y Dirección). La geometría vive en
//   src/lib/plano.js (encimadas, choques con muros, medidas: probada con Node); lo fijo de la planta, en plantaBaja.js (del PDF del
//   levantamiento); la hoja impresa, en hoja.js. Las versiones, en public.plano_versiones (docs/migrations/v10.84.119_plano_versiones.sql):
//   la base pone quién y cuándo, y `revision` evita guardar encima de lo que otro guardó mientras tanto. Sin esa tabla, el plano igual se
//   acomoda e imprime. Lo que no se ha guardado se queda en esta computadora (un borrador) y se ofrece al volver.
//   Pruebas: tests/romper/plano.mjs, con su banco tests/banco/gen-plano.mjs.
import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, useReducer } from "react";
import { ArrowClockwise as ArrowClockwiseIcon, ArrowCounterClockwise as ArrowCounterClockwiseIcon, ArrowUUpLeft as ArrowUUpLeftIcon, ArrowUUpRight as ArrowUUpRightIcon, Plus as PlusIcon, Copy as CopyIcon, Trash as TrashIcon, MagnifyingGlassPlus as MagnifyingGlassPlusIcon, MagnifyingGlassMinus as MagnifyingGlassMinusIcon, CornersOut as CornersOutIcon, Printer as PrinterIcon, FloppyDisk as FloppyDiskIcon, Warning as WarningIcon, X as XIcon, ArrowsClockwise as ArrowsClockwiseIcon } from "@phosphor-icons/react";
import * as G from "../lib/plano.js";
import { CAJA, MUROS, VIDRIOS, PUERTAS, FIJOS, ESCALERAS, PUNTEADO, PROYECCION, DIVISIONES, AREAS, MAQUINAS } from "./plantaBaja.js";
import { hojaParaImprimir, escalaDe, imprimirEnMarco, medidas, cm } from "./hoja.js";

const OBSTACULOS = [...G.segmentosDe(MUROS, "muro"), ...G.segmentosDe(VIDRIOS, "muro"), ...G.segmentosDe(DIVISIONES, "muro"), ...G.segmentosDe(FIJOS, "fijo"), ...G.segmentosDe(ESCALERAS, "fijo")];
export const ORIGINAL = G.limpiarPiezas(MAQUINAS).piezas;
const TABLA = "plano_versiones";
const COLUMNAS = "id,nombre,revision,creado_por,creado_en,actualizado_por,actualizado_en";
const BORRADOR = "pf-plano-borrador", ULTIMA = "pf-plano-ultima";
const HISTORIA_MAX = 100;
const LISTA_MAX = 200;
const PLANTA = { x0: 0, y0: 0, x1: CAJA.ancho, y1: CAJA.alto, ancho: CAJA.ancho, alto: CAJA.alto };

// ── lo que se guarda en esta computadora (con try: sin almacenamiento, el plano sigue) ──
const leerLocal = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const escribirLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio o sin permiso: no se guarda el borrador */ } };
const quitarLocal = k => { try { localStorage.removeItem(k); } catch { /* nada */ } };

// ── lo que dice la base, en palabras ──
export const sinTabla = e => !!e && (e.code === "PGRST205" || e.code === "42P01" || (/plano_versiones/.test(e.message || "") && /schema cache|does not exist|no existe/i.test(e.message || "")));
export function enPalabras(e, que) {
  if (!e) return "";
  const m = String(e.message || "");
  if (sinTabla(e)) return "Las versiones todavía no se pueden guardar: falta su tabla en la base.";
  if (e.code === "23505") return "Ya hay una versión con ese nombre: ponle otro.";
  if (e.code === "42501" || /row-level security|permission denied/i.test(m)) return "Tu usuario no tiene permiso de " + que + ".";
  if (e.code === "23514") return "La base no aceptó la versión (el nombre o las piezas no pasan su revisión).";
  if (e.code === "PGRST301" || e.code === "PGRST303" || /jwt|token.*expir|not authenticated/i.test(m)) return "Tu sesión se venció: vuelve a entrar. Lo que cambiaste se queda guardado en esta computadora.";
  if (/failed to fetch|networkerror|network|timeout|load failed/i.test(m)) return "No hubo conexión con la base. Revisa el internet y vuelve a intentar.";
  return "La base contestó: " + (m || "un error sin descripción") + ".";
}
const hora = iso => { try { return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const fechaCorta = iso => { try { const d = new Date(iso); const hoy = new Date(); return d.toDateString() === hoy.toDateString() ? "hoy " + hora(iso) : d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }) + " " + hora(iso); } catch { return ""; } };
const haceCuanto = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "hace un momento" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const persona = u => u ? String(u).charAt(0).toUpperCase() + String(u).slice(1) : "";   // el usuario como se dice («gerardo» → «Gerardo»)
const versionDe = f => f ? { id: f.id, nombre: f.nombre, revision: f.revision, creado_por: f.creado_por, actualizado_por: f.actualizado_por, actualizado_en: f.actualizado_en } : null;
const textoChoque = r => [r.choca.includes("muro") && "choca con un muro o columna", r.choca.includes("fijo") && "choca con la escalera o los baños"].filter(Boolean);

// Un campo que se aplica al salir de él o con Enter (Esc lo regresa a como estaba); lo que no se puede leer se dice abajo y no se aplica
function Campo({ etiqueta, valor, leer, alCambiar, sufijo, ancho, tema, nombre, inputMode = "decimal" }) {
  const { C, inp } = tema;
  const [texto, setTexto] = useState(String(valor));
  const [msg, setMsg] = useState(null);
  const enfocado = useRef(false);
  const sinAplicar = useRef(false);   // Esc: salir SIN aplicar (vuelta 1, pln-18: el blur llegaba con el texto escrito y lo aplicaba)
  useEffect(() => { if (!enfocado.current) { setTexto(String(valor)); setMsg(m => m?.tipo === "error" ? null : m); } }, [valor]);
  const aplicar = () => {
    const r = leer(texto);
    if (r.error) { setMsg({ tipo: "error", t: r.error }); return; }
    setMsg(r.aviso ? { tipo: "aviso", t: r.aviso } : null);
    setTexto(String(r.valor));
    if (r.valor !== valor) alCambiar(r.valor);
  };
  return <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: ancho ? "0 0 " + ancho + "px" : "1 1 auto" }}>
    <label style={{ fontSize: 10, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: .3 }}>{etiqueta}
      <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <input name={nombre} value={texto} inputMode={inputMode} autoComplete="off" aria-invalid={msg?.tipo === "error" || undefined}
          onFocus={e => { enfocado.current = true; e.target.select(); }}
          onBlur={() => { enfocado.current = false; if (sinAplicar.current) { sinAplicar.current = false; return; } aplicar(); }}
          onChange={e => { setTexto(e.target.value); if (msg?.tipo === "error") setMsg(null); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); aplicar(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); sinAplicar.current = true; setTexto(String(valor)); setMsg(null); enfocado.current = false; e.currentTarget.blur(); } }}
          style={{ ...inp, padding: "8px 10px", fontSize: 13, textTransform: "none", letterSpacing: 0, fontWeight: 500, boxShadow: "0 0 0 1px " + (msg?.tipo === "error" ? C.dnInk : C.bd) }} />
        {sufijo && <span style={{ fontSize: 12, color: C.t2, textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>{sufijo}</span>}
      </span>
    </label>
    {msg && <div role={msg.tipo === "error" ? "alert" : "status"} style={{ fontSize: 11.5, lineHeight: 1.35, color: msg.tipo === "error" ? C.dnInk : C.wnTx }}>{msg.t}</div>}
  </div>;
}

// Una ventana de la app (nunca confirm()/alert()): Esc y el fondo cierran sólo si no hay nada escrito; Tab se queda adentro
function Ventana({ titulo, children, botones, alCerrar, tema, sucia = false, ancho = 460 }) {
  const { C } = tema;
  const caja = useRef(null);
  useLayoutEffect(() => { const b = caja.current?.querySelector("input,button[data-principal]") || caja.current?.querySelector("button"); b?.focus({ preventScroll: true }); }, []);
  const tecla = e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (!sucia) alCerrar(); return; }
    if (e.key !== "Tab") return;
    const f = [...caja.current.querySelectorAll("button:not([disabled]),input:not([disabled])")];
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  };
  return <div onMouseDown={e => { if (e.target === e.currentTarget && !sucia) alCerrar(); }} style={{ position: "fixed", inset: 0, background: "rgba(26,26,31,.38)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "12vh 16px 16px" }}>
    <div ref={caja} role="dialog" aria-modal="true" aria-labelledby="plano-ventana-titulo" onKeyDown={tecla} style={{ width: "100%", maxWidth: ancho, background: C.bg, borderRadius: 20, boxShadow: C.sh3, padding: "20px 22px", fontFamily: "'Geist',sans-serif", color: C.tx }}>
      <h3 id="plano-ventana-titulo" style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}>{titulo}</h3>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: C.tx }}>{children}</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 18 }}>{botones}</div>
    </div>
  </div>;
}

export default function PlanoPlanta({ supabase, usuario = "", nombre = "", tema, avisar, registrarSalida, imprimir = imprimirEnMarco }) {
  const { C, bt, bs } = tema;
  // ── el acomodo, lo guardado y la historia ──
  // (vuelta 1, pln-44: la historia vivía en tres estados que se movían DENTRO de las funciones de actualizar de React, que corren después y
  //   leían el acomodo ya cambiado: con dos Ctrl+Z seguidos, «rehacer» se quedaba sin nada. Ahora es UNA cosa y se cambia de un golpe.)
  const historia = useRef({ piezas: ORIGINAL, pasado: [], futuro: [] });
  const [, repintar] = useReducer(n => n + 1, 0);
  const { piezas, pasado, futuro } = historia.current;
  const [base, setBase] = useState(ORIGINAL);           // lo guardado (o el levantamiento): contra esto se sabe si hay cambios
  const [version, setVersion] = useState(null);          // null = el plano del levantamiento
  const [sel, setSel] = useState(null);
  const [arrastre, setArrastre] = useState(null);       // {id, x, y} mientras se arrastra (no entra a la historia hasta soltar)
  const [lista, setLista] = useState({ estado: "leyendo", filas: [], error: null });
  const [abriendo, setAbriendo] = useState(null);
  const [ocupado, setOcupado] = useState(null);          // "guardando" | "borrando" | null
  const [aviso, setAviso] = useState(null);              // {tipo: "error"|"info", texto}
  const [ventana, setVentana] = useState(null);
  const [agregando, setAgregando] = useState(null);      // {nombre, largo, ancho, errores}
  const [menuImprimir, setMenuImprimir] = useState(false);
  const [borradorPendiente, setBorradorPendiente] = useState(null);
  const [listo, setListo] = useState(false);
  const [guardadoA, setGuardadoA] = useState(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [alto, setAlto] = useState(520);
  const [vista, setVista] = useState(null);             // {s: px por cm, dx, dy}

  const piezasRef = { get current() { return historia.current.piezas; } };   // (el acomodo de este momento, también dentro de los manejadores)
  const vistaRef = useRef(vista); vistaRef.current = vista;
  const arrastreRef = useRef(arrastre); arrastreRef.current = arrastre;
  const versionRef = useRef(version); versionRef.current = version;
  const pendienteRef = useRef(borradorPendiente); pendienteRef.current = borradorPendiente;
  const ocupadoRef = useRef(false);
  const ultimoCambio = useRef({ clave: null, t: 0 });
  const gesto = useRef(null);
  const pedido = useRef(0), pedidoLista = useRef(0);
  const ajustadaRef = useRef(true);
  const lienzoRef = useRef(null), svgRef = useRef(null);

  const sucio = useMemo(() => !G.mismasPiezas(piezas, base), [piezas, base]);
  const sucioRef = useRef(sucio); sucioRef.current = sucio;
  const visibles = useMemo(() => arrastre ? piezas.map(p => p.id === arrastre.id ? { ...p, x: arrastre.x, y: arrastre.y } : p) : piezas, [piezas, arrastre]);
  const prob = useMemo(() => G.problemas(visibles, OBSTACULOS), [visibles]);
  const conProblema = useMemo(() => visibles.filter(p => prob[p.id] && (prob[p.id].con.length || prob[p.id].choca.length)), [visibles, prob]);
  const pieza = visibles.find(p => p.id === sel) || null;
  // Los letreros, como en un mapa: a su tamaño (el nombre a 12 px, con sus medidas abajo) aunque rebasen su pieza, y SÓLO donde chocan con otro
  //   letrero se quitan las medidas y después se achica el nombre, hasta 8.5 px (vuelta 1: en las dos Aspas se pisaban; vuelta 4, en producción:
  //   achicar todo nombre más ancho que su pieza dejaba ilegible la vista completa a 1366). Las cajas, en px de la pantalla.
  const sLetreros = vista?.s || 0.2;
  const letreros = useMemo(() => {
    const L = visibles.map(p => { const [lx, ly] = G.puntoDelNombre(p), med = medidas(p);
      return { id: p.id, lx, ly, med, n: p.nombre.length, f: 12, conMedidas: G.cajaDe(p).alto * sLetreros >= 30 }; });
    const caja = l => {
      const x = l.lx * sLetreros, y = l.ly * sLetreros, w = Math.max(l.n * 0.64 * l.f, l.conMedidas ? l.med.length * 0.58 * 10.5 : 0) / 2 + 2;
      return l.conMedidas ? [x - w, y - 2 - 0.9 * l.f, x + w, y + 15] : [x - w, y - 0.6 * l.f, x + w, y + 0.65 * l.f];
    };
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      const cajas = L.map(caja);
      let cambio = false;
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = cajas[i], b = cajas[j];
        if (!(a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3])) continue;
        for (const l of [L[i], L[j]]) { if (l.conMedidas) { l.conMedidas = false; cambio = true; } else if (l.f > 8.5) { l.f = Math.max(8.5, l.f - 1.5); cambio = true; } }
      }
      if (!cambio) break;
    }
    const porId = Object.fromEntries(L.map(l => [l.id, l]));
    porId.cajasCm = L.map(l => caja(l).map(v => v / sLetreros));   // (para los nombres de las áreas: los que tapa un letrero no se dibujan)
    return porId;
  }, [visibles, sLetreros]);
  const nombreDe = useMemo(() => Object.fromEntries(visibles.map(p => [p.id, p.nombre])), [visibles]);
  const sinTablaYa = lista.estado === "sintabla";

  // ── cambiar el acomodo (todo pasa por aquí: deshacer lo regresa) ──
  // `juntar`: los pasos seguidos de lo mismo (las flechas sobre una pieza) son UN paso para deshacer
  const cambiar = useCallback((fn, juntar = null) => {
    const antes = piezasRef.current;
    const despues = typeof fn === "function" ? fn(antes) : fn;
    if (!despues || despues === antes || G.mismasPiezas(despues, antes)) return false;
    const ahora = Date.now(), u = ultimoCambio.current;
    const mismo = juntar && u.clave === juntar && ahora - u.t < 1200;
    ultimoCambio.current = { clave: juntar, t: ahora };
    historia.current = { piezas: despues, pasado: mismo ? historia.current.pasado : [...historia.current.pasado.slice(-(HISTORIA_MAX - 1)), antes], futuro: [] };
    repintar();
    if (pendienteRef.current) setBorradorPendiente(null);   // editar sin recuperar el borrador anterior lo descarta (lo decía el aviso)
    return true;
  }, []);
  const deshacer = useCallback(() => {
    const h = historia.current;
    if (!h.pasado.length) return;
    historia.current = { piezas: h.pasado[h.pasado.length - 1], pasado: h.pasado.slice(0, -1), futuro: [h.piezas, ...h.futuro] };
    ultimoCambio.current = { clave: null, t: 0 };
    repintar();
  }, []);
  const rehacer = useCallback(() => {
    const h = historia.current;
    if (!h.futuro.length) return;
    historia.current = { piezas: h.futuro[0], pasado: [...h.pasado, h.piezas], futuro: h.futuro.slice(1) };
    ultimoCambio.current = { clave: null, t: 0 };
    repintar();
  }, []);
  useEffect(() => { if (sel && !piezas.some(p => p.id === sel)) setSel(null); }, [piezas, sel]);

  const moverSel = useCallback((dx, dy) => { if (sel) cambiar(ps => ps.map(p => p.id === sel ? G.mover(p, dx, dy) : p), "flecha:" + sel); }, [sel, cambiar]);
  const girarSel = useCallback(g => { if (sel) cambiar(ps => ps.map(p => p.id === sel ? G.girar(p, g) : p)); }, [sel, cambiar]);
  const duplicarSel = useCallback(() => {
    const p = piezasRef.current.find(q => q.id === sel);
    if (!p) return;
    const id = G.nuevoId(piezasRef.current);
    if (cambiar(ps => [...ps, G.duplicar(p, id, ps)])) setSel(id);
  }, [sel, cambiar]);
  const borrarSel = useCallback(() => {
    const p = piezasRef.current.find(q => q.id === sel);
    if (!p) return;
    // el «Deshacer» del aviso regresa ESA pieza (no el último cambio: para entonces pudo ser otro)
    if (cambiar(ps => ps.filter(q => q.id !== sel))) { setSel(null); avisar?.(`Se quitó «${p.nombre}» del plano`, "info", { label: "Deshacer", onClick: () => cambiar(ps => ps.some(q => q.id === p.id) ? ps : [...ps, p]) }); }
  }, [sel, cambiar, avisar]);
  const cambiarSel = useCallback(campos => { if (sel) cambiar(ps => ps.map(p => p.id !== sel ? p : ("largo" in campos || "ancho" in campos) ? { ...G.conMedidas(p, campos.largo ?? p.largo, campos.ancho ?? p.ancho), ...(campos.nombre ? { nombre: campos.nombre } : {}) } : { ...p, ...campos })); }, [sel, cambiar]);

  // ── el lienzo: su tamaño, el zoom y el arrastre ──
  useLayoutEffect(() => {
    const el = lienzoRef.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setTam(t => (t.w === Math.round(r.width) && t.h === Math.round(r.height)) ? t : { w: Math.round(r.width), h: Math.round(r.height) });
      setAlto(Math.max(380, Math.round(window.innerHeight - (r.top + window.scrollY) - 20)));
    };
    medir();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    window.addEventListener("resize", medir);
    return () => { ro?.disconnect(); window.removeEventListener("resize", medir); };
  }, []);
  // (vuelta 1, a ojo: el aviso «sin tabla» llega con la respuesta de la base y empuja el plano hacia abajo, y el alto se había medido antes:
  //   el plano se salía ~45 px de la pantalla) el alto se vuelve a medir después de cada pintada; sólo cambia si cambió de verdad
  useLayoutEffect(() => {
    const el = lienzoRef.current;
    if (!el) return;
    const a = Math.max(380, Math.round(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - 20));
    if (a !== alto) setAlto(a);
  });
  const cajaDeTodo = useCallback(() => G.juntarCajas([PLANTA, ...piezasRef.current.map(G.cajaDe)]), []);
  const sAjuste = tam.w && tam.h ? Math.min((tam.w - 40) / PLANTA.ancho, (tam.h - 40) / PLANTA.alto) : 0.2;
  const sMin = sAjuste * 0.4, sMax = Math.max(3, sAjuste * 12);
  const ajustar = useCallback(() => {
    if (!tam.w || !tam.h) return;
    const cj = cajaDeTodo();
    const s = Math.min((tam.w - 40) / cj.ancho, (tam.h - 40) / cj.alto);
    ajustadaRef.current = true;
    setVista({ s, dx: (tam.w - cj.ancho * s) / 2 - cj.x0 * s, dy: (tam.h - cj.alto * s) / 2 - cj.y0 * s });
  }, [tam, cajaDeTodo]);
  useEffect(() => { if (tam.w && tam.h && (!vistaRef.current || ajustadaRef.current)) ajustar(); }, [tam, ajustar]);
  const acercar = useCallback((f, px, py) => {
    ajustadaRef.current = false;
    setVista(v => {
      if (!v) return v;
      const s = clamp(v.s * f, sMin, sMax), k = s / v.s;
      return { s, dx: px - (px - v.dx) * k, dy: py - (py - v.dy) * k };
    });
  }, [sMin, sMax]);
  useEffect(() => {
    const el = lienzoRef.current;
    if (!el) return;
    const rueda = e => { e.preventDefault(); const r = el.getBoundingClientRect(); acercar(Math.exp(-clamp(e.deltaY, -120, 120) * 0.002), e.clientX - r.left, e.clientY - r.top); };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  }, [acercar]);
  const verPieza = useCallback(p => {   // si la pieza elegida en la lista no se ve, el plano se recorre hasta ella
    const v = vistaRef.current;
    if (!v || !tam.w) return;
    const cj = G.cajaDe(p);
    const fuera = cj.x0 * v.s + v.dx < 0 || cj.x1 * v.s + v.dx > tam.w || cj.y0 * v.s + v.dy < 0 || cj.y1 * v.s + v.dy > tam.h;
    if (fuera) { ajustadaRef.current = false; setVista({ ...v, dx: tam.w / 2 - p.x * v.s, dy: tam.h / 2 - p.y * v.s }); }
  }, [tam]);

  const alBajar = (e, id) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (ventana) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body && lienzoRef.current?.contains(document.activeElement) === false) document.activeElement.blur?.();
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* sin captura: el arrastre sigue mientras el puntero esté encima */ }
    const v = vistaRef.current;
    if (id) {
      const p = piezasRef.current.find(q => q.id === id);
      if (!p) return;
      setSel(id); setMenuImprimir(false);
      gesto.current = { tipo: "mover", id, x0: e.clientX, y0: e.clientY, px: p.x, py: p.y, movio: false };
    } else gesto.current = { tipo: "recorrer", x0: e.clientX, y0: e.clientY, dx: v?.dx || 0, dy: v?.dy || 0, movio: false };
  };
  const alMover = e => {
    const g = gesto.current, v = vistaRef.current;
    if (!g || !v) return;
    const ddx = e.clientX - g.x0, ddy = e.clientY - g.y0;
    if (!g.movio && Math.hypot(ddx, ddy) < 4) return;   // un clic que tiembla no es arrastre
    g.movio = true;
    if (g.tipo === "mover") setArrastre({ id: g.id, x: G.redondear(g.px + G.conIman(ddx / v.s)), y: G.redondear(g.py + G.conIman(ddy / v.s)) });
    else { ajustadaRef.current = false; setVista({ ...v, dx: g.dx + ddx, dy: g.dy + ddy }); }
  };
  const alSoltar = () => {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;
    if (g.tipo === "mover") {
      const a = arrastreRef.current;
      setArrastre(null);
      if (g.movio && a) cambiar(ps => ps.map(p => p.id === a.id ? { ...p, x: a.x, y: a.y } : p));
    } else if (!g.movio) { setSel(null); setMenuImprimir(false); }
  };
  const alCancelar = () => { gesto.current = null; setArrastre(null); };

  // ── el teclado: flechas, R, Supr, Ctrl+Z / Ctrl+Y / Ctrl+D, Esc ──
  useEffect(() => {
    const tecla = e => {
      if (ventana) return;
      const t = e.target, tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      const ctrl = e.ctrlKey || e.metaKey, k = e.key;
      if (ctrl && !e.altKey && (k === "z" || k === "Z") && !e.shiftKey) { e.preventDefault(); deshacer(); return; }
      if (ctrl && !e.altKey && (k === "y" || k === "Y" || ((k === "z" || k === "Z") && e.shiftKey))) { e.preventDefault(); rehacer(); return; }
      if (k === "Escape") {
        if (gesto.current?.tipo === "mover") { alCancelar(); return; }   // Esc a medio arrastre: la pieza se queda donde estaba
        if (menuImprimir) { setMenuImprimir(false); return; }
        if (sel) setSel(null);
        return;
      }
      if (!sel || e.altKey) return;
      if (ctrl && (k === "d" || k === "D")) { e.preventDefault(); duplicarSel(); return; }
      if (ctrl) return;
      const paso = e.shiftKey ? G.PASO_LARGO : G.IMAN;
      const flechas = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };
      if (flechas[k]) { e.preventDefault(); moverSel(...flechas[k]); return; }
      if (k === "r" || k === "R") { e.preventDefault(); girarSel(e.shiftKey ? -90 : 90); return; }
      if (k === "Delete" || k === "Backspace") { e.preventDefault(); borrarSel(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ventana, sel, menuImprimir, deshacer, rehacer, duplicarSel, moverSel, girarSel, borrarSel]);

  // ── las versiones ──
  const guardarUltima = id => { if (id) escribirLocal(ULTIMA, id); else quitarLocal(ULTIMA); };
  const leerLista = useCallback(async () => {
    if (!supabase) { setLista({ estado: "sintabla", filas: [], error: null }); return null; }
    const n = ++pedidoLista.current;
    setLista(l => l.estado === "listo" ? l : { ...l, estado: "leyendo" });
    let r;
    try { r = await supabase.from(TABLA).select(COLUMNAS).is("borrado_en", null).order("actualizado_en", { ascending: false }).limit(LISTA_MAX); }
    catch (e) { r = { data: null, error: { message: String(e?.message || e) } }; }
    if (n !== pedidoLista.current) return null;
    if (r.error) { setLista(l => ({ ...l, estado: sinTabla(r.error) ? "sintabla" : "falla", error: r.error })); return null; }
    const filas = r.data || [];
    setLista({ estado: "listo", filas, error: null });
    return filas;
  }, [supabase]);
  const aplicarVersion = useCallback((fila, ps) => {
    setVersion(versionDe(fila)); historia.current = { piezas: ps, pasado: [], futuro: [] }; repintar(); setBase(ps); setSel(null); setArrastre(null);
    setGuardadoA(null); ultimoCambio.current = { clave: null, t: 0 }; guardarUltima(fila?.id || "");
  }, []);
  const abrir = useCallback(async id => {
    const n = ++pedido.current;
    setAviso(null);
    if (!id) { setAbriendo(null); aplicarVersion(null, ORIGINAL); return true; }
    setAbriendo(id);
    let r;
    try { r = await supabase.from(TABLA).select(COLUMNAS + ",piezas,borrado_en").eq("id", id).maybeSingle(); }
    catch (e) { r = { data: null, error: { message: String(e?.message || e) } }; }
    if (n !== pedido.current) return false;   // ya se pidió otra: ésta no se pinta
    setAbriendo(null);
    if (r.error) { setAviso({ tipo: "error", texto: "No se pudo abrir la versión. " + enPalabras(r.error, "ver las versiones del plano") }); return false; }
    if (!r.data || r.data.borrado_en) { setAviso({ tipo: "error", texto: "Esa versión ya no existe: alguien la borró." }); leerLista(); return false; }
    const { piezas: ps, descartadas } = G.limpiarPiezas(r.data.piezas);
    aplicarVersion(r.data, ps);
    if (descartadas) setAviso({ tipo: "error", texto: descartadas === 1 ? "Una pieza de esta versión venía dañada y se dejó fuera." : `${descartadas} piezas de esta versión venían dañadas y se dejaron fuera.` });
    return true;
  }, [supabase, aplicarVersion, leerLista]);

  // al entrar: la lista, y se abre la versión del borrador que quedó sin guardar, o la última que se abrió aquí, o el levantamiento
  useEffect(() => {
    let vivo = true;
    (async () => {
      const filas = await leerLista();
      if (!vivo) return;
      const borr = leerLocal(BORRADOR);
      const quiero = borr && Array.isArray(borr.piezas) ? borr.versionId : leerLocal(ULTIMA);
      if (quiero && filas && filas.some(f => f.id === quiero)) await abrir(quiero);
      if (!vivo) return;
      if (borr && Array.isArray(borr.piezas) && borr.piezas.length) setBorradorPendiente(borr);
      setListo(true);
    })();
    return () => { vivo = false; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // el borrador: lo que no se ha guardado, en esta computadora (se ofrece al volver; se borra al guardar o descartar)
  useEffect(() => {
    if (!listo || borradorPendiente) return;
    const t = setTimeout(() => {
      if (sucio) escribirLocal(BORRADOR, { versionId: version?.id || null, versionNombre: version?.nombre || null, piezas, cuando: Date.now() });
      else quitarLocal(BORRADOR);
    }, 250);
    return () => clearTimeout(t);
  }, [piezas, version, sucio, listo, borradorPendiente]);
  const recuperarBorrador = () => {
    const b = borradorPendiente;
    setBorradorPendiente(null);
    if (!b) return;
    const { piezas: ps, descartadas } = G.limpiarPiezas(b.piezas);
    const deOtra = (b.versionId || null) !== (versionRef.current?.id || null);
    cambiar(ps);
    if (deOtra) setAviso({ tipo: "info", texto: `Los cambios eran sobre «${b.versionNombre || "otra versión"}», que ya no se pudo abrir: guárdalos como versión nueva.` });
    else if (descartadas) setAviso({ tipo: "error", texto: `${descartadas} pieza(s) del borrador venían dañadas y se dejaron fuera.` });
  };
  const descartarBorrador = () => { setBorradorPendiente(null); quitarLocal(BORRADOR); };

  // salir de la vista con cambios pregunta (App llama a esto desde el menú y los atajos), y cerrar la pestaña también
  useEffect(() => {
    if (!registrarSalida) return undefined;
    registrarSalida(seguir => { if (!sucioRef.current) return false; setVentana({ tipo: "salir", seguir }); return true; });
    const alCerrar = e => { if (sucioRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", alCerrar);
    return () => { registrarSalida(null); window.removeEventListener("beforeunload", alCerrar); };
  }, [registrarSalida]);

  const guardar = useCallback(async () => {
    const v = versionRef.current;
    if (!v) { setVentana({ tipo: "guardarComo", texto: "", error: null }); return false; }
    if (ocupadoRef.current) return false;   // un doble clic no guarda dos veces
    ocupadoRef.current = true; setOcupado("guardando"); setAviso(null);
    const foto = piezasRef.current;
    let r;
    try { r = await supabase.from(TABLA).update({ piezas: foto }).eq("id", v.id).eq("revision", v.revision).is("borrado_en", null).select(COLUMNAS); }
    catch (e) { r = { data: null, error: { message: String(e?.message || e) } }; }
    if (r.error) { ocupadoRef.current = false; setOcupado(null); setAviso({ tipo: "error", texto: "No se guardó «" + v.nombre + "». " + enPalabras(r.error, "guardar versiones del plano") + " Tus cambios siguen aquí." }); return false; }
    if (!r.data || !r.data.length) {   // otro la guardó (o la borró) mientras tanto: no se pisa
      let otra = null;
      try { const q = await supabase.from(TABLA).select("id,nombre,revision,actualizado_por,actualizado_en,borrado_en,borrado_por").eq("id", v.id).maybeSingle(); otra = q.data || null; } catch { /* se dice sin el quién */ }
      ocupadoRef.current = false; setOcupado(null);
      setVentana({ tipo: "conflicto", v, otra });
      return false;
    }
    ocupadoRef.current = false; setOcupado(null);
    const nueva = r.data[0];
    setVersion(versionDe(nueva)); setBase(foto); setGuardadoA(nueva.actualizado_en || new Date().toISOString());
    if (G.mismasPiezas(foto, piezasRef.current)) quitarLocal(BORRADOR);
    leerLista();
    avisar?.("Se guardó «" + nueva.nombre + "»", "success");
    return true;
  }, [supabase, leerLista, avisar]);

  const guardarComo = useCallback(async (texto, despues) => {
    const { valor, error } = G.leerNombre(texto, G.VERSION_MAX, "el nombre de la versión");
    if (error) { setVentana(w => w && { ...w, error }); return; }
    if (lista.filas.some(f => String(f.nombre).toLowerCase() === valor.toLowerCase())) { setVentana(w => w && { ...w, error: `Ya hay una versión que se llama «${valor}»: ponle otro nombre.` }); return; }
    if (ocupadoRef.current) return;
    ocupadoRef.current = true; setOcupado("guardando"); setVentana(w => w && { ...w, error: null });
    const foto = piezasRef.current;
    let r;
    try { r = await supabase.from(TABLA).insert({ nombre: valor, piezas: foto }).select(COLUMNAS).single(); }
    catch (e) { r = { data: null, error: { message: String(e?.message || e) } }; }
    ocupadoRef.current = false; setOcupado(null);
    if (r.error || !r.data) {
      const texto = r.error?.code === "23505" ? `Ya hay una versión que se llama «${valor}»: ponle otro nombre.` : "No se guardó. " + enPalabras(r.error || { message: "la base no devolvió la versión" }, "guardar versiones del plano") + " Tus cambios siguen aquí.";
      setVentana(w => w && { ...w, error: texto });
      if (sinTabla(r.error)) setLista(l => ({ ...l, estado: "sintabla", error: r.error }));
      return;
    }
    setVentana(null);
    setVersion(versionDe(r.data)); setBase(foto); setGuardadoA(r.data.actualizado_en || new Date().toISOString()); guardarUltima(r.data.id);
    if (G.mismasPiezas(foto, piezasRef.current)) quitarLocal(BORRADOR);
    leerLista();
    avisar?.("Se guardó la versión «" + r.data.nombre + "»", "success");
    despues?.();
  }, [supabase, lista.filas, leerLista, avisar]);

  const restaurar = useCallback(async v => {
    let r;
    try { r = await supabase.from(TABLA).update({ borrado_en: null }).eq("id", v.id).select(COLUMNAS + ",piezas"); }
    catch (e) { r = { data: null, error: { message: String(e?.message || e) } }; }
    if (r.error || !r.data?.length) { setAviso({ tipo: "error", texto: `No se pudo regresar «${v.nombre}». ` + (r.error?.code === "23505" ? "Ya hay otra versión con ese nombre." : enPalabras(r.error || { message: "ya no está" }, "cambiar versiones del plano")) }); return; }
    const f = r.data[0];
    setVersion(versionDe(f)); setBase(G.limpiarPiezas(f.piezas).piezas); guardarUltima(f.id);
    leerLista();
    avisar?.(`Se regresó «${f.nombre}»`, "success");
  }, [supabase, leerLista, avisar]);
  const borrarVersion = useCallback(async () => {
    const v = versionRef.current;
    if (!v || ocupadoRef.current) return;
    ocupadoRef.current = true; setOcupado("borrando");
    let r;
    try { r = await supabase.from(TABLA).update({ borrado_en: new Date().toISOString() }).eq("id", v.id).is("borrado_en", null).select("id"); }
    catch (e) { r = { data: null, error: { message: String(e?.message || e) } }; }
    ocupadoRef.current = false; setOcupado(null); setVentana(null);
    if (r.error) { setAviso({ tipo: "error", texto: "No se borró «" + v.nombre + "». " + enPalabras(r.error, "borrar versiones del plano") }); return; }
    // borrada (o ya la había borrado otro): lo que está en el plano se queda, como cambios sin guardar sobre el levantamiento
    setVersion(null); setBase(ORIGINAL); setGuardadoA(null); guardarUltima("");
    leerLista();
    if (r.data?.length) avisar?.(`Se borró la versión «${v.nombre}»`, "info", { label: "Deshacer", onClick: () => restaurar(v) });
    else setAviso({ tipo: "info", texto: `«${v.nombre}» ya la había borrado alguien más.` });
  }, [supabase, leerLista, avisar, restaurar]);

  const pedirAbrir = id => {
    if ((id || null) === (abriendo || version?.id || null)) return;
    if (sucio) { setVentana({ tipo: "abrir", id, nombre: id ? (lista.filas.find(f => f.id === id)?.nombre || "esa versión") : "el plano del levantamiento" }); return; }
    abrir(id);
  };

  // ── agregar un objeto con sus medidas ──
  const empezarAgregar = () => { setAgregando({ nombre: "", largo: "", ancho: "", errores: {} }); setSel(null); setMenuImprimir(false); };
  const agregar = () => {
    const a = agregando;
    if (!a) return;
    const n = G.leerNombre(a.nombre, G.NOMBRE_MAX, "qué es (su nombre)"), l = G.leerMedida(a.largo), w = G.leerMedida(a.ancho);
    const errores = { nombre: n.error, largo: l.error, ancho: w.error };
    if (n.error || l.error || w.error) { setAgregando({ ...a, errores }); return; }
    const v = vistaRef.current;
    const centro = v && tam.w ? { x: (tam.w / 2 - v.dx) / v.s, y: (tam.h / 2 - v.dy) / v.s } : { x: PLANTA.ancho / 2, y: PLANTA.alto / 2 };
    const id = G.nuevoId(piezasRef.current);
    if (cambiar(ps => [...ps, G.piezaNueva({ nombre: n.valor, largo: l.valor, ancho: w.valor }, centro, id)])) { setAgregando(null); setSel(id); }
  };

  const imprimirHoja = hoja => {
    setMenuImprimir(false);
    try { imprimir(hojaParaImprimir({ piezas, problemas: prob, version, sinGuardar: sucio, hoja, quien: nombre || usuario, cuando: new Date() })); }
    catch (e) { setAviso({ tipo: "error", texto: "No se pudo armar la hoja para imprimir: " + (e?.message || e) }); }
  };

  // ── lo que se ve ──
  const btnSec = { ...bs(C.sf, C.tx), border: "1px solid " + C.bd };
  const btnIcono = (activo = true) => ({ ...btnSec, padding: 0, width: 40, justifyContent: "center", opacity: activo ? 1 : .45, cursor: activo ? "pointer" : "default" });
  const s = vista?.s || 0.2;
  const zoom = vista ? Math.round(vista.s / sAjuste * 100) : 100;
  const estado = ocupado === "guardando" ? { t: "Guardando…", c: C.t2 } : ocupado === "borrando" ? { t: "Borrando…", c: C.t2 }
    : sucio ? { t: "Cambios sin guardar", c: C.wnTx, punto: C.wn } : guardadoA ? { t: "Guardado a las " + hora(guardadoA), c: C.okTx, punto: C.ok } : { t: "Sin cambios", c: C.t2 };
  const opciones = lista.filas.some(f => f.id === version?.id) || !version ? lista.filas : [versionDe(version), ...lista.filas];
  const barraSel = pieza && !arrastre && vista && (() => {
    const cj = G.cajaDe(pieza), W = 4 * 40 + 3 * 4 + 10, Hh = 50;
    const cx = (cj.x0 + cj.x1) / 2 * s + vista.dx, arriba = cj.y0 * s + vista.dy, abajo = cj.y1 * s + vista.dy;
    let y = arriba - Hh; if (y < 6) y = abajo + 8; if (y > tam.h - Hh) y = clamp(arriba + 6, 6, tam.h - Hh);
    return { left: clamp(cx - W / 2, 6, Math.max(6, tam.w - W - 6)), top: y };
  })();
  const etiquetaDe = p => p.nombre + (p.numero ? " (n.º " + p.numero + ")" : "") + ", " + medidas(p) + " cm" + (p.giro ? ", girada " + cm(p.giro) + "°" : "");

  return <section aria-label="Plano de la planta" data-plano style={{ fontFamily: "'Geist',sans-serif", color: C.tx }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", margin: "0 0 10px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", margin: 0 }}>Planta</h2>
      <p style={{ fontSize: 11.5, color: C.t2, margin: 0 }}>Planta baja · medidas en centímetros · arrastra una máquina para moverla; tócala para girarla o cambiar sus medidas</p>
    </div>

    {/* la versión y guardar */}
    <div role="group" aria-label="Versión del acomodo" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: C.t2 }}>Versión
        <select data-plano-version value={abriendo || version?.id || ""} disabled={lista.estado === "leyendo" && !listo} onChange={e => pedirAbrir(e.target.value || null)}
          onFocus={() => { if (lista.estado !== "sintabla") leerLista(); }}
          style={{ minHeight: 40, maxWidth: 360, padding: "0 10px", borderRadius: 10, border: "1px solid " + C.bd, background: C.bg, color: C.tx, fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
          <option value="">Plano del levantamiento (como estaba)</option>
          {opciones.map(f => <option key={f.id} value={f.id}>{f.nombre}{f.actualizado_en ? " · " + fechaCorta(f.actualizado_en) + (f.actualizado_por ? " · " + persona(f.actualizado_por) : "") : ""}</option>)}
        </select>
      </label>
      <span role="status" data-plano-estado style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: estado.c }}>
        {estado.punto && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: estado.punto }} />}{abriendo ? "Abriendo…" : estado.t}
      </span>
      <span style={{ flex: "1 1 0" }} />
      <button type="button" data-plano-guardar onClick={() => guardar()} disabled={!!ocupado || sinTablaYa || !!abriendo || (!sucio && !!version)}
        title={sinTablaYa ? "Falta la tabla de versiones en la base" : !version ? "Guardar este acomodo como una versión con nombre" : "Guardar los cambios en «" + version.nombre + "»"}
        style={{ ...bs(sucio && !sinTablaYa ? C.ac : C.sf, sucio && !sinTablaYa ? "#fff" : C.t2), border: "1px solid " + (sucio && !sinTablaYa ? C.ac : C.bd), opacity: ocupado || sinTablaYa || (!sucio && version) ? .6 : 1, cursor: ocupado || sinTablaYa || (!sucio && version) ? "default" : "pointer" }}>
        <FloppyDiskIcon size={14} weight="bold" />{version ? "Guardar" : "Guardar como versión…"}
      </button>
      {version && <button type="button" data-plano-guardar-como onClick={() => setVentana({ tipo: "guardarComo", texto: "", error: null })} disabled={!!ocupado || sinTablaYa} style={{ ...btnSec, opacity: ocupado || sinTablaYa ? .6 : 1 }}>Guardar como nueva…</button>}
      {version && <button type="button" data-plano-borrar-version onClick={() => setVentana({ tipo: "borrar" })} disabled={!!ocupado} style={{ ...bs("transparent", C.dnInk), border: "1px solid " + C.bd }}><TrashIcon size={13} weight="bold" />Borrar versión</button>}
    </div>
    {lista.estado === "falla" && <div role="alert" data-plano-lista-falla style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", marginBottom: 8, borderRadius: 12, background: C.dn + "10", border: "1px solid " + C.dn + "40", fontSize: 12.5, color: C.dnInk }}>
      <WarningIcon size={15} weight="bold" />No se pudieron leer las versiones guardadas. {enPalabras(lista.error, "ver las versiones del plano")}
      <button type="button" onClick={() => leerLista()} style={{ ...bs(C.bg, C.dnInk), border: "1px solid " + C.dn + "55", minHeight: 32 }}><ArrowsClockwiseIcon size={13} weight="bold" />Reintentar</button>
    </div>}
    {sinTablaYa && <div role="status" data-plano-sin-tabla style={{ padding: "8px 12px", marginBottom: 8, borderRadius: 12, background: C.amb + "14", border: "1px solid " + C.amb + "55", fontSize: 12.5, color: C.wnTx }}>
      <b>Guardar versiones todavía no está disponible</b> (falta su tabla en la base). Puedes acomodar e imprimir; lo que cambies se queda guardado en esta computadora mientras tanto.
    </div>}
    {borradorPendiente && <div role="status" data-plano-borrador style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", marginBottom: 8, borderRadius: 12, background: C.ios + "10", border: "1px solid " + C.ios + "40", fontSize: 12.5, color: C.tx }}>
      <span style={{ flex: "1 1 320px" }}>Hay cambios que no se guardaron, {haceCuanto(borradorPendiente.cuando || Date.now())}, sobre <b>«{borradorPendiente.versionNombre || "el plano del levantamiento"}»</b>. Si sigues editando sin recuperarlos, se descartan.</span>
      <button type="button" onClick={recuperarBorrador} style={{ ...bs(C.ios, "#fff"), minHeight: 34 }}>Recuperarlos</button>
      <button type="button" onClick={descartarBorrador} style={{ ...btnSec, minHeight: 34 }}>Descartarlos</button>
    </div>}
    {aviso && <div role={aviso.tipo === "error" ? "alert" : "status"} data-plano-aviso style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px", marginBottom: 8, borderRadius: 12, background: aviso.tipo === "error" ? C.dn + "10" : C.sf, border: "1px solid " + (aviso.tipo === "error" ? C.dn + "40" : C.bd), fontSize: 12.5, color: aviso.tipo === "error" ? C.dnInk : C.tx }}>
      <span style={{ flex: 1 }}>{aviso.texto}</span>
      <button type="button" aria-label="Cerrar el aviso" onClick={() => setAviso(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: 2, display: "inline-flex" }}><XIcon size={14} weight="bold" /></button>
    </div>}

    {/* las herramientas */}
    <div role="toolbar" aria-label="Herramientas del plano" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
      <button type="button" data-plano-agregar onClick={empezarAgregar} style={{ ...bs(C.ac, "#fff") }}><PlusIcon size={14} weight="bold" />Agregar objeto</button>
      <span aria-hidden style={{ width: 1, height: 24, background: C.bd, margin: "0 4px" }} />
      <button type="button" data-plano-deshacer onClick={deshacer} disabled={!pasado.length} aria-label="Deshacer" title="Deshacer (Ctrl+Z)" style={btnIcono(!!pasado.length)}><ArrowUUpLeftIcon size={16} weight="bold" /></button>
      <button type="button" data-plano-rehacer onClick={rehacer} disabled={!futuro.length} aria-label="Rehacer" title="Rehacer (Ctrl+Y)" style={btnIcono(!!futuro.length)}><ArrowUUpRightIcon size={16} weight="bold" /></button>
      <span aria-hidden style={{ width: 1, height: 24, background: C.bd, margin: "0 4px" }} />
      <button type="button" onClick={() => acercar(1 / 1.25, tam.w / 2, tam.h / 2)} aria-label="Alejar" title="Alejar (la rueda del mouse también)" style={btnIcono()}><MagnifyingGlassMinusIcon size={16} weight="bold" /></button>
      <span data-plano-zoom style={{ minWidth: 46, textAlign: "center", fontSize: 12, fontWeight: 600, color: C.t2, fontVariantNumeric: "tabular-nums" }}>{zoom}%</span>
      <button type="button" onClick={() => acercar(1.25, tam.w / 2, tam.h / 2)} aria-label="Acercar" title="Acercar (la rueda del mouse también)" style={btnIcono()}><MagnifyingGlassPlusIcon size={16} weight="bold" /></button>
      <button type="button" data-plano-ver-todo onClick={ajustar} style={btnSec}><CornersOutIcon size={14} weight="bold" />Ver todo</button>
      <span style={{ flex: "1 1 0" }} />
      <div style={{ position: "relative" }}>
        <button type="button" data-plano-imprimir aria-haspopup="menu" aria-expanded={menuImprimir} onClick={() => setMenuImprimir(m => !m)} style={btnSec}><PrinterIcon size={14} weight="bold" />Imprimir o PDF</button>
        {menuImprimir && <div role="menu" aria-label="Tamaño de la hoja" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, minWidth: 260, background: C.bg, border: "1px solid " + C.bd, borderRadius: 12, boxShadow: C.sh3, padding: 6 }}>
          {[["doble", "Doble carta"], ["carta", "Carta"]].map(([k, t]) => <button key={k} type="button" role="menuitem" data-plano-hoja={k} onClick={() => imprimirHoja(k)} style={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: "none", borderRadius: 8, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: C.tx, textAlign: "left" }}>
            <b>{t}</b><span style={{ color: C.t2 }}>escala 1:{escalaDe(piezas, k)}</span></button>)}
          <div style={{ fontSize: 11, color: C.t2, padding: "6px 12px 4px", lineHeight: 1.4 }}>Para el PDF, en la ventana de imprimir elige «Guardar como PDF».</div>
        </div>}
      </div>
    </div>

    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      {/* el plano */}
      <div ref={lienzoRef} data-plano-lienzo style={{ position: "relative", flex: "1 1 auto", minWidth: 0, height: alto, borderRadius: 14, overflow: "hidden", border: "1px solid " + C.bd, background: "#fbfcfd", userSelect: "none" }}>
        <svg ref={svgRef} width={tam.w || 0} height={tam.h || 0} style={{ display: "block", touchAction: "none", cursor: "grab" }}
          onPointerDown={e => alBajar(e, null)} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alCancelar} aria-label="Plano de la planta baja" role="img">
          {vista && <g transform={`translate(${vista.dx} ${vista.dy}) scale(${s})`}>
            <defs><pattern id="plano-reticula" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" fill="none" stroke="#e7ebf0" strokeWidth={1 / s} /></pattern></defs>
            <rect x={-2000} y={-2000} width={PLANTA.ancho + 4000} height={PLANTA.alto + 4000} fill="url(#plano-reticula)" />
            <g fill="none" vectorEffect="non-scaling-stroke" pointerEvents="none">
              <g stroke="#c3cad2" strokeWidth={0.8} strokeDasharray="6 4">{PROYECCION.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}</g>
              <g stroke="#b8c0c8" strokeWidth={0.8}>{PUNTEADO.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}</g>
              <g stroke="#7b8794" strokeWidth={0.9}>{[...FIJOS, ...ESCALERAS].map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}</g>
              <g stroke="#a3acb6" strokeWidth={0.8}>{PUERTAS.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}</g>
              <g stroke="#5b8dc9" strokeWidth={1.1}>{VIDRIOS.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}</g>
              <g data-plano-muros stroke="#1f2933" strokeWidth={1.5}>{MUROS.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}</g>
              <g stroke="#1f2933" strokeWidth={1.3}>{DIVISIONES.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}</g>
            </g>
            <g data-plano-areas pointerEvents="none" fill="#9aa5b1" fontStyle="italic" fontSize={13 / s} fontFamily="'Geist',sans-serif">{G.areasLibres(AREAS, visibles, 13 / s, letreros.cajasCm).map(a => <text key={a.t + a.x} x={a.x} y={a.y}>{a.t}</text>)}</g>
            {visibles.map(p => {
              const r = prob[p.id], mal = !!r && (r.con.length > 0 || r.choca.length > 0), elegida = p.id === sel;
              return <polygon key={p.id} data-pieza={p.id} data-mal={mal ? "1" : undefined} points={G.esquinas(p).map(q => G.redondear(q[0], 2) + "," + G.redondear(q[1], 2)).join(" ")}
                fill={mal ? "#fde2e2" : elegida ? "#dbe9fb" : p.numero ? "#e3e9ef" : "#fdf0d8"} fillOpacity={arrastre?.id === p.id ? .85 : 1}
                stroke={mal ? C.dnInk : elegida ? C.ios : p.numero ? "#334e5c" : "#b45309"} strokeWidth={elegida ? 2.5 : mal ? 2 : 1.2} vectorEffect="non-scaling-stroke"
                style={{ cursor: "move" }} onPointerDown={e => { e.stopPropagation(); alBajar(e, p.id); }} aria-label={etiquetaDe(p)}><title>{etiquetaDe(p)}</title></polygon>;
            })}
            <g pointerEvents="none" fontFamily="'Geist',sans-serif" textAnchor="middle">{visibles.map(p => {
              const l = letreros[p.id], f = l.f;
              return <g key={p.id}>
                <text x={l.lx} y={l.ly + (l.conMedidas ? -2 : f * 0.35) / s} fontSize={f / s} fontWeight={700} fill="#1a1a1f" stroke="#fbfcfd" strokeWidth={3 / s} paintOrder="stroke">{p.nombre}</text>
                {l.conMedidas && <text x={l.lx} y={l.ly + 12 / s} fontSize={10.5 / s} fill="#4b5563" stroke="#fbfcfd" strokeWidth={3 / s} paintOrder="stroke">{l.med}</text>}
              </g>;
            })}</g>
          </g>}
        </svg>
        {barraSel && <div role="toolbar" aria-label={"Acciones de " + pieza.nombre} data-plano-barra style={{ position: "absolute", left: barraSel.left, top: barraSel.top, display: "flex", gap: 4, padding: 4, background: C.bg, borderRadius: 12, boxShadow: C.sh3, border: "1px solid " + C.bd }}>
          <button type="button" data-plano-girar-izq onClick={() => girarSel(-90)} aria-label="Girar 90° a la izquierda" title="Girar 90° a la izquierda (Shift+R)" style={btnIcono()}><ArrowCounterClockwiseIcon size={16} weight="bold" /></button>
          <button type="button" data-plano-girar-der onClick={() => girarSel(90)} aria-label="Girar 90° a la derecha" title="Girar 90° a la derecha (R)" style={btnIcono()}><ArrowClockwiseIcon size={16} weight="bold" /></button>
          <button type="button" data-plano-duplicar onClick={duplicarSel} aria-label="Duplicar" title="Duplicar (Ctrl+D)" style={btnIcono()}><CopyIcon size={16} weight="bold" /></button>
          <button type="button" data-plano-quitar onClick={borrarSel} aria-label={"Quitar «" + pieza.nombre + "» del plano"} title="Quitar del plano (Supr)" style={{ ...btnIcono(), color: C.dnInk }}><TrashIcon size={16} weight="bold" /></button>
        </div>}
        <div aria-hidden style={{ position: "absolute", left: 10, bottom: 8, fontSize: 11, color: C.t2, background: "#fbfcfdcc", padding: "2px 6px", borderRadius: 6 }}>cuadros de 1 m</div>
      </div>

      {/* el panel */}
      <aside aria-label="La pieza elegida y la lista" data-plano-panel style={{ flex: "0 0 290px", height: alto, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: 14, borderRadius: 14, background: C.bg, border: "1px solid " + C.bd, boxSizing: "border-box" }}>
        {agregando ? <form data-plano-forma-agregar onSubmit={e => { e.preventDefault(); agregar(); }} onKeyDown={e => { if (e.key === "Escape" && !agregando.nombre && !agregando.largo && !agregando.ancho) { e.preventDefault(); setAgregando(null); } }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Agregar un objeto</div>
          <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.45 }}>Una máquina nueva, una mesa, una tarima… Aparece en medio de lo que ves del plano y luego la acomodas.</div>
          {[["nombre", "Qué es", "Ej.: Mesa de empaque", "text"], ["largo", "Largo (cm)", "Ej.: 240", "decimal"], ["ancho", "Ancho (cm)", "Ej.: 120", "decimal"]].map(([k, t, ph, im]) => <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: .3 }}>{t}
            <input name={"agregar-" + k} value={agregando[k]} placeholder={ph} inputMode={im} autoComplete="off" autoFocus={k === "nombre"} aria-invalid={!!agregando.errores[k] || undefined}
              onChange={e => setAgregando(a => ({ ...a, [k]: e.target.value, errores: { ...a.errores, [k]: null } }))}
              style={{ ...tema.inp, padding: "8px 10px", textTransform: "none", letterSpacing: 0, fontWeight: 500, boxShadow: "0 0 0 1px " + (agregando.errores[k] ? C.dnInk : C.bd) }} />
            {agregando.errores[k] && <span role="alert" style={{ fontSize: 11.5, color: C.dnInk, textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>{agregando.errores[k]}</span>}
            {!agregando.errores[k] && k !== "nombre" && G.leerMedida(agregando[k]).aviso && <span role="status" style={{ fontSize: 11.5, color: C.wnTx, textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>{G.leerMedida(agregando[k]).aviso}</span>}
          </label>)}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" data-plano-agregar-ok style={{ ...bt(C.ac), flex: 1, justifyContent: "center" }}><PlusIcon size={14} weight="bold" />Agregar al plano</button>
            <button type="button" onClick={() => setAgregando(null)} style={btnSec}>Cancelar</button>
          </div>
        </form>
        : pieza ? <div data-plano-pieza={pieza.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: pieza.numero ? "#334e5c" : C.wnTx, background: pieza.numero ? "#e3e9ef" : "#fdf0d8", padding: "3px 8px", borderRadius: 999 }}>{pieza.numero ? "Máquina n.º " + pieza.numero + " del plano" : "Agregado"}</span>
            <button type="button" onClick={() => setSel(null)} style={{ ...bs("transparent", C.t2), minHeight: 30, padding: "4px 8px" }}>Listo</button>
          </div>
          <Campo key={pieza.id + ":nombre"} etiqueta="Nombre" nombre="pieza-nombre" valor={pieza.nombre} inputMode="text" tema={tema} leer={t => G.leerNombre(t)} alCambiar={v => cambiarSel({ nombre: v })} />
          <div style={{ display: "flex", gap: 10 }}>
            <Campo key={pieza.id + ":largo"} etiqueta="Largo" nombre="pieza-largo" valor={cm(pieza.largo)} sufijo="cm" tema={tema} leer={G.leerMedida} alCambiar={v => cambiarSel({ largo: v })} />
            <Campo key={pieza.id + ":ancho"} etiqueta="Ancho" nombre="pieza-ancho" valor={cm(pieza.ancho)} sufijo="cm" tema={tema} leer={G.leerMedida} alCambiar={v => cambiarSel({ ancho: v })} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <Campo key={pieza.id + ":giro"} etiqueta="Giro" nombre="pieza-giro" valor={cm(pieza.giro || 0)} sufijo="°" ancho={110} tema={tema} leer={G.leerGiro} alCambiar={v => cambiarSel({ giro: v })} />
            <button type="button" onClick={() => girarSel(-90)} aria-label="Girar 90° a la izquierda" title="Girar 90° a la izquierda (Shift+R)" style={btnIcono()}><ArrowCounterClockwiseIcon size={16} weight="bold" /></button>
            <button type="button" onClick={() => girarSel(90)} aria-label="Girar 90° a la derecha" title="Girar 90° a la derecha (R)" style={btnIcono()}><ArrowClockwiseIcon size={16} weight="bold" /></button>
          </div>
          {prob[pieza.id] && (prob[pieza.id].con.length > 0 || prob[pieza.id].choca.length > 0) && <div role="status" data-plano-problema style={{ fontSize: 12.5, lineHeight: 1.45, color: C.dnInk, background: C.dn + "10", border: "1px solid " + C.dn + "40", borderRadius: 10, padding: "8px 10px" }}>
            <WarningIcon size={13} weight="bold" style={{ verticalAlign: "-2px", marginRight: 4 }} />
            {[prob[pieza.id].con.length ? "Se encima con " + prob[pieza.id].con.map(id => "«" + (nombreDe[id] || "otra") + "»").join(", ") : null, ...textoChoque(prob[pieza.id])].filter(Boolean).join("; ")}.
          </div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={duplicarSel} style={{ ...btnSec, flex: 1, justifyContent: "center" }}><CopyIcon size={14} weight="bold" />Duplicar</button>
            <button type="button" onClick={borrarSel} style={{ ...bs("transparent", C.dnInk), border: "1px solid " + C.bd, flex: 1, justifyContent: "center" }}><TrashIcon size={14} weight="bold" />Quitar</button>
          </div>
          <div style={{ fontSize: 11.5, color: C.t2, lineHeight: 1.5 }}>Flechas: mueven 5 cm (con Shift, 50) · R: gira 90° · Supr: quita · Ctrl+Z: deshace</div>
        </div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12.5, color: C.t2, lineHeight: 1.5 }}>Toca una máquina para moverla, girarla o cambiar sus medidas. Arrastra el fondo para recorrer el plano; la rueda del mouse acerca y aleja.</div>
          {conProblema.length > 0 && <div role="status" data-plano-problemas style={{ fontSize: 12.5, lineHeight: 1.45, color: C.dnInk, background: C.dn + "10", border: "1px solid " + C.dn + "40", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}><WarningIcon size={13} weight="bold" style={{ verticalAlign: "-2px", marginRight: 4 }} />{conProblema.length === 1 ? "1 pieza con problema" : conProblema.length + " piezas con problema"}</div>
            {conProblema.slice(0, 6).map(p => <button key={p.id} type="button" onClick={() => { setSel(p.id); verPieza(p); }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "2px 0", cursor: "pointer", color: "inherit", fontFamily: "inherit", fontSize: 12.5 }}>
              <b>{p.nombre}</b>: {[prob[p.id].con.length ? "se encima con " + prob[p.id].con.map(id => nombreDe[id] || "otra").join(", ") : null, ...textoChoque(prob[p.id])].filter(Boolean).join("; ")}</button>)}
            {conProblema.length > 6 && <div>y {conProblema.length - 6} más (en rojo en el plano)</div>}
          </div>}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.t2, textTransform: "uppercase", letterSpacing: .3, marginBottom: 6 }}>En el plano ({piezas.length})</div>
            <ul data-plano-lista style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {[...piezas].sort((a, b) => (Number(a.numero) || 999) - (Number(b.numero) || 999) || a.nombre.localeCompare(b.nombre, "es")).map(p => <li key={p.id}>
                <button type="button" onClick={() => { setSel(p.id); verPieza(p); }} style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: C.tx, textAlign: "left" }}>
                  <span style={{ minWidth: 22, fontSize: 11, fontWeight: 700, color: C.t2 }}>{p.numero || "·"}</span>
                  <span style={{ flex: 1, fontWeight: 600, color: prob[p.id] ? C.dnInk : C.tx }}>{p.nombre}</span>
                  <span style={{ fontSize: 11.5, color: C.t2, fontVariantNumeric: "tabular-nums" }}>{medidas(p)}</span>
                </button></li>)}
            </ul>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: C.t2 }}>
            <span><span aria-hidden style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#e3e9ef", border: "1px solid #334e5c", verticalAlign: "-1px", marginRight: 4 }} />del plano</span>
            <span><span aria-hidden style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#fdf0d8", border: "1px solid #b45309", verticalAlign: "-1px", marginRight: 4 }} />agregado</span>
            <span><span aria-hidden style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#fde2e2", border: "1px solid " + C.dnInk, verticalAlign: "-1px", marginRight: 4 }} />encimada o choca</span>
          </div>
        </div>}
      </aside>
    </div>

    {/* las ventanas */}
    {ventana?.tipo === "guardarComo" && <Ventana tema={tema} titulo="Guardar como versión" sucia={!!ventana.texto} alCerrar={() => setVentana(null)} botones={<>
      <button type="button" onClick={() => setVentana(null)} style={btnSec}>Cancelar</button>
      <button type="button" data-principal data-plano-guardar-ok disabled={ocupado === "guardando"} onClick={() => guardarComo(ventana.texto, ventana.despues)} style={{ ...bt(C.ac), opacity: ocupado ? .6 : 1 }}><FloppyDiskIcon size={14} weight="bold" />{ocupado === "guardando" ? "Guardando…" : "Guardar"}</button>
    </>}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600, color: C.t2 }}>Nombre de la versión
        <input name="version-nombre" value={ventana.texto} maxLength={G.VERSION_MAX + 20} placeholder="Ej.: PM-74 junto a la puerta" autoComplete="off" aria-invalid={!!ventana.error || undefined}
          onChange={e => { const texto = e.target.value; setVentana(w => w && { ...w, texto, error: null }); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); guardarComo(ventana.texto, ventana.despues); } }}
          style={{ ...tema.inp, boxShadow: "0 0 0 1px " + (ventana.error ? C.dnInk : C.bd) }} />
      </label>
      {ventana.error && <div role="alert" data-plano-ventana-error style={{ marginTop: 8, fontSize: 12.5, color: C.dnInk }}>{ventana.error}</div>}
      <div style={{ marginTop: 8, fontSize: 12, color: C.t2 }}>{conProblema.length ? `Ojo: ${conProblema.length === 1 ? "una pieza se encima o choca" : conProblema.length + " piezas se enciman o chocan"} (en rojo). Se puede guardar así.` : "Se guarda el acomodo como está ahora; lo ven Producción y Dirección."}</div>
    </Ventana>}
    {ventana?.tipo === "abrir" && <Ventana tema={tema} titulo="Tienes cambios sin guardar" alCerrar={() => setVentana(null)} botones={<>
      <button type="button" onClick={() => { const id = ventana.id; setVentana(null); quitarLocal(BORRADOR); abrir(id); }} style={{ ...bs("transparent", C.dnInk), border: "1px solid " + C.bd, minHeight: 40 }}>Descartarlos y abrir</button>
      <button type="button" data-principal onClick={() => setVentana(null)} style={bt(C.ac)}>Seguir aquí</button>
    </>}>
      Si abres <b>{ventana.nombre}</b>, se pierden los cambios que no has guardado{version ? <> en <b>«{version.nombre}»</b></> : null}. Para no perderlos, quédate y dale «{version ? "Guardar" : "Guardar como versión…"}».
    </Ventana>}
    {ventana?.tipo === "salir" && <Ventana tema={tema} titulo="Tienes cambios sin guardar en el plano" alCerrar={() => setVentana(null)} botones={<>
      <button type="button" onClick={() => { const seguir = ventana.seguir; setVentana(null); quitarLocal(BORRADOR); registrarSalida?.(null); seguir(); }} style={{ ...bs("transparent", C.dnInk), border: "1px solid " + C.bd, minHeight: 40 }}>Salir sin guardar</button>
      {version && !sinTablaYa && <button type="button" onClick={async () => { const seguir = ventana.seguir; setVentana(null); if (await guardar()) { registrarSalida?.(null); seguir(); } }} style={btnSec}>Guardar y salir</button>}
      <button type="button" data-principal onClick={() => setVentana(null)} style={bt(C.ac)}>Seguir aquí</button>
    </>}>
      {version ? <>Los cambios a <b>«{version.nombre}»</b> no se han guardado.</> : <>El acomodo que hiciste no se ha guardado como versión.</>} Si sales sin guardar, se pierden.
    </Ventana>}
    {ventana?.tipo === "borrar" && version && <Ventana tema={tema} titulo={"¿Borrar la versión «" + version.nombre + "»?"} alCerrar={() => setVentana(null)} botones={<>
      <button type="button" data-principal onClick={() => setVentana(null)} style={btnSec}>No borrar</button>
      <button type="button" data-plano-borrar-ok disabled={ocupado === "borrando"} onClick={borrarVersion} style={{ ...bt(C.dnInk), opacity: ocupado ? .6 : 1 }}><TrashIcon size={14} weight="bold" />{ocupado === "borrando" ? "Borrando…" : "Borrar"}</button>
    </>}>
      Deja de salir en la lista para todos{version.actualizado_por ? <> (la guardó {persona(version.actualizado_por)}{version.actualizado_en ? ", " + fechaCorta(version.actualizado_en) : ""})</> : null}. Lo que ves en el plano se queda, sin guardar. Se puede deshacer en seguida.
    </Ventana>}
    {ventana?.tipo === "conflicto" && <Ventana tema={tema} titulo={ventana.otra && !ventana.otra.borrado_en ? "Otra persona guardó esta versión mientras la editabas" : "Esta versión ya no existe"} alCerrar={() => setVentana(null)} ancho={500} botones={<>
      <button type="button" onClick={() => setVentana(null)} style={btnSec}>Seguir editando</button>
      {ventana.otra && !ventana.otra.borrado_en && <button type="button" onClick={() => { const id = ventana.v.id; setVentana(null); quitarLocal(BORRADOR); abrir(id); }} style={{ ...bs("transparent", C.dnInk), border: "1px solid " + C.bd, minHeight: 40 }}>Ver la suya (pierdo mis cambios)</button>}
      <button type="button" data-principal data-plano-conflicto-nueva onClick={() => setVentana({ tipo: "guardarComo", texto: (ventana.v.nombre + " (" + (nombre || usuario || "mía") + ")").slice(0, G.VERSION_MAX), error: null })} style={bt(C.ac)}>Guardar la mía como nueva</button>
    </>}>
      {ventana.otra && !ventana.otra.borrado_en
        ? <><b>«{ventana.v.nombre}»</b> la guardó <b>{persona(ventana.otra.actualizado_por) || "alguien más"}</b>{ventana.otra.actualizado_en ? " a las " + hora(ventana.otra.actualizado_en) : ""}. Si guardaras encima, se perdería lo suyo; tus cambios siguen aquí.</>
        : <><b>«{ventana.v.nombre}»</b> la borró {persona(ventana.otra?.borrado_por) || "alguien más"}{ventana.otra?.borrado_en ? " a las " + hora(ventana.otra.borrado_en) : ""}. Tus cambios siguen aquí: guárdalos como versión nueva.</>}
    </Ventana>}
  </section>;
}
