// Tratar de ROMPER LA SESIÓN de PrintFlow: entrar, abrir con la sesión guardada, «Salir», y la sesión que se cierra sola. Cada caso
// afirma lo que DEBERÍA vivir la persona (Karla entra en la mañana; una estación de producción comparte cuenta con otras; otra pestaña
// sale; Auth ya no renueva la sesión; se cae la red): una FALLA es un bug.
//
// La app es la REAL: se compila aquí mismo (el src/ de hoy) contra una Supabase de mentira (https://simulada.supabase.co), y Auth y la
// base se simulan en el navegador (page.route), contestando como contestan de verdad (auth-js 2.106: «session_not_found» es
// AuthSessionMissingError; una renovación rechazada borra la sesión y avisa SIGNED_OUT; un corte de red al renovar NO). Nada sale a
// producción, ni por accidente: antes de empezar se revisa que el compilado no traiga la base real.
// Lo que trae de CobranzaFlow (v3.7.999f y v3.7.999o, y lo que su sesión aprendió): toda salida es sólo de aquí (scope=local; un
// signOut() a secas es GLOBAL y tumba esa cuenta en todas las estaciones y apps); la sesión que se cierra sin «Salir» lleva a entrar
// diciendo por qué; la que se cierra MIENTRAS se entra no deja la app abierta como anónima; y la prueba nunca da la entrada por
// hecha con un tiempo fijo: espera la señal (la app abierta, o la pantalla de entrar sin «Verificando…»).
// Uso: node tests/romper/sesion.mjs [dir-capturas]   (lo corre scripts/probar.mjs)   ·   SOLO=<regex> corre sólo esos casos
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = process.argv[2] || path.join(RAIZ, "tests", "salida", "sesion");
const DIST = path.join(RAIZ, "tests", "salida", "sesion-dist");
fs.mkdirSync(OUT, { recursive: true });
const SIMULADA = "https://simulada.supabase.co";
const ANON = "llave-anon-simulada";
// Vite deja ganar a las variables del proceso sobre .env.local: el compilado habla con la simulada, no con producción.
process.env.VITE_SUPABASE_URL = SIMULADA;
process.env.VITE_SUPABASE_ANON_KEY = ANON;

const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
const fin = () => { for (const r of res) console.log(r); };

// ── compilar la app de hoy contra la simulada, y servirla ──
const { build, preview } = await import("vite");
try {
  await build({ root: RAIZ, logLevel: "error", build: { outDir: DIST, emptyOutDir: true } });
} catch (e) { ok("ses-00-compila", false, String(e.message).split("\n")[0]); fin(); process.exit(0); }
{
  const dir = path.join(DIST, "assets");
  const js = fs.readdirSync(dir).filter(f => f.endsWith(".js")).map(f => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  if (js.includes("uvhardaeooaxjrrgdjwa") || !js.includes("simulada.supabase.co")) {
    ok("ses-00-sin-produccion", false, "el compilado trae la base de producción o no trae la simulada: no se corre nada");
    fin(); process.exit(0);
  }
}
const servidor = await preview({ root: RAIZ, logLevel: "error", build: { outDir: DIST }, preview: { host: "127.0.0.1", port: 5190, strictPort: false } });
const BASE = String(servidor.resolvedUrls?.local?.[0] || "http://127.0.0.1:5190/").replace(/\/$/, "");
const ORIGEN = new URL(BASE).origin;

// ── Auth y la base, simulados ──
const USUARIOS = () => ({
  karla: { uid: "00000000-0000-4000-8000-00000000000a", pass: "buena", role: "karla", display_name: "Karla" },
  gerardo: { uid: "00000000-0000-4000-8000-00000000000b", pass: "buena", role: "produccion", display_name: "Gerardo" },
  bodega: { uid: "00000000-0000-4000-8000-00000000000c", pass: "buena", role: "almacen", display_name: "Bodega" },
  lupita: { uid: "00000000-0000-4000-8000-00000000000d", pass: "buena", role: "secretaria", display_name: "Lupita" },
  german: { uid: "00000000-0000-4000-8000-00000000000e", pass: "buena", role: "german", display_name: "Germán" },
  noemi: { uid: "00000000-0000-4000-8000-00000000000f", pass: "buena", role: "preprensa", display_name: "Noemí" },
  genaro: { uid: "00000000-0000-4000-8000-000000000010", pass: "buena", role: "vendedor", display_name: "Genaro" },
  marcelo: { uid: "00000000-0000-4000-8000-000000000011", pass: "buena", role: "admin", display_name: "Marcelo" },
});
function simulada() {
  return {
    usuarios: USUARIOS(), porSid: new Map(), porRt: new Map(), cuenta: 0,
    salidas: [], peticiones: [], raras: [],
    entradas: 0, renovaciones: 0, preguntasAuth: 0, perfiles: 0,
    // perillas: cómo contesta cada cosa
    entrar: "ok",      // ok | red                         (POST /auth/v1/token?grant_type=password)
    renovar: "ok",     // ok | rechaza | red               (POST /auth/v1/token?grant_type=refresh_token)
    usuario: "ok",     // ok | red                         (GET /auth/v1/user; una sesión muerta contesta session_not_found)
    perfil: "ok",      // ok | red | falla                 (get_user_session)
    salir: "ok",       // ok | red                         (POST /auth/v1/logout: con «red», la salida se anota y no llega)
    alPedirPerfil: null,   // async (page) => {}: corre ANTES de contestar get_user_session (para cerrar la sesión a media entrada)
    filas: {},         // v10.84.93 — { tabla: [filas] | "falla" }: lo que contesta la base al leer esa tabla (por omisión, nada)
    rpcFalla: null,    // v10.84.94 — el nombre de una RPC que contesta 500 (la base que falla al escribir)
    retraso: {},       // v10.84.95 — { tabla: ms }: la base tarda en contestar esa tabla (la primera lectura lenta)
    rpcRespuestas: {}, // v10.84.96 — { rpc: valor }: lo que contesta esa RPC (por omisión, null)
  };
}
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const usuarioAuth = (username, u) => ({ id: u.uid, aud: "authenticated", role: "authenticated", email: username + "@padillahnos.local",
  app_metadata: { provider: "email", providers: ["email"], username }, user_metadata: {}, identities: [], is_anonymous: false,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });
function sesionNueva(s, username, sid) {
  const u = s.usuarios[username];
  if (!sid) { sid = "sid-" + (++s.cuenta); s.porSid.set(sid, { username, viva: true }); }
  const ahora = Math.floor(Date.now() / 1000), exp = ahora + 3600, rt = "rt-" + sid + "-" + (++s.cuenta);
  s.porRt.set(rt, sid);
  const at = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ aud: "authenticated", exp, iat: ahora, sub: u.uid, email: username + "@padillahnos.local",
    role: "authenticated", session_id: sid, aal: "aal1", is_anonymous: false, app_metadata: { provider: "email", providers: ["email"], username },
    user_metadata: {} }) + ".firma-simulada";
  return { access_token: at, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: rt, user: usuarioAuth(username, u) };
}
// como un logout global desde otra app u otro equipo: las sesiones de esa cuenta mueren en el servidor (el JWT sigue firmado)
const cerrarSesionesDe = (s, username) => { for (const v of s.porSid.values()) if (v.username === username) v.viva = false; };
const sidDe = tok => { try { return JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString()).session_id || null; } catch { return null; } };

async function rutear(ctx, s) {
  await ctx.routeWebSocket(/\/realtime\//, ws => ws.close());   // sin tiempo real: la app usa su respaldo (recarga cada 20 s)
  await ctx.route("**/*", async route => {
    const req = route.request();
    let url; try { url = new URL(req.url()); } catch { return route.abort(); }
    if (url.origin === ORIGEN) return route.continue();
    if (url.origin !== SIMULADA) return route.abort();   // fuentes y cualquier otra cosa: fuera (y nada a producción)
    const m = req.method(), ruta = url.pathname, h = req.headers();
    const cors = { "access-control-allow-origin": "*", "access-control-expose-headers": "*" };
    if (m === "OPTIONS") return route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS",
      "access-control-allow-headers": h["access-control-request-headers"] || "*", "access-control-max-age": "600" } });
    const J = (status, obj, extra = {}) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json",
      "x-supabase-api-version": "2024-01-01", ...extra }, body: obj === undefined ? "" : JSON.stringify(obj) });
    const tok = String(h["authorization"] || "").replace(/^Bearer\s+/i, "");
    const quien = !tok ? "sin" : tok === ANON ? "anon" : "usuario";
    const sid = quien === "usuario" ? sidDe(tok) : null;
    const viva = !!(sid && s.porSid.get(sid)?.viva);
    let cuerpo = {}; try { cuerpo = req.postDataJSON() || {}; } catch { cuerpo = {}; }

    if (ruta === "/auth/v1/token") {
      const gt = url.searchParams.get("grant_type");
      if (gt === "password") {
        s.entradas++;
        if (s.entrar === "red") return route.abort("internetdisconnected");
        const username = String(cuerpo.email || "").split("@")[0], u = s.usuarios[username];
        if (!u || u.pass !== cuerpo.password) return J(400, { code: "invalid_credentials", error_code: "invalid_credentials", msg: "Invalid login credentials" });
        return J(200, sesionNueva(s, username));
      }
      if (gt === "refresh_token") {
        s.renovaciones++;
        if (s.renovar === "red") return route.abort("internetdisconnected");
        const sidR = s.porRt.get(cuerpo.refresh_token), ses = sidR && s.porSid.get(sidR);
        if (s.renovar === "rechaza" || !ses || !ses.viva)
          return J(400, { code: "refresh_token_not_found", error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" });
        return J(200, sesionNueva(s, ses.username, sidR));
      }
    }
    if (ruta === "/auth/v1/user") {
      s.preguntasAuth++;
      if (s.usuario === "red") return route.abort("internetdisconnected");
      if (!viva) return J(403, { code: "session_not_found", error_code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" });
      const username = s.porSid.get(sid).username;
      return J(200, usuarioAuth(username, s.usuarios[username]));
    }
    if (ruta === "/auth/v1/logout") {
      const scope = url.searchParams.get("scope") || "(sin scope: global)";
      s.salidas.push(scope);
      if (s.salir === "red") return route.abort("internetdisconnected");
      const ses = sid && s.porSid.get(sid);
      if (ses) {
        if (scope === "local") ses.viva = false;
        else if (scope === "others") { for (const v of s.porSid.values()) if (v.username === ses.username && v !== ses) v.viva = false; }
        else cerrarSesionesDe(s, ses.username);
      }
      return route.fulfill({ status: 204, headers: cors, body: "" });
    }
    if (ruta.startsWith("/rest/v1/")) {
      s.peticiones.push({ t: Date.now(), m, ruta, quien, viva });
      if (ruta === "/rest/v1/rpc/get_user_session") {
        s.perfiles++;
        if (s.alPedirPerfil) { const f = s.alPedirPerfil; s.alPedirPerfil = null; await f(req.frame().page()); }
        if (s.perfil === "red") return route.abort("internetdisconnected");
        if (s.perfil === "falla") return J(503, { message: "upstream connect error (prueba)" });
        const u = s.usuarios[cuerpo.p_username];
        if (!u || u.inactivo) return J(200, []);
        return J(200, [{ username: cuerpo.p_username, role: u.role, display_name: u.display_name, active: true }]);
      }
      // PostgREST sólo revisa la firma y el vencimiento del JWT: con una sesión muerta en Auth, las lecturas siguen pasando.
      // Como anónimo, nada (la app de verdad recibe «permission denied»).
      if (quien !== "usuario") return J(401, { code: "42501", message: "permission denied for table " + ruta.split("/").pop(), details: null, hint: null });
      if (m === "GET" || m === "HEAD") {
        const tabla = ruta.slice("/rest/v1/".length), filas = s.filas[tabla];
        if (s.retraso[tabla]) await new Promise(r => setTimeout(r, s.retraso[tabla]));
        if (filas === "falla") return J(503, { message: "upstream connect error (prueba)" });
        if (!filas) return J(200, [], { "content-range": "*/0" });
        // por páginas, como PostgREST (la app pide de 1,000 en 1,000 hasta que una página llega vacía)
        const desde = Number(url.searchParams.get("offset") || 0), cuantas = Number(url.searchParams.get("limit") || 1000);
        const pag = filas.slice(desde, desde + cuantas);
        return J(200, pag, { "content-range": pag.length ? desde + "-" + (desde + pag.length - 1) + "/" + filas.length : "*/" + filas.length });
      }
      if (s.rpcFalla && ruta === "/rest/v1/rpc/" + s.rpcFalla) return J(500, { code: "XX000", message: "falla de prueba en " + s.rpcFalla });
      if (ruta.startsWith("/rest/v1/rpc/") && Object.prototype.hasOwnProperty.call(s.rpcRespuestas, ruta.slice(13))) return J(200, s.rpcRespuestas[ruta.slice(13)]);
      return J(200, ruta.startsWith("/rest/v1/rpc/") ? null : []);
    }
    if (ruta.startsWith("/functions/v1/")) return J(200, {});
    s.raras.push(m + " " + ruta);
    return J(404, { message: "simulada: no existe " + ruta });
  });
}

// ── la persona frente a la pantalla ──
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
const LOGIN = 'input[placeholder="Ej: gerardo, noemi, admin"]';
const texto = p => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const estado = p => p.evaluate(sel => {
  if ([...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Salir" && b.offsetParent)) return "app";
  if (/Algo salió mal/.test(document.body.innerText)) return "roto";
  if (document.querySelector(sel)) return /Verificando|Comprobando/.test(document.body.innerText) ? "verificando" : "login";
  return "cargando";
}, LOGIN);
// La señal de que la entrada terminó: la app abierta, o la pantalla de entrar sin «Verificando…». Nunca un tiempo fijo.
async function esperarEntrada(p, ms = 30000) {
  await p.waitForFunction(sel => {
    const app = [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Salir" && b.offsetParent);
    const login = !!document.querySelector(sel) && !/Verificando|Comprobando/.test(document.body.innerText);
    return app || login || /Algo salió mal/.test(document.body.innerText);
  }, LOGIN, { timeout: ms, polling: 100 }).catch(() => {});
  return estado(p);
}
async function esperarLogin(p, ms = 15000) {
  return p.waitForFunction(sel => !!document.querySelector(sel) && !/Verificando|Comprobando/.test(document.body.innerText), LOGIN, { timeout: ms, polling: 100 })
    .then(() => true, () => false);
}
async function esperarQue(cond, ms = 10000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (cond()) return true; await new Promise(r => setTimeout(r, 50)); } return cond(); }
// espera a que algo deje de moverse (p. ej. los reintentos de la librería): `quieto` ms sin cambios, hasta `tope`
async function esperarQuieto(valor, quieto = 3000, tope = 45000) {
  const t0 = Date.now(); let v = valor(), desde = Date.now();
  while (Date.now() - t0 < tope) { await new Promise(r => setTimeout(r, 200)); const n = valor(); if (n !== v) { v = n; desde = Date.now(); } else if (Date.now() - desde >= quieto) return true; }
  return false;
}
async function abrir(p) { await p.goto(BASE + "/"); return esperarEntrada(p); }
async function entrar(p, s, usuario = "karla", pass = "buena") {
  const antes = s.entradas;
  await p.locator(LOGIN).fill(usuario);
  await p.getByPlaceholder("Contraseña").fill(pass);
  await p.getByRole("button", { name: "Entrar" }).click();
  await esperarQue(() => s.entradas > antes, 10000);   // Auth recibió la entrada (o la red la cortó)
  return esperarEntrada(p);
}
async function abrirYEntrar(p, s, usuario = "karla") {
  const e0 = await abrir(p);
  if (e0 !== "login") throw new Error("al abrir no salió la pantalla de entrar (" + e0 + ")");
  const e = await entrar(p, s, usuario);
  if (e !== "app") throw new Error("con la contraseña buena no abrió la app (" + e + "): «" + (await texto(p)).slice(0, 120) + "»");
}
const LLAVE = /^sb-.*-auth-token$/;
const sesionGuardada = p => p.evaluate(re => Object.keys(localStorage).some(k => new RegExp(re).test(k)), LLAVE.source);
// la sesión guardada vence; con `avisar`, la pestaña «regresa» (visibilitychange) y la librería intenta renovarla en ese momento
const vencerSesion = (p, avisar = true) => p.evaluate(([re, avisar]) => {
  const k = Object.keys(localStorage).find(k => new RegExp(re).test(k));
  if (!k) return false;
  const v = JSON.parse(localStorage.getItem(k)); v.expires_at = Math.floor(Date.now() / 1000) - 5; localStorage.setItem(k, JSON.stringify(v));
  if (avisar) window.dispatchEvent(new Event("visibilitychange"));
  return true;
}, [LLAVE.source, avisar]);
// a media entrada: la sesión vence, Auth no la renueva y la librería la borra (SIGNED_OUT) ANTES de que llegue el perfil
const cerrarAMediaEntrada = s => { s.renovar = "rechaza"; s.alPedirPerfil = async page => {
  await vencerSesion(page);
  await page.waitForFunction(re => !Object.keys(localStorage).some(k => new RegExp(re).test(k)), LLAVE.source, { timeout: 8000, polling: 50 }).catch(() => {});
}; };
const AVISO_CERRADA = /tu sesión se cerró/i;
const RUIDO = /No se pudo leer de la base|permission denied|No tienes permiso|42501/i;
const soloLocales = s => s.salidas.every(x => x === "local");
const anonimasDesde = (s, t0) => s.peticiones.filter(x => x.t >= t0 && x.quien === "anon" && x.ruta !== "/rest/v1/rpc/get_user_session").length;

async function caso(nombre, fn, { viewport = { width: 1366, height: 768 } } = {}) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const s = simulada();
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => { for (const r of ["admin", "karla", "secretaria", "vendedor", "produccion", "preprensa", "german", "visor", "almacen"]) { try { localStorage.setItem("pf-welcome-" + r, "true"); } catch { /* sin almacenamiento */ } } });
  await rutear(ctx, s);
  const errs = [];
  const nueva = async () => {
    const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
    pg.on("pageerror", e => errs.push("pageerror: " + e.message));
    // un error de la app (no el «Failed to fetch» que la librería escribe cuando la red está caída a propósito)
    pg.on("console", m => { const x = m.text(); if (m.type() === "error" && /TypeError|ReferenceError|Cannot read|is not a function|Minified React/i.test(x) && !/Failed to fetch|ERR_INTERNET_DISCONNECTED|NetworkError/i.test(x)) errs.push("consola: " + x.slice(0, 160)); });
    pg.on("dialog", d => { errs.push("diálogo del navegador: " + d.message().slice(0, 60)); d.dismiss().catch(() => {}); });
    return pg;
  };
  const p = await nueva();
  try { await fn({ p, s, ctx, nueva }); }
  catch (e) { ok(nombre + " (la prueba se cayó)", false, String(e.message).split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de la página", false, errs.join(" ; ").slice(0, 300));
  if (s.raras.length) ok(nombre + " · la app pidió algo que la simulada no conoce", false, [...new Set(s.raras)].join(", ").slice(0, 200));
  const pags = ctx.pages();
  for (let i = 0; i < pags.length; i++) await pags[i].screenshot({ path: path.join(OUT, nombre + (i ? "-" + (i + 1) : "") + ".png") }).catch(() => {});
  await ctx.close();
}

// ════════════════════════ «Salir» ════════════════════════
await caso("ses-01-salir-solo-de-aqui", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  await p.getByRole("button", { name: "Salir", exact: true }).click();
  const login = await esperarLogin(p);
  await esperarQue(() => s.salidas.length > 0, 5000);
  const t = await texto(p);
  ok("ses-01-salir-solo-de-aqui", login && s.salidas.length >= 1 && soloLocales(s) && !AVISO_CERRADA.test(t),
    `«Salir» lleva a entrar (${login}), sale sólo de aquí (salidas: ${s.salidas.join(" ") || "ninguna"}) y no dice que la sesión «se cerró» sola`);
});

await caso("ses-11-doble-clic-salir", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  await p.getByRole("button", { name: "Salir", exact: true }).dblclick();
  const login = await esperarLogin(p);
  await esperarQuieto(() => s.salidas.length, 1500, 8000);
  const t = await texto(p);
  ok("ses-11-doble-clic-salir", login && s.salidas.length >= 1 && s.salidas.length <= 2 && soloLocales(s) && !AVISO_CERRADA.test(t),
    `doble clic en «Salir»: a entrar ${login}, salidas ${s.salidas.join(" ") || "ninguna"}, aviso de sesión cerrada ${AVISO_CERRADA.test(t)}`);
});

// ════════════════════════ la sesión que se cierra sin «Salir» ════════════════════════
await caso("ses-02-renovacion-rechazada", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.renovar = "rechaza";   // Auth ya no renueva la sesión (la cerraron en otro lado, o caducó)
  await vencerSesion(p);
  const login = await esperarLogin(p, 15000);
  const t0 = Date.now();
  await esperarQuieto(() => s.peticiones.length, 2500, 10000);   // ¿la app sigue pidiendo cosas como anónima?
  const t = await texto(p);
  const anon = anonimasDesde(s, t0);
  ok("ses-02-renovacion-rechazada", login && AVISO_CERRADA.test(t) && anon === 0 && !RUIDO.test(t),
    `si Auth ya no renueva la sesión, la app lleva a entrar (${login}) diciendo que la sesión se cerró (${AVISO_CERRADA.test(t)}), deja de pedir como anónima (${anon}) y sin errores de las pantallas: «${t.slice(0, 140)}»`);
});

