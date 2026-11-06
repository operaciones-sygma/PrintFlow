-- Ensayo del paso 4: la base entera y las nueve personas dentro de un solo DO que SIEMPRE termina en RAISE EXCEPTION: nada se queda. Se corre con execute_sql; el resultado es el mensaje de error.
-- 6-nov-2026. Antes del 29-nov se vuelve a correr, con las personas como estén ese día.
do $ensayo$
declare
  p record; x jsonb; r jsonb := '{}'; antes jsonb := '{}'; fallas text[] := '{}';
begin
  execute $pieza_e0$create or replace function public.get_my_session()
returns table(username text, role text, display_name text, active boolean)
language sql stable security definer set search_path to 'public', 'cobranza', 'pg_temp'
as $function$
  select u.username, u.role, u.display_name, u.active from public.users u where u.user_id = auth.uid() and u.active = true limit 1
$function$$pieza_e0$;
  execute $pieza_e1$create schema cuentas_ensayo$pieza_e1$;
  execute $pieza_e2$create function cuentas_ensayo.pasa(p_roles text[]) returns text language plpgsql as $f$
begin
  return public.verify_actor_role('prueba', p_roles);
exception when others then
  return 'NO';
end
$f$$pieza_e2$;
  execute $pieza_e3$-- Lo que la base le contesta a una cuenta: lo que PrintFlow, CobranzaFlow y Almacén deciden con ella. Sólo lee.
create function cuentas_ensayo.foto(p_uid uuid) returns jsonb language plpgsql as $f$
declare r jsonb; v_pf jsonb; v_alm jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  select to_jsonb(s) into v_pf from public.get_my_session() s limit 1;
  select to_jsonb(p) into v_alm from almacen.mi_perfil() p limit 1;
  r := jsonb_build_object(
    'pf_sesion', v_pf,
    'pf_rol', public.pf_uid_role(),
    'pf_usuario', public.pf_uid_username(),
    'pf_escribe', public.pf_puede_escribir(),
    'ordenes', (select count(*) from public.pf_visible_order_ids()),
    'ocs', (select count(*) from public.pf_oc_ids_propias()),
    'interno', cobranza.is_internal_employee(),
    'cbf_rol', cobranza.current_user_role(),
    'cbf_admin', cobranza.is_admin_role(),
    'alm_perfil', v_alm,
    'alm_rol', almacen._rol_efectivo(),
    'alm_empleado', almacen.es_empleado(),
    'alm_administra', almacen.puede_administrar(),
    'alm_compra', almacen.puede_comprar(),
    'alm_direccion', almacen.es_direccion(),
    'alm_corte', almacen.puede_ver_corte(),
    'alm_quien', almacen.quien(),
    'alm_area', almacen._mi_area(),
    'actor_admin', cuentas_ensayo.pasa(array['admin']),
    'actor_karla', cuentas_ensayo.pasa(array['karla']),
    'actor_contabilidad', cuentas_ensayo.pasa(array['contabilidad']),
    'actor_tesoreria', cuentas_ensayo.pasa(array['tesoreria']),
    'actor_secretaria', cuentas_ensayo.pasa(array['secretaria']),
    'actor_vendedor', cuentas_ensayo.pasa(array['vendedor']),
    'actor_visor', cuentas_ensayo.pasa(array['visor']),
    'actor_produccion', cuentas_ensayo.pasa(array['produccion']),
    'actor_german', cuentas_ensayo.pasa(array['german']),
    'actor_preprensa', cuentas_ensayo.pasa(array['preprensa']),
    'actor_almacen', cuentas_ensayo.pasa(array['almacen'])
  );
  perform set_config('request.jwt.claims', '', true);
  return r;
end
$f$$pieza_e3$;

  -- La foto de todos con las funciones de hoy, ANTES de cambiarlas
  for p in select * from (values
    ('arturo',  '4bdf6010-65a8-490b-a815-37e89dc17940'::uuid, null::uuid),
    ('gerardo', '1c1ba04c-9195-4579-9b4d-a0a2366e07e9'::uuid, null::uuid),
    ('german',  'f9fc2b18-3dbb-422a-a9cb-70ca03bf170b'::uuid, null::uuid),
    ('noemi',   'ac0a8997-c507-48cb-ba2e-5ea77ea4b27b'::uuid, null::uuid),
    ('karla',   'e5bff9c2-2c81-4a5b-8dac-a1d4ee778c3e'::uuid, '06072388-3784-4a5b-b9a8-ad0437ef3311'::uuid),
    ('genaro',  'f321f84b-582b-4ee8-9ee1-9a3138654f5c'::uuid, '76714606-59a6-42e3-8d1c-49ebb52bb2a9'::uuid),
    ('dulce',   '0ec50922-b1bb-4666-a09f-738242c2255e'::uuid, '6029dd6f-9122-4eeb-99e5-a06554dd0445'::uuid),
    ('lupita',  '6b85fba8-383f-495c-ae4a-8cf5858c4a15'::uuid, '0c2a10ee-9341-4a12-ae5c-2d46d36e63ed'::uuid),
    ('marcelo', '80fa4231-bff6-4e14-9943-6cc5a418c481'::uuid, '6f68a403-e726-453a-a1ad-599734a56728'::uuid)
  ) as t(persona, uid_vieja, uid_nueva) loop
    antes := antes || jsonb_build_object(p.persona || ':vieja', cuentas_ensayo.foto(p.uid_vieja));
    if p.uid_nueva is not null then antes := antes || jsonb_build_object(p.persona || ':nueva', cuentas_ensayo.foto(p.uid_nueva)); end if;
  end loop;
  execute $pieza0$do $revisa$
