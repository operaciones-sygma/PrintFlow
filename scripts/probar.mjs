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
import { leer, aRepetir, combinar, hacerSinSegunda, candados } from "./reintento.mjs";
import { rutaDelEstado, cargar, anotar, textoDePendientes } from "./inestables.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TANDAS = [
  { nombre: "partes", gen: "tests/banco/gen-partes.mjs", romper: "tests/romper/partes.mjs", puerto: 5199 },
  { nombre: "folio", gen: "tests/banco/gen-folio.mjs", romper: "tests/romper/folio.mjs", puerto: 5198 },
  { nombre: "oc", gen: "tests/banco/gen-oc.mjs", romper: "tests/romper/oc.mjs", puerto: 5195 },
  { nombre: "detalle", gen: "tests/banco/gen-detalle.mjs", romper: "tests/romper/detalle.mjs", puerto: 5196 },
  // sin banco: revisa el código y la base (sólo lectura) para que el contador del CTP no vuelva a inflarse (v10.81.4-6)
  { nombre: "ctp", romper: "tests/romper/ctp.mjs" },
  // sin banco: quién puede escribir con las RPC que no pasaban por pf_puede_escribir() (v10.84.39); cada caso se deshace
  { nombre: "permisos", romper: "tests/romper/permisos.mjs" },
  // sin banco: cómo se firman las fotos (el código vivo de App.jsx contra un Storage simulado que cuenta peticiones)
  { nombre: "firmas", romper: "tests/romper/firmas.mjs" },
  // sin banco: que las consultas grandes lleguen completas aunque el servidor conteste máximo 1,000 renglones (v10.84.61)
  { nombre: "carga", romper: "tests/romper/carga.mjs" },
  // «Archivos»: la lista y los huérfanos que decide la base (sin banco), y los botones que borran (con banco)
  { nombre: "archivos", romper: "tests/romper/archivos.mjs" },
  { nombre: "archivos-pantalla", gen: "tests/banco/gen-archivos.mjs", romper: "tests/romper/archivos-pantalla.mjs", puerto: 5197 },
  // el tablero: el Kanban de Producción, el de Germán y las fichas (v10.84.56); el banco extrae lo que necesita (extraer.mjs)
  { nombre: "tablero", gen: "tests/banco/gen-tablero.mjs", romper: "tests/romper/tablero.mjs", puerto: 5194 },
  // «En la planta» de Karla y el aviso de la OC que no se puede foliar entera: pasar a Salidas lo que ya está listo (v10.84.67)
  { nombre: "planta", gen: "tests/banco/gen-planta.mjs", romper: "tests/romper/planta.mjs", puerto: 5193 },
  // sin banco: la segunda oportunidad y sus candados (scripts/reintento.mjs e inestables.mjs, iguales en las cuatro apps; 8-oct)
  { nombre: "reintento", romper: "scripts/probar-reintento.mjs" },
  // sin banco: qué factura por adelantado se pregunta antes de asignar folio (v10.84.68: Karla, F-135 de Castores; las funciones vivas)
  { nombre: "anticipos", romper: "tests/romper/anticipos.mjs" },
  // «¿ya existe este cliente?» al capturar una orden o una OC: lo que casi seguro ya existe lo frena y dice cuál es (v10.84.69, con
  // CobranzaFlow v3.7.999m); el banco extrae la pregunta, su montaje y la lógica de las dos puertas, con la base simulada
  { nombre: "cliente", gen: "tests/banco/gen-cliente.mjs", romper: "tests/romper/cliente.mjs", puerto: 5192 },
];
// 🔑 LA SEGUNDA OPORTUNIDAD (8-oct-2026, Marcelo: «sí es una mejora, aplica la misma metodología para todos los proyectos»; la misma de
// CobranzaFlow desde el 7-oct, con sus candados: scripts/reintento.mjs). Lo que falla se repite UNA vez, y sólo eso: lo que vuelve a fallar
// frena; lo que pasa a la segunda sale INESTABLE (cuenta como que pasa, queda anotado en scripts/inestables.mjs y se revisa: la próxima
// subida no pasa con una sin revisar). Sin segunda oportunidad: las tandas de dinero (las que folian y facturan) y toda prueba de doble
// acción; más de 3 a la vez, o la misma otra vez en 14 días, frenan. Las tandas que aceptan SOLO repiten sólo sus casos que fallaron;
// las demás (cortas), completas.
const TANDAS_DE_DINERO = ["folio", "oc", "partes"];
const sinSegundaDe = tanda => hacerSinSegunda({ tandasDeDinero: TANDAS_DE_DINERO, tanda });
const TOPE_MS = 12 * 60 * 1000;   // una tanda colgada no puede detener el candado para siempre

