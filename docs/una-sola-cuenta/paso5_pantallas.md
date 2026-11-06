# Lo que dicen las pantallas el 29-nov

Cada app ya funciona con `nombre@sygma.mx` antes de esto: PrintFlow desde la v10.84.191, Almacén, Contabilidad, CobranzaFlow y el Cotizador desde antes. Lo de aquí es lo que cada pantalla le dice a la gente. **No se aplica antes del cambio**: Gerardo todavía no tiene su correo. Se escribe en una copia aparte de cada app (`git worktree`), con las pruebas de abajo escritas primero, y sube con su candado el domingo, después de `paso4_base.sql` y antes de avisarle a la gente.

Decisión de diseño: **el nombre a secas no se rechaza en el código, deja de existir en Auth.** Las cuentas `@padillahnos.local` de las personas ya no existen o están apagadas, así que escribir «gerardo» da credenciales malas, y entonces la pantalla dice cómo se entra. Lo de pegar el dominio se queda para la cuenta de pruebas (`claude-pruebas@padillahnos.local`, que usan los recorridos y `base-real`) y no hay que tocar las decenas de tandas que entran con un nombre.

## PrintFlow (`src/App.jsx`, tanda `sesion-4`)

- Etiqueta `Usuario o correo` → `Correo`; letrero `Ej: gerardo, o tu correo completo` → `Ej: gerardo@sygma.mx` (los recorridos lo buscan con `/gerardo/`: sigue sirviendo).
- En `db.login`, si Auth rechaza lo que se escribió **sin** `@`: `Ahora se entra con tu correo completo: gerardo@sygma.mx`. Con `secretaria` dice `lupita@sygma.mx` y con `admin`, `marcelo@sygma.mx` (un mapa de dos, en el código). Con `@`, como hoy: `Correo o contraseña incorrectos`.
- `AVISO_SIN_PERFIL` (lo que lee quien abre con la sesión de su cuenta vieja, ya sin renglón): `Ya no se entra con esta cuenta. Ahora es con tu correo completo: nombre@sygma.mx. Si no te deja, pídele a Marcelo que la revise.`
- `AVISO_SIN_LIGAR`: `Tu contraseña está bien, pero esa cuenta no tiene PrintFlow. Si debería, pídele a Marcelo que te dé acceso.`
- Pruebas: ses-334 pide el aviso nuevo; ses-325 el texto nuevo; ses-304, 305, 306 y 315 aceptan el aviso nuevo; una nueva para `secretaria` y `admin`.

## Almacén (`src/lib/supabase.js`, `src/views/Login.jsx`, tanda `login`)

Esta app la trae otra conversación: mirar `git log` y `git status` antes, y avisarle.

- `Field label="Usuario"` → `Correo`; letrero `tu usuario de PrintFlow o tu correo` → `nombre@sygma.mx`. Revisar antes cómo buscan esa casilla las tandas (por `autocomplete`, lo normal).
- Pie: `Es la misma cuenta y contraseña de PrintFlow. Si no usas PrintFlow, entra con tu correo @sygma.mx y la contraseña de CobranzaFlow.` → `Es la misma cuenta y contraseña de todas las apps de SYGMA.`
- `AVISO_SIN_ACCESO` y el de `entrar`: `Esa cuenta no tiene acceso a Almacén. Aquí se entra con tu usuario de PrintFlow.` → `Esa cuenta no tiene acceso a Almacén. Si debería, pídele a Marcelo que la revise.`
- `emailDeUsuario`: sin espacios, mayúsculas ni acentos también con `@`, como PrintFlow (hoy sólo el nombre va en minúsculas): Noemí y Germán escriben `noemí@sygma.mx`.
- `entrar`, en credenciales malas sin `@`: `Ahora se entra con tu correo completo: gerardo@sygma.mx`.
- Pruebas: la tanda `login`, y lo de «Dulce» de `Login.jsx` (`recorridos.mjs` W10).

## Contabilidad (`src/views/Login.jsx`, tanda `salir` o una nueva `login`)

- Etiqueta `Usuario` → `Correo`; letrero `dulce` → `dulce@sygma.mx`. Sigue completando `@sygma.mx` si alguien escribe sólo el nombre: es el mismo correo, no otra cuenta, y no estorba.
- `sal-13` lo vigila.

## CobranzaFlow y el Cotizador

Nada: ya piden el correo.

## SYGMA Central

Lo cambia su conversación con el texto de `mensajes.md`. Es una subida en seguida: cambia lo que el mapa dice de cómo se entra.
