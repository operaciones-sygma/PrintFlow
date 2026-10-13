// Tratar de ROMPER el «Plan matriz» de una OC como usuario (banco tests/banco/gen-plan.mjs). Cada caso afirma lo que DEBERÍA pasar:
// una FALLA es un bug. v10.84.89 — Karla (13-oct): «que la OC funcione como facturar por partes: ya hay una factura, ligarla, y
// escribir el folio». El caso de verdad: OC-0960 de PORTLAND LEATHER (P-0592 a P-0595, 80,000 stickers cada uno) y F-143 y F-155,
// hechas sin orden, que cubren cada una un pedazo de los cuatro (F-143: 4,380 + 3,528 + 7,395 + 5,520 piezas; F-155: el resto).
// Uso: node tests/romper/plan.mjs <dir-capturas> [puerto=5190]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5190);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }

async function caso(nombre, query, fn, viewport = { width: 1366, height: 768 }) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#abrir-plan");
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.close();
}
const log = async p => (await p.textContent("#log")) || "";
const cuenta = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref)).length;
const ve = async (p, t) => { const l = p.getByText(t); return (await l.count()) > 0 && await l.first().isVisible(); };
const espera = (p, ms = 250) => p.waitForTimeout(ms);
async function abrir(p) { await p.click("#abrir-plan"); await p.getByText(/Plan matriz de facturación/).first().waitFor(); await espera(p, 400); }
// la columna i (0 = la primera factura): su encabezado, sus celdas y su suma
const encabezado = (p, i) => p.locator("thead th").nth(i + 1);
const celda = (p, fila, i) => p.locator("tbody tr").nth(fila).locator("td").nth(i + 1).locator("input");
const suma = (p, i) => p.locator("tfoot td").nth(i + 1);
const ligar = async (p, i, folio) => {
  await encabezado(p, i).getByRole("button", { name: /Ya tiene factura: ligarla/ }).click(); await espera(p, 150);
  if (folio != null) { await p.getByLabel(`Folio de la factura ${i + 1} que ya existe`).fill(folio); await espera(p, 200); }
};
const piezas = async (p, i, qs) => { for (let f = 0; f < qs.length; f++) { await celda(p, f, i).fill(String(qs[f])); } await espera(p, 200); };
const F143 = [4380, 3528, 7395, 5520], F155 = [75620, 76472, 72605, 74480];
const enviar = p => p.getByRole("button", { name: /^(Ligar|Crear) \d+/ }).last();
const planEnviado = async p => { const l = (await log(p)).split("\n").filter(x => x.startsWith("plan:confirm ")).pop(); return l ? JSON.parse(l.slice("plan:confirm ".length)) : null; };
// («1 error:» con uno, «N errores:» con varios: la vuelta 2 encontró que el patrón de antes no veía el de uno)
const errores = async p => { const l = p.getByText(/\d+ error(es)?:/); return (await l.count()) ? (await l.first().locator("xpath=..").textContent()) : ""; };

