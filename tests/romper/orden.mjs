// Tratar de ROMPER la forma de la orden (OrderForm: crear y editar) en su banco (tests/banco/gen-orden.mjs: la forma extraída de App.jsx
// y lo que hace App al guardar, `create` y `update`, copiado tal cual). Cada caso afirma lo que DEBERÍA pasarle a quien captura
// (Lupita con prisa, el vendedor, Pre-prensa, Marcelo): una FALLA es un bug. Nació con la critique del 12-oct (revisor independiente,
// 22/40) y los tres P1 de v10.84.77: guardar sin perder ni duplicar, la × que no borra antes de guardar, la orden facturada que no deja
// tocar lo que no guarda.
// Uso: node orden.mjs <dir-capturas> [puerto=5188]   ·   SOLO=<regex> corre sólo los casos que coinciden (sabotajes)
import { chromium } from "playwright";
import { deVite } from "../consola.mjs";   // (v10.84.117) el canal de recarga de Vite no es la app
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5188);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
// v10.84.81 — el banco ya trae el estilo global de App, con su desplazamiento suave y sus animaciones: los casos corren con el modo de
//   «menos movimiento» de la misma app (prefers-reduced-motion: su CSS los apaga; es un modo de verdad, el de quien lo pide en su equipo),
//   y los que tratan del movimiento ({ movimiento: true }: el renglón «creada») corren como la mayoría lo ve. Con todo animado la tanda
//   tardaba 2.5 veces más (Playwright espera a que cada cosa deje de moverse) y no cabía en los 12 minutos del candado.
async function caso(nombre, query, fn, viewport = { width: 1366, height: 768 }, { movimiento = false } = {}) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  // v10.84.81 — la tanda va en dos (scripts/probar.mjs): ORDEN_PARTE=1 hasta ord-228, 2 desde ord-229; sin ORDEN_PARTE, todos
  if (process.env.ORDEN_PARTE && (Number((/^ord-(\d+)/.exec(nombre) || [])[1]) >= 229 ? "2" : "1") !== process.env.ORDEN_PARTE) return;
  const page = await browser.newPage({ viewport, reducedMotion: movimiento ? "no-preference" : "reduce" });
  const errs = [], nativos = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource|\[create\]|\[update\]|client resolution|typeahead error|\[image upload|\[FileUpload\]|\[guardar\]/.test(m.text()) && !deVite(m)) errs.push("console: " + m.text().slice(0, 160)); });
  // un diálogo del navegador (confirm/alert) se anota y se acepta: la app no debería usarlos (DESIGN.md)
  page.on("dialog", async d => { nativos.push(d.type() + ": " + d.message().slice(0, 80)); await d.accept().catch(() => {}); });
  page.nativos = nativos;
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#log", { state: "attached", timeout: 30000 }); await page.waitForTimeout(400);   // (la primera carga, con dos tandas a la vez, puede pasar de 6 s: espera hasta 30, como la navegación)
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  if (nativos.length) ok(nombre + " · usó un diálogo del navegador", false, nativos.join(" ; "));
  await page.screenshot({ path: OUT + "/" + nombre.split(" ")[0] + ".png" }).catch(() => {});
  await page.close();
}
const espera = (p, ms = 300) => p.waitForTimeout(ms);
const log = async p => ((await p.textContent("#log")) || "").split("\n");
const lineas = async (p, pref) => (await log(p)).filter(l => l.startsWith(pref));
const cuenta = async (p, pref) => (await lineas(p, pref)).length;
const avisos = async p => (await lineas(p, "toast:")).map(l => l.replace(/^toast:/, ""));
const errores = async p => (await avisos(p)).filter(t => t.startsWith("error:"));
const estado = p => p.evaluate(() => { const e = window.__estado(); return { vista: e.vista, base: e.base.map(o => ({ id: o.id, pn: o.production_number, client: o.client, price: o.price, quantity: o.quantity })) }; });
const FIJAS = ["OP-A1", "OP-A2", "OP-ED", "OP-FO", "OP-MQ", "OP-FA", "OP-OC", "OP-ST"];
const nuevas = async p => (await estado(p)).base.filter(o => !FIJAS.includes(o.id));
const llenar = (p, ph, t) => p.getByPlaceholder(ph).first().fill(t);
const valor = (p, ph) => p.getByPlaceholder(ph).first().inputValue().catch(() => null);
const crear = p => p.getByRole("button", { name: /Crear Orden/ }).click();
const guardar = p => p.getByRole("button", { name: /^Guardar$/ }).click();
const titulo = p => p.evaluate(() => (document.querySelector("h2")?.innerText || "").replace(/\s+/g, " "));
const texto = p => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
// lo que se le dice a la persona en la página (fuera del aviso de abajo): los role="alert" visibles que NO son el Toast
const alertasEnLaForma = p => p.evaluate(() => [...document.querySelectorAll('[role="alert"]')]
  .filter(e => e.offsetParent && getComputedStyle(e).position !== "fixed" && !e.closest('[role="dialog"]'))
  .map(e => { const r = e.getBoundingClientRect(); return { t: e.innerText.replace(/\s+/g, " ").trim(), visible: r.top >= 0 && r.bottom <= innerHeight }; }));
const pregunta = p => p.locator('[role="dialog"]').last();
const textoPregunta = async p => ((await pregunta(p).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
// v10.84.80 — el vendedor es una lista (antes, ocho botones): se elige igual con la forma de antes y la de ahora
async function elegirVendedor(p, nombre) {
  const sel = p.locator("select#ff-agent");
  if (await sel.count()) { await sel.selectOption(nombre); await p.waitForTimeout(150); return; }
  await p.getByRole("button", { name: nombre, exact: true }).first().click();
}
async function vendedorEditable(p) {
  const sel = p.locator("select#ff-agent");
  if (await sel.count()) return await sel.isEnabled();
  if (await p.locator('#ff-agent[aria-readonly="true"]').count()) return false;
  return await p.getByRole("button", { name: "Manuel", exact: true }).first().isEnabled().catch(() => false);
}
async function vendedorActual(p) {
  const sel = p.locator("select#ff-agent");
  if (await sel.count()) { const v = await sel.inputValue(); return v === "otro" ? "" : v; }
  return p.evaluate(() => { const b = document.querySelector('#ff-agent [aria-pressed="true"]'); return b ? b.textContent.trim() : ""; });
}
// v10.84.80 — al crear, la forma se queda con «P-… creada» (antes: un aviso abajo de 6.5 s y al Dashboard)
const creada = p => p.evaluate(() => { const b = [...document.querySelectorAll('.pf-forma [role="status"]')].find(e => /creada/.test(e.textContent || "")); return b ? b.innerText.replace(/\s+/g, " ").trim() : ""; });
// una orden completa de un cliente que ya existe (COSQUIM: el buscador lo trae con su correo y su vendedor)
async function capturar(p, { cantidad = "2000", descripcion = "Etiqueta 5 x 4 cm couché adhesivo a 4 tintas" } = {}) {
  await llenar(p, "Cliente (escribe para buscar)", "COS"); await espera(p, 600);
  await p.getByText("COSQUIM", { exact: true }).first().click(); await espera(p, 500);
  await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", cantidad);
  await p.locator("textarea").first().fill(descripcion);
  await espera(p, 200);
}
const crudo = t => /upstream|disconnect|fetch failed|addTimeline|addNotification|Error desconocido|F12|violates|row-level/i.test(t);
// «Editar» de esa orden como la tiene la base: primero se sale a otra vista (como en App, la forma se monta de nuevo con la orden)
const editar = async (p, id, extra) => { await p.evaluate(() => window.__ir("orders")); await espera(p, 200);
  await p.evaluate(([i, x]) => window.__editar(i, x), [id, extra || {}]); await espera(p, 700); };
// clic con el elemento al centro de la ventana: el pie fijo de la forma tapa lo que queda abajo (eso se prueba aparte, con Tab)
const clic = async loc => { await loc.first().evaluate(e => e.scrollIntoView({ block: "center" })); await loc.first().click(); };
// v10.84.79 — «Más de esta orden» (distribución, sin empaque, archivo de producción) empieza cerrado: se abre antes de usarlo
const rect = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width }; }, sel);
const pieTop = p => p.evaluate(() => { const f = document.querySelector("h2 + div"); const pie = f && [...f.querySelectorAll("div")].find(d => getComputedStyle(d).position === "sticky"); return pie ? pie.getBoundingClientRect().top : innerHeight; });
const abrirMas = async p => { const b = p.getByRole("button", { name: /Más de esta orden/ }); if ((await b.count()) && (await b.first().getAttribute("aria-expanded")) !== "true") { await clic(b); await espera(p, 300); } };
const editable = async loc => (await loc.count()) ? await loc.first().isEditable().catch(() => false) : false;

// ── Guardar cuando la base falla: nada se pierde, nada se duplica, un solo mensaje y en palabras ──
await caso("ord-01 si la base no da el número de la orden, lo capturado SIGUE en la forma y el mensaje lo dice en la forma, en español", "folio=falla", async p => {
  await capturar(p); await crear(p); await espera(p, 1500);
  const cliente = await valor(p, "Cliente (escribe para buscar)"), desc = await p.locator("textarea").first().inputValue().catch(() => "");
  const al = await alertasEnLaForma(p), e = await estado(p), er = await errores(p);
  const msg = al.find(a => /no se cre[óo]/i.test(a.t));
  ok("ord-01 si la base no da el número de la orden, lo capturado SIGUE en la forma y el mensaje lo dice en la forma, en español",
    e.vista === "form" && cliente === "COSQUIM" && /couché adhesivo/.test(desc) && !!msg && msg.visible && /sigue aqu[ií]/i.test(msg.t) && !crudo(msg.t) && er.length === 0,
    `vista ${e.vista} · cliente «${cliente}» · descripción «${desc.slice(0, 20)}» · en la forma ${JSON.stringify(al)} · avisos de error ${JSON.stringify(er)}`);
});
await caso("ord-02 la orden que SÍ se guardó (falló sólo su bitácora) se da por creada, con su número, y no se puede duplicar", "guardar=timeline", async p => {
  await capturar(p); await crear(p); await espera(p, 1500);
  const c1 = await creada(p);   // v10.84.80 — la forma se queda con «P-… creada» (antes: aviso abajo y al Dashboard)
  if (await p.getByRole("button", { name: /Crear Orden/ }).count()) { await crear(p); await espera(p, 1500); }
  const n = await nuevas(p), e = await estado(p), a1 = await avisos(p);
  ok("ord-02 la orden que SÍ se guardó (falló sólo su bitácora) se da por creada, con su número, y no se puede duplicar",
    n.length === 1 && e.vista === "form" && /P-0651/.test(c1) && /cread/i.test(c1) && !/no se cre/i.test(c1) && !a1.some(t => /No se pudo crear|no se cre/i.test(t)),
    `órdenes nuevas ${n.length} (${n.map(o => o.pn).join(", ")}) · vista ${e.vista} · en la forma «${c1}» · avisos ${JSON.stringify(a1)}`);
});
await caso("ord-03 si la base rechaza la orden: UN mensaje, en la forma, en español, que no se guardó; lo capturado sigue", "guardar=falla", async p => {
  await capturar(p); await crear(p); await espera(p, 1500);
  const al = await alertasEnLaForma(p), er = await errores(p), e = await estado(p), cliente = await valor(p, "Cliente (escribe para buscar)");
  const msg = al.filter(a => /no se cre[óo]|no se guard/i.test(a.t));
  ok("ord-03 si la base rechaza la orden: UN mensaje, en la forma, en español, que no se guardó; lo capturado sigue",
    msg.length === 1 && !crudo(msg[0].t) && /sin conexi[óo]n/i.test(msg[0].t) && er.length === 0 && e.vista === "form" && cliente === "COSQUIM" && (await nuevas(p)).length === 0,
    `en la forma ${JSON.stringify(al)} · avisos de error ${JSON.stringify(er)} · vista ${e.vista} · cliente «${cliente}»`);
});
await caso("ord-04 si falla sólo el aviso a Producción, la orden se creó: lo dice con su número, dice que no se pudo avisar y no la duplica", "guardar=aviso", async p => {
  await capturar(p); await crear(p); await espera(p, 1500);
  if (await p.getByRole("button", { name: /Crear Orden/ }).count()) { await crear(p); await espera(p, 1500); }
  const c = await creada(p), n = await nuevas(p);
  ok("ord-04 si falla sólo el aviso a Producción, la orden se creó: lo dice con su número, dice que no se pudo avisar y no la duplica",
    n.length === 1 && /P-0651/.test(c) && /no se pudo avisar/i.test(c) && !/no se cre/i.test(c) && !crudo(c),
    `órdenes nuevas ${n.length} · en la forma «${c}»`);
});
await caso("ord-05 con cliente nuevo, el aviso final dice la orden Y que el cliente quedó en CobranzaFlow, con «Ver P-…»", "cliente=nada", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "ZZ PRUEBA CLAUDE SA"); await llenar(p, "correo@ej.com", "prueba@ejemplo.com");
  await llenar(p, "XAXX010101000", "ZZZ010101AAA"); await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", "1000"); await elegirVendedor(p, "Manuel");
  await crear(p); await espera(p, 800);
  await p.getByRole("button", { name: /crear cliente nuevo/i }).click(); await espera(p, 1500);
  const ultimo = await creada(p);
  const ver = p.getByRole("button", { name: /Ver P-0651/ });
  const hayVer = (await ver.count()) > 0;
  if (hayVer) { await ver.first().click(); await espera(p, 300); }
  ok("ord-05 con cliente nuevo, el aviso final dice la orden Y que el cliente quedó en CobranzaFlow, con «Ver P-…»",
    /P-0651/.test(ultimo) && /CobranzaFlow/.test(ultimo) && hayVer && (await cuenta(p, "detalle ")) === 1, `último aviso «${ultimo}» · «Ver P-0651» ${hayVer} · detalle ${await cuenta(p, "detalle ")}`);
});
await caso("ord-06 después de un rechazo, volver a apretar «Crear Orden» crea la orden y el mensaje se va", "folio=falla1", async p => {
  await capturar(p); await crear(p); await espera(p, 1200);
  const antes = (await alertasEnLaForma(p)).filter(a => /no se cre/i.test(a.t)).length;
  await crear(p); await espera(p, 1500);
  const n = await nuevas(p), e = await estado(p), despues = (await alertasEnLaForma(p)).filter(a => /no se cre/i.test(a.t)).length, c = await creada(p);
  ok("ord-06 después de un rechazo, volver a apretar «Crear Orden» crea la orden y el mensaje se va",
    antes === 1 && n.length === 1 && n[0].pn === "P-0651" && e.vista === "form" && /P-0651/.test(c) && despues === 0, `mensaje antes ${antes} · órdenes ${n.map(o => o.pn).join(",")} · vista ${e.vista} · «${c}» · mensaje después ${despues}`);
});
await caso("ord-07 si la base rechaza los cambios de una orden: el mensaje va en la forma y lo editado sigue", "modo=editar&rol=admin&editar=falla", async p => {
  await p.locator("textarea").first().fill("Recetas Dr. Eduardo Fuentes · CORREGIDO");
  await guardar(p); await espera(p, 1200);
  const al = await alertasEnLaForma(p), er = await errores(p), desc = await p.locator("textarea").first().inputValue().catch(() => "");
  const msg = al.find(a => /no se guard/i.test(a.t));
  ok("ord-07 si la base rechaza los cambios de una orden: el mensaje va en la forma y lo editado sigue",
    !!msg && !crudo(msg.t) && er.length === 0 && /CORREGIDO/.test(desc), `en la forma ${JSON.stringify(al)} · avisos de error ${JSON.stringify(er)} · descripción «${desc.slice(-12)}»`);
});
await caso("ord-08 «Guardar» sin cambiar nada no dice «actualizada»: dice que no hubo cambios", "modo=editar&rol=admin", async p => {
  await guardar(p); await espera(p, 1000);
  const ultimo = (await avisos(p)).pop() || "";
  ok("ord-08 «Guardar» sin cambiar nada no dice «actualizada»: dice que no hubo cambios", /sin cambios/i.test(ultimo) && !/actualizada/i.test(ultimo) && (await cuenta(p, "update ")) === 0,
    `último aviso «${ultimo}» · updates ${await cuenta(p, "update ")}`);
});

// ── Doble acción: lo que crea una orden se hace UNA vez ──
await caso("ord-10 doble clic en «Crear Orden»: una sola orden", "guardar=lento&lento=1", async p => {
  await capturar(p);
  await p.getByRole("button", { name: /Crear Orden/ }).dblclick(); await espera(p, 2500);
  ok("ord-10 doble clic en «Crear Orden»: una sola orden", (await cuenta(p, "saveOrder ")) === 1 && (await cuenta(p, "rpc next_production_number")) === 1,
    `saveOrder ${await cuenta(p, "saveOrder ")} · números pedidos ${await cuenta(p, "rpc next_production_number")}`);
});
await caso("ord-11 doble Ctrl+Enter: una sola orden", "guardar=lento&lento=1", async p => {
  await capturar(p);
  await p.locator("textarea").first().focus();
  await p.keyboard.press("Control+Enter"); await p.keyboard.press("Control+Enter"); await espera(p, 2500);
  ok("ord-11 doble Ctrl+Enter: una sola orden", (await cuenta(p, "saveOrder ")) === 1, `saveOrder ${await cuenta(p, "saveOrder ")}`);
});

// ── Lo que se borra antes de guardar (el archivo de impresión se queda como historial: v10.84.76) ──
const ARCHIVO = "https://x.supabase.co/storage/v1/object/public/order-files/OP-ED/arte-final.pdf";
const IMAGEN = "https://x.supabase.co/storage/v1/object/public/order-files/OP-ED/img-1-zzz.jpg";
const conArchivo = p => p.evaluate(([a, i]) => { const o = window.__estado().base.find(x => x.id === "OP-ED"); o.file_url = a; o.file_name = "arte-final.pdf"; o.image_url = i; }, [ARCHIVO, IMAGEN]);
await caso("ord-20 «Quitar» el archivo de producción al editar no lo borra del servidor, y se puede deshacer", "modo=editar&rol=admin", async p => {
  await conArchivo(p); await editar(p, "OP-ED"); await abrirMas(p);
  await clic(p.getByRole("button", { name: "Quitar", exact: true })); await espera(p, 400);
  const hayDeshacer = (await p.getByRole("button", { name: /Deshacer/ }).count()) > 0;
  if (hayDeshacer) { await clic(p.getByRole("button", { name: /Deshacer/ })); await espera(p, 300); }
  const vuelve = (await p.getByRole("link", { name: /Descargar/ }).count()) > 0;   // el archivo vuelve a estar en la orden (no la bitácora)
  const borrados = await lineas(p, "storage remove");
  ok("ord-20 «Quitar» el archivo de producción al editar no lo borra del servidor, y se puede deshacer", borrados.length === 0 && hayDeshacer && vuelve,
    `storage remove ${JSON.stringify(borrados)} · «Deshacer» ${hayDeshacer} · vuelve el archivo ${vuelve}`);
});
await caso("ord-21 la × de una imagen ya guardada no la borra del servidor; «Deshacer» la regresa y guardar no la pierde", "modo=editar&rol=admin", async p => {
  await conArchivo(p); await editar(p, "OP-ED");
  await clic(p.getByRole("button", { name: "Quitar imagen" })); await espera(p, 400);
  const borrados = await lineas(p, "storage remove");
  const hayDeshacer = (await p.getByRole("button", { name: /Deshacer/ }).count()) > 0;
  if (hayDeshacer) { await clic(p.getByRole("button", { name: /Deshacer/ })); await espera(p, 300); }
  await p.locator("textarea").first().fill("Recetas Dr. Eduardo Fuentes · con su imagen"); await guardar(p); await espera(p, 1000);
  const up = (await lineas(p, "update OP-ED ")).pop() || "";
  const img = up ? JSON.parse(up.replace(/^update OP-ED /, "")).image_url : "(sin update)";
  ok("ord-21 la × de una imagen ya guardada no la borra del servidor; «Deshacer» la regresa y guardar no la pierde", borrados.length === 0 && hayDeshacer && img === IMAGEN,
    `storage remove ${JSON.stringify(borrados)} · «Deshacer» ${hayDeshacer} · image_url guardada ${img}`);
});
await caso("ord-22 la × de una imagen subida en esta misma captura sí la limpia del servidor (nadie más la usa)", "", async p => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await p.locator('input[type="file"][accept="image/*"]').first().setInputFiles({ name: "arte.png", mimeType: "image/png", buffer: png }); await espera(p, 1500);
  const sube = (await lineas(p, "storage upload")).pop() || "";
  await clic(p.getByRole("button", { name: "Quitar imagen" })); await espera(p, 500);
  const ruta = sube.replace(/^storage upload /, ""), borrados = await lineas(p, "storage remove");
  ok("ord-22 la × de una imagen subida en esta misma captura sí la limpia del servidor (nadie más la usa)", !!ruta && borrados.some(l => l.includes(ruta)),
    `subida «${ruta}» · storage remove ${JSON.stringify(borrados)}`);
});
await caso("ord-23 después de «Replicar» sin poder copiar la imagen, la × de la orden nueva NO borra la de la orden de origen", "img=falla", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "COS"); await espera(p, 600);
  await p.getByText("COSQUIM", { exact: true }).first().click(); await espera(p, 500);
  await p.getByRole("button", { name: /Replicar de orden anterior/ }).click(); await espera(p, 800);
  await p.getByText("P-0648").first().click(); await espera(p, 1500);
  await clic(p.getByRole("button", { name: "Quitar imagen" })); await espera(p, 500);
  const borrados = await lineas(p, "storage remove");
  ok("ord-23 después de «Replicar» sin poder copiar la imagen, la × de la orden nueva NO borra la de la orden de origen", !borrados.some(l => l.includes("OP-A1/")),
    `storage remove ${JSON.stringify(borrados)}`);
});

// ── La orden facturada (o del vendedor): lo que no se guarda no se deja tocar, y antes de guardar se dicen las cifras ──
await caso("ord-40 en una orden facturada, la razón social y el RFC no se pueden cambiar aquí, y dice dónde (CobranzaFlow)", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-FA");
  const nom = await editable(p.getByPlaceholder("Cliente (escribe para buscar)")), rfc = await editable(p.getByPlaceholder("XAXX010101000"));
  const t = await texto(p);
  ok("ord-40 en una orden facturada, la razón social y el RFC no se pueden cambiar aquí, y dice dónde (CobranzaFlow)", !nom && !rfc && /CobranzaFlow/.test(t) && /F-122/.test(t),
    `razón social editable ${nom} · RFC editable ${rfc}`);
});
await caso("ord-41 el título dice qué orden se edita (su número y su folio)", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-FA"); const t = await titulo(p);
  ok("ord-41 el título dice qué orden se edita (su número y su folio)", /P-0643/.test(t) && /F-122/.test(t), `título «${t}»`);
});
await caso("ord-42 cambiar precio y cantidad de una facturada pregunta antes, con las cifras y lo que pasa con la factura; «Volver» no guarda", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-FA");
  await p.getByPlaceholder("$0.00").first().fill("1"); await llenar(p, "Ejemplo · 1000", "1");
  await guardar(p); await espera(p, 900);
  const hay = (await pregunta(p).count()) > 0, t = await textoPregunta(p);
  const cifras = /1,000/.test(t) && /\$2,473\.00/.test(t) && /\$1\.00/.test(t) && /F-122/.test(t) && /\$2,868\.68/.test(t) && /\$1\.16/.test(t);
  if (hay) { await pregunta(p).getByRole("button", { name: /Volver/ }).first().click(); await espera(p, 400); }
  const sinGuardar = (await cuenta(p, "update ")) === 0 && (await estado(p)).vista === "form";
  if (hay) { await guardar(p); await espera(p, 900); await pregunta(p).locator("button").last().click(); await espera(p, 1200); }
  const ups = await lineas(p, "update OP-FA ");
  const guardo = ups.length === 1 && /"price":1\b/.test(ups[0]) && /"quantity":1\b/.test(ups[0]);
  ok("ord-42 cambiar precio y cantidad de una facturada pregunta antes, con las cifras y lo que pasa con la factura; «Volver» no guarda",
    hay && cifras && sinGuardar && guardo, `pregunta ${hay} · cifras ${cifras} «${t.slice(0, 260)}» · «Volver» no guardó ${sinGuardar} · updates ${ups.length}`);
});
await caso("ord-43 si la factura ya está timbrada, la pregunta lo dice: su importe NO cambia", "modo=editar&rol=admin&precio=timbrada", async p => {
  await editar(p, "OP-FA");
  await p.getByPlaceholder("$0.00").first().fill("2000"); await guardar(p); await espera(p, 900);
  const t = await textoPregunta(p);
  ok("ord-43 si la factura ya está timbrada, la pregunta lo dice: su importe NO cambia", /timbrad/i.test(t) && /no cambia/i.test(t) && /F-122/.test(t), `«${t.slice(0, 240)}»`);
});
await caso("ord-44 si sólo cambia la cantidad, la pregunta dice que la factura no cambia", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-FA");
  await llenar(p, "Ejemplo · 1000", "900"); await guardar(p); await espera(p, 900);
  const t = await textoPregunta(p);
  ok("ord-44 si sólo cambia la cantidad, la pregunta dice que la factura no cambia", /1,000/.test(t) && /900/.test(t) && /F-122/.test(t) && /no cambia/i.test(t), `«${t.slice(0, 240)}»`);
});
await caso("ord-45 el vendedor no puede tocar aquí el precio, el cliente ni el vendedor de una orden (y dice por qué)", "modo=editar&rol=vendedor", async p => {
  await editar(p, "OP-ED");
  const precio = await editable(p.getByPlaceholder("$0.00")), cliente = await editable(p.getByPlaceholder("Cliente (escribe para buscar)"));
  const vend = await vendedorEditable(p);
  const t = await texto(p);
  ok("ord-45 el vendedor no puede tocar aquí el precio, el cliente ni el vendedor de una orden (y dice por qué)", !precio && !cliente && !vend && /Lupita|Dirección/.test(t),
    `precio editable ${precio} · cliente editable ${cliente} · botón de vendedor activo ${vend}`);
});
await caso("ord-46 al corregir specs (Pre-prensa), el título dice qué orden es", "modo=specs&rol=preprensa", async p => {
  const t = await titulo(p);
  ok("ord-46 al corregir specs (Pre-prensa), el título dice qué orden es", /P-0650/.test(t), `título «${t}»`);
});
await caso("ord-47 en una orden de una OC con el folio de toda la OC, la pregunta dice cuánto cambia esa factura (F-200)", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-OC");
  await p.getByPlaceholder("$0.00").first().fill("25000"); await guardar(p); await espera(p, 900);
  const t = await textoPregunta(p);
  ok("ord-47 en una orden de una OC con el folio de toda la OC, la pregunta dice cuánto cambia esa factura (F-200)", /F-200/.test(t) && /OC-0950/.test(t) && /\$34,800\.00/.test(t) && /\$29,000\.00/.test(t),
    `«${t.slice(0, 260)}»`);
});
await caso("ord-48 la orden que ya cargó al inventario no deja cambiar la cantidad aquí, y dice dónde", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-ST");
  const cant = await editable(p.getByPlaceholder("Ejemplo · 1000")), t = await texto(p);
  ok("ord-48 la orden que ya cargó al inventario no deja cambiar la cantidad aquí, y dice dónde", !cant && /inventario/i.test(t), `cantidad editable ${cant}`);
});
await caso("ord-49 si no se puede leer la factura, la pregunta sale igual, con lo que sí se sabe (sin cifras inventadas)", "modo=editar&rol=admin&precio=falla", async p => {
  await editar(p, "OP-FA");
  await p.getByPlaceholder("$0.00").first().fill("2000"); await guardar(p); await espera(p, 1200);
  const hay = (await pregunta(p).count()) > 0, t = await textoPregunta(p);
  ok("ord-49 si no se puede leer la factura, la pregunta sale igual, con lo que sí se sabe (sin cifras inventadas)", hay && /F-122/.test(t) && /\$2,473\.00/.test(t) && /\$2,000\.00/.test(t) && !/\$2,868\.68/.test(t),
    `pregunta ${hay} · «${t.slice(0, 240)}»`);
});

// ── Lo que dice que hizo y no hizo ──
await caso("ord-30 registrar un agente de compras con la base que rechaza: NO dice «registrado», dice que no se pudo", "agente=falla", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "COS"); await espera(p, 600);
  await p.getByText("COSQUIM", { exact: true }).first().click(); await espera(p, 500);
  await llenar(p, "Quién pide por parte del cliente (ej. Eva)", "Rosa"); await espera(p, 300);
  await p.getByRole("button", { name: /Registrar "Rosa"/ }).click(); await espera(p, 300);
  await p.getByRole("button", { name: /^Registrar$/ }).click(); await espera(p, 800);
  const a = await avisos(p), t = await texto(p);
  ok("ord-30 registrar un agente de compras con la base que rechaza: NO dice «registrado», dice que no se pudo",
    !a.some(x => /registrado/i.test(x)) && /no se pudo/i.test(t), `avisos ${JSON.stringify(a)}`);
});

