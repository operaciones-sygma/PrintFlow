// Corre TODAS las tandas «tratando de romperlo» de PrintFlow (tests/romper/*) contra el código actual y compara cada prueba con
// la última corrida en verde. Regla (Marcelo, 5-oct-2026): antes de cada subida corren todas, no sólo las nuevas, y cada bug deja
// su prueba. Lo corre el candado de git antes de subir (.githooks/pre-push); también se corre a mano: `npm run probar`.
//
// Uso: node scripts/probar.mjs [--base] [--solo partes,folio]
//   --base  si TODO pasa, guarda estos resultados como la base de la próxima comparación (en .git/probar-base.json: es local de
//           esta copia, fuera de git, y no ensucia el árbol de trabajo después de subir)
//   --solo  corre sólo esas tandas
// Sale con 1 si alguna prueba falla o una tanda no pudo correr. Cada prueba se clasifica contra la base:
//   REGRESIÓN  pasaba en la base y ahora falla     → se arregla antes de subir
//   pendiente  falla y no pasaba (o es nueva)        → es un bug encontrado: se arregla antes de subir
//   arreglada  fallaba en la base y ahora pasa
//   nueva      no estaba en la base y pasa
//
// Cada tanda arma su banco (los modales EXTRAÍDOS de src/App.jsx con la base simulada: tests/banco/*), lo sirve con vite en
// su propio puerto y lo recorre con Playwright; las tandas corren en paralelo.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TANDAS = [
  { nombre: "partes", gen: "tests/banco/gen-partes.mjs", romper: "tests/romper/partes.mjs", puerto: 5199 },
  { nombre: "folio", gen: "tests/banco/gen-folio.mjs", romper: "tests/romper/folio.mjs", puerto: 5198 },
  // sin banco: revisa el código y la base (sólo lectura) para que el contador del CTP no vuelva a inflarse (v10.81.4-6)
  { nombre: "ctp", romper: "tests/romper/ctp.mjs" },
];
const TOPE_MS = 12 * 60 * 1000;   // una tanda colgada no puede detener el candado para siempre

const args = process.argv.slice(2);
const conBase = args.includes("--base");
const iSolo = args.indexOf("--solo");
const solo = iSolo >= 0 ? (args[iSolo + 1] || "").split(",").filter(Boolean) : null;
const elegidas = TANDAS.filter(t => !solo || solo.includes(t.nombre));
if (!elegidas.length) { console.error("probar: ninguna tanda con ese nombre (" + TANDAS.map(t => t.nombre).join(", ") + ")"); process.exit(1); }

const gitDir = execFileSync("git", ["rev-parse", "--git-dir"], { cwd: RAIZ, encoding: "utf8" }).trim();
const BASE = path.resolve(RAIZ, gitDir, "probar-base.json");

function correrNode(script, argv) {
  return new Promise(resolve => {
    const hijo = spawn(process.execPath, [script, ...argv], { cwd: RAIZ });
    let salida = "";
    hijo.stdout.on("data", d => { salida += d; });
    hijo.stderr.on("data", d => { salida += d; });
    const reloj = setTimeout(() => { salida += "\n(probar: la tanda pasó de " + TOPE_MS / 60000 + " minutos y se detuvo)"; hijo.kill(); }, TOPE_MS);
    hijo.on("close", codigo => { clearTimeout(reloj); resolve({ codigo, salida }); });
  });
}

// Abre el banco en un navegador de verdad hasta que pinta (con reintentos): es la carga que dispara todo lo que vite prepara.
async function calentar(puerto) {
  const { chromium } = await import("playwright");
  let nav;
  try { nav = await chromium.launch({ headless: true }); } catch { nav = await chromium.launch({ headless: true, channel: "chrome" }); }
  try {
    for (let i = 0; i < 4; i++) {
      const p = await nav.newPage();
      try { await p.goto(`http://127.0.0.1:${puerto}/`, { timeout: 60000 }); await p.waitForSelector("button", { timeout: 20000 }); return; }
      catch { /* vite todavía preparando: otra vuelta */ }
      finally { await p.close(); }
    }
  } finally { await nav.close(); }
}

