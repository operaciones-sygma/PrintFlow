// Tratar de ROMPER «Planta» (v10.84.119: Gerardo acomoda las máquinas en el plano de la planta baja, agrega objetos con medidas, guarda
// versiones e imprime). Cada caso afirma lo que DEBERÍA pasarle a quien lo usa: una FALLA es un bug. Primero la geometría con Node (las
// encimadas, los choques con muros, las medidas, la escala de la hoja: src/lib/plano.js), luego la pantalla en su banco (gen-plano.mjs: el
// módulo diferido como en App, con la tabla de versiones en memoria) a 1366 y a 1920.
// Uso: node plano.mjs <dir-capturas> [puerto=5186]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5186);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
const SOLO = process.env.SOLO ? new RegExp(process.env.SOLO) : null;
const toca = n => !SOLO || SOLO.test(n);

// ── 1) la geometría, con Node ──
const G = await import(pathToFileURL(path.join(RAIZ, "src", "lib", "plano.js")).href);
const P = await import(pathToFileURL(path.join(RAIZ, "src", "plano", "plantaBaja.js")).href);
const H_ = await import(pathToFileURL(path.join(RAIZ, "src", "plano", "hoja.js")).href);
const OBST = [...G.segmentosDe(P.MUROS, "muro"), ...G.segmentosDe(P.VIDRIOS, "muro"), ...G.segmentosDe(P.DIVISIONES, "muro"), ...G.segmentosDe(P.FIJOS, "fijo"), ...G.segmentosDe(P.ESCALERAS, "fijo")];
const ORIG = G.limpiarPiezas(P.MAQUINAS).piezas;
const de = id => ORIG.find(p => p.id === id);
const caja = (x, y, largo, ancho, giro = 0, id = "c") => ({ id, nombre: id, numero: "", x, y, largo, ancho, giro, forma: null });
function geo(nombre, fn) { if (!toca(nombre)) return; try { fn(); } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message); } }

geo("pln-01-el-levantamiento-sin-falsos-choques", () => {
  const pr = G.problemas(ORIG, OBST);
  ok("pln-01-el-levantamiento-sin-falsos-choques", ORIG.length === 14 && Object.keys(pr).length === 0,
    `las ${ORIG.length} máquinas como están en el plano no se enciman ni chocan con nada: ${JSON.stringify(pr)}`);
});
geo("pln-02-encimadas-y-tocarse", () => {
  const a = caja(0, 0, 100, 100, 0, "a");
  const r = { lado: G.seEnciman(a, caja(100, 0, 100, 100)), unCm: G.seEnciman(a, caja(99, 0, 100, 100)), adentro: G.seEnciman(a, caja(0, 0, 10, 10)),
    esquina45: G.seEnciman(a, caja(100 + 70.72, 0, 100, 100, 45)), cruz: G.seEnciman(caja(0, 0, 300, 20), caja(0, 0, 20, 300)), lejos: G.seEnciman(a, caja(500, 500, 10, 10)) };
  ok("pln-02-encimadas-y-tocarse", !r.lado && r.unCm && r.adentro && !r.esquina45 && r.cruz && !r.lejos,
    `lado con lado no (${r.lado}), 1 cm adentro sí (${r.unCm}), una dentro de otra sí (${r.adentro}), girada tocando la esquina no (${r.esquina45}), en cruz sí (${r.cruz}), lejos no (${r.lejos})`);
});
geo("pln-03-choca-con-muro-columna-y-escalera", () => {
  const g5 = { ...de("m-5"), y: 1300 };   // (vuelta 1: a su altura original, junto al muro está la escalera del almacén: se baja a 13 m)
  const alMuro = G.choques({ ...g5, x: 20 }, OBST);                  // la guillotina 78 metida en el muro de la izquierda
  const libre = G.choques(g5, OBST);
  // (vuelta 1: «pegada» a 25 cm del borde de afuera seguía dentro del grueso del muro: la cara de adentro sale de los mismos trazos)
  const cara = Math.max(...OBST.filter(s => s.tipo === "muro" && s.cj.x1 < 120 && s.cj.y0 < g5.y + g5.ancho / 2 && s.cj.y1 > g5.y - g5.ancho / 2).map(s => s.cj.x1));
  const pegada = G.choques({ ...g5, x: cara + g5.largo / 2 }, OBST);        // tocando la cara de adentro
  const unCm = G.choques({ ...g5, x: cara + g5.largo / 2 - 1 }, OBST);       // 1 cm dentro del muro
  const escalera = G.choques(caja(137, 570, 60, 60), OBST);                  // sobre la escalera de la izquierda (la del almacén, 92-182 × 440-700)
  ok("pln-03-choca-con-muro-columna-y-escalera", alMuro.includes("muro") && libre.length === 0 && pegada.length === 0 && unCm.includes("muro") && escalera.includes("fijo"),
    `metida en el muro: ${JSON.stringify(alMuro)} (muro); en su lugar: ${JSON.stringify(libre)}; tocando la cara de adentro (x=${G.redondear(cara)}): ${JSON.stringify(pegada)} (nada); 1 cm adentro: ${JSON.stringify(unCm)} (muro); sobre la escalera: ${JSON.stringify(escalera)} (fijo)`);
});
geo("pln-04-medidas-que-se-capturan", () => {
  const m = s => G.leerMedida(s);
  const r = { coma: m("120,5").valor, cm: m("120 cm").valor, cero: m("0").error, neg: m("-5").error, letras: m("abc").error, mucho: m("6000").error, chica: m("5"), vacio: m("").error, exp: m("1e3").error };
  ok("pln-04-medidas-que-se-capturan", r.coma === 120.5 && r.cm === 120 && !!r.cero && !!r.neg && !!r.letras && !!r.mucho && r.chica.valor === 5 && !!r.chica.aviso && !!r.vacio && !!r.exp,
    JSON.stringify(r).slice(0, 300));
});
geo("pln-05-girar-da-la-vuelta", () => {
  let p = de("m-2"); for (let i = 0; i < 4; i++) p = G.girar(p, 90);
  const g = [G.normalizarGiro(270), G.normalizarGiro(-270), G.normalizarGiro(359.99), G.girar(de("m-12"), 90).giro];
  ok("pln-05-girar-da-la-vuelta", p.giro === 0 && g[0] === -90 && g[1] === 90 && g[2] === 0 && g[3] === 88.4, `4 × 90° = ${p.giro}; 270 → ${g[0]}; -270 → ${g[1]}; 359.99 → ${g[2]}; el Duplo (-1.6°) + 90 → ${g[3]}`);
});
geo("pln-06-la-escala-de-la-hoja", () => {
  // (vuelta 1: con el aire alrededor del dibujo, la planta en doble carta salía a 1:125; la de Gerardo es 1:100)
  const { HOJAS, MARGEN_DE_LA_HOJA: M, LADO_DE_LA_HOJA: L, HUECO_DE_LA_HOJA: H } = G;
  const d = H_.escalaDe(ORIG, "doble"), c = H_.escalaDe(ORIG, "carta");
  const fuera = [...ORIG, caja(P.CAJA.ancho + 2000, 500, 200, 200)];
  const df = H_.escalaDe(fuera, "doble");
  const cabe = (n, h, k) => k.ancho * 10 / n <= h.ancho - 2 * M - L - H && k.alto * 10 / n <= h.alto - 2 * M;
  ok("pln-06-la-escala-de-la-hoja", d === 100 && c === 200 && df > 100 && cabe(d, HOJAS.doble, H_.cajaParaImprimir(ORIG)) && cabe(df, HOJAS.doble, H_.cajaParaImprimir(fuera)),
    `la planta en doble carta 1:${d} (debe 1:100), en carta 1:${c} (1:200); con una pieza sacada 20 m, doble carta 1:${df} y ${cabe(df, HOJAS.doble, H_.cajaParaImprimir(fuera)) ? "cabe" : "NO CABE"}`);
});
geo("pln-07-piezas-danadas-se-dejan-fuera", () => {
  const r = G.limpiarPiezas([de("m-2"), { id: "x", nombre: "", x: 1, y: 1, largo: 1, ancho: 1 }, { ...de("m-5"), largo: -3 }, de("m-2"), { ...de("m-6"), giro: "a" }, { ...de("m-1"), forma: [[0, 0], [1]] }, null]);
  const nada = G.limpiarPiezas({ no: "es lista" });
  ok("pln-07-piezas-danadas-se-dejan-fuera", r.piezas.length === 1 && r.piezas[0].id === "m-2" && r.descartadas === 6 && nada.piezas.length === 0,
    `de 7 (una buena, una repetida y 5 dañadas): quedan ${r.piezas.length} (${r.piezas.map(p => p.id)}) y se descartan ${r.descartadas}; algo que no es lista: ${nada.piezas.length} piezas`);
});
geo("pln-08-la-L-se-estira-con-sus-medidas", () => {
  const t = de("m-3"), t2 = G.conMedidas(t, t.largo * 2, t.ancho);
  const c1 = G.caja(t2.forma);
  ok("pln-08-la-L-se-estira-con-sus-medidas", Math.abs(c1.ancho - t.largo * 2) < 0.5 && Math.abs(c1.alto - t.ancho) < 0.5 && t2.forma.length === t.forma.length,
    `el Tren (${t.largo} × ${t.ancho}) al doble de largo: su forma mide ${G.redondear(c1.ancho)} × ${G.redondear(c1.alto)}`);
});

// ── 2) la pantalla, en el banco ──
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
const V1366 = { width: 1366, height: 768 }, V1920 = { width: 1920, height: 1080 };
async function caso(nombre, query, fn, { viewport = V1366 } = {}) {
  if (!toca(nombre)) return;
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !deFuera(m)) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.locator("[data-plano-lienzo] polygon[data-pieza]").first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(300);
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png" }).catch(() => {});
  await page.close();
}
const log = async p => (await p.textContent("#log")) || "";
const lineas = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref));
const espera = (p, ms = 250) => p.waitForTimeout(ms);
const piezas = p => p.$$eval("[data-pieza]", els => els.map(e => {
  const pts = e.getAttribute("points").trim().split(/\s+/).map(s => s.split(",").map(Number));
  return { id: e.getAttribute("data-pieza"), cx: pts.reduce((a, q) => a + q[0], 0) / pts.length, cy: pts.reduce((a, q) => a + q[1], 0) / pts.length, n: pts.length,
    w: Math.max(...pts.map(q => q[0])) - Math.min(...pts.map(q => q[0])), h: Math.max(...pts.map(q => q[1])) - Math.min(...pts.map(q => q[1])), mal: e.getAttribute("data-mal") === "1", fill: e.getAttribute("fill") };
}));
const pieza = async (p, id) => (await piezas(p)).find(x => x.id === id);
const vista = p => p.$eval("[data-plano-lienzo] svg > g", g => { const m = /translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([-\d.e]+)\)/.exec(g.getAttribute("transform")); return { dx: +m[1], dy: +m[2], s: +m[3] }; });
const enPantalla = async (p, x, y) => { const v = await vista(p); const r = await p.$eval("[data-plano-lienzo]", e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top }; }); return { x: r.x + 1 + v.dx + x * v.s, y: r.y + 1 + v.dy + y * v.s }; };
// arrastra la pieza desde su centro dx × dy cm (en pasos, como una mano)
async function arrastrar(p, id, dx, dy, { soltar = true } = {}) {
  const q = await pieza(p, id), a = await enPantalla(p, q.cx, q.cy), v = await vista(p);
  await p.mouse.move(a.x, a.y); await p.mouse.down();
  await p.mouse.move(a.x + dx * v.s / 3, a.y + dy * v.s / 3, { steps: 3 });
  await p.mouse.move(a.x + dx * v.s, a.y + dy * v.s, { steps: 5 });
  if (soltar) { await p.mouse.up(); await espera(p, 150); }
}
const clicEn = async (p, id) => { const q = await pieza(p, id), a = await enPantalla(p, q.cx, q.cy); await p.mouse.click(a.x, a.y); await espera(p, 150); };
const estado = p => p.textContent("[data-plano-estado]");
const elegida = p => p.inputValue("input[name=pieza-nombre]").catch(() => "");   // el nombre de la pieza elegida (vive en su campo)
// el «Deshacer» del AVISO (vuelta 1: el de la barra también se llama «Deshacer»; el del aviso es el que tiene texto)
const deshacerDelAviso = p => p.locator("button", { hasText: /^\s*Deshacer\s*$/ }).last();
const panel = async p => (await p.textContent("[data-plano-panel]")).replace(/\s+/g, " ");
const dialogo = p => p.getByRole("dialog");
const textoDialogo = async p => { await dialogo(p).waitFor({ timeout: 3000 }); return (await dialogo(p).innerText()).replace(/\s+/g, " "); };
const tabla = p => p.evaluate(() => window.__tabla());
const guardarComo = async (p, nombre) => { await p.click("[data-plano-guardar]"); await dialogo(p).waitFor({ timeout: 3000 }); await p.fill("input[name=version-nombre]", nombre); await p.click("[data-plano-guardar-ok]"); await espera(p, 400); };
const avisos = async p => (await p.locator('[role="status"],[role="alert"]').allInnerTexts()).join(" | ").replace(/\s+/g, " ");