// ── Vuelta 2 (v10.84.77): por donde no se diseñó ──
await caso("ord-50 doble clic en «Guardar los cambios» de la pregunta: un solo guardado", "modo=editar&rol=admin&editar=lento&lento=1", async p => {
  await editar(p, "OP-FA");
  await p.getByPlaceholder("$0.00").first().fill("2000"); await guardar(p); await espera(p, 900);
  await pregunta(p).locator("button").last().dblclick(); await espera(p, 2500);
  ok("ord-50 doble clic en «Guardar los cambios» de la pregunta: un solo guardado", (await cuenta(p, "update OP-FA ")) === 1, `updates ${await cuenta(p, "update OP-FA ")}`);
});
await caso("ord-51 Esc en la pregunta regresa a la forma con lo cambiado, sin guardar, con el foco en la forma; y se puede volver a guardar", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-FA");
  await p.getByPlaceholder("$0.00").first().fill("2000"); await guardar(p); await espera(p, 900);
  const hay = (await pregunta(p).count()) > 0;
  await p.keyboard.press("Escape"); await espera(p, 400);
  const cerrada = (await pregunta(p).count()) === 0, precio = await p.getByPlaceholder("$0.00").first().inputValue(), sinGuardar = (await cuenta(p, "update ")) === 0;
  const foco = await p.evaluate(() => { const a = document.activeElement; return !!a && a !== document.body && !!a.closest("h2 + div, [data-forma]") || (a && a.tagName === "BUTTON" && /Guardar/.test(a.textContent)); });
  await p.keyboard.press("Control+Enter"); await espera(p, 900);
  const otraVez = (await pregunta(p).count()) > 0;
  ok("ord-51 Esc en la pregunta regresa a la forma con lo cambiado, sin guardar, con el foco en la forma; y se puede volver a guardar",
    hay && cerrada && precio === "2000" && sinGuardar && foco && otraVez, `pregunta ${hay} · se cerró ${cerrada} · precio «${precio}» · sin guardar ${sinGuardar} · foco en la forma ${foco} · Ctrl+Enter la vuelve a abrir ${otraVez}`);
});
await caso("ord-52 mientras lee la factura dice «Revisando la factura…»; si no contesta en 8 s, la pregunta sale con la regla, sin cifras y dice que tardó", "modo=editar&rol=admin&precio=lento&lento=12", async p => {
  await editar(p, "OP-FA");
  await p.getByPlaceholder("$0.00").first().fill("2000"); await guardar(p); await espera(p, 600);
  const dice = (await p.getByRole("button", { name: /Revisando la factura/ }).count()) > 0;
  await espera(p, 8500);
  const t = await textoPregunta(p);
  ok("ord-52 mientras lee la factura dice «Revisando la factura…»; si no contesta en 8 s, la pregunta sale con la regla, sin cifras y dice que tardó",
    dice && /F-122/.test(t) && /tardó más de 8 s/.test(t) && /recalcula/.test(t) && !/\$2,868\.68/.test(t), `«Revisando» ${dice} · «${t.slice(0, 200)}»`);   // v10.84.81: «tardó», ya no «No se pudo leer»
});
await caso("ord-53 si facturan la orden mientras se edita, la razón social se cierra y cambiar el precio pregunta (la orden viva)", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-ED");
  await p.evaluate(() => window.__cambiar({ invoice_folio: "F-160", invoice_type: "factura" })); await espera(p, 500);
  const nom = await editable(p.getByPlaceholder("Cliente (escribe para buscar)"));
  await p.getByPlaceholder("$0.00").first().fill("1500"); await guardar(p); await espera(p, 900);
  const t = await textoPregunta(p);
  ok("ord-53 si facturan la orden mientras se edita, la razón social se cierra y cambiar el precio pregunta (la orden viva)",
    !nom && /F-160/.test(t) && /\$1,800\.00/.test(t) && /\$1,500\.00/.test(t) && /\$2,088\.00/.test(t), `razón social editable ${nom} · «${t.slice(0, 220)}»`);
});
await caso("ord-54 en una maquila facturada, la pregunta habla del precio al cliente y de su factura con IVA", "modo=editar&rol=admin", async p => {
  await p.evaluate(() => { const o = window.__estado().base.find(x => x.id === "OP-MQ"); o.invoice_folio = "F-150"; o.invoice_type = "factura"; });
  await editar(p, "OP-MQ");
  await p.getByPlaceholder("$0", { exact: true }).nth(1).fill("10000"); await guardar(p); await espera(p, 900);
  const t = await textoPregunta(p);
  ok("ord-54 en una maquila facturada, la pregunta habla del precio al cliente y de su factura con IVA",
    /Precio al cliente/.test(t) && /\$12,500\.00/.test(t) && /\$10,000\.00/.test(t) && /F-150/.test(t) && /\$14,500\.00/.test(t) && /\$11,600\.00/.test(t), `«${t.slice(0, 240)}»`);
});
await caso("ord-55 «Quitar» el archivo y guardar: la orden se queda sin él y el archivo sigue en el servidor (historial)", "modo=editar&rol=admin", async p => {
  await conArchivo(p); await editar(p, "OP-ED"); await abrirMas(p);
  await clic(p.getByRole("button", { name: "Quitar", exact: true })); await espera(p, 300);
  await guardar(p); await espera(p, 1000);
  const up = (await lineas(p, "update OP-ED ")).pop() || "", datos = up ? JSON.parse(up.replace(/^update OP-ED /, "")) : {};
  const borrados = await lineas(p, "storage remove");
  ok("ord-55 «Quitar» el archivo y guardar: la orden se queda sin él y el archivo sigue en el servidor (historial)", !!up && datos.file_url === null && borrados.length === 0,
    `update ${up ? "sí" : "no"} · file_url ${JSON.stringify(datos.file_url)} · storage remove ${JSON.stringify(borrados)}`);
});
await caso("ord-56 «Quitar» un archivo subido en esta misma captura sí lo limpia del servidor (y no ofrece deshacer)", "", async p => {
  await abrirMas(p); await p.locator('input[type="file"]:not([accept="image/*"])').first().setInputFiles({ name: "arte.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 prueba") }); await espera(p, 1500);
  await clic(p.getByRole("button", { name: "Quitar", exact: true })); await espera(p, 500);
  const borrados = await lineas(p, "storage remove"), deshacer = await p.getByRole("button", { name: /Deshacer/ }).count();
  ok("ord-56 «Quitar» un archivo subido en esta misma captura sí lo limpia del servidor (y no ofrece deshacer)", borrados.length === 1 && /arte|new\//.test(borrados[0] || "") && deshacer === 0,
    `storage remove ${JSON.stringify(borrados)} · «Deshacer» ${deshacer}`);
});
await caso("ord-57 si el cliente ya existía (se eligió en la pregunta), el aviso no dice que se dio de alta", "cliente=fuerte", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "CORONA SA"); await llenar(p, "correo@ej.com", "eva@modelo.mx");
  await llenar(p, "XAXX010101000", "CMM8601014G4");
  await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", "1000"); await elegirVendedor(p, "Manuel");
  await crear(p); await espera(p, 800);
  await pregunta(p).getByRole("button", { name: /CERVECERIA MODELO/ }).first().click(); await espera(p, 1500);
  // v10.84.80 — elegir ya no crea: pone al cliente en la forma, y se crea con «Crear Orden»
  if (await p.getByRole("button", { name: /Crear Orden/ }).count()) { await crear(p); await espera(p, 1500); }
  const ultimo = await creada(p);
  ok("ord-57 si el cliente ya existía (se eligió en la pregunta), el aviso no dice que se dio de alta", /P-0651/.test(ultimo) && !/dado de alta/.test(ultimo), `en la forma «${ultimo}»`);
});
await caso("ord-58 Esc en «¿ya existe?» regresa a la forma con todo, sin mensaje de error, y se puede volver a crear", "cliente=nada", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "ZZ PRUEBA CLAUDE SA"); await llenar(p, "correo@ej.com", "prueba@ejemplo.com");
  await llenar(p, "XAXX010101000", "ZZZ010101AAA"); await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", "1000"); await elegirVendedor(p, "Manuel");
  await crear(p); await espera(p, 800);
  const guardando = (await p.getByRole("button", { name: /Guardando/ }).count()) > 0;
  await p.keyboard.press("Escape"); await espera(p, 400);
  const cliente = await valor(p, "Cliente (escribe para buscar)"), al = (await alertasEnLaForma(p)).filter(a => /no se cre|no se pudo/i.test(a.t));
  await crear(p); await espera(p, 800);
  const otraVez = (await pregunta(p).count()) > 0;
  ok("ord-58 Esc en «¿ya existe?» regresa a la forma con todo, sin mensaje de error, y se puede volver a crear",
    !guardando && cliente === "ZZ PRUEBA CLAUDE SA" && al.length === 0 && otraVez, `«Guardando…» con la pregunta abierta ${guardando} · cliente «${cliente}» · mensajes ${JSON.stringify(al)} · otra vez ${otraVez}`);
});
await caso("ord-59 a 1920, el mensaje del rechazo queda a la vista junto al botón", "folio=falla", async p => {
  await capturar(p); await crear(p); await espera(p, 1200);
  const msg = (await alertasEnLaForma(p)).find(a => /no se cre/i.test(a.t));
  ok("ord-59 a 1920, el mensaje del rechazo queda a la vista junto al botón", !!msg && msg.visible, JSON.stringify(msg || null));
}, { width: 1920, height: 1080 });
await caso("ord-60 el vendedor, al CREAR, sí captura el precio, el cliente y el vendedor (el candado es sólo al editar)", "rol=vendedor", async p => {
  const precio = await editable(p.getByPlaceholder("$0.00")), cliente = await editable(p.getByPlaceholder("Cliente (escribe para buscar)"));
  const vend = await vendedorEditable(p);
  ok("ord-60 el vendedor, al CREAR, sí captura el precio, el cliente y el vendedor (el candado es sólo al editar)", precio && cliente && vend, `precio ${precio} · cliente ${cliente} · vendedor ${vend}`);
});
await caso("ord-61 una orden sin facturar se edita completa (sin candados de más)", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-ED");
  const cliente = await editable(p.getByPlaceholder("Cliente (escribe para buscar)")), precio = await editable(p.getByPlaceholder("$0.00")), rfc = await editable(p.getByPlaceholder("XAXX010101000"));
  ok("ord-61 una orden sin facturar se edita completa (sin candados de más)", cliente && precio && rfc && !/se corrigen en CobranzaFlow/.test(await texto(p)), `cliente ${cliente} · precio ${precio} · RFC ${rfc}`);
});
await caso("ord-62 con el folio asignado por adelantado (Karla), el precio y el cliente tienen candado y dicen por qué", "modo=candado&rol=karla", async p => {
  const t = await texto(p);
  const precio = await editable(p.getByPlaceholder("$0.00")), cliente = await editable(p.getByPlaceholder("Cliente (escribe para buscar)"));
  ok("ord-62 con el folio asignado por adelantado (Karla), el precio y el cliente tienen candado y dicen por qué", !precio && !cliente && /F-140 ya está asignado/.test(t) && !/\(\)/.test(t),
    `precio ${precio} · cliente ${cliente}`);
});
await caso("ord-63 la facturada por partes dice «por partes» en su candado (decía «Folio fiscal pre-asignado ()»)", "modo=editar&rol=admin", async p => {
  await p.evaluate(() => { const o = window.__estado().base.find(x => x.id === "OP-ED"); o.has_splits = true; });
  await editar(p, "OP-ED", { _financialsLocked: true });
  const t = await texto(p);
  ok("ord-63 la facturada por partes dice «por partes» en su candado (decía «Folio fiscal pre-asignado ()»)", /facturada \(por partes\)/.test(t) && !/pre-asignado \(\)/.test(t) && !(await editable(p.getByPlaceholder("$0.00"))),
    `«${(t.match(/.{0,40}por partes.{0,60}/) || [""])[0]}»`);
});
await caso("ord-64 en la facturada por partes, cambiar la cantidad pregunta y dice que lo que queda por facturar absorbe las piezas", "modo=editar&rol=admin", async p => {
  await p.evaluate(() => { const o = window.__estado().base.find(x => x.id === "OP-ED"); o.has_splits = true; });
  await editar(p, "OP-ED", { _financialsLocked: true });
  await llenar(p, "Ejemplo · 1000", "400"); await guardar(p); await espera(p, 900);
  const t = await textoPregunta(p);
  ok("ord-64 en la facturada por partes, cambiar la cantidad pregunta y dice que lo que queda por facturar absorbe las piezas", /500/.test(t) && /400/.test(t) && /por facturar absorbe/.test(t), `«${t.slice(0, 220)}»`);
});
await caso("ord-65 al guardar una edición, el aviso nombra la orden y trae «Ver P-…»", "modo=editar&rol=admin", async p => {
  await p.locator("textarea").first().fill("Recetas Dr. Eduardo Fuentes · segunda edición"); await guardar(p); await espera(p, 1000);
  const ultimo = (await avisos(p)).pop() || "", ver = await p.getByRole("button", { name: /Ver P-0650/ }).count();
  ok("ord-65 al guardar una edición, el aviso nombra la orden y trae «Ver P-…»", /P-0650/.test(ultimo) && /actualizada/.test(ultimo) && ver > 0, `último aviso «${ultimo}» · «Ver» ${ver}`);
});

await caso("ord-66 doble Ctrl+Enter con la pregunta abierta: una sola pregunta y un solo guardado", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-FA");
  await p.getByPlaceholder("$0.00").first().fill("2000"); await guardar(p); await espera(p, 900);
  await p.keyboard.press("Control+Enter"); await espera(p, 600);
  const n = await p.locator('[role="dialog"]').count();
  await pregunta(p).locator("button").last().click(); await espera(p, 1200);
  const ups = await cuenta(p, "update OP-FA "), e = await estado(p);
  ok("ord-66 doble Ctrl+Enter con la pregunta abierta: una sola pregunta y un solo guardado", n === 1 && ups === 1 && e.vista !== "form", `preguntas ${n} · updates ${ups} · vista ${e.vista}`);
});

// ════ v10.84.78 — los P2 de la critique: lo capturado no se pierde ni cambia sin aviso, el teclado, AA y las palabras ════
const forma = p => p.locator("h2 + div").first();
const hayPregunta = async p => (await pregunta(p).count()) > 0;
// ── Salir con algo capturado pregunta (Marcelo, 12-oct) ──
await caso("ord-80 «Cancelar» con algo capturado pregunta; «Seguir capturando» (enfocado) se queda con todo", "", async p => {
  await capturar(p);
  await p.getByRole("button", { name: /^Cancelar$/ }).click(); await espera(p, 400);
  const hay = await hayPregunta(p), t = await textoPregunta(p);
  const foco = await p.evaluate(() => (document.activeElement?.textContent || "").trim());
  if (hay) { await pregunta(p).getByRole("button", { name: /Seguir capturando/ }).click(); await espera(p, 300); }
  const e = await estado(p), cliente = await valor(p, "Cliente (escribe para buscar)");
  ok("ord-80 «Cancelar» con algo capturado pregunta; «Seguir capturando» (enfocado) se queda con todo", hay && /sin guardar/i.test(t) && /Seguir capturando/.test(foco) && e.vista === "form" && cliente === "COSQUIM",
    `pregunta ${hay} «${t.slice(0, 120)}» · foco «${foco}» · vista ${e.vista} · cliente «${cliente}»`);
});
await caso("ord-81 «Salir sin guardar» sí sale", "", async p => {
  await capturar(p);
  await p.getByRole("button", { name: /^Cancelar$/ }).click(); await espera(p, 400);
  if (await hayPregunta(p)) { await pregunta(p).getByRole("button", { name: /Salir sin guardar/ }).click(); await espera(p, 400); }
  const e = await estado(p);
  ok("ord-81 «Salir sin guardar» sí sale", e.vista !== "form", `vista ${e.vista}`);
});
await caso("ord-82 sin nada capturado, «Cancelar» sale sin preguntar", "", async p => {
  await p.getByRole("button", { name: /^Cancelar$/ }).click(); await espera(p, 400);
  ok("ord-82 sin nada capturado, «Cancelar» sale sin preguntar", !(await hayPregunta(p)) && (await estado(p)).vista !== "form", `vista ${(await estado(p)).vista}`);
});
await caso("ord-83 ir a otra vista desde el menú con algo capturado pregunta; Esc se queda", "", async p => {
  await capturar(p);
  await p.locator("#ir-pipeline").click(); await espera(p, 400);
  const hay = await hayPregunta(p);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const e = await estado(p), cliente = await valor(p, "Cliente (escribe para buscar)");
  ok("ord-83 ir a otra vista desde el menú con algo capturado pregunta; Esc se queda", hay && e.vista === "form" && cliente === "COSQUIM", `pregunta ${hay} · vista ${e.vista} · cliente «${cliente}»`);
});
await caso("ord-84 al editar: sin cambios sale directo; con un cambio, pregunta", "modo=editar&rol=admin", async p => {
  await p.getByRole("button", { name: /^Cancelar$/ }).click(); await espera(p, 400);
  const directo = !(await hayPregunta(p)) && (await estado(p)).vista !== "form";
  await editar(p, "OP-ED");
  await p.locator("textarea").first().fill("Recetas · cambio sin guardar");
  await p.getByRole("button", { name: /^Cancelar$/ }).click(); await espera(p, 400);
  const pregunto = await hayPregunta(p);
  ok("ord-84 al editar: sin cambios sale directo; con un cambio, pregunta", directo && pregunto, `sin cambios sale directo ${directo} · con cambio pregunta ${pregunto}`);
});
await caso("ord-85 cerrar la pestaña o F5 con algo capturado lo advierte (sin nada, no)", "", async p => {
  const limpio = await p.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  await capturar(p);
  const sucio = await p.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  ok("ord-85 cerrar la pestaña o F5 con algo capturado lo advierte (sin nada, no)", !limpio && sucio, `sin nada ${limpio} · con algo ${sucio}`);
});
// ── Replicar no pisa lo escrito; Enter en «Tipo» respeta lo escrito ──
const replicar = async (p, pn = "P-0648") => { await p.getByRole("button", { name: /Replicar de orden anterior/ }).click(); await espera(p, 800); await p.getByText(pn).first().click(); await espera(p, 1200); };
await caso("ord-90 «Replicar» sólo llena lo vacío: la cantidad escrita se queda, y el aviso dice qué dejó", "", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "COS"); await espera(p, 600);
  await p.getByText("COSQUIM", { exact: true }).first().click(); await espera(p, 500);
  await llenar(p, "Ejemplo · 1000", "250");
  await replicar(p);
  const cant = await valor(p, "Ejemplo · 1000"), papel = await valor(p, "Ejemplo · Couché, Bond..."), ultimo = (await avisos(p)).pop() || "";
  ok("ord-90 «Replicar» sólo llena lo vacío: la cantidad escrita se queda, y el aviso dice qué dejó", cant === "250" && /Couché adhesivo/.test(papel || "") && /cantidad/i.test(ultimo),
    `cantidad «${cant}» · papel «${papel}» · aviso «${ultimo}»`);
});
await caso("ord-91 «Deshacer» del aviso de Replicar regresa la forma como estaba", "", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "COS"); await espera(p, 600);
  await p.getByText("COSQUIM", { exact: true }).first().click(); await espera(p, 500);
  await replicar(p);
  const des = p.getByRole("button", { name: /^Deshacer$/ });
  const hay = (await des.count()) > 0;
  if (hay) { await des.first().click(); await espera(p, 400); }
  const papel = await valor(p, "Ejemplo · Couché, Bond...");
  ok("ord-91 «Deshacer» del aviso de Replicar regresa la forma como estaba", hay && papel === "", `«Deshacer» ${hay} · papel «${papel}»`);
});
await caso("ord-92 Enter en «Tipo» con un tipo que no está en la lista lo deja escrito", "", async p => {
  const tipo = p.getByPlaceholder("Escribe o busca un tipo...");
  await tipo.fill("Calendario de pared"); await espera(p, 200); await tipo.press("Enter"); await espera(p, 300);
  const v = await p.locator("#ff-tipo").inputValue();
  ok("ord-92 Enter en «Tipo» con un tipo que no está en la lista lo deja escrito", v === "Calendario de pared", `tipo «${v}»`);
});
// ── Los números: lo que no es número no se transforma en silencio ──
const intentaCrear = async (p) => { await crear(p); await espera(p, 900); return (await cuenta(p, "saveOrder ")) === 0; };
await caso("ord-100 cantidad «1.5»: se ve lo escrito, dice por qué y no deja crear", "", async p => {
  await capturar(p, { cantidad: "1.5" });
  const v = await valor(p, "Ejemplo · 1000"), t = await texto(p), frena = await intentaCrear(p);
  ok("ord-100 cantidad «1.5»: se ve lo escrito, dice por qué y no deja crear", v === "1.5" && /piezas enteras/i.test(t) && frena, `valor «${v}» · frena ${frena}`);
});
await caso("ord-101 cantidad «-5» y «1e3» no se vuelven 5 ni 13", "", async p => {
  await capturar(p, { cantidad: "-5" });
  const v1 = await valor(p, "Ejemplo · 1000"); await llenar(p, "Ejemplo · 1000", "1e3"); await espera(p, 200);
  const v2 = await valor(p, "Ejemplo · 1000"), frena = await intentaCrear(p);
  ok("ord-101 cantidad «-5» y «1e3» no se vuelven 5 ni 13", v1 === "-5" && v2 === "1e3" && frena, `«${v1}» · «${v2}» · frena ${frena}`);
});
await caso("ord-102 cantidad «1,500» se guarda como 1500", "", async p => {
  await capturar(p, { cantidad: "1,500" }); await crear(p); await espera(p, 1200);
  const sv = (await lineas(p, "saveOrder ")).pop() || "";
  ok("ord-102 cantidad «1,500» se guarda como 1500", /"quantity":1500\b/.test(sv), sv.slice(0, 160));
});
await caso("ord-103 precio negativo o con 3 decimales: dice por qué y no deja crear; «$1,500.50» se guarda 1500.5", "", async p => {
  await capturar(p);
  await llenar(p, "$0.00", "-500"); await espera(p, 200);
  const t1 = await texto(p), frena1 = await intentaCrear(p);
  await llenar(p, "$0.00", "1500.555"); await espera(p, 200);
  const frena2 = await intentaCrear(p);
  await llenar(p, "$0.00", "$1,500.50"); await espera(p, 200); await crear(p); await espera(p, 1200);
  const sv = (await lineas(p, "saveOrder ")).pop() || "";
  ok("ord-103 precio negativo o con 3 decimales: dice por qué y no deja crear; «$1,500.50» se guarda 1500.5", /precio/i.test(t1) && /negativ|signo/i.test(t1) && frena1 && frena2 && /"price":1500\.5\b/.test(sv),
    `frena -500 ${frena1} · frena 1500.555 ${frena2} · ${sv.slice(0, 120)}`);
});
await caso("ord-104 ancho «-10» o «0»: dice por qué y no deja crear", "", async p => {
  await capturar(p);
  await p.locator('input[aria-label="Ancho (cm)"], input#ff-ancho').first().fill("-10"); await espera(p, 200);
  const frena1 = await intentaCrear(p);
  await p.locator('input[aria-label="Ancho (cm)"], input#ff-ancho').first().fill("0"); await espera(p, 200);
  const frena2 = await intentaCrear(p), t = await texto(p);
  ok("ord-104 ancho «-10» o «0»: dice por qué y no deja crear", frena1 && frena2 && /ancho/i.test(t) && /mayor que 0|centímetros/i.test(t), `frena -10 ${frena1} · frena 0 ${frena2}`);
});
await caso("ord-105 gramaje con letras no se guarda vacío en silencio", "", async p => {
  await capturar(p);
  await llenar(p, "Ejemplo · 150", "ciento cincuenta"); await espera(p, 200);
  const frena = await intentaCrear(p), t = await texto(p);
  ok("ord-105 gramaje con letras no se guarda vacío en silencio", frena && /gramaje/i.test(t), `frena ${frena}`);
});
await caso("ord-106 una entrega en el pasado se avisa (no frena)", "", async p => {
  await capturar(p);
  await p.locator('input[type="date"]').first().fill("2020-01-15"); await espera(p, 300);
  const t = await texto(p);
  ok("ord-106 una entrega en el pasado se avisa (no frena)", /ya pasó/i.test(t), (t.match(/.{0,40}ya pasó.{0,40}/i) || [""])[0]);
});
// ── El teclado: foco visible, nada tapado por el pie, el cliente con flechas, las ventanas con su contrato ──
// v10.84.81 — el banco ya trae el estilo global de App (html{scroll-behavior:smooth}): enfocar con Tab desplaza con una animación; lo que
// cuenta es dónde QUEDA el campo cuando la página deja de moverse (hasta 1.5 s)
const quieta = p => p.evaluate(() => new Promise(listo => { let y = scrollY, iguales = 0, t0 = performance.now();
  const ver = () => { if (scrollY === y) iguales++; else { iguales = 0; y = scrollY; } if (iguales >= 3 || performance.now() - t0 > 1500) listo(); else requestAnimationFrame(ver); };
  requestAnimationFrame(ver); }));
