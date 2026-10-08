// Tratar de ROMPER «EN LA PLANTA» (v10.84.67) en su banco: lo que Karla ve de las órdenes que todavía no llegan a Salidas y el
// botón para pasar a Salidas lo que ya está listo cuando Gerardo no lo ha pasado. Cada caso afirma lo que DEBERÍA ver o poder
// hacer Karla (Marcelo, 8-oct: «que vea el proceso de cada orden u OC y las pueda jalar para entregarlas y foliarlas»): una
// FALLA es un bug. Los datos salen del banco (tests/banco/gen-planta.mjs): la OC-0657 con 3 de 5 en Salidas y las otras dos en
// la GTO y en Empaque, la OC-0660 con una en la fila de la PM74 y otra en CTP, la OC-0665 con dos en la PM74 (la que corre y la
// que sigue), sueltas en Empaque y en máquinas, y lo que no se puede pasar (Listas, diseño, maquila).
// Uso: node planta.mjs <dir-capturas> [puerto=5193]   ·   SOLO=<regex> corre sólo los casos que coinciden (sabotajes)
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5193);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, viewport = { width: 1366, height: 768 }, extra = {}) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const page = await browser.newPage({ viewport, ...extra });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  page.on("dialog", async d => { errs.push("diálogo del navegador: " + d.message().slice(0, 60)); await d.dismiss().catch(() => {}); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#log", { state: "attached" }); await page.waitForTimeout(500);
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png", fullPage: true }).catch(() => {});
  await page.close();
}
const espera = (p, ms = 300) => p.waitForTimeout(ms);
const log = async p => (await p.textContent("#log")) || "";
const cuenta = (t, re) => (t.match(new RegExp(re, "g")) || []).length;
// el renglón de una orden (data-orden lleva el id: OP-P-0704) y lo que dice, aunque esté en un grupo plegado
const fila = (p, pn) => p.locator('[data-orden="OP-' + pn + '"]').first();
const dice = (p, pn) => p.evaluate(pn => { const e = document.querySelector('[data-orden="OP-' + pn + '"]'); return e ? e.textContent.replace(/\s+/g, " ").trim() : null; }, pn);
const botonDe = (p, pn) => fila(p, pn).getByRole("button", { name: /Pasar a Salidas/ });
const tieneBoton = (p, pn) => p.evaluate(pn => { const e = document.querySelector('[data-orden="OP-' + pn + '"]'); return !!e && [...e.querySelectorAll("button")].some(b => /Pasar a Salidas/.test(b.textContent)); }, pn);
const dialogo = p => p.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d ? d.textContent.replace(/\s+/g, " ").trim() : null; });
const dialogos = p => p.evaluate(() => document.querySelectorAll('[role="dialog"]').length);
const grupoOC = (p, oc) => p.locator('[data-oc="' + oc + '"]').first();
const textoDe = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, " ").trim() : null; }, sel);
const enPantalla = p => p.evaluate(() => document.querySelector("main").innerText.replace(/\s+/g, " "));

