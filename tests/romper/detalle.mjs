// Tratar de ROMPER el DETALLE DE LA ORDEN (DetailModal) en su banco. Cada caso afirma lo que DEBERÍA ver o poder hacer la
// persona (Karla folia y entrega, producción avanza, Marcelo administra, un vendedor sólo ve lo suyo): una FALLA es un bug.
// Los datos salen del banco (tests/banco/gen-detalle.mjs), copiados de órdenes reales (P-0554, P-0571, P-0580, P-0607…).
// Uso: node detalle.mjs <dir-capturas> [puerto=5196]
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5196);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, viewport = { width: 1366, height: 768 }) {
  const page = await browser.newPage({ viewport });
  const errs = [], popups = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  page.on("popup", async pp => { popups.push(pp.url()); await pp.close().catch(() => {}); });
  page.on("dialog", async d => { errs.push("diálogo del navegador: " + d.message().slice(0, 60)); await d.dismiss().catch(() => {}); });
  page.popups = popups;
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#abrir-detalle");
    await page.click("#abrir-detalle"); await page.waitForTimeout(700);
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png" }).catch(() => {});
  await page.close();
}
const espera = (p, ms = 300) => p.waitForTimeout(ms);
const log = async p => (await p.textContent("#log")) || "";
const dlg = p => p.getByRole("dialog").first();
const textoDlg = p => dlg(p).evaluate(d => d.innerText);
// los botones visibles del diálogo con fondo oscuro o saturado («relleno»), por su texto
const rellenos = p => p.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(",").map(x => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const mezcla = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const fondo = el => { const capas = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) capas.push(c); } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = capas.length - 1; i >= 0; i--) base = mezcla(capas[i], base); return base; };
  return [...d.querySelectorAll("button")].filter(b => b.offsetParent && b.textContent.trim()).map(b => ({ t: b.textContent.trim().slice(0, 32), l: lum(fondo(b)) })).filter(x => x.l < 0.4).map(x => x.t);
});
// contraste de TODO el texto del diálogo (también el de los botones), compuesto contra su fondo real
const peoresContrastes = p => p.evaluate(() => {
  const raiz = [...document.querySelectorAll('[role="dialog"]')].pop();
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
    if (cr < (grande ? 3 : 4.5)) malos.push(cr.toFixed(1) + ":1 «" + el.textContent.trim().slice(0, 30) + "»");
  }
  return malos;
});
// el encabezado = lo que se ve arriba SIN bajar: todo lo que está por encima del cuerpo que hace scroll (o los primeros 190 px)
const encabezado = p => p.evaluate(() => {
  const d = document.querySelector('[role="dialog"]'); const top = d.getBoundingClientRect().top;
  let cuerpo = [...d.querySelectorAll("*")].find(e => e !== d && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4);
  const limite = cuerpo ? cuerpo.getBoundingClientRect().top : top + 190;
  return [...d.querySelectorAll("*")].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && e.getBoundingClientRect().bottom <= limite + 1 && e.getBoundingClientRect().height > 0)
    .map(e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("")).join(" ");
});
const abrirMas = async p => { const b = p.getByRole("button", { name: /Más acciones/ }); if (!(await b.count())) return false; await b.click(); await espera(p, 250); return true; };
const itemsMas = p => p.getByRole("menuitem").evaluateAll(xs => xs.map(x => x.textContent.trim()));
// ¿Se VE ese texto en el diálogo? Con innerText, que deja fuera lo escondido: textContent lo cuenta, y el pie entero «empezaba»
// con la guía aunque estuviera oculta (det-57 y det-75 pasaban contra v10.84.47; lo destapó la corrida doble)
const guiaVisible = (p, re) => dlg(p).evaluate((d, src) => new RegExp(src).test(d.innerText), re.source);

// ── P1: borrar el archivo de producción mira lo que contesta la base ───────────────────────────────────────────────────
const pedirBorrar = async p => {
  await p.getByRole("link", { name: /arte final\.pdf/ }).click(); await espera(p, 900);
  const si = p.getByRole("button", { name: /^Sí, borrar|^Borrar del servidor/ });
  if (await si.count()) { await si.click(); await espera(p, 600); return true; }
  return false;
};
await caso("det-01-borrar-storage-falla", "caso=archivo&rol=preprensa&falla=storage", async p => {
  const pidio = await pedirBorrar(p);
  const l = await log(p), t = await textoDlg(p);
  ok("det-01-borrar-storage-falla", pidio && /storage:remove/.test(l) && !/tabla:update/.test(l) && /no se pudo/i.test(t) && /arte final\.pdf/.test(t),
    `si Storage no borra: ${/tabla:update/.test(l) ? "la orden SE QUEDÓ sin archivo" : "la orden conserva su archivo"}; ${/no se pudo/i.test(t) ? "lo dice" : "NO lo dice"}`);
});
await caso("det-02-borrar-tabla-falla", "caso=archivo&rol=preprensa&falla=tabla", async p => {
  const pidio = await pedirBorrar(p);
  const t = await textoDlg(p);
  ok("det-02-borrar-tabla-falla", pidio && /no se pudo|no se actualizó|no quedó/i.test(t), "si la orden no se actualiza, el detalle " + (/no se pudo|no se actualizó|no quedó/i.test(t) ? "lo dice" : "NO lo dice"));
});
await caso("det-03-borrar-bien", "caso=archivo&rol=preprensa", async p => {
  const pidio = await pedirBorrar(p);
  const l = await log(p);
  const sigue = await p.getByRole("link", { name: /arte final\.pdf/ }).count();
  ok("det-03-borrar-bien", pidio && /storage:remove/.test(l) && /tabla:update/.test(l) && sigue === 0, `borrado: ${sigue ? "el detalle SIGUE enseñando el archivo" : "el archivo ya no sale"}`);
});
await caso("det-04-borrar-dice-que-archivo", "caso=archivo&rol=preprensa", async p => {
  await p.getByRole("link", { name: /arte final\.pdf/ }).click(); await espera(p, 900);
  const t = await textoDlg(p);
  ok("det-04-borrar-dice-que-archivo", /¿Ya descargaste «arte final\.pdf»\?|¿Borrar «arte final\.pdf»/.test(t), "la pregunta de borrar " + (/«arte final\.pdf»/.test(t) ? "nombra el archivo" : "NO nombra el archivo"));
});