// ───────────── v10.84.89 — vuelta 1: escritas ANTES del cambio, contra v10.84.88
await caso("pl-01 cada factura del plan ofrece ligar", "", async p => {
  await abrir(p);
  const n = await p.getByRole("button", { name: /Ya tiene factura: ligarla/ }).count();
  ok("pl-01 cada factura del plan ofrece «Ya tiene factura: ligarla»", n === 2, `${n} de 2 columnas`);
});
await caso("pl-02 ligar F-143", "", async p => {
  await abrir(p); await ligar(p, 0, " f-143 ");
  const t = (await encabezado(p, 0).textContent()) || "";
  ok("pl-02 al escribir el folio dice cuál factura es (importe y fecha) aunque venga en minúsculas y con espacios", /F-143/.test(t) && /3,066\.78/.test(t) && /0?6.oct/i.test(t), t.replace(/\s+/g, " ").slice(0, 200));
});
await caso("pl-03 folio que no es del cliente", "", async p => {
  await abrir(p); await ligar(p, 0, "F-999"); await piezas(p, 0, F143);
  const t = (await encabezado(p, 0).textContent()) || "";
  ok("pl-03 un folio que no es una factura sin orden del cliente lo dice y no deja", /no es una factura sin orden de PORTLAND LEATHER/i.test(t) && await enviar(p).isDisabled(), t.replace(/\s+/g, " ").slice(0, 200));
});
await caso("pl-04 OC-0960 con F-143 y F-155", "", async p => {
  await abrir(p);
  await ligar(p, 0, "F-143"); await piezas(p, 0, F143);
  const s1 = (await suma(p, 0).textContent()) || "";
  await ligar(p, 1, "F-155");
  await encabezado(p, 1).getByRole("button", { name: /lo que falta/i }).click(); await espera(p, 200);
  const s2 = (await suma(p, 1).textContent()) || "";
  const boton = (await enviar(p).textContent()) || "";
  await enviar(p).click(); await espera(p, 500);
  const plan = await planEnviado(p);
  const g = plan?.groups || [];
  const lin = k => (g[k]?.lines || []).map(l => l.qty + ":" + l.amount).join(",");
  const esperado0 = "4380:613.2,3528:388.08,7395:1035.3,5520:607.2", esperado1 = "75620:10586.8,76472:8411.92,72605:10164.7,74480:8192.8";
  ok("pl-04 OC-0960: F-143 y F-155 cuadran y se mandan ligadas, con las piezas y el dinero exactos",
    /cuadra/i.test(s1) && /cuadra/i.test(s2) && /Ligar 2 facturas/.test(boton) && g.length === 2
    && g[0].ligar === true && g[0].folio === "F-143" && g[0].doc_type === "factura" && !g[0].pre_assigned && !g[0].bill_to && lin(0) === esperado0
    && g[1].ligar === true && g[1].folio === "F-155" && lin(1) === esperado1,
    `suma1 «${s1.replace(/\s+/g, " ").trim()}» · suma2 «${s2.replace(/\s+/g, " ").trim()}» · botón «${boton.trim()}» · ${JSON.stringify(g.map(x => ({ ligar: x.ligar, folio: x.folio, lines: x.lines?.length })))} · 0=${lin(0)} · 1=${lin(1)}`);
});
await caso("pl-05 ligada que no cuadra", "", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, [4380, 0, 0, 0]);
  const e = await errores(p);
  ok("pl-05 una factura ligada que no suma su importe lo dice (cuánto falta) y no deja", /F-143/.test(e) && /3,066\.78/.test(e) && await enviar(p).isDisabled(), e.replace(/\s+/g, " ").slice(0, 220));
});
await caso("pl-06 lo que falta", "", async p => {
  await abrir(p); await piezas(p, 0, F143);
  await encabezado(p, 1).getByRole("button", { name: /lo que falta/i }).click(); await espera(p, 200);
  const v = []; for (let f = 0; f < 4; f++) v.push(Number(await celda(p, f, 1).inputValue()));
  ok("pl-06 «Lo que falta» llena la factura con las piezas que quedan de cada orden", JSON.stringify(v) === JSON.stringify(F155), JSON.stringify(v));
});
await caso("pl-07 el mismo folio dos veces", "", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143); await ligar(p, 1, "F-143"); await piezas(p, 1, F143.map(() => 1));
  const e = await errores(p);
  ok("pl-07 el mismo folio en dos facturas lo dice y no deja", /F-143/.test(e) && /dos|repetid|duplicad/i.test(e) && await enviar(p).isDisabled(), e.replace(/\s+/g, " ").slice(0, 200));
});
await caso("pl-08 la ligada sin tercero ni pre-asignada", "", async p => {
  await abrir(p); await ligar(p, 0, "F-143");
  const h = encabezado(p, 0);
  const tercero = await h.getByText(/Facturar a tercero/).count(), pre = await h.getByText(/Pre-asignada/).count();
  ok("pl-08 la factura ligada no ofrece «Facturar a tercero» ni «Pre-asignada» (ya está hecha)", tercero === 0 && pre === 0, `tercero ${tercero} · pre ${pre}`);
});
await caso("pl-09 la lectura falla", "ligables=falla", async p => {
  await abrir(p); await ligar(p, 0, "F-143");
  const t1 = (await encabezado(p, 0).textContent()) || "";
  const dice = /No se pudieron leer las facturas sin orden/i.test(t1), bloquea = await enviar(p).isDisabled();
  await encabezado(p, 0).getByRole("button", { name: /Reintentar/ }).click(); await espera(p, 400);
  const t2 = (await encabezado(p, 0).textContent()) || "";
  ok("pl-09 si no se pudieron leer las facturas sin orden lo dice, no deja, y «Reintentar» las lee", dice && bloquea && /3,066\.78/.test(t2), `antes «${t1.replace(/\s+/g, " ").slice(0, 120)}» · después «${t2.replace(/\s+/g, " ").slice(0, 120)}»`);
});
await caso("pl-10 la lectura tarda", "ligables=lento", async p => {
  await p.click("#abrir-plan"); await espera(p, 300); await ligar(p, 0, "F-143"); await piezas(p, 0, F143);
  const t = (await encabezado(p, 0).textContent()) || "";
  const leyendo = /Leyendo/i.test(t), bloquea = await enviar(p).isDisabled();
  await espera(p, 2600);
  const t2 = (await encabezado(p, 0).textContent()) || "";
  ok("pl-10 mientras lee las facturas sin orden lo dice y no deja; al llegar, la reconoce", leyendo && bloquea && /3,066\.78/.test(t2), `«${t.replace(/\s+/g, " ").slice(0, 100)}» → «${t2.replace(/\s+/g, " ").slice(0, 100)}»`);
});
await caso("pl-11 sin emisor", "emisor=off", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143);
  await ligar(p, 1, "F-155"); await encabezado(p, 1).getByRole("button", { name: /lo que falta/i }).click(); await espera(p, 200);
  const e = await errores(p);
  await enviar(p).click(); await espera(p, 500);
  const g = (await planEnviado(p))?.groups || [];
  ok("pl-11 sin el emisor también liga (F- no choca con la serie D- de los folios nuevos)", !e && g[0]?.ligar === true && g[0]?.folio === "F-143", e.replace(/\s+/g, " ").slice(0, 160) + " · " + JSON.stringify(g.map(x => x.folio)));
});
await caso("pl-12 mejor que se asigne solo", "", async p => {
  await abrir(p); await ligar(p, 0, "F-143");
  await encabezado(p, 0).getByRole("button", { name: /mejor que se asigne solo/i }).click(); await espera(p, 200);
  // (vuelta 1: la prueba capturaba justo las piezas de F-143 como factura NUEVA, y eso es lo que el candado del anticipo frena: otras)
  await piezas(p, 0, [1000, 1000, 1000, 1000]); await encabezado(p, 1).getByRole("button", { name: /lo que falta/i }).click(); await espera(p, 200);
  await enviar(p).click(); await espera(p, 500);
  const g = (await planEnviado(p))?.groups || [];
  ok("pl-12 «mejor que se asigne solo» la regresa a factura nueva (sin ligar ni folio escrito)", g.length === 2 && !g[0].ligar && !(g[0].folio || "").startsWith("F-143"), JSON.stringify(g.map(x => ({ ligar: !!x.ligar, folio: x.folio }))));
});
await caso("pl-13 ligar una remisión", "", async p => {
  await abrir(p); await ligar(p, 0, "RS-31"); await piezas(p, 0, [10000, 0, 0, 0]);
  const tipo = await encabezado(p, 0).locator("select").inputValue();
  const s = (await suma(p, 0).textContent()) || "";
  await piezas(p, 1, [70000, 80000, 80000, 80000]);
  await enviar(p).click(); await espera(p, 500);
  const g = (await planEnviado(p))?.groups || [];
  ok("pl-13 RS-31 (remisión) cambia la factura a remisión y cuadra sin IVA ($1,400)", tipo === "remision" && /cuadra/i.test(s) && g[0]?.doc_type === "remision" && g[0]?.ligar === true && g[0]?.lines?.[0]?.amount === 1400,
    `tipo ${tipo} · suma «${s.replace(/\s+/g, " ").trim()}» · ${JSON.stringify(g[0] || null).slice(0, 160)}`);
});
await caso("pl-14 sin series retiradas", "", async p => {
  await abrir(p);
  const opciones = (await encabezado(p, 0).locator("select option").allTextContents()).join(" | ");
  ok("pl-14 el tipo no nombra la serie de Alpha («Factura D-», «Remisión R-»)", !/\b[DR]-/.test(opciones), opciones);
});
await caso("pl-15 el candado del anticipo", "", async p => {
  await abrir(p); await piezas(p, 0, F143); await piezas(p, 1, F155);
  const e = await errores(p);
  const hay = /F-143/.test(e) && /3,066\.78/.test(e);
  const btn = p.getByRole("button", { name: /Ligar F-143/ });
  let ligo = false;
  if (await btn.count()) { await btn.first().click(); await espera(p, 400); ligo = /3,066\.78/.test((await encabezado(p, 0).textContent()) || "") && !!(await p.getByLabel("Folio de la factura 1 que ya existe").count()); }
  ok("pl-15 una factura NUEVA por justo el importe de una sin orden del cliente lo dice y ofrece ligarla", hay && await enviar(p).isDisabled() && ligo, e.replace(/\s+/g, " ").slice(0, 200));
});
await caso("pl-16 doble clic", "", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143);
  await ligar(p, 1, "F-155"); await encabezado(p, 1).getByRole("button", { name: /lo que falta/i }).click(); await espera(p, 200);
  await enviar(p).dblclick(); await espera(p, 600);
  ok("pl-16 doble clic en «Ligar 2 facturas»: un solo envío", await cuenta(p, "plan:confirm") === 1, `${await cuenta(p, "plan:confirm")} envíos`);
});
await caso("pl-17 la base rechaza", "conf=falla", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143);
  await ligar(p, 1, "F-155"); await encabezado(p, 1).getByRole("button", { name: /lo que falta/i }).click(); await espera(p, 200);
  await enviar(p).click(); await espera(p, 600);
  const sigue = await p.getByText(/Plan matriz de facturación/).count();
  const folio = sigue ? await p.getByLabel("Folio de la factura 1 que ya existe").inputValue().catch(() => "") : "";
  const q = sigue ? await celda(p, 0, 0).inputValue() : "";
  ok("pl-17 si la base rechaza, la ventana se queda con lo capturado (la ligada sigue ligada)", sigue > 0 && folio === "F-143" && q === "4380", `abierta ${sigue} · folio «${folio}» · ${q}`);
});
await caso("pl-18 el borrador conserva la ligada", "", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143); await espera(p, 900);
  await p.reload(); await p.waitForSelector("#abrir-plan"); await abrir(p); await espera(p, 300);
  const folio = await p.getByLabel("Folio de la factura 1 que ya existe").inputValue().catch(() => "");
  ok("pl-18 al retomar el borrador, la factura ligada sigue ligada (no se vuelve una factura nueva con ese folio)", folio === "F-143", `folio «${folio}» · ${(await log(p)).split("\n").filter(l => l.startsWith("confirm")).join(" / ")}`);
});
await caso("pl-19 la sugerencia no se cuela", "emisor=off", async p => {
  await abrir(p); await ligar(p, 0, null);
  const v1 = await p.getByLabel("Folio de la factura 1 que ya existe").inputValue().catch(() => "?");
  await p.locator("input[type=number][max='10']").fill("3"); await espera(p, 300);
  const v2 = await p.getByLabel("Folio de la factura 1 que ya existe").inputValue().catch(() => "?");
  ok("pl-19 el folio sugerido del contador no se cuela en el de ligar (ni al cambiar cuántas facturas)", v1 === "" && v2 === "", `«${v1}» → «${v2}»`);
});
await caso("pl-20 Esc con una ligada", "confirmar=no", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await p.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await p.keyboard.press("Escape"); await espera(p, 300);
  ok("pl-20 Esc con una factura ligada capturada pregunta (y con «no» se queda)", await p.getByText(/Plan matriz de facturación/).count() > 0 && (await log(p)).includes("confirm:"), (await log(p)).split("\n").slice(-2).join(" / "));
});

