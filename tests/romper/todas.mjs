// Tratar de ROMPER «Todas» (la lista de todas las órdenes; la usan todos los roles para buscar y revisar), su /impeccable critique del 16-oct. Cada caso
// afirma lo que DEBERÍA pasarle a quien la abre: una FALLA es un bug. Vuelta 1: escritas antes del arreglo. 1002 órdenes como en producción; el reloj
// del navegador va fijo en el miércoles 14-oct-2026 a las 12:00 de México.
// Uso: node todas.mjs <dir-capturas> [puerto=5182]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5182);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
const AHORA = new Date("2026-10-14T12:00:00-06:00");
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
    page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(30000);
    await page.clock.setFixedTime(AHORA);
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.getByRole("heading", { name: /^Todas/ }).waitFor({ timeout: 30000 });
    page.__ms = Date.now() - t0;
    await page.waitForTimeout(300);
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
const texto = p => p.evaluate(() => { const r = document.getElementById("root").cloneNode(true); r.querySelector("#log")?.remove(); return r.innerText.replace(/\s+/g, " "); });
// las fichas pintadas: sus folios distintos en la página (sin el registro del banco)
const folios = p => p.evaluate(() => { const r = document.getElementById("root").cloneNode(true); r.querySelector("#log")?.remove(); return [...new Set(r.innerText.match(/P-\d{4}/g) || [])]; });
// los folios que se ven en la primera pantalla (sin desplazarse)
const aLaVista = p => p.evaluate(() => { const alto = window.innerHeight, vistos = new Set();
  for (const el of document.querySelectorAll("#root *")) { if (el.closest("#log")) continue; const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(""); const m = t.match(/P-\d{4}/); if (!m) continue;
    const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < alto && r.width > 0) vistos.add(m[0]); }
  return [...vistos]; });
