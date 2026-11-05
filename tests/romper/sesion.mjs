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
//   SESION_PARTE=1 hasta ses-119, 2 desde ses-120 (v10.84.173: ya no cabía en los 12 minutos de una tanda; cada parte compila aparte y en su puerto); sin SESION_PARTE, todos
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = process.argv[2] || path.join(RAIZ, "tests", "salida", "sesion");
const PARTE = process.env.SESION_PARTE || "";
const DIST = path.join(RAIZ, "tests", "salida", "sesion-dist" + (PARTE === "2" ? "-2" : ""));
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
// (16-oct, la auditoría del candado: era el 5190, el del banco de «plan»; de a 6 tandas corrieron juntas y «plan» no pudo servir su banco. Ahora un
//   puerto fuera de los de los bancos, 5183-5199; can-g10 lo vigila)
const servidor = await preview({ root: RAIZ, logLevel: "error", build: { outDir: DIST }, preview: { host: "127.0.0.1", ...(PARTE === "2" ? { port: 5471 } : { port: 5470 }), strictPort: false } });
const BASE = String(servidor.resolvedUrls?.local?.[0] || "http://127.0.0.1:5470/").replace(/\/$/, "");
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
    relacionFalla: false, // v10.84.179 — leer lo de UNA orden contesta 500 (la orden terminada, al abrir su detalle)
    escrituraFalla: null, // v10.84.150 — una tabla cuyas escrituras (PATCH, POST) contestan 503: la base que no guarda
    ordenesSeMueven: false, // v10.84.172 — un PATCH a una orden contesta su id (sin esto, vacío: «cambió de etapa en otra sesión»)
    validar: null,     // v10.84.175 — { hechas: Set }: como la base de verdad, recuerda lo validado: el UPDATE que lleva su condición y ya estaba no toca nada (contesta [] sin error)
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
      s.peticiones.push({ t: Date.now(), m, ruta, quien, viva, cuerpo, orderId: url.searchParams.get("order_id") });   // v10.84.172 — con su cuerpo: lo que se escribe en la bitácora y en los avisos
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
      if (s.escrituraFalla && m !== "GET" && m !== "HEAD" && ruta === "/rest/v1/" + s.escrituraFalla) return J(503, { message: "upstream connect error (prueba)" });
      if (m === "GET" || m === "HEAD") {
        const tabla = ruta.slice("/rest/v1/".length), pedida = url.searchParams.get("order_id");
        // v10.84.179 — lo relacionado de UNA orden, como PostgREST: sólo lo suyo
        const deUna = RELACIONADAS.has(tabla) && /^eq\./.test(pedida || "");
        if (deUna && s.relacionFalla) return J(500, { message: "falla de prueba al leer lo de una orden" });
        const filas = deUna && Array.isArray(s.filas[tabla]) ? s.filas[tabla].filter(f => f.order_id === pedida.slice(3)) : s.filas[tabla];
        if (s.retraso[tabla]) await new Promise(r => setTimeout(r, s.retraso[tabla]));
        if (filas === "falla") return J(503, { message: "upstream connect error (prueba)" });
        if (!filas) return J(200, [], { "content-range": "*/0" });
        // por páginas, como PostgREST (la app pide de 1,000 en 1,000 hasta que una página llega vacía)
        const desde = Number(url.searchParams.get("offset") || 0), cuantas = Number(url.searchParams.get("limit") || 1000);
        // v10.84.173 — y como PostgREST, sólo las columnas que la app pidió: con la fila entera, ninguna prueba podía ver una columna que la pantalla usa y la
        //   lectura no pide (`ligada`, desde v10.84.89). Con «*» o una relación, la fila tal cual.
        const sel = url.searchParams.get("select"), columnas = sel && /^\w+(,\w+)*$/.test(sel) ? sel.split(",") : null;
        const pag = filas.slice(desde, desde + cuantas).map(f => columnas ? Object.fromEntries(columnas.filter(c => c in f).map(c => [c, f[c]])) : f);
        return J(200, pag, { "content-range": pag.length ? desde + "-" + (desde + pag.length - 1) + "/" + filas.length : "*/" + filas.length });
      }
      if (s.rpcFalla && ruta === "/rest/v1/rpc/" + s.rpcFalla) return J(500, { code: "XX000", message: "falla de prueba en " + s.rpcFalla });
      if (ruta.startsWith("/rest/v1/rpc/") && Object.prototype.hasOwnProperty.call(s.rpcRespuestas, ruta.slice(13))) return J(200, s.rpcRespuestas[ruta.slice(13)]);
      // v10.84.172 — con `ordenesSeMueven`, mover una orden contesta su id: la app pide de vuelta el renglón movido, y vacío es «cambió en otra sesión»
      if (s.ordenesSeMueven && m === "PATCH" && ruta === "/rest/v1/orders") { const id = (url.searchParams.get("id") || "").replace(/^eq\./, ""); return J(200, id ? [{ id }] : []); }
      if (s.validar && m === "PATCH" && ruta === "/rest/v1/orders") {
        const id = (url.searchParams.get("id") || "").replace(/^eq\./, ""), col = Object.keys(cuerpo || {}).find(k => /^validated_by_/.test(k));
        const yaEstaba = col && s.validar.hechas.has(id + col), conCondicion = col && url.searchParams.get(col) === "not.is.true";
        if (col) s.validar.hechas.add(id + col);
        return J(200, yaEstaba && conCondicion ? [] : [{ id }]);
      }
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
const RELACIONADAS = new Set(["order_timeline", "order_comments", "order_waste", "order_machine_log", "order_notes"]);
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
// v10.84.165 — cuáles fueron (ses-07 salió inestable el 20-oct con «como anónima 1» y no decía cuál): el método, la ruta y cuándo, desde t0
const cualesAnonimas = (s, t0) => s.peticiones.filter(x => x.t >= t0 && x.quien === "anon" && x.ruta !== "/rest/v1/rpc/get_user_session")
  .map(x => x.m + " " + x.ruta.replace("/rest/v1/", "") + " +" + (x.t - t0) + "ms").join(", ");

async function caso(nombre, fn, { viewport = { width: 1366, height: 768 } } = {}) {
  if (PARTE && (Number((/^ses-(\d+)/.exec(nombre) || [])[1]) >= 120 ? "2" : "1") !== PARTE) return;
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
    `si Auth ya no renueva la sesión, la app lleva a entrar (${login}) diciendo que la sesión se cerró (${AVISO_CERRADA.test(t)}), deja de pedir como anónima (${anon}${anon ? ": " + cualesAnonimas(s, t0) : ""}) y sin errores de las pantallas: «${t.slice(0, 140)}»`);
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
    `si la sesión se cierra mientras se entra, la app no abre a medias: ${e}/${fin_}, aviso ${AVISO_CERRADA.test(t)}, peticiones como anónima ${anon}${anon ? " (" + cualesAnonimas(s, t0) + ")" : ""}: «${t.slice(0, 140)}»`);
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
    `si la sesión se cierra mientras la app la recupera al abrir, no abre a medias: ${e}/${fin_}, aviso ${AVISO_CERRADA.test(t)}, como anónima ${anon}${anon ? " (" + cualesAnonimas(s, t0) + ")" : ""}: «${t.slice(0, 140)}»`);
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
      importe: de("div,span").filter(d => d.children.length === 0 && /^\$[\d,]+\.\d{2}$/.test(d.textContent.trim())).map(window.__cr),   // (v10.84.106: el importe va en su <span>, junto a «sin IVA»)
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
  // (y que ahí no se escribe en «Razón social»: el foco de «Datos» cae ahí y cambia la ficha del cliente — lo señaló CobranzaFlow)
  const cuidado = /no escribas en «Razón social»/.test(t);
  ok("ses-83-el-tercero-dice-quien-paga-antes-de-marcar", !engana && dicePaga && alternativa && cuidado,
    `la casilla: «${etiqueta.slice(0, 90)}» · antes de marcar dice el otro camino («CFDI a nombre de» en Por Timbrar): ${alternativa} · que no se escriba en «Razón social»: ${cuidado}`);
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
  // (la franja de arriba de la etiqueta, donde van los acentos: comparando el botón entero, en producción salía 1 pixel distinto, el borde de la «a» final)
  const r = await b.evaluate(el => { const x = el.querySelector("span").getBoundingClientRect(); return { x: x.left, y: x.top, w: x.width, h: x.height }; });
  const clip = { x: Math.floor(r.x), y: Math.max(0, Math.floor(r.y) - 4), width: Math.ceil(r.w), height: Math.ceil(r.h * 0.45) + 4 };
  const antes = await p.screenshot({ clip });
  await b.evaluate(el => { const sp = el.querySelector("span"); if (sp) sp.style.overflow = "visible"; });
  const despues = await p.screenshot({ clip });
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
  ok("ses-86-el-plan-avisa-antes-de-elegir-tercero", /¿Paga PORTLAND LEATHER y sólo quiere el CFDI a otra de sus razones sociales\?/.test(t) && /Por Timbrar → Datos/.test(t) && /no escribas en «Razón social»/.test(t), `«${t.slice(0, 300)}»`);
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
// v10.84.106 — lo barato de la pasada 2: Esc con el foco en la casilla del tercero (P2-4), los botones de la cola con su orden (P2-5) y los
// importes que dicen si llevan IVA (P2-3). Vuelta 1: antes.
await caso("ses-88-esc-en-la-casilla-del-tercero", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_oc: [], get_folio_emitter_enabled: true };
  await abrirOC(p, "karla", s);
  await p.getByRole("button", { name: /^Plan matriz$/ }).first().click(); await p.waitForTimeout(1500);
  await p.getByRole("button", { name: /Facturar a tercero/ }).first().click(); await p.waitForTimeout(600);
  const d = p.getByRole("dialog", { name: /a cargo de un tercero/ });
  await d.getByLabel(/Facturar a un tercero/).focus(); await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  const sigue = await d.count(), plan = /Plan matriz de facturación/.test(await texto(p));
  ok("ses-88-esc-en-la-casilla-del-tercero", sigue === 0 && plan, `con el foco en la casilla, Esc: la ventana del tercero ${sigue ? "SIGUE" : "se cierra"} · el plan ${plan ? "sigue" : "SE CERRÓ"}`);
});
await caso("ses-89-los-botones-de-la-cola-dicen-su-orden", async ({ p, s }) => {
  s.filas = PORTLAND();
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p); await p.waitForTimeout(800);
  const nombres = await p.getByRole("button", { name: /Asignar Folio y Entregar/ }).evaluateAll(bs => bs.map(b => b.getAttribute("aria-label") || b.textContent.trim()));
  const distintos = new Set(nombres).size, castores = nombres.filter(n => /P-0631/.test(n) && /CASTORES/.test(n)).length;
  ok("ses-89-los-botones-de-la-cola-dicen-su-orden", nombres.length === 5 && distintos === 5 && castores === 1, `${nombres.length} botones, ${distintos} nombres distintos · ${JSON.stringify(nombres.slice(0, 2))}`);
});
await caso("ses-90-los-importes-dicen-si-llevan-iva", async ({ p, s }) => {
  s.filas = PORTLAND(); s.rpcRespuestas = { list_linkable_invoices_for_oc: F143_F155, get_folio_emitter_enabled: true };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p); await p.waitForTimeout(800);
  const cola = (await texto(p)).replace(/\s+/g, " ");
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(800);
  await p.getByText("OC-0960", { exact: false }).first().click(); await p.waitForTimeout(1500);
  const oc = (await texto(p)).replace(/\s+/g, " ");
  const enCola = /\$11,200\.00 sin IVA/.test(cola), total = /Total sin IVA \$40,000\.00/.test(oc), juntas = /Juntas suman \$46,400\.00 con IVA/.test(oc);
  ok("ses-90-los-importes-dicen-si-llevan-iva", enCola && total && juntas, `la cola: ${enCola} · el total de la OC: ${total} · «Juntas suman … con IVA»: ${juntas}`);
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

// ════════════════════════ «Planta» (v10.84.119) ════════════════════════
// Con la app entera (el banco del plano copia el montaje, aquí va el de verdad): el menú la da sólo a Producción y a Dirección, el módulo
// diferido se baja y pinta las máquinas del plano original, lee sus versiones, y salir con cambios sin guardar pregunta (el navClick de App). Vuelta 1.
// (v10.84.164) cambió por diseño: las del plano original, no un 14 escrito (con las dos manuales son 16; el candado de la 164 frenó aquí)
const PIEZAS_DEL_PLANO = (await import(new URL("../../src/plano/plantaBaja.js", import.meta.url))).MAQUINAS.length;
await caso("ses-91-gerardo-abre-la-planta", async ({ p, s }) => {
  await abrirYEntrar(p, s, "gerardo");
  const hay = await esperarMenu(p, /^Planta$/); await despertar(p);
  await p.locator('button[title="Planta"]').first().click();
  const pinto = await p.locator("[data-plano-lienzo] polygon[data-pieza]").first().waitFor({ timeout: 20000 }).then(() => true, () => false);
  const n = await p.locator("[data-plano-lienzo] polygon[data-pieza]").count();
  const leyo = s.peticiones.some(x => x.m === "GET" && x.ruta === "/rest/v1/plano_versiones");
  // un cambio (girar la PM-74 con R) y salir por el menú: pregunta
  await p.locator('[data-pieza="m-2"]').click({ force: true }); await p.keyboard.press("r"); await p.waitForTimeout(300);
  const estado = (await p.locator("[data-plano-estado]").innerText().catch(() => "")).trim();
  await p.locator('button[title="Entregas"]').first().click(); await p.waitForTimeout(500);
  const pregunta = await p.getByRole("dialog").innerText().catch(() => "");
  await p.getByRole("button", { name: "Seguir aquí" }).click().catch(() => {}); await p.waitForTimeout(300);
  const sigue = await p.locator("[data-plano-lienzo]").count();
  ok("ses-91-gerardo-abre-la-planta", hay && pinto && n === PIEZAS_DEL_PLANO && leyo && /sin guardar/i.test(estado) && /cambios sin guardar/i.test(pregunta) && sigue === 1,
    `Gerardo: «Planta» en el menú ${hay ? "sí" : "NO"}; el plano ${pinto ? "pintó " + n + " piezas" : "NO PINTÓ"}; leyó sus versiones ${leyo ? "sí" : "NO"}; tras girar «${estado}»; salir ${pregunta ? "pregunta" : "NO PREGUNTA"} y «Seguir aquí» ${sigue ? "se queda" : "SALIÓ"}`);
});
for (const [quien, debe] of [["marcelo", true], ["karla", false], ["lupita", false], ["german", false], ["noemi", false], ["genaro", false]]) {
  await caso("ses-92-planta-solo-produccion-y-direccion-" + quien, async ({ p, s }) => {
    await abrirYEntrar(p, s, quien);
    await esperarMenu(p, /^(Dashboard|Pendientes|Tablero|Todas)( \(\d+\))?$/); await despertar(p);
    const hay = await p.locator('button[title="Planta"]').count();
    ok("ses-92-planta-solo-produccion-y-direccion-" + quien, (hay > 0) === debe, `${quien}: «Planta» en el menú ${hay ? "sí" : "no"} (${debe ? "debe estar" : "no debe estar"})`);
  });
}

// ════════════════════════ «Datos Pendientes (N)» (v10.84.136) ════════════════════════
// La decisión de Marcelo del 16-oct: el menú de Lupita y Karla dice cuántas órdenes tienen algo URGENTE por capturar (sin precio, sin cantidad, maquila
// sin proveedor o costo, y sin fecha sólo ya por entregar); la que tiene dos faltas cuenta una vez; sin lectura, sin número. Aquí, porque el menú lo arma
// App. Vuelta 1: escritas antes del cambio.
const enUnMes = () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const ORDENES_DATOS = () => [
  ordenK("P-0920", { stage: "salidas" }),                                                  // por entregar sin fecha: cuenta
  ordenK("P-0921", { stage: "packaging" }),                                                // por entregar sin fecha: cuenta
  ordenK("P-0922", { stage: "design" }),                                                   // sin fecha, todavía en proceso: no cuenta
  ordenK("P-0923", { stage: "ready", due_date: enUnMes(), price: 0 }),                     // sin precio: cuenta
  ordenK("P-0924", { stage: "salidas", price: 0 }),                                        // sin precio y sin fecha: cuenta UNA vez
  ordenK("P-0925", { stage: "in_production", due_date: enUnMes(), client_phone: "" }),     // sin teléfono del cliente: no cuenta
];
const entradaDatos = p => p.evaluate(() => [...document.querySelectorAll("button[title]")].map(b => b.title).filter(t => /^Datos Pendientes( \(\d+\))?$/.test(t)));
for (const [n, quien] of [["ses-93-lupita-datos-pendientes-cuenta-lo-urgente", "lupita"], ["ses-94-karla-datos-pendientes-cuenta-lo-urgente", "karla"]]) {
  await caso(n, async ({ p, s }) => {
    s.filas = { orders: ORDENES_DATOS() };
    await abrirYEntrar(p, s, quien);
    await esperarMenu(p, /^Datos Pendientes/); await despertar(p); await p.waitForTimeout(400);
    const menu = await entradaDatos(p);
    await p.locator('button[title^="Datos Pendientes"]').first().click(); await p.waitForTimeout(700);
    const sub = ((await texto(p)).match(/\d+ (orden|órdenes) con algo urgente por capturar|Nada urgente por capturar/) || [""])[0];
    ok(n, JSON.stringify(menu) === '["Datos Pendientes (4)"]' && sub === "4 órdenes con algo urgente por capturar",
      `${quien}: el menú ${JSON.stringify(menu)} (4: dos por entregar sin fecha, una sin precio y una sin precio y sin fecha; no suman la de diseño sin fecha ni la sin teléfono); la vista: «${sub || "no dice cuántas"}»`);
  });
}
await caso("ses-95-datos-pendientes-sin-lectura-sin-numero", async ({ p, s }) => {
  s.filas = { orders: "falla" };
  await abrirYEntrar(p, s, "lupita");
  const fallo = await esperarFalla(p); await despertar(p);
  const antes = await entradaDatos(p);
  s.filas = { orders: ORDENES_DATOS() };   // la base vuelve
  const reintentar = p.getByRole("button", { name: /^Reintentar/ }).first();
  const hay = await reintentar.isVisible().catch(() => false);
  if (hay) await reintentar.click();
  const llego = await esperarMenu(p, /^Datos Pendientes \(\d+\)$/);
  const despues = await entradaDatos(p);
  ok("ses-95-datos-pendientes-sin-lectura-sin-numero", fallo && JSON.stringify(antes) === '["Datos Pendientes"]' && hay && llego && JSON.stringify(despues) === '["Datos Pendientes (4)"]',
    `con la lectura caída el menú decía ${JSON.stringify(antes)}; ${hay ? "con «Reintentar»" : "SIN «Reintentar»"} dice ${JSON.stringify(despues)}`);
});

// ════════════════════════ lo atrasado (v10.84.140) ════════════════════════
// Marcelo, 16-oct: la orden lista que espera a que el cliente pida su factura «aparece roja»: en «Pendientes de Folio» de Karla (su sección «En espera»)
// y en la vista «En espera». Aquí, porque las dos las arma App. Vuelta 1: escritas antes del cambio.
const haceDias = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const ORDENES_ESPERA = () => [
  ordenK("P-0930", { stage: "salidas", due_date: haceDias(3), snooze_reason: "El cliente aún no ha pedido factura/remisión", snooze_kind: "awaiting_client_invoice",
    snooze_stage: "salidas", snoozed_by: "karla", snoozed_at: haceH(30) }),
  ordenK("P-0931", { stage: "salidas", due_date: haceDias(3) }),   // sin la espera: falta foliar y entregar (sí va en rojo)
];
// (la ficha es la caja MÁS CHICA con su folio y su «Entrega:»: la primera que aparece puede ser la que envuelve también a las otras fichas)
const colorDeLaEntrega = (p, pn) => p.evaluate(pn => { const card = [...document.querySelectorAll("div")].filter(d => d.innerText && d.innerText.includes(pn) && /Entrega:/.test(d.innerText)).sort((a, b) => a.innerText.length - b.innerText.length)[0];
  const linea = card && [...card.querySelectorAll("div")].find(d => /^Entrega:/.test((d.innerText || "").trim())); return linea ? getComputedStyle(linea).color : ""; }, pn);
await caso("ses-96-karla-la-que-espera-al-cliente-no-va-en-rojo", async ({ p, s }) => {
  s.filas = { orders: ORDENES_ESPERA() };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p); await p.waitForTimeout(800);
  const espera = await colorDeLaEntrega(p, "P-0930"), sinEspera = await colorDeLaEntrega(p, "P-0931");
  ok("ses-96-karla-la-que-espera-al-cliente-no-va-en-rojo", !!espera && espera !== "rgb(185, 28, 28)" && sinEspera === "rgb(185, 28, 28)",
    `«Pendientes de Folio»: la fecha de P-0930 (en espera de la factura, vencida hace 3 días) en ${espera || "no sale"}; la de P-0931 (sin la espera) en ${sinEspera || "no sale"} (ésa sí, rojo)`);
});
await caso("ses-97-en-espera-no-dice-vencida", async ({ p, s }) => {
  s.filas = { orders: ORDENES_ESPERA() };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^En espera/); await despertar(p);
  await p.locator('button[title^="En espera"]').first().click(); await p.waitForTimeout(900);
  const t = await texto(p), dice = (t.match(/\d+ vencida/) || [""])[0];
  // (en «En espera» la ficha es la compacta, sin «Entrega:»: su «RETRASO» va junto al folio; P-0930 es la única en espera)
  ok("ses-97-en-espera-no-dice-vencida", /P-0930/.test(t) && !dice && !/RETRASO/.test(t), `la vista «En espera» con P-0930 (espera la factura del cliente): ${dice ? "DICE «" + dice + "»" : "no dice «vencida»"}; ${/RETRASO/.test(t) ? "su ficha DICE «RETRASO»" : /P-0930/.test(t) ? "su ficha sin «RETRASO»" : "P-0930 NO SALE"}`);
});