const args = process.argv.slice(2);
const conBase = args.includes("--base");
const iSolo = args.indexOf("--solo");
const solo = iSolo >= 0 ? (args[iSolo + 1] || "").split(",").filter(Boolean) : null;
const elegidas = TANDAS.filter(t => !solo || solo.includes(t.nombre));
if (!elegidas.length) { console.error("probar: ninguna tanda con ese nombre (" + TANDAS.map(t => t.nombre).join(", ") + ")"); process.exit(1); }

const gitDir = execFileSync("git", ["rev-parse", "--git-dir"], { cwd: RAIZ, encoding: "utf8" }).trim();
const BASE = path.resolve(RAIZ, gitDir, "probar-base.json");
// Una subida no pasa con una inestable sin revisar (no tiene caso correr todo para frenar al final)
const INESTABLES = rutaDelEstado(RAIZ);
{
  const pendientes = textoDePendientes(cargar(INESTABLES));
  if (pendientes && conBase) { console.log(pendientes + "\n\nprobar: no se sube con una inestable sin revisar (no corrí nada)."); process.exit(1); }
  if (pendientes) console.log(pendientes + "\n(la próxima subida no pasa hasta revisarlas)\n");
}

// `env`: lo que la tanda recibe además (SOLO para repetir sólo unos casos; PROBAR_INTENTO 1 o 2)
function correrNode(script, argv, env = {}) {
  return new Promise(resolve => {
    const hijo = spawn(process.execPath, [script, ...argv], { cwd: RAIZ, env: { ...process.env, ...env } });
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

// `solo`: la expresión de los casos a repetir (la segunda oportunidad); las tandas que no la entienden corren completas
async function tanda(t, { solo = null, intento = 1 } = {}) {
  const env = { PROBAR_INTENTO: String(intento), ...(solo ? { SOLO: solo } : {}) };
  if (!t.gen) {   // tanda sin banco (sin vite ni navegador): se corre tal cual
    const r = await correrNode(path.join(RAIZ, t.romper), [], env);
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
    // Cada banco con SU caché de vite: con tres en paralelo compartían node_modules/.vite/deps y en Windows uno la borraba
    //   mientras otro la usaba (EPERM rmdir; la tanda «partes» no corrió el 5-oct). Queda entre corridas: arranca rápido.
    server = await createServer({ configFile: path.join(dir, "vite.config.mjs"), logLevel: "error", clearScreen: false,
      cacheDir: path.join(RAIZ, "node_modules", ".vite-banco-" + t.nombre),
      server: { host: "127.0.0.1", port: t.puerto, strictPort: true },
      optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-dev-runtime", "@phosphor-icons/react"] } });
    await server.listen();
    await calentar(t.puerto);
    const r = await correrNode(path.join(RAIZ, t.romper), [capturas, String(t.puerto)], env);
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
const corridas = await Promise.all(elegidas.map(t => tanda(t)));

// La segunda oportunidad: cada tanda repite, una vez y a la vez que las otras, sólo lo que le falló (las de dinero, nada).
// PROBAR_FINGIR_FALLA=id1,id2 hace que esas pruebas cuenten como FALLA en el primer intento (con PROBAR_FINGIR_SIEMPRE=1, también en el
// segundo): así se prueba el mecanismo de punta a punta sin romper nada.
const FINGIDAS = (process.env.PROBAR_FINGIR_FALLA || "").split(",").filter(Boolean);
const leerCorrida = (salida, intento) => {
  const l = leer(salida);
  for (const id of FINGIDAS) if (l.porPrueba[id] === "PASA" && (intento === 1 || process.env.PROBAR_FINGIR_SIEMPRE)) { l.porPrueba[id] = "FALLA"; (l.detalle[id] ||= []).push(id + "  · (falla fingida: PROBAR_FINGIR_FALLA)"); }
  return l;
};
// SOLO de los casos a repetir: por el principio de su id («tab-105», «det-41»), que es el de su `caso` aunque el renglón diga más
const prefijo = id => (/^[a-z]+-\d+[a-z]?/i.exec(id) || [id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")])[0];
const inicioSegunda = performance.now();
const repetidas = [];
await Promise.all(corridas.map(async c => {
  if (c.error) return;
  c.leida = leerCorrida(c.salida, 1);
  const ids = aRepetir(c.leida, sinSegundaDe(c.t.nombre));
  if (!ids.length) return;
  repetidas.push(c.t.nombre + ": " + ids.join(", "));
  const r = await tanda(c.t, { solo: "^(?:" + [...new Set(ids.map(prefijo))].join("|") + ")(?![0-9])", intento: 2 });
  if (!r.error) c.segunda = leerCorrida(r.salida, 2);
}));
const segSegunda = Math.round((performance.now() - inicioSegunda) / 1000);

let base = {};
try { base = JSON.parse(fs.readFileSync(BASE, "utf8")); } catch { /* sin base todavía: todo cuenta como nuevo */ }
const ahora = {};
const filas = { "REGRESIÓN": [], pendiente: [], INESTABLE: [], arreglada: [], nueva: [] };
let pasan = 0, fallan = 0, errores = 0;
// Primero se junta cada tanda con su repetición; los candados ven TODAS las inestables de la corrida a la vez (más de 3 de golpe frenan).
const juntas = [];
for (const c of corridas) {
  if (c.error) { errores++; console.log("\n✗ tanda «" + c.t.nombre + "»: " + c.error); continue; }
  if (!Object.keys(c.leida.porPrueba).length) { errores++; console.log("\n✗ tanda «" + c.t.nombre + "» no reportó pruebas:\n" + c.salida.slice(-1500)); continue; }
  juntas.push({ c, ...combinar(c.leida, c.segunda || null, sinSegundaDe(c.t.nombre)) });
}
const deEstaCorrida = juntas.flatMap(j => j.inestables.map(id => ({ clave: j.c.t.nombre + "/" + id, linea: (j.c.leida.detalle[id] || [id]).join(" | ") })));
const k = candados({ inestables: deEstaCorrida, historial: cargar(INESTABLES).entradas });
for (const { c, porPrueba, detalle, inestables } of juntas) {
  for (const id of inestables) {
    const clave = c.t.nombre + "/" + id;
    if (k.frenan.has(clave)) {   // pasó a la segunda, pero un candado no lo acepta: cuenta como que falla
      porPrueba[id] = "FALLA";
      detalle[id] = [...(c.leida.detalle[id] || [id]), k.repetidas.some(r => r.clave === clave) ? "(pasó a la segunda, pero ya había salido inestable hace poco: no es suerte)" : "(pasó a la segunda, pero salieron más de 3 a la vez: no es suerte)"];
    } else filas.INESTABLE.push(c.t.nombre + "/" + (c.leida.detalle[id] || [id]).join(" | "));
  }
  ahora[c.t.nombre] = porPrueba;
  const antes = base[c.t.nombre] || {};
  for (const [id, estado] of Object.entries(porPrueba)) {
    const previo = antes[id];
    if (estado === "PASA") { pasan++; if (previo === "FALLA") filas.arreglada.push(c.t.nombre + "/" + id); else if (!previo) filas.nueva.push(c.t.nombre + "/" + id); }
    else { fallan++; (previo === "PASA" ? filas["REGRESIÓN"] : filas.pendiente).push(c.t.nombre + "/" + (detalle[id] || [id]).join(" | ")); }
  }
}

if (deEstaCorrida.length) {
  // todas quedan pendientes de revisar (también las que frenaron: algo pasó y hay que saber qué)
  try { anotar(INESTABLES, deEstaCorrida.map(x => ({ ...x, deGolpe: k.deGolpe, repetida: k.repetidas.some(r => r.clave === x.clave) }))); }
  catch (e) { console.log("(no se pudo anotar en la bitácora de inestables: " + (e?.message || e) + ")"); }
}

const seg = Math.round((performance.now() - inicio) / 1000);
console.log("");
if (repetidas.length) console.log(`segunda oportunidad (${segSegunda} s) — se repitió sólo lo que falló:\n  ${repetidas.join("\n  ")}\n`);
if (k.motivos.length) console.log(`CANDADOS DE LA SEGUNDA OPORTUNIDAD — no se acepta lo que pasó a la segunda:\n  ${k.motivos.join("\n  ")}\n`);
for (const [clase, lista] of Object.entries(filas)) {
  if (!lista.length || clase === "nueva") continue;
  console.log(clase === "INESTABLE"
    ? `INESTABLE (${lista.length}) — falló y a la segunda pasó: se sube, queda anotada y se revisa en este mismo trabajo (la prueba, o un choque por tiempos de la app); la próxima subida no pasa hasta marcarla (node scripts/inestables.mjs):`
    : clase.toUpperCase() + " (" + lista.length + "):");
  for (const l of lista) console.log("  " + l);
}
if (filas.nueva.length) console.log("nuevas que pasan: " + filas.nueva.length);
console.log(`\nprobar: ${pasan + fallan} pruebas, ${pasan} pasan, ${fallan} fallan` + (filas.INESTABLE.length ? ` (${filas.INESTABLE.length} pasaron a la segunda)` : "") + (filas["REGRESIÓN"].length ? `, ${filas["REGRESIÓN"].length} REGRESIONES` : "") + (errores ? `, ${errores} tanda(s) sin correr` : "") + ` · ${seg} s`);

if (fallan || errores) process.exit(1);
if (conBase) {
  fs.writeFileSync(BASE, JSON.stringify({ ...base, ...ahora }, null, 1));
  console.log("probar: base guardada (" + path.relative(RAIZ, BASE) + ")");
}
