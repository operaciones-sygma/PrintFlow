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
  await encabezado(p, i).getByRole("button", { name: /^(Ya tiene factura: ligarla|Ya existe)$/ }).click(); await espera(p, 150);   // (v10.84.100: «Ya existe»)
  if (folio != null) { await p.getByLabel(`Folio de la factura ${i + 1} que ya existe`).fill(folio); await espera(p, 200); }
};
const piezas = async (p, i, qs) => { for (let f = 0; f < qs.length; f++) { await celda(p, f, i).fill(String(qs[f])); } await espera(p, 200); };
const F143 = [4380, 3528, 7395, 5520], F155 = [75620, 76472, 72605, 74480];
// (v10.84.100: el botón dice «Revisar: crear…» y abre la vista previa; click y dblclick confirman en ella si sale, así sirven a las dos versiones)
const botonEnviar = p => p.getByRole("button", { name: /^(Revisar: )?(Ligar|Crear|ligar|crear) \d+/ }).last();
const vista = p => p.getByRole("dialog", { name: /^¿(Crear|Ligar)/ });
const confirmarVista = async (p, doble = false) => { if (!(await vista(p).count().catch(() => 0))) return; const b = vista(p).getByRole("button", { name: /^(Crear|Ligar) \d+/ }); if (doble) await b.dblclick(); else await b.click(); };
const enviar = p => { const b = botonEnviar(p); return { isDisabled: () => b.isDisabled(), isEnabled: () => b.isEnabled(), textContent: () => b.textContent(), innerText: () => b.innerText(),
  scrollIntoViewIfNeeded: () => b.scrollIntoViewIfNeeded(), click: async o => { await b.click(o); await espera(p, 250); await confirmarVista(p); },
  dblclick: async () => { await b.dblclick(); await espera(p, 250); await confirmarVista(p, true); } }; };
const planEnviado = async p => { const l = (await log(p)).split("\n").filter(x => x.startsWith("plan:confirm ")).pop(); return l ? JSON.parse(l.slice("plan:confirm ".length)) : null; };
// («1 error:» con uno, «N errores:» con varios: la vuelta 2 encontró que el patrón de antes no veía el de uno)
const errores = async p => { const l = p.getByText(/\d+ error(es)?:|Faltan? (1 cosa|\d+ cosas) para crear:/); return (await l.count()) ? (await l.first().locator("xpath=..").textContent()) : ""; };   // (v10.84.100: «Faltan N cosas para crear:»)

