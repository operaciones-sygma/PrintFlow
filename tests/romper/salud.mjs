// Tratar de ROMPER «Datos Pendientes» (Lupita y Karla) y «Salud Operativa» (Dirección): `OperationalHealthView`, su /impeccable critique de la
// noche del 16-oct. Cada caso afirma lo que DEBERÍA pasarle a quien la abre: una FALLA es un bug. Vuelta 1: escritas antes del arreglo.
// El reloj del navegador va fijo en el miércoles 14-oct-2026 a las 12:00 de México (las órdenes del banco son de esa semana).
// Uso: node salud.mjs <dir-capturas> [puerto=5184]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5184);
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
    await page.getByRole("heading", { name: /Datos Pendientes|Salud Operativa/ }).waitFor({ timeout: 30000 });
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
// el texto de la vista (sin el registro del banco)
const texto = p => p.evaluate(() => { const r = document.getElementById("root").cloneNode(true); r.querySelector("#log")?.remove(); return r.innerText.replace(/\s+/g, " "); });
// dónde empieza (en y) lo primero que dice algo
const yDe = async (p, re) => { const l = p.getByText(re).first(); return (await l.count()) ? (await l.boundingBox())?.y ?? -1 : -1; };
const yTitulo = async (p, re) => { const l = p.getByRole("heading", { name: re }).first(); return (await l.count()) ? (await l.boundingBox())?.y ?? -1 : -1; };
// con Tab hasta un elemento cuyo texto cumpla `quiere`; devuelve su texto (o "" si no se llegó)
const tabHasta = async (p, quiere, max = 80) => {
  for (let i = 0; i < max; i++) {
    await p.keyboard.press("Tab");
    const t = await p.evaluate(() => (document.activeElement && document.activeElement !== document.body) ? (document.activeElement.innerText || document.activeElement.getAttribute("aria-label") || "") : "");
    if (quiere(t)) return t;
  }
  return "";
};
// todos los textos de la vista que no llegan a AA contra su fondo de verdad (los fondos con transparencia se componen hasta uno opaco)
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
    const a = lum(nums(s.color)), b = lum(fondo(el)), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (r < (grande ? 3 : 4.5)) malos.push(t.slice(0, 40) + " " + r.toFixed(1));
  }
  return malos;
});

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
for (const [n, rol, quien] of [["01", "secretaria", "Lupita"], ["02", "karla", "Karla"]]) {
  await caso(`dp-${n}-${quien.toLowerCase()}-ve-primero-lo-que-puede-completar`, "rol=" + rol, async p => {
    const precio = await yTitulo(p, /sin precio capturado/i), incompletos = await yTitulo(p, /Datos incompletos/i);
    const prioridad = await yDe(p, /Prioridad del d[ií]a/i), pulso = await yTitulo(p, /Pulso/i);
    ok(`dp-${n}-${quien.toLowerCase()}-ve-primero-lo-que-puede-completar`, precio >= 0 && incompletos >= 0 && precio < prioridad && incompletos < prioridad && incompletos < pulso,
      `${quien}: «sin precio» en y=${Math.round(precio)}, «Datos incompletos» en ${Math.round(incompletos)}; la prioridad del día en ${Math.round(prioridad)} y el pulso en ${Math.round(pulso)} (lo que puede completar va antes)`);
  });
}
await caso("dp-03-direccion-conserva-su-orden", "rol=admin", async p => {
  const prioridad = await yDe(p, /Prioridad del d[ií]a/i), precio = await yTitulo(p, /sin precio capturado/i), pulso = await yTitulo(p, /Pulso/i);
  ok("dp-03-direccion-conserva-su-orden", prioridad >= 0 && prioridad < precio && precio < pulso,
    `Dirección: la prioridad del día en y=${Math.round(prioridad)}, «sin precio» en ${Math.round(precio)}, el pulso en ${Math.round(pulso)} (su orden de siempre)`);
});
await caso("dp-04-sin-razon-no-hay-alarma", "rol=secretaria&caso=calma", async p => {
  const n = await p.getByText(/Prioridad del d[ií]a/i).count();
  ok("dp-04-sin-razon-no-hay-alarma", n === 0, `nada vencido, urgente ni estancado: ${n ? "SALE «Prioridad del día» (es sólo la orden más cara)" : "no sale la alarma"}`);
});
await caso("dp-05-a-lupita-la-prioridad-no-le-grita", "rol=secretaria", async p => {
  const borde = await p.getByText(/Prioridad del d[ií]a/i).first().evaluate(e => {
    for (let x = e, i = 0; x && i < 5; x = x.parentElement, i++) { const s = getComputedStyle(x); if (parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== "none") return s.borderTopWidth + " " + s.borderTopColor; }
    return "sin borde"; });
  ok("dp-05-a-lupita-la-prioridad-no-le-grita", !/255, 59, 48|224, 59, 48|185, 28, 28/.test(borde),
    `la caja de la prioridad (una orden en la máquina de Gerardo, que Lupita no mueve): borde ${borde}`);
});
await caso("dp-06-sin-lectura-no-dice-que-todo-esta-bien", "rol=secretaria&lectura=no", async p => {
  const t = await texto(p);
  const mienten = ["Sin órdenes estancadas", "Datos completos", "Todas las máquinas operativas", "taller está libre"].filter(x => t.includes(x));
  ok("dp-06-sin-lectura-no-dice-que-todo-esta-bien", mienten.length === 0 && /Sin cifras/.test(t),
    `sin haber leído nada de la base: ${mienten.length ? "dice «" + mienten.join("», «") + "»" : "no dice que todo está bien"}; ${/Sin cifras/.test(t) ? "dice que no hay cifras" : "NO dice que no hay cifras"}`);
});
await caso("dp-07-estancadas-con-el-teclado", "rol=secretaria", async p => {
  const t = await tabHasta(p, x => /P-0448/.test(x) && /estancada/.test(x));
  if (t) await p.keyboard.press("Enter");
  await espera(p);
  ok("dp-07-estancadas-con-el-teclado", !!t && (await lineas(p, "accion op-448 detail")).length === 1,
    `con Tab ${t ? "se llega a P-0448 en Estancadas" : "NO se llega a P-0448 en Estancadas"}; Enter ${(await lineas(p, "accion op-448 detail")).length ? "la abre" : "no la abre"}`);
});
await caso("dp-08-datos-incompletos-con-el-teclado", "rol=secretaria", async p => {
  // (v10.84.136: era P-0661, en diseño sin fecha, que con la decisión del 16-oct va en la lista plegada; ahora P-0448, por entregar sin fecha, abierta)
  const t = await tabHasta(p, x => /P-0448/.test(x) && !/estancada/i.test(x));
  if (t) await p.keyboard.press("Enter");
  await espera(p);
  ok("dp-08-datos-incompletos-con-el-teclado", !!t && (await lineas(p, "accion op-448 detail")).length === 1,
    `con Tab ${t ? "se llega a P-0448 (por entregar, sin fecha)" : "NO se llega a P-0448 en los datos incompletos"}; Enter ${(await lineas(p, "accion op-448 detail")).length ? "la abre" : "no la abre"}`);
});
await caso("dp-09-las-que-no-caben-se-pueden-ver", "rol=secretaria&caso=muchos", async p => {
  await p.getByText(/Sin tel[eé]fono/).first().click(); await espera(p);
  const antes = await p.getByText(/^SIN TELEFONO \d+$/).count() + await p.getByText(/SIN TELEFONO \d+ ·/).count();
  const mas = p.getByRole("button", { name: /Ver (las )?13|Ver 3 m[aá]s|Ver las otras 3/i });
  const hay = await mas.count();
  if (hay) { await mas.first().click(); await espera(p); }
  const filas = await p.evaluate(() => [...document.querySelectorAll("#root *")].filter(e => !e.closest("#log") && [...e.childNodes].some(n => n.nodeType === 3 && /SIN TELEFONO \d+/.test(n.textContent))).length);
  ok("dp-09-las-que-no-caben-se-pueden-ver", hay > 0 && filas >= 13,
    `13 sin teléfono: al abrir la lista se ven ${antes || "las primeras"}; ${hay ? "hay con qué ver las demás" : "NO hay con qué ver las demás («+ 3 más» no se abre)"}; después se ven ${filas}`);
});
await caso("dp-10-sin-precio-una-sola-vez", "rol=secretaria", async p => {
  const t = await texto(p);
  const veces = (t.match(/P-0643/g) || []).length;
  ok("dp-10-sin-precio-una-sola-vez", veces === 1, `P-0643 (sin precio) sale ${veces} ${veces === 1 ? "vez" : "veces"} en la vista`);
});
for (const rol of ["secretaria", "admin"]) {
  await caso(`dp-11-todo-se-lee-${rol}`, "rol=" + rol, async p => {
    const malos = await sinAA(p);
    ok(`dp-11-todo-se-lee-${rol}`, malos.length === 0, malos.length ? `${malos.length} textos sin AA: ${malos.slice(0, 8).join(" · ")}` : "todo con AA");
  });
}
await caso("dp-12-karla-se-ve-a-si-misma", "rol=karla", async p => {
  const tu = await p.getByText("Tú", { exact: true }).count();
  ok("dp-12-karla-se-ve-a-si-misma", tu === 1, `Karla: ${tu ? "su tarjeta dice «Tú»" : "su tarjeta NO dice «Tú» (a Lupita sí)"}`);
});
await caso("dp-13-en-espanol-y-sin-abreviar", "rol=secretaria", async p => {
  const t = await texto(p);
  // (« órd»: \b no sirve antes de una letra con acento)
  const raras = [/\bWarning\b/, /\(s\)/, / órd\b/, /\bTop\b/, /\bstage\b/i, /\bTip\b/].filter(r => r.test(t)).map(r => (t.match(r) || [""])[0]);
  ok("dp-13-en-espanol-y-sin-abreviar", raras.length === 0, raras.length ? "dice: «" + raras.join("», «") + "»" : "sin inglés ni «(s)» ni abreviaturas");
});
await caso("dp-14-quien-la-capturo-por-su-nombre", "rol=secretaria", async p => {
  const t = await texto(p);
  ok("dp-14-quien-la-capturo-por-su-nombre", !/por secretaria/.test(t) && /Lupita/.test(t), `P-0643: ${/por secretaria/.test(t) ? "dice «por secretaria» (el usuario)" : "no dice el usuario"}; ${/Lupita/.test(t) ? "dice Lupita" : "no dice Lupita"}`);
});
await caso("dp-15-el-cliente-largo-no-se-corta-a-media-palabra", "rol=secretaria", async p => {
  const completo = await p.evaluate(() => [...document.querySelectorAll("#root *")].some(e => !e.closest("#log") && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.includes("JOSE DE JESUS RODRIGUEZ HERNANDEZ"))));
  ok("dp-15-el-cliente-largo-no-se-corta-a-media-palabra", completo, completo ? "el nombre completo está (la orilla lo corta con «…» si no cabe)" : "«JOSE DE JESUS RODRIGUE»: cortado a media palabra y sin «…»");
});
for (const ancho of [1366, 1920]) {
  await caso(`dp-16-cabe-a-${ancho}`, "rol=secretaria&caso=muchos", async p => {
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(`dp-16-cabe-a-${ancho}`, r.sw <= r.cw, `a ${ancho}: ancho de la página ${r.sw} en ${r.cw}`);
  }, { viewport: { width: ancho, height: ancho === 1366 ? 768 : 1080 } });
}
await caso("dp-17-direccion-conserva-lo-suyo", "rol=admin", async p => {
  const t = await texto(p);
  const falta = ["Salud Operativa", "Notificar", "Limpieza", "Fusionar clientes", "OC-0900"].filter(x => !t.includes(x));
  ok("dp-17-direccion-conserva-lo-suyo", falta.length === 0, falta.length ? "a Dirección le falta: " + falta.join(", ") : "Dirección tiene su prioridad con «Notificar», la limpieza (OC-0900 huérfana) y sus herramientas");
});
await caso("dp-18-el-pulso-despliega-sola-la-suya", "rol=secretaria", async p => {
  // el botón de su tarjeta (con su nombre para el lector de pantalla; en el código de antes, «Ver todas» dentro de la tarjeta de Lupita)
  const suyo = p.getByRole("button", { name: /Ver las órdenes de Lupita/ });
  if (await suyo.count()) await suyo.click();
  else await p.locator("div", { has: p.getByText("Lupita", { exact: true }) }).filter({ has: p.getByRole("button", { name: /Ver todas/ }) }).last().getByRole("button", { name: /Ver todas/ }).click();
  await espera(p);
  const t = await texto(p);
  ok("dp-18-el-pulso-despliega-sola-la-suya", /P-0655/.test(t) && !/P-0662/.test(t), `al desplegar la de Lupita: ${/P-0655/.test(t) ? "sale su P-0655" : "NO sale su P-0655"}; la de Karla (P-0662) ${/P-0662/.test(t) ? "TAMBIÉN se desplegó" : "sigue plegada"}`);
});
await caso("dp-19-vacio-de-verdad-si-lo-dice", "rol=secretaria&caso=vacio", async p => {
  const t = await texto(p);
  ok("dp-19-vacio-de-verdad-si-lo-dice", /Sin órdenes estancadas/.test(t) && !/Sin cifras/.test(t), `se leyó y no hay órdenes: ${/Sin órdenes estancadas/.test(t) ? "lo dice" : "NO lo dice"}`);
});
await caso("dp-20-la-prensa-caida-en-palabras", "rol=secretaria&caso=mantenimiento", async p => {
  const t = await texto(p);
  ok("dp-20-la-prensa-caida-en-palabras", /Printmaster 52/.test(t) && /1 día\b/.test(t) && !/\(s\)/.test(t) && /Gerardo/.test(t) && !/por gerardo/.test(t),
    `la prensa en mantenimiento: «${(t.match(/Printmaster 52[^·]*·[^·]*·[^·]{0,30}/) || ["no sale"])[0]}»`);
});
await caso("dp-21-la-prioridad-dice-lo-que-pasa", "rol=secretaria", async p => {
  const t = await texto(p);
  ok("dp-21-la-prioridad-dice-lo-que-pasa", /P-0611/.test(t) && /Vencida hace 7 d[ií]as/i.test(t) && /Gerardo/.test(t),
    `P-0611: ${/Vencida hace 7 d[ií]as/i.test(t) ? "«vencida hace 7 días»" : "«" + ((t.match(/VENCIDA hace[^·]*/i) || ["no dice cuánto"])[0]) + "»"}, con Gerardo ${/Gerardo/.test(t) ? "sí" : "no"}`);
});

