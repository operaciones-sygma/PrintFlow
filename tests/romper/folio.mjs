// Tratar de ROMPER «Asignar folio» (InvoiceModal, PreInvoiceModal, MultiPaymentPicker) en el banco de folio. Cada caso afirma lo
// que DEBERÍA pasar: una FALLA es un bug. Uso: node romper-folio.mjs <dir-capturas> [puerto=5199]
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5199);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, viewport = { width: 1366, height: 768 }) {
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#abrir-inv");
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.close();
}
const log = async p => (await p.textContent("#log")) || "";
const cuenta = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref)).length;
const ve = async (p, t) => { const l = p.getByText(t); return (await l.count()) > 0 && await l.first().isVisible(); };
const espera = (p, ms = 250) => p.waitForTimeout(ms);
const enDialogo = p => p.evaluate(() => document.activeElement?.closest('[role="dialog"]')?.getAttribute("aria-labelledby") || null);
const fondo = (p, loc) => loc.evaluate(el => getComputedStyle(el).backgroundColor);
async function inv(p) { await p.click("#abrir-inv"); await p.getByRole("dialog", { name: /Asignar folio/i }).waitFor(); await espera(p, 400); }
async function pre(p) { await p.click("#abrir-pre"); await p.getByRole("dialog").first().waitFor(); await espera(p, 400); }
const dlgInv = p => p.getByRole("dialog", { name: /Asignar folio/i });
const dlgPre = p => p.getByRole("dialog", { name: /Folio anticipado/i });
const tipo = (p, t) => p.getByRole("button", { name: new RegExp("^" + t) }).first();
const continuar = p => p.getByRole("button", { name: "Continuar" });
async function pagada(p, monto = "66004", metodo = "Transferencia") {
  await p.getByRole("button", { name: "Pagada", exact: true }).click(); await espera(p, 150);
  await p.getByRole("radio", { name: metodo }).first().click();
  await p.getByLabel("Monto del pago 1").fill(monto); await espera(p, 150);
}

