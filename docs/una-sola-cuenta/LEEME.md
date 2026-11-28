# Una sola cuenta `nombre@sygma.mx` en todas las apps

Marcelo, 19-oct-2026: *«en todos se entrara con usuarios como marcelo@sygma.mx»*, y al proponerle que también se pudiera escribir sólo el nombre: *«nooo debe
ser nombre@sygma.mx»*. 6-nov: los pasos 1 a 3, ya, sin que nadie pierda acceso; el 4 y el 5 **no se hacen mientras viaja (9 al 25-nov)**: quedan listos para el
**domingo 29-nov**, el día antes del ensayo de Almacén (propuesto para el lunes 30-nov; **su fecha la confirma Marcelo**). **Marcelo los adelantó al viernes
27-nov** (por Central, 15:06). Lo que pasó esa noche está en «El 27-nov, lo que se hizo», abajo.

| Paso | Qué | Estado |
|---|---|---|
| 1 | «Salir» de Contabilidad y del Cotizador, sólo de esa app | ver el CHANGELOG de cada una |
| 2 | PrintFlow busca el perfil por la cuenta (`get_my_session`, v10.84.190) | **en producción**, 7-nov ~02:35 |
| 3 | PrintFlow acepta también el correo completo, y sigue aceptando el nombre (v10.84.191) | **en producción**, 7-nov ~02:56 |
| 4 | Cada quien a su `@sygma.mx`; apagar las cuentas viejas | **27-nov, en producción**: la base (19:56), los cuatro correos y Marcelo ligado (19:57). Karla, Genaro, Dulce y Lupita, después, con la contraseña temporal. `apagar_vieja`, de nadie todavía |
| 5 | Central y avisarle a la gente | **27-nov**: las pantallas de PrintFlow (v10.84.196), Almacén y Contabilidad. El aviso a la gente va después, con la contraseña temporal |

## Quién cambia y cómo (medido el 6-nov, `medir.sql` lo vuelve a medir)

| Persona | Hoy | El cambio | Contraseña después | Vuelta atrás |
|---|---|---|---|---|
| Arturo, Gerardo, Germán, Noemí | sólo `nombre@padillahnos.local` | `pasar_correo`: la misma cuenta cambia de correo. El mismo id, la misma contraseña; quien ya estaba adentro no se entera. **No hay cuenta vieja que apagar** | la misma; a Gerardo, Germán y Noemí Marcelo se las cambia antes, del 26 al 28 («Contraseñas», abajo) | `regresar` |
| Karla, Genaro, Dulce, Lupita, Marcelo | dos cuentas: la de PrintFlow (Lupita, `secretaria`; Marcelo, `admin`) y `nombre@sygma.mx` | `ligar`: su renglón de PrintFlow pasa a `nombre@sygma.mx`; `apagar_vieja` después, sólo cuando ya entró con la nueva. No se borra ninguna | **la de CobranzaFlow** | `regresar` |
| Lucero, Manuel, Víctor | sólo `@sygma.mx` | nada | | |
| Christian, Jaime, Pepe Chuy | sólo `@sygma.mx`, apagadas (`banned_until`), nunca han entrado | nada | | |

**No se tocan:** `claude-pruebas@…` (las dos: las usan las pruebas), `claude-contabilidad@sygma.mx`, `marcelopadilla@sygma.mx` y `padillamarcelo20@gmail.com` (no están en ninguna tabla de personal; la última, las finanzas personales).

## Lo que se encontró al medir, que el plan del 19-oct no veía

1. **Dulce, dos trampas.** Al ligarla, `public.users` manda sobre lo demás, y ahí es `visor`:
   - en Almacén pasaría de `contabilidad` a `visor` y **dejaría de ver «Corte del mes»**: lo arreglan `mi_perfil`, `_rol_efectivo` y `quien` con `cuentas_externas` primero;
   - en CobranzaFlow **perdería 10 funciones** que pasan por `verify_actor_role` con `contabilidad` (pagar comisiones, adelantos, los REP y timbres atorados, completar datos fiscales…): lo arregla `verify_actor_role` pasando con cualquiera de sus dos roles.