await caso("ord-110 los campos de texto muestran el foco (anillo)", "", async p => {
  const c = p.getByPlaceholder("Cliente (escribe para buscar)");
  await c.evaluate(e => e.blur()); await espera(p, 100);   // v10.84.81: la forma abre con el foco en el cliente; «antes» es sin foco
  const antes = await c.evaluate(e => getComputedStyle(e).boxShadow);
  await c.focus(); await espera(p, 150);
  const despues = await c.evaluate(e => getComputedStyle(e).boxShadow + " | " + getComputedStyle(e).outlineStyle);
  ok("ord-110 los campos de texto muestran el foco (anillo)", despues.split(" | ")[0] !== antes || !/none/.test(despues.split(" | ")[1]), `antes «${antes}» · con foco «${despues}»`);
});
await caso("ord-111 con Tab, ningún campo enfocado queda debajo del pie fijo", "", async p => {
  await p.getByPlaceholder("Cliente (escribe para buscar)").focus();
  const tapados = [];
  for (let i = 0; i < 70; i++) {
    await p.keyboard.press("Tab"); await espera(p, 60); await quieta(p);
    const r = await p.evaluate(() => {
      const a = document.activeElement, f = document.querySelector("h2 + div"); if (!a || !f || !f.contains(a)) return null;
      const pie = [...f.querySelectorAll("div")].find(d => getComputedStyle(d).position === "sticky"); if (!pie || pie.contains(a)) return null;
      const ra = a.getBoundingClientRect(), rp = pie.getBoundingClientRect();
      return ra.bottom > rp.top + 1 ? (a.getAttribute("aria-label") || a.placeholder || a.textContent || a.tagName).trim().slice(0, 30) : "";
    });
    if (r) tapados.push(r);
  }
  ok("ord-111 con Tab, ningún campo enfocado queda debajo del pie fijo", tapados.length === 0, `tapados ${tapados.length}: ${[...new Set(tapados)].slice(0, 8).join(" | ")}`);
});
await caso("ord-112 el cliente se elige con flechas y Enter", "", async p => {
  const c = p.getByPlaceholder("Cliente (escribe para buscar)");
  await c.fill("COS"); await espera(p, 700);
  await c.press("ArrowDown"); await c.press("Enter"); await espera(p, 700);
  const correo = await valor(p, "correo@ej.com"), elegidos = await cuenta(p, "rpc get_client_seller_label");
  ok("ord-112 el cliente se elige con flechas y Enter", correo === "compras@cosquim.mx" && elegidos === 1, `correo «${correo}» · elegido ${elegidos}`);
});
await caso("ord-113 escrito completo y con Tab, el cliente que existe se elige (no sale «Cliente nuevo»)", "", async p => {
  const c = p.getByPlaceholder("Cliente (escribe para buscar)");
  await c.fill("COSQUIM"); await espera(p, 700); await c.press("Tab"); await espera(p, 700);
  const correo = await valor(p, "correo@ej.com"), t = await texto(p);
  ok("ord-113 escrito completo y con Tab, el cliente que existe se elige (no sale «Cliente nuevo»)", correo === "compras@cosquim.mx" && !/Cliente nuevo/.test(t), `correo «${correo}» · «Cliente nuevo» ${/Cliente nuevo/.test(t)}`);
});
await caso("ord-114 «Replicar»: ventana con nombre, el foco adentro, Tab no se sale y la orden se elige con Enter", "", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "COS"); await espera(p, 600);
  await p.getByText("COSQUIM", { exact: true }).first().click(); await espera(p, 500);
  await p.getByRole("button", { name: /Replicar de orden anterior/ }).click(); await espera(p, 800);
  const d = p.getByRole("dialog", { name: /Replicar/ });
  const conNombre = (await d.count()) > 0;
  let dentro = true;
  for (let i = 0; i < 12; i++) { await p.keyboard.press("Tab"); await espera(p, 50); dentro = dentro && await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')); }
  const ficha = p.getByRole("button", { name: /P-0648/ });
  const hayFicha = (await ficha.count()) > 0;
  if (hayFicha) { await ficha.first().focus(); await p.keyboard.press("Enter"); await espera(p, 1200); }
  const papel = await valor(p, "Ejemplo · Couché, Bond...");
  ok("ord-114 «Replicar»: ventana con nombre, el foco adentro, Tab no se sale y la orden se elige con Enter", conNombre && dentro && hayFicha && /Couché/.test(papel || ""),
    `con nombre ${conNombre} · Tab adentro ${dentro} · ficha botón ${hayFicha} · papel «${papel}»`);
});
await caso("ord-115 «Nuevo agente de compras»: ventana con nombre, foco adentro, Esc cierra, Tab no se sale y el clic fuera no tira lo escrito", "", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "COS"); await espera(p, 600);
  await p.getByText("COSQUIM", { exact: true }).first().click(); await espera(p, 500);
  await llenar(p, "Quién pide por parte del cliente (ej. Eva)", "Rosa"); await espera(p, 300);
  await p.getByRole("button", { name: /Registrar "Rosa"/ }).click(); await espera(p, 400);
  const d = p.getByRole("dialog", { name: /agente de compras/i });
  const conNombre = (await d.count()) > 0, foco = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  await p.keyboard.type("4771234567"); await espera(p, 100);
  let dentro = true;
  for (let i = 0; i < 8; i++) { await p.keyboard.press("Tab"); await espera(p, 50); dentro = dentro && await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')); }
  await p.mouse.click(8, 300); await espera(p, 300);
  const sigue = (await d.count()) > 0, tel = sigue ? await p.getByPlaceholder("Celular / WhatsApp").inputValue().catch(() => "") : "";
  await p.keyboard.press("Escape"); await espera(p, 300);
  const cerro = (await d.count()) === 0;
  ok("ord-115 «Nuevo agente de compras»: ventana con nombre, foco adentro, Esc cierra, Tab no se sale y el clic fuera no tira lo escrito",
    conNombre && foco && dentro && sigue && /4771234567/.test(tel) && cerro, `nombre ${conNombre} · foco ${foco} · Tab adentro ${dentro} · sigue tras clic fuera ${sigue} («${tel}») · Esc cierra ${cerro}`);
});
await caso("ord-116 todos los campos tienen nombre (no sólo el texto de ejemplo) y las opciones dicen cuál está elegida", "", async p => {
  const r = await p.evaluate(() => {
    const f = document.querySelector("h2 + div");
    const campos = [...f.querySelectorAll("input,textarea,select")].filter(e => e.type !== "file" && e.type !== "hidden" && e.offsetParent);
    const sin = campos.filter(e => !(e.labels?.length || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby"))).map(e => e.placeholder || e.type);
    const prio = [...f.querySelectorAll("button")].filter(b => /^(Urgente|Normal|Baja)$/.test(b.textContent.trim()));
    return { total: campos.length, sin, prio: prio.map(b => b.textContent.trim() + "=" + b.getAttribute("aria-pressed")) };
  });
  ok("ord-116 todos los campos tienen nombre (no sólo el texto de ejemplo) y las opciones dicen cuál está elegida", r.sin.length === 0 && r.prio.length === 3 && r.prio.includes("Normal=true"),
    `sin nombre ${r.sin.length} de ${r.total}: ${r.sin.slice(0, 6).join(" | ")} · prioridad ${r.prio.join(" ")}`);
});
// ── Se lee: AA y tamaños (en las vistas de la forma) ──
const legibilidad = p => p.evaluate(() => {
  const f = document.querySelector("h2 + div"); if (!f) return { malos: ["sin forma"], chicos: [] };
  const rgba = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(",").map(x => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const sobre = (arriba, abajo) => ({ r: arriba.r * arriba.a + abajo.r * (1 - arriba.a), g: arriba.g * arriba.a + abajo.g * (1 - arriba.a), b: arriba.b * arriba.a + abajo.b * (1 - arriba.a), a: 1 });
  const fondo = el => { const capas = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a >= 0.99) break; } }
    let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = capas.length - 1; i >= 0; i--) base = sobre(capas[i], base); return base; };
  const L = ({ r, g, b }) => { const t = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * t(r) + 0.7152 * t(g) + 0.0722 * t(b); };
  const malos = [], chicos = [];
  const w = document.createTreeWalker(f, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || !el.offsetParent || el.closest('[role="dialog"]')) continue;
    if (el.closest("button:disabled,input:disabled,[aria-disabled='true']")) continue;   // lo apagado no cuenta (WCAG)
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.5) continue;
    const fg0 = rgba(cs.color); if (!fg0) continue; const bg = fondo(el), fg = sobre(fg0, bg);
    const a = L(fg), b = L(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const tam = parseFloat(cs.fontSize), negrita = parseInt(cs.fontWeight, 10) >= 700, grande = tam >= 18.66 || (tam >= 14 && negrita);
    if (ratio < (grande ? 3 : 4.5)) malos.push(t.slice(0, 28) + " " + ratio.toFixed(2));
    const etiqueta = cs.textTransform === "uppercase";
    if (tam < 10 || (!etiqueta && tam < 11)) chicos.push(t.slice(0, 24) + " " + tam + "px");
  }
  return { malos: [...new Set(malos)], chicos: [...new Set(chicos)] };
});
for (const [id, q, prep] of [["nueva", "", null], ["maquila", "", async p => { await p.getByText("Maquila Completa").first().click(); await espera(p, 400); }],
  ["faltantes", "", async p => { await crear(p); await espera(p, 600); }], ["facturada", "modo=editar&rol=admin", async p => { await editar(p, "OP-FA"); }],
  ["vendedor", "modo=editar&rol=vendedor", async p => { await editar(p, "OP-ED"); }]]) {
  await caso(`ord-120-${id} se lee: todo el texto de la forma con contraste AA (${id})`, q, async p => {
    if (prep) await prep(p);
    const r = await legibilidad(p);
    ok(`ord-120-${id} se lee: todo el texto de la forma con contraste AA (${id})`, r.malos.length === 0, `${r.malos.length} bajo AA: ${r.malos.slice(0, 8).join(" | ")}`);
  });
}
await caso("ord-121 nada de letra de 9 px, y lo que no es etiqueta de al menos 11 px", "", async p => {
  await capturar(p);
  const r = await legibilidad(p);
  ok("ord-121 nada de letra de 9 px, y lo que no es etiqueta de al menos 11 px", r.chicos.length === 0, `${r.chicos.length}: ${r.chicos.slice(0, 10).join(" | ")}`);
});
// ── Las palabras ──
await caso("ord-122 sin emoji ni jerga interna en la forma («white-label», «soft-delete», «pool», «Fase 2»)", "", async p => {
  await p.getByText("Maquila Completa").first().click(); await espera(p, 300);
  await p.getByText("Producción Interna").first().click(); await espera(p, 300);
  await abrirMas(p); await p.locator('input[type="checkbox"]').nth(1).check(); await espera(p, 200);
  const t = await forma(p).innerText();
  const emoji = t.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [];
  ok("ord-122 sin emoji ni jerga interna en la forma («white-label», «soft-delete», «pool», «Fase 2»)", emoji.length === 0 && !/white-label|soft-delete|pool compartido|Fase 2/i.test(t),
    `emoji ${[...new Set(emoji)].join(" ")} · jerga ${(t.match(/white-label|soft-delete|pool compartido|Fase 2/gi) || []).join(", ")}`);
});
await caso("ord-123 «Sin empaque de SYGMA» marcado no se pinta como error ni grita (role=alert)", "", async p => {
  await abrirMas(p); await p.locator('input[type="checkbox"]').nth(1).check(); await espera(p, 200);
  const r = await p.evaluate(() => {
    const t = [...document.querySelectorAll("div")].find(d => /^Sin empaque de SYGMA$/.test(d.textContent.trim()));
    const caja = t?.closest("label")?.parentElement;
    return { alerta: !!caja?.querySelector('[role="alert"]'), color: t ? getComputedStyle(t).color : "" };
  });
  ok("ord-123 «Sin empaque de SYGMA» marcado no se pinta como error ni grita (role=alert)", !r.alerta && !/224, 59, 48|185, 28, 28/.test(r.color), JSON.stringify(r));
});
await caso("ord-124 «Cliente nuevo» no salta con dos letras escritas; sale al dejar el campo con un nombre que no existe", "", async p => {
  const c = p.getByPlaceholder("Cliente (escribe para buscar)");
  await c.fill("CO"); await espera(p, 600);
  const temprano = /Cliente nuevo/.test(await texto(p));
  await c.fill("ZZ PRUEBA CLAUDE SA"); await c.press("Tab"); await espera(p, 500);
  const despues = /Cliente nuevo/.test(await texto(p));
  ok("ord-124 «Cliente nuevo» no salta con dos letras escritas; sale al dejar el campo con un nombre que no existe", !temprano && despues, `con dos letras ${temprano} · al salir ${despues}`);
});
await caso("ord-125 el contacto dice «correo o WhatsApp» (uno de los dos) y el RFC lleva * con cliente nuevo", "", async p => {
  const c = p.getByPlaceholder("Cliente (escribe para buscar)");
  await c.fill("ZZ PRUEBA CLAUDE SA"); await c.press("Tab"); await espera(p, 400);
  const r = await p.evaluate(() => [...document.querySelectorAll("label")].map(l => l.textContent.replace(/\s+/g, " ").trim()));
  const unoDeDos = r.some(t => /email/i.test(t) && /whatsapp/i.test(t)) || r.some(t => /o WhatsApp|o email|o correo/i.test(t));
  ok("ord-125 el contacto dice «correo o WhatsApp» (uno de los dos) y el RFC lleva * con cliente nuevo", unoDeDos && r.some(t => /^RFC\s*\*/.test(t)), `etiquetas ${r.filter(t => /mail|whats|rfc/i.test(t)).join(" | ")}`);
});
await caso("ord-126 «Replicar» cuenta bien: «1 orden», «2 órdenes»", "", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "PORT"); await espera(p, 600);
  await p.getByText("PORTLAND LEATHER", { exact: true }).first().click(); await espera(p, 500);
  await p.getByRole("button", { name: /Replicar de orden anterior/ }).click(); await espera(p, 800);
  const t = await texto(p);
  ok("ord-126 «Replicar» cuenta bien: «1 orden», «2 órdenes»", /1 orden\b/.test(t) && !/1 órdenes/.test(t), (t.match(/\d+ órdenes?[^·]{0,20}/) || [""])[0]);
});
await caso("ord-127 si la base no deja revisar el cliente, lo dice en palabras (no «Error resolviendo cliente»)", "cliente=permiso", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "ZZ PRUEBA CLAUDE SA"); await llenar(p, "correo@ej.com", "prueba@ejemplo.com");
  await llenar(p, "XAXX010101000", "ZZZ010101AAA"); await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", "1000"); await elegirVendedor(p, "Manuel");
  await crear(p); await espera(p, 900);
  const al = (await alertasEnLaForma(p)).map(a => a.t).join(" | ");
  ok("ord-127 si la base no deja revisar el cliente, lo dice en palabras (no «Error resolviendo cliente»)", /no tienes permiso/i.test(al) && !/Error resolviendo|permission denied/i.test(al), al);
});
await caso("ord-128 el aviso de abajo no tapa «Crear Orden»", "", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "COS"); await espera(p, 600);
  await p.getByText("COSQUIM", { exact: true }).first().click(); await espera(p, 500);
  await replicar(p);
  const r = await p.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(x => /Crear Orden/.test(x.textContent)); const t = [...document.querySelectorAll('[role="status"],[role="alert"]')].find(x => getComputedStyle(x).position === "fixed");
    if (!b || !t) return { hay: !!t };
    const rb = b.getBoundingClientRect(), rt = t.getBoundingClientRect();
    return { hay: true, tapa: !(rt.bottom <= rb.top || rt.top >= rb.bottom || rt.right <= rb.left || rt.left >= rb.right) };
  });
  ok("ord-128 el aviso de abajo no tapa «Crear Orden»", r.hay && !r.tapa, JSON.stringify(r));
});
await caso("ord-129 la tarjeta de Pre-prensa y la forma llaman igual a lo mismo («Specs y archivo»), sin prometer que borra el archivo viejo", "", async p => {
  const src = fs.readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
  ok("ord-129 la tarjeta de Pre-prensa y la forma llaman igual a lo mismo («Specs y archivo»), sin prometer que borra el archivo viejo",
    !/Gestionar Archivo/.test(src) && !/Borra el archivo viejo/.test(src) && /Specs y archivo/.test(src), "lee src/App.jsx");
});

// ── Vuelta 2 de v10.84.78: por donde no se diseñó ──
await caso("ord-140 doble Ctrl+Enter con la pregunta de salir abierta: no guarda por debajo", "", async p => {
  await capturar(p);
  await p.getByRole("button", { name: /^Cancelar$/ }).click(); await espera(p, 400);
  await p.keyboard.press("Control+Enter"); await espera(p, 300); await p.keyboard.press("Control+Enter"); await espera(p, 1200);
  const sigue = await hayPregunta(p), guardo = await cuenta(p, "saveOrder ");
  ok("ord-140 doble Ctrl+Enter con la pregunta de salir abierta: no guarda por debajo", sigue && guardo === 0, `pregunta abierta ${sigue} · saveOrder ${guardo}`);
});
await caso("ord-141 a 683×384, con Tab, ningún campo enfocado queda debajo del pie fijo", "", async p => {
  await p.getByPlaceholder("Cliente (escribe para buscar)").focus();
  const tapados = [];
  for (let i = 0; i < 70; i++) {
    await p.keyboard.press("Tab"); await espera(p, 60); await quieta(p);
    const r = await p.evaluate(() => {
      const a = document.activeElement, f = document.querySelector("h2 + div"); if (!a || !f || !f.contains(a)) return null;
      const pie = [...f.querySelectorAll("div")].find(d => getComputedStyle(d).position === "sticky"); if (!pie || pie.contains(a)) return null;
      const ra = a.getBoundingClientRect(), rp = pie.getBoundingClientRect();
      return ra.bottom > rp.top + 1 ? (a.getAttribute("aria-label") || a.placeholder || a.textContent || a.tagName).trim().slice(0, 30) : "";
    });
    if (r) tapados.push(r);
  }
  ok("ord-141 a 683×384, con Tab, ningún campo enfocado queda debajo del pie fijo", tapados.length === 0, `tapados ${tapados.length}: ${[...new Set(tapados)].slice(0, 8).join(" | ")}`);
}, { width: 683, height: 384 });
await caso("ord-142 desde el menú, «Salir sin guardar» sí se va a donde se pidió", "", async p => {
  await capturar(p);
  await p.locator("#ir-orders").click(); await espera(p, 400);
  if (await hayPregunta(p)) { await pregunta(p).getByRole("button", { name: /Salir sin guardar/ }).click(); await espera(p, 400); }
  ok("ord-142 desde el menú, «Salir sin guardar» sí se va a donde se pidió", (await estado(p)).vista === "orders", `vista ${(await estado(p)).vista}`);
});
await caso("ord-143 «Deshacer» de Replicar antes de que termine de copiar la imagen: la imagen no llega después", "img=lento&lento=2", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "COS"); await espera(p, 600);
  await p.getByText("COSQUIM", { exact: true }).first().click(); await espera(p, 500);
  await p.getByRole("button", { name: /Replicar de orden anterior/ }).click(); await espera(p, 800);
  await p.getByText("P-0648").first().click(); await espera(p, 300);
  await p.getByRole("button", { name: /^Deshacer$/ }).first().click(); await espera(p, 3500);
  const imgs = await p.getByRole("button", { name: "Quitar imagen" }).count(), papel = await valor(p, "Ejemplo · Couché, Bond...");
  ok("ord-143 «Deshacer» de Replicar antes de que termine de copiar la imagen: la imagen no llega después", imgs === 0 && papel === "", `imágenes ${imgs} · papel «${papel}»`);
});
await caso("ord-144 con una cantidad mal escrita, Replicar no la pisa: se queda lo escrito y lo dice", "", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "COS"); await espera(p, 600);
  await p.getByText("COSQUIM", { exact: true }).first().click(); await espera(p, 500);
  await llenar(p, "Ejemplo · 1000", "1.5");
  await replicar(p);
  const v = await valor(p, "Ejemplo · 1000"), ultimo = (await avisos(p)).pop() || "";
  ok("ord-144 con una cantidad mal escrita, Replicar no la pisa: se queda lo escrito y lo dice", v === "1.5" && /cantidad/.test(ultimo), `cantidad «${v}» · aviso «${ultimo}»`);
});
await caso("ord-145 se lee también con todo encendido (sin empaque, distribución, cliente nuevo, errores de números)", "", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "ZZ PRUEBA CLAUDE SA"); await p.getByPlaceholder("Cliente (escribe para buscar)").press("Tab"); await espera(p, 400);
  await abrirMas(p); await p.locator('input[type="checkbox"]').nth(0).check(); await p.locator('input[type="checkbox"]').nth(1).check();
  await llenar(p, "Ejemplo · 1000", "-5"); await llenar(p, "$0.00", "1.555"); await llenar(p, "Ejemplo · 150", "mucho");
  await crear(p); await espera(p, 600);
  const r = await legibilidad(p);
  ok("ord-145 se lee también con todo encendido (sin empaque, distribución, cliente nuevo, errores de números)", r.malos.length === 0 && r.chicos.length === 0,
    `bajo AA ${r.malos.slice(0, 6).join(" | ")} · chicos ${r.chicos.slice(0, 6).join(" | ")}`);
});
await caso("ord-146 con el pie más alto (un rechazo en el pie), el aviso de abajo tampoco tapa el botón", "folio=falla", async p => {
  await capturar(p); await crear(p); await espera(p, 1200);
  await replicar(p);
  const r = await p.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(x => /Crear Orden/.test(x.textContent)); const t = [...document.querySelectorAll('[role="status"],[role="alert"]')].find(x => getComputedStyle(x).position === "fixed");
    if (!b || !t) return { hay: !!t };
    const rb = b.getBoundingClientRect(), rt = t.getBoundingClientRect();
    return { hay: true, tapa: !(rt.bottom <= rb.top || rt.top >= rb.bottom || rt.right <= rb.left || rt.left >= rb.right) };
  });
  ok("ord-146 con el pie más alto (un rechazo en el pie), el aviso de abajo tampoco tapa el botón", r.hay && !r.tapa, JSON.stringify(r));
});
await caso("ord-147 el atajo N y «Editar» (con otra captura abierta) pasan por la pregunta de salir (código)", "", async p => {
  const src = fs.readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
  const n = (src.match(/salirDeLaForma\(/g) || []).length;
  const atajo = /const nueva=\(\)=>\{setEditO\(null\); setView\("form"\)\}; if\(!salirDeLaForma\(nueva\)\)nueva\(\);/.test(src);
  ok("ord-147 el atajo N y «Editar» (con otra captura abierta) pasan por la pregunta de salir (código)", n >= 6 && atajo, `llamadas ${n} · atajo N ${atajo}`);
});
await caso("ord-148 cambiar a Maquila y regresar a Interna no cuenta como capturado", "", async p => {
  await p.getByText("Maquila Completa").first().click(); await espera(p, 200);
  await p.getByText("Producción Interna").first().click(); await espera(p, 200);
  await p.getByRole("button", { name: /^Cancelar$/ }).click(); await espera(p, 400);
  ok("ord-148 cambiar a Maquila y regresar a Interna no cuenta como capturado", !(await hayPregunta(p)) && (await estado(p)).vista !== "form", `pregunta ${await hayPregunta(p)}`);
});
await caso("ord-149 cantidad «0»: dice que va mayor que 0", "", async p => {
  await capturar(p, { cantidad: "0" });
  const t = await texto(p), frena = await intentaCrear(p);
  ok("ord-149 cantidad «0»: dice que va mayor que 0", /mayor que 0/.test(t) && frena, `frena ${frena}`);
});
await caso("ord-150 Esc en la lista de clientes la cierra y no pregunta nada ni sale", "", async p => {
  const c = p.getByPlaceholder("Cliente (escribe para buscar)");
  await c.fill("COS"); await espera(p, 700);
  const abierta = await p.locator('[role="listbox"]').count();
  await c.press("Escape"); await espera(p, 300);
  const cerrada = await p.locator('[role="listbox"]').count();
  ok("ord-150 Esc en la lista de clientes la cierra y no pregunta nada ni sale", abierta === 1 && cerrada === 0 && !(await hayPregunta(p)) && (await estado(p)).vista === "form", `abierta ${abierta} · después ${cerrada}`);
});

// ════ v10.84.79 — el reacomodo: lo esencial en la primera pantalla de la laptop, dos columnas en la grande, la chica sin rodeos ════
// (Marcelo, 12-oct: «P1, P2 y reacomodo». Medido en 60 días: imagen 94 %, notas 56 %, placa 52 %, agente de compras 42 % se quedan a la
//  vista; distribución 8 %, sin empaque 7 % y archivo de producción 1 % van a «Más de esta orden».)
await caso("ord-160 a 1366×768 la primera pantalla ya trae cliente, tipo, cantidad y entrega", "", async p => {
  await p.evaluate(() => scrollTo(0, 0)); await espera(p, 200);
  const top = await pieTop(p), r = { cliente: await rect(p, "#ff-cliente-input"), tipo: await rect(p, "#ff-tipo"), cantidad: await rect(p, "#ff-cantidad"), entrega: await rect(p, "#ff-entrega") };
  const fuera = Object.entries(r).filter(([, v]) => !v || v.bottom > top).map(([k, v]) => k + (v ? "@" + Math.round(v.top) : ""));
  ok("ord-160 a 1366×768 la primera pantalla ya trae cliente, tipo, cantidad y entrega", fuera.length === 0, `pie en ${Math.round(top)} · fuera: ${fuera.join(", ") || "ninguno"}`);
});
await caso("ord-161 a 1366×768 el precio y el vendedor quedan a menos de pantalla y media", "", async p => {
  await p.evaluate(() => scrollTo(0, 0)); await espera(p, 200);
  const precio = await rect(p, "#ff-precio"), vend = await rect(p, "#ff-agent");
  ok("ord-161 a 1366×768 el precio y el vendedor quedan a menos de pantalla y media", !!precio && !!vend && precio.top < 768 * 1.5 && vend.top < 768 * 1.5,
    `precio @${precio && Math.round(precio.top)} · vendedor @${vend && Math.round(vend.top)} (antes 1861 y 1644)`);
});
await caso("ord-162 a 1920×1080 son dos columnas y todo lo esencial cabe sin desplazar", "", async p => {
  await p.evaluate(() => scrollTo(0, 0)); await espera(p, 200);
  const top = await pieTop(p), cli = await rect(p, "#ff-cliente-input"), papel = await rect(p, "#ff-papel"), precio = await rect(p, "#ff-precio"), vend = await rect(p, "#ff-agent");
  const dos = !!cli && !!papel && papel.left >= cli.right - 2;
  ok("ord-162 a 1920×1080 son dos columnas y todo lo esencial cabe sin desplazar", dos && !!precio && precio.bottom <= top && !!vend && vend.top < top,
    `dos columnas ${dos} · precio @${precio && Math.round(precio.bottom)} · vendedor @${vend && Math.round(vend.top)} · pie ${Math.round(top)}`);
}, { width: 1920, height: 1080 });
await caso("ord-163 a 683×384 sin desplazar a lo ancho, el primer campo a la vista, el pie chico y los campos con ancho para escribir", "", async p => {
  await p.evaluate(() => scrollTo(0, 0)); await espera(p, 200);
  const r = await p.evaluate(() => ({ ancho: document.documentElement.scrollWidth, vista: innerWidth }));
  const top = await pieTop(p), cli = await rect(p, "#ff-cliente-input"), wa = await rect(p, "#ff-whatsapp"), cant = await rect(p, "#ff-cantidad");
  const pieAlto = 384 - top;
  ok("ord-163 a 683×384 sin desplazar a lo ancho, el primer campo a la vista, el pie chico y los campos con ancho para escribir",
    r.ancho <= r.vista + 1 && !!cli && cli.bottom <= top && pieAlto <= 384 * 0.25 && !!wa && wa.width >= 120 && !!cant && cant.width >= 120,
    `ancho ${r.ancho}/${r.vista} · cliente @${cli && Math.round(cli.bottom)} · pie ${Math.round(pieAlto)} px · WhatsApp ${wa && Math.round(wa.width)} · cantidad ${cant && Math.round(cant.width)}`);
}, { width: 683, height: 384 });
await caso("ord-164 «Más de esta orden» empieza cerrado en una orden nueva y, cerrado, dice lo que trae marcado", "", async p => {
  const b = p.getByRole("button", { name: /Más de esta orden/ });
  const hay = (await b.count()) > 0, cerrado = hay && (await b.first().getAttribute("aria-expanded")) === "false";
  const sinCasillas = (await p.locator('input[type="checkbox"]').count()) === 0;
  if (hay) { await abrirMas(p); await p.locator('input[type="checkbox"]').nth(1).check(); await espera(p, 200); await clic(b); await espera(p, 300); }
  const t = hay ? await b.first().innerText() : "";
  ok("ord-164 «Más de esta orden» empieza cerrado en una orden nueva y, cerrado, dice lo que trae marcado", hay && cerrado && sinCasillas && /Sin empaque de SYGMA/.test(t) && !/distribución a varios lugares/.test(t),
    `botón ${hay} · cerrado ${cerrado} · sin casillas a la vista ${sinCasillas} · «${t.replace(/\s+/g, " ")}»`);
});
await caso("ord-165 una orden con distribución abre «Más de esta orden» ya abierto", "modo=editar&rol=admin", async p => {
  await p.evaluate(() => { const o = window.__estado().base.find(x => x.id === "OP-ED"); o.distribution = ["Sucursal Centro", "Sucursal Norte"]; });
  await editar(p, "OP-ED");
  const b = p.getByRole("button", { name: /Más de esta orden/ }), abierto = (await b.count()) && (await b.first().getAttribute("aria-expanded")) === "true";
  ok("ord-165 una orden con distribución abre «Más de esta orden» ya abierto", !!abierto && (await p.getByPlaceholder(/Lugar y dirección/).count()) === 2, `abierto ${abierto}`);
});
await caso("ord-166 Pre-prensa ve el archivo de producción sin abrir nada", "modo=specs&rol=preprensa", async p => {
  ok("ord-166 Pre-prensa ve el archivo de producción sin abrir nada", (await p.getByText(/Archivo de Producción/i).count()) > 0 && (await p.getByText(/Subir archivo/).count()) > 0, "");
});
await caso("ord-167 interna o maquila y la prioridad van juntas arriba, en un renglón", "", async p => {
  await p.evaluate(() => scrollTo(0, 0)); await espera(p, 200);
  const r = await p.evaluate(() => { const b = t => [...document.querySelectorAll("button")].find(x => x.textContent.includes(t))?.getBoundingClientRect(); const a = b("Producción Interna"), n = b("Normal"); return a && n ? { a: a.top, n: n.top, alto: a.height } : null; });
  ok("ord-167 interna o maquila y la prioridad van juntas arriba, en un renglón", !!r && Math.abs(r.a - r.n) < 12 && r.alto <= 52, JSON.stringify(r));
});

// ── Vuelta 2 de v10.84.79: por donde no se diseñó ──
await caso("ord-170 cerrado, «Más de esta orden» dice cuántos lugares lleva la distribución", "", async p => {
  await abrirMas(p);
  await p.locator('input[type="checkbox"]').nth(0).check(); await espera(p, 200);
  await p.getByPlaceholder(/Lugar y dirección/).first().fill("Sucursal Centro");
  await p.getByRole("button", { name: /Agregar lugar/ }).click(); await espera(p, 200);
  await p.getByPlaceholder(/Lugar y dirección/).nth(1).fill("Sucursal Norte");
  await clic(p.getByRole("button", { name: /Más de esta orden/ })); await espera(p, 300);
  const t = await p.getByRole("button", { name: /Más de esta orden/ }).first().innerText();
  ok("ord-170 cerrado, «Más de esta orden» dice cuántos lugares lleva la distribución", /2 lugares/.test(t), `«${t.replace(/\s+/g, " ")}»`);
});
await caso("ord-171 maquila a 1920: dos columnas y proveedor, costo y precio a la vista sin desplazar", "", async p => {
  await p.getByText("Maquila Completa").first().click(); await espera(p, 400);
  await p.evaluate(() => scrollTo(0, 0)); await espera(p, 200);
  const top = await pieTop(p), prov = await rect(p, "#ff-maq"), precio = await rect(p, "#ff-maq-precio"), notas = await rect(p, "#ff-notas");   // maquila no lleva especificaciones: las notas van a la derecha
  const dos = !!prov && !!notas && notas.left >= prov.right - 2;
  ok("ord-171 maquila a 1920: dos columnas y proveedor, costo y precio a la vista sin desplazar", dos && !!precio && precio.bottom <= top, `dos columnas ${dos} · proveedor @${prov && Math.round(prov.top)} · precio @${precio && Math.round(precio.bottom)} · pie ${Math.round(top)}`);
}, { width: 1920, height: 1080 });
await caso("ord-172 Pre-prensa a 1366: las especificaciones y el archivo a la vista", "modo=specs&rol=preprensa", async p => {
  await p.evaluate(() => scrollTo(0, 0)); await espera(p, 200);
  const top = await pieTop(p), papel = await rect(p, "#ff-papel");
  const subir = await p.evaluate(() => { const e = [...document.querySelectorAll("label, button")].find(x => /Subir archivo/.test(x.textContent)); return e ? e.getBoundingClientRect().top : null; });
  ok("ord-172 Pre-prensa a 1366: las especificaciones y el archivo a la vista", !!papel && papel.bottom <= top && subir !== null && subir < 768 * 1.5, `papel @${papel && Math.round(papel.bottom)} · subir archivo @${subir && Math.round(subir)} · pie ${Math.round(top)}`);
});
await caso("ord-173 se lee también a 683×384 con maquila elegida (el renglón chico de arriba)", "", async p => {
  await p.getByRole("button", { name: /^Maquila/ }).first().click(); await espera(p, 300);   // a 683 dice «Maquila» (v10.84.79, vuelta 3)
  const r = await legibilidad(p);
  ok("ord-173 se lee también a 683×384 con maquila elegida (el renglón chico de arriba)", r.malos.length === 0 && r.chicos.length === 0, `bajo AA ${r.malos.slice(0, 6).join(" | ")} · chicos ${r.chicos.slice(0, 6).join(" | ")}`);
}, { width: 683, height: 384 });
await caso("ord-174 a dos columnas, Tab va de la izquierda a la derecha sin regresarse", "", async p => {
  await p.getByPlaceholder("Cliente (escribe para buscar)").focus();
  const xs = [];
  for (let i = 0; i < 60; i++) {
    await p.keyboard.press("Tab"); await espera(p, 40);
    const r = await p.evaluate(() => { const a = document.activeElement, f = document.querySelector("h2 + div"); if (!a || !f || !f.contains(a)) return null;
      const pie = [...f.querySelectorAll("div")].find(d => getComputedStyle(d).position === "sticky"); if (pie && pie.contains(a)) return "pie"; return Math.round(a.getBoundingClientRect().left + scrollX); });
    if (r === "pie") break; if (r !== null) xs.push(r);
  }
  const mitad = await p.evaluate(() => { const f = document.querySelector("h2 + div"); const r = f.getBoundingClientRect(); return r.left + r.width / 2; });
  let cruces = 0; for (let i = 1; i < xs.length; i++) if (xs[i - 1] >= mitad && xs[i] < mitad) cruces++;
  ok("ord-174 a dos columnas, Tab va de la izquierda a la derecha sin regresarse", xs.length > 10 && cruces === 0, `paradas ${xs.length} · regresos a la izquierda ${cruces}`);
}, { width: 1920, height: 1080 });   // v10.84.79 (vuelta 3): a 1366 con el menú abierto ya es una columna

// ── Vuelta 3 de v10.84.79: la app REAL tenía un tope de 820 px para la forma (VIEW_MAXW) que el banco no; las dos columnas pasaban aquí y
//    allá nunca salían. Desde aquí el banco copia de App el menú lateral (222/64 px) y el contenedor. Y lo que esa medida enseñó. ──
// lo que de verdad se escribe en cada campo (lo de todos los días, no lo extremo): si la caja lo corta, no se lee lo capturado
const REALES = { "#ff-agente-compras": "Eva Martínez", "#ff-contacto": "compras@cosquim.com", "#ff-whatsapp": "55 1234 5678",
  "#ff-rfc": "XAXX010101000", "#ff-tipo": "Etiquetas adhesivas", "#ff-cantidad": "250000", "#ff-entrega": "2026-10-20", "#ff-precio": "12500.50",
  "#ff-papel": "Couché brillante", "#ff-gramaje": "150", "#ff-tintas-frente": "4 tintas CMYK", "#ff-tintas-vuelta": "1 tinta negro",
  "#ff-ancho": "21.5", "#ff-alto": "27.9", "#ff-maq": "Impresos del Bajío", "#ff-maq-costo": "8500.00", "#ff-maq-precio": "12500.50" };
async function cortados(p, reales = REALES) {
  for (const [sel, v] of Object.entries(reales)) {
    const l = p.locator(sel);
    if (await l.count() && await l.first().isVisible() && await l.first().isEditable()) { await l.first().fill(v).catch(() => {}); await p.locator("h2").first().click().catch(() => {}); }
  }
  await espera(p, 300);
  return p.evaluate(sels => {
    const out = [];
    // la fecha y la lada no avisan con scrollWidth: se comparan con su ancho natural (lo que piden para enseñarse completas)
    const natural = e => { const real = e.offsetWidth, prev = e.getAttribute("style"); e.style.width = "auto"; e.style.minWidth = "0"; e.style.maxWidth = "none"; e.style.flex = "none";
      const nat = e.offsetWidth; e.setAttribute("style", prev || ""); return { real, nat }; };
    for (const sel of [...sels, 'select[aria-label="Lada"]']) {
      const e = document.querySelector(sel); if (!e || !e.offsetParent) continue;
      if (e.type === "date" || e.tagName === "SELECT") { const { real, nat } = natural(e); if (nat > real + 1) out.push(sel + " pide " + nat + " y tiene " + real); continue; }
      if (e.scrollWidth > e.clientWidth + 1) out.push(sel + " «" + e.value + "» pide " + e.scrollWidth + " y tiene " + e.clientWidth);
    }
    return out;
  }, Object.keys(reales));
}
const ANCHOS = [["ord-175", "1366 con el menú abierto", "", { width: 1366, height: 768 }], ["ord-176", "1366 con el menú plegado", "menu=plegado", { width: 1366, height: 768 }],
  ["ord-177", "1920", "", { width: 1920, height: 1080 }], ["ord-178", "1093 (la laptop al 125 %)", "", { width: 1093, height: 615 }], ["ord-179", "683 (la laptop al 200 %)", "", { width: 683, height: 384 }]];
for (const [id, que, q, vp] of ANCHOS) {
  await caso(`${id} a ${que}, ningún campo corta lo que se escribe (WhatsApp, RFC, correo, la fecha, cantidad, precio)`, q, async p => {
    const c = await cortados(p);
    ok(`${id} a ${que}, ningún campo corta lo que se escribe (WhatsApp, RFC, correo, la fecha, cantidad, precio)`, c.length === 0, c.join(" · ") || "nada cortado");
  }, vp);
}
await caso("ord-180 maquila a 1366: proveedor, costo y precio no cortan lo que se escribe", "", async p => {
  await p.getByText("Maquila Completa").first().click(); await espera(p, 400);
  const c = await cortados(p);
  ok("ord-180 maquila a 1366: proveedor, costo y precio no cortan lo que se escribe", c.length === 0, c.join(" · ") || "nada cortado");
});
await caso("ord-181 plegar el menú a media captura (de una columna a dos) no se lleva el foco ni lo escrito", "", async p => {
  const d = p.locator("#ff-descripcion");
  await d.click(); await p.keyboard.type("Etiqueta");
  const antes = await p.evaluate(() => { const e = document.getElementById("ff-descripcion"); e.__marca = 1; const c = document.getElementById("ff-cliente-input").getBoundingClientRect(), pa = document.getElementById("ff-papel").getBoundingClientRect(); return pa.left >= c.right - 2; });
  await p.evaluate(() => window.__plegar(true)); await espera(p, 400);
  await p.keyboard.type(" redonda");
  const r = await p.evaluate(() => { const e = document.getElementById("ff-descripcion"); const c = document.getElementById("ff-cliente-input").getBoundingClientRect(), pa = document.getElementById("ff-papel").getBoundingClientRect();
    return { dos: pa.left >= c.right - 2, mismo: e.__marca === 1, foco: document.activeElement?.id, valor: e.value }; });
  ok("ord-181 plegar el menú a media captura (de una columna a dos) no se lleva el foco ni lo escrito", !antes && r.dos && r.mismo && r.foco === "ff-descripcion" && r.valor === "Etiqueta redonda",
    `antes dos columnas ${antes} · después ${r.dos} · el mismo campo ${r.mismo} · foco ${r.foco} · «${r.valor}»`);
}, { width: 1300, height: 768 });
await caso("ord-182 en el borde de las dos columnas no brinca: para volver a una pide bajar de 1130", "", async p => {
  const dos = () => p.evaluate(() => { const c = document.getElementById("ff-cliente-input").getBoundingClientRect(), pa = document.getElementById("ff-papel").getBoundingClientRect(); return pa.left >= c.right - 2; });
  const pasos = [];
  // el ancho de la forma = ventana − 222 (menú) − 32 (relleno): 1414 → 1160 · 1394 → 1140 · 1374 → 1120 · 1409 → 1155
  for (const w of [1414, 1394, 1374, 1394, 1409]) { await p.setViewportSize({ width: w, height: 768 }); await espera(p, 300); pasos.push(w + ":" + ((await dos()) ? "dos" : "una")); }
  ok("ord-182 en el borde de las dos columnas no brinca: para volver a una pide bajar de 1130", pasos.join(" ") === "1414:dos 1394:dos 1374:una 1394:una 1409:dos", pasos.join(" "));
}, { width: 1414, height: 768 });
await caso("ord-183 al abrir, la forma sale ya con su acomodo (no se pinta a dos columnas y salta a una)", "", async p => {
  await p.evaluate(() => window.__ir("pipeline")); await espera(p, 300);
  await p.evaluate(() => { window.__cuadros = []; const mira = () => { const f = document.querySelector(".pf-forma"); if (f) window.__cuadros.push(f.style.maxWidth); if (window.__cuadros.length < 30) requestAnimationFrame(mira); }; requestAnimationFrame(mira); });
  await p.evaluate(() => window.__ir("form")); await espera(p, 900);
  const vistos = [...new Set(await p.evaluate(() => window.__cuadros))];
  ok("ord-183 al abrir, la forma sale ya con su acomodo (no se pinta a dos columnas y salta a una)", vistos.length === 1 && vistos[0] === "760px", vistos.join(" → "));
});
await caso("ord-184 Pre-prensa a 1920: las especificaciones a la izquierda y el archivo a la derecha, todo sin desplazar", "modo=specs&rol=preprensa", async p => {
  await p.evaluate(() => scrollTo(0, 0)); await espera(p, 200);
  const top = await pieTop(p), papel = await rect(p, "#ff-papel"), alto = await rect(p, "#ff-alto");
  const subir = await p.evaluate(() => { const e = [...document.querySelectorAll("label, button")].find(x => /Subir archivo/.test(x.textContent)); return e ? (r => ({ left: r.left, bottom: r.bottom }))(e.getBoundingClientRect()) : null; });
  ok("ord-184 Pre-prensa a 1920: las especificaciones a la izquierda y el archivo a la derecha, todo sin desplazar",
    !!papel && !!alto && !!subir && alto.bottom <= top && subir.bottom <= top && subir.left > papel.right,
    `papel @${papel && Math.round(papel.left)} · medida @${alto && Math.round(alto.bottom)} · subir archivo @${subir && Math.round(subir.left)},${subir && Math.round(subir.bottom)} · pie ${Math.round(top)}`);
}, { width: 1920, height: 1080 });

await caso("ord-185 en el borde (la forma más angosta que va a dos columnas, 1150 px) tampoco se corta lo que se escribe", "", async p => {
  const dos = await p.evaluate(() => { const c = document.getElementById("ff-cliente-input").getBoundingClientRect(), pa = document.getElementById("ff-papel").getBoundingClientRect(); return pa.left >= c.right - 2; });
  const c = await cortados(p);
  ok("ord-185 en el borde (la forma más angosta que va a dos columnas, 1150 px) tampoco se corta lo que se escribe", dos && c.length === 0, `dos columnas ${dos} · ${c.join(" · ") || "nada cortado"}`);
}, { width: 1404, height: 768 });   // 1404 − 222 (menú) − 32 (relleno) = 1150

// ════ v10.84.80 — la segunda revisión independiente de la forma (12-oct, 28/40): el cliente que se mezclaba (P1), Replicar, al terminar,
//      vendedor y precio a la vista en la laptop, y lo que sólo servía con ratón (P2). Decisiones de Marcelo: los cinco; Replicar copia
//      specs, Pantones e imagen (no notas ni distribución); al crear, la forma se queda para capturar otra. ════
const elegirCliente = async (p, nombre, letras) => { await llenar(p, "Cliente (escribe para buscar)", letras || nombre.slice(0, 3)); await espera(p, 600); await p.getByText(nombre, { exact: true }).first().click(); await espera(p, 700); };
const valorDe = (p, sel) => p.locator(sel).first().inputValue().catch(() => null);
// lo que la forma dice del cliente (los role=status que no son la orden creada ni el resumen de faltantes)
const avisoDeCliente = p => p.evaluate(() => [...document.querySelectorAll('.pf-forma [role="status"]')].map(e => e.innerText.replace(/\s+/g, " ").trim()).filter(t => !/ creada|^Falta/.test(t)).join(" | "));
const fuera = p => p.locator("h2").first().click();
// una orden de un cliente escrito a mano (no elegido): para las preguntas de «¿ya existe?»
async function capturarEscrito(p, { cliente, rfc, correo = "x@correo.mx" }) {
  await llenar(p, "Cliente (escribe para buscar)", cliente); await fuera(p); await espera(p, 400);
  await llenar(p, "correo@ej.com", correo); await llenar(p, "XAXX010101000", rfc);
  await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await fuera(p);
  await llenar(p, "Ejemplo · 1000", "1000"); await elegirVendedor(p, "Manuel");
}
// el contraste de UN elemento, con la misma cuenta que `legibilidad`: su texto, su borde o su placeholder contra su fondo
const contraste = (p, buscar, que = "texto") => p.evaluate(([buscar, que]) => {
  const rgba = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(",").map(x => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const sobre = (a, b) => ({ r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a), a: 1 });
  const fondo = el => { const capas = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a >= 0.99) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = capas.length - 1; i >= 0; i--) base = sobre(capas[i], base); return base; };
  const L = ({ r, g, b }) => { const t = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * t(r) + 0.7152 * t(g) + 0.0722 * t(b); };
  const ratio = (a, b) => { const x = L(a), y = L(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100; };
  const el = new Function("return (" + buscar + ")")(); if (!el) return null;
  if (que === "borde") { const c = rgba(getComputedStyle(el).borderTopColor), f = fondo(el.parentElement || el); return c && parseFloat(getComputedStyle(el).borderTopWidth) > 0 ? ratio(sobre(c, f), f) : 0; }
  const c = rgba(getComputedStyle(el, que === "placeholder" ? "::placeholder" : null).color), f = fondo(el); return c ? ratio(sobre(c, f), f) : null;
}, [buscar, que]);