// ───────────── v10.84.89 — vuelta 1: escritas ANTES del cambio, contra v10.84.88
await caso("pl-01 cada factura del plan ofrece ligar", "", async p => {
  await abrir(p);
  const n = await p.getByRole("button", { name: /^(Ya tiene factura: ligarla|Ya existe)$/ }).count();
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
    /cuadra/i.test(s1) && /cuadra/i.test(s2) && /ligar 2 facturas/i.test(boton) && g.length === 2
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
// v10.84.96 — un error de lectura no es permiso: sin las facturas sin orden, tampoco se crean facturas NUEVAS (antes sólo frenaba ligar).
//   Vuelta 1
await caso("pl-39 sin la lectura no se crean facturas nuevas", "ligables=falla", async p => {
  await abrir(p); await piezas(p, 0, F143); await piezas(p, 1, F155); await espera(p, 300);
  const frena = await enviar(p).isDisabled() && /no pude revisar las facturas sin orden/i.test(await p.evaluate(() => document.body.innerText));
  const casilla = p.getByLabel(/Ya revisé en CobranzaFlow/);
  const hay = await casilla.count();
  if (hay) { await casilla.check(); await espera(p, 300); }
  const sigue = !(await enviar(p).isDisabled());
  ok("pl-39 si no se pudieron leer las facturas sin orden, tampoco deja crear facturas nuevas (dice por qué); con «Ya revisé en CobranzaFlow» sí", frena && hay === 1 && sigue, `frena=${frena} · casilla=${hay} · sigue=${sigue}`);
});
// vuelta 3: la casilla deja crear NUEVAS, pero no ligar: para ligar hay que saber que la factura existe y de cuánto es
await caso("pl-40 la casilla no deja ligar sin la lectura", "ligables=falla", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143); await piezas(p, 1, F155); await espera(p, 300);
  const casilla = p.getByLabel(/Ya revisé en CobranzaFlow/);
  if (await casilla.count()) { await casilla.check(); await espera(p, 300); }
  const frena = await enviar(p).isDisabled();
  ok("pl-40 sin la lectura, «Ya revisé en CobranzaFlow» no deja LIGAR (sólo crear nuevas): ligar sigue frenado", frena, `ligar ${frena ? "frenado" : "PERMITIDO sin saber de la factura"}`);
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
  await encabezado(p, 0).getByRole("button", { name: /^(mejor que se asigne solo|Nueva)$/i }).click(); await espera(p, 200);   // (v10.84.100: «Nueva»)
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
  await p.getByRole("button", { name: "Retomarlo" }).click({ timeout: 1500 }).catch(() => {}); await espera(p, 300);   // (v10.84.98: se ofrece en la ventana)
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
// (v10.84.98: afirmaba el confirm() del navegador —«confirm:» en la bitácora—, que es justo lo que la critique marcó; ahora la pregunta es
//  de la app y con «Seguir capturando» se queda con la ligada)
await caso("pl-20 Esc con una ligada", "confirmar=no", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await p.locator("#plan-matriz-titulo, h3").first().click().catch(() => {});
  await p.keyboard.press("Escape"); await espera(p, 300);
  const pregunta = p.getByRole("dialog", { name: /¿Cerrar el plan/ });
  const hay = await pregunta.count();
  if (hay) { await pregunta.getByRole("button", { name: "Seguir capturando" }).click(); await espera(p, 300); }
  const folio = await p.getByLabel("Folio de la factura 1 que ya existe").inputValue().catch(() => "");
  ok("pl-20 Esc con una factura ligada capturada pregunta LA APP (no el navegador) y con «Seguir capturando» se queda con la ligada",
    hay === 1 && !(await log(p)).includes("confirm:") && folio === "F-143", `pregunta de la app: ${hay} · del navegador: ${(await log(p)).includes("confirm:")} · folio «${folio}»`);
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
    /F-155/.test(e) && ofrece && /ligar 2 facturas/i.test(boton) && g[1]?.ligar === true && g[1]?.folio === "F-155", e.replace(/\s+/g, " ").slice(0, 160) + " · " + boton.trim());
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

// ── v10.84.92 — QUIÉN PAGA, a la vista (Marcelo, 13-oct, el caso Hotsson: «el saldo se queda con el cliente que pidió el producto, y que
//   la UI lo deje claro»). El CFDI a otra razón social del mismo cliente se elige en CobranzaFlow («CFDI a nombre de»); «Facturar a
//   tercero» es lo único que cambia quién paga. Vuelta 1: escritas ANTES del cambio.
const textoDe = async loc => ((await loc.first().innerText({ timeout: 1500 }).catch(() => "")) || "").replace(/\s+/g, " ");
await caso("pl-34 el plan dice a cargo de quién queda el saldo y cómo sacar el CFDI a otra razón social", "", async p => {
  await abrir(p);
  const nota = await textoDe(p.locator("[data-quien-paga]"));
  ok("pl-34 el plan dice a cargo de quién queda el saldo y cómo sacar el CFDI a otra razón social",
    /saldo/i.test(nota) && /PORTLAND LEATHER/.test(nota) && /CFDI a nombre de/.test(nota) && /Facturar a tercero/.test(nota), `«${nota.slice(0, 240)}»`);
});
await caso("pl-35 cada factura dice «Saldo: el cliente»; con tercero, el tercero (y el botón «Paga: …»)", "", async p => {
  await abrir(p);
  const s0 = await textoDe(encabezado(p, 0).locator("[data-saldo]"));
  await encabezado(p, 0).getByRole("button", { name: /Facturar a tercero/ }).click(); await espera(p, 200);
  await p.click("#tercero-listo"); await p.getByRole("button", { name: "Guardar tercero" }).click(); await espera(p, 200);
  const s0b = await textoDe(encabezado(p, 0).locator("[data-saldo]"));
  const boton = await encabezado(p, 0).getByRole("button", { name: /Paga: TERCERO SA/ }).count();
  const s1 = await textoDe(encabezado(p, 1).locator("[data-saldo]"));
  ok("pl-35 cada factura dice «Saldo: el cliente»; con tercero, el tercero (y el botón «Paga: …»)",
    /Saldo: PORTLAND LEATHER/.test(s0) && /Saldo: TERCERO SA/.test(s0b) && /tercero/i.test(s0b) && boton === 1 && /Saldo: PORTLAND LEATHER/.test(s1),
    `antes «${s0}» · con tercero «${s0b}» · botón «Paga:» ${boton} · la otra «${s1}»`);
});
await caso("pl-36 la factura ligada también dice a cargo de quién queda", "", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await espera(p, 300);
  const s = await textoDe(encabezado(p, 0).locator("[data-saldo]"));
  ok("pl-36 la factura ligada también dice a cargo de quién queda", /Saldo: PORTLAND LEATHER/.test(s), `«${s}»`);
});
await caso("pl-37 a 1366 la línea del saldo cabe en su columna (no empuja la tabla)", "", async p => {
  await abrir(p);
  const m = await p.evaluate(() => { const e = document.querySelector("thead th [data-saldo]"); if (!e) return null; const th = e.closest("th").getBoundingClientRect(), r = e.getBoundingClientRect();
    return { dentro: r.left >= th.left - 1 && r.right <= th.right + 1, alto: Math.round(r.height) }; });
  ok("pl-37 a 1366 la línea del saldo cabe en su columna (no empuja la tabla)", !!m && m.dentro && m.alto <= 30, JSON.stringify(m));
});

// v10.84.92 — el caso Hotsson tal cual: siete facturas a 1366 (N facturas escrito en la casilla)
await caso("pl-38 siete facturas a 1366 (el caso Hotsson): se ven, dicen su saldo, se llenan y se mandan las 7 sin tercero", "", async p => {
  await abrir(p);
  await p.locator('input[type="number"][max="10"]').first().fill("7"); await espera(p, 400);
  const cols = await p.locator("thead th [data-saldo]").count();
  const saldos = (await p.locator("thead th [data-saldo]").allInnerTexts()).map(t => t.replace(/\s+/g, " "));
  const anchoPagina = await p.evaluate(() => document.documentElement.scrollWidth);
  for (let i = 0; i < 6; i++) await piezas(p, i, [1000, 1000, 1000, 1000]);
  await encabezado(p, 6).getByRole("button", { name: /lo que falta/i }).click(); await espera(p, 300);
  const b = enviar(p); const textoBoton = await b.innerText().catch(() => "");
  await b.scrollIntoViewIfNeeded().catch(() => {});
  const habilitado = await b.isEnabled().catch(() => false);
  if (habilitado) { await b.click(); await espera(p, 600); }
  const g = (await planEnviado(p))?.groups || [];
  ok("pl-38 siete facturas a 1366 (el caso Hotsson): se ven, dicen su saldo, se llenan y se mandan las 7 sin tercero",
    cols === 7 && saldos.every(t => /Saldo: PORTLAND LEATHER/.test(t)) && anchoPagina <= 1366 && habilitado && g.length === 7 && g.every(x => x.bill_to === null),
    `columnas ${cols} · saldos ${saldos.length} · ancho de la página ${anchoPagina} · botón «${textoBoton}» ${habilitado ? "habilitado" : "APAGADO"} · mandó ${g.length} (${g.map(x => x.bill_to === null ? "sin tercero" : "CON tercero").join(", ")}) · errores «${(await errores(p)).slice(0, 160)}»`);
});

// ───────────── v10.84.98 — el plan, una ventana de la app (la critique del flujo de facturas de Karla, 13-oct, P1: «fuera del sistema de
//   diálogos»: confirm()/alert() del navegador, Esc con un listener propio, el Tab se salía). Vuelta 1: escritas ANTES del cambio.
const preguntaCerrar = p => p.getByRole("dialog", { name: /¿Cerrar el plan/ });
const fuera = async p => { await p.locator("#plan-matriz-titulo, h3").first().click().catch(() => {}); };   // el foco fuera de los campos (Esc no cuenta en un campo)
await caso("pl-41 el plan es un diálogo", "", async p => {
  await abrir(p);
  const d = p.getByRole("dialog", { name: /Plan matriz de facturación · OC-0960/ });
  const n = await d.count(), modal = n ? await d.getAttribute("aria-modal") : null;
  const dentro = await p.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.contains(document.activeElement); });
  ok("pl-41 el plan es un diálogo con nombre (aria-modal) y al abrir el foco entra", n === 1 && modal === "true" && dentro, `diálogos «Plan matriz…» ${n} · aria-modal ${modal} · foco adentro ${dentro}`);
});
await caso("pl-42 Esc con algo capturado: pregunta la app", "", async p => {
  await abrir(p); await piezas(p, 0, [1000]); await fuera(p);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const hay = await preguntaCerrar(p).count(), dice = hay ? ((await preguntaCerrar(p).innerText()) || "").replace(/\s+/g, " ") : "";
  if (hay) { await preguntaCerrar(p).getByRole("button", { name: "Seguir capturando" }).click(); await espera(p, 300); }
  const sigue = await p.getByText(/Plan matriz de facturación/).count() > 0, v = await celda(p, 0, 0).inputValue().catch(() => "");
  ok("pl-42 Esc con una celda capturada: pregunta la app (cuántas celdas, que queda el borrador), no el navegador; «Seguir capturando» se queda con lo capturado",
    hay === 1 && /1 celda capturada/.test(dice) && /borrador/.test(dice) && !(await log(p)).includes("confirm:") && sigue && v === "1000", `pregunta «${dice.slice(0, 140)}» · navegador ${(await log(p)).includes("confirm:")} · sigue ${sigue} · celda «${v}»`);
});
await caso("pl-43 Esc con la pregunta encima cierra la pregunta", "", async p => {
  await abrir(p); await piezas(p, 0, [1000]); await fuera(p);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const hay = await preguntaCerrar(p).count();
  await p.keyboard.press("Escape"); await espera(p, 300);
  const pregunta = await preguntaCerrar(p).count(), sigue = await p.getByText(/Plan matriz de facturación/).count() > 0;
  ok("pl-43 un segundo Esc cierra la pregunta y el plan se queda abierto con lo capturado", hay === 1 && pregunta === 0 && sigue && (await celda(p, 0, 0).inputValue().catch(() => "")) === "1000" && !(await log(p)).includes("cerrado"),
    `pregunta ${hay} → ${pregunta} · plan ${sigue ? "abierto" : "CERRADO"} · ${(await log(p)).split("\n").slice(-2).join(" / ")}`);
});
await caso("pl-44 «Cerrar el plan» guarda el borrador en ese momento", "", async p => {
  await abrir(p); await piezas(p, 0, [1234]); await fuera(p);
  await p.keyboard.press("Escape");
  await preguntaCerrar(p).getByRole("button", { name: "Cerrar el plan" }).click({ timeout: 1500 }).catch(() => {});   // (sin esperar los 600 ms del autoguardado)
  const cerrado = (await log(p)).includes("cerrado");
  await p.reload(); await p.waitForSelector("#abrir-plan"); await abrir(p); await espera(p, 300);
  await p.getByRole("button", { name: "Retomarlo" }).click({ timeout: 1500 }).catch(() => {}); await espera(p, 300);
  const v = await celda(p, 0, 0).inputValue().catch(() => "");
  ok("pl-44 «Cerrar el plan» cierra y el borrador ya trae lo último que se capturó", cerrado && v === "1234", `cerrado ${cerrado} · al retomar «${v}»`);
});
await caso("pl-45 el borrador se ofrece dentro de la ventana", "", async p => {
  await abrir(p); await piezas(p, 0, [1000, 2000]); await espera(p, 900);
  await p.reload(); await p.waitForSelector("#abrir-plan"); await abrir(p); await espera(p, 300);
  const of = p.locator("[data-borrador]"), hay = await of.count(), dice = hay ? ((await of.innerText()) || "").replace(/\s+/g, " ") : "";
  const nav = (await log(p)).includes("confirm:");
  await p.getByRole("button", { name: "Empezar de cero" }).click({ timeout: 1500 }).catch(() => {}); await espera(p, 900);
  const v = await celda(p, 0, 0).inputValue().catch(() => "?");
  await p.reload(); await p.waitForSelector("#abrir-plan"); await abrir(p); await espera(p, 300);
  const otraVez = await p.locator("[data-borrador]").count();
  ok("pl-45 al abrir, el plan sin terminar se ofrece en la ventana (cuántas celdas) con «Retomarlo» y «Empezar de cero»; «Empezar de cero» lo borra",
    hay === 1 && /2 celdas capturadas/.test(dice) && !nav && v === "" && otraVez === 0, `oferta «${dice.slice(0, 160)}» · navegador ${nav} · tras «Empezar de cero» la celda «${v}» · al reabrir ${otraVez ? "OTRA VEZ la oferta" : "sin oferta"}`);
});
await caso("pl-46 sin decidir, el borrador no se pierde", "", async p => {
  await abrir(p); await piezas(p, 0, [1500]); await espera(p, 900);
  await p.reload(); await p.waitForSelector("#abrir-plan"); await abrir(p); await espera(p, 300);
  const hay = await p.locator("[data-borrador]").count();
  await p.locator("[data-borrador]").getByRole("button", { name: "Cerrar" }).click({ timeout: 1500 }).catch(() => {}); await espera(p, 900);
  await p.reload(); await p.waitForSelector("#abrir-plan"); await abrir(p); await espera(p, 300);
  await p.getByRole("button", { name: "Retomarlo" }).click({ timeout: 1500 }).catch(() => {}); await espera(p, 300);
  const v = await celda(p, 0, 0).inputValue().catch(() => "");
  ok("pl-46 cerrar la ventana sin elegir deja el borrador (al volver se ofrece y se retoma)", hay === 1 && v === "1500", `oferta ${hay} · al retomar después «${v}»`);
});
await caso("pl-47 el Tab no se sale del plan", "", async p => {
  await abrir(p);
  const r = await p.evaluate(() => { const d = document.querySelector('[role="dialog"]') || document.querySelector("h3")?.closest("div");
    const f = [...d.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.getClientRects().length > 0);
    f[f.length - 1].focus(); return f.length; });
  await p.keyboard.press("Tab"); await espera(p, 100);
  const tras = await p.evaluate(() => { const h = [...document.querySelectorAll("h3")].find(x => /Plan matriz/.test(x.textContent)); const d = h && (h.closest('[role="dialog"]') || h.parentElement); return !!d && d.contains(document.activeElement); });
  await p.keyboard.press("Shift+Tab"); await espera(p, 100);
  const atras = await p.evaluate(() => { const h = [...document.querySelectorAll("h3")].find(x => /Plan matriz/.test(x.textContent)); const d = h && (h.closest('[role="dialog"]') || h.parentElement); return !!d && d.contains(document.activeElement); });
  ok("pl-47 del último control, Tab vuelve adentro del plan (y Mayús+Tab también)", r > 0 && tras && atras, `${r} controles · Tab ${tras ? "adentro" : "SE SALE"} · Mayús+Tab ${atras ? "adentro" : "SE SALE"}`);
});
await caso("pl-48 bajar el número de facturas con datos: pregunta la app", "", async p => {
  await abrir(p); await piezas(p, 1, [1000, 1000]);
  await p.locator("input[type=number][max='10']").fill("1"); await espera(p, 300);
  const q = p.getByRole("dialog", { name: /¿Quitar la factura 2\?/ }), hay = await q.count(), dice = hay ? ((await q.innerText()) || "").replace(/\s+/g, " ") : "";
  if (hay) { await q.getByRole("button", { name: "Dejarla" }).click(); await espera(p, 300); }
  const cols1 = await p.locator("thead th [data-saldo]").count();
  await p.locator("input[type=number][max='10']").fill("1"); await espera(p, 300);
  await p.getByRole("dialog", { name: /¿Quitar la factura 2\?/ }).getByRole("button", { name: "Quitar la factura" }).click({ timeout: 1500 }).catch(() => {}); await espera(p, 300);
  const cols2 = await p.locator("thead th [data-saldo]").count();
  ok("pl-48 bajar a 1 con datos en la 2: pregunta la app y dice qué se va (2 de 4 órdenes); «Dejarla» la deja, «Quitar la factura» la quita",
    hay === 1 && /Factura 2/.test(dice) && /2 de 4 órdenes/.test(dice) && !(await log(p)).includes("confirm:") && cols1 === 2 && cols2 === 1, `pregunta «${dice.slice(0, 160)}» · navegador ${(await log(p)).includes("confirm:")} · columnas ${cols1} → ${cols2}`);
});
await caso("pl-49 el tercero: Esc lo cierra a él, no al plan", "", async p => {
  await abrir(p);
  await encabezado(p, 0).getByRole("button", { name: /Facturar a tercero/ }).click(); await espera(p, 300);
  const t = p.getByRole("dialog", { name: /a cargo de un tercero/ }), hay = await t.count();
  await p.keyboard.press("Escape"); await espera(p, 300);
  const sigueTercero = await p.getByText(/a cargo de un tercero|a un tercero$/).count(), plan = await p.getByText(/Plan matriz de facturación/).count() > 0;
  ok("pl-49 el tercero de una factura es un diálogo; Esc lo cierra y el plan se queda abierto", hay === 1 && sigueTercero === 0 && plan && !(await log(p)).includes("cerrado"),
    `diálogo del tercero ${hay} · tras Esc: tercero ${sigueTercero ? "ABIERTO" : "cerrado"} · plan ${plan ? "abierto" : "CERRADO"}`);
});
await caso("pl-50 «Repartir» sin nada que repartir lo dice en su columna", "previo=todo", async p => {
  await abrir(p);
  const total = encabezado(p, 0).locator('input[type="number"]').first();
  await total.fill("1000"); await encabezado(p, 0).getByRole("button", { name: /Repartir/ }).click(); await espera(p, 300);
  const alerta = ((await encabezado(p, 0).getByRole("alert").allInnerTexts().catch(() => [])).join(" ")).replace(/\s+/g, " ");
  ok("pl-50 con todo cubierto por un plan anterior, «Repartir» lo dice en su columna (no con alert())", /No hay qué repartir/.test(alerta) && !(await log(p)).includes("alert:"), `«${alerta.slice(0, 120)}» · ${(await log(p)).split("\n").filter(l => l.startsWith("alert")).join(" / ")}`);
});

