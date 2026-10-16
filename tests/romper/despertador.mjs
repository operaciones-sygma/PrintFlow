// Tratar de ROMPER el «DESPERTADOR» (la ventana grande que cada quien ve al entrar en el día y que sólo se cierra escribiendo SI ENTIENDO), su
// /impeccable critique del 16-oct. Cada caso afirma lo que DEBERÍA pasarle a quien lo ve: una FALLA es un bug. Vuelta 1: escritas antes del arreglo.
// El reloj del navegador va fijo en el miércoles 14-oct-2026 a las 12:00 de México (o la hora que diga el caso).
// En el banco: 6 paradas de verdad (P-0611 reimprimir, P-0612 sin folio, P-0613 vencida —de Manuel: Lupita la persigue—, P-0614 cinco días sin
// avanzar, P-0615 por validar, P-0616 el cliente no aprueba), 3 con datos por capturar (P-0704/P-0705 sin fecha, P-0707 sin precio: el Despertador no
// las pide) y 2 sanas (P-0620 en máquina). Detrás, una «app» con su buscador y dos botones (#atras-*).
// Uso: node despertador.mjs <dir-capturas> [puerto=5179]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5179);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
const MEDIODIA = new Date("2026-10-14T12:00:00-06:00");
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, { viewport = { width: 1366, height: 768 }, hora = MEDIODIA, esperar = true } = {}) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const ctx = await browser.newContext({ viewport, timezoneId: "America/Mexico_City", locale: "es-MX" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !deFuera(m)) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.clock.setFixedTime(hora);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.locator("#atras-salir").waitFor({ timeout: 30000 });
    if (esperar) { await campo(page).waitFor({ timeout: 8000 }); await page.waitForTimeout(250); }
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
// el campo de SI ENTIENDO (el único fuera de la app de atrás) y si la ventana sigue abierta
const campo = p => p.locator("input:not(#atras-buscar)").first();
const abierto = async p => (await p.locator("input:not(#atras-buscar)").count()) > 0;
// el texto VIVO de la ventana, con su CSS (una copia suelta no aplica el text-transform)
const textoVentana = p => p.evaluate(() => { const i = [...document.querySelectorAll("input")].find(x => x.id !== "atras-buscar"); let v = i; for (let k = 0; k < 6 && v && v.parentElement && !/fixed/.test(getComputedStyle(v).position); k++) v = v.parentElement; return (v?.innerText || "").replace(/\s+/g, " "); });
const escribir = async (p, t) => { await campo(p).click(); await campo(p).pressSequentially(t, { delay: 15 }); await espera(p, 450); };
const registros = async p => (await lineas(p, "rpc log_wakeup_ack")).length;
const sinAA = p => p.evaluate(() => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const malos = [];
  for (const el of document.querySelectorAll("#root *")) {
    if (el.closest("#log,#barra,#lista")) continue;
    const t = propio(el); if (!t || !el.getClientRects().length) continue;
    const s = getComputedStyle(el); if (s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    const a = lum(nums(s.color)), b = lum(fondo(el)), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (k < (grande ? 3 : 4.5) || parseFloat(s.fontSize) < 11) malos.push(t.slice(0, 30) + " " + k.toFixed(1) + (parseFloat(s.fontSize) < 11 ? " (" + s.fontSize + ")" : ""));
  }
  return [...new Set(malos)];
});

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("dsp-01-es-una-ventana", "", async p => {
  const d = p.getByRole("dialog", { name: /Buen(os|as) (días|tardes|noches)/ });
  const n = await d.count(); const modal = n ? await d.first().getAttribute("aria-modal") : null;
  ok("dsp-01-es-una-ventana", n === 1 && modal === "true", `role=dialog con su nombre: ${n}; aria-modal: ${modal}`);
});
await caso("dsp-02-el-campo-tiene-nombre", "", async p => {
  const n = await p.getByRole("textbox", { name: /SI ENTIENDO/i }).count();
  ok("dsp-02-el-campo-tiene-nombre", n === 1, `el campo con un nombre que dice qué escribir: ${n}`);
});
await caso("dsp-03-si-con-coma", "", async p => {
  await escribir(p, "Sí, entiendo");
  ok("dsp-03-si-con-coma", !(await abierto(p)) && (await registros(p)) === 1, `«Sí, entiendo»: ${(await abierto(p)) ? "la ventana NO se cierra" : "se cierra"}; registros: ${await registros(p)}`);
});
await caso("dsp-04-con-signos", "", async p => {
  await escribir(p, "¡Sí entiendo!");
  ok("dsp-04-con-signos", !(await abierto(p)) && (await registros(p)) === 1, `«¡Sí entiendo!»: ${(await abierto(p)) ? "la ventana NO se cierra" : "se cierra"}`);
});
await caso("dsp-05-la-fecha", "", async p => {
  const t = await textoVentana(p);
  ok("dsp-05-la-fecha", /Miércoles, 14 de octubre/.test(t), `la fecha: «${(t.match(/(lunes|martes|miércoles|jueves|viernes|sábado|domingo)[^·]{0,24}/i) || [""])[0].trim()}»`);
});
await caso("dsp-06-saludo-de-la-tarde", "", async p => {
  const t = await textoVentana(p);
  ok("dsp-06-saludo-de-la-tarde", /Buenas tardes/.test(t) && !/Buenos días/.test(t) && !/antes de empezar el día/.test(t),
    `a las 16:30: ${(t.match(/Buen[oa]s \w+/) || ["sin saludo"])[0]}${/antes de empezar el día/.test(t) ? "; dice «antes de empezar el día»" : ""}`);
}, { hora: new Date("2026-10-14T16:30:00-06:00") });
await caso("dsp-07-elegir-y-abrir", "", async p => {
  await p.getByText("P-0613", { exact: true }).first().click(); await espera(p, 200);
  await campo(p).pressSequentially("SI ENTIENDO", { delay: 15 }); await espera(p, 450);
  const abre = (await lineas(p, "accion OP-P-0613 detail")).length;
  ok("dsp-07-elegir-y-abrir", abre === 1 && !(await abierto(p)), `tocar P-0613 y confirmar: ${abre ? "abre P-0613" : "NO abre nada"}; la ventana ${(await abierto(p)) ? "sigue" : "se cerró"}`);
});
await caso("dsp-08-tab-no-se-sale", "", async p => {
  await campo(p).focus();
  const fuera = [];
  for (let i = 0; i < 14; i++) {
    await p.keyboard.press(i % 5 === 4 ? "Shift+Tab" : "Tab");
    const donde = await p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? "body" : a.closest("#barra,#lista") ? (a.id || a.tagName) : ""; });
    if (donde) fuera.push(donde);
  }
  ok("dsp-08-tab-no-se-sale", fuera.length === 0, fuera.length ? "el foco cayó en la app de atrás: " + [...new Set(fuera)].join(", ") : "el foco no sale de la ventana");
});
await caso("dsp-09-lectura-fallida", "lectura=falla-primera", async p => {
  await espera(p, 2600);
  const sale = await abierto(p); const t = sale ? await textoVentana(p) : "";
  ok("dsp-09-lectura-fallida", sale && /P-0616/.test(t), `la primera lectura falló y la segunda salió bien: ${sale ? "el Despertador sale" : "el Despertador NO sale en todo el día"}`);
}, { esperar: false });
await caso("dsp-10-AA", "", async p => {
  const m = await sinAA(p);
  ok("dsp-10-AA", m.length === 0, m.length ? "sin AA o de menos de 11 px: " + m.slice(0, 8).join(" | ") : "todo con AA");
});
await caso("dsp-11-sin-datos-por-capturar", "", async p => {
  const t = await textoVentana(p);
  const datos = ["P-0704", "P-0705", "P-0707"].filter(x => t.includes(x));
  ok("dsp-11-sin-datos-por-capturar", datos.length === 0 && /P-0616/.test(t) && /P-0613/.test(t), `Lupita: ${datos.length ? "pide datos por capturar: " + datos.join(", ") : "sin datos por capturar"}; P-0616 ${/P-0616/.test(t) ? "sí" : "NO"}, P-0613 ${/P-0613/.test(t) ? "sí" : "NO"}`);
});
await caso("dsp-12-gerardo-sin-lo-montado", "rol=produccion", async p => {
  const t = await textoVentana(p);
  ok("dsp-12-gerardo-sin-lo-montado", /P-0611/.test(t) && /P-0614/.test(t) && !/P-0620/.test(t), `Gerardo: reimprimir ${/P-0611/.test(t) ? "sí" : "NO"}, la quieta ${/P-0614/.test(t) ? "sí" : "NO"}, la montada en máquina ${/P-0620/.test(t) ? "SÍ (no debería)" : "no"}`);
});
for (const [ancho, alto] of [[1366, 768], [1920, 1080]]) {
  await caso(`dsp-13-se-ve-el-campo-${ancho}`, "rol=admin", async p => {
    const r = await campo(p).boundingBox(); const ancha = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(`dsp-13-se-ve-el-campo-${ancho}`, !!r && r.y >= 0 && r.y + r.height <= alto && !ancha, `el campo ${r ? "de " + Math.round(r.y) + " a " + Math.round(r.y + r.height) + " px" : "no está"} (alto ${alto})${ancha ? "; la página se sale a lo ancho" : ""}`);
  }, { viewport: { width: ancho, height: alto } });
}
await caso("dsp-14-direccion-por-persona", "rol=admin", async p => {
  const quien = ["Gerardo", "Karla", "Lupita"];
  const hay = {}; for (const q of quien) hay[q] = await p.getByRole("heading", { name: new RegExp(q) }).count();
  ok("dsp-14-direccion-por-persona", quien.every(q => hay[q] >= 1), "encabezados por persona: " + quien.map(q => q + " " + hay[q]).join(", "));
});
await caso("dsp-15-esc-no-cierra", "", async p => {
  await campo(p).focus(); await p.keyboard.press("Escape"); await espera(p);
  const sigue = await abierto(p); const enCampo = await p.evaluate(() => { const a = document.activeElement; return !!a && a.tagName === "INPUT" && a.id !== "atras-buscar"; });
  ok("dsp-15-esc-no-cierra", sigue && enCampo && (await registros(p)) === 0, `Esc: la ventana ${sigue ? "sigue" : "se cerró"}; el foco ${enCampo ? "en el campo" : "fuera del campo"}`);
});