// ── v10.84.150 (Marcelo, 17-oct: «escojo tus recomendaciones»): «Ya pidió factura» de Karla la regresa a Salidas y abre de una vez «Asignar folio y
//   entregar», con la orden ya reactivada (antes la regresaba y Karla tenía que ir a buscarla a su cola). Si la base no la reactivó, no abre nada; un doble
//   clic reactiva una sola vez; Dirección y lo que ese botón no folia (el re-trabajo cubierto por otro folio), como antes. Escritas antes del arreglo ──
const YA_PIDIO = (x = {}) => ordenK("P-0940", { stage: "salidas", due_date: haceDias(2), snooze_reason: "El cliente aún no ha pedido factura/remisión",
  snooze_kind: "awaiting_client_invoice", snooze_stage: "salidas", snoozed_by: "karla", snoozed_at: haceH(50), ...x });
const abrirEnEspera = async (p, s, quien) => {
  await abrirYEntrar(p, s, quien); await esperarMenu(p, /^En espera/); await despertar(p);
  await p.locator('button[title^="En espera"]').first().click(); await p.waitForTimeout(900);
};
const botonYaPidio = p => p.getByRole("button", { name: /^Ya pidió factura/ }).first();
const etiquetaYaPidio = async p => ((await botonYaPidio(p).innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
const ventanaDeFolio = (p, ms = 4000) => p.locator("#invoice-modal-title").first().waitFor({ timeout: ms }).then(() => true, () => false);
const escriturasA = (s, t0, ruta, m) => s.peticiones.filter(x => x.t >= t0 && x.ruta === ruta && x.m === m).length;
await caso("ses-98-karla-ya-pidio-factura-abre-asignar-folio", async ({ p, s }) => {
  s.filas = { orders: [YA_PIDIO()] };
  await abrirEnEspera(p, s, "karla");
  const etiqueta = await etiquetaYaPidio(p);
  const t0 = Date.now(); await botonYaPidio(p).click();
  const abrio = await ventanaDeFolio(p), patch = escriturasA(s, t0, "/rest/v1/orders", "PATCH");
  ok("ses-98-karla-ya-pidio-factura-abre-asignar-folio", abrio && patch === 1 && /Asignar folio/.test(etiqueta),
    `Karla en «En espera», P-0940 (lista, espera la factura del cliente): el botón dice «${etiqueta}»; al tocarlo, ${patch} reactivación en la base y «Asignar folio y entregar» ${abrio ? "se abre" : "NO se abre (hay que ir a buscarla a su cola)"}`);
});
await caso("ses-99-si-la-base-no-la-reactivo-no-abre-el-folio", async ({ p, s }) => {
  s.filas = { orders: [YA_PIDIO()] };
  await abrirEnEspera(p, s, "karla");
  s.escrituraFalla = "orders";
  await botonYaPidio(p).click();
  const abrio = await ventanaDeFolio(p, 3000), t = await texto(p);
  ok("ses-99-si-la-base-no-la-reactivo-no-abre-el-folio", !abrio && /P-0940/.test(t),
    `la base no guardó la reactivación (503): «Asignar folio y entregar» ${abrio ? "SE ABRE (para una orden que sigue en espera)" : "no se abre"}; P-0940 ${/P-0940/.test(t) ? "sigue en «En espera»" : "ya no sale"}`);
});
await caso("ses-100-doble-clic-reactiva-una-vez", async ({ p, s }) => {
  s.filas = { orders: [YA_PIDIO()] };
  await abrirEnEspera(p, s, "karla");
  const t0 = Date.now(); await botonYaPidio(p).dblclick(); await p.waitForTimeout(2500);
  const patch = escriturasA(s, t0, "/rest/v1/orders", "PATCH"), bitacora = escriturasA(s, t0, "/rest/v1/order_timeline", "POST");
  ok("ses-100-doble-clic-reactiva-una-vez", patch === 1 && bitacora === 1, `doble clic en «Ya pidió factura»: ${patch} reactivaciones en la base y ${bitacora} renglones «🔔 Reactivada» en la bitácora (debe 1 y 1)`);
});
await caso("ses-101-direccion-reactiva-como-antes", async ({ p, s }) => {
  s.filas = { orders: [YA_PIDIO()] };
  await abrirEnEspera(p, s, "marcelo");
  const etiqueta = await etiquetaYaPidio(p);
  const t0 = Date.now(); await botonYaPidio(p).click();
  const abrio = await ventanaDeFolio(p, 3000), patch = escriturasA(s, t0, "/rest/v1/orders", "PATCH");
  ok("ses-101-direccion-reactiva-como-antes", !!etiqueta && patch === 1 && !abrio, `Dirección, «${etiqueta}»: ${patch} reactivación y «Asignar folio y entregar» ${abrio ? "SE ABRE" : "no se abre (como antes: folia Karla)"}`);
});
await caso("ses-102-lo-que-ese-boton-no-folia-sigue-como-antes", async ({ p, s }) => {
  s.filas = { orders: [YA_PIDIO({ return_covered_by_folio: "F-120" })] };
  await abrirEnEspera(p, s, "karla");
  const etiqueta = await etiquetaYaPidio(p);
  const t0 = Date.now(); await botonYaPidio(p).click();
  const abrio = await ventanaDeFolio(p, 3000), patch = escriturasA(s, t0, "/rest/v1/orders", "PATCH");
  ok("ses-102-lo-que-ese-boton-no-folia-sigue-como-antes", !!etiqueta && !/Asignar folio/.test(etiqueta) && patch === 1 && !abrio,
    `P-0940 es un re-trabajo cubierto por F-120 (se entrega sin folio nuevo): el botón dice «${etiqueta}»; ${patch} reactivación; «Asignar folio y entregar» ${abrio ? "SE ABRE (pediría un folio que no lleva)" : "no se abre"}`);
});
// (la otra puerta: «Esperan factura del cliente», al pie de su cola; su botón llamaba directo a reactivar)
await caso("ses-103-desde-su-cola-tambien", async ({ p, s }) => {
  s.filas = { orders: [YA_PIDIO()] };
  await abrirYEntrar(p, s, "karla"); await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(900);
  const etiqueta = await etiquetaYaPidio(p);
  const t0 = Date.now(); await botonYaPidio(p).click();
  const abrio = await ventanaDeFolio(p), patch = escriturasA(s, t0, "/rest/v1/orders", "PATCH");
  ok("ses-103-desde-su-cola-tambien", abrio && patch === 1 && /Asignar folio/.test(etiqueta),
    `Karla en «Pendientes de Folio» («Esperan factura del cliente»): el botón dice «${etiqueta}»; ${patch} reactivación; «Asignar folio y entregar» ${abrio ? "se abre" : "NO se abre"}`);
});

// ── vuelta 2 (v10.84.150): sin precio, Esc con el folio abierto, la maquila recibida ──
await caso("ses-104-sin-precio-pide-el-precio-primero", async ({ p, s }) => {
  s.filas = { orders: [YA_PIDIO({ price: 0 })] };
  await abrirEnEspera(p, s, "karla");
  await botonYaPidio(p).click();
  const precio = await p.locator("#pricecapture-modal-title").first().waitFor({ timeout: 4000 }).then(() => true, () => false);
  ok("ses-104-sin-precio-pide-el-precio-primero", precio, `P-0940 sin precio: «Ya pidió factura» ${precio ? "pide primero el precio (como «Asignar folio y entregar» de siempre)" : "NO pide el precio"}`);
});
await caso("ses-105-esc-cierra-el-folio-y-la-orden-queda-reactivada", async ({ p, s }) => {
  s.filas = { orders: [YA_PIDIO()] };
  await abrirEnEspera(p, s, "karla");
  await botonYaPidio(p).click();
  const abrio = await ventanaDeFolio(p);
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  const sigue = await p.locator("#invoice-modal-title").count(), t = await texto(p);
  ok("ses-105-esc-cierra-el-folio-y-la-orden-queda-reactivada", abrio && !sigue && !/P-0940/.test(t),
    `con «Asignar folio y entregar» ${abrio ? "abierta" : "SIN ABRIR"}, Esc: ${sigue ? "SIGUE abierta" : "se cierra"}; P-0940 ${/P-0940/.test(t) ? "SIGUE en «En espera»" : "ya no está en espera (quedó reactivada, en su cola)"}`);
});
await caso("ses-106-la-maquila-recibida-tambien", async ({ p, s }) => {
  s.filas = { orders: [YA_PIDIO({ stage: "maq_received", order_type: "maquila", price: 0, maq_price: 1450, maq_cost: 800, maq_provider: "PEÑA", snooze_stage: "maq_received" })] };
  await abrirEnEspera(p, s, "karla");
  await botonYaPidio(p).click();
  const abrio = await ventanaDeFolio(p);
  ok("ses-106-la-maquila-recibida-tambien", abrio, `la maquila recibida que esperaba la factura: «Asignar folio y entregar» ${abrio ? "se abre" : "NO se abre"}`);
});

// ── v10.84.158 — EL MARCO (la barra de arriba y el menú), su /impeccable critique (19-oct, 25/40; snapshot .impeccable/critique/2026-10-19T09-25-00Z__…).
//   Escritas antes del arreglo (vuelta 1). En 30 días, el Inventario Cuadra lo movieron Karla y Dirección; Gerardo y Lupita, 0, y en cada pantalla
//   tenían tres botones llenos de color sólo con ícono (Inventario, Corona, CSV), lo más saturado de la pantalla; la paleta se llamaba «Ctrl K». ──
// (vuelta 1: las cuentas de la base simulada son por persona —lupita, gerardo—, no por rol: la primera corrida no pudo ni entrar; era de la prueba)
// la luminancia del fondo de un botón, mezclando los fondos translúcidos con lo de abajo (memoria: contraste con fondos translúcidos)
const herramientas = p => p.evaluate(() => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  return ["Inventario Cuadra", "Apartado Corona", "Exportar CSV"].map(n => { const b = document.querySelector(`button[aria-label^="${n}"]`); if (!b) return { n, hay: false };
    return { n, hay: true, lleno: lum(fondo(b)) < 0.4, texto: b.innerText.replace(/\s+/g, " ").trim() }; });
});
await caso("ses-107-las-herramientas-de-arriba-sin-color-lleno", async ({ p, s }) => {
  await abrirYEntrar(p, s, "lupita"); await despertar(p);
  const h = (await herramientas(p)).filter(x => x.hay);
  const llenas = h.filter(x => x.lleno).map(x => x.n);
  ok("ses-107-las-herramientas-de-arriba-sin-color-lleno", h.length === 3 && llenas.length === 0,
    `Lupita a 1366: ${h.length} herramientas arriba; ${llenas.length ? "LLENAS de color: " + llenas.join(", ") : "ninguna llena de color"}`);
});
await caso("ses-108-las-herramientas-de-arriba-dicen-que-son", async ({ p, s }) => {
  await abrirYEntrar(p, s, "lupita"); await despertar(p);
  const h = (await herramientas(p)).filter(x => x.hay);
  const mudas = h.filter(x => !x.texto).map(x => x.n);
  ok("ses-108-las-herramientas-de-arriba-dicen-que-son", h.length === 3 && mudas.length === 0,
    `Lupita a 1366: ${mudas.length ? "sólo ícono (sin palabra a la vista): " + mudas.join(", ") : "cada una con su palabra: " + h.map(x => "«" + x.texto + "»").join(" ")}`);
});
await caso("ses-109-la-paleta-dice-que-hace", async ({ p, s }) => {
  await abrirYEntrar(p, s, "gerardo"); await despertar(p);
  const t = ((await p.getByRole("button", { name: "Abrir paleta de comandos" }).first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
  ok("ses-109-la-paleta-dice-que-hace", /Ir a/i.test(t), `el botón de la paleta dice «${t}» (se pide que diga qué hace: «Ir a…», con su atajo al lado)`);
});
await caso("ses-110-el-menu-no-anima-su-ancho", async ({ p, s }) => {
  await abrirYEntrar(p, s, "gerardo"); await despertar(p);
  const t = await p.evaluate(() => { const m = [...document.querySelectorAll("div")].find(d => getComputedStyle(d).position === "sticky" && d.querySelector('button[title="Dashboard"]'));
    return m ? getComputedStyle(m).transitionProperty + " / " + getComputedStyle(m).transitionDuration : null; });
  // (vuelta 2: sin transición, el navegador dice «all / 0s», la de omisión; la primera versión tomaba «all» como animación: era de la prueba)
  const anima = t != null && /\bwidth\b|\ball\b/.test(t.split(" / ")[0]) && t.split(" / ")[1].split(",").some(d => parseFloat(d) > 0);
  ok("ses-110-el-menu-no-anima-su-ancho", t != null && !anima, `la transición del menú: ${t ?? "no encontré el menú"} (animar el ancho recalcula toda la página en cada cuadro)`);
});
await caso("ses-111-mis-ordenes-se-lee", async ({ p, s }) => {
  await abrirYEntrar(p, s, "lupita"); await despertar(p);
  const px = await p.evaluate(() => { const b = [...document.querySelectorAll("button:not([title])")].find(x => /^Mis Órdenes$/.test(x.innerText.trim())); return b ? parseFloat(getComputedStyle(b).fontSize) : null; });
  ok("ses-111-mis-ordenes-se-lee", px != null && px >= 11, `«Mis Órdenes | Todas» a ${px ?? "?"} px (se pide 11 o más)`);
});
await caso("ses-112-angosto-sin-palabra-pero-con-nombre", async ({ p, s }) => {
  await abrirYEntrar(p, s, "lupita"); await despertar(p);
  const h = (await herramientas(p)).filter(x => x.hay);
  const sinNombre = await p.evaluate(() => ["Inventario Cuadra", "Apartado Corona", "Exportar CSV"].filter(n => !document.querySelector(`button[aria-label^="${n}"]`)));
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  ok("ses-112-angosto-sin-palabra-pero-con-nombre", h.length === 3 && sinNombre.length === 0 && ancho,
    `a 1024: ${h.length} herramientas con su nombre para el lector de pantalla${sinNombre.length ? "; SIN nombre: " + sinNombre.join(", ") : ""}; la página ${ancho ? "no se sale" : "SE SALE de ancho"}`);
}, { viewport: { width: 1024, height: 768 } });
// ── vuelta 3: por donde no se diseñó: el borde de 1200 px y la barra más llena (Dirección: el sol, la campana, las tres herramientas, «Mis Órdenes») ──
for (const [ancho, conPalabra] of [[1200, true], [1199, false]]) {
  await caso(`ses-113-el-borde-de-1200-a-${ancho}`, async ({ p, s }) => {
    await abrirYEntrar(p, s, "lupita"); await despertar(p);
    const h = (await herramientas(p)).filter(x => x.hay);
    const ok_ = h.length === 3 && h.every(x => conPalabra ? !!x.texto : !x.texto);
    const sale = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    ok(`ses-113-el-borde-de-1200-a-${ancho}`, ok_ && !sale, `a ${ancho}: ${h.map(x => x.n.split(" ")[0] + (x.texto ? " «" + x.texto + "»" : " (sólo ícono)")).join(", ")}; la página ${sale ? "SE SALE de ancho" : "no se sale"}`);
  }, { viewport: { width: ancho, height: 800 } });
}
await caso("ses-114-la-barra-de-direccion-cabe-a-1366", async ({ p, s }) => {
  await abrirYEntrar(p, s, "marcelo"); await despertar(p);
  const r = await p.evaluate(() => {
    const salir = [...document.querySelectorAll("button")].find(b => b.innerText.trim() === "Salir");
    const buscar = document.querySelector('input[placeholder="Buscar orden..."]');
    const rs = salir?.getBoundingClientRect();
    return { sale: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, salir: rs ? rs.right <= innerWidth : false, buscar: buscar ? Math.round(buscar.getBoundingClientRect().width) : null };
  });
  ok("ses-114-la-barra-de-direccion-cabe-a-1366", !r.sale && r.salir && (r.buscar ?? 0) >= 90,
    `Dirección a 1366: la página ${r.sale ? "SE SALE" : "no se sale"}; «Salir» ${r.salir ? "a la vista" : "FUERA de la pantalla"}; el buscador mide ${r.buscar} px (se piden 90 o más)`);
});

// ════════════════════════ el emisor de folios se pregunta CON SESIÓN, en cuanto se entra (v10.84.165) ════════════════════════
// ses-07 salió inestable el 20-oct («como anónima 1»): era la lectura del emisor (`get_folio_emitter_enabled`) que App hacía AL MONTAR, todavía en
// la pantalla de entrar. La base se la niega a anon (siempre, también en producción), así que quien entraba desde cero se quedaba con el emisor
// «apagado» hasta 5 min o hasta cambiar de ventana: sin «Folio de Alpha» (registrar el folio que Alpha ya emitió; sin esa puerta se le acuña uno
// propio y salen dos CFDI de la misma venta, v10.80.8). Lo que DEBE vivir Karla: entra y la puerta está; y una relectura que falla no se la quita.
// Vuelta 1: escritas antes del cambio.
const ORDEN_EN_SALIDAS = () => ({ orders: [ordenK("P-0951", { stage: "salidas", client: "TRANSPORTES CASTORES DE BAJA" })] });
const EMISOR = "/rest/v1/rpc/get_folio_emitter_enabled";
const preguntasAlEmisor = s => s.peticiones.filter(x => x.ruta === EMISOR).length;
// el «Más» del detalle de una orden (por «Todas»; la ficha se abre con Enter): lo que ofrece, en texto
const masDeLaOrden = async (p, pn) => {
  await p.locator('button[title="Todas"]').first().click(); await p.waitForTimeout(800);
  await p.locator(`[role="button"][aria-label^="Orden ${pn}"]`).first().focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(800);
  // (dentro del detalle: la ficha de atrás también tiene su «Más acciones», tapado por la ventana)
  const dlg = p.getByRole("dialog").last();
  await dlg.getByRole("button", { name: "Más acciones", exact: true }).click(); await p.waitForTimeout(300);
  return (await dlg.getByRole("menu", { name: "Más acciones" }).getByRole("menuitem").allInnerTexts().catch(() => [])).map(x => x.replace(/\s+/g, " ").trim());
};
const cerrarTodo = async p => { for (let k = 0; k < 3; k++) { await p.keyboard.press("Escape"); await p.waitForTimeout(250); } };
const conFolioDeAlpha = menu => menu.some(x => /Folio de Alpha/.test(x));
// la persona regresa a la pestaña (el aviso que la app escucha en `document`; el de la librería de Auth es otro, en `window`)
const regresaALaPestana = p => p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

await caso("ses-115-la-pantalla-de-entrar-no-pide-nada", async ({ p, s }) => {
  const e0 = await abrir(p);
  await esperarQuieto(() => s.peticiones.length, 2500, 10000);
  const pedidas = s.peticiones.map(x => x.m + " " + x.ruta.replace("/rest/v1/", "") + " (" + x.quien + ")");
  ok("ses-115-la-pantalla-de-entrar-no-pide-nada", e0 === "login" && pedidas.length === 0,
    `sin nadie adentro, la pantalla de entrar (${e0}) no le pide nada a la base (a lo anónimo la base le contesta «sin permiso»): ${pedidas.length ? pedidas.join(", ") : "nada"}`);
});
await caso("ses-116-karla-entra-y-ya-tiene-folio-de-alpha", async ({ p, s }) => {
  s.filas = ORDEN_EN_SALIDAS(); s.rpcRespuestas = { get_folio_emitter_enabled: true };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  const menu = await masDeLaOrden(p, "P-0951");
  const conSesion = s.peticiones.filter(x => x.ruta === EMISOR && x.quien === "usuario").length;
  ok("ses-116-karla-entra-y-ya-tiene-folio-de-alpha", conFolioDeAlpha(menu),
    `con el sistema emitiendo, Karla entra desde cero y en «Más» de P-0951 (en Salidas, sin folio) «Folio de Alpha» ${conFolioDeAlpha(menu) ? "está" : "NO está"} sin esperar 5 min ni cambiar de ventana; el menú: ${JSON.stringify(menu).slice(0, 200)}; preguntas al emisor con su sesión: ${conSesion}`);
});
await caso("ses-117-una-relectura-que-falla-no-quita-folio-de-alpha", async ({ p, s }) => {
  s.filas = ORDEN_EN_SALIDAS(); s.rpcRespuestas = { get_folio_emitter_enabled: true };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  const antes = await masDeLaOrden(p, "P-0951"); await cerrarTodo(p);
  s.rpcFalla = "get_folio_emitter_enabled";   // la base deja de contestar esa lectura (un 500)
  const n0 = preguntasAlEmisor(s);
  await regresaALaPestana(p);
  const pregunto = await esperarQue(() => preguntasAlEmisor(s) > n0, 5000); await p.waitForTimeout(500);
  const despues = await masDeLaOrden(p, "P-0951");
  ok("ses-117-una-relectura-que-falla-no-quita-folio-de-alpha", conFolioDeAlpha(antes) && pregunto && conFolioDeAlpha(despues),
    `«Folio de Alpha» al entrar: ${conFolioDeAlpha(antes) ? "sí" : "NO"}; al regresar a la pestaña la app ${pregunto ? "volvió a preguntar" : "NO volvió a preguntar"} y la base falló; después: ${conFolioDeAlpha(despues) ? "sigue" : "SE FUE (un error de lectura no es «apagado»)"}`);
});
// por donde no se diseñó: el emisor APAGADO (antes del corte) no ofrece la puerta, y la primera lectura que falla se arregla al volver
await caso("ses-118-emisor-apagado-sin-folio-de-alpha", async ({ p, s }) => {
  s.filas = ORDEN_EN_SALIDAS(); s.rpcRespuestas = { get_folio_emitter_enabled: false };
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  const menu = await masDeLaOrden(p, "P-0951");
  ok("ses-118-emisor-apagado-sin-folio-de-alpha", menu.length > 0 && !conFolioDeAlpha(menu),
    `con el emisor apagado (Alpha folia todo), «Más» de P-0951 ${conFolioDeAlpha(menu) ? "OFRECE «Folio de Alpha»" : "no ofrece «Folio de Alpha»"}; el menú: ${JSON.stringify(menu).slice(0, 200)}`);
});
await caso("ses-119-si-la-primera-lectura-falla-se-arregla-al-volver", async ({ p, s }) => {
  s.filas = ORDEN_EN_SALIDAS(); s.rpcRespuestas = { get_folio_emitter_enabled: true }; s.rpcFalla = "get_folio_emitter_enabled";
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  const antes = await masDeLaOrden(p, "P-0951"); await cerrarTodo(p);
  s.rpcFalla = null;   // la base vuelve
  const n0 = preguntasAlEmisor(s);
  await regresaALaPestana(p);
  const pregunto = await esperarQue(() => preguntasAlEmisor(s) > n0, 5000); await p.waitForTimeout(500);
  const despues = await masDeLaOrden(p, "P-0951");
  ok("ses-119-si-la-primera-lectura-falla-se-arregla-al-volver", !conFolioDeAlpha(antes) && pregunto && conFolioDeAlpha(despues),
    `con la lectura del emisor fallando al entrar, «Folio de Alpha» ${conFolioDeAlpha(antes) ? "SALE (sin saber si el sistema emite)" : "no sale"}; al regresar a la pestaña con la base de vuelta ${pregunto ? "pregunta" : "NO pregunta"} y ${conFolioDeAlpha(despues) ? "ya sale" : "SIGUE SIN SALIR"}`);
});

// ════════════════════════ Hotsson: facturada en su plan POR ADELANTADO, llega a Salidas (v10.84.172) ════════════════════════
// Karla, 3-nov 10:27 (WhatsApp, con dos capturas): «¿Cómo puedo cerrar ya estas órdenes de producción con esas facturas? ¿Por qué me dice esto?».
// OC-0966 de INMOBILIARIA HOTSSON: sus 11 facturas (F-159 a F-169, hechas sin orden en CobranzaFlow) se ligaron en el plan matriz el 14-oct con
// P-0621 y P-0623 todavía en la planta, y llegaron a Salidas el 2-nov. Su ficha ofrece «Marcar como Entregada» (v10.80.19 la abrió con las cuatro
// patas) y al tocarla: «Esta orden no tiene folio fiscal. Usa "Asignar Folio y Entregar"», un botón que ella no tiene; el guardia de la acción se
// quedó con tres (v10.80.13, sin el plan matriz). La base sí la deja (`deliver_only` → `orden_ya_facturada`, las cuatro). Atoradas en Salidas.
// En la misma pantalla, la ficha le ofrecía «El cliente no pide factura», su guía decía «Asigna el folio fiscal… y marca entregada», y la OC
// «Asignar folio» y «Pre-asignar folio» (la base los rechaza: «OC no tiene productos pendientes de facturar»). Lo que DEBE vivir Karla: la ficha la
// entrega, la ventana dice con qué facturas va (sin «folio anticipado» vacío ni «estado de pago no registrado»), la bitácora y los avisos dicen
// su plan (no «folio null»), y nada le ofrece foliar otra vez lo que ya está facturado. Los datos, como en producción el 3-nov.
// Vuelta 1: escritas antes del cambio.
const PLAN_HOTSSON = [   // [folio, piezas y monto sin IVA de P-0621, de P-0623, pago]
  ["F-159", 110, 13435.71, 50, 3958.92, "paid"], ["F-160", 60, 7328.57, 40, 3167.14, "paid"], ["F-161", 50, 6107.14, 30, 2375.35, "paid"],
  ["F-162", 60, 7328.57, 30, 2375.35, "paid"], ["F-163", 92, 11237.14, 30, 2375.35, "paid"], ["F-164", 50, 6107.14, 50, 3958.92, "paid"],
  ["F-165", 50, 6107.14, 50, 3958.92, "paid"], ["F-166", 70, 8550, 30, 2375.35, "paid"], ["F-167", 50, 6107.14, 50, 3958.92, "paid"],
  ["F-168", 50, 6107.14, 50, 3958.92, "paid"], ["F-169", 16, 1954.29, 16, 1266.85, "unpaid"]];
const LIGADO = "2026-10-14T21:26:00Z";
// `etapa`: la de las dos (o { "P-0623": "packaging" }); `sinPlan`: las que NO van en el plan (la OC queda mixta); `extra`: campos por orden; `grupos`: campos por folio
const HOTSSON_PLAN = ({ etapa = "salidas", sinPlan = [], extra = {}, plan = PLAN_HOTSSON, grupos: porFolio = {} } = {}) => {
  const st = pn => typeof etapa === "string" ? etapa : (etapa[pn] || "salidas");
  const o = (pn, x) => ordenK(pn, { stage: st(pn), client: "INMOBILIARIA HOTSSON", client_company: "INMOBILIARIA HOTSSON", client_id: "c3", purchase_order_id: "OC-0966",
    created_by: "genaro", agent: "Genaro", due_date: "2026-11-16", created_at: "2026-10-09T16:00:00Z", ...x, ...(extra[pn] || {}) });
  const orders = [o("P-0621", { product: "AGENDAS 2027 PORTADAS MEDIDA 18.5 X 23 PASTA DURA", product_type: "Agendas", categoria: "libros", price: 80370, quantity: 658 }),
    o("P-0623", { product: "CALENDARIOS 2027 BASE MEDIDA EXT. 41 X 21", product_type: "Calendarios", categoria: "calendarios", price: 33730, quantity: 426 })];
  const enPlan = pn => !sinPlan.includes(pn);
  const groups = plan.map(([folio, , m1, , m2, pago], i) => ({ id: "g-" + (i + 1), purchase_order_id: "OC-0966", position: i + 1, label: null, folio, doc_type: "factura",
    total_amount: Math.round(((enPlan("P-0621") ? m1 : 0) + (enPlan("P-0623") ? m2 : 0)) * 100) / 100, invoice_pre_assigned: false, invoice_reason: null, payment_status: pago,
    invoiced_at: LIGADO, invoiced_by: "karla", cancelled_at: null, cancellation_reason: null, cancelled_by: null, nc_invoice_id: null, created_at: LIGADO,
    bill_to_client_id: null, bill_to_name: null, bill_to_rfc: null, ligada: true, ...(porFolio[folio] || {}) }));   // el renglón completo, como en producción
  const lines = plan.flatMap(([, q1, m1, q2, m2], i) => [
    enPlan("P-0621") && { id: "l-" + (i + 1) + "a", oc_invoice_split_group_id: "g-" + (i + 1), order_id: "OP-P-0621", qty_portion: q1, amount_portion: m1, cancelled_at: null, created_at: LIGADO },
    enPlan("P-0623") && { id: "l-" + (i + 1) + "b", oc_invoice_split_group_id: "g-" + (i + 1), order_id: "OP-P-0623", qty_portion: q2, amount_portion: m2, cancelled_at: null, created_at: LIGADO }]).filter(Boolean);
  return { orders, oc_invoice_split_groups: groups, oc_invoice_split_lines: lines,
    purchase_orders: [{ id: "OC-0966", client: "INMOBILIARIA HOTSSON", client_id: "c3", status: "open", total: 114100, is_simple_oc: false, is_web_oc: false,
      created_at: "2026-10-09T16:00:00Z", created_by: "karla", vendedor: "Genaro" }] };
};
const abrirHotsson = async (p, s, quien = "karla") => {
  await abrirYEntrar(p, s, quien);
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(800);
  await p.getByText("OC-0966", { exact: false }).first().click(); await p.waitForTimeout(1500);
};
const fichaDe = (p, pn) => p.locator(`[role="button"][aria-label^="Orden ${pn},"]`).first();
const entregaDe = (p, pn) => fichaDe(p, pn).getByRole("button", { name: "Marcar como Entregada", exact: true });
const ventanaDeEntrega = p => p.getByRole("dialog", { name: /Marcar como Entregada/ });
const textoDe = async loc => ((await loc.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
// lo que la app escribió (POST) en esa ruta desde t0, renglón por renglón
const escrito = (s, ruta, t0 = 0) => s.peticiones.filter(x => x.t >= t0 && x.m === "POST" && x.ruta === ruta).flatMap(x => Array.isArray(x.cuerpo) ? x.cuerpo : [x.cuerpo || {}]);
const ENTREGA = "/rest/v1/rpc/deliver_only";
// abre la ventana de entrega desde la ficha y confirma (si sale); devuelve lo que dijo la pantalla
const entregarDesdeLaFicha = async (p, s, pn, { confirmar = true } = {}) => {
  const b = entregaDe(p, pn), hay = await b.count();
  if (hay) { await b.click(); await p.waitForTimeout(700); }
  const tras = await texto(p), ventana = await ventanaDeEntrega(p).count(), dice = ventana ? await textoDe(ventanaDeEntrega(p)) : "";
  if (ventana && confirmar) {
    const n0 = escrito(s, ENTREGA).length;
    await ventanaDeEntrega(p).getByRole("button", { name: /Confirmar Entrega/ }).click().catch(() => {});
    await esperarQue(() => escrito(s, ENTREGA).length > n0, 6000); await p.waitForTimeout(1200);
  }
  return { hay, ventana, dice, tras };
};

await caso("ses-120-hotsson-la-ficha-entrega-lo-facturado-en-su-plan", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN();
  await abrirHotsson(p, s);
  const r = await entregarDesdeLaFicha(p, s, "P-0621");
  const rpc = escrito(s, ENTREGA);
  ok("ses-120-hotsson-la-ficha-entrega-lo-facturado-en-su-plan", r.hay === 1 && r.ventana === 1 && !/no tiene folio fiscal/i.test(r.tras) && rpc.length === 1 && rpc[0].p_order_id === "OP-P-0621",
    `«Marcar como Entregada» de P-0621: ${r.hay ? "está" : "NO está"}; al tocarla ${r.ventana ? "abre la ventana de entrega" : /no tiene folio fiscal/i.test(r.tras) ? "dice «" + (r.tras.match(/[^.]*no tiene folio fiscal[^.]*\.[^.]*\./i) || [""])[0].trim() + "» (lo que vio Karla)" : "no abre nada"}; deliver_only: ${rpc.length} vez(es)${rpc[0] ? " con " + rpc[0].p_order_id : ""}`);
});
await caso("ses-121-hotsson-la-ventana-dice-con-que-facturas", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN();
  await abrirHotsson(p, s);
  const r = await entregarDesdeLaFicha(p, s, "P-0621", { confirmar: false });
  const v = r.dice;
  ok("ses-121-hotsson-la-ventana-dice-con-que-facturas", r.ventana === 1 && /plan de la OC-0966/.test(v) && /F-159/.test(v) && /F-169/.test(v) && /658 de 658/.test(v) && /por cobrar/i.test(v)
    && !/Folio anticipado/i.test(v) && !/Estado de pago no registrado/i.test(v) && !/null|undefined|NaN/.test(v),
    `la ventana de P-0621: «${v.slice(0, 420)}»`);
});
await caso("ses-122-hotsson-la-bitacora-y-los-avisos-dicen-su-plan", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN();
  await abrirHotsson(p, s);
  const t0 = Date.now();
  await entregarDesdeLaFicha(p, s, "P-0621");
  await esperarQue(() => escrito(s, "/rest/v1/notifications", t0).length > 0, 6000); await p.waitForTimeout(500);
  const tl = escrito(s, "/rest/v1/order_timeline", t0).map(x => String(x.action || "")).filter(a => /Entregada/.test(a));
  const av = [...new Set(escrito(s, "/rest/v1/notifications", t0).map(x => String(x.message || "")))];
  ok("ses-122-hotsson-la-bitacora-y-los-avisos-dicen-su-plan", tl.length === 1 && /plan de la OC-0966/.test(tl[0]) && !/null|undefined/.test(tl[0])
    && av.length === 1 && /P-0621 entregada/.test(av[0]) && /plan de la OC-0966/.test(av[0]) && !/null|undefined/.test(av[0]),
    `la bitácora: ${JSON.stringify(tl)}; los avisos: ${JSON.stringify(av)}`);
});
await caso("ses-123-hotsson-la-ficha-no-ofrece-no-pide-factura-ni-asignar-folio", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN();
  await abrirHotsson(p, s);
  const f = fichaDe(p, "P-0621");
  const noPide = await f.getByRole("button", { name: /no pide factura/i }).count();
  const asignar = await f.getByRole("button", { name: /Asignar Folio y Entregar/i }).count();
  const guias = await f.locator("[title]").evaluateAll(els => els.map(e => e.getAttribute("title")).filter(t => /folio fiscal|entregada/i.test(t || "")));
  const mas = f.getByRole("button", { name: "Más acciones", exact: true });
  let menu = [];
  if (await mas.count()) { await mas.click(); await p.waitForTimeout(300); menu = (await f.getByRole("menuitem").allInnerTexts().catch(() => [])).map(x => x.replace(/\s+/g, " ").trim()); await p.keyboard.press("Escape"); }
  ok("ses-123-hotsson-la-ficha-no-ofrece-no-pide-factura-ni-asignar-folio", noPide === 0 && asignar === 0 && !menu.some(x => /no pide factura/i.test(x)) && !guias.some(t => /Asigna el folio/i.test(t)),
    `en la ficha de P-0621 (11 facturas en su plan): «El cliente no pide factura» ${noPide}, «Asignar Folio y Entregar» ${asignar}; su «Más»: ${JSON.stringify(menu)}; la guía: ${JSON.stringify(guias)}`);
});
await caso("ses-124-hotsson-el-mas-del-detalle-sin-no-pide-factura", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN();
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  const menu = await masDeLaOrden(p, "P-0621");
  ok("ses-124-hotsson-el-mas-del-detalle-sin-no-pide-factura", menu.length > 0 && !menu.some(x => /no pide factura/i.test(x)),
    `«Más» del detalle de P-0621: ${JSON.stringify(menu).slice(0, 260)}`);
});
await caso("ses-125-hotsson-la-oc-no-ofrece-foliar-lo-ya-facturado", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN(); s.rpcRespuestas = { list_linkable_invoices_for_oc: [] };
  await abrirHotsson(p, s);
  const asignar = await p.getByRole("button", { name: "Asignar folio", exact: true }).count(), pre = await p.getByRole("button", { name: /Pre-asignar folio/ }).count();
  const t = await texto(p), lecturas = s.peticiones.filter(x => x.ruta === "/rest/v1/rpc/list_linkable_invoices_for_oc").length;
  ok("ses-125-hotsson-la-oc-no-ofrece-foliar-lo-ya-facturado", asignar === 0 && pre === 0 && /Productos 2 · 2 facturad/.test(t) && lecturas === 0,
    `OC-0966 con sus 2 órdenes en el plan: «Asignar folio» ${asignar}, «Pre-asignar folio» ${pre}; «${(t.match(/Productos[^A-Z]{0,40}/) || [""])[0].trim()}»; lecturas de facturas sin orden: ${lecturas}`);
});
// la OC mixta: P-0621 en el plan, P-0623 no. La base folia sólo lo que no está facturado (`NOT orden_ya_facturada`): la ventana de la OC lo dice así
await caso("ses-126-oc-mixta-asignar-folio-cuenta-solo-lo-que-falta", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN({ sinPlan: ["P-0623"] }); s.rpcRespuestas = { list_linkable_invoices_for_oc: [], get_folio_emitter_enabled: true };
  await abrirHotsson(p, s);
  const b = p.getByRole("button", { name: "Asignar folio", exact: true }), hay = await b.count();
  if (hay) { await b.first().click(); await p.waitForTimeout(1200); }
  const v = await textoDe(p.getByRole("dialog").last());
  ok("ses-126-oc-mixta-asignar-folio-cuenta-solo-lo-que-falta", hay === 1 && /\b1 por facturar/.test(v) && /33,730\.00/.test(v) && !/114,100\.00/.test(v) && !/2 por facturar/.test(v)
    && /1 ya está facturada: P-0621 en el plan de la OC/.test(v),
    `OC-0966 con P-0621 en el plan y P-0623 sin: «Asignar folio» ${hay}; la ventana: «${v.slice(0, 300)}»`);
});
// pasar a Salidas la última de una OC ya facturada en su plan: no le dice «ya puedes asignar folio a la OC»
await caso("ses-127-hotsson-pasar-a-salidas-no-manda-a-foliar-la-oc", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN({ etapa: { "P-0623": "packaging" } }); s.ordenesSeMueven = true;
  await abrirYEntrar(p, s, "karla");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await p.locator('button[title^="Pendientes"]').first().click(); await p.waitForTimeout(800);
  await p.getByRole("tab", { name: /En la planta/ }).first().click().catch(() => {}); await p.waitForTimeout(600);
  const b = p.locator('[data-orden="OP-P-0623"] button').filter({ hasText: /Pasar/ }), hay = await b.count();
  if (hay) { await b.first().click(); await p.waitForTimeout(500); }
  const pregunta = p.locator('[aria-labelledby="dlg-confirm-titulo"]');
  if (await pregunta.count()) { await pregunta.getByRole("button", { name: /^Sí/ }).first().click().catch(() => {}); }
  const dijo = await p.waitForFunction(() => /ya está en Salidas/.test(document.body.innerText), null, { timeout: 8000, polling: 100 }).then(() => true, () => false);
  const t = await texto(p);
  ok("ses-127-hotsson-pasar-a-salidas-no-manda-a-foliar-la-oc", hay === 1 && dijo && !/asignar folio a OC-0966/i.test(t),
    `«Pasar a Salidas» de P-0623: ${hay}; lo que dijo: «${(t.match(/P-0623[^.]*ya está en Salidas[^.]*\./) || [""])[0]}»`);
});

