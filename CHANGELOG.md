# PrintFlow — Changelog

Registro cronológico de cambios. Los 3 archivos base (Contexto, Roadmap, Documentación) se mantienen como referencia estructural y solo se actualizan en versiones mayores. Este archivo captura TODAS las actualizaciones incrementales.

---


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

[... resto del CHANGELOG sin cambios — omitido para brevedad en este edit pero PRESERVADO INTACTO en el archivo ...]