// ── lo que ve: dónde va cada orden ──
await caso("pla-01-la-oc-a-medias-va-primero", "", async p => {
  const t = await enPantalla(p), g = await textoDe(p, '[data-oc="OC-0657"]');
  const iOC = t.indexOf("OC-0657"), iSueltas = t.search(/En Empaque o en máquina/);
  ok("pla-01-la-oc-a-medias-va-primero", !!g && /3 de 5/.test(g) && /Salidas/.test(g) && iOC >= 0 && iSueltas > iOC,
    `la OC-0657 ${g ? "dice «" + (g.match(/\d+ de \d+[^·]*/) || ["sin «N de M»"])[0].trim() + "»" : "NO SALE como grupo"}; ${iOC >= 0 && iSueltas > iOC ? "va antes de las sueltas" : "NO va primero (OC en " + iOC + ", sueltas en " + iSueltas + ")"}`);
});
await caso("pla-02-donde-va-cada-una", "", async p => {
  const [a, b, c, d] = await Promise.all(["P-0704", "P-0705", "P-0711", "P-0712"].map(x => dice(p, x)));
  const bien = [a && /GTO 1 Color/.test(a) && /corriendo/.test(a), b && /Empaque/.test(b), c && /Printmaster 74/.test(c) && /3ª en la fila/.test(c), d && /CTP/.test(d)];
  ok("pla-02-donde-va-cada-una", bien.every(Boolean), ["P-0704 «" + a + "»", "P-0705 «" + b + "»", "P-0711 «" + c + "»", "P-0712 «" + d + "»"].filter((x, i) => !bien[i]).join(" · ") || "GTO corriendo, Empaque, 3ª en la fila de la PM74, CTP");
});
await caso("pla-03-boton-solo-en-empaque-o-maquina", "", async p => {
  const si = ["P-0704", "P-0705", "P-0711", "P-0741", "P-0742", "P-0720", "P-0721", "P-0722", "P-0723", "P-0731", "P-0732"], no = ["P-0712", "P-0724", "P-0725", "P-0726", "P-0727"];
  const conSi = await Promise.all(si.map(x => tieneBoton(p, x))), conNo = await Promise.all(no.map(x => tieneBoton(p, x)));
  const faltan = si.filter((x, i) => !conSi[i]), sobran = no.filter((x, i) => conNo[i]);
  ok("pla-03-boton-solo-en-empaque-o-maquina", !faltan.length && !sobran.length, (faltan.length ? "SIN botón: " + faltan.join(", ") + ". " : "") + (sobran.length ? "CON botón (no se pueden pasar): " + sobran.join(", ") : "") || "las " + si.length + " de Empaque o máquina lo tienen; Listas, CTP, diseño y maquila no");
});
await caso("pla-04-lo-de-mas-atras-plegado", "", async p => {
  const antes = await fila(p, "P-0724").isVisible().catch(() => false);
  const resumen = p.getByText(/Todavía no llegan a máquina/).first();
  const r = await resumen.textContent().catch(() => "");
  await resumen.click(); await espera(p);
  const despues = await fila(p, "P-0724").isVisible().catch(() => false);
  const [a, b] = await Promise.all([dice(p, "P-0724"), dice(p, "P-0725")]);
  ok("pla-04-lo-de-mas-atras-plegado", !antes && /2/.test(r) && despues && /Lista para máquina/.test(a || "") && /diseño/i.test(b || ""),
    `plegado al abrir: ${!antes ? "sí" : "NO"}; el grupo dice «${(r || "").trim()}»; abierto: P-0724 «${a}», P-0725 «${b}»`);
});
await caso("pla-05-maquila-plegada", "", async p => {
  const antes = await fila(p, "P-0726").isVisible().catch(() => false);
  const resumen = p.getByText(/^En maquila/).first();
  await resumen.click(); await espera(p);
  const [a, b] = await Promise.all([dice(p, "P-0726"), dice(p, "P-0727")]);
  ok("pla-05-maquila-plegada", !antes && /maquilador/i.test(a || "") && /maquila/i.test(b || ""), `plegado: ${!antes ? "sí" : "NO"}; P-0726 «${a}», P-0727 «${b}»`);
});
await caso("pla-06-lo-que-ya-no-esta-en-la-planta-no-sale", "", async p => {
  const t = await enPantalla(p), salen = ["P-0728", "P-0729", "P-0730", "P-0701", "P-0702", "P-0703"].filter(x => t.includes(x));
  ok("pla-06-lo-que-ya-no-esta-en-la-planta-no-sale", !salen.length, salen.length ? "salen: " + salen.join(", ") + " (canceladas, entregadas o ya en Salidas)" : "ni canceladas, ni entregadas, ni lo que ya está en Salidas");
});
await caso("pla-07-desde-cuando", "", async p => {
  const [a, b, c] = await Promise.all([dice(p, "P-0704"), dice(p, "P-0720"), dice(p, "P-0731")]);
  const bien = [/desde ayer 16:20/.test(a || ""), /desde el (dom|lun|mar|mié|jue|vie|sáb)/.test(b || ""), !/desde/.test(c || "") && /\d+\s*m/.test(c || "")];
  ok("pla-07-desde-cuando", bien.every(Boolean), `P-0704 (arrancó ayer 16:20): «${(a || "").match(/desde[^·]*/)?.[0] || "sin desde"}»; P-0720 (hace 2 días): «${(b || "").match(/desde[^·]*/)?.[0] || "sin desde"}»; P-0731 (hace media hora): ${bien[2] ? "minutos" : "«" + c + "»"}`);
});
await caso("pla-08-el-folio-abre-la-orden", "", async p => {
  await fila(p, "P-0720").getByRole("button", { name: /P-0720/ }).click(); await espera(p);
  const l = await log(p);
  ok("pla-08-el-folio-abre-la-orden", /detalle:P-0720/.test(l) && !/pide:/.test(l), /detalle:P-0720/.test(l) ? (/pide:/.test(l) ? "abre la orden PERO también pide pasarla" : "abre la orden") : "el folio NO abre la orden");
});
await caso("pla-09-las-sueltas-en-orden", "", async p => {
  const orden = await p.evaluate(() => { const g = document.querySelector('[data-grupo="jalables"]'); return g ? [...g.querySelectorAll("[data-orden]")].map(e => e.getAttribute("data-orden").replace("OP-", "")) : null; });
  const quiero = ["P-0720", "P-0731", "P-0721", "P-0723", "P-0722", "P-0732"];   // (P-0732, sin máquina, al final de lo que está en producción)
  ok("pla-09-las-sueltas-en-orden", !!orden && orden.join(",") === quiero.join(","), orden ? "salen " + orden.join(", ") + (orden.join(",") === quiero.join(",") ? " (Empaque de la más vieja, luego lo que corre, luego la fila)" : "; se esperaba " + quiero.join(", ")) : "no hay grupo de sueltas");
});

