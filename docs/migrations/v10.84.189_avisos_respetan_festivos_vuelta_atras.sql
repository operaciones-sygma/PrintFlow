-- v10.84.189, VUELTA ATRÁS de los avisos y los festivos: public.is_business_hours() como estaba hasta el 6-nov y fuera public.es_festivo_de_ley.
-- En el editor SQL, o por el conector. No depende de la pantalla.
begin;

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

drop function public.es_festivo_de_ley(date);

commit;
