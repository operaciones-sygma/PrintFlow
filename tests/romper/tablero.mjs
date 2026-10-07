// Tratar de ROMPER el TABLERO (el Kanban de Producción, el de Germán y las fichas) en su banco. Cada caso afirma lo que
// DEBERÍA ver o poder hacer la persona (Gerardo asigna órdenes a las máquinas, las pasa a Empaque y a Salidas; Marcelo igual;
// Germán con el CTP y la procesadora): una FALLA es un bug.
// Los datos salen del banco (tests/banco/gen-tablero.mjs), con órdenes y clientes como los de producción.
// Uso: node tablero.mjs <dir-capturas> [puerto=5194]   ·   SOLO=<regex> corre sólo los casos que coinciden (sabotajes)
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5194);
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
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  page.on("dialog", async d => { errs.push("diálogo del navegador: " + d.message().slice(0, 60)); await d.dismiss().catch(() => {}); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#log", { state: "attached" }); await page.waitForTimeout(600);
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png" }).catch(() => {});
  await page.close();
}
const espera = (p, ms = 300) => p.waitForTimeout(ms);
const log = async p => (await p.textContent("#log")) || "";
const texto = p => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
// la ficha arrastrable de una orden (en Listas, en una máquina o en Empaque)
const ficha = (p, pn) => p.locator("[draggable=true]", { hasText: pn }).first();
// el nombre de una máquina en su TARJETA (desde v10.84.62 también está en la franja «Así va la planta», arriba)
const enSuTarjeta = (p, nombre) => p.locator('div:not([aria-label="Así va la planta"] *)', { hasText: new RegExp("^" + nombre + "$") }).first();

// ── lo que corre en cada máquina, de un vistazo ──
// dónde está en pantalla un texto que se ve tal cual (fuera de los <select>: sus opciones también dicen «Printmaster 74»; y fuera
//   de la franja «Así va la planta» de v10.84.62, que va arriba y también dice «Printmaster 74» y «P-0591»)
const caja = (p, re) => p.evaluate(src => { const re = new RegExp(src);
  const el = [...document.querySelectorAll("body *")].find(e => !e.closest("select") && !e.closest('[aria-label="Así va la planta"]') && !e.children.length && re.test(e.textContent.trim()) && e.getClientRects().length);
  if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; }, re.source);
await caso("tab-01-lo-que-corre-en-cada-maquina", "vista=produccion", async p => {
  const [pm74, pm52, gto, a91, c93, a95] = await Promise.all([/^Printmaster 74$/, /^Printmaster 52$/, /^GTO 1 Color$/, /P-0591$/, /P-0593$/, /P-0595$/].map(re => caja(p, re)));
  const enColumna = (o, de, hasta) => !!o && !!de && !!hasta && o.x >= de.x - 4 && o.x < hasta.x && o.y > de.y;
  ok("tab-01-lo-que-corre-en-cada-maquina", enColumna(a91, pm74, pm52) && enColumna(c93, pm74, pm52) && enColumna(a95, pm52, gto),
    `PM74 ${pm74 ? "se ve" : "NO SE VE"}; su activa P-0591 ${enColumna(a91, pm74, pm52) ? "en su columna" : "FUERA de su columna"} y su cola P-0593 ${enColumna(c93, pm74, pm52) ? "también" : "FUERA"}; PM52 con P-0595 ${enColumna(a95, pm52, gto) ? "bien" : "MAL"}`);
});
// ── asignar una orden lista a una máquina: arrastrando y sin arrastrar (el selector) ──
await caso("tab-02-arrastrar-a-una-maquina", "vista=produccion", async p => {
  // (se toma la ficha de arriba: su centro cae en el selector «Enviar a máquina…» y un clic ahí lo abre en vez de arrastrar)
  const f = ficha(p, "P-0600"), caja = await f.boundingBox();
  await f.dragTo(enSuTarjeta(p, "GTO 1 Color"), { sourcePosition: { x: 20, y: 12 } }); await espera(p, 500);
  const l = await log(p);
  ok("tab-02-arrastrar-a-una-maquina", /drop:P-0600 → off_gto/.test(l), `arrastrar P-0600 a la GTO: ${/drop:P-0600/.test(l) ? l.match(/drop:P-0600[^\n]*/)[0] : "no llegó a nada"}${caja ? "" : " (no encontré la ficha)"}`);
});
await caso("tab-03-asignar-sin-arrastrar", "vista=produccion", async p => {
  const sel = ficha(p, "P-0601").locator("select").first();
  const opciones = await sel.locator("option").allTextContents();
  const gto = opciones.find(o => /GTO 1 Color/.test(o));
  if (gto) { await sel.selectOption({ label: gto }); await espera(p, 500); }
  const l = await log(p);
  ok("tab-03-asignar-sin-arrastrar", !!gto && /drop:P-0601 → off_gto/.test(l), `el selector de P-0601 ${gto ? "ofrece la GTO" : "NO ofrece la GTO (" + opciones.slice(0, 4).join(", ") + "…)"}; ${/drop:P-0601/.test(l) ? "la asigna" : "no la asigna"}`);
});
// ── abrir la orden desde su ficha ──
await caso("tab-04-abrir-la-orden", "vista=produccion", async p => {
  await ficha(p, "P-0585").click({ position: { x: 30, y: 12 } }); await espera(p, 400);
  const l = await log(p);
  ok("tab-04-abrir-la-orden", /accion:detail P-0585/.test(l), `clic en la ficha de P-0585 (Empaque): ${/accion:detail P-0585/.test(l) ? "abre el detalle" : "no abre nada"}`);
});
// ── una máquina en mantenimiento con trabajo montado: lo dice ──
await caso("tab-05-mantenimiento-con-trabajo-montado", "vista=produccion&caso=mantenimiento", async p => {
  const t = await texto(p);
  ok("tab-05-mantenimiento-con-trabajo-montado", /El trabajo sigue montado/.test(t), `PM52 en mantenimiento con P-0595 montada: ${/El trabajo sigue montado/.test(t) ? "lo dice" : "NO lo dice"}`);
});
// ── sin órdenes: las máquinas dicen que están libres, y nada truena ──
await caso("tab-06-sin-ordenes", "vista=produccion&caso=vacio", async p => {
  const t = await texto(p), n = await p.locator("[draggable=true]").count();
  ok("tab-06-sin-ordenes", n === 0 && /Disponible/.test(t), `sin órdenes: ${n} fichas; ${/Disponible/.test(t) ? "las máquinas dicen «Disponible»" : "las máquinas NO dicen que están libres"}`);
});
// ── buscar resalta dónde está la orden, sin esconder lo demás ──
await caso("tab-07-buscar-resalta", "vista=produccion&buscar=P-0594", async p => {
  const resaltada = await ficha(p, "P-0594").evaluate(el => { for (let x = el; x && x !== document.body; x = x.parentElement) { const o = getComputedStyle(x).outlineStyle; if (o && o !== "none") return true; } return false; });
  const otras = await p.locator("[draggable=true]").count();
  ok("tab-07-buscar-resalta", resaltada && otras > 5, `buscar P-0594: ${resaltada ? "resaltada" : "NO resaltada"}; ${otras} fichas siguen a la vista`);
});
// ── el tablero de Germán: lo del CTP y la procesadora ──
await caso("tab-08-tablero-de-german", "vista=german", async p => {
  const t = await texto(p);
  ok("tab-08-tablero-de-german", /P-0610/.test(t) && /P-0611/.test(t) && /P-0599/.test(t), `Germán ve P-0610 (CTP) ${/P-0610/.test(t) ? "sí" : "NO"}, P-0611 (procesadora) ${/P-0611/.test(t) ? "sí" : "NO"} y P-0599 por montar ${/P-0599/.test(t) ? "sí" : "NO"}`);
});
// ── a 1920 todo el renglón de máquinas cabe sin barra horizontal ──
await caso("tab-09-a-1920-sin-barra-horizontal", "vista=produccion", async p => {
  const d = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok("tab-09-a-1920-sin-barra-horizontal", d.sw <= d.cw + 1, `a 1920: ancho del contenido ${d.sw} contra ${d.cw} de la ventana`);
}, { width: 1920, height: 1080 });
await caso("tab-10-a-1366-sin-barra-horizontal", "vista=produccion", async p => {
  const d = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok("tab-10-a-1366-sin-barra-horizontal", d.sw <= d.cw + 1, `a 1366: ancho del contenido ${d.sw} contra ${d.cw} de la ventana`);
});

// ── v10.84.56: mover órdenes con red (P1 de la primera revisión independiente del tablero, 20/40) ──────────────────────
// el botón de una acción de UNA orden: el primero con ese nombre después de su ficha y antes de la ficha siguiente
const botonDe = async (p, pn, re) => {
  const i = await p.evaluate(([pn, src]) => { const re = new RegExp(src); let dentro = false;
    for (const el of document.querySelectorAll("[draggable=true], button")) {
      if (el.matches("[draggable=true]")) { if (dentro && !el.textContent.includes(pn)) break; if (el.textContent.includes(pn)) dentro = true; continue; }
      if (dentro && el.getClientRects().length && re.test((el.getAttribute("aria-label") || "") + " " + el.textContent)) return [...document.querySelectorAll("button")].indexOf(el);
    } return -1; }, [pn, re.source]);
  return i >= 0 ? p.locator("button").nth(i) : null;
};
// el texto del botón enfocado ("" si el foco no está en un botón: en el body, su innerText trae «Empaque» y «Deshacer» y
//   una prueba de foco pasaría sin deber; lo enseñó el sabotaje de v10.84.56)
const botonEnfocado = p => p.evaluate(() => document.activeElement?.tagName === "BUTTON" ? document.activeElement.innerText.trim() : "(" + (document.activeElement?.tagName || "nada") + ")");
const avances = (l, pn) => (l.match(new RegExp("accion:advance " + pn, "g")) || []).length;
const etapa = (p, pn) => p.evaluate(pn => { const o = window.__ordenes().find(x => x.production_number === pn); return o ? o.stage + "@" + (o.current_machine || "-") + ":" + o.machine_queue_position : "?"; }, pn);
await caso("tab-11-empaque-no-escribe-al-instante", "vista=produccion&deshacer_ms=1500", async p => {
  await (await botonDe(p, "P-0591", /Empaque/)).click(); await espera(p, 400);
  const l1 = await log(p), deshacer = await p.getByRole("button", { name: /Deshacer/ }).count();
  await espera(p, 1800);
  const l2 = await log(p);
  ok("tab-11-empaque-no-escribe-al-instante", avances(l1, "P-0591") === 0 && deshacer > 0 && avances(l2, "P-0591") === 1,
    `«Empaque» de P-0591: ${avances(l1, "P-0591") ? "ESCRIBIÓ AL INSTANTE" : "espera"}${deshacer ? " con «Deshacer»" : " SIN «Deshacer»"}; al terminar la espera ${avances(l2, "P-0591") === 1 ? "pasa a Empaque" : "avanzó " + avances(l2, "P-0591") + " veces"}`);
});
await caso("tab-12-deshacer-empaque", "vista=produccion&deshacer_ms=1500", async p => {
  await (await botonDe(p, "P-0591", /Empaque/)).click(); await espera(p, 700);   // (el escudo se traga los clics 600 ms)
  const d = p.getByRole("button", { name: /Deshacer/ }).first();
  if (await d.count()) await d.click();
  await espera(p, 2000);
  const l = await log(p), e = await etapa(p, "P-0591");
  const foco = await botonEnfocado(p);
  ok("tab-12-deshacer-empaque", avances(l, "P-0591") === 0 && e === "in_production@off_pm74:0" && /Empaque/.test(foco),
    `«Deshacer»: ${avances(l, "P-0591") ? "AVANZÓ IGUAL" : "no avanza"}; P-0591 queda en ${e}; el foco en «${foco.slice(0, 30)}»`);
});
await caso("tab-13-doble-clic-en-empaque", "vista=produccion&deshacer_ms=1500", async p => {
  // en la PM52 la siguiente (P-0609) mide lo mismo que la activa (P-0595): al subir, su «Empaque» queda bajo el cursor
  await (await botonDe(p, "P-0595", /Empaque/)).dblclick(); await espera(p, 2500);
  const l = await log(p), otras = (l.match(/accion:[a-z_]+ P-\d+/g) || []).filter(x => x !== "accion:advance P-0595");
  ok("tab-13-doble-clic-en-empaque", avances(l, "P-0595") === 1 && otras.length === 0, `doble clic en «Empaque» de P-0595: avanzó ${avances(l, "P-0595")} vez/veces${otras.length ? "; el 2º clic hizo " + otras.join(", ") : "; el 2º clic no llegó a nada"}`);
});
await caso("tab-14-pendiente-y-la-orden-cambia", "vista=produccion&deshacer_ms=1500", async p => {
  await (await botonDe(p, "P-0591", /Empaque/)).click(); await espera(p, 300);
  await p.evaluate(() => window.__cambiar("P-0591", { stage: "salidas", current_machine: null, machine_queue_position: null })); await espera(p, 2000);
  const l = await log(p), t = await texto(p);
  ok("tab-14-pendiente-y-la-orden-cambia", avances(l, "P-0591") === 0 && /P-0591/.test(t) && /no se pasó a Empaque/.test(t),
    `otra persona la mueve a Salidas durante la espera: ${avances(l, "P-0591") ? "LA REGRESÓ a Empaque" : "no avanza"}; ${/no se pasó a Empaque/.test(t) ? "lo dice" : "no dice nada"}`);
});
await caso("tab-15-a-listas-con-deshacer", "vista=produccion&deshacer_ms=1500", async p => {
  const b = await botonDe(p, "P-0593", /A Listas/);
  const visible = b ? (await b.innerText()).trim() : "";
  if (b) await b.click(); await espera(p, 400);
  const l1 = await log(p); await espera(p, 1800); const l2 = await log(p);
  ok("tab-15-a-listas-con-deshacer", /A Listas/.test(visible) && !/accion:return_to_ready P-0593/.test(l1) && /accion:return_to_ready P-0593/.test(l2),
    `P-0593 en la cola: ${b ? "«" + (visible || "(sólo ícono)") + "»" : "NO hay «A Listas»"}; ${/return_to_ready P-0593/.test(l1) ? "LA SACÓ AL INSTANTE" : "espera"}; ${/return_to_ready P-0593/.test(l2) ? "luego regresa a Listas" : "no regresa"}`);
});
await caso("tab-16-activar-pregunta-que-detiene", "vista=produccion", async p => {
  await (await botonDe(p, "P-0593", /Activar/)).click(); await espera(p, 700);
  const t = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map(d => d.innerText.replace(/\s+/g, " ")).join(" | "));
  const l1 = await log(p);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const queda = await p.locator('[role="dialog"]').count(), l2 = await log(p);
  let l3 = "";
  const b = await botonDe(p, "P-0593", /Activar/); if (b) { await b.click(); await espera(p, 700); const si = p.getByRole("button", { name: /Sí, arrancar/ }); if (await si.count()) { await si.click(); await espera(p, 400); } l3 = await log(p); }
  ok("tab-16-activar-pregunta-que-detiene", /P-0593/.test(t) && /Detiene.*P-0591/.test(t) && !/reorder_in_machine/.test(l1 + l2) && queda === 0 && /accion:reorder_in_machine P-0593 \{"newPosition":0\}/.test(l3),
    `«Activar» P-0593 con P-0591 corriendo: ${t ? "pregunta «" + t.slice(0, 110) + "»" : /reorder/.test(l1) ? "ARRANCÓ SIN PREGUNTAR" : "no hace nada"}; Esc ${queda ? "no la cierra" : "la cierra"}; al confirmar ${/reorder_in_machine P-0593/.test(l3) ? "arranca" : "no arranca"}`);
});
await caso("tab-17-activar-en-maquina-libre-no-pregunta", "vista=produccion", async p => {
  // la PM74 se queda sin activa (P-0591 se fue a Empaque): arrancar P-0593 no detiene nada
  await p.evaluate(() => window.__cambiar("P-0591", { stage: "packaging", current_machine: "vm_manual", machine_queue_position: 2 })); await espera(p, 400);
  await (await botonDe(p, "P-0593", /Activar/)).click(); await espera(p, 600);
  const dialogos = await p.locator('[role="dialog"]').count(), l = await log(p);
  ok("tab-17-activar-en-maquina-libre-no-pregunta", dialogos === 0 && /accion:reorder_in_machine P-0593/.test(l), `«Activar» con la máquina libre: ${dialogos ? "PREGUNTA (no detiene nada)" : "no pregunta"}; ${/reorder_in_machine P-0593/.test(l) ? "arranca" : "no arranca"}`);
});
await caso("tab-18-salir-con-algo-pendiente-lo-hace", "vista=produccion&deshacer_ms=5000", async p => {
  await (await botonDe(p, "P-0591", /Empaque/)).click(); await espera(p, 300);
  await p.evaluate(() => window.__vista("fichas")); await espera(p, 600);
  const l = await log(p);
  ok("tab-18-salir-con-algo-pendiente-lo-hace", avances(l, "P-0591") === 1, `salir del tablero con «Empaque» por deshacer: ${avances(l, "P-0591") === 1 ? "se hace al salir" : avances(l, "P-0591") ? "avanzó " + avances(l, "P-0591") + " veces" : "SE PIERDE"}`);
});
await caso("tab-19-dos-maquinas-a-la-vez", "vista=produccion&deshacer_ms=1500", async p => {
  await (await botonDe(p, "P-0591", /Empaque/)).click(); await espera(p, 800);
  await (await botonDe(p, "P-0595", /Empaque/)).click(); await espera(p, 2400);
  const l = await log(p);
  ok("tab-19-dos-maquinas-a-la-vez", avances(l, "P-0591") === 1 && avances(l, "P-0595") === 1, `«Empaque» en la PM74 y luego en la PM52: P-0591 ${avances(l, "P-0591")}, P-0595 ${avances(l, "P-0595")}`);
});

