-- Una contraseña nueva para Arturo, Gerardo, Germán o Noemí: los que no están en CobranzaFlow.
-- A los de CobranzaFlow (Karla, Genaro, Dulce, Lupita y los demás): «Nueva contraseña» de CobranzaFlow, que hace lo mismo.
-- Sólo la cambia Marcelo (8-nov-2026: «solo yo cambio una contraseña»), en el editor SQL del panel de Supabase.
--
-- 1. Cambia NOMBRE por el de la persona: arturo, gerardo, german o noemi (con acento o mayúsculas también sirve).
-- 2. Run. Sale UN renglón: su correo y su contraseña nueva, 12 letras y números al azar, como las de «Nueva contraseña».
--    Si no sale ninguno, el nombre está mal escrito (o se quedó NOMBRE) y no cambió nada.
-- 3. Dísela en persona. Sólo se ve en ese resultado: la consulta no la guarda. Si se pierde, se corre otra vez y sale otra.
--
-- No cierra ninguna sesión: lo que ya estaba abierto sigue abierto, y la nueva se pide la próxima vez que entre.
-- Sirve antes y después del 29-nov (busca nombre@padillahnos.local y nombre@sygma.mx) y sólo toca a esos cuatro.
-- Probado el 8-nov sin cambiar nada: LEEME.md, «Contraseñas».

with quien as (
  select translate(lower(trim('NOMBRE')), 'áéíóúü', 'aeiouu') as nombre
),
nueva as materialized (
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', get_byte(r.b, i) % 55 + 1, 1), '' order by i) as clave
    from (select extensions.gen_random_bytes(12) as b) r, generate_series(0, 11) as i
)
update auth.users u
   set encrypted_password = extensions.crypt(nueva.clave, extensions.gen_salt('bf', 10))
  from quien, nueva
 where quien.nombre in ('arturo', 'gerardo', 'german', 'noemi')
   and u.email in (quien.nombre || '@padillahnos.local', quien.nombre || '@sygma.mx')
returning u.email as correo, nueva.clave as contrasena_nueva;
