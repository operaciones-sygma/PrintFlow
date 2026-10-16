// Banco de la «TORRE DE CONTROL» (la vista con la que abre Dirección: `ControlTowerView`), EXTRAÍDA de App.jsx por extraer.mjs con lo que usa
// (diagnoseOrder, que decide qué está detenido) y montada con la línea de App que la monta. La critique del 16-oct. La tanda fija el reloj del
// navegador en el miércoles 14-oct-2026 a las 12:00 de México.
// Lo que la vista pide a App se anota en #log: «accion <id> <acción>», «recordar <id>», «recordar-a <persona> <n>», «espera <id>», «reactivar <id>»,
// «salud».
// Uso: node gen-torre.mjs <App.jsx> <dirSalida>
// Variantes por URL: lectura=no (todavía no se ha leído nada de la base) · caso=calma (nada detenido, sólo datos por capturar) | sana (nada de nada)
// Gancho: window.__cambiar(id, campos) cambia una orden con la vista abierta (el tiempo real).
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo } = extraer(fuente, ["ControlTowerView", "VIEW_MAXW"], { simulados: ["supabase", "db"] });
const menuAncho = /width:sbPlegado\?(\d+):(\d+),flexShrink:0,height:"100vh"/.exec(fuente);
if (!menuAncho) throw new Error("no encuentro el ancho del menú lateral de App");
const contenedor = (L.find(x => x.includes('<div style={{boxSizing:"border-box",width:"100%",maxWidth:view==="board"')) || "").trim();
if (!contenedor) throw new Error("no encuentro el contenedor de las vistas de App");
const montaje = (L.find(x => x.includes('{view==="torre"&&')) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje de la Torre en App (view===\"torre\")");
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
const supabase = {}, db = {};
const Q = new URLSearchParams(location.search);
const SIN_LECTURA = Q.get("lectura") === "no", CASO = Q.get("caso") || "";
const T = s => new Date(s).toISOString();
// la orden con su bitácora: getStale/daysInStage miden desde la entrada que la llevó a su etapa («to»)
const o = (pn, stage, desde, x = {}) => ({ id: "OP-" + pn, production_number: pn, client: "CLIENTE " + pn, product_type: "Volantes", quantity: 1000, stage, priority: "normal",
  order_type: "interna", price: 1500, created_by: "secretaria", agent: "Manuel", due_date: "2026-10-30", created_at: T("2026-10-01T09:00:00-06:00"), notes_log: [], comments: [],
  timeline: [{ to: stage, date: T(desde), action: "→ " + stage }], ...x });
const HOY = "2026-10-14T09:00:00-06:00", HACE4 = "2026-10-08T09:00:00-06:00", HACE5 = "2026-10-07T09:00:00-06:00";
// lo que NO es trabajo parado: datos por capturar (diagnoseOrder los pone al final: «no bloqueantes de flujo»)
const DATOS = [
  // maquilas en proceso, sin fecha comprometida, 4 días en la etapa: para la regla, ROJAS
  ...["P-0701", "P-0702", "P-0703"].map(pn => o(pn, "maq_in_progress", HACE4, { order_type: "maquila", due_date: null, price: 0, maq_price: 10000, maq_cost: 6000, maq_provider: "Suajes SA", client: "MAQUILA SIN FECHA " + pn })),
  // en diseño desde hoy, sin fecha: amarillas
  ...["P-0704", "P-0705", "P-0706"].map(pn => o(pn, "design", HOY, { due_date: null, client: "SIN FECHA " + pn })),
  // sin precio (Karla)
  o("P-0707", "design", HOY, { price: 0, client: "SIN PRECIO" }),
];
// lo que SÍ es trabajo parado
const PARADAS = [
  o("P-0611", "packaging", HOY, { needs_reprint: true, price: 2000, client: "REIMPRIMIR SA" }),                         // Gerardo, roja
  o("P-0612", "salidas", HACE4, { price: 3000, client: "SIN FOLIO SA" }),                                                  // Karla, roja
  o("P-0613", "placas_listas", HOY, { due_date: "2026-10-09", price: 4000, client: "VENCIDA SA" }),                        // Gerardo, vencida
  o("P-0614", "packaging", HACE5, { price: 5000, client: "QUIETA EN EMPAQUE" }),                                            // Gerardo, 5 días sin avanzar
  o("P-0615", "draft", HOY, { price: 1000, client: "POR VALIDAR" }),                                                       // Gerardo y Noemí
  o("P-0616", "proof_client", HACE4, { price: 6000, client: "EL CLIENTE NO APRUEBA" }),                                    // externa (Lupita da seguimiento)
];
const SANAS = [
  o("P-0620", "in_production", HOY, { current_machine: "off_pm74", machine_queue_position: 0, client: "EN MAQUINA SA" }),
  o("P-0621", "design", HOY, { client: "EN DISEÑO SA" }),
  o("P-0622", "ready", HOY, { current_machine: "off_pm52", machine_queue_position: 1, client: "EN COLA SA" }),
];
const EN_ESPERA = [o("P-0630", "salidas", HACE5, { snooze_reason: "El cliente no ha pedido factura", snooze_stage: "salidas", snoozed_by: "karla", client: "EN ESPERA SA" })];
const ORDENES = SIN_LECTURA ? [] : CASO === "sana" ? SANAS : CASO === "calma" ? [...DATOS, ...SANAS] : [...DATOS, ...PARADAS, ...SANAS, ...EN_ESPERA];`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [orders, setOrders] = useState(ORDENES);
  useEffect(() => { window.__cambiar = (id, x) => { anota("cambiada " + id); setOrders(p => p.map(y => y.id === id ? { ...y, ...x } : y)); }; }, []);
  const user = "admin", view = "torre", dayTick = 0, maintKey = 0;
  const lectura = SIN_LECTURA ? { ok: null, fallo: Date.now() } : { ok: Date.now(), fallo: null };
  const handleAction = (id, accion) => anota("accion " + id + " " + accion);
  const snoozeOrder = x => anota("espera " + x.id), unsnoozeOrder = x => anota("reactivar " + x.id);
  const nudgeDiag = ({ o }) => anota("recordar " + o.id), nudgeBatch = (rol, nombre, g) => anota("recordar-a " + nombre + " " + g.length);
  const setView = v => anota(v === "health" ? "salud" : "vista " + v);
  return <div style={{ display: "flex", background: C.canvas, minHeight: "100vh" }}>
    <div id="lateral" style={{ width: ${menuAncho[2]}, flexShrink: 0, height: "100vh", borderRight: "0.5px solid #ddd" }} />
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div id="barra" style={{ height: 57, flexShrink: 0, borderBottom: "0.5px solid #ddd" }} />
      ${contenedor}
        ${montaje}
        <pre id="log" style={{ fontSize: 10, color: "#666" }}></pre>
      </div>
    </div>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco torre</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5181), strictPort: true } });
`, "utf8");
console.log("banco de la torre listo en " + outDir);