// ── P1: el foco no se sale del diálogo ──────────────────────────────────────────────────────────────────────────────────
for (const [n, tecla] of [["det-05-tab-no-se-sale", "Tab"], ["det-06-shift-tab-no-se-sale", "Shift+Tab"]]) {
  await caso(n, "caso=salidas&rol=karla", async p => {
    let fuera = 0; for (let i = 0; i < 30; i++) { await p.keyboard.press(tecla); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) fuera++; }
    ok(n, fuera === 0, `de 30 ${tecla}, ${fuera} sacaron el foco del detalle`);
  });
}

// ── P2: el pie queda al ras del borde (nada se asoma debajo) ───────────────────────────────────────────────────────────
for (const [n, q, vp] of [["det-10-pie-al-ras", "caso=factura&rol=karla", { width: 1366, height: 768 }], ["det-11-pie-al-ras-1920", "caso=salidas&rol=admin", { width: 1920, height: 1080 }]]) {
  await caso(n, q, async p => {
    const mide = () => p.evaluate(() => {
      const d = document.querySelector('[role="dialog"]'); const r = d.getBoundingClientRect();
      const bots = [...d.querySelectorAll("button")].filter(b => /^Cerrar$/.test(b.textContent.trim()));
      const pie = bots.length ? bots[bots.length - 1].getBoundingClientRect() : null;
      return { abajo: Math.round(r.bottom), pie: pie ? Math.round(pie.bottom) : null };
    });
    // entre «Cerrar» y el borde del diálogo sólo cabe el margen del pie: si algo del cuerpo se asoma ahí, falla. Se mide AL
    //   ABRIR (con el cuerpo arriba, que es cuando se asomaba) y con el cuerpo hasta el fondo.
    const asomaAhora = () => p.evaluate(() => {
      const d = document.querySelector('[role="dialog"]'); const r = d.getBoundingClientRect();
      const bots = [...d.querySelectorAll("button")].filter(x => /^Cerrar$/.test(x.textContent.trim()));
      const yb = bots[bots.length - 1].getBoundingClientRect().bottom;
      const vistos = [];
      for (let y = Math.ceil(yb) + 2; y < r.bottom - 1; y += 3) for (const x of [r.left + 40, r.left + r.width / 2, r.right - 60]) {
        const el = document.elementFromPoint(x, y); if (el && d.contains(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) vistos.push(el.textContent.trim().slice(0, 20));
      }
      return [...new Set(vistos)];
    });
    const a = await mide(), asomaArriba = await asomaAhora();
    await dlg(p).evaluate(d => { for (const e of [d, ...d.querySelectorAll("*")]) if (/(auto|scroll)/.test(getComputedStyle(e).overflowY)) e.scrollTop = e.scrollHeight; });
    await espera(p, 300);
    const b = await mide(), asomaAbajo = await asomaAhora();
    const asoma = [...new Set([...asomaArriba, ...asomaAbajo])];
    ok(n, a.pie !== null && asoma.length === 0 && b.abajo - b.pie <= 28, `bajo «Cerrar» se asoma: ${asoma.join(" | ") || "nada"} (borde ${b.abajo}, botón ${b.pie})`);
  }, vp);
}

// ── P2: UNA acción rellena (la del rol), lo demás teñido, y todo pasa contraste ─────────────────────────────────────────
for (const [n, q, espero] of [
  ["det-12-karla-salidas-una-rellena", "caso=salidas&rol=karla", /^Asignar Folio y Entregar/],
  ["det-13-admin-borrador-una-rellena", "caso=borrador&rol=admin", /^Enviar a Diseño/],
  ["det-14-produccion-borrador-una-rellena", "caso=borrador&rol=produccion", /^Validar Producción/],
  ["det-15-sin-flujo-imprimir-rellena", "caso=factura&rol=karla", /^Imprimir/],
]) {
  await caso(n, q, async p => {
    const r = await rellenos(p);
    ok(n, r.length === 1 && espero.test(r[0]), `rellenos: ${r.join(" | ") || "ninguno"}`);
  });
}
for (const [n, q] of [["det-16-contraste-salidas", "caso=salidas&rol=karla"], ["det-17-contraste-borrador", "caso=borrador&rol=admin"], ["det-18-contraste-factura-admin", "caso=factura&rol=admin"], ["det-19-contraste-cancelada", "caso=cancelada&rol=admin"]]) {
  await caso(n, q, async p => {
    const m = await peoresContrastes(p);
    ok(n, m.length === 0, m.length ? m.slice(0, 4).join(" · ") : "todo se lee (≥ 4.5:1)");
  });
}

// ── P2: lo raro y lo destructivo, en «⋯ Más» (con su explicación); el pie sin repetir «editar» ───────────────────────────
await caso("det-20-cancelar-nc-en-mas", "caso=factura&rol=admin", async p => {
  const suelto = await p.getByRole("button", { name: /Cancelar Orden \(con NC\)/ }).count();
  const hay = await abrirMas(p);
  const items = hay ? await itemsMas(p) : [];
  ok("det-20-cancelar-nc-en-mas", suelto === 0 && items.some(x => /Cancelar con nota de crédito/i.test(x)), `suelto: ${suelto ? "SÍ (botón rojo enorme)" : "no"}; en «Más»: ${items.join(" | ") || "(no hay «Más»)"}`);
});
await caso("det-21-anticipado-en-mas", "caso=maquila&rol=karla", async p => {
  const suelto = await p.getByRole("button", { name: /Asignar Folio Anticipado/ }).count();
  const hay = await abrirMas(p);
  const items = hay ? await itemsMas(p) : [];
  ok("det-21-anticipado-en-mas", suelto === 0 && items.some(x => /folio anticipado/i.test(x)), `suelto: ${suelto ? "SÍ (tarjeta naranja)" : "no"}; en «Más»: ${items.join(" | ") || "(no hay «Más»)"}`);
});
await caso("det-22-regresar-en-mas", "caso=salidas&rol=karla", async p => {
  const suelto = await p.getByRole("button", { name: /^Regresar$/ }).count();
  const hay = await abrirMas(p);
  const items = hay ? await itemsMas(p) : [];
  ok("det-22-regresar-en-mas", suelto === 0 && items.some(x => /Regresar/.test(x)), `suelto: ${suelto ? "SÍ" : "no"}; en «Más»: ${items.join(" | ") || "(no hay «Más»)"}`);
});
await caso("det-23-mas-explica", "caso=cancelada&rol=admin", async p => {
  const hay = await abrirMas(p);
  const t = hay ? await p.getByRole("menu").innerText() : "";
  ok("det-23-mas-explica", /Deshacer cancelación/.test(t) && /vuelve a/i.test(t), "«Deshacer cancelación» en «Más» " + (/vuelve a/i.test(t) ? "dice qué hace" : "NO dice qué hace"));
});
await caso("det-24-mas-despacha", "caso=factura&rol=admin", async p => {
  await abrirMas(p);
  await p.getByRole("menuitem", { name: /Cancelar con nota de crédito/i }).click(); await espera(p, 300);
  ok("det-24-mas-despacha", /accion:cancel_with_nc/.test(await log(p)), "elegir «Cancelar con nota de crédito» " + (/accion:cancel_with_nc/.test(await log(p)) ? "pide la cancelación (con su propio diálogo)" : "NO hace nada"));
});
await caso("det-25-esc-cierra-el-menu-primero", "caso=factura&rol=admin", async p => {
  await abrirMas(p);
  await p.keyboard.press("Escape"); await espera(p, 250);
  const menu = await p.getByRole("menu").count(), d1 = await p.getByRole("dialog").count();
  await p.keyboard.press("Escape"); await espera(p, 250);
  const d2 = await p.getByRole("dialog").count();
  ok("det-25-esc-cierra-el-menu-primero", menu === 0 && d1 === 1 && d2 === 0, `1er Esc: menú ${menu ? "abierto" : "cerrado"}, detalle ${d1 ? "abierto" : "CERRADO"}; 2º Esc: detalle ${d2 ? "abierto" : "cerrado"}`);
});
await caso("det-26-un-editar", "caso=borrador&rol=admin", async p => {
  const eds = await p.getByRole("button", { name: /^(Editar|Revisar y Editar)$/ }).evaluateAll(xs => xs.filter(x => x.offsetParent).map(x => x.textContent.trim()));
  ok("det-26-un-editar", eds.length === 1, `botones de editar la orden: ${eds.join(" | ") || "ninguno"}`);
});

// ── P2: el encabezado dice de quién, qué, cuánto y para cuándo (sin bajar); la imagen como miniatura ─────────────────────
await caso("det-27-encabezado-karla", "caso=factura&rol=karla", async p => {
  const t = await encabezado(p);
  const falta = [["cliente", /SILVIA MARGARITA/], ["cantidad", /5,000 pzas/], ["importe", /\$5,649\.00/], ["entrega", /29/], ["folio", /F-117/]].filter(([, re]) => !re.test(t)).map(([k]) => k);
  ok("det-27-encabezado-karla", falta.length === 0, falta.length ? "arriba falta: " + falta.join(", ") : "arriba: de quién, qué, cuánto, para cuándo y el folio");
});
await caso("det-28-sin-id-interno-arriba", "caso=factura&rol=karla", async p => {
  const arriba = await encabezado(p), todo = await textoDlg(p);
  ok("det-28-sin-id-interno-arriba", !/OP-MUH77BVYVQW/.test(arriba) && /OP-MUH77BVYVQW/.test(todo), `id interno: arriba ${/OP-MUH77BVYVQW/.test(arriba) ? "SÍ" : "no"}; en el detalle ${/OP-MUH77BVYVQW/.test(todo) ? "sí (para soporte)" : "NO"}`);
});
await caso("det-29-miniatura", "caso=factura&rol=karla", async p => {
  const altos = await dlg(p).evaluate(d => [...d.querySelectorAll("img")].map(i => Math.round(i.getBoundingClientRect().height)));
  ok("det-29-miniatura", altos.length > 0 && Math.max(...altos) <= 96, `alto de las imágenes al abrir: ${altos.join(", ") || "ninguna"} px`);
});
await caso("det-30-miniatura-se-amplia", "caso=factura&rol=karla", async p => {
  await dlg(p).locator("img").first().click(); await espera(p, 600);
  ok("det-30-miniatura-se-amplia", p.popups.length >= 1 || (await p.locator('[role="dialog"] img').evaluateAll(xs => xs.some(i => i.getBoundingClientRect().height > 300))), `tocar la imagen ${p.popups.length ? "la abre en grande" : "NO la abre"}`);
});
await caso("det-31-vendedor-ajeno-sin-precio", "caso=factura&rol=vendedor&login=genaro", async p => {
  const t = await textoDlg(p);
  ok("det-31-vendedor-ajeno-sin-precio", !/\$5,649/.test(t) && !/ALEJANDRA DELGADO/.test(t) && !/erigrafia/.test(t), "un vendedor que no es dueño " + (/\$5,649|ALEJANDRA|erigrafia/.test(t) ? "VE precio o contactos" : "no ve precio ni contactos"));
});
await caso("det-32-produccion-sin-precio", "caso=factura&rol=produccion", async p => {
  const t = await textoDlg(p);
  ok("det-32-produccion-sin-precio", !/\$5,649/.test(t), "producción " + (/\$5,649/.test(t) ? "VE el precio" : "no ve el precio"));
});

// ── Los menores ─────────────────────────────────────────────────────────────────────────────────────────────────────────
await caso("det-33-nc-sin-folio", "caso=cancelada&rol=admin", async p => {
  const t = await textoDlg(p);
  ok("det-33-nc-sin-folio", !/NC emitida/i.test(t), "cancelada SIN folio: " + (/NC emitida/i.test(t) ? "dice «NC emitida en SAT: Pendiente» (no hubo factura)" : "no habla de nota de crédito"));
});
await caso("det-34-flujo-vacio", "caso=cancelada&rol=admin", async p => {
  const t = await textoDlg(p);
  ok("det-34-flujo-vacio", !/\bFLUJO\b|\bFlujo\b/.test(t), /FLUJO|Flujo/.test(t) ? "sale «FLUJO» sin botones" : "sin rótulo vacío");
});
await caso("det-35-sin-emojis", "caso=resto&rol=karla", async p => {
  const t = await textoDlg(p);
  const em = t.match(/\p{Extended_Pictographic}/gu) || [];
  ok("det-35-sin-emojis", em.length === 0, em.length ? "emojis: " + [...new Set(em)].join(" ") : "sin emojis");
});
await caso("det-36-placa-solo-antes-de-ctp", "caso=factura&rol=karla", async p => {
  const entregada = /Nueva placa CTP requerida/.test(await textoDlg(p));
  ok("det-36-placa-solo-antes-de-ctp", !entregada, "en una orden ENTREGADA " + (entregada ? "sigue «Nueva placa CTP requerida»" : "ya no sale lo de la placa"));
});
await caso("det-37-placa-en-borrador", "caso=borrador&rol=admin", async p => {
  ok("det-37-placa-en-borrador", /Nueva placa CTP requerida/.test(await textoDlg(p)), "en un borrador, lo de la placa " + (/Nueva placa CTP requerida/.test(await textoDlg(p)) ? "sí sale" : "NO sale"));
});
await caso("det-38-precio-sin-repetir", "caso=factura&rol=karla", async p => {
  const t = await textoDlg(p);
  ok("det-38-precio-sin-repetir", !/Precio MXN/i.test(t), /Precio MXN/i.test(t) ? "«PRECIO» y «PRECIO MXN»" : "el precio se dice una vez");
});
await caso("det-39-descargar", "caso=archivo&rol=preprensa", async p => {
  const t = await textoDlg(p);
  ok("det-39-descargar", /Descargar/.test(t) && !/Click para/i.test(t), /Click para/i.test(t) ? "dice «Click para descargar»" : "dice «Descargar»");
});
await caso("det-40-visor-no-imprime", "caso=factura&rol=visor", async p => {
  const n = await p.getByRole("button", { name: /Imprimir/ }).count();
  ok("det-40-visor-no-imprime", n === 0, "el visor (sólo lectura) " + (n ? "VE «Imprimir»" : "no ve «Imprimir»"));
});

// ── Tercera vuelta: por donde NO se diseñó ─────────────────────────────────────────────────────────────────────────────
// el barrido: en cada etapa con el rol que la mueve, a lo más UNA acción rellena y todo el texto pasa AA
for (const [etapa, rol] of [["design", "preprensa"], ["proof_printing", "german"], ["proof_client", "secretaria"], ["ctp", "german"], ["placas_listas", "german"],
  ["ready", "produccion"], ["in_production", "produccion"], ["packaging", "produccion"], ["salidas", "karla"], ["maq_created", "secretaria"], ["maq_sent", "secretaria"],
  ["maq_in_progress", "secretaria"], ["maq_received", "karla"], ["delivered", "admin"]]) {
  const n = `det-41-barrido-${etapa}-${rol}`;
  await caso(n, `caso=salidas&etapa=${etapa}&rol=${rol}`, async p => {
    const r = await rellenos(p), m = await peoresContrastes(p);
    ok(n, r.length <= 1 && m.length === 0, `rellenos: ${r.join(" | ") || "ninguno"}; contraste: ${m.slice(0, 3).join(" · ") || "bien"}`);
  });
}
await caso("det-42-doble-clic-en-borrar", "caso=archivo&rol=preprensa", async p => {
  await p.getByRole("link", { name: /arte final\.pdf/ }).click(); await espera(p, 900);
  await p.getByRole("button", { name: /^Sí, borrar/ }).dblclick(); await espera(p, 700);
  const n = ((await log(p)).match(/storage:remove/g) || []).length;
  ok("det-42-doble-clic-en-borrar", n === 1, `doble clic en «Sí, borrar»: ${n} borrado(s) pedidos a Storage`);
});
await caso("det-43-reintentar-tras-error", "caso=archivo&rol=preprensa&falla=storage", async p => {
  await p.getByRole("link", { name: /arte final\.pdf/ }).click(); await espera(p, 900);
  await p.getByRole("button", { name: /^Sí, borrar/ }).click(); await espera(p, 500);
  const sigue = await p.getByRole("button", { name: /^Sí, borrar/ }).count();
  if (sigue) { await p.getByRole("button", { name: /^Sí, borrar/ }).click(); await espera(p, 500); }
  const l = await log(p);
  ok("det-43-reintentar-tras-error", sigue === 1 && (l.match(/storage:remove/g) || []).length === 2 && !/tabla:update/.test(l) && /no se pudo/i.test(await textoDlg(p)),
    `tras el error: ${sigue ? "se puede reintentar" : "NO se puede reintentar"}; la orden ${/tabla:update/.test(l) ? "SE QUEDÓ sin archivo" : "conserva su archivo"}`);
});
await caso("det-44-conservar-limpia", "caso=archivo&rol=preprensa&falla=storage", async p => {
  await p.getByRole("link", { name: /arte final\.pdf/ }).click(); await espera(p, 900);
  await p.getByRole("button", { name: /^Sí, borrar/ }).click(); await espera(p, 500);
  await p.getByRole("button", { name: /^Conservar/ }).click(); await espera(p, 300);
  const t = await textoDlg(p);
  ok("det-44-conservar-limpia", !/no se pudo/i.test(t) && /arte final\.pdf/.test(t), "«Conservar» " + (/no se pudo/i.test(t) ? "deja el error a la vista" : "cierra la pregunta y el error"));
});
await caso("det-45-clic-fuera-del-menu", "caso=factura&rol=admin", async p => {
  await abrirMas(p);
  await dlg(p).locator("text=Producto").first().click(); await espera(p, 300);
  ok("det-45-clic-fuera-del-menu", (await p.getByRole("menu").count()) === 0 && (await p.getByRole("dialog").count()) === 1, "clic dentro del detalle, fuera del menú: " + ((await p.getByRole("menu").count()) ? "el menú SIGUE abierto" : "cierra el menú y el detalle sigue"));
});
await caso("det-46-menu-con-teclado", "caso=factura&rol=admin", async p => {
  await p.getByRole("button", { name: /Más acciones/ }).focus(); await p.keyboard.press("Enter"); await espera(p, 300);
  const foco = await p.evaluate(() => document.activeElement?.getAttribute("role"));
  await p.keyboard.press("Enter"); await espera(p, 300);
  ok("det-46-menu-con-teclado", foco === "menuitem" && /accion:/.test(await log(p)), `con el teclado: el foco ${foco === "menuitem" ? "entra al menú" : "NO entra al menú"} y Enter ${/accion:/.test(await log(p)) ? "elige" : "NO elige"}`);
});
await caso("det-47-menu-cabe", "caso=factura&rol=admin", async p => {
  await abrirMas(p);
  const r = await p.evaluate(() => { const m = document.querySelector('[role="menu"]').getBoundingClientRect(), d = document.querySelector('[role="dialog"]').getBoundingClientRect(); return { m: [m.top, m.bottom], d: [d.top, d.bottom], h: innerHeight }; });
  ok("det-47-menu-cabe", r.m[0] >= r.d[0] - 1 && r.m[1] <= r.d[1] + 1 && r.m[0] >= 0, `el menú va de ${Math.round(r.m[0])} a ${Math.round(r.m[1])}; el detalle de ${Math.round(r.d[0])} a ${Math.round(r.d[1])}`);
});
for (const [n, q, vp] of [["det-48-tablet", "caso=salidas&rol=karla", { width: 834, height: 1112 }], ["det-49-nombre-largo", "caso=factura&rol=admin&cliente=" + encodeURIComponent("FABRICACIÓN Y DISTRIBUCIÓN DE ARTÍCULOS PROMOCIONALES DEL BAJÍO SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE"), { width: 1366, height: 768 }]]) {
  await caso(n, q, async p => {
    const r = await dlg(p).evaluate(d => { const x = [...d.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Cerrar"); const rx = x.getBoundingClientRect(), rd = d.getBoundingClientRect();
      return { desborda: d.scrollWidth > d.clientWidth + 1 || [...d.querySelectorAll("*")].some(e => e.getBoundingClientRect().right > rd.right + 1 && e.offsetParent), x: rx.right <= rd.right + 1 && rx.left >= rd.left }; });
    ok(n, !r.desborda && r.x, `${r.desborda ? "algo se SALE del detalle a lo ancho" : "nada se sale a lo ancho"}; la «×» ${r.x ? "se ve" : "queda FUERA"}`);
  }, vp);
}
await caso("det-50-en-espera", "caso=espera&rol=karla", async p => {
  const t = await textoDlg(p);
  const quitar = await p.getByRole("button", { name: /Quitar espera/ }).count();
  ok("det-50-en-espera", /En espera:/.test(t) && quitar === 1 && (await rellenos(p)).length <= 1, `en espera: ${/En espera:/.test(t) ? "lo dice" : "NO lo dice"}; «Quitar espera» ${quitar ? "está" : "NO está"}`);
});
await caso("det-51-maquila-sin-precio", "caso=maquila&rol=karla", async p => {
  const t = await textoDlg(p);
  ok("det-51-maquila-sin-precio", !/NaN|\$0\.00|undefined|null/.test(t), /NaN|\$0\.00|undefined|null/.test(t) ? "sale basura: " + (t.match(/NaN|\$0\.00|undefined|null/) || [])[0] : "sin precio, no inventa uno");
});
await caso("det-52-sin-imagen", "caso=maquila&rol=karla", async p => {
  const imgs = await dlg(p).locator("img").count();
  const t = await encabezado(p);
  ok("det-52-sin-imagen", imgs === 0 && /LIC\. ORLANDO CASAS/.test(t), `sin imagen: ${imgs} imágenes; el encabezado ${/ORLANDO/.test(t) ? "dice el cliente" : "NO dice el cliente"}`);
});

// ── Segunda critique (37/40): el «Nombre interno» (ClientAliasManager, sólo admin y secretaría lo administran) ─────────────
await caso("det-53-nombre-interno-contraste", "caso=factura&rol=admin", async p => {
  const m = await peoresContrastes(p);
  ok("det-53-nombre-interno-contraste", m.length === 0, m.length ? m.slice(0, 3).join(" · ") : "todo se lee (≥ 4.5:1)");
});
await caso("det-54-nombre-interno-despues-del-contacto", "caso=factura&rol=admin", async p => {
  const r = await dlg(p).evaluate(d => {
    const ni = [...d.querySelectorAll("*")].find(e => /^Nombre interno$/i.test(e.textContent.trim()) && e.children.length <= 1);
    const rfc = [...d.querySelectorAll("dt")].find(e => /RFC/i.test(e.textContent));
    return ni && rfc ? { ni: Math.round(ni.getBoundingClientRect().top), rfc: Math.round(rfc.getBoundingClientRect().top) } : null;
  });
  ok("det-54-nombre-interno-despues-del-contacto", !!r && r.ni > r.rfc, r ? `«Nombre interno» en y=${r.ni}; el RFC en y=${r.rfc}` : "no encontré el «Nombre interno» o el RFC");
});
await caso("det-55-nombre-interno-error-en-tinta", "caso=factura&rol=admin&falla=alias", async p => {
  await p.getByPlaceholder("+ nombre interno").fill("SILVIA MTZ"); await p.keyboard.press("Enter"); await espera(p, 500);
  const t = await textoDlg(p), m = await peoresContrastes(p);
  ok("det-55-nombre-interno-error-en-tinta", /permiso denegado/.test(t) && m.length === 0, `si la base rechaza: ${/permiso denegado/.test(t) ? "lo dice" : "NO lo dice"}; contraste: ${m.slice(0, 2).join(" · ") || "bien"}`);
});
await caso("det-56-nombre-interno-se-guarda", "caso=factura&rol=admin", async p => {
  await p.getByPlaceholder("+ nombre interno").fill("SILVIA MTZ"); await p.keyboard.press("Enter"); await espera(p, 500);
  const t = await textoDlg(p);
  ok("det-56-nombre-interno-se-guarda", /SILVIA MTZ/.test(t) && /rpc:add_client_alias/.test(await log(p)) && (await p.getByRole("dialog").count()) === 1,
    `agregar un nombre interno con Enter: ${/SILVIA MTZ/.test(t) ? "sale como etiqueta" : "NO sale"} y el detalle ${(await p.getByRole("dialog").count()) ? "sigue abierto" : "SE CERRÓ"}`);
});

// ── Cuarta pasada (35/40, mirando los roles de piso) ─────────────────────────────────────────────────────────────────────
await caso("det-57-guia-sin-botones", "caso=salidas&etapa=ctp&rol=german", async p => {
  // (corregida en la vuelta 2: buscaba la guía del admin, «Arrastra a CTP en el Tablero Germán»; la de Germán es otra)
  const vis = await guiaVisible(p, /Arrastra esta orden a CTP y Procesadora/);
  ok("det-57-guia-sin-botones", vis, "Germán en CTP (sin botón): la guía de qué sigue " + (vis ? "se ve" : "NO se ve"));
});
await caso("det-58-sin-cliente-vacio", "caso=factura&rol=produccion", async p => {
  const vacio = await dlg(p).evaluate(d => { const r = [...d.querySelectorAll("div")].find(x => x.textContent.trim() === "Cliente" && x.children.length <= 1);
    if (!r) return false; const sig = r.nextElementSibling; return !sig || /^(Producto|Especificaciones)$/i.test(sig.textContent.trim()); });
  ok("det-58-sin-cliente-vacio", !vacio, vacio ? "producción ve el rótulo «CLIENTE» sin nada debajo" : "sin rótulos vacíos");
});
await caso("det-59-no-pide-factura-en-mas", "caso=salidas&rol=karla", async p => {
  const suelto = await p.getByRole("button", { name: /El cliente no pide factura/ }).count();
  const hay = await abrirMas(p);
  const t = hay ? await p.getByRole("menu").innerText() : "";
  let despacha = false;
  if (/no ha pedido factura/i.test(t)) { await p.getByRole("menuitem", { name: /no ha pedido factura/i }).click(); await espera(p, 300); despacha = /accion:snooze_invoice/.test(await log(p)); }
  ok("det-59-no-pide-factura-en-mas", suelto === 0 && /no ha pedido factura/i.test(t) && /hasta que (el cliente )?(la )?pida/i.test(t) && despacha,
    `suelto: ${suelto ? "SÍ" : "no"}; en «Más»: ${/no ha pedido factura/i.test(t) ? (/hasta que/i.test(t) ? "con su explicación" : "SIN explicación") : "NO está"}; ${despacha ? "la pone en espera" : "no hace nada"}`);
});
await caso("det-60-pie-dos-renglones", "caso=salidas&rol=karla", async p => {
  // sólo los botones del pie (el último hijo del diálogo): los del cuerpo que quedan cerca del borde no cuentan
  const filas = await dlg(p).evaluate(d => { const bs = [...d.lastElementChild.querySelectorAll("button")].filter(b => b.offsetParent);
    return [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().top / 8)))].length; });
  ok("det-60-pie-dos-renglones", filas <= 2, `renglones de botones en el pie: ${filas}`);
});
await caso("det-61-ctrl-enter-accion-del-rol", "caso=salidas&rol=karla", async p => {
  await p.keyboard.press("Control+Enter"); await espera(p, 300);
  ok("det-61-ctrl-enter-accion-del-rol", /accion:deliver_with_invoice/.test(await log(p)), "Ctrl+Enter " + (/accion:deliver_with_invoice/.test(await log(p)) ? "hace «Asignar Folio y Entregar»" : "NO hace nada"));
});
await caso("det-62-ctrl-enter-imprimir", "caso=factura&rol=karla", async p => {
  await p.keyboard.press("Control+Enter"); await espera(p, 300);
  ok("det-62-ctrl-enter-imprimir", /imprimir/.test(await log(p)), "sin acción de flujo, Ctrl+Enter " + (/imprimir/.test(await log(p)) ? "imprime" : "NO hace nada"));
});
await caso("det-63-ctrl-enter-no-escribiendo", "caso=factura&rol=admin", async p => {
  await p.getByPlaceholder("+ nombre interno").fill("SILVIA"); await p.getByPlaceholder("+ nombre interno").press("Control+Enter"); await espera(p, 300);
  const l = await log(p);
  ok("det-63-ctrl-enter-no-escribiendo", !/accion:|imprimir/.test(l) && (await p.getByRole("dialog").count()) === 1, "Ctrl+Enter escribiendo un nombre interno " + (/accion:|imprimir/.test(l) ? "DISPARA la acción" : "no dispara nada"));
});
await caso("det-64-atajo-declarado", "caso=salidas&rol=karla", async p => {
  const n = await dlg(p).locator('button[aria-keyshortcuts="Control+Enter"]').evaluateAll(xs => xs.filter(x => x.offsetParent).map(x => x.textContent.trim()));
  ok("det-64-atajo-declarado", n.length === 1 && /Asignar Folio y Entregar/.test(n[0]), `botón con el atajo declarado: ${n.join(" | ") || "ninguno"}`);
});
await caso("det-65-encabezado-sin-hueco", "caso=salidas&rol=produccion&sinentrega=1", async p => {
  const hueco = await dlg(p).evaluate(d => { const enc = d.firstElementChild; return [...enc.querySelectorAll("div")].some(x => x.childElementCount === 0 && !x.textContent.trim() && parseFloat(getComputedStyle(x).marginTop) > 0); });
  ok("det-65-encabezado-sin-hueco", !hueco, hueco ? "el encabezado deja un renglón vacío (sin entrega ni importe a la vista)" : "sin renglones vacíos arriba");
});

