// Tratar de ROMPER el vendedor de «Nueva Orden de Compra» (v10.84.166). Marcelo, 21-oct: a Pepe Chuy le faltaban MONICA CUADRA BECERRA e
// ISABEL DE LOS ANGELES QUIROZ en sus comisiones, y «que en PrintFlow esos clientes tengan la ficha de Pepe Chuy encendida por default». La
// comisión se paga por el vendedor del documento, que sale de la orden, y lo que se agrega a una OC toma el vendedor de la OC: esta ventana
// arrancaba en «— Sin asignar —» aunque la ficha del cliente dijera otra cosa (F-142 de Isabel salió a nombre de Manuel por OC-0911).
// Cada caso afirma lo que DEBERÍA pasar: una FALLA es un bug.
// Uso: node nueva-oc.mjs <dir-capturas> [puerto=5491]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import { deFuera, deVite } from "../consola.mjs";   // (un recurso de fuera que no cargó, o el websocket del banco, no es error de la app)
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5491);
fs.mkdirSync(OUT, { recursive: true });
const res = [];
const ok = (n, c, x = "") => res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : ""));
let browser;
try { browser = await chromium.launch({ headless: true }); } catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
async function caso(nombre, query, fn, viewport = { width: 1366, height: 768 }) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !deFuera(m) && !deVite(m)) errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector('[role="dialog"]', { timeout: 30000 });   // (la primera carga, con varias tandas a la vez, puede pasar de 6 s)
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.close();
}
const log = async p => (await p.textContent("#log")) || "";
const lineas = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref));
const espera = (p, ms = 250) => p.waitForTimeout(ms);
const dlg = p => p.locator('[role="dialog"]').first();
const txt = async loc => ((await loc.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
const campoCliente = p => dlg(p).getByPlaceholder("Cliente (escribe para buscar)");   // (no por «combobox»: el agente de compras y el vendedor también lo son)
const selVendedor = p => dlg(p).locator("select");
const vendedor = async p => ((await selVendedor(p).evaluate(s => s.options[s.selectedIndex]?.text || "").catch(() => "")) || "").trim();
const elegirVendedor = (p, v) => selVendedor(p).selectOption({ label: v });
// escribe en el buscador y elige del autocompletado (como Karla: con el ratón)
async function elegirCliente(p, escribe, nombre) {
  await campoCliente(p).fill(escribe);
  const op = p.getByRole("option", { name: new RegExp(nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first();
  await op.waitFor({ timeout: 6000 });
  await op.click();
}
// lo que contesta la base del vendedor de un cliente (si se le pregunta) y un respiro para que la ventana lo pinte
async function contesto(p, id, max = 2500) {
  for (let t = 0; t < max; t += 100) { if ((await log(p)).includes("vendedor-contestado " + id)) break; await espera(p, 100); }
  await espera(p, 200);
}
const preguntoVendedor = async (p, id) => (await lineas(p, "rpc:get_client_seller_label ")).some(l => l.includes(id));
// «Crear OC» y lo que sale: la OC creada (lo que recibió App), o nada
async function crear(p) {
  await dlg(p).getByRole("button", { name: /^Crear OC$/ }).click();
  for (let t = 0; t < 4000; t += 100) { if ((await lineas(p, "crear-oc ")).length) break; await espera(p, 100); }
  await espera(p, 150);
  const l = (await lineas(p, "crear-oc ")).pop();
  return l ? JSON.parse(l.slice("crear-oc ".length)) : null;
}
const porQue = p => dlg(p).getByText(/Sugerido/);
const aviso = async p => txt(dlg(p).locator('[role="status"]'));

// ───────────── Vuelta 1: lo que pidió Marcelo
await caso("noc-01 elegir MONICA CUADRA BECERRA: «Nuestro vendedor» ya dice Pepe Chuy, sin tocarlo", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  const v = await vendedor(p);
  ok("noc-01 elegir MONICA CUADRA BECERRA: «Nuestro vendedor» ya dice Pepe Chuy, sin tocarlo", v === "Pepe Chuy", `vendedor «${v}»`);
});
await caso("noc-02 elegir ISABEL DE LOS ANGELES QUIROZ: Pepe Chuy", "", async p => {
  await elegirCliente(p, "isabel", "ISABEL DE LOS ANGELES QUIROZ"); await contesto(p, "c-isabel");
  const v = await vendedor(p);
  ok("noc-02 elegir ISABEL DE LOS ANGELES QUIROZ: Pepe Chuy", v === "Pepe Chuy", `vendedor «${v}»`);
});
await caso("noc-03 MONICA y «Crear OC»: la OC sale con Pepe Chuy (lo que se le agregue lo hereda)", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  const oc = await crear(p);
  ok("noc-03 MONICA y «Crear OC»: la OC sale con Pepe Chuy (lo que se le agregue lo hereda)", oc?.vendedor === "Pepe Chuy" && oc?.client_id === "c-monica", JSON.stringify(oc));
});
await caso("noc-04 dice por qué: «Sugerido: el vendedor de MONICA CUADRA BECERRA», y que se puede cambiar", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  const t = await txt(porQue(p));
  ok("noc-04 dice por qué: «Sugerido: el vendedor de MONICA CUADRA BECERRA», y que se puede cambiar", /Sugerido/.test(t) && t.includes("MONICA CUADRA BECERRA") && /C[áa]mbialo/.test(t), `«${t}»`);
});

// ───────────── Lo que se eligió a mano manda
await caso("noc-05 eligió «Manuel» antes que el cliente: se respeta, y la OC sale con Manuel", "", async p => {
  await elegirVendedor(p, "Manuel");
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica", 1200);
  const v = await vendedor(p); const oc = await crear(p);
  ok("noc-05 eligió «Manuel» antes que el cliente: se respeta, y la OC sale con Manuel", v === "Manuel" && oc?.vendedor === "Manuel", `vendedor «${v}» · ${JSON.stringify(oc)}`);
});
await caso("noc-24 cambió a «Manuel» después de la sugerencia: se queda Manuel, sin «Sugerido», y la OC con Manuel", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  await elegirVendedor(p, "Manuel"); await espera(p, 200);
  const v = await vendedor(p), sug = await porQue(p).count(); const oc = await crear(p);
  ok("noc-24 cambió a «Manuel» después de la sugerencia: se queda Manuel, sin «Sugerido», y la OC con Manuel", v === "Manuel" && sug === 0 && oc?.vendedor === "Manuel", `vendedor «${v}» · sugerido ${sug} · ${JSON.stringify(oc)}`);
});
await caso("noc-25 cambió a «Marcelo» y luego eligió otro cliente (ISABEL): no se lo pisa", "", async p => {
  await elegirCliente(p, "hotsson", "HOTSSON"); await contesto(p, "c-hotsson");
  await elegirVendedor(p, "Marcelo");
  await elegirCliente(p, "isabel", "ISABEL DE LOS ANGELES QUIROZ"); await contesto(p, "c-isabel", 1200);
  const v = await vendedor(p);
  ok("noc-25 cambió a «Marcelo» y luego eligió otro cliente (ISABEL): no se lo pisa", v === "Marcelo", `vendedor «${v}»`);
});

// ───────────── Clientes sin vendedor, o con uno que no está en la lista
await caso("noc-06 cliente sin vendedor en su ficha: «— Sin asignar —», sin «Sugerido», y la OC sin vendedor", "", async p => {
  await elegirCliente(p, "papeleria", "PAPELERIA SIN VENDEDOR"); await contesto(p, "c-sin");
  const v = await vendedor(p), sug = await porQue(p).count(); const oc = await crear(p);
  ok("noc-06 cliente sin vendedor en su ficha: «— Sin asignar —», sin «Sugerido», y la OC sin vendedor", v === "— Sin asignar —" && sug === 0 && oc && !oc.vendedor, `vendedor «${v}» · sugerido ${sug} · ${JSON.stringify(oc)}`);
});
await caso("noc-12 el vendedor de la ficha no está en la lista (Lupita): no inventa otro", "", async p => {
  await elegirCliente(p, "rocket", "ROCKET IDEAS"); await contesto(p, "c-rocket");
  const v = await vendedor(p);
  ok("noc-12 el vendedor de la ficha no está en la lista (Lupita): no inventa otro", v === "— Sin asignar —", `vendedor «${v}»`);
});
await caso("noc-13 la ficha dice «Victor Fernandez»: Victor", "", async p => {
  await elegirCliente(p, "dumagu", "ALMACEN DE CALZADO DUMAGU"); await contesto(p, "c-dumagu");
  const v = await vendedor(p);
  ok("noc-13 la ficha dice «Victor Fernandez»: Victor", v === "Victor", `vendedor «${v}»`);
});

// ───────────── Cambiar de cliente
await caso("noc-07 MONICA y luego escribe otro nombre: el vendedor sugerido se va con ella, y se dice", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  await campoCliente(p).fill("OTRO CLIENTE NUEVO"); await espera(p, 300);
  const v = await vendedor(p), a = await aviso(p);
  ok("noc-07 MONICA y luego escribe otro nombre: el vendedor sugerido se va con ella, y se dice", v === "— Sin asignar —" && /el vendedor/.test(a) && a.includes("MONICA CUADRA BECERRA"), `vendedor «${v}» · aviso «${a}»`);
});
await caso("noc-08 MONICA y luego HOTSSON: Genaro (no se queda Pepe Chuy)", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  await elegirCliente(p, "hotsson", "HOTSSON"); await contesto(p, "c-hotsson");
  const v = await vendedor(p);
  ok("noc-08 MONICA y luego HOTSSON: Genaro (no se queda Pepe Chuy)", v === "Genaro", `vendedor «${v}»`);
});
await caso("noc-23 MONICA y luego ISABEL: Pepe Chuy, y el porqué dice ISABEL", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  await elegirCliente(p, "isabel", "ISABEL DE LOS ANGELES QUIROZ"); await contesto(p, "c-isabel");
  const v = await vendedor(p), t = await txt(porQue(p));
  ok("noc-23 MONICA y luego ISABEL: Pepe Chuy, y el porqué dice ISABEL", v === "Pepe Chuy" && t.includes("ISABEL DE LOS ANGELES QUIROZ") && !t.includes("MONICA"), `vendedor «${v}» · «${t}»`);
});