// vuelta 3 de v10.84.56, por donde no se diseñó
await caso("tab-20-arrastrarla-mientras-espera", "vista=produccion&deshacer_ms=1500", async p => {
  await (await botonDe(p, "P-0591", /Empaque/)).click(); await espera(p, 700);
  await ficha(p, "P-0591").dragTo(enSuTarjeta(p, "GTO 1 Color"), { sourcePosition: { x: 20, y: 12 } }); await espera(p, 1800);
  const l = await log(p), t = await texto(p);
  ok("tab-20-arrastrarla-mientras-espera", /drop:P-0591 → off_gto/.test(l) && avances(l, "P-0591") === 0 && /no se pasó a Empaque/.test(t),
    `«Empaque» y luego arrastrarla a la GTO: ${/drop:P-0591/.test(l) ? "se movió" : "NO se movió"}; ${avances(l, "P-0591") ? "Y ADEMÁS pasó a Empaque" : "no pasa a Empaque"}; ${/no se pasó a Empaque/.test(t) ? "lo dice" : "no lo dice"}`);
});
await caso("tab-21-la-cancelan-mientras-espera", "vista=produccion&deshacer_ms=1500", async p => {
  await (await botonDe(p, "P-0593", /A Listas/)).click(); await espera(p, 300);
  await p.evaluate(() => window.__cambiar("P-0593", { stage: "cancelled", current_machine: null, machine_queue_position: null })); await espera(p, 2000);
  const l = await log(p), t = await texto(p);
  ok("tab-21-la-cancelan-mientras-espera", !/return_to_ready P-0593/.test(l) && /no se regresó a Listas/.test(t), `la cancelan durante «A Listas»: ${/return_to_ready P-0593/.test(l) ? "LA REGRESÓ A LISTAS" : "no se toca"}; ${/no se regresó a Listas/.test(t) ? "lo dice" : "no lo dice"}`);
});
await caso("tab-22-con-el-teclado", "vista=produccion&deshacer_ms=3000", async p => {
  const b = await botonDe(p, "P-0591", /Empaque/); await b.focus(); await p.keyboard.press("Enter"); await espera(p, 300);
  const enDeshacer = /Deshacer/.test(await botonEnfocado(p));
  await p.keyboard.press("Enter"); await espera(p, 400);
  const foco = await botonEnfocado(p);
  await espera(p, 3000); const l = await log(p);
  ok("tab-22-con-el-teclado", enDeshacer && /Empaque/.test(foco) && avances(l, "P-0591") === 0, `Enter en «Empaque»: el foco ${enDeshacer ? "pasa a «Deshacer»" : "NO pasa a «Deshacer»"}; Enter otra vez deshace y el foco regresa a «${foco.slice(0, 20)}»; ${avances(l, "P-0591") ? "AVANZÓ" : "no avanza"}`);
});
await caso("tab-23-dos-pendientes-en-la-misma-maquina", "vista=produccion&deshacer_ms=1500", async p => {
  // primero «Empaque» (se hace primero: P-0593 sube a activa mientras espera su «A Listas»); el lugar en la fila cambia y eso
  //   no la vuelve vieja (sigue en la misma máquina y etapa)
  await (await botonDe(p, "P-0591", /Empaque/)).click(); await espera(p, 700);
  await (await botonDe(p, "P-0593", /A Listas/)).click(); await espera(p, 2600);
  const l = await log(p);
  ok("tab-23-dos-pendientes-en-la-misma-maquina", /return_to_ready P-0593/.test(l) && avances(l, "P-0591") === 1, `«A Listas» en P-0593 y «Empaque» en P-0591 (PM74): P-0593 ${/return_to_ready P-0593/.test(l) ? "regresa" : "NO regresa"}, P-0591 ${avances(l, "P-0591") === 1 ? "pasa a Empaque" : "avanzó " + avances(l, "P-0591")}`);
});
await caso("tab-24-activar-y-la-mueven-mientras-pregunta", "vista=produccion", async p => {
  await (await botonDe(p, "P-0593", /Activar/)).click(); await espera(p, 700);
  await p.evaluate(() => window.__cambiar("P-0593", { current_machine: "off_gto", machine_queue_position: 0 })); await espera(p, 300);
  const si = p.getByRole("button", { name: /Sí, arrancar/ }); if (await si.count()) { await si.click(); await espera(p, 400); }
  const l = await log(p), t = await texto(p);
  ok("tab-24-activar-y-la-mueven-mientras-pregunta", !/reorder_in_machine P-0593/.test(l) && /no se arrancó/.test(t), `la mueven a la GTO con la pregunta abierta: ${/reorder_in_machine/.test(l) ? "LA ARRANCÓ" : "no la arranca"}; ${/no se arrancó/.test(t) ? "lo dice" : "no lo dice"}`);
});
await caso("tab-25-cancelar-activar-regresa-el-foco", "vista=produccion", async p => {
  await (await botonDe(p, "P-0593", /Activar/)).click(); await espera(p, 700);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const foco = await botonEnfocado(p);
  ok("tab-25-cancelar-activar-regresa-el-foco", /Activar/.test(foco), `Esc en la pregunta de «Activar»: el foco queda en «${foco.slice(0, 30)}»`);
});
await caso("tab-26-un-cambio-inocente-no-cancela", "vista=produccion&deshacer_ms=1500", async p => {
  await (await botonDe(p, "P-0591", /Empaque/)).click(); await espera(p, 300);
  await p.evaluate(() => window.__cambiar("P-0591", { notes: "la actualizó otra persona" })); await espera(p, 2000);
  const l = await log(p);
  ok("tab-26-un-cambio-inocente-no-cancela", avances(l, "P-0591") === 1, `otra persona cambia las notas durante la espera: ${avances(l, "P-0591") === 1 ? "igual pasa a Empaque" : "avanzó " + avances(l, "P-0591") + " veces"}`);
});
await caso("tab-27-la-cola-no-se-desborda", "vista=produccion&caso=lleno", async p => {
  // con la cola llena a 1366, «Activar» y «A Listas» caben dentro de su tarjeta
  const r = await p.evaluate(() => { const fuera = [];
    for (const it of document.querySelectorAll("[draggable=true]")) { const ri = it.getBoundingClientRect();
      for (const b of it.querySelectorAll("button")) { const rb = b.getBoundingClientRect(); if (rb.width && (rb.right > ri.right + 1 || rb.left < ri.left - 1)) fuera.push((b.innerText || "").trim() + "@" + (it.innerText.match(/P-\d+/) || [""])[0]); } }
    return fuera; });
  ok("tab-27-la-cola-no-se-desborda", r.length === 0, r.length ? "se salen de su tarjeta: " + r.slice(0, 5).join(", ") : "todo cabe");
});