// ── vuelta 2: por donde no se diseñó (el dato que cambia con la vista abierta, lo de Dirección sin lectura, la estancada contra la cara, teclado) ──
await caso("dp-22-le-ponen-precio-con-la-vista-abierta", "rol=secretaria", async p => {
  const antes = await p.getByRole("heading", { name: /sin precio capturado/i }).count();
  await p.evaluate(() => window.__cambiar("op-643", { price: 5000 })); await espera(p, 400);
  const despues = await p.getByRole("heading", { name: /sin precio capturado/i }).count(), t = await texto(p);
  ok("dp-22-le-ponen-precio-con-la-vista-abierta", antes === 1 && despues === 0 && !/P-0643/.test(t),
    `P-0643 sin precio (la sección ${antes ? "sale" : "NO sale"}); otra persona le pone precio: la sección ${despues ? "SIGUE" : "se va"} y P-0643 ${/P-0643/.test(t) ? "SIGUE en la vista" : "ya no sale"}`);
});
await caso("dp-23-la-lista-larga-se-achica-abierta", "rol=secretaria&caso=muchos", async p => {
  await p.getByText(/Sin tel[eé]fono/).first().click(); await espera(p);
  const ver = p.getByRole("button", { name: /^Ver las 13$/ });
  if (await ver.count()) { await ver.click(); await espera(p); }
  await p.evaluate(() => { for (const id of ["op-800", "op-801", "op-802"]) window.__cambiar(id, { client_phone: "4770000000" }); }); await espera(p, 400);
  const filas = await p.evaluate(() => [...document.querySelectorAll("#root *")].filter(e => !e.closest("#log") && [...e.childNodes].some(n => n.nodeType === 3 && /SIN TELEFONO \d+/.test(n.textContent))).length);
  const botones = await p.getByRole("button", { name: /^Ver las \d+$|Ver sólo las primeras/ }).count();
  ok("dp-23-la-lista-larga-se-achica-abierta", filas === 10 && botones === 0, `abierta con las 13, a 3 les ponen teléfono: se ven ${filas} (10) y ${botones ? "SIGUE el botón de ver más" : "sin botón de ver más"}`);
});
await caso("dp-24-capturar-precio-dice-de-cual-y-abre-la-orden", "rol=karla", async p => {
  const b = p.getByRole("button", { name: /Capturar el precio de P-0643/ });
  const hay = await b.count();
  if (hay) { await b.click(); await espera(p); }
  ok("dp-24-capturar-precio-dice-de-cual-y-abre-la-orden", hay === 1 && (await lineas(p, "accion op-643 edit")).length === 1,
    `Karla: ${hay ? "«Capturar precio» dice de cuál (P-0643)" : "el botón NO dice de cuál orden es"}; ${(await lineas(p, "accion op-643 edit")).length ? "abre la orden para capturarlo" : "no abre nada"}`);
});
await caso("dp-25-direccion-sin-lectura", "rol=admin&lectura=no", async p => {
  const t = await texto(p);
  ok("dp-25-direccion-sin-lectura", /Sin cifras/.test(t) && /Fusionar clientes/.test(t) && !/Limpieza/.test(t) && !/Notificar/.test(t),
    `Dirección sin lectura: ${/Sin cifras/.test(t) ? "dice que no hay cifras" : "NO dice que no hay cifras"}; sus herramientas ${/Fusionar clientes/.test(t) ? "sí" : "NO"}; limpieza ${/Limpieza/.test(t) ? "SALE (sin datos)" : "no"}; notificar ${/Notificar/.test(t) ? "SALE" : "no"}`);
});
await caso("dp-26-la-estancada-gana-a-la-cara", "rol=admin&caso=estancada", async p => {
  const caja = await p.getByText(/Prioridad del d[ií]a/i).first().evaluate(e => { let x = e; for (let i = 0; i < 3 && x && !/P-0\d{3}/.test(x.innerText); i++) x = x.parentElement; return x ? x.innerText.replace(/\s+/g, " ") : ""; }).catch(() => "");
  ok("dp-26-la-estancada-gana-a-la-cara", /P-0448/.test(caja) && !/P-0702/.test(caja), `una estancada sin fecha (P-0448, $75,000) contra una sana de $500,000 (P-0702): la prioridad es «${caja.slice(0, 90)}»`);
});
await caso("dp-27-direccion-no-tiene-tu", "rol=admin", async p => {
  const tu = await p.getByText("Tú", { exact: true }).count();
  ok("dp-27-direccion-no-tiene-tu", tu === 0, `Dirección: ${tu ? "una tarjeta dice «Tú»" : "ninguna tarjeta dice «Tú»"}`);
});
await caso("dp-28-la-lista-plegada-se-abre-con-el-teclado", "rol=secretaria&caso=muchos", async p => {
  const t = await tabHasta(p, x => /Sin tel[eé]fono/.test(x));
  if (t) await p.keyboard.press("Enter");
  await espera(p);
  const abierta = await p.evaluate(() => document.activeElement?.getAttribute("aria-expanded"));
  const filas = await p.evaluate(() => [...document.querySelectorAll("#root *")].filter(e => !e.closest("#log") && [...e.childNodes].some(n => n.nodeType === 3 && /SIN TELEFONO \d+/.test(n.textContent))).length);
  ok("dp-28-la-lista-plegada-se-abre-con-el-teclado", !!t && abierta === "true" && filas >= 10, `con Tab ${t ? "se llega a «Sin teléfono del cliente»" : "NO se llega a la lista plegada"}; Enter: aria-expanded ${abierta}, ${filas} órdenes a la vista`);
});
await caso("dp-16c-direccion-cabe-a-1366", "rol=admin", async p => {
  const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok("dp-16c-direccion-cabe-a-1366", r.sw <= r.cw, `Dirección a 1366: ancho de la página ${r.sw} en ${r.cw}`);
});