// ───────────── La base lenta o caída
await caso("noc-09 la respuesta tarda y eligió «Jaime» mientras: se queda Jaime", "lento=c-monica", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await espera(p, 200);
  await elegirVendedor(p, "Jaime");
  await contesto(p, "c-monica", 3000);
  const v = await vendedor(p);
  ok("noc-09 la respuesta tarda y eligió «Jaime» mientras: se queda Jaime", v === "Jaime", `vendedor «${v}»`);
});
await caso("noc-10 la de MONICA tarda y se cambió a uno sin vendedor: al llegar tarde no se pone", "lento=c-monica", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await espera(p, 200);
  await elegirCliente(p, "papeleria", "PAPELERIA SIN VENDEDOR");
  await contesto(p, "c-monica", 3000); await espera(p, 200);
  const v = await vendedor(p), t = await txt(porQue(p));
  ok("noc-10 la de MONICA tarda y se cambió a uno sin vendedor: al llegar tarde no se pone", v === "— Sin asignar —" && !t, `vendedor «${v}» · «${t}»`);
});
await caso("noc-11 la base no contesta el vendedor: la ventana sigue, «— Sin asignar —», y se crea la OC", "vendedor=falla", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await espera(p, 600);
  const v = await vendedor(p); const oc = await crear(p);
  ok("noc-11 la base no contesta el vendedor: la ventana sigue, «— Sin asignar —», y se crea la OC", v === "— Sin asignar —" && oc?.client_id === "c-monica", `vendedor «${v}» · ${JSON.stringify(oc)}`);
});

