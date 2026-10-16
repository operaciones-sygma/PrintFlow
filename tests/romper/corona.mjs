// Tratar de ROMPER el «APARTADO CORONA» (los clientes con saldo a favor: su saldo y su historial; Dirección, Karla y Lupita), su /impeccable critique del
// 16-oct. Cada caso afirma lo que DEBERÍA pasarle a quien lo abre: una FALLA es un bug. Vuelta 1: escritas antes del arreglo.
// En el banco: CORONA LEÓN ($48,250.50, pool con dos sub-cuentas; 4 movimientos: depósito, consumo, ajuste, anticipo) y DISTRIBUIDORA DEL CENTRO (−$1,200,
// sin movimientos). Detrás, una «app» con su buscador (#atras-*).
// Uso: node corona.mjs <dir-capturas> [puerto=5176]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5176);
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
    await page.getByText("Apartado Corona").first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
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
const cliente = (p, re) => p.getByRole("button", { name: re }).first();

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("cor-01-falla-no-es-vacio", "falla=clientes", async p => {
  const t = await texto(p); const miente = /Aún no hay clientes con saldo a favor|0 clientes con saldo/.test(t); const re = await p.getByRole("button", { name: /Reintentar/ }).count();
  ok("cor-01-falla-no-es-vacio", !miente && re >= 1, `la lectura de los saldos falló: ${miente ? "dice que no hay clientes con saldo" : "no dice que no hay"}; «Reintentar» ${re ? "sí" : "no"}`);
});
await caso("cor-02-reintentar-trae", "falla=clientes-una", async p => {
  const b = p.getByRole("button", { name: /Reintentar/ }); const hay = await b.count();
  if (hay) { await b.first().click(); await espera(p, 700); }
  ok("cor-02-reintentar-trae", hay >= 1 && /CORONA LEÓN/.test(await texto(p)), `la primera lectura falló: «Reintentar» ${hay ? "sí" : "no"}; ${/CORONA LEÓN/.test(await texto(p)) ? "llegan los saldos" : "no llegan"}`);
});
await caso("cor-03-historial-falla", "falla=ledger", async p => {
  const t = await texto(p); const miente = /Sin movimientos todavía/.test(t); const dice = /no se pud/i.test(t);
  ok("cor-03-historial-falla", !miente && dice, `la lectura del historial de CORONA LEÓN falló: ${miente ? "dice «Sin movimientos todavía»" : "no dice que no hay"}${dice ? "; lo dice" : "; no dice que falló"}`);
});
await caso("cor-04-recargar-no-miente", "lento=ledger", async p => {
  await p.getByRole("button", { name: /Recargar/ }).first().click(); await espera(p, 250);
  const t = await texto(p);
  ok("cor-04-recargar-no-miente", !/Sin movimientos todavía/.test(t), /Sin movimientos todavía/.test(t) ? "mientras recarga, dice «Sin movimientos todavía» (CORONA LEÓN tiene 4)" : "mientras recarga no dice que no hay");
});
await caso("cor-05-en-palabras", "", async p => {
  const t = await texto(p);
  const tecnico = ["billing_mode", "DEPOSITO", "CONSUMO", "ANTICIPO", "AJUSTE"].filter(x => t.includes(x));
  ok("cor-05-en-palabras", !tecnico.length && /Depósito/.test(t), tecnico.length ? "dice: " + tecnico.join(", ") : "los tipos y el modo en palabras");
});
await caso("cor-06-AA", "", async p => {
  const m = await sinAA(p);
  ok("cor-06-AA", m.length === 0, m.length ? "sin AA o de menos de 10 px: " + m.slice(0, 9).join(" | ") : "todo con AA");
});
await caso("cor-07-sin-raya-lateral", "", async p => {
  const r = await cliente(p, /CORONA LEÓN/).evaluate(el => { const s = getComputedStyle(el); return { izq: parseFloat(s.borderLeftWidth), der: parseFloat(s.borderRightWidth) }; });
  ok("cor-07-sin-raya-lateral", r.izq <= 1 || r.izq === r.der, `el cliente elegido: borde izquierdo ${r.izq}px, derecho ${r.der}px`);
});
await caso("cor-08-dialogo-y-teclado", "", async p => {
  const d = await p.getByRole("dialog", { name: /Corona/ }).count();
  await cliente(p, /CORONA LEÓN/).focus();
  const fuera = [];
  for (let i = 0; i < 12; i++) { await p.keyboard.press("Tab"); const w = await p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? "body" : a.closest("#barra") ? (a.id || a.tagName) : ""; }); if (w) fuera.push(w); }
  ok("cor-08-dialogo-y-teclado", d === 1 && fuera.length === 0, `role=dialog: ${d}; ${fuera.length ? "el foco se va atrás: " + [...new Set(fuera)].join(", ") : "el Tab no se sale"}`);
});
await caso("cor-09-esc-cierra", "", async p => {
  await p.keyboard.press("Escape"); await espera(p);
  ok("cor-09-esc-cierra", (await lineas(p, "cerrar")).length === 1, `Esc: ${(await lineas(p, "cerrar")).length ? "cierra" : "no cierra"}`);
});
await caso("cor-10-vacio-de-verdad", "caso=vacio", async p => {
  ok("cor-10-vacio-de-verdad", /Aún no hay clientes con saldo a favor/.test(await texto(p)), "ningún cliente con saldo: " + (/Aún no hay clientes/.test(await texto(p)) ? "lo dice" : "no lo dice"));
});
await caso("cor-11-karla", "rol=karla", async p => {
  const aj = await p.getByRole("button", { name: /Ajuste manual/ }).count(), nueva = await p.getByRole("button", { name: /Nueva OC a Crédito/ }).count();
  ok("cor-11-karla", aj === 0 && nueva === 1, `Karla: ajuste manual ${aj} (debe 0), nueva OC a crédito ${nueva} (debe 1)`);
});
await caso("cor-12-sin-movimientos-de-verdad", "", async p => {
  await cliente(p, /DISTRIBUIDORA DEL CENTRO/).click(); await espera(p, 500);
  ok("cor-12-sin-movimientos-de-verdad", /Sin movimientos todavía/.test(await texto(p)), "un cliente sin movimientos (lectura buena): " + (/Sin movimientos todavía/.test(await texto(p)) ? "lo dice" : "no lo dice"));
});