// ───────────── InvoiceModal
await caso("inv-01 el total a la vista", "", async p => {
  await inv(p);
  const antes = await ve(p, /Subtotal \$56,900\.00 · con IVA \$66,004\.00/);
  await tipo(p, "Factura").click(); await espera(p);
  const fac = await ve(p, /Total \$66,004\.00 con IVA/);
  await tipo(p, "Remisión").click(); await espera(p);
  ok("inv-01 el total se ve al abrir, con factura (con IVA) y con remisión (sin IVA)", antes && fac && await ve(p, /Total \$56,900\.00 · remisión, sin IVA/));
});
await caso("inv-02 la vista previa dice cuánto y a quién", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "No pagada", exact: true }).click(); await continuar(p).click(); await espera(p);
  await p.screenshot({ path: OUT + "/inv-02-vista-previa.png" });
  ok("inv-02 vista previa: «Factura por $66,004.00 … a PORTLAND STUDIO»", await ve(p, /Factura por \$66,004\.00/) && await ve(p, /a PORTLAND STUDIO/));
});
await caso("inv-03 clic fuera con pagos capturados", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await p.mouse.click(8, 8); await espera(p);
  ok("inv-03 con un pago capturado, el clic fuera no cierra", await dlgInv(p).isVisible() && (await cuenta(p, "inv:cerrado")) === 0);
});
await caso("inv-04 Esc con pagos capturados", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await p.getByRole("heading", { name: /Asignar folio/i }).click(); await p.keyboard.press("Escape"); await espera(p);
  const pregunta = p.getByRole("dialog", { name: /Cerrar sin asignar el folio/ });
  const pregunto = (await pregunta.count()) === 1;
  await p.keyboard.press("Escape"); await espera(p);
  const sigue = (await pregunta.count()) === 0 && (await p.getByLabel("Monto del pago 1").inputValue()) === "66004";
  await p.getByRole("heading", { name: /Asignar folio/i }).click(); await p.keyboard.press("Escape"); await pregunta.waitFor();
  await p.getByRole("button", { name: "Cerrar sin asignar" }).click(); await espera(p);
  ok("inv-04 Esc con pagos pregunta; Esc a la pregunta los deja; «Cerrar sin asignar» cierra", pregunto && sigue && (await cuenta(p, "inv:cerrado")) === 1);
});
await caso("inv-05 Esc sin nada capturado", "", async p => {
  await inv(p); await p.keyboard.press("Escape"); await espera(p);
  ok("inv-05 Esc sin nada capturado cierra de inmediato", (await cuenta(p, "inv:cerrado")) === 1);
});
await caso("inv-06 cambiar de tipo con pagos", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await tipo(p, "Remisión").click(); await espera(p);
  const pregunto = (await p.getByRole("dialog", { name: /Cambiar el tipo de comprobante/ }).count()) === 1;
  await p.getByRole("button", { name: "No, cancelar" }).click(); await espera(p);
  ok("inv-06 cambiar de tipo con pagos pregunta, y «No» los deja", pregunto && (await p.getByLabel("Monto del pago 1").inputValue()) === "66004");
});
await caso("inv-07 Corona: «Aplicar saldo» con pagos", "cliente=corona", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await p.getByRole("button", { name: /^Aplicar saldo/ }).click(); await espera(p);
  ok("inv-07 Corona: «Aplicar saldo» con pagos capturados pregunta antes de borrarlos", (await p.getByRole("dialog", { name: /Cambiar el tipo de comprobante/ }).count()) === 1);
});
await caso("inv-08 Cuadra: «Sin factura · Stock» con pagos", "cliente=cuadra", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await p.getByRole("button", { name: /^Sin factura · Stock/ }).click(); await espera(p);
  ok("inv-08 Cuadra: «Sin factura · Stock» con pagos pregunta antes de borrarlos", (await p.getByRole("dialog", { name: /Cambiar el tipo de comprobante/ }).count()) === 1);
});
await caso("inv-09 no se pudo saber quién pone el folio", "emisor=falla", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "No pagada", exact: true }).click().catch(() => {});
  ok("inv-09 si falla la consulta del emisor, lo dice y no deja continuar (ni pide folio a mano)", await ve(p, /No se pudo confirmar si el folio lo asigna el sistema/) && await continuar(p).isDisabled() && (await p.locator("#invoice-folio").count()) === 0);
});
await caso("inv-10 reintentar el emisor", "emisor=falla1", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "Reintentar" }).click(); await espera(p, 500);
  ok("inv-10 «Reintentar» vuelve a preguntar y, si contesta, sigue normal", await ve(p, /El folio lo asigna el sistema/) && !(await ve(p, /No se pudo confirmar/)));
});
await caso("inv-11 emisor apagado: la sugerencia pasa", "emisor=off", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: /^Usar F-137/ }).click(); await espera(p);
  const usa = (await p.locator("#invoice-folio").inputValue()) === "F-137" && !(await ve(p, /sin ceros a la izquierda/));
  await p.locator("#invoice-folio").fill("F-0137"); await espera(p);
  const ceros = await ve(p, /sin ceros a la izquierda/);
  await p.locator("#invoice-folio").fill("D-6001"); await espera(p);
  ok("inv-11 emisor apagado: «Usar F-137» queda válido; F-0137 dice por qué no; D-6001 (Alpha) vale", usa && ceros && !(await ve(p, /sin ceros a la izquierda/)));
});
await caso("inv-12 folio menor", "emisor=off", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.locator("#invoice-folio").fill("F-100"); await p.getByRole("button", { name: "No pagada", exact: true }).click(); await espera(p);
  const avisa = await ve(p, /menor al último registrado/);
  await continuar(p).click();
  const q = p.getByRole("dialog", { name: /folio menor al último/ }); await q.waitFor();
  await p.getByRole("button", { name: "Usar F-100" }).click(); await espera(p);
  ok("inv-12 folio menor: avisa, pregunta en el sistema y sigue con F-100", avisa && await ve(p, /Folio F-100/));
});
await caso("inv-13 contraste del botón de remisión", "", async p => {
  await inv(p); await tipo(p, "Remisión").click(); await espera(p);
  await p.getByRole("button", { name: "No pagada", exact: true }).click(); await espera(p);
  const bg = await fondo(p, continuar(p));
  ok("inv-13 «Continuar» de remisión en verde oscuro (#15803d), no en el verde claro", bg === "rgb(21, 128, 61)", bg);
});
await caso("inv-14 foco y Tab", "", async p => {
  await inv(p); const a = await enDialogo(p);
  await p.keyboard.press("Shift+Tab"); const b = await enDialogo(p);
  for (let i = 0; i < 15; i++) await p.keyboard.press("Tab");
  ok("inv-14 el foco entra y Tab/Mayús+Tab no se salen", a === "invoice-modal-title" && b === "invoice-modal-title" && (await enDialogo(p)) === "invoice-modal-title", `${a} · ${b} · ${await enDialogo(p)}`);
});
await caso("inv-15 sin precio", "precio0=1", async p => {
  await inv(p); const h = await ve(p, /Sin precio capturado/);
  await tipo(p, "Factura").click(); await espera(p); await p.getByRole("button", { name: "No pagada", exact: true }).click(); await continuar(p).click(); await espera(p);
  ok("inv-15 sin precio: lo dice arriba y en la vista previa (no «por $0.00»)", h && await ve(p, /Factura sin precio capturado/) && !(await ve(p, /por \$0\.00/)));
});
await caso("inv-16 doble clic en Confirmar", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await p.getByRole("button", { name: "No pagada", exact: true }).click(); await continuar(p).click(); await espera(p);
  await p.getByRole("button", { name: "Confirmar", exact: true }).dblclick(); await espera(p, 700);
  ok("inv-16 doble clic en Confirmar manda UNA vez", (await cuenta(p, "inv:confirm")) === 1, "veces=" + await cuenta(p, "inv:confirm"));
});
await caso("inv-17 la base rechaza", "falla=1", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p); await continuar(p).click(); await espera(p);
  await p.getByRole("button", { name: "Confirmar", exact: true }).click(); await espera(p, 600);
  ok("inv-17 si la base rechaza, el modal sigue con lo capturado para reintentar", (await cuenta(p, "toast:error")) === 1 && await dlgInv(p).isVisible() && !(await p.getByRole("button", { name: "Confirmar", exact: true }).isDisabled()));
});
await caso("inv-18 tercero a medias bloquea", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await p.getByRole("button", { name: "No pagada", exact: true }).click();
  await p.click("#tercero-medias"); await espera(p);
  const bloquea = await continuar(p).isDisabled();
  await p.click("#tercero-listo"); await espera(p);
  ok("inv-18 un tercero a medias no deja continuar; completo, sí", bloquea && !(await continuar(p).isDisabled()));
});
await caso("inv-19 cliente lento", "lenta=1", async p => {
  await p.click("#abrir-inv"); await dlgInv(p).waitFor();
  const cargando = await ve(p, /Cargando datos del cliente/) && await tipo(p, "Factura").isDisabled();
  await p.waitForTimeout(5600);
  ok("inv-19 cliente lento: tipos apagados mientras carga; a los 5 s, aviso con «Recargar» (en tinta)", cargando && await ve(p, /No se terminó de cargar el cliente/) && await p.getByRole("button", { name: "Recargar" }).isVisible());
});
await caso("inv-20 efectivo: la nota sin pago", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await p.getByRole("button", { name: "No pagada", exact: true }).click(); await espera(p);
  ok("inv-20 «No pagada» al entregar dice que el efectivo se captura aquí", await ve(p, /el vale de caja se crea aquí/));
});
await caso("inv-21 pagos a 1366 (captura)", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p, "40000");
  await p.getByRole("button", { name: /Agregar otro pago/ }).click(); await p.getByRole("radio", { name: "Efectivo" }).nth(1).click(); await p.getByLabel("Monto del pago 2").fill("26004"); await espera(p);
  await p.screenshot({ path: OUT + "/inv-21-pagos.png" });
  const caja = await continuar(p).boundingBox();
  ok("inv-21 dos pagos cubren el total, dejan continuar, y «Continuar» se ve sin scroll a 1366×768", await ve(p, /Cubierto/) && !(await continuar(p).isDisabled()) && caja && caja.y + caja.height <= 768, "botón y=" + (caja && Math.round(caja.y)));
});

