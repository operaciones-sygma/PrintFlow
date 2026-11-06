-- Una sola cuenta: cómo están las cuentas hoy, SÓLO LEYENDO (ni contraseñas ni tokens). Se corre tal cual en el editor o por execute_sql.
-- Lo que hay que ver antes de ligar a alguien: «entro_con_la_nueva» (cuándo entró por última vez con su contraseña en nombre@sygma.mx).
with personas(persona, tipo, uid_vieja, uid_nueva, usuario_pf) as (values
  ('arturo',  'correo', '4bdf6010-65a8-490b-a815-37e89dc17940'::uuid, null::uuid,                                   'arturo'),
  ('gerardo', 'correo', '1c1ba04c-9195-4579-9b4d-a0a2366e07e9'::uuid, null::uuid,                                   'gerardo'),
  ('german',  'correo', 'f9fc2b18-3dbb-422a-a9cb-70ca03bf170b'::uuid, null::uuid,                                   'german'),
  ('noemi',   'correo', 'ac0a8997-c507-48cb-ba2e-5ea77ea4b27b'::uuid, null::uuid,                                   'noemi'),
  ('karla',   'ligar',  'e5bff9c2-2c81-4a5b-8dac-a1d4ee778c3e'::uuid, '06072388-3784-4a5b-b9a8-ad0437ef3311'::uuid, 'karla'),
  ('genaro',  'ligar',  'f321f84b-582b-4ee8-9ee1-9a3138654f5c'::uuid, '76714606-59a6-42e3-8d1c-49ebb52bb2a9'::uuid, 'genaro'),
  ('dulce',   'ligar',  '0ec50922-b1bb-4666-a09f-738242c2255e'::uuid, '6029dd6f-9122-4eeb-99e5-a06554dd0445'::uuid, 'dulce'),
  ('lupita',  'ligar',  '6b85fba8-383f-495c-ae4a-8cf5858c4a15'::uuid, '0c2a10ee-9341-4a12-ae5c-2d46d36e63ed'::uuid, 'secretaria'),
  ('marcelo', 'ligar',  '80fa4231-bff6-4e14-9943-6cc5a418c481'::uuid, '6f68a403-e726-453a-a1ad-599734a56728'::uuid, 'admin')
)
select p.persona, p.tipo,
  v.email as correo_cuenta_vieja, n.email as correo_cuenta_nueva,
  (select pu.user_id from public.users pu where pu.username = p.usuario_pf) = coalesce(p.uid_nueva, p.uid_vieja) as ya_ligada,
  v.banned_until as vieja_apagada_hasta, n.banned_until as nueva_apagada_hasta,
  v.last_sign_in_at as entro_con_la_vieja, n.last_sign_in_at as entro_con_la_nueva,
  (select max(s.updated_at) from auth.sessions s where s.user_id = p.uid_vieja) as ultima_sesion_vieja,
  (select max(s.updated_at) from auth.sessions s where s.user_id = p.uid_nueva) as ultima_sesion_nueva,
  (select count(*) from cobranza.preguntas q where q.creada_por = p.uid_vieja::text) as preguntas_mandadas_con_la_vieja,
  (select count(*) from cobranza.preguntas q where q.respondida_por = p.uid_vieja) as preguntas_contestadas_con_la_vieja,
  (select count(*) from almacen.requisiciones r where r.solicitante_uid = p.uid_vieja) as requisiciones_con_la_vieja,
  (select count(*) from almacen.vales x where x.created_by_uid = p.uid_vieja) as vales_con_la_vieja
from personas p
join auth.users v on v.id = p.uid_vieja
left join auth.users n on n.id = p.uid_nueva
order by p.tipo, p.persona;
