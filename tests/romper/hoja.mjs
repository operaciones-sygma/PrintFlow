// Tratar de ROMPER la HOJA IMPRESA de la orden (la que la planta tiene en la mano: `PrintOrder`), su /impeccable critique del 16-oct. Cada caso
// afirma lo que DEBERÍA pasarle a quien la imprime y a quien la lee en el taller: una FALLA es un bug. Vuelta 1: escritas antes del arreglo.
// Se mide la hoja COMO SE IMPRIME: la ventana que abre la app, con el CSS de impresión (emulateMedia print), su ajuste a una hoja (pfFit) y el PDF
// Carta que saca Chrome. «Letra efectiva» = el tamaño de la letra por el zoom con que la hoja se encoge para caber (1 pt = 1.333 px).
// Casos del banco: normal (P-0650), larga (P-0652: dos fotos, pantones, 9 acabados, notas de 6 renglones, 4 lugares, maquila externa), cancelada,
// maquila, sinlogo, minima. Detrás, una «app» con su buscador (#atras-*).
// Uso: node hoja.mjs <dir-capturas> [puerto=5178]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5178);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
const PT7 = 9.33, PT10 = 13.33;   // 7 pt y 10 pt en px
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, { viewport = { width: 1366, height: 768 } } = {}) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const ctx = await browser.newContext({ viewport, timezoneId: "America/Mexico_City", locale: "es-MX" });
  const page = await ctx.newPage();
  const errs = [];
  const vigila = p => { p.on("pageerror", e => errs.push("pageerror: " + e.message)); p.on("console", m => { if (m.type() === "error" && !deFuera(m)) errs.push("console: " + m.text()); }); };
  vigila(page); ctx.on("page", vigila);
  try {
    page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.locator("#atras-buscar").waitFor({ timeout: 30000 });
    await page.waitForTimeout(250);
    await fn(page, ctx);
    const nativos = (await lineas(page, "alert:")).concat(await lineas(page, "confirm:"));
    if (nativos.length) ok(nombre + " · diálogo nativo", false, nativos.join(" ; ").slice(0, 200));
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png" }).catch(() => {});
  await ctx.close();
}
const log = async p => (await p.textContent("#log")) || "";
const lineas = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref));
const espera = (p, ms = 300) => p.waitForTimeout(ms);
// abre la hoja con el botón de la copia (re: su nombre) y la deja como se imprime: el CSS de impresión y el ajuste a una hoja
async function hoja(p, ctx, re, nombre) {
  const [pop] = await Promise.all([ctx.waitForEvent("page", { timeout: 10000 }), p.getByRole("button", { name: re }).first().click()]);
  await pop.waitForLoadState("load"); await pop.waitForTimeout(500);
  await pop.emulateMedia({ media: "print" });
  await pop.evaluate(() => { try { window.pfFit && window.pfFit(); } catch (e) {} });
  await pop.waitForTimeout(200);
  if (nombre) await pop.screenshot({ path: OUT + "/" + nombre + "-hoja.png", fullPage: true }).catch(() => {});
  return pop;
}
const paginas = async pop => { const b = await pop.pdf({ format: "Letter", printBackground: true }); return (b.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) || []).length; };
const textoHoja = pop => pop.evaluate(() => (document.getElementById("pf-sheet")?.innerText || "").replace(/\s+/g, " "));
// cada texto de la hoja con su letra EFECTIVA (con el zoom del ajuste) y su contraste contra lo que tiene debajo (lo que sobrevive a una fotocopia)
const medir = pop => pop.evaluate(() => {
  const hojaEl = document.getElementById("pf-sheet"); if (!hojaEl) return { textos: [], zoom: 0 };
  const sonda = document.createElement("div"); sonda.style.cssText = "width:100px;height:4px;display:block"; hojaEl.appendChild(sonda);
  const zoom = sonda.getBoundingClientRect().width / (parseFloat(getComputedStyle(sonda).width) || 100); sonda.remove();
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const textos = [];
  for (const el of hojaEl.querySelectorAll("*")) {
    const t = propio(el); if (!t || !el.getClientRects().length) continue;
    const s = getComputedStyle(el); if (s.visibility === "hidden" || Number(s.opacity) === 0 || s.color === "rgba(0, 0, 0, 0)") continue;
    const tam = parseFloat(s.fontSize) * zoom;
    const a = lum(nums(s.color)), b = lum(fondo(el)), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    textos.push({ t: t.slice(0, 28), tam: Math.round(tam * 10) / 10, k: Math.round(k * 10) / 10, peso: Number(s.fontWeight) || 400, color: s.color });
  }
  return { textos, zoom: Math.round(zoom * 1000) / 1000 };
});
const PROD = /Copia Producci[oó]n|Imprimir Orden/, ADMIN = /Administrativa/;

