// Tratar de ROMPER la contraseña de sitio de PrintFlow (middleware.js, v10.84.162), sin navegador: el middleware de Vercel se importa
// y se le dan peticiones de mentira. Marcelo, 19-oct-2026: «quiero que el acceso a todas las apps sea igual como en cobranzaflow» (la
// contraseña de sitio del navegador antes de la pantalla de entrar, LA MISMA en todas). Hasta v10.84.161 produccion.sygma.mx abría
// directo en su pantalla de entrar; CobranzaFlow, Almacén, Contabilidad y Central ya la pedían. Cada caso afirma lo que DEBERÍA pasar.
// También vigila que los recorridos contra la app publicada (tests/recorrido) manden esa contraseña (tests/recorrido/sitio.mjs).
// Uso: node tests/romper/middleware.mjs   ·   SOLO=<regex> corre sólo los casos que coinciden
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const res = [];
const ok = (n, c, x = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : "")); };

let middleware = null, config = null, alCargar = "";
const ARCHIVO = path.join(RAIZ, "middleware.js");
if (fs.existsSync(ARCHIVO)) {
  try { ({ default: middleware, config } = await import(pathToFileURL(ARCHIVO).href)); } catch (e) { alCargar = "middleware.js no se pudo cargar: " + String(e?.message || e).split("\n")[0]; }
} else alCargar = "no hay middleware.js: produccion.sygma.mx abre sin la contraseña de sitio";
const NO_HAY = alCargar;

const pedir = (ruta, autorizacion) => new Request(`https://produccion.sygma.mx${ruta}`, { headers: autorizacion ? { authorization: autorizacion } : {} });
const basic = (u, c) => "Basic " + btoa(`${u}:${c}`);
const conVariables = (fn, usuario = "oficina", clave = "clave-de-prueba") => {
  const antes = { u: process.env.BASIC_AUTH_USER, c: process.env.BASIC_AUTH_PASSWORD };
  process.env.BASIC_AUTH_USER = usuario;
  process.env.BASIC_AUTH_PASSWORD = clave;
  try { return fn(); } finally {
    if (antes.u === undefined) delete process.env.BASIC_AUTH_USER; else process.env.BASIC_AUTH_USER = antes.u;
    if (antes.c === undefined) delete process.env.BASIC_AUTH_PASSWORD; else process.env.BASIC_AUTH_PASSWORD = antes.c;
  }
};
const estado = (r) => (r === undefined ? "nada (dejó pasar)" : r?.status);

