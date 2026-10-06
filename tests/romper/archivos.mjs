// Tanda «archivos»: la lista del bucket order-files que usa la pantalla «Archivos» (public.pf_archivos_del_bucket, v10.84.41)
// y, sobre todo, que ningún archivo que use una orden —o que se acabe de subir— salga como «huérfano»: el botón «Limpiar
// huérfanos» los borra sin deshacer. El hallazgo (recorrido del 5-oct): el listado viejo daba 544 a los 30 s, siempre.
//
// Cada caso llama la función como una persona real (JWT simulado) dentro de una transacción que termina en RAISE
// EXCEPTION. Los huérfanos se recalculan APARTE (como postgres, sin la función) y se comparan uno por uno.
// Uso: node tests/romper/archivos.mjs                       (lo corre scripts/probar.mjs; necesita SUPABASE_ACCESS_TOKEN)
//      node tests/romper/archivos.mjs --ensayar <migración>  (corre los casos contra una migración sin aplicarla)
import fs from "node:fs";
const PROYECTO = "uvhardaeooaxjrrgdjwa";
const iEnsayo = process.argv.indexOf("--ensayar");
const ANTES = iEnsayo >= 0 ? fs.readFileSync(process.argv[iEnsayo + 1], "utf8") : "";
const U = {   // public.users.user_id (5-oct-2026)
  german: "f9fc2b18-3dbb-422a-a9cb-70ca03bf170b", noemi: "ac0a8997-c507-48cb-ba2e-5ea77ea4b27b", admin: "80fa4231-bff6-4e14-9943-6cc5a418c481",
  visor: "74666552-2e27-4b20-97b3-38c7fc9561a6", genaro: "f321f84b-582b-4ee8-9ee1-9a3138654f5c", secretaria: "6b85fba8-383f-495c-ae4a-8cf5858c4a15",
};
const como = q => `perform set_config('request.jwt.claims', json_build_object('sub', '${U[q]}', 'role', 'authenticated')::text, true);`;
const quien = (clave, q) => `
  ${como(q)}
  begin perform count(*) from public.pf_archivos_del_bucket(); v_estado := 've'; exception when others then v_estado := sqlstate; end;
  r := r || jsonb_build_object('${clave}', v_estado);`;

const SQL = `
do $prueba$
declare r jsonb := '{}'::jsonb; v_estado text; v_filas int; v_huerfanos text[]; v_hoy_huerfanos int;
begin
${ANTES}
  execute 'set local role authenticated';
  ${quien("german", "german")}
  ${quien("noemi", "noemi")}
  ${quien("admin", "admin")}
  ${quien("visor", "visor")}
  ${quien("genaro", "genaro")}
  ${quien("secretaria", "secretaria")}
  ${como("german")}
  begin
    select count(*), coalesce(array_agg(ruta order by ruta) filter (where not referenciado), '{}'),
           count(*) filter (where creado > now() - interval '1 day' and not referenciado)
      into v_filas, v_huerfanos, v_hoy_huerfanos from public.pf_archivos_del_bucket();
  exception when others then v_filas := -1;
  end;
  execute 'reset role';
  r := r || jsonb_build_object('filas', v_filas, 'hoy_huerfanos', v_hoy_huerfanos,
    'objetos', (select count(*) from storage.objects where bucket_id = 'order-files'),
    'huerfanos', coalesce(array_length(v_huerfanos, 1), 0));
  -- los huérfanos, recalculados aparte: sin referencia en ninguna orden (ruta tal cual o con %20) y de más de un día
  with refs as (
    select distinct split_part(split_part(u, '/order-files/', 2), '?', 1) as r
      from public.orders o, lateral unnest(array[o.file_url, o.image_url, o.image_url_2]) u where u like '%/order-files/%'),
  esperados as (
    select s.name from storage.objects s
     where s.bucket_id = 'order-files' and s.created_at <= now() - interval '1 day'
       and not exists (select 1 from refs where refs.r = s.name or replace(refs.r, '%20', ' ') = s.name))
  select r || jsonb_build_object(
    'esperados', (select count(*) from esperados),
    'usados_marcados_huerfanos', (select count(*) from unnest(v_huerfanos) h
                                   where exists (select 1 from refs where refs.r = h or replace(refs.r, '%20', ' ') = h)),
    'iguales', (select coalesce(array_agg(name order by name), '{}') from esperados) = v_huerfanos)
    into r;
  -- sin sesión
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin perform count(*) from public.pf_archivos_del_bucket(); v_estado := 've'; exception when others then v_estado := sqlstate; end;
  r := r || jsonb_build_object('anon', v_estado);
  execute 'reset role';
  begin
    r := r || jsonb_build_object('decodifica', public.pf_url_decode('Dise%C3%B1o%20final%20(2).pdf'), 'basura', public.pf_url_decode('a%ZZb%'));
  exception when others then r := r || jsonb_build_object('decodifica', sqlstate);
  end;
  raise exception 'PRUEBA %', r;
end
$prueba$;`;