// ── [P1] el cliente de una orden no se mezcla ──
await caso("ord-190 cambiar el nombre después de elegir un cliente quita su RFC, su contacto y el vendedor sugerido, y lo dice", "", async p => {
  await elegirCliente(p, "COSQUIM");
  const antes = { rfc: await valorDe(p, "#ff-rfc"), correo: await valorDe(p, "#ff-contacto"), vend: await vendedorActual(p) };
  await p.locator("#ff-cliente-input").fill("Taller Ficticio de Prueba"); await fuera(p); await espera(p, 500);
  const despues = { rfc: await valorDe(p, "#ff-rfc"), correo: await valorDe(p, "#ff-contacto"), wa: await valorDe(p, "#ff-whatsapp"), vend: await vendedorActual(p) };
  const aviso = await avisoDeCliente(p);
  ok("ord-190 cambiar el nombre después de elegir un cliente quita su RFC, su contacto y el vendedor sugerido, y lo dice",
    antes.rfc === "COS010101AB1" && antes.vend === "Manuel" && despues.rfc === "" && despues.correo === "" && despues.wa === "" && despues.vend === "" && /COSQUIM/.test(aviso) && /RFC/.test(aviso),
    `antes ${JSON.stringify(antes)} · después ${JSON.stringify(despues)} · aviso «${aviso}»`);
});
await caso("ord-191 después de cambiar el cliente, sale «Cliente nuevo» (pide su contacto, como a cualquiera nuevo)", "", async p => {
  await elegirCliente(p, "COSQUIM");
  await p.locator("#ff-cliente-input").fill("Taller Ficticio de Prueba"); await fuera(p); await espera(p, 600);
  const t = await texto(p);
  ok("ord-191 después de cambiar el cliente, sale «Cliente nuevo» (pide su contacto, como a cualquiera nuevo)", /Cliente nuevo:/.test(t), (t.match(/Cliente nuevo:.{0,60}/) || ["sin el aviso"])[0]);
});
await caso("ord-192 elegir un cliente en «¿Quisiste decir…?» lo pone en la forma con SUS datos y no crea la orden; al crear, va completa", "cliente=parecido", async p => {
  await capturarEscrito(p, { cliente: "Papeleria Bajio SA", rfc: "XYZ990101AB1", correo: "otro@correo.mx" });
  await crear(p); await espera(p, 900);
  await pregunta(p).getByRole("button", { name: /PAPELERIA DEL BAJIO/ }).first().click(); await espera(p, 1200);
  const sinCrear = (await nuevas(p)).length === 0 && (await cuenta(p, "saveOrder")) === 0;
  const puesto = { cliente: await valorDe(p, "#ff-cliente-input"), rfc: await valorDe(p, "#ff-rfc"), correo: await valorDe(p, "#ff-contacto") };
  const aviso = await avisoDeCliente(p);
  if (await p.getByRole("button", { name: /Crear Orden/ }).count()) { await crear(p); await espera(p, 1500); }
  const n = await nuevas(p), o = n[0] ? await p.evaluate(id => { const x = window.__estado().base.find(y => y.id === id); return { client: x.client, client_id: x.client_id, rfc: x.client_rfc, correo: x.client_email }; }, n[0].id) : null;
  ok("ord-192 elegir un cliente en «¿Quisiste decir…?» lo pone en la forma con SUS datos y no crea la orden; al crear, va completa",
    sinCrear && puesto.cliente === "PAPELERIA DEL BAJIO" && puesto.rfc === "PBA040404IJ4" && puesto.correo === "ventas@papeleriabajio.mx" && /PAPELERIA DEL BAJIO/.test(aviso)
    && n.length === 1 && o.client_id === "c-papeleria" && o.client === "PAPELERIA DEL BAJIO" && o.rfc === "PBA040404IJ4",
    `sin crear ${sinCrear} · en la forma ${JSON.stringify(puesto)} · aviso «${aviso}» · creada ${JSON.stringify(o)}`);
});
await caso("ord-193 «¿Quisiste decir…?» abre con el foco en «Volver a la forma»: Enter no liga a nadie", "cliente=parecido", async p => {
  await capturarEscrito(p, { cliente: "Papeleria Bajio SA", rfc: "XYZ990101AB1" });
  await crear(p); await espera(p, 900);
  const foco = await p.evaluate(() => (document.activeElement?.tagName === "BUTTON" ? document.activeElement.textContent.trim() : document.activeElement?.tagName) || "");
  await p.keyboard.press("Enter"); await espera(p, 600);
  const n = (await nuevas(p)).length, cli = await valorDe(p, "#ff-cliente-input"), abierta = await hayPregunta(p);
  ok("ord-193 «¿Quisiste decir…?» abre con el foco en «Volver a la forma»: Enter no liga a nadie", /Volver a la forma/.test(foco) && n === 0 && cli === "Papeleria Bajio SA" && !abierta,
    `foco «${foco.slice(0, 40)}» · órdenes ${n} · cliente «${cli}» · pregunta abierta ${abierta}`);
});
await caso("ord-194 «Ya existe» por el RFC: dice de quién es el RFC de la forma y «Corregir el RFC» regresa a ese campo", "cliente=rfc", async p => {
  await capturarEscrito(p, { cliente: "Cosquim Industrial", rfc: "COS010101AB1" });
  await crear(p); await espera(p, 900);
  const t = await textoPregunta(p), corregir = pregunta(p).getByRole("button", { name: /Corregir el RFC/ });
  const hay = (await corregir.count()) > 0;
  if (hay) { await corregir.click(); await espera(p, 500); }
  const foco = await p.evaluate(() => document.activeElement?.id || "");
  ok("ord-194 «Ya existe» por el RFC: dice de quién es el RFC de la forma y «Corregir el RFC» regresa a ese campo",
    /COS010101AB1/.test(t) && /es de COSQUIM/.test(t) && hay && foco === "ff-rfc" && (await nuevas(p)).length === 0, `«${t.slice(0, 220)}» · botón ${hay} · foco ${foco}`);
});
await caso("ord-195 al editar, cambiar el cliente de una orden ligada quita su contacto (el vendedor se queda) y lo dice", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-ED");
  await p.locator("#ff-cliente-input").fill("OTRA EMPRESA SA"); await fuera(p); await espera(p, 500);
  const d = { correo: await valorDe(p, "#ff-contacto"), vend: await vendedorActual(p), aviso: await avisoDeCliente(p) };
  ok("ord-195 al editar, cambiar el cliente de una orden ligada quita su contacto (el vendedor se queda) y lo dice", d.correo === "" && d.vend === "Genaro" && /PORTLAND/.test(d.aviso), JSON.stringify(d));
});

