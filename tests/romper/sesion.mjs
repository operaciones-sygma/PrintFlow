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
      if (m === "GET" || m === "HEAD") return J(200, [], { "content-range": "*/0" });
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
  }, { viewport });
}

await browser.close();
await servidor.close();
fin();
