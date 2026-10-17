// Tratar de ROMPER el «Archivo» (`Archive`: lo entregado y lo cancelado por año → mes → semana, con su ingreso), su /impeccable critique del 17-oct
// (v10.84.145). Cada caso afirma lo que DEBERÍA ver quien lo abre: una FALLA es un bug. Vuelta 1: escritas antes del arreglo. Reloj fijo: 16-oct-2026.
// En el banco: octubre 2026, P-0901 de Genaro capturada por Lupita ($10,000, el 14), P-0902 de Genaro ($5,000, el 15), P-0903 de Manuel ($2,000, el 6) y
// P-0904 capturada el 20 de septiembre y CANCELADA el 13 de octubre (con F-100 y su nota de crédito pendiente); septiembre, P-0905 maquila urgente ($3,000);
// 2025, P-0906 ($1,000); y una activa que no es del archivo. Octubre empieza en jueves: semanas del 1 al 3, del 4 al 10, del 11 al 17…
// Uso: node archivo.mjs <dir-capturas> [puerto=5486]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5486);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
const AHORA = new Date("2026-10-16T12:00:00-06:00");
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
    await page.getByRole("heading", { name: /Archivo/ }).first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(250);
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
const espera = (p, ms = 200) => p.waitForTimeout(ms);
const texto = p => p.evaluate(() => { const r = document.getElementById("root").cloneNode(true); r.querySelector("#log")?.remove(); return r.innerText.replace(/\s+/g, " "); });
// abrir un mes (su botón dice «Octubre 2026») y luego, una por una, sus semanas, hasta encontrar algo
const mes = (p, nombre) => p.getByRole("button", { name: new RegExp("^\\s*" + nombre) }).first();
const abrirMes = async (p, nombre) => { const b = mes(p, nombre); if (!(await b.count())) return false; await b.click(); await espera(p); return true; };
// las semanas del mes abierto: los botones que siguen al del mes y no son meses ni años ni fichas
const semanas = p => p.locator("button").filter({ hasText: /^\s*(Semana \d|Del \d|El \d|\d{1,2} al \d{1,2})/ });   // (vuelta 2: también «El 31», la semana de un día)
const buscarEnSemanas = async (p, quiere) => {
  const n = await semanas(p).count();
  for (let i = 0; i < n; i++) { await semanas(p).nth(i).click(); await espera(p); if (quiere.test(await texto(p))) return (await semanas(p).nth(i).innerText()).replace(/\s+/g, " "); }
  return "";
};
const tabHasta = async (p, quiere, max = 120) => {
  for (let i = 0; i < max; i++) {
    await p.keyboard.press("Tab");
    const t = await p.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? ((a.getAttribute("aria-label") || "") + " " + (a.innerText || "")).trim() : ""; });
    if (quiere(t)) return t;
  }
  return "";
};
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
    const op = Number(s.opacity) * Number(getComputedStyle(el.parentElement || el).opacity);
    const a = lum(nums(s.color)), b = lum(fondo(el)), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) * (op < 1 ? op : 1);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (k < (grande ? 3 : 4.5) || parseFloat(s.fontSize) < 10) malos.push(t.slice(0, 30) + " " + k.toFixed(1) + (parseFloat(s.fontSize) < 10 ? " (" + s.fontSize + ")" : ""));
  }
  return [...new Set(malos)];
});

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("arc-01-el-ingreso-se-llama-como-es", "", async p => {
  const t = await texto(p);
  ok("arc-01-el-ingreso-se-llama-como-es", /Ingreso/.test(t) && !/Facturado/.test(t) && /sin IVA/.test(t), `el resumen: ${/Facturado/.test(t) ? "dice «Facturado» a lo entregado (sin IVA, y no todo es factura: hay remisiones)" : "no dice «Facturado»"}; ${/Ingreso/.test(t) ? "dice «Ingreso»" : "NO dice «Ingreso»"}; ${/sin IVA/.test(t) ? "dice sin IVA" : "NO dice si es con o sin IVA"}`);
});
await caso("arc-02-el-vendedor-cuenta-lo-que-lleva", "rol=vendedor", async p => {
  const t = await texto(p), m = (t.match(/(?:Ingreso|Facturado)[^$]{0,40}(\$[\d,]+\.\d\d)/) || [])[1] || "no dice";
  ok("arc-02-el-vendedor-cuenta-lo-que-lleva", m === "$15,000.00", `Genaro: ${m} (debe $15,000.00: P-0901 la capturó Lupita, pero él es el vendedor; la ficha ya la cuenta suya)`);
});
await caso("arc-03-la-cancelada-va-cuando-se-cancelo", "", async p => {
  await abrirMes(p, "Octubre 2026");
  const enOct = await buscarEnSemanas(p, /CANCELADA EN OCTUBRE/);
  await abrirMes(p, "Septiembre 2026");
  const enSep = await buscarEnSemanas(p, /CANCELADA EN OCTUBRE/);
  ok("arc-03-la-cancelada-va-cuando-se-cancelo", !!enOct && !enSep, `P-0904 (capturada el 20-sep, cancelada el 13-oct): ${enOct ? "en octubre («" + enOct.slice(0, 40) + "»)" : "NO está en octubre"}; ${enSep ? "y en septiembre (por la fecha de captura)" : "no en septiembre"}`);
});
await caso("arc-04-el-resumen-separa-lo-entregado", "", async p => {
  const t = await texto(p);
  // (la primera versión buscaba con \b: los avisos del resumen quedan pegados en el texto, «5Canceladas», y \b no corta entre «5» y «C»)
  ok("arc-04-el-resumen-separa-lo-entregado", /Entregadas:? ?5(?!\d)/.test(t) && /Canceladas:? ?1(?!\d)/.test(t) && !/Total: ?6/.test(t), `el resumen: «${(t.match(/(Total|Entregadas)[^$]{0,60}/) || ["?"])[0]}» (debe Entregadas 5 y Canceladas 1, no «Total: 6» revuelto)`);
});
await caso("arc-05-la-orden-con-el-teclado", "", async p => {
  await abrirMes(p, "Octubre 2026"); await buscarEnSemanas(p, /DE GENARO POR LUPITA/);
  const t = await tabHasta(p, x => /P-0901/.test(x));
  if (t) await p.keyboard.press("Enter");
  await espera(p);
  ok("arc-05-la-orden-con-el-teclado", !!t && (await lineas(p, "accion OP-P-0901 detail")).length === 1, `con Tab ${t ? "se llega a P-0901" : "NO se llega a P-0901"}; Enter ${(await lineas(p, "accion OP-P-0901 detail")).length ? "la abre" : "no la abre"}`);
});
await caso("arc-06-todo-se-lee", "", async p => {
  await abrirMes(p, "Octubre 2026"); await buscarEnSemanas(p, /CANCELADA EN OCTUBRE/);
  const m1 = await sinAA(p);
  await abrirMes(p, "Septiembre 2026"); await buscarEnSemanas(p, /MAQUILA URGENTE/);
  const m = [...new Set([...m1, ...(await sinAA(p))])];
  ok("arc-06-todo-se-lee", m.length === 0, m.length ? m.length + " textos sin AA o de menos de 10 px: " + m.slice(0, 8).join(" | ") : "todo con AA");
});
await caso("arc-07-sin-el-id-interno", "", async p => {
  await abrirMes(p, "Octubre 2026"); await buscarEnSemanas(p, /DE GENARO POR LUPITA/);
  const t = await texto(p);
  ok("arc-07-sin-el-id-interno", !/OP-P-09\d\d/.test(t), `${/OP-P-09\d\d/.test(t) ? "enseña el id interno («" + (t.match(/OP-P-09\d\d/) || [""])[0] + "») junto al folio P-…" : "sólo el folio P-…"}`);
});
await caso("arc-08-la-semana-dice-sus-dias", "", async p => {
  await abrirMes(p, "Octubre 2026");
  const etiquetas = await semanas(p).evaluateAll(xs => xs.map(x => x.innerText.replace(/\s+/g, " ").trim()));
  ok("arc-08-la-semana-dice-sus-dias", etiquetas.some(e => /11 al 17/.test(e)) && etiquetas.some(e => /4 al 10/.test(e)), `las semanas de octubre: ${etiquetas.map(e => "«" + e.slice(0, 24) + "»").join(", ") || "ninguna"} (deben decir sus días: del 4 al 10, del 11 al 17…)`);
});
await caso("arc-09-produccion-sin-dinero", "rol=produccion", async p => {
  await abrirMes(p, "Octubre 2026"); await buscarEnSemanas(p, /DE GENARO POR LUPITA/);
  const t = await texto(p);
  ok("arc-09-produccion-sin-dinero", !/\$\d/.test(t), `Gerardo ${/\$\d/.test(t) ? "VE importes" : "no ve importes"}`);
});
for (const ancho of [1366, 1920]) {
  await caso(`arc-10-cabe-a-${ancho}`, "", async p => {
    await abrirMes(p, "Octubre 2026"); await buscarEnSemanas(p, /CANCELADA EN OCTUBRE/);
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(`arc-10-cabe-a-${ancho}`, r.sw <= r.cw, `a ${ancho}: ancho de la página ${r.sw} en ${r.cw}`);
  }, { viewport: { width: ancho, height: ancho === 1366 ? 768 : 1080 } });
}
await caso("arc-11-vacio-de-verdad", "caso=vacio", async p => {
  const t = await texto(p);
  ok("arc-11-vacio-de-verdad", /Sin órdenes completadas/.test(t), `sin entregadas: ${/Sin órdenes completadas/.test(t) ? "lo dice" : "NO lo dice"}`);
});
await caso("arc-12-sin-cargar-no-dice-cifras", "archivo=no", async p => {
  const t = await texto(p);
  ok("arc-12-sin-cargar-no-dice-cifras", /Cargar Archivo Completo/i.test(t) && !/\$\d|Total: ?0|Entregadas: ?0/.test(t), `sin el archivo cargado: ${/Cargar Archivo Completo/i.test(t) ? "ofrece cargarlo" : "NO ofrece cargarlo"}; ${/\$\d|Total: ?0|Entregadas: ?0/.test(t) ? "dice cifras" : "sin cifras"}`);
});
await caso("arc-13-el-anio-actual-abierto-el-pasado-plegado", "", async p => {
  const t = await texto(p);
  ok("arc-13-el-anio-actual-abierto-el-pasado-plegado", /Octubre 2026/.test(t) && !/Diciembre 2025/.test(t) && /2025/.test(t), `al abrir: ${/Octubre 2026/.test(t) ? "2026 abierto (sus meses a la vista)" : "2026 plegado"}; ${/Diciembre 2025/.test(t) ? "2025 también abierto" : "2025 plegado"}`);
});

