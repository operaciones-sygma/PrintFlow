-- Vuelta atrás de paso4_base.sql: regresa las cuatro funciones como estaban el 6-nov-2026 (la huella lo confirma) y quita el esquema cuentas_29nov.
-- ANTES: si ya se ligó o se cambió el correo de alguien, primero cuentas_29nov.regresar('<persona>') de cada quien. Si queda alguien ligado, esto se detiene.
begin;

do $revisa$
declare v_quedan int;
begin
  select count(*) into v_quedan from cuentas_29nov.personas p join public.users u on u.username = p.usuario_pf where p.tipo = 'ligar' and u.user_id = p.uid_nueva;
  if v_quedan > 0 then raise exception 'Quedan % personas ligadas a su cuenta nueva: primero cuentas_29nov.regresar().', v_quedan; end if;
  select count(*) into v_quedan from cuentas_29nov.personas p join auth.users u on u.id = p.uid_vieja where p.tipo = 'correo' and u.email = p.correo_nuevo;
  if v_quedan > 0 then raise exception 'Quedan % personas con su correo nuevo: primero cuentas_29nov.regresar().', v_quedan; end if;
end
$revisa$;

CREATE OR REPLACE FUNCTION almacen.mi_perfil()
 RETURNS TABLE(username text, rol text, nombre text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  (select u.username, u.role, coalesce(u.display_name, u.username)
     from public.users u
    where u.user_id = auth.uid() and u.active = true
    limit 1)
  union all
  (select split_part(au.email, '@', 1), e.rol, e.nombre
     from almacen.cuentas_externas e
     join auth.users au on au.id = e.uid
    where e.uid = auth.uid() and e.activa
      and not exists (select 1 from public.users u2 where u2.user_id = auth.uid() and u2.active = true)
    limit 1)
$function$;

CREATE OR REPLACE FUNCTION almacen._rol_efectivo()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    public.pf_uid_role(),
    (select e.rol from almacen.cuentas_externas e where e.uid = auth.uid() and e.activa limit 1))
$function$;

CREATE OR REPLACE FUNCTION almacen.quien()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (select coalesce(display_name, username) from public.users
      where user_id = auth.uid() and active = true limit 1),
    (select e.nombre from almacen.cuentas_externas e where e.uid = auth.uid() and e.activa limit 1),
    'sistema')
$function$;

CREATE OR REPLACE FUNCTION public.verify_actor_role(p_actor text, p_allowed_roles text[])
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF p_allowed_roles IS NULL OR array_length(p_allowed_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'Lista de roles permitidos vacía (programmer error)' USING ERRCODE='42501';
  END IF;

  -- F2-full: SIN sesión autenticada no se permite (el bypass anon-forge del string p_actor queda cerrado).
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida: inicia sesión para realizar esta operación.' USING ERRCODE='42501';
  END IF;

  -- Identidad criptográfica: el rol sale del uid del JWT, NO del string p_actor.
  SELECT role INTO v_role FROM public.users WHERE user_id = v_uid AND active = true LIMIT 1;
  IF v_role IS NULL THEN
    -- CobranzaFlow (misma auth): mapear roles a los de PrintFlow
    SELECT CASE role WHEN 'direccion' THEN 'admin' WHEN 'cxc' THEN 'karla' WHEN 'vendedor' THEN 'vendedor_cbf' ELSE role END
      INTO v_role FROM cobranza.users WHERE id = v_uid AND active = true LIMIT 1;
  END IF;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Sesión autenticada sin rol asignado (uid %). Contacta al administrador.', v_uid USING ERRCODE='42501';
  END IF;

  IF NOT (v_role = ANY(p_allowed_roles)) THEN
    RAISE EXCEPTION 'Actor (rol: %) no autorizado. Permitidos: %',
      v_role, array_to_string(p_allowed_roles, ', ') USING ERRCODE='42501';
  END IF;
  RETURN v_role;
END$function$;

drop schema cuentas_29nov cascade;

select
  md5(pg_get_functiondef('almacen.mi_perfil'::regproc)) = 'ca4e0bebd967f8fe8a99f22896018128' as mi_perfil_como_antes,
  md5(pg_get_functiondef('almacen._rol_efectivo'::regproc)) = '3e97fe255cd42e93aee76878ebca0306' as rol_efectivo_como_antes,
  md5(pg_get_functiondef('almacen.quien'::regproc)) = '2cfe2352b271abf4ec97b678f7157f4f' as quien_como_antes,
  md5(pg_get_functiondef('public.verify_actor_role'::regproc)) = 'a36f6faaf6fe7475eeeb8221d4e3c126' as verify_como_antes;

commit;