// ── Cuarta pasada, vuelta 3: por donde NO se diseñó (el atajo y la guía en los casos raros) ──────────────────────────────
const primeraAccion = l => (l.match(/accion:\S+|imprimir/) || ["nada"])[0];
await caso("det-66-guia-y-atajo-sin-botones", "caso=salidas&etapa=ctp&rol=admin", async p => {
  const vis = await guiaVisible(p, /Arrastra a CTP en el Tablero/);
  await p.keyboard.press("Control+Enter"); await espera(p, 300);
  const l = await log(p);
  ok("det-66-guia-y-atajo-sin-botones", vis && /imprimir/.test(l) && !/accion:/.test(l), `admin en CTP sin máquina: la guía ${vis ? "se ve" : "NO se ve"}; Ctrl+Enter hace: ${primeraAccion(l)}`);
});
await caso("det-67-ctrl-enter-con-mas-abierto", "caso=salidas&rol=karla", async p => {
  const hay = await abrirMas(p);
  await p.keyboard.press("Control+Enter"); await espera(p, 300);
  const l = await log(p);
  ok("det-67-ctrl-enter-con-mas-abierto", hay && !/accion:|imprimir/.test(l) && (await p.getByRole("dialog").count()) === 1,
    `con «Más» abierto (el foco en su primera opción), Ctrl+Enter hace: ${primeraAccion(l)}`);
});
await caso("det-68-doble-ctrl-enter", "caso=salidas&rol=karla", async p => {
  await p.keyboard.press("Control+Enter"); await p.keyboard.press("Control+Enter"); await espera(p, 400);
  const n = ((await log(p)).match(/accion:deliver_with_invoice/g) || []).length;
  ok("det-68-doble-ctrl-enter", n === 1, `dos Ctrl+Enter seguidos: «Asignar Folio y Entregar» ${n} ${n === 1 ? "vez" : "veces"}`);
});
await caso("det-69-cambia-con-el-detalle-abierto", "caso=salidas&rol=karla", async p => {
  await p.evaluate(() => window.__cambiar({ invoice_folio: "F-200", invoice_type: "factura" })); await espera(p, 400);
  const n = await dlg(p).locator('button[aria-keyshortcuts="Control+Enter"]').evaluateAll(xs => xs.filter(x => x.offsetParent).map(x => x.textContent.trim()));
  const hay = await abrirMas(p); const t = hay ? await p.getByRole("menu").innerText() : "";
  if (hay) { await p.keyboard.press("Escape"); await espera(p, 250); }
  await p.keyboard.press("Control+Enter"); await espera(p, 300);
  const l = await log(p);
  ok("det-69-cambia-con-el-detalle-abierto", n.length === 1 && /Marcar como Entregada/.test(n[0]) && !/no ha pedido factura/i.test(t) && /accion:deliver_only/.test(l) && !/deliver_with_invoice/.test(l),
    `le ponen folio con el detalle abierto: el atajo en ${n.join(" | ") || "ningún botón"}; «Poner en espera» ${/no ha pedido factura/i.test(t) ? "SIGUE en «Más»" : "ya no sale"}; Ctrl+Enter hace: ${primeraAccion(l)}`);
});
await caso("det-70-ctrl-enter-con-foco-en-cerrar", "caso=salidas&rol=karla", async p => {
  await p.getByRole("button", { name: "Cerrar", exact: true }).last().focus();   // el del pie (arriba está la ×)
  await p.keyboard.press("Control+Enter"); await espera(p, 300);
  const l = await log(p), cerrado = (l.match(/cerrado/g) || []).length;
  ok("det-70-ctrl-enter-con-foco-en-cerrar", /accion:deliver_with_invoice/.test(l) && cerrado === 1, `el foco en «Cerrar»: Ctrl+Enter hace ${primeraAccion(l)} (cerrado ${cerrado} vez/veces)`);
});
await caso("det-71-ctrl-enter-boton-apagado", "caso=maquila&rol=admin", async p => {
  // «Recibimos el Trabajo» apagado (falta el precio al cliente): el atajo no lo brinca ni hace otra cosa
  await p.keyboard.press("Control+Enter"); await espera(p, 300);
  const l = await log(p);
  ok("det-71-ctrl-enter-boton-apagado", !/accion:|imprimir/.test(l) && (await p.getByRole("dialog").count()) === 1, `con la acción apagada, Ctrl+Enter hace: ${primeraAccion(l)}`);
});
const filasDelPie = p => dlg(p).evaluate(d => { const bs = [...d.lastElementChild.querySelectorAll("button")].filter(b => b.offsetParent);
  return [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().top / 8)))].length; });