// ───────────── vuelta 2: por donde no se diseñó
await caso("pl-21 el candado en la segunda", "", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143);
  await encabezado(p, 1).getByRole("button", { name: /lo que falta/i }).click(); await espera(p, 300);
  const e = await errores(p);
  const btn = p.getByRole("button", { name: /Ligar F-155 a la factura 2/ });
  const ofrece = await btn.count() > 0;
  if (ofrece) { await btn.first().click(); await espera(p, 400); }
  const boton = (await enviar(p).textContent()) || "";
  await enviar(p).click().catch(() => {}); await espera(p, 500);
  const g = (await planEnviado(p))?.groups || [];
  ok("pl-21 con F-143 ligada, «Lo que falta» en la segunda sale justo por F-155: lo dice, ofrece ligarla y con un clic queda «Ligar 2 facturas»",
    /F-155/.test(e) && ofrece && /Ligar 2 facturas/.test(boton) && g[1]?.ligar === true && g[1]?.folio === "F-155", e.replace(/\s+/g, " ").slice(0, 160) + " · " + boton.trim());
});
await caso("pl-22 tercero y luego ligar", "", async p => {
  await abrir(p);
  await encabezado(p, 0).getByRole("button", { name: /Facturar a tercero/ }).click(); await espera(p, 200);
  await p.click("#tercero-listo"); await p.getByRole("button", { name: "Guardar tercero" }).click(); await espera(p, 200);
  await ligar(p, 0, "F-143"); await piezas(p, 0, F143);
  await ligar(p, 1, "F-155"); await encabezado(p, 1).getByRole("button", { name: /lo que falta/i }).click(); await espera(p, 200);
  await enviar(p).click(); await espera(p, 500);
  const g = (await planEnviado(p))?.groups || [];
  ok("pl-22 una columna con tercero que luego se liga se manda sin tercero (la factura ya tiene su cliente)", g[0]?.ligar === true && g[0]?.bill_to === null, JSON.stringify(g[0] || null).slice(0, 160));
});
await caso("pl-23 las sugerencias de folio", "", async p => {
  await abrir(p); await ligar(p, 0, "");
  const t = (await encabezado(p, 0).textContent()) || "";
  await encabezado(p, 0).getByRole("button", { name: "F-155" }).click(); await espera(p, 300);
  const t2 = (await encabezado(p, 0).textContent()) || "";
  ok("pl-23 sin folio escrito enseña las facturas sin orden del cliente, y un clic en una la pone", /F-143/.test(t) && /F-155/.test(t) && /43,333\.22/.test(t2) && await p.getByLabel("Folio de la factura 1 que ya existe").inputValue() === "F-155", t.replace(/\s+/g, " ").slice(0, 160));
});
await caso("pl-24 la que liga una ya no se ofrece en otra", "", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await ligar(p, 1, "");
  const t = (await encabezado(p, 1).textContent()) || "";
  ok("pl-24 la factura que ya liga otra columna no se ofrece en las sugerencias de la siguiente", !/F-143/.test(t) && /F-155/.test(t), t.replace(/\s+/g, " ").slice(0, 160));
});
await caso("pl-25 sin facturas sin orden", "ligables=vacio", async p => {
  await abrir(p); await ligar(p, 0, "");
  const t = (await encabezado(p, 0).textContent()) || "";
  ok("pl-25 si el cliente no tiene facturas sin orden, lo dice en la columna", /no tiene facturas sin orden/i.test(t), t.replace(/\s+/g, " ").slice(0, 160));
});
await caso("pl-26 1920", "", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok("pl-26 a 1920 la columna ligada cabe sin desbordar la página", ancho && /CUADRA/i.test((await suma(p, 0).textContent()) || ""));
}, { width: 1920, height: 1080 });