// vuelta 3, por donde no se diseñó
await caso("pl-51 Esc dentro de una celda no hace nada", "", async p => {
  await abrir(p); await piezas(p, 0, [1000]);
  await celda(p, 0, 0).focus(); await p.keyboard.press("Escape"); await espera(p, 300);
  ok("pl-51 Esc con el cursor en una celda: ni pregunta ni cierra (se está escribiendo)", (await preguntaCerrar(p).count()) === 0 && await p.getByText(/Plan matriz de facturación/).count() > 0 && !(await log(p)).includes("cerrado"));
});
await caso("pl-52 clic fuera: con captura pregunta, sin captura cierra", "", async p => {
  await abrir(p); await piezas(p, 0, [1000]);
  await p.mouse.click(4, 400); await espera(p, 300);
  const pregunta = await preguntaCerrar(p).count();
  if (pregunta) { await preguntaCerrar(p).getByRole("button", { name: "Seguir capturando" }).click(); await espera(p, 200); }
  await celda(p, 0, 0).fill(""); await espera(p, 200); await p.mouse.click(4, 400); await espera(p, 300);
  ok("pl-52 clic fuera del plan: con una celda capturada pregunta la app; ya vacío, cierra sin preguntar", pregunta === 1 && (await log(p)).includes("cerrado") && !(await log(p)).includes("confirm:"), `pregunta ${pregunta} · ${(await log(p)).split("\n").slice(-1)[0]}`);
});
await caso("pl-53 doble clic en «Cerrar el plan»", "", async p => {
  await abrir(p); await piezas(p, 0, [1000]); await fuera(p);
  await p.keyboard.press("Escape"); await espera(p, 300);
  await preguntaCerrar(p).getByRole("button", { name: "Cerrar el plan" }).dblclick().catch(() => {}); await espera(p, 400);
  ok("pl-53 doble clic en «Cerrar el plan»: cierra una vez, sin errores", (await cuenta(p, "cerrado")) === 1, `${await cuenta(p, "cerrado")} cierres`);
});
await caso("pl-54 el borrador con una orden que ya se folió", "", async p => {
  await abrir(p); await piezas(p, 0, [1000, 1000, 1000, 1000]); await espera(p, 900);
  await p.goto(p.url().replace(/\?.*$/, "") + "?foliada=1"); await p.waitForSelector("#abrir-plan"); await abrir(p); await espera(p, 300);
  const dice = ((await p.locator("[data-borrador]").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  await p.getByRole("button", { name: "Retomarlo" }).click({ timeout: 1500 }).catch(() => {}); await espera(p, 300);
  const filas = await p.locator("tbody tr").count(), v = await celda(p, 0, 0).inputValue().catch(() => "");
  ok("pl-54 el borrador con P-0595 ya foliada: lo dice al ofrecerlo (por su nombre) y al retomarlo quedan las otras tres con lo suyo",
    /P-0595/.test(dice) && /ya no entra en el plan/.test(dice) && filas === 3 && v === "1000", `oferta «${dice.slice(0, 220)}» · filas ${filas} · P-0592 «${v}»`);
});
await caso("pl-54b el borrador con una orden que ya salió de la OC", "", async p => {
  // un borrador guardado con una celda de una orden que ya no está en la OC (se movió a otra): sin su id interno en pantalla
  await p.evaluate(() => localStorage.setItem("pf_matrix_draft_OC-0960", JSON.stringify({ captureMode: "qty", ts: Date.now() - 5 * 60000, groups: [
    { label: "", folio: "", doc_type: "factura", lines: { "OP-MUWX46YVCR4": { qty: 1000, amountConIva: 162.4, lastEdited: "qty" }, "OP-SALIODELAOC": { qty: 500, amountConIva: 80, lastEdited: "qty" } } }] })));
  await abrir(p); await espera(p, 300);
  const dice = ((await p.locator("[data-borrador]").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("pl-54b el borrador con una orden que ya salió de la OC: «Una orden del borrador ya no entra», sin su id interno", /Una orden del borrador ya no entra en el plan/.test(dice) && !/OP-/.test(dice), `«${dice.slice(0, 220)}»`);
});
await caso("pl-55 sin órdenes que entren: diálogo en palabras", "foliada=todas", async p => {
  await p.click("#abrir-plan"); await espera(p, 400);
  const d = p.getByRole("dialog", { name: /Plan matriz de facturación/ }), n = await d.count(), t = n ? ((await d.innerText()) || "").replace(/\s+/g, " ") : "";
  await p.keyboard.press("Escape"); await espera(p, 300);
  ok("pl-55 sin órdenes que entren: es diálogo, lo dice en palabras (sin «stage», «splits» ni «elegibles») y Esc lo cierra",
    n === 1 && /Ninguna orden de OC-0960 se puede facturar en un plan/.test(t) && !/stage|splits|elegibles|maq_received/.test(t) && (await log(p)).includes("cerrado"), `«${t.slice(0, 200)}»`);
});
for (const [n, vp] of [["pl-56 la pregunta encima del plan a 1366", { width: 1366, height: 768 }], ["pl-56b la pregunta encima del plan a 1920", { width: 1920, height: 1080 }]]) {
  await caso(n, "", async p => {
    await abrir(p); await piezas(p, 0, [1000]); await fuera(p);
    await p.keyboard.press("Escape"); await espera(p, 300);
    const r = await p.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => /¿Cerrar el plan/.test(x.textContent)); if (!d) return null;
      const b = d.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, enCima = d.contains(document.elementFromPoint(x, y));
      return { dentro: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, enCima, foco: d.contains(document.activeElement) }; });
    // el Tab no se sale de la pregunta (al plan de atrás)
    for (let k = 0; k < 4; k++) await p.keyboard.press("Tab");
    const tabDentro = await p.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => /¿Cerrar el plan/.test(x.textContent)); return !!d && d.contains(document.activeElement); });
    ok(n, r && r.dentro && r.enCima && r.foco && tabDentro, JSON.stringify(r) + ` · Tab ×4 ${tabDentro ? "dentro de la pregunta" : "SE SALE al plan"}`);
  }, vp);
}
await caso("pl-57 «Empezar de cero» y luego otra captura", "", async p => {
  await abrir(p); await piezas(p, 0, [1111]); await espera(p, 900);
  await p.reload(); await p.waitForSelector("#abrir-plan"); await abrir(p); await espera(p, 300);
  await p.getByRole("button", { name: "Empezar de cero" }).click({ timeout: 1500 }).catch(() => {}); await espera(p, 200);
  await piezas(p, 0, [2222]); await fuera(p); await p.keyboard.press("Escape"); await espera(p, 200);
  await preguntaCerrar(p).getByRole("button", { name: "Cerrar el plan" }).click({ timeout: 1500 }).catch(() => {}); await espera(p, 300);
  await p.reload(); await p.waitForSelector("#abrir-plan"); await abrir(p); await espera(p, 300);
  await p.getByRole("button", { name: "Retomarlo" }).click({ timeout: 1500 }).catch(() => {}); await espera(p, 300);
  const v = await celda(p, 0, 0).inputValue().catch(() => "");
  ok("pl-57 tras «Empezar de cero», lo que se captura después es lo que se retoma (no el borrador viejo)", v === "2222", `al retomar «${v}»`);
});

