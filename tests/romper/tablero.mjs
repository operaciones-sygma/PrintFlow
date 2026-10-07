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

// ── lo que corre en cada máquina, de un vistazo ──
// dónde está en pantalla un texto que se ve tal cual (fuera de los <select>: sus opciones también dicen «Printmaster 74»)
const caja = (p, re) => p.evaluate(src => { const re = new RegExp(src);
  const el = [...document.querySelectorAll("body *")].find(e => !e.closest("select") && !e.children.length && re.test(e.textContent.trim()) && e.getClientRects().length);
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
  await f.dragTo(p.getByText("GTO 1 Color", { exact: true }).first(), { sourcePosition: { x: 20, y: 12 } }); await espera(p, 500);
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
  await ficha(p, "P-0591").dragTo(p.getByText("GTO 1 Color", { exact: true }).first(), { sourcePosition: { x: 20, y: 12 } }); await espera(p, 1800);
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

await browser.close();
for (const r of res) console.log(r);
