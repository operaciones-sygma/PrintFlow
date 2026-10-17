// Banco de «PONER EN ESPERA» (`SnoozeModal`: la razón, el motivo y por cuántos días; la puerta de «En espera»), EXTRAÍDO por extraer.mjs con lo que usa y
// montado con la línea de App que lo monta. Su /impeccable critique del 17-oct (v10.84.147). Lo de App (applySnooze) se simula como es: la razón de menos
// de 5 letras no pasa, la base puede rechazar (la ventana se queda con lo escrito) y al guardar se cierra.
// Lo que la ventana pide a App se anota en #log: «en-espera <kind> <until> · <razón>», «cerrar», «error-base».
// Uso: node gen-poner-espera.mjs <App.jsx> <dirSalida>
// Variantes por URL: caso=lejos (entrega en un mes: «Entrega lejana» se puede) · caso=pronto (entrega en 2 días hábiles) · caso=sinfecha · falla=base
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo } = extraer(fuente, ["SnoozeModal"], { simulados: ["supabase", "db"] });
const montaje = (L.find(x => x.includes("{snoozeTarget&&<SnoozeModal")) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje de «Poner en espera» en App (snoozeTarget&&<SnoozeModal)");
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.slice(-60).join("\\n"); };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
const supabase = {}, db = {};
const Q = new URLSearchParams(location.search);
const CASO = Q.get("caso") || "", FALLA = Q.get("falla") || "";
// el reloj lo fija la tanda: viernes 16-oct-2026 a las 12:00
const DUE = CASO === "lejos" ? "2026-11-20" : CASO === "pronto" ? "2026-10-20" : CASO === "sinfecha" ? null : "2026-10-28";
const ORDEN = { id: "OP-P-0700", production_number: "P-0700", client: "IMPRENTA DEL BAJIO", stage: "design", due_date: DUE, product_type: "Volantes" };`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [snoozeTarget, setSnoozeTargetState] = useState(ORDEN);
  const setSnoozeTarget = v => { if (!v) anota("cerrar"); setSnoozeTargetState(v); };
  const showToast = m => anota("aviso " + m);
  // lo que hace App (applySnooze): la razón corta no pasa; la base contesta en 300 ms; con error la ventana se queda; al guardar, se cierra
  const applySnooze = async (o, { reason, kind, until }) => {
    const r = (reason || "").trim(); if (r.length < 5) { showToast("Razón mínima 5 caracteres"); return; }
    await new Promise(x => setTimeout(x, 300));
    if (FALLA === "base") { anota("error-base"); showToast("❌ no se pudo guardar"); return; }
    anota("en-espera " + (kind || "-") + " " + (until || "-") + " · " + r);
    setSnoozeTarget(null);
  };
  return <div style={{ background: C.canvas, minHeight: "100vh" }}>
    <button id="atras" style={{ margin: 20 }}>botón de la página de atrás</button>
    {${montaje.replace(/^\{/, "").replace(/\}$/, "")}}
    <pre id="log" style={{ fontSize: 10, color: "#666", position: "fixed", bottom: 0, left: 0, margin: 0, zIndex: 2000, background: "#fff" }}></pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco poner en espera</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5488), strictPort: true } });
`, "utf8");
console.log("banco de poner en espera listo en " + outDir);
