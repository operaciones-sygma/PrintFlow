# CLAUDE.md — Contexto para Claude Code en PrintFlow

> Léelo al inicio de cada sesión. **Se actualiza cuando cambia la arquitectura o una regla**, no por
> sesión (para eso está `CHANGELOG.md`). Última actualización: **5-oct-2026** (v10.84.35). La versión
> anterior era del 5-may-2026 y afirmaba cosas que ya no eran ciertas (RLS `allow_all`, 14 tablas,
> folios D-/R-, «CobranzaFlow app futura»): **un CLAUDE.md viejo estorba más que ayuda.**

---

## 🏗️ Qué es esto

**PrintFlow** es el sistema de producción de Padilla Hnos. Impresora (SYGMA, León, Gto.). Es una de
las apps del **SYGMA ERP** que comparten la **misma base Supabase** (`uvhardaeooaxjrrgdjwa`):

| app | repo | qué hace | schema |
|---|---|---|---|
| **PrintFlow** | `operaciones-sygma/PrintFlow` (éste) | órdenes de producción, tablero, CTP, maquila, folios fiscales | `public` |
| **CobranzaFlow** | `../cobranzaflow` | cobranza, conciliación bancaria, CFDI (emisión propia desde 1-sep-2026), comisiones, anticipos | `cobranza` (+ RPC en `public`) |
| SygmaAlmacen · SygmaContabilidad · cotizador · sygma-web | otros repos | almacén, contabilidad, cotizador, tienda web | `almacen`, … |

**Las dos apps se hablan por triggers de base («el puente»)**: foliar una orden en PrintFlow crea la
factura en `cobranza.invoices` (`sync_invoice_from_split`, `deliver_with_invoice`…); cancelar un
CFDI en CobranzaFlow cierra la parte en PrintFlow (`split_sigue_a_su_cfdi`). **Un cambio de base afecta
a las dos apps**: `grep` en los dos repos antes de tocar una RPC compartida.

- **Frontend:** React 18 + Vite, **un solo archivo** `src/App.jsx` (~20,000 líneas). Estilos inline con
  el objeto `C`; sin CSS externo ni Tailwind. Módulos aparte sólo cuando hay que probarlos con Node
  (`src/lib/cuadrarPartes.js`).
- **Hosting:** Vercel auto-deploy desde `main` → `print-flow-eosin.vercel.app`.
- **Auth:** Supabase Auth (identidades **separadas** de CobranzaFlow; `public.users.user_id` = uid de
  Auth, `public.users.id` NO). Rol en `public.users.role`; en base `pf_uid_role()`,
  `verify_actor_role(p_actor, roles[])` (JWT-first: la identidad la da `auth.uid()`, `p_actor` es
  etiqueta). 🔥 **Toda salida es `signOut({scope:"local"})`**: un `signOut()` a secas es GLOBAL y cierra esa cuenta en todas las
  estaciones (las cuentas son por área) y en Almacén, que usa las mismas (`grep -n "signOut("` antes de subir). Desde v10.84.71 la
  sesión se porta como la de CobranzaFlow (v3.7.999f/o): la que se cierra sola (`SIGNED_OUT`) lleva a entrar diciendo por qué; al
  abrir, la sesión guardada se le confirma a Auth y la entrada la vuelve a mirar antes de abrir (si se cerró a media entrada, la app
  abría como anónima); una falla al comprobar (red, 503) **no saca a nadie**: «Reintentar». Tanda `tests/romper/sesion.mjs`.
- **Marcelo** es dueño y único desarrollador; **Karla** factura; **Lupita** captura; **Gerardo/Noemí/
  Germán** producción/pre-prensa/CTP; **Genaro** vende (ve sólo lo suyo); rol `visor` sólo lectura.
  Desde v10.84.67 **Karla también pasa a Salidas** lo que ya está listo y Gerardo no ha pasado, **sólo desde Empaque o una
  máquina** («Folios» → «En la planta», la OC y el detalle; `jalar_a_salidas` en `ACTION_ROLES`, por `doAdv` con aviso a Gerardo).
  Desde Listas, CTP, diseño o maquila, no (decisión por defecto del 8-oct; Marcelo puede cambiarla).

---

## ⚠️ Reglas que NO se rompen

