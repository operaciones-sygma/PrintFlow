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
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;   // SOLO=inv-3[3-9] corre sólo esos (sabotajes)
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
// (v10.84.70) la palabra completa: «Facturar por partes» también empieza con «Factura»
const tipo = (p, t) => p.getByRole("button", { name: new RegExp("^" + t + "(\\s|$)") }).first();
const continuar = p => p.getByRole("button", { name: "Continuar" });
// (v10.84.70, segunda revisión) el botón final de la vista previa dice lo que hace («Emitir y entregar», «Ligar F-… y entregar»…);
//   antes era «Confirmar» para todo. Las pruebas de antes lo buscan por aquí.
const final = p => dlgInv(p).getByRole("button", { name: /^(Confirmar|Emitir y entregar|Asignar \S+ y entregar|Ligar \S+ y entregar|Aplicar saldo y entregar|Cargar a stock)/ }).last();
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
  // (v10.84.70: un color para la acción en todos los tipos; antes cada tipo con el suyo y el verde era también «Pagada»)
  ok("inv-13 «Continuar» de remisión en el color de la acción (slate #4a6572), legible", bg === "rgb(74, 101, 114)", bg);
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
  await final(p).dblclick(); await espera(p, 700);
  ok("inv-16 doble clic en Confirmar manda UNA vez", (await cuenta(p, "inv:confirm")) === 1, "veces=" + await cuenta(p, "inv:confirm"));
});
await caso("inv-17 la base rechaza", "falla=1", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p); await continuar(p).click(); await espera(p);
  await final(p).click(); await espera(p, 600);
  ok("inv-17 si la base rechaza, el modal sigue con lo capturado para reintentar", (await cuenta(p, "toast:error")) === 1 && await dlgInv(p).isVisible() && !(await final(p).isDisabled()));
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
  await p.waitForTimeout(8600);   // (v10.84.70: el tope es 8 s, como todo lo que se consulta al abrir; eran 5)
  ok("inv-19 cliente lento: tipos apagados mientras carga; a los 8 s, aviso con «Recargar» (en tinta)", cargando && await ve(p, /No se terminó de cargar el cliente/) && await p.getByRole("button", { name: "Recargar" }).isVisible());
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
  ok("inv-23 «Parcial» que cubre o pasa el total: lo dice y no deja", await ve(p, /Lo capturado (pasa del|cubre el) total/) && await continuar(p).isDisabled());
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
  await final(p).click(); await espera(p, 400);
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
  await final(p).click(); await p.keyboard.press("Escape"); await p.mouse.click(8, 8); await espera(p, 500);
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

// ───────────── v10.84.70-70: la critique independiente del 8-oct (23/40). Escritas ANTES del arreglo (vuelta 1).
// Contraste WCAG entre dos colores «rgb(…)»/«rgba(…)» (el fondo con alfa se mezcla sobre blanco frío)
const rgb = s => { const m = String(s).match(/[\d.]+/g) || []; const [r, g, b, a = 1] = m.map(Number); return [r, g, b, a]; };
const sobre = (c, f = [252, 253, 254]) => c.slice(0, 3).map((v, i) => v * c[3] + f[i] * (1 - c[3]));
const lumin = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (fg, bg) => { const B = sobre(rgb(bg)), F = sobre(rgb(fg), B); const [a, b] = [lumin(F), lumin(B)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); };
const colores = loc => loc.evaluate(el => { const cs = getComputedStyle(el); return { fg: cs.color, bg: cs.backgroundColor, borde: cs.borderTopColor, letra: cs.fontFamily, peso: cs.fontWeight, opacidad: Number(cs.opacity) }; });
const pagoNo = p => p.getByRole("button", { name: "No pagada", exact: true });