// ── pasar una ──
await caso("pla-10-pregunta-con-lo-que-pasa", "", async p => {
  await botonDe(p, "P-0721").click(); await espera(p);
  const d = await dialogo(p), l = await log(p);
  const bien = [!!d && /P-0721/.test(d) && /Salidas/.test(d), /Printmaster 52/.test(d || ""), /P-0722/.test(d || ""), /Gerardo/.test(d || ""), !/jalar:/.test(l)];
  ok("pla-10-pregunta-con-lo-que-pasa", bien.every(Boolean), d ? ["nombra la orden y Salidas", "dice de qué máquina sale", "dice cuál empieza (P-0722)", "dice que a Gerardo le avisa", "no movió nada antes de contestar"].map((x, i) => (bien[i] ? "" : "NO ") + x).join(" · ") : "NO PREGUNTA" + (/jalar:/.test(l) ? " y la movió" : ""));
});
await caso("pla-11-esc-no-mueve-y-regresa-el-foco", "", async p => {
  await botonDe(p, "P-0721").focus(); await p.keyboard.press("Enter"); await espera(p, 400);
  const enSegura = await p.evaluate(() => /^No\b/.test((document.activeElement?.textContent || "").trim()));
  await p.keyboard.press("Escape"); await espera(p, 400);
  const quedan = await dialogos(p), l = await log(p);
  const foco = await p.evaluate(() => { const a = document.activeElement; const f = a && a.closest("[data-orden]"); return f ? f.getAttribute("data-orden") + " · " + a.textContent.trim() : (a ? a.tagName : "nada"); });
  ok("pla-11-esc-no-mueve-y-regresa-el-foco", enSegura && quedan === 0 && !/jalar:/.test(l) && /OP-P-0721 · .*Pasar a Salidas/.test(foco),
    `el foco ${enSegura ? "entra en «No»" : "NO entra en la respuesta segura"}; Esc ${quedan ? "NO cierra" : "cierra"}${/jalar:/.test(l) ? " PERO la movió" : " sin mover nada"}; el foco regresa a: ${foco}`);
});
await caso("pla-12-confirmar-la-pasa", "", async p => {
  await botonDe(p, "P-0721").click(); await espera(p);
  await p.getByRole("button", { name: /Sí, ya está lista/ }).click(); await espera(p, 900);
  const l = await log(p), sigue = await dice(p, "P-0721"), sig = await dice(p, "P-0722");
  ok("pla-12-confirmar-la-pasa", /jalar:P-0721/.test(l) && !sigue && /corriendo/.test(sig || ""), `${/jalar:P-0721/.test(l) ? "la pasa" : "NO la pasa"}; ${sigue ? "SIGUE en la lista" : "sale de la lista"}; P-0722 ${/corriendo/.test(sig || "") ? "queda corriendo" : "dice «" + sig + "»"}`);
});
await caso("pla-13-doble-clic-en-si-pasa-una-vez", "", async p => {
  await botonDe(p, "P-0720").click(); await espera(p);
  await p.getByRole("button", { name: /Sí, ya está lista/ }).dblclick(); await espera(p, 900);
  const n = cuenta(await log(p), "jalar:");
  ok("pla-13-doble-clic-en-si-pasa-una-vez", n === 1, n + " veces");
});
await caso("pla-14-doble-clic-en-pasar-abre-una-pregunta", "", async p => {
  await botonDe(p, "P-0720").dblclick(); await espera(p, 500);
  const n = await dialogos(p), pide = cuenta(await log(p), "pide:");
  ok("pla-14-doble-clic-en-pasar-abre-una-pregunta", n === 1 && pide === 1, `${n} pregunta(s) abierta(s); se pidió ${pide} vez/veces`);
});
await caso("pla-15-en-espera-lo-dice", "", async p => {
  await botonDe(p, "P-0723").click(); await espera(p);
  const d = await dialogo(p);
  ok("pla-15-en-espera-lo-dice", /espera/i.test(d || "") && /material/i.test(d || ""), d ? (/espera/i.test(d) ? "dice que está en espera" + (/material/i.test(d) ? " y por qué" : " pero NO por qué") : "NO dice que está en espera: «" + d.slice(0, 160) + "»") : "no pregunta");
});
await caso("pla-16-la-de-la-fila-lo-dice", "", async p => {
  await botonDe(p, "P-0722").click(); await espera(p);
  const d = await dialogo(p) || "";
  ok("pla-16-la-de-la-fila-lo-dice", /2ª en la fila/.test(d) && /todavía no/i.test(d), d ? "«" + d.slice(0, 200) + "»" : "no pregunta");
});