### Base y permisos
1. `supabase.update()` **nunca** incluye `id` (PostgREST lo rechaza en silencio).
2. **supabase-js no lanza**: siempre `{data, error}` y mirar `error`. Ignorarlo deja `data=null` y la
   app sigue (fail-open) — v10.80.13 lo pagó con las 4 patas fiscales apagadas.
3. `orders.id` es **TEXT** (`OP-…`), no UUID. Toda RPC con orden usa `text`.
4. **RLS es por rol**, no `allow_all`: `orders_select_role` es **cross-app** (CobranzaFlow la usa con
   `pf_uid_role()=NULL`) — **no endurecerla**. Escribir en `cobranza.*` desde PrintFlow = RPC
   `SECURITY DEFINER`.
5. **Toda RPC nueva nace con EXECUTE para `anon`** (ACL por defecto). `REVOKE … FROM PUBLIC, anon` por
   nombre y `GRANT … TO authenticated, service_role`. La **invariante 9** lo vigila.
6. **Cambiar la firma de una función CREA otra** (sobrecarga abierta a PUBLIC). `DROP FUNCTION` la
   vieja primero. Invariante 16.
7. Los **parches de texto** a funciones vivas (`pg_get_functiondef` + `replace` con ancla contada) se
   registran después en `supabase_migrations.schema_migrations` como `*_definiciones_vivas` — si no,
   un re-apply resucita la versión mala.
8. **Candados ORDEN → PARTE** en toda RPC/trigger que toque `orders` y `order_invoice_splits`.
9. `UPDATE OF col` en un trigger mira las columnas **listadas**, no las que cambian.
10. **Agregar una FK** a una tabla con otra FK al mismo destino rompe los embeds de PostgREST
    (PGRST201 → pantalla en blanco). Correr `cobranzaflow/scripts/probar-embeds.sh` en el mismo commit.
11. 🔥 **PostgREST contesta como máximo 1,000 renglones por consulta, AUNQUE se le pida `.limit(5000)`**, y en silencio
    (el «max rows» del proyecto manda; medido el 7-oct: `order_timeline` «0-999/9053»). Toda consulta que pueda pasar de 1,000
    va por **`todasLasFilas(() => consulta.order(col).order("id"))`** (páginas con `.range()`, hasta una vacía; si una falla,
    error y ninguna fila). Hasta v10.84.60 la bitácora se cortaba con el archivo completo cargado y las órdenes recientes salían
    «estancadas» (P-0540); y las órdenes (951) iban a cortarse al pasar de 1,000. `tests/romper/carga.mjs` lo vigila.
12. 🔥 **Un error de lectura no es «vacío»** (v10.84.65). `db.loadOrders` **lanza** si falla la lectura de las órdenes o de
    cualquiera de sus tablas (antes devolvía `[]`, y la recarga dejaba el tablero vacío y verde; el archivo completo que fallaba
    dejaba toda la app en 0). `reloadCore` conserva lo último bueno y marca `lectura.fallo`: arriba de cualquier vista sale «No se
    pudo leer de la base. Lo que ves es de las HH:MM · Reintentar» y el punto de conexión deja de decir «En tiempo real». El
    `Kanban` no dice «vacío» sin `leido` (una lectura buena). El cliente de Supabase ya reintenta solo un GET con 503/520 tres
    veces (1, 2 y 4 s): el aviso llega a los ~7 s. Toda lectura nueva que alimente una pantalla sigue esta regla.
    `tests/recorrido/lectura-falla.mjs` lo vigila con la app real (la primera lectura lenta o caída, la bitácora caída y el
    archivo completo caído).

### React / App.jsx
11. **Orden de declaración** (TDZ): `viewOrders → searchFilter → filteredOrders → myTasks → staleTasks`.
12. `.slice().sort()` en arrays memoizados; nunca mutar.
13. `showToast` es de `App`: los modales definidos a nivel módulo **no lo ven** — avisos locales
    (`err`, `avisoResto`). `scripts/probar-alcance.sh` caza helpers usados fuera de su componente.
14. **Modal reusado sin `key`** muestra el estado del anterior. Un modal que trabaja sobre datos que el
    realtime puede mover se monta sobre el dato **vivo** con `key` (v10.84.6).
15. Un botón **antes** del primer input de un Modal roba el foco; un input **nuevo** bajo un
    `onKeyDown(Enter)` dispara la acción del contenedor, no la suya.
