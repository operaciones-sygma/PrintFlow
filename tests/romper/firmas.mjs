// Tanda «firmas»: cómo firma la app las fotos de las órdenes (firmarOrderFile en src/App.jsx), contra un Storage simulado
// que cuenta las peticiones. El hallazgo (recorrido del 5-oct): «Todas» firmaba UNA petición por foto al abrir, ~570 POST
// a Storage cada vez y en todos los roles (7-15 s), y el caché de 300 firmas era más chico que las 568 fotos.
// Se prueba el código VIVO: se recorta de src/App.jsx (desde pathDeOrderFile hasta useSignedFile) y se corre en Node.
// Uso: node tests/romper/firmas.mjs   (lo corre scripts/probar.mjs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP = fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8");
const DESDE = "const pathDeOrderFile=", HASTA = "function useSignedFile(";
const ini = APP.indexOf(DESDE), fin = APP.indexOf(HASTA);
if (ini < 0 || fin < ini) { console.log("FALLA firmas-codigo  no encontré el bloque de firmas en src/App.jsx (entre pathDeOrderFile y useSignedFile)"); process.exit(1); }
const CODIGO = APP.slice(ini, fin);

const BASE = "https://uvhardaeooaxjrrgdjwa.supabase.co/storage/v1/object/public/order-files/";
const url = p => BASE + encodeURI(p);
const espera = (ms = 5) => new Promise(r => setTimeout(r, ms));

// Un Storage simulado. `faltan`: rutas que no existen. `cae`: la red se cae (las dos formas de firmar lanzan).
// `desordena`: el lote contesta en otro orden.
function storage({ faltan = new Set(), cae = false, desordena = false } = {}) {
  const n = { uno: 0, lote: 0, tamanos: [], conOpciones: 0 };
  const supabase = { storage: { from: () => ({
    createSignedUrl: async (p, exp, opts) => {
      n.uno++; if (opts) n.conOpciones++; await espera();
      if (cae) throw new Error("red caída");
      if (faltan.has(p)) return { data: null, error: { message: "Object not found" } };
      return { data: { signedUrl: `https://firmado.test/${p}?uno${opts ? "&descarga" : ""}` }, error: null };
    },
    createSignedUrls: async (ps, exp) => {
      n.lote++; n.tamanos.push(ps.length); await espera();
      if (cae) throw new Error("red caída");
      let data = ps.map(p => faltan.has(p) ? { path: p, error: "Object not found", signedUrl: null } : { path: p, error: null, signedUrl: `https://firmado.test/${p}?lote` });
      if (desordena) data = data.reverse();
      return { data, error: null };
    },
  }) } };
  return { n, supabase, peticiones: () => n.uno + n.lote };
}

// Cada caso carga el código de nuevo: el caché y la cola son de módulo y no deben pasar de un caso a otro.
const cargar = supabase => new Function("supabase", CODIGO + "\nreturn { firmarOrderFile, FIRMAS_CACHE };")(supabase);
const firmadaDe = (u, p) => typeof u === "string" && u.startsWith("https://firmado.test/" + p + "?");

const casos = [];
const caso = (id, fn) => casos.push({ id, fn });

