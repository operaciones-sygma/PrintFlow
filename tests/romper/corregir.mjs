// Tratar de ROMPER «Corregir precio» contra la base (v10.84.112), sin navegador: src/lib/corregirPrecio.js con una base de mentira que contesta
// como PostgREST (también cuando falla, cuando el permiso filtra el renglón sin error y cuando la orden cambió mientras se corregía), y la regla
// de quién y qué se corrige (`puedeCorregirPrecio`) y las palabras de los errores (`errorEnPalabras`) sacadas de src/App.jsx tal cual.
// Cada caso afirma lo que DEBERÍA pasar: para Karla, P-0600 de PRIME PET ($40,000 → $60,500). Uso: node tests/romper/corregir.mjs · SOLO=<regex>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { corregirPrecioEnLaBase } from "../../src/lib/corregirPrecio.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP = fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8").replace(/\r\n/g, "\n").split("\n");
// una declaración de App.jsx, hasta el renglón que la cierra con «;»
const decl = nombre => { const i = APP.findIndex(l => l.startsWith("const " + nombre + " ") || l.startsWith("const " + nombre + "="));
  if (i < 0) throw new Error("no encuentro " + nombre + " en App.jsx"); let e = i; while (!/;\s*$/.test(APP[e])) e++; return APP.slice(i, e + 1).join("\n"); };
const { puedeCorregirPrecio, errorEnPalabras, fmt } = new Function([decl("fmt"), decl("liquidadaConSaldoAFavor"), decl("puedeCorregirPrecio"), decl("errorEnPalabras"),
  "return { puedeCorregirPrecio, errorEnPalabras, fmt };"].join("\n"))();

const res = [];
const ok = (n, c, x = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + String(x).replace(/\s+/g, " ").slice(0, 240) : "")); };

// P-0600 como la tiene la base el 15-oct (OC-0920, en Salidas, sin folio, sin partes ni plan)
const P0600 = { id: "OP-MUX1KUOQWVU", production_number: "P-0600", client: "PRIME PET", quantity: 32000, price: 40000, maq_price: null, order_type: "interna",
  stage: "salidas", invoice_folio: null, grouped_invoice_folio: null, credit_applied_at: null, invoice_reason: null, oc_invoice_group_id: null,
  has_splits: false, has_matrix_lines: false, fiscal_desconocido: false };
const QUIEN = { last_edited_by: "karla", last_edited_by_uid: "uid-de-karla", last_edited_at: "2026-10-15T17:00:00.000Z" };

// la base de mentira: from/select/eq/is/update/maybeSingle como supabase-js, y lo que contesta, por caso
function base(cfg = {}) {
  const fila = { ...P0600, ...(cfg.fila || {}) };
  const llamadas = [];
  const conteos = { order_invoice_splits: cfg.partes || 0, oc_invoice_split_lines: cfg.lineas || 0 };
  const from = tabla => {
    const q = { tabla, op: "select", filtros: [], cols: null, cambios: null };
    const contestar = () => {
      llamadas.push({ ...q, filtros: [...q.filtros] });
      if (q.op === "update") {
        if (cfg.fallaGuardar) return { data: null, error: { message: cfg.fallaGuardar, code: "42501" } };
        if (cfg.filtra) return { data: q.cols ? [] : null, error: null };   // el permiso filtra el renglón: 0 renglones y SIN error
        Object.assign(fila, q.cambios);
        return { data: q.cols ? [Object.fromEntries(q.cols.split(",").map(c => [c, fila[c]]))] : null, error: null };
      }
      if (tabla === "orders") {
        if (cfg.fallaLeer) return { data: null, error: { message: "TypeError: Failed to fetch" } };
        if (cfg.noEsta) return { data: null, error: null };
        return { data: { ...fila }, error: null };
      }
      if (cfg.fallaContar === tabla) return { data: null, count: null, error: { message: "upstream request timeout" } };
      return { data: null, count: conteos[tabla], error: null };
    };
    const b = {
      select(cols) { q.cols = cols; return b; },
      eq(c, v) { q.filtros.push(c + "=" + v); return b; },
      is(c, v) { q.filtros.push(c + " is " + v); return b; },
      update(c) { q.op = "update"; q.cambios = c; return b; },
      maybeSingle() { return Promise.resolve(contestar()); },
      then(bien, mal) { return Promise.resolve(contestar()).then(bien, mal); },
    };
    return b;
  };
  return { supabase: { from }, llamadas, fila };
}
const updates = b => b.llamadas.filter(l => l.op === "update");
// el historial de la orden (order_timeline): lo que se anotó, o que la base no lo aceptó
let notas = [], fallaNota = false;
const anotar = async texto => { if (fallaNota) throw new Error("insert into order_timeline: upstream timeout"); notas.push(texto); };
const corregir = (b, { orden = P0600, nuevo = 60500, rol = "karla", motivo = "Se capturó mal: el cliente aceptó $60,500" } = {}) => { notas = [];
  return corregirPrecioEnLaBase({ supabase: b.supabase, orden, nuevo, motivo, anotar, puede: vivo => puedeCorregirPrecio(vivo, rol), enPalabras: errorEnPalabras, quien: QUIEN, formato: fmt }); };

