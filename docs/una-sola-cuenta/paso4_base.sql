-- Una sola cuenta nombre@sygma.mx: LA BASE DEL PASO 4. NO se aplica mientras Marcelo viaja: se aplica el domingo 29-nov, con su OK, antes de tocar a nadie (docs/una-sola-cuenta/LEEME.md).
-- Sola no le cambia nada a nadie: nadie tiene renglón en public.users y en cobranza.users o cuentas_externas con la misma cuenta, hasta que se ligue (medido el 6-nov).
--   1. almacen.mi_perfil, _rol_efectivo y quien: lo de almacen.cuentas_externas manda sobre public.users. Sin esto, al ligarlos, Dulce pasaría a «visor» en Almacén (sin «Corte del mes») y Marcelo a «admin», sin su carrito.
--   2. public.verify_actor_role: pasa con el rol de PrintFlow o con el de CobranzaFlow. Sin esto, al ligarla, Dulce perdería diez funciones de CobranzaFlow (pagar comisiones, REP atorados…).
--   3. El esquema cuentas_29nov, sólo del dueño de la base: una línea por persona, con su revisión, su bitácora y su vuelta atrás. Se quita cuando pase el cambio.
-- Si alguna de esas cuatro funciones cambió desde el 6-nov, se detiene sin tocar nada.
-- Vuelta atrás: paso4_base_vuelta_atras.sql. Registrar como `una_sola_cuenta_paso4_base`.
begin;

do $revisa$
declare r record;
begin
  -- Si alguien cambió estas funciones desde el 6-nov, se detiene sin tocar nada: hay que volver a mirarlas.
  for r in select * from (values ('almacen.mi_perfil', 'ca4e0bebd967f8fe8a99f22896018128'), ('almacen._rol_efectivo', '3e97fe255cd42e93aee76878ebca0306'), ('almacen.quien', '2cfe2352b271abf4ec97b678f7157f4f'), ('public.verify_actor_role', 'a36f6faaf6fe7475eeeb8221d4e3c126')) as h(f, huella) loop
    if md5(pg_get_functiondef(r.f::regproc)) is distinct from r.huella then
      raise exception 'La función % cambió desde el 6-nov-2026: vuelve a compararla antes de aplicar esto.', r.f;
    end if;
  end loop;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_my_session') then
    raise exception 'Falta public.get_my_session (v10.84.190): este paquete va después del paso 2.';
  end if;
end
$revisa$;

