// Banco del «HISTORIAL DEL CLIENTE» (`ClientHistory`: se abre al tocar el nombre del cliente en la ficha), EXTRAÍDO por extraer.mjs y montado con la línea
// de App que lo monta; la puerta de App (quién puede abrirlo) es `veHistorialDelCliente` si App.jsx ya la trae, o la regla que tenía handleAction tal cual
// (el vendedor, sólo si CAPTURÓ alguna orden de ese cliente). Su /impeccable critique del 17-oct (v10.84.148).
// Lo que pasa se anota en #log: «aviso <texto>», «historial <cliente>», «cerrar».
// Uso: node gen-historial.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=vendedor (Genaro, por omisión)|admin|produccion
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const conPuerta = /function veHistorialDelCliente\(/.test(fuente);
const { codigo } = extraer(fuente, ["ClientHistory", ...(conPuerta ? ["veHistorialDelCliente"] : [])], { simulados: ["supabase", "db"] });
const montaje = (L.find(x => x.includes("{clientHistory&&<ClientHistory")) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje del historial del cliente en App (clientHistory&&<ClientHistory)");
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
const ROL = Q.get("rol") || "vendedor", LOGIN = { vendedor: "genaro", admin: "marcelo", produccion: "gerardo" }[ROL] || ROL;
const T = s => new Date(s).toISOString();
const o = (pn, x = {}) => ({ id: "OP-" + pn, production_number: pn, client: "CLIENTE", product_type: "Volantes", product: "VOLANTES", quantity: 1000, stage: "delivered",
  order_type: "interna", price: 1000, created_by: "secretaria", agent: "Manuel", created_at: T("2026-10-01T09:00:00-06:00"), ...x });
const ORDENES = [
  // de Genaro sólo como vendedor (la capturó Lupita): el caso real de PAOLA NUÑEZ y VETERINARIA DIVETCO
  o("P-0801", { client: "PAOLA NUÑEZ", agent: "Genaro", created_by: "secretaria", price: 1500, created_at: T("2026-10-10T09:00:00-06:00") }),
  // y otra de PAOLA con el vendedor escrito «GENARO » (mayúsculas y un espacio de más, como se ha capturado)
  o("P-0807", { client: "PAOLA NUÑEZ", agent: "GENARO ", created_by: "secretaria", price: 800, created_at: T("2026-10-12T09:00:00-06:00") }),
  // la Feria: dos que capturó él (una cancelada), una que le capturó Lupita, y una de Manuel
  o("P-0802", { client: "PATRONATO DE LA FERIA", agent: "Genaro", created_by: "genaro", price: 5000, invoice_folio: "F-150", invoice_type: "factura", created_at: T("2026-10-08T09:00:00-06:00") }),
  o("P-0803", { client: "PATRONATO DE LA FERIA", agent: "Genaro", created_by: "genaro", price: 3000, stage: "cancelled", created_at: T("2026-10-06T09:00:00-06:00") }),
  o("P-0804", { client: "PATRONATO DE LA FERIA", agent: "Genaro", created_by: "secretaria", price: 2000, invoice_folio: "RS-30", invoice_type: "remision", stage: "salidas", created_at: T("2026-10-04T09:00:00-06:00") }),
  o("P-0805", { client: "PATRONATO DE LA FERIA", agent: "Manuel", created_by: "secretaria", price: 9000, created_at: T("2026-10-02T09:00:00-06:00") }),
  // y un cliente sin nada de Genaro
  o("P-0806", { client: "AJENO SA", agent: "Manuel", created_by: "manuel", price: 4000 }),
];
const CLIENTES = [["PAOLA NUÑEZ", "OP-P-0801"], ["PATRONATO DE LA FERIA", "OP-P-0802"], ["AJENO SA", "OP-P-0806"]];`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const orders = ORDENES, viewOrders = ORDENES, user = ROL, userLogin = LOGIN;
  const [clientHistory, setClientHistoryState] = useState(null);
  const setClientHistory = v => { anota(v ? "historial " + v : "cerrar"); setClientHistoryState(v); };
  const showToast = m => anota("aviso " + m);
  // la puerta de App al tocar el nombre del cliente en la ficha (handleAction "client_history")
  const abrir = id => {
    const x = orders.find(y => y.id === id);
    ${conPuerta
      ? `if (!veHistorialDelCliente(user, userLogin, x, orders)) { showToast("❌ No tienes órdenes con este cliente"); return; }`
      : `if (x && user === "vendedor" && !orders.some(y => y.client === x.client && y.created_by === userLogin)) { showToast("❌ No tienes órdenes con este cliente"); return; }   // la regla de antes, tal cual estaba en handleAction`}
    setClientHistory(x.client);
  };
  return <div style={{ background: C.canvas, minHeight: "100vh", padding: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
    {CLIENTES.map(([c, id]) => <button key={c} onClick={() => abrir(id)} style={{ padding: "10px 14px" }}>{"Historial de " + c}</button>)}
    ${montaje}
    <pre id="log" style={{ fontSize: 10, color: "#666", position: "fixed", bottom: 0, left: 0, margin: 0, zIndex: 2000, background: "#fff" }}></pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco historial del cliente</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5489), strictPort: true } });
`, "utf8");
console.log("banco del historial del cliente listo en " + outDir);
