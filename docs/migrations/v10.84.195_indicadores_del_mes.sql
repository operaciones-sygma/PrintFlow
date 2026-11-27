-- (Es lo que se aplicó: 27-nov-2026 11:22:27, por la API de administración con el OK escrito de Marcelo; ensayo OK en 48 ms.)
-- v10.84.195 (27-nov-2026) — «Indicadores del mes» de PrintFlow: la evidencia de la revisión por la dirección (ISO 9001: 6.2 objetivos, 9.1.3 análisis, 9.3).
-- Decisión de Marcelo (27-nov, «Sí, cada mes»; sus metas, «las recomendadas», con entrega a tiempo 85%): el día 1 se guarda el mes que cerró con lo medido
-- (entrega a tiempo, regresos, devoluciones, quejas y merma) contra sus metas, y Dirección escribe su revisión. Tablas nuevas: se aplica con su OK escrito para ESTA.
--
-- · Cada noche (00:20 de México, como el corte de Almacén) se guarda el mes cerrado que falte desde noviembre de 2026: si una noche falla, la siguiente lo hace.
--   Lo guardado ya no cambia aunque los datos cambien: es la foto de ese día (lo que la base sabía). Antes de guardar se corre nc_detectar().
-- · Las metas viven en public.metas_calidad (una por indicador) y se copian a cada mes al guardarlo: cambiar una meta no cambia lo ya guardado.
-- · La regla de «a tiempo» es la de la app (entregadaATiempo): entregada, o LISTA, a más tardar el día de su entrega; sin la venta de inventario ni las sin fecha.
-- · Lo cuenta el mes de México (America/Mexico_City), no el de UTC.
-- · Quién: lo ve y lo revisa Dirección (admin). La revisión la sella la base (quién y cuándo). Sin DELETE.

begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';

create table if not exists public.metas_calidad (
  clave text primary key,
  nombre text not null,
  meta text not null,
  umbral numeric,
  sentido text,
  orden integer not null,
  desde date not null,
  constraint metas_calidad_sentido check (sentido is null or sentido in ('al_menos', 'a_lo_mas')),
  constraint metas_calidad_umbral check ((umbral is null) = (sentido is null))
);
insert into public.metas_calidad (clave, nombre, meta, umbral, sentido, orden, desde) values
  ('entrega_a_tiempo', 'Entrega a tiempo', '85% o más (entregada o lista a más tardar su día)', 85, 'al_menos', 1, '2026-11-27'),
  ('regresos_por_falla', 'Regresos de etapa por falla', '1 o menos al mes', 1, 'a_lo_mas', 2, '2026-11-27'),
  ('devoluciones', 'Devoluciones', '0 al mes', 0, 'a_lo_mas', 3, '2026-11-27'),
  ('quejas', 'Quejas del cliente', '2 o menos al mes (se ajusta a los 3 meses)', 2, 'a_lo_mas', 4, '2026-11-27'),
  ('merma', 'Merma', 'Que se registre en toda orden que la tenga; su % cuando haya 3 meses de datos', null, null, 5, '2026-11-27')
on conflict (clave) do nothing;
alter table public.metas_calidad enable row level security;
drop policy if exists metas_calidad_ver on public.metas_calidad;
create policy metas_calidad_ver on public.metas_calidad for select to authenticated
  using (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() = 'admin', false));
revoke all on public.metas_calidad from public, anon, authenticated;
grant select on public.metas_calidad to authenticated;
grant all on public.metas_calidad to service_role;

create table if not exists public.indicadores_mes (
  mes date primary key,
  valores jsonb not null,
  metas jsonb not null,
  guardado_en timestamptz not null default now(),
  guardado_por text not null,
  revision text,
  acciones text,
  revisado_por text,
  revisado_en timestamptz,
  constraint indicadores_mes_primero check (extract(day from mes) = 1),
  constraint indicadores_mes_textos check (coalesce(char_length(revision), 0) <= 4000 and coalesce(char_length(acciones), 0) <= 4000)
);
comment on table public.indicadores_mes is 'v10.84.195 — Indicadores de cada mes de PrintFlow contra sus metas (ISO 9001 6.2, 9.1.3, 9.3): la foto del día que se guardó y la revisión de Dirección.';

