// Tratar de ROMPER la «Torre de Control» (con la que abre Dirección), su /impeccable critique del 16-oct. Cada caso afirma lo que DEBERÍA ver Marcelo:
// una FALLA es un bug. Vuelta 1: escritas antes del arreglo. El reloj del navegador va fijo en el miércoles 14-oct-2026 a las 12:00 de México.
// En el banco: 6 paradas de verdad (reimprimir, sin folio, vencida, 5 días sin avanzar, por validar, el cliente no aprueba; $21,000) y 7 con datos por
// capturar (6 sin fecha de entrega —3 en rojo por la regla— y 1 sin precio; $34,500), 3 sanas y 1 en espera.
// Uso: node torre.mjs <dir-capturas> [puerto=5181]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5181);
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
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.clock.setFixedTime(AHORA);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.getByRole("heading", { name: /Torre de Control/ }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(300);
    await fn(page);
    const nativos = (await lineas(page, "alert:")).concat(await lineas(page, "confirm:"));
    if (nativos.length) ok(nombre + " · diálogo nativo", false, nativos.join(" ; ").slice(0, 200));
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png", fullPage: true }).catch(() => {});
  await ctx.close();
}
const log = async p => (await p.textContent("#log")) || "";
const lineas = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref));
const espera = (p, ms = 300) => p.waitForTimeout(ms);
// (el texto VIVO, con su CSS: una copia suelta no aplica el text-transform y no vería «14 De Octubre»)
const texto = p => p.evaluate(() => { const r = document.getElementById("root"), l = document.getElementById("log"); return r.innerText.replace(l ? l.innerText : "", "").replace(/\s+/g, " "); });
// el texto de la caja de las crónicas (la que dice «ve directo con ellos»)
const cronicas = p => p.evaluate(() => { const t = [...document.querySelectorAll("#root *")].find(e => /ve directo con ellos/i.test([...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("")));
  let x = t; for (let i = 0; i < 4 && x && !/P-0\d{3}/.test(x.innerText); i++) x = x.parentElement; return x ? x.innerText.replace(/\s+/g, " ") : ""; });
const sinAA = p => p.evaluate(() => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const malos = [];
  for (const el of document.querySelectorAll("#root *")) {
    if (el.closest("#log,#lateral,#barra")) continue;
    const t = propio(el); if (!t || !el.getClientRects().length) continue;
    const s = getComputedStyle(el); if (s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    const a = lum(nums(s.color)), b = lum(fondo(el)), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    // (la opacidad de un renglón «en espera» también cuenta: se compone con su color)
    const op = Number(s.opacity) * Number(getComputedStyle(el.parentElement || el).opacity);
    if (k * (op < 1 ? op : 1) < (grande ? 3 : 4.5)) malos.push(t.slice(0, 30) + " " + k.toFixed(1));
  }
  return [...new Set(malos)];
});

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("tr-01-detenidas-es-trabajo-parado", "", async p => {
  const t = await texto(p);
  const m = t.match(/(\d+) órden(es)? detenidas?/);
  ok("tr-01-detenidas-es-trabajo-parado", m && Number(m[1]) === 6 && /7 con datos por capturar/.test(t), `arriba: «${(t.match(/\d+ órden[^·]*·[^·]*·[^·]*/) || ["no dice cuántas"])[0].trim()}»; ${/7 con datos por capturar/.test(t) ? "aparte, 7 con datos por capturar" : "los datos por capturar NO van aparte"} (paradas: 6; sin fecha o sin precio: 7)`);
});
await caso("tr-02-las-cronicas-no-son-datos", "", async p => {
  const c = await cronicas(p);
  ok("tr-02-las-cronicas-no-son-datos", !!c && !/Sin fecha de entrega|Sin precio/.test(c), `las crónicas: ${c ? (/Sin fecha de entrega|Sin precio/.test(c) ? "TRAEN «sin fecha»/«sin precio» (" + (c.match(/P-07\d\d/g) || []).join(", ") + ")" : "sólo trabajo parado") : "no hay caja de crónicas"}`);
});
await caso("tr-03-lo-atorado-es-lo-parado", "", async p => {
  const t = await texto(p);
  ok("tr-03-lo-atorado-es-lo-parado", /\$21,000(\.00)? atorados/.test(t), `«${(t.match(/\$[\d,.]+ atorados/) || ["no dice cuánto"])[0]}» (lo de las 6 paradas: $21,000; con los datos por capturar sumaba $55,500)`);
});
await caso("tr-04-sin-lectura-no-dice-que-todo-avanza", "lectura=no", async p => {
  const t = await texto(p);
  ok("tr-04-sin-lectura-no-dice-que-todo-avanza", !/Nada detenido|avanza normal/.test(t) && /Sin cifras/.test(t), `sin haber leído nada: «${t.slice(0, 160)}»`);
});
await caso("tr-05-la-fecha-en-espanol", "", async p => {
  const t = await texto(p);
  ok("tr-05-la-fecha-en-espanol", /14 de octubre/.test(t) && !/De Octubre/.test(t), `la fecha: «${(t.match(/\w+,? 14 \w+ \w+/) || ["no sale"])[0]}»`);
});
await caso("tr-06-todo-se-lee", "", async p => {
  // (abiertas las sanas y lo que espera, para medirlo todo)
  for (const b of await p.getByRole("button", { name: /^(Avanzando|EN DISEÑO|Gerardo|Noemí)/ }).all()) await b.click().catch(() => {});
  const malos = await sinAA(p);
  ok("tr-06-todo-se-lee", malos.length === 0, malos.length ? `${malos.length} textos sin AA: ${malos.slice(0, 8).join(" · ")}` : "todo con AA");
});
await caso("tr-07-el-folio-con-el-teclado", "", async p => {
  let llego = "";
  for (let i = 0; i < 40 && !llego; i++) { await p.keyboard.press("Tab"); const t = await p.evaluate(() => (document.activeElement?.innerText || "").trim()); if (/^P-0\d{3}$/.test(t)) llego = t; }
  if (llego) { await p.keyboard.press("Enter"); await espera(p); }
  ok("tr-07-el-folio-con-el-teclado", !!llego && (await lineas(p, "accion OP-" + llego + " detail")).length === 1, `con Tab ${llego ? "se llega al folio " + llego : "NO se llega a ningún folio (sólo al ojo)"}; Enter ${llego && (await lineas(p, "accion OP-" + llego + " detail")).length ? "lo abre" : "no lo abre"}`);
});
await caso("tr-08-sin-rayas-largas", "", async p => {
  const t = await texto(p);
  const rayas = (t.match(/[^\s]* — [^\s]*/g) || []);
  ok("tr-08-sin-rayas-largas", rayas.length === 0, rayas.length ? "dice: «" + rayas.slice(0, 4).join("», «") + "»" : "sin «—» en lo que dice");
});
await caso("tr-09-los-datos-por-capturar-con-sus-acciones", "", async p => {
  const abre = p.getByRole("button", { name: /datos por capturar/i });
  const hay = await abre.count();
  if (hay) { await abre.first().click(); await espera(p); }
  const t = await texto(p), resolver = await p.getByRole("button", { name: /Resolver/ }).count();
  const estan = ["P-0701", "P-0704", "P-0707"].every(x => t.includes(x));
  ok("tr-09-los-datos-por-capturar-con-sus-acciones", hay > 0 && estan && resolver >= 7, `${hay ? "«datos por capturar» se abre" : "NO hay sección de datos por capturar"}; ${estan ? "salen P-0701, P-0704 y P-0707" : "no salen"}; «Resolver» ${resolver}`);
});
await caso("tr-10-lupita-sin-paradas-en-verde", "", async p => {
  const chip = await p.evaluate(() => { const el = [...document.querySelectorAll("#root *")].find(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() === "Lupita")); let x = el; for (let i = 0; i < 3 && x; i++) x = x.parentElement; return x ? x.innerText.replace(/\s+/g, " ") : ""; });
  ok("tr-10-lupita-sin-paradas-en-verde", !/Lupita\s*\d/.test(chip), `el semáforo de Lupita: «${chip.slice(0, 40)}» (no tiene trabajo parado: sus 6 son datos por capturar)`);
});
for (const ancho of [1366, 1920]) {
  await caso(`tr-11-cabe-a-${ancho}`, "", async p => {
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(`tr-11-cabe-a-${ancho}`, r.sw <= r.cw, `a ${ancho}: ancho de la página ${r.sw} en ${r.cw}`);
  }, { viewport: { width: ancho, height: ancho === 1366 ? 768 : 1080 } });
}