// [P1] Enter-Enter no emite sin leer la vista previa
await caso("inv-33 Enter, Enter desde «Continuar»", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p);
  await continuar(p).focus(); await p.keyboard.press("Enter"); await espera(p, 120);
  const foco = await p.evaluate(() => (document.activeElement?.innerText || "").trim());
  await p.keyboard.press("Enter"); await espera(p, 700);
  ok("inv-33 Enter, Enter: el primero abre la vista previa y el segundo NO emite (el foco no cae en «Confirmar»)", (await cuenta(p, "inv:confirm")) === 0 && !/^(Confirmar|Emitir y entregar)/.test(foco), "foco tras el 1er Enter: «" + foco + "» · emitió " + await cuenta(p, "inv:confirm"));
});
await caso("inv-34 doble clic en «Continuar»", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p);
  await continuar(p).dblclick(); await espera(p, 700);
  ok("inv-34 doble clic en «Continuar» se queda en la vista previa (no emite)", (await cuenta(p, "inv:confirm")) === 0 && await ve(p, /Factura por \$66,004\.00/));
});
await caso("inv-35 Ctrl+Enter", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p);
  await p.getByRole("heading", { name: /Asignar folio/i }).click(); await p.keyboard.press("Control+Enter"); await espera(p, 400);
  const abrio = await ve(p, /Factura por \$66,004\.00/);
  await p.keyboard.press("Control+Enter"); await espera(p, 600);
  ok("inv-35 Ctrl+Enter abre la vista previa, y en la vista previa no emite", abrio && (await cuenta(p, "inv:confirm")) === 0, "abrió=" + abrio + " · emitió " + await cuenta(p, "inv:confirm"));
});
await caso("inv-36 confirmar a propósito con el teclado", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p);
  await continuar(p).click(); await espera(p, 700);
  await final(p).focus(); await p.keyboard.press("Enter"); await espera(p, 600);
  ok("inv-36 con el foco puesto en «Confirmar», Enter sí emite (una vez)", (await cuenta(p, "inv:confirm")) === 1);
});
// [P1] lo capturado no se pierde sin preguntar
await caso("inv-37 «Volver» con un pago", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await p.getByRole("button", { name: /^(Volver|Cancelar)$/ }).click(); await espera(p, 400);
  const q = p.getByRole("dialog", { name: /Cerrar sin asignar el folio/ });
  const pregunto = (await q.count()) === 1;
  if (pregunto) { await p.getByRole("button", { name: /Seguir capturando|No, cancelar/ }).click(); await espera(p); }
  ok("inv-37 «Volver»/«Cancelar» con un pago capturado pregunta, y «Seguir capturando» lo deja", pregunto && (await cuenta(p, "inv:cerrado")) === 0 && (await p.getByLabel("Monto del pago 1").inputValue().catch(() => "")).replace(/,/g, "").startsWith("66004"));
});
await caso("inv-38 «No pagada» con dos pagos", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p, "40000");
  await p.getByRole("button", { name: /Agregar otro pago/ }).click(); await p.getByRole("radio", { name: "Efectivo" }).nth(1).click(); await p.getByLabel("Monto del pago 2").fill("26004"); await espera(p);
  await pagoNo(p).click(); await espera(p, 300);
  const q = p.getByRole("dialog", { name: /Quitar los pagos/ });
  if (await q.count()) await p.getByRole("button", { name: /Seguir con los pagos|No, cancelar/ }).click().catch(() => {});
  await p.getByRole("button", { name: "Pagada", exact: true }).click(); await espera(p, 300);
  const m1 = (await p.getByLabel("Monto del pago 1").inputValue().catch(() => "")).replace(/,/g, ""), m2 = (await p.getByLabel("Monto del pago 2").inputValue().catch(() => "")).replace(/,/g, "");
  ok("inv-38 «No pagada» con dos pagos no los pierde: al regresar a «Pagada» siguen los dos", m1.startsWith("40000") && m2.startsWith("26004"), "pago 1=«" + m1 + "» · pago 2=«" + m2 + "»");
});
await caso("inv-39 «Volver» sin nada capturado", "", async p => {
  await inv(p); await p.getByRole("button", { name: /^(Volver|Cancelar)$/ }).click(); await espera(p, 300);
  ok("inv-39 «Volver»/«Cancelar» sin nada capturado cierra de inmediato", (await cuenta(p, "inv:cerrado")) === 1);
});
// [P1] lo que sabe la base, al abrir y dentro del diálogo
await caso("inv-40 anticipo del mismo importe, al abrir", "anticipo=mismo", async p => {
  await inv(p); await espera(p, 400);
  await p.screenshot({ path: OUT + "/inv-40-mismo-importe.png" });
  const liga = p.getByRole("button", { name: /^Ligar F-9135 y entregar/ });
  ok("inv-40 al abrir pregunta si F-9135 ($66,004.00) es la factura de este trabajo, y el botón principal es «Ligar F-9135 y entregar»", await ve(p, /F-9135/) && await ve(p, /\$66,004\.00/) && (await liga.count()) === 1 && await liga.isEnabled());
});
await caso("inv-41 ligar de punta a punta", "anticipo=mismo", async p => {
  await inv(p); await espera(p, 400);
  await p.getByRole("button", { name: /^Ligar F-9135 y entregar/ }).click(); await espera(p, 600);
  const prev = await ve(p, /Vas a ligar F-9135/) && await ve(p, /no se emite (un )?folio nuevo/i);
  await final(p).click(); await espera(p, 600);
  ok("inv-41 «Ligar…» lleva a una vista previa que lo dice y al confirmar liga F-9135 sin emitir otro folio", prev && (await cuenta(p, "inv:ligar F-9135")) === 1 && (await cuenta(p, "inv:confirm")) === 0);
});
await caso("inv-42 al ligar no se piden pagos", "anticipo=mismo", async p => {
  await inv(p); await espera(p, 400);
  ok("inv-42 con F-9135 por ligar no se piden pagos aquí: dice su estado y que el cobro va en CobranzaFlow", (await p.getByRole("button", { name: "Pagada", exact: true }).count()) === 0 && await ve(p, /CobranzaFlow/) && await ve(p, /pendiente|pagada/i));
});
await caso("inv-43 anticipo de otro importe", "anticipo=otro", async p => {
  await inv(p); await espera(p, 400);
  await p.screenshot({ path: OUT + "/inv-43-otro-importe.png" });
  const dice = await ve(p, /F-9140/) && await ve(p, /\$2,157\.60/);
  await p.getByRole("button", { name: /Facturar por partes/ }).click(); await espera(p, 300);
  ok("inv-43 al abrir dice que F-9140 ($2,157.60) es de otro importe y «Facturar por partes» lleva ahí", dice && (await cuenta(p, "inv:partes")) === 1);
});
await caso("inv-44 de otro importe, la factura completa sigue", "anticipo=otro", async p => {
  await inv(p); await espera(p, 400); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p);
  await continuar(p).click(); await espera(p, 700);
  const prev = await ve(p, /F-9140/) && await ve(p, /sin ligar/);
  await final(p).click(); await espera(p, 600);
  ok("inv-44 con una de otro importe se puede emitir la completa; la vista previa dice que F-9140 se queda sin ligar y no se pregunta otra vez", prev && (await cuenta(p, "inv:confirm")) === 1);
});
await caso("inv-45 no se pudieron leer", "anticipo=falla", async p => {
  await inv(p); await espera(p, 400);
  const avisa = await ve(p, /No se pudo revisar si (ya )?hay una factura por adelantado/) && await p.getByRole("button", { name: "Reintentar" }).first().isVisible();
  await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p);
  const sinEfectivo = !(await continuar(p).isDisabled());
  await p.getByRole("button", { name: "Pagada", exact: true }).click(); await espera(p, 200);
  await p.getByRole("radio", { name: "Efectivo" }).first().click(); await p.getByLabel("Monto del pago 1").fill("66004"); await espera(p, 200);
  const conEfectivo = await continuar(p).isDisabled() && await ve(p, /efectivo/i);
  ok("inv-45 si no se pudieron leer: lo dice con «Reintentar»; sin efectivo deja seguir, con efectivo no (y dice por qué)", avisa && sinEfectivo && conEfectivo, `avisa=${avisa} · sin efectivo sigue=${sinEfectivo} · con efectivo frena=${conEfectivo}`);
});
await caso("inv-46 el error de la base, dentro", "falla=1", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p); await continuar(p).click(); await espera(p, 700);
  await final(p).click(); await espera(p, 700);
  const alerta = dlgInv(p).getByRole("alert");
  const txt = (await alerta.count()) ? (await alerta.first().innerText()) : "";
  ok("inv-46 si la base rechaza, el diálogo lo dice adentro (role=alert), en palabras, y lo capturado sigue", /sin conexión/.test(txt) && await dlgInv(p).isVisible(), "alerta: «" + txt.slice(0, 90) + "»");
});
await caso("inv-47 se emitió por adelantado mientras capturaba", "adelantada=1", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await continuar(p).click(); await espera(p, 700);
  await final(p).click(); await espera(p, 900);
  ok("inv-47 si la base dice que ya hay una por adelantado, el diálogo lo dice y ofrece «Ligar F-9135 y entregar»", await dlgInv(p).isVisible() && await ve(p, /F-9135/) && (await p.getByRole("button", { name: /^Ligar F-9135 y entregar/ }).count()) === 1);
});
// [P2] capturar un pago
await caso("inv-48 «Pagada» trae el total", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "Pagada", exact: true }).click(); await espera(p, 200);
  const v = (await p.getByLabel("Monto del pago 1").inputValue()).replace(/,/g, "");
  ok("inv-48 «Pagada» llena el pago 1 con el total ($66,004.00)", Number(v) === 66004, "monto=«" + v + "»");
});
await caso("inv-49 otro pago trae lo que falta", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p, "40000");
  await p.getByRole("button", { name: /Agregar otro pago/ }).click(); await espera(p, 200);
  const v = (await p.getByLabel("Monto del pago 2").inputValue()).replace(/,/g, "");
  ok("inv-49 «Agregar otro pago» lo llena con lo que falta ($26,004.00)", Number(v) === 26004, "monto=«" + v + "»");
});
await caso("inv-50 la rueda no cambia el dinero", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  const campo = p.getByLabel("Monto del pago 1"); await campo.click(); const caja = await campo.boundingBox();
  await p.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2); await p.mouse.wheel(0, 120); await espera(p, 200); await p.mouse.wheel(0, -240); await espera(p, 200);
  const v = (await campo.inputValue()).replace(/,/g, "");
  // (vuelta 1: la rueda sola no lo mueve en el navegador sin pantalla; el campo numérico sí se mueve con las flechas, y con la rueda en Windows)
  await campo.press("ArrowDown"); await espera(p, 150); const v2 = (await campo.inputValue()).replace(/,/g, "");
  const tipoCampo = await campo.getAttribute("type");
  ok("inv-50 con el cursor en el monto, ni la rueda ni las flechas cambian el dinero (no es un campo numérico)", Number(v) === 66004 && Number(v2) === 66004 && tipoCampo !== "number", "rueda=«" + v + "» · ↓=«" + v2 + "» · type=" + tipoCampo);
});
await caso("inv-51 el monto: dos decimales y sin signo", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p, "66004.004");
  const a = (await p.getByLabel("Monto del pago 1").inputValue()).replace(/,/g, "");
  await p.getByLabel("Monto del pago 1").fill("-500"); await espera(p, 150);
  const b = (await p.getByLabel("Monto del pago 1").inputValue()).replace(/,/g, "");
  ok("inv-51 el monto no acepta un tercer decimal ni el signo menos", !/\.\d{3}/.test(a) && !b.includes("-"), "«66004.004» → «" + a + "» · «-500» → «" + b + "»");
});
await caso("inv-52 el monto a la vista a 1366", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "Pagada", exact: true }).click(); await espera(p, 300);
  const c = await p.getByLabel("Monto del pago 1").boundingBox();
  ok("inv-52 a 1366×768, al elegir «Pagada» el monto se ve sin hacer scroll", !!c && c.y >= 0 && c.y + c.height <= 768 - 80, "y=" + (c && Math.round(c.y)));
});
await caso("inv-53 el tipo elegido se encoge", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p, 300);
  const c = await tipo(p, "Factura").boundingBox();
  ok("inv-53 elegido el tipo, su control mide como mucho 64 px de alto (antes ~140)", !!c && c.height <= 64, "alto=" + (c && Math.round(c.height)));
});
await caso("inv-54 a 1920 no hace scroll con dos pagos", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p, "40000");
  await p.getByRole("button", { name: /Agregar otro pago/ }).click(); await p.getByRole("radio", { name: "Efectivo" }).nth(1).click(); await p.getByLabel("Monto del pago 2").fill("26004"); await espera(p, 300);
  await p.screenshot({ path: OUT + "/inv-54-1920.png" });
  const hace = await dlgInv(p).evaluate(d => [...d.querySelectorAll("*")].some(el => el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY)));
  ok("inv-54 a 1920×1080 con dos pagos, el diálogo cabe sin scroll", !hace);
}, { width: 1920, height: 1080 });
await caso("inv-55 métodos en una línea y con flechas", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "Pagada", exact: true }).click(); await espera(p, 200);
  const grupo = p.getByRole("radiogroup", { name: /Método de pago 1/ }); const c = await grupo.boundingBox();
  await p.getByRole("radio", { name: "Transferencia" }).first().click(); await p.getByRole("radio", { name: "Transferencia" }).first().focus();
  await p.keyboard.press("ArrowRight"); await espera(p, 150);
  const sel = await grupo.getByRole("radio", { checked: true }).first().innerText().catch(() => "");
  ok("inv-55 los métodos van en un renglón (≤ 48 px) y la flecha → cambia de método", !!c && c.height <= 48 && /Tarjeta/.test(sel), "alto=" + (c && Math.round(c.height)) + " · tras → «" + sel.trim() + "»");
});
// [P2] el color y el botón apagado
await caso("inv-56 «Continuar» apagado dice por qué y se lee", "", async p => {
  await inv(p); await espera(p, 300);
  const col = await colores(continuar(p));
  const razon1 = await ve(p, /Elige (si es )?factura o remisión|Elige el tipo/);
  await tipo(p, "Factura").click(); await espera(p);
  const razon2 = await ve(p, /Elige (el estado de pago|si ya pagó)/);
  // (vuelta 1: el contraste sin la opacidad daba 4.70; el botón estaba al 40% y se leía a 1.7:1. Un estado no se dice con opacidad.)
  ok("inv-56 «Continuar» apagado: se lee (≥ 4.5:1, sin transparencia) y una línea dice qué falta (tipo, luego el pago)", col.opacidad >= 0.99 && contraste(col.fg, col.bg) >= 4.5 && razon1 && razon2, "opacidad=" + col.opacidad + " · contraste=" + contraste(col.fg, col.bg).toFixed(2) + " · razón tipo=" + razon1 + " · razón pago=" + razon2);
});
await caso("inv-57 un solo color para la acción", "cliente=corona", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p);
  const fac = (await colores(continuar(p))).bg;
  await tipo(p, "Remisión").click(); await espera(p); const q = p.getByRole("dialog", { name: /Cambiar el tipo/ }); if (await q.count()) await p.getByRole("button", { name: /^Cambiar/ }).click(); await espera(p); await pagoNo(p).click(); await espera(p);
  const rem = (await colores(continuar(p))).bg;
  await p.getByRole("button", { name: /^Aplicar saldo/ }).click(); await espera(p); if (await q.count()) await p.getByRole("button", { name: /^Cambiar/ }).click(); await espera(p);
  const cor = (await colores(continuar(p))).bg;
  ok("inv-57 «Continuar» tiene el mismo color con factura, remisión y «Aplicar saldo»", fac === rem && rem === cor, [fac, rem, cor].join(" · "));
});
await caso("inv-58 el tipo no usa los colores del pago", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p, 300); const f = (await colores(tipo(p, "Factura"))).borde;
  await tipo(p, "Remisión").click(); await espera(p, 300); const r = (await colores(tipo(p, "Remisión"))).borde;
  ok("inv-58 Factura y Remisión elegidas se marcan con el mismo color (el del sistema), no violeta y verde", f === r, f + " · " + r);
});
await caso("inv-59 «No pagada» no es un aviso", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p, 200);
  const c = await colores(pagoNo(p));
  const ambar = ["rgb(255, 149, 0)", "rgb(229, 138, 18)", "rgb(180, 83, 9)"];
  ok("inv-59 «No pagada» elegida (el crédito de siempre) no va en ámbar de aviso", !ambar.includes(c.borde) && !ambar.includes(c.fg), c.borde + " · " + c.fg);
});
await caso("inv-60 quitar un pago", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p, "40000");
  await p.getByRole("button", { name: /Agregar otro pago/ }).click(); await espera(p, 200);
  const b = p.getByRole("button", { name: "Quitar el pago 2" });
  const hay = (await b.count()) === 1; const c = hay ? await colores(b) : { letra: "", peso: "" };
  ok("inv-60 quitar un pago es una «×» discreta («Quitar el pago 2»), en la letra del sistema y sin negrita", hay && /Geist/.test(c.letra) && Number(c.peso) <= 600 && !(await ve(p, /^Eliminar$/)), "existe=" + hay + " · " + c.letra.split(",")[0] + " " + c.peso);
});
await caso("inv-61 no regaña antes de tiempo", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "Pagada", exact: true }).click(); await espera(p, 300);
  ok("inv-61 recién elegida «Pagada», no salen «incompleto» ni el ⚠ de la referencia en ámbar", !(await ve(p, /· incompleto/)) && (await dlgInv(p).locator('label:has-text("Ref bancaria") svg').count()) === 0);
});
// menores
await caso("inv-62 «día(s)»", "anticipo=otro", async p => {
  await inv(p); await espera(p, 400);
  ok("inv-62 los días van en su número («hace 1 día»), sin «día(s)»", !(await ve(p, /día\(s\)/)) && await ve(p, /hace 1 día\b/));
});
await caso("inv-63 la vista previa nombra los métodos y el vale", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p, "40000");
  await p.getByRole("button", { name: /Agregar otro pago/ }).click(); await p.getByRole("radio", { name: "Efectivo" }).nth(1).click(); await p.getByLabel("Monto del pago 2").fill("26004"); await espera(p);
  await continuar(p).click(); await espera(p, 700);
  ok("inv-63 la vista previa dice «Transferencia» y «Efectivo» (no los ids) y que se crea e imprime el vale de caja", await ve(p, /Transferencia/) && await ve(p, /Efectivo/) && !(await ve(p, /transferencia \+ efectivo/)) && await ve(p, /vale de caja/i));
});
await caso("inv-64 sin precio no se piden pagos", "precio0=1", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p, 300);
  const pagadaHay = (await p.getByRole("button", { name: "Pagada", exact: true }).count()) > 0 && await p.getByRole("button", { name: "Pagada", exact: true }).isEnabled();
  ok("inv-64 sin precio no deja capturar pagos (no «$0.00 ✓ Cubierto») y dice por qué", !pagadaHay && await ve(p, /sin precio/i));
});
await caso("inv-65 la pregunta de cerrar", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await p.getByRole("heading", { name: /Asignar folio/i }).click(); await p.keyboard.press("Escape"); await espera(p, 300);
  const d = p.getByRole("dialog", { name: /Cerrar sin asignar/ });
  const desc = await d.getAttribute("aria-describedby").catch(() => null);
  ok("inv-65 la pregunta de cerrar dice «Seguir capturando» (no «No, cancelar») y se describe para el lector de pantalla", (await p.getByRole("button", { name: "Seguir capturando" }).count()) === 1 && !!desc, "aria-describedby=" + desc);
});
await caso("inv-66 los estados de pago se anuncian", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p, 200);
  ok("inv-66 «No pagada / Parcial / Pagada» dicen cuál está elegido (aria-pressed)", (await pagoNo(p).getAttribute("aria-pressed")) === "true" && (await p.getByRole("button", { name: "Pagada", exact: true }).getAttribute("aria-pressed")) === "false");
});