await caso("det-72-pie-admin-1366", "caso=salidas&rol=admin", async p => {
  const f = await filasDelPie(p);
  ok("det-72-pie-admin-1366", f <= 2, `admin en Salidas a 1366: renglones de botones en el pie: ${f}`);
});
await caso("det-73-pie-karla-1920", "caso=salidas&rol=karla", async p => {
  const f = await filasDelPie(p);
  ok("det-73-pie-karla-1920", f <= 2, `karla en Salidas a 1920: renglones de botones en el pie: ${f}`);
}, { width: 1920, height: 1080 });
await caso("det-74-en-espera", "caso=espera&rol=karla", async p => {
  const hay = await abrirMas(p); const t = hay ? await p.getByRole("menu").innerText() : "";
  if (hay) { await p.keyboard.press("Escape"); await espera(p, 250); }
  await p.keyboard.press("Control+Enter"); await espera(p, 300);
  const l = await log(p);
  ok("det-74-en-espera", !/no ha pedido factura/i.test(t) && /imprimir/.test(l) && !/accion:/.test(l),
    `orden ya en espera: «Poner en espera» ${/no ha pedido factura/i.test(t) ? "SALE OTRA VEZ en «Más»" : "no sale"}; Ctrl+Enter hace: ${primeraAccion(l)}`);
});
await caso("det-76-escape-de-mas-regresa-el-foco", "caso=salidas&rol=karla", async p => {
  // el bug que encontraron det-69 y det-74: Escape cerraba «Más» y el foco se iba al <body> (sin Tab atrapado ni Ctrl+Enter)
  await abrirMas(p); await p.keyboard.press("Escape"); await espera(p, 250);
  const r = await p.evaluate(() => { const a = document.activeElement; return { dentro: !!a?.closest('[role="dialog"]'), quien: a?.getAttribute("aria-label") || a?.tagName }; });
  const abierto = (await p.getByRole("dialog").count()) === 1;
  await p.keyboard.press("Tab"); await espera(p, 100);
  const trasTab = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  ok("det-76-escape-de-mas-regresa-el-foco", r.dentro && /Más acciones/.test(r.quien) && abierto && trasTab,
    `Escape cierra «Más»: el foco queda en ${r.quien}${r.dentro ? "" : " (FUERA del diálogo)"}; el detalle ${abierto ? "sigue abierto" : "SE CERRÓ"}; Tab ${trasTab ? "sigue dentro" : "SE SALE al tablero"}`);
});
// ── vuelta 4: lo que podían romper los arreglos de la vuelta 3 ─────────────────────────────────────────────────────────
await caso("det-77-mas-se-cierra-con-clic-fuera", "caso=salidas&rol=karla", async p => {
  await abrirMas(p);
  await dlg(p).getByText("Especificaciones", { exact: false }).first().click(); await espera(p, 250);
  const menu = await p.getByRole("menu").count();
  await p.keyboard.press("Control+Enter"); await espera(p, 300);
  const l = await log(p);
  ok("det-77-mas-se-cierra-con-clic-fuera", menu === 0 && /accion:deliver_with_invoice/.test(l), `clic fuera de «Más»: el menú ${menu ? "SIGUE abierto" : "se cierra"}; luego Ctrl+Enter hace: ${primeraAccion(l)}`);
});
await caso("det-78-vendedor-ajeno-sin-atajo", "caso=salidas&rol=vendedor&login=otro", async p => {
  await p.keyboard.press("Control+Enter"); await espera(p, 300);
  const l = await log(p), n = await dlg(p).locator("[aria-keyshortcuts]").count();
  ok("det-78-vendedor-ajeno-sin-atajo", !/accion:|imprimir/.test(l) && n === 0 && (await p.getByRole("dialog").count()) === 1,
    `un vendedor con la orden de otro: Ctrl+Enter hace ${primeraAccion(l)}; botones con atajo: ${n}`);
});
await caso("det-79-enter-normal-en-mas", "caso=salidas&rol=karla", async p => {
  await abrirMas(p); await p.keyboard.press("Enter"); await espera(p, 300);
  const l = await log(p);
  ok("det-79-enter-normal-en-mas", /accion:snooze_invoice/.test(l), `Enter (sin Ctrl) en la opción enfocada de «Más» hace: ${primeraAccion(l)}`);
});
await caso("det-75-guia-produccion-lista", "caso=salidas&etapa=ready&rol=produccion", async p => {
  const vis = await guiaVisible(p, /Arrastra esta orden a una máquina/);
  ok("det-75-guia-produccion-lista", vis, `producción con la orden lista para imprimir: la guía ${vis ? "se ve" : "NO se ve"}`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\ndetalle: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