// ───────────── v10.84.99 — el título del aviso de errores del plan («2 errores:») en ámbar daba 2.6:1. Vuelta 1: escrita antes.
await caso("pl-58 el aviso de errores con AA", "", async p => {
  await abrir(p);
  const cr = await p.evaluate(() => {
    const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
      let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
    const el = [...document.querySelectorAll("div")].find(d => /^(\d+ errores?|Falta 1 cosa para crear|Faltan \d+ cosas para crear):$/.test(d.textContent.trim()));
    if (!el) return null;
    const lb = lum(fondo(el)), lt = lum(nums(getComputedStyle(el).color).slice(0, 3)); return +((Math.max(lb, lt) + 0.05) / (Math.min(lb, lt) + 0.05)).toFixed(2);
  });
  ok("pl-58 el título del aviso de errores del plan («N errores:») a 4.5:1 o más", cr !== null && cr >= 4.5, `contraste ${cr}`);
});

// ───────────── v10.84.100 — el plan se deja ver y confirmar (la critique del 13-oct, P1): a 1366 se veía 1 de 4 órdenes y el botón quedaba bajo
//   el borde; una cifra héroe de 24 px; creaba o ligaba al primer clic, sin vista previa; el rechazo de la base salía abajo, crudo; «Ya tiene
//   factura: ligarla» era un enlace de 10 px y sólo salían 4 sugerencias; el plan no pasaba de 1300 px a 1920. Vuelta 1: escritas ANTES.
const caja = (p, sel) => p.evaluate(s => { const e = typeof s === "string" ? document.querySelector(s) : null; if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height }; }, sel);
await caso("pl-59 a 1366: el botón y las órdenes a la vista", "", async p => {
  await abrir(p);
  const r = await p.evaluate(() => {
    const vis = e => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; };
    const filas = [...document.querySelectorAll("tbody tr")].map(vis);
    const btn = [...document.querySelectorAll("button")].filter(b => /^(Revisar: )?(Crear|Ligar|crear|ligar) \d+/.test(b.textContent.trim())).pop();
    return { filas, boton: btn ? vis(btn) : false, alto: innerHeight };
  });
  ok("pl-59 a 1366×768: el botón de crear se ve sin hacer scroll y al menos 2 de las 4 órdenes también", r.boton && r.filas.filter(Boolean).length >= 2, JSON.stringify(r));
});
await caso("pl-59b a 1920: las 4 órdenes, el botón y el ancho", "", async p => {
  await abrir(p);
  const r = await p.evaluate(() => {
    const vis = e => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; };
    const d = [...document.querySelectorAll('[role="dialog"]')].find(x => /Plan matriz de facturación/.test(x.textContent)) || [...document.querySelectorAll("h3")].find(x => /Plan matriz/.test(x.textContent))?.parentElement;
    const btn = [...document.querySelectorAll("button")].filter(b => /^(Revisar: )?(Crear|Ligar|crear|ligar) \d+/.test(b.textContent.trim())).pop();
    return { filas: [...document.querySelectorAll("tbody tr")].map(vis), boton: btn ? vis(btn) : false, ancho: d ? Math.round(d.getBoundingClientRect().width) : 0 };
  });
  ok("pl-59b a 1920×1080: las 4 órdenes y el botón se ven sin scroll, y el plan usa el ancho (más de 1300 px)", r.filas.length === 4 && r.filas.every(Boolean) && r.boton && r.ancho > 1300, JSON.stringify(r));
}, { width: 1920, height: 1080 });
await caso("pl-60 sin cifra héroe", "", async p => {
  await abrir(p);
  const max = await p.evaluate(() => { const d = [...document.querySelectorAll("h3")].find(x => /Plan matriz/.test(x.textContent)); const raiz = d ? (d.closest('[role="dialog"]') || d.parentElement.parentElement) : document.body;
    return Math.max(...[...raiz.querySelectorAll("*")].filter(e => e.children.length === 0 && e.textContent.trim()).map(e => parseFloat(getComputedStyle(e).fontSize))); });
  ok("pl-60 ninguna cifra del plan pasa de 18 px (la de «POR ASIGNAR» medía 24)", max <= 18, `la letra más grande: ${max} px`);
});
await caso("pl-61 vista previa antes de crear", "", async p => {
  // (la segunda, NUEVA con 1,000 piezas por orden: con «Lo que falta» sale justo por F-155 y el candado del anticipo apaga el botón; vuelta 1)
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143); await piezas(p, 1, [1000, 1000, 1000, 1000]);
  await botonEnviar(p).click(); await espera(p, 400);
  const antes = await cuenta(p, "plan:confirm"), v = vista(p), hay = await v.count();
  const dice = hay ? ((await v.innerText()) || "").replace(/\s+/g, " ") : "";
  if (hay) { await v.getByRole("button", { name: /^(Crear|Ligar) \d+/ }).click(); await espera(p, 500); }
  ok("pl-61 el botón abre una vista previa (una fila por factura: liga F-143 o nueva, a cargo de quién, cuánto, y el total) y no manda nada hasta confirmar",
    antes === 0 && hay === 1 && /liga F-143/.test(dice) && /nueva/.test(dice) && /A cargo de PORTLAND LEATHER/.test(dice) && /3,066\.78/.test(dice) && /Total/.test(dice) && (await cuenta(p, "plan:confirm")) === 1,
    `antes de confirmar: ${antes} envíos · vista previa ${hay}: «${dice.slice(0, 260)}» · después: ${await cuenta(p, "plan:confirm")}`);
});
await caso("pl-62 «Volver al plan»", "", async p => {
  // (la segunda, NUEVA con 1,000 piezas por orden: con «Lo que falta» sale justo por F-155 y el candado del anticipo apaga el botón; vuelta 1)
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143); await piezas(p, 1, [1000, 1000, 1000, 1000]);
  await botonEnviar(p).click(); await espera(p, 400);
  await vista(p).getByRole("button", { name: "Volver al plan" }).click({ timeout: 1500 }).catch(() => {}); await espera(p, 300);
  ok("pl-62 «Volver al plan» regresa sin mandar nada y con lo capturado", (await cuenta(p, "plan:confirm")) === 0 && (await vista(p).count()) === 0 && (await celda(p, 0, 0).inputValue().catch(() => "")) === "4380",
    `${await cuenta(p, "plan:confirm")} envíos · vista ${await vista(p).count()}`);
});
await caso("pl-63 el rechazo de la base, dentro", "conf=falla", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143); await piezas(p, 1, [1000, 1000, 1000, 1000]);
  await enviar(p).click(); await espera(p, 700);
  const alerta = ((await p.locator("[data-plan-rechazo]").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("pl-63 si la base rechaza, el plan lo dice dentro (role=alert), en palabras («Factura 1», no «Grupo 1») y con lo capturado",
    /La base no aceptó el plan/.test(alerta) && /Factura 1/.test(alerta) && !/Grupo 1/.test(alerta) && (await p.locator('[data-plan-rechazo][role="alert"]').count()) === 1 && (await celda(p, 0, 0).inputValue().catch(() => "")) === "4380",
    `«${alerta.slice(0, 200)}»`);
});
await caso("pl-64 «Nueva / Ya existe» en cada columna", "", async p => {
  await abrir(p);
  const grupos = await p.locator('thead [role="group"]').count();
  const nueva = encabezado(p, 0).getByRole("button", { name: "Nueva", exact: true }), existe = encabezado(p, 0).getByRole("button", { name: "Ya existe", exact: true });
  const n0 = await nueva.getAttribute("aria-pressed").catch(() => null);
  await existe.click().catch(() => {}); await espera(p, 200);
  const folio = await p.getByLabel("Folio de la factura 1 que ya existe").count(), e1 = await existe.getAttribute("aria-pressed").catch(() => null);
  await nueva.click().catch(() => {}); await espera(p, 200);
  const folio2 = await p.getByLabel("Folio de la factura 1 que ya existe").count();
  ok("pl-64 cada columna elige «Nueva» o «Ya existe» a la vista (aria-pressed); «Ya existe» pide el folio y «Nueva» lo quita", grupos === 2 && n0 === "true" && e1 === "true" && folio === 1 && folio2 === 0,
    `grupos ${grupos} · Nueva ${n0} → Ya existe ${e1} · folio ${folio} → ${folio2}`);
});
await caso("pl-65 todas las facturas sin orden como sugerencia", "ligables=muchas", async p => {
  await abrir(p); await ligar(p, 0, null); await espera(p, 300);
  const sug = await encabezado(p, 0).locator("button").filter({ hasText: /^(F|RS)-\d+$/ }).allInnerTexts();
  ok("pl-65 con 7 facturas sin orden, las 7 salen como sugerencia (antes, sólo 4)", sug.length === 7, JSON.stringify(sug));
});
await caso("pl-66b Ctrl+Enter abre la vista previa", "", async p => {
  // (la segunda, nueva con 1,000 por orden: con «Lo que falta» el candado del anticipo apaga el envío y Ctrl+Enter, con razón, no abre nada)
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143); await piezas(p, 1, [1000, 1000, 1000, 1000]);
  await celda(p, 0, 0).focus(); await p.keyboard.press("Control+Enter"); await espera(p, 400);
  ok("pl-66b Ctrl+Enter desde una celda abre la vista previa (no manda nada)", (await vista(p).count()) === 1 && (await cuenta(p, "plan:confirm")) === 0, `vista ${await vista(p).count()} · envíos ${await cuenta(p, "plan:confirm")}`);
});
await caso("pl-66 lo que falta, en palabras", "", async p => {
  await abrir(p); await piezas(p, 0, [90000]);
  const e = (await errores(p)).replace(/\s+/g, " ");
  ok("pl-66 los errores del plan en palabras: «piezas», sin «pzas», «qty», «drift» ni «disponibles»", /piezas/.test(e) && !/\bpzas\b|\bqty\b|drift|disponibles|matchea|chars/.test(e), `«${e.slice(0, 260)}»`);
});