// ───────────── v10.84.70, segunda tanda: por donde NO se diseñó el arreglo
// (sabotaje S4, 8-oct: un doble clic en «Ligar…» no ligaba aunque se quitara el escudo, porque la vista previa mide otro alto y el pie
//  se mueve: el segundo clic caía en otro lado, por suerte. Se comprueba el escudo mismo: está puesto justo después del clic.)
const hayEscudo = p => p.evaluate(() => !!document.querySelector('[data-escudo="1"]'));
await caso("inv-67 doble clic en «Ligar» y en «Confirmar»", "anticipo=mismo", async p => {
  await inv(p); await espera(p, 400);
  await p.getByRole("button", { name: /^Ligar F-9135 y entregar/ }).click();
  const escudo = await hayEscudo(p); await espera(p, 700);
  const enVista = await ve(p, /Vas a ligar F-9135/) && (await cuenta(p, "inv:ligar")) === 0;
  await final(p).dblclick(); await espera(p, 800);
  ok("inv-67 tras «Ligar…» queda el escudo (el segundo clic no llega a «Confirmar») y doble clic en «Confirmar» liga UNA vez", escudo && enVista && (await cuenta(p, "inv:ligar")) === 1, "escudo=" + escudo + " · ligó " + await cuenta(p, "inv:ligar"));
});
await caso("inv-82 el escudo después de «Continuar»", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p);
  await continuar(p).click(); const escudo = await hayEscudo(p);
  ok("inv-82 tras «Continuar» queda el escudo medio segundo (el segundo clic de un doble clic no llega a «Confirmar»)", escudo);
});
await caso("inv-68 ligar cuando la base falla", "anticipo=mismo&falla=1", async p => {
  await inv(p); await espera(p, 400);
  await p.getByRole("button", { name: /^Ligar F-9135 y entregar/ }).click(); await espera(p, 700);
  await final(p).click(); await espera(p, 700);
  const alerta = dlgInv(p).getByRole("alert"); const txt = (await alerta.count()) ? await alerta.first().innerText() : "";
  ok("inv-68 si ligar falla, el diálogo lo dice adentro y se puede reintentar (sigue «Confirmar»)", /No se ligó F-9135/.test(txt) && await final(p).isEnabled(), "«" + txt.slice(0, 80) + "»");
});
await caso("inv-69 «No es de este trabajo» y de regreso", "anticipo=mismo", async p => {
  await inv(p); await espera(p, 400);
  await p.getByRole("button", { name: "No es de este trabajo" }).click(); await espera(p, 300);
  const avisa = await ve(p, /no deja emitir otra factura por \$66,004\.00/);
  await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await p.getByRole("button", { name: /^Ligar F-9135 a esta orden$/ }).click(); await espera(p, 300);
  const regreso = (await p.getByRole("button", { name: /^Ligar F-9135 y entregar/ }).count()) === 1;
  await p.getByRole("button", { name: "No es de este trabajo" }).click(); await espera(p, 300);
  const sigue = (await p.getByLabel("Monto del pago 1").inputValue()).replace(/,/g, "").startsWith("66004");
  ok("inv-69 «No es de este trabajo» avisa que la base no deja otra por el mismo importe; «Ligar F-9135 a esta orden» regresa, y lo capturado no se pierde", avisa && regreso && sigue, `avisa=${avisa} · regresa=${regreso} · pago sigue=${sigue}`);
});
await caso("inv-70 la lectura tarda más que el tope", "anticipo=lenta", async p => {
  await p.click("#abrir-inv"); await dlgInv(p).waitFor(); await espera(p, 900);
  const revisando = await ve(p, /Revisando si ya se facturó por adelantado/);
  await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p);
  const apagado = await continuar(p).isDisabled();
  await p.waitForTimeout(8000);
  const tope = await ve(p, /No se pudo revisar si (ya )?hay una factura por adelantado/) && !(await continuar(p).isDisabled());
  await p.waitForTimeout(2000);
  const tarde = await ve(p, /F-9140/);
  ok("inv-70 mientras revisa, «Continuar» espera y lo dice; a los 8 s lo da por no leído (sin efectivo sigue); si llega tarde, lo muestra", revisando && apagado && tope && tarde, `revisando=${revisando} · apagado=${apagado} · tope=${tope} · tarde=${tarde}`);
});
await caso("inv-71 «Reintentar» la lectura", "anticipo=falla1", async p => {
  await inv(p); await espera(p, 400);
  const avisa = await ve(p, /No se pudo revisar/);
  await p.getByRole("button", { name: "Reintentar" }).first().click(); await espera(p, 600);
  ok("inv-71 «Reintentar» vuelve a leer y, si contesta, dice lo que encontró (F-9140)", avisa && await ve(p, /F-9140/) && !(await ve(p, /No se pudo revisar/)));
});
await caso("inv-72 el foco al regresar con «Atrás»", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p);
  await continuar(p).click(); await espera(p, 700);
  const enVista = await p.evaluate(() => document.activeElement?.getAttribute("role") === "group");
  await p.getByRole("button", { name: /Atrás/ }).click(); await espera(p, 400);
  const dentro = await enDialogo(p);
  ok("inv-72 en la vista previa el foco está en ella; con «Atrás» regresa al diálogo (no al fondo)", enVista && dentro === "invoice-modal-title", `vista=${enVista} · tras Atrás=${dentro}`);
});
await caso("inv-73 Ctrl+Enter con el botón apagado", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("heading", { name: /Asignar folio/i }).click(); await p.keyboard.press("Control+Enter"); await espera(p, 400);
  ok("inv-73 Ctrl+Enter sin poder seguir (falta el pago) no abre la vista previa", !(await ve(p, /Factura por \$66,004\.00/)) && await continuar(p).isDisabled());
});
await caso("inv-74 Ctrl+Enter para ligar", "anticipo=mismo", async p => {
  await inv(p); await espera(p, 400);
  await p.getByRole("heading", { name: /Asignar folio/i }).click(); await p.keyboard.press("Control+Enter"); await espera(p, 500);
  const vista = await ve(p, /Vas a ligar F-9135/);
  await p.keyboard.press("Control+Enter"); await espera(p, 500);
  ok("inv-74 Ctrl+Enter lleva a la vista previa de ligar, y ahí no liga solo", vista && (await cuenta(p, "inv:ligar")) === 0);
});
await caso("inv-75 pegar un monto con comas", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p, "66,004.00");
  const v = await p.getByLabel("Monto del pago 1").inputValue();
  ok("inv-75 «66,004.00» pegado queda en 66004.00 y cubre el total", Number(v) === 66004 && await ve(p, /Cubierto/), "«" + v + "»");
});
await caso("inv-76 las flechas en los extremos", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "Pagada", exact: true }).click(); await espera(p, 200);
  const r0 = p.getByRole("radiogroup", { name: /Método de pago 1/ }).getByRole("radio").first(); await r0.focus();
  await p.keyboard.press("ArrowLeft"); await espera(p, 150);
  const ultimo = await p.getByRole("radiogroup", { name: /Método de pago 1/ }).getByRole("radio", { checked: true }).innerText().catch(() => "");
  await p.keyboard.press("Home"); await espera(p, 150);
  const primero = await p.getByRole("radiogroup", { name: /Método de pago 1/ }).getByRole("radio", { checked: true }).innerText().catch(() => "");
  const foco = await p.evaluate(() => document.activeElement?.getAttribute("role"));
  ok("inv-76 ← desde el primero va al último («Otro»), Inicio regresa al primero («Efectivo»), y el foco sigue en el grupo", /Otro/.test(ultimo) && /Efectivo/.test(primero) && foco === "radio", `← «${ultimo.trim()}» · Inicio «${primero.trim()}» · foco ${foco}`);
});
await caso("inv-77 Corona en dos columnas", "cliente=corona", async p => {
  await inv(p); await p.getByRole("button", { name: /^Aplicar saldo/ }).click(); await espera(p, 300);
  await continuar(p).click(); await espera(p, 700);
  ok("inv-77 «Aplicar saldo» dice la acción y el monto («Descontar $56,900.00…») y el saldo negativo con su signo", await ve(p, /Descontar \$56,900\.00 de lo facturado por adelantado/) && await ve(p, /−\$26,900\.00/) && !(await ve(p, /\$-26,900/)));
});
await caso("inv-78 Cuadra en dos columnas", "cliente=cuadra", async p => {
  await inv(p); await p.getByRole("button", { name: /^Sin factura · Stock/ }).click(); await espera(p, 400);
  const c = await continuar(p).boundingBox();
  ok("inv-78 «Sin factura · Stock» a 1366: dice que no lleva pago y «Continuar» se ve sin scroll", await ve(p, /Cargar a stock no lleva pago/) && !!c && c.y + c.height <= 768, "y=" + (c && Math.round(c.y)));
});
await caso("inv-79 «No pagada» y de regreso con un parcial", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "Parcial", exact: true }).click(); await espera(p, 200);
  await p.getByRole("radio", { name: "Cheque" }).first().click(); await p.getByLabel("Monto del pago 1").fill("1000"); await espera(p, 150);
  await pagoNo(p).click(); await espera(p, 200);
  const dice = await ve(p, /pago que capturaste se guardó/);
  await p.getByRole("button", { name: "Parcial", exact: true }).click(); await espera(p, 200);
  const v = await p.getByLabel("Monto del pago 1").inputValue();
  ok("inv-79 «No pagada» dice que el pago se guardó; al volver a «Parcial» regresa el cheque de $1,000", dice && Number(v) === 1000 && (await p.getByRole("radio", { name: "Cheque", checked: true }).count()) === 1, "monto=«" + v + "»");
});
await caso("inv-80 Esc en el modo de ligar", "anticipo=mismo", async p => {
  await inv(p); await espera(p, 400);
  await p.getByRole("heading", { name: /Asignar folio/i }).click(); await p.keyboard.press("Escape"); await espera(p, 300);
  ok("inv-80 con F-9135 por ligar y nada capturado, Esc cierra sin preguntar", (await cuenta(p, "inv:cerrado")) === 1);
});
await caso("inv-81 a 1920 la vista previa no se estira", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await continuar(p).click(); await espera(p, 700);
  const c = await p.getByRole("group", { name: /Lo que vas a emitir/ }).boundingBox();
  ok("inv-81 a 1920 el resumen de la vista previa mide como mucho 560 px de ancho (se lee de una mirada)", !!c && c.width <= 562, "ancho=" + (c && Math.round(c.width)));
}, { width: 1920, height: 1080 });

