// Tratar de ROMPER el «Dashboard» (la vista con la que abren casi todos: el resumen de 7 días, el flujo por etapas y la maquila), su /impeccable
// critique de la noche del 16-oct. Cada caso afirma lo que DEBERÍA pasarle a quien lo abre: una FALLA es un bug. Vuelta 1: escritas antes del arreglo.
// El reloj del navegador va fijo en el miércoles 14-oct-2026 a las 12:00 de México (las órdenes del banco son de esa semana).
// Uso: node dashboard.mjs <dir-capturas> [puerto=5183]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5183);
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
    await page.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 30000 });
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
const espera = (p, ms = 250) => p.waitForTimeout(ms);
const texto = p => p.evaluate(() => { const r = document.getElementById("root").cloneNode(true); r.querySelector("#log")?.remove(); return r.innerText.replace(/\s+/g, " "); });
// las 12 etapas internas en el orden del flujo (sin «Entregada»)
const ETAPAS = ["Validar", "Diseño", "Prueba", "Aprobación", "CTP", "Placas Listas", "Lista p/ imprimir", "Máquina", "Enviada a Maquila (parcial)", "Recibida de Maquila (parcial)", "Empaque", "Salidas"];
// la columna (o el riel) de cada etapa interna: su caja en la pantalla y si tiene órdenes. Con la marca data-etapa (el arreglo) o, en el código de
// antes, subiendo desde el nombre de la etapa hasta la caja con su borde.
const columnas = p => p.evaluate(ETAPAS => {
  const marcadas = [...document.querySelectorAll("[data-etapa]")];
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  return ETAPAS.map(nombre => {
    let caja = marcadas.find(e => e.getAttribute("data-nombre") === nombre);
    if (!caja) {
      const el = [...document.querySelectorAll("#root *")].find(e => propio(e) === nombre && !e.closest("#log"));
      caja = el; while (caja && !/1\.5px solid/.test(caja.getAttribute("style") || "")) caja = caja.parentElement;
    }
    if (!caja) return { nombre, falta: true };
    const r = caja.getBoundingClientRect();
    // (las fichas, por sus folios DISTINTOS: la ficha compacta dice su folio dos veces)
    return { nombre, x: Math.round(r.left), der: Math.round(r.right), alto: Math.round(r.height), fichas: new Set(caja.innerText.match(/P-0\d{3}/g) || []).size };
  });
}, ETAPAS);
// todos los textos que no llegan a AA contra su fondo de verdad (los fondos con transparencia se componen hasta uno opaco)
const sinAA = p => p.evaluate(() => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const malos = [];
  // (las fichas, OCard, ya tienen su revisión de contraste en la tanda del tablero: aquí lo de la vista)
  for (const el of document.querySelectorAll("#root *")) {
    if (el.closest("#log,#lateral,#barra,[data-ficha],[data-orden-ficha]")) continue;
    const t = propio(el); if (!t || !el.getClientRects().length) continue;
    const s = getComputedStyle(el); if (s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    const a = lum(nums(s.color)), b = lum(fondo(el)), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (r < (grande ? 3 : 4.5)) malos.push(t.slice(0, 30) + " " + r.toFixed(1));
  }
  return malos;
});

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
for (const [n, rol] of [["01", "secretaria"], ["02", "produccion"]]) {
  await caso(`db-${n}-${rol}-ve-donde-esta-el-trabajo-sin-desplazarse`, "rol=" + rol, async p => {
    const c = await columnas(p), ancho = await p.evaluate(() => window.innerWidth);
    const conOrdenes = c.filter(x => x.fichas > 0), aLaVista = conOrdenes.filter(x => x.der <= ancho);
    ok(`db-${n}-${rol}-ve-donde-esta-el-trabajo-sin-desplazarse`, conOrdenes.length >= 6 && aLaVista.length >= 4,
      `a 1366, de las ${conOrdenes.length} etapas con órdenes se ven sin desplazarse ${aLaVista.length} (${aLaVista.map(x => x.nombre).join(", ") || "ninguna"}); la primera con órdenes empieza en x=${conOrdenes[0]?.x}`);
  });
}
await caso("db-03-las-vacias-no-se-estiran", "rol=secretaria", async p => {
  const c = await columnas(p), vacias = c.filter(x => !x.falta && x.fichas === 0);
  // (300 px: el riel de «Recibida de Maquila (parcial)» mide ~200 por su nombre de lado; lo de antes, estirado a la columna más larga, ~740)
  const altas = vacias.filter(x => x.alto > 300);
  ok("db-03-las-vacias-no-se-estiran", vacias.length > 0 && altas.length === 0, `${vacias.length} etapas vacías; ${altas.length ? altas.length + " se estiran (" + altas.slice(0, 3).map(x => x.nombre + " " + x.alto + " px").join(", ") + ")" : "ninguna pasa de 300 px"}`);
});
await caso("db-04-el-flujo-completo-en-orden", "rol=secretaria", async p => {
  const c = await columnas(p);
  const faltan = c.filter(x => x.falta).map(x => x.nombre), enOrden = c.filter(x => !x.falta).every((x, i, a) => i === 0 || a[i - 1].x < x.x);
  ok("db-04-el-flujo-completo-en-orden", faltan.length === 0 && enOrden, `${faltan.length ? "faltan: " + faltan.join(", ") : "las 12 etapas están"}; ${enOrden ? "en el orden del flujo" : "FUERA de orden"}`);
});
await caso("db-05-sin-lectura-no-dice-que-no-hay-ordenes", "rol=secretaria&lectura=no", async p => {
  const t = await texto(p);
  const vacio = (t.match(/Sin órdenes/g) || []).length;
  ok("db-05-sin-lectura-no-dice-que-no-hay-ordenes", vacio === 0 && /Sin cifras/.test(t) && !/\b0 activas/.test(t),
    `sin haber leído nada de la base: «Sin órdenes» ${vacio} ${vacio === 1 ? "vez" : "veces"}; ${/\b0 activas/.test(t) ? "dice «0 activas»" : "no dice «0 activas»"}; ${/Sin cifras/.test(t) ? "dice que no hay cifras" : "NO dice que no hay cifras"}`);
});
await caso("db-06-la-que-no-avanza-dice-cual-y-lleva-a-ella", "rol=secretaria", async p => {
  const aviso = p.getByText(/sin avance en más de 24/).first();
  await aviso.click(); await espera(p);
  // (en la lista del aviso: la ficha de P-0448 en su columna también es un botón con su folio)
  const enLista = p.getByRole("list", { name: /sin avance/i }).getByRole("button", { name: /P-0448/ });
  const hay = await enLista.count();
  if (hay) { await enLista.first().click(); await espera(p); }
  ok("db-06-la-que-no-avanza-dice-cual-y-lleva-a-ella", hay > 0 && (await lineas(p, "accion OP-P-0448 detail")).length === 1,
    `el aviso de la que no avanza: ${hay ? "dice cuál (P-0448)" : "NO dice cuál"}; ${(await lineas(p, "accion OP-P-0448 detail")).length ? "lleva a su detalle" : "no lleva a ella"}`);
});
await caso("db-07-el-resumen-dice-lo-que-cuenta", "rol=secretaria", async p => {
  const t = await texto(p);
  ok("db-07-el-resumen-dice-lo-que-cuenta", !/Facturado/i.test(t) && /Ingreso/.test(t) && /7 días/.test(t) && /retraso hoy/i.test(t) && /\$50,000/.test(t),
    `el resumen: ${/Facturado/i.test(t) ? "dice «Facturado» (es lo ENTREGADO a precio de venta, no lo facturado)" : "no dice «Facturado»"}; ${/Ingreso/.test(t) ? "«Ingreso»" : "sin «Ingreso»"}; ${/7 días/.test(t) ? "«7 días»" : "no dice de cuántos días"}; ${/retraso hoy/i.test(t) ? "«con retraso hoy»" : "«con retraso» sin decir que es de hoy"}; ${/\$50,000/.test(t) ? "$50,000 (las cinco de la semana)" : "el ingreso no es $50,000"}`);
});
for (const rol of ["secretaria", "produccion"]) {
  await caso(`db-08-todo-se-lee-${rol}`, "rol=" + rol, async p => {
    const malos = await sinAA(p);
    ok(`db-08-todo-se-lee-${rol}`, malos.length === 0, malos.length ? `${malos.length} textos sin AA: ${malos.slice(0, 8).join(" · ")}` : "todo con AA");
  });
}
await caso("db-09-a-1920-se-ve-todo-lo-que-tiene-ordenes", "rol=secretaria", async p => {
  const c = await columnas(p), ancho = await p.evaluate(() => window.innerWidth);
  const conOrdenes = c.filter(x => x.fichas > 0), fuera = conOrdenes.filter(x => x.der > ancho);
  const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok("db-09-a-1920-se-ve-todo-lo-que-tiene-ordenes", fuera.length === 0 && r.sw <= r.cw, `a 1920: ${fuera.length ? "quedan fuera " + fuera.map(x => x.nombre).join(", ") : "las " + conOrdenes.length + " con órdenes a la vista"}; la página ${r.sw} en ${r.cw}`);
}, { viewport: { width: 1920, height: 1080 } });
await caso("db-10-la-que-no-avanza-con-el-teclado", "rol=secretaria", async p => {
  let llego = "";
  for (let i = 0; i < 40 && !llego; i++) { await p.keyboard.press("Tab"); const t = await p.evaluate(() => document.activeElement?.innerText || ""); if (/sin avance/.test(t)) llego = t; }
  if (llego) { await p.keyboard.press("Enter"); await espera(p); }
  let enLista = "";
  for (let i = 0; i < 6 && llego && !enLista; i++) { await p.keyboard.press("Tab"); const t = await p.evaluate(() => document.activeElement?.innerText || ""); if (/P-0448/.test(t)) enLista = t; }
  if (enLista) { await p.keyboard.press("Enter"); await espera(p); }
  ok("db-10-la-que-no-avanza-con-el-teclado", !!llego && !!enLista && (await lineas(p, "accion OP-P-0448 detail")).length === 1,
    `con Tab ${llego ? "se llega al aviso" : "NO se llega al aviso"}; ${enLista ? "y a P-0448 en su lista" : "no se llega a la orden"}; Enter ${(await lineas(p, "accion OP-P-0448 detail")).length ? "la abre" : "no la abre"}`);
});
await caso("db-11-las-tempranas-tienen-su-columna", "rol=secretaria&caso=temprano", async p => {
  const c = await columnas(p);
  const val = c.find(x => x.nombre === "Validar"), dis = c.find(x => x.nombre === "Diseño"), prueba = c.find(x => x.nombre === "Prueba");
  ok("db-11-las-tempranas-tienen-su-columna", val?.fichas > 0 && dis?.fichas > 0 && val.der - val.x >= 150 && prueba && prueba.fichas === 0 && prueba.der - prueba.x < 80,
    `con órdenes en Validar y Diseño: Validar ${val ? val.der - val.x : "?"} px (${val?.fichas} fichas), Diseño ${dis ? dis.der - dis.x : "?"} px; Prueba (vacía) ${prueba ? prueba.der - prueba.x : "?"} px`);
});
await caso("db-12-se-leyo-y-no-hay-activas", "rol=secretaria&caso=vacio", async p => {
  const t = await texto(p);
  const veces = (t.match(/Sin órdenes/g) || []).length;
  ok("db-12-se-leyo-y-no-hay-activas", veces <= 1 && /No hay órdenes activas|Sin órdenes activas/.test(t), `se leyó y no hay activas: «Sin órdenes» ${veces} ${veces === 1 ? "vez" : "veces"}; ${/No hay órdenes activas|Sin órdenes activas/.test(t) ? "lo dice una vez" : "no lo dice con una frase"}`);
});
// (el nombre del cliente es lo más grande de la ficha, y su cursor dice que se toca: en la ficha compacta se tragaba el clic y no abría nada)
await caso("db-13-la-ficha-abre-su-orden-tambien-desde-el-nombre", "rol=secretaria", async p => {
  await p.getByText("COSQUIM").first().click(); await espera(p);
  ok("db-13-la-ficha-abre-su-orden-tambien-desde-el-nombre", (await lineas(p, "accion OP-P-0604 detail")).length === 1, `la ficha de P-0604, tocando su cliente (COSQUIM): ${(await lineas(p, "accion OP-P-0604 detail")).length ? "abre su detalle" : "NO abre nada"}`);
});
await caso("db-14-las-12-con-ordenes-se-desplazan", "rol=secretaria&caso=muchas", async p => {
  const c = await columnas(p);
  const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok("db-14-las-12-con-ordenes-se-desplazan", c.filter(x => x.fichas > 0).length === 12 && r.sw <= r.cw, `con las 12 etapas con órdenes: ${c.filter(x => x.fichas > 0).length} con fichas; la PÁGINA no se desplaza de lado (${r.sw} en ${r.cw}): lo hace el flujo`);
});