// ── vuelta 3 (v10.84.136): las decisiones de Marcelo del 16-oct: «Cómo va la planta» sin dinero para Lupita y Karla, y cuántas tienen algo URGENTE
//   (el número del menú: sin precio, sin cantidad, maquila sin proveedor o costo, y sin fecha sólo ya por entregar). En el banco: P-0643 sin precio,
//   P-0448 en Salidas sin fecha y P-0650, maquila sin proveedor NI costo (cuenta una vez): 3. P-0661, en diseño sin fecha, no suma. ──
for (const [n, rol, quien] of [["29", "secretaria", "Lupita"], ["30", "karla", "Karla"]]) {
  await caso(`dp-${n}-${quien.toLowerCase()}-la-planta-sin-dinero`, "rol=" + rol, async p => {
    const t = await texto(p), i = t.indexOf("Cómo va la planta");
    const pesos = i >= 0 ? (t.slice(i).match(/\$\s?[\d,]+/g) || []) : [];
    ok(`dp-${n}-${quien.toLowerCase()}-la-planta-sin-dinero`, i >= 0 && pesos.length === 0,
      `${quien}, «Cómo va la planta»: ${i < 0 ? "NO SALE" : pesos.length ? "trae dinero: " + pesos.slice(0, 4).join(", ") : "sin dinero"} (la prioridad, las estancadas y las máquinas)`);
  });
}
await caso("dp-31-direccion-conserva-el-dinero", "rol=admin", async p => {
  const t = await texto(p);
  const atorados = /\$1,980 atorados/.test(t), estancada = /P-0448[^$]*\$75,000/.test(t), maquina = /Printmaster 74 · 1 orden\s*\$1,980/.test(t);
  ok("dp-31-direccion-conserva-el-dinero", atorados && estancada && maquina,
    `Dirección: «$1,980 atorados» ${atorados ? "sí" : "NO"}; P-0448 con sus $75,000 ${estancada ? "sí" : "NO"}; la Printmaster 74 con $1,980 ${maquina ? "sí" : "NO"}`);
});
const urgentesDice = t => (t.match(/\d+ (orden|órdenes) con algo urgente por capturar|Nada urgente por capturar/) || [""])[0];
for (const [n, rol, quien] of [["32", "secretaria", "Lupita"], ["33", "karla", "Karla"]]) {
  await caso(`dp-${n}-${quien.toLowerCase()}-dice-cuantas-son-urgentes`, "rol=" + rol, async p => {
    const sub = urgentesDice(await texto(p));
    ok(`dp-${n}-${quien.toLowerCase()}-dice-cuantas-son-urgentes`, sub === "3 órdenes con algo urgente por capturar",
      `${quien}: «${sub || "no dice cuántas son urgentes"}» (3: P-0643 sin precio, P-0448 por entregar sin fecha, P-0650 maquila sin proveedor ni costo)`);
  });
}
await caso("dp-34-lo-urgente-primero-y-lo-demas-plegado", "rol=secretaria", async p => {
  const t = await texto(p);
  const urgente = /Por entregar, sin fecha de entrega \(1\)/.test(t);
  const plegada = p.getByRole("button", { name: /Sin fecha de entrega, todavía en proceso \(1\)/ });
  const hay = await plegada.count(), abierta = hay ? await plegada.first().getAttribute("aria-expanded") : null;
  const yUrg = await yDe(p, /Por entregar, sin fecha/), yVenc = await yDe(p, /^Vencidas \(/);
  ok("dp-34-lo-urgente-primero-y-lo-demas-plegado", urgente && hay === 1 && abierta === "false" && !/P-0661/.test(t) && yUrg >= 0 && yUrg < yVenc,
    `«Por entregar, sin fecha de entrega (1)» ${urgente ? "sí" : "NO"}${yUrg >= 0 && yVenc >= 0 ? (yUrg < yVenc ? ", antes de «Vencidas»" : ", DESPUÉS de «Vencidas»") : ""}; «Sin fecha de entrega, todavía en proceso» ${hay ? (abierta === "false" ? "plegada" : "ABIERTA") : "NO SALE"}; P-0661 (en diseño) ${/P-0661/.test(t) ? "A LA VISTA" : "no está a la vista"}`);
});
await caso("dp-35-capturan-la-fecha-con-la-vista-abierta", "rol=secretaria", async p => {
  await p.evaluate(() => window.__cambiar("op-448", { due_date: "2026-10-20" })); await espera(p, 400);
  const t = await texto(p), sub = urgentesDice(t);
  ok("dp-35-capturan-la-fecha-con-la-vista-abierta", sub === "2 órdenes con algo urgente por capturar" && !/Por entregar, sin fecha/.test(t),
    `a P-0448 (en Salidas) le capturan la fecha: «${sub || "no dice cuántas"}»; «Por entregar, sin fecha» ${/Por entregar, sin fecha/.test(t) ? "SIGUE" : "se va"}`);
});
await caso("dp-36-sin-lectura-sin-numero", "rol=secretaria&lectura=no", async p => {
  const t = await texto(p), sub = urgentesDice(t);
  ok("dp-36-sin-lectura-sin-numero", !sub && /Sin cifras/.test(t), `sin lectura: ${sub ? "DICE «" + sub + "»" : "no dice cuántas son urgentes"}`);
});
await caso("dp-37-en-calma-nada-urgente", "rol=karla&caso=calma", async p => {
  const sub = urgentesDice(await texto(p));
  ok("dp-37-en-calma-nada-urgente", sub === "Nada urgente por capturar", `todo capturado: «${sub || "no dice"}»`);
});
// vuelta 2: por donde no se diseñó (la maquila recibida sin fecha, la que Dirección dejó en espera, una que llega a Salidas con la vista abierta)
await caso("dp-38-la-maquila-recibida-sin-fecha-cuenta", "rol=secretaria", async p => {
  await p.evaluate(() => window.__cambiar("op-662", { due_date: null })); await espera(p, 400);
  const t = await texto(p), sub = urgentesDice(t);
  ok("dp-38-la-maquila-recibida-sin-fecha-cuenta", sub === "4 órdenes con algo urgente por capturar" && /Por entregar, sin fecha de entrega \(2\)/.test(t),
    `a P-0662 (recibida de maquila, por entregar) le quitan la fecha: «${sub || "no dice"}»; «Por entregar, sin fecha» ${(t.match(/Por entregar, sin fecha de entrega \(\d+\)/) || ["no sale"])[0]}`);
});
await caso("dp-39-la-que-direccion-dejo-en-espera-no-suma", "rol=secretaria", async p => {
  await p.evaluate(() => window.__cambiar("op-643", { snooze_reason: "Esperando que el cliente confirme el precio", snooze_stage: "salidas" })); await espera(p, 400);
  const t = await texto(p), sub = urgentesDice(t);
  ok("dp-39-la-que-direccion-dejo-en-espera-no-suma", sub === "2 órdenes con algo urgente por capturar" && !/P-0643/.test(t),
    `P-0643 (sin precio) queda en espera desde la Torre: «${sub || "no dice"}»; ${/P-0643/.test(t) ? "SIGUE en «sin precio»" : "sale de «sin precio», como antes de esta versión"}`);
});
await caso("dp-40-llega-a-salidas-sin-fecha", "rol=karla", async p => {
  await p.evaluate(() => window.__cambiar("op-661", { stage: "salidas" })); await espera(p, 400);
  const t = await texto(p), sub = urgentesDice(t);
  ok("dp-40-llega-a-salidas-sin-fecha", sub === "4 órdenes con algo urgente por capturar" && !/todavía en proceso/.test(t),
    `P-0661 (sin fecha) pasa de diseño a Salidas con la vista abierta: «${sub || "no dice"}»; «todavía en proceso» ${/todavía en proceso/.test(t) ? "SIGUE" : "se va (ya no queda ninguna)"}`);
});

// ── vuelta 4 (v10.84.140): la lista que espera a que el cliente pida su factura no es «Vencida» ──
for (const rol of ["secretaria", "admin"]) {
  await caso(`dp-41-la-que-espera-al-cliente-no-es-vencida-${rol}`, "rol=" + rol + "&caso=espera", async p => {
    const t = await texto(p), venc = (t.match(/Vencidas \((\d+)\)/) || [])[1];
    ok(`dp-41-la-que-espera-al-cliente-no-es-vencida-${rol}`, venc === "1" && !/P-0663/.test(t), `con P-0663 (lista en Salidas, «el cliente no ha pedido factura», vencida el 9): «Vencidas (${venc ?? "no sale"})» (debe ser 1: P-0611); P-0663 ${/P-0663/.test(t) ? "SALE en la vista" : "no sale"}`);
  });
}

// ── vuelta 5 (v10.84.149; Marcelo, 17-oct: «sí, cuentan como a tiempo»): la que quedó LISTA a tiempo tampoco es «Vencida», aunque no tenga la pausa.
//   Escrita antes del arreglo ──
for (const rol of ["secretaria", "admin"]) {
  await caso(`dp-42-la-lista-a-tiempo-sin-pausa-no-es-vencida-${rol}`, "rol=" + rol + "&caso=lista", async p => {
    const t = await texto(p), venc = (t.match(/Vencidas \((\d+)\)/) || [])[1];
    // (sólo la cuenta de «Vencidas»: P-0664 sí puede salir como quieta en Salidas, porque le falta foliarse y entregarse)
    ok(`dp-42-la-lista-a-tiempo-sin-pausa-no-es-vencida-${rol}`, venc === "1", `con P-0664 (en Salidas desde el 8 sin la pausa, vencida el 9): «Vencidas (${venc ?? "no sale"})» (debe ser 1: P-0611)`);
  });
}

// ── vuelta 6 (v10.84.154 y v10.84.155; Marcelo, 17-oct: «si hazlo»): el pulso, un renglón por persona con sus ESTANCADAS (no las horas de su orden más
//   quieta, que contaban lo que espera su fecha); y cada renglón de «Datos incompletos» dice lo demás que le falta a esa orden. Escritas antes del arreglo ──
const pulso = p => p.evaluate(() => { const h = [...document.querySelectorAll("h3")].find(x => /Pulso por responsable/.test(x.textContent)); const c = h && h.nextElementSibling; if (!c) return null;
  return { grandes: [...c.querySelectorAll("*")].filter(e => parseFloat(getComputedStyle(e).fontSize) >= 20 && /^\d+$/.test((e.textContent || "").trim())).length,
    altos: [...c.children].map(x => Math.round(x.getBoundingClientRect().height)), texto: c.innerText.replace(/\s+/g, " ") }; });
await caso("dp-43-el-pulso-en-renglones", "rol=admin", async p => {
  const r = await pulso(p);
  ok("dp-43-el-pulso-en-renglones", !!r && r.grandes === 0 && r.altos.length > 0 && r.altos.every(a => a <= 60),
    `el pulso: ${r ? r.grandes + " números grandes; el alto de cada persona: " + JSON.stringify(r.altos) + " px (renglones de 60 px o menos)" : "no sale"}`);
});
await caso("dp-44-cuenta-estancadas-no-horas", "rol=admin", async p => {
  const r = await pulso(p), karla = ((await p.locator('[data-responsable="Karla"]').first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("dp-44-cuenta-estancadas-no-horas", !!r && !/Sin movimiento/.test(r.texto) && /\b1 estancada\b/.test(karla) && /\b3 órdenes\b/.test(karla),
    `el pulso ${r && /Sin movimiento/.test(r.texto) ? "DICE «Sin movimiento: hasta …» (cuenta también lo que espera su fecha)" : "sin las horas"}; Karla: «${karla.slice(0, 120) || "(sin su renglón)"}» (debe: 3 órdenes, 1 estancada: P-0448, seis días quieta en Salidas sin fecha)`);
});
await caso("dp-46-cada-renglon-dice-lo-demas-que-le-falta", "rol=secretaria", async p => {
  const filas = await p.locator("[data-tambien]").evaluateAll(es => es.map(e => (e.closest("button") || e).innerText.replace(/\s+/g, " ")));
  const prov = filas.some(f => /P-0650/.test(f) && /costo del proveedor/.test(f)), costo = filas.some(f => /P-0650/.test(f) && /proveedor de la maquila/.test(f));
  ok("dp-46-cada-renglon-dice-lo-demas-que-le-falta", filas.length === 2 && prov && costo,
    `«También le falta»: ${filas.length ? JSON.stringify(filas.map(f => f.slice(0, 100))) : "ningún renglón lo dice"} (P-0650, maquila sin proveedor ni costo: cada uno de sus dos renglones dice el otro)`);
});

// ── vuelta 7 (v10.84.154, por donde no se diseñó): el doble clic en «Ver las N» de una persona ──
await caso("dp-45-doble-clic-en-ver-las-de-una-persona", "rol=secretaria", async p => {
  const b = p.getByRole("button", { name: /Ver las órdenes de Lupita/ }).first(), hay = await b.count();
  if (hay) { await b.dblclick(); await espera(p, 400); }
  const t = await texto(p);
  ok("dp-45-doble-clic-en-ver-las-de-una-persona", hay > 0 && /P-0655/.test(t), `doble clic en «Ver las …» de Lupita: ${hay ? (/P-0655/.test(t) ? "se despliegan" : "el segundo clic las VUELVE A PLEGAR") : "SIN el botón"}`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nsalud: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