await caso("pln-10-al-abrir-el-levantamiento", "", async p => {
  const ps = await piezas(p);
  const nombres = await p.$$eval("[data-plano-lienzo] text", ts => ts.map(t => t.textContent));
  const ver = await p.$eval("[data-plano-version]", s => s.options[s.selectedIndex].text);
  const e = await estado(p);
  ok("pln-10-al-abrir-el-levantamiento", ps.length === 14 && !ps.some(x => x.mal) && ["PM-74", "Tren", "Dobladora", "Duplo", "CTP", "Guillotina 115"].every(n => nombres.includes(n)) && /levantamiento/i.test(ver) && /Sin cambios/.test(e),
    `${ps.length} piezas (14), rojas: ${ps.filter(x => x.mal).length}; nombres a la vista: ${["PM-74", "Tren", "Dobladora", "Duplo"].filter(n => nombres.includes(n)).join(",")}; versión «${ver}»; estado «${e}»`);
});
for (const [vp, nombre] of [[V1366, "pln-11-cabe-a-1366"], [V1920, "pln-11b-cabe-a-1920"]]) {
  await caso(nombre, "", async p => {
    const m = await p.evaluate(() => {
      const l = document.querySelector("[data-plano-lienzo]").getBoundingClientRect(), a = document.querySelector("[data-plano-panel]").getBoundingClientRect();
      const g = document.querySelector("[data-plano-muros]").getBoundingClientRect();
      return { lienzo: [Math.round(l.left), Math.round(l.top), Math.round(l.right), Math.round(l.bottom)], panel: [Math.round(a.left), Math.round(a.right), Math.round(a.bottom)],
        dibujo: [Math.round(g.left), Math.round(g.top), Math.round(g.right), Math.round(g.bottom)], scroll: document.documentElement.scrollWidth - innerWidth, alto: innerHeight, ancho: innerWidth };
    });
    const dentro = m.dibujo[0] >= m.lienzo[0] - 2 && m.dibujo[2] <= m.lienzo[2] + 2 && m.dibujo[1] >= m.lienzo[1] - 2 && m.dibujo[3] <= m.lienzo[3] + 2;
    ok(nombre, m.lienzo[3] <= m.alto && m.panel[2] <= m.alto && m.panel[1] <= m.ancho && m.scroll <= 0 && dentro && (m.lienzo[2] - m.lienzo[0]) >= 600 && (m.lienzo[3] - m.lienzo[1]) >= 380,
      `a ${vp.width}×${vp.height}: el lienzo ${m.lienzo.join(",")} (${m.lienzo[2] - m.lienzo[0]}×${m.lienzo[3] - m.lienzo[1]}), el panel hasta ${m.panel[1]},${m.panel[2]}, el dibujo ${m.dibujo.join(",")} ${dentro ? "adentro" : "SE SALE"}, scroll horizontal ${m.scroll}`);
  }, { viewport: vp });
}
await caso("pln-12-arrastrar-mueve-y-deshacer-regresa", "", async p => {
  const a = await pieza(p, "m-2");
  await arrastrar(p, "m-2", 300, 0);
  const b = await pieza(p, "m-2"), e = await estado(p);
  await p.click("[data-plano-deshacer]"); await espera(p);
  const c = await pieza(p, "m-2"), e2 = await estado(p);
  const mov = b.cx - a.cx;
  ok("pln-12-arrastrar-mueve-y-deshacer-regresa", Math.abs(mov - 300) <= 10 && Math.abs(Math.round(mov * 10) % 50) === 0 && Math.abs(b.cy - a.cy) < 0.01 && /sin guardar/i.test(e) && Math.abs(c.cx - a.cx) < 0.01 && /Sin cambios/.test(e2),
    `arrastrar 3 m la movió ${mov.toFixed(1)} cm (en pasos de 5) y ${(b.cy - a.cy).toFixed(1)} en vertical; estado «${e}»; deshacer la dejó a ${(c.cx - a.cx).toFixed(1)} cm de donde estaba, «${e2}»`);
});
await caso("pln-13-un-clic-no-cambia-nada", "", async p => {
  const a = await pieza(p, "m-6");
  await clicEn(p, "m-6");
  const b = await pieza(p, "m-6"), e = await estado(p), pan = await elegida(p);
  ok("pln-13-un-clic-no-cambia-nada", b.cx === a.cx && b.cy === a.cy && /Sin cambios/.test(e) && /Guillotina 115/.test(pan) && await p.$eval("[data-plano-deshacer]", b => b.disabled),
    `un clic la eligió (el panel: «${pan}») sin moverla (${(b.cx - a.cx).toFixed(2)}); estado «${e}»; deshacer ${await p.$eval("[data-plano-deshacer]", b => b.disabled) ? "apagado" : "PRENDIDO"}`);
});
await caso("pln-14-girar-con-boton-y-tecla", "", async p => {
  await clicEn(p, "m-2");
  const a = await pieza(p, "m-2");
  await p.click("[data-plano-girar-der]"); await espera(p);
  const b = await pieza(p, "m-2"), g1 = await p.inputValue("input[name=pieza-giro]");
  await p.keyboard.press("r"); await espera(p);
  const g2 = await p.inputValue("input[name=pieza-giro]");
  await p.keyboard.press("Shift+R"); await espera(p);
  const g3 = await p.inputValue("input[name=pieza-giro]");
  ok("pln-14-girar-con-boton-y-tecla", Math.abs(b.w - a.h) < 0.5 && Math.abs(b.h - a.w) < 0.5 && g1 === "90" && g2 === "180" && g3 === "90" && Math.abs(b.cx - a.cx) < 0.5,
    `antes ${a.w.toFixed(0)}×${a.h.toFixed(0)}, girada ${b.w.toFixed(0)}×${b.h.toFixed(0)} en el mismo centro; el giro: ⟳ ${g1}, R ${g2}, Shift+R ${g3}`);
});
await caso("pln-15-flechas-mueven-y-son-un-paso", "", async p => {
  await clicEn(p, "m-5");
  const a = await pieza(p, "m-5");
  for (let i = 0; i < 10; i++) await p.keyboard.press("ArrowRight");
  await p.keyboard.press("Shift+ArrowDown"); await espera(p);
  const b = await pieza(p, "m-5");
  await p.keyboard.press("Control+z"); await espera(p);
  const c = await pieza(p, "m-5");
  ok("pln-15-flechas-mueven-y-son-un-paso", Math.abs(b.cx - a.cx - 50) < 0.01 && Math.abs(b.cy - a.cy - 50) < 0.01 && Math.abs(c.cx - a.cx) < 0.01 && Math.abs(c.cy - a.cy) < 0.01,
    `10 × → movió ${(b.cx - a.cx).toFixed(1)} cm (50) y Shift+↓ ${(b.cy - a.cy).toFixed(1)} (50); un Ctrl+Z la dejó a ${(c.cx - a.cx).toFixed(1)}, ${(c.cy - a.cy).toFixed(1)} (todo de una vez)`);
});
await caso("pln-16-agregar-un-objeto", "", async p => {
  await p.click("[data-plano-agregar]");
  await p.fill("input[name=agregar-nombre]", "Mesa de empaque"); await p.fill("input[name=agregar-largo]", "240"); await p.fill("input[name=agregar-ancho]", "120");
  await p.click("[data-plano-agregar-ok]"); await espera(p);
  const ps = await piezas(p), nueva = ps.find(x => !/^m-/.test(x.id));
  const v = await vista(p), r = await p.$eval("[data-plano-lienzo]", e => ({ w: e.clientWidth, h: e.clientHeight }));
  const centro = { x: (r.w / 2 - v.dx) / v.s, y: (r.h / 2 - v.dy) / v.s };
  const pan = (await elegida(p)) + " · " + await panel(p), e = await estado(p);
  ok("pln-16-agregar-un-objeto", ps.length === 15 && !!nueva && Math.abs(nueva.w - 240) < 0.5 && Math.abs(nueva.h - 120) < 0.5 && Math.hypot(nueva.cx - centro.x, nueva.cy - centro.y) < 10 && /Mesa de empaque/.test(pan) && /Agregado/.test(pan) && /sin guardar/i.test(e),
    `${ps.length} piezas; la nueva ${nueva ? nueva.w.toFixed(0) + "×" + nueva.h.toFixed(0) + " a " + Math.hypot(nueva.cx - centro.x, nueva.cy - centro.y).toFixed(0) + " cm del centro de lo que se ve" : "NO SALIÓ"}; panel «${pan.slice(0, 70)}»; «${e}»`);
});
await caso("pln-17-agregar-con-medidas-malas", "", async p => {
  await p.click("[data-plano-agregar]");
  const prueba = async (nombre, largo, ancho) => { await p.fill("input[name=agregar-nombre]", nombre); await p.fill("input[name=agregar-largo]", largo); await p.fill("input[name=agregar-ancho]", ancho); await p.click("[data-plano-agregar-ok]"); await espera(p, 150); return { n: (await piezas(p)).length, err: (await p.locator("[data-plano-forma-agregar] [role=alert]").allInnerTexts()).join(" / ") }; };
  const r = [await prueba("", "100", "100"), await prueba("Tarima", "0", "100"), await prueba("Tarima", "-5", "abc"), await prueba("Tarima", "6000", "100"), await prueba("Tarima", "120,5", "80")];
  const ultima = (await piezas(p)).find(x => !/^m-/.test(x.id));
  ok("pln-17-agregar-con-medidas-malas", r.slice(0, 4).every(x => x.n === 14 && x.err) && r[4].n === 15 && ultima && Math.abs(ultima.w - 120.5) < 0.1,
    r.map((x, i) => `${i + 1}: ${x.n} piezas «${x.err}»`).join(" | ").slice(0, 400) + ` · con «120,5»: ${ultima ? ultima.w.toFixed(1) : "no"}`);
});
await caso("pln-18-cambiar-medidas-en-el-panel", "", async p => {
  await clicEn(p, "m-2");
  const a = await pieza(p, "m-2");
  await p.fill("input[name=pieza-largo]", "300"); await p.keyboard.press("Enter"); await espera(p);
  const b = await pieza(p, "m-2");
  await p.fill("input[name=pieza-largo]", "0"); await p.keyboard.press("Enter"); await espera(p);
  const c = await pieza(p, "m-2"), err = (await p.locator("[data-plano-panel] [role=alert]").allInnerTexts()).join(" ");
  await p.fill("input[name=pieza-ancho]", "999"); await p.keyboard.press("Escape"); await espera(p);
  const d = await pieza(p, "m-2"), anchoTxt = await p.inputValue("input[name=pieza-ancho]");
  ok("pln-18-cambiar-medidas-en-el-panel", Math.abs(b.w - 300) < 0.5 && Math.abs(c.w - 300) < 0.5 && /mayor que 0/.test(err) && Math.abs(d.h - a.h) < 0.5 && anchoTxt === String(G.redondear(a.h)),
    `largo 300: ${b.w.toFixed(1)}; «0»: se queda ${c.w.toFixed(1)} y dice «${err}»; Esc en el ancho con 999: ${d.h.toFixed(1)} (era ${a.h.toFixed(1)}) y el campo «${anchoTxt}»`);
});
await caso("pln-19-duplicar-quitar-y-su-deshacer", "", async p => {
  await clicEn(p, "m-6");
  await p.keyboard.press("Control+d"); await espera(p);
  const ps = await piezas(p), copia = ps.find(x => !/^m-/.test(x.id)), orig = ps.find(x => x.id === "m-6");
  const pan = await elegida(p);
  await p.keyboard.press("Delete"); await espera(p);
  const n2 = (await piezas(p)).length;
  await deshacerDelAviso(p).click(); await espera(p);
  const n3 = (await piezas(p)).length;
  ok("pln-19-duplicar-quitar-y-su-deshacer", ps.length === 15 && copia && Math.abs(copia.cx - orig.cx - 50) < 0.1 && Math.abs(copia.cy - orig.cy - 50) < 0.1 && /Guillotina 115/.test(pan) && n2 === 14 && n3 === 15,
    `Ctrl+D: ${ps.length} piezas, la copia a ${copia ? (copia.cx - orig.cx).toFixed(0) + "," + (copia.cy - orig.cy).toFixed(0) : "—"} cm y elegida (${/Guillotina 115/.test(pan)}); Supr: ${n2}; «Deshacer» del aviso: ${n3}`);
});
await caso("pln-20-encimadas-en-rojo", "", async p => {
  const g5 = await pieza(p, "m-5"), g6 = await pieza(p, "m-6");
  await arrastrar(p, "m-5", g6.cx - g5.cx, g6.cy - g5.cy - 100);
  const a = await pieza(p, "m-5"), b = await pieza(p, "m-6"), pan = await panel(p);
  await p.click("[data-plano-deshacer]"); await espera(p);
  const c = await pieza(p, "m-5"), d = await pieza(p, "m-6");
  ok("pln-20-encimadas-en-rojo", a.mal && b.mal && /Se encima con «Guillotina 115»/.test(pan) && !c.mal && !d.mal,
    `encimadas: 78 ${a.mal ? "roja" : "NO roja"}, 115 ${b.mal ? "roja" : "NO roja"}; panel «${pan.slice(0, 120)}»; separadas: ${c.mal || d.mal ? "SIGUEN rojas" : "sin rojo"}`);
});
await caso("pln-21-contra-un-muro-en-rojo", "", async p => {
  const g5 = await pieza(p, "m-5");
  await arrastrar(p, "m-5", -g5.cx + 20, 0);
  const a = await pieza(p, "m-5"), pan = await panel(p);
  ok("pln-21-contra-un-muro-en-rojo", a.mal && /choca con un muro o columna/.test(pan), `metida en el muro de la izquierda: ${a.mal ? "roja" : "NO roja"}; panel «${pan.slice(0, 120)}»`);
});
await caso("pln-22-guardar-como-version", "", async p => {
  await arrastrar(p, "m-2", 200, 0);
  await p.click("[data-plano-guardar]");
  const v = await textoDialogo(p);
  await p.click("[data-plano-guardar-ok]"); await espera(p);
  const errVacio = await p.textContent("[data-plano-ventana-error]").catch(() => "");
  await p.fill("input[name=version-nombre]", "  PM-74 junto a la puerta  "); await p.click("[data-plano-guardar-ok]"); await espera(p, 500);
  const t = await tabla(p), ver = await p.$eval("[data-plano-version]", s => s.options[s.selectedIndex].text), e = await estado(p);
  const pm = t[0]?.piezas.find(x => x.id === "m-2"), q = await pieza(p, "m-2");
  ok("pln-22-guardar-como-version", /Nombre de la versión/.test(v) && /Escribe/.test(errVacio) && t.length === 1 && t[0].nombre === "PM-74 junto a la puerta" && t[0].creado_por === "gerardo" && pm && Math.abs(pm.x - q.cx) < 0.5 && /PM-74 junto a la puerta/.test(ver) && /Guardado/.test(e) && (await lineas(p, "insert")).length === 1,
    `ventana «${v.slice(0, 50)}»; sin nombre «${errVacio}»; en la base ${t.length}: «${t[0]?.nombre}» de ${t[0]?.creado_por}, la PM-74 en ${pm?.x} (en pantalla ${q.cx.toFixed(1)}); selector «${ver}»; «${e}»; inserts ${(await lineas(p, "insert")).length}`);
});
await caso("pln-23-doble-clic-en-guardar-una-sola", "modo=guardalento&lento=1", async p => {
  await arrastrar(p, "m-2", 200, 0);
  await p.click("[data-plano-guardar]"); await dialogo(p).waitFor();
  await p.fill("input[name=version-nombre]", "Una sola");
  await p.dblclick("[data-plano-guardar-ok]"); await p.keyboard.press("Enter").catch(() => {});
  await espera(p, 1800);
  const t = await tabla(p), ins = await lineas(p, "insert");
  ok("pln-23-doble-clic-en-guardar-una-sola", t.length === 1 && ins.length === 1, `doble clic + Enter con la base lenta: ${ins.length} inserts, ${t.length} versiones (1)`);
});
await caso("pln-24-guardar-encima-con-su-revision", "versiones=2&ultima=v-1", async p => {
  await p.waitForFunction(() => /Acomodo A/.test(document.querySelector("[data-plano-version]").selectedOptions[0].text));
  await arrastrar(p, "m-6", 0, -100);
  await p.click("[data-plano-guardar]"); await espera(p, 500);
  const t = await tabla(p), v1 = t.find(f => f.id === "v-1"), up = await lineas(p, "update");
  const q = await pieza(p, "m-6"), g = v1.piezas.find(x => x.id === "m-6");
  ok("pln-24-guardar-encima-con-su-revision", up.length === 1 && /revision=3/.test(up[0]) && v1.revision === 4 && Math.abs(g.y - q.cy) < 0.5 && /Guardado/.test(await estado(p)) && (await tabla(p)).length === 2,
    `update: «${up.join(" | ")}» (con revision=3); la base: revisión ${v1.revision}, la 115 en y=${g?.y} (pantalla ${q.cy.toFixed(1)}); «${await estado(p)}»`);
});
await caso("pln-25-nombre-repetido-no-se-guarda", "versiones=2", async p => {
  await arrastrar(p, "m-2", 100, 0);
  await p.click("[data-plano-guardar]"); await dialogo(p).waitFor();
  await p.fill("input[name=version-nombre]", "acomodo a"); await p.click("[data-plano-guardar-ok]"); await espera(p, 400);
  const err = await p.textContent("[data-plano-ventana-error]").catch(() => ""), abierta = await dialogo(p).count();
  ok("pln-25-nombre-repetido-no-se-guarda", /Ya hay una versión que se llama/.test(err) && abierta === 1 && (await tabla(p)).length === 2 && /sin guardar/i.test(await estado(p)),
    `«acomodo a» con «Acomodo A» guardada: «${err}»; la ventana ${abierta ? "sigue" : "SE CERRÓ"}; versiones ${(await tabla(p)).length}`);
});
await caso("pln-26-otro-guardo-mientras-tanto", "versiones=2&ultima=v-1", async p => {
  await p.waitForFunction(() => /Acomodo A/.test(document.querySelector("[data-plano-version]").selectedOptions[0].text));
  await arrastrar(p, "m-2", 100, 0);
  await p.evaluate(() => window.__otroGuarda("v-1"));
  await p.click("[data-plano-guardar]"); await espera(p, 500);
  const v = await textoDialogo(p);
  const suya = (await tabla(p)).find(f => f.id === "v-1");
  await p.click("[data-plano-conflicto-nueva]"); await espera(p);
  const nombre = await p.inputValue("input[name=version-nombre]");
  await p.click("[data-plano-guardar-ok]"); await espera(p, 500);
  const t = await tabla(p), sigue = t.find(f => f.id === "v-1");
  ok("pln-26-otro-guardo-mientras-tanto", /la guardó marcelo/i.test(v) && suya.revision === 4 && t.length === 3 && sigue.revision === 4 && JSON.stringify(sigue.piezas) === JSON.stringify(suya.piezas) && /Acomodo A/.test(nombre),
    `la ventana: «${v.slice(0, 140)}»; la de Marcelo quedó ${JSON.stringify(sigue.piezas) === JSON.stringify(suya.piezas) ? "intacta" : "PISADA"}; la mía como «${nombre}»: ${t.length} versiones`);
});
await caso("pln-27-la-borraron-mientras-tanto", "versiones=2&ultima=v-1", async p => {
  await p.waitForFunction(() => /Acomodo A/.test(document.querySelector("[data-plano-version]").selectedOptions[0].text));
  await arrastrar(p, "m-2", 100, 0);
  await p.evaluate(() => window.__otroBorra("v-1"));
  await p.click("[data-plano-guardar]"); await espera(p, 500);
  const v = await textoDialogo(p);
  ok("pln-27-la-borraron-mientras-tanto", /ya no existe/i.test(v) && /marcelo/i.test(v) && /guárdalos como versión nueva/i.test(v) && /sin guardar/i.test(await estado(p)),
    `«${v.slice(0, 160)}»`);
});
await caso("pln-28-la-base-falla-al-guardar", "versiones=2&ultima=v-1&modo=guardafalla", async p => {
  await p.waitForFunction(() => /Acomodo A/.test(document.querySelector("[data-plano-version]").selectedOptions[0].text));
  await arrastrar(p, "m-2", 100, 0);
  const antes = await pieza(p, "m-2");
  await p.click("[data-plano-guardar]"); await espera(p, 500);
  const av = await p.textContent("[data-plano-aviso]").catch(() => ""), despues = await pieza(p, "m-2");
  ok("pln-28-la-base-falla-al-guardar", /No se guardó «Acomodo A»/.test(av) && /conexión/.test(av) && /siguen aquí/.test(av) && despues.cx === antes.cx && /sin guardar/i.test(await estado(p)),
    `aviso «${av}»; la pieza ${despues.cx === antes.cx ? "sigue donde la dejé" : "SE MOVIÓ"}; «${await estado(p)}»`);
});
await caso("pln-29-sin-permiso", "modo=sinpermiso", async p => {
  await arrastrar(p, "m-2", 100, 0);
  await guardarComo(p, "Prueba");
  const err = await p.textContent("[data-plano-ventana-error]").catch(() => "");
  ok("pln-29-sin-permiso", /no tiene permiso/.test(err) && (await tabla(p)).length === 0, `«${err}»`);
});
await caso("pln-30-sin-la-tabla-se-acomoda-e-imprime", "modo=sintabla", async p => {
  const av = await p.textContent("[data-plano-sin-tabla]").catch(() => "");
  const apagado = await p.$eval("[data-plano-guardar]", b => b.disabled);
  await arrastrar(p, "m-2", 100, 0);
  const movio = /sin guardar/i.test(await estado(p));
  await p.click("[data-plano-imprimir]"); await p.click("[data-plano-hoja=doble]"); await espera(p, 900);
  const impreso = (await lineas(p, "print")).length;
  ok("pln-30-sin-la-tabla-se-acomoda-e-imprime", /todavía no está disponible/.test(av) && apagado && movio && impreso === 1,
    `aviso «${av.slice(0, 80)}»; Guardar ${apagado ? "apagado" : "PRENDIDO"}; acomodar ${movio ? "sí" : "NO"}; imprimir ${impreso}`);
});
await caso("pln-31-la-lista-falla-y-reintentar", "versiones=2&modo=listafalla1", async p => {
  const av = await p.textContent("[data-plano-lista-falla]").catch(() => "");
  await p.locator("[data-plano-lista-falla] button").click(); await espera(p, 400);
  const opciones = await p.$$eval("[data-plano-version] option", os => os.map(o => o.textContent));
  ok("pln-31-la-lista-falla-y-reintentar", /No se pudieron leer las versiones/.test(av) && opciones.length === 3 && (await p.locator("[data-plano-lista-falla]").count()) === 0,
    `aviso «${av.slice(0, 90)}»; después de «Reintentar»: ${opciones.length} opciones (${opciones.join(" / ").slice(0, 120)})`);
});
await caso("pln-32-abrir-otra-con-cambios-pregunta", "versiones=2", async p => {
  await arrastrar(p, "m-5", 0, 100);
  const movida = await pieza(p, "m-5");
  await p.selectOption("[data-plano-version]", "v-1"); await espera(p);
  const v = await textoDialogo(p);
  await p.getByRole("button", { name: "Seguir aquí" }).click(); await espera(p);
  const sigue = await pieza(p, "m-5"), sel1 = await p.$eval("[data-plano-version]", s => s.value);
  await p.selectOption("[data-plano-version]", "v-1"); await dialogo(p).waitFor();
  await p.getByRole("button", { name: /Descartarlos y abrir/ }).click(); await espera(p, 500);
  const sel2 = await p.$eval("[data-plano-version]", s => s.value), pm = await pieza(p, "m-2"), orig = de("m-2");
  ok("pln-32-abrir-otra-con-cambios-pregunta", /cambios sin guardar/i.test(v) && sigue.cy === movida.cy && sel1 === "" && sel2 === "v-1" && Math.abs(pm.cx - orig.x - 300) < 0.5 && /Sin cambios/.test(await estado(p)),
    `pregunta «${v.slice(0, 80)}»; «Seguir aquí»: la pieza ${sigue.cy === movida.cy ? "sigue movida" : "SE PERDIÓ"} y el selector en «${sel1}»; «Descartarlos y abrir»: «${sel2}», la PM-74 a ${(pm.cx - orig.x).toFixed(0)} cm (300)`);
});
await caso("pln-33-abrir-otra-sin-cambios", "versiones=2", async p => {
  await p.selectOption("[data-plano-version]", "v-2"); await espera(p, 500);
  const ps = await piezas(p), mesa = ps.find(x => x.id === "o-mesa");
  ok("pln-33-abrir-otra-sin-cambios", (await dialogo(p).count()) === 0 && ps.length === 15 && mesa && mesa.fill !== "#e3e9ef" && /Sin cambios/.test(await estado(p)),
    `sin preguntar: ${ps.length} piezas, la mesa ${mesa ? "con color de agregado (" + mesa.fill + ")" : "NO ESTÁ"}; «${await estado(p)}»`);
});
await caso("pln-34-salir-con-cambios-pregunta", "", async p => {
  await p.click("#ir-pipeline"); await espera(p);
  const sinCambios = (await lineas(p, "vista:pipeline")).length;
  await p.click("#ir-plano"); await p.locator("[data-pieza]").first().waitFor({ timeout: 15000 }); await espera(p, 300);
  await arrastrar(p, "m-2", 100, 0);
  await p.click("#ir-pipeline"); await espera(p);
  const v = await textoDialogo(p);
  await p.getByRole("button", { name: "Seguir aquí" }).click(); await espera(p);
  const sigue = (await p.locator("[data-plano-lienzo]").count()) === 1 && /sin guardar/i.test(await estado(p));
  await p.click("#ir-form"); await espera(p);
  const preguntaNueva = (await dialogo(p).count()) === 1;
  await p.getByRole("button", { name: "Salir sin guardar" }).click(); await espera(p);
  const salio = (await lineas(p, "vista:form")).length === 1;
  ok("pln-34-salir-con-cambios-pregunta", sinCambios === 1 && /cambios sin guardar/i.test(v) && sigue && preguntaNueva && salio,
    `sin cambios sale directo (${sinCambios}); con cambios pregunta «${v.slice(0, 60)}»; «Seguir aquí» ${sigue ? "se queda" : "NO se quedó"}; ir a «Nueva» ${preguntaNueva ? "pregunta" : "NO PREGUNTA"}; «Salir sin guardar» ${salio ? "sale" : "NO SALE"}`);
});
await caso("pln-35-esc-y-fuera-no-pierden-lo-escrito", "", async p => {
  await arrastrar(p, "m-2", 100, 0);
  await p.click("[data-plano-guardar]"); await dialogo(p).waitFor();
  await p.fill("input[name=version-nombre]", "Lo que escribí");
  await p.keyboard.press("Escape"); await espera(p);
  const tras1 = await dialogo(p).count();
  await p.mouse.click(8, 8); await espera(p);
  const tras2 = await dialogo(p).count(), texto = tras2 ? await p.inputValue("input[name=version-nombre]") : "";
  await p.fill("input[name=version-nombre]", ""); await p.keyboard.press("Escape"); await espera(p);
  const tras3 = await dialogo(p).count();
  ok("pln-35-esc-y-fuera-no-pierden-lo-escrito", tras1 === 1 && tras2 === 1 && texto === "Lo que escribí" && tras3 === 0,
    `con nombre escrito: Esc ${tras1 ? "no cierra" : "CERRÓ"}, clic fuera ${tras2 ? "no cierra" : "CERRÓ"} («${texto}»); vacía, Esc ${tras3 ? "NO CIERRA" : "cierra"}`);
});
await caso("pln-36-borrar-version-y-deshacer", "versiones=2&ultima=v-1", async p => {
  await p.waitForFunction(() => /Acomodo A/.test(document.querySelector("[data-plano-version]").selectedOptions[0].text));
  await p.click("[data-plano-borrar-version]");
  const v = await textoDialogo(p);
  await p.click("[data-plano-borrar-ok]"); await espera(p, 500);
  const t = await tabla(p), v1 = t.find(f => f.id === "v-1"), opciones = await p.$$eval("[data-plano-version] option", os => os.map(o => o.value));
  await deshacerDelAviso(p).click(); await espera(p, 600);
  const t2 = await tabla(p), v1b = t2.find(f => f.id === "v-1"), sel = await p.$eval("[data-plano-version]", s => s.value);
  ok("pln-36-borrar-version-y-deshacer", /Borrar la versión «Acomodo A»/.test(v) && v1.borrado_en && v1.borrado_por === "gerardo" && !opciones.includes("v-1") && !v1b.borrado_en && sel === "v-1",
    `pregunta «${v.slice(0, 60)}»; borrada en la base: ${!!v1.borrado_en} por ${v1.borrado_por}; en la lista: ${opciones.includes("v-1")}; «Deshacer»: ${v1b.borrado_en ? "SIGUE BORRADA" : "regresó"} y abierta: ${sel}`);
});
await caso("pln-37-imprimir-doble-carta", "versiones=2&ultima=v-1", async p => {
  await p.waitForFunction(() => /Acomodo A/.test(document.querySelector("[data-plano-version]").selectedOptions[0].text));
  await p.click("[data-plano-imprimir]");
  const menu = (await p.locator("[role=menu]").innerText()).replace(/\s+/g, " ");
  await p.click("[data-plano-hoja=doble]"); await espera(p, 900);
  const pr = await lineas(p, "print"), hoja = await p.evaluate(() => window.__hoja || "");
  const ancho = Number((/<svg class="plano"[^>]*width="([\d.]+)mm"/.exec(hoja) || [])[1]);
  const filas = (hoja.match(/<tr/g) || []).length - 1;
  ok("pln-37-imprimir-doble-carta", /Doble carta escala 1:100/.test(menu) && pr.length === 1 && /431\.8mm 279\.4mm/.test(pr[0]) && /Escala 1:100/.test(hoja) && Math.abs(ancho - 358) < 1 && filas === 14 && /Acomodo A/.test(hoja) && /Guardada por Gerardo/.test(hoja) && /PM-74/.test(hoja) && /250 × 570/.test(hoja) && !/sin guardar/i.test(hoja),
    `menú «${menu.slice(0, 70)}»; ${pr.join(" | ")}; el plano mide ${ancho} mm (3580 cm a 1:100 = 358); ${filas} renglones; título ${/Acomodo A/.test(hoja) ? "sí" : "NO"}; quién ${/Guardada por Gerardo/.test(hoja) ? "sí" : "NO"}`);
});
await caso("pln-38-imprimir-carta-con-cambios", "", async p => {
  await arrastrar(p, "m-5", 0, 100);
  await p.click("[data-plano-imprimir]"); await p.click("[data-plano-hoja=carta]"); await espera(p, 900);
  const pr = await lineas(p, "print"), hoja = await p.evaluate(() => window.__hoja || "");
  ok("pln-38-imprimir-carta-con-cambios", pr.length === 1 && /279\.4mm 215\.9mm/.test(pr[0]) && /Escala 1:200/.test(hoja) && /Con cambios sin guardar/.test(hoja) && /Plano del levantamiento/.test(hoja),
    `${pr.join(" | ")}; escala ${(/Escala 1:(\d+)/.exec(hoja) || [])[1]}; dice que hay cambios sin guardar: ${/Con cambios sin guardar/.test(hoja)}`);
});
await caso("pln-39-la-hoja-dice-lo-encimado", "", async p => {
  const g5 = await pieza(p, "m-5"), g6 = await pieza(p, "m-6");
  await arrastrar(p, "m-5", g6.cx - g5.cx, g6.cy - g5.cy - 100);
  await p.click("[data-plano-imprimir]"); await p.click("[data-plano-hoja=doble]"); await espera(p, 900);
  const hoja = await p.evaluate(() => window.__hoja || "");
  ok("pln-39-la-hoja-dice-lo-encimado", /2 piezas con problema/.test(hoja) && /se encima con Guillotina 115/.test(hoja), `la hoja: ${(/<div class="aviso">([\s\S]*?)<\/div>/.exec(hoja) || [])[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 160) || "SIN AVISO"}`);
});
await caso("pln-40-recargar-ofrece-lo-no-guardado", "", async p => {
  await arrastrar(p, "m-2", 400, 0);
  const movida = await pieza(p, "m-2");
  await espera(p, 600);
  await p.reload(); await p.locator("[data-pieza]").first().waitFor({ timeout: 15000 }); await espera(p, 500);
  const av = await p.textContent("[data-plano-borrador]").catch(() => ""), antes = await pieza(p, "m-2");
  await p.getByRole("button", { name: "Recuperarlos" }).click(); await espera(p);
  const despues = await pieza(p, "m-2");
  ok("pln-40-recargar-ofrece-lo-no-guardado", /cambios que no se guardaron/.test(av) && Math.abs(antes.cx - de("m-2").x) < 0.5 && Math.abs(despues.cx - movida.cx) < 0.5 && /sin guardar/i.test(await estado(p)),
    `al volver: «${av.slice(0, 90)}»; antes de recuperar la PM-74 en ${antes.cx.toFixed(0)}; después en ${despues.cx.toFixed(0)} (la dejé en ${movida.cx.toFixed(0)})`);
});
await caso("pln-41-version-danada-abre-lo-bueno", "danada=1", async p => {
  await p.selectOption("[data-plano-version]", "v-3"); await espera(p, 500);
  const ps = await piezas(p), av = await p.textContent("[data-plano-aviso]").catch(() => "");
  ok("pln-41-version-danada-abre-lo-bueno", ps.length === 3 && /2 piezas de esta versión venían dañadas/.test(av), `${ps.length} piezas (3 buenas); aviso «${av}»`);
});
await caso("pln-42-abre-la-ultima-que-abri", "versiones=2&ultima=v-2", async p => {
  await p.waitForFunction(() => document.querySelector("[data-plano-version]").value === "v-2", null, { timeout: 4000 }).catch(() => {});
  const sel = await p.$eval("[data-plano-version]", s => s.value), mesa = await pieza(p, "o-mesa");
  ok("pln-42-abre-la-ultima-que-abri", sel === "v-2" && !!mesa, `abrió «${sel}» (v-2) con la mesa ${mesa ? "sí" : "NO"}`);
});
await caso("pln-43-la-ultima-elegida-gana", "versiones=2&modo=lento&lento=1", async p => {
  await p.waitForFunction(() => !document.querySelector("[data-plano-version]").disabled, null, { timeout: 8000 });
  await p.selectOption("[data-plano-version]", "v-1");
  await p.waitForTimeout(150);
  // mientras abre «Acomodo A» (la base tarda), regreso al levantamiento: se debe quedar el levantamiento, no la que llegue tarde
  const enMedio = await p.$eval("[data-plano-version]", s => ({ value: s.value, disabled: s.disabled }));
  await p.selectOption("[data-plano-version]", "");
  await espera(p, 2200);
  const sel = await p.$eval("[data-plano-version]", s => s.value), pm = await pieza(p, "m-2");
  ok("pln-43-la-ultima-elegida-gana", enMedio.value === "v-1" && !enMedio.disabled && sel === "" && Math.abs(pm.cx - de("m-2").x) < 0.5,
    `abriendo «Acomodo A» el selector dice «${enMedio.value}» y ${enMedio.disabled ? "está APAGADO" : "se puede usar"}; regresé al levantamiento: quedó «${sel || "levantamiento"}» con la PM-74 a ${(pm.cx - de("m-2").x).toFixed(0)} cm de su lugar`);
});
await caso("pln-44-deshacer-y-rehacer-todo", "", async p => {
  await arrastrar(p, "m-2", 100, 0); await arrastrar(p, "m-6", 0, 100);
  await p.keyboard.press("Control+z"); await p.keyboard.press("Control+z"); await espera(p);
  const e1 = await estado(p);
  await p.keyboard.press("Control+y"); await espera(p);
  const pm = await pieza(p, "m-2");
  await p.click("[data-plano-rehacer]"); await espera(p);
  const g6 = await pieza(p, "m-6");
  ok("pln-44-deshacer-y-rehacer-todo", /Sin cambios/.test(e1) && Math.abs(pm.cx - de("m-2").x - 100) < 0.5 && Math.abs(g6.cy - de("m-6").y - 100) < 0.5 && await p.$eval("[data-plano-rehacer]", b => b.disabled),
    `deshacer los dos: «${e1}»; Ctrl+Y regresa la PM-74 (+${(pm.cx - de("m-2").x).toFixed(0)}); el botón regresa la 115 (+${(g6.cy - de("m-6").y).toFixed(0)}); rehacer queda apagado`);
});
await caso("pln-45-teclas-en-un-campo-no-mueven", "", async p => {
  await clicEn(p, "m-2");
  const a = await pieza(p, "m-2");
  await p.click("input[name=pieza-nombre]");
  await p.keyboard.press("End"); await p.keyboard.type(" r"); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("Delete"); await p.keyboard.press("Backspace");
  const b = await pieza(p, "m-2"), n = (await piezas(p)).length;
  ok("pln-45-teclas-en-un-campo-no-mueven", b && b.cx === a.cx && b.w === a.w && n === 14, `escribir «r», flechas, Supr y Retroceso en el nombre: la pieza ${b ? (b.cx === a.cx && b.w === a.w ? "quieta" : "SE MOVIÓ O GIRÓ") : "SE BORRÓ"}; ${n} piezas`);
});
await caso("pln-46-zoom-y-ver-todo", "", async p => {
  const a = await vista(p), z0 = await p.textContent("[data-plano-zoom]");
  const r = await p.$eval("[data-plano-lienzo]", e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await p.mouse.move(r.x, r.y);
  for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -120); await espera(p, 60); }
  const b = await vista(p), z1 = await p.textContent("[data-plano-zoom]");
  await p.click("[data-plano-ver-todo]"); await espera(p);
  const c = await vista(p), z2 = await p.textContent("[data-plano-zoom]");
  ok("pln-46-zoom-y-ver-todo", b.s > a.s * 1.5 && parseInt(z1) > parseInt(z0) && Math.abs(c.s - a.s) < 1e-6 && z2 === z0, `la rueda acercó ${(b.s / a.s).toFixed(2)}× (${z0} → ${z1}); «Ver todo» regresó a ${(c.s / a.s).toFixed(2)}× (${z2})`);
});
await caso("pln-47-arrastrar-el-fondo-recorre", "", async p => {
  const a = await vista(p), ps0 = await piezas(p);
  const r = await enPantalla(p, 3300, 300);   // un rincón sin máquinas (arriba a la derecha)
  await p.mouse.move(r.x, r.y); await p.mouse.down(); await p.mouse.move(r.x - 120, r.y + 60, { steps: 6 }); await p.mouse.up(); await espera(p);
  const b = await vista(p), ps1 = await piezas(p);
  ok("pln-47-arrastrar-el-fondo-recorre", Math.abs(b.dx - a.dx + 120) < 2 && Math.abs(b.dy - a.dy - 60) < 2 && JSON.stringify(ps0) === JSON.stringify(ps1) && /Sin cambios/.test(await estado(p)),
    `el plano se recorrió ${(b.dx - a.dx).toFixed(0)}, ${(b.dy - a.dy).toFixed(0)} px (−120, 60); las piezas ${JSON.stringify(ps0) === JSON.stringify(ps1) ? "quietas" : "SE MOVIERON"}`);
});
await caso("pln-48-esc-a-medio-arrastre", "", async p => {
  const a = await pieza(p, "m-2");
  await arrastrar(p, "m-2", 300, 100, { soltar: false });
  await p.keyboard.press("Escape"); await p.mouse.up(); await espera(p);
  const b = await pieza(p, "m-2");
  ok("pln-48-esc-a-medio-arrastre", b.cx === a.cx && b.cy === a.cy && /Sin cambios/.test(await estado(p)), `Esc a medio arrastre: la PM-74 a ${(b.cx - a.cx).toFixed(0)}, ${(b.cy - a.cy).toFixed(0)} cm de donde estaba; «${await estado(p)}»`);
});
await caso("pln-49-direccion-y-el-atajo-n", "rol=admin", async p => {
  await arrastrar(p, "m-2", 100, 0);
  await p.mouse.click(5, 300);   // (el foco fuera de un campo)
  await p.keyboard.press("n"); await espera(p);
  const v = await dialogo(p).count() ? await textoDialogo(p) : "";
  await p.getByRole("button", { name: "Seguir aquí" }).click().catch(() => {});
  await guardarComo(p, "De Dirección");
  const t = await tabla(p);
  ok("pln-49-direccion-y-el-atajo-n", /cambios sin guardar/i.test(v) && t.length === 1 && t[0].creado_por === "marcelo" && (await lineas(p, "vista:form")).length === 0,
    `admin: la N con cambios ${v ? "pregunta" : "NO PREGUNTA"}; guarda como ${t[0]?.creado_por}`);
});
await caso("pln-50-el-deshacer-del-aviso-regresa-esa-pieza", "", async p => {
  await clicEn(p, "m-1");
  await p.keyboard.press("Delete"); await espera(p);
  await arrastrar(p, "m-2", 100, 0);
  await deshacerDelAviso(p).click(); await espera(p);
  const gto = await pieza(p, "m-1"), pm = await pieza(p, "m-2");
  ok("pln-50-el-deshacer-del-aviso-regresa-esa-pieza", !!gto && Math.abs(pm.cx - de("m-2").x - 100) < 0.5, `quité la GTO-1, moví la PM-74 y le di «Deshacer» al aviso: la GTO-1 ${gto ? "regresó" : "NO REGRESÓ"}, la PM-74 ${Math.abs(pm.cx - de("m-2").x - 100) < 0.5 ? "sigue movida" : "SE REGRESÓ"}`);
});