// ── vuelta 2, por donde no se diseñó: lo de antes sigue igual (folio propio, partes, agrupada), la lectura del plan que falla, la base que rechaza,
//    el doble clic, Esc y el clic afuera, el plan que se cancela con la ventana abierta, 30 facturas (el tope del plan) con un cliente de nombre
//    larguísimo en las dos pantallas de Marcelo, la maquila recibida, otro rol y la OC mixta ──
// tres que se entregan sin folio nuevo, una por cada pata que no es el plan, en la cola de Karla («Pendientes de Folio»)
const TRES_PATAS = () => ({
  orders: [ordenK("P-0960", { stage: "salidas", invoice_folio: "F-9904", invoice_pre_assigned: true, invoice_type: "factura", payment_status: "unpaid", invoiced_by: "karla", invoiced_at: haceH(30) }),
    ordenK("P-0961", { stage: "salidas", price: 5000, quantity: 500 }),
    ordenK("P-0962", { stage: "salidas", grouped_invoice_folio: "F-180" })],
  order_invoice_splits: [
    { id: "sp-1", order_id: "OP-P-0961", position: 1, qty_portion: 300, amount_portion: 3000, doc_type: "factura", invoice_folio: "F-170", invoice_pre_assigned: true, payment_status: "unpaid", cancelled_at: null, cancellation_reason: null, cancelled_by: null, created_at: haceH(40) },
    { id: "sp-2", order_id: "OP-P-0961", position: 2, qty_portion: 200, amount_portion: 2000, doc_type: "por_facturar", invoice_folio: null, invoice_pre_assigned: false, payment_status: null, cancelled_at: null, cancellation_reason: null, cancelled_by: null, created_at: haceH(40) }] });
