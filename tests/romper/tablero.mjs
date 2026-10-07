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
const abrirDe = async (p, pn, re) => { const b = await botonDe(p, pn, re); if (!b) return false; await b.click(); await espera(p, 700); return true; };
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

await browser.close();
for (const r of res) console.log(r);
