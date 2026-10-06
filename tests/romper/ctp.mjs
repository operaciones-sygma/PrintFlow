// Tanda «ctp»: que el contador de placas y m² del CTP (el tablero de Germán, CTPMaintenanceCounter) NO vuelva a inflarse.
// El bug (v10.81.4-6, sep-2026): el colector de Prinect escribe la MISMA placa física hasta 8 veces en almacen.ctp_placas
// (un renglón por etapa del flujo) y cada falla dos veces en almacen.ctp_errores (tags FE y SE). Contarlas crudas daba ~2×.
// El arreglo vive en dos lados y esta tanda vigila los dos (Marcelo, 5-oct-2026: «que no hagamos una regresión»):
//   · el CÓDIGO: nada en src/ lee las tablas crudas; el contador lee las vistas que deduplican (v_ctp_placas, v_ctp_fallas);
//     el mantenimiento falla CERRADO (un error no puede mostrar el m² histórico como «sin mantenimiento»); el canal realtime.
//   · la BASE (sólo lectura, por la API de administración con SUPABASE_ACCESS_TOKEN): las vistas que deduplican no repiten
//     placa, evento ni falla, y no pierden ninguno; las tablas crudas sólo las leen ellas (v10.84.38: también lo que lee la
//     pantalla CTP de SygmaAlmacen: placas por día, errores por código y los del resumen, que cuadran contra lo deduplicado);
//     security_invoker; es_empleado() una vez por consulta; ctp_maintenance en la publicación realtime; reiniciar el
//     contador, sólo admin y german.
// Sin token, las revisiones de la base FALLAN (un candado que se salta solo no es candado).
//
// Uso: node tests/romper/ctp.mjs              (lo corre scripts/probar.mjs en cada subida)
//      node tests/romper/ctp.mjs --sabotajes  (rompe el arreglo a propósito y comprueba que cada revisión se pone en rojo)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROYECTO = "uvhardaeooaxjrrgdjwa";
const SABOTAJES = process.argv.includes("--sabotajes");

function fuentes(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fuentes(p));
    else if (/\.(jsx?|tsx?|mjs)$/.test(e.name)) out.push({ archivo: path.relative(RAIZ, p), texto: fs.readFileSync(p, "utf8") });
  }
  return out;
}

const tramo = (texto, desde, hasta) => {
  const i = texto.indexOf(desde);
  if (i < 0) return "";
  const j = texto.indexOf(hasta, i + desde.length);
  return texto.slice(i, j < 0 ? undefined : j);
};

