// Volver a medir la fecha de entrega estándar (v10.84.192, para ISO 9001: «análisis de datos»). SÓLO LEE: la base de producción por la API de administración de Supabase
// con `read_only: true`. Mide lo mismo que se midió el 8-nov y el 26-nov para decidir la regla de src/lib/fechaEstandar.js:
//   - la vara de «a tiempo» de la app (App.jsx, listaEn/entregadaATiempo): el día que la orden quedó LISTA (su última llegada a Salidas o a «Recibida de maquila»);
//   - días hábiles con los festivos de ley de la app (esFestivo), contados como fechaEstandar: el n-ésimo hábil después del día de captura, hasta las 23:59;
//   - órdenes de la planta capturadas en la forma (interna, source internal, vivas); fuera las que no pasaron por Salidas en la bitácora (las H- importadas) y las de «Entrega lejana».
// Dice, para la regla que tiene la app hoy y para «8 fijos»: cuántas habrían llegado tarde y cuántos días se prometen en promedio, por tiraje, categoría y tamaño de la OC; y
// cuántas de las fechas pedidas a mano se cumplieron según a cuántos días se pidieron (lo que dice el aviso de fecha corta: A_TIEMPO_SEGUN_LO_PEDIDO).
// Uso: node scripts/medir-fecha-estandar.mjs [desde=2026-06-01] [hasta=hace 14 días]   (necesita SUPABASE_ACCESS_TOKEN en el ambiente; no se imprime)
process.env.TZ = "America/Mexico_City";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { esFestivo } = await import(pathToFileURL(path.join(RAIZ, "src", "lib", "tiempoPorEtapa.js")).href);
const FE = await import(pathToFileURL(path.join(RAIZ, "src", "lib", "fechaEstandar.js")).href);
if (!process.env.SUPABASE_ACCESS_TOKEN) { console.error("medir-fecha-estandar: falta SUPABASE_ACCESS_TOKEN en el ambiente (el token de la API de administración de Supabase)."); process.exit(2); }
const arg = (i, def) => /^\d{4}-\d{2}-\d{2}$/.test(process.argv[i] || "") ? process.argv[i] : def;
const hace14 = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
const DESDE = arg(2, "2026-06-01"), HASTA = arg(3, hace14);
const q = async sql => { const r = await fetch("https://api.supabase.com/v1/projects/uvhardaeooaxjrrgdjwa/database/query", { method: "POST", headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql, read_only: true }) }); if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 300)); return r.json(); };
const F = `o.created_at >= date '${DESDE}' - interval '2 months' and o.order_type in ('interna','maquila') and coalesce(o.source,'') not in ('stock','web')`;
const ordenes = await q(`select o.id, o.production_number pn, o.order_type, o.source, o.stage, o.created_at, o.delivered_at, o.cancelled_at, o.due_date, o.delivery_calculated_at, o.quantity, o.categoria, o.purchase_order_id from public.orders o where ${F}`);
const eventos = await q(`select t.order_id, t.to_stage, t.created_at from public.order_timeline t join public.orders o on o.id = t.order_id where ${F} and t.to_stage in ('salidas','maq_received')`);
const lejanas = new Set((await q(`select distinct order_id from public.order_timeline where action ilike '%entrega lejana%'`)).map(r => r.order_id));
const AHORA = Date.now();
const porOrden = new Map(); for (const e of eventos) { if (!porOrden.has(e.order_id)) porOrden.set(e.order_id, []); porOrden.get(e.order_id).push(Date.parse(e.created_at)); }
const lista = o => { const ent = o.delivered_at ? Date.parse(o.delivered_at) : null; let m = null; for (const x of porOrden.get(o.id) || []) if ((ent === null || x <= ent) && (m === null || x > m)) m = x; return m; };
const dia = ms => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const habil = d => { const w = d.getDay(); return w !== 0 && w !== 6 && !esFestivo(d); };
const necesarios = (c, r) => { const a = dia(c), b = dia(r); if (b <= a) return 0; let n = 0; const d = new Date(a); while (d < b) { d.setDate(d.getDate() + 1); if (habil(d)) n++; } if (!habil(b)) n++; return n; };
const vivas = ordenes.filter(o => !o.cancelled_at && !/cancelled/.test(o.stage || ""));
const porOC = new Map(); for (const o of vivas.slice().sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) { const k = o.purchase_order_id || o.id; if (!porOC.has(k)) porOC.set(k, []); porOC.get(k).push(o); }
for (const l of porOC.values()) l.forEach((o, i) => { o.posOC = i + 1; o.tamOC = l.length; });
const d0 = Date.parse(DESDE + "T00:00:00-06:00"), d1 = Date.parse(HASTA + "T00:00:00-06:00") + 864e5;
const P = [];
for (const o of vivas) {
  o.c = Date.parse(o.created_at); if (o.order_type !== "interna" || o.source !== "internal" || o.c < d0 || o.c >= d1 || lejanas.has(o.id)) continue;
  o.r = lista(o); const abierta = o.r === null && !/delivered/.test(o.stage || ""); if (o.r === null && !abierta) continue;   // entregada sin su paso por Salidas: no se sabe cuándo quedó lista
  o.dreq = abierta ? necesarios(o.c, AHORA) + 1 : necesarios(o.c, o.r); o.abierta = abierta; o.q = Number(o.quantity) || 0;
  o.pedida = o.due_date && !o.delivery_calculated_at ? FE.habilesHasta(new Date(o.c), String(o.due_date).slice(0, 10)) : null;
  P.push(o);
}
const APP = o => FE.diasEstandar({ piezas: o.q, productos: FE.RECORRE_LA_OC ? o.tamOC : o.posOC, categoria: o.categoria }).dias, OCHO = () => FE.DIAS_ESTANDAR;
const pct = x => (100 * x).toFixed(0) + "%", tarde = (f, r) => f.length ? f.filter(o => r(o) < o.dreq).length / f.length : 0, prom = (f, r) => (f.reduce((s, o) => s + r(o), 0) / (f.length || 1)).toFixed(1);
const pad = (s, n) => String(s).padEnd(n), padl = (s, n) => String(s).padStart(n);
const L = [`Fecha estándar, medida del ${DESDE} al ${HASTA} (capturadas): ${P.length} órdenes de la planta (${P.filter(o => o.abierta).length} todavía sin quedar listas: cuentan como tarde para lo que ya pasó).`,
  `«Tarde» = quedó LISTA después de la fecha que daría la regla. La regla de la app: ${FE.DIAS_ESTANDAR} días hábiles, +${FE.DIAS_POR_TIRAJE} arriba de ${FE.TIRAJE_LARGO.toLocaleString("en-US")} piezas, +${FE.DIAS_POR_PRODUCTOS} en OC de ${FE.PRODUCTOS_DE_OC_GRANDE} productos o más${FE.RECORRE_LA_OC ? " (toda la OC)" : " (del 5.º en adelante)"}${FE.ENCUADERNADOS ? `, +${FE.DIAS_POR_ENCUADERNADO} a ${FE.ENCUADERNADOS.join(", ")}` : ""}.`,
  "", pad("grupo", 32) + padl("órdenes", 8) + padl("tarde app", 11) + padl("tarde 8", 9) + padl("promete", 9)];
