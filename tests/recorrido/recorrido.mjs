// RECORRIDO de toda la app de PrintFlow, como cada rol, con la cuenta de pruebas `claude-pruebas` (rol `visor`: sólo lectura en
// la base, pf_puede_escribir() = false) y las escrituras CORTADAS en el navegador. Entra, abre cada vista del menú y el detalle de
// una orden, y reporta lo que truena: pantallas que se caen (el «Algo salió mal» del error boundary), errores de JS, llamadas a la
// base que fallan, lo que tarda, y las ESCRITURAS que una vista intenta con sólo abrirla (se cortan; quedan en el reporte).
// Encuentra bugs en pantallas que no tienen pruebas escritas (Marcelo, 5-oct-2026: «scan sin agentes»).
//
// Uso:  npm run build && node tests/recorrido/recorrido.mjs                  (sirve dist/ en :4173 y lo recorre)
//       node tests/recorrido/recorrido.mjs https://produccion.sygma.mx        (después de subir: la app publicada)
//       node tests/recorrido/recorrido.mjs <url> karla,admin                  (sólo esos roles)
// Sale con 1 si una pantalla truena o una llamada falla. Capturas en tests/salida/recorrido/<rol>/.
//
// Candados (los tres a la vez):
//  1. el navegador deja pasar sólo lecturas: GET, entrar/refrescar la sesión, firmar URLs de archivos, y las RPC de LECTURAS
//     (STABLE/IMMUTABLE: Postgres no les deja escribir). Todo lo demás se contesta con 418 y queda en el reporte.
//  2. la cuenta es `visor` en la base: aunque algo se colara, las tablas y las RPC con verify_actor_role la rechazan.
//  3. el rol de la pantalla se cambia SÓLO en el navegador (la respuesta de get_user_session); la base sigue viendo un visor.
// Nunca cierra sesión de verdad (POST /auth/v1/logout se contesta sin llegar). La contraseña vive sólo en
// C:\Users\padil\claude-navegador\credencial-printflow.json (o PF_CREDENCIAL) y nunca se imprime.
import { chromium } from "playwright";
import { preview } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const URL_ARG = process.argv[2];
const ROLES = (process.argv[3] || "admin,karla,secretaria,produccion,preprensa,german,vendedor,visor").split(",").filter(Boolean);
const CRED = JSON.parse(fs.readFileSync(process.env.PF_CREDENCIAL || "C:/Users/padil/claude-navegador/credencial-printflow.json", "utf8"));
const OUT = path.join(RAIZ, "tests", "salida", "recorrido");
const BLOQUEO = 418;   // propio, para no confundir un corte del recorrido con un 401/403 real de la base

// RPC de lectura GARANTIZADA: STABLE/IMMUTABLE (pg_proc.provolatile in ('s','i')), medido el 5-oct-2026 sobre las 84 que llama
// la app. Para agregar una: comprobar que sea STABLE/IMMUTABLE. Las volátiles sin escrituras a la vista (list_client_agents,
// merge_clients_preview, peek_print_version) se cortan igual: «volátil» no garantiza nada.
const LECTURAS = new Set(["client_credit_balance", "get_app_config", "get_client_aliases", "get_client_billing_info",
  "get_client_seller_label", "get_folio_emitter_enabled", "get_last_contact_for_client", "get_pantone_by_code", "get_user_session",
  "list_anticipo_clients", "list_consecutive_cobranza_folios", "list_corona_oc_invoices", "list_linkable_invoices_for_oc",
  "list_linkable_invoices_for_order", "list_linkable_invoices_for_split", "list_stock_clients", "load_credit_ledger",
  "oc_shared_folio_is_cancelled", "ordenes_saldo_consumido", "order_folio_is_cancelled", "pf_archivos_del_bucket", "resolve_client_for_order",
  "search_clients_typeahead", "search_pantone", "sugerencia_folios", "validate_production_number"]);