// ───────────── El nombre escrito, sin elegirlo del buscador
await caso("noc-14 escribió ISABEL exacto y «Crear OC» sin elegirla: la OC sale con Pepe Chuy (nadie eligió otro)", "resolve=existente", async p => {
  await campoCliente(p).fill("ISABEL DE LOS ANGELES QUIROZ"); await espera(p, 100);
  await dlg(p).locator('input[placeholder="Quién pide (ej. Eva, Jorge)"]').click();   // sale del buscador sin elegir
  const oc = await crear(p);
  ok("noc-14 escribió ISABEL exacto y «Crear OC» sin elegirla: la OC sale con Pepe Chuy (nadie eligió otro)", oc?.client_id === "c-isabel" && oc?.vendedor === "Pepe Chuy", JSON.stringify(oc));
});
await caso("noc-15 eligió «— Sin asignar —» a mano y escribió ISABEL exacto: se respeta, sin vendedor", "resolve=existente", async p => {
  await elegirVendedor(p, "Manuel"); await elegirVendedor(p, "— Sin asignar —");
  await campoCliente(p).fill("ISABEL DE LOS ANGELES QUIROZ"); await espera(p, 100);
  await dlg(p).locator('input[placeholder="Quién pide (ej. Eva, Jorge)"]').click();
  const oc = await crear(p);
  ok("noc-15 eligió «— Sin asignar —» a mano y escribió ISABEL exacto: se respeta, sin vendedor", oc?.client_id === "c-isabel" && !oc?.vendedor, JSON.stringify(oc));
});
await caso("noc-16 «¿ya existe?»: escribió «Monica Cuadra», eligió a MONICA en la pregunta: la pone con Pepe Chuy y no crea todavía", "resolve=parecido&pregunta=c-monica", async p => {
  await campoCliente(p).fill("Monica Cuadra"); await espera(p, 100);
  await dlg(p).locator('input[placeholder="Quién pide (ej. Eva, Jorge)"]').click();
  await dlg(p).getByRole("button", { name: /^Crear OC$/ }).click();
  await contesto(p, "c-monica", 3000);
  const v = await vendedor(p), creadas = (await lineas(p, "crear-oc ")).length, cli = await campoCliente(p).inputValue();
  ok("noc-16 «¿ya existe?»: escribió «Monica Cuadra», eligió a MONICA en la pregunta: la pone con Pepe Chuy y no crea todavía", v === "Pepe Chuy" && creadas === 0 && cli === "MONICA CUADRA BECERRA", `vendedor «${v}» · creadas ${creadas} · cliente «${cli}»`);
});
await caso("noc-17 cliente nuevo (se da de alta aquí): la OC sin vendedor, sin inventar uno", "resolve=nada&pregunta=new", async p => {
  await campoCliente(p).fill("CLIENTE QUE NO EXISTE SA"); await espera(p, 100);
  await dlg(p).locator('input[placeholder="Quién pide (ej. Eva, Jorge)"]').click();
  await dlg(p).locator('input[placeholder="XAXX010101000"]').fill("CQN010101AB1");   // una razón social nueva pide su RFC
  const oc = await crear(p);
  ok("noc-17 cliente nuevo (se da de alta aquí): la OC sin vendedor, sin inventar uno", oc?.client_id === "c-nuevo" && !oc?.vendedor, JSON.stringify(oc));
});

