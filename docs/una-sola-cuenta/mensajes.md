# Los textos del paso 5

Sin mandar. Cada uno, cuando el `LEEME.md` lo diga; los de la gente, por WhatsApp desde el teléfono de Marcelo. Ninguno lleva contraseñas: la de quien cambia se entrega en persona. Ninguno manda a otra dirección de PrintFlow: la planta entra por `print-flow-eosin.vercel.app` y ahí sigue (`LEEME.md`, punto 8).

## Del 26 al 28-nov: la prueba de antes (Karla, Genaro, Dulce, Lupita)

> Hola [nombre]. El lunes 30 vamos a entrar a todas las apps con una sola cuenta. Para que ese día no te atores: ¿me ayudas a entrar hoy a CobranzaFlow (cobranza.sygma.mx) con tu correo [nombre]@sygma.mx y tu contraseña de siempre de CobranzaFlow? Con que entres una vez basta. Si no te acuerdas de la contraseña, dime y te doy una nueva. No cambia nada más por ahora: PrintFlow sigue igual hasta el lunes.

## Domingo 29 en la noche o lunes 30 a primera hora

**Arturo, Gerardo, Germán y Noemí:**

> Hola [nombre]. Desde hoy se entra a PrintFlow y a Almacén con tu correo: **[nombre]@sygma.mx** (sin acentos), ya no sólo con tu nombre. La contraseña [es la misma de siempre / te la doy en persona, según lo que decida Marcelo]. Si tu pantalla ya estaba abierta, sigue abierta: no tienes que hacer nada hasta que te vuelva a pedir entrar. Si no te deja, avísame y lo vemos en un minuto.

**Karla, Genaro, Dulce:**

> Hola [nombre]. Desde hoy se entra a PrintFlow y a Almacén con la misma cuenta de CobranzaFlow: **[nombre]@sygma.mx** y tu contraseña de CobranzaFlow. Cuando PrintFlow te pida entrar de nuevo, ya no escribas tu nombre: escribe tu correo completo. Lo que tenías sigue igual: tus órdenes, tus avisos y tus permisos. Si no te deja, avísame.

**Lupita:**

> Hola Lupita. Desde hoy se entra a PrintFlow y a Almacén con la misma cuenta de CobranzaFlow: **lupita@sygma.mx** y tu contraseña de CobranzaFlow (ya no «secretaria»). Lo que tenías sigue igual: tus órdenes, tus avisos y tus permisos. Si no te deja, avísame.

**Lucero y Manuel:** nada. Ya entran así.

## Para las conversaciones

**Sygma Central (cuando Almacén y PrintFlow ya estén arriba; el mapa cambia, y se sube en seguida):**

> Una sola cuenta: ya pasó el paso 4 en producción. Cambia lo que dice tu mapa: «cómo se entra» de PrintFlow y de Almacén (M35): ahora, en las dos, el correo completo `nombre@sygma.mx`; ya no hay «usuario de PrintFlow» ni dos familias de cuentas. La liga «Las mismas cuentas y puestos» (PrintFlow–Almacén) y la que dice que PrintFlow y CobranzaFlow no comparten cuentas también cambian: todas comparten una. Sigue sin haber cuenta de Cobranza para Arturo, Gerardo, Germán y Noemí: tienen correo, no entrada a CobranzaFlow. Lee `PrintFlow/docs/una-sola-cuenta/LEEME.md`; lo demás, en los CHANGELOG de PrintFlow y Almacén.

**Central (la del seguimiento):**

> Una sola cuenta: paso 4 aplicado a [las nueve personas o las que sean]. Quedan por apagar las cuentas viejas de [quienes no hayan entrado]. Vuelta atrás de cada quien: `select cuentas_29nov.regresar('nombre');`. El ensayo de Almacén puede arrancar.

**La conversación de Almacén (antes de tocar su `Login.jsx`):** `tests/romper/base-real.mjs` lee las cuentas de la base por nombre, y su candado corre contra lo de verdad: con los cambios de correo y de renglón hay que volver a correrlo. Lo que cambia en su pantalla, en `paso5_pantallas.md`.