// ── vuelta 2: por donde no se diseñó ──
await caso("pla-17-sin-maquina-ni-cliente", "", async p => {
  const r = await dice(p, "P-0732");
  await botonDe(p, "P-0732").click(); await espera(p);
  const d = await dialogo(p) || "";
  const malo = /undefined|null|NaN| 0 pzas/.test((r || "") + " " + d);
  ok("pla-17-sin-maquina-ni-cliente", !!r && /Sin cliente/.test(r) && /En máquina/.test(r) && !!d && !malo,
    `renglón: «${r}»; pregunta: «${d.slice(0, 160)}»${malo ? " · DICE undefined/null/NaN/0 pzas" : ""}`);
});
await caso("pla-18-con-el-teclado-de-principio-a-fin", "", async p => {
  // Enter en «Pasar a Salidas», Tab al sí, Enter: se pasa, y el foco no se pierde: va al «Pasar a Salidas» que seguía (P-0723)
  await botonDe(p, "P-0721").focus(); await p.keyboard.press("Enter"); await espera(p, 300);
  await p.keyboard.press("Tab"); const enSi = await p.evaluate(() => (document.activeElement?.textContent || "").trim());
  await p.keyboard.press("Enter"); await espera(p, 900);
  const l = await log(p);
  const foco = await p.evaluate(() => { const a = document.activeElement; const f = a && a.closest("[data-orden]"); return f ? f.getAttribute("data-orden") + " · " + a.textContent.trim() : (a ? a.tagName + (a.getAttribute("aria-label") ? "[" + a.getAttribute("aria-label") + "]" : "") : "nada"); });
  ok("pla-18-con-el-teclado-de-principio-a-fin", /Sí, ya está lista/.test(enSi) && /jalar:P-0721/.test(l) && /OP-P-0723 · .*Pasar a Salidas/.test(foco),
    `Tab llega a «${enSi}»; ${/jalar:P-0721/.test(l) ? "la pasa" : "NO la pasa"}; el foco queda en: ${foco}`);
});
await caso("pla-19-desde-la-oc-el-foco-sigue", "vista=oc&oc=OC-0657", async p => {
  // desde el aviso de la OC: pasadas las que faltan, el aviso se va; el foco no puede quedar en la nada
  await p.getByRole("button", { name: /pasar las 2 a Salidas/i }).focus(); await p.keyboard.press("Enter"); await espera(p, 300);
  await p.keyboard.press("Tab"); await p.keyboard.press("Enter"); await espera(p, 900);
  const foco = await p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? "BODY (perdido)" : a.tagName + " «" + (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 40) + "»"; });
  ok("pla-19-desde-la-oc-el-foco-sigue", !/BODY/.test(foco) && /jalar:/.test(await log(p)), "el foco queda en: " + foco);
});
await caso("pla-24-doble-clic-en-pasar-las-dos", "", async p => {
  await grupoOC(p, "OC-0657").getByRole("button", { name: /Pasar las 2 a Salidas/ }).dblclick(); await espera(p, 500);
  const n = await dialogos(p), pide = cuenta(await log(p), "pide:");
  ok("pla-24-doble-clic-en-pasar-las-dos", n === 1 && pide === 1, `${n} pregunta(s); se pidió ${pide} vez/veces`);
});
await caso("pla-43-celular", "", async p => {
  const r = await p.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    bajos: [...document.querySelectorAll("[data-orden] button, [data-oc] button")].filter(b => b.getClientRects().length && b.getBoundingClientRect().height < 40).map(b => b.textContent.trim().slice(0, 20)),
    salidos: [...document.querySelectorAll("[data-orden]")].filter(f => f.getClientRects().length && f.scrollWidth > f.clientWidth + 1).map(f => f.getAttribute("data-orden")) }));
  ok("pla-43-celular", !r.horizontal && !r.bajos.length && !r.salidos.length, `${r.horizontal ? "CON barra horizontal" : "sin barra horizontal"}${r.bajos.length ? "; botones bajos: " + r.bajos.slice(0, 4).join(", ") : ""}${r.salidos.length ? "; se salen: " + r.salidos.join(", ") : ""}`);
}, { width: 390, height: 844 }, { hasTouch: true, isMobile: true });