// ───────────── v10.84.70, segunda revisión independiente (28/40): escritas ANTES de su arreglo
await caso("inv-83 el efectivo capturado y la factura por adelantado", "adelantada=1", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "Pagada", exact: true }).click(); await espera(p, 200);
  await p.getByRole("radio", { name: "Efectivo" }).first().click(); await p.getByLabel(/Quién entregó el efectivo del pago 1/).fill("Sr. Ramírez"); await espera(p, 150);
  await continuar(p).click(); await espera(p, 700); await final(p).click(); await espera(p, 900);
  const dice = await ve(p, /Capturaste \$66,004\.00 en efectivo/) && await ve(p, /no se cobra aquí/);
  const liga = p.getByRole("button", { name: /^Ligar F-9135 y entregar/ }).first();
  const frena = await liga.isDisabled();
  await p.getByLabel("Lo registro en CobranzaFlow").check(); await espera(p, 200);
  await liga.click(); await espera(p, 700);
  const enVista = await ve(p, /no se cobra aquí/);
  await final(p).click(); await espera(p, 700);
  const lg = (await log(p)).split("\n").find(l => l.startsWith("inv:ligar")) || "";
  ok("inv-83 con efectivo y la del mismo importe: dice lo capturado, no deja ligar sin reconocerlo, la vista previa lo repite y App recibe lo que no se cobró", dice && frena && enVista && /sinCobrar/.test(lg) && /Ram/.test(lg), `dice=${dice} · frena=${frena} · vista=${enVista} · «${lg.slice(0, 120)}»`);
});
await caso("inv-84 «No es de este trabajo» y el mismo tipo", "anticipo=mismo", async p => {
  await inv(p); await espera(p, 400);
  await p.getByRole("button", { name: "No es de este trabajo" }).click(); await espera(p, 300);
  await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await espera(p);
  ok("inv-84 con la factura del mismo importe sin ligar, emitir otra factura no se deja (la base la rechaza) y se dice por qué", await continuar(p).isDisabled() && await ve(p, /la base no deja emitir otra factura por \$66,004\.00/));
});
await caso("inv-85 el foco tras la pregunta de cambiar el tipo", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await tipo(p, "Remisión").click(); await espera(p, 300);
  await p.getByRole("button", { name: "No, cancelar" }).click(); await espera(p, 400);
  ok("inv-85 al cerrar «¿Cambiar el tipo?», el foco regresa al diálogo (no al fondo)", (await enDialogo(p)) === "invoice-modal-title", "foco en " + await enDialogo(p));
});
await caso("inv-86 el foco tras un error", "falla=1", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await continuar(p).click(); await espera(p, 700);
  await final(p).click(); await espera(p, 800);
  const rol = await p.evaluate(() => document.activeElement?.getAttribute("role"));
  ok("inv-86 si la base rechaza, el foco va al aviso del error, dentro del diálogo", rol === "alert" && (await enDialogo(p)) === "invoice-modal-title", "rol=" + rol);
});
await caso("inv-87 «Facturar por partes» con algo capturado", "anticipo=otro", async p => {
  await inv(p); await espera(p, 400); await tipo(p, "Factura").click(); await espera(p); await pagada(p);
  await p.getByRole("button", { name: /Facturar por partes/ }).click(); await espera(p, 300);
  ok("inv-87 con un pago capturado, «Facturar por partes» pregunta antes de tirarlo", (await cuenta(p, "inv:partes")) === 0 && (await p.getByRole("dialog", { name: /Facturar por partes/ }).count()) === 1);
});
await caso("inv-88 decidir si se liga, con qué compararla", "anticipo=mismo", async p => {
  await inv(p); await espera(p, 400);
  const pregunta = await ve(p, /F-9135 es del mismo importe: ¿es la factura de este trabajo\?/);
  const compara = await ve(p, /Esta orden/) && await ve(p, /P-0600/);
  const b = await p.getByRole("button", { name: "No es de este trabajo" }).boundingBox();
  ok("inv-88 el aviso pregunta si es de este trabajo, pone la orden junto a F-9135, y «No es de este trabajo» es un botón (≥ 32 px)", pregunta && compara && !!b && b.height >= 32, `pregunta=${pregunta} · compara=${compara} · alto=${b && Math.round(b.height)}`);
});
await caso("inv-89 «Parcial» que cubre el total", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p);
  await p.getByRole("button", { name: "Parcial", exact: true }).click(); await p.getByRole("radio", { name: "Transferencia" }).first().click();
  await p.getByLabel("Monto del pago 1").fill("66004"); await espera(p, 200);
  ok("inv-89 «Parcial» por el total no dice «Cubierto» y la razón manda a «Pagada»", !(await ve(p, /✓?\s*Cubierto/)) && await ve(p, /elige «Pagada»/));
});
await caso("inv-90 el botón final dice lo que hace", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagoNo(p).click(); await continuar(p).click(); await espera(p, 700);
  ok("inv-90 el botón final dice «Emitir y entregar» (no «Confirmar»)", (await p.getByRole("button", { name: /^Emitir y entregar/ }).count()) === 1 && (await p.getByRole("button", { name: /^Confirmar$/ }).count()) === 0);
});
await caso("inv-91 la instrucción no es un aviso", "", async p => {
  await inv(p); await espera(p, 300);
  const c = await colores(p.getByText(/Elige si es factura o remisión/).first());
  ok("inv-91 «Elige si es factura o remisión.» va en gris (instrucción), no en ámbar de aviso", !["rgb(180, 83, 9)", "rgb(229, 138, 18)", "rgb(255, 149, 0)"].includes(c.fg), c.fg);
});
await caso("inv-92 sin precio, «No pagada» sola", "precio0=1", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p, 300);
  ok("inv-92 sin precio, «No pagada» queda elegida sola y se puede continuar", (await pagoNo(p).getAttribute("aria-pressed")) === "true" && !(await continuar(p).isDisabled()));
});
await caso("inv-93 Cuadra queda «En stock»", "cliente=cuadra", async p => {
  await inv(p); await p.getByRole("button", { name: /^Sin factura · Stock/ }).click(); await espera(p, 400); await continuar(p).click(); await espera(p, 700);
  ok("inv-93 la vista previa de Cuadra dice que queda «En stock» (no «Entregada»)", await ve(p, /En stock/) && !(await ve(p, /quedará Entregada/)));
});
await caso("inv-94 los tipos mientras carga el cliente", "lenta=1", async p => {
  await p.click("#abrir-inv"); await dlgInv(p).waitFor(); await espera(p, 600);
  const c = await colores(tipo(p, "Factura"));
  ok("inv-94 mientras carga el cliente, los tipos apagados no van con opacidad (se leen)", c.opacidad >= 0.99, "opacidad=" + c.opacidad);
});
await caso("inv-95 agregar un pago lleva a él", "", async p => {
  await inv(p); await tipo(p, "Factura").click(); await espera(p); await pagada(p, "40000");
  await p.getByRole("button", { name: /Agregar otro pago/ }).click(); await espera(p, 300);
  const enfocado = await p.evaluate(() => { const a = document.activeElement; return a?.getAttribute("role") === "radio" && /Método de pago 2/.test(a.closest('[role="radiogroup"]')?.getAttribute("aria-label") || ""); });
  ok("inv-95 «Agregar otro pago» deja el foco en el método del pago 2", enfocado);
}, { width: 1366, height: 657 });
await caso("inv-96 Corona negativo en la vista previa", "cliente=corona", async p => {
  await inv(p); await p.getByRole("button", { name: /^Aplicar saldo/ }).click(); await espera(p, 300); await continuar(p).click(); await espera(p, 700);
  ok("inv-96 la vista previa de «Aplicar saldo» repite que el saldo queda negativo", await ve(p, /queda(rá)? negativo/));
});

await browser.close();
const fallas = res.filter(r => r.startsWith("FALLA")).length;
console.log(res.join("\n"));
console.log(`\n${res.length - fallas} pasan, ${fallas} fallan`);