16. `has_splits`, `has_matrix_lines`, `splits`, `fiscal_desconocido` **no son columnas**: las calcula
    `reload()` cruzando `order_invoice_splits`. No van en `.or()` de PostgREST.
17. **Las 4 patas fiscales**: «ya está facturada» = `invoice_folio || grouped_invoice_folio ||
    has_splits || has_matrix_lines` (helper `fiscalOk`). Todo predicado de foliar/entregar/snooze las usa.
18. `isSec(role)` / `secOwns` / `vOwns` / `userLogin` / `notifKey` — gates de siempre; `created_by`
    guarda username, no rol.
19. Prefijo `// vX.Y.Z — ` en cada cambio, con el **porqué** (los comentarios son el historial que sí
    se lee).

### Proceso
20. **Edits quirúrgicos** (`str_replace` con anclas únicas; en Python `assert s.count(a)==1`). Nunca
    rewrites de `App.jsx`.
21. Antes de dar algo por listo: `npx vite build` + `bash scripts/probar-alcance.sh` (+
    `node scripts/probar-cuadrar-partes.mjs` si tocaste el reparto). Y las **invariantes**
    (`cobranzaflow/supabase/invariantes.sql`, 34, corren en segundos) si tocaste la base.
    🔒 **Y `npm run probar`: TODAS las tandas «tratando de romperlo»** (`tests/romper/`, hoy 803 pruebas, ~5 min en la PC de casa; ver
    `tests/LEEME.md`). Compara cada prueba con la última corrida en verde y marca **REGRESIÓN** lo que pasaba y ahora falla.
    El **candado de git** (`.githooks/pre-push`) corre build + `probar` antes de cada subida y **no deja subir** si algo
    falla; un push de puros documentos pasa directo. Se activa una vez por copia: `git config core.hooksPath .githooks`.
    **Nunca `--no-verify`.** Cada bug que se encuentra deja su prueba en `tests/romper/` (Marcelo, 5-oct-2026).
    🔑 **La segunda oportunidad** (8-oct, la misma de CobranzaFlow, el Cotizador y Almacén; Marcelo: «sí es una mejora, aplica la
    misma metodología para todos los proyectos»): lo que falla se repite UNA vez (sólo sus casos, con `SOLO`); lo que vuelve a fallar
    frena; lo que pasa a la segunda sale **INESTABLE**: se sube, queda anotado y se revisa, y **no se sube otra vez con una sin
    revisar** (`node scripts/inestables.mjs`; se marca con `revisada <id> "qué era"`). Más de 3 a la vez frenan; sin segunda
    oportunidad las tandas de dinero (`folio`, `oc`, `partes`) y lo de doble acción; la misma otra vez en 14 días frena.
    🔎 **Y `npm run recorrido`** (v10.84.36) después de un cambio grande y después de subir: abre TODA la app como cada rol con
    la cuenta de pruebas `visor` y las escrituras cortadas en el navegador (~4 min, cero agentes; `tests/LEEME.md`).
22. **Un cambio de base se ensaya contra producción con rollback** (`DO $$ … RAISE EXCEPTION 'ENSAYO'
    $$`, sesión simulada con `set_config('request.jwt.claims', …)`) **antes** de tocar el front.
23. **Push a `main` de PrintFlow está autorizado de forma permanente** (Marcelo, sep-2026).
    **CobranzaFlow requiere confirmación** explícita. Commits: un tema por commit, mensaje que explique
    el porqué, `Co-Authored-By` al final.
24. **Scans/workflows de agentes: decir agentes + orden de magnitud en tokens y esperar OK**; tope
    duro en el script. Dos scans de 170 agentes agotaron la semana de Marcelo en agosto; el 10-sep un
    «25-40» fueron 187.
25. Las 15 skills de diseño (`/impeccable`…) son **manuales**: sólo si Marcelo las escribe. La UI es
    de otra sesión.

---

## 🗄️ La base, lo que importa

- **Órdenes:** `public.orders` (stage, `production_number` **P-XXXX** nuevo consecutivo desde el corte;
  las viejas se renumeraron **H-XXXX**), `order_timeline`, `order_comments`, `order_notes`,
  `order_waste`, `order_machine_log`, `purchase_orders` (OC), `production_plans`.