// ── [P2] Replicar trae lo del producto, no lo de la otra orden ──
await caso("ord-196 «Replicar» copia specs, Pantones e imagen, NO las notas ni la distribución de la otra orden, y lo dice", "", async p => {
  await elegirCliente(p, "COSQUIM");
  await replicar(p);
  const notas = await valorDe(p, "#ff-notas"), papel = await valorDe(p, "#ff-papel");
  const ultimo = (await avisos(p)).pop() || "";
  const mas = (await p.getByRole("button", { name: /Más de esta orden/ }).first().innerText().catch(() => "")).replace(/\s+/g, " ");
  const pantone = await p.evaluate(() => /186 C/.test(document.querySelector(".pf-forma")?.innerText || ""));
  ok("ord-196 «Replicar» copia specs, Pantones e imagen, NO las notas ni la distribución de la otra orden, y lo dice",
    notas === "" && !/Distribuci/.test(mas) && pantone && /Couché adhesivo/.test(papel || "") && /notas/i.test(ultimo) && /imagen/.test(ultimo),
    `notas «${notas}» · Más «${mas}» · Pantone ${pantone} · papel «${papel}» · aviso «${ultimo}»`);
});
await caso("ord-197 la ventana de «Replicar» dice lo que copia (con Pantones e imagen) y que las notas y la distribución no", "", async p => {
  await elegirCliente(p, "COSQUIM");
  await p.getByRole("button", { name: /Replicar de orden anterior/ }).click(); await espera(p, 800);
  const t = ((await p.getByRole("dialog", { name: /Replicar/ }).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  ok("ord-197 la ventana de «Replicar» dice lo que copia (con Pantones e imagen) y que las notas y la distribución no",
    /Pantones/.test(t) && /imagen/i.test(t) && /notas/i.test(t) && /distribución/i.test(t) && /no se copian/i.test(t), t.slice(0, 320));
});

// ── [P2] al terminar: la forma se queda para capturar otra; editar y Cancelar regresan a donde se abrió ──
await caso("ord-198 al crear, la forma se queda vacía con «P-… creada · Ver · Imprimir · Capturar otra», que no se va solo", "", async p => {
  await capturar(p); await crear(p); await espera(p, 1500);
  const e = await estado(p), c1 = await creada(p);
  const foco = await p.evaluate(() => !!document.activeElement?.closest('[role="status"]'));
  await espera(p, 7500);   // el aviso de abajo duraba 6.5 s
  const c2 = await creada(p), vacia = (await valorDe(p, "#ff-cliente-input")) === "";
  const botones = await p.evaluate(() => { const b = [...document.querySelectorAll('.pf-forma [role="status"]')].find(x => /creada/.test(x.textContent)); return b ? [...b.querySelectorAll("button")].map(x => x.textContent.trim()) : []; });
  ok("ord-198 al crear, la forma se queda vacía con «P-… creada · Ver · Imprimir · Capturar otra», que no se va solo",
    e.vista === "form" && /P-0651 creada/.test(c1) && /P-0651/.test(c2) && vacia && foco && botones.some(b => /Ver P-0651/.test(b)) && botones.some(b => /Imprimir/.test(b)) && botones.some(b => /Capturar otra/.test(b)),
    `vista ${e.vista} · «${c1}» · a los 7.5 s «${c2}» · vacía ${vacia} · foco en el aviso ${foco} · botones ${JSON.stringify(botones)}`);
});
await caso("ord-199 «Ver», «Imprimir» y «Capturar otra» de la orden creada hacen lo suyo", "", async p => {
  await capturar(p); await crear(p); await espera(p, 1500);
  const id = (await nuevas(p))[0]?.id || "?";
  await p.getByRole("button", { name: /Ver P-0651/ }).first().click().catch(() => {}); await espera(p, 300);
  await p.getByRole("button", { name: /^Imprimir/ }).first().click().catch(() => {}); await espera(p, 300);
  await p.getByRole("button", { name: /Capturar otra/ }).first().click().catch(() => {}); await espera(p, 400);
  const foco = await p.evaluate(() => document.activeElement?.id || ""), queda = await creada(p);
  ok("ord-199 «Ver», «Imprimir» y «Capturar otra» de la orden creada hacen lo suyo",
    (await cuenta(p, "detalle " + id)) === 1 && (await cuenta(p, "imprimir " + id)) === 1 && foco === "ff-cliente-input" && queda === "",
    `detalle ${await cuenta(p, "detalle ")} · imprimir ${await cuenta(p, "imprimir ")} · foco ${foco} · aviso «${queda}»`);
});
await caso("ord-200 al empezar la siguiente orden se quita el aviso de la anterior, y «el último fue» ya dice su número", "", async p => {
  await capturar(p); await crear(p); await espera(p, 1500);
  const antes = await creada(p);
  await llenar(p, "Cliente (escribe para buscar)", "POR"); await espera(p, 500);
  const queda = await creada(p), t = await texto(p);
  ok("ord-200 al empezar la siguiente orden se quita el aviso de la anterior, y «el último fue» ya dice su número", /P-0651/.test(antes) && queda === "" && /el último fue P-0651/.test(t),
    `antes «${antes}» · después «${queda}» · ${(t.match(/el último fue P-\d+/) || ["sin «el último fue»"])[0]}`);
});
await caso("ord-201 guardar, «Sin cambios» y Cancelar regresan a donde se abrió la forma (desde «Todas», a «Todas»)", "rol=admin", async p => {
  const r = [];
  for (const como of ["guardar", "sin cambios", "cancelar"]) {
    await p.evaluate(() => window.__ir("orders")); await espera(p, 300);
    await p.evaluate(() => window.__editar("OP-ED")); await espera(p, 900);
    if (como === "guardar") { await p.locator("textarea").first().fill("Recetas Dr. Eduardo Fuentes · " + r.length); await guardar(p); }
    else if (como === "sin cambios") await guardar(p);
    else await p.getByRole("button", { name: /^Cancelar$/ }).click();
    await espera(p, 1000);
    r.push(como + "→" + (await estado(p)).vista);
  }
  ok("ord-201 guardar, «Sin cambios» y Cancelar regresan a donde se abrió la forma (desde «Todas», a «Todas»)", r.every(x => x.endsWith("→orders")), r.join(" · "));
});
await caso("ord-202 «Agregar producto» a una OC: el botón dice «Agregar a OC-…» y al crear regresa a la OC", "modo=oc", async p => {
  await llenar(p, "Ejemplo · 1000", "500"); await elegirVendedor(p, "Manuel");
  const boton = p.getByRole("button", { name: /Agregar a OC-0900/ }), dice = (await boton.count()) > 0;
  if (dice) await boton.first().click(); else await p.locator("button", { hasText: /^Guardar$/ }).first().click().catch(() => {});
  await espera(p, 1500);
  const e = await estado(p), n = (await nuevas(p)).length;
  ok("ord-202 «Agregar producto» a una OC: el botón dice «Agregar a OC-…» y al crear regresa a la OC", dice && e.vista === "oc" && n === 1, `botón «Agregar a OC-0900» ${dice} · vista ${e.vista} · órdenes ${n}`);
});
await caso("ord-203 al regresar a «Todas», la página queda donde estaba (no a media página)", "rol=admin", async p => {
  await p.evaluate(() => window.__ir("orders")); await espera(p, 300);
  await p.evaluate(() => scrollTo(0, 700)); await espera(p, 400);
  await p.evaluate(() => window.__editar("OP-ED")); await espera(p, 900);
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await espera(p, 300);   // al fondo de la forma, junto a «Guardar»
  await p.getByRole("button", { name: /^Cancelar$/ }).click(); await espera(p, 900);
  const e = await estado(p), y = await p.evaluate(() => Math.round(scrollY));
  ok("ord-203 al regresar a «Todas», la página queda donde estaba (no a media página)", e.vista === "orders" && Math.abs(y - 700) <= 5, `vista ${e.vista} · y ${y}`);
});
await caso("ord-204 el botón de un aviso («Ver P-…» al guardar) se lee: 4.5:1 o más", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-ED");
  await p.locator("textarea").first().fill("Recetas Dr. Eduardo Fuentes · cambio"); await guardar(p); await espera(p, 900);
  const r = await contraste(p, `[...document.querySelectorAll("button")].find(b => /^Ver P-/.test(b.textContent.trim()) && getComputedStyle(b.parentElement).position === "fixed")`);
  ok("ord-204 el botón de un aviso («Ver P-…» al guardar) se lee: 4.5:1 o más", r !== null && r >= 4.5, `contraste ${r}`);
});

// ── [P2] en la laptop, vendedor y precio a la vista; el pie chico donde hay poco alto ──
await caso("ord-205 a 1366×768 con el menú abierto, el vendedor y el precio quedan arriba del pie sin desplazar", "", async p => {
  await p.evaluate(() => scrollTo(0, 0)); await espera(p, 200);
  const top = await pieTop(p), v = await rect(p, "#ff-agent"), pr = await rect(p, "#ff-precio");
  ok("ord-205 a 1366×768 con el menú abierto, el vendedor y el precio quedan arriba del pie sin desplazar", !!v && !!pr && v.bottom <= top && pr.bottom <= top,
    `vendedor @${v && Math.round(v.bottom)} · precio @${pr && Math.round(pr.bottom)} · pie ${Math.round(top)}`);
});
await caso("ord-206 a 1366×768 con el menú plegado (dos columnas), también", "menu=plegado", async p => {
  await p.evaluate(() => scrollTo(0, 0)); await espera(p, 200);
  const top = await pieTop(p), v = await rect(p, "#ff-agent"), pr = await rect(p, "#ff-precio");
  ok("ord-206 a 1366×768 con el menú plegado (dos columnas), también", !!v && !!pr && v.bottom <= top && pr.bottom <= top,
    `vendedor @${v && Math.round(v.bottom)} · precio @${pr && Math.round(pr.bottom)} · pie ${Math.round(top)}`);
});
await caso("ord-207 a 683×384 el pie es chico: 18 % de la pantalla o menos, y 25 % o menos con los faltantes", "", async p => {
  const alto0 = 384 - await pieTop(p);
  await crear(p); await espera(p, 700);
  const alto1 = 384 - await pieTop(p);
  ok("ord-207 a 683×384 el pie es chico: 18 % de la pantalla o menos, y 25 % o menos con los faltantes", alto0 <= 384 * 0.18 && alto1 <= 384 * 0.25,
    `pie ${Math.round(alto0)} px (${Math.round(alto0 / 3.84)} %) · con faltantes ${Math.round(alto1)} px (${Math.round(alto1 / 3.84)} %)`);
}, { width: 683, height: 384 });

// ── [P2] lo que sólo servía con ratón y buena vista ──
await caso("ord-208 al intentar crear con faltantes, el foco va al primero y cada uno dice «Falta…» en su campo (aria-invalid)", "", async p => {
  await crear(p); await espera(p, 700);
  const r = await p.evaluate(() => ({ foco: document.activeElement?.id || "", campos: ["ff-cliente-input", "ff-tipo", "ff-cantidad", "ff-agent"].map(id => { const e = document.getElementById(id);
    const dice = (e?.getAttribute("aria-describedby") || "").split(" ").map(x => document.getElementById(x)?.textContent || "").join(" ").trim();
    return { id, invalido: e?.getAttribute("aria-invalid") || null, dice }; }) }));
  ok("ord-208 al intentar crear con faltantes, el foco va al primero y cada uno dice «Falta…» en su campo (aria-invalid)",
    r.foco === "ff-cliente-input" && r.campos.every(c => c.invalido === "true" && /Falta/i.test(c.dice)), JSON.stringify(r));
});
await caso("ord-209 el borde del campo que falta se distingue (3:1 o más contra el fondo)", "", async p => {
  await crear(p); await espera(p, 700);
  const cli = await contraste(p, `document.getElementById("ff-client")`, "borde"), tipo = await contraste(p, `document.getElementById("ff-tipo")`, "borde");
  ok("ord-209 el borde del campo que falta se distingue (3:1 o más contra el fondo)", cli >= 3 && tipo >= 3, `cliente ${cli} · tipo ${tipo}`);
});
await caso("ord-210 el resumen de faltantes se anuncia y cada faltante lleva a su campo", "", async p => {
  await crear(p); await espera(p, 700);
  const r = await p.evaluate(() => { const res = [...document.querySelectorAll('.pf-forma [role="status"],.pf-forma [aria-live]')].find(x => /Falta/.test(x.textContent || ""));
    return res ? { texto: res.innerText.replace(/\s+/g, " ").slice(0, 160), botones: [...res.querySelectorAll("button")].map(b => b.textContent.trim()) } : null; });
  let foco = "";
  if (r && r.botones.some(b => /Tipo/.test(b))) { await p.locator('.pf-forma button', { hasText: /^Tipo/ }).last().click(); await espera(p, 300); foco = await p.evaluate(() => document.activeElement?.id || ""); }
  ok("ord-210 el resumen de faltantes se anuncia y cada faltante lleva a su campo", !!r && r.botones.length >= 3 && foco === "ff-tipo", `${JSON.stringify(r)} · foco ${foco}`);
});
await caso("ord-211 la imagen: «Subir 1ra» se alcanza con el teclado y Enter abre el archivo", "", async p => {
  const b = p.getByRole("button", { name: /Subir 1ra/ });
  const hay = (await b.count()) > 0;
  let abre = false, foco = "";
  if (hay) { await p.bringToFront(); await b.first().waitFor({ state: "visible" }); await b.first().focus(); await espera(p, 150); foco = await p.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 30) || "");
    // Playwright prende la intercepción del selector de archivos sin esperar respuesta: con la máquina cargada, un Enter inmediato le ganaba
    const fc = p.waitForEvent("filechooser", { timeout: 4000 }).then(() => true, () => false); await espera(p, 300); await p.keyboard.press("Enter"); abre = await fc; }
  ok("ord-211 la imagen: «Subir 1ra» se alcanza con el teclado y Enter abre el archivo", hay && abre, `botón ${hay} · foco «${foco}» · abre el archivo ${abre}`);
});
await caso("ord-212 Pre-prensa: «Subir archivo» se alcanza con el teclado y Enter abre el archivo", "modo=specs&rol=preprensa", async p => {
  const b = p.getByRole("button", { name: /Subir archivo/ });
  const hay = (await b.count()) > 0;
  let abre = false, foco = "";
  if (hay) { await p.bringToFront(); await b.first().waitFor({ state: "visible" }); await b.first().focus(); await espera(p, 150); foco = await p.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 30) || "");
    // Playwright prende la intercepción del selector de archivos sin esperar respuesta: con la máquina cargada, un Enter inmediato le ganaba
    const fc = p.waitForEvent("filechooser", { timeout: 4000 }).then(() => true, () => false); await espera(p, 300); await p.keyboard.press("Enter"); abre = await fc; }
  ok("ord-212 Pre-prensa: «Subir archivo» se alcanza con el teclado y Enter abre el archivo", hay && abre, `botón ${hay} · foco «${foco}» · abre el archivo ${abre}`);
});
await caso("ord-213 «Tipo» es una lista de verdad: flechas y Enter eligen sin perder el foco, y Tab sigue al siguiente campo", "", async p => {
  const t = p.locator("#ff-tipo");
  await t.click(); await t.fill("Eti"); await espera(p, 200);
  const r1 = await p.evaluate(() => { const e = document.getElementById("ff-tipo"); return { rol: e.getAttribute("role"), abierta: e.getAttribute("aria-expanded"), lista: !!document.querySelector('[role="listbox"]') }; });
  await p.keyboard.press("ArrowDown"); await espera(p, 100);
  const act = await p.evaluate(() => document.getElementById("ff-tipo").getAttribute("aria-activedescendant"));
  await p.keyboard.press("Enter"); await espera(p, 400);
  const elegido = await valorDe(p, "#ff-tipo"), focoTras = await p.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  await t.fill("Folde"); await espera(p, 150);
  await p.keyboard.press("Tab"); await espera(p, 500);
  const focoTab = await p.evaluate(() => document.activeElement === document.body ? "body" : (document.activeElement?.id || document.activeElement?.tagName));
  ok("ord-213 «Tipo» es una lista de verdad: flechas y Enter eligen sin perder el foco, y Tab sigue al siguiente campo",
    r1.rol === "combobox" && r1.abierta === "true" && r1.lista && !!act && /Etiqueta/.test(elegido || "") && focoTras === "ff-tipo" && focoTab !== "body",
    `${JSON.stringify(r1)} · activa ${act} · elegido «${elegido}» · foco tras Enter ${focoTras} · foco tras Tab ${focoTab}`);
});
await caso("ord-214 la pregunta de la factura cobrada: el foco entra, Tab no se sale, la opción dice que está elegida, «Sobrarían» se lee y Esc regresa sin guardar", "modo=editar&rol=admin&precio=cobrada", async p => {
  await editar(p, "OP-FA");
  await p.locator("#ff-precio").fill("1978"); await guardar(p); await espera(p, 1000);
  const d = p.getByRole("dialog", { name: /ya está cobrada/ });
  const abierta = (await d.count()) > 0;
  const dentro = () => p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  const focoDentro = abierta && await dentro();
  let salio = 0; for (let i = 0; i < 10; i++) { await p.keyboard.press("Tab"); await espera(p, 40); if (!(await dentro())) salio++; }
  const op = d.getByRole("button", { name: /saldo a favor/ });
  if (await op.count()) { await op.first().click(); await espera(p, 200); }
  const presionada = await op.first().getAttribute("aria-pressed").catch(() => null);
  const sobra = await contraste(p, `[...document.querySelectorAll('[role="dialog"] span')].find(x => x.textContent.trim() === "Sobrarían")?.nextElementSibling`);
  await p.keyboard.press("Escape"); await espera(p, 600);
  const cerrada = (await d.count()) === 0, ups = await cuenta(p, "update OP-FA");
  ok("ord-214 la pregunta de la factura cobrada: el foco entra, Tab no se sale, la opción dice que está elegida, «Sobrarían» se lee y Esc regresa sin guardar",
    abierta && focoDentro && salio === 0 && presionada === "true" && sobra >= 4.5 && cerrada && ups === 0,
    `abierta ${abierta} · foco dentro ${focoDentro} · Tab salió ${salio} · aria-pressed ${presionada} · «Sobrarían» ${sobra} · cerrada con Esc ${cerrada} · guardados ${ups}`);
});
await caso("ord-215 los placeholders se leen (4.5:1 o más)", "", async p => {
  const cli = await contraste(p, `document.getElementById("ff-cliente-input")`, "placeholder"), cant = await contraste(p, `document.getElementById("ff-cantidad")`, "placeholder");
  ok("ord-215 los placeholders se leen (4.5:1 o más)", cli >= 4.5 && cant >= 4.5, `cliente ${cli} · cantidad ${cant}`);
});
await caso("ord-216 la N en «Nueva Orden» con algo capturado no pregunta «¿Salir sin guardar?»: lleva el foco al cliente", "", async p => {
  await llenar(p, "Ejemplo · 1000", "250");
  await p.getByRole("button", { name: /Normal/ }).first().focus();
  await p.keyboard.press("n"); await espera(p, 400);
  const pregunto = await hayPregunta(p), foco = await p.evaluate(() => document.activeElement?.id || ""), cant = await valorDe(p, "#ff-cantidad");
  ok("ord-216 la N en «Nueva Orden» con algo capturado no pregunta «¿Salir sin guardar?»: lleva el foco al cliente", !pregunto && foco === "ff-cliente-input" && cant === "250",
    `preguntó ${pregunto} · foco ${foco} · cantidad «${cant}»`);
});
await caso("ord-217 «Cancelar» mientras se guarda no se puede apretar (la orden se está creando)", "guardar=lento&lento=2", async p => {
  await capturar(p); await crear(p); await espera(p, 400);
  const c = p.getByRole("button", { name: /^Cancelar$/ });
  const activo = await c.first().isEnabled().catch(() => false);
  await c.first().click({ force: true, timeout: 1500 }).catch(() => {}); await espera(p, 2800);
  const e = await estado(p), n = (await nuevas(p)).length, cr = await creada(p);
  ok("ord-217 «Cancelar» mientras se guarda no se puede apretar (la orden se está creando)", !activo && e.vista === "form" && n === 1 && /P-0651/.test(cr), `activo ${activo} · vista ${e.vista} · órdenes ${n} · «${cr}»`);
});
await caso("ord-218 ninguna etiqueta en mayúsculas pasa de 30 letras (las largas se leen mal en mayúsculas)", "", async p => {
  // sólo el texto que de verdad va en mayúsculas (lo que adentro lleva text-transform:none no cuenta)
  const largas = await p.evaluate(() => { const out = [];
    const raices = [...document.querySelectorAll(".pf-forma *")].filter(e => getComputedStyle(e).textTransform === "uppercase" && (!e.parentElement || getComputedStyle(e.parentElement).textTransform !== "uppercase"));
    for (const r of raices) { let t = ""; const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (n.parentElement && getComputedStyle(n.parentElement).textTransform === "uppercase") t += n.textContent;
      t = t.replace(/\s+/g, " ").trim(); if (t.length > 30) out.push(t); }
    return out; });
  ok("ord-218 ninguna etiqueta en mayúsculas pasa de 30 letras (las largas se leen mal en mayúsculas)", largas.length === 0, largas.slice(0, 4).join(" | ") || "ninguna");
});
await caso("ord-219 el vendedor que edita su orden: la nota del candado dice lo que de verdad no cambia (razón social y RFC)", "modo=editar&rol=vendedor", async p => {
  await editar(p, "OP-ED");
  const correo = await editable(p.getByPlaceholder("correo@ej.com"));
  const dice = await p.evaluate(() => { const e = [...document.querySelectorAll(".pf-forma span, .pf-forma div")].find(x => x.children.length === 0 && /cambia Lupita o Direcci/.test(x.textContent || "") && !/vendedor/i.test(x.textContent || "")); return e ? e.textContent.trim() : ""; });
  ok("ord-219 el vendedor que edita su orden: la nota del candado dice lo que de verdad no cambia (razón social y RFC)",
    !!dice && (correo ? /raz[oó]n social/i.test(dice) && !/datos del cliente/i.test(dice) : true), `correo editable ${correo} · «${dice}»`);
});

// ── Vuelta 2 de v10.84.80: por donde no se diseñó ──
await caso("ord-220 un segundo clic en «Crear Orden» justo al terminar: una orden, y la forma vacía que sigue NO sale marcada de faltantes", "", async p => {
  await capturar(p);
  // el clic rápido de un doble clic lo frena «guardando»; éste es el lento: llega cuando la orden YA se creó (red rápida, mano lenta)
  await crear(p);
  for (let i = 0; i < 60 && !(await creada(p)); i++) await espera(p, 25);
  await p.getByRole("button", { name: /Crear Orden/ }).click({ timeout: 1000 }).catch(() => {}); await espera(p, 600);
  const n = (await nuevas(p)).length, folios = await cuenta(p, "rpc next_production_number");
  const marcada = await p.evaluate(() => !!document.querySelector('.pf-forma [aria-invalid="true"]') || [...document.querySelectorAll('.pf-forma [role="status"]')].some(e => /^\s*Falta/.test(e.textContent || "")));
  ok("ord-220 un segundo clic en «Crear Orden» justo al terminar: una orden, y la forma vacía que sigue NO sale marcada de faltantes", n === 1 && folios === 1 && !marcada && /P-0651/.test(await creada(p)), `órdenes ${n} · números pedidos ${folios} · marcada ${marcada}`);
});
await caso("ord-221 vendedor «Otro»: pide el nombre, avisa que no comisiona, y elegir uno de la lista lo quita", "", async p => {
  const sel = p.locator("select#ff-agent");
  await sel.selectOption("otro"); await espera(p, 200);
  const nombre = p.getByLabel("Nombre del vendedor"), hayNombre = (await nombre.count()) > 0;
  if (hayNombre) { await nombre.fill("Fulano Externo"); await espera(p, 200); }
  const avisa = /no generará comisión/.test(await texto(p));
  await sel.selectOption("Genaro"); await espera(p, 200);
  const quitado = (await p.getByLabel("Nombre del vendedor").count()) === 0 && !/no generará comisión/.test(await texto(p)) && (await vendedorActual(p)) === "Genaro";
  ok("ord-221 vendedor «Otro»: pide el nombre, avisa que no comisiona, y elegir uno de la lista lo quita", hayNombre && avisa && quitado, `nombre ${hayNombre} · avisa ${avisa} · quitado ${quitado}`);
});
await caso("ord-222 cambiar de cliente con el vendedor elegido A MANO: el vendedor se queda (sólo se quita el sugerido)", "", async p => {
  await elegirCliente(p, "COSQUIM");
  await elegirVendedor(p, "Jaime");
  await p.locator("#ff-cliente-input").fill("Taller Ficticio de Prueba"); await fuera(p); await espera(p, 500);
  const v = await vendedorActual(p), rfc = await valorDe(p, "#ff-rfc");
  ok("ord-222 cambiar de cliente con el vendedor elegido A MANO: el vendedor se queda (sólo se quita el sugerido)", v === "Jaime" && rfc === "", `vendedor «${v}» · RFC «${rfc}»`);
});
await caso("ord-223 escribir y borrar una letra en el cliente elegido: al salir del campo vuelve a ser ese cliente, con sus datos", "", async p => {
  await elegirCliente(p, "COSQUIM");
  const c = p.locator("#ff-cliente-input");
  await c.click(); await c.press("End"); await c.type("x"); await espera(p, 300); await c.press("Backspace"); await espera(p, 600);
  await fuera(p); await espera(p, 900);
  const d = { cliente: await valorDe(p, "#ff-cliente-input"), rfc: await valorDe(p, "#ff-rfc"), correo: await valorDe(p, "#ff-contacto") };
  ok("ord-223 escribir y borrar una letra en el cliente elegido: al salir del campo vuelve a ser ese cliente, con sus datos", d.cliente === "COSQUIM" && d.rfc === "COS010101AB1" && d.correo === "compras@cosquim.mx", JSON.stringify(d));
});
await caso("ord-224 dos órdenes seguidas: el renglón dice la segunda (P-0652) y es uno solo", "", async p => {
  await capturar(p); await crear(p); await espera(p, 1500);
  await capturar(p); await crear(p); await espera(p, 1500);
  const r = await p.evaluate(() => [...document.querySelectorAll('.pf-forma [role="status"]')].filter(e => /creada/.test(e.textContent || "")).map(e => e.innerText.replace(/\s+/g, " ").slice(0, 60)));
  ok("ord-224 dos órdenes seguidas: el renglón dice la segunda (P-0652) y es uno solo", r.length === 1 && /P-0652 creada/.test(r[0]) && (await nuevas(p)).length === 2, JSON.stringify(r));
});
await caso("ord-225 «Nueva» abierta desde «Todas»: Cancelar regresa a «Todas»", "", async p => {
  await p.evaluate(() => window.__ir("orders")); await espera(p, 300);
  await p.evaluate(() => window.__ir("form")); await espera(p, 600);
  await p.getByRole("button", { name: /^Cancelar$/ }).click(); await espera(p, 600);
  const e = await estado(p);
  ok("ord-225 «Nueva» abierta desde «Todas»: Cancelar regresa a «Todas»", e.vista === "orders", `vista ${e.vista}`);
});
await caso("ord-226 la N editando una orden con cambios SÍ pregunta (como antes): sólo en «Nueva Orden» enfoca el cliente", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-ED");
  await p.locator("textarea").first().fill("Recetas · cambio para la N");
  await p.getByRole("button", { name: /Normal/ }).first().focus();
  await p.keyboard.press("n"); await espera(p, 400);
  const pregunto = await hayPregunta(p);
  ok("ord-226 la N editando una orden con cambios SÍ pregunta (como antes): sólo en «Nueva Orden» enfoca el cliente", pregunto, `preguntó ${pregunto}`);
});
await caso("ord-227 la pregunta de la factura cobrada: con una opción elegida, el clic fuera no la cierra (no se pierde lo elegido)", "modo=editar&rol=admin&precio=cobrada", async p => {
  await editar(p, "OP-FA");
  await p.locator("#ff-precio").fill("1978"); await guardar(p); await espera(p, 1000);
  const d = p.getByRole("dialog", { name: /ya está cobrada/ });
  await d.getByRole("button", { name: /saldo a favor/ }).first().click(); await espera(p, 200);
  await p.mouse.click(8, 8); await espera(p, 400);
  const sigue = (await d.count()) > 0, elegida = sigue ? await d.getByRole("button", { name: /saldo a favor/ }).first().getAttribute("aria-pressed") : null;
  ok("ord-227 la pregunta de la factura cobrada: con una opción elegida, el clic fuera no la cierra (no se pierde lo elegido)", sigue && elegida === "true", `sigue abierta ${sigue} · elegida ${elegida}`);
});
await caso("ord-228 maquila a 1366 con el menú abierto: el vendedor arriba del pie, y el precio una vez (el de maquila)", "", async p => {
  await p.getByRole("button", { name: /^Maquila/ }).first().click(); await espera(p, 400);
  await p.evaluate(() => scrollTo(0, 0)); await espera(p, 200);
  const top = await pieTop(p), v = await rect(p, "#ff-agent"), precioInterno = await p.locator("#ff-precio").count(), precioMaq = await p.locator("#ff-maq-precio").count();
  ok("ord-228 maquila a 1366 con el menú abierto: el vendedor arriba del pie, y el precio una vez (el de maquila)", !!v && v.bottom <= top && precioInterno === 0 && precioMaq === 1,
    `vendedor @${v && Math.round(v.bottom)} · pie ${Math.round(top)} · precio interno ${precioInterno} · de maquila ${precioMaq}`);
});

// ── v10.84.81: la TERCERA revisión independiente (29/40): el P1 («P-… creada» fuera de la pantalla) y lo que no pedía decisión ──
// 🔑 el banco copia ya el estilo global de App: con `html{scroll-behavior:smooth}` el foco trae al renglón con una animación (en la app
//   real una vez quedó fuera, scrollY 199 y el renglón en y=−91); sin el estilo, el banco desplazaba de golpe y daba 0 de 8
const vigilarCreada = p => p.evaluate(() => {
  window.__creadaAlSalir = null;
  const mide = b => { const r = b.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), alto: innerHeight, y: Math.round(scrollY), foco: document.activeElement === b }; };
  const busca = () => [...document.querySelectorAll('.pf-forma [role="status"]')].find(e => /creada/.test(e.textContent || ""));
  window.__creadaAhora = () => { const b = busca(); return b ? mide(b) : null; };
  const mo = new MutationObserver(() => { const b = busca(); if (!b || window.__creadaAlSalir) return; window.__creadaAlSalir = "esperando"; mo.disconnect(); requestAnimationFrame(() => { window.__creadaAlSalir = mide(b); }); });
  mo.observe(document.body, { childList: true, subtree: true });
});
const aLaVista = r => !!r && typeof r === "object" && r.top >= 0 && r.bottom <= r.alto;
async function crearDesdeLaDescripcion(p) {
  const ta = p.locator("textarea").first();
  await ta.evaluate(e => e.scrollIntoView({ block: "center", behavior: "instant" })); await espera(p, 200);
  await ta.focus(); await espera(p, 150);
  const y0 = await p.evaluate(() => Math.round(scrollY));
  await vigilarCreada(p);
  await p.keyboard.press("Control+Enter");
  await p.waitForFunction(() => window.__creadaAlSalir && window.__creadaAlSalir !== "esperando", null, { timeout: 8000 });
  const alSalir = await p.evaluate(() => window.__creadaAlSalir);
  await espera(p, 700);
  return { y0, alSalir, luego: await p.evaluate(() => window.__creadaAhora()) };
}
await caso("ord-229 [P1] «P-… creada» se ve EN CUANTO sale (Ctrl+Enter desde la descripción, la página desplazada): sin depender de una animación", "", async p => {
  await capturar(p);
  const r = await crearDesdeLaDescripcion(p);
  ok("ord-229 [P1] «P-… creada» se ve EN CUANTO sale (Ctrl+Enter desde la descripción, la página desplazada): sin depender de una animación",
    r.y0 > 0 && aLaVista(r.alSalir) && aLaVista(r.luego) && r.luego.foco, JSON.stringify(r));
}, undefined, { movimiento: true });
await caso("ord-230 [P1] a 683×384 y con la base lenta, «P-… creada» también se ve en cuanto sale y se queda a la vista", "guardar=lento&lento=1", async p => {
  await capturar(p);
  const r = await crearDesdeLaDescripcion(p);
  ok("ord-230 [P1] a 683×384 y con la base lenta, «P-… creada» también se ve en cuanto sale y se queda a la vista",
    r.y0 > 0 && aLaVista(r.alSalir) && aLaVista(r.luego) && r.luego.foco, JSON.stringify(r));
}, { width: 683, height: 384 }, { movimiento: true });
// el foco con el TECLADO (no con focus(): Chrome no enseña el anillo a un foco puesto por código después de un clic)
async function focoConTeclado(p, loc) { await loc.first().focus(); await p.keyboard.press("Shift+Tab"); await espera(p, 60); await p.keyboard.press("Tab"); await espera(p, 120); }
const anilloDelFoco = p => p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return { que: "body", anillo: false };
  const cs = getComputedStyle(e); const linea = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2; const sombra = /rgb\(74, 101, 114\) 0px 0px 0px 2px/.test(cs.boxShadow);
  return { que: e.id || (e.textContent || "").trim().slice(0, 24), anillo: linea || sombra }; });