// ── vuelta 2: por donde no se diseñó (el borde del mes en hora de México, la semana de un día, el vendedor con lo ajeno) ──
await caso("arc-14-la-de-las-2330-va-en-su-dia-de-mexico", "caso=bordes", async p => {
  await abrirMes(p, "Septiembre 2026"); const enSep = await buscarEnSemanas(p, /A LAS 23:30 DEL 30/);
  await abrirMes(p, "Octubre 2026"); const enOct = await buscarEnSemanas(p, /A LAS 23:30 DEL 30/);
  ok("arc-14-la-de-las-2330-va-en-su-dia-de-mexico", !!enSep && !enOct, `entregada el 30-sep a las 23:30 (en UTC, 1-oct): ${enSep ? "en septiembre («" + enSep.slice(0, 30) + "»)" : "NO en septiembre"}${enOct ? " y en octubre" : ""}`);
});
await caso("arc-15-la-semana-de-un-dia", "caso=bordes", async p => {
  await abrirMes(p, "Mayo 2026");
  const etiquetas = await semanas(p).evaluateAll(xs => xs.map(x => x.innerText.replace(/\s+/g, " ").trim()));
  ok("arc-15-la-semana-de-un-dia", etiquetas.some(e => /^El 31\b/.test(e)), `las semanas de mayo: ${etiquetas.map(e => "«" + e.slice(0, 20) + "»").join(", ") || "ninguna"} (el domingo 31 es una semana de un día: «El 31»)`);
});
// (arc-16 afirmaba que Genaro veía la de Manuel sin su importe; desde v10.84.152 no la ve: arc-18)

