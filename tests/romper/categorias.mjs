// Tratar de ROMPER la categoría del trabajo (v10.84.91, Marcelo 12/13-oct: «Categoría nueva aparte», de lista cerrada, para Analytics),
// sin navegador: las reglas de src/lib/categorias.js (la sugerencia de la forma) con ejemplos de verdad y los bordes, y contra la BASE
// (sólo lectura, por la API de administración): la función que la base genera de las MISMAS reglas dice lo mismo para todos los nombres
// de órdenes, su lista de categorías es la de la pantalla, y la historia quedó clasificada. Cada caso afirma lo que DEBERÍA pasar.
// Uso: node tests/romper/categorias.mjs   (necesita SUPABASE_ACCESS_TOKEN; sin él, los casos de la base FALLAN)
import { categoriaSugerida, CATEGORIAS, CODIGOS_CATEGORIA, nombreDeCategoria, textoDeReglas } from "../../src/lib/categorias.js";
const PROYECTO = "uvhardaeooaxjrrgdjwa";
const res = [];
const ok = (n, c, x = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : "")); };
const espera = (pares) => pares.filter(([t, c]) => categoriaSugerida(t) !== c).map(([t, c]) => `«${t}» da ${categoriaSugerida(t)} y debía ${c}`);

// ── las reglas (la sugerencia de la forma)
let mal = espera([
  ["ETIQUETA PLG", "etiquetas"], ["STICKER #4 REDONDO NEGRO DE PINOS ", "etiquetas"], ["CALCOMANÍAS", "etiquetas"], ["CÓDIGO DE BARRAS", "etiquetas"],
  ["TRÍPTICOS DE ACTA", "folletos"], ["VOLANTES MEDIA CARTA", "folletos"], ["INSTRUCTIVOS", "folletos"],
  ["IMPRESIÓN POP", "pop"], ["TENT CARDS", "pop"], ["PÓSTER", "pop"], ["SOPORTES", "pop"],
  ["REMISIONES", "formas"], ["PEDIDOS CON PAGARÉ", "formas"], ["BOLETAS", "formas"], ["0404F ORDEN DE TRABAJO", "formas"],
  ["LONAS", "lonas"], ["ROLL UP", "lonas"], ["VINIL", "lonas"],
  ["HOJAS MEMBRETADAS", "papeleria"], ["FOLDERS", "papeleria"], ["SOBRES", "papeleria"], ["TARJETAS DE PRESENTACIÓN", "papeleria"],
  ["ANUARIOS", "libros"], ["REVISTA", "libros"], ["CATÁLOGOS", "libros"], ["CÓDIGO DE ÉTICA", "libros"],
  ["CUPONERAS", "cuponeras"], ["BOLETOS", "cuponeras"], ["PASES", "cuponeras"],
  ["LIBRETAS ENGARGOLADAS", "libretas"], ["AGENDAS", "libretas"],
  ["SOLAPAS", "empaques"], ["BOLSAS", "empaques"], ["CONOS", "empaques"],
  ["CONSTANCIAS", "invitaciones"], ["RECONOCIMIENTOS", "invitaciones"], ["TARJETAS", "invitaciones"],
  ["CALENDARIOS DE ESCRITORIO", "calendarios"], ["CALENDARIO 2027", "calendarios"],
]);
ok("cat-01 cada categoría reconoce sus ejemplos de la propuesta", mal.length === 0, mal.join(" · ") || "todos");
mal = espera([
  ["POPOTES", null], ["SOPORTES PARA POPOTE", "pop"], ["🔴 ATRASADA · LONAS 3X2", "lonas"], ["stock", null], [" STOCK ", null], ["", null], [null, null],
  ["etiquetas para frasco", "etiquetas"], ["HOJAS MEMBRETADAS Y SOBRES", "papeleria"], ["NOTAS DE REMISIÓN", "formas"], ["ZAPATO CODE / ZAPATO MED NUEVO", null],
]);
ok("cat-02 los bordes: palabra entera con acentos, minúsculas, la marca de las atrasadas, el inventario y la prioridad", mal.length === 0, mal.join(" · ") || "todos");
mal = espera([
  ["CARÁTULA Y CONTRACARÁTULA", "libros"], ["MÓDULOS", "libros"], ["PENDÓN", "lonas"], ["ARAÑAS Y PENDÓN", "lonas"], ["TROVICEL", "lonas"],
  ["IMPRESIÓN PLOTTER", "lonas"], ["MENÚS", "pop"], ["MEMORÁNDUM", "formas"], ["PORTABOLETO", "cuponeras"],
]);
ok("cat-03 las sueltas de la propuesta van donde Marcelo aprobó (carátulas y módulos, pendón, menús, memorándum, portaboleto)", mal.length === 0, mal.join(" · ") || "todas");
// el catálogo de la forma (PTYPES de App.jsx): cada tipo de la lista sugiere su categoría (sólo «Otro», que es escribir libre, no)
{
  const fs = await import("node:fs"), path = await import("node:path"), { fileURLToPath } = await import("node:url");
  const app = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/App.jsx"), "utf8");
  const m = /const PTYPES=(\[[^\]]*\])/.exec(app);
  const lista = m ? JSON.parse(m[1]) : [];
  const sin = lista.filter(x => x !== "Otro" && !categoriaSugerida(x));
  ok("cat-09 cada tipo del catálogo de la forma sugiere su categoría", lista.length > 10 && sin.length === 0, sin.join(", ") || lista.length + " tipos");
}
ok("cat-04 la lista: 12 categorías + «Otro», con nombre, sin repetir", CATEGORIAS.length === 13 && new Set(CODIGOS_CATEGORIA).size === 13 && CODIGOS_CATEGORIA.every(c => !!nombreDeCategoria(c)) && CODIGOS_CATEGORIA.at(-1) === "otro",
  CODIGOS_CATEGORIA.join(","));