2. **Marcelo.** Sin lo mismo, en Almacén pasaría de `marcelo` a `admin` (su carrito, `almacen.carrito.dueno`, se quedaría sin dueño) y firmaría «Administrador». En PrintFlow sigue siendo «Administrador»; si quiere que diga Marcelo es una línea en `public.users.display_name`, y él lo decide.
3. **Lupita y Genaro (la trampa de la nota).** En CobranzaFlow son `vendedor`. Medido: `cobranza.users` no cambia, así que sus cobros, sus comisiones y lo que ven en CobranzaFlow siguen igual. En la base compartida, `pf_uid_role()` de Lupita pasa de `vendedor` a `secretaria`: en Almacén deja de ser «Ventas» y regresa a «Oficina», como con su cuenta de hoy, y lee todas las órdenes y OC en CobranzaFlow, las que ya ve en PrintFlow. Genaro sigue viendo sólo lo suyo: sus 52 órdenes con `created_by_uid` viejo también traen su nombre (0 sólo por uid).
4. **La cuenta vieja deja de servir en PrintFlow desde que se liga, no desde que se apaga.** `public.users` tiene `username` único y un renglón por persona: no se puede dejar a las dos cuentas con perfil sin tocar decenas de funciones. Por eso la regla de Marcelo («se apagan sólo después de que cada quien entró con la nueva») se cumple así: **antes de ligar se comprueba que la nueva entra** (`ligar` lo revisa contra `last_sign_in_at`), se liga en domingo, sin nadie trabajando, y `apagar_vieja` se niega hasta que la persona haya entrado después. Si algo sale mal, `regresar` la deja como estaba en un segundo.
5. **`lupita@sygma.mx` no tiene renglón en `auth.identities`** (las demás sí) y sí entra: entró el 2-oct y su sesión se usó el 6-nov. Se comprueba el 26-28 nov, como todas.
6. **Lo que mandó cada quien.** `cobranza.preguntas.creada_por` y `respondida_por` y `almacen.requisiciones.solicitante_uid` van por uid: `ligar` los pasa y lo anota para poder regresarlos. Hoy son 0 de las cinco cuentas viejas; `medir.sql` lo dice ese día. Lo demás con `*_uid` (`orders`, `order_timeline`, `notifications`…; miles de renglones) se queda: son historia, y la cuenta sigue existiendo.
7. **Lo de abrir la app del celular o la de otra área:** con el paso 1 ya no le cierra sus otras apps a nadie.
8. **La planta entra a PrintFlow por `print-flow-eosin.vercel.app`, no por `produccion.sygma.mx`** (`edge_logs`, 24 h al 7-nov, medido por Central: 16 llamadas de 7 personas, todas por ese dominio; en `produccion.` sólo las pruebas). Son el mismo despliegue y cada dominio guarda su sesión. Los avisos no mandan a nadie a otra dirección: que sigan entrando por donde entran. La revisión de ese día mira los dos.

## Los archivos

- `medir.sql`: cómo está cada persona, sólo leyendo.
- `paso4_base.sql`: lo que se aplica una vez, antes de tocar a nadie: las cuatro funciones de arriba y el esquema `cuentas_29nov` (una línea por persona, con su bitácora). Se detiene si alguna de las cuatro cambió desde el 6-nov (la huella); **Almacén trae trabajo en camino (su bitácora) y puede cambiar `quien`**: si frena, se vuelve a comparar y se ajusta aquí.
- `paso4_base_vuelta_atras.sql`: lo regresa todo; se detiene si queda alguien sin regresar.
- `paso4_ensayo.sql`: lo anterior más las nueve personas, dentro de un DO que siempre truena: nada se queda. Se corre con `execute_sql`; el resultado es el mensaje de error («ENSAYO OK…»). **Corrido contra la base de verdad el 6-nov-2026, 14:35: 0 fallas, con las 14 cuentas** (Genaro, 81 órdenes; Lupita, `secretaria` en PrintFlow y Almacén y `vendedor` en CobranzaFlow; Dulce, `visor`, `contabilidad`, con «Corte del mes»; Marcelo, «Marcelo» en Almacén), y revisado después que no quedó nada. **Otra vez el 7-nov, 02:21**, con `get_my_session` ya aplicada: 0 fallas, las mismas huellas, y no quedó nada.
- `ensayar-local.mjs`: el mismo ensayo en PGlite, con las cuentas y las funciones copiadas de producción: segundos y sin tocar nada. **9 sabotajes, todos caen** (`armar_paso4.py <sabotaje>`): sin cada una de las cuatro funciones, `verify_actor_role` abierto, ligar sin pasar lo que mandó, apagar sin revisar, regresar sin encender y cambiar el correo sin la identidad.
- `armar_paso4.py`: de donde salen `paso4_base.sql`, su vuelta atrás y el ensayo. Se cambia aquí, no en los `.sql`.
- `mensajes.md`: los textos para la gente, para Central y para Sygma Central.
- `cambiar_contrasena.sql`: una contraseña nueva para Arturo, Gerardo, Germán o Noemí, en el editor del panel («Contraseñas», abajo).

