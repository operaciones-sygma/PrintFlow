-- v10.84.38 (5-oct-2026) — Las vistas del CTP que lee SygmaAlmacen dejan de contar repetidos.
--
-- El colector de Prinect escribe la misma placa física varias veces en almacen.ctp_placas (un renglón por etapa del
-- flujo) y muchos errores dos veces en almacen.ctp_errores (tags FE y SE, mismo momento y mismo texto). En septiembre
-- (v10.81.4-5) se arreglaron el contador de Germán en PrintFlow y el resumen de placas (v_ctp_placas, v_ctp_fallas), pero
-- tres cosas que lee la pantalla CTP de SygmaAlmacen siguieron contando lo crudo. Medido el 5-oct:
--   · v_ctp_placas_dia (placas por día): 282 placas en 30 días contra 259 reales (+9%), y agrupaba por fecha UTC: lo
--     expuesto después de las 18:00 caía en el día siguiente.
--   · v_ctp_errores_top (errores por código): 1,076 «veces» en 120 días contra 839 eventos (+28%).
--   · v_ctp_resumen.errores_hoy / errores_semana: contaban los dos renglones de un mismo error.
-- Marcelo: «sí, corrígelas».
--
-- 1. almacen.v_ctp_errores (nueva): UN renglón por evento del equipo (hostname, código, momento), como v_ctp_placas lo es
--    por placa. Medido: un evento llega una vez (FE o SE) o dos (FE+SE con el mismo texto); nunca más.
-- 2. v_ctp_placas_dia: desde v_ctp_placas, por día de México.
-- 3. v_ctp_errores_top: desde v_ctp_errores.
-- 4. v_ctp_resumen: errores_hoy, errores_semana y ultimo_error_at desde v_ctp_errores; todo lo demás, igual.
--    Desde aquí, las tablas crudas del colector SÓLO las leen las vistas que deduplican (v_ctp_placas, v_ctp_errores,
--    v_ctp_fallas); lo vigila PrintFlow tests/romper/ctp.mjs en cada subida.
-- 5. Las policies de lectura de ctp_placas, ctp_errores y ctp_estado evalúan es_empleado() UNA vez por consulta
--    ((SELECT …) = initplan) y no una por renglón; mismo resultado.
--
-- ⚠ CREATE OR REPLACE VIEW pierde security_invoker si no se repite el WITH (regla 6 de CobranzaFlow): va en las cuatro.

create view almacen.v_ctp_errores with (security_invoker = true) as
select distinct on (hostname, codigo, ocurrio_at)
       id, hostname, ocurrio_at, codigo, clase, texto, tag, es_error
  from almacen.ctp_errores
 order by hostname, codigo, ocurrio_at, tag;
revoke all on almacen.v_ctp_errores from public, anon;
grant select on almacen.v_ctp_errores to authenticated;
comment on view almacen.v_ctp_errores is
  'Un renglón por evento del CTP (hostname, codigo, ocurrio_at): el colector escribe muchos errores dos veces (FE y SE). Contar desde aquí, nunca desde ctp_errores. v10.84.38';

create or replace view almacen.v_ctp_placas_dia with (security_invoker = true) as
select (p.expuesta_at at time zone 'America/Mexico_City')::date as dia,
       count(*) as placas,
       coalesce(sum(p.m2), 0::numeric) as m2,
       count(*) filter (where p.tamano = 'chica') as chicas,
       count(*) filter (where p.tamano = 'grande') as grandes,
       count(distinct p.folio) filter (where p.folio is not null) as trabajos
  from almacen.v_ctp_placas p
 where p.expuesta_at >= now() - interval '120 days'
 group by 1
 order by 1 desc;

create or replace view almacen.v_ctp_errores_top with (security_invoker = true) as
select codigo,
       min(texto) as texto,
       count(*) as veces,
       max(ocurrio_at) as ultima,
       bool_or(es_error) as es_error
  from almacen.v_ctp_errores
 where ocurrio_at >= now() - interval '120 days'
 group by codigo
 order by bool_or(es_error) desc, count(*) desc;

create or replace view almacen.v_ctp_resumen with (security_invoker = true) as
with est as (
  select distinct on (ctp_estado.hostname) ctp_estado.hostname, ctp_estado.device, ctp_estado.total_placas,
         ctp_estado.horas, ctp_estado.horas_laser, ctp_estado.mantenimiento_pendiente, ctp_estado.medido_at,
         ctp_estado.recibido_at
    from almacen.ctp_estado
   order by ctp_estado.hostname, ctp_estado.recibido_at desc
)
select hostname, device, total_placas, horas, horas_laser, mantenimiento_pendiente, medido_at,
       recibido_at as estado_at,
       (select count(*) from almacen.v_ctp_placas p
         where (p.expuesta_at at time zone 'America/Mexico_City')::date = (now() at time zone 'America/Mexico_City')::date) as placas_hoy,
       (select count(*) from almacen.v_ctp_placas p
         where p.expuesta_at >= (date_trunc('week', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')) as placas_semana,
       (select count(*) from almacen.v_ctp_placas p
         where p.expuesta_at >= (date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')) as placas_mes,
       (select count(*) from almacen.v_ctp_placas p) as placas_registradas,
       (select coalesce(sum(p.m2), 0::numeric) from almacen.v_ctp_placas p
         where (p.expuesta_at at time zone 'America/Mexico_City')::date = (now() at time zone 'America/Mexico_City')::date) as m2_hoy,
       (select coalesce(sum(p.m2), 0::numeric) from almacen.v_ctp_placas p
         where p.expuesta_at >= (date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')) as m2_mes,
       (select coalesce(sum(p.m2), 0::numeric) from almacen.v_ctp_placas p) as m2_total,
       (select count(*) from almacen.v_ctp_errores x
         where x.es_error and (x.ocurrio_at at time zone 'America/Mexico_City')::date = (now() at time zone 'America/Mexico_City')::date) as errores_hoy,
       (select count(*) from almacen.v_ctp_errores x
         where x.es_error and x.ocurrio_at >= now() - interval '7 days') as errores_semana,
       (select max(x.ocurrio_at) from almacen.v_ctp_errores x where x.es_error) as ultimo_error_at,
       (select max(p.expuesta_at) from almacen.v_ctp_placas p) as ultima_placa_at,
       (select count(*) from almacen.v_ctp_fallas f
         where (f.ocurrio_at at time zone 'America/Mexico_City')::date = (now() at time zone 'America/Mexico_City')::date) as placas_fallidas_hoy,
       (select count(*) from almacen.v_ctp_fallas f
         where f.ocurrio_at >= (date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')) as placas_fallidas_mes,
       (select count(*) from almacen.v_ctp_fallas f) as placas_fallidas_total,
       (select max(f.ocurrio_at) from almacen.v_ctp_fallas f) as ultima_falla_at
  from est e;

alter policy ctp_placas_select on almacen.ctp_placas using ((select almacen.es_empleado()));
alter policy ctp_errores_select on almacen.ctp_errores using ((select almacen.es_empleado()));
alter policy ctp_estado_select on almacen.ctp_estado using ((select almacen.es_empleado()));
