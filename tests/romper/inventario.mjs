// Tratar de ROMPER el «INVENTARIO CUADRA» (el catálogo de productos a stock, sus movimientos y el historial; Dirección, Karla, Lupita y Gerardo), su
// /impeccable critique del 16-oct. Cada caso afirma lo que DEBERÍA pasarle a quien lo abre: una FALLA es un bug. Vuelta 1: escritas antes del arreglo.
// En el banco: p1 «Volante Cuadra carta» (1,500), p2 «Díptico corporativo» (0, de un pool), p3 «Etiqueta de caja» (−20); tres movimientos (una venta,
// un ajuste, una entrada de producción) y dos órdenes Cuadra. Detrás, una «app» con su buscador (#atras-*).
// Uso: node inventario.mjs <dir-capturas> [puerto=5177]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5177);
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
    await page.getByText("Inventario Cuadra").first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
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
const pestana = (p, re) => p.getByRole("button", { name: re }).or(p.getByRole("tab", { name: re })).first();
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
    if (el.closest("input,textarea") ) continue;
    const a = lum(nums(s.color)), b = lum(fondo(el)), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (k < (grande ? 3 : 4.5) || parseFloat(s.fontSize) < 10) malos.push(t.slice(0, 26) + " " + k.toFixed(1) + (parseFloat(s.fontSize) < 10 ? " (" + s.fontSize + ")" : ""));
  }
  return [...new Set(malos)];
});

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("inv-01-falla-no-es-vacio", "falla=productos", async p => {
  const t = await texto(p);
  const miente = /Sin productos en stock|primer producto/.test(t), reintentar = await p.getByRole("button", { name: /Reintentar/ }).count();
  ok("inv-01-falla-no-es-vacio", !miente && reintentar >= 1, `la lectura del catálogo falló: ${miente ? "dice «Sin productos en stock»" : "no dice que está vacío"}; «Reintentar» ${reintentar ? "sí" : "no"}`);
});
await caso("inv-02-reintentar-trae", "falla=productos-una", async p => {
  const b = p.getByRole("button", { name: /Reintentar/ });
  if (await b.count()) { await b.first().click(); await espera(p, 600); }
  const t = await texto(p);
  ok("inv-02-reintentar-trae", /Volante Cuadra carta/.test(t), `la primera lectura falló: ${(await b.count()) || /Volante/.test(t) ? "" : "sin «Reintentar»; "}${/Volante Cuadra carta/.test(t) ? "con «Reintentar» llega el catálogo" : "el catálogo no llega"}`);
});
await caso("inv-03-movimientos-falla", "falla=movimientos", async p => {
  await pestana(p, /Movimientos/).click(); await espera(p);
  const t = await texto(p);
  ok("inv-03-movimientos-falla", !/Sin movimientos todavía/.test(t) && /no se pud/i.test(t), `la lectura de los movimientos falló: ${/Sin movimientos todavía/.test(t) ? "dice «Sin movimientos todavía»" : "no dice que no hay"}${/no se pud/i.test(t) ? "; lo dice" : "; no dice que falló"}`);
});
await caso("inv-04-historial-falla", "falla=historial", async p => {
  await pestana(p, /Historial/).click(); await espera(p);
  const t = await texto(p);
  ok("inv-04-historial-falla", !/Sin órdenes Cuadra todavía/.test(t) && /no se pud/i.test(t), `la lectura del historial falló: ${/Sin órdenes Cuadra todavía/.test(t) ? "dice «Sin órdenes Cuadra todavía»" : "no dice que no hay"}${/no se pud/i.test(t) ? "; lo dice" : "; no dice que falló"}`);
});
await caso("inv-05-movimientos-en-espanol", "", async p => {
  await pestana(p, /Movimientos/).click(); await espera(p);
  const t = await texto(p);
  const ingles = ["PRODUCED", "SOLD", "ADJUST"].filter(x => t.includes(x));
  ok("inv-05-movimientos-en-espanol", !ingles.length && /Venta/.test(t) && /Ajuste/.test(t), ingles.length ? "los movimientos dicen: " + ingles.join(", ") : "venta, ajuste y entrada en español");
});
await caso("inv-06-borrar-pregunta-en-la-app", "", async p => {
  // p2 tiene 0 en stock: se puede quitar del catálogo
  const tarjeta = p.getByText("Díptico corporativo").first();
  const borrar = p.getByRole("button", { name: /Eliminar|Quitar/ }).first();
  await tarjeta.waitFor(); await borrar.click(); await espera(p, 400);
  const nativo = (await lineas(p, "confirm:")).length;
  const si = p.getByRole("button", { name: /^Sí, quitar|^Quitar del catálogo|^Sí, eliminar/ });
  const pregunta = await si.count();
  if (pregunta) { await si.first().click(); await espera(p, 500); }
  const borrado = (await lineas(p, "db deleteClientProduct p2")).length;
  // el diálogo nativo lo cuenta caso(); aquí: que la app pregunte y que borre una vez
  ok("inv-06-borrar-pregunta-en-la-app", !nativo && pregunta >= 1 && borrado === 1, `quitar el Díptico (0 en stock): ${nativo ? "pregunta con confirm() del navegador" : pregunta ? "pregunta en la app" : "no pregunta"}; borrado ${borrado} vez`);
});
await caso("inv-07-AA", "", async p => {
  const malos = await sinAA(p);
  await pestana(p, /Movimientos/).click(); await espera(p); const m2 = await sinAA(p);
  await pestana(p, /Historial/).click(); await espera(p); const m3 = await sinAA(p);
  const todos = [...new Set([...malos, ...m2, ...m3])];
  ok("inv-07-AA", todos.length === 0, todos.length ? "sin AA o de menos de 10 px: " + todos.slice(0, 9).join(" | ") : "todo con AA");
});
await caso("inv-08-es-dialogo", "", async p => {
  const d = await p.getByRole("dialog", { name: /Inventario Cuadra/ }).count();
  const tabs = await p.getByRole("tab").count();
  await pestana(p, /Productos/).focus();
  const fuera = [];
  for (let i = 0; i < 14; i++) { await p.keyboard.press("Tab"); const w = await p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? "body" : a.closest("#barra") ? (a.id || a.tagName) : ""; }); if (w) fuera.push(w); }
  ok("inv-08-es-dialogo", d === 1 && tabs >= 3 && fuera.length === 0, `role=dialog «Inventario Cuadra»: ${d}; pestañas (role=tab): ${tabs}; ${fuera.length ? "el foco se va atrás: " + [...new Set(fuera)].join(", ") : "el Tab no se sale"}`);
});
await caso("inv-09-esc-cierra", "", async p => {
  await p.keyboard.press("Escape"); await espera(p);
  ok("inv-09-esc-cierra", (await lineas(p, "cerrar")).length === 1, `Esc: ${(await lineas(p, "cerrar")).length ? "cierra" : "no cierra"}`);
});
await caso("inv-10-vacio-de-verdad", "caso=vacio", async p => {
  const t = await texto(p);
  ok("inv-10-vacio-de-verdad", /Sin productos en stock/.test(t), /Sin productos en stock/.test(t) ? "el catálogo vacío de verdad lo dice" : "no dice que está vacío");
});
await caso("inv-11-gerardo", "rol=produccion", async p => {
  const carrito = await p.getByRole("button", { name: /Carrito de venta/ }).count(), ajustar = await p.getByRole("button", { name: /Ajustar/ }).count(), quitar = await p.getByRole("button", { name: /Eliminar|Quitar/ }).count();
  ok("inv-11-gerardo", carrito === 0 && ajustar >= 1 && quitar === 0, `Gerardo: carrito ${carrito}, ajustar ${ajustar}, quitar ${quitar} (debe: 0, sí, 0)`);
});
await caso("inv-12-clientes-sin-leer", "falla=clientes", async p => {
  const t = await texto(p);
  ok("inv-12-clientes-sin-leer", /no se pud/i.test(t), /no se pud/i.test(t) ? "dice que no pudo leer los clientes" : "los clientes salen como «—» sin decir por qué");
});
for (const [ancho, alto] of [[1366, 768], [1920, 1080]]) {
  await caso(`inv-13-cabe-${ancho}`, "", async p => {
    const r = await p.getByText("Inventario Cuadra").first().boundingBox(); const ancha = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(`inv-13-cabe-${ancho}`, !!r && r.y >= 0 && !ancha, `${ancho}: el título ${r ? "a " + Math.round(r.y) + " px" : "no está"}${ancha ? "; la página se sale a lo ancho" : ""}`);
  }, { viewport: { width: ancho, height: alto } });
}