// ── pasar las que le faltan a una OC ──
await caso("pla-20-oc-pasar-las-dos", "", async p => {
  await grupoOC(p, "OC-0657").getByRole("button", { name: /Pasar las 2 a Salidas/ }).click(); await espera(p);
  const d = await dialogo(p) || "";
  const bien = [/OC-0657/.test(d), /\b2\b/.test(d), /P-0704/.test(d) && /P-0705/.test(d), /GTO 1 Color/.test(d) && /Empaque/.test(d), await p.getByRole("button", { name: /Sí, ya están listas/ }).count() === 1];
  ok("pla-20-oc-pasar-las-dos", bien.every(Boolean), d ? ["nombra la OC", "dice cuántas", "lista las dos", "dice dónde está cada una", "el sí habla de las dos («ya están listas»)"].map((x, i) => (bien[i] ? "" : "NO ") + x).join(" · ") : "NO PREGUNTA");
});
await caso("pla-21-oc-confirmar", "", async p => {
  await grupoOC(p, "OC-0657").getByRole("button", { name: /Pasar las 2 a Salidas/ }).click(); await espera(p);
  await p.getByRole("button", { name: /Sí, ya están listas/ }).click(); await espera(p, 900);
  // (en el orden de la pantalla: Empaque antes que la máquina; lo que importa es que pasen las dos, una vez cada una)
  const l = await log(p), sigue = await grupoOC(p, "OC-0657").count(), j = (l.match(/jalar:[^\n]*/g) || []);
  const lasDos = j.length === 1 && /P-0704/.test(j[0]) && /P-0705/.test(j[0]);
  ok("pla-21-oc-confirmar", lasDos && !sigue, `${lasDos ? "pasa las dos" : "NO pasa las dos (" + (j.join(" | ") || "nada") + ")"}; la OC ${sigue ? "SIGUE esperando" : "sale de las que esperan"}`);
});
await caso("pla-22-oc-misma-maquina-no-promete-a-la-que-tambien-sale", "", async p => {
  await grupoOC(p, "OC-0665").getByRole("button", { name: /Pasar las 2 a Salidas/ }).click(); await espera(p);
  const d = await dialogo(p) || "";
  ok("pla-22-oc-misma-maquina-no-promete-a-la-que-tambien-sale", /empieza[^.]*P-0711/.test(d) && !/empieza[^.]*P-0742/.test(d),
    /empieza[^.]*P-0742/.test(d) ? "dice que empieza P-0742, que también sale" : /empieza[^.]*P-0711/.test(d) ? "dice que empieza P-0711" : "no dice cuál empieza: «" + d.slice(0, 220) + "»");
});
await caso("pla-23-oc-sin-boton-de-oc-si-solo-una-se-puede", "", async p => {
  const deOC = await grupoOC(p, "OC-0660").getByRole("button", { name: /Pasar las/ }).count();
  const [b11, b12] = await Promise.all([tieneBoton(p, "P-0711"), tieneBoton(p, "P-0712")]);
  ok("pla-23-oc-sin-boton-de-oc-si-solo-una-se-puede", deOC === 0 && b11 && !b12, `la OC-0660 ${deOC ? "TIENE «Pasar las…»" : "sin botón de OC"}; P-0711 ${b11 ? "con" : "SIN"} botón; P-0712 (CTP) ${b12 ? "CON botón" : "sin botón"}`);
});