const entregaEnLaCola = (p, pn) => p.getByRole("button", { name: new RegExp("^Marcar como Entregada · " + pn + "\\b") });
const entregarDesdeLaCola = async (p, s, pn) => {
  await entregaEnLaCola(p, pn).first().click().catch(() => {}); await p.waitForTimeout(700);
  const dice = await textoDe(ventanaDeEntrega(p)), t0 = Date.now();
  await ventanaDeEntrega(p).getByRole("button", { name: /Confirmar Entrega/ }).click().catch(() => {});
  await esperarQue(() => escrito(s, "/rest/v1/notifications", t0).length > 0, 6000); await p.waitForTimeout(400);
  return { dice, tl: escrito(s, "/rest/v1/order_timeline", t0).map(x => String(x.action || "")).filter(a => /Entregada/.test(a)),
    av: [...new Set(escrito(s, "/rest/v1/notifications", t0).map(x => String(x.message || "")))], rpc: escrito(s, ENTREGA, t0).map(x => x.p_order_id) };
};
await caso("ses-128-el-folio-anticipado-se-entrega-como-siempre", async ({ p, s }) => {
  s.filas = TRES_PATAS();
  await abrirYEntrar(p, s, "karla"); await esperarMenu(p, /^Pendientes/); await despertar(p);
  const r = await entregarDesdeLaCola(p, s, "P-0960");
  ok("ses-128-el-folio-anticipado-se-entrega-como-siempre", /Folio anticipado ya asignado/i.test(r.dice) && /F-9904/.test(r.dice) && /Estado de pago: No pagada/.test(r.dice)
    && JSON.stringify(r.rpc) === '["OP-P-0960"]' && r.tl.length === 1 && r.tl[0] === "✅ Entregada (folio F-9904 ya asignado)" && r.av.length === 1 && /folio F-9904 \(anticipado\)/.test(r.av[0]),
    `la ventana: «${r.dice.slice(0, 200)}»; deliver_only ${JSON.stringify(r.rpc)}; la bitácora ${JSON.stringify(r.tl)}; el aviso ${JSON.stringify(r.av)}`);
});
await caso("ses-129-por-partes-dice-sus-partes-y-lo-que-falta", async ({ p, s }) => {
  s.filas = TRES_PATAS();
  await abrirYEntrar(p, s, "karla"); await esperarMenu(p, /^Pendientes/); await despertar(p);
  const r = await entregarDesdeLaCola(p, s, "P-0961");
  ok("ses-129-por-partes-dice-sus-partes-y-lo-que-falta", /Facturada por partes/.test(r.dice) && /F-170/.test(r.dice) && /300 de 500 piezas/.test(r.dice) && /Facturar siguiente parte/.test(r.dice)
    && !/Folio anticipado/i.test(r.dice) && !/null|undefined|NaN/.test(r.dice) && JSON.stringify(r.rpc) === '["OP-P-0961"]'
    && r.tl.length === 1 && /por partes: F-170/.test(r.tl[0]) && r.av.length === 1 && /por partes: F-170/.test(r.av[0]) && !/null/.test(r.tl[0] + r.av[0]),
    `la ventana: «${r.dice.slice(0, 260)}»; la bitácora ${JSON.stringify(r.tl)}; el aviso ${JSON.stringify(r.av)}`);
});
await caso("ses-130-la-agrupada-dice-su-factura", async ({ p, s }) => {
  s.filas = TRES_PATAS();
  await abrirYEntrar(p, s, "karla"); await esperarMenu(p, /^Pendientes/); await despertar(p);
  const r = await entregarDesdeLaCola(p, s, "P-0962");
  ok("ses-130-la-agrupada-dice-su-factura", /factura agrupada F-180/.test(r.dice) && !/Folio anticipado/i.test(r.dice) && !/Estado de pago/.test(r.dice) && !/null|undefined|NaN/.test(r.dice)
    && JSON.stringify(r.rpc) === '["OP-P-0962"]' && r.tl.length === 1 && /factura agrupada F-180/.test(r.tl[0]) && r.av.length === 1 && /factura agrupada F-180/.test(r.av[0]),
    `la ventana: «${r.dice.slice(0, 220)}»; la bitácora ${JSON.stringify(r.tl)}; el aviso ${JSON.stringify(r.av)}`);
});
await caso("ses-131-sin-la-lectura-del-plan-no-ofrece-nada-de-folio", async ({ p, s }) => {
  s.filas = { ...HOTSSON_PLAN(), oc_invoice_split_lines: "falla" }; s.rpcRespuestas = { list_linkable_invoices_for_oc: [] };
  await abrirYEntrar(p, s, "karla"); await esperarMenu(p, /^Pendientes/);
  const aviso = await p.waitForFunction(() => /No se pudo verificar la facturación/.test(document.body.innerText), null, { timeout: 30000, polling: 200 }).then(() => true, () => false);
  await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(800);
  await p.getByText("OC-0966", { exact: false }).first().click(); await p.waitForTimeout(1500);
  const f = fichaDe(p, "P-0621");
  const n = { entregar: await f.getByRole("button", { name: "Marcar como Entregada", exact: true }).count(), foliar: await f.getByRole("button", { name: /Asignar Folio y Entregar/ }).count(),
    noPide: await f.getByRole("button", { name: /no pide factura/i }).count(), oc: await p.getByRole("button", { name: "Asignar folio", exact: true }).count() };
  ok("ses-131-sin-la-lectura-del-plan-no-ofrece-nada-de-folio", aviso && n.entregar === 0 && n.foliar === 0 && n.noPide === 0 && n.oc === 0,
    `con el plan sin leer (aviso: ${aviso ? "sí" : "NO"}), en P-0621 y su OC: ${JSON.stringify(n)} (todo en 0: no se sabe)`);
});
await caso("ses-132-la-base-rechaza-la-entrega", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN(); s.rpcFalla = "deliver_only";
  await abrirHotsson(p, s);
  const t0 = Date.now();
  await entregarDesdeLaFicha(p, s, "P-0621");
  await p.waitForTimeout(800);
  const t = await texto(p), tl = escrito(s, "/rest/v1/order_timeline", t0).filter(x => /Entregada/.test(String(x.action || ""))).length;
  const sigue = await entregaDe(p, "P-0621").count() + (await ventanaDeEntrega(p).count());
  ok("ses-132-la-base-rechaza-la-entrega", /falla de prueba en deliver_only/.test(t) && tl === 0 && sigue > 0 && escrito(s, "/rest/v1/notifications", t0).length === 0,
    `la base rechaza: ${/falla de prueba/.test(t) ? "lo dice" : "NO lo dice"}; bitácora «Entregada» ${tl}; avisos ${escrito(s, "/rest/v1/notifications", t0).length}; P-0621 ${sigue ? "sigue por entregar" : "YA NO SE VE"}`);
});
await caso("ses-133-doble-clic-en-confirmar-entrega-una-vez", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN();
  await abrirHotsson(p, s);
  await entregaDe(p, "P-0621").click().catch(() => {}); await p.waitForTimeout(700);
  // los dos clics en el mismo instante, al mismo botón (el de Playwright pega el segundo donde estaba, y el botón cambia a «Procesando…»)
  await ventanaDeEntrega(p).getByRole("button", { name: /Confirmar Entrega/ }).evaluate(b => { b.click(); b.click(); }).catch(() => {});
  await esperarQuieto(() => escrito(s, ENTREGA).length, 2500, 10000);
  const n = escrito(s, ENTREGA).length, tl = escrito(s, "/rest/v1/order_timeline").filter(x => /Entregada/.test(String(x.action || ""))).length;
  ok("ses-133-doble-clic-en-confirmar-entrega-una-vez", n === 1 && tl === 1, `dos clics en «Confirmar Entrega»: deliver_only ${n} vez(es), bitácora «Entregada» ${tl}`);
});
await caso("ses-134-esc-y-clic-afuera-no-entregan", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN();
  await abrirHotsson(p, s);
  await entregaDe(p, "P-0621").click().catch(() => {}); await p.waitForTimeout(600);
  const abrio1 = await ventanaDeEntrega(p).count();
  await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  const tras1 = await ventanaDeEntrega(p).count();
  await entregaDe(p, "P-0621").click().catch(() => {}); await p.waitForTimeout(600);
  const abrio2 = await ventanaDeEntrega(p).count();
  await p.mouse.click(8, 8); await p.waitForTimeout(500);
  const tras2 = await ventanaDeEntrega(p).count();
  ok("ses-134-esc-y-clic-afuera-no-entregan", abrio1 === 1 && tras1 === 0 && abrio2 === 1 && tras2 === 0 && escrito(s, ENTREGA).length === 0,
    `Esc: abrió ${abrio1}, quedó ${tras1}; clic afuera: abrió ${abrio2}, quedó ${tras2}; deliver_only ${escrito(s, ENTREGA).length}`);
});
await caso("ses-135-el-plan-se-cancela-con-la-ventana-abierta", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN();
  await abrirHotsson(p, s);
  await entregaDe(p, "P-0621").click().catch(() => {}); await p.waitForTimeout(700);
  const antes = await textoDe(ventanaDeEntrega(p));
  // en otra sesión cancelan el plan entero: la recarga trae sus facturas y sus líneas canceladas
  const ya = "2026-11-03T17:00:00Z";
  s.filas = { ...s.filas, oc_invoice_split_groups: s.filas.oc_invoice_split_groups.map(g => ({ ...g, cancelled_at: ya })), oc_invoice_split_lines: s.filas.oc_invoice_split_lines.map(l => ({ ...l, cancelled_at: ya })) };
  await regresaALaPestana(p);
  const dice = await p.waitForFunction(() => /Ya no está facturada/.test(document.body.innerText), null, { timeout: 10000, polling: 200 }).then(() => true, () => false);
  const b = ventanaDeEntrega(p).getByRole("button", { name: /Confirmar Entrega/ });
  const apagado = await b.isDisabled().catch(() => false);
  await b.click({ force: true, timeout: 2000 }).catch(() => {}); await p.waitForTimeout(800);
  ok("ses-135-el-plan-se-cancela-con-la-ventana-abierta", /plan de la OC-0966/.test(antes) && dice && apagado && escrito(s, ENTREGA).length === 0,
    `al abrir: ${/plan de la OC-0966/.test(antes) ? "su plan" : "«" + antes.slice(0, 80) + "»"}; cancelado el plan, la ventana ${dice ? "dice «Ya no está facturada»" : "NO lo dice"}; «Confirmar Entrega» ${apagado ? "apagado" : "PRENDIDO"}; deliver_only ${escrito(s, ENTREGA).length}`);
});
// 30 facturas, el tope del plan (v10.84.107), y el cliente de nombre más largo: la ventana cabe y su botón se ve, a 1366 y a 1920
const PLAN_30 = Array.from({ length: 30 }, (_, i) => ["F-" + (300 + i), i < 28 ? 22 : 21, i < 28 ? 2687.14 : 2565.04, i < 6 ? 15 : 14, i < 6 ? 1187.68 : 1108.46, i % 3 ? "paid" : "unpaid"]);
await caso("ses-136-treinta-facturas-y-nombre-largo-en-las-dos-pantallas", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN({ plan: PLAN_30, extra: { "P-0621": { client: LARGO } } });
  await abrirHotsson(p, s);
  const medir = () => p.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].find(x => /Marcar como Entregada/.test(x.textContent || ""));
    if (!d) return null;
    const b = [...d.querySelectorAll("button")].find(x => /Confirmar Entrega/.test(x.textContent || "")), r = b ? b.getBoundingClientRect() : null;
    return { boton: !!r && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, ancho: d.scrollWidth <= d.clientWidth + 1, pagina: document.documentElement.scrollWidth <= innerWidth + 1,
      facturas: d.querySelectorAll('[role="listitem"]').length };
  });
  await entregaDe(p, "P-0621").click().catch(() => {}); await p.waitForTimeout(700);
  const a1366 = await medir(), dice = await textoDe(ventanaDeEntrega(p));
  await p.setViewportSize({ width: 1920, height: 1080 }); await p.waitForTimeout(500);
  const a1920 = await medir();
  const bien = m => !!m && m.boton && m.ancho && m.pagina && m.facturas === 30;
  ok("ses-136-treinta-facturas-y-nombre-largo-en-las-dos-pantallas", bien(a1366) && bien(a1920) && /30 facturas/.test(dice) && /658 de 658/.test(dice) && /10 por cobrar/.test(dice),
    `a 1366: ${JSON.stringify(a1366)}; a 1920: ${JSON.stringify(a1920)}; «${dice.slice(0, 160)}»`);
});
await caso("ses-137-la-maquila-recibida-del-plan-se-entrega", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN({ etapa: { "P-0623": "maq_received" }, extra: { "P-0623": { order_type: "maquila", maq_price: 33730, maq_cost: 21000, maquila_provider: "SERIGRAFÍA LÓPEZ" } } });
  await abrirHotsson(p, s);
  const r = await entregarDesdeLaFicha(p, s, "P-0623");
  const rpc = escrito(s, ENTREGA);
  ok("ses-137-la-maquila-recibida-del-plan-se-entrega", r.hay === 1 && r.ventana === 1 && /plan de la OC-0966/.test(r.dice) && /426 de 426/.test(r.dice) && rpc.length === 1 && rpc[0].p_order_id === "OP-P-0623",
    `P-0623 (maquila recibida): «Marcar como Entregada» ${r.hay}; ventana ${r.ventana} «${r.dice.slice(0, 140)}»; deliver_only ${rpc.length}`);
});
await caso("ses-138-lupita-no-entrega-lo-del-plan", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN(); s.rpcRespuestas = { list_linkable_invoices_for_oc: [] };
  await abrirHotsson(p, s, "lupita");
  const n = { entregar: await p.getByRole("button", { name: "Marcar como Entregada", exact: true }).count(), foliar: await p.getByRole("button", { name: /Asignar Folio y Entregar/ }).count(),
    noPide: await p.getByRole("button", { name: /no pide factura/i }).count() };
  ok("ses-138-lupita-no-entrega-lo-del-plan", n.entregar === 0 && n.foliar === 0 && n.noPide === 0, `Lupita en OC-0966: ${JSON.stringify(n)} (es de Karla y Dirección)`);
});
// la OC mixta: P-0621 en el plan, P-0623 no. Lo que falta es P-0623 (con IVA, $39,126.80): el aviso de las facturas sin orden lo compara con eso, y cada
//   ficha ofrece lo suyo (P-0623 se folia y puede esperar al cliente; P-0621 sólo se entrega)
await caso("ses-139-oc-mixta-cada-ficha-lo-suyo-y-lo-que-falta", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN({ sinPlan: ["P-0623"] });
  s.rpcRespuestas = { list_linkable_invoices_for_oc: [{ doc_number: "F-171", doc_type: "factura", amount: 39126.80, issued_date: "2026-11-01", dias_sin_orden: 2, monto_cuadra: false }] };
  await abrirHotsson(p, s);
  const aviso = ((await p.locator("[data-sin-orden-de-la-oc]").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const f1 = fichaDe(p, "P-0621"), f3 = fichaDe(p, "P-0623");
  const n = { p0621: { entregar: await f1.getByRole("button", { name: "Marcar como Entregada", exact: true }).count(), noPide: await f1.getByRole("button", { name: /no pide factura/i }).count() },
    p0623: { foliar: await f3.getByRole("button", { name: /Asignar Folio y Entregar/ }).count(), noPide: await f3.getByRole("button", { name: /no pide factura/i }).count() } };
  ok("ses-139-oc-mixta-cada-ficha-lo-suyo-y-lo-que-falta", /F-171/.test(aviso) && /justo lo que falta/.test(aviso) && n.p0621.entregar === 1 && n.p0621.noPide === 0 && n.p0623.foliar === 1 && n.p0623.noPide === 1,
    `el aviso: «${aviso.slice(0, 200)}»; las fichas: ${JSON.stringify(n)}`);
});

// ════════════════════════ La factura ligada se ve ligada (v10.84.173) ════════════════════════
// 3-nov, en la captura de Karla: las 11 facturas de Hotsson sin su etiqueta «LIGADA». `reload` no pedía la columna `ligada` (ni `bill_to_name`), así que la vista del
// plan y su ventana nunca la vieron en producción (13 ligadas: OC-0960 y OC-0966): a Dirección le ofrecían «Cancelar factura» y le decían «se cancela en CobranzaFlow,
// con saldo 0», cuando la base sólo la desliga (ni la cancela ni toca sus cobros). El banco del plan le da `ligada` por props, por eso pasaba; aquí va la lectura de verdad.
// Vuelta 1: escritas antes del cambio.
const CANCELA_GRUPO = "/rest/v1/rpc/cancel_oc_invoice_split_group";
const RESPUESTAS_PLAN = { list_linkable_invoices_for_oc: [], cancel_oc_invoice_split_group: { oc_id: "OC-0966", doc_type: "factura", lines_cancelled: 2 } };
const grupoDelPlan = p => p.getByRole("button", { name: /^(Desligar|Cancelar) factura$/ });
const ventanaDelPlan = p => p.locator('[role="dialog"][aria-labelledby="dlg-cancelar-matriz-titulo"]');
const motivoDelPlan = p => p.locator("#cancelar-matriz-motivo");
const confirmarDelPlan = (p, folio) => ventanaDelPlan(p).getByRole("button", { name: new RegExp("^(Desligar|Cancelar) " + folio + "( y sus \\d+ líneas| y su línea)?$") });
const delPlan = async p => ({ ligadas: await p.getByText("LIGADA · ya existía", { exact: true }).count(), desligar: await p.getByRole("button", { name: "Desligar factura", exact: true }).count(),
  cancelar: await p.getByRole("button", { name: "Cancelar factura", exact: true }).count(), lineas: await p.locator('button[title^="Saca esta orden de la factura"]').count() });
// lo que deja la base al desligar: la factura y sus líneas con cancelled_at, y `ligada` se queda
const conDesligadas = (f, folios) => {
  const ya = "2026-11-03T17:00:00Z", motivo = "Se ligó la factura equivocada", ids = new Set(f.oc_invoice_split_groups.filter(g => folios.includes(g.folio)).map(g => g.id));
  return { ...f, oc_invoice_split_groups: f.oc_invoice_split_groups.map(g => ids.has(g.id) ? { ...g, cancelled_at: ya, cancellation_reason: motivo, cancelled_by: "marcelo" } : g),
    oc_invoice_split_lines: f.oc_invoice_split_lines.map(l => ids.has(l.oc_invoice_split_group_id) ? { ...l, cancelled_at: ya, cancellation_reason: "Grupo cancelado: " + motivo, cancelled_by: "marcelo" } : l) };
};
for (const quien of ["karla", "lupita"]) await caso(`ses-140-ligadas-${quien}-las-ve-ligadas-sin-botones`, async ({ p, s }) => {
  s.filas = HOTSSON_PLAN(); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, quien);
  const n = await delPlan(p);
  ok(`ses-140-ligadas-${quien}-las-ve-ligadas-sin-botones`, n.ligadas === 11 && n.desligar === 0 && n.cancelar === 0 && n.lineas === 0, `${quien} en OC-0966: ${JSON.stringify(n)} (11 ligadas y sin botones: desligar es de Dirección)`);
});
await caso("ses-141-ligadas-direccion-desliga-no-cancela", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN(); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  const n = await delPlan(p);
  ok("ses-141-ligadas-direccion-desliga-no-cancela", n.ligadas === 11 && n.desligar === 11 && n.cancelar === 0 && n.lineas === 0, `Dirección en OC-0966: ${JSON.stringify(n)} (a una ligada no se le quita un renglón)`);
});
await caso("ses-142-ligada-la-ventana-dice-que-se-desliga", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN(); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  await grupoDelPlan(p).last().click(); await p.waitForTimeout(500);
  const v = await textoDe(ventanaDelPlan(p));
  ok("ses-142-ligada-la-ventana-dice-que-se-desliga", /Desligar F-169 del plan de OC-0966/.test(v) && /F-169 no se cancela/.test(v) && /sin orden de producción/.test(v) && /Por qué se desliga/.test(v) && /Desligar F-169 y sus 2 líneas/.test(v)
    && !/se cancela en CobranzaFlow/.test(v) && !/saldo 0/.test(v) && !/timbrada ante el SAT/.test(v) && !/No se deshace/.test(v) && !/Por qué se cancela/.test(v), `la ventana dice: «${v.slice(0, 420)}»`);
});
await caso("ses-143-desligar-llama-a-la-base-y-dice-desligada", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN(); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  await grupoDelPlan(p).last().click(); await p.waitForTimeout(500);
  await motivoDelPlan(p).fill("Se ligó la factura equivocada");
  s.filas = conDesligadas(s.filas, ["F-169"]);   // lo que hace la base: la recarga ya la trae desligada
  await confirmarDelPlan(p, "F-169").click();
  await esperarQue(() => escrito(s, CANCELA_GRUPO).length > 0, 6000); await p.waitForTimeout(900);
  const rpc = escrito(s, CANCELA_GRUPO), t = await texto(p), sigue = await ventanaDelPlan(p).count(), n = await delPlan(p);
  ok("ses-143-desligar-llama-a-la-base-y-dice-desligada", rpc.length === 1 && rpc[0].p_group_id === "g-11" && /equivocada/.test(rpc[0].p_reason) && /F-169 desligada/.test(t) && !/F-169 cancelada/.test(t) && sigue === 0 && n.desligar === 10,
    `RPC ${rpc.length} (${rpc[0]?.p_group_id}); ventana abierta ${sigue}; aviso: ${(t.match(/F-169 [a-z]+[^.]{0,60}/) || ["ninguno"])[0]}; ${JSON.stringify(n)}`);
});
await caso("ses-144-la-desligada-no-dice-cancelada", async ({ p, s }) => {
  s.filas = conDesligadas(HOTSSON_PLAN(), ["F-169"]); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  const n = await delPlan(p), t = await texto(p), c = { desligada: await p.getByText("DESLIGADA", { exact: true }).count(), cancelada: await p.getByText("CANCELADA", { exact: true }).count(),
    enLineas: await p.getByText("(desligada)", { exact: true }).count(), lineasCanceladas: await p.getByText("(cancelada)", { exact: true }).count() };
  const r = await entregarDesdeLaFicha(p, s, "P-0621", { confirmar: false });
  ok("ses-144-la-desligada-no-dice-cancelada", n.ligadas === 10 && n.desligar === 10 && c.desligada === 1 && c.cancelada === 0 && c.enLineas === 2 && c.lineasCanceladas === 0 && /10 facturas del plan/.test(t) && /· 1 desligada/.test(t) && !/· 1 cancelada/.test(t)
    && /10 facturas/.test(r.dice) && !/F-169/.test(r.dice), `${JSON.stringify(n)} ${JSON.stringify(c)}; la ventana de entrega: «${r.dice.slice(0, 120)}»`);
});
// la de control: pasa antes y después del cambio. La que no se ligó sigue siendo «Cancelar», con lo que eso hace
await caso("ses-145-la-que-no-se-ligo-se-cancela-como-siempre", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN({ plan: PLAN_HOTSSON.slice(0, 2), grupos: { "F-159": { ligada: false }, "F-160": { ligada: false } } }); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  const n = await delPlan(p);
  await grupoDelPlan(p).last().click(); await p.waitForTimeout(500);
  const v = await textoDe(ventanaDelPlan(p));
  await motivoDelPlan(p).fill("El cliente canceló el pedido");
  await confirmarDelPlan(p, "F-160").click();
  await esperarQue(() => escrito(s, CANCELA_GRUPO).length > 0, 6000); await p.waitForTimeout(900);
  const t = await texto(p);
  ok("ses-145-la-que-no-se-ligo-se-cancela-como-siempre", n.cancelar === 2 && n.desligar === 0 && n.lineas === 4 && n.ligadas === 0 && /Cancelar F-160 del plan de OC-0966/.test(v) && /se cancela en CobranzaFlow/.test(v) && /No se deshace/.test(v) && /Por qué se cancela/.test(v)
    && !/sin orden de producción/.test(v) && /F-160 cancelada/.test(t), `${JSON.stringify(n)}; la ventana: «${v.slice(0, 240)}»; el aviso: ${(t.match(/F-160 [a-z]+[^.]{0,40}/) || ["ninguno"])[0]}`);
});
await caso("ses-146-cada-factura-del-plan-lo-suyo", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN({ plan: PLAN_HOTSSON.slice(0, 3), grupos: { "F-160": { ligada: false }, "F-161": { ligada: null } } }); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  const n = await delPlan(p);
  ok("ses-146-cada-factura-del-plan-lo-suyo", n.ligadas === 1 && n.desligar === 1 && n.cancelar === 2 && n.lineas === 4, `F-159 ligada, F-160 no, F-161 sin dato: ${JSON.stringify(n)}`);
});
await caso("ses-147-el-tercero-que-paga-se-ve", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN({ plan: PLAN_HOTSSON.slice(0, 3), grupos: { "F-160": { ligada: false, bill_to_client_id: "c9", bill_to_name: "Aleksandra Wiśniewska-Kowalczyk", bill_to_rfc: "XAXX010101000" },
    "F-161": { ligada: false, bill_to_client_id: "c10", bill_to_name: "نور الهدى عبد الرحمن", bill_to_rfc: "XAXX010101000" } } }); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s);
  const t = await p.locator("[data-tercero]").allInnerTexts();
  ok("ses-147-el-tercero-que-paga-se-ve", t.length === 2 && /Paga: Aleksandra Wiśniewska-Kowalczyk \(tercero\)/.test(t[0]) && /نور الهدى عبد الرحمن/.test(t[1]), `«Paga»: ${JSON.stringify(t)}`);
});
await caso("ses-148-la-base-no-deja-desligar", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN(); s.rpcRespuestas = RESPUESTAS_PLAN; s.rpcFalla = "cancel_oc_invoice_split_group";
  await abrirHotsson(p, s, "marcelo");
  await grupoDelPlan(p).last().click(); await p.waitForTimeout(500);
  await motivoDelPlan(p).fill("Se ligó la factura equivocada");
  await confirmarDelPlan(p, "F-169").click();
  await p.waitForFunction(() => /la base no lo aceptó/.test(document.body.innerText), null, { timeout: 8000, polling: 200 }).catch(() => {});   // (`motivoDeLaBase`: lo técnico no se enseña)
  const v = await textoDe(ventanaDelPlan(p)), valor = await motivoDelPlan(p).inputValue().catch(() => ""), t = await texto(p);
  ok("ses-148-la-base-no-deja-desligar", /No se desligó F-169: la base no lo aceptó/.test(v) && !/No se canceló/.test(v) && valor === "Se ligó la factura equivocada" && !/F-169 desligada/.test(t),
    `la ventana: «${v.slice(-170)}»; el motivo se queda: «${valor}»`);
});
await caso("ses-149-doble-clic-en-desligar-una-vez", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN(); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  await grupoDelPlan(p).last().click(); await p.waitForTimeout(500);
  await motivoDelPlan(p).fill("Se ligó la factura equivocada");
  await confirmarDelPlan(p, "F-169").evaluate(b => { b.click(); b.click(); }).catch(() => {});
  await esperarQuieto(() => escrito(s, CANCELA_GRUPO).length, 2500, 10000);
  ok("ses-149-doble-clic-en-desligar-una-vez", escrito(s, CANCELA_GRUPO).length === 1, `dos clics al confirmar: cancel_oc_invoice_split_group ${escrito(s, CANCELA_GRUPO).length} vez(es)`);
});
await caso("ses-150-esc-y-clic-afuera-con-motivo-no-desligan", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN(); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  await grupoDelPlan(p).last().click(); await p.waitForTimeout(700);
  await motivoDelPlan(p).fill("Se ligó la factura equivocada");
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  const pregunta = await texto(p);
  await p.getByRole("button", { name: "Seguir aquí", exact: true }).click().catch(() => {}); await p.waitForTimeout(400);
  const valor = await motivoDelPlan(p).inputValue().catch(() => "");
  await p.mouse.click(4, 400); await p.waitForTimeout(400);
  const cerrar = p.getByRole("button", { name: /^Cerrar sin (desligar|cancelar)$/ }), preguntaAfuera = await cerrar.count();
  await cerrar.click().catch(() => {}); await p.waitForTimeout(400);
  ok("ses-150-esc-y-clic-afuera-con-motivo-no-desligan", /¿Cerrar sin desligar\?/.test(pregunta) && /No se desliga nada/.test(pregunta) && !/sin cancelar/.test(pregunta) && valor === "Se ligó la factura equivocada" && preguntaAfuera === 1
    && await ventanaDelPlan(p).count() === 0 && escrito(s, CANCELA_GRUPO).length === 0, `Esc: «${(pregunta.match(/¿Cerrar[^?]*\?[^.]*\.[^.]*\./) || ["sin pregunta"])[0]}»; el motivo sigue: «${valor}»; clic afuera pregunta ${preguntaAfuera}; RPC ${escrito(s, CANCELA_GRUPO).length}`);
});
await caso("ses-151-se-desliga-en-otra-sesion-con-la-ventana-abierta", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN(); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  await grupoDelPlan(p).last().click(); await p.waitForTimeout(500);
  s.filas = conDesligadas(s.filas, ["F-169"]);
  await regresaALaPestana(p);
  const llego = await p.waitForFunction(() => /en otra sesión/.test(document.body.innerText), null, { timeout: 10000, polling: 200 }).then(() => true, () => false);
  const v = await textoDe(ventanaDelPlan(p)), b = confirmarDelPlan(p, "F-169"), apagado = await b.isDisabled().catch(() => false);
  await b.click({ force: true, timeout: 2000 }).catch(() => {}); await p.waitForTimeout(600);
  ok("ses-151-se-desliga-en-otra-sesion-con-la-ventana-abierta", llego && /se desligó en otra sesión/.test(v) && /Ya está desligada/.test(v) && !/se canceló/.test(v) && !/0 líneas/.test(v) && apagado && escrito(s, CANCELA_GRUPO).length === 0,
    `la ventana: «${v.slice(0, 300)}»; confirmar ${apagado ? "apagado" : "PRENDIDO"}; RPC ${escrito(s, CANCELA_GRUPO).length}`);
});
// lo raro de la lista de break-ui, por la base: una etiqueta y un tercero sin dónde cortar, en las dos pantallas de Marcelo
await caso("ses-152-el-plan-ligado-cabe-en-las-dos-pantallas", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN({ grupos: { "F-159": { label: "IMG_20250914_183022_HDR_portrait_edited_edited.HEIC".repeat(4), bill_to_client_id: "c9", bill_to_name: "IMG_20250914_183022_HDR_portrait_edited_edited.HEIC".repeat(6) } } }); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  const medir = async () => {
    await grupoDelPlan(p).last().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(300);
    return p.evaluate(() => {
      const botones = [...document.querySelectorAll("button")].filter(b => b.innerText.trim() === "Desligar factura"), ult = botones[botones.length - 1], r = ult?.getBoundingClientRect();
      const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      const raros = [...document.querySelectorAll("span,div")].filter(e => !e.children.length && /IMG_2025/.test(e.textContent)).concat([...document.querySelectorAll("[data-tercero]")]);
      const seSalen = raros.filter(e => { const card = e.closest('div[style*="border-radius: 8px"]'), q = document.createRange(); q.selectNodeContents(e); return card && q.getBoundingClientRect().right > card.getBoundingClientRect().right + 1; }).length;   // el texto, no su caja
      return { botones: botones.length, fuera: botones.filter(b => { const q = b.getBoundingClientRect(); return q.left < 0 || q.right > innerWidth; }).length, seVe: !!hit && (hit === ult || !!ult?.contains(hit)),
        raros: raros.length, seSalen, pagina: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    });
  };
  // su ventana también: el botón de confirmar se ve (lo que tapa o recorta, el renglón de hasta abajo)
  const medirVentana = async () => {
    await grupoDelPlan(p).last().click(); await p.waitForTimeout(400);
    const r = await confirmarDelPlan(p, "F-169").evaluate(b => { const q = b.getBoundingClientRect(), hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !!hit && (hit === b || b.contains(hit)) && q.bottom <= innerHeight; }).catch(() => false);
    await ventanaDelPlan(p).getByRole("button", { name: "Volver", exact: true }).click().catch(() => {}); await p.waitForTimeout(300);
    return r;
  };
  const a1366 = await medir(), v1366 = await medirVentana();
  await p.setViewportSize({ width: 1920, height: 1080 }); await p.waitForTimeout(400);
  const a1920 = await medir(), v1920 = await medirVentana();
  const bien = a => a.botones === 11 && a.fuera === 0 && a.seVe && a.raros >= 2 && a.seSalen === 0 && !a.pagina;
  ok("ses-152-el-plan-ligado-cabe-en-las-dos-pantallas", bien(a1366) && bien(a1920) && v1366 && v1920, `1366: ${JSON.stringify(a1366)}, ventana ${v1366} · 1920: ${JSON.stringify(a1920)}, ventana ${v1920}`);
});
// la lectura de las facturas del plan se cae y la de sus líneas no: se sabe que hay plan, no con qué facturas. Nada de foliar ni de entregar «con 0 facturas»: se avisa
await caso("ses-153-sin-leer-las-facturas-del-plan-no-ofrece-nada-de-folio", async ({ p, s }) => {
  s.filas = { ...HOTSSON_PLAN(), oc_invoice_split_groups: "falla" }; s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirYEntrar(p, s, "karla"); await esperarMenu(p, /^Pendientes/);
  const aviso = await p.waitForFunction(() => /No se pudo verificar la facturación/.test(document.body.innerText), null, { timeout: 30000, polling: 200 }).then(() => true, () => false);
  await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(800);
  await p.getByText("OC-0966", { exact: false }).first().click(); await p.waitForTimeout(1500);
  const f = fichaDe(p, "P-0621");
  const n = { entregar: await f.getByRole("button", { name: "Marcar como Entregada", exact: true }).count(), foliar: await f.getByRole("button", { name: /Asignar Folio y Entregar/ }).count(),
    noPide: await f.getByRole("button", { name: /no pide factura/i }).count(), oc: await p.getByRole("button", { name: "Asignar folio", exact: true }).count() };
  ok("ses-153-sin-leer-las-facturas-del-plan-no-ofrece-nada-de-folio", aviso && n.entregar === 0 && n.foliar === 0 && n.noPide === 0 && n.oc === 0,
    `con las facturas del plan sin leer (aviso: ${aviso ? "sí" : "NO"}), en P-0621 y su OC: ${JSON.stringify(n)} (todo en 0: no se sabe)`);
});
// todas desligadas: la orden ya no está facturada, así que le toca su folio; el plan lo cuenta como desligadas, no canceladas
await caso("ses-154-toda-desligada-la-orden-vuelve-a-por-facturar", async ({ p, s }) => {
  s.filas = conDesligadas(HOTSSON_PLAN(), PLAN_HOTSSON.map(x => x[0])); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s);
  const f = fichaDe(p, "P-0621"), t = await texto(p);
  const n = { entregar: await f.getByRole("button", { name: "Marcar como Entregada", exact: true }).count(), foliar: await f.getByRole("button", { name: /Asignar Folio y Entregar/ }).count(),
    desligadas: await p.getByText("DESLIGADA", { exact: true }).count(), canceladas: await p.getByText("CANCELADA", { exact: true }).count() };
  ok("ses-154-toda-desligada-la-orden-vuelve-a-por-facturar", n.entregar === 0 && n.foliar === 1 && n.desligadas === 11 && n.canceladas === 0 && /· 11 desligadas/.test(t) && !/11 canceladas/.test(t), JSON.stringify(n));
});
// ── vuelta 2: por donde no se diseñó ──
// se cae la lectura de las facturas y vuelve: lo que se cerró por no saber regresa solo, sin F5
await caso("ses-155-la-lectura-de-las-facturas-vuelve-y-se-puede-entregar", async ({ p, s }) => {
  const bien = HOTSSON_PLAN();
  s.filas = { ...bien, oc_invoice_split_groups: "falla" }; s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirYEntrar(p, s, "karla"); await esperarMenu(p, /^Pendientes/);
  await p.waitForFunction(() => /No se pudo verificar la facturación/.test(document.body.innerText), null, { timeout: 30000, polling: 200 }).catch(() => {});
  await despertar(p);
  await p.locator('button[title^="Órdenes de Compra"]').first().click(); await p.waitForTimeout(800);
  await p.getByText("OC-0966", { exact: false }).first().click(); await p.waitForTimeout(1500);
  const antes = await entregaDe(p, "P-0621").count();
  s.filas = bien;
  await regresaALaPestana(p);
  const volvio = await entregaDe(p, "P-0621").waitFor({ timeout: 15000 }).then(() => true, () => false);
  const n = await delPlan(p);
  ok("ses-155-la-lectura-de-las-facturas-vuelve-y-se-puede-entregar", antes === 0 && volvio && n.ligadas === 11, `caída: «Marcar como Entregada» ${antes}; de vuelta: ${volvio ? "sí" : "NO"}, ${JSON.stringify(n)}`);
});
// una remisión ligada de un solo renglón: sin IVA, «y su línea» (no «sus 1 líneas») y «(1 línea)»
await caso("ses-156-la-remision-ligada-de-una-linea", async ({ p, s }) => {
  s.filas = HOTSSON_PLAN({ plan: [["R-0456", 110, 13435.71, 50, 3958.92, "unpaid"]], sinPlan: ["P-0623"], grupos: { "R-0456": { doc_type: "remision" } } });
  s.rpcRespuestas = { ...RESPUESTAS_PLAN, cancel_oc_invoice_split_group: { oc_id: "OC-0966", doc_type: "remision", lines_cancelled: 1 } };
  await abrirHotsson(p, s, "marcelo");
  await grupoDelPlan(p).last().click(); await p.waitForTimeout(500);
  const v = await textoDe(ventanaDelPlan(p));
  await motivoDelPlan(p).fill("Se ligó la remisión equivocada");
  await confirmarDelPlan(p, "R-0456").click();
  await esperarQue(() => escrito(s, CANCELA_GRUPO).length > 0, 6000); await p.waitForTimeout(900);
  const t = await texto(p);
  ok("ses-156-la-remision-ligada-de-una-linea", /Desligar R-0456 del plan/.test(v) && /Desligar R-0456 y su línea/.test(v) && /con su línea/.test(v) && !/sus 1 líneas/.test(v) && !/con IVA/.test(v) && /R-0456 desligada del plan \(1 línea\)/.test(t),
    `la ventana: «${v.slice(0, 200)}»; el aviso: ${(t.match(/R-0456 [a-z]+[^.]{0,50}/) || ["ninguno"])[0]}`);
});
// la que NO es ligada, cancelada en otra sesión con la ventana abierta: dice lo que pasó y nada de lo que iba a pasar
await caso("ses-157-la-normal-cancelada-en-otra-sesion-con-la-ventana-abierta", async ({ p, s }) => {
  const g = { ligada: false };
  s.filas = HOTSSON_PLAN({ plan: PLAN_HOTSSON.slice(0, 2), grupos: { "F-159": g, "F-160": g } }); s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  await grupoDelPlan(p).last().click(); await p.waitForTimeout(500);
  s.filas = conDesligadas(s.filas, ["F-160"]);
  await regresaALaPestana(p);
  const llego = await p.waitForFunction(() => /en otra sesión/.test(document.body.innerText), null, { timeout: 10000, polling: 200 }).then(() => true, () => false);
  const v = await textoDe(ventanaDelPlan(p));
  ok("ses-157-la-normal-cancelada-en-otra-sesion-con-la-ventana-abierta", llego && /se canceló en otra sesión/.test(v) && /Ya está cancelada/.test(v) && !/desligó|desligada/.test(v) && !/se cancela en CobranzaFlow/.test(v) && !/timbrada ante el SAT/.test(v) && !/0 líneas/.test(v) && !/No se deshace/.test(v),
    `la ventana: «${v.slice(0, 300)}»`);
});
// la desligada con un motivo sin dónde cortar: se queda dentro de su renglón, en las dos pantallas
await caso("ses-158-el-motivo-sin-cortes-de-la-desligada-cabe", async ({ p, s }) => {
  const LARGO_SIN_CORTES = "IMG_20250914_183022_HDR_portrait_edited_edited.HEIC".repeat(9);   // 459 caracteres: el campo admite 500
  const f = conDesligadas(HOTSSON_PLAN(), ["F-169"]);
  f.oc_invoice_split_groups = f.oc_invoice_split_groups.map(g => g.folio === "F-169" ? { ...g, cancellation_reason: LARGO_SIN_CORTES } : g);
  s.filas = f; s.rpcRespuestas = RESPUESTAS_PLAN;
  await abrirHotsson(p, s, "marcelo");
  const medir = () => p.evaluate(() => {
    const m = [...document.querySelectorAll("div")].find(e => !e.children.length && /^Motivo: IMG_2025/.test(e.textContent));
    const card = m?.closest('div[style*="border-radius: 8px"]');
    const q = document.createRange(); if (m) q.selectNodeContents(m);   // el texto, no su caja
    return { hay: !!m, seSale: m && card ? q.getBoundingClientRect().right > card.getBoundingClientRect().right + 1 : null, pagina: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
  });
  const a1366 = await medir();
  await p.setViewportSize({ width: 1920, height: 1080 }); await p.waitForTimeout(400);
  const a1920 = await medir();
  const bien = a => a.hay && a.seSale === false && !a.pagina;
  ok("ses-158-el-motivo-sin-cortes-de-la-desligada-cabe", bien(a1366) && bien(a1920), `1366: ${JSON.stringify(a1366)} · 1920: ${JSON.stringify(a1920)}`);
});

// ════════════════════════ v10.84.175 — validar una sola vez, y «Tiempo por etapa» con la bitácora que manda la base ════════════════════════
// (41 órdenes en 120 días con «✅ Validada» y «Ambos validaron» escritos dos veces, de 1 a 45 s después y por la misma persona: P-0712, P-0705, P-0669. Una recarga que salió antes de
//  guardar regresa la orden sin validar y el botón vuelve a salir: la simulada lee lo de siempre, así que aquí la recarga llega con la orden como estaba.)
const escritoEnLaBitacora = s => s.peticiones.filter(x => x.m === "POST" && x.ruta === "/rest/v1/order_timeline").map(x => x.cuerpo?.action || "");
const validarDosVeces = async (p, s, quien, pn, boton, marca) => {
  s.validar = { hechas: new Set() };
  await abrirYEntrar(p, s, quien);
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await abrirPendientes(p);
  const b = fichaDe(p, pn).getByRole("button", { name: boton, exact: true });
  await b.click();
  await esperarQue(() => escritoEnLaBitacora(s).some(a => /Ambos validaron/.test(a)), 8000);
  await p.waitForTimeout(300);
  await p.evaluate(() => window.dispatchEvent(new Event("focus")));   // la recarga que llega con la orden como estaba: el botón regresa
  const regreso = await b.waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (regreso) { await p.waitForTimeout(250); await b.click(); await p.waitForTimeout(1500); }
  const esc = escritoEnLaBitacora(s), t = await texto(p);
  return { regreso, validadas: esc.filter(a => marca.test(a)).length, ambos: esc.filter(a => /Ambos validaron/.test(a)).length, aviso: /ya estaba validada/.test(t) };
};
await caso("ses-159-noemi-doble-clic-con-la-recarga-vieja-no-escribe-dos-veces", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0950", { stage: "draft", validated_by_production: true, validated_by_preprensa: false })] };
  const r = await validarDosVeces(p, s, "noemi", "P-0950", "Validar Pre-prensa", /Validada por Pre-prensa/);
  ok("ses-159-noemi-doble-clic-con-la-recarga-vieja-no-escribe-dos-veces", r.regreso && r.validadas === 1 && r.ambos === 1 && r.aviso, JSON.stringify(r));
});
await caso("ses-160-gerardo-doble-clic-con-la-recarga-vieja-no-escribe-dos-veces", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0951", { stage: "draft", validated_by_production: false, validated_by_preprensa: true })] };
  const r = await validarDosVeces(p, s, "gerardo", "P-0951", "Validar Producción", /Validada por Producción/);
  ok("ses-160-gerardo-doble-clic-con-la-recarga-vieja-no-escribe-dos-veces", r.regreso && r.validadas === 1 && r.ambos === 1 && r.aviso, JSON.stringify(r));
});
// el UPDATE no mueve la orden sin sus condiciones: si en la base ya avanzó, un clic viejo no la regresa a Diseño (antes ponía la etapa sin mirar en cuál iba)
await caso("ses-161-validar-lleva-sus-condiciones", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0952", { stage: "draft", validated_by_production: true, validated_by_preprensa: false })] };
  s.validar = { hechas: new Set() };
  await abrirYEntrar(p, s, "noemi");
  await esperarMenu(p, /^Pendientes/); await despertar(p);
  await abrirPendientes(p);
  const pedidas = []; p.on("request", r => { if (r.method() === "PATCH" && /\/rest\/v1\/orders/.test(r.url())) pedidas.push(decodeURIComponent(r.url())); });
  await fichaDe(p, "P-0952").getByRole("button", { name: "Validar Pre-prensa", exact: true }).click();
  await esperarQue(() => escritoEnLaBitacora(s).some(a => /Ambos validaron/.test(a)), 8000);
  ok("ses-161-validar-lleva-sus-condiciones", pedidas.some(u => /stage=eq\.draft/.test(u) && /validated_by_preprensa=not\.is\.true/.test(u)), pedidas.join(" | ").slice(0, 240));
});
// el arreglo solo (`autoFix`: las dos validaciones puestas y la orden en Validar) escribe a dónde fue: sin etapa, «Tiempo por etapa» la seguía contando en Validar (P-0430)
await caso("ses-162-el-arreglo-solo-anota-a-donde-fue", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0953", { stage: "draft", validated_by_production: true, validated_by_preprensa: true }), ordenK("P-0954", { stage: "draft", validated_by_production: true, validated_by_preprensa: true, plate_status: "existing" })] };
  await abrirYEntrar(p, s, "karla");
  await esperarQue(() => s.peticiones.filter(x => x.m === "POST" && x.ruta === "/rest/v1/order_timeline" && /Ambos validaron/.test(x.cuerpo?.action || "")).length >= 2, 8000);
  const es = s.peticiones.filter(x => x.m === "POST" && x.ruta === "/rest/v1/order_timeline" && /Ambos validaron/.test(x.cuerpo?.action || "")).map(x => ({ id: x.cuerpo.order_id, a: x.cuerpo.to_stage }));
  ok("ses-162-el-arreglo-solo-anota-a-donde-fue", es.some(x => x.id === "OP-P-0953" && x.a === "design") && es.some(x => x.id === "OP-P-0954" && x.a === "ready"), JSON.stringify(es));
});
// con la app real: la bitácora como la manda la base (to_stage, by_user, created_at) llega al panel del detalle, con quién tardó y cada máquina
await caso("ses-163-tiempo-por-etapa-con-la-bitacora-de-la-base", async ({ p, s }) => {
  const ev = (h, to_stage, by_user, action) => ({ order_id: "OP-P-0955", action, by_user, color: "#8e8e93", created_at: haceH(h), to_stage });
  s.filas = { orders: [ordenK("P-0955", { stage: "in_production", created_at: haceH(120), validated_by_production: true, validated_by_preprensa: true, current_machine: "off_pm52", machine_queue_position: 0 })],
    order_timeline: [ev(120, "draft", "secretaria", "📋 Orden creada"), ev(119, null, "preprensa", "✅ Validada por Pre-prensa"), ev(100, null, "produccion", "✅ Validada por Producción"),
      ev(100, "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"), ev(90, "ctp", "preprensa", "🎨 Diseño → 💿 CTP"), ev(80, "ctp", "german", "🏭 CTP"), ev(79, "ctp", "german", "🏭 Procesadora"),
      ev(70, "placas_listas", "german", "💿 CTP → 📋 Placas Listas"), ev(60, "ready", "produccion", "📋 Placas Listas → ✅ Lista para imprimir"), ev(50, "in_production", "produccion", "🏭 Printmaster 52 (turno 2)"), ev(10, "in_production", "produccion", "🏭 Polar 115")] };
  await abrirYEntrar(p, s, "marcelo");
  await esperarMenu(p, /^Todas|^Pendientes/); await despertar(p);
  await p.locator('button[title="Todas"]').first().click(); await p.waitForTimeout(800);
  await fichaDe(p, "P-0955").click(); await p.waitForTimeout(600);
  const dlg = p.getByRole("dialog").first();
  await dlg.getByRole("button", { name: /Tiempo por etapa/ }).click(); await p.waitForTimeout(200);
  const t = (await dlg.innerText()).replace(/\s+/g, " ");
  ok("ses-163-tiempo-por-etapa-con-la-bitacora-de-la-base", /Noemí.{0,60}validó/.test(t) && /Gerardo.{0,60}validó/.test(t) && /En fila/.test(t) && /Procesadora/.test(t) && /Máquina · la sigue Gerardo/.test(t) && /Printmaster 52/.test(t) && /Polar 115.{0,80}ahora/.test(t), `el detalle: «${(t.match(/Tiempo por etapa.{0,420}/) || [t.slice(0, 200)])[0]}»`);
});

