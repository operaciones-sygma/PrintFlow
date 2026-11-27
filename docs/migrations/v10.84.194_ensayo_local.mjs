// Ensayo local (PGlite) de v10.84.194_no_conformidades.sql: una base de mentira con lo que la migración usa, las funciones de permisos copiadas de producción
// (27-nov-2026), y pruebas que afirman lo que DEBERÍA pasar. Uso: node ensayar-nc.mjs [migración.sql] → ENSAYO OK o las fallas.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ALMACEN = process.env.REPO_ALMACEN || path.resolve(AQUI, "..", "..", "..", "sygma-almacen");   // PGlite viene de ../sygma-almacen/node_modules
const { PGlite } = await import(pathToFileURL(path.join(ALMACEN, "node_modules", "@electric-sql", "pglite", "dist", "index.js")).href);
const MIG = (t => t.replace(/^set local (statement|lock)_timeout.*$/gm, ""))(fs.readFileSync(process.argv[2] || path.join(AQUI, "v10.84.194_no_conformidades.sql"), "utf8"));

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
create table cron.job (jobid bigserial, jobname text, schedule text, command text);   -- como el de pg_cron
create view cron.jobs as select jobname nombre, schedule cuando, command que from cron.job;
create function cron.schedule(n text, c text, q text) returns bigint language sql as $$ insert into cron.job (jobname, schedule, command) values (n, c, q) returning jobid $$;
grant usage on schema public, cobranza to authenticated, anon;
insert into public.users (username, role, user_id) values ('preprensa', 'preprensa', '00000000-0000-4000-8000-000000000001'), ('admin', 'admin', '00000000-0000-4000-8000-000000000002'),
  ('visor', 'visor', '00000000-0000-4000-8000-000000000003'), ('bodega', 'almacen', '00000000-0000-4000-8000-000000000004'), ('german', 'german', '00000000-0000-4000-8000-000000000005');
-- lo que nc_detectar debe encontrar (desde el 1-nov) y lo que no
insert into public.orders values
  ('OP-1', 'P-0001', 'A', 'A', 'delivered', null, '2026-11-10', '2026-11-13 18:00-06', null, null),          -- tarde: lista el 12 (después del 10)
  ('OP-2', 'P-0002', 'B', 'B', 'delivered', null, '2026-11-10', '2026-11-13 18:00-06', null, null),          -- entregada tarde, pero LISTA a tiempo (el 10): no
  ('OP-3', 'P-0003', 'C', 'C', 'delivered', null, '2026-11-20', '2026-11-19 12:00-06', null, null),          -- a tiempo: no
  ('OP-4', 'P-0004', 'D', 'D', 'delivered', null, '2026-10-01', '2026-10-05 12:00-06', null, null),          -- tarde, pero antes del 1-nov: no
  ('OP-5', 'P-0005', 'E', 'E', 'delivered', 'stock', '2026-11-01', '2026-11-12 12:00-06', null, null),       -- venta de inventario: no
  ('OP-6', 'P-0006', 'F', 'F', 'delivered', null, '2026-11-11', '2026-11-12 09:00-06', '2026-11-14 10:00-06', 'Corte chueco'),   -- tarde Y devuelta: las dos
  ('OP-7', 'P-0007', 'G', 'G', 'delivered', null, '2026-11-11', '2026-11-11 23:59-06', null, null),          -- el último minuto de su día: a tiempo
  ('OP-8', 'P-0008', 'H', 'H', 'in_production', null, '2026-11-11', null, null, null);                       -- vencida, sin entregar: todavía no
insert into public.order_timeline (order_id, action, created_at, to_stage) values
  ('OP-1', '⚙️ Máquina → 📤 Salidas', '2026-11-12 10:00-06', 'salidas'),
  ('OP-2', '⚙️ Máquina → 📤 Salidas', '2026-11-10 17:00-06', 'salidas'),
  ('OP-8', '↩️ Regresada de 💿 CTP → 🎨 Diseño · Razón: ERROR DE DISEÑO', '2026-11-20 10:00-06', 'design'),
  ('OP-8', '↩️ Regresada de 💿 CTP → 👤 Aprobación · Razón: ya hay placas', '2026-10-20 10:00-06', 'proof_client'),   -- antes del 1-nov: no
  ('OP-3', '🔄 Devuelta a Lista (desde off_pm52)', '2026-11-18 10:00-06', 'ready');                                 -- de máquina a la Lista: no es regreso