// ── buscar ──
await caso("pla-30-buscar-una-de-la-planta", "buscar=P-0704", async p => {
  const t = await enPantalla(p), otras = ["P-0705", "P-0720", "P-0721"].filter(x => t.includes(x)), g = await textoDe(p, '[data-oc="OC-0657"]');
  ok("pla-30-buscar-una-de-la-planta", !!(await dice(p, "P-0704")) && !otras.length && /3 de 5/.test(g || ""), `${(await dice(p, "P-0704")) ? "sale P-0704" : "NO sale P-0704"}${otras.length ? "; y salen " + otras.join(", ") : ""}; la OC ${/3 de 5/.test(g || "") ? "sigue diciendo 3 de 5" : "dice «" + g + "»"}`);
});
await caso("pla-31-buscar-sin-nada", "buscar=ZZZ", async p => {
  const t = await enPantalla(p);
  ok("pla-31-buscar-sin-nada", /ZZZ/.test(t) && !/Nada en la planta/.test(t), /ZZZ/.test(t) ? "dice que no hay nada con «ZZZ»" : "NO dice qué se buscó: «" + t.slice(0, 160) + "»");
});
await caso("pla-32-nada-en-la-planta", "caso=vacio", async p => {
  const t = await enPantalla(p);
  ok("pla-32-nada-en-la-planta", /Nada en la planta/.test(t) && /Por foliar/.test(t), "«" + t.slice(0, 200) + "»");
});

// ── tamaños ──
for (const [an, al] of [[1366, 768], [1920, 1080]])
  await caso("pla-40-se-acomoda-a-" + an, "", async p => {
    const r = await p.evaluate(() => {
      const horizontal = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      const lineas = b => { const rg = document.createRange(); rg.selectNodeContents(b); const cs = [...rg.getClientRects()].filter(x => x.width > 0 && x.height > 0).map(x => x.top + x.height / 2).sort((u, v) => u - v); let n = cs.length ? 1 : 0; for (let i = 1; i < cs.length; i++) if (cs[i] - cs[i - 1] > 8) n++; return n; };
      const botones = [...document.querySelectorAll("[data-orden] button, [data-oc] button")].filter(b => b.getClientRects().length && /Pasar/.test(b.textContent));
      const partidos = botones.filter(b => lineas(b) > 1).map(b => b.textContent.trim());
      const salidos = [...document.querySelectorAll("[data-orden]")].filter(f => f.getClientRects().length && f.scrollWidth > f.clientWidth + 1).map(f => f.getAttribute("data-orden"));
      return { horizontal, n: botones.length, partidos, salidos };
    });
    ok("pla-40-se-acomoda-a-" + an, !r.horizontal && r.n >= 8 && !r.partidos.length && !r.salidos.length, `${r.horizontal ? "CON barra horizontal" : "sin barra horizontal"}; ${r.n} botones${r.partidos.length ? ", partidos en dos renglones: " + r.partidos.join(", ") : " en un renglón"}${r.salidos.length ? "; se salen de su renglón: " + r.salidos.join(", ") : ""}`);
  }, { width: an, height: al });
