# PrintFlow — Changelog

Registro cronológico de cambios. Los 3 archivos base (Contexto, Roadmap, Documentación) se mantienen como referencia estructural y solo se actualizan en versiones mayores. Este archivo captura TODAS las actualizaciones incrementales.

---


## v10.29.0 — Selector de pago obligatorio al asignar folio + auto-payment bridge — 18-may-2026

Karla ahora marca obligatoriamente si la orden está pagada al asignar folio fiscal. Si pagada, elige método (efectivo, transferencia, tarjeta, otro) y el bridge crea automáticamente el registro en `cobranza.payments` con la factura ya marcada como pagada (balance=0). Antes todo iba pendiente de cobro a CobranzaFlow excepto pedidos web vía MP.

### Backend (Supabase)

- **CHECK constraint ampliado** en `cobranza.payments.payment_type`: agregados `'tarjeta'` (genérico, sin distinguir crédito/débito) y `'otro'`. Preserva los existentes (efectivo, transferencia, deposito, cheque, tarjeta_credito).
- **Columnas nuevas en `public.orders`:** `payment_status` (NULL | unpaid | paid) y `payment_method` (efectivo | transferencia | tarjeta | otro). 3 CHECK constraints garantizan integridad (si `payment_status='paid'`, `payment_method` obligatorio).
- **RPC `assign_invoice` ampliada** con 2 nuevos parámetros opcionales: `p_payment_status` y `p_payment_method`. La versión vieja de 6 params fue dropada para evitar ambigüedad. Los nuevos params tienen DEFAULT NULL → backward compatible si algún caller legacy llamara con 6 args.
- **Trigger `sync_invoice_from_orders` actualizado** con nuevo bloque ELSIF que detecta pagos manuales: si `payment_status='paid'` y `payment_method` definido, crea fila en `cobranza.payments` con `applied_by` resuelto por username (`invoiced_by`) y marca invoice como pagada con `balance=0, status='pagada'`. El bloque MP existente queda intacto y mutuamente excluyente.

### Bug fix incidental en bridge

El trigger ahora calcula `v_base_amount` con condicional: `maq_price` para maquila, `price` para internas. Antes el bridge usaba siempre `NEW.price`, lo que dejaba `amount=NULL` o 0 para órdenes maquila en CobranzaFlow (bug latente solo visible al inspeccionar el monto en CobranzaFlow).

### Frontend (App.jsx)

- **Componente nuevo `PaymentStatusPicker`** — selector visual con 2 botones grandes (Pagada/No pagada) + 4 métodos (Efectivo, Transferencia, Tarjeta, Otro) cuando se elige Pagada. Reutilizable, multi-línea legible.
- **`InvoiceModal` modificado** — agrega state `paymentStatus`/`paymentMethod`, validación `paymentValid` en `handleProceed`, picker en el render entre folio y botones, resumen en vista de confirmación con color según estado, params nuevos en `handleConfirm`.
- **`PreInvoiceModal` modificado** — mismo patrón, picker aparece después de seleccionar razón.
- **`db.assignInvoice` ampliada** con 2 nuevos parámetros opcionales (paymentStatus, paymentMethod).
- **Callbacks en main** — `invoiceModal` y `preInvoiceModal` `onConfirm` reciben los nuevos params y los persisten en setOrders optimista + timeline message muestra el estado de pago.
- **DetailModal** muestra `<Row l="Pago" v="✅ Pagada (método)" />` debajo del folio.
- **OCard** muestra badge inline `✅ PAGADA · método` al lado del folio.
- **`dbCols` whitelist** incluye `payment_status` y `payment_method` para que setOrders pase a BD correctamente.

### Decisiones de diseño

| ID | Decisión | Rationale |
|---|---|---|
| D-1 | Enviar a CobranzaFlow CON pago aplicado (no skip) | Trazabilidad de TODOS los pagos, incluso caja |
| D-2 | Métodos: Efectivo, Transferencia, Tarjeta, Otro | 99% de casos sin debate crédito/débito |
| D-3 | Selector OBLIGATORIO siempre | Evita "se me olvidó marcar pagada" |
| D-4 | Aplica a ambos flujos (normal + anticipado) | Consistencia |
| D-5 | Ampliar CHECK constraint vs mapear | UI limpia |
| D-6 | Auto-payment en bridge SQL | Atomicidad: 1 transacción |
| D-7 | Resolver applied_by por username (no por role) | Refleja quién aplicó el pago realmente; fallback a primer cxc activo |
| D-8 | Bug fix incidental: maq_price en bridge | Aprovechar la migración |

### Numeración

El brief proponía v10.28.1 que ya estaba tomado por el primer fix bundle (también v10.28.2 y v10.28.3). Numerado **v10.29.0** porque introduce funcionalidad nueva no-trivial + cambios SQL.

### Sin cambios

- Pedidos web Mercado Pago (mantienen su flujo automático intacto, bloque IF en trigger no fue modificado)
- CobranzaFlow UI (los registros llegan ya pagados; el dashboard se actualiza solo)
- Bridge de cancelaciones
- OC compartidas con folios anticipados

### Riesgos cubiertos

- ✅ Backward compatible (params NULL = comportamiento legacy)
- ✅ UNIQUE INDEX y CHECK constraints previenen estados inconsistentes
- ✅ El nuevo bloque ELSIF es mutuamente excluyente con el bloque IF de MP — no hay riesgo de payment duplicado
- ✅ Karla username verificado en cobranza.users con role='cxc'


## v10.28.3 — Hotfix: PreInvoiceModal valida precio ignorando maquila — 18-may-2026

Bug detectado por Karla al intentar asignar folio anticipado a P-3506 (ELIZABETH ROCHA, maquila completa con CREATIVE, $1,390): el modal mostraba "⚠️ Datos incompletos · Precio" a pesar de que la orden tenía `maq_price=1390` correctamente capturado.

### Causa

