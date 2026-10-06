-- v10.84.41 (5-oct-2026) — «Archivos» vuelve a calcular el almacenamiento, y la BASE dice qué archivo usa una orden.
--
-- Lo encontró el recorrido (v10.84.36): la pantalla listaba el bucket con storage.list("", {limit: 1000}) y eso contesta
-- 544 DatabaseTimeout a los 30 s, siempre (663 carpetas; el listado de Storage con la policy por renglón crece más que
-- lineal: 50 renglones 0.9 s, 100 2.5 s, 200 8.6 s). Después pedía una lista por carpeta. v10.84.36 dejó la pantalla
-- diciendo «Error» en vez de «0 MB»; esto la arregla.
--
-- public.pf_archivos_del_bucket(): los archivos de order-files en UNA consulta (ruta, tamaño, cuándo se subió) y si alguna
-- orden lo usa. ⚠ Arreglar el listado vuelve a armar «Limpiar huérfanos», así que «huérfano» lo decide la base:
--   · contra TODAS las órdenes (no sólo las que cargó la pantalla), en sus tres columnas (file_url, image_url,
--     image_url_2), con la ruta decodificada (%20…) como hace la pantalla;
--   · un archivo de menos de UN DÍA nunca es huérfano: es la foto de una orden que alguien está capturando (se sube antes
--     de guardar la orden) y hoy la limpieza se la llevaría.
-- Medido el 5-oct: 759 archivos (111 MB), 739 usados, 20 sin orden (4.9 MB: 15 de «replica», 3 subidas de órdenes que no
-- se guardaron), ninguno de los últimos 2 días. Las rutas también aparecen en order_change_log (el historial de cambios):
-- eso no es una referencia viva, como ya lo trataba la pantalla.
-- Sólo la ven admin, preprensa y german (los que tienen la pantalla). La lectura de Storage ya se la permite la RLS.

create or replace function public.pf_url_decode(p text)
 returns text
 language plpgsql
 immutable
 set search_path to 'pg_catalog', 'pg_temp'
as $function$
-- Decodifica %XX (UTF-8) como decodeURIComponent. Si algo no cuadra, regresa el texto tal cual.
declare r bytea := ''::bytea; i int := 1; n int; c text;
begin
  if p is null or position('%' in p) = 0 then return p; end if;
  n := length(p);
  while i <= n loop
    c := substr(p, i, 1);
    if c = '%' and i + 2 <= n and substr(p, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' then
      r := r || decode(substr(p, i + 1, 2), 'hex'); i := i + 3;
    else
      r := r || convert_to(c, 'UTF8'); i := i + 1;
    end if;
  end loop;
  return convert_from(r, 'UTF8');
exception when others then
  return p;
end $function$;
revoke all on function public.pf_url_decode(text) from public, anon, authenticated;

create or replace function public.pf_archivos_del_bucket()
 returns table (ruta text, tamano bigint, creado timestamptz, referenciado boolean)
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'cobranza', 'storage', 'pg_temp'
as $function$
begin
  -- COALESCE: un rol NULL no abre.
  if not cobranza.is_internal_employee() or coalesce(public.pf_uid_role(), '') not in ('admin', 'preprensa', 'german') then
    raise exception 'Los archivos del bucket sólo los ven admin, preprensa y german' using errcode = '42501';
  end if;
  return query
  with refs as (
    select distinct public.pf_url_decode(split_part(split_part(u, '/order-files/', 2), '?', 1)) as r
      from public.orders o, lateral unnest(array[o.file_url, o.image_url, o.image_url_2]) as u
     where u like '%/order-files/%'
  )
  select s.name::text,
         coalesce((s.metadata->>'size')::bigint, 0),
         s.created_at,
         exists (select 1 from refs where refs.r = s.name) or s.created_at > now() - interval '1 day'
    from storage.objects s
   where s.bucket_id = 'order-files'
   order by s.name;
end $function$;
revoke all on function public.pf_archivos_del_bucket() from public, anon;
grant execute on function public.pf_archivos_del_bucket() to authenticated;
comment on function public.pf_archivos_del_bucket() is
  'Los archivos de order-files para la pantalla «Archivos» (admin, preprensa, german): ruta, tamaño, cuándo se subió y si una orden lo usa (todas las órdenes, tres columnas; lo de menos de un día cuenta como usado). v10.84.41';