await caso("pla-41-tableta", "", async p => {
  const r = await p.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    bajos: [...document.querySelectorAll("[data-orden] button, [data-oc] button")].filter(b => b.getClientRects().length && b.getBoundingClientRect().height < 40).map(b => b.textContent.trim().slice(0, 20)) }));
  ok("pla-41-tableta", !r.horizontal && !r.bajos.length, `${r.horizontal ? "CON barra horizontal" : "sin barra horizontal"}${r.bajos.length ? "; botones de menos de 40 px: " + r.bajos.slice(0, 5).join(", ") : "; botones de 40 px o más"}`);
}, { width: 768, height: 1024 }, { hasTouch: true, isMobile: true });
const contrastes = p => p.evaluate(() => {
  const nums = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = el => { const capas = []; for (let x = el; x; x = x.parentElement) { const v = nums(getComputedStyle(x).backgroundColor); if (v.length === 3 || (v.length === 4 && v[3] >= 0.999)) { capas.push([v[0], v[1], v[2], 1]); break; } if (v.length === 4 && v[3] > 0) capas.push(v); }
    let c = [255, 255, 255]; for (let i = capas.length - 1; i >= 0; i--) { const [r, g, b, a] = capas[i]; c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)]; } return c; };
  const opac = el => { let o = 1; for (let x = el; x; x = x.parentElement) o *= Number(getComputedStyle(x).opacity); return o; };
  const propio = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
  const malos = [];
  for (const el of document.querySelectorAll("main *")) { const t = propio(el); if (!t || !el.getClientRects().length || el.closest("#log")) continue;
    const fg = nums(getComputedStyle(el).color), bg = fondo(el), o = opac(el), mix = fg.slice(0, 3).map((c, i) => c * o + bg[i] * (1 - o));
    const a = lum(mix), b = lum(bg), k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); if (k < 4.5) malos.push(t.slice(0, 24) + " " + k.toFixed(1)); }
  return malos; });
await caso("pla-42-todo-se-lee", "", async p => {
  for (const s of await p.locator("summary").all()) await s.click();
  await espera(p);
  const malos = await contrastes(p);
  ok("pla-42-todo-se-lee", !malos.length, malos.length ? malos.length + " textos bajo 4.5: " + [...new Set(malos)].slice(0, 6).join(" · ") : "todo el texto a 4.5 o más");
});

// ── el tiempo real ──
await caso("pla-50-la-pregunta-se-vence-si-otra-persona-la-mueve", "", async p => {
  await botonDe(p, "P-0720").click(); await espera(p);
  await p.evaluate(() => window.__cambiar("P-0720", { stage: "salidas", current_machine: null })); await espera(p, 600);
  const n = await dialogos(p), l = await log(p), aviso = await p.evaluate(() => [...document.querySelectorAll("div")].map(d => d.innerText || "").find(t => /P-0720/.test(t) && t.length < 260 && !/^\s*P-0720\s*$/.test(t)) || "");
  ok("pla-50-la-pregunta-se-vence-si-otra-persona-la-mueve", n === 0 && !/jalar:/.test(l) && /pregunta vencida/.test(l), `la pregunta ${n ? "SIGUE abierta" : "se cierra"}; ${/jalar:/.test(l) ? "la MOVIÓ" : "no mueve nada"}; ${/pregunta vencida/.test(l) ? "lo dice: «" + (l.match(/pregunta vencida: [^\n]*/) || [""])[0].slice(18, 140) + "»" : "NO dice por qué se cerró"}`);
});
await caso("pla-51-se-va-si-otra-persona-la-pasa", "", async p => {
  await p.evaluate(() => window.__cambiar("P-0705", { stage: "salidas", current_machine: null })); await espera(p, 500);
  const g = await textoDe(p, '[data-oc="OC-0657"]'), sigue = await dice(p, "P-0705");
  ok("pla-51-se-va-si-otra-persona-la-pasa", !sigue && /4 de 5/.test(g || ""), `P-0705 ${sigue ? "SIGUE" : "se va"}; la OC dice «${(g || "").match(/\d+ de \d+/)?.[0] || g}»`);
});