- **Facturación desde PrintFlow:** `invoice_counters` (F-/RS-/P-…; con **emisor propio ON** desde
  1-sep-2026 los folios nacen del counter — las series **D-/R- eran de Alpha y están retiradas**);
  `order_invoice_splits` (partes de una orden: `factura | remision | corona_saldo | por_facturar`);
  `oc_invoice_split_groups/lines` (plan matriz de una OC); `order_payment_refs`.
- **Cobranza (schema `cobranza`):** `invoices` (`source_order_id` ↔ orden), `payments`,
  `bank_movements`, `cash_vouchers`, `client_credit_ledger`, `cfdi_documents`, `audit_log`,
  `audit_discrepancies`, `app_config` (`folio_emitter_enabled`, `corona_credit_bridge_enabled`).
- **CTP:** `ctp_placas` (cruda cuenta ~2×; usar `v_ctp_placas`), `ctp_maintenance`, `chemical_log`,
  `plate_log`, `maintenance_log`.
- **Realtime:** canal `orders-realtime` (orders, timeline, comments, waste, machine_log,
  notifications, notes, purchase_orders, **order_invoice_splits**). Una tabla nueva debe entrar a la
  publicación `supabase_realtime`.
- **Storage:** bucket `order-files` **privado** desde 18-ago (lectura firmada).
- **Migraciones:** se aplican con `apply_migration` del MCP y viven en
  `supabase_migrations.schema_migrations`; copia legible de las de facturación en
  `docs/migrations/v10.84.*.sql`. Ver `cobranzaflow/supabase/migrations/LEEME-*.md`.

---

## 📚 Dónde está el contexto (léelo antes de tocar el tema)

| tema | documento |
|---|---|
| Historial de cambios (entrada nueva al inicio, cada sesión) | `CHANGELOG.md` |
| **Facturar por partes en el tiempo** (resto, siguiente parte, cuadrar, ligar, cancelaciones, 46 hallazgos de 3 scans) | `../cobranzaflow/docs/SPEC-facturar-por-partes.md` |
| Re-facturar / convertir remisiones / nota de crédito | `../cobranzaflow/docs/SPEC-refacturacion-y-conversion.md` |
| Cancelación de CFDI, traslados, comisiones, importaciones bancarias, vale multi-doc, lista negra SAT | `../cobranzaflow/docs/SPEC-*.md` |
| Lo pendiente (decisiones de personas, no código) | `../cobranzaflow/docs/PENDIENTES.md` |
| Invariantes de clase (34) | `../cobranzaflow/supabase/invariantes.sql` |
| Memoria de Claude (minas, decisiones del dueño, preferencias) | `~/.claude/projects/c--Users-padil-Projects-cobranzaflow/memory/MEMORY.md` |
| Diseño / tokens / DESIGN.md | `../cobranzaflow/DESIGN.md` (convergencia CBF↔PF) |

Los docs base de mayo (`PrintFlow-Contexto.md`, `Roadmap.md`, `Documentacion.md`) **viven en el project
knowledge del chat web**, no en el repo: no cuentes con ellos desde aquí.

---

## 🎯 Estado (5-oct-2026)

