// Tratar de ROMPER la LISTA DE ÓRDENES DE COMPRA (Activas e Histórico; Karla, Lupita y Dirección; 38 OC de varios productos al mes), su /impeccable
// critique del 16-oct. Cada caso afirma lo que DEBERÍA pasarle a quien la abre: una FALLA es un bug. Vuelta 1: escritas antes del arreglo.
// (La tanda «oc» es otra: la ventana del folio de la OC.) En el banco: OC-0970 HOTSSON (abierta), OC-0971 PORTLAND (con folio F-210), OC-0972 CASTORES
// (con candado), OC-0950 COSMOS (completada), OC-0951 CABLESERV (cancelada, con su motivo) y OC-0990 (de un solo producto, oculta).
// Uso: node oc-lista.mjs <dir-capturas> [puerto=5175]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5175);
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
    await page.getByRole("heading", { name: /Órdenes de Compra/ }).waitFor({ timeout: 30000 });
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
const texto = p => p.evaluate(() => { const r = document.getElementById("root"), l = document.getElementById("log"), b = document.getElementById("barra"); return r.innerText.replace(l ? l.innerText : "", "").replace(b ? b.innerText : "", "").replace(/\s+/g, " "); });
const pestana = (p, re) => p.getByRole("tab", { name: re }).or(p.getByRole("button", { name: re })).first();
const sinAA = p => p.evaluate(() => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const malos = [];
  for (const el of document.querySelectorAll("#root *")) {
    if (el.closest("#log,#barra,input,textarea")) continue;
    const t = propio(el); if (!t || !el.getClientRects().length) continue;
    const s = getComputedStyle(el); if (s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    const a = lum(nums(s.color)), b = lum(fondo(el)), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (k < (grande ? 3 : 4.5) || parseFloat(s.fontSize) < 10) malos.push(t.slice(0, 26) + " " + k.toFixed(1) + (parseFloat(s.fontSize) < 10 ? " (" + s.fontSize + ")" : ""));
  }
  return [...new Set(malos)];
});

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("ocl-01-sin-lectura-no-dice-vacio", "lectura=no", async p => {
  const t = await texto(p); const miente = /Sin Órdenes de Compra|Activas \(0\)|Histórico \(0\)/.test(t);
  ok("ocl-01-sin-lectura-no-dice-vacio", !miente && /no se pud/i.test(t), `sin lectura de la base: ${miente ? "dice que no hay OC (o cuenta 0)" : "no dice que no hay"}${/no se pud/i.test(t) ? "; lo dice" : "; no dice que no pudo leer"}`);
});
await caso("ocl-02-abrir-con-el-teclado", "", async p => {
  let llego = false;
  for (let i = 0; i < 14 && !llego; i++) { await p.keyboard.press("Tab"); llego = await p.evaluate(() => /OC-0970/.test(document.activeElement?.innerText || "") || /OC-0970/.test(document.activeElement?.getAttribute("aria-label") || "")); }
  if (llego) { await p.keyboard.press("Enter"); await espera(p, 400); }
  const abierta = /Volver a la lista/.test(await texto(p));
  ok("ocl-02-abrir-con-el-teclado", llego && abierta, `con Tab ${llego ? "se llega a OC-0970" : "NO se llega a ninguna OC"}; ${abierta ? "Enter la abre" : "no se abre"}`);
});
await caso("ocl-03-pestanas", "", async p => {
  const tabs = await p.getByRole("tab").count(); const sel = await p.getByRole("tab", { selected: true }).count();
  ok("ocl-03-pestanas", tabs === 2 && sel === 1, `pestañas (role=tab): ${tabs}; elegida: ${sel}`);
});
await caso("ocl-04-AA", "", async p => {
  const a = await sinAA(p); await pestana(p, /Histórico/).click(); await espera(p, 400);
  const anio = p.getByRole("button", { name: /2026/ }).first(); if (await anio.count()) { await anio.click().catch(() => {}); await espera(p, 300); }
  const mes = p.getByRole("button", { name: /Octubre/ }).first(); if (await mes.count()) { await mes.click().catch(() => {}); await espera(p, 300); }
  const b = await sinAA(p); const todos = [...new Set([...a, ...b])];
  ok("ocl-04-AA", todos.length === 0, todos.length ? "sin AA o de menos de 10 px: " + todos.slice(0, 9).join(" | ") : "todo con AA");
});
await caso("ocl-05-sin-jerga", "caso=vacio", async p => {
  const t = await texto(p); const malas = [/complejas/i, /\bClick\b/, /\bOCs\b/].filter(r => r.test(t)).map(String);
  ok("ocl-05-sin-jerga", malas.length === 0, malas.length ? "dice: " + malas.join(" ") : "en palabras de Karla");
});
await caso("ocl-06-vacio-de-verdad", "caso=vacio", async p => {
  const t = await texto(p);
  ok("ocl-06-vacio-de-verdad", /no hay|Todavía no hay|Sin órdenes de compra/i.test(t) && !/no se pud/i.test(t), "sin OC de varios productos (lectura buena): " + (/no hay|Sin órdenes de compra/i.test(t) ? "lo dice" : "no lo dice"));
});
await caso("ocl-07-motivo-de-la-cancelada", "", async p => {
  await pestana(p, /Histórico/).click(); await espera(p, 400);
  const mes = p.getByRole("button", { name: /Octubre/ }).first(); if (await mes.count()) { await mes.click().catch(() => {}); await espera(p, 300); }
  const r = await p.getByText(/El cliente canceló el pedido/).first().evaluate(el => ({ tam: parseFloat(getComputedStyle(el).fontSize) })).catch(() => null);
  ok("ocl-07-motivo-de-la-cancelada", !!r && r.tam >= 10, r ? `el motivo de la cancelada a ${r.tam} px` : "no se ve el motivo de OC-0951");
});
await caso("ocl-08-sin-simples", "", async p => {
  const t = await texto(p);
  ok("ocl-08-sin-simples", /OC-0970/.test(t) && !/OC-0990/.test(t), `Activas: OC-0970 ${/OC-0970/.test(t) ? "sí" : "NO"}; la de un producto (OC-0990) ${/OC-0990/.test(t) ? "SÍ (debería ocultarse)" : "oculta"}`);
});
for (const [ancho, alto] of [[1366, 768], [1920, 1080]]) {
  await caso(`ocl-09-cabe-${ancho}`, "", async p => {
    const ancha = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(`ocl-09-cabe-${ancho}`, !ancha, ancha ? "la página se sale a lo ancho" : "cabe");
  }, { viewport: { width: ancho, height: alto } });
}

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\noc-lista: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