// ══════════ vuelta 2: por donde NO se diseñó (los límites, el orden raro, lo que cambia con la ventana abierta, los otros tamaños) ══════════
await caso("pln-60-medidas-en-el-limite", "", async p => {
  await p.click("[data-plano-agregar]");
  const prueba = async (nombre, largo, ancho) => { await p.fill("input[name=agregar-nombre]", nombre); await p.fill("input[name=agregar-largo]", largo); await p.fill("input[name=agregar-ancho]", ancho);
    const n0 = (await piezas(p)).length; await p.click("[data-plano-agregar-ok]"); await espera(p, 150); const n1 = (await piezas(p)).length;
    const err = (await p.locator("[data-plano-forma-agregar] [role=alert]").allInnerTexts()).join(" / ");
    if (n1 > n0) { await p.click("[data-plano-agregar]"); }
    return { agrego: n1 > n0, err }; };
  const r = {
    max: await prueba("Grande", "5000", "100"), masDeMax: await prueba("Grande", "5000.1", "100"), uno: await prueba("Poste", "1", "1"), menosDeUno: await prueba("Poste", "0.9", "1"),
    espacios: await prueba("   ", "100", "100"), largo41: await prueba("x".repeat(41), "100", "100"), largo40: await prueba("y".repeat(40), "100", "100"), coma: await prueba("Tarima", "1.234,5", "100") };
  ok("pln-60-medidas-en-el-limite", r.max.agrego && !r.masDeMax.agrego && r.uno.agrego && !r.menosDeUno.agrego && !r.espacios.agrego && !r.largo41.agrego && /Máximo 40/.test(r.largo41.err) && r.largo40.agrego && !r.coma.agrego,
    Object.entries(r).map(([k, v]) => `${k}: ${v.agrego ? "agregó" : "no («" + v.err.slice(0, 40) + "»)"}`).join(" | "));
});
await caso("pln-61-lo-agregado-sobrevive-guardar-y-abrir", "", async p => {
  await p.click("[data-plano-agregar]");
  await p.fill("input[name=agregar-nombre]", "Mesa de corte"); await p.fill("input[name=agregar-largo]", "240"); await p.fill("input[name=agregar-ancho]", "120");
  await p.click("[data-plano-agregar-ok]"); await espera(p);
  await p.click("[data-plano-girar-der]"); await espera(p);
  await guardarComo(p, "Con mesa");
  await p.selectOption("[data-plano-version]", ""); await espera(p, 300);
  const sinMesa = (await piezas(p)).length;
  const id = (await tabla(p))[0].id;
  await p.selectOption("[data-plano-version]", id); await espera(p, 500);
  const ps = await piezas(p), mesa = ps.find(x => !/^m-/.test(x.id));
  const nombres = await p.$$eval("[data-plano-lienzo] text", ts => ts.map(t => t.textContent));
  ok("pln-61-lo-agregado-sobrevive-guardar-y-abrir", sinMesa === 14 && ps.length === 15 && mesa && Math.abs(mesa.w - 120) < 0.5 && Math.abs(mesa.h - 240) < 0.5 && nombres.includes("Mesa de corte"),
    `el levantamiento: ${sinMesa} piezas; «Con mesa» otra vez: ${ps.length}, la mesa ${mesa ? mesa.w.toFixed(0) + "×" + mesa.h.toFixed(0) + " (girada: 120×240)" : "NO ESTÁ"}, su nombre ${nombres.includes("Mesa de corte") ? "sí" : "NO"}`);
});
await caso("pln-62-giro-fino-en-el-panel", "", async p => {
  await clicEn(p, "m-8");
  const a = await pieza(p, "m-8");
  await p.fill("input[name=pieza-giro]", "45°"); await p.keyboard.press("Enter"); await espera(p);
  const b = await pieza(p, "m-8"), g1 = await p.inputValue("input[name=pieza-giro]");
  await p.fill("input[name=pieza-giro]", "370"); await p.keyboard.press("Enter"); await espera(p);
  const g2 = await p.inputValue("input[name=pieza-giro]");
  await p.fill("input[name=pieza-giro]", "noventa"); await p.keyboard.press("Enter"); await espera(p);
  const err = (await p.locator("[data-plano-panel] [role=alert]").allInnerTexts()).join(" "), g3 = await pieza(p, "m-8");
  const diag = Math.hypot(a.w, a.h) / Math.SQRT2;
  ok("pln-62-giro-fino-en-el-panel", g1 === "45" && Math.abs(b.w - (a.w + a.h) / Math.SQRT2) < 1 && g2 === "10" && /grados/.test(err) && Math.abs(g3.w - b.w) > 1,
    `45°: el campo «${g1}», la GTO-4 mide ${b.w.toFixed(0)} de ancho (girada 45: ${((a.w + a.h) / Math.SQRT2).toFixed(0)}); 370 → «${g2}» (10); «noventa»: «${err}» (diag ${diag.toFixed(0)})`);
});
await caso("pln-63-nombre-de-version-en-el-limite", "", async p => {
  await arrastrar(p, "m-2", 100, 0);
  await p.click("[data-plano-guardar]"); await dialogo(p).waitFor();
  const intenta = async n => { await p.fill("input[name=version-nombre]", n); await p.click("[data-plano-guardar-ok]"); await espera(p, 400); return { err: await p.textContent("[data-plano-ventana-error]").catch(() => ""), abierta: await dialogo(p).count() }; };
  const espacios = await intenta("     "), largo81 = await intenta("z".repeat(81)), largo80 = await intenta("w".repeat(80));
  const t = await tabla(p);
  ok("pln-63-nombre-de-version-en-el-limite", /Escribe/.test(espacios.err) && /Máximo 80/.test(largo81.err) && largo80.abierta === 0 && t.length === 1 && t[0].nombre === "w".repeat(80),
    `sólo espacios: «${espacios.err}»; 81 letras: «${largo81.err}»; 80 letras: ${largo80.abierta ? "NO SE GUARDÓ («" + largo80.err + "»)" : "guardada"} (${t.length} en la base)`);
});
await caso("pln-64-doble-clic-en-borrar-version", "versiones=2&ultima=v-1&modo=guardalento&lento=1", async p => {
  await p.waitForFunction(() => /Acomodo A/.test(document.querySelector("[data-plano-version]").selectedOptions[0].text), null, { timeout: 8000 });
  await p.click("[data-plano-borrar-version]"); await dialogo(p).waitFor();
  await p.dblclick("[data-plano-borrar-ok]").catch(() => {}); await espera(p, 1800);
  const up = (await lineas(p, "update")).filter(l => /borrado_en/.test(l));
  ok("pln-64-doble-clic-en-borrar-version", up.length === 1, `doble clic en «Borrar» con la base lenta: ${up.length} borrados (1)`);
});
await caso("pln-65-la-lista-cambia-con-la-ventana-abierta", "", async p => {
  await arrastrar(p, "m-2", 100, 0);
  await p.click("[data-plano-guardar]"); await dialogo(p).waitFor();
  await p.fill("input[name=version-nombre]", "Nuevo acomodo");
  await p.evaluate(() => window.__agregarVersion("Nuevo acomodo"));   // Marcelo la guarda con ese nombre en otra computadora
  await p.click("[data-plano-guardar-ok]"); await espera(p, 500);
  const err = await p.textContent("[data-plano-ventana-error]").catch(() => ""), t = await tabla(p);
  ok("pln-65-la-lista-cambia-con-la-ventana-abierta", /Ya hay una versión que se llama «Nuevo acomodo»/.test(err) && (await dialogo(p).count()) === 1 && t.length === 1 && /sin guardar/i.test(await estado(p)),
    `«${err}»; la ventana ${await dialogo(p).count() ? "sigue" : "SE CERRÓ"}; versiones ${t.length} (la de Marcelo)`);
});
await caso("pln-66-borrar-la-version-con-cambios", "versiones=2&ultima=v-1", async p => {
  await p.waitForFunction(() => /Acomodo A/.test(document.querySelector("[data-plano-version]").selectedOptions[0].text));
  await arrastrar(p, "m-6", 0, 100);
  const movida = await pieza(p, "m-6");
  await p.click("[data-plano-borrar-version]"); await p.click("[data-plano-borrar-ok]"); await espera(p, 500);
  const tras = await pieza(p, "m-6"), e1 = await estado(p), sel1 = await p.$eval("[data-plano-version]", s => s.value);
  await deshacerDelAviso(p).click(); await espera(p, 600);
  const e2 = await estado(p), sel2 = await p.$eval("[data-plano-version]", s => s.value), tras2 = await pieza(p, "m-6");
  ok("pln-66-borrar-la-version-con-cambios", tras.cy === movida.cy && /sin guardar/i.test(e1) && sel1 === "" && sel2 === "v-1" && /sin guardar/i.test(e2) && tras2.cy === movida.cy,
    `borrada: la pieza ${tras.cy === movida.cy ? "se quedó como la dejé" : "SE REGRESÓ"}, «${e1}», el selector «${sel1}»; «Deshacer»: «${sel2}», «${e2}» (mis cambios siguen sin guardar)`);
});
await caso("pln-67-esc-en-borrar-version-no-borra", "versiones=2&ultima=v-1", async p => {
  await p.waitForFunction(() => /Acomodo A/.test(document.querySelector("[data-plano-version]").selectedOptions[0].text));
  await p.click("[data-plano-borrar-version]"); await dialogo(p).waitFor();
  await p.keyboard.press("Escape"); await espera(p);
  const abierta = await dialogo(p).count(), up = await lineas(p, "update");
  ok("pln-67-esc-en-borrar-version-no-borra", abierta === 0 && up.length === 0 && !(await tabla(p)).find(f => f.id === "v-1").borrado_en, `Esc: la ventana ${abierta ? "SIGUE" : "se cerró"}; updates ${up.length}`);
});
await caso("pln-68-agregar-con-datos-y-esc", "", async p => {
  await p.click("[data-plano-agregar]");
  await p.fill("input[name=agregar-nombre]", "Anaquel"); await p.fill("input[name=agregar-largo]", "90");
  await p.keyboard.press("Escape"); await espera(p);
  const sigue = await p.locator("[data-plano-forma-agregar]").count(), nombre = sigue ? await p.inputValue("input[name=agregar-nombre]") : "";
  await p.getByRole("button", { name: "Cancelar" }).click(); await espera(p);
  const cerrada = await p.locator("[data-plano-forma-agregar]").count();
  ok("pln-68-agregar-con-datos-y-esc", sigue === 1 && nombre === "Anaquel" && cerrada === 0 && (await piezas(p)).length === 14, `Esc con datos: la forma ${sigue ? "sigue («" + nombre + "»)" : "SE CERRÓ"}; «Cancelar» ${cerrada ? "NO cierra" : "cierra"}`);
});
await caso("pln-69-sin-tabla-recargar-conserva", "modo=sintabla", async p => {
  await arrastrar(p, "m-2", 300, 0); await espera(p, 600);
  await p.reload(); await p.locator("[data-pieza]").first().waitFor({ timeout: 15000 }); await espera(p, 500);
  const av = await p.textContent("[data-plano-borrador]").catch(() => "");
  await p.getByRole("button", { name: "Recuperarlos" }).click().catch(() => {}); await espera(p);
  const pm = await pieza(p, "m-2");
  ok("pln-69-sin-tabla-recargar-conserva", /cambios que no se guardaron/.test(av) && Math.abs(pm.cx - de("m-2").x - 300) < 0.5, `sin la tabla, al recargar: «${av.slice(0, 80)}»; la PM-74 a +${(pm.cx - de("m-2").x).toFixed(0)} (300)`);
});
await caso("pln-70-borrador-de-una-version-que-ya-no-esta", "borrador=v-9", async p => {
  const av = await p.textContent("[data-plano-borrador]").catch(() => "");
  await p.getByRole("button", { name: "Recuperarlos" }).click(); await espera(p);
  const pm = await pieza(p, "m-2"), aviso = await p.textContent("[data-plano-aviso]").catch(() => ""), sel = await p.$eval("[data-plano-version]", s => s.value);
  ok("pln-70-borrador-de-una-version-que-ya-no-esta", /Una que ya no está/.test(av) && Math.abs(pm.cx - de("m-2").x - 500) < 0.5 && /versión nueva/.test(aviso) && sel === "" && /sin guardar/i.test(await estado(p)),
    `«${av.slice(0, 90)}»; recuperado: la PM-74 a +${(pm.cx - de("m-2").x).toFixed(0)} (500) sobre el levantamiento; aviso «${aviso}»`);
});
await caso("pln-71-1366-con-pieza-elegida-y-problemas", "", async p => {
  const g5 = await pieza(p, "m-5"), g6 = await pieza(p, "m-6");
  await arrastrar(p, "m-5", g6.cx - g5.cx, g6.cy - g5.cy - 60);
  await p.fill("input[name=pieza-nombre]", "Guillotina de 78 cm con nombre largo"); await p.keyboard.press("Enter"); await espera(p);
  const m = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth - innerWidth, panel: document.querySelector("[data-plano-panel]").scrollWidth - document.querySelector("[data-plano-panel]").clientWidth,
    barra: (() => { const b = document.querySelector("[data-plano-barra]"), l = document.querySelector("[data-plano-lienzo]"); if (!b) return "sin barra"; const r = b.getBoundingClientRect(), q = l.getBoundingClientRect(); return r.left >= q.left - 1 && r.right <= q.right + 1 && r.top >= q.top - 1 && r.bottom <= q.bottom + 1 ? "dentro" : "FUERA"; })() }));
  ok("pln-71-1366-con-pieza-elegida-y-problemas", m.scroll <= 0 && m.panel <= 0 && m.barra === "dentro", `scroll horizontal de la página ${m.scroll}, del panel ${m.panel}; la barra de la pieza ${m.barra} del lienzo`);
});
await caso("pln-72-el-zoom-tiene-limite", "", async p => {
  const a = await vista(p);
  const r = await p.$eval("[data-plano-lienzo]", e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await p.mouse.move(r.x, r.y);
  for (let i = 0; i < 40; i++) await p.mouse.wheel(0, -120);
  await espera(p, 300); const b = await vista(p);
  for (let i = 0; i < 80; i++) await p.mouse.wheel(0, 120);
  await espera(p, 300); const c = await vista(p);
  ok("pln-72-el-zoom-tiene-limite", b.s <= Math.max(3, a.s * 12) + 1e-6 && b.s > a.s && c.s >= a.s * 0.4 - 1e-6 && c.s < a.s,
    `40 acercar: ${(b.s / a.s).toFixed(1)}× (tope 12× o 3 px/cm = ${(Math.max(3, a.s * 12) / a.s).toFixed(1)}×); 80 alejar: ${(c.s / a.s).toFixed(2)}× (piso 0.4×)`);
});
await caso("pln-73-muchas-piezas", "", async p => {
  await clicEn(p, "m-1");
  for (let i = 0; i < 40; i++) await p.keyboard.press("Control+d");
  await espera(p, 400);
  const n = (await piezas(p)).length, ultima = await p.$eval("[data-plano-panel]", e => e.textContent.slice(0, 40));
  const t0 = Date.now(); await arrastrar(p, "m-2", 200, 0); const ms = Date.now() - t0;
  await p.keyboard.press("Escape"); await espera(p);
  const resumen = await p.textContent("[data-plano-problemas]").catch(() => "");
  await p.click("[data-plano-imprimir]"); await p.click("[data-plano-hoja=doble]"); await espera(p, 900);
  const hoja = await p.evaluate(() => window.__hoja || "");
  ok("pln-73-muchas-piezas", n === 54 && /y \d+ más/.test(resumen) && /<tr/.test(hoja) && /y 10 piezas más/.test(hoja) && ms < 4000,
    `40 × Ctrl+D: ${n} piezas (54); el resumen «${resumen.slice(0, 80)}…»; la hoja dice ${(/y (\d+) piezas más/.exec(hoja) || [])[0] || "NADA de las que no caben"}; arrastrar tardó ${ms} ms`);
});
await caso("pln-74-clic-derecho-no-arrastra", "", async p => {
  const a = await pieza(p, "m-2"), s = await enPantalla(p, a.cx, a.cy), v = await vista(p);
  await p.mouse.move(s.x, s.y); await p.mouse.down({ button: "right" }); await p.mouse.move(s.x + 200 * v.s, s.y, { steps: 5 }); await p.mouse.up({ button: "right" }); await espera(p);
  const b = await pieza(p, "m-2");
  ok("pln-74-clic-derecho-no-arrastra", b.cx === a.cx && /Sin cambios/.test(await estado(p)), `arrastrar con el botón derecho: la PM-74 a ${(b.cx - a.cx).toFixed(0)} cm`);
});
await caso("pln-75-sacar-una-pieza-y-ver-todo", "", async p => {
  await clicEn(p, "m-1");
  for (let i = 0; i < 40; i++) await p.keyboard.press("Shift+ArrowRight");   // 20 m a la derecha: fuera de la planta
  await espera(p, 300);
  await p.click("[data-plano-ver-todo]"); await espera(p);
  const q = await pieza(p, "m-1"), s = await enPantalla(p, q.cx, q.cy), l = await p.$eval("[data-plano-lienzo]", e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; });
  await p.click("[data-plano-imprimir]");
  const menu = (await p.locator("[role=menu]").innerText()).replace(/\s+/g, " ");
  await p.click("[data-plano-hoja=doble]"); await espera(p, 900);
  const hoja = await p.evaluate(() => window.__hoja || ""), esc = Number((/Escala 1:(\d+)/.exec(hoja) || [])[1]);
  const dentro = s.x > l[0] && s.x < l[2] && s.y > l[1] && s.y < l[3];
  ok("pln-75-sacar-una-pieza-y-ver-todo", dentro && esc > 100 && new RegExp("escala 1:" + esc).test(menu), `la GTO-1 a 20 m fuera: «Ver todo» la deja ${dentro ? "a la vista" : "FUERA"}; la hoja a 1:${esc} (el menú dice «${menu.slice(0, 60)}»)`);
});
await caso("pln-76-guardar-deshacer-rehacer", "", async p => {
  await arrastrar(p, "m-2", 100, 0);
  await guardarComo(p, "Uno");
  const e0 = await estado(p);
  await p.keyboard.press("Control+z"); await espera(p);
  const e1 = await estado(p);
  await p.keyboard.press("Control+y"); await espera(p);
  const e2 = await estado(p);
  ok("pln-76-guardar-deshacer-rehacer", /Guardado/.test(e0) && /sin guardar/i.test(e1) && !/sin guardar/i.test(e2), `guardada: «${e0}»; deshacer: «${e1}»; rehacer (queda como lo guardado): «${e2}»`);
});
await caso("pln-77-guardar-como-nueva-desde-una-version", "versiones=2&ultima=v-1", async p => {
  await p.waitForFunction(() => /Acomodo A/.test(document.querySelector("[data-plano-version]").selectedOptions[0].text));
  const antes = (await tabla(p)).find(f => f.id === "v-1");
  await arrastrar(p, "m-6", 0, 100);
  await p.click("[data-plano-guardar-como]"); await dialogo(p).waitFor();
  await p.fill("input[name=version-nombre]", "Acomodo A2"); await p.click("[data-plano-guardar-ok]"); await espera(p, 500);
  const t = await tabla(p), v1 = t.find(f => f.id === "v-1"), nueva = t.find(f => f.nombre === "Acomodo A2"), sel = await p.$eval("[data-plano-version]", s => s.value);
  ok("pln-77-guardar-como-nueva-desde-una-version", nueva && sel === nueva.id && v1.revision === antes.revision && JSON.stringify(v1.piezas) === JSON.stringify(antes.piezas),
    `«Acomodo A2» ${nueva ? "creada y abierta (" + (sel === nueva?.id) + ")" : "NO SE CREÓ"}; «Acomodo A» ${JSON.stringify(v1.piezas) === JSON.stringify(antes.piezas) ? "intacta" : "CAMBIÓ"} (revisión ${v1.revision})`);
});
await caso("pln-78-tab-se-queda-en-la-ventana", "", async p => {
  await arrastrar(p, "m-2", 100, 0);
  await p.click("[data-plano-guardar]"); await dialogo(p).waitFor();
  const fuera = [];
  for (let i = 0; i < 7; i++) { await p.keyboard.press(i % 3 === 2 ? "Shift+Tab" : "Tab"); fuera.push(await p.evaluate(() => !!document.activeElement.closest("[role=dialog]"))); }
  ok("pln-78-tab-se-queda-en-la-ventana", fuera.every(Boolean), `con Tab y Shift+Tab, el foco dentro de la ventana: ${fuera.map(x => x ? "sí" : "NO").join(",")}`);
});
await caso("pln-79-cambiar-el-tamano-de-la-ventana", "", async p => {
  await p.setViewportSize({ width: 1366, height: 768 }); await espera(p, 500);
  const m = await p.evaluate(() => { const l = document.querySelector("[data-plano-lienzo]").getBoundingClientRect(), g = document.querySelector("[data-plano-muros]").getBoundingClientRect();
    return { l: [l.left, l.top, l.right, l.bottom].map(Math.round), g: [g.left, g.top, g.right, g.bottom].map(Math.round), alto: innerHeight }; });
  ok("pln-79-cambiar-el-tamano-de-la-ventana", m.l[3] <= m.alto && m.g[0] >= m.l[0] - 2 && m.g[2] <= m.l[2] + 2 && m.g[1] >= m.l[1] - 2 && m.g[3] <= m.l[3] + 2,
    `de 1920 a 1366: el lienzo ${m.l.join(",")} (alto de la ventana ${m.alto}); el dibujo ${m.g.join(",")}`);
}, { viewport: V1920 });
await caso("pln-80-sesion-vencida-al-guardar", "modo=jwt", async p => {
  await arrastrar(p, "m-2", 100, 0);
  await guardarComo(p, "Prueba");
  const err = await p.textContent("[data-plano-ventana-error]").catch(() => "");
  ok("pln-80-sesion-vencida-al-guardar", /sesión se venció/.test(err) && /esta computadora/.test(err), `«${err}»`);
});

