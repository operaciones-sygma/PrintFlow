// Tratar de ROMPER «Folio por OC» (AssignOCFolioModal) en su banco. Cada caso afirma lo que DEBERÍA pasar para Karla:
// una FALLA es un bug. Las cifras salen del banco: 5 órdenes pendientes con subtotal $96,230.50 (con IVA $111,627.38),
// 2 ya facturadas (F-120, F-121). Uso: node oc.mjs <dir-capturas> [puerto=5195]
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5195);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, viewport = { width: 1366, height: 768 }) {
  const page = await browser.newPage({ viewport });
  const errs = [], nativos = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  page.on("dialog", async d => { nativos.push(d.type() + ": " + d.message().slice(0, 80)); await d.dismiss().catch(() => {}); });
  page.nativos = nativos;
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#abrir-oc");
    await page.click("#abrir-oc"); await page.waitForTimeout(800);
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png" }).catch(() => {});
  await page.close();
}
const espera = (p, ms = 300) => p.waitForTimeout(ms);
const log = async p => (await p.textContent("#log")) || "";
const cuenta = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref)).length;
// el texto de la ventana (sin el registro del banco)
const texto = p => p.evaluate(() => { const pre = document.getElementById("log"); return document.body.innerText.replace(pre ? pre.innerText : "", ""); });
// el panel de la ventana: el diálogo si lo es; si no, el contenedor del título
const panel = p => p.evaluate(() => { const h = [...document.querySelectorAll("h1,h2,h3")].find(x => /OC-1003/.test(x.textContent)); return !!h; });
const primario = p => p.getByRole("button", { name: /^(Asignar (Factura|Remisi)|Crear |Pre-asignar|Dividir en \d)/ }).last();
const aDividir = async p => { await p.getByRole("button", { name: /^Dividir( en N facturas)?$/ }).first().click(); await espera(p, 500); };
const agregarGrupo = async p => { await p.getByRole("button", { name: /Agregar otra (factura|documento)/ }).click(); await espera(p, 300); };
const preguntaAbierta = async p => (await p.getByRole("dialog").count()) >= 2 || await p.getByRole("dialog", { name: /cerrar|crear|asignar|seguro|pre-asignar/i }).count() > 0 && (await p.getByRole("dialog").count()) >= 2;
// contraste de todo el texto de la ventana: compone los fondos hacia arriba y mide contra el color del texto
// (ultimo = true: el diálogo de hasta arriba, p. ej. la pregunta antes de crear)
const peoresContrastes = (p, ultimo = false) => p.evaluate((ultimo) => {
  const h = [...document.querySelectorAll("h1,h2,h3")].find(x => /OC-1003/.test(x.textContent));
  const raiz = ultimo ? [...document.querySelectorAll('[role="dialog"]')].pop() : h ? (h.closest('[role="dialog"]') || h.parentElement) : document.body;
  const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(",").map(x => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const mezcla = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const fondo = el => { const capas = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) capas.push(c); } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = capas.length - 1; i >= 0; i--) base = mezcla(capas[i], base); return base; };
  const malos = [];
  for (const el of raiz.querySelectorAll("*")) {
    const directo = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!directo || !el.offsetParent) continue;
    if (el.closest("button:disabled") || el.closest("details:not([open])")) continue;
    const s = getComputedStyle(el); const fg0 = parse(s.color); if (!fg0) continue;
    const bg = fondo(el); const fg = fg0.a < 1 ? mezcla(fg0, bg) : fg0;
    const L1 = lum(fg), L2 = lum(bg); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(s.fontSize), grande = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight) >= 700);
    if (cr < (grande ? 3 : 4.5)) malos.push(cr.toFixed(1) + ":1 «" + el.textContent.trim().slice(0, 34) + "»");
  }
  return malos;
}, ultimo);

// ── Es un diálogo de verdad ──────────────────────────────────────────────────────────────────────────────────────────
await caso("oc-01-es-dialogo", "", async p => {
  const d = p.getByRole("dialog", { name: /folio/i });
  ok("oc-01-es-dialogo", (await d.count()) === 1 && (await d.getAttribute("aria-modal")) === "true", `diálogos con nombre «folio»: ${await d.count()}`);
});
await caso("oc-02-foco-adentro", "", async p => {
  const dentro = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  ok("oc-02-foco-adentro", dentro, `al abrir, el foco ${dentro ? "entra" : "NO entra"} al diálogo (está en ${await p.evaluate(() => document.activeElement?.tagName + " «" + (document.activeElement?.textContent || "").trim().slice(0, 20) + "»")})`);
});
await caso("oc-03-tab-no-se-sale", "", async p => {
  let fuera = 0; for (let i = 0; i < 30; i++) { await p.keyboard.press("Tab"); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) fuera++; }
  ok("oc-03-tab-no-se-sale", fuera === 0, `de 30 Tab, ${fuera} sacaron el foco del diálogo`);
});

// ── Cuánto y a quién ─────────────────────────────────────────────────────────────────────────────────────────────────
await caso("oc-04-total-factura", "", async p => {
  const t = await texto(p);
  ok("oc-04-total-factura", /\$111,627\.38/.test(t) && /PORTLAND STUDIO/.test(t), `sin tocar nada, la ventana ${/\$111,627\.38/.test(t) ? "dice" : "NO dice"} el total con IVA ($111,627.38)`);
});
await caso("oc-05-total-remision", "", async p => {
  await p.getByRole("button", { name: /^Remisión/ }).first().click(); await espera(p);
  const t = await texto(p);
  ok("oc-05-total-remision", /\$96,230\.50/.test(t) && /sin IVA/i.test(t), `en remisión ${/\$96,230\.50/.test(t) ? "dice" : "NO dice"} el total sin IVA ($96,230.50)`);
});
await caso("oc-06-dice-que-entra", "", async p => {
  const t = await texto(p);
  const faltan = ["P-0610", "P-0611", "P-0612", "P-0613", "P-0614", "Bolsa kraft"].filter(x => !t.includes(x));
  ok("oc-06-dice-que-entra", faltan.length === 0, faltan.length ? `no dice cuáles entran: falta ${faltan.join(", ")}` : "lista las 5 órdenes que entran");
});
await caso("oc-07-confirma-antes-de-crear", "", async p => {
  await primario(p).click(); await espera(p, 500);
  const llamadas = await cuenta(p, "simple:confirm");
  const dlgs = await p.getByRole("dialog").count();
  const t = await texto(p);
  ok("oc-07-confirma-antes-de-crear", llamadas === 0 && dlgs >= 2 && /\$111,627\.38/.test(t) && /PORTLAND STUDIO/.test(t),
    llamadas ? "creó al primer clic, sin preguntar" : `pregunta antes: ${dlgs >= 2 ? "sí" : "no"}, con el total: ${/\$111,627\.38/.test(t) ? "sí" : "no"}`);
});
await caso("oc-08-confirmar-cancelar-no-crea", "", async p => {
  await primario(p).click(); await espera(p, 400);
  const no = p.getByRole("button", { name: /^No, cancelar/ });
  if (await no.count()) { await no.click(); await espera(p, 300); }
  const llamadas = await cuenta(p, "simple:confirm"), abierto = await panel(p);
  ok("oc-08-confirmar-cancelar-no-crea", llamadas === 0 && abierto, `al decir que no: creó ${llamadas}, la ventana sigue abierta: ${abierto ? "sí" : "no"}`);
});
await caso("oc-09-confirmar-crea-una-vez", "", async p => {
  await primario(p).click(); await espera(p, 400);
  const si = p.getByRole("button", { name: /^Sí/ });
  if (await si.count()) await si.dblclick();
  await espera(p, 700);
  const llamadas = await cuenta(p, "simple:confirm");
  ok("oc-09-confirmar-crea-una-vez", llamadas === 1, `con doble clic en «Sí» se crearon ${llamadas} vez/veces`);
});
await caso("oc-10-dividir-confirma", "", async p => {
  await aDividir(p);
  await primario(p).click(); await espera(p, 500);
  const llamadas = await cuenta(p, "split:confirm");
  ok("oc-10-dividir-confirma", llamadas === 0 && (await p.getByRole("dialog").count()) >= 2, llamadas ? "dividir creó al primer clic, sin preguntar" : "dividir pregunta antes de crear");
});