// ── vuelta 2: por donde no se diseñó (capturan la fecha con la vista abierta, sólo datos, todo sano, recordar un dato, el teclado) ────────────────
await caso("tr-12-le-ponen-fecha-con-la-vista-abierta", "", async p => {
  await p.evaluate(() => window.__cambiar("OP-P-0704", { due_date: "2026-10-30" })); await espera(p, 400);
  const t = await texto(p);
  ok("tr-12-le-ponen-fecha-con-la-vista-abierta", /6 con datos por capturar/.test(t) && /\b6 órdenes detenidas/.test(t), `a P-0704 le capturan la fecha: «${(t.match(/\d+ con datos por capturar/) || ["no dice"])[0]}»; detenidas: «${(t.match(/\d+ órden(es)? detenidas?/) || ["?"])[0]}»`);
});
await caso("tr-13-solo-datos-no-es-alarma", "caso=calma", async p => {
  const t = await texto(p), c = await cronicas(p);
  ok("tr-13-solo-datos-no-es-alarma", /Nada detenido/.test(t) && /7 con datos por capturar/.test(t) && !c, `sin trabajo parado y 7 datos por capturar: ${/Nada detenido/.test(t) ? "«Nada detenido»" : "NO dice «Nada detenido»"}; ${c ? "SALEN crónicas" : "sin crónicas"}`);
});
await caso("tr-14-todo-sano", "caso=sana", async p => {
  const t = await texto(p);
  ok("tr-14-todo-sano", /Nada detenido/.test(t) && !/datos por capturar/.test(t), `todo sano: «${t.slice(0, 120)}»`);
});
await caso("tr-15-recordar-un-dato", "", async p => {
  await p.getByRole("button", { name: /datos por capturar/i }).first().click(); await espera(p);
  const fila = p.locator("div", { has: p.getByRole("button", { name: "P-0704", exact: true }) }).filter({ has: p.getByRole("button", { name: /Recordar/ }) }).last();
  await fila.getByRole("button", { name: /Recordar/ }).click(); await espera(p);
  ok("tr-15-recordar-un-dato", (await lineas(p, "recordar OP-P-0704")).length === 1, `«Recordar» en P-0704 (sin fecha): ${(await lineas(p, "recordar OP-P-0704")).length ? "le recuerda a quien le toca" : "NO hace nada"}`);
});
await caso("tr-16-los-datos-con-el-teclado", "", async p => {
  let llego = false;
  for (let i = 0; i < 60 && !llego; i++) { await p.keyboard.press("Tab"); llego = await p.evaluate(() => /datos por capturar/i.test(document.activeElement?.innerText || "")); }
  if (llego) { await p.keyboard.press("Enter"); await espera(p); }
  const abierto = await p.getByRole("button", { name: /datos por capturar/i }).first().getAttribute("aria-expanded").catch(() => null);
  ok("tr-16-los-datos-con-el-teclado", llego && abierto === "true", `con Tab ${llego ? "se llega a «datos por capturar»" : "NO se llega"}; Enter: aria-expanded ${abierto}`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\ntorre: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
