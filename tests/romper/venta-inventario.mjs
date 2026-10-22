// Tratar de ROMPER la «VENTA DESDE INVENTARIO» (el carrito de Cuadra) y el precio de cada producto del catálogo. v10.84.167 (Marcelo, 22-oct-2026:
// «me llamó la atención que PrintFlow infle el precio por dividirlos… podemos asustar al cliente»): el carrito pedía UN total y la base lo repartía por
// piezas (F-77: la etiqueta, los soportes, la tarjeta y el papel de china a $1.23 cada uno). Cada caso afirma lo que DEBERÍA pasarle a Karla: una FALLA
// es un bug. Vuelta 1: escritas antes del arreglo.
// En el banco (como en producción el 22-oct): el apartado de Cuadra con MANUFACTURERA, TIENDAS y FABRICA DE ALTA CALIDAD; China blanco (relleno) por kilo
// (80 hojas/kg) a $40 el kg, China impreso a $0.62, Etiqueta colgante a $2.10, Soporte 3-25 a $3.41 y el Cordón sin precio de lista.
// Uso: node venta-inventario.mjs <dir-capturas> [puerto=5492]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5492);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
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
    page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.getByText("Inventario Cuadra").first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(400);
    await fn(page);
    const nativos = (await lineas(page, "alert:")).concat(await lineas(page, "confirm:"));
    if (nativos.length) ok(nombre + " · diálogo nativo", false, nativos.join(" ; ").slice(0, 200));
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png" }).catch(() => {});
  await ctx.close();
}
const log = async p => (await p.textContent("#log")) || "";
const lineas = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref));
const espera = (p, ms = 250) => p.waitForTimeout(ms);
const ventas = async p => (await lineas(p, "db bulkSellFromStock ")).map(l => JSON.parse(l.slice("db bulkSellFromStock ".length)));
const guardados = async p => (await lineas(p, "db guardarPrecioDeProducto ")).map(l => { const r = l.slice("db guardarPrecioDeProducto ".length); const i = r.indexOf(" "); return { id: r.slice(0, i), cambios: JSON.parse(r.slice(i + 1)) }; });
const altas = async p => (await lineas(p, "db saveClientProduct ")).map(l => JSON.parse(l.slice("db saveClientProduct ".length)));
// El carrito por su título (antes de v10.84.167 era role=dialog sin nombre): así la vuelta 1 falla por lo que falta, no por cómo se encuentra.
// 🔧 Corregido en la vuelta 1: filtraba por el TEXTO «Carrito de venta», que también tiene el botón del inventario (otro role=dialog): con el carrito
//   cerrado seguía contando 1 y vin-09/vin-11 no podían pasar nunca. Ahora, el diálogo cuyo título dice «Carrito de venta».
const carrito = p => p.locator('[role="dialog"]').filter({ has: p.locator("h3", { hasText: "Carrito de venta" }) }).last();
const abrirCarrito = async p => { await p.getByRole("button", { name: /Carrito de venta/ }).click(); await carrito(p).waitFor(); await espera(p, 350); };
// El catálogo del carrito: el renglón del producto (su nombre en su propio div) y su «+ Agregar», DENTRO del carrito.
// 🔧 Corregido en la vuelta 1: buscado en toda la página, el nombre del producto en la tarjeta del inventario (detrás) subía hasta un contenedor con TODOS
//   los «Agregar» y se tomaba el primero: «Etiqueta colgante» agregaba otro producto.
const agregar = async (p, nombre) => {
  const b = carrito(p).locator(`xpath=.//div[normalize-space(text())="${nombre}"]/ancestor::div[.//button[contains(., "Agregar")]][1]//button[contains(., "Agregar")]`).first();
  await b.click(); await espera(p, 150);
};
// 🔧 Esc dentro de un campo de texto o una lista no cierra nada en la app (la regla del escStack: es de su lista): se suelta el campo antes de Esc
const esc = async p => { await p.evaluate(() => document.activeElement?.blur?.()); await p.keyboard.press("Escape"); await espera(p, 300); };
const kilos = async (p, nombre, v) => { await p.getByLabel(new RegExp("^Kilos de " + nombre.replace(/[()]/g, "\\$&"))).fill(String(v)); await espera(p, 120); };
const piezas = async (p, nombre, v) => { await p.getByLabel(new RegExp("^Piezas de " + nombre.replace(/[()]/g, "\\$&"))).fill(String(v)); await espera(p, 120); };
const precio = async (p, nombre, v) => { await p.getByLabel(new RegExp("^Precio de " + nombre.replace(/[()]/g, "\\$&"))).fill(String(v)); await espera(p, 120); };
const precioDe = (p, nombre) => p.getByLabel(new RegExp("^Precio de " + nombre.replace(/[()]/g, "\\$&")));
const elegirCliente = async (p, nombre = "MANUFACTURERA DE BOTAS CUADRA") => {
  const s = p.locator("select").filter({ has: p.locator("option", { hasText: "MANUFACTURERA" }) }).first();
  await s.selectOption({ label: nombre }); await espera(p, 300);
};
const botonVender = p => carrito(p).getByRole("button", { name: /^(Vender|Vender y facturar)/ });
const textoDe = async loc => ((await loc.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
const dinero = s => Number(String(s).replace(/[^\d.]/g, ""));
const pesos = n => "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Una venta de dos productos lista para vender: 500 kg de China blanco y 10,000 etiquetas a MANUFACTURERA
const ventaTipica = async p => {
  await abrirCarrito(p);
  await agregar(p, "China blanco (relleno)"); await agregar(p, "Etiqueta colgante");
  await kilos(p, "China blanco (relleno)", 500); await piezas(p, "Etiqueta colgante", 10000);
  await elegirCliente(p);
};
const sinAA = (p, sel = null) => p.evaluate(sel => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const malos = [];
  const raiz = (sel && document.querySelector(sel)) || document.querySelector('[role="dialog"][aria-label^="Carrito"], [role="dialog"][aria-labelledby="pf-venta-titulo"]') || document.getElementById("root");
  for (const el of raiz.querySelectorAll("*")) {
    if (el.closest("#log,#barra,input,textarea,select,option")) continue;
    const t = propio(el); if (!t || !el.getClientRects().length) continue;
    const s = getComputedStyle(el); if (s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    if (el.closest("button[disabled]")) continue;
    const a = lum(nums(s.color)), b = lum(fondo(el)), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (k < (grande ? 3 : 4.5) || parseFloat(s.fontSize) < 10) malos.push(t.slice(0, 26) + " " + k.toFixed(1) + (parseFloat(s.fontSize) < 10 ? " (" + s.fontSize + ")" : ""));
  }
  return [...new Set(malos)];
}, sel);

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("vin-01-cada-renglon-con-su-precio", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "China blanco (relleno)"); await agregar(p, "Etiqueta colgante");
  const pb = await precioDe(p, "China blanco (relleno)").count() ? await precioDe(p, "China blanco (relleno)").inputValue() : null;
  const pe = await precioDe(p, "Etiqueta colgante").count() ? await precioDe(p, "Etiqueta colgante").inputValue() : null;
  const etqKg = pb != null ? await precioDe(p, "China blanco (relleno)").getAttribute("aria-label") : "";
  const etqPz = pe != null ? await precioDe(p, "Etiqueta colgante").getAttribute("aria-label") : "";
  ok("vin-01-cada-renglon-con-su-precio", Number(pb) === 40 && Number(pe) === 2.1 && /kilo|kg/i.test(etqKg) && /pieza/i.test(etqPz),
    pb == null ? "los renglones del carrito NO tienen precio (sólo se captura un total)" : `precio del papel ${pb} («${etqKg}»), de la etiqueta ${pe} («${etqPz}»); deben venir del precio de lista: 40 por kilo y 2.10 por pieza`);
});
await caso("vin-02-manda-el-importe-de-cada-producto", "", async p => {
  await ventaTipica(p);
  const b = botonVender(p); const habil = await b.count() ? await b.isEnabled() : false;
  if (habil) { await b.click(); await espera(p, 600); }
  const v = (await ventas(p))[0];
  const imp = v ? v.items.map(i => i.amount) : [];
  ok("vin-02-manda-el-importe-de-cada-producto", !!v && imp[0] === 20000 && imp[1] === 21000 && Math.abs(v.total_amount - 47560) < 0.005 && v.invoice_type === "factura",
    !v ? (habil ? "no se mandó la venta" : "el botón de vender no se habilita sin teclear un total") : `importes ${JSON.stringify(imp)} (deben 20,000 = 500 kg × $40 y 21,000 = 10,000 × $2.10, no repartidos por piezas); total ${v.total_amount} (debe 47,560)`);
});
await caso("vin-03-tres-precios-distintos", "", async p => {
  await abrirCarrito(p);
  for (const n of ["China impreso", "Soporte 3-25 (grande)", "Etiqueta colgante"]) await agregar(p, n);
  await piezas(p, "China impreso", 3000); await piezas(p, "Soporte 3-25 (grande)", 1000); await piezas(p, "Etiqueta colgante", 1000);
  await elegirCliente(p, "TIENDAS CUADRA");
  const b = botonVender(p); if (await b.count() && await b.isEnabled()) { await b.click(); await espera(p, 600); }
  const v = (await ventas(p))[0]; const imp = v ? v.items.map(i => i.amount) : [];
  ok("vin-03-tres-precios-distintos", !!v && imp.join() === "1860,3410,2100" && Math.abs(v.total_amount - 8549.2) < 0.005,
    v ? `importes ${JSON.stringify(imp)} (deben 1,860 · 3,410 · 2,100); total ${v.total_amount} (debe 8,549.20)` : "no se pudo vender con el precio de cada producto");
});
await caso("vin-04-sin-precio-no-vende", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "Cordón para Etiqueta"); await agregar(p, "Etiqueta colgante");
  await piezas(p, "Cordón para Etiqueta", 2000); await piezas(p, "Etiqueta colgante", 1000);
  await elegirCliente(p);
  const b = botonVender(p);
  const antes = await b.count() ? await b.isEnabled() : true;
  const dice = /Falta el precio de Cordón para Etiqueta/i.test(await textoDe(carrito(p)));
  let despues = false;
  if (await precioDe(p, "Cordón para Etiqueta").count()) { await precio(p, "Cordón para Etiqueta", "0.35"); despues = await b.isEnabled(); if (despues) { await b.click(); await espera(p, 600); } }
  const v = (await ventas(p))[0];
  ok("vin-04-sin-precio-no-vende", !antes && dice && despues && !!v && v.items[0].amount === 700,
    `sin precio el botón ${antes ? "SÍ deja vender" : "no deja"}; ${dice ? "dice qué falta" : "NO dice que falta el precio del cordón"}; con $0.35 ${despues ? "deja" : "no deja"}; ${v ? "manda " + v.items[0].amount + " (debe 700)" : "no se vendió"}`);
});
await caso("vin-05-cambiar-el-precio-cambia-el-total", "", async p => {
  await ventaTipica(p);
  if (await precioDe(p, "Etiqueta colgante").count()) await precio(p, "Etiqueta colgante", "2.50");
  const t = await textoDe(carrito(p));
  const b = botonVender(p); if (await b.count() && await b.isEnabled()) { await b.click(); await espera(p, 600); }
  const v = (await ventas(p))[0];
  ok("vin-05-cambiar-el-precio-cambia-el-total", t.includes(pesos(25000)) && t.includes(pesos(52200)) && !!v && v.items[1].amount === 25000 && Math.abs(v.total_amount - 52200) < 0.005,
    `la etiqueta a $2.50: ${t.includes(pesos(25000)) ? "su importe dice $25,000" : "su importe NO dice $25,000"}; ${t.includes(pesos(52200)) ? "el total dice $52,200" : "el total NO dice $52,200"}; ${v ? "manda " + v.items[1].amount + " y " + v.total_amount : "no se vendió"}`);
});
await caso("vin-06-iva-por-renglon", "", async p => {
  // El CFDI suma el IVA renglón por renglón: 1.03 + 1.03 llevan 0.16 + 0.16 = 0.32 (no 0.33 de 2.06 × 16%): total 2.38
  await abrirCarrito(p);
  await agregar(p, "Etiqueta colgante"); await agregar(p, "Soporte 3-25 (grande)");
  await piezas(p, "Etiqueta colgante", 1); await piezas(p, "Soporte 3-25 (grande)", 1);
  if (await precioDe(p, "Etiqueta colgante").count()) { await precio(p, "Etiqueta colgante", "1.03"); await precio(p, "Soporte 3-25 (grande)", "1.03"); }
  await elegirCliente(p);
  const b = botonVender(p); if (await b.count() && await b.isEnabled()) { await b.click(); await espera(p, 600); }
  const v = (await ventas(p))[0];
  ok("vin-06-iva-por-renglon", !!v && Math.abs(v.total_amount - 2.38) < 0.005, v ? `total ${v.total_amount} (debe 2.38: el IVA de cada renglón redondeado, como el CFDI)` : "no se vendió");
});
await caso("vin-07-remision-sin-iva", "", async p => {
  await ventaTipica(p);
  await carrito(p).getByRole("button", { name: /^Remisión$/ }).click(); await espera(p, 300);
  const b = botonVender(p); if (await b.count() && await b.isEnabled()) { await b.click(); await espera(p, 600); }
  const v = (await ventas(p))[0];
  ok("vin-07-remision-sin-iva", !!v && v.invoice_type === "remision" && Math.abs(v.total_amount - 41000) < 0.005, v ? `remisión: total ${v.total_amount} (debe 41,000, sin IVA)` : "no se vendió como remisión");
});
await caso("vin-08-doble-clic-vende-una-vez", "lento=1", async p => {
  await ventaTipica(p);
  const b = botonVender(p); if (await b.count() && await b.isEnabled()) { await b.dblclick(); await espera(p, 2200); }
  const n = (await ventas(p)).length;
  ok("vin-08-doble-clic-vende-una-vez", n === 1, `doble clic en vender: ${n} venta(s) (debe 1)`);
});
await caso("vin-09-esc-con-carrito-pregunta", "", async p => {
  await ventaTipica(p);
  await esc(p);
  const sigue = await carrito(p).count(); const t = await textoDe(p.locator("body"));
  const pregunta = /Salir sin vender/i.test(t);
  let seQueda = false, cierra = false;
  if (pregunta) {
    await p.getByRole("button", { name: /Seguir vendiendo/ }).click(); await espera(p, 250);
    seQueda = (await carrito(p).count()) === 1 && (await precioDe(p, "Etiqueta colgante").count()) === 1;
    await esc(p);
    await p.getByRole("button", { name: /Salir sin vender/ }).click(); await espera(p, 300);
    cierra = (await carrito(p).count()) === 0 && /Inventario Cuadra/.test(await textoDe(p.locator("body")));
  }
  ok("vin-09-esc-con-carrito-pregunta", sigue === 1 && pregunta && seQueda && cierra,
    `Esc con 2 productos en el carrito: ${sigue ? (pregunta ? "pregunta" : "no pregunta") : "CIERRA y se pierde el carrito"}; «Seguir vendiendo» ${seQueda ? "lo deja como estaba" : "no lo deja"}; «Salir sin vender» ${cierra ? "cierra sólo el carrito" : "no cierra"}`);
});
await caso("vin-10-clic-afuera-con-carrito-pregunta", "", async p => {
  await ventaTipica(p);
  await p.mouse.click(8, 300); await espera(p, 300);
  const sigue = await carrito(p).count(); const pregunta = /Salir sin vender/i.test(await textoDe(p.locator("body")));
  ok("vin-10-clic-afuera-con-carrito-pregunta", sigue === 1 && pregunta, `clic afuera con el carrito lleno: ${sigue ? (pregunta ? "pregunta" : "no pregunta") : "CIERRA y se pierde el carrito"}`);
});
await caso("vin-11-carrito-vacio-esc-cierra", "", async p => {
  await abrirCarrito(p);
  await esc(p);
  ok("vin-11-carrito-vacio-esc-cierra", (await carrito(p).count()) === 0 && !/Salir sin vender/i.test(await textoDe(p.locator("body"))), "Esc con el carrito vacío: " + ((await carrito(p).count()) ? "no cierra" : "cierra sin preguntar"));
});
await caso("vin-12-la-base-rechaza", "falla=vender", async p => {
  await ventaTipica(p);
  const b = botonVender(p); if (await b.count() && await b.isEnabled()) { await b.click(); await espera(p, 700); }
  const aviso = await lineas(p, "aviso (error)");
  const sigue = (await carrito(p).count()) === 1 && (await precioDe(p, "Etiqueta colgante").count()) === 1;
  ok("vin-12-la-base-rechaza", (await ventas(p)).length === 1 && aviso.length >= 1 && /Stock insuficiente/.test(aviso.join(" ")) && sigue,
    `la base rechaza: ${aviso.length ? "lo dice («" + aviso[0].slice(0, 90) + "»)" : "no lo dice"}; el carrito ${sigue ? "se queda con lo capturado" : "se pierde"}`);
});
await caso("vin-13-el-producto-dice-su-precio-y-su-nombre-en-la-factura", "", async p => {
  const t = await textoDe(p.getByRole("dialog", { name: /Inventario Cuadra/ }));
  ok("vin-13-el-producto-dice-su-precio-y-su-nombre-en-la-factura", /\$40\.00 el kg|\$40\.00 por kg/.test(t) && /\$2\.10 la pieza|\$2\.10 por pieza/.test(t) && /En la factura: PAPEL KRAFT PARA RELLENAR 25/.test(t) && /Sin precio de lista/.test(t),
    `el catálogo: ${/\$40\.00 (el|por) kg/.test(t) ? "dice $40.00 el kg" : "NO dice el precio por kg"}; ${/\$2\.10 (la|por) pieza/.test(t) ? "$2.10 la pieza" : "NO dice $2.10 la pieza"}; ${/En la factura:/.test(t) ? "dice el nombre en la factura" : "NO dice el nombre en la factura"}; ${/Sin precio de lista/.test(t) ? "el cordón dice que no tiene precio" : "el cordón NO dice que no tiene precio"}`);
});
const abrirPrecio = async (p, nombre) => {
  const b = p.getByRole("button", { name: new RegExp("^Precio y nombre de " + nombre.replace(/[()]/g, "\\$&")) });
  if (!(await b.count())) return false;
  await b.click(); await p.getByRole("dialog", { name: /Precio y nombre/ }).waitFor(); await espera(p, 200); return true;
};
await caso("vin-14-editar-precio-y-nombre", "", async p => {
  const hay = await abrirPrecio(p, "Etiqueta colgante");
  if (hay) {
    const d = p.getByRole("dialog", { name: /Precio y nombre/ });
    await d.getByLabel(/^Precio de lista/).fill("2.20");
    await d.getByLabel(/^Nombre en la factura$/).fill("ETIQUETA COLGANTE CUADRA");
    await d.getByRole("button", { name: /^Guardar/ }).click(); await espera(p, 600);
  }
  const g = (await guardados(p))[0];
  const t = await textoDe(p.getByRole("dialog", { name: /Inventario Cuadra/ }));
  ok("vin-14-editar-precio-y-nombre", hay && !!g && g.id === "pe" && g.cambios.unit_price === 2.2 && g.cambios.specs?.nombre_factura === "ETIQUETA COLGANTE CUADRA" && /\$2\.20 (la|por) pieza/.test(t),
    !hay ? "NO hay «Precio y nombre» en el producto" : g ? `guarda ${JSON.stringify(g.cambios)}; ${/\$2\.20/.test(t) ? "el catálogo ya dice $2.20" : "el catálogo no se actualiza"}` : "no guarda");
});
await caso("vin-15-nombre-por-cliente-sin-perder-los-kilos", "", async p => {
  const hay = await abrirPrecio(p, "China blanco (relleno)");
  let fac = "";
  if (hay) {
    const d = p.getByRole("dialog", { name: /Precio y nombre/ });
    fac = await d.getByLabel(/FABRICA DE ALTA CALIDAD/).inputValue();
    await d.getByLabel(/TIENDAS CUADRA/).fill("PAPEL PARA RELLENO TIENDAS");
    await d.getByRole("button", { name: /^Guardar/ }).click(); await espera(p, 600);
  }
  const g = (await guardados(p))[0]; const s = g?.cambios?.specs || {};
  ok("vin-15-nombre-por-cliente-sin-perder-los-kilos", hay && fac === "PAPEL KRAFT BLANCO PARA RELLENO" && s.nombre_factura_cliente?.["c-tie"] === "PAPEL PARA RELLENO TIENDAS" && s.nombre_factura_cliente?.["c-fac"] === "PAPEL KRAFT BLANCO PARA RELLENO" && s.sell_unit === "kg" && s.units_per_kg === 80,
    !hay ? "NO hay «Precio y nombre»" : `FAC trae «${fac}»; guarda ${JSON.stringify(s)} (debe conservar sell_unit kg y 80 hojas/kg)`);
});
await caso("vin-16-precio-invalido-no-se-guarda", "", async p => {
  const hay = await abrirPrecio(p, "Soporte 3-25 (grande)");
  let habil = true, dice = false;
  if (hay) {
    const d = p.getByRole("dialog", { name: /Precio y nombre/ });
    await d.getByLabel(/^Precio de lista/).fill("-5"); await espera(p, 150);
    habil = await d.getByRole("button", { name: /^Guardar/ }).isEnabled(); dice = /no puede ser negativo|mayor o igual a 0/i.test(await textoDe(d));
  }
  ok("vin-16-precio-invalido-no-se-guarda", hay && !habil && dice && (await guardados(p)).length === 0, !hay ? "NO hay «Precio y nombre»" : `precio −5: ${habil ? "SE PUEDE guardar" : "no se puede guardar"}; ${dice ? "dice por qué" : "no dice por qué"}`);
});
await caso("vin-17-nuevo-producto-con-precio-y-nombre", "", async p => {
  await p.getByRole("button", { name: /Nuevo Producto/ }).click(); await espera(p, 400);
  const sel = p.locator("select").filter({ has: p.locator("option", { hasText: "MANUFACTURERA" }) }).first();
  await sel.selectOption({ label: /MANUFACTURERA/.test(await sel.innerText()) ? (await sel.locator("option", { hasText: "MANUFACTURERA" }).first().innerText()) : "" });
  await p.getByPlaceholder(/Tarjeta Presentación/).fill("Bolsa de papel");
  const conPrecio = await p.getByLabel(/^Precio de lista/).count();
  if (conPrecio) { await p.getByLabel(/^Precio de lista/).fill("4.5"); await p.getByLabel(/^Nombre en la factura$/).fill("BOLSA DE PAPEL CUADRA"); }
  await p.getByRole("button", { name: /^Guardar/ }).click(); await espera(p, 500);
  const a = (await altas(p))[0];
  ok("vin-17-nuevo-producto-con-precio-y-nombre", conPrecio > 0 && !!a && a.unit_price === 4.5 && a.specs?.nombre_factura === "BOLSA DE PAPEL CUADRA",
    conPrecio ? (a ? `da de alta ${JSON.stringify({ unit_price: a.unit_price, specs: a.specs })}` : "no da de alta") : "el producto nuevo NO pide precio de lista ni nombre en la factura");
});
await caso("vin-18-gerardo-y-lupita-no-cambian-precios", "rol=produccion", async p => {
  const g = await p.getByRole("button", { name: /^Precio y nombre/ }).count();
  ok("vin-18-gerardo-y-lupita-no-cambian-precios", g === 0, `Gerardo: ${g} botón(es) de «Precio y nombre» (debe 0)`);
});
await caso("vin-18b-lupita-no-cambia-precios", "rol=secretaria", async p => {
  const g = await p.getByRole("button", { name: /^Precio y nombre/ }).count();
  ok("vin-18b-lupita-no-cambia-precios", g === 0, `Lupita: ${g} botón(es) de «Precio y nombre» (debe 0)`);
});
for (const [ancho, alto] of [[1366, 768], [1920, 1080]]) {
  await caso(`vin-19-cabe-${ancho}`, "", async p => {
    await abrirCarrito(p);
    for (const n of ["China blanco (relleno)", "China impreso", "Etiqueta colgante"]) await agregar(p, n);
    const ancha = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    const r = await (await precioDe(p, "Etiqueta colgante").count() ? precioDe(p, "Etiqueta colgante").boundingBox() : null);
    const malos = await sinAA(p);
    ok(`vin-19-cabe-${ancho}`, !ancha && !!r && r.width >= 60 && malos.length === 0, `${ancho}: ${ancha ? "la página se sale a lo ancho; " : ""}${r ? "el precio mide " + Math.round(r.width) + " px" : "NO hay precio en el renglón"}${malos.length ? "; sin AA: " + malos.slice(0, 6).join(" | ") : ""}`);
  }, { viewport: { width: ancho, height: alto } });
}
await caso("vin-20-la-base-no-guarda-el-precio", "falla=precio", async p => {
  const hay = await abrirPrecio(p, "Etiqueta colgante");
  let sigue = false, aviso = false;
  if (hay) {
    const d = p.getByRole("dialog", { name: /Precio y nombre/ });
    await d.getByLabel(/^Precio de lista/).fill("2.40");
    await d.getByRole("button", { name: /^Guardar/ }).click(); await espera(p, 600);
    sigue = (await p.getByRole("dialog", { name: /Precio y nombre/ }).count()) === 1 && (await d.getByLabel(/^Precio de lista/).inputValue()) === "2.40";
    aviso = /No se guardó|no se pudo guardar/i.test(await textoDe(d)) || (await lineas(p, "aviso (error)")).length > 0;
  }
  ok("vin-20-la-base-no-guarda-el-precio", hay && sigue && aviso, !hay ? "NO hay «Precio y nombre»" : `la base no guarda: ${aviso ? "lo dice" : "no lo dice"}; ${sigue ? "lo escrito se queda" : "lo escrito se pierde"}`);
});