await caso("ses-03-otra-pestana-sale", async ({ p, s, nueva }) => {
  await abrirYEntrar(p, s);
  const b = await nueva();
  await b.goto(BASE + "/");
  const eb = await esperarEntrada(b);
  if (eb !== "app") throw new Error("la segunda pestaña no abrió con la sesión guardada (" + eb + ")");
  await p.getByRole("button", { name: "Salir", exact: true }).click();
  const loginA = await esperarLogin(p);
  const loginB = await esperarLogin(b, 15000);
  const tA = await texto(p), tB = await texto(b);
  ok("ses-03-otra-pestana-sale", loginA && loginB && AVISO_CERRADA.test(tB) && !AVISO_CERRADA.test(tA) && soloLocales(s),
    `«Salir» en una pestaña: la otra va a entrar (${loginB}) con el aviso (${AVISO_CERRADA.test(tB)}); la que salió no lo dice (${!AVISO_CERRADA.test(tA)}); salidas ${s.salidas.join(" ")}`);
});

await caso("ses-04-abrir-sesion-cerrada-en-otro-lado", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  cerrarSesionesDe(s, "karla");   // un logout global desde otra app u otro equipo, mientras la pestaña estaba cerrada
  await p.reload();
  const e = await esperarEntrada(p);
  const t = await texto(p);
  ok("ses-04-abrir-sesion-cerrada-en-otro-lado", e === "login" && AVISO_CERRADA.test(t) && soloLocales(s),
    `al abrir con una sesión que ya cerraron en otro lado pide entrar de una vez (${e}) con el aviso (${AVISO_CERRADA.test(t)}); salidas ${s.salidas.join(" ") || "ninguna"} · Auth consultado ${s.preguntasAuth}`);
});

await caso("ses-07-se-cierra-a-media-entrada", async ({ p, s }) => {
  const e0 = await abrir(p);
  if (e0 !== "login") throw new Error("al abrir no salió la pantalla de entrar (" + e0 + ")");
  cerrarAMediaEntrada(s);
  const t0 = Date.now();
  const e = await entrar(p, s);
  await esperarQuieto(() => s.peticiones.length, 2500, 10000);
  const t = await texto(p), anon = anonimasDesde(s, t0), fin_ = await estado(p);
  ok("ses-07-se-cierra-a-media-entrada", e === "login" && fin_ === "login" && AVISO_CERRADA.test(t) && anon === 0 && !RUIDO.test(t),
    `si la sesión se cierra mientras se entra, la app no abre a medias: ${e}/${fin_}, aviso ${AVISO_CERRADA.test(t)}, peticiones como anónima ${anon}: «${t.slice(0, 140)}»`);
});

await caso("ses-08-se-cierra-al-abrir", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  cerrarAMediaEntrada(s);
  const t0 = Date.now();
  await p.reload();
  const e = await esperarEntrada(p);
  await esperarQuieto(() => s.peticiones.length, 2500, 10000);
  const t = await texto(p), anon = anonimasDesde(s, t0), fin_ = await estado(p);
  ok("ses-08-se-cierra-al-abrir", e === "login" && fin_ === "login" && AVISO_CERRADA.test(t) && anon === 0 && !RUIDO.test(t),
    `si la sesión se cierra mientras la app la recupera al abrir, no abre a medias: ${e}/${fin_}, aviso ${AVISO_CERRADA.test(t)}, como anónima ${anon}: «${t.slice(0, 140)}»`);
});

await caso("ses-10-volver-a-entrar-quita-el-aviso", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.renovar = "rechaza";
  await vencerSesion(p);
  const login = await esperarLogin(p, 15000);
  const conAviso = AVISO_CERRADA.test(await texto(p));
  s.renovar = "ok";
  const e = await entrar(p, s);
  const t1 = await texto(p);
  let sinAvisoAlSalir = false;
  if (e === "app") { await p.getByRole("button", { name: "Salir", exact: true }).click(); await esperarLogin(p); sinAvisoAlSalir = !AVISO_CERRADA.test(await texto(p)); }
  ok("ses-10-volver-a-entrar-quita-el-aviso", login && conAviso && e === "app" && !AVISO_CERRADA.test(t1) && sinAvisoAlSalir,
    `con el aviso de sesión cerrada (${conAviso}) se vuelve a entrar (${e}), el aviso se va (${!AVISO_CERRADA.test(t1)}) y «Salir» después no lo resucita (${sinAvisoAlSalir})`);
});

await caso("ses-09-red-al-renovar-no-saca", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.renovar = "red";   // la red se cae justo al renovar: la sesión NO se cerró
  const r0 = s.renovaciones;
  await vencerSesion(p);
  await esperarQue(() => s.renovaciones > r0, 8000);
  await esperarQuieto(() => s.renovaciones, 4000, 45000);   // la librería reintenta ~25 s y se rinde sin borrar la sesión
  const e = await estado(p), t = await texto(p);
  ok("ses-09-red-al-renovar-no-saca", s.renovaciones > r0 && e === "app" && s.salidas.length === 0 && !AVISO_CERRADA.test(t),
    `un corte de red al renovar no saca a nadie ni dice que la sesión se cerró: ${e}, intentos ${s.renovaciones - r0}, salidas ${s.salidas.length}`);
});

// ════════════════════════ al abrir la app con la sesión guardada ════════════════════════
await caso("ses-05-abrir-sin-red-al-comprobar", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.perfil = "red";   // la cuenta no se pudo comprobar: la red, no la cuenta
  const salidas0 = s.salidas.length;
  await p.reload();
  const e = await esperarEntrada(p);
  const t = await texto(p), guardada = await sesionGuardada(p);
  const reintentar = p.getByRole("button", { name: /Reintentar/i });
  const hay = await reintentar.isVisible().catch(() => false);
  let abre = "—";
  if (hay) { s.perfil = "ok"; const n1 = s.perfiles; await reintentar.click(); await esperarQue(() => s.perfiles > n1, 10000); abre = await esperarEntrada(p); }
  ok("ses-05-abrir-sin-red-al-comprobar", s.salidas.length === salidas0 && guardada && /no se pudo comprobar/i.test(t) && hay && abre === "app",
    `si al abrir no se pudo comprobar la cuenta por la red, no saca a nadie (salidas ${s.salidas.slice(salidas0).join(" ") || "ninguna"}, sesión guardada ${guardada}), lo dice (${/no se pudo comprobar/i.test(t)}) y «Reintentar» (${hay}) abre sin contraseña (${abre}) · «${t.slice(0, 120)}» (${e})`);
});

await caso("ses-17-reintentar-doble-clic", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.perfil = "red";
  await p.reload();
  await esperarEntrada(p);
  const reintentar = p.getByRole("button", { name: /Reintentar/i });
  if (!(await reintentar.isVisible().catch(() => false))) { ok("ses-17-reintentar-doble-clic", false, "no hay «Reintentar» cuando la cuenta no se pudo comprobar por la red"); return; }
  const n0 = s.perfiles, salidas0 = s.salidas.length;
  await reintentar.dblclick();
  await esperarQuieto(() => s.perfiles, 1500, 10000);
  const t = await texto(p), guardada = await sesionGuardada(p);
  s.perfil = "ok";
  const sigue = await reintentar.isVisible().catch(() => false);
  if (sigue) { const n1 = s.perfiles; await reintentar.click(); await esperarQue(() => s.perfiles > n1, 10000); }
  const e = sigue ? await esperarEntrada(p) : await estado(p);
  ok("ses-17-reintentar-doble-clic", s.perfiles - n0 <= 2 && s.salidas.length === salidas0 && guardada && /no se pudo comprobar/i.test(t) && sigue && e === "app",
    `doble clic en «Reintentar» con la red caída: ${s.perfiles - n0} consultas, salidas ${s.salidas.length - salidas0}, sesión guardada ${guardada}, sigue el aviso ${/no se pudo comprobar/i.test(t)}; con la red de vuelta abre (${e})`);
});