// ───────────── Doble clic, Esc, las dos pantallas y los nombres raros
await caso("noc-18 doble clic en «Crear OC»: una sola OC", "crear=lento", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  await dlg(p).getByRole("button", { name: /^Crear OC$/ }).dblclick(); await espera(p, 1500);
  const n = (await lineas(p, "crear-oc ")).length;
  ok("noc-18 doble clic en «Crear OC»: una sola OC", n === 1, `${n} OC creadas`);
});
await caso("noc-19 Esc con el cliente elegido: pregunta antes de cerrar (no se pierde)", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  // (con el cursor en un campo de texto el Esc es de su lista de sugerencias, a propósito desde v10.84.106: primero se sale del campo)
  await dlg(p).locator("h2").click(); await p.keyboard.press("Escape"); await espera(p, 300);
  const pregunta = await p.getByText("¿Cerrar sin crear la OC?").count(), cerrada = (await lineas(p, "cerrar")).length;
  ok("noc-19 Esc con el cliente elegido: pregunta antes de cerrar (no se pierde)", pregunta === 1 && cerrada === 0, `pregunta ${pregunta} · cerrada ${cerrada}`);
});
await caso("noc-20 en el monitor (1920): MONICA con Pepe Chuy y el porqué se ve entero", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  const v = await vendedor(p), t = await txt(porQue(p));
  const caja = await porQue(p).boundingBox().catch(() => null), ventana = await dlg(p).boundingBox().catch(() => null);
  const dentro = !!caja && !!ventana && caja.x >= ventana.x - 1 && caja.x + caja.width <= ventana.x + ventana.width + 1;
  ok("noc-20 en el monitor (1920): MONICA con Pepe Chuy y el porqué se ve entero", v === "Pepe Chuy" && t.includes("MONICA CUADRA BECERRA") && dentro, `vendedor «${v}» · «${t}» · dentro ${dentro}`);
}, { width: 1920, height: 1080 });
await caso("noc-21 acentos, eñes y guiones (JOSÉ MARÍA PEÑA-GUTIÉRREZ ÑÚÑEZ): Christian Diaz, con su nombre completo en el porqué", "", async p => {
  await elegirCliente(p, "peña", "JOSÉ MARÍA PEÑA-GUTIÉRREZ ÑÚÑEZ"); await contesto(p, "c-acentos");
  const v = await vendedor(p), t = await txt(porQue(p));
  ok("noc-21 acentos, eñes y guiones (JOSÉ MARÍA PEÑA-GUTIÉRREZ ÑÚÑEZ): Christian Diaz, con su nombre completo en el porqué", v === "Christian Diaz" && t.includes("JOSÉ MARÍA PEÑA-GUTIÉRREZ ÑÚÑEZ"), `vendedor «${v}» · «${t}»`);
});
await caso("noc-22 un nombre larguísimo: Jaime, y el porqué no ensancha la ventana (1366)", "", async p => {
  await elegirCliente(p, "distribuidora", "DISTRIBUIDORA INTERNACIONAL"); await contesto(p, "c-largo");
  const v = await vendedor(p), t = await txt(porQue(p));
  const desborda = await dlg(p).evaluate(d => d.scrollWidth > d.clientWidth + 1).catch(() => true);
  const pagina = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok("noc-22 un nombre larguísimo: Jaime, y el porqué no ensancha la ventana (1366)", v === "Jaime" && /Sugerido/.test(t) && !desborda && !pagina, `vendedor «${v}» · desborda ${desborda} · página ${pagina} · «${t.slice(0, 80)}»`);
});