// ── vuelta 2: por donde no se diseñó (escritas con el arreglo pensado, corridas también contra lo de antes) ─────────────────────────────
const preguntaQuitar = async p => { await p.getByText("Díptico corporativo").first().waitFor(); await p.getByRole("button", { name: /Eliminar|Quitar/ }).first().click(); await espera(p, 300); return p.getByRole("button", { name: /^Sí, quitar/ }); };
await caso("inv-14-doble-clic-quitar", "", async p => {
  const si = await preguntaQuitar(p);
  if (await si.count()) { await si.first().dblclick(); await espera(p, 800); }
  const n = (await lineas(p, "db deleteClientProduct p2")).length;
  ok("inv-14-doble-clic-quitar", n === 1, `doble clic en «Sí, quitar»: se quitó ${n} vez(es)`);
});
await caso("inv-15-cancelar-quitar", "", async p => {
  await preguntaQuitar(p);
  const cancelar = p.getByRole("button", { name: /^Cancelar$/ });
  const hay = await cancelar.count(); if (hay) { await cancelar.first().click(); await espera(p); }
  const n = (await lineas(p, "db deleteClientProduct")).length; const sigue = /Díptico corporativo/.test(await texto(p));
  ok("inv-15-cancelar-quitar", hay >= 1 && n === 0 && sigue, `«Cancelar» ${hay ? "sí" : "NO hay"}; quitado ${n} vez(es); el Díptico ${sigue ? "sigue" : "ya no está"}`);
});
await caso("inv-16-reintentar-movimientos", "falla=movimientos-una", async p => {
  await pestana(p, /Movimientos/).click(); await espera(p);
  const b = p.getByRole("button", { name: /Reintentar/ }); const hay = await b.count();
  if (hay) { await b.first().click(); await espera(p, 700); }
  const t = await texto(p);
  ok("inv-16-reintentar-movimientos", hay >= 1 && /Conteo físico/.test(t), `los movimientos fallaron la primera vez: «Reintentar» ${hay ? "sí" : "no"}; ${/Conteo físico/.test(t) ? "llegan" : "no llegan"}`);
});
await caso("inv-17-la-base-no-quita", "falla=quitar", async p => {
  const si = await preguntaQuitar(p);
  if (await si.count()) { await si.first().click(); await espera(p, 800); }
  const aviso = await lineas(p, "aviso (error)"); const sigue = /Díptico corporativo/.test(await texto(p));
  ok("inv-17-la-base-no-quita", aviso.length >= 1 && sigue, `la base no quitó: ${aviso.length ? "lo dice" : "no lo dice"}; el Díptico ${sigue ? "sigue en el catálogo" : "desapareció"}`);
});
await caso("inv-18-con-el-teclado", "", async p => {
  let llego = false;
  for (let i = 0; i < 6 && !llego; i++) { await p.keyboard.press("Tab"); llego = await p.evaluate(() => /Movimientos/.test(document.activeElement?.innerText || "")); }
  if (llego) { await p.keyboard.press("Enter"); await espera(p); }
  const t = await texto(p);
  ok("inv-18-con-el-teclado", llego && /Conteo físico/.test(t), `con Tab ${llego ? "se llega a «Movimientos»" : "NO se llega a «Movimientos» en 6"}; ${/Conteo físico/.test(t) ? "Enter la abre" : "no se abre"}`);
});
await caso("inv-19-karla-quita-solo-sin-existencias", "rol=karla", async p => {
  const n = await p.getByRole("button", { name: /Eliminar|Quitar/ }).count();
  ok("inv-19-karla-quita-solo-sin-existencias", n === 1, `Karla: ${n} botón(es) para quitar (sólo el Díptico, que tiene 0)`);
});
await caso("inv-20-telefono", "", async p => {
  const ancha = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const r = await pestana(p, /Historial/).boundingBox();
  ok("inv-20-telefono", !ancha && !!r && r.x + r.width <= 390, `a 390 px: ${ancha ? "la página se sale a lo ancho" : "cabe"}; «Historial» ${r ? "llega a " + Math.round(r.x + r.width) + " px" : "no está"}`);
}, { viewport: { width: 390, height: 844 } });

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\ninventario: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