declare r record;
begin
  for r in select * from (values ('almacen.mi_perfil', 'ca4e0bebd967f8fe8a99f22896018128'), ('almacen._rol_efectivo', '3e97fe255cd42e93aee76878ebca0306'), ('almacen.quien', '2cfe2352b271abf4ec97b678f7157f4f'), ('public.verify_actor_role', 'a36f6faaf6fe7475eeeb8221d4e3c126')) as h(f, huella) loop
    if md5(pg_get_functiondef(r.f::regproc)) is distinct from r.huella then
      raise exception 'La función % cambió desde el 6-nov-2026: vuelve a compararla antes de aplicar esto.', r.f;
    end if;
  end loop;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_my_session') then
    raise exception 'Falta public.get_my_session (v10.84.190): este paquete va después del paso 2.';
  end if;
end
$revisa$$pieza0$;
  execute $pieza1$create or replace function almacen.mi_perfil()
 returns table(username text, rol text, nombre text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  (select split_part(au.email, '@', 1), e.rol, e.nombre
     from almacen.cuentas_externas e
     join auth.users au on au.id = e.uid
    where e.uid = auth.uid() and e.activa
    limit 1)
  union all
  (select u.username, u.role, coalesce(u.display_name, u.username)
     from public.users u
    where u.user_id = auth.uid() and u.active = true
      and not exists (select 1 from almacen.cuentas_externas e2 where e2.uid = auth.uid() and e2.activa)
    limit 1)
$function$$pieza1$;
  execute $pieza2$create or replace function almacen._rol_efectivo()
 returns text
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    (select e.rol from almacen.cuentas_externas e where e.uid = auth.uid() and e.activa limit 1),
    public.pf_uid_role())
$function$$pieza2$;
  execute $pieza3$create or replace function almacen.quien()
 returns text
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    (select e.nombre from almacen.cuentas_externas e where e.uid = auth.uid() and e.activa limit 1),
    (select coalesce(display_name, username) from public.users
      where user_id = auth.uid() and active = true limit 1),
    'sistema')
