-- (Es lo que se aplicó: 27-nov-2026 10:31:41, por la API de administración con el OK escrito de Marcelo; ensayo OK en 63 ms; 10 detectadas al aplicar.)
-- v10.84.194 — aplicar «No conformidades» (con el OK de Marcelo del 27-nov). Si algo falla, no queda nada: es una sola transacción.
-- Si sale «55P03 lock timeout», otro tenía tomada public.orders: no dejó nada; se repite cuando Central dé ENTRA.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';

-- el folio, sin huecos (una secuencia se gasta con cada intento que falla y con cada «ya estaba»): un contador de un renglón, que se deshace con la transacción
create table if not exists public.no_conformidades_contador (id integer primary key default 1 check (id = 1), n integer not null default 0);
insert into public.no_conformidades_contador (id, n) values (1, 0) on conflict (id) do nothing;
alter table public.no_conformidades_contador enable row level security;
revoke all on public.no_conformidades_contador from public, anon, authenticated;
grant all on public.no_conformidades_contador to service_role;

create table if not exists public.no_conformidades (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  origen text not null,
  clave text unique,
  order_id text references public.orders(id) on delete set null,
  ocurrio_en timestamptz not null default now(),
  que_paso text not null,
  cliente text,
  canal text,
  es_no_conformidad boolean,
  por_que_no text,
  causa text,
  que_se_hizo text,
  funciono boolean,
  historial jsonb not null default '[]'::jsonb,
  creada_en timestamptz not null default now(),
  creada_por text,
  cambiada_en timestamptz,
  cambiada_por text,
  constraint no_conformidades_origen check (origen in ('devolucion', 'regreso', 'entrega_tarde', 'queja', 'otra')),
  constraint no_conformidades_clave check ((origen in ('queja', 'otra')) = (clave is null)),
  constraint no_conformidades_canal check (canal is null or canal in ('whatsapp', 'correo', 'telefono', 'persona')),
  constraint no_conformidades_textos check (
    char_length(btrim(que_paso)) between 3 and 2000 and coalesce(char_length(cliente), 0) <= 200 and coalesce(char_length(por_que_no), 0) <= 1000 and
    coalesce(char_length(causa), 0) <= 2000 and coalesce(char_length(que_se_hizo), 0) <= 2000),
  constraint no_conformidades_no_es check (es_no_conformidad is distinct from false or char_length(btrim(coalesce(por_que_no, ''))) >= 5),
  constraint no_conformidades_funciono check (funciono is null or char_length(btrim(coalesce(que_se_hizo, ''))) >= 3)
);
create index if not exists no_conformidades_ocurrio on public.no_conformidades (ocurrio_en desc);
create index if not exists no_conformidades_orden on public.no_conformidades (order_id);
comment on table public.no_conformidades is 'v10.84.194 — No conformidades de PrintFlow (ISO 9001 8.7 y 10.2): devoluciones, regresos de etapa y entregas tarde (las detecta nc_detectar) y quejas anotadas a mano; su causa, qué se hizo y si funcionó.';

create or replace function public.no_conformidades_sellos() returns trigger
language plpgsql
security definer   -- toma el siguiente folio del contador (que nadie más escribe)
set search_path to 'public', 'pg_temp'
as $function$
declare
  quien text := coalesce(public.pf_uid_username(), 'sistema');
  cambios jsonb := '{}'::jsonb;
  k integer;