-- lo guardado no cambia; la revisión la sella la base (quién y cuándo)
create or replace function public.indicadores_mes_sellos() returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.mes := old.mes; new.valores := old.valores; new.metas := old.metas; new.guardado_en := old.guardado_en; new.guardado_por := old.guardado_por;
  if new.revision is distinct from old.revision or new.acciones is distinct from old.acciones then
    new.revisado_por := coalesce(public.pf_uid_username(), 'sistema');
    new.revisado_en := now();
  else
    new.revisado_por := old.revisado_por; new.revisado_en := old.revisado_en;
  end if;
  return new;
end
$function$;
revoke all on function public.indicadores_mes_sellos() from public, anon, authenticated;
drop trigger if exists indicadores_mes_sellos on public.indicadores_mes;
create trigger indicadores_mes_sellos before update on public.indicadores_mes for each row execute function public.indicadores_mes_sellos();

alter table public.indicadores_mes enable row level security;
drop policy if exists indicadores_mes_ver on public.indicadores_mes;
drop policy if exists indicadores_mes_revisar on public.indicadores_mes;
create policy indicadores_mes_ver on public.indicadores_mes for select to authenticated
  using (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() = 'admin', false));
create policy indicadores_mes_revisar on public.indicadores_mes for update to authenticated
  using (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() = 'admin', false))
  with check (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() = 'admin', false));
revoke all on public.indicadores_mes from public, anon, authenticated;
grant select, update (revision, acciones) on public.indicadores_mes to authenticated;
grant all on public.indicadores_mes to service_role;

-- lo medido de un mes (el de México): cada cifra con su base
create or replace function public.indicadores_calcular(p_mes date) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  d1 date := date_trunc('month', p_mes)::date;
  t1 timestamptz := (date_trunc('month', p_mes)::timestamp) at time zone 'America/Mexico_City';
  t2 timestamptz := ((date_trunc('month', p_mes) + interval '1 month')::timestamp) at time zone 'America/Mexico_City';
  r jsonb;
begin
  with ent as (
    select o.id, o.due_date, o.delivered_at,
           ((o.due_date::timestamp + interval '23 hours 59 minutes 59 seconds') at time zone 'America/Mexico_City') fin,
           (select max(t.created_at) from public.order_timeline t where t.order_id = o.id and t.to_stage in ('salidas', 'maq_received') and t.created_at <= o.delivered_at) lista
    from public.orders o
    where o.stage in ('delivered', 'maq_delivered') and o.delivered_at >= t1 and o.delivered_at < t2 and coalesce(o.source, '') <> 'stock'
  ), nc as (
    select * from public.no_conformidades where ocurrio_en >= t1 and ocurrio_en < t2
  ), dis as (
    select t.action from public.order_timeline t where t.created_at >= t1 and t.created_at < t2 and t.action like '%🎨 Diseño → %' and t.to_stage in ('ctp', 'ready')
  )
  select jsonb_build_object(
    'mes', to_char(d1, 'YYYY-MM'),
    'entrega_a_tiempo', (select jsonb_build_object('a_tiempo', count(*) filter (where due_date is not null and (delivered_at <= fin or (lista is not null and lista <= fin)))::int,
                                                    'con_fecha', count(*) filter (where due_date is not null)::int,
                                                    'sin_fecha', count(*) filter (where due_date is null)::int,
                                                    'pct', round(100.0 * count(*) filter (where due_date is not null and (delivered_at <= fin or (lista is not null and lista <= fin))) / nullif(count(*) filter (where due_date is not null), 0), 1)) from ent),
    'regresos_por_falla', (select jsonb_build_object('n', count(*) filter (where es_no_conformidad)::int, 'por_revisar', count(*) filter (where es_no_conformidad is null)::int, 'no_eran', count(*) filter (where es_no_conformidad = false)::int) from nc where origen = 'regreso'),
    'devoluciones', (select jsonb_build_object('n', count(*) filter (where es_no_conformidad is distinct from false)::int) from nc where origen = 'devolucion'),
    'quejas', (select jsonb_build_object('n', count(*)::int) from nc where origen = 'queja'),
    'merma', (select jsonb_build_object('renglones', count(*)::int, 'ordenes', count(distinct order_id)::int, 'piezas', coalesce(sum(qty), 0)::int, 'pliegos', coalesce(sum(pliegos), 0)::int)
              from public.order_waste where created_at >= t1 and created_at < t2),
    'no_conformidades', (select jsonb_build_object('del_mes', count(*)::int, 'cerradas', count(*) filter (where es_no_conformidad and funciono)::int,
                                                    'no_eran', count(*) filter (where es_no_conformidad = false)::int,
                                                    'abiertas', count(*) filter (where es_no_conformidad is distinct from false and not coalesce(es_no_conformidad and funciono, false))::int) from nc),
    'diseno', (select jsonb_build_object('salidas', count(*)::int, 'con_autorizacion', count(*) filter (where action like '✅ %')::int) from dis)
  ) into r;
  return r;
