// Tratar de ROMPER la FICHA DE LA ORDEN (OCard) en el banco del tablero (vista=fichas, la misma ficha de «Todas», los pendientes, «En
// espera», la OC y las estancadas). Lo de su /impeccable critique del 19-oct-2026 (23/40; snapshot .impeccable/critique/2026-10-19T07-53-27Z__…):
// cada caso afirma lo que DEBERÍA ver o poder hacer la persona; una FALLA es un bug. Vuelta 1: escritas ANTES del arreglo.
//   Lupita (secretaria, laptop 1366): su ficha medía ~400 px por tres renglones que no le sirven («Cancelar» a la vista —1 suya en 60 días—,
//     «Orden validada — solo lectura» y la caja de «le toca a…»): 2 fichas enteras por pantalla.
//   Gerardo (producción): «Enviar a Maquila» al frente (0 contra 286 a Empaque en 60 días) y el bote de basura de la merma (0): el tablero ya
//     los tiene en «⋯» desde v10.84.63. La misma guía en cada una de sus fichas.
// Uso: node ficha.mjs <dir-capturas> [puerto=5490]   ·   SOLO=<regex> corre sólo los casos que coinciden (sabotajes)
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";   // (un recurso de fuera que no cargó no es error de la app)
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5490);
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
  page.on("console", m => { if (m.type() === "error" && !deFuera(m)) errs.push("console: " + m.text()); });
  page.on("dialog", async d => { errs.push("diálogo del navegador: " + d.message().slice(0, 60)); await d.dismiss().catch(() => {}); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#log", { state: "attached", timeout: 30000 }); await page.waitForTimeout(600);
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png" }).catch(() => {});
  await page.close();
}
const espera = (p, ms = 300) => p.waitForTimeout(ms);
const log = async p => (await p.textContent("#log")) || "";
const ficha = (p, pn) => p.locator('[role="button"][aria-label^="Orden ' + pn + ',"]').first();
// lo que se VE de cada ficha: su alto, si cabe entera, su texto, sus botones visibles (con su nombre accesible) y la letra más chica
// (el alto es el PROPIO de la ficha, hasta su último renglón: en la cuadrícula una ficha se estira al alto de su vecina del mismo renglón, y la
//   primera versión de esta prueba medía ese renglón: P-0603, de ~200 px, salía con 267 por la de al lado)
const fichas = p => p.evaluate(() => [...document.querySelectorAll('[role="button"][aria-label^="Orden "]')].map(f => {
  const caja = f.getBoundingClientRect();
  const fin = Math.max(...[...f.children].filter(c => c.getClientRects().length).map(c => c.getBoundingClientRect().bottom));
  const r = { top: caja.top, bottom: caja.bottom, height: fin - caja.top + parseFloat(getComputedStyle(f).paddingBottom) + parseFloat(getComputedStyle(f).borderBottomWidth) };
  const nombre = b => (b.getAttribute("aria-label") || b.textContent.trim() || b.getAttribute("title") || "").replace(/\s+/g, " ").trim();
  const bots = [...f.querySelectorAll("button")].filter(b => b.getClientRects().length && !b.closest('[role="menu"]')).map(b => ({ n: nombre(b), t: b.textContent.trim(), titulo: b.getAttribute("title") || "" }));
  const hojas = [...f.querySelectorAll("*")].filter(e => !e.children.length && e.textContent.trim() && e.getClientRects().length);
  const chicas = hojas.filter(e => parseFloat(getComputedStyle(e).fontSize) < 10).map(e => "«" + e.textContent.trim().slice(0, 20) + "» " + getComputedStyle(e).fontSize);
  return { pn: f.getAttribute("aria-label").split(",")[0].replace("Orden ", ""), alto: Math.round(r.height), top: r.top, bottom: r.bottom, texto: f.innerText.replace(/\s+/g, " "), bots, chicas };
}));
const enteras = (fs_, alto) => fs_.filter(f => f.top >= 0 && f.bottom <= alto).length;
// abre el «⋯» de una ficha (el de quien actúa, «Más acciones», o el del pie, «Más de P-…») y regresa el menú
async function abrirMas(p, pn) {
  const f = ficha(p, pn);
  const b = f.getByRole("button", { name: new RegExp("^(Más acciones|Más de " + pn + ")") });
  if (!(await b.count())) return null;
  await b.first().click(); await espera(p, 300);
  const m = p.getByRole("menu").first();
  return (await m.count()) ? m : null;
}

// ── Lupita (secretaria) a 1366 ──
await caso("fic-01-lupita-ve-cuatro-fichas-enteras", "vista=fichas&rol=secretaria", async p => {
  const fs_ = await fichas(p), n = enteras(fs_, 768), max = Math.max(...fs_.map(f => f.alto));
  ok("fic-01-lupita-ve-cuatro-fichas-enteras", n >= 4 && max <= 300, `Lupita a 1366: ${n} fichas enteras (se piden 4 o más); la más alta mide ${max} px (se pide 300 o menos)`);
});
await caso("fic-02-lupita-sin-cancelar-a-la-vista", "vista=fichas&rol=secretaria", async p => {
  const fs_ = await fichas(p);
  const con = fs_.filter(f => f.bots.some(b => /^Cancelar( orden)?$/.test(b.t) || b.titulo === "Cancelar orden")).map(f => f.pn);
  ok("fic-02-lupita-sin-cancelar-a-la-vista", con.length === 0, con.length ? `«Cancelar» a la vista en ${con.length} fichas (${con.slice(0, 4).join(", ")}): lo destructivo va detrás de «⋯»` : "«Cancelar» no está a la vista en ninguna ficha");
});
await caso("fic-03-lupita-cancela-desde-el-mas", "vista=fichas&rol=secretaria", async p => {
  const m = await abrirMas(p, "P-0585");
  const it = m ? m.getByRole("menuitem", { name: /Cancelar orden/ }) : null;
  const hay = it ? await it.count() : 0;
  if (hay) { await it.first().click(); await espera(p, 300); }
  const l = await log(p);
  ok("fic-03-lupita-cancela-desde-el-mas", hay === 1 && /accion:cancel_order P-0585/.test(l), `P-0585 (Empaque, sin facturar): ${m ? "el «⋯» abre" : "NO hay «⋯» en su ficha"}; «Cancelar orden» ${hay ? (/cancel_order/.test(l) ? "abre la cancelación" : "NO hace nada") : "no está"}`);
});
await caso("fic-04-lupita-sin-solo-lectura", "vista=fichas&rol=secretaria", async p => {
  const fs_ = await fichas(p);
  const con = fs_.filter(f => /solo lectura/i.test(f.texto)).map(f => f.pn);
  ok("fic-04-lupita-sin-solo-lectura", con.length === 0, con.length ? `«Orden validada — solo lectura» en ${con.length} fichas: le dice lo que no puede` : "ninguna ficha le dice «solo lectura»");
});
await caso("fic-05-lupita-imprime-con-nombre", "vista=fichas&rol=secretaria", async p => {
  const b = ficha(p, "P-0591").getByRole("button", { name: /Imprimir/ });
  const hay = await b.count();
  if (hay) { await b.first().click(); await espera(p, 300); }
  const l = await log(p);
  ok("fic-05-lupita-imprime-con-nombre", hay >= 1 && /accion:print P-0591/.test(l), hay ? `«Imprimir» ${/accion:print/.test(l) ? "pide la hoja" : "NO hace nada"}` : "el botón de imprimir de su ficha no tiene nombre («Imprimir») para el lector de pantalla ni se encuentra");
});
await caso("fic-06-le-toca-sin-emoji", "vista=fichas&rol=karla", async p => {
  const t = ((await ficha(p, "P-0591").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const emoji = t.match(/\p{Extended_Pictographic}/gu) || [];
  ok("fic-06-le-toca-sin-emoji", /Le toca a Gerardo/i.test(t) && /Máquina/.test(t) && emoji.length === 0,
    `Karla, P-0591: ${/Le toca a Gerardo/i.test(t) ? "dice a quién le toca" : "NO dice a quién le toca"}; ${emoji.length ? "con emoji en el texto: " + emoji.join(" ") : "sin emoji"} · «${(t.match(/[Ll]e toca a.*?(?=Recordar|$)/) || [""])[0].slice(0, 80)}»`);
});
await caso("fic-07-karla-recuerda", "vista=fichas&rol=karla", async p => {
  const b = ficha(p, "P-0591").getByRole("button", { name: /Recordar a Gerardo/ });
  const hay = await b.count();
  if (hay) { await b.first().click(); await espera(p, 300); }
  const l = await log(p);
  ok("fic-07-karla-recuerda", hay === 1 && /accion:nudge_responsible P-0591/.test(l), hay ? `«Recordar a Gerardo» ${/nudge/.test(l) ? "le avisa" : "NO hace nada"}` : "no está «Recordar a Gerardo»");
});

// ── Gerardo (producción): lo de todos los días al frente, lo raro en «⋯» (como el tablero) ──
await caso("fic-08-gerardo-empaque-al-frente-maquila-en-el-mas", "vista=fichas&rol=produccion", async p => {
  const f = ficha(p, "P-0593");
  const empaque = await f.getByRole("button", { name: /^Empaque$/ }).count();
  const maqFrente = await f.getByRole("button", { name: /Enviar a Maquila/i }).count();
  const m = await abrirMas(p, "P-0593");
  const it = m ? m.getByRole("menuitem", { name: /Enviar a maquila/i }) : null;
  const hay = it ? await it.count() : 0;
  if (hay) { await it.first().click(); await espera(p, 300); }
  const l = await log(p);
  ok("fic-08-gerardo-empaque-al-frente-maquila-en-el-mas", empaque === 1 && maqFrente === 0 && hay === 1 && /accion:send_maquila P-0593/.test(l),
    `P-0593 en Máquina: «Empaque» ${empaque ? "al frente" : "NO está"}; «Enviar a Maquila» ${maqFrente ? "AL FRENTE (0 en 60 días)" : "fuera del frente"}; en «⋯» ${hay ? (/send_maquila/.test(l) ? "está y abre su ventana" : "está pero NO hace nada") : "NO está"}`);
});
await caso("fic-09-gerardo-merma-en-el-mas", "vista=fichas&rol=produccion", async p => {
  const f = ficha(p, "P-0593");
  const frente = await f.getByRole("button", { name: /Registrar merma/ }).count();
  const m = await abrirMas(p, "P-0593");
  const it = m ? m.getByRole("menuitem", { name: /Registrar merma/ }) : null;
  const hay = it ? await it.count() : 0;
  if (hay) { await it.first().click(); await espera(p, 300); }
  const l = await log(p);
  ok("fic-09-gerardo-merma-en-el-mas", frente === 0 && hay === 1 && /accion:waste P-0593/.test(l),
    `P-0593: la merma ${frente ? "AL FRENTE (el bote se lee «borrar»; 0 en 60 días)" : "fuera del frente"}; en «⋯» ${hay ? (/accion:waste/.test(l) ? "está y abre su ventana" : "está pero NO hace nada") : "NO está"}`);
});
await caso("fic-10-empaque-salidas-al-frente", "vista=fichas&rol=produccion", async p => {
  const f = ficha(p, "P-0585");
  const sal = await f.getByRole("button", { name: /Enviar a Salidas/ }).count();
  const maqFrente = await f.getByRole("button", { name: /Enviar a Maquila/i }).count();
  const m = await abrirMas(p, "P-0585");
  const hay = m ? await m.getByRole("menuitem", { name: /Enviar a maquila/i }).count() : 0;
  ok("fic-10-empaque-salidas-al-frente", sal === 1 && maqFrente === 0 && hay === 1,
    `P-0585 en Empaque: «Enviar a Salidas» ${sal ? "al frente" : "NO está"}; «Enviar a Maquila» ${maqFrente ? "AL FRENTE" : "fuera del frente"}; en «⋯» ${hay ? "está" : "NO está"}`);
});
await caso("fic-11-sin-la-caja-de-la-guia", "vista=fichas&rol=produccion", async p => {
  const fs_ = await fichas(p);
  const con = fs_.filter(f => /Al terminar, pásala a Empaque/.test(f.texto)).length;
  const titulo = await ficha(p, "P-0593").locator('[role="group"][aria-label="Acciones de la orden"]').evaluate(g => g.parentElement.getAttribute("title") || "").catch(() => "");
  ok("fic-11-sin-la-caja-de-la-guia", con === 0 && /Empaque/.test(titulo),
    `la guía de Máquina ${con ? "repetida en " + con + " fichas" : "no se repite en las fichas"}; en la fila de acciones ${titulo ? "queda como ayuda: «" + titulo.slice(0, 60) + "»" : "NO queda (se perdió la ayuda)"}`);
});
await caso("fic-12-karla-sin-la-guia-encima-del-boton", "vista=fichas&rol=karla", async p => {
  const t = ((await ficha(p, "P-0580").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const boton = await ficha(p, "P-0580").getByRole("button", { name: /Asignar Folio y Entregar/i }).count();
  ok("fic-12-karla-sin-la-guia-encima-del-boton", boton === 1 && !/Asigna el folio fiscal/.test(t),
    `P-0580 en Salidas: «Asignar Folio y Entregar» ${boton ? "está" : "NO está"}; la caja «Asigna el folio fiscal…» ${/Asigna el folio fiscal/.test(t) ? "SIGUE encima del botón" : "ya no"}`);
});
// (vuelta 2: el tope de 260 era un número puesto antes de medir; la pausada lleva su franja abajo de los íconos —dos renglones de verdad— y mide
//   267. Lo que se pide: la ficha de todos los días en máquina, sin avisos (P-0593), en 220 o menos —medía 290 con el código de antes: guía, dos botones de etapa,
//   íconos y «Más ⟲2»/merma—, y ninguna de más de 280 —la más alta medía 360—)
await caso("fic-13-gerardo-fichas-mas-bajas", "vista=fichas&rol=produccion", async p => {
  const fs_ = await fichas(p), max = Math.max(...fs_.map(f => f.alto)), alta = fs_.find(f => f.alto === max), comun = fs_.find(f => f.pn === "P-0593");
  ok("fic-13-gerardo-fichas-mas-bajas", max <= 280 && !!comun && comun.alto <= 220,
    `Producción a 1366: P-0593 (en máquina, sin avisos) mide ${comun?.alto} px (se piden 220 o menos); la más alta, ${max} px (${alta?.pn}; se piden 280 o menos); ${enteras(fs_, 768)} enteras`);
});
for (const rol of ["secretaria", "produccion", "karla", "admin"]) {
  await caso("fic-14-letra-de-10-o-mas-" + rol, "vista=fichas&rol=" + rol, async p => {
    const chicas = (await fichas(p)).flatMap(f => f.chicas.map(c => f.pn + " " + c));
    ok("fic-14-letra-de-10-o-mas-" + rol, chicas.length === 0, chicas.length ? `${chicas.length} textos de menos de 10 px: ${[...new Set(chicas.map(c => c.replace(/^P-\d+ /, "")))].slice(0, 4).join(" · ")}` : "toda la letra de 10 px o más");
  });
  await caso("fic-15-botones-con-nombre-" + rol, "vista=fichas&rol=" + rol, async p => {
    const sin = (await fichas(p)).flatMap(f => f.bots.filter(b => !b.n).map(() => f.pn));
    ok("fic-15-botones-con-nombre-" + rol, sin.length === 0, sin.length ? `${sin.length} botones sin nombre (sólo ícono), en ${[...new Set(sin)].slice(0, 4).join(", ")}` : "todos los botones dicen qué hacen");
  });
}
await caso("fic-16-historial-en-la-fila", "vista=fichas&rol=produccion", async p => {
  const f = ficha(p, "P-0593");
  const h = f.getByRole("button", { name: /Historial/ });
  const hay = await h.count();
  const [yh, ye] = hay ? await Promise.all([h.first().boundingBox(), f.getByRole("button", { name: /^Empaque$/ }).first().boundingBox()]) : [null, null];
  const misma = !!yh && !!ye && Math.abs((yh.y + yh.height / 2) - (ye.y + ye.height / 2)) <= 6;
  if (hay) { await h.first().click(); await espera(p, 400); }
  const abierto = hay ? /Notas Rápidas|Agregar|nota/i.test(((await f.innerText().catch(() => "")) || "")) : false;
  ok("fic-16-historial-en-la-fila", hay === 1 && misma && abierto,
    hay ? `«Historial» ${misma ? "en la fila de las acciones" : "en OTRO renglón (y=" + Math.round(yh?.y) + " contra «Empaque» y=" + Math.round(ye?.y) + ")"}; ${abierto ? "abre lo de la orden" : "NO abre nada"}` : "no hay un botón «Historial» (es «Más» en su propio renglón)");
});
await caso("fic-17-lupita-mas-con-el-teclado", "vista=fichas&rol=secretaria", async p => {
  const b = ficha(p, "P-0585").getByRole("button", { name: /^Más de P-0585/ });
  const hay = await b.count();
  let abre = false, cierra = false, foco = false;
  if (hay) {
    await b.first().focus(); await p.keyboard.press("Enter"); await espera(p, 300);
    abre = (await p.getByRole("menu").count()) > 0;
    await p.keyboard.press("Escape"); await espera(p, 300);
    cierra = (await p.getByRole("menu").count()) === 0;
    foco = await b.first().evaluate(e => document.activeElement === e);
  }
  ok("fic-17-lupita-mas-con-el-teclado", hay === 1 && abre && cierra && foco,
    hay ? `Enter ${abre ? "abre" : "NO abre"} el «⋯»; Esc ${cierra ? "lo cierra" : "NO lo cierra"}${foco ? " y el foco regresa al «⋯»" : " y el foco se pierde"}` : "la ficha de Lupita no tiene «⋯» («Más de P-0585»)");
});
await caso("fic-18-doble-clic-cancelar-una-vez", "vista=fichas&rol=secretaria", async p => {
  const m = await abrirMas(p, "P-0585");
  const it = m ? m.getByRole("menuitem", { name: /Cancelar orden/ }) : null;
  const hay = it ? await it.count() : 0;
  if (hay) { await it.first().dblclick().catch(() => {}); await espera(p, 500); }
  const n = ((await log(p)).match(/accion:cancel_order P-0585/g) || []).length;
  ok("fic-18-doble-clic-cancelar-una-vez", hay === 1 && n === 1, hay ? `doble clic en «Cancelar orden»: ${n} ${n === 1 ? "vez" : "veces"}` : "no hay «Cancelar orden» en el «⋯» de su ficha");
});
await caso("fic-19-direccion-el-mas-completo", "vista=fichas&rol=admin", async p => {
  const empaque = await ficha(p, "P-0593").getByRole("button", { name: /^Empaque$/ }).count();
  const m = await abrirMas(p, "P-0593");
  const t = m ? ((await m.innerText().catch(() => "")) || "").replace(/\s+/g, " ") : "";
  const lleva = ["Enviar a maquila", "Registrar merma", "Regresar a etapa anterior", "Cancelar orden"].filter(x => new RegExp(x, "i").test(t));
  ok("fic-19-direccion-el-mas-completo", empaque === 1 && lleva.length === 4, `Dirección, P-0593: «Empaque» ${empaque ? "al frente" : "NO está"}; el «⋯» trae ${lleva.length ? lleva.join(", ") : "nada de eso"} (se piden las cuatro)`);
});
// (vuelta 2: la pausada se contradecía: «Arrastra esta orden a una máquina en el Tablero» encima de su franja con «Quitar espera»; el detalle
//   ya no ofrece avanzar una pausada)
await caso("fic-21-la-pausada-no-ofrece-avanzar", "vista=fichas&rol=produccion", async p => {
  const t = ((await ficha(p, "P-0604").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const quitar = await ficha(p, "P-0604").getByRole("button", { name: /Quitar espera/ }).count();
  ok("fic-21-la-pausada-no-ofrece-avanzar", quitar === 1 && !/Arrastra esta orden/.test(t),
    `P-0604 en espera (falta material): ${/Arrastra esta orden/.test(t) ? "SIGUE ofreciendo «Arrastra esta orden a una máquina»" : "no ofrece avanzar"}; «Quitar espera» ${quitar ? "está" : "NO está"}`);
});
// ── vuelta 3: por donde no se diseñó ──
await caso("fic-22-dos-mas-no-quedan-abiertos", "vista=fichas&rol=secretaria", async p => {
  const a = await abrirMas(p, "P-0585");
  const b = ficha(p, "P-0586").getByRole("button", { name: /^Más de P-0586/ });
  if (a && await b.count()) { await b.first().click(); await espera(p, 300); }
  const n = await p.getByRole("menu").count();
  ok("fic-22-dos-mas-no-quedan-abiertos", !!a && n === 1, a ? `abrir el «⋯» de P-0586 con el de P-0585 abierto: ${n} menús abiertos (se pide 1)` : "no hay «⋯» en P-0585");
});
await caso("fic-23-clic-afuera-cierra-el-mas", "vista=fichas&rol=secretaria", async p => {
  const a = await abrirMas(p, "P-0585");
  await p.mouse.click(5, 5); await espera(p, 300);
  const n = await p.getByRole("menu").count();
  const l = await log(p);
  ok("fic-23-clic-afuera-cierra-el-mas", !!a && n === 0 && !/accion:/.test(l), a ? `clic afuera: el «⋯» ${n ? "SIGUE abierto" : "se cierra"}${/accion:/.test(l) ? " y además hizo «" + l.trim().split("\n").pop() + "»" : ""}` : "no hay «⋯» en P-0585");
});
await caso("fic-24-karla-cambia-de-oc", "vista=fichas&rol=karla", async p => {
  await p.evaluate(() => window.__cambiar("P-0591", { purchase_order_id: "oc-1" })); await espera(p, 400);
  const m = await abrirMas(p, "P-0591");
  const it = m ? m.getByRole("menuitem", { name: /Cambiar de OC/ }) : null;
  const hay = it ? await it.count() : 0;
  if (hay) { await it.first().click(); await espera(p, 300); }
  const l = await log(p);
  ok("fic-24-karla-cambia-de-oc", hay === 1 && /accion:move_to_oc P-0591/.test(l), `P-0591 de una OC: ${m ? "el «⋯» del pie abre" : "NO hay «⋯» en el pie"}; «Cambiar de OC» ${hay ? (/move_to_oc/.test(l) ? "la mueve" : "NO hace nada") : "no está"}`);
});
await caso("fic-25-borrador-de-lupita", "vista=fichas&rol=secretaria", async p => {
  await p.evaluate(() => window.__cambiar("P-0600", { stage: "draft", validated_by_production: true, validated_by_preprensa: false })); await espera(p, 400);
  const f = ficha(p, "P-0600");
  const t = ((await f.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const editar = await f.getByRole("button", { name: /Editar Orden/ }).count();
  ok("fic-25-borrador-de-lupita", editar === 1 && /Prod/.test(t) && /Pre-p/.test(t) && !/esperando validación/i.test(t) && /Le toca a Producción y Pre-prensa/.test(t),
    `P-0600 en borrador (Producción ya validó): «Editar Orden» ${editar ? "está" : "NO está"}; «Prod · Pre-p» ${/Pre-p/.test(t) ? "dice cómo va" : "NO está"}; la caja «Orden esperando validación…» ${/esperando validación/i.test(t) ? "SIGUE" : "ya no"}; ${/Le toca a Producción y Pre-prensa/.test(t) ? "dice a quién le toca" : "NO dice a quién le toca"}`);
});
await caso("fic-26-maquila-sin-precio-dice-que-falta", "vista=fichas&rol=karla", async p => {
  await p.evaluate(() => window.__cambiar("P-0603", { stage: "maq_in_progress", order_type: "maquila", maq_price: 0, maq_cost: 0, maq_provider: "MAKILA" })); await espera(p, 400);
  const t = ((await ficha(p, "P-0603").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("fic-26-maquila-sin-precio-dice-que-falta", /Con MAKILA/.test(t) && /Le toca a/.test(t) && /falta el precio al cliente y el costo del proveedor/.test(t),
    `P-0603 en maquila sin precio ni costo, vista por Karla: «${(t.match(/Con MAKILA.*?(?=Recordar|$)/) || [t.slice(-120)])[0].slice(0, 140)}»`);
});
// (en este banco, a 1920 caben cuatro columnas de ~466 px —sin el menú lateral de App—: el pie en un renglón se mide en la tanda «todas», con la
//   ficha del ancho de la app, ~550 px, a 1366 y a 1920: td-16)
await caso("fic-27-lupita-a-1920", "vista=fichas&rol=secretaria", async p => {
  const fs_ = await fichas(p), max = Math.max(...fs_.map(f => f.alto));
  ok("fic-27-lupita-a-1920", max <= 300, `Lupita a 1920: la ficha más alta mide ${max} px (se piden 300 o menos)`);
}, { width: 1920, height: 1080 });
await caso("fic-20-a-1920-una-fila-de-acciones", "vista=fichas&rol=produccion", async p => {
  const f = ficha(p, "P-0593");
  const [e, i] = await Promise.all([f.getByRole("button", { name: /^Empaque$/ }).first().boundingBox().catch(() => null), f.getByRole("button", { name: /^Imprimir/ }).first().boundingBox().catch(() => null)]);
  const misma = !!e && !!i && Math.abs((e.y + e.height / 2) - (i.y + i.height / 2)) <= 6;
  ok("fic-20-a-1920-una-fila-de-acciones", misma, e && i ? `a 1920: «Empaque» y los íconos ${misma ? "en la misma fila" : "en DOS renglones"}` : "no encontré «Empaque» o «Imprimir»");
}, { width: 1920, height: 1080 });

await browser.close();
for (const r of res) console.log(r);