// el mismo panel en la ficha abierta («Historial y notas»), que es más angosta: se lee y nada se sale, en las dos pantallas de Marcelo, y tocarlo no abre el detalle
await caso("ses-164-tiempo-por-etapa-en-la-ficha-abierta", async ({ p, s }) => {
  const ev = (h, to_stage, by_user, action) => ({ order_id: "OP-P-0956", action, by_user, color: "#8e8e93", created_at: haceH(h), to_stage });
  s.filas = { orders: [ordenK("P-0956", { stage: "in_production", created_at: haceH(120), validated_by_production: true, validated_by_preprensa: true, current_machine: "off_pm52", machine_queue_position: 0 })],
    order_timeline: [ev(120, "draft", "secretaria", "📋 Orden creada"), ev(119, null, "preprensa", "✅ Validada por Pre-prensa"), ev(100, null, "produccion", "✅ Validada por Producción"),
      ev(100, "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"), ev(90, "in_production", "produccion", "🏭 Printmaster 52 (turno 2)"), ev(10, "in_production", "produccion", "🏭 Müller Martini")] };
  await abrirYEntrar(p, s, "marcelo");
  await esperarMenu(p, /^Todas|^Pendientes/); await despertar(p);
  await p.locator('button[title="Todas"]').first().click(); await p.waitForTimeout(800);
  const ficha = fichaDe(p, "P-0956");
  await ficha.getByRole("button", { name: /Historial y notas de P-0956/ }).click(); await p.waitForTimeout(250);
  await ficha.getByRole("button", { name: /Tiempo por etapa/ }).click(); await p.waitForTimeout(250);
  const medir = () => ficha.evaluate(f => { const c = f.getBoundingClientRect(); const fuera = [...f.querySelectorAll("span,div")].filter(e => [...e.childNodes].some(x => x.nodeType === 3 && x.textContent.trim()) && e.getClientRects().length).filter(e => { const q = document.createRange(); q.selectNodeContents(e); return q.getBoundingClientRect().right > c.right + 1; }).map(e => e.textContent.trim().slice(0, 30));
    return { fuera, pagina: document.documentElement.scrollWidth > document.documentElement.clientWidth, ancho: Math.round(c.width) }; });
  // v10.84.176 — y al abrirlo se ve: ninguna barra de arriba lo tapa (elementFromPoint: lo que un recorte tapa, un boundingBox no lo ve)
  const seVeLaEtapa = await ficha.evaluate(f => { const e = f.querySelector('[data-etapa="draft"]'); if (!e) return false; const r = e.getBoundingClientRect(), h = document.elementFromPoint(r.left + 20, r.top + 8); return !!h && (e === h || e.contains(h)); });
  const a1366 = await medir(), t = (await ficha.innerText()).replace(/\s+/g, " "), detalle = await p.getByRole("dialog").count();
  await p.setViewportSize({ width: 1920, height: 1080 }); await p.waitForTimeout(400);
  const a1920 = await medir();
  const bien = a => !a.fuera.length && !a.pagina;
  ok("ses-164-tiempo-por-etapa-en-la-ficha-abierta", seVeLaEtapa && bien(a1366) && bien(a1920) && detalle === 0 && /Noemí.{0,60}validó/.test(t) && /Gerardo.{0,60}validó/.test(t) && /Printmaster 52/.test(t) && /Müller Martini/.test(t), `1366: ${JSON.stringify(a1366)} · 1920: ${JSON.stringify(a1920)} · diálogos: ${detalle} · «${(t.match(/Tiempo por etapa.{0,200}/) || [""])[0]}»`);
});

