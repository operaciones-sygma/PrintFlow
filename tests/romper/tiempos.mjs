// Tratar de ROMPER «Tiempo por etapa» (`StageFlowHistory`): Marcelo, 4-nov: «la etapa de validación tiene 2, Noemí y Gerardo, veo que tardan horas en aprobarla,
// pero no sé quién tardó» y «en algunas órdenes se repite el proceso varias veces, diseño o CTP aparece varias veces, eso no lo entiendo». Cada caso afirma lo que
// DEBERÍA leer Dirección en el panel: una FALLA es un bug. Las bitácoras son las de producción, copiadas tal cual (P-0726, P-0721, P-0712, P-0527, P-0609, P-0563,
// P-0669, P-0702). Vuelta 1: escritas antes del arreglo, sólo con lo que se lee en pantalla. Reloj fijo: miércoles 4-nov-2026 a las 16:00, hora de México.
// Las cuentas de cada caso se hicieron a mano con el horario de trabajo que dio Marcelo (4-nov, v10.84.176): lunes a viernes, de 9 a 2 y de 3 a 7.
// Uso: node tiempos.mjs <dir-capturas> [puerto=5493]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5493);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + String(x).replace(/\s+/g, " ").slice(0, 420) : ""));
const AHORA = new Date("2026-11-04T16:00:00-06:00");
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }

// ── las bitácoras: [hora de México, a qué etapa, quién, qué dice], como las guarda order_timeline ──
const H = s => s.replace(" ", "T") + "-06:00";
const TL = filas => filas.map(([f, to, by, action]) => ({ date: H(f), ...(to ? { to } : {}), by, action, color: "#8e8e93" }));
const orden = (pn, extra, filas) => ({ id: "OP-" + pn, production_number: pn, order_type: "interna", client: "LIC. ORLANDO CASAS", agent: "Manuel", created_by: "secretaria", priority: "normal",
  validated_by_production: true, validated_by_preprensa: true, timeline: TL(filas), ...extra });
