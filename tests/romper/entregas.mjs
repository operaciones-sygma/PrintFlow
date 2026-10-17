// Tratar de ROMPER «Entregas» (el calendario de entregas, `Calendar`; v10.84.122, su /impeccable critique del 16-oct). Cada caso afirma lo que
// DEBERÍA pasarle a quien lo usa (Lupita, Karla, Gerardo, un vendedor): una FALLA es un bug. Vuelta 1: escritas antes del arreglo.
// El reloj del navegador va fijo en el miércoles 14-oct-2026 a las 12:00 de México: la semana del banco es del lunes 12 al domingo 18.
// Uso: node entregas.mjs <dir-capturas> [puerto=5185]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5185);
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
    await page.getByText("Calendario de Entregas").waitFor({ timeout: 30000 });
    await page.waitForTimeout(250);
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
const dialogo = p => p.getByRole("dialog");
// la ficha de una orden en el calendario (por su cliente)
// (sin la marca data-entrega —el código de antes—, la ficha es el texto del cliente: la vuelta 1 corre contra eso)
const ficha = async (p, cliente) => (await p.locator("[data-entrega]").count()) ? p.locator("[data-entrega]", { hasText: cliente }).first() : p.getByText(cliente, { exact: false }).first();
const abrir = async (p, cliente) => { await (await ficha(p, cliente)).click(); await dialogo(p).waitFor({ timeout: 2000 }); };

