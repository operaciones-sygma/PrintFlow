// LAS VENTANAS DE LAS ACCIONES, ENCIMA DEL DETALLE (v10.84.53). Abre el detalle de una orden real, dispara una acción que abre
// su ventana (asignar folio, regresar, cancelar orden, poner en espera), la cierra con Esc y comprueba que el detalle siga
// abierto con el foco adentro. Con las ventanas REALES de la app: el banco del detalle las simula, y esta prueba encontró lo
// que el banco no veía (dos ventanas que no toman el foco lo perdían al cerrarse; ahora det-137 lo cuida en el banco).
//
// Uso:  npm run build && node tests/recorrido/ventanas-encima.mjs            (sirve dist/ en 127.0.0.1:4273)
//       node tests/recorrido/ventanas-encima.mjs https://produccion.sygma.mx (la app publicada)
// Sólo lee: la cuenta claude-pruebas, las escrituras cortadas en el navegador (como el recorrido) y nada se confirma; el rol se
// cambia en el navegador. Las órdenes son reales (P-0589 en Salidas, P-0599 en CTP, del 6-oct): si ya cambiaron de etapa, el
// caso dice «no está» y se salta; para otras, PF_VENTANAS="karla:P-0001,admin:P-0002,admin:P-0003,admin:P-0003".
// Sale con 1 si el detalle se cierra, si la ventana no queda encima o si el foco se pierde.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(RAIZ, "tests/salida/ventanas"); fs.mkdirSync(OUT, { recursive: true });
const CRED = JSON.parse(fs.readFileSync(process.env.PF_CREDENCIAL || "C:/Users/padil/claude-navegador/credencial-printflow.json", "utf8"));
const LECTURAS = new Set(["client_credit_balance", "get_app_config", "get_client_aliases", "get_client_billing_info",
  "get_client_seller_label", "get_folio_emitter_enabled", "get_last_contact_for_client", "get_pantone_by_code", "get_user_session",
  "list_anticipo_clients", "list_consecutive_cobranza_folios", "list_corona_oc_invoices", "list_linkable_invoices_for_oc",
  "list_linkable_invoices_for_order", "list_linkable_invoices_for_split", "list_stock_clients", "load_credit_ledger",
  "oc_shared_folio_is_cancelled", "ordenes_saldo_consumido", "order_folio_is_cancelled", "pf_archivos_del_bucket", "resolve_client_for_order",
  "search_clients_typeahead", "search_pantone", "sugerencia_folios", "validate_production_number"]);
