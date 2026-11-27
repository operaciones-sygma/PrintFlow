// Ensayo local (PGlite) de v10.84.195_indicadores_del_mes.sql, encima de la 194: lo que se mide de un mes, el día 1, las metas copiadas, quién ve y quién revisa.
// Uso: node docs/migrations/v10.84.195_ensayo_local.mjs → ENSAYO OK o las fallas. (Los topes «set local …_timeout» se quitan: PGlite no los tiene.)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ALMACEN = process.env.REPO_ALMACEN || path.resolve(AQUI, "..", "..", "..", "sygma-almacen");   // PGlite viene de ../sygma-almacen/node_modules
const { PGlite } = await import(pathToFileURL(path.join(ALMACEN, "node_modules", "@electric-sql", "pglite", "dist", "index.js")).href);
const sinTopes = t => t.replace(/^set local (statement|lock)_timeout.*$/gm, "");
const M194 = sinTopes(fs.readFileSync(path.join(AQUI, "v10.84.194_no_conformidades.sql"), "utf8"));
const M195 = sinTopes(fs.readFileSync(path.join(AQUI, "v10.84.195_indicadores_del_mes.sql"), "utf8"));
const M195B = sinTopes(fs.readFileSync(path.join(AQUI, "v10.84.195b_permisos_de_mas.sql"), "utf8"));
const ESQUEMA = String.raw`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema cobranza; create schema cron; create schema supabase_migrations;
create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create table public.users (id uuid primary key default gen_random_uuid(), username text unique not null, role text not null, active boolean default true, user_id uuid);
create table cobranza.users (id uuid primary key, username text not null, role text not null, active boolean not null default true);
create function cobranza.is_internal_employee() returns boolean language sql stable security definer set search_path to 'cobranza', 'public', 'pg_temp' as $f$
  SELECT auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM cobranza.users u WHERE u.id = auth.uid() AND u.active) OR EXISTS (SELECT 1 FROM public.users pu WHERE pu.user_id = auth.uid() AND pu.active));
$f$;
create function public.pf_uid_role() returns text language sql stable security definer set search_path to 'public', 'cobranza', 'pg_temp' as $f$
  SELECT COALESCE((SELECT role FROM public.users WHERE user_id = auth.uid() AND active = true LIMIT 1), (SELECT 'vendedor' FROM cobranza.users WHERE id = auth.uid() AND active = true AND role = 'vendedor' LIMIT 1))
$f$;
create function public.pf_uid_username() returns text language sql stable security definer set search_path to 'public', 'cobranza', 'pg_temp' as $f$
  SELECT COALESCE((SELECT username FROM public.users WHERE user_id = auth.uid() AND active = true LIMIT 1), (SELECT username FROM cobranza.users WHERE id = auth.uid() AND active = true LIMIT 1))
$f$;
create table public.orders (id text primary key, production_number text, client text, client_company text, stage text, source text, due_date date, delivered_at timestamptz, returned_at timestamptz, return_reason text);
create table public.order_timeline (id bigserial primary key, order_id text, action text, created_at timestamptz default now(), to_stage text);
create table public.order_waste (id bigserial primary key, order_id text, pliegos integer, qty integer, note text, created_at timestamptz default now());
create table cron.job (jobid bigserial, jobname text, schedule text, command text);   -- como el de pg_cron
create view cron.jobs as select jobname nombre, schedule cuando, command que from cron.job;
create function cron.schedule(n text, c text, q text) returns bigint language sql as $$ insert into cron.job (jobname, schedule, command) values (n, c, q) returning jobid $$;
grant usage on schema public, cobranza to authenticated, anon;
insert into public.users (username, role, user_id) values ('noemi', 'preprensa', '00000000-0000-4000-8000-000000000001'), ('admin', 'admin', '00000000-0000-4000-8000-000000000002'), ('bodega', 'almacen', '00000000-0000-4000-8000-000000000003');
-- noviembre: 4 entregadas con fecha (3 a tiempo: una por la regla de «lista»), 1 sin fecha, 1 de inventario (fuera); y la del último rato del 30-nov en México
insert into public.orders values
  ('OP-1', 'P-0001', 'A', 'A', 'delivered', null, '2026-11-10', '2026-11-10 12:00-06', null, null),
  ('OP-2', 'P-0002', 'B', 'B', 'delivered', null, '2026-11-10', '2026-11-13 12:00-06', null, null),
  ('OP-3', 'P-0003', 'C', 'C', 'delivered', null, '2026-11-12', '2026-11-20 12:00-06', '2026-11-22 10:00-06', 'Corte chueco'),
  ('OP-4', 'P-0004', 'D', 'D', 'delivered', null, '2026-11-30', '2026-11-30 21:00-06', null, null),
  ('OP-5', 'P-0005', 'E', 'E', 'delivered', null, null, '2026-11-15 12:00-06', null, null),
  ('OP-6', 'P-0006', 'F', 'F', 'delivered', 'stock', '2026-11-01', '2026-11-20 12:00-06', null, null),
  ('OP-7', 'P-0007', 'G', 'G', 'delivered', null, '2026-12-01', '2026-12-01 10:00-06', null, null);
insert into public.order_timeline (order_id, action, created_at, to_stage) values
  ('OP-2', '⚙️ Máquina → 📤 Salidas', '2026-11-10 17:00-06', 'salidas'),
  ('OP-1', '↩️ Regresada de 💿 CTP → 🎨 Diseño · Razón: ERROR DE DISEÑO', '2026-11-05 10:00-06', 'design'),
  ('OP-2', '↩️ Regresada de 💿 CTP → 👤 Aprobación · Razón: ya hay placas', '2026-11-06 10:00-06', 'proof_client'),
  ('OP-3', '↩️ Regresada de 💿 CTP → 🎨 Diseño · Razón: cambio de medida', '2026-11-07 10:00-06', 'design'),
  ('OP-1', '✅ Cliente aprobó la prueba · Ana por WhatsApp · 🎨 Diseño → 💿 CTP', '2026-11-28 10:00-06', 'ctp'),
  ('OP-2', '🎨 Diseño → ✅ Lista para imprimir', '2026-11-28 11:00-06', 'ready');
insert into public.order_waste (order_id, pliegos, qty, note, created_at) values ('OP-1', 10, 200, 'arranque', '2026-11-11 10:00-06'), ('OP-1', 5, 50, 'manchas', '2026-11-12 10:00-06'), ('OP-2', 3, 30, 'diciembre', '2026-12-02 10:00-06');
`;
const db = new PGlite();
await db.exec(ESQUEMA);
await db.exec(M194);
// lo que Dirección decidió de lo detectado: un regreso sí, uno no era, uno por revisar; y dos quejas de noviembre
await db.exec(`update public.no_conformidades set es_no_conformidad = true where que_paso like '%ERROR DE DISEÑO%';
  update public.no_conformidades set es_no_conformidad = false, por_que_no = 'Fue de ruta: ya había placas' where que_paso like '%ya hay placas%';
  insert into public.no_conformidades (origen, que_paso, cliente, canal, ocurrio_en) values ('queja', 'El rojo salió naranja', 'A', 'whatsapp', '2026-11-20 10:00-06'), ('queja', 'Faltaron piezas', 'B', 'telefono', '2026-11-25 10:00-06');`);