// ── la base (sólo lectura)
async function consulta(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("falta SUPABASE_ACCESS_TOKEN en el entorno (el token del CLI de Supabase)");
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROYECTO}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }), signal: AbortSignal.timeout(60000) });
  const txt = await r.text();
  if (r.status >= 300) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt);
}
try {
  const nombres = await consulta(`select product_type t, public.categoria_sugerida(product_type) c, count(*) n from public.orders group by 1, 2`);
  const distintas = nombres.filter(x => (categoriaSugerida(x.t) ?? null) !== (x.c ?? null));
  ok("cat-05 la base y la pantalla sugieren lo mismo para TODOS los nombres de órdenes (las mismas reglas)", nombres.length > 100 && distintas.length === 0,
    `${nombres.length} nombres · distintos: ${distintas.slice(0, 4).map(x => `«${x.t}» base ${x.c} / pantalla ${categoriaSugerida(x.t)}`).join(" · ") || "ninguno"}`);
  const vivas = await consulta(`select product_type t, public.categoria_sugerida(product_type) c from public.orders where cancelled_at is null and stage not in ('cancelled','maq_cancelled') and product_type !~* '^\\s*stock\\s*$'`);
  const sin = vivas.filter(x => !x.c).length;
  ok("cat-06 las reglas clasifican solas al menos el 95 % de las órdenes vivas (sin contar la venta de inventario)", vivas.length > 500 && sin / vivas.length <= 0.05,
    `${vivas.length - sin} de ${vivas.length} (${(100 * (vivas.length - sin) / Math.max(1, vivas.length)).toFixed(1)} %)`);
  const chk = await consulta(`select pg_get_constraintdef(c.oid) d from pg_constraint c where c.conrelid = 'public.orders'::regclass and pg_get_constraintdef(c.oid) ~ 'categoria'`);
  const enBase = [...String(chk[0]?.d || "").matchAll(/'([a-z]+)'::text/g)].map(m => m[1]);
  ok("cat-07 la base acepta exactamente las categorías de la pantalla (su CHECK)", enBase.length === 13 && CODIGOS_CATEGORIA.every(c => enBase.includes(c)), enBase.join(",") || "sin CHECK");
  const hist = await consulta(`select count(*) filter (where categoria is null and product_type !~* '^\\s*stock\\s*$') sin_categoria,
      count(*) filter (where categoria is not null and product_type ~* '^\\s*stock\\s*$') inventario_con_categoria,
      count(*) filter (where product_type like '🔴 ATRASADA · %') atrasadas from public.orders
      where created_at < coalesce((select min(created_at) from cobranza.audit_log where action = 'v10_84_91_categorias'), now())`);
  // (la historia: las de ANTES de la migración. Una nueva que llega por otra puerta con un nombre que ninguna regla reconoce se queda
  //  sin categoría a propósito, «Sin clasificar» en Analytics; si este caso las contara, la primera frenaría todas las subidas)
  const h = hist[0] || {};
  ok("cat-08 la historia quedó clasificada (ninguna orden sin categoría, la venta de inventario sin) y sin «🔴 ATRASADA · »",
    Number(h.sin_categoria) === 0 && Number(h.inventario_con_categoria) === 0 && Number(h.atrasadas) === 0, JSON.stringify(h));
  // v10.84.91 — la app edita orders COLUMNA POR COLUMNA (authenticated no tiene UPDATE en la tabla): sin su permiso, en cuanto la
  //   pantalla mandara la categoría fallaría toda edición de una orden y también crearla (el upsert pide UPDATE). Lo encontró la revisión
  //   antes del ensayo (13-oct); la migración lo da con GRANT UPDATE (categoria).
  const priv = await consulta(`select has_column_privilege('authenticated', 'public.orders', 'categoria', 'UPDATE') upd,
      has_column_privilege('authenticated', 'public.orders', 'categoria', 'INSERT') ins, has_column_privilege('anon', 'public.orders', 'categoria', 'UPDATE') anon_upd`);
  const pv = priv[0] || {};
  ok("cat-10 la app puede escribir la categoría (UPDATE por columna, como las otras; anon no)", pv.upd === true && pv.ins === true && pv.anon_upd === false, JSON.stringify(pv));
} catch (e) {
  for (const n of ["cat-05", "cat-06", "cat-07", "cat-08", "cat-10"]) ok(n + " (no se pudo consultar la base)", false, e.message.slice(0, 200));
}

for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\ncategorias: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