await caso("ses-06-abrir-cuenta-desactivada", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.usuarios.karla.inactivo = true;   // la desactivaron (o ya no tiene perfil en PrintFlow) con su sesión guardada
  await p.reload();
  const e = await esperarEntrada(p);
  await esperarQue(() => s.salidas.length > 0, 5000);
  const t = await texto(p);
  ok("ses-06-abrir-cuenta-desactivada", e === "login" && s.salidas.length >= 1 && soloLocales(s) && /desactivad|ya no existe|no está activ/i.test(t),
    `una cuenta sin perfil activo sale sólo de aquí (salidas: ${s.salidas.join(" ") || "ninguna"}) y la pantalla de entrar dice por qué: «${t.slice(0, 140)}» (${e})`);
});

await caso("ses-16-abrir-rol-de-otra-app", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.usuarios.karla.role = "almacen";   // le cambiaron el rol a uno de otra app con su sesión guardada
  await p.reload();
  const e = await esperarEntrada(p);
  await esperarQue(() => s.salidas.length > 0, 5000);
  const t = await texto(p);
  ok("ses-16-abrir-rol-de-otra-app", e === "login" && s.salidas.length >= 1 && soloLocales(s) && /no tiene acceso a PrintFlow/i.test(t),
    `al abrir, un rol que no es de PrintFlow no entra (${e}), sale sólo de aquí (${s.salidas.join(" ") || "ninguna"}) y lo dice: «${t.slice(0, 140)}»`);
});

await caso("ses-18-abrir-sin-red-al-renovar", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.renovar = "red";
  await vencerSesion(p, false);   // vencida, sin avisar: al abrir, la librería tiene que renovarla y la red no deja
  await p.reload();
  const e = await esperarEntrada(p, 60000);
  const t = await texto(p), guardada = await sesionGuardada(p);
  ok("ses-18-abrir-sin-red-al-renovar", s.salidas.length === 0 && guardada && /no se pudo comprobar/i.test(t) && /Reintentar/.test(t),
    `si al abrir no hay red para renovar la sesión, no la tira (guardada ${guardada}, salidas ${s.salidas.length}) y dice que no se pudo comprobar con «Reintentar»: «${t.slice(0, 140)}» (${e})`);
});

// ════════════════════════ al entrar con la contraseña ════════════════════════
await caso("ses-12-entrar-sin-red-al-comprobar", async ({ p, s }) => {
  await abrir(p);
  s.perfil = "red";
  const e = await entrar(p, s);
  const t = await texto(p);
  ok("ses-12-entrar-sin-red-al-comprobar", e === "login" && /no se pudo (comprobar|conectar)/i.test(t) && !/incorrect/i.test(t) && soloLocales(s),
    `contraseña buena pero la cuenta no se pudo comprobar por la red: dice que fue la conexión, no «contraseña incorrecta»: «${t.slice(0, 140)}» · salidas ${s.salidas.join(" ") || "ninguna"}`);
});

await caso("ses-13-entrar-sin-red-a-auth", async ({ p, s }) => {
  await abrir(p);
  s.entrar = "red";
  const e = await entrar(p, s);
  const t = await texto(p);
  ok("ses-13-entrar-sin-red-a-auth", e === "login" && /no se pudo (comprobar|conectar)/i.test(t) && !/incorrect/i.test(t),
    `sin red para entrar, dice que fue la conexión y no «contraseña incorrecta»: «${t.slice(0, 140)}»`);
});

await caso("ses-14-contrasena-equivocada", async ({ p, s }) => {
  await abrir(p);
  const e = await entrar(p, s, "karla", "mala");
  const t = await texto(p);
  ok("ses-14-contrasena-equivocada", e === "login" && /Usuario o contraseña incorrectos/.test(t) && s.salidas.length === 0,
    `con la contraseña equivocada dice «Usuario o contraseña incorrectos» (${e}): «${t.slice(0, 120)}»`);
});

await caso("ses-15-entrar-rol-de-otra-app", async ({ p, s }) => {
  await abrir(p);
  const e = await entrar(p, s, "bodega");
  await esperarQue(() => s.salidas.length > 0, 5000);
  const t = await texto(p);
  ok("ses-15-entrar-rol-de-otra-app", e === "login" && /no tiene acceso a PrintFlow/i.test(t) && !/incorrect/i.test(t) && s.salidas.length >= 1 && soloLocales(s),
    `una cuenta de otra app (rol almacén) con su contraseña buena: dice que no tiene acceso a PrintFlow, no «contraseña incorrecta», y sale sólo de aquí (${s.salidas.join(" ") || "ninguna"}): «${t.slice(0, 140)}»`);
});

await caso("ses-21-doble-clic-entrar", async ({ p, s }) => {
  await abrir(p);
  await p.locator(LOGIN).fill("karla");
  await p.getByPlaceholder("Contraseña").fill("buena");
  await p.getByRole("button", { name: "Entrar" }).dblclick();
  await esperarQue(() => s.entradas > 0, 10000);
  const e = await esperarEntrada(p);
  await esperarQuieto(() => s.entradas + s.perfiles, 1500, 8000);
  ok("ses-21-doble-clic-entrar", e === "app" && s.entradas === 1 && s.salidas.length === 0,
    `doble clic en «Entrar»: una sola entrada a Auth (${s.entradas}), abre (${e}), sin salidas (${s.salidas.length})`);
});

// ════════════════════════ vuelta 2: por donde no se diseñó ════════════════════════
await caso("ses-22-entrar-cuenta-desactivada", async ({ p, s }) => {
  await abrir(p);
  s.usuarios.karla.inactivo = true;
  const e = await entrar(p, s);
  await esperarQue(() => s.salidas.length > 0, 5000);
  const t = await texto(p);
  ok("ses-22-entrar-cuenta-desactivada", e === "login" && /ya no está activa/i.test(t) && !/incorrect/i.test(t) && s.salidas.length >= 1 && soloLocales(s),
    `contraseña buena de una cuenta desactivada: dice que ya no está activa (no «contraseña incorrecta») y sale sólo de aquí (${s.salidas.join(" ") || "ninguna"}): «${t.slice(0, 140)}»`);
});

await caso("ses-23-abrir-sesion-vencida-y-revocada", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  cerrarSesionesDe(s, "karla");   // la cerraron en otro lado...
  await vencerSesion(p, false);   // ...y además ya venció: al abrir, la librería intenta renovarla y Auth la rechaza
  await p.reload();
  const e = await esperarEntrada(p);
  const t = await texto(p);
  ok("ses-23-abrir-sesion-vencida-y-revocada", e === "login" && AVISO_CERRADA.test(t) && soloLocales(s),
    `al abrir con una sesión vencida que Auth ya no renueva: pide entrar (${e}) diciendo que se cerró (${AVISO_CERRADA.test(t)}); salidas ${s.salidas.join(" ") || "ninguna"}`);
});

await caso("ses-24-el-aviso-se-va-al-intentar", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.renovar = "rechaza";
  await vencerSesion(p);
  await esperarLogin(p, 15000);
  const conAviso = AVISO_CERRADA.test(await texto(p));
  s.renovar = "ok";
  const e1 = await entrar(p, s, "karla", "mala");
  const t1 = await texto(p);
  const e2 = await entrar(p, s, "karla", "buena");
  ok("ses-24-el-aviso-se-va-al-intentar", conAviso && e1 === "login" && !AVISO_CERRADA.test(t1) && /Usuario o contraseña incorrectos/.test(t1) && e2 === "app",
    `con el aviso de sesión cerrada (${conAviso}), una contraseña mala enseña sólo su error (${!AVISO_CERRADA.test(t1) && /incorrectos/.test(t1)}), y la buena entra (${e2})`);
});

await caso("ses-25-sin-red-y-entra-con-contrasena", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.perfil = "red";
  await p.reload();
  await esperarEntrada(p);
  const conAviso = /no se pudo comprobar/i.test(await texto(p));
  s.perfil = "ok";
  const e = await entrar(p, s);
  const t = await texto(p);
  ok("ses-25-sin-red-y-entra-con-contrasena", conAviso && e === "app" && !/no se pudo comprobar/i.test(t),
    `con «No se pudo comprobar tu sesión» (${conAviso}) también se puede entrar con la contraseña (${e}) y el aviso se va`);
});

await caso("ses-26-cerrada-con-la-paleta-abierta", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  await p.keyboard.press("Control+k");
  const abierta = await p.waitForFunction(() => { const i = document.querySelector('input[aria-label="Buscar vista o acción"]'); return !!(i && i.offsetParent); }, null, { timeout: 4000 }).then(() => true, () => false);
  s.renovar = "rechaza";
  await vencerSesion(p);
  const login = await esperarLogin(p, 15000);
  const encima = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"],[aria-modal="true"]')].filter(d => d.offsetParent).length);
  let escribe = false;
  try { await p.locator(LOGIN).fill("karla"); escribe = (await p.locator(LOGIN).inputValue()) === "karla"; } catch { escribe = false; }
  ok("ses-26-cerrada-con-la-paleta-abierta", abierta && login && encima === 0 && escribe && AVISO_CERRADA.test(await texto(p)),
    `con la paleta (Ctrl+K) abierta (${abierta}) y la sesión que se cierra: a entrar (${login}), nada encima (${encima}), se puede escribir el usuario (${escribe})`);
});

await caso("ses-27-abrir-base-con-error-503", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.perfil = "falla";   // la base contesta 503 a get_user_session
  await p.reload();
  const e = await esperarEntrada(p);
  const t = await texto(p), guardada = await sesionGuardada(p);
  ok("ses-27-abrir-base-con-error-503", e === "login" && s.salidas.length === 0 && guardada && /no se pudo comprobar/i.test(t) && /Reintentar/.test(t),
    `si al abrir la base contesta con error (503), no saca a nadie (salidas ${s.salidas.length}, guardada ${guardada}) y ofrece «Reintentar»: «${t.slice(0, 120)}»`);
});

await caso("ses-28-reintentar-y-ya-la-cerraron", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.perfil = "red";
  await p.reload();
  await esperarEntrada(p);
  const reintentar = p.getByRole("button", { name: /Reintentar/i });
  if (!(await reintentar.isVisible().catch(() => false))) { ok("ses-28-reintentar-y-ya-la-cerraron", false, "no hay «Reintentar»"); return; }
  s.perfil = "ok";
  cerrarSesionesDe(s, "karla");   // mientras tanto la cerraron en otro lado
  const n1 = s.preguntasAuth;
  await reintentar.click();
  await esperarQue(() => s.preguntasAuth > n1, 10000);
  const e = await esperarEntrada(p);
  const t = await texto(p);
  ok("ses-28-reintentar-y-ya-la-cerraron", e === "login" && AVISO_CERRADA.test(t) && !/Reintentar/.test(t) && soloLocales(s),
    `«Reintentar» cuando ya la cerraron en otro lado: no abre (${e}) y dice que la sesión se cerró, ya sin «Reintentar»; salidas ${s.salidas.join(" ") || "ninguna"}`);
});

await caso("ses-32-dos-pestanas-renovacion-rechazada", async ({ p, s, nueva }) => {
  await abrirYEntrar(p, s);
  const b = await nueva();
  await b.goto(BASE + "/");
  if ((await esperarEntrada(b)) !== "app") throw new Error("la segunda pestaña no abrió con la sesión guardada");
  s.renovar = "rechaza";
  await vencerSesion(p);
  const a = await esperarLogin(p, 15000), bb = await esperarLogin(b, 15000);
  const tA = await texto(p), tB = await texto(b);
  ok("ses-32-dos-pestanas-renovacion-rechazada", a && bb && AVISO_CERRADA.test(tA) && AVISO_CERRADA.test(tB) && s.salidas.every(x => x === "local"),
    `Auth ya no renueva la sesión y hay dos pestañas: las dos van a entrar (${a}/${bb}) con el aviso (${AVISO_CERRADA.test(tA)}/${AVISO_CERRADA.test(tB)})`);
});

await caso("ses-33-salir-con-la-red-caida", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.salir = "red";   // «Salir» no alcanza a llegar a Auth
  await p.getByRole("button", { name: "Salir", exact: true }).click();
  const login = await esperarLogin(p);
  await esperarQue(() => s.salidas.length > 0, 5000);
  await p.waitForFunction(re => !Object.keys(localStorage).some(k => new RegExp(re).test(k)), LLAVE.source, { timeout: 5000, polling: 100 }).catch(() => {});
  const guardada = await sesionGuardada(p), t = await texto(p);
  await p.reload();
  const e = await esperarEntrada(p);
  ok("ses-33-salir-con-la-red-caida", login && !guardada && !AVISO_CERRADA.test(t) && e === "login" && soloLocales(s),
    `«Salir» con la red caída: a entrar (${login}) sin aviso de sesión cerrada, la sesión se borra de este equipo (guardada ${guardada}) y al recargar no vuelve a entrar sola (${e})`);
});

await caso("ses-34-otra-cuenta-despues-del-aviso", async ({ p, s }) => {
  await abrirYEntrar(p, s, "karla");
  s.renovar = "rechaza";
  await vencerSesion(p);
  await esperarLogin(p, 15000);
  s.renovar = "ok";
  const e = await entrar(p, s, "gerardo");
  const t = await texto(p);
  ok("ses-34-otra-cuenta-despues-del-aviso", e === "app" && /Gerardo/.test(t) && /Tablero/.test(t) && !/Folios/.test(t) && !AVISO_CERRADA.test(t),
    `después del aviso entra otra cuenta (Gerardo, producción) y la app es la suya, sin nada de la anterior (Karla): ${e} · «${t.slice(0, 160)}»`);
});

for (const [id, viewport] of [["ses-29-sin-red-a-1366", { width: 1366, height: 768 }], ["ses-30-sin-red-a-1920", { width: 1920, height: 1080 }]]) {
  await caso(id, async ({ p, s }) => {
    await abrirYEntrar(p, s);
    s.perfil = "red";
    await p.reload();
    await esperarEntrada(p);
    const vp = p.viewportSize();
    const dentro = async loc => { const b = await loc.boundingBox(); return !!b && b.y >= 0 && b.x >= 0 && b.y + b.height <= vp.height && b.x + b.width <= vp.width; };
    const aviso = p.locator("[data-aviso-sesion]").first();
    const hayAviso = await aviso.isVisible().catch(() => false);
    const r = hayAviso && await dentro(aviso), b1 = await dentro(p.getByRole("button", { name: /Reintentar/i })), b2 = await dentro(p.getByRole("button", { name: "Entrar" }));
    const sinBarra = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const alto = hayAviso ? (await aviso.boundingBox()).height : 0;
    ok(id, r && b1 && b2 && sinBarra, `a ${vp.width}: el aviso de la red (${r}, ${Math.round(alto)} px de alto), «Reintentar» (${b1}) y «Entrar» (${b2}) a la vista sin bajar; sin barra horizontal (${sinBarra})`);
  }, { viewport });
}