await db.exec(M195);
await db.exec("grant execute on function public.indicadores_calcular(date) to authenticated");   // como Supabase: toda función nueva nace con EXECUTE para authenticated
await db.exec(M195B);
const fallas = [];
const ok = (n, c, x = "") => { if (!c) fallas.push(n); console.log((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : "")); };
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const como = async (uid, fn) => { await db.exec("begin"); await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid })]); await db.exec("set local role authenticated"); try { return await fn(); } finally { await db.exec("rollback"); } };
const intenta = async f => { try { await f(); return null; } catch (e) { return e.message; } };
const NOEMI = "00000000-0000-4000-8000-000000000001", MARCELO = "00000000-0000-4000-8000-000000000002";

ok("ind-01 el 27-nov no guarda nada (noviembre no ha cerrado)", (await q("select public.indicadores_guardar('ensayo', '2026-11-27') n"))[0].n === 0);
ok("ind-02 el 1-dic guarda noviembre, una sola vez", (await q("select public.indicadores_guardar('ensayo', '2026-12-01') n"))[0].n === 1 && (await q("select public.indicadores_guardar('ensayo', '2026-12-01') n"))[0].n === 0);
const nov = (await q("select valores, metas, guardado_por from public.indicadores_mes where mes = '2026-11-01'"))[0];
const v = nov?.valores || {};
ok("ind-03 entrega a tiempo: 3 de 4 con fecha (la lista a tiempo cuenta; sin fecha e inventario fuera; el 30-nov a las 21:00 es noviembre)", v.entrega_a_tiempo?.a_tiempo === 3 && v.entrega_a_tiempo?.con_fecha === 4 && v.entrega_a_tiempo?.sin_fecha === 1 && Number(v.entrega_a_tiempo?.pct) === 75, JSON.stringify(v.entrega_a_tiempo));
ok("ind-04 regresos por falla: 1 sí, 1 no era, 1 por revisar", v.regresos_por_falla?.n === 1 && v.regresos_por_falla?.no_eran === 1 && v.regresos_por_falla?.por_revisar === 1, JSON.stringify(v.regresos_por_falla));
ok("ind-05 devoluciones 1, quejas 2", v.devoluciones?.n === 1 && v.quejas?.n === 2, JSON.stringify([v.devoluciones, v.quejas]));
ok("ind-06 merma de noviembre: 2 renglones, 1 orden, 250 piezas, 15 pliegos (la de diciembre fuera)", v.merma?.renglones === 2 && v.merma?.ordenes === 1 && v.merma?.piezas === 250 && v.merma?.pliegos === 15, JSON.stringify(v.merma));
ok("ind-07 salidas de Diseño: 2, con autorización 1", v.diseno?.salidas === 2 && v.diseno?.con_autorizacion === 1, JSON.stringify(v.diseno));
ok("ind-08 las metas, copiadas (5, la de entrega en 85)", Array.isArray(nov?.metas) && nov.metas.length === 5 && Number(nov.metas[0].umbral) === 85 && nov.guardado_por === "ensayo", JSON.stringify(nov?.metas?.map(m => m.clave)));
await db.exec("update public.metas_calidad set umbral = 90, meta = '90% o más' where clave = 'entrega_a_tiempo'");
ok("ind-09 cambiar una meta no cambia lo ya guardado", Number((await q("select metas from public.indicadores_mes where mes = '2026-11-01'"))[0].metas[0].umbral) === 85);
ok("ind-10 si una noche falla, la siguiente guarda lo que falte (el 1-feb: diciembre y enero)", (await q("select public.indicadores_guardar('ensayo', '2027-02-01') n"))[0].n === 2);
ok("ind-11 Dirección lo ve; Noemí no", (await como(MARCELO, () => q("select count(*)::int n from public.indicadores_mes")))[0].n === 3 && (await como(NOEMI, () => q("select count(*)::int n from public.indicadores_mes")))[0].n === 0);
const rev = await como(MARCELO, async () => { await db.query("update public.indicadores_mes set revision = 'Noviembre: 75% a tiempo, abajo de la meta. Revisar Corte.', acciones = 'Plan con Gerardo' where mes = '2026-11-01'"); return (await q("select revision, revisado_por, revisado_en from public.indicadores_mes where mes = '2026-11-01'"))[0]; });
ok("ind-12 la revisión de Dirección queda con quién y cuándo", rev?.revisado_por === "admin" && !!rev?.revisado_en && /75%/.test(rev?.revision || ""), JSON.stringify(rev));
ok("ind-13 lo medido no se puede cambiar (ni Dirección)", !!(await como(MARCELO, () => intenta(() => db.query("update public.indicadores_mes set valores = '{}' where mes = '2026-11-01'")))));
ok("ind-14 Noemí no revisa", (await como(NOEMI, async () => { await db.query("update public.indicadores_mes set revision = 'x' where mes = '2026-11-01'"); return (await q("select count(*)::int n from public.indicadores_mes where revision = 'x'"))[0].n; })) === 0);
ok("ind-15 el mes en curso: Dirección sí, Noemí no", !!(await como(NOEMI, () => intenta(() => db.query("select public.indicadores_del_mes_en_curso()")))) && !!(await como(MARCELO, async () => (await q("select public.indicadores_del_mes_en_curso() v"))[0].v?.mes)));
ok("ind-16 nadie de la app guarda meses ni borra", !!(await como(MARCELO, () => intenta(() => db.query("select public.indicadores_guardar('yo', '2027-03-01')")))) && !!(await como(MARCELO, () => intenta(() => db.query("delete from public.indicadores_mes")))));
ok("ind-17 el trabajo de cada noche quedó", (await q("select count(*)::int n from cron.jobs where nombre = 'printflow-indicadores-mes' and cuando = '20 6 * * *'"))[0].n === 1);
const BODEGA = "00000000-0000-4000-8000-000000000003";
ok("ind-18 (195b) una sesión ya no calcula las cifras de un mes", !!(await como(MARCELO, () => intenta(() => db.query("select public.indicadores_calcular('2026-11-01')")))));
ok("ind-19 (195b) Almacén no corre la detección", /sólo los de PrintFlow/.test((await como(BODEGA, () => intenta(() => db.query("select public.nc_detectar()")))) || ""));
ok("ind-20 (195b) Noemí sí (la app, al abrir la lista)", (await como(NOEMI, () => intenta(() => db.query("select public.nc_detectar()")))) === null);
ok("ind-21 (195b) el trabajo de cada noche (sin sesión) sí", (await intenta(() => db.query("select public.nc_detectar()"))) === null);
// (Central) la rama de «sin sesión» es segura sólo porque anon no la ejecuta: que lo amarre una prueba
ok("ind-22 (195b) sin sesión (anon) no puede ejecutar nc_detectar", (await q("select has_function_privilege('anon', 'public.nc_detectar()', 'execute') x"))[0].x === false && (await q("select has_function_privilege('authenticated', 'public.indicadores_calcular(date)', 'execute') x"))[0].x === false);
console.log(fallas.length ? `ENSAYO CON ${fallas.length} FALLAS` : "ENSAYO OK");
console.log("TERMINO-ENSAYO");