## Contraseñas (Marcelo, 8-nov)

*«solo yo cambio una contraseña vieja. la contraseñas débiles se cambian hasta que regrese de china el 25»*

- **Una olvidada, sólo la cambia Marcelo**, también mientras viaja, si desde allá puede entrar al panel; si no, esa persona espera a que regrese. No se construye nada: era la otra opción a ampliar «Nueva contraseña» para que también la diera Manuel.
  - A quien está en CobranzaFlow (`cobranza.users`: Karla, Genaro, Dulce, Lupita, Lucero, Manuel, Víctor): «Nueva contraseña» de CobranzaFlow. Manuel también la tiene, porque es Dirección; no se le quitó: lo decidido es quién lo hace.
  - A Arturo, Gerardo, Germán y Noemí, que no están en CobranzaFlow: `cambiar_contrasena.sql` en el editor SQL del panel de Supabase. Se cambia NOMBRE por el de la persona, y el resultado da su correo y una contraseña de 12 letras y números al azar, como las de «Nueva contraseña». Si no sale ningún renglón, no cambió nada. Sirve antes y después del 29-nov y sólo toca a esos cuatro.
  - Por el editor no se cierra ninguna sesión: lo abierto sigue abierto y la nueva se pide la próxima vez que entre. Por la API de Auth, la de «Nueva contraseña», cambiar la contraseña termina sus sesiones (según la documentación de Supabase), y Gerardo tiene 21 abiertas.
  - La nueva se entrega en persona. No va en un mensaje ni en una conversación con Claude.
- **Las seis débiles, después del 25-nov.**
  - Gerardo, Germán y Noemí, del 26 al 28, en persona, con `cambiar_contrasena.sql`: el domingo `pasar_correo` les deja la misma contraseña, así que el lunes sólo les cambia el correo. Arturo no está entre las débiles.
  - Las de Karla, Genaro y Lupita (`secretaria`) se van con su cuenta vieja: desde que se ligan, el domingo, ya no abren PrintFlow ni Almacén, y el lunes `apagar_vieja` las apaga.
- **Medido el 8-nov, sólo leyendo:**
  - 16 cuentas tienen la huella que deja `crypt` (`$2a$06$`, la de una contraseña puesta por SQL), y 6 de ellas entraron en los últimos 30 días: Auth la acepta. `cambiar_contrasena.sql` deja `$2a$10$`, la misma que pone Auth.
  - Con el nombre, cada uno de los cuatro da un renglón, también con mayúsculas, acento o espacio. Karla, secretaria, admin, lupita, vacío o NOMBRE dan cero.
  - En 200 corridas separadas, las 200 contraseñas salieron distintas y de 12 letras permitidas.
  - `auth.users` no tiene disparadores. El `EXPLAIN` del archivo tal cual pasa sin ejecutarlo.
- **27-nov ~18:20, Marcelo cambió lo de las contraseñas** (por Central). Habrá una contraseña temporal, la misma para todos, y una pantalla en las
  cinco apps que, la primera vez que entran, pide poner la suya.
  - Va en otra conversación. La temporal no se escribe en archivos ni en mensajes.
  - Las de Gerardo, Germán y Noemí no se cambiaron del 26 al 28: esperan a esa pantalla.

## El 27-nov, lo que se hizo

Con el OK de Marcelo de las 19:53 (*«sí, te doy mi OK, sigo tus recomendaciones»*) y los turnos de Central. Todo por la API de administración.

