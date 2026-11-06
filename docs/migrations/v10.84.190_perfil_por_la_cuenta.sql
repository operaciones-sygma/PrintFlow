-- v10.84.190 — EL PERFIL DE PRINTFLOW POR LA CUENTA, NO POR EL NOMBRE (Marcelo, 19-oct y 6-nov-2026: una sola cuenta nombre@sygma.mx en todas las apps;
-- el plan completo, en docs/una-sola-cuenta/LEEME.md). Es el paso 2 de 5 y NO le cambia nada a nadie.
--
-- Qué pasaba: PrintFlow buscaba el perfil con public.get_user_session(p_username), con el nombre que salía de app_metadata.username o de lo
-- escrito. Con lupita@sygma.mx buscaría «lupita», y su usuario de PrintFlow es «secretaria»: «Esta cuenta ya no está activa». Y un
-- app_metadata.username de otra persona daba el perfil de esa persona. El uid de la sesión es lo único que no depende de cómo se llame nadie.
--
--   public.get_my_session() (nueva, sin argumentos, sólo lee): el renglón de public.users de la cuenta de la sesión (auth.uid()), activo.
--   Sin sesión, sin renglón o desactivado, no contesta nada. Sólo `authenticated` y `service_role` (la regla 5; invariante 9).
--
-- Una cuenta, un solo renglón: eso ya lo rechaza la base con public.users_user_id_uniq (único, `where user_id is not null`), así que `limit 1` nunca escoge entre
-- dos. Esta migración no agrega ningún índice.
--
-- public.get_user_session(text) NO se toca ni se borra: la versión de antes de la app la sigue usando (la vuelta atrás de la 190) y sigue contestando
-- igual. Se quita cuando pase el cambio de cuentas (docs/una-sola-cuenta/LEEME.md, «Después»).
--
-- Vuelta atrás: v10.84.190_perfil_por_la_cuenta_vuelta_atras.sql, DESPUÉS de regresar la app (con la app nueva y sin esta función no entra nadie).
-- Registrar en supabase_migrations.schema_migrations como `v10_84_190_perfil_por_la_cuenta`.
begin;

create or replace function public.get_my_session()
returns table(username text, role text, display_name text, active boolean)
language sql
stable
security definer
set search_path to 'public', 'cobranza', 'pg_temp'
as $function$
  select u.username, u.role, u.display_name, u.active
    from public.users u
   where u.user_id = auth.uid() and u.active = true
   limit 1
$function$;

comment on function public.get_my_session() is
  'v10.84.190: el perfil de PrintFlow de la cuenta de la sesión (auth.uid()), no el de un nombre. Sin sesión, sin renglón o desactivado: nada.';

revoke all on function public.get_my_session() from public, anon;
grant execute on function public.get_my_session() to authenticated, service_role;

select
  has_function_privilege('anon', 'public.get_my_session()', 'execute') as anon_puede,
  has_function_privilege('authenticated', 'public.get_my_session()', 'execute') as authenticated_puede;

commit;