- **LIVE:** v10.84.71 (9-oct, madrugada, desde la PC de casa; READY `dpl_DdYjM6UaGc3xQnyPw3KT6gM8NqkR`, commit `d224ae3`; vuelta atrás:
  `git revert 6d919c5`, porque el rollback de un clic de Vercel sólo va al despliegue anterior y el commit de docs ya lo ocupa; el código
  de v10.84.70 está en `dpl_9RPTiW319tgajwUxxKS8DvQfBexA`; la base no cambió; 803 pruebas).
  v10.84.71: **la sesión, como la de CobranzaFlow (v3.7.999f/o)**: el arranque ya no cierra la sesión de forma GLOBAL (con la red caída
  tumbaba esa cuenta en todas las estaciones y en Almacén); una falla al comprobar no saca a nadie («Reintentar»); la sesión que se
  cierra sola lleva a entrar diciendo por qué; la que se cierra a media entrada ya no deja la app abierta como anónima; al abrir se le
  pregunta a Auth y se aplica la lista blanca de roles; y la pantalla de entrar distingue la red, la cuenta desactivada y la de otra
  app de la contraseña mala. Tanda `tests/romper/sesion.mjs` (36; contra v10.84.70 fallaban 16 de 21) y `tests/recorrido/sesion.mjs`
  contra produccion.sygma.mx, 4 de 4.
  v10.84.70 (8-oct, noche; READY `dpl_BwWmZyWgvTSUywcdkgyiNZXjydtM`; vuelta atrás: `git revert c188ddf 7b66fd1 9153986`; 767 pruebas):
  **«Asignar folio y entregar», tres revisiones independientes (23 → 28 → 30/40), CERRADA por las 3 pasadas**: las facturas
  hechas por adelantado se leen al abrir (con la del mismo importe la acción es ligarla, comparando la orden con la factura), los
  errores de la base vuelven al diálogo, Enter-Enter ya no emite sin leer, el selector de pagos (cuatro ventanas) con el monto lleno y a
  prueba de dedazos, el efectivo que ligar no cobra se dice y se reconoce, y el escudo contra el doble clic en lo que cambia el acomodo.
  Lo que queda (ahora v10.84.72, y una decisión de base de Marcelo: ligar con efectivo y crear el vale), en la entrada del CHANGELOG. Revisado
  en producción sin escribir: el código servido y `tests/recorrido/ligar-anticipo.mjs` contra produccion.sygma.mx, 15 de 15.
  v10.84.69 (8-oct, noche; READY `dpl_4DjFqtsmFmvYybBJmz4Dqva3eT6n`; vuelta atrás: `git revert b8172af`, porque el rollback de
  un clic de Vercel sólo va al despliegue anterior y el commit de docs ya lo ocupa; la pantalla de antes funciona con la base nueva; 698
  pruebas). v10.84.69: **«¿ya existe este cliente?»** al capturar la orden o la OC (con CobranzaFlow v3.7.999m y su migración): lo que
  casi seguro ya existe se elige y no se crea, con su porqué; una sola lógica para las dos puertas (`resolverClienteNuevo`); Escape ya
  no cierra la forma de la OC de atrás; «Crear cliente nuevo» enseña el RFC capturado. 🔑 **Crear un cliente desde PrintFlow pasa por
  `resolverClienteNuevo`** y la base lo vuelve a frenar (`create_client_from_printflow`): una puerta nueva que cree clientes, por ahí.
  Revisado en producción sin escribir (el código servido y la búsqueda como la cuenta de pruebas).
  v10.84.68 (`dpl_E2rFvWFq2iuMRufsC4q3kwugeg6A`, `git revert fa21a9f`; 675 pruebas, con la segunda
  oportunidad y sus candados desde `742d0da`): **la factura por adelantado del mismo importe se ofrece de una vez** (Karla,
  F-135 de Castores: ya no se pregunta primero por la de otro importe) y **con efectivo se dice qué hacer** (la base ya lo frenaba:
  `assign_invoice_cash` folia llamando a `assign_invoice`, que tiene el candado, ensayado el 8-oct; pero con un aviso que se borraba y
  sin ofrecer ligar). Revisado en
  producción sin escribir con `tests/recorrido/ligar-anticipo.mjs` (9 de 9).
  v10.84.67 (`dpl_EUYNdKRXxpwHKwC2PLDkrcig9iKp`, `git revert 60807ad`): **Karla pasa a Salidas lo que ya está listo** y Gerardo no ha pasado
  («Folios» → «En la planta», la OC que no se puede foliar entera dice cuáles faltan, «Más» del detalle; sólo desde Empaque o máquina,
  con aviso a Gerardo; sin cambios en la base). Revisado en producción sin escribir con `tests/recorrido/karla-planta.mjs` (21 de 21).
  v10.84.66: ligar una
  factura por adelantado ya no se atora por el centavo de su CFDI (HAKUNA, P-0571: precio unitario de 6 decimales × cantidad; la regla,
  en `../cobranzaflow/docs/SPEC-facturar-por-partes.md` §6). **El tablero queda
  CERRADO**: tres revisiones independientes, 20 → 25 → **24/40** (snapshot `.impeccable/critique/2026-10-08T00-12-28Z__…`). El
  P1 de la tercera, «el tablero dice vacío cuando no sabe», es v10.84.65 (regla 12: un error de lectura no es «vacío»); sus P2 y
  P3 quedan en el snapshot. **Siguiente de la lista del 6-oct: las puertas de cancelar**, luego OrderForm y el plan matriz.
  **El tablero** (el `Kanban` de Producción): la primera revisión independiente dio 20/40 (las
  de julio, 27 y 25, eran propias) y sus cuatro partes se hicieron en v10.84.56-59 (mover con red y «Deshacer», se lee qué corre,
  se ve lo atrasado, los avisos de error con la orden y en palabras). La **segunda, 25/40**, con dos P1, los dos hechos: v10.84.60
  (soltar en Empaque espera con «Deshacer», como el botón) y v10.84.62 («Así va la planta» arriba, las libres miden lo suyo,
  Listas plegada a 4). Y sus P2: v10.84.63 (las acciones de Empaque dentro de la ficha y con palabras; maquila y merma en «⋯»)
  y v10.84.64 (el tablero sano en calma, todo con AA, también los avisos de toda la app; la fila sin partirse a 1920; 40 px
  táctil). v10.84.61 es lo que Marcelo vio en P-0540 («10d estancada» en Salidas con la entrega el 15-oct): con el archivo
  completo cargado la bitácora se cortaba en 1,000 renglones (regla 11), y esperar la fecha de entrega en Salidas ya no cuenta
  como estancada. `tests/recorrido/tablero-errores.mjs`, `carga-completa.mjs` y `lectura-falla.mjs` prueban con la app REAL
  (esperan el «Despertador» del día hasta 8 s: sale tarde y tapa los clics). Snapshots de las tres revisiones:
  `.impeccable/critique/2026-10-07T16-33-31Z__…`, `…T19-33-15Z__…` y `…2026-10-08T00-12-28Z__src-app-jsx-kanban-tablero-de-produccion.md`; banco `tests/banco/gen-tablero.mjs`
  sobre `tests/banco/extraer.mjs` (junta solo las dependencias con `@babel/parser`). **El detalle de la orden quedó cerrado** en
  v10.84.55 (tres revisiones independientes: 23 → 24 → 27/40); lo que queda, en la entrada v10.84.55 del CHANGELOG.
  El contador del CTP, por depurar con calma: `../cobranzaflow/docs/PENDIENTES.md`. Corte del 1-sep hecho: SYGMA emite sus
  propios CFDI (F-/RS-), Alpha ya no. Hasta el 7-oct este renglón arrastraba la historia desde
  v10.84.36; ahora es sólo lo de hoy. Cada versión, con su porqué, en `CHANGELOG.md`; lo grande desde el 18-sep:
  - **«Asignar folio» pasó por `/impeccable critique`** (v10.84.34, 24/40) y por la prueba tratando de romperlo (44 casos,
    `romper-folio.mjs`): el total a la vista, los pagos capturados ya no se pierden (Corona y Cuadra los borraban sin
    preguntar), botones legibles, y `getFolioEmitterEnabled` devuelve `null` en un error (antes «apagado», que abría el modo
    manual con la serie de Alpha). El folio por OC (`AssignOCFolioModal`) la siguió en v10.84.42-45 (40/40, 112 casos, `tests/romper/oc.mjs`).
    El detalle de la orden (DetailModal) en v10.84.46-55 (revisor independiente 23 → 24 → 27/40, cerrado por las 3 pasadas;
    177 casos, `tests/romper/detalle.mjs`, y
    `StageFlowButtons` con su `variante="detalle"`: sin ella, el tablero da exactamente lo mismo).
    Siguen en la lista: el Kanban, las puertas de cancelar, OrderForm y el plan matriz.
  - **Todo lo que se implementa se prueba como usuario tratando de romperlo** (Marcelo, 5-oct), con pruebas escritas que
    afirman lo que debería pasar. PrintFlow no tiene cuenta de pruebas: el **banco** extrae los modales de `App.jsx` con la
    base simulada (`claude-navegador/banco-printflow/`: `gen-banco.mjs`, `romper-partes.mjs`, `LEEME.md`). La primera
    vuelta (v10.84.33) encontró 8 fallas en «Facturar por partes» y quedó en 50 de 50. Los diálogos atrapan el Tab con
    `atraparTab` en el `onKeyDown` del panel.
  - **«Facturar por partes» pasó por `/impeccable critique`** (v10.84.32, 25/40): un Esc sobre «Folio ya existe en
    cobranza» cerraba también el plan (listener propio en `window`; ahora todo por el escStack), el dinero en tinta
    (`C.wnInk`, `C.dnInk`, `C.okInk`, `C.emrInk`), sin «Factura D-» ni jerga, el pie fijo y «Cancelar la parte y la
    orden». `PRODUCT.md` y `DESIGN.md` (copia del de CobranzaFlow + las notas de PrintFlow) son el contexto de
    `/impeccable`. Siguen en la lista: asignar folio, las puertas de cancelar, Kanban, DetailModal, OrderForm, el plan
    matriz (que también dice «Factura D-» y «N facturas»).
  - **Un anticipo de otro importe también se pregunta** (v10.84.31): el candado de `assign_invoice` sólo frena con una
    factura sin orden del MISMO importe; el 2-oct P-0544 recibió folio anticipado por el trabajo completo (F-136) con su
    50% ya facturado en F-90. Ahora, antes de asignar folio (al entregar o por anticipado), si el cliente tiene facturas
    sin orden de otro importe (`list_linkable_invoices_for_order`, `monto_cuadra = false`), se pregunta y se dice el
    camino: «Facturar por partes» → «Ya tiene factura: ligarla» (así se llama desde v10.84.32). Sólo front.
  - **Un nombre por dato** (v10.84.30, pedido de Marcelo): `orders.client_agent` es el **«Agente de compras»** del
    cliente (quien pide, como Eva de Modelo) y `orders.agent` es **«Vendedor» / «Nuestro vendedor»** (el nuestro, el que
    cobra la comisión). Ningún texto nuevo llama «agente» a secas a ninguno de los dos: compartir la palabra hizo que
    40 órdenes traigan al vendedor escrito en el agente del cliente.
  - **Ligar una factura que ya existe en cobranza, por cuatro puertas**: como siguiente parte (v10.84.12), por
    anticipado con la orden todavía en producción (v10.84.13 y 15: queda pre-asignada y se entrega en Salidas), la
    orden sola al foliar (el candado «emitida por adelantado» de `assign_invoice`, con «Sí, ligar» desde v10.80.21) y,
    desde **v10.84.29, la OC entera** (`link_invoice_to_oc`, CobranzaFlow v3.7.931).
  - **Cancelar una parte pregunta qué pasa con su dinero** (v10.84.27-28): vuelve a quedar por facturar o se da por
    perdido; sin elegir no se cancela. La parte cancelada sin timbrar queda con saldo 0 (v10.84.14).
  - **Rendimiento** (v10.84.24-25): la firma de cada foto se guarda y se reusa (antes se pedía cada vez que la tarjeta
    se pintaba), y cada navegador hace una recarga a la vez; una pestaña abierta desde antes necesita F5.
  - «Liberar folio de la OC» y «Deshacer cancelación» (v10.84.11, admin); `precioVenta(o)`: maquila → `maq_price`, lo
    demás → `price`, la misma regla que la base (v10.84.10); el carrito de Cuadra pregunta si el importe es subtotal o
    total (v10.84.26); y los P3 del scan 5 (v10.84.18-23: los diálogos de cancelar y ligar dicen lo que de verdad pasa, y
    la bolsa de Corona ya no se llama «saldo a favor»).