await caso("ord-231 con el teclado se ve dónde está el foco: «Subir 1ra», «Subir 2da», «Subir archivo» y las paradas de la fecha", "", async p => {
  await abrirMas(p);
  const vistos = [];
  for (const nombre of [/Subir 1ra/, /Subir 2da/, /Subir archivo/]) {
    const b = p.getByRole("button", { name: nombre });
    if (!(await b.count())) { vistos.push({ que: String(nombre), anillo: false, falta: true }); continue; }
    await focoConTeclado(p, b); vistos.push(await anilloDelFoco(p));
  }
  // la fecha: Tab entra a sus partes (día, mes, año y el calendario); en cada una se ve el foco
  await focoConTeclado(p, p.locator("#ff-entrega"));
  for (let i = 0; i < 4; i++) { const a = await anilloDelFoco(p); if (a.que !== "ff-entrega") break; vistos.push({ ...a, que: "fecha " + (i + 1) }); await p.keyboard.press("Tab"); await espera(p, 100); }
  const sin = vistos.filter(v => !v.anillo);
  ok("ord-231 con el teclado se ve dónde está el foco: «Subir 1ra», «Subir 2da», «Subir archivo» y las paradas de la fecha",
    sin.length === 0 && vistos.filter(v => /^fecha/.test(v.que)).length >= 1, sin.length ? "sin anillo: " + sin.map(v => v.que).join(", ") : vistos.length + " paradas, todas se ven");
});
const quienTieneElFoco = p => p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? "body" : (a.id || (a.textContent || "").trim().slice(0, 40)); });
await caso("ord-232 Esc en «¿Salir sin guardar la orden?» regresa el foco al botón que la abrió (no a ningún lado)", "", async p => {
  await llenar(p, "Ejemplo · 1000", "250");
  const b = p.getByRole("button", { name: /^Cancelar$/ });
  await b.first().focus(); await p.keyboard.press("Enter"); await espera(p, 500);
  const pregunto = await hayPregunta(p);
  await p.keyboard.press("Escape"); await espera(p, 400);
  const foco = await quienTieneElFoco(p);
  ok("ord-232 Esc en «¿Salir sin guardar la orden?» regresa el foco al botón que la abrió (no a ningún lado)", pregunto && /^Cancelar$/.test(foco), `preguntó ${pregunto} · foco «${foco}»`);
});
await caso("ord-233 Esc en «Replicar de orden anterior» regresa el foco a su botón", "", async p => {
  await elegirCliente(p, "COSQUIM");
  const b = p.getByRole("button", { name: /Replicar de orden anterior/ });
  await b.first().focus(); await p.keyboard.press("Enter"); await espera(p, 800);
  const abrio = await hayPregunta(p);
  await p.keyboard.press("Escape"); await espera(p, 400);
  const foco = await quienTieneElFoco(p);
  ok("ord-233 Esc en «Replicar de orden anterior» regresa el foco a su botón", abrio && /Replicar de orden anterior/.test(foco), `abrió ${abrio} · foco «${foco}»`);
});
await caso("ord-234 Esc en «¿Ya existe este cliente?» regresa el foco a «Crear Orden»", "cliente=parecido", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "PAPELERIA BAJIO SA"); await espera(p, 600); await p.keyboard.press("Escape");
  await llenar(p, "correo@ej.com", "ventas@pb.mx"); await p.locator("#ff-rfc").fill("PBS010101AB1");   // el RFC es obligatorio para un cliente nuevo
  await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", "1000"); await elegirVendedor(p, "Manuel");
  const b = p.getByRole("button", { name: /Crear Orden/ });
  await b.first().focus(); await p.keyboard.press("Enter"); await espera(p, 900);
  const pregunto = await hayPregunta(p);
  await p.keyboard.press("Escape"); await espera(p, 400);
  const foco = await quienTieneElFoco(p);
  ok("ord-234 Esc en «¿Ya existe este cliente?» regresa el foco a «Crear Orden»", pregunto && /Crear Orden/.test(foco) && (await nuevas(p)).length === 0, `preguntó ${pregunto} · foco «${foco}»`);
});
await caso("ord-235 Esc en «Esta factura ya está cobrada» regresa el foco a «Guardar»", "modo=editar&rol=admin&precio=cobrada", async p => {
  await editar(p, "OP-FA");
  await p.locator("#ff-precio").fill("1978");
  const b = p.getByRole("button", { name: /^Guardar$/ });
  await b.first().focus(); await p.keyboard.press("Enter");
  // (v10.84.90) espera a que la pregunta esté LISTA (el foco ya adentro: sus efectos corrieron, también el que registra su Esc), y a que se
  //   cierre antes de mirar el foco. Con 1 s fijo, en el candado cargado el Esc llegaba con la pregunta recién pintada (una persona no
  //   reacciona en ese instante) y el foco seguía adentro, en «Volver a la forma»
  const dlg = p.getByRole("dialog", { name: /ya está cobrada/ });
  const pregunto = await dlg.waitFor({ timeout: 5000 }).then(() => true, () => false);
  if (pregunto) await p.waitForFunction(() => { const d = [...document.querySelectorAll('[role="dialog"]')].pop(); return !!d && d.contains(document.activeElement); }, null, { timeout: 5000 }).catch(() => {});
  await p.keyboard.press("Escape");
  await dlg.waitFor({ state: "detached", timeout: 5000 }).catch(() => {}); await espera(p, 300);
  const foco = await quienTieneElFoco(p);
  ok("ord-235 Esc en «Esta factura ya está cobrada» regresa el foco a «Guardar»", pregunto && /^Guardar$/.test(foco), `preguntó ${pregunto} · foco «${foco}»`);
});
await caso("ord-236 a 683×384 «Esta factura ya está cobrada» abre ARRIBA: su título y sus cifras a la vista (no desplazada al fondo)", "modo=editar&rol=admin&precio=cobrada", async p => {
  await editar(p, "OP-FA");
  await p.locator("#ff-precio").fill("1978"); await guardar(p); await espera(p, 1200);
  const r = await p.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => /ya está cobrada/.test(x.getAttribute("aria-label") || "")); if (!d) return null;
    const t = [...d.querySelectorAll("div")].find(x => x.textContent.trim() === "Esta factura ya está cobrada"); const rd = d.getBoundingClientRect(), rt = t && t.getBoundingClientRect();
    return { scrollTop: Math.round(d.scrollTop), titulo: !!rt && rt.top >= rd.top - 1 && rt.top >= 0 && rt.bottom <= innerHeight }; });
  ok("ord-236 a 683×384 «Esta factura ya está cobrada» abre ARRIBA: su título y sus cifras a la vista (no desplazada al fondo)", !!r && r.scrollTop === 0 && r.titulo, JSON.stringify(r));
}, { width: 683, height: 384 });
await caso("ord-237 «Agregar producto a OC-0900»: el cliente es el de la OC y no se cambia (con su porqué); el producto queda con ese cliente", "modo=oc", async p => {
  const inp = p.locator("#ff-cliente-input");
  const editableCli = await editable(inp);
  if (editableCli) { await inp.fill("COS"); await espera(p, 600); const op = p.getByText("COSQUIM", { exact: true }); if (await op.count()) { await op.first().click(); await espera(p, 500); } }
  const rfcEditable = await editable(p.locator("#ff-rfc"));
  const t = await texto(p);
  const porque = /cliente de (la|esta) OC-0900|de la OC-0900/i.test(t);
  await llenar(p, "Ejemplo · 1000", "300");
  await p.getByRole("button", { name: /Agregar a OC-0900/ }).first().click(); await espera(p, 1500);
  const n = await nuevas(p);
  ok("ord-237 «Agregar producto a OC-0900»: el cliente es el de la OC y no se cambia (con su porqué); el producto queda con ese cliente",
    !editableCli && !rfcEditable && porque && n.length === 1 && n[0].client === "GOBIERNO DEL ESTADO",
    `cliente editable ${editableCli} · RFC editable ${rfcEditable} · dice por qué ${porque} · nuevas ${JSON.stringify(n.map(o => o.client))}`);
});
const ordenesNuevasCompletas = p => p.evaluate(fijas => window.__estado().base.filter(o => !fijas.includes(o.id)).map(o => ({ client: o.client, client_id: o.client_id, rfc: o.client_rfc })), FIJAS);
async function llenarResto(p, { correo = "otra@ejemplo.com" } = {}) {
  if (correo) await llenar(p, "correo@ej.com", correo);
  await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", "1000"); await elegirVendedor(p, "Manuel");
}
// la base dice que el nombre ya existe (resolve_client_for_order: exact_match) aunque la lista no lo trajo: con acentos el buscador del banco
// no lo encuentra y la forma no lo elige sola (con el nombre tal cual la forma lo elige al salir del campo: eso es ord-257)
await caso("ord-238 el nombre de un cliente que ya existe, sin elegirlo y con OTRO RFC: no se crea mezclada; la forma pone a ese cliente con SU RFC y lo dice", "cliente=exacto", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "CERVECERÍA MODELO DE MÉXICO"); await espera(p, 600); await p.keyboard.press("Escape");
  await p.locator("#ff-rfc").fill("ZZZ010101AAA");
  await llenarResto(p);
  await crear(p); await espera(p, 1500);
  const n = await ordenesNuevasCompletas(p), rfc = await p.locator("#ff-rfc").inputValue(), t = await texto(p);
  ok("ord-238 el nombre de un cliente que ya existe, sin elegirlo y con OTRO RFC: no se crea mezclada; la forma pone a ese cliente con SU RFC y lo dice",
    n.length === 0 && rfc === "CMM8601014G4" && /CERVECERIA MODELO DE MEXICO/.test(t) && /ZZZ010101AAA/.test(t),
    `nuevas ${JSON.stringify(n)} · RFC en la forma «${rfc}» · dice el RFC tecleado ${/ZZZ010101AAA/.test(t)}`);
});
// (sin RFC no se llega a la base: para un nombre que no se eligió de la lista, el RFC es obligatorio; supuesto mío de la primera vuelta)
await caso("ord-239 el nombre de un cliente que ya existe, sin elegirlo y con SU RFC (en minúsculas): se crea ligada a ese cliente, con SU nombre, sin preguntar", "cliente=exacto", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "CERVECERÍA MODELO DE MÉXICO"); await espera(p, 600); await p.keyboard.press("Escape");
  await p.locator("#ff-rfc").fill("cmm8601014g4");
  await llenarResto(p, { correo: "eva@modelo.mx" });
  await crear(p); await espera(p, 1500);
  const n = await ordenesNuevasCompletas(p);
  ok("ord-239 el nombre de un cliente que ya existe, sin elegirlo y con SU RFC (en minúsculas): se crea ligada a ese cliente, con SU nombre, sin preguntar",
    n.length === 1 && n[0].client_id === "c-modelo" && n[0].rfc === "CMM8601014G4" && n[0].client === "CERVECERIA MODELO DE MEXICO", JSON.stringify(n));
});
// el menor contraste de los textos de un bloque (cada elemento con texto propio, contra su fondo real)
const menorContraste = (p, buscar) => p.evaluate(buscar => {
  const rgba = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(",").map(x => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const sobre = (a, b) => ({ r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a), a: 1 });
  const fondo = el => { const capas = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a >= 0.99) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = capas.length - 1; i >= 0; i--) base = sobre(capas[i], base); return base; };
  const L = ({ r, g, b }) => { const t = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * t(r) + 0.7152 * t(g) + 0.0722 * t(b); };
  const ratio = (a, b) => { const x = L(a), y = L(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 100) / 100; };
  const raiz = new Function("return (" + buscar + ")")(); if (!raiz) return null;
  let peor = null;
  for (const el of [raiz, ...raiz.querySelectorAll("*")]) {
    const propio = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(" ").trim();
    if (!propio || !el.getClientRects().length) continue;
    const c = rgba(getComputedStyle(el).color); if (!c) continue; const f = fondo(el), r = ratio(sobre(c, f), f);
    if (!peor || r < peor.r) peor = { r, t: propio.slice(0, 40) };
  }
  return peor;
}, buscar);
await caso("ord-240 la ayuda del bloque de Cuadra (cliente con inventario) se lee: 4.5:1 o más", "", async p => {
  await elegirCliente(p, "CUADRA BOOTS", "CUA");
  const r = await menorContraste(p, '[...document.querySelectorAll(".pf-forma div")].find(d => /^Cliente con inventario/.test(d.textContent || "") && d.querySelector("#ff-catalogo"))');
  ok("ord-240 la ayuda del bloque de Cuadra (cliente con inventario) se lee: 4.5:1 o más", !!r && r.r >= 4.5, JSON.stringify(r));
});
await caso("ord-241 el RFC con candado y vacío se lee (4.5:1 o más) y no enseña un RFC de ejemplo para teclear", "modo=editar&rol=vendedor", async p => {
  await editar(p, "OP-ED", { client_rfc: "" });
  const bloqueado = !(await editable(p.locator("#ff-rfc")));
  const r = await contraste(p, 'document.getElementById("ff-rfc")', "placeholder"), ph = await p.locator("#ff-rfc").getAttribute("placeholder");
  ok("ord-241 el RFC con candado y vacío se lee (4.5:1 o más) y no enseña un RFC de ejemplo para teclear", bloqueado && r !== null && r >= 4.5 && !/XAXX/.test(ph || ""),
    `con candado ${bloqueado} · contraste ${r} · placeholder «${ph}»`);
});
await caso("ord-242 Replicar una orden con notas y sin distribución: el aviso concuerda («sus notas no se copian»)", "", async p => {
  await p.evaluate(() => { const o = window.__estado().base.find(x => x.id === "OP-A1"); o.distribution = null; });
  await elegirCliente(p, "COSQUIM");
  await replicar(p);
  const ultimo = (await avisos(p)).pop() || "";
  ok("ord-242 Replicar una orden con notas y sin distribución: el aviso concuerda («sus notas no se copian»)", /notas no se copian/.test(ultimo) && !/notas no se copia\b/.test(ultimo), ultimo.slice(0, 160));
});
await caso("ord-243 ningún texto de la forma lleva raya (—): «Sin coincidencias…» con dos puntos", "", async p => {
  await llenar(p, "Escribe o busca un tipo...", "Tazas mágicas"); await espera(p, 300);
  const t = await p.evaluate(() => document.querySelector(".pf-forma").innerText.replace(/\s+/g, " "));
  ok("ord-243 ningún texto de la forma lleva raya (—): «Sin coincidencias…» con dos puntos", /Sin coincidencias/.test(t) && !/—/.test(t), (t.match(/[^.]{0,40}—[^.]{0,40}/) || ["sin raya"])[0]);
});
await caso("ord-244 «Agregar producto a OC-0900»: el atajo dice lo que hace (agrega a la OC), no «crea la orden»", "modo=oc", async p => {
  const t = await p.evaluate(() => document.querySelector(".pf-forma").innerText.replace(/\s+/g, " "));
  ok("ord-244 «Agregar producto a OC-0900»: el atajo dice lo que hace (agrega a la OC), no «crea la orden»", /Ctrl\+Enter agrega/i.test(t) && !/crea la orden/i.test(t), (t.match(/Ctrl\+Enter[^·]{0,40}/) || ["sin atajo"])[0]);
});
await caso("ord-245 maquila: la caja de «% Ganancia» y toda la forma sin blanco puro (#fff está fuera de la paleta)", "", async p => {
  await p.getByRole("button", { name: /^Maquila/ }).first().click(); await espera(p, 400);
  await p.locator("#ff-maq-costo").fill("800"); await p.locator("#ff-maq-precio").fill("1000"); await espera(p, 200);
  const blancos = await p.evaluate(() => [...document.querySelectorAll(".pf-forma *")].filter(e => e.getClientRects().length && getComputedStyle(e).backgroundColor === "rgb(255, 255, 255)").map(e => ((e.textContent || "").trim() || e.tagName).slice(0, 30)));
  ok("ord-245 maquila: la caja de «% Ganancia» y toda la forma sin blanco puro (#fff está fuera de la paleta)", blancos.length === 0, blancos.slice(0, 5).join(" | ") || "ninguno");
});
await caso("ord-246 con el precio bloqueado no se pide capturarlo («Captura el precio sin IVA» no sale)", "modo=candado&rol=admin", async p => {
  const bloqueado = await p.locator("#ff-precio").isDisabled().catch(() => null), t = await texto(p);
  ok("ord-246 con el precio bloqueado no se pide capturarlo («Captura el precio sin IVA» no sale)", bloqueado === true && !/Captura el precio/.test(t), `bloqueado ${bloqueado} · ${(t.match(/Captura el precio[^.]*/) || ["no lo pide"])[0]}`);
});
await caso("ord-247 un precio negativo se marca para el lector (aria-invalid) y dice por qué", "", async p => {
  await p.locator("#ff-precio").fill("-500"); await p.locator("#ff-precio").blur(); await espera(p, 200);
  const r = await p.evaluate(() => { const e = document.getElementById("ff-precio"); const d = (e.getAttribute("aria-describedby") || "").split(" ").filter(Boolean); const msg = d.map(id => document.getElementById(id)?.textContent?.trim() || "").join(" "); return { valor: e.value, invalido: e.getAttribute("aria-invalid"), msg }; });
  ok("ord-247 un precio negativo se marca para el lector (aria-invalid) y dice por qué", r.invalido === "true" && r.msg.length > 0, JSON.stringify(r));
});
await caso("ord-248 el rechazo del pie se quita al cambiar lo capturado (no se queda diciendo algo de antes)", "guardar=falla", async p => {
  await capturar(p); await crear(p); await espera(p, 1500);
  const antes = (await alertasEnLaForma(p)).filter(a => /no se cre/i.test(a.t)).length;
  await p.getByPlaceholder("Ejemplo · 1000").first().fill("2500"); await espera(p, 300);
  const despues = (await alertasEnLaForma(p)).filter(a => /no se cre/i.test(a.t)).length;
  ok("ord-248 el rechazo del pie se quita al cambiar lo capturado (no se queda diciendo algo de antes)", antes === 1 && despues === 0, `antes ${antes} · después de cambiar la cantidad ${despues}`);
});
await caso("ord-249 al ir a un faltante, la lista de tipos NO se abre sola (taparía el resumen del pie)", "", async p => {
  await elegirCliente(p, "COSQUIM"); await llenar(p, "Ejemplo · 1000", "1000");
  await crear(p); await espera(p, 600);
  const r1 = await p.evaluate(() => { const e = document.getElementById("ff-tipo"); return { foco: document.activeElement === e, abierta: e?.getAttribute("aria-expanded") }; });
  await p.locator("#ff-cantidad").focus();
  const enResumen = p.locator("button").filter({ hasText: /^Tipo/ });
  if (await enResumen.count()) { await enResumen.last().click(); await espera(p, 400); }
  const r2 = await p.evaluate(() => { const e = document.getElementById("ff-tipo"); return { foco: document.activeElement === e, abierta: e?.getAttribute("aria-expanded") }; });
  ok("ord-249 al ir a un faltante, la lista de tipos NO se abre sola (taparía el resumen del pie)", r1.foco && r1.abierta !== "true" && r2.foco && r2.abierta !== "true", `al crear ${JSON.stringify(r1)} · desde el resumen ${JSON.stringify(r2)}`);
});
await caso("ord-250 orden facturada: «no mueve la comisión» sale sólo cuando se cambia el vendedor", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-FA");
  const antes = /no mueve la comisi/.test(await texto(p));
  const sel = p.locator("select#ff-agent"); const actual = await sel.inputValue().catch(() => ""), otro = actual === "Jaime" ? "Manuel" : "Jaime";
  if (await sel.count()) { await sel.selectOption(otro); await espera(p, 200); }
  const despues = /no mueve la comisi/.test(await texto(p));
  ok("ord-250 orden facturada: «no mueve la comisión» sale sólo cuando se cambia el vendedor", !antes && despues, `al abrir ${antes} · al cambiarlo (${actual} → ${otro}) ${despues}`);
});
await caso("ord-251 el vendedor que se llenó solo con el del cliente dice que es sugerido (hasta que se elige a mano)", "", async p => {
  await elegirCliente(p, "COSQUIM");
  const v = await vendedorActual(p), ayuda = () => p.evaluate(() => document.getElementById("ff-agent-ayuda")?.textContent || "");
  const a1 = await ayuda();
  await elegirVendedor(p, "Jaime"); const a2 = await ayuda();
  ok("ord-251 el vendedor que se llenó solo con el del cliente dice que es sugerido (hasta que se elige a mano)", v === "Manuel" && /suger/i.test(a1) && /COSQUIM/.test(a1) && !/suger/i.test(a2), `vendedor «${v}» · «${a1}» → «${a2}»`);
});
await caso("ord-252 al abrir «Nueva Orden» desde el menú, el foco queda en el cliente (se empieza a escribir sin buscar el campo)", "", async p => {
  await p.evaluate(() => window.__ir("orders")); await espera(p, 300);
  await p.locator("#ir-form").click(); await espera(p, 500);
  const foco = await quienTieneElFoco(p), y = await p.evaluate(() => Math.round(scrollY));
  ok("ord-252 al abrir «Nueva Orden» desde el menú, el foco queda en el cliente (se empieza a escribir sin buscar el campo)", foco === "ff-cliente-input" && y === 0, `foco «${foco}» · scrollY ${y}`);
});
await caso("ord-253 después de crear una maquila, la siguiente sigue en maquila (una serie no regresa a «Interna» cada vez)", "", async p => {
  await capturar(p);
  await p.getByRole("button", { name: /^Maquila/ }).first().click(); await espera(p, 400);
  await p.locator("#ff-maq").fill("Impresos del Centro"); await p.locator("#ff-maq-costo").fill("800"); await p.locator("#ff-maq-precio").fill("1000");
  await crear(p); await espera(p, 1500);
  const c = await creada(p), sigue = await p.locator("#ff-maq").count();
  ok("ord-253 después de crear una maquila, la siguiente sigue en maquila (una serie no regresa a «Interna» cada vez)", /creada/.test(c) && sigue === 1, `«${c.slice(0, 60)}» · sigue en maquila ${sigue === 1}`);
});
await caso("ord-254 el contacto se nombra igual en toda la forma: «correo» (no «Email» en un lado y «email» en otro)", "", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "ZZ NUEVO SA"); await espera(p, 400); await p.keyboard.press("Escape");
  await crear(p); await espera(p, 600);
  const t = await p.evaluate(() => document.querySelector(".pf-forma").innerText.replace(/\s+/g, " "));
  ok("ord-254 el contacto se nombra igual en toda la forma: «correo» (no «Email» en un lado y «email» en otro)", !/\be-?mail\b/i.test(t) && /correo/i.test(t), (t.match(/[^.]{0,30}\be-?mail\b[^.]{0,30}/i) || ["sin «email»"])[0]);
});
await caso("ord-255 orden facturada con la revisión lenta (9 s): la pregunta dice que tardó, no «No se pudo leer»", "modo=editar&rol=admin&precio=lento&lento=9", async p => {
  await editar(p, "OP-FA");
  await p.locator("#ff-precio").fill("1978"); await guardar(p);
  await p.waitForSelector('[role="dialog"]', { timeout: 15000 }); await espera(p, 300);
  const t = await textoPregunta(p);
  ok("ord-255 orden facturada con la revisión lenta (9 s): la pregunta dice que tardó, no «No se pudo leer»", !/No se pudo leer/.test(t) && /tard|no contest/i.test(t), t.slice(0, 220));
});
await caso("ord-256 la imagen que no sube: lo dice en la forma, en palabras, y no se borra sola", "img=falla", async p => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await p.locator('input[type="file"][accept="image/*"]').first().setInputFiles({ name: "arte.png", mimeType: "image/png", buffer: png }); await espera(p, 1500);
  const al = await alertasEnLaForma(p), er = await errores(p);
  await espera(p, 7000);
  const sigue = await alertasEnLaForma(p);
  const msg = al.find(a => /imagen/i.test(a.t)), msg2 = sigue.find(a => /imagen/i.test(a.t));
  ok("ord-256 la imagen que no sube: lo dice en la forma, en palabras, y no se borra sola", !!msg && !crudo(msg.t) && /sin conexi[óo]n/i.test(msg.t) && !!msg2 && er.length === 0,
    `en la forma ${JSON.stringify(al)} · a los 8 s ${!!msg2} · avisos de error ${JSON.stringify(er)}`);
});

await caso("ord-257 el nombre IDÉNTICO tecleado: la forma elige al cliente y su RFC ya no se cambia aquí (con su porqué); la orden sale con SU RFC", "cliente=exacto", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "CERVECERIA MODELO DE MEXICO"); await espera(p, 600); await p.keyboard.press("Escape");
  await llenar(p, "correo@ej.com", "eva@modelo.mx"); await espera(p, 400);   // salir del campo: la forma lo elige
  const rfc = p.locator("#ff-rfc"), sePuede = await editable(rfc);
  if (sePuede) { await rfc.fill("ZZZ010101AAA"); await espera(p, 200); }
  const t = await texto(p), porque = /RFC de CERVECERIA MODELO DE MEXICO/.test(t);
  await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", "1000"); await elegirVendedor(p, "Manuel");
  await crear(p); await espera(p, 1500);
  const n = await ordenesNuevasCompletas(p);
  ok("ord-257 el nombre IDÉNTICO tecleado: la forma elige al cliente y su RFC ya no se cambia aquí (con su porqué); la orden sale con SU RFC",
    !sePuede && porque && n.length === 1 && n[0].client_id === "c-modelo" && n[0].rfc === "CMM8601014G4", `RFC editable ${sePuede} · dice por qué ${porque} · nuevas ${JSON.stringify(n)}`);
});

// ── v10.84.81, segunda vuelta: por donde no se diseñó ──
await caso("ord-258 [P1] a 1920×1080 (dos columnas, menú plegado), con la página desplazada, «P-… creada» también se ve en cuanto sale", "menu=plegado", async p => {
  await capturar(p);
  await p.evaluate(() => { document.body.style.paddingBottom = "1600px"; scrollTo({ top: 420, behavior: "instant" }); }); await espera(p, 150);
  await p.locator("textarea").first().evaluate(e => e.focus({ preventScroll: true }));
  const y0 = await p.evaluate(() => Math.round(scrollY));
  await vigilarCreada(p); await p.keyboard.press("Control+Enter");
  await p.waitForFunction(() => window.__creadaAlSalir && window.__creadaAlSalir !== "esperando", null, { timeout: 8000 });
  const alSalir = await p.evaluate(() => window.__creadaAlSalir); await espera(p, 700);
  const luego = await p.evaluate(() => window.__creadaAhora());
  ok("ord-258 [P1] a 1920×1080 (dos columnas, menú plegado), con la página desplazada, «P-… creada» también se ve en cuanto sale", y0 > 0 && aLaVista(alSalir) && aLaVista(luego), JSON.stringify({ y0, alSalir, luego }));
}, { width: 1920, height: 1080 }, { movimiento: true });
await caso("ord-259 [P1] Ctrl+Enter dos veces seguidas desde la descripción: UNA orden y «P-… creada» a la vista", "", async p => {
  await capturar(p);
  const ta = p.locator("textarea").first(); await ta.evaluate(e => e.scrollIntoView({ block: "center", behavior: "instant" })); await ta.focus();
  await p.keyboard.press("Control+Enter"); await p.keyboard.press("Control+Enter"); await espera(p, 1600);
  const n = await nuevas(p), r = await p.evaluate(() => window.__creadaAhora ? window.__creadaAhora() : (() => { const b = [...document.querySelectorAll('.pf-forma [role="status"]')].find(e => /creada/.test(e.textContent || "")); if (!b) return null; const x = b.getBoundingClientRect(); return { top: x.top, bottom: x.bottom, alto: innerHeight }; })());
  ok("ord-259 [P1] Ctrl+Enter dos veces seguidas desde la descripción: UNA orden y «P-… creada» a la vista", n.length === 1 && aLaVista(r), `nuevas ${n.length} · ${JSON.stringify(r)}`);
}, undefined, { movimiento: true });
await caso("ord-260 «¿Salir sin guardar?» abierta desde el menú: Esc regresa el foco a ese botón del menú; y «Salir sin guardar» sí sale, sin errores", "", async p => {
  await llenar(p, "Ejemplo · 1000", "250");
  await p.locator("#ir-orders").focus(); await p.keyboard.press("Enter"); await espera(p, 500);
  const pregunto = await hayPregunta(p);
  await p.keyboard.press("Escape"); await espera(p, 400);
  const foco = await quienTieneElFoco(p);
  await p.locator("#ir-orders").click(); await espera(p, 400);
  await p.getByRole("button", { name: /Salir sin guardar/ }).click(); await espera(p, 600);
  const e = await estado(p);
  ok("ord-260 «¿Salir sin guardar?» abierta desde el menú: Esc regresa el foco a ese botón del menú; y «Salir sin guardar» sí sale, sin errores", pregunto && foco === "ir-orders" && e.vista === "orders",
    `preguntó ${pregunto} · foco «${foco}» · vista ${e.vista}`);
});
await caso("ord-261 el RFC con candado del cliente elegido se suelta al cambiar la razón social (otro cliente): queda vacío y se puede teclear", "", async p => {
  await elegirCliente(p, "COSQUIM");
  const antes = await editable(p.locator("#ff-rfc"));
  await llenar(p, "Cliente (escribe para buscar)", "TALLERES NUEVOS SA"); await espera(p, 500); await p.keyboard.press("Escape");
  await p.locator("#ff-cantidad").focus(); await espera(p, 300);
  const despues = await editable(p.locator("#ff-rfc")), v = await p.locator("#ff-rfc").inputValue();
  ok("ord-261 el RFC con candado del cliente elegido se suelta al cambiar la razón social (otro cliente): queda vacío y se puede teclear", !antes && despues && v === "",
    `con COSQUIM editable ${antes} · con otro nombre editable ${despues} · RFC «${v}»`);
});
await caso("ord-262 un cliente SIN RFC en su ficha: el RFC se puede poner (no hay candado) y la orden lo lleva, ligada a ese cliente", "", async p => {
  await elegirCliente(p, "IMPRENTA SIN RFC", "IMPR");
  const ed = await editable(p.locator("#ff-rfc"));
  if (ed) await p.locator("#ff-rfc").fill("ISR010101AB1");
  await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", "500"); await elegirVendedor(p, "Manuel");
  await crear(p); await espera(p, 1500);
  const n = await ordenesNuevasCompletas(p);
  ok("ord-262 un cliente SIN RFC en su ficha: el RFC se puede poner (no hay candado) y la orden lo lleva, ligada a ese cliente", ed && n.length === 1 && n[0].client_id === "c-sinrfc" && n[0].rfc === "ISR010101AB1",
    `editable ${ed} · ${JSON.stringify(n)}`);
});
await caso("ord-263 después de «ya existe con el RFC…», Crear otra vez crea UNA orden con ese cliente y SU RFC (no se queda preguntando)", "cliente=exacto", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "CERVECERÍA MODELO DE MÉXICO"); await espera(p, 600); await p.keyboard.press("Escape");
  await p.locator("#ff-rfc").fill("ZZZ010101AAA"); await llenarResto(p);
  await crear(p); await espera(p, 1500);
  const n0 = (await ordenesNuevasCompletas(p)).length;
  await crear(p); await espera(p, 1500);
  const n = await ordenesNuevasCompletas(p);
  ok("ord-263 después de «ya existe con el RFC…», Crear otra vez crea UNA orden con ese cliente y SU RFC (no se queda preguntando)", n0 === 0 && n.length === 1 && n[0].client_id === "c-modelo" && n[0].rfc === "CMM8601014G4",
    `${n0} → ${JSON.stringify(n)}`);
});
await caso("ord-264 Replicar: Esc con algo buscado lo borra y no cierra; Esc otra vez cierra y el foco regresa a su botón", "", async p => {
  await elegirCliente(p, "COSQUIM");
  const b = p.getByRole("button", { name: /Replicar de orden anterior/ }); await b.first().focus(); await p.keyboard.press("Enter"); await espera(p, 800);
  await p.keyboard.type("P-06"); await espera(p, 200);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const sigue = await hayPregunta(p), busq = await p.evaluate(() => document.activeElement?.value ?? null);
  await p.keyboard.press("Escape"); await espera(p, 400);
  const cerro = !(await hayPregunta(p)), foco = await quienTieneElFoco(p);
  ok("ord-264 Replicar: Esc con algo buscado lo borra y no cierra; Esc otra vez cierra y el foco regresa a su botón", sigue && busq === "" && cerro && /Replicar de orden anterior/.test(foco),
    `sigue abierta ${sigue} · búsqueda «${busq}» · cerró ${cerro} · foco «${foco}»`);
});
await caso("ord-265 volver a intentar SIN cambiar nada y que vuelva a fallar: el rechazo sigue en el pie (una vez)", "guardar=falla", async p => {
  await capturar(p); await crear(p); await espera(p, 1500);
  await crear(p); await espera(p, 1500);
  const msg = (await alertasEnLaForma(p)).filter(a => /no se cre/i.test(a.t));
  ok("ord-265 volver a intentar SIN cambiar nada y que vuelva a fallar: el rechazo sigue en el pie (una vez)", msg.length === 1, JSON.stringify(msg));
});
await caso("ord-266 con Tab, el tipo sigue abriendo su lista al entrar (lo de los faltantes no cambió eso)", "", async p => {
  await p.locator("#ff-tipo").focus(); await p.keyboard.press("Shift+Tab"); await espera(p, 100); await p.keyboard.press("Tab"); await espera(p, 250);
  const r = await p.evaluate(() => { const e = document.getElementById("ff-tipo"); return { foco: document.activeElement === e, abierta: e.getAttribute("aria-expanded") }; });
  ok("ord-266 con Tab, el tipo sigue abriendo su lista al entrar (lo de los faltantes no cambió eso)", r.foco && r.abierta === "true", JSON.stringify(r));
});
await caso("ord-267 el vendedor sugerido sigue al cliente (COSQUIM → CUADRA BOOTS) y al crear la orden el «sugerido» se va", "", async p => {
  await elegirCliente(p, "COSQUIM");
  await llenar(p, "Cliente (escribe para buscar)", "CUA"); await espera(p, 600); await p.getByText("CUADRA BOOTS", { exact: true }).first().click(); await espera(p, 700);
  const v = await vendedorActual(p), a1 = await p.evaluate(() => document.getElementById("ff-agent-ayuda")?.textContent || "");
  await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape"); await llenar(p, "Ejemplo · 1000", "300");
  await crear(p); await espera(p, 1500);
  const a2 = await p.evaluate(() => document.getElementById("ff-agent-ayuda")?.textContent || ""), c = await creada(p);
  ok("ord-267 el vendedor sugerido sigue al cliente (COSQUIM → CUADRA BOOTS) y al crear la orden el «sugerido» se va", /Pepe Chuy/.test(v) && /CUADRA BOOTS/.test(a1) && /creada/.test(c) && !/suger/i.test(a2),
    `vendedor «${v}» · «${a1}» → al crear «${a2}»`);
});
await caso("ord-268 editar una orden NO lleva el foco al cliente (eso es sólo para una orden nueva)", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-ED"); await espera(p, 300);
  const foco = await quienTieneElFoco(p);
  ok("ord-268 editar una orden NO lleva el foco al cliente (eso es sólo para una orden nueva)", foco !== "ff-cliente-input", `foco «${foco}»`);
});
await caso("ord-269 la revisión de la factura que FALLA (no que tarda) sigue diciendo «No se pudo leer»", "modo=editar&rol=admin&precio=falla", async p => {
  await editar(p, "OP-FA"); await p.locator("#ff-precio").fill("1978"); await guardar(p);
  await p.waitForSelector('[role="dialog"]', { timeout: 8000 }); await espera(p, 300);
  const t = await textoPregunta(p);
  ok("ord-269 la revisión de la factura que FALLA (no que tarda) sigue diciendo «No se pudo leer»", /No se pudo leer/.test(t) && !/tard/i.test(t), t.slice(0, 200));
});
await caso("ord-270 la imagen que no subió: al crear la orden, su aviso se va con ella (no se queda para la siguiente)", "img=falla", async p => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await p.locator('input[type="file"][accept="image/*"]').first().setInputFiles({ name: "arte.png", mimeType: "image/png", buffer: png }); await espera(p, 1200);
  const antes = (await alertasEnLaForma(p)).some(a => /imagen/i.test(a.t));
  await capturar(p); await crear(p); await espera(p, 1500);
  const despues = (await alertasEnLaForma(p)).some(a => /imagen/i.test(a.t)), c = await creada(p);
  ok("ord-270 la imagen que no subió: al crear la orden, su aviso se va con ella (no se queda para la siguiente)", antes && /creada/.test(c) && !despues, `antes ${antes} · creada «${c.slice(0, 30)}» · después ${despues}`);
});
await caso("ord-271 «Agregar producto a OC-0900»: el correo del contacto sí se cambia (el candado es la razón social y el RFC)", "modo=oc", async p => {
  const ed = await editable(p.locator("#ff-contacto"));
  ok("ord-271 «Agregar producto a OC-0900»: el correo del contacto sí se cambia (el candado es la razón social y el RFC)", ed, `correo editable ${ed}`);
});
await caso("ord-272 doble clic en «Agregar a OC-0900»: UN producto en la OC", "modo=oc", async p => {
  await llenar(p, "Ejemplo · 1000", "300");
  await p.getByRole("button", { name: /Agregar a OC-0900/ }).first().dblclick(); await espera(p, 1600);
  const n = await nuevas(p);
  ok("ord-272 doble clic en «Agregar a OC-0900»: UN producto en la OC", n.length === 1, `nuevos ${n.length}`);
});

