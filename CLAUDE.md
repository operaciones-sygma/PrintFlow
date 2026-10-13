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
19b. 🔥 **Los hooks de un componente van ANTES de cualquier `return` temprano** (en App: `if(!authChecked)` y `if(!user)`). En v10.84.80
    tres hooks de App después de ellos tumbaban la app entera al entrar («React error #310») y ningún banco lo veía (montan sin esos
    `return`). La tanda `hooks` (`tests/romper/hooks.mjs`) lo vigila en todos los componentes, y sólo la app real lo enseña.
19c. 🔥 **La app tiene `html{scroll-behavior:smooth}`**: todo `scrollTo`/`scrollIntoView`/`focus()` sin `behavior` se ANIMA, y una animación
    se puede cortar (v10.84.81: «P-… creada» quedó fuera de la pantalla con la forma ya vacía). Lo que confirma algo o restaura una posición va
    con `behavior:"instant"` y luego `focus({preventScroll:true})`, en `useLayoutEffect`. Un banco que mida posiciones COPIA el estilo global
    de App (`gen-orden.mjs`; sin él daba 0 de 8 lo que en la app salía), y la prueba mide donde QUEDA (espera a que la página se quede quieta).

### Proceso
20. **Edits quirúrgicos** (`str_replace` con anclas únicas; en Python `assert s.count(a)==1`). Nunca
    rewrites de `App.jsx`. Y el ancla llega al FIN de su renglón (con el salto) cuando se agrega algo después: una que es prefijo cuenta 1
    y empalma a media línea (v10.84.81: un comentario perdió su «s» y quedó una `s` suelta después de un efecto; otro cambió de renglón).
21. Antes de dar algo por listo: `npx vite build` + `bash scripts/probar-alcance.sh` (+
    `node scripts/probar-cuadrar-partes.mjs` si tocaste el reparto). Y las **invariantes**
    (`cobranzaflow/supabase/invariantes.sql`, 34, corren en segundos) si tocaste la base.
    🔒 **Y `npm run probar`: TODAS las tandas «tratando de romperlo»** (`tests/romper/`, hoy 1390 pruebas, ~13 min en la PC de casa; ver
    `tests/LEEME.md`). Compara cada prueba con la última corrida en verde y marca **REGRESIÓN** lo que pasaba y ahora falla.
    El **candado de git** (`.githooks/pre-push`) corre build + `probar` antes de cada subida y **no deja subir** si algo
    falla; un push de puros documentos pasa directo. Las tandas con banco van de a 7 a la vez (`PROBAR_PARALELO`; con 11 juntas,
    `net::ERR_NO_BUFFER_SPACE` frenaba el candado sin que la app fallara, v10.84.81). Se activa una vez por copia: `git config core.hooksPath .githooks`.
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