// ── El código ────────────────────────────────────────────────────────────────────────────────────────────────────────────
function revisarCodigo(archivos) {
  const app = (archivos.find(a => a.archivo.replace(/\\/g, "/") === "src/App.jsx") || {}).texto || "";
  const contador = tramo(app, "function CTPMaintenanceCounter(", "function CTPResetConfirm(");
  const cargaMant = tramo(app, "async loadCtpMaintenance(", "async addCtpMaintenance(");
  const crudo = /\.from\(\s*["'`](ctp_placas|ctp_errores)["'`]\s*\)/;
  const conCrudo = archivos.filter(a => crudo.test(a.texto)).map(a => a.archivo);
  return [
    { id: "ctp-sin-crudo", ok: conCrudo.length === 0,
      detalle: conCrudo.length ? "lee almacen.ctp_placas/ctp_errores CRUDO en " + conCrudo.join(", ") + " (cuenta cada placa hasta 8 veces): usar v_ctp_placas/v_ctp_fallas" : "nada en src/ lee las tablas crudas del colector" },
    { id: "ctp-contador-lee-v_ctp_placas", ok: !!contador && /\.from\(\s*"v_ctp_placas"\s*\)/.test(contador),
      detalle: contador ? "el contador cuenta placas y m² desde almacen.v_ctp_placas (una fila por placa física)" : "no encontré CTPMaintenanceCounter en src/App.jsx" },
    { id: "ctp-contador-lee-v_ctp_fallas", ok: !!contador && /\.from\(\s*"v_ctp_fallas"\s*\)/.test(contador),
      detalle: "las placas fallidas salen de almacen.v_ctp_fallas (el par FE/SE contado una vez)" },
    { id: "ctp-mantenimiento-falla-cerrada", ok: !!cargaMant && /if\s*\(\s*error\s*\)\s*throw/.test(cargaMant),
      detalle: cargaMant ? "loadCtpMaintenance lanza si la consulta falla (no devuelve [] y apaga la alarma de «vencido»)" : "no encontré db.loadCtpMaintenance" },
    { id: "ctp-contador-realtime", ok: !!contador && /table\s*:\s*"ctp_maintenance"/.test(contador),
      detalle: "el contador escucha ctp_maintenance: un mantenimiento registrado en otra sesión lo reinicia aquí" },
  ];
}

// ── La base (sólo lectura) ───────────────────────────────────────────────────────────────────────────────────────────────
// La llave de «una placa física» es la MISMA que usa v_ctp_placas (jid + tinta; sin jid, trabajo + día de México + tinta), y
// la de «un evento del equipo», la de v_ctp_errores y v_ctp_fallas (equipo + código + momento). Si alguien cambia la llave de
// una vista a propósito, se cambia aquí también.
const LLAVE_PLACA = "(coalesce(jid, coalesce(job_raw,'?')||'::'||((expuesta_at at time zone 'America/Mexico_City')::date)::text), coalesce(separacion,'?'))";
const LLAVE_EVENTO = "(hostname, codigo, ocurrio_at)";
const CODIGOS_FALLA = "codigo = any (array[7806,7412,7407,7609,7619,7950,5126,7610,7403,7628,7504,7611])";
const HOY_MX = "(now() at time zone 'America/Mexico_City')::date";
// Las vistas que deduplican: las ÚNICAS que pueden leer las tablas crudas del colector (v10.84.38).
const DEDUP = ["v_ctp_placas", "v_ctp_errores", "v_ctp_fallas"];
const VISTAS_CTP = [...DEDUP, "v_ctp_placas_dia", "v_ctp_errores_top", "v_ctp_resumen"];
const lista = xs => xs.map(x => `'${x}'`).join(",");

// Qué vistas leen las tablas crudas, fuera de las permitidas. Con la lista vacía es el sabotaje: tiene que salir alguien.
const sqlLectoresDelCrudo = permitidas => `
select count(*) = 0 as ok,
       coalesce('leen el crudo: ' || string_agg(distinct v.relname || ' → ' || t.relname, ', '),
                'las tablas crudas (ctp_placas, ctp_errores) sólo las leen ${DEDUP.join(", ")}') as detalle
  from pg_depend d join pg_rewrite r on r.oid = d.objid join pg_class v on v.oid = r.ev_class
  join pg_class t on t.oid = d.refobjid join pg_namespace n on n.oid = t.relnamespace
 where n.nspname = 'almacen' and t.relname in ('ctp_placas','ctp_errores') and v.oid <> t.oid
   ${permitidas.length ? `and not (v.relnamespace = n.oid and v.relname in (${lista(permitidas)}))` : ""}`;

// Cada revisión es su propia consulta y devuelve un renglón (ok, detalle): si una vista no existe, falla sólo la suya.
const REVISIONES_BASE = [
  { id: "ctp-db-placas-unicas", sql: `
with pl as (select count(*) as filas, count(distinct ${LLAVE_PLACA}) as placas from almacen.v_ctp_placas),
     cr as (select count(*) as filas, count(distinct ${LLAVE_PLACA}) as placas from almacen.ctp_placas where estado = 'done')
select pl.filas = pl.placas and pl.placas = cr.placas as ok,
       format('v_ctp_placas: %s filas, %s placas distintas (el crudo: %s renglones de %s placas)', pl.filas, pl.placas, cr.filas, cr.placas) as detalle
  from pl, cr` },
  { id: "ctp-db-errores-unicos", sql: `
with ve as (select count(*) as filas, count(distinct ${LLAVE_EVENTO}) as eventos from almacen.v_ctp_errores),
     cr as (select count(*) as filas, count(distinct ${LLAVE_EVENTO}) as eventos from almacen.ctp_errores)
select ve.filas = ve.eventos and ve.eventos = cr.eventos as ok,
       format('v_ctp_errores: %s filas, %s eventos (el crudo: %s renglones de %s eventos)', ve.filas, ve.eventos, cr.filas, cr.eventos) as detalle
  from ve, cr` },
  { id: "ctp-db-fallas-unicas", sql: `
select count(*) = count(distinct ${LLAVE_EVENTO}) as ok,
       format('v_ctp_fallas: %s filas, %s fallas distintas', count(*), count(distinct ${LLAVE_EVENTO})) as detalle
  from almacen.v_ctp_fallas` },
  { id: "ctp-db-placas-dia-cuadra", sql: `
with vista as (select dia, placas from almacen.v_ctp_placas_dia where dia >= ${HOY_MX} - 30),
     reales as (select (expuesta_at at time zone 'America/Mexico_City')::date as dia, count(*) as placas
                  from almacen.v_ctp_placas where expuesta_at >= now() - interval '35 days' group by 1),
     j as (select coalesce(v.dia, r.dia) as dia, v.placas as en_vista, r.placas as reales
             from vista v full join reales r on r.dia = v.dia
            where coalesce(v.dia, r.dia) >= ${HOY_MX} - 30)
select count(*) filter (where en_vista is distinct from reales) = 0 as ok,
       format('placas por día, últimos 30 días de México: la vista dice %s y v_ctp_placas %s; %s días no cuadran',
              coalesce(sum(en_vista), 0), coalesce(sum(reales), 0), count(*) filter (where en_vista is distinct from reales)) as detalle
  from j` },
  { id: "ctp-db-errores-top-cuadra", sql: `
with v as (select coalesce(sum(veces), 0) as veces from almacen.v_ctp_errores_top),
     e as (select count(*) as eventos from (select distinct hostname, codigo, ocurrio_at from almacen.ctp_errores
                                             where ocurrio_at >= now() - interval '120 days') x)
select v.veces = e.eventos as ok,
       format('errores por código, 120 días: la vista suma %s veces; eventos distintos %s', v.veces, e.eventos) as detalle
  from v, e` },
  { id: "ctp-db-resumen-errores-cuadra", sql: `
with r as (select errores_hoy, errores_semana from almacen.v_ctp_resumen limit 1),
     e as (select count(*) filter (where (ocurrio_at at time zone 'America/Mexico_City')::date = ${HOY_MX}) as hoy,
                  count(*) filter (where ocurrio_at >= now() - interval '7 days') as semana
             from (select distinct hostname, codigo, ocurrio_at from almacen.ctp_errores where es_error) x)
select r.errores_hoy = e.hoy and r.errores_semana = e.semana as ok,
       format('errores del equipo en el resumen: hoy %s (eventos %s), 7 días %s (eventos %s)', r.errores_hoy, e.hoy, r.errores_semana, e.semana) as detalle
  from r, e` },
  { id: "ctp-db-crudo-solo-en-dedup", sql: sqlLectoresDelCrudo(DEDUP) },
  { id: "ctp-db-security-invoker", sql: `
select count(*) = ${VISTAS_CTP.length} and bool_and(coalesce(c.reloptions::text, '') like '%security_invoker=true%') as ok,
       string_agg(c.relname || ' ' || coalesce(c.reloptions::text, '(sin opciones)'), ', ' order by c.relname) as detalle
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'almacen' and c.relkind = 'v' and c.relname in (${lista(VISTAS_CTP)})` },
  { id: "ctp-db-policies-una-vez", sql: `
select count(*) = 3 and bool_and(qual like '( SELECT almacen.es_empleado()%') as ok,
       string_agg(tablename || ': ' || qual, ' · ' order by tablename) as detalle
  from pg_policies
 where schemaname = 'almacen' and tablename in ('ctp_placas','ctp_errores','ctp_estado') and cmd in ('SELECT','ALL')` },
  { id: "ctp-db-realtime", sql: `
select exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ctp_maintenance') as ok,
       'public.ctp_maintenance en la publicación supabase_realtime' as detalle` },
  { id: "ctp-db-reinicio-solo-admin-german", sql: `
with pol as (select cmd, policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') as t
               from pg_policies where schemaname = 'public' and tablename = 'ctp_maintenance')
select count(*) filter (where cmd in ('INSERT','UPDATE')) = 2 and count(*) filter (where cmd in ('DELETE','ALL')) = 0
       and coalesce(bool_and(t ~ '''admin''' and t ~ '''german''' and t !~ 'pf_puede_escribir') filter (where cmd in ('INSERT','UPDATE')), false) as ok,
       coalesce(string_agg(cmd || ' ' || policyname, ', ' order by cmd), 'sin policies') as detalle
  from pol` },
];

// Para el sabotaje: cada revisión de la base sólo prueba algo si los datos de hoy la pueden poner en rojo. Cada consulta
// devuelve ok = true cuando SÍ puede (el crudo repite, la definición vieja no cuadra, sin permitidas sale un lector).
const SABOTAJES_BASE = [
  { id: "placas-repetidas-en-crudo", que: "el crudo repite placas: placas-unicas puede fallar",
    sql: `select count(*) > count(distinct ${LLAVE_PLACA}) as ok from almacen.ctp_placas where estado = 'done'` },
  { id: "eventos-repetidos-en-crudo", que: "el crudo repite eventos (FE+SE) en 120 días: errores-unicos y errores-top-cuadra pueden fallar",
    sql: `select count(*) > count(distinct ${LLAVE_EVENTO}) as ok from almacen.ctp_errores where ocurrio_at >= now() - interval '120 days'` },
  { id: "fallas-repetidas-en-crudo", que: "el crudo repite fallas: fallas-unicas puede fallar",
    sql: `select count(*) > count(distinct ${LLAVE_EVENTO}) as ok from almacen.ctp_errores where es_error is true and ${CODIGOS_FALLA}` },
  { id: "placas-dia-con-la-definicion-vieja", que: "la definición de antes (crudo y día UTC) no cuadra: placas-dia-cuadra la detecta",
    sql: `
with vieja as (select expuesta_at::date as dia, count(*) as placas from almacen.ctp_placas
                where expuesta_at >= now() - interval '120 days' group by 1),
     reales as (select (expuesta_at at time zone 'America/Mexico_City')::date as dia, count(*) as placas
                  from almacen.v_ctp_placas where expuesta_at >= now() - interval '35 days' group by 1)
select count(*) filter (where v.placas is distinct from r.placas) > 0 as ok
  from vieja v full join reales r on r.dia = v.dia
 where coalesce(v.dia, r.dia) >= ${HOY_MX} - 30` },
  { id: "lectores-del-crudo-sin-permitidas", que: "sin la lista de permitidas, crudo-solo-en-dedup encuentra lectores",
    sql: `select not s.ok as ok from (${sqlLectoresDelCrudo([])}) s` },
];

async function sql(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("falta SUPABASE_ACCESS_TOKEN en el entorno (el token del CLI de Supabase)");
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROYECTO}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30000),
  });
  const cuerpo = await res.text();
  if (!res.ok) throw new Error(`la API contestó ${res.status}: ${cuerpo.slice(0, 200)}`);
  return JSON.parse(cuerpo);
}

