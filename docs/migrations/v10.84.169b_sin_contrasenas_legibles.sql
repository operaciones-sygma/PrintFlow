-- v10.84.169b — SIN CONTRASEÑAS LEGIBLES EN public.users (Marcelo, 31-oct-2026, a la pregunta «¿Cómo la quito?»: «Borrar columna y función»).
-- public.users.password_hash era la columna del login de antes de Supabase Auth. 8 de sus 10 valores eran contraseñas en TEXTO PLANO (2 parecían
-- bcrypt) y 6 todavía servían para entrar (genaro, gerardo, german, karla, noemi y secretaria: sus cuentas de Auth se crearon con la misma).
-- Nadie de fuera las podía leer (medido el 31-oct): RLS prendido y sin políticas, ningún permiso de tabla ni de columna para anon ni authenticated,
-- y ninguna función devuelve el renglón entero. Pero las veía quien administra la base (el panel de Supabase, la llave de servicio, el conector).
--   1. DROP FUNCTION public.verify_user_password(text, text): el login viejo, que comparaba password_hash = p_password en texto. Nadie la llama
--      desde v10.73.48 (PrintFlow entra sólo con Auth), y ni anon ni authenticated la podían ejecutar.
--   2. ALTER TABLE public.users DROP COLUMN password_hash: ninguna vista, función ni pantalla la usa. Era el último paso del plan de la migración
--      a Auth (docs/migrations/supabase-auth-native.md). Desde hoy, crear un usuario por SQL ya no la lleva.
-- Ensayada antes con rollback. Vuelta atrás: v10.84.169b_sin_contrasenas_legibles_vuelta_atras.sql (la columna, vacía y sin NOT NULL, y la
-- función); las contraseñas NO regresan, a propósito.
SET LOCAL lock_timeout = '3s';
-- @@ corte
DROP FUNCTION public.verify_user_password(text, text);
-- @@ corte
ALTER TABLE public.users DROP COLUMN password_hash;