// ── v10.84.57: se lee qué corre en cada máquina (P1 de la primera revisión: a 1366 decían «CALZA…», «P…», «AL…») ──────────
// el cliente de cada ficha visible: ¿se ve completo? (un nombre de hasta 40 letras no puede salir con «…», ni a lo ancho ni a lo
//   alto; uno más largo puede cortarse en la segunda línea)
const nombresCortados = p => p.evaluate(() => {
  const ords = window.__ordenes(), cortados = [];
  for (const card of document.querySelectorAll("[draggable=true]")) {
    if (!card.getClientRects().length) continue;
    const pn = (card.innerText.match(/P-\d{4}/) || [])[0], o = ords.find(x => x.production_number === pn);
    if (!o || !o.client || o.client.length > 40) continue;
    // (por su texto PROPIO: en Listas el nombre va suelto junto al ícono de la asa, en un div que tiene hijos)
    const el = [...card.querySelectorAll("*")].find(e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim() === o.client);
    if (!el) { cortados.push(pn + " (sin su nombre)"); continue; }
    for (let x = el; x && x !== card; x = x.parentElement) { const cs = getComputedStyle(x);
      if ((x.scrollWidth > x.clientWidth + 1 || x.scrollHeight > x.clientHeight + 1) && (cs.overflow !== "visible" || cs.textOverflow === "ellipsis")) { cortados.push(pn + " «" + o.client.slice(0, 18) + "…»"); break; } }
  }
  return cortados;
});
await caso("tab-28-se-lee-que-corre-a-1366", "vista=produccion", async p => {
  const c = await nombresCortados(p);
  ok("tab-28-se-lee-que-corre-a-1366", c.length === 0, c.length ? "a 1366 salen cortados: " + c.join(", ") : "a 1366 todos los nombres se leen completos");
});
await caso("tab-29-se-lee-que-corre-a-1920", "vista=produccion", async p => {
  const c = await nombresCortados(p);
  ok("tab-29-se-lee-que-corre-a-1920", c.length === 0, c.length ? "a 1920 salen cortados: " + c.join(", ") : "a 1920 todos los nombres se leen completos");
}, { width: 1920, height: 1080 });
await caso("tab-30-un-solo-reloj-en-la-activa", "vista=produccion", async p => {
  // el marco «Activa» ya trae el reloj: la ficha de adentro no lo repite (le quitaba el ancho al nombre)
  const r = await p.evaluate(() => { const fuera = [];
    for (const card of document.querySelectorAll("[draggable=true]")) { const marco = card.parentElement;
      if (!card.getClientRects().length || ![...marco.children].some(h => /^activa/i.test((h.innerText || "").trim()))) continue;
      const relojes = [...marco.querySelectorAll("span")].filter(s => /^\d+h \d+m$|^\d+m$/.test(s.textContent.trim()) && /Geist Mono/.test(getComputedStyle(s).fontFamily)).length;
      fuera.push(((card.innerText.match(/P-\d{4}/) || [""])[0]) + ":" + relojes); }
    return fuera; });
  const malos = r.filter(x => !x.endsWith(":1"));
  ok("tab-30-un-solo-reloj-en-la-activa", r.length > 0 && malos.length === 0, `relojes por orden activa: ${r.join(", ")}`);
});

// vuelta 3 de v10.84.57, por donde no se diseñó
const fichaSeSale = (p, pn) => p.evaluate(pn => { const c = [...document.querySelectorAll("[draggable=true]")].find(x => x.innerText.includes(pn));
  if (!c) return "no está"; const r = c.getBoundingClientRect(), m = c.parentElement.getBoundingClientRect();
  return { anchoFicha: Math.round(r.width), anchoMarco: Math.round(m.width), seSale: c.scrollWidth > c.clientWidth + 1 || r.right > m.right + 1 }; }, pn);
