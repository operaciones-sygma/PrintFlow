// Tratar de ROMPER «Dinero en Proceso» (Dirección: `WIPDashboard`), su /impeccable critique del 16-oct en la noche (v10.84.142). Cada caso afirma lo que
// DEBERÍA ver Marcelo: una FALLA es un bug. Vuelta 1: escritas antes del arreglo. El reloj del navegador va fijo en el viernes 16-oct-2026 a las 12:00.
// En el banco: 19 activas por $122,000 sin IVA. 16 en proceso ($66,000: Captura $2,000, Pre-prensa $7,000 con una sin precio, Producción $28,000 —9, 7 de
// ellas en Listas—, Maquila $8,000 con margen de $3,000, Salida $21,000) y 3 LISTAS que esperan a que el cliente pida su factura ($56,000: P-0707
// recibida de maquila, P-0710 y P-0711 en Salidas). Todas entraron a su etapa el jueves 15; P-0703 se capturó el 20 de septiembre. No cuentan: una
// entregada, una cancelada, P-0692 cargada a stock ($77,000) y P-0693 con la cancelación a medias ($55,000).
// (Antes de correrla por primera vez: «En la planta» pasó a «En proceso» —la maquila externa no está en la planta—, wip-09 buscaba «órd» y «d prom» con
//  \b, que no corta antes de una «ó» ni entre «6d», y wip-16 lee la sección de lo que espera por su nombre, no la primera vez que sale la frase.)
// Uso: node wip.mjs <dir-capturas> [puerto=5174]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5174);
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
    await page.getByRole("heading", { name: /Dinero en Proceso/ }).waitFor({ timeout: 30000 });
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
const espera = (p, ms = 250) => p.waitForTimeout(ms);
const texto = p => p.evaluate(() => { const r = document.getElementById("root").cloneNode(true); r.querySelector("#log")?.remove(); return r.innerText.replace(/\s+/g, " "); });
// el renglón de una zona (su encabezado): con el arreglo es un botón; en el código de antes, el div con clic que tiene su nombre
const zona = (p, nombre) => p.locator("button, div[style*='cursor']", { hasText: new RegExp("^\\s*" + nombre) }).first();
const zonaTexto = async (p, nombre) => ((await zona(p, nombre).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
const abrirZona = async (p, nombre) => { await zona(p, nombre).click(); await espera(p); };
const tabHasta = async (p, quiere, max = 80) => {
  for (let i = 0; i < max; i++) {
    await p.keyboard.press("Tab");
    const t = await p.evaluate(() => (document.activeElement && document.activeElement !== document.body) ? (document.activeElement.innerText || document.activeElement.getAttribute("aria-label") || "") : "");
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
await caso("wip-01-sin-lectura-no-dice-cero", "lectura=no", async p => {
  const t = await texto(p);
  const miente = [/\$0\b/, /Órdenes activas\s*0/i, /Sin precio\s*0/i].filter(r => r.test(t)).map(String);
  ok("wip-01-sin-lectura-no-dice-cero", !miente.length && /Sin cifras/.test(t), `sin haber leído nada de la base: ${miente.length ? "dice " + miente.join(" ") : "no dice cero"}; ${/Sin cifras/.test(t) ? "dice que no hay cifras" : "NO dice que no hay cifras"}`);
});
await caso("wip-02-lo-listo-que-espera-va-aparte", "", async p => {
  const t = await texto(p);
  const planta = /En proceso[^$]{0,40}\$66,000/.test(t) && /16 órdenes/.test(t), espera = /espera que el cliente pida su factura[^$]{0,60}\$56,000/i.test(t);
  ok("wip-02-lo-listo-que-espera-va-aparte", planta && espera, `«En proceso $66,000 · 16 órdenes» ${planta ? "sí" : "NO"}; «Listo, espera que el cliente pida su factura $56,000» ${espera ? "sí" : "NO"} (el total era $122,000 revuelto)`);
});
await caso("wip-03-las-zonas-sin-lo-que-espera", "", async p => {
  const salida = await zonaTexto(p, "Salida"), regreso = await zonaTexto(p, "Regreso");
  ok("wip-03-las-zonas-sin-lo-que-espera", /\$21,000/.test(salida) && !/\$71,000/.test(salida) && /\b0 órdenes/.test(regreso),
    `la zona Salida: «${salida.slice(0, 80)}» (debe $21,000: Empaque y la de Salidas que falta foliar, sin las dos que esperan al cliente); Regreso de maquila: «${regreso.slice(0, 60)}» (0: la recibida espera al cliente)`);
});
await caso("wip-04-los-dias-son-en-la-etapa", "", async p => {
  const prod = await zonaTexto(p, "Producción");
  ok("wip-04-los-dias-son-en-la-etapa", /1 día/.test(prod) && !/5\.6|26/.test(prod), `Producción: «${prod.slice(0, 120)}» (todas llegaron a su etapa ayer: 1 día hábil; contando desde la captura salían 5.6, por P-0703 de septiembre)`);
});
await caso("wip-05-la-zona-con-el-teclado", "", async p => {
  const t = await tabHasta(p, x => /^\s*Producción/.test(x));
  if (t) await p.keyboard.press("Enter");
  await espera(p);
  const abierta = await p.evaluate(() => document.activeElement?.getAttribute("aria-expanded"));
  const se = /P-0703/.test(await texto(p));
  ok("wip-05-la-zona-con-el-teclado", !!t && abierta === "true" && se, `con Tab ${t ? "se llega a la zona Producción" : "NO se llega a ninguna zona"}; Enter: aria-expanded ${abierta}, sus órdenes ${se ? "a la vista" : "no salen"}`);
});
await caso("wip-06-la-orden-con-el-teclado", "", async p => {
  await abrirZona(p, "Producción");
  const t = await tabHasta(p, x => /P-0703/.test(x));
  if (t) await p.keyboard.press("Enter");
  await espera(p);
  ok("wip-06-la-orden-con-el-teclado", !!t && (await lineas(p, "accion OP-P-0703 detail")).length === 1, `con Tab ${t ? "se llega a P-0703" : "NO se llega a P-0703"}; Enter ${(await lineas(p, "accion OP-P-0703 detail")).length ? "la abre" : "no la abre"}`);
});
await caso("wip-07-se-ven-todas-las-de-una-etapa", "", async p => {
  await abrirZona(p, "Producción");
  // folios DISTINTOS: el cliente de las de Listas se llama «LISTA P-0720» (el folio sale dos veces en su renglón)
  const distintas = async () => new Set((await texto(p)).match(/P-07(03|2\d)/g) || []).size;
  const antes = await distintas();
  const b = p.getByRole("button", { name: /^Ver las 7$/ }); const hay = await b.count();
  if (hay) { await b.first().click(); await espera(p); }
  const despues = await distintas();
  ok("wip-07-se-ven-todas-las-de-una-etapa", antes === 5 && hay === 1 && despues === 7, `Listas tiene 7: se ven ${antes}; ${hay ? "«Ver las 7»" : "NO hay con qué ver las demás («+ 2 más» no se abre)"}; después ${despues}`);
});
for (const z of ["", "zonas"]) {
  await caso("wip-08-todo-se-lee" + (z ? "-con-zonas" : ""), "", async p => {
    if (z) for (const n of ["Captura", "Pre-prensa", "Producción", "Maquila", "Salida"]) await abrirZona(p, n).catch(() => {});
    const m = await sinAA(p);
    ok("wip-08-todo-se-lee" + (z ? "-con-zonas" : ""), m.length === 0, m.length ? m.length + " textos sin AA o de menos de 10 px: " + m.slice(0, 8).join(" | ") : "todo con AA");
  });
}
await caso("wip-09-en-palabras", "", async p => {
  const t = await texto(p);
  const malas = [/(^|\s)órd(\s|$)/, /\$\$\$/, /\bM \$/, /d prom\b/].filter(r => r.test(t)).map(String);
  ok("wip-09-en-palabras", !malas.length && /sin IVA/.test(t), `${malas.length ? "dice: " + malas.join(" ") : "sin abreviaturas"}; ${/sin IVA/.test(t) ? "dice que es sin IVA" : "NO dice si es con o sin IVA"}`);
});
await caso("wip-10-las-cifras-en-un-renglon", "", async p => {
  const grandes = await p.evaluate(() => [...document.querySelectorAll("#root *")].filter(e => !/^H[1-6]$/.test(e.tagName) && !e.closest("h1,h2,h3") && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) >= 18).map(e => e.textContent.trim().slice(0, 24)));
  ok("wip-10-las-cifras-en-un-renglon", grandes.length === 0, grandes.length ? "cifras de tarjeta (18 px o más): " + grandes.slice(0, 6).join(" | ") : "sin tarjetas de número grande");
});
for (const ancho of [1366, 1920]) {
  await caso(`wip-11-cabe-a-${ancho}`, "", async p => {
    for (const n of ["Producción", "Salida"]) await abrirZona(p, n).catch(() => {});
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(`wip-11-cabe-a-${ancho}`, r.sw <= r.cw, `a ${ancho}: ancho de la página ${r.sw} en ${r.cw}`);
  }, { viewport: { width: ancho, height: ancho === 1366 ? 768 : 1080 } });
}

// ── vuelta 2: por donde no se diseñó (el dato que cambia con la vista abierta, el top, el margen, vacío de verdad) ──
await caso("wip-12-la-que-se-reactiva-pasa-a-la-planta", "", async p => {
  await p.evaluate(() => window.__cambiar("OP-P-0711", { snooze_reason: null, snooze_kind: null, snooze_stage: null })); await espera(p, 400);
  const t = await texto(p);
  ok("wip-12-la-que-se-reactiva-pasa-a-la-planta", /En proceso[^$]{0,40}\$96,000/.test(t) && /espera que el cliente pida su factura[^$]{0,60}\$26,000/i.test(t),
    `a P-0711 (KFC, $30,000) le quitan la espera con la vista abierta: «${(t.match(/En proceso[^·]{0,40}/) || ["no dice"])[0]}» (debe $96,000) y la espera «${(t.match(/espera que el cliente[^·]{0,60}/i) || ["no dice"])[0]}» (debe $26,000)`);
});
await caso("wip-13-el-top-sin-lo-que-espera", "", async p => {
  const t = await texto(p), top = (t.match(/Top 5 clientes[\s\S]{0,400}/) || [""])[0];
  ok("wip-13-el-top-sin-lo-que-espera", !!top && !/KFC ESPERA|PRB ESPERA/.test(top) && /POR FOLIAR/.test(top), `el top 5: «${top.slice(0, 160)}» (sin KFC ni PRB, que esperan al cliente; el primero, POR FOLIAR con $12,000)`);
});
await caso("wip-14-el-margen-de-la-maquila-dice-que-es", "", async p => {
  const t = await texto(p);
  ok("wip-14-el-margen-de-la-maquila-dice-que-es", /Margen de la maquila \$3,000/.test(t) && !/\bM \$/.test(t), `la zona de maquila: ${/Margen de la maquila \$3,000/.test(t) ? "«Margen de la maquila $3,000»" : "«" + ((t.match(/M \$[\d,]+/) || ["no dice el margen"])[0]) + "»"}`);
});
await caso("wip-15-vacio-de-verdad-si-lo-dice", "caso=vacio", async p => {
  const t = await texto(p);
  ok("wip-15-vacio-de-verdad-si-lo-dice", /No hay órdenes en proceso/.test(t) && !/Sin cifras/.test(t), `se leyó y no hay activas: ${/No hay órdenes en proceso/.test(t) ? "lo dice" : "NO lo dice («" + t.slice(0, 120) + "»)"}`);
});
await caso("wip-16-la-lista-de-lo-que-espera", "", async p => {
  const region = p.getByRole("region", { name: /espera que el cliente pida su factura/i });
  const sec = (await region.count()) ? ((await region.first().innerText()) || "").replace(/\s+/g, " ") : "";
  const b = region.getByRole("button", { name: /P-0711/ }); const hay = sec ? await b.count() : 0;
  if (hay) { await b.first().click(); await espera(p); }
  ok("wip-16-la-lista-de-lo-que-espera", /KFC ESPERA/.test(sec) && /\$30,000/.test(sec) && /MAQUILA ESPERA/.test(sec) && hay >= 1 && (await lineas(p, "accion OP-P-0711 detail")).length === 1,
    `la sección de lo que espera al cliente: ${/KFC ESPERA/.test(sec) && /MAQUILA ESPERA/.test(sec) ? "dice cuáles (P-0711 KFC $30,000, P-0710 y P-0707)" : "NO dice cuáles"}; ${hay ? "cada una se abre" : "no se abren"}`);
});
await caso("wip-17-lo-de-stock-y-lo-cancelado-no-cuenta", "", async p => {
  await abrirZona(p, "Producción").catch(() => {});
  const t = await texto(p), malas = ["CARGADA A STOCK", "CANCELADA A MEDIAS", "P-0692", "P-0693"].filter(x => t.includes(x));
  ok("wip-17-lo-de-stock-y-lo-cancelado-no-cuenta", !malas.length, malas.length ? "cuenta lo que no está en proceso: " + malas.join(", ") + " (P-0692 «En Stock» es final en toda la app; P-0693 tiene su cancelación)" : "ni lo de stock ni lo cancelado");
});
await caso("wip-18-las-zonas-suman-lo-de-arriba", "", async p => {
  const t = await texto(p);
  const arriba = Number(((t.match(/En proceso[^$]{0,40}\$([\d,]+)/) || [])[1] || "").replace(/,/g, ""));
  let suma = 0; const vistas = [];
  for (const n of ["Captura", "Pre-prensa", "Producción", "Maquila", "Regreso", "Salida"]) {
    const m = (await zonaTexto(p, n)).match(/\$([\d,]+)/);
    vistas.push(n + " " + (m ? "$" + m[1] : "sin cifra")); if (m) suma += Number(m[1].replace(/,/g, ""));
  }
  ok("wip-18-las-zonas-suman-lo-de-arriba", arriba === 66000 && suma === arriba, `arriba: ${arriba ? "$" + arriba.toLocaleString("en-US") : "no dice"}; las zonas: ${vistas.join(", ")} = $${suma.toLocaleString("en-US")}`);
});
// con centavos: redondear cada zona por su lado a pesos hace que no sumen lo de arriba (Marcelo revisa que los números cuadren)
await caso("wip-19-con-centavos-tambien-suman", "caso=centavos", async p => {
  const num = s => Number(String(s || "").replace(/[$,]/g, ""));
  const t = await texto(p);
  const arriba = num((t.match(/En proceso[^$]{0,40}(\$[\d,]+(?:\.\d\d)?)/) || [])[1]);
  let suma = 0; const vistas = [];
  for (const n of ["Captura", "Pre-prensa", "Producción", "Maquila", "Regreso", "Salida"]) {
    const m = (await zonaTexto(p, n)).match(/\$[\d,]+(?:\.\d\d)?/);
    vistas.push(n + " " + (m ? m[0] : "sin cifra")); if (m) suma += num(m[0]);
  }
  suma = Math.round(suma * 100) / 100;
  ok("wip-19-con-centavos-tambien-suman", arriba === 66001 && suma === arriba, `con $2,000.50 en Captura y $7,000.50 en Pre-prensa: arriba ${arriba ? "$" + arriba.toLocaleString("en-US") : "no dice"}; las zonas: ${vistas.join(", ")} = $${suma.toLocaleString("en-US")}`);
});

// ── vuelta 2, segunda tanda (escrita con el primer arreglo ya corriendo, antes de verlo): el límite, el dato que se mueve, muchas, el botón de precio ──
await caso("wip-20-un-precio-negativo-no-resta", "caso=negativo", async p => {
  const t = await texto(p), captura = await zonaTexto(p, "Captura");
  ok("wip-20-un-precio-negativo-no-resta", /En proceso[^$]{0,40}\$64,000/.test(t) && /2 sin precio/.test(t) && /1 sin precio/.test(captura) && !/-\$|−\$|\$-/.test(t),
    `P-0700 con −$2,000: «${(t.match(/En proceso[^·]{0,40}/) || ["no dice"])[0]}» (debe $64,000: no resta), ${/2 sin precio/.test(t) ? "cuenta 2 sin precio" : "NO cuenta 2 sin precio"}; Captura «${captura.slice(0, 80)}»`);
});
await caso("wip-21-la-que-cambia-de-etapa-con-la-zona-abierta", "", async p => {
  await abrirZona(p, "Producción");
  await p.evaluate(() => window.__cambiar("OP-P-0704", { stage: "packaging", current_machine: null, machine_queue_position: null, timeline: [{ to: "packaging", date: new Date().toISOString(), action: "→ packaging" }] })); await espera(p, 400);
  const prod = await zonaTexto(p, "Producción"), salida = await zonaTexto(p, "Salida");
  const panel = ((await p.locator("#wip-z-produccion").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("wip-21-la-que-cambia-de-etapa-con-la-zona-abierta", /8 órdenes/.test(prod) && /\$18,000/.test(prod) && /\$31,000/.test(salida) && !!panel && !/P-0704/.test(panel),
    `P-0704 ($10,000) pasa de la PM-74 a Empaque con Producción abierta: Producción «${prod.slice(0, 90)}» (debe 8 y $18,000), Salida «${salida.slice(0, 70)}» (debe $31,000); ${!panel ? "la zona se cerró" : /P-0704/.test(panel) ? "P-0704 sigue en la lista de Producción" : "ya no está en la lista"}`);
});
await caso("wip-22-muchas-que-esperan", "caso=muchas", async p => {
  const region = p.getByRole("region", { name: /espera que el cliente pida su factura/i });
  const primera = ((await region.getByRole("button").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const ver = region.getByRole("button", { name: /^Ver las 8$/ }); const hay = await ver.count();
  if (hay) { await ver.click(); await espera(p); }
  const todas = new Set(((await region.innerText().catch(() => "")) || "").match(/P-07(0[017]|1[01]|3[0-4])/g) || []).size;
  const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok("wip-22-muchas-que-esperan", /P-0734/.test(primera) && /hace 11 días/.test(primera) && hay === 1 && todas === 8 && r.sw <= r.cw,
    `8 esperan: la primera «${primera.slice(0, 70)}» (debe P-0734, lista hace 11 días); ${hay ? "«Ver las 8»" : "sin «Ver las 8»"}; después se ven ${todas} de 8; con el nombre de 90 letras, ancho ${r.sw} en ${r.cw}`);
});
await caso("wip-23-editar-precio-abre-la-orden", "", async p => {
  const b = p.getByRole("button", { name: /Editar precio/i }); const hay = await b.count();
  if (hay) { await b.first().click(); await espera(p); }
  ok("wip-23-editar-precio-abre-la-orden", hay === 1 && (await lineas(p, "accion OP-P-0712 edit")).length === 1, `${hay} botón(es) «Editar precio»; ${(await lineas(p, "accion OP-P-0712 edit")).length ? "abre P-0712 para capturarlo" : "no abre la orden"}`);
});

// ── vuelta 3: fallas EN los arreglos (el botón que desaparece, el doble clic, lo que se entrega con la vista abierta) ──
await caso("wip-24-ver-las-7-con-el-teclado-no-pierde-el-lugar", "", async p => {
  await abrirZona(p, "Producción");
  const t = await tabHasta(p, x => /^Ver las 7$/.test(x.trim()));
  if (t) await p.keyboard.press("Enter");
  await espera(p);
  const foco = await p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? "(la página: se perdió)" : (a.innerText || a.tagName).replace(/\s+/g, " ").slice(0, 60); });
  ok("wip-24-ver-las-7-con-el-teclado-no-pierde-el-lugar", !!t && /P-07\d\d/.test(foco), `${t ? "Enter en «Ver las 7»" : "con Tab NO se llega a «Ver las 7»"}; el foco queda en: ${foco} (debe la sexta orden, la primera de las que aparecen)`);
});
await caso("wip-25-la-que-se-entrega-sale-de-la-espera", "", async p => {
  await p.evaluate(() => window.__cambiar("OP-P-0710", { stage: "delivered", snooze_reason: null, snooze_kind: null })); await espera(p, 400);
  const t = await texto(p);
  const region = ((await p.getByRole("region", { name: /espera que el cliente pida su factura/i }).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("wip-25-la-que-se-entrega-sale-de-la-espera", /espera que el cliente pida su factura[^$]{0,60}\$36,000 · 2 órdenes/i.test(t) && !/PRB ESPERA/.test(region) && /En proceso[^$]{0,40}\$66,000/.test(t),
    `P-0710 (PRB, $20,000) se entrega con la vista abierta: «${(t.match(/espera que el cliente pida su factura[^·]{0,30}·[^·]{0,12}/i) || ["no dice"])[0]}» (debe $36,000 · 2 órdenes); ${/PRB ESPERA/.test(region) ? "PRB sigue en la lista" : "ya no está en la lista"}`);
});
await caso("wip-26-doble-clic-en-ver-las-7-no-abre-una-orden", "", async p => {
  await abrirZona(p, "Producción");
  const b = p.getByRole("button", { name: /^Ver las 7$/ });
  if (await b.count()) await b.dblclick();
  await espera(p);
  const abiertas = await lineas(p, "accion "), vistas = new Set((await texto(p)).match(/P-07(03|2\d)/g) || []).size;
  ok("wip-26-doble-clic-en-ver-las-7-no-abre-una-orden", !abiertas.length && vistas === 7, `doble clic en «Ver las 7»: ${abiertas.length ? "ABRIÓ " + abiertas.join(", ") + " (el segundo clic cayó en la orden que apareció bajo el ratón)" : "no abre ninguna"}; se ven ${vistas} de 7`);
});
await caso("wip-27-doble-clic-en-una-zona-la-deja-abierta", "", async p => {
  await zona(p, "Producción").dblclick(); await espera(p);
  const abierta = await zona(p, "Producción").getAttribute("aria-expanded");
  ok("wip-27-doble-clic-en-una-zona-la-deja-abierta", abierta === "true" && /P-0703/.test(await texto(p)), `doble clic en Producción (la costumbre): aria-expanded ${abierta} (debe abierta: el segundo clic no la cierra)`);
});

// ── vuelta 4 (la última): los arreglos de la 3 en los otros lugares donde aplican ──
await caso("wip-28-doble-clic-en-una-orden-la-abre-una-vez", "", async p => {
  await abrirZona(p, "Producción");
  await p.getByRole("button", { name: /P-0703/ }).first().dblclick(); await espera(p);
  const n = (await lineas(p, "accion OP-P-0703 detail")).length;
  ok("wip-28-doble-clic-en-una-orden-la-abre-una-vez", n === 1, `doble clic en P-0703: se pidió abrir ${n} vez/veces (debe 1)`);
});
await caso("wip-29-ver-las-8-de-lo-que-espera-con-el-teclado", "caso=muchas", async p => {
  const t = await tabHasta(p, x => /^Ver las 8$/.test(x.trim()));
  if (t) await p.keyboard.press("Enter");
  await espera(p);
  const foco = await p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? "(la página: se perdió)" : (a.innerText || a.tagName).replace(/\s+/g, " ").slice(0, 60); });
  ok("wip-29-ver-las-8-de-lo-que-espera-con-el-teclado", !!t && /P-073[0-3]/.test(foco), `${t ? "Enter en «Ver las 8» de lo que espera" : "con Tab NO se llega a «Ver las 8»"}; el foco queda en: ${foco} (debe la sexta de las que esperan)`);
});
await caso("wip-30-doble-clic-en-editar-precio-abre-una-vez", "", async p => {
  const b = p.getByRole("button", { name: /Editar precio/i });
  if (await b.count()) await b.first().dblclick();
  await espera(p);
  const n = (await lineas(p, "accion OP-P-0712 edit")).length;
  ok("wip-30-doble-clic-en-editar-precio-abre-una-vez", n === 1, `doble clic en «Editar precio» de P-0712: se pidió abrir la forma ${n} vez/veces (debe 1)`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nwip: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