`;

const db = new PGlite();
await db.exec(ESQUEMA);
await db.exec(MIG);
const fallas = [];
const ok = (n, c, x = "") => { if (!c) fallas.push(n + (x ? " · " + x : "")); console.log((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : "")); };
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const como = async (uid, fn) => { await db.exec("begin"); await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid })]); await db.exec("set local role authenticated");
  try { return await fn(); } finally { await db.exec("rollback"); } };
const intenta = async f => { try { await f(); return null; } catch (e) { return e.message; } };
const NOEMI = "00000000-0000-4000-8000-000000000001", MARCELO = "00000000-0000-4000-8000-000000000002", VISOR = "00000000-0000-4000-8000-000000000003", BODEGA = "00000000-0000-4000-8000-000000000004", GERMAN = "00000000-0000-4000-8000-000000000005";

// al aplicar, lo de hoy ya entró
const todas = await q("select origen, clave, order_id, que_paso, es_no_conformidad from public.no_conformidades order by clave");
const claves = todas.map(r => r.clave);
ok("nc-01 detecta lo de desde el 1-nov", claves.join() === ["devolucion:OP-6", "regreso:3", "tarde:OP-1", "tarde:OP-6"].join(), claves.join());
ok("nc-02 lo detectado nace por revisar", todas.every(r => r.es_no_conformidad === null), JSON.stringify(todas.map(r => r.es_no_conformidad)));
ok("nc-03 dice qué pasó, en palabras", /P-0001 se entregó tarde: su día era el 10-11-2026, quedó lista el 12-11-2026 y se entregó el 13-11-2026/.test(todas.find(r => r.clave === "tarde:OP-1")?.que_paso || "") && /Devolución de P-0006: Corte chueco/.test(todas.find(r => r.clave === "devolucion:OP-6")?.que_paso || "") && /P-0008: ↩️ Regresada de 💿 CTP → 🎨 Diseño · Razón: ERROR DE DISEÑO/.test(todas.find(r => r.clave === "regreso:3")?.que_paso || ""), JSON.stringify(todas.map(r => r.que_paso)));
ok("nc-04 otra vez no repite", (await q("select public.nc_detectar() n"))[0].n === 0);
ok("nc-05 el trabajo de cada noche quedó", (await q("select count(*)::int n from cron.jobs where nombre = 'printflow-nc-detectar' and cuando = '15 6 * * *'"))[0].n === 1);
const folios = (await q("select folio from public.no_conformidades order by folio")).map(r => r.folio);
ok("nc-06 folios NC-0001 en adelante", folios.join() === "NC-0001,NC-0002,NC-0003,NC-0004", folios.join());

// quién ve
ok("nc-10 Noemí ve las 4", (await como(NOEMI, () => q("select count(*)::int n from public.no_conformidades")))[0].n === 4);
ok("nc-11 la bodega (Almacén) no ve ninguna", (await como(BODEGA, () => q("select count(*)::int n from public.no_conformidades")))[0].n === 0);
ok("nc-12 sin sesión (anon) no ve nada", (await (async () => { await db.exec("begin"); await db.exec("set local role anon"); try { return await intenta(() => db.query("select count(*) from public.no_conformidades")); } finally { await db.exec("rollback"); } })()) !== null);
ok("nc-13 el visor ve, no escribe", (await como(VISOR, async () => { const v = (await q("select count(*)::int n from public.no_conformidades"))[0].n; const e = await intenta(() => db.query("insert into public.no_conformidades (origen, que_paso) values ('queja', 'No le gustó el color')")); return v === 4 && !!e; })));

// anotar a mano
const anotada = await como(NOEMI, async () => { await db.query("insert into public.no_conformidades (origen, que_paso, cliente, canal) values ('queja', 'El cliente dice que el rojo salió naranja', 'A', 'whatsapp')"); return (await q("select * from public.no_conformidades where origen = 'queja'"))[0]; });
ok("nc-20 Noemí anota una queja y queda a su nombre, como no conformidad", anotada?.creada_por === "preprensa" && anotada?.es_no_conformidad === true && anotada?.folio === "NC-0005", JSON.stringify(anotada));
// (se deshizo con la transacción: el folio se libera, el siguiente vuelve a ser NC-0005)
ok("nc-21 a mano no se puede anotar un regreso (eso lo detecta la base)", !!(await como(NOEMI, () => intenta(() => db.query("insert into public.no_conformidades (origen, clave, que_paso) values ('regreso', 'regreso:999', 'inventado')")))));
ok("nc-22 Germán (CTP) no anota", !!(await como(GERMAN, () => intenta(() => db.query("insert into public.no_conformidades (origen, que_paso) values ('queja', 'algo')")))));
ok("nc-23 sin qué pasó no entra", !!(await intenta(() => db.query("insert into public.no_conformidades (origen, que_paso) values ('queja', '  ')"))));
ok("nc-24 un canal que no existe no entra", !!(await intenta(() => db.query("insert into public.no_conformidades (origen, que_paso, canal) values ('queja', 'algo pasó', 'fax')"))));

// atenderla
const atendida = await como(MARCELO, async () => {
  await db.query("update public.no_conformidades set causa = 'El archivo venía en RGB', que_se_hizo = 'Se reimprimió con el perfil correcto' where clave = 'tarde:OP-1'");
  await db.query("update public.no_conformidades set funciono = true where clave = 'tarde:OP-1'");
  await db.query("update public.no_conformidades set folio = 'NC-9999', origen = 'queja', order_id = 'OP-2', ocurrio_en = now(), creada_por = 'otro', historial = '[]' where clave = 'tarde:OP-1'");
  return (await q("select * from public.no_conformidades where clave = 'tarde:OP-1'"))[0];
});
ok("nc-30 la causa, lo que se hizo y si funcionó quedan, con quién", atendida?.causa === "El archivo venía en RGB" && atendida?.funciono === true && atendida?.cambiada_por === "admin", JSON.stringify(atendida));
ok("nc-31 el historial guarda cada cambio con antes y después", Array.isArray(atendida?.historial) && atendida.historial.length === 2 && atendida.historial[0].por === "admin" && JSON.stringify(atendida.historial[0].cambios.causa) === JSON.stringify([null, "El archivo venía en RGB"]) && JSON.stringify(atendida.historial[1].cambios.funciono) === JSON.stringify([null, true]), JSON.stringify(atendida?.historial));
ok("nc-32 lo que no cambia, no cambia (folio, origen, orden, cuándo, quién la creó, el historial)", atendida?.folio !== "NC-9999" && atendida?.origen === "entrega_tarde" && atendida?.order_id === "OP-1" && atendida?.creada_por !== "otro" && atendida?.historial.length === 2, JSON.stringify({ folio: atendida?.folio, origen: atendida?.origen, order_id: atendida?.order_id, creada_por: atendida?.creada_por }));
ok("nc-33 «no es no conformidad» pide su porqué", !!(await como(MARCELO, () => intenta(() => db.query("update public.no_conformidades set es_no_conformidad = false where clave = 'regreso:3'")))));
ok("nc-34 con su porqué, sí", !(await como(MARCELO, () => intenta(() => db.query("update public.no_conformidades set es_no_conformidad = false, por_que_no = 'Fue de ruta: ya había placas' where clave = 'regreso:3'")))));
ok("nc-35 «funcionó» sin decir qué se hizo no entra", !!(await como(MARCELO, () => intenta(() => db.query("update public.no_conformidades set funciono = true where clave = 'devolucion:OP-6'")))));
ok("nc-36 un guardado sin cambios no ensucia el historial", (await como(MARCELO, async () => { await db.query("update public.no_conformidades set causa = causa where clave = 'devolucion:OP-6'"); return (await q("select jsonb_array_length(historial) n, cambiada_por from public.no_conformidades where clave = 'devolucion:OP-6'"))[0]; })).n === 0);
ok("nc-37 Germán no atiende", (await como(GERMAN, async () => { await db.query("update public.no_conformidades set causa = 'x' where clave = 'devolucion:OP-6'"); return (await q("select count(*)::int n from public.no_conformidades where causa = 'x'"))[0].n; })) === 0);
ok("nc-38 nadie borra", !!(await como(MARCELO, () => intenta(() => db.query("delete from public.no_conformidades where clave = 'devolucion:OP-6'")))));
ok("nc-39 nc_detectar no la puede llamar anon", !!(await (async () => { await db.exec("begin"); await db.exec("set local role anon"); try { return await intenta(() => db.query("select public.nc_detectar()")); } finally { await db.exec("rollback"); } })()));

// los folios sin huecos: lo que falla y lo que ya estaba no gastan número
await intenta(() => db.query("insert into public.no_conformidades (origen, que_paso) values ('queja', '  ')"));
await q("select public.nc_detectar()"); await q("select public.nc_detectar()");
const sig = await como(NOEMI, async () => { await db.query("insert into public.no_conformidades (origen, que_paso) values ('otra', 'Se imprimió con la tinta equivocada')"); return (await q("select folio from public.no_conformidades where origen = 'otra'"))[0]?.folio; });
ok("nc-40 sin huecos: lo que falla, lo que ya estaba y lo que se deshace no gastan folio", sig === "NC-0005", sig);
ok("nc-41 el contador no lo ve ni lo escribe nadie de la app", !!(await como(MARCELO, () => intenta(() => db.query("update public.no_conformidades_contador set n = 0")))));
console.log(fallas.length ? `ENSAYO CON ${fallas.length} FALLAS` : "ENSAYO OK");
console.log("TERMINO-ENSAYO");