// ════════════════════════ vuelta 3: que el aviso no salga de más ════════════════════════
await caso("ses-35-primera-vez-sin-aviso", async ({ p }) => {
  const e = await abrir(p);
  const t = await texto(p);
  ok("ses-35-primera-vez-sin-aviso", e === "login" && !(await p.locator("[data-aviso-sesion]").count()) && !/sesión se cerró|no se pudo comprobar/i.test(t),
    `un equipo sin sesión guardada abre la pantalla de entrar a secas, sin avisos (${e}): «${t.slice(0, 100)}»`);
});

await caso("ses-36-salir-y-recargar-sin-aviso", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  await p.getByRole("button", { name: "Salir", exact: true }).click();
  await esperarLogin(p);
  await esperarQue(() => s.salidas.length > 0, 5000);
  await p.reload();
  const e = await esperarEntrada(p);
  const t = await texto(p);
  ok("ses-36-salir-y-recargar-sin-aviso", e === "login" && !(await p.locator("[data-aviso-sesion]").count()) && !AVISO_CERRADA.test(t),
    `después de «Salir», recargar abre la pantalla de entrar sin decir que la sesión «se cerró» (${e})`);
});

await caso("ses-39-aviso-en-tableta", async ({ p, s }) => {
  await abrirYEntrar(p, s);
  s.perfil = "red";
  await p.reload();
  await esperarEntrada(p);
  const vp = p.viewportSize();
  const b = await p.locator("[data-aviso-sesion]").first().boundingBox().catch(() => null);
  const r = await p.getByRole("button", { name: /Reintentar/i }).boundingBox().catch(() => null);
  const sinBarra = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const dentro = x => !!x && x.x >= 0 && x.x + x.width <= vp.width;
  ok("ses-39-aviso-en-tableta", dentro(b) && dentro(r) && r.height >= 40 && sinBarra,
    `en una tableta (${vp.width}×${vp.height}): el aviso cabe a lo ancho (${dentro(b)}), «Reintentar» cabe y es tocable (${r ? Math.round(r.height) : 0} px ≥40), sin barra horizontal (${sinBarra})`);
}, { viewport: { width: 800, height: 1280 } });

// ════════════════════════ el aviso, en las dos pantallas de Marcelo ════════════════════════
for (const [id, viewport] of [["ses-19-aviso-a-1366", { width: 1366, height: 768 }], ["ses-20-aviso-a-1920", { width: 1920, height: 1080 }]]) {
  await caso(id, async ({ p, s }) => {
    await abrirYEntrar(p, s);
    s.renovar = "rechaza";
    await vencerSesion(p);
    await esperarLogin(p, 15000);
    const aviso = p.getByText(AVISO_CERRADA).first();
    if (!(await aviso.isVisible().catch(() => false))) { ok(id, false, "no hay aviso de sesión cerrada en la pantalla de entrar"); return; }
    const m = await aviso.evaluate(el => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
      let bg = null; for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) { bg = c; break; } }
      bg = bg || [255, 255, 255];
      const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const a = lum(rgb(cs.color)), b = lum(bg), contraste = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return { dentro: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, contraste: Math.round(contraste * 10) / 10, letra: parseFloat(cs.fontSize) };
    });
    const entrarBtn = await p.getByRole("button", { name: "Entrar" }).boundingBox();
    const vp = p.viewportSize();
    const btnDentro = !!entrarBtn && entrarBtn.y >= 0 && entrarBtn.y + entrarBtn.height <= vp.height;
    const sinBarra = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(id, m.dentro && m.contraste >= 4.5 && m.letra >= 12 && btnDentro && sinBarra,
      `a ${vp.width}: el aviso se ve entero (${m.dentro}), con contraste ${m.contraste} (≥4.5) y letra de ${m.letra} px (≥12); «Entrar» a la vista sin bajar (${btnDentro}); sin barra horizontal (${sinBarra})`);
    // v10.84.72 — DESIGN.md: nada de franjas laterales de color (border-left grueso) en avisos; borde completo de 1 px o tinte
    const bordes = await p.locator("[data-aviso-sesion]").first().evaluate(el => { const cs = getComputedStyle(el); return [cs.borderLeftWidth, cs.borderRightWidth, cs.borderTopWidth].map(parseFloat); }).catch(() => null);
    ok(id + "-sin-franja", !!bordes && bordes[0] <= 1.5 && bordes[0] === bordes[1] && bordes[1] === bordes[2],
      `el aviso no lleva franja lateral de color: bordes izquierdo/derecho/arriba ${bordes ? bordes.join("/") : "?"} px`);
  }, { viewport });
}

// ════════════════════════ el menú de cada rol (v10.84.93) ════════════════════════
// Viven aquí porque ésta es la tanda que corre la app ENTERA (el menú se arma en App, no en un componente del banco). La critique de
// «Mis Pendientes» (13-oct, 17/40): Karla tenía DOS colas para las mismas órdenes, «Pendientes» (las fichas) y «Folios» (su vista de
// verdad: «Por foliar» y «En la planta»), y el número del menú contaba también lo que con folio anticipado sigue en la planta, donde no
// tiene nada que hacer todavía. Lo que DEBE pasar: «Pendientes» la lleva a Folios, no hay otra entrada «Folios», y el número es el de
// «Por foliar» (sin lo que está en espera). Los demás roles no cambian. Vuelta 1: escritas antes del cambio.
const haceH = h => new Date(Date.now() - h * 3600000).toISOString();
const ordenK = (pn, x) => ({ id: "OP-" + pn, production_number: pn, client: "LIC. ORLANDO CASAS", client_id: "c1", product: "FORMATO DE SALIDA",
  product_type: "Formatos", categoria: "formas", quantity: 100, price: 1450, created_at: haceH(120), updated_at: haceH(2), created_by: "secretaria",
  order_type: "interna", priority: "normal", ...x });
const ORDENES_KARLA = () => [
  ordenK("P-0901", { stage: "salidas" }),                                                            // por foliar
  ordenK("P-0902", { stage: "maq_received", order_type: "maquila" }),                                // por foliar (maquila recibida)
  ordenK("P-0903", { stage: "salidas", snooze_reason: "Esperando que el cliente pida su factura", snooze_stage: "salidas",
    snooze_kind: "factura", snoozed_by: "karla", snoozed_at: haceH(5) }),                            // en espera: no cuenta
  ordenK("P-0904", { stage: "in_production", invoice_pre_assigned: true, invoice_folio: "F-9904" }), // folio anticipado, en la planta
];
const entradasDelMenu = p => p.evaluate(() => [...document.querySelectorAll("button[title]")].map(b => b.title)
  .filter(t => /^(Pendientes|Folios|Tablero)( \(\d+\))?$/.test(t)));
const tituloDeLaVista = p => p.evaluate(() => { const h = document.querySelector("h2"); return h ? h.textContent.replace(/\s+/g, " ").trim() : ""; });
// el Despertador del día: con órdenes en la base sale al entrar («escribe SI ENTIENDO») y tapa los clics; se contesta y se cierra
const despertar = async p => {
  if (await p.getByText(/escribe SI ENTIENDO/i).first().waitFor({ timeout: 5000 }).then(() => true, () => false)) {
    await p.getByPlaceholder(/Escribe aquí/).first().fill("SI ENTIENDO"); await p.waitForTimeout(800); }
  for (let k = 0; k < 2; k++) { await p.keyboard.press("Escape"); await p.waitForTimeout(200); }
};
// con la lectura caída, la librería reintenta el 503 antes de rendirse: se espera la señal de la app, no un tiempo fijo
const esperarFalla = p => p.waitForFunction(() => /No se pudo leer de la base|No se pudieron leer/i.test(document.body.innerText), null, { timeout: 45000, polling: 200 })
  .then(() => true, () => false);
const esperarMenu = (p, re) => p.waitForFunction(src => [...document.querySelectorAll("button[title]")].some(b => new RegExp(src).test(b.title)),
  re.source, { timeout: 15000, polling: 100 }).then(() => true, () => false);