try {
  // 1. lo normal: P-0600 a $60,500, en su columna, sobre esa orden y nada más
  let b = base(); let r = await corregir(b);
  let u = updates(b);
  ok("cor-01 P-0600 de $40,000 a $60,500: guarda el precio en su columna (price), sólo en esa orden, y dice de cuánto a cuánto",
    !r.error && u.length === 1 && u[0].tabla === "orders" && u[0].cambios.price === 60500 && !("maq_price" in u[0].cambios) && u[0].filtros.join() === "id=OP-MUX1KUOQWVU"
    && b.fila.price === 60500 && r.antes === 40000, JSON.stringify({ r, u }));
  // 2. quién: el historial de la base (order_change_log) atribuye por last_edited_*; sin ellos el cambio de precio sale como «sistema»
  ok("cor-02 la base sabe QUIÉN cambió el precio (last_edited_by, _uid y _at, como la forma de la orden): su historial no dice «sistema»",
    u.length === 1 && u[0].cambios.last_edited_by === "karla" && u[0].cambios.last_edited_by_uid === "uid-de-karla" && !!u[0].cambios.last_edited_at, JSON.stringify(u[0]?.cambios));
  // 3. la pantalla iba atrás ($39,000) y la base tiene $40,000: el «de cuánto» es el de la base
  b = base(); r = await corregir(b, { orden: { ...P0600, price: 39000 } });
  ok("cor-03 si la pantalla iba atrás, el historial dice el precio que la base tenía ($40,000), no el de la pantalla", !r.error && r.antes === 40000, JSON.stringify(r));
  // 4. maquila: el precio al cliente es maq_price; price no se toca
  b = base({ fila: { order_type: "maquila", price: 9000, maq_price: 12000 } }); r = await corregir(b, { orden: { ...P0600, order_type: "maquila", price: 9000, maq_price: 12000 }, nuevo: 15000 });
  u = updates(b);
  ok("cor-04 una maquila: guarda maq_price (el precio al cliente) y no toca price", !r.error && u.length === 1 && u[0].cambios.maq_price === 15000 && !("price" in u[0].cambios)
    && b.fila.price === 9000 && r.antes === 12000 && r.isMaq === true, JSON.stringify({ r, u }));
  // 5-6. sin leer la orden no se cambia nada
  b = base({ fallaLeer: true }); r = await corregir(b);
  ok("cor-05 si no se pudo leer la orden (red), no cambia nada y lo dice en palabras", !!r.error && /No se pudo leer/.test(r.error) && /sin conexión/.test(r.error) && !updates(b).length, r.error);
  b = base({ noEsta: true }); r = await corregir(b);
  ok("cor-06 si la orden ya no está, no cambia nada y dice ESO (no «la base no lo aceptó»)", !!r.error && /ya no está/.test(r.error) && !updates(b).length, r.error);
  // 7-9. el dato cambió con la ventana abierta
  b = base({ fila: { invoice_folio: "F-181" } }); r = await corregir(b);
  ok("cor-07 si mientras corregía la orden recibió folio (F-181), no cambia el precio y lo dice", !!r.error && /ya tiene folio/.test(r.error) && !updates(b).length, r.error);
  b = base({ fila: { stage: "delivered" } }); r = await corregir(b);
  ok("cor-08 si mientras corregía se entregó, tampoco", !!r.error && !updates(b).length, r.error);
  b = base({ fila: { credit_applied_at: "2026-10-15T16:00:00Z" } }); r = await corregir(b);
  ok("cor-09 si mientras corregía se liquidó con saldo a favor, tampoco (cambiaría el saldo del cliente)", !!r.error && !updates(b).length, r.error);
  // 10-12. partes y plan matriz: la base los cuenta (no son columnas)
  b = base({ partes: 1 }); r = await corregir(b);
  ok("cor-10 si ya va por partes (una parte viva en la base), no cambia el precio", !!r.error && /por partes/.test(r.error) && !updates(b).length, r.error);
  b = base({ lineas: 2 }); r = await corregir(b);
  ok("cor-11 si está en el plan matriz de su OC, tampoco", !!r.error && /plan matriz/.test(r.error) && !updates(b).length, r.error);
  b = base({ fallaContar: "oc_invoice_split_lines" }); r = await corregir(b);
  ok("cor-12 si no se pudo revisar el plan matriz, frena (una lectura que falla no es permiso)", !!r.error && /No se pudo revisar/.test(r.error) && !updates(b).length, r.error);
  // 13-14. lo que la base contesta al guardar
  b = base({ fallaGuardar: "permission denied for table orders" }); r = await corregir(b);
  ok("cor-13 si la base rechaza el cambio, lo dice en palabras («no tienes permiso») y que no se cambió", !!r.error && /no tienes permiso/.test(r.error) && /no se cambió/.test(r.error), r.error);
  b = base({ filtra: true }); r = await corregir(b);
  ok("cor-14 si el permiso filtra el renglón (0 renglones y SIN error), NO dice que se corrigió", !!r.error && b.fila.price === 40000, JSON.stringify(r));
  // 15. alguien ya lo puso en ese precio mientras tanto
  b = base({ fila: { price: 60500 } }); r = await corregir(b);
  ok("cor-15 si la base ya tiene $60,500 (alguien lo corrigió mientras tanto), no escribe ni anota «$60,500 → $60,500»", !!r.error && /60,500\.00/.test(r.error) && !updates(b).length, JSON.stringify(r));
  // 16. a quien no le toca
  b = base(); r = await corregir(b, { rol: "vendedor" });
  ok("cor-16 el vendedor no corrige precios (aunque llegue a la función), sin decirle que «mientras corregías cambió»", !!r.error && !/Mientras corregías/.test(r.error) && !updates(b).length, r.error);
  // 17. un precio que no es precio no llega a la base
  const malos = [0, -500, NaN, Infinity];
  const tocadas = [];
  for (const n of malos) { b = base(); r = await corregir(b, { nuevo: n }); tocadas.push(!!r.error && b.llamadas.length === 0); }
  ok("cor-17 un precio de 0, negativo o que no es número no llega a la base (ni la lee)", tocadas.every(Boolean), JSON.stringify(tocadas));
  // 18. centavos: lo que se guarda es a 2 decimales
  b = base(); r = await corregir(b, { nuevo: 60500.005 });
  u = updates(b);
  ok("cor-18 un precio con más de 2 decimales se guarda redondeado a centavos", !r.error && u.length === 1 && [60500, 60500.01].includes(u[0].cambios.price), JSON.stringify(u[0]?.cambios));
  // 19-21. el porqué en el historial de la orden
  b = base(); r = await corregir(b);
  ok("cor-19 el historial de la orden dice de cuánto a cuánto y por qué: «💰 Precio corregido: $40,000.00 → $60,500.00 sin IVA · Se capturó mal…»",
    !r.error && notas.length === 1 && notas[0].startsWith("💰 Precio corregido: $40,000.00 → $60,500.00 sin IVA · Se capturó mal") && r.anotado === true, JSON.stringify({ notas, anotado: r.anotado }));
  fallaNota = true; b = base(); r = await corregir(b); fallaNota = false;
  ok("cor-20 si la base guarda el precio pero no su línea del historial, el precio SÍ cambió y lo dice (anotado: no) para que se anote a mano",
    !r.error && b.fila.price === 60500 && r.anotado === false, JSON.stringify(r));
  const sinNota = [];
  for (const cfg of [{ fallaGuardar: "permission denied" }, { filtra: true }, { fila: { invoice_folio: "F-181" } }, { partes: 1 }]) { b = base(cfg); r = await corregir(b); sinNota.push(!!r.error && notas.length === 0); }
  ok("cor-21 cuando el precio NO cambió (rechazo, renglón filtrado, ya foliada, por partes), el historial no anota nada", sinNota.every(Boolean), JSON.stringify(sinNota));
} catch (e) {
  ok("cor-00 la prueba corrió sin tronar", false, e?.stack || e?.message || String(e));
}
for (const x of res) console.log(x);
const fallan = res.filter(x => x.startsWith("FALLA")).length;
console.log(`\ncorregir: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