// ── el aviso de la OC que no se puede foliar entera ──
await caso("pla-70-oc-dice-cuales-faltan", "vista=oc&oc=OC-0657", async p => {
  const t = await enPantalla(p);
  const bien = [/5/.test(t) && /Salidas/.test(t), /P-0704/.test(t) && /GTO 1 Color/.test(t), /P-0705/.test(t) && /Empaque/.test(t), await p.getByRole("button", { name: /pasar las 2 a Salidas/i }).count() === 1];
  ok("pla-70-oc-dice-cuales-faltan", bien.every(Boolean), ["dice que las 5 tienen que estar en Salidas", "P-0704 en la GTO", "P-0705 en Empaque", "un botón para pasar las 2"].map((x, i) => (bien[i] ? "" : "NO ") + x).join(" · "));
});
await caso("pla-71-oc-con-una-que-no-se-puede", "vista=oc&oc=OC-0660", async p => {
  const t = await enPantalla(p), b = await p.getByRole("button", { name: /P-0711/ }).count();
  const bien = [b === 1, /P-0712/.test(t) && /CTP/.test(t), /Pre-asignar folio/.test(t)];
  ok("pla-71-oc-con-una-que-no-se-puede", bien.every(Boolean), ["el botón nombra a P-0711", "dice que P-0712 sigue en CTP", "ofrece «Pre-asignar folio» si urge"].map((x, i) => (bien[i] ? "" : "NO ") + x).join(" · "));
});
await caso("pla-72-oc-completa-sin-aviso", "vista=oc&oc=OC-LISTA", async p => {
  const t = await enPantalla(p);
  ok("pla-72-oc-completa-sin-aviso", !/Faltan|Salidas/.test(t), /Faltan|Salidas/.test(t) ? "con todo en Salidas SALE el aviso: «" + t.slice(0, 140) + "»" : "sin aviso");
});
await caso("pla-73-oc-el-boton-pregunta", "vista=oc&oc=OC-0657", async p => {
  await p.getByRole("button", { name: /pasar las 2 a Salidas/i }).click(); await espera(p);
  const d = await dialogo(p) || "";
  ok("pla-73-oc-el-boton-pregunta", /OC-0657/.test(d) && /P-0704/.test(d) && /P-0705/.test(d) && !/jalar:/.test(await log(p)), d ? "«" + d.slice(0, 160) + "»" : "NO PREGUNTA");
});

// ── con el teclado ──
await caso("pla-60-con-el-teclado", "", async p => {
  // Tab desde arriba llega al botón de la OC y a los de cada orden; el grupo plegado se abre con Enter
  const vistos = [];
  for (let i = 0; i < 40; i++) { await p.keyboard.press("Tab"); vistos.push(await p.evaluate(() => (document.activeElement?.textContent || "").trim().slice(0, 40))); }
  const resumen = p.getByText(/Todavía no llegan a máquina/).first();
  await resumen.focus().catch(() => {}); await p.keyboard.press("Enter"); await espera(p);
  const abierto = await fila(p, "P-0724").isVisible().catch(() => false);
  ok("pla-60-con-el-teclado", vistos.some(t => /Pasar las 2/.test(t)) && vistos.filter(t => /Pasar a Salidas/.test(t)).length >= 4 && abierto,
    `con Tab: ${vistos.some(t => /Pasar las 2/.test(t)) ? "llega a «Pasar las 2»" : "NO llega a «Pasar las 2»"}, ${vistos.filter(t => /Pasar a Salidas/.test(t)).length} «Pasar a Salidas»; Enter ${abierto ? "abre" : "NO abre"} «Todavía no llegan a máquina»`);
});
await browser.close();
for (const r of res) console.log(r);