const sinAA = p => p.evaluate(() => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const malos = [], alto = window.innerHeight;
  for (const el of document.querySelectorAll("#root *")) {
    if (el.closest("#log,#lateral,#barra")) continue;
    const t = propio(el); if (!t || !el.getClientRects().length) continue;
    const r = el.getBoundingClientRect(); if (r.top > alto * 2) continue;   // (lo de las dos primeras pantallas: la página puede ser enorme)
    const s = getComputedStyle(el); if (s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    const a = lum(nums(s.color)), b = lum(fondo(el)), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (k < (grande ? 3 : 4.5)) malos.push(t.slice(0, 26) + " " + k.toFixed(1));
  }
  return [...new Set(malos)];
});

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("td-01-no-pinta-mil-fichas-de-golpe", "", async p => {
  const n = (await folios(p)).length, alto = await p.evaluate(() => document.documentElement.scrollHeight);
  ok("td-01-no-pinta-mil-fichas-de-golpe", n <= 80 && alto < 40000, `al abrir: ${n} órdenes pintadas de 1002; la página mide ${alto} px (abrió en ${p.__ms} ms)`);
});
await caso("td-02-la-mas-nueva-se-ve-al-abrir", "", async p => {
  const vistos = await aLaVista(p);
  ok("td-02-la-mas-nueva-se-ve-al-abrir", vistos.includes("P-1002") || vistos.includes("P-1001"), `en la primera pantalla: ${vistos.slice(0, 8).join(", ") || "ninguna"} (las más nuevas son P-1002 y P-1001, activas)`);
});
await caso("td-03-se-pueden-ver-mas", "", async p => {
  const antes = (await folios(p)).length;
  const mas = p.getByRole("button", { name: /Ver (\d+ )?más|Ver las siguientes|Mostrar más/i });
  const hay = await mas.count();
  if (hay) { await mas.first().click(); await espera(p, 600); }
  const despues = (await folios(p)).length, dice = await mas.first().innerText().catch(() => "");
  ok("td-03-se-pueden-ver-mas", hay > 0 && despues > antes && /quedan|de \d|\d+ más/i.test(dice + " " + await texto(p)), `al abrir ${antes}; ${hay ? "con «" + dice.replace(/\s+/g, " ") + "» pasan a " + despues : "no hay con qué ver más (o ya están todas)"}`);
});
await caso("td-04-se-filtra-por-estado", "", async p => {
  const activas = p.getByRole("button", { name: /Activas/ });
  const hay = await activas.count();
  if (hay) { await activas.first().click(); await espera(p, 600); }
  const t = await texto(p), etiqueta = hay ? (await activas.first().innerText()).replace(/\s+/g, " ") : "";
  // (en el banco las activas son de la P-0956 en adelante; lo de antes es entregado o cancelado: la palabra «Entregadas» va en el filtro mismo)
  const cerradas = (await folios(p)).filter(f => Number(f.slice(2)) <= 955);
  ok("td-04-se-filtra-por-estado", hay > 0 && /47/.test(etiqueta) && cerradas.length === 0 && /Entregadas/.test(t) && /Canceladas/.test(t),
    hay ? `«${etiqueta}»: después se ven ${cerradas.length} cerradas (${cerradas.slice(0, 4).join(", ")})` : "no hay con qué ver sólo las activas, ni las entregadas o las canceladas aparte");
});
await caso("td-05-sin-lectura-no-dice-que-no-hay", "lectura=no", async p => {
  const t = await texto(p);
  ok("td-05-sin-lectura-no-dice-que-no-hay", !/Sin órdenes que mostrar|aparecerán listadas/.test(t) && /Sin cifras|Leyendo/.test(t) && !/Todas \(0\)/.test(t),
    `sin haber leído nada de la base: «${t.slice(0, 160)}»`);
});
await caso("td-06-buscar-sigue-funcionando", "buscar=COSQUIM", async p => {
  const t = await texto(p), fs2 = await folios(p);
  ok("td-06-buscar-sigue-funcionando", fs2.length > 0 && /COSQUIM/.test(t) && !/CERVECERIA|MUNICIPIO DE LEON/.test(t), `con «COSQUIM»: ${fs2.length} órdenes; ${/CERVECERIA|MUNICIPIO DE LEON/.test(t) ? "SALEN otras" : "sólo las de COSQUIM"}`);
});
await caso("td-07-con-el-teclado", "", async p => {
  let llego = "";
  for (let i = 0; i < 40 && !llego; i++) { await p.keyboard.press("Tab"); const t = await p.evaluate(() => document.activeElement?.getAttribute("role") === "button" && /P-\d{4}/.test(document.activeElement.innerText) ? document.activeElement.innerText.match(/P-\d{4}/)[0] : ""); if (t) llego = t; }
  if (llego) { await p.keyboard.press("Enter"); await espera(p); }
  ok("td-07-con-el-teclado", !!llego && (await lineas(p, "accion OP-" + llego + " detail")).length === 1, `con Tab ${llego ? "se llega a la ficha de " + llego : "NO se llega a una ficha"}; Enter ${llego && (await lineas(p, "accion OP-" + llego + " detail")).length ? "la abre" : "no la abre"}`);
});
await caso("td-08-todo-se-lee", "", async p => {
  const malos = await sinAA(p);
  ok("td-08-todo-se-lee", malos.length === 0, malos.length ? `${malos.length} textos sin AA: ${malos.slice(0, 8).join(" · ")}` : "todo con AA");
});
for (const ancho of [1366, 1920]) {
  await caso(`td-09-cabe-a-${ancho}`, "", async p => {
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(`td-09-cabe-a-${ancho}`, r.sw <= r.cw, `a ${ancho}: ancho de la página ${r.sw} en ${r.cw}`);
  }, { viewport: { width: ancho, height: ancho === 1366 ? 768 : 1080 } });
}
await caso("td-10-pocas-se-ven-todas", "caso=pocas", async p => {
  const n = (await folios(p)).length, mas = await p.getByRole("button", { name: /Ver (\d+ )?más|Ver las siguientes|Mostrar más/i }).count();
  ok("td-10-pocas-se-ven-todas", n === 5 && mas === 0, `con 5 órdenes: ${n} a la vista; ${mas ? "SALE «ver más»" : "sin «ver más»"}`);
});

