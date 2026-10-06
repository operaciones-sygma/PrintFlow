// Tratar de ROMPER «Facturar por partes» como usuario (banco de PrintFlow). Cada caso afirma lo que DEBERÍA pasar:
// una FALLA es un bug. Uso: node romper-partes.mjs <dir-capturas> [puerto=5199]
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
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);   // si algo truena al pintar, que falle rápido y no espere 30 s por caso
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#abrir-sig");
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.close();
}
const log = async p => (await p.textContent("#log")) || "";
const cuenta = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref)).length;
const ve = async (p, t) => { const l = p.getByText(t); return (await l.count()) > 0 && await l.first().isVisible(); };
const enDialogo = p => p.evaluate(() => document.activeElement?.closest('[role="dialog"]')?.getAttribute("aria-labelledby") || null);
const espera = (p, ms = 250) => p.waitForTimeout(ms);
async function sig(p) { await p.click("#abrir-sig"); await p.getByRole("dialog", { name: /Facturar siguiente parte/ }).waitFor(); await espera(p, 300); }
async function split(p) { await p.click("#abrir-split"); await p.getByRole("dialog", { name: /Facturar por partes/ }).waitFor(); await espera(p, 400); }
async function cancelar(p, ultima) { await p.click(ultima ? "#abrir-cancel-ultima" : "#abrir-cancel"); await p.getByRole("dialog", { name: /Cancelar la parte/ }).waitFor(); await espera(p, 150); }
const facturarBtn = p => p.getByRole("button", { name: "Facturar", exact: true });
const crearBtn = p => p.getByRole("button", { name: /^Crear \d+ folios?/ });
const faltas = async p => { const l = p.getByText(/Falta para crear los folios/); return (await l.count()) ? (await l.first().locator("xpath=..").textContent()) : ""; };
const dosPartes = async (p, a = "2500", b = "2500") => { await p.getByLabel("Cantidad de la parte 1").fill(a); await p.getByLabel("Cantidad de la parte 2").fill(b); await espera(p, 150); };

