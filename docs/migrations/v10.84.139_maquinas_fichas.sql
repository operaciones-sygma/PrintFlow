-- v10.84.139 (16-oct-2026) — Las FICHAS de las máquinas de «Planta» (PrintFlow): fabricante, modelo, número de máquina o de serie, año, conexión y notas,
-- tomados de la placa de cada una (Documents\SYGMA-maquinaria\REGISTRO.md, con las fotos). Decisión de Marcelo (16-oct): «el registro de maquinaria en
-- Planta (tabla nueva, por el editor)». Tabla nueva y sólo para esto: nada más la lee ni la escribe (ni CobranzaFlow ni ninguna otra app).
--
-- · La llave es la pieza del plano (m-1 … m-13 del levantamiento, o la de un objeto que Gerardo agregue): la ficha sale al tocar la máquina en «Planta».
-- · Quién: sólo Producción (Gerardo) y Dirección la ven y la escriben (RLS con pf_uid_role(), como plano_versiones; un rol NULL no abre). Sin DELETE.
-- · El autor y la hora los pone la base (el disparador); `revision` sube con cada cambio: la pantalla guarda con `.eq("revision", la que abrió)` y, si otro
--   guardó mientras tanto, no pisa.
-- · Los textos: sin espacios de sobra y de largo acotado (las notas, hasta 2,000).
-- Se aplica por el editor SQL de Supabase (el conector no deja aplicar migraciones). Ensayo: ver el final.

begin;

create table if not exists public.maquinas_fichas (
  pieza text primary key,
  fabricante text,
  modelo text,
  numero text,
  anio text,
  conexion text,
  notas text,
  por_confirmar text,
  revision integer not null default 1,
  actualizado_por text,
  actualizado_en timestamptz not null default now(),
  constraint maquinas_fichas_pieza check (pieza = btrim(pieza) and char_length(pieza) between 1 and 60),
  constraint maquinas_fichas_textos check (
    coalesce(char_length(fabricante), 0) <= 200 and coalesce(char_length(modelo), 0) <= 200 and coalesce(char_length(numero), 0) <= 120 and
    coalesce(char_length(anio), 0) <= 120 and coalesce(char_length(conexion), 0) <= 300 and coalesce(char_length(notas), 0) <= 2000 and
    coalesce(char_length(por_confirmar), 0) <= 1000)
);
comment on table public.maquinas_fichas is 'v10.84.139 — Fichas de las máquinas de la planta (PrintFlow «Planta»): lo de la placa de cada una. Llave: la pieza del plano. Sólo produccion y admin.';

-- El autor, la hora y la revisión los pone la base: lo que mande la pantalla en esas columnas no cuenta
create or replace function public.maquinas_fichas_sellos() returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
  else
    new.pieza := old.pieza;
    new.revision := old.revision + 1;
  end if;
  new.actualizado_por := public.pf_uid_username();
  new.actualizado_en := now();
  return new;
end
$function$;
revoke all on function public.maquinas_fichas_sellos() from public, anon, authenticated;

drop trigger if exists maquinas_fichas_sellos on public.maquinas_fichas;
create trigger maquinas_fichas_sellos before insert or update on public.maquinas_fichas
  for each row execute function public.maquinas_fichas_sellos();

alter table public.maquinas_fichas enable row level security;
drop policy if exists maquinas_fichas_ver on public.maquinas_fichas;
drop policy if exists maquinas_fichas_crear on public.maquinas_fichas;
drop policy if exists maquinas_fichas_cambiar on public.maquinas_fichas;
create policy maquinas_fichas_ver on public.maquinas_fichas for select to authenticated
  using (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion'), false));
create policy maquinas_fichas_crear on public.maquinas_fichas for insert to authenticated
  with check (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion'), false));
create policy maquinas_fichas_cambiar on public.maquinas_fichas for update to authenticated
  using (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion'), false))
  with check (coalesce(cobranza.is_internal_employee() and public.pf_uid_role() in ('admin', 'produccion'), false));

revoke all on public.maquinas_fichas from public, anon, authenticated;
grant select, insert, update on public.maquinas_fichas to authenticated;
grant all on public.maquinas_fichas to service_role;

-- Lo que ya se leyó de las placas (REGISTRO.md, 16-oct). La pegadora, la cilíndrica, el foil, las aspas, la Duplo y el CTP, pendientes de su placa.
-- (el disparador pone el autor; aquí, desde el editor, sale vacío: el autor de este registro es la migración)
insert into public.maquinas_fichas (pieza, fabricante, modelo, numero, anio, conexion, notas, por_confirmar) values
  ('m-1', 'Heidelberger Druckmaschinen AG', 'GTO 52 (1 color)', '696 384', '1988-1989 (estimado)', null,
   'Made in Western Germany. Placa del distribuidor: Distribuidora Heidelberg, S.A., México D.F. El año se estimó por la placa (antes de la reunificación) y por otras GTO 52 anunciadas con su número.',
   'El año exacto: pedirlo a Heidelberg México con el número de máquina.'),
  ('m-2', 'Heidelberger Druckmaschinen AG', 'PM 74-4-P (Printmaster 74, 4 colores con volteo)', 'PM741523', '2007', null,
   'Placa 10.107.4102. La «P» es de volteo (perfecting): imprime 4/0 o 2/2.', null),
  ('m-3', 'Muller Martini Manufacturing Corp., Newport News, VA (EUA)', 'Minuteman: transportador 1511 y alimentador de portadas 1528.0417', '91.05992 (alimentador de portadas)', '1997', null,
   'Tren de engrapado (alzadora, engrapadora y refine). Cada módulo trae su placa. El otro tren, el que está en venta (placa Grapha, transportador 1511 L 20), no está en el plano.',
   'El número del transportador (91.08932) y su año se ven borrosos en la foto: leerlos en la máquina.'),
  ('m-4', 'Baumfolder Corp., Sidney, Ohio (EUA)', 'Model No. 51214… · serie L-26B', null, null, '208-230 V, 60 Hz, trifásica, 32 A; cable mínimo calibre 8 AWG; fusible retardado de 50 A',
   'Baumfolder sigue vendiendo refacciones: pide el modelo y el número de serie (baumfolder.com, «Parts & Customer Service»).',
   'El último dígito del modelo no se lee y el número de serie viene en blanco en la placa: buscarlo grabado en el bastidor o en otra placa.'),
  ('m-5', 'Adolf Mohr Maschinenfabrik (Polar-Mohr), Alemania', 'POLAR 78 ES', '6861711', '1998', 'trifásica, 220 V, 60 Hz, 8.0 A',
   'Placa gastada; etiqueta GS «geprüfte Sicherheit» DP 97009. El número del modelo es el ancho de corte en centímetros.', null),
  ('m-6', 'Adolf Mohr Maschinenfabrik (Polar-Mohr), Hofheim/Ts., Alemania', 'POLAR 115 E', '7381665', '2003', 'trifásica, 220 V, 60 Hz, 18.7 A',
   'Marca CE; etiqueta BG-Prüfzert DP 01085. El número del modelo es el ancho de corte en centímetros.', null),
  ('m-8', 'Heidelberger Druckmaschinen AG', 'GTO-52-4 (4 colores)', '721231', '2005', null, 'Placa 10.107.4104.', null)
on conflict (pieza) do nothing;

commit;

-- Vuelta atrás (si hiciera falta): drop table public.maquinas_fichas; drop function public.maquinas_fichas_sellos();
