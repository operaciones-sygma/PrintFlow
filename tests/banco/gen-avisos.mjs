// Banco de los AVISOS (la campana de arriba y su bandeja: `NotificationBell` y `NotificationTray`), EXTRAÍDOS de App.jsx y montados con las líneas de
// App que los montan (lo que App les pasa también se prueba). La critique del 16-oct.
// La base de los avisos (db.loadNotifications, markRead, markAllRead, deleteNotification, deleteAllNotifications) va simulada y se porta como la de la
// versión que se prueba: la de antes se tragaba los errores de Supabase (devolvía [] o seguía); la de v10.84.127 los avisa (lanza). Se anota en #log:
// «db <función> <id>», «accion <id> <acción>», «aviso <texto>» (el showToast de App).
// Uso: node gen-avisos.mjs <App.jsx> <dirSalida>
// Variantes por URL: falla=leer|marcar|borrar (la base no contesta eso) · caso=vacio (no hay avisos) | muchos (30) | porOrden (tres de P-0611) · rol=secretaria|admin
// Gancho: window.__llega(aviso) mete un aviso nuevo con la bandeja abierta (el tiempo real).
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo } = extraer(fuente, ["NotificationTray", "NotificationBell", "VIEW_MAXW"], { simulados: ["supabase", "db"] });
// la línea de App con la campana (en la barra de arriba) y la de la bandeja
const lineaCampana = L.find(x => x.includes("<NotificationBell count="));
if (!lineaCampana) throw new Error("no encuentro la campana en App");
const campana = lineaCampana.slice(lineaCampana.indexOf("<NotificationBell"), lineaCampana.indexOf("/>", lineaCampana.indexOf("<NotificationBell")) + 2);
const bandeja = (L.find(x => x.includes("{showNotifs&&<NotificationTray")) || "").trim();
if (!bandeja) throw new Error("no encuentro la bandeja de avisos en App");
// ¿la base de esta versión avisa sus errores? (v10.84.127: markRead revisa `error`)
const LANZA = /async markRead\(id\)\s*\{\s*const\s*\{\s*error\s*\}/.test(fuente.replace(/\r\n/g, "\n"));
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
const Q = new URLSearchParams(location.search);
const FALLA = Q.get("falla") || "", CASO = Q.get("caso") || "", ROL = Q.get("rol") || "secretaria";
const LANZA = ${LANZA};
const espera = ms => new Promise(r => setTimeout(r, ms));
// la base de los avisos, como la de la versión que se prueba (LANZA: avisa el error; si no, lo traga como antes)
const falla = (que, n) => { anota("db " + que + (n ? " " + n : "") + " FALLÓ"); if (LANZA) throw new Error(que + ": la base no contestó"); };
const db = {
  loadNotifications: async () => { await espera(80); if (FALLA === "leer") { falla("loadNotifications"); return []; } anota("db loadNotifications"); return AVISOS.map(a => ({ ...a })); },
  markRead: async id => { await espera(60); if (FALLA === "marcar") return falla("markRead", id); anota("db markRead " + id); },
  markAllRead: async () => { await espera(60); if (FALLA === "marcar") return falla("markAllRead"); anota("db markAllRead"); },
  deleteNotification: async id => { await espera(60); if (FALLA === "borrar") return falla("deleteNotification", id); anota("db deleteNotification " + id); },
  deleteAllNotifications: async () => { await espera(60); if (FALLA === "borrar") return falla("deleteAllNotifications"); anota("db deleteAllNotifications"); },
};
const supabase = {};
const T = s => new Date(s).toISOString();
const n = (id, order_id, message, x = {}) => ({ id, order_id, message, reason: null, by_user: "produccion", target_role: ROL, created_at: T("2026-10-14T10:00:00-06:00"), read: false, ...x });
// v10.84.135 — caso=porOrden: tres avisos de P-0611 (dos sin leer), uno de P-0612 y uno sin orden (los avisos juntos por orden)
const POR_ORDEN = [
  n("g1", "OP-P-0611", "📣 Gerardo pide atención: P-0611 · DELDHY WESTERN PRODUCTS · Máquina"),
  n("g2", "OP-P-0612", "🔁 P-0612 se regresó a Diseño", { reason: "El cliente cambió el logotipo", by_user: "preprensa", created_at: T("2026-10-14T09:50:00-06:00") }),
  n("g3", "OP-P-0611", "📦 P-0611 pasó a Empaque", { created_at: T("2026-10-14T09:40:00-06:00") }),
  n("g4", "OP-P-0611", "🖨️ P-0611 se imprimió", { read: true, created_at: T("2026-10-14T09:00:00-06:00") }),
  n("g5", null, "🧹 Limpieza del archivo terminada", { by_user: "admin", created_at: T("2026-10-14T08:00:00-06:00") }),
];
const AVISOS = CASO === "vacio" ? [] : CASO === "porOrden" ? POR_ORDEN : CASO === "muchos" ? Array.from({ length: 30 }, (_, i) => n("m" + i, "OP-P-06" + String(i).padStart(2, "0"), "Aviso número " + (i + 1) + " de la P-06" + String(i).padStart(2, "0"), { read: i > 4 })) : [
  n("a1", "OP-P-0611", "📣 Gerardo pide atención: P-0611 · DELDHY WESTERN PRODUCTS · Máquina"),
  n("a2", "OP-P-0612", "🔁 P-0612 se regresó a Diseño", { reason: "El cliente cambió el logotipo", by_user: "preprensa", created_at: T("2026-10-14T09:30:00-06:00") }),
  n("a3", "OP-H-3000", "✅ H-3000 se entregó", { by_user: "karla", created_at: T("2026-10-13T17:00:00-06:00") }),   // una orden que ya no está entre las cargadas
  n("a4", "OP-P-0613", "📦 P-0613 pasó a Empaque", { read: true, created_at: T("2026-10-13T12:00:00-06:00") }),
  n("a5", "OP-P-0614", "🧾 P-0614 ya tiene folio F-200", { read: true, by_user: "karla", created_at: T("2026-10-12T12:00:00-06:00") }),
];
// las órdenes cargadas (para saber si un aviso puede abrir la suya)
const ORDENES = ["P-0611", "P-0612", "P-0613", "P-0614", ...Array.from({ length: 30 }, (_, i) => "P-06" + String(i).padStart(2, "0"))].map(pn => ({ id: "OP-" + pn, production_number: pn, stage: "ready" }));`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [notifications, setNotifications] = useState([]);
  // lo que App sabe de la lectura de los avisos (v10.84.127): null = todavía no; true = se leyeron; false = la última falló
  const [avisosLeidos, setAvisosLeidos] = useState(null);
  const [showNotifs, setShowNotifs] = useState(Q.get("abierta") !== "no");
  const orders = ORDENES, user = ROL, notifKey = ROL;
  // lo que hace App al entrar: leer los avisos
  useEffect(() => { db.loadNotifications(notifKey).then(x => { setNotifications(x); setAvisosLeidos(true); }).catch(() => setAvisosLeidos(false)); }, []);
  useEffect(() => { window.__llega = a => setNotifications(p => [a, ...p]); }, []);
  const handleAction = (id, accion) => anota("accion " + id + " " + accion);
  const showToast = (t, tipo) => anota("aviso " + (tipo ? "(" + tipo + ") " : "") + t);
  const reloadNotifications = () => db.loadNotifications(notifKey).then(x => { setNotifications(x); setAvisosLeidos(true); }).catch(() => setAvisosLeidos(false));
  return <div style={{ background: C.canvas, minHeight: "100vh", fontFamily: "'Geist',sans-serif" }}>
    <div id="barra" style={{ height: 57, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "0 16px", borderBottom: "0.5px solid #ddd", background: C.bg }}>
      ${campana}
    </div>
    ${bandeja}
    <pre id="log" style={{ fontSize: 10, color: "#666", marginTop: 420 }}></pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco avisos</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5180), strictPort: true } });
`, "utf8");
console.log("banco de los avisos listo en " + outDir + (LANZA ? " (la base avisa sus errores)" : " (la base de antes: se traga los errores)"));