await caso("tab-31-nombre-larguisimo-en-la-maquina", "vista=produccion", async p => {
  await p.evaluate(() => window.__cambiar("P-0591", { client: "GOBIERNO DEL ESTADO DE GUANAJUATO, SECRETARÍA DE EDUCACIÓN PÚBLICA DEL ESTADO" })); await espera(p, 400);
  const r = await fichaSeSale(p, "P-0591");
  const lineas = await p.evaluate(() => { const c = [...document.querySelectorAll("[draggable=true]")].find(x => x.innerText.includes("P-0591"));
    const el = [...c.querySelectorAll("*")].find(e => /^GOBIERNO DEL ESTADO/.test([...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("")));
    if (!el) return -1; const cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;   // («normal» no es un número)
    return Math.round(el.getBoundingClientRect().height / lh); });
  ok("tab-31-nombre-larguisimo-en-la-maquina", !r.seSale && lineas >= 1 && lineas <= 3, `un nombre de 79 letras en la PM74: ${r.seSale ? "SE SALE de la ficha" : "no se sale"}; ocupa ${lineas} línea(s) (tope 3)`);
});
await caso("tab-32-nombre-sin-espacios", "vista=produccion", async p => {
  await p.evaluate(() => window.__cambiar("P-0595", { client: "IMPRESIONESYEMPAQUESDELBAJIOSADECV2026" })); await espera(p, 400);
  const r = await fichaSeSale(p, "P-0595");
  ok("tab-32-nombre-sin-espacios", !r.seSale, `un nombre de 38 letras sin espacios: ${r.seSale ? "SE SALE de la ficha" : "se parte y no se sale"}`);
});
await caso("tab-33-empaque-conserva-su-reloj", "vista=produccion", async p => {
  // en Empaque no hay marco que diga el tiempo: la ficha lo trae
  const r = await p.evaluate(() => [...document.querySelectorAll("[draggable=true]")].filter(c => /P-0585|P-0586/.test(c.innerText)).map(c =>
    (c.innerText.match(/P-\d{4}/) || [""])[0] + ":" + [...c.querySelectorAll("span")].filter(s => /^\d+h \d+m$|^\d+m$/.test(s.textContent.trim()) && /Geist Mono/.test(getComputedStyle(s).fontFamily)).length));   // (sólo el reloj: no el span que lo envolvía)
  ok("tab-33-empaque-conserva-su-reloj", r.includes("P-0585:1"), `relojes en Empaque: ${r.join(", ")} (P-0585 tiene su bitácora abierta; P-0586 no)`);
});
const anchoDerecha = p => p.evaluate(() => { const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const h = [...document.querySelectorAll("span,div")].find(e => propio(e) === "Empaque" && e.closest("div[style*='sticky']"));
  const col = h ? h.closest("div[style*='sticky']") : null; return col ? Math.round(col.getBoundingClientRect().width) : -1; });
await caso("tab-34-la-columna-derecha-a-1366-y-1920", "vista=produccion", async p => {
  const a1366 = await anchoDerecha(p);
  await p.setViewportSize({ width: 1920, height: 1080 }); await espera(p, 500);
  const a1920 = await anchoDerecha(p);
  ok("tab-34-la-columna-derecha-a-1366-y-1920", a1366 >= 255 && a1366 <= 270 && a1920 >= 300, `la columna de Empaque mide ${a1366} px a 1366 y ${a1920} px a 1920`);
});
await caso("tab-35-tableta-sin-barra-horizontal", "vista=produccion", async p => {
  const d = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok("tab-35-tableta-sin-barra-horizontal", d.sw <= d.cw + 1, `a 768 (tableta): ancho del contenido ${d.sw} contra ${d.cw}`);
}, { width: 768, height: 1024 });

// ── v10.84.58: se ve lo atrasado y lo detenido (P1 de la primera revisión: «3 vencidas» sin decir cuáles, lo vencido sólo con
//   la fecha en rojo, 43 h en Empaque igual que 12 min, la cola sin URGENTE ni REIMPRIMIR) ─────────────────────────────────
// el texto visible de la ficha de una orden
const textoFicha = (p, pn) => p.evaluate(pn => { const c = [...document.querySelectorAll("[draggable=true]")].find(x => x.innerText.includes(pn)); return c ? c.innerText.replace(/\s+/g, " ") : ""; }, pn);
await caso("tab-36-vencidas-dice-cuales", "vista=produccion", async p => {
  const chip = p.getByRole("button", { name: /vencidas?/ }).first();
  const esBoton = await chip.count();
  if (esBoton) { await chip.click(); await espera(p, 400); }
  // (sólo la lista: en la página entera «P-0594 … Printmaster 74 … 2º» sale también de las opciones de su selector)
  const t = await p.evaluate(() => (document.querySelector('[aria-label="Órdenes vencidas"]')?.innerText || "").replace(/\s+/g, " "));
  ok("tab-36-vencidas-dice-cuales", esBoton > 0 && /P-0594[^|]*Printmaster 74[^|]*2º en la fila/.test(t) && /P-0601[^|]*Órdenes Listas/.test(t),
    `«2 vencidas»: ${esBoton ? "se aprieta" : "NO es botón"}; ${/P-0594[^|]*Printmaster 74/.test(t) ? "dice que P-0594 está en la PM74, 2º en la fila" : "no dice dónde está P-0594"}; ${/P-0601[^|]*Órdenes Listas/.test(t) ? "y P-0601 en Listas" : "ni P-0601"}`);
});
await caso("tab-37-ir-a-la-vencida", "vista=produccion", async p => {
  await p.evaluate(() => window.scrollTo(0, 0));
  const chip = p.getByRole("button", { name: /vencidas?/ }).first();
  if (await chip.count()) { await chip.click(); await espera(p, 400); }
  const ir = p.getByRole("button", { name: /P-0594/ }).first();
  if (await ir.count()) { await ir.click(); await espera(p, 900); }
  const r = await p.evaluate(() => { const c = [...document.querySelectorAll("[draggable=true]")].find(x => x.innerText.includes("P-0594")); if (!c) return null;
    const b = c.getBoundingClientRect(); let resaltada = false; for (let x = c; x && x !== document.body; x = x.parentElement) { const o = getComputedStyle(x).outlineStyle; if (o && o !== "none") { resaltada = true; break; } }
    return { aLaVista: b.top >= 0 && b.bottom <= innerHeight, resaltada }; });
  ok("tab-37-ir-a-la-vencida", !!r && r.aLaVista && r.resaltada, `tocar P-0594 en la lista: ${!r ? "no hay a dónde ir" : (r.aLaVista ? "su ficha queda a la vista" : "su ficha NO queda a la vista") + (r.resaltada ? " y resaltada" : " sin resaltar")}`);
});
await caso("tab-38-retraso-con-palabra-en-la-cola", "vista=produccion", async p => {
  const t = await textoFicha(p, "P-0594");
  ok("tab-38-retraso-con-palabra-en-la-cola", /RETRASO/.test(t), `P-0594 vencida, 2ª en la cola de la PM74: ${/RETRASO/.test(t) ? "dice RETRASO" : "sólo la fecha en rojo"}`);
});
await caso("tab-39-alertas-en-la-cola", "vista=produccion", async p => {
  await p.evaluate(() => window.__cambiar("P-0593", { priority: "urgente", needs_reprint: true, sin_empaque_sygma: true })); await espera(p, 400);
  const t = await textoFicha(p, "P-0593");
  ok("tab-39-alertas-en-la-cola", /Urgente/i.test(t) && /REIMPRIMIR|Reimprimir/.test(t) && /Sin logo SYGMA/.test(t), `P-0593 en la cola, urgente, por reimprimir y sin logo: «${t.slice(0, 120)}»`);
});
await caso("tab-40-urgente-con-palabra-en-listas", "vista=produccion", async p => {
  const t = await textoFicha(p, "P-0600");
  ok("tab-40-urgente-con-palabra-en-listas", /Urgente/i.test(t), `P-0600 urgente en Listas: ${/Urgente/i.test(t) ? "lo dice" : "sólo un punto rojo"}`);
});
await caso("tab-41-detenida-en-empaque-dice-desde-cuando", "vista=produccion", async p => {
  // P-0585 lleva desde antier en Empaque: «47h 12m» no se lee; «desde el …» sí, y en otro tono
  await p.evaluate(() => window.__cambiar("P-0585", { machine_log: [{ machine: "vm_manual", started: new Date(Date.now() - 47 * 3600000).toISOString() }] })); await espera(p, 600);
  const t = await textoFicha(p, "P-0585");
  ok("tab-41-detenida-en-empaque-dice-desde-cuando", /desde /.test(t) && !/\b\d{2,}h \d+m\b/.test(t), `P-0585 con 47 h en Empaque: «${(t.match(/desde [^·]*|\d+h \d+m/) || ["(sin reloj)"])[0].trim()}»`);
});
await caso("tab-42-la-busqueda-dice-donde", "vista=produccion&buscar=P-0594", async p => {
  // (sólo el aviso de la búsqueda, el renglón de «El tablero no está filtrado»)
  const t = await p.evaluate(() => { const el = [...document.querySelectorAll("span")].find(x => x.textContent.trim() === "El tablero no está filtrado"); return el ? el.parentElement.innerText.replace(/\s+/g, " ") : ""; });
  ok("tab-42-la-busqueda-dice-donde", /P-0594[^.]*Printmaster 74[^.]*2º en la fila/.test(t), `buscar P-0594: ${/Printmaster 74/.test(t) ? "dice dónde" : "sólo «1 orden resaltada»"}`);
});

// vuelta 3 de v10.84.58, por donde no se diseñó
await caso("tab-43-esc-cierra-la-lista-y-regresa-el-foco", "vista=produccion", async p => {
  await p.getByRole("button", { name: /vencidas?/ }).first().click(); await espera(p, 400);
  await p.keyboard.press("Tab"); await espera(p, 150);   // desde el chip, el Tab entra a la lista (la más vencida primero)
  const enLista = await botonEnfocado(p);
  await p.keyboard.press("Escape"); await espera(p, 400);
  const lista = await p.locator('[aria-label="Órdenes vencidas"]').count(), foco = await botonEnfocado(p);
  ok("tab-43-esc-cierra-la-lista-y-regresa-el-foco", /P-0601/.test(enLista) && lista === 0 && /vencidas?/.test(foco), `Tab desde el chip: ${/P-0601/.test(enLista) ? "entra a la lista" : "va a «" + enLista + "»"}; Esc ${lista ? "NO la cierra" : "la cierra"} y el foco queda en «${foco}»`);
});
await caso("tab-44-vencida-en-una-seccion-plegada", "vista=produccion", async p => {
  // Digital empieza plegada: ir a una vencida que está ahí la abre y la deja a la vista
  await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 3); window.__cambiar("P-0596", { due_date: d.toISOString().slice(0, 10) }); }); await espera(p, 400);
  await p.getByRole("button", { name: /vencidas?/ }).first().click(); await espera(p, 400);
  const ir = p.getByRole("button", { name: /P-0596/ }).first(); if (await ir.count()) { await ir.click(); await espera(p, 1000); }
  const r = await p.evaluate(() => { const c = [...document.querySelectorAll("[draggable=true]")].find(x => x.innerText.includes("P-0596")); if (!c || !c.getClientRects().length) return null; const b = c.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; });
  ok("tab-44-vencida-en-una-seccion-plegada", r === true, `P-0596 vencida en la DocuColor (Digital plegada): ${r === null ? "su ficha sigue escondida" : r ? "se abre la sección y queda a la vista" : "se abre pero no queda a la vista"}`);
});
await caso("tab-45-la-que-corre-dice-corriendo", "vista=produccion", async p => {
  await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); window.__cambiar("P-0591", { due_date: d.toISOString().slice(0, 10) }); }); await espera(p, 400);
  await p.getByRole("button", { name: /vencidas?/ }).first().click(); await espera(p, 400);
  const t = await p.evaluate(() => (document.querySelector('[aria-label="Órdenes vencidas"]')?.innerText || "").replace(/\s+/g, " "));
  ok("tab-45-la-que-corre-dice-corriendo", /P-0591[^P]*Printmaster 74, corriendo/.test(t), `P-0591 vencida y corriendo en la PM74: «${(t.match(/P-0591[^P]*/) || ["(no está)"])[0].trim()}»`);
});
await caso("tab-46-reloj-de-hoy-sigue-en-horas", "vista=produccion", async p => {
  await p.evaluate(() => window.__cambiar("P-0585", { machine_log: [{ machine: "vm_manual", started: new Date(Date.now() - 5 * 60000).toISOString() }] })); await espera(p, 600);
  const t = await textoFicha(p, "P-0585");
  ok("tab-46-reloj-de-hoy-sigue-en-horas", /\b\d+m\b/.test(t) && !/desde /.test(t), `P-0585 con 5 minutos en Empaque: «${(t.match(/desde [^·]*|\d+h \d+m|\b\d+m\b/) || ["(sin reloj)"])[0].trim()}»`);
});
await caso("tab-47-reloj-de-hace-mas-de-una-semana", "vista=produccion", async p => {
  await p.evaluate(() => window.__cambiar("P-0585", { machine_log: [{ machine: "vm_manual", started: new Date(Date.now() - 9 * 86400000).toISOString() }] })); await espera(p, 600);
  const t = await textoFicha(p, "P-0585");
  ok("tab-47-reloj-de-hace-mas-de-una-semana", /desde el \d{1,2}/.test(t), `P-0585 con 9 días en Empaque: «${(t.match(/desde [^·]*/) || ["(sin «desde»)"])[0].trim().slice(0, 40)}»`);
});
await caso("tab-48-busqueda-con-varias", "vista=produccion&buscar=LIC.", async p => {
  const t = await p.evaluate(() => { const el = [...document.querySelectorAll("span")].find(x => x.textContent.trim() === "El tablero no está filtrado"); return el ? el.parentElement.innerText.replace(/\s+/g, " ") : ""; });
  ok("tab-48-busqueda-con-varias", /órdenes resaltadas/.test(t) && / en (Órdenes Listas|Printmaster|Empaque|Salidas)/.test(t) && /y \d+ más/.test(t), `buscar «LIC.»: «${t.slice(0, 160)}»`);
});
await caso("tab-49-las-alertas-no-se-salen", "vista=produccion&caso=lleno", async p => {
  await p.evaluate(() => { for (const pn of ["P-0593", "P-0594", "P-0591"]) window.__cambiar(pn, { priority: "urgente", needs_reprint: true, sin_empaque_sygma: true, returned_at: "2026-10-02T12:00:00Z" }); }); await espera(p, 500);
  const r = await p.evaluate(() => { const fuera = [];
    for (const it of document.querySelectorAll("[draggable=true]")) { const ri = it.getBoundingClientRect(); if (!ri.width) continue;
      for (const b of it.querySelectorAll("span")) { const rb = b.getBoundingClientRect(); if (rb.width && (rb.right > ri.right + 1)) { fuera.push((b.innerText || "").trim().slice(0, 20) + "@" + (it.innerText.match(/P-\d+/) || [""])[0]); break; } } }
    return fuera; });
  ok("tab-49-las-alertas-no-se-salen", r.length === 0, r.length ? "se salen de su ficha: " + r.slice(0, 5).join(", ") : "todas caben");
});

// ── v10.84.59: los P2 de la primera revisión: Merma y Maquila (de qué orden, que no acepte basura, diálogos de verdad), el
//   contraste y lo menor ────────────────────────────────────────────────────────────────────────────────────────────────────
// (desde v10.84.63, «Enviar a maquila» y «Registrar merma» viven en el «⋯» de la ficha de Empaque: si no está a la vista, se abre)
const abrirDe = async (p, pn, re) => { let b = await botonDe(p, pn, re);
  if (!b) { const mas = await botonDe(p, pn, /^Más de /); if (mas) { await mas.click(); await espera(p, 300); b = await botonDe(p, pn, re); } }
  if (!b) return false; await b.click(); await espera(p, 700); return true; };
