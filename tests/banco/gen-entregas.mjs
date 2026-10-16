// Banco de «ENTREGAS» (el calendario de entregas: `Calendar` de App.jsx, EXTRAÍDO por extraer.mjs con lo que usa). v10.84.122, la critique de
// «Entregas» (16-oct). Las órdenes son de la semana del lunes 12 al domingo 18 de octubre de 2026: la tanda fija el reloj del navegador en el
// miércoles 14 a las 12:00 de México (sin eso, «hoy» y «retrasada» cambian con el día en que se corra).
// Cada cambio de fecha se anota en #log: «cambio <id> <fecha> · <motivo>»; un alert()/confirm() nativo también («alert: …»): la app no los usa.
// Uso: node gen-entregas.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=secretaria|vendedor|karla|produccion|admin (vendedor: genaro) · cambio=ok|falla|lento (lo que hace App al guardar) ·
//   lleno=1 (el jueves con 9 órdenes)
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo } = extraer(fuente, ["Calendar", "VIEW_MAXW"], { simulados: [] });   // (VIEW_MAXW: el contenedor copiado de App lo usa)
const menuAncho = /width:sbPlegado\?(\d+):(\d+),flexShrink:0,height:"100vh"/.exec(fuente);
if (!menuAncho) throw new Error("no encuentro el ancho del menú lateral de App");
const contenedor = (L.find(x => x.includes('<div style={{boxSizing:"border-box",width:"100%",maxWidth:view==="board"')) || "").trim();
if (!contenedor) throw new Error("no encuentro el contenedor de las vistas de App");
const montaje = (L.find(x => x.includes('{view==="calendar"&&<div>')) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje de «Entregas» en App (view===\"calendar\")");
const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  ...importacionesDeLib(fuente),
  `const Q = new URLSearchParams(location.search);
const ROL = Q.get("rol") || "secretaria", LOGIN = { vendedor: "genaro", secretaria: "lupita", karla: "karla", produccion: "gerardo", admin: "marcelo" }[ROL] || ROL;
const CAMBIO = Q.get("cambio") || "ok";
const registro = [];
const anota = t => { registro.push(t); const el = document.getElementById("log"); if (el) el.textContent = registro.join("\\n"); };
window.alert = m => anota("alert: " + String(m).split("\\n")[0]);
window.confirm = m => { anota("confirm: " + String(m).split("\\n")[0]); return true; };
const o = (id, due_date, x = {}) => ({ id, production_number: "P-" + id.slice(1).padStart(4, "0"), client: "CLIENTE " + id, product_type: "Volantes", quantity: 1000, stage: "in_production",
  priority: "normal", due_date, created_by: "lupita", order_type: "interna", ...x });
const ORDENES = [
  o("o1", "2026-10-12", { client: "PREMIUM RESTAURANT BRANDS", product_type: "Cuponera", quantity: 8000, stage: "salidas" }),                      // retrasada
  o("o2", "2026-10-14", { client: "INSTITUTO DE SALUD PUBLICA DEL ESTADO DE GUANAJUATO", product_type: "Folder", quantity: 3000, priority: "urgente" }),  // hoy, urgente, nombre largo
  o("o3", "2026-10-15", { client: "COSQUIM", product_type: "Etiquetas", quantity: 20000, stage: "ready" }),
  o("o4", "2026-10-13", { client: "MAFER", stage: "delivered" }),                                                                                  // entregada
  o("o5", "2026-10-16", { client: "CANCELADA SA", stage: "cancelled" }),                                                                           // no sale
  o("o6", "2026-10-15", { client: "DE GENARO", created_by: "genaro" }),
  o("o7", "2026-10-16", { client: "DE MANUEL", created_by: "manuel" }),
  o("o8", "2026-10-19", { client: "LA DE LA OTRA SEMANA" }),
  o("o9", "2026-10-15", { client: "URGENTE A TIEMPO", priority: "urgente", stage: "packaging" }),   // (al escribirla vencía el martes: también era retrasada)
  ...(Q.get("lleno") === "1" ? Array.from({ length: 8 }, (_, i) => o("o" + (20 + i), "2026-10-15", { client: "MUCHAS " + (i + 1) })) : []),
];`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [orders, setOrders] = useState(ORDENES);
  // window.__mover(id, fecha): otra persona le cambia la fecha a una orden (como el tiempo real), con la ventana abierta o no
  useEffect(() => { window.__mover = (id, fecha) => { anota("movida " + id + " " + fecha); setOrders(p => p.map(y => y.id === id ? { ...y, due_date: fecha } : y)); }; }, []);
  const user = ROL, userLogin = LOGIN, view = "calendar";
  const filteredOrders = orders;
  // lo que hace App al cambiar la fecha (changeDate): si es la misma, nada; si no, la cambia (y en la base, que aquí puede fallar)
  const changeDate = async (oid, newDate, reason) => {
    const x = orders.find(y => y.id === oid);
    if (x?.due_date === newDate) { anota("misma fecha " + oid); return; }
    anota("cambio " + oid + " " + newDate + " · " + reason);
    if (CAMBIO === "lento") await new Promise(r => setTimeout(r, 1500));
    if (CAMBIO === "falla") { anota("falló " + oid); return; }
    setOrders(p => p.map(y => y.id === oid ? { ...y, due_date: newDate } : y));
  };
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
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco entregas</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5185), strictPort: true } });
`, "utf8");
console.log("banco de entregas listo en " + outDir);
