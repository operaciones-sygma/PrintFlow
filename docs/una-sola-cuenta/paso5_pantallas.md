# Lo que dicen las pantallas el 29-nov

Cada app ya funciona con `nombre@sygma.mx` antes de esto: PrintFlow desde la v10.84.191, Almacén, Contabilidad, CobranzaFlow y el Cotizador desde antes. Lo de aquí es lo que cada pantalla le dice a la gente. **No se aplica antes del cambio**: Gerardo todavía no tiene su correo. Se escribe en una copia aparte de cada app (`git worktree`), con las pruebas de abajo escritas primero, y sube con su candado el domingo, después de `paso4_base.sql` y antes de avisarle a la gente.

Decisión de diseño: **el nombre a secas no se rechaza en el código, deja de existir en Auth.** Las cuentas `@padillahnos.local` de las personas ya no existen o están apagadas, así que escribir «gerardo» da credenciales malas, y entonces la pantalla dice cómo se entra. Lo de pegar el dominio se queda para la cuenta de pruebas (`claude-pruebas@padillahnos.local`, que usan los recorridos y `base-real`) y no hay que tocar las decenas de tandas que entran con un nombre.

## Ya escrito y probado (7-nov-2026), sin subir

Lo de abajo ya está programado, con sus pruebas escritas antes del código, en una rama `cuenta-29nov` de cada app. Son ramas locales de la PC: no están en GitHub y no suben solas.

| App | Copia | Commits (pruebas → código → vuelta 2) | Tanda |
|---|---|---|---|
| PrintFlow | `C:\Users\Marcelo\Projects\PrintFlow-cuenta` | `0e12549` → `c080294` → `7449694` | `sesion-4`: ses-350 a ses-359; ses-06, 22, 305, 306 y 315 aceptan el aviso nuevo |
| Almacén | `C:\Users\Marcelo\Projects\sygma-almacen-cuenta` | `53adf6f` → `829930b` → `5d0bf61` | `login`: AH a AN, y A y A2 ya no piden que el mensaje mande a PrintFlow; `recorridos` W10.1 |
| Contabilidad | `C:\Users\Marcelo\Projects\sygma-contabilidad-cuenta` | `ec7aa53` → `a63b7ea` | `salir`: sal-25 y sal-26 |

**Cómo se probó** (7-nov, de 08:04 a 08:53, en la PC; nada subió y la base no se tocó). Primero, las pruebas solas contra el código de hoy, donde las nuevas tienen que caer. Después, con el código. Al final, un sabotaje por pieza: se quita esa pieza y su prueba tiene que caer.

| App | Vuelta 1, sin el código | Con el código | Sabotajes |
|---|---|---|---|
| PrintFlow | `sesion-4`: 50 de 66; caen los 16 resultados nuevos | `sesion-4`: 66 de 66. La tanda `sesion` entera, 313 de 314. Cayó ses-06, por la prueba: pedía «desactivada». Ya corregida, pasa | 9 de 9 |
| Almacén | `login`: 30 de 42; caen las 12 nuevas o cambiadas | `login` 42 de 42, `sesion` 27 de 27 y `recorridos` 66 de 66. W10.1 se corrigió antes: pedía el letrero de antes, «correo @sygma.mx» | 10 de 10 |
| Contabilidad | `salir`: 25 de 27; caen sal-25 y sal-26 | 27 de 27 | 3 de 3 |

Las 10 cuentas activas de PrintFlow, medidas el 7-nov sólo leyendo, reciben el correo que les pone el paso 4:
- `secretaria` → lupita@sygma.mx;
- `admin` → marcelo@sygma.mx;
- las otras siete, su nombre@sygma.mx;
- la décima es la cuenta de pruebas.

Sin probar: un teléfono de verdad, y el candado completo de cada app, que corre ese día con la rama encima de `main`.

**Ese domingo, en cada una:**
1. `git -C <copia> fetch` y `git rebase origin/main cuenta-29nov`. En Almacén, antes, mirar con su conversación qué trae en `Login.jsx`, `supabase.js`, `tests/romper/recorridos.mjs` y `tests/LEEME.md`.
   - Su `main` se movió la misma noche: al 7-nov ~09:10 iba en `a8857e3`, siete pasadas encima de `28eb219`, la base de la rama.
   - Una pasada cambió `recorridos.mjs`: `abrirReq` ahora espera `tbody tr`.
   - `git merge-tree --write-tree origin/main cuenta-29nov` dijo que se mezcla sin choques: los cambios caen en otros renglones de `recorridos.mjs` y de `tests/LEEME.md`.
   - Si para el 29-nov choca, se conservan los dos lados y se vuelven a correr `login`, `sesion` y `recorridos`.
2. En PrintFlow, `v10.84.PASO5` por el número de versión de ese día, en `src/App.jsx`, `tests/romper/sesion.mjs` y `tests/LEEME.md`, con un solo reemplazo (`git grep -n PASO5`).
3. Su tanda, en la copia aparte y directo, sin `scripts/probar.mjs`, para no anotar nada en la bitácora de inestables de la copia principal:
   - PrintFlow: `SESION_PARTE=4 node tests/romper/sesion.mjs`;
   - Almacén: `npx vite build`, y luego `node tests/romper/login.mjs`, `sesion.mjs` y `recorridos.mjs`;
   - Contabilidad: `PROBAR_INESTABLES=<archivo temporal> npm run romper`.

   Después, su entrada en el CHANGELOG con lo de esta página.
4. Desde la copia principal, `git merge --ff-only cuenta-29nov` y `git push origin main`: el candado corre ahí. Orden: base (`paso4_base.sql` y las personas) → app → Central.

**Lo que cambió contra el plan de abajo, al escribirlo:**
- **Con el nombre y Auth que lo rechaza**, el aviso dice las dos cosas: «Usuario o contraseña incorrectos. Ahora se entra con tu correo completo: gerardo@sygma.mx.» Si alguien se queda ese día con su cuenta de antes, porque no entró con la nueva y no se ligó, su nombre sigue entrando. Con la contraseña mala, el aviso no le miente.
- **La cuenta de antes, ya ligada** (su contraseña sirve y ya no tiene renglón), lee «Ya no se entra con esta cuenta. Ahora se entra con tu correo completo: karla@sygma.mx. Si no te deja, pídele a Marcelo que la revise.»
  - Lo mismo si abre con su sesión guardada: PrintFlow saca el correo de la sesión (`nombre@padillahnos.local`).
  - Lo mismo lee una cuenta de antes desactivada: con `get_my_session` la app no las distingue, y el «pídele a Marcelo» la cubre.
- **Lo que no parece un nombre** (un emoji, espacios en medio, más de 40 letras) no inventa un correo: dice `nombre@sygma.mx`.
- **PrintFlow:** `AVISO_SIN_PERFIL` ya no se usa y se quitó.
- **Contabilidad:** el error también dice «Revisa tu correo y tu contraseña».
- **Dos pruebas de antes leían el texto viejo** y ahora aceptan los dos:
  - ses-06 de PrintFlow, que abre con la sesión guardada de una cuenta sin perfil;
  - W10.1 de Almacén, que hace entrar a Lucero.

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