- **19:56:09, el ensayo** (`paso4_ensayo.sql`): 0 fallas. Después, sólo leyendo, no quedó nada.
- **19:56:30, la base** (`paso4_base.sql`, una transacción): `schema_migrations` `20261128015630` («una_sola_cuenta_paso4_base»), 9 personas y 14 fotos.
  - Huellas md5 después: `mi_perfil` 6df8a857…, `_rol_efectivo` 4fa67516…, `quien` 7899bf81… y `verify_actor_role` 8748e8fc….
  - El esquema `cuentas_29nov` no da USAGE a nadie y sus funciones son invoker. Las 4 reemplazadas conservan sus permisos.
- **19:57, `pasar_correo`** de Arturo, Gerardo, Germán y Noemí: ya son `nombre@sygma.mx`, con `diferencias {}`. Mismo id y misma contraseña: quien
  estaba adentro siguió adentro.
- **19:57, `ligar('marcelo')`**: «admin» de PrintFlow pasó a marcelo@sygma.mx, con `diferencias {}`. Había entrado con ella a las 19:39.
  - `admin@padillahnos.local` queda sin perfil y con sus sesiones.
  - Su `apagar_vieja` necesita que Marcelo entre otra vez con la nueva, después de las 19:57.
- **Karla, Genaro, Dulce y Lupita no se ligaron.**
  - Ninguno había entrado con su correo desde el 26-nov (medido a las 18:45 y a las 19:55).
  - `p_sin_comprobar` los habría dejado sin PrintFlow ni Almacén a la siguiente vez que abrieran, con una contraseña de CobranzaFlow que no
    escriben desde agosto u octubre.
  - Se ligan con la contraseña temporal. Hasta entonces entran como siempre, con su nombre.
- **Invariantes después:** CobranzaFlow 94 de 94 y Almacén 34 de 34, como antes.
- **Las pantallas, una app a la vez y cada una con su candado:**
  - PrintFlow v10.84.196: 20:54, READY `dpl_8Be4u6EJJ5z8LZLfQV436ZwYBgum`.
  - Almacén: 21:17, READY `dpl_FwXZH5jbiLUQszj5yqYFf3kEVxqY`.
  - Contabilidad: 21:19, READY `dpl_2uc2LoF9K4RMGE7mrvpVpCEbnPmx`.
  - Las vueltas atrás de cada una, ensayadas, en su CHANGELOG.
- **Lo que el cambio rompió en las pruebas, no en las apps:**
  - Cuatro pruebas simulaban a las personas con el id escrito, y el de «admin» ya no tiene renglón:
    - PrintFlow: `permisos` y `archivos`. El primer candado de la 196 frenó por eso.
    - CobranzaFlow: `probar-corregir-precio-base` y `probar-grupos-base`.
  - Ahora buscan a cada quien por su usuario: PrintFlow e442ec2 y CobranzaFlow v3.7.1060.
  - La copia de la base de las pruebas de Almacén (`tests/invariantes/esquema.sql`) se regeneró con las 3 funciones nuevas.
  - La base no trae escrito ningún id de cuenta: lo medí sólo leyendo en funciones, RLS, vistas, valores por defecto y cron.
- 🔥 **Antes de ligar a Karla.** Lo vio el ensayo de su `ligar` dentro de `probar-corregir-precio-base`, que se deshace: caen cp-50 y cp-52.
  - `public._precio_al_final_quien` mira primero `public.users`. A una cuenta que está en las dos tablas le dice app «printflow», y
    `corregir_precio_orden` le rechaza los renglones de Conceptos de CobranzaFlow.
  - A Marcelo ya le pasa desde las 19:57. Mientras tanto esa corrección la hace Karla; si Marcelo la necesita antes, `regresar('marcelo')` con su OK.
  - También cambian de firma, no de permisos:
    - `audit_stamp_actor`: lo que Marcelo hace en PrintFlow se firma «marcelo», no «admin (PrintFlow)».
    - `pf_uid_username`: «admin» en las funciones compartidas.
  - Con una sola cuenta la base ya no sabe desde qué app la llaman: es una decisión de diseño y un arreglo de base, con su ensayo y el OK de Marcelo.
- **Después de cada `ligar`**, correr las pruebas que usan a las personas de verdad contra la base:
  - en PrintFlow, `node tests/romper/permisos.mjs` y `archivos.mjs`;
  - en CobranzaFlow, `node scripts/probar-corregir-precio-base.mjs` y `probar-grupos-base.mjs`.

