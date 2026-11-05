// Tratar de ROMPER «Tiempos» de Analytics (`TiemposPorPersona` y `tiempoPorPersona`). Marcelo, 4-nov: «eso sirve para ver cuánto tiempo se tardó cada responsable, la etapa de validación tiene 2, Noemí y
// Gerardo, veo que tardan horas en aprobarla, pero no sé quién tardó»; 5-nov, a la tabla: «te doy el sí». Cada caso afirma lo que DEBERÍA leer Dirección: una FALLA es un bug. Vuelta 1: escritas antes
// del código. Banco: gen-analytics.mjs (la pantalla entera, con su periodo); las órdenes las pone cada caso en `window.__ordenes`. Reloj fijo: martes 13-oct-2026 a las 12:00, hora de México.
// Las cuentas se hicieron a mano con el horario de Marcelo (lunes a viernes, de 9 a 2 y de 3 a 7, sin festivos de ley ni pausas) y `LO_NORMAL` (Validar 5 h, CTP 8 h, Placas Listas 2 h…).
// Uso: node personas.mjs <dir-capturas> [puerto=5494]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5494);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + String(x).replace(/\s+/g, " ").slice(0, 420) : ""));
const AHORA = new Date("2026-10-13T12:00:00-06:00");
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }

// ── las bitácoras: [hora de México, a qué etapa, quién, qué dice], como las guarda order_timeline ──
const H = s => s.replace(" ", "T") + "-06:00";
const TL = filas => filas.map(([f, to, by, action]) => ({ date: H(f), ...(to ? { to } : {}), by, action, color: "#8e8e93" }));
const orden = (pn, extra, filas) => ({ id: "OP-" + pn, production_number: pn, order_type: "interna", client: "CLIENTE " + pn, product_type: "Etiquetas", price: 1000, stage: "delivered", created_at: H(filas[0][0]), delivered_at: null, due_date: null, created_by: "secretaria", agent: "", categoria: null, machine_log: [], waste_log: [], comments: [], validated_by_production: true, validated_by_preprensa: true, timeline: TL(filas), ...extra });
const DIAS = ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12"];
// capturada a las 9:00 de `dia`; Noemí y Gerardo validan a los minutos dados (hasta 300: la mañana entera); pasa a Diseño y se queda ahí
const hora = (dia, m) => `${dia} ${String(9 + Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
const validada = (pn, dia, mNoemi, mGerardo, extra = {}) => orden(pn, { stage: "design", ...extra }, [
  [hora(dia, 0), "draft", "secretaria", "📋 Orden creada"],
  [hora(dia, mNoemi), null, "preprensa", "✅ Validada por Pre-prensa"],
  [hora(dia, mGerardo), null, "produccion", "✅ Validada por Producción"],
  [hora(dia, Math.max(mNoemi, mGerardo)), "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
]);
const CINCO = () => [[60, 10], [120, 10], [180, 20], [240, 30], [300, 40]].map(([n, g], i) => validada("P-010" + i, DIAS[i], n, g));
const DIEZ = () => Array.from({ length: 10 }, (_, i) => validada("P-02" + String(i).padStart(2, "0"), DIAS[i % DIAS.length], 30 * (i + 1), 5));
// una orden de punta a punta, para ver cada etapa: Noemí 1 h y Gerardo 30 m en Validar; Diseño 2 h; CTP 3 h; Placas Listas 3 h 30 m (lo normal, 2 h); Listas 1 h; Máquina 9 h; Empaque 1 h; Salidas 18 h 30 m
const DE_PUNTA_A_PUNTA = (pn = "P-0300", extra = {}) => orden(pn, { stage: "delivered", delivered_at: H("2026-10-09 12:00:00"), ...extra }, [
  ["2026-10-05 09:00:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-10-05 09:30:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-10-05 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-05 10:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-10-05 12:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
  ["2026-10-05 16:00:00", "placas_listas", "german", "💿 CTP → 📋 Placas Listas"],
  ["2026-10-06 09:30:00", "ready", "produccion", "📋 Placas Listas → ✅ Lista para imprimir"],
  ["2026-10-06 10:30:00", "in_production", "produccion", "🏭 Printmaster 52"],
  ["2026-10-07 10:30:00", "packaging", "produccion", "🏭 📦 Empaque"],
  ["2026-10-07 11:30:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"],
  ["2026-10-09 12:00:00", "delivered", "karla", "🎉 Entregada"],
]);
// entra derecho a una etapa: Diseño `m1` minutos y CTP `m2`, el mismo lunes 5-oct desde las 9:00; se queda en Placas Listas
const DISENO_Y_CTP = (pn, m1, m2) => orden(pn, { stage: "placas_listas" }, [
  ["2026-10-05 09:00:00", "design", "secretaria", "📋 Orden creada"],
  [hora("2026-10-05", m1), "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
  [hora("2026-10-05", m1 + m2), "placas_listas", "german", "💿 CTP → 📋 Placas Listas"],
]);

async function caso(nombre, ordenes, fn, { viewport = { width: 1366, height: 768 }, query = "", abrir = true } = {}) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const ctx = await browser.newContext({ viewport, timezoneId: "America/Mexico_City", locale: "es-MX" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !deFuera(m)) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.clock.setFixedTime(AHORA);
    await page.addInitScript(o => { window.__ordenes = o; }, ordenes);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.getByText("Financiero").first().waitFor({ timeout: 30000 });
    if (abrir) { await page.getByRole("tab", { name: "Tiempos" }).click({ timeout: 4000 }); await page.waitForTimeout(150); }
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png", fullPage: true }).catch(() => {});
  await ctx.close();
}
const limpio = s => String(s ?? "").replace(/\s+/g, " ").trim();
const FILA = (q, e) => `[data-tiempos] tr[data-quien="${q}"][data-etapa="${e}"]`;
const hayFila = (p, q, e) => p.locator(FILA(q, e)).count();
const celda = async (p, q, e, c) => { const l = p.locator(`${FILA(q, e)} [data-c="${c}"]`); return (await l.count()) ? limpio(await l.first().innerText()) : null; };
const fila = async (p, q, e) => { const r = {}; for (const c of ["veces", "depaso", "mediana", "p90", "normal", "pasaron", "parte"]) r[c] = await celda(p, q, e, c); return r; };
const veredicto = async p => { const l = p.locator("[data-veredicto-tiempos]"); return (await l.count()) ? limpio(await l.first().innerText()) : null; };
const nota = async p => { const l = p.locator("[data-tiempos-nota]"); return (await l.count()) ? limpio(await l.first().innerText()) : ""; };
const regla = async p => { const l = p.locator("[data-tiempos-regla]"); return (await l.count()) ? limpio(await l.first().innerText()) : ""; };
const periodo = async (p, nombre) => { await p.getByRole("radio", { name: nombre, exact: true }).click(); await p.waitForTimeout(150); };
const grupos = p => p.locator("[data-tiempos] tbody[data-grupo]").evaluateAll(g => g.map(x => x.getAttribute("data-grupo")));
const abrirFila = async (p, q, e) => { await p.locator(`${FILA(q, e)} button`).first().click(); await p.waitForTimeout(120); };
const log = async p => (await p.locator("#log").textContent().catch(() => "")) || "";

// ── lo que Marcelo preguntó ──
await caso("per-01-la-pestana-esta-y-abre", [DE_PUNTA_A_PUNTA()], async p => {
  const marcada = await p.getByRole("tab", { name: "Tiempos" }).getAttribute("aria-selected");
  const tabla = await p.locator("[data-tiempos] table").count();
  ok("per-01-la-pestana-esta-y-abre", marcada === "true" && tabla === 1, `marcada ${marcada}, tablas ${tabla}`);
});
await caso("per-02-validar-dice-quien-tardo", CINCO(), async p => {
  const n = await fila(p, "Noemí", "draft"), g = await fila(p, "Gerardo", "draft"), v = await veredicto(p);
  ok("per-02-noemi", n.veces === "5" && n.mediana === "3h" && n.normal === "5h" && /^1\b/.test(n.pasaron || "") && n.parte === "89%", JSON.stringify(n));
  ok("per-02-gerardo", g.veces === "5" && g.mediana === "20m" && /^0\b/.test(g.pasaron || "") && g.parte === "11%", JSON.stringify(g));
  ok("per-02-la-respuesta-primero", /En Validar, Noemí tarda más que Gerardo: mediana 3h contra 20m/.test(v || ""), `«${v}»`);
});
await caso("per-03-nueve-de-cada-diez", DIEZ(), async p => {
  const n = await fila(p, "Noemí", "draft");
  // 30, 60 … 300 minutos: la mediana entre 150 y 180; nueve de diez, hasta 270. El de 300 es justo lo normal (5 h): se pasó, como en el panel
  ok("per-03-nueve-de-cada-diez", n.veces === "10" && n.mediana === "2h 45m" && n.p90 === "4h 30m" && /^1\b/.test(n.pasaron || ""), JSON.stringify(n));
});
await caso("per-04-con-pocas-no-inventa-nueve-de-diez", CINCO(), async p => {
  const n = await fila(p, "Noemí", "draft"), t = await nota(p);
  ok("per-04-con-pocas-no-inventa-nueve-de-diez", n.p90 === "—" && /menos de 10/.test(t), `${JSON.stringify(n)} «${t}»`);
});

// ── el horario: lo mismo que el panel ──
await caso("per-05-noches-comida-y-fin-de-semana-no-cuentan", [
  orden("P-0401", { stage: "design" }, [["2026-10-05 13:30:00", "draft", "secretaria", "📋 Orden creada"], ["2026-10-05 15:30:00", null, "preprensa", "✅ Validada por Pre-prensa"], ["2026-10-05 15:30:00", null, "produccion", "✅ Validada por Producción"], ["2026-10-05 15:30:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"]]),
  orden("P-0402", { stage: "design" }, [["2026-10-09 18:30:00", "draft", "secretaria", "📋 Orden creada"], ["2026-10-12 09:30:00", null, "preprensa", "✅ Validada por Pre-prensa"], ["2026-10-12 09:30:00", null, "produccion", "✅ Validada por Producción"], ["2026-10-12 09:30:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"]]),
], async p => {
  const n = await fila(p, "Noemí", "draft");
  ok("per-05-noches-comida-y-fin-de-semana-no-cuentan", n.veces === "2" && n.mediana === "1h", JSON.stringify(n));
});
await caso("per-06-el-festivo-no-cuenta", [
  orden("P-0403", { stage: "design" }, [["2026-09-15 18:00:00", "draft", "secretaria", "📋 Orden creada"], ["2026-09-17 09:30:00", null, "preprensa", "✅ Validada por Pre-prensa"], ["2026-09-17 09:30:00", null, "produccion", "✅ Validada por Producción"], ["2026-09-17 09:30:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"]]),
], async p => {
  await periodo(p, "Mes pasado");
  const n = await fila(p, "Noemí", "draft");   // martes 18:00-19:00, el 16 no cuenta, jueves 9:00-9:30
  ok("per-06-el-festivo-no-cuenta", n.veces === "1" && n.mediana === "1h 30m", JSON.stringify(n));
});
await caso("per-07-cada-etapa-con-su-responsable", [DE_PUNTA_A_PUNTA()], async p => {
  const f = {}; for (const [q, e, m] of [["Noemí", "draft", "1h"], ["Gerardo", "draft", "30m"], ["Noemí", "design", "2h"], ["Germán", "ctp", "3h"], ["Gerardo", "placas_listas", "3h 30m"], ["Gerardo", "ready", "1h"], ["Máquina", "in_production", "9h"], ["Gerardo", "packaging", "1h"], ["Karla", "salidas", "19h"]]) { const v = await celda(p, q, e, "mediana"); f[q + " " + e] = v === m ? "ok" : `${v} (debía ${m})`; }
  ok("per-07-cada-etapa-con-su-responsable", Object.values(f).every(x => x === "ok"), JSON.stringify(f));
  ok("per-07-lo-que-se-paso", /^1\b/.test(await celda(p, "Gerardo", "placas_listas", "pasaron") || "") && /^0\b/.test(await celda(p, "Germán", "ctp", "pasaron") || ""), "Placas Listas 3h 30m contra 2h: se pasó; CTP 3h contra 8h, no");
});
await caso("per-08-maquina-no-es-de-una-persona", [DE_PUNTA_A_PUNTA()], async p => {
  const deGerardo = await hayFila(p, "Gerardo", "in_production"), grupo = limpio(await p.locator('[data-tiempos] tbody[data-grupo="Máquina"] th[scope="rowgroup"]').first().innerText());
  const orden_ = await grupos(p);
  ok("per-08-maquina-no-es-de-una-persona", deGerardo === 0 && /la sigue Gerardo/.test(grupo) && orden_[orden_.length - 1] === "Máquina", `en Gerardo ${deGerardo}; «${grupo}»; ${orden_.join(", ")}`);
});
await caso("per-09-lo-que-espera-al-cliente-no-acusa", [
  orden("P-0501", { stage: "delivered", delivered_at: H("2026-10-06 09:00:00") }, [["2026-10-05 09:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"], ["2026-10-06 09:00:00", "delivered", "karla", "🎉 Entregada"]]),
  orden("P-0502", { stage: "delivered", delivered_at: H("2026-10-09 09:00:00") }, [["2026-10-05 09:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"], ["2026-10-05 10:00:00", null, "karla", "🧾 En espera: el cliente no ha pedido factura"], ["2026-10-09 09:00:00", "delivered", "karla", "🎉 Entregada"]]),
], async p => {
  const k = await fila(p, "Karla", "salidas"), t = await nota(p);
  ok("per-09-lo-que-espera-al-cliente-no-acusa", k.veces === "1" && k.mediana === "9h" && /al cliente \(1\)/.test(t), `${JSON.stringify(k)} «${t}»`);
});
await caso("per-10-el-maquilador-no-se-le-cuenta-a-nadie", [
  orden("P-0503", { stage: "maq_delivered", order_type: "maquila", maq_provider: "MAKILA", delivered_at: H("2026-10-12 09:00:00") }, [
    ["2026-10-05 09:00:00", "maq_created", "secretaria", "📋 Orden creada"],
    ["2026-10-05 10:00:00", "maq_sent", "secretaria", "🚚 Enviada a maquila"],
    ["2026-10-08 10:00:00", "maq_received", "karla", "📥 Recibida de maquila"],
    ["2026-10-12 09:00:00", "maq_delivered", "karla", "🎉 Entregada"],
  ]),
], async p => {
  const l = await fila(p, "Lupita", "maq_created"), k = await fila(p, "Karla", "maq_received"), todas = await p.locator('[data-tiempos] tr[data-etapa="maq_sent"]').count(), t = await nota(p);
  ok("per-10-el-maquilador-no-se-le-cuenta-a-nadie", l.mediana === "1h" && k.veces === "1" && todas === 0 && /al maquilador \(1\)/.test(t), `${JSON.stringify(l)} ${JSON.stringify(k)} renglones del maquilador ${todas}; «${t}»`);
});
await caso("per-11-la-maquila-de-un-vendedor-con-usuario", [
  orden("P-0504", { stage: "maq_received", order_type: "maquila", agent: "genaro", maq_provider: "MAKILA" }, [["2026-10-05 09:00:00", "maq_created", "vendedor", "📋 Orden creada"], ["2026-10-05 10:00:00", "maq_sent", "vendedor", "🚚 Enviada a maquila"], ["2026-10-08 10:00:00", "maq_received", "karla", "📥 Recibida de maquila"]]),
], async p => {
  const g = await celda(p, "Genaro", "maq_created", "mediana"), l = await hayFila(p, "Lupita", "maq_created");
  ok("per-11-la-maquila-de-un-vendedor-con-usuario", g === "1h" && l === 0, `Genaro ${g}; en Lupita ${l}`);
});

// ── qué entra en cada periodo ──
const SEPT_OCT = () => [orden("P-0601", { stage: "ctp" }, [
  ["2026-09-28 09:00:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-09-28 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-09-28 10:00:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-09-28 10:00:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-10-01 09:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
])];
await caso("per-12-cuenta-cuando-salio-no-cuando-entro", SEPT_OCT(), async p => {
  const oct = { d: await celda(p, "Noemí", "design", "mediana"), v: await hayFila(p, "Noemí", "draft"), r: limpio(await p.locator("[data-rango]").first().innerText()) };
  await periodo(p, "Mes pasado");
  const sep = { d: await hayFila(p, "Noemí", "design"), v: await celda(p, "Noemí", "draft", "mediana"), r: limpio(await p.locator("[data-rango]").first().innerText()) };
  // Diseño del lunes 28 a las 10:00 al jueves 1 a las 9:00: 8 + 9 + 9 = 26 h; salió en octubre. Validar, 1 h, en septiembre
  ok("per-12-cuenta-cuando-salio-no-cuando-entro", oct.d === "26h" && oct.v === 0 && oct.r === "1-13 oct" && sep.d === 0 && sep.v === "1h" && sep.r === "1-30 sep", JSON.stringify({ oct, sep }));
});
await caso("per-13-todo-dice-desde-cuando-hay-bitacora", SEPT_OCT(), async p => {
  await periodo(p, "Todo");
  const r = limpio(await p.locator("[data-rango]").first().innerText()), t = await nota(p);
  ok("per-13-todo-dice-desde-cuando-hay-bitacora", r === "desde 28 sep 2026" && /La bitácora empieza el 28 sep 2026/.test(t), `«${r}»; «${t}»`);
});
await caso("per-14-dice-que-cuenta-el-periodo", [DE_PUNTA_A_PUNTA()], async p => {
  const texto = limpio(await p.locator("body").innerText());
  ok("per-14-dice-que-cuenta-el-periodo", /Cuenta lo que salió de cada etapa en el periodo/.test(texto) && !/Ingreso es lo entregado en el periodo/.test(texto), texto.slice(0, 260));
  await p.getByRole("tab", { name: "Financiero" }).click(); await p.waitForTimeout(120);
  const fin = limpio(await p.locator("body").innerText());
  ok("per-14-las-otras-pestanas-igual", /Ingreso es lo entregado en el periodo/.test(fin) && !/Cuenta lo que salió de cada etapa/.test(fin), fin.slice(0, 200));
});

// ── lo que no ha terminado, y lo que no terminó ──
await caso("per-15-lo-que-sigue-ahi-no-cuenta", [
  orden("P-0701", { stage: "ctp" }, [["2026-10-05 09:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]]),
  orden("P-0702", { stage: "draft", validated_by_production: false }, [["2026-10-05 09:00:00", "draft", "secretaria", "📋 Orden creada"], ["2026-10-05 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"]]),
], async p => {
  const g = await hayFila(p, "Germán", "ctp"), n = await celda(p, "Noemí", "draft", "veces"), ge = await hayFila(p, "Gerardo", "draft"), t = await regla(p) + " " + await nota(p);
  // Noemí ya firmó: lo suyo terminó, aunque la orden siga en Validar. Gerardo no ha firmado, y Germán sigue con la suya
  ok("per-15-lo-que-sigue-ahi-no-cuenta", g === 0 && n === "1" && ge === 0 && /lo que sigue ahí, no/.test(t), `Germán ${g}; Noemí ${n}; Gerardo ${ge}; «${t}»`);
});
await caso("per-16-lo-cancelado-no-termino", [
  orden("P-0703", { stage: "cancelled", cancelled_at: H("2026-10-07 09:00:00") }, [
    ["2026-10-05 09:00:00", "design", "secretaria", "📋 Orden creada"],
    ["2026-10-05 11:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
    ["2026-10-07 09:00:00", null, "admin", "❌ Cancelada"],
  ]),
], async p => {
  const d = await celda(p, "Noemí", "design", "mediana"), g = await hayFila(p, "Germán", "ctp");
  ok("per-16-lo-cancelado-no-termino", d === "2h" && g === 0, `Diseño ${d} (salió antes de cancelar); CTP ${g} (la cancelaron ahí: no terminó)`);
});
await caso("per-17-lo-que-regreso-cuenta-cada-vez", [
  orden("P-0704", { stage: "placas_listas" }, [
    ["2026-10-05 09:00:00", "design", "secretaria", "📋 Orden creada"],
    ["2026-10-05 10:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
    ["2026-10-05 11:00:00", "design", "german", "↩️ CTP → 🎨 Diseño · Razón: placa rayada"],
    ["2026-10-05 13:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
    ["2026-10-05 16:00:00", "placas_listas", "german", "💿 CTP → 📋 Placas Listas"],
  ]),
], async p => {
  const d = await fila(p, "Noemí", "design"), g = await fila(p, "Germán", "ctp");
  ok("per-17-lo-que-regreso-cuenta-cada-vez", d.veces === "2" && d.mediana === "1h 30m" && g.veces === "2" && g.mediana === "1h 30m", `${JSON.stringify(d)} ${JSON.stringify(g)}`);   // Diseño 1 h y 2 h; CTP 1 h y 2 h (13:00-14:00 y 15:00-16:00)
});
await caso("per-18-de-paso-no-entra-en-la-mediana", [
  DISENO_Y_CTP("P-0801", 1, 60), DISENO_Y_CTP("P-0802", 1, 60), DISENO_Y_CTP("P-0803", 1, 60),
  DISENO_Y_CTP("P-0804", 120, 60), DISENO_Y_CTP("P-0805", 240, 60),
], async p => {
  const d = await fila(p, "Noemí", "design"), t = await nota(p), c = await fila(p, "Germán", "ctp");
  // 288 de 571 Diseños (50%) se marcan en menos de 5 minutos: «la mitad, en <1m» diría que Noemí diseña en un minuto
  ok("per-18-de-paso-no-entra-en-la-mediana", d.veces === "5" && d.depaso === "3" && d.mediana === "3h" && /De paso/.test(t) && c.depaso === "0", `${JSON.stringify(d)} ${JSON.stringify(c)} «${t.slice(0, 200)}»`);
});
await caso("per-18b-nueve-de-diez-con-todas", [1, 1, 1, 1, 1, 60, 120, 180, 240, 300].map((m, i) => DISENO_Y_CTP("P-082" + i, m, 60)), async p => {
  const d = await fila(p, "Noemí", "design");
  // diez veces: nueve de diez, hasta 240 m, contando las de paso, como «lo normal»; la mediana, sólo de las cinco que se quedaron. Sin las de paso, Diseño decía 59 h contra «lo normal» 29 h y era lo mismo
  ok("per-18b-nueve-de-diez-con-todas", d.veces === "10" && d.depaso === "5" && d.mediana === "3h" && d.p90 === "4h", JSON.stringify(d));
});
await caso("per-19-en-validar-no-hay-de-paso", CINCO().concat([validada("P-0806", DIAS[0], 1, 1)]), async p => {
  const g = await fila(p, "Gerardo", "draft");
  ok("per-19-en-validar-no-hay-de-paso", g.depaso === "—" && g.veces === "6", JSON.stringify(g));
});
await caso("per-20-todo-de-paso-no-inventa-mediana", [DISENO_Y_CTP("P-0807", 1, 60)], async p => {
  const d = await fila(p, "Noemí", "design");
  ok("per-20-todo-de-paso-no-inventa-mediana", d.veces === "1" && d.depaso === "1" && d.mediana === "—", JSON.stringify(d));
});
await caso("per-21-justo-en-lo-normal-se-paso", [
  orden("P-0808", { stage: "placas_listas" }, [["2026-10-05 09:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"], ["2026-10-05 17:59:00", "placas_listas", "german", "💿 CTP → 📋 Placas Listas"]]),
  orden("P-0809", { stage: "placas_listas" }, [["2026-10-05 09:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"], ["2026-10-05 18:00:00", "placas_listas", "german", "💿 CTP → 📋 Placas Listas"]]),
  orden("P-0810", { stage: "placas_listas" }, [["2026-10-05 09:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"], ["2026-10-06 17:00:00", "placas_listas", "german", "💿 CTP → 📋 Placas Listas"]]),
], async p => {
  const g = await fila(p, "Germán", "ctp");   // 7 h 59 m no; 8 h sí, como el panel (`nivelDeTiempo`); 16 h sí
  ok("per-21-justo-en-lo-normal-se-paso", g.veces === "3" && g.normal === "8h" && /^2\b/.test(g.pasaron || "") && /67\s?%/.test(g.pasaron || ""), JSON.stringify(g));
});
await caso("per-22-la-parte-del-tiempo-suma-cien", [DISENO_Y_CTP("P-0811", 60, 180)], async p => {
  const d = await fila(p, "Noemí", "design"), c = await fila(p, "Germán", "ctp"), v = await veredicto(p);
  ok("per-22-la-parte-del-tiempo-suma-cien", d.parte === "25%" && c.parte === "75%" && /CTP 75%.*Diseño 25%/.test(v || ""), `${d.parte} y ${c.parte}; «${v}»`);
});
await caso("per-23-grupos-del-que-mas-tiene-y-etapas-en-orden-del-flujo", [DE_PUNTA_A_PUNTA()], async p => {
  const g = await grupos(p), et = q => p.locator(`[data-tiempos] tbody[data-grupo="${q}"] tr[data-etapa]`).evaluateAll(f => f.map(x => x.getAttribute("data-etapa")));
  const eG = await et("Gerardo"), eN = await et("Noemí");
  // horas: Karla 18.5, Gerardo 0.5+3.5+1+1 = 6, Germán 3 y Noemí 1+2 = 3 (el empate, por nombre); Máquina al final
  ok("per-23-grupos-del-que-mas-tiene-y-etapas-en-orden-del-flujo", g.join() === "Karla,Gerardo,Germán,Noemí,Máquina" && eG.join() === "draft,placas_listas,ready,packaging" && eN.join() === "draft,design", `${g.join()} · ${eG.join()} · ${eN.join()}`);
});
await caso("per-69-en-orden-del-flujo-aunque-lleguen-al-reves", [
  orden("P-1101", { stage: "salidas" }, [["2026-10-05 09:00:00", "packaging", "produccion", "🏭 📦 Empaque"], ["2026-10-05 10:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"]]),
  validada("P-1102", DIAS[3], 60, 10),
], async p => {
  const e = await p.locator('[data-tiempos] tbody[data-grupo="Gerardo"] tr[data-etapa]').evaluateAll(f => f.map(x => x.getAttribute("data-etapa")));
  ok("per-69-en-orden-del-flujo-aunque-lleguen-al-reves", e.join() === "draft,packaging", e.join());
});

// ── la comparación de Validar ──
await caso("per-24-sin-los-dos-no-compara", [validada("P-0901", DIAS[0], 60, 10), validada("P-0902", DIAS[1], 90, 10)], async p => {
  const v = await veredicto(p);
  ok("per-24-sin-los-dos-no-compara", !/tarda más/.test(v || ""), `«${v}» (dos veces no alcanzan para decir que alguien tarda más)`);
});
await caso("per-25-casi-lo-mismo-se-dice", [[20, 18], [20, 18], [20, 18], [20, 18], [20, 18]].map(([n, g], i) => validada("P-091" + i, DIAS[i], n, g)), async p => {
  const v = await veredicto(p);
  ok("per-25-casi-lo-mismo-se-dice", /Noemí y Gerardo tardan casi lo mismo/.test(v || "") && !/tarda más/.test(v || ""), `«${v}»`);
});
await caso("per-26-al-reves-tambien", [[10, 60], [10, 120], [10, 180], [10, 240], [10, 300]].map(([n, g], i) => validada("P-092" + i, DIAS[i], n, g)), async p => {
  const v = await veredicto(p);
  ok("per-26-al-reves-tambien", /En Validar, Gerardo tarda más que Noemí: mediana 3h contra 10m/.test(v || ""), `«${v}»`);
});

// ── sin datos, y mientras lee ──
await caso("per-27-sin-nada-en-el-periodo-lo-dice", SEPT_OCT().slice(0, 0).concat([validada("P-0930", DIAS[0], 60, 10)]), async p => {
  await periodo(p, "Mes pasado");
  const v = limpio(await p.locator("[data-tiempos-vacio]").first().innerText()), t = await p.locator("[data-tiempos] table").count();
  ok("per-27-sin-nada-en-el-periodo-lo-dice", /Ninguna orden salió de una etapa en este periodo/.test(v) && t === 0, `«${v}»; tablas ${t}`);
});
await caso("per-28-sin-ordenes", [], async p => {
  await periodo(p, "Todo");
  const v = limpio(await p.locator("[data-tiempos-vacio]").first().innerText()), r = limpio(await p.locator("[data-rango]").first().innerText());
  ok("per-28-sin-ordenes", /Ninguna orden/.test(v) && !/undefined|NaN|null/.test(r + v), `«${v}» · «${r}»`);
});
await caso("per-29-la-orden-sin-bitacora-no-cuenta-ni-truena", [orden("P-0931", { stage: "delivered", timeline: [], delivered_at: H("2026-09-20 12:00:00"), created_at: H("2026-01-05 12:00:00") }, [["2026-01-05 12:00:00", "draft", "secretaria", "x"]]), DE_PUNTA_A_PUNTA()], async p => {
  await periodo(p, "Todo");
  const r = limpio(await p.locator("[data-rango]").first().innerText()), v = await celda(p, "Noemí", "draft", "veces");
  ok("per-29-la-orden-sin-bitacora-no-cuenta-ni-truena", v === "1" && r === "desde 5 oct 2026", `${v}; «${r}» (la bitácora empieza en octubre, aunque la orden sea de enero y se haya entregado en septiembre)`);
});
await caso("per-30-mientras-lee-no-dice-cifras", [DE_PUNTA_A_PUNTA()], async p => {
  const l = p.locator('[data-tiempos-leyendo]'), rol = await l.first().getAttribute("role"), txt = limpio(await l.first().innerText()), t1 = await p.locator("[data-tiempos] table").count(), vacio = await p.locator("[data-tiempos-vacio]").count();
  await p.evaluate(() => window.__terminarLectura()); await p.waitForTimeout(150);
  const t2 = await p.locator("[data-tiempos] table").count(), l2 = await l.count();
  ok("per-30-mientras-lee-no-dice-cifras", rol === "status" && /Leyendo la bitácora/.test(txt) && t1 === 0 && vacio === 0 && t2 === 1 && l2 === 0, JSON.stringify({ rol, txt, t1, vacio, t2, l2 }));
}, { query: "modo=leyendo" });

// ── de la tabla a la orden ──
await caso("per-31-el-renglon-abre-las-mas-lentas", DIEZ(), async p => {
  const b = p.locator(`${FILA("Noemí", "draft")} button`).first(), antes = await b.getAttribute("aria-expanded");
  await b.click(); await p.waitForTimeout(120);
  const despues = await b.getAttribute("aria-expanded"), lista = p.locator("[data-lentas] [data-lenta]"), n = await lista.count(), primera = limpio(await lista.first().innerText()), titulo = limpio(await p.locator("[data-lentas]").first().innerText());
  // las 10 de Noemí: la más lenta, P-0209, 5 h; se ven 8
  ok("per-31-el-renglon-abre-las-mas-lentas", antes === "false" && despues === "true" && n === 8 && /P-0209/.test(primera) && /CLIENTE P-0209/.test(primera) && /\b5h\b/.test(primera) && /Las 8 más lentas de 10/.test(titulo), `${antes}→${despues}, ${n} renglones; «${primera}»; «${titulo.slice(0, 60)}»`);
  await lista.first().click(); await p.waitForTimeout(120);
  ok("per-31-y-abre-la-orden", /abrir: OP-P-0209/.test(await log(p)), await log(p));
});
await caso("per-32-doble-clic-en-el-renglon-no-lo-cierra", DIEZ(), async p => {
  const b = p.locator(`${FILA("Noemí", "draft")} button`).first();
  await b.dblclick(); await p.waitForTimeout(150);
  ok("per-32-doble-clic-en-el-renglon-no-lo-cierra", await b.getAttribute("aria-expanded") === "true" && await p.locator("[data-lentas]").count() === 1, await b.getAttribute("aria-expanded"));
});
await caso("per-33-doble-clic-en-la-orden-la-abre-una-vez", DIEZ(), async p => {
  await abrirFila(p, "Noemí", "draft");
  await p.locator("[data-lentas] [data-lenta]").first().dblclick(); await p.waitForTimeout(150);
  const n = ((await log(p)).match(/abrir:/g) || []).length;
  ok("per-33-doble-clic-en-la-orden-la-abre-una-vez", n === 1, `${n} veces`);
});
await caso("per-34-con-el-teclado", DIEZ(), async p => {
  const b = p.locator(`${FILA("Noemí", "draft")} button`).first();
  await b.focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  const a = await b.getAttribute("aria-expanded");
  await p.keyboard.press("Space"); await p.waitForTimeout(100);
  const c = await b.getAttribute("aria-expanded");
  await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  await p.keyboard.press("Tab");
  const foco = await p.evaluate(() => document.activeElement?.hasAttribute("data-lenta"));
  await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  ok("per-34-con-el-teclado", a === "true" && c === "false" && foco === true && /abrir:/.test(await log(p)), JSON.stringify({ a, c, foco, log: (await log(p)).slice(0, 60) }));
});
await caso("per-35-una-tabla-de-verdad", [DE_PUNTA_A_PUNTA()], async p => {
  const m = await p.evaluate(() => { const t = document.querySelector("[data-tiempos] table"); return { nombre: t?.getAttribute("aria-label") || t?.querySelector("caption")?.textContent || "", col: t?.querySelectorAll('thead th[scope="col"]').length, grupo: t?.querySelectorAll('tbody th[scope="rowgroup"]').length, fila: t?.querySelectorAll('tbody tr[data-etapa] th[scope="row"]').length, etapas: t?.querySelectorAll("tbody tr[data-etapa]").length }; });
  ok("per-35-una-tabla-de-verdad", /Tiempo/.test(m.nombre) && m.col === 8 && m.grupo === 5 && m.fila === m.etapas && m.etapas === 9, JSON.stringify(m));
});
await caso("per-36-el-horario-va-antes-de-los-tiempos", [DE_PUNTA_A_PUNTA()], async p => {
  const r = await regla(p), arriba = await p.evaluate(() => { const a = document.querySelector("[data-tiempos-regla]"), t = document.querySelector("[data-tiempos] table"); return !!a && !!t && a.getBoundingClientRect().bottom <= t.getBoundingClientRect().top; });
  ok("per-36-el-horario-va-antes-de-los-tiempos", /Sólo cuenta el horario de trabajo: lunes a viernes, de 9 a 2 y de 3 a 7, sin festivos de ley ni pausas/.test(r) && arriba, `«${r}» arriba: ${arriba}`);
});
await caso("per-37-dice-lo-que-no-es", [DE_PUNTA_A_PUNTA()], async p => {
  const t = await regla(p) + " " + await nota(p);
  // la orden estuvo ahí, con su fila; y de quién responde cada etapa lo dice una tabla fija, no la bitácora: sólo Validar trae su firma (DESIGN.md: «el nombre, sólo si la fuente lo sabe»)
  ok("per-37-dice-lo-que-no-es", /no el que se trabajó/.test(t) && /sólo en Validar/.test(t) && /Responsable/.test(t) && /180 días/.test(t), `«${t}»`);
});

// ── por donde no se diseñó ──
const RAROS = ["IMG_20250914_183022_HDR_portrait_edited_edited.HEIC", "نور الهدى عبد الرحمن", "👩🏽‍💻 Priya", "Benachrichtigungseinstellungen".repeat(4), "CLIENTE CON UN NOMBRE MUY PERO MUY LARGO QUE NO CABE EN EL RENGLÓN DE LA LISTA, SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE"];
await caso("per-38-nombres-raros-en-la-lista", RAROS.map((c, i) => validada("P-094" + i, DIAS[i], 60 * (i + 1), 5, { client: c })), async p => {
  await abrirFila(p, "Noemí", "draft");
  const m = await p.evaluate(() => { const c = document.querySelector("[data-tiempos-caja]"), ls = [...document.querySelectorAll("[data-lenta]")]; const fuera = ls.filter(l => { const r = l.getBoundingClientRect(), e = document.elementFromPoint(r.left + 20, r.top + r.height / 2); return !l.contains(e); }).length; const sinTiempo = ls.filter(l => { const t = l.lastElementChild.getBoundingClientRect(), b = l.getBoundingClientRect(); return t.width < 1 || t.right > b.right + 0.5; }).length; return { caja: c ? c.scrollWidth - c.clientWidth : null, pagina: document.documentElement.scrollWidth - innerWidth, renglones: ls.length, fuera, sinTiempo, dirAuto: ls.every(l => !!l.querySelector('[dir="auto"]')) }; });
  // lo que importa del renglón es el tiempo: un nombre larguísimo no lo puede sacar de la vista (el botón recorta lo que se sale, y la caja no se entera)
  ok("per-38-nombres-raros-en-la-lista", m.caja <= 1 && m.pagina <= 0 && m.renglones === 5 && m.fuera === 0 && m.sinTiempo === 0 && m.dirAuto, JSON.stringify(m));
});
await caso("per-39-la-venta-sin-folio-no-enseña-su-uuid", [validada(null, DIAS[0], 60, 5, { id: "fcad0f48-a7d2-484a-9b3d-a7766df98042", production_number: null, invoice_folio: "F-153", purchase_order_id: "OC-0948" })], async p => {
  await abrirFila(p, "Noemí", "draft");
  const t = limpio(await p.locator("[data-lenta]").first().innerText());
  ok("per-39-la-venta-sin-folio-no-enseña-su-uuid", /F-153/.test(t) && !/fcad0f48/.test(t), `«${t}»`);
});
for (const [ancho, alto] of [[1366, 768], [1920, 1080]]) await caso(`per-40-cabe-a-${ancho}`, [DE_PUNTA_A_PUNTA()], async p => {
  const m = await p.evaluate(() => { const c = document.querySelector("[data-tiempos-caja]"), ths = [...document.querySelectorAll('[data-tiempos] thead th')], ult = ths[ths.length - 1]?.getBoundingClientRect(); return { caja: c ? c.scrollWidth - c.clientWidth : null, pagina: document.documentElement.scrollWidth - innerWidth, derecha: Math.round(ult?.right ?? 9999), ancho: innerWidth }; });
  ok(`per-40-cabe-a-${ancho}`, m.caja <= 1 && m.pagina <= 0 && m.derecha <= m.ancho, JSON.stringify(m));
}, { viewport: { width: ancho, height: alto } });
await caso("per-41-en-el-telefono-la-tabla-se-desliza-en-su-caja", [DE_PUNTA_A_PUNTA()], async p => {
  const m = await p.evaluate(() => { const c = document.querySelector("[data-tiempos-caja]"); const est = c && getComputedStyle(c); return { desliza: est?.overflowX, derecha: Math.round(c?.getBoundingClientRect().right ?? 9999), ancho: innerWidth, primera: (() => { const th = document.querySelector('[data-tiempos] tbody tr[data-etapa] th[scope="row"]'); return th ? getComputedStyle(th).position : null; })() }; });
  ok("per-41-en-el-telefono-la-tabla-se-desliza-en-su-caja", m.desliza === "auto" && m.derecha <= m.ancho && m.primera === "sticky", JSON.stringify(m));
}, { viewport: { width: 390, height: 800 } });
await caso("per-42-mil-ordenes-no-la-traban", Array.from({ length: 1000 }, (_, i) => validada("P-" + (3000 + i), DIAS[i % DIAS.length], 30 + i % 200, 10 + i % 50)), async p => {
  const t0 = Date.now();
  await p.getByRole("tab", { name: "Tiempos" }).click(); await p.locator("[data-tiempos] table").waitFor({ timeout: 8000 });
  const ms = Date.now() - t0, v = await celda(p, "Noemí", "draft", "veces");
  ok("per-42-mil-ordenes-no-la-traban", /^1,?000$/.test(v || "") && ms < 5000, `${v} en ${ms} ms`);
  const t1 = Date.now(); await periodo(p, "Mes pasado"); await periodo(p, "Este mes"); const ms2 = Date.now() - t1 - 300;
  ok("per-42-cambiar-de-periodo-no-recalcula-todo", ms2 < 1500, `${ms2} ms`);
}, { abrir: false });
await caso("per-43-datos-malos-no-la-tiran", [
  orden("P-0950", { stage: "ctp" }, [["2026-10-05 09:00:00", "etapa_rara", "secretaria", "📋 Orden creada"], ["2026-10-05 10:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]]),
  { ...orden("P-0951", { stage: "ctp" }, [["2026-10-05 09:00:00", "ctp", "preprensa", "x"]]), timeline: [{ date: null, action: null, by: null }, { date: "no-es-fecha", to: "ctp" }, { action: "🎨 Diseño → 💿 CTP", date: H("2026-10-05 09:00:00"), to: "ctp", by: "preprensa" }] },
  orden("P-0952", { stage: "delivered", delivered_at: null, created_at: null }, [["2026-10-05 09:00:00", "design", "preprensa", "x"], ["2026-10-05 11:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]]),
  DE_PUNTA_A_PUNTA(),
], async p => {
  const n = await p.locator("[data-tiempos] table").count();
  ok("per-43-datos-malos-no-la-tiran", n === 1 && await celda(p, "Germán", "ctp", "mediana") === "3h", `tablas ${n}`);
});
await caso("per-44-llega-algo-con-la-tabla-abierta", [DE_PUNTA_A_PUNTA("P-0960")], async p => {
  await abrirFila(p, "Noemí", "draft");
  const antes = await celda(p, "Noemí", "draft", "veces");
  const nueva = validada("P-0961", DIAS[3], 120, 10);
  await p.evaluate(o => window.__cambiarOrdenes(os => [...os, o]), nueva); await p.waitForTimeout(200);
  const despues = await celda(p, "Noemí", "draft", "veces"), abierta = await p.locator("[data-lentas]").count(), primera = limpio(await p.locator("[data-lenta]").first().innerText());
  ok("per-44-llega-algo-con-la-tabla-abierta", antes === "1" && despues === "2" && abierta === 1 && /P-0961/.test(primera), JSON.stringify({ antes, despues, abierta, primera }));
});
await caso("per-45-cambiar-de-periodo-con-un-renglon-abierto", [validada("P-0962", DIAS[0], 60, 10)].concat(SEPT_OCT()), async p => {
  await abrirFila(p, "Noemí", "draft");
  await periodo(p, "Mes pasado");
  const lista = await p.locator("[data-lentas] [data-lenta]").allInnerTexts();
  await periodo(p, "Este mes");
  // el renglón sigue siendo el de Validar de Noemí; enseña las del periodo que se ve
  ok("per-45-cambiar-de-periodo-con-un-renglon-abierto", lista.length === 1 && /P-0601/.test(lista[0]) && !/P-0962/.test(lista[0]), JSON.stringify(lista));
});
await caso("per-46-se-queda-sin-su-renglon", [validada("P-0963", DIAS[0], 60, 10)], async p => {
  await abrirFila(p, "Noemí", "draft");
  await p.evaluate(() => window.__cambiarOrdenes(() => [])); await p.waitForTimeout(150);
  const v = await p.locator("[data-tiempos-vacio]").count();
  ok("per-46-se-queda-sin-su-renglon", v === 1, `vacío ${v}`);
});
await caso("per-47-todo-se-lee", [DE_PUNTA_A_PUNTA()].concat(DIEZ()), async p => {
  await abrirFila(p, "Noemí", "draft");
  const malos = await p.evaluate(() => { const rgb = c => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const v = m[1].split(/[ ,/]+/).map(Number); return { r: v[0], g: v[1], b: v[2], a: v[3] ?? 1 }; };
    const sobre = (f, a) => ({ r: f.r * f.a + a.r * (1 - f.a), g: f.g * f.a + a.g * (1 - f.a), b: f.b * f.a + a.b * (1 - f.a), a: 1 });
    const fondo = e => { const capas = []; for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a === 1) break; } } let f = { r: 255, g: 255, b: 255, a: 1 }; for (const c of capas.reverse()) f = sobre(c, f); return f; };
    const L = c => { const l = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * l(c.r) + 0.7152 * l(c.g) + 0.0722 * l(c.b); };
    const fuera = []; document.querySelectorAll("[data-tiempos] *").forEach(e => { if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const s = getComputedStyle(e), a = L(rgb(s.color)), b = L(fondo(e)), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); if (r < 4.5 || parseFloat(s.fontSize) < 10) fuera.push(e.textContent.trim().slice(0, 24) + " " + r.toFixed(2) + " " + s.fontSize); }); return fuera; });
  ok("per-47-todo-se-lee", malos.length === 0, malos.slice(0, 8).join(" · "));
});
await caso("per-48-la-primera-vista-trae-la-respuesta", DIEZ().concat([DE_PUNTA_A_PUNTA()]), async p => {
  const m = await p.evaluate(() => { const v = document.querySelector("[data-veredicto-tiempos]")?.getBoundingClientRect(), f = document.querySelector('[data-tiempos] tr[data-etapa="draft"]')?.getBoundingClientRect(); return { v: Math.round(v?.bottom ?? 9999), f: Math.round(f?.bottom ?? 9999), alto: innerHeight }; });
  ok("per-48-la-primera-vista-trae-la-respuesta", m.v <= m.alto && m.f <= m.alto, JSON.stringify(m));
});

// ── vuelta 2: por donde no se diseñó ──
await caso("per-54-lo-que-no-toco-el-horario-es-de-paso", [
  orden("P-1001", { stage: "ctp" }, [["2026-10-05 19:10:00", "design", "secretaria", "📋 Orden creada"], ["2026-10-05 19:50:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]]),
  orden("P-1002", { stage: "ctp" }, [["2026-10-06 19:10:00", "design", "secretaria", "📋 Orden creada"], ["2026-10-06 19:18:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]]),
  DISENO_Y_CTP("P-1003", 120, 60),
], async p => {
  const d = await fila(p, "Noemí", "design"), t = await nota(p);
  // de 19:10 a 19:50 no tocó el horario: 0 horas no dicen cuánto tardó, y la mediana bajaría a la mitad. El panel tampoco lo llama «<1m» (v10.84.178)
  ok("per-54-lo-que-no-toco-el-horario-es-de-paso", d.veces === "3" && d.depaso === "2" && d.mediana === "2h" && /dentro del horario/.test(t), `${JSON.stringify(d)} «${t.slice(0, 120)}»`);
});
await caso("per-55-todo-fuera-de-horario-no-dice-nan", [orden("P-1004", { stage: "ctp" }, [["2026-10-05 19:10:00", "design", "secretaria", "📋 Orden creada"], ["2026-10-05 19:50:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]])], async p => {
  const d = await fila(p, "Noemí", "design"), v = await veredicto(p), todo = limpio(await p.locator("[data-tiempos]").innerText());
  ok("per-55-todo-fuera-de-horario-no-dice-nan", d.mediana === "—" && d.parte === "0%" && !/NaN|Infinity|undefined/.test(todo) && !/Donde más/.test(v || ""), `${JSON.stringify(d)} «${v}»`);
});
await caso("per-56-dos-firmas-iguales-cuentan-una", [orden("P-1005", { stage: "design" }, [
  ["2026-10-05 09:00:00", "draft", "vendedor", "📋 Orden creada"],
  ["2026-10-05 10:00:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-10-05 11:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-05 11:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-10-05 11:00:07", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-05 11:00:07", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
])], async p => {
  const n = await fila(p, "Noemí", "draft");
  ok("per-56-dos-firmas-iguales-cuentan-una", n.veces === "1" && n.mediana === "2h", JSON.stringify(n));   // el doble de la bitácora (P-0712; 41 órdenes)
});
await caso("per-57-lo-que-regreso-a-validar-cuenta-cada-vez", [orden("P-1006", { stage: "design" }, [
  ["2026-10-05 09:00:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-10-05 10:00:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-10-05 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-05 10:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
  ["2026-10-05 11:00:00", "draft", "preprensa", "↩️ Diseño → 📝 Validar · Razón: le falta el logo"],
  ["2026-10-05 11:30:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-10-05 12:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-05 12:00:00", "design", "preprensa", "📝 → 🎨 Ambos validaron → Diseño"],
])], async p => {
  const n = await fila(p, "Noemí", "draft"), g = await fila(p, "Gerardo", "draft");
  ok("per-57-lo-que-regreso-a-validar-cuenta-cada-vez", n.veces === "2" && n.mediana === "1h" && g.veces === "2" && g.mediana === "45m", `${JSON.stringify(n)} ${JSON.stringify(g)}`);   // Noemí 1 h y 1 h; Gerardo 1 h y 30 m
});
await caso("per-58-el-limite-del-mes-con-la-hora-de-mexico", [
  orden("P-1007", { stage: "design" }, [["2026-09-30 18:00:00", "draft", "secretaria", "📋 Orden creada"], ["2026-09-30 18:30:00", null, "preprensa", "✅ Validada por Pre-prensa"], ["2026-09-30 18:30:00", null, "produccion", "✅ Validada por Producción"], ["2026-09-30 18:30:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"]]),
  orden("P-1008", { stage: "design" }, [["2026-09-30 18:00:00", "draft", "secretaria", "📋 Orden creada"], ["2026-10-01 00:10:00", null, "preprensa", "✅ Validada por Pre-prensa"], ["2026-10-01 00:10:00", null, "produccion", "✅ Validada por Producción"], ["2026-10-01 00:10:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"]]),
], async p => {
  // las 18:30 del 30 ya son 1 de octubre en UTC: cuenta en septiembre. Las 00:10 del 1, en octubre
  const oct = await celda(p, "Noemí", "draft", "veces"); await periodo(p, "Mes pasado"); const sep = await celda(p, "Noemí", "draft", "veces");
  ok("per-58-el-limite-del-mes-con-la-hora-de-mexico", oct === "1" && sep === "1", `oct ${oct}, sep ${sep}`);
});
await caso("per-59-los-otros-periodos", [validada("P-1009", "2026-07-20", 60, 10), validada("P-1010", "2026-07-10", 60, 10), validada("P-1011", "2026-02-10", 60, 10), validada("P-1012", "2025-11-10", 60, 10)], async p => {
  await periodo(p, "Últimos 90 días"); const n90 = await celda(p, "Noemí", "draft", "veces"), r90 = limpio(await p.locator("[data-rango]").first().innerText());
  await periodo(p, "Este año"); const nA = await celda(p, "Noemí", "draft", "veces");
  await periodo(p, "Todo"); const nT = await celda(p, "Noemí", "draft", "veces");
  ok("per-59-los-otros-periodos", n90 === "1" && /16 jul-13 oct/.test(r90) && nA === "3" && nT === "4", JSON.stringify({ n90, r90, nA, nT }));
});
await caso("per-60-cada-boton-dice-de-quien", CINCO(), async p => {
  const n = await p.getByRole("button", { name: /Validar.*Noemí/ }).count(), g = await p.getByRole("button", { name: /Validar.*Gerardo/ }).count();
  ok("per-60-cada-boton-dice-de-quien", n === 1 && g === 1, `Noemí ${n}, Gerardo ${g} (dos botones «Validar» no se distinguen con un lector de pantalla)`);
});
await caso("per-61-la-prueba-del-cliente-es-del-cliente", [orden("P-1013", { stage: "ctp" }, [
  ["2026-10-05 09:00:00", "design", "secretaria", "📋 Orden creada"],
  ["2026-10-05 10:00:00", "proof_client", "preprensa", "🎨 Diseño → 📨 Prueba al cliente"],
  ["2026-10-07 10:00:00", "ctp", "preprensa", "✅ Cliente aprobó → 💿 CTP"],
])], async p => {
  const t = await nota(p), filas = await p.locator('[data-tiempos] tr[data-etapa="proof_client"]').count();
  ok("per-61-la-prueba-del-cliente-es-del-cliente", filas === 0 && /al cliente \(1\)/.test(t) && /al maquilador \(0\)/.test(t), `renglones ${filas}; «${t.slice(0, 220)}»`);
});
await caso("per-62-una-fecha-del-futuro-no-la-tira", [orden("P-1014", { stage: "ctp" }, [["2026-10-13 09:00:00", "design", "secretaria", "📋 Orden creada"], ["2026-10-14 09:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]]), DE_PUNTA_A_PUNTA()], async p => {
  const d = await fila(p, "Noemí", "design");
  ok("per-62-una-fecha-del-futuro-no-la-tira", d.veces === "1" && d.mediana === "2h", JSON.stringify(d));   // la de mañana no entra en «hasta hoy»
});
await caso("per-63-dice-cuantas-enseña", [validada("P-1015", DIAS[0], 60, 10), validada("P-1016", DIAS[1], 90, 300)], async p => {
  await abrirFila(p, "Noemí", "draft");
  const t = limpio(await p.locator("[data-lentas]").first().innerText());
  await abrirFila(p, "Gerardo", "draft");
  const t2 = limpio(await p.locator("[data-lentas]").first().innerText()), abiertas = await p.locator("[data-lentas]").count();
  ok("per-63-dice-cuantas-enseña", /^Las 2, de la más lenta/.test(t) && /P-1016.*P-1015/.test(t) && abiertas === 1 && /P-1016.*5h/.test(t2), `«${t.slice(0, 100)}» · «${t2.slice(0, 100)}» · abiertas ${abiertas}`);
});
await caso("per-64-la-unica", [validada("P-1017", DIAS[0], 60, 10)], async p => {
  await abrirFila(p, "Noemí", "draft");
  const t = limpio(await p.locator("[data-lentas]").first().innerText());
  ok("per-64-la-unica", /^La única/.test(t) && !/Las 1/.test(t), `«${t.slice(0, 80)}»`);
});
await caso("per-65-irse-y-regresar", [DE_PUNTA_A_PUNTA()], async p => {
  await periodo(p, "Mes pasado"); await periodo(p, "Este mes");
  await abrirFila(p, "Noemí", "draft");
  await p.getByRole("tab", { name: "Clientes" }).click(); await p.waitForTimeout(120);
  const fuera = await p.locator("[data-tiempos]").count();
  await p.getByRole("tab", { name: "Tiempos" }).click(); await p.waitForTimeout(120);
  const v = await celda(p, "Noemí", "draft", "veces");
  ok("per-65-irse-y-regresar", fuera === 0 && v === "1", `fuera ${fuera}, al regresar ${v}`);
});
await caso("per-66-una-pausa-se-resta", [orden("P-1018", { stage: "ctp" }, [
  ["2026-10-05 09:00:00", "design", "secretaria", "📋 Orden creada"],
  ["2026-10-05 10:00:00", null, "preprensa", "🔕 En espera: falta el papel"],
  ["2026-10-05 12:00:00", null, "preprensa", "🔔 Reactivada"],
  ["2026-10-05 13:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"],
])], async p => {
  const d = await fila(p, "Noemí", "design");
  ok("per-66-una-pausa-se-resta", d.mediana === "2h", JSON.stringify(d));   // de 9 a 13 son 4 h, menos las 2 de la pausa: la de la orden no es del cliente, y sí se cuenta
});
await caso("per-67-la-maquila-nacida-en-validar-no-se-valida", [orden("P-1019", { stage: "maq_sent", order_type: "maquila" }, [["2026-10-05 09:00:00", "draft", "secretaria", "📋 Orden creada"], ["2026-10-05 10:00:00", "maq_sent", "secretaria", "🚚 Enviada a maquila"]])], async p => {
  const n = await hayFila(p, "Noemí", "draft"), g = await hayFila(p, "Gerardo", "draft"), v = await p.locator("[data-tiempos-vacio]").count();
  ok("per-67-la-maquila-nacida-en-validar-no-se-valida", n === 0 && g === 0 && v === 1, `Noemí ${n}, Gerardo ${g}, vacío ${v}`);
});
await caso("per-68-mas-de-cien-mil-por-ciento-no", [validada("P-1020", DIAS[0], 300, 300), orden("P-1021", { stage: "ctp" }, [["2026-10-05 09:00:00", "design", "secretaria", "📋 Orden creada"], ["2026-10-05 09:06:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]]), ...Array.from({ length: 60 }, (_, i) => orden("P-20" + String(i).padStart(2, "0"), { stage: "placas_listas" }, [["2026-09-01 09:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"], ["2026-10-09 09:00:00", "placas_listas", "german", "💿 CTP → 📋 Placas Listas"]]))], async p => {
  const d = await fila(p, "Noemí", "design"), g = await fila(p, "Germán", "ctp");
  // seis minutos contra miles de horas de CTP: «<1%», no «0%» (sí tiene tiempo); y una etapa de 100% de lo marcado no se sale de su columna
  ok("per-68-mas-de-cien-mil-por-ciento-no", d.parte === "<1%" && /^60\b/.test(g.pasaron || "") && /100\s?%/.test(g.pasaron || "") && /^\d+%$/.test(g.parte || ""), `${JSON.stringify(d)} ${JSON.stringify(g)}`);
});

// ── vuelta 3: lo que dejaron los arreglos de la 2, y lo que quedaba por donde no se diseñó ──
await caso("per-70-la-firma-de-lo-cancelado-no-cuenta", [
  orden("P-1201", { stage: "cancelled", cancelled_at: H("2026-10-05 12:00:00") }, [
    ["2026-10-05 09:00:00", "draft", "secretaria", "📋 Orden creada"],
    ["2026-10-05 10:00:00", null, "preprensa", "✅ Validada por Pre-prensa"],
    ["2026-10-05 12:00:00", null, "admin", "❌ Cancelada"],
  ]),
  DE_PUNTA_A_PUNTA(),
], async p => {
  const n = await celda(p, "Noemí", "draft", "veces"), t = await nota(p);
  // medido el 5-nov: de 10 canceladas, sólo una en Validar y con firma. La nota lo dice: ni la etapa en la que se canceló
  ok("per-70-la-firma-de-lo-cancelado-no-cuenta", n === "1" && /ni la etapa en la que se canceló/.test(t), `Noemí ${n}; «${t.slice(0, 120)}»`);
});
await caso("per-71-todo-mientras-lee-no-dice-fecha", [DE_PUNTA_A_PUNTA()], async p => {
  await periodo(p, "Todo");
  const r1 = limpio(await p.locator("[data-rango]").first().innerText());
  await p.evaluate(() => window.__terminarLectura()); await p.waitForTimeout(150);
  const r2 = limpio(await p.locator("[data-rango]").first().innerText());
  // lo activo ya trae su bitácora y lo terminado todavía no: «desde 5 oct» sería una fecha a medias, que luego cambia sola
  ok("per-71-todo-mientras-lee-no-dice-fecha", /leyendo/i.test(r1) && !/desde/.test(r1) && r2 === "desde 5 oct 2026", `«${r1}» → «${r2}»`);
}, { query: "modo=leyendo" });
await caso("per-71b-todo-mientras-lee-no-dice-que-no-hay", [{ ...DE_PUNTA_A_PUNTA(), timeline: [] }], async p => {
  await periodo(p, "Todo");
  const r = limpio(await p.locator("[data-rango]").first().innerText());
  ok("per-71b-todo-mientras-lee-no-dice-que-no-hay", /leyendo/i.test(r) && !/sin movimientos/.test(r), `«${r}»`);
}, { query: "modo=leyendo" });
await caso("per-72-el-renglon-de-maquina-dice-que-es", [DE_PUNTA_A_PUNTA()], async p => {
  const b = p.getByRole("button", { name: "Máquina: ver las más lentas", exact: true }), n = await b.count();
  await b.first().click(); await p.waitForTimeout(120);
  const t = limpio(await p.locator("[data-lentas]").first().innerText());
  ok("per-72-el-renglon-de-maquina-dice-que-es", n === 1 && /P-0300/.test(t) && /\b9h\b/.test(t), `${n} botones; «${t.slice(0, 80)}»`);
});
await caso("per-73-la-pausa-que-cubre-la-estancia-es-de-paso", [
  orden("P-1203", { stage: "ctp" }, [["2026-10-05 09:00:00", "design", "secretaria", "📋 Orden creada"], ["2026-10-05 09:00:30", null, "preprensa", "🔕 En espera: falta el papel"], ["2026-10-05 12:00:00", null, "preprensa", "🔔 Reactivada"], ["2026-10-05 12:00:30", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]]),
  orden("P-1204", { stage: "ctp" }, [["2026-10-06 09:00:00", "design", "secretaria", "📋 Orden creada"], ["2026-10-06 09:00:00", null, "preprensa", "🔕 En espera: falta el papel"], ["2026-10-06 12:00:00", null, "preprensa", "🔔 Reactivada"], ["2026-10-06 12:00:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]]),
  DISENO_Y_CTP("P-1205", 120, 60),
], async p => {
  const d = await fila(p, "Noemí", "design");
  // tres horas en pausa y un minuto de trabajo: ese minuto no dice cuánto tarda, y la mediana bajaría a la mitad
  ok("per-73-la-pausa-que-cubre-la-estancia-es-de-paso", d.veces === "3" && d.depaso === "2" && d.mediana === "2h", JSON.stringify(d));
});
await caso("per-74-de-paso-se-mide-en-horario-de-trabajo", [
  DISENO_Y_CTP("P-1206", 5, 60),
  DISENO_Y_CTP("P-1207", 6, 60),
  orden("P-1208", { stage: "ctp" }, [["2026-10-05 18:58:00", "design", "secretaria", "📋 Orden creada"], ["2026-10-06 09:01:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]]),
], async p => {
  const d = await fila(p, "Noemí", "design"), t = await nota(p);
  // 5 minutos, sí (el límite); 6, no; y de las 18:58 a las 9:01 del otro día son 3 minutos de horario: se quedó la noche, no se tardó
  ok("per-74-de-paso-se-mide-en-horario-de-trabajo", d.veces === "3" && d.depaso === "2" && d.mediana === "6m" && /menos de 5 minutos dentro del horario/.test(t), `${JSON.stringify(d)} «${t.slice(0, 200)}»`);
});
await caso("per-75-a-390-la-pagina-no-se-desliza-y-se-ven-cifras", [DE_PUNTA_A_PUNTA()], async p => {
  const m = await p.evaluate(() => { const c = document.querySelector("[data-tiempos-caja]"), f = [...document.querySelectorAll('[data-tiempos] tbody tr[data-etapa] th[scope="row"]')]; return { pagina: document.documentElement.scrollWidth - innerWidth, caja: c.clientWidth, columna: Math.round(f[0].getBoundingClientRect().width), cortados: f.filter(th => { const s = th.querySelector("button > span"); return s.scrollWidth > s.clientWidth; }).length }; });
  // la columna pegada no se puede comer la caja: con 240 px de 326 quedaba una sola cifra a la vista
  ok("per-75-a-390-la-pagina-no-se-desliza-y-se-ven-cifras", m.pagina <= 0 && m.columna <= m.caja * 0.5 && m.cortados === 0, JSON.stringify(m));
}, { viewport: { width: 390, height: 800 } });
await caso("per-76-todo-sin-entregas-dice-desde-la-bitacora", [validada("P-1209", DIAS[0], 60, 10)], async p => {
  await periodo(p, "Todo");
  const r = limpio(await p.locator("[data-rango]").first().innerText()), n = await celda(p, "Noemí", "draft", "veces");
  ok("per-76-todo-sin-entregas-dice-desde-la-bitacora", r === "desde 1 oct 2026" && n === "1", `«${r}»; ${n}`);
});
await caso("per-77-firmar-fuera-de-horario-cuenta-como-rapido", [orden("P-1210", { stage: "design" }, [
  ["2026-10-05 19:10:00", "draft", "secretaria", "📋 Orden creada"],
  ["2026-10-05 19:30:00", null, "preprensa", "✅ Validada por Pre-prensa"],
  ["2026-10-06 09:30:00", null, "produccion", "✅ Validada por Producción"],
  ["2026-10-06 09:30:00", "design", "produccion", "📝 → 🎨 Ambos validaron → Diseño"],
])], async p => {
  const n = await fila(p, "Noemí", "draft"), g = await fila(p, "Gerardo", "draft");
  // en Validar no hay de paso: firmó antes de que empezara el día, y eso sí es lo que se mide
  ok("per-77-firmar-fuera-de-horario-cuenta-como-rapido", n.veces === "1" && n.mediana === "<1m" && g.mediana === "30m", `${JSON.stringify(n)} ${JSON.stringify(g)}`);
});
await caso("per-78-la-prueba-que-sigue-esperando-no-se-cuenta", [orden("P-1211", { stage: "proof_client" }, [["2026-10-05 09:00:00", "design", "secretaria", "📋 Orden creada"], ["2026-10-05 10:00:00", "proof_client", "preprensa", "🎨 Diseño → 📨 Prueba al cliente"]])], async p => {
  const t = await nota(p), filas = await p.locator('[data-tiempos] tr[data-etapa="proof_client"]').count();
  ok("per-78-la-prueba-que-sigue-esperando-no-se-cuenta", filas === 0 && /al cliente \(0\)/.test(t), `renglones ${filas}; «${t.slice(0, 200)}»`);
});
await caso("per-79-la-pausa-del-cliente-que-sigue-abierta-no-se-cuenta", [
  orden("P-1212", { stage: "salidas" }, [["2026-10-05 09:00:00", "salidas", "produccion", "📦 Empaque → 📤 Salidas"], ["2026-10-05 10:00:00", null, "karla", "🧾 En espera: el cliente no ha pedido factura"]]),
  DE_PUNTA_A_PUNTA(),
], async p => {
  const t = await nota(p), k = await celda(p, "Karla", "salidas", "veces");
  ok("per-79-la-pausa-del-cliente-que-sigue-abierta-no-se-cuenta", k === "1" && /al cliente \(0\)/.test(t), `Karla ${k}; «${t.slice(0, 200)}»`);
});

// ── vuelta 4: las fallas en los arreglos de la 3 ──
await caso("per-80-a-390-con-nombres-raros-tampoco-se-desliza-la-pagina", RAROS.map((c, i) => validada("P-130" + i, DIAS[i], 60 * (i + 1), 5, { client: c })), async p => {
  await abrirFila(p, "Noemí", "draft");
  const m = await p.evaluate(() => ({ pagina: document.documentElement.scrollWidth - innerWidth, renglones: document.querySelectorAll("[data-lenta]").length }));
  ok("per-80-a-390-con-nombres-raros-tampoco-se-desliza-la-pagina", m.pagina <= 0 && m.renglones === 5, JSON.stringify(m));
}, { viewport: { width: 390, height: 800 } });
await caso("per-81-la-comida-no-cuenta-para-de-paso", [
  orden("P-1311", { stage: "ctp" }, [["2026-10-05 13:58:00", "design", "secretaria", "📋 Orden creada"], ["2026-10-05 15:02:00", "ctp", "preprensa", "🎨 Diseño → 💿 CTP"]]),
  DISENO_Y_CTP("P-1312", 120, 60),
], async p => {
  const d = await fila(p, "Noemí", "design");   // de 13:58 a 15:02 son 4 minutos de horario: se quedó la comida
  ok("per-81-la-comida-no-cuenta-para-de-paso", d.veces === "2" && d.depaso === "1" && d.mediana === "2h", JSON.stringify(d));
});
await caso("per-82-mientras-lee-las-otras-pestanas-dicen-sus-entregas", [DE_PUNTA_A_PUNTA()], async p => {
  await periodo(p, "Todo");
  const tiempos = limpio(await p.locator("[data-rango]").first().innerText());
  await p.getByRole("tab", { name: "Financiero" }).click(); await p.waitForTimeout(120);
  const fin = limpio(await p.locator("[data-rango]").first().innerText());
  // lo entregado no depende de la bitácora: sólo «Tiempos» espera
  ok("per-82-mientras-lee-las-otras-pestanas-dicen-sus-entregas", /leyendo/i.test(tiempos) && fin === "desde 9 oct 2026", `«${tiempos}» · «${fin}»`);
}, { query: "modo=leyendo" });
await caso("per-83-ya-leida-y-sin-bitacora-lo-dice", [{ ...DE_PUNTA_A_PUNTA(), timeline: [] }], async p => {
  await periodo(p, "Todo");
  const r = limpio(await p.locator("[data-rango]").first().innerText()), v = limpio(await p.locator("[data-tiempos-vacio]").first().innerText());
  ok("per-83-ya-leida-y-sin-bitacora-lo-dice", r === "sin movimientos en la bitácora" && /Ninguna orden/.test(v), `«${r}» · «${v}»`);
});
await caso("per-84-cuatro-cifras-caben-en-su-columna", Array.from({ length: 1200 }, (_, i) => validada("P-" + (5000 + i), DIAS[i % DIAS.length], 300, 10)), async p => {
  // lo que se ve: el rectángulo del texto contra el de su celda (el `scrollWidth` de una celda no siempre lo dice)
  const n = await fila(p, "Noemí", "draft"), m = await p.locator("[data-tiempos] td[data-c]").evaluateAll(tds => tds.filter(td => { const r = document.createRange(); r.selectNodeContents(td); const t = r.getBoundingClientRect(), c = td.getBoundingClientRect(); return t.left < c.left - 0.5 || t.right > c.right + 0.5; }).map(td => { const r = document.createRange(); r.selectNodeContents(td); return td.getAttribute("data-c") + ": " + td.textContent + " " + Math.round(r.getBoundingClientRect().width) + " px en " + Math.round(td.getBoundingClientRect().width); }));
  ok("per-84-cuatro-cifras-caben-en-su-columna", n.veces === "1,200" && /^1,200 · 100\s?%$/.test(n.pasaron || "") && m.length === 0, `${JSON.stringify(n)} se salen: ${m.join(" ; ")}`);
}, { viewport: { width: 1366, height: 768 } });
await caso("per-85-a-768-la-pagina-no-se-desliza", [DE_PUNTA_A_PUNTA()], async p => {
  const m = await p.evaluate(() => ({ pagina: document.documentElement.scrollWidth - innerWidth, derecha: Math.round(document.querySelector("[data-tiempos-caja]").getBoundingClientRect().right), ancho: innerWidth }));
  ok("per-85-a-768-la-pagina-no-se-desliza", m.pagina <= 0 && m.derecha <= m.ancho, JSON.stringify(m));
}, { viewport: { width: 768, height: 900 } });

await browser.close();

// ── la cuenta, sin pantalla ──
process.env.TZ = "America/Mexico_City";
const { mediana, nueveDeDiez, tiempoPorPersona } = await import("../../src/lib/tiempoPorEtapa.js").catch(() => ({}));
if (!process.env.SOLO || new RegExp(process.env.SOLO).test("per-50")) {
  if (!mediana) ok("per-50-la-cuenta-existe", false, "la cuenta no está en src/lib/tiempoPorEtapa.js");
  else {
    const m = [[[], null], [[3], 3], [[5, 1], 3], [[1, 2, 9], 2], [[1, 1, 2, 2], 1.5]].filter(([a, e]) => mediana(a) !== e);
    ok("per-50-la-mediana", m.length === 0, JSON.stringify(m));
    const uno = Array.from({ length: 9 }, (_, i) => i + 1), diez = Array.from({ length: 10 }, (_, i) => i + 1), once = Array.from({ length: 11 }, (_, i) => i + 1);
    ok("per-51-nueve-de-diez", nueveDeDiez(uno) === null && nueveDeDiez(diez) === 9 && nueveDeDiez(once) === 10 && nueveDeDiez([]) === null, `${nueveDeDiez(uno)}, ${nueveDeDiez(diez)}, ${nueveDeDiez(once)}`);
    const orig = [5, 1, 3]; mediana(orig); nueveDeDiez(orig);
    ok("per-52-no-reacomoda-lo-que-recibe", orig.join() === "5,1,3", orig.join());
    const nada = tiempoPorPersona([], {});
    ok("per-53-sin-nada-no-truena", nada.grupos.length === 0 && nada.base === 0 && !nada.validar, JSON.stringify(nada).slice(0, 200));
  }
}
for (const r of res) console.log(r);
const fallas = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\n${res.length - fallas} pasan, ${fallas} fallan`);
process.exit(0);