// ───────────── Facturar siguiente parte
await caso("sig-01 subtotal mayor que el resto", "", async p => {
  await sig(p); await p.locator("#sp-subtotal").fill("99999"); await espera(p);
  ok("sig-01 subtotal mayor que el resto: lo dice y no deja facturar", await ve(p, /no más de \$34,140\.00/) && await facturarBtn(p).isDisabled());
});
await caso("sig-02 subtotal negativo", "", async p => {
  await sig(p); await p.locator("#sp-subtotal").fill("-5"); await espera(p);
  ok("sig-02 subtotal negativo: lo dice y no deja facturar", await ve(p, /mayor a cero/) && await facturarBtn(p).isDisabled());
});
await caso("sig-03 tres decimales", "", async p => {
  await sig(p); await p.locator("#sp-subtotal").fill("100.005"); await espera(p);
  const resumen = await p.getByText(/Se emite/).first().textContent();
  const m = /una factura por \$([\d,]+\.\d{2})/.exec(resumen || "");
  await facturarBtn(p).click(); await espera(p, 400);
  const lg = (await log(p)).split("\n").find(l => l.startsWith("sig:confirm")) || "";
  const enviado = Number((/"amount":([\d.]+)/.exec(lg) || [])[1]);
  const esperado = (Math.round(enviado * 116) / 100).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  ok("sig-03 tres decimales: el resumen dice lo que se manda", m && m[1] === esperado, `resumen $${m && m[1]} · se manda ${enviado} (=$${esperado} con IVA)`);
});
await caso("sig-04 cero piezas", "", async p => {
  await sig(p); await p.locator("#sp-subtotal").fill("10000"); await p.locator("#sp-piezas").fill("0"); await espera(p);
  ok("sig-04 parte con 0 piezas: lo dice y no deja facturar", await ve(p, /Entre 1 y 2,999/) && await facturarBtn(p).isDisabled());
});
await caso("sig-05 todas las piezas con una parte del dinero", "", async p => {
  await sig(p); await p.locator("#sp-subtotal").fill("10000"); await p.locator("#sp-piezas").fill("3000"); await espera(p);
  ok("sig-05 parte del dinero con todas las piezas: lo dice y no deja", await ve(p, /Entre 1 y 2,999/) && await facturarBtn(p).isDisabled());
});
await caso("sig-06 una sola pieza", "unapieza=1", async p => {
  await sig(p);
  ok("sig-06 una sola pieza: sólo completo", await p.locator("#sp-subtotal").isDisabled() && await ve(p, /una sola pieza/) && !(await facturarBtn(p).isDisabled()));
});
await caso("sig-07 sin candidatas", "candidatas=0", async p => {
  await sig(p); await p.getByRole("button", { name: /ya tiene factura: ligarla/ }).click(); await espera(p, 300);
  const dice = await ve(p, /no tiene facturas ni remisiones sin orden/);
  await p.getByRole("button", { name: "Mejor facturar normal" }).click(); await espera(p);
  ok("sig-07 sin candidatas: lo dice y se puede volver a facturar normal", dice && await p.getByRole("button", { name: /ya tiene factura: ligarla/ }).isVisible());
});
await caso("sig-08 candidata que no cabe", "", async p => {
  await sig(p); await p.getByRole("button", { name: /ya tiene factura: ligarla/ }).click(); await espera(p, 300);
  ok("sig-08 la factura que rebasa el resto no se puede elegir", await p.getByRole("button", { name: /F-131/ }).isDisabled());
});
await caso("sig-09 folio con cero a la izquierda", "emisor=off", async p => {
  await sig(p); await p.locator("#sp-folio").fill("F-0123"); await espera(p);
  ok("sig-09 emisor apagado, folio F-0123: no deja Y dice por qué", await facturarBtn(p).isDisabled() && await ve(p, /ceros a la izquierda/));
});
await caso("sig-10 folio de remisión en una factura", "emisor=off", async p => {
  await sig(p); await p.locator("#sp-folio").fill("RS-12"); await espera(p);
  ok("sig-10 emisor apagado, factura con RS-12: no deja Y dice por qué", await facturarBtn(p).isDisabled() && await ve(p, /factura lleva folio F- o D-/));
});
await caso("sig-18 histórica con emisor apagado", "historica=1&emisor=off", async p => {
  await sig(p);
  const ph = await p.locator("#sp-folio").getAttribute("placeholder");
  ok("sig-18 histórica con emisor apagado: pide el folio de Alpha", /D-/.test(ph || "") && /Alpha/.test(ph || ""), "placeholder=" + ph);
});
await caso("sig-19 Esc mientras guarda", "", async p => {
  await sig(p); await facturarBtn(p).click(); await p.keyboard.press("Escape"); await espera(p, 500);
  ok("sig-19 Esc mientras guarda no cierra a medias", (await cuenta(p, "sig:confirm")) === 1 && (await cuenta(p, "sig:cerrado")) === 0);
});
await caso("sig-21 elegir una factura y arrepentirse", "", async p => {
  await sig(p); await p.locator("#sp-subtotal").fill("10000"); await espera(p);
  await p.getByRole("button", { name: /ya tiene factura: ligarla/ }).click(); await espera(p, 300);
  await p.getByRole("button", { name: "Mejor facturar normal" }).click(); await espera(p);
  const sinElegir = await p.locator("#sp-subtotal").inputValue();
  await p.getByRole("button", { name: /ya tiene factura: ligarla/ }).click(); await espera(p, 300);
  await p.getByRole("button", { name: /F-90/ }).click(); await espera(p);
  await p.getByRole("button", { name: "Mejor facturar normal" }).click(); await espera(p);
  ok("sig-21 arrepentirse sin elegir respeta lo tecleado; habiendo elegido, vuelve a todo lo que queda", sinElegir === "10000" && (await p.locator("#sp-subtotal").inputValue()) === "34140" && (await p.locator("#sp-piezas").inputValue()) === "3000", `sin elegir=${sinElegir} · tras elegir=${await p.locator("#sp-subtotal").inputValue()}/${await p.locator("#sp-piezas").inputValue()}`);
});
await caso("sig-20 Tab empieza en el primer control", "", async p => {
  await sig(p); await p.keyboard.press("Tab");
  const t = await p.evaluate(() => document.activeElement?.textContent?.trim());
  ok("sig-20 el primer Tab va a «Todo lo que queda»", t === "Todo lo que queda", "foco=" + t);
});
await caso("sig-11 la base responde con error", "falla=1", async p => {
  await sig(p); await facturarBtn(p).click(); await espera(p, 500);
  const alerta = p.getByRole("alert");
  ok("sig-11 error de la base: lo enseña, el modal sigue y se puede reintentar", (await alerta.count()) === 1 && /rechazó/.test(await alerta.textContent()) && await p.getByRole("dialog", { name: /Facturar siguiente parte/ }).isVisible() && !(await facturarBtn(p).isDisabled()));
});
await caso("sig-12 histórica: sólo ligar", "historica=1", async p => {
  await sig(p);
  ok("sig-12 orden histórica con emisor: la caja de ligar abierta y sin «Mejor facturar normal»", await ve(p, /viene del histórico/) && (await p.getByRole("button", { name: "Mejor facturar normal" }).count()) === 0 && await p.getByRole("button", { name: /F-90/ }).isVisible());
});
await caso("sig-13 histórica: clic fuera con una factura elegida", "historica=1", async p => {
  await sig(p); await p.getByRole("button", { name: /F-77/ }).click(); await espera(p); await p.mouse.click(8, 8); await espera(p);
  ok("sig-13 elegida una factura para ligar, el clic fuera no la tira", await p.getByRole("dialog", { name: /Facturar siguiente parte/ }).isVisible());
});
await caso("sig-14 Esc dentro de un campo / fuera", "", async p => {
  await sig(p); await p.locator("#sp-subtotal").click(); await p.keyboard.press("Escape"); await espera(p);
  const sigue = await p.getByRole("dialog", { name: /Facturar siguiente parte/ }).isVisible();
  await p.getByRole("heading", { name: /Facturar siguiente parte/ }).click(); await p.keyboard.press("Escape"); await espera(p);
  ok("sig-14 Esc dentro del campo no cierra; fuera del campo, sí", sigue && (await cuenta(p, "sig:cerrado")) === 1);
});
await caso("sig-15 doble clic en Facturar", "", async p => {
  await sig(p); await facturarBtn(p).dblclick(); await espera(p, 700);
  ok("sig-15 doble clic en Facturar manda UNA vez", (await cuenta(p, "sig:confirm")) === 1, "veces=" + await cuenta(p, "sig:confirm"));
});
await caso("sig-16 Tab y Mayús+Tab no se salen del diálogo", "", async p => {
  await sig(p);
  await p.keyboard.press("Shift+Tab"); const a = await enDialogo(p);
  for (let i = 0; i < 12; i++) await p.keyboard.press("Tab");
  const b = await enDialogo(p);
  ok("sig-16 el teclado no se sale del diálogo", a === "dlg-siguiente-parte-titulo" && b === "dlg-siguiente-parte-titulo", `Mayús+Tab→${a} · 12×Tab→${b}`);
});
await caso("sig-17 el confirm de ligar atrapa el teclado", "", async p => {
  await sig(p); await p.getByRole("button", { name: /ya tiene factura: ligarla/ }).click(); await espera(p, 300);
  await p.getByRole("button", { name: /F-90/ }).click(); await p.getByRole("button", { name: "Ligar", exact: true }).click();
  await p.getByRole("dialog", { name: /Ligar F-90/ }).waitFor();
  for (let i = 0; i < 3; i++) await p.keyboard.press("Tab");
  ok("sig-17 dentro del confirm, Tab no se va al modal de abajo", (await enDialogo(p)) === "dlg-confirm-titulo", "foco en " + await enDialogo(p));
});

