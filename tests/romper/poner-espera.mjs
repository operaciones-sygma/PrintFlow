// Tratar de ROMPER «Poner en espera» (`SnoozeModal`), su /impeccable critique del 17-oct (v10.84.147). Cada caso afirma lo que DEBERÍA pasar: una FALLA
// es un bug. Vuelta 1: escritas antes del arreglo. Reloj fijo: viernes 16-oct-2026 a las 12:00. La orden P-0700 entrega el 28-oct (variantes: en un mes,
// en 2 días hábiles, sin fecha); la base puede rechazar (la ventana se queda con lo escrito).
// Uso: node poner-espera.mjs <dir-capturas> [puerto=5488]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5488);
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
    await page.getByText("Poner en espera").first().waitFor({ timeout: 30000 });
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
const razon = p => p.locator("textarea").first();
const dias = p => p.locator('input[type="number"], input[inputmode="numeric"]').first();
const ponerla = p => p.getByRole("button", { name: /^\s*Poner en espera/ }).last();
const abierta = async p => (await p.locator("textarea").count()) > 0;
const sinAA = p => p.evaluate(() => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const malos = [];
  const raiz = document.querySelector('[role="dialog"]') || document.querySelector("textarea")?.closest("div[style*='border-radius: 20px']") || document.getElementById("root");
  for (const el of raiz.querySelectorAll("*")) {
    if (el.closest("#log,#atras")) continue;
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
await caso("pes-01-es-un-dialogo-que-se-lleva-el-foco", "", async p => {
  const d = await p.getByRole("dialog", { name: /Poner en espera/ }).count();
  const dentro = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  let salio = false;
  for (let i = 0; i < 14; i++) { await p.keyboard.press("Tab"); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) { salio = true; break; } }
  ok("pes-01-es-un-dialogo-que-se-lleva-el-foco", d === 1 && dentro && !salio, `${d ? "es un diálogo con su nombre" : "NO se anuncia como diálogo"}; al abrir el foco ${dentro ? "entra" : "se queda atrás"}; el Tab ${salio ? "se sale a la página de atrás" : "no se sale"}`);
});
await caso("pes-02-esc-no-tira-la-razon-escrita", "", async p => {
  // (con el cursor en la razón, Esc es del campo —la regla de la app— y no cierra: la primera versión lo oprimía ahí. Se suelta el campo y luego Esc.)
  await razon(p).fill("El cliente no contesta el teléfono"); await espera(p);
  await p.locator("h3").first().click(); await p.keyboard.press("Escape"); await espera(p, 300);
  const sigue = await abierta(p), t = await texto(p);
  const seguir = p.getByRole("button", { name: /Seguir escribiendo/ }); if (await seguir.count()) { await seguir.first().click(); await espera(p); }
  const r = sigue ? await razon(p).inputValue().catch(() => "") : "";
  ok("pes-02-esc-no-tira-la-razon-escrita", sigue && /razón escrita|sin ponerla en espera/i.test(t) && r === "El cliente no contesta el teléfono" && !(await lineas(p, "cerrar")).length,
    `con la razón escrita, Esc: ${sigue ? "pregunta («" + ((t.match(/[^.]*razón escrita[^.]*\.?/i) || [""])[0]).slice(0, 60) + "»)" : "CERRÓ y la tiró"}; ${r ? "la razón sigue" : "sin la razón"}`);
});
await caso("pes-03-clic-fuera-no-tira-la-razon-escrita", "", async p => {
  await razon(p).fill("Falta que el cliente mande su logo"); await espera(p);
  await p.mouse.click(8, 380); await espera(p, 300);
  ok("pes-03-clic-fuera-no-tira-la-razon-escrita", (await abierta(p)) && !(await lineas(p, "cerrar")).length, `con la razón escrita, un clic fuera: ${(await abierta(p)) ? "no cierra" : "CERRÓ y la tiró"}`);
});
await caso("pes-04-sin-nada-escrito-esc-cierra", "", async p => {
  await p.keyboard.press("Escape"); await espera(p, 300);
  ok("pes-04-sin-nada-escrito-esc-cierra", !(await abierta(p)) && (await lineas(p, "cerrar")).length === 1, `sin escribir nada, Esc: ${(await abierta(p)) ? "NO cierra" : "cierra"}`);
});
await caso("pes-05-cero-dias-no-se-convierte-en-silencio", "", async p => {
  await razon(p).fill("Esperando material o insumo para continuar"); await dias(p).fill("0"); await espera(p);
  const t = await texto(p), habil = !(await ponerla(p).isDisabled());
  if (habil) { await ponerla(p).click(); await espera(p, 600); }
  const l = (await lineas(p, "en-espera "))[0] || "";
  ok("pes-05-cero-dias-no-se-convierte-en-silencio", !l && /1 o más días|vacío/i.test(t), `con «0» días: ${l ? "LA PUSO en espera «hasta que cambie de etapa» sin decirlo (" + l.slice(0, 60) + ")" : "no la pone"}; ${/1 o más días|vacío/i.test(t) ? "dice qué escribir" : "NO dice qué escribir"}`);
});
await caso("pes-06-dias-con-punto-tampoco", "", async p => {
  await razon(p).fill("Esperando autorización del cliente"); await dias(p).fill("1.5"); await espera(p);
  if (!(await ponerla(p).isDisabled())) { await ponerla(p).click(); await espera(p, 600); }
  const l = (await lineas(p, "en-espera "))[0] || "";
  ok("pes-06-dias-con-punto-tampoco", !l, `con «1.5» días: ${l ? "la puso por " + (l.match(/ \d{4}-\d\d-\d\d /) || ["?"])[0].trim() + " (lo redondeó a 1 sin decirlo)" : "no la pone: pide días enteros"}`);
});
await caso("pes-07-dice-cuando-vuelve-sola", "", async p => {
  await razon(p).fill("Esperando material o insumo para continuar"); await dias(p).fill("3"); await espera(p);
  const t = await texto(p);
  ok("pes-07-dice-cuando-vuelve-sola", /lunes 19/i.test(t), `con 3 días: ${(t.match(/[^.]{0,30}lunes 19[^.]{0,20}/i) || ["NO dice qué día vuelve sola"])[0]} (hoy viernes 16 + 3 días = lunes 19)`);
});
await caso("pes-08-entrega-lejana-sin-fecha-no-se-ofrece", "caso=sinfecha", async p => {
  const t = await texto(p);
  ok("pes-08-entrega-lejana-sin-fecha-no-se-ofrece", !(await p.getByRole("button", { name: /^\s*Entrega lejana/ }).count()) && /fecha de entrega/i.test(t), `sin fecha de entrega: ${(await p.getByRole("button", { name: /^\s*Entrega lejana/ }).count()) ? "OFRECE «Entrega lejana» (nunca volvería sola)" : "no la ofrece"} y ${/fecha de entrega/i.test(t) ? "dice por qué" : "no dice por qué"}`);
});
await caso("pes-09-entrega-lejana-pronto-tampoco", "caso=pronto", async p => {
  ok("pes-09-entrega-lejana-pronto-tampoco", !(await p.getByRole("button", { name: /^\s*Entrega lejana/ }).count()), `entrega en 2 días hábiles: ${(await p.getByRole("button", { name: /^\s*Entrega lejana/ }).count()) ? "ofrece «Entrega lejana»" : "no la ofrece"}`);
});
await caso("pes-10-ponerla-manda-lo-elegido-una-vez", "caso=lejos", async p => {
  await p.getByRole("button", { name: /^\s*Esperando material/ }).first().click(); await dias(p).fill("5"); await espera(p);
  await ponerla(p).dblclick(); await espera(p, 900);
  const l = await lineas(p, "en-espera ");
  ok("pes-10-ponerla-manda-lo-elegido-una-vez", l.length === 1 && /material/.test(l[0]) && /2026-10-21/.test(l[0]) && (await lineas(p, "cerrar")).length === 1, `doble clic en «Poner en espera»: ${l.length} vez/veces; ${l[0] || "nada"} (material, hasta el 21-oct)`);
});
await caso("pes-11-todo-se-lee", "", async p => {
  await razon(p).fill("hola"); await espera(p);
  const m1 = await sinAA(p);
  await p.getByRole("button", { name: /^\s*Esperando material/ }).first().click(); await espera(p);
  const m = [...new Set([...m1, ...(await sinAA(p))])];
  ok("pes-11-todo-se-lee", m.length === 0, m.length ? m.length + " textos sin AA o de menos de 10 px: " + m.slice(0, 8).join(" | ") : "todo con AA (también el botón apagado)");
});
await caso("pes-12-la-base-rechaza-y-no-se-pierde-nada", "falla=base", async p => {
  await razon(p).fill("Esperando autorización del cliente"); await espera(p);
  await ponerla(p).click(); await espera(p, 800);
  const r = (await abierta(p)) ? await razon(p).inputValue() : "", habil = (await abierta(p)) ? !(await ponerla(p).isDisabled()) : false;
  ok("pes-12-la-base-rechaza-y-no-se-pierde-nada", (await lineas(p, "error-base")).length === 1 && r === "Esperando autorización del cliente" && habil, `la base rechaza: la ventana ${(await abierta(p)) ? "sigue con la razón" : "SE CERRÓ"}; el botón ${habil ? "se puede volver a apretar" : "queda apagado"}`);
});
await caso("pes-13-sin-rayas-largas", "caso=lejos", async p => {
  const t = await texto(p), ph = (await razon(p).getAttribute("placeholder")) || "";
  ok("pes-13-sin-rayas-largas", !/—/.test(t + ph), `${/—/.test(t + ph) ? "dice «" + ((t + " " + ph).match(/[^ ]{0,20} — [^ ]{0,20}/) || [""])[0] + "»" : "sin rayas largas"}`);
});

// ── vuelta 2: por donde no se diseñó (Esc dos veces, seguir escribiendo, los bordes de los días y de la razón, Esc mientras guarda, el teclado) ──
await caso("pes-14-esc-dos-veces-sale", "", async p => {
  await razon(p).fill("El cliente no contesta"); await p.locator("h3").first().click();
  await p.keyboard.press("Escape"); await espera(p, 200); const tras1 = await abierta(p);
  await p.keyboard.press("Escape"); await espera(p, 300);
  ok("pes-14-esc-dos-veces-sale", tras1 && !(await abierta(p)) && (await lineas(p, "cerrar")).length === 1, `primer Esc ${tras1 ? "pregunta" : "CIERRA"}; segundo Esc ${(await abierta(p)) ? "NO sale" : "sale"}`);
});
await caso("pes-15-seguir-escribiendo-regresa-a-la-razon", "", async p => {
  await razon(p).fill("Falta el logo"); await p.locator("h3").first().click(); await p.keyboard.press("Escape"); await espera(p, 200);
  await p.getByRole("button", { name: /Seguir escribiendo/ }).click(); await espera(p, 200);
  const enRazon = await p.evaluate(() => document.activeElement?.tagName === "TEXTAREA");
  const sinPregunta = !/razón escrita/i.test(await texto(p));
  ok("pes-15-seguir-escribiendo-regresa-a-la-razon", enRazon && sinPregunta && (await razon(p).inputValue()) === "Falta el logo", `«Seguir escribiendo»: el cursor ${enRazon ? "regresa a la razón" : "no regresa a la razón"}; la pregunta ${sinPregunta ? "se va" : "sigue"}`);
});
await caso("pes-16-los-bordes-de-los-dias", "", async p => {
  await razon(p).fill("Esperando material o insumo"); const r = [];
  for (const d of ["365", "366", "-2"]) { await dias(p).fill(d); await espera(p, 150); r.push(d + ": " + ((await ponerla(p).isDisabled()) ? "no deja" : "deja")); }
  ok("pes-16-los-bordes-de-los-dias", r.join(" · ") === "365: deja · 366: no deja · -2: no deja", r.join(" · "));
});
await caso("pes-17-la-razon-de-cinco-letras", "", async p => {
  const r = [];
  for (const x of ["abcd", "abcde", "      "]) { await razon(p).fill(x); await espera(p, 120); r.push("«" + x + "»: " + ((await ponerla(p).isDisabled()) ? "no deja" : "deja")); }
  ok("pes-17-la-razon-de-cinco-letras", r.join(" · ") === "«abcd»: no deja · «abcde»: deja · «      »: no deja", r.join(" · "));
});
await caso("pes-18-esc-mientras-guarda-no-cierra-a-medias", "", async p => {
  await razon(p).fill("Esperando autorización del cliente"); await ponerla(p).click();
  await p.keyboard.press("Escape"); await espera(p, 80); await p.mouse.click(8, 380); await espera(p, 600);
  const l = await log(p);
  ok("pes-18-esc-mientras-guarda-no-cierra-a-medias", /en-espera/.test(l) && (l.match(/cerrar/g) || []).length === 1 && l.indexOf("en-espera") < l.indexOf("cerrar"), `Esc y un clic fuera mientras guarda: ${l.replace(/\n/g, " | ").slice(0, 160)}`);
});
await caso("pes-19-el-motivo-con-el-teclado", "caso=lejos", async p => {
  let t = "";
  for (let i = 0; i < 12; i++) { await p.keyboard.press("Tab"); t = await p.evaluate(() => document.activeElement?.innerText || ""); if (/Esperando material/.test(t)) break; }
  if (/Esperando material/.test(t)) await p.keyboard.press("Enter");
  await espera(p, 200);
  ok("pes-19-el-motivo-con-el-teclado", /Esperando material/.test(t) && /material o insumo/.test(await razon(p).inputValue()), `con Tab ${/Esperando material/.test(t) ? "se llega a «Esperando material»" : "NO se llega al motivo"}; Enter ${/material o insumo/.test(await razon(p).inputValue()) ? "lo elige" : "no lo elige"}`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nponer-espera: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
