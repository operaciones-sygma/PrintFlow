// Banco de «¿ya existe este cliente?» (v10.84.69, con CobranzaFlow v3.7.999m): al capturar una orden o una OC con un cliente que no está
// ligado, PrintFlow pregunta a la base (resolve_client_for_order) y, si no es el nombre idéntico, enseña ClientConfirmModal; «Crear como
// nuevo» llama create_client_from_printflow. Se EXTRAEN de un App.jsx el modal, su montaje en App (la línea `clientConfirmModal&&…`), la
// lógica de las dos puertas (`resolverClienteNuevo`) y el mensaje de error (`mensajeDeCliente`), con sus dependencias reales (tokens,
// estilos, escStack, useEscClose, atraparTab). La base va simulada; la forma de la orden también (sólo lo que necesita la pregunta: el
// nombre, el RFC, el correo y «Guardar», registrada en escStack como la forma de verdad).
// Uso: node gen-cliente.mjs <App.jsx> <dirSalida>
// Variantes por URL: resolve=exacto|fuerte|parecido|mixto|baja|nada|viejo|muchos|falla · crear=ok|frena|baja|falla · oc=1 (el RFC es
//   obligatorio para una razón social nueva, como en «Crear OC») · nombre=… · rfc=… · correo=… · largo=1 (nombres larguísimos)
// Sin `resolverClienteNuevo` en el App.jsx (el código anterior a v10.84.69), el banco usa una copia de lo que hacía la forma de la orden
// en línea (la vuelta 1: probar contra lo que hay).
import fs from "node:fs";
import path from "node:path";
const [, , srcPath, outDir] = process.argv;
const L = fs.readFileSync(srcPath, "utf8").replace(/\r\n/g, "\n").split("\n");
const find = (pred, desc) => { const i = L.findIndex(pred); if (i < 0) throw new Error("no encuentro " + desc); return i; };
const line = (re, desc) => L[find(l => re.test(l), desc)];
const fnBlock = name => { const s = find(l => l.startsWith("function " + name + "(") || l.startsWith("async function " + name + "("), name); let e = s; while (L[++e] !== "}") { if (e > s + 2000) throw new Error("sin cierre " + name); } return L.slice(s, e + 1).join("\n"); };
const hay = name => L.some(l => l.startsWith("function " + name + "(") || l.startsWith("async function " + name + "(") || l.startsWith("const " + name + "="));
const montaje = line(/clientConfirmModal&&<ClientConfirmModal/, "el montaje de ClientConfirmModal").trim();
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  line(/^import \{ Broadcast as BroadcastIcon/, "íconos"),
  line(/^const C=\{/, "C"), line(/^const F=\{/, "F"),
  line(/^const inp=/, "inp"), line(/^const lbl=/, "lbl"), line(/^const bt=/, "bt"), line(/^const bs=/, "bs"),
  line(/^const escStack=/, "escStack"), line(/^if\(typeof document!=="undefined"&&!escStack\._bound\)/, "escStack bind"),
  fnBlock("useEscClose"),
  ...(L.some(l => l.startsWith("const FOCOS_DIALOGO=")) ? [line(/^const FOCOS_DIALOGO=/, "FOCOS_DIALOGO"), fnBlock("atraparTab")] : []),
  `const Q = new URLSearchParams(location.search);
const RESOLVE = Q.get("resolve") || "fuerte", CREAR = Q.get("crear") || "ok", OC = Q.get("oc") === "1", LARGO = Q.get("largo") === "1";
const log = t => window.__L?.(t);
const MODELO = { id: "c-modelo", name: LARGO ? "CERVECERIA MODELO DE MEXICO S DE RL DE CV SUCURSAL BAJIO CENTRO NORTE GUANAJUATO" : "CERVECERIA MODELO DE MEXICO", rfc: "CMM8601014G4", dias_credito: 30, aliases: ["CORONA", "MODELO"] };
const PAPELERIA = { id: "c-papeleria", name: "PAPELERIA DEL BAJIO", rfc: null, dias_credito: 0, aliases: [] };
const RESP = {
  exacto: { exact_match: "c-modelo", exact_name: "CERVECERIA MODELO DE MEXICO", similar_matches: [], dados_de_baja: [] },
  fuerte: { exact_match: null, similar_matches: [{ ...MODELO, motivo: "ya se dio de alta con ese nombre y se juntó con éste", fuerte: true }], dados_de_baja: [] },
  parecido: { exact_match: null, similar_matches: [{ ...PAPELERIA, motivo: "se parece", fuerte: false }], dados_de_baja: [] },
  mixto: { exact_match: null, similar_matches: [{ ...PAPELERIA, motivo: "el nombre lo contiene", fuerte: false }, { ...MODELO, motivo: "así le dicen en la casa", fuerte: true }], dados_de_baja: [] },
  baja: { exact_match: null, similar_matches: [], dados_de_baja: [{ id: "c-test", name: "TEST CLIENTE", motivo: "mismo nombre" }] },
  nada: { exact_match: null, similar_matches: [], dados_de_baja: [] },
  // muchos a la vez: dos seguros, cuatro parecidos y dos dados de baja (lo que cabe en la laptop)
  muchos: { exact_match: null, similar_matches: [
    { ...MODELO, motivo: "así le dicen en la casa", fuerte: true }, { id: "c-modelo2", name: "GRUPO MODELO DEL CENTRO SA DE CV", rfc: "GMC010101AB1", dias_credito: 15, aliases: [], motivo: "misma razón social", fuerte: true },
    ...[1, 2, 3, 4].map(i => ({ id: "c-par" + i, name: "PAPELERIA MODELO NUMERO " + i, rfc: null, dias_credito: 0, aliases: ["PM" + i], motivo: "se parece", fuerte: false }))],
    dados_de_baja: [{ id: "c-test", name: "TEST CLIENTE", motivo: "mismo nombre" }, { id: "c-test2", name: "TEST CLIENTE DOS", motivo: "se parece" }] },
  // la base de antes de v3.7.999m: sin motivo, sin fuerte, sin dados_de_baja
  viejo: { exact_match: null, similar_matches: [{ id: "c-papeleria", name: "PAPELERIA DEL BAJIO", rfc: null, dias_credito: 0, aliases: [] }] },
};
const supabase = { rpc: async (fn, args) => {
  log("rpc:" + fn + " " + JSON.stringify(args));
  await new Promise(r => setTimeout(r, 120));
  if (fn === "resolve_client_for_order") {
    if (RESOLVE === "falla") return { data: null, error: { message: "upstream connect error", code: "" } };
    return { data: RESP[RESOLVE], error: null };
  }
  if (fn === "create_client_from_printflow") {
    if (CREAR === "frena") return { data: null, error: { code: "22023", message: "Ya existe «CERVECERIA MODELO DE MEXICO» (mismo nombre): elígelo en la lista en vez de crearlo. Si de verdad es otro cliente, pídele a CxC (Karla) que lo dé de alta en CobranzaFlow." } };
    if (CREAR === "baja") return { data: null, error: { code: "22023", message: "Ya existe «TEST CLIENTE» (mismo nombre), pero está dado de baja: pídele a CxC (Karla) que lo revise en CobranzaFlow en vez de crearlo otra vez." } };
    if (CREAR === "falla") return { data: null, error: { message: "upstream connect error", code: "" } };
    return { data: "c-nuevo", error: null };
  }
  return { data: null, error: { message: "rpc no simulada: " + fn } };
} };`,
  fnBlock("ClientConfirmModal"),
  hay("mensajeDeCliente") ? (L.find(l => l.startsWith("const mensajeDeCliente=")) || fnBlock("mensajeDeCliente"))
    : `// (el código anterior: cada puerta armaba su propio aviso)
const mensajeDeCliente = e => "Error resolviendo cliente: " + (e?.message || "desconocido");`,
  hay("resolverClienteNuevo") ? fnBlock("resolverClienteNuevo") : `// (el código anterior a v10.84.69: lo que la forma de la orden hacía en línea, copiado de App.jsx 11653-11685 y la OC 17762-17790)
async function resolverClienteNuevo({ nombre, rfc, email, telefono, rfcObligatorio = false, preguntar = window.__showClientConfirmModal }) {
  const { data: resolution, error: resErr } = await supabase.rpc("resolve_client_for_order", { p_name: nombre });
  if (resErr) throw resErr;
  if (resolution?.exact_match) return { tipo: "existente", id: resolution.exact_match, nombre: resolution.exact_name };
  if (resolution?.similar_matches?.length > 0) {
    const confirmed = await preguntar?.({ typed: nombre, matches: resolution.similar_matches });
    if (confirmed === "cancel") return { tipo: "cancelado" };
    if (confirmed !== "new") return { tipo: "elegido", id: confirmed };
    if (rfcObligatorio && !rfc) return { tipo: "falta_rfc" };
  } else {
    if (rfcObligatorio && !rfc) return { tipo: "falta_rfc" };
    const confirmed = await preguntar?.({ typed: nombre, matches: [], rfc, contact: email || telefono });
    if (confirmed !== "new") return { tipo: "cancelado" };
  }
  const { data: newId, error: createErr } = await supabase.rpc("create_client_from_printflow", { p_name: nombre, p_rfc: rfc || null, p_email: email || null, p_whatsapp: telefono || null, p_dias_credito: 0 });
  if (createErr) throw createErr;
  return { tipo: "nuevo", id: newId };
}`,
  `// La forma de la orden (simulada): registrada en escStack como la de verdad (CreateOCModal usa useEscClose).
function FormaFalsa({ onClose }) {
  useEscClose(onClose);
  const [nombre, setNombre] = useState(Q.get("nombre") || "Grupo Modelo");
  const [rfc, setRfc] = useState(Q.get("rfc") || "");
  const [correo, setCorreo] = useState(Q.get("correo") || "");
  const guardar = async () => {
    log("guardar");
    try { const r = await resolverClienteNuevo({ nombre: nombre.trim(), rfc: rfc.trim(), email: correo.trim(), telefono: "", rfcObligatorio: OC }); log("resultado:" + JSON.stringify(r)); }
    catch (e) { log("toast:" + mensajeDeCliente(e)); }
  };
  return <div id="forma" style={{ padding: 16, border: "1px solid #ccc", borderRadius: 12, maxWidth: 520 }}>
    <div style={{ fontWeight: 700, marginBottom: 8 }}>{OC ? "Crear OC (simulada)" : "Nueva orden (simulada)"}</div>
    <label>Cliente <input aria-label="Cliente" value={nombre} onChange={e => setNombre(e.target.value)} /></label>
    <label>RFC <input aria-label="RFC" value={rfc} onChange={e => setRfc(e.target.value)} /></label>
    <label>Correo <input aria-label="Correo" value={correo} onChange={e => setCorreo(e.target.value)} /></label>
    <button id="guardar" onClick={guardar}>Guardar</button>
  </div>;
}
function Banco() {
  const [clientConfirmModal, setClientConfirmModal] = useState(null);
  const [forma, setForma] = useState(true);
  const [lineas, setLineas] = useState([]);
  window.__L = t => setLineas(l => [...l, t]);
  // como App (v10.13.0): la forma pide la pregunta por window.__showClientConfirmModal y espera la respuesta
  useEffect(() => {
    window.__showClientConfirmModal = (props) => new Promise(resolve => {
      log("pregunta:" + JSON.stringify({ typed: props.typed, matches: (props.matches || []).length, dadosDeBaja: (props.dadosDeBaja || []).length, rfc: props.rfc || null, contact: props.contact || null }));
      setClientConfirmModal({ ...props, onResolve: (result) => { setClientConfirmModal(null); log("resuelto:" + result); resolve(result); } });
    });
    return () => { delete window.__showClientConfirmModal; };
  }, []);
  return <div style={{ padding: 20, fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    <pre id="log" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: 10 }}>{lineas.join("\\n")}</pre>
    {forma ? <FormaFalsa onClose={() => { setForma(false); log("forma:cerrada"); }} /> : <div id="forma-cerrada">la forma se cerró</div>}
    ${montaje}
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco cliente</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5192), strictPort: true } });
`, "utf8");
console.log("banco de cliente listo en " + outDir);
