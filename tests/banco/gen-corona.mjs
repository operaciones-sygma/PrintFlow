// Banco del «APARTADO CORONA» (`CoronaModal`: los clientes con saldo a favor, su saldo y su historial), EXTRAÍDO de App.jsx por extraer.mjs con lo que
// usa. La critique del 16-oct. La base va simulada y cada lectura puede fallar por su lado (o sólo la primera vez).
// Se anota en #log: «db <función> <dato>», «aviso <texto>» (el showToast de App), «cerrar».
// Uso: node gen-corona.mjs <App.jsx> <dirSalida>
// Variantes por URL: rol=admin|karla|secretaria (admin) · falla=clientes|ledger (siempre) o clientes-una|ledger-una (sólo la primera) · lento=ledger (la
// segunda lectura del historial tarda 1.2 s) · caso=vacio (ningún cliente con saldo de verdad)
import fs from "node:fs";
import path from "node:path";
import { LIGA_FUENTES, copiarFuentes } from "./fuentes.mjs";
import { extraer, importacionesDeLib } from "./extraer.mjs";
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
if (!iconos) throw new Error("no encuentro la importación de los íconos");
const { codigo } = extraer(fuente, ["CoronaModal"], { simulados: ["supabase", "db"] });
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
const ROL = Q.get("rol") || "admin", FALLA = Q.get("falla") || "", LENTO = Q.get("lento") || "", CASO = Q.get("caso") || "";
const lecturas = {};
const falla = que => { lecturas[que] = (lecturas[que] || 0) + 1; return FALLA === que || (FALLA === que + "-una" && lecturas[que] === 1); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const T = s => new Date(s).toISOString();
const CLIENTES = CASO === "vacio" ? [] : [
  { id: "c1", name: "CORONA LEÓN", rfc: "CLE010101AA1", billing_mode: "anticipo", current_balance: 48250.5, pool_balance: 48250.5, is_pool_leader: true, pool_members: ["CORONA SILAO", "CORONA IRAPUATO"] },
  { id: "c2", name: "DISTRIBUIDORA DEL CENTRO", rfc: null, billing_mode: "anticipo", current_balance: -1200, pool_balance: -1200, is_pool_leader: true, pool_members: [] },
];
const LEDGER = [
  { id: "l1", tipo: "DEPOSITO", monto: 60000, balance_despues: 60000, referencia: "Depósito Banorte 1774", created_at: T("2026-10-01T10:00:00-06:00"), created_by: "lucero", periodo: "2026-10" },
  { id: "l2", tipo: "CONSUMO", monto: -11749.5, balance_despues: 48250.5, referencia: "F-188 (P-0640)", notas: "Factura Corona", created_at: T("2026-10-10T12:00:00-06:00"), created_by: "karla" },
  { id: "l3", tipo: "AJUSTE", monto: 0.01, balance_despues: 48250.51, referencia: "Redondeo", created_at: T("2026-10-11T09:00:00-06:00"), created_by: "marcelo" },
  { id: "l4", tipo: "ANTICIPO", monto: -0.01, balance_despues: 48250.5, referencia: "Anticipo aplicado", created_at: T("2026-10-12T09:00:00-06:00"), created_by: "karla" },
];
const db = {
  listAnticipoClients: async () => { await espera(60); if (falla("clientes")) throw new Error("listAnticipoClients: la base no contestó"); anota("db listAnticipoClients"); return CLIENTES.map(x => ({ ...x })); },
  loadCreditLedger: async id => { const n = (lecturas.ledgerN = (lecturas.ledgerN || 0) + 1); await espera(LENTO === "ledger" && n >= 2 ? 1200 : 60); if (falla("ledger")) throw new Error("loadCreditLedger: la base no contestó"); anota("db loadCreditLedger " + id); return id === "c1" ? LEDGER.map(x => ({ ...x })) : []; },
  creditAdjust: async a => { await espera(60); anota("db creditAdjust " + a.monto); },
};
const supabase = { rpc: async () => ({ data: null, error: null }) };`,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `function Banco() {
  const [abierto, setAbierto] = useState(true);
  const user = ROL, userLogin = ({ admin: "marcelo", karla: "karla", secretaria: "lupita" })[ROL] || ROL;
  const showToast = (t, tipo) => anota("aviso " + (tipo ? "(" + tipo + ") " : "") + t);
  return <div style={{ background: C.canvas, minHeight: "100vh", fontFamily: "'Geist',sans-serif" }}>
    <div id="barra" style={{ height: 57, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderBottom: "0.5px solid #ddd", background: C.bg }}>
      <button id="atras-abrir" onClick={() => setAbierto(true)}>Abrir Corona</button>
      <input id="atras-buscar" placeholder="Buscar orden..." />
    </div>
    {abierto && <CoronaModal user={user} userLogin={userLogin} showToast={showToast} onClose={() => { anota("cerrar"); setAbierto(false); }} />}
    <pre id="log" style={{ fontSize: 10, color: "#666", marginTop: 40 }}></pre>
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
copiarFuentes(outDir);
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco corona</title>
<link rel="icon" href="data:,">
${LIGA_FUENTES}
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({ root: path.dirname(fileURLToPath(import.meta.url)), plugins: [react()], server: { port: Number(process.env.BANCO_PORT || 5176), strictPort: true } });
`, "utf8");
console.log("banco de Corona listo en " + outDir);
