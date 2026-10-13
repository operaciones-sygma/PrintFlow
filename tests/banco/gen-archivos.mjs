// Banco de «Archivos» (StorageTab) EXTRAÍDO de un App.jsx, con su lista de archivos, Storage y la tabla de órdenes simulados.
// Sólo así se pueden probar los botones que BORRAN (limpiar huérfanos, el Top 5, el de cada renglón) sin tocar nada real.
// v10.84.83 — con extraer.mjs (antes, a mano por renglones): lo que StorageTab usa (la ventana de confirmar de la app, el aviso, los
//   nombres de las etapas) entra solo, y el mismo banco sirve contra el App.jsx de antes (la corrida doble).
// Uso: node gen-archivos.mjs <App.jsx> <dirSalida>
// Variantes por URL (modo=): normal · rpcfalla (la lista contesta error) · rmfalla (Storage contesta error al borrar) ·
//   rmvacio (Storage contesta 200 sin borrar nada: sin permiso o ya no estaba) · updfalla (la orden no se deja actualizar) ·
//   sincampo (la base no manda «referenciado») · lleno (el bucket a más del 90 %) · muchoshuerfanos (más de la mitad sin usar) ·
//   sinordenes (la lista de órdenes llegó vacía) · lento (Storage tarda 1.5 s en borrar) · doshuerfanos (dos sin usar) ·
//   rmparcial (Storage borra unos sí y otros no) · segunda (la orden trae segunda imagen) · sinfolio (la orden sin P-…).
//   Se combinan con comas: modo=doshuerfanos,rmparcial
// window.__cambiarArchivo(): la orden cambia de archivo (como el realtime), para probar lo que cambia con la ventana abierta.
import fs from "node:fs";
import path from "node:path";
import { extraer } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo, simuladosUsados } = extraer(fuente, ["StorageTab"], { simulados: ["supabase"] });
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  `// ── lo que toca la base o Storage, simulado (${simuladosUsados.join(", ")}) ──
const Q = new URLSearchParams(location.search);
const MODO = Q.get("modo") || "normal";
const M = new Set(MODO.split(","));
const BASE = "https://uvhardaeooaxjrrgdjwa.supabase.co/storage/v1/object/public/order-files/";
const hace = (d, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();
// Lo que contesta la base (pf_archivos_del_bucket): la orden cargada usa arte.pdf e img-1-a.png; la foto de hoy y el
// archivo de OTRA orden (no cargada aquí) también cuentan como usados; sólo replica/img-x.png es huérfano.
const sinUso = M.has("muchoshuerfanos");
const ARCHIVOS = [
  { ruta: "OP-1/arte.pdf", tamano: 5000000, creado: hace(40), referenciado: true },
  { ruta: "new-img-a/img-1-a.png", tamano: 200000, creado: hace(5), referenciado: true },
  { ruta: "replica/img-x.png", tamano: 300000, creado: hace(10), referenciado: false },
  { ruta: "new-img-hoy/img-1-hoy.png", tamano: 100000, creado: hace(0, 1), referenciado: !sinUso && !M.has("doshuerfanos") },
  { ruta: "OP-9/de-otra.pdf", tamano: 9000000, creado: hace(60), referenciado: !sinUso },
  ...(M.has("lleno") ? [{ ruta: "OP-7/enorme.tif", tamano: 97e9, creado: hace(3), referenciado: true }] : []),
  ...(M.has("segunda") ? [{ ruta: "new-img-b/img-2-b.png", tamano: 250000, creado: hace(5), referenciado: true }] : []),
];
const ORDEN_1 = { id: "o1", production_number: M.has("sinfolio") ? null : "P-0001", client: "PORTLAND STUDIO", stage: "in_production", file_url: BASE + "OP-1/arte.pdf",
  file_name: "arte.pdf", image_url: BASE + "new-img-a/img-1-a.png", ...(M.has("segunda") ? { image_url_2: BASE + "new-img-b/img-2-b.png" } : {}), created_at: hace(40) };
const ORDERS = M.has("sinordenes") ? [] : [ORDEN_1];
const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.open = u => { anota("open: " + u); return null; };
// update(...).eq(...)[.eq(...)]: se puede encadenar y se espera como promesa (lo que hace supabase-js)
const actualizar = (t, v) => {
  const filtros = [];
  const contesta = () => { anota("update: " + t + " " + filtros.join("&") + " " + JSON.stringify(v)); return M.has("updfalla") ? { data: null, error: { message: "rls" } } : { data: null, error: null }; };
  const q = { eq: (c, x) => { filtros.push(c + "=" + x); return q; }, then: (bien, mal) => Promise.resolve().then(contesta).then(bien, mal) };
  return q;
};
const supabase = {
  rpc: async fn => { anota("rpc: " + fn); await new Promise(r => setTimeout(r, 30));
    if (M.has("rpcfalla")) return { data: null, error: { message: "timeout" } };
    // sincampo: la base deja de mandar «referenciado» (una función cambiada mañana): nada debe volverse huérfano
    return { data: M.has("sincampo") ? ARCHIVOS.map(({ referenciado, ...r }) => r) : ARCHIVOS, error: null }; },
  storage: { from: () => ({
    list: async () => { anota("list"); return { data: null, error: { message: "544 DatabaseTimeout" } }; },
    remove: async ps => { anota("remove: " + ps.join(",")); await new Promise(r => setTimeout(r, M.has("lento") ? 1500 : 60)); anota("removido: " + ps.join(","));
      if (M.has("rmfalla")) return { data: null, error: { message: "denied" } }; if (M.has("rmvacio")) return { data: [], error: null };
      if (M.has("rmparcial")) return { data: ps.filter(p => !/hoy/.test(p)).map(p => ({ name: p })), error: null };
      return { data: ps.map(p => ({ name: p })), error: null }; },
    createSignedUrl: async p => ({ data: { signedUrl: "https://firmado.test/" + p }, error: null }),
    createSignedUrls: async ps => ({ data: ps.map(p => ({ path: p, error: null, signedUrl: "https://firmado.test/" + p })), error: null }),
  }) },
  from: t => ({ update: v => actualizar(t, v) }),
};`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [ordenes, setOrdenes] = useState(ORDERS);
  window.__cambiarArchivo = () => { anota("cambio: o1 ahora usa OP-1/arte-v2.pdf"); setOrdenes(os => os.map(o => o.id === "o1" ? { ...o, file_url: BASE + "OP-1/arte-v2.pdf", file_name: "arte-v2.pdf" } : o)); };
  return <div style={{ padding: 20, fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    <StorageTab orders={ordenes} onReload={() => anota("reload")} />
    <pre id="log"></pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco archivos</title>
<link rel="icon" href="data:,">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5197), strictPort: true } });
`, "utf8");
console.log("banco de archivos listo en " + outDir);