// ── vuelta 2: por donde no se diseñó (las órdenes que se mueven con la vista abierta, la lista abierta que se vacía, quién ve el resumen) ──────────
await caso("db-15-se-vacia-una-etapa-con-la-vista-abierta", "rol=secretaria", async p => {
  await p.evaluate(() => window.__cambiar("OP-P-0601", { stage: "ready" })); await espera(p, 400);
  const c = await columnas(p), placas = c.find(x => x.nombre === "Placas Listas"), listas = c.find(x => x.nombre === "Lista p/ imprimir");
  ok("db-15-se-vacia-una-etapa-con-la-vista-abierta", placas && placas.fichas === 0 && placas.der - placas.x < 80 && listas?.fichas === 4,
    `P-0601 pasa de Placas Listas a Lista p/ imprimir: Placas Listas ${placas ? (placas.der - placas.x) + " px con " + placas.fichas : "no está"}; Lista p/ imprimir con ${listas?.fichas} fichas`);
});
await caso("db-16-llega-una-a-una-etapa-vacia", "rol=secretaria", async p => {
  await p.evaluate(() => window.__cambiar("OP-P-0603", { stage: "ctp" })); await espera(p, 400);
  const c = await columnas(p), ctp = c.find(x => x.nombre === "CTP");
  ok("db-16-llega-una-a-una-etapa-vacia", ctp && ctp.fichas === 1 && ctp.der - ctp.x >= 150, `P-0603 llega a CTP (estaba vacía): ${ctp ? (ctp.der - ctp.x) + " px con " + ctp.fichas + " ficha(s)" : "no está"}`);
});
await caso("db-17-la-lista-de-las-quietas-se-vacia-abierta", "rol=secretaria", async p => {
  await p.getByText(/sin avance en más de 24/).first().click(); await espera(p);
  const enLista = () => p.getByRole("list", { name: /sin avance/i }).getByRole("button", { name: /P-0448/ }).count();
  const antes = await enLista();
  await p.evaluate(() => window.__cambiar("OP-P-0448", { timeline: [{ stage: "salidas", date: new Date().toISOString() }] })); await espera(p, 400);
  const despues = await enLista(), aviso = await p.getByText(/sin avance en más de 24/).count();
  ok("db-17-la-lista-de-las-quietas-se-vacia-abierta", antes === 1 && despues === 0 && aviso === 0, `la lista abierta con P-0448; le registran avance: ${despues ? "SIGUE en la lista" : "se va"} y el aviso ${aviso ? "SIGUE" : "se va"}`);
});
await caso("db-18-el-vendedor-ve-sus-7-dias", "rol=vendedor", async p => {
  const t = await texto(p);
  ok("db-18-el-vendedor-ve-sus-7-dias", /Tus últimos 7 días/.test(t) && !/Facturado/.test(t), `el vendedor: ${/Tus últimos 7 días/.test(t) ? "«Tus últimos 7 días»" : "NO dice «Tus últimos 7 días»"}${/Facturado/.test(t) ? "; dice «Facturado»" : ""}`);
});
await caso("db-19-karla-no-tiene-resumen", "rol=karla", async p => {
  const t = await texto(p);
  ok("db-19-karla-no-tiene-resumen", !/últimos 7 días|Resumen Semanal/i.test(t) && /Internas/.test(t), `Karla: ${/últimos 7 días|Resumen Semanal/i.test(t) ? "VE el resumen" : "sin el resumen (como antes)"}; el flujo ${/Internas/.test(t) ? "sí" : "NO"}`);
});