// ── vuelta 2: por donde NO se diseñó (decimales, comas, ceros, kilos, pagos al centavo, Esc a media venta, nombres raros, mil productos) ────────────
const venderSiSePuede = async p => { const b = botonVender(p); if (await b.count() && await b.isEnabled()) { await b.click(); await espera(p, 600); return true; } return false; };
const pagadaPorTransferencia = async p => {
  await carrito(p).getByRole("button", { name: "Pagada", exact: true }).click(); await espera(p, 200);
  await carrito(p).getByRole("radio", { name: "Transferencia" }).first().click(); await espera(p, 150);
};
await caso("vin-21-precios-con-3-y-4-decimales", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "China impreso"); await agregar(p, "Etiqueta colgante");
  await piezas(p, "China impreso", 1000); await precio(p, "China impreso", "0.615");
  await piezas(p, "Etiqueta colgante", 3); await precio(p, "Etiqueta colgante", "0.6125");
  await elegirCliente(p);
  const t = await textoDe(carrito(p));
  await venderSiSePuede(p);
  const v = (await ventas(p))[0];
  ok("vin-21-precios-con-3-y-4-decimales", !!v && v.items[0].amount === 615 && v.items[1].amount === 1.84 && Math.abs(v.total_amount - 715.53) < 0.005 && t.includes(pesos(715.53)),
    v ? `importes ${JSON.stringify(v.items.map(i => i.amount))} (deben 615 y 1.84: 3 × 0.6125 = 1.8375 sube a 1.84); total ${v.total_amount} (debe 715.53)${t.includes(pesos(715.53)) ? "" : "; la pantalla NO dice $715.53"}` : "no se vendió");
});
await caso("vin-22-cinco-decimales-dice-que-revise", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "China impreso"); await piezas(p, "China impreso", 1000); await precio(p, "China impreso", "0.61255");
  await elegirCliente(p);
  const t = await textoDe(carrito(p)); const habil = await botonVender(p).isEnabled();
  ok("vin-22-cinco-decimales-dice-que-revise", !habil && /hasta 4 decimales/.test(t) && /Revisa el precio de China impreso/.test(t) && !/Falta el precio de China impreso/.test(t),
    `precio 0.61255: el botón ${habil ? "SÍ deja vender" : "no deja"}; ${/hasta 4 decimales/.test(t) ? "el renglón dice por qué" : "el renglón NO dice por qué"}; abajo ${/Revisa el precio de China impreso/.test(t) ? "dice «Revisa el precio»" : /Falta el precio/.test(t) ? "dice «Falta el precio» (y sí está escrito)" : "no dice nada"}`);
});
await caso("vin-23-la-coma-no-multiplica-por-cien", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "Etiqueta colgante"); await piezas(p, "Etiqueta colgante", 1000); await precio(p, "Etiqueta colgante", "2,50");
  await elegirCliente(p);
  const val = await precioDe(p, "Etiqueta colgante").inputValue(); const habil = await botonVender(p).isEnabled(); const t = await textoDe(carrito(p));
  ok("vin-23-la-coma-no-multiplica-por-cien", !habil && val === "2,50" && /con números/.test(t) && !t.includes(pesos(2500)),
    `«2,50»: el campo dice «${val}»; el botón ${habil ? "SÍ deja vender" : "no deja"}; ${t.includes(pesos(2500)) ? "el importe dice $2,500 (lo tomó como 250)" : /con números/.test(t) ? "dice que lo escriba con números" : "NO dice por qué"}`);
});
await caso("vin-24-con-signo-de-pesos", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "Etiqueta colgante"); await piezas(p, "Etiqueta colgante", 1000); await precio(p, "Etiqueta colgante", "$2.50");
  await elegirCliente(p); await venderSiSePuede(p);
  const v = (await ventas(p))[0];
  ok("vin-24-con-signo-de-pesos", !!v && v.items[0].amount === 2500, v ? `«$2.50» manda ${v.items[0].amount} (debe 2,500)` : "con «$2.50» no deja vender");
});
await caso("vin-25-punto-al-final", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "Soporte 3-25 (grande)"); await piezas(p, "Soporte 3-25 (grande)", 1000); await precio(p, "Soporte 3-25 (grande)", "5.");
  await elegirCliente(p); await venderSiSePuede(p);
  const v = (await ventas(p))[0];
  ok("vin-25-punto-al-final", !!v && v.items[0].amount === 5000, v ? `«5.» manda ${v.items[0].amount} (debe 5,000)` : "«5.» (como queda «5.50» a medio teclear) no deja vender");
});
await caso("vin-26-un-renglon-de-regalo", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "Etiqueta colgante"); await agregar(p, "Cordón para Etiqueta");
  await piezas(p, "Etiqueta colgante", 1000); await piezas(p, "Cordón para Etiqueta", 500); await precio(p, "Cordón para Etiqueta", "0");
  await elegirCliente(p); await venderSiSePuede(p);
  const v = (await ventas(p))[0];
  ok("vin-26-un-renglon-de-regalo", !!v && v.items[0].amount === 2100 && v.items[1].amount === 0 && Math.abs(v.total_amount - 2436) < 0.005,
    v ? `importes ${JSON.stringify(v.items.map(i => i.amount))} (deben 2,100 y 0); total ${v.total_amount} (debe 2,436)` : "con el cordón a $0 (de regalo) no deja vender");
});
await caso("vin-27-todo-en-cero-dice-por-que", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "Etiqueta colgante"); await piezas(p, "Etiqueta colgante", 1000); await precio(p, "Etiqueta colgante", "0");
  await elegirCliente(p);
  const habil = await botonVender(p).isEnabled(); const t = await textoDe(carrito(p));
  ok("vin-27-todo-en-cero-dice-por-que", !habil && /suma \$0\.00/.test(t), `todo a $0: el botón ${habil ? "SÍ deja vender" : "no deja"}; ${/suma \$0\.00/.test(t) ? "dice que la venta suma $0.00" : "NO dice por qué no deja"}`);
});
await caso("vin-28-kilos-con-decimales", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "China blanco (relleno)"); await kilos(p, "China blanco (relleno)", "12.5");
  const t = await textoDe(carrito(p));
  await elegirCliente(p); await venderSiSePuede(p);
  const v = (await ventas(p))[0];
  ok("vin-28-kilos-con-decimales", !!v && v.items[0].qty === 1000 && v.items[0].amount === 500 && /= 1,000 piezas/.test(t),
    v ? `12.5 kg: manda ${v.items[0].qty} piezas y ${v.items[0].amount} (deben 1,000 y 500)${/= 1,000 piezas/.test(t) ? "" : "; NO dice «= 1,000 piezas»"}` : "con 12.5 kg no se vendió");
});
await caso("vin-29-mas-kilos-que-los-que-hay", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "China blanco (relleno)"); await kilos(p, "China blanco (relleno)", "5001");
  await elegirCliente(p);
  const habil = await botonVender(p).isEnabled(); const t = await textoDe(carrito(p));
  ok("vin-29-mas-kilos-que-los-que-hay", !habil && /Revisa las cantidades/.test(t), `5,001 kg de 5,000: el botón ${habil ? "SÍ deja vender" : "no deja"}; ${/Revisa las cantidades/.test(t) ? "dice que revise" : "NO dice por qué"}`);
});
await caso("vin-30-pagada-cuadra-al-centavo", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "Etiqueta colgante"); await agregar(p, "Soporte 3-25 (grande)");
  await piezas(p, "Etiqueta colgante", 1); await piezas(p, "Soporte 3-25 (grande)", 1);
  await precio(p, "Etiqueta colgante", "1.03"); await precio(p, "Soporte 3-25 (grande)", "1.03");
  await elegirCliente(p);
  await pagadaPorTransferencia(p);
  const monto = await carrito(p).getByLabel("Monto del pago 1").inputValue();
  await venderSiSePuede(p);
  const v = (await ventas(p))[0];
  ok("vin-30-pagada-cuadra-al-centavo", Number(monto) === 2.38 && !!v && v.payment_status === "paid" && Math.abs(v.total_amount - 2.38) < 0.005 && v.pagos?.[0] === 2.38,
    `«Pagada» llena ${monto} (debe 2.38, el total con el IVA de cada renglón; 2.06 × 1.16 daría 2.39); ${v ? "manda " + v.payment_status + " " + JSON.stringify(v.pagos) + " de " + v.total_amount : "no deja vender"}`);
});
await caso("vin-31-cambiar-el-precio-despues-de-pagada", "", async p => {
  await ventaTipica(p);
  await pagadaPorTransferencia(p);
  await precio(p, "Etiqueta colgante", "2.50");
  const habil = await botonVender(p).isEnabled(); const t = await textoDe(carrito(p));
  ok("vin-31-cambiar-el-precio-despues-de-pagada", !habil && /Revisa el estado de pago/.test(t),
    `pagada por $47,560 y luego la etiqueta a $2.50 (total $52,200): el botón ${habil ? "SÍ deja vender con el pago de antes" : "no deja"}; ${/Revisa el estado de pago/.test(t) ? "dice que revise el pago" : "NO dice por qué"}`);
});
await caso("vin-32-esc-mientras-vende", "lento=1", async p => {
  await ventaTipica(p);
  await botonVender(p).click(); await espera(p, 200);
  await esc(p);
  const pregunta = /Salir sin vender/i.test(await textoDe(p.locator("body"))); const abierto = await carrito(p).count();
  await espera(p, 1800);
  const n = (await ventas(p)).length; const cerrado = (await carrito(p).count()) === 0;
  ok("vin-32-esc-mientras-vende", !pregunta && abierto === 1 && n === 1 && cerrado,
    `Esc mientras vende: ${pregunta ? "pregunta si salir (y la venta ya va)" : abierto ? "no hace nada" : "cierra a media venta"}; ${n} venta(s); al terminar ${cerrado ? "cierra" : "sigue abierto"}`);
});
await caso("vin-33-factura-remision-factura", "", async p => {
  await ventaTipica(p);
  await carrito(p).getByRole("button", { name: /^Remisión$/ }).click(); await espera(p, 200);
  const r = await textoDe(carrito(p));
  await carrito(p).getByRole("button", { name: /^Factura$/ }).click(); await espera(p, 200);
  const f = await textoDe(carrito(p));
  ok("vin-33-factura-remision-factura", r.includes(pesos(41000)) && /Total remisión/.test(r) && f.includes(pesos(47560)) && /IVA 16%/.test(f),
    `remisión: ${r.includes(pesos(41000)) ? "$41,000 sin IVA" : "NO dice $41,000"}; de vuelta a factura: ${f.includes(pesos(47560)) ? "$47,560" : "NO dice $47,560"}`);
});
await caso("vin-34-quitar-y-volver-a-agregar", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "Etiqueta colgante"); await precio(p, "Etiqueta colgante", "2.50");
  await carrito(p).getByRole("button", { name: "Quitar Etiqueta colgante del carrito" }).click(); await espera(p, 150);
  await agregar(p, "Etiqueta colgante");
  const v = await precioDe(p, "Etiqueta colgante").inputValue();
  ok("vin-34-quitar-y-volver-a-agregar", Number(v) === 2.1, `al volver a agregarla el precio es ${v} (debe el de lista, 2.10)`);
});
const RAROS = ["Etiqueta colgante «Edición Navidad» — Niño & Señora 🎄 con cordón dorado extra largo para botas de piel", "ETIQUETAPARABOTASSINESPACIOSNINGUNOPARAPARTIRLAPALABRAENRENGLONESDELCATALOGO", "X", "ملصق عربي للأحذية"];
await caso("vin-35-nombres-raros-caben-en-el-carrito", "nombres=raros", async p => {
  await abrirCarrito(p);
  for (const n of RAROS) await agregar(p, n);
  const r = await p.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-labelledby="pf-venta-titulo"]'); if (!d) return { no: true };
    const dr = d.getBoundingClientRect();
    const fuera = [...d.querySelectorAll("input,button")].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > dr.right + 1 || b.left < dr.left - 1); }).map(e => (e.getAttribute("aria-label") || e.textContent.trim()).slice(0, 30));
    return { pagina: document.documentElement.scrollWidth > innerWidth + 1, fuera, anchos: [...d.querySelectorAll('input[aria-label^="Precio de"]')].map(e => Math.round(e.getBoundingClientRect().width)) };
  });
  ok("vin-35-nombres-raros-caben-en-el-carrito", !r.no && !r.pagina && r.fuera.length === 0 && r.anchos.length === 4 && r.anchos.every(w => w >= 60),
    r.no ? "no hay carrito" : `${r.pagina ? "la página se sale a lo ancho; " : ""}${r.fuera.length ? "se salen: " + r.fuera.join(" | ") + "; " : ""}precios de ${JSON.stringify(r.anchos)} px (4, de 60 o más)`);
});
await caso("vin-36-nombre-en-la-factura-largo-no-rompe-la-tarjeta", "nombres=raros", async p => {
  const r = await p.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-labelledby="pf-inv-titulo"]'); return { pag: document.documentElement.scrollWidth > innerWidth + 1, dlg: d.scrollWidth > d.clientWidth + 1, hijos: [...d.querySelectorAll("div")].filter(x => x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflowX !== "visible").length }; });
  const t = await textoDe(p.getByRole("dialog", { name: /Inventario Cuadra/ }));
  ok("vin-36-nombre-en-la-factura-largo-no-rompe-la-tarjeta", !r.pag && !r.dlg && r.hijos === 0 && /En la factura: NOMBREENLAFACTURASINESPACIOS/.test(t) && /🎄/.test(t),
    `${r.pag ? "la página se sale a lo ancho; " : ""}${r.dlg ? "el inventario se sale a lo ancho; " : ""}${r.hijos ? r.hijos + " cajas se desbordan; " : ""}${/En la factura: NOMBREENLAFACTURASINESPACIOS/.test(t) ? "dice el nombre sin espacios" : "NO dice el nombre sin espacios"}`);
});
await caso("vin-37-precio-y-nombre-esc-con-cambios-pregunta", "", async p => {
  await abrirPrecio(p, "Etiqueta colgante");
  const d = p.getByRole("dialog", { name: /Precio y nombre/ });
  await d.getByLabel(/^Precio de lista/).fill("2.30");
  await esc(p);
  const pregunta = /Salir sin guardar/.test(await textoDe(d));
  let sigue = false, cierra = false;
  if (pregunta) {
    await d.getByRole("button", { name: "Seguir editando" }).click(); await espera(p, 200);
    sigue = (await d.getByLabel(/^Precio de lista/).inputValue()) === "2.30";
    await esc(p);
    await d.getByRole("button", { name: "Salir sin guardar" }).click(); await espera(p, 300);
    cierra = (await p.getByRole("dialog", { name: /Precio y nombre/ }).count()) === 0 && (await p.getByRole("dialog", { name: /Inventario Cuadra/ }).count()) === 1;
  }
  const g = (await guardados(p)).length;
  ok("vin-37-precio-y-nombre-esc-con-cambios-pregunta", pregunta && sigue && cierra && g === 0,
    `Esc con el precio cambiado: ${pregunta ? "pregunta" : "NO pregunta"}; «Seguir editando» ${sigue ? "deja lo escrito" : "no lo deja"}; «Salir sin guardar» ${cierra ? "cierra sólo ese diálogo" : "no cierra bien"}; ${g} guardado(s)`);
});
await caso("vin-38-precio-y-nombre-clic-afuera-con-cambios-pregunta", "", async p => {
  await abrirPrecio(p, "Etiqueta colgante");
  const d = p.getByRole("dialog", { name: /Precio y nombre/ });
  await d.getByLabel(/^Nombre en la factura$/).fill("OTRO NOMBRE");
  await p.mouse.click(8, 300); await espera(p, 300);
  const sigue = await p.getByRole("dialog", { name: /Precio y nombre/ }).count();
  const pregunta = sigue ? /Salir sin guardar/.test(await textoDe(d)) : false;
  ok("vin-38-precio-y-nombre-clic-afuera-con-cambios-pregunta", sigue === 1 && pregunta, `clic afuera con el nombre cambiado: ${sigue ? (pregunta ? "pregunta" : "no pregunta") : "CIERRA y se pierde"}`);
});
await caso("vin-39-precio-y-nombre-sin-cambios-esc-cierra", "", async p => {
  await abrirPrecio(p, "Etiqueta colgante");
  await esc(p);
  const n = await p.getByRole("dialog", { name: /Precio y nombre/ }).count(); const inv = await p.getByRole("dialog", { name: /Inventario Cuadra/ }).count();
  ok("vin-39-precio-y-nombre-sin-cambios-esc-cierra", n === 0 && inv === 1 && (await guardados(p)).length === 0, `Esc sin cambios: ${n ? "no cierra" : "cierra"}; el inventario ${inv ? "sigue" : "también se cerró"}`);
});
await caso("vin-40-precio-y-nombre-doble-clic-guarda-una-vez", "lento=1", async p => {
  await abrirPrecio(p, "Etiqueta colgante");
  const d = p.getByRole("dialog", { name: /Precio y nombre/ });
  await d.getByLabel(/^Precio de lista/).fill("2.40");
  await d.getByRole("button", { name: /^Guardar/ }).dblclick(); await espera(p, 2200);
  const n = (await guardados(p)).length;
  ok("vin-40-precio-y-nombre-doble-clic-guarda-una-vez", n === 1, `doble clic en Guardar: ${n} guardado(s) (debe 1)`);
});
await caso("vin-41-quitar-el-precio-de-lista", "", async p => {
  await abrirPrecio(p, "Etiqueta colgante");
  const d = p.getByRole("dialog", { name: /Precio y nombre/ });
  await d.getByLabel(/^Precio de lista/).fill("");
  await d.getByRole("button", { name: /^Guardar/ }).click(); await espera(p, 700);
  const g = (await guardados(p))[0];
  await abrirCarrito(p); await agregar(p, "Etiqueta colgante"); await piezas(p, "Etiqueta colgante", 10);
  const t = await textoDe(carrito(p));
  ok("vin-41-quitar-el-precio-de-lista", !!g && g.cambios.unit_price === null && /Falta el precio de Etiqueta colgante/.test(t),
    g ? `guarda unit_price ${JSON.stringify(g.cambios.unit_price)} (debe null); el carrito ${/Falta el precio de Etiqueta colgante/.test(t) ? "pide el precio" : "NO pide el precio"}` : "no guarda sin precio");
});
await caso("vin-42-borrar-el-nombre-de-un-cliente", "", async p => {
  await abrirPrecio(p, "China blanco (relleno)");
  const d = p.getByRole("dialog", { name: /Precio y nombre/ });
  await d.getByLabel(/FABRICA DE ALTA CALIDAD/).fill("");
  await d.getByRole("button", { name: /^Guardar/ }).click(); await espera(p, 700);
  const s = (await guardados(p))[0]?.cambios?.specs || null;
  ok("vin-42-borrar-el-nombre-de-un-cliente", !!s && !("nombre_factura_cliente" in s) && s.nombre_factura === "PAPEL KRAFT PARA RELLENAR 25" && s.sell_unit === "kg" && s.units_per_kg === 80,
    s ? `guarda ${JSON.stringify(s)} (sin nombre_factura_cliente; con el nombre general y los kilos)` : "no guarda");
});
await caso("vin-43-alguien-mas-lo-cambio", "falla=cambiado", async p => {
  await abrirPrecio(p, "Etiqueta colgante");
  const d = p.getByRole("dialog", { name: /Precio y nombre/ });
  await d.getByLabel(/^Precio de lista/).fill("2.40");
  await d.getByRole("button", { name: /^Guardar/ }).click(); await espera(p, 600);
  const sigue = await p.getByRole("dialog", { name: /Precio y nombre/ }).count(); const t = sigue ? await textoDe(d) : "";
  ok("vin-43-alguien-mas-lo-cambio", sigue === 1 && /Alguien más cambió este producto/.test(t), `otro lo cambió: ${sigue ? (/Alguien más cambió/.test(t) ? "lo dice y se queda" : "se queda sin decir qué pasó") : "se cierra"}`);
});
await caso("vin-44-producto-nuevo-precio-invalido", "", async p => {
  await p.getByRole("button", { name: /Nuevo Producto/ }).click(); await espera(p, 400);
  await p.locator("select").filter({ has: p.locator("option", { hasText: "MANUFACTURERA" }) }).first().selectOption({ index: 1 });
  await p.getByPlaceholder(/Tarjeta Presentación/).fill("Bolsa");
  await p.getByLabel(/^Precio de lista/).fill("-1"); await espera(p, 150);
  const g1 = await p.getByRole("button", { name: /^Guardar/ }).isEnabled(); const t1 = await textoDe(p.locator("body"));
  await p.getByLabel(/^Precio de lista/).fill("abc"); await espera(p, 150);
  const g2 = await p.getByRole("button", { name: /^Guardar/ }).isEnabled(); const t2 = await textoDe(p.locator("body"));
  ok("vin-44-producto-nuevo-precio-invalido", !g1 && /no puede ser negativo/.test(t1) && !g2 && /con números/.test(t2) && (await altas(p)).length === 0,
    `−1: ${g1 ? "SE PUEDE guardar" : "no deja"}${/no puede ser negativo/.test(t1) ? " y dice por qué" : " sin decir por qué"}; «abc»: ${g2 ? "SE PUEDE guardar" : "no deja"}${/con números/.test(t2) ? " y dice por qué" : " sin decir por qué"}`);
});
for (const [ancho, alto] of [[1366, 768], [1920, 1080]]) {
  await caso(`vin-45-precio-y-nombre-cabe-${ancho}`, "", async p => {
    await abrirPrecio(p, "China blanco (relleno)");
    const r = await p.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-labelledby="pf-precio-titulo"]'); if (!d) return { no: true }; const b = d.getBoundingClientRect(); return { pag: document.documentElement.scrollWidth > innerWidth + 1, ancho: d.scrollWidth > d.clientWidth + 1, alto: b.bottom > innerHeight + 1 || b.top < -1 }; });
    const malos = await sinAA(p, '[role="dialog"][aria-labelledby="pf-precio-titulo"]');
    ok(`vin-45-precio-y-nombre-cabe-${ancho}`, !r.no && !r.pag && !r.ancho && !r.alto && malos.length === 0,
      r.no ? "no hay diálogo" : `${ancho}: ${r.pag || r.ancho ? "se sale a lo ancho; " : ""}${r.alto ? "se sale de la pantalla a lo alto; " : ""}${malos.length ? "sin AA: " + malos.slice(0, 6).join(" | ") : "se lee"}`);
  }, { viewport: { width: ancho, height: alto } });
}
await caso("vin-46-mil-productos", "muchos=1000", async p => {
  const t0 = Date.now(); await abrirCarrito(p); const abrir = Date.now() - t0;
  await carrito(p).getByPlaceholder("Buscar producto...").fill("Producto 0999"); await espera(p, 300);
  await agregar(p, "Producto 0999"); await piezas(p, "Producto 0999", 10);
  const t = await textoDe(carrito(p));
  ok("vin-46-mil-productos", abrir < 3000 && t.includes(pesos(3696.3)), `con 1,005 productos el carrito abre en ${abrir} ms; ${t.includes(pesos(3696.3)) ? "10 del 0999 a $369.63 = $3,696.30" : "NO dice el importe $3,696.30"}`);
});
await caso("vin-47-folio-a-mano-emisor-apagado", "emisor=0", async p => {
  await ventaTipica(p);
  const f = carrito(p).getByPlaceholder("D-XXXX");
  if (await f.count()) { await f.fill("D-5000"); await espera(p, 150); }
  await venderSiSePuede(p);
  const v = (await ventas(p))[0];
  ok("vin-47-folio-a-mano-emisor-apagado", !!v && v.folio === "D-5000" && v.items[0].amount === 20000 && v.items[1].amount === 21000,
    v ? `folio ${v.folio}, importes ${JSON.stringify(v.items.map(i => i.amount))}` : "con el folio a mano no se vendió");
});
await caso("vin-48-precio-antes-que-la-cantidad", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "Etiqueta colgante"); await precio(p, "Etiqueta colgante", "2.5"); await piezas(p, "Etiqueta colgante", 100);
  await elegirCliente(p); await venderSiSePuede(p);
  const v = (await ventas(p))[0];
  ok("vin-48-precio-antes-que-la-cantidad", !!v && v.items[0].amount === 250 && v.items[0].qty === 100, v ? `manda ${v.items[0].qty} piezas y ${v.items[0].amount} (deben 100 y 250)` : "no se vendió");
});
await caso("vin-49-el-tab-no-se-sale-del-carrito", "", async p => {
  await abrirCarrito(p); await agregar(p, "Etiqueta colgante");
  await carrito(p).getByPlaceholder("Buscar producto...").focus();
  let fuera = 0;
  for (let i = 0; i < 40; i++) { await p.keyboard.press("Tab"); if (!(await p.evaluate(() => !!document.activeElement?.closest('[aria-labelledby="pf-venta-titulo"]')))) fuera++; }
  ok("vin-49-el-tab-no-se-sale-del-carrito", fuera === 0, `${fuera} de 40 Tabs se salieron del carrito`);
});
await caso("vin-50-el-tab-no-se-sale-de-precio-y-nombre", "", async p => {
  await abrirPrecio(p, "China blanco (relleno)");
  let fuera = 0;
  for (let i = 0; i < 20; i++) { await p.keyboard.press("Tab"); if (!(await p.evaluate(() => !!document.activeElement?.closest('[aria-labelledby="pf-precio-titulo"]')))) fuera++; }
  ok("vin-50-el-tab-no-se-sale-de-precio-y-nombre", fuera === 0, `${fuera} de 20 Tabs se salieron del diálogo`);
});

