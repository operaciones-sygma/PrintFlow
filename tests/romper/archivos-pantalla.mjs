// Tratar de ROMPER «Archivos» (StorageTab) en su banco: que calcule el espacio con la lista de la base, que «huérfano» sea sólo
// lo que la base dice que nadie usa, y que los botones que BORRAN no se lleven nada de una orden ni cuenten como borrado lo
// que Storage no borró. Cada caso afirma lo que DEBERÍA pasar: una FALLA es un bug.
// v10.84.83 — el archivo de impresión es el historial de la orden (Marcelo, 12-oct): ya no hay borrado en masa de lo de +30 días, el de
//   uno en uno pregunta en una ventana de la app que dice cuál (la orden, su cliente, su etapa, el archivo) y lo que pasó se dice en la
//   pantalla. Un confirm() o alert() nativo es FALLA en cualquier caso (el banco los anota).
// Uso: node archivos-pantalla.mjs <dir-capturas> [puerto=5197]
import { chromium } from "playwright";
import { deFuera } from "../consola.mjs";   // (un recurso de fuera que no cargó no es error de la app)
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5197);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, { viewport = { width: 1366, height: 900 } } = {}) {
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !deFuera(m) && !/StorageTab list|cleanup/.test(m.text())) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.getByText("Almacenamiento Supabase").waitFor();
    await page.waitForTimeout(400);
    await fn(page);
    // v10.84.83 — la pantalla pregunta y avisa con la app, nunca con confirm()/alert() del navegador
    const nativos = [...await lineas(page, "confirm:"), ...await lineas(page, "alert:")];
    if (nativos.length) ok(nombre + " · diálogo nativo", false, nativos.join(" ; ").slice(0, 240));
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.screenshot({ path: OUT + "/" + nombre + ".png", fullPage: true }).catch(() => {});
  await page.close();
}
const log = async p => (await p.textContent("#log")) || "";
const lineas = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref));
const espera = (p, ms = 300) => p.waitForTimeout(ms);
const medidor = p => p.getByText("Almacenamiento Supabase").locator("xpath=ancestor::div[2]");
// el renglón (de la lista que sea) que nombra un archivo, y su botón de borrar
const renglon = (p, zona, archivo) => p.getByText(zona, { exact: true }).locator("xpath=ancestor::div[2]").getByText(archivo, { exact: false }).first().locator("xpath=ancestor::div[.//button[@title]][1]");
// la ventana de la app (role=dialog) y sus botones. Sin ventana, la prueba se cae: un confirm() nativo no es preguntar.
const dialogo = p => p.getByRole("dialog");
const abrirVentana = async p => { await dialogo(p).waitFor({ timeout: 2000 }); return (await dialogo(p).innerText()).replace(/\s+/g, " "); };
const confirmar = async p => { await abrirVentana(p); await dialogo(p).getByRole("button", { name: /^Sí/ }).click(); };
// lo que la pantalla dice (los avisos con role=status o alert, y lo que esté en el cuerpo)
const avisos = async p => (await p.locator('[role="status"],[role="alert"]').allInnerTexts()).join(" | ").replace(/\s+/g, " ");
const cuerpo = async p => (await p.locator("body").innerText()).replace(/\s+/g, " ");
const borrarDelRenglon = p => p.locator('button[title="Borrar archivo"]').first();