caso("firmas-una-pantalla-pocas-peticiones", async () => {
  const s = storage(); const { firmarOrderFile } = cargar(s.supabase);
  const rutas = Array.from({ length: 250 }, (_, i) => `ord-${i}/foto-${i}.jpg`);
  const res = await Promise.all(rutas.map(p => firmarOrderFile(url(p))));
  const bien = res.every((u, i) => firmadaDe(u, rutas[i]));
  return [s.peticiones() <= 3 && bien, `250 fotos en la misma pintura: ${s.peticiones()} peticiones a Storage (máximo 3); cada foto con SU firma: ${bien ? "sí" : "NO"}`];
});
caso("firmas-lotes-de-100", async () => {
  const s = storage(); const { firmarOrderFile } = cargar(s.supabase);
  await Promise.all(Array.from({ length: 250 }, (_, i) => firmarOrderFile(url(`o-${i}/f.png`))));
  return [s.n.lote > 0 && s.n.tamanos.every(t => t <= 100), `tamaños de lote: [${s.n.tamanos.join(", ")}] (ninguno de más de 100)`];
});
caso("firmas-misma-foto-una-sola-vez", async () => {
  const s = storage(); const { firmarOrderFile } = cargar(s.supabase);
  const [a, b] = await Promise.all([firmarOrderFile(url("x/misma.jpg")), firmarOrderFile(url("x/misma.jpg"))]);
  const rutasPedidas = s.n.uno + s.n.tamanos.reduce((x, y) => x + y, 0);
  return [rutasPedidas === 1 && a === b && firmadaDe(a, "x/misma.jpg"), `dos tarjetas con la misma foto: se pidió firmar ${rutasPedidas} vez/veces (debe ser 1) y comparten la firma: ${a === b ? "sí" : "NO"}`];
});
caso("firmas-todas-cabe-en-el-cache", async () => {
  const s = storage(); const { firmarOrderFile } = cargar(s.supabase);
  const rutas = Array.from({ length: 600 }, (_, i) => `t-${i}/f.jpg`);   // «Todas» enseña ~570
  await Promise.all(rutas.map(p => firmarOrderFile(url(p))));
  const antes = s.peticiones();
  await Promise.all(rutas.map(p => firmarOrderFile(url(p))));          // volver a abrir «Todas» al minuto
  const otra = s.peticiones() - antes;
  return [otra === 0, `volver a abrir «Todas» (600 fotos) dentro de los 5 minutos: ${otra} peticiones nuevas (deben ser 0)`];
});
caso("firmas-archivo-que-no-existe", async () => {
  const s = storage({ faltan: new Set(["no/existe.jpg"]) }); const { firmarOrderFile, FIRMAS_CACHE } = cargar(s.supabase);
  const [u, v] = await Promise.all([firmarOrderFile(url("no/existe.jpg")), firmarOrderFile(url("si/existe.jpg"))]);
  const guardada = [...FIRMAS_CACHE.keys()].some(k => k.startsWith("no/existe.jpg"));
  return [u === url("no/existe.jpg") && firmadaDe(v, "si/existe.jpg") && !guardada,
    `el que no existe regresa su URL de siempre (${u === url("no/existe.jpg") ? "sí" : "NO"}), el de al lado se firma (${firmadaDe(v, "si/existe.jpg") ? "sí" : "NO"}), y la falla no se guarda (${guardada ? "SE GUARDÓ" : "no"})`];
});
caso("firmas-red-caida", async () => {
  const s = storage({ cae: true }); const { firmarOrderFile, FIRMAS_CACHE } = cargar(s.supabase);
  const rutas = ["a/1.jpg", "b/2.jpg", "c/3.jpg"];
  const res = await Promise.all(rutas.map(p => firmarOrderFile(url(p))));
  const todasOriginal = res.every((u, i) => u === url(rutas[i]));
  const antes = s.peticiones();
  await firmarOrderFile(url("a/1.jpg"));                                // al reintentar, vuelve a pedir
  return [todasOriginal && FIRMAS_CACHE.size === 0 && s.peticiones() > antes,
    `con la red caída cada foto regresa su URL (${todasOriginal ? "sí" : "NO"}), nada se guarda (${FIRMAS_CACHE.size}) y el reintento sí vuelve a pedir (${s.peticiones() > antes ? "sí" : "NO"})`];
});
caso("firmas-lote-desordenado", async () => {
  const s = storage({ desordena: true }); const { firmarOrderFile } = cargar(s.supabase);
  const rutas = Array.from({ length: 30 }, (_, i) => `d-${i}/f.jpg`);
  const res = await Promise.all(rutas.map(p => firmarOrderFile(url(p))));
  const bien = res.every((u, i) => firmadaDe(u, rutas[i]));
  return [bien, `si Storage contesta en otro orden, cada foto recibe la suya: ${bien ? "sí" : "NO"}`];
});
caso("firmas-nombres-con-espacios-y-acentos", async () => {
  const s = storage(); const { firmarOrderFile } = cargar(s.supabase);
  const rutas = ["new-img-1/Logo Niño final.png", "OP-1/Diseño (2).pdf"];
  const res = await Promise.all(rutas.map(p => firmarOrderFile(url(p))));
  const bien = res.every((u, i) => firmadaDe(u, rutas[i]));
  return [bien, `rutas con espacios, acentos y paréntesis reciben su firma: ${bien ? "sí" : "NO"}`];
});
caso("firmas-descarga-va-sola", async () => {
  const s = storage(); const { firmarOrderFile } = cargar(s.supabase);
  const u = await firmarOrderFile(url("OP-2/arte.pdf"), { download: "arte.pdf" });
  return [s.n.conOpciones === 1 && /descarga/.test(u || ""), `la descarga se firma con su nombre de archivo, aparte: ${s.n.conOpciones === 1 ? "sí" : "NO"}`];
});
caso("firmas-url-de-afuera-no-se-toca", async () => {
  const s = storage(); const { firmarOrderFile } = cargar(s.supabase);
  const ext = "https://ejemplo.com/logo.png";
  const u = await firmarOrderFile(ext);
  return [u === ext && s.peticiones() === 0, `una URL que no es del bucket regresa igual y sin pedir nada (${s.peticiones()} peticiones)`];
});

let mal = 0;
for (const c of casos) {
  let ok = false, dice = "";
  try { [ok, dice] = await c.fn(); } catch (e) { dice = "la prueba se cayó: " + e.message; }
  if (!ok) mal++;
  console.log((ok ? "PASA " : "FALLA") + " " + c.id + "  " + dice);
}
process.exitCode = mal ? 1 : 0;