// ── vuelta 3: sobre los arreglos de la 2 y lo que faltaba (negativos, la ×, «Vaciar», los pagos al cambiar de tipo, después de vender, el catálogo) ──
await caso("vin-51-kilos-negativos-y-piezas-en-cero", "", async p => {
  await abrirCarrito(p);
  await agregar(p, "China blanco (relleno)"); await agregar(p, "Etiqueta colgante");
  await kilos(p, "China blanco (relleno)", "-5"); await piezas(p, "Etiqueta colgante", 0);
  await elegirCliente(p);
  const habil = await botonVender(p).isEnabled(); const t = await textoDe(carrito(p));
  ok("vin-51-kilos-negativos-y-piezas-en-cero", !habil && /Revisa las cantidades/.test(t) && !/Total factura/.test(t),
    `−5 kg y 0 piezas: el botón ${habil ? "SÍ deja vender" : "no deja"}; ${/Revisa las cantidades/.test(t) ? "dice que revise" : "NO dice por qué"}${/Total factura/.test(t) ? "; enseña un total con cantidades que no sirven" : ""}`);
});
await caso("vin-52-la-x-con-carrito-pregunta", "", async p => {
  await ventaTipica(p);
  await carrito(p).getByRole("button", { name: "Cerrar el carrito" }).click(); await espera(p, 300);
  const sigue = await carrito(p).count(); const pregunta = /Salir sin vender/i.test(await textoDe(p.locator("body")));
  ok("vin-52-la-x-con-carrito-pregunta", sigue === 1 && pregunta, `la × con el carrito lleno: ${sigue ? (pregunta ? "pregunta" : "no pregunta") : "CIERRA y se pierde el carrito"}`);
});
await caso("vin-53-vaciar-y-luego-esc-cierra", "", async p => {
  await ventaTipica(p);
  await carrito(p).getByRole("button", { name: "Vaciar" }).click(); await espera(p, 200);
  await esc(p);
  ok("vin-53-vaciar-y-luego-esc-cierra", (await carrito(p).count()) === 0 && !/Salir sin vender/i.test(await textoDe(p.locator("body"))), "vaciar y Esc: " + ((await carrito(p).count()) ? "no cierra" : "cierra sin preguntar"));
});
await caso("vin-54-pagada-y-cambiar-a-remision-pide-los-pagos-otra-vez", "", async p => {
  await ventaTipica(p);
  await pagadaPorTransferencia(p);
  await carrito(p).getByRole("button", { name: /^Remisión$/ }).click(); await espera(p, 300);
  const aviso = (await lineas(p, "aviso")).join(" ");
  const pagada = await carrito(p).getByRole("button", { name: "Pagada", exact: true }).getAttribute("aria-pressed");
  await venderSiSePuede(p);
  const v = (await ventas(p))[0];
  ok("vin-54-pagada-y-cambiar-a-remision-pide-los-pagos-otra-vez", /Vuelve a capturar los pagos/.test(aviso) && pagada !== "true" && !!v && v.payment_status === "unpaid" && Math.abs(v.total_amount - 41000) < 0.005,
    `${/Vuelve a capturar los pagos/.test(aviso) ? "avisa que se recapturen los pagos" : "NO avisa"}; «Pagada» ${pagada === "true" ? "sigue elegida (con el monto con IVA)" : "se quitó"}; ${v ? "vende " + v.payment_status + " por " + v.total_amount : "no se vendió"}`);
});
await caso("vin-55-despues-de-vender", "", async p => {
  await ventaTipica(p);
  const antes = (await lineas(p, "db loadClientProducts")).length;
  await venderSiSePuede(p); await espera(p, 400);
  const aviso = (await lineas(p, "aviso")).join(" "); const despues = (await lineas(p, "db loadClientProducts")).length;
  ok("vin-55-despues-de-vender", (await carrito(p).count()) === 0 && /F-300/.test(aviso) && /\$47,560\.00/.test(aviso) && despues > antes,
    `después de vender: el carrito ${(await carrito(p).count()) ? "sigue abierto" : "se cierra"}; el aviso ${/\$47,560\.00/.test(aviso) ? "dice el folio y $47,560.00" : "dice «" + aviso.slice(0, 120) + "»"}; el inventario ${despues > antes ? "se vuelve a leer" : "NO se vuelve a leer"}`);
});
for (const [ancho, alto] of [[1366, 768], [1920, 1080]]) {
  await caso(`vin-56-el-catalogo-se-lee-${ancho}`, "", async p => {
    const malos = await sinAA(p, '[role="dialog"][aria-labelledby="pf-inv-titulo"]');
    const r = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(`vin-56-el-catalogo-se-lee-${ancho}`, !r && malos.length === 0, `${ancho}: ${r ? "se sale a lo ancho; " : ""}${malos.length ? "sin AA: " + malos.slice(0, 8).join(" | ") : "se lee"}`);
  }, { viewport: { width: ancho, height: alto } });
}
await caso("vin-57-producto-nuevo-con-punto-al-final", "", async p => {
  await p.getByRole("button", { name: /Nuevo Producto/ }).click(); await espera(p, 400);
  await p.locator("select").filter({ has: p.locator("option", { hasText: "MANUFACTURERA" }) }).first().selectOption({ index: 1 });
  await p.getByPlaceholder(/Tarjeta Presentación/).fill("Bolsa");
  await p.getByLabel(/^Precio de lista/).fill("3.");
  await p.getByRole("button", { name: /^Guardar/ }).click(); await espera(p, 500);
  const a = (await altas(p))[0];
  ok("vin-57-producto-nuevo-con-punto-al-final", !!a && a.unit_price === 3 && !("specs" in a), a ? `da de alta ${JSON.stringify({ unit_price: a.unit_price, specs: a.specs })} (debe 3 y sin specs: sin nombre en la factura, la base pone {})` : "con «3.» no da de alta");
});
await caso("vin-58-nombre-solo-con-espacios-es-vacio", "", async p => {
  await abrirPrecio(p, "Etiqueta colgante");
  const d = p.getByRole("dialog", { name: /Precio y nombre/ });
  await d.getByLabel(/^Nombre en la factura$/).fill("    ");
  await d.getByRole("button", { name: /^Guardar/ }).click(); await espera(p, 700);
  const s = (await guardados(p))[0]?.cambios?.specs || null;
  ok("vin-58-nombre-solo-con-espacios-es-vacio", !!s && !("nombre_factura" in s), s ? `guarda ${JSON.stringify(s)} (sin nombre_factura: sólo espacios es vacío)` : "no guarda");
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nventa-inventario: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