await caso("ap-calcula-el-espacio", "", async p => {
  const t = await medidor(p).innerText();
  const listas = await lineas(p, "list"), rpcs = await lineas(p, "rpc: pf_archivos_del_bucket");
  ok("ap-calcula-el-espacio", /13\.9 MB/.test(t) && !/Calculando|Error/.test(t) && rpcs.length === 1 && listas.length === 0,
    `el medidor dice «${t.replace(/\s+/g, " ").slice(0, 60)}»; consultas a la base: ${rpcs.length}; storage.list: ${listas.length}`);
});
await caso("ap-error-dice-error", "modo=rpcfalla", async p => {
  const t = await medidor(p).innerText();
  const color = await p.getByText("No se pudo leer").first().evaluate(el => getComputedStyle(el).color).catch(() => "");
  const tarjetas = await p.getByText("Archivos Producción", { exact: false }).first().locator("xpath=ancestor::div[2]").innerText().catch(() => "");
  ok("ap-error-dice-error", /No se pudo leer/.test(t) && !/\b0(\.0)? MB|0\.0% usado/.test(t) && /Reintentar/.test(t) && color === "rgb(185, 28, 28)" && !/0\s*·\s*0 B/.test(tarjetas),
    `si la lista falla, el medidor dice «${t.replace(/\s+/g, " ").slice(0, 70)}» (color ${color}) y las tarjetas «${tarjetas.replace(/\s+/g, " ").slice(0, 60)}»: nunca 0 MB ni 0 B, en rojo y con Reintentar`);
});
await caso("ap-reintentar-vuelve-a-pedir", "modo=rpcfalla", async p => {
  await p.getByRole("button", { name: "Reintentar" }).click(); await espera(p, 500);
  const rpcs = await lineas(p, "rpc: pf_archivos_del_bucket");
  ok("ap-reintentar-vuelve-a-pedir", rpcs.length === 2, `«Reintentar» pidió la lista otra vez: ${rpcs.length} consultas (deben ser 2)`);
});
await caso("ap-huerfanos-solo-lo-que-dice-la-base", "", async p => {
  const hay = await p.getByText("Archivos Huérfanos Detectados").count();
  const boton = await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).innerText().catch(() => "");
  const zona = hay ? await p.getByText("Archivos Huérfanos Detectados").locator("xpath=ancestor::div[3]").innerText() : "";
  ok("ap-huerfanos-solo-lo-que-dice-la-base", /\(1\)/.test(boton) && /img-x\.png/.test(zona) && !/img-1-hoy|de-otra/.test(zona),
    `botón «${boton}»; la lista de huérfanos ${/img-x/.test(zona) ? "trae" : "NO trae"} el huérfano, ${/img-1-hoy/.test(zona) ? "TRAE la foto de hoy" : "no trae la foto de hoy"}, ${/de-otra/.test(zona) ? "TRAE el de otra orden" : "no trae el de otra orden"}`);
});
await caso("ap-sin-el-dato-nada-es-huerfano", "modo=sincampo", async p => {
  const boton = await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).count();
  const tag = await p.getByText("HUÉRFANO", { exact: true }).count();
  ok("ap-sin-el-dato-nada-es-huerfano", boton === 0 && tag === 0,
    `si la base no dice qué se usa, la pantalla ofrece ${boton ? "«Limpiar Todos»" : "nada para limpiar"} y ${tag} archivo(s) marcados HUÉRFANO`);
});
await caso("ap-limpiar-huerfanos-borra-solo-ese", "", async p => {
  await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).click(); await confirmar(p); await espera(p, 600);
  const rm = await lineas(p, "remove:"), av = await avisos(p);
  ok("ap-limpiar-huerfanos-borra-solo-ese", rm.length === 1 && rm[0] === "remove: replica/img-x.png" && /Se borró 1 archivo huérfano/.test(av),
    `borró: [${rm.join(" | ")}]; la pantalla dijo: «${av}»`);
});
await caso("ap-limpiar-huerfanos-no-cuenta-lo-no-borrado", "modo=rmvacio", async p => {
  await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).click(); await confirmar(p); await espera(p, 600);
  const av = await avisos(p);
  ok("ap-limpiar-huerfanos-no-cuenta-lo-no-borrado", /No se borró ninguno/.test(av) && !/Se borr(ó|aron) \d/.test(av),
    `Storage no borró nada (contestó 200 vacío); la pantalla dijo: «${av || "nada"}»`);
});
await caso("ap-top5-no-borra-lo-de-otra-orden", "", async p => {
  const r = renglon(p, "Archivos Más Pesados", "de-otra.pdf");
  const dice = await r.innerText();
  // v10.84.83 — su botón va con aria-disabled (no se borra desde aquí) y Playwright no le pica; un mouse sí: se fuerza el clic
  const desactivado = await r.locator("button[title]").last().getAttribute("aria-disabled");
  await r.locator("button[title]").last().click({ force: true }); await espera(p, 400);
  const rm = await lineas(p, "remove:"), av = await avisos(p), ventana = await dialogo(p).count();
  ok("ap-top5-no-borra-lo-de-otra-orden", rm.length === 0 && ventana === 0 && /no está cargada/.test(dice + " " + av) && !/HUÉRFANO/.test(dice),
    `el archivo de una orden que no está cargada ${/HUÉRFANO/.test(dice) ? "SALE como HUÉRFANO" : "no sale como huérfano"}; su botón aria-disabled=${desactivado}; al picarle: borró [${rm.join(" | ")}], ${ventana ? "ABRIÓ la ventana de borrar" : "sin ventana"}; el renglón «${dice.replace(/\s+/g, " ").slice(0, 80)}», la pantalla «${av}»`);
});
await caso("ap-top5-el-huerfano-si-dice-huerfano", "", async p => {
  const dice = await renglon(p, "Archivos Más Pesados", "img-x.png").innerText();
  ok("ap-top5-el-huerfano-si-dice-huerfano", /HUÉRFANO/.test(dice), `en el Top 5, el huérfano de verdad ${/HUÉRFANO/.test(dice) ? "dice" : "NO dice"} HUÉRFANO`);
});
await caso("ap-storage-falla-no-suelta-la-orden", "modo=rmfalla", async p => {
  await borrarDelRenglon(p).click(); await confirmar(p); await espera(p, 500);
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:"), av = await avisos(p);
  ok("ap-storage-falla-no-suelta-la-orden", rm.length === 1 && up.length === 0 && /No se borró «arte\.pdf»/.test(av) && /P-0001 lo conserva/.test(av),
    `Storage falló al borrar: la orden ${up.length ? "SE QUEDÓ SIN su archivo (update)" : "conserva su archivo"}; la pantalla dijo: «${av}»`);
});
await caso("ap-borrar-archivo-de-orden", "", async p => {
  await borrarDelRenglon(p).click(); await confirmar(p); await espera(p, 500);
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:"), re = await lineas(p, "reload"), av = await avisos(p);
  ok("ap-borrar-archivo-de-orden", rm[0] === "remove: OP-1/arte.pdf" && up.length === 1 && /o1/.test(up[0]) && /file_url":null/.test(up[0]) && re.length >= 1 && /Se borró «arte\.pdf» de P-0001/.test(av),
    `borró [${rm.join(" | ")}] y limpió la orden [${up.join(" | ")}]; la pantalla dijo «${av}»`);
});