// ── vuelta 1: escritas antes del arreglo ─────────────────────────────────────────────────────────────────────────────────────────────
await caso("hj-01-produccion-sin-dinero", "", async (p, ctx) => {
  const t = await textoHoja(await hoja(p, ctx, PROD, "hj-01"));
  const malos = [/\$\s?\d/, /R\.F\.C\./i, /compras@bajio/i, /477\s?123/, /\bprecio\b/i].filter(r => r.test(t)).map(String);   // («sin precios» del letrero no cuenta)
  ok("hj-01-produccion-sin-dinero", malos.length === 0, malos.length ? "la copia de producción trae: " + malos.join(" ") : "sin precio, RFC, correo ni teléfono del cliente");
});
await caso("hj-02-cabe-en-una-hoja", "", async (p, ctx) => {
  const n = await paginas(await hoja(p, ctx, PROD));
  ok("hj-02-cabe-en-una-hoja", n === 1, `P-0650 en Carta: ${n} hoja(s)`);
});
await caso("hj-03-letra-minima", "", async (p, ctx) => {
  const { textos, zoom } = await medir(await hoja(p, ctx, PROD, "hj-03"));
  const chicos = textos.filter(x => x.tam < PT7);
  ok("hj-03-letra-minima", textos.length > 0 && chicos.length === 0, `zoom ${zoom}; de menos de 7 pt: ${chicos.length} (${[...new Set(chicos.map(x => x.t + " " + x.tam + "px"))].slice(0, 6).join(" | ")})`);
});
await caso("hj-04-lo-clave-se-lee", "", async (p, ctx) => {
  const { textos } = await medir(await hoja(p, ctx, PROD));
  const de = re => textos.filter(x => re.test(x.t)).map(x => x.tam);
  const clave = { folio: de(/^P-0650$/), cantidad: de(/^5,?000$/), entrega: de(/20 \/ Octubre/), producto: de(/^Volantes$/) };
  const cortos = Object.entries(clave).filter(([, v]) => !v.length || Math.max(...v) < PT10).map(([k, v]) => k + " " + (v.length ? Math.max(...v) + "px" : "no está"));
  ok("hj-04-lo-clave-se-lee", cortos.length === 0, cortos.length ? "de menos de 10 pt: " + cortos.join(", ") : "folio, cantidad, entrega y producto de 10 pt o más");
});
await caso("hj-05-blanco-y-negro", "", async (p, ctx) => {
  const { textos } = await medir(await hoja(p, ctx, PROD, "hj-05"));
  const tenues = textos.filter(x => x.k < 4.5);
  ok("hj-05-blanco-y-negro", textos.length > 0 && tenues.length === 0, tenues.length ? "se pierde en fotocopia (menos de 4.5:1): " + [...new Set(tenues.map(x => x.t + " " + x.k))].slice(0, 8).join(" | ") : "todo con 4.5:1 o más");
});
await caso("hj-06-larga-cabe-y-se-lee", "caso=larga", async (p, ctx) => {
  const pop = await hoja(p, ctx, PROD, "hj-06");
  const n = await paginas(pop); const { textos, zoom } = await medir(pop);
  const min = Math.min(...textos.map(x => x.tam));
  ok("hj-06-larga-cabe-y-se-lee", n === 1 && min >= PT7, `P-0652 (fotos, 9 acabados, 6 renglones de notas): ${n} hoja(s), zoom ${zoom}, la letra más chica ${min}px`);
});
await caso("hj-07-lo-elegido-se-distingue", "caso=larga", async (p, ctx) => {
  const pop = await hoja(p, ctx, PROD);
  // los acabados elegidos (Barniz Mate, Doblez, Perforado, Grapado) contra uno que no (Barniz Brillante): en blanco y negro, ¿se ve la diferencia en el NOMBRE?
  const r = await pop.evaluate(() => {
    const nodo = re => { const w = document.createTreeWalker(document.getElementById("pf-sheet"), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (re.test(n.textContent)) return n.parentElement; return null; };
    const est = el => { if (!el) return null; const s = getComputedStyle(el); return { peso: Number(s.fontWeight) || 400, color: s.color, deco: s.textDecorationLine }; };
    return { si: est(nodo(/Barniz Mate/)), no: est(nodo(/Barniz Brillante/)) };
  });
  const distinto = r.si && (!r.no || r.si.peso >= r.no.peso + 200 || r.si.color !== r.no.color);
  ok("hj-07-lo-elegido-se-distingue", !!distinto, `«Barniz Mate» (elegido) ${JSON.stringify(r.si)} · «Barniz Brillante» (no) ${JSON.stringify(r.no)}`);
});
await caso("hj-08-sin-campos-muertos", "", async (p, ctx) => {
  const t = await textoHoja(await hoja(p, ctx, ADMIN));
  ok("hj-08-sin-campos-muertos", !/cotizaci[oó]n/i.test(t), /cotizaci[oó]n/i.test(t) ? "la copia administrativa trae «Cotización» siempre vacío" : "sin campos que nunca se llenan");
});
await caso("hj-09-sin-repetir", "", async (p, ctx) => {
  const t = await textoHoja(await hoja(p, ctx, PROD));
  const n = (t.match(/tipo de orden/gi) || []).length;
  ok("hj-09-sin-repetir", n <= 1, `«Tipo de Orden» ${n} vez(es) en la copia de producción`);
});
await caso("hj-10-cancelada", "caso=cancelada", async (p, ctx) => {
  const pop = await hoja(p, ctx, PROD, "hj-10");
  const marca = await pop.evaluate(() => !!document.querySelector(".vcancel-wm") && /CANCELADA/.test(document.body.innerText));
  ok("hj-10-cancelada", marca, marca ? "la marca de agua y la leyenda CANCELADA" : "una cancelada sale como viva");
});
await caso("hj-11-la-ventana-es-dialogo", "", async p => {
  const d = await p.getByRole("dialog", { name: /P-0650/ }).count();
  await p.getByRole("button", { name: PROD }).first().focus();
  const fuera = [];
  for (let i = 0; i < 8; i++) { await p.keyboard.press("Tab"); const w = await p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? "body" : a.closest("#barra") ? (a.id || a.tagName) : ""; }); if (w) fuera.push(w); }
  ok("hj-11-la-ventana-es-dialogo", d === 1 && fuera.length === 0, `role=dialog con el folio: ${d}; ${fuera.length ? "el foco se va atrás: " + [...new Set(fuera)].join(", ") : "el Tab no se sale"}`);
});
await caso("hj-12-esc-cierra", "", async p => {
  await p.keyboard.press("Escape"); await espera(p);
  ok("hj-12-esc-cierra", (await lineas(p, "cerrar")).length === 1, `Esc: ${(await lineas(p, "cerrar")).length ? "cierra" : "no cierra"}`);
});
await caso("hj-13-sin-version-lo-dice", "falla=version", async (p, ctx) => {
  const pop = await hoja(p, ctx, PROD);
  const t = await pop.evaluate(() => document.body.innerText);
  const aviso = await lineas(p, "error ");
  ok("hj-13-sin-version-lo-dice", /SIN REGISTRO/.test(t) && aviso.length >= 1, `la base no contestó la versión: la hoja ${/SIN REGISTRO/.test(t) ? "dice SIN REGISTRO" : "NO lo dice"}; la app ${aviso.length ? "avisa" : "no avisa"}`);
});
await caso("hj-14-produccion-un-boton", "rol=produccion", async p => {
  const n = await p.getByRole("button", { name: /Imprimir/ }).count(); const adm = await p.getByRole("button", { name: ADMIN }).count();
  ok("hj-14-produccion-un-boton", n === 1 && adm === 0, `Gerardo: ${n} botón(es) de imprimir; la administrativa ${adm ? "SÍ (no debería)" : "no"}`);
});
await caso("hj-15-maquila-sin-costos", "caso=maquila", async (p, ctx) => {
  const t = await textoHoja(await hoja(p, ctx, PROD));
  ok("hj-15-maquila-sin-costos", !/\$\s?\d/.test(t) && !/costo/i.test(t) && /maquila/i.test(t), `la maquila en la copia de producción: ${/\$\s?\d/.test(t) || /costo/i.test(t) ? "trae dinero" : "sin dinero"}${/maquila/i.test(t) ? "" : "; no dice que es maquila"}`);
});

