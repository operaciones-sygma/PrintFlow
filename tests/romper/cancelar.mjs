// Tratar de ROMPER «las puertas de cancelar» (CancelOrderModal, CancelInvoicedModal, CancelarParteModal, MatrixCancelConfirmModal) en
// su banco (tests/banco/gen-cancelar.mjs). Cada caso afirma lo que DEBERÍA pasarle a quien cancela (Karla, Lupita, Marcelo): una
// FALLA es un bug. Primero, el contrato de los diálogos que la app ya se fijó (DESIGN.md, «Notas de PrintFlow»); después, lo de la
// critique de esta noche.
// Uso: node cancelar.mjs <dir-capturas> [puerto=5187]   ·   SOLO=<regex> corre sólo los casos que coinciden (sabotajes)
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5187);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, viewport = { width: 1366, height: 768 }) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const page = await browser.newPage({ viewport });
  const errs = [], nativos = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errs.push("console: " + m.text().slice(0, 160)); });
  // un diálogo del navegador (confirm/alert) se anota y se acepta: la app no debería usarlos (DESIGN.md)
  page.on("dialog", async d => { nativos.push(d.type() + ": " + d.message().slice(0, 80)); await d.accept().catch(() => {}); });
  page.nativos = nativos;
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#log", { state: "attached" }); await page.waitForTimeout(300);
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre.split(" ")[0] + ".png" }).catch(() => {});
  await page.close();
}
const espera = (p, ms = 300) => p.waitForTimeout(ms);
const log = async p => (await p.textContent("#log")) || "";
const cuenta = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref)).length;
const texto = p => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
// las cuatro ventanas (y sus variantes): cómo se abren, qué se anota al cancelar y cómo se «captura» algo en ellas
const PUERTAS = [
  { k: "orden", boton: "abrir-orden", anota: "cancelar-orden", capturar: async p => { await p.locator("textarea").first().fill("Cliente canceló el pedido"); } },
  { k: "factura", boton: "abrir-factura", anota: "cancelar-facturada", capturar: async p => { await p.locator("textarea").first().fill("Cliente canceló el pedido"); } },
  { k: "remision", boton: "abrir-remision", anota: "cancelar-facturada", capturar: async p => { await p.locator("textarea").first().fill("Cliente canceló el pedido"); } },
  { k: "parte", boton: "abrir-parte", anota: "cancelar-parte", capturar: async p => { await p.getByText("Vuelve a quedar por facturar").click(); await p.locator("textarea").first().fill("Se refactura con otro RFC"); } },
  { k: "linea", boton: "abrir-linea", anota: "cancelar-matriz", capturar: async p => { await p.locator("textarea").first().fill("Cliente devolvió 2000 piezas"); } },
  { k: "grupo", boton: "abrir-grupo", anota: "cancelar-matriz", capturar: async p => { await p.locator("textarea").first().fill("Cliente canceló el pedido completo"); } },
];
async function abrir(p, puerta) { await p.click("#" + puerta.boton); await espera(p, 600); }
// la ventana abierta: el diálogo con nombre si lo tiene; si no, la caja blanca encima del fondo (para poder medir aunque falle el rol)
const ventana = p => p.locator('[role="dialog"]').last();
const enVentana = p => p.evaluate(() => { const a = document.activeElement; const d = [...document.querySelectorAll('[role="dialog"]')].pop();
  return !!d && !!a && a !== document.body && d.contains(a); });
// (vuelta 1, corregido) los botones se buscan en la CAPA de la ventana (el fondo fijo), no por role="dialog": tres de las cuatro no lo
//   tienen, y buscándolos por el rol la prueba se caía o, peor, «pasaba» sin haber hecho el clic (0 cancelaciones)
//   (y sólo las capas con fondo oscuro: el aviso de abajo —el Toast— también es fijo y no es una ventana)
const capas = p => p.locator('div[style*="position: fixed"][style*="background: rgba(0, 0, 0"]');
const botonFinal = p => capas(p).last().locator("button").last();
// si al apretar aparece otra ventana encima (una pregunta), se confirma con su último botón
async function confirmarSiPregunta(p, antes) { if ((await capas(p).count()) > antes) { await capas(p).last().locator("button").last().click(); await espera(p, 400); } }
// el botón que CANCELA de verdad (el último del pie): «Sí, Cancelar Orden», «Cancelar con NC», «Cancelar la parte», «Confirmar cancelar…»
const botonQueCancela = p => p.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]')].pop() || document.querySelector('div[style*="position: fixed"] > div');
  const bs = [...(d?.querySelectorAll("button") || [])].filter(b => b.offsetParent); return bs.length ? bs[bs.length - 1].textContent.trim() : null; });