// ── vuelta 3 (v10.84.152; Marcelo, 17-oct: «escojo tus recomendaciones»): el vendedor ve sólo lo suyo (lo que capturó o lleva como vendedor), aunque arriba
//   esté «Todas» (el banco le pasa todas, como «Todas»). Antes veía las entregadas y canceladas de todos y su ingreso era sólo lo suyo. Escritas antes del arreglo ──
await caso("arc-18-el-vendedor-ve-solo-lo-suyo", "rol=vendedor", async p => {
  const t0 = await texto(p), ent = (t0.match(/Entregadas:\s*(\d+)/) || [])[1], septiembre = await mes(p, "Septiembre 2026").count();
  await abrirMes(p, "Octubre 2026");
  const textos = [], n = await semanas(p).count();
  for (let i = 0; i < n; i++) { await semanas(p).nth(i).click(); await espera(p); textos.push(await texto(p)); }
  const todo = textos.join(" "), ajenas = ["DE MANUEL", "CANCELADA EN OCTUBRE"].filter(c => todo.includes(c));
  ok("arc-18-el-vendedor-ve-solo-lo-suyo", /DE GENARO POR LUPITA/.test(todo) && /DE GENARO\b/.test(todo) && !ajenas.length && ent === "2" && !/Canceladas:/.test(t0) && !septiembre,
    `Genaro con «Todas» arriba: «Entregadas: ${ent ?? "?"}» (debe 2: las suyas)${/Canceladas:/.test(t0) ? ", con «Canceladas» (la cancelada es de Manuel)" : ""}; en octubre ${ajenas.length ? "SALEN las ajenas: " + ajenas.join(", ") : "sólo las suyas"}; septiembre ${septiembre ? "SALE (sólo trae una de Manuel)" : "no sale"}`);
});
await caso("arc-19-el-vendedor-sabe-que-ve-lo-suyo", "rol=vendedor", async p => {
  const t = await texto(p);
  ok("arc-19-el-vendedor-sabe-que-ve-lo-suyo", /Sólo tus órdenes/.test(t), `Genaro: ${/Sólo tus órdenes/.test(t) ? "dice que son sólo las suyas" : "nada dice que son sólo las suyas"}`);
});

// ── vuelta 4 (v10.84.152): los demás siguen viendo todo ──
await caso("arc-20-lupita-sigue-viendo-todo", "rol=secretaria", async p => {
  const t0 = await texto(p), ent = (t0.match(/Entregadas:\s*(\d+)/) || [])[1];
  await abrirMes(p, "Octubre 2026");
  const textos = [], n = await semanas(p).count();
  for (let i = 0; i < n; i++) { await semanas(p).nth(i).click(); await espera(p); textos.push(await texto(p)); }
  const todo = textos.join(" ");
  ok("arc-20-lupita-sigue-viendo-todo", ent === "5" && /DE MANUEL/.test(todo) && /DE GENARO/.test(todo) && !/Sólo tus órdenes/.test(t0),
    `Lupita: «Entregadas: ${ent ?? "?"}» (debe 5); ${/DE MANUEL/.test(todo) && /DE GENARO/.test(todo) ? "ve las de Manuel y de Genaro" : "LE FALTAN órdenes"}${/Sólo tus órdenes/.test(t0) ? "; DICE «Sólo tus órdenes»" : ""}`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\narchivo: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
