// Tratar de ROMPER «Corregir precio» contra la base (v10.84.112), sin navegador: src/lib/corregirPrecio.js con una base de mentira que contesta
// como PostgREST (también cuando falla, cuando el permiso filtra el renglón sin error y cuando la orden cambió mientras se corregía), y la regla
// de quién y qué se corrige (`puedeCorregirPrecio`) y las palabras de los errores (`errorEnPalabras`) sacadas de src/App.jsx tal cual.
// Y «Reimprimir» en Salidas (cor-22 a cor-25): diagnoseOrder y el despertador de Gerardo, sacados VIVOS de App.jsx con extraer.mjs.
// Cada caso afirma lo que DEBERÍA pasar: para Karla, P-0600 de PRIME PET ($40,000 → $60,500). Uso: node tests/romper/corregir.mjs · SOLO=<regex>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as lib from "../../src/lib/corregirPrecio.js";
const { corregirPrecioEnLaBase } = lib;
// v10.84.115 — lo nuevo del módulo (si el módulo de antes no lo trae, sus casos fallan en vez de tronar la tanda)
const enHorarioDeAvisos = lib.enHorarioDeAvisos || (() => { throw new Error("el módulo no trae enHorarioDeAvisos"); });
const capturarPrecioEnLaBase = lib.capturarPrecioEnLaBase || (async () => ({ error: "el módulo no trae capturarPrecioEnLaBase" }));
import { extraer } from "../banco/extraer.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP = fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8").replace(/\r\n/g, "\n").split("\n");
// una declaración de App.jsx, hasta el renglón que la cierra con «;»
const decl = nombre => { const i = APP.findIndex(l => l.startsWith("const " + nombre + " ") || l.startsWith("const " + nombre + "="));
  if (i < 0) throw new Error("no encuentro " + nombre + " en App.jsx"); let e = i; while (!/;\s*$/.test(APP[e])) e++; return APP.slice(i, e + 1).join("\n"); };
const { puedeCorregirPrecio, errorEnPalabras, fmt } = new Function([decl("fmt"), decl("liquidadaConSaldoAFavor"), decl("puedeCorregirPrecio"), decl("errorEnPalabras"),
  "return { puedeCorregirPrecio, errorEnPalabras, fmt };"].join("\n"))();

// «Reimprimir» (cor-22 a cor-25): diagnoseOrder y el despertador VIVOS, con sus dependencias (extraer.mjs), en Node
const { codigo: codDiag } = extraer(fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8"), ["diagnoseOrder", "getWakeupItems"], { simulados: ["supabase"] });
const tmpDiag = path.join(os.tmpdir(), "pf-corregir-diag-" + process.pid + ".mjs");
fs.writeFileSync(tmpDiag, [...new Set(codDiag.match(/\b[A-Z][A-Za-z0-9]*Icon\b/g) || [])].map(i => `const ${i} = () => null;`).join("\n")
  + "\nconst supabase = {};\n" + codDiag + "\nexport { diagnoseOrder, getWakeupItems };\n");
const { diagnoseOrder, getWakeupItems } = await import(pathToFileURL(tmpDiag).href);
fs.rmSync(tmpDiag, { force: true });

const res = [];
const ok = (n, c, x = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + String(x).replace(/\s+/g, " ").slice(0, 240) : "")); };

// P-0600 como la tiene la base el 15-oct (OC-0920, en Salidas, sin folio, sin partes ni plan)
const P0600 = { id: "OP-MUX1KUOQWVU", production_number: "P-0600", client: "PRIME PET", quantity: 32000, price: 40000, maq_price: null, order_type: "interna",
  stage: "salidas", invoice_folio: null, grouped_invoice_folio: null, credit_applied_at: null, invoice_reason: null, oc_invoice_group_id: null,
  has_splits: false, has_matrix_lines: false, fiscal_desconocido: false, created_by: "secretaria", source: "internal", return_covered_by_folio: null };
const QUIEN = { last_edited_by: "karla", last_edited_by_uid: "uid-de-karla", last_edited_at: "2026-10-15T17:00:00.000Z" };