// ───────────── el contrato de los diálogos (DESIGN.md), en las cuatro puertas
for (const puerta of PUERTAS) {
  await caso(`can-01-${puerta.k} es un diálogo con nombre`, "", async p => {
    await abrir(p, puerta);
    const d = await p.evaluate(() => { const x = [...document.querySelectorAll('[role="dialog"]')].pop(); if (!x) return null;
      const id = x.getAttribute("aria-labelledby"), t = id && document.getElementById(id);
      return { modal: x.getAttribute("aria-modal") === "true", nombre: (t?.textContent || x.getAttribute("aria-label") || "").trim().slice(0, 60) }; });
    ok(`can-01-${puerta.k} la ventana es un diálogo (role="dialog", aria-modal) con nombre`, !!d && d.modal && !!d.nombre, JSON.stringify(d));
  });
  await caso(`can-02-${puerta.k} el foco entra a la ventana, no al botón que cancela`, "", async p => {
    await abrir(p, puerta);
    const dentro = await enVentana(p);
    const enfocado = await p.evaluate(() => (document.activeElement?.textContent || document.activeElement?.tagName || "").trim().slice(0, 40));
    const cancela = await botonQueCancela(p);
    ok(`can-02-${puerta.k} al abrir, el foco está dentro de la ventana y no en el botón que cancela`, dentro && enfocado !== cancela, "foco en «" + enfocado + "»");
  });
  await caso(`can-03-${puerta.k} Tab no se sale`, "", async p => {
    await abrir(p, puerta);
    let fuera = 0;
    for (let i = 0; i < 14; i++) { await p.keyboard.press("Tab"); if (!(await enVentana(p))) fuera++; }
    for (let i = 0; i < 6; i++) { await p.keyboard.press("Shift+Tab"); if (!(await enVentana(p))) fuera++; }
    ok(`can-03-${puerta.k} Tab y Mayús+Tab se quedan dentro de la ventana`, fuera === 0, fuera + " de 20 pasos fuera de la ventana");
  });
  await caso(`can-04-${puerta.k} Esc con algo escrito pregunta`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 200);
    await capas(p).last().locator("h3").first().click(); await p.keyboard.press("Escape"); await espera(p, 400);   // el foco fuera del campo
    const cerro = (await cuenta(p, "cerrado")) > 0;
    const preguntas = await p.locator('[role="dialog"]').count();
    ok(`can-04-${puerta.k} con el motivo escrito, Esc no tira lo escrito: pregunta o no hace nada`, !cerro, "se cerró " + cerro + " · diálogos " + preguntas);
  });
  await caso(`can-05-${puerta.k} el clic fuera no tira lo escrito`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 200);
    await p.mouse.click(8, 760); await espera(p, 400);
    ok(`can-05-${puerta.k} con el motivo escrito, el clic en el fondo no cierra la ventana`, (await cuenta(p, "cerrado")) === 0);
  });
  await caso(`can-06-${puerta.k} sin diálogos del navegador`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 200);
    const n0 = await capas(p).count(), b = botonFinal(p);
    if (await b.isEnabled()) { await b.click(); await espera(p, 500); await confirmarSiPregunta(p, n0); await espera(p, 500); }
    ok(`can-06-${puerta.k} cancelar no usa confirm()/alert() del navegador (la pregunta, dentro de la app)`, p.nativos.length === 0, p.nativos.join(" | ").slice(0, 160));
  });
  await caso(`can-07-${puerta.k} doble clic en lo que cancela`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 200);
    const n0 = await capas(p).count();
    await botonFinal(p).dblclick(); await espera(p, 600); await confirmarSiPregunta(p, n0); await espera(p, 900);
    // si la app pregunta antes (una ventana nueva encima), se confirma UNA vez
    const n = await cuenta(p, puerta.anota);
    ok(`can-07-${puerta.k} un doble clic cancela una sola vez`, n <= 1, n + " cancelaciones");
  });
  await caso(`can-08-${puerta.k} la base que rechaza`, "falla=1", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 200);
    const n0 = await capas(p).count(), b = botonFinal(p);
    if (await b.isEnabled()) { await b.click(); await espera(p, 400); await confirmarSiPregunta(p, n0); }
    await espera(p, 900);
    const sigue = (await p.locator("textarea").count()) > 0 && (await p.locator("textarea").first().inputValue()).length >= 5;
    const t = await texto(p);
    const dentro = await p.evaluate(() => { const c = [...document.querySelectorAll('div[style*="position: fixed"][style*="background: rgba(0, 0, 0"]')].filter(x => x.querySelector("textarea")).pop();
      return !!c && /no se pudo|no se canceló|sin conexión|rechaz/i.test(c.innerText); });
    ok(`can-08-${puerta.k} si la base rechaza, la ventana se queda con lo escrito y dice el porqué DENTRO de ella`, sigue && dentro, "sigue con el motivo " + sigue + " · dentro " + dentro + " · «" + t.slice(-120) + "»");
  });
  await caso(`can-09-${puerta.k} todo el texto se lee (AA)`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 300);
    const malos = await p.evaluate(() => {
      const d = [...document.querySelectorAll('[role="dialog"]')].pop() || document.querySelector('div[style*="position: fixed"] > div');
      const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const fondo = el => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.6)) return c; } return [255, 255, 255]; };
      const out = [];
      for (const el of d.querySelectorAll("*")) {
        if (!el.offsetParent || !(el.innerText || "").trim() || [...el.childNodes].every(n => n.nodeType !== 3 || !n.textContent.trim())) continue;
        const cs = getComputedStyle(el); const op = parseFloat(cs.opacity);
        const a = lum(rgb(cs.color)), b = lum(fondo(el)), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        // (vuelta 1, corregido) «grande» como lo dice WCAG: 24 px, o 18.66 px en negrita (antes 18 y 14: dejaba pasar el título rojo)
        const grande = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
        if (r * (op < 1 ? op : 1) < (grande ? 3 : 4.5)) out.push(el.textContent.trim().slice(0, 30) + " " + r.toFixed(1) + ":1");
      }
      return out;
    });
    ok(`can-09-${puerta.k} todo el texto de la ventana pasa AA (4.5:1; 3:1 lo grande)`, malos.length === 0, malos.slice(0, 5).join(" · "));
  });
  // ── la revisión independiente (P2 «tres de cuatro no siguen el patrón»): lo que el contrato no decía todavía
  await caso(`can-10-${puerta.k} Esc a media cancelación`, "lento=1", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 200);
    const n0 = await capas(p).count(), b = botonFinal(p);
    if (await b.isEnabled()) { await b.click(); await espera(p, 300); await confirmarSiPregunta(p, n0); }
    const n1 = await capas(p).count();
    await capas(p).last().locator("h3").first().click().catch(() => {}); await p.keyboard.press("Escape"); await espera(p, 500);
    const cerroAntes = (await cuenta(p, "cerrado")) > 0, pregunto = (await capas(p).count()) > n1;
    // (sabotaje S3) ni cierra ni PREGUNTA: «Cerrar sin cancelar» a media cancelación cerraría la ventana con la orden cancelándose
    ok(`can-10-${puerta.k} con la cancelación en curso («Cancelando…»), Esc no cierra la ventana ni pregunta (la cancelación sigue)`, !cerroAntes && !pregunto, "se cerró " + cerroAntes + " · preguntó " + pregunto);
  });
  await caso(`can-11-${puerta.k} el error se lleva el foco`, "falla=1", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 200);
    const n0 = await capas(p).count(), b = botonFinal(p);
    if (await b.isEnabled()) { await b.click(); await espera(p, 400); await confirmarSiPregunta(p, n0); }
    await espera(p, 900);
    const donde = await p.evaluate(() => { const a = document.activeElement; return a === document.body || !a ? "body" : (a.getAttribute("role") || a.tagName) + " «" + (a.textContent || "").trim().slice(0, 30) + "»"; });
    ok(`can-11-${puerta.k} si la base rechaza, el foco queda dentro de la ventana (no cae al <body>)`, await enVentana(p), "foco en " + donde);
  });
  await caso(`can-12-${puerta.k} el foco regresa al cerrar la pregunta`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 200);
    const n0 = await capas(p).count();
    await capas(p).last().locator("h3").first().click(); await p.keyboard.press("Escape"); await espera(p, 400);
    const pregunto = (await capas(p).count()) > n0;
    if (pregunto) { await p.keyboard.press("Escape"); await espera(p, 400); }
    const sigue = (await cuenta(p, "cerrado")) === 0;
    ok(`can-12-${puerta.k} Esc con el motivo escrito pregunta; Esc otra vez deja la ventana con el foco dentro`, pregunto && sigue && await enVentana(p), "preguntó " + pregunto + " · sigue " + sigue);
  });
  await caso(`can-13-${puerta.k} cerrar sin cancelar`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 200);
    const n0 = await capas(p).count();
    await capas(p).last().locator("h3").first().click(); await p.keyboard.press("Escape"); await espera(p, 400);
    const pregunto = (await capas(p).count()) > n0;
    if (pregunto) { await capas(p).last().locator("button").last().click(); await espera(p, 400); }
    ok(`can-13-${puerta.k} la pregunta de Esc deja cerrar sin cancelar nada`, pregunto && (await cuenta(p, "cerrado")) === 1 && (await cuenta(p, puerta.anota)) === 0,
      "preguntó " + pregunto + " · cerrado " + await cuenta(p, "cerrado") + " · cancelaciones " + await cuenta(p, puerta.anota));
  });
  await caso(`can-14-${puerta.k} arrastrar del campo y soltar fuera`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 200);
    const n0 = await capas(p).count(), c = await p.locator("textarea").first().boundingBox();
    await p.mouse.move(c.x + 20, c.y + 10); await p.mouse.down(); await p.mouse.move(8, 700, { steps: 6 }); await p.mouse.up(); await espera(p, 400);
    ok(`can-14-${puerta.k} seleccionar el motivo y soltar el ratón fuera no cierra ni pregunta`, (await cuenta(p, "cerrado")) === 0 && (await capas(p).count()) === n0,
      "cerrado " + await cuenta(p, "cerrado") + " · capas " + (await capas(p).count()) + " de " + n0);
  });
  // ── vuelta 2 (por donde no se diseñó)
  await caso(`can-21b-${puerta.k} doble clic en lo que la abre`, "", async p => {
    await p.dblclick("#" + puerta.boton); await espera(p, 700);
    ok(`can-21b-${puerta.k} un doble clic en lo que abre la ventana no la cierra (el segundo clic cae en el fondo)`, (await cuenta(p, "cerrado")) === 0 && (await p.locator('[role="dialog"]').count()) === 1,
      "cerrado " + await cuenta(p, "cerrado"));
  });
  await caso(`can-04b-${puerta.k} Esc con el foco en el campo`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 200);
    const n0 = await capas(p).count();
    await p.locator("textarea").first().focus(); await p.keyboard.press("Escape"); await espera(p, 400);
    const pregunto = (await capas(p).count()) > n0, cerro = (await cuenta(p, "cerrado")) > 0;
    ok(`can-04b-${puerta.k} con el foco en el motivo escrito, Esc pregunta (no se queda mudo ni lo tira)`, pregunto && !cerro, "preguntó " + pregunto + " · se cerró " + cerro);
  });
  await caso(`can-16b-${puerta.k} puros espacios`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 300);
    await p.locator("textarea").first().fill("     abcd     "); await espera(p, 150);
    ok(`can-16b-${puerta.k} un motivo de espacios y 4 letras no cuenta como 5`, !(await botonFinal(p).isEnabled()));
  });
  await caso(`can-15-${puerta.k} el campo tiene nombre`, "", async p => {
    await abrir(p, puerta);
    const n = await p.getByLabel(/por qué se cancela/i).count();
    ok(`can-15-${puerta.k} el campo del motivo se llama «¿Por qué se cancela?» (no como su ejemplo)`, n === 1, n + " campos con ese nombre");
  });
  await caso(`can-16-${puerta.k} el mismo mínimo`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 300);
    const t = p.locator("textarea").first();
    await t.fill("abc"); await espera(p, 150); const corto = await botonFinal(p).isEnabled();
    await t.fill("abcde"); await espera(p, 150); const justo = await botonFinal(p).isEnabled();
    ok(`can-16-${puerta.k} el motivo pide 5 letras en las cuatro (con 3 no deja, con 5 sí)`, !corto && justo, "con 3 " + corto + " · con 5 " + justo);
  });
  await caso(`can-17-${puerta.k} el botón apagado dice qué falta`, "", async p => {
    await abrir(p, puerta); await espera(p, 300);
    const t = await capas(p).last().innerText();
    ok(`can-17-${puerta.k} sin motivo, la ventana dice qué falta (mínimo 5 letras)`, /m[ií]nimo 5|5 letras/i.test(t), "«" + t.replace(/\s+/g, " ").slice(-140) + "»");
  });
  await caso(`can-18-${puerta.k} la laptop al 200 %`, "", async p => {
    await abrir(p, puerta); await puerta.capturar(p); await espera(p, 300);
    const cajas = await capas(p).last().locator("button").evaluateAll(bs => bs.filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), b.textContent.trim().slice(0, 20)]; }));
    const fuera = cajas.filter(([t, b]) => t < 0 || b > 384);
    ok(`can-18-${puerta.k} a 683×384 (la laptop al 200 %) los botones se ven sin mover nada`, cajas.length >= 2 && fuera.length === 0, JSON.stringify(fuera));
  }, { width: 683, height: 384 });
}