const CASOS = [
  ["arch-german-ve", r => r.german === "ve", r => `german: ${r.german}`],
  ["arch-preprensa-ve", r => r.noemi === "ve", r => `preprensa (noemi): ${r.noemi}`],
  ["arch-admin-ve", r => r.admin === "ve", r => `admin: ${r.admin}`],
  ["arch-visor-no", r => r.visor === "42501", r => `visor: ${r.visor}`],
  ["arch-vendedor-no", r => r.genaro === "42501", r => `vendedor (genaro): ${r.genaro}`],
  ["arch-secretaria-no", r => r.secretaria === "42501", r => `secretaria (no tiene la pantalla): ${r.secretaria}`],
  ["arch-sin-sesion-no", r => r.anon === "42501", r => `sin sesión: ${r.anon}`],
  ["arch-trae-todos", r => r.filas >= 0 && r.filas === r.objetos, r => `la lista trae ${r.filas} de ${r.objetos} archivos del bucket`],
  ["arch-usado-nunca-es-huerfano", r => r.filas >= 0 && r.usados_marcados_huerfanos === 0, r => `archivos que usa alguna orden y salen como huérfanos: ${r.usados_marcados_huerfanos}`],
  ["arch-lo-de-hoy-nunca-es-huerfano", r => r.filas >= 0 && r.hoy_huerfanos === 0, r => `archivos de menos de un día que salen como huérfanos: ${r.hoy_huerfanos}`],
  ["arch-huerfanos-cuadran", r => r.filas >= 0 && r.iguales === true, r => `huérfanos según la función: ${r.huerfanos}; recalculados aparte: ${r.esperados}; la misma lista: ${r.iguales ? "sí" : "NO"}`],
  ["arch-decodifica-como-la-pantalla", r => r.decodifica === "Diseño final (2).pdf" && r.basura === "a%ZZb%", r => `pf_url_decode: «${r.decodifica}», y lo que no es código queda igual: «${r.basura}»`],
];

async function correr() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("falta SUPABASE_ACCESS_TOKEN en el entorno (el token del CLI de Supabase)");
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROYECTO}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: SQL }),
    signal: AbortSignal.timeout(60000),
  });
  const txt = await res.text();
  const m = /PRUEBA (\{.*?\})(\\n|\n|")/s.exec(txt.replace(/\\"/g, '"'));
  if (!m) throw new Error(`la prueba no llegó a su final (HTTP ${res.status}): ${txt.slice(0, 300)}`);
  return JSON.parse(m[1]);
}

let r = null, error = null;
try { r = await correr(); } catch (e) { error = e.message; }
let mal = 0;
for (const [id, pasa, dice] of CASOS) {
  const ok = !!r && pasa(r);
  if (!ok) mal++;
  console.log((ok ? "PASA " : "FALLA") + " " + id + "  " + (r ? dice(r) : "no se pudo probar: " + error));
}
process.exitCode = mal ? 1 : 0;
