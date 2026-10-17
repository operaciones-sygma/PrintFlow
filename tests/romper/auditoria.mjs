// Tratar de ROMPER «Auditoría» (`AuditoriaView`: el consecutivo de folios fiscales y el de órdenes P-), su /impeccable critique del 17-oct (v10.84.146).
// Cada caso afirma lo que DEBERÍA ver Karla o Dirección: una FALLA es un bug. Vuelta 1: escritas antes del arreglo. Reloj fijo: 16-oct-2026.
// En el banco, facturas: F-1 a F-4, F-5 falta (hueco de verdad), F-6 sólo en la cartera de CobranzaFlow, F-7 en dos órdenes sin OC (duplicado), F-8
// compartido por la OC-0900, F-9 cancelada; C-3 (otra serie con un número que también existe en la F-: no es duplicado); D-6190 y D-6192 de Alpha con
// D-6191 cancelada en la cartera. Remisiones RS-1 a RS-3. Órdenes P-0601 a P-0615 con P-0603 faltante.
// Uso: node auditoria.mjs <dir-capturas> [puerto=5487]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5487);
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
  page.on("console", m => { if (m.type() === "error" && !deFuera(m) && !/list_consecutive|AuditoriaView/.test(m.text())) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.clock.setFixedTime(AHORA);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.getByRole("heading", { name: /Auditoría/ }).first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
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
const pestanaOrdenes = p => p.getByRole("button", { name: /^\s*Órdenes de [Pp]roducción/ }).first();
const buscar = async (p, q) => { const i = p.locator('input[placeholder*="Buscar"]').first(); await i.fill(q); await espera(p, 300); };
const tabHasta = async (p, quiere, max = 140) => {
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
// la clave se comparte entre las dos pestañas: sólo se abre si está cerrada (la primera versión la cerraba con el segundo clic y no veía la de órdenes)
const abrirClave = async p => {
  const b = p.getByRole("button", { name: /Qué significa/i }).first(); if (!(await b.count())) return;
  const exp = await b.getAttribute("aria-expanded"); if (exp === "true") return;
  if (exp === null && /Contabilizado|número de producción borrado|FALTANTE ·/.test(await texto(p))) return;
  await b.click(); await espera(p);
};

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("aud-01-duplicados-de-verdad", "", async p => {
  const t = await texto(p), m = (t.match(/Duplicados\s*(\d+)/) || t.match(/(\d+)\s*duplicados?/i) || [])[1];
  ok("aud-01-duplicados-de-verdad", m === "1", `los duplicados: ${m ?? "no dice"} (debe 1, F-7; F-3 y C-3 son de series distintas: cada una con su consecutivo)`);
});
await caso("aud-02-los-huecos-de-verdad", "", async p => {
  await espera(p, 400);
  const t = await texto(p), m = (t.match(/(?:Gaps detectados|Huecos)\s*(\d+)/) || t.match(/(\d+)\s*huecos?/i) || [])[1];
  ok("aud-02-los-huecos-de-verdad", m === "1" && /F-5/.test(t), `los huecos: ${m ?? "no dice"} (debe 1, F-5; F-6 está en la cartera y D-6191 se canceló allá); ${/F-5/.test(t) ? "F-5 a la vista" : "F-5 NO se ve"}`);
});
await caso("aud-03-buscar-una-orden-como-se-escribe", "", async p => {
  await pestanaOrdenes(p).click(); await espera(p);
  await buscar(p, "P-0603"); const t1 = await texto(p);
  await buscar(p, "P-0602"); const t2 = await texto(p);
  ok("aud-03-buscar-una-orden-como-se-escribe", /P-0603/.test(t1) && !/Sin resultados/.test(t1) && /CLIENTE P-0602/.test(t2), `en la pestaña de órdenes, buscar «P-0603» (el hueco): ${/Sin resultados/.test(t1) ? "«Sin resultados»" : /P-0603/.test(t1) ? "lo encuentra" : "no lo encuentra"}; buscar «P-0602»: ${/CLIENTE P-0602/.test(t2) ? "la encuentra" : "NO la encuentra"}`);
});
await caso("aud-04-los-folios-p-con-sus-ceros", "", async p => {
  await pestanaOrdenes(p).click(); await espera(p);
  const t = await texto(p);
  ok("aud-04-los-folios-p-con-sus-ceros", /P-0603/.test(t) && /P-0601 → P-0615|P-0601 a P-0615|de P-0601 a P-0615/.test(t) && !/P-603\b|P-601\b/.test(t), `el hueco y el rango: ${(t.match(/P-0?603/) || ["no dice el hueco"])[0]}; ${(t.match(/P-0?601.{0,6}P-0?615/) || ["no dice el rango"])[0]} (los folios se escriben P-0603)`);
});
await caso("aud-05-el-folio-abre-su-orden-con-el-teclado", "", async p => {
  const t = await tabHasta(p, x => /F-1\b/.test(x) && /PRIMERA/.test(x));
  if (t) await p.keyboard.press("Enter");
  await espera(p, 400);
  const d = p.getByRole("dialog"); const hay = await d.count(), dt = hay ? ((await d.first().innerText()) || "").replace(/\s+/g, " ") : "";
  ok("aud-05-el-folio-abre-su-orden-con-el-teclado", !!t && hay > 0 && /P-0601/.test(dt), `con Tab ${t ? "se llega a F-1" : "NO se llega a F-1"}; Enter ${hay ? "abre «" + dt.slice(0, 50) + "»" : "no abre un diálogo"}`);
});
await caso("aud-06-los-compartidos-con-el-teclado", "", async p => {
  const t = await tabHasta(p, x => /Compartidos/.test(x));
  if (t) await p.keyboard.press("Enter");
  await espera(p, 400);
  const d = p.getByRole("dialog", { name: /compartidos/i }); const hay = await d.count();
  ok("aud-06-los-compartidos-con-el-teclado", !!t && hay > 0, `con Tab ${t ? "se llega a «Compartidos»" : "NO se llega a «Compartidos»"}; Enter ${hay ? "abre los folios compartidos" : "no abre nada"}`);
});
await caso("aud-07-todo-se-lee", "", async p => {
  await espera(p, 400); await abrirClave(p);
  const m1 = await sinAA(p);
  await pestanaOrdenes(p).click(); await espera(p); await abrirClave(p);
  const m = [...new Set([...m1, ...(await sinAA(p))])];
  ok("aud-07-todo-se-lee", m.length === 0, m.length ? m.length + " textos sin AA o de menos de 10 px: " + m.slice(0, 8).join(" | ") : "todo con AA");
});
await caso("aud-08-en-palabras", "", async p => {
  const t1 = await texto(p); await pestanaOrdenes(p).click(); await espera(p); const t = t1 + " " + await texto(p);
  const malas = [/\bgaps?\b/i, /Read-only/i, /Click en/i].filter(r => r.test(t)).map(String);
  ok("aud-08-en-palabras", !malas.length, malas.length ? "dice: " + malas.join(" ") : "en palabras de la oficina («huecos», «sólo lectura»)");
});
await caso("aud-09-la-clave-habla-de-las-series-de-hoy", "", async p => {
  await abrirClave(p); const t1 = await texto(p);
  await pestanaOrdenes(p).click(); await espera(p); await abrirClave(p); const t2 = await texto(p);
  const malas = [];
  if (/facturada directo en Alpha/.test(t1)) malas.push("«EN COBRANZAFLOW: facturada directo en Alpha» (la F- la timbra SYGMA desde el 1-sep)");
  if (/compáralo contra AlphaERP\.?(?! o)/.test(t1) && !/CobranzaFlow/.test((t1.match(/auditoría a fondo[^.]*\./) || [""])[0])) malas.push("«compáralo contra AlphaERP» (la serie propia se revisa en CobranzaFlow)");
  if (/Con folio fiscal D-\/R-/.test(t2)) malas.push("«Con folio fiscal D-/R-»");
  ok("aud-09-la-clave-habla-de-las-series-de-hoy", !malas.length, malas.length ? "la clave dice: " + malas.join("; ") : "habla de F- y RS- y de CobranzaFlow");
});
await caso("aud-10-sin-tarjetas-de-numero-grande", "", async p => {
  const grandes = await p.evaluate(() => [...document.querySelectorAll("#root *")].filter(e => !/^H[1-6]$/.test(e.tagName) && !e.closest("h1,h2,h3") && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) >= 18).map(e => e.textContent.trim().slice(0, 20)));
  ok("aud-10-sin-tarjetas-de-numero-grande", grandes.length === 0, grandes.length ? "cifras de tarjeta (18 px o más): " + grandes.slice(0, 6).join(" | ") : "las cifras en un renglón");
});
await caso("aud-11-sin-la-cartera-no-presume-huecos", "falla=cobranza", async p => {
  await espera(p, 500);
  const t = await texto(p);
  ok("aud-11-sin-la-cartera-no-presume-huecos", /No se pudo conciliar/.test(t) && /Reintentar/.test(t), `la cartera de CobranzaFlow no contesta: ${/No se pudo conciliar/.test(t) ? "lo dice" : "NO lo dice"}${/Reintentar/.test(t) ? " con «Reintentar»" : ""}`);
});
for (const ancho of [1366, 1920]) {
  await caso(`aud-12-cabe-a-${ancho}`, "", async p => {
    await abrirClave(p);
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(`aud-12-cabe-a-${ancho}`, r.sw <= r.cw, `a ${ancho}: ancho de la página ${r.sw} en ${r.cw}`);
  }, { viewport: { width: ancho, height: ancho === 1366 ? 768 : 1080 } });
}
await caso("aud-13-el-duplicado-y-el-compartido-se-distinguen", "", async p => {
  await espera(p, 400);
  const t = await texto(p);
  ok("aud-13-el-duplicado-y-el-compartido-se-distinguen", /DUPLICADA UNO[\s\S]{0,4}|duplicad/i.test(t) && /compartid/i.test(t), `F-7 ${/duplicad/i.test(t) ? "dice duplicado" : "NO dice duplicado"}; F-8 ${/compartid/i.test(t) ? "dice compartido" : "NO dice compartido"}`);
});

// ── vuelta 2: por donde no se diseñó (remisiones, un periodo vacío, buscar por la orden, Esc en el detalle, el histórico, el CSV) ──
await caso("aud-14-las-remisiones", "", async p => {
  await p.getByRole("button", { name: /^\s*Remisiones/ }).first().click(); await espera(p, 500);
  const t = await texto(p), m = await sinAA(p);
  ok("aud-14-las-remisiones", /3 folios/.test(t) && /0 huecos/.test(t) && m.length === 0, `Remisiones: ${(t.match(/\d+ folios?/) || ["?"])[0]}, ${(t.match(/\d+ huecos?/) || ["?"])[0]} (RS-1 a RS-3); ${m.length ? "sin AA: " + m.slice(0, 4).join(" | ") : "todo con AA (el botón activo también)"}`);
});
await caso("aud-15-un-periodo-sin-folios", "", async p => {
  await p.locator("select").first().selectOption("lm"); await espera(p, 600);
  const t = await texto(p);
  ok("aud-15-un-periodo-sin-folios", /Sin folios en este periodo/.test(t), `«Mes pasado» (septiembre, sin facturas en el banco): ${/Sin folios en este periodo/.test(t) ? "lo dice" : "«" + t.slice(0, 120) + "»"}`);
});
await caso("aud-16-buscar-un-folio-por-su-orden", "", async p => {
  await buscar(p, "P-0606"); const t = await texto(p);
  ok("aud-16-buscar-un-folio-por-su-orden", /DUPLICADA UNO/.test(t) && !/PRIMERA/.test(t), `buscar «P-0606» en los folios: ${/DUPLICADA UNO/.test(t) ? "encuentra F-7 (su orden)" : "NO encuentra su folio"}${/PRIMERA/.test(t) ? ", y deja otros" : ""}`);
});
await caso("aud-17-esc-cierra-el-detalle-y-regresa-a-la-fila", "", async p => {
  const t = await tabHasta(p, x => /F-1\b/.test(x) && /PRIMERA/.test(x));
  if (t) { await p.keyboard.press("Enter"); await espera(p, 400); }
  const abierto = await p.getByRole("dialog").count();
  await p.keyboard.press("Escape"); await espera(p, 400);
  const cerrado = (await p.getByRole("dialog").count()) === 0;
  const foco = await p.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? (a.getAttribute("aria-label") || a.innerText || "").slice(0, 50) : "(se perdió)"; });
  ok("aud-17-esc-cierra-el-detalle-y-regresa-a-la-fila", !!t && abierto > 0 && cerrado && /F-1\b/.test(foco), `Enter en F-1 ${abierto ? "abre" : "NO abre"} el detalle; Esc ${cerrado ? "lo cierra" : "NO lo cierra"}; el foco queda en: ${foco}`);
});
await caso("aud-18-el-historico-con-el-teclado", "", async p => {
  await pestanaOrdenes(p).click(); await espera(p);
  const t = await tabHasta(p, x => /Histórico de producción/.test(x));
  if (t) { await p.keyboard.press("Enter"); await espera(p, 300); }
  const exp = await p.evaluate(() => document.activeElement?.getAttribute("aria-expanded")), txt = await texto(p);
  ok("aud-18-el-historico-con-el-teclado", !!t && exp === "true" && /H-0591/.test(txt), `con Tab ${t ? "se llega al histórico" : "NO se llega al histórico"}; Enter: aria-expanded ${exp}; el hueco ${/H-0591/.test(txt) ? "«H-0591»" : (txt.match(/H-0?591/) || ["no sale"])[0]}`);
});
await caso("aud-19-el-csv-dice-hueco", "", async p => {
  await espera(p, 500);
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 6000 }), p.getByRole("button", { name: /Exportar CSV/ }).click()]);
  const ruta = await dl.path(), c = ruta ? fs.readFileSync(ruta, "utf8") : "";
  ok("aud-19-el-csv-dice-hueco", /"F-5","HUECO"/.test(c) && !/"GAP"/.test(c), `el CSV: ${/"F-5","HUECO"/.test(c) ? "F-5 como HUECO" : /"F-5","GAP"/.test(c) ? "F-5 como «GAP»" : "sin el renglón de F-5"}`);
});

