// Tratar de ROMPER «¿ya existe este cliente?» al capturar una orden o una OC (v10.84.69, con CobranzaFlow v3.7.999m). Marcelo, 8-oct:
// «sólo cuidar que no cree clientes duplicados con los ya existentes»; y si casi seguro ya existe, «lo frena y dice cuál es». De los 89
// clientes que PrintFlow dio de alta, 36 terminaron fusionados por duplicados. Cada caso afirma lo que DEBERÍA pasar: una FALLA es un bug.
// Uso: node cliente.mjs <dir-capturas> [puerto=5192]   ·   SOLO=<regex> corre sólo los casos que coinciden
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.argv[2] || "."; const PORT = Number(process.argv[3] || 5192);
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
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  try {
    page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(30000);
    await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
    await page.waitForSelector("#guardar");
    await fn(page);
  } catch (e) { ok(nombre + " (la prueba se cayó)", false, e.message.split("\n")[0]); }
  if (errs.length) ok(nombre + " · errores de consola", false, errs.join(" ; ").slice(0, 300));
  await page.close();
}
const log = async p => (await p.textContent("#log")) || "";
const lineas = async (p, pref) => (await log(p)).split("\n").filter(l => l.startsWith(pref));
const espera = (p, ms = 250) => p.waitForTimeout(ms);
const dlg = p => p.locator('[role="dialog"]');
const txt = async loc => ((await loc.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
const botonNuevo = p => dlg(p).getByRole("button", { name: /como nuevo|crear cliente nuevo/i });
// «Guardar» en la forma, y lo que pase: la pregunta, o el resultado sin pregunta
async function guardar(p) {
  await p.click("#guardar");
  for (let i = 0; i < 40; i++) {
    await espera(p, 100);
    if (await dlg(p).count()) { await espera(p, 200); return "pregunta"; }
    const l = await log(p);
    if (/resultado:|toast:/.test(l)) return "sin pregunta";
  }
  return "nada";
}
const resultado = async p => { const l = (await lineas(p, "resultado:")).pop(); return l ? JSON.parse(l.slice(10)) : null; };
const llamadas = async (p, fn) => (await lineas(p, "rpc:" + fn + " ")).map(l => JSON.parse(l.slice(("rpc:" + fn + " ").length)));

// ───────────── Lo que casi seguro ya existe: lo frena y dice cuál es
await caso("cli-01 «Grupo Modelo»: dice que ya existe, cuál y por qué, sin «Crear como nuevo»; elegirlo lo liga", "resolve=fuerte", async p => {
  await guardar(p);
  const t = await txt(dlg(p));
  const nuevo = await botonNuevo(p).count();
  await dlg(p).getByRole("button", { name: /CERVECERIA MODELO DE MEXICO/ }).click(); await espera(p, 400);
  const r = await resultado(p);
  ok("cli-01 «Grupo Modelo»: dice que ya existe, cuál y por qué, sin «Crear como nuevo»; elegirlo lo liga",
    /Ya existe/.test(t) && t.includes("CERVECERIA MODELO DE MEXICO") && /se juntó con éste/.test(t) && nuevo === 0 && r?.tipo === "elegido" && r?.id === "c-modelo" && !(await llamadas(p, "create_client_from_printflow")).length,
    `crear nuevo ${nuevo} · ${JSON.stringify(r)} · «${t.slice(0, 220)}»`);
});
await caso("cli-10 lo seguro primero, con su porqué, y sin «Crear como nuevo» aunque también haya parecidos", "resolve=mixto", async p => {
  await guardar(p);
  const opciones = await dlg(p).getByRole("button").allInnerTexts();
  const primero = opciones.findIndex(o => o.includes("CERVECERIA MODELO")), segundo = opciones.findIndex(o => o.includes("PAPELERIA DEL BAJIO"));
  const t = await txt(dlg(p));
  ok("cli-10 lo seguro primero, con su porqué, y sin «Crear como nuevo» aunque también haya parecidos",
    primero >= 0 && segundo >= 0 && primero < segundo && /así le dicen en la casa/.test(t) && (await botonNuevo(p).count()) === 0, `orden ${primero}/${segundo} · «${t.slice(0, 200)}»`);
});
await caso("cli-03 el que ya existe dado de baja: lo dice, a quién pedírselo, y no deja crearlo", "resolve=baja", async p => {
  const que = await guardar(p);
  const t = await txt(dlg(p));
  const nuevo = await botonNuevo(p).count();
  if (que === "pregunta") { await dlg(p).getByRole("button", { name: "Cancelar" }).click(); await espera(p, 300); }
  const r = await resultado(p);
  ok("cli-03 el que ya existe dado de baja: lo dice, a quién pedírselo, y no deja crearlo",
    que === "pregunta" && t.includes("TEST CLIENTE") && /dado de baja/.test(t) && /Karla/.test(t) && nuevo === 0 && r?.tipo === "cancelado" && !(await llamadas(p, "create_client_from_printflow")).length,
    `${que} · crear nuevo ${nuevo} · ${JSON.stringify(r)} · «${t.slice(0, 200)}»`);
});

// ───────────── Lo que sólo se parece: pregunta, y deja crear
await caso("cli-02 lo que sólo se parece: «¿Quisiste decir…?» con su porqué, y «Crear como nuevo» lo crea sin días de crédito", "resolve=parecido", async p => {
  await guardar(p);
  const t = await txt(dlg(p));
  await botonNuevo(p).click(); await espera(p, 500);
  const c = (await llamadas(p, "create_client_from_printflow"))[0] || {};
  const r = await resultado(p);
  ok("cli-02 lo que sólo se parece: «¿Quisiste decir…?» con su porqué, y «Crear como nuevo» lo crea sin días de crédito",
    /Quisiste decir/.test(t) && /se parece/.test(t) && c.p_name === "Grupo Modelo" && c.p_dias_credito === 0 && r?.tipo === "nuevo", `${JSON.stringify(c)} · ${JSON.stringify(r)}`);
});
await caso("cli-07 la base de antes (sin porqué ni «fuerte») sigue funcionando como siempre", "resolve=viejo", async p => {
  await guardar(p);
  const t = await txt(dlg(p));
  const nuevo = await botonNuevo(p).count();
  ok("cli-07 la base de antes (sin porqué ni «fuerte») sigue funcionando como siempre", /Quisiste decir/.test(t) && t.includes("PAPELERIA DEL BAJIO") && nuevo === 1, `crear nuevo ${nuevo} · «${t.slice(0, 160)}»`);
});
await caso("cli-09 el nombre idéntico se liga solo, sin preguntar", "resolve=exacto", async p => {
  const que = await guardar(p);
  const r = await resultado(p);
  ok("cli-09 el nombre idéntico se liga solo, sin preguntar", que === "sin pregunta" && r?.tipo === "existente" && r?.id === "c-modelo", `${que} · ${JSON.stringify(r)}`);
});

// ───────────── Cliente nuevo: la pregunta enseña lo que se va a crear
await caso("cli-04 «Crear cliente nuevo» enseña el RFC y el contacto que se capturaron (no «sin RFC»)", "resolve=nada&rfc=ABC010101AB1&correo=compras@papeleria.mx", async p => {
  await guardar(p);
  const t = await txt(dlg(p));
  ok("cli-04 «Crear cliente nuevo» enseña el RFC y el contacto que se capturaron (no «sin RFC»)", t.includes("ABC010101AB1") && t.includes("compras@papeleria.mx") && !/sin RFC|sin contacto/.test(t), `«${t.slice(0, 260)}»`);
});
await caso("cli-08 con RFC, la base lo busca también por RFC; sin RFC, se pregunta como siempre (sólo el nombre)", "resolve=nada&rfc=ABC010101AB1", async p => {
  await guardar(p);
  const con = (await llamadas(p, "resolve_client_for_order"))[0] || {};
  await p.goto(`http://127.0.0.1:${PORT}/?resolve=nada`); await p.waitForSelector("#guardar");
  await guardar(p);
  const sin = (await llamadas(p, "resolve_client_for_order"))[0] || {};
  ok("cli-08 con RFC, la base lo busca también por RFC; sin RFC, se pregunta como siempre (sólo el nombre)",
    con.p_rfc === "ABC010101AB1" && sin.p_name === "Grupo Modelo" && !("p_rfc" in sin), `con ${JSON.stringify(con)} · sin ${JSON.stringify(sin)}`);
});

// ───────────── Lo que contesta la base
await caso("cli-06 si la base lo frena al crearlo, el aviso dice cuál existe, sin «Error resolviendo»", "resolve=parecido&crear=frena", async p => {
  await guardar(p);
  await botonNuevo(p).click(); await espera(p, 500);
  const t = (await lineas(p, "toast:")).pop() || "";
  ok("cli-06 si la base lo frena al crearlo, el aviso dice cuál existe, sin «Error resolviendo»", /^toast:Ya existe «CERVECERIA MODELO DE MEXICO»/.test(t) && !/Error resolviendo/.test(t), t.slice(0, 200));
});
await caso("cli-18 si la base dice que está dado de baja, el aviso lo dice tal cual", "resolve=nada&crear=baja", async p => {
  await guardar(p);
  await botonNuevo(p).click(); await espera(p, 500);
  const t = (await lineas(p, "toast:")).pop() || "";
  ok("cli-18 si la base dice que está dado de baja, el aviso lo dice tal cual", /dado de baja/.test(t) && /Karla/.test(t) && !/Error resolviendo/.test(t), t.slice(0, 200));
});
await caso("cli-17 sin conexión con la base: lo dice en español y que la orden no se guardó", "resolve=falla", async p => {
  await guardar(p);
  const t = (await lineas(p, "toast:")).pop() || "";
  ok("cli-17 sin conexión con la base: lo dice en español y que la orden no se guardó", /no se guardó/i.test(t) && !/upstream/i.test(t), t.slice(0, 200));
});

// ───────────── La OC: el RFC es obligatorio para una razón social nueva
await caso("cli-16 en la OC, sin RFC no se crea una razón social nueva (sin parecidos y después de «Crear como nuevo»)", "oc=1&resolve=nada", async p => {
  const que = await guardar(p);
  const r1 = await resultado(p);
  await p.goto(`http://127.0.0.1:${PORT}/?oc=1&resolve=parecido`); await p.waitForSelector("#guardar");
  await guardar(p);
  await botonNuevo(p).click(); await espera(p, 400);
  const r2 = await resultado(p);
  ok("cli-16 en la OC, sin RFC no se crea una razón social nueva (sin parecidos y después de «Crear como nuevo»)",
    que === "sin pregunta" && r1?.tipo === "falta_rfc" && r2?.tipo === "falta_rfc" && !(await llamadas(p, "create_client_from_printflow")).length, `${que} · ${JSON.stringify(r1)} · ${JSON.stringify(r2)}`);
});

// ───────────── El teclado, el clic fuera y el doble clic
await caso("cli-05 Escape con la pregunta abierta cierra SÓLO la pregunta: la forma de la orden (con lo capturado) se queda", "resolve=fuerte", async p => {
  await guardar(p);
  await p.keyboard.press("Escape"); await espera(p, 400);
  const sigue = await dlg(p).count();
  const forma = await p.locator("#forma").count();
  const cerro = (await lineas(p, "forma:cerrada")).length;
  const r = await resultado(p);
  ok("cli-05 Escape con la pregunta abierta cierra SÓLO la pregunta: la forma de la orden (con lo capturado) se queda",
    sigue === 0 && forma === 1 && cerro === 0 && r?.tipo === "cancelado", `pregunta ${sigue} · forma ${forma} · forma cerrada ${cerro} · ${JSON.stringify(r)}`);
});
await caso("cli-12 al abrirse la pregunta, el foco está en ella", "resolve=fuerte", async p => {
  await guardar(p);
  const dentro = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  ok("cli-12 al abrirse la pregunta, el foco está en ella", dentro);
});
await caso("cli-11 Tab no se sale de la pregunta", "resolve=mixto", async p => {
  await guardar(p);
  let fuera = 0;
  for (let i = 0; i < 10; i++) { await p.keyboard.press("Tab"); await espera(p, 60); if (!(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) fuera++; }
  ok("cli-11 Tab no se sale de la pregunta", fuera === 0, `${fuera} de 10 fuera`);
});
await caso("cli-13 el clic fuera cancela la pregunta y la forma se queda", "resolve=parecido", async p => {
  await guardar(p);
  await p.mouse.click(6, 760); await espera(p, 400);
  const r = await resultado(p);
  ok("cli-13 el clic fuera cancela la pregunta y la forma se queda", (await dlg(p).count()) === 0 && (await p.locator("#forma").count()) === 1 && r?.tipo === "cancelado", JSON.stringify(r));
});
await caso("cli-14 el doble clic al elegir un cliente lo liga UNA vez", "resolve=parecido", async p => {
  await guardar(p);
  await dlg(p).getByRole("button", { name: /PAPELERIA DEL BAJIO/ }).dblclick(); await espera(p, 600);
  const n = (await lineas(p, "resuelto:")).length, m = (await lineas(p, "resultado:")).length;
  ok("cli-14 el doble clic al elegir un cliente lo liga UNA vez", n === 1 && m === 1 && (await p.locator("#forma").count()) === 1, `resuelto ${n} · resultado ${m}`);
});
await caso("cli-19 el doble clic en «Crear como nuevo» crea UNO", "resolve=parecido", async p => {
  await guardar(p);
  await botonNuevo(p).dblclick(); await espera(p, 800);
  const n = (await llamadas(p, "create_client_from_printflow")).length;
  ok("cli-19 el doble clic en «Crear como nuevo» crea UNO", n === 1, `creados ${n}`);
});

// ───────────── Las dos pantallas de Marcelo, con nombres larguísimos
for (const [ancho, alto] of [[1366, 768], [1920, 1080]]) {
  await caso(`cli-15 a ${ancho}: «Ya existe» con un nombre larguísimo se lee completo, sin salirse`, "resolve=mixto&largo=1", async p => {
    await guardar(p);
    const panel = dlg(p);
    const m = await panel.evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, r: el.getBoundingClientRect().toJSON() }));
    const t = await txt(panel);
    await p.screenshot({ path: `${OUT}/cli-15-${ancho}.png` });
    ok(`cli-15 a ${ancho}: «Ya existe» con un nombre larguísimo se lee completo, sin salirse`,
      m.sw <= m.cw + 1 && m.r.x >= 0 && m.r.right <= ancho && t.includes("SUCURSAL BAJIO CENTRO NORTE GUANAJUATO"), JSON.stringify(m));
  }, { width: ancho, height: alto });
}