async function tanda(t) {
  if (!t.gen) {   // tanda sin banco (sin vite ni navegador): se corre tal cual
    const r = await correrNode(path.join(RAIZ, t.romper), []);
    return { t, salida: r.salida, codigo: r.codigo };
  }
  const dir = path.join(RAIZ, ".banco-" + t.nombre);
  const capturas = path.join(RAIZ, "tests", "salida", t.nombre);
  fs.rmSync(dir, { recursive: true, force: true });
  const g = await correrNode(path.join(RAIZ, t.gen), [path.join(RAIZ, "src", "App.jsx"), dir]);
  if (g.codigo !== 0) return { t, error: "el generador del banco falló:\n" + g.salida };
  let server;
  try {
    // Las dependencias se preparan TODAS al arrancar: si vite descubre una a media carga, reoptimiza y la página recibe
    // 504 «Outdated Optimize Dep» (la primera prueba de cada tanda caía por eso, no por la app).
    server = await createServer({ configFile: path.join(dir, "vite.config.mjs"), logLevel: "error", clearScreen: false,
      server: { host: "127.0.0.1", port: t.puerto, strictPort: true },
      optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-dev-runtime", "@phosphor-icons/react"] } });
    await server.listen();
    await calentar(t.puerto);
    const r = await correrNode(path.join(RAIZ, t.romper), [capturas, String(t.puerto)]);
    return { t, salida: r.salida, codigo: r.codigo };
  } catch (e) {
    return { t, error: "no se pudo servir el banco: " + (e?.message || e) };
  } finally {
    if (server) await server.close().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const inicio = performance.now();
console.log("probar: " + elegidas.map(t => t.nombre).join(" + ") + " (en paralelo)…");
const corridas = await Promise.all(elegidas.map(tanda));

let base = {};
try { base = JSON.parse(fs.readFileSync(BASE, "utf8")); } catch { /* sin base todavía: todo cuenta como nuevo */ }
const ahora = {};
const filas = { "REGRESIÓN": [], pendiente: [], arreglada: [], nueva: [] };
let pasan = 0, fallan = 0, errores = 0;
for (const c of corridas) {
  if (c.error) { errores++; console.log("\n✗ tanda «" + c.t.nombre + "»: " + c.error); continue; }
  const porPrueba = {};
  const detalle = {};
  for (const linea of c.salida.split(/\r?\n/)) {
    const m = /^(PASA|FALLA)\s+(\S+)/.exec(linea);
    if (!m) continue;
    const [, estado, id] = m;
    if (estado === "FALLA") { porPrueba[id] = "FALLA"; (detalle[id] = detalle[id] || []).push(linea.replace(/^FALLA\s+/, "")); }
    else if (!porPrueba[id]) porPrueba[id] = "PASA";
  }
  if (!Object.keys(porPrueba).length) { errores++; console.log("\n✗ tanda «" + c.t.nombre + "» no reportó pruebas:\n" + c.salida.slice(-1500)); continue; }
  ahora[c.t.nombre] = porPrueba;
  const antes = base[c.t.nombre] || {};
  for (const [id, estado] of Object.entries(porPrueba)) {
    const previo = antes[id];
    if (estado === "PASA") { pasan++; if (previo === "FALLA") filas.arreglada.push(c.t.nombre + "/" + id); else if (!previo) filas.nueva.push(c.t.nombre + "/" + id); }
    else { fallan++; (previo === "PASA" ? filas["REGRESIÓN"] : filas.pendiente).push(c.t.nombre + "/" + (detalle[id] || [id]).join(" | ")); }
  }
}

const seg = Math.round((performance.now() - inicio) / 1000);
console.log("");
for (const [clase, lista] of Object.entries(filas)) {
  if (!lista.length || clase === "nueva") continue;
  console.log(clase.toUpperCase() + " (" + lista.length + "):");
  for (const l of lista) console.log("  " + l);
}
if (filas.nueva.length) console.log("nuevas que pasan: " + filas.nueva.length);
console.log(`\nprobar: ${pasan + fallan} pruebas, ${pasan} pasan, ${fallan} fallan` + (filas["REGRESIÓN"].length ? `, ${filas["REGRESIÓN"].length} REGRESIONES` : "") + (errores ? `, ${errores} tanda(s) sin correr` : "") + ` · ${seg} s`);

if (fallan || errores) process.exit(1);
if (conBase) {
  fs.writeFileSync(BASE, JSON.stringify({ ...base, ...ahora }, null, 1));
  console.log("probar: base guardada (" + path.relative(RAIZ, BASE) + ")");
}