// ── vuelta 3 (v10.84.140): «Con retraso hoy» no cuenta la lista que espera a que el cliente pida su factura ──
await caso("db-20-con-retraso-hoy-sin-la-que-espera-al-cliente", "rol=secretaria&caso=espera", async p => {
  // (el número de su casilla: en el texto corrido se pega con lo que sigue —«3» y «1…» daban «31»—)
  const retrasoHoy = () => p.locator("span", { hasText: /^Con retraso hoy$/ }).first().locator("xpath=following-sibling::span[1]").innerText().then(Number).catch(() => NaN);
  const conEspera = await retrasoHoy();
  await p.goto(p.url().replace("caso=espera", "caso=")); await p.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 30000 }); await espera(p, 300);
  const sin = await retrasoHoy();
  ok("db-20-con-retraso-hoy-sin-la-que-espera-al-cliente", Number.isFinite(conEspera) && conEspera === sin, `«Con retraso hoy»: ${conEspera} con P-0645 (en Salidas, «el cliente no ha pedido factura», vencida el 8) y ${sin} sin ella (deben ser iguales)`);
});

// ── vuelta 4 (v10.84.149; Marcelo, 17-oct: «sí, cuentan como a tiempo»): lo LISTO a tiempo no es retraso, también sin la pausa; y el «A tiempo» de la semana
//   (el reporte completo de Dirección) cuenta con la regla de Analytics: antes medía contra el mediodía del día de entrega y sin lo que quedó listo a tiempo.
//   Escritas antes del arreglo ──
const valorDe = (p, etiqueta) => p.locator("span", { hasText: new RegExp("^" + etiqueta + "$") }).first().locator("xpath=following-sibling::span[1]").innerText().catch(() => "");
await caso("db-21-con-retraso-hoy-sin-la-lista-a-tiempo", "rol=secretaria&caso=lista", async p => {
  const conLista = Number(await valorDe(p, "Con retraso hoy"));
  await p.goto(p.url().replace("caso=lista", "caso=")); await p.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 30000 }); await espera(p, 300);
  const sin = Number(await valorDe(p, "Con retraso hoy"));
  ok("db-21-con-retraso-hoy-sin-la-lista-a-tiempo", Number.isFinite(conLista) && conLista === sin, `«Con retraso hoy»: ${conLista} con P-0646 (en Salidas desde el 7 sin la pausa, vencía el 8) y ${sin} sin ella (deben ser iguales)`);
});
await caso("db-22-a-tiempo-de-la-semana-con-la-regla", "rol=admin&caso=lista", async p => {
  await p.getByRole("button", { name: /Reporte Completo/ }).click(); await espera(p);
  const v = (await valorDe(p, "A tiempo")).trim();
  ok("db-22-a-tiempo-de-la-semana-con-la-regla", /^88\s?%$/.test(v), `«A tiempo» de los últimos 7 días: «${v}» (debe 88 %: 7 de 8; P-0505 quedó lista a tiempo, P-0506 se entregó a las 18:00 del día de su fecha; sólo P-0507, lista tarde, no)`);
});
await caso("db-23-a-tiempo-sin-fechas-no-es-cero", "rol=admin&caso=sinfecha", async p => {
  await p.getByRole("button", { name: /Reporte Completo/ }).click(); await espera(p);
  const v = (await valorDe(p, "A tiempo")).trim();
  ok("db-23-a-tiempo-sin-fechas-no-es-cero", v === "—", `«A tiempo» con 5 entregadas en la semana y ninguna con fecha de entrega: «${v}» (debe «—»: no hay con qué medir; «0%» en rojo dice que todas llegaron tarde)`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\ndashboard: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