// v10.84.177 — con la app real: a Dirección el resumen se le ve sin abrir el panel, con la bitácora de la base, y el encabezado dice cuánto lleva
await caso("ses-165-el-resumen-con-la-bitacora-de-la-base", async ({ p, s }) => {
  const ev = (h, to_stage, by_user, action) => ({ order_id: "OP-P-0957", action, by_user, color: "#8e8e93", created_at: haceH(h), to_stage });
  s.filas = { orders: [ordenK("P-0957", { stage: "in_production", created_at: haceH(120), validated_by_production: true, validated_by_preprensa: true, current_machine: "off_pm52", machine_queue_position: 0 })],
    order_timeline: [ev(120, "draft", "secretaria", "📋 Orden creada"), ev(119, null, "preprensa", "✅ Validada por Pre-prensa"), ev(100, null, "produccion", "✅ Validada por Producción"),
      ev(100, "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"), ev(50, "in_production", "produccion", "🏭 Printmaster 52 (turno 2)"), ev(40, null, "system", "⏯️ Auto-activada (cola promoción)")] };
  await abrirYEntrar(p, s, "marcelo");
  await esperarMenu(p, /^Todas|^Pendientes/); await despertar(p);
  await p.locator('button[title="Todas"]').first().click(); await p.waitForTimeout(800);
  await fichaDe(p, "P-0957").click(); await p.waitForTimeout(600);
  const dlg = p.getByRole("dialog").first();
  const t = (await dlg.innerText()).replace(/\s+/g, " "), res = await dlg.locator("[data-resumen]").count();
  ok("ses-165-el-resumen-con-la-bitacora-de-la-base", res === 1 && /Lleva \S+( \S+)? hábiles( \(≈\d+ días\))? · /.test(t) && /Máquina \S+/.test(t) && /lleva \S+( \S+)? en Máquina/.test(t), `resumen ${res}; «${(t.match(/Tiempo por etapa.{0,200}/) || [t.slice(0, 200)])[0]}»`);
});