// ── El emisor que no contesta ────────────────────────────────────────────────────────────────────────────────────────
await caso("oc-11-emisor-falla-lo-dice", "emisor=falla", async p => {
  const t = await texto(p);
  const deshab = await primario(p).isDisabled();
  ok("oc-11-emisor-falla-lo-dice", /No se pudo confirmar/i.test(t) && !/Formato inválido/i.test(t) && deshab,
    `dice que no se pudo confirmar: ${/No se pudo confirmar/i.test(t) ? "sí" : "no"}; rechaza su propia sugerencia: ${/Formato inválido/i.test(t) ? "SÍ" : "no"}; botón apagado: ${deshab ? "sí" : "no"}`);
});
await caso("oc-12-emisor-reintentar", "emisor=falla1", async p => {
  const r = p.getByRole("button", { name: /Reintentar/ });
  const hay = await r.count();
  if (hay) { await r.click(); await espera(p, 800); }
  const t = await texto(p);
  ok("oc-12-emisor-reintentar", hay > 0 && !/No se pudo confirmar/i.test(t) && !(await primario(p).isDisabled()), hay ? "con «Reintentar» se recupera" : "no hay «Reintentar»");
});
await caso("oc-13-manual-acepta-sus-series", "emisor=off", async p => {
  const campo = p.getByPlaceholder(/-XXXX|NNNN/).first();
  const antes = await primario(p).isDisabled();
  await campo.fill("F-137"); await espera(p);
  const t = await texto(p);
  ok("oc-13-manual-acepta-sus-series", !antes && !/Formato inválido|Debe ser/i.test(t), `con la sugerencia D-5781: botón ${antes ? "apagado" : "listo"}; con F-137: ${/Formato inválido|Debe ser/i.test(t) ? "lo RECHAZA" : "lo acepta"}`);
});

// ── No se pierde lo capturado ────────────────────────────────────────────────────────────────────────────────────────
await caso("oc-14-esc-pregunta-con-plan", "", async p => {
  await aDividir(p); await agregarGrupo(p);
  await p.keyboard.press("Escape"); await espera(p, 400);
  const sigue = await panel(p), pregunta = (await p.getByRole("dialog").count()) >= 2;
  ok("oc-14-esc-pregunta-con-plan", sigue && pregunta, `Esc con un plan de 2 facturas: ${sigue ? (pregunta ? "pregunta" : "no cierra pero no pregunta") : "CIERRA y lo tira"}`);
});
await caso("oc-15-clic-fuera-no-tira-el-plan", "", async p => {
  await aDividir(p); await agregarGrupo(p);
  await p.mouse.click(8, 400); await espera(p, 400);
  ok("oc-15-clic-fuera-no-tira-el-plan", await panel(p), "el clic fuera con un plan capturado " + ((await panel(p)) ? "no cierra" : "CIERRA y lo tira"));
});
await caso("oc-16-clic-fuera-sin-nada-cierra", "", async p => {
  await p.mouse.click(8, 400); await espera(p, 400);
  ok("oc-16-clic-fuera-sin-nada-cierra", !(await panel(p)), "sin nada capturado, el clic fuera " + ((await panel(p)) ? "NO cierra" : "cierra"));
});
await caso("oc-17-falla-conserva-el-plan", "falla=1", async p => {
  await aDividir(p); await agregarGrupo(p);
  // el plan de 2 grupos necesita órdenes en el segundo: se pasa una con lo que haya (mover o arrastrar)
  const mover = p.getByLabel(/Mover P-0611/);
  if (await mover.count()) { await mover.selectOption({ index: 1 }).catch(() => {}); await espera(p); }
  await primario(p).click(); await espera(p, 400);
  const si = p.getByRole("button", { name: /^Sí/ }); if (await si.count()) await si.click();
  await espera(p, 700);
  ok("oc-17-falla-conserva-el-plan", await panel(p), "si la base rechaza, la ventana " + ((await panel(p)) ? "sigue abierta con el plan" : "SE CERRÓ"));
});

