// Tratar de ROMPER los AVISOS (la campana y su bandeja; los ven todos los roles muchas veces al día), su /impeccable critique del 16-oct. Cada caso
// afirma lo que DEBERÍA pasarle a quien la abre: una FALLA es un bug. Vuelta 1: escritas antes del arreglo.
// En el banco: 5 avisos (3 sin leer): a1 (P-0611), a2 (P-0612, con motivo), a3 (H-3000, una orden que ya no está entre las cargadas), a4 y a5 leídos.
// Uso: node avisos.mjs <dir-capturas> [puerto=5180]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5180);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, { viewport = { width: 1366, height: 768 } } = {}) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const ctx = await browser.newContext({ viewport, timezoneId: "America/Mexico_City", locale: "es-MX" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !deFuera(m)) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.getByRole("button", { name: /^Notificaciones/ }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(400);
    await fn(page);
    const nativos = (await lineas(page, "alert:")).concat(await lineas(page, "confirm:"));
    if (nativos.length) ok(nombre + " · diálogo nativo", false, nativos.join(" ; ").slice(0, 200));
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png" }).catch(() => {});
  await ctx.close();
}
const log = async p => (await p.textContent("#log")) || "";
const lineas = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref));
const espera = (p, ms = 300) => p.waitForTimeout(ms);
const texto = p => p.evaluate(() => { const r = document.getElementById("root"), l = document.getElementById("log"); return r.innerText.replace(l ? l.innerText : "", "").replace(/\s+/g, " "); });
// el aviso por su texto (en la bandeja de antes es un renglón con clic; en la nueva, un botón)
const aviso = (p, re) => p.getByText(re).first();
const campana = p => p.getByRole("button", { name: /^Notificaciones/ });
const sinAA = p => p.evaluate(() => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const malos = [];
  for (const el of document.querySelectorAll("#root *")) {
    if (el.closest("#log,#barra")) continue;
    const t = propio(el); if (!t || !el.getClientRects().length) continue;
    const s = getComputedStyle(el); if (s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    const a = lum(nums(s.color)), b = lum(fondo(el)), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (k < (grande ? 3 : 4.5) || parseFloat(s.fontSize) < 10) malos.push(t.slice(0, 30) + " " + k.toFixed(1) + (parseFloat(s.fontSize) < 10 ? " (" + s.fontSize + ")" : ""));
  }
  return [...new Set(malos)];
});

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("av-01-el-aviso-lleva-a-su-orden", "", async p => {
  await aviso(p, /P-0611 · DELDHY/).click(); await espera(p, 400);
  ok("av-01-el-aviso-lleva-a-su-orden", (await lineas(p, "accion OP-P-0611 detail")).length === 1 && (await lineas(p, "db markRead a1")).length === 1,
    `tocar el aviso de P-0611: ${(await lineas(p, "accion OP-P-0611 detail")).length ? "abre la orden" : "NO abre la orden"}; ${(await lineas(p, "db markRead a1")).length ? "lo marca leído" : "no lo marca"}`);
});
await caso("av-02-borrar-todas-pregunta", "", async p => {
  await p.getByRole("button", { name: /Borrar todas/ }).click(); await espera(p);
  const deUna = (await lineas(p, "db deleteAllNotifications")).length;
  const si = p.getByRole("button", { name: /^Sí, borrar/ });
  const pregunta = await si.count();
  if (pregunta) { await si.click(); await espera(p, 400); }
  const t = await texto(p);
  ok("av-02-borrar-todas-pregunta", deUna === 0 && pregunta === 1 && (await lineas(p, "db deleteAllNotifications")).length === 1 && /Sin avisos/.test(t),
    `«Borrar todas»: ${deUna ? "BORRA de un clic" : "no borra de un clic"}; ${pregunta ? "pregunta («Sí, borrar»)" : "no pregunta"}; después: «${t.slice(-40)}»`);
});
await caso("av-03-si-no-se-marco-no-lo-da-por-hecho", "falla=marcar", async p => {
  await aviso(p, /P-0611 · DELDHY/).click(); await espera(p, 400);
  if (!(await p.getByRole("dialog").count()) && !(await aviso(p, /P-0611 · DELDHY/).count())) { await campana(p).click(); await espera(p); }
  const sinLeer = await campana(p).getAttribute("aria-label");
  const dijo = (await lineas(p, "aviso")).join(" ");
  ok("av-03-si-no-se-marco-no-lo-da-por-hecho", /3 sin leer/.test(sinLeer || "") && /No se pudo marcar/.test(dijo),
    `la base no marcó a1: la campana dice «${sinLeer}» (sigue sin leer: 3); ${/No se pudo marcar/.test(dijo) ? "lo dice" : "NO dice nada"}`);
});
await caso("av-04-sin-lectura-no-dice-que-no-hay", "falla=leer", async p => {
  const t = await texto(p);
  ok("av-04-sin-lectura-no-dice-que-no-hay", !/Sin notificaciones|Sin avisos/.test(t) && /No se pudieron leer/.test(t) && (await p.getByRole("button", { name: /Reintentar/ }).count()) === 1,
    `la lectura de los avisos falló: «${t.slice(0, 120)}»`);
});
await caso("av-05-es-una-ventana", "abierta=no", async p => {
  await campana(p).focus(); await p.keyboard.press("Enter"); await espera(p, 400);
  const dentro = await p.evaluate(() => !!document.activeElement?.closest?.("[role=dialog]"));
  const nombre = await p.getByRole("dialog").getAttribute("aria-label").catch(() => null);
  await p.keyboard.press("Escape"); await espera(p);
  const cerro = (await p.getByRole("dialog").count()) === 0 && !(await p.getByText(/P-0611 · DELDHY/).count());
  const regreso = await p.evaluate(() => /^Notificaciones/.test(document.activeElement?.getAttribute("aria-label") || ""));
  ok("av-05-es-una-ventana", dentro && !!nombre && cerro && regreso, `al abrirla con la campana: ${dentro ? "el foco entra" : "el foco NO entra"} (${nombre ? "«" + nombre + "»" : "sin role=dialog"}); Esc ${cerro ? "la cierra" : "NO la cierra"}; el foco ${regreso ? "regresa a la campana" : "NO regresa a la campana"}`);
});
await caso("av-06-con-el-teclado", "abierta=no", async p => {
  await campana(p).focus(); await p.keyboard.press("Enter"); await espera(p, 400);
  let llego = "";
  for (let i = 0; i < 12 && !llego; i++) { await p.keyboard.press("Tab"); const t = await p.evaluate(() => (document.activeElement?.getAttribute("aria-label") || document.activeElement?.innerText || "")); if (/P-0611 · DELDHY/.test(t)) llego = t; }
  if (llego) { await p.keyboard.press("Enter"); await espera(p, 400); }
  ok("av-06-con-el-teclado", !!llego && (await lineas(p, "accion OP-P-0611 detail")).length === 1, `con Tab ${llego ? "se llega al aviso de P-0611" : "NO se llega a ningún aviso"}; Enter ${(await lineas(p, "accion OP-P-0611 detail")).length ? "abre la orden" : "no abre nada"}`);
});
await caso("av-07-todo-se-lee", "", async p => {
  const malos = await sinAA(p);
  ok("av-07-todo-se-lee", malos.length === 0, malos.length ? `${malos.length} textos sin AA o de menos de 10 px: ${malos.slice(0, 8).join(" · ")}` : "todo con AA y de 10 px o más");
});
await caso("av-08-la-orden-que-ya-no-esta", "", async p => {
  const t0 = await texto(p);
  await aviso(p, /H-3000 se entregó/).click(); await espera(p, 400);
  ok("av-08-la-orden-que-ya-no-esta", /ya no está entre las cargadas/.test(t0) && (await lineas(p, "accion OP-H-3000")).length === 0 && (await lineas(p, "db markRead a3")).length === 1,
    `el aviso de H-3000 (no cargada): ${/ya no está entre las cargadas/.test(t0) ? "dice que ya no está entre las cargadas" : "NO lo dice"}; al tocarlo ${(await lineas(p, "accion OP-H-3000")).length ? "INTENTA abrirla" : "no promete abrirla"} y ${(await lineas(p, "db markRead a3")).length ? "lo marca leído" : "no lo marca"}`);
});
await caso("av-09-marcar-todas-dice-que-hace", "", async p => {
  const b = await p.getByRole("button", { name: /^Marcar todas como leídas$/ }).count(), viejo = await p.getByRole("button", { name: /^Leídas$/ }).count();
  ok("av-09-marcar-todas-dice-que-hace", b === 1 && viejo === 0, `el botón: ${b ? "«Marcar todas como leídas»" : viejo ? "«Leídas» (¿leídas qué?)" : "no está"}`);
});
await caso("av-10-borrar-uno-dice-cual", "", async p => {
  const n = await p.getByRole("button", { name: /Borrar el aviso: .*P-0611/ }).count();
  ok("av-10-borrar-uno-dice-cual", n === 1, `la X de cada aviso, para el lector de pantalla: ${n ? "«Borrar el aviso: …P-0611…»" : "sólo «Borrar» (¿cuál?)"}`);
});