const P0726 = () => orden("P-0726", { stage: "salidas", created_at: H("2026-11-02 11:30:42"), snooze_reason: "El cliente aún no ha pedido factura/remisión", snooze_stage: "salidas", snoozed_by: "karla" }, [
  ["2026-11-02 11:30:42", "draft", "secretaria", "📋 Orden creada"],
  ["2026-11-02 12:47:29", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 13:49:15", null, "produccion", "✅ Validada por Producción"],
  ["2026-11-02 13:49:15", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-11-02 19:04:06", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
  ["2026-11-03 09:53:51", "ctp", "german", "🏭 CTP"],
  ["2026-11-03 09:53:54", "ctp", "german", "🏭 Procesadora"],
  ["2026-11-03 09:53:58", "placas_listas", "german", "💿 CTP → 📋 Placas Listas"],
  ["2026-11-03 12:25:15", "ready", "produccion", "📋 Placas Listas → ✅ Lista para imprimir"],
  ["2026-11-03 12:25:58", "packaging", "produccion", "🏭 📦 Empaque"],
  ["2026-11-03 12:26:34", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
  ["2026-11-04 11:34:19", null, "karla", "🧾 En espera: el cliente no ha pedido factura"],
]);
const P0721 = () => orden("P-0721", { stage: "salidas", created_at: H("2026-10-29 18:40:38") }, [
  ["2026-10-29 18:40:38", "draft", "secretaria", "📋 Orden creada"],
  ["2026-10-29 18:54:17", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-30 15:08:36", null, "produccion", "✅ Validada por Producción"],
  ["2026-10-30 15:08:37", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-10-31 11:27:23", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
  ["2026-11-02 10:34:03", "ctp", "german", "🏭 CTP"],
  ["2026-11-02 10:34:06", "ctp", "german", "🏭 Procesadora"],
  ["2026-11-02 10:34:09", "placas_listas", "german", "💿 CTP → 📋 Placas Listas"],
]);
// sólo Noemí ha validado (se queda en Validar, «ahora» es el miércoles a las 16:00)
const ENVALIDAR = () => orden("P-0730", { stage: "draft", created_at: H("2026-11-04 09:30:00"), validated_by_production: false }, [
  ["2026-11-04 09:30:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-11-04 09:45:00", null, "preprensa", "✅ Validada por Pre-prensa"],
]);
const SINVALIDAR = () => orden("P-0731", { stage: "draft", created_at: H("2026-11-04 15:30:00"), validated_by_production: false, validated_by_preprensa: false }, [
  ["2026-11-04 15:30:00", "draft", "secretaria", "📋 Orden creada"],
]);
// el doble de verdad: Noemí validó y 7 segundos después la bitácora volvió a escribir lo mismo
const P0712 = () => orden("P-0712", { stage: "in_production", created_at: H("2026-10-29 11:18:54"), current_machine: "off_pm74" }, [
  ["2026-10-29 11:18:54", "draft", "vendedor", "📋 Orden creada"],
  ["2026-10-29 11:21:51", null, "vendedor", "✏️ Editada"],
  ["2026-10-29 15:06:21", null, "produccion", "✅ Validada por Producción"],
  ["2026-10-29 15:36:43", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-29 15:36:43", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-10-29 15:36:50", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-29 15:36:50", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-10-29 15:36:52", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
  ["2026-10-30 13:03:06", "ctp", "german", "🏭 CTP"],
  ["2026-10-30 13:03:11", "ctp", "german", "🏭 Procesadora"],
  ["2026-10-30 13:03:12", "placas_listas", "german", "💿 CTP → 📋 Placas Listas"],
  ["2026-10-30 15:08:20", "ready", "produccion", "📋 Placas Listas → ✅ Lista para imprimir"],
  ["2026-10-30 15:09:06", "in_production", "produccion", "🏭 Printmaster 74 (turno 4)"],
  ["2026-11-02 16:31:39", null, "system", "⏯️ Auto-activada (cola promoción)"],
]);
const P0527 = () => orden("P-0527", { stage: "salidas", created_at: H("2026-09-18 18:20:30") }, [
  ["2026-09-18 18:20:30", "draft", "secretaria", "📋 Orden creada"],
  ["2026-09-18 18:43:49", null, "produccion", "✅ Validada por Producción"],
  ["2026-09-18 18:49:21", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-09-18 18:49:21", "ready", "preprensa", "📝 → ⏩ Ambos validaron → Lista (placa existente, salta CTP)"],
  ["2026-09-18 18:49:26", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-09-18 18:49:26", "ready", "preprensa", "📝 → ⏩ Ambos validaron → Lista (placa existente, salta CTP)"],
  ["2026-09-21 16:07:33", "in_production", "produccion", "🏭 Printmaster 52 (turno 5)"],
  ["2026-09-24 10:26:53", "in_production", "produccion", "🏭 Polar 115"],
  ["2026-09-25 09:41:46", "packaging", "produccion", "⚙️ Máquina → 📦 Empaque"],
  ["2026-09-25 15:42:50", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
]);
// regresó de Diseño a Validar con su razón, se validó otra vez, tres máquinas, una pausa larga en Salidas, entregada (la entrega no lleva `to` en la bitácora)
const P0609 = () => orden("P-0609", { stage: "delivered", created_at: H("2026-10-07 17:05:58"), delivered_at: H("2026-10-29 16:52:03") }, [
  ["2026-10-07 17:05:59", "draft", "secretaria", "📋 Orden creada"],
  ["2026-10-07 17:21:30", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-07 17:37:51", null, "secretaria", "✏️ Editada"],
  ["2026-10-07 17:38:09", null, "produccion", "✅ Validada por Producción"],
  ["2026-10-07 17:38:09", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-10-07 18:03:44", "draft", "preprensa", "↩️ Regresada de 🎨 Diseño → 📝 Validar · Razón: cambio de medida"],
  ["2026-10-07 18:04:30", null, "preprensa", "✏️ Editada"],
  ["2026-10-07 18:16:07", null, "admin", "✏️ Editada"],
  ["2026-10-07 18:20:17", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-07 18:43:29", null, "produccion", "✅ Validada por Producción"],
  ["2026-10-07 18:43:29", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-10-07 22:05:48", null, "admin", "✏️ Editada"],
  ["2026-10-08 09:08:13", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
  ["2026-10-08 09:57:57", "ctp", "german", "🏭 CTP"],
  ["2026-10-08 09:58:01", "ctp", "german", "🏭 Procesadora"],
  ["2026-10-08 09:58:03", "placas_listas", "german", "💿 CTP → 📋 Placas Listas"],
  ["2026-10-08 11:16:37", "ready", "produccion", "📋 Placas Listas → ✅ Lista para imprimir"],
  ["2026-10-08 11:16:50", "in_production", "produccion", "🏭 Printmaster 74 (turno 3)"],
  ["2026-10-08 18:46:00", "in_production", "produccion", "🏭 Cilíndrica (turno 2)"],
  ["2026-10-09 10:13:41", "in_production", "produccion", "🏭 Polar 115"],
  ["2026-10-09 13:57:48", "packaging", "produccion", "⚙️ Máquina → 📦 Empaque"],
  ["2026-10-09 16:16:22", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
  ["2026-10-14 09:33:51", null, "karla", "🧾 En espera: el cliente no ha pedido factura"],
  ["2026-10-29 16:51:59", null, "karla", "🔔 Reactivada"],
  ["2026-10-29 16:52:03", null, "karla", "📄 Asignado folio F-240 (Factura) · ✅ Entregada · ⏳ Pendiente cobro"],
]);
const P0563 = () => orden("P-0563", { stage: "delivered", created_at: H("2026-09-29 09:48:02"), delivered_at: H("2026-10-02 10:18:26") }, [
  ["2026-09-29 09:48:02", "draft", "secretaria", "📋 Orden creada"],
  ["2026-09-29 09:49:09", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-09-29 09:53:04", null, "produccion", "✅ Validada por Producción"],
  ["2026-09-29 09:53:04", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-09-29 17:24:54", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
  ["2026-09-30 09:20:48", "proof_client", "german", "↩️ Regresada de 💿 CTP → 👤 Aprobación · Razón: Ya existen placas"],
  ["2026-09-30 09:38:16", "ctp", "preprensa", "✅ Prueba aprobada"],
  ["2026-09-30 09:43:44", "ctp", "german", "🏭 Procesadora"],
  ["2026-09-30 09:43:47", "placas_listas", "german", "💿 CTP → 📋 Placas Listas"],
  ["2026-09-30 10:42:00", "ready", "produccion", "📋 Placas Listas → ✅ Lista para imprimir"],
  ["2026-09-30 10:42:10", "in_production", "produccion", "🏭 GTO 1 Color (turno 2)"],
  ["2026-10-01 09:14:10", null, "system", "⏯️ Auto-activada (cola promoción)"],
  ["2026-10-01 09:33:51", "packaging", "produccion", "⚙️ Máquina → 📦 Empaque"],
  ["2026-10-01 12:57:16", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
  ["2026-10-02 10:18:26", null, "karla", "🔗 F-108 (emitida por adelantado) ligada a esta orden"],
]);
const P0669 = () => orden("P-0669", { stage: "delivered", created_at: H("2026-10-19 10:38:49"), delivered_at: H("2026-10-19 15:05:44") }, [
  ["2026-10-19 10:38:49", "draft", "secretaria", "📋 Orden creada"],
  ["2026-10-19 11:07:58", null, "produccion", "✅ Validada por Producción"],
  ["2026-10-19 11:57:57", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-19 11:57:57", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-10-19 11:57:59", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-19 11:57:59", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-10-19 11:58:01", "ready", "preprensa", "🎨 Diseño → ✅ Lista para imprimir"],
  ["2026-10-19 12:53:25", null, "karla", "⚡ Folio anticipado F-193 asignado (Factura) · Razón: Cliente"],
  ["2026-10-19 13:55:46", "packaging", "produccion", "🏭 📦 Empaque"],
  ["2026-10-19 13:55:55", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
  ["2026-10-19 15:05:44", null, "karla", "✅ Entregada (folio F-193 ya asignado)"],
]);
const P0702 = () => orden("P-0702", { stage: "maq_delivered", order_type: "maquila", created_at: H("2026-10-27 18:20:44"), delivered_at: H("2026-11-02 10:06:29") }, [
  ["2026-10-27 18:20:45", "maq_created", "secretaria", "📋 Orden creada"],
  ["2026-10-27 18:20:56", "maq_sent", "secretaria", "📋 Creada (Maquila) → 🚚 Enviada a Maquila"],
  ["2026-10-27 18:20:57", "maq_in_progress", "secretaria", "🚚 Enviada a Maquila → ⚙️ Proceso en Maquila"],
  ["2026-11-02 10:06:24", "maq_received", "karla", "⚙️ Proceso en Maquila → 📥 Recibida de Maquila · la recibió Karla: ya llegó del proveedor"],
  ["2026-11-02 10:06:29", null, "karla", "📄 Asignado folio F-250 (Factura) · ✅ Entregada (Maquila) · ⏳ Pendiente cobro"],
]);

async function caso(nombre, o, fn, { viewport = { width: 1366, height: 768 }, ancho = 552, abrir = true, reloj = false } = {}) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const ctx = await browser.newContext({ viewport, timezoneId: "America/Mexico_City", locale: "es-MX" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !deFuera(m)) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    if (reloj) await page.clock.install({ time: AHORA }); else await page.clock.setFixedTime(AHORA);
    await page.addInitScript(x => { window.__orden = x; }, o);
    await page.goto(`http://127.0.0.1:${PORT}/?ancho=${ancho}`);
    await page.locator("#listo").waitFor({ state: "attached", timeout: 30000 });
    if (abrir) { await page.getByRole("button", { name: /Tiempo por etapa/ }).click(); await page.waitForTimeout(120); }
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png", fullPage: true }).catch(() => {});
  await ctx.close();
}
const texto = p => p.evaluate(() => document.getElementById("caja").innerText.replace(/\s+/g, " ").trim());
const cuenta = (t, re) => (t.match(re) || []).length;
// sólo los renglones de las etapas, sin el resumen de arriba («Máquina» también es un rubro del resumen)
const etapas = p => p.evaluate(() => [...document.querySelectorAll("#caja [data-etapa]")].map(x => x.innerText).join(" ").replace(/\s+/g, " ").trim());
const etapa = (p, id) => p.evaluate(s => { const e = document.querySelector(`#caja [data-etapa="${s}"]`); return e ? e.innerText.replace(/\s+/g, " ").trim() : ""; }, id);
const niveles = (p, id) => p.evaluate(s => [...document.querySelectorAll(`#caja [data-etapa="${s}"] [data-nivel]`)].map(x => x.getAttribute("data-nivel") + "|" + (x.getAttribute("aria-label") || "")), id);
const SIN_CORTES = "IMG_20250914_183022_HDR_portrait_edited_edited.HEIC";   // del catálogo de break-ui: sin dónde partirlo
const conEventos = (pn, extra, filas) => orden(pn, { stage: "in_production", created_at: H("2026-11-02 09:30:00"), ...extra }, [["2026-11-02 09:30:00", "draft", "secretaria", "📋 Orden creada"], ...filas]);
// nada se sale de la caja: ni la página se desliza, ni un texto ni un tiempo pasan de su borde, y cada tiempo se queda en su renglón sin taparse con su vecino
const seSale = p => p.evaluate(() => {
  const caja = document.getElementById("caja"), c = caja.getBoundingClientRect(), malos = [];
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth) malos.push("la página se desliza a lo ancho");
  for (const el of caja.querySelectorAll("span,div")) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const q = document.createRange(); q.selectNodeContents(el); const r = q.getBoundingClientRect();
    if (r.right > c.right + 1 || r.left < c.left - 1) malos.push("«" + el.textContent.trim().slice(0, 40) + "»");
  }
  return malos;
});

// ════════════════════════ Validar: quién tardó, Noemí o Gerardo ════════════════════════
await caso("tie-01-validar-dice-quien-tardo", P0726(), async p => {
  const t = await texto(p);
  // P-0726, lunes: se capturó a las 11:30:42; Noemí validó a las 12:47:29 (1 h 17 m) y Gerardo a las 13:49:15 (2 h 19 m): cada quien desde que entró a Validar
  ok("tie-01-validar-dice-quien-tardo", /Noemí\D{0,12}1h 17m/.test(t) && /Gerardo\D{0,12}2h 19m/.test(t), `panel: «${t.slice(0, 200)}»`);
});
await caso("tie-02-la-noche-no-cuenta", P0721(), async p => {
  const t = await texto(p);
  // P-0721: capturada el jueves a las 18:40. Noemí validó a las 18:54 (14 m). Gerardo al día siguiente a las 15:08: de reloj son 20 h 28 m, de horario de trabajo 19 m + 5 h + 8.6 m = 5.5 h
  ok("tie-02-la-noche-no-cuenta", /Noemí\D{0,12}14m/.test(t) && /Gerardo\D{0,12}5h 28m/.test(t) && !/\b2[01]h\b/.test(t), `panel: «${t.slice(0, 200)}»`);
});
await caso("tie-03-el-que-falta-se-dice", ENVALIDAR(), async p => {
  const t = await texto(p);
  // Noemí a los 15 m; Gerardo no ha validado y la orden lleva de 9:30 a 16:00 menos la comida: 5.5 h
  ok("tie-03-el-que-falta-se-dice", /Noemí\D{0,12}15m/.test(t) && /Gerardo\D{0,12}5h 30m/.test(t) && /Gerardo[^·]{0,30}falta/i.test(t), `panel: «${t}»`);
});
await caso("tie-04-faltan-los-dos", SINVALIDAR(), async p => {
  const t = await texto(p);
  ok("tie-04-faltan-los-dos", /Noemí\D{0,12}30m[^·]{0,30}falta/i.test(t) && /Gerardo\D{0,12}30m[^·]{0,30}falta/i.test(t), `panel: «${t}»`);
});
await caso("tie-05-otra-vuelta-a-validar-con-sus-tiempos", P0609(), async p => {
  const t = await texto(p);
  // primera vuelta: Noemí 16 m, Gerardo 32 m; regresó; segunda vuelta, desde que regresó: Noemí 17 m, Gerardo 40 m. La primera no se mezcla con la segunda.
  ok("tie-05-otra-vuelta-a-validar-con-sus-tiempos", /Noemí\D{0,12}16m/.test(t) && /Gerardo\D{0,12}32m/.test(t) && /Noemí\D{0,12}17m/.test(t) && /Gerardo\D{0,12}40m/.test(t), `panel: «${t.slice(0, 320)}»`);
});

// ════════════════════════ Lo que se repite: lo dice, o ya no se repite ════════════════════════
await caso("tie-06-ctp-es-una-etapa-con-sus-pasos", P0726(), async p => {
  const t = await texto(p);
  // la orden pasó una vez por CTP: 54 m en fila (llegó a las 19:04, ya acabado el horario; de 9:00 a 9:53) y los dos pasos que Germán marcó de golpe. Antes salían tres renglones «CTP» sin decir qué era cada uno
  ok("tie-06-ctp-es-una-etapa-con-sus-pasos", /En fila\D{0,12}54m/.test(t) && /Procesadora/.test(t) && cuenta(t, /\bCTP\b/g) <= 2, `«CTP» sale ${cuenta(t, /\bCTP\b/g)} veces; panel: «${t.slice(0, 420)}»`);
});
await caso("tie-07-maquina-dice-cual", P0527(), async p => {
  const t = await texto(p);
  // de lunes 16:07 a jueves 10:26 en la Printmaster 52: 2.9 + 9 + 9 + 1.4 = 22.3 h, 2 días 4 h; luego la Polar 115, 3.6 + 4 + 0.7 = 8.2 h. Una sola etapa «Máquina»: 30.6 h, 3 días 4 h
  ok("tie-07-maquina-dice-cual", cuenta(await etapas(p), /Máquina/g) === 1 && /Printmaster 52\D{0,12}22h/.test(t) && /Polar 115\D{0,12}8h 15m/.test(t) && /31h/.test(t), `«Máquina» sale ${cuenta(await etapas(p), /Máquina/g)} veces; panel: «${t.slice(0, 420)}»`);
});
await caso("tie-08-la-doble-de-la-bitacora-no-se-repite", P0712(), async p => {
  const t = await texto(p);
  ok("tie-08-la-doble-de-la-bitacora-no-se-repite", cuenta(t, /Diseño/g) === 1, `«Diseño» sale ${cuenta(t, /Diseño/g)} veces; panel: «${t.slice(0, 300)}»`);
});
await caso("tie-09-lista-doble-tampoco", P0527(), async p => {
  const t = await texto(p);
  ok("tie-09-lista-doble-tampoco", cuenta(t, /Lista p\/ imprimir/g) === 1, `«Lista p/ imprimir» sale ${cuenta(t, /Lista p\/ imprimir/g)} veces; panel: «${t.slice(0, 300)}»`);
});
await caso("tie-10-regreso-dice-por-que", P0609(), async p => {
  const t = await texto(p);
  ok("tie-10-regreso-dice-por-que", /cambio de medida/.test(t) && /2\.ª vez/.test(t) && /regresó 1 vez/.test(t), `panel: «${t.slice(0, 420)}»`);
});
await caso("tie-11-regreso-de-ctp-dice-por-que", P0563(), async p => {
  const t = await texto(p);
  ok("tie-11-regreso-de-ctp-dice-por-que", /Ya existen placas/.test(t) && /CTP[^]{0,40}2\.ª vez/.test(t), `panel: «${t.slice(0, 420)}»`);
});

// ════════════════════════ Quién responde de cada etapa, y lo que ya terminó ════════════════════════
await caso("tie-12-cada-etapa-con-su-responsable", P0726(), async p => {
  const t = await texto(p);
  // el renglón de CTP decía «Noemí» (la que la pasó): quien responde de ese tiempo es Germán
  ok("tie-12-cada-etapa-con-su-responsable", /Diseño · Noemí/.test(t) && /CTP · Germán/.test(t) && /Salidas · Karla/.test(t) && /la pasó Noemí/.test(t), `panel: «${t.slice(0, 420)}»`);
});
await caso("tie-13-entregada-no-sigue-en-salidas", P0609(), async p => {
  const t = await texto(p);
  // entregada el 29-oct: Salidas se cierra ahí (sin la pausa: 2.7 + 9 + 9 + 0.6 = 21.3 h, 2 días 3 h) y no sigue «en curso»
  ok("tie-13-entregada-no-sigue-en-salidas", !/en curso|aquí ahora/.test(t) && /Entregada/.test(t) && /Salidas[^]{0,30}21h/.test(t), `panel: «${t.slice(-260)}»`);
});
await caso("tie-14-entregada-con-otro-texto", P0563(), async p => {
  const t = await texto(p);
  ok("tie-14-entregada-con-otro-texto", !/en curso|aquí ahora/.test(t) && /Entregada/.test(t), `panel: «${t.slice(-200)}»`);
});
await caso("tie-15-maquila-entregada", P0702(), async p => {
  const t = await texto(p);
  ok("tie-15-maquila-entregada", !/en curso|aquí ahora/.test(t) && /Entregada \(Maquila\)/.test(t), `panel: «${t.slice(-200)}»`);
});
await caso("tie-16-la-nota-dice-que-cuenta", P0726(), async p => {
  const t = await texto(p);
  // v10.84.176 — Marcelo, 4-nov: «si las horas sólo cuenta el tiempo en esa ventana agrega un texto que lo aclare»
  ok("tie-16-la-nota-dice-que-cuenta", t.includes("Los tiempos sólo cuentan el horario de trabajo: lunes a viernes, de 9 a 2 y de 3 a 7.") && t.includes("No cuentan la comida, las noches, los fines de semana, los festivos ni las pausas «En espera».")
    && !/«1d»/.test(t) && t.includes("En Validar, cada quien cuenta desde que la orden entró.") && !/Tiempo hábil|jornada/i.test(t), `panel: «${t.slice(0, 320)}»`);
});
// se lee ANTES que los tiempos: va arriba de la primera etapa, sin cursivas, y se ve al abrir aunque el panel sea largo
await caso("tie-61-la-nota-va-antes-de-los-tiempos", P0609(), async p => {
  const m = await p.evaluate(() => { const caja = document.getElementById("caja"), nota = [...caja.querySelectorAll("div")].find(d => !d.children.length && /^Los tiempos sólo cuentan/.test(d.textContent)), etapa = caja.querySelector("[data-etapa]");
    if (!nota || !etapa) return { hay: false };
    const r = nota.getBoundingClientRect(), h = document.elementFromPoint(r.left + 10, r.top + r.height / 2);
    return { hay: true, antes: r.bottom <= etapa.getBoundingClientRect().top, seVe: h === nota || nota.contains(h), cursiva: getComputedStyle(nota).fontStyle === "italic", px: parseFloat(getComputedStyle(nota).fontSize) }; });
  ok("tie-61-la-nota-va-antes-de-los-tiempos", m.hay && m.antes && m.seVe && !m.cursiva && m.px >= 11, JSON.stringify(m));
});
// lo que no aplica no se dice: una maquila no pasa por Validar
await caso("tie-62-la-maquila-no-habla-de-validar", P0702(), async p => {
  const t = await texto(p);
  ok("tie-62-la-maquila-no-habla-de-validar", /Los tiempos sólo cuentan el horario de trabajo/.test(t) && !/En Validar/.test(t), `panel: «${t.slice(0, 240)}»`);
});
// después de las 7 ya no cuenta, aunque se esté trabajando: las 19:10 a 19:40 son cero, y al día siguiente corre desde las 9
await caso("tie-64-despues-de-las-7-no-cuenta", orden("P-0757", { stage: "design", created_at: H("2026-11-02 19:10:00") }, [
  ["2026-11-02 19:10:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-11-02 19:40:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-03 09:20:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-11-03 09:20:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
]), async p => {
  const t = await texto(p);
  ok("tie-64-despues-de-las-7-no-cuenta", /Noemí\s*<1m/.test(t) && /Gerardo\D{0,12}20m/.test(t), `panel: «${t.slice(0, 320)}»`);
});
// y de 2 a 3 tampoco: lo capturado a la 1:50 y validado a las 3:05 son 15 minutos
await caso("tie-65-la-comida-no-cuenta-en-pantalla", orden("P-0758", { stage: "draft", created_at: H("2026-11-02 13:50:00"), validated_by_production: false }, [
  ["2026-11-02 13:50:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-11-02 15:05:00", null, "preprensa", "✅ Validada por Pre-prensa"],
]), async p => {
  const t = await texto(p);
  ok("tie-65-la-comida-no-cuenta-en-pantalla", /Noemí\D{0,12}15m/.test(t), `panel: «${t.slice(0, 320)}»`);
});

// ════════════════════════ v10.84.177 — su crítica independiente (22/40) y las decisiones de Marcelo (4-nov) ════════════════════════
// P1 2, «no contesta»: una línea que se ve sin abrir. P-0726 al miércoles 16:00: Validar 138.6 m (de Gerardo, el último) + Placas 151.3 + Lista 0.7 + Empaque 0.6 = 4 h 51 m de Gerardo; Diseño 250.8 m, 4 h 11 m de Noemí; CTP 54 m de
//   Germán; Salidas 487.8 m, 8 h 8 m de Karla; total 18.06 h = 2 días. Karla pausó a las 11:34: de ahí a las 16:00, menos la comida, 3 h 26 m que no cuentan.
await caso("tie-70-el-resumen-se-ve-sin-abrir", P0726(), async p => {
  const t = await texto(p);
  ok("tie-70-el-resumen-se-ve-sin-abrir", /Lleva 18h de trabajo · Karla 8h 8m · Gerardo 4h 51m · Noemí 4h 11m · Germán 54m · en espera 3h 26m, no cuenta/.test(t), `cerrado: «${t.slice(0, 240)}»`);
}, { abrir: false });
// P1 1, decisión de Marcelo: lo de fuera no se le cuenta a nadie. «Proceso en Maquila» 3d 2h (39 m + 27 h + 66 m = 28.8 h): con quien la tiene, quién la sigue, sin rojo, y en el resumen no es de Lupita
await caso("tie-71-lo-de-fuera-no-se-le-cuenta-a-nadie", { ...P0702(), maq_provider: "MAKILA" }, async p => {
  const t = await texto(p), n = await niveles(p, "maq_in_progress");
  ok("tie-71-lo-de-fuera-no-se-le-cuenta-a-nadie", /Proceso en Maquila · con MAKILA · la sigue Lupita/.test(t) && n.length === 0 && /Tardó 29h de trabajo · Con MAKILA 29h/.test(t) && !/· Lupita \d/.test(t), `niveles ${JSON.stringify(n)}; «${t.slice(0, 300)}»`);
});
await caso("tie-72-sin-nombre-del-maquilador", P0702(), async p => {
  const t = await texto(p);
  ok("tie-72-sin-nombre-del-maquilador", /Proceso en Maquila · con el maquilador · la sigue Lupita/.test(t) && /Con el maquilador 29h/.test(t), `«${t.slice(0, 300)}»`);
});
await caso("tie-73-la-aprobacion-espera-al-cliente", P0563(), async p => {
  const t = await texto(p);
  ok("tie-73-la-aprobacion-espera-al-cliente", /Aprobación · con el cliente · la sigue Noemí/.test(t) && !/Aprobación · Noemí/.test(t), `«${(t.match(/Aprobación.{0,80}/) || [t.slice(0, 200)])[0]}»`);
});
await caso("tie-87-la-maquila-parcial-tambien", conEventos("P-0759", {}, [
  ["2026-11-02 10:00:00", "maquila_out", "produccion", "🚚 Enviada a Maquila (parcial)"],
  ["2026-11-02 12:00:00", "in_production", "produccion", "🏭 Polar 78"],
]), async p => {
  const t = await etapa(p, "maquila_out");
  ok("tie-87-la-maquila-parcial-tambien", /con el maquilador · la sigue Gerardo/.test(t), `«${t}»`);
});
// P1 3, la pausa deja rastro. P-0609: del 14-oct 09:33 al 29-oct 16:51 son 8.4 + 18 + 45 + 27 + 6.9 = 105.3 h de trabajo: 11d 6h, puestos por Karla con su motivo
await caso("tie-74-la-pausa-deja-rastro", P0609(), async p => {
  const t = await etapa(p, "salidas"), g = await texto(p);
  ok("tie-74-la-pausa-deja-rastro", /En espera\D*105h/.test(t) && /no cuenta/.test(t) && /la puso Karla/.test(t) && /el cliente no ha pedido factura/.test(t) && /21h/.test(t) && /en espera 105h, no cuenta/.test(g), `«${t}»`);
});
// mientras corre: el reloj parado no dice «en curso», y dice desde cuándo
await caso("tie-75-la-pausa-que-sigue-dice-desde-cuando", P0726(), async p => {
  const t = await etapa(p, "salidas");
  ok("tie-75-la-pausa-que-sigue-dice-desde-cuando", /en espera · 8h 8m/.test(t) && !/en curso/.test(t) && /desde mié 04-nov/.test(t) && /la puso Karla/.test(t), `«${t}»`);
});
// entregada con la pausa abierta (sin «Reactivada»): la pausa termina al entregar, no sigue corriendo hasta hoy
await caso("tie-84-la-pausa-se-cierra-al-entregar", conEventos("P-0760", { stage: "delivered", delivered_at: H("2026-11-02 12:00:00") }, [
  ["2026-11-02 10:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
  ["2026-11-02 11:00:00", null, "karla", "🧾 En espera: el cliente no ha pedido factura"],
  ["2026-11-02 12:00:00", null, "karla", "✅ Entregada (folio F-1 ya asignado)"],
]), async p => {
  const t = await etapa(p, "salidas"), g = await texto(p);
  ok("tie-84-la-pausa-se-cierra-al-entregar", /Salidas · Karla\D{0,6}1h/.test(t) && /En espera\D*1h/.test(t) && !/desde/.test(t) && /en espera 1h, no cuenta/.test(g), `«${t}»`);
});
await caso("tie-85-la-pausa-sin-motivo", conEventos("P-0761", { stage: "salidas" }, [
  ["2026-11-02 10:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
  ["2026-11-02 11:00:00", null, "karla", "↩️ En espera restaurada"],
  ["2026-11-02 12:00:00", null, "karla", "🔔 Reactivada"],
]), async p => {
  const t = await etapa(p, "salidas");
  ok("tie-85-la-pausa-sin-motivo", /En espera\D*1h/.test(t) && /la puso Karla/.test(t) && !/undefined|null|restaurada/.test(t), `«${t}»`);
});
// «Printmaster 74 · turno 3 · 2d 5h» no distinguía fila de impresión. La bitácora sólo sabe cuándo le tocó (36% de los pasos con turno no lo traen), así que se dice sólo eso, y sólo si se sabe.
// P-0563: GTO 1 Color, turno 2, del 30-sep 10:42:10 al «⏯️» del 1-oct 09:14:10: 3 h 18 m + 4 h + 14 m = 7 h 32 m
await caso("tie-76-esperar-turno-se-dice", P0563(), async p => {
  const t = await etapa(p, "in_production");
  ok("tie-76-esperar-turno-se-dice", /GTO 1 Color/.test(t) && /turno 2/.test(t) && /esperó su turno 7h 32m/.test(t), `«${t}»`);
});
await caso("tie-77-sin-saberlo-no-se-inventa", P0527(), async p => {
  const t = await etapa(p, "in_production");
  ok("tie-77-sin-saberlo-no-se-inventa", /Printmaster 52/.test(t) && !/esperó/.test(t), `«${t}»`);
});
// con varios pasos, cada máquina el suyo; y si se activó dos veces, cuenta la primera
await caso("tie-86-esperar-turno-en-cada-paso", conEventos("P-0762", {}, [
  ["2026-11-02 10:00:00", "in_production", "produccion", "🏭 Printmaster 74 (turno 3)"],
  ["2026-11-02 12:00:00", null, "system", "⏯️ Auto-activada (cola promoción)"],
  ["2026-11-02 13:00:00", null, "gerardo", "⏯️ Movida a ACTIVA"],
  ["2026-11-03 10:00:00", "in_production", "produccion", "🏭 Manual #2"],
]), async p => {
  const t = await etapa(p, "in_production");
  ok("tie-86-esperar-turno-en-cada-paso", /Printmaster 74[^]*esperó su turno 2h(?! \d)/.test(t) && cuenta(t, /esperó/g) === 1, `«${t}»`);
});
// decisión de Marcelo: lo lento, contra lo normal de cada etapa (p90 de 180 días): Validar 5 h, Máquina 56 h, Salidas 23 h; en rojo, el doble.
// Validar de 9:00 a 16:00 del lunes son 6 h: ámbar, y en el renglón de Gerardo (10:00 de Noemí no)
await caso("tie-78-validar-6h-ya-es-mucho", orden("P-0763", { stage: "design", created_at: H("2026-11-02 09:00:00") }, [
  ["2026-11-02 09:00:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-11-02 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 16:00:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-11-02 16:00:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
]), async p => {
  const n = await niveles(p, "draft"), t = await texto(p);
  ok("tie-78-validar-6h-ya-es-mucho", n.length === 2 && n.every(x => /^sobre\|.*más de lo normal/.test(x)) && /En ámbar, lo que pasó de lo normal de su etapa; en rojo, el doble\./.test(t), `${JSON.stringify(n)}; «${t.slice(0, 300)}»`);
});
await caso("tie-79-validar-11h-es-el-doble", orden("P-0764", { stage: "design", created_at: H("2026-11-02 09:00:00") }, [
  ["2026-11-02 09:00:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-11-03 11:00:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-11-03 11:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-03 11:00:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
]), async p => {
  const n = await niveles(p, "draft");
  ok("tie-79-validar-11h-es-el-doble", n.length === 3 && n.every(x => /^doble\|.*el doble de lo normal/.test(x)), JSON.stringify(n));
});
// Máquina 30.6 h es de lo normal (p90 56 h): antes salía en rojo. Sin marcas, tampoco se explica lo que no sale
await caso("tie-88-maquina-30h-es-normal", P0527(), async p => {
  const n = await niveles(p, "in_production");
  ok("tie-88-maquina-30h-es-normal", n.length === 0 && /31h/.test(await etapa(p, "in_production")), JSON.stringify(n));
});
await caso("tie-89-sin-marcas-no-se-explican", SINVALIDAR(), async p => {
  const t = await texto(p);
  ok("tie-89-sin-marcas-no-se-explican", !/lo normal/.test(t), `«${t.slice(0, 340)}»`);
});
// Salidas del viernes 15:00 al miércoles 16:00: 4 + 9 + 9 + 6 = 28 h: arriba de 23, ámbar
await caso("tie-90-salidas-28h-pasa-de-lo-normal", orden("P-0765", { stage: "salidas", created_at: H("2026-10-30 14:00:00") }, [
  ["2026-10-30 14:00:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-10-30 15:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
]), async p => {
  const n = await niveles(p, "salidas");
  ok("tie-90-salidas-28h-pasa-de-lo-normal", n.length === 1 && /^sobre\|/.test(n[0]), JSON.stringify(n));
});
// la negrita sola no dice nada (ni se oye): lleva su palabra. Con empate, nadie
await caso("tie-80-el-ultimo-se-dice", P0726(), async p => {
  const t = await etapa(p, "draft");
  ok("tie-80-el-ultimo-se-dice", /Gerardo\D{0,12}2h 19m validó [^·]*· al último/.test(t) && !/12:47 p\.m\. · al último/.test(t), `«${t}»`);
});
await caso("tie-81-terminada-dice-cuanto-duro", conEventos("P-0766", { stage: "cancelled", cancelled_at: H("2026-11-02 12:00:00") }, [
  ["2026-11-02 12:00:00", null, "admin", "❌ Cancelada: Orden repetida"],
]), async p => {
  ok("tie-81-terminada-dice-cuanto-duro", /Duró 2h 30m de trabajo/.test(await texto(p)), `«${(await texto(p)).slice(0, 200)}»`);
}, { abrir: false });
await caso("tie-91-la-entregada-dice-que-tardo", P0609(), async p => {
  ok("tie-91-la-entregada-dice-que-tardo", /Tardó \S+( \S+)? de trabajo/.test(await texto(p)), `«${(await texto(p)).slice(0, 200)}»`);
}, { abrir: false });
// de quién es el tiempo de Validar: de quien falta; de los dos si faltan los dos; si la bitácora no guardó a uno, del que sí está
await caso("tie-82-validar-es-de-quien-falta", ENVALIDAR(), async p => {
  ok("tie-82-validar-es-de-quien-falta", /Lleva 5h 30m de trabajo · Gerardo 5h 30m/.test(await texto(p)), `«${(await texto(p)).slice(0, 200)}»`);
}, { abrir: false });
await caso("tie-92-validar-de-los-dos", SINVALIDAR(), async p => {
  ok("tie-92-validar-de-los-dos", /Lleva 30m de trabajo · Noemí y Gerardo 30m/.test(await texto(p)), `«${(await texto(p)).slice(0, 200)}»`);
}, { abrir: false });
await caso("tie-83-validar-sin-la-hora-de-uno", conEventos("P-0545", { stage: "ready" }, [
  ["2026-11-02 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 10:00:00", "ready", "preprensa", "📝 → ⏩ Ambos validaron → Lista (placa existente, salta CTP)"],
]), async p => {
  // la media hora de Validar es de Noemí, la única con hora; lo de Gerardo en el resumen es de «Lista p/ imprimir»
  ok("tie-83-validar-sin-la-hora-de-uno", /· Noemí 30m/.test(await texto(p)), `«${(await texto(p)).slice(0, 200)}»`);
}, { abrir: false });
// sin decimales en ningún lado («2.3h» se leía como 2 horas 30), y lo que no se parte tampoco se sale del resumen
await caso("tie-93-sin-decimales", P0609(), async p => {
  const t = await texto(p);
  ok("tie-93-sin-decimales", !/\d\.\dh/.test(t) && !/\b\d+d\b/.test(t) && /Polar 115/.test(t), `«${(t.match(/.{20}\d\.\dh.{10}/) || ["sin decimales"])[0]}»`);
});
await caso("tie-94-el-resumen-no-se-sale", { ...P0702(), maq_provider: "IMG_20250914_183022_HDR_portrait_edited_edited.HEIC" }, async p => {
  const m = await seSale(p);
  ok("tie-94-el-resumen-no-se-sale", m.length === 0, m.slice(0, 4).join(" · ") || "todo adentro");
}, { ancho: 300 });

// ════════════════════════ v10.84.178 — el P2 de la crítica (los colores) y lo menor; Marcelo: «sigamos haciendo pases hasta dejarla lo más alta posible» ════════════════════════
// los festivos de ley no cuentan: el 16-sep-2026 no hubo ni un movimiento en la bitácora. Del martes 15-sep 18:00 al jueves 17-sep 9:30: 1 h + 0 + 30 m
await caso("tie-100-el-festivo-no-cuenta", orden("P-0767", { stage: "design", created_at: H("2026-09-15 18:00:00") }, [
  ["2026-09-15 18:00:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-09-17 09:30:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-09-17 09:30:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-09-17 09:30:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
]), async p => {
  const t = await etapa(p, "draft");
  ok("tie-100-el-festivo-no-cuenta", /Validar\s*1h 30m/.test(t), `«${t}»`);
});
// lo que pasó todo fuera del horario no es «<1m»: de 19:05 a 19:20 hubo trabajo, y no cuenta. Lo instantáneo sigue siendo <1m
await caso("tie-101-fuera-de-horario-se-dice", conEventos("P-0768", { stage: "ctp" }, [
  ["2026-11-02 19:05:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-11-02 19:20:00", "ready", "preprensa", "🎨 Diseño → ✅ Lista para imprimir"],
  ["2026-11-03 10:00:00", "placas_listas", "german", "🏭 CTP"],
  ["2026-11-03 10:00:10", "ctp", "german", "💿 CTP → 📋 Placas Listas"],
]), async p => {
  const d = await etapa(p, "design"), l = await etapa(p, "placas_listas");
  ok("tie-101-fuera-de-horario-se-dice", /fuera de horario/.test(d) && !/<1m/.test(d) && /<1m/.test(l) && !/fuera de horario/.test(l), `«${d}» · «${l}»`);
});
// la cifra «en curso» avanza con el panel abierto: 30 m más de horario, 30 m más
await caso("tie-102-en-curso-avanza-solo", SINVALIDAR(), async p => {
  const a = await texto(p);
  await p.clock.fastForward("30:00"); await p.waitForTimeout(150);
  const b = await texto(p);
  ok("tie-102-en-curso-avanza-solo", /Lleva 30m de trabajo/.test(a) && /Lleva 1h de trabajo/.test(b), `«${a.slice(0, 60)}» → «${b.slice(0, 60)}»`);
}, { reloj: true });
// lector de pantalla y teclado: una lista de etapas, y el panel es una región a la que se llega con Tab para desplazarlo
await caso("tie-103-lista-y-region", P0726(), async p => {
  const m = await p.evaluate(() => { const b = [...document.querySelectorAll("#caja button")].find(x => /Tiempo por etapa/.test(x.textContent)), id = b.getAttribute("aria-controls"), r = id && document.getElementById(id);
    return { controla: !!r, rol: r?.getAttribute("role"), nombre: r?.getAttribute("aria-label"), tab: r?.getAttribute("tabindex"), li: document.querySelectorAll("#caja ol > li[data-etapa]").length, etapas: document.querySelectorAll("#caja [data-etapa]").length }; });
  ok("tie-103-lista-y-region", m.controla && m.rol === "region" && /P-0726/.test(m.nombre || "") && m.tab === "0" && m.li === m.etapas && m.li > 0, JSON.stringify(m));
});
// lo que ya dice el nombre de la etapa no se repite: «Empaque · Gerardo» no lleva «la pasó Gerardo»; «CTP · Germán» sí dice que la pasó Noemí
await caso("tie-105-no-se-repite-quien", P0726(), async p => {
  const e = await etapa(p, "packaging"), c = await etapa(p, "ctp");
  ok("tie-105-no-se-repite-quien", !/la pasó/.test(e) && /la pasó Noemí/.test(c), `«${e}» · «${c}»`);
});
// el P2: una orden sana es casi monocroma. El nombre en tinta, el color sólo en el punto, sin pastilla si no pasa de lo normal; rojo y ámbar sólo para tiempo
await caso("tie-106-sana-es-casi-monocroma", SINVALIDAR(), async p => {
  const m = await p.evaluate(() => { const nombre = document.querySelector('#caja [data-nombre-etapa]'), fondos = [...document.querySelectorAll("#caja [data-etapa] span")].filter(s => { const c = getComputedStyle(s).backgroundColor; return c !== "rgba(0, 0, 0, 0)" && c !== "transparent"; }).map(s => s.textContent.slice(0, 20));
    return { color: nombre ? getComputedStyle(nombre).color : null, fondos }; });
  ok("tie-106-sana-es-casi-monocroma", m.color === "rgb(26, 26, 31)" && m.fondos.length === 0, JSON.stringify(m));
});
await caso("tie-107-regresar-no-es-rojo", P0609(), async p => {
  const m = await p.evaluate(() => { const v = [...document.querySelectorAll('#caja [data-etapa="draft"]')][1], n = v?.querySelector("[data-nombre-etapa]"), d = v?.querySelector("div"); const boton = [...document.querySelectorAll("#caja button span")].find(s => /regresó/.test(s.textContent) && !s.querySelector("span"));
    return { nombre: n ? getComputedStyle(n).color : null, boton: boton ? getComputedStyle(boton).color : null, punto: d ? getComputedStyle(d.firstElementChild || d).backgroundColor : null, icono: !!v?.querySelector("svg") }; });
  ok("tie-107-regresar-no-es-rojo", m.nombre === "rgb(26, 26, 31)" && m.boton === "rgb(26, 26, 31)" && m.punto !== "rgb(224, 59, 48)" && m.icono, JSON.stringify(m));
});
// los renglones sanos sin pastilla; la que pasa de lo normal, con ícono, y lleva su color
await caso("tie-108-solo-lo-que-rebasa-lleva-pastilla", orden("P-0763", { stage: "design", created_at: H("2026-11-02 09:00:00") }, [
  ["2026-11-02 09:00:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-11-02 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 16:00:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-11-02 16:00:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
]), async p => {
  const m = await p.evaluate(() => { const fondo = e => { const c = getComputedStyle(e).backgroundColor; return c !== "rgba(0, 0, 0, 0)" && c !== "transparent"; }; const v = document.querySelector('#caja [data-etapa="draft"] [data-nivel]'); const pastillas = [...document.querySelectorAll('#caja [data-etapa="design"] span')].filter(fondo).length; return { conFondo: v ? fondo(v) : null, icono: !!v?.querySelector("svg"), pastillas }; });
  ok("tie-108-solo-lo-que-rebasa-lleva-pastilla", m.conFondo === true && m.icono && m.pastillas === 0, JSON.stringify(m));
});
await caso("tie-109-las-fechas-dicen-el-dia", P0726(), async p => {
  const t = await etapa(p, "draft");
  ok("tie-109-las-fechas-dicen-el-dia", /Capturada lun 02-nov/.test(t) && /validó lun 02-nov/.test(t), `«${t}»`);
});
// el resumen está dentro del botón: se oye con su nombre, y tocarlo abre
await caso("tie-110-tocar-el-resumen-abre", P0726(), async p => {
  await p.locator("[data-resumen]").click(); await p.waitForTimeout(120);
  const a = await p.getByRole("button", { name: /Lleva 18h de trabajo/ }).getAttribute("aria-expanded"), t = await texto(p);
  ok("tie-110-tocar-el-resumen-abre", a === "true" && /Los tiempos sólo cuentan/.test(t), `aria-expanded ${a}`);
}, { abrir: false });

// la vuelta 2 de la 178: con el teclado se llega al panel y se sale; regresar dos veces; dos pausas; lo de fuera con pausa; lo que no cabe en el botón
await caso("tie-115-tab-llega-al-panel-y-sale", P0726(), async p => {
  await p.getByRole("button", { name: /Tiempo por etapa/ }).focus();
  await p.keyboard.press("Tab"); const a = await p.evaluate(() => document.activeElement.getAttribute("role"));
  await p.keyboard.press("Tab"); const b = await p.evaluate(() => document.activeElement.getAttribute("role"));
  await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Shift+Tab"); const c = await p.evaluate(() => /Tiempo por etapa/.test(document.activeElement.textContent) && document.activeElement.tagName);
  ok("tie-115-tab-llega-al-panel-y-sale", a === "region" && b !== "region" && c === "BUTTON", `${a} → ${b} → ${c}`);
});
await caso("tie-116-etapa-que-no-conoce", conEventos("P-0769", { stage: "etapa_nueva" }, [["2026-11-02 10:00:00", "etapa_nueva", "produccion", "▶ algo nuevo"]]), async p => {
  const t = await texto(p);
  ok("tie-116-etapa-que-no-conoce", /etapa_nueva/.test(t) && /en curso/.test(t) && !/undefined|NaN/.test(t), `«${t.slice(0, 260)}»`);
});
await caso("tie-119-regresar-dos-veces", conEventos("P-0770", { stage: "ctp" }, [
  ["2026-11-02 10:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-11-02 10:30:00", "draft", "preprensa", "↩️ Regresada de 🎨 Diseño → 📝 Validar · Razón: una"],
  ["2026-11-02 11:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-11-02 11:30:00", "draft", "preprensa", "↩️ Regresada de 🎨 Diseño → 📝 Validar · Razón: dos"],
  ["2026-11-02 12:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
]), async p => {
  const t = await texto(p);
  ok("tie-119-regresar-dos-veces", /regresó 2 veces/.test(t) && /3\.ª vez/.test(t) && /Razón: una/.test(t) && /Razón: dos/.test(t), `«${t.slice(0, 200)}»`);
});
await caso("tie-121-lo-de-fuera-con-pausa", conEventos("P-0771", { stage: "maq_in_progress", order_type: "maquila", maq_provider: "MAKILA" }, [
  ["2026-11-02 10:00:00", "maq_in_progress", "secretaria", "🚚 Enviada a Maquila → ⚙️ Proceso en Maquila"],
  ["2026-11-02 11:00:00", null, "secretaria", "🔕 En espera: Esperando autorización"],
  ["2026-11-02 12:00:00", null, "secretaria", "🔔 Reactivada"],
]), async p => {
  const t = await etapa(p, "maq_in_progress"), n = await niveles(p, "maq_in_progress");
  ok("tie-121-lo-de-fuera-con-pausa", /con MAKILA/.test(t) && /En espera\D*1h/.test(t) && /la puso Lupita/.test(t) && n.length === 0, `«${t}»`);
});
await caso("tie-123-dos-pausas-en-la-misma-etapa", conEventos("P-0772", { stage: "salidas" }, [
  ["2026-11-02 10:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
  ["2026-11-02 11:00:00", null, "karla", "🧾 En espera: una"],
  ["2026-11-02 12:00:00", null, "karla", "🔔 Reactivada"],
  ["2026-11-02 12:30:00", null, "karla", "🧾 En espera: otra"],
  ["2026-11-02 13:00:00", null, "karla", "🔔 Reactivada"],
]), async p => {
  const t = await etapa(p, "salidas"), g = await texto(p);
  ok("tie-123-dos-pausas-en-la-misma-etapa", cuenta(t, /En espera/g) === 2 && /no cuenta [^]*una/.test(t) && /no cuenta [^]*otra/.test(t) && /en espera 1h 30m, no cuenta/.test(g), `«${t}»`);
});
await caso("tie-124-sin-pausa-no-la-menciona", P0527(), async p => {
  const t = await texto(p);
  ok("tie-124-sin-pausa-no-la-menciona", !/en espera/i.test(t.split("Los tiempos")[0]), `«${t.slice(0, 200)}»`);
}, { abrir: true });
// muchísimas horas, a lo angosto: «1,284h» y su pastilla no se salen. Desde enero en Salidas son más de mil horas; ámbar y rojo se ven sin encimarse con el nombre
await caso("tie-125-mil-horas-a-lo-angosto", orden("P-0773", { stage: "salidas", created_at: H("2026-01-05 09:30:00") }, [
  ["2026-01-05 09:30:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-01-05 10:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
]), async p => {
  const m = await seSale(p), t = await etapa(p, "salidas"), n = await niveles(p, "salidas");
  ok("tie-125-mil-horas-a-lo-angosto", m.length === 0 && /\d,\d{3}h/.test(t) && /^doble\|/.test(n[0] || ""), m.slice(0, 3).join(" · ") || `«${t.slice(0, 120)}»`);
}, { ancho: 300 });
// los nombres raros (quien firma con acentos o de derecha a izquierda) y un motivo sin cortes (del catálogo de break-ui) no truenan ni se salen a lo angosto
await caso("tie-126-nombres-raros-a-lo-angosto", conEventos("P-0774", { stage: "ctp" }, [
  ["2026-11-02 10:00:00", "ctp", "Đặng Thị Ngọc Hân", "🎨 Diseño → 💿 CTP"],
  ["2026-11-02 11:00:00", "ctp", "نور الهدى عبد الرحمن", "🏭 CTP"],
  ["2026-11-02 12:00:00", null, "Aleksandra Wiśniewska-Kowalczyk", "🧾 En espera: IMG_20250914_183022_HDR_portrait_edited_edited.HEIC"],
]), async p => {
  const m = await seSale(p), t = await texto(p);
  ok("tie-126-nombres-raros-a-lo-angosto", m.length === 0 && /Đặng Thị Ngọc Hân/.test(t) && /نور الهدى/.test(t) && /IMG_20250914/.test(t), m.slice(0, 3).join(" · ") || "todo adentro");
}, { ancho: 300 });

// pausada y arriba de lo normal: la pausa no le quita la marca a lo que ya rebasó. Del lunes 19-oct 10:00 al viernes 23-oct 10:00 son 36 h de trabajo en Salidas (lo normal, 23), y de ahí en espera
await caso("tie-127-pausada-y-arriba-de-lo-normal", orden("P-0775", { stage: "salidas", created_at: H("2026-10-19 09:30:00"), snooze_reason: "El cliente aún no ha pedido factura/remisión", snooze_stage: "salidas", snoozed_by: "karla" }, [
  ["2026-10-19 09:30:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-10-19 10:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
  ["2026-10-23 10:00:00", null, "karla", "🧾 En espera: el cliente no ha pedido factura"],
]), async p => {
  const t = await etapa(p, "salidas"), n = await niveles(p, "salidas");
  ok("tie-127-pausada-y-arriba-de-lo-normal", /^sobre\|/.test(n[0] || "") && /36h/.test(t) && /En espera/.test(t) && /no cuenta/.test(t), `${n[0]} · «${t}»`);
});

// ════════════════════════ Vuelta 2: por donde no se diseñó ════════════════════════
const LARGA = () => conEventos("P-0740", {}, [
  ["2026-11-02 10:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-11-02 11:00:00", "draft", "preprensa", "↩️ Regresada de 🎨 Diseño → 📝 Validar · Razón: " + SIN_CORTES.repeat(9)],
  ["2026-11-02 12:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-11-02 13:00:00", "in_production", "produccion", "🏭 " + SIN_CORTES + " (turno 12)"],
  ["2026-11-03 13:00:00", "in_production", "produccion", "🏭 Müller Martini"],
  ["2026-11-03 13:30:00", "in_production", "produccion", "🏭 Printmaster 52 (cola 88)"],
]);
await caso("tie-20-lo-que-no-se-parte-no-se-sale", LARGA(), async p => {
  const m = await seSale(p);
  ok("tie-20-lo-que-no-se-parte-no-se-sale", m.length === 0, m.slice(0, 4).join(" · ") || "todo adentro");
});
await caso("tie-21-tampoco-en-una-columna-angosta", LARGA(), async p => {
  const m = await seSale(p), t = await texto(p);
  ok("tie-21-tampoco-en-una-columna-angosta", m.length === 0 && /turno 12/.test(t), m.slice(0, 4).join(" · ") || "todo adentro");
}, { ancho: 300 });
await caso("tie-22-texto-raro-se-lee-tal-cual", conEventos("P-0741", {}, [
  ["2026-11-02 10:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-11-02 11:00:00", "draft", "preprensa", "↩️ Regresada de 🎨 Diseño → 📝 Validar · Razón: <script>alert(1)</script> &amp; **ojo** نور الهدى"],
  ["2026-11-02 12:00:00", "in_production", "produccion", "🏭 👩🏽‍💻 Prensa Ñandú"],
  ["2026-11-02 12:30:00", "in_production", "produccion", "🏭 "],
]), async p => {
  const t = await texto(p);
  ok("tie-22-texto-raro-se-lee-tal-cual", t.includes("<script>alert(1)</script> &amp; **ojo** نور الهدى") && /Prensa Ñandú/.test(t) && !/🏭/.test(t) && !/undefined|null|NaN/.test(t), `panel: «${t.slice(0, 360)}»`);
});
await caso("tie-23-razon-en-dos-renglones", conEventos("P-0742", { stage: "draft" }, [
  ["2026-11-02 10:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-11-02 11:00:00", "draft", "preprensa", "↩️ Regresada de 🎨 Diseño → 📝 Validar · Razón: renglón uno\nrenglón dos"],
]), async p => {
  const t = await texto(p);
  ok("tie-23-razon-en-dos-renglones", /Razón: renglón uno renglón dos/.test(t), `panel: «${t.slice(0, 300)}»`);
});
for (const [n, tl] of [["vacia", []], ["sin-ella", undefined], ["con-basura", [null, {}, { date: "no es fecha", to: "ctp" }, { date: H("2026-11-04 10:00:00"), action: null }, { date: H("2026-11-04 10:30:00"), to: "design" }]]]) {
  await caso("tie-24-bitacora-" + n, { ...orden("P-0743", { stage: "design", created_at: H("2026-11-04 09:30:00") }, []), timeline: tl }, async p => {
    const t = await texto(p);
    ok("tie-24-bitacora-" + n, /Diseño/.test(t) && /en curso/.test(t) && !/undefined|null|NaN|Invalid/.test(t), `panel: «${t.slice(0, 240)}»`);
  });
}
await caso("tie-25-venta-de-inventario-sin-transiciones-no-pinta-nada", orden("P-0656", { stage: "delivered", created_at: H("2026-10-09 12:00:00"), delivered_at: H("2026-10-09 12:00:00") }, [["2026-10-09 12:00:00", "delivered", "karla", "📋 Orden creada"]]), async p => {
  ok("tie-25-venta-de-inventario-sin-transiciones-no-pinta-nada", (await p.getByRole("button", { name: /Tiempo por etapa/ }).count()) === 0, "con la orden entregada desde que nació no hay etapas que contar");
}, { abrir: false });
await caso("tie-26-cancelada-se-cierra", conEventos("P-0629", { stage: "cancelled", cancelled_at: H("2026-11-02 12:00:00"), delivered_at: H("2026-10-01 12:00:00") }, [
  ["2026-11-02 10:00:00", "packaging", "produccion", "⚙️ Máquina → 📦 Empaque"],
  ["2026-11-02 12:00:00", null, "admin", "❌ Cancelada: Orden repetida"],
]), async p => {
  const t = await texto(p);
  // de 10:00 a 12:00 en Empaque, y fin. No sigue corriendo hasta el miércoles
  ok("tie-26-cancelada-se-cierra", !/en curso|aquí ahora/.test(t) && /Empaque · Gerardo\D{0,6}2h/.test(t) && /Cancelada[^·]*· Dirección/.test(t) && !/· fin/.test(t), `panel: «${t.slice(0, 300)}»`);
});
await caso("tie-27-entregada-sin-su-fecha-usa-su-evento", conEventos("P-0744", { stage: "delivered" }, [
  ["2026-11-02 10:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
  ["2026-11-02 11:00:00", null, "karla", "✅ Entregada (folio F-1 ya asignado)"],
]), async p => {
  const t = await texto(p);
  ok("tie-27-entregada-sin-su-fecha-usa-su-evento", !/en curso|aquí ahora/.test(t) && /Salidas · Karla\D{0,6}1h/.test(t) && /Entregada[^·]*· Karla/.test(t) && !/· fin/.test(t), `panel: «${t.slice(0, 300)}»`);
});
await caso("tie-28-la-entrega-antes-de-la-ultima-etapa-no-da-negativo", conEventos("P-0745", { stage: "delivered", delivered_at: H("2026-11-02 09:40:00") }, [
  ["2026-11-02 10:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
]), async p => {
  const t = await texto(p);
  ok("tie-28-la-entrega-antes-de-la-ultima-etapa-no-da-negativo", !/-\d|NaN/.test(t.replace(/\d{2}-[a-z]{3}/g, "")) && /Salidas · Karla\s*<1m/.test(t), `panel: «${t.slice(0, 300)}»`);
});
const MUCHOS = () => { const f = []; for (let i = 0; i < 300; i++) f.push([`2026-10-${String(1 + (i % 27)).padStart(2, "0")} ${String(9 + (i % 9)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00`, "in_production", "produccion", "🏭 Máquina " + (i % 7)]);
  return conEventos("P-0746", { created_at: H("2026-09-30 09:30:00") }, f.sort((a, b) => a[0].localeCompare(b[0]))); };
await caso("tie-29-300-pasos-no-se-traba", MUCHOS(), async p => {
  const t0 = performance.now();
  await p.getByRole("button", { name: /Tiempo por etapa/ }).click(); await p.getByText("Máquina 1", { exact: true }).first().waitFor();
  const ms = Math.round(performance.now() - t0), n = await p.evaluate(() => document.querySelectorAll("#caja [data-etapa]").length);
  ok("tie-29-300-pasos-no-se-traba", ms < 4000 && n === 2, `se abrió en ${ms} ms con ${n} etapas`);
}, { abrir: false });
await caso("tie-30-gerardo-valida-con-el-panel-abierto", ENVALIDAR(), async p => {
  const antes = await texto(p);
  await p.evaluate(() => { const o = window.__orden; window.__cambiar({ stage: "design", validated_by_production: true, timeline: [...o.timeline,
    { date: "2026-11-04T15:30:00-06:00", by: "produccion", action: "✅ Validada por Producción" }, { date: "2026-11-04T15:30:00-06:00", to: "design", by: "produccion", action: "📝 → 🎨 Ambos validaron → Diseño" }] }); });
  await p.waitForTimeout(150);
  const t = await texto(p);
  // de 9:30 a 15:30 menos la comida: 5 h; y Diseño lleva 30 m
  ok("tie-30-gerardo-valida-con-el-panel-abierto", /falta/.test(antes) && !/falta/.test(t) && /Gerardo\D{0,12}5h/.test(t) && /Diseño · Noemí\s*en curso · 30m/.test(t), `panel: «${t.slice(0, 300)}»`);
});
await caso("tie-31-fuera-de-jornada-no-cuenta", orden("P-0747", { stage: "design", created_at: H("2026-10-30 19:40:00") }, [
  ["2026-10-30 19:40:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-10-31 11:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 09:05:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-11-02 09:05:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
]), async p => {
  const t = await texto(p);
  // capturada el viernes a las 19:40, ya acabada la jornada. Noemí validó en sábado: nada de jornada todavía. Gerardo, el lunes a las 9:05: 5 minutos
  ok("tie-31-fuera-de-jornada-no-cuenta", /Noemí\s*<1m/.test(t) && /Gerardo\D{0,12}5m/.test(t), `panel: «${t.slice(0, 240)}»`);
});
await caso("tie-32-la-pausa-en-validar-no-cuenta-para-nadie", orden("P-0748", { stage: "design", created_at: H("2026-11-02 10:00:00") }, [
  ["2026-11-02 10:00:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-11-02 10:30:00", null, "secretaria", "🔕 En espera: falta el archivo"],
  ["2026-11-02 12:00:00", null, "secretaria", "🔔 Reactivada"],
  ["2026-11-02 12:30:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 13:00:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-11-02 13:00:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
]), async p => {
  const t = await texto(p);
  ok("tie-32-la-pausa-en-validar-no-cuenta-para-nadie", /Noemí\D{0,12}1h/.test(t) && /Gerardo\D{0,12}1h 30m/.test(t), `panel: «${t.slice(0, 240)}»`);
});
await caso("tie-33-otra-firma-se-dice", conEventos("P-0749", { stage: "design" }, [
  ["2026-11-02 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 11:00:00", null, "admin", "✅ Validada por Producción"],
  ["2026-11-02 11:00:00", "design", "admin", "📝 → 🎨 Ambos validaron → Diseño"],
]), async p => {
  const t = await texto(p);
  ok("tie-33-otra-firma-se-dice", /Gerardo\D{0,12}1h 30m validó [^·]*· por Dirección/.test(t) && !/Noemí[^·]*por /.test(t), `panel: «${t.slice(0, 240)}»`);
});
await caso("tie-34-la-que-no-guardo-la-hora-lo-dice", conEventos("P-0545", { stage: "design" }, [
  ["2026-11-02 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 10:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
]), async p => {
  const t = await texto(p);
  // la bitácora dice que ambos validaron, pero sin el renglón de Gerardo (P-0545 y 8 más): no se inventa un tiempo ni se dice que no validó
  ok("tie-34-la-que-no-guardo-la-hora-lo-dice", /Gerardo\s*—\s*validó · la bitácora no guardó la hora/.test(t) && !/no validó/.test(t), `panel: «${t.slice(0, 240)}»`);
});
// lo encontró el barrido: P-0544 y 7 más salen de Validar con «🎨 Diseño → 💿 CTP»: ya iba en Diseño y la bitácora perdió ese paso. Gerardo sí validó: «no validó» sería falso
await caso("tie-46-la-bitacora-perdio-el-paso", conEventos("P-0544", { stage: "ctp" }, [
  ["2026-11-02 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 12:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
]), async p => {
  const t = await texto(p);
  ok("tie-46-la-bitacora-perdio-el-paso", /Gerardo\s*—\s*validó · la bitácora no guardó la hora/.test(t) && !/no validó/.test(t), `panel: «${t.slice(0, 240)}»`);
});
await caso("tie-47-cancelada-en-validar-no-dice-que-falta", orden("P-0628", { stage: "cancelled", created_at: H("2026-11-02 09:30:00"), cancelled_at: H("2026-11-02 10:00:00"), validated_by_production: false, validated_by_preprensa: false }, [
  ["2026-11-02 09:30:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-11-02 10:00:00", null, "secretaria", "❌ Cancelada: se duplicó"],
]), async p => {
  const t = await texto(p);
  ok("tie-47-cancelada-en-validar-no-dice-que-falta", cuenta(t, /no validó/g) === 2 && !/falta|en curso|aquí ahora/.test(t) && /Cancelada/.test(t), `panel: «${t.slice(0, 260)}»`);
});
await caso("tie-48-firmada-por-el-sistema", conEventos("H-3609", {}, [
  ["2026-11-02 10:00:00", "in_production", "system", "⏯️ Auto-activada (cola promoción)"],
]), async p => {
  const t = await texto(p);
  ok("tie-48-firmada-por-el-sistema", /la pasó Sistema/.test(t) && !/system/.test(t), `panel: «${t.slice(0, 240)}»`);
});
// v10.84.176 — lo encontró la vuelta 3 sobre la bitácora: P-0059, una maquila que nació como `draft`: las maquilas no se validan, y el panel decía «validó · la bitácora no guardó la hora»
await caso("tie-49-la-maquila-no-se-valida", orden("P-0059", { stage: "maq_delivered", order_type: "maquila", created_at: H("2026-11-02 09:30:00"), delivered_at: H("2026-11-02 12:00:00") }, [
  ["2026-11-02 09:30:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-11-02 10:00:00", "maq_sent", "secretaria", "📋 Creada → 🚚 Enviada"],
  ["2026-11-02 12:00:00", null, "karla", "✅ Entregada (Maquila)"],
]), async p => {
  const t = await texto(p);
  ok("tie-49-la-maquila-no-se-valida", !/Noemí|Gerardo|validó|falta validar/.test(t) && /Enviada a Maquila/.test(t), `panel: «${t.slice(0, 240)}»`);
});
await caso("tie-35-la-que-paso-sin-validar-lo-dice", conEventos("P-0750", { stage: "design" }, [
  ["2026-11-02 10:00:00", "design", "admin", "📝 Validar → 🎨 Diseño"],
]), async p => {
  const t = await texto(p);
  ok("tie-35-la-que-paso-sin-validar-lo-dice", cuenta(t, /no validó · la pasó Dirección/g) === 2 && !/falta/.test(t), `panel: «${t.slice(0, 260)}»`);
});
await caso("tie-36-la-auto-sin-etapa-no-se-queda-en-validar", conEventos("P-0430", { stage: "ctp" }, [
  ["2026-11-02 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 11:00:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-11-02 11:05:00", null, "karla", "📝 → 🎨 Ambos validaron → Diseño (auto)"],
  ["2026-11-02 12:05:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
]), async p => {
  const t = await texto(p);
  ok("tie-36-la-auto-sin-etapa-no-se-queda-en-validar", /Diseño · Noemí\D{0,6}1h/.test(t) && /Validar\s*1h 35m/.test(t), `panel: «${t.slice(0, 300)}»`);
});
await caso("tie-37-la-maquila-de-un-vendedor-la-responde-el", orden("P-0751", { stage: "maq_sent", order_type: "maquila", agent: "genaro", created_at: H("2026-11-02 09:30:00") }, [
  ["2026-11-02 09:30:00", "maq_created", "vendedor", "📋 Orden creada"],
  ["2026-11-02 09:40:00", "maq_sent", "vendedor", "📋 Creada (Maquila) → 🚚 Enviada a Maquila"],
]), async p => {
  const t = await texto(p);
  ok("tie-37-la-maquila-de-un-vendedor-la-responde-el", /Enviada a Maquila · con el maquilador · la sigue Genaro/.test(t) && !/Lupita/.test(t.replace(/Capturada[^·]*· \S+/, "")), `panel: «${t.slice(0, 260)}»`);
});
await caso("tie-38-empaque-marcado-varias-veces-es-uno", conEventos("P-0288", { stage: "packaging" }, [
  ["2026-11-02 10:00:00", "in_production", "produccion", "🏭 Polar 78"],
  ["2026-11-02 11:00:00", "packaging", "produccion", "⚙️ Máquina → 📦 Empaque"],
  ["2026-11-02 11:00:07", "packaging", "produccion", "🏭 📦 Empaque"],
  ["2026-11-02 11:00:14", "packaging", "produccion", "🏭 📦 Empaque"],
]), async p => {
  const t = await texto(p);
  ok("tie-38-empaque-marcado-varias-veces-es-uno", cuenta(t, /Empaque/g) === 1 && !/En fila/.test(t), `panel: «${t.slice(0, 300)}»`);
});
await caso("tie-39-misma-maquina-otro-turno-es-un-paso", conEventos("P-0752", {}, [
  ["2026-11-02 10:00:00", "in_production", "produccion", "🏭 Printmaster 52 (turno 5)"],
  ["2026-11-02 11:00:00", "in_production", "produccion", "🏭 Printmaster 52 (turno 2)"],
]), async p => {
  const t = await texto(p);
  ok("tie-39-misma-maquina-otro-turno-es-un-paso", cuenta(t, /Printmaster 52/g) === 1 && !/En fila/.test(t), `panel: «${t.slice(0, 300)}»`);
});
// lo encontró el barrido de producción: hasta septiembre la bitácora dice «(cola #2)», con gato, y salía como parte del nombre de la máquina
await caso("tie-45-el-turno-viejo-tampoco-es-otra-maquina", conEventos("P-0756", {}, [
  ["2026-11-02 10:00:00", "in_production", "produccion", "🏭 Printmaster 52 (cola #2)"],
  ["2026-11-02 11:00:00", "in_production", "produccion", "🏭 Printmaster 52 (turno 1)"],
  ["2026-11-02 12:00:00", "in_production", "produccion", "🏭 Manual #1 (cola #3)"],
]), async p => {
  const t = await texto(p);
  ok("tie-45-el-turno-viejo-tampoco-es-otra-maquina", cuenta(t, /Printmaster 52/g) === 1 && /turno 2/.test(t) && /Manual #1\D{0,12}/.test(t) && /turno 3/.test(t) && !/cola/.test(t), `panel: «${t.slice(0, 300)}»`);
});
await caso("tie-40-volver-a-otra-maquina-si-es-otro-paso", conEventos("P-0753", {}, [
  ["2026-11-02 10:00:00", "in_production", "produccion", "🏭 Printmaster 52"],
  ["2026-11-02 11:00:00", "in_production", "produccion", "🏭 Polar 115"],
  ["2026-11-02 12:00:00", "in_production", "produccion", "🏭 Printmaster 52"],
]), async p => {
  const t = await texto(p);
  ok("tie-40-volver-a-otra-maquina-si-es-otro-paso", cuenta(t, /Printmaster 52/g) === 2 && /Polar 115/.test(t) && cuenta(await etapas(p), /Máquina/g) === 1, `panel: «${t.slice(0, 300)}»`);
});
await caso("tie-41-regresar-por-la-secuencia-tambien-se-marca", conEventos("P-0754", {}, [
  ["2026-11-02 10:00:00", "in_production", "produccion", "🏭 Polar 78"],
  ["2026-11-02 11:00:00", "packaging", "produccion", "⚙️ Máquina → 📦 Empaque"],
  ["2026-11-02 12:00:00", "in_production", "produccion", "🏭 Printmaster 52 (turno 2)"],
]), async p => {
  const t = await texto(p);
  ok("tie-41-regresar-por-la-secuencia-tambien-se-marca", /regresó 1 vez/.test(t) && /2\.ª vez/.test(t) && /Regresó/.test(t) && /sin razón escrita/.test(t) && /Printmaster 52/.test(t) && /turno 2/.test(t), `panel: «${t.slice(0, 340)}»`);
});
for (const [n, o] of [["completa", P0609()], ["en-validar", ENVALIDAR()], ["larga", LARGA()]]) {
  await caso("tie-42-se-lee-" + n, o, async p => {
    const m = await p.evaluate(() => {
      const parse = s => { const x = String(s).match(/rgba?\(([^)]+)\)/); if (!x) return null; const v = x[1].split(",").map(y => parseFloat(y)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
      const mezcla = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
      const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const fondo = el => { const capas = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) capas.push(c); } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = capas.length - 1; i >= 0; i--) base = mezcla(capas[i], base); return base; };
      const malos = [];
      for (const el of document.getElementById("caja").querySelectorAll("*")) {
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || !el.getClientRects().length) continue;
        const s = getComputedStyle(el), bg = fondo(el), f0 = parse(s.color); if (!f0) continue;
        const fg = f0.a < 1 ? mezcla(f0, bg) : f0, L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        if (cr < 4.5) malos.push(cr.toFixed(1) + ":1 «" + el.textContent.trim().slice(0, 30) + "»");
        if (parseFloat(s.fontSize) < 10) malos.push(s.fontSize + " «" + el.textContent.trim().slice(0, 30) + "»");
      }
      return malos;
    });
    ok("tie-42-se-lee-" + n, m.length === 0, m.slice(0, 4).join(" · ") || "todo con AA y de 10 px o más");
  });
}
await caso("tie-43-con-el-teclado", P0726(), async p => {
  const b = p.getByRole("button", { name: /Tiempo por etapa/ });
  const a0 = await b.getAttribute("aria-expanded");
  await b.focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(120);
  const a1 = await b.getAttribute("aria-expanded"), t1 = await texto(p);
  await p.keyboard.press("Space"); await p.waitForTimeout(120);
  const a2 = await b.getAttribute("aria-expanded"), t2 = await texto(p);
  ok("tie-43-con-el-teclado", a0 === "false" && a1 === "true" && a2 === "false" && /Los tiempos sólo cuentan/.test(t1) && !/Los tiempos sólo cuentan/.test(t2), `aria-expanded: ${a0} → ${a1} → ${a2}`);
}, { abrir: false });
await caso("tie-44-a-futuro-no-da-negativo", conEventos("P-0755", { stage: "design", created_at: H("2026-11-20 09:30:00") }, [
  ["2026-11-20 10:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
]), async p => {
  const t = await texto(p);
  ok("tie-44-a-futuro-no-da-negativo", /en curso · <1m/.test(t) && !/NaN/.test(t), `panel: «${t.slice(0, 240)}»`);
});

await browser.close();

// ── la cuenta, sin pantalla (con la hora de México) ──
process.env.TZ = "America/Mexico_City";
const { horasDeJornada, duracion, HORAS_DE_UN_DIA, HORARIO_EN_PALABRAS, tiempoPorEtapa } = await import("../../src/lib/tiempoPorEtapa.js");
const cuenta2 = (n, a, b, esperado, pausas) => { const h = horasDeJornada(H(a), H(b), pausas); ok(n, Math.abs(h - esperado) < 1e-6, `${a} a ${b}: ${h} h (debía ${esperado})`); };
if (!process.env.SOLO || new RegExp(process.env.SOLO).test("tie-50")) {
  cuenta2("tie-50-un-dia-entero", "2026-11-02 00:00:00", "2026-11-03 00:00:00", 9);
  cuenta2("tie-51-el-fin-de-semana-no-cuenta", "2026-10-31 00:00:00", "2026-11-02 00:00:00", 0);
  cuenta2("tie-52-de-viernes-a-lunes", "2026-10-30 18:30:00", "2026-11-02 09:30:00", 1);
  // los festivos de ley (LFT art. 74): 16-sep, tercer lunes de noviembre, 25-dic, 1-ene, primer lunes de febrero, tercer lunes de marzo, 1-may. Un lunes cualquiera, sí cuenta (2-nov hubo 81 movimientos)
  for (const [n, dia] of [["16-sep", "2026-09-16"], ["tercer-lunes-nov", "2026-11-16"], ["25-dic", "2026-12-25"], ["1-ene", "2027-01-01"], ["primer-lunes-feb", "2027-02-01"], ["tercer-lunes-mar", "2027-03-15"], ["1-may", "2026-05-01"]]) cuenta2("tie-111-festivo-" + n, dia + " 00:00:00", dia + " 23:59:00", 0);
  cuenta2("tie-112-el-lunes-anterior-si-cuenta", "2026-11-09 00:00:00", "2026-11-10 00:00:00", 9);
  cuenta2("tie-113-el-2-de-noviembre-si-cuenta", "2026-11-02 00:00:00", "2026-11-03 00:00:00", 9);
  ok("tie-63-el-horario-en-palabras-sale-de-la-cuenta", HORARIO_EN_PALABRAS === "de 9 a 2 y de 3 a 7" && HORAS_DE_UN_DIA === 9, `«${HORARIO_EN_PALABRAS}», ${HORAS_DE_UN_DIA} h`);
  cuenta2("tie-53-la-comida-no-cuenta", "2026-11-02 14:10:00", "2026-11-02 14:50:00", 0);
  cuenta2("tie-54-de-antes-de-la-comida-a-despues", "2026-11-02 13:30:00", "2026-11-02 15:30:00", 1);
  cuenta2("tie-55-al-reves-es-cero", "2026-11-03 10:00:00", "2026-11-02 10:00:00", 0);
  cuenta2("tie-56-una-pausa-completa-la-quita", "2026-11-02 09:00:00", "2026-11-02 12:00:00", 2, [{ start: H("2026-11-02 10:00:00"), end: H("2026-11-02 11:00:00") }]);
  cuenta2("tie-57-una-pausa-mas-larga-que-el-tramo-da-cero", "2026-11-02 10:00:00", "2026-11-02 11:00:00", 0, [{ start: H("2026-10-01 10:00:00"), end: H("2026-12-01 11:00:00") }]);
  const t0 = performance.now(); const anio = horasDeJornada(H("2024-01-01 09:00:00"), H("2026-01-01 09:00:00")), ms = Math.round(performance.now() - t0);
  ok("tie-58-dos-anos-no-se-traba", anio > 4000 && anio < 5200 && ms < 200, `${Math.round(anio)} h en ${ms} ms`);
  const d = [[null, "—"], [0, "<1m"], [0.005, "<1m"], [0.5, "30m"], [59.6 / 60, "1h"], [2, "2h"], [2.34, "2h 20m"], [8.94, "8h 56m"], [9.5, "9h 30m"], [10, "10h"], [22.32, "22h"], [105.3, "105h"], [1284, "1,284h"]];
  const malas = d.filter(([h, s]) => duracion(h) !== s).map(([h, s]) => `${h} → ${duracion(h)} (debía ${s})`);
  ok("tie-59-como-se-dice-cada-duracion", malas.length === 0, malas.join(" · ") || "todas");
  const sinOrden = tiempoPorEtapa(null, { ahora: H("2026-11-04 16:00:00") });
  ok("tie-60-sin-orden-no-truena", sinOrden.bloques.length === 0 && sinOrden.regs === 0, JSON.stringify(sinOrden));
}
for (const r of res) console.log(r);