## El plan del 29-nov, en orden (se hizo el 27-nov: arriba)

**Del 26 al 28 (Marcelo ya está):**

1. Cada quien entra una vez a CobranzaFlow con `nombre@sygma.mx` (Karla, Genaro, Dulce y Lupita; el texto en `mensajes.md`). `medir.sql`, columna `entro_con_la_nueva`, tiene que decir 26-nov o después. A quien no se acuerde, Marcelo le da «Nueva contraseña» en CobranzaFlow: están en `cobranza.users`.
2. Las contraseñas débiles de Gerardo, Germán y Noemí: Marcelo se las cambia en persona con `cambiar_contrasena.sql` («Contraseñas», arriba), y cada quien entra una vez con su nombre y la nueva, como hoy. Así el lunes sólo les cambia el correo, y si algo falla se ve antes del domingo.
3. Decidir la fecha del ensayo de Almacén y el corte de Finanzas: dependen de este domingo.

**Domingo 29-nov, sin gente en la planta. Turno a Central; cada SQL con el OK de Marcelo:**

1. Revisar: `git log` de Almacén y de PrintFlow, `medir.sql` y volver a correr `paso4_ensayo.sql`, que tiene que decir `ENSAYO OK`. Si frena por una huella, comparar y ajustar. Después, sólo en una terminal con el OK: `paso4_base.sql` (reemplaza funciones: el conector de VS Code lo rechaza, va por el editor) y revisar el `select` final y las invariantes de Almacén y de CobranzaFlow.
2. Persona por persona, una línea cada una, mirando `diferencias` (tiene que salir `{}`):
   ```sql
   select cuentas_29nov.pasar_correo('arturo');   -- también 'gerardo', 'german', 'noemi'
   select cuentas_29nov.ligar('karla');           -- también 'genaro', 'lupita', 'dulce', 'marcelo'
   ```
   Si alguien no entró con la nueva, `ligar` se niega y lo dice: se decide con Marcelo (esa persona sigue con su cuenta de hoy, o `ligar('…', p_sin_comprobar => true)` con su OK). Empezar por Marcelo: si algo sale mal, él lo ve primero.
3. Las contraseñas (decidido el 8-nov, «Contraseñas», arriba): este día no se cambia ninguna. Si a Gerardo, Germán o Noemí no se les cambió del 26 al 28, se hace el lunes con la persona enfrente, y su mensaje dice «la contraseña te la doy en persona».
4. Lo que dicen las pantallas, en `paso5_pantallas.md`: **ya escrito y probado el 7-nov**, en una rama `cuenta-29nov` de PrintFlow, Almacén y Contabilidad (sólo en la PC, sin subir; los pasos, arriba de esa página). Ese día cada rama se pone encima de lo que haya en `main` (Almacén, con su conversación: cambia todos los días; la misma noche del 7-nov le subieron siete pasadas, una tocó `tests/romper/recorridos.mjs`, que la rama también toca, y aun así se mezcla sin choques; ver esa página), se corre su tanda y sube con su candado, una app a la vez. PrintFlow, ~24 min; Almacén, ~20; Contabilidad, 1. Orden: base → app → Central.
5. **Probar**: Marcelo entra con `marcelo@sygma.mx` a las seis apps, y con la cuenta de pruebas se recorre sin escribir, en los dos dominios de PrintFlow. Vuelta atrás ensayada a mano en Marcelo: `select cuentas_29nov.regresar('marcelo');` y `ligar` otra vez.

**Lunes 30-nov:**

6. Repartir los avisos (`mensajes.md`) antes de las 9:00. Marcelo en la planta: a quien se atore, una nueva («Nueva contraseña» de CobranzaFlow, o `cambiar_contrasena.sql` a Arturo, Gerardo, Germán y Noemí).
7. Cuando cada uno de los cinco ya entró con la nueva: `select cuentas_29nov.apagar_vieja('karla');` (se niega si no ha entrado). Marcelo, el último.

**Después (cuando ya nadie use lo de antes):**

- En el Cotizador, Lupita y los 4 no están en `cotz_users`: si los quiere, es otra decisión.
- Quitar `public.get_user_session`, el esquema `cuentas_29nov` (con la bitácora guardada en el CHANGELOG) y las cuentas viejas, si Marcelo algún día lo pide: «sin borrar ninguna» manda hasta entonces.