// Las vistas del menú (title del botón sin el conteo). Una vista nueva que no esté aquí sale en el reporte como «sin recorrer».
const VISTAS = ["Torre", "Dashboard", "Pendientes", "En espera", "Datos Pendientes", "Nueva", "Órdenes de Compra", "Pedidos Web",
  "Tablero", "Folios", "Entregas", "Todas", "Archivo", "Analytics", "Dinero en Proceso", "Salud Operativa", "Auditoría",
  "Devoluciones", "Cancelaciones", "Archivos", "Químicos"];
const sinConteo = t => t.replace(/\s*\(\d+\)\s*$/, "").trim();
const NO_VISTAS = ["Notificaciones", "Exportar CSV", "Ver detalle"];   // botones con título que no son vistas del menú
// Escrituras de fondo que la app hace A PROPÓSITO (se cortan igual; salen como «conocidas», no como hallazgo):
//  · la limpieza de archivos del admin (v10.73.51): una vez por sesión de admin borra archivos viejos y recomprime imágenes
//  · los avisos de fondo de la sesión del admin (órdenes estancadas cada 30 min, pedidos web nuevos)
//  · el registro del «Buenos días» (log_wakeup_ack): lo provoca el propio recorrido al escribir «SI ENTIENDO»
const ESCRITURA_CONOCIDA = (rol, c) => c === "POST rpc/log_wakeup_ack"
  || (rol === "admin" && /^(POST|PUT|DELETE) \/storage\/v1\/object\/order-files|^PATCH orders$|^POST notifications$/.test(c));
// Errores que ya se conocen y no son del cambio que se prueba (cada uno con su porqué y SÓLO en su paso):
//  · la app pregunta por el emisor ANTES de entrar, sin sesión, y la base contesta 401 (existía antes del 5-oct; inofensivo)
//  · «Archivos»: la base ve a la cuenta de pruebas como visor y pf_archivos_del_bucket sólo es de admin, preprensa y german
//    (v10.84.41): contesta 403 y la pantalla dice «Error», que es lo correcto. La lista de verdad la prueban
//    tests/romper/archivos.mjs (en la base, como german/noemi/admin) y archivos-pantalla.mjs (la pantalla, en su banco).
const CONOCIDOS = [
  { vista: "entrar", rx: /^HTTP 401 POST \/rest\/v1\/rpc\/get_folio_emitter_enabled$/ },
  { vista: "entrar", rx: /^consola: Failed to load resource: the server responded with a status of 401/ },
  { vista: "Archivos", rx: /^HTTP 403 POST \/rest\/v1\/rpc\/pf_archivos_del_bucket$/ },
  { vista: "Archivos", rx: /^consola: Failed to load resource: the server responded with a status of 403/ },
  { vista: "Archivos", rx: /^consola: \[StorageTab list\]/ },
];