// ── v10.84.81, tercera vuelta: las fallas EN los arreglos de las dos anteriores ──
await caso("ord-273 el tipo escrito en minúsculas se acomoda al salir con Tab («folders» → «Folders»), también tras volver rápido al campo", "", async p => {
  const t = p.locator("#ff-tipo");
  await t.focus(); await p.keyboard.press("Shift+Tab"); await espera(p, 80); await p.keyboard.press("Tab"); await espera(p, 120);
  await t.fill("folders"); await espera(p, 100); await p.keyboard.press("Escape"); await p.keyboard.press("Tab"); await espera(p, 400);
  const v = await t.inputValue();
  ok("ord-273 el tipo escrito en minúsculas se acomoda al salir con Tab («folders» → «Folders»), también tras volver rápido al campo", v === "Folders", `«${v}»`);
});
await caso("ord-274 «Seguir capturando» con el ratón también regresa el foco a «Cancelar» (no sólo Esc)", "", async p => {
  await llenar(p, "Ejemplo · 1000", "250");
  await p.getByRole("button", { name: /^Cancelar$/ }).first().click(); await espera(p, 500);
  const pregunto = await hayPregunta(p);
  await p.getByRole("button", { name: /Seguir capturando/ }).click(); await espera(p, 400);
  const foco = await quienTieneElFoco(p), cant = await p.getByPlaceholder("Ejemplo · 1000").first().inputValue();
  ok("ord-274 «Seguir capturando» con el ratón también regresa el foco a «Cancelar» (no sólo Esc)", pregunto && /^Cancelar$/.test(foco) && cant === "250", `preguntó ${pregunto} · foco «${foco}» · cantidad «${cant}»`);
});
await caso("ord-275 editar una orden (Dirección): el RFC sigue como antes, sin el candado del cliente elegido en una orden nueva", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-ED");
  const ed = await editable(p.locator("#ff-rfc"));
  ok("ord-275 editar una orden (Dirección): el RFC sigue como antes, sin el candado del cliente elegido en una orden nueva", ed, `RFC editable ${ed}`);
});
await caso("ord-276 desde «Todas», la N abre una orden nueva con el foco en el cliente", "", async p => {
  await p.evaluate(() => window.__ir("orders")); await espera(p, 300);
  await p.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await p.keyboard.press("n"); await espera(p, 600);
  const e = await estado(p), foco = await quienTieneElFoco(p);
  ok("ord-276 desde «Todas», la N abre una orden nueva con el foco en el cliente", e.vista === "form" && foco === "ff-cliente-input", `vista ${e.vista} · foco «${foco}»`);
});
await caso("ord-277 crear FALLA desde la descripción (página desplazada): la página NO brinca arriba y el rechazo se ve", "guardar=falla", async p => {
  await capturar(p);
  const ta = p.locator("textarea").first(); await ta.evaluate(e => e.scrollIntoView({ block: "center", behavior: "instant" })); await ta.focus(); await espera(p, 150);
  const y0 = await p.evaluate(() => Math.round(scrollY));
  await p.keyboard.press("Control+Enter"); await espera(p, 1500); await quieta(p);
  const y1 = await p.evaluate(() => Math.round(scrollY)), al = (await alertasEnLaForma(p)).filter(a => /no se cre/i.test(a.t));
  ok("ord-277 crear FALLA desde la descripción (página desplazada): la página NO brinca arriba y el rechazo se ve", y0 > 0 && y1 > 0 && al.length === 1 && al[0].visible, `scrollY ${y0} → ${y1} · ${JSON.stringify(al)}`);
});
await caso("ord-278 después de una maquila, pasar a «Interna» a mano y crear: la siguiente es interna", "", async p => {
  await capturar(p);
  await p.getByRole("button", { name: /^Maquila/ }).first().click(); await espera(p, 300);
  await p.locator("#ff-maq").fill("Impresos del Centro"); await p.locator("#ff-maq-costo").fill("800"); await p.locator("#ff-maq-precio").fill("1000");
  await crear(p); await espera(p, 1500);
  await p.getByRole("button", { name: /Producción Interna/ }).first().click(); await espera(p, 300);   // (el botón se llama «Producción Interna»)
  await capturar(p); await crear(p); await espera(p, 1500);
  const n = (await nuevas(p)).length, sigueMaq = await p.locator("#ff-maq").count();
  ok("ord-278 después de una maquila, pasar a «Interna» a mano y crear: la siguiente es interna", n === 2 && sigueMaq === 0, `órdenes ${n} · en maquila ${sigueMaq === 1}`);
});
await caso("ord-279 el porqué del RFC con candado se lee (4.5:1 o más)", "", async p => {
  await elegirCliente(p, "COSQUIM");
  const r = await menorContraste(p, '[...document.querySelectorAll(".pf-forma div")].find(d => /^Es el RFC de COSQUIM/.test(d.textContent || "") && !d.querySelector("div"))');
  ok("ord-279 el porqué del RFC con candado se lee (4.5:1 o más)", !!r && r.r >= 4.5, JSON.stringify(r));
});
await caso("ord-280 doble clic en «Crear Orden» con el nombre que ya existe y OTRO RFC: ninguna orden, y queda el RFC del cliente", "cliente=exacto", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "CERVECERÍA MODELO DE MÉXICO"); await espera(p, 600); await p.keyboard.press("Escape");
  await p.locator("#ff-rfc").fill("ZZZ010101AAA"); await llenarResto(p);
  await p.getByRole("button", { name: /Crear Orden/ }).first().dblclick(); await espera(p, 1800);
  const n = await ordenesNuevasCompletas(p), rfc = await p.locator("#ff-rfc").inputValue();
  ok("ord-280 doble clic en «Crear Orden» con el nombre que ya existe y OTRO RFC: ninguna orden, y queda el RFC del cliente", n.length === 0 && rfc === "CMM8601014G4", `nuevas ${JSON.stringify(n)} · RFC «${rfc}»`);
});

// ── v10.84.82: UNA sola forma (Marcelo, 12-oct, la «A» del análisis de los modos: en 90 días Lupita mezcla texto y campos en el 32 % de
//    sus órdenes y el bloque de campos, 721 px, dejaba la imagen a 1,552 px a 1366) y Replicar sin el precio de otra cantidad ──
const yDe = (p, que) => p.evaluate(que => {
  const abs = el => el ? Math.round(el.getBoundingClientRect().top + scrollY) : null;
  if (que === "descripcion") return abs(document.getElementById("ff-descripcion"));
  if (que === "imagenes") return abs([...document.querySelectorAll(".pf-forma label")].find(l => /Imágenes/.test(l.textContent || "")));
  if (que === "papel") return abs(document.getElementById("ff-papel"));
  return null;
}, que);
const plegarEsp = p => p.getByRole("button", { name: /^Especificaciones/ });
const tieneTexto = async (p, re) => re.test(await texto(p));
await caso("ord-281 una sola forma: no se elige «Sencillo / Avanzado» antes de capturar", "", async p => {
  const n = await p.getByRole("button", { name: /^(Sencillo|Avanzado)$/ }).count(), modo = await tieneTexto(p, /Modo de captura/i);
  ok("ord-281 una sola forma: no se elige «Sencillo / Avanzado» antes de capturar", n === 0 && !modo, `botones de modo ${n} · «Modo de captura» ${modo}`);
});
await caso("ord-282 lo que se guarda se ve: lo capturado en especificaciones no se puede esconder sin que se diga (antes «Avanzado» lo escondía y se guardaba)", "", async p => {
  await p.locator("#ff-papel").fill("Couché"); await p.locator("#ff-gramaje").fill("150"); await espera(p, 100);
  // todo lo que la forma ofrece para esconder las especificaciones: el modo «Avanzado» (si lo hay) y plegar la sección (si se puede)
  const av = p.getByRole("button", { name: /^Avanzado$/ });
  if (await av.count()) { await av.first().click(); await espera(p, 200); }
  const pl = plegarEsp(p);
  if ((await pl.count()) && (await pl.first().getAttribute("aria-expanded")) === "true") { await pl.first().click(); await espera(p, 200); }
  const r = await p.evaluate(() => ({ campo: !!document.getElementById("ff-papel"), dice: /Couché 150/.test(document.querySelector(".pf-forma").innerText) }));
  ok("ord-282 lo que se guarda se ve: lo capturado en especificaciones no se puede esconder sin que se diga (antes «Avanzado» lo escondía y se guardaba)", r.campo || r.dice, JSON.stringify(r));
});
await caso("ord-283 a 1366 con el menú abierto la imagen queda a menos de 900 px (era 1,552: detrás de las especificaciones)", "", async p => {
  const y = await yDe(p, "imagenes");
  ok("ord-283 a 1366 con el menú abierto la imagen queda a menos de 900 px (era 1,552: detrás de las especificaciones)", y !== null && y < 900, `imágenes a ${y} px`);
});
await caso("ord-284 a 1366 el orden de la hoja impresa: descripción, después «Para producción» (la imagen) y luego las especificaciones", "", async p => {
  const d = await yDe(p, "descripcion"), i = await yDe(p, "imagenes"), e = await yDe(p, "papel");
  ok("ord-284 a 1366 el orden de la hoja impresa: descripción, después «Para producción» (la imagen) y luego las especificaciones", d !== null && i !== null && e !== null && d < i && i < e, `descripción ${d} · imágenes ${i} · papel ${e}`);
});
await caso("ord-285 a 1920 la imagen se sube sin desplazar: «Subir 1ra» arriba del pie", "", async p => {
  const top = await pieTop(p), b = await p.evaluate(() => { const x = [...document.querySelectorAll(".pf-forma button")].find(e => /Subir 1ra/.test(e.textContent || "")); return x ? Math.round(x.getBoundingClientRect().bottom) : null; });
  ok("ord-285 a 1920 la imagen se sube sin desplazar: «Subir 1ra» arriba del pie", b !== null && b <= top, `«Subir 1ra» termina en ${b} · el pie empieza en ${Math.round(top)}`);
}, { width: 1920, height: 1080 });
await caso("ord-286 las especificaciones empiezan ABIERTAS en cada orden nueva (también después de plegarlas y crear una)", "", async p => {
  const t = plegarEsp(p), hay = (await t.count()) > 0;
  const a1 = hay ? await t.first().getAttribute("aria-expanded") : null;
  if (hay) { await t.first().click(); await espera(p, 150); }
  await capturar(p); await crear(p); await espera(p, 1500);
  const a2 = hay ? await plegarEsp(p).first().getAttribute("aria-expanded") : null, papel = await p.locator("#ff-papel").count();
  ok("ord-286 las especificaciones empiezan ABIERTAS en cada orden nueva (también después de plegarlas y crear una)", hay && a1 === "true" && a2 === "true" && papel === 1,
    `se pliegan ${hay} · al abrir ${a1} · después de crear ${a2} · papel a la vista ${papel === 1}`);
});
await caso("ord-287 plegadas, las especificaciones dicen lo que traen (y «Sin especificaciones» si no traen nada)", "", async p => {
  const t = plegarEsp(p);
  if (!(await t.count())) { ok("ord-287 plegadas, las especificaciones dicen lo que traen (y «Sin especificaciones» si no traen nada)", false, "no se pueden plegar"); return; }
  await t.first().click(); await espera(p, 150);
  const vacia = (await t.first().innerText()).replace(/\s+/g, " ");
  await t.first().click(); await espera(p, 150);
  await p.locator("#ff-papel").fill("Couché"); await p.locator("#ff-gramaje").fill("150");
  await p.locator("#ff-tintas-frente").fill("4"); await p.locator("#ff-tintas-vuelta").fill("1");
  await p.getByRole("button", { name: /Tamaño estándar/ }).click(); await espera(p, 100);
  await p.getByRole("button", { name: /^Doblez$/ }).first().click(); await espera(p, 100);
  await t.first().click(); await espera(p, 150);
  const llena = (await t.first().innerText()).replace(/\s+/g, " ");
  ok("ord-287 plegadas, las especificaciones dicen lo que traen (y «Sin especificaciones» si no traen nada)",
    /Sin especificaciones/i.test(vacia) && /Couché 150 g/.test(llena) && /frente 4/i.test(llena) && /vuelta 1/i.test(llena) && /Carta/.test(llena) && /Doblez/.test(llena), `vacía «${vacia}» · llena «${llena}»`);
});
await caso("ord-288 la descripción crece con lo escrito (8 renglones sin barra) y no sin fin (30 renglones: tope y barra)", "", async p => {
  const d = p.locator("#ff-descripcion");
  await d.fill(Array.from({ length: 8 }, (_, i) => "Renglón " + (i + 1) + " de la descripción").join("\n")); await espera(p, 150);
  const r8 = await d.evaluate(e => ({ alto: e.clientHeight, contenido: e.scrollHeight }));
  await d.fill(Array.from({ length: 30 }, (_, i) => "Renglón " + (i + 1)).join("\n")); await espera(p, 150);
  const r30 = await d.evaluate(e => ({ alto: e.clientHeight, contenido: e.scrollHeight }));
  ok("ord-288 la descripción crece con lo escrito (8 renglones sin barra) y no sin fin (30 renglones: tope y barra)", r8.contenido <= r8.alto + 2 && r30.alto <= 360 && r30.contenido > r30.alto,
    `8 renglones ${JSON.stringify(r8)} · 30 renglones ${JSON.stringify(r30)}`);
});
await caso("ord-289 editar una orden de texto largo y sin especificaciones (antes «Avanzado»): el texto completo a la vista, y guardar sin tocar no cambia nada", "modo=editar&rol=admin", async p => {
  const largo = "CALENDARIOS 2027\nBASE\nMEDIDA EXT. 41 X 21\nCARTULINA SULFATADA 20 PTS.\nIMP. 4 X 0\n\nHOJAS\n13 HOJAS COUCHE 150 G\nIMP. 4 X 4\nENGARGOLADO";
  await p.evaluate(t => { const o = window.__estado().base.find(x => x.id === "OP-ED"); Object.assign(o, { product: t, paper_type: null, paper_grammage: null, ink_front: null, width_cm: null, height_cm: null, finishes: null }); }, largo);
  await editar(p, "OP-ED");
  const d = await p.locator("#ff-descripcion").evaluate(e => ({ largo: e.value.length, alto: e.clientHeight, contenido: e.scrollHeight }));
  await guardar(p); await espera(p, 900);
  const a = await avisos(p), t = await texto(p), sin = a.some(x => /Sin cambios/i.test(x)) || /Sin cambios/i.test(t);
  ok("ord-289 editar una orden de texto largo y sin especificaciones (antes «Avanzado»): el texto completo a la vista, y guardar sin tocar no cambia nada",
    d.largo === largo.length && d.contenido <= d.alto + 2 && sin, `${JSON.stringify(d)} · «Sin cambios» ${sin}`);
});
await caso("ord-290 Pre-prensa («Editar Specs»): sus especificaciones editables y la descripción de sólo lectura (como antes)", "modo=specs&rol=preprensa", async p => {
  const papel = await editable(p.locator("#ff-papel")), caja = await p.locator("#ff-descripcion").count(), dice = await tieneTexto(p, /Recetas Dr\. Eduardo Fuentes/);
  ok("ord-290 Pre-prensa («Editar Specs»): sus especificaciones editables y la descripción de sólo lectura (como antes)", papel && caja === 0 && dice, `papel editable ${papel} · caja de descripción ${caja} · la descripción se lee ${dice}`);
});
await caso("ord-291 maquila: su «Descripción del trabajo» y sin especificaciones (como antes)", "", async p => {
  await p.getByRole("button", { name: /^Maquila/ }).first().click(); await espera(p, 300);
  const r = await p.evaluate(() => ({ caja: !!document.getElementById("ff-descripcion"), etiqueta: /Descripción del trabajo/i.test(document.querySelector(".pf-forma").innerText), papel: !!document.getElementById("ff-papel") }));
  ok("ord-291 maquila: su «Descripción del trabajo» y sin especificaciones (como antes)", r.caja && r.etiqueta && !r.papel, JSON.stringify(r));
});
await caso("ord-292 Replicar una orden de 1,000 pzas sobre 777: NO copia el precio, y lo dice bajo Precio y en el aviso", "", async p => {
  await elegirCliente(p, "COSQUIM"); await llenar(p, "Ejemplo · 1000", "777");
  await replicar(p);
  const precio = await p.locator("#ff-precio").inputValue(), cant = await p.getByPlaceholder("Ejemplo · 1000").first().inputValue();
  const t = await texto(p), ultimo = (await avisos(p)).pop() || "";
  ok("ord-292 Replicar una orden de 1,000 pzas sobre 777: NO copia el precio, y lo dice bajo Precio y en el aviso",
    precio === "" && /^777$/.test(cant) && /No se copi[óo] el precio de P-0648/i.test(t) && /1,000/.test(t) && /precio/i.test(ultimo),
    `precio «${precio}» · cantidad «${cant}» · la nota ${/No se copi[óo] el precio/i.test(t)} · aviso «${ultimo.slice(0, 140)}»`);
});
await caso("ord-293 Replicar con la cantidad vacía: trae la cantidad Y su precio (son de la misma orden)", "", async p => {
  await elegirCliente(p, "COSQUIM"); await replicar(p);
  const cant = await p.getByPlaceholder("Ejemplo · 1000").first().inputValue(), precio = await p.locator("#ff-precio").inputValue();
  ok("ord-293 Replicar con la cantidad vacía: trae la cantidad Y su precio (son de la misma orden)", /^1,?000$/.test(cant) && /^4,?200(\.00)?$/.test(precio), `cantidad «${cant}» · precio «${precio}»`);
});
await caso("ord-294 Replicar con la MISMA cantidad ya tecleada: copia el precio", "", async p => {
  await elegirCliente(p, "COSQUIM"); await llenar(p, "Ejemplo · 1000", "1000"); await replicar(p);
  const precio = await p.locator("#ff-precio").inputValue(), nota = await tieneTexto(p, /No se copi[óo] el precio/i);
  ok("ord-294 Replicar con la MISMA cantidad ya tecleada: copia el precio", /^4,?200(\.00)?$/.test(precio) && !nota, `precio «${precio}» · nota ${nota}`);
});
await caso("ord-295 la nota «No se copió el precio» se va al capturar el precio, y con «Deshacer» del aviso", "", async p => {
  await elegirCliente(p, "COSQUIM"); await llenar(p, "Ejemplo · 1000", "777"); await replicar(p);
  const antes = await tieneTexto(p, /No se copi[óo] el precio/i);
  await p.locator("#ff-precio").fill("3500"); await espera(p, 150);
  const conPrecio = await tieneTexto(p, /No se copi[óo] el precio/i);
  await p.locator("#ff-precio").fill(""); await espera(p, 150);
  const des = p.getByRole("button", { name: /^Deshacer$/ }); if (await des.count()) { await des.last().click(); await espera(p, 300); }
  const despues = await tieneTexto(p, /No se copi[óo] el precio/i);
  ok("ord-295 la nota «No se copió el precio» se va al capturar el precio, y con «Deshacer» del aviso", antes && !conPrecio && !despues, `al replicar ${antes} · con precio ${conPrecio} · tras «Deshacer» ${despues}`);
});
await caso("ord-296 Replicar una maquila de otra cantidad: no copia el costo ni el precio de maquila (el proveedor sí)", "", async p => {
  await p.evaluate(() => window.__estado().base.push({ id: "OP-MQ2", production_number: "P-0646", client: "COSQUIM", client_id: "c-cosquim", client_company: "COSQUIM", client_email: "compras@cosquim.mx",
    order_type: "maquila", product_type: "Bolsas", product: "Bolsa kraft con asa", quantity: 1000, maq_provider: "Bolsas del Bajío", maq_cost: 5000, maq_price: 7000,
    stage: "maq_sent", source: "internal", agent: "Manuel", created_by: "lupita", created_at: "2026-10-08T10:00:00Z" }));
  await elegirCliente(p, "COSQUIM");
  await p.getByRole("button", { name: /^Maquila/ }).first().click(); await espera(p, 300);
  await llenar(p, "Ejemplo · 1000", "500");
  await replicar(p, "P-0646");
  const costo = await p.locator("#ff-maq-costo").inputValue(), precio = await p.locator("#ff-maq-precio").inputValue(), prov = await p.locator("#ff-maq").inputValue();
  ok("ord-296 Replicar una maquila de otra cantidad: no copia el costo ni el precio de maquila (el proveedor sí)", costo === "" && precio === "" && /Bolsas del Baj/.test(prov),
    `costo «${costo}» · precio «${precio}» · proveedor «${prov}»`);
});
await caso("ord-297 a 683×384 (una columna) el mismo orden: descripción, la imagen y luego las especificaciones", "", async p => {
  const d = await yDe(p, "descripcion"), i = await yDe(p, "imagenes"), e = await yDe(p, "papel");
  ok("ord-297 a 683×384 (una columna) el mismo orden: descripción, la imagen y luego las especificaciones", d !== null && i !== null && e !== null && d < i && i < e, `descripción ${d} · imágenes ${i} · papel ${e}`);
}, { width: 683, height: 384 });