`PreInvoiceModal` ([App.jsx:1499](src/App.jsx#L1499)) validaba contra `order.price` sin considerar que las órdenes maquila guardan el precio en `order.maq_price` (en estos casos `order.price` queda NULL correctamente). La validación siempre fallaba para maquilas, bloqueando el botón "⚡ Asignar Folio Anticipado".

### Fix

Validación condicional según `order_type`:

```javascript
const priceField = order?.order_type === "maquila" ? order?.maq_price : order?.price;
if (!priceField || Number(priceField) <= 0) missing.push("Precio");
```

Mismo patrón usado en `WIPDashboard` y `OperationalHealthView`.

### Alcance del bug

- ❌ Solo afectaba "⚡ Asignar Folio Anticipado" (v10.9.0) en órdenes maquila
- ✅ NO afectaba el flujo normal "📄 Asignar Folio y Entregar" (validación distinta, asume datos OK porque la orden ya llegó a salidas/maq_received)
- ✅ NO afectaba captura/edición (`OrderForm` ya condiciona campo por `!isMaq`)

### Sin cambios

- SQL / schema
- Resto del código
- Comportamiento en órdenes internas (preservado idéntico)

### Validación

- ✅ P-3506 ahora puede recibir folio anticipado (`order_type=maquila, price=null, maq_price=1390` validado contra Supabase)
- ✅ Órdenes internas sin precio siguen mostrando alerta correctamente
- ✅ Órdenes maquila sin `maq_price` ahora detectadas (antes eran false-negative — el bug ocultaba este caso también)

### Numeración

El brief proponía v10.28.1 pero esa versión ya estaba tomada por el fix bundle del primer scan; éste va como v10.28.3 (siguiente después de v10.28.2).


## v10.28.2 — Bug scan #2 fix bundle + remoción de dead code — 18-may-2026

Segundo scan exhaustivo de bugs cubriendo áreas no auditadas en v10.28.1 (capa db, módulo OC, formularios, realtime, helpers globales). 8 fixes + remoción de ~70 líneas de dead code. Sin cambios DB.

### 🔴 Críticos

**1. `db.addTimeline`/`addComment`/`addWaste`/`addMachineLog`/`closeMachineLog`/`addNotification`/`addPlate`/`addChemical`/`startMaintenance`/`endMaintenance` swallow errors silenciosamente.** `supabase.insert()/update()` no lanzan — siempre destructuran `{data, error}`. Si RLS o schema mismatch fallaban, el insert nunca llegaba a BD pero la UI mostraba el cambio. Caso real: una orden avanzaba pero su entrada en `order_timeline` nunca se persistía → historia incompleta. `closeMachineLog` lo mismo: si el UPDATE fallaba, quedaban logs abiertos fantasma.
**Fix:** todos los métodos ahora destructuran `{error}` y `throw new Error("<method>: " + error.message)`. Bonus: `closeMachineLog` además agregó guard `isNaN(started.getTime())` consistente con el fix de `closeML` en v10.28.1.

**2. Auto-cleanup de archivos borraba por `created_at` cuando debería ser `delivered_at`/`cancelled_at`** ([App.jsx:5640](src/App.jsx#L5640)). El comentario decía "órdenes terminadas hace +30 días" pero filtraba por fecha de creación. Una orden creada hace 35 días y entregada ayer perdía sus archivos en menos de 24h en vez de a los 30 días post-entrega.
**Fix:** dos queries paralelas, una por `delivered_at < cutoff` y otra por `cancelled_at < cutoff`, concatenadas.

### 🟠 Altos

**3. Realtime de notifications solo escuchaba INSERT** ([App.jsx:5562](src/App.jsx#L5562)). Dos pestañas admin nunca sincronizaban read/delete entre sí. El parche de v10.28.1 (`reloadNotifications`) cubrió el caso de "Marcar todas como leídas" en la misma sesión, pero no la sincronización cross-tab.
**Fix:** cambiar a `event: "*"` en la suscripción.

**4. `notifyResponsible` (Salud Operativa) bypaseaba `db.notify`** ([App.jsx:4683](src/App.jsx#L4683)). Insertaba directo en `notifications` sin pasar por el helper que añade copy al admin, ni capturar errores (que ahora con #1 son obligatorios).
**Fix:** usar `db.notify(resp.role, order.id, "admin_attention", msg, null, "admin")`.

**5. `PantoneInput` useEffect con deps `[arr.length]`** ([App.jsx:2302](src/App.jsx#L2302)). Si el usuario quitaba un pantone y agregaba otro distinto (misma longitud), el efecto no se disparaba → el chip nuevo quedaba con hex default.
**Fix:** `[arr.join(",")]` igual que `PantoneChips`.

**6. `LiveTimer` renderizaba "⏱ NaNm" si `started` era inválido** ([App.jsx:847](src/App.jsx#L847)). v10.28.1 fixed `closeML` para no producir NaN downstream, pero `LiveTimer` mismo no se defendía si llegaba un log con timestamp corrupto.
**Fix:** `const t=new Date(started); if(isNaN(t.getTime())) return null;` antes del setInterval Y en el render.

**7. `addProductToOC` no pre-llenaba `client_id`** ([App.jsx:5784](src/App.jsx#L5784)). Al agregar un 2° producto a una OC, `resolve_client_for_order` corría de nuevo y podía linkear el nuevo producto a un `client_id` distinto al de la OC original.
**Fix:** agregar `client_id: oc.client_id||null` al objeto pre-llenado.

**8. `OrderForm` useEffect con dep `[editOrder]` (referencia)** ([App.jsx:2410](src/App.jsx#L2410)). Si `editOrder` cambiaba referencia (e.g. via realtime), los cambios tipeados en progreso se perdían silenciosamente.
**Fix:** dep `[editOrder?.id, editOrder?._fromOC]` para resetear solo cuando cambia la orden, no la referencia.

### 🗑️ Dead code eliminado (~70 líneas)

`db.loadPlans`, `db.addToPlan`, `db.removeFromPlan`, `db.reorderInMachine`, `db.executePlanOrder`, `db.clearPlan` — todos eran del `ProductionPlanner` deprecado en v10.26.0 con la cola por máquina. Quedaron huérfanos sin callsites en el codebase. La tabla `production_plans` en Supabase queda intacta (no se borró por seguridad, pero puede archivarse cuando se confirme que no la lee nadie más).

### Sin cambios

- DB schema (cero migración; `production_plans` table queda intocada por seguridad)
- RPCs (`move_order_in_queue` igual; `execute_plan_order` y `clear_plan` en BD quedan huérfanas pero sin riesgo)
- Otras vistas


## v10.28.1 — Bug scan post-deploy v10.26-v10.28: fix bundle — 17-may-2026

Scan completo de bugs encontrados después de deployar v10.26.0 (cola por máquina), v10.27.0 (Dinero en Proceso) y v10.28.0 (Salud Operativa). 9 fixes en un solo commit. Sin cambios DB.

### 🔴 Críticos

**1. `reorder_in_machine` SIN gate de permisos.** La UI gateaba por rol pero el handler no llamaba `canExecuteAction`. Cualquier usuario con DevTools (vendedor, secretaria) podía llamar `onAction(id,"reorder_in_machine",{newPosition:0})` y mover la cola productiva. Rompía el patrón de defensa en profundidad v10.12.0.2.
**Fix:** agregado al whitelist `ACTION_ROLES: ["admin","produccion","german"]` + gate `canExecuteAction` en el handler.

**2/3. `assignMachine` sin lock ni UI optimista.** A diferencia de `doAdv`/`cancelOrder`/`sendMaquila`, `assignMachine` no llamaba `setActionLoading(oid)`. Permitía drop rápido en 2 máquinas distintas → dos RPCs concurrentes leyendo el mismo `oldMachine`. Race condition de cola: `targetPos` se calculaba del closure stale.
**Fix:** envuelto en `setActionLoading(oid)` + `finally{setActionLoading(null)}`. El cross-user race extremadamente raro queda cubierto por el UNIQUE INDEX `idx_one_active_per_machine` que aborta el segundo RPC.

### 🟠 Altos

**4. `cancelOrder`: modal queda fantasma si falla.** `setCancelModal(null)` estaba dentro del try, después de los awaits. Si la red fallaba, la orden se veía cancelada localmente PERO el modal de cancelación seguía abierto encima.
**Fix:** movido a `finally{setCancelModal(null)}`.

**5. `markAllNotifsRead` no recargaba notifs localmente.** La suscripción realtime solo escucha INSERT en `notifications` ([App.jsx:5555](src/App.jsx#L5555)), no UPDATE. Marcar 112 notifs leídas en BD funcionaba pero el contador quedaba en 112 hasta F5.
**Fix:** nuevo prop `reloadNotifications` en `OperationalHealthView` que se llama tras éxito.

**6. `closeML` generaba `minutes:NaN` con `started` inválido.** Si `e.started` era undefined, `new Date(undefined)` → Invalid Date → NaN. El render local mostraba "NaN".
**Fix:** validar `s.getTime()` con `isNaN`, fallback a 0.

**7. `return_to_ready` no forzaba `machine_queue_position:null` en UPDATE.** Dependía 100% de que la RPC lo hiciera. Defensa en profundidad débil.
**Fix:** agregado `machine_queue_position:null` y `current_machine:null` explícitos al UPDATE de orders.

### 🟡 Medios

**8. `isVencida` en OperationalHealthView fallaba con due_date no-ISO-date.** Concatenar `"T12:00:00"` a un due_date que ya tenía timestamp (legacy) producía Invalid Date → órdenes con formato legacy NO aparecían como vencidas (oculto silenciosamente).
**Fix:** `String(o.due_date).slice(0,10) + "T12:00:00"` en `isVencida`, `isUrgente`, `getTopPriority`, `getIncompleteData` y display "VENCIDA hace N días".

**9. WIPDashboard `topClients` no normalizaba casing.** "Maderas SA" y "maderas sa" contaban como clientes distintos, mostrando duplicados en el top 5.
**Fix:** key = `display.toLowerCase().replace(/\s+/g, " ")`, mantiene display original.

**10. `responsiblePulse.horasSinActividad` trataba `null` como 0.** Si `created_at` también era null (raro), reportaba "0h máx sin actividad" → ocultaba el problema en lugar de exponerlo.
**Fix:** fallback a 999h si no hay fecha de referencia para que sí se vea como alerta.

### Sin cambios

- DB schema (cero migración)
- RPC `move_order_in_queue` (intacta, solo el caller le pasa parámetros más defensivos)
- Componentes nuevos de v10.27/v10.28 funcionalmente igual, solo con guards


## v10.28.0 — Dashboard "🩺 Salud Operativa" (admin) — 17-may-2026

Segunda vista admin-only del nav "⋯ Más" después de v10.27.0. Mientras "💰 Dinero en Proceso" responde "¿cuánto dinero está atorado dónde?", esta vista responde "¿qué está mal hoy y quién debería arreglarlo?". Consolida en una sola pantalla la detección de problemas (datos incompletos, estancadas, mantenimientos, OCs huérfanas) que antes vivía dispersa en 5 vistas y 112+ notificaciones.

### Secciones (6)

1. **🚨 Top Prioridad del Día** — banner con la orden más crítica según scoring: vencida (+1000) > urgente <=2d (+500) > estancada crítica >48h (+300) > warning 24-48h (+100) > min(dinero/1000, 500). Botones: "Ver orden" + "📣 Notificar [Responsable]".
2. **👥 Pulso por Responsable** — card por cada rol activo (Noemí/Gerardo/Lupita/Germán/Karla) con: total órdenes, vencidas, urgentes, horas máx sin actividad. Click "Ver todas ▼" expande la lista. Borde rojo si tiene vencidas, naranja si urgentes, verde si todo OK.
3. **⏳ Estancadas** — reusa `getStale()` existente. Separa críticas (>48h) de warning (24-48h). Lista compacta con badges VENCIDA/URGENTE y dinero atorado. "Ver todas" si hay más de 8.
4. **❗ Datos Incompletos** — 9 categorías: vencidas, sin fecha, sin precio, sin cantidad, sin archivo en stage avanzado, maquila sin proveedor, sin agente, sin teléfono, sin email. Las críticas (rojo) están siempre expandidas; las informativas (amarillo) colapsadas. Botón "✏️ Editar" inline que reusa `handleAction("edit")`.
5. **🏭 Estado de Máquinas** — mantenimientos activos (con días iniciado + órdenes atascadas) + máquinas con carga ordenadas por dinero.
6. **🧹 Limpieza Sugerida** — solo aparece si hay OCs huérfanas o notifs admin sin leer >10. Acciones masivas con confirmación.

### Acciones inline (con confirmación reutilizando ConfirmModal existente)

- **Cancelar OC huérfana** → UPDATE `purchase_orders.status='cancelled'` + `cancelled_at/by/cancellation_reason="Limpieza desde Salud Operativa — sin órdenes activas"`.
- **Marcar todas las notifs admin como leídas** → bulk UPDATE en `notifications` donde `target_role='admin' AND read=false`.
- **Notificar a responsable** → INSERT en `notifications` con tipo `admin_attention`, dirigido al rol que tiene la pelota según `STAGE_RESPONSIBLE`.

### Mapeo `STAGE_RESPONSIBLE` (constante global)

| Stage | Responsable |
|---|---|
| design, proof_client | Noemí (preprensa) |
| proof_printing, ctp | Germán |
| placas_listas, ready, in_production, packaging, maquila_out, maquila_in | Gerardo (producción) |
| maq_created, maq_sent, maq_in_progress | Lupita (secretaría) |
| salidas, maq_received | Karla |
| draft | both (no se cuenta en Pulso) |

### Implementación

- **`OperationalHealthView`** (~390 líneas) entre `StatCard` y `AuditoriaView`, estilo multi-línea legible (consistente con v10.27.0).
- **4 helpers globales** cerca de `getStale`: `STAGE_RESPONSIBLE`, `TERMINAL_STAGES`, `getTopPriority`, `getIncompleteData`, `getOrphanOCs`.
- **Reutiliza `ConfirmModal` existente** vía `setConfirmModal` (no crea componente nuevo como sugería el brief).
- **Cero SQL, cero migración, cero RPC**. Todo se calcula con `useMemo` sobre el state local `orders`, `notifications`, `maintenance`, `purchaseOrders` (realtime ya estaba).

### Auto-fix vs brief

- Brief usa `onAction(o.id, "view")` (típo recurrente como en v10.27.0) → corregido a `"detail"` (la action real del codebase).
- Brief sugiere crear `ConfirmActionModal` nuevo → reutilizado el `ConfirmModal` existente con `setConfirmModal`, mismo patrón que `doAdv`, `cancelOrder`, `revert`.

### Snapshot al deploy (17-may-2026)

- 3 órdenes vencidas en el día
- 3 OCs huérfanas (validado contra Supabase)
- 112 notificaciones admin sin leer
- Top Prioridad esperado: P-3508 GRUPO MODELO ($150K, vencida, design, Noemí)
- Cuello de botella detectado en Pulso: Noemí con 2 vencidas + 1 urgente

### Sin cambios

- DB schema (cero migración)
- Helpers de negocio (`getStale`, `db.notifySecs`, etc.)
- Resto de la UI


## v10.27.0 — Dashboard "💰 Dinero en Proceso" (admin) — 17-may-2026

Nueva vista admin-only que muestra distribución de capital atorado en cada zona del workflow. Visible solo para Marcelo en el "⋯ Más" del nav (queda fuera de los primeros 5 tabs visibles).

### Métricas mostradas

- **Resumen global:** total atorado en $MXN, órdenes activas, alertas de sin precio, top cliente con porcentaje sobre el total.
- **Por zona del workflow** (6 zonas, agrupan 18 stages): Captura, Pre-prensa, Producción, Maquila Externa, Regreso Maquila, Salida. Cada zona muestra dinero, conteo, tiempo promedio (días desde `created_at`), órdenes sin precio. Click expande a stages individuales con lista compacta de las 5 órdenes más relevantes (+ contador "+N más" si hay más).
- **Producción — desglose por máquina:** al expandir Producción, además de stages aparece "🏭 Por máquina" mostrando cuánto dinero/órdenes en cada máquina física (Printmaster 74, GTO, etc.) ordenado por dinero descendente.
- **Maquila — margen:** en las zonas Maquila Externa y Regreso Maquila se muestra `maq_price − maq_cost` total (etiqueta "M $X").
- **Top 5 clientes con dinero atorado** con medallas 🥇🥈🥉 (dorado/plata/bronce) para los primeros 3.
- **Alertas:** lista de órdenes sin precio capturado con botón "✏️ Editar Precio" inline que abre el formulario de edición.

### Cobertura del workflow

| Zona | Stages incluidos |
|---|---|
| 📝 Captura | draft, maq_created |
| 🎨 Pre-prensa | design, proof_printing, proof_client, ctp, placas_listas |
| ⚙️ Producción | ready, in_production |
| 🚚 Maquila Externa | maquila_out, maq_sent, maq_in_progress |
| 📥 Regreso Maquila | maquila_in, maq_received |
| 📤 Salida | packaging, salidas |

Stages excluidos (terminales): delivered, maq_delivered, cancelled, maq_cancelled, web_pending, web_rejected.

### Implementación

- **Componente nuevo `WIPDashboard`** (~330 líneas) entre `Analytics` y `AuditoriaView`. Estilo multi-línea legible (decisión consciente, contrasta con el resto del archivo compacto).
- **Helper `StatCard`** para las 4 tarjetas del resumen global.
- **Constante `WORKFLOW_ZONES`** declarada arriba junto a `SM` y `MACHINES`.
- **Cero SQL, cero migración, cero RPC.** Todo se calcula con `useMemo` sobre el state local `orders` (realtime ya estaba). Si la pestaña falla a runtime, la app sigue funcionando.

### Snapshot al deploy (17-may-2026)

- Total atorado: **$256,631 MXN**
- 19 órdenes activas
- 2 sin precio (P-3512 Lucy Perez, P-3514 Alejandra Rodriguez — ambas en design)
- Top cliente: GRUPO MODELO con $150,010 (58% del total) en 1 sola orden

### Decisiones de diseño

| ID | Decisión | Rationale |
|---|---|---|
| D-1 | Zonas expandibles a stages al click | Vista alto nivel + detalle a demanda |
| D-2 | Dashboard completo (todas las métricas) | Esfuerzo marginal extra vs solo dinero |
| D-3 | Solo admin | Conservador para v1, ampliar después si piden |
| D-4 | Todo frontend, sin SQL | `orders` ya tiene realtime |
| D-5 | Tab en "⋯ Más" del nav admin | No saturar barra principal |
| D-6 | Tiempo en stage usa `created_at` | Aproximación; cálculo exacto requeriría leer `order_timeline` |
| D-7 | Click en orden → DetailModal | Reutiliza acción `detail` existente |
| D-8 | Botón "Editar Precio" usa acción `edit` | Cero código nuevo de form |
| D-9 | Estilo multi-línea (no compacto) | Marcelo eligió legibilidad para componente nuevo de ~330 líneas |
| D-10 | "Por máquina" muestra solo total (sin desglose activa/cola) | Marcelo eligió simplicidad; dashboard es de dinero, no workflow |

### Limitaciones conocidas (para versiones futuras)

- Tiempo en stage es aproximación con `created_at` (si una orden lleva 2 días en design pero fue creada hace 5, mostrará "5 días"). Fix futuro: leer `order_timeline`.
- Sin filtro temporal (siempre snapshot actual).
- Sin exportación CSV.
- Top clientes no normaliza espacios ("ROBERTO " vs "ROBERTO" cuentan separado). Fix correcto sería en la captura, no aquí.
- Click en stage muestra solo top 5 órdenes con "+N más" si hay más.


## v10.26.2 — Botón "Volver a Lista" en cola en espera + permiso German — 17-may-2026

Pedido de Marcelo: agregar el botón 🔄 ("Sacar de la máquina y volver a Lista") también a las tarjetas de **órdenes en espera**, no solo a la activa.

### Cambios

- **Kanban y PreprensaBoard**: cada tarjeta de `enEspera` ahora muestra el botón 🔄 junto al "⏯️ Activar" (header de la card, en una fila con `gap:3`). El handler `return_to_ready` ya soportaba órdenes en cola (no solo activas) desde v10.26.0 — la RPC `move_order_in_queue` saca la orden de la cola y shiftea las demás. No requiere cerrar machine_log (no tenía uno abierto).
- **Bug latente arreglado**: el whitelist `ACTION_ROLES.return_to_ready` solo permitía `["admin","produccion"]`, pero en FASE 4 (v10.26.0) expuse el botón 🔄 en la activa de PreprensaBoard para el rol "german". Resultado: German clickeando el botón obtenía "Tu rol no puede ejecutar esta acción". Agregado "german" al whitelist (tiene sentido conceptualmente: él gestiona órdenes en CTP/Procesadora, debe poder regresarlas a Lista si algo sale mal).

Sin cambios DB.


## v10.26.1 — Hotfix: drop de Lista a máquina con cola — 17-may-2026

Bug reportado por Marcelo inmediatamente después de v10.26.0: al arrastrar una orden desde **Lista** a una máquina que tenía órdenes **activa + en espera**, el drop fallaba silenciosamente. Solo funcionaba si la máquina estaba vacía o solo tenía la activa.

### Causa raíz

Las tarjetas de `enEspera` tenían `onDragOver={e=>{e.preventDefault();e.stopPropagation()}}` y `onDrop={e=>{e.preventDefault();e.stopPropagation();...}}` con stopPropagation **incondicional**, ejecutado **antes** de validar si era reorder o asignación nueva. Cuando el drop venía desde Lista (no de la misma cola), la condición `fromMachine===m.id` fallaba, no se hacía nada, pero la propagación al wrapper de máquina ya estaba bloqueada — el `drop(m.id,e)` del wrapper nunca se llamaba y `setDropConfirm` nunca abría el modal.

### Fix

`stopPropagation` ahora solo se llama **dentro del condicional**, no antes. Si el drop no es un reorder válido (fromMachine vacío o distinto), el evento burbujea hasta el wrapper de máquina que lo procesa como asignación nueva normalmente. Mismo cambio en Kanban y PreprensaBoard.

Sin cambios DB.


## v10.26.0 — Cola por máquina (eliminación del Planificador) — 17-may-2026

Cambio mayor en cómo se modelan las órdenes asignadas a máquina. Antes: cualquier número de órdenes podía compartir la misma máquina simultáneamente (timer corriendo en todas) y el Planificador era una capa extra para ordenarlas. Ahora: cada máquina tiene una **cola posicional** donde solo `position=0` está ACTIVA (con `order_machine_log` abierto). El resto espera en `position=1,2,...`. Al sacar la activa, la siguiente se promueve automáticamente.

### Por qué

El modelo paralelo creaba ambigüedad: 3 órdenes "en la máquina al mismo tiempo" no reflejaba la realidad física (una sola impresora corre un solo trabajo). Los timers acumulaban horas espurias. El Planificador era una compensación: una cola alterna ordenada por Gerardo. Con el nuevo modelo, **la cola es el plan**, no hay capa extra.

Disparado por las 3 órdenes de Roberto (P-3496/P-3497/P-3498) que llevaban días en `off_pm74` al mismo tiempo, sumando horas falsas y bloqueando reportes de productividad.

### Cambios DB

- **Nueva columna**: `orders.machine_queue_position INT DEFAULT NULL` (NULL = no asignada a máquina).
- **Backfill**: órdenes activas con `current_machine` ya seteado migraron a posiciones contiguas por máquina (ordenadas por `created_at`).
- **Pre-migración Roberto**: P-3496 → pos=0 (activa, log abierto preservado), P-3497 → pos=1, P-3498 → pos=2 (logs cerrados con minutes=0 para no inflar reportes).
- **UNIQUE INDEX `idx_one_active_per_machine`**: índice parcial que impide >1 orden con `position=0` en la misma máquina real (excluye `vm_manual` y NULL). Garantía a nivel BD.
- **RPC `move_order_in_queue(p_order_id TEXT, p_target_machine TEXT, p_target_position INT, p_actor TEXT)`**: SECURITY DEFINER. Una sola transacción con `pg_advisory_xact_lock` que maneja todos los casos: sacar de cola (shift hacia abajo), insertar en máquina nueva (shift hacia arriba), reordenar dentro de la misma máquina. Devuelve JSONB con `new_active_id` cuando alguien fue promovido (el caller debe abrir su `order_machine_log`).

### Cambios App.jsx

- **Helper `getMachineQueue(orders, machineId)`**: filtra y ordena por `machine_queue_position`.
- **`db.moveOrderInQueue`**: wrapper del RPC.
- **`dbCols`** incluye `machine_queue_position` en el whitelist de columnas persistibles.
- **Kanban**: el render por máquina ahora muestra:
  - **Tarjeta ACTIVA** (borde verde #34c759, label "🏭 ACTIVA", LiveTimer corriendo, botones 📦 Empaque + 🔄 Volver a Lista).
  - **Cola en espera** (separador, drag&drop entre tarjetas para reordenar, botón "⏯️ Activar" para promover una a posición 0).
- **PreprensaBoard**: mismo patrón para CTP y Procesadora (botones según rol admin/germán, "📋 Placas Listas" cuando está en `pp_proc`).
- **`assignMachine`**: calcula `targetPos = currentQueue.length` para nueva asignación; ejecuta RPC; abre log solo si queda en pos=0; promueve siguiente si saca de cola anterior.
- **`doAdv`, `sendMaquila`, `cancelOrder`, `return_to_ready`**: si la orden estaba en una cola, llaman al RPC para sacarla atómicamente. Si el RPC devuelve `new_active_id`, abren `order_machine_log` para esa orden y añaden timeline "⏯️ Auto-activada (cola promoción)".
- **Nuevo handler `reorder_in_machine`** en `handleAction`: maneja drag&drop entre tarjetas de la misma máquina y botón "Activar". Cierra/abre logs según corresponda (si la activa pasa a cola, cierra su log; si una en cola pasa a activa, cierra la activa anterior y abre la nueva).

### Eliminado

- **Función `ProductionPlanner` completa** (569 líneas, comprende: tabla, drag&drop, sticky bar, prioridades manuales, etc.).
- **Entrada de nav** "🗓️ Planificador" para produccion/admin.
- **Render** `{view==="planner"&&...}` en el switch principal.

### Migración para usuarios

Las órdenes que estaban "en la máquina" siguen ahí. Lo que cambió es que ahora hay un orden explícito: solo la primera tiene el timer activo. Las demás esperan visualmente en una lista debajo. Producción puede:

- **Arrastrar entre tarjetas** dentro de la misma máquina para reordenar.
- **Click "⏯️ Activar"** en una en espera → cierra el log de la activa actual, abre el de la elegida.
- Cuando termina la activa (📦 Empaque / 🔄 Volver a Lista / cancelar / maquila), **la siguiente se promueve automáticamente** y empieza su timer.

### Invariante crítico

Garantizado a 3 niveles: BD (UNIQUE INDEX), RPC (lock + shift atómico), App (handlers usan RPC para todos los movimientos). Imposible que dos órdenes tengan `position=0` en la misma máquina real simultáneamente.


## v10.25.2 — Pantones también en impresión modo Avanzado — 16-may-2026

Bug reportado por Marcelo justo después de v10.25.1: los pantones SOLO se imprimían en órdenes en modo Sencillo. En Avanzado no aparecían.

### Causa raíz

La fila de pantones que agregué en v10.25.0 estaba dentro del bloque `if(!isMaq && hasSpecs)` del `PrintOrder`. `hasSpecs` requiere `paper_type`, `ink_front` o `width_cm` (campos individuales del modo Sencillo). En modo Avanzado esos campos están vacíos (todo va en `product`/textarea), entonces `hasSpecs = false` y el bloque entero se saltaba — incluyendo los pantones.

### Fix

Saqué los pantones a un **bloque independiente** que solo depende de:
1. No ser maquila (consistente con D-7)
2. Tener al menos un pantone capturado en `pantone_front` o `pantone_back`

Resultado: aparece en **ambos modos** (Sencillo y Avanzado) cuando hay pantones. Se ve como mini-tabla con header "🎨 Pantones" y 2 columnas (Frente / Vuelta).

Sin cambios DB.


## v10.25.1 — Pantones también en modo Avanzado — 16-may-2026

Extensión menor de v10.25.0 reportada por Marcelo: los PantoneInputs estaban solo en el modo Sencillo del formulario. Faltaba en Modo Avanzado (donde los datos técnicos van en un textarea libre).

### Cambio

- Bloque nuevo con guarda `!specsOnly && advMode && !isMaq` justo después del textarea de "Datos Técnicos Completos". Mismos 2 PantoneInputs (Frente + Vuelta) que en el modo Sencillo.
- No aplica a Maquila (consistente con D-7 de v10.25.0).
- Sin cambios de DB ni de schema.

### Por qué tiene sentido

En modo Avanzado el equipo escribe libremente los datos técnicos en un solo textarea (libros, calendarios complejos, etc.). Antes los pantones tenían que mencionarse en ese texto. Ahora se estructuran aparte con preview, manteniendo el textarea para todo lo demás.


## v10.25.0 — Pantones por orden con preview de color — 16-may-2026

Captura estructurada de tintas Pantone con typeahead + preview visual del color. Antes los pantones se escribían en texto libre dentro de `ink_front`/`ink_back` o `notes` sin posibilidad de ver el color en pantalla.

> **Nota:** el brief original proponía v10.24.0 pero esa numeración estaba ocupada. Renumerado a v10.25.0 (mismo patrón de versiones previas).

### Backend (Supabase)

- **Tabla nueva `public.pantone_colors`** — 1148 entries hidratadas desde dataset MIT (`adonald/Pantone-CMYK-RGB-Hex`). Cubre PMS Coated completo (códigos 100 C–814 C, Process Yellow/Magenta/Cyan/Black, Pantone Yellow/Red/Blue/Green/Orange/Purple, Reflex Blue, Rubine Red, Rhodamine Red, Warm Red, Violet, Black 2–7, Warm Gray 1–11, Cool Gray 1–11, Metallics 801–807 + 2X variants). 102 marcados como `is_common=true`.
- **Campos:** `code` (PK), `code_normalized` (LIKE rápido), `name`, `hex`, `rgb_r/g/b`, `system` (Coated/Uncoated/Metallic/etc.), `is_common`.
- **Índices:** `code_normalized text_pattern_ops`, `system`, parcial sobre `is_common WHERE true`.
- **RLS:** `SELECT abierto`. INSERT/UPDATE/DELETE solo service_role.
- **RPC `search_pantone(p_query, p_limit)`** — typeahead optimizado: prefix match prioritario, comunes primero, Coated antes que Uncoated, códigos cortos antes que largos. STABLE SECURITY DEFINER. GRANT a `authenticated` y `anon`.
- **RPC `get_pantone_by_code(p_code)`** — resolución exacta normalizada (case-insensitive, sin espacios) para hidratar chips de órdenes existentes con su color.
- **Columnas nuevas en `public.orders`:** `pantone_front TEXT[] DEFAULT '{}'` y `pantone_back TEXT[] DEFAULT '{}'`.

### Frontend (App.jsx)

- **Componente nuevo `PantoneInput`** — input con typeahead async (debounce 250ms vs `search_pantone`), chips con preview de color circular (18px), botón `×` para quitar. Cache local de hex para evitar refetch (hidrata chips existentes vía `get_pantone_by_code`).
- **Componente nuevo `PantoneChips`** — render read-only para DetailModal con cuadritos de 14px, mismo fuente que el resto del UI. Cancela fetches in-flight en unmount.
- **OrderForm:** 2 PantoneInputs (Frente + Vuelta) después del grid de Tintas, dentro del bloque `!isMaq` (no aplican a maquila — el proveedor maneja sus tintas).
- **DetailModal:** 2 filas nuevas en sección Especificaciones (`<Row>` con `<PantoneChips>` como valor), solo si hay pantones capturados.
- **Orden impresa (`PrintOrder`):** fila adicional `colspan=5` debajo de la tabla Impresión con resumen "Frente: X, Y · Vuelta: Z" (sin preview por ser print).
- **OCard:** sin cambios (decisión consciente para preservar compacidad).
- **Notificaciones detalladas (v10.19.0):** `pantone_front` y `pantone_back` agregados a `TRACKED_EDIT_FIELDS` + manejo especial en `fmtEditValue` para arrays (`Array.isArray` check, join con `", "`).
- **Whitelists actualizados:** `empty`, `dbCols`, `editableFields`.

### Decisiones de diseño

| ID | Decisión | Rationale |
|---|---|---|
| D-1 | Frente y Vuelta separados (TEXT[] cada uno) | Replica patrón existente de `ink_front`/`ink_back` |
| D-2 | Múltiples pantones por lado (no uno solo) | Una orden puede usar varios pantones (logo + acento + base) |
| D-3 | Tabla Supabase + RPC en lugar de dataset embebido en JS | Pantone Inc. no expone API gratuita; permite actualizar catálogo sin redeploy |
| D-4 | Preview visible en formulario + DetailModal | Pedido explícito |
| D-5 | OCard sin preview | Mantener compacto el listado principal |
| D-6 | Preview solo en pantalla, no en print | El monitor nunca es 100% fiel al pantone físico |
| D-7 | Texto libre en `ink_front`/`ink_back` se mantiene | Permite seguir escribiendo "4 tintas CMYK" para casos no-Pantone |

### Cómo se generó el dataset

1. `curl` de `adonald/Pantone-CMYK-RGB-Hex/master/pantone_CMYK_RGB_Hex.json` (MIT license, 1149 entries).
2. Script `awk` procesa el JSON: agrega sufijo " C" a códigos numéricos, normaliza, marca ~30 como `is_common`, escapa SQL.
3. SQL dividido en 5 chunks de ~250 filas, aplicados vía MCP `execute_sql`. Total persistido: 1148 (1 duplicado por nombre "Black" deduplicado vía `ON CONFLICT DO NOTHING`).

### Limitaciones conocidas

- No migra órdenes anteriores (sus `pantone_front`/`pantone_back` quedan en `'{}'`). Captura retroactiva es manual.
- Sin Uncoated/Pastels/Neons todavía (todos los códigos están marcados `Coated` por el dataset usado). Si se necesita: agregar via Supabase Studio o un INSERT separado.
- Precisión del preview: depende de calibración de monitor + papel + tinta. Es referencia aproximada — el código texto en la orden impresa es lo definitivo.


## v10.24.1 — Hotfix: 5 bugs funcionales detectados en scan — 16-may-2026

Scan de bugs funcionales (subagent Explore + verificación crítica). 5 hallazgos reales corregidos en 1 commit.

### Fixes

**A. `compressImg` null-check de `file.type`** ([App.jsx:579](src/App.jsx#L579))
- Antes: `if (!/^image\/.../.test(file.type))` — explota si `file.type` es null/undefined.
- Después: `if (!file.type || !/^image\/.../.test(file.type))`. Si MIME está vacío, retorna el archivo sin procesar (skip seguro).

**B. `compressImg` null-check de `file.name`** ([App.jsx:594](src/App.jsx#L594))
- Antes: `file.name.replace(/\.[^.]+$/, ".jpg")` — explota si `file.name` es vacío.
- Después: `(file.name || "image").replace(...)`. Fallback a `"image.jpg"`.

**C. `return_to_ready` validar `e.started` antes de calcular minutes** ([App.jsx:5808-5814](src/App.jsx#L5808-L5814))
- Antes: `new Date(e.started)` sin validar — si `e.started` es null/inválido, `(now - s) / 60000 = NaN`. machine_log local quedaba con `minutes: NaN`.
- Después: chequear `e.started` y `!isNaN(s.getTime())` antes de calcular; fallback a `minutes: 0`.

**D. `return_to_ready` usar `canExecuteAction` (hardstop central)** ([App.jsx:5786](src/App.jsx#L5786))
- Antes: check manual `if(user!=="admin"&&user!=="produccion")`.
- Después: usa el gate central `canExecuteAction("return_to_ready", o, user, userLogin)`. Consistente con `advance`, `validate_prod`, `send_maquila`, etc.
- Agregado a `ACTION_ROLES`: `return_to_ready: { allowed:["admin","produccion"], ownerBound:[] }`.

**E. `DualScroll` guard `ResizeObserver`** ([App.jsx:557](src/App.jsx#L557))
- Antes: `new ResizeObserver(m)` sin feature check — navegadores muy viejos (IE11, Safari <13.1) lanzaban ReferenceError.
- Después: `if (typeof ResizeObserver === "undefined") return;` antes de instanciar. En navegadores legacy, DualScroll funciona con scrollbar inferior solamente (sin barra superior dinámica). Sin breaking change.

### Falsos positivos descartados del scan

- Cleanup `image_url`/`image_url_2` "sin manejo de errores parciales" — el `try{...}catch{}` general SÍ protege atomicidad. Si un remove falla, el UPDATE no ocurre — orden queda intacta.
- `parseDate` "no matchea ISO full timestamps" — es comportamiento esperado. ISO completos con `T` se pasan directo a `new Date()` que ya los interpreta correctamente.
- `setAuthChecked` "puede no ejecutarse" — verificados los 5 paths; todos lo invocan.
- Validación de schema en RPCs (paranoia útil pero no urgente — los RPCs están versionados en SQL).
- `doAdv` notifs "no transaccionales" — design choice intencional.

### Sin cambios

- DB schema (cero migración)
- Backend / RPCs
- UI: ningún cambio visible para el usuario


## v10.24.0 — Silencio de notificaciones fin de semana — 16-may-2026

Solicitado por Marcelo: el equipo necesita desconexión real los fines de semana sin notificaciones que interrumpan. Las notificaciones del sistema se descartan automáticamente durante la ventana **viernes 20:00 → lunes 09:00 hora México** (61 horas continuas). Aplica a todos los canales y orígenes.

### Migración aplicada (vía Supabase MCP)

- Nombre registrado: `silent_window_notifications_v10_24`
- Aplicada: 2026-05-16 17:48:43 UTC (11:48 hora MX)
- Sin cambios en App.jsx, Vercel, n8n, o DB schema

### Funciones creadas (schema public)

- **`is_business_hours()`** — BOOLEAN STABLE — devuelve TRUE si `NOW()` está en horario laboral hora MX (`America/Mexico_City`, UTC-6 sin DST desde oct-2022). FALSE durante ventana de silencio.
- **`is_business_hours_at(timestamptz)`** — BOOLEAN STABLE — versión testeable con timestamp arbitrario, idéntica lógica.
- **`skip_silent_window_notifications()`** — RETURNS TRIGGER — devuelve NULL durante ventana de silencio (cancela INSERT silenciosamente, sin error).

### Trigger creado

- **`trg_skip_silent_window`** BEFORE INSERT ON `public.notifications` FOR EACH ROW — aplica el filtro antes de cualquier otro trigger.

### Cobertura

El trigger BEFORE INSERT cubre **TODOS** los orígenes que insertan en `public.notifications`:

- ✅ Frontend (`db.notifySecs`, `db.notify`, etc. desde Lupita/Gerardo/etc.)
- ✅ Webhook Wix (pedidos web sábado/domingo)
- ✅ Cron jobs (`stale_alert` que corre cada hora)
- ✅ Triggers backend (bridges PrintFlow→CobranzaFlow)
- ✅ Cualquier canal futuro (SMS, email, push) que beba de la misma tabla
- ✅ Como el AFTER `trg_telegram_notify` solo corre si el INSERT realmente sucede, también queda silenciado automáticamente

### Lógica de ventana de silencio (61h)

| Día/Hora MX | Estado |
|---|---|
| Lunes 00:00 → 08:59:59 | 🔇 Silencio |
| Lunes 09:00 → Viernes 19:59:59 | 🔔 Horario laboral (notifs normales) |
| Viernes 20:00 → Domingo 23:59:59 | 🔇 Silencio |

### Decisiones de diseño

| ID | Decisión | Rationale |
|---|---|---|
| D-1 | Silenciar TODOS los canales (Telegram + in-app + email futuro) | Pedido explícito: "Telegram + in-app + email" |
| D-2 | Descartar (no acumular ni reportar el lunes) | "Silenciar y descartar (nunca se entera)" |
| D-3 | Filtro BEFORE INSERT en `notifications` | Una sola fuente de verdad, cubre todos los orígenes |
| D-4 | Sin override por usuario individual | KISS — si alguien quiere recibir en fin, se discute caso a caso después |
| D-5 | Sin log de notifs descartadas | Cero auditoría innecesaria; el "qué pasó" se reconstruye desde `orders`/`order_comments` |
| D-6 | Solo `public.notifications` (no `cobranza.notifications`) | CobranzaFlow tiene su propia tabla; si después se quiere extender, se replica el trigger |
| D-7 | Zona horaria `America/Mexico_City` (no UTC, no offset hardcoded) | Postgres mantiene zoneinfo IANA actualizada; refleja correctamente que MX no tiene DST desde oct-2022 |

### Smoke tests pasados

- ✅ 8/8 tests determinísticos con `is_business_hours_at(timestamptz)`:
  - Lunes 14:00 MX → laboral ✓
  - Lunes 08:59 MX → silencio ✓
  - Lunes 09:00 MX → abre ✓
  - Viernes 19:59 MX → laboral ✓
  - Viernes 20:00 MX → cierra ✓
  - Sábado 12:00 MX → silencio ✓
  - Domingo 12:00 MX → silencio ✓
  - Miércoles 10:00 MX → laboral ✓
- ✅ Smoke test en vivo: INSERT durante sábado 11:49 hora MX fue descartado silenciosamente, cero notif Telegram, cero error UI, cero registro en `notifications`.

### Reversión / control

Para deshabilitar temporalmente (ej. semana de emergencia con producción de fin):

```sql
ALTER TABLE public.notifications DISABLE TRIGGER trg_skip_silent_window;
-- ... después ...
ALTER TABLE public.notifications ENABLE TRIGGER trg_skip_silent_window;
```

Para eliminar permanentemente:

```sql
DROP TRIGGER IF EXISTS trg_skip_silent_window ON public.notifications;
DROP FUNCTION IF EXISTS public.skip_silent_window_notifications();
DROP FUNCTION IF EXISTS public.is_business_hours_at(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.is_business_hours();
```

### Sin cambios

- App.jsx (cero cambios en frontend)
- Vercel (cero redeploy)
- DB schema base (cero ALTER TABLE)
- Workflow n8n PrintFlow Telegram Notifier
- Bridge PrintFlow→CobranzaFlow
- Memoria operativa del equipo (siguen viendo sus pendientes el lunes)


## v10.24.0.5 — Limpieza de botones bajo DragCard en Kanban de máquinas — 16-may-2026

> **Nota:** Originalmente esta versión iba a ser v10.24.0, pero v10.24.0 se asignó retroactivamente al **Silencio de notificaciones fin de semana** (migración SQL aplicada el mismo día, 16-may-2026 a las 11:48 hora MX, que no había sido documentada en CHANGELOG al momento del commit de esta versión). Renumerada como sub-patch v10.24.0.5 para preservar orden cronológico y reflejar que es un cambio menor de UX vs. el cambio de infraestructura del silencio. El contenido del entry es idéntico al original; solo cambió la numeración.

Reportado por Marcelo: los botones bajo el DragCard del Kanban de máquinas estaban saturados. Simplificación de la barra de acciones.

### Cambios en el Kanban (bloque de máquinas)

**Antes** (4 botones): 📦 Empaque · 🚚 (Enviar a Maquila) · 🗑️ (Merma) · ↩️ (Volver a Diseño)
**Después** (2 botones): 📦 Empaque · 🔄 (Volver a Lista, solo admin/producción)

- ✅ Mantiene el flujo principal de avance (Empaque)
- ➕ El nuevo botón 🔄 saca la orden de la máquina y la regresa a `ready` (introducido en v10.23.0; movido aquí desde el OCard general donde se quitó)
- ➖ Quitados: send_maquila, waste, devolver_design — siguen disponibles desde el OCard general (Pendientes/Todas/Archivo) cuando la orden necesita esas acciones, pero ya no contaminan el tablero

### Donde NO se tocó

- **Bloque Empaque del Kanban** (sticky derecha): mantiene 📤 + 🚚 + 🗑️ intacto. Empaque es etapa final donde sigue teniendo sentido enviar a maquila o registrar merma.
- **OCard general** (Pendientes, Todas, Archivo): mantiene Empaque + Enviar a Maquila + Devolver a Diseño para `in_production`. Solo el botón 🔄 Volver a Lista se quitó de ahí (vivía a destiempo, ahora vive en el Kanban donde tiene sentido visual).
- Action handlers `send_maquila`, `waste`, `devolver_design` siguen registrados — solo se quitaron de la UI del Kanban.

### Sin cambios

- DB schema (cero migración)
- Backend / RPCs
- Notif logic (v10.19.0 sigue intacto)


## v10.23.0 — Fix timezone fecha + Botón "Volver a Lista" — 16-may-2026

### Bug fix — Fecha de entrega aparecía un día antes

Reportado por Lupita: la fecha en DetailModal y OCard se mostraba un día antes de la seleccionada. La ventana de Entregas (Calendar) mostraba bien.

**Causa raíz:** `fD()` y `fDT()` hacían `new Date("YYYY-MM-DD")` que JS interpreta como UTC midnight; en zona México (UTC−6) cae al día anterior. Calendar ya tenía el patrón `+"T12:00:00"` hardcoded.

**Fix:** los helpers `fD` y `fDT` ahora detectan strings ISO de fecha pelada (`YYYY-MM-DD`) y les agregan `T12:00:00` antes de parsear (mediodía local — nunca cruza día). Nuevo helper `parseDate()` con el mismo patrón usado en las 11 comparaciones `new Date(o.due_date)` del archivo (replaced via `replace_all`). Sin cambio de schema; el almacenamiento sigue siendo `"YYYY-MM-DD"`.

### Nueva funcionalidad — Botón "🔄 Volver a Lista"

Una orden en `in_production` con `current_machine` asignada antes no se podía revertir a `ready` desde UI (solo avanzar). Ahora admin y producción ven el botón en OCard, que:

- Pone `stage='ready'`, `current_machine=null` (UPDATE en `orders` solo con columnas reales).
- Cierra cualquier machine_log abierto vía `db.closeMachineLog(id)` — la columna `ended_at` y `minutes` se calculan en `order_machine_log`.
- Agrega entry al timeline vía `db.addTimeline()` (tabla `order_timeline`).
- Notifica al trío Lupita+Noemí+Gerardo + admin in-app (filtro 2B para admin sigue aplicando en Telegram).

Útil cuando se arrastra una orden a la máquina equivocada o cambian prioridades. Caso real que disparó esta versión: P-3505 quedó atorada por test de admin sin forma de revertir.

### Fix puntual P-3505 (aplicado vía MCP)

`P-3505` se quedó en `stage=in_production`, `current_machine=off_pm74`, con 1 machine_log abierto. SQL ejecutado en Supabase:

1. `UPDATE orders SET stage='ready', current_machine=NULL`
2. `UPDATE order_machine_log SET ended_at=NOW(), minutes=...` para los logs abiertos
3. `INSERT INTO order_timeline` con la corrección

Verificación: ahora `stage=ready`, sin máquina, 0 logs abiertos.

### Nota de implementación

El brief original sugería UPDATE en `orders` incluyendo `machine_log` y `timeline` como columnas jsonb. **Esto no funcionaría:** ambas son tablas separadas (`order_machine_log` y `order_timeline`) — el campo en `orders` que ve el cliente se calcula en `db.loadOrders` desde esas tablas. Se ajustó a usar los helpers existentes `db.closeMachineLog()` + `db.addTimeline()`.

### Sin cambios

- DB schema (cero migración)
- Workflow n8n
- Bridge CobranzaFlow
- Calendar (línea 877 ya estaba bien con `+"T12:00:00"`)


## v10.22.0 — Hasta 2 imágenes de referencia por orden — 15-may-2026

Reportado por Marcelo: el equipo necesita poder adjuntar 2 imágenes a una orden (frente y reverso de muestra, referencia + ejemplo de cliente, etc.). Antes solo se podía 1.

### Migración SQL aplicada (via MCP)

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS image_url_2 TEXT;
```

### Cambios en App.jsx

1. **`empty` state** — agregado `image_url_2: null`.
2. **`dbCols` whitelist** (saveOrder) — agregado `image_url_2`.
3. **`editableFields` whitelist** (update) — agregado `image_url_2`.
4. **Form UI** — bloque de imagen refactorizado a un `.map(["image_url","image_url_2"])` que genera 2 slots independientes con preview 48×48, botón ✕ para eliminar (borra el archivo de Storage también), y botón "📷 Subir 1ra/2da" o "📷 Cambiar". Cada slot usa `compressImg` y sube a Supabase Storage con path `{orderId}/img-{1|2}-{timestamp}.jpg`.
5. **OCard preview** — muestra la primera imagen disponible (`image_url || image_url_2 || image || file_url`). Si hay dos imágenes (`image_url && image_url_2`), aparece un badge `+1` en la esquina inferior derecha del thumbnail.
6. **DetailModal** — refactorizado a renderizar un array `[image_url, image_url_2, image, file_url]` filtrado. Si hay 2, muestra en grid `1fr 1fr` lado a lado. Si hay 1, fullwidth. Click en cualquiera abre tamaño natural.
7. **Auto-cleanup 30 días** — el cleanup automático ahora también limpia `image_url_2` (extiende el SELECT, condición de skip y bloque de borrado de Storage).

### Comportamiento

- Si el usuario sube solo 1 imagen, `image_url_2` queda null — comportamiento idéntico a v10.21.0.
- Subir/cambiar/eliminar cada imagen es independiente.
- Backward compat con `image` legacy (base64 UI-only): solo en el primer slot.


## v10.21.0 — Doble scrollbar horizontal (arriba + abajo) en tablas y dashboards — 15-may-2026

Reportado por Marcelo: muchas computadoras del equipo tienen mouse tradicional (sin trackpad), por lo que no pueden deslizar lateralmente. El scrollbar de abajo en tablas anchas es difícil de alcanzar.

### Solución

- Componente nuevo `DualScroll` que envuelve cualquier contenido y agrega **dos barras de scroll horizontales sincronizadas**: una arriba y otra abajo (la existente se preserva).
- Mover la barra de arriba mueve también la de abajo y viceversa — `ResizeObserver` detecta cambios de ancho del contenido para mantener el ancho del scrollbar superior sincronizado.
- Aplicado a las 4 zonas con scroll horizontal: tabla de costos de placas, dashboard de stages internas, dashboard de stages maquila, y tabs de Analytics.

### Detalles técnicos

- El div superior contiene un "fantasma" de `width = bottomRef.scrollWidth` que reproduce la barra del navegador.
- Un `syncRef` con `requestAnimationFrame` evita el loop infinito al sincronizar scrollLeft entre ambos divs.
- El prop `style` se aplica al div inferior (donde vive el contenido real) — preserva `display:flex`, `gap`, `paddingBottom`, etc.


## v10.20.1 — Hotfix: agregar Germán al nav del Tablero — 15-may-2026

Bug pre-existente desde el initial commit del repo (5-may-2026), reportado por Marcelo cuando a Germán le llegó una orden y no podía arrastrarla a CTP.

### Causa raíz

[App.jsx:5916](src/App.jsx#L5916) construía el array `navs` con `if(user==="produccion"||user==="admin"||user==="karla")navs.push({id:"board",...})`. **Germán nunca estuvo en esa condición**, así que el botón "Tablero" jamás aparecía en su nav. El render del Tablero Germán SÍ existía ([App.jsx:5990](src/App.jsx#L5990)) y otros lugares asumían que él lo usaba (hints en líneas 2604 y 5977), pero nadie podía llegar ahí.

Misterio sin resolver: cómo había operado Germán hasta ese día sin acceso al Tablero. Probable workaround manual con URL directa o vía admin.

### Fix

Cambio de 1 línea: agregar `||user==="german"` al condicional + ícono específico:

```js
if(user==="produccion"||user==="admin"||user==="karla"||user==="german")
  navs.push({id:"board",i:user==="german"?"💿":"🏭",l:user==="karla"?"Folios":"Tablero"});
```

Germán ahora ve `💿 Tablero` en su nav, accede a su `PreprensaBoard` con CTP y Procesadora.

### Sin cambios

- DB schema (cero migración)
- Permisos / canExecuteAction
- Otros roles


## v10.20.0 — Duplicar ampliado + Mover OC fuera de vista + Fix race condition de folios — 15-may-2026

> **Nota:** el brief original proponía esto como v10.12.0.6 pero esa numeración quedaba retroactiva (ya teníamos v10.13.0–v10.19.0). Renumerado a v10.20.0 al aplicarlo.
>
> **Aplicación parcial:** El brief proponía crear un componente `MoveToOCModal` nuevo + state `moveToOCModal` + callback `moveToOC` aparte. Pero **ya existía** `MoveOrderModal` (desde v10.11.0 Sub-fase A) con la misma función — incluso permite crear OC nueva al mover, feature que el brief no contemplaba. Se aplicó la opción parcial: solo extender el botón existente para que se vea fuera de la vista OC, y agregar notifs al trío en el callback `moveOrderToOC` existente. No se duplicaron componentes.

### Nuevas funcionalidades

1. **Duplicar disponible para más roles** — Lupita y vendedores (con ownership) pueden duplicar sus propias órdenes en cualquier stage activa (no solo entregadas). Admin sigue pudiendo duplicar cualquiera. Solo se bloquea en órdenes canceladas.

2. **Botón "Cambiar OC" visible fuera de vista OC** — antes solo aparecía dentro de la vista OC (`inOCView`); ahora cualquier OCard con `purchase_order_id` (y sin invoice/cancelled/delivered/cart_folio) muestra el botón ↔️. Reutiliza el `MoveOrderModal` existente que permite también crear OC nueva.

### Backend (Supabase, schema public)

- **Función nueva** `next_production_number()` con `pg_advisory_xact_lock` — garantiza folios P-XXXX únicos incluso bajo cargas concurrentes (aplicada vía MCP).
- **UNIQUE INDEX nuevo** `idx_orders_production_number_unique` en `orders(production_number) WHERE NOT NULL` — defensa final a nivel BD contra el bug de duplicados que ocurrió con P-3503 (aplicada vía MCP).
- **Función existente** `move_order_to_oc()` sigue siendo la backend del callback `moveOrderToOC` (no cambia).

### Frontend (App.jsx)

- **Botón Duplicar (línea ~2621)**: visibilidad ampliada a secretaria/vendedor con ownership.
- **`duplicate`**: ahora llama RPC `next_production_number()` (atómico) en vez de calcular `MAX+1` local. Toast incluye el folio asignado.
- **`create`**: igual, llama RPC antes de INSERT. El preview de OrderForm sigue siendo local (UX), pero el folio real lo asigna el backend.
- **`webApprove`**: igual, llama RPC al aprobar pedido web.
- **`moveOrderToOC`**: extendido con notifs al trío Lupita+Noemí+Gerardo (excepto al que movió) + creador externo + admin in-app. Usa `userDisplayName` de v10.19.0.
- **Botón "Cambiar OC" en OCard** (líneas ~2629 y ~2638): removido el guard `inOCView`, agregado `!o.cart_folio` para excluir órdenes web.

### Bug fixes

- **Race condition de folios P-XXXX**: la combinación de `pg_advisory_xact_lock` + RPC + UNIQUE INDEX elimina la posibilidad de generar duplicados como el P-3503 de hoy.

### Tipo nuevo de notificación

- `oc_change`: se dispara cuando una orden cambia de OC. Notifica al trío + admin (in-app) + creador fuera del trío. NO está en filtro 2B para admin (admin solo recibe new_order + stale_alert por Telegram).


## v10.19.0 — Notificaciones detalladas de edits y cambios de fecha — 15-may-2026

> **Nota:** el brief original proponía esto como v10.12.0.5 pero esa numeración quedaba retroactiva (ya teníamos v10.13.0–v10.18.0). Renumerado a v10.19.0 al aplicarlo.

- Cualquier edit a una orden notifica al trío Lupita+Noemí+Gerardo (excepto al editor) con detalle de qué campos cambiaron, valores antes y después.
- Cambio de fecha de entrega ahora también notifica a Noemí (antes solo Lupita+Gerardo).
- Si la orden fue creada por alguien fuera del trío (típicamente Genaro vendedor), también recibe la notificación.
- Karla sigue recibiendo notif cuando se edita una orden con invoice_folio (post-factura).
- Admin (Marcelo) sigue recibiendo in-app pero NO por Telegram (filtro 2B preserva `new_order` + `stale_alert` solamente).

### Helpers agregados (App.jsx)

- `TRACKED_EDIT_FIELDS` — diccionario de 25 campos editables con labels legibles
- `diffOrderFields(before, after)` — detecta cambios entre estados de la orden
- `fmtEditValue(field, v)` — formatea valores para mostrar (currency, fechas, archivos)
- `userDisplayName(username)` — mapea username a nombre legible (Lupita, Noemí, Gerardo, etc.)

### Funciones modificadas (App.jsx)

- `update` — reemplazado bloque de notificaciones
- `changeDate` — reemplazado bloque de notificaciones

### Cambios de comportamiento intencionales

- Edits que cambian SOLO campos NO trackeados (ej. solo `client_email`) ya no generan notif.
- Edits post-factura incluyen el detalle de cambios en el mismo mensaje (antes era genérico).

### Sin cambios

- Backend SQL (no requiere migración)
- Workflow n8n (no requiere cambios)
- DB schema (no requiere cambios)
- Filtro 2B Telegram para admin sigue intacto


## 🔔 Sistema de Notificaciones Telegram — 15-may-2026

**Despliegue inicial completo (todos los usuarios onboarded)**

> Entry retroactivo: el sistema entró a producción el 15-may-2026, antes de v10.19.0 (que ya referencia su filtro 2B). Se documenta aquí para que el CHANGELOG refleje la infraestructura sobre la que se construyeron v10.19.0, v10.20.0 y siguientes.

### Arquitectura

- Bot `@SygmaPrintFlowBot` (Telegram)
- Trigger SQL `trg_telegram_notify AFTER INSERT ON notifications` → `pg_net.http_post` → webhook n8n
- Workflow n8n `PrintFlow Telegram Notifier` (ID `6pT7T11jWSDgko62`, 5 nodos)
- Tabla `public.telegram_log` para auditoría de envíos
- Tabla `public.app_config` con secret de webhook + flag global `telegram_enabled_globally`
- Columnas nuevas en `public.users`: `telegram_chat_id text`, `telegram_enabled boolean DEFAULT true`
- Extensión `pg_net` habilitada

### Filtro 2B (admin)

Admin (Marcelo) recibe por Telegram SOLO los tipos `new_order` y `stale_alert`. El resto de notificaciones (`order_edit`, `date_change`, `oc_change`, etc.) le llegan in-app pero NO al celular — esto evita que el admin se sature con notifs que no requieren acción suya.

### Usuarios conectados (7/7)

| Empleado | Username | Rol |
|---|---|---|
| Marcelo | admin | admin |
| Lupita | secretaria | secretaria |
| Gerardo | gerardo | produccion |
| Noemí | noemi | preprensa |
| Germán | german | german |
| Karla | karla | karla |
| Genaro | genaro | vendedor |

Chat IDs almacenados en `users.telegram_chat_id` (no replicados aquí por privacidad).

### Notas operativas

- Latencia típica: queued → sent en < 5 segundos
- El bot debe recibir primer mensaje del empleado (`/start` o cualquier texto) antes de poder enviarle notifs — regla de Telegram
- Onboarding manual: empleados usan @userinfobot para obtener chat_id y se registran manualmente en `users.telegram_chat_id`
- Workflow de auto-reply (`fcEGo98UiCoqjw7p`) archivado — se prefirió onboarding manual

### Documentación complementaria

- `SISTEMA_TELEGRAM_NOTIFICACIONES.md` (Project Knowledge) — guía operativa y troubleshooting
- `ACTUALIZACIONES_DOC_15_mayo_2026.md` (Project Knowledge) — bitácora de la sesión de despliegue


## v10.18.0 — StorageTab mejorado (Top + Huérfanos + Breakdown) — 14-may-2026

Mejoras de visibilidad y limpieza al StorageTab (accesible para Pre-prensa, Germán y Admin). Cierre del tema storage que arrancó con v10.16.0.

### Nuevas funcionalidades

1. **📁/📷 Breakdown imágenes vs archivos** — Separa visualmente el uso por tipo: "Archivos Producción" (referenciados en `file_url`) vs "Imágenes Referencia" (referenciados en `image_url`). Útil para ver dónde está creciendo el storage.

2. **🏆 Top 5 archivos más grandes** — Ranking ordenado por tamaño. Muestra cliente, producto, edad, tamaño y permite borrar individualmente. Identifica de un vistazo "qué borrar primero". Los archivos huérfanos se marcan con icono 🧩 y badge.

3. **🧩 Detección + limpieza de archivos huérfanos** — Identifica archivos en Storage que ya no apuntan a ninguna orden (`file_url` ni `image_url` los referencia). Esto puede pasar por uploads abandonados, órdenes borradas, o bugs históricos. Botón "🗑️ Limpiar Todos" hace cleanup masivo en bulk. Cero riesgo: solo borra archivos SIN referencia en la DB.

### Detalles técnicos

- **Cálculo unificado:** el `useEffect` recolecta todos los archivos en una sola pasada y calcula simultáneamente: total bytes, breakdown, top 5, y huérfanos. Sin queries adicionales.
- **Refresh manual:** las acciones de limpieza usan `setRefreshKey(k=>k+1)` para re-disparar el `useEffect` sin esperar polling.
- **`orderByPath`:** se construye un map de `path → order` para enriquecer el Top con datos de cliente sin queries N+1.
- **Performance:** para Storage con miles de archivos, el `list("",{limit:1000})` puede no traer todo. Si el bucket crece a >1000 carpetas, paginar.
- **Top hardcoded a 5:** si en el futuro se quiere más, cambiar `.slice(0,5)` por un state.


## v10.17.0 — Persistencia de sesión (no más logout al refresh) — 14-may-2026

Resuelve un dolor reportado por Marcelo: al hacer F5 o cerrar/abrir el navegador, todos los usuarios debían volver a hacer login porque la sesión vivía solo en React state. CobranzaFlow no tiene este problema porque usa Supabase Auth con JWT en localStorage; PrintFlow tiene auth custom (consulta directa a tabla `users`) que se perdía al recargar.

### Decisión de diseño

Se eligió **persistencia en localStorage** sobre **migración a Supabase Auth**. Razones:
- Equipo interno de 7 personas en oficina física → riesgo de suplantación bajo
- Migrar a Supabase Auth tomaría 4-8h con riesgo de regresiones (todos los `created_by` usan username, no UUID)
- localStorage + re-verificación cubre el 100% del caso de uso reportado

### Implementación

1. **Al hacer login exitoso:** se guarda `{username, role, displayName}` en `localStorage.pf-session`
2. **Al montar la app:** `useEffect` con `[]` deps lee `pf-session`, re-verifica contra DB que el usuario sigue activo, y restaura `user`/`userName`/`userLogin` desde **datos de la DB** (no de localStorage)
3. **Al hacer "Salir":** se borra `pf-session` antes de limpiar el state de React
4. **Loading screen** mientras se verifica la sesión (evita flash del Login)

### Seguridad

- localStorage NO almacena password
- El role siempre viene de la DB en cada carga (un atacante que manipule localStorage no puede escalar privilegios)
- Si un usuario es desactivado (`active=false`), la próxima recarga lo expulsa al Login automáticamente
- Riesgo residual aceptado: acceso físico a una compu con sesión activa = acceso a esa sesión

### Notas técnicas

- Key de localStorage: `pf-session` (consistente con prefix `pf-` de PrintFlow)
- El `useEffect` de restauración tiene cleanup con flag `cancelled` para evitar setState después de unmount
- Si `localStorage` falla (modo incógnito agresivo, cookies bloqueadas), la app sigue funcionando — solo no persiste la sesión, que es el comportamiento actual
- No se introdujo expiración de sesión (intencional: el dolor es "no me hagas re-login innecesario")


## v10.16.0 — Auto-cleanup de imágenes + Compresión client-side (campo Imagen) — 14-may-2026

Cierre del tema storage. Dos mejoras complementarias que reducen el crecimiento del bucket sin afectar los archivos de producción que se imprimen.

### Mejoras

1. **Auto-cleanup extendido a `image_url`** — El cleanup automático que ya borraba `file_url` de órdenes entregadas/canceladas hace +30 días ahora también borra `image_url`. Mismo criterio, misma frecuencia (1 vez por sesión al cargar). Una query única extrae ambos campos en lugar de duplicar.

2. **Compresión client-side EXCLUSIVA del campo "📷 Imagen"** — Antes de subir a Storage, las imágenes >500KB o >1920px se redimensionan a max 1920px en la dimensión mayor y se re-encodean como JPEG quality 0.92. Reducción típica de 3-4 MB → 200-300 KB (10x). Beneficios:
   - Storage crece más lento
   - OCards cargan más rápido (los thumbnails son ~10x más livianos)
   - El equipo puede subir fotos del celular directamente sin pre-procesar
   - Límite del campo Imagen subido de **2MB → 10MB** (gracias a la compresión)

### ⚠️ Garantías de seguridad

- **`FileUpload` (componente del campo Archivo de Producción) NO se modifica en absoluto.** Los PDF/AI/PSD que van a imprenta siguen subiéndose bit a bit, sin tocar.
- La compresión solo se ejecuta dentro del handler del campo Imagen (`<input type="file">` inline en `OrderForm`).
- Si la compresión por algún motivo no reduce el tamaño, el archivo original se usa sin modificar.
- GIF, BMP y otros formatos pasan sin tocar.

### Detalles técnicos

- **Helper `compressImg(file, maxDim=1920, q=0.92)`** definido a nivel módulo, junto a la inyección de CSS placeholder.
- **Skip optimization:** si la imagen original ya es <500KB y <=1920px en ambas dimensiones, no se procesa. Se sube tal cual.
- **Aspect ratio preservado:** resize proporcional con `Math.min(maxDim/w, maxDim/h)`.
- **Output siempre JPEG** (incluso si el original era PNG). Para fotos de referencia visual esto es óptimo. Si en el futuro se necesita preservar PNG con transparencia, agregar lógica de detección de canal alpha.
- **Extensión de archivo en Storage:** ahora siempre `.jpg` (antes era la original). El `image_url` apunta correctamente al `.jpg` en Storage.


## v10.15.2 — Hotfix UX preview de imagen — 14-may-2026

Fix de UX reportado por Marcelo justo después de v10.15.1: las imágenes en DetailModal se recortaban con `objectFit:"cover"`. Cambio mínimo, sin SQL.

### Cambios

- `objectFit` cambiado de `cover` → `contain`: la imagen completa siempre visible, sin recortes
- `maxHeight` ampliado de 160px → 280px para dar más espacio a imágenes verticales
- Background `#f5f5f7` cuando hay letterbox (imagen no llena todo el espacio): se ve elegante en vez de espacio en blanco
- **Click en la imagen** → abre en pestaña nueva para ver tamaño original (útil para revisar detalles finos)
- Tooltip "Click para ver en tamaño original" en hover
- Cursor pointer en hover

### Lo que NO cambia

- Thumbnail de OCard (48×48) sigue con `cover` (intencional: en miniatura queremos representación rápida, no letterbox)
- Detección de imagen por extensión sigue igual
- Prioridad `image_url > image > file_url` sin cambios


## v10.15.1 — Storage 100GB + Preview retroactivo de imágenes en file_url — 14-may-2026

Dos fixes pequeños post-deploy de v10.15.0:

1. **Display de storage usa 100GB (Plan Pro)** — La barra de almacenamiento mostraba "1 GB" hardcoded (legacy del Free tier). Ahora muestra el límite real del Plan Pro de Supabase: 100GB. Display dinámico GB/MB según el tamaño usado y libre.

2. **Preview automático de imágenes en `file_url`** — El equipo tradicionalmente ha subido todas las imágenes (JPG/PNG) al campo "📁 Archivo de Producción" en vez del campo "📷 Imagen". Antes, esas imágenes solo aparecían como link de descarga. Ahora se renderizan automáticamente como preview en OCard (thumbnail 48×48) y DetailModal (max 160px de alto), **además** de mantener el link de descarga. Beneficia retroactivamente a las 4 órdenes existentes que ya tienen imagen en `file_url` (P-3501, P-3502, P-3503, P-3504), sin migración de datos.

### Detalles técnicos

- Detección por extensión: `/\.(jpe?g|png|gif|webp)$/i.test(file_name)`
- Prioridad de display: `image_url > image > file_url` (cuando file_url es imagen)
- No hay cambio de schema. Cero SQL. Cero migración.
- El campo "📷 Imagen" sigue funcionando como en v10.15.0 (sube a Storage, persiste en `image_url`). No deprecado.


## v10.15.0 — Placa CTP + Imagen en Storage + Realtime robusto + Placeholders UX — 14-may-2026

Cuatro fixes priorizados por Marcelo tras feedback de Gerardo y equipo: campo para indicar si la placa ya existe (auto-salta CTP), imagen de orden ahora persiste correctamente en DB, realtime ya no se queda colgado en pestañas inactivas, y placeholders del formulario son visualmente distintos de datos reales.

> **Nota:** el brief original proponía esto como v10.13.0 pero esa numeración ya estaba ocupada por el typeahead. Renumerado a v10.15.0 al aplicarlo.

### Nuevas funcionalidades (1)

1. **Campo Placa CTP en formulario** — 2 botones (🆕 Nueva CTP / ♻️ Ya existe) en el formulario de orden. Editable por Secretaría, Vendedor, Pre-prensa, Producción y Admin. Cuando se marca "Ya existe" y ambos roles validan, la orden **auto-salta a "Lista para Producción"** (omite Diseño + CTP), con notificación automática a Producción. Badge visible en OCard (♻️ Placa / 🆕 CTP) y en DetailModal con texto explicativo.

### Bugs corregidos (3)

1. 🔴 **Imagen no persistía en BD** — `saveOrder` whitelist no incluía `image` (intencional desde v10.2 porque era base64 UI-only). Imagen se veía durante la sesión pero desaparecía al recargar. **Fix:** Nueva columna `image_url`, upload directo a Supabase Storage (bucket `order-files`), borrado automático al quitar via "✕". OCard y DetailModal leen `image_url || image` (compatibilidad).

2. 🟡 **Realtime se desconectaba en pestañas inactivas** — Sin listener de `visibilitychange` ni `focus`, los navegadores throttle el WebSocket y la suscripción muere silenciosamente. Gerardo y otros usuarios reportaban tener que refrescar manualmente. **Fix:** `visibilitychange` + `focus` listeners disparan `reload()` + `loadNotifications()` al regresar al foreground.

3. 🟢 **Placeholders confundidos con datos reales** — Producción/Pre-prensa interpretaba "Ej: 4 tintas, CMYK" como si Secretaría hubiera escrito eso. **Fix:** CSS `::placeholder` con itálicas + gris claro (#c7c7cc), inyectado al `document.head` una sola vez. Prefijos cambiados de "Ej:" a "Ejemplo · " o "Ejemplo (escribe aquí) · " en 7 campos críticos (papel, gramaje, tintas frente/vuelta, cantidad, descripción, notas).

### Migración SQL requerida (ya aplicada en producción)

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS plate_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS image_url TEXT;
```

### Notas técnicas v10.15.0

- **`plate_status`** valores válidos: `'existing'` (auto-skip CTP) | `'new_ctp'` (flujo normal con indicador) | `NULL`/`""` (no definido, flujo normal).
- **Auto-skip CTP solo dispara al transicionar draft → next stage.** Si Noemí cambia `plate_status` después de que la orden ya está en `design`, no auto-avanza (intencional, evita sorpresas).
- **Imagen en Storage:** path es `{orderId||"new-img-"+timestamp}/img-{timestamp}.{ext}`. Mismo bucket `order-files`.
- **Limitación conocida (no bloqueante):** El auto-cleanup de 30 días borra `file_url` pero NO `image_url`. Las imágenes se acumulan en Storage. A revisar en versión futura si crece el bucket.
- **Limitación conocida (no bloqueante):** Si se reemplaza imagen directamente (sin tocar "✕"), la versión vieja queda huérfana en Storage. Solo el botón "✕" la borra.
- **Reload on focus:** sin polling adicional. Sigue confiando en realtime cuando hay conexión activa; los listeners solo cubren el gap al regresar al tab.
- **CSS placeholder:** inyectado vía `document.createElement("style")` con `id="pf-placeholder-style"` para evitar duplicados en HMR/re-renders.
- **`image:null` se mantiene en `empty` form state** por compatibilidad UI temporal; ya no se persiste a DB (whitelist no la incluye).


## v10.14.0 — Typeahead en OCs + Folio P-XXXX editable — 13/14-may-2026

Dos features que cierran el flujo de captura iniciado con v10.13.x: el typeahead ahora también funciona al crear Órdenes de Compra (no solo órdenes individuales), y el folio P-XXXX se vuelve editable para Lupita/Admin/Vendedor durante esta semana de prueba con hojas físicas.

### Nuevas funcionalidades (2)

1. **Typeahead + auto-fill en `CreateOCModal`** — Comportamiento idéntico al typeahead de órdenes (v10.13.0):
   - Al escribir 2+ caracteres en "Cliente", aparece dropdown con clientes de `cobranza.clients`
   - Al seleccionar, se prellena email/whatsapp/RFC del master
   - Si master no tiene contacto, fallback a última orden del cliente (v10.13.1)
   - Nuevos campos en el modal: 📧 Email, 📱 WhatsApp, RFC (todos opcionales)
   - Si Lupita edita el nombre manualmente después de seleccionar, se rompe el vínculo `client_id`

2. **Folio P-XXXX editable con validación** — Solo para roles `admin`, `lupita`, `vendedor`:
   - El campo deja de ser read-only, se vuelve `<input>` editable
   - Valor inicial = sugerencia automática (siguiente consecutivo)
   - Si el usuario teclea un folio distinto, aparece botón "💡 Sugerido: P-XXXX" para volver al consecutivo natural
   - Validación con debounce 400ms vía RPC `validate_production_number`
   - Estados visuales: ✓ OK (verde) | ⚠️ duplicado/formato inválido (rojo con nombre del cliente conflictivo)
   - Submit bloqueado con alert si folio inválido al guardar
   - **Karla, Producción, Preprensa, German siguen viendo el campo read-only** (solo admin/lupita/vendedor editan)

### Cambios SQL (3)

1. **`purchase_orders.client_id`** UUID NULL REFERENCES `cobranza.clients(id)` ON DELETE SET NULL + index `idx_purchase_orders_client_id`

2. **RPC `create_purchase_order` extendida** con 4 parámetros nuevos opcionales (retrocompatible): `p_client_id`, `p_client_email`, `p_client_phone`, `p_client_rfc`. Se dropeó la versión vieja para evitar ambigüedad de overload. Fix: status default cambiado de `'active'` (inválido) a `'open'` (válido en check constraint).

3. **RPC `validate_production_number(p_number text, p_exclude_order_id text)`** — STABLE SECURITY DEFINER. Valida formato regex `^P-[0-9]+$` y duplicados en `orders.production_number` (case-insensitive). Devuelve jsonb `{valid, reason, message, existing_order_id?, existing_client?}`.

### Bugs corregidos (1 — hotfix v10.13.2)

| # | Sev | Descripción |
|---|-----|-------------|
| 1 | 🔴 | **`ReferenceError: sb is not defined`** — En briefs de v10.13.0 y v10.13.1 usé `sb.rpc(...)` (nombre del cliente Supabase usado en CobranzaFlow), pero PrintFlow lo llama `supabase`. Resultado: typeahead crashaba silenciosamente en consola, no aparecía dropdown. **Fix:** Find&replace `sb.rpc(` → `supabase.rpc(` en 2 ocurrencias (componente ClientInput + handler selC). Hotfix v10.13.2 deployado independiente. |

### Decisiones de diseño

| ID | Decisión | Status |
|---|---|---|
| D-1 | Override de folio manual SOLO en P-XXXX, NUNCA en D-XXXX/R-XXXX | ✅ Karla intacta, folios fiscales 100% automáticos |
| D-2 | Permitir saltarse números de P-XXXX (sin obligar consecutividad) | ✅ Necesario para trasladar hojas físicas con folios desordenados |
| D-3 | Bloquear duplicados con mensaje claro (no warning, hard rejection) | ✅ Previene 2 órdenes con mismo P-XXXX |
| D-4 | Vendedores SÍ pueden editar P-XXXX | ⚠️ Esta semana de prueba; revisar si abusan |
| D-5 | Conservar sugerencia automática como default | ✅ Si Lupita no toca el campo, comportamiento idéntico al de antes |

### Smoke tests pasados

**Typeahead OC:**
- ✅ Login lupita → "+ Nueva OC" → "cerv" → dropdown muestra CERVECERIA MODELO
- ✅ Seleccionar → email luceropg@hotmail.com prellenado
- ✅ Crear OC sin error → guardada con `client_id` correcto

**Folio editable:**
- ✅ Lupita/admin/vendedor ven input editable con sugerencia
- ✅ Folio nuevo → ✓ OK + botón "Sugerido"
- ✅ Folio existente (P-3495 seed) → ⚠️ con nombre cliente conflictivo
- ✅ Folio malformado ("ABC") → rechazado
- ✅ Submit bloqueado con alert si inválido
- ✅ Karla/produccion → read-only (no editable)

---

## v10.13.2 — Hotfix: `sb` → `supabase` — 13-may-2026

Find&replace en App.jsx para corregir nombre del cliente Supabase. Sin cambios funcionales, sin cambios SQL, sin cambios UX. Restaura el funcionamiento del typeahead de v10.13.0 y el auto-fill de v10.13.1.

---

## v10.13.1 — Auto-fill de contacto desde última orden — 13-may-2026

Extensión del typeahead v10.13.0 con auto-fill híbrido: si el cliente master en `cobranza.clients` no tiene email/whatsapp, el sistema busca la última orden de ese cliente y prellena con esos datos. Los campos quedan editables (Genaro puede borrar/cambiar sin afectar nada externo).

### Cambios SQL (1)

- **RPC `get_last_contact_for_client(p_client_id uuid)`** — STABLE SECURITY DEFINER. Devuelve jsonb con `master_email`, `master_whatsapp`, `master_rfc`, `master_name` (del cliente master) + `last_email`, `last_phone`, `last_lada`, `last_company`, `last_rfc`, `last_order_id`, `last_order_date` (de la última orden con contacto). Query usa `LIMIT 1` con `ORDER BY created_at DESC` y filtro `WHERE client_email IS NOT NULL OR client_phone IS NOT NULL`.

### Cambios UI (1)

- **`selC` ahora es async** — Tras aplicar datos del master, si email o whatsapp están vacíos, llama RPC y rellena solo campos vacíos (no pisa lo que ya venía del master). Catch silencioso si la RPC falla (no bloquea creación de orden).

### Decisiones de diseño

| ID | Decisión | Status |
|---|---|---|
| D-1 | Opción C híbrida (master + última orden, no auto-actualizar master) | ✅ Implementada |
| D-2 | No actualizar master automáticamente desde captura de orden | ✅ Solo Dirección/CXC puede editar master desde CobranzaFlow |
| D-3 | Auto-fill solo llena campos vacíos (no pisa master) | ✅ Preserva intención del usuario |

---

## v10.13.0 — Client Typeahead vs cobranza.clients — 13-may-2026

Reemplazo del autocomplete viejo (que buscaba contra clientes anteriores derivados de `orders`) por typeahead real contra `cobranza.clients` (459 clientes catálogo AlphaERP). Al guardar la orden, resolución inteligente: auto-link si hay match exacto, modal de confirmación si hay matches similares, creación automática si no hay matches.

### Nuevas funcionalidades (3)

1. **Typeahead real-time** — Búsqueda con debounce 250ms contra `cobranza.clients`. Muestra dropdown con nombre + RFC + WhatsApp + días de crédito. Prioriza matches que empiezan con la query.

2. **Auto-link al guardar** — Si el usuario tecleó un nombre sin seleccionar del dropdown:
   - **Match exacto** → vincula silenciosamente con toast confirmatorio
   - **Matches similares (1-5)** → modal "¿Quisiste decir...?" con opciones + botón "Crear nuevo"
   - **Sin matches** → crea cliente nuevo automáticamente en `cobranza.clients`

3. **Modal de confirmación de cliente** — `ClientConfirmModal` con lista de candidatos similares + opción "Crear como nuevo cliente". Hack `window.__showClientConfirmModal` para permitir await async desde submit handler.

### Cambios SQL (5)

1. **`orders.client_id`** UUID NULL REFERENCES `cobranza.clients(id)` ON DELETE SET NULL + index `idx_orders_client_id`

2. **RPC `search_clients_typeahead(p_query text, p_limit int DEFAULT 10)`** — STABLE SECURITY DEFINER. Devuelve top-N clientes activos que matchean LIKE %query% (case-insensitive). Prioriza matches que empiezan con la query. Mínimo 2 caracteres para activarse.

3. **RPC `create_client_from_printflow(p_name, p_rfc, p_email, p_whatsapp, p_dias_credito)`** — SECURITY DEFINER. Devuelve UUID. Si el nombre ya existe (case-insensitive exacto), devuelve el UUID existente en lugar de crear duplicado. Log en `cobranza.audit_log`.

4. **RPC `resolve_client_for_order(p_name text)`** — STABLE SECURITY DEFINER. Devuelve jsonb `{exact_match: uuid|null, exact_name: text, similar_matches: [{id, name, rfc, dias_credito}]}`. Usado al submit para decidir flujo de resolución.

5. **Bridge actualizado** — `sync_invoice_from_orders` y `sync_invoice_from_oc` ahora priorizan `orders.client_id` sobre `cobranza.resolve_client(client_name)`. Si client_id NOT NULL, usa directo. Si NULL, fallback al comportamiento anterior (resolve por nombre).

### Decisiones de diseño

| ID | Decisión | Status |
|---|---|---|
| D-1 | Convivir client_id (FK) + snapshot text (client, client_company, etc.) | ✅ Integridad histórica fiscal preservada |
| D-2 | Permitir texto libre + auto-link/confirm al guardar (no obligar seleccionar) | ✅ Velocidad de captura + cero duplicados silenciosos |
| D-3 | Permitir crear cliente nuevo desde typeahead (no requerir aprobación) | ✅ Flujo real de imprenta: cliente nuevo de la calle es común |
| D-4 | Híbrido email/teléfono/RFC: master por defecto + editable por orden | ✅ Cada orden puede tener contacto distinto sin contaminar master |

### Importación masiva ejecutada hoy

**Catálogo AlphaERP (cata_cte_20260512):**
- 4676 filas parseadas → 467 clientes únicos
- 378 nuevos importados a `cobranza.clients` (8 duplicados detectados y descartados por matching difuso)
- 33 clientes existentes enriquecidos con RFC del catálogo
- **Total: 81 → 459 clientes** (175 con RFC, todos con alpha_code)

**Contactos (Clientes_Contactos_Cobranza):**
- 85 clientes con adeudo procesados
- 84 matcheados contra cobranza (1 era duplicado descartado)
- 50 emails poblados (de 76, 25 eran "(sin contacto)" → movidos a notas)
- 52 whatsapps poblados (de 57, formatos limpiados: múltiples teléfonos al campo + notas; nombres en lugar de teléfono a notas)
- 45 notas valiosas importadas ("YA SE PAGO", "YA NO DEBE", "CHECAR CON DULCE", "Tel alterno: X", "Contacto vía: Y")

### Bugs corregidos en versiones siguientes

Ver v10.13.2 (`sb` → `supabase`).


## v10.11.0 Sub-fase B — Folios fiscales a nivel OC

Karla ahora asigna folios D-XXXX/R-XXXX a **toda una OC de una vez** — agrupados (1 folio para N órdenes) o consecutivos (N folios para N órdenes) — y puede **pre-asignarlos anticipadamente** cuando un cliente paga adelanto o exige factura antes de entregar. La OC queda bloqueada para modificaciones mientras tenga folios pre-asignados.

### Nueva funcionalidad

**Botones en vista de detalle de OC** (admin + karla):
- **📄 Asignar folio** — inmediato. Marca las órdenes pendientes como entregadas con folio asignado. **Visibilidad condicional**: solo aparece si TODAS las pendientes están en stage `salidas` o `maq_received` (consistente con el flujo individual de `OCard`).
- **🔒 Pre-asignar folio** — anticipado. Reserva folios sin marcar entregada. Bloquea la OC para nuevos productos y movimientos (`folios_locked=true`). Visible en cualquier stage de las pendientes.

**Componente `AssignOCFolioModal`**:
- Resumen contextual: cliente, productos totales, ya facturados (inmutables), pendientes
- Toggle tipo: 📄 Factura (D-) / 📋 Remisión (R-)
- Toggle modo (default `shared`): un folio compartido para los N pendientes, o N folios consecutivos
- Input **"Folio inicial"** editable, pre-cargado vía `db.getNextFolioSuggestion()`. Label "capturado por Karla, verificado contra AlphaERP" para reforzar el flujo de validación. Warning amarillo (no bloqueante) si el valor es menor a la sugerencia DB
- Preview dinámico en vivo: muestra los folios que se asignarán ("Se asignará D-5780..." o "Se asignarán D-5780, D-5781, ..., D-5784")
- Si pre-asignar: textarea **Razón** obligatoria (ej. "Pago adelantado", "Reserva fiscal fin de mes")

**Badges visuales**:
- Card de OC en lista: `📄 D-5780` o `📋 R-1180` si tiene `shared_invoice_folio`; `🔒 Bloqueada` si `folios_locked=true`. Borde izquierdo cambia a `C.wn` cuando bloqueada
- Header del detalle de OC: mismos badges en mayor tamaño + contador "X facturado(s)" en el grid. Banner con razón del bloqueo si aplica
- **+ Agregar producto**: deshabilitado con tooltip cuando la OC está bloqueada
- **`MoveOrderModal`** (Sub-fase A) ya validaba `folios_locked` defensivamente desde su implementación original — sin cambios

**Pestaña Auditoría reclasificada**:
- Nueva stat card "Compartidos" junto a Total/Gaps/Duplicados/Rango
- Folios donde >1 órdenes comparten el mismo número pero pertenecen a una OC con `shared_invoice_folio === folio` se marcan como `📄 COMPARTIDO · N órdenes` (verde) en lugar de `DUPLICADO` (naranja)
- Nueva sección "📄 Folios compartidos" arriba de la lista principal: muestra OCs con `shared_invoice_folio`, cliente, conteo de órdenes y estado de bloqueo
- CSV export incluye "COMPARTIDO" como status nuevo
- Helper text actualizado para explicar la distinción duplicado vs compartido

### Cambios SQL

**Tabla `purchase_orders` — 5 columnas nuevas**:
- `shared_invoice_folio TEXT NULL` — folio del último batch compartido (T2: refleja batch, no universalidad)
- `folios_locked BOOLEAN NOT NULL DEFAULT false` — bloqueo post pre-asignación
- `folios_locked_at TIMESTAMPTZ NULL` — timestamp del bloqueo
- `folios_locked_by TEXT NULL` — quién bloqueó
- `folios_lock_reason TEXT NULL` — razón visible en UI

**RPC `assign_folio_to_oc(p_oc_id, p_invoice_type, p_mode, p_folio_start, p_pre_assigned, p_reason, p_actor)`** — atómica, `SECURITY DEFINER`, `GRANT EXECUTE ... TO authenticated`. Validaciones:
- Tipo (`factura`/`remision`), modo (`shared`/`consecutive`)
- OC no cancelada, no bloqueada, sin `shared_invoice_folio` previo
- Razón requerida si pre-asignar
- Productos pendientes existen (sin folio, no canceladas)
- Folio inicial > último usado (rechazo duro contra contador)

Lock con `FOR UPDATE` en la OC + `UPDATE invoice_counters ... RETURNING` para serializar contra concurrencia. Stage transitions a `delivered`/`maq_delivered` si NO es pre-asignado, mantiene stage si lo es.

### Decisiones aplicadas

| ID | Decisión | Implementación |
|---|---|---|
| **T1** | Modelo de folio compartido | Columna `shared_invoice_folio TEXT NULL` en `purchase_orders`. Las órdenes individuales mantienen `orders.invoice_folio` (retrocompatibilidad — 15+ puntos del código siguen funcionando sin cambios) |
| **T2** | Default del modo | `shared` (caso más común: 1 factura por OC) |
| **T3** | Folio quemado al cancelar | RPC no toca cancelación. La lógica existente de `cancelInvoicedOrder` aplica. Gap permanente queda visible en Auditoría con badges ⚡ ANTICIPADO + CANCELADA |
| **T4** | Folios compartidos en Auditoría | Reclasificación client-side: cruza `orders.invoice_folio` con `purchase_orders.shared_invoice_folio`. Sección dedicada agrupa OCs compartidas con conteo de órdenes |

### Mejora UX aplicada durante QA (commit `997ba71`)

- `📄 Asignar folio` solo visible si `pendingOrders.every(o => o.stage==='salidas' || o.stage==='maq_received')` — evita asignar a productos no listos para entrega
- `🔒 Pre-asignar folio` mantiene visibilidad amplia (Karla puede reservar en cualquier stage)
- Tooltips reescritos para describir consecuencias en lenguaje claro:
  - 📄: *"Asigna folio fiscal a los productos listos para entrega y los marca como entregados."*
  - 🔒: *"Reserva folios fiscales anticipadamente. La OC queda bloqueada para nuevos productos y movimientos. Útil para pagos adelantados o reserva de folios fiscales."*

### Tests validados durante QA (9)

| # | Caso | Status |
|---|---|---|
| 3 | Pre-asignar shared con razón "Pago adelantado" | ✅ |
| 4 | + Agregar producto deshabilitado en OC bloqueada | ✅ |
| 5 | OC bloqueada NO aparece como destino al mover (defensa Sub-fase A) | ✅ |
| 7 | OC sin pendientes oculta ambos botones | ✅ implícito |
| 8 | Razón vacía deshabilita Confirmar | ✅ visto en modal |
| 10 | Sección "Folios compartidos" en Auditoría | ✅ |
| 13 | OC con shared previo oculta botones | ✅ |

### Tests diferidos a QA operacional

- **1, 2, 9** — Asignación shared/consecutive inmediata con N productos (requiere data real con órdenes listas para entrega)
- **6** — OC con folios mixtos (parciales pre-existentes; espera caso de uso natural)
- **11** — Cancelar orden con folio pre-asignado por admin (flujo NC existente)
- **12** — Regresión: flujo individual de Karla en `salidas`/`maq_received` (no se tocó; confirmación visual rápida)

### Aprendizajes clave

- **Captura manual editable contra auto-asignación**: el flujo individual de Karla usa captura manual del folio (verifica contra AlphaERP). Para Sub-fase B se mantuvo ese patrón — el modal pre-llena con `getNextFolioSuggestion()` pero permite editar. La RPC valida server-side que el folio inicial sea mayor al último usado. Esto previene desincronización entre PrintFlow y AlphaERP cuando facturas se emiten desde otra estación.
- **Forward-compat ya pagada en Sub-fase A**: la columna `folios_locked` se chequeaba defensivamente desde Sub-fase A en `MoveOrderModal` con `po.folios_locked !== true`. Al crearse formalmente en Sub-fase B, el filtro de OCs candidatas para mover empezó a aplicar automáticamente — sin tocar Sub-fase A.
- **Reclasificación client-side > query SQL nueva**: la Auditoría es 100% JS sobre props (`orders` + `purchaseOrders`). No fue necesaria nueva función SQL ni vista materializada — la lógica "duplicado vs compartido" es derivable cruzando ambos arrays.
- **`shared_invoice_folio` refleja "último batch", no "universal"** (T2 documentado vía COMMENT en SQL): OCs con folios parciales pre-existentes ven la columna poblada con el folio del batch nuevo. La consistencia visual "este folio es compartido" se mantiene en la sección de Auditoría.

### Out of scope (futuros patches si surgen)

- Re-asignación de folio compartido ya emitido (hoy la RPC rechaza si `shared_invoice_folio IS NOT NULL`)
- Liberación manual de folios quemados (hoy quedan como gap permanente)
- Multi-selección para asignar a subset de pendientes (hoy: todas o ninguna)
- Badge "(compartido)" en OCards fuera de vista de OC (P5 — diferido por simplicidad)

### Stats App.jsx

- 9 ediciones top-down
- **+266/-21 líneas** netas (`+260/-19` Sub-fase B principal + `+6/-2` UX adjustment)
- 1 componente nuevo (`AssignOCFolioModal`, ~120 líneas, mismo patrón visual que `CreateOCModal`/`MoveOrderModal`)
- 1 helper db nuevo (`db.assignFolioToOC`)

### Commits

- `ab96c74` — feat(v10.11.0-B): AssignOCFolioModal + 9 ediciones (commit "yes" desde VS Code)
- `997ba71` — v10.11.0 Sub-fase B (UX): visibilidad condicional + tooltips diferenciados

---

## v10.11.0.1 — Karla puede mover órdenes entre OCs

Patch sobre Sub-fase A. Karla (rol Facturación) ahora ve el botón ↔️ Mover sin recibir ❌ Cancelar — útil para reagrupar órdenes pre-facturación sin depender de Lupita.

- Permiso `↔️` extendido a `karla` en ambos contenedores de `OCard` (dentro y fuera de `canAct`)
- Sin `secOwns`/`vOwns`: ownership operativo no aplica a Facturación
- Sin SQL — la RPC `move_order_to_oc` ya valida `invoice_folio` server-side como respaldo
- 5 cambios in-line en App.jsx (0 líneas netas, +5/-5); 7 tests E2E validados (Test 2: OC-1006 con 3 productos, total $5,729.99 recalculado por trigger)

---

## v10.11.0 — Sub-fase A: Mover órdenes entre OCs (1-a-1)

Primera capacidad de flexibilidad sobre el modelo de Órdenes de Compra introducido en v10.10.0. Las OCs ahora son contenedores reorganizables: una orden puede moverse de una OC a otra sin cancelarla ni recrearla, con limpieza automática de la OC origen si quedó vacía.

**Caso de uso típico:** Pepsi pide 4 productos en una OC. A medio camino dice "el último era para Coca". Lupita reasigna ese producto sin interrumpir el flujo de producción.

### Nueva funcionalidad

**Botón ↔️ Mover en cada OCard dentro de la vista de OC** — Visible para admin, Lupita y Vendedor (con `secOwns`). Solo aparece cuando la `OCard` se renderea dentro de `OrdenesCompraView` (prop `inOCView={true}`). En otras vistas (Pipeline, Pendientes, Todas, Archivo, Dashboard) el botón está oculto por diseño.

**Componente `MoveOrderModal`** — Modal con 2 modos mutuamente excluyentes:
- **📁 OC existente** — Input de búsqueda libre + lista filtrable de cards de OCs candidatas. Filtra automáticamente OCs simples, canceladas, con `folios_locked=true` (forward-compat Sub-fase B), y la OC origen.
- **➕ Crear OC nueva** — Form inline con `client/vendedor/delivery_date/notes`. Pre-rellena vendedor + fecha de la orden origen. **Cliente vacío por diseño** (decisión consciente: caso de uso de Sub-fase A es cambio de cliente, pre-fill heredaría errores).

**Flujo "Crear OC y mover"** — Acción de un solo clic: crea la OC vía RPC atómico + mueve la orden ahí + muestra toast `🛒 OC-XXXX creada · ↔️ orden movida`. Sin pasos manuales intermedios.

### Cambios SQL (1 RPC nueva)

**`move_order_to_oc(p_order_id TEXT, p_target_oc_id TEXT, p_actor TEXT)`** — RPC atómica `SECURITY DEFINER` que:
1. Valida que la orden no tenga `invoice_folio` (folios fiscales son inmutables — moverlos rompería trazabilidad CFDI)
2. Valida que la orden no esté en stage `cancelled` o `maq_cancelled`
3. Valida que la OC destino exista, no sea simple (decisión A2), no esté cancelada, y no esté `folios_locked=true`
4. Bloquea no-op (origen === destino)
5. Hace UPDATE de `orders.purchase_order_id`
6. Después del UPDATE: cuenta órdenes activas en la OC origen. Si quedan 0:
   - **OC simple** → `DELETE` de `purchase_orders` (decisión A1, son invisibles al usuario)
   - **OC compleja** → `UPDATE status='cancelled'` con razón `'OC vacía tras movimiento de productos'`, registra `cancelled_at` y `cancelled_by=p_actor` (decisión A1, deja rastro auditable)

El trigger `recalculate_oc_total` (existente desde v10.10.0) se dispara automáticamente y recalcula los totales de AMBAS OCs sin código adicional.

### Decisiones de diseño aplicadas

| ID | Decisión | Rationale |
|---|---|---|
| **D4** | "Quitar de OC" = cancelar (botón ❌ existente). Para mover sin cancelar = nuevo botón ↔️ | Evita confusión semántica entre "ya no quiero esto" y "esto va en otro lado" |
| **D5** | UX 1-a-1 (botón por orden, sin checkboxes) | Mobile-friendly, simple. Multi-selección difería a v10.11.1 si data real lo justifica |
| **A1** | OC origen vacía: DELETE si simple, CANCEL si compleja (híbrida) | Las simples son invisibles al usuario, no tiene sentido conservar huérfanos. Las complejas dejan rastro auditable |
| **A2** | NO permitir mover hacia OC simple existente | Preserva invariante "OC simple = 1 sola orden, oculta al usuario" |

### Bugs detectados y resueltos durante QA

| # | Sev | Descripción |
|---|-----|-------------|
| 1 | 🟡 | **`inOCView` no se propagaba en `OrdenesCompraView`** — Diagnóstico: Lupita reportó que NO veía el botón ↔️ pero SÍ los demás botones. Grep mostró que la prop estaba en su lugar (línea 3429). Resolución durante validación con Lupita: hard-refresh + verificación de versión deployada (estaba viendo Vercel pre-deploy). El código estaba correcto, era cache de browser. |
| 2 | 🟡 | **Helper `db.moveOrderToOC` llamaba RPC sin `p_actor`** — Test 1 falló con error de PostgreSQL: `Could not find the function public.move_order_to_oc(p_order_id, p_target_oc_id) in the schema cache`. La función SQL requiere 3 parámetros pero el helper JS solo enviaba 2. **Fix:** agregado 3er parámetro `actor` al helper, propagado `userLogin\|\|user` desde ambos handlers (`moveOrderToOC` y `createOCAndMove`). |

### Notas técnicas v10.11.0 Sub-fase A

- **11 ediciones a App.jsx** (4775 → 4934 líneas, +159 netas, +164/-5)
- **Componente `MoveOrderModal`** insertado antes de `OCard` para cohesión visual
- **Prop `inOCView`** agregada a la signature de `OCard` — defaulting a falsy en todos los renders excepto el de `OrdenesCompraView` (línea 3429)
- **Botón `↔️` en 2 ubicaciones** dentro de `OCard`: dentro de `canAct` (admin con todas las stages, sec/vendedor con stages aplicables) y fuera de `canAct` (sec/vendedor para stages donde no son actor pero sí dueños). Mismo gating de propiedad y validaciones que el botón `❌` cancelar.
- **Forward-compat con Sub-fase B**: el filtro de OCs candidatas chequea `po.folios_locked !== true`. Si la columna no existe en DB, `select *` la retorna como `undefined`, el filtro no la rechaza. Cuando Sub-fase B agregue la columna, el filtro empieza a aplicar automáticamente.
- **Realtime ya configurado** desde v10.10.0 para `purchase_orders` — la limpieza de OC origen vacía y el recálculo de totales se propagan a otras sesiones automáticamente.
- **Defensa en profundidad**: el case `move_to_oc` en `handleAction` revalida `invoice_folio`, `cancelled/delivered`, y `purchase_order_id` antes de abrir el modal. Tanto el botón como el handler verifican condiciones — cinturón + tirantes.

### Validación con tests E2E

Lupita ejecutó 12 tests del brief. Resultados:
- **Pasados manualmente (8)**: 1 (mover entre 2 OCs complejas), 5 (limpieza OC compleja vacía → cancelled con razón), 6 (limpieza OC simple → DELETE silencioso), 7 (OC simple no aparece como destino), 8 (OC cancelada no aparece como destino), 9 (crear OC nueva + mover en flujo continuo), 10 (edge case origen=destino bloqueado por RPC), 12 (Sub-fase C: ❌ Cancelar coexiste con ↔️)
- **Saltados (2)**: 2 (sin orden web a mano para conservación de W-XXXX), 3 (validación visual en operación real diferida)
- **Implícitos por validación de RPC (2)**: 4, 11

### Próximo en horizonte

- **Sub-fase B (deferred)** — Folios compartidos OC + columna `folios_locked` (chequeo defensivo ya implementado en frontend). Decisiones diferidas: modelo de folio compartido, default del modo de asignación, qué pasa con folios pre-asignados al cancelar, cómo se ve folio compartido en Auditoría.
- **v10.11.1 (tentativa)** — Multi-selección para mover varios productos a la vez si Lupita lo pide tras 1-2 semanas de uso real con la versión 1-a-1.

### Commits

- `bb8c14c` — chore: agregar ROADMAP_v10.11.0_Flexibilidad_OCs.md
- `23d6418` — feat(v10.11.0-A): MoveOrderModal + handlers + botón ↔️ en OCard (164 inserciones)
- `d7a60db` — fix(v10.11.0-A): agregar p_actor a llamadas de db.moveOrderToOC

---

## v10.10.0 — Órdenes de Compra (OC-XXXX) — Sesión A + B1 + B2 + Patches

Nueva entidad **Purchase Orders (OC-XXXX)** que agrupa varios productos del mismo cliente bajo un mismo folio comercial. Las "OCs simples" se autogeneran en background para mantener consistencia con el flujo actual; las "OCs complejas" se crean explícitamente cuando un cliente hace un pedido de múltiples productos (típicamente Pepsi, Coca, etc.).

Cinco entregas en una versión: Sesión A (DB + trigger), Sesión B1 (UI lectura), Sesión B2 (UI escritura), Patch P-XXXX + auto-total OC, Patch UX nav.

### Nuevas funcionalidades (3)

1. **Pestaña 📝 Órdenes de Compra** — Visible para Lupita, Karla, Marcelo y Vendedor. Posicionada justo después de "+ Nueva" para agrupar acciones de creación.
   - **Lista de OCs complejas** (las simples retroactivas están ocultas por diseño)
   - **Click en OC** → vista de detalle con info + productos linkeados
   - Status badges: 🟢 Abierta · 🔄 En proceso · ✅ Completada · ❌ Cancelada
   - Card con cliente, vendedor, fecha entrega, total, conteo de productos

2. **Modal "Crear OC"** — Para casos complejos (cotizaciones de varios productos):
   - Campos: Cliente (req), Vendedor (dropdown AGENTS), Fecha entrega, Notas
   - Auto-genera OC-XXXX vía RPC atómico `create_purchase_order`
   - Auto-navega al detalle de la OC recién creada
   - **Sin campo "Total estimado"** — el total se calcula automáticamente cuando se agregan productos (ver auto-total)

3. **Botón "+ Agregar producto a esta OC"** — Dentro del detalle de cada OC:
   - Pre-llena el form normal de orden con cliente, email, phone, RFC, vendedor, fecha de entrega de la OC
   - El producto creado se vincula automáticamente a la OC (`purchase_order_id` setado)
   - Asigna P-XXXX automáticamente (igual que orden normal)
   - Tras crear, regresa a la vista de la OC (no a Pipeline)

### Cambios SQL (4)

1. **Tabla `purchase_orders`** (16 columnas + 3 índices + RLS allow_all):
   - `id` TEXT PK (formato `OC-XXXX`)
   - `client` TEXT NOT NULL
   - `client_email`, `client_phone`, `client_rfc` TEXT
   - `total` NUMERIC(12,2) — auto-calculado por trigger
   - `status` TEXT CHECK IN ('open','in_progress','completed','cancelled')
   - `created_at`, `created_by`, `vendedor`
   - `delivery_date`, `notes`
   - `is_simple_oc` BOOLEAN — true si fue auto-generada por trigger, false si fue creada explícitamente
   - `cancelled_at`, `cancelled_by`, `cancellation_reason`

2. **Columna `orders.purchase_order_id`** (TEXT, FK nullable hacia `purchase_orders.id`)

3. **Contador `oc`** en `invoice_counters` (`last_number=1003` después del cierre)

4. **Triggers (2)**:
   - **`ensure_purchase_order`** (BEFORE INSERT en orders, SECURITY DEFINER) — Si una orden se inserta SIN `purchase_order_id`, auto-genera una OC simple. Permite que la app actual (sin lógica de OC) siga funcionando sin cambios.
   - **`recalculate_oc_total`** (AFTER INSERT/UPDATE/DELETE en orders, SECURITY DEFINER) — Recalcula `purchase_orders.total = SUM(COALESCE(price, maq_price, 0)) WHERE stage NOT IN ('cancelled','maq_cancelled')`. Maneja también el caso de cambio de OC (recalcula ambas).

### Funciones SQL (1)

- **`create_purchase_order`** — RPC atómico (SECURITY DEFINER) que incrementa el contador OC y crea la fila en `purchase_orders` en una sola transacción. Evita race conditions si dos usuarios crean OCs simultáneamente. Total inicia en 0 (se llena con el trigger conforme se agregan productos).

### Migración inicial

- 1 OC simple migrada (OC-1001 → OP-MOTC7UL8SIV) en Sesión A
- Phantom record `OP-SEED-P3434-DO-NOT-DELETE` excluido del migration por diseño (queda con `purchase_order_id=NULL`)
- Backup `orders_backup_v10_10_0` conservado 3-7 días post-deploy

### Bug corregido (1)

| # | Sev | Descripción |
|---|-----|-------------|
| 1 | 🟡 | **`useEffect` de P-XXXX no asignaba número en form prefill** — Cuando se hacía "Agregar producto a OC", el `editO` pre-llenado era truthy pero sin `id`. La condición `!editOrder` rechazaba la asignación de `nextPN`. **Fix:** Cambiar `!editOrder` → `!editOrder?.id` en 2 lugares (useEffect + reset post-submit). Distingue entre "editar orden existente" vs "crear orden nueva con prefill". |

### Mejoras UX (3)

1. **Rename de pestaña**: `🛒 Compras` → `📝 Órdenes de Compra` (más claro, evita ambigüedad con e-commerce)
2. **Reposición**: Pestaña movida desde el final del nav hasta justo después de "+ Nueva" (agrupa acciones de creación)
3. **Auto-total en modal**: Eliminado el campo "Total estimado" del modal de crear OC. El total se calcula 100% de los productos (single source of truth)

### Decisiones de diseño

| ID | Decisión | Status |
|---|---|---|
| D1 | OCs simples auto-crear + ocultar de UI | ✅ Implementado |
| D2 | Una OC puede mezclar internas + maquila | ✅ Implementado (sin restricciones) |
| D3 | Cancelar OC solo si todos los productos están en draft/cancelled | ⏳ Diferido a v10.10.1 (opcional) |

### Notas técnicas v10.10.0

- **Sesión A ejecutada en Supabase SQL Editor** (45 min). Aprendizaje crítico: Supabase SQL Editor NO mantiene transacciones BEGIN/COMMIT entre ventanas distintas (cada ventana abre conexión nueva del pool). Se usaron DO blocks atómicos sin BEGIN explícito.
- **Sub-brief B1 (lectura)** aplicó 7 ediciones a App.jsx (4571 → 4669 líneas, +98). Pre-validado con acorn ES2022 + JSX antes de Claude Code.
- **Sub-brief B2 (escritura)** aplicó 6 ediciones a App.jsx (4669 → 4779 líneas, +110). Agregó componente `CreateOCModal`. Total funciones: 49 → 50.
- **Patch P-XXXX + Auto-total** aplicó 4 ediciones a App.jsx (4779 → 4775, -4 por eliminación del campo Total) + trigger SQL.
- **Patch UX Nav** movió 1 push y eliminó otro (mismo total de líneas).
- **Total cambios v10.10.0**: ~+200 líneas netas, 0 archivos nuevos, 50 funciones, 1 tabla SQL nueva, 2 triggers nuevos, 1 RPC nuevo.
- **Cero downtime**: Trigger `ensure_purchase_order` permite que la app vieja (sin saber de OCs) siga funcionando mientras se rolean los cambios. Migración suave.
- **CobranzaFlow integration ready**: La columna `orders.purchase_order_id` y `purchase_orders` están preparadas para el bridge planeado con CobranzaFlow.
- **Realtime subscriptions**: `purchase_orders` agregada a la suscripción para sincronización entre sesiones.
- **RLS**: `allow_all` policy mirroreando `orders` (consistente con resto del sistema).
- **Sintaxis verificada** con `acorn` + `acorn-jsx` en cada sub-entrega antes de commit.

### Commits

- `13dde30` — feat(v10.10.0-b1): Vista Órdenes de Compra (read-only)
- `5c10aac` — feat(v10.10.0): Crear OC + agregar productos (UI escritura)
- `f9a6bbf` — fix(v10.10.0): P-XXXX en form prefill + auto-total OC via trigger
- `df50369` — style(v10.10.0): Renombrar pestaña Compras → Órdenes de Compra + reordenar
- `[hash CHANGELOG]` — docs(v10.10.0): CHANGELOG entry para v10.10.0

---

## v10.9.1 — Vista Auditoría + Gap Detection (Karla, Admin)

**Status:** ✅ Deployada en producción · Validada con test data SQL · 6 mayo 2026

### Nueva funcionalidad

**Pestaña 📑 Auditoría** — Visible solo para `admin` y `karla`. Muestra la salud completa de la secuencia de folios fiscales (D-XXXX facturas y R-XXXX remisiones), detectando gaps numéricos y duplicados de un vistazo. Read-only por diseño — la edición de folios sigue siendo en el detalle de orden.

**Componente `AuditoriaView`** — Renderiza:
- 4 stats cards: Total emitidos · Gaps detectados · Duplicados · Rango (oldest ↓ latest)
- 2 tabs internos mutuamente excluyentes: 📄 Facturas (D-XXXX) / 📋 Remisiones (R-XXXX)
- Filtro temporal: Últimos 90 días (default) / Este mes / Mes pasado / Todo el historial
- Listado en orden numérico con filas resaltadas para gaps (rojo ⚠️ FALTANTE) y duplicados (naranja DUPLICADO)
- Badges contextuales por orden: ⚡ ANTICIPADO (folios pre-asignados v10.9.0), CANCELADA, CANCELADA · NC
- Botón 📥 Exportar CSV con BOM UTF-8 para cross-check con AlphaERP
- Helper text al final con interpretación de gaps y duplicados

### Sin cambios SQL

Toda la data ya vive en columnas existentes: `orders.invoice_folio + invoice_type + invoiced_at + invoiced_by + invoice_pre_assigned + cancelled_at + nc_emitted`.

### Decisiones tomadas

| # | Decisión | Razón |
|---|----------|-------|
| 1 | Solo admin + Karla acceden | Datos fiscales sensibles; Lupita y vendedores no la necesitan |
| 2 | Read-only en v10.9.1 | Reducir superficie de bugs; corrección de typos sigue en detalle de orden |
| 3 | Sin integración AlphaERP (CSV manual) | AlphaERP no tiene API; CSV es vía suficiente para cross-check |
| 4 | Detecta gaps numéricos obvios solamente | La clasificación "intencional vs error" llega en v10.9.2 si data real lo justifica |
| 5 | Default 90 días | Ventana razonable para auditoría operativa sin saturar visualmente |

### Detalles técnicos

- **`AuditoriaView` aislado** — Componente standalone insertado entre `Analytics` y `ProductionPlanner` (líneas 3106-3226). No toca OCard, DetailModal ni ningún flujo existente.
- **`parseFolio` regex** — `/[DRC]-(\d+)/` extrae el número del folio. Soporta D (factura), R (remisión) y prefijo C reservado para extensibilidad futura.
- **Gap detection algorítmico** — Construye un `Map<number, orders[]>` por folio, encuentra min/max, itera del rango completo y marca como `gap` cualquier número sin órdenes asociadas. Marca como `duplicate` cualquier número con ≥2 órdenes.
- **Filtros temporales con `useMemo`** — Recalculan `cutoffs` solo cuando cambia `filter`; recalculan `folioOrders` cuando cambia `cutoffs` o `type`; recalculan secuencia y métricas cuando cambia `folioOrders`. Sin lag perceptible en lista de ~500 folios.
- **Convención de íconos consistente** — 📄 = factura, 📋 = remisión (alinea con líneas 794, 1104-1105, 1331, 1960, 2733); 📑 = pestaña Auditoría (alinea con sección "Info Fiscal" en línea 820).
- **Archive load gate** — La pestaña requiere archivo histórico cargado. Si `archiveLoaded === false` muestra un fallback con botón "📂 Cargar archivo histórico para auditoría". Una vez cargado, queda accesible para Analytics y Auditoría sin recarga.
- **CSV BOM UTF-8** — Prefijo `\uFEFF` para que Excel renderice acentos correctamente sin pasos manuales del usuario.
- **Sintaxis verificada** con esbuild (Vite parser, 4572 líneas, 0 errores). 47 → 48 funciones en el archivo (solo se agregó `AuditoriaView`).

### Bug encontrado y resuelto durante la sesión

**Mojibake en transferencia de brief.** Al pasar el brief de planning desde Claude.ai web a Claude Code, los emojis Unicode se reinterpretaron como Latin-1 y Claude Code los reconstruyó con caracteres incorrectos (🔍 en lugar de 📑 para tab; 🧾 en lugar de 📄 para factura; 📄 en lugar de 📋 para remisión). Detectado y corregido pre-commit con 3 reemplazos quirúrgicos antes de pushear. **Aprendizaje:** verificar emojis específicos contra convenciones existentes del archivo antes de aprobar commits que introducen UI nueva.

### Validación con test data

Insertados 5 órdenes TEST con folios fuera del rango productivo (D-9990 a D-9993, R-9990 a R-9991) incluyendo gap intencional en D-9992 y `invoice_pre_assigned=true` en D-9993. Todas las métricas se calcularon correctamente, los badges aparecieron donde correspondía, y el CSV se exportó con encoding correcto. Test data eliminado después con `DELETE FROM orders WHERE id LIKE 'TEST-AUDIT-%'`.

**Aprendizaje DB descubierto:** la columna `orders.order_type` tiene CHECK constraint que solo acepta `'interna'` o `'maquila'` (no `'internal'` que es el valor de la columna `source`). Documentado para evitar el error en futuros INSERTs de testing.

### Workflow

Primera versión completa (no patch menor) deployada con el workflow nuevo: planificación en Claude.ai web (Project Knowledge + memoria) → brief copy-paste → Claude Code en VS Code aplica edits → commit + push → Vercel auto-deploy. Tiempo total de la sesión: ~45 minutos para diseño + código + deploy + validación E2E + cleanup.

### Próximo en horizonte

- **v10.9.1 en operación real** durante 1-2 semanas antes de iterar — necesitamos data orgánica de Karla para entender qué tan frecuentes son los gaps reales
- **v10.9.2 (tentativa)** — Clasificación de gaps como "intencionales" (NC emitida en AlphaERP) vs "alertas" (captura omitida); edición inline si data real lo justifica
- **CobranzaFlow** — App separada que leerá `orders.invoice_folio` directamente (mismo Supabase project)

---

## v10.4.3 — Fix Órdenes Estancadas + Rediseño Tablero (3 bugs + 1 mejora UX)

### Mejora UX

1. **Tablero de Producción rediseñado — layout dos columnas con sidebar sticky** — Las zonas de Empaque, Salidas y Maquila estaban hasta abajo del tablero (después de Offset, Digital y las 11 máquinas de Acabados), haciendo muy difícil arrastrar órdenes desde "Listas" sin mucho scroll. **Rediseño:**
   - **Columna izquierda (~70%):** Máquinas (Offset, Digital, Acabados) como antes
   - **Columna derecha (260px, sticky):** Empaque, Salidas y Maquila apilados verticalmente, **siempre visibles** mientras se hace scroll por las máquinas
   - Las órdenes Listas se mantienen arriba a ancho completo
   - Cada zona del sidebar muestra badge con conteo, órdenes dentro (con timer y botones de acción), y reacciona visualmente al arrastrar sobre ella
   - El sidebar se adhiere al viewport (`position: sticky`) para que siempre esté accesible sin importar cuánto scroll haya en las máquinas

### Bugs corregidos (3)
| # | Sev | Descripción |
|---|-----|-------------|
| 1 | 🔴 | **`getStale` marcaba etapas de espera como estancadas** — `maquila_out` (proveedor externo, días/semanas), `proof_client` (esperando cliente), `maq_sent` y `maq_in_progress` (maquila propia en proceso) se marcaban falsamente como "estancadas" a las 24h. Esto causaba que órdenes legítimamente en espera aparecieran en el banner rojo. **Fix:** Nueva constante `WAIT_STAGES` que excluye estas 4 etapas de la detección de estancamiento |
| 2 | 🔴 | **Banner de estancadas sin botones de acción — órdenes "atrapadas"** — Las órdenes en el banner de estancadas en Pendientes se renderizaban como divs simples (solo nombre/tipo/etapa) sin ningún botón de acción. Gerardo no podía hacer "📥 Recibido de Maquila" ni mover órdenes. Parecían desaparecer del flujo normal. **Fix:** Reemplazados divs simples por `OCard` completas con todos sus botones de acción, drag, merma, etc. |
| 3 | 🟡 | **`staleTasks` usaba `viewOrders` en vez de `filteredOrders`** — Inconsistencia con filtro "Mis órdenes": stale tasks mostraba TODAS las órdenes sin respetar el filtro activo. Además los arrays de stages por rol incluían etapas de espera ya excluidas por `getStale`. **Fix:** Cambiado a `filteredOrders` + arrays de stages limpiados para consistencia |

### Notas técnicas v10.4.3
- **Sin migración SQL requerida** — Todos los cambios son solo frontend
- **`WAIT_STAGES`** — Nueva constante `["maquila_out","proof_client","maq_sent","maq_in_progress"]` usada por `getStale()`. Etapas donde la espera es legítima y esperada, no deben generar alertas de estancamiento
- **Banner estancadas → OCard** — El banner ahora usa `<OCard>` con props `noDragHint` y `busy={actionLoading===o.id}`, manteniendo el header visual del banner (conteo + título) pero con tarjetas funcionales completas
- **`staleTasks` deps** — Cambiado de `[viewOrders,user]` a `[filteredOrders,user]` para consistencia con `myTasks`
- **Efecto cascada en notificaciones** — Las notificaciones automáticas de estancamiento (admin session, cada 30min) también se benefician del fix #1 porque usan `getStale()` internamente
- **Kanban two-column layout** — `display:flex` con `gap:16`. Columna izquierda `flex:1 1 0%` contiene las categorías de máquinas. Columna derecha `width:260,flexShrink:0,position:sticky,top:16,alignSelf:flex-start` contiene Empaque/Salidas/Maquila como drop zones compactas. Las órdenes listas y el summary bar permanecen a ancho completo arriba del flex
- **Sidebar drop zones** — Cada zona reacciona al drag con borde más grueso y fondo coloreado (`dO===zoneid`). Empaque muestra DragCards con botones 📤/🚚/🗑️. Salidas muestra tarjetas compactas con fecha. Maquila solo muestra texto de drop
- **Sintaxis verificada** con `acorn` + `acorn-jsx` (2943 líneas, 0 errores)

---

## v10.4.2 — Cancelar Orden + Validación de Formulario + Folio Secuencial

### Nuevas funcionalidades (3)

1. **Cancelar Orden** — Nuevo flujo de cancelación permanente:
   - Nuevo stage `cancelled` (internas) y `maq_cancelled` (maquila) en `ALL_S`
   - `CancelOrderModal` con motivo obligatorio, info de la orden y confirmación
   - **Quién puede cancelar:** Secretaría y Vendedor (solo órdenes propias) + Admin (cualquier orden)
   - **Desde dónde:** Cualquier etapa excepto ya entregada o ya cancelada
   - Botón ❌ visible tanto dentro como fuera del bloque `canAct` (secretaría/vendedor pueden cancelar incluso en stages que no les pertenecen)
   - **Notificaciones:** Admin + Producción reciben notificación con motivo
   - **Timeline + Comentario:** Queda registro completo con motivo de cancelación
   - **Permanente:** No se puede revertir una cancelación
   - **Excluida de:** Dashboard (activas), Pipeline, Pendientes, Calendar (pendientes), Stale alerts, MaquilaTracker
   - **Incluida en:** Archive con badge rojo "❌ Cancelada", nombre tachado, sin contar en revenue. Sección Todas muestra la orden con badge cancelada

2. **Validación Inteligente del Formulario** — Ya no falla silenciosamente:
   - `missing` array calculado con `useMemo` detecta campos obligatorios faltantes en tiempo real
   - Al dar click en "Crear Orden": si faltan campos, aparece banner rojo "⚠️ Campos obligatorios faltantes: Cliente, Proveedor..."
   - Campos faltantes se resaltan con borde rojo
   - Botón se pone gris cuando hay campos faltantes y se intentó enviar
   - **Campos obligatorios:** Cliente, Tipo de Producto, Proveedor (solo maquila)
   - **NO obligatorios:** Archivo, Descripción del producto, Cantidad, Fecha, Precio (todos opcionales)

3. **Folio de Producción Secuencial** (de v10.4.1):
   - Muestra último folio usado y siguiente sugerido
   - Botón "→ Usar P-XXXX" auto-llena
   - Advertencia "⚠️ Ya existe" si el folio está duplicado
   - Rango P-0001 a P-5000, reinicia automáticamente

### Mejoras
- **"(USO INTERNO)"** agregado al label de Notas de Proceso / Aclaraciones en el formulario

### Notas técnicas v10.4.2
- **Sin migración SQL requerida** — `cancelled` y `maq_cancelled` son valores de texto en la columna `stage` existente, no requieren ALTER TABLE
- **`CancelOrderModal`** — Componente con `useEscClose`, muestra info de la orden, textarea con borde rojo si vacío, confirmación de acción permanente
- **`cancelOrder` useCallback** — Cierra machine logs abiertos, actualiza stage, agrega timeline + comentario, notifica admin + producción
- **Botón ❌ dual** — Dentro de `canAct` para admin (junto a otros botones), fuera de `canAct` para sec/vendedor (visible en cualquier stage propio)
- **`isFinal` helper** en `myTasks` — `s.includes("delivered")||s.includes("cancelled")` para excluir ambos
- **Archive `archiveDate`** — Órdenes canceladas usan `created_at` como fecha de archivo (no tienen `delivered_at`)
- **Archive revenue** — Excluye canceladas del cálculo de facturado (tanto en totales como en carpetas)
- **Form validation** — `tried` state + `missing` useMemo + `errBorder` helper. `tried` se resetea al crear exitosamente
- **`canSubmit`** — Boolean derivado de `missing.length===0`, no bloquea el botón hasta que el usuario intenta enviar
- **Sintaxis verificada** con `acorn` + `acorn-jsx` (2830 líneas, 0 errores)

---

## v10.4.1 — Revisión de Bugs + Aislamiento de Datos por Vendedor (10 bugs notificación + 11 aislamiento + 2 corrección regresión + 1 duplicado)

### Bugs corregidos — Ronda 1: Notificaciones y Deps (10)
| # | Sev | Descripción |
|---|-----|-------------|
| 1 | 🟡 | **`handleAction` — `userLogin` faltaba en deps** — Fix: agregado |
| 2 | 🟡 | **`changeDate` — `userLogin` faltaba en deps** — Fix: agregado |
| 3 | 🟡 | **`notifKey` ausente en deps de dos `useEffect`** — Fix: `notifKey` agregado a ambos arrays |
| 4 | 🟡 | **`delivered` no notificaba a secretaría ni vendedor creador** — Fix: notificación manual a ambos |
| 5 | 🟡 | **`maq_delivered` sin notificación** — Fix: `db.notifySecs()` |
| 6 | 🟡 | **Rechazo de prueba no notificaba a sec/vendedor** — Fix: notificación a ambos |
| 7 | 🟡 | **MaquilaTracker oculto para vendedor en Dashboard** — Fix: visible para todos |
| 8 | 🟢 | **`maquila_in → ready` no notificaba a producción** — Fix: notificación añadida |
| 9 | 🟢 | **Drop zone Salidas rechazaba `maquila_in`** — Fix: stage agregado |
| 10 | 🟢 | **Avances maquila sin notificación a admin** — Fix: `maq_sent/maq_in_progress/maq_received` notifican |

### Bugs corregidos — Ronda 2: Aislamiento de Datos por Vendedor (11)
| # | Sev | Descripción |
|---|-----|-------------|
| 11 | 🔴 | **Calendar: vendedor podía cambiar fecha de órdenes ajenas** — Click bloqueado con `canEditDate()` |
| 12 | 🔴 | **DetailModal: vendedor podía descargar archivos de órdenes ajenas** — Archivo oculto con `vOwns` |
| 13 | 🔴 | **DetailModal: vendedor veía contactos y precios de órdenes ajenas** — Datos ocultos con `vOwns` |
| 14 | 🟡 | **DetailModal: vendedor podía imprimir órdenes ajenas** — Botón oculto con `vOwns` |
| 15 | 🟡 | **OCard: vendedor veía empresa, teléfono y precio de órdenes ajenas** — Datos ocultos con `vOwns` |
| 16 | 🟡 | **OCard: vendedor podía agregar comentarios a órdenes ajenas** — CommentLog oculto con `vOwns` |
| 17 | 🟡 | **OCard: vendedor podía agregar notas rápidas a órdenes ajenas** — QuickNotes oculto con `vOwns` |
| 18 | 🟡 | **OCard: vendedor podía ver historial de cliente de órdenes ajenas** — Click bloqueado con `vOwns` |
| 19 | 🟡 | **ClientHistory: vendedor veía órdenes de otros creadores** — Filtro por propiedad solo para vendedor |
| 20 | 🟡 | **Archive: vendedor veía precios de órdenes ajenas** — Totales y precios filtrados con `owns()` |
| 21 | 🟡 | **CSV Export: vendedor exportaba datos de todas las órdenes** — Filtrado solo para vendedor |

### Bugs corregidos — Ronda 3: Corrección de regresión (2) + duplicado (1)
| # | Sev | Descripción |
|---|-----|-------------|
| 22 | 🔴 | **Regresión: Secretaría no podía ver datos de órdenes del vendedor** — En ronda 2 se usó `secOwns` (que bloquea secretaría+vendedor) para gates de datos. Secretaría dejó de ver precios/contactos/archivos de órdenes creadas por vendedor. **Fix:** Creada variable separada `vOwns` (`role!=="vendedor"`) que solo restringe al vendedor. `secOwns` se mantiene solo para gates de acciones |
| 23 | 🟡 | **MaquilaTracker exponía precios y contacto de órdenes ajenas al vendedor** — No recibía `userLogin`. Fix: prop agregado, precio gateado con `oOwns`, contacto de proveedor solo muestra de órdenes propias |
| 24 | 🟡 | **`proof_client` — Admin recibía notificación duplicada** — Al enviar prueba al cliente, `db.notify("preprensa")` copiaba a admin Y `db.notifySecs()` también copiaba a admin. Fix: preprensa notificado con `addNotification` directo (sin copia auto a admin), `notifySecs` se encarga de la copia admin |

### WeeklyReport filtrado para vendedor
- Las 4 métricas básicas solo cuentan órdenes propias del vendedor (filtro `role==="vendedor"`)
- Secretaría y Admin ven el reporte completo

### Notas técnicas v10.4.1
- **Sin migración SQL requerida** — Todos los cambios son solo frontend
- **Dos variables de propiedad, roles distintos:**
  - **`secOwns`** = `!isSec(role)||!o.created_by||o.created_by===userLogin` — Gate de **acciones**: bloquea AMBOS secretaría y vendedor en órdenes ajenas (botones, editar, aprobar, entregar). Admin y roles de piso siempre `true`
  - **`vOwns`** = `role!=="vendedor"||!o.created_by||o.created_by===userLogin` — Gate de **datos**: solo bloquea vendedor en órdenes ajenas (precios, contactos, archivos, notas). Secretaría siempre `true` (trusted). Usada en DetailModal, OCard, Calendar, Archive, MaquilaTracker
- **`owns()` helper en Archive** — Misma lógica que `vOwns` pero como función para `.filter()`
- **`canEditDate()` en Calendar** — Misma lógica que `vOwns`
- **`oOwns` en MaquilaTracker** — Variable per-order para gate de precio individual
- **Props `userLogin` agregados** a: Calendar, DetailModal, ClientHistory, WeeklyReport, Archive, MaquilaTracker (×3 renders)
- **`proof_client` sin duplicar admin** — `db.notify("preprensa")` reemplazado por `db.addNotification("preprensa")` porque `notifySecs` ya copia a admin. Patrón: cuando se usan `db.notify` + `db.notifySecs` en el mismo bloque, el `db.notify` debe ser `addNotification` directo
- **Sintaxis verificada** con `acorn` + `acorn-jsx` (2766 líneas, 0 errores)

---

## v10.4 — Rol Vendedor (6to usuario) + Mejoras de Impresión y Descripción

### Nueva funcionalidad principal

1. **Rol Vendedor (6to usuario)** — Nuevo rol para vendedores que operan de forma independiente:
   - **Permisos idénticos a Secretaría:** crear órdenes (internas y maquila), ver precios y contactos, confirmar entregas, aprobar/rechazar pruebas de color, editar maquila, exportar CSV
   - **Notificaciones completas:** recibe las mismas que Secretaría (validaciones, salidas, cambios de fecha, maquila, pruebas de color)
   - **Badge visual** en cada tarjeta de orden mostrando quién creó la orden: "Secretaría" (morado) o "Vendedor" (naranja). Visible en Dashboard, Pendientes y Todas
   - **Tablero de Salidas** visible para vendedor, puede confirmar entregas
   - **WeeklyReport** visible para vendedor en Dashboard
   - **Restricción de propiedad (Secretaría Y Vendedor):** Cada rol solo puede interactuar con las órdenes que **creó**: aprobar pruebas, marcar entregada, editar, avanzar maquila. Ve todas las órdenes en Dashboard/Todas/Calendario para consulta, pero NO tiene botones de acción en órdenes ajenas. Variable `secOwns` en `canAct` controla esto automáticamente
   - **`created_by` guarda username** — En vez del rol, se guarda el nombre de usuario real (ej: "genaro", "secretaria") para identificar al creador exacto
   - **Escalable:** para agregar más vendedores en el futuro, solo se necesita INSERT en tabla `users` con `role='vendedor'`
   - **Helper `isSec()`** — función global que identifica roles tipo-secretaría (`secretaria` o `vendedor`), centraliza la lógica para evitar duplicación
   - **`db.notifySecs()`** — método que notifica a todos los roles tipo-secretaría, evita auto-notificación y duplicados
   - **Login:** usuario `genaro`, contraseña `1` (cambiar en producción)

### Impresión Dual (de v10.3.1)

2. **Impresión en dos versiones** — PrintOrder genera dos formatos según el rol:
   - **Versión Completa** (Secretaría/Vendedor/Admin): incluye datos del cliente, precio, RFC, datos administrativos, datos de maquila
   - **Copia Producción** (Producción/Pre-prensa/Germán): solo nombre del cliente, sin precio/contactos. Badge rojo "COPIA PRODUCCIÓN"
   - Secretaría/Vendedor/Admin ven **dos botones** de impresión
   - Secciones de Impresión y Acabados se ocultan para órdenes maquila
   - Datos de maquila (proveedor, costo, precio) ahora aparecen en versión completa
   - Columna "Color" vacía eliminada de tabla Impresión

### Mejoras

- **Descripción del producto rediseñada** — Formulario: campo full-width con textarea más alto (90px) y placeholder descriptivo. Impresión: fila propia de ancho completo con tipografía 12px, line-height 1.6 y soporte multilínea
- **CSV incluye columna "CreadoPor"** — identifica si la orden fue creada por Secretaría, Vendedor o Admin

### Bugs corregidos (10)
| # | Sev | Descripción |
|---|-----|-------------|
| 1 | 🟡 | **PrintOrder modal sin ESC** — Fix: `useEscClose(onClose)` agregado |
| 2 | 🟡 | **`duplicate` copiaba `production_number`** — Fix: `production_number: null` en duplicado |
| 3 | 🟡 | **Revert: notificaciones sin try-catch** — Fix: envuelto en try-catch |
| 4 | 🟡 | **Revert: notificaciones falsas si doAdv falla** — Fix: try-catch abarca doAdv + notificaciones |
| 5 | 🟡 | **StorageTab popup sin ESC** — Fix: `useEffect` con keydown listener |
| 6 | 🟡 | **`update` useCallback faltaba `reload` en deps** — Fix: agregado |
| 7 | 🟢 | **`quick_note` no era optimistic** — Fix: `setOrders` primero, revert si falla |
| 8 | 🟢 | **`searchFilter` no incluía `client_phone`** — Fix: agregado al array |
| 9 | 🟢 | **`handleAction` deps incompletos** — Fix: `user` y `reload` agregados |
| 10 | 🟢 | **Archive `fmt(o.price||o.maq_price)` sin parseFloat** — Fix: `parseFloat()` agregado |

### Migración SQL requerida
```sql
-- 1. Update role constraint to allow 'vendedor'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('produccion', 'preprensa', 'german', 'secretaria', 'vendedor', 'admin'));

-- 2. Insert Genaro as vendedor
INSERT INTO users (username, password_hash, role, display_name, active)
VALUES ('genaro', '1', 'vendedor', 'Genaro', true);
```

### Notas técnicas v10.4
- **`isSec(role)`** — Helper global: `r==="secretaria"||r==="vendedor"`. Usado para capacidades generales (crear, ver precios, imprimir, CSV)
- **`db.notifySecs(orderId, type, msg, reason, byUser, createdBy)`** — Notifica a secretaria + al vendedor específico que creó la orden (por username). Skip sender, copia a admin
- **`created_by` guarda username** — `userLogin||user` en create/duplicate. Para vendedores guarda "genaro", no "vendedor". Roles estándar siguen guardando el rol
- **`notifKey`** — `user==="vendedor"?userLogin:user`. Vendedor carga/borra notificaciones por su username, otros roles por su rol
- **canAct en OCard** — `(st?.who==="secretaria"&&isSec(role))` permite vendedor actuar en stages de maquila/salidas
- **`secOwns` en canAct** — `!isSec(role)||o.created_by===userLogin`. Para roles isSec, TODOS los botones de acción (aprobar, avanzar, editar, entregar) solo aparecen si la orden es suya. Producción/Pre-prensa/Germán/Admin no se ven afectados
- **Propiedad unificada** — 6 puntos usan propiedad: canAct (master gate), myTasks, Salidas board, botón Entregada, secciones edit/maquila OCard, handleAction edit lock
- **Badge creador** — Detecta si `created_by` es "secretaria" (morado) o cualquier otro username no estándar = vendedor (naranja con nombre)
- **Sintaxis verificada** con `acorn` + `acorn-jsx` (2743 líneas, 0 errores)

---

## v10.3.1 — Impresión Dual + Revisión de Bugs (10 fixes, 1 feature)

### Nueva funcionalidad

1. **Impresión en dos versiones** — PrintOrder ahora genera dos formatos según el rol:
   - **Versión Completa** (Secretaría/Admin): incluye datos del cliente (empresa, teléfono, email), precio, RFC, datos administrativos, y datos de maquila (proveedor, costo, precio)
   - **Copia Producción** (Producción/Pre-prensa/Germán): solo nombre del cliente (sin contacto), sin precio, sin RFC, sin datos administrativos. Badge rojo "COPIA PRODUCCIÓN" en header
   - Secretaría y Admin ven **dos botones**: "🖨️ Versión Completa" y "🏭 Copia Producción"
   - Producción/Pre-prensa/Germán solo ven un botón que imprime la versión sin datos sensibles
   - Datos de maquila (proveedor, costo, precio) ahora aparecen en versión completa para órdenes maquila
   - Maquila parcial (proveedor externo) muestra datos de contacto en versión completa
   - Secciones de Impresión y Acabados se ocultan para órdenes maquila (no aplican)
   - Columna "Color" vacía eliminada de tabla Impresión (era redundante)

### Bugs corregidos (10)
| # | Sev | Descripción |
|---|-----|-------------|
| 1 | 🟡 | **PrintOrder modal sin ESC** — Único modal (de 14) que no tenía `useEscClose(onClose)`. Fix: agregado |
| 2 | 🟡 | **`duplicate` copiaba `production_number`** — Al duplicar una orden se heredaba el folio P-XXXX, creando dos órdenes con el mismo número de producción. Fix: `production_number: null` en objeto duplicado |
| 3 | 🟡 | **Revert: notificaciones sin try-catch** — `onConfirm` del revert enviaba `await db.addNotification()` sin protección. Si fallaba la red, unhandled rejection y modal se quedaba abierto. Fix: envuelto en try-catch |
| 4 | 🟡 | **Revert: notificaciones falsas si doAdv falla** — `doAdv` atrapa errores internamente sin re-lanzar, así que las notificaciones de revert se enviaban aunque la DB no se actualizara. Fix: try-catch abarca todo el bloque (doAdv + notificaciones) |
| 5 | 🟡 | **StorageTab popup "¿Ya descargaste?" sin ESC** — Modal `downloadedOrder` (position:fixed) no tenía listener de ESC. Fix: `useEffect` con keydown listener consistente con Calendar |
| 6 | 🟡 | **`update` useCallback faltaba `reload` en deps** — `update` usa `reload()` en su catch pero no lo incluía en dependencias. Fix: `reload` agregado al array de deps |
| 7 | 🟢 | **`quick_note` no era optimistic** — La nota aparecía solo después del `await db.addNote()`, causando delay visible. Fix: `setOrders` se ejecuta primero, revert con `reload()` si falla |
| 8 | 🟢 | **`searchFilter` no incluía `client_phone`** — Buscar por número de teléfono no encontraba órdenes. Fix: `o.client_phone` agregado al array de búsqueda |
| 9 | 🟢 | **`handleAction` deps incompletos en `useCallback`** — Faltaban `user` y `reload` en el array de dependencias. Fix: agregados |
| 10 | 🟢 | **Archive `fmt(o.price||o.maq_price)` sin parseFloat** — Si `o.price` era string `"0"`, la expresión `||` saltaba incorrectamente a `maq_price`. Fix: `parseFloat()` agregado, consistente con el resto del código |

### Mejoras
- **Descripción del producto rediseñada** — En el formulario: el campo de descripción ahora ocupa todo el ancho (antes compartía fila con Tipo), textarea más alto (90px vs 52px) con placeholder descriptivo. En la impresión: la descripción tiene su propia fila de ancho completo con tipografía más grande (12px, line-height 1.6) y soporte para texto multilínea. Solo aparece si hay descripción escrita

### Notas técnicas v10.3.1
- **Sin migración SQL requerida** — Todos los cambios son solo frontend
- **PrintOrder reescrito** — `printIt(mode)` acepta `"full"` o `"production"`. Variable `isProd` controla qué secciones se renderizan en el HTML de impresión. CSS class `.copy-badge` para el badge rojo de "Copia Producción"
- **Impresión condicional** — Secciones Impresión y Acabados envueltas en `if(!isMaq)` para órdenes maquila. Datos Administrativos solo en `!isProd`, versión producción muestra solo Agente y Tipo de Orden
- **Datos de maquila en impresión** — Nuevo bloque `if(isMaq&&!isProd)` muestra proveedor/costo/precio. Maquila parcial `if(!isMaq&&o.maquila_provider&&!isProd)` muestra contacto del proveedor
- **Descripción del producto mejorada** — En formulario: campo full-width con `minHeight:90` y placeholder descriptivo. En impresión: fila propia `colspan=4` con `font-size:12px`, `line-height:1.6`, `white-space:pre-wrap`. Solo se muestra si hay descripción
- **Sintaxis verificada** con `acorn` + `acorn-jsx` (2723 líneas, 0 errores)

---

## v10.3 — Notas Rápidas + Reporte Semanal + Archivo + Costos Químicos + Alertas Estancadas (6 features, 14 bugs)

### Nuevas funcionalidades (6)

1. **Notas Rápidas entre roles** — Mini-chat por orden con burbujas estilo mensajería. Cada rol ve sus mensajes alineados a la derecha, los de otros a la izquierda. Colores por rol. Distinto del CommentLog (timeline). Nueva tabla `order_notes` en Supabase con Realtime. Accesible desde cada OCard (botón "💬 Notas Rápidas"). Se borran al eliminar orden
2. **Reporte Semanal Completo** — WeeklyReport expandido para Admin con botón "▼ Reporte Completo". Incluye: entregas a tiempo (%), días promedio, horas máquina, merma (pliegos + piezas), consumo de químicos (revelador + reforzador), placas (chicas + grandes), costo de mantenimiento, top 5 clientes con medallas, top 5 productos, y lista de órdenes estancadas (48h+). Secretaría sigue viendo el resumen básico (4 métricas)
3. **Archivo de Completadas** — Nueva vista "🗂️ Archivo" en navegación para todos los roles. Órdenes entregadas organizadas automáticamente en carpetas colapsables: Año → Mes → Semana. Tarjetas compactas con info esencial (cliente, producto, fecha, precio). Click abre DetailModal. Totales por carpeta. Año actual se abre automáticamente. Roles sin acceso a precios no ven montos
4. **Análisis de Costos de Químicos** — Solo Admin, panel integrado en Químicos. Calcula automáticamente: costo mensual de revelador (descontando evaporación ~2.4L/mes) y reforzador, costo químico por placa proporcional al área (ratio chica/grande = 2.21×), tabla con desglose material + químico + IVA por tipo de placa. Configurador de precios editable (⚙️ Editar Precios) con tabla `app_config` en Supabase. Precios iniciales: Revelador $1,059.03/20L, Reforzador $1,370.51/20L, placa chica $29.49, placa grande $65.41, IVA 16%
5. **Menú "⋯ Más" (nav overflow)** — Primeras 5 pestañas visibles, el resto en dropdown "⋯ Más". Admin pasa de 9 tabs amontonados a 5 + dropdown con 4. Al seleccionar un tab del dropdown, el botón muestra el icono y nombre del tab activo. Click fuera cierra el dropdown. Aplica a todos los roles con más de 5 pestañas
6. **Alertas de Órdenes Estancadas (24h)** — Doble sistema de alerta: **Banner rojo en Pendientes** (todos los roles) con grid de órdenes estancadas 24h+ mostrando cliente, tipo, cantidad, etapa, tiempo y badge RETRASO. Las estancadas se separan del listado normal para máxima visibilidad. **Notificaciones automáticas** (solo sesión Admin envía, cada 30min) al rol responsable + Admin con mensaje "⚠️ Orden estancada: ClienteX lleva Xd en Etapa". Una notificación por orden por sesión (no spamea). `staleNotifiedRef` previene duplicados

### Migración SQL requerida
- Nueva tabla `order_notes` (id, order_id, text, by_user, created_at) + RLS + Realtime
- Nueva tabla `app_config` (key TEXT PK, value JSONB, updated_at, updated_by) + RLS
- Seed: `chemical_prices` con precios iniciales de Padilla Hnos.

### Cambios técnicos
- **`db.addNote()`** — nuevo método en capa de datos
- **`db.loadConfig(key)`** — carga configuración por clave desde `app_config`
- **`db.saveConfig(key, value, byUser)`** — guarda/actualiza configuración con upsert
- **`loadOrders`** — incluye `order_notes` en Promise.all (5to query)
- **`deleteOrder`** — borra `order_notes` antes de la orden
- **Realtime** — suscripción a `order_notes` (INSERT → reload)
- **`handleAction`** — nuevo caso `quick_note` con optimistic update
- **`create`/`duplicate`** — inicializan `notes_log:[]`
- **`WeeklyReport`** — recibe props `role`, `chemicals`, `plates`, `maintenance`
- **State top-level** — `chemicals` y `plates` ahora se cargan en PrintFlow (antes solo en ChemicalPanel). Realtime actualiza ambos
- **`Archive`** — componente nuevo con `useMemo` para agrupación por fecha. Tree: `{year: {month: {week: [orders]}}}`
- **`ChemicalPanel`** — carga `chemical_prices` desde `app_config`, calcula costos con `useMemo`. Fórmula: costo proporcional por área (X para chica, 2.21X para grande, donde X = costoTotal / (plChicas + plGrandes × ratio))
- **`PriceEditorModal`** — componente separado con `useEscClose`, formulario para actualizar 10 parámetros de costos, guardados en `app_config` vía `db.saveConfig`
- **Nav overflow** — `MAX_VISIBLE=5`, `visibleNavs`/`moreNavs` split. Dropdown con overlay fijo para cerrar al click fuera. Estado `showMoreMenu`. Botón "⋯ Más" con punto indicador azul cuando un tab del dropdown está activo

### Bugs corregidos (14)
| # | Sev | Descripción |
|---|-----|-------------|
| 1 | 🟡 | **Código muerto en cálculo de costos** — Fórmula compleja en costoQuimChica sobreescrita inmediatamente por fórmula correcta. Eliminada fórmula redundante |
| 2 | 🟡 | **Archive `.sort()` muta array memoizado** — `tree[y][m][w].sort()` modificaba el array dentro del `useMemo` directamente. Fix: `.slice().sort()` |
| 3 | 🟡 | **Archive `useMemo` dep `delivered` se recrea cada render** — `delivered` es array nuevo cada render, el memo nunca cacheaba. Fix: dep cambiada a `orders`, filtro movido dentro del memo |
| 4 | 🟡 | **`saveOrder` no excluía `notes_log`** — Se pasaba al row sin destrucción. Fix: agregado `notes_log` al destructure de `saveOrder` |
| 5 | 🟡 | **WeeklyReport `weekOnTime` % inflado** — Dividía entre TODAS las entregadas incluyendo las sin `due_date`, inflando % artificialmente. Fix: denominador solo órdenes con fecha |
| 6 | 🟡 | **Price editor modal sin ESC** — Inconsistente con otros modales. Fix: extraído a `PriceEditorModal` componente con `useEscClose` |
| 7 | 🟡 | **`saveRev`/`saveRef` sin try-catch** — Si `db.addChemical` fallaba, botón quedaba en "⏳..." permanente y form no se cerraba. Fix: try-catch-finally en ambas funciones |
| 8 | 🟢 | **Archive `useEffect` dep `years` inestable** — `years` se recreaba cada render. Fix: dep cambiada a `tree` (memoizado), `years` calculado dentro del effect |
| 9 | 🟢 | **DetailModal no mostraba QuickNotes** — Feature nueva invisible en detalle. Fix: sección "💬 Notas Rápidas" agregada con historial de notas en DetailModal |
| 10 | 🔴 | **PrintOrder mostraba precio a Producción/Pre-prensa/Germán** — Gerardo podía ver precios al imprimir. Fix: PrintOrder recibe prop `role`, precio oculto para roles `hp` |
| 11 | 🟡 | **Acabados personalizados ("Otros") no aparecían en orden impresa** — Custom finishes se perdían en la impresión. Fix: fila "Otros: ..." agregada debajo de checkboxes cuando hay acabados fuera de los 14 predefinidos |
| 12 | 🟡 | **Merma visible en Procesadora (Germán)** — Botón 🗑️ aparecía en todas las tarjetas de PreprensaBoard. CTP/Procesadora no registran merma. Fix: botón eliminado de PreprensaBoard |
| 13 | 🟡 | **Menú dropdown cambiaba texto del botón** — Al seleccionar un tab del dropdown, el botón "⋯ Más" cambiaba a mostrar el nombre del tab activo, confundiendo al usuario que no encontraba el menú. Fix: siempre muestra "⋯ Más" con punto indicador azul cuando un tab del dropdown está activo |
| 14 | 🟡 | **Órdenes estancadas duplicadas en Pendientes** — Al agregar el banner de estancadas, las mismas órdenes aparecían en el banner rojo Y también como OCards normales debajo. Fix: las estancadas se separan a `normalTasks` (excluye stale), banner es su propia sección. Empty state solo si no hay ni stale ni normales |

### Mejoras
- **Orden impresa rediseñada** — Header mejorado con subtítulo "Padilla Hnos. Impresora · León, Gto." y fecha en folio. Tipografía más definida con labels de 7px y values de 12px. Sección de Impresión reorganizada (6 columnas sin columna "Color" redundante). Fecha de entrega resaltada en rojo para órdenes urgentes. Cantidad en rojo para visibilidad. Notas con white-space pre-wrap. Sección Datos del Cliente incluye teléfono. Acabados personalizados en fila "Otros". Márgenes de impresión optimizados a 8mm
- **MXN/Hora corregido en Analytics** — Cálculo anterior dividía ingresos entre horas activas (la máquina produciendo), ignorando tiempo muerto. Ahora calcula horas disponibles reales: 9hrs/día (9am-7pm −1hr lunch) × 5 días/sem × días laborales del periodo. Muestra: **MXN/Hr Real** (ingresos ÷ horas disponibles), **Utilización %** (horas trabajadas ÷ disponibles, con color semáforo), **MXN/Hr Activa** (ingresos ÷ horas efectivas, solo en detalle). Barra de progreso ahora muestra utilización en vez de ingreso relativo
- **Acabados: Engomado → Engomado Superior + Engomado Lateral** — Reemplazado en FINISHES, formulario y orden impresa
- **Victor eliminado de Agentes** — Quedan Manuel, Genaro, Marcelo + Otro
- **# Producción con prefijo P-** — Campo muestra "P-" fijo, solo se escriben 4 dígitos numéricos
- **Tipo de producto "Otro"** — Al seleccionar Otro se abre input para escribir el tipo personalizado
- **Bug "Otro" acabados corregido** — Ya no agrega texto "Otro" al string. Usa estado `showOtroFinish` con input limpio
- **Descripción del producto mejorada** — Textarea con placeholder descriptivo "Revista 2 hojas a color, 5 hojas blanco y negro..."
- **Notas renombradas** — "Notas de Proceso / Aclaraciones" con placeholder "No hay archivo, el cliente lo manda a Noemí..."
- **Timeline muestra quién hizo el cambio** — Cada entrada ahora muestra nombre con color del rol (Producción, Noemí, Germán, etc.)
- **Calendario mejorado** — Tarjetas más descriptivas con tipo, cantidad, etapa y prioridad. Leyenda de colores (Retrasada/Pendiente/Entregada). Banner "👆 Haz click para cambiar fecha". Modal con tarjeta de info completa de la orden. Hover con sombra en tarjetas
- **`deleteOrder` con try-catch** — Cascada de 8 deletes ahora envuelta en try-catch con reload en caso de error
- **Auto-fix validación dual** — Ahora verifica `error` de Supabase además de `count`

---

## v10.2 — Mejoras UX + Robustez DB (20 mejoras, 19 bugs corregidos)

### Nuevas funcionalidades UX (20)
1. **Toast de confirmación** — Popup temporal (3.2s) en 14 acciones: crear, validar, asignar máquina, aprobar prueba, enviar maquila, merma, duplicar, borrar, avanzar etapa. Colores por tipo (verde/rojo/amarillo). Timer estabilizado con `useRef` para evitar reset infinito
2. **Loading overlay** — "⏳ Procesando..." con opacity y pointer-events:none en OCard. Activo en doAdv, approveProof, validate_prod, validate_pre (todas con `finally{setActionLoading(null)}`)
3. **ESC cierra modales (stack-based)** — `escStack` global: solo cierra el modal más reciente. Ignora ESC en INPUT/TEXTAREA/SELECT. 13 modales con `useEscClose` + 2 drop confirms (Kanban/PreprensaBoard) + 1 Calendar date modal con listeners locales
4. **Búsqueda global** — Input en header, visible solo en Pendientes y Todas. Se limpia al cambiar a otras vistas. `searchFilter` con `useCallback`
5. **Indicador de conexión Realtime** — Punto junto al logo: amarillo (conectando), verde (SUBSCRIBED), rojo (desconectado). Inicia como `null`
6. **Drag affordance** — Banner "⠿ Arrastra al Tablero" con borde punteado en OCards arrastrables. Suprimido en Pendientes/Todas vía prop `noDragHint`
7. **Maquila urgencia visual** — Colores progresivos: verde (<3d), naranja (3-6d), amarillo (7-13d), rojo (14d+). Badge "⚠️ +14 días" automático
8. **Nav tabs más grandes** — `fontSize:12, padding:8px 14px` (antes 10px/6px)
9. **Fuentes mínimas 10px** — Eliminados todos los `fontSize:7` y subidos ~40 instancias de `fontSize:8` a 10px en badges, fechas, etiquetas, analytics, calendario, DragCards, validation indicators
10. **Campos recomendados** — Cantidad, Entrega, Papel marcados con "(recomendado)" en naranja. Prop `rec` en componente FC
11. **Botón renombrado** — "🔍 Revisar Specs" → "📋 Revisar y Editar"
12. **Borrar todas las notificaciones** — Botón "🗑️ Borrar todas" en NotificationTray + `db.deleteAllNotifications(role)`
13. **CSS animation** — `@keyframes toastIn` para fade+slide del Toast
14. **Metas de químicos eliminadas** — Sin barras de progreso ni metas (80L/20L). Sin popup reminder. State `chemReminder` eliminado

### 🔴 Bugs Críticos corregidos (5)
1. **Órdenes fantasma (saveOrder enviaba `image` a DB)** — `image` no es columna en tabla `orders`. PostgREST rechazaba TODO el upsert silenciosamente. Orden existía en React state pero nunca en DB → desaparecía al cambiar sesión. **Fix:** Whitelist de 41 columnas válidas en `saveOrder` + `if(error) throw`
2. **Supabase JS no lanza errores** — Todos los `.update()/.upsert()` retornan `{error}` pero nunca hacen throw. Los try-catch nunca se activaban. **Fix:** 9 puntos con destructuring `{error}` + `throw new Error(error.message)`: saveOrder, update, doAdv, approveProof, assignMachine, sendMaquila, validate_prod, validate_pre, changeDate
3. **Toast timer se reseteaba infinitamente** — `onDone` como inline arrow creaba nueva referencia cada render → `useEffect` loop. **Fix:** `useRef` para estabilizar callback
4. **`validate_prod`/`validate_pre` no verificaban error de supabase.update** — Validación aparecía localmente pero no se guardaba. **Fix:** `{error:vpErr}` + throw
5. **`duplicate` sin try-catch + saveOrder ahora lanza throw** — Unhandled promise rejection + orden duplicada fantasma. **Fix:** Envuelto en try-catch

### 🟡 Bugs Medios corregidos (8)
6. **ESC cerraba modal mientras usuario escribía** — Ahora verifica `e.target.tagName` antes de cerrar
7. **ESC cerraba múltiples modales apilados** — Sistema `escStack` con push/pop, solo cierra el más reciente
8. **Búsqueda persistía en vistas que no la usan** — Se limpia al navegar + input solo visible en tasks/orders
9. **Drag banner fuera de contexto** — Prop `noDragHint` suprime en Pendientes/Todas
10. **`actionLoading` incompleto** — Agregado a doAdv y approveProof (antes solo validate)
11. **`changeDate` sin error check** — Fecha cambiaba local pero no en DB si fallaba. **Fix:** try-catch + `{error:cdErr}`
12. **`addWaste` sin try-catch** — Merma se perdía silenciosamente. **Fix:** try-catch + toast
13. **Auto-fix `count` siempre null** — Supabase JS v2 retorna `count:null` sin `{count:'exact'}`. Timeline duplicado en multi-tab. **Fix:** `{count:"exact"}` en options

### 🟢 Bugs Menores corregidos (6)
14. **Indicador conexión verde prematuro** — Iniciaba `true`. **Fix:** `useState(null)` → punto amarillo hasta confirmar
15. **`approveProof` sin try-catch/toast** — **Fix:** Envuelto con `{error:apErr}` + throw + toast
16. **Kanban drop confirm sin ESC** — **Fix:** `useEffect` con keydown listener
17. **Calendar date modal sin ESC** — **Fix:** `useEffect` con keydown listener (respeta inputs)
18. **`addComment` sin try-catch** — **Fix:** try-catch + toast error
19. **Inline handlers sin try-catch** — Devolver, Placas, Mantenimiento inicio/cierre. **Fix:** 4 handlers envueltos

### Notas técnicas v10.2
- **`saveOrder` whitelist:** 41 columnas explícitas. `image` excluido (campo UI-only, no persiste en DB). Cualquier campo desconocido se ignora silenciosamente en vez de romper el upsert
- **Error propagation:** `supabase.from().update()` retorna `{data, error}` pero NO hace throw. Todos los puntos críticos ahora destructuran error y lanzan `throw new Error(error.message)` para que los try-catch funcionen
- **`escStack`:** Objeto global singleton con `_bound` guard para evitar listeners duplicados en HMR. `push/pop/fire` pattern — solo el último modal registrado responde a ESC
- **Toast `useRef` pattern:** `const cb=useRef(onDone); cb.current=onDone; useEffect(()=>{setTimeout(()=>cb.current(),3200)},[])`  — deps vacíos, timer estable
- **Auto-fix `count:'exact'`:** Segundo argumento de `supabase.from().update(data, {count:'exact'})` — retorna count real para guard de deduplicación
- **Solo CHANGELOG.md se actualiza por sesión.** Los otros 3 docs base (Contexto, Roadmap, Documentación) solo se actualizan en versiones mayores (v11+)

---

## v10.1 — Revisión Exhaustiva de Bugs (26 fixes en 4 rondas)

### 🔴 Críticos (5)
1. **Realtime no escuchaba `chemical_log` ni `plate_log`** — agregada suscripción con `chemKey` que fuerza remount del ChemicalPanel
2. **`doAdv` usaba `orders` stale del closure** — orden capturada ANTES de `setOrders` para notificaciones con datos frescos
3. **Auto-fix validación dual podía disparar múltiples veces** — `useRef` guard + verificación de `count` en el update
4. **`deleteOrder` no limpiaba `plate_log`** — FK constraint hacía fallar el DELETE silenciosamente. Agregado `plate_log.delete()`
5. **`update` (saveOrder) sobreescribía validaciones concurrentes** — reescrito con whitelist de 31 campos editables + `supabase.update()` en vez de `upsert(todoElRow)`

### 🟡 Medios (13)
6. **Maquila drop zone no aceptaba stage `ready`** — agregado a la lista de stages válidos
7. **PreprensaBoard no bloqueaba drops en mantenimiento** — CTP/Procesadora ahora muestran 🔧 y rechazan drops
8. **WelcomeGuide sin título para Germán** — agregado `german: "👋 Germán"`
9. **`sendMaquila` no notificaba a Secretaría/Admin** — notificación agregada con datos del proveedor
10. **Devolver a Diseño: Admin no notificaba a Producción** — `addNotification` directo a produccion cuando `user==="admin"`
11. **`proof_approved` no se limpiaba al devolver a diseño** — ahora `ns==="design"` setea `proof_approved=null` en state + DB
12. **`update` convertía precio $0 a null** — helper `toNum()` que distingue vacío→null, 0→0, NaN→null
13. **Admin podía saltar CTP/Procesadora con botón en Pendientes** — "Placas Listas" solo aparece si `current_machine==="pp_proc"`, con guías contextuales para otros estados
14. **Revert lineal producía stages incorrectos en rutas no-lineales** — reescrito: busca en timeline la transición cuyo destino es el stage actual, extrae el origen real
15. **Revert multi-flecha fallaba en parsing** — usa `lastIndexOf`/`indexOf` para entries como "📝 → 🎨 Ambos validaron → Diseño"
16. **Secretaría no podía editar órdenes maquila** — botón "✏️ Editar Maquila" agregado para stages maquila no entregados
17. **Crear orden maquila no notificaba a Admin** — bloque `else` en `create` envía notificación con datos del proveedor
18. **Admin revert no notificaba a nadie** — después de doAdv, notifica al rol responsable del stage destino (usa `SM[prevId]?.who`)

### 🟢 Menores (8)
19. **`delivered_at` no se limpiaba al revertir desde entregada** — setea null en state + DB al revertir de *delivered → stage
20. **`closeMachineLog` (DB) solo cerraba primer log abierto** — eliminado `.limit(1)`, cierra todos con loop
21. **`closeML` (local/optimistic) solo cerraba primer log** — `findIndex` reemplazado por `forEach` consistente con DB
22. **`changeDate` ejecutaba si la fecha no cambió** — guard `if(o?.due_date===newDate) return`
23. **`EndMaintenanceModal` aceptaba costo negativo** — validación `parseFloat(cost)<0`
24. **Comentario de versión decía v7** — actualizado a v10
25. **Búsqueda global no buscaba en agente, notas, papel, acabados** — 4 campos agregados al filtro
26. **`useRef` faltaba en imports** — agregado para auto-fix guard

### Cambios de comportamiento (sin bug previo)
- Mantenimiento ahora visible en Tablero Germán (PreprensaBoard) — mismo visual 🔧 naranja que Kanban
- `maintenance` prop pasado a PreprensaBoard desde ambos render points (Germán y Admin)
- Búsqueda en "Todas" ahora incluye: agent, notes, paper_type, finishes

---

## v10 — Rol Germán + Químicos + Mantenimiento
- **Nuevo rol: Germán** (5to usuario) — operador de CTP, Procesadora y Epson P7570
- Flujo rediseñado: Noemí (diseño/archivos) → Germán (impresión/CTP) → Producción
- Nueva etapa `placas_listas` entre CTP y ready (13 etapas total)
- Noemí ya no opera el Tablero de máquinas — solo diseño y aprobación
- Germán: Tablero propio con CTP + Procesadora
- Secretaría puede aprobar/rechazar pruebas de color
- Producción: "↩️ Devolver a Diseño" con motivo obligatorio
- Zona de Maquila en Tablero Producción (drag & drop)
- **Popup forzoso de placas** al arrastrar al CTP (tamaño + cantidad)
- **Panel de Químicos y Placas**: revelador (limpiezas) y reforzador (consumo)
- Recordatorio automático de químicos (popup día ≥15) — *eliminado en v10.2*
- **Mantenimiento de máquinas**: inicio (Gerardo/Admin) + cierre con costo (Admin)
- Notificaciones: borrar individual, nombres completos
- Gestión de archivos prominente (Noemí sube/borra, Germán descarga)
- 3 nuevas tablas: chemical_log, plate_log, maintenance_log
- 8 bugs corregidos

## v9.1 — Campos de Impresión + Orden SYGMA
- Campo Agente/Vendedor (Manuel, Victor, Genaro, Marcelo + Otro)
- Campo Gramaje (Grs.) en especificaciones
- Tintas Frente y Tintas Vuelta separados
- Acabados como checklist de 14 opciones + Otro
- Orden impresa réplica formato SYGMA
- Race condition fix: orders.update PRIMERO
- **🔧 Fix Empaque:** vm_manual faltaba en tabla machines
- CSV actualizado a 38 columnas

## v9 — Reestructuración de Tableros + Notificaciones
- Empaque como zona drag & drop con timer
- Zona de Salidas, Tablero Pre-prensa separado
- Notificaciones persistentes, 19 bugs corregidos

## v8 — Supabase Producción
- Migración completa a Supabase, validación dual, analytics, 29 bugs corregidos

## v7 — UX Polish
## v6 — Orden Imprimible + Calendario
## v5 — Timeline + Autocomplete
## v4 — Pre-prensa (4to Rol)
## v3 — Dos Tipos de Orden
## v2 — Máquinas Reales
## v1 — Demo Inicial

---

## Estado de Bugs

✅ **Sin bugs abiertos.** 167+ bugs resueltos en total (29 en v8, 19 en v9, 5 en v9.1, 8 en v10, 26 en v10.1, 19 en v10.2, 14 en v10.3, 10 en v10.4, 24 en v10.4.1, 10 en v10.4.2, 3 en v10.4.3).
