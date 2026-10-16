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
// Cada tanda arma su banco (los modales EXTRAÍDOS de src/App.jsx con la base simulada: tests/banco/*), lo sirve en su propio puerto
// (desde el 15-oct, ARMADO de antemano: scripts/servir-banco.mjs; PROBAR_BANCO=dev, con el servidor de desarrollo de Vite como antes) y lo recorre
// con Playwright; las tandas corren en paralelo.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { servirBanco } from "./servir-banco.mjs";   // 15-oct: el banco ARMADO de antemano (7 veces menos conexiones por página)
import { leer, aRepetir, combinar, hacerSinSegunda, candados } from "./reintento.mjs";
import { rutaDelEstado, cargar, anotar, textoDePendientes } from "./inestables.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TANDAS = [
  { nombre: "partes", gen: "tests/banco/gen-partes.mjs", romper: "tests/romper/partes.mjs", puerto: 5199 },
  { nombre: "folio", gen: "tests/banco/gen-folio.mjs", romper: "tests/romper/folio.mjs", puerto: 5198 },
  { nombre: "oc", gen: "tests/banco/gen-oc.mjs", romper: "tests/romper/oc.mjs", puerto: 5195 },
  // el plan matriz de la OC (N facturas × M órdenes, con porciones) y ligar en él las facturas que ya existen (v10.84.89: Karla, F-143 y
  //   F-155 de OC-0960); el banco extrae la ventana, su vista y la de cancelar con extraer.mjs, con la base simulada
  { nombre: "plan", gen: "tests/banco/gen-plan.mjs", romper: "tests/romper/plan.mjs", puerto: 5190 },
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
  // Analytics: cada cifra con su periodo y su base, un solo ingreso (lo entregado, por su fecha de entrega), la tendencia que dibuja (v10.84.84);
  //   el reloj del navegador va fijo en el 13-oct-2026 con la hora de México
  { nombre: "analytics", gen: "tests/banco/gen-analytics.mjs", romper: "tests/romper/analytics.mjs", puerto: 5191 },
  // sin banco: los chips de «Mis Pendientes» (ninguno que nunca pueda contar) y las guías de las fichas (v10.84.88)
  { nombre: "chips", romper: "tests/romper/chips.mjs" },
  // el tablero: el Kanban de Producción, el de Germán y las fichas (v10.84.56); el banco extrae lo que necesita (extraer.mjs)
  { nombre: "tablero", gen: "tests/banco/gen-tablero.mjs", romper: "tests/romper/tablero.mjs", puerto: 5194 },
  // «En la planta» de Karla y el aviso de la OC que no se puede foliar entera: pasar a Salidas lo que ya está listo (v10.84.67)
  { nombre: "planta", gen: "tests/banco/gen-planta.mjs", romper: "tests/romper/planta.mjs", puerto: 5193 },
  // sin banco: la segunda oportunidad y sus candados (scripts/reintento.mjs e inestables.mjs, iguales en las cuatro apps; 8-oct)
  { nombre: "reintento", romper: "scripts/probar-reintento.mjs" },
  // sin banco: el candado prueba lo que se sube, no la carpeta (15-oct, como CobranzaFlow v3.7.1009): el gancho de verdad en un repo temporal
  { nombre: "candado", romper: "tests/romper/candado.mjs" },
  // sin banco: qué factura por adelantado se pregunta antes de asignar folio (v10.84.68: Karla, F-135 de Castores; las funciones vivas)
  { nombre: "anticipos", romper: "tests/romper/anticipos.mjs" },
  // sin banco: la categoría del trabajo (v10.84.91): las reglas de src/lib/categorias.js con ejemplos de verdad y, contra la base (sólo
  // lectura, necesita SUPABASE_ACCESS_TOKEN), que la función generada diga lo mismo para todos los nombres, el CHECK, la historia y el
  // permiso de la app para escribirla
  { nombre: "categorias", romper: "tests/romper/categorias.mjs" },
  // sin banco: las piezas de una factura que ya existe, propuestas desde su CFDI (v10.84.102): src/lib/proponerPiezas.js con los conceptos de verdad
  { nombre: "proponer", romper: "tests/romper/proponer.mjs" },
  // sin banco: «Corregir precio» contra la base (v10.84.112, Karla y P-0600): src/lib/corregirPrecio.js con una base de mentira (la que falla, la
  // que filtra el renglón sin error, la orden que cambió mientras se corregía) y la regla de quién corrige y las palabras, sacadas de App.jsx
  { nombre: "corregir", romper: "tests/romper/corregir.mjs" },
  // sin banco: «Cancelaciones» cancela cada orden completa, como el detalle (v10.84.113, P-0629): src/lib/cancelarEnLote.js con una base de mentira
  //   (la fila de la máquina antes de la RPC, el historial, el comentario, los avisos; el rechazo regresa la orden a su lugar)
  { nombre: "cancelaciones", romper: "tests/romper/cancelaciones.mjs" },
  // «¿ya existe este cliente?» al capturar una orden o una OC: lo que casi seguro ya existe lo frena y dice cuál es (v10.84.69, con
  // CobranzaFlow v3.7.999m); el banco extrae la pregunta, su montaje y la lógica de las dos puertas, con la base simulada
  { nombre: "cliente", gen: "tests/banco/gen-cliente.mjs", romper: "tests/romper/cliente.mjs", puerto: 5192 },
  // la sesión: entrar, abrir con la sesión guardada, «Salir» y la que se cierra sola (v10.84.71; lo de CobranzaFlow v3.7.999f/o). Sin
  // banco: la tanda compila la app REAL contra una Supabase de mentira y simula Auth y la base en el navegador (nada sale a producción)
  { nombre: "sesion", romper: "tests/romper/sesion.mjs" },
  // las puertas de cancelar: la orden, la orden con folio, una parte y el plan matriz (v10.84.73, la critique de la noche del 12-oct);
  // el banco extrae las cuatro ventanas con extraer.mjs y simula lo que hace App al confirmar
  { nombre: "cancelar", gen: "tests/banco/gen-cancelar.mjs", romper: "tests/romper/cancelar.mjs", puerto: 5187 },
  // la forma de la orden, crear y editar (v10.84.77, la critique independiente del 12-oct): el banco extrae OrderForm y COPIA de
  // App.jsx lo que hace al guardar (create, update), con la base simulada
  { nombre: "orden", gen: "tests/banco/gen-orden.mjs", romper: "tests/romper/orden.mjs", puerto: 5188, env: { ORDEN_PARTE: "1" } },
  // v10.84.81 — la misma forma, partida en dos: con la tercera revisión `orden` pasó de 153 a 205 casos y no cabía con holgura en los
  //   12 minutos de una tanda. `orden` corre los de antes (ord-01 a ord-228, igual que en la base guardada) y `orden-2` desde ord-229.
  { nombre: "orden-2", gen: "tests/banco/gen-orden.mjs", romper: "tests/romper/orden.mjs", puerto: 5189, env: { ORDEN_PARTE: "2" } },
  // las reglas de los hooks de React en App.jsx, leídas del código (v10.84.80: tres hooks de App después de sus «return» tempranos
  // tumbaban la app al entrar, «React error #310», y ningún banco lo veía: montan los componentes sin esos «return»)
  { nombre: "hooks", romper: "tests/romper/hooks.mjs" },
  // v10.84.119 — «Planta»: el acomodo de las máquinas en el plano (la geometría con Node y la pantalla en su banco, con la tabla de versiones en memoria)
  { nombre: "plano", gen: "tests/banco/gen-plano.mjs", romper: "tests/romper/plano.mjs", puerto: 5186 },
  // v10.84.122 — «Entregas» (el calendario y su ventana de cambiar la fecha), con el reloj fijo
  { nombre: "entregas", gen: "tests/banco/gen-entregas.mjs", romper: "tests/romper/entregas.mjs", puerto: 5185 },
  // v10.84.123 — «Datos Pendientes» (Lupita y Karla) y «Salud Operativa» (Dirección), con el reloj fijo y la línea de App que la monta
  { nombre: "salud", gen: "tests/banco/gen-salud.mjs", romper: "tests/romper/salud.mjs", puerto: 5184 },
  // v10.84.124 — el «Dashboard» (la vista con la que abren casi todos: el resumen de 7 días, el flujo por etapas y la maquila), con el reloj fijo
  { nombre: "dashboard", gen: "tests/banco/gen-dashboard.mjs", romper: "tests/romper/dashboard.mjs", puerto: 5183 },
  // v10.84.125 — «Todas» (la lista de todas las órdenes) con 1002 órdenes como en producción: de 40 en 40, las activas primero, el filtro por estado
  { nombre: "todas", gen: "tests/banco/gen-todas.mjs", romper: "tests/romper/todas.mjs", puerto: 5182 },
  // v10.84.126 — la Torre de Control (Dirección): lo detenido es trabajo parado; los datos por capturar, aparte
  { nombre: "torre", gen: "tests/banco/gen-torre.mjs", romper: "tests/romper/torre.mjs", puerto: 5181 },
  // v10.84.127 — los avisos (la campana y su bandeja), con la base de los avisos simulada como la de cada versión (la que falla al leer, marcar o borrar)
  { nombre: "avisos", gen: "tests/banco/gen-avisos.mjs", romper: "tests/romper/avisos.mjs", puerto: 5180 },
  // v10.84.128 — el Despertador (la ventana del día), con lo de App que lo arma y lo confirma; la primera lectura que falla, con el reloj fijo
  { nombre: "despertador", gen: "tests/banco/gen-despertador.mjs", romper: "tests/romper/despertador.mjs", puerto: 5179 },
];
// 🔑 LA SEGUNDA OPORTUNIDAD (8-oct-2026, Marcelo: «sí es una mejora, aplica la misma metodología para todos los proyectos»; la misma de
// CobranzaFlow desde el 7-oct, con sus candados: scripts/reintento.mjs). Lo que falla se repite UNA vez, y sólo eso: lo que vuelve a fallar
// frena; lo que pasa a la segunda sale INESTABLE (cuenta como que pasa, queda anotado en scripts/inestables.mjs y se revisa: la próxima
// subida no pasa con una sin revisar). Sin segunda oportunidad: las tandas de dinero (las que folian y facturan) y toda prueba de doble
// acción; más de 3 a la vez, o la misma otra vez en 14 días, frenan. Las tandas que aceptan SOLO repiten sólo sus casos que fallaron;
// las demás (cortas), completas.
const TANDAS_DE_DINERO = ["folio", "oc", "plan", "partes", "cancelar", "orden", "orden-2", "corregir", "cancelaciones"];   // cancelar mueve facturas y saldos; orden, el precio de una facturada; corregir, el de una por facturar: sin segunda oportunidad
const sinSegundaDe = tanda => hacerSinSegunda({ tandasDeDinero: TANDAS_DE_DINERO, tanda });
const TOPE_MS = 12 * 60 * 1000;   // una tanda colgada no puede detener el candado para siempre

