// LA SESIÓN CONTRA EL AUTH Y LA BASE DE VERDAD (v10.84.71). La tanda tests/romper/sesion.mjs simula Auth; ésta comprueba con la app
// REAL (compilada o publicada) y la cuenta de pruebas que lo que esa tanda supone es lo que contestan Auth y la base: que una sesión
// buena se recupera al abrir (getUser + get_user_session de verdad) y que nada saca a nadie. Sin escribir nada: las escrituras y la
// salida se cortan en este navegador (la salida se anota y no llega a Auth), y las fallas se SIMULAN sólo aquí.
//  A. entrar y recargar: la app abre las dos veces, y al recargar se le preguntó a Auth (GET /auth/v1/user);
//  B. al recargar, get_user_session no contesta (la red, sólo aquí): «No se pudo comprobar tu sesión» con «Reintentar», ninguna
//     salida; sin el corte, «Reintentar» abre sin contraseña;
//  C. Auth ya no renueva la sesión (la renovación se rechaza sólo aquí): lleva a entrar con «Tu sesión se cerró…», sin salidas globales;
//  D. «Salir»: sale sólo de aquí (scope=local) y la pantalla de entrar no dice que la sesión se cerró sola.
// Uso:  npm run build && node tests/recorrido/sesion.mjs             (sirve dist/ en 127.0.0.1:4278)
//       node tests/recorrido/sesion.mjs https://produccion.sygma.mx  (la app publicada)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(RAIZ, "tests/salida/recorrido-sesion"); fs.mkdirSync(OUT, { recursive: true });
const CRED = JSON.parse(fs.readFileSync(process.env.PF_CREDENCIAL || "C:/Users/padil/claude-navegador/credencial-printflow.json", "utf8"));
let base = process.argv[2], servidor = null;
if (!base) { const { preview } = await import("vite"); servidor = await preview({ root: RAIZ, logLevel: "error", preview: { host: "127.0.0.1", port: 4278, strictPort: true } }); base = "http://127.0.0.1:4278"; }
let nav; try { nav = await chromium.launch({ headless: true }); } catch { nav = await chromium.launch({ headless: true, channel: "chrome" }); }
const res = []; let falla = false;
const ok = (nombre, c, x) => { res.push((c ? "BIEN " : "MAL  ") + " " + nombre + (x ? " · " + x : "")); if (!c) falla = true; };
const LLAVE = /^sb-.*-auth-token$/;
const texto = p => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const enApp = p => p.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Salir" && b.offsetParent));
const enLogin = p => p.evaluate(() => !!document.querySelector('input[placeholder^="Ej: gerardo"]') && !/Verificando|Comprobando/.test(document.body.innerText));
async function esperar(p, cond, s = 30) { for (let k = 0; k < s * 5; k++) { if (await cond(p).catch(() => false)) return true; await p.waitForTimeout(200); } return false; }
const cerrarEstorbos = async p => {   // la bienvenida del rol y el «Despertador» del día tapan los clics
  for (let i = 0; i < 2; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(150); }
  if (await p.getByText(/escribe SI ENTIENDO/i).count()) { await p.getByPlaceholder(/Escribe aquí/).first().fill("SI ENTIENDO"); await p.waitForTimeout(800); }
};
// una sesión del navegador: escrituras cortadas; `e` decide qué se simula (sólo aquí)
async function contexto(e) {
  const ctx = await nav.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(() => { window.print = () => {}; window.open = () => null; });
  await ctx.route("**/*", async route => {
    const req = route.request(), url = req.url(), m = req.method();
    if (!/\.supabase\.co\//.test(url)) return route.continue();
    const ruta = url.replace(/^https:\/\/[^/]+/, "").replace(/\?.*$/, "");
    if (ruta === "/auth/v1/logout") { e.salidas.push(new URL(url).searchParams.get("scope") || "(sin scope: global)"); return route.fulfill({ status: 204, body: "" }); }
    if (ruta === "/auth/v1/user") e.auth++;
    if (ruta === "/auth/v1/token" && /grant_type=refresh_token/.test(url) && e.rechazarRenovacion)
      return route.fulfill({ status: 400, contentType: "application/json", headers: { "x-supabase-api-version": "2024-01-01" },
        body: JSON.stringify({ code: "refresh_token_not_found", error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" }) });
    if (ruta === "/rest/v1/rpc/get_user_session") { e.perfiles++; if (e.sinRedAlPerfil) return route.abort("internetdisconnected"); return route.continue(); }
    if (m === "GET" || m === "HEAD" || m === "OPTIONS" || ruta.startsWith("/auth/v1/")) return route.continue().catch(() => {});
    if (ruta.startsWith("/storage/v1/object/sign/") || ruta.startsWith("/storage/v1/object/list/")) return route.continue();
    if (/^\/rest\/v1\/rpc\/(get_|list_|search_|load_|validate_|resolve_|client_credit_balance|ordenes_saldo_consumido|order_folio_is_cancelled|oc_shared_folio_is_cancelled|sugerencia_folios|pf_archivos_del_bucket)/.test(ruta)) return route.continue();
    e.cortes.add(m + " " + ruta);
    return route.fulfill({ status: 418, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "solo lectura (prueba)" }) });
  });
  const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  return { ctx, p };
}
async function entrar(p) {
  await p.goto(base, { timeout: 60000 });
  if (!(await esperar(p, enLogin, 30))) throw new Error("no salió la pantalla de entrar");
  await p.getByPlaceholder(/gerardo/).fill(CRED.username);
  await p.locator('input[type="password"]').fill(CRED.password);
  await p.getByRole("button", { name: "Entrar" }).click();
  if (!(await esperar(p, enApp, 40))) throw new Error("con la cuenta de pruebas no abrió la app: «" + (await texto(p)).slice(0, 160) + "»");
  await cerrarEstorbos(p);
}
const estado = () => ({ salidas: [], auth: 0, perfiles: 0, cortes: new Set(), sinRedAlPerfil: false, rechazarRenovacion: false });

try {
  // A y B en la misma sesión del navegador
  { const e = estado(); const { ctx, p } = await contexto(e);
    await entrar(p);
    const auth0 = e.auth;
    await p.reload();
    const abre = await esperar(p, enApp, 40);
    ok("A · entrar y recargar: la sesión buena se recupera y se le pregunta a Auth", abre && e.auth > auth0 && e.salidas.length === 0,
      `abre al recargar ${abre} · GET /auth/v1/user ${e.auth - auth0} · salidas ${e.salidas.join(" ") || "ninguna"}`);
    await p.screenshot({ path: path.join(OUT, "A.png") });
    e.sinRedAlPerfil = true;
    await p.reload();
    await esperar(p, enLogin, 40);
    const t = await texto(p);
    const hay = await p.getByRole("button", { name: /Reintentar/i }).isVisible().catch(() => false);
    const guardada = await p.evaluate(re => Object.keys(localStorage).some(k => new RegExp(re).test(k)), LLAVE.source);
    await p.screenshot({ path: path.join(OUT, "B-aviso.png") });
    e.sinRedAlPerfil = false;
    let abreOtraVez = false;
    if (hay) { await p.getByRole("button", { name: /Reintentar/i }).click(); abreOtraVez = await esperar(p, enApp, 40); }
    ok("B · sin red al comprobar: no saca a nadie y «Reintentar» abre sin contraseña", /no se pudo comprobar tu sesión/i.test(t) && hay && guardada && e.salidas.length === 0 && abreOtraVez,
      `aviso ${/no se pudo comprobar/i.test(t)} · «Reintentar» ${hay} · sesión guardada ${guardada} · salidas ${e.salidas.join(" ") || "ninguna"} · abre ${abreOtraVez}`);
    await ctx.close(); }

  // C: Auth ya no renueva (simulado aquí) → a entrar con el aviso
  { const e = estado(); const { ctx, p } = await contexto(e);
    await entrar(p);
    e.rechazarRenovacion = true;
    await p.evaluate(re => { const k = Object.keys(localStorage).find(k => new RegExp(re).test(k)); const v = JSON.parse(localStorage.getItem(k));
      v.expires_at = Math.floor(Date.now() / 1000) - 5; localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new Event("visibilitychange")); }, LLAVE.source);
    const login = await esperar(p, enLogin, 20);
    const t = await texto(p);
    await p.screenshot({ path: path.join(OUT, "C.png") });
    ok("C · Auth ya no renueva la sesión: lleva a entrar diciendo que se cerró", login && /tu sesión se cerró/i.test(t) && e.salidas.every(x => x === "local"),
      `a entrar ${login} · aviso ${/tu sesión se cerró/i.test(t)} · salidas ${e.salidas.join(" ") || "ninguna"}`);
    await ctx.close(); }

  // D: «Salir» sólo de aquí
  { const e = estado(); const { ctx, p } = await contexto(e);
    await entrar(p);
    await p.getByRole("button", { name: "Salir", exact: true }).click();
    const login = await esperar(p, enLogin, 20);
    for (let k = 0; k < 25 && !e.salidas.length; k++) await p.waitForTimeout(200);
    const t = await texto(p);
    ok("D · «Salir» sale sólo de aquí y no dice que la sesión se cerró sola", login && e.salidas.length >= 1 && e.salidas.every(x => x === "local") && !/sesión se cerró/i.test(t),
      `a entrar ${login} · salidas ${e.salidas.join(" ") || "ninguna"}`);
    await ctx.close(); }
} catch (err) { ok("el recorrido se cayó", false, String(err.message).split("\n")[0]); }

await nav.close();
if (servidor) await servidor.close();
for (const r of res) console.log(r);
console.log(falla ? "\nHAY FALLAS" : "\nTODO BIEN");
process.exit(falla ? 1 : 0);
