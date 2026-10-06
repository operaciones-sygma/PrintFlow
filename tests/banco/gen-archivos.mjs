// Banco de «Archivos» (StorageTab) EXTRAÍDO de un App.jsx, con su lista de archivos, Storage y la tabla de órdenes simulados.
// Sólo así se pueden probar los botones que BORRAN (limpiar huérfanos, el Top 5, la limpieza de +30 días) sin tocar nada real.
// Uso: node gen-archivos.mjs <App.jsx> <dirSalida>
// Variantes por URL (modo=): normal · rpcfalla (la lista contesta error) · rmfalla (Storage contesta error al borrar) ·
//   rmvacio (Storage contesta 200 sin borrar nada: sin permiso o ya no estaba) · updfalla (la orden no se deja actualizar)
import fs from "node:fs";
import path from "node:path";
const [, , srcPath, outDir] = process.argv;
const L = fs.readFileSync(srcPath, "utf8").replace(/\r\n/g, "\n").split("\n");
const find = (pred, desc) => { const i = L.findIndex(pred); if (i < 0) throw new Error("no encuentro " + desc); return i; };
const line = (re, desc) => L[find(l => re.test(l), desc)];
const fnBlock = name => { const s = find(l => l.startsWith("function " + name + "("), name); let e = s; while (L[++e] !== "}") { if (e > s + 2000) throw new Error("sin cierre " + name); } return L.slice(s, e + 1).join("\n"); };
// el bloque de firmas (de pathDeOrderFile a SignedImg): la lista enlaza las descargas firmadas
const bloque = (desde, hasta) => { const s = find(l => l.startsWith(desde), desde); const e = find(l => l.startsWith(hasta), hasta); let f = e; while (L[++f] !== "}") { if (f > e + 50) throw new Error("sin cierre " + hasta); } return L.slice(s, f + 1).join("\n"); };
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  line(/^import \{ Broadcast as BroadcastIcon/, "íconos"),
  line(/^const C=\{/, "C"), line(/^const F=\{/, "F"),
  line(/^const inp=/, "inp"), line(/^const lbl=/, "lbl"), line(/^const bt=/, "bt"), line(/^const bs=/, "bs"),
  line(/^const fmt=/, "fmt"),
  `const Q = new URLSearchParams(location.search);
const MODO = Q.get("modo") || "normal";
const BASE = "https://uvhardaeooaxjrrgdjwa.supabase.co/storage/v1/object/public/order-files/";
const hace = (d, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();
// Lo que contesta la base (pf_archivos_del_bucket): la orden cargada usa arte.pdf e img-1-a.png; la foto de hoy y el
// archivo de OTRA orden (no cargada aquí) también cuentan como usados; sólo replica/img-x.png es huérfano.
const ARCHIVOS = [
  { ruta: "OP-1/arte.pdf", tamano: 5000000, creado: hace(40), referenciado: true },
  { ruta: "new-img-a/img-1-a.png", tamano: 200000, creado: hace(5), referenciado: true },
  { ruta: "replica/img-x.png", tamano: 300000, creado: hace(10), referenciado: false },
  { ruta: "new-img-hoy/img-1-hoy.png", tamano: 100000, creado: hace(0, 1), referenciado: true },
  { ruta: "OP-9/de-otra.pdf", tamano: 9000000, creado: hace(60), referenciado: true },
];
const ORDERS = [{ id: "o1", production_number: "P-0001", client: "PORTLAND STUDIO", file_url: BASE + "OP-1/arte.pdf", file_name: "arte.pdf",
  image_url: BASE + "new-img-a/img-1-a.png", created_at: hace(40) }];
const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
const supabase = {
  rpc: async fn => { anota("rpc: " + fn); await new Promise(r => setTimeout(r, 30));
    if (MODO === "rpcfalla") return { data: null, error: { message: "timeout" } };
    // sincampo: la base deja de mandar «referenciado» (una función cambiada mañana): nada debe volverse huérfano
    return { data: MODO === "sincampo" ? ARCHIVOS.map(({ referenciado, ...r }) => r) : ARCHIVOS, error: null }; },
  storage: { from: () => ({
    list: async () => { anota("list"); return { data: null, error: { message: "544 DatabaseTimeout" } }; },
    remove: async ps => { anota("remove: " + ps.join(",")); if (MODO === "rmfalla") return { data: null, error: { message: "denied" } }; if (MODO === "rmvacio") return { data: [], error: null }; return { data: ps.map(p => ({ name: p })), error: null }; },
    createSignedUrl: async p => ({ data: { signedUrl: "https://firmado.test/" + p }, error: null }),
    createSignedUrls: async ps => ({ data: ps.map(p => ({ path: p, error: null, signedUrl: "https://firmado.test/" + p })), error: null }),
  }) },
  from: t => ({ update: v => ({ eq: async (c, id) => { anota("update: " + t + " " + id + " " + JSON.stringify(v)); return MODO === "updfalla" ? { error: { message: "rls" } } : { error: null }; } }) }),
};`,
  bloque("const pathDeOrderFile=", "function SignedImg("),
  fnBlock("StorageTab"),
  `function Banco() {
  return <div style={{ padding: 20, fontFamily: "'Geist',sans-serif", background: C.canvas, minHeight: "100vh" }}>
    <StorageTab orders={ORDERS} onReload={() => anota("reload")} />
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