// ───────────── Facturar por partes
await caso("spl-01 veinte partes", "", async p => {
  await split(p); await p.getByLabel("Número de partes").fill("20"); await espera(p, 300);
  const box = await crearBtn(p).boundingBox();
  await p.screenshot({ path: OUT + "/spl-01-veinte.png" });
  ok("spl-01 20 partes: están las 20 y «Crear» se ve sin scroll", (await p.getByLabel("Cantidad de la parte 20").count()) === 1 && box && box.y + box.height <= 768, "botón y=" + (box && Math.round(box.y)));
});
await caso("spl-02 de 20 a 2 con datos", "", async p => {
  await split(p); await p.getByLabel("Número de partes").fill("20"); await espera(p);
  await p.getByLabel("Cantidad de la parte 5").fill("10");
  await p.getByRole("button", { name: "2", exact: true }).click();
  const conf = p.getByRole("dialog", { name: /Quitar las últimas 18 partes/ }); await conf.waitFor();
  await p.getByRole("button", { name: "Quitar 18 partes" }).click(); await espera(p);
  ok("spl-02 bajar de 20 a 2 con datos pregunta y luego quita", (await p.getByLabel("Cantidad de la parte 3").count()) === 0);
});
await caso("spl-03 el resto en medio", "", async p => {
  await split(p); await p.getByRole("button", { name: "3", exact: true }).click();
  await p.getByLabel("Tipo de la parte 1").selectOption("por_facturar"); await p.getByLabel("Cantidad de la parte 1").fill("100"); await espera(p);
  ok("spl-03 «Después» en medio: lo dice", /va al final/.test(await faltas(p)), await faltas(p));
});
await caso("spl-04 dos restos", "", async p => {
  await split(p); await p.getByRole("button", { name: "3", exact: true }).click();
  await p.getByLabel("Tipo de la parte 2").selectOption("por_facturar"); await p.getByLabel("Tipo de la parte 3").selectOption("por_facturar");
  await p.getByLabel("Cantidad de la parte 1").fill("100"); await espera(p);
  ok("spl-04 dos «Después»: lo dice", /sólo puede haber una/.test(await faltas(p)), await faltas(p));
});
await caso("spl-05 todo después, sin cantidades", "", async p => {
  await split(p);
  await p.getByLabel("Tipo de la parte 1").selectOption("por_facturar"); await p.getByLabel("Tipo de la parte 2").selectOption("por_facturar"); await espera(p);
  ok("spl-05 todo «Después» aunque no haya cantidades: lo dice (no sólo «reparte las piezas»)", /al menos una parte se factura hoy/.test(await faltas(p)), (await faltas(p)) || "(sólo la pista neutra)");
});
await caso("spl-06 Corona sin saldo suficiente", "corona=1", async p => {
  await split(p); await p.getByLabel("Tipo de la parte 1").selectOption("corona_saldo"); await p.getByLabel("Cantidad de la parte 1").fill("3000"); await espera(p);
  ok("spl-06 saldo Corona que no alcanza: lo dice", /saldo Corona no alcanza por \$4,140\.00/.test(await faltas(p)) && await ve(p, /Faltan \$4,140\.00/), await faltas(p));
});
await caso("spl-07 sin Corona no hay saldo Corona", "", async p => {
  await split(p);
  ok("spl-07 cliente normal: no ofrece «Saldo Corona»", (await p.getByLabel("Tipo de la parte 1").locator("option[value=corona_saldo]").count()) === 0);
});
await caso("spl-08 ligar sin escribir el folio", "", async p => {
  await split(p); await p.getByRole("button", { name: "Ya tiene factura: ligarla" }).first().click(); await dosPartes(p);
  const f = await faltas(p);
  ok("spl-08 ligar con el folio vacío: dice que falta el folio (no que «no se lee»)", /falta (escribir )?el folio/i.test(f) && !/no se lee/.test(f), f);
});
await caso("spl-09 el mismo folio dos veces", "", async p => {
  await split(p); const l = p.getByRole("button", { name: "Ya tiene factura: ligarla" });
  await l.first().click(); await l.first().click(); await espera(p);
  await p.getByLabel("Folio de la parte 1").fill("F-12"); await p.getByLabel("Folio de la parte 2").fill("F-12"); await dosPartes(p);
  ok("spl-09 folio repetido: lo dice", /repetido/.test(await faltas(p)), await faltas(p));
});
await caso("spl-10 serie de remisión en una factura", "", async p => {
  await split(p); await p.getByRole("button", { name: "Ya tiene factura: ligarla" }).first().click();
  await p.getByLabel("Folio de la parte 1").fill("RS-5"); await dosPartes(p);
  ok("spl-10 factura con RS-: lo dice", /serie del otro tipo/.test(await faltas(p)), await faltas(p));
});
await caso("spl-11 histórica: el folio es el de Alpha", "historica=1", async p => {
  await split(p);
  const ph = await p.getByLabel("Folio de la parte 1").getAttribute("placeholder");
  ok("spl-11 orden histórica: el campo pide el folio de Alpha (D-/R-), no un F-", /D-/.test(ph || "") && !/F-/.test(ph || ""), "placeholder=" + ph);
});
await caso("spl-12 emisor apagado no truena", "emisor=off", async p => {
  await split(p); await dosPartes(p);
  ok("spl-12 emisor apagado: folios sugeridos y sin errores", (await p.getByLabel("Folio de la parte 1").inputValue()).length > 2);
});
await caso("spl-13 anticipados sin razón", "", async p => {
  await split(p); await dosPartes(p); await p.getByRole("button", { name: /Folios anticipados/ }).click();
  await p.getByRole("checkbox").check(); await espera(p);
  const antes = /por qué se anticipan/.test(await faltas(p));
  await p.locator("#split-razon-anticipo").fill("abc"); await espera(p);
  ok("spl-13 anticipados: pide la razón y con 3 letras ya no", antes && !/por qué se anticipan/.test(await faltas(p)) && !(await crearBtn(p).isDisabled()));
});
await caso("spl-14 doble clic en Crear", "folioexiste=0", async p => {
  await split(p); await dosPartes(p); await crearBtn(p).dblclick(); await espera(p, 800);
  ok("spl-14 doble clic en Crear manda UNA vez", (await cuenta(p, "split:intento")) === 1, "veces=" + await cuenta(p, "split:intento"));
});
await caso("spl-15 Esc con el plan capturado", "", async p => {
  await split(p); await dosPartes(p); await p.getByRole("button", { name: /Dividir igual entre 2/ }).click(); await espera(p);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const sigue = await p.getByRole("dialog", { name: /Facturar por partes/ }).isVisible();
  const pregunta = p.getByRole("dialog", { name: /Cerrar sin crear los folios/ });
  const pregunto = (await pregunta.count()) === 1;
  await p.keyboard.press("Escape"); await espera(p, 300);
  const sigueTrasNo = (await pregunta.count()) === 0 && (await p.getByLabel("Cantidad de la parte 2").inputValue()) === "2500";
  await p.getByRole("heading", { name: /Facturar por partes/ }).click(); await p.keyboard.press("Escape"); await pregunta.waitFor();
  await p.getByRole("button", { name: "Cerrar sin crear" }).click(); await espera(p, 300);
  ok("spl-15 Esc con un plan capturado pregunta; Esc a la pregunta lo deja; «Cerrar sin crear» cierra", sigue && pregunto && sigueTrasNo && (await cuenta(p, "split:cerrado")) === 1);
});
await caso("spl-22 Esc sin nada capturado", "", async p => {
  await split(p); await p.keyboard.press("Escape"); await espera(p, 300);
  ok("spl-22 Esc con el plan vacío cierra sin preguntar", (await cuenta(p, "split:cerrado")) === 1);
});
await caso("spl-21 ligar y arrepentirse", "", async p => {
  await split(p); await p.getByRole("button", { name: "Ya tiene factura: ligarla" }).first().click(); await dosPartes(p);
  await p.getByRole("button", { name: "mejor que se asigne solo" }).click(); await espera(p);
  ok("spl-21 «mejor que se asigne solo» quita el aviso del folio y deja crear", !/folio/.test(await faltas(p)) && !(await crearBtn(p).isDisabled()), await faltas(p));
});
await caso("spl-16 monitor 1920", "", async p => {
  await split(p); await p.getByRole("button", { name: "3", exact: true }).click(); await p.getByLabel("Cantidad de la parte 1").fill("2000"); await espera(p);
  await p.screenshot({ path: OUT + "/spl-16-1920.png" });
  ok("spl-16 a 1920 se arma sin errores", true);
}, { width: 1920, height: 1080 });
await caso("spl-17 cuadrar", "", async p => {
  await split(p); await dosPartes(p, "2000", "2000");
  await p.getByRole("button", { name: /^Cuadrar/ }).first().click(); await espera(p);
  ok("spl-17 «Cuadrar» deja el plan listo para crear", !(await crearBtn(p).isDisabled()), await faltas(p));
});
await caso("spl-18 saldo a favor", "saldo=1", async p => {
  await split(p);
  ok("spl-18 con saldo a favor sale el aviso (sin raya larga)", await ve(p, /no lo descuenta/) && !(await ve(p, /—/)));
});
await caso("spl-19 Mayús+Tab no se sale", "", async p => {
  await split(p); await p.keyboard.press("Shift+Tab");
  ok("spl-19 Mayús+Tab al abrir no se va al tablero de atrás", (await enDialogo(p)) === "dlg-split-titulo", "foco en " + await enDialogo(p));
});
await caso("spl-20 la base rechaza", "falla=1&folioexiste=0", async p => {
  await split(p); await dosPartes(p); await crearBtn(p).click(); await espera(p, 500);
  ok("spl-20 si la base rechaza, el plan sigue ahí para reintentar", (await cuenta(p, "toast:error")) === 1 && await p.getByRole("dialog", { name: /Facturar por partes/ }).isVisible() && (await p.getByLabel("Cantidad de la parte 2").inputValue()) === "2500" && !(await crearBtn(p).isDisabled()));
});

