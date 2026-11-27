-- v10.84.194 — vuelta atrás de «No conformidades»: quita el trabajo de cada noche, la función que detecta, la tabla (y con ella lo anotado), su disparador y el
-- contador de folios. PRIMERO la app (sin la pantalla, nadie la lee ni la escribe). Lo anotado se pierde: antes, si hace falta, bajarlo:
--   select * from public.no_conformidades order by folio;
-- Se aplica por el editor SQL de Supabase, con el OK de Marcelo y el VOY a Central.
begin;
select cron.unschedule('printflow-nc-detectar');
drop function if exists public.nc_detectar();
drop table if exists public.no_conformidades;
drop function if exists public.no_conformidades_sellos();
drop table if exists public.no_conformidades_contador;
commit;