// vuelta 3, por donde no se diseñó
await caso("pl-71 Esc en la vista previa", "", async p => {
  await abrir(p); await ligar(p, 0, "F-143"); await piezas(p, 0, F143); await piezas(p, 1, [1000, 1000, 1000, 1000]);
  await botonEnviar(p).click(); await espera(p, 400);
  const hay = await vista(p).count();
  await p.keyboard.press("Escape"); await espera(p, 300);
  ok("pl-71 Esc en la vista previa la cierra a ella (el plan se queda, con lo capturado y sin mandar)", hay === 1 && (await vista(p).count()) === 0 && await p.getByText(/Plan matriz de facturación/).count() > 0
    && (await cuenta(p, "plan:confirm")) === 0 && (await celda(p, 0, 0).inputValue().catch(() => "")) === "4380", `vista ${hay} → ${await vista(p).count()}`);
});
await caso("pl-72 Ctrl+Enter con algo por resolver", "", async p => {
  await abrir(p); await piezas(p, 0, [90000]); await celda(p, 0, 0).focus();
  await p.keyboard.press("Control+Enter"); await espera(p, 400);
  ok("pl-72 con algo por resolver, Ctrl+Enter no abre la vista previa ni manda nada", (await vista(p).count()) === 0 && (await cuenta(p, "plan:confirm")) === 0);
});
await caso("pl-73 remisión y factura en la vista previa", "", async p => {
  await abrir(p); await ligar(p, 0, "RS-31"); await piezas(p, 0, [10000, 0, 0, 0]); await piezas(p, 1, [1000, 1000, 1000, 1000]);
  await botonEnviar(p).click(); await espera(p, 400);
  const dice = ((await vista(p).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("pl-73 con una remisión y una factura, la vista previa dice cada una con su IVA y que el total mezcla («facturas con IVA, lo demás sin IVA»)",
    /Remisión 1 · liga RS-31/.test(dice) && /Factura 2 · nueva/.test(dice) && /facturas con IVA, lo demás sin IVA/.test(dice), `«${dice.slice(0, 280)}»`);
});
await caso("pl-74 muchas cosas por resolver: el botón sigue a la vista", "", async p => {
  await abrir(p);
  await p.locator("input[type=number][max='10']").fill("7"); await espera(p, 300);
  for (let i = 0; i < 7; i++) await piezas(p, i, [90000, 90000, 90000, 90000]);
  const r = await p.evaluate(() => { const vis = e => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; };
    const btn = [...document.querySelectorAll("button")].filter(b => /^(Revisar: )?(Crear|Ligar|crear|ligar) \d+/.test(b.textContent.trim())).pop();
    const err = document.querySelector("[data-plan-errores]"); return { boton: btn ? vis(btn) : false, errores: err ? err.querySelectorAll("div").length : 0, ancho: document.documentElement.scrollWidth }; });
  ok("pl-74 con 7 facturas llenas de más (muchas cosas por resolver) a 1366, el botón sigue a la vista y la página no se desborda", r.boton && r.errores > 6 && r.ancho <= 1366, JSON.stringify(r));
});

for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nplan: ${res.length - fallan} pasan, ${fallan} fallan`);
await browser.close();
process.exitCode = fallan ? 1 : 0;