// ── v10.84.83 — vuelta 1: escritas ANTES del cambio, contra v10.84.82 ──
await caso("ap-sin-borrado-masivo", "", async p => {
  const t = await cuerpo(p);
  const masivo = await p.getByRole("button", { name: /Antiguos|Borrar Todos/ }).count();
  const cosas = ["Limpieza Masiva", "elegibles para limpieza", "+30d", "Sin archivos antiguos"].filter(x => t.includes(x));
  ok("ap-sin-borrado-masivo", masivo === 0 && cosas.length === 0,
    `botones de borrar en masa lo de las órdenes: ${masivo}; textos que lo ofrecen: [${cosas.join(" | ")}] (el archivo de impresión es el historial, 12-oct)`);
});
await caso("ap-borrar-uno-dice-cual", "", async p => {
  await borrarDelRenglon(p).click();
  const v = await abrirVentana(p);
  const rm = await lineas(p, "remove:");
  const falta = [["la orden", /P-0001/], ["el cliente", /PORTLAND STUDIO/], ["el archivo", /arte\.pdf/], ["su peso", /4\.8 MB/], ["la etapa", /Máquina/], ["que es el historial", /historial/], ["que no se deshace", /No se puede deshacer/]].filter(([, re]) => !re.test(v)).map(([n]) => n);
  ok("ap-borrar-uno-dice-cual", falta.length === 0 && rm.length === 0,
    `la ventana dice «${v.slice(0, 220)}»; le falta: [${falta.join(", ")}]; con la ventana abierta borró [${rm.join(" | ")}]`);
});
await caso("ap-borrar-uno-esc-o-no-no-borra", "", async p => {
  await borrarDelRenglon(p).click(); await abrirVentana(p);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const tras_esc = await dialogo(p).count();
  await borrarDelRenglon(p).click(); await abrirVentana(p);
  await dialogo(p).getByRole("button", { name: /^No/ }).click(); await espera(p, 300);
  const tras_no = await dialogo(p).count();
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:");
  ok("ap-borrar-uno-esc-o-no-no-borra", tras_esc === 0 && tras_no === 0 && rm.length === 0 && up.length === 0,
    `Esc ${tras_esc ? "NO cerró" : "cerró"} la ventana, «No» ${tras_no ? "NO la cerró" : "la cerró"}; borró [${rm.join(" | ")}], tocó la orden [${up.join(" | ")}]`);
});
await caso("ap-doble-clic-borra-una-vez", "", async p => {
  await borrarDelRenglon(p).click(); await abrirVentana(p);
  await dialogo(p).getByRole("button", { name: /^Sí/ }).dblclick(); await espera(p, 700);
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:");
  ok("ap-doble-clic-borra-una-vez", rm.length === 1 && up.length === 1, `doble clic en «Sí»: ${rm.length} borrado(s) y ${up.length} cambio(s) a la orden (debe ser 1 y 1)`);
});
await caso("ap-orden-no-se-actualiza-lo-dice", "modo=updfalla", async p => {
  await borrarDelRenglon(p).click(); await confirmar(p); await espera(p, 500);
  const av = await avisos(p);
  ok("ap-orden-no-se-actualiza-lo-dice", /del servidor/.test(av) && /P-0001 sigue apuntando/.test(av),
    `Storage lo borró pero la orden no se dejó actualizar; la pantalla dijo: «${av || "nada"}»`);
});
await caso("ap-huerfanos-preguntan-cuantos", "", async p => {
  await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).click();
  const v = await abrirVentana(p);
  await p.keyboard.press("Escape"); await espera(p, 300);
  const rm = await lineas(p, "remove:");
  ok("ap-huerfanos-preguntan-cuantos", /1 archivo huérfano/.test(v) && /293 KB/.test(v) && rm.length === 0,
    `la ventana dice «${v.slice(0, 160)}»; con Esc borró [${rm.join(" | ")}]`);
});
await caso("ap-candado-huerfanos-se-ve-antes", "modo=muchoshuerfanos", async p => {
  const zona = await p.getByText("Archivos Huérfanos Detectados").locator("xpath=ancestor::div[3]").innerText();
  await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).click({ force: true }).catch(() => {}); await espera(p, 400);
  const rm = await lineas(p, "remove:"), ventana = await dialogo(p).count();
  ok("ap-candado-huerfanos-se-ve-antes", /más de la mitad/.test(zona) && rm.length === 0 && ventana === 0,
    `3 de 5 archivos salen huérfanos: antes de picarle la zona dice «${zona.replace(/\s+/g, " ").slice(0, 150)}»; al picarle borró [${rm.join(" | ")}]${ventana ? " y ABRIÓ la ventana de borrar" : ""}`);
});
await caso("ap-candado-sin-ordenes", "modo=sinordenes", async p => {
  const zona = await p.getByText("Archivos Huérfanos Detectados").locator("xpath=ancestor::div[3]").innerText();
  await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).click({ force: true }).catch(() => {}); await espera(p, 400);
  const rm = await lineas(p, "remove:"), ventana = await dialogo(p).count();
  ok("ap-candado-sin-ordenes", /no cargó/.test(zona) && rm.length === 0 && ventana === 0,
    `la lista de órdenes llegó vacía: la zona dice «${zona.replace(/\s+/g, " ").slice(0, 150)}»; al picarle borró [${rm.join(" | ")}]${ventana ? " y ABRIÓ la ventana de borrar" : ""}`);
});
await caso("ap-descargar-no-propone-borrar", "", async p => {
  await p.getByText(/^Todos los Archivos \(/).locator("xpath=ancestor::div[1]").locator("a").first().click(); await espera(p, 1000);
  const t = await cuerpo(p), abrio = await lineas(p, "open:");
  ok("ap-descargar-no-propone-borrar", !/Ya descargaste|Bórralo/.test(t) && abrio.length === 1,
    `al descargar ${/Ya descargaste|Bórralo/.test(t) ? "SALE «¿Ya descargaste? Bórralo»" : "no propone borrar"}; abrió [${abrio.join(" | ")}]`);
});
await caso("ap-botones-dicen-que-archivo", "", async p => {
  const zona = p.getByText(/^Todos los Archivos \(/).locator("xpath=ancestor::div[1]");
  const bajar = await zona.locator("a").first().evaluate(a => a.getAttribute("aria-label") || a.title || a.textContent.trim());
  const borrar = await borrarDelRenglon(p).evaluate(b => b.getAttribute("aria-label") || b.textContent.trim() || b.title);
  ok("ap-botones-dicen-que-archivo", /Descargar/.test(bajar) && /arte\.pdf/.test(bajar) && /Borrar/.test(borrar) && /arte\.pdf/.test(borrar),
    `el de descargar se llama «${bajar}»; el de borrar, «${borrar}» (un lector de pantalla oye eso)`);
});
await caso("ap-lleno-no-manda-a-lo-que-no-hay", "modo=lleno", async p => {
  const t = (await medidor(p).innerText()).replace(/\s+/g, " ");
  ok("ap-lleno-no-manda-a-lo-que-no-hay", /lleno|90%|70%/.test(t) && !/antiguos/.test(t) && /huérfanos/.test(t),
    `con el bucket a más del 90 %, el aviso dice «${t.slice(0, 200)}» (no hay limpieza de antiguos: debe mandar a lo que sí se puede)`);
});
await caso("ap-top5-borra-con-pregunta", "", async p => {
  await renglon(p, "Archivos Más Pesados", "arte.pdf").locator("button[title]").last().click();
  const v = await abrirVentana(p);
  await dialogo(p).getByRole("button", { name: /^Sí/ }).click(); await espera(p, 500);
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:");
  ok("ap-top5-borra-con-pregunta", /P-0001/.test(v) && /arte\.pdf/.test(v) && /impresión/.test(v) && rm[0] === "remove: OP-1/arte.pdf" && up.length === 1 && /file_url":null/.test(up[0]),
    `la ventana: «${v.slice(0, 120)}»; borró [${rm.join(" | ")}], la orden [${up.join(" | ")}]`);
});
await caso("ap-top5-imagen-dice-imagen", "", async p => {
  await renglon(p, "Archivos Más Pesados", "img-1-a.png").locator("button[title]").last().click();
  const v = await abrirVentana(p);
  await dialogo(p).getByRole("button", { name: /^Sí/ }).click(); await espera(p, 500);
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:");
  ok("ap-top5-imagen-dice-imagen", /imagen/.test(v) && !/impresión/.test(v) && rm[0] === "remove: new-img-a/img-1-a.png" && up.length === 1 && /image_url":null/.test(up[0]) && !/file_url":null/.test(up[0]),
    `la ventana: «${v.slice(0, 120)}»; borró [${rm.join(" | ")}], la orden [${up.join(" | ")}]`);
});

// ── v10.84.83 — vuelta 2: por donde no se diseñó ──
await caso("ap-v2-doble-clic-en-el-bote", "", async p => {
  await borrarDelRenglon(p).dblclick(); await espera(p, 400);
  const ventanas = await dialogo(p).count(), rm = await lineas(p, "remove:");
  ok("ap-v2-doble-clic-en-el-bote", ventanas === 1 && rm.length === 0, `doble clic en el bote: ${ventanas} ventana(s) abierta(s) (debe ser 1) y borró [${rm.join(" | ")}]`);
});
await caso("ap-v2-doble-clic-limpiar-todos", "", async p => {
  await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).dblclick(); await espera(p, 400);
  const ventanas = await dialogo(p).count(), rm = await lineas(p, "remove:");
  ok("ap-v2-doble-clic-limpiar-todos", ventanas === 1 && rm.length === 0, `doble clic en «Limpiar Todos»: ${ventanas} ventana(s) y borró [${rm.join(" | ")}]`);
});
await caso("ap-v2-clic-fuera-no-borra", "", async p => {
  await borrarDelRenglon(p).click(); await abrirVentana(p);
  await p.mouse.click(8, 8); await espera(p, 400);
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:");
  ok("ap-v2-clic-fuera-no-borra", rm.length === 0 && up.length === 0, `clic fuera de la ventana: borró [${rm.join(" | ")}], tocó la orden [${up.join(" | ")}]`);
});
await caso("ap-v2-cambia-con-la-ventana-abierta", "", async p => {
  await borrarDelRenglon(p).click(); await abrirVentana(p);
  await p.evaluate(() => window.__cambiarArchivo()); await espera(p, 300);
  await dialogo(p).getByRole("button", { name: /^Sí/ }).click(); await espera(p, 500);
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:"), av = await avisos(p);
  ok("ap-v2-cambia-con-la-ventana-abierta", rm.length === 0 && up.length === 0 && /cambió/.test(av) && /no se borró nada/.test(av),
    `la orden cambió de archivo con la ventana abierta: borró [${rm.join(" | ")}], tocó la orden [${up.join(" | ")}]; la pantalla dijo «${av}»`);
});
await caso("ap-v2-esc-mientras-borra-no-cierra-la-otra", "modo=lento", async p => {
  await borrarDelRenglon(p).click(); await abrirVentana(p);
  await dialogo(p).getByRole("button", { name: /^Sí/ }).click(); await espera(p, 200);
  await p.keyboard.press("Escape"); await espera(p, 200);
  const cerro = (await dialogo(p).count()) === 0;
  // la otra: borrar el huérfano desde su renglón
  if (cerro) { await p.getByRole("button", { name: /huérfano «img-x\.png»/ }).click(); await abrirVentana(p); }
  await espera(p, 2200);
  const sigue = await dialogo(p).count(), texto = sigue ? await abrirVentana(p) : "";
  ok("ap-v2-esc-mientras-borra-no-cierra-la-otra", sigue === 1 && /huérfano/.test(texto),
    `Esc a media borrada ${cerro ? "cerró" : "NO cerró"} la ventana; la del huérfano, abierta después, ${sigue ? "sigue abierta" : "SE CERRÓ SOLA cuando terminó la primera"}`);
});
await caso("ap-v2-lista-falla-y-se-borra-igual", "modo=rpcfalla", async p => {
  await borrarDelRenglon(p).click(); const v = await abrirVentana(p);
  await dialogo(p).getByRole("button", { name: /^Sí/ }).click(); await espera(p, 500);
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:");
  ok("ap-v2-lista-falla-y-se-borra-igual", /P-0001/.test(v) && /arte\.pdf/.test(v) && !/null|undefined/.test(v) && rm[0] === "remove: OP-1/arte.pdf" && up.length === 1,
    `con la lista del bucket caída, la ventana dice «${v.slice(0, 110)}»; borró [${rm.join(" | ")}], la orden [${up.length}]`);
});
await caso("ap-v2-1920", "", async p => {
  await borrarDelRenglon(p).click(); await abrirVentana(p);
  const caja = await dialogo(p).boundingBox();
  await dialogo(p).getByRole("button", { name: /^Sí/ }).click(); await espera(p, 400);
  const aviso = await p.locator('[role="status"]').first().boundingBox().catch(() => null);
  const dentro = b => !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= 1920 && b.y + b.height <= 1080;
  ok("ap-v2-1920", dentro(caja) && dentro(aviso), `a 1920×1080: la ventana ${JSON.stringify(caja && { x: Math.round(caja.x), y: Math.round(caja.y), w: Math.round(caja.width), h: Math.round(caja.height) })}, el aviso ${JSON.stringify(aviso && { x: Math.round(aviso.x), y: Math.round(aviso.y) })}: los dos dentro de la pantalla`);
}, { viewport: { width: 1920, height: 1080 } });
await caso("ap-v2-teclado", "", async p => {
  const bote = borrarDelRenglon(p);
  await bote.focus(); await p.keyboard.press("Enter"); await abrirVentana(p);
  const enfocado = await p.evaluate(() => document.activeElement?.textContent || "");
  await p.keyboard.press("Enter"); await espera(p, 400);
  const cerro = (await dialogo(p).count()) === 0, vuelve = await bote.evaluate(b => b === document.activeElement);
  const rm = await lineas(p, "remove:");
  ok("ap-v2-teclado", /^No/.test(enfocado) && cerro && vuelve && rm.length === 0,
    `con Enter en el bote se abre y el foco cae en «${enfocado}»; Enter ${cerro ? "cierra" : "NO cierra"} sin borrar (borró [${rm.join(" | ")}]) y el foco ${vuelve ? "regresa al bote" : "NO regresa al bote"}`);
});
await caso("ap-v2-dos-huerfanos-plural", "modo=doshuerfanos", async p => {
  await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).click(); const v = await abrirVentana(p);
  await dialogo(p).getByRole("button", { name: /^Sí/ }).click(); await espera(p, 600);
  const rm = await lineas(p, "remove:"), av = await avisos(p);
  ok("ap-v2-dos-huerfanos-plural", /¿Borrar 2 archivos huérfanos\?/.test(v) && /Sí, borrar los 2/.test(v) && rm.length === 2 && /Se borraron 2 archivos huérfanos/.test(av),
    `la ventana «${v.slice(0, 90)}»; borró [${rm.join(" | ")}]; la pantalla dijo «${av}»`);
});
await caso("ap-v2-huerfanos-a-medias", "modo=doshuerfanos,rmparcial", async p => {
  await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).click(); await confirmar(p); await espera(p, 600);
  const av = await avisos(p);
  ok("ap-v2-huerfanos-a-medias", /Se borró 1 de 2 archivos huérfanos/.test(av) && /el otro no/.test(av),
    `Storage borró uno de dos; la pantalla dijo «${av}»`);
});
await caso("ap-v2-limpiar-todos-con-aa", "", async p => {
  const r = await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).evaluate(b => {
    const rgb = c => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const cs = getComputedStyle(b), a = lum(rgb(cs.color)), z = lum(rgb(cs.backgroundColor));
    return { color: cs.color, fondo: cs.backgroundColor, contraste: Math.round(((Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05)) * 100) / 100 };
  });
  ok("ap-v2-limpiar-todos-con-aa", r.contraste >= 4.5, `«Limpiar Todos»: ${r.color} sobre ${r.fondo} = ${r.contraste}:1 (AA pide 4.5)`);
});
await caso("ap-v2-huerfano-solo-falla", "modo=rmfalla", async p => {
  await p.getByRole("button", { name: /huérfano «img-x\.png»/ }).click(); await confirmar(p); await espera(p, 500);
  const av = await avisos(p);
  ok("ap-v2-huerfano-solo-falla", /No se borró «img-x\.png»/.test(av) && !/Se borró/.test(av), `Storage negó borrar el huérfano; la pantalla dijo «${av}»`);
});
await caso("ap-v2-segunda-imagen", "modo=segunda", async p => {
  await renglon(p, "Archivos Más Pesados", "img-2-b.png").locator("button[title]").last().click(); const v = await abrirVentana(p);
  await dialogo(p).getByRole("button", { name: /^Sí/ }).click(); await espera(p, 500);
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:");
  ok("ap-v2-segunda-imagen", /imagen/.test(v) && rm[0] === "remove: new-img-b/img-2-b.png" && up.length === 1 && /image_url_2":null/.test(up[0]) && !/"image_url":null/.test(up[0]),
    `borrar la SEGUNDA imagen: borró [${rm.join(" | ")}], la orden [${up.join(" | ")}]`);
});
await caso("ap-v2-orden-sin-folio", "modo=sinfolio", async p => {
  await borrarDelRenglon(p).click(); const v = await abrirVentana(p);
  const nombre = await borrarDelRenglon(p).getAttribute("aria-label").catch(() => "");
  ok("ap-v2-orden-sin-folio", /de o1\?/.test(v) && !/null|undefined/.test(v + nombre), `una orden sin P-…: la ventana «${v.slice(0, 80)}», el botón «${nombre}»`);
});

await caso("ap-v2-la-orden-se-limpia-solo-si-sigue-con-ese", "", async p => {
  await borrarDelRenglon(p).click(); await confirmar(p); await espera(p, 500);
  const up = await lineas(p, "update:");
  // si el realtime no alcanzó a decir que la orden cambió de archivo, la base no debe quitarle el NUEVO: el update lleva el archivo que se borró
  ok("ap-v2-la-orden-se-limpia-solo-si-sigue-con-ese", up.length === 1 && /id=o1&file_url=\S*OP-1\/arte\.pdf /.test(up[0]),
    `el cambio a la orden: [${up.join(" | ")}] (debe ir sólo si la orden sigue con OP-1/arte.pdf)`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\narchivos-pantalla: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
