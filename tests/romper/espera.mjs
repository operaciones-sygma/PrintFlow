// Tratar de ROMPER «En espera» (la vista de App `view==="espera"`), su /impeccable critique del 16-oct en la noche (v10.84.143). Cada caso afirma lo que
// DEBERÍA ver Karla: una FALLA es un bug. Vuelta 1: escritas antes del arreglo. El reloj del navegador va fijo en el viernes 16-oct-2026 a las 12:00.
// En el banco: 6 listas en Salidas «el cliente no ha pedido factura» (P-0070 lleva 82 días; la alfabéticamente primera, 1 día), 2 recibidas de maquila
// igual (la de 10 días se llama «MAQUILA ZETA», la de 2 «MAQUILA ALFA»), 2 en Listas esperando papel (una con la entrega vencida); y lo que no sale (sin
// pausa, pausa vencida). Hoy en producción las 21 pausadas son de «el cliente no ha pedido factura».
// Uso: node espera.mjs <dir-capturas> [puerto=5484]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5484);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
const AHORA = new Date("2026-10-16T12:00:00-06:00");
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, { viewport = { width: 1366, height: 768 } } = {}) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const ctx = await browser.newContext({ viewport, timezoneId: "America/Mexico_City", locale: "es-MX" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !deFuera(m)) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.clock.setFixedTime(AHORA);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.getByRole("heading", { name: /En espera/ }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(250);
    await fn(page);
    const nativos = (await lineas(page, "alert:")).concat(await lineas(page, "confirm:"));
    if (nativos.length) ok(nombre + " · diálogo nativo", false, nativos.join(" ; ").slice(0, 200));
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png", fullPage: true }).catch(() => {});
  await ctx.close();
}
const log = async p => (await p.textContent("#log")) || "";
const lineas = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref));
const espera = (p, ms = 250) => p.waitForTimeout(ms);
const texto = p => p.evaluate(() => { const r = document.getElementById("root").cloneNode(true); r.querySelector("#log")?.remove(); return r.innerText.replace(/\s+/g, " "); });
// el grupo de una etapa (el <details> cuyo <summary> dice la etapa) y las fichas que tiene, en orden
const grupo = (p, etapa) => p.locator("details", { has: p.locator("summary", { hasText: etapa }) }).first();
const fichasDe = async (p, etapa) => (await grupo(p, etapa).locator('[role="button"][aria-label^="Orden "]').evaluateAll(xs => xs.map(x => (x.getAttribute("aria-label").match(/P-\d{4}/) || ["?"])[0])));
const abrir = async (p, etapa) => { const g = grupo(p, etapa); if (!(await g.evaluate(d => d.open))) { await g.locator("summary").click(); await espera(p); } };
const ficha = (p, pn) => p.getByRole("button", { name: new RegExp("^Orden " + pn) }).first();
const tabHasta = async (p, quiere, max = 120) => {
  for (let i = 0; i < max; i++) {
    await p.keyboard.press("Tab");
    const t = await p.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? ((a.getAttribute("aria-label") || "") + " " + (a.innerText || "")).trim() : ""; });
    if (quiere(t)) return t;
  }
  return "";
};
const sinAA = p => p.evaluate(() => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const malos = [];
  for (const el of document.querySelectorAll("#root *")) {
    if (el.closest("#log,#lateral,#barra")) continue;
    const t = propio(el); if (!t || !el.getClientRects().length) continue;
    const s = getComputedStyle(el); if (s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    const op = Number(s.opacity) * Number(getComputedStyle(el.parentElement || el).opacity);
    const a = lum(nums(s.color)), b = lum(fondo(el)), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) * (op < 1 ? op : 1);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (k < (grande ? 3 : 4.5) || parseFloat(s.fontSize) < 10) malos.push(t.slice(0, 30) + " " + k.toFixed(1) + (parseFloat(s.fontSize) < 10 ? " (" + s.fontSize + ")" : ""));
  }
  return [...new Set(malos)];
});

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("esp-01-sin-lectura-no-dice-nada-en-espera", "lectura=no", async p => {
  const t = await texto(p);
  ok("esp-01-sin-lectura-no-dice-nada-en-espera", !/Nada en espera/.test(t) && /No se pudieron leer/.test(t), `sin haber leído: ${/Nada en espera/.test(t) ? "dice «Nada en espera»" : "no dice que no hay"}; ${/No se pudieron leer/.test(t) ? "dice que no se pudo leer" : "NO dice que no se pudo leer"}`);
});
await caso("esp-02-el-subtitulo-dice-lo-que-hay", "caso=solo-factura", async p => {
  const sub = ((await p.locator("h2 + p").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("esp-02-el-subtitulo-dice-lo-que-hay", !/Volver a producción/.test(sub) && !/—/.test(sub) && /Ya pidió factura/.test(sub),
    `con las 8 esperando al cliente, el subtítulo: «${sub.slice(0, 170)}» (no debe mandar a «Volver a producción», que no existe para ellas; debe decir qué hacer cuando el cliente la pida)`);
});
// (Karla no ve lote en Listas: lo pausó Gerardo y «le toca a Gerardo»; Dirección sí. La primera versión buscaba el de Listas como Karla.)
await caso("esp-03-sin-lote-para-lo-que-espera-al-cliente", "", async p => {
  for (const e of ["Salidas", "Recibida de Maquila"]) await abrir(p, e).catch(() => {});
  const salidas = await grupo(p, "Salidas").getByRole("button", { name: /Reactivar las \d+|Confirmar/ }).count();
  const maquila = await grupo(p, "Recibida de Maquila").getByRole("button", { name: /Reactivar las \d+|Confirmar/ }).count();
  ok("esp-03-sin-lote-para-lo-que-espera-al-cliente", salidas === 0 && maquila === 0, `Karla: Salidas (6 esperan al cliente) ${salidas ? "ofrece reactivar en lote (diría que los 6 clientes pidieron factura a la vez)" : "sin lote"}; la maquila recibida (2) ${maquila ? "ofrece lote" : "sin lote"}`);
});
await caso("esp-03b-direccion-si-tiene-el-lote-del-taller", "rol=admin", async p => {
  for (const e of ["Salidas", "Lista p/ imprimir"]) await abrir(p, e).catch(() => {});
  const salidas = await grupo(p, "Salidas").getByRole("button", { name: /Reactivar las \d+|Confirmar/ }).count();
  const listas = await grupo(p, "Lista p/ imprimir").getByRole("button", { name: /Reactivar las 2/ }).count();
  ok("esp-03b-direccion-si-tiene-el-lote-del-taller", salidas === 0 && listas === 1, `Dirección: Salidas ${salidas ? "ofrece lote" : "sin lote"}; Listas (2 esperando papel) ${listas ? "«Reactivar las 2»" : "sin su lote"}`);
});
await caso("esp-04-el-lote-no-va-dentro-del-encabezado", "", async p => {
  const n = await p.evaluate(() => document.querySelectorAll("summary button, summary [role=button]").length);
  ok("esp-04-el-lote-no-va-dentro-del-encabezado", n === 0, `${n} botón(es) dentro de un <summary> (un botón dentro de otro: el lector de pantalla no lo anuncia)`);
});
await caso("esp-05-la-mas-vieja-primero", "", async p => {
  for (const e of ["Salidas", "Recibida de Maquila"]) await abrir(p, e).catch(() => {});
  const s = await fichasDe(p, "Salidas"), m = await fichasDe(p, "Recibida de Maquila");
  ok("esp-05-la-mas-vieja-primero", s.join(",") === "P-0070,P-0389,P-0431,P-0506,P-0600,P-0601" && m.join(",") === "P-0610,P-0611",
    `Salidas: ${s.join(", ")} (debe de la que más lleva esperando a la que menos: P-0070 82 días … P-0601 1 día); maquila: ${m.join(", ")} (P-0610 10 días antes que P-0611)`);
});
await caso("esp-06-la-que-espera-al-cliente-dice-como-contactarlo", "", async p => {
  await abrir(p, "Salidas").catch(() => {});
  const t = ((await ficha(p, "P-0070").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("esp-06-la-que-espera-al-cliente-dice-como-contactarlo", /4771234567/.test(t) && /Eva Martínez/.test(t), `la ficha de P-0070: ${/4771234567/.test(t) ? "con el teléfono" : "SIN el teléfono"}, ${/Eva Martínez/.test(t) ? "con su agente de compras" : "SIN su agente de compras"} (lo que sigue con ella es preguntarle al cliente si ya quiere su factura)`);
});
await caso("esp-07-y-cuanto-es", "", async p => {
  await abrir(p, "Salidas").catch(() => {});
  const t = ((await ficha(p, "P-0070").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("esp-07-y-cuanto-es", /\$21,700/.test(t), `la ficha de P-0070 ${/\$21,700/.test(t) ? "dice su importe" : "NO dice su importe ($21,700): es dinero por cobrar en cuanto la pida"}`);
});
await caso("esp-07b-produccion-no-ve-el-importe", "rol=produccion", async p => {
  for (const e of ["Salidas", "Lista p/ imprimir"]) await abrir(p, e).catch(() => {});
  const t = await texto(p);
  ok("esp-07b-produccion-no-ve-el-importe", !/\$21,700|\$9,446/.test(t), `Gerardo ${/\$21,700|\$9,446/.test(t) ? "VE los importes" : "no ve importes (como en el resto de la app)"}`);
});
for (const z of ["", "abiertos"]) {
  await caso("esp-08-todo-se-lee" + (z ? "-con-los-grupos-abiertos" : ""), "", async p => {
    if (z) for (const e of ["Salidas", "Recibida de Maquila", "Lista p/ imprimir"]) await abrir(p, e).catch(() => {});
    const m = await sinAA(p);
    ok("esp-08-todo-se-lee" + (z ? "-con-los-grupos-abiertos" : ""), m.length === 0, m.length ? m.length + " textos sin AA o de menos de 10 px: " + m.slice(0, 8).join(" | ") : "todo con AA");
  });
}
await caso("esp-09-ya-pidio-factura-reactiva-solo-esa", "", async p => {
  await abrir(p, "Salidas").catch(() => {});
  const b = ficha(p, "P-0070").getByRole("button", { name: /Ya pidió factura/ });
  const hay = await b.count(); if (hay) { await b.first().click(); await espera(p, 400); }
  const s = await fichasDe(p, "Salidas");
  ok("esp-09-ya-pidio-factura-reactiva-solo-esa", hay === 1 && (await lineas(p, "accion OP-P-0070 unsnooze")).length === 1 && !s.includes("P-0070") && s.length === 5,
    `${hay ? "«Ya pidió factura» en P-0070" : "SIN «Ya pidió factura»"}; quedan en Salidas: ${s.join(", ")}`);
});
await caso("esp-10-el-lote-de-listas-reactiva-las-dos", "rol=admin", async p => {
  await abrir(p, "Lista p/ imprimir").catch(() => {});
  const b = p.getByRole("button", { name: /Reactivar las 2/ }); const hay = await b.count();
  if (hay) { await b.first().click(); await espera(p, 400); }
  const l = await lineas(p, "reactivar-lote ");
  ok("esp-10-el-lote-de-listas-reactiva-las-dos", hay === 1 && l.length === 1 && /OP-P-0620/.test(l[0]) && /OP-P-0621/.test(l[0]) && !/P-06[01]\d|P-0070/.test(l[0].replace(/OP-P-062[01]/g, "")),
    `Dirección, ${hay === 1 ? "un «Reactivar las 2»" : hay + " «Reactivar las 2»"}: ${l[0] || "no pidió nada"} (sólo las dos que esperan papel)`);
});
await caso("esp-11-el-encabezado-se-pliega-con-el-teclado", "", async p => {
  const t = await tabHasta(p, x => /Lista p\/ imprimir/.test(x) && !/^Orden /.test(x));
  const antes = await grupo(p, "Lista p/ imprimir").evaluate(d => d.open);
  if (t) await p.keyboard.press("Enter");
  await espera(p);
  const despues = await grupo(p, "Lista p/ imprimir").evaluate(d => d.open);
  ok("esp-11-el-encabezado-se-pliega-con-el-teclado", !!t && antes !== despues, `con Tab ${t ? "se llega al encabezado de Listas" : "NO se llega al encabezado de Listas"}; Enter: ${antes ? "abierto" : "plegado"} → ${despues ? "abierto" : "plegado"}`);
});
for (const ancho of [1366, 1920]) {
  await caso(`esp-12-cabe-a-${ancho}`, "", async p => {
    for (const e of ["Salidas", "Recibida de Maquila", "Lista p/ imprimir"]) await abrir(p, e).catch(() => {});
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(`esp-12-cabe-a-${ancho}`, r.sw <= r.cw, `a ${ancho}: ancho de la página ${r.sw} en ${r.cw}`);
  }, { viewport: { width: ancho, height: ancho === 1366 ? 768 : 1080 } });
}
await caso("esp-13-la-pausa-en-palabras", "", async p => {
  await abrir(p, "Salidas").catch(() => {});
  const t = ((await ficha(p, "P-0070").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("esp-13-la-pausa-en-palabras", /no ha pedido factura/.test(t) && !/—/.test(t) && /Karla/.test(t), `la ficha de P-0070: «${t.slice(0, 160)}» (el motivo y quién la pausó, sin rayas largas)`);
});
await caso("esp-14-vacio-de-verdad", "caso=vacio", async p => {
  const t = await texto(p);
  ok("esp-14-vacio-de-verdad", /Nada en espera/.test(t), `se leyó y no hay pausadas: ${/Nada en espera/.test(t) ? "lo dice" : "NO lo dice"}`);
});
await caso("esp-15-no-sale-lo-que-no-esta-pausado", "", async p => {
  for (const e of ["Salidas", "Recibida de Maquila", "Lista p/ imprimir"]) await abrir(p, e).catch(() => {});
  const t = await texto(p);
  ok("esp-15-no-sale-lo-que-no-esta-pausado", !/SIN PAUSA|PAUSA VENCIDA/.test(t) && /En espera \(10\)/.test(t), `${/SIN PAUSA|PAUSA VENCIDA/.test(t) ? "sale lo que no está pausado" : "sólo lo pausado"}; el título: «${(t.match(/En espera[^A-Za-z]{0,8}/) || ["?"])[0]}» (debe 10)`);
});

// ── vuelta 2: por donde no se diseñó (el grupo revuelto, el lote que confirma, con el teclado, lo que se mueve, el vendedor, la maquila, buscar) ──
await caso("esp-16-el-lote-en-un-grupo-revuelto-lleva-solo-las-del-taller", "caso=mezcla", async p => {
  await abrir(p, "Salidas").catch(() => {});
  const g = grupo(p, "Salidas"), b = g.getByRole("button", { name: /Reactivar las 4/ }); const hay = await b.count();
  let confirma = "";
  if (hay) { await b.click(); await espera(p); confirma = ((await g.getByRole("button", { name: /Confirmar/ }).first().innerText().catch(() => "")) || "").trim(); if (confirma) { await g.getByRole("button", { name: /Confirmar/ }).first().click(); await espera(p, 400); } }
  const l = (await lineas(p, "reactivar-lote "))[0] || "", quedan = await fichasDe(p, "Salidas");
  ok("esp-16-el-lote-en-un-grupo-revuelto-lleva-solo-las-del-taller", hay === 1 && /Confirmar · 4/.test(confirma) && /P-0640/.test(l) && /P-0643/.test(l) && !/P-0070|P-0389|P-06[0]\d/.test(l) && quedan.length === 6,
    `Salidas con 6 que esperan al cliente y 4 que corrige el cliente: ${hay ? "«Reactivar las 4»" : "sin «Reactivar las 4»"}, ${confirma ? "pide «" + confirma + "»" : "no pide confirmar"}; pidió: ${l || "nada"}; quedan ${quedan.length} (las 6 que esperan al cliente)`);
});
await caso("esp-17-el-lote-con-el-teclado", "rol=admin", async p => {
  await abrir(p, "Lista p/ imprimir").catch(() => {});
  const t = await tabHasta(p, x => /^Reactivar las 2/.test(x));
  if (t) { await p.keyboard.press("Enter"); await espera(p, 400); }
  const l = (await lineas(p, "reactivar-lote "))[0] || "";
  ok("esp-17-el-lote-con-el-teclado", !!t && /P-0620/.test(l) && /P-0621/.test(l), `con Tab ${t ? "se llega a «Reactivar las 2»" : "NO se llega al lote"}; Enter: ${l || "no pidió nada"}`);
});
await caso("esp-18-la-que-se-entrega-con-la-vista-abierta-sale", "", async p => {
  await abrir(p, "Salidas").catch(() => {});
  await p.evaluate(() => window.__cambiar("OP-P-0389", { stage: "delivered" })); await espera(p, 400);
  const s = await fichasDe(p, "Salidas"), t = await texto(p);
  ok("esp-18-la-que-se-entrega-con-la-vista-abierta-sale", !s.includes("P-0389") && /En espera \(9\)/.test(t), `P-0389 se folia y entrega con la vista abierta: ${s.includes("P-0389") ? "sigue en Salidas" : "sale"}; el título: «${(t.match(/En espera[^A-Za-zÁ-Ú]{0,8}/) || ["?"])[0].trim()}» (debe 9)`);
});
await caso("esp-19-el-vendedor-no-ve-el-contacto-ni-el-importe-de-lo-ajeno", "rol=vendedor", async p => {
  await abrir(p, "Salidas").catch(() => {});
  const suya = ((await ficha(p, "P-0070").innerText().catch(() => "")) || "").replace(/\s+/g, " "), ajena = ((await ficha(p, "P-0389").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("esp-19-el-vendedor-no-ve-el-contacto-ni-el-importe-de-lo-ajeno", /4771234567/.test(suya) && /\$21,700/.test(suya) && !/4771234567|\$9,446|Eva Martínez/.test(ajena),
    `Genaro: en la suya (P-0070) ${/4771234567/.test(suya) && /\$21,700/.test(suya) ? "ve teléfono e importe" : "NO ve teléfono o importe"}; en la de Manuel (P-0389) ${/4771234567|\$9,446|Eva Martínez/.test(ajena) ? "VE datos que no son suyos" : "no ve contacto ni importe"}`);
});
await caso("esp-20-la-maquila-recibida-dice-su-precio-al-cliente", "", async p => {
  await abrir(p, "Recibida de Maquila").catch(() => {});
  const t = ((await ficha(p, "P-0610").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("esp-20-la-maquila-recibida-dice-su-precio-al-cliente", /\$6,000/.test(t) && !/\$4,000/.test(t), `la maquila P-0610: ${/\$6,000/.test(t) ? "dice $6,000 (lo que se le cobra al cliente)" : "NO dice su precio al cliente"}${/\$4,000/.test(t) ? " y enseña el costo del maquilador ($4,000)" : ""}`);
});
await caso("esp-21-buscar-deja-solo-lo-que-coincide", "buscar=castores", async p => {
  await abrir(p, "Salidas").catch(() => {});
  const s = await fichasDe(p, "Salidas"), t = await texto(p);
  ok("esp-21-buscar-deja-solo-lo-que-coincide", s.join(",") === "P-0070" && /En espera \(1\)/.test(t) && /castores/.test(t), `buscando «castores»: ${s.join(", ") || "nada"} (debe P-0070); el título «${(t.match(/En espera[^A-Za-zÁ-Ú]{0,8}/) || ["?"])[0].trim()}»; ${/castores/.test(t) ? "dice qué se busca" : "NO dice qué se busca"}`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nespera: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