// ── Dividir sin arrastrar ───────────────────────────────────────────────────────────────────────────────────────────
await caso("oc-18-mover-sin-arrastrar", "", async p => {
  await aDividir(p); await agregarGrupo(p);
  const mover = p.getByLabel(/Mover P-0611/);
  const hay = await mover.count();
  if (hay) { const opciones = await mover.locator("option").allTextContents(); const i = opciones.findIndex(o => /2/.test(o)); await mover.selectOption({ index: Math.max(0, i) }); await espera(p); }
  const t = await texto(p);
  ok("oc-18-mover-sin-arrastrar", hay > 0 && /\$14,906\.58/.test(t), hay ? `P-0611 pasó a la factura 2 (total $14,906.58): ${/\$14,906\.58/.test(t) ? "sí" : "no"}` : "no hay manera de mover una orden sin arrastrar");
});
await caso("oc-19-una-por-orden", "", async p => {
  await aDividir(p);
  const b = p.getByRole("button", { name: /Una (factura )?por orden/ });
  const hay = await b.count(); if (hay) { await b.click(); await espera(p, 400); }
  const grupos = await p.getByText(/^(Factura|Remisión) [1-9]$/).count();
  ok("oc-19-una-por-orden", hay > 0 && grupos === 5, hay ? `«Una factura por orden» armó ${grupos} grupos (deben ser 5)` : "no hay «Una factura por orden»");
});
await caso("oc-20-grupo-dice-su-tipo", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /^Remisión$/ }).first().click(); await espera(p, 400);
  const t = await texto(p);
  ok("oc-20-grupo-dice-su-tipo", /Remisión 1/.test(t) && !/Factura #1/.test(t), `el grupo de remisión se llama ${/Remisión 1/.test(t) ? "«Remisión 1»" : /Factura #1/.test(t) ? "«Factura #1»" : "?"}`);
});
await caso("oc-21-boton-en-singular", "", async p => {
  await aDividir(p);
  const t = (await primario(p).textContent()) || "";
  ok("oc-21-boton-en-singular", !/\b1 facturas/.test(t), `con un grupo el botón dice «${t.trim()}»`);
});
await caso("oc-22-cambiar-tipo-sin-confirm-nativo", "", async p => {
  await aDividir(p);
  await p.locator("summary").filter({ hasText: /Pagos/ }).first().click(); await espera(p, 300);
  await p.getByRole("button", { name: "Pagada", exact: true }).first().click(); await espera(p, 200);
  await p.getByRole("radio", { name: "Transferencia" }).first().click().catch(() => {});
  await p.getByLabel("Monto del pago 1").first().fill("111627.38").catch(() => {}); await espera(p, 200);
  await p.getByRole("button", { name: /^Remisión$/ }).first().click(); await espera(p, 400);
  const enPagina = (await p.getByRole("dialog").count()) >= 2;
  ok("oc-22-cambiar-tipo-sin-confirm-nativo", p.nativos.length === 0 && enPagina, p.nativos.length ? `usó el confirm del navegador: ${p.nativos[0]}` : `pregunta en la página: ${enPagina ? "sí" : "no"}`);
});
await caso("oc-23-quitar-dice-que", "", async p => {
  await aDividir(p);
  const etiquetas = await p.getByRole("button", { name: /^Quitar/ }).evaluateAll(bs => bs.map(b => b.getAttribute("aria-label") || ""));
  ok("oc-23-quitar-dice-que", etiquetas.length > 0 && etiquetas.every(e => /P-06\d\d/.test(e)), `nombres de «quitar»: ${etiquetas.slice(0, 2).join(" | ")}`);
});
await caso("oc-24-fichas-no-estiradas", "", async p => {
  await aDividir(p);
  // estirada = más alta que lo que lleva adentro (antes: 80 px de una línea de 14). Lo que lleva adentro puede ser 2 renglones.
  const m = await p.getByText(/^#?P-0610$/).first().evaluate(el => { const ficha = el.closest('[draggable="true"]') || el.parentElement;
    const alto = ficha.getBoundingClientRect().height; const rs = [...ficha.children].map(c => c.getBoundingClientRect());
    const contenido = Math.max(...rs.map(r => r.bottom)) - Math.min(...rs.map(r => r.top));   // de arriba del primero a abajo del último
    return { alto: Math.round(alto), contenido: Math.round(contenido) }; });
  ok("oc-24-fichas-no-estiradas", m.alto - m.contenido <= 14, `una ficha mide ${m.alto} px y lo que lleva adentro ${m.contenido} px`);
});

// ── Se ve y se lee ───────────────────────────────────────────────────────────────────────────────────────────────────
await caso("oc-25-pie-fijo-corona", "cliente=corona", async p => {
  await aDividir(p);
  const b = await primario(p).boundingBox();
  ok("oc-25-pie-fijo-corona", !!b && b.y + b.height <= 768, `a 1366x768 con Corona en dividir, el botón termina en y=${b ? Math.round(b.y + b.height) : "?"} (pantalla 768)`);
});
await caso("oc-26-contraste-simple", "", async p => { const m = await peoresContrastes(p); ok("oc-26-contraste-simple", m.length === 0, m.slice(0, 4).join(" · ") || "todo ≥ 4.5:1"); });
await caso("oc-27-contraste-pre", "pre=1", async p => { const m = await peoresContrastes(p); ok("oc-27-contraste-pre", m.length === 0, m.slice(0, 4).join(" · ") || "todo ≥ 4.5:1"); });
await caso("oc-28-contraste-traslado", "cliente=cuadra&traslado=no", async p => { const m = await peoresContrastes(p); ok("oc-28-contraste-traslado", m.length === 0, m.slice(0, 4).join(" · ") || "todo ≥ 4.5:1"); });
await caso("oc-29-contraste-dividir", "cliente=corona", async p => {
  await aDividir(p);
  const quitar = p.getByRole("button", { name: /^Quitar/ }).first(); if (await quitar.count()) { await quitar.click(); await espera(p); }   // deja una sin asignar: sale el aviso
  const m = await peoresContrastes(p); ok("oc-29-contraste-dividir", m.length === 0, m.slice(0, 4).join(" · ") || "todo ≥ 4.5:1");
});
await caso("oc-30-contraste-folio-malo", "emisor=off", async p => {
  await p.getByPlaceholder(/-XXXX|NNNN/).first().fill("D-01"); await espera(p);
  const m = await peoresContrastes(p); ok("oc-30-contraste-folio-malo", m.length === 0, m.slice(0, 4).join(" · ") || "todo ≥ 4.5:1");
});
await caso("oc-31-todo-en-geist", "", async p => {
  await aDividir(p);
  const malos = await p.evaluate(() => { const d = [...document.querySelectorAll("h3")].find(x => /OC-1003/.test(x.textContent)); const raiz = d ? (d.closest('[role="dialog"]') || d.parentElement) : document.body;
    return [...raiz.querySelectorAll("button,input,textarea,select")].filter(b => !/geist/i.test(getComputedStyle(b).fontFamily)).map(b => "«" + (b.textContent || b.placeholder || b.tagName).trim().slice(0, 16) + "»"); });
  ok("oc-31-todo-en-geist", malos.length === 0, malos.length ? `${malos.length} controles fuera de Geist: ${malos.slice(0, 5).join(" ")}` : "todos los controles en Geist");
});
await caso("oc-32-sin-emojis", "cliente=cuadra&traslado=no", async p => {
  const t1 = await texto(p); await aDividir(p); const t2 = await texto(p);
  const em = ((t1 + t2).match(/\p{Extended_Pictographic}/gu) || []);
  ok("oc-32-sin-emojis", em.length === 0, em.length ? `emojis en la ventana: ${[...new Set(em)].join(" ")}` : "sin emojis");
});
await caso("oc-33-textos-de-hoy", "cliente=corona&emisor=off", async p => {
  const t1 = await texto(p); await aDividir(p); const t2 = await texto(p); const t = t1 + t2;
  const malos = ["bridge", "v10.", "inmutables", "Karla", "AlphaERP", "(D-)", "(R-)", "Factura #"].filter(x => t.includes(x));
  ok("oc-33-textos-de-hoy", malos.length === 0, malos.length ? `dice: ${malos.join(", ")}` : "sin jerga ni nombres de otro tiempo");
});
await caso("oc-34-corona-no-es-dinero", "cliente=corona", async p => {
  await aDividir(p);
  const t = await texto(p);
  ok("oc-34-corona-no-es-dinero", /no es dinero del cliente/i.test(t), "lo facturado por adelantado " + (/no es dinero del cliente/i.test(t) ? "dice que no es dinero del cliente" : "NO dice que no es dinero del cliente"));
});