$function$$pieza3$;
  execute $pieza4$create or replace function public.verify_actor_role(p_actor text, p_allowed_roles text[])
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public', 'cobranza', 'pg_temp'
as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_cbf text;
BEGIN
  IF p_allowed_roles IS NULL OR array_length(p_allowed_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'Lista de roles permitidos vacía (programmer error)' USING ERRCODE='42501';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida: inicia sesión para realizar esta operación.' USING ERRCODE='42501';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE user_id = v_uid AND active = true LIMIT 1;
  SELECT CASE role WHEN 'direccion' THEN 'admin' WHEN 'cxc' THEN 'karla' WHEN 'vendedor' THEN 'vendedor_cbf' ELSE role END
    INTO v_cbf FROM cobranza.users WHERE id = v_uid AND active = true LIMIT 1;
  IF v_role IS NULL AND v_cbf IS NULL THEN
    RAISE EXCEPTION 'Sesión autenticada sin rol asignado (uid %). Contacta al administrador.', v_uid USING ERRCODE='42501';
  END IF;

  IF v_role = ANY(p_allowed_roles) THEN RETURN v_role; END IF;
  IF v_cbf = ANY(p_allowed_roles) THEN RETURN v_cbf; END IF;
  RAISE EXCEPTION 'Actor (rol: %) no autorizado. Permitidos: %',
    COALESCE(v_role, v_cbf), array_to_string(p_allowed_roles, ', ') USING ERRCODE='42501';
END$function$$pieza4$;
  execute $pieza5$create schema cuentas_29nov$pieza5$;
  execute $pieza6$revoke all on schema cuentas_29nov from public, anon, authenticated, service_role$pieza6$;
  execute $pieza7$comment on schema cuentas_29nov is 'Una sola cuenta (29-nov-2026): las herramientas del cambio, persona por persona, con su bitácora. Sólo el dueño de la base. Se quita cuando pase el cambio (docs/una-sola-cuenta/LEEME.md).'$pieza7$;
  execute $pieza8$create table cuentas_29nov.personas (
  persona text primary key,
  tipo text not null check (tipo in ('correo', 'ligar')),
  uid_vieja uuid not null,
  correo_viejo text not null,
  uid_nueva uuid,
  correo_nuevo text not null,
  usuario_pf text not null,
  externa boolean not null default false,   -- tiene renglón en almacen.cuentas_externas: en Almacén sigue siendo el de su cuenta nueva
  check ((tipo = 'correo') = (uid_nueva is null))
)$pieza8$;
  execute $pieza9$insert into cuentas_29nov.personas (persona, tipo, uid_vieja, correo_viejo, uid_nueva, correo_nuevo, usuario_pf, externa) values
  ('arturo',  'correo', '4bdf6010-65a8-490b-a815-37e89dc17940', 'arturo@padillahnos.local',     null,                                   'arturo@sygma.mx',  'arturo',     false),
  ('gerardo', 'correo', '1c1ba04c-9195-4579-9b4d-a0a2366e07e9', 'gerardo@padillahnos.local',    null,                                   'gerardo@sygma.mx', 'gerardo',    false),
  ('german',  'correo', 'f9fc2b18-3dbb-422a-a9cb-70ca03bf170b', 'german@padillahnos.local',     null,                                   'german@sygma.mx',  'german',     false),
  ('noemi',   'correo', 'ac0a8997-c507-48cb-ba2e-5ea77ea4b27b', 'noemi@padillahnos.local',      null,                                   'noemi@sygma.mx',   'noemi',      false),
  ('karla',   'ligar',  'e5bff9c2-2c81-4a5b-8dac-a1d4ee778c3e', 'karla@padillahnos.local',      '06072388-3784-4a5b-b9a8-ad0437ef3311', 'karla@sygma.mx',   'karla',      false),
  ('genaro',  'ligar',  'f321f84b-582b-4ee8-9ee1-9a3138654f5c', 'genaro@padillahnos.local',     '76714606-59a6-42e3-8d1c-49ebb52bb2a9', 'genaro@sygma.mx',  'genaro',     false),
  ('dulce',   'ligar',  '0ec50922-b1bb-4666-a09f-738242c2255e', 'dulce@padillahnos.local',      '6029dd6f-9122-4eeb-99e5-a06554dd0445', 'dulce@sygma.mx',   'dulce',      true),
  ('lupita',  'ligar',  '6b85fba8-383f-495c-ae4a-8cf5858c4a15', 'secretaria@padillahnos.local', '0c2a10ee-9341-4a12-ae5c-2d46d36e63ed', 'lupita@sygma.mx',  'secretaria', false),
  ('marcelo', 'ligar',  '80fa4231-bff6-4e14-9943-6cc5a418c481', 'admin@padillahnos.local',      '6f68a403-e726-453a-a1ad-599734a56728', 'marcelo@sygma.mx', 'admin',      true)$pieza9$;
  execute $pieza10$create table cuentas_29nov.bitacora (
  id bigserial primary key,
  persona text not null references cuentas_29nov.personas (persona),
  accion text not null,
  cuando timestamptz not null default now(),
  quien text not null default current_user,
  detalle jsonb not null default '{}'
)$pieza10$;
  execute $pieza11$create table cuentas_29nov.fotos_antes (
  persona text not null references cuentas_29nov.personas (persona),
  cuenta text not null check (cuenta in ('vieja', 'nueva')),
  foto jsonb not null,
  primary key (persona, cuenta)
)$pieza11$;
  execute $pieza12$create function cuentas_29nov.pasa(p_roles text[]) returns text language plpgsql as $f$
begin
  return public.verify_actor_role('prueba', p_roles);
exception when others then
  return 'NO';
end
$f$$pieza12$;
  execute $pieza13$create function cuentas_29nov.foto(p_uid uuid) returns jsonb language plpgsql as $f$
declare r jsonb; v_pf jsonb; v_alm jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  select to_jsonb(s) into v_pf from public.get_my_session() s limit 1;
  select to_jsonb(p) into v_alm from almacen.mi_perfil() p limit 1;
  r := jsonb_build_object(
    'pf_sesion', v_pf,
    'pf_rol', public.pf_uid_role(),
    'pf_usuario', public.pf_uid_username(),
    'pf_escribe', public.pf_puede_escribir(),
    'ordenes', (select count(*) from public.pf_visible_order_ids()),
    'ocs', (select count(*) from public.pf_oc_ids_propias()),
    'interno', cobranza.is_internal_employee(),
    'cbf_rol', cobranza.current_user_role(),
    'cbf_admin', cobranza.is_admin_role(),
    'alm_perfil', v_alm,
    'alm_rol', almacen._rol_efectivo(),
    'alm_empleado', almacen.es_empleado(),
    'alm_administra', almacen.puede_administrar(),
    'alm_compra', almacen.puede_comprar(),
    'alm_direccion', almacen.es_direccion(),
    'alm_corte', almacen.puede_ver_corte(),
    'alm_quien', almacen.quien(),
    'alm_area', almacen._mi_area(),
    'actor_admin', cuentas_29nov.pasa(array['admin']),
    'actor_karla', cuentas_29nov.pasa(array['karla']),
    'actor_contabilidad', cuentas_29nov.pasa(array['contabilidad']),
    'actor_tesoreria', cuentas_29nov.pasa(array['tesoreria']),
    'actor_secretaria', cuentas_29nov.pasa(array['secretaria']),
    'actor_vendedor', cuentas_29nov.pasa(array['vendedor']),
    'actor_visor', cuentas_29nov.pasa(array['visor']),
    'actor_produccion', cuentas_29nov.pasa(array['produccion']),
    'actor_german', cuentas_29nov.pasa(array['german']),
    'actor_preprensa', cuentas_29nov.pasa(array['preprensa']),
    'actor_almacen', cuentas_29nov.pasa(array['almacen'])
  );
  perform set_config('request.jwt.claims', '', true);
  return r;
end
$f$$pieza13$;
  execute $pieza14$create function cuentas_29nov.guardar_fotos() returns int language plpgsql as $f$
declare p record; n int := 0;
begin
  for p in select * from cuentas_29nov.personas loop
    insert into cuentas_29nov.fotos_antes values (p.persona, 'vieja', cuentas_29nov.foto(p.uid_vieja)) on conflict do nothing;
    n := n + 1;
    if p.uid_nueva is not null then
      insert into cuentas_29nov.fotos_antes values (p.persona, 'nueva', cuentas_29nov.foto(p.uid_nueva)) on conflict do nothing;
      n := n + 1;
    end if;
  end loop;
  return n;
end
$f$$pieza14$;
  execute $pieza15$create function cuentas_29nov.comprobar(p_persona text) returns jsonb language plpgsql as $f$
declare
  p cuentas_29nov.personas; ahora jsonb; v jsonb; n jsonb; k text; esperado jsonb; difs jsonb := '{}';
  pf text[] := array['pf_sesion','pf_rol','pf_usuario','pf_escribe','ordenes','ocs'];
  cbf text[] := array['cbf_rol','cbf_admin','interno'];
  alm text[] := array['alm_perfil','alm_rol','alm_empleado','alm_administra','alm_compra','alm_direccion','alm_corte','alm_quien','alm_area'];
  actor text[] := array['actor_admin','actor_karla','actor_contabilidad','actor_tesoreria','actor_secretaria','actor_vendedor','actor_visor','actor_produccion','actor_german','actor_preprensa','actor_almacen'];
begin
  select * into p from cuentas_29nov.personas where persona = p_persona;
  if not found then raise exception 'No conozco a %', p_persona; end if;
  select foto into v from cuentas_29nov.fotos_antes where persona = p_persona and cuenta = 'vieja';
  select foto into n from cuentas_29nov.fotos_antes where persona = p_persona and cuenta = 'nueva';
  if p.tipo = 'correo' then
    ahora := cuentas_29nov.foto(p.uid_vieja);
    for k in select jsonb_object_keys(v) loop
      if ahora -> k is distinct from v -> k then difs := difs || jsonb_build_object(k, jsonb_build_object('debe', v -> k, 'es', ahora -> k)); end if;
    end loop;
    return difs;
  end if;
  ahora := cuentas_29nov.foto(p.uid_nueva);
  foreach k in array pf loop
    if ahora -> k is distinct from v -> k then difs := difs || jsonb_build_object(k, jsonb_build_object('debe', v -> k, 'es', ahora -> k)); end if;
  end loop;
  foreach k in array cbf loop
    esperado := case when k = 'interno' then 'true'::jsonb else n -> k end;
    if ahora -> k is distinct from esperado then difs := difs || jsonb_build_object(k, jsonb_build_object('debe', esperado, 'es', ahora -> k)); end if;
  end loop;
  foreach k in array alm loop
    esperado := case when p.externa then n -> k else v -> k end;
    if ahora -> k is distinct from esperado then difs := difs || jsonb_build_object(k, jsonb_build_object('debe', esperado, 'es', ahora -> k)); end if;
  end loop;
  foreach k in array actor loop
    if ((v ->> k) <> 'NO' or (n ->> k) <> 'NO') <> ((ahora ->> k) <> 'NO') then
      difs := difs || jsonb_build_object(k, jsonb_build_object('vieja', v -> k, 'nueva', n -> k, 'es', ahora -> k));
    end if;
  end loop;
  return difs;
end
$f$$pieza15$;
  execute $pieza16$create function cuentas_29nov.pasar_correo(p_persona text) returns jsonb language plpgsql as $f$
declare p cuentas_29nov.personas; v_actual text; v_ident int;
begin
  select * into p from cuentas_29nov.personas where persona = p_persona;
  if not found then raise exception 'No conozco a %', p_persona; end if;
  if p.tipo <> 'correo' then raise exception '% no cambia de correo: tiene cuenta nueva, va con ligar()', p_persona; end if;
  select email into v_actual from auth.users where id = p.uid_vieja for update;
  if v_actual = p.correo_nuevo then return jsonb_build_object('persona', p_persona, 'ya_estaba', true); end if;
  if v_actual is distinct from p.correo_viejo then raise exception 'La cuenta de % dice %: no es la de esperar (%)', p_persona, v_actual, p.correo_viejo; end if;
  if exists (select 1 from auth.users where lower(email) = p.correo_nuevo) then raise exception 'Ya hay una cuenta con %', p.correo_nuevo; end if;
  update auth.users set email = p.correo_nuevo, updated_at = now() where id = p.uid_vieja;
  update auth.identities set identity_data = identity_data || jsonb_build_object('email', p.correo_nuevo), updated_at = now()
   where user_id = p.uid_vieja and provider = 'email';
  get diagnostics v_ident = row_count;
  insert into cuentas_29nov.bitacora (persona, accion, detalle) values (p_persona, 'pasar_correo', jsonb_build_object('de', p.correo_viejo, 'a', p.correo_nuevo, 'identidades', v_ident));
  return jsonb_build_object('persona', p_persona, 'correo', p.correo_nuevo, 'identidades', v_ident, 'diferencias', cuentas_29nov.comprobar(p_persona));
end
$f$$pieza16$;
  execute $pieza17$create function cuentas_29nov.ligar(p_persona text, p_desde timestamptz default '2026-11-26', p_sin_comprobar boolean default false) returns jsonb language plpgsql as $f$
declare p cuentas_29nov.personas; v_fila uuid; v_entro timestamptz; v_prog text[]; v_resp text[]; v_req text[];
begin
  select * into p from cuentas_29nov.personas where persona = p_persona;
  if not found then raise exception 'No conozco a %', p_persona; end if;
  if p.tipo <> 'ligar' then raise exception '% no se liga: cambia de correo, va con pasar_correo()', p_persona; end if;
  select user_id into v_fila from public.users where username = p.usuario_pf for update;
  if v_fila = p.uid_nueva then return jsonb_build_object('persona', p_persona, 'ya_estaba', true); end if;
  if v_fila is distinct from p.uid_vieja then raise exception 'El renglón % de PrintFlow está en otra cuenta (%)', p.usuario_pf, v_fila; end if;
  select last_sign_in_at into v_entro from auth.users where id = p.uid_nueva and email = p.correo_nuevo and banned_until is null;
  if not found then raise exception 'La cuenta % no existe o está apagada', p.correo_nuevo; end if;
  if not p_sin_comprobar and (v_entro is null or v_entro < p_desde) then
    raise exception '% no ha entrado con % desde el %: la última fue el %. Que entre a CobranzaFlow con su correo, o usa p_sin_comprobar con el OK de Marcelo.', p_persona, p.correo_nuevo, p_desde, v_entro;
  end if;
  update public.users set user_id = p.uid_nueva where username = p.usuario_pf and user_id = p.uid_vieja;
  with u as (update cobranza.preguntas set creada_por = p.uid_nueva::text where creada_por = p.uid_vieja::text returning id::text) select array_agg(id) into v_prog from u;
  with u as (update cobranza.preguntas set respondida_por = p.uid_nueva where respondida_por = p.uid_vieja returning id::text) select array_agg(id) into v_resp from u;
  with u as (update almacen.requisiciones set solicitante_uid = p.uid_nueva where solicitante_uid = p.uid_vieja returning id::text) select array_agg(id) into v_req from u;
  insert into cuentas_29nov.bitacora (persona, accion, detalle) values (p_persona, 'ligar',
    jsonb_build_object('usuario_pf', p.usuario_pf, 'de', p.uid_vieja, 'a', p.uid_nueva, 'preguntas_mandadas', coalesce(to_jsonb(v_prog), '[]'), 'preguntas_contestadas', coalesce(to_jsonb(v_resp), '[]'), 'requisiciones', coalesce(to_jsonb(v_req), '[]'), 'sin_comprobar', p_sin_comprobar));
  return jsonb_build_object('persona', p_persona, 'usuario_pf', p.usuario_pf, 'cuenta', p.correo_nuevo, 'preguntas_mandadas', coalesce(array_length(v_prog, 1), 0), 'preguntas_contestadas', coalesce(array_length(v_resp, 1), 0),
    'requisiciones', coalesce(array_length(v_req, 1), 0), 'diferencias', cuentas_29nov.comprobar(p_persona));
end
$f$$pieza17$;
  execute $pieza18$create function cuentas_29nov.apagar_vieja(p_persona text) returns jsonb language plpgsql as $f$
declare p cuentas_29nov.personas; v_ligada timestamptz; v_entro timestamptz;
begin
  select * into p from cuentas_29nov.personas where persona = p_persona;
  if not found then raise exception 'No conozco a %', p_persona; end if;
  if p.tipo <> 'ligar' then raise exception '% no tiene cuenta vieja: la suya sólo cambió de correo', p_persona; end if;
  select max(cuando) into v_ligada from cuentas_29nov.bitacora where persona = p_persona and accion = 'ligar';
  if v_ligada is null or not exists (select 1 from public.users where username = p.usuario_pf and user_id = p.uid_nueva) then raise exception 'Primero ligar(): % sigue en su cuenta vieja', p_persona; end if;
  select greatest(u.last_sign_in_at, (select max(s.created_at) from auth.sessions s where s.user_id = u.id)) into v_entro from auth.users u where u.id = p.uid_nueva;
  if v_entro is null or v_entro <= v_ligada then
    raise exception '% no ha entrado con % desde que se ligó (%): su cuenta vieja se queda como está.', p_persona, p.correo_nuevo, v_ligada;
  end if;
  update auth.users set banned_until = 'infinity', updated_at = now() where id = p.uid_vieja;
  insert into cuentas_29nov.bitacora (persona, accion, detalle) values (p_persona, 'apagar_vieja', jsonb_build_object('cuenta', p.correo_viejo, 'entro_con_la_nueva', v_entro));
  return jsonb_build_object('persona', p_persona, 'apagada', p.correo_viejo, 'entro_con_la_nueva', v_entro);
end
$f$$pieza18$;
  execute $pieza19$create function cuentas_29nov.regresar(p_persona text) returns jsonb language plpgsql as $f$
declare p cuentas_29nov.personas; b jsonb; x text;
begin
  select * into p from cuentas_29nov.personas where persona = p_persona;
  if not found then raise exception 'No conozco a %', p_persona; end if;
  if p.tipo = 'correo' then
    update auth.users set email = p.correo_viejo, updated_at = now() where id = p.uid_vieja and email = p.correo_nuevo;
    update auth.identities set identity_data = identity_data || jsonb_build_object('email', p.correo_viejo), updated_at = now() where user_id = p.uid_vieja and provider = 'email';
  else
    update auth.users set banned_until = null, updated_at = now() where id = p.uid_vieja;
    update public.users set user_id = p.uid_vieja where username = p.usuario_pf and user_id = p.uid_nueva;
    select detalle into b from cuentas_29nov.bitacora where persona = p_persona and accion = 'ligar' order by id desc limit 1;
    if b is not null then
      for x in select jsonb_array_elements_text(b -> 'preguntas_mandadas') loop update cobranza.preguntas set creada_por = p.uid_vieja::text where id = x::uuid and creada_por = p.uid_nueva::text; end loop;
      for x in select jsonb_array_elements_text(b -> 'preguntas_contestadas') loop update cobranza.preguntas set respondida_por = p.uid_vieja where id = x::uuid and respondida_por = p.uid_nueva; end loop;
      for x in select jsonb_array_elements_text(b -> 'requisiciones') loop update almacen.requisiciones set solicitante_uid = p.uid_vieja where id = x::uuid and solicitante_uid = p.uid_nueva; end loop;
    end if;
  end if;
  insert into cuentas_29nov.bitacora (persona, accion) values (p_persona, 'regresar');
  return jsonb_build_object('persona', p_persona, 'regresada', true);
end
$f$$pieza19$;

  perform set_config('app.ensayo', 'si', true);
  r := r || jsonb_build_object('fotos', cuentas_29nov.guardar_fotos());

  for p in select * from cuentas_29nov.personas loop
    if (select foto from cuentas_29nov.fotos_antes f where f.persona = p.persona and f.cuenta = 'vieja') is distinct from antes -> (p.persona || ':vieja') then
      fallas := fallas || ('0 la foto de la cuenta vieja de ' || p.persona || ' cambió sólo con aplicar la base');
    end if;
    if p.uid_nueva is not null and (select foto from cuentas_29nov.fotos_antes f where f.persona = p.persona and f.cuenta = 'nueva') is distinct from antes -> (p.persona || ':nueva') then
      fallas := fallas || ('0 la foto de la cuenta nueva de ' || p.persona || ' cambió sólo con aplicar la base');
    end if;
  end loop;

  for p in select * from cuentas_29nov.personas where tipo = 'correo' loop
    x := cuentas_29nov.pasar_correo(p.persona);
    if x -> 'diferencias' <> '{}'::jsonb then fallas := fallas || ('1 ' || p.persona || ': ' || (x -> 'diferencias')::text); end if;
    if not exists (select 1 from auth.users u where u.id = p.uid_vieja and u.email = p.correo_nuevo) then fallas := fallas || ('1 ' || p.persona || ': el correo no cambió'); end if;
    if not exists (select 1 from auth.identities i where i.user_id = p.uid_vieja and i.email = p.correo_nuevo) then fallas := fallas || ('1 ' || p.persona || ': la identidad no cambió'); end if;
    if (cuentas_29nov.pasar_correo(p.persona) ->> 'ya_estaba') is distinct from 'true' then fallas := fallas || ('1 ' || p.persona || ': no es de una sola vez'); end if;
  end loop;

  begin
    perform cuentas_29nov.ligar('dulce');
    fallas := fallas || '2 ligó a Dulce sin que entrara con la nueva'::text;
  exception when others then
    if sqlerrm !~ 'no ha entrado' then fallas := fallas || ('2 otro error: ' || sqlerrm); end if;
  end;

  insert into cobranza.preguntas (clave, para, prioridad, contexto, titulo, pregunta, por_que_importa, opciones, creada_por)
    values ('almacen-no-pude-ensayo-29nov', array['direccion'], 1, 'ensayo', 'ensayo', 'ensayo', 'ensayo', array['a'], 'e5bff9c2-2c81-4a5b-8dac-a1d4ee778c3e');
  for p in select * from cuentas_29nov.personas where tipo = 'ligar' loop
    x := cuentas_29nov.ligar(p.persona, p_sin_comprobar => true);
    if x -> 'diferencias' <> '{}'::jsonb then fallas := fallas || ('3 ' || p.persona || ': ' || (x -> 'diferencias')::text); end if;
    r := r || jsonb_build_object('foto_' || p.persona, cuentas_29nov.foto(p.uid_nueva) - array['actor_admin','actor_karla','actor_tesoreria','actor_produccion','actor_german','actor_preprensa','actor_almacen','pf_escribe','alm_empleado','alm_direccion','interno','cbf_admin','ocs']);
    perform set_config('request.jwt.claims', json_build_object('sub', p.uid_vieja, 'role', 'authenticated')::text, true);
    if exists (select 1 from public.get_my_session()) then fallas := fallas || ('3 ' || p.persona || ': la cuenta vieja sigue con perfil'); end if;
    perform set_config('request.jwt.claims', '', true);
    if (cuentas_29nov.ligar(p.persona, p_sin_comprobar => true) ->> 'ya_estaba') is distinct from 'true' then fallas := fallas || ('3 ' || p.persona || ': no es de una sola vez'); end if;
  end loop;
  if not exists (select 1 from cobranza.preguntas q where q.clave = 'almacen-no-pude-ensayo-29nov' and q.creada_por = '06072388-3784-4a5b-b9a8-ad0437ef3311') then fallas := fallas || '3 lo que mandó Karla no pasó a su cuenta nueva'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', '6029dd6f-9122-4eeb-99e5-a06554dd0445', 'role', 'authenticated')::text, true);
  if not coalesce(almacen.puede_ver_corte(), false) then fallas := fallas || '4 Dulce ya no ve «Corte del mes»'::text; end if;
  if almacen._rol_efectivo() is distinct from 'contabilidad' then fallas := fallas || ('4 Dulce en Almacén es ' || coalesce(almacen._rol_efectivo(), 'nada')); end if;
  if cuentas_29nov.pasa(array['admin','karla','contabilidad']) is distinct from 'contabilidad' then fallas := fallas || '4 Dulce no puede pagar comisiones'::text; end if;
  if (select s.role from public.get_my_session() s) is distinct from 'visor' then fallas := fallas || '4 Dulce en PrintFlow no es visor'::text; end if;
  if cuentas_29nov.pasa(array['admin','karla','secretaria','vendedor']) <> 'NO' then fallas := fallas || '4 Dulce pasa donde sólo escriben los de PrintFlow'::text; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', '0c2a10ee-9341-4a12-ae5c-2d46d36e63ed', 'role', 'authenticated')::text, true);
  if almacen._rol_efectivo() is distinct from 'secretaria' then fallas := fallas || ('4 Lupita en Almacén es ' || coalesce(almacen._rol_efectivo(), 'nada') || ', no secretaria'); end if;
  if almacen._mi_area() is distinct from 'oficina' then fallas := fallas || ('4 Lupita en Almacén es del área ' || coalesce(almacen._mi_area(), 'ninguna')); end if;
  if cobranza.current_user_role() is distinct from 'vendedor' then fallas := fallas || '4 Lupita dejó de ser vendedor en CobranzaFlow'::text; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', '76714606-59a6-42e3-8d1c-49ebb52bb2a9', 'role', 'authenticated')::text, true);
  if public.pf_uid_role() is distinct from 'vendedor' or public.pf_uid_username() is distinct from 'genaro' then fallas := fallas || '4 Genaro no es vendedor/genaro en PrintFlow'::text; end if;
  if (select count(*) from public.pf_visible_order_ids()) >= (select count(*) from public.orders) then fallas := fallas || '4 Genaro ve todas las órdenes'::text; end if;
  if cobranza.current_user_role() is distinct from 'vendedor' then fallas := fallas || '4 Genaro dejó de ser vendedor en CobranzaFlow'::text; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', '6f68a403-e726-453a-a1ad-599734a56728', 'role', 'authenticated')::text, true);
  if (select p2.username from almacen.mi_perfil() p2 limit 1) is distinct from 'marcelo' then fallas := fallas || '4 Marcelo perdió su carrito: su usuario en Almacén ya no es marcelo'::text; end if;
  if almacen.quien() is distinct from 'Marcelo' then fallas := fallas || ('4 Almacén firma a Marcelo como ' || almacen.quien()); end if;
  if (select s.role from public.get_my_session() s) is distinct from 'admin' then fallas := fallas || '4 Marcelo no es admin en PrintFlow'::text; end if;
  perform set_config('request.jwt.claims', '', true);

  begin
    perform cuentas_29nov.apagar_vieja('karla');
    fallas := fallas || '5 apagó la vieja de Karla sin que entrara con la nueva'::text;
  exception when others then
    if sqlerrm !~ 'no ha entrado' then fallas := fallas || ('5 otro error: ' || sqlerrm); end if;
  end;
  begin
    perform cuentas_29nov.apagar_vieja('gerardo');
    fallas := fallas || '5 quiso apagar la cuenta de Gerardo, que es la única que tiene'::text;
  exception when others then
    if sqlerrm !~ 'no tiene cuenta vieja' then fallas := fallas || ('5 otro error: ' || sqlerrm); end if;
  end;
  update auth.users set last_sign_in_at = now() + interval '1 minute' where id = '06072388-3784-4a5b-b9a8-ad0437ef3311';
  x := cuentas_29nov.apagar_vieja('karla');
  if not exists (select 1 from auth.users u where u.id = 'e5bff9c2-2c81-4a5b-8dac-a1d4ee778c3e' and u.banned_until = 'infinity') then fallas := fallas || '5 la vieja de Karla no quedó apagada'::text; end if;
  if not exists (select 1 from auth.users u where u.id = 'e5bff9c2-2c81-4a5b-8dac-a1d4ee778c3e') then fallas := fallas || '5 borró la cuenta vieja de Karla'::text; end if;

  begin
    update public.users set user_id = '06072388-3784-4a5b-b9a8-ad0437ef3311' where username = 'genaro';
    fallas := fallas || '6 dejó dos renglones de PrintFlow en la misma cuenta'::text;
  exception when unique_violation then null;
  end;

  for p in select * from cuentas_29nov.personas loop
    x := cuentas_29nov.regresar(p.persona);
    if p.tipo = 'correo' and not exists (select 1 from auth.users u join auth.identities i on i.user_id = u.id where u.id = p.uid_vieja and u.email = p.correo_viejo and i.email = p.correo_viejo) then
      fallas := fallas || ('7 ' || p.persona || ': el correo no regresó');
    end if;
    if cuentas_29nov.foto(p.uid_vieja) is distinct from antes -> (p.persona || ':vieja') then fallas := fallas || ('7 ' || p.persona || ': la cuenta vieja no quedó como antes'); end if;
    if p.uid_nueva is not null and cuentas_29nov.foto(p.uid_nueva) is distinct from antes -> (p.persona || ':nueva') then fallas := fallas || ('7 ' || p.persona || ': la cuenta nueva no quedó como antes'); end if;
  end loop;
  if not exists (select 1 from cobranza.preguntas q where q.clave = 'almacen-no-pude-ensayo-29nov' and q.creada_por = 'e5bff9c2-2c81-4a5b-8dac-a1d4ee778c3e') then fallas := fallas || '7 lo que mandó Karla no regresó'::text; end if;
  if exists (select 1 from auth.users u where u.id = 'e5bff9c2-2c81-4a5b-8dac-a1d4ee778c3e' and u.banned_until is not null) then fallas := fallas || '7 la vieja de Karla sigue apagada'::text; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', 'a87ef072-2b56-4fdc-8dd3-59ff7b25f8fd', 'role', 'authenticated')::text, true);
  if almacen._rol_efectivo() is distinct from 'tesoreria' or exists (select 1 from public.get_my_session()) then fallas := fallas || '8 a Lucero le cambió algo'::text; end if;
  perform set_config('request.jwt.claims', '', true);

  if array_length(fallas, 1) is null then
    raise exception 'ENSAYO OK, 0 fallas. %', r::text;
  end if;
  raise exception 'ENSAYO CON % FALLAS: %', array_length(fallas, 1), array_to_string(fallas, ' || ');
end
$ensayo$;