// ── v10.84.162 — vuelta 1: escritas ANTES del cambio, contra v10.84.161 (sin middleware.js: todas fallan) ──
{
  const fallas = [];
  if (NO_HAY) fallas.push(NO_HAY);
  else {
    delete process.env.BASIC_AUTH_USER; delete process.env.BASIC_AUTH_PASSWORD;
    for (const a of [undefined, basic("oficina", "clave-de-prueba"), basic("", "")]) {
      const r = middleware(pedir("/", a)); if (r?.status !== 503) fallas.push(`sin variables contestó ${estado(r)}`);
    }
    process.env.BASIC_AUTH_USER = "oficina";
    const r = middleware(pedir("/", basic("oficina", ""))); if (r?.status !== 503) fallas.push(`con sólo el usuario puesto contestó ${estado(r)}`);
    delete process.env.BASIC_AUTH_USER;
  }
  ok("mw-01-sin-variables-la-puerta-queda-cerrada", fallas.length === 0, fallas.join("; ") || "");
}
{
  const fallas = [];
  if (NO_HAY) fallas.push(NO_HAY);
  else conVariables(() => {
    for (const ruta of ["/", "/index.html"]) {
      const r = middleware(pedir(ruta));
      if (r?.status !== 401) fallas.push(`${ruta} sin credenciales contestó ${estado(r)}`);
      else {
        if (!/^Basic realm="SYGMA PrintFlow"/.test(r.headers.get("www-authenticate") || "")) fallas.push(`pide: ${r.headers.get("www-authenticate")}`);
        if (r.headers.get("cache-control") !== "no-store") fallas.push("el 401 se puede guardar en caché");
        if (!/authorization/i.test(r.headers.get("vary") || "")) fallas.push("sin «Vary: Authorization» un caché podría dar el 401 de otro");
      }
    }
  });
  ok("mw-02-sin-credenciales-pide-la-de-sygma-printflow", fallas.length === 0, fallas.join("; "));
}
{
  const fallas = [];
  if (NO_HAY) fallas.push(NO_HAY);
  else conVariables(() => {
    const casos = {
      "contraseña mala": basic("oficina", "otra"), "usuario malo": basic("otro", "clave-de-prueba"), "contraseña vacía": basic("oficina", ""),
      "usuario vacío": basic("", "clave-de-prueba"), "sin dos puntos": "Basic " + btoa("oficinaclave-de-prueba"), "no es base64": "Basic ¡¡no-es-base64!!",
      "otro esquema": "Bearer " + btoa("oficina:clave-de-prueba"), "enorme": "Basic " + "A".repeat(5000), "mayúsculas": basic("oficina", "CLAVE-DE-PRUEBA"),
      "con espacio de más": basic("oficina", "clave-de-prueba "), "la buena con algo más": basic("oficina", "clave-de-prueba:extra"), "sólo «Basic»": "Basic",
    };
    for (const [nombre, a] of Object.entries(casos)) { const r = middleware(pedir("/", a)); if (r?.status !== 401) fallas.push(`${nombre}: contestó ${estado(r)}`); }
  });
  ok("mw-03-credenciales-malas-vacias-o-mal-formadas-401", fallas.length === 0, fallas.join("; "));
}
{
  const fallas = [];
  if (NO_HAY) fallas.push(NO_HAY);
  else {
    conVariables(() => {
      if (middleware(pedir("/", basic("oficina", "clave-de-prueba"))) !== undefined) fallas.push("con las buenas no dejó pasar");
      if (middleware(pedir("/", "basic " + btoa("oficina:clave-de-prueba"))) !== undefined) fallas.push("con «basic» en minúsculas no dejó pasar");
      if (middleware(pedir("/assets/index-Abc123.js", basic("oficina", "clave-de-prueba"))) !== undefined) fallas.push("con las buenas no dejó bajar el JS");
    });
    // una contraseña que trae «:» (el navegador manda usuario:contraseña y sólo el PRIMER «:» separa)
    conVariables(() => { if (middleware(pedir("/", basic("oficina", "a:b:c"))) !== undefined) fallas.push("una contraseña con «:» no entró"); }, "oficina", "a:b:c");
  }
  ok("mw-04-con-las-buenas-entra", fallas.length === 0, fallas.join("; "));
}
{
  const fallas = [];
  if (NO_HAY) fallas.push(NO_HAY);
  else {
    const re = new RegExp("^" + config.matcher[0] + "$");
    // lo que pide la contraseña: la página y TODO el JS (la app entera va dentro del bundle) y sus mapas
    const protegidas = ["/", "/index.html", "/assets/index-BPWuIAfw.js", "/assets/vendor-Ab12.js", "/assets/index-x.js.map", "/cualquier/cosa", "/dist/x.json"];
    // lo que el navegador pide sin ella y no dice nada: el logo (las hojas impresas lo cargan desde una ventana en blanco con
    // window.location.origin + "/sygma-logo.png"), los íconos, el CSS y la letra
    const libres = ["/sygma-logo.png", "/favicon.ico", "/assets/index-CQgs9zCH.css", "/fuentes/Geist.woff2", "/x.svg", "/robots.txt"];
    for (const r of protegidas) if (!re.test(r)) fallas.push(`${r} quedó sin contraseña`);
    for (const r of libres) if (re.test(r)) fallas.push(`${r} pide contraseña (se vería roto)`);
    // lo que la app pide por su dirección (fuera de /assets) tiene que estar en «libres» o ir con la contraseña
    const app = fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8");
    for (const m of app.matchAll(/["'`]\/([A-Za-z0-9_-]+\.(?:png|jpg|svg|ico|mp3|wav|json|pdf|webmanifest))["'`]/g)) {
      if (re.test("/" + m[1]) && !/\.(json|pdf)$/.test(m[1])) fallas.push(`App.jsx usa /${m[1]} y pediría contraseña`);
    }
  }
  ok("mw-05-cubre-la-pagina-y-el-js-no-el-logo-de-las-hojas", fallas.length === 0, fallas.join("; "));
}
{
  const fallas = [];
  if (NO_HAY) fallas.push(NO_HAY);
  else {
    const fuente = fs.readFileSync(ARCHIVO, "utf8").replace(/\/\/.*$/gm, "");
    if (/\bBuffer\b/.test(fuente)) fallas.push("usa Buffer (no existe en el edge de Vercel)");
    if (/\brequire\(|from ['"]node:/.test(fuente)) fallas.push("importa algo de Node");
    if (/console\.(log|info|warn|error)\([^)]*(pass|clave|decoded|authorization)/i.test(fuente)) fallas.push("escribe la credencial en el registro");
  }
  ok("mw-06-corre-en-el-edge-sin-nada-de-node", fallas.length === 0, fallas.join("; "));
}
{
  // «la misma para todas» (Marcelo): la misma puerta que las otras apps, con las MISMAS variables de Vercel, para que la misma
  // contraseña puesta en cada proyecto abra todas.
  const fallas = [];
  const notas = [];
  if (NO_HAY) fallas.push(NO_HAY);
  else {
    const propia = fs.readFileSync(ARCHIVO, "utf8");
    for (const v of ["BASIC_AUTH_USER", "BASIC_AUTH_PASSWORD"]) if (!propia.includes(`process.env.${v}`)) fallas.push(`no lee ${v}`);
    for (const hermana of ["cobranzaflow", "sygma-almacen", "sygma-contabilidad", "sygma-central", "sygma-cotizador"]) {
      const f = path.join(RAIZ, "..", hermana, "middleware.js");
      if (!fs.existsSync(f)) { notas.push(`${hermana}: sin middleware.js a la vista`); continue; }
      const t = fs.readFileSync(f, "utf8");
      for (const v of ["BASIC_AUTH_USER", "BASIC_AUTH_PASSWORD"]) if (!t.includes(`process.env.${v}`)) fallas.push(`${hermana} no lee ${v}: la misma contraseña no la abriría`);
    }
  }
  ok("mw-07-la-misma-puerta-que-las-otras-apps", fallas.length === 0, [...fallas, ...notas.map(n => "nota: " + n)].join("; "));
}
{
  // Los recorridos contra produccion.sygma.mx (Playwright) mandan la contraseña de sitio: todo newContext( pasa por contextoDeSitio
  const fallas = [];
  const dir = path.join(RAIZ, "tests", "recorrido");
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".mjs") && x !== "sitio.mjs")) {
    const t = fs.readFileSync(path.join(dir, f), "utf8");
    for (const linea of t.split("\n").filter(l => /\.newContext\(/.test(l))) if (!/contextoDeSitio\(/.test(linea)) fallas.push(`${f}: un newContext sin la contraseña de sitio`);
  }
  if (!fs.existsSync(path.join(dir, "sitio.mjs"))) fallas.push("no hay tests/recorrido/sitio.mjs");
  ok("mw-08-los-recorridos-de-produccion-mandan-la-contrasena", fallas.length === 0, fallas.join("; "));
}
{
  // El ayudante: contra la copia local nada; contra producción, la credencial del archivo, limitada a ese dominio; sin el archivo, se
  // detiene diciendo qué falta y SIN escribir la contraseña en ningún lado.
  const fallas = [];
  const ruta = path.join(RAIZ, "tests", "recorrido", "sitio.mjs");
  if (!fs.existsSync(ruta)) fallas.push("no hay tests/recorrido/sitio.mjs");
  else {
    const { contextoDeSitio } = await import(pathToFileURL(ruta).href);
    const tmp = path.join(os.tmpdir(), `pf-sitio-${process.pid}.json`);
    const antes = process.env.SITIO_CREDENCIAL;
    try {
      for (const local of ["http://127.0.0.1:4273", "http://localhost:4173/", undefined, ""]) {
        try { const c = contextoDeSitio(local); if (c && Object.keys(c).length) fallas.push(`a ${local} le mandó credenciales`); }
        catch { fallas.push(`contra la copia local (${local}) pidió la contraseña de sitio y se detuvo`); }
      }
      fs.writeFileSync(tmp, JSON.stringify({ usuario: "oficina", contrasena: "secreto-de-prueba-123" }));
      process.env.SITIO_CREDENCIAL = tmp;
      const c = contextoDeSitio("https://produccion.sygma.mx");
      if (c?.httpCredentials?.username !== "oficina" || c?.httpCredentials?.password !== "secreto-de-prueba-123") fallas.push("contra producción no mandó la credencial del archivo");
      if (c?.httpCredentials?.origin !== "https://produccion.sygma.mx") fallas.push(`la credencial no se limita a produccion.sygma.mx (origin: ${c?.httpCredentials?.origin}): iría también a la base`);
      for (const [nombre, contenido] of [["sin archivo", null], ["sin contraseña", { usuario: "oficina" }], ["no es JSON", "secreto-de-prueba-123 {"]]) {
        if (contenido === null) fs.rmSync(tmp, { force: true }); else fs.writeFileSync(tmp, typeof contenido === "string" ? contenido : JSON.stringify(contenido));
        let msg = "";
        try { contextoDeSitio("https://produccion.sygma.mx"); msg = "(no se detuvo)"; } catch (e) { msg = String(e?.message || e); }
        if (msg === "(no se detuvo)") fallas.push(`${nombre}: siguió sin la contraseña (daría 401 confusos)`);
        else {
          if (!msg.includes(tmp)) fallas.push(`${nombre}: el aviso no dice dónde va la contraseña`);
          if (msg.includes("secreto-de-prueba-123")) fallas.push(`${nombre}: el aviso escribe la contraseña`);
        }
      }
    } finally {
      fs.rmSync(tmp, { force: true });
      if (antes === undefined) delete process.env.SITIO_CREDENCIAL; else process.env.SITIO_CREDENCIAL = antes;
    }
  }
  ok("mw-09-el-recorrido-manda-la-contrasena-solo-a-produccion", fallas.length === 0, fallas.join("; "));
}

for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nmiddleware: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
