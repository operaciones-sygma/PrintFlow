// Banco de la HOJA IMPRESA de la orden (`PrintOrder`: la ventana para elegir la copia y la hoja que se abre en otra ventana para imprimir),
// EXTRAÍDA de App.jsx por extraer.mjs con lo que usa, y montada con la línea de App que la monta. La critique del 16-oct.
// La base va simulada: `peekPrint` contesta la versión 3 (o falla con falla=version); las imágenes son archivos del banco (no se firman).
// Se anota en #log: «error <texto>» (lo que App mostraría con showToast), «cerrar».
// Uso: node gen-hoja.mjs <App.jsx> <dirSalida>
// Variantes por URL: caso=normal|larga|enorme|cancelada|maquila|sinlogo|minima|tres|unlugar · rol=secretaria|admin|karla|produccion|preprensa · falla=version
// (v10.84.137: «enorme», P-0658, más larga que «larga»: a una hoja la letra quedaría de menos de 7 pt)
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo } = extraer(fuente, ["PrintOrder"], { simulados: ["supabase", "db"] });
const montaje = (L.find(x => x.includes("{printModal&&<PrintOrder ")) || "").trim();
if (!montaje) throw new Error("no encuentro el montaje de PrintOrder en App");
const RAIZ = process.cwd();   // la raíz de PrintFlow (de ahí sale el logotipo para las imágenes)
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
const CASO = Q.get("caso") || "normal", ROL = Q.get("rol") || "secretaria", FALLA = Q.get("falla") || "";
const supabase = {};
const db = { peekPrint: async () => { await new Promise(r => setTimeout(r, 60)); if (FALLA === "version") throw new Error("la base no contestó"); return { version: 3, content_hash: "a1b2c3d4e5", is_reprint: false }; } };
const ORIGEN = location.origin;
const BASE = { id: "OP-P-0650", production_number: "P-0650", client: "COMERCIALIZADORA DEL BAJIO SA DE CV", client_agent: "Eva Martínez", client_phone: "4771234567",
  client_lada: "+52", client_email: "compras@bajio.mx", client_rfc: "CBA010101AB1", client_company: "COMERCIALIZADORA DEL BAJIO SA DE CV", agent: "Genaro",
  product_type: "Volantes", quantity: 5000, width_cm: 21.5, height_cm: 28, paper_type: "Couché brillante", paper_grammage: 150, ink_front: "4 tintas (CMYK)",
  ink_back: "1 tinta (negro)", finishes: "Barniz Mate, Doblez", notes: "Cuidar el registro del logotipo. Entregar en cajas de 500.", due_date: "2026-10-20",
  created_at: "2026-10-14T10:00:00-06:00", priority: "normal", order_type: "interna", price: 4500, stage: "ready", print_version: 2,
  last_printed_at: "2026-10-14T11:00:00-06:00", last_printed_by: "lupita" };
