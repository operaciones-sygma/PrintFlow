// Tratar de ROMPER «Archivos» (StorageTab) en su banco: que calcule el espacio con la lista de la base, que «huérfano» sea sólo
// lo que la base dice que nadie usa, y que los botones que BORRAN no se lleven nada de una orden ni cuenten como borrado lo
// que Storage no borró. Cada caso afirma lo que DEBERÍA pasar: una FALLA es un bug.
// Uso: node archivos-pantalla.mjs <dir-capturas> [puerto=5197]
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5197);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/StorageTab list|cleanup/.test(m.text())) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.getByText("Almacenamiento Supabase").waitFor();
    await page.waitForTimeout(400);
    await fn(page);
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
const renglon = (p, zona, archivo) => p.getByText(zona).locator("xpath=ancestor::div[2]").getByText(archivo, { exact: false }).first().locator("xpath=ancestor::div[.//button[@title]][1]");

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
  await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).click(); await espera(p, 600);
  const rm = await lineas(p, "remove:"), al = await lineas(p, "alert:");
  ok("ap-limpiar-huerfanos-borra-solo-ese", rm.length === 1 && rm[0] === "remove: replica/img-x.png" && al.some(a => /1 archivo huérfano eliminado/.test(a)),
    `borró: [${rm.join(" | ")}]; avisó: [${al.join(" | ")}]`);
});
await caso("ap-limpiar-huerfanos-no-cuenta-lo-no-borrado", "modo=rmvacio", async p => {
  await p.getByRole("button", { name: /Limpiar Todos \(\d+\)/ }).click(); await espera(p, 600);
  const al = await lineas(p, "alert:");
  ok("ap-limpiar-huerfanos-no-cuenta-lo-no-borrado", !al.some(a => /eliminado/.test(a)),
    `Storage no borró nada (contestó 200 vacío); la pantalla avisó: [${al.join(" | ") || "nada"}]`);
});
await caso("ap-top5-no-borra-lo-de-otra-orden", "", async p => {
  const r = renglon(p, "Archivos Más Pesados", "de-otra.pdf");
  const dice = await r.innerText();
  await r.locator("button[title]").last().click(); await espera(p, 400);
  const rm = await lineas(p, "remove:"), al = await lineas(p, "alert:");
  ok("ap-top5-no-borra-lo-de-otra-orden", rm.length === 0 && al.some(a => /no está cargada/.test(a)) && !/HUÉRFANO/.test(dice),
    `el archivo de una orden que no está cargada ${/HUÉRFANO/.test(dice) ? "SALE como HUÉRFANO" : "no sale como huérfano"}; al borrarlo: borró [${rm.join(" | ")}], avisó [${al.join(" | ")}]`);
});
await caso("ap-top5-el-huerfano-si-dice-huerfano", "", async p => {
  const dice = await renglon(p, "Archivos Más Pesados", "img-x.png").innerText();
  ok("ap-top5-el-huerfano-si-dice-huerfano", /HUÉRFANO/.test(dice), `en el Top 5, el huérfano de verdad ${/HUÉRFANO/.test(dice) ? "dice" : "NO dice"} HUÉRFANO`);
});
await caso("ap-storage-falla-no-suelta-la-orden", "modo=rmfalla", async p => {
  await p.locator('button[title="Borrar archivo"]').first().click(); await espera(p, 500);
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:"), al = await lineas(p, "alert:");
  ok("ap-storage-falla-no-suelta-la-orden", rm.length === 1 && up.length === 0 && al.some(a => /Error al borrar/.test(a)),
    `Storage falló al borrar: la orden ${up.length ? "SE QUEDÓ SIN su archivo (update)" : "conserva su archivo"}; avisó: [${al.join(" | ")}]`);
});
await caso("ap-borrar-archivo-de-orden", "", async p => {
  await p.locator('button[title="Borrar archivo"]').first().click(); await espera(p, 500);
  const rm = await lineas(p, "remove:"), up = await lineas(p, "update:"), re = await lineas(p, "reload");
  ok("ap-borrar-archivo-de-orden", rm[0] === "remove: OP-1/arte.pdf" && up.length === 1 && /o1/.test(up[0]) && /file_url":null/.test(up[0]) && re.length >= 1,
    `borró [${rm.join(" | ")}] y limpió la orden [${up.join(" | ")}]`);
});
await caso("ap-limpieza-30-dias-dice-lo-que-fallo", "modo=updfalla", async p => {
  await p.getByRole("button", { name: /Borrar Todos los Antiguos/ }).click(); await espera(p, 600);
  const al = await lineas(p, "alert:");
  ok("ap-limpieza-30-dias-dice-lo-que-fallo", al.some(a => /0 de 1/.test(a) && /no se pudieron/.test(a)),
    `la orden no se dejó actualizar; la pantalla avisó: [${al.join(" | ") || "nada"}]`);
});

await browser.close();
for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\narchivos-pantalla: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
