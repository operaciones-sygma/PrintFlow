// Banco de «TIEMPO POR ETAPA» (`StageFlowHistory`, el panel del detalle de la orden y de la ficha abierta), EXTRAÍDO por extraer.mjs con lo que usa. La orden
// la pone la tanda en `window.__orden` antes de cargar (con la bitácora de verdad: tests/romper/tiempos.mjs); `window.__cambiar(campos)` la cambia con el panel
// abierto, como el tiempo real. El panel no le pide nada a la base: lee la bitácora que la orden ya trae.
// Uso: node gen-tiempos.mjs <App.jsx> <dirSalida>
// Variantes por URL: ancho=552 (el del detalle a 1366; 300, una columna angosta) · rol=admin (quien no es Dirección ve los tiempos sin marcas: en App lo decide `role`, y lo prueba `sesion`)
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo } = extraer(fuente, ["StageFlowHistory"], { simulados: [] });
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `const Q = new URLSearchParams(location.search);
const ANCHO = Number(Q.get("ancho") || 552), ROL = Q.get("rol") || "admin";`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [orden, setOrden] = useState(window.__orden);
  useEffect(() => { window.__cambiar = p => setOrden(o => ({ ...o, ...p })); }, []);
  return <div style={{ background: C.canvas, minHeight: "100vh", padding: 20, fontFamily: "'Geist',sans-serif" }}>
    <div id="listo" style={{ display: "none" }}>listo</div>
    <div id="caja" style={{ width: ANCHO, maxWidth: "100%", background: C.bg, borderRadius: 14, padding: 16 }}>
      <StageFlowHistory order={orden} conMarcas={ROL === "admin"} />
    </div>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco tiempo por etapa</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5493), strictPort: true } });
`, "utf8");
console.log("banco de tiempo por etapa listo en " + outDir);