// ───────────── Vuelta 3: por donde no se diseñó
await caso("cli-20 Enter con la pregunta abierta no crea ni liga nada", "resolve=parecido", async p => {
  await guardar(p);
  await p.keyboard.press("Enter"); await espera(p, 500);
  const resp = (await lineas(p, "resuelto:")).length;
  ok("cli-20 Enter con la pregunta abierta no crea ni liga nada", resp === 0 && (await dlg(p).count()) === 1 && !(await llamadas(p, "create_client_from_printflow")).length, `respuestas ${resp}`);
});
await caso("cli-23 Escape con el foco en una opción cancela la pregunta, sin cerrar la forma", "resolve=parecido", async p => {
  await guardar(p);
  await p.keyboard.press("Tab"); await espera(p, 100);
  const enOpcion = await p.evaluate(() => document.activeElement?.tagName === "BUTTON" && !!document.activeElement.closest('[role="dialog"]'));
  await p.keyboard.press("Escape"); await espera(p, 400);
  const r = await resultado(p);
  ok("cli-23 Escape con el foco en una opción cancela la pregunta, sin cerrar la forma", enOpcion && (await dlg(p).count()) === 0 && (await p.locator("#forma").count()) === 1 && r?.tipo === "cancelado", `en opción ${enOpcion} · ${JSON.stringify(r)}`);
});
await caso("cli-21 con muchos parecidos en la laptop, la pregunta cabe en la pantalla y «Cancelar» se alcanza", "resolve=muchos", async p => {
  await guardar(p);
  const r = await dlg(p).evaluate(el => el.getBoundingClientRect().toJSON());
  const t = await txt(dlg(p));
  await dlg(p).getByRole("button", { name: "Cancelar" }).click(); await espera(p, 300);
  const res2 = await resultado(p);
  await p.screenshot({ path: `${OUT}/cli-21-muchos.png` });
  ok("cli-21 con muchos parecidos en la laptop, la pregunta cabe en la pantalla y «Cancelar» se alcanza",
    r.top >= 0 && r.bottom <= 768 && /Ya existe/.test(t) && t.includes("TEST CLIENTE DOS") && (await botonNuevo(p).count()) === 0 && res2?.tipo === "cancelado", `${JSON.stringify(r)} · ${JSON.stringify(res2)}`);
});
await caso("cli-22 en el celular la pregunta se lee sin barra horizontal y con sus botones a la vista", "resolve=mixto&largo=1", async p => {
  await guardar(p);
  const m = await p.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: innerWidth }));
  const panel = await dlg(p).evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, r: el.getBoundingClientRect().toJSON() }));
  const cancelar = await dlg(p).getByRole("button", { name: "Cancelar" }).isVisible();
  ok("cli-22 en el celular la pregunta se lee sin barra horizontal y con sus botones a la vista", m.doc <= m.vw && panel.sw <= panel.cw + 1 && panel.r.right <= 390 && cancelar, `${JSON.stringify(m)} · ${JSON.stringify(panel)}`);
}, { width: 390, height: 844 });

await browser.close();
for (const r of res) console.log(r);
const fallas = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\n${res.length - fallas} de ${res.length} pasan`);
process.exit(fallas ? 1 : 0);