const args = process.argv.slice(2);
const conBase = args.includes("--base");
const iSolo = args.indexOf("--solo");
const solo = iSolo >= 0 ? (args[iSolo + 1] || "").split(",").filter(Boolean) : null;
const elegidas = TANDAS.filter(t => !solo || solo.includes(t.nombre));
if (!elegidas.length) { console.error("probar: ninguna tanda con ese nombre (" + TANDAS.map(t => t.nombre).join(", ") + ")"); process.exit(1); }

const gitDir = execFileSync("git", ["rev-parse", "--git-dir"], { cwd: RAIZ, encoding: "utf8" }).trim();
// 15-oct-2026 (lo mismo que CobranzaFlow v3.7.1009) — el candado prueba la CARPETA, y la carpeta tiene que ser lo que se sube: el gancho no arranca
//   con cambios sin commit, y con --base la huella de la carpeta (HEAD y lo que no tiene commit en lo que se prueba) se toma al empezar; si cambia
//   durante la corrida (un commit o un archivo editado), lo que se probó no es lo que se sube: no se guarda la base y frena.
const CARPETAS_DEL_CANDADO = ["src", "scripts", "tests", "index.html", "package.json", "package-lock.json", "vite.config.js", ".githooks"];
const huellaDeLaCarpeta = () => {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: RAIZ, encoding: "utf8" }).trim() + "\n"
    + execFileSync("git", ["status", "--porcelain", "--", ...CARPETAS_DEL_CANDADO], { cwd: RAIZ, encoding: "utf8" }).trim(); }
  catch (e) { return "(no se pudo leer: " + (e?.message || e) + ")"; }
};
const huellaAlEmpezar = conBase ? huellaDeLaCarpeta() : null;
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
  const env = { PROBAR_INTENTO: String(intento), ...(t.env || {}), ...(solo ? { SOLO: solo } : {}) };   // v10.84.81: `env` de la tanda (ORDEN_PARTE)
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
    // (15-oct) armado de antemano y servido estático: ver scripts/servir-banco.mjs (lo de las dependencias y la caché de cada banco vive ahí, para
    //   PROBAR_BANCO=dev). La primera carga ya no tarda: calentar sólo confirma que el banco pinta.
    server = await servirBanco({ dir, puerto: t.puerto, raiz: RAIZ, nombre: t.nombre });
    await calentar(t.puerto);
    const r = await correrNode(path.join(RAIZ, t.romper), [capturas, String(t.puerto)], env);
    return { t, salida: r.salida, codigo: r.codigo };
  } catch (e) {
    return { t, error: "no se pudo servir el banco: " + (e?.message || e) };
  } finally {
    if (server) await server.cerrar().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const inicio = performance.now();
// v10.84.81 — las tandas CON banco (vite + navegador) van de a lo más PARALELO a la vez (PROBAR_PARALELO, 7): con 11 juntas Windows se
//   quedaba sin puertos (net::ERR_NO_BUFFER_SPACE: cada caso abre una página que le pide 10-20 archivos al banco) y el candado frenó dos
//   veces seguidas el 12-oct por pruebas que no habían fallado (folio/inv-58 y detalle/det-134, las dos sin segunda oportunidad). Con 10
//   todavía pasaba, sin holgura. Empiezan las más largas (minutos aproximados), para que la última no arranque tarde; las que no tienen
//   banco corren todas de una vez. El tope de 12 minutos sigue siendo por tanda, desde que ésa empieza.
const PARALELO = Math.max(1, Number(process.env.PROBAR_PARALELO || 7));
const MINUTOS = { orden: 7, folio: 6, cancelar: 6, detalle: 6, tablero: 5, oc: 4, partes: 4, plan: 3, "orden-2": 3, planta: 3, plano: 3, cliente: 2, "archivos-pantalla": 2, analytics: 2 };
async function deATope(lista, n, fn) {
  const res = new Array(lista.length);
  const cola = lista.map((t, k) => k).sort((a, b) => (MINUTOS[lista[b].nombre] || 1) - (MINUTOS[lista[a].nombre] || 1));
  await Promise.all(Array.from({ length: Math.min(n, cola.length) }, async () => { while (cola.length) { const k = cola.shift(); res[k] = await fn(lista[k]); } }));
  return res;
}
const conBanco = elegidas.filter(t => t.gen), sinBanco = elegidas.filter(t => !t.gen);
console.log("probar: " + elegidas.map(t => t.nombre).join(" + ") + " (en paralelo; las " + conBanco.length + " con banco, de a " + PARALELO + ")…");
const [deBanco, deLasOtras] = await Promise.all([deATope(conBanco, PARALELO, t => tanda(t)), Promise.all(sinBanco.map(t => tanda(t)))]);
const corridas = elegidas.map(t => t.gen ? deBanco[conBanco.indexOf(t)] : deLasOtras[sinBanco.indexOf(t)]);

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
if (conBase && huellaDeLaCarpeta() !== huellaAlEmpezar) {
  console.log("probar: la carpeta cambió durante la corrida (un commit o un archivo editado): lo que se probó no es lo que se sube. No se guarda la base; vuelve a subir.");
  process.exit(1);
}
if (conBase) {
  fs.writeFileSync(BASE, JSON.stringify({ ...base, ...ahora }, null, 1));
  console.log("probar: base guardada (" + path.relative(RAIZ, BASE) + ")");
}