// ── Lo que falta, dicho ──────────────────────────────────────────────────────────────────────────────────────────────
await caso("oc-35-pre-razon", "pre=1", async p => {
  const borde = await p.locator("textarea").first().evaluate(el => getComputedStyle(el).borderColor + " " + getComputedStyle(el).boxShadow);
  const rojo = /224, 59, 48|185, 28, 28|e03b30/i.test(borde);
  const t = await texto(p);
  ok("oc-35-pre-razon", !rojo && /razón/i.test(t) && await primario(p).isDisabled(), `antes de escribir, el campo ${rojo ? "sale en ROJO" : "no sale en rojo"}; el botón apagado y dice que falta la razón`);
});
await caso("oc-36-tercero-a-medias-dice", "", async p => {
  await p.click("#tercero-medias"); await espera(p);
  // fuera del simulado del banco («Facturar a un tercero (simulado)», «tercero a medias», «tercero listo»)
  const t = (await texto(p)).replace(/Facturar a un tercero \(simulado\)|tercero a medias|tercero listo/g, "");
  const dice = /tercero/i.test(t);
  ok("oc-36-tercero-a-medias-dice", await primario(p).isDisabled() && dice, "con un tercero a medias, el botón se apaga " + (dice ? "y dice por qué" : "SIN decir por qué"));
});
await caso("oc-37-sin-pendientes", "ordenes=0", async p => {
  const t = await texto(p);
  ok("oc-37-sin-pendientes", await primario(p).isDisabled() && /no (hay|quedan|queda)[^.]*(pendiente|por facturar|sin folio)/i.test(t), "sin órdenes pendientes, la ventana " + (/no (hay|quedan|queda)[^.]*(pendiente|por facturar|sin folio)/i.test(t) ? "lo dice" : "NO lo dice"));
});
await caso("oc-38-tablet-sin-scroll-lateral", "", async p => {
  await aDividir(p); await agregarGrupo(p); await agregarGrupo(p);
  const sobra = await p.evaluate(() => { const d = [...document.querySelectorAll("h3")].find(x => /OC-1003/.test(x.textContent)); const raiz = d ? (d.closest('[role="dialog"]') || d.parentElement) : document.body;
    return [...raiz.querySelectorAll("*")].filter(el => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== "visible").length + (document.documentElement.scrollWidth > innerWidth ? 1 : 0); });
  ok("oc-38-tablet-sin-scroll-lateral", sobra === 0, `a 834 px con 3 grupos, ${sobra} contenedor(es) con scroll lateral`);
}, { width: 834, height: 1112 });
await caso("oc-39-1920", "", async p => {
  const t = await texto(p);
  ok("oc-39-1920", /\$111,627\.38/.test(t), "a 1920 el total " + (/\$111,627\.38/.test(t) ? "se ve" : "NO se ve"));
}, { width: 1920, height: 1080 });