// ── vuelta 3: el detalle que se abre se lleva el foco y el Tab no se sale ──
await caso("aud-20-el-detalle-se-lleva-el-foco", "", async p => {
  const t = await tabHasta(p, x => /F-1\b/.test(x) && /PRIMERA/.test(x));
  if (t) { await p.keyboard.press("Enter"); await espera(p, 400); }
  const dentro = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  let salio = false;
  for (let i = 0; i < 12; i++) { await p.keyboard.press("Tab"); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) { salio = true; break; } }
  ok("aud-20-el-detalle-se-lleva-el-foco", !!t && dentro && !salio, `al abrir el detalle de F-1 el foco ${dentro ? "entra al diálogo" : "se queda en la fila de atrás"}; con Tab ${salio ? "se sale a la página de atrás" : "no se sale"}`);
});

// ── vuelta 4 (la última): lo mismo en la ventana de los compartidos, y Esc regresa a donde estaba ──
await caso("aud-21-los-compartidos-se-llevan-el-foco-y-lo-regresan", "", async p => {
  const t = await tabHasta(p, x => /Compartidos/.test(x));
  if (t) { await p.keyboard.press("Enter"); await espera(p, 400); }
  const dentro = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  let salio = false;
  for (let i = 0; i < 10; i++) { await p.keyboard.press("Tab"); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) { salio = true; break; } }
  await p.keyboard.press("Escape"); await espera(p, 400);
  const foco = await p.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? (a.getAttribute("aria-label") || a.innerText || "").slice(0, 40) : "(se perdió)"; });
  ok("aud-21-los-compartidos-se-llevan-el-foco-y-lo-regresan", !!t && dentro && !salio && /Compartidos|ver cuáles/i.test(foco), `el foco ${dentro ? "entra" : "NO entra"} a los compartidos; el Tab ${salio ? "se sale" : "no se sale"}; tras Esc queda en: ${foco}`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nauditoria: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