// ── vuelta 2: por donde no se diseñó (cambiar el filtro con «ver más» abierto, la orden que se entrega con el filtro puesto, el filtro sin nada, teclado) ─
const verMas = p => p.getByRole("button", { name: /Ver (\d+ )?más/i });
const filtro = (p, nombre) => p.getByRole("group", { name: /Qué órdenes ver/ }).getByRole("button", { name: new RegExp("^" + nombre) });
await caso("td-11-cambiar-el-filtro-regresa-a-las-primeras", "", async p => {
  if (await verMas(p).count()) { await verMas(p).first().click(); await espera(p, 500); }
  const antes = (await folios(p)).length;
  if (await filtro(p, "Entregadas").count()) { await filtro(p, "Entregadas").click(); await espera(p, 500); }
  const despues = (await folios(p)).length, cerradas = (await folios(p)).every(f => Number(f.slice(2)) <= 955);
  ok("td-11-cambiar-el-filtro-regresa-a-las-primeras", antes === 80 && despues === 40 && cerradas, `con «ver más» se veían ${antes}; al cambiar a «Entregadas» se ven ${despues} (${cerradas ? "todas cerradas" : "SALEN activas"})`);
});
await caso("td-12-se-entrega-una-con-el-filtro-puesto", "", async p => {
  if (await filtro(p, "Activas").count()) { await filtro(p, "Activas").click(); await espera(p, 400); }
  await p.evaluate(() => window.__cambiar("OP-P-1002", { stage: "delivered", delivered_at: new Date().toISOString() })); await espera(p, 500);
  const fs2 = await folios(p), act = await filtro(p, "Activas").innerText().catch(() => ""), ent = await filtro(p, "Entregadas").innerText().catch(() => "");
  ok("td-12-se-entrega-una-con-el-filtro-puesto", !fs2.includes("P-1002") && /46/.test(act) && /946/.test(ent), `P-1002 se entrega con «Activas» puesto: ${fs2.includes("P-1002") ? "SIGUE en la lista" : "sale de la lista"}; «${act.replace(/\s+/g, " ")}», «${ent.replace(/\s+/g, " ")}»`);
});
// (CERVECERIA: en el banco no tiene canceladas; COSQUIM sí tiene una, la P-0950)
await caso("td-13-el-filtro-sin-nada-lo-dice", "buscar=CERVECERIA", async p => {
  if (await filtro(p, "Canceladas").count()) { await filtro(p, "Canceladas").click(); await espera(p, 400); }
  const t = await texto(p);
  ok("td-13-el-filtro-sin-nada-lo-dice", /No hay órdenes canceladas con «CERVECERIA»/.test(t), `«CERVECERIA» y «Canceladas»: «${(t.match(/No hay[^.]*\./) || ["no dice nada"])[0]}»`);
});
await caso("td-14-los-filtros-con-el-teclado", "", async p => {
  let llego = "";
  for (let i = 0; i < 12 && !llego; i++) { await p.keyboard.press("Tab"); const t = await p.evaluate(() => /^Activas/.test(document.activeElement?.innerText || "") ? document.activeElement.innerText : ""); if (t) llego = t; }
  if (llego) { await p.keyboard.press("Enter"); await espera(p, 400); }
  const presionado = await filtro(p, "Activas").getAttribute("aria-pressed").catch(() => null);
  ok("td-14-los-filtros-con-el-teclado", !!llego && presionado === "true", `con Tab ${llego ? "se llega a «Activas»" : "NO se llega al filtro"}; Enter: aria-pressed ${presionado}`);
});
// v10.84.157 (la critique de la ficha, 19-oct; vuelta 1: escrita antes del arreglo) — en una pantalla angosta la ficha cabe en su columna: la cuadrícula
//   pedía 440 px aunque hubiera menos y la ficha se salía por la derecha (también en los pendientes y en «En espera», la misma cuadrícula)
await caso("td-15-la-ficha-cabe-en-su-columna", "", async p => {
  const r = await p.evaluate(() => { const f = document.querySelector('[role="button"][aria-label^="Orden "]'); const g = f?.parentElement;
    return f && g ? { f: Math.round(f.getBoundingClientRect().width), g: Math.round(g.clientWidth) } : null; });
  ok("td-15-la-ficha-cabe-en-su-columna", !!r && r.f <= r.g + 1, r ? `a 390: la ficha mide ${r.f} px en una columna de ${r.g}` : "no encontré la ficha");
}, { viewport: { width: 390, height: 844 } });
// v10.84.157 (vuelta 3) — la ficha que no es de quien la ve lleva su pie en UN renglón: «Le toca a Gerardo · …» y «Recordar», «Imprimir», «Historial»
//   y «⋯» (con «Recordar a Gerardo» se partía en dos a este ancho, el de la app: ~550 px a 1366 y a 1920)
for (const ancho of [1366, 1920]) {
  await caso(`td-16-el-pie-en-un-renglon-a-${ancho}`, "rol=secretaria", async p => {
    const r = await p.evaluate(() => { const f = [...document.querySelectorAll('[role="button"][aria-label^="Orden "]')].find(x => x.querySelector("[data-pie-de-la-ficha]"));
      const pie = f?.querySelector("[data-pie-de-la-ficha]"); if (!pie) return null;
      const tops = [...pie.children].filter(c => c.getClientRects().length).map(c => { const b = c.getBoundingClientRect(); return Math.round(b.top + b.height / 2); });
      return { pn: f.getAttribute("aria-label").split(",")[0], ancho: Math.round(f.getBoundingClientRect().width), renglones: new Set(tops.map(t => Math.round(t / 10))).size, texto: pie.innerText.replace(/\s+/g, " ").slice(0, 90) }; });
    ok(`td-16-el-pie-en-un-renglon-a-${ancho}`, !!r && r.renglones === 1, r ? `${r.pn} (ficha de ${r.ancho} px): el pie en ${r.renglones} renglón(es) · «${r.texto}»` : "ninguna ficha trae el pie de quien no actúa");
  }, { viewport: { width: ancho, height: ancho === 1920 ? 1080 : 768 } });
}

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\ntodas: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