// ───────────── la revisión independiente: lo que cada puerta debe decir
const enLaVentana = p => capas(p).last().innerText().then(t => t.replace(/\s+/g, " "));
const botonesQueCancelan = p => capas(p).last().locator("button").evaluateAll(bs => bs.filter(b => b.offsetParent && !b.disabled && /cancel/i.test(b.textContent) && !/^(volver|cancelar)$/i.test(b.textContent.trim())).map(b => b.textContent.trim()));
// [P1] la orden con folio: qué le pasa a ESTE folio
await caso("can-20 la orden y el importe", "", async p => {
  await abrir(p, PUERTAS[1]); await espera(p, 600); const t = await enLaVentana(p);
  ok("can-20 la ventana de la orden con folio dice la orden (P-0688) y el importe de su factura ($66,004.00)", /P-0688/.test(t) && /66,004\.00/.test(t), "«" + t.slice(0, 160) + "»");
});
await caso("can-21 sin «nota de crédito» en el nombre", "", async p => {
  await abrir(p, PUERTAS[1]); await espera(p, 600);
  const titulo = await capas(p).last().locator("h3").first().innerText(), b = await botonFinal(p).innerText();
  ok("can-21 ni el título ni el botón prometen una nota de crédito (PrintFlow no emite ninguna)", !/nota de cr[eé]dito|\bNC\b/i.test(titulo + " " + b), "«" + titulo + "» · «" + b + "»");
});
await caso("can-22 timbrada", "fac=timbrada", async p => {
  await abrir(p, PUERTAS[1]); await PUERTAS[1].capturar(p); await espera(p, 700); const t = await enLaVentana(p), bs = await botonesQueCancelan(p);
  ok("can-22 con el CFDI timbrado no deja cancelar y dice que primero se cancela en CobranzaFlow", bs.length === 0 && /timbrad/i.test(t) && /CobranzaFlow/.test(t), JSON.stringify(bs) + " · «" + t.slice(0, 200) + "»");
});
await caso("can-23 compartida", "fac=compartida", async p => {
  await abrir(p, PUERTAS[1]); await espera(p, 700); const t = await enLaVentana(p);
  ok("can-23 si el folio es de toda la OC, dice que la factura no se cancela: se le resta esta orden", /no se cancela/i.test(t) && /rest/i.test(t), "«" + t.slice(0, 220) + "»");
});
await caso("can-24 cobrada", "fac=cobrada", async p => {
  await abrir(p, PUERTAS[1]); await espera(p, 700); const t = await enLaVentana(p);
  ok("can-24 si ya tiene cobros, dice cuánto ($30,000.00) y que quedan como discrepancia", /30,000\.00/.test(t) && /discrepancia/i.test(t), "«" + t.slice(0, 220) + "»");
});
await caso("can-25 sin timbrar ni cobrar", "", async p => {
  await abrir(p, PUERTAS[1]); await espera(p, 700); const t = await enLaVentana(p);
  ok("can-25 sin timbrar ni cobrar, dice que en CobranzaFlow la factura queda cancelada con saldo 0", /cancelada con saldo 0/i.test(t), "«" + t.slice(0, 220) + "»");
});
await caso("can-26 la revisión que falla", "fac=falla", async p => {
  await abrir(p, PUERTAS[1]); await espera(p, 700); const t = await enLaVentana(p);
  const r = capas(p).last().getByRole("button", { name: /Reintentar/ }); const hay = (await r.count()) === 1;
  if (hay) { await r.click(); await espera(p, 500); }
  ok("can-26 si no se pudo revisar la factura lo dice y «Reintentar» vuelve a preguntar", /no se pudo revisar/i.test(t) && hay && (await cuenta(p, "check")) === 2, "«" + t.slice(0, 160) + "» · revisiones " + await cuenta(p, "check"));
});
await caso("can-27 la revisión que no contesta", "fac=lento", async p => {
  await abrir(p, PUERTAS[1]); await espera(p, 400); const t1 = await enLaVentana(p);
  await espera(p, 8800); const t2 = await enLaVentana(p);
  ok("can-27 mientras revisa lo dice, y si a los 8 s no contesta, lo dice con «Reintentar»", /revisando/i.test(t1) && /no contest|tard/i.test(t2) && /Reintentar/.test(t2), "«" + t1.slice(0, 80) + "» → «" + t2.slice(0, 120) + "»");
});
await caso("can-28 la remisión", "", async p => {
  await abrir(p, PUERTAS.find(x => x.k === "remision")); await espera(p, 700); const t = await enLaVentana(p);
  ok("can-28 con una remisión no habla de CFDI ni de nota de crédito, y dice RS-1290", /RS-1290/.test(t) && !/CFDI|nota de cr[eé]dito|\bNC\b/i.test(t), "«" + t.slice(0, 220) + "»");
});
await caso("can-29 la orden con folio que se pagó con saldo", "saldo=corona", async p => {
  await abrir(p, PUERTAS[1]); await espera(p, 700); const t = await enLaVentana(p);
  ok("can-29 si se pagó con el saldo a favor, la ventana de la orden con folio dice cuánto regresa ($45,200.00)", /45,200\.00/.test(t), "«" + t.slice(0, 220) + "»");
});
// [P1] la orden: lo que hace además de cancelar
const abrirOrden = async (p, k) => { await p.click("#abrir-" + k); await espera(p, 600); };
await caso("can-30 el éxito en verde", "", async p => {
  await abrir(p, PUERTAS[0]); await PUERTAS[0].capturar(p); await espera(p, 200);
  const n0 = await capas(p).count(); await botonFinal(p).click(); await espera(p, 300); await confirmarSiPregunta(p, n0); await espera(p, 700);
  const verde = await p.locator('[role="status"]').count(), rojo = await p.locator('[role="alert"]').count(), t = await texto(p);
  ok("can-30 cancelar la orden avisa en verde (no como error) y dice cuál (P-0712)", verde === 1 && rojo === 0 && /P-0712 cancelada|cancel[oó] P-0712|P-0712.*cancelad/i.test(t), "verde " + verde + " · rojo " + rojo + " · «" + t.slice(-100) + "»");
});
await caso("can-31 la orden ya facturada, en manos de Dirección", "rol=admin", async p => {
  await abrirOrden(p, "facturada"); const t = await enLaVentana(p), b = await botonFinal(p).innerText();
  ok("can-31 si la orden ya está facturada (F-150 y F-151), Dirección ve qué facturas caen y que ya no se deshace", /F-150/.test(t) && /F-151/.test(t) && /no se (puede |podrá )?deshac/i.test(t) && !/puede deshacerlo/i.test(t) && /factura/i.test(b),
    "«" + t.slice(0, 200) + "» · botón «" + b + "»");
});
await caso("can-32 inventario", "", async p => {
  await abrirOrden(p, "stock"); const t = await enLaVentana(p);
  await p.locator("textarea").first().fill("Cliente canceló el pedido").catch(() => {}); await espera(p, 200);
  const bs = await botonesQueCancelan(p);
  ok("can-32 si la orden ya cargó inventario, lo dice al abrir (antes de escribir) y no deja confirmar", /inventario/i.test(t) && bs.length === 0, JSON.stringify(bs) + " · «" + t.slice(0, 160) + "»");
});
await caso("can-33 la fila de la máquina", "", async p => {
  await abrirOrden(p, "cola"); const t = await enLaVentana(p);
  ok("can-33 si corre en una máquina, dice que sale de la fila de GTO 1 Color y que entra P-0716", /GTO 1 Color/.test(t) && /P-0716/.test(t), "«" + t.slice(0, 220) + "»");
});
await caso("can-34 el archivo de producción", "", async p => {
  await abrirOrden(p, "archivo"); const t = await enLaVentana(p);
  ok("can-34 dice que se borra su archivo de producción (etiqueta-final.pdf)", /etiqueta-final\.pdf/.test(t) && /borra/i.test(t), "«" + t.slice(0, 220) + "»");
});
await caso("can-35 no promete deshacer", "saldo=corona", async p => {
  await abrirOrden(p, "corona"); await espera(p, 400); const t = await enLaVentana(p);
  ok("can-35 si devuelve saldo, no promete que Dirección puede deshacerla", !/puede deshacerlo/i.test(t) && /no se (puede |podrá )?deshac/i.test(t), "«" + t.slice(0, 260) + "»");
});
await caso("can-36 revisando el saldo", "saldo=lento", async p => {
  await abrirOrden(p, "orden"); const t1 = await enLaVentana(p);
  await espera(p, 8800); const t2 = await enLaVentana(p);
  ok("can-36 mientras revisa el saldo lo dice, y si a los 8 s no contesta, lo dice con «Reintentar»", /revisando/i.test(t1) && /no se pudo comprobar|no contest|tard/i.test(t2) && /Reintentar/.test(t2), "«" + t1.slice(0, 80) + "» → «" + t2.slice(-160) + "»");
});
await caso("can-37 no salta", "saldo=corona&saldoMs=1500", async p => {
  await p.click("#abrir-corona"); await espera(p, 400);
  const y = async () => { const r = await botonFinal(p).boundingBox(); return r ? Math.round(r.y) : null; };
  const y1 = await y(); await espera(p, 2000); const y2 = await y();
  ok("can-37 cuando llega el saldo, los botones no se mueven", y1 != null && y2 != null && Math.abs(y2 - y1) < 3, "y " + y1 + " → " + y2);
});
await caso("can-38 el folio que llega con la ventana abierta", "rol=secretaria", async p => {
  await abrir(p, PUERTAS[0]); await PUERTAS[0].capturar(p); await espera(p, 200);
  await p.evaluate(() => window.__cambiar("orden", { invoice_folio: "F-160", invoice_type: "factura" })); await espera(p, 300);
  const n0 = await capas(p).count(), b = botonFinal(p);
  if (await b.isEnabled()) { await b.click(); await espera(p, 300); await confirmarSiPregunta(p, n0); }
  await espera(p, 600); const t = await texto(p);
  const sigue = (await p.locator("textarea").count()) > 0 && (await p.locator("textarea").first().inputValue()).length >= 5;
  ok("can-38 si recibe folio con la ventana abierta, no le dice a Lupita «Usa Cancelar con NC» (no lo tiene) y la ventana se queda diciendo F-160",
    !/Cancelar con NC/i.test(t) && sigue && /F-160/.test(await enLaVentana(p).catch(() => "")), "sigue " + sigue + " · «" + t.slice(-160) + "»");
});
await caso("can-19 la base que no contesta", "lento=14", async p => {
  await abrir(p, PUERTAS[0]); await PUERTAS[0].capturar(p); await espera(p, 200);
  await botonFinal(p).click(); await espera(p, 10800); const t = await enLaVentana(p);
  ok("can-19 si la base no contesta en 10 s, la ventana lo dice y qué hacer (no se queda muda en «Cancelando…»)", /tardando/i.test(t) && /recarga/i.test(t), "«" + t.slice(-160) + "»");
});
await caso("can-39 la orden que se cancela en otra sesión", "", async p => {
  await abrir(p, PUERTAS[0]); await PUERTAS[0].capturar(p); await espera(p, 200);
  await p.evaluate(() => window.__cambiar("orden", { stage: "cancelled", cancelled_at: "2026-10-12T09:30:00Z" })); await espera(p, 300);
  const t = await enLaVentana(p), bs = await botonesQueCancelan(p);
  ok("can-39 si con la ventana abierta la orden se cancela en otra sesión, lo dice y no deja cancelarla otra vez", /otra sesi[oó]n/i.test(t) && bs.length === 0, JSON.stringify(bs) + " · «" + t.slice(0, 160) + "»");
});
await caso("can-39b la orden con folio que se cancela en otra sesión", "", async p => {
  await abrir(p, PUERTAS[1]); await PUERTAS[1].capturar(p); await espera(p, 500);
  await p.evaluate(() => window.__cambiar("factura", { stage: "cancelled", cancelled_at: "2026-10-12T09:30:00Z" })); await espera(p, 300);
  const t = await enLaVentana(p), bs = await botonesQueCancelan(p);
  ok("can-39b lo mismo en la ventana de la orden con folio", /otra sesi[oó]n/i.test(t) && bs.length === 0, JSON.stringify(bs) + " · «" + t.slice(0, 160) + "»");
});
// [P2] el plan matriz: lo que sabe
await caso("can-40 la línea", "", async p => {
  await abrirOrden(p, "linea"); const t = await enLaVentana(p);
  ok("can-40 cancelar una línea dice en cuánto queda la factura (F-140: $69,600.00 con IVA) sin «si era la última»", /F-140/.test(t) && /69,600\.00/.test(t) && !/si era la [uú]ltima/i.test(t), "«" + t.slice(0, 260) + "»");
});
await caso("can-41 la última línea", "", async p => {
  await abrirOrden(p, "linea-ultima"); const t = await enLaVentana(p);
  ok("can-41 la última línea viva dice que su factura F-141 se cancela", /F-141/.test(t) && /[uú]nica|[uú]ltima/i.test(t) && /F-141[^.]*se cancela|se cancela[^.]*F-141/i.test(t), "«" + t.slice(0, 260) + "»");
});
await caso("can-42 la factura entera", "", async p => {
  await abrirOrden(p, "grupo"); const t = await enLaVentana(p);
  ok("can-42 cancelar la factura del plan dice sus órdenes con su importe y el total con y sin IVA", ["P-0720", "P-0721", "120,000.00", "139,200.00"].every(x => t.includes(x)), "«" + t.slice(0, 260) + "»");
});
for (const k of ["linea", "grupo"]) await caso(`can-43-${k} sin jerga`, "", async p => {
  await abrirOrden(p, k); const t = await enLaVentana(p);
  const m = t.match(/ledger|invoice|l[ií]neas vivas|corona_saldo|irreversible/gi);
  ok(`can-43-${k} sin «ledger», «invoice», «líneas vivas», «corona_saldo» ni «irreversible»`, !m, JSON.stringify(m));
});
await caso("can-44 la orden de la línea", "", async p => {
  await abrirOrden(p, "linea"); const t = await enLaVentana(p);
  ok("can-44 dice que la orden no se cancela y que, si se queda sin factura, regresa a Salidas", /Salidas/.test(t) && /no se cancela/i.test(t), "«" + t.slice(0, 260) + "»");
});
// [P2] la parte: lo que cambia con la ventana abierta
await caso("can-50 la otra parte se cancela con la ventana abierta", "", async p => {
  await abrir(p, PUERTAS.find(x => x.k === "parte")); await p.getByText("Se da por perdido").click(); await p.locator("textarea").first().fill("Se refactura con otro RFC"); await espera(p, 200);
  await p.evaluate(() => { const o = window.__ordenes().partes; window.__cambiar("partes", { splits: o.splits.map(s => s.id === "s2" ? { ...s, cancelled_at: "2026-10-12T09:00:00Z" } : s) }); }); await espera(p, 400);
  const t = await enLaVentana(p), habil = await botonFinal(p).isEnabled();
  ok("can-50 si mientras está abierta la otra parte se cancela, lo dice y pide volver a elegir (antes de cancelar la orden entera)", /cambi/i.test(t) && !habil, "habilitado " + habil + " · «" + t.slice(0, 200) + "»");
});

await browser.close();
const fallas = res.filter(r => r.startsWith("FALLA")).length;
console.log(res.join("\n"));
console.log(`\n${res.length - fallas} pasan, ${fallas} fallan`);