// v10.84.178 — con la app real, en la ficha abierta (que es un `role=button`): el teclado dentro del panel no abre el detalle, y el panel enseña su foco (el CSS global, que sólo trae la app)
await caso("ses-166-el-teclado-en-el-panel-no-abre-el-detalle", async ({ p, s }) => {
  const ev = (h, to_stage, by_user, action) => ({ order_id: "OP-P-0958", action, by_user, color: "#8e8e93", created_at: haceH(h), to_stage });
  s.filas = { orders: [ordenK("P-0958", { stage: "in_production", created_at: haceH(120), validated_by_production: true, validated_by_preprensa: true, current_machine: "off_pm52", machine_queue_position: 0 })],
    order_timeline: [ev(120, "draft", "secretaria", "📋 Orden creada"), ev(119, null, "preprensa", "✅ Validada por Pre-prensa"), ev(100, null, "produccion", "✅ Validada por Producción"),
      ev(100, "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"), ev(50, "in_production", "produccion", "🏭 Printmaster 52")] };
  await abrirYEntrar(p, s, "marcelo");
  await esperarMenu(p, /^Todas|^Pendientes/); await despertar(p);
  await p.locator('button[title="Todas"]').first().click(); await p.waitForTimeout(800);
  const ficha = fichaDe(p, "P-0958");
  await ficha.getByRole("button", { name: /Historial y notas de P-0958/ }).click(); await p.waitForTimeout(250);
  const b = ficha.getByRole("button", { name: /Tiempo por etapa/ });
  await b.focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  const abierto = await b.getAttribute("aria-expanded"), d1 = await p.getByRole("dialog").count();
  await p.keyboard.press("Tab"); await p.waitForTimeout(100);
  const foco = await p.evaluate(() => { const a = document.activeElement, s = getComputedStyle(a); return { rol: a.getAttribute("role"), anillo: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 }; });
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  const d2 = await p.getByRole("dialog").count();
  ok("ses-166-el-teclado-en-el-panel-no-abre-el-detalle", abierto === "true" && d1 === 0 && foco.rol === "region" && foco.anillo && d2 === 0, JSON.stringify({ abierto, d1, foco, d2 }));
});

// v10.84.179 — con la app real: desde «Todas» o la búsqueda, una orden terminada abría sin su bitácora, sus notas ni su merma hasta que alguien apretara «Cargar Archivo Completo» (`loadOrders(true)` no las trae:
//   1,092 de 1,127 órdenes), y el panel «Tardó…» no salía. Lo vio la revisión en producción de la 178. Se leen al abrir su detalle.
const TERMINADA = (pn, x = {}) => ordenK(pn, { stage: "delivered", created_at: haceH(200), delivered_at: haceH(20), validated_by_production: true, validated_by_preprensa: true, ...x });
const bitacoraDe = (pn, extra = []) => { const ev = (h, to_stage, by_user, action) => ({ order_id: "OP-" + pn, action, by_user, color: "#8e8e93", created_at: haceH(h), to_stage });
  return [ev(200, "draft", "secretaria", "📋 Orden creada"), ev(199, null, "preprensa", "✅ Validada por Pre-prensa"), ev(190, null, "produccion", "✅ Validada por Producción"), ev(190, "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"),
    ...extra.map(e => ev(...e)), ev(150, "salidas", "produccion", "📦 Empaque → 📤 Salidas"), ev(20, "delivered", "karla", "🎉 Entregada")]; };
const aTodas = async (p, s, usuario = "marcelo") => { await abrirYEntrar(p, s, usuario); await esperarMenu(p, /^Todas|^Pendientes/); await despertar(p); await p.locator('button[title="Todas"]').first().click(); await p.waitForTimeout(800); };
const leerTexto = async l => (await l.innerText()).replace(/\s+/g, " ");
const lecturasDe = (s, pn) => s.peticiones.filter(x => x.m === "GET" && x.ruta === "/rest/v1/order_timeline" && x.orderId === "eq.OP-" + pn).length;
const esperaPanel = dlg => dlg.getByRole("button", { name: /Tiempo por etapa/ }).waitFor({ timeout: 6000 }).catch(() => {});
await caso("ses-167-la-entregada-abre-con-su-bitacora-y-sus-notas", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0960")], order_timeline: bitacoraDe("P-0960"), order_notes: [{ id: "n1", order_id: "OP-P-0960", text: "Se entrega en la bodega de atrás", by_user: "karla", created_at: haceH(30) }] };
  await aTodas(p, s);
  await fichaDe(p, "P-0960").click();
  const dlg = p.getByRole("dialog").first(); await esperaPanel(dlg);
  const t = await leerTexto(dlg);
  ok("ses-167-la-entregada-abre-con-su-bitacora-y-sus-notas", /Tardó [^·]*hábiles/.test(t) && /Se entrega en la bodega de atrás/.test(t), `«${t.slice(0, 260)}»`);
});
await caso("ses-168-mientras-lee-lo-dice-y-no-dice-que-no-hay", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0961")], order_timeline: bitacoraDe("P-0961") };
  await aTodas(p, s);
  s.retraso.order_timeline = 2000;
  await fichaDe(p, "P-0961").click(); await p.waitForTimeout(700);
  const dlg = p.getByRole("dialog").first(), t1 = await leerTexto(dlg), estado = await dlg.getByRole("status").count();
  await esperaPanel(dlg);
  const t2 = await leerTexto(dlg);
  ok("ses-168-mientras-lee-lo-dice-y-no-dice-que-no-hay", /Leyendo/.test(t1) && !/Sin movimientos|No se pudo/.test(t1) && estado > 0 && /Tardó/.test(t2) && !/Leyendo/.test(t2), `al abrir, ${estado} status: «${t1.slice(0, 200)}» · después: «${t2.slice(0, 200)}»`);
});
await caso("ses-169-si-no-se-pudo-leer-lo-dice-y-reintenta", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0962")], order_timeline: bitacoraDe("P-0962") };
  await aTodas(p, s);
  s.relacionFalla = true;
  await fichaDe(p, "P-0962").click();
  const dlg = p.getByRole("dialog").first();
  await dlg.getByRole("alert").waitFor({ timeout: 8000 }).catch(() => {});
  const t1 = await leerTexto(dlg);
  s.relacionFalla = false;
  await dlg.getByRole("button", { name: "Reintentar" }).click({ timeout: 2000 }).catch(() => {});
  await esperaPanel(dlg);
  const t2 = await leerTexto(dlg);
  ok("ses-169-si-no-se-pudo-leer-lo-dice-y-reintenta", /No se pudo leer/.test(t1) && !/Sin movimientos|Leyendo/.test(t1) && /Tardó/.test(t2) && !/No se pudo leer/.test(t2), `con la falla: «${t1.slice(0, 200)}» · al reintentar: «${t2.slice(0, 200)}»`);
});
await caso("ses-170-sin-movimientos-lo-dice", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("H-3499")], order_timeline: bitacoraDe("P-0960") };   // la bitácora de otra orden no se le cuela
  await aTodas(p, s);
  await fichaDe(p, "H-3499").click(); await p.waitForTimeout(1200);
  const t = await leerTexto(p.getByRole("dialog").first());
  ok("ses-170-sin-movimientos-lo-dice", /Sin movimientos/.test(t) && !/Leyendo|Tardó/.test(t), `«${t.slice(0, 220)}»`);
});
await caso("ses-171-la-venta-de-inventario-no-enseña-tiempos", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0964", { source: "stock" })] };
  await aTodas(p, s);
  s.retraso.order_timeline = 800;
  await fichaDe(p, "P-0964").click(); await p.waitForTimeout(300);
  const dlg = p.getByRole("dialog").first(), t1 = await leerTexto(dlg);
  await p.waitForTimeout(1200);
  const t2 = await leerTexto(dlg);
  ok("ses-171-la-venta-de-inventario-no-enseña-tiempos", /Venta de inventario: no pasó por la planta/.test(t1) && /Venta de inventario: no pasó por la planta/.test(t2) && !/Leyendo|Sin movimientos|Tardó/.test(t1 + t2), `«${t2.slice(0, 200)}»`);
});
await caso("ses-172-la-recarga-no-se-la-lleva", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0965")], order_timeline: bitacoraDe("P-0965") };
  await aTodas(p, s);
  await fichaDe(p, "P-0965").click();
  const dlg = p.getByRole("dialog").first(); await esperaPanel(dlg);
  const lecturasOrdenes = () => s.peticiones.filter(x => x.m === "GET" && x.ruta === "/rest/v1/orders").length, antes = lecturasOrdenes();
  await esperarQue(() => lecturasOrdenes() > antes, 25000); await p.waitForTimeout(800);
  const t = await leerTexto(dlg);
  ok("ses-172-la-recarga-no-se-la-lleva", lecturasOrdenes() > antes && /Tardó/.test(t) && !/Leyendo|Sin movimientos/.test(t) && lecturasDe(s, "P-0965") === 1, `${lecturasOrdenes() - antes} recargas, ${lecturasDe(s, "P-0965")} lecturas: «${t.slice(0, 200)}»`);
});
await caso("ses-173-abrirla-otra-vez-no-la-vuelve-a-leer", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0966")], order_timeline: bitacoraDe("P-0966") };
  await aTodas(p, s);
  await fichaDe(p, "P-0966").click();
  const dlg = p.getByRole("dialog").first(); await esperaPanel(dlg);
  await p.keyboard.press("Escape"); await p.waitForTimeout(350);
  await fichaDe(p, "P-0966").click(); await p.waitForTimeout(120);
  const t = await leerTexto(p.getByRole("dialog").first());
  ok("ses-173-abrirla-otra-vez-no-la-vuelve-a-leer", lecturasDe(s, "P-0966") === 1 && /Tardó/.test(t) && !/Leyendo/.test(t), `${lecturasDe(s, "P-0966")} lecturas: «${t.slice(0, 200)}»`);
});
// se cierra mientras lee y se abre otra: la respuesta tarde cae en SU orden, no en la que se está viendo
await caso("ses-174-la-respuesta-tarde-cae-en-su-orden", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0967"), TERMINADA("P-0968")], order_timeline: [
    ...bitacoraDe("P-0967", [[170, "draft", "preprensa", "↩️ Regresada de 🎨 Diseño → 📝 Validar · Razón: sólo de la 67"], [160, "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"]]), ...bitacoraDe("P-0968")] };
  await aTodas(p, s);
  s.retraso.order_timeline = 1500;
  await fichaDe(p, "P-0967").click(); await p.waitForTimeout(200);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  await fichaDe(p, "P-0968").click(); await p.waitForTimeout(2600);
  const t68 = await leerTexto(p.getByRole("dialog").first());
  await p.keyboard.press("Escape"); await p.waitForTimeout(350);
  await fichaDe(p, "P-0967").click(); await p.waitForTimeout(300);
  const t67 = await leerTexto(p.getByRole("dialog").first());
  ok("ses-174-la-respuesta-tarde-cae-en-su-orden", /P-0968/.test(t68) && /Tardó/.test(t68) && !/regresó/.test(t68) && /P-0967/.test(t67) && /regresó 1 vez/.test(t67), `68: «${t68.slice(0, 160)}» · 67: «${t67.slice(0, 160)}»`);
});
// vuelta 2: la falla no se queda pegada al volver a abrir; lo que se escribe mientras lee no se pierde al llegar la respuesta; y abrirla otra vez mientras lee no la lee dos veces
await caso("ses-179-si-fallo-al-volver-a-abrir-la-vuelve-a-leer", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0973")], order_timeline: bitacoraDe("P-0973") };
  await aTodas(p, s);
  s.relacionFalla = true;
  await fichaDe(p, "P-0973").click();
  await p.getByRole("dialog").first().getByRole("alert").waitFor({ timeout: 8000 }).catch(() => {});
  await p.keyboard.press("Escape"); await p.waitForTimeout(350);
  s.relacionFalla = false;
  await fichaDe(p, "P-0973").click();
  const dlg = p.getByRole("dialog").first(); await esperaPanel(dlg);
  const t = await leerTexto(dlg);
  ok("ses-179-si-fallo-al-volver-a-abrir-la-vuelve-a-leer", /Tardó/.test(t) && !/No se pudo leer/.test(t) && lecturasDe(s, "P-0973") === 2, `${lecturasDe(s, "P-0973")} lecturas: «${t.slice(0, 200)}»`);
});
await caso("ses-180-la-nota-escrita-mientras-lee-no-se-pierde", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0974")], order_timeline: bitacoraDe("P-0974"), order_notes: [{ id: "n1", order_id: "OP-P-0974", text: "La de antes", by_user: "karla", created_at: haceH(30) }] };
  await aTodas(p, s);
  s.retraso.order_notes = 1500;
  await fichaDe(p, "P-0974").click(); await p.waitForTimeout(250);
  const dlg = p.getByRole("dialog").first(), campo = dlg.getByPlaceholder("Escribe una nota y Enter");
  await campo.fill("La de ahorita"); await campo.press("Enter");
  await p.waitForTimeout(2600);
  const t = await leerTexto(dlg);
  ok("ses-180-la-nota-escrita-mientras-lee-no-se-pierde", /La de antes/.test(t) && /La de ahorita/.test(t), `«${(t.match(/NOTAS RÁPIDAS.{0,160}/i) || [t.slice(0, 200)])[0]}»`);
});
await caso("ses-181-abrirla-mientras-lee-no-la-lee-dos-veces", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0975")], order_timeline: bitacoraDe("P-0975") };
  await aTodas(p, s);
  s.retraso.order_timeline = 1500;
  await fichaDe(p, "P-0975").click(); await p.waitForTimeout(250);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  await fichaDe(p, "P-0975").click();
  const dlg = p.getByRole("dialog").first(); await esperaPanel(dlg); await p.waitForTimeout(300);
  const t = await leerTexto(dlg);
  ok("ses-181-abrirla-mientras-lee-no-la-lee-dos-veces", /Tardó/.test(t) && lecturasDe(s, "P-0975") === 1, `${lecturasDe(s, "P-0975")} lecturas: «${t.slice(0, 160)}»`);
});
await caso("ses-175-la-activa-no-lee-de-mas", async ({ p, s }) => {
  s.filas = { orders: [ordenK("P-0969", { stage: "ctp", created_at: haceH(50), validated_by_production: true, validated_by_preprensa: true })], order_timeline: bitacoraDe("P-0969").slice(0, 4) };
  await aTodas(p, s);
  await fichaDe(p, "P-0969").click(); await p.waitForTimeout(900);
  const t = await leerTexto(p.getByRole("dialog").first());
  ok("ses-175-la-activa-no-lee-de-mas", lecturasDe(s, "P-0969") === 0 && /Tiempo por etapa/.test(t), `${lecturasDe(s, "P-0969")} lecturas: «${t.slice(0, 160)}»`);
});
// Gerardo también: el panel le sale abajo, y la orden cancelada dice «Duró»
await caso("ses-176-gerardo-ve-la-cancelada-con-su-bitacora", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0970", { stage: "cancelled", cancelled_at: haceH(20), delivered_at: null })], order_timeline: bitacoraDe("P-0970").slice(0, 4) };
  await aTodas(p, s, "gerardo");
  await fichaDe(p, "P-0970").click();
  const dlg = p.getByRole("dialog").first(); await esperaPanel(dlg);
  const t = await leerTexto(dlg);
  ok("ses-176-gerardo-ve-la-cancelada-con-su-bitacora", /Duró [^·]*hábiles/.test(t), `«${(t.match(/Tiempo por etapa.{0,140}/) || [t.slice(0, 200)])[0]}»`);
});

