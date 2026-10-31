-- v10.84.169b, VUELTA ATRÁS: regresa la columna public.users.password_hash (vacía y sin NOT NULL: antes era NOT NULL) y la función
-- public.verify_user_password como estaba, con sus permisos de antes (sólo service_role). Las contraseñas NO regresan, a propósito: con la columna
-- vacía la función no deja entrar a nadie, igual que hoy. Correr en el editor SQL dentro de begin … commit.
SET LOCAL lock_timeout = '3s';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash text;

CREATE OR REPLACE FUNCTION public.verify_user_password(p_username text, p_password text)
 RETURNS TABLE(username text, role text, display_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_username IS NULL OR p_password IS NULL OR TRIM(p_username) = '' THEN
    RETURN;  -- credenciales vacías → no match
  END IF;

  RETURN QUERY
  SELECT u.username, u.role, u.display_name
  FROM public.users u
  WHERE u.username = p_username
    AND u.password_hash = p_password
    AND u.active = true
  LIMIT 1;
END$function$;

REVOKE ALL ON FUNCTION public.verify_user_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_user_password(text, text) TO service_role;