await caso("ses-40-karla-una-sola-cola", async ({ p, s }) => {
  s.filas = { orders: ORDENES_KARLA() };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  const menu = await entradasDelMenu(p);
  await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(700);
  const vista = await tituloDeLaVista(p);
  const porFoliar = ((await p.getByRole("tab", { name: /Por foliar/ }).first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("ses-40-karla-una-sola-cola", menu.filter(t => /^Pendientes/.test(t)).length === 1 && !menu.some(t => /^Folios/.test(t))
    && menu.includes("Pendientes (2)") && /Pendientes de Folio/.test(vista) && /\b2\b/.test(porFoliar),
    `el menú de Karla: ${JSON.stringify(menu)} (una sola cola, con las 2 por foliar); «Pendientes» abre «${vista}»; la pestaña: «${porFoliar}»`);
});
await caso("ses-41-karla-la-paleta-lleva-a-folios", async ({ p, s }) => {
  s.filas = { orders: ORDENES_KARLA() };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  const ir = async q => {
    await p.keyboard.press("Control+k"); await p.waitForTimeout(300);
    await p.getByRole("combobox").last().fill(q); await p.waitForTimeout(250);
    await p.keyboard.press("Enter"); await p.waitForTimeout(700);
    return tituloDeLaVista(p);
  };
  const conPendientes = await ir("pendientes");
  await p.locator('button[title="Dashboard"]').first().click(); await p.waitForTimeout(400);
  const conFolio = await ir("folio");
  ok("ses-41-karla-la-paleta-lleva-a-folios", /Pendientes de Folio/.test(conPendientes) && /Pendientes de Folio/.test(conFolio),
    `Ctrl+K «pendientes» abre «${conPendientes}»; «folio» abre «${conFolio}» (las dos, su cola)`);
});
await caso("ses-42-karla-sin-lectura-no-cuenta", async ({ p, s }) => {
  s.filas = { orders: "falla" };
  await abrirYEntrar(p, s, "karla");
  const fallo = await esperarFalla(p); await despertar(p);
  const menu = await entradasDelMenu(p);
  await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(700);
  const t = await texto(p);
  const presume = (t.match(/Por foliar\s*0|En la planta\s*0|Sin pendientes|Sin órdenes en salida/i) || [""])[0];
  ok("ses-42-karla-sin-lectura-no-cuenta", fallo && menu.includes("Pendientes") && !menu.some(x => /^Pendientes \(\d+\)$/.test(x))
    && /no se pud(o|ieron) leer/i.test(t) && !presume,
    `con la lectura caída: el menú ${JSON.stringify(menu)} (sin número); la vista ${/no se pud(o|ieron) leer/i.test(t) ? "dice que no pudo leer" : "NO dice que no pudo leer"}`
    + (presume ? ` y PRESUME cero («${presume}»)` : ""));
});
// Folios mismo (se llega por la paleta, que antes y después lo encuentra con «folio»), con la lectura caída: ni cifras ni «vacío»
await caso("ses-46-karla-folios-sin-lectura-no-presume-cero", async ({ p, s }) => {
  s.filas = { orders: "falla" };
  await abrirYEntrar(p, s, "karla");
  const fallo = await esperarFalla(p); await despertar(p);
  await p.keyboard.press("Control+k"); await p.waitForTimeout(300);
  await p.getByRole("combobox").last().fill("folio"); await p.waitForTimeout(250);
  await p.keyboard.press("Enter"); await p.waitForTimeout(700);
  const v = await tituloDeLaVista(p), t = await texto(p);
  const presume = (t.match(/Por foliar\s*0|En la planta\s*0|Sin órdenes en salida/i) || [""])[0];
  ok("ses-46-karla-folios-sin-lectura-no-presume-cero", fallo && /Pendientes de Folio/.test(v) && /no se pudieron leer tus pendientes de folio/i.test(t) && !presume,
    `con la lectura caída, «${v}» ${/no se pudieron leer tus pendientes de folio/i.test(t) ? "dice que no pudo leer" : "NO dice que no pudo leer sus pendientes"}`
    + (presume ? ` y PRESUME cero («${presume}»)` : ""));
});
await caso("ses-45-karla-reintentar-trae-el-numero", async ({ p, s }) => {
  s.filas = { orders: "falla" };
  await abrirYEntrar(p, s, "karla");
  const fallo = await esperarFalla(p); await despertar(p);
  const antes = await entradasDelMenu(p);
  s.filas = { orders: ORDENES_KARLA() };   // la base vuelve
  const reintentar = p.getByRole("button", { name: /^Reintentar/ }).first();
  const hay = await reintentar.isVisible().catch(() => false);
  if (hay) await reintentar.click();
  const llego = await esperarMenu(p, /^Pendientes \(\d+\)$/);
  const despues = await entradasDelMenu(p);
  ok("ses-45-karla-reintentar-trae-el-numero", fallo && hay && llego && despues.includes("Pendientes (2)") && !antes.some(x => /\(\d+\)/.test(x)),
    `con la lectura caída el menú decía ${JSON.stringify(antes)}; ${hay ? "con «Reintentar»" : "SIN «Reintentar»"} dice ${JSON.stringify(despues)}`);
});
// la otra pantalla de Marcelo (1920): la misma cola, y el menú plegado conserva su entrada con su nombre en el «title»
await caso("ses-47-karla-una-sola-cola-1920", async ({ p, s }) => {
  s.filas = { orders: ORDENES_KARLA() };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  const menu = await entradasDelMenu(p);
  await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(700);
  const vista = await tituloDeLaVista(p);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  await p.getByTitle("Colapsar menú").first().click().catch(() => {}); await p.waitForTimeout(400);
  const plegado = await entradasDelMenu(p);
  ok("ses-47-karla-una-sola-cola-1920", JSON.stringify(menu) === '["Pendientes (2)"]' && /Pendientes de Folio/.test(vista) && ancho <= 1920 && plegado.includes("Pendientes (2)"),
    `a 1920: el menú ${JSON.stringify(menu)}, «Pendientes» abre «${vista}», ancho ${ancho}; plegado: ${JSON.stringify(plegado)}`);
}, { viewport: { width: 1920, height: 1080 } });
for (const [n, quien, tablero] of [["ses-43-gerardo-sus-pendientes-siguen", "gerardo", true], ["ses-44-lupita-sus-pendientes-siguen", "lupita", false]]) {
  await caso(n, async ({ p, s }) => {
    s.filas = { orders: ORDENES_KARLA() };
    await abrirYEntrar(p, s, quien);
    await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
    const menu = await entradasDelMenu(p);
    await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(700);
    const v = await tituloDeLaVista(p);
    // la paleta es de todos: lo que cada quien busca por su nombre la sigue encontrando
    await p.keyboard.press("Control+k"); await p.waitForTimeout(300);
    await p.getByRole("combobox").last().fill(tablero ? "tablero" : "nueva"); await p.waitForTimeout(250);
    await p.keyboard.press("Enter"); await p.waitForTimeout(700);
    const v2 = await tituloDeLaVista(p);
    const esperado = tablero ? /Tablero de Producción/ : /Nueva|Orden de Producción|Nueva orden/i;
    ok(n, /Mis Pendientes/.test(v) && !menu.some(t => /^Folios/.test(t)) && menu.includes("Tablero") === tablero && esperado.test(v2 + " " + (await texto(p)).slice(0, 300)),
      `${quien}: el menú ${JSON.stringify(menu)}; «Pendientes» abre «${v}» (como antes); Ctrl+K «${tablero ? "tablero" : "nueva"}» abre «${v2}»`);
  });
}

// ════════════════════════ Germán sin arrastrar (v10.84.94) ════════════════════════
// Con la app entera: lo que el banco del tablero no ve porque lo hace App. El botón de la ficha («A CTP») llama a la app, y la app frena
// si CTP está en mantenimiento (el tablero lo frena al soltar; `assignMachine` no frena las máquinas de preprensa). Y en su tablero, un
// doble clic en «A CTP» manda UNA vez (con dos esperando, la segunda sube al lugar de la primera). Vuelta 1: escritas antes del cambio.
const ORDENES_GERMAN = () => [
  ordenK("P-0599", { stage: "ctp", client: "IMPRENTA LEON", product_type: "Volantes", categoria: "folletos" }),
  ordenK("P-0598", { stage: "ctp", client: "CERVECERIA MODELO", product_type: "Etiquetas", categoria: "etiquetas", created_at: haceH(130) }),
];
const escrituras = (s, t0) => s.peticiones.filter(x => x.t >= t0 && x.m !== "GET" && x.m !== "HEAD" && x.ruta !== "/rest/v1/rpc/get_user_session"
  && x.ruta !== "/rest/v1/rpc/log_wakeup_ack" && x.ruta !== "/rest/v1/notifications").map(x => x.m + " " + x.ruta);
await caso("ses-48-german-a-ctp-en-mantenimiento-no-manda", async ({ p, s }) => {
  s.filas = { orders: ORDENES_GERMAN(), maintenance_log: [{ id: "m-ctp", machine_id: "pp_ctp", started_at: haceH(1), ended_at: null, notes: "Cambio de lámpara", started_by: "german" }] };
  await abrirYEntrar(p, s, "german");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(700);
  const ficha = p.locator('[role="button"][aria-label^="Orden P-0599"]').first();
  const b = ficha.getByRole("button", { name: /^A CTP/ });
  const hay = await b.count();
  const t0 = Date.now();
  if (hay) { await b.first().click(); await p.waitForTimeout(1200); }
  const esc = escrituras(s, t0), t = await texto(p);
  ok("ses-48-german-a-ctp-en-mantenimiento-no-manda", hay === 1 && esc.length === 0 && /CTP está en mantenimiento/.test(t),
    `la ficha de P-0599 ${hay ? "trae «A CTP»" : "NO trae «A CTP»"}; con CTP en mantenimiento: ${esc.length ? "SE MANDÓ (" + esc.join(", ") + ")" : "no se mandó"}`
    + `; ${/CTP está en mantenimiento/.test(t) ? "lo dice" : "NO dice por qué"}`);
});
// vuelta 3: la base contesta con error al mover la orden: la app lo dice y no canta «asignada»
await caso("ses-55-german-a-ctp-la-base-falla", async ({ p, s }) => {
  s.filas = { orders: ORDENES_GERMAN() }; s.rpcFalla = "move_order_in_queue";
  await abrirYEntrar(p, s, "german");
  await esperarMenu(p, /^Tablero/); await despertar(p);
  await p.locator('button[title="Tablero"]').first().click(); await p.waitForTimeout(900);
  const b = p.getByRole("button", { name: /^A CTP/ }).first();
  const hay = await b.count();
  if (hay) { await b.click(); await p.waitForTimeout(1800); }
  const t = await texto(p);
  // (lo que dice la app: «❌ P-0599 no pasó a la CTP: … El tablero se vuelve a leer de la base.»; el éxito: «… ya corre en la CTP» o «→ CTP, 2º en
  //  la fila». Corregida en la vuelta 3 de v10.84.94: buscaba «No se pudo» o «error», que la app no dice)
  const mal = /no pasó a la CTP/.test(t), canta = /ya corre en la CTP|→ CTP, \d+º en la fila/.test(t);
  ok("ses-55-german-a-ctp-la-base-falla", hay > 0 && mal && !canta,
    `con la base fallando, «A CTP»: ${mal ? "lo dice («" + (t.match(/[^.]*no pasó a la CTP[^.]*/) || [""])[0].trim().slice(0, 100) + "»)" : "NO dice que falló"}${canta ? " y CANTA que se asignó" : ""}`);
});
await caso("ses-49-german-doble-clic-a-ctp-una-vez", async ({ p, s }) => {
  s.filas = { orders: ORDENES_GERMAN() };
  await abrirYEntrar(p, s, "german");
  await esperarMenu(p, /^Tablero/); await despertar(p);
  await p.locator('button[title="Tablero"]').first().click(); await p.waitForTimeout(900);
  const b = p.getByRole("button", { name: /^A CTP/ }).first();
  const hay = await b.count();
  const t0 = Date.now();
  if (hay) { await b.dblclick(); await p.waitForTimeout(1500); }
  const mov = s.peticiones.filter(x => x.t >= t0 && x.ruta === "/rest/v1/rpc/move_order_in_queue").length;
  ok("ses-49-german-doble-clic-a-ctp-una-vez", hay > 0 && mov === 1,
    `el tablero de Germán ${hay ? "trae «A CTP»" : "NO trae «A CTP»"}; doble clic: ${mov} envío(s) a la cola de CTP`);
});

// ════════════════════════ «Te toca» y «Espera a otro» (v10.84.95) ════════════════════════
// La critique de «Mis Pendientes» (P1-B): la lista enseñaba lo de las etapas del rol, no lo que cada quien tiene que hacer. Lo que DEBE
// pasar: fichas sólo para lo que te toca; lo que espera a otro, plegado, un renglón por orden (dónde va, con quién, desde cuándo,
// «Recordar»); lo que se mueve en el Tablero, una línea; lo pausado, una línea que lleva a «En espera»; el menú cuenta lo que te toca; y
// el vendedor ve dónde van las suyas. Vuelta 1: escritas antes del cambio.
const fichasEnLaVista = p => p.evaluate(() => [...document.querySelectorAll('[role="button"][aria-label^="Orden "]')].map(x => x.getAttribute("aria-label").split(",")[0].replace("Orden ", "")));
const renglonesEspera = p => p.evaluate(() => [...document.querySelectorAll("[data-espera]")].map(x => x.getAttribute("data-espera") + " · " + x.innerText.replace(/\s+/g, " ")));
const abrirPendientes = async p => { await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(800); };
await caso("ses-50-noemi-lo-que-ya-valido-espera-a-otro", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0905", { stage: "draft", validated_by_preprensa: true }), ordenK("P-0906", { stage: "draft" }), ordenK("P-0907", { stage: "design" })] };
  await abrirYEntrar(p, s, "noemi");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  const menu = await entradasDelMenu(p);
  await abrirPendientes(p);
  const fichas = await fichasEnLaVista(p);
  await p.locator("[data-espera-a-otro] summary").first().click().catch(() => {}); await p.waitForTimeout(300);
  const espera = await renglonesEspera(p);
  ok("ses-50-noemi-lo-que-ya-valido-espera-a-otro", menu.includes("Pendientes (2)") && fichas.includes("P-0906") && fichas.includes("P-0907") && !fichas.includes("P-0905")
    && espera.length === 1 && /^P-0905/.test(espera[0]) && /Gerardo/.test(espera[0]),
    `Noemí: el menú ${JSON.stringify(menu)}; fichas [${fichas.join(", ")}]; espera a otro: ${JSON.stringify(espera)}`);
});
await caso("ses-51-gerardo-lo-del-tablero-en-una-linea", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0908", { stage: "ready" }), ordenK("P-0909", { stage: "ready", created_at: haceH(100) }), ordenK("P-0910", { stage: "packaging" })] };
  await abrirYEntrar(p, s, "gerardo");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  const menu = await entradasDelMenu(p);
  await abrirPendientes(p);
  const fichas = await fichasEnLaVista(p);
  const linea = ((await p.locator("[data-en-tablero]").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  await p.locator("[data-en-tablero]").getByRole("button", { name: /Ir al Tablero/ }).click().catch(() => {}); await p.waitForTimeout(800);
  const v = await tituloDeLaVista(p);
  ok("ses-51-gerardo-lo-del-tablero-en-una-linea", menu.includes("Pendientes (1)") && JSON.stringify(fichas) === '["P-0910"]' && /\b2\b.*Tablero/.test(linea) && /Tablero de Producción/.test(v),
    `Gerardo: el menú ${JSON.stringify(menu)}; fichas [${fichas.join(", ")}]; la línea: «${linea}»; «Ir al Tablero» abre «${v}»`);
});
await caso("ses-52-genaro-ve-donde-van-las-suyas", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0911", { stage: "in_production", created_by: "genaro", agent: "Genaro", current_machine: "off_pm74", machine_queue_position: 0 }),
    ordenK("P-0912", { stage: "proof_client", created_by: "genaro", agent: "Genaro" }), ordenK("P-0913", { stage: "maq_sent", order_type: "maquila", created_by: "lupita", agent: "Manuel" })] };
  await abrirYEntrar(p, s, "genaro");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  const menu = await entradasDelMenu(p);
  await abrirPendientes(p);
  const fichas = await fichasEnLaVista(p);
  await p.locator("[data-espera-a-otro] summary").first().click().catch(() => {}); await p.waitForTimeout(300);
  const espera = await renglonesEspera(p);
  ok("ses-52-genaro-ve-donde-van-las-suyas", menu.includes("Pendientes (1)") && JSON.stringify(fichas) === '["P-0912"]' && espera.length === 1 && /^P-0911/.test(espera[0]) && /Gerardo/.test(espera[0]),
    `Genaro: el menú ${JSON.stringify(menu)}; fichas [${fichas.join(", ")}]; espera a otro: ${JSON.stringify(espera)} (P-0913 no es suya)`);
});
await caso("ses-53-lo-pausado-en-una-linea", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0914", { stage: "proof_client" }), ordenK("P-0915", { stage: "proof_client", snooze_reason: "Esperando que el cliente responda", snooze_stage: "proof_client", snooze_kind: "cliente", snoozed_by: "secretaria", snoozed_at: haceH(24 * 9) }),
    ordenK("P-0916", { stage: "maq_sent", order_type: "maquila", snooze_reason: "Esperando material", snooze_stage: "maq_sent", snooze_kind: "material", snoozed_by: "secretaria", snoozed_at: haceH(30) })] };
  await abrirYEntrar(p, s, "lupita");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  await abrirPendientes(p);
  const fichas = await fichasEnLaVista(p);
  const linea = ((await p.locator("[data-en-pausa]").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  await p.locator("[data-en-pausa]").getByRole("button", { name: /En espera/ }).click().catch(() => {}); await p.waitForTimeout(800);
  const v = await tituloDeLaVista(p);
  ok("ses-53-lo-pausado-en-una-linea", JSON.stringify(fichas) === '["P-0914"]' && /\b2\b en pausa/.test(linea) && /9 días/.test(linea) && /En espera/.test(v),
    `Lupita: fichas [${fichas.join(", ")}] (las pausadas, sin ficha); la línea: «${linea}»; el botón abre «${v}»`);
});
// vuelta 3, por donde no se diseñó: las dos pantallas de Marcelo con un cliente de nombre larguísimo, la base que falla al leer, y el
// modo alterno de la pantalla (admin «Ver como rol»)
const LARGO = "GOBIERNO DEL ESTADO DE GUANAJUATO, SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO, DIRECCIÓN GENERAL DE ADMINISTRACIÓN";
for (const [n, vp] of [["ses-56-noemi-espera-a-otro-a-1366", { width: 1366, height: 768 }], ["ses-56b-noemi-espera-a-otro-a-1920", { width: 1920, height: 1080 }]]) {
  await caso(n, async ({ p, s }) => {
    s.filas = { orders: [ordenK("P-0905", { stage: "draft", validated_by_preprensa: true, client: LARGO }), ordenK("P-0906", { stage: "draft", client: LARGO })] };
    await abrirYEntrar(p, s, "noemi");
    await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
    await abrirPendientes(p);
    await p.locator("[data-espera-a-otro] summary").first().click().catch(() => {}); await p.waitForTimeout(300);
    const m = await p.evaluate(() => { const r = document.querySelector('[data-espera="P-0905"]'); const b = r && r.getBoundingClientRect();
      return { ancho: document.documentElement.scrollWidth, vp: document.documentElement.clientWidth, renglon: b ? Math.round(b.right) : null, alto: b ? Math.round(b.height) : null }; });
    ok(n, m.renglon != null && m.ancho <= m.vp + 1 && m.renglon <= m.vp && m.alto <= 90,
      `a ${vp.width}: ancho ${m.ancho} de ${m.vp}; el renglón de P-0905 (cliente de ${LARGO.length} letras) termina en ${m.renglon} y mide ${m.alto} px de alto`);
  }, { viewport: vp });
}
await caso("ses-57-pendientes-sin-lectura-sin-grupos", async ({ p, s }) => {
  s.filas = { orders: "falla" };
  await abrirYEntrar(p, s, "noemi");
  const fallo = await esperarFalla(p); await despertar(p);
  const menu = await entradasDelMenu(p);
  await abrirPendientes(p);
  const t = await texto(p), grupos = await p.locator("[data-espera-a-otro], [data-en-tablero], [data-en-pausa]").count();
  // el renglón bajo «Mis Pendientes», sin cifras (decía «0 pendientes» desde antes de v10.84.95, y con ella «0 te tocan»)
  const sub = ((await p.locator("h2 + p").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("ses-57-pendientes-sin-lectura-sin-grupos", fallo && menu.includes("Pendientes") && grupos === 0 && /No se pudieron leer tus pendientes/.test(t) && !/\d/.test(sub),
    `con la lectura caída: el menú ${JSON.stringify(menu)}; ${grupos} grupos a la vista; ${/No se pudieron leer tus pendientes/.test(t) ? "dice que no pudo leer" : "NO dice que no pudo leer"}; el renglón de arriba: «${sub}»`);
});
await caso("ses-58-admin-ver-como-noemi", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0905", { stage: "draft", validated_by_preprensa: true }), ordenK("P-0906", { stage: "draft" }), ordenK("P-0907", { stage: "design" })] };
  await abrirYEntrar(p, s, "marcelo");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  await abrirPendientes(p);
  const todas = await fichasEnLaVista(p);
  await p.getByRole("button", { name: "Noemí", exact: true }).first().click(); await p.waitForTimeout(600);
  const comoNoemi = await fichasEnLaVista(p);
  await p.locator("[data-espera-a-otro] summary").first().click().catch(() => {}); await p.waitForTimeout(300);
  const espera = await renglonesEspera(p);
  ok("ses-58-admin-ver-como-noemi", todas.length === 3 && JSON.stringify([...comoNoemi].sort()) === '["P-0906","P-0907"]' && espera.length === 1 && /^P-0905/.test(espera[0]),
    `admin: fichas [${todas.join(", ")}]; como Noemí: [${comoNoemi.join(", ")}] y espera a otro ${JSON.stringify(espera)}`);
});
// vuelta 4: la primera lectura tarda: mientras, «Leyendo de la base…» sin cifras ni grupos; ya leído, las cifras
await caso("ses-59-pendientes-leyendo-sin-cifras", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0905", { stage: "draft", validated_by_preprensa: true }), ordenK("P-0906", { stage: "draft" })] }; s.retraso = { orders: 4000 };   // (por página: la app pide dos, la segunda vacía)
  await abrirYEntrar(p, s, "noemi");
  await abrirPendientes(p);
  const t1 = await texto(p), grupos = await p.locator("[data-espera-a-otro], [data-en-tablero], [data-en-pausa]").count();
  const sub1 = ((await p.locator("h2 + p").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const leido = await p.waitForFunction(() => [...document.querySelectorAll("button[title]")].some(b => /^Pendientes \(\d+\)$/.test(b.title)), null, { timeout: 40000, polling: 200 })
    .then(() => true, () => false);
  await despertar(p);
  const t2 = await texto(p);
  ok("ses-59-pendientes-leyendo-sin-cifras", /Leyendo/.test(t1) && !/\d/.test(sub1) && grupos === 0 && leido && /1 te toca/.test(t2),
    `leyendo: ${/Leyendo/.test(t1) ? "lo dice" : "NO dice que está leyendo"}; el renglón de arriba: «${sub1}», ${grupos} grupos; ya leído: ${(t2.match(/\d+ te tocan?[^·]*(· [^·]+)?/) || ["(sin cifras)"])[0].slice(0, 60)}`);
});
// ════════════════════════ un error de lectura no es permiso (v10.84.96) ════════════════════════
// La critique del flujo de facturas de Karla (13-oct, P1): en P-0544 la lectura de las facturas sin orden falló y la app siguió a
// `assign_invoice` (F-90, el 50% ya pagado, se habría cobrado dos veces). Con la app entera: Karla abre el folio anticipado de una orden en
// máquina con esa lectura fallando; lo que DEBE pasar: lo dice, no deja seguir, y no se intenta asignar. Vuelta 1: escrita antes.
await caso("ses-60-folio-anticipado-sin-lectura-no-asigna", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0919", { stage: "in_production", client: "DISEÑO EN ESTRUCTURAS DE EXPOSICION", product_type: "Formatos", price: 12000, quantity: 2000,
    current_machine: "off_pm74", machine_queue_position: 0 })] };
  s.rpcFalla = "list_linkable_invoices_for_order";
  s.rpcRespuestas = { get_folio_emitter_enabled: true };   // el sistema asigna el folio (si no, la ventana lo pide a mano y no se llega a confirmar)
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title="Todas"]').first().click(); await p.waitForTimeout(800);
  // (la ficha se abre con Enter, como dice su nombre: un clic al centro cae en «Recordar a Gerardo»)
  await p.locator('[role="button"][aria-label^="Orden P-0919"]').first().focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(800);
  await p.getByRole("button", { name: /Más acciones/ }).first().click(); await p.waitForTimeout(300);
  await p.getByRole("menuitem", { name: /Asignar folio anticipado/ }).first().click(); await p.waitForTimeout(1500);
  const dlg = p.getByRole("dialog", { name: /Folio anticipado/ });
  const dice = /No pude revisar si/.test((await dlg.innerText().catch(() => "")) || "");
  await dlg.getByRole("button", { name: "Factura", exact: true }).click().catch(() => {}); await p.waitForTimeout(300);
  await dlg.getByLabel("Cliente paga adelantado").check().catch(() => {});
  await dlg.getByRole("button", { name: "No pagada", exact: true }).click().catch(() => {}); await p.waitForTimeout(300);
  const seguir = dlg.getByRole("button", { name: "Continuar" });
  const apagado = await seguir.isDisabled().catch(() => false);
  if (!apagado) { await seguir.click().catch(() => {}); await p.waitForTimeout(400); await dlg.getByRole("button", { name: "Confirmar folio" }).click().catch(() => {}); await p.waitForTimeout(2000); }
  const asignar = s.peticiones.filter(x => x.ruta === "/rest/v1/rpc/assign_invoice").length;
  ok("ses-60-folio-anticipado-sin-lectura-no-asigna", dice && apagado && asignar === 0,
    `con la lectura de las facturas sin orden fallando: ${dice ? "lo dice" : "NO lo dice"}; «Continuar» ${apagado ? "apagado" : "PRENDIDO"}; intentos de asignar: ${asignar}`);
});
// ════════════════════════ las puertas saben de su OC (v10.84.97) ════════════════════════
// La critique del flujo de facturas de Karla (13-oct, P1): las 4 fichas de PORTLAND en «Por foliar» no decían que eran de OC-0960, y la OC
// no decía que F-143 y F-155 (hechas sin orden) suman exacto lo que falta. Vuelta 1: escritas antes del cambio.
const PORTLAND = () => {
  const o = (pn, price, x = {}) => ordenK(pn, { stage: "salidas", client: "PORTLAND LEATHER", client_company: "PORTLAND LEATHER", product_type: "ETIQUETA PLG",
    categoria: "etiquetas", price, quantity: 10000, purchase_order_id: "OC-0960", ...x });
  // (P-0631 va en su OC «simple», como toda orden suelta en producción: una OC de UNA orden no lleva la marca)
  return { orders: [o("P-0592", 11200), o("P-0593", 8800), o("P-0594", 11200), o("P-0595", 8800),
      ordenK("P-0631", { stage: "salidas", client: "TRANSPORTES CASTORES DE BAJA", purchase_order_id: "OC-0957" })],
    purchase_orders: [{ id: "OC-0960", client: "PORTLAND LEATHER", client_id: "c1", status: "open", total: 40000, is_simple_oc: false, is_web_oc: false,
      created_at: haceH(200), created_by: "secretaria", vendedor: "Genaro" },
      { id: "OC-0957", client: "TRANSPORTES CASTORES DE BAJA", client_id: "c2", status: "in_progress", total: 14260, is_simple_oc: true, is_web_oc: false,
      created_at: haceH(150), created_by: "secretaria", vendedor: "Genaro" }] };
};
const F143_F155 = [{ doc_number: "F-143", doc_type: "factura", amount: 3066.78, issued_date: "2026-10-09", dias_sin_orden: 4, monto_cuadra: false },
  { doc_number: "F-155", doc_type: "factura", amount: 43333.22, issued_date: "2026-10-11", dias_sin_orden: 2, monto_cuadra: false }];
