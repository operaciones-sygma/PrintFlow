// Tratar de ROMPER el «Historial del cliente» (`ClientHistory` y la puerta de App al tocar el nombre en la ficha), su /impeccable critique del 17-oct
// (v10.84.148). Cada caso afirma lo que DEBERÍA pasar: una FALLA es un bug. Vuelta 1: escritas antes del arreglo. Genaro es el vendedor de P-0801 (PAOLA
// NUÑEZ, la capturó Lupita: el caso real) y de tres de la Feria (dos las capturó él, una cancelada; una se la capturó Lupita); la cuarta de la Feria es de
// Manuel; AJENO SA no tiene nada de Genaro.
// Uso: node historial.mjs <dir-capturas> [puerto=5489]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5489);
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
    await page.getByRole("button", { name: /Historial de PAOLA/ }).waitFor({ timeout: 30000 });
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
const abrir = async (p, cliente) => { await p.getByRole("button", { name: new RegExp("Historial de " + cliente) }).click(); await espera(p, 300); };
// el historial abierto: el panel con el nombre del cliente de título
const panel = (p, cliente) => p.locator("div", { has: p.locator("h3", { hasText: cliente }) }).last();
const textoPanel = async (p, cliente) => ((await panel(p, cliente).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
const sinAA = p => p.evaluate(() => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const malos = [];
  const h3 = document.querySelector("h3"); const raiz = h3 ? h3.parentElement : document.body;
  for (const el of raiz.querySelectorAll("*")) {
    if (el.closest("#log")) continue;
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
await caso("hcl-01-el-vendedor-abre-el-historial-de-su-cliente", "", async p => {
  await abrir(p, "PAOLA");
  const aviso = (await lineas(p, "aviso ")).join(" "), t = await textoPanel(p, "PAOLA NUÑEZ");
  ok("hcl-01-el-vendedor-abre-el-historial-de-su-cliente", !aviso && /P-0801/.test(t), `Genaro toca a PAOLA NUÑEZ (su orden P-0801, la capturó Lupita): ${aviso ? "«" + aviso.replace(/^aviso /, "") + "»" : /P-0801/.test(t) ? "abre su historial" : "no abre"}`);
});
await caso("hcl-02-el-vendedor-ve-todo-lo-suyo-del-cliente", "", async p => {
  await abrir(p, "PATRONATO");
  const t = await textoPanel(p, "PATRONATO DE LA FERIA");
  const tiene = ["P-0802", "P-0803", "P-0804"].filter(x => t.includes(x)), ajena = /P-0805/.test(t);
  ok("hcl-02-el-vendedor-ve-todo-lo-suyo-del-cliente", tiene.length === 3 && !ajena && /3 órdenes/.test(t), `la Feria para Genaro: ${tiene.join(", ") || "nada"}${ajena ? " y P-0805 de Manuel" : ""} (debe P-0802, P-0803 y P-0804: la que le capturó Lupita también es suya)`);
});
await caso("hcl-03-lo-ajeno-no-se-abre", "", async p => {
  await abrir(p, "AJENO");
  ok("hcl-03-lo-ajeno-no-se-abre", (await lineas(p, "aviso ")).some(l => /No tienes órdenes con este cliente/.test(l)) && !(await lineas(p, "historial ")).length, `Genaro toca a AJENO SA (nada suyo): ${(await lineas(p, "historial ")).length ? "LO ABRE" : "no lo abre y lo dice"}`);
});
await caso("hcl-04-es-un-dialogo-que-se-lleva-el-foco", "", async p => {
  await abrir(p, "PATRONATO");
  const d = await p.getByRole("dialog", { name: /PATRONATO DE LA FERIA/ }).count();
  const dentro = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  let salio = false;
  for (let i = 0; i < 8; i++) { await p.keyboard.press("Tab"); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) { salio = true; break; } }
  ok("hcl-04-es-un-dialogo-que-se-lleva-el-foco", d === 1 && dentro && !salio, `${d ? "es un diálogo con el nombre del cliente" : "NO se anuncia como diálogo"}; el foco ${dentro ? "entra" : "se queda atrás"}; el Tab ${salio ? "se sale" : "no se sale"}`);
});
await caso("hcl-05-esc-cierra-y-regresa-el-foco", "", async p => {
  const b = p.getByRole("button", { name: /Historial de PATRONATO/ }); await b.focus(); await p.keyboard.press("Enter"); await espera(p, 300);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const foco = await p.evaluate(() => (document.activeElement?.innerText || "(se perdió)").slice(0, 40));
  ok("hcl-05-esc-cierra-y-regresa-el-foco", (await lineas(p, "cerrar")).length === 1 && /Historial de PATRONATO/.test(foco), `Esc ${(await lineas(p, "cerrar")).length ? "cierra" : "NO cierra"}; el foco queda en: ${foco}`);
});
await caso("hcl-06-todo-se-lee", "", async p => {
  await abrir(p, "PATRONATO");
  const m = await sinAA(p);
  ok("hcl-06-todo-se-lee", m.length === 0, m.length ? m.length + " textos sin AA o de menos de 10 px: " + m.slice(0, 8).join(" | ") : "todo con AA");
});
await caso("hcl-07-sin-el-id-interno", "", async p => {
  await abrir(p, "PATRONATO");
  const t = await textoPanel(p, "PATRONATO DE LA FERIA");
  ok("hcl-07-sin-el-id-interno", !/OP-P-08\d\d/.test(t) && /P-0802/.test(t), `${/OP-P-08\d\d/.test(t) ? "enseña el id interno («" + (t.match(/OP-P-08\d\d/) || [""])[0] + "»)" : "sin el id interno"}; ${/P-0802/.test(t) ? "con el folio P-" : "SIN el folio P-"}`);
});
await caso("hcl-08-el-total-dice-que-es", "", async p => {
  await abrir(p, "PATRONATO");
  const t = await textoPanel(p, "PATRONATO DE LA FERIA");
  ok("hcl-08-el-total-dice-que-es", /sin IVA/.test(t) && /\$7,000\.00/.test(t) && /cancelada/i.test(t), `el total: «${(t.match(/Total[^·]{0,50}/) || ["no dice"])[0]}» (debe $7,000.00 sin IVA: P-0803 está cancelada); la cancelada ${/cancelada/i.test(t) ? "dice que lo está" : "NO dice que lo está (sólo se ve tenue)"}`);
});
await caso("hcl-09-produccion-sin-dinero", "rol=produccion", async p => {
  await abrir(p, "PATRONATO");
  const t = await textoPanel(p, "PATRONATO DE LA FERIA");
  ok("hcl-09-produccion-sin-dinero", !!t && !/\$\d/.test(t), `Gerardo: ${!t ? "no abre" : /\$\d/.test(t) ? "VE importes" : "sin importes"}`);
});
await caso("hcl-10-direccion-ve-todo-el-cliente", "rol=admin", async p => {
  await abrir(p, "PATRONATO");
  const t = await textoPanel(p, "PATRONATO DE LA FERIA");
  ok("hcl-10-direccion-ve-todo-el-cliente", /4 órdenes/.test(t) && /P-0805/.test(t), `Dirección: ${(t.match(/\d+ órdenes?/) || ["?"])[0]} (debe las 4, también la de Manuel)`);
});

// ── vuelta 2: por donde no se diseñó (el vendedor escrito distinto, el clic fuera) ──
await caso("hcl-11-el-vendedor-escrito-distinto-tambien-es-suyo", "", async p => {
  await abrir(p, "PAOLA");
  const t = await textoPanel(p, "PAOLA NUÑEZ");
  ok("hcl-11-el-vendedor-escrito-distinto-tambien-es-suyo", /P-0807/.test(t) && /2 órdenes/.test(t), `PAOLA para Genaro: ${(t.match(/\d+ órdenes?/) || ["?"])[0]}; P-0807 (vendedor «GENARO ») ${/P-0807/.test(t) ? "sí" : "NO"}`);
});
await caso("hcl-12-el-clic-fuera-cierra", "", async p => {
  await abrir(p, "PATRONATO"); await p.mouse.click(5, 700); await espera(p, 300);
  ok("hcl-12-el-clic-fuera-cierra", (await lineas(p, "cerrar")).length === 1, `un clic fuera (sólo lectura, nada que perder): ${(await lineas(p, "cerrar")).length ? "cierra" : "NO cierra"}`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nhistorial: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