end
$function$;
revoke all on function public.indicadores_calcular(date) from public, anon;
grant execute on function public.indicadores_calcular(date) to service_role;
-- (la app no lo llama directo: ve el mes en curso por indicadores_del_mes_en_curso, que pregunta si es Dirección)
create or replace function public.indicadores_del_mes_en_curso() returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not coalesce(cobranza.is_internal_employee() and public.pf_uid_role() = 'admin', false) then
    raise exception 'Sólo Dirección ve los indicadores' using errcode = '42501';
  end if;
  return public.indicadores_calcular((now() at time zone 'America/Mexico_City')::date);
end
$function$;
revoke all on function public.indicadores_del_mes_en_curso() from public, anon;
grant execute on function public.indicadores_del_mes_en_curso() to authenticated, service_role;

-- guarda los meses cerrados que falten, desde noviembre de 2026; devuelve cuántos guardó (p_hoy: sólo para ensayar el día 1 sin esperarlo)
create or replace function public.indicadores_guardar(p_quien text default 'cada noche', p_hoy date default null) returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  hoy date := coalesce(p_hoy, (now() at time zone 'America/Mexico_City')::date);
  m date := '2026-11-01';
  n integer := 0;
  metas jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('public.indicadores_guardar'));
  perform public.nc_detectar();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.orden), '[]'::jsonb) into metas from public.metas_calidad x;
  while (m + interval '1 month')::date <= date_trunc('month', hoy)::date loop
    if not exists (select 1 from public.indicadores_mes where mes = m) then
      insert into public.indicadores_mes (mes, valores, metas, guardado_por) values (m, public.indicadores_calcular(m), metas, left(coalesce(p_quien, 'cada noche'), 60));
      n := n + 1;
    end if;
    m := (m + interval '1 month')::date;
  end loop;
  return n;
end
$function$;
revoke all on function public.indicadores_guardar(text, date) from public, anon, authenticated;
grant execute on function public.indicadores_guardar(text, date) to service_role;

select cron.schedule('printflow-indicadores-mes', '20 6 * * *', $$select public.indicadores_guardar('cada noche')$$);

insert into supabase_migrations.schema_migrations (version, name) values (to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDDHH24MISS'), 'v10_84_195_indicadores_del_mes') on conflict do nothing;
commit;
select (select count(*) from public.metas_calidad) metas, (select count(*) from public.indicadores_mes) meses_guardados,
       (select count(*) from cron.job where jobname = 'printflow-indicadores-mes') trabajo,
       (select name from supabase_migrations.schema_migrations where name = 'v10_84_195_indicadores_del_mes') registrada;
