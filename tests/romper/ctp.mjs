// Tanda «ctp»: que el contador de placas y m² del CTP (el tablero de Germán, CTPMaintenanceCounter) NO vuelva a inflarse.
// El bug (v10.81.4-6, sep-2026): el colector de Prinect escribe la MISMA placa física hasta 8 veces en almacen.ctp_placas
// (un renglón por etapa del flujo) y cada falla dos veces en almacen.ctp_errores (tags FE y SE). Contarlas crudas daba ~2×.
// El arreglo vive en dos lados y esta tanda vigila los dos (Marcelo, 5-oct-2026: «que no hagamos una regresión»):
//   · el CÓDIGO: nada en src/ lee las tablas crudas; el contador lee las vistas que deduplican (v_ctp_placas, v_ctp_fallas);
//     el mantenimiento falla CERRADO (un error no puede mostrar el m² histórico como «sin mantenimiento»); el canal realtime.
//   · la BASE (sólo lectura, por la API de administración con SUPABASE_ACCESS_TOKEN): las vistas siguen sin repetir placa
//     ni falla, siguen con security_invoker, el resumen no lee el crudo, ctp_maintenance sigue en la publicación realtime y
//     reiniciar el contador sigue siendo sólo de admin y german.
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
// La llave de «una placa física» es la MISMA que usa la vista (jid + tinta; sin jid, trabajo + día de México + tinta).
// Si alguien cambia la llave de la vista a propósito, se cambia aquí también.
const LLAVE_PLACA = "(coalesce(jid, coalesce(job_raw,'?')||'::'||((expuesta_at at time zone 'America/Mexico_City')::date)::text), coalesce(separacion,'?'))";
const CODIGOS_FALLA = "codigo = any (array[7806,7412,7407,7609,7619,7950,5126,7610,7403,7628,7504,7611])";
const SQL_BASE = `
with pl as (select count(*) as filas, count(distinct ${LLAVE_PLACA}) as placas from almacen.v_ctp_placas),
     cr as (select count(*) as filas, count(distinct ${LLAVE_PLACA}) as placas from almacen.ctp_placas where estado='done'),
     fa as (select count(*) as filas, count(distinct (hostname, codigo, ocurrio_at)) as unicas from almacen.v_ctp_fallas),
     pol as (select cmd, policyname, coalesce(qual,'')||' '||coalesce(with_check,'') as t from pg_policies where schemaname='public' and tablename='ctp_maintenance')
select 'ctp-db-placas-unicas' as id, pl.filas = pl.placas as ok,
       format('v_ctp_placas: %s filas, %s placas distintas (el crudo tiene %s renglones de %s placas)', pl.filas, pl.placas, cr.filas, cr.placas) as detalle
  from pl, cr
union all
select 'ctp-db-fallas-unicas', fa.filas = fa.unicas, format('v_ctp_fallas: %s filas, %s fallas distintas', fa.filas, fa.unicas) from fa
union all
select 'ctp-db-security-invoker', count(*) = 3 and bool_and(coalesce(c.reloptions::text,'') like '%security_invoker=true%'),
       string_agg(c.relname || ' ' || coalesce(c.reloptions::text,'(sin opciones)'), ', ' order by c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'almacen' and c.relname in ('v_ctp_placas','v_ctp_fallas','v_ctp_resumen')
union all
select 'ctp-db-resumen-sin-crudo',
       to_regclass('almacen.v_ctp_resumen') is not null and not exists (
         select 1 from pg_depend d join pg_rewrite r on r.oid = d.objid
          where r.ev_class = to_regclass('almacen.v_ctp_resumen') and d.refobjid = to_regclass('almacen.ctp_placas')),
       'v_ctp_resumen cuenta las placas desde v_ctp_placas, no desde almacen.ctp_placas'
union all
select 'ctp-db-realtime',
       exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ctp_maintenance'),
       'public.ctp_maintenance en la publicación supabase_realtime'
union all
select 'ctp-db-reinicio-solo-admin-german',
       count(*) filter (where cmd in ('INSERT','UPDATE')) = 2 and count(*) filter (where cmd in ('DELETE','ALL')) = 0
       and coalesce(bool_and(t ~ '''admin''' and t ~ '''german''' and t !~ 'pf_puede_escribir') filter (where cmd in ('INSERT','UPDATE')), false),
       coalesce(string_agg(cmd || ' ' || policyname, ', ' order by cmd), 'sin policies')
  from pol`;

// Para el sabotaje: la misma cuenta sobre el CRUDO tiene que dar repetidos; si no, la revisión de la vista no prueba nada.
const SQL_SABOTAJE = `
select (select count(*) > count(distinct ${LLAVE_PLACA}) from almacen.ctp_placas where estado='done') as placas_repetidas_en_crudo,
       (select count(*) > count(distinct (hostname, codigo, ocurrio_at)) from almacen.ctp_errores where es_error is true and ${CODIGOS_FALLA}) as fallas_repetidas_en_crudo`;

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

async function revisarBase() {
  const esperadas = ["ctp-db-placas-unicas", "ctp-db-fallas-unicas", "ctp-db-security-invoker", "ctp-db-resumen-sin-crudo", "ctp-db-realtime", "ctp-db-reinicio-solo-admin-german"];
  try {
    const filas = await sql(SQL_BASE);
    return esperadas.map(id => { const f = filas.find(x => x.id === id); return f ? { id, ok: f.ok === true, detalle: f.detalle } : { id, ok: false, detalle: "la consulta no devolvió esta revisión" }; });
  } catch (e) {
    return esperadas.map(id => ({ id, ok: false, detalle: "no se pudo revisar la base: " + e.message }));
  }
}

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
  try {
    const [s] = await sql(SQL_SABOTAJE);
    for (const [k, v] of Object.entries(s)) {
      if (v !== true) mal++;
      console.log((v === true ? "ok   " : "MAL  ") + "sabotaje " + k + (v === true ? ": el crudo sí repite, así que las revisiones de las vistas pueden fallar" : ": el crudo NO repite; la revisión de la vista no prueba nada hoy"));
    }
  } catch (e) { mal++; console.log("MAL  sabotaje de la base: " + e.message); }
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