// ───────────── Cancelar la parte
await caso("can-01 razón corta", "", async p => {
  await cancelar(p, false); await p.getByText("Vuelve a quedar por facturar").click(); await p.getByLabel("¿Por qué se cancela?").fill("abc");
  const b = p.getByRole("button", { name: /^Cancelar la parte/ }); const corto = await b.isDisabled();
  await p.getByLabel("¿Por qué se cancela?").fill("abcde");
  ok("can-01 razón de menos de 5: no deja; con 5, sí", corto && !(await b.isDisabled()));
});
await caso("can-02 la base rechaza", "falla=1", async p => {
  await cancelar(p, false); await p.getByText("Vuelve a quedar por facturar").click(); await p.getByLabel("¿Por qué se cancela?").fill("se facturó mal");
  await p.getByRole("button", { name: /^Cancelar la parte/ }).click(); await espera(p, 500);
  ok("can-02 error de la base: lo enseña y se puede reintentar", (await p.getByRole("alert").count()) === 1 && !(await p.getByRole("button", { name: /^Cancelar la parte/ }).isDisabled()));
});
await caso("can-03 no es la última", "", async p => {
  await cancelar(p, false); await p.getByText("Se da por perdido").click(); await p.getByLabel("¿Por qué se cancela?").fill("se facturó mal");
  ok("can-03 parte que no es la última + perder: el botón NO dice que cancela la orden", (await p.getByRole("button", { name: "Cancelar la parte", exact: true }).count()) === 1);
});
await caso("can-04 Esc al abrir", "", async p => {
  await cancelar(p, true); await p.keyboard.press("Escape"); await espera(p);
  ok("can-04 Esc al abrir cierra", (await cuenta(p, "cancel:cerrado")) === 1);
});
await caso("can-06 doble clic en cancelar", "", async p => {
  await cancelar(p, false); await p.getByText("Vuelve a quedar por facturar").click(); await p.getByLabel("¿Por qué se cancela?").fill("se facturó mal");
  await p.getByRole("button", { name: /^Cancelar la parte/ }).dblclick(); await espera(p, 700);
  ok("can-06 doble clic en «Cancelar la parte» manda UNA vez", (await cuenta(p, "cancel:confirm")) === 1, "veces=" + await cuenta(p, "cancel:confirm"));
});
await caso("can-07 radio elegido + Mayús+Tab", "", async p => {
  await cancelar(p, true); await p.getByText("Se da por perdido").click();
  for (let i = 0; i < 2; i++) await p.keyboard.press("Shift+Tab");
  ok("can-07 con un radio elegido, Mayús+Tab no se sale", (await enDialogo(p)) === "dlg-cancelar-parte-titulo", "foco en " + await enDialogo(p));
});
await caso("can-05 Mayús+Tab no se sale", "", async p => {
  await cancelar(p, true); for (let i = 0; i < 3; i++) await p.keyboard.press("Shift+Tab");
  ok("can-05 el teclado no se sale del diálogo", (await enDialogo(p)) === "dlg-cancelar-parte-titulo", "foco en " + await enDialogo(p));
});

await browser.close();
const fallas = res.filter(r => r.startsWith("FALLA")).length;
console.log(res.join("\n"));
console.log(`\n${res.length - fallas} pasan, ${fallas} fallan`);