const ORDENES = {
  normal: BASE,
  minima: { id: "OP-P-0651", production_number: "P-0651", client: "TALLER LÓPEZ", product_type: "Tarjetas de presentación", quantity: 1000, due_date: "2026-10-18",
    created_at: "2026-10-14T10:00:00-06:00", priority: "urgente", order_type: "interna", price: 350, stage: "ready", agent: "Manuel" },
  larga: { ...BASE, id: "OP-P-0652", production_number: "P-0652", priority: "urgente", image_url: ORIGEN + "/img-frente.png", image_url_2: ORIGEN + "/img-vuelta.png",
    pantone_front: ["Pantone 286 C", "Pantone 1235 C"], pantone_back: ["Pantone Black 6 C"],
    finishes: "Barniz Mate, Doblez, Perforado, Plastificado mate, Blocks de 50, Folio rojo, Grapado, Engomado superior, Suaje especial de corazón",
    notes: "Cuidar el registro del logotipo en la vuelta.\\nEl doblez es a la mitad, en cruz.\\nPerforado a 2 cm del borde izquierdo.\\nFolio en rojo del 0001 al 5000.\\nEmpacar en cajas de 500 con etiqueta del cliente.\\nLlamar a Eva antes de entregar (le cambian el andén).",
    distribution: ["Bodega León, Blvd. Aeropuerto 1200", "Sucursal Silao, Av. Juárez 45", "Sucursal Irapuato, Calle Hidalgo 300", "Oficina Celaya, Av. Tecnológico 12"],
    maquila_provider: "Encuadernaciones Ruiz", maquila_phone: "477 555 0101", maquila_email: "ruiz@encuadernaciones.mx" },
  enorme: { ...BASE, id: "OP-P-0658", production_number: "P-0658", priority: "urgente", image_url: ORIGEN + "/img-frente.png", image_url_2: ORIGEN + "/img-vuelta.png",
    product: "Volante tamaño carta a 4x1 tintas, con suaje especial de corazón en la esquina superior derecha.\\nLleva folio rojo consecutivo y perforado para desprender el talón.\\nEl talón lleva los datos del cliente impresos a una tinta.",
    pantone_front: ["Pantone 286 C", "Pantone 1235 C", "Pantone 485 C"], pantone_back: ["Pantone Black 6 C"],
    finishes: "Barniz Mate, Doblez, Perforado, Plastificado mate, Blocks de 50, Folio rojo, Grapado, Engomado superior, Intercalado, Suaje especial de corazón",
    notes: "Cuidar el registro del logotipo en la vuelta.\\nEl doblez es a la mitad, en cruz.\\nPerforado a 2 cm del borde izquierdo.\\nFolio en rojo del 0001 al 5000.\\nEmpacar en cajas de 500 con etiqueta del cliente.\\nLlamar a Eva antes de entregar (le cambian el andén).\\nEl suaje es el mismo de la orden P-0601: está en el anaquel 3.\\nLa prueba de color la firmó el cliente: va en el sobre.\\nNo mezclar con el pedido de la sucursal Celaya.\\nLos blocks llevan cartón de respaldo de 1 mm.\\nEl engomado es sólo en la parte de arriba.\\nSi falta papel, avisar a Lupita antes de cambiarlo.\\nEntregar primero lo de León; lo demás puede ir el viernes.\\nFacturar al entregar lo de León.",
    distribution: ["Bodega León, Blvd. Aeropuerto 1200", "Sucursal Silao, Av. Juárez 45", "Sucursal Irapuato, Calle Hidalgo 300", "Oficina Celaya, Av. Tecnológico 12",
      "Sucursal Salamanca, Av. Faja de Oro 88", "Sucursal Guanajuato, Paseo de la Presa 5", "Bodega San Francisco, Carretera a Lagos km 3", "Oficina Querétaro, Av. Constituyentes 101",
      "Sucursal San Miguel, Calle Canal 20", "Sucursal Dolores, Av. Hidalgo 7"],
    maquila_provider: "Encuadernaciones Ruiz", maquila_phone: "477 555 0101", maquila_email: "ruiz@encuadernaciones.mx" },
  cancelada: { ...BASE, id: "OP-P-0653", production_number: "P-0653", stage: "cancelled", cancelled_at: "2026-10-15T09:00:00-06:00", cancellation_reason: "El cliente ya no lo quiere", cancelled_by: "lupita" },
  maquila: { ...BASE, id: "OP-P-0654", production_number: "P-0654", order_type: "maquila", product_type: "Cajas plegadizas", maq_provider: "Suajes del Centro", maq_cost: 3000, maq_price: 5200, price: 0 },
  sinlogo: { ...BASE, id: "OP-P-0655", production_number: "P-0655", sin_empaque_sygma: true },
  tres: { ...BASE, id: "OP-P-0656", production_number: "P-0656", distribution: ["Bodega León", "Sucursal Silao", "Sucursal Irapuato"] },
  unlugar: { ...BASE, id: "OP-P-0657", production_number: "P-0657", distribution: ["Bodega León, Blvd. Aeropuerto 1200"] },
};
const ORDEN = ORDENES[CASO] || BASE;`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [printModal, setPrintModal] = useState(ORDEN);
  const user = ROL, userLogin = ({ secretaria: "lupita", admin: "marcelo", karla: "karla", produccion: "gerardo", preprensa: "noemi" })[ROL] || ROL;
  const showToast = (t, tipo) => anota("error " + t);
  return <div style={{ background: C.canvas, minHeight: "100vh", fontFamily: "'Geist',sans-serif" }}>
    <div id="barra" style={{ height: 57, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderBottom: "0.5px solid #ddd", background: C.bg }}>
      <button id="atras-abrir" onClick={() => setPrintModal(ORDEN)}>Abrir la ventana de {ORDEN.production_number}</button>
      <input id="atras-buscar" placeholder="Buscar orden..." />
    </div>
    ${montaje.replace("onClose={()=>setPrintModal(null)}", "onClose={()=>{anota(\"cerrar\");setPrintModal(null)}}")}
    <pre id="log" style={{ fontSize: 10, color: "#666", marginTop: 40 }}></pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
// las imágenes del producto (el logotipo de la app, a dos tamaños de lienzo): archivos del banco, sin firmar
const logo = path.join(RAIZ, "public", "sygma-logo.png");
fs.mkdirSync(path.join(outDir, "public"), { recursive: true });
for (const n of ["img-frente.png", "img-vuelta.png", "sygma-logo.png"]) fs.copyFileSync(logo, path.join(outDir, "public", n));
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco hoja impresa</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), publicDir: "public", plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5178), strictPort: true } });
`, "utf8");
console.log("banco de la hoja impresa listo en " + outDir);