// la base de mentira: from/select/eq/is/update/maybeSingle como supabase-js, y lo que contesta, por caso
function base(cfg = {}) {
  const fila = { ...P0600, ...(cfg.fila || {}) };
  const llamadas = [];
  const conteos = { order_invoice_splits: cfg.partes || 0, oc_invoice_split_lines: cfg.lineas || 0 };
  // (v10.84.115) las condiciones del UPDATE se evalúan contra la orden, como PostgREST: si alguna no se cumple, 0 renglones y sin error
  const cumple = f => { const v = fila[f.col];
    if (f.op === "eq") return v != null && String(Number(v)) === String(Number(f.val)) || String(v) === String(f.val);
    if (f.op === "is") return f.val === null ? v == null : v === f.val;
    if (f.op === "notin") return !f.val.includes(String(v));
    if (f.op === "or") return f.val.some(cumple);
    return true; };
  const from = tabla => {
    const q = { tabla, op: "select", filtros: [], conds: [], cols: null, cambios: null };
    const contestar = () => {
      llamadas.push({ ...q, filtros: [...q.filtros] });
      if (q.op === "update") {
        if (cfg.cambiaAntesDeEscribir) Object.assign(fila, cfg.cambiaAntesDeEscribir);   // alguien más la movió entre la lectura y la escritura
        if (cfg.fallaGuardar) return { data: null, error: { message: cfg.fallaGuardar, code: "42501" } };
        if (cfg.filtra) return { data: q.cols ? [] : null, error: null };   // el permiso filtra el renglón: 0 renglones y SIN error
        if (!q.conds.every(cumple)) return { data: q.cols ? [] : null, error: null };
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
      eq(c, v) { q.filtros.push(c + "=" + v); if (c !== "id") q.conds.push({ op: "eq", col: c, val: v }); return b; },
      is(c, v) { q.filtros.push(c + " is " + v); q.conds.push({ op: "is", col: c, val: v }); return b; },
      not(c, op, v) { q.filtros.push(c + " not " + op + " " + v); if (op === "in") q.conds.push({ op: "notin", col: c, val: String(v).replace(/[()]/g, "").split(",") }); return b; },
      or(expr) { q.filtros.push("or " + expr); q.conds.push({ op: "or", val: String(expr).split(",").map(s => { const [col, op, ...r] = s.split("."); const val = r.join(".");
        return op === "is" ? { op: "is", col, val: val === "null" ? null : val } : { op: "eq", col, val }; }) }); return b; },
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
let notas = [], fallaNota = false, avisos = [], fallaAviso = false, ahora = new Date("2026-10-15T17:00:00Z");   // jueves 11:00 en México
const anotar = async texto => { if (fallaNota) throw new Error("insert into order_timeline: upstream timeout"); notas.push(texto); };
let conMotivoAparte = 0;   // (cor-38) avisos que además traen el porqué aparte (la bandeja lo pintaría dos veces: en el mensaje y como «Motivo:»)
const avisar = async (destino, mensaje, ...resto) => { if (fallaAviso) throw new Error("insert into notifications: upstream timeout"); if (resto.length && resto[0] != null) conMotivoAparte++;
  avisos.push(destino + " | " + mensaje); };
const corregir = (b, { orden = P0600, nuevo = 60500, rol = "karla", motivo = "Se capturó mal: el cliente aceptó $60,500" } = {}) => { notas = []; avisos = [];
  return corregirPrecioEnLaBase({ supabase: b.supabase, orden, nuevo, motivo, anotar, avisar, rol, usuario: rol, ahora: () => ahora,
    puede: vivo => puedeCorregirPrecio(vivo, rol), enPalabras: errorEnPalabras, quien: QUIEN, formato: fmt }); };

try {
  // 1. lo normal: P-0600 a $60,500, en su columna, sobre esa orden y nada más
  let b = base(); let r = await corregir(b);
  let u = updates(b);
  ok("cor-01 P-0600 de $40,000 a $60,500: guarda el precio en su columna (price), sólo en esa orden, y dice de cuánto a cuánto",
    // (v10.84.115: el UPDATE lleva además sus condiciones —cor-29—; antes la prueba pedía que llevara sólo el id: supuesto de la prueba)
    !r.error && u.length === 1 && u[0].tabla === "orders" && u[0].cambios.price === 60500 && !("maq_price" in u[0].cambios)
    && u[0].filtros.filter(f => f.startsWith("id=")).join() === "id=OP-MUX1KUOQWVU" && b.fila.price === 60500 && r.antes === 40000, JSON.stringify({ r, u }));
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
  // 22-25. «Reimprimir» es para producción (CobranzaFlow, 15-oct, sólo lectura): con la hoja ya impresa, cambiar el precio (también con «Corregir
  //   precio») hace que la base marque needs_reprint (auto_detect_post_print_edit). En Salidas y en la maquila recibida producción ya terminó: la
  //   marca se queda como dato, pero no se le pide a Gerardo ni tapa el «Sin folio» de Karla. En producción se sigue pidiendo.
  const hace = d => new Date(Date.now() - d * 86400000).toISOString();
  const impresa = { ...P0600, price: 60500, print_version: 1, needs_reprint: true, timeline: [{ to: "salidas", date: hace(10) }], created_at: hace(20), due_date: null };
  let dg = diagnoseOrder(impresa);
  ok("cor-22 P-0600 en Salidas, impresa y con el precio corregido: no le pide a Gerardo «REIMPRIMIR» y sale lo de Karla («Sin folio»)",
    dg?.key === "no_folio" && dg?.respRole === "karla", JSON.stringify(dg));
  dg = diagnoseOrder({ ...impresa, stage: "maq_received", order_type: "maquila", maq_price: 15000, maq_cost: 9000, timeline: [{ to: "maq_received", date: hace(10) }] });
  ok("cor-23 una maquila ya recibida, con la marca: tampoco «REIMPRIMIR»", !!dg && dg.key !== "reprint", JSON.stringify(dg));
  dg = diagnoseOrder({ ...impresa, stage: "packaging", timeline: [{ to: "packaging", date: hace(1) }] });
  ok("cor-24 en producción (Empaque) la hoja sí importa: «REIMPRIMIR» a Gerardo, en rojo, como siempre", dg?.key === "reprint" && dg?.respRole === "produccion" && dg?.sev === "red", JSON.stringify(dg));
  const desp = getWakeupItems("produccion", "gerardo", [impresa, { ...impresa, id: "OP-2", production_number: "P-0601", stage: "packaging", timeline: [{ to: "packaging", date: hace(1) }] }]);
  const pns = (desp || []).map(x => x.o?.production_number);
  ok("cor-25 el despertador de Gerardo trae P-0601 (en Empaque, por reimprimir) y no P-0600 (en Salidas)", pns.includes("P-0601") && !pns.includes("P-0600"), JSON.stringify(pns));
  // ── v10.84.115 — la revisión de CobranzaFlow y lo que decidió Marcelo (15-oct) ──
  // 26-29. el UPDATE con las mismas condiciones con que se revisó: si entre leer y escribir cambió, no escribe
  b = base({ cambiaAntesDeEscribir: { invoice_folio: "F-182" } }); r = await corregir(b);
  ok("cor-26 si entre leer y escribir le asignaron folio (F-182), no escribe el precio, lo dice y no anota ni avisa",
    !!r.error && /Mientras corregías/.test(r.error) && b.fila.price === 40000 && notas.length === 0 && avisos.length === 0, JSON.stringify({ r, notas, avisos }));
  b = base({ cambiaAntesDeEscribir: { price: 45000 } }); r = await corregir(b);
  ok("cor-27 si entre leer y escribir alguien más le cambió el precio ($45,000), no lo pisa", !!r.error && b.fila.price === 45000 && notas.length === 0, JSON.stringify({ r, precio: b.fila.price }));
  b = base({ cambiaAntesDeEscribir: { stage: "delivered" } }); r = await corregir(b);
  ok("cor-28 si entre leer y escribir se entregó, no escribe", !!r.error && b.fila.price === 40000, JSON.stringify(r));
  b = base(); r = await corregir(b); u = updates(b);
  ok("cor-29 el UPDATE lleva sus condiciones: sin folio ni agrupada ni grupo de OC ni saldo aplicado, no entregada ni cancelada, y el precio que se leyó",
    !r.error && u.length === 1 && ["invoice_folio is null", "grouped_invoice_folio is null", "oc_invoice_group_id is null", "credit_applied_at is null", "price=40000"].every(f => u[0].filtros.includes(f))
    && u[0].filtros.some(f => /^stage not in .*delivered.*cancelled/.test(f)), JSON.stringify(u[0]?.filtros));
  // 30-33. los avisos (Marcelo: a Dirección y a quien capturó la orden, con el antes, el después sin IVA y el porqué)
  ok("cor-30 avisa a Dirección y a quien capturó P-0600 (Lupita), no a Karla, con el antes, el después sin IVA y el porqué",
    avisos.length === 2 && avisos.some(a => a.startsWith("admin | ")) && avisos.some(a => a.startsWith("secretaria | ")) && !avisos.some(a => a.startsWith("karla | "))
    && avisos.every(a => /P-0600/.test(a) && /\$40,000\.00/.test(a) && /\$60,500\.00/.test(a) && /sin IVA/.test(a) && /Se capturó mal/.test(a)), JSON.stringify(avisos));
  b = base({ fila: { created_by: "karla" } }); r = await corregir(b, { orden: { ...P0600, created_by: "karla" } });
  ok("cor-31 si la capturó la misma Karla, sólo a Dirección (nadie se avisa a sí mismo)", !r.error && avisos.length === 1 && avisos[0].startsWith("admin | "), JSON.stringify(avisos));
  fallaAviso = true; b = base(); r = await corregir(b); fallaAviso = false;
  ok("cor-32 si el aviso no se pudo mandar, el precio sí quedó y lo dice (avisado: no)", !r.error && b.fila.price === 60500 && r.avisado === false, JSON.stringify(r));
  const horas = [["2026-10-15T17:00:00Z", true, "jueves 11:00"], ["2026-10-15T14:59:00Z", false, "jueves 8:59"], ["2026-10-15T15:00:00Z", true, "jueves 9:00"],
    ["2026-10-16T00:59:00Z", true, "jueves 18:59"], ["2026-10-16T01:00:00Z", false, "jueves 19:00"], ["2026-10-17T18:00:00Z", false, "sábado 12:00"], ["2026-10-18T18:00:00Z", false, "domingo 12:00"]];
  let malHora = [];
  try { for (const [iso, esperado, nombre] of horas) if (enHorarioDeAvisos(new Date(iso)) !== esperado) malHora.push(nombre); } catch (e) { malHora.push(e.message); }
  ok("cor-33 el horario de los avisos es el de la base (lunes a viernes, 9:00 a 18:59 de México): fuera de él se dice al guardar", malHora.length === 0, JSON.stringify(malHora));
  ahora = new Date("2026-10-17T18:00:00Z"); b = base(); r = await corregir(b); ahora = new Date("2026-10-15T17:00:00Z");
  ok("cor-34 un sábado el precio se corrige y el resultado dice que es fuera de horario (a Dirección no le llega: queda en el historial)", !r.error && r.fueraDeHorario === true, JSON.stringify(r));
  // 35-36. lo que no se corrige aquí (CobranzaFlow): el pedido web (su precio es el de la tienda) y el re-trabajo cubierto (la base le exige 0)
  b = base({ fila: { source: "web" } }); r = await corregir(b, { orden: { ...P0600, source: "web" } });
  ok("cor-35 un pedido web no se corrige aquí", !!r.error && updates(b).length === 0, r.error);
  b = base({ fila: { return_covered_by_folio: "F-120" } }); r = await corregir(b, { orden: { ...P0600, return_covered_by_folio: "F-120" } });
  ok("cor-36 un re-trabajo cubierto por su folio no se corrige aquí (la base le exige precio 0)", !!r.error && updates(b).length === 0, r.error);
  conMotivoAparte = 0; b = base(); r = await corregir(b);
  ok("cor-38 el porqué va UNA vez en el aviso (en el mensaje; nada aparte que la bandeja pinte otra vez como «Motivo:»)",
    !r.error && avisos.length === 2 && conMotivoAparte === 0 && avisos.every(a => a.split("Se capturó mal").length === 2), JSON.stringify({ conMotivoAparte, avisos }));
  b = base(); r = await corregir(b, { motivo: "ya está" });
  ok("cor-37 el porqué de menos de 8 letras (sin los espacios de las orillas) no llega a la base", !!r.error && b.llamadas.length === 0, JSON.stringify(r));
  // cap-01 a cap-04: «Capturar precio» (la orden sin precio al asignar folio) dice quién, sólo si sigue sin precio ni folio, y confirma
  b = base({ fila: { price: null } }); r = await capturarPrecioEnLaBase({ supabase: b.supabase, orden: { ...P0600, price: null }, nuevo: 60500, quien: QUIEN });
  u = updates(b);
  ok("cap-01 «Capturar precio» guarda con quién (el historial de la base no dice «sistema») y confirma", !r.error && b.fila.price === 60500 && u.length === 1 && u[0].cambios.last_edited_by === "karla", JSON.stringify({ r, u }));
  b = base({ fila: { price: null }, cambiaAntesDeEscribir: { price: 52000 } }); r = await capturarPrecioEnLaBase({ supabase: b.supabase, orden: { ...P0600, price: null }, nuevo: 60500, quien: QUIEN });
  ok("cap-02 si mientras tanto alguien ya le puso precio ($52,000), no lo pisa y lo dice", !!r.error && b.fila.price === 52000, JSON.stringify(r));
  b = base({ fila: { price: null }, cambiaAntesDeEscribir: { invoice_folio: "F-183" } }); r = await capturarPrecioEnLaBase({ supabase: b.supabase, orden: { ...P0600, price: null }, nuevo: 60500, quien: QUIEN });
  ok("cap-03 si mientras tanto le asignaron folio, tampoco", !!r.error && b.fila.price == null, JSON.stringify(r));
  b = base({ fila: { order_type: "maquila", price: 9000, maq_price: 0 } }); r = await capturarPrecioEnLaBase({ supabase: b.supabase, orden: { ...P0600, order_type: "maquila", price: 9000, maq_price: 0 }, nuevo: 15000, quien: QUIEN });
  ok("cap-04 una maquila: captura maq_price (en 0) y no toca price", !r.error && b.fila.maq_price === 15000 && b.fila.price === 9000, JSON.stringify({ r, fila: { price: b.fila.price, maq: b.fila.maq_price } }));
} catch (e) {
  ok("cor-00 la prueba corrió sin tronar", false, e?.stack || e?.message || String(e));
}
for (const x of res) console.log(x);
const fallan = res.filter(x => x.startsWith("FALLA")).length;
console.log(`\ncorregir: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
