-- v10.84.189 — Los avisos respetan los festivos de ley. Marcelo, 6-nov: «sí, que los avisos respeten los festivos también».
--
-- Qué pasaba: public.is_business_hours() sólo conocía sábado, domingo y el horario de 9:00 a 18:59. El lunes 16-nov los avisos habrían
-- salido como en un día normal, con la planta cerrada.
-- Qué cambia: un festivo de ley cuenta como un domingo. La lista es la misma de PrintFlow (`esFestivo`, src/lib/tiempoPorEtapa.js; LFT art. 74);
-- la tanda `habiles` compara las dos, día por día, de 2024 a 2040.
--
-- Quién la usa (buscado el 6-nov en pg_proc; nadie más):
--   · skip_silent_window_notifications (disparador trg_skip_silent_window de public.notifications): el aviso NO se guarda ni se manda a Telegram.
--     No se guarda para después: es lo mismo que ya pasa en sábado y domingo.
--   · _precio_al_final_clasificar y corregir_precio_orden («Corregir precio», PrintFlow y CobranzaFlow): sólo la usan para decir que el aviso no va a
--     llegar. Por eso el cambio va aquí y no en el disparador: si sólo cambiara el disparador, esa pantalla diría que el aviso sale y no saldría.
-- No la usan los avisos propios de CobranzaFlow (cobranza.notifications, cbf_bank_digest, cbf_bank_coverage, notify_pue_por_vencer): ésos no cambian.
-- Nadie la lee en pantalla por su nombre; no hace falta subir la app para que entre.
--
-- Vuelta atrás: v10.84.189_avisos_respetan_festivos_vuelta_atras.sql
-- Aplicada el 6-nov a las 18:26:26 por `apply_migration`, antes de saber que el 187 y el 188 ya eran de «Una sola cuenta»: en `supabase_migrations.schema_migrations` se llama
-- `v10_84_187_avisos_respetan_festivos` (20261107002626) y el comentario dentro de la función viva dice v10.84.187. Es esta misma; aquí se deja idéntico a lo que está vivo.
begin;

create or replace function public.es_festivo_de_ley(p_dia date)
 returns boolean
 language sql
 immutable
 parallel safe
 set search_path to 'pg_catalog', 'pg_temp'
as $function$
  select (m = 1  and d = 1)                                          -- 1 de enero
      or (m = 2  and dow = 1 and d between 1 and 7)                  -- primer lunes de febrero
      or (m = 3  and dow = 1 and d between 15 and 21)                -- tercer lunes de marzo
      or (m = 5  and d = 1)                                          -- 1 de mayo
      or (m = 9  and d = 16)                                         -- 16 de septiembre
      or (m = 10 and d = 1 and y >= 2024 and (y - 2024) % 6 = 0)     -- 1 de octubre, cada seis años (cambio de gobierno)
      or (m = 11 and dow = 1 and d between 15 and 21)                -- tercer lunes de noviembre
      or (m = 12 and d = 25)                                         -- 25 de diciembre
    from (select extract(year from p_dia)::int y, extract(month from p_dia)::int m, extract(day from p_dia)::int d, extract(dow from p_dia)::int dow) f
$function$;

-- La regla 5 de PrintFlow: toda función nueva, cerrada a anon. El disparador corre como quien inserta el aviso: authenticated (la app), service_role (las de
-- borde) o postgres (las RPC SECURITY DEFINER), y anon no puede insertar en public.notifications. hab-57 lo revisa.
revoke all on function public.es_festivo_de_ley(date) from public, anon;
grant execute on function public.es_festivo_de_ley(date) to authenticated, service_role;

comment on function public.es_festivo_de_ley(date) is 'Festivos de ley (LFT art. 74), la misma lista que esFestivo de PrintFlow (src/lib/tiempoPorEtapa.js). La jornada electoral (fracción IX) siempre es en domingo.';

create or replace function public.is_business_hours()
 returns boolean
 language plpgsql
 stable
 set search_path to 'public', 'cobranza', 'extensions', 'pg_temp'
as $function$
DECLARE
  mx_now TIMESTAMP;
  dow INT;
  hr INT;
BEGIN
  -- America/Mexico_City = UTC-6 todo el año desde octubre 2022 (sin DST)
  mx_now := (NOW() AT TIME ZONE 'America/Mexico_City');
  dow := EXTRACT(DOW FROM mx_now);  -- 0=Domingo, 1=Lunes, ..., 6=Sábado
  hr := EXTRACT(HOUR FROM mx_now);

  -- Sábado (6) y Domingo (0): silencio completo (sin cambio vs versión anterior)
  IF dow IN (0, 6) THEN
    RETURN FALSE;
  END IF;

  -- v10.84.187: un festivo de ley, como un domingo (Marcelo, 6-nov)
  IF public.es_festivo_de_ley(mx_now::date) THEN
    RETURN FALSE;
  END IF;

  -- Lun-Vie: solo activa de 09:00 a 18:59. Antes de 9am o desde 7pm en adelante: silencio.
  IF hr < 9 THEN
    RETURN FALSE;
  END IF;
  IF hr >= 19 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$function$;

commit;