begin
  if tg_op = 'INSERT' then
    update public.no_conformidades_contador set n = n + 1 where id = 1 returning n into k;
    new.folio := 'NC-' || lpad(k::text, 4, '0');
    new.creada_por := quien;
    new.creada_en := now();
    new.cambiada_por := null; new.cambiada_en := null;
    new.historial := '[]'::jsonb;
    if new.origen in ('queja', 'otra') then new.es_no_conformidad := true; end if;   -- lo anotado a mano sí es
    return new;
  end if;
  -- lo que no cambia
  new.id := old.id; new.folio := old.folio; new.origen := old.origen; new.clave := old.clave; new.order_id := old.order_id;
  new.ocurrio_en := old.ocurrio_en; new.creada_en := old.creada_en; new.creada_por := old.creada_por; new.historial := old.historial;
  if new.es_no_conformidad is distinct from old.es_no_conformidad then cambios := cambios || jsonb_build_object('es_no_conformidad', jsonb_build_array(old.es_no_conformidad, new.es_no_conformidad)); end if;
  if new.por_que_no is distinct from old.por_que_no then cambios := cambios || jsonb_build_object('por_que_no', jsonb_build_array(old.por_que_no, new.por_que_no)); end if;
  if new.causa is distinct from old.causa then cambios := cambios || jsonb_build_object('causa', jsonb_build_array(old.causa, new.causa)); end if;
  if new.que_se_hizo is distinct from old.que_se_hizo then cambios := cambios || jsonb_build_object('que_se_hizo', jsonb_build_array(old.que_se_hizo, new.que_se_hizo)); end if;
  if new.funciono is distinct from old.funciono then cambios := cambios || jsonb_build_object('funciono', jsonb_build_array(old.funciono, new.funciono)); end if;
  if new.que_paso is distinct from old.que_paso then cambios := cambios || jsonb_build_object('que_paso', jsonb_build_array(old.que_paso, new.que_paso)); end if;
  if new.cliente is distinct from old.cliente then cambios := cambios || jsonb_build_object('cliente', jsonb_build_array(old.cliente, new.cliente)); end if;
  if new.canal is distinct from old.canal then cambios := cambios || jsonb_build_object('canal', jsonb_build_array(old.canal, new.canal)); end if;
  if cambios = '{}'::jsonb then return old; end if;   -- nada cambió: ni sello ni historial
  new.historial := old.historial || jsonb_build_array(jsonb_build_object('en', now(), 'por', quien, 'cambios', cambios));
  new.cambiada_por := quien;
  new.cambiada_en := now();
  return new;
end
$function$;
revoke all on function public.no_conformidades_sellos() from public, anon, authenticated;
drop trigger if exists no_conformidades_sellos on public.no_conformidades;
create trigger no_conformidades_sellos before insert or update on public.no_conformidades
  for each row execute function public.no_conformidades_sellos();

alter table public.no_conformidades enable row level security;
drop policy if exists no_conformidades_ver on public.no_conformidades;
drop policy if exists no_conformidades_anotar on public.no_conformidades;
drop policy if exists no_conformidades_atender on public.no_conformidades;
create policy no_conformidades_ver on public.no_conformidades for select to authenticated
  using (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion', 'preprensa', 'german', 'secretaria', 'karla', 'vendedor', 'visor'), false));
-- a mano sólo quejas y otras (lo detectado lo escribe nc_detectar)
create policy no_conformidades_anotar on public.no_conformidades for insert to authenticated
  with check (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion', 'preprensa', 'secretaria', 'karla'), false) and origen in ('queja', 'otra'));
create policy no_conformidades_atender on public.no_conformidades for update to authenticated
  using (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion', 'preprensa', 'secretaria', 'karla'), false))
  with check (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion', 'preprensa', 'secretaria', 'karla'), false));
revoke all on public.no_conformidades from public, anon, authenticated;
grant select, insert, update on public.no_conformidades to authenticated;
grant all on public.no_conformidades to service_role;

-- Lo detectado, desde el 1-nov-2026. Devuelve cuántas agregó. Cada una se queda con lo que se sabía al detectarla.
create or replace function public.nc_detectar() returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  desde constant timestamptz := '2026-11-01 00:00:00-06';
  n integer := 0; k integer;
begin
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
revoke all on function public.nc_detectar() from public, anon;
grant execute on function public.nc_detectar() to authenticated, service_role;

select cron.schedule('printflow-nc-detectar', '15 6 * * *', $$select public.nc_detectar()$$);

-- lo de hoy, de una vez
select public.nc_detectar() as detectadas_al_aplicar;

insert into supabase_migrations.schema_migrations (version, name) values (to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDDHH24MISS'), 'v10_84_194_no_conformidades') on conflict do nothing;
commit;
select (select count(*) from public.no_conformidades) registradas,
       (select string_agg(origen || ' ' || c, ', ' order by origen) from (select origen, count(*) c from public.no_conformidades group by origen) x) por_origen,
       (select string_agg(folio, ',' order by folio) from public.no_conformidades) folios,
       (select n from public.no_conformidades_contador) contador,
       (select count(*) from cron.job where jobname = 'printflow-nc-detectar') trabajo_de_cada_noche,
       (select name from supabase_migrations.schema_migrations where name = 'v10_84_194_no_conformidades') registrada;