// ── v10.84.82, segunda vuelta: por donde no se diseñó ──
const espAbierta = async p => (await plegarEsp(p).first().getAttribute("aria-expanded").catch(() => null)) === "true";
const plegar = async p => { if (await espAbierta(p)) { await clic(plegarEsp(p)); await espera(p, 150); } };
await caso("ord-298 con las especificaciones plegadas, Replicar las trae: el resumen las dice y al abrir están en sus campos", "", async p => {
  await elegirCliente(p, "COSQUIM"); await plegar(p);
  await replicar(p);
  const resumen = (await plegarEsp(p).first().innerText()).replace(/\s+/g, " ");
  await clic(plegarEsp(p)); await espera(p, 150);
  const papel = await p.locator("#ff-papel").inputValue().catch(() => "");
  ok("ord-298 con las especificaciones plegadas, Replicar las trae: el resumen las dice y al abrir están en sus campos", /Couché adhesivo/.test(resumen) && /5 × 4 cm/.test(resumen) && papel === "Couché adhesivo", `resumen «${resumen}» · papel «${papel}»`);
});
await caso("ord-299 plegar no quita nada: con las especificaciones plegadas, la orden se crea CON ellas", "", async p => {
  await capturar(p);
  await p.locator("#ff-papel").fill("Bond"); await p.locator("#ff-gramaje").fill("90"); await plegar(p);
  await crear(p); await espera(p, 1500);
  const o = await p.evaluate(fijas => window.__estado().base.filter(x => !fijas.includes(x.id)).map(x => ({ papel: x.paper_type, gramaje: x.paper_grammage })), FIJAS);
  ok("ord-299 plegar no quita nada: con las especificaciones plegadas, la orden se crea CON ellas", o.length === 1 && o[0].papel === "Bond" && String(o[0].gramaje) === "90", JSON.stringify(o));
});
await caso("ord-300 un número malo dentro de las especificaciones plegadas: al crear se abren y el foco va a ese campo", "", async p => {
  await capturar(p);
  await p.locator("#ff-gramaje").fill("15o"); await plegar(p);
  await crear(p); await espera(p, 700);
  const r = await p.evaluate(() => ({ foco: document.activeElement?.id || document.activeElement?.tagName, abierta: !!document.getElementById("ff-gramaje") }));
  ok("ord-300 un número malo dentro de las especificaciones plegadas: al crear se abren y el foco va a ese campo", r.abierta && r.foco === "ff-gramaje" && (await nuevas(p)).length === 0, JSON.stringify(r));
});
await caso("ord-301 con el teclado: Enter en «Especificaciones» la pliega y la abre, y el foco se queda en el botón", "", async p => {
  const b = plegarEsp(p); await b.first().focus();
  await p.keyboard.press("Enter"); await espera(p, 150); const a1 = await espAbierta(p), f1 = await quienTieneElFoco(p);
  await p.keyboard.press("Enter"); await espera(p, 150); const a2 = await espAbierta(p), f2 = await quienTieneElFoco(p);
  ok("ord-301 con el teclado: Enter en «Especificaciones» la pliega y la abre, y el foco se queda en el botón", !a1 && a2 && /^Especificaciones/.test(f1) && /^Especificaciones/.test(f2), `${a1}/${f1} → ${a2}/${f2}`);
});
// (la primera versión pedía «queda como estaba». Después: a 683 con el botón al 85 % de la pantalla «creaba la orden», pero ahí el botón queda
//  DEBAJO del pie fijo y el primer clic ya caía en «Crear Orden»: error de la prueba, una persona ve el pie encima. Lo que sí pasa, medido: a
//  1920 con la forma vacía y el botón al 30 %, al plegarse la página se recorre y el segundo clic cae en «Ya existe» de la placa)
const placaElegida = p => p.evaluate(() => [...document.querySelectorAll(".pf-forma button[aria-pressed]")].filter(b => /Nueva CTP|Ya existe/.test(b.textContent || "") && b.getAttribute("aria-pressed") === "true").length);
await caso("ord-302 a 1920 con la forma vacía, un doble clic en «Especificaciones» NO cambia la placa (el segundo clic caía en «Ya existe»)", "", async p => {
  const t = plegarEsp(p).first();
  await t.evaluate(e => { const r = e.getBoundingClientRect(); scrollTo({ top: scrollY + r.top - innerHeight * 0.3, behavior: "instant" }); }); await espera(p, 120);
  const box = await t.boundingBox();
  const debajo = await p.evaluate(([x, y]) => (document.elementFromPoint(x, y)?.closest("button")?.textContent || "").trim().slice(0, 30), [box.x + box.width / 2, box.y + box.height / 2]);
  await p.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2); await espera(p, 500);
  const placa = await placaElegida(p);
  ok("ord-302 a 1920 con la forma vacía, un doble clic en «Especificaciones» NO cambia la placa (el segundo clic caía en «Ya existe»)", /^Especificaciones/.test(debajo) && placa === 0, `bajo el cursor «${debajo}» · placa elegida ${placa}`);
}, { width: 1920, height: 1080 });
await caso("ord-308 el escudo es sólo para el segundo clic de un doble clic: un clic sencillo justo después de plegar SÍ cuenta", "", async p => {
  await plegar(p);
  await p.getByRole("button", { name: /Nueva CTP/ }).first().click();
  const placa = await placaElegida(p);
  ok("ord-308 el escudo es sólo para el segundo clic de un doble clic: un clic sencillo justo después de plegar SÍ cuenta", placa === 1, `placa elegida ${placa}`);
});
await caso("ord-303 Pre-prensa: la descripción se lee aunque las especificaciones estén plegadas", "modo=specs&rol=preprensa", async p => {
  await plegar(p);
  const dice = await tieneTexto(p, /Recetas Dr\. Eduardo Fuentes/), plegada = !(await espAbierta(p));
  ok("ord-303 Pre-prensa: la descripción se lee aunque las especificaciones estén plegadas", plegada && dice, `plegadas ${plegada} · la descripción se lee ${dice}`);
});
await caso("ord-304 Replicar con otra cantidad y luego igualarla: la nota se va (el precio sigue vacío para capturarlo)", "", async p => {
  await elegirCliente(p, "COSQUIM"); await llenar(p, "Ejemplo · 1000", "777"); await replicar(p);
  const antes = await tieneTexto(p, /No se copi[óo] el precio/i);
  await p.getByPlaceholder("Ejemplo · 1000").first().fill("1000"); await espera(p, 200);
  const despues = await tieneTexto(p, /No se copi[óo] el precio/i), precio = await p.locator("#ff-precio").inputValue();
  ok("ord-304 Replicar con otra cantidad y luego igualarla: la nota se va (el precio sigue vacío para capturarlo)", antes && !despues && precio === "", `nota ${antes} → ${despues} · precio «${precio}»`);
});
await caso("ord-305 Replicar con el precio YA escrito y otra cantidad: el precio se queda y no hay nota", "", async p => {
  await elegirCliente(p, "COSQUIM"); await llenar(p, "Ejemplo · 1000", "777"); await p.locator("#ff-precio").fill("3100"); await espera(p, 100);
  await replicar(p);
  const precio = await p.locator("#ff-precio").inputValue(), nota = await tieneTexto(p, /No se copi[óo] el precio/i);
  ok("ord-305 Replicar con el precio YA escrito y otra cantidad: el precio se queda y no hay nota", /^3,?100(\.00)?$/.test(precio) && !nota, `precio «${precio}» · nota ${nota}`);
});
await caso("ord-306 el resumen con medida en cm, un Pantone y un acabado escrito a mano: «5 × 4 cm», «1 Pantone», el acabado", "", async p => {
  await p.locator("#ff-ancho").fill("5"); await p.locator("#ff-alto").fill("4");
  await p.getByRole("button", { name: /^Otro\.\.\.$/ }).click(); await espera(p, 100);
  await p.getByLabel("Otros acabados").fill("Hot stamping dorado"); await espera(p, 100);
  const pf = p.getByLabel(/Pantones del frente/i).first();
  if (await pf.count()) { await pf.fill("186 C"); await p.keyboard.press("Enter"); await espera(p, 600); }
  await plegar(p);
  const r = (await plegarEsp(p).first().innerText()).replace(/\s+/g, " ");
  ok("ord-306 el resumen con medida en cm, un Pantone y un acabado escrito a mano: «5 × 4 cm», «1 Pantone», el acabado", /5 × 4 cm/.test(r) && /1 Pantone\b/.test(r) && /Hot stamping dorado/.test(r), `«${r}»`);
});
await caso("ord-307 a 683×384 «Especificaciones» y su resumen caben (nada se sale de la forma ni hay desplazamiento a los lados)", "", async p => {
  await p.locator("#ff-papel").fill("Couché brillante de importación"); await p.locator("#ff-tintas-frente").fill("4 tintas CMYK más Pantone"); await plegar(p);
  const r = await p.evaluate(() => { const b = [...document.querySelectorAll(".pf-forma button")].find(x => /^Especificaciones/.test(x.textContent || "")), f = document.querySelector(".pf-forma");
    const rb = b.getBoundingClientRect(), rf = f.getBoundingClientRect(); return { boton: Math.round(rb.right), forma: Math.round(rf.right), lados: document.documentElement.scrollWidth > innerWidth + 1 }; });
  ok("ord-307 a 683×384 «Especificaciones» y su resumen caben (nada se sale de la forma ni hay desplazamiento a los lados)", r.boton <= r.forma + 1 && !r.lados, JSON.stringify(r));
}, { width: 683, height: 384 });

// ── v10.84.82, tercera vuelta: las fallas EN los arreglos ──
await caso("ord-309 «Más de esta orden» también: un doble clic al cerrarlo (1920, forma vacía) no cambia la placa ni las especificaciones", "", async p => {
  const mas = p.getByRole("button", { name: /^Más de esta orden/ }).first();
  await clic(mas); await espera(p, 400);
  await mas.evaluate(e => { const r = e.getBoundingClientRect(); scrollTo({ top: scrollY + r.top - innerHeight * 0.3, behavior: "instant" }); }); await espera(p, 120);
  const box = await mas.boundingBox(), esp0 = await espAbierta(p);
  await p.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2); await espera(p, 500);
  const placa = await placaElegida(p), esp1 = await espAbierta(p);
  ok("ord-309 «Más de esta orden» también: un doble clic al cerrarlo (1920, forma vacía) no cambia la placa ni las especificaciones", placa === 0 && esp0 === esp1, `placa ${placa} · especificaciones ${esp0} → ${esp1}`);
}, { width: 1920, height: 1080 });
await caso("ord-310 con las especificaciones plegadas y sin tipo: el foco va al tipo y las especificaciones se quedan plegadas (no se abren de más)", "", async p => {
  await elegirCliente(p, "COSQUIM"); await llenar(p, "Ejemplo · 1000", "1000"); await plegar(p);
  await crear(p); await espera(p, 600);
  const foco = await quienTieneElFoco(p), plegada = !(await espAbierta(p));
  ok("ord-310 con las especificaciones plegadas y sin tipo: el foco va al tipo y las especificaciones se quedan plegadas (no se abren de más)", foco === "ff-tipo" && plegada, `foco «${foco}» · plegadas ${plegada}`);
});
await caso("ord-311 un ancho que no es número con las especificaciones plegadas: se abren y el foco va al ancho", "", async p => {
  await capturar(p); await p.locator("#ff-ancho").fill("cinco"); await plegar(p);
  await crear(p); await espera(p, 700);
  const foco = await quienTieneElFoco(p);
  ok("ord-311 un ancho que no es número con las especificaciones plegadas: se abren y el foco va al ancho", foco === "ff-ancho" && (await nuevas(p)).length === 0, `foco «${foco}»`);
});
await caso("ord-312 editar otra orden después de plegar las especificaciones: empiezan abiertas (cada orden, abierta)", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-ED"); await plegar(p); const p1 = !(await espAbierta(p));
  await editar(p, "OP-A1"); const a2 = await espAbierta(p);
  ok("ord-312 editar otra orden después de plegar las especificaciones: empiezan abiertas (cada orden, abierta)", p1 && a2, `plegada en la primera ${p1} · abierta en la segunda ${a2}`);
});
await caso("ord-313 Replicar una maquila de otra cantidad: la nota bajo el precio de maquila lo dice (costo y precio de 1,000 pzas)", "", async p => {
  await p.evaluate(() => window.__estado().base.push({ id: "OP-MQ2", production_number: "P-0646", client: "COSQUIM", client_id: "c-cosquim", client_company: "COSQUIM", client_email: "compras@cosquim.mx",
    order_type: "maquila", product_type: "Bolsas", product: "Bolsa kraft con asa", quantity: 1000, maq_provider: "Bolsas del Bajío", maq_cost: 5000, maq_price: 7000,
    stage: "maq_sent", source: "internal", agent: "Manuel", created_by: "lupita", created_at: "2026-10-08T10:00:00Z" }));
  await elegirCliente(p, "COSQUIM"); await p.getByRole("button", { name: /^Maquila/ }).first().click(); await espera(p, 300);
  await llenar(p, "Ejemplo · 1000", "500"); await replicar(p, "P-0646");
  const t = await texto(p);
  ok("ord-313 Replicar una maquila de otra cantidad: la nota bajo el precio de maquila lo dice (costo y precio de 1,000 pzas)", /No se copiaron el costo ni el precio de P-0646/.test(t) && /1,000 pzas/.test(t), (t.match(/No se copi[^.]*\.[^.]*\./) || ["sin nota"])[0]);
});
await caso("ord-314 a 1366 con el menú plegado (dos columnas): la imagen se sube en la primera pantalla", "menu=plegado", async p => {
  const top = await pieTop(p), b = await p.evaluate(() => { const x = [...document.querySelectorAll(".pf-forma button")].find(e => /Subir 1ra/.test(e.textContent || "")); return x ? Math.round(x.getBoundingClientRect().bottom) : null; });
  ok("ord-314 a 1366 con el menú plegado (dos columnas): la imagen se sube en la primera pantalla", b !== null && b <= top, `«Subir 1ra» termina en ${b} · el pie empieza en ${Math.round(top)}`);
});

// ── v10.84.91 — LA CATEGORÍA (Marcelo, 13-oct: obligatoria, con la sugerencia puesta). Vuelta 1: escritas ANTES del cambio ──
const categoria = p => p.locator("select#ff-categoria").inputValue({ timeout: 1500 }).catch(() => null);
const notaSugerida = async p => (await p.locator("#ff-categoria-nota").count()) > 0;
const tipo = async (p, t) => { await llenar(p, "Escribe o busca un tipo...", t); await p.keyboard.press("Escape"); await espera(p, 250); };
const elegirCategoria = async (p, c) => { await p.locator("select#ff-categoria").selectOption(c, { timeout: 1500 }); await espera(p, 200); };
const ultimoGuardado = async p => { const sv = (await lineas(p, "saveOrder ")).pop(); return sv ? JSON.parse(sv.replace(/^saveOrder /, "")) : null; };
const ultimoUpdate = async (p, id) => { const up = (await lineas(p, "update " + id + " ")).pop(); return up ? JSON.parse(up.replace("update " + id + " ", "")) : null; };
const enLaBase = (p, id) => p.evaluate(i => { const o = window.__estado().base.find(x => x.id === i); return o ? o.categoria : "(no está)"; }, id);
const cambiarEnLaBase = (p, id, x) => p.evaluate(([i, v]) => Object.assign(window.__estado().base.find(o => o.id === i), v), [id, x]);
await caso("ord-315 el tipo «Etiquetas» pone la categoría «Etiquetas y stickers», dice que es sugerida y se crea con ella", "", async p => {
  await capturar(p);
  const c = await categoria(p), nota = await notaSugerida(p);
  await crear(p); await espera(p, 1300);
  const g = await ultimoGuardado(p);
  ok("ord-315 el tipo «Etiquetas» pone la categoría «Etiquetas y stickers», dice que es sugerida y se crea con ella", c === "etiquetas" && nota && g?.categoria === "etiquetas",
    `categoría «${c}» · nota de sugerida ${nota} · guardada ${g ? JSON.stringify(g.categoria) : "NO se guardó"}`);
});
await caso("ord-316 un tipo que ninguna regla conoce: la categoría queda por elegir, no deja crear, lo dice y lleva a ella; con «Otro» se crea", "", async p => {
  await capturar(p); await tipo(p, "Sellos de goma");
  const c = await categoria(p);
  await crear(p); await espera(p, 800);
  const frena = (await cuenta(p, "saveOrder ")) === 0, t = await texto(p), foco = await quienTieneElFoco(p);
  await elegirCategoria(p, "otro"); await crear(p); await espera(p, 1300);
  const g = await ultimoGuardado(p);
  ok("ord-316 un tipo que ninguna regla conoce: la categoría queda por elegir, no deja crear, lo dice y lleva a ella; con «Otro» se crea",
    c === "" && frena && /Falta la categoría/.test(t) && foco === "ff-categoria" && g?.categoria === "otro",
    `categoría «${c}» · frena ${frena} · dice «Falta la categoría» ${/Falta la categoría/.test(t)} · foco «${foco}» · guardada ${g ? JSON.stringify(g.categoria) : "NO"}`);
});
await caso("ord-317 elegida a mano, cambiar el tipo ya no la mueve (y deja de decir que es sugerida)", "", async p => {
  await capturar(p); await elegirCategoria(p, "pop"); await tipo(p, "Libros");
  const c = await categoria(p), nota = await notaSugerida(p);
  ok("ord-317 elegida a mano, cambiar el tipo ya no la mueve (y deja de decir que es sugerida)", c === "pop" && !nota, `categoría «${c}» (debe seguir «pop») · nota ${nota}`);
});
await caso("ord-318 sin tocarla, sigue al tipo: Etiquetas → Libros → un nombre que no conoce (queda por elegir: no se queda la de antes)", "", async p => {
  await capturar(p); const c1 = await categoria(p);
  await tipo(p, "Libros"); const c2 = await categoria(p);
  await tipo(p, "Sellos de goma"); const c3 = await categoria(p);
  ok("ord-318 sin tocarla, sigue al tipo: Etiquetas → Libros → un nombre que no conoce (queda por elegir: no se queda la de antes)", c1 === "etiquetas" && c2 === "libros" && c3 === "",
    `«${c1}» → «${c2}» → «${c3}»`);
});
await caso("ord-319 la venta de inventario (tipo «stock») no lleva categoría: no sale la lista, no la pide y se guarda sin ella (null, no «»)", "", async p => {
  await capturar(p); await tipo(p, "stock");
  const hay = await p.locator("select#ff-categoria").count();
  await crear(p); await espera(p, 1300);
  const g = await ultimoGuardado(p);
  ok("ord-319 la venta de inventario (tipo «stock») no lleva categoría: no sale la lista, no la pide y se guarda sin ella (null, no «»)", hay === 0 && !!g && g.categoria === null,
    `lista ${hay} · guardada ${g ? JSON.stringify(g.categoria) : "NO se guardó"}`);
});
await caso("ord-320 editar: la categoría que tiene, puesta; abrir y salir sin tocar nada no pregunta", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-ED"); const c = await categoria(p);
  await p.getByRole("button", { name: /^Cancelar$/ }).click(); await espera(p, 400);
  const pregunta1 = await hayPregunta(p), vista = (await estado(p)).vista;
  ok("ord-320 editar: la categoría que tiene, puesta; abrir y salir sin tocar nada no pregunta", c === "formas" && !pregunta1 && vista !== "form",
    `categoría «${c}» (Recetarios → formas) · pregunta al salir ${pregunta1} · vista ${vista}`);
});
await caso("ord-321 editar y cambiar la categoría: se guarda la nueva (el código de la lista)", "modo=editar&rol=admin", async p => {
  await editar(p, "OP-ED"); await elegirCategoria(p, "libros");
  await guardar(p); await espera(p, 1500);
  const u = await ultimoUpdate(p, "OP-ED"), base = await enLaBase(p, "OP-ED");
  ok("ord-321 editar y cambiar la categoría: se guarda la nueva (el código de la lista)", u?.categoria === "libros" && base === "libros", `update ${u ? JSON.stringify(u.categoria) : "NO hubo"} · en la base «${base}»`);
});
await caso("ord-322 «Editar Specs» (Pre-prensa): no sale la categoría y guardar no la cambia aunque cambie el tipo", "modo=specs&rol=preprensa", async p => {
  const hay = await p.locator("select#ff-categoria").count();
  await tipo(p, "Libros"); await guardar(p); await espera(p, 1500);
  const u = await ultimoUpdate(p, "OP-ED"), base = await enLaBase(p, "OP-ED");
  ok("ord-322 «Editar Specs» (Pre-prensa): no sale la categoría y guardar no la cambia aunque cambie el tipo", hay === 0 && !!u && (u.categoria === undefined || u.categoria === "formas") && base === "formas",
    `lista ${hay} · update ${u ? JSON.stringify(u.categoria) : "NO hubo"} · en la base «${base}»`);
});
await caso("ord-323 Replicar trae la categoría de la orden de antes (aunque no sea la que sugiere su nombre) y el tipo ya no la mueve", "", async p => {
  await cambiarEnLaBase(p, "OP-A2", { categoria: "pop" });
  await elegirCliente(p, "COSQUIM"); await replicar(p, "P-0649");
  const t1 = await valor(p, "Escribe o busca un tipo..."), c1 = await categoria(p), nota = await notaSugerida(p);
  await tipo(p, "Libros"); const c2 = await categoria(p);
  ok("ord-323 Replicar trae la categoría de la orden de antes (aunque no sea la que sugiere su nombre) y el tipo ya no la mueve", t1 === "Cintillos" && c1 === "pop" && !nota && c2 === "pop",
    `tipo «${t1}» · categoría «${c1}» · nota ${nota} · tras cambiar el tipo «${c2}»`);
});
await caso("ord-324 «Deshacer» de Replicar regresa la categoría y vuelve a seguir al tipo", "", async p => {
  await cambiarEnLaBase(p, "OP-A2", { categoria: "pop" });
  await elegirCliente(p, "COSQUIM"); await replicar(p, "P-0649");
  const hay = (await p.getByRole("button", { name: /Deshacer/ }).count()) > 0;
  if (hay) { await clic(p.getByRole("button", { name: /Deshacer/ })); await espera(p, 400); }
  const c1 = await categoria(p);
  await tipo(p, "Libros"); const c2 = await categoria(p);
  ok("ord-324 «Deshacer» de Replicar regresa la categoría y vuelve a seguir al tipo", hay && c1 === "" && c2 === "libros", `Deshacer ${hay} · después «${c1}» · con «Libros» «${c2}»`);
});
await caso("ord-325 «Falta el tipo» sale junto al tipo, arriba de la categoría", "", async p => {
  await elegirCliente(p, "COSQUIM"); await llenar(p, "Ejemplo · 1000", "1000"); await p.locator("textarea").first().fill("Algo"); await crear(p); await espera(p, 700);
  const tipoR = await rect(p, "#ff-tipo"), falta = await rect(p, "#ff-tipo-falta"), cat = await rect(p, "#ff-categoria");
  const bien = !!tipoR && !!falta && !!cat && falta.top >= tipoR.bottom - 1 && falta.top - tipoR.bottom < 30 && falta.bottom <= cat.top;
  ok("ord-325 «Falta el tipo» sale junto al tipo, arriba de la categoría", bien, `tipo ${JSON.stringify(tipoR)} · aviso ${JSON.stringify(falta)} · categoría ${JSON.stringify(cat)}`);
});
for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  await caso("ord-326 a " + w + ": la categoría mide lo que el tipo y la página no se desborda", "", async p => {
    await capturar(p);
    const tipoR = await rect(p, "#ff-tipo"), cat = await rect(p, "#ff-categoria"), ancho = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const bien = !!tipoR && !!cat && Math.abs(cat.left - tipoR.left) <= 1 && Math.abs(cat.right - tipoR.right) <= 1 && ancho <= 0;
    ok("ord-326 a " + w + ": la categoría mide lo que el tipo y la página no se desborda", bien, `tipo ${JSON.stringify(tipoR)} · categoría ${JSON.stringify(cat)} · desborde ${ancho}`);
  }, { width: w, height: h });
}
await caso("ord-327 una maquila también lleva su categoría (la de su nombre)", "modo=maquila&rol=admin", async p => {
  const c = await categoria(p);
  ok("ord-327 una maquila también lleva su categoría (la de su nombre)", c === "calendarios", `P-0647 «Calendarios»: categoría «${c}»`);
});
await caso("ord-328 «Agregar Producto a OC»: la categoría sale sugerida por el tipo que trae la OC", "modo=oc&rol=admin", async p => {
  const c = await categoria(p), nota = await notaSugerida(p);
  ok("ord-328 «Agregar Producto a OC»: la categoría sale sugerida por el tipo que trae la OC", c === "papeleria" && nota, `«Folders»: categoría «${c}» · nota ${nota}`);
});
await caso("ord-329 si la base falla al crear, la categoría elegida sigue elegida", "guardar=falla", async p => {
  await capturar(p); await elegirCategoria(p, "pop"); await crear(p); await espera(p, 1500);
  const c = await categoria(p), n = (await nuevas(p)).length;
  ok("ord-329 si la base falla al crear, la categoría elegida sigue elegida", c === "pop" && n === 0, `categoría «${c}» · órdenes nuevas ${n}`);
});
await caso("ord-330 editar una orden sin categoría (un nombre que no se reconoce): pide elegirla antes de guardar; con ella, guarda", "modo=editar&rol=admin", async p => {
  await cambiarEnLaBase(p, "OP-ED", { categoria: null, product_type: "Sellos de goma" });
  await editar(p, "OP-ED"); const c = await categoria(p);
  await p.locator("textarea").first().fill("Recetas · con otra nota"); await guardar(p); await espera(p, 900);
  const frena = (await cuenta(p, "update OP-ED ")) === 0, t = await texto(p);
  await elegirCategoria(p, "otro"); await guardar(p); await espera(p, 1500);
  const u = await ultimoUpdate(p, "OP-ED");
  ok("ord-330 editar una orden sin categoría (un nombre que no se reconoce): pide elegirla antes de guardar; con ella, guarda", c === "" && frena && /Falta la categoría/.test(t) && u?.categoria === "otro",
    `categoría «${c}» · frena ${frena} · lo dice ${/Falta la categoría/.test(t)} · update ${u ? JSON.stringify(u.categoria) : "NO hubo"}`);
});
await caso("ord-331 Producción edita una orden sin categoría: no la ve ni se la pide (no es suya), y no se mueve sola", "modo=editar&rol=produccion", async p => {
  await cambiarEnLaBase(p, "OP-ED", { categoria: null });
  await editar(p, "OP-ED"); const hay = await p.locator("select#ff-categoria").count();
  if (await editable(p.getByPlaceholder("Escribe o busca un tipo..."))) await tipo(p, "Libros");
  await p.locator("textarea").first().fill("Recetas · revisado por producción"); await guardar(p); await espera(p, 1500);
  const u = await ultimoUpdate(p, "OP-ED"), t = await texto(p);
  ok("ord-331 Producción edita una orden sin categoría: no la ve ni se la pide (no es suya), y no se mueve sola", hay === 0 && !/Falta la categoría/.test(t) && !!u && (u.categoria === undefined || u.categoria === null),
    `lista ${hay} · la pide ${/Falta la categoría/.test(t)} · update ${u ? JSON.stringify(u.categoria) : "NO hubo"}`);
});

// v10.84.115 — la forma y «Corregir precio» (la revisión de CobranzaFlow y lo que decidió Marcelo, 15-oct). Vuelta 1: contra v10.84.114.
//   ord-332/333: una forma abierta desde ANTES de que corrigieran el precio no lo regresa (sin tocarlo); si quien edita SÍ lo cambia, el suyo.
//   ord-334/335: a Karla, un precio ya capturado se le cierra con su porqué («Corregir precio»); sin precio, lo captura aquí.
await caso("ord-332 la forma abierta desde antes no regresa el precio corregido", "modo=editar&rol=admin", async p => {
  await p.evaluate(() => window.__cambiar({ price: 2400 })); await espera(p, 400);   // Karla lo corrigió con la forma abierta (llega por el tiempo real)
  await p.locator("textarea").first().fill("Recetas Dr. Eduardo Fuentes · 2a edición"); await espera(p, 200);
  await guardar(p); await espera(p, 1200);
  const e = await estado(p), o = e.base.find(x => x.id === "OP-ED"), ultimo = (await avisos(p)).pop() || "";
  ok("ord-332 una forma abierta desde antes de que corrigieran el precio ($1,800 → $2,400) no lo regresa: se guarda lo demás y el aviso lo dice",
    Number(o?.price) === 2400 && /2,400/.test(ultimo), `precio en la base ${o?.price} · aviso «${ultimo.slice(0, 160)}»`);
});
await caso("ord-333 si quien edita sí cambia el precio, se guarda el suyo", "modo=editar&rol=admin", async p => {
  await p.evaluate(() => window.__cambiar({ price: 2400 })); await espera(p, 400);
  await p.locator("#ff-precio").fill("2000"); await espera(p, 200);
  await guardar(p); await espera(p, 1500);
  const e = await estado(p), o = e.base.find(x => x.id === "OP-ED");
  ok("ord-333 si en la forma SÍ cambiaron el precio (a $2,000), se guarda ese (no se regresa a $1,800 ni se queda el de $2,400)", Number(o?.price) === 2000, `precio en la base ${o?.price}`);
});
await caso("ord-334 a Karla, un precio ya capturado se le cierra con su porqué", "modo=editar&rol=karla", async p => {
  const campo = p.locator("#ff-precio"); const cerrado = await campo.isDisabled().catch(() => false);
  const t = ((await p.locator("body").innerText()) || "").replace(/\s+/g, " ");
  ok("ord-334 Karla editando P-0650 ($1,800 ya capturado): el precio no se cambia aquí y dice que se corrige con «Corregir precio»", cerrado && /Corregir precio/.test(t), `cerrado ${cerrado}`);
});
await caso("ord-335 a Karla, sin precio capturado, lo captura aquí", "modo=editar&rol=karla", async p => {
  await editar(p, "OP-ED", { price: null }); await p.evaluate(() => window.__cambiar({ price: null })); await espera(p, 400);
  const abierto = !(await p.locator("#ff-precio").isDisabled().catch(() => true));
  ok("ord-335 Karla editando una orden sin precio: el campo está abierto (lo captura ella, como antes)", abierto, `abierto ${abierto}`);
});
// vuelta 3, por donde no se diseñó: la maquila (su precio al cliente es otro campo) y «Editar Specs» (manda la forma entera, CobranzaFlow)
await caso("ord-336 a Karla, el precio al cliente de una maquila también se le cierra", "modo=maquila&rol=karla", async p => {
  const campo = p.locator("#ff-maq-precio"); const hay = await campo.count(); const cerrado = hay ? await campo.isDisabled().catch(() => false) : false;
  ok("ord-336 Karla editando la maquila P-0647 ($12,500 al cliente): su precio al cliente no se cambia aquí", hay === 1 && cerrado, `campo ${hay} · cerrado ${cerrado}`);
});
await caso("ord-337 «Editar Specs» abierta desde antes no regresa el precio corregido", "modo=specs&rol=preprensa", async p => {
  await p.evaluate(() => window.__cambiar({ price: 2400 })); await espera(p, 400);
  await p.locator("textarea").first().fill("Recetas Dr. Eduardo Fuentes · specs revisadas"); await espera(p, 200);
  await guardar(p); await espera(p, 1200);
  const e = await estado(p), o = e.base.find(x => x.id === "OP-ED");
  ok("ord-337 «Editar Specs» (manda la forma entera) abierta desde antes de que corrigieran el precio no lo regresa", Number(o?.price) === 2400, `precio en la base ${o?.price}`);
});

await browser.close();
const fallas = res.filter(r => r.startsWith("FALLA")).length;
console.log(res.join("\n"));
console.log(`\n${res.length - fallas} de ${res.length} pasan` + (fallas ? ` · ${fallas} FALLAN` : ""));
process.exit(fallas ? 1 : 0);