// ── Tercera vuelta: por donde NO se diseñó ───────────────────────────────────────────────────────────────────────────
await caso("oc-40-doble-clic-una-pregunta", "", async p => {
  await primario(p).dblclick(); await espera(p, 400);
  const n = await p.getByRole("dialog").count();
  ok("oc-40-doble-clic-una-pregunta", n === 2, `doble clic en el botón principal: ${n} diálogos abiertos (deben ser 2: la ventana y una pregunta)`);
});
await caso("oc-41-esc-cierra-solo-la-pregunta", "", async p => {
  await primario(p).click(); await espera(p, 300);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const n = await p.getByRole("dialog").count();
  ok("oc-41-esc-cierra-solo-la-pregunta", n === 1 && await panel(p), `Esc con la pregunta abierta deja ${n} diálogo(s) (debe quedar la ventana)`);
});
await caso("oc-42-esc-mientras-guarda", "", async p => {
  await primario(p).click(); await espera(p, 300);
  await p.getByRole("button", { name: /^Sí/ }).click();
  await p.keyboard.press("Escape"); await espera(p, 60);
  const pregunta = await p.getByRole("dialog", { name: /Cerrar sin asignar/ }).count();
  await espera(p, 600);
  ok("oc-42-esc-mientras-guarda", pregunta === 0 && (await cuenta(p, "simple:confirm")) === 1, `Esc mientras crea: ${pregunta ? "PREGUNTA si cerrar" : "no hace nada"}; creó ${await cuenta(p, "simple:confirm")}`);
});
await caso("oc-43-una-por-orden-con-pagos-pregunta", "", async p => {
  await aDividir(p);
  await p.locator("summary").filter({ hasText: /Pagos/ }).first().click(); await espera(p, 300);
  await p.getByRole("button", { name: "Pagada", exact: true }).first().click(); await espera(p, 200);
  await p.getByRole("radio", { name: "Transferencia" }).first().click().catch(() => {});
  await p.getByLabel("Monto del pago 1").first().fill("111627.38").catch(() => {}); await espera(p, 200);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  const preg = (await p.getByRole("dialog").count()) >= 2;
  ok("oc-43-una-por-orden-con-pagos-pregunta", preg && p.nativos.length === 0, `con un pago capturado, «Una factura por orden» ${preg ? "pregunta" : "NO pregunta"} antes de borrarlo`);
});
await caso("oc-44-manual-una-por-orden-folios", "emisor=off", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 400);
  const folios = await p.getByLabel(/^Folio de Factura/).evaluateAll(xs => xs.map(x => x.value));
  ok("oc-44-manual-una-por-orden-folios", folios.join(",") === "D-5781,D-5782,D-5783,D-5784,D-5785" && !(await primario(p).isDisabled()), `a mano, «una por orden» sugiere ${folios.join(", ")}`);
});
await caso("oc-45-folio-repetido-lo-dice", "emisor=off", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 400);
  await p.getByLabel("Folio de Factura 2").fill("D-5781"); await espera(p);
  const t = await texto(p);
  ok("oc-45-folio-repetido-lo-dice", /D-5781 está repetido/.test(t) && await primario(p).isDisabled(), /repetido/.test(t) ? "dice que el folio está repetido y no deja crear" : "no dice que el folio está repetido");
});
await caso("oc-46-documento-vacio-lo-dice", "", async p => {
  await aDividir(p); await agregarGrupo(p);
  const t = await texto(p);
  ok("oc-46-documento-vacio-lo-dice", /Factura 2 no tiene órdenes/.test(t) && await primario(p).isDisabled(), /no tiene órdenes/.test(t) ? "dice cuál documento está vacío" : "no dice qué documento está vacío");
});
await caso("oc-47-eliminar-documento-regresa-ordenes", "", async p => {
  await aDividir(p); await agregarGrupo(p);
  await p.getByLabel(/Mover P-0611/).selectOption({ index: 1 }); await espera(p);
  await p.getByRole("button", { name: "Eliminar Factura 2" }).click(); await espera(p, 300);
  const t = await texto(p);
  ok("oc-47-eliminar-documento-regresa-ordenes", /\$111,627\.38 con IVA/.test(t.replace(/\s+/g, " ")) || /Total \$111,627\.38/.test(t), "al eliminar la Factura 2, su orden " + (/111,627\.38/.test(t) ? "regresa a la Factura 1" : "SE PIERDE"));
});
await caso("oc-48-pre-asignar-completo", "pre=1", async p => {
  await p.locator("textarea").first().fill("Reserva fiscal de fin de mes"); await espera(p);
  const etiqueta = (await primario(p).textContent()) || "";
  await primario(p).click(); await espera(p, 300);
  const t = await texto(p);
  ok("oc-48-pre-asignar-completo", /^Pre-asignar la factura/.test(etiqueta.trim()) && /¿Pre-asignar la factura de OC-1003\?/.test(t) && /bloqueada/.test(t), `botón «${etiqueta.trim()}»; la pregunta ${/bloqueada/.test(t) ? "avisa" : "NO avisa"} que la OC queda bloqueada`);
});
await caso("oc-49-tercero-en-la-pregunta", "", async p => {
  await p.click("#tercero-listo"); await espera(p);
  const vista = await texto(p);
  await primario(p).click(); await espera(p, 300);
  const t = await texto(p);
  ok("oc-49-tercero-en-la-pregunta", /a TERCERO SA/.test(vista) && /TERCERO SA \(TSA010101AAA\)/.test(t), `la vista previa ${/a TERCERO SA/.test(vista) ? "va" : "NO va"} a TERCERO SA y la pregunta ${/TSA010101AAA/.test(t) ? "dice su RFC" : "NO dice su RFC"}`);
});
await caso("oc-50-traslado-en-la-pregunta", "cliente=cuadra", async p => {
  await p.getByRole("checkbox").first().check(); await espera(p);
  await primario(p).click(); await espera(p, 300);
  const t = await texto(p);
  ok("oc-50-traslado-en-la-pregunta", /traslado a Cuadra Silao/.test(t), "la pregunta " + (/traslado a Cuadra Silao/.test(t) ? "dice que también se timbra el traslado" : "NO dice que se timbra el traslado"));
});
await caso("oc-51-una-por-producto-a-mano", "emisor=off", async p => {
  await p.getByRole("button", { name: /Una por producto/ }).click(); await espera(p);
  const vista = await texto(p);
  await primario(p).click(); await espera(p, 300);
  const t = await texto(p);
  ok("oc-51-una-por-producto-a-mano", /D-5781, D-5782, D-5783, D-5784, D-5785/.test(vista) && /Folios D-5781 a D-5785/.test(t) && /5 facturas/.test(t), "una por producto a mano: " + (/Folios D-5781 a D-5785/.test(t) ? "la pregunta dice los 5 folios" : "la pregunta NO dice los folios"));
});
await caso("oc-52-mas-de-seis", "ordenes=8", async p => {
  const antes = await texto(p);
  const ver = p.getByRole("button", { name: /^Ver las 8/ });
  const hay = await ver.count(); if (hay) { await ver.click(); await espera(p); }
  const despues = await texto(p);
  ok("oc-52-mas-de-seis", hay > 0 && !/P-0617/.test(antes) && /P-0617/.test(despues), hay ? "con 8 órdenes enseña 6 y «Ver las 8» enseña todas" : "con 8 órdenes no hay «Ver las 8»");
});
await caso("oc-53-pie-a-la-vista-cuadra", "cliente=cuadra&traslado=listo", async p => {
  await p.click("#tercero-listo"); await espera(p);
  const b = await primario(p).boundingBox();
  ok("oc-53-pie-a-la-vista-cuadra", !!b && b.y + b.height <= 768, `a 1366x768 con tercero y traslado, el botón termina en y=${b ? Math.round(b.y + b.height) : "?"}`);
});
await caso("oc-54-dividir-con-teclado", "", async p => {
  await aDividir(p);
  const sel = p.getByLabel("Mover P-0611 a");
  await sel.focus(); await p.keyboard.press("ArrowDown"); await espera(p, 300);
  const t = await texto(p);
  ok("oc-54-dividir-con-teclado", /1 orden sin documento/.test(t), "con el teclado (flecha abajo en «Mover a») P-0611 " + (/1 orden sin documento/.test(t) ? "sale del documento" : "NO se mueve"));
});
await caso("oc-55-falla-simple-conserva", "falla=1&emisor=off", async p => {
  await p.getByPlaceholder(/NNNN/).first().fill("D-5790"); await espera(p);
  await primario(p).click(); await espera(p, 300);
  await p.getByRole("button", { name: /^Sí/ }).click(); await espera(p, 600);
  const valor = await p.getByPlaceholder(/NNNN/).first().inputValue().catch(() => "");
  ok("oc-55-falla-simple-conserva", await panel(p) && valor === "D-5790" && /toast:error/.test(await log(p)), `si la base rechaza: la ventana ${await panel(p) ? "sigue" : "SE CERRÓ"} y el folio ${valor === "D-5790" ? "se conserva" : "SE PERDIÓ"}`);
});

