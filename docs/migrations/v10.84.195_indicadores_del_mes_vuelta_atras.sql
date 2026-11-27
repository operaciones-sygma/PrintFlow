-- v10.84.195 (y 195b) — vuelta atrás de «Indicadores del mes»: quita el trabajo de cada noche, las funciones y las tablas (con los meses guardados y la revisión
-- de Dirección: se pierden; antes, si hace falta, bajarlos: select * from public.indicadores_mes order by mes). PRIMERO la app. La 195b sola no se regresa
-- (cerró dos permisos de más): si se regresa la 194, nc_detectar se va con ella.
begin;
select cron.unschedule('printflow-indicadores-mes');
drop function if exists public.indicadores_guardar(text, date);
drop function if exists public.indicadores_del_mes_en_curso();
drop function if exists public.indicadores_calcular(date);
drop table if exists public.indicadores_mes;
drop function if exists public.indicadores_mes_sellos();
drop table if exists public.metas_calidad;
commit;