- **Lo último (30-sep):** F-111 (Gobierno del Estado) se emitió sin orden y su trabajo, P-0557 + P-0558, se folió como
  OC-0877 y acuñó **F-115** por el mismo importe. 🔥 **Dos puertas al mismo cuarto**: foliar una orden sola revisaba las
  facturas por adelantado del cliente; foliar una OC (`assign_folio_to_oc`) no, y no había con qué ligar la OC entera.
  Ahora frena (la OC entera y cada orden por su lado) y el modal ofrece «Sí, ligar F-xxx»; si la que coincide es una sola
  orden de la OC, el aviso manda a ligarla desde esa orden. F-111 ya tiene su OC y F-115 se canceló sin timbrar.
  OC-0870/F-105 (CABLESERV) y OC-0872/F-108 (Castores) son el mismo caso, todavía en producción: se ofrecerá ligarlas.
- **Backlog conocido:** Tablero activa fantasma (`delivered` en pos 0 bloquea auto-promoción);
  validaciones pendientes del roadmap de estabilización; decisiones de Marcelo en PENDIENTES.

---

## 💬 Comunicación con Marcelo

- **Ejecución sobre análisis**: haz la tarea y para; respuestas cortas, en español mexicano, liderando
  con el resultado. Nada de «opciones» cuando hay una obvia.
- Si algo huele mal, decirlo en una línea y seguir; parar sólo si seguir sería inseguro.
- **Reportar lo que pasó de verdad**: si una prueba falló, decirlo con la salida; si algo se saltó,
  decirlo.