// ── Segunda pasada de la critique (30/40): lo que la separa de 35 ─────────────────────────────────────────────────────
// el fondo REAL de cada botón visible del diálogo (compuesto hacia arriba) y su luminancia: «relleno» = oscuro o saturado
const botonesRellenos = p => p.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(",").map(x => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const mezcla = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const fondo = el => { const capas = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) capas.push(c); } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = capas.length - 1; i >= 0; i--) base = mezcla(capas[i], base); return base; };
  return [...dlg.querySelectorAll("button")].filter(b => b.offsetParent && !b.disabled && b.textContent.trim())
    .map(b => ({ t: b.textContent.trim().slice(0, 30), l: lum(fondo(b)) })).filter(x => x.l < 0.4).map(x => x.t);
});
// el estilo de «seleccionado» de un botón: su fondo y su borde
const estiloDe = (loc) => loc.evaluate(b => { const s = getComputedStyle(b); return s.backgroundColor + " | " + s.borderTopColor; });
const rojizo = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return false; const [r, g, b] = m[1].split(",").map(Number); return r > g + 50 && r > b + 50; };
const bordeDeTarjeta = (p, nombre) => p.evaluate(n => { const g = document.querySelector(`[aria-label="Tipo de ${n}"]`); const card = g && g.parentElement; return card ? getComputedStyle(card).borderTopColor : null; }, nombre);
// ¿se ve sin bajar? (dentro de lo visible del cuerpo que hace scroll)
const aLaVista = (p, sel) => p.evaluate(s => { const el = typeof s === "string" ? document.querySelector(s) : null; if (!el) return null;
  let c = el.parentElement; while (c && !/(auto|scroll)/.test(getComputedStyle(c).overflowY)) c = c.parentElement;
  const r = el.getBoundingClientRect(), v = c ? c.getBoundingClientRect() : { top: 0, bottom: innerHeight };
  return r.top >= v.top - 1 && r.bottom <= v.bottom + 1; }, sel);
const capturarPago = async (p, i) => {
  await p.locator("summary").filter({ hasText: /Pagos/ }).nth(i).click(); await espera(p, 300);
  await p.getByRole("button", { name: "Pagada", exact: true }).first().click(); await espera(p, 200);
  await p.getByRole("radio", { name: "Transferencia" }).first().click().catch(() => {});
  await p.getByLabel("Monto del pago 1").first().fill("14906.58").catch(() => {}); await espera(p, 200);
};

await caso("oc-56-solo-la-accion-rellena", "", async p => {
  const rellenos = await botonesRellenos(p);
  ok("oc-56-solo-la-accion-rellena", rellenos.length === 1 && /^Crear la factura/.test(rellenos[0]), `botones rellenos: ${rellenos.join(" | ")}`);
});
await caso("oc-57-seleccionado-igual-en-los-dos-modos", "", async p => {
  const simple = await estiloDe(p.getByRole("group", { name: "Tipo de documento" }).getByRole("button", { name: /Factura/ }));
  await aDividir(p);
  const dividir = await estiloDe(p.getByRole("group", { name: "Tipo de Factura 1" }).getByRole("button", { name: /Factura/ }));
  ok("oc-57-seleccionado-igual-en-los-dos-modos", simple === dividir, `«Factura» seleccionada: en Simple ${simple} · en Dividir ${dividir}`);
});
await caso("oc-58-razon-a-la-vista", "pre=1", async p => {
  const v = await aLaVista(p, "#oc-razon");
  ok("oc-58-razon-a-la-vista", v === true, `a 1366x768, la razón de la pre-asignación (obligatoria) ${v === null ? "no existe" : v ? "se ve al abrir" : "queda bajo el pliegue"}`);
});
await caso("oc-59-eliminar-con-pagos-pregunta", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await capturarPago(p, 1);
  await p.getByRole("button", { name: "Eliminar Factura 2" }).click(); await espera(p, 400);
  const preg = (await p.getByRole("dialog").count()) >= 2;
  const sigue = await p.getByRole("group", { name: "Tipo de Factura 5" }).count();
  ok("oc-59-eliminar-con-pagos-pregunta", preg && sigue === 1, `eliminar Factura 2 con un pago capturado: ${preg ? "pregunta" : "NO pregunta"}${sigue ? "" : " y ya la borró"}`);
});
await caso("oc-60-eliminar-sin-pagos-no-pregunta", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await p.getByRole("button", { name: "Eliminar Factura 2" }).click(); await espera(p, 400);
  const preg = (await p.getByRole("dialog").count()) >= 2;
  const quedan = await p.getByRole("group", { name: /^Tipo de Factura \d$/ }).count();
  ok("oc-60-eliminar-sin-pagos-no-pregunta", !preg && quedan === 4, `sin pagos: ${preg ? "PREGUNTA" : "no pregunta"}, quedan ${quedan} documentos`);
});
await caso("oc-61-reintentar-en-dividir", "emisor=falla", async p => {
  await aDividir(p);
  const hay = await p.getByRole("button", { name: /Reintentar/ }).count();
  const t = await texto(p); const veces = (t.match(/falta confirmar/gi) || []).length;
  ok("oc-61-reintentar-en-dividir", hay === 1 && veces <= 2, `en Dividir, si no se pudo saber cómo va el folio: «Reintentar» ${hay ? "está" : "NO está"}; «falta confirmar» sale ${veces} veces`);
});
await caso("oc-62-folio-del-sistema-una-vez", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  const veces = ((await texto(p)).match(/el sistema/gi) || []).length;   // «El sistema pone el folio», «Los folios los pone el sistema»…
  ok("oc-62-folio-del-sistema-una-vez", veces === 1, `con 5 documentos, «el sistema pone el folio» se dice ${veces} veces`);
});
await caso("oc-63-agregar-a-la-vista", "", async p => {
  await aDividir(p);
  const v = await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /Agregar otra/.test(x.textContent)); if (!b) return null; b.id = b.id || "boton-agregar"; return b.id; });
  const vis = v ? await aLaVista(p, "#" + v) : null;
  ok("oc-63-agregar-a-la-vista", vis === true, `a 1366x768 con un documento, «Agregar otra factura» ${vis === null ? "no existe" : vis ? "se ve" : "queda bajo el pliegue"}`);
});
await caso("oc-64-pregunta-mismo-sustantivo", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  const boton = ((await primario(p).textContent()) || "").trim();
  await primario(p).click(); await espera(p, 400);
  const titulo = ((await p.getByRole("dialog").last().locator("h3").textContent()) || "").trim();
  const si = ((await p.getByRole("button", { name: /^Sí/ }).textContent()) || "").trim();
  ok("oc-64-pregunta-mismo-sustantivo", /5 facturas/.test(boton) && /5 facturas/.test(titulo) && /5 facturas/.test(si), `botón «${boton}» · pregunta «${titulo}» · «${si}»`);
});
await caso("oc-65-pregunta-importes-alineados", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await primario(p).click(); await espera(p, 400);
  const bordes = await p.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
    return ["$66,004.00", "$14,906.58", "$3,944.00", "$1,136.80", "$25,636.00"].map(s => {
      const w = document.createTreeWalker(dlg, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const i = n.textContent.indexOf(s); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + s.length); return Math.round(r.getBoundingClientRect().right); } }
      return null; });
  });
  const ok2 = bordes.every(x => x !== null) && Math.max(...bordes) - Math.min(...bordes) <= 2;
  ok("oc-65-pregunta-importes-alineados", ok2, `borde derecho de cada importe en la pregunta: ${bordes.join(", ")}`);
});
await caso("oc-66-pregunta-dice-productos", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await primario(p).click(); await espera(p, 400);
  const t = (await p.getByRole("dialog").last().textContent()) || "";
  ok("oc-66-pregunta-dice-productos", /Bolsa kraft/.test(t) && /Stickers/.test(t), "la pregunta de dividir " + (/Bolsa kraft/.test(t) ? "dice" : "NO dice") + " qué producto va en cada documento");
});
await caso("oc-67-folio-repetido-se-marca", "emisor=off", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await p.getByLabel("Folio de Factura 2").fill("D-5781"); await espera(p, 300);
  const b1 = await p.getByLabel("Folio de Factura 1").evaluate(x => getComputedStyle(x).borderTopColor);
  const b2 = await p.getByLabel("Folio de Factura 2").evaluate(x => getComputedStyle(x).borderTopColor);
  ok("oc-67-folio-repetido-se-marca", rojizo(b1) && rojizo(b2), `D-5781 en Factura 1 y 2: bordes ${b1} y ${b2}`);
});
await caso("oc-68-documento-vacio-se-marca", "", async p => {
  await aDividir(p);
  await agregarGrupo(p);
  const borde = await bordeDeTarjeta(p, "Factura 2");
  ok("oc-68-documento-vacio-se-marca", rojizo(borde), `Factura 2 sin órdenes (el pie lo dice): su borde es ${borde}`);
});
await caso("oc-69-textos-de-hoy", "pre=1", async p => {
  let t = await texto(p);
  await aDividir(p); t += "\n" + await texto(p);
  const malos = ["ciclo fiscal", "emisión SYGMA", "las facturas con IVA"].filter(s => t.includes(s));
  ok("oc-69-textos-de-hoy", malos.length === 0, malos.length ? "dice: " + malos.join(" · ") : "sin textos viejos");
});
await caso("oc-70-encabezado-dividir", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  const t = await texto(p);
  ok("oc-70-encabezado-dividir", /en 5 facturas/.test(t), "encabezado: «" + ((t.match(/Total[^\n]*/) || [""])[0]) + "»");
});