const fila = (n, f) => { if (f.length) L.push(pad(n, 32) + padl(f.length, 8) + padl(pct(tarde(f, APP)), 11) + padl(pct(tarde(f, OCHO)), 9) + padl(prom(f, APP), 9)); };
fila("todas", P);
for (const [n, a, b] of [["hasta 1,000 piezas", 0, 1000], ["1,001 a 10,000", 1001, 10000], ["10,001 a 20,000", 10001, 20000], ["20,001 a 50,000", 20001, 50000], ["50,001 a 100,000", 50001, 100000], ["más de 100,000", 100001, 1e15]]) fila(n, P.filter(o => o.q >= a && o.q <= b));
fila("OC de 5 productos o más", P.filter(o => o.tamOC >= 5)); fila("  sus primeros cuatro", P.filter(o => o.tamOC >= 5 && o.posOC <= 4));
for (const c of [...new Set(P.map(o => o.categoria || "(sin categoría)"))].sort()) fila("categoría " + c, P.filter(o => (o.categoria || "(sin categoría)") === c));
const ped = P.filter(o => o.pedida !== null && !o.abierta);
L.push("", "Fechas pedidas a mano: cuántas quedaron LISTAS a tiempo según a cuántos días hábiles se pidieron (lo que dice el aviso de fecha corta; en la app: " + FE.A_TIEMPO_SEGUN_LO_PEDIDO.medido + ")", pad("días pedidos", 16) + padl("órdenes", 8) + padl("a tiempo", 10));
for (const [n, a, b] of [["3 o menos", 0, 3], ["4 a 7", 4, 7], ["8 o más", 8, 1e9]]) { const f = ped.filter(o => o.pedida >= a && o.pedida <= b); if (f.length) L.push(pad(n, 16) + padl(f.length, 8) + padl(pct(f.filter(o => o.dreq <= o.pedida).length / f.length), 10)); }
console.log(L.join("\n"));