await caso("ent-01-la-semana-con-sus-entregas", "", async p => {
  const texto = (await p.locator("main, body").first().innerText()).replace(/\s+/g, " ");
  const fichas = await p.locator("[data-entrega]").allInnerTexts();
  const hoy = await p.locator("[aria-current=date]").innerText().catch(() => "");
  ok("ent-01-la-semana-con-sus-entregas", fichas.length === 7 && !/CANCELADA SA/.test(texto) && !/LA DE LA OTRA SEMANA/.test(texto) && /14/.test(hoy) && /12 al 18 de octubre/i.test(texto),
    `${fichas.length} fichas en la semana (7: sin la cancelada ni la de la otra semana); hoy marcado: «${hoy.replace(/\s+/g, " ")}»; el encabezado ${/12 al 18 de octubre/i.test(texto) ? "dice la semana" : "NO dice «12 al 18 de octubre»"}`);
});
await caso("ent-02-sin-motivo-lo-dice-en-la-ventana", "", async p => {
  await abrir(p, "COSQUIM");
  await p.locator("input[type=date]").fill("2026-10-20");
  await p.getByRole("button", { name: /Guardar/ }).click(); await espera(p);
  const err = await dialogo(p).locator("[role=alert]").innerText().catch(() => "");
  ok("ent-02-sin-motivo-lo-dice-en-la-ventana", /motivo/i.test(err) && (await dialogo(p).count()) === 1 && (await lineas(p, "cambio")).length === 0 && (await lineas(p, "alert:")).length === 0,
    `sin motivo: la ventana dice «${err}» (sin alert nativo: ${(await lineas(p, "alert:")).length}); cambios mandados: ${(await lineas(p, "cambio")).length}`);
});
await caso("ent-03-el-motivo-no-sale-en-rojo-antes-de-tiempo", "", async p => {
  await abrir(p, "COSQUIM");
  const motivo = dialogo(p).locator("input:not([type=date])").first();
  const antes = await motivo.evaluate(e => ({ borde: getComputedStyle(e).borderColor + " " + getComputedStyle(e).borderStyle + " " + getComputedStyle(e).borderWidth, invalido: e.getAttribute("aria-invalid") }));
  const etiqueta = await dialogo(p).getByText(/Por qué se cambia/).evaluate(e => getComputedStyle(e).color).catch(() => "");
  ok("ent-03-el-motivo-no-sale-en-rojo-antes-de-tiempo", !/185, 28, 28|224, 59, 48/.test(antes.borde) && antes.invalido !== "true" && !/185, 28, 28|224, 59, 48/.test(etiqueta),
    `al abrir, sin haber intentado guardar: el campo del motivo «${antes.borde}», aria-invalid ${antes.invalido}; su etiqueta en ${etiqueta}`);
});
await caso("ent-04-las-fichas-con-el-teclado", "", async p => {
  let llego = false;
  for (let i = 0; i < 40 && !llego; i++) { await p.keyboard.press("Tab"); llego = await p.evaluate(() => !!document.activeElement?.closest?.("[data-entrega]")); }
  const nombre = llego ? await p.evaluate(() => document.activeElement.getAttribute("aria-label") || document.activeElement.textContent) : "";
  if (llego) await p.keyboard.press("Enter");
  await espera(p);
  ok("ent-04-las-fichas-con-el-teclado", llego && (await dialogo(p).count()) === 1 && /entrega/i.test(nombre),
    `con Tab ${llego ? "se llega a una ficha («" + String(nombre).slice(0, 80) + "»)" : "NO se llega a ninguna ficha"}; Enter ${await dialogo(p).count() ? "abre la ventana" : "no abre nada"}`);
});
await caso("ent-05-la-ventana-es-una-ventana", "", async p => {
  await abrir(p, "COSQUIM");
  const modal = await dialogo(p).getAttribute("aria-modal");
  const foco = await p.evaluate(() => !!document.activeElement?.closest?.("[role=dialog]"));
  // Esc con el foco en la fecha y sin motivo escrito: cierra
  await p.locator("input[type=date]").focus(); await p.keyboard.press("Escape"); await espera(p);
  const cerroConEsc = (await dialogo(p).count()) === 0;
  // con un motivo escrito, Esc y el clic fuera NO lo pierden
  await abrir(p, "COSQUIM");
  await dialogo(p).locator("input:not([type=date])").first().fill("El cliente lo pidió");
  await p.keyboard.press("Escape"); await espera(p);
  const sigueEsc = (await dialogo(p).count()) === 1;
  await p.mouse.click(5, 5); await espera(p);
  const sigueFuera = (await dialogo(p).count()) === 1;
  const fuera = [];
  for (let i = 0; i < 6; i++) { await p.keyboard.press("Tab"); fuera.push(await p.evaluate(() => !!document.activeElement?.closest?.("[role=dialog]"))); }
  ok("ent-05-la-ventana-es-una-ventana", modal === "true" && foco && cerroConEsc && sigueEsc && sigueFuera && fuera.every(Boolean),
    `aria-modal ${modal}; el foco ${foco ? "adentro" : "FUERA"} al abrir; Esc sin motivo ${cerroConEsc ? "cierra" : "NO cierra"}; con motivo, Esc ${sigueEsc ? "no la cierra" : "LA CERRÓ"} y el clic fuera ${sigueFuera ? "tampoco" : "LA CERRÓ"}; Tab adentro: ${fuera.map(x => x ? "sí" : "NO").join(",")}`);
});
await caso("ent-06-guardar-una-vez", "cambio=lento", async p => {
  await abrir(p, "COSQUIM");
  await p.locator("input[type=date]").fill("2026-10-20");
  await dialogo(p).locator("input:not([type=date])").first().fill("Falta el papel");
  await dialogo(p).getByRole("button", { name: /Guardar/ }).dblclick().catch(() => {});
  await espera(p, 1900);
  const cambios = await lineas(p, "cambio");
  ok("ent-06-guardar-una-vez", cambios.length === 1 && /o3 2026-10-20 · Falta el papel/.test(cambios[0] || ""), `doble clic en guardar: ${cambios.length} cambios (${cambios.join(" | ")})`);
});
await caso("ent-07-se-lee", "", async p => {
  const m = await p.evaluate(() => {
    const f = [...document.querySelectorAll("[data-entrega]")];
    const tam = f.map(e => { const t = e.querySelector("[data-entrega-cliente]") || e.firstElementChild || e; return parseFloat(getComputedStyle(t).fontSize); });
    const ent = f.filter(e => /MAFER/.test(e.textContent)).map(e => ({ op: getComputedStyle(e).opacity, color: getComputedStyle(e.querySelector("div") || e).color }));
    return { minimo: Math.min(...tam), entregada: ent[0] || null };
  });
  ok("ent-07-se-lee", m.minimo >= 11 && m.entregada && Number(m.entregada.op) === 1,
    `la letra más chica del cliente en una ficha: ${m.minimo} px (11 o más); la entregada: opacidad ${m.entregada?.op}, color ${m.entregada?.color}`);
});
await caso("ent-08-la-misma-fecha-lo-dice", "", async p => {
  await abrir(p, "COSQUIM");
  await dialogo(p).locator("input:not([type=date])").first().fill("No cambia");
  const boton = dialogo(p).getByRole("button", { name: /Guardar/ });
  const apagado = await boton.isDisabled();
  if (!apagado) await boton.click();
  await espera(p);
  const dice = (await dialogo(p).innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("ent-08-la-misma-fecha-lo-dice", (apagado || (await dialogo(p).count()) === 1) && /misma fecha|elige otra fecha|ya es/i.test(dice) && (await lineas(p, "cambio")).length === 0,
    `con la misma fecha: guardar ${apagado ? "apagado" : "prendido"}; la ventana dice «${dice.slice(0, 160)}»`);
});
await caso("ent-09-el-vendedor-no-cambia-las-de-otro", "rol=vendedor", async p => {
  const ajena = await ficha(p, "DE MANUEL"), propia = await ficha(p, "DE GENARO");
  const rolAjena = await ajena.evaluate(e => ({ rol: e.getAttribute("role"), tag: e.tagName, dis: e.getAttribute("aria-disabled"), titulo: e.getAttribute("title") || "" }));
  // (al escribirla: Playwright no le da clic a un aria-disabled; una persona sí: el clic va forzado)
  await ajena.click({ force: true }); await espera(p);
  const abrioAjena = await dialogo(p).count();
  await propia.click(); await espera(p);
  const abrioPropia = await dialogo(p).count();
  ok("ent-09-el-vendedor-no-cambia-las-de-otro", abrioAjena === 0 && abrioPropia === 1 && /quien la capturó|sólo|solo/i.test(rolAjena.titulo + " " + (await ajena.innerText())),
    `Genaro: la de Manuel ${abrioAjena ? "ABRE la ventana" : "no abre"} (${JSON.stringify(rolAjena)}); la suya ${abrioPropia ? "abre" : "NO abre"}`);
});
await caso("ent-10-1366-y-el-nombre-largo", "", async p => {
  const m = await p.evaluate(() => {
    const largo = [...document.querySelectorAll("[data-entrega]")].find(e => /INSTITUTO/.test(e.textContent));
    const t = largo?.querySelector("[data-entrega-cliente]") || largo?.firstElementChild;
    return { scroll: document.documentElement.scrollWidth - innerWidth, completo: t ? (t.scrollWidth <= t.clientWidth + 1 || /GUANAJUATO/.test(t.getAttribute("title") || largo.getAttribute("aria-label") || "")) : false };
  });
  ok("ent-10-1366-y-el-nombre-largo", m.scroll <= 0 && m.completo, `scroll horizontal ${m.scroll}; el nombre largo ${m.completo ? "se puede leer completo (cabe o en su título)" : "se corta sin forma de leerlo"}`);
});
await caso("ent-11-urgente-y-retrasada-no-son-lo-mismo", "", async p => {
  const urg = (await (await ficha(p, "URGENTE A TIEMPO")).innerText()).replace(/\s+/g, " ");
  const tarde = (await (await ficha(p, "PREMIUM RESTAURANT")).innerText()).replace(/\s+/g, " ");
  ok("ent-11-urgente-y-retrasada-no-son-lo-mismo", /urgente/i.test(urg) && /retrasada|atrasada|tarde/i.test(tarde) && !/retrasada|atrasada/i.test(urg),
    `la urgente a tiempo dice «${urg.slice(0, 80)}»; la retrasada «${tarde.slice(0, 80)}» (cada una con su palabra, no sólo el rojo)`);
});
await caso("ent-12-el-dia-lleno", "lleno=1", async p => {
  const m = await p.evaluate(() => { const d = [...document.querySelectorAll("[data-entrega]")].filter(e => /MUCHAS/.test(e.textContent)); return { n: d.length, scroll: document.documentElement.scrollWidth - innerWidth }; });
  ok("ent-12-el-dia-lleno", m.n === 8 && m.scroll <= 0, `el jueves con 10 órdenes: ${m.n} de «MUCHAS» a la vista, scroll horizontal ${m.scroll}`);
});

// ══════════ vuelta 2: por donde no se diseñó ══════════
await caso("ent-13-la-mueven-con-la-ventana-abierta", "", async p => {
  await abrir(p, "COSQUIM");
  await p.evaluate(() => window.__mover("o3", "2026-10-17"));
  await espera(p);
  const dice = (await dialogo(p).innerText()).replace(/\s+/g, " ");
  // (al escribirla buscaba «17 oct»: la app escribe «17-oct»)
  ok("ent-13-la-mueven-con-la-ventana-abierta", /17[- ]oct/i.test(dice), `otra persona la movió al 17 con la ventana abierta: la ventana dice «${dice.slice(0, 160)}»`);
});
await caso("ent-14-el-mes-tambien", "", async p => {
  await p.getByRole("button", { name: "Mes" }).click(); await espera(p);
  const botones = await p.$$eval("[data-entrega]", es => es.filter(e => e.tagName === "BUTTON").length);
  const hoy = await p.locator("[aria-current=date]").count();
  await (await ficha(p, "COSQUIM")).click(); await espera(p);
  ok("ent-14-el-mes-tambien", botones >= 6 && hoy === 1 && (await dialogo(p).count()) === 1, `en el mes: ${botones} fichas que son botones, hoy marcado ${hoy}, la ventana ${await dialogo(p).count() ? "abre" : "NO abre"}`);
});
await caso("ent-15-enter-guarda", "", async p => {
  await abrir(p, "COSQUIM");
  await p.locator("input[type=date]").fill("2026-10-22");
  await dialogo(p).locator("input:not([type=date])").first().fill("El cliente pidió");
  await p.keyboard.press("Enter"); await espera(p, 500);
  const cambios = await lineas(p, "cambio");
  ok("ent-15-enter-guarda", cambios.length === 1 && (await dialogo(p).count()) === 0, `Enter en el motivo: ${cambios.length} cambio (${cambios.join(" | ")}); la ventana ${await dialogo(p).count() ? "SIGUE" : "se cerró"}`);
});
await caso("ent-16-otra-semana-y-entre-meses", "", async p => {
  await p.getByRole("button", { name: "Semana siguiente" }).click(); await espera(p);
  const sig = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  for (let i = 0; i < 3; i++) await p.getByRole("button", { name: "Semana anterior" }).click();
  await espera(p);
  const atras = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  ok("ent-16-otra-semana-y-entre-meses", /19 al 25 de octubre/i.test(sig) && /LA DE LA OTRA SEMANA/.test(sig) && /28 de septiembre al 4 de octubre/i.test(atras),
    `la siguiente: ${/19 al 25 de octubre/i.test(sig) ? "«del 19 al 25 de octubre»" : "SIN el rango"} ${/LA DE LA OTRA SEMANA/.test(sig) ? "con su orden" : "SIN su orden"}; dos atrás: ${(/Semana del [^·]*?octubre/i.exec(atras) || [""])[0].slice(0, 60)}`);
});
await caso("ent-17-1920", "", async p => {
  const m = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth - innerWidth, min: Math.min(...[...document.querySelectorAll("[data-entrega-cliente]")].map(e => parseFloat(getComputedStyle(e).fontSize))) }));
  ok("ent-17-1920", m.scroll <= 0 && m.min >= 11, `a 1920: scroll ${m.scroll}, letra del cliente ${m.min} px`);
}, { viewport: { width: 1920, height: 1080 } });
await caso("ent-18-sin-fecha-no-guarda", "", async p => {
  await abrir(p, "COSQUIM");
  await p.locator("input[type=date]").fill("");
  await dialogo(p).locator("input:not([type=date])").first().fill("Algo");
  await dialogo(p).getByRole("button", { name: /Guardar/ }).click(); await espera(p);
  const err = await dialogo(p).locator("[role=alert]").innerText().catch(() => "");
  ok("ent-18-sin-fecha-no-guarda", /Elige la nueva fecha/.test(err) && (await lineas(p, "cambio")).length === 0, `sin fecha: «${err}»; cambios ${(await lineas(p, "cambio")).length}`);
});
await caso("ent-19-el-vendedor-con-el-teclado", "rol=vendedor", async p => {
  const ajena = await ficha(p, "DE MANUEL");
  await ajena.focus(); await p.keyboard.press("Enter"); await espera(p);
  const abrioAjena = await dialogo(p).count();
  const propia = await ficha(p, "DE GENARO");
  await propia.focus(); await p.keyboard.press("Enter"); await espera(p);
  ok("ent-19-el-vendedor-con-el-teclado", abrioAjena === 0 && (await dialogo(p).count()) === 1 && (await ajena.getAttribute("aria-disabled")) === "true",
    `Genaro con el teclado: Enter en la de Manuel ${abrioAjena ? "ABRE" : "no abre"} (aria-disabled ${await ajena.getAttribute("aria-disabled")}); en la suya ${await dialogo(p).count() ? "abre" : "NO abre"}`);
});

