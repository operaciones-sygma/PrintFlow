// El ensayo del paso 4 en una base de mentira (PGlite), para repetirlo cuantas veces haga falta sin tocar nada: las cuentas y las funciones que deciden los permisos,
// copiadas de producción el 6-nov-2026. Lo que manda es el ensayo contra la base de verdad (paso4_ensayo.sql por execute_sql); esto sirve para sabotearlo, y para ver
// en segundos si un cambio al paquete sigue en pie.
//   node docs/una-sola-cuenta/ensayar-local.mjs [archivo.sql]     por omisión, paso4_ensayo.sql; dice ENSAYO OK o ENSAYO CON n FALLAS, y termina con TERMINO-ENSAYO
// PGlite viene de ../sygma-almacen/node_modules. La revisión de huellas (la primera pieza) se salta aquí: pg_get_functiondef de PGlite no da lo mismo que producción.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ALMACEN = process.env.REPO_ALMACEN || path.resolve(AQUI, '..', '..', '..', 'sygma-almacen');
const { PGlite } = await import(pathToFileURL(path.join(ALMACEN, 'node_modules', '@electric-sql', 'pglite', 'dist', 'index.js')).href);

const ESQUEMA = String.raw`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema cobranza; create schema almacen;
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;

create table auth.users (id uuid primary key, email text unique, last_sign_in_at timestamptz, banned_until timestamptz, updated_at timestamptz);
create table auth.identities (user_id uuid references auth.users on delete cascade, provider text not null, provider_id text not null, identity_data jsonb not null,
  email text generated always as (lower(identity_data ->> 'email')) stored, updated_at timestamptz);
create table auth.sessions (user_id uuid references auth.users on delete cascade, created_at timestamptz, updated_at timestamptz);
create table public.users (id uuid primary key default gen_random_uuid(), username text unique not null, role text not null, display_name text not null, active boolean default true, user_id uuid references auth.users on delete set null);
create unique index users_user_id_uniq on public.users (user_id) where user_id is not null;
create table cobranza.users (id uuid primary key references auth.users on delete cascade, username text not null, display_name text, role text not null, active boolean not null default true);
create table almacen.cuentas_externas (uid uuid primary key references auth.users on delete cascade, rol text not null, nombre text not null, activa boolean not null default true);
create table almacen.areas (clave text primary key, encargado text, orden int);
create table public.orders (id text primary key, created_by text, agent text, client_agent text, created_by_uid uuid, purchase_order_id text);
create table cobranza.preguntas (id uuid primary key default gen_random_uuid(), clave text unique, para text[] not null, prioridad int, contexto text, titulo text not null, pregunta text not null,
  por_que_importa text, opciones text[], creada_por text, respondida_por uuid);
create table almacen.requisiciones (id uuid primary key default gen_random_uuid(), folio text not null default 'R', solicitante text not null default 'x', solicitante_uid uuid);

-- Las funciones de producción, el 6-nov-2026
create function cobranza.current_user_role() returns text language sql stable security definer set search_path to 'cobranza', 'public', 'pg_temp' as $f$
  SELECT role FROM cobranza.users WHERE id = auth.uid() AND active = true LIMIT 1;
$f$;
create function cobranza.is_admin_role() returns boolean language sql stable security definer set search_path to 'cobranza', 'public', 'pg_temp' as $f$
  SELECT COALESCE(cobranza.current_user_role() IN ('direccion','tesoreria','cxc','contabilidad'), false);
$f$;
create function cobranza.is_internal_employee() returns boolean language sql stable security definer set search_path to 'cobranza', 'public', 'pg_temp' as $f$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM cobranza.users u  WHERE u.id = auth.uid()      AND u.active)
    OR EXISTS (SELECT 1 FROM public.users pu WHERE pu.user_id = auth.uid() AND pu.active)
  );
$f$;
create function public.get_user_session(p_username text) returns table(username text, role text, display_name text, active boolean) language plpgsql stable security definer set search_path to 'public', 'cobranza', 'pg_temp' as $f$
BEGIN
  IF NOT cobranza.is_internal_employee() THEN
    RAISE EXCEPTION 'Acceso restringido a personal interno' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT u.username, u.role, u.display_name, u.active FROM public.users u WHERE u.username = p_username AND u.active = true LIMIT 1;
END;
$f$;
create function public.pf_uid_role() returns text language sql stable security definer set search_path to 'public', 'cobranza', 'pg_temp' as $f$
  SELECT COALESCE(
    (SELECT role FROM public.users WHERE user_id = auth.uid() AND active = true LIMIT 1),
    (SELECT 'vendedor' FROM cobranza.users WHERE id = auth.uid() AND active = true AND role = 'vendedor' LIMIT 1)
  )
$f$;
create function public.pf_uid_username() returns text language sql stable security definer set search_path to 'public', 'cobranza', 'pg_temp' as $f$
  SELECT COALESCE(
    (SELECT username FROM public.users   WHERE user_id = auth.uid() AND active = true LIMIT 1),
    (SELECT username FROM cobranza.users WHERE id      = auth.uid() AND active = true LIMIT 1)
  )
$f$;
create function public.pf_puede_escribir() returns boolean language sql stable security definer set search_path to 'public', 'cobranza', 'pg_temp' as $f$
  SELECT COALESCE(cobranza.is_internal_employee() AND public.pf_uid_role() IN ('admin','karla','secretaria','vendedor','produccion','preprensa','german'), false)
$f$;
create function public.verify_actor_role(p_actor text, p_allowed_roles text[]) returns text language plpgsql stable security definer set search_path to 'public', 'cobranza', 'pg_temp' as $f$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF p_allowed_roles IS NULL OR array_length(p_allowed_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'Lista de roles permitidos vacía (programmer error)' USING ERRCODE='42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida: inicia sesión para realizar esta operación.' USING ERRCODE='42501';
  END IF;
  SELECT role INTO v_role FROM public.users WHERE user_id = v_uid AND active = true LIMIT 1;
  IF v_role IS NULL THEN
    SELECT CASE role WHEN 'direccion' THEN 'admin' WHEN 'cxc' THEN 'karla' WHEN 'vendedor' THEN 'vendedor_cbf' ELSE role END
      INTO v_role FROM cobranza.users WHERE id = v_uid AND active = true LIMIT 1;
  END IF;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Sesión autenticada sin rol asignado (uid %). Contacta al administrador.', v_uid USING ERRCODE='42501';
  END IF;
  IF NOT (v_role = ANY(p_allowed_roles)) THEN
    RAISE EXCEPTION 'Actor (rol: %) no autorizado. Permitidos: %', v_role, array_to_string(p_allowed_roles, ', ') USING ERRCODE='42501';
  END IF;
  RETURN v_role;
END$f$;
create function public.pf_visible_order_ids() returns setof text language sql stable security definer set search_path to 'public', 'cobranza', 'pg_temp' as $f$
  SELECT o.id FROM public.orders o
   WHERE (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()) AND u.active) OR EXISTS (SELECT 1 FROM cobranza.users c WHERE c.id = (SELECT auth.uid()) AND c.active))
   AND ((SELECT public.pf_uid_role()) IS DISTINCT FROM 'vendedor'
     OR lower(o.created_by) = lower((SELECT public.pf_uid_username())) OR lower(o.agent) = lower((SELECT public.pf_uid_username()))
     OR lower(o.client_agent) = lower((SELECT public.pf_uid_username())) OR o.created_by_uid = (SELECT auth.uid()))
$f$;
create function public.pf_oc_ids_propias() returns setof text language sql stable security definer set search_path to 'public', 'cobranza', 'pg_temp' as $f$
  SELECT DISTINCT o.purchase_order_id FROM public.orders o
   WHERE o.purchase_order_id IS NOT NULL
     AND (lower(o.created_by) = lower((SELECT public.pf_uid_username())) OR lower(o.agent) = lower((SELECT public.pf_uid_username()))
       OR lower(o.client_agent) = lower((SELECT public.pf_uid_username())) OR o.created_by_uid = (SELECT auth.uid()))
$f$;
create function almacen.mi_perfil() returns table(username text, rol text, nombre text) language sql stable security definer set search_path to 'public', 'pg_temp' as $f$
  (select u.username, u.role, coalesce(u.display_name, u.username)
     from public.users u
    where u.user_id = auth.uid() and u.active = true
    limit 1)
  union all
  (select split_part(au.email, '@', 1), e.rol, e.nombre
     from almacen.cuentas_externas e
     join auth.users au on au.id = e.uid
    where e.uid = auth.uid() and e.activa
      and not exists (select 1 from public.users u2 where u2.user_id = auth.uid() and u2.active = true)
    limit 1)
$f$;
create function almacen._rol_efectivo() returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $f$
  select coalesce(public.pf_uid_role(), (select e.rol from almacen.cuentas_externas e where e.uid = auth.uid() and e.activa limit 1))
$f$;
create function almacen.quien() returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $f$
  select coalesce(
    (select coalesce(display_name, username) from public.users where user_id = auth.uid() and active = true limit 1),
    (select e.nombre from almacen.cuentas_externas e where e.uid = auth.uid() and e.activa limit 1),
    'sistema')
$f$;
create function almacen._mi_usuario() returns text language sql stable security definer set search_path to '' as $f$ select (select p.username from almacen.mi_perfil() p limit 1) $f$;
create function almacen._mi_area() returns text language sql stable security definer set search_path to '' as $f$ select coalesce(
    (select a.clave from almacen.areas a where a.encargado = almacen._mi_usuario() order by a.orden, a.clave limit 1),
    case almacen._rol_efectivo()
      when 'german' then 'preprensa'    when 'preprensa' then 'preprensa'  when 'produccion' then 'produccion'
      when 'secretaria' then 'oficina'  when 'karla' then 'oficina'        when 'vendedor' then 'ventas'
      when 'almacen' then 'almacen'
    end) $f$;
create function almacen.es_empleado() returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $f$ select coalesce(almacen._rol_efectivo() is not null, false) $f$;
create function almacen.puede_administrar() returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $f$ select coalesce(almacen._rol_efectivo() in ('admin', 'tesoreria', 'almacen'), false) $f$;
create function almacen.puede_comprar() returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $f$ select coalesce(almacen._rol_efectivo() in ('admin', 'tesoreria'), false) $f$;
create function almacen.es_direccion() returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $f$ select coalesce(almacen._rol_efectivo() = 'admin', false) $f$;
create function almacen.puede_ver_corte() returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $f$ select coalesce(almacen._rol_efectivo() in ('admin', 'tesoreria', 'contabilidad'), false) $f$;

-- Las cuentas, como el 6-nov-2026 (sin contraseñas: aquí nadie entra)
insert into auth.users (id, email, last_sign_in_at) values
  ('4bdf6010-65a8-490b-a815-37e89dc17940', 'arturo@padillahnos.local', '2026-11-03'),
  ('1c1ba04c-9195-4579-9b4d-a0a2366e07e9', 'gerardo@padillahnos.local', '2026-11-05'),
  ('f9fc2b18-3dbb-422a-a9cb-70ca03bf170b', 'german@padillahnos.local', '2026-10-21'),
  ('ac0a8997-c507-48cb-ba2e-5ea77ea4b27b', 'noemi@padillahnos.local', '2026-07-06'),
  ('e5bff9c2-2c81-4a5b-8dac-a1d4ee778c3e', 'karla@padillahnos.local', '2026-08-18'),
  ('06072388-3784-4a5b-b9a8-ad0437ef3311', 'karla@sygma.mx', '2026-10-02'),
  ('f321f84b-582b-4ee8-9ee1-9a3138654f5c', 'genaro@padillahnos.local', '2026-07-06'),
  ('76714606-59a6-42e3-8d1c-49ebb52bb2a9', 'genaro@sygma.mx', '2026-10-08'),
  ('0ec50922-b1bb-4666-a09f-738242c2255e', 'dulce@padillahnos.local', '2026-08-17'),
  ('6029dd6f-9122-4eeb-99e5-a06554dd0445', 'dulce@sygma.mx', '2026-08-17'),
  ('6b85fba8-383f-495c-ae4a-8cf5858c4a15', 'secretaria@padillahnos.local', '2026-11-04'),
  ('0c2a10ee-9341-4a12-ae5c-2d46d36e63ed', 'lupita@sygma.mx', '2026-10-02'),
  ('80fa4231-bff6-4e14-9943-6cc5a418c481', 'admin@padillahnos.local', '2026-11-06'),
  ('6f68a403-e726-453a-a1ad-599734a56728', 'marcelo@sygma.mx', '2026-10-19'),
  ('a87ef072-2b56-4fdc-8dd3-59ff7b25f8fd', 'lucero@sygma.mx', '2026-11-06');
insert into auth.identities (user_id, provider, provider_id, identity_data)
  select id, 'email', id::text, jsonb_build_object('email', email, 'sub', id::text) from auth.users where email <> 'lupita@sygma.mx';   -- la de Lupita no tiene (medido)
insert into public.users (username, role, display_name, user_id) values
  ('admin', 'admin', 'Administrador', '80fa4231-bff6-4e14-9943-6cc5a418c481'),
  ('arturo', 'almacen', 'Arturo', '4bdf6010-65a8-490b-a815-37e89dc17940'),
  ('dulce', 'visor', 'Dulce', '0ec50922-b1bb-4666-a09f-738242c2255e'),
  ('genaro', 'vendedor', 'Genaro', 'f321f84b-582b-4ee8-9ee1-9a3138654f5c'),
  ('gerardo', 'produccion', 'Gerardo', '1c1ba04c-9195-4579-9b4d-a0a2366e07e9'),
  ('german', 'german', 'Germán', 'f9fc2b18-3dbb-422a-a9cb-70ca03bf170b'),
  ('karla', 'karla', 'Karla', 'e5bff9c2-2c81-4a5b-8dac-a1d4ee778c3e'),
  ('noemi', 'preprensa', 'Noemí', 'ac0a8997-c507-48cb-ba2e-5ea77ea4b27b'),
  ('secretaria', 'secretaria', 'Lupita', '6b85fba8-383f-495c-ae4a-8cf5858c4a15');
insert into cobranza.users (id, username, display_name, role) values
  ('6029dd6f-9122-4eeb-99e5-a06554dd0445', 'dulce', 'Dulce', 'contabilidad'),
  ('76714606-59a6-42e3-8d1c-49ebb52bb2a9', 'genaro', 'Genaro Mendez', 'vendedor'),
  ('06072388-3784-4a5b-b9a8-ad0437ef3311', 'karla', 'Karla', 'cxc'),
  ('a87ef072-2b56-4fdc-8dd3-59ff7b25f8fd', 'lucero', 'Lucero', 'tesoreria'),
  ('0c2a10ee-9341-4a12-ae5c-2d46d36e63ed', 'lupita', 'Lupita', 'vendedor'),
  ('6f68a403-e726-453a-a1ad-599734a56728', 'marcelo', 'Marcelo Padilla', 'direccion');
insert into almacen.cuentas_externas (uid, rol, nombre) values
  ('6029dd6f-9122-4eeb-99e5-a06554dd0445', 'contabilidad', 'Dulce'),
  ('a87ef072-2b56-4fdc-8dd3-59ff7b25f8fd', 'tesoreria', 'Lucero'),
  ('6f68a403-e726-453a-a1ad-599734a56728', 'admin', 'Marcelo');
insert into almacen.areas (clave, encargado, orden) values ('preprensa', 'german', 1), ('diseno', 'noemi', 2), ('produccion', 'gerardo', 3), ('oficina', 'secretaria', 5), ('ventas', 'genaro', 6), ('almacen', 'arturo', 10);
insert into public.orders (id, created_by, agent, client_agent, created_by_uid, purchase_order_id) values
  ('OP-1', 'genaro', null, null, 'f321f84b-582b-4ee8-9ee1-9a3138654f5c', 'OC-1'),
  ('OP-2', 'secretaria', 'genaro', null, '6b85fba8-383f-495c-ae4a-8cf5858c4a15', 'OC-2'),
  ('OP-3', 'secretaria', 'Pepe Chuy', null, '6b85fba8-383f-495c-ae4a-8cf5858c4a15', 'OC-3'),
  ('OP-4', 'admin', null, null, '80fa4231-bff6-4e14-9943-6cc5a418c481', null);
`;

const archivo = process.argv[2] || path.join(AQUI, 'paso4_ensayo.sql');
const ensayo = fs.readFileSync(archivo, 'utf8').replace(/execute \$pieza0\$[\s\S]*?\$pieza0\$;/, '');
const db = new PGlite();
await db.exec(ESQUEMA);
let mensaje;
try {
  await db.exec(ensayo);
  mensaje = 'el ensayo no tronó: se habría quedado aplicado';
} catch (e) {
  mensaje = String(e.message);
}
console.log(process.env.ENSAYO_COMPLETO ? mensaje : mensaje.slice(0, 1600));
await db.close();
console.log('TERMINO-ENSAYO');
process.exit(0);