create or replace function almacen.mi_perfil()
 returns table(username text, rol text, nombre text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  -- Una sola cuenta (29-nov-2026): con una sola cuenta, quien tiene renglón aquí lo tiene también en public.users (Dulce, Marcelo). Lo de Almacén manda
  -- en Almacén: Dulce sigue siendo «contabilidad» (ve «Corte del mes») y Marcelo sigue siendo «marcelo» (su carrito), no «visor» ni «admin».
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
$function$;

create or replace function almacen._rol_efectivo()
 returns text
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  -- Una sola cuenta (29-nov-2026): lo de Almacén manda en Almacén (ver mi_perfil).
  select coalesce(
    (select e.rol from almacen.cuentas_externas e where e.uid = auth.uid() and e.activa limit 1),
    public.pf_uid_role())
$function$;

create or replace function almacen.quien()
 returns text
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  -- Una sola cuenta (29-nov-2026): lo de Almacén manda en Almacén (ver mi_perfil). Lo que Marcelo registre sigue firmado «Marcelo», no «Administrador».
  select coalesce(
    (select e.nombre from almacen.cuentas_externas e where e.uid = auth.uid() and e.activa limit 1),
    (select coalesce(display_name, username) from public.users
      where user_id = auth.uid() and active = true limit 1),
    'sistema')
$function$;

create or replace function public.verify_actor_role(p_actor text, p_allowed_roles text[])
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

  -- F2-full: SIN sesión autenticada no se permite (el bypass anon-forge del string p_actor queda cerrado).
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida: inicia sesión para realizar esta operación.' USING ERRCODE='42501';
  END IF;

  -- Identidad criptográfica: el rol sale del uid del JWT, NO del string p_actor.
  -- Una sola cuenta (29-nov-2026): una cuenta puede tener renglón en las DOS tablas (Dulce: «visor» en PrintFlow y «contabilidad» en CobranzaFlow). Pasa con
  -- cualquiera de los dos: con sólo el de PrintFlow, Dulce perdería de golpe las diez funciones de CobranzaFlow que dejan a contabilidad (pagar comisiones, los REP atorados…).
  SELECT role INTO v_role FROM public.users WHERE user_id = v_uid AND active = true LIMIT 1;
  -- CobranzaFlow (misma auth): mapear roles a los de PrintFlow
  SELECT CASE role WHEN 'direccion' THEN 'admin' WHEN 'cxc' THEN 'karla' WHEN 'vendedor' THEN 'vendedor_cbf' ELSE role END
    INTO v_cbf FROM cobranza.users WHERE id = v_uid AND active = true LIMIT 1;
  IF v_role IS NULL AND v_cbf IS NULL THEN
    RAISE EXCEPTION 'Sesión autenticada sin rol asignado (uid %). Contacta al administrador.', v_uid USING ERRCODE='42501';
  END IF;

  IF v_role = ANY(p_allowed_roles) THEN RETURN v_role; END IF;
  IF v_cbf = ANY(p_allowed_roles) THEN RETURN v_cbf; END IF;
  RAISE EXCEPTION 'Actor (rol: %) no autorizado. Permitidos: %',
    COALESCE(v_role, v_cbf), array_to_string(p_allowed_roles, ', ') USING ERRCODE='42501';
END$function$;

create schema cuentas_29nov;

revoke all on schema cuentas_29nov from public, anon, authenticated, service_role;

comment on schema cuentas_29nov is 'Una sola cuenta (29-nov-2026): las herramientas del cambio, persona por persona, con su bitácora. Sólo el dueño de la base. Se quita cuando pase el cambio (docs/una-sola-cuenta/LEEME.md).';

create table cuentas_29nov.personas (
  persona text primary key,
  tipo text not null check (tipo in ('correo', 'ligar')),
  uid_vieja uuid not null,
  correo_viejo text not null,
  uid_nueva uuid,
  correo_nuevo text not null,
  usuario_pf text not null,
  externa boolean not null default false,   -- tiene renglón en almacen.cuentas_externas: en Almacén sigue siendo el de su cuenta nueva
  check ((tipo = 'correo') = (uid_nueva is null))
);

insert into cuentas_29nov.personas (persona, tipo, uid_vieja, correo_viejo, uid_nueva, correo_nuevo, usuario_pf, externa) values
  ('arturo',  'correo', '4bdf6010-65a8-490b-a815-37e89dc17940', 'arturo@padillahnos.local',     null,                                   'arturo@sygma.mx',  'arturo',     false),
  ('gerardo', 'correo', '1c1ba04c-9195-4579-9b4d-a0a2366e07e9', 'gerardo@padillahnos.local',    null,                                   'gerardo@sygma.mx', 'gerardo',    false),
  ('german',  'correo', 'f9fc2b18-3dbb-422a-a9cb-70ca03bf170b', 'german@padillahnos.local',     null,                                   'german@sygma.mx',  'german',     false),
  ('noemi',   'correo', 'ac0a8997-c507-48cb-ba2e-5ea77ea4b27b', 'noemi@padillahnos.local',      null,                                   'noemi@sygma.mx',   'noemi',      false),
  ('karla',   'ligar',  'e5bff9c2-2c81-4a5b-8dac-a1d4ee778c3e', 'karla@padillahnos.local',      '06072388-3784-4a5b-b9a8-ad0437ef3311', 'karla@sygma.mx',   'karla',      false),
  ('genaro',  'ligar',  'f321f84b-582b-4ee8-9ee1-9a3138654f5c', 'genaro@padillahnos.local',     '76714606-59a6-42e3-8d1c-49ebb52bb2a9', 'genaro@sygma.mx',  'genaro',     false),
  ('dulce',   'ligar',  '0ec50922-b1bb-4666-a09f-738242c2255e', 'dulce@padillahnos.local',      '6029dd6f-9122-4eeb-99e5-a06554dd0445', 'dulce@sygma.mx',   'dulce',      true),
  ('lupita',  'ligar',  '6b85fba8-383f-495c-ae4a-8cf5858c4a15', 'secretaria@padillahnos.local', '0c2a10ee-9341-4a12-ae5c-2d46d36e63ed', 'lupita@sygma.mx',  'secretaria', false),
  ('marcelo', 'ligar',  '80fa4231-bff6-4e14-9943-6cc5a418c481', 'admin@padillahnos.local',      '6f68a403-e726-453a-a1ad-599734a56728', 'marcelo@sygma.mx', 'admin',      true);

create table cuentas_29nov.bitacora (
  id bigserial primary key,
  persona text not null references cuentas_29nov.personas (persona),
  accion text not null,
  cuando timestamptz not null default now(),
  quien text not null default current_user,
  detalle jsonb not null default '{}'
);

create table cuentas_29nov.fotos_antes (
  persona text not null references cuentas_29nov.personas (persona),
  cuenta text not null check (cuenta in ('vieja', 'nueva')),
  foto jsonb not null,
  primary key (persona, cuenta)
);

create function cuentas_29nov.pasa(p_roles text[]) returns text language plpgsql as $f$
begin
  return public.verify_actor_role('prueba', p_roles);
exception when others then
  return 'NO';
end
$f$;

-- Lo que la base le contesta a una cuenta: lo que PrintFlow, CobranzaFlow y Almacén deciden con ella. Sólo lee.
create function cuentas_29nov.foto(p_uid uuid) returns jsonb language plpgsql as $f$
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
$f$;

-- La foto de cómo está cada cuenta ANTES de tocar nada. Se saca una vez, al instalar.
create function cuentas_29nov.guardar_fotos() returns int language plpgsql as $f$
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
$f$;

-- Compara cómo quedó la cuenta de la persona contra lo que debe ser. Devuelve las diferencias: vacío es «quedó igual que antes».
--   correo: todo igual, con la misma cuenta.
--   ligar: en PrintFlow, como su cuenta vieja; en CobranzaFlow, como su cuenta nueva; en Almacén, como su cuenta nueva si tiene renglón en cuentas_externas (Dulce, Marcelo) y si no, como la vieja.
--   verify_actor_role: pasa con todo lo que pasaba con cualquiera de las dos.
create function cuentas_29nov.comprobar(p_persona text) returns jsonb language plpgsql as $f$
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
    -- lo que pasaba con cualquiera de las dos tiene que seguir pasando; y nada más. vendedor_cbf no está en ninguna lista: no cuenta.
    if ((v ->> k) <> 'NO' or (n ->> k) <> 'NO') <> ((ahora ->> k) <> 'NO') then
      difs := difs || jsonb_build_object(k, jsonb_build_object('vieja', v -> k, 'nueva', n -> k, 'es', ahora -> k));
    end if;
  end loop;
  return difs;
end
$f$;

-- Arturo, Gerardo, Germán y Noemí: su cuenta de siempre cambia de correo. El mismo id, la misma contraseña; quien ya estaba adentro no se entera.
create function cuentas_29nov.pasar_correo(p_persona text) returns jsonb language plpgsql as $f$
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
$f$;

-- Karla, Genaro, Dulce, Lupita y Marcelo: su renglón de PrintFlow pasa a su cuenta nombre@sygma.mx. La vieja NO se apaga aquí, pero desde este momento ya no tiene perfil en PrintFlow.
-- Por eso pide que la persona haya entrado con la nueva después de p_desde (lo dice medir.sql), salvo que se pida lo contrario con p_sin_comprobar.
-- Lo que iba a su nombre por uid y hay que ver con la cuenta nueva se pasa, y se anota para poder regresarlo: lo que mandó (cobranza.preguntas) y sus requisiciones.
-- Lo demás no: public.orders y compañía guardan su usuario de PrintFlow (no cambia), y sus *_uid son historia de una cuenta que sigue existiendo.
create function cuentas_29nov.ligar(p_persona text, p_desde timestamptz default '2026-11-26', p_sin_comprobar boolean default false) returns jsonb language plpgsql as $f$
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
$f$;

-- La cuenta vieja se apaga SÓLO si la persona ya entró con la nueva después de ligarla (Marcelo, 6-nov: «sólo después de que cada quien entró con la nueva»). Sin borrar nada: banned_until, como Christian, Jaime y Pepe Chuy.
create function cuentas_29nov.apagar_vieja(p_persona text) returns jsonb language plpgsql as $f$
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
$f$;

-- La vuelta atrás de UNA persona, a como estaba: su correo, o su renglón de PrintFlow y lo que se pasó con él, y su cuenta vieja encendida.
create function cuentas_29nov.regresar(p_persona text) returns jsonb language plpgsql as $f$
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
$f$;

select cuentas_29nov.guardar_fotos();

select
  (select count(*) from cuentas_29nov.personas) as personas,
  (select count(*) from cuentas_29nov.fotos_antes) as fotos,
  md5(pg_get_functiondef('almacen.mi_perfil'::regproc)) as mi_perfil,
  md5(pg_get_functiondef('almacen._rol_efectivo'::regproc)) as rol_efectivo,
  md5(pg_get_functiondef('almacen.quien'::regproc)) as quien,
  md5(pg_get_functiondef('public.verify_actor_role'::regproc)) as verify_actor_role;

commit;