function candado(ctx, rol, reg) {
  return ctx.route("**/*", async route => {
    const req = route.request(), url = req.url(), m = req.method();
    if (!/\.supabase\.co\//.test(url)) return route.continue();
    const ruta = url.replace(/^https:\/\/[^/]+/, "").replace(/\?.*$/, "");
    if (m === "GET" || m === "HEAD" || m === "OPTIONS") return route.continue();
    if (ruta === "/auth/v1/token") return route.continue();
    if (ruta === "/auth/v1/logout") { reg.corte("POST auth/logout"); return route.fulfill({ status: 204, body: "" }); }
    if (ruta.startsWith("/storage/v1/object/sign/")) return route.continue();
    if (ruta.startsWith("/storage/v1/object/list/")) return route.continue();   // listar archivos: lectura, aunque sea POST
    const rpc = (/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(ruta) || [])[1];
    if (rpc && LECTURAS.has(rpc)) {
      if (rpc === "get_user_session" && rol !== "visor") {
        const resp = await route.fetch();
        let j = await resp.json().catch(() => null);
        if (Array.isArray(j) && j[0]) j = [{ ...j[0], role: rol }];
        return route.fulfill({ response: resp, json: j });
      }
      return route.continue();
    }
    reg.corte(m + " " + (rpc ? "rpc/" + rpc : ruta.replace(/^\/rest\/v1\//, "")));
    return route.fulfill({ status: BLOQUEO, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "Recorrido de pruebas: escritura bloqueada (sólo lectura)" }) });
  });
}

async function recorrerRol(navegador, base, rol) {
  const ctx = await navegador.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: false });
  await ctx.addInitScript(() => { window.print = () => {}; });           // imprimir no abre nada
  const filas = [];
  let actual = null;
  const reg = { corte: x => actual && actual.cortes.add(x) };
  await candado(ctx, rol, reg);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", e => actual && actual.errores.push("JS: " + e.message.slice(0, 200)));
  page.on("console", msg => { if (msg.type() === "error" && actual && !/status of 418/.test(msg.text())) actual.errores.push("consola: " + msg.text().slice(0, 200)); });
  // el error se apunta al paso que LANZÓ la petición (un 544 que llega a los 30 s no es culpa del paso que esté abierto)
  page.on("response", r => { const p = vivos.get(r.request()) || actual; if (r.status() >= 400 && r.status() !== BLOQUEO && p && /\.supabase\.co\//.test(r.url())) p.errores.push("HTTP " + r.status() + " " + r.request().method() + " " + r.url().replace(/^https:\/\/[^/]+/, "").replace(/\?.*$/, "")); });
  // «Asentada» = sin consultas de datos en vuelo por medio segundo (no networkidle: el realtime mantiene la red ocupada y todo
  // salía «lento, 10 s»). Así «lenta» mide cuándo terminan de verdad las consultas.
  // Cada petición se apunta al PASO que la lanzó: un paso espera sólo las suyas (las 600 de «Todas» ya no se arrastran al
  // siguiente), y lo que se queda sin terminar sale en el reporte como «colgada».
  const vivos = new Map();
  const esDatos = u => /\.supabase\.co\/(rest|storage|functions)\//.test(u);
  const rutaCorta = u => u.replace(/^https:\/\/[^/]+/, "").replace(/\?.*$/, "").replace(/\/(order-files)\/.*$/, "/$1/…").replace(/^\/rest\/v1\//, "");
  page.on("request", r => { if (esDatos(r.url())) { vivos.set(r, actual); if (actual) { actual.peticiones++; const k = r.method() + " " + rutaCorta(r.url()); actual.rutas[k] = (actual.rutas[k] || 0) + 1; } } });
  const termina = r => {
    if (!vivos.has(r)) return;
    vivos.delete(r);
    const t = r.timing(); const ms = t && t.responseEnd > 0 ? Math.round(t.responseEnd) : null;   // ms desde que empezó la petición
    if (actual && ms != null && ms > (actual.masLenta?.ms || 0)) actual.masLenta = { ms, ruta: r.method() + " " + rutaCorta(r.url()) };
  };
  page.on("requestfinished", termina); page.on("requestfailed", termina);
  const paso = async (nombre, fn) => {
    actual = { rol, vista: nombre, errores: [], cortes: new Set(), ms: 0, nota: "", peticiones: 0, rutas: {}, masLenta: null };
    const t0 = performance.now();
    try { await fn(); } catch (e) { actual.errores.push("no se pudo: " + e.message.split("\n")[0].slice(0, 160)); }
    actual.ms = Math.round(performance.now() - t0);
    if (await page.getByText(/Algo salió mal/).count().catch(() => 0)) actual.errores.push("se cayó: «Algo salió mal» (error boundary)");
    filas.push(actual);
    const n = String(filas.length).padStart(2, "0");
    await page.screenshot({ path: path.join(OUT, rol, n + "-" + nombre.replace(/[^\wáéíóúñ]+/gi, "_") + ".png") }).catch(() => {});
  };
  const asentar = async () => {
    const t0 = performance.now(); let quieto = 0;
    const mias = () => [...vivos.entries()].filter(([, p]) => p === actual);
    while (performance.now() - t0 < 12000) { await page.waitForTimeout(100); quieto = mias().length === 0 ? quieto + 100 : 0; if (quieto >= 500) return; }
    if (actual) actual.colgadas = mias().map(([r]) => r.method() + " " + rutaCorta(r.url())).slice(0, 3);
  };
  // El «Buenos días» (despertador de pendientes) no cierra con Esc: pide escribir «SI ENTIENDO», como la persona.
  // Su registro (log_wakeup_ack) lo corta el candado igual que cualquier escritura.
  const despertador = async () => {
    const campo = page.getByPlaceholder(/Escribe aquí/);
    if (await campo.count() && await page.getByText(/escribe SI ENTIENDO/i).count()) { await campo.first().fill("SI ENTIENDO"); await asentar(); }
  };

  await paso("entrar", async () => {
    await page.goto(base, { timeout: 60000 });
    // NUNCA teclear la contraseña en otra app: el 5-oct, en localhost:4173 contestó la vista previa de CobranzaFlow
    await page.getByText("Sistema de Producción").first().waitFor({ timeout: 15000 }).catch(() => { throw new Error("la página no es PrintFlow (" + page.url() + "): no se teclea nada"); });
    await page.getByPlaceholder(/gerardo/).fill(CRED.username);
    await page.locator('input[type="password"]').fill(CRED.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByText("Operación", { exact: true }).first().waitFor({ timeout: 20000 });
    await asentar();
    await despertador();
    for (let i = 0; i < 2; i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(150); }   // la guía de bienvenida
  });
  if (filas[0].errores.some(e => e.startsWith("no se pudo"))) { await ctx.close(); return filas; }

  const titulos = await page.evaluate(() => [...document.querySelectorAll("button[title]")].map(b => b.getAttribute("title")));
  const enMenu = [...new Set(titulos.map(sinConteo))].filter(t => VISTAS.includes(t));
  const raros = [...new Set(titulos.map(sinConteo))].filter(t => !VISTAS.includes(t) && !NO_VISTAS.includes(t) && /^[A-ZÁÉÍÓÚ][\wáéíóúñ ]{2,30}$/.test(t) && !/menú|Colapsar|Expandir/.test(t));
  for (const v of enMenu) {
    await paso(v, async () => {
      // el título EXACTO sin el conteo («Archivo» no es «Archivos», «Pendientes (5)» es «Pendientes»)
      const h = await page.evaluateHandle(v => [...document.querySelectorAll("button[title]")].find(b => b.getAttribute("title").replace(/\s*\(\d+\)\s*$/, "").trim() === v) || null, v);
      const b = h.asElement();
      if (!b) throw new Error("no encontré el botón del menú");
      await b.click();
      await asentar();
    });
    if (v === "Todas") {
      await paso("detalle de una orden", async () => {
        // la tarjeta es role="button" («Orden P-0577, …») y abre el detalle con Enter, como con el teclado. Por CSS y no con
        // getByRole: con 933 tarjetas, calcular el nombre accesible de miles de botones pasaba de 6 s (admin, 5-oct).
        const tarjeta = page.locator('[role="button"][aria-label^="Orden "]').first();
        if (!(await tarjeta.count())) {
          // el vendedor abre en «Mis Órdenes» y la cuenta de pruebas no tiene órdenes: el «Todas» del encabezado (sin title)
          const todas = page.locator("button:not([title])", { hasText: /^Todas$/ });
          if (await todas.count()) { await todas.first().click(); await asentar(); }
        }
        if (!(await tarjeta.count())) { actual.nota = "sin órdenes que abrir"; return; }
        await tarjeta.focus({ timeout: 6000 });
        await page.keyboard.press("Enter");
        await asentar();
        if (!(await page.getByRole("dialog").count()) && !(await page.locator('div[style*="position: fixed"]').count())) actual.nota = "no abrió un diálogo";
      });
      for (let i = 0; i < 2; i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(150); }
    }
  }
  if (raros.length) filas.push({ rol, vista: "(sin recorrer)", errores: [], cortes: new Set(), ms: 0, nota: "botones con título que no están en VISTAS: " + raros.slice(0, 8).join(", ") });
  await ctx.close();
  return filas;
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const r of ROLES) fs.mkdirSync(path.join(OUT, r), { recursive: true });
let servidor = null, base = URL_ARG;
if (!base) {
  if (!fs.existsSync(path.join(RAIZ, "dist", "index.html"))) { console.error("recorrido: no hay dist/ (corre antes npm run build) o pasa una URL"); process.exit(1); }
  servidor = await preview({ root: RAIZ, logLevel: "error", preview: { host: "127.0.0.1", port: 4273, strictPort: true } });
  base = "http://127.0.0.1:4273/";   // puerto propio y IPv4 fijo: en 4173 suele vivir la vista previa de CobranzaFlow (en [::1])
}
let navegador;
try { navegador = await chromium.launch({ headless: true }); } catch { navegador = await chromium.launch({ headless: true, channel: "chrome" }); }
const t0 = performance.now();
const todas = [];
try {
  for (const rol of ROLES) todas.push(...await recorrerRol(navegador, base, rol));
} finally {
  await navegador.close();
  if (servidor) await new Promise(r => servidor.httpServer.close(r));
}

for (const f of todas) f.errores = f.errores.filter(e => !CONOCIDOS.some(c => c.vista === f.vista && c.rx.test(e)));
const malas = todas.filter(f => f.errores.length);
const lentas = todas.filter(f => f.ms > 5000);
const lineas = [`recorrido: ${ROLES.length} roles, ${todas.length} pasos en ${Math.round((performance.now() - t0) / 1000)} s · ${base}`];
for (const f of malas) lineas.push(`  TRUENA  ${f.rol} › ${f.vista}: ${[...new Set(f.errores)].slice(0, 6).join(" · ")}`);
for (const f of lentas) {
  const top = Object.entries(f.rutas).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => n + "× " + k).join(", ");
  lineas.push(`  lenta   ${f.rol} › ${f.vista}: ${(f.ms / 1000).toFixed(1)} s, ${f.peticiones} peticiones` + (top ? ` (${top})` : "") + (f.masLenta ? ` · la más lenta ${(f.masLenta.ms / 1000).toFixed(1)} s: ${f.masLenta.ruta}` : "") + (f.colgadas?.length ? ` · COLGADAS: ${f.colgadas.join(", ")}` : ""));
}
for (const f of todas.filter(x => x.cortes.size)) {
  const cs = [...f.cortes], nuevas = cs.filter(c => !ESCRITURA_CONOCIDA(f.rol, c)), conocidas = cs.filter(c => ESCRITURA_CONOCIDA(f.rol, c));
  if (nuevas.length) lineas.push(`  ESCRIBE al abrir  ${f.rol} › ${f.vista}: ${nuevas.join(", ")}`);
  if (conocidas.length) lineas.push(`  conocida  ${f.rol} › ${f.vista}: ${conocidas.length} escritura(s) a propósito, cortada(s): ${[...new Set(conocidas.map(c => c.replace(/\/order-files\/.*$/, "/order-files/…")))].join(", ")}`);
}
for (const f of todas.filter(x => x.nota)) lineas.push(`  nota    ${f.rol} › ${f.vista}: ${f.nota}`);
lineas.push(malas.length ? `recorrido: ${malas.length} paso(s) con errores` : "recorrido: nada truena");
fs.writeFileSync(path.join(OUT, "reporte.txt"), lineas.join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "reporte.json"), JSON.stringify(todas.map(f => ({ ...f, cortes: [...f.cortes] })), null, 1));
console.log("\n" + lineas.join("\n") + "\n(reporte completo en " + path.relative(RAIZ, path.join(OUT, "reporte.txt")) + ")");
process.exit(malas.length ? 1 : 0);