// ── vuelta 3 (v10.84.140): la orden LISTA que espera a que el cliente pida su factura no es «Retrasada» (Marcelo, 16-oct: «aparece roja en el
//   calendario»); la de Salidas sin esa espera sí ──
const fichaTexto = async (p, cliente) => ((await (await ficha(p, cliente)).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
const fichaAria = async (p, cliente) => (await (await ficha(p, cliente)).getAttribute("aria-label").catch(() => "")) || "";
const fichaBorde = async (p, cliente) => (await ficha(p, cliente)).evaluate(e => getComputedStyle(e).borderTopStyle + " " + getComputedStyle(e).borderTopColor).catch(() => "");
for (const [n, cliente, que] of [["ent-20", "KFC ESPERA FACTURA", "en Salidas, lista a tiempo"], ["ent-21", "MAQUILA ESPERA FACTURA", "recibida de maquila, lista un día tarde"]]) {
  await caso(`${n}-la-que-espera-al-cliente-no-es-retrasada`, "espera=1", async p => {
    const t = await fichaTexto(p, cliente), aria = await fichaAria(p, cliente), borde = await fichaBorde(p, cliente);
    ok(`${n}-la-que-espera-al-cliente-no-es-retrasada`, !!t && !/Retrasada/.test(t) && /Espera al cliente/.test(t) && !/retrasada/i.test(aria) && /no ha pedido su factura/.test(aria) && !/185, 28, 28|255, 59, 48|224, 59, 48/.test(borde),
      `${cliente} (${que}, vencía el lunes 12, «En espera: el cliente no ha pedido factura»): «${t.slice(0, 90)}»; para el lector de pantalla «${aria.slice(0, 120)}»; borde ${borde}`);
  });
}
await caso("ent-22-la-de-salidas-sin-la-espera-sigue-retrasada", "espera=1", async p => {
  const t = await fichaTexto(p, "PREMIUM RESTAURANT BRANDS");
  ok("ent-22-la-de-salidas-sin-la-espera-sigue-retrasada", /Retrasada 2 d/.test(t) && !/Espera al cliente/.test(t), `en Salidas sin la espera (falta foliar y entregar): «${t.slice(0, 90)}»`);
});
await caso("ent-23-la-leyenda-dice-la-espera", "espera=1", async p => {
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  ok("ent-23-la-leyenda-dice-la-espera", /Retrasada/.test(t) && /Espera al cliente/.test(t) && /Entregada/.test(t), `la leyenda: ${/Espera al cliente/.test(t) ? "explica «Espera al cliente»" : "NO dice qué es «Espera al cliente»"}`);
});

// ── vuelta 4 (v10.84.149; Marcelo, 17-oct: «sí, cuentan como a tiempo»): la que quedó LISTA a tiempo no es «Retrasada» aunque no tenga la pausa (el
//   reporte ya la cuenta a tiempo); la que llegó a Salidas después de su fecha, sí. Escritas antes del arreglo ──
await caso("ent-24-la-lista-a-tiempo-sin-pausa-no-es-retrasada", "lista=1", async p => {
  const t = await fichaTexto(p, "LISTA A TIEMPO SIN PAUSA"), aria = await fichaAria(p, "LISTA A TIEMPO SIN PAUSA"), borde = await fichaBorde(p, "LISTA A TIEMPO SIN PAUSA");
  ok("ent-24-la-lista-a-tiempo-sin-pausa-no-es-retrasada", !!t && !/Retrasada/.test(t) && /Lista a tiempo/.test(t) && !/retrasada/i.test(aria) && /lista a tiempo/i.test(aria) && !/185, 28, 28|255, 59, 48|224, 59, 48/.test(borde),
    `en Salidas desde el domingo 11, vencía el lunes 12, sin la pausa: «${t.slice(0, 90)}»; para el lector de pantalla «${aria.slice(0, 140)}»; borde ${borde}`);
});
await caso("ent-25-la-lista-tarde-sin-pausa-sigue-retrasada", "lista=1", async p => {
  const t = await fichaTexto(p, "LISTA TARDE SIN PAUSA");
  ok("ent-25-la-lista-tarde-sin-pausa-sigue-retrasada", /Retrasada 2 d/.test(t) && !/Lista a tiempo/.test(t), `llegó a Salidas el martes 13, vencía el lunes 12: «${t.slice(0, 90)}»`);
});
// vuelta 2: el otro modo de la pantalla (el mes)
await caso("ent-26-en-el-mes-tambien", "lista=1", async p => {
  await p.getByRole("button", { name: "Mes" }).click(); await espera(p);
  const a = await fichaTexto(p, "LISTA A TIEMPO SIN PAUSA"), b = await fichaTexto(p, "LISTA TARDE SIN PAUSA");
  ok("ent-26-en-el-mes-tambien", !!a && !/Retrasada/.test(a) && /Lista a tiempo/.test(a) && /Retrasada/.test(b), `en el mes: la lista a tiempo «${a.slice(0, 80)}»; la lista tarde «${b.slice(0, 80)}»`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nentregas: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