// ───────────── segunda tanda: por donde NO se diseñó el arreglo
await caso("inv-22 pagada que no cuadra", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p, "65000");
  ok("inv-22 «Pagada» con $65,000 de $66,004: dice cuánto falta y no deja continuar", await ve(p, /Te faltan \$1,004\.00/) && await continuar(p).isDisabled());
});
await caso("inv-23 parcial que cubre todo", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "Parcial", exact: true }).click(); await p.getByRole("radio", { name: "Transferencia" }).first().click();
  await p.getByLabel("Monto del pago 1").fill("70000"); await espera(p);
  ok("inv-23 «Parcial» que cubre o pasa el total: lo dice y no deja", await ve(p, /usa "Pagada" en lugar de "Parcial"/) && await continuar(p).isDisabled());
});
await caso("inv-24 «Otro» sin motivo", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p, "66004", "Otro");
  const bloquea = await continuar(p).isDisabled() && await ve(p, /Elige el motivo/);
  ok("inv-24 «Otro» sin motivo no deja continuar y lo dice; el aviso de efectivo sin raya larga", bloquea && await ve(p, /No lo pongas como «Otro»: usa el método/));
});
await caso("inv-25 «Atrás» conserva lo capturado", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await continuar(p).click(); await espera(p); await p.getByRole("button", { name: /Atrás/ }).click(); await espera(p);
  ok("inv-25 «Atrás» desde la vista previa conserva tipo y pagos", (await p.getByLabel("Monto del pago 1").inputValue()) === "66004" && !(await continuar(p).isDisabled()));
});
await caso("inv-26 Corona: saldo que queda negativo", "cliente=corona", async p => {
  await inv(p); await p.getByRole("button", { name: /^Aplicar saldo/ }).click(); await espera(p);
  ok("inv-26 Corona con saldo menor que la orden: avisa que queda negativo", await ve(p, /El saldo quedará negativo/) && await ve(p, /−\$56,900\.00/));
});
await caso("inv-27 Cuadra de punta a punta", "cliente=cuadra", async p => {
  await inv(p); await p.getByRole("button", { name: /^Sin factura · Stock/ }).click(); await espera(p, 400);
  // con UN producto en el catálogo se preselecciona a propósito: se quita para probar que sin producto no deja
  const preseleccionado = (await p.locator("#cuadra-sku-select").inputValue()) === "sku1";
  await p.locator("#cuadra-sku-select").selectOption(""); await espera(p);
  const sinSku = preseleccionado && await continuar(p).isDisabled();
  await p.locator("#cuadra-sku-select").selectOption("sku1"); await espera(p);
  await continuar(p).click(); await espera(p);
  const prev = await ve(p, /Etiqueta Cuadra/) && await ve(p, /Stock después/);
  await p.getByRole("button", { name: "Confirmar", exact: true }).click(); await espera(p, 400);
  const lg = (await log(p)).split("\n").find(l => l.startsWith("inv:confirm")) || "";
  ok("inv-27 Cuadra: sin producto no deja; con producto, vista previa y manda stock_load con su SKU", sinSku && prev && /"stock_load"/.test(lg) && /"sku1"/.test(lg), lg.slice(0, 120));
});
await caso("inv-28 Esc dentro de un campo", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await p.getByLabel("Monto del pago 1").click(); await p.keyboard.press("Escape"); await espera(p);
  ok("inv-28 Esc con el cursor en un campo no cierra ni pregunta", await dlgInv(p).isVisible() && (await p.getByRole("dialog", { name: /Cerrar sin asignar/ }).count()) === 0);
});
await caso("inv-29 Esc y clic fuera mientras guarda", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await p.getByRole("button", { name: "No pagada", exact: true }).click(); await continuar(p).click(); await espera(p);
  await p.getByRole("button", { name: "Confirmar", exact: true }).click(); await p.keyboard.press("Escape"); await p.mouse.click(8, 8); await espera(p, 500);
  ok("inv-29 mientras guarda, ni Esc ni el clic fuera cierran ni preguntan", (await cuenta(p, "inv:cerrado")) === 0 && (await p.getByRole("dialog", { name: /Cerrar sin asignar/ }).count()) === 0);
});
await caso("inv-30 remisión en la vista previa", "", async p => {
  await inv(p); await tipo(p, "Remisión").click(); await espera(p); await p.getByRole("button", { name: "No pagada", exact: true }).click(); await continuar(p).click(); await espera(p);
  ok("inv-30 remisión: «Remisión por $56,900.00 · sin IVA»", await ve(p, /Remisión por \$56,900\.00/) && await ve(p, /sin IVA · a PORTLAND STUDIO/));
});
await caso("inv-31 saldo a favor", "cliente=saldo", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  ok("inv-31 cliente con saldo a favor: el aviso sale al elegir el tipo", await ve(p, /no lo descuenta/));
});
await caso("inv-32 dos Esc seguidos", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await p.getByRole("heading", { name: /Asignar folio/i }).click();
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await espera(p, 300);
  ok("inv-32 dos Esc seguidos: la pregunta sale y se cierra, el modal y los pagos siguen", (await p.getByRole("dialog", { name: /Cerrar sin asignar/ }).count()) === 0 && await dlgInv(p).isVisible() && (await p.getByLabel("Monto del pago 1").inputValue()) === "66004");
});
await caso("pre-11 razón «Otro» vacía o corta", "", async p => {
  await pre(p); await p.getByRole("button", { name: "Factura", exact: true }).click(); await espera(p);
  await p.getByLabel("Otro (especificar)").check(); await espera(p);
  const sinPagos = (await p.getByRole("button", { name: "No pagada", exact: true }).count()) === 0;
  await p.getByLabel("Razón del folio anticipado (otra)").fill("ab"); await espera(p);
  const corta = (await p.getByRole("button", { name: "No pagada", exact: true }).count()) === 0;
  await p.getByLabel("Razón del folio anticipado (otra)").fill("abc"); await espera(p);
  ok("pre-11 razón «Otro» vacía o de 2 letras no avanza; con 3, sí", sinPagos && corta && (await p.getByRole("button", { name: "No pagada", exact: true }).count()) === 1);
});
await caso("pre-12 emisor apagado pide folio", "emisor=off", async p => {
  await pre(p); await p.getByRole("button", { name: "Factura", exact: true }).click(); await espera(p);
  await p.getByLabel("Cliente paga adelantado").check(); await p.getByRole("button", { name: "No pagada", exact: true }).click(); await espera(p);
  const sinFolio = await continuar(p).isDisabled();
  await p.getByRole("button", { name: /^Usar F-137/ }).click(); await espera(p);
  ok("pre-12 emisor apagado: sin folio no deja; con la sugerencia, sí", sinFolio && !(await continuar(p).isDisabled()));
});

