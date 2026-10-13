// Tratar de ROMPER Analytics en su banco (gen-analytics.mjs): que cada cifra diga qué cuenta y de qué periodo, con UNA definición de
// ingreso (lo ENTREGADO, por su fecha de entrega en hora de México; la maquila por su precio de maquila), que compare periodos del mismo
// largo y que la tendencia dibuje (v10.84.84, los P1 de la critique de Analytics, 14/40).
// El reloj del navegador va fijo en el 13-oct-2026 12:00 de México, con la zona horaria de México: las cuentas de abajo salen a mano
// de las órdenes del banco. Cada caso afirma lo que DEBERÍA pasar: una FALLA es un bug. Un confirm()/alert() nativo es FALLA.
// Uso: node analytics.mjs <dir-capturas> [puerto=5191]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5191);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
const AHORA = new Date("2026-10-13T12:00:00-06:00");
const $ = n => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, { viewport = { width: 1366, height: 900 }, ahora = AHORA } = {}) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const ctx = await browser.newContext({ viewport, timezoneId: "America/Mexico_City", locale: "es-MX" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.clock.setFixedTime(ahora);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.getByText("Financiero").first().waitFor();
    await page.waitForTimeout(300);
    await fn(page);
    const nativos = ((await page.textContent("#log").catch(() => "")) || "").split("\n").filter(l => /^(confirm|alert):/.test(l));
    if (nativos.length) ok(nombre + " · diálogo nativo", false, nativos.join(" ; ").slice(0, 200));
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png", fullPage: true }).catch(() => {});
  await ctx.close();
}
const espera = (p, ms = 250) => p.waitForTimeout(ms);
// una pestaña (role=tab) o, en el código de antes, el botón con ese nombre
const pestaña = async (p, nombre) => { await p.getByRole("tab", { name: nombre }).or(p.getByRole("button", { name: nombre, exact: true })).first().click(); await espera(p); };
const periodo = async (p, nombre) => { await p.getByRole("radio", { name: nombre, exact: true }).click(); await espera(p); };
const cifra = async (p, id) => (await p.locator(`[data-cifra="${id}"]`).first().innerText({ timeout: 2000 })).replace(/\s+/g, " ");
const cuerpo = async p => (await p.locator("body").innerText()).replace(/\s+/g, " ");

// ── vuelta 1: escritas ANTES del cambio, contra v10.84.83 ──
await caso("an-01-periodo-a-la-vista", "", async p => {
  const marcado = await p.getByRole("radio", { name: "Este mes", exact: true }).getAttribute("aria-checked");
  const rango = (await p.locator("[data-rango]").first().innerText()).trim();
  ok("an-01-periodo-a-la-vista", marcado === "true" && rango === "1-13 oct", `«Este mes» marcado: ${marcado}; el rango dice «${rango}» (debe decir «1-13 oct»)`);
});
await caso("an-02-ingresos-son-lo-entregado-del-periodo", "", async p => {
  const t = await cifra(p, "ingresos"), i = await cifra(p, "interna"), m = await cifra(p, "maquila");
  ok("an-02-ingresos-son-lo-entregado-del-periodo", t.includes($(28000)) && /5 entregadas/.test(t) && i.includes($(20000)) && m.includes($(8000)) && m.includes($(3000)),
    `ingresos «${t}» (debe: ${$(28000)}, 5 entregadas); interna «${i}» (${$(20000)}); maquila «${m}» (${$(8000)}, ganancia ${$(3000)}). Ni la cancelada de ${$(50000)} ni la de producción de ${$(30000)}`);
});
await caso("an-03-compara-con-los-mismos-dias", "", async p => {
  const c = await cifra(p, "comparacion");
  ok("an-03-compara-con-los-mismos-dias", /1-13 sep/.test(c) && c.includes($(6000)) && /367\s?%/.test(c),
    `la comparación dice «${c}» (debe: contra 1-13 sep, ${$(6000)}, sube 367 %; antes comparaba 12 días contra un mes y lo CREADO)`);
});
await caso("an-04-mes-pasado-con-la-hora-de-mexico", "", async p => {
  await periodo(p, "Mes pasado");
  const t = await cifra(p, "ingresos"), rango = (await p.locator("[data-rango]").first().innerText()).trim(), c = await cifra(p, "comparacion");
  ok("an-04-mes-pasado-con-la-hora-de-mexico", t.includes($(30000)) && /3 entregadas/.test(t) && rango === "1-30 sep" && c.includes($(3000)) && /1-31 ago/.test(c),
    `septiembre: «${t}» (debe ${$(30000)} y 3 entregadas: P-0090 se entregó a las 19:00 del 30, en UTC ya era octubre); rango «${rango}»; comparación «${c}» (agosto, ${$(3000)})`);
});
await caso("an-05-la-tendencia-dibuja", "", async p => {
  const barras = await p.locator("[data-mes]").evaluateAll(bs => bs.map(b => ({ mes: b.getAttribute("data-mes"), monto: Number(b.getAttribute("data-monto")), alto: Math.round(b.getBoundingClientRect().height) })));
  const de = m => barras.find(b => b.mes === m) || {};
  const sep = de("2026-09"), oct = de("2026-10"), ago = de("2026-08");
  const bien = sep.monto === 30000 && oct.monto === 28000 && ago.monto === 3000 && sep.alto >= 80 && Math.abs(oct.alto / sep.alto - 28 / 30) < 0.06 && ago.alto < sep.alto * 0.2;
  ok("an-05-la-tendencia-dibuja", bien, `barras: ${JSON.stringify(barras)} (septiembre ${$(30000)} la más alta, ≥ 80 px; octubre al 93 % de ella; agosto chiquita)`);
});
// v10.84.91 — por CATEGORÍA (vuelta 1: escritas antes del cambio): las del periodo con su nombre de la lista (no lo escrito a mano), la
// venta de inventario aparte, sin canceladas ni en producción
await caso("an-06-productos-del-periodo-y-limpios", "", async p => {
  const filas = await p.locator("[data-producto]").evaluateAll(fs => fs.map(f => ({ t: f.getAttribute("data-producto"), monto: Number(f.getAttribute("data-monto")), n: Number(f.getAttribute("data-n")) })));
  const txt = (await p.locator("[data-productos]").first().innerText()).replace(/\s+/g, " ");
  const de = k => filas.find(f => f.t === k) || {};
  const bien = filas.length === 4 && de("etiquetas").monto === 15000 && de("etiquetas").n === 2 && de("libros").monto === 8000 && de("inventario").monto === 3000
    && de("folletos").monto === 2000 && /Ingreso por categoría/i.test(txt) && /Etiquetas y stickers/.test(txt) && /Libros, revistas y manuales/.test(txt)
    && /Venta de inventario/.test(txt) && /Folletos, trípticos y volantes/.test(txt) && !/stock|ATRASADA|FOLLETO AHORRO|ETIQUETAS\b/.test(txt)
    && !txt.includes($(50000)) && !txt.includes($(30000));
  ok("an-06-productos-del-periodo-y-limpios", bien, `filas ${JSON.stringify(filas)}; dice «${txt.slice(0, 260)}»`);
});
await caso("an-07-ocho-y-otros", "", async p => {
  await periodo(p, "Todo");
  const filas = await p.locator("[data-producto]").evaluateAll(fs => fs.map(f => ({ t: f.getAttribute("data-producto"), monto: Number(f.getAttribute("data-monto")), n: Number(f.getAttribute("data-n")) })));
  const de = k => filas.find(f => f.t === k) || {};
  // con «Todo»: etiquetas $29,000 (5), POP $20,000, libros $8,000, folletos $6,500 (3: Folletos, el atrasado y Volantes), inventario $3,000,
  //   y cinco de $500 (Calendarios, Libretas, Cajas → empaques, Gafetes → papelería, Sellos → otro): 10 renglones, sin «Otros»
  ok("an-07-ocho-y-otros", filas.length === 10 && !de("otros").t && filas[0].t === "etiquetas" && filas[0].monto === 29000 && de("folletos").monto === 6500 && de("folletos").n === 3
    && de("otro").monto === 500 && de("papeleria").monto === 500 && de("empaques").monto === 500,
    `con «Todo»: ${filas.length} renglones ${JSON.stringify(filas.map(f => f.t + ":" + f.monto))}`);
});
await caso("an-08-maquinas-con-su-base", "", async p => {
  await pestaña(p, "Máquinas");
  const pm52 = (await p.locator('[data-maquina="off_pm52"]').innerText()).replace(/\s+/g, " ");
  const base = await cifra(p, "utilizacion"), emp = await cifra(p, "empaque");
  const tarjetaEmpaque = await p.locator('[data-maquina="vm_manual"]').count();
  ok("an-08-maquinas-con-su-base", /\b2\s?%/.test(pm52) && /9 días hábiles/.test(base) && /10h/.test(emp) && tarjetaEmpaque === 0,
    `Printmaster 52: «${pm52.slice(0, 120)}» (debe 2 %: 2 h de 81); utilización «${base}» (con «9 días hábiles»); Empaque «${emp}» (10 h de espera, fuera de la utilización); tarjetas de Empaque: ${tarjetaEmpaque}`);
});
await caso("an-09-a-tiempo-con-su-base", "", async p => {
  await pestaña(p, "Eficiencia");
  const t = await cifra(p, "atiempo");
  ok("an-09-a-tiempo-con-su-base", /67\s?%/.test(t) && /2 de 3/.test(t) && /2 sin fecha/.test(t),
    `a tiempo «${t}» (debe: 67 %, 2 de 3 con fecha compromiso, 2 sin fecha)`);
});
await caso("an-10-merma-sin-registros", "", async p => {
  await pestaña(p, "Eficiencia");
  const pl = await cifra(p, "merma-pliegos");
  const color = await p.locator('[data-cifra="merma-pliegos"]').first().evaluate(el => getComputedStyle(el.querySelector("[data-valor]") || el).color);
  ok("an-10-merma-sin-registros", /sin registros/i.test(pl) && !/\b0\b/.test(pl.replace(/sin registros/i, "")),
    `merma de pliegos «${pl}» (color ${color}): sin un solo registro no es «0» en ámbar, es «sin registros»`);
});
await caso("an-11-clientes-del-periodo", "", async p => {
  await pestaña(p, "Clientes");
  const filas = await p.locator("[data-cliente]").evaluateAll(fs => fs.map(f => ({ c: f.getAttribute("data-cliente"), monto: Number(f.getAttribute("data-monto")) })));
  ok("an-11-clientes-del-periodo", filas.length === 4 && filas[0].c === "CERVECERIA MODELO" && filas[0].monto === 15000 && !filas.some(f => /Cervecería Modelo/.test(f.c)),
    `clientes del mes: ${JSON.stringify(filas)} (CERVECERIA MODELO ${$(15000)} junta sus dos escrituras; sin la cancelada de ${$(50000)})`);
});
await caso("an-12-el-periodo-vale-en-todas", "", async p => {
  await periodo(p, "Mes pasado"); await pestaña(p, "Clientes");
  const marcado = await p.getByRole("radio", { name: "Mes pasado", exact: true }).getAttribute("aria-checked");
  const primero = await p.locator("[data-cliente]").first().evaluate(f => ({ c: f.getAttribute("data-cliente"), monto: Number(f.getAttribute("data-monto")) }));
  ok("an-12-el-periodo-vale-en-todas", marcado === "true" && primero.c === "FARMACIAS" && primero.monto === 20000,
    `con «Mes pasado» en Clientes: marcado ${marcado}; el primero ${JSON.stringify(primero)} (FARMACIAS, ${$(20000)})`);
});
await caso("an-13-teclado-pestanas-y-periodo", "", async p => {
  const tabs = await p.getByRole("tab").count(), sel = await p.getByRole("tab", { selected: true }).count();
  const r = p.getByRole("radio", { name: "Últimos 90 días", exact: true });
  await r.focus(); await p.keyboard.press("Enter"); await espera(p);
  const marcado = await r.getAttribute("aria-checked");
  ok("an-13-teclado-pestanas-y-periodo", tabs === 5 && sel === 1 && marcado === "true", `pestañas con role=tab: ${tabs} (seleccionada ${sel}); «Últimos 90 días» con Enter: ${marcado}`);
});
await caso("an-14-todo-dice-desde-cuando", "", async p => {
  await periodo(p, "Todo");
  const rango = (await p.locator("[data-rango]").first().innerText()).trim(), comp = await p.locator('[data-cifra="comparacion"]').count();
  const t = await cifra(p, "ingresos");
  ok("an-14-todo-dice-desde-cuando", rango === "desde 20 may 2026" && comp === 0 && t.includes($(69000)),
    `con «Todo»: rango «${rango}» (desde la primera entrega), ingresos «${t}» (${$(69000)}), comparación: ${comp ? "SÍ hay" : "no hay"}`);
});
await caso("an-15-este-anio-sin-anio-anterior", "", async p => {
  await periodo(p, "Este año");
  const c = await cifra(p, "comparacion");
  ok("an-15-este-anio-sin-anio-anterior", /sin entregas/i.test(c) && /2025/.test(c) && !/%/.test(c), `«Este año» compara: «${c}» (en 2025 no hubo entregas en PrintFlow: sin porcentaje)`);
});
await caso("an-16-ticket-con-su-base", "", async p => {
  const t = await cifra(p, "ticket");
  ok("an-16-ticket-con-su-base", t.includes($(5600)) && /por orden entregada/.test(t), `ticket «${t}» (debe ${$(5600)}: ${$(28000)} entre 5)`);
});
await caso("an-17-1920-sin-desbordarse", "", async p => {
  const r = await p.evaluate(() => ({ ancho: document.documentElement.scrollWidth, vista: innerWidth }));
  const fila = p.locator("[data-producto]").first();
  const dist = await fila.evaluate(f => { const n = f.querySelector("[data-nombre]"), m = f.querySelector("[data-monto-txt]"); return n && m ? Math.round(m.getBoundingClientRect().left - n.getBoundingClientRect().left) : null; });
  ok("an-17-1920-sin-desbordarse", r.ancho <= r.vista && dist !== null && dist < 800, `a 1920: ancho ${r.ancho} de ${r.vista}; del nombre al monto ${dist} px (antes 1,331)`);
}, { viewport: { width: 1920, height: 1080 } });

// ── v10.84.84 — vuelta 2: por donde no se diseñó ──
const raro = t => /NaN|Infinity|undefined|null/.test(t);
await caso("an-v2-01-sin-ordenes", "modo=vacio", async p => {
  const textos = [];
  for (const t of ["Financiero", "Máquinas", "Eficiencia", "Clientes"]) { await pestaña(p, t); textos.push(await cuerpo(p)); }
  await pestaña(p, "Financiero"); await periodo(p, "Todo");
  const rango = (await p.locator("[data-rango]").first().innerText()).trim(), ing = await cifra(p, "ingresos");
  ok("an-v2-01-sin-ordenes", !textos.some(raro) && rango === "sin entregas todavía" && ing.includes($(0)),
    `sin órdenes: ${textos.some(raro) ? "SALE NaN/Infinity/undefined en «" + textos.find(raro).match(/.{0,40}(NaN|Infinity|undefined|null).{0,40}/)[0] + "»" : "nada raro"}; con «Todo» el rango dice «${rango}», ingresos «${ing}»`);
});
await caso("an-v2-02-sin-maquinas", "modo=sinmaquinas", async p => {
  await pestaña(p, "Máquinas");
  const t = await cuerpo(p), u = await cifra(p, "utilizacion");
  ok("an-v2-02-sin-maquinas", /Sin tiempos de máquina en el periodo/.test(t) && /sin registros de máquina/.test(u) && !raro(t),
    `sin registros de máquina: utilización «${u}»; ${/Sin tiempos de máquina/.test(t) ? "dice que no hay tiempos" : "NO dice que no hay tiempos"}`);
});
await caso("an-v2-03-fin-de-mes", "", async p => {
  const rango = (await p.locator("[data-rango]").first().innerText()).trim(), c = await cifra(p, "comparacion");
  ok("an-v2-03-fin-de-mes", rango === "1-31 oct" && /1-30 sep/.test(c), `el 31-oct a las 23:30: rango «${rango}», compara «${c}» (septiembre tiene 30)`);
}, { ahora: new Date("2026-10-31T23:30:00-06:00") });
await caso("an-v2-04-primero-de-mes", "", async p => {
  const rango = (await p.locator("[data-rango]").first().innerText()).trim(), c = await cifra(p, "comparacion");
  ok("an-v2-04-primero-de-mes", rango === "1 nov" && /\b1 oct\b/.test(c) && !/1-1 /.test(rango + c), `el 1-nov a las 00:30: rango «${rango}», compara «${c}» (un solo día se escribe «1 nov», no «1-1 nov»)`);
}, { ahora: new Date("2026-11-01T00:30:00-06:00") });
await caso("an-v2-05-marzo-contra-febrero", "", async p => {
  const c = await cifra(p, "comparacion");
  ok("an-v2-05-marzo-contra-febrero", /1-28 feb/.test(c), `el 31-mar-2027 compara «${c}» (febrero de 2027 tiene 28)`);
}, { ahora: new Date("2027-03-31T12:00:00-06:00") });
await caso("an-v2-06-flechas-en-el-periodo", "", async p => {
  const radio = n => p.getByRole("radio", { name: n, exact: true });
  const paradas = await p.locator('[role="radio"]').evaluateAll(rs => rs.filter(r => r.tabIndex === 0).length);
  await radio("Este mes").focus(); await p.keyboard.press("ArrowRight"); await espera(p, 150);
  const a = await radio("Mes pasado").evaluate(r => r.getAttribute("aria-checked") === "true" && document.activeElement === r);
  await p.keyboard.press("End"); await espera(p, 150);
  const b = await radio("Todo").evaluate(r => r.getAttribute("aria-checked") === "true" && document.activeElement === r);
  await p.keyboard.press("Home"); await espera(p, 150);
  const c = await radio("Este mes").getAttribute("aria-checked");
  ok("an-v2-06-flechas-en-el-periodo", paradas === 1 && a && b && c === "true", `paradas de Tab en el periodo: ${paradas} (debe 1); → lleva a «Mes pasado» ${a}; Fin a «Todo» ${b}; Inicio a «Este mes» ${c}`);
});
await caso("an-v2-07-detalle-y-cambio-de-periodo", "", async p => {
  await pestaña(p, "Máquinas");
  await p.locator('[data-maquina="off_pm74"]').click(); await espera(p);
  const enDetalle = await p.getByRole("button", { name: /Volver a todas/ }).count();
  await periodo(p, "Mes pasado");
  const t = await cuerpo(p);
  const vacio = !/Sin tiempos de máquina|Elige una máquina|Volver a todas/.test(t);
  ok("an-v2-07-detalle-y-cambio-de-periodo", enDetalle === 1 && !vacio, `en el detalle de Printmaster 74 (${enDetalle ? "abierto" : "NO abrió"}) y cambiar a «Mes pasado», donde no trabajó: ${vacio ? "la pestaña queda EN BLANCO" : "dice algo"} («${t.slice(t.indexOf("Mes pasado"), t.indexOf("Mes pasado") + 160)}»)`);
});
await caso("an-v2-08-la-comparacion-dice-contra-que", "", async p => {
  const mes = await cifra(p, "comparacion");
  await periodo(p, "Mes pasado"); const pasado = await cifra(p, "comparacion");
  await periodo(p, "Últimos 90 días"); const noventa = await cifra(p, "comparacion");
  ok("an-v2-08-la-comparacion-dice-contra-que", /mismos días/.test(mes) && /mes anterior/.test(pasado) && !/mismos días/.test(pasado) && /90 días anteriores/.test(noventa),
    `«Este mes»: «${mes}»; «Mes pasado»: «${pasado}» (sep tiene 30 y ago 31: no son «los mismos días»); «90 días»: «${noventa}»`);
});
await caso("an-v2-09-doble-clic-en-el-periodo", "", async p => {
  await p.getByRole("radio", { name: "Todo", exact: true }).dblclick(); await espera(p);
  const marcado = await p.getByRole("radio", { name: "Todo", exact: true }).getAttribute("aria-checked"), ing = await cifra(p, "ingresos");
  ok("an-v2-09-doble-clic-en-el-periodo", marcado === "true" && ing.includes($(69000)), `doble clic en «Todo»: marcado ${marcado}; ingresos «${ing}»`);
});
await caso("an-v2-10-1366", "", async p => {
  const anchos = [];
  for (const t of ["Financiero", "Máquinas", "Eficiencia", "Clientes", "Archivos"]) { await pestaña(p, t); anchos.push(t + " " + await p.evaluate(() => document.documentElement.scrollWidth)); }
  ok("an-v2-10-1366", anchos.every(x => Number(x.split(" ").pop()) <= 1366), `a 1366, el ancho de cada pestaña: ${anchos.join(", ")}`);
});
await caso("an-v2-11-la-entrega-de-anoche", "", async p => {
  const hoyIng = await cifra(p, "ingresos");
  await periodo(p, "Mes pasado"); const sep = await cifra(p, "ingresos");
  ok("an-v2-11-la-entrega-de-anoche", hoyIng.includes($(0)) && sep.includes($(30000)) && /3 entregadas/.test(sep),
    `el 1-oct a las 09:00: «Este mes» «${hoyIng}» (la de las 19:00 del 30 es de septiembre); «Mes pasado» «${sep}»`);
}, { ahora: new Date("2026-10-01T09:00:00-06:00") });
await caso("an-v2-12-noventa-dias", "", async p => {
  await periodo(p, "Últimos 90 días");
  const rango = (await p.locator("[data-rango]").first().innerText()).trim(), ing = await cifra(p, "ingresos"), c = await cifra(p, "comparacion");
  ok("an-v2-12-noventa-dias", rango === "16 jul-13 oct" && ing.includes($(61000)) && /17 abr-15 jul/.test(c) && c.includes($(8000)) && /663\s?%/.test(c),
    `90 días: rango «${rango}», ingresos «${ing}» (${$(61000)}), comparación «${c}» (17 abr-15 jul, ${$(8000)}, sube 663 %)`);
});

// ── v10.84.84 — vuelta 3: sobre los arreglos de la vuelta 2 y lo que faltaba ──
await caso("an-v3-01-detalle-entre-periodos", "", async p => {
  await pestaña(p, "Máquinas");
  await p.locator('[data-maquina="off_pm52"]').click(); await espera(p);
  await periodo(p, "Todo"); const todo = await cuerpo(p);
  await periodo(p, "Mes pasado"); const sep = await cuerpo(p);
  await periodo(p, "Este mes"); const oct = await cuerpo(p);
  const bien = /Volver a todas/.test(todo) && /7\.0 h/.test(todo) && /Printmaster 52 no tiene tiempos en este periodo/.test(sep) && !/Volver a todas/.test(sep) && /Volver a todas/.test(oct) && /2\.0 h/.test(oct);
  ok("an-v3-01-detalle-entre-periodos", bien, `Printmaster 52 abierto: con «Todo» ${/7\.0 h/.test(todo) ? "7.0 h" : "NO 7.0 h"}; en septiembre (no trabajó) ${/no tiene tiempos/.test(sep) ? "lo dice" : "NO lo dice"}; de vuelta en octubre ${/2\.0 h/.test(oct) ? "su detalle, 2.0 h" : "SIN su detalle"}`);
});
await caso("an-v3-02-archivos-sin-periodo", "", async p => {
  await periodo(p, "Mes pasado"); await pestaña(p, "Archivos");
  const enArchivos = await p.getByRole("radiogroup").count();
  await pestaña(p, "Financiero");
  const marcado = await p.getByRole("radio", { name: "Mes pasado", exact: true }).getAttribute("aria-checked");
  ok("an-v3-02-archivos-sin-periodo", enArchivos === 0 && marcado === "true", `en Archivos ${enArchivos ? "SALE" : "no sale"} el periodo; al volver sigue «Mes pasado»: ${marcado}`);
});
await caso("an-v3-03-anio-nuevo", "", async p => {
  const rMes = (await p.locator("[data-rango]").first().innerText()).trim(), cMes = await cifra(p, "comparacion");
  await periodo(p, "Este año");
  const rAnio = (await p.locator("[data-rango]").first().innerText()).trim(), cAnio = await cifra(p, "comparacion");
  ok("an-v3-03-anio-nuevo", rMes === "1 ene" && /\b1 dic\b/.test(cMes) && rAnio === "1 ene" && /1 ene 2026/.test(cAnio),
    `el 1-ene-2027 a las 08:00: «Este mes» «${rMes}» contra «${cMes}»; «Este año» «${rAnio}» contra «${cAnio}»`);
}, { ahora: new Date("2027-01-01T08:00:00-06:00") });
await caso("an-v3-04-llega-una-entrega", "", async p => {
  await p.evaluate(() => window.__agregarEntrega()); await espera(p, 300);
  const ing = await cifra(p, "ingresos");
  const et = await p.locator('[data-producto="etiquetas"]').evaluate(f => Number(f.getAttribute("data-monto")));
  ok("an-v3-04-llega-una-entrega", ing.includes($(29000)) && /6 entregadas/.test(ing) && et === 16000, `con la pantalla abierta llega una entrega de hoy: ingresos «${ing}» (${$(29000)}, 6), Etiquetas ${et} (16000)`);
});
await caso("an-v3-05-tipo-vacio", "modo=sintipo", async p => {
  const fila = await p.locator('[data-producto="sin"]').evaluate(f => ({ monto: Number(f.getAttribute("data-monto")), n: Number(f.getAttribute("data-n")) })).catch(() => null);
  const t = await cuerpo(p);
  ok("an-v3-05-tipo-vacio", !!fila && fila.monto === 1500 && fila.n === 1 && !/undefined|null/.test(t), `una entregada sin nombre (y sin categoría): ${fila ? "sale como «Sin clasificar» con " + fila.monto : "NO sale"}`);
});

// ── v10.84.85 — bajar de una barra a sus órdenes (el P2 de la critique: «nada lleva a sus órdenes»); escritas ANTES del cambio ──
const desplegado = async (p, sel) => (await p.locator(sel).locator("[data-ordenes]").first().innerText({ timeout: 1500 }).catch(() => "")).replace(/\s+/g, " ");
await caso("an-20-producto-abre-sus-ordenes", "", async p => {
  const fila = p.locator('[data-producto="etiquetas"]');
  const boton = fila.getByRole("button").first();
  await boton.click(); await espera(p);
  const abierto = await boton.getAttribute("aria-expanded"), t = await desplegado(p, '[data-producto="etiquetas"]');
  await boton.click(); await espera(p);
  const cerrado = await boton.getAttribute("aria-expanded"), t2 = await desplegado(p, '[data-producto="etiquetas"]');
  ok("an-20-producto-abre-sus-ordenes", abierto === "true" && /P-0101/.test(t) && /P-0102/.test(t) && t.includes($(10000)) && t.includes($(5000)) && cerrado === "false" && t2 === "",
    `«Etiquetas» al picarle: aria-expanded ${abierto}, enseña «${t.slice(0, 160)}» (P-0101 ${$(10000)} y P-0102 ${$(5000)}); otra vez: ${cerrado}, ${t2 ? "SIGUE abierta" : "se cierra"}`);
});
await caso("an-21-otros-abre-sus-tipos", "", async p => {
  await periodo(p, "Todo");
  const boton = p.locator('[data-producto="otro"]').getByRole("button").first();
  await boton.click(); await espera(p);
  const t = await desplegado(p, '[data-producto="otro"]');
  ok("an-21-otros-abre-sus-tipos", /P-0085/.test(t) && /Sellos/.test(t) && t.includes($(500)), `«Otro» enseña «${t.slice(0, 160)}» (P-0085, Sellos, ${$(500)}: con el nombre de cada trabajo)`);
});
await caso("an-22-cliente-abre-sus-ordenes", "", async p => {
  await pestaña(p, "Clientes");
  const boton = p.locator('[data-cliente="CERVECERIA MODELO"]').getByRole("button").first();
  await boton.press("Enter"); await espera(p);
  const t = await desplegado(p, '[data-cliente="CERVECERIA MODELO"]');
  ok("an-22-cliente-abre-sus-ordenes", /P-0101/.test(t) && /P-0102/.test(t) && !/P-0110/.test(t) && /Etiquetas/i.test(t),
    `CERVECERIA MODELO con Enter enseña «${t.slice(0, 170)}» (sus dos entregadas de octubre, con su tipo; sin la cancelada P-0110)`);
});
await caso("an-23-uno-abierto-a-la-vez", "", async p => {
  await p.locator('[data-producto="etiquetas"]').getByRole("button").first().click(); await espera(p);
  await p.locator('[data-producto="libros"]').getByRole("button").first().click(); await espera(p);
  const abiertos = await p.locator('[data-producto] [data-ordenes]').count();
  const libros = await desplegado(p, '[data-producto="libros"]');
  ok("an-23-uno-abierto-a-la-vez", abiertos === 1 && /P-0103/.test(libros) && /maquila/i.test(libros), `abiertos a la vez: ${abiertos}; «Libros» enseña «${libros.slice(0, 120)}» (P-0103, de maquila)`);
});
await caso("an-24-el-periodo-cambia-lo-abierto", "", async p => {
  await p.locator('[data-producto="etiquetas"]').getByRole("button").first().click(); await espera(p);
  await periodo(p, "Mes pasado");
  const t = await desplegado(p, '[data-producto="etiquetas"]');
  ok("an-24-el-periodo-cambia-lo-abierto", t === "" || (/P-0091/.test(t) && !/P-0101/.test(t)), `«Etiquetas» abierta y cambiar a septiembre: «${t.slice(0, 120)}» (o se cierra, o enseña las de septiembre: P-0091)`);
});

// ── v10.84.85 — vuelta 2 del despliegue: por donde no se diseñó ──
await caso("an-25-veinte-y-los-demas", "modo=muchas", async p => {
  await p.locator('[data-producto="etiquetas"]').getByRole("button").first().click(); await espera(p);
  const n = await p.locator('[data-producto="etiquetas"] [data-ordenes] > div').count();
  const t = await desplegado(p, '[data-producto="etiquetas"]');
  ok("an-25-veinte-y-los-demas", /y 7 más/.test(t) && n === 21, `«Etiquetas» con 27 entregadas: ${n} renglones (20 y «y 7 más»): «${t.slice(-60)}»`);
});
await caso("an-26-doble-clic-abre", "", async p => {
  const b = p.locator('[data-producto="etiquetas"]').getByRole("button").first();
  await b.dblclick(); await espera(p);
  ok("an-26-doble-clic-abre", (await b.getAttribute("aria-expanded")) === "true", `doble clic en «Etiquetas»: aria-expanded ${await b.getAttribute("aria-expanded")} (debe quedar abierta: el segundo clic no la cierra)`);
});
await caso("an-27-espacio-abre", "", async p => {
  const b = p.locator('[data-producto="libros"]').getByRole("button").first();
  await b.focus(); await p.keyboard.press("Space"); await espera(p);
  ok("an-27-espacio-abre", (await b.getAttribute("aria-expanded")) === "true", `Espacio en «Libros»: ${await b.getAttribute("aria-expanded")}`);
});
await caso("an-28-otros-que-desaparece", "", async p => {
  await periodo(p, "Todo");
  await p.locator('[data-producto="otro"]').getByRole("button").first().click(); await espera(p);
  await periodo(p, "Este mes");
  const abiertos = await p.locator("[data-ordenes]").count(), filas = await p.locator("[data-producto]").count();
  ok("an-28-otros-que-desaparece", abiertos === 0 && filas === 4, `«Otro» abierto y volver a octubre (sin «Otro»): ${abiertos} desplegados, ${filas} renglones`);
});
await caso("an-29-nombre-largo-a-1366", "modo=muchas", async p => {
  await pestaña(p, "Clientes");
  const fila = p.locator("[data-cliente]").filter({ hasText: "MUY PERO MUY LARGO" }).first();
  await fila.getByRole("button").first().click(); await espera(p);
  await pestaña(p, "Financiero");
  await p.locator('[data-producto="etiquetas"]').getByRole("button").first().click(); await espera(p);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  ok("an-29-nombre-largo-a-1366", ancho <= 1366, `a 1366 con un cliente de nombre larguísimo desplegado: ancho ${ancho}`);
});

// ── v10.84.86 — lo que encontró la revisión en producción: la venta de inventario sin P-… salía con su uuid ──
await caso("an-30-venta-sin-folio-se-nombra", "modo=stocksinfolio", async p => {
  await p.locator('[data-producto="inventario"]').getByRole("button").first().click(); await espera(p);
  const t = await desplegado(p, '[data-producto="inventario"]');
  ok("an-30-venta-sin-folio-se-nombra", /F-153/.test(t) && /OC-0948/.test(t) && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(t),
    `«Venta de inventario» desplegada: «${t.slice(0, 160)}» (la venta sin P-… se nombra por su folio fiscal y su OC, nunca por su uuid)`);
});

// ── v10.84.91 — por categoría, por donde no se diseñó ──
await caso("an-31-la-categoria-abre-con-sus-nombres", "", async p => {
  await p.locator('[data-producto="etiquetas"]').getByRole("button").first().click(); await espera(p);
  const t = await desplegado(p, '[data-producto="etiquetas"]');
  ok("an-31-la-categoria-abre-con-sus-nombres", /P-0101/.test(t) && /P-0102/.test(t) && /Etiquetas/.test(t) && /ETIQUETAS/.test(t) && /CERVECERIA MODELO/i.test(t),
    `«Etiquetas y stickers» desplegada: «${t.slice(0, 200)}» (cada orden con el nombre de su trabajo, así se ve qué cayó en la categoría, y su cliente)`);
});
await caso("an-32-sin-clasificar-y-el-inventario-al-final", "modo=sintipo", async p => {
  const filas = await p.locator("[data-producto]").evaluateAll(fs => fs.map(f => f.getAttribute("data-producto")));
  const txt = (await p.locator('[data-producto="sin"]').innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("an-32-sin-clasificar-y-el-inventario-al-final", filas.join(",") === "etiquetas,libros,folletos,inventario,sin" && /Sin clasificar/.test(txt) && txt.includes($(1500)),
    `renglones ${filas.join(",")} (las categorías por monto; luego la venta de inventario, que es un canal, y «Sin clasificar») · «${txt}»`);
});
await caso("an-33-la-barra-mas-larga-cabe", "modo=inventariogrande", async p => {
  const barras = await p.locator("[data-producto]").evaluateAll(fs => fs.map(f => { const b = f.querySelector("button > div:last-child > div"), caja = b && b.parentElement;
    return { k: f.getAttribute("data-producto"), pct: b && caja ? Math.round(b.getBoundingClientRect().width / caja.getBoundingClientRect().width * 100) : -1 }; }));
  const de = k => barras.find(x => x.k === k) || {};
  ok("an-33-la-barra-mas-larga-cabe", barras.length > 0 && barras.every(x => x.pct >= 0 && x.pct <= 100) && de("inventario").pct === 100 && de("etiquetas").pct < 20 && barras[barras.length - 1].k === "inventario",
    `con ${$(103000)} de inventario (al final): barras ${JSON.stringify(barras)} (ninguna pasa del 100 %; la de inventario llena, la de etiquetas al 15 %)`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nanalytics: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