// ───────────── Vuelta 2: por donde no se diseñó
await caso("noc-26 elegir con el teclado (↓ y Enter en el buscador): también propone Pepe Chuy", "", async p => {
  await campoCliente(p).fill("monica");
  await p.getByRole("option", { name: /MONICA CUADRA BECERRA/ }).first().waitFor({ timeout: 6000 });
  await campoCliente(p).press("ArrowDown"); await campoCliente(p).press("Enter"); await contesto(p, "c-monica");
  const v = await vendedor(p);
  ok("noc-26 elegir con el teclado (↓ y Enter en el buscador): también propone Pepe Chuy", v === "Pepe Chuy", `vendedor «${v}»`);
});
await caso("noc-27 la base no contesta: lo dice («No se pudo leer el vendedor…»), y al elegir uno a mano el aviso se va y la OC sale con él", "vendedor=falla", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await espera(p, 600);
  const antes = await txt(dlg(p).getByText(/No se pudo leer el vendedor/));
  await elegirVendedor(p, "Genaro"); await espera(p, 200);
  const despues = await dlg(p).getByText(/No se pudo leer el vendedor/).count(); const oc = await crear(p);
  ok("noc-27 la base no contesta: lo dice («No se pudo leer el vendedor…»), y al elegir uno a mano el aviso se va y la OC sale con él",
    antes.includes("MONICA CUADRA BECERRA") && despues === 0 && oc?.vendedor === "Genaro", `antes «${antes}» · después ${despues} · ${JSON.stringify(oc)}`);
});
await caso("noc-28 MONICA y luego borra el cliente entero: el vendedor sugerido se va, y se dice", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  await campoCliente(p).fill(""); await espera(p, 300);
  const v = await vendedor(p), a = await aviso(p), sug = await porQue(p).count();
  ok("noc-28 MONICA y luego borra el cliente entero: el vendedor sugerido se va, y se dice", v === "— Sin asignar —" && /el vendedor/.test(a) && sug === 0, `vendedor «${v}» · aviso «${a}» · sugerido ${sug}`);
});
await caso("noc-29 «Crear OC» mientras la respuesta todavía viene: la OC sale con Pepe Chuy, una sola", "lento=c-monica", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await espera(p, 150);
  const oc = await crear(p); await espera(p, 1800);
  const n = (await lineas(p, "crear-oc ")).length;
  ok("noc-29 «Crear OC» mientras la respuesta todavía viene: la OC sale con Pepe Chuy, una sola", oc?.vendedor === "Pepe Chuy" && n === 1, `${JSON.stringify(oc)} · ${n} OC`);
});
await caso("noc-30 MONICA con Pepe Chuy y la regresa a «— Sin asignar —» a mano: se respeta (la OC sin vendedor)", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  await elegirVendedor(p, "— Sin asignar —"); await espera(p, 200);
  const sug = await porQue(p).count(); const oc = await crear(p);
  ok("noc-30 MONICA con Pepe Chuy y la regresa a «— Sin asignar —» a mano: se respeta (la OC sin vendedor)", oc?.client_id === "c-monica" && !oc?.vendedor && sug === 0, `${JSON.stringify(oc)} · sugerido ${sug}`);
});
await caso("noc-31 ISABEL escrita exacta con OTRO RFC: la pone con su RFC y con Pepe Chuy, y no crea todavía", "resolve=existente", async p => {
  await campoCliente(p).fill("ISABEL DE LOS ANGELES QUIROZ"); await espera(p, 100);
  await dlg(p).locator('input[placeholder="XAXX010101000"]').fill("XAXX010101000");
  await dlg(p).getByRole("button", { name: /^Crear OC$/ }).click(); await contesto(p, "c-isabel", 3000);
  const v = await vendedor(p), creadas = (await lineas(p, "crear-oc ")).length, a = await aviso(p);
  ok("noc-31 ISABEL escrita exacta con OTRO RFC: la pone con su RFC y con Pepe Chuy, y no crea todavía", v === "Pepe Chuy" && creadas === 0 && a.includes("QUMI830801TN1"), `vendedor «${v}» · creadas ${creadas} · aviso «${a.slice(0, 120)}»`);
});
await caso("noc-32 MONICA (Pepe Chuy) y luego ROCKET (su vendedor no está en la lista): no se queda Pepe Chuy", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  await elegirCliente(p, "rocket", "ROCKET IDEAS"); await contesto(p, "c-rocket");
  const v = await vendedor(p), sug = await porQue(p).count();
  ok("noc-32 MONICA (Pepe Chuy) y luego ROCKET (su vendedor no está en la lista): no se queda Pepe Chuy", v === "— Sin asignar —" && sug === 0, `vendedor «${v}» · sugerido ${sug}`);
});
await caso("noc-33 la de MONICA tarda y escribe otro nombre mientras: al llegar no se pone, y no dice que quitó un vendedor", "lento=c-monica", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await espera(p, 150);
  await campoCliente(p).fill("OTRO CLIENTE"); await contesto(p, "c-monica", 3000); await espera(p, 200);
  const v = await vendedor(p), a = await aviso(p), sug = await porQue(p).count();
  ok("noc-33 la de MONICA tarda y escribe otro nombre mientras: al llegar no se pone, y no dice que quitó un vendedor", v === "— Sin asignar —" && !/el vendedor/.test(a) && sug === 0, `vendedor «${v}» · aviso «${a}» · sugerido ${sug}`);
});
await caso("noc-34 doble clic en «Crear OC» con el nombre escrito (busca el vendedor de la ficha antes de crear): una sola OC, con Pepe Chuy", "resolve=existente&crear=lento", async p => {
  await campoCliente(p).fill("ISABEL DE LOS ANGELES QUIROZ"); await espera(p, 100);
  await dlg(p).locator('input[placeholder="Quién pide (ej. Eva, Jorge)"]').click();
  await dlg(p).getByRole("button", { name: /^Crear OC$/ }).dblclick(); await espera(p, 2500);
  const ls = await lineas(p, "crear-oc "); const oc = ls.length ? JSON.parse(ls[0].slice("crear-oc ".length)) : null;
  ok("noc-34 doble clic en «Crear OC» con el nombre escrito (busca el vendedor de la ficha antes de crear): una sola OC, con Pepe Chuy", ls.length === 1 && oc?.vendedor === "Pepe Chuy", `${ls.length} OC · ${JSON.stringify(oc)}`);
});
await caso("noc-35 «Nuestro vendedor» tiene su etiqueta, y el porqué va ligado al campo (lector de pantalla)", "", async p => {
  await elegirCliente(p, "monica", "MONICA CUADRA BECERRA"); await contesto(p, "c-monica");
  const porEtiqueta = await dlg(p).getByLabel("Nuestro vendedor").evaluate(s => s.tagName).catch(() => "");
  const ligado = await dlg(p).getByLabel("Nuestro vendedor").evaluate(s => { const id = s.getAttribute("aria-describedby"); return id ? (document.getElementById(id)?.textContent || "") : ""; }).catch(() => "");
  ok("noc-35 «Nuestro vendedor» tiene su etiqueta, y el porqué va ligado al campo (lector de pantalla)", porEtiqueta === "SELECT" && /Sugerido/.test(ligado), `etiqueta→${porEtiqueta} · ligado «${ligado}»`);
});

await browser.close();
for (const r of res) console.log(r);
const fallas = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\n${res.length - fallas} de ${res.length} pasan`);
process.exit(fallas ? 1 : 0);