const ACCIONES = [
  { como: "boton", nombre: /Asignar Folio y Entregar/ },
  { como: "mas", nombre: /Regresar a etapa anterior/ },
  { como: "mas", nombre: /Cancelar orden/ },
  { como: "mas", nombre: /Poner en espera/ },
];
const ORDENES = (process.env.PF_VENTANAS || "karla:P-0589,admin:P-0599,admin:P-0589,admin:P-0589").split(",").map(x => x.split(":"));
let base = process.argv[2], servidor = null;
if (!base) { const { preview } = await import("vite"); servidor = await preview({ root: RAIZ, logLevel: "error", preview: { host: "127.0.0.1", port: 4273, strictPort: true } }); base = "http://127.0.0.1:4273/"; }
let nav; try { nav = await chromium.launch({ headless: true }); } catch { nav = await chromium.launch({ headless: true, channel: "chrome" }); }
const malos = [], cortes = [];
try {
  for (let i = 0; i < ACCIONES.length; i++) {
    const c = ACCIONES[i], [rol, pn] = ORDENES[i] || [];
    const ctx = await nav.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: false });
    await ctx.addInitScript(() => { window.print = () => {}; window.open = () => null; });
    await ctx.route("**/*", async route => {
      const req = route.request(), url = req.url(), m = req.method();
      if (!/\.supabase\.co\//.test(url)) return route.continue();
      const ruta = url.replace(/^https:\/\/[^/]+/, "").replace(/\?.*$/, "");
      if (m === "GET" || m === "HEAD" || m === "OPTIONS" || ruta === "/auth/v1/token") return route.continue();
      if (ruta === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" });
      if (ruta.startsWith("/storage/v1/object/sign/") || ruta.startsWith("/storage/v1/object/list/")) return route.continue();
      const rpc = (/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(ruta) || [])[1];
      if (rpc && LECTURAS.has(rpc)) {
        if (rpc === "get_user_session") { const resp = await route.fetch(); let j = await resp.json().catch(() => null); if (Array.isArray(j) && j[0]) j = [{ ...j[0], role: rol }]; return route.fulfill({ response: resp, json: j }); }
        return route.continue();
      }
      if (rpc !== "log_wakeup_ack") cortes.push(m + " " + ruta);
      return route.fulfill({ status: 418, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "solo lectura" }) });
    });
    const p = await ctx.newPage(); p.setDefaultTimeout(15000);
    const errs = []; p.on("pageerror", e => errs.push(e.message));
    const etiqueta = rol + " " + pn + " · " + c.nombre.source;
    try {
      await p.goto(base, { timeout: 60000 });
      await p.getByText("Sistema de Producción").first().waitFor({ timeout: 20000 });
      await p.getByPlaceholder(/gerardo/).fill(CRED.username);
      await p.locator('input[type="password"]').fill(CRED.password);
      await p.getByRole("button", { name: "Entrar" }).click();
      await p.getByText("Operación", { exact: true }).first().waitFor({ timeout: 30000 });
      await p.waitForTimeout(2500);
      const campo = p.getByPlaceholder(/Escribe aquí/);
      if (await campo.count() && await p.getByText(/escribe SI ENTIENDO/i).count()) { await campo.first().fill("SI ENTIENDO"); await p.waitForTimeout(800); }
      for (let k = 0; k < 2; k++) { await p.keyboard.press("Escape"); await p.waitForTimeout(200); }
      const b = await p.evaluateHandle(() => [...document.querySelectorAll("button[title]")].find(x => x.getAttribute("title").replace(/\s*\(\d+\)\s*$/, "").trim() === "Todas") || null);
      if (b.asElement()) { await b.asElement().click(); await p.waitForTimeout(3500); }
      const t = p.locator(`[role="button"][aria-label^="Orden ${pn},"], [role="button"][aria-label^="Orden ${pn} "]`).first();
      if (!(await t.count())) { console.log("SALTA " + etiqueta + ": no está en «Todas»"); await ctx.close(); continue; }
      await t.scrollIntoViewIfNeeded(); await t.focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(2000);
      const det = p.locator('[role="dialog"][aria-label^="Detalle de orden"]');
      if (c.como === "mas") { await det.getByRole("button", { name: /Más acciones/ }).click(); await p.waitForTimeout(400); const it = p.getByRole("menuitem", { name: c.nombre }); if (!(await it.count())) { console.log("SALTA " + etiqueta + ": no está en «Más» (la orden cambió)"); await ctx.close(); continue; } await it.click(); }
      else { const bt = det.getByRole("button", { name: c.nombre }); if (!(await bt.count())) { console.log("SALTA " + etiqueta + ": no tiene ese botón (la orden cambió)"); await ctx.close(); continue; } await bt.click(); }
      await p.waitForTimeout(1200);
      const capas = () => p.evaluate(() => [...document.querySelectorAll("body *")].filter(e => getComputedStyle(e).position === "fixed" && Number(getComputedStyle(e).zIndex) > 998 && e.offsetWidth > 300).length);
      const al = { detalle: await det.count(), ventana: await capas() };
      await p.screenshot({ path: path.join(OUT, (rol + "-" + pn + "-" + c.nombre.source).replace(/[^a-z0-9-]/gi, "") + ".png") });
      await p.keyboard.press("Escape"); await p.waitForTimeout(700);
      const desp = await p.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-label^="Detalle de orden"]'); const a = document.activeElement;
        return { detalle: !!d, dentro: !!(d && a && d.contains(a)), tag: a?.tagName || "?", quien: a?.getAttribute("aria-label") || a?.textContent?.trim().slice(0, 28) || a?.tagName }; });
      const ventanaDespues = await capas();
      // Esc no cierra una ventana mientras se escribe en uno de sus campos (a propósito: no se pierde lo escrito)
      const escribiendo = ventanaDespues > 0 && /^(TEXTAREA|INPUT|SELECT)$/.test(desp.tag);
      const bien = al.detalle === 1 && al.ventana >= 1 && desp.detalle && (escribiendo || (ventanaDespues === 0 && desp.dentro)) && !errs.length;
      console.log((bien ? "BIEN  " : "MAL   ") + etiqueta + ": al abrir, detalle " + (al.detalle ? "sí" : "NO") + " y ventana encima " + al.ventana +
        "; con Esc, detalle " + (desp.detalle ? "sigue" : "SE CERRÓ") + ", " + (escribiendo ? "la ventana sigue (el foco está en su campo, a propósito)" : "ventana " + ventanaDespues + ", foco " + (desp.dentro ? "en " + desp.quien : "FUERA (" + desp.tag + ")")) + (errs.length ? " · ERRORES: " + errs.join(" | ") : ""));
      if (!bien) malos.push(etiqueta);
    } catch (e) { console.log("MAL   " + etiqueta + ": la prueba se cayó: " + e.message.split("\n")[0]); malos.push(etiqueta); }
    await ctx.close();
  }
  console.log("escrituras cortadas (aparte del aviso de entrada): " + (cortes.join(", ") || "ninguna"));
} finally { await nav.close(); if (servidor) await servidor.close(); }
process.exitCode = malos.length ? 1 : 0;
