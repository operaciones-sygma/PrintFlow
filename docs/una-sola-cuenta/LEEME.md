# Una sola cuenta `nombre@sygma.mx` en todas las apps

Marcelo, 19-oct-2026: *«en todos se entrara con usuarios como marcelo@sygma.mx»*, y al proponerle que también se pudiera escribir sólo el nombre: *«nooo debe
ser nombre@sygma.mx»*. 6-nov: los pasos 1 a 3, ya, sin que nadie pierda acceso; el 4 y el 5 **no se hacen mientras viaja (9 al 25-nov)**: quedan listos para el
**domingo 29-nov**, el día antes del ensayo de Almacén (propuesto para el lunes 30-nov; **su fecha la confirma Marcelo**).

| Paso | Qué | Estado |
|---|---|---|
| 1 | «Salir» de Contabilidad y del Cotizador, sólo de esa app | ver el CHANGELOG de cada una |
| 2 | PrintFlow busca el perfil por la cuenta (`get_my_session`, v10.84.190) | **en producción**, 7-nov ~02:35 |
| 3 | PrintFlow acepta también el correo completo, y sigue aceptando el nombre (v10.84.191) | **en producción**, 7-nov ~02:56 |
| 4 | Cada quien a su `@sygma.mx`; apagar las cuentas viejas | **listo para el 29-nov; sin aplicar** |
| 5 | Central y avisarle a la gente | **listo para el 29-nov; sin hacer** |

## Quién cambia y cómo (medido el 6-nov, `medir.sql` lo vuelve a medir)

| Persona | Hoy | El cambio | Contraseña después | Vuelta atrás |
|---|---|---|---|---|
| Arturo, Gerardo, Germán, Noemí | sólo `nombre@padillahnos.local` | `pasar_correo`: la misma cuenta cambia de correo. El mismo id, la misma contraseña; quien ya estaba adentro no se entera. **No hay cuenta vieja que apagar** | la misma | `regresar` |
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

## El 29-nov, en orden

**Del 26 al 28 (Marcelo ya está):**

1. Cada quien entra una vez a CobranzaFlow con `nombre@sygma.mx` (Karla, Genaro, Dulce y Lupita; el texto en `mensajes.md`). `medir.sql`, columna `entro_con_la_nueva`, tiene que decir 26-nov o después. A quien no se acuerde, Marcelo le da «Nueva contraseña» en CobranzaFlow: están en `cobranza.users`.
2. Decidir la fecha del ensayo de Almacén y el corte de Finanzas: dependen de este domingo.

**Domingo 29-nov, sin gente en la planta. Turno a Central; cada SQL con el OK de Marcelo:**

1. Revisar: `git log` de Almacén y de PrintFlow, `medir.sql` y volver a correr `paso4_ensayo.sql`, que tiene que decir `ENSAYO OK`. Si frena por una huella, comparar y ajustar. Después, sólo en una terminal con el OK: `paso4_base.sql` (reemplaza funciones: el conector de VS Code lo rechaza, va por el editor) y revisar el `select` final y las invariantes de Almacén y de CobranzaFlow.
2. Persona por persona, una línea cada una, mirando `diferencias` (tiene que salir `{}`):
   ```sql
   select cuentas_29nov.pasar_correo('arturo');   -- también 'gerardo', 'german', 'noemi'
   select cuentas_29nov.ligar('karla');           -- también 'genaro', 'lupita', 'dulce', 'marcelo'
   ```
   Si alguien no entró con la nueva, `ligar` se niega y lo dice: se decide con Marcelo (esa persona sigue con su cuenta de hoy, o `ligar('…', p_sin_comprobar => true)` con su OK). Empezar por Marcelo: si algo sale mal, él lo ve primero.
3. Las contraseñas débiles (la pregunta del 6-nov; `printflow-contrasenas-legibles`): **al 7-nov, sin contestar**. Lo recomendado: ese domingo, sólo Gerardo, Germán y Noemí; las de Karla, Genaro y Lupita se van con su cuenta vieja. Lo que decida, en la memoria `una-sola-cuenta-sygma`. Igual quién cambia una contraseña olvidada: recomendado, Marcelo y Manuel con «Nueva contraseña» de CobranzaFlow ampliada (hay que construirla y sube con el OK de Marcelo); si no, sólo Marcelo desde el panel de Supabase.
4. Lo que dicen las pantallas, en `paso5_pantallas.md`: **ya escrito y probado el 7-nov**, en una rama `cuenta-29nov` de PrintFlow, Almacén y Contabilidad (sólo en la PC, sin subir; los pasos, arriba de esa página). Ese día cada rama se pone encima de lo que haya en `main` (Almacén, con su conversación: cambia todos los días), se corre su tanda y sube con su candado, una app a la vez. PrintFlow, ~24 min; Almacén, ~20; Contabilidad, 1. Orden: base → app → Central.
5. **Probar**: Marcelo entra con `marcelo@sygma.mx` a las seis apps, y con la cuenta de pruebas se recorre sin escribir, en los dos dominios de PrintFlow. Vuelta atrás ensayada a mano en Marcelo: `select cuentas_29nov.regresar('marcelo');` y `ligar` otra vez.

**Lunes 30-nov:**

6. Repartir los avisos (`mensajes.md`) antes de las 9:00. Marcelo en la planta: quien se atore, «Nueva contraseña».
7. Cuando cada uno de los cinco ya entró con la nueva: `select cuentas_29nov.apagar_vieja('karla');` (se niega si no ha entrado). Marcelo, el último.

**Después (cuando ya nadie use lo de antes):**

- En el Cotizador, Lupita y los 4 no están en `cotz_users`: si los quiere, es otra decisión.
- Quitar `public.get_user_session`, el esquema `cuentas_29nov` (con la bitácora guardada en el CHANGELOG) y las cuentas viejas, si Marcelo algún día lo pide: «sin borrar ninguna» manda hasta entonces.