const dialogo = p => p.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d ? d.innerText.replace(/\s+/g, " ") : ""; });
const mermas = l => (l.match(/merma P-\d+[^\n]*/g) || []);
await caso("tab-50-merma-dice-de-que-orden", "vista=produccion", async p => {
  await abrirDe(p, "P-0585", /Registrar merma/);
  const d = await dialogo(p);
  ok("tab-50-merma-dice-de-que-orden", /P-0585/.test(d) && /SILVIA/.test(d), `«Registrar merma» de P-0585: ${d ? (/P-0585/.test(d) ? "dice de qué orden es" : "NO dice de qué orden es") : "no es un diálogo (sin role=\"dialog\")"}`);
});
await caso("tab-51-merma-vacia-no-se-guarda", "vista=produccion", async p => {
  await abrirDe(p, "P-0585", /Registrar merma/);
  const g = p.getByRole("button", { name: /Guardar/ }).first(); await g.click({ force: true }).catch(() => {}); await espera(p, 500);
  const l = await log(p);
  ok("tab-51-merma-vacia-no-se-guarda", mermas(l).length === 0, `«Guardar» sin capturar nada: ${mermas(l).length ? "GUARDÓ «" + mermas(l)[0] + "»" : "no guarda"}`);
});
await caso("tab-52-merma-negativa-o-con-decimales", "vista=produccion", async p => {
  await abrirDe(p, "P-0585", /Registrar merma/);
  const campos = p.locator('[role="dialog"] input[type="number"], [role="dialog"] input[inputmode="numeric"]');
  const n = await campos.count(); let r = [];
  if (n >= 2) {
    await campos.nth(0).fill("-50"); await p.getByRole("button", { name: /Guardar/ }).first().click({ force: true }).catch(() => {}); await espera(p, 400); r.push(mermas(await log(p)).length);
    await campos.nth(0).fill(""); await campos.nth(1).fill("2.5"); await p.getByRole("button", { name: /Guardar/ }).first().click({ force: true }).catch(() => {}); await espera(p, 400); r.push(mermas(await log(p)).length);
  }
  ok("tab-52-merma-negativa-o-con-decimales", n >= 2 && r[0] === 0 && r[1] === 0, n < 2 ? "no encontré los dos campos (o no es un diálogo)" : `«-50» pliegos: ${r[0] ? "SE GUARDÓ" : "no se guarda"}; «2.5» piezas: ${r[1] ? "SE GUARDÓ" : "no se guarda"}`);
});
await caso("tab-53-merma-buena-se-guarda-una-vez", "vista=produccion", async p => {
  await abrirDe(p, "P-0585", /Registrar merma/);
  const campos = p.locator('[role="dialog"] input[type="number"], [role="dialog"] input[inputmode="numeric"]');
  if (await campos.count() >= 2) await campos.nth(0).fill("30");
  const motivo = p.locator('[role="dialog"] input:not([type="number"]):not([inputmode="numeric"])').first(); if (await motivo.count()) await motivo.fill("Registro corrido");
  const g = p.getByRole("button", { name: /Guardar/ }).first(); if (await g.count()) await g.dblclick(); await espera(p, 900);
  const m = mermas(await log(p));
  ok("tab-53-merma-buena-se-guarda-una-vez", m.length === 1 && /piezas=0 pliegos=30/.test(m[0]), `30 pliegos y doble clic en «Guardar»: ${m.length ? m.length + " vez/veces: «" + m[0] + "»" : "no se guardó"}`);
});
await caso("tab-54-maquila-dice-de-que-orden-y-pide-proveedor", "vista=produccion", async p => {
  await abrirDe(p, "P-0585", /Enviar a maquila/);
  const d = await dialogo(p);
  const enviar = p.locator('[role="dialog"]').getByRole("button", { name: /^Enviar/ }).first();
  const apagado = (await enviar.count()) ? await enviar.isDisabled() : null;
  const prov = p.locator('[role="dialog"] input').first(); if (await prov.count()) await prov.fill("MAKILA");
  if (await enviar.count()) { await enviar.click(); await espera(p, 700); }
  const l = await log(p);
  ok("tab-54-maquila-dice-de-que-orden-y-pide-proveedor", /P-0585/.test(d) && apagado === true && /maquila P-0585 a MAKILA/.test(l),
    `«Enviar a maquila» de P-0585: ${d ? (/P-0585/.test(d) ? "dice de qué orden es" : "NO dice de qué orden es") : "no es un diálogo"}; sin proveedor «Enviar» ${apagado === true ? "está apagado" : apagado === false ? "se ve vivo (y no hace nada)" : "no está"}; con «MAKILA» ${/maquila P-0585/.test(l) ? "la manda" : "no la manda"}`);
});
await caso("tab-55-merma-y-maquila-toman-el-foco", "vista=produccion", async p => {
  const r = [];
  for (const re of [/Registrar merma/, /Enviar a maquila/]) {
    await abrirDe(p, "P-0585", re);
    const dentro0 = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    let fuera = 0; for (let i = 0; i < 12; i++) { await p.keyboard.press("Tab"); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) fuera++; }
    r.push((dentro0 ? "foco adentro" : "foco FUERA") + (fuera ? ", Tab se sale " + fuera + "/12" : ", Tab no se sale"));
    // (se cierra con «Cancelar»: con el foco en un campo, la app ignora Esc a propósito)
    const cancelar = p.locator('[role="dialog"]').getByRole("button", { name: /Cancelar/ }).first();
    if (await cancelar.count()) await cancelar.click(); else await p.keyboard.press("Escape");
    await espera(p, 700);
  }
  ok("tab-55-merma-y-maquila-toman-el-foco", r.every(x => /^foco adentro, Tab no se sale$/.test(x)), `Merma: ${r[0]}; Maquila: ${r[1]}`);
});
// el contraste de un elemento contra su fondo de verdad (los fondos con transparencia se componen hasta uno opaco)
const contrastes = (p, cuales) => p.evaluate(cuales => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  return cuales.map(t => { const el = [...document.querySelectorAll("body *")].find(e => propio(e) === t && e.getClientRects().length); if (!el) return t + ": no está";
    const a = lum(nums(getComputedStyle(el).color)), b = lum(fondo(el)); return t + ": " + ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(1); });
}, cuales);
await caso("tab-56-contraste-del-tablero", "vista=produccion", async p => {
  const r = await contrastes(p, ["Activar", "Activa", "Empaque", "A Listas"]);
  const malos = r.filter(x => !/: (\d+\.\d)$/.test(x) || parseFloat(x.split(": ")[1]) < 4.5);
  ok("tab-56-contraste-del-tablero", malos.length === 0, r.join(" · "));
});
await caso("tab-57-contraste-fuera-de-servicio", "vista=produccion&caso=mantenimiento", async p => {
  const r = await p.evaluate(() => { const el = [...document.querySelectorAll("div")].find(d => /^Fuera de servicio/.test([...d.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim())); return el ? null : "no está"; });
  const c = await contrastes(p, ["Fuera de servicio — Rodillo dañado"]);
  ok("tab-57-contraste-fuera-de-servicio", !/no está/.test(c[0]) && parseFloat(c[0].split(": ")[1]) >= 4.5, c.join(" · "));
});
await caso("tab-58-ordenes-con-acento", "vista=produccion", async p => {
  // dos órdenes en maquila sin proveedor: «2 órdenes», con acento
  await p.evaluate(() => window.__cambiar("P-0580", { stage: "maquila_out" })); await espera(p, 400);
  const t = await texto(p);
  ok("tab-58-ordenes-con-acento", /2 órdenes/.test(t) && !/\bordenes\b/.test(t), `el seguimiento de maquila dice «${(t.match(/\d+ [oó]rdenes?/) || ["(nada)"])[0]}»`);
});

// vuelta 3 de v10.84.59, por donde no se diseñó
await caso("tab-59-merma-solo-con-piezas", "vista=produccion", async p => {
  await abrirDe(p, "P-0585", /Registrar merma/);
  await p.locator("#merma-piezas").fill("25"); await p.getByRole("button", { name: /Guardar/ }).first().click(); await espera(p, 700);
  const m = mermas(await log(p));
  ok("tab-59-merma-solo-con-piezas", m.length === 1 && /piezas=25 pliegos=0/.test(m[0]), `25 piezas y pliegos vacío: ${m[0] || "no se guardó"}`);
});
await caso("tab-60-merma-que-la-base-rechaza", "vista=produccion&falla=merma", async p => {
  await abrirDe(p, "P-0585", /Registrar merma/);
  await p.locator("#merma-pliegos").fill("12"); await p.locator("#merma-motivo").fill("Se corrió el registro");
  await p.getByRole("button", { name: /Guardar/ }).first().click(); await espera(p, 900);
  const sigue = await p.locator('[role="dialog"]').count(), pl = sigue ? await p.locator("#merma-pliegos").inputValue() : "", mot = sigue ? await p.locator("#merma-motivo").inputValue() : "";
  const vivo = sigue ? !(await p.getByRole("button", { name: /Guardar/ }).first().isDisabled()) : false;
  ok("tab-60-merma-que-la-base-rechaza", sigue === 1 && pl === "12" && /registro/.test(mot) && vivo, `la base no la acepta: la ventana ${sigue ? "sigue" : "SE CERRÓ"}${sigue ? " con «" + pl + "» y «" + mot + "»; «Guardar» " + (vivo ? "listo para reintentar" : "APAGADO") : ""}`);
});
await caso("tab-61-proveedor-de-puros-espacios", "vista=produccion", async p => {
  await abrirDe(p, "P-0585", /Enviar a maquila/);
  await p.locator('[role="dialog"] input').first().fill("   "); await espera(p, 200);
  const enviar = p.locator('[role="dialog"]').getByRole("button", { name: /^Enviar/ }).first();
  const apagado = await enviar.isDisabled(); await enviar.click({ force: true }).catch(() => {}); await espera(p, 500);
  const l = await log(p);
  // (el envío es «maquila P-0585 a …»; «accion:send_maquila P-0585» es abrir la ventana)
  ok("tab-61-proveedor-de-puros-espacios", apagado && !/maquila P-0585 a /.test(l), `proveedor «   »: «Enviar» ${apagado ? "apagado" : "VIVO"}; ${/maquila P-0585 a /.test(l) ? "LA MANDÓ" : "no la manda"}`);
});
await caso("tab-62-doble-clic-en-enviar-maquila", "vista=produccion", async p => {
  await abrirDe(p, "P-0585", /Enviar a maquila/);
  await p.locator('[role="dialog"] input').first().fill("MAKILA");
  await p.locator('[role="dialog"]').getByRole("button", { name: /^Enviar/ }).first().dblclick(); await espera(p, 900);
  const n = ((await log(p)).match(/maquila P-0585 a MAKILA/g) || []).length;
  ok("tab-62-doble-clic-en-enviar-maquila", n === 1, `doble clic en «Enviar»: la mandó ${n} vez/veces`);
});
await caso("tab-63-contraste-de-las-pastillas", "vista=produccion", async p => {
  const r = await contrastes(p, ["5 en producción", "1 en producción"]);
  const malos = r.filter(x => !/: \d+\.\d$/.test(x) || parseFloat(x.split(": ")[1]) < 4.5);
  ok("tab-63-contraste-de-las-pastillas", malos.length === 0, r.join(" · "));
});

// ── v10.84.60: el mismo paso con la misma red (P1 de la segunda revisión: arrastrar a Empaque escribía al instante, sin
//   «Deshacer», mientras el botón «Empaque» esperaba con «Deshacer») ──────────────────────────────────────────────────────
const tituloEmpaque = p => p.locator("div[style*='sticky'] span", { hasText: /^Empaque$/ }).first();
const drops = (l, pn) => (l.match(new RegExp("drop:" + pn + " → vm_manual", "g")) || []).length;
await caso("tab-64-arrastrar-a-empaque-espera-con-deshacer", "vista=produccion&deshacer_ms=1500", async p => {
  await ficha(p, "P-0591").dragTo(tituloEmpaque(p), { sourcePosition: { x: 20, y: 12 } }); await espera(p, 400);
  const l1 = await log(p), t = await textoFicha(p, "P-0591"), deshacer = await p.getByRole("button", { name: /Deshacer/ }).count();
  await espera(p, 1800); const l2 = await log(p);
  ok("tab-64-arrastrar-a-empaque-espera-con-deshacer", drops(l1, "P-0591") === 0 && deshacer > 0 && drops(l2, "P-0591") === 1,
    `arrastrar P-0591 a Empaque: ${drops(l1, "P-0591") ? "ESCRIBIÓ AL INSTANTE" : "espera"}${deshacer ? " con «Deshacer»" : " SIN «Deshacer»"}; al terminar la espera ${drops(l2, "P-0591") === 1 ? "pasa a Empaque" : "pasó " + drops(l2, "P-0591") + " veces"}`);
});
await caso("tab-65-arrastrar-a-empaque-y-deshacer", "vista=produccion&deshacer_ms=1500", async p => {
  await ficha(p, "P-0591").dragTo(tituloEmpaque(p), { sourcePosition: { x: 20, y: 12 } }); await espera(p, 700);
  const d = p.getByRole("button", { name: /Deshacer/ }).first(); if (await d.count()) await d.click();
  await espera(p, 2000);
  const l = await log(p), e = await etapa(p, "P-0591");
  ok("tab-65-arrastrar-a-empaque-y-deshacer", drops(l, "P-0591") === 0 && e === "in_production@off_pm74:0", `arrastrar a Empaque y «Deshacer»: ${drops(l, "P-0591") ? "PASÓ IGUAL" : "no pasa"}; P-0591 queda en ${e}`);
});
await caso("tab-66-arrastrar-de-listas-a-empaque", "vista=produccion&deshacer_ms=1500", async p => {
  // P-0603 regresó de maquila y está en Listas: puede ir directo a Empaque, con la misma espera, y la espera se ve en SU ficha
  await ficha(p, "P-0603").dragTo(tituloEmpaque(p), { sourcePosition: { x: 20, y: 12 } }); await espera(p, 400);
  const t = await textoFicha(p, "P-0603"), l1 = await log(p);
  await espera(p, 1800); const l2 = await log(p);
  ok("tab-66-arrastrar-de-listas-a-empaque", /Pasa a Empaque/.test(t) && drops(l1, "P-0603") === 0 && drops(l2, "P-0603") === 1,
    `P-0603 de Listas a Empaque: ${/Pasa a Empaque/.test(t) ? "su ficha dice «Pasa a Empaque…»" : drops(l1, "P-0603") ? "ESCRIBIÓ AL INSTANTE" : "no dice nada"}; ${drops(l2, "P-0603") === 1 ? "luego pasa" : "pasó " + drops(l2, "P-0603") + " veces"}`);
});

// ── v10.84.61: en Salidas, esperar la fecha de entrega no es estar estancada (Marcelo, 7-oct, P-0540: «10d estancada» con
//   entrega el 15-oct) ─────────────────────────────────────────────────────────────────────────────────────────────────────
const fichaDeOrden = (p, pn) => p.evaluate(pn => { const c = [...document.querySelectorAll('[role="button"][aria-label^="Orden "]')].find(x => x.getAttribute("aria-label").startsWith("Orden " + pn)); return c ? c.innerText.replace(/\s+/g, " ") : "(no está)"; }, pn);
const enSalidasDesde = (p, dias, entrega) => p.evaluate(([dias, entrega]) => { const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  window.__cambiar("P-0580", { stage: "salidas", timeline: [{ action: "📦 Empaque → 📤 Salidas", date: new Date(Date.now() - dias * 86400000).toISOString(), to: "salidas" }], due_date: d(entrega) }); }, [dias, entrega]);
await caso("tab-73-salidas-esperando-su-fecha-no-esta-estancada", "vista=fichas&rol=karla", async p => {
  await enSalidasDesde(p, 14, 8); await espera(p, 500);   // dos semanas en Salidas, entrega dentro de 8 días
  const t = await fichaDeOrden(p, "P-0580");
  ok("tab-73-salidas-esperando-su-fecha-no-esta-estancada", !/estancada|sin avance/.test(t) && /P-0580/.test(t), `P-0580 en Salidas desde hace 2 semanas, entrega en 8 días: ${/estancada|sin avance/.test(t) ? "SALE «" + (t.match(/\d+[dh] (estancada|sin avance)/) || [""])[0] + "»" : "no sale estancada"}`);
});
await caso("tab-74-salidas-con-la-entrega-encima-si", "vista=fichas&rol=karla", async p => {
  await enSalidasDesde(p, 14, 0); await espera(p, 500);   // la entrega es HOY y sigue en Salidas
  const t = await fichaDeOrden(p, "P-0580");
  ok("tab-74-salidas-con-la-entrega-encima-si", /estancada/.test(t), `P-0580 en Salidas desde hace 2 semanas con la entrega HOY: ${/estancada/.test(t) ? "sale estancada" : "NO sale (se escondería lo que sí urge)"}`);
});

// ── v10.84.62: la planta de un vistazo (P1 de la segunda revisión: a 1366 la primera pantalla enseñaba 3 de 16 máquinas, y con
//   Listas llena ninguna; las libres ocupaban lo mismo que las cargadas) ────────────────────────────────────────────────────
const FRANJA = '[aria-label="Así va la planta"]';
// ¿se ve en la PRIMERA pantalla (sin bajar) el número de cada orden que está corriendo?
const corriendoALaVista = (p, pns) => p.evaluate(pns => { window.scrollTo(0, 0); const h = innerHeight;
  return pns.filter(pn => ![...document.querySelectorAll("body *")].some(e => { const t = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("");
    if (!t.includes(pn)) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= h; })); }, pns);
const CORRIENDO = ["P-0591", "P-0595", "P-0596", "P-0597"];   // PM74, PM52, la DocuColor (Digital empieza plegada) y la Polar 115
// cuántas de las órdenes que están en «Órdenes Listas» (según el banco: ready o recibidas de maquila, sin pausa) tienen su ficha en
//   pantalla (no depende de cómo se marque la sección: contra la versión anterior también mide)
const enListas = p => p.evaluate(() => { const ids = new Set(window.__ordenes().filter(o => (o.stage === "ready" || o.stage === "maquila_in") && !o.snooze_reason).map(o => o.id));
  return [...document.querySelectorAll("[draggable=true][data-ficha]")].filter(c => ids.has(c.getAttribute("data-ficha")) && c.getClientRects().length).length; });
// ¿la ficha de una orden (fuera de la franja) está entera en la pantalla?
const fichaALaVista = (p, pn) => p.evaluate(pn => { const c = [...document.querySelectorAll("[draggable=true]")].find(x => x.innerText.includes(pn) && !x.closest('[aria-label="Así va la planta"]'));
  if (!c) return "no está"; const b = c.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight ? "a la vista" : "fuera de la vista"; }, pn);
await caso("tab-67-la-planta-de-un-vistazo-a-1366", "vista=produccion", async p => {
  const faltan = await corriendoALaVista(p, CORRIENDO);
  ok("tab-67-la-planta-de-un-vistazo-a-1366", faltan.length === 0, faltan.length ? "sin bajar no se ve qué corre en: " + faltan.join(", ") : "sin bajar se ve qué corre en las 4 máquinas con trabajo");
});
await caso("tab-68-con-listas-llena-tambien", "vista=produccion&caso=lleno", async p => {
  const faltan = await corriendoALaVista(p, CORRIENDO);
  ok("tab-68-con-listas-llena-tambien", faltan.length === 0, faltan.length ? "con 18 en Listas, sin bajar no se ve qué corre en: " + faltan.join(", ") : "con 18 en Listas también se ve todo lo que corre");
});
await caso("tab-69-las-libres-no-ocupan-de-mas", "vista=produccion", async p => {
  // la GTO está libre junto a la PM74 cargada: su tarjeta mide lo que trae, no lo que mide la de al lado
  const h = await p.evaluate(() => { const el = [...document.querySelectorAll("span,div")].find(e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim() === "GTO 1 Color" && !e.closest('[aria-label="Así va la planta"]') && !e.closest("select"));
    if (!el) return -1; let x = el; while (x.parentElement && getComputedStyle(x.parentElement).display !== "grid") x = x.parentElement; return Math.round(x.getBoundingClientRect().height); });
  ok("tab-69-las-libres-no-ocupan-de-mas", h > 0 && h <= 170, `la GTO 1 Color (libre) mide ${h} px de alto`);
});
await caso("tab-70-listas-plegada", "vista=produccion&caso=lleno", async p => {
  const antes = await enListas(p);
  const ver = p.getByRole("button", { name: /Ver las \d+/ }).first(); const hay = await ver.count();
  if (hay) { await ver.click(); await espera(p, 400); }
  const despues = await enListas(p);
  ok("tab-70-listas-plegada", antes > 0 && antes <= 5 && hay > 0 && despues >= 18, `18 órdenes en Listas: se ven ${antes} ${hay ? "con «Ver las…»" : "SIN plegar"}; al abrirla, ${despues}`);
});
await caso("tab-71-la-franja-lleva-a-la-maquina", "vista=produccion", async p => {
  const r = p.locator(FRANJA).getByRole("button", { name: /Polar 115/ }).first(); const hay = await r.count();
  if (hay) { await r.click(); await espera(p, 900); }
  const vis = await fichaALaVista(p, "P-0597");
  ok("tab-71-la-franja-lleva-a-la-maquina", hay > 0 && vis === "a la vista", `tocar «Polar 115» en la franja: ${hay ? "P-0597 " + vis : "NO hay franja"}`);
});
await caso("tab-72-soltar-en-una-libre-de-la-franja", "vista=produccion", async p => {
  const libre = p.locator(FRANJA).getByText("GTO 1 Color", { exact: true }).first(); const hay = await libre.count();
  if (hay) { await ficha(p, "P-0600").dragTo(libre, { sourcePosition: { x: 20, y: 12 } }); await espera(p, 500); }
  const l = await log(p);
  ok("tab-72-soltar-en-una-libre-de-la-franja", hay > 0 && /drop:P-0600 → off_gto/.test(l), `soltar P-0600 en «GTO 1 Color» de la franja: ${hay ? (/drop:P-0600/.test(l) ? "la asigna" : "no la asigna") : "NO hay franja"}`);
});
// ── la franja, por donde no se diseñó ──
await caso("tab-75-franja-fuera-de-servicio-no-asigna-y-lo-dice", "vista=produccion&caso=mantenimiento", async p => {
  const fila = p.locator(FRANJA).getByRole("button", { name: /Printmaster 52/ }).first(); const hay = await fila.count();
  const dice = hay ? (await fila.innerText()).replace(/\s+/g, " ") : "";
  if (hay) { await ficha(p, "P-0600").dragTo(fila, { sourcePosition: { x: 20, y: 12 } }); await espera(p, 500); }
  const l = await log(p), asigna = /drop:P-0600/.test(l), avisa = /aviso\(error\): Printmaster 52 está fuera de servicio/.test(l);
  ok("tab-75-franja-fuera-de-servicio-no-asigna-y-lo-dice", hay > 0 && /Fuera de servicio/.test(dice) && /P-0595 montada/.test(dice) && !asigna && avisa,
    hay ? `la fila dice «${dice}»; soltar P-0600 ahí: ${asigna ? "LA ASIGNA" : avisa ? "no la asigna y lo dice" : "no la asigna y NO DICE NADA"}` : "NO hay fila de la Printmaster 52 en la franja");
});
await caso("tab-76-franja-abre-digital-plegada", "vista=produccion", async p => {
  const r = p.locator(FRANJA).getByRole("button", { name: /DocuColor 252/ }).first(); const hay = await r.count();
  if (hay) { await r.click(); await espera(p, 900); }
  const vis = await fichaALaVista(p, "P-0596");
  ok("tab-76-franja-abre-digital-plegada", hay > 0 && vis === "a la vista", `Digital empieza plegada; tocar «DocuColor 252» en la franja: ${hay ? "P-0596 " + vis : "NO hay franja"}`);
});
await caso("tab-77-franja-sigue-al-tiempo-real", "vista=produccion", async p => {
  // desde otra estación: P-0591 se va a Empaque y P-0593 sube a correr en la Printmaster 74
  await p.evaluate(() => { window.__cambiar("P-0591", { stage: "packaging", current_machine: "vm_manual", machine_queue_position: null });
    window.__cambiar("P-0593", { machine_queue_position: 0, machine_log: [{ machine: "off_pm74", started: new Date().toISOString() }] });
    window.__cambiar("P-0594", { machine_queue_position: 1 }); });
  await espera(p, 400);
  const fila = p.locator(FRANJA).getByRole("button", { name: /Printmaster 74/ }).first();
  const dice = (await fila.count()) ? (await fila.innerText()).replace(/\s+/g, " ") : "(no hay fila)";
  ok("tab-77-franja-sigue-al-tiempo-real", /P-0593/.test(dice) && !/P-0591/.test(dice) && /\+1 en la fila/.test(dice), `la fila de la Printmaster 74 dice «${dice}»`);
});
await caso("tab-78-soltar-en-una-ocupada-de-la-franja", "vista=produccion", async p => {
  const fila = p.locator(FRANJA).getByRole("button", { name: /Printmaster 74/ }).first(); const hay = await fila.count();
  if (hay) { await ficha(p, "P-0600").dragTo(fila, { sourcePosition: { x: 20, y: 12 } }); await espera(p, 500); }
  const l = await log(p);
  ok("tab-78-soltar-en-una-ocupada-de-la-franja", hay > 0 && /drop:P-0600 → off_pm74/.test(l), `soltar P-0600 en «Printmaster 74» de la franja: ${hay ? (/drop:P-0600 → off_pm74/.test(l) ? "la manda a su fila" : "no la manda") : "NO hay franja"}`);
});
await caso("tab-79-franja-con-el-teclado", "vista=produccion", async p => {
  const r = p.locator(FRANJA).getByRole("button", { name: /Polar 115/ }).first(); const hay = await r.count();
  if (hay) { await r.focus(); await p.keyboard.press("Enter"); await espera(p, 900); }
  const foco = await p.evaluate(() => document.activeElement?.getAttribute("data-maquina") || document.activeElement?.tagName);
  ok("tab-79-franja-con-el-teclado", hay > 0 && foco === "ac_polar115", `Enter en «Polar 115» de la franja: el foco queda en ${foco}`);
});
await caso("tab-80-listas-con-pocas-no-se-pliega", "vista=produccion", async p => {
  const n = await enListas(p), sobra = await p.getByRole("button", { name: /Ver las \d+|Ver menos/ }).count();
  ok("tab-80-listas-con-pocas-no-se-pliega", n === 4 && !sobra, `4 en Listas: se ven ${n}${sobra ? ", con un botón para plegar que sobra" : ""}`);
});
await caso("tab-81-buscar-una-de-las-plegadas", "vista=produccion&caso=lleno&buscar=P-0813", async p => {
  const r = await p.evaluate(() => [...document.querySelectorAll("[draggable=true]")].some(x => x.innerText.includes("P-0813") && x.getClientRects().length) ? "se ve" : "escondida");
  ok("tab-81-buscar-una-de-las-plegadas", r === "se ve", `buscar P-0813 (la última de 18 en Listas): ${r}`);
});
await caso("tab-82-ir-a-una-vencida-plegada", "vista=produccion&caso=lleno", async p => {
  await p.getByRole("button", { name: /vencida/ }).first().click(); await espera(p, 300);
  const item = p.locator('[aria-label="Órdenes vencidas"]').getByRole("button", { name: /P-0802/ }).first(); const hay = await item.count();
  if (hay) { await item.click(); await espera(p, 900); }
  const vis = await fichaALaVista(p, "P-0802");
  ok("tab-82-ir-a-una-vencida-plegada", hay > 0 && vis === "a la vista", hay ? `«ir a» P-0802 (la 5ª de Listas, vencida): ${vis}` : "P-0802 no está en la lista de vencidas");
});
await caso("tab-83-listas-abierta-se-recuerda", "vista=produccion&caso=lleno", async p => {
  const ver = p.getByRole("button", { name: /Ver las \d+/ }).first();
  if (await ver.count()) { await ver.click(); await espera(p, 300); }
  await p.evaluate(() => window.__vista("fichas")); await espera(p, 300);
  await p.evaluate(() => window.__vista("produccion")); await espera(p, 500);
  const alVolver = await enListas(p);
  const menos = p.getByRole("button", { name: /Ver menos/ }).first(); const hayMenos = await menos.count();
  if (hayMenos) { await menos.click(); await espera(p, 300); }
  const plegada = await enListas(p), foco = await p.evaluate(() => (document.activeElement?.innerText || "").replace(/\s+/g, " "));
  ok("tab-83-listas-abierta-se-recuerda", alVolver >= 18 && hayMenos > 0 && plegada === 4 && /Ver las/.test(foco),
    `abierta, al salir del tablero y volver se ven ${alVolver}; «Ver menos» ${hayMenos ? "la deja en " + plegada : "NO ESTÁ"}; el foco queda en «${foco.slice(0, 30)}»`);
});
// arrastrar una ficha hasta algo de la franja como lo hace una persona: hacia arriba, al borde (la página sube sola) y ahí se suelta.
//   Chrome manda «dragover» cada ~50 ms aunque el puntero esté quieto, y con eso sube la página; Playwright sólo lo manda al mover
//   el ratón: se imita con un pixel de ida y vuelta cada 50 ms, en el borde y sobre el destino (sin eso, tab-85 fallaba por la prueba)
const alaFranja = async (p, pn, destino) => {
  const quieto = async (x, y, n) => { for (let i = 0; i < n; i++) { await p.mouse.move(x + (i % 2), y); await espera(p, 50); } };
  const src = ficha(p, pn); await src.scrollIntoViewIfNeeded(); const b = await src.boundingBox();
  await p.mouse.move(b.x + 20, b.y + 12); await p.mouse.down();
  await p.mouse.move(b.x + 40, b.y + 30, { steps: 4 }); await p.mouse.move(b.x + 40, 40, { steps: 12 }); await quieto(b.x + 40, 40, 30);
  const d = await destino.boundingBox();
  if (d) { await p.mouse.move(d.x + d.width / 2, d.y + d.height / 2, { steps: 8 }); await quieto(d.x + d.width / 2, d.y + d.height / 2, 4); }
  await p.mouse.up(); await espera(p, 500); return !!d;
};
await caso("tab-85-de-una-maquina-a-la-franja-arrastrando", "vista=produccion", async p => {
  // como lo haría Gerardo: la orden que corre en la PM52 (abajo de la pantalla) a una libre de la franja
  const llego = await alaFranja(p, "P-0595", p.locator(FRANJA).getByText("GTO 1 Color", { exact: true }).first());
  const l = await log(p);
  ok("tab-85-de-una-maquina-a-la-franja-arrastrando", /drop:P-0595 → off_gto/.test(l), `arrastrar P-0595 desde la PM52 hasta «GTO 1 Color» de la franja: ${/drop:P-0595/.test(l) ? (l.match(/drop:P-0595[^\n]*/) || [""])[0] : "no llegó" + (llego ? "" : " (la franja no se veía)")}`);
});
// ── la franja y Listas, vuelta 2: por donde no se diseñó ──
await caso("tab-86-listas-con-5-no-se-pliega-con-6-si", "vista=produccion", async p => {
  // 4 en Listas: a P-0604 se le quita la pausa (5) y luego P-0580 regresa de Salidas (6)
  await p.evaluate(() => window.__cambiar("P-0604", { snooze_reason: null, snooze_stage: null, snoozed_by: null, snooze_kind: null, snoozed_at: null })); await espera(p, 300);
  const con5 = await enListas(p), boton5 = await p.getByRole("button", { name: /Ver las \d+/ }).count();
  await p.evaluate(() => window.__cambiar("P-0580", { stage: "ready" })); await espera(p, 300);
  const con6 = await enListas(p), boton6 = await p.getByRole("button", { name: /Ver las 6/ }).count();
  ok("tab-86-listas-con-5-no-se-pliega-con-6-si", con5 === 5 && !boton5 && con6 === 4 && boton6 === 1,
    `con 5 en Listas se ven ${con5}${boton5 ? " y sobra «Ver las…»" : ""}; con 6 se ven ${con6} ${boton6 ? "con «Ver las 6»" : "SIN «Ver las 6»"}`);
});
const filasDeLaFranja = p => p.evaluate(() => { const f = document.querySelector('[aria-label="Así va la planta"]'); if (!f) return null;
  return { botones: [...f.querySelectorAll("button")].map(b => b.innerText.replace(/\s+/g, " ").trim()), dice: (f.innerText.replace(/\s+/g, " ").match(/\d+ trabajando[^A-Z]*/) || [""])[0].trim() }; });
await caso("tab-87-una-libre-que-arranca-sale-de-libres", "vista=produccion", async p => {
  await p.evaluate(() => window.__cambiar("P-0600", { stage: "in_production", current_machine: "off_gto", machine_queue_position: 0, machine_log: [{ machine: "off_gto", started: new Date().toISOString() }] })); await espera(p, 400);
  const r = await filasDeLaFranja(p), fila = r ? r.botones.find(x => /^GTO 1 Color ./.test(x)) || "" : "", libre = r ? r.botones.includes("GTO 1 Color") : false;
  ok("tab-87-una-libre-que-arranca-sale-de-libres", !!r && /P-0600/.test(fila) && !libre && /^5 trabajando · 11 libres$/.test(r.dice),
    r ? `la GTO arranca P-0600 (desde otra estación): su fila «${fila}»; ${libre ? "SIGUE en Libres" : "ya no está en Libres"}; «${r.dice}»` : "NO hay franja");
});
await caso("tab-88-tablero-vacio-sin-franja", "vista=produccion&caso=vacio", async p => {
  const hay = await p.locator(FRANJA).count(), t = await texto(p);
  ok("tab-88-tablero-vacio-sin-franja", !hay && /Tablero vacío/.test(t), `sin órdenes: ${hay ? "SALE la franja (sólo con libres)" : "sin franja"}; ${/Tablero vacío/.test(t) ? "dice «Tablero vacío»" : "NO dice que está vacío"}`);
});
await caso("tab-89-soltar-en-su-propia-maquina-de-la-franja", "vista=produccion", async p => {
  // P-0595 corre en la PM52 y se suelta en la fila de la PM52: no es un error ni un cambio (como soltarla en su propia tarjeta)
  await alaFranja(p, "P-0595", p.locator(FRANJA).getByRole("button", { name: /Printmaster 52/ }).first());
  const l = await log(p), e = await etapa(p, "P-0595");
  ok("tab-89-soltar-en-su-propia-maquina-de-la-franja", !/drop:P-0595/.test(l) && !/aviso\(error\)/.test(l) && e === "in_production@off_pm52:0",
    `soltar P-0595 en la fila de su propia máquina: ${/drop:P-0595/.test(l) ? "LA MUEVE" : "no la mueve"}; ${/aviso\(error\)/.test(l) ? "AVISA UN ERROR" : "sin aviso"}; queda ${e}`);
});
await caso("tab-90-fuera-de-servicio-y-libre-no-esta-en-libres", "vista=produccion&mant=off_gto", async p => {
  const r = await filasDeLaFranja(p), fila = r ? r.botones.find(x => /^GTO 1 Color ./.test(x)) || "" : "", libre = r ? r.botones.includes("GTO 1 Color") : false;
  const b = p.locator(FRANJA).getByRole("button", { name: /GTO 1 Color/ }).first();
  if (await b.count()) { await ficha(p, "P-0600").dragTo(b, { sourcePosition: { x: 20, y: 12 } }); await espera(p, 500); }
  const l = await log(p), asigna = /drop:P-0600/.test(l), avisa = /aviso\(error\): GTO 1 Color está fuera de servicio/.test(l);
  ok("tab-90-fuera-de-servicio-y-libre-no-esta-en-libres", !!r && /Fuera de servicio/.test(fila) && !libre && !asigna && avisa,
    r ? `la GTO en mantenimiento y sin trabajo: ${libre ? "SALE en Libres" : "fila «" + fila + "»"}; soltar P-0600 ahí: ${asigna ? "LA ASIGNA" : avisa ? "no la asigna y lo dice" : "no dice nada"}` : "NO hay franja");
});
// lo que la franja no puede cortar: el nombre de la máquina y el número de la orden (el cliente sí se recorta, con «…»)
const cortesFranja = p => p.evaluate(() => { const r = [];
  for (const b of document.querySelectorAll('[aria-label="Así va la planta"] button')) { const caja = b.getBoundingClientRect();
    if (b.scrollWidth > b.clientWidth + 1) r.push("«" + b.innerText.replace(/\s+/g, " ").slice(0, 34) + "» se sale");
    for (const s of b.querySelectorAll(":scope > span")) { const t = s.innerText.trim();
      if (s !== b.firstElementChild && !/^P-\d{4}$/.test(t)) continue; const q = s.getBoundingClientRect();
      if (s.scrollWidth > s.clientWidth + 1 || q.right > caja.right + 1) r.push(t + " cortado"); } }
  return r; });
for (const [an, al] of [[1366, 768], [1920, 1080], [768, 1024]])
  await caso("tab-84-la-franja-no-corta-a-" + an, "vista=produccion&caso=mantenimiento", async p => {
    const c = await cortesFranja(p), n = await p.locator(FRANJA + " button").count();
    ok("tab-84-la-franja-no-corta-a-" + an, n > 0 && c.length === 0, n ? (c.length ? c.join(" · ") : n + " renglones y libres, sin cortar nombres ni números") : "NO hay franja");
  }, { width: an, height: al });
// ── v10.84.63: las acciones de Empaque, dentro de la ficha y con palabras (P2 de la segunda revisión: tres íconos sueltos debajo
//   de cada ficha, a 8 px de la siguiente; el camión y el bote se leían «envío» y «borrar») ───────────────────────────────────
// (los botones del tablero miden 40 px de alto con un renglón: bs() trae minHeight 40; dos renglones pasan de 44)
// los botones visibles de la columna de Empaque (la que dice «Empaque» y tiene sus fichas), con su caja, su texto y su ficha
const empaque = (p, pn) => p.evaluate(pn => {
  const card = [...document.querySelectorAll("[draggable=true]")].find(x => x.innerText.includes(pn) && !x.closest('[aria-label="Así va la planta"]') && /Empaque/.test(x.parentElement?.parentElement?.parentElement?.innerText || ""));
  if (!card) return null; const c = card.getBoundingClientRect(); let col = card; for (let i = 0; i < 4 && col.parentElement; i++) col = col.parentElement;
  const botones = [...col.querySelectorAll("button")].filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect();
    return { texto: b.innerText.replace(/\s+/g, " ").trim(), nombre: b.getAttribute("aria-label") || "", expandible: b.hasAttribute("aria-expanded"),
      dentro: r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1, alto: Math.round(r.height), suya: card.contains(b) || (r.top >= c.bottom - 1 && r.top <= c.bottom + 30) }; });
  return { card: { alto: Math.round(c.height) }, botones };
}, pn);
await caso("tab-91-a-salidas-con-palabra-dentro-de-la-ficha", "vista=produccion", async p => {
  const e = await empaque(p, "P-0585"); const b = e ? e.botones.find(x => /^A Salidas$/.test(x.texto)) : null;
  ok("tab-91-a-salidas-con-palabra-dentro-de-la-ficha", !!b && b.dentro, e ? (b ? `«A Salidas» ${b.dentro ? "dentro de la ficha de P-0585" : "FUERA de la ficha"}` : "no hay un botón que diga «A Salidas» (" + e.botones.filter(x => x.suya).map(x => x.texto || "[" + x.nombre + "]").join(", ") + ")") : "no encuentro P-0585 en Empaque");
});
await caso("tab-92-sin-iconos-sueltos-en-empaque", "vista=produccion", async p => {
  // en la ficha de P-0585, cada botón dice lo que hace con palabra (el «⋯» se vale: dice lo que guarda en su nombre y se abre)
  const e = await empaque(p, "P-0585"); const mudos = e ? e.botones.filter(x => x.suya && !x.texto && !x.expandible) : null;
  ok("tab-92-sin-iconos-sueltos-en-empaque", !!e && mudos.length === 0, e ? (mudos.length ? "botones sin palabra: " + mudos.map(x => "[" + x.nombre + "]").join(", ") : "todos con palabra") : "no encuentro P-0585 en Empaque");
});
await caso("tab-93-a-salidas-hace-salidas", "vista=produccion", async p => {
  const b = await botonDe(p, "P-0585", /^A Salidas/); if (b) { await b.click(); await espera(p, 400); }
  const l = await log(p), n = (l.match(/accion:advance P-0585 salidas/g) || []).length;
  const det = /accion:detail P-0585/.test(l);
  ok("tab-93-a-salidas-hace-salidas", !!b && n === 1 && !det, b ? `«A Salidas» de P-0585: ${n} pedido(s) de pasar a Salidas${det ? "; Y ADEMÁS abre el detalle" : ""}` : "no hay «A Salidas»");
});
await caso("tab-94-doble-clic-en-a-salidas", "vista=produccion", async p => {
  const b = await botonDe(p, "P-0585", /^A Salidas/); if (b) { await b.dblclick(); await espera(p, 600); }
  const l = await log(p), n = (l.match(/accion:advance P-0\d+ salidas/g) || []).length;
  ok("tab-94-doble-clic-en-a-salidas", !!b && n === 1, b ? `doble clic en «A Salidas»: ${n} pedido(s) a Salidas (${(l.match(/accion:advance P-0\d+ salidas/g) || []).join(", ")})` : "no hay «A Salidas»");
});
await caso("tab-95-mas-abre-maquila-y-merma-en-la-ficha", "vista=produccion", async p => {
  const mas = await botonDe(p, "P-0585", /^Más de P-0585/); if (mas) { await mas.click(); await espera(p, 300); }
  const e = await empaque(p, "P-0585"), maq = e?.botones.find(x => /^Enviar a maquila/.test(x.texto)), mer = e?.botones.find(x => /^Registrar merma/.test(x.texto));
  if (maq) { const b = await botonDe(p, "P-0585", /Enviar a maquila/); if (b) await b.click(); await espera(p, 400); }
  const l = await log(p);
  ok("tab-95-mas-abre-maquila-y-merma-en-la-ficha", !!mas && !!maq && maq.dentro && !!mer && mer.dentro && /accion:send_maquila P-0585/.test(l),
    mas ? `«⋯» de P-0585: ${maq ? "«Enviar a maquila» " + (maq.dentro ? "en la ficha" : "FUERA") : "sin maquila"} · ${mer ? "«Registrar merma» " + (mer.dentro ? "en la ficha" : "FUERA") : "sin merma"}; ${/accion:send_maquila P-0585/.test(l) ? "maquila abre su ventana" : "maquila NO hace nada"}` : "no hay «⋯» en la ficha de P-0585");
});
await caso("tab-96-esc-cierra-el-mas-y-regresa-el-foco", "vista=produccion", async p => {
  const mas = await botonDe(p, "P-0585", /^Más de P-0585/); if (mas) { await mas.click(); await espera(p, 300); }
  const abierto = !!(await p.getByRole("group", { name: "Más acciones de la orden" }).count());
  await p.keyboard.press("Escape"); await espera(p, 300);
  const cerrado = !(await p.getByRole("group", { name: "Más acciones de la orden" }).count());
  const foco = await p.evaluate(() => document.activeElement?.getAttribute("data-accion") || document.activeElement?.tagName);
  ok("tab-96-esc-cierra-el-mas-y-regresa-el-foco", !!mas && abierto && cerrado && foco === "mas", mas ? `«⋯» ${abierto ? "abre" : "NO abre"}; Esc ${cerrado ? "lo cierra" : "NO lo cierra"}; el foco queda en ${foco}` : "no hay «⋯»");
});
await caso("tab-97-clic-fuera-cierra-el-mas", "vista=produccion", async p => {
  const mas = await botonDe(p, "P-0585", /^Más de P-0585/); if (mas) { await mas.click(); await espera(p, 300); }
  await p.mouse.click(700, 20); await espera(p, 300);
  const sigue = await p.getByRole("group", { name: "Más acciones de la orden" }).count(), l = await log(p);
  ok("tab-97-clic-fuera-cierra-el-mas", !!mas && !sigue && !/accion:(send_maquila|waste) P-0585/.test(l), mas ? `clic fuera con «⋯» abierto: ${sigue ? "SIGUE abierto" : "se cierra"} sin hacer nada` : "no hay «⋯»");
});
for (const [an, al] of [[1366, 768], [1920, 1080]])
  await caso("tab-98-a-salidas-en-un-renglon-a-" + an, "vista=produccion", async p => {
    const e = await empaque(p, "P-0585"), b = e ? e.botones.find(x => /^A Salidas$/.test(x.texto)) : null;
    ok("tab-98-a-salidas-en-un-renglon-a-" + an, !!b && b.alto <= 44 && b.dentro, b ? `«A Salidas» mide ${b.alto} px de alto, ${b.dentro ? "dentro de la ficha" : "FUERA de la ficha"}` : "no hay «A Salidas»");
  }, { width: an, height: al });
