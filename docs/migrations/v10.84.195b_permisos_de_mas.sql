-- (Es lo que se aplicó: 27-nov-2026 11:36:12, por la API de administración con el OK escrito de Marcelo; ensayo: permisos --ensayar, 20 de 20.)
-- v10.84.195b (27-nov-2026) — los permisos de más de la 194 y la 195 (lo encontró la revisión sin escribir, y Central): Supabase le da EXECUTE a `authenticated`
-- en toda función nueva, aunque se revoque de public y anon.
-- · indicadores_calcular(date): las cifras de cualquier mes de toda la planta; la app no la llama (ve el mes en curso por indicadores_del_mes_en_curso, que revisa que
--   sea Dirección): se le quita a las sesiones.
-- · nc_detectar(): la app SÍ la llama al abrir la lista (lo nuevo aparece en seguida, no hasta la noche) y escribe lo detectado; ahora revisa quién: los de PrintFlow que
--   ven la lista o el sistema (pg_cron, sin sesión). La misma función de la 194, con esa revisión al principio.
-- Con el OK escrito de Marcelo para ESTA (y la vía, la API). Se aplica con el VOY a Central.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';
revoke execute on function public.indicadores_calcular(date) from authenticated;
create or replace function public.nc_detectar() returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  desde constant timestamptz := '2026-11-01 00:00:00-06';
  n integer := 0; k integer;
begin
  -- v10.84.195b — quién la llama: los de PrintFlow que ven la lista (la app, al abrirla) o el sistema (pg_cron, sin sesión). Lo de otra app (Almacén), no
  if auth.uid() is not null and not coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion', 'preprensa', 'german', 'secretaria', 'karla', 'vendedor', 'visor'), false) then
    raise exception 'nc_detectar: sólo los de PrintFlow' using errcode = '42501';
  end if;
  -- una detección a la vez (dos personas abriendo la lista al mismo tiempo): la segunda ve lo que guardó la primera
  perform pg_advisory_xact_lock(hashtext('public.nc_detectar'));
  -- devoluciones (la orden original; su re-trabajo trae returned_from_order_id)
  insert into public.no_conformidades (origen, clave, order_id, ocurrio_en, que_paso, cliente)
  select 'devolucion', 'devolucion:' || o.id, o.id, o.returned_at,
         left('Devolución de ' || coalesce(o.production_number, o.id) || coalesce(': ' || nullif(btrim(o.return_reason), ''), ' (sin razón escrita)'), 2000),
         left(coalesce(o.client_company, o.client), 200)
  from public.orders o where o.returned_at is not null and o.returned_at >= desde
    and not exists (select 1 from public.no_conformidades x where x.clave = 'devolucion:' || o.id)   -- lo ya registrado ni se propone (no gasta folio)
  on conflict (clave) do nothing;
  get diagnostics k = row_count; n := n + k;
  -- regresos de etapa con su razón (el renglón de la bitácora)
  insert into public.no_conformidades (origen, clave, order_id, ocurrio_en, que_paso, cliente)
  select 'regreso', 'regreso:' || t.id, t.order_id, t.created_at, left(coalesce(o.production_number, t.order_id) || ': ' || t.action, 2000), left(coalesce(o.client_company, o.client), 200)
  from public.order_timeline t left join public.orders o on o.id = t.order_id
  where t.action like '↩️ Regresada de %' and t.created_at >= desde
    and not exists (select 1 from public.no_conformidades x where x.clave = 'regreso:' || t.id)
  on conflict (clave) do nothing;
  get diagnostics k = row_count; n := n + k;
  -- entregas tarde: entregada después de su día y sin haber quedado LISTA a más tardar ese día (la regla de la app, entregadaATiempo)
  insert into public.no_conformidades (origen, clave, order_id, ocurrio_en, que_paso, cliente)
  select 'entrega_tarde', 'tarde:' || e.id, e.id, e.delivered_at,
         left(coalesce(e.production_number, e.id) || ' se entregó tarde: su día era el ' || to_char(e.due_date, 'DD-MM-YYYY') || ', quedó lista el ' ||
              coalesce(to_char(e.lista at time zone 'America/Mexico_City', 'DD-MM-YYYY'), '(sin registro)') || ' y se entregó el ' || to_char(e.delivered_at at time zone 'America/Mexico_City', 'DD-MM-YYYY'), 2000),
         left(e.cliente, 200)
  from (
    select o.id, o.production_number, o.due_date, o.delivered_at, coalesce(o.client_company, o.client) cliente,
           ((o.due_date::timestamp + interval '23 hours 59 minutes 59 seconds') at time zone 'America/Mexico_City') fin,
           (select max(t.created_at) from public.order_timeline t where t.order_id = o.id and t.to_stage in ('salidas', 'maq_received') and t.created_at <= o.delivered_at) lista
    from public.orders o
    where o.stage in ('delivered', 'maq_delivered') and o.due_date is not null and o.delivered_at >= desde and coalesce(o.source, '') <> 'stock'
  ) e
  where e.delivered_at > e.fin and (e.lista is null or e.lista > e.fin)
    and not exists (select 1 from public.no_conformidades x where x.clave = 'tarde:' || e.id)
  on conflict (clave) do nothing;
  get diagnostics k = row_count; n := n + k;
  return n;
end
$function$;
insert into supabase_migrations.schema_migrations (version, name) values (to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDDHH24MISS'), 'v10_84_195b_permisos_de_mas') on conflict do nothing;
commit;
select has_function_privilege('authenticated', 'public.indicadores_calcular(date)', 'execute') sesion_calcula,
       has_function_privilege('authenticated', 'public.nc_detectar()', 'execute') sesion_detecta_con_revision,
       (select prosrc like '%sólo los de PrintFlow%' from pg_proc where oid = 'public.nc_detectar()'::regprocedure) revisa_quien,
       (select name from supabase_migrations.schema_migrations where name = 'v10_84_195b_permisos_de_mas') registrada;