// ── vuelta 2: por donde no se diseñó (escritas con el arreglo pensado, corridas también contra lo de antes) ─────────────────────────────
await caso("dsp-16-elegir-otra", "", async p => {
  await p.getByText("P-0613", { exact: true }).first().click(); await espera(p, 150);
  await p.getByText("P-0616", { exact: true }).first().click(); await espera(p, 150);
  await campo(p).pressSequentially("SI ENTIENDO", { delay: 15 }); await espera(p, 450);
  const a13 = (await lineas(p, "accion OP-P-0613")).length, a16 = (await lineas(p, "accion OP-P-0616 detail")).length;
  ok("dsp-16-elegir-otra", a16 === 1 && a13 === 0, `tocar P-0613 y luego P-0616: abre P-0616 ${a16} vez, P-0613 ${a13}`);
});
await caso("dsp-17-elegir-y-soltar", "", async p => {
  const f = p.getByText("P-0613", { exact: true }).first();
  await f.click(); await espera(p, 150); await f.click(); await espera(p, 150);
  await campo(p).pressSequentially("SI ENTIENDO", { delay: 15 }); await espera(p, 450);
  const abre = await lineas(p, "accion ");
  ok("dsp-17-elegir-y-soltar", abre.length === 0 && !(await abierto(p)), `tocarla dos veces la suelta: ${abre.length ? "abre " + abre.join(", ") : "no abre nada"}; la ventana ${(await abierto(p)) ? "sigue" : "se cerró"}`);
});
await caso("dsp-18-escribir-mal-lo-dice", "", async p => {
  await escribir(p, "Si entendí");
  const pista = await p.evaluate(() => [...document.querySelectorAll("[aria-live]")].map(e => e.innerText.trim()).filter(Boolean).join(" | "));
  const inval = await campo(p).getAttribute("aria-invalid");
  ok("dsp-18-escribir-mal-lo-dice", (await abierto(p)) && /SI ENTIENDO/.test(pista) && inval === "true", `«Si entendí»: la ventana ${(await abierto(p)) ? "sigue" : "se cerró"}; lo que dice: «${pista || "nada"}»; aria-invalid ${inval}`);
});
await caso("dsp-19-el-registro-falla", "falla=registro", async p => {
  await escribir(p, "SI ENTIENDO");
  ok("dsp-19-el-registro-falla", !(await abierto(p)) && (await registros(p)) === 1, `la base no registra: la ventana ${(await abierto(p)) ? "NO se cierra" : "se cierra igual"}; intentos de registro: ${await registros(p)}`);
});
await caso("dsp-20-telefono", "rol=admin", async p => {
  const r = await campo(p).boundingBox(); const ancha = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok("dsp-20-telefono", !!r && r.y + r.height <= 844 && r.x >= 0 && r.x + r.width <= 390 && !ancha, `a 390 px: el campo ${r ? Math.round(r.x) + "-" + Math.round(r.x + r.width) + " × " + Math.round(r.y) + "-" + Math.round(r.y + r.height) : "no está"}${ancha ? "; la página se sale a lo ancho" : ""}`);
}, { viewport: { width: 390, height: 844 } });
await caso("dsp-21-una-sola-confirmacion", "", async p => {
  await campo(p).click(); await campo(p).pressSequentially("SI ENTIENDOO", { delay: 5 }); await espera(p, 800);
  ok("dsp-21-una-sola-confirmacion", (await registros(p)) === 1, `escribir de corrido «SI ENTIENDOO»: registros ${await registros(p)}`);
});
await caso("dsp-22-ya-confirmo-hoy", "caso=confirmado", async p => {
  await espera(p, 1500);
  ok("dsp-22-ya-confirmo-hoy", !(await abierto(p)), `ya confirmó hoy: el Despertador ${(await abierto(p)) ? "sale otra vez" : "no sale"}`);
}, { esperar: false });
await caso("dsp-23-sin-pendientes", "caso=sana", async p => {
  await espera(p, 1500);
  ok("dsp-23-sin-pendientes", !(await abierto(p)), `sin pendientes: el Despertador ${(await abierto(p)) ? "sale (vacío)" : "no sale"}`);
}, { esperar: false });
await caso("dsp-24-noemi-valida", "rol=preprensa", async p => {
  const t = await textoVentana(p);
  ok("dsp-24-noemi-valida", /P-0615/.test(t) && !/P-0611/.test(t), `Noemí: por validar ${/P-0615/.test(t) ? "sí" : "NO"}; reimprimir (de Gerardo) ${/P-0611/.test(t) ? "SÍ (no le toca)" : "no"}`);
});
await caso("dsp-25-la-entrega-no-miente", "rol=produccion", async p => {
  // P-0614 lleva 5 días sin avanzar, pero se entrega el 30-oct: su fecha no es una vencida
  const c = await p.evaluate(() => {
    const pn = [...document.querySelectorAll("span")].find(s => s.textContent.trim() === "P-0614"); if (!pn) return null;
    let caja = pn; for (let k = 0; k < 4 && caja && !caja.querySelector("svg"); k++) caja = caja.parentElement;
    const f = caja && [...caja.querySelectorAll("span")].find(s => s.querySelector("svg") && /\d/.test(s.textContent));
    return f ? getComputedStyle(f).color : null;
  });
  const n = (c || "").match(/\d+/g)?.map(Number) || [];
  const roja = n.length >= 3 && n[0] > 150 && n[1] < 90;
  ok("dsp-25-la-entrega-no-miente", !!c && !roja, `la entrega del 30-oct de P-0614 (5 días sin avanzar): ${c ? (roja ? "en ROJO, como vencida" : "sin rojo") : "no la encuentro"}`);
});
await caso("dsp-26-esc-no-borra", "", async p => {
  await campo(p).click(); await campo(p).pressSequentially("SI ENT", { delay: 15 }); await p.keyboard.press("Escape"); await espera(p);
  const v = await campo(p).inputValue().catch(() => "");
  ok("dsp-26-esc-no-borra", (await abierto(p)) && v === "SI ENT", `Esc a media frase: la ventana ${(await abierto(p)) ? "sigue" : "se cerró"}; lo escrito: «${v}»`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\ndespertador: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