- **LIVE:** v10.84.92 (13-oct, ~16:55; READY `dpl_FryCgzsXKSbpuDa3YS2MZUGR3Jbt`, commit `778865d`; vuelta atrás: promover
  `dpl_E7BfWiHuCgx57rkPTjo5bCScABjq` (el código de v10.84.90) o `git revert 778865d`; la base no cambió; 1407 pruebas, de a 2 tandas). v10.84.92:
  🔑 **quién paga, a la vista en el plan matriz** (el caso Hotsson de Karla y Genaro: una OC en 7 facturas a 7 razones sociales). Regla de
  Marcelo (13-oct): **el saldo se queda con el cliente que pidió el producto**; el CFDI a otra razón social del mismo cliente se elige en
  CobranzaFlow (Por Timbrar → Datos → «CFDI a nombre de», `set_invoice_facturado_a`, la regla 23 de CobranzaFlow; Karla es CxC). «Facturar
  a tercero» es lo único que cambia quién paga (la factura y su saldo nacen a cargo del tercero): el plan lo dice arriba, cada factura dice
  «Saldo: …» y el botón «Paga: …». Ensayado contra producción con las órdenes de Hotsson: juntarlas en una OC NUEVA (a una OC «simple» no se
  le mete otra orden), plan de 7 facturas a cargo del cliente, «CFDI a nombre de» y la factura urgente hecha antes ligada después: todo
  funciona con la base de hoy. Sigue: v10.84.91 (la categoría; su base, de noche; rama `v10.84.91-categorias`).
  v10.84.90 (13-oct, ~14:35; READY `dpl_qUGQFZxZo3yBzHstXydm1kPKyyTh`, commits `5976ef4` y `334abfc` (+ pruebas `826b08c`, `5301453`); vuelta atrás: promover
  `dpl_7y59AYsgagrsSG1gHa2c7oPrXYcn` (el código de v10.84.89) o `git revert 334abfc 5976ef4`; 1403 pruebas; el candado, de a 2 tandas si la PC va justa de memoria). v10.84.90: el folio anticipado y «Facturar por
  partes», una u otra por orden (la que ya va por partes, en el plan o agrupada no ofrece «Asignar folio anticipado»); 🔑 **«ocupado»
  desde el clic** en cinco diálogos de dinero (`InvoiceModal`, `PreInvoiceModal`, `DeliverOnlyModal`, `PriceCaptureModal`, `BulkSellModal`):
  la ref la ponía un efecto después de pintar y dos clics en el mismo instante mandaban DOS asignaciones (lo vio el candado: inv-29 con la
  máquina cargada). El candado del anticipo en «Dividir» (migración `v10.84.90_candado_del_anticipo_en_dividir.sql`, ensayada en 9 casos)
  APLICADO el 13-oct ~15:52 con el OK de Marcelo (vuelta atrás: `docs/migrations/v10.84.90_vuelta_atras.sql`). Sigue: v10.84.91 (la categoría; su base, de noche).
  v10.84.89 (13-oct, ~12:05; READY `dpl_8JSJ1qNU1wUetDLuhkocx5NeHfwP`, commit `3c0fd92`; vuelta atrás: promover
  `dpl_FxRPNKyZQ4eKceZQhkMzpcMsagj6` (el código de v10.84.88) o `git revert 3c0fd92`; 1390 pruebas). v10.84.89: 🔑 **ligar una PARTE a una
  factura que ya existe** (Karla: F-143 y F-155 de PORTLAND cubren, cada una, un pedazo de los 4 stickers de OC-0960): el plan matriz de la
  OC liga por columna («Ya tiene factura: ligarla», «Lo que falta»; la base: `oc_invoice_split_groups.ligada`, migración
  `v10_84_89_ligar_en_el_plan_de_la_oc`, revisada por CobranzaFlow y ensayada); 🔒 el candado del anticipo también en el plan; cancelar un
  grupo ligado lo DESLIGA; «Asignar folio» de la OC avisa de las facturas sin orden; «Facturar por partes» abre antes de Salidas (folios
  anticipados a fuerza) y la pregunta de anticipos del folio anticipado lleva ahí. Tanda nueva `plan`. Sigue: v10.84.90 (el candado del
  anticipo en «Dividir»), v10.84.91 (la categoría del trabajo, aprobada; su base en la noche).
  v10.84.88 (13-oct, ~07:26; READY `dpl_2DcHS8KJ5WjPTDLFRiDp8P2Zv8dF`, commit `d685294`; vuelta atrás: promover
  `dpl_Bdbt2wszqR2STA9tSGpNdxoVqBiX` (el código de v10.84.87) o `git revert d685294`; la base no cambió; 1345 pruebas). v10.84.88: sin chips
  que nunca cuentan en «Mis Pendientes» y las guías de Gerardo con sus botones (tanda nueva `chips`, sin navegador).
  v10.84.87 (13-oct, ~06:47; READY `dpl_4JxCji5vx6dnqnw8cWYfuihB4fWh`, commits `cc7baf0` (v10.84.86) y `8426846`; vuelta atrás:
  promover `dpl_utDqiGqNHEeHLXoFLzx484DTxwBf` (el código de v10.84.85) o `git revert 8426846 cc7baf0`; la base no cambió; 1339 pruebas).
  v10.84.87: **«Mis Pendientes»** (su critique, revisor independiente **17/40**, snapshot `.impeccable/critique/2026-10-13T12-33-38Z__…`):
  🔑 `StageFlowButtons` pone `escudoDeClics` antes de cada acción (en vivo, un doble clic en «Validar Producción» de P-0633 validó también
  P-0632); sin lectura buena no dice «Sin pendientes»; el menú cuenta las activas; guías falsas corregidas. Lo de diseño quedó para Marcelo
  en el CHANGELOG («Te toca / Espera a otro», las dos colas de Karla, «A CTP» para Germán, los colores de la ficha). v10.84.86: la venta de
  inventario por su folio fiscal y OC (no su uuid). v10.84.85: cada barra de Analytics despliega sus órdenes.
  v10.84.84 (13-oct, ~05:30; READY `dpl_CvSY87pmA6izxSqEhXvu4c8HfZeR`, commit `bd60203`; vuelta atrás: promover
  `dpl_9JWkMHdRsad5UCkdjcAVyxdM19sv` (el código de v10.84.83) o `git revert bd60203`; la base no cambió; 1326 pruebas). v10.84.84: **Analytics
  dice qué cuenta y de qué periodo** (los P1 de su critique): UN ingreso (lo entregado por su fecha de entrega, día de México,
  `precioVenta`), un periodo para todas las pestañas con la comparación contra uno del mismo largo, cada cifra con su base, la utilización
  contra los días hábiles del periodo y sin Empaque. Tanda nueva `analytics` (34, el reloj del navegador fijo). Lo hice en la noche del
  13-oct (Marcelo: «sigue mejorando el app toda la noche con /impeccable critique»).
  v10.84.83 (13-oct, ~00:23; READY `dpl_2pvXX3Joymffkm5WeRA9qhcZSw8S`, commits `06e9183` y `80a53a2` (dos pruebas de reloj); vuelta
  atrás: promover `dpl_fQFgBhcsCyvVMPfEB74b3DF7xGof` (el código de v10.84.82) o `git revert 06e9183`; la base no cambió; 1292 pruebas).
  v10.84.83: **«Archivos» sin borrado en masa** (el P1 de la critique de Analytics, revisor independiente 14/40; snapshot
  `.impeccable/critique/2026-10-13T05-07-59Z__src-app-jsx-analytics-productos-por-ingreso.md`): el archivo de impresión es el historial
  (decisión del 12-oct), así que borrar UNO abre la ventana de la app que dice cuál (orden, cliente, etapa, archivo, peso) y lo que pasa se
  dice con el `Toast` (🔑 un componente de módulo monta el suyo; nunca `confirm()`/`alert()`). `StorageTab` lo ven Dirección (Analytics) y
  Pre-prensa y Germán («Archivos»). **Sigue: los tipos de producto** (Marcelo, 12-oct: una categoría nueva aparte, de lista cerrada, que
  alimenta Analytics; «Venta de inventario» como canal; quitar «🔴 ATRASADA · » de las 37 importadas; cambio de base, se ensaya primero).
  Pendiente de Marcelo: ¿quitar también la pregunta del detalle de borrar el archivo después de descargarlo?
  v10.84.82 (12-oct, ~22:22; READY `dpl_6nNC2NSqt5b2Zus8USkVbBNYzSdK`, commit `68a6d85`; vuelta atrás: promover
  `dpl_13xeMsi8WqBMdZvVY3bKR1LNcuiF` (el código de v10.84.81) o `git revert 68a6d85`; la base no cambió; 1265 pruebas). v10.84.82: **la forma
  de la orden en UNA sola forma** (Marcelo, 12-oct, la «A» de un análisis de 90 días: sin «Sencillo / Avanzado»; una descripción que crece; el
  orden de la hoja impresa con la imagen arriba de las especificaciones, que se pliegan con su resumen y empiezan abiertas) y **Replicar sin
  el precio de otra cantidad**. 🔑 Plegar recorre la página: el segundo clic de un doble clic (`detail ≥ 2`) no cuenta 350 ms. `ClientInput`
  ya no cierra su lista al volver al campo en menos de 200 ms.
  v10.84.81 (12-oct, ~20:10; READY `dpl_6eqAswERNucuxWEVXCn5tSJoqqvE`, commits `e472807` y `f6fb96d` (el candado); vuelta atrás: promover
  `dpl_CyKMYt7Y56LrpyYWc7RpT5dZRhBp` (el código de v10.84.80) o `git revert e472807`; la base no cambió; 1231 pruebas). v10.84.81: **la
  TERCERA revisión independiente de OrderForm (29/40): la forma queda CERRADA por las 3 pasadas (22 → 28 → 29)**. Su P1: «P-… creada» quedaba
  fuera de la pantalla porque el foco la traía con el desplazamiento suave de la app (regla 19c: lo que confirma va con `behavior:"instant"`).
  El cliente con su identidad (el RFC del elegido con candado en las dos puertas, el nombre que ya existe con otro RFC no se liga callado, el
  cliente de la OC), el teclado (`useDevolverFoco`) y los menores. La tanda `orden` va en dos (`orden` + `orden-2`) y su banco copia el
  estilo global de App. Pendientes de Marcelo: los modos Sencillo/Avanzado y el orden, y el precio de Replicar con otra cantidad (hechos en v10.84.82).
  v10.84.80 (12-oct, ~17:30; READY `dpl_GdFpLzQB6rdB8LQvMoJrLQaiKt4W`, commit `b2f826b`; vuelta atrás: promover
  `dpl_6JsC58NzJ3dxqno6vVAcSPuN8zn7` (el código de v10.84.79) o `git revert b2f826b`; la base no cambió; 1179 pruebas). v10.84.80: **la
  segunda revisión independiente de OrderForm (28/40, un P1 y cuatro P2)**: el cliente no se mezcla (🔑 en «¿ya existe?» elegir pone al
  cliente COMPLETO en la forma y no crea, en las dos puertas: `resolverClienteNuevo` devuelve `cliente`; cambiar el nombre suelta lo del
  anterior), Replicar sin notas ni distribución, 🔑 al crear la forma se queda («P-… creada · Ver · Imprimir · Capturar otra») y editar o
  Cancelar regresan a donde se abrió (`volverDeLaForma`), vendedor (lista) y precio junto a tipo/cantidad/entrega, y el teclado. 🔥 La app
  real encontró hooks de App después de sus `return` tempranos (React #310 al entrar): regla 19b y la tanda `hooks`. Sigue la tercera
  revisión independiente (hecha: 29/40, ver v10.84.81).
  v10.84.79 (12-oct, ~14:28; READY `dpl_Gq5TmDVv3Gm1SYxonyd7MyKdXiVU`, commit `11c0140`; vuelta atrás: promover
  `dpl_4dmg5XSrao5DAovfBgzv1GskQwrT` (el código de v10.84.78) o `git revert 11c0140`; la base no cambió; 1135 pruebas). v10.84.79: **el
  reacomodo de OrderForm**: lo esencial en la primera pantalla de la laptop, dos columnas desde 1150 px de forma (1040 en «Specs»; 🔑 un
  solo árbol para los dos acomodos, sólo cambia el CSS), «Más de esta orden» para lo que se usa poco, `VIEW_MAXW.form` 1212 (con 820 las
  dos columnas nunca salían) y el menú lateral que se pliega solo abajo de 900 px. 🔑 **El banco de la forma copia de App el contenedor y
  el menú lateral** (`gen-orden.mjs`): con uno propio medía otra pantalla. Sigue la segunda revisión independiente de la forma.
  v10.84.78 (12-oct, ~12:55; READY `dpl_4mBCBWBsDXFUYJwXXJx4D4AMQ8us`, commit `d08a1f1`; vuelta atrás: promover
  `dpl_3RM7998GgLVsCFmrMJgCtn1qQGWr` (el código de v10.84.77) o `git revert d08a1f1`; la base no cambió; 1111 pruebas). v10.84.78: **los P2
  de la critique de OrderForm**: salir con algo capturado pregunta (decisión de Marcelo; 🔑 una forma larga se registra en `FORMA_ABIERTA` y
  todo lo que la cambia pasa por `salirDeLaForma`), Replicar sólo llena lo vacío, los números se ven como se escribieron, teclado
  (`ClientInput` es combobox: cinco pantallas), y AA medido texto por texto (🔑 `wnTx`/`okTx` para texto sobre el gris `C.sf`).
  v10.84.77 (12-oct, 11:11; READY `dpl_BdXffMrLRY1xHDnwdxCmS2r2JdNJ`, commit `c65326d`; vuelta atrás: promover
  `dpl_E3uK64f6DW85YVkUQS2m3RJzfwZv` (el código de v10.84.76) o `git revert c65326d`; la base no cambió; 1063 pruebas). **La forma de la
  orden (OrderForm) en `/impeccable critique`: revisor independiente 22/40, 3 P1, los tres hechos en v10.84.77** (snapshot
  `.impeccable/critique/2026-10-12T16-15-36Z__src-app-jsx-orderform-formulario-orden-nueva.md`): guardar con la base que falla ya no
  vacía la forma ni duplica la orden (el rechazo se dice en el pie, en palabras); la × y «Quitar» quitan sin borrar del servidor, con
  «Deshacer»; la orden facturada y el vendedor tienen candados con su porqué, y cambiar precio o cantidad de una facturada pregunta con las
  cifras de su factura. 🔑 **El banco `tests/banco/gen-orden.mjs` COPIA `create` y `update` de App.jsx**: un cambio ahí se prueba solo con
  la tanda `orden`. Decisiones de Marcelo (12-oct): los P1, los P2 y el reacomodo; facturada = «candados con su porqué»; salir con algo
  capturado = preguntar. Siguen v10.84.78 (los P2) y v10.84.79 (el reacomodo), luego la segunda revisión independiente.
  v10.84.76 (12-oct, 08:45; READY `dpl_B6BQ1X73ZZtfy3iMqjNN5uqhnnD7`, commit `04066e6`; vuelta atrás: promover
  `dpl_Cy75fdkUcn6WxypyzzyPEAvsZvAJ` (el código de v10.84.75) o `git revert 04066e6`; la base no cambió; 1021 pruebas). v10.84.76, decisiones
  de Marcelo: 🔑 **el archivo de impresión (`file_url`) ya no se borra** al cancelar ni a los 30 días («así queda un historial»; el
  archivado diario sólo comprime imágenes), y **a Karla se le avisa** cuando una parte vuelve a quedar por facturar.
  v10.84.75 (12-oct, 06:04; READY `dpl_3oPAzD7tBdsGuCULYCZdWGiRztYK`, commit `f8dc11b`; vuelta atrás: promover
  `dpl_AomL8ZDsFoVpH6QNA5gxYW8QNu5U` (el código de v10.84.74) o `git revert f8dc11b`; la base no cambió; 1017 pruebas). **Las puertas de
  cancelar quedan CERRADAS por las tres revisiones independientes: 18 → 27 → 28/40** (snapshots `.impeccable/critique/2026-10-12T*__src-app-jsx-cancelar.md`).
  v10.84.75: los dos P1 de la tercera (el foco en el motivo desplazaba la ventana a 683×384 y escondía lo que cae, mío de v10.84.74; el
  botón de la orden con la factura de su OC decía lo contrario que el cuerpo) y lo barato de sus P2. Lo que queda, en el CHANGELOG.
  **Siguiente de la lista: OrderForm**, luego el plan matriz.
  v10.84.74 (12-oct, 05:21; READY `dpl_FiXNpaiGEN5F7ZpAqabxEyaq5Mk9`, commit `7255dd8`; vuelta atrás: promover
  `dpl_DhXYRqH7TstLZyUk7ryKwqs9i1oZ` (el código de v10.84.73) o `git revert 7255dd8`; la base no cambió; 1006 pruebas). v10.84.74: **lo que
  dejó la segunda revisión de las puertas de cancelar (27/40, un P1)**: la orden facturada con cada factura en cifras y la de toda su OC
  leída al abrir (timbrada no deja), el teclado que no se sale mientras cancela, el saldo que llega tarde, la orden con folio anticipado
  que corría ya sale de la fila de su máquina, y «Cancelar con su folio» con el motivo escrito. Para Marcelo: una lectura de «¿timbrado?»
  por folio en la base (partes, agrupada, plan matriz). Revisado en producción sin escribir: `ventanas-encima`, 3 de 3.
  v10.84.73 (12-oct, madrugada, segunda noche de `/impeccable`, paso 1; READY `dpl_5uPUiEAGp2oA6zNHFbPZkKUxx4or`, commits
  `ebca474` + `877b20c`; vuelta atrás: promover `dpl_5PkzTT5y9ZRAvsoZQbuiTaTRenns` (el código de v10.84.72) o `git revert 877b20c ebca474`;
  la base no cambió; 990 pruebas). v10.84.73: **las puertas de cancelar** (la orden, la orden con folio, la parte, la línea o factura del
  plan matriz), revisión independiente **18/40** con 3 P1: un solo marco (`VentanaDeCancelar`: diálogo, Esc y el fondo preguntan, el
  rechazo adentro, 5 letras), la del folio lee al abrir lo que la base sabe y dice UN caso con cifras (timbrada no deja; sin «nota de
  crédito» en el nombre: PrintFlow no emite ninguna), la de la orden dice lo que hace además (facturas que caen, inventario, fila,
  archivo, avisos, saldo) y va sobre la orden viva, la del plan matriz dice en cuánto queda la factura. 🔑 **Una ventana nueva que
  cancele algo va en `VentanaDeCancelar`.** Tanda `tests/romper/cancelar.mjs` (155). Revisado en producción sin escribir:
  `tests/recorrido/ventanas-encima.mjs` con P-0619/P-0622, 3 de 3. Decisiones de Marcelo en el CHANGELOG («Para Marcelo»).
  v10.84.72 (12-oct, madrugada, primera noche de `/impeccable` en la PC de casa; READY `dpl_3nUz9Q9Hh9ywsVttkHwjgsXSYi8Y`, commit
  `8501145`; vuelta atrás: `git revert 8501145`, porque el commit de docs ocupa el rollback de un clic; el código de v10.84.71 está en
  `dpl_AtcLJFbJe8EpTMjfUaaPWCSdvQdq`; la base no cambió; 835 pruebas). v10.84.72: **«Asignar folio», lo que dejó su tercera revisión**: la
  ventana anclada arriba y de un solo ancho, el encabezado de ligar, el saldo a favor junto al pago con «Cobrar sólo $…», sin precio
  una nota, lo que llega tarde se dice, el folio que salta pregunta. Revisado en producción sin escribir: `ligar-anticipo` y `sesion`.
  Sigue en PENDIENTES (decisión de Marcelo, base): ligar con el efectivo capturado y crear el vale en un paso.
  v10.84.71 (9-oct, madrugada, desde la PC de casa; READY `dpl_DdYjM6UaGc3xQnyPw3KT6gM8NqkR`, commit `d224ae3`; vuelta atrás:
  `git revert 6d919c5`; el código de v10.84.70 está en `dpl_9RPTiW319tgajwUxxKS8DvQfBexA`; la base no cambió; 803 pruebas).
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