// v10.84.180 — el encabezado con la app real: la pausada no alarma con el reloj parado (P-0431: «lleva 58h» en rojo y en presente, en pausa desde septiembre), y lo que se pasa dice contra qué
const enSalidas = (pn, x = {}) => { const ev = (h, to_stage, by_user, action) => ({ order_id: "OP-" + pn, action, by_user, color: "#8e8e93", created_at: haceH(h), to_stage });
  return { orders: [ordenK(pn, { stage: "salidas", created_at: haceH(400), validated_by_production: true, validated_by_preprensa: true, ...x })], order_timeline: [ev(400, "draft", "secretaria", "📋 Orden creada"), ev(399, "salidas", "produccion", "📦 Empaque → 📤 Salidas"), ...(x.snooze_reason ? [ev(2, null, "karla", "🧾 En espera: el cliente no ha pedido factura")] : [])] }; };
await caso("ses-177-la-pausada-no-alarma-en-el-encabezado", async ({ p, s }) => {
  s.filas = enSalidas("P-0971", { snooze_reason: "El cliente aún no ha pedido factura/remisión", snooze_stage: "salidas", snoozed_by: "karla" });
  await aTodas(p, s);
  const f = fichaDe(p, "P-0971"); await f.focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(700);   // con el teclado: el clic al centro de la ficha pausada cae en su franja
  const t = await leerTexto(p.getByRole("dialog").first());
  ok("ses-177-la-pausada-no-alarma-en-el-encabezado", /\d\S*( \S+)? en Salidas hasta la pausa/.test(t) && !/lleva \S+( \S+)? en Salidas/.test(t), `«${(t.match(/.{40}en Salidas.{30}/) || [t.slice(0, 200)])[0]}»`);
});
await caso("ses-178-lo-que-se-pasa-dice-contra-que", async ({ p, s }) => {
  s.filas = enSalidas("P-0972");
  await aTodas(p, s);
  await fichaDe(p, "P-0972").click(); await p.waitForTimeout(700);
  const t = await leerTexto(p.getByRole("dialog").first());
  ok("ses-178-lo-que-se-pasa-dice-contra-que", /lleva \S+( \S+)? en Salidas · lo normal 23h/.test(t) && !/más de lo normal/.test(t), `«${(t.match(/lleva.{0,60}/) || [t.slice(0, 200)])[0]}»`);
});

// v10.84.181 — al abrirlo se ve lo que se pasó, aunque quede bajo el corte a 1366: leer la alarma y buscar su evidencia era bajar a ciegas
await caso("ses-182-al-abrir-se-ve-lo-que-se-paso", async ({ p, s }) => {
  const ev = (h, to_stage, by_user, action) => ({ order_id: "OP-P-0976", action, by_user, color: "#8e8e93", created_at: haceH(h), to_stage });
  s.filas = { orders: [TERMINADA("P-0976")], order_timeline: [ev(400, "draft", "secretaria", "📋 Orden creada"), ev(399, null, "preprensa", "✅ Validada por Pre-prensa"), ev(399, null, "produccion", "✅ Validada por Producción"), ev(399, "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"), ev(398, "ctp", "preprensa", "🎨 Diseño → 💿 CTP"), ev(397, "placas_listas", "german", "💿 CTP → 📋 Placas Listas"), ev(396, "ready", "produccion", "📋 → ✅ Lista"), ev(395, "in_production", "produccion", "🏭 Printmaster 52"), ev(394, "packaging", "produccion", "🏭 📦 Empaque"), ev(393, "salidas", "produccion", "📦 Empaque → 📤 Salidas"), ev(20, "delivered", "karla", "🎉 Entregada")] };
  await aTodas(p, s);
  await fichaDe(p, "P-0976").click();
  const dlg = p.getByRole("dialog").first(); await esperaPanel(dlg);
  await dlg.getByRole("button", { name: /Tiempo por etapa/ }).click(); await p.waitForTimeout(350);
  const m = await dlg.evaluate(d => { const e = d.querySelector("[data-peor]"); if (!e) return { hay: false }; const r = e.getBoundingClientRect(), h = document.elementFromPoint(r.left + 40, r.top + 8); return { hay: true, se: !!h && (e === h || e.contains(h)), top: Math.round(r.top) }; });
  ok("ses-182-al-abrir-se-ve-lo-que-se-paso", m.hay && m.se, JSON.stringify(m));
}, { viewport: { width: 1366, height: 768 } });
// bitácora con renglones y sin etapas (48 órdenes): antes desaparecía en silencio, al revés de la que no trae renglones
await caso("ses-183-renglones-sin-etapas-lo-dice", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0977")], order_timeline: [{ order_id: "OP-P-0977", action: "🎉 Entregada", by_user: "karla", color: "#8e8e93", created_at: haceH(20), to_stage: null }] };
  await aTodas(p, s);
  await fichaDe(p, "P-0977").click(); await p.waitForTimeout(1200);
  const t = await leerTexto(p.getByRole("dialog").first());
  ok("ses-183-renglones-sin-etapas-lo-dice", /Sin movimientos/.test(t), `«${t.slice(0, 200)}»`);
});

// «Ver fechas» se recuerda entre órdenes, como abierto o cerrado
await caso("ses-184-ver-fechas-se-recuerda-entre-ordenes", async ({ p, s }) => {
  s.filas = { orders: [TERMINADA("P-0978"), TERMINADA("P-0979")], order_timeline: [...bitacoraDe("P-0978"), ...bitacoraDe("P-0979")] };
  await aTodas(p, s);
  await fichaDe(p, "P-0978").click();
  let dlg = p.getByRole("dialog").first(); await esperaPanel(dlg);
  await dlg.getByRole("button", { name: /Tiempo por etapa/ }).click(); await p.waitForTimeout(150);
  await dlg.getByRole("button", { name: "Ver fechas" }).click(); await p.waitForTimeout(150);
  await p.keyboard.press("Escape"); await p.waitForTimeout(350);
  await fichaDe(p, "P-0979").click();
  dlg = p.getByRole("dialog").first(); await esperaPanel(dlg); await p.waitForTimeout(200);
  const hay = await dlg.getByRole("button", { name: "Ocultar fechas" }).count(), t = await leerTexto(dlg);
  ok("ses-184-ver-fechas-se-recuerda-entre-ordenes", hay === 1 && /P-0979/.test(t) && /Entró/.test(t), `«Ocultar fechas» ${hay}: «${t.slice(0, 160)}»`);
});

// v10.84.182 — abrir no se lleva el botón: se queda pegado arriba, con lo que se pasó debajo y a la vista
await caso("ses-185-al-abrir-se-quedan-el-boton-y-la-prueba", async ({ p, s }) => {
  const ev = (h, to_stage, by_user, action) => ({ order_id: "OP-P-0980", action, by_user, color: "#8e8e93", created_at: haceH(h), to_stage });
  s.filas = { orders: [TERMINADA("P-0980")], order_timeline: [ev(400, "draft", "secretaria", "📋 Orden creada"), ev(399, null, "preprensa", "✅ Validada por Pre-prensa"), ev(399, null, "produccion", "✅ Validada por Producción"), ev(399, "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"),
    ...[0, 1, 2].flatMap(k => [ev(398.9 - k, "draft", "preprensa", "↩️ Regresada de 🎨 Diseño → 📝 Validar · Razón: vuelta " + k), ev(398.7 - k, null, "preprensa", "✅ Validada por Pre-prensa"), ev(398.6 - k, null, "produccion", "✅ Validada por Producción"), ev(398.6 - k, "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño")]),
    ev(395.5, "ctp", "preprensa", "🎨 Diseño → 💿 CTP"), ev(395.4, "placas_listas", "german", "💿 CTP → 📋 Placas Listas"), ev(395.3, "ready", "produccion", "📋 → ✅ Lista"), ev(395.2, "in_production", "produccion", "🏭 Printmaster 52"), ev(395.1, "packaging", "produccion", "🏭 📦 Empaque"), ev(395, "salidas", "produccion", "📦 Empaque → 📤 Salidas"), ev(20, "delivered", "karla", "🎉 Entregada")] };
  await aTodas(p, s);
  await fichaDe(p, "P-0980").click();
  const dlg = p.getByRole("dialog").first(); await esperaPanel(dlg);
  await dlg.getByRole("button", { name: /Tiempo por etapa/ }).click(); await p.waitForTimeout(350);
  const m = await dlg.evaluate(d => { const pinta = e => { if (!e) return false; const r = e.getBoundingClientRect(), h = document.elementFromPoint(r.left + 40, r.top + 8); return !!h && (e === h || e.contains(h)); }; const b = [...d.querySelectorAll("button")].find(x => /Tiempo por etapa/.test(x.textContent)); return { boton: pinta(b), peor: pinta(d.querySelector("[data-peor]")) }; });
  ok("ses-185-al-abrir-se-quedan-el-boton-y-la-prueba", m.boton && m.peor, JSON.stringify(m));
}, { viewport: { width: 1366, height: 768 } });
// el encabezado también dice «hábiles»: para Producción es lo único visible al abrir
await caso("ses-186-el-encabezado-dice-habiles", async ({ p, s }) => {
  s.filas = enSalidas("P-0981");
  await aTodas(p, s);
  await fichaDe(p, "P-0981").click(); await p.waitForTimeout(700);
  const t = await leerTexto(p.getByRole("dialog").first());
  ok("ses-186-el-encabezado-dice-habiles", /lleva \S+( \S+)? hábiles en Salidas · lo normal 23h/.test(t), `«${(t.match(/lleva.{0,60}/) || [t.slice(0, 200)])[0]}»`);
});

// v10.84.184 — «Tiempos» de Analytics con la app real: lo terminado no trae su bitácora hasta «Cargar datos completos» (la regla 12), y `loadArchive` enciende la pantalla ANTES de que llegue: con las órdenes a medias, la tabla diría
//   cifras que no son. Marcelo, 4-nov: «no sé quién tardó, Gerardo o Noemí»; 5-nov, a la tabla: «te doy el sí». Fechas fijas: lo que ya salió de una etapa no depende del reloj. Noemí 1 h 30 m, Gerardo 30 m.
const ENTREGADA_FIJA = pn => { const ev = (f, to_stage, by_user, action) => ({ order_id: "OP-" + pn, action, by_user, color: "#8e8e93", created_at: f.replace(" ", "T") + "-06:00", to_stage });
  return { orders: [ordenK(pn, { stage: "delivered", created_at: "2026-10-05T09:00:00-06:00", delivered_at: "2026-10-06T12:00:00-06:00", validated_by_production: true, validated_by_preprensa: true })],
    order_timeline: [ev("2026-10-05 09:00:00", "draft", "secretaria", "📋 Orden creada"), ev("2026-10-05 09:30:00", null, "produccion", "✅ Validada por Producción"), ev("2026-10-05 10:30:00", null, "preprensa", "✅ Validada por Pre-prensa"), ev("2026-10-05 10:30:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"), ev("2026-10-05 11:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"), ev("2026-10-06 12:00:00", "delivered", "karla", "🎉 Entregada")] }; };
const aAnalytics = async (p, s) => { await abrirYEntrar(p, s, "marcelo"); await esperarMenu(p, /^Todas|^Pendientes/); await despertar(p); await p.locator('button[title="Analytics"]').first().click(); await p.getByRole("button", { name: /Cargar datos completos/ }).waitFor({ timeout: 6000 }); };
const cargarYTiempos = async p => { await p.getByRole("button", { name: /Cargar datos completos/ }).click(); await p.getByRole("tab", { name: "Tiempos" }).click({ timeout: 6000 }); };
const verTodo = async p => { await p.getByRole("radio", { name: "Todo", exact: true }).click({ timeout: 6000 }); await p.waitForTimeout(200); };
const celdaT = async (p, q, e, c) => { const l = p.locator(`[data-tiempos] tr[data-quien="${q}"][data-etapa="${e}"] [data-c="${c}"]`); return (await l.count()) ? (await l.first().innerText()).replace(/\s+/g, " ").trim() : null; };
await caso("ses-187-tiempos-con-lo-terminado", async ({ p, s }) => {
  s.filas = ENTREGADA_FIJA("P-0990");
  await aAnalytics(p, s); await cargarYTiempos(p);
  await p.locator("[data-tiempos] table").waitFor({ timeout: 8000 }).catch(() => {});
  await verTodo(p);
  const n = await celdaT(p, "Noemí", "draft", "mediana"), g = await celdaT(p, "Gerardo", "draft", "mediana");
  ok("ses-187-tiempos-con-lo-terminado", n === "1h 30m" && g === "30m", `Noemí ${n}, Gerardo ${g}`);
});
await caso("ses-188-mientras-lee-no-dice-cifras", async ({ p, s }) => {
  s.filas = ENTREGADA_FIJA("P-0991");
  await aAnalytics(p, s);
  s.retraso.order_timeline = 3000;
  await cargarYTiempos(p); await p.waitForTimeout(400);
  const leyendo = await p.locator("[data-tiempos-leyendo]").count(), tabla = await p.locator("[data-tiempos] table").count(), vacio = await p.locator("[data-tiempos-vacio]").count();
  s.retraso.order_timeline = 0;
  await p.locator("[data-tiempos-leyendo]").waitFor({ state: "detached", timeout: 12000 }).catch(() => {});
  await verTodo(p);   // (la orden es de octubre: en «Este mes» ya no sale)
  const despues = await p.locator("[data-tiempos] table").count(), l2 = await p.locator("[data-tiempos-leyendo]").count();
  ok("ses-188-mientras-lee-no-dice-cifras", leyendo === 1 && tabla === 0 && vacio === 0 && despues === 1 && l2 === 0, JSON.stringify({ leyendo, tabla, vacio, despues, l2 }));
});
await caso("ses-189-si-no-se-pudo-leer-no-dice-cifras-y-se-reintenta", async ({ p, s }) => {
  const buenas = ENTREGADA_FIJA("P-0992");
  s.filas = buenas;
  await aAnalytics(p, s);
  s.filas = { ...buenas, order_timeline: "falla" };
  await cargarYTiempos(p);
  const boton = p.getByRole("button", { name: /Cargar datos completos/ });
  await boton.waitFor({ timeout: 20000 }).catch(() => {});
  const regreso = await boton.count(), t1 = await texto(p), cifras = await p.locator("[data-tiempos] table").count();
  s.filas = buenas;
  await cargarYTiempos(p);
  await p.locator("[data-tiempos] table").waitFor({ timeout: 10000 }).catch(() => {});
  await verTodo(p);
  const n = await celdaT(p, "Noemí", "draft", "mediana");
  ok("ses-189-si-no-se-pudo-leer-no-dice-cifras-y-se-reintenta", regreso === 1 && cifras === 0 && /No se pudo cargar el archivo completo/.test(t1) && n === "1h 30m", `el botón ${regreso}; tablas ${cifras}; Noemí ${n}; «${t1.slice(0, 160)}»`);
});
await caso("ses-190-de-la-tabla-a-la-orden-la-misma-cifra", async ({ p, s }) => {
  s.filas = ENTREGADA_FIJA("P-0993");
  await aAnalytics(p, s); await cargarYTiempos(p);
  await p.locator("[data-tiempos] table").waitFor({ timeout: 8000 }).catch(() => {});
  await verTodo(p);
  await p.locator('[data-tiempos] tr[data-quien="Noemí"][data-etapa="draft"] button').first().click();
  await p.locator("[data-lenta]").first().click({ timeout: 3000 });
  const dlg = p.getByRole("dialog").first(); await esperaPanel(dlg);
  const t = await leerTexto(dlg);
  ok("ses-190-de-la-tabla-a-la-orden-la-misma-cifra", /Noemí 1h 30m/.test(t) && /Gerardo 30m/.test(t), `«${(t.match(/.{0,50}Validar.{0,80}/) || [t.slice(0, 200)])[0]}»`);
});
await caso("ses-191-sigue-despues-de-recargar", async ({ p, s }) => {
  s.filas = ENTREGADA_FIJA("P-0994");
  await aAnalytics(p, s); await cargarYTiempos(p);
  await p.locator("[data-tiempos] table").waitFor({ timeout: 8000 }).catch(() => {});
  await verTodo(p);
  const antes = await celdaT(p, "Noemí", "draft", "veces"), lecturas = () => s.peticiones.filter(x => x.m === "GET" && x.ruta === "/rest/v1/orders").length, l0 = lecturas();
  await p.waitForTimeout(22000);   // la recarga de cada 20 s: `loadOrders(true)` no trae lo relacionado de lo terminado, y lo que ya estaba se conserva
  const despues = await celdaT(p, "Noemí", "draft", "veces"), l1 = lecturas();
  ok("ses-191-sigue-despues-de-recargar", antes === "1" && despues === "1" && l1 > l0, `${antes} → ${despues}; lecturas de las órdenes ${l0} → ${l1}`);
});
await caso("ses-192-solo-direccion", async ({ p, s }) => {
  s.filas = ENTREGADA_FIJA("P-0995");
  await abrirYEntrar(p, s, "karla"); await esperarMenu(p, /^Pendientes/); await despertar(p);
  const n = await p.locator('button[title="Analytics"]').count();
  ok("ses-192-solo-direccion", n === 0, `Karla ve Analytics: ${n}`);
});

await browser.close();
await servidor.close();
fin();
