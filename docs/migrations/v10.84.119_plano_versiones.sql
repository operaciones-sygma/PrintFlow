-- v10.84.119 (16-oct-2026) — Las VERSIONES del acomodo de la planta: la vista «Planta» de PrintFlow (Gerardo acomoda las máquinas en el
-- plano de la planta baja, agrega objetos con medidas, guarda acomodos con nombre e imprime). Decisión de Marcelo (15-oct): «en la base, tabla
-- nueva». Tabla nueva y sólo para esto: nada más la lee ni la escribe (ni CobranzaFlow ni ninguna otra app).
--
-- · Quién: sólo Producción (Gerardo) y Dirección la ven y la escriben (RLS con pf_uid_role(), como el resto de PrintFlow; un rol NULL no
--   abre). Nadie la borra por SQL: borrar una versión es marcar borrado_en (y se puede deshacer); sin DELETE para nadie.
-- · El autor y las horas los pone la base (el disparador), no la pantalla: creado_por/actualizado_por/borrado_por salen de la sesión
--   (pf_uid_username()). `revision` sube con cada cambio: la pantalla guarda con `.eq("revision", la que abrió)` y, si otro guardó mientras
--   tanto, no pisa: avisa quién y cuándo, y ofrece guardar la suya como nueva.
-- · El nombre: sin espacios de sobra, de 1 a 80 letras, y único entre las vivas (sin distinguir mayúsculas). Las piezas: un arreglo de
--   hasta 500, de menos de 400 KB (la planta tiene 14 máquinas; cada una ocupa ~150 bytes).
-- Ensayada en PGlite (scripts del 16-oct en el scratchpad de la sesión): permisos por rol, el disparador, los CHECK, el nombre único y el
-- borrado suave, con sabotajes. Se aplica por el editor SQL de Supabase (el conector no deja aplicar migraciones).

create table if not exists public.plano_versiones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  piezas jsonb not null,
  revision integer not null default 1,
  creado_por text,
  creado_en timestamptz not null default now(),
  actualizado_por text,
  actualizado_en timestamptz not null default now(),
  borrado_en timestamptz,
  borrado_por text,
  constraint plano_versiones_nombre check (nombre = btrim(nombre) and char_length(nombre) between 1 and 80),
  constraint plano_versiones_piezas check (jsonb_typeof(piezas) = 'array' and jsonb_array_length(piezas) <= 500 and octet_length(piezas::text) <= 400000)
);
comment on table public.plano_versiones is 'v10.84.119 — Versiones del acomodo de las máquinas en el plano de la planta baja (PrintFlow «Planta»). Sólo produccion y admin. Borrar = borrado_en.';

create unique index if not exists plano_versiones_nombre_vivo on public.plano_versiones (lower(nombre)) where borrado_en is null;
create index if not exists plano_versiones_recientes on public.plano_versiones (actualizado_en desc) where borrado_en is null;

-- El autor, las horas y la revisión los pone la base: lo que mande la pantalla en esas columnas no cuenta
create or replace function public.plano_versiones_sellos() returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
    new.creado_por := public.pf_uid_username();
    new.creado_en := now();
    new.actualizado_por := new.creado_por;
    new.actualizado_en := new.creado_en;
    new.borrado_en := null;
    new.borrado_por := null;
  else
    new.id := old.id;
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
    new.revision := old.revision + 1;
    new.actualizado_por := public.pf_uid_username();
    new.actualizado_en := now();
    if new.borrado_en is not null and old.borrado_en is null then
      new.borrado_en := now();
      new.borrado_por := public.pf_uid_username();
    elsif new.borrado_en is null then
      new.borrado_por := null;
    else
      new.borrado_en := old.borrado_en;
      new.borrado_por := old.borrado_por;
    end if;
  end if;
  return new;
end
$function$;
revoke all on function public.plano_versiones_sellos() from public, anon, authenticated;

drop trigger if exists plano_versiones_sellos on public.plano_versiones;
create trigger plano_versiones_sellos before insert or update on public.plano_versiones
  for each row execute function public.plano_versiones_sellos();

alter table public.plano_versiones enable row level security;
drop policy if exists plano_versiones_ver on public.plano_versiones;
drop policy if exists plano_versiones_crear on public.plano_versiones;
drop policy if exists plano_versiones_cambiar on public.plano_versiones;
create policy plano_versiones_ver on public.plano_versiones for select to authenticated
  using (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion'), false));
create policy plano_versiones_crear on public.plano_versiones for insert to authenticated
  with check (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion'), false));
create policy plano_versiones_cambiar on public.plano_versiones for update to authenticated
  using (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion'), false))
  with check (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion'), false));

revoke all on public.plano_versiones from public, anon, authenticated;
grant select, insert, update on public.plano_versiones to authenticated;
grant all on public.plano_versiones to service_role;