// ── vuelta 2: por donde no se diseñó (llega uno con la bandeja abierta, doble clic en «Sí, borrar», cancelar, la base no borra, el vacío de verdad) ──
await caso("av-11-llega-uno-con-la-bandeja-abierta", "", async p => {
  await p.evaluate(() => window.__llega({ id: "a9", order_id: "OP-P-0613", message: "🆕 P-0613 regresó de maquila", reason: null, by_user: "produccion", created_at: new Date().toISOString(), read: false })); await espera(p, 400);
  const t = await texto(p), cuenta = await campana(p).getAttribute("aria-label");
  ok("av-11-llega-uno-con-la-bandeja-abierta", /P-0613 regresó de maquila/.test(t) && /4 sin leer/.test(cuenta || ""), `llega un aviso con la bandeja abierta: ${/P-0613 regresó/.test(t) ? "sale" : "NO sale"}; la campana «${cuenta}»`);
});
await caso("av-12-doble-clic-en-si-borrar-borra-una-vez", "", async p => {
  await p.getByRole("button", { name: /Borrar todas/ }).click(); await espera(p);
  const si = p.getByRole("button", { name: /^Sí, borrar/ });
  if (await si.count()) { await si.dblclick(); await espera(p, 500); }
  ok("av-12-doble-clic-en-si-borrar-borra-una-vez", (await lineas(p, "db deleteAllNotifications")).length === 1, `doble clic en «Sí, borrar»: la base recibió ${(await lineas(p, "db deleteAllNotifications")).length} borrado(s)`);
});
await caso("av-13-cancelar-el-borrado", "", async p => {
  await p.getByRole("button", { name: /Borrar todas/ }).click(); await espera(p);
  const cancelar = p.getByRole("button", { name: /^Cancelar$/ });
  if (await cancelar.count()) { await cancelar.click(); await espera(p); }
  const t = await texto(p);
  ok("av-13-cancelar-el-borrado", (await lineas(p, "db deleteAllNotifications")).length === 0 && /P-0611 · DELDHY/.test(t), `«Borrar todas» y luego «Cancelar»: ${(await lineas(p, "db deleteAllNotifications")).length ? "BORRÓ" : "no borró"}; los avisos ${/P-0611/.test(t) ? "siguen" : "NO siguen"}`);
});
await caso("av-14-la-base-no-borra", "falla=borrar", async p => {
  await p.getByRole("button", { name: /Borrar todas/ }).click(); await espera(p);
  const si = p.getByRole("button", { name: /^Sí, borrar/ });
  if (await si.count()) { await si.click(); await espera(p, 500); }
  const t = await texto(p), dijo = (await lineas(p, "aviso")).join(" ");
  ok("av-14-la-base-no-borra", /P-0611 · DELDHY/.test(t) && /No se pudieron borrar/.test(dijo), `la base no borró: los avisos ${/P-0611/.test(t) ? "siguen a la vista" : "DESAPARECIERON (y al recargar regresan)"}; ${/No se pudieron borrar/.test(dijo) ? "lo dice" : "NO lo dice"}`);
});
await caso("av-15-vacio-de-verdad", "caso=vacio", async p => {
  const t = await texto(p);
  ok("av-15-vacio-de-verdad", /Sin avisos|Sin notificaciones/.test(t) && !(await p.getByRole("button", { name: /Borrar todas/ }).count()), `sin avisos: «${t.slice(0, 80)}»`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\navisos: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