// ───────────── la vista del plan ya creado y cancelar
await caso("pv-01 se ve cuál está ligada", "vista=1", async p => {
  const t = (await p.locator("body").textContent()) || "";
  ok("pv-01 la factura ligada se ve como ligada (ya existía), la creada no", /F-143[\s\S]{0,80}(ligada|ya exist)/i.test(t) && !/F-157[\s\S]{0,40}(ligada|ya exist)/i.test(t), t.replace(/\s+/g, " ").slice(0, 200));
});
await caso("pv-02 la ligada sin cancelar renglón", "vista=1", async p => {
  const tablas = p.locator("table");
  const enLigada = await tablas.nth(0).getByRole("button", { name: /Cancelar/ }).count(), enNormal = await tablas.nth(1).getByRole("button", { name: /Cancelar/ }).count();
  ok("pv-02 a la factura ligada no se le cancela un renglón (sí a la creada por el plan)", enLigada === 0 && enNormal === 2, `ligada ${enLigada} · creada ${enNormal}`);
});
await caso("pv-03 pagada", "vista=1", async p => {
  ok("pv-03 la factura pagada dice PAGADA (payment_status «paid»)", await ve(p, /PAGADA/));
});
await caso("pv-04 karla no cancela", "vista=1&rol=karla", async p => {
  ok("pv-04 Karla ve el plan sin botones de cancelar (sólo Dirección)", await p.getByRole("button", { name: /Cancelar/ }).count() === 0);
});
await caso("pv-05 cancelar la ligada", "cancelar=ligada", async p => {
  await espera(p, 300);
  const t = ((await p.getByRole("dialog").first().textContent()) || "").replace(/\s+/g, " ");
  ok("pv-05 cancelar la factura ligada dice que se desliga (vuelve a estar sin orden) y NO que se cancela en CobranzaFlow",
    /desliga|sin orden|esperando orden/i.test(t) && !/se cancela en CobranzaFlow/i.test(t), t.slice(0, 260));
});
await caso("pv-06 cancelar la creada", "cancelar=normal", async p => {
  await espera(p, 300);
  const t = ((await p.getByRole("dialog").first().textContent()) || "").replace(/\s+/g, " ");
  ok("pv-06 cancelar la creada por el plan sigue diciendo que se cancela en CobranzaFlow", /se cancela en CobranzaFlow/i.test(t), t.slice(0, 200));
});
await caso("pv-07 renglón de la ligada", "cancelar=linea", async p => {
  await espera(p, 300);
  const d = p.getByRole("dialog").first();
  const t = ((await d.textContent()) || "").replace(/\s+/g, " ");
  const boton = d.getByRole("button", { name: /^Cancelar la línea/ });
  const desactivado = (await boton.count()) === 0 || await boton.first().isDisabled() || (await boton.first().getAttribute("aria-disabled")) === "true";
  ok("pv-07 un renglón de la factura ligada no se cancela: lo dice y no deja", /ya exist|ligad/i.test(t) && desactivado, t.slice(0, 220));
});

for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nplan: ${res.length - fallan} pasan, ${fallan} fallan`);
await browser.close();
process.exitCode = fallan ? 1 : 0;