// ── vuelta 2: por donde no se diseñó (escritas con el arreglo pensado, corridas también contra lo de antes) ─────────────────────────────
await caso("hj-16-administrativa-con-todo", "", async (p, ctx) => {
  const t = await textoHoja(await hoja(p, ctx, ADMIN, "hj-16"));
  const falta = [[/\$\s?4,500/, "el precio"], [/CBA010101AB1/, "el RFC"], [/compras@bajio\.mx/i, "el correo"], [/estado de pago/i, "el estado de pago"]].filter(([r]) => !r.test(t)).map(([, n]) => n);
  ok("hj-16-administrativa-con-todo", falta.length === 0, falta.length ? "a la copia administrativa le falta: " + falta.join(", ") : "con precio, RFC, correo y estado de pago");
});
await caso("hj-17-sin-logo", "caso=sinlogo", async (p, ctx) => {
  const pop = await hoja(p, ctx, PROD, "hj-17");
  const r = await pop.evaluate(() => ({ aviso: /EMPACAR SIN LOGOS/.test(document.body.innerText), logo: !!document.querySelector('.header-logo img') }));
  const { textos } = await medir(pop); const malos = textos.filter(x => /EMPACAR|imprenta externa/i.test(x.t) && (x.tam < 9.33 || x.k < 4.5));
  ok("hj-17-sin-logo", r.aviso && !r.logo && malos.length === 0, `sin logo: el aviso ${r.aviso ? "sí" : "NO"}; el logotipo ${r.logo ? "SÍ sale" : "no sale"}${malos.length ? "; el aviso no se lee: " + malos.map(x => x.t + " " + x.tam + "px " + x.k).join(" | ") : ""}`);
});
await caso("hj-18-minima-sin-huecos", "caso=minima", async (p, ctx) => {
  const pop = await hoja(p, ctx, PROD, "hj-18");
  const n = await paginas(pop); const { textos, zoom } = await medir(pop); const t = await textoHoja(pop);
  const raros = (t.match(/undefined|null|NaN/g) || []); const chicos = textos.filter(x => x.tam < 9.33);
  ok("hj-18-minima-sin-huecos", n === 1 && zoom === 1 && !raros.length && !chicos.length && !/impresión/i.test(t.replace(/Orden de Producci/i, "")), `una orden con lo mínimo: ${n} hoja(s), zoom ${zoom}${raros.length ? "; dice " + raros.join(",") : ""}${chicos.length ? "; letra chica: " + chicos.length : ""}${/impresión/i.test(t.replace(/Orden de Producci/i, "")) ? "; trae la sección «Impresión» vacía" : ""}`);
});
await caso("hj-19-urgente-en-negritas", "caso=minima", async (p, ctx) => {
  const pop = await hoja(p, ctx, PROD);
  const r = await pop.evaluate(() => { const de = re => { const w = document.createTreeWalker(document.getElementById("pf-sheet"), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (re.test(n.textContent)) return Number(getComputedStyle(n.parentElement).fontWeight) || 400; return 0; }; return { urgente: de(/^\s*Urgente\s*$/), normal: de(/^\s*Normal\s*$/) }; });
  ok("hj-19-urgente-en-negritas", r.urgente >= 700 && r.normal < 700, `«Urgente» (elegido) peso ${r.urgente} · «Normal» peso ${r.normal}`);
});
await caso("hj-20-distribucion-en-orden", "caso=tres", async (p, ctx) => {
  const t = await textoHoja(await hoja(p, ctx, PROD, "hj-20"));
  const enOrden = /1\s*Bodega León.*2\s*Sucursal Silao.*3\s*Sucursal Irapuato/.test(t);
  ok("hj-20-distribucion-en-orden", enOrden, enOrden ? "los 3 lugares, numerados y en orden" : "los lugares no salen en orden: " + (t.match(/Distribuci[oó]n.{0,160}/i) || [""])[0]);
});
await caso("hj-21-doble-clic-una-ventana", "", async (p, ctx) => {
  await p.getByRole("button", { name: PROD }).first().dblclick(); await espera(p, 2000);
  const ventanas = ctx.pages().length - 1;
  ok("hj-21-doble-clic-una-ventana", ventanas === 1, `doble clic en «Copia Producción»: ${ventanas} ventana(s) de impresión`);
});
await caso("hj-22-con-el-teclado", "", async (p, ctx) => {
  await espera(p, 200);
  const abre = ctx.waitForEvent("page", { timeout: 3000 }).then(() => true, () => false);
  await p.keyboard.press("Enter");
  const si = await abre;
  ok("hj-22-con-el-teclado", si, si ? "Enter al abrir la ventana imprime la primera copia" : "con el teclado no se llega a imprimir (el foco no está en la ventana)");
});
await caso("hj-23-un-lugar", "caso=unlugar", async (p, ctx) => {
  const pop = await hoja(p, ctx, PROD); const t = await textoHoja(pop); const n = await paginas(pop);
  ok("hj-23-un-lugar", /1\s*Bodega León, Blvd\. Aeropuerto 1200/.test(t) && n === 1, `un solo lugar: ${/Bodega León/.test(t) ? "sale" : "NO sale"}; ${n} hoja(s)`);
});
await caso("hj-24-telefono", "", async p => {
  const ancha = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const r = await p.getByRole("button", { name: PROD }).first().boundingBox();
  ok("hj-24-telefono", !ancha && !!r && r.x >= 0 && r.x + r.width <= 390, `a 390 px: ${ancha ? "la página se sale a lo ancho" : "cabe"}; el botón ${r ? Math.round(r.x) + "-" + Math.round(r.x + r.width) : "no está"}`);
}, { viewport: { width: 390, height: 844 } });

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nhoja: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
