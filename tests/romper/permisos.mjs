// Tanda «permisos»: quién puede escribir con las RPC de PrintFlow que no pasaban por pf_puede_escribir() (v10.84.39).
// El hallazgo (recorrido del 5-oct): register_print, log_wakeup_ack y save_app_config sólo pedían ser «personal interno», así
// que el rol `visor` —el de Dulce, de sólo lectura desde v10.77— podía registrar impresiones, firmar el «Buenos días» y
// cambiar los precios de los químicos. Y register_print/save_app_config guardaban como autor el nombre que mandaba la
// pantalla, no el de la sesión.
//
// Cada caso llama la RPC como una persona real (JWT simulado, rol authenticated) DENTRO de una transacción que termina en
// RAISE EXCEPTION: nada queda escrito. Lo que pasa en la base se lee antes de deshacer.
// Uso: node tests/romper/permisos.mjs  (lo corre scripts/probar.mjs; necesita SUPABASE_ACCESS_TOKEN, sin él FALLA)
//      node tests/romper/permisos.mjs --ensayar docs/migrations/<archivo>.sql
//        aplica esa migración DENTRO de la misma transacción que se deshace y corre los casos contra ella (el ensayo).
import fs from "node:fs";
const PROYECTO = "uvhardaeooaxjrrgdjwa";
const iEnsayo = process.argv.indexOf("--ensayar");
const ANTES = iEnsayo >= 0 ? fs.readFileSync(process.argv[iEnsayo + 1], "utf8") : "";
const U = {   // public.users.user_id (5-oct-2026)
  visor: "74666552-2e27-4b20-97b3-38c7fc9561a6",      // claude-pruebas
  dulce: "0ec50922-b1bb-4666-a09f-738242c2255e",      // visor de verdad
  german: "f9fc2b18-3dbb-422a-a9cb-70ca03bf170b",
  secretaria: "6b85fba8-383f-495c-ae4a-8cf5858c4a15",
  gerardo: "1c1ba04c-9195-4579-9b4d-a0a2366e07e9",    // produccion
  admin: "80fa4231-bff6-4e14-9943-6cc5a418c481",
};
const ORDEN = "OP-MPYPMZ9NB3C";   // H-3612, entregada: el registro de impresión se ensaya ahí y se deshace

const como = quien => `perform set_config('request.jwt.claims', json_build_object('sub', '${U[quien]}', 'role', 'authenticated')::text, true);`;
const intento = (clave, quien, llamada) => `
  ${como(quien)}
  begin ${llamada}; v_estado := 'pasó'; exception when others then v_estado := sqlstate; end;
  r := r || jsonb_build_object('${clave}', v_estado);`;

const SQL = `
do $prueba$
declare
  r jsonb := '{}'::jsonb;
  v_estado text;
  v_precios jsonb := (select value from public.app_config where key = 'chemical_prices');
begin
${ANTES}
  execute 'set local role authenticated';
  ${intento("visor_registra_impresion", "visor", `perform public.register_print('${ORDEN}', 'claude-pruebas', null)`)}
  ${intento("dulce_registra_impresion", "dulce", `perform public.register_print('${ORDEN}', 'dulce', null)`)}
  ${intento("visor_firma_buenos_dias", "visor", `perform public.log_wakeup_ack('claude-pruebas', 0, '[]'::jsonb)`)}
  ${intento("visor_cambia_precios", "visor", `perform public.save_app_config('chemical_prices', v_precios, 'claude-pruebas')`)}
  ${intento("german_cambia_precios", "german", `perform public.save_app_config('chemical_prices', v_precios, 'german')`)}
  ${intento("secretaria_cambia_precios", "secretaria", `perform public.save_app_config('chemical_prices', v_precios, 'secretaria')`)}
  ${intento("admin_cambia_precios", "admin", `perform public.save_app_config('chemical_prices', v_precios, 'gerardo')`)}
  ${intento("secretaria_registra_impresion", "secretaria", `perform public.register_print('${ORDEN}', 'admin', null)`)}
  ${intento("gerardo_firma_buenos_dias", "gerardo", `perform public.log_wakeup_ack('admin', 0, '[]'::jsonb)`)}
  execute 'reset role';
  r := r || jsonb_build_object(
    'precios_quien', (select updated_by from public.app_config where key = 'chemical_prices'),
    'impresion_quien', (select last_printed_by from public.orders where id = '${ORDEN}'),
    'buenos_dias_quien', (select details->>'user' from cobranza.audit_log where action = 'wakeup_acknowledged' order by created_at desc, id desc limit 1),
    'buenos_dias_autor', (select by_username from cobranza.audit_log where action = 'wakeup_acknowledged' order by created_at desc, id desc limit 1));
  -- sin sesión
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin perform public.register_print('${ORDEN}', 'admin', null); v_estado := 'pasó'; exception when others then v_estado := sqlstate; end;
  r := r || jsonb_build_object('anon_registra_impresion', v_estado);
  raise exception 'PRUEBA %', r;
end
$prueba$;`;

const CASOS = [
  ["perm-visor-no-registra-impresion", r => r.visor_registra_impresion === "42501", r => `el visor al registrar una impresión: ${r.visor_registra_impresion}`],
  ["perm-dulce-no-registra-impresion", r => r.dulce_registra_impresion === "42501", r => `Dulce (visor) al registrar una impresión: ${r.dulce_registra_impresion}`],
  ["perm-visor-no-firma-buenos-dias", r => r.visor_firma_buenos_dias === "42501", r => `el visor al firmar el «Buenos días»: ${r.visor_firma_buenos_dias}`],
  ["perm-visor-no-cambia-precios", r => r.visor_cambia_precios === "42501", r => `el visor al cambiar los precios de químicos: ${r.visor_cambia_precios}`],
  ["perm-german-no-cambia-precios", r => r.german_cambia_precios === "42501", r => `german al cambiar los precios (en pantalla sólo admin): ${r.german_cambia_precios}`],
  ["perm-secretaria-no-cambia-precios", r => r.secretaria_cambia_precios === "42501", r => `secretaria al cambiar los precios: ${r.secretaria_cambia_precios}`],
  ["perm-admin-cambia-precios", r => r.admin_cambia_precios === "pasó", r => `admin al cambiar los precios: ${r.admin_cambia_precios}`],
  ["perm-precios-autor-es-la-sesion", r => r.precios_quien === "admin", r => `admin guardó los precios mandando «gerardo»; quedó como autor: ${r.precios_quien}`],
  ["perm-secretaria-registra-impresion", r => r.secretaria_registra_impresion === "pasó", r => `secretaria al registrar una impresión: ${r.secretaria_registra_impresion}`],
  ["perm-impresion-autor-es-la-sesion", r => r.impresion_quien === "secretaria", r => `secretaria registró mandando «admin»; quedó como quien imprimió: ${r.impresion_quien}`],
  ["perm-gerardo-firma-buenos-dias", r => r.gerardo_firma_buenos_dias === "pasó", r => `gerardo al firmar el «Buenos días»: ${r.gerardo_firma_buenos_dias}`],
  ["perm-buenos-dias-autor-es-la-sesion", r => r.buenos_dias_quien === "gerardo" && /^gerardo/.test(r.buenos_dias_autor || ""), r => `gerardo firmó mandando «admin»; quedó user=${r.buenos_dias_quien}, autor=${r.buenos_dias_autor}`],
  ["perm-sin-sesion-no-registra", r => r.anon_registra_impresion === "42501", r => `sin sesión (anon) al registrar una impresión: ${r.anon_registra_impresion}`],
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