// ── vuelta 2: por donde no se diseñó (escritas con el arreglo pensado, corridas también contra lo de antes) ─────────────────────────────
await caso("cor-13-cambiar-mientras-lee", "lento=ledger", async p => {
  // «Recargar» el historial de CORONA LEÓN (tarda 1.2 s) y, mientras, elegir a DISTRIBUIDORA DEL CENTRO (sin movimientos): lo de CORONA no debe salir en DISTRIBUIDORA
  await p.getByRole("button", { name: /Recargar/ }).first().click(); await espera(p, 100);
  await cliente(p, /DISTRIBUIDORA DEL CENTRO/).click(); await espera(p, 1450);
  const t = await texto(p);
  ok("cor-13-cambiar-mientras-lee", !/Depósito Banorte 1774/.test(t), /Depósito Banorte 1774/.test(t) ? "DISTRIBUIDORA enseña el historial de CORONA LEÓN (la respuesta vieja de «Recargar»)" : "cada cliente con lo suyo");
});
await caso("cor-14-elegir-con-el-teclado", "", async p => {
  let llego = false;
  for (let i = 0; i < 10 && !llego; i++) { await p.keyboard.press("Tab"); llego = await p.evaluate(() => /DISTRIBUIDORA DEL CENTRO/.test(document.activeElement?.innerText || "")); }
  if (llego) { await p.keyboard.press("Enter"); await espera(p, 500); }
  const t = await texto(p);
  ok("cor-14-elegir-con-el-teclado", llego && /Sin movimientos todavía/.test(t), `con Tab ${llego ? "se llega a DISTRIBUIDORA" : "NO se llega a DISTRIBUIDORA"}; ${/Sin movimientos todavía/.test(t) ? "Enter la elige" : "no se elige"}`);
});
await caso("cor-15-reintentar-historial", "falla=ledger-una", async p => {
  const b = p.getByRole("button", { name: /Reintentar/ }); const hay = await b.count();
  if (hay) { await b.first().click(); await espera(p, 600); }
  ok("cor-15-reintentar-historial", hay >= 1 && /Depósito Banorte 1774/.test(await texto(p)), `el historial falló la primera vez: «Reintentar» ${hay ? "sí" : "no"}; ${/Depósito Banorte 1774/.test(await texto(p)) ? "llega" : "no llega"}`);
});
await caso("cor-16-saldo-negativo-en-rojo", "", async p => {
  // el signo antes del peso («−$1,200.00»; decía «$-1,200.00») y en rojo
  const malo = await p.getByText(/\$-1,200\.00/).count();
  const c = await p.getByText(/[−-]\$1,200\.00/).first().evaluate(el => getComputedStyle(el).color).catch(() => "");
  const n = (c.match(/\d+/g) || []).map(Number);
  ok("cor-16-saldo-negativo-en-rojo", !malo && n.length >= 3 && n[0] > 140 && n[1] < 90, malo ? "el saldo negativo se escribe «$-1,200.00»" : `el saldo de −$1,200: ${c || "no está"}`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\ncorona: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
