// Tratar de ROMPER la forma de la orden (OrderForm: crear y editar) en su banco (tests/banco/gen-orden.mjs: la forma extraída de App.jsx
// y lo que hace App al guardar, `create` y `update`, copiado tal cual). Cada caso afirma lo que DEBERÍA pasarle a quien captura
// (Lupita con prisa, el vendedor, Pre-prensa, Marcelo): una FALLA es un bug. Nació con la critique del 12-oct (revisor independiente,
// 22/40) y los tres P1 de v10.84.77: guardar sin perder ni duplicar, la × que no borra antes de guardar, la orden facturada que no deja
// tocar lo que no guarda.
// Uso: node orden.mjs <dir-capturas> [puerto=5188]   ·   SOLO=<regex> corre sólo los casos que coinciden (sabotajes)
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5188);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, viewport = { width: 1366, height: 768 }) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const page = await browser.newPage({ viewport });
  const errs = [], nativos = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource|\[create\]|\[update\]|client resolution|typeahead error|\[image upload|\[FileUpload\]|\[guardar\]/.test(m.text())) errs.push("console: " + m.text().slice(0, 160)); });
  // un diálogo del navegador (confirm/alert) se anota y se acepta: la app no debería usarlos (DESIGN.md)
  page.on("dialog", async d => { nativos.push(d.type() + ": " + d.message().slice(0, 80)); await d.accept().catch(() => {}); });
  page.nativos = nativos;
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#log", { state: "attached" }); await page.waitForTimeout(400);
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
  const a1 = await avisos(p);
  if (await p.getByRole("button", { name: /Crear Orden/ }).count()) { await crear(p); await espera(p, 1500); }
  const n = await nuevas(p), e = await estado(p);
  ok("ord-02 la orden que SÍ se guardó (falló sólo su bitácora) se da por creada, con su número, y no se puede duplicar",
    n.length === 1 && e.vista !== "form" && a1.some(t => /P-0651/.test(t) && /cread/i.test(t)) && !a1.some(t => /No se pudo crear|no se cre/i.test(t)),
    `órdenes nuevas ${n.length} (${n.map(o => o.pn).join(", ")}) · vista ${e.vista} · avisos ${JSON.stringify(a1)}`);
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
  const a = await avisos(p), n = await nuevas(p);
  ok("ord-04 si falla sólo el aviso a Producción, la orden se creó: lo dice con su número, dice que no se pudo avisar y no la duplica",
    n.length === 1 && a.some(t => /P-0651/.test(t) && /no se pudo avisar/i.test(t)) && !a.some(t => /No se pudo crear|no se cre/i.test(t)) && !a.some(crudo),
    `órdenes nuevas ${n.length} · avisos ${JSON.stringify(a)}`);
});
await caso("ord-05 con cliente nuevo, el aviso final dice la orden Y que el cliente quedó en CobranzaFlow, con «Ver P-…»", "cliente=nada", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "ZZ PRUEBA CLAUDE SA"); await llenar(p, "correo@ej.com", "prueba@ejemplo.com");
  await llenar(p, "XAXX010101000", "ZZZ010101AAA"); await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", "1000"); await p.getByRole("button", { name: "Manuel", exact: true }).click();
  await crear(p); await espera(p, 800);
  await p.getByRole("button", { name: /crear cliente nuevo/i }).click(); await espera(p, 1500);
  const ultimo = (await avisos(p)).pop() || "";
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
  const n = await nuevas(p), e = await estado(p), despues = (await alertasEnLaForma(p)).filter(a => /no se cre/i.test(a.t)).length;
  ok("ord-06 después de un rechazo, volver a apretar «Crear Orden» crea la orden y el mensaje se va",
    antes === 1 && n.length === 1 && n[0].pn === "P-0651" && e.vista !== "form" && despues === 0, `mensaje antes ${antes} · órdenes ${n.map(o => o.pn).join(",")} · vista ${e.vista} · mensaje después ${despues}`);
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
  await conArchivo(p); await editar(p, "OP-ED");
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
  const vend = await p.getByRole("button", { name: "Manuel", exact: true }).first().isEnabled().catch(() => true);
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
await caso("ord-52 mientras lee la factura dice «Revisando la factura…»; si no contesta en 8 s, la pregunta sale con la regla y sin cifras", "modo=editar&rol=admin&precio=lento&lento=12", async p => {
  await editar(p, "OP-FA");
  await p.getByPlaceholder("$0.00").first().fill("2000"); await guardar(p); await espera(p, 600);
  const dice = (await p.getByRole("button", { name: /Revisando la factura/ }).count()) > 0;
  await espera(p, 8500);
  const t = await textoPregunta(p);
  ok("ord-52 mientras lee la factura dice «Revisando la factura…»; si no contesta en 8 s, la pregunta sale con la regla y sin cifras",
    dice && /F-122/.test(t) && /No se pudo leer/.test(t) && !/\$2,868\.68/.test(t), `«Revisando» ${dice} · «${t.slice(0, 200)}»`);
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
  await conArchivo(p); await editar(p, "OP-ED");
  await clic(p.getByRole("button", { name: "Quitar", exact: true })); await espera(p, 300);
  await guardar(p); await espera(p, 1000);
  const up = (await lineas(p, "update OP-ED ")).pop() || "", datos = up ? JSON.parse(up.replace(/^update OP-ED /, "")) : {};
  const borrados = await lineas(p, "storage remove");
  ok("ord-55 «Quitar» el archivo y guardar: la orden se queda sin él y el archivo sigue en el servidor (historial)", !!up && datos.file_url === null && borrados.length === 0,
    `update ${up ? "sí" : "no"} · file_url ${JSON.stringify(datos.file_url)} · storage remove ${JSON.stringify(borrados)}`);
});
await caso("ord-56 «Quitar» un archivo subido en esta misma captura sí lo limpia del servidor (y no ofrece deshacer)", "", async p => {
  await p.locator('input[type="file"]:not([accept="image/*"])').first().setInputFiles({ name: "arte.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 prueba") }); await espera(p, 1500);
  await clic(p.getByRole("button", { name: "Quitar", exact: true })); await espera(p, 500);
  const borrados = await lineas(p, "storage remove"), deshacer = await p.getByRole("button", { name: /Deshacer/ }).count();
  ok("ord-56 «Quitar» un archivo subido en esta misma captura sí lo limpia del servidor (y no ofrece deshacer)", borrados.length === 1 && /arte|new\//.test(borrados[0] || "") && deshacer === 0,
    `storage remove ${JSON.stringify(borrados)} · «Deshacer» ${deshacer}`);
});
await caso("ord-57 si el cliente ya existía (se eligió en la pregunta), el aviso no dice que se dio de alta", "cliente=fuerte", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "CORONA SA"); await llenar(p, "correo@ej.com", "eva@modelo.mx");
  await llenar(p, "XAXX010101000", "CMM8601014G4");
  await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", "1000"); await p.getByRole("button", { name: "Manuel", exact: true }).click();
  await crear(p); await espera(p, 800);
  await pregunta(p).getByRole("button", { name: /CERVECERIA MODELO/ }).first().click(); await espera(p, 1500);
  const ultimo = (await avisos(p)).pop() || "";
  ok("ord-57 si el cliente ya existía (se eligió en la pregunta), el aviso no dice que se dio de alta", /P-0651/.test(ultimo) && !/dado de alta/.test(ultimo), `último aviso «${ultimo}»`);
});
await caso("ord-58 Esc en «¿ya existe?» regresa a la forma con todo, sin mensaje de error, y se puede volver a crear", "cliente=nada", async p => {
  await llenar(p, "Cliente (escribe para buscar)", "ZZ PRUEBA CLAUDE SA"); await llenar(p, "correo@ej.com", "prueba@ejemplo.com");
  await llenar(p, "XAXX010101000", "ZZZ010101AAA"); await llenar(p, "Escribe o busca un tipo...", "Etiquetas"); await p.keyboard.press("Escape");
  await llenar(p, "Ejemplo · 1000", "1000"); await p.getByRole("button", { name: "Manuel", exact: true }).click();
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
  const vend = await p.getByRole("button", { name: "Manuel", exact: true }).first().isEnabled().catch(() => false);
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

await browser.close();
const fallas = res.filter(r => r.startsWith("FALLA")).length;
console.log(res.join("\n"));
console.log(`\n${res.length - fallas} de ${res.length} pasan` + (fallas ? ` · ${fallas} FALLAN` : ""));
process.exit(fallas ? 1 : 0);
