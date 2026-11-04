// Tratar de ROMPER «Tiempo por etapa» (`StageFlowHistory`): Marcelo, 4-nov: «la etapa de validación tiene 2, Noemí y Gerardo, veo que tardan horas en aprobarla,
// pero no sé quién tardó» y «en algunas órdenes se repite el proceso varias veces, diseño o CTP aparece varias veces, eso no lo entiendo». Cada caso afirma lo que
// DEBERÍA leer Dirección en el panel: una FALLA es un bug. Las bitácoras son las de producción, copiadas tal cual (P-0726, P-0721, P-0712, P-0527, P-0609, P-0563,
// P-0669, P-0702). Vuelta 1: escritas antes del arreglo, sólo con lo que se lee en pantalla. Reloj fijo: miércoles 4-nov-2026 a las 16:00, hora de México.
// Las cuentas de cada caso se hicieron a mano con la jornada medida de la bitácora de 120 días: lunes a viernes, 9:00 a 14:00 y 15:00 a 19:30.
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

async function caso(nombre, o, fn, { viewport = { width: 1366, height: 768 }, ancho = 552, abrir = true } = {}) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const ctx = await browser.newContext({ viewport, timezoneId: "America/Mexico_City", locale: "es-MX" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !deFuera(m)) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.clock.setFixedTime(AHORA);
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

// ════════════════════════ Validar: quién tardó, Noemí o Gerardo ════════════════════════
await caso("tie-01-validar-dice-quien-tardo", P0726(), async p => {
  const t = await texto(p);
  // P-0726, lunes: se capturó a las 11:30:42; Noemí validó a las 12:47:29 (1 h 17 m) y Gerardo a las 13:49:15 (2 h 19 m): cada quien desde que entró a Validar
  ok("tie-01-validar-dice-quien-tardo", /Noemí\D{0,12}1\.3h/.test(t) && /Gerardo\D{0,12}2\.3h/.test(t), `panel: «${t.slice(0, 200)}»`);
});
await caso("tie-02-la-noche-no-cuenta", P0721(), async p => {
  const t = await texto(p);
  // P-0721: capturada el jueves a las 18:40. Noemí validó a las 18:54 (14 m). Gerardo al día siguiente a las 15:08: de reloj son 20 h 28 m, de jornada 49 m + 5 h + 8.6 m = 6 h
  ok("tie-02-la-noche-no-cuenta", /Noemí\D{0,12}14m/.test(t) && /Gerardo\D{0,12}6\.0h/.test(t) && !/\b2[01]h\b/.test(t), `panel: «${t.slice(0, 200)}»`);
});
await caso("tie-03-el-que-falta-se-dice", ENVALIDAR(), async p => {
  const t = await texto(p);
  // Noemí a los 15 m; Gerardo no ha validado y la orden lleva de 9:30 a 16:00 menos la comida: 5.5 h
  ok("tie-03-el-que-falta-se-dice", /Noemí\D{0,12}15m/.test(t) && /Gerardo\D{0,12}5\.5h/.test(t) && /Gerardo[^·]{0,30}falta/i.test(t), `panel: «${t}»`);
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
  // la orden pasó una vez por CTP: 1 h 20 m en fila (de 19:04 a 19:30 y de 9:00 a 9:53) y los dos pasos que Germán marcó de golpe. Antes salían tres renglones «CTP» sin decir qué era cada uno
  ok("tie-06-ctp-es-una-etapa-con-sus-pasos", /En fila\D{0,12}1\.3h/.test(t) && /Procesadora/.test(t) && cuenta(t, /\bCTP\b/g) <= 2, `«CTP» sale ${cuenta(t, /\bCTP\b/g)} veces; panel: «${t.slice(0, 420)}»`);
});
await caso("tie-07-maquina-dice-cual", P0527(), async p => {
  const t = await texto(p);
  // de lunes 16:07 a jueves 10:26 en la Printmaster 52: 2 días 5 h de jornada; luego la Polar 115, 8.7 h. Una sola etapa «Máquina»: 3 días 4 h
  ok("tie-07-maquina-dice-cual", cuenta(t, /Máquina/g) === 1 && /Printmaster 52\D{0,12}2d 5h/.test(t) && /Polar 115\D{0,12}8\.7h/.test(t) && /3d 4h/.test(t), `«Máquina» sale ${cuenta(t, /Máquina/g)} veces; panel: «${t.slice(0, 420)}»`);
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
  ok("tie-10-regreso-dice-por-que", /cambio de medida/.test(t) && /2\.ª vez/.test(t) && /1 regresión/.test(t), `panel: «${t.slice(0, 420)}»`);
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
  // entregada el 29-oct: Salidas se cierra ahí (sin la pausa: 2 días 4 h) y no sigue «en curso»
  ok("tie-13-entregada-no-sigue-en-salidas", !/en curso|aquí ahora/.test(t) && /Entregada/.test(t) && /Salidas[^]{0,30}2d 4h/.test(t), `panel: «${t.slice(-260)}»`);
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
  ok("tie-16-la-nota-dice-que-cuenta", /9:00/.test(t) && /19:30/.test(t) && !/Tiempo hábil/.test(t), `panel: «${t.slice(-200)}»`);
});

// ════════════════════════ Vuelta 2: por donde no se diseñó ════════════════════════
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
  ok("tie-26-cancelada-se-cierra", !/en curso|aquí ahora/.test(t) && /Empaque · Gerardo\D{0,6}2\.0h/.test(t) && /Cancelada/.test(t) && /Administrador · fin/.test(t), `panel: «${t.slice(0, 300)}»`);
});
await caso("tie-27-entregada-sin-su-fecha-usa-su-evento", conEventos("P-0744", { stage: "delivered" }, [
  ["2026-11-02 10:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
  ["2026-11-02 11:00:00", null, "karla", "✅ Entregada (folio F-1 ya asignado)"],
]), async p => {
  const t = await texto(p);
  ok("tie-27-entregada-sin-su-fecha-usa-su-evento", !/en curso|aquí ahora/.test(t) && /Salidas · Karla\D{0,6}1\.0h/.test(t) && /Karla · fin/.test(t), `panel: «${t.slice(0, 300)}»`);
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
  ok("tie-30-gerardo-valida-con-el-panel-abierto", /falta/.test(antes) && !/falta/.test(t) && /Gerardo\D{0,12}5\.0h/.test(t) && /Diseño · Noemí\s*en curso · 30m/.test(t), `panel: «${t.slice(0, 300)}»`);
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
  ok("tie-32-la-pausa-en-validar-no-cuenta-para-nadie", /Noemí\D{0,12}1\.0h/.test(t) && /Gerardo\D{0,12}1\.5h/.test(t), `panel: «${t.slice(0, 240)}»`);
});
await caso("tie-33-otra-firma-se-dice", conEventos("P-0749", { stage: "design" }, [
  ["2026-11-02 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 11:00:00", null, "admin", "✅ Validada por Producción"],
  ["2026-11-02 11:00:00", "design", "admin", "📝 → 🎨 Ambos validaron → Diseño"],
]), async p => {
  const t = await texto(p);
  ok("tie-33-otra-firma-se-dice", /Gerardo\D{0,12}1\.5h validó [^·]*· por Administrador/.test(t) && !/Noemí[^·]*por /.test(t), `panel: «${t.slice(0, 240)}»`);
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
await caso("tie-35-la-que-paso-sin-validar-lo-dice", conEventos("P-0750", { stage: "design" }, [
  ["2026-11-02 10:00:00", "design", "admin", "📝 Validar → 🎨 Diseño"],
]), async p => {
  const t = await texto(p);
  ok("tie-35-la-que-paso-sin-validar-lo-dice", cuenta(t, /no validó · la pasó Administrador/g) === 2 && !/falta/.test(t), `panel: «${t.slice(0, 260)}»`);
});
await caso("tie-36-la-auto-sin-etapa-no-se-queda-en-validar", conEventos("P-0430", { stage: "ctp" }, [
  ["2026-11-02 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-11-02 11:00:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-11-02 11:05:00", null, "karla", "📝 → 🎨 Ambos validaron → Diseño (auto)"],
  ["2026-11-02 12:05:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
]), async p => {
  const t = await texto(p);
  ok("tie-36-la-auto-sin-etapa-no-se-queda-en-validar", /Diseño · Noemí\D{0,6}1\.0h/.test(t) && /Validar\s*1\.6h/.test(t), `panel: «${t.slice(0, 300)}»`);
});
await caso("tie-37-la-maquila-de-un-vendedor-la-responde-el", orden("P-0751", { stage: "maq_sent", order_type: "maquila", agent: "genaro", created_at: H("2026-11-02 09:30:00") }, [
  ["2026-11-02 09:30:00", "maq_created", "vendedor", "📋 Orden creada"],
  ["2026-11-02 09:40:00", "maq_sent", "vendedor", "📋 Creada (Maquila) → 🚚 Enviada a Maquila"],
]), async p => {
  const t = await texto(p);
  ok("tie-37-la-maquila-de-un-vendedor-la-responde-el", /Enviada a Maquila · Genaro/.test(t) && !/Lupita/.test(t.replace(/Capturada[^·]*· \S+/, "")), `panel: «${t.slice(0, 260)}»`);
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
  ok("tie-40-volver-a-otra-maquina-si-es-otro-paso", cuenta(t, /Printmaster 52/g) === 2 && /Polar 115/.test(t) && cuenta(t, /Máquina/g) === 1, `panel: «${t.slice(0, 300)}»`);
});
await caso("tie-41-regresar-por-la-secuencia-tambien-se-marca", conEventos("P-0754", {}, [
  ["2026-11-02 10:00:00", "in_production", "produccion", "🏭 Polar 78"],
  ["2026-11-02 11:00:00", "packaging", "produccion", "⚙️ Máquina → 📦 Empaque"],
  ["2026-11-02 12:00:00", "in_production", "produccion", "🏭 Printmaster 52 (turno 2)"],
]), async p => {
  const t = await texto(p);
  ok("tie-41-regresar-por-la-secuencia-tambien-se-marca", /1 regresión/.test(t) && /2\.ª vez/.test(t) && /Regresó/.test(t) && /Printmaster 52/.test(t) && /turno 2/.test(t), `panel: «${t.slice(0, 340)}»`);
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
  ok("tie-43-con-el-teclado", a0 === "false" && a1 === "true" && a2 === "false" && /Noemí/.test(t1) && !/Noemí/.test(t2), `aria-expanded: ${a0} → ${a1} → ${a2}`);
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
const { horasDeJornada, duracion, HORAS_DE_UN_DIA, tiempoPorEtapa } = await import("../../src/lib/tiempoPorEtapa.js");
const cuenta2 = (n, a, b, esperado, pausas) => { const h = horasDeJornada(H(a), H(b), pausas); ok(n, Math.abs(h - esperado) < 1e-6, `${a} a ${b}: ${h} h (debía ${esperado})`); };
if (!process.env.SOLO || new RegExp(process.env.SOLO).test("tie-50")) {
  cuenta2("tie-50-un-dia-entero", "2026-11-02 00:00:00", "2026-11-03 00:00:00", 9.5);
  cuenta2("tie-51-el-fin-de-semana-no-cuenta", "2026-10-31 00:00:00", "2026-11-02 00:00:00", 0);
  cuenta2("tie-52-de-viernes-a-lunes", "2026-10-30 19:00:00", "2026-11-02 09:30:00", 1);
  cuenta2("tie-53-la-comida-no-cuenta", "2026-11-02 14:10:00", "2026-11-02 14:50:00", 0);
  cuenta2("tie-54-de-antes-de-la-comida-a-despues", "2026-11-02 13:30:00", "2026-11-02 15:30:00", 1);
  cuenta2("tie-55-al-reves-es-cero", "2026-11-03 10:00:00", "2026-11-02 10:00:00", 0);
  cuenta2("tie-56-una-pausa-completa-la-quita", "2026-11-02 09:00:00", "2026-11-02 12:00:00", 2, [{ start: H("2026-11-02 10:00:00"), end: H("2026-11-02 11:00:00") }]);
  cuenta2("tie-57-una-pausa-mas-larga-que-el-tramo-da-cero", "2026-11-02 10:00:00", "2026-11-02 11:00:00", 0, [{ start: H("2026-10-01 10:00:00"), end: H("2026-12-01 11:00:00") }]);
  const t0 = performance.now(); const anio = horasDeJornada(H("2024-01-01 09:00:00"), H("2026-01-01 09:00:00")), ms = Math.round(performance.now() - t0);
  ok("tie-58-dos-anos-no-se-traba", anio > 4000 && anio < 5200 && ms < 200, `${Math.round(anio)} h en ${ms} ms`);
  const d = [[null, "—"], [0, "<1m"], [0.005, "<1m"], [0.5, "30m"], [59.6 / 60, "1.0h"], [2.34, "2.3h"], [9.49, "9.5h"], [HORAS_DE_UN_DIA, "1d"], [18.99, "1d 9h"], [19, "2d"], [23.82, "2d 5h"], [1284 * 9.5, "1284d"]];
  const malas = d.filter(([h, s]) => duracion(h) !== s).map(([h, s]) => `${h} → ${duracion(h)} (debía ${s})`);
  ok("tie-59-como-se-dice-cada-duracion", malas.length === 0, malas.join(" · ") || "todas");
  const sinOrden = tiempoPorEtapa(null, { ahora: H("2026-11-04 16:00:00") });
  ok("tie-60-sin-orden-no-truena", sinOrden.bloques.length === 0 && sinOrden.regs === 0, JSON.stringify(sinOrden));
}
for (const r of res) console.log(r);