// ───────────── PreInvoiceModal
await caso("pre-01 faltan datos", "incompleto=1", async p => {
  await pre(p);
  const d = p.getByRole("dialog", { name: /Faltan datos de la orden/ });
  const foco = await p.evaluate(() => document.activeElement?.textContent?.trim());
  await p.keyboard.press("Escape"); await espera(p);
  ok("pre-01 datos incompletos: diálogo con nombre, foco en «Entendido» y Esc cierra", (await d.count()) === 0 && foco === "Entendido" && (await cuenta(p, "pre:cerrado")) === 1, "foco=" + foco);
});
await caso("pre-02 total a la vista (maquila)", "maquila=1", async p => {
  await pre(p);
  ok("pre-02 maquila: el total usa maq_price (antes no se veía)", await ve(p, /Subtotal \$12,000\.00 · con IVA \$13,920\.00/));
});
await caso("pre-03 captura y clic fuera / Esc", "", async p => {
  await pre(p); await p.getByRole("button", { name: "Factura", exact: true }).click(); await espera(p);
  await p.getByLabel("Cliente paga adelantado").check(); await espera(p);
  await p.mouse.click(8, 8); await espera(p);
  const fuera = await dlgPre(p).isVisible();
  await p.getByRole("heading", { name: /Folio anticipado/i }).click(); await p.keyboard.press("Escape"); await espera(p);
  ok("pre-03 con la razón elegida, el clic fuera no cierra y Esc pregunta", fuera && (await p.getByRole("dialog", { name: /Cerrar sin asignar el folio/ }).count()) === 1);
});
await caso("pre-04 cambiar de tipo con pagos", "", async p => {
  await pre(p); await p.getByRole("button", { name: "Factura", exact: true }).click(); await espera(p);
  await p.getByLabel("Cliente paga adelantado").check(); await pagada(p);
  await p.getByRole("button", { name: "Remisión", exact: true }).click(); await espera(p);
  ok("pre-04 cambiar de tipo con pagos pregunta", (await p.getByRole("dialog", { name: /Cambiar el tipo de comprobante/ }).count()) === 1);
});
await caso("pre-05 vista previa", "", async p => {
  await pre(p); await p.getByRole("button", { name: "Factura", exact: true }).click(); await espera(p);
  await p.getByLabel("Cliente paga adelantado").check(); await p.getByRole("button", { name: "No pagada", exact: true }).click(); await espera(p);
  const bg = await fondo(p, continuar(p));
  await continuar(p).click(); await espera(p);
  await p.screenshot({ path: OUT + "/pre-05-vista-previa.png" });
  ok("pre-05 vista previa con importe, cliente y razón; botones en ámbar oscuro (#b45309)", await ve(p, /Factura por \$66,004\.00/) && await ve(p, /Razón: Cliente paga adelantado/) && bg === "rgb(180, 83, 9)", bg);
});
await caso("pre-06 no se pudo saber quién pone el folio", "emisor=falla", async p => {
  await pre(p); await p.getByRole("button", { name: "Factura", exact: true }).click(); await espera(p);
  ok("pre-06 si falla la consulta del emisor, lo dice y no deja continuar", await ve(p, /No se pudo confirmar si el folio lo asigna el sistema/) && await continuar(p).isDisabled());
});
await caso("pre-07 doble clic en Confirmar folio", "", async p => {
  await pre(p); await p.getByRole("button", { name: "Factura", exact: true }).click(); await espera(p);
  await p.getByLabel("Cliente paga adelantado").check(); await p.getByRole("button", { name: "No pagada", exact: true }).click(); await continuar(p).click(); await espera(p);
  await p.getByRole("button", { name: "Confirmar folio" }).dblclick(); await espera(p, 700);
  ok("pre-07 doble clic en «Confirmar folio» manda UNA vez", (await cuenta(p, "pre:confirm")) === 1, "veces=" + await cuenta(p, "pre:confirm"));
});
await caso("pre-08 sin «Datos completos» ni rayas", "", async p => {
  await pre(p); await p.getByRole("button", { name: "Factura", exact: true }).click(); await espera(p);
  await p.getByLabel("Cliente paga adelantado").check(); await espera(p);
  ok("pre-08 ya no sale «Datos completos.» y no hay rayas largas", !(await ve(p, /Datos completos/)) && !(await ve(p, /—/)));
});
await caso("pre-09 PreInvoice: la nota sin pago", "", async p => {
  await pre(p); await p.getByRole("button", { name: "Factura", exact: true }).click(); await espera(p);
  await p.getByLabel("Cliente paga adelantado").check(); await p.getByRole("button", { name: "No pagada", exact: true }).click(); await espera(p);
  ok("pre-09 en el folio anticipado (sin efectivo aquí), la nota manda a Tesorería", await ve(p, /Tesorería crea el vale de caja/));
});
await caso("pre-10 Tab no se sale", "", async p => {
  await pre(p); await p.keyboard.press("Shift+Tab");
  ok("pre-10 Mayús+Tab al abrir no se sale del diálogo", (await enDialogo(p)) === "preinvoice-modal-title", "foco en " + await enDialogo(p));
});

await browser.close();
const fallas = res.filter(r => r.startsWith("FALLA")).length;
console.log(res.join("\n"));
console.log(`\n${res.length - fallas} pasan, ${fallas} fallan`);
