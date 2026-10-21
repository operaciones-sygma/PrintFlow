// Banco de «Nueva Orden de Compra» (`CreateOCModal`, la de la vista de OC), EXTRAÍDA de App.jsx por extraer.mjs con lo que usa (el buscador
// de clientes, «¿ya existe?», la pregunta de cerrar). v10.84.166 — Marcelo, 21-oct: «que en PrintFlow esos clientes tengan la ficha de Pepe
// Chuy encendida por default» (MONICA CUADRA BECERRA e ISABEL DE LOS ANGELES QUIROZ). La forma de la orden, el carrito de stock, «mover a OC
// nueva» y duplicar ya proponían el vendedor de la ficha (get_client_seller_label); esta ventana arrancaba en «— Sin asignar —», y lo que se
// agrega a una OC toma el vendedor de la OC (F-142 de Isabel salió a nombre de Manuel por OC-0911).
// Se anota en #log: «rpc:<fn> <args>», «crear-oc <json>», «cerrar», «aviso <texto>», «pregunta <json>».
// Uso: node gen-nueva-oc.mjs <App.jsx> <dirSalida>
// Variantes por URL: lento=<id de cliente> (su vendedor tarda 1.5 s) · vendedor=falla (la base no contesta el vendedor) · resolve=existente|
//   parecido|nada (lo que contesta la base al crear con un nombre ESCRITO; existente = ISABEL) · pregunta=new|cancel|<id> (lo que se contesta
//   en «¿ya existe?») · crear=lento (onCreate tarda 1 s, para el doble clic)
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo } = extraer(fuente, ["CreateOCModal"], { simulados: ["supabase", "db"] });
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
const Q = new URLSearchParams(location.search);
const LENTO = Q.get("lento") || "", VEND_FALLA = Q.get("vendedor") === "falla", RESOLVE = Q.get("resolve") || "nada", PREGUNTA = Q.get("pregunta") || "new", CREAR_LENTO = Q.get("crear") === "lento";
const espera = ms => new Promise(r => setTimeout(r, ms));
// La ficha de cada cliente: su vendedor como lo da cobranza.users (username, display_name), o ninguno
const PEPE = { username: "pepechuy", display_name: "Pepe Chuy" };
const CLIENTES = [
  { id: "c-monica", name: "MONICA CUADRA BECERRA", rfc: "CUBM9110042K7", email: "admon@talleriq.mx", whatsapp: "", billing_mode: "normal", dias_credito: 15, vendedor: PEPE },
  { id: "c-isabel", name: "ISABEL DE LOS ANGELES QUIROZ", rfc: "QUMI830801TN1", email: "", whatsapp: "4771234567", billing_mode: "normal", dias_credito: 30, vendedor: PEPE },
  { id: "c-hotsson", name: "HOTSSON", rfc: "HOT0101011A1", email: "compras@hotsson.mx", whatsapp: "", billing_mode: "normal", dias_credito: 30, vendedor: { username: "genaro", display_name: "Genaro Mendez" } },
  { id: "c-dumagu", name: "ALMACEN DE CALZADO DUMAGU", rfc: "ACD991231GW9", email: "", whatsapp: "", billing_mode: "normal", dias_credito: 30, vendedor: { username: "victor", display_name: "Victor Fernandez" } },
  { id: "c-rocket", name: "ROCKET IDEAS", rfc: "", email: "", whatsapp: "", billing_mode: "normal", dias_credito: 7, vendedor: { username: "lupita", display_name: "Lupita" } },
  { id: "c-sin", name: "PAPELERIA SIN VENDEDOR", rfc: "PSV040404IJ4", email: "ventas@papeleria.mx", whatsapp: "", billing_mode: "normal", dias_credito: 30, vendedor: null },
  // el catálogo de break-ui: acentos, eñes y guiones; y un nombre larguísimo sin cortes
  { id: "c-acentos", name: "JOSÉ MARÍA PEÑA-GUTIÉRREZ ÑÚÑEZ", rfc: "PEGJ800101AB1", email: "", whatsapp: "", billing_mode: "normal", dias_credito: 30, vendedor: { username: "christian", display_name: "Christian Diaz" } },
  { id: "c-largo", name: "DISTRIBUIDORA INTERNACIONAL DE ETIQUETAS AUTOADHERIBLES Y EMPAQUES FLEXIBLES DEL BAJIO GUANAJUATO SUCURSAL LEON NORTE", rfc: "DIE010101XY9", email: "", whatsapp: "", billing_mode: "normal", dias_credito: 30, vendedor: { username: "jaime", display_name: "Jaime" } },
];
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
const supabase = { rpc: async (fn, args) => {
  anota("rpc:" + fn + " " + JSON.stringify(args));
  if (fn === "search_clients_typeahead") {
    await espera(60);
    const q = norm(args.p_query);
    return { data: CLIENTES.filter(c => norm(c.name).includes(q)).map(({ vendedor, ...c }) => c), error: null };
  }
  if (fn === "get_client_seller_label") {
    await espera(args.p_client_id === LENTO ? 1500 : 80);
    if (VEND_FALLA) return { data: null, error: { message: "upstream connect error", code: "" } };
    const c = CLIENTES.find(x => x.id === args.p_client_id);
    anota("vendedor-contestado " + args.p_client_id);
    return { data: c?.vendedor ? [c.vendedor] : [], error: null };
  }
  if (fn === "get_last_contact_for_client") { await espera(40); return { data: null, error: null }; }
  if (fn === "list_client_agents") { await espera(40); return { data: [], error: null }; }
  if (fn === "resolve_client_for_order") {
    await espera(120);
    if (RESOLVE === "existente") return { data: { exact_match: "c-isabel", exact_name: "ISABEL DE LOS ANGELES QUIROZ", similar_matches: [], dados_de_baja: [] }, error: null };
    if (RESOLVE === "parecido") return { data: { exact_match: null, similar_matches: [{ id: "c-monica", name: "MONICA CUADRA BECERRA", rfc: "CUBM9110042K7", motivo: "se parece", fuerte: false }], dados_de_baja: [] }, error: null };
    return { data: { exact_match: null, similar_matches: [], dados_de_baja: [] }, error: null };
  }
  if (fn === "create_client_from_printflow") { await espera(80); return { data: "c-nuevo", error: null }; }
  return { data: null, error: { message: "rpc no simulada: " + fn } };
} };
const db = {};
// como App: la pregunta de «¿ya existe?» llega por window.__showClientConfirmModal (aquí se contesta sola, con lo que diga la URL)
window.__showClientConfirmModal = async props => { anota("pregunta " + JSON.stringify({ typed: props.typed, matches: (props.matches || []).length })); await espera(50); return PREGUNTA; };`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [abierta, setAbierta] = useState(true);
  // como App (OrdenesCompraView): crear llama a onCreateOC y, al volver, cierra la ventana
  const onCreate = async data => { anota("crear-oc " + JSON.stringify({ client: data.client, client_id: data.client_id, vendedor: data.vendedor })); if (CREAR_LENTO) await espera(1000); setAbierta(false); return "OC-9999"; };
  return <div style={{ background: C.canvas, minHeight: "100vh", fontFamily: "'Geist',sans-serif" }}>
    {abierta ? <CreateOCModal showToast={t => anota("aviso " + t)} onCreate={onCreate} onClose={() => { anota("cerrar"); setAbierta(false); }}/> : <div id="cerrada">la ventana se cerró</div>}
    <pre id="log" style={{ fontSize: 10, color: "#666", marginTop: 40 }}></pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco nueva OC</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5491), strictPort: true } });
`, "utf8");
console.log("banco de «Nueva Orden de Compra» listo en " + outDir);
