-- v10.84.190 — vuelta atrás de v10.84.190_perfil_por_la_cuenta.sql. Primero la app (git revert del commit de la 190 y subir): con la app nueva y sin esta
-- función no entra nadie («No se pudo comprobar tu cuenta»). No hay datos que regresar: la función sólo lee. El índice de la tabla (users_user_id_uniq) no es de esta migración: se queda.
begin;

drop function if exists public.get_my_session();

select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_my_session') as funciones,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_user_session') as get_user_session_sigue;

commit;