// ── Tercera vuelta de la segunda pasada: por donde NO se diseñó ───────────────────────────────────────────────────────
await caso("oc-71-eliminar-con-pagos-arrepentirse", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await capturarPago(p, 1);
  await p.getByRole("button", { name: "Eliminar Factura 2" }).click(); await espera(p, 300);
  await p.getByRole("button", { name: /^No, cancelar/ }).click(); await espera(p, 300);
  await p.getByRole("button", { name: "Eliminar Factura 2" }).click(); await espera(p, 300);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const docs = await p.getByRole("group", { name: /^Tipo de Factura \d$/ }).count();
  const dialogos = await p.getByRole("dialog").count();
  const pagos = await p.locator("summary").filter({ hasText: /Pagos \(1\)/ }).count();
  ok("oc-71-eliminar-con-pagos-arrepentirse", docs === 5 && dialogos === 1 && pagos === 1, `«No» y luego Esc en la pregunta: quedan ${docs} documentos, ${dialogos} diálogo(s) abiertos y ${pagos} documento con su pago`);
});
await caso("oc-72-eliminar-con-pagos-confirmado", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await capturarPago(p, 1);
  await p.getByRole("button", { name: "Eliminar Factura 2" }).click(); await espera(p, 300);
  await p.getByRole("button", { name: /^Eliminar y borrar/ }).click(); await espera(p, 300);
  const docs = await p.getByRole("group", { name: /^Tipo de Factura \d$/ }).count();
  const enLaPrimera = await p.evaluate(() => { const g = document.querySelector('[aria-label="Tipo de Factura 1"]'); return !!g && /P-0611/.test(g.parentElement.textContent); });
  ok("oc-72-eliminar-con-pagos-confirmado", docs === 4 && enLaPrimera, `confirmado: quedan ${docs} documentos; P-0611 ${enLaPrimera ? "pasó" : "NO pasó"} a Factura 1`);
});
await caso("oc-73-eliminar-la-primera-dice-a-cual", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await capturarPago(p, 0);
  await p.getByRole("button", { name: "Eliminar Factura 1" }).click(); await espera(p, 300);
  const t = (await p.getByRole("dialog").last().textContent()) || "";
  ok("oc-73-eliminar-la-primera-dice-a-cual", /pasa a Factura 2/.test(t), "al eliminar Factura 1, la pregunta dice: «" + (t.match(/Su orden[^.]*\./) || ["(nada)"])[0] + "»");
});
await caso("oc-74-folio-repetido-se-desmarca", "emisor=off", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await p.getByLabel("Folio de Factura 2").fill("d-5781"); await espera(p, 300);
  const marcado = rojizo(await p.getByLabel("Folio de Factura 1").evaluate(x => getComputedStyle(x).borderTopColor));
  await p.getByLabel("Folio de Factura 2").fill("D-5786"); await espera(p, 300);
  const b1 = await p.getByLabel("Folio de Factura 1").evaluate(x => getComputedStyle(x).borderTopColor);
  const pie = await texto(p);
  ok("oc-74-folio-repetido-se-desmarca", marcado && !rojizo(b1) && !/repetido/.test(pie), `«d-5781» (minúscula) ${marcado ? "se marca" : "NO se marca"}; arreglado a D-5786: ${rojizo(b1) ? "SIGUE marcado" : "se desmarca"}`);
});
await caso("oc-75-soltar-en-agregar", "", async p => {
  await aDividir(p);
  const ficha = p.getByLabel("Mover P-0612 a").locator("xpath=ancestor::div[@draggable='true']");
  // se toma la ficha del P-número: su centro cae en el «Mover a…», y ahí un clic abre la lista en vez de arrastrar
  await ficha.dragTo(p.getByRole("button", { name: /Agregar otra factura/ }), { sourcePosition: { x: 14, y: 10 } }); await espera(p, 400);
  const enLaNueva = await p.evaluate(() => { const g = document.querySelector('[aria-label="Tipo de Factura 2"]'); return !!g && /P-0612/.test(g.parentElement.textContent); });
  ok("oc-75-soltar-en-agregar", enLaNueva, "arrastrar P-0612 a «Agregar otra factura» " + (enLaNueva ? "la pone en un documento nuevo" : "NO crea un documento con ella"));
});
await caso("oc-76-reintentar-en-dividir-recupera", "emisor=falla2", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Reintentar/ }).click(); await espera(p, 600);
  const t = await texto(p);
  ok("oc-76-reintentar-en-dividir-recupera", /asigna el sistema/.test(t) && !(await primario(p).isDisabled()), "en Dividir, «Reintentar» " + (/asigna el sistema/.test(t) ? "recupera" : "NO recupera") + " cómo va el folio");
});
await caso("oc-77-razon-sigue-al-cambiar-de-modo", "pre=1", async p => {
  await p.fill("#oc-razon", "Pago adelantado del cliente"); await espera(p);
  await aDividir(p);
  const v = await p.inputValue("#oc-razon").catch(() => "");
  const vis = await aLaVista(p, "#oc-razon");
  ok("oc-77-razon-sigue-al-cambiar-de-modo", v === "Pago adelantado del cliente" && vis === true, `en Dividir la razón ${v ? "sigue" : "SE PERDIÓ"} y ${vis ? "se ve" : "no se ve"}`);
});
await caso("oc-78-una-por-producto-pregunta-con-lista", "", async p => {
  await p.getByRole("button", { name: /Una por producto/ }).click(); await espera(p);
  await primario(p).click(); await espera(p, 400);
  const bordes = await p.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
    return ["$66,004.00", "$14,906.58", "$3,944.00", "$1,136.80", "$25,636.00", "$111,627.38"].map(s => {
      const w = document.createTreeWalker(dlg, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const i = n.textContent.indexOf(s); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + s.length); return Math.round(r.getBoundingClientRect().right); } }
      return null; });
  });
  const ok2 = bordes.every(x => x !== null) && Math.max(...bordes) - Math.min(...bordes) <= 2;
  ok("oc-78-una-por-producto-pregunta-con-lista", ok2, `«una por producto»: borde derecho de los 5 importes y el total: ${bordes.join(", ")}`);
});
await caso("oc-79-mezcla-dice-documentos", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await p.getByRole("group", { name: "Tipo de Factura 2" }).getByRole("button", { name: /Remisión/ }).click(); await espera(p, 300);
  const t = await texto(p);
  const boton = ((await primario(p).textContent()) || "").trim();
  await primario(p).click(); await espera(p, 400);
  const preg = (await p.getByRole("dialog").last().textContent()) || "";
  ok("oc-79-mezcla-dice-documentos", /en 5 documentos \(facturas con IVA, remisiones sin IVA\)/.test(t) && /5 documentos/.test(boton) && /5 documentos/.test(preg) && /remisiones, sin IVA/.test(preg),
    `con una remisión: encabezado «${(t.match(/Total[^\n]*/) || [""])[0]}», botón «${boton}», la pregunta ${/remisiones, sin IVA/.test(preg) ? "explica el IVA" : "NO explica el IVA"}`);
});
await caso("oc-80-vacio-se-desmarca", "", async p => {
  await aDividir(p);
  await agregarGrupo(p);
  await p.getByLabel("Mover P-0611 a").selectOption({ label: "a Factura 2" }); await espera(p, 300);
  const b1 = await bordeDeTarjeta(p, "Factura 1"), b2 = await bordeDeTarjeta(p, "Factura 2");
  ok("oc-80-vacio-se-desmarca", !rojizo(b1) && !rojizo(b2) && !(await primario(p).isDisabled()), `con P-0611 en Factura 2: bordes ${b1} y ${b2}`);
});
await caso("oc-81-contraste-de-la-pregunta", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await primario(p).click(); await espera(p, 400);
  const malos = await peoresContrastes(p, true);
  ok("oc-81-contraste-de-la-pregunta", malos.length === 0, malos.length ? "en la pregunta: " + malos.slice(0, 4).join(" · ") : "la pregunta se lee (≥ 4.5:1)");
});