await caso("ses-61-karla-la-ficha-dice-su-oc", async ({ p, s }) => {
  s.filas = PORTLAND();
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(800);
  const fichas = await p.locator("[data-oc-de-la-ficha]").allInnerTexts().catch(() => []);
  const t = await texto(p);
  const repetido = /PORTLAND LEATHER · PORTLAND LEATHER/.test(t);
  if (fichas.length) { await p.locator("[data-oc-de-la-ficha]").first().click(); await p.waitForTimeout(1200); }
  const t2 = await texto(p), detalle = await p.getByRole("dialog").count();   // (la marca va dentro de la ficha: su clic no abre la orden)
  ok("ses-61-karla-la-ficha-dice-su-oc", fichas.length === 4 && fichas.every(x => /OC-0960 · 4 órdenes/.test(x)) && !repetido && /OC-0960/.test(t2) && /Productos \(4\)/.test(t2) && detalle === 0,
    `fichas con su OC: ${JSON.stringify(fichas)} (P-0631, en su OC de una, sin); nombre repetido: ${repetido}; al tocarla: ${/Productos \(4\)/.test(t2) ? "abre OC-0960" : "NO abre la OC"}${detalle ? " y ABRE el detalle de la orden" : ""}`);
});
await caso("ses-62-la-oc-dice-que-sus-facturas-sin-orden-suman", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_oc: F143_F155, get_folio_emitter_enabled: true };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(800);
  await p.getByText("OC-0960", { exact: false }).first().click(); await p.waitForTimeout(1200);
  const aviso = ((await p.locator("[data-sin-orden-de-la-oc]").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const b = p.getByRole("button", { name: /Ligar en el plan matriz/ });
  const hay = await b.count();
  if (hay) { await b.click(); await p.waitForTimeout(1500); }
  const plan = /Plan matriz de facturación/.test(await texto(p));
  ok("ses-62-la-oc-dice-que-sus-facturas-sin-orden-suman", /F-143/.test(aviso) && /F-155/.test(aviso) && /46,400\.00/.test(aviso) && /justo lo que falta/.test(aviso) && hay === 1 && plan,
    `el aviso: «${aviso.slice(0, 200)}»; «Ligar en el plan matriz» ${hay ? "abre " + (plan ? "el plan" : "OTRA cosa") : "NO está"}`);
});
// vuelta 3, por donde no se diseñó: la lectura que falla (y «Reintentar»), una orden todavía en la planta, facturas que no suman, otro rol,
// una orden cancelada en la OC, la búsqueda, y la otra pantalla de Marcelo
const abrirOC = async (p, quien, s) => {
  await abrirYEntrar(p, s, quien);
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(800);
  await p.getByText("OC-0960", { exact: false }).first().click(); await p.waitForTimeout(1500);
};
const avisoOC = async p => ((await p.locator("[data-sin-orden-de-la-oc]").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
await caso("ses-63-la-oc-sin-lectura-lo-dice", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcFalla = "list_linkable_invoices_for_oc";
  await abrirOC(p, "karla", s);
  const t1 = await texto(p), dice = /No pude revisar si PORTLAND LEATHER tiene facturas hechas sin orden/.test(t1), aviso1 = await p.locator("[data-sin-orden-de-la-oc]").count();
  s.rpcFalla = null; s.rpcRespuestas = { list_linkable_invoices_for_oc: F143_F155 };
  await p.getByRole("button", { name: "Reintentar" }).first().click().catch(() => {}); await p.waitForTimeout(1500);
  const aviso2 = await avisoOC(p);
  ok("ses-63-la-oc-sin-lectura-lo-dice", dice && aviso1 === 0 && /F-143/.test(aviso2) && /justo lo que falta/.test(aviso2),
    `sin la lectura: ${dice ? "lo dice" : "NO lo dice"} (aviso de facturas: ${aviso1}); con «Reintentar» y la base de vuelta: «${aviso2.slice(0, 120)}»`);
});
await caso("ses-64-la-oc-con-una-en-la-planta", async ({ p, s }) => {
  const f = PORTLAND(); f.orders[3] = { ...f.orders[3], stage: "packaging" };
  s.filas = f; s.rpcRespuestas = { list_linkable_invoices_for_oc: F143_F155 };
  await abrirOC(p, "karla", s);
  const aviso = await avisoOC(p), b = await p.getByRole("button", { name: /Ligar en el plan matriz/ }).count();
  const plan = await p.getByRole("button", { name: /^Plan matriz$/ }).count();
  // (v10.84.101: el plan ya abre antes de Salidas, con anticipadas; antes afirmaba «El plan abre cuando todas lleguen a Salidas» y sin el botón)
  ok("ses-64-la-oc-con-una-en-la-planta", /F-155/.test(aviso) && /van anticipadas en el plan/.test(aviso) && b === 1 && plan === 1,
    `con P-0595 en Empaque: «${aviso.slice(0, 220)}»; «Ligar en el plan matriz»: ${b}; «Plan matriz» en la barra: ${plan}`);
});
await caso("ses-65-la-oc-con-una-que-no-suma", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_oc: [F143_F155[0]] };
  await abrirOC(p, "karla", s);
  const aviso = await avisoOC(p), b = await p.getByRole("button", { name: /Ligar en el plan matriz/ }).count();
  ok("ses-65-la-oc-con-una-que-no-suma", /F-143/.test(aviso) && !/justo lo que falta/.test(aviso) && /lígala en el plan matriz/.test(aviso) && b === 1,
    `sólo F-143 (no suma la OC): «${aviso.slice(0, 200)}»; «Ligar en el plan matriz»: ${b}`);
});
await caso("ses-66-la-oc-de-lupita-sin-aviso-ni-lectura", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_oc: F143_F155 };
  await abrirOC(p, "lupita", s);
  const aviso = await p.locator("[data-sin-orden-de-la-oc]").count(), lecturas = s.peticiones.filter(x => x.ruta === "/rest/v1/rpc/list_linkable_invoices_for_oc").length;
  const abierta = /Productos \(4\)/.test(await texto(p));
  ok("ses-66-la-oc-de-lupita-sin-aviso-ni-lectura", abierta && aviso === 0 && lecturas === 0, `Lupita en OC-0960 (${abierta ? "abierta" : "NO abrió"}): aviso ${aviso}, lecturas de facturas sin orden ${lecturas} (no factura)`);
});
await caso("ses-67-la-cancelada-no-cuenta-y-la-busqueda-no-cambia-la-cuenta", async ({ p, s }) => {
  const f = PORTLAND(); f.orders.push(ordenK("P-0596", { stage: "cancelled", client: "PORTLAND LEATHER", client_company: "PORTLAND LEATHER", purchase_order_id: "OC-0960", cancelled_at: haceH(5) }));
  s.filas = f;
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(800);
  const todas = await p.locator("[data-oc-de-la-ficha]").allInnerTexts().catch(() => []);
  await p.getByPlaceholder("Buscar orden...").first().fill("P-0592"); await p.waitForTimeout(900);
  const buscando = await p.locator("[data-oc-de-la-ficha]").allInnerTexts().catch(() => []);
  ok("ses-67-la-cancelada-no-cuenta-y-la-busqueda-no-cambia-la-cuenta", todas.length === 4 && todas.every(x => /OC-0960 · 4 órdenes/.test(x)) && buscando.length === 1 && /OC-0960 · 4 órdenes/.test(buscando[0]),
    `con P-0596 cancelada: ${JSON.stringify(todas)}; buscando P-0592: ${JSON.stringify(buscando)}`);
});
for (const [n, vp] of [["ses-68-la-marca-de-la-oc-cabe-a-1366", { width: 1366, height: 768 }], ["ses-68b-la-marca-de-la-oc-cabe-a-1920", { width: 1920, height: 1080 }]]) {
  await caso(n, async ({ p, s }) => {
    s.filas = PORTLAND();
    await abrirYEntrar(p, s, "karla");
    await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
    await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(800);
    const r = await p.evaluate(() => [...document.querySelectorAll("[data-oc-de-la-ficha]")].map(b => { let f = b.parentElement; while (f && !/14px/.test(getComputedStyle(f).borderRadius)) f = f.parentElement;
      const a = b.getBoundingClientRect(), c = f ? f.getBoundingClientRect() : null; return c ? (a.left >= c.left - 0.5 && a.right <= c.right + 0.5 && a.height < 40) : false; }));
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    // con el teclado: Enter en la marca lleva a la OC y no abre la orden
    await p.locator("[data-oc-de-la-ficha]").first().focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(1200);
    const oc = /Productos \(4\)/.test(await texto(p)), detalle = await p.getByRole("dialog").count();
    ok(n, r.length === 4 && r.every(Boolean) && ancho <= vp.width && oc && detalle === 0, `marcas dentro de su ficha y en un renglón: ${JSON.stringify(r)}; ancho ${ancho}; Enter en la marca: ${oc ? "abre OC-0960" : "NO abre la OC"}${detalle ? " y ABRE la orden" : ""}`);
  }, { viewport: vp });
}
// ════════════════════════ el dinero con AA (v10.84.99) ════════════════════════
// La critique del flujo de facturas de Karla (13-oct, P1): el importe verde de cada ficha y «Asignar Folio y Entregar» (blanco sobre verde)
// daban 3.05:1; la barra de la OC, cuatro botones rellenos, uno con degradado. Se mide en la app entera, como se ve. Vuelta 1: escritas antes.
const CONTRASTE = () => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  window.__cr = el => { const lb = lum(fondo(el)), lt = lum(nums(getComputedStyle(el).color).slice(0, 3)); return +((Math.max(lb, lt) + 0.05) / (Math.min(lb, lt) + 0.05)).toFixed(2); };
  window.__relleno = el => lum(fondo(el)) < 0.4;
};
const COLA_AA = () => {
  const f = PORTLAND();
  f.orders[0] = { ...f.orders[0], due_date: "2026-10-01" };   // vencida
  f.orders.push(ordenK("P-0640", { stage: "salidas", snooze_reason: "Esperando que el cliente pida factura", snooze_stage: "salidas", snooze_kind: "awaiting_client_invoice", snoozed_by: "karla", snoozed_at: haceH(5) }));
  f.orders.push(ordenK("P-0641", { stage: "delivered", client: "HAKUNA", client_company: "HAKUNA", price: 10000, quantity: 1000, delivered_at: haceH(48) }));
  f.order_invoice_splits = [
    { id: "s1", order_id: "OP-P-0641", position: 1, doc_type: "factura", folio: "F-9001", amount_portion: 6000, qty_portion: 600, cancelled_at: null, created_at: haceH(48) },
    { id: "s2", order_id: "OP-P-0641", position: 2, doc_type: "por_facturar", folio: null, amount_portion: 4000, qty_portion: 400, cancelled_at: null, created_at: haceH(48) }];
  return f;
};
await caso("ses-69-la-cola-de-karla-con-aa", async ({ p, s }) => {
  s.filas = COLA_AA();
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes \(\d+\)$/); await despertar(p);
  await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(900);
  await p.evaluate(CONTRASTE);
  const r = await p.evaluate(() => {
    const de = sel => [...document.querySelectorAll(sel)];
    return {
      importe: de("div").filter(d => d.children.length === 0 && /^\$[\d,]+\.\d{2}$/.test(d.textContent.trim())).map(window.__cr),
      botones: de("button").filter(b => /Asignar Folio y Entregar/.test(b.textContent)).map(window.__cr),
      entrega: de("div").filter(d => /^Entrega:/.test(d.textContent.trim())).map(window.__cr),
      faltan: de("div").filter(d => /^Faltan \$/.test(d.textContent.trim())).map(window.__cr),
      cuenta: de("summary").filter(x => /Por facturar en partes/.test(x.textContent)).map(x => x.querySelector("span")).filter(Boolean).map(window.__cr),
    };
  });
  const todos = [...r.importe, ...r.botones, ...r.entrega, ...r.faltan, ...r.cuenta], repetido = /HAKUNA · HAKUNA/.test(await texto(p));
  ok("ses-69-la-cola-de-karla-con-aa", r.importe.length >= 5 && r.botones.length === 5 && r.entrega.length >= 1 && r.faltan.length === 1 && r.cuenta.length === 1 && todos.every(x => x >= 4.5) && !repetido,
    `contraste (AA pide 4.5): importes ${JSON.stringify(r.importe)} · «Asignar Folio y Entregar» ${JSON.stringify(r.botones)} · entrega vencida ${JSON.stringify(r.entrega)} · «Faltan» ${JSON.stringify(r.faltan)} · la cuenta de partes ${JSON.stringify(r.cuenta)}${repetido ? " · el cliente SALE dos veces en la tarjeta de partes" : ""}`);
});
await caso("ses-70-la-barra-de-la-oc-con-aa", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_oc: [] };
  await abrirOC(p, "karla", s);
  await p.evaluate(CONTRASTE);
  const r = await p.evaluate(() => [...document.querySelectorAll("button")].filter(b => /^(Asignar folio|Pre-asignar folio|Plan matriz|Agregar Producto Existente)$/.test(b.textContent.trim()))
    .map(b => ({ t: b.textContent.trim(), cr: window.__cr(b), degradado: getComputedStyle(b).backgroundImage !== "none", relleno: window.__relleno(b) })));
  const rellenos = r.filter(x => x.relleno).map(x => x.t);
  ok("ses-70-la-barra-de-la-oc-con-aa", r.length === 4 && r.every(x => x.cr >= 4.5 && !x.degradado) && JSON.stringify(rellenos) === '["Asignar folio"]',
    `${r.map(x => x.t + " " + x.cr + (x.degradado ? " (DEGRADADO)" : "") + (x.relleno ? " (relleno)" : "")).join(" · ")}`);
});
// la medida con ancho y sin alto («3×nullcm» en las 4 órdenes de OC-0960, en la OC y en el detalle)
await caso("ses-71-la-medida-sin-null", async ({ p, s }) => {
  const f = PORTLAND(); f.orders = f.orders.map(o => o.purchase_order_id === "OC-0960" ? { ...o, paper_type: "AUTOADHERIBLE", width_cm: 3, height_cm: null } : o);
  s.filas = f; s.rpcRespuestas = { list_linkable_invoices_for_oc: [] };
  await abrirOC(p, "karla", s);
  const enLaOC = await texto(p);
  await p.locator('[role="button"][aria-label^="Orden P-0592"]').first().focus().catch(() => {}); await p.keyboard.press("Enter"); await p.waitForTimeout(1000);
  const detalle = ((await p.getByRole("dialog").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("ses-71-la-medida-sin-null", !/null/.test(enLaOC) && /3 cm de ancho/.test(enLaOC) && !/null/.test(detalle) && /3 cm de ancho/.test(detalle),
    `en la OC: ${(enLaOC.match(/AUTOADHERIBLE[^·]{0,40}/) || ["(sin papel)"])[0]} · en el detalle: ${(detalle.match(/medidas.{0,30}/i) || ["(sin medidas)"])[0]}`);
});
// vuelta 3: la medida también en los pedidos web (un carrito de dos, WebCartChildRow, y uno suelto, WebOrdersBandeja): lo compartido, en cada uso
await caso("ses-72-la-medida-en-los-pedidos-web", async ({ p, s }) => {
  const w = (pn, x) => ordenK(pn, { stage: "web_pending", paper_type: "COUCHÉ", width_cm: 3, height_cm: null, web_folio: "W-" + pn.slice(2), ...x });
  s.filas = { orders: [w("P-0701", { cart_folio: "C-0101" }), w("P-0702", { cart_folio: "C-0101" }), w("P-0703", {})] };
  await abrirYEntrar(p, s, "lupita");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Pedidos Web"]').first().click(); await p.waitForTimeout(900);
  const t = await texto(p), veces = (t.match(/3 cm de ancho/g) || []).length;
  ok("ses-72-la-medida-en-los-pedidos-web", !/null/.test(t) && veces >= 3, `«3 cm de ancho» ${veces} veces · ${/null/.test(t) ? "TODAVÍA dice null" : "sin null"}`);
});
// ════════════════════════ el dinero en verde, con AA en toda la app (v10.84.102) ════════════════════════
// La revisión en producción de v10.84.99 encontró los importes de «En Maquila» al pie de la vista de Karla a 3.0:1; el mismo verde en el total
// de la OC y su lista (la critique: «lo que carga dinero no pasa AA en la cola y en la OC»). Vuelta 1: escritas antes del cambio.
const importesBajos = p => p.evaluate(() => [...document.querySelectorAll("div,span,b")].filter(d => d.children.length === 0 && /^\$[\d,]+\.\d{2}$/.test(d.textContent.trim()))
  .map(d => window.__cr(d)).filter(x => x < 4.5));
await caso("ses-73-el-total-de-la-oc-con-aa", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_oc: [] };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(900);
  await p.evaluate(CONTRASTE);
  const lista = await importesBajos(p), enLista = await p.evaluate(() => [...document.querySelectorAll("div,span,b")].filter(d => d.children.length === 0 && /^\$[\d,]+\.\d{2}$/.test(d.textContent.trim())).length);
  await p.getByText("OC-0960", { exact: false }).first().click(); await p.waitForTimeout(1200);
  await p.evaluate(CONTRASTE);
  const detalle = await importesBajos(p);
  ok("ses-73-el-total-de-la-oc-con-aa", enLista > 0 && lista.length === 0 && detalle.length === 0, `importes bajo AA: en la lista ${JSON.stringify(lista)} (de ${enLista}) · en el detalle ${JSON.stringify(detalle)}`);
});
await caso("ses-74-en-maquila-con-aa", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0750", { stage: "maq_sent", order_type: "maquila", maq_price: 4260, price: 3000, maquila_provider: "SERIGRAFÍA LÓPEZ", maq_provider: "SERIGRAFÍA LÓPEZ" }),
    ordenK("P-0751", { stage: "salidas" })] };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(900);
  await p.evaluate(CONTRASTE);
  const maq = await p.evaluate(() => { const sec = [...document.querySelectorAll("span")].find(x => /^En Maquila$/.test(x.textContent.trim())); const caja = sec && sec.closest("div[style*='border-radius: 16px']");
    return caja ? [...caja.querySelectorAll("div,span")].filter(d => d.children.length === 0 && /^\$[\d,]+\.\d{2}$/.test(d.textContent.trim())).map(d => window.__cr(d)) : null; });
  ok("ses-74-en-maquila-con-aa", Array.isArray(maq) && maq.length > 0 && maq.every(x => x >= 4.5), `importes de «En Maquila»: ${JSON.stringify(maq)}`);
});
// ════════════════════════ lo menor de la pasada 1 (v10.84.103) ════════════════════════
// La critique del flujo de facturas de Karla (13-oct): Karla entraba al Dashboard; la lista de OC escondía las de un solo producto (Hotsson:
// OC-0944 y OC-0949) sin un «ver todas»; «Nueva OC» se cerraba con un clic fuera aunque tuviera datos y «Crear OC» apagado sin porqué;
// «Agregar Producto Existente» sin rol de diálogo. Vuelta 1: escritas antes del cambio.
const HOTSSON_Y_PORTLAND = () => {
  const f = PORTLAND();
  f.orders.push(ordenK("P-0621", { stage: "in_production", client: "INMOBILIARIA HOTSSON", client_id: "c3", purchase_order_id: "OC-0944", price: 80370, quantity: 9000 }));
  f.purchase_orders.push({ id: "OC-0944", client: "INMOBILIARIA HOTSSON", client_id: "c3", status: "in_progress", total: 80370, is_simple_oc: true, is_web_oc: false,
    created_at: haceH(100), created_by: "secretaria", vendedor: "Genaro" });
  return f;
};
await caso("ses-75-karla-entra-a-su-cola", async ({ p, s }) => {
  s.filas = PORTLAND();
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p); await p.waitForTimeout(500);
  const v = await tituloDeLaVista(p);
  ok("ses-75-karla-entra-a-su-cola", /Pendientes de Folio/.test(v), `al entrar, Karla ve «${v}»`);
});
await caso("ses-76-las-oc-de-un-solo-producto", async ({ p, s }) => {
  s.filas = HOTSSON_Y_PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_oc: [] };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(900);
  const antes = await p.getByText("OC-0944", { exact: false }).count();
  const casilla = p.getByLabel(/Ver también las de un solo producto/), hay = await casilla.count();
  if (hay) { await casilla.check(); await p.waitForTimeout(500); }
  const despues = await p.getByText("OC-0944", { exact: false }).count();
  if (despues) { await p.getByText("OC-0944", { exact: false }).first().click(); await p.waitForTimeout(1200); }
  const nota = await p.locator("[data-oc-simple]").count(), agregar = await p.getByRole("button", { name: /Agregar Producto Existente/ }).count();
  ok("ses-76-las-oc-de-un-solo-producto", antes === 0 && hay === 1 && despues > 0 && nota === 1 && agregar === 0,
    `OC-0944 antes ${antes} · casilla ${hay} · después ${despues} · en OC-0944: la nota ${nota}, «Agregar Producto Existente» ${agregar}`);
});
await caso("ses-77-nueva-oc-no-se-pierde", async ({ p, s }) => {
  s.filas = PORTLAND();
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(800);
  await p.getByRole("button", { name: /\+ Nueva OC/ }).first().click(); await p.waitForTimeout(500);
  const dlg = p.getByRole("dialog", { name: /Nueva Orden de Compra/ });
  const porque = /Falta el cliente/.test((await dlg.innerText().catch(() => "")) || "");
  await dlg.locator("input").first().fill("CLIENTE DE PRUEBA"); await p.waitForTimeout(300);
  await p.mouse.click(5, 5); await p.waitForTimeout(400);
  const q = p.getByRole("dialog", { name: /¿Cerrar sin crear la OC\?/ }), pregunta = await q.count();
  if (pregunta) { await q.getByRole("button", { name: "Seguir capturando" }).click(); await p.waitForTimeout(300); }
  const sigue = await dlg.count(), valor = sigue ? await dlg.locator("input").first().inputValue().catch(() => "") : "";
  ok("ses-77-nueva-oc-no-se-pierde", porque && pregunta === 1 && sigue === 1 && valor === "CLIENTE DE PRUEBA",
    `sin cliente dice por qué: ${porque} · clic fuera con algo capturado: ${pregunta ? "pregunta" : "NO pregunta"} · la forma ${sigue ? "sigue con «" + valor + "»" : "SE CERRÓ"}`);
});
await caso("ses-78-agregar-existente-es-dialogo", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_oc: [] };
  await abrirOC(p, "karla", s);
  await p.getByRole("button", { name: /Agregar Producto Existente/ }).first().click(); await p.waitForTimeout(500);
  const d = await p.getByRole("dialog", { name: "Agregar Producto Existente" }).count();
  ok("ses-78-agregar-existente-es-dialogo", d === 1, `diálogo con nombre: ${d}`);
});
// vuelta 3 (v10.84.103), por donde no se diseñó: Esc en vez del clic fuera, la forma vacía, y el vendedor dueño de la OC (la base no lo deja mover)
const nuevaOC = async (p, s) => {
  s.filas = PORTLAND();
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(800);
  await p.getByRole("button", { name: /\+ Nueva OC/ }).first().click(); await p.waitForTimeout(500);
  return p.getByRole("dialog", { name: /Nueva Orden de Compra/ });
};
await caso("ses-79-nueva-oc-esc-pregunta", async ({ p, s }) => {
  const dlg = await nuevaOC(p, s);
  await dlg.locator("input").first().fill("CLIENTE DE PRUEBA"); await p.waitForTimeout(300);
  await dlg.locator("#createoc-modal-title").click(); await p.waitForTimeout(200);   // fuera del campo (en un campo, Esc es del campo)
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  const q = p.getByRole("dialog", { name: /¿Cerrar sin crear la OC\?/ }), pregunta = await q.count();
  if (pregunta) { await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
  const quedaPregunta = await q.count(), sigue = await dlg.count(), valor = sigue ? await dlg.locator("input").first().inputValue().catch(() => "") : "";
  ok("ses-79-nueva-oc-esc-pregunta", pregunta === 1 && quedaPregunta === 0 && sigue === 1 && valor === "CLIENTE DE PRUEBA",
    `Esc con algo capturado: ${pregunta ? "pregunta" : "NO pregunta"} · Esc en la pregunta: ${quedaPregunta ? "la pregunta SIGUE" : "se va"} · la forma ${sigue ? "sigue con «" + valor + "»" : "SE CERRÓ"}`);
});
await caso("ses-80-nueva-oc-vacia-cierra-sin-preguntar", async ({ p, s }) => {
  const dlg = await nuevaOC(p, s);
  await p.mouse.click(5, 5); await p.waitForTimeout(400);
  const pregunta = await p.getByRole("dialog", { name: /¿Cerrar sin crear la OC\?/ }).count(), sigue = await dlg.count();
  ok("ses-80-nueva-oc-vacia-cierra-sin-preguntar", pregunta === 0 && sigue === 0, `sin nada capturado, el clic fuera: ${pregunta ? "PREGUNTA" : "no pregunta"} · la forma ${sigue ? "SIGUE" : "se cierra"}`);
});
await caso("ses-81-el-vendedor-no-mueve-ordenes-a-su-oc", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_oc: [] };
  await abrirYEntrar(p, s, "genaro");
  await esperarMenu(p, /^Órdenes de Compra/); await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(800);
  await p.locator("button:not([title])").filter({ hasText: /^Todas$/ }).first().click(); await p.waitForTimeout(600);   // el interruptor «Mis Órdenes / Todas»
  const lista = (await texto(p)).replace(/\s+/g, " ");
  if (!/OC-0960/.test(lista)) { ok("ses-81-el-vendedor-no-mueve-ordenes-a-su-oc", false, "Genaro no ve OC-0960 en la lista: «" + lista.slice(0, 300) + "»"); return; }
  await p.getByText("OC-0960", { exact: false }).first().click(); await p.waitForTimeout(1500);
  const enLaOC = /Productos \(4\)/.test(await texto(p)), agregar = await p.getByRole("button", { name: /Agregar Producto Existente/ }).count();
  ok("ses-81-el-vendedor-no-mueve-ordenes-a-su-oc", enLaOC && agregar === 0, `Genaro en OC-0960 (la suya): ${enLaOC ? "abre" : "NO abre"} · «Agregar Producto Existente» ${agregar} (la base sólo deja a Dirección, Lupita y Karla)`);
});
// v10.84.104 — la pasada 2 (P1-2): «Facturar a un tercero (razón social distinta a la de la orden)» describía justo el caso Hotsson, donde NO se
// usa (paga quien pidió y sólo cambia la razón social del CFDI); la explicación salía hasta marcar la casilla y decía «pídelo a Dirección
// mientras llega a Por Timbrar», pero «CFDI a nombre de» ya está en CobranzaFlow (v3.7.726: Por Timbrar → Datos) y lo hace Karla.
// Y lo menor que vi en las capturas de la guía: «Agregar 2 ordenes» sin acento, y el menú que recorta el acento de «Órdenes». Vuelta 1: antes.
const abrirAsignarP0631 = async (p, s) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_order: [], get_folio_emitter_enabled: true };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p); await p.waitForTimeout(800);
  await p.getByRole("button", { name: /Asignar Folio y Entregar/ }).nth(4).click(); await p.waitForTimeout(1500);
  const dlg = p.getByRole("dialog", { name: /Asignar folio/i });
  await dlg.getByRole("button", { name: /^Factura(\s|$)/ }).first().click(); await p.waitForTimeout(500);
  return dlg;
};
await caso("ses-82-el-tercero-dice-donde-esta-cfdi-a-nombre-de", async ({ p, s }) => {
  const dlg = await abrirAsignarP0631(p, s);
  await dlg.getByLabel(/Facturar a un tercero/).check(); await p.waitForTimeout(400);
  const t = ((await dlg.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const dice = /Por Timbrar → Datos/.test(t), viejo = /pídelo a Dirección|mientras llega a Por Timbrar/.test(t);
  ok("ses-82-el-tercero-dice-donde-esta-cfdi-a-nombre-de", dice && !viejo, `dice dónde está («Por Timbrar → Datos»): ${dice} · el texto viejo («pídelo a Dirección…»): ${viejo}`);
});
await caso("ses-83-el-tercero-dice-quien-paga-antes-de-marcar", async ({ p, s }) => {
  const dlg = await abrirAsignarP0631(p, s);
  const etiqueta = ((await dlg.getByLabel(/Facturar a un tercero/).evaluate(el => el.closest("label")?.innerText || "").catch(() => "")) || "").replace(/\s+/g, " ");
  const t = ((await dlg.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const engana = /razón social distinta a la de la orden/.test(etiqueta), dicePaga = /otra empresa paga/i.test(etiqueta);
  const alternativa = /CFDI a nombre de/.test(t) && /Por Timbrar/.test(t);
  ok("ses-83-el-tercero-dice-quien-paga-antes-de-marcar", !engana && dicePaga && alternativa,
    `la casilla: «${etiqueta.slice(0, 90)}» · antes de marcar dice el otro camino («CFDI a nombre de» en Por Timbrar): ${alternativa}`);
});
const HOTSSON_NUEVA = () => {
  const f = PORTLAND();
  const h = (pn, x) => ordenK(pn, { client: "INMOBILIARIA HOTSSON", client_company: "INMOBILIARIA HOTSSON", client_id: "c3", stage: "in_production", ...x });
  f.orders.push(h("P-0621", { purchase_order_id: "OC-0944", price: 80370, quantity: 658 }), h("P-0623", { purchase_order_id: "OC-0949", price: 33730, quantity: 426 }));
  const oc = (id, x) => ({ id, client: "INMOBILIARIA HOTSSON", client_id: "c3", is_web_oc: false, created_by: "secretaria", vendedor: "Genaro", ...x });
  f.purchase_orders.push(oc("OC-0944", { status: "in_progress", total: 80370, is_simple_oc: true, created_at: haceH(300) }),
    oc("OC-0949", { status: "in_progress", total: 33730, is_simple_oc: true, created_at: haceH(290) }),
    oc("OC-0970", { status: "open", total: 0, is_simple_oc: false, created_at: haceH(1), created_by: "karla" }));
  return f;
};
await caso("ses-84-agregar-dice-ordenes-con-acento", async ({ p, s }) => {
  s.filas = HOTSSON_NUEVA(); s.rpcRespuestas = { list_linkable_invoices_for_oc: [] };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(900);
  await p.getByText("OC-0970", { exact: false }).first().click(); await p.waitForTimeout(1200);
  await p.getByRole("button", { name: /Agregar Producto Existente/ }).first().click(); await p.waitForTimeout(600);
  const d = p.getByRole("dialog", { name: "Agregar Producto Existente" });
  const boton = async () => ((await d.getByRole("button", { name: /^Agregar \d+ (orden|órden)/ }).innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
  await d.getByText("P-0621", { exact: false }).first().click(); await p.waitForTimeout(200); const uno = await boton();
  await d.getByText("P-0623", { exact: false }).first().click(); await p.waitForTimeout(200); const dos = await boton();
  ok("ses-84-agregar-dice-ordenes-con-acento", uno === "Agregar 1 orden" && dos === "Agregar 2 órdenes", `con una: «${uno}» · con dos: «${dos}»`);
});
await caso("ses-85-el-menu-no-recorta-acentos", async ({ p, s }) => {
  s.filas = PORTLAND();
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Órdenes de Compra/); await despertar(p); await p.mouse.move(700, 400); await p.waitForTimeout(300);
  const b = p.locator('button[title^="Órdenes de Compra"]').first();
  const antes = await b.screenshot();
  await b.evaluate(el => { const sp = el.querySelector("span"); if (sp) sp.style.overflow = "visible"; });
  const despues = await b.screenshot();
  const igual = Buffer.compare(antes, despues) === 0;
  ok("ses-85-el-menu-no-recorta-acentos", igual, igual ? "la etiqueta se ve igual sin recortar" : "la etiqueta recorta algo arriba (el acento de la «Ó» de «Órdenes»)");
});
// vuelta 3 (v10.84.104): el aviso en la ventana del tercero del PLAN (donde Karla haría lo de Hotsson), y «Ir a OC-0960» desde una orden de la OC
// sin facturas sin orden (la ventana ya lo dice siempre)
await caso("ses-86-el-plan-avisa-antes-de-elegir-tercero", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_oc: [], get_folio_emitter_enabled: true };
  await abrirOC(p, "karla", s);
  await p.getByRole("button", { name: /^Plan matriz$/ }).first().click(); await p.waitForTimeout(1500);
  await p.getByRole("button", { name: /Facturar a tercero/ }).first().click(); await p.waitForTimeout(600);
  const d = p.getByRole("dialog", { name: /a cargo de un tercero/ });
  const t = ((await d.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("ses-86-el-plan-avisa-antes-de-elegir-tercero", /¿Paga PORTLAND LEATHER y sólo quiere el CFDI a otra de sus razones sociales\?/.test(t) && /Por Timbrar → Datos/.test(t), `«${t.slice(0, 260)}»`);
});
await caso("ses-87-la-orden-de-la-oc-lleva-a-su-oc", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_order: [], list_linkable_invoices_for_oc: [], get_folio_emitter_enabled: true };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p); await p.waitForTimeout(800);
  await p.getByRole("button", { name: /Asignar Folio y Entregar/ }).first().click(); await p.waitForTimeout(1500);
  const dlg = p.getByRole("dialog", { name: /Asignar folio/i });
  const nota = ((await dlg.locator("[data-oc-de-la-orden]").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  await dlg.getByRole("button", { name: /Ir a OC-0960/ }).click().catch(() => {}); await p.waitForTimeout(1500);
  const enLaOC = /Productos \(4\)/.test(await texto(p)), cerrada = (await dlg.count()) === 0;
  ok("ses-87-la-orden-de-la-oc-lleva-a-su-oc", /una de las 4 órdenes de OC-0960/.test(nota) && cerrada && enLaOC, `la nota: «${nota}» · la ventana se cierra ${cerrada} · abre OC-0960 ${enLaOC}`);
});
// «Recordar», con las mismas reglas que el «⋯» de la ficha (accionesDeLaFicha: no en un borrador, que es de dos roles)
await caso("ses-54-recordar-desde-espera-a-otro", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0911", { stage: "in_production", created_by: "genaro", agent: "Genaro", current_machine: "off_pm74", machine_queue_position: 0 }),
    ordenK("P-0918", { stage: "draft", created_by: "genaro", agent: "Genaro" })] };
  await abrirYEntrar(p, s, "genaro");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await abrirPendientes(p);
  await p.locator("[data-espera-a-otro] summary").first().click().catch(() => {}); await p.waitForTimeout(300);
  const b = p.locator('[data-espera="P-0911"]').getByRole("button", { name: /Recordar/ });
  const hay = await b.count(), enBorrador = await p.locator('[data-espera="P-0918"]').getByRole("button", { name: /Recordar/ }).count();
  const t0 = Date.now();
  if (hay) { await b.first().click(); await p.waitForTimeout(1200); }
  const avisos = s.peticiones.filter(x => x.t >= t0 && x.m === "POST" && x.ruta === "/rest/v1/notifications").length;
  ok("ses-54-recordar-desde-espera-a-otro", hay === 1 && enBorrador === 0 && avisos >= 1,
    `P-0911 en máquina (con Gerardo): ${hay ? "trae «Recordar»" : "NO trae «Recordar»"}; el borrador P-0918: ${enBorrador ? "TRAE «Recordar»" : "sin «Recordar» (como su ficha)"}; avisos mandados: ${avisos}`);
});

await browser.close();
await servidor.close();
fin();