const correr = async r => {
  try {
    const [f] = await sql(r.sql);
    return f ? { id: r.id, ok: f.ok === true, detalle: f.detalle ?? r.que ?? "" } : { id: r.id, ok: false, detalle: "la consulta no devolvió renglón" };
  } catch (e) { return { id: r.id, ok: false, detalle: "no se pudo revisar la base: " + e.message }; }
};
const revisarBase = () => Promise.all(REVISIONES_BASE.map(correr));

const imprimir = rs => { for (const r of rs) console.log((r.ok ? "PASA " : "FALLA") + " " + r.id + "  " + r.detalle); };

// ── Sabotajes: cada revisión tiene que poder ponerse en rojo ─────────────────────────────────────────────────────────────
async function sabotajes(archivos) {
  const con = (buscar, poner) => archivos.map(a => a.archivo.replace(/\\/g, "/") === "src/App.jsx" ? { ...a, texto: a.texto.split(buscar).join(poner) } : a);
  const casos = [
    { id: "ctp-sin-crudo", src: con('.from("v_ctp_placas")', '.from("ctp_placas")'), como: "el contador vuelve a leer ctp_placas crudo" },
    { id: "ctp-contador-lee-v_ctp_placas", src: con('.from("v_ctp_placas")', '.from("ctp_placas")'), como: "ídem, visto desde el contador" },
    { id: "ctp-contador-lee-v_ctp_fallas", src: con('.from("v_ctp_fallas")', '.from("ctp_errores")'), como: "las fallas vuelven a leerse crudas" },
    { id: "ctp-mantenimiento-falla-cerrada", src: con('if (error) throw new Error("loadCtpMaintenance: " + error.message);', ""), como: "loadCtpMaintenance ignora el error" },
    { id: "ctp-contador-realtime", src: con('table:"ctp_maintenance"', 'table:"ctp_mantenimiento"'), como: "el canal escucha otra tabla" },
  ];
  let mal = 0;
  for (const c of casos) {
    const r = revisarCodigo(c.src).find(x => x.id === c.id);
    const roja = r && !r.ok;
    if (!roja) mal++;
    console.log((roja ? "ok   " : "MAL  ") + "sabotaje " + c.id + ": " + c.como + (roja ? " → se pone en rojo" : " → ¡SIGUE EN VERDE!"));
  }
  for (const r of await Promise.all(SABOTAJES_BASE.map(correr))) {
    if (!r.ok) mal++;
    const s = SABOTAJES_BASE.find(x => x.id === r.id);
    console.log((r.ok ? "ok   " : "MAL  ") + "sabotaje " + r.id + ": " + (r.ok ? s.que : "hoy NO puede ponerse en rojo (" + r.detalle + ")"));
  }
  console.log("nota: ctp-db-resumen-errores-cuadra sólo puede ponerse en rojo los días con errores del equipo; crudo-solo-en-dedup cubre el resumen siempre");
  console.log(mal ? `sabotajes: ${mal} revisión(es) que no se ponen en rojo` : "sabotajes: todas las revisiones se ponen en rojo cuando se rompe el arreglo");
  return mal === 0;
}

// process.exitCode y no process.exit(): en Windows, salir a la fuerza con el socket de fetch abierto truena en libuv
// («Assertion failed … async.c») y la salida queda en 127 aunque todo pase.
const archivos = fuentes(path.join(RAIZ, "src"));
if (SABOTAJES) {
  process.exitCode = (await sabotajes(archivos)) ? 0 : 1;
} else {
  const rs = [...revisarCodigo(archivos), ...await revisarBase()];
  imprimir(rs);
  process.exitCode = rs.every(r => r.ok) ? 0 : 1;
}
