// Banco del DETALLE DE LA ORDEN: DetailModal EXTRAÍDO de un App.jsx, con su lógica real (etapas, permisos, quién puede qué,
// los botones de flujo) y lo que lee o escribe la base SIMULADO: la imagen (SignedImg), los nombres internos
// (ClientAliasManager), los pantones, el tiempo por etapa, el historial de cambios y Storage/la tabla al borrar el archivo.
// Uso: node gen-detalle.mjs <App.jsx> <dirSalida>
// Variantes por URL: etapa=… · cliente=… · caso=factura|partes|resto|espera|maquila|cancelada|borrador|salidas|remision|sinempaque|archivo (por defecto factura) ·
//   rol=karla|admin|produccion|preprensa|german|secretaria|vendedor|visor (por defecto karla) · falla=storage|tabla (borrar el
//   archivo: la base contesta con error) · flujos=1 (los botones de flujo de todas las etapas y roles, como en el tablero) · login=… (otro usuario, p. ej. un vendedor que no es dueño) · abrir=1 (abre el detalle al cargar, para el detector)
import fs from "node:fs";
import path from "node:path";
const [, , srcPath, outDir] = process.argv;
const L = fs.readFileSync(srcPath, "utf8").replace(/\r\n/g, "\n").split("\n");
const find = (pred, desc) => { const i = L.findIndex(pred); if (i < 0) throw new Error("no encuentro " + desc); return i; };
const line = (re, desc) => L[find(l => re.test(l), desc)];
const fnBlock = name => { const s = find(l => l.startsWith("function " + name + "("), name); let e = s; while (L[++e] !== "}") { if (e > s + 2000) throw new Error("sin cierre " + name); } return L.slice(s, e + 1).join("\n"); };
// un `const X = …` de varios renglones que cierra con «};» o «));» en la columna 0
const multi = (re, desc, fin = /^(\}|\)\)|\]);?\s*$/) => { const s = find(l => re.test(l), desc); if (/;\s*$/.test(L[s])) return L[s]; let e = s; while (!fin.test(L[++e])) { if (e > s + 400) throw new Error("sin cierre " + desc); } return L.slice(s, e + 1).join("\n"); };
const opcional = (cond, f) => cond ? [f()] : [];
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  line(/^import \{ Broadcast as BroadcastIcon/, "íconos"),
  line(/^const C=\{/, "C"), line(/^const F=\{/, "F"),
  line(/^const inp=/, "inp"), line(/^const lbl=/, "lbl"), line(/^const bt=/, "bt"), line(/^const bs=/, "bs"),
  ...["lumHex", "tintaAA", "tenueAA"].flatMap(n => opcional(L.some(l => l.startsWith("const " + n + "=")), () => line(new RegExp("^const " + n + "="), n))),
  line(/^const fmt=/, "fmt"), line(/^const fD=/, "fD"), line(/^const fDT=/, "fDT"), line(/^const parseDate=/, "parseDate"),
  line(/^const escStack=/, "escStack"), line(/^if\(typeof document!=="undefined"&&!escStack\._bound\)/, "escStack bind"),
  fnBlock("useEscClose"),
  ...opcional(L.some(l => l.startsWith("const FOCOS_DIALOGO=")), () => line(/^const FOCOS_DIALOGO=/, "FOCOS_DIALOGO")),
  ...opcional(L.some(l => l.startsWith("function atraparTab(")), () => fnBlock("atraparTab")),
  ...opcional(L.some(l => l.startsWith("function ConfirmModal(")), () => fnBlock("ConfirmModal")),
  multi(/^const STANDARD_SIZES=/, "STANDARD_SIZES"), line(/^const SS_BY_ID=/, "SS_BY_ID"), line(/^const ssLabel=/, "ssLabel"),
  multi(/^const PRIOS=/, "PRIOS"), line(/^const PM=/, "PM"),
  multi(/^const INT_FLOW=/, "INT_FLOW"), multi(/^const MAQ_FLOW=/, "MAQ_FLOW"), multi(/^const ALL_S=/, "ALL_S"), line(/^const SM=/, "SM"),
  multi(/^const ROLE_PEOPLE=/, "ROLE_PEOPLE"), line(/^const AUTHOR_NAME=\{\},AUTHOR_COLOR=\{\};/, "AUTHOR"),
  line(/^Object\.entries\(ROLE_PEOPLE\)/, "ROLE_PEOPLE forEach"), line(/^const USER_LOGIN_NAMES=/, "USER_LOGIN_NAMES"),
  line(/^Object\.entries\(USER_LOGIN_NAMES\)/, "USER_LOGIN_NAMES forEach"),
  line(/^const StageLbl=/, "StageLbl"), line(/^const PrioLbl=/, "PrioLbl"),
  line(/^const BADGE_TONES=/, "BADGE_TONES"), fnBlock("Badge"),
  line(/^const isSec=/, "isSec"), multi(/^const canEditWebOrder=/, "canEditWebOrder"),
  multi(/^const ACTION_ROLES = \{/, "ACTION_ROLES"), fnBlock("isVendedorOwnerByAgent"),
  line(/^const PRE_PROD_STAGES = /, "PRE_PROD_STAGES"), fnBlock("canVendedorEditPreProd"), fnBlock("canExecuteAction"),
  fnBlock("snoozeActive"),
  multi(/^const ETAPA_NOMBRE = \{/, "ETAPA_NOMBRE"), multi(/^const etapaPreviaDeshacer = /, "etapaPreviaDeshacer"),
  multi(/^const vuelveAlDeshacer = /, "vuelveAlDeshacer"), multi(/^const liquidadaConSaldoAFavor = /, "liquidadaConSaldoAFavor", /\)\);\s*$/),
  line(/^const recProof=/, "recProof"), multi(/^const STAGE_SEQUENCE/, "STAGE_SEQUENCE"), multi(/^const ROLE_AREAS=\{/, "ROLE_AREAS"), fnBlock("getRevertOptions"), fnBlock("StageFlowButtons"),
  `const Q = new URLSearchParams(location.search);
const CASO = Q.get("caso") || "factura", ROL = Q.get("rol") || "karla", FALLA = Q.get("falla") || "";
const LOGIN = Q.get("login") || { karla: "karla", admin: "admin", produccion: "gerardo", preprensa: "noemi", german: "german", secretaria: "secretaria", vendedor: "manuel", visor: "dulce" }[ROL] || ROL;
let EMISOR_ON = true;
const bitacora = [];   // lo que el detalle le pide a la base y a la app (lo pinta el banco)
const anotar = t => { bitacora.push(t); window.dispatchEvent(new Event("bitacora")); };
// la base simulada: Storage y la tabla de órdenes contestan {error} como supabase-js (que NO lanza)
const supabase = {
  storage: { from: b => ({ remove: async rutas => { anotar("storage:remove " + b + " " + rutas.join(",")); return FALLA === "storage" ? { data: null, error: { message: "Storage no contestó" } } : { data: rutas, error: null }; } }) },
  from: t => ({ update: campos => ({ eq: async (c, v) => { anotar("tabla:update " + t + " " + JSON.stringify(campos)); return FALLA === "tabla" ? { error: { message: "permiso denegado" } } : { error: null }; } }) }),
};
const db = { orderFolioIsCancelled: async () => CASO === "foliocancelado" };
const propsArchivoFirmado = () => ({});
const firmarOrderFile = async src => src;
const IMG = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#dfe6ee"/><text x="300" y="400" font-size="48" text-anchor="middle" fill="#4a6572">ARTE</text></svg>');
function SignedImg({ src, alt, style, onClick, title, fallback }) { return <img src={IMG} alt={alt} style={style} onClick={onClick} title={title} />; }
function ClientAliasManager() { return <div style={{ background: C.sf, borderRadius: 10, padding: 10, margin: "6px 0" }}><div style={{ fontSize: 10, fontWeight: 600, color: C.t2 }}>NOMBRE INTERNO</div><input aria-label="Nombre interno" placeholder="+ nombre interno" style={{ fontSize: 11 }} /></div>; }
function PantoneChips({ codes }) { return <span>{codes.join(", ")}</span>; }
function StageFlowHistory() { return <button>Tiempo por etapa</button>; }
function OrderChangeHistory() { return <button>Historial de cambios</button>; }`,
  fnBlock("DetailModal"),
  ...["MasDelDetalle", "MenuMasDelDetalle"].flatMap(n => opcional(L.some(l => l.startsWith("function " + n + "(")), () => fnBlock(n))),
  `const BASE = { id: "OP-MUH77BVYVQW", client: "SILVIA MARGARITA MARTINEZ HERNANDEZ", client_id: "c1", client_agent: "ALEJANDRA DELGADO",
  client_email: "erigrafia@hotmail.com", client_phone: "4731296625", client_lada: "+52", client_rfc: "MAHS680416LEA",
  product: "FORMATO 5 PUNTOS DE SEGURIDAD", product_type: "Formatos", quantity: 5000, created_at: "2026-09-25T16:20:00Z", created_by: "secretaria",
  due_date: "2026-09-29", paper_type: "BRISTOL", paper_grammage: 180, standard_size: "media_carta", ink_front: "4", ink_back: "4",
  pantone_front: ["SELECCION DE COLOR"], finishes: "Forma Suelta", agent: "Manuel", price: 5649, order_type: "interna",
  image_url: "img1", image_url_2: "img2", plate_status: "new", delivery_calculated_at: "2026-09-25T16:20:00Z", timeline: [{ stage: "draft" }, { stage: "design" }], notes_log: [], priority: "normal" };
const CASOS = {
  factura: { ...BASE, production_number: "P-0554", stage: "delivered", invoice_folio: "F-117", invoice_type: "factura", payment_status: "paid",
    payment_method: "transferencia", invoiced_by: "karla", invoiced_at: "2026-09-30T22:23:00Z", delivered_at: "2026-09-30T22:23:00Z" },
  partes: { ...BASE, production_number: "P-0571", client: "RESTAURANTES HAKUNA", stage: "delivered", quantity: 35000, price: 27560, has_splits: true,
    splits: [{ id: "s1", position: 1, doc_type: "factura", invoice_folio: "F-144", qty_portion: 20000, amount_portion: 15748.57 },
             { id: "s2", position: 2, doc_type: "factura", invoice_folio: "F-145", qty_portion: 15000, amount_portion: 11811.43 }] },
  resto: { ...BASE, production_number: "P-0571", client: "RESTAURANTES HAKUNA", stage: "delivered", quantity: 35000, price: 27560, has_splits: true,
    splits: [{ id: "s1", position: 1, doc_type: "factura", invoice_folio: "F-144", qty_portion: 20000, amount_portion: 15748.57 },
             { id: "s3", position: 2, doc_type: "por_facturar", qty_portion: 15000, amount_portion: 11811.43 }] },
  maquila: { ...BASE, production_number: "P-0598", client: "LIC. ORLANDO CASAS", stage: "maq_in_progress", order_type: "maquila", maq_provider: "MAKILA",
    maq_cost: 450, maq_price: null, price: null, quantity: 1, product: "MEDIDA 2.95X2.23 CON VELCRO", product_type: "LONA", image_url: null, image_url_2: null },
  cancelada: { ...BASE, production_number: "P-0405", client: "GOBIERNO DEL ESTADO DE GUANAJUATO", stage: "maq_cancelled", order_type: "maquila",
    maq_provider: "TRODAT", maq_cost: 646, maq_price: 972, cancellation_reason: "Orden repetida, la original y la que se queda es la P-0397",
    cancelled_by: "admin", cancelled_at: "2026-09-01T00:24:00Z", nc_emitted: false },
  borrador: { ...BASE, production_number: "P-0607", client: "LIC. ORLANDO CASAS", stage: "draft", quantity: 17, product: "IMPRESION DIGITAL",
    product_type: "GAFETTES", notes: "1ER. CORREO", validated_by_production: false, validated_by_preprensa: false, image_url_2: null, created_by: "secretaria" },
  salidas: { ...BASE, production_number: "P-0580", client: "LIC. ORLANDO CASAS", stage: "salidas", quantity: 100, price: 1450, image_url_2: null },
  remision: { ...BASE, production_number: "P-0577", client: "IMPRENTA LEON", stage: "delivered", invoice_folio: "RS-34", invoice_type: "remision",
    invoiced_by: "karla", invoiced_at: "2026-10-01T18:00:00Z", delivered_at: "2026-10-01T18:00:00Z" },
  sinempaque: { ...BASE, production_number: "P-0568", stage: "delivered", sin_empaque_sygma: true, invoice_folio: "RS-35", invoice_type: "remision" },
  espera: { ...BASE, production_number: "P-0590", stage: "salidas", image_url_2: null, snooze_reason: "El cliente aún no ha pedido factura/remisión",
    snooze_stage: "salidas", snoozed_by: "karla", snooze_until: null },
  archivo: { ...BASE, production_number: "P-0612", stage: "design", file_url: "https://x.supabase.co/storage/v1/object/public/order-files/P-0612/arte%20final.pdf",
    file_name: "arte final.pdf", image_url: null, image_url_2: null },
};
// etapa=… cambia la etapa del caso (para barrer etapas y roles); cliente=… cambia el nombre del cliente
const ORDEN = { ...(CASOS[CASO] || CASOS.factura), ...(Q.get("etapa") ? { stage: Q.get("etapa"), order_type: Q.get("etapa").startsWith("maq_") ? "maquila" : (CASOS[CASO] || CASOS.factura).order_type } : {}),
  ...(Q.get("cliente") ? { client: Q.get("cliente") } : {}) };
function Banco() {
  const [abierto, setAbierto] = useState(Q.get("abrir") === "1");
  const [, refresca] = useState(0);
  useEffect(() => { const f = () => refresca(n => n + 1); window.addEventListener("bitacora", f); return () => window.removeEventListener("bitacora", f); }, []);
  // flujos=1: los botones de flujo de TODAS las etapas con todos los roles, como en el tablero (sin variante): para comparar
  //   versiones y comprobar que el tablero no cambió
  if (Q.get("flujos") === "1") return <div>{ALL_S.flatMap(s => ["admin", "karla", "produccion", "preprensa", "german", "secretaria", "vendedor"].map(r =>
    <div key={s.id + r} data-k={s.id + "|" + r}><StageFlowButtons o={{ ...BASE, production_number: "P-1", stage: s.id, order_type: s.id.startsWith("maq_") ? "maquila" : "interna" }} role={r} onAction={() => {}} /></div>))}</div>;
  return <div style={{ padding: 20, fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    <button id="abrir-detalle" onClick={() => setAbierto(true)}>abrir el detalle</button>
    <button id="fondo-1">botón del tablero 1</button> <button id="fondo-2">botón del tablero 2</button>
    <pre id="log">{bitacora.join("\\n")}</pre>
    {abierto && <DetailModal order={ORDEN} role={ROL} userLogin={LOGIN}
      onClose={() => { anotar("cerrado"); setAbierto(false); }} onPrint={() => anotar("imprimir")}
      onAction={(id, accion, arg) => anotar("accion:" + accion + (arg ? " " + arg : ""))} />}
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco detalle de la orden</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5196), strictPort: true } });
`, "utf8");
console.log("banco del detalle listo en " + outDir);
