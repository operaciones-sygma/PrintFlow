// Tanda «carga»: que la app traiga TODAS las filas aunque PostgREST conteste como máximo 1,000 por consulta (v10.84.61).
// El hallazgo (7-oct, P-0540 «10d estancada» un día después de llegar a Salidas): esta Supabase corta en 1,000 renglones EN
// SILENCIO aunque se le pida .limit(5000) (medido: order_timeline «0-999/9053», order_machine_log «0-999/2245»). Con el archivo
// completo cargado, cada recarga traía la bitácora de las 951 órdenes en una consulta: se cortaba en mayo y las órdenes recientes
// se quedaban sin bitácora y sin reloj de máquina. Y la lista de órdenes (951 hoy, ~200 al mes) se iba a empezar a cortar.
// Se prueba el código VIVO: `todasLasFilas` se recorta de src/App.jsx y se corre en Node contra una base simulada con tope; y se
// revisa que las consultas que se cortaban la usen.
// Uso: node tests/romper/carga.mjs   (lo corre scripts/probar.mjs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP = fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8").replace(/\r\n/g, "\n");
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
const fin = () => { for (const r of res) console.log(r); };

const ini = APP.indexOf("async function todasLasFilas(");
if (ini < 0) { ok("carga-00-existe", false, "no hay todasLasFilas en src/App.jsx: las consultas grandes se cortan en 1,000"); fin(); process.exit(0); }
const CODIGO = APP.slice(ini, APP.indexOf("\n}\n", ini) + 2);
const todasLasFilas = new Function(CODIGO + "\nreturn todasLasFilas;")();

// una tabla simulada de n renglones que contesta como PostgREST con su «max rows» (`tope`); `fallaEn`: la petición que falla
function tabla(n, { tope = 1000, fallaEn = -1 } = {}) {
  const filas = Array.from({ length: n }, (_, i) => ({ id: i })), pedidas = [];
  return { pedidas, armar: () => ({ range: async (a, b) => {
    pedidas.push([a, b]);
    if (pedidas.length - 1 === fallaEn) return { data: null, error: { message: "503 Service Unavailable" } };
    return { data: filas.slice(a, Math.min(b + 1, a + tope, n)), error: null };
  } }) };
}
const completo = (data, n) => Array.isArray(data) && data.length === n && data.every((f, i) => f.id === i);

{ const t = tabla(9053); const r = await todasLasFilas(t.armar);
  ok("carga-01-la-bitacora-entera", completo(r.data, 9053) && !r.error, `9,053 renglones con tope de 1,000: llegaron ${r.data?.length ?? "ninguno"} en ${t.pedidas.length} peticiones`); }
{ const t = tabla(1000); const r = await todasLasFilas(t.armar);
  ok("carga-02-justo-mil", completo(r.data, 1000), `exactamente 1,000: llegaron ${r.data?.length ?? "ninguno"} en ${t.pedidas.length} peticiones`); }
{ const t = tabla(0); const r = await todasLasFilas(t.armar);
  ok("carga-03-tabla-vacia", Array.isArray(r.data) && r.data.length === 0 && !r.error && t.pedidas.length === 1, `tabla vacía: ${JSON.stringify(r.data)} en ${t.pedidas.length} petición(es)`); }
{ const t = tabla(2245, { tope: 500 }); const r = await todasLasFilas(t.armar);
  ok("carga-04-si-el-tope-del-servidor-baja", completo(r.data, 2245), `2,245 con un tope de 500 (si alguien baja el «max rows»): llegaron ${r.data?.length ?? "ninguno"}`); }
{ const t = tabla(9053, { fallaEn: 3 }); const r = await todasLasFilas(t.armar);
  ok("carga-05-una-pagina-falla", r.data === null && !!r.error, `la 4ª página falla: ${r.data === null ? "devuelve el error y NADA de datos" : "DEVUELVE " + r.data.length + " filas a medias como si fueran todas"}`); }

// las consultas que se cortaban, con todasLasFilas (y sin un .limit que no sirve)
// (sin comentarios: el «.limit(5000)» que ya no se usa sigue nombrado en los comentarios que explican por qué)
const sinComentarios = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const tramo = (desde, hasta) => { const i = APP.indexOf(desde); return i < 0 ? "" : sinComentarios(APP.slice(i, APP.indexOf(hasta, i + desde.length))); };
const cargaOrdenes = tramo("async loadOrders(", "async saveOrder(");
ok("carga-06-las-ordenes-y-su-bitacora", /todasLasFilas\(/.test(cargaOrdenes) && !/\.limit\(5000\)/.test(cargaOrdenes) && (cargaOrdenes.match(/todasLasFilas\(/g) || []).length >= 2,
  "loadOrders: " + ((cargaOrdenes.match(/todasLasFilas\(/g) || []).length) + " consultas con todasLasFilas" + (/\.limit\(5000\)/.test(cargaOrdenes) ? "; todavía usa .limit(5000)" : ""));
const cargaOCs = tramo("async loadPurchaseOrders(", "\n  },");
ok("carga-07-las-ocs", /todasLasFilas\(/.test(cargaOCs), "loadPurchaseOrders " + (/todasLasFilas\(/.test(cargaOCs) ? "pide por páginas" : "pide de una vez (639 OCs hoy; al pasar de 1,000 se cortan)"));
const recarga = tramo("const reloadCore = ", "const reloadInFlightRef");
ok("carga-08-partes-y-matriz", !/\.limit\(5000\)/.test(recarga) && (recarga.match(/todasLasFilas\(/g) || []).length >= 3, "partes y plan matriz: " + ((recarga.match(/todasLasFilas\(/g) || []).length) + " con todasLasFilas" + (/\.limit\(5000\)/.test(recarga) ? "; todavía con .limit(5000)" : ""));
// la recarga trae sólo lo de las órdenes activas (y conserva lo que ya se tenía de las terminadas): con el archivo completo
//   cargado, traer TODO en cada recarga eran ~11,000 renglones cada vez que alguien movía algo
ok("carga-09-la-recarga-trae-solo-lo-activo", /db\.loadOrders\(true\)/.test(recarga) && !/db\.loadOrders\(!archiveLoadedRef\.current\)/.test(recarga),
  /db\.loadOrders\(!archiveLoadedRef\.current\)/.test(recarga) ? "con el archivo cargado, cada recarga trae TODO" : "la recarga trae lo activo");
fin();