await caso("tab-99-a-salidas-se-lee", "vista=produccion", async p => {
  const r = await contrastes(p, ["A Salidas"]); const v = parseFloat((r[0].split(": ")[1] || "0"));
  ok("tab-99-a-salidas-se-lee", v >= 4.5, r.join(" · "));
});
// ── Empaque, vuelta 2: por donde no se diseñó ──
const abiertos = p => p.getByRole("group", { name: "Más acciones de la orden" }).count();
await caso("tab-101-doble-clic-en-enviar-a-maquila", "vista=produccion", async p => {
  const mas = await botonDe(p, "P-0585", /^Más de P-0585/); if (mas) { await mas.click(); await espera(p, 300); }
  const b = await botonDe(p, "P-0585", /Enviar a maquila/); if (b) { await b.dblclick(); await espera(p, 600); }
  const l = await log(p), n = (l.match(/accion:send_maquila P-0\d+/g) || []).length, det = /accion:detail/.test(l);
  ok("tab-101-doble-clic-en-enviar-a-maquila", !!b && n === 1 && !det, b ? `doble clic en «Enviar a maquila»: ${n} ventana(s) de maquila${det ? "; Y ADEMÁS abre un detalle" : ""}` : "no hay «Enviar a maquila»");
});
await caso("tab-102-un-mas-abierto-a-la-vez", "vista=produccion", async p => {
  const a = await botonDe(p, "P-0585", /^Más de P-0585/); if (a) { await a.click(); await espera(p, 300); }
  const b = await botonDe(p, "P-0586", /^Más de P-0586/); if (b) { await b.click(); await espera(p, 300); }
  const n = await abiertos(p), suyo = await p.evaluate(() => { const g = document.querySelector('[role="group"][aria-label="Más acciones de la orden"]'); return g ? (g.closest("[draggable=true]")?.innerText.match(/P-\d{4}/) || [""])[0] : ""; });
  ok("tab-102-un-mas-abierto-a-la-vez", !!a && !!b && n === 1 && suyo === "P-0586", a && b ? `abrir el «⋯» de P-0585 y luego el de P-0586: ${n} abierto(s), el de ${suyo || "ninguna"}` : "faltan los «⋯»");
});
await caso("tab-103-la-mueven-con-el-mas-abierto", "vista=produccion", async p => {
  // otra estación la pasa a Salidas mientras el «⋯» está abierto: se va con su ficha, y Esc después no truena ni hace nada
  const mas = await botonDe(p, "P-0585", /^Más de P-0585/); if (mas) { await mas.click(); await espera(p, 300); }
  await p.evaluate(() => window.__cambiar("P-0585", { stage: "salidas", current_machine: null, machine_queue_position: null })); await espera(p, 400);
  const n = await abiertos(p); await p.keyboard.press("Escape"); await espera(p, 300);
  const l = await log(p);
  ok("tab-103-la-mueven-con-el-mas-abierto", !!mas && n === 0 && !/accion:(send_maquila|waste) P-0585/.test(l), mas ? `P-0585 se va a Salidas con el «⋯» abierto: ${n ? "el «⋯» SIGUE abierto" : "el «⋯» se va con ella"}; Esc después sin efectos` : "no hay «⋯»");
});
await caso("tab-104-merma-con-el-teclado", "vista=produccion", async p => {
  // el «⋯» abre con el foco en su primera opción; Tab a «Registrar merma» y Enter la abre
  const mas = await botonDe(p, "P-0585", /^Más de P-0585/); if (mas) { await mas.focus(); await p.keyboard.press("Enter"); await espera(p, 300); }
  const f1 = await p.evaluate(() => (document.activeElement?.innerText || "").split("\n")[0]);
  await p.keyboard.press("Tab"); await espera(p, 150);
  const f2 = await p.evaluate(() => (document.activeElement?.innerText || "").split("\n")[0]);
  await p.keyboard.press("Enter"); await espera(p, 500);
  const l = await log(p);
  ok("tab-104-merma-con-el-teclado", !!mas && /^Enviar a maquila/.test(f1) && /^Registrar merma/.test(f2) && /accion:waste P-0585/.test(l), mas ? `Enter en «⋯» → foco en «${f1}»; Tab → «${f2}»; Enter ${/accion:waste P-0585/.test(l) ? "abre la merma de P-0585" : "NO abre la merma"}` : "no hay «⋯»");
});
await caso("tab-100-la-activa-no-cambia", "vista=produccion", async p => {
  // la ficha de la que corre en cada máquina (la misma DragCard, sin pie) sigue sin botones adentro
  const n = await p.evaluate(() => { const c = [...document.querySelectorAll("[draggable=true]")].find(x => x.innerText.includes("P-0591") && !x.closest('[aria-label="Así va la planta"]')); return c ? c.querySelectorAll("button").length : -1; });
  ok("tab-100-la-activa-no-cambia", n === 0, `la ficha activa de P-0591 trae ${n} botón(es) adentro`);
});
await browser.close();
for (const r of res) console.log(r);