// ── Cuarta vuelta: lo que se arrastra y se borra ─────────────────────────────────────────────────────────────────────
await caso("oc-82-eliminar-dice-remision", "", async p => {
  await aDividir(p);
  await agregarGrupo(p);
  await p.getByLabel("Mover P-0614 a").selectOption({ label: "a Factura 2" }); await espera(p, 300);
  await p.getByRole("group", { name: "Tipo de Factura 2" }).getByRole("button", { name: /Remisión/ }).click(); await espera(p, 300);
  await capturarPago(p, 0);
  await p.getByRole("button", { name: "Eliminar Factura 1" }).click(); await espera(p, 300);
  const t = (await p.getByRole("dialog").last().textContent()) || "";
  ok("oc-82-eliminar-dice-remision", /pasan a Remisión 2/.test(t), "eliminar Factura 1 con la otra siendo remisión: «" + (t.match(/Sus? [^.]*pasan? a[^.]*\./) || ["(nada)"])[0] + "»");
});
await caso("oc-83-soltar-la-ultima-deja-vacio-marcado", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  const ficha = p.getByLabel("Mover P-0612 a").locator("xpath=ancestor::div[@draggable='true']");
  await ficha.dragTo(p.getByRole("button", { name: /Agregar otra factura/ }), { sourcePosition: { x: 14, y: 10 } }); await espera(p, 400);
  const borde = await bordeDeTarjeta(p, "Factura 3");
  const pie = await texto(p);
  ok("oc-83-soltar-la-ultima-deja-vacio-marcado", rojizo(borde) && /Factura 3 no tiene órdenes/.test(pie) && await primario(p).isDisabled(), `Factura 3 se quedó sin órdenes: borde ${borde}; el pie ${/Factura 3 no tiene/.test(pie) ? "lo dice" : "NO lo dice"}`);
});
await caso("oc-84-documento-nuevo-a-mano-se-marca", "emisor=off", async p => {
  await aDividir(p);
  await agregarGrupo(p);
  const borde = await bordeDeTarjeta(p, "Factura 2");
  const pie = await texto(p);
  ok("oc-84-documento-nuevo-a-mano-se-marca", rojizo(borde) && /Factura 2/.test(pie), `a mano, el documento nuevo: borde ${borde}; el pie ${/Factura 2/.test(pie) ? "lo nombra" : "NO lo nombra"}`);
});
await caso("oc-85-doble-clic-en-eliminar", "", async p => {
  await aDividir(p);
  await p.getByRole("button", { name: /Una factura por orden/ }).click(); await espera(p, 300);
  await p.getByRole("button", { name: "Eliminar Factura 2" }).dblclick(); await espera(p, 500);
  const quedan = await p.getByRole("group", { name: /^Tipo de Factura \d$/ }).count();
  ok("oc-85-doble-clic-en-eliminar", quedan === 4, `doble clic en la papelera de Factura 2: quedan ${quedan} documentos (debería borrar uno)`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\noc: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