// ══════════ vuelta 3: lo que se vio a ojo en las capturas de las vueltas 1 y 2 ══════════
await caso("pln-81-con-el-aviso-sin-tabla-el-plano-cabe", "modo=sintabla", async p => {
  await p.locator("[data-plano-sin-tabla]").waitFor({ timeout: 5000 }); await espera(p, 300);
  const m = await p.evaluate(() => ({ lienzo: Math.round(document.querySelector("[data-plano-lienzo]").getBoundingClientRect().bottom), panel: Math.round(document.querySelector("[data-plano-panel]").getBoundingClientRect().bottom), alto: innerHeight, scroll: document.documentElement.scrollHeight - innerHeight }));
  ok("pln-81-con-el-aviso-sin-tabla-el-plano-cabe", m.lienzo <= m.alto && m.panel <= m.alto, `con el aviso de la tabla: el lienzo acaba en ${m.lienzo} y el panel en ${m.panel} (la ventana mide ${m.alto}; antes se salía ~45 px)`);
});
for (const [vp, nombre] of [[V1366, "pln-82-los-letreros-no-se-pisan-1366"], [V1920, "pln-82b-los-letreros-no-se-pisan-1920"]]) {
  await caso(nombre, "", async p => {
    const cajas = await p.$$eval("[data-plano-lienzo] svg g[pointer-events=none] > g", gs => gs.map((g, i) => [...g.querySelectorAll("text")].map(t => { const r = t.getBoundingClientRect(); return { i, t: t.textContent, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; })).flat());
    const pisan = [];
    for (let a = 0; a < cajas.length; a++) for (let b = a + 1; b < cajas.length; b++) {
      const A = cajas[a], B = cajas[b];
      if (A.i !== B.i && A.x0 < B.x1 - 1 && B.x0 < A.x1 - 1 && A.y0 < B.y1 - 1 && B.y0 < A.y1 - 1) pisan.push(A.t + " / " + B.t);
    }
    ok(nombre, cajas.length >= 14 && pisan.length === 0, `${cajas.length} letreros; se pisan: ${pisan.join(" · ") || "ninguno"}`);
  }, { viewport: vp });
}
await caso("pln-83-medidas-enteras-del-levantamiento", "", async p => {
  const lista = (await p.locator("[data-plano-lista]").innerText()).replace(/\s+/g, " ");
  ok("pln-83-medidas-enteras-del-levantamiento", /GTO-1 130 × 130/.test(lista) && /PM-74 250 × 570/.test(lista) && !/\d\.\d/.test(lista), `la lista: «${lista.slice(0, 160)}…» (sin decimales del trazo del CAD)`);
});
await caso("pln-84-la-copia-tiene-su-nombre", "", async p => {
  await clicEn(p, "m-1");
  await p.keyboard.press("Control+d"); await espera(p);
  const n1 = await elegida(p), insignia = (await panel(p)).slice(0, 40);
  await p.keyboard.press("Control+d"); await espera(p);
  const n2 = await elegida(p);
  const copias = (await piezas(p)).filter(x => !/^m-/.test(x.id));
  ok("pln-84-la-copia-tiene-su-nombre", n1 === "GTO-1 (2)" && n2 === "GTO-1 (3)" && /Agregado/.test(insignia) && copias.every(c => c.fill !== "#e3e9ef"),
    `copia: «${n1}» (${insignia.trim()}); la copia de la copia: «${n2}»; ${copias.length} copias, color de agregado: ${copias.every(c => c.fill !== "#e3e9ef")}`);
});

// ══════════ vuelta 4: lo visto en producción después de subir (la captura del recorrido como Producción, 16-oct 02:18) ══════════
// el arreglo de pln-82 achicaba a 8.5 px todo nombre más ancho que su pieza («Dobladora», «Guillotina 115», «Cilíndrica») y escondía casi todas las
// medidas: en la vista completa a 1366 no se leía. Lo que DEBE pasar: donde no hay con quién chocar, el nombre a su tamaño (12 px) y sus medidas.
for (const [vp, nombre] of [[V1366, "pln-85-los-nombres-se-leen-1366"], [V1920, "pln-85b-los-nombres-se-leen-1920"]]) {
  await caso(nombre, "", async p => {
    const letreros = await p.$$eval("[data-plano-lienzo] svg g[pointer-events=none] > g", gs => gs.map(g => { const ts = [...g.querySelectorAll("text")]; return { nombre: ts[0]?.textContent, px: ts[0] ? ts[0].getBoundingClientRect().height : 0, medidas: ts[1]?.textContent || "" }; }));
    const de = n => letreros.find(l => l.nombre === n) || {};
    const sueltas = ["PM-74", "Dobladora", "Guillotina 115", "GTO-4", "Cilíndrica", "Pegadora"];
    const chicos = sueltas.filter(n => !(de(n).px >= 13));   // 12 px de letra: su caja mide ~15 px de alto
    const sinMedidas = ["PM-74", "Dobladora", "Guillotina 115", "GTO-4"].filter(n => !de(n).medidas);
    ok(nombre, chicos.length === 0 && sinMedidas.length === 0, `nombres achicados sin necesidad: ${chicos.map(n => n + " (" + Math.round(de(n).px) + " px)").join(", ") || "ninguno"}; sin medidas: ${sinMedidas.join(", ") || "ninguna"}`);
  }, { viewport: vp });
}

// (vuelta 4, en la misma captura) el nombre de un área que queda debajo de una máquina se asomaba a medias («Duplo e», de «Diseño»; «Almace…»):
//   el que tapa una máquina no se dibuja, y regresa si la máquina se quita de encima
await caso("pln-86-el-nombre-del-area-tapado-no-se-asoma", "", async p => {
  const areas = () => p.$$eval("[data-plano-areas] text", ts => ts.map(t => t.textContent));
  const antes = await areas();
  // (al escribirla: quitar sólo el Duplo no basta, la CTP también tapa ese «Diseño»)
  for (const id of ["m-12", "m-13"]) { await clicEn(p, id); await p.keyboard.press("Delete"); await espera(p); }
  const despues = await areas();
  const cuenta = (xs, t) => xs.filter(x => x === t).length;
  ok("pln-86-el-nombre-del-area-tapado-no-se-asoma", cuenta(antes, "Diseño") === 1 && cuenta(antes, "Almacén") === 1 && cuenta(despues, "Diseño") === 2,
    `con el Duplo y la CTP: «Diseño» ${cuenta(antes, "Diseño")} vez (la otra, tapada), «Almacén» ${cuenta(antes, "Almacén")} (el de adentro lo tapa el letrero de la Guillotina 78); sin ellas: «Diseño» ${cuenta(despues, "Diseño")}`);
});

// ══════════ v10.84.121: lo de la critique de «Planta» (16-oct, 30/40; snapshot .impeccable/critique/…__src-plano-planoplanta-jsx.md) ══════════
// escritas ANTES del arreglo (vuelta 1 de la 121): deben fallar contra v10.84.120
const cotas = p => p.$$eval("[data-plano-cota]", es => es.map(e => ({ lado: e.getAttribute("data-plano-cota"), cm: Number(e.getAttribute("data-cm")), texto: e.textContent })));
await caso("pln-87-las-cotas-dicen-cuanto-queda", "", async p => {
  await clicEn(p, "m-1");   // la GTO-1, sola arriba a la derecha
  const a = await cotas(p), panelA = await panel(p);
  const q = de("m-1"), cj = G.cajaDe(q);
  // lo esperado a la derecha: el muro más cercano que la GTO-1 tiene enfrente (de los mismos trazos)
  const muroDer = Math.min(...OBST.filter(s => s.cj.x0 >= cj.x1 - 0.5 && s.cj.y0 < cj.y1 && s.cj.y1 > cj.y0).map(s => s.cj.x0)) - cj.x1;
  const der0 = a.find(c => c.lado === "der");
  for (let i = 0; i < 10; i++) await p.keyboard.press("ArrowRight");
  await espera(p);
  const der1 = (await cotas(p)).find(c => c.lado === "der");
  ok("pln-87-las-cotas-dicen-cuanto-queda", a.length === 4 && der0 && Math.abs(der0.cm - muroDer) <= 1 && der1 && Math.abs(der0.cm - der1.cm - 50) <= 1 && /Libre alrededor/.test(panelA) && panelA.includes(der0.texto),
    `elegida la GTO-1: ${a.length} cotas (${a.map(c => c.lado + " " + c.texto).join(", ")}); a la derecha ${der0?.cm} cm (los trazos dicen ${G.redondear(muroDer)}); 50 cm a la derecha: ${der1?.cm}; el panel ${/Libre alrededor/.test(panelA) ? "lo dice" : "NO lo dice"}`);
});
await caso("pln-88-las-cotas-en-vivo-al-arrastrar", "", async p => {
  await clicEn(p, "m-2");
  const izq0 = (await cotas(p)).find(c => c.lado === "izq");
  await arrastrar(p, "m-2", 100, 0, { soltar: false });
  const izqEnMedio = (await cotas(p)).find(c => c.lado === "izq");
  await p.mouse.up(); await espera(p);
  const izq1 = (await cotas(p)).find(c => c.lado === "izq");
  ok("pln-88-las-cotas-en-vivo-al-arrastrar", izq0 && izqEnMedio && Math.abs(izqEnMedio.cm - izq0.cm - 100) <= 1 && izq1 && Math.abs(izq1.cm - izqEnMedio.cm) <= 1,
    `a la izquierda de la PM-74: ${izq0?.cm} cm; a medio arrastre (1 m a la derecha) ${izqEnMedio?.cm}; al soltar ${izq1?.cm}`);
});
await caso("pln-89-la-elegida-se-ve-aunque-este-en-rojo", "", async p => {
  const g5 = await pieza(p, "m-5"), g6 = await pieza(p, "m-6");
  await arrastrar(p, "m-5", g6.cx - g5.cx, g6.cy - g5.cy - 100);
  const trazos = await p.$$eval('[data-pieza="m-5"],[data-pieza="m-6"]', es => es.map(e => ({ id: e.getAttribute("data-pieza"), stroke: e.getAttribute("stroke"), ancho: Number(e.getAttribute("stroke-width")), mal: e.getAttribute("data-mal") })));
  const marco = await p.locator("[data-plano-elegida]").count();
  const e5 = trazos.find(t => t.id === "m-5"), e6 = trazos.find(t => t.id === "m-6");
  ok("pln-89-la-elegida-se-ve-aunque-este-en-rojo", e5.mal === "1" && e6.mal === "1" && (marco === 1 || (e5.stroke !== e6.stroke && e5.ancho > e6.ancho)),
    `las dos encimadas: la elegida (78) ${JSON.stringify(e5)}, la otra ${JSON.stringify(e6)}; marco de la elegida: ${marco}`);
});
await caso("pln-90-un-solo-primario", "", async p => {
  await arrastrar(p, "m-2", 100, 0);
  const rellenos = await p.$$eval("[data-plano] button", (bs, ac) => bs.filter(b => b.offsetParent && getComputedStyle(b).backgroundColor === ac).map(b => b.textContent.trim()), await p.$eval("[data-plano-guardar]", b => getComputedStyle(b).backgroundColor));
  ok("pln-90-un-solo-primario", rellenos.length === 1 && /Guardar/.test(rellenos[0]), `con cambios, botones rellenos del color principal: ${JSON.stringify(rellenos)} (debe ser sólo «Guardar…»)`);
});
await caso("pln-91-como-se-usa", "", async p => {
  const sub = (await p.locator("[data-plano] h2 + p").innerText().catch(() => "")).trim();
  const ayuda = (await p.locator("[data-plano-ayuda]").innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("pln-91-como-se-usa", sub.length <= 70 && /arrastra/i.test(ayuda) && /\bR\b/.test(ayuda) && /Supr/.test(ayuda) && /Ctrl\+Z/.test(ayuda),
    `subtítulo de ${sub.length} letras («${sub}»); «Cómo se usa» sin elegir nada: «${ayuda.slice(0, 160)}»`);
});
await caso("pln-92-la-hoja-letreros-encima-y-la-hora", "versiones=2&ultima=v-1", async p => {
  await p.waitForFunction(() => /Acomodo A/.test(document.querySelector("[data-plano-version]").selectedOptions[0].text));
  const g5 = await pieza(p, "m-5"), g6 = await pieza(p, "m-6");
  await arrastrar(p, "m-5", g6.cx - g5.cx, g6.cy - g5.cy - 100);
  await p.click("[data-plano-imprimir]"); await p.click("[data-plano-hoja=doble]"); await espera(p, 900);
  const hoja = await p.evaluate(() => window.__hoja || "");
  const svg = (/<svg class="plano"[\s\S]*?<\/svg>/.exec(hoja) || [""])[0];
  const ultimoPoligono = svg.lastIndexOf("<polygon"), primerNombre = svg.indexOf('font-weight="700"');
  await p.evaluate(() => window.__otroGuarda("v-1"));
  await p.click("[data-plano-guardar]"); await espera(p, 600);
  const v = await textoDialogo(p);
  ok("pln-92-la-hoja-letreros-encima-y-la-hora", ultimoPoligono > 0 && primerNombre > ultimoPoligono && /table\{[^}]*font-size:inherit/.test(hoja) && !/\.\.(\s|$)/.test(v) && /a las \d{1,2}:\d{2}/.test(v),
    `en la hoja los nombres van ${primerNombre > ultimoPoligono ? "después de" : "ANTES de"} las piezas; la tabla ${/font-size:inherit/.test(hoja) ? "hereda" : "NO hereda"} la letra; la ventana: «${v.slice(0, 110)}»`);
});

// ── v10.84.139: la ficha de cada máquina (lo de su placa), la decisión de Marcelo del 16-oct. Vuelta 1: escritas antes del cambio. ──
const ficha = async p => ((await p.textContent("[data-plano-ficha]").catch(() => "")) || "").replace(/\s+/g, " ");
const abrirLaFicha = async (p, id) => { await clicEn(p, id); await p.click("[data-plano-ficha-editar]"); await dialogo(p).waitFor({ timeout: 3000 }); };
// (la Dobladora es una L: el promedio de sus esquinas cae en el hueco, fuera de la pieza; se elige de la lista del panel)
const elegirEnLista = async (p, nombre) => { await p.locator("[data-plano-lista] button", { hasText: nombre }).first().click(); await espera(p, 150); };
const sinAAEn = (p, sel) => p.evaluate(s => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const malos = [];
  for (const el of document.querySelectorAll(s + " *")) {
    const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim(); if (!t || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el), a = lum(nums(cs.color)), b = lum(fondo(el)), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (k < 4.5 || parseFloat(cs.fontSize) < 10) malos.push(t.slice(0, 24) + " " + k.toFixed(1));
  }
  return malos;
}, sel);
await caso("pln-93-la-ficha-de-la-pm74", "", async p => {
  await clicEn(p, "m-2");
  const f = await ficha(p);
  ok("pln-93-la-ficha-de-la-pm74", /Ficha de la máquina/.test(f) && /Heidelberger/.test(f) && /PM741523/.test(f) && /2007/.test(f), `al tocar la PM-74, su ficha: «${f.slice(0, 160) || "no hay"}»`);
});
await caso("pln-94-sin-ficha-se-agrega", "", async p => {
  await clicEn(p, "m-7");
  const antes = await ficha(p);
  const b = p.locator("[data-plano-ficha-editar]"); const hay = await b.count();
  if (hay) { await b.click(); await dialogo(p).waitFor({ timeout: 3000 }); await p.fill("input[name=ficha-fabricante]", "Horizon"); await p.fill("input[name=ficha-modelo]", "BQ-4GO"); await p.click("[data-plano-ficha-guardar]"); await espera(p, 400); }
  const despues = await ficha(p), alta = (await lineas(p, "fichas insert m-7")).length, aviso = (await lineas(p, "toast:info:Se guardó la ficha")).length;
  ok("pln-94-sin-ficha-se-agrega", /Sin ficha todavía/.test(antes) && hay === 1 && alta === 1 && /Horizon/.test(despues) && /BQ-4GO/.test(despues) && aviso === 1,
    `la Pegadora: «${antes.slice(0, 90)}»; ${hay ? "«Agregar ficha» se guarda: " + (alta ? "sí" : "NO") + "; después: «" + despues.slice(0, 90) + "»" : "NO hay con qué agregarla"}`);
});
await caso("pln-95-editar-guarda-con-su-revision", "", async p => {
  await abrirLaFicha(p, "m-6");
  await p.fill("input[name=ficha-anio]", "2003 (placa)"); await p.click("[data-plano-ficha-guardar]"); await espera(p, 400);
  const up = await lineas(p, "fichas update"), f = await ficha(p), t = await p.evaluate(() => window.__fichas().find(x => x.pieza === "m-6"));
  ok("pln-95-editar-guarda-con-su-revision", up.length === 1 && /pieza=m-6&revision=2/.test(up[0]) && /2003 \(placa\)/.test(f) && t.revision === 3 && (await dialogo(p).count()) === 0,
    `editar la Guillotina 115: «${up[0] || "no se guardó"}»; en el panel: «${(f.match(/Año.{0,30}/) || [""])[0]}»; revisión ${t.revision}`);
});
await caso("pln-96-otra-persona-la-cambio", "", async p => {
  await abrirLaFicha(p, "m-6");
  await p.fill("textarea[name=ficha-notas]", "Cuchilla nueva en septiembre");
  await p.evaluate(() => window.__otraFicha("m-6"));
  await p.click("[data-plano-ficha-guardar]"); await espera(p, 500);
  const v = await textoDialogo(p), t1 = await p.evaluate(() => window.__fichas().find(x => x.pieza === "m-6").notas);
  const encima = p.getByRole("button", { name: /Guardar la mía encima/ }); const hay = await encima.count();
  if (hay) { await encima.click(); await espera(p, 500); }
  const t2 = await p.evaluate(() => window.__fichas().find(x => x.pieza === "m-6"));
  ok("pln-96-otra-persona-la-cambio", /Marcelo/.test(v) && /mientras escribías/.test(v) && t1 === "La cambió Marcelo" && hay === 1 && t2.notas === "Cuchilla nueva en septiembre",
    `Marcelo la cambió mientras Gerardo escribía: la ventana «${v.slice(0, 140)}»; lo de Marcelo ${t1 === "La cambió Marcelo" ? "no se pisó" : "SE PISÓ"}; «Guardar la mía encima» ${hay ? "guarda: «" + t2.notas + "»" : "NO SALE"}`);
});
await caso("pln-97-sin-la-tabla-el-plano-sigue", "modo=fichassintabla", async p => {
  await clicEn(p, "m-2");
  const f = await ficha(p), editar = await p.locator("[data-plano-ficha-editar]").count(), nombre = await elegida(p);
  ok("pln-97-sin-la-tabla-el-plano-sigue", /todavía no están en la base/.test(f) && editar === 0 && nombre === "PM-74", `sin la tabla: la ficha «${f.slice(0, 100) || "no hay sección"}»; «Editar» ${editar}; la pieza elegida «${nombre}»`);
});
await caso("pln-98-la-lectura-falla-no-es-sin-ficha", "modo=fichasfalla1", async p => {
  await clicEn(p, "m-2");
  const antes = await ficha(p);
  const re = p.locator("[data-plano-ficha]").getByRole("button", { name: /Reintentar/ }); const hay = await re.count();
  if (hay) { await re.click(); await espera(p, 400); }
  const despues = await ficha(p);
  ok("pln-98-la-lectura-falla-no-es-sin-ficha", /No se pudo leer la ficha/.test(antes) && !/Sin ficha todavía/.test(antes) && hay === 1 && /Heidelberger/.test(despues),
    `la primera lectura de las fichas falló: «${antes.slice(0, 100)}»; ${hay ? "«Reintentar» trae: «" + despues.slice(0, 70) + "»" : "SIN «Reintentar»"}`);
});
await caso("pln-99-esc-con-algo-escrito-no-cierra", "", async p => {
  await abrirLaFicha(p, "m-2");
  await p.fill("input[name=ficha-modelo]", "PM 74-4-P, la buena"); await p.keyboard.press("Escape"); await espera(p);
  const sigue = await dialogo(p).count();
  await p.getByRole("button", { name: /^Cancelar$/ }).click(); await espera(p);
  const cerro = (await dialogo(p).count()) === 0, nada = (await lineas(p, "fichas update")).length === 0;
  ok("pln-99-esc-con-algo-escrito-no-cierra", sigue === 1 && cerro && nada, `con algo escrito, Esc: la ventana ${sigue ? "sigue" : "SE CERRÓ (se perdió lo escrito)"}; «Cancelar» ${cerro ? "la cierra" : "no la cierra"} sin guardar (${nada ? "nada" : "SE GUARDÓ"})`);
});
await caso("pln-100-r-en-la-ventana-no-gira", "", async p => {
  await abrirLaFicha(p, "m-2");
  const antes = await pieza(p, "m-2");
  await p.getByRole("button", { name: /^Cancelar$/ }).focus(); await p.keyboard.press("r"); await p.keyboard.press("Delete"); await espera(p);
  const despues = await pieza(p, "m-2");
  ok("pln-100-r-en-la-ventana-no-gira", !!despues && Math.round(antes.w) === Math.round(despues.w) && Math.round(antes.h) === Math.round(despues.h),
    `con la ficha abierta, R y Supr: la PM-74 ${!despues ? "SE QUITÓ" : Math.round(antes.w) === Math.round(despues.w) ? "se queda igual" : "SE GIRÓ"}`);
});
await caso("pln-101-lo-largo-se-dice-y-no-se-manda", "", async p => {
  await elegirEnLista(p, "Dobladora"); await p.click("[data-plano-ficha-editar]"); await dialogo(p).waitFor({ timeout: 3000 });
  await p.fill("textarea[name=ficha-notas]", "x".repeat(2001)); await p.click("[data-plano-ficha-guardar]"); await espera(p, 300);
  const v = await textoDialogo(p), mandado = (await lineas(p, "fichas update")).length;
  ok("pln-101-lo-largo-se-dice-y-no-se-manda", /Notas: de más de 2,000 letras \(lleva 2,001\)/.test(v) && mandado === 0, `notas de 2,001 letras: «${(v.match(/Notas: de más[^.]*\./) || ["no dice nada"])[0]}»; a la base ${mandado ? "SE MANDÓ" : "no se mandó"}`);
});
await caso("pln-102-el-tab-no-se-sale", "", async p => {
  await abrirLaFicha(p, "m-2");
  const fuera = [];
  for (let i = 0; i < 14; i++) { await p.keyboard.press("Tab"); if (!(await p.evaluate(() => !!document.activeElement?.closest("[role=dialog]")))) fuera.push(i); }
  const llegoAlLargo = await p.evaluate(() => { const d = document.querySelector("[role=dialog]"); return [...d.querySelectorAll("textarea")].length; });
  ok("pln-102-el-tab-no-se-sale", fuera.length === 0 && llegoAlLargo === 2, `14 Tab en la ficha: ${fuera.length ? "el foco se SALE en " + fuera.join(",") : "se queda adentro"}; cuadros largos: ${llegoAlLargo}`);
});
await caso("pln-103-sin-permiso-lo-dice", "modo=fichasinpermiso", async p => {
  await abrirLaFicha(p, "m-2");
  await p.fill("input[name=ficha-anio]", "2007 (placa)"); await p.click("[data-plano-ficha-guardar]"); await espera(p, 400);
  const v = await textoDialogo(p);
  ok("pln-103-sin-permiso-lo-dice", /No se guardó/.test(v) && /permiso/.test(v) && (await dialogo(p).count()) === 1, `sin permiso: «${(v.match(/No se guardó[^.]*\./) || ["no lo dice"])[0]}»; la ventana ${(await dialogo(p).count()) ? "sigue con lo escrito" : "SE CERRÓ"}`);
});
await caso("pln-104-dos-la-dan-de-alta-a-la-vez", "", async p => {
  await abrirLaFicha(p, "m-9");
  await p.fill("input[name=ficha-fabricante]", "La de Gerardo");
  await p.evaluate(() => window.__otraFichaNueva("m-9"));
  await p.click("[data-plano-ficha-guardar]"); await espera(p, 500);
  const v = await textoDialogo(p);
  const encima = p.getByRole("button", { name: /Guardar la mía encima/ }); const hay = await encima.count();
  if (hay) { await encima.click(); await espera(p, 500); }
  const t = await p.evaluate(() => window.__fichas().filter(x => x.pieza === "m-9"));
  ok("pln-104-dos-la-dan-de-alta-a-la-vez", /Marcelo/.test(v) && hay === 1 && t.length === 1 && t[0].fabricante === "La de Gerardo" && t[0].revision === 2,
    `Marcelo dio de alta la Cilíndrica mientras Gerardo escribía: «${v.slice(0, 120)}»; ${hay ? "«Guardar la mía encima»: " + JSON.stringify(t.map(x => [x.fabricante, x.revision])) : "NO SALE «Guardar la mía encima»"}`);
});
for (const [vp, nombre] of [[V1366, "pln-105-la-ficha-cabe-y-se-lee-1366"], [V1920, "pln-105b-la-ficha-cabe-y-se-lee-1920"]]) {
  await caso(nombre, "", async p => {
    await elegirEnLista(p, "Dobladora");
    const m = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth - innerWidth, panel: !!document.querySelector("[data-plano-ficha]") }));
    const malos = m.panel ? await sinAAEn(p, "[data-plano-ficha]") : ["no hay ficha"];
    ok(nombre, m.panel && m.scroll <= 0 && malos.length === 0, `a ${vp.width}: la ficha de la Dobladora ${m.panel ? "sale" : "NO SALE"}; scroll horizontal ${m.scroll}; ${malos.length ? "sin AA: " + malos.slice(0, 5).join(" | ") : "todo con AA"}`);
  }, { viewport: vp });
}

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nplano: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
