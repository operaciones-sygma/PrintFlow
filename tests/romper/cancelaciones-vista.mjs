// Tratar de ROMPER la vista «Cancelaciones» (`CancelacionesView`: cancelar en lote), su /impeccable critique del 17-oct en la madrugada (v10.84.144).
// Cada caso afirma lo que DEBERÍA pasar: una FALLA es un bug. Vuelta 1: escritas antes del arreglo. La tanda `cancelaciones` es otra (la parte de la
// base, con Node). En el banco: P-0801 en la fila de la PM-74, P-0802 con su factura F-120, P-0803 pagada con saldo a favor ($2,500), P-0804 sólo
// capturada, P-0805 por partes (F-121 y F-122), P-0806 en el plan de su OC, P-0807 en la factura agrupada F-130; y dos en el historial.
// Uso: node cancelaciones-vista.mjs <dir-capturas> [puerto=5485]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5485);
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
    await page.getByRole("heading", { name: /Cancelaciones/ }).first().waitFor({ timeout: 30000 });
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
// elegir órdenes (la casilla de su ficha), escribir el motivo y apretar el botón de cancelar del lote
const elegir = async (p, ...pns) => { for (const pn of pns) { await p.locator("label", { hasText: pn }).first().locator('input[type="checkbox"]').check(); await espera(p, 120); } };
const motivo = async (p, t = "El cliente canceló el pedido") => { await p.getByPlaceholder(/Motivo de la cancelación/).fill(t); await espera(p, 120); };
const botonDelLote = p => p.getByRole("button", { name: /^(Revisar y cancelar|Cancelar)( \(\d+\)| las \d+)?$/ }).first();
const confirmacion = p => p.getByRole("region", { name: /Vas a cancelar/ });
const siCancelar = p => p.getByRole("button", { name: /^Sí, cancelar/ });
// el camino completo: con la confirmación nueva o sin ella (el código de antes cancelaba con el primer clic)
const cancelarSeleccion = async p => { await botonDelLote(p).click(); await espera(p, 300); if (await siCancelar(p).count()) { await siCancelar(p).first().click(); } await espera(p, 600); };
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
await caso("cnv-01-pregunta-antes-de-cancelar", "", async p => {
  await elegir(p, "P-0802", "P-0804"); await motivo(p);
  await botonDelLote(p).click(); await espera(p, 600);
  const canceladas = await lineas(p, "cancelar "), conf = await confirmacion(p).count();
  ok("cnv-01-pregunta-antes-de-cancelar", !canceladas.length && conf === 1, `2 elegidas (una con su factura F-120) y el motivo; el botón del lote: ${canceladas.length ? "CANCELÓ de una vez (" + canceladas[0] + ")" : "no cancela todavía"}; ${conf ? "enseña qué va a pasar y pide confirmar" : "NO pregunta"}`);
});
await caso("cnv-02-dice-que-cae-con-cada-una", "", async p => {
  await elegir(p, "P-0801", "P-0802", "P-0803", "P-0805", "P-0806", "P-0807"); await motivo(p);
  await botonDelLote(p).click(); await espera(p, 600);
  const t = ((await confirmacion(p).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const faltan = [["F-120 y su nota de crédito", /F-120[^.]*nota de crédito|nota de crédito[^.]*F-120/], ["$2,500.00 que regresan al saldo a favor", /\$2,500\.00[^.]*saldo|saldo[^.]*\$2,500\.00/], ["la fila de la Printmaster 74", /fila de Printmaster 74/],
    ["F-121 y F-122 (por partes)", /F-121[\s\S]{0,40}F-122/], ["F-130 (agrupada)", /F-130/], ["el plan de su OC", /plan/]].filter(([, r]) => !r.test(t)).map(([n]) => n);
  ok("cnv-02-dice-que-cae-con-cada-una", !!t && !faltan.length, t ? (faltan.length ? "la confirmación no dice: " + faltan.join(", ") : "dice lo que cae con cada una") : "no hay confirmación que lo diga");
});
await caso("cnv-03-confirmar-cancela-una-vez", "", async p => {
  await elegir(p, "P-0802", "P-0804"); await motivo(p, "Pedido duplicado");
  await cancelarSeleccion(p);
  const l = await lineas(p, "cancelar ");
  ok("cnv-03-confirmar-cancela-una-vez", l.length === 1 && /OP-P-0802/.test(l[0]) && /OP-P-0804/.test(l[0]) && /Pedido duplicado/.test(l[0]) && (await siCancelar(p).count()) === 0,
    `${l.length} lote(s) mandado(s): ${l.join(" | ") || "ninguno"}`);
});
await caso("cnv-04-doble-clic-en-el-boton-del-lote-no-cancela", "", async p => {
  await elegir(p, "P-0802", "P-0804"); await motivo(p);
  await botonDelLote(p).dblclick(); await espera(p, 700);
  const l = await lineas(p, "cancelar ");
  ok("cnv-04-doble-clic-en-el-boton-del-lote-no-cancela", l.length === 0 && (await confirmacion(p).count()) === 1, `doble clic en el botón del lote: ${l.length ? "CANCELÓ " + l.length + " vez/veces" : "no cancela"}; ${(await confirmacion(p).count()) ? "queda la confirmación" : "sin confirmación"}`);
});
await caso("cnv-05-doble-clic-en-si-cancelar-cancela-una-vez", "", async p => {
  await elegir(p, "P-0802", "P-0804"); await motivo(p);
  await botonDelLote(p).click(); await espera(p, 400);
  const hay = await siCancelar(p).count(); if (hay) { await siCancelar(p).first().dblclick(); await espera(p, 900); }
  const l = await lineas(p, "cancelar ");
  ok("cnv-05-doble-clic-en-si-cancelar-cancela-una-vez", hay === 1 && l.length === 1, `${hay ? "doble clic en «Sí, cancelar»" : "sin «Sí, cancelar»"}: ${l.length} lote(s) mandado(s)`);
});
await caso("cnv-06-regresar-y-esc-no-pierden-nada", "", async p => {
  await elegir(p, "P-0802", "P-0804"); await motivo(p, "Se repitió la orden");
  await botonDelLote(p).click(); await espera(p, 400);
  const abierta1 = await confirmacion(p).count(); await p.keyboard.press("Escape"); await espera(p, 300);
  const trasEsc = await confirmacion(p).count();
  await botonDelLote(p).click(); await espera(p, 400);
  const reg = p.getByRole("button", { name: /^Regresar/ }); const hayReg = await reg.count(); if (hayReg) { await reg.first().click(); await espera(p, 300); }
  const marcadas = await p.locator('input[type="checkbox"]:checked').count(), m = await p.getByPlaceholder(/Motivo de la cancelación/).inputValue();
  ok("cnv-06-regresar-y-esc-no-pierden-nada", abierta1 === 1 && trasEsc === 0 && hayReg === 1 && (await confirmacion(p).count()) === 0 && marcadas === 2 && m === "Se repitió la orden" && !(await lineas(p, "cancelar ")).length,
    `confirmación ${abierta1 ? "sí" : "NO"}; Esc ${trasEsc ? "no la cierra" : "la cierra"}; «Regresar» ${hayReg ? "sí" : "NO"}; quedan ${marcadas} elegidas y el motivo «${m}»`);
});
await caso("cnv-07-cambiar-la-seleccion-cierra-la-confirmacion", "", async p => {
  await elegir(p, "P-0802", "P-0804"); await motivo(p);
  await botonDelLote(p).click(); await espera(p, 400);
  const antes = await confirmacion(p).count();
  await p.locator("label", { hasText: "P-0807" }).first().locator('input[type="checkbox"]').check({ force: true }).catch(() => {}); await espera(p, 300);
  ok("cnv-07-cambiar-la-seleccion-cierra-la-confirmacion", antes === 1 && (await confirmacion(p).count()) === 0, `${antes ? "con la confirmación abierta" : "SIN confirmación"} se elige otra orden: ${(await confirmacion(p).count()) ? "la confirmación sigue (confirmaría una lista distinta de la que enseñó)" : "se cierra"}`);
});
await caso("cnv-08-todo-se-lee", "", async p => {
  await elegir(p, "P-0802", "P-0803"); await motivo(p); await espera(p, 400);
  const m1 = await sinAA(p);
  await botonDelLote(p).click(); await espera(p, 500);
  const m2 = await sinAA(p), m = [...new Set([...m1, ...m2])];
  ok("cnv-08-todo-se-lee", m.length === 0, m.length ? m.length + " textos sin AA o de menos de 10 px: " + m.slice(0, 8).join(" | ") : "todo con AA");
});
await caso("cnv-09-el-buscador-habla-de-las-series-de-hoy", "", async p => {
  const ph = (await p.locator("input[placeholder]").first().getAttribute("placeholder")) || "";
  ok("cnv-09-el-buscador-habla-de-las-series-de-hoy", /F-/.test(ph) && !/D-\/R-/.test(ph), `el buscador: «${ph}» (desde el 1-sep los folios son F- y RS-; D- y R- eran de Alpha)`);
});
await caso("cnv-10-el-historial-se-abre-con-el-teclado", "", async p => {
  const t = await tabHasta(p, x => /^P-0790$|^Orden P-0790|P-0790/.test(x) && !/checkbox/i.test(x));
  if (t) await p.keyboard.press("Enter");
  await espera(p);
  ok("cnv-10-el-historial-se-abre-con-el-teclado", !!t && (await lineas(p, "detalle OP-P-0790")).length === 1, `con Tab ${t ? "se llega a P-0790 del historial" : "NO se llega a P-0790 del historial"}; Enter ${(await lineas(p, "detalle OP-P-0790")).length ? "la abre" : "no la abre"}`);
});
await caso("cnv-11-sin-saldo-leido-lo-dice", "falla=saldo", async p => {
  await elegir(p, "P-0803"); await espera(p, 500);
  const t = await texto(p);
  ok("cnv-11-sin-saldo-leido-lo-dice", /No se pudo comprobar/.test(t), `la lectura del saldo a favor no contesta: ${/No se pudo comprobar/.test(t) ? "lo dice" : "NO lo dice (se vería igual que sin saldo)"}`);
});
await caso("cnv-11b-y-la-confirmacion-tambien", "falla=saldo", async p => {
  await elegir(p, "P-0803"); await motivo(p); await espera(p, 400);
  await botonDelLote(p).click(); await espera(p, 500);
  const t = ((await confirmacion(p).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("cnv-11b-y-la-confirmacion-tambien", /No se pudo comprobar/.test(t) || /no se pudo revisar/i.test(t), t ? `la confirmación ${/No se pudo comprobar|no se pudo revisar/i.test(t) ? "dice que no se pudo revisar el saldo" : "NO dice que no se pudo revisar el saldo"}` : "no hay confirmación");
});
await caso("cnv-12-lupita-no-cancela-lo-facturado", "rol=secretaria", async p => {
  await elegir(p, "P-0802"); await motivo(p); await espera(p, 300);
  const t = await texto(p), des = await botonDelLote(p).isDisabled();
  ok("cnv-12-lupita-no-cancela-lo-facturado", /solo Dirección/i.test(t) && des, `Lupita elige P-0802 (F-120): ${/solo Dirección/i.test(t) ? "dice que sólo Dirección" : "NO dice que sólo Dirección"}; el botón ${des ? "apagado" : "ENCENDIDO"}`);
});
await caso("cnv-13-la-que-falla-se-queda-elegida", "falla=una", async p => {
  await elegir(p, "P-0802", "P-0804"); await motivo(p);
  await cancelarSeleccion(p);
  const marcadas = await p.locator('input[type="checkbox"]:checked').count(), t = await texto(p);
  ok("cnv-13-la-que-falla-se-queda-elegida", marcadas === 1 && /CANCELADA SIN FOLIO[\s\S]*|P-0804/.test(t), `la base rechaza la primera: quedan ${marcadas} elegida(s) (debe 1, la que falló, para reintentar)`);
});
for (const ancho of [1366, 1920]) {
  await caso(`cnv-14-cabe-a-${ancho}`, "", async p => {
    await elegir(p, "P-0801", "P-0802", "P-0803", "P-0805"); await motivo(p);
    await botonDelLote(p).click(); await espera(p, 500);
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(`cnv-14-cabe-a-${ancho}`, r.sw <= r.cw, `a ${ancho}, con la confirmación: ancho de la página ${r.sw} en ${r.cw}`);
  }, { viewport: { width: ancho, height: ancho === 1366 ? 768 : 1080 } });
}
await caso("cnv-15-la-confirmacion-cita-el-motivo", "", async p => {
  await elegir(p, "P-0804"); await motivo(p, "Lo capturé dos veces");
  await botonDelLote(p).click(); await espera(p, 500);
  const t = ((await confirmacion(p).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("cnv-15-la-confirmacion-cita-el-motivo", /Lo capturé dos veces/.test(t) && /Producción/.test(t), t ? `la confirmación ${/Lo capturé dos veces/.test(t) ? "cita el motivo" : "NO cita el motivo"} y ${/Producción/.test(t) ? "dice a quién se avisa" : "NO dice a quién se avisa"}` : "no hay confirmación");
});

// ── vuelta 2: por donde no se diseñó (lo que cambia con la confirmación abierta, el saldo que tarda, quién cancela, el teclado) ──
await caso("cnv-16-la-que-se-cancela-en-otra-sesion-no-se-manda", "", async p => {
  await elegir(p, "P-0802", "P-0804"); await motivo(p);
  await botonDelLote(p).click(); await espera(p, 400);
  await p.evaluate(() => window.__cambiar("OP-P-0804", { stage: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: "karla", cancellation_reason: "otra sesión" })); await espera(p, 400);
  const t = ((await confirmacion(p).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  if (await siCancelar(p).count()) { await siCancelar(p).first().click(); await espera(p, 700); }
  const l = (await lineas(p, "cancelar "))[0] || "";
  ok("cnv-16-la-que-se-cancela-en-otra-sesion-no-se-manda", /otra sesión/.test(t) && /OP-P-0802/.test(l) && !/OP-P-0804/.test(l),
    `P-0804 se cancela en otra sesión con la confirmación abierta: ${/otra sesión/.test(t) ? "lo dice" : "NO lo dice"}; se mandó: ${l || "nada"} (sólo P-0802)`);
});
await caso("cnv-17-la-que-recibe-folio-mientras-lupita-confirma", "rol=secretaria", async p => {
  await elegir(p, "P-0804"); await motivo(p);
  await botonDelLote(p).click(); await espera(p, 400);
  const antes = await confirmacion(p).count();
  await p.evaluate(() => window.__cambiar("OP-P-0804", { invoice_folio: "F-140", invoice_type: "factura" })); await espera(p, 400);
  const sigue = await siCancelar(p).count(), habil = sigue ? !(await siCancelar(p).first().isDisabled()) : false;
  ok("cnv-17-la-que-recibe-folio-mientras-lupita-confirma", antes === 1 && !habil, `Lupita confirma P-0804 y le ponen el folio F-140 en otra sesión: ${habil ? "todavía puede confirmar (lo facturado es de Dirección)" : "ya no puede confirmar"}`);
});
await caso("cnv-18-el-saldo-que-tarda-no-se-salta", "lento=saldo", async p => {
  await elegir(p, "P-0803"); await motivo(p);
  await botonDelLote(p).click(); await espera(p, 200);
  const t1 = ((await confirmacion(p).innerText().catch(() => "")) || "").replace(/\s+/g, " "), hab1 = (await siCancelar(p).count()) ? !(await siCancelar(p).first().isDisabled()) : true;
  await espera(p, 1800);
  const t2 = ((await confirmacion(p).innerText().catch(() => "")) || "").replace(/\s+/g, " "), hab2 = (await siCancelar(p).count()) ? !(await siCancelar(p).first().isDisabled()) : false;
  ok("cnv-18-el-saldo-que-tarda-no-se-salta", /Revisando/.test(t1) && !hab1 && /\$2,500\.00/.test(t2) && hab2,
    `mientras lee el saldo: ${/Revisando/.test(t1) ? "dice «Revisando…»" : "NO dice que está revisando"} y «Sí, cancelar» ${hab1 ? "SE PUEDE apretar (cancelaría sin ver que regresan $2,500)" : "espera"}; al contestar: ${/\$2,500\.00/.test(t2) ? "dice los $2,500.00" : "no dice el saldo"} y ${hab2 ? "ya se puede" : "sigue apagado"}`);
});
await caso("cnv-19-karla-avisa-a-produccion-y-direccion", "rol=karla", async p => {
  await elegir(p, "P-0804"); await motivo(p);
  await botonDelLote(p).click(); await espera(p, 400);
  const t = ((await confirmacion(p).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("cnv-19-karla-avisa-a-produccion-y-direccion", /Producción y a Dirección/.test(t), `Karla: «${(t.match(/Les? avisamos[^.]*/) || ["no dice a quién avisa"])[0]}»`);
});
await caso("cnv-20-todo-con-el-teclado", "", async p => {
  await elegir(p, "P-0804"); await motivo(p);
  const t = await tabHasta(p, x => /^Revisar y cancelar/.test(x));
  if (t) { await p.keyboard.press("Enter"); await espera(p, 400); }
  const enLa = await p.evaluate(() => !!document.activeElement?.closest("section"));
  const s = await tabHasta(p, x => /^Sí, cancelar/.test(x), 6);
  if (s) { await p.keyboard.press("Enter"); await espera(p, 700); }
  const l = await lineas(p, "cancelar ");
  ok("cnv-20-todo-con-el-teclado", !!t && enLa && !!s && l.length === 1, `Tab a «Revisar y cancelar» ${t ? "sí" : "NO"}; el foco ${enLa ? "pasa a la confirmación" : "NO pasa a la confirmación"}; Tab a «Sí, cancelar» ${s ? "sí" : "NO"}; Enter: ${l.length} lote(s)`);
});

// ── vuelta 3: fallas EN los arreglos de la 2 (la lectura que se cuelga, todo cancelado en otra sesión) ──
await caso("cnv-21-el-saldo-colgado-no-deja-la-confirmacion-trabada", "lento=colgado", async p => {
  await elegir(p, "P-0803"); await motivo(p);
  await botonDelLote(p).click(); await espera(p, 300);
  const hab1 = (await siCancelar(p).count()) ? !(await siCancelar(p).first().isDisabled()) : true;
  await espera(p, 8800);
  const t = ((await confirmacion(p).innerText().catch(() => "")) || "").replace(/\s+/g, " "), hab2 = (await siCancelar(p).count()) ? !(await siCancelar(p).first().isDisabled()) : false;
  ok("cnv-21-el-saldo-colgado-no-deja-la-confirmacion-trabada", !hab1 && /No se pudo comprobar/.test(t) && hab2,
    `la lectura del saldo nunca contesta: al principio «Sí, cancelar» ${hab1 ? "se puede" : "espera"}; a los 9 s ${/No se pudo comprobar/.test(t) ? "dice que no se pudo comprobar" : "SIGUE «Revisando…»"} y ${hab2 ? "ya deja confirmar" : "SIGUE trabada"}`);
}, { viewport: { width: 1366, height: 768 } });
await caso("cnv-22-todo-cancelado-en-otra-sesion-no-manda-nada", "", async p => {
  await elegir(p, "P-0802", "P-0804"); await motivo(p);
  await botonDelLote(p).click(); await espera(p, 400);
  await p.evaluate(() => { for (const id of ["OP-P-0802", "OP-P-0804"]) window.__cambiar(id, { stage: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: "karla", cancellation_reason: "otra sesión" }); }); await espera(p, 400);
  const b = p.getByRole("button", { name: /Nada que cancelar|^Sí, cancelar/ }); const hay = await b.count(), apagado = hay ? await b.first().isDisabled() : false;
  if (hay && !apagado) { await b.first().click(); await espera(p, 600); }
  ok("cnv-22-todo-cancelado-en-otra-sesion-no-manda-nada", hay === 1 && apagado && !(await lineas(p, "cancelar ")).length, `las dos se cancelan en otra sesión con la confirmación abierta: el botón ${hay ? (apagado ? "apagado («" + (await b.first().innerText()).trim() + "»)" : "ENCENDIDO") : "no está"}; se mandó ${(await lineas(p, "cancelar ")).length} lote(s)`);
});

// ── vuelta 4 (la última): el tope de la 3 no tira lo que llega tarde ──
await caso("cnv-23-el-saldo-que-llega-tarde-se-dice", "lento=tarde", async p => {
  await elegir(p, "P-0803"); await motivo(p);
  await botonDelLote(p).click(); await espera(p, 8600);
  const t1 = ((await confirmacion(p).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  await espera(p, 1800);
  const t2 = ((await confirmacion(p).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("cnv-23-el-saldo-que-llega-tarde-se-dice", /No se pudo comprobar/.test(t1) && /\$2,500\.00/.test(t2) && !/No se pudo comprobar/.test(t2),
    `a los 8.6 s: ${/No se pudo comprobar/.test(t1) ? "«no se pudo comprobar»" : "«" + t1.slice(0, 60) + "»"}; cuando contesta (9.5 s): ${/\$2,500\.00/.test(t2) ? "dice los $2,500.00" : "NO dice el saldo que llegó"}`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\ncancelaciones-vista: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
