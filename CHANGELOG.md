# PrintFlow — Changelog

Registro cronológico de cambios. Los 3 archivos base (Contexto, Roadmap, Documentación) se mantienen como referencia estructural y solo se actualizan en versiones mayores. Este archivo captura TODAS las actualizaciones incrementales.

---


## v10.49.2 — Fixes post-scan exhaustivo v10.49.0-1 (1 🔴 + 3 🟠 + 1 🟡) — 27-may-2026

Scan inmediato post-v10.49.1 detectó 5 bugs reales. Atacados todos.

### 🔴 Fix#1 — DROP overload viejo `assign_invoice` (10 args)

Existían DOS firmas: 10 args (sin `p_allow_no_price`) + 11 args (con flag). PostgREST resolvía por matching de nombres, pero el riesgo era que el cache de schema cayera al 10-args silenciosamente → el flag se ignoraba → Karla elegía "Sin precio" y la RPC rechazaba con error de validación. **DROP del 10-args** elimina la ambigüedad.

### 🟠 Fix#2 — `allowNoPriceForOrder` no se limpiaba en path exitoso factura/remisión

El handler de InvoiceModal limpiaba el flag en stock_load y no_folio, pero NO en el path exitoso de factura/remisión normal. Ahora se limpia siempre + agregado toast diferenciado:
- Normal: "✅ Folio X asignado y orden entregada"
- Sin precio: "✅ Folio X asignado · ⚠️ Capturar precio después para que CobranzaFlow la vea"

### 🟠 Fix#3 — Guard maquila movido de `advance()` a `doAdv()` (cubre DnD)

El guard de v10.49.1 punto 3 estaba solo en `advance()` (botón). El **drag-and-drop** en Kanban llama directo a `doAdv()` y bypassaba la validación → Lupita podía arrastrar maquila sin precio/costo a `maq_received`. Ahora `doAdv()` también valida.

### 🟠 Fix#4 — `PriceCaptureModal` busy stuck si UPDATE falla

`setBusy(true)` se hacía antes de `onCapture` pero NO se reseteaba en error. Si UPDATE orders fallaba (red, RLS), el modal quedaba con botones "⏳" permanente. Ahora usa `try/finally` para garantizar `setBusy(false)` siempre.

### 🟡 Fix#5 — Texto pop-up menos engañoso

Antes: "El folio sí se asigna ahora" — engañoso porque el folio realmente se asigna en el InvoiceModal siguiente.
Ahora: "Al continuar sin precio, podrás asignar el folio en el siguiente paso. La factura se creará en CobranzaFlow automáticamente cuando captures el precio después."

Botón también más preciso: "💤 Sin precio, continuar a asignar folio".

### Confirmado OK (sin cambio)

- Verificación CobranzaFlow: 8 funciones usan `maq_price` (no `maq_cost`) ✓
- `sync_post_invoice_edit` retroactivo funciona con caso huérfano ✓
- `isNewClient` flag se calcula correctamente con `selC` async ✓
- Edge cases (price=0, maquila parcial, etc.) bloquean correctamente ✓


## v10.49.1 — Puntos 2 + 3: contacto obligatorio cliente nuevo + maquila precio/costo bloqueo — 27-may-2026

### Punto 2 — Cliente nuevo: contacto obligatorio MÁS visible

**Problema reportado**: Lupita podía saltar contacto al crear orden con cliente nuevo porque la validación solo se mostraba después de dar click (border rojo se activaba con `tried`).

**Fix**:
- **Banner naranja persistente** arriba de Email/WhatsApp cuando cliente es nuevo (sin `client_id`) y ambos vacíos:
  ```
  ⚠️ Cliente nuevo: captura al menos un Email o WhatsApp para crearlo en CobranzaFlow.
  Sin contacto no podremos avisarle del estado de su orden.
  ```
- **Border rojo DESDE EL PRIMER RENDER** en inputs email/whatsapp (no espera `tried`). Lógica `showContactWarn` separada de la lógica `tried` global.
- **Tooltip en botón "Crear Orden"**: si `missing.length > 0`, hover muestra "Faltan: Cliente, Contacto (Email o WhatsApp)..."

### Punto 3 — Maquila precio + costo OBLIGATORIO al "Recibimos el Trabajo"

**Problema reportado**: el botón "📥 Recibimos el Trabajo" avanzaba la maquila a `maq_received` sin validar nada. Al llegar a Karla con precio/costo vacíos, no podía facturar correctamente.

**Fix**:
- **Validación en `advance()` handler**: antes de transicionar `maq_in_progress → maq_received`, valida que `maq_price > 0 AND maq_cost > 0`. Si falta alguno, alert claro:
  ```
  ⚠️ Para recibir esta maquila faltan: 💰 Precio cliente · 💸 Costo proveedor.
  Edita la orden y captúralos antes de continuar.
  ```
- **Badge naranja visible** en la card cuando `maq_in_progress` tiene precio/costo incompleto. Muestra qué falta. Botón "📥 Recibimos el Trabajo" queda **disabled** con tooltip.

### Verificación crítica recordada

✅ `maq_price` (precio cliente) es lo que se pasa a CobranzaFlow. **`maq_cost` NUNCA entra en cálculo de amount**. Solo se usa para:
- Detectar ediciones post-factura (auto_mark_post_invoice_edits)
- Reporting interno de margen

CobranzaFlow recibe siempre lo que se cobra al cliente.


## v10.49.0 — Punto 1: Karla captura precio al Entregar (pop-up) — 27-may-2026

Marcelo: "dar permiso a Karla para poner precio a órdenes en salidas + pop-up al dar Entregar si la orden no tiene precio, con opción 'no tengo precio, luego se agregará'".

### Verificación CRÍTICA pre-implementación

Auditadas las 8 funciones DB que tocan amount/price para CobranzaFlow: **TODAS usan `maq_price` (precio cobrado al cliente), NINGUNA usa `maq_cost`**. Confirmado:
```sql
v_base_amount := COALESCE(CASE WHEN NEW.order_type = 'maquila' THEN NEW.maq_price ELSE NEW.price END, 0);
```
CobranzaFlow recibe siempre el precio al cliente, nunca un cálculo precio-costo.

### Cambios

**Backend**:
- `assign_invoice` nuevo parámetro `p_allow_no_price boolean DEFAULT false`. Si true, omite la validación `price>0` (revertida controlada de v10.46.5).
- `sync_invoice_from_orders` ya NO hace `RAISE EXCEPTION` si `amount<=0`. Ahora registra audit_log `bridge_skip_no_price` y `RETURN NEW` silencioso. Permite asignar folio sin precio sin que la transacción aborte.
- `sync_post_invoice_edit` v10.46.6 (sin cambios) detecta caso huérfano cuando se captura el precio después → CREA invoice retroactivamente en CobranzaFlow. Flow end-to-end probado y confirmado.

**Frontend — `PriceCaptureModal`** nuevo:
- Aparece automáticamente al dar "📄 Asignar Folio y Entregar" si `order.price` (o `maq_price`) está vacío
- Input de precio + 2 botones:
  - **"💰 Capturar y continuar"** → UPDATE precio en orden + abre InvoiceModal flow normal
  - **"💤 Sin precio, asignar folio igual"** → marca orden con flag `_allowNoPriceForOrder` + abre InvoiceModal con `p_allow_no_price=true`
- Warning visible: "Si eliges sin precio, la orden quedará pendiente en CobranzaFlow hasta que captures el precio luego"

**Frontend — `db.assignInvoice`** acepta 11º arg opcional `allowNoPrice` boolean.

**Frontend — handler `deliver_with_invoice`** intercepta antes de abrir InvoiceModal:
- Si la orden no tiene precio → setea `priceCaptureModal` (PriceCaptureModal aparece)
- Si tiene precio → abre `invoiceModal` directo (sin cambio)

### Flow probado end-to-end

```
1. assign_invoice('TEST', 'factura', 'D-99989', allow_no_price=true)
   → orden con folio + price=NULL
   → 0 invoices en CobranzaFlow
   → audit_log: bridge_skip_no_price ✓

2. UPDATE orders SET price=5000 WHERE id='TEST'
   → trigger auto_mark_post_invoice_edits setea has_post_invoice_edits=true
   → trigger sync_post_invoice_edit detecta caso huérfano
   → INSERT cobranza.invoices con amount=5800 (5000×1.16 IVA)
   → audit_log: bridge_post_edit_create_orphan ✓
```

### Por hacer en próximas versiones (planeadas por Marcelo)
- v10.49.1: Punto 2 — cliente nuevo con contacto obligatorio MÁS visible
- v10.49.2: Punto 3 — maquila precio+costo obligatorio al "Recibimos el Trabajo"


## v10.48.1 — Fixes post-scan exhaustivo v10.48.0 (4 🔴 + 5 🟠 + 2 🟡) — 27-may-2026

Scan inmediato post-v10.48.0 con 3 agentes en paralelo detectó 4 críticos + 5 mayores + 3 menores. Atacados todos los relevantes.

### Backend

**B1 — RLS en `stock_pools`**: tabla creada sin RLS habilitado (advisor ERROR). Cualquier anon/authenticated podía SELECT/INSERT/UPDATE/DELETE → renombrar/borrar pools, desvincular clientes en cascada.
```sql
ALTER TABLE public.stock_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_pools_read ON public.stock_pools FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.stock_pools FROM anon, authenticated;
```

**B2 + B3 — `sell_from_stock` cleanup**:
- DROP overload legacy 8 args (`p_client_id` agregado en v10.48.0; quedaba ambigüedad si caller usaba la firma vieja).
- Removido fallback silencioso "primer cliente del pool" cuando `p_client_id IS NULL`. Riesgo financiero real: si frontend olvidaba pasar el client_id, facturaba al cliente equivocado SIN error. Ahora `RAISE EXCEPTION 'p_client_id es obligatorio para productos en pool'`.

**B4 — `sell_from_stock` `FOR SHARE` en validación cliente↔pool**: previene race condition donde admin re-asigne `stock_pool_id` del cliente entre la validación y el INSERT de la orden.

**B5 — `assign_invoice` valida coherencia pool↔cliente**: si la orden tiene `client_product_id` con `stock_pool_id`, valida que el cliente actual de la orden siga perteneciendo al mismo pool. Defiende contra: venta creada → admin cambia stock_pool_id del cliente → folio asignado a cliente fuera del pool.

**B6 — Constraint `clients_merged_no_pool_check`**: clientes fusionados (`merged_into IS NOT NULL`) no pueden tener `stock_pool_id` propio (debe seguir al canónico via `get_client_billing_info`). NOT VALID (no afecta data existente, solo previene nuevos).

**m1 — Índices FK**:
- `idx_client_products_stock_pool_id` (parcial WHERE NOT NULL)
- `idx_clients_stock_pool_id` (parcial WHERE NOT NULL)

**m2 — `auto_complete_purchase_order` skip OC simple por venta-desde-stock**: las OCs auto-generadas por `ensure_purchase_order` para órdenes `stock_role='sale'` son ruido administrativo (no aportan valor de agrupación). Ahora NO se cierran automáticamente, evitan eventos innecesarios en reportería.

### Frontend

**F1 — Race en OrderForm useEffect doble-await**: `getClientBillingInfo` + `loadClientProducts` consecutivos. Si `f.client_id` cambia mid-flight, el `setStockPoolId(poolId del cliente viejo)` entre awaits contaminaba state. Fix: `setStockPoolId` y `setStockProducts` ahora se aplican JUNTOS al final, ambos condicionados a `alive`.

**F2 — Aviso cliente stock sin pool en InvoiceModal**: si `coronaInfo.stock_pool_id=null` con `billing_mode='stock'` (cliente Cuadra mal configurado), el catálogo viene vacío. Antes mensaje genérico; ahora distingue:
- Con pool, sin productos: "Pool no tiene productos. Crea desde Inventario."
- Sin pool: "Cliente sin pool asignado. Contacta admin o cambiar a billing_mode='normal'."

**F3 — SellFromStockModal mensaje cuando pool sin clientes activos**: si todos los clientes del pool están `active=false`, el dropdown queda vacío y el botón disabled sin razón visible. Ahora muestra: "⚠️ No hay clientes activos en este pool. Contacta admin." Select también disabled visualmente.

### m3 — `productOwner` fallback

Aceptado el fallback "Pool compartido" sin nombre como suficiente. La búsqueda actual (`stockClients.find(c=>c.stock_pool_id===p.stock_pool_id&&c.pool_name)`) funciona en 99% casos; el fallback solo aparece si `list_stock_clients` RPC falló parcialmente.

### Confirmado OK (verificado por agentes, sin cambio)

- Constraint XOR `client_id` vs `stock_pool_id`: 0 violaciones
- Reconciliación stock vs movimientos: sin discrepancias
- Pool Cuadra: 6/6 clientes, 8/8 productos, 168,500 unidades
- Idempotencia de load_order_to_stock
- Bridge cobranza para venta pool: invoice correcta con IVA
- apply_credit_no_folio rechaza pool (es para anticipo)
- sync_post_invoice_edit funciona idéntico con pool


## v10.48.0 — Stock Pool Compartido (Cuadra 6 clientes / 1 inventario) — 27-may-2026

Cambio arquitectónico: múltiples clientes pueden compartir el mismo inventario. Implementado para el caso Cuadra: 6 clientes (Manufacturera de Botas, Sombreros, Tiendas, Calzados Finos Italianos, Fábrica de Alta Calidad, Isabel de los Ángeles Quiroz) comparten un único pool de 168,500 unidades distribuidas en 8 productos.

### Schema DB

```sql
CREATE TABLE public.stock_pools (id, name, description, active, created_at);
ALTER TABLE cobranza.clients ADD COLUMN stock_pool_id uuid;
ALTER TABLE public.client_products ADD COLUMN stock_pool_id uuid;
ALTER TABLE public.client_products ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.client_products ADD CONSTRAINT client_products_owner_xor_check
  CHECK ((client_id IS NOT NULL AND stock_pool_id IS NULL) OR (client_id IS NULL AND stock_pool_id IS NOT NULL));
```

Cada producto pertenece O a un cliente individual O a un pool, nunca ambos. Backward compatible: clientes existentes (Pepito S.A., otros sin pool) siguen funcionando con `client_id` directo.

### Pool Cuadra creado

| SKU | Nombre | Stock |
|---|---|---|
| SOP-3-25 | Soporte 3-25 (grande) | 19,500 |
| SOP-CH-25 | Soporte CH-25 (mediano) | 25,000 |
| SOP-NO-2 | Soporte No 2 (chico) | 18,000 |
| TARJ-BILL | Tarjeta de billetera | 18,000 |
| ETIQ-COLG | Etiqueta colgante | 20,000 |
| CHIN-IMP | China impreso | 13,000 |
| CHIN-BLA | China blanco (relleno) | 25,000 |
| ETIQ-NEG | Etiqueta negra colgante interna | 30,000 |
| **Total** | | **168,500** |

**6 clientes asignados** al pool con `billing_mode='stock'`:
- Manufacturera de Botas Cuadra (ya era stock)
- Sombreros Cuadra (ya era stock)
- Tiendas Cuadra (ya era stock)
- Calzados Finos Italianos (ya era stock)
- **Fábrica de Alta Calidad** (cambiado de `normal` → `stock`)
- **Isabel de los Ángeles Quiroz** (cambiado de `normal` → `stock`)

### RPCs actualizadas

**`load_order_to_stock`**: validación dual — si el cliente tiene `stock_pool_id`, el SKU debe pertenecer al MISMO pool. Si es cliente individual (legacy), el SKU debe pertenecer al `client_id` como antes.

**`sell_from_stock`**: nuevo parámetro `p_client_id` (qué cliente del pool recibe). Para productos pooled es obligatorio (fallback al primer cliente del pool si NULL); para productos individuales se ignora.

**`list_stock_clients`**: ahora retorna `stock_pool_id` + `pool_name` para que el frontend agrupe.

**`get_client_billing_info`**: ahora retorna `stock_pool_id` para que el frontend cargue catálogo del pool.

### Frontend

- **`db.loadClientProducts(arg)`**: acepta `{poolId}` u string `clientId`. Carga del pool si se le pasa pool.
- **`ProductFormModal`**: al crear SKU, si el cliente tiene pool, lo asigna al pool (no a client_id). Muestra aviso "📦 Producto compartido con pool X · N clientes más usan este stock".
- **`InvoiceModal`** (3ra opción Cuadra): selector SKU carga del pool del cliente.
- **`SellFromStockModal`**: nuevo dropdown obligatorio "Cliente que recibe la venta" para productos pooled. Lista los clientes del mismo pool.
- **`OrderForm`** (panel Cuadra): catálogo dropdown muestra productos del pool. Header muestra "(pool compartido)" cuando aplica.
- **`InventoryModal`**: cards muestran "📦 Pool Cuadra" en verde para productos pooled. Filtro busca también por nombre del pool.

### Tests ejecutados (todos OK)

```sql
-- Test 1: Fábrica vende 100 SOP-3-25 → stock pool: 19500 → 19400 ✓
-- Test 2: Manufacturera vende 50 + Fábrica vende 30 del MISMO SKU → ambas órdenes correctas ✓
-- Test 3: OMAR QUIROZ (fuera del pool) intenta vender → "El cliente no pertenece al pool" ✓
```

### Notas operativas

- Cuando Karla venda desde Inventario un producto del pool, **DEBE elegir** explícitamente cuál de los 6 clientes recibe la orden (dropdown obligatorio).
- Cuando Lupita cree una orden Cuadra y vincule SKU del catálogo, el dropdown muestra los 8 productos del pool independientemente de cuál de los 6 clientes haya seleccionado.
- Las órdenes existentes de clientes Cuadra (no cargadas a stock todavía) NO requieren migración — simplemente vinculan al pool en su próxima asignación de SKU.

### Cleanup colateral

- `invoice_counters.oc` resincronizado a 90 (MAX real de purchase_orders) — el cleanup de tests previo lo había bajado a 86, causando colisión `OC-87 duplicate key`. Ahora alineado.


## v10.47.1 — ROLLBACK del REVOKE UPDATE (incidente Lupita) — 27-may-2026

**Incidente**: Lupita estaba creando una orden nueva, capturó datos, dio Guardar → error `permission denied for table orders`. Se asustó pensando que perdería el form.

**Causa raíz**: `supabase.from("orders").upsert(dbRow)` (línea 358 — `db.saveOrder`) genera SQL `INSERT ... ON CONFLICT DO UPDATE`. Postgres valida los permisos del branch `DO UPDATE` **antes de ejecutar**, aunque la fila no exista. El REVOKE UPDATE table-level de v10.47.0 lo bloqueó.

**Resolución inmediata**:
```sql
GRANT UPDATE ON public.orders TO anon, authenticated;
```

Lupita pudo guardar sin perder datos del form (no refrescó el navegador).

### Qué se mantiene de v10.47.0

- ✅ Trigger `auto_mark_post_invoice_edits` BEFORE UPDATE — sigue activo (idempotente, sin daño aunque la lógica también esté en el frontend optimistic)
- ✅ Frontend simplificado: ya no setea `has_post_invoice_edits` manualmente al `safeUpdate`

### Qué se revierte

- ❌ REVOKE UPDATE en columnas fiscales — REVERTIDO. Las columnas críticas (`invoice_folio`, `invoiced_at`, `payment_status`, etc.) vuelven a ser actualizables directamente desde el frontend.

### Defensa que sigue activa

El sistema NO queda desprotegido. Las RPCs SECURITY DEFINER de v10.46.5 y v10.46.9 siguen validando server-side:
- `assign_invoice`/`assign_folio_to_oc` rechazan `price≤0`
- `load_order_to_stock` valida `billing_mode='stock'` y SKU del mismo cliente
- `sell_from_stock` valida `billing_mode='stock'`
- Bridge `sync_invoice_from_orders` bloquea con `RAISE EXCEPTION` si amount inválido (v10.46.9 I1)
- Trigger `auto_complete_purchase_order` excluye stock_loaded sin folio

El riesgo restante es: usuario con anon key + conocimiento técnico podría hacer UPDATE directo. **Aceptable hasta v10.47.x con Auth real**.

### Plan correcto para v10.47.x

Cuando se implemente Supabase Auth JWT:
1. Refactorizar `db.saveOrder` a RPC `save_order(p_data jsonb)` SECURITY DEFINER
2. Validación JWT real (`auth.jwt()->>'role'`) en lugar de `p_user` string
3. Re-aplicar REVOKE UPDATE con confianza (ya no hay `.upsert()` directo)

### Lecciones aprendidas

1. **Probar UPSERT/INSERT, no solo UPDATE**: el test pre-deploy validó UPDATE directo pero no upsert (que internamente requiere UPDATE permission).
2. **Cambios de permisos en DB requieren staging real**: el test transaccional con `SET ROLE` no captura el comportamiento del cliente Supabase (que usa upsert).
3. **Mantener rollback SQL inline en CHANGELOG**: pagó rápido aquí — el GRANT inverso estaba listo.


## v10.47.0 — Hardening Fase 1: REVOKE UPDATE en columnas fiscales — 26-may-2026

Primera fase del refactor de seguridad. **Defensa real en DB** contra UPDATE directo de campos fiscales/financieros desde frontend (anon/authenticated). Ya no es posible modificar folios, fechas de facturación, payments, etc. sin pasar por las RPCs `SECURITY DEFINER` que tienen las validaciones del negocio.

### Backup pre-cambios
- 84 orders | 33 con folio | 1 credit_applied | 0 stocked_at | 0 cancelled | 0 post_invoice_edits
- Snapshot verificado intacto post-cambios.

### Cambios

**1. Trigger BEFORE UPDATE `auto_mark_post_invoice_edits`**

Antes el frontend seteaba `has_post_invoice_edits=true` manualmente al editar una orden con folio. Como esa columna se va a revocar, la lógica se migra a un trigger BEFORE UPDATE que detecta cambios en campos editables (price, maq_price, specs, cliente, etc.) y marca automáticamente cuando OLD.invoice_folio existe.

Frontend simplificado: ya no añade `has_post_invoice_edits` al `safeUpdate` (lo conserva solo en el optimistic UI predicting el valor del trigger).

**2. REVOKE UPDATE table-level + GRANT column-level explícito**

El primer intento (REVOKE column-level) NO surtió efecto porque el GRANT table-level lo supersedía. Patrón correcto:
```sql
REVOKE UPDATE ON public.orders FROM anon, authenticated;
GRANT UPDATE (col1, col2, ...) ON public.orders TO anon, authenticated;
```

**Columnas BLOQUEADAS** (solo via RPCs SECURITY DEFINER):
- `invoice_type`, `invoice_folio`, `invoiced_at`, `invoiced_by`, `invoice_pre_assigned`, `invoice_reason`
- `has_post_invoice_edits`
- `cancellation_reason`, `cancelled_at`, `cancelled_by`, `nc_emitted`
- `payment_status`, `payment_method`, `payment_amount`, `bank_reference`
- `stocked_at`, `credit_applied_at`

**Columnas ABIERTAS** (frontend sigue actualizando directo): order_type, stage, priority, production_number, datos del cliente, specs del producto, price, maq_price, notes, due_date, current_machine, file_url, agent, validaciones, stock_role, client_product_id, stock_loaded, etc.

### Tests ejecutados

```sql
SET ROLE authenticated;
UPDATE orders SET invoice_folio='D-HACK' WHERE id=...;
-- ERROR 42501: permission denied for table orders ✅

UPDATE orders SET price=99999 WHERE id=...;
-- OK ✅ (price es columna segura)
```

### Lo que el plan A NO arregla

- Cualquiera con anon key puede seguir llamando RPCs (`assign_invoice`, etc.) pasando `p_user="admin"` falsificado. Defensa real requiere Supabase Auth JWT con role verificado.
- Frontend SIGUE pudiendo UPDATE columnas operativas (price, stage, notes) → empleado con login mal-intencionado puede aún modificar esos campos.
- INSERT y DELETE en `orders` siguen abiertos (deuda técnica Fase 2/3).

### Rollback

Si algo se rompe en producción:
```sql
GRANT UPDATE ON public.orders TO anon, authenticated;
DROP TRIGGER trg_auto_mark_post_invoice_edits ON public.orders;
```

Y revertir el commit del frontend.


## v10.46.10 — Fixes 🟠 restantes + separación credit_applied_at — 26-may-2026

5 mayores + 1 documentación. Estado: scan exhaustivo cerrado, 0 críticos pendientes.

### Frontend

**M2 — `applyReplicate` toast informativo**: si el SKU del source pertenece a otro cliente (no se replica), el toast ahora dice: `✅ Datos replicados de P-XXXX (SKU del catálogo omitido — pertenece a otro cliente)`. Antes se omitía silenciosamente.

**M3 — Race reload doble post-venta-desde-stock**: el `InventoryModal` hacía reload interno DESPUÉS de cerrarse via `onClose()`, y el padre (App) también hacía reload al `setInventoryOpen(false)`. Ahora el reload interno solo corre si NO hay `onOpenInvoice` (modal sigue abierto). Cuando hay `onOpenInvoice`, el padre se encarga.

**M4 — Optimistic update post-stock_load limpia `invoiced_at`**: backend ya lo dejaba NULL via load_order_to_stock; el optimistic ahora también para consistencia exacta.

**M5 — Timeout 5s en `getClientBillingInfo` con fallback `billing_mode='normal'`**: aplica a InvoiceModal + PreInvoiceModal. Si la red queda colgada, los botones no quedan disabled indefinidamente — caen a flow normal después de 5s con `console.warn`.

### Backend

**Agent3 H2 — Separar `credit_applied_at` de `invoiced_at`**: `apply_credit_no_folio` (Corona "aplicar saldo sin folio") seteaba `invoiced_at` aunque la orden NO tenía folio fiscal — engañoso para reportería. Mismo patrón que v10.46.8 (`stocked_at`):
- ADD COLUMN `orders.credit_applied_at timestamptz` con COMMENT
- `apply_credit_no_folio` setea `credit_applied_at` (no `invoiced_at`)
- Backfill: 1 orden Modelo migrada (`invoiced_at → credit_applied_at` + limpio invoiced_at)
- Resultado: **0 órdenes orphan** con `invoiced_at` sin folio

Ahora 3 timestamps separados con semántica clara:
- `invoiced_at` → orden con folio fiscal asignado
- `stocked_at` → orden cargada a inventario Cuadra
- `credit_applied_at` → orden con saldo Corona aplicado sin folio

**Documentación trigger order**: COMMENT ON TRIGGER en `trg_sync_*` documenta que el orden es alfabético (riesgo conocido: UPDATE simultáneo de `invoice_folio` + `cancelled_at` ejecuta cancel antes que sync — hoy benigno, audit_log lo refleja).

### Cierre

**0 críticos pendientes**. Backlog total v10.46.x:

| Severidad | Atacados |
|---|---|
| 🔴 v10.46.5 (A1-A3, B1, B2, B4, B6) | 7 |
| 🔴 v10.46.9 (F1-F3, B1, B2, I1) | 6 |
| 🟠 v10.46.7 (C1-C6) | 5 |
| 🟠 v10.46.10 (M2-M5 + H2) | 5 |
| 🟡 v10.46.4/v10.46.8 | 8 |
| **Total** | **31 bugs** |

Deuda técnica para v10.47.x: RLS allow_all + EXECUTE GRANT abierto (refactor mayor).


## v10.46.9 — Fixes 🔴 post-scan exhaustivo v10.46.5-8 — 26-may-2026

Tercer scan exhaustivo (3 agentes paralelos cubriendo frontend + DB + integración). 6 críticos detectados — atacados todos.

### Frontend

**F1 — `ClientInput.onChange` borraba `stock_role` al primer keystroke post-selección**: bug REAL introducido por v10.46.5 A3. Lupita selecciona Cuadra del autocomplete (`selC` setea client_id + billing_mode + stock_role legacy) → primer keystroke → `onChange` con `f.client_id` existente entraba al reset → ¡borra todo lo recién seteado por selC!

**Fix**: comparar el nombre nuevo vs el actual; solo limpiar si REALMENTE cambió:
```js
const nameChanged=(v||"").trim()!==(f.client||"").trim();
if(f.client_id && nameChanged){ /* reset */ }
```

**F2 — Banner SKU eliminado vs select bloqueado contradecía UI**: si `stock_loaded=true` Y `linkedMissing=true`, el banner decía "revincula o desasigna" pero el select estaba disabled. Ahora distingue:
- `stock_loaded`: "vínculo histórico se conserva por auditoría" (no actionable)
- Editable: "Selecciona otro o 'Sin asignar'" (actionable)

**F3 — Race `setInvoiceModal(merged)` vs `setOrders` updater**: React 18 puede batchear el updater; `merged` podía leerse antes del flush. Ahora `setInvoiceModal` se defiere con `Promise.resolve().then(...)` para garantizar que el updater de orders ejecutó primero.

### Backend

**B1 — `assign_invoice` SET search_path** (omitido en v10.46.5): defensa anti-search-path-injection en la función crítica de facturación.

**B1 — `assign_folio_to_oc` valida price>0 + SET search_path**: otro path que asignaba folio bypassing las validaciones de `assign_invoice` (escenario I1). Si alguna orden de la OC tenía `price NULL/<=0`, el bridge fallaba con `bridge_error` silencioso para esa orden quedando folio huérfano. Ahora rechaza upfront con lista de órdenes inválidas.

**B2 — `sync_post_invoice_edit` retroactivo endurecido**:
- Guardia anti-duplicado: `SELECT COUNT(*) FROM cobranza.invoices WHERE doc_type+doc_number` antes del INSERT (evita duplicados por race/reentrada)
- Validar `client_id` resuelto antes del INSERT (skip con audit_log si null)
- `audit_log` ahora también captura SQLSTATE para diagnóstico

**I1 — Bloqueo defensivo en `sync_invoice_from_orders` para amount inválido**: agregado guard `IF v_base_amount <= 0 THEN RAISE EXCEPTION` ANTES del INSERT. Captura cualquier path (assign_invoice, assign_folio_to_oc, UPDATE directo del frontend, legacy) que intente setear `invoice_folio` sin precio válido. La excepción se propaga al UPDATE de orders → rollback completo → no queda folio huérfano. El `WHEN OTHERS` final ahora distingue candados (re-RAISE) vs errores genéricos (audit + RETURN).

### Métricas saludables

- 23× `bridge_create_invoice` exitosos en 7 días
- 79/79 OCs con `client_id`
- 0 OCs con discrepancia de total
- 0 órdenes `stock_loaded` sin `stocked_at`
- `payments_status_check` admite 'cancelado'


## v10.46.8 — Fixes 🟡 menores + semántica stocked_at — 26-may-2026

### Backend

**m5 — Separar `stocked_at` de `invoiced_at`**: antes `load_order_to_stock` seteaba `invoiced_at=now()` aunque la orden NO tenía folio fiscal — semánticamente engañoso. Reportería que filtra por `invoiced_at IS NOT NULL` traía órdenes cargadas a stock mezcladas con facturas reales.

- ADD COLUMN `orders.stocked_at timestamptz` (con COMMENT documentando semántica)
- `load_order_to_stock` ahora setea `stocked_at` (no `invoiced_at`)
- Backfill: copiar `invoiced_at → stocked_at` + limpiar `invoiced_at` para órdenes con `stock_loaded=true AND invoice_folio IS NULL`
- Frontend optimistic update post-stock_load actualiza `stocked_at` (no `invoiced_at`)

**m2 — Documentar FK design intencional**: comentarios en constraints para que sea claro al próximo lector:
- `orders.client_product_id` → `ON DELETE SET NULL` (orden no se pierde si SKU eliminado)
- `stock_movements.client_product_id` → `ON DELETE RESTRICT` (auditoría inmutable; usar soft-delete para SKUs)

### Frontend

**Filtros independientes por tab en InventoryModal**: antes `filter` era compartido entre tabs `products`/`history` — cambiar de tab preservaba el texto y confundía al usuario. Ahora `filterProducts` y `filterHistory` son state separado, cada tab arranca limpio o conserva su propio filtro.

**aria-labels** en SellFromStockModal y AdjustStockModal: labels `htmlFor` + `aria-label` en inputs y selects para mejor accesibilidad (consistente con InvoiceModal stock_load de v10.46.4).


## v10.46.7 — Fixes 🟠 restantes del scan exhaustivo — 26-may-2026

5 mayores que quedaban en backlog post-v10.46.5. Atacados todos.

### Frontend

**C1 — Soft-deleted SKU vinculado a orden EXISTENTE**: si Lupita editaba una orden Cuadra que tenía `client_product_id=X` y X había sido eliminado del catálogo (soft-delete), el select mostraba "" silenciosamente — el vínculo se perdía en UI sin que el usuario lo supiera. Ahora detecta el caso y muestra:
- Opción extra `disabled`: `⚠️ SKU eliminado del catálogo — revincula o desasigna`
- Banner rojo: `⚠️ El SKU vinculado fue eliminado del catálogo (soft-delete) o pertenece a otro cliente. Selecciona otro o "Sin asignar"`
- Border rojo en el select

**C2 — InvoiceModal flicker durante carga de `coronaInfo`**: los botones Factura/Remisión aparecían inmediatamente; si Karla los clickeaba antes de que `coronaInfo` resolviera, no vería el 3er botón Corona ("Aplicar saldo") o Cuadra ("Sin factura · Stock") que aparecería después. Ahora:
- Mensaje `⏳ Cargando datos del cliente…` mientras `coronaInfo===null`
- Botones Factura/Remisión deshabilitados (opacity 0.5) hasta que llegue la info
- Cuando carga, el 3er botón (si aplica) se monta junto con la habilitación de los 2 primeros

**C3 — `getClientBillingInfo` undefined billing_mode**: el refresh pre-confirm de stock_load bloqueaba con "cambió a undefined" si la RPC retornaba `{billing_mode: null}`. Ahora solo bloquea si tenemos info DEFINITIVA de cambio: `fresh && fresh.billing_mode && fresh.billing_mode !== "stock"`. El RPC `load_order_to_stock` valida server-side de todas formas.

**C6 — Race InventoryModal cierre + InvoiceModal apertura**: si `reload()` post-venta fallaba por red, `onOpenInvoice` no se ejecutaba — la venta quedaba en backend pero Karla no veía el modal para asignar folio. Ahora `onOpenInvoice` se llama ANTES del reload; reload se hace después en best-effort (`.catch(...console.warn)`).

### Backend

**C4 — `recalculate_oc_total` no excluía órdenes stock-loaded sin folio**: el total de la OC incluía las órdenes desviadas a stock (que NO se entregaron al cliente real, sino al inventario interno), creando mismatch financiero. Ahora la SUM excluye `stock_loaded IS TRUE AND invoice_folio IS NULL`. Consistente con el fix de `auto_complete_purchase_order` de v10.46.1.

Incluye **backfill**: recalcula totales de OCs existentes que tengan órdenes stock-loaded.


## v10.46.6 — sync_post_invoice_edit crea invoice retroactivamente si era huérfana — 26-may-2026

Marcelo: "luego les asignaré precio por PrintFlow, ¿al editar la orden con folio se pasa a CobranzaFlow?"

**Antes**: `sync_post_invoice_edit` solo ACTUALIZABA invoices existentes en cobranza. Si la invoice nunca se creó (caso huérfano de las 6 órdenes históricas con price NULL), el trigger salía sin hacer nada — Marcelo asignaba precio post-factura, frontend marcaba `has_post_invoice_edits=true`, pero CobranzaFlow seguía sin verla.

**Ahora**: el trigger detecta el caso huérfano (invoice_folio asignado + invoice NO existe en cobranza + base_amount > 0 + no cancelada + no OC shared) y **crea la invoice retroactivamente** con la misma lógica del bridge original (resolve client_id + seller_id, calcula IVA según tipo de folio, status='pendiente'). Audit_log registra como `bridge_post_edit_create_orphan` para trazabilidad.

**Cómo usarlo**: Marcelo edita cualquiera de las 6 órdenes huérfanas (D-5822, D-5836, D-5839, D-5840, D-5851, R-1190), captura el precio real correcto, guarda. Al guardar:
1. Frontend marca `has_post_invoice_edits=true`
2. Trigger detecta caso huérfano
3. Crea invoice en `cobranza.invoices` con `source='printflow_bridge'` y `source_order_id` linkado
4. CobranzaFlow ya la ve

Aplica solo a órdenes con `cancelled_at IS NULL`. Si la orden fue cancelada antes de capturar precio, sigue requiriendo intervención manual.

Limitación: para órdenes en OC compartida con folio shared, el flujo es vía `assign_folio_to_oc` — no aplica esta ruta.


## v10.46.5 — Fixes 🔴 críticos post-scan exhaustivo — 26-may-2026

Scan exhaustivo con 3 agentes en paralelo (frontend, DB/RPCs, integración cobranza) detectó 11 bugs reales — 3 introducidos por v10.46.x y 6 preexistentes amplificados por los nuevos flujos. Atacados los relevantes; documentada deuda técnica para B3/B5.

### Introducidos por v10.46.x — corregidos

**A1 — `onOpenInvoice` merge invertido**: el merge `{...order, ...next[idx]}` daba prioridad al state (posiblemente Realtime stale) cuando `order` es lo más fresco del RPC. Además `setInvoiceModal(order)` abría el modal con la versión NO mergeada. Ahora el merge es `{...next[idx], ...order}` (RPC pisa) y se abre el modal con la versión mergeada explícita.

**A2 — `applyReplicate` cross-cliente Cuadra**: si replicabas de Botas Cuadra a Tiendas Cuadra (ambos billing_mode='stock'), el `client_product_id` se copiaba pero pertenece al primero. RPC rechazaba en backend pero form quedaba en estado fantasma. Ahora solo se replica si `prev.client_id===src.client_id`.

**A3 — `ClientInput.onChange` estado fantasma**: al borrar el nombre del cliente, `f.client_id` se reseteaba a null y `billing_mode` a 'normal' pero `stock_role='production'` (legacy) se preservaba. Ahora se limpia siempre al perder `client_id` (si el nuevo cliente resulta Cuadra, el dropdown reaparece para revincular).

### Preexistentes amplificados — corregidos

**B1 — `assign_invoice` valida `price > 0`**: bug histórico, **6 órdenes con folio fiscal asignado pero SIN invoice en CobranzaFlow** (D-5822, D-5836, D-5839, D-5840, D-5851, R-1190). El bridge fallaba con `invoices_amount_check` (price NULL o ≤0), capturaba el error con `WHEN OTHERS`, dejaba audit_log y la orden con folio huérfano. Karla creía facturó, CxC nunca lo vio. Ahora la RPC `assign_invoice` rechaza con mensaje claro si `price`/`maq_price` no es positivo.

**B4 — `ensure_purchase_order` setea `client_id`**: bug histórico, 52+ OCs simples creadas en 7 días con `purchase_orders.client_id=NULL`. Rompía joins por client_id en reportería/CxC. Aplicado fix + **backfill: 79 OCs históricas rellenas vía resolve_client**.

**B6 — `sync_cancellation_to_cobranza` cancela payments**: si Karla cancelaba factura ya pagada (no-Corona), la invoice quedaba 'cancelada' pero los payments seguían 'aplicado' → payments zombies que distorsionaban reportes. Ahora al cancelar la invoice, también marca payments como 'cancelado' + audit_log explica que la devolución/saldo-a-favor la gestiona equipo manual. Ampliado CHECK constraint de `payments.status` para permitir 'cancelado'.

**C5 — `SET search_path` en 3 SECURITY DEFINER restantes**: `auto_complete_purchase_order`, `recalculate_oc_total`, `sync_invoice_from_orders` pineados (defensa anti-search-path-injection).

### 6 órdenes huérfanas históricas — requieren decisión manual

Estas tienen folio fiscal asignado en PrintFlow pero NO en CobranzaFlow porque el bridge falló:

| Folio | Orden (P-) | Cliente | Monto |
|---|---|---|---|
| D-5822 | P-3514 | ALEJANDRA RODRIGUEZ | price NULL |
| D-5836 | P-3528 | ALEJANDRA RODRIGUEZ | price -0.01 |
| D-5839 | P-3530 | MIKE | price NULL |
| D-5840 | P-3543 | MIKE | price NULL |
| D-5851 | P-3518 | CHEMA | price NULL |
| R-1190 | P-3506 | ELIZABETH ROCHA | maq_price 1390 (bug bridge antiguo) |

**Decisión pendiente**: si el negocio realmente facturó esos montos al SAT, hay que capturar manualmente en CobranzaFlow. Si fueron tests/errores, liberar el folio.

### Deuda técnica documentada (NO atacada en v10.46.5)

- **B3 — RLS allow_all en orders/client_products/stock_movements/purchase_orders**: las policies actuales (`qual=true, with_check=true`) permiten UPDATE/DELETE directo a cualquier user con anon key, bypassing RPCs. El frontend tiene 25+ `supabase.from("orders").update()` directos → refactor masivo para encerrar todo via RPCs. Riesgo de seguridad real pero requiere proyecto separado.
- **B5 — EXECUTE GRANT abierto en stock RPCs**: `record_stock_movement` puede ser llamada directamente por anon (inyectar stock arbitrario). Frontend depende de la llamada directa para AdjustStockModal.

Ambos requieren v10.47.x o mayor con refactor a "Postgres functions all the way".


## v10.46.4 — Fixes 🟡 menores pendientes — 26-may-2026

- **Botón legacy "📦 Cargar a Stock"** ahora muestra etiqueta `(legacy)` y tooltip explicando que es para órdenes pre-v10.46. Para órdenes nuevas, Karla usa la 3ra opción en Asignar Folio.
- **Number() defense** en `prod.stock_actual` en InvoiceModal preview (selector y confirming view), por si backend retorna como string.
- **`aria-label`** en el `<select>` del catálogo de stock_load.
- **OrderForm**: preservar `stock_role='production'` al editar orden legacy + cambio de cliente. Antes se reseteaba sin manera de re-marcar (ya no hay checkbox); ahora si la orden tenía `stock_role` y el nuevo cliente es también Cuadra, se preserva. `client_product_id` sí se limpia (pertenece al cliente anterior).
- Aclarado en código por qué el insert al frente de `setOrders` post-sell_from_stock es correcto (created_at=now → más reciente).


## v10.46.3 — Bridge venta-desde-stock verificado + sell_from_stock setea client_id — 26-may-2026

Marcelo pidió corroborar que el bridge PrintFlow → CobranzaFlow funcione cuando se asigna folio fiscal (D-XXXX / R-XXXX) a una venta desde stock.

### Test end-to-end (transaccional + cleanup)

Probado con 3 escenarios reales contra Manufacturera de Botas Cuadra:
- **Factura D-99997** ($500 subtotal → $580 con IVA) → `cobranza.invoices` con `amount=580`, `balance=580`, `status='pendiente'`, `source='printflow_bridge'`, `source_order_id` linkado, `client_id` resuelto a Cuadra ✓
- **Remisión R-99997** ($600 subtotal sin IVA) → invoice con `amount=600` (sin IVA aplicado) ✓
- **client_id en orden**: ANTES quedaba NULL (el bridge dependía de `cobranza.resolve_client(NEW.client)` por nombre). DESPUÉS del fix: la orden ya viene con `client_id` correcto.

Todos los datos de test borrados (queda solo audit_log que es append-only por diseño).

### Fix

- **`sell_from_stock` ahora setea `client_id` en la orden** (defensa en profundidad). El bridge ya tenía fallback `resolve_client(NEW.client)` que funciona, pero era frágil: si el nombre del cliente cambiaba en `cobranza.clients` entre la venta y la asignación de folio, el bridge habría buscado por un nombre que ya no coincide. Con `client_id` explícito el bridge nunca tiene que adivinar.

### Confirmado funcionando

- ✅ Cliente Cuadra (`billing_mode='stock'`) NO entra rama Corona (es para `'anticipo'`)
- ✅ IVA aplicado correctamente: factura SÍ, remisión NO
- ✅ `auto_complete_purchase_order` cierra la OC cuando la venta-desde-stock recibe folio (es entrega real con factura/remisión, distinto del caso `load_order_to_stock` que el guard de v10.46.1 protege)
- ✅ `cobranza.audit_log` registra `bridge_create_invoice` con detalles del bridge
- ✅ Status='pendiente' con balance completo si Karla deja `payment_status='unpaid'` (Cuadra paga después por su flujo normal de cobranza)


## v10.46.2 — Fixes 🟠 post-scan exhaustivo v10.46.0 — 26-may-2026

Atacados los 6 🟠 mayores y 2 🟡 menores que quedaron pendientes después de v10.46.1.

### Backend

- **`sell_from_stock` valida `billing_mode='stock'`** (defensa en profundidad, consistente con `load_order_to_stock`). Si un cliente cambia de stock→normal/anticipo con productos pendientes en catálogo, la RPC lo rechaza con mensaje claro en lugar de crear una venta-desde-stock huérfana.
- **`record_stock_movement` y `sell_from_stock` pinean `SET search_path`** → cierra los advisor warnings `function_search_path_mutable` (defensa anti-search-path-injection en `SECURITY DEFINER`).

### Frontend — InvoiceModal stock_load

- **`stockLoadValid` ahora verifica que `cuadraSKU` siga existiendo en `cuadraProducts`** y que `quantity > 0`. Si el catálogo se refrescó después de seleccionar SKU y el SKU ya no está, el botón Continuar se deshabilita en lugar de fallar en backend.
- **Refresh de `billing_mode` antes de confirmar stock_load** (consistente con Corona). Si el cliente cambió de modo entre montar el modal y confirmar, muestra alerta y bloquea — UX mejor que el error feo de la RPC.

### Frontend — InventoryModal

- **Historial: filtro accent-insensitive** (`norm()` con NFD + lowercase). Buscar "Dipticos" ahora encuentra "Dípticos". Consistente con `OrderForm.normForSearch`.
- **Historial: error de carga visible**. `loadCuadraOrdersHistory().catch` ya no silencia: muestra `showToast` de error. Antes el tab se veía vacío sin pista del fallo.
- **`o.price !== null` en cards de Historial** permite mostrar ventas de $0 (regalos/cortesía/muestras). Antes `o.price &&` ocultaba $0 truthy-falsy.

### Frontend — Catálogo (soft-delete)

- **`deleteClientProduct` ahora es soft-delete** (`UPDATE active=false`) en lugar de DELETE. El FK `stock_movements.client_product_id` es `ON DELETE RESTRICT` (correctamente, preserva auditoría), así que DELETE fallaba para cualquier producto que tuvo movimientos pasados aunque `stock=0` hoy. El soft-delete oculta el SKU del catálogo y de selectores (porque `loadClientProducts` filtra `.eq("active",true)`) sin destruir el histórico de movimientos.

### Pendientes / aceptados

- 🟡 Botón legacy "📦 Cargar a Stock" en Empaque/Salidas: sigue funcionando solo para órdenes legacy con `stock_role='production'`; órdenes nuevas no lo necesitan. No requiere fix.
- 🟡 Editar orden Cuadra legacy + cambio de cliente resetea `stock_role` sin manera de re-marcar (preexistente, edge case raro).
- 🟡 `setOrders` insert al frente puede desordenar lista brevemente — el reload restablece. Aceptable.


## v10.46.1 — Fixes 🔴 post-scan exhaustivo v10.46.0 — 26-may-2026

Scan inmediato detectó 3 críticos. Atacados.

### 🔴 #1 — Trigger `auto_complete_purchase_order` cerraba OC al cargar a stock

Bug preexistente (desde v10.42) pero ahora crítico porque carga-a-stock es el flujo default de Cuadra. Cuando una OC tenía múltiples órdenes y al menos una se cargaba a stock (stage=`delivered`, `stock_loaded=true`, sin `invoice_folio`), si las demás se entregaban realmente la OC se marcaba `completed` incluyendo la stock — pero esa orden no se entregó al cliente, se desvió a inventario.

**Fix (migración DB)**: dos guards en `auto_complete_purchase_order`:
1. Si la orden actual es `stock_loaded=true` y sin folio → return early (no procesar cierre).
2. Antes de cerrar la OC, validar que al menos UNA orden de la OC haya sido **entrega real** (delivered/maq_delivered con folio O sin `stock_loaded=true`). Si todas las "terminales" son stock o canceladas, la OC sigue abierta.

Auditoría histórica: **0 OCs afectadas** retroactivamente (la combinación no se había producido aún en órdenes existentes).

### 🔴 #2 — `cuadraSKU` no sincronizaba con updates de `order.client_product_id`

`useState(order?.client_product_id||"")` solo se evalúa al montar. Si Lupita pre-asignó SKU en OrderForm y la orden se hidrataba después del primer render del InvoiceModal (caso: Realtime trayendo el campo), el SKU pre-asignado se perdía y Karla tenía que re-seleccionarlo.

**Fix**: `useEffect` sincroniza cuando `order.client_product_id` cambia.

### 🟠 #3 — Race `setOrders` insert vs Realtime al vender desde stock

`onOpenInvoice` hacía `[order,...p]` solo si la orden no existía; si Realtime ya la había insertado, descartaba la versión RPC. El `setInvoiceModal(order)` siguiente usaba la versión RPC stale aunque el state tuviera una más fresca.

**Fix**: si existe en el array, hacer merge `{...order, ...exists}` (datos del array tienen prioridad porque incluyen actualizaciones de Realtime). Si no, agregar al frente.

### Pendientes (no críticos)

- `sell_from_stock` defensa: validar `billing_mode='stock'` server-side
- `stockLoadValid` debe verificar que `cuadraSKU` exista en `cuadraProducts` actual
- Stock_load permite `quantity=0` (movimiento PRODUCED con 0 piezas)
- Historial: filtro `.toLowerCase().includes()` sin `.normalize("NFD")` (no encuentra acentos)
- FK `stock_movements.client_product_id` es RESTRICT → botón 🗑️ falla con productos que tuvieron movimientos (UX confusa)
- InvoiceModal Cuadra no refresca billing_mode pre-confirm (defensa)

Estos van en v10.46.2 si se priorizan.


## v10.46.0 — Cuadra: 5 mejoras de flujo (3ra opción en InvoiceModal, inventario flexible, historial) — 26-may-2026

Marcelo: "modal de venta no es muy intuitivo; quiero más flexible que Lupita no decida si va a stock, que Karla siempre vea las 3 opciones al final, similar al patrón Corona/Modelo".

### 1. Modal venta auto-abre InvoiceModal

Cuando Karla vende desde el InventoryModal (📦 → 🛒 Vender), `sell_from_stock` retorna la orden completa. Ahora, en lugar de solo mostrar toast y cerrar, se **abre automáticamente el InvoiceModal** sobre esa orden para que Karla elija Factura/Remisión sin tener que ir al kanban y abrirlo manualmente.

### 2. InvoiceModal con 3ra opción "📦 Sin factura · Stock" (Cuadra)

Patrón consistente con Corona (que tiene 3er botón "💰 Aplicar saldo"). Para clientes con `billing_mode='stock'`:

- **📄 Factura** — flujo normal
- **📋 Remisión** — flujo normal
- **📦 Sin factura · Stock** — *nueva*: marca orden entregada sin folio fiscal y suma `quantity` al inventario del cliente Cuadra (SKU seleccionado)

Al elegir "Sin factura · Stock", aparece selector del catálogo del cliente + preview de stock actual / +qty / stock después. Confirmar dispara la nueva RPC `load_order_to_stock` (security definer, FOR UPDATE en orden, idempotente, valida que sea cliente stock y que el SKU pertenezca al mismo cliente; rechaza órdenes con `stock_role='sale'`).

### 3. OrderForm: quitado checkbox "Producción a stock"

Lupita ya no decide al crear la orden si va a stock o no. El panel de Cuadra muestra solo un **dropdown opcional** de catálogo (pre-link de SKU si lo sabe). Toda la decisión se difiere a Karla al final, en InvoiceModal.

- Texto explicativo: *"No decidas aquí — Karla verá 3 opciones al final"*
- Replicar de orden anterior ya NO copia `stock_role` (solo `client_product_id` si el cliente actual es Cuadra)
- Botón legacy "📦 Cargar a Stock" en Empaque/Salidas sigue visible solo para órdenes legacy que ya tienen `stock_role='production'` (no se mostrará en órdenes nuevas porque ya no se setea)

### 4. ProductFormModal: quitado campo "Precio unitario"

Casi no se usaba. El precio real se captura en SellFromStockModal (donde sí es relevante por venta).

### 5. InventoryModal: eliminar productos vacíos + tab Historial

- Botón 🗑️ en cards de producto **solo si `stock_actual===0`** (no se permite eliminar producto con stock). Confirm + `db.deleteClientProduct`. Útil para limpiar productos creados por error.
- Nuevo tab **📚 Historial** con últimas 80 órdenes Cuadra (`stock_role IN ('production','sale')`), búsqueda por cliente/folio/producto, badges visuales para distinguir producción↔venta.

### Backend

- `load_order_to_stock(p_order_id, p_client_product_id, p_user)` — RPC nueva, SECURITY DEFINER, en `public`. Idempotente, valida billing_mode='stock', rechaza `stock_role='sale'` (no se puede re-cargar venta). Registra movimiento PRODUCED.
- Sin cambios de schema; solo nueva RPC.

### Archivos

- `src/App.jsx`: `db.loadOrderToStock`, `db.deleteClientProduct`, `db.loadCuadraOrdersHistory`; `InvoiceModal` (3er botón + selector + preview + confirming view); App raíz (onConfirm para stock_load + `onOpenInvoice` callback en InventoryModal); `OrderForm` (quitado checkbox, simplificado replicate); `ProductFormModal` (quitado unit_price input); `InventoryModal` (delete button + history tab + auto-open invoice).


## v10.45.1 — Fixes post-scan exhaustivo de v10.45.0 — 26-may-2026

Scan inmediato post-deploy detectó 1 🔴 + 3 🟠 reales en `ReplicateFromOrderModal`. Aplicados.

### 🔴 #1 — Comodines LIKE sin escapar en query por nombre

`.ilike("client", clientName.trim() + "%")` sin escapar `%`, `_`, `\`. Si un cliente se llama `"ABC%Corp"` o `"VENTA_FACTURA"`, el LIKE produce matches inesperados (ABCXYZCorp, VENTAFACTURA, etc.).

**Fix**: escapar antes de concatenar:
```js
const escaped = clientName.trim().replace(/[%_\\]/g, m => "\\" + m);
q = q.ilike("client", escaped + "%");
```

### 🟠 #2 — DOM manipulation pelea con React

El `onError` del thumbnail manipulaba `parentElement.innerHTML` directamente — anti-patrón que puede pelear con re-renders y no soporta inline styles bien.

**Fix**: estado React `failedImgs:Set<orderId>`. Al fallar imagen, se agrega al set; render condicional muestra emoji 📋 fallback. Sin manipulación de DOM.

### 🟠 #3 — Replicación inconsistente de stock_role a cliente normal

Si Lupita replicaba una orden de Cuadra (`stock_role='production'`, `client_product_id=X`) a un cliente NO-Cuadra, los campos quedaban set en el form pero el panel verde "Cliente con Inventario" no aparecía (porque billing_mode del cliente actual es 'normal'). Estado fantasma — la orden se guardaba con `stock_role` válido pero el cliente no podía soportarlo.

**Fix**: `stock_role` y `client_product_id` solo se replican si **el cliente actual tiene `billing_mode='stock'`**. Si el source tiene `stock_role='sale'` (venta desde stock), tampoco se replica (caso especial que no se quiere copiar).

### 🟠 #4 — Double-click duplicaba acción

Si Lupita hacía doble click rápido en una card, `onReplicate` se llamaba 2 veces — doble setF + doble toast.

**Fix**: flag `replicating` en el modal. Al primer click bloquea siguientes hasta que el modal cierre. Cards muestran `cursor:wait` + `opacity:0.6` mientras se procesa.

### Mejora menor

- Limit de query subido de 60 a **100 órdenes** para clientes con mucho histórico (Cuadra recurrentes podrían tener más de 60 en el tiempo).


## v10.45.0 — "Replicar de orden anterior" — modal con thumbnail + detalles — 26-may-2026

Marcelo: "que se abra un modal donde se pueda escoger una orden pasada, con imágenes y detalles para distinguir". Útil para clientes recurrentes (Cuadra y otros) — no tener que volver a capturar specs cada vez.

### UX

- Al crear una nueva orden, después de escribir/seleccionar cliente, aparece un banner azul claro: *"💡 ¿Pedido recurrente? Usa una orden anterior como plantilla."* con botón **"🔁 Replicar de orden anterior"**.
- Click → abre modal con la lista de las últimas 60 órdenes del mismo cliente.
- Cada orden se muestra como card grid 2-col con:
  - **Thumbnail** (imagen del producto si tiene `image_url`/`image_url_2`/`image`/`file_url`), fallback emoji 📋
  - P-XXXX + folio fiscal (si tiene) + badges (📦 stock / CANCELADA / ✓ entregada)
  - **Nombre del producto** en negro
  - Tipo de producto · cantidad
  - Papel + gramaje · medidas · tintas
  - Precio + fecha de creación
- Búsqueda en vivo: P-XXXX, producto, tipo, papel, folio fiscal (accent-insensitive)
- Click en card → replica datos + cierra modal

### Qué se replica

Producto, tipo, cantidad, papel, gramaje, medidas (ancho × alto), tamaño estándar, tintas (front + back), acabados, precio, horas estimadas, maquila (proveedor/costo/precio), pantones, notas, imágenes, stock_role, producto del catálogo (si aplica).

### Qué NO se replica

- Datos del cliente (ya estaban capturados antes)
- Production number P-XXXX (se asigna al guardar nueva)
- Fecha de entrega (se debe capturar nueva)
- Stage / status
- billing_mode (heredado del cliente actual)

### Alcance

- Universal — funciona para CUALQUIER cliente, no solo Cuadra
- Solo en modo "crear nueva orden" (no en edit)
- Oculto para roles operativos (preprensa, producción, germán)
- Si el cliente no tiene órdenes pasadas: el modal muestra mensaje amigable explicando

### Implementación

- Nuevo componente `ReplicateFromOrderModal` (función ~L1847)
- Query directa a `public.orders` filtrada por `client_id` (o `client` name si no hay id) con `limit 60` ordenadas por `created_at DESC`
- `applyReplicate` setea el state del form con `setF(prev => ...)` solo en campos no vacíos
- Pasa por el handler global onWheel-blur (v10.43.29) en cualquier input numérico del modal


## v10.44.0 — Hardening de seguridad: limpieza de backups + RLS telegram_log — 26-may-2026

El advisor de seguridad de Supabase detectó 6 ERRORES reales (+ 2 intencionales). Esta versión cierra los 6 reales.

### Cambios (solo BD, sin frontend)

**Migración `v44_drop_pre_cleanup_backups`**
- Borradas 5 tablas de respaldo `*_pre_cleanup_2026_05_12` (orders, purchase_orders, order_timeline, order_comments, notifications) que quedaron en `public` sin RLS tras el cleanup del 12-may.
- Verificación defensiva previa: confirma que las tablas reales tienen datos antes de borrar.

Counts pre-DROP (real vs backup):
| Tabla | Real | Backup |
|---|---|---|
| orders | 78 | 15 |
| purchase_orders | 75 | 9 |
| order_timeline | 757 | 30 |
| order_comments | 18 | 1 |
| notifications | 1063 | 69 |

Las reales tienen más datos → operación normal continuó sana 2 semanas → backups ya no aportan.

**Migración `v44_telegram_log_rls`**
- RLS activado en `public.telegram_log` (contenía `chat_id` del equipo sin protección).
- Política `USING(false)`: sin acceso directo vía PostgREST. El trigger `trigger_telegram_notify` (SECURITY DEFINER verificado vía `pg_proc.prosecdef=true`) sigue insertando sin problema.

### Sin tocar (intencional)

- Views `cobranza.payments_report_v` y `cobranza.vouchers_audit_v` (SECURITY DEFINER a propósito para cruce cross-schema). El advisor los marca como ERROR pero es el patrón diseñado.

### Resultado

Advisor de seguridad: **8 ERRORES → 2 ERRORES** (los 2 restantes son intencionales y documentados).

### Test funcional pendiente

Disparar una notificación Telegram desde PrintFlow (ej. crear orden de prueba o cambiar stage) y confirmar que el mensaje llega al bot `@SygmaPrintFlowBot`. Si llega → RLS no rompió nada. Si no → revertir `v44_telegram_log_rls`.


## v10.43.32 — Defensive guards post-scan exhaustivo — 26-may-2026

Scan exhaustivo post-v10.43.31 encontró 3 hallazgos del agente Explore — verificación profunda determinó que los 3 son **falsos positivos** (las protecciones ya existían). Aun así, aplico 2 guards explícitos por buena práctica y claridad de intent:

### Fix 1 — Action handler `deliver_with_invoice` con guards explícitos

Antes solo validaba `production_number`. La protección real de stage/folio venía del botón en `OCard` (L4478/L4483 condicionado a `stage in (salidas, maq_received) && !invoice_folio`). Ahora el handler también valida explícitamente:

```js
if(o.invoice_folio){showToast("❌ Esta orden ya tiene folio "+o.invoice_folio+" asignado.","error");return}
if(!["salidas","maq_received"].includes(o.stage)){showToast("❌ Esta orden no está en stage de salida...","error");return}
```

Defensa contra invocaciones programáticas, atajos de teclado o cualquier path que bypassee el botón.

### Fix 2 — `isSharedGroup` excluye Corona OC explícitamente

Si una Corona OC (`isCoronaOC=true`) aparece en un grupo de folios duplicados, el código original ya rechazaba "shared" porque la Corona tiene `purchase_order_id=null`. Pero hacerlo explícito clarifica la intención:

```js
if(group.some(g=>g.isCoronaOC))return false;  // Corona OC nunca es "shared folio"
```

### Skip — `cancelled_at` cosmético

El agente reportó que las Corona OC canceladas mostraban fecha de emisión en lugar de cancelación. Verificación: el campo solo se usa como **boolean truthy** para mostrar el badge "CANCELADA". La fecha visible al usuario es `invoiced_at` (correcta). No es bug funcional.

### Verificación final de integridad DB (vía MCP Supabase)

| Check | Resultado |
|---|---|
| Duplicados de folio (orders ↔ Corona OC) | 0 ✅ |
| Ledger entries huérfanos | 0 ✅ |
| Invoices Corona sin DEPOSITO | 0 ✅ |
| Órdenes Corona delivered sin CONSUMO | 0 ✅ |
| Counters consistentes (factura=5851, remisión=1205, oc=81) | ✅ |
| Saldo Cervecería (post-P-3508) | $10,270 sin IVA ✅ |

Cero bugs reales en flow Corona end-to-end.


## v10.43.31 — Fix UX: modales sin scroll cuando contenido excede viewport — 26-may-2026

Marcelo reportó: al asignar folio fiscal, seleccionar "pagada" + "transferencia" expande el PaymentStatusPicker con el campo de referencia bancaria. El botón "Continuar" queda fuera de pantalla y el modal NO scrollea — tuvo que hacer Ctrl+− para verlo.

### Causa

PrintFlow no tiene un componente `<Modal>` compartido (a diferencia de CobranzaFlow). Cada modal es un `<div>` inline. Los contenedores internos usan `padding:24,maxWidth:NNN,width:"X%"}` sin `maxHeight` ni `overflowY` → cuando el contenido excede ~90vh, el contenido inferior queda inaccesible.

### Fix

Reemplazo masivo defensivo: a todos los modales con el patrón `borderRadius:20,padding:24,maxWidth:NNN,width:"X%"}` les agrego `maxHeight:"90vh",overflowY:"auto"`. Cubre **15+ modales**:

- ✅ `InvoiceModal` (reportado por Marcelo)
- ✅ `CancelInvoicedModal` (NC con razones)
- ✅ `PreInvoiceModal` warning incompleto
- ✅ `RevertModal`, `WebRejectModal`, calendar edit modal
- ✅ Confirmaciones, toasts, picker modals

El overflow:auto no afecta visualmente los modales pequeños (solo se activa si el contenido excede 90vh). Los modales que ya tenían `maxHeight` no se tocan.

### CobranzaFlow

Sin cambios — usa `<Modal>` genérico (~L456) que YA aplica `maxHeight:'85vh',overflowY:'auto'` por default a todos los modales. Ya estaba protegido.


## v10.43.30 — Auditoría incluye OCs a Crédito Corona (fix gap falsos) — 25-may-2026

Marcelo: "¿las OCs a Crédito Corona se guardan también en auditoría y en todos los apartados donde deben ir?".

Scan completo de visibilidad de folios D-/R-XXXX en ambas apps:

| Vista | Veía Corona OC? |
|---|---|
| 🔴 PrintFlow `AuditoriaView` (folios fiscales) | **NO** — falsos gaps |
| ✅ CobranzaFlow `DashboardView` | Sí (lee `cobranza.invoices` directo) |
| ✅ CobranzaFlow `InvoicesView` | Sí |
| ✅ CobranzaFlow `AgingDetailModal` | Sí |
| ✅ CobranzaFlow `VouchersAuditView` | N/A (es para VC-, no D-/R-) |

### Causa raíz

`AuditoriaView` solo leía `public.orders.invoice_folio`. Las OC a Crédito Corona se registran vía `credit_deposit` → entran a `cobranza.invoices` con `source='corona_oc_credit'` pero **NO crean entrada en `public.orders`**. Resultado: cualquier folio D-/R- de OC a Crédito aparecía como **GAP falso** en la secuencia, provocando alertas de incumplimiento.

### Fix DB

Nueva RPC `list_corona_oc_invoices(p_doc_type, p_start_date, p_end_date)` que retorna las invoices `corona_oc_credit` en un formato apto para mergear con `orders`:
- `invoice_id`, `doc_number`, `doc_type`, `amount_with_iva`, `external_po_ref`, `client_name`, `client_id`, `issued_date`, `due_date`, `status`, `created_by` (resuelto desde `audit_log`)

### Fix Frontend

`AuditoriaView` ahora:
1. Carga Corona OC en un `useEffect` aparte (depende de `type` y `cutoffs`)
2. Convierte cada Corona OC en una **pseudo-orden** con el shape de `orders` (campos extras: `isCoronaOC`, `coronaPoRef`, `coronaAmountWithIva`, `coronaInvoiceId`)
3. Mergea con las orders reales en `folioOrders` → la lógica de gap/duplicate detection funciona sin cambios
4. UI distingue Corona OC con:
   - Fondo verdoso `#10b98108`
   - Badge **🎱 OC CRÉDITO CORONA**
   - PO Corona en monospace
   - Monto con IVA en verde
   - Cursor `default` (no click — no abre detail modal porque no es orden)
5. Search incluye `coronaPoRef` (Karla puede buscar por PO Corona)
6. CSV export incluye columnas **Origen** ("OC Crédito Corona" / "Orden producción") y **Monto c/IVA**
7. Nota "Cómo interpretar" actualizada con explicación del badge

### Verificación
- ✅ Las OCs activas de Cervecería (cuando se vuelvan a registrar) aparecerán como entradas normales con badge — NO como gaps
- ✅ Si Karla emite D-5852 (orden normal) y D-5853 (OC Crédito), ambos cuentan en la secuencia → cero gaps falsos
- ✅ Si se duplica un folio (orden normal + Corona OC con mismo D-XXXX), el detector de duplicados lo señala (no debería suceder por trigger, pero defensivo)


## v10.43.29 — Handler global onWheel-blur para TODOS los inputs numéricos — 25-may-2026

Marcelo: "asegúrate de que no haya ninguno scroll-sensitive, hay en crear orden de producción y posiblemente en más lados".

En vez de ir agregando `onWheel={e=>e.target.blur()}` a cada uno de los 19 inputs `type="number"` (precio, cantidad, ancho, alto, gramaje, peso, etc.), agregué un único handler global en el componente raíz `PrintFlow`:

```js
useEffect(() => {
  const onWheel = (e) => {
    const el = document.activeElement;
    if (el && el.tagName === "INPUT" && el.type === "number") el.blur();
  };
  document.addEventListener("wheel", onWheel, { passive: true });
  return () => document.removeEventListener("wheel", onWheel);
}, []);
```

### Cómo funciona

Cualquier `<input type="number">` que esté enfocado pierde el foco al instante que el usuario rola la rueda del mouse → el browser no incrementa/decrementa el valor. La página sigue scrolleándose normalmente.

### Inputs cubiertos automáticamente (19 totales en PrintFlow)

Crear/editar orden: precio, cantidad, ancho, alto, gramaje, horas estimadas, costo maquila, precio maquila · `MaqModal`: monto maquila · `WasteModal`: pliegos merma · `MaintModal`: monto · `InvoiceModal/PreInvoiceModal`: monto parcial · `RegisterCoronaPOModal`: subtotal · etc.

Cero código por input. Cualquier `<input type="number">` futuro también queda cubierto sin tocar nada.


## v10.43.28 — RegisterCoronaPOModal: sugerencia de folio + scroll-blur en subtotal — 25-may-2026

Karla pidió dos mejoras al modal "🎱 Registrar OC a Crédito":

1. **Folio fiscal con sugerencia**: ahora muestra botón "→ Usar D-XXXX" (mismo patrón que `InvoiceModal` al asignar folio en órdenes). Carga sugerencia de `invoice_counters` al montar. Si Karla escribe un folio menor al sugerido, aparece warning ámbar "⚠️ Este folio es menor al último registrado" (no bloquea — permite registrar folios menores en huecos retroactivos).

2. **Subtotal sin scroll-sensitive**: `<input type="number">` aceptaba cambios al hacer scroll con la rueda del mouse (error humano frecuente). Ahora `onWheel={e=>e.target.blur()}` desenfoca el campo al scrollear, evitando cambios accidentales.

Sin cambio de lógica de submit ni RPC.


## v10.43.27 — Scan exhaustivo post-v10.43.26: 1 🔴 DB + 1 🔴 + 2 🟠 + 3 🟡 frontend — 25-may-2026

Hallazgos del scan post-migración sin-IVA. Todos arreglados.

### 🔴 A1 — `sync_post_invoice_edit` rama Corona ajustaba ledger CON IVA

Si admin editaba el precio de una orden Corona ya facturada, el trigger calculaba `v_diff = v_new_amount - v_old_amount` (con IVA) y aplicaba `credit_adjust(-v_diff)` al ledger — desfasando el saldo en 16% por cada edición.

**Fix DB**: nueva variable `v_ledger_diff = v_base_amount - v_old_base_amount` (subtotal sin IVA). `credit_adjust` se llama con `-v_ledger_diff`. La invoice y el payment en cobranza siguen actualizándose con el monto con IVA (`v_diff`). Audit log distingue `amount_diff_with_iva` vs `ledger_diff_no_iva`.

### 🔴 A2 — Toast "Aplicar saldo" mostraba siempre $0

Tras v10.43.26 el RPC `apply_credit_no_folio` retorna `subtotal_no_iva` + `equivalent_with_iva`, no `amount_with_iva`. El toast en App.jsx:9060 leía `result?.amount_with_iva` → undefined → fallback `||0` → siempre $0. Karla no veía el monto descontado.

**Fix**: usar `result.subtotal_no_iva` + sufijo "sin IVA" en el mensaje del timeline.

### 🟠 A3 / A4 — Previews "Saldo después" en InvoiceModal/PreInvoiceModal desfasaban 16%

El cálculo era `current_balance - totalDisplay` (con IVA), pero el bridge descuenta `orderBaseAmount` (sin IVA) desde v10.43.26. Usuario veía un saldo final 16% más bajo del real. Falsa alarma de descubierto.

**Fix**: cambiar a `current_balance - orderBaseAmount`. Labels actualizados: "Saldo actual (sin IVA)", "Esta orden (subtotal)", "Saldo después". Línea informativa adicional con monto en cobranza: "Cobranza: factura D-XXXX por $Y con IVA — automáticamente pagada con saldo".

### 🟡 A5 — Labels ambiguos en CoronaModal y RegisterCoronaPOModal

"Saldo actual: $X" sin indicar unidad post-migración. Añadido sufijo "(sin IVA)" + línea pequeña "≈ $Y con IVA" para mostrar equivalencia.

### Verificado sin bug
- ✅ `credit_reverse` / `credit_reverse_by_order`: el opuesto del CONSUMO (ya en sin IVA) → reversa correcta
- ✅ `client_credit_balance`: agrega SUM del ledger → siempre sin IVA post-migración
- ✅ `sync_cancellation_to_cobranza`: cancela invoice + dispara reverse correcto
- ✅ Bridges normales (no-Corona): intactos


## v10.43.26 — Ledger Corona en SIN IVA (semántica de subtotal) — 25-may-2026

Karla pidió que el saldo a favor interno se lleve en subtotal sin IVA, porque ese es el número que negocian con Cervecería en las POs. La cobranza.invoices sigue con IVA (lo que se cobra). v10.43.12 había forzado captura CON IVA — esto reactiva el modelo sin-IVA original con conversión automática.

### Modelo de datos

| Lugar | Unidad | Quién lo ve |
|---|---|---|
| `client_credit_ledger.monto` y `balance_despues` | **sin IVA** | Karla, Marcelo, modal Corona |
| `cobranza.invoices.amount` (OC a Crédito) | **con IVA** (subtotal × 1.16) | Lucero / Tesorería cobra esto |
| `cobranza.payments.amount` (saldo a favor aplicado) | **con IVA** | Cuadra con cobranza.invoices |

### RPCs migrados

**`credit_deposit(client, po_ref, folio, subtotal_no_iva, due_date, user, notas)`**
- Param renombrado: `p_amount_with_iva` → `p_subtotal_no_iva`
- Calcula internamente `amount_with_iva = ROUND(subtotal × 1.16, 2)` para insertar en cobranza.invoices
- Ledger guarda el subtotal sin IVA
- Notificación a tesorería muestra ambos: "subtotal $X (con IVA $X×1.16)"

**`apply_credit_no_folio(order_id, user, notes)`**
- Descuenta `price` (subtotal sin IVA) del ledger, no `price × 1.16`
- Audit incluye ambos montos para trazabilidad
- Sin cambios para el cliente: la orden sigue marcándose `delivered` sin folio fiscal

**`sync_invoice_from_orders` rama Corona** (folio individual D-XXXX a una orden)
- `cobranza.invoices.amount` = subtotal × 1.16 (sin cambio — lo que se cobra)
- `cobranza.payments.amount` = subtotal × 1.16 (sin cambio — lo que se "paga" con saldo)
- `credit_consume.p_monto` = subtotal sin IVA (cambio: antes pasaba el con-IVA)
- Cuadra contablemente: $X subtotal se descuenta del saldo a favor (sin IVA), $X×1.16 se "paga" en cobranza

**`sync_invoice_from_oc` rama Corona** (folio compartido en una OC)
- Mismo patrón: consume subtotal del ledger, paga total con IVA en cobranza

### Frontend

**PrintFlow `RegisterCoronaPOModal`** (`🎱 + Nueva OC a Crédito`)
- Label: "Monto total CON IVA" → **"Subtotal SIN IVA"**
- Placeholder: "348000.00 (IVA ya incluido)" → "300000.00 (el sistema agrega IVA)"
- Preview: ahora muestra 3 columnas → **Subtotal (ledger)** · **+ IVA 16%** · **Total cobranza**
- `db.creditDeposit` pasa `subtotal_no_iva` en lugar de `amount_with_iva`

**CobranzaFlow `CreditDepositModal`**
- Mismo cambio de label/placeholder/preview
- `sb.rpc('credit_deposit')` pasa `p_subtotal_no_iva` en lugar de `p_amount_with_iva`
- Toast muestra ambos montos: subtotal + total con IVA

### Migración de datos

- Cervecería Modelo: AJUSTE +$185,925.26 (con IVA, aplicado en v10.43.25) → reemplazado por AJUSTE +$160,280.40 (sin IVA)
- Después de aplicar P-3508 ($150,010 subtotal) → saldo final esperado: **$10,270.40** (lo que Karla pidió)

### Por qué importa

Ahora cuando Karla capture una OC de Corona de "$300k subtotal", verá $300k en el saldo y Lucero verá $348k en cobranza — los dos números familiares para cada uno, sin conversiones mentales.


## v10.43.25 — Fusión GRUPO MODELO ↔ CERVECERIA MODELO DE MEXICO — 25-may-2026

Marcelo: "son lo mismo". Karla necesita poder meter órdenes de Grupo Modelo en OCs de Cervecería y viceversa. Solución elegida: fusionar a un solo cliente canónico (Cervecería Modelo, tiene RFC AMH080702RMA). Grupo Modelo queda como alias permanente.

### Mecanismo: columna `merged_into`

Nueva columna en `cobranza.clients`:
```sql
ALTER TABLE cobranza.clients
  ADD COLUMN merged_into UUID REFERENCES cobranza.clients(id);
```

Si está set, el cliente es alias del referenciado. Los RPCs siguen el puntero automáticamente. Los selectores (typeahead, listas) lo excluyen. El cliente NO se borra — preserva historial y captura redirecciones futuras.

### Migración de datos (todo en una transacción)

| Tabla | Cambio | Filas |
|---|---|---|
| `public.orders` | `client_id` + `client` text → Cervecería | 1 (P-3508) |
| `public.purchase_orders` | `client_id` + `client` text → Cervecería | 3 (OC-15, OC-5, OC-1) |
| `cobranza.invoices` | `client_id` → Cervecería | 1 (D-5833) |
| `cobranza.client_credit_ledger` | `client_id` → Cervecería | 1 entrada DEPOSITO |
| `cobranza.client_credit_ledger` | recalcular `balance_despues` cronológicamente | 2 entradas |
| `cobranza.clients` | Grupo Modelo: `merged_into` set + `billing_mode='normal'` | 1 |
| `cobranza.audit_log` | entry `client_merged` con detalle de fusión | 1 |

Saldo consolidado: $600,000 al momento de la fusión (después subió a $750k con una OC adicional registrada post-fusión).

### RPCs actualizados (siguen `merged_into`)

| RPC | Cambio |
|---|---|
| `get_client_billing_info(uuid, text)` | Si el match (por id o nombre) tiene `merged_into`, sigue al canónico antes de devolver billing_mode + balance. También: DROP de firma vieja `(uuid)` que quedó duplicada después de v10.43.24 → causaba "function not unique" |
| `list_anticipo_clients()` | `WHERE merged_into IS NULL` — no lista clientes fusionados |
| `upsert_client_from_order(p_name, ...)` | Si Lupita escribe "Grupo Modelo", el match resuelve al canónico Cervecería. Audit log marca `resolved_via_merge: true` |
| `search_clients_typeahead(p_query)` | `WHERE merged_into IS NULL` — typeahead no sugiere fusionados |

### Verificación end-to-end

- Typeahead "grupo modelo" → 0 resultados ✓ (fusionado, no aparece)
- Typeahead "modelo" → solo Cervecería ✓
- `get_client_billing_info(grupo_modelo_uuid, NULL)` → redirige a Cervecería, devuelve saldo consolidado ✓
- `get_client_billing_info(NULL, 'GRUPO MODELO')` → idem por fallback de nombre ✓
- `list_anticipo_clients()` → solo Cervecería con $750k ✓

### Sin cambios de frontend

Todo el redireccionamiento sucede en DB. El frontend ya pasaba `(client_id, client_name)` desde v10.43.24 y los selectores usan los RPCs actualizados sin cambios.

**Para Karla**: P-3508 ahora muestra "CERVECERIA MODELO DE MEXICO" en lugar de "GRUPO MODELO" (consistencia post-fusión). Cualquier OC de cualquier "Modelo" comparte el mismo saldo y RFC.


## v10.43.24 — Fix botón "Aplicar saldo" oculto en órdenes preexistentes Corona — 25-may-2026

Marcelo registró OC a Crédito de Grupo Modelo ($300k). Al intentar facturar P-3508 (Grupo Modelo, $150,010, creada el 15-may), el modal "Asignar Folio Fiscal y Entregar" solo mostraba **Factura** y **Remisión** — faltaba la 3ra opción 💰 **Aplicar saldo**.

**Causa**: P-3508 tiene `client_id=NULL` porque fue creada antes de v10.43.5 (auto-upsert de cliente). El `useEffect` en InvoiceModal/PreInvoiceModal hacía early return si `!order?.client_id` → `coronaInfo` quedaba en `{billing_mode:'normal'}` por default → `isCorona=false` → 3er botón no se renderiza.

**Fix sistémico** (DB + frontend):

1. **DB**: `get_client_billing_info(p_client_id uuid, p_client_name text DEFAULT NULL)` — ahora acepta fallback por nombre. Si `client_id` no resuelve, hace match por `TRIM(UPPER(name))` (tolera trailing spaces — caso real: "GRUPO MODELO " con espacio al final).

2. **Frontend**: `db.getClientBillingInfo(clientId, clientName)` pasa el nombre como 2do parámetro. `InvoiceModal` y `PreInvoiceModal` llaman con `(order.client_id, order.client)`. El useEffect también dispara cuando cambia `order.client`.

Backfill puntual: P-3508 ya fue enlazada a Grupo Modelo (`client_id` actualizado en BD). Cualquier otra orden Corona preexistente que aparezca en el futuro funcionará gracias al fallback por nombre — no requiere intervención manual.

**Por qué no auto-link**: el RPC NO actualiza `orders.client_id`. Eso sigue siendo responsabilidad de `upsert_client_from_order` (canónico). Mantenemos separación de concerns: este RPC solo lee, no escribe.


## v10.43.23 — Fix header desfasado para admin (2da fila) — 25-may-2026

Marcelo (admin): "la UI se desfasó, ciertos elementos están en una segunda fila". Antes todo cabía en una fila; recientemente las acciones (Mis Órdenes/Todas + search + 🔔 + 📦 + 🎱 + CSV + Admin + Salir ≈ 670px) se envolvían debajo de la nav.

**Causa**: el outer `<div>` del header usaba `flexWrap:"wrap"`. Para admin, total horizontal ≈ 1452px. En monitores con scaling de Windows 125-150% (efectivo 1280-1536px), el espacio no alcanza y el browser envuelve la sección de acciones a una segunda fila — el "desfase" que Marcelo reportó. Causado por el crecimiento acumulado: 📦 (Cuadra v10.42.x) + 🎱 (Corona v10.43.x) sumaron ~72px que tiraron el layout para admin.

**Fix**: comprimir + forzar single-line:

| Cambio | Ahorro |
|---|---|
| nav buttons padding `8×14` → `7×11` | ~30px (6 botones) |
| search width `180` → `160` + `minWidth:90, flexShrink:1` | 20-90px (se comprime bajo presión) |
| 📦 / 🎱 padding `5×10` → `5×8` | ~8px |
| CSV `📥 CSV` → icono `📥` con `title="Exportar CSV"` | ~40px |
| outer `flexWrap:wrap` → `nowrap` + `minWidth:0` | fuerza single-line |
| actions section `minWidth:0, flexShrink:1` | input se comprime en vez de envolver |

Total liberado: ~100-200px. Resultado: admin vuelve a tener una sola fila aunque su scaling sea agresivo. Si la ventana es demasiado angosta, el input de búsqueda se comprime hasta 90px (sigue siendo funcional) en vez de tirar las acciones abajo.


## v10.43.22 — HOTFIX build · JSX expression no cerrada en pestaña Producción — 25-may-2026

### 🚨 Por qué Marcelo no veía los cambios desde v10.43.18

**Síntoma**: Marcelo abría Auditoría y no veía los chips, ni la búsqueda, ni los fixes de v10.43.19/20/21. Hard refresh no ayudaba.

**Causa**: El build de Vercel estaba en estado `ERROR` desde v10.43.18 (commit 5d21e65). Vercel sirvió el último deploy válido (v10.43.17) durante 4 versiones. Todo lo que se pusheó después nunca llegó al usuario.

**Error de esbuild** (deploy `dpl_8hErTDafsMUrrZyHwFXzzEQfS15h`):
```
/vercel/path0/src/App.jsx:6945:13: ERROR: Expected "}" but found "style"
6943|            })}
6944|          </div>
6945|          <div style={{marginTop:10,...
```

**Bug**: en `AuditoriaView` → pestaña **Producción** (la sección agregada en v10.43.18 con QW1 búsqueda + QW2 chips), la expresión JSX ternaria que renderiza `filteredPnSeq` quedó sin su `}` de cierre antes de la nota "Cómo interpretar":

```jsx
{filteredPnSeq.length===0?<div>...</div>:<div>...
  {filteredPnSeq.map(...)}
</div>           ← faltaba } aquí
<div>Cómo interpretar...</div>
```

**Fix**: cerrar la expresión con `</div>}` (1 carácter — el clásico). Sin esto, el parser leía el siguiente `<div style=...` como continuación del JSX previo y reventaba en el atributo `style`.

### 📌 Aprendizajes para futuros checks

Mi validador de braces detectó `brace_diff` cambió de `+3` a `+4` en v10.43.18 — lo descarté como "ruido del stripper de JSX". **No era ruido**: era el bug real. En adelante, cualquier delta del brace_diff es señal de mirar el diff con lupa, no de descartar.

También: aunque no haya `npm` local, el feedback de Vercel build logs vía MCP (`get_deployment_build_logs`) es accesible y rapidísimo — usar siempre que un deploy falle, no solo cuando el usuario reporta el síntoma.


## v10.43.21 — Chip "Sin precio" oculto para roles operativos — 25-may-2026

Marcelo: "Gerardo tiene el filtro de Sin precio, hay roles que no deben tener ciertos filtros".

El chip 💰 Sin precio aplica a quienes manejan precios (capturan o facturan). Los roles operativos de taller no necesitan ese chip — el precio no es su responsabilidad.

| Rol | Antes | Ahora |
|---|---|---|
| Producción (Gerardo) | Veía 💰 Sin precio | ❌ Oculto |
| Preprensa (Noemí) | Veía 💰 Sin precio | ❌ Oculto |
| Germán | Veía 💰 Sin precio | ❌ Oculto |
| Secretaria, Vendedor, Karla, Admin | Veían 💰 Sin precio | ✅ Sigue visible |

Los chips 🔥 Urgentes, ⏰ Retrasos, 🐢 Estancadas siguen disponibles para todos (todos los roles se benefician de priorizar urgentes y estar atentos a retrasos/estancadas).


## v10.43.20 — Fix A9 (chip Urgentes) + M15 (reset tabs Auditoría) — 25-may-2026

### 🔴 A9 — Chip "🔥 Urgentes" NUNCA filtraba (bug pre-existente desde v10.41.0)
El predicate comparaba con `"Urgente"` (capitalizado) pero la BD/PRIOS guarda `"urgente"` (lowercase). Resultado: el chip "Urgentes" en "Mis Pendientes" nunca matcheaba ninguna orden, aunque hubiera órdenes urgentes en la BD (hoy hay 9). El equipo probablemente lo notó pero no se reportó hasta el scan exhaustivo.

**Fix**: `o.priority==="urgente"` (1 carácter de cambio, ahora alineado con `PRIOS` y la columna en BD).

### 🟡 M15 — Reset de búsqueda y chip de status al cambiar de tab en Auditoría
Si el usuario activa un chip que solo existe en un tab (ej. "Duplicados" solo en Folios Fiscales) y cambia al otro tab, el chip seguía mostrándose activo pero no filtraba nada (el predicate caía al default `return true`). Confuso.

**Fix**: al cambiar de tab, reset de `search=""` y `statusChip="all"`. La búsqueda y el chip se aplican fresh por tab.


## v10.43.19 — Chips de filtro por stage para todos los roles — 25-may-2026

Marcelo: "que todos los roles puedan filtrar sus pendientes por etapas".

Antes los chips por stage solo existían para Karla, Producción, Preprensa y Admin. Lupita, Germán y vendedores solo tenían los 4 base (urgentes, retrasos, estancadas, sin precio). Ahora cada rol tiene hasta 8 chips (4 base + hasta 4 específicos).

### Nuevos chips por rol

**Secretaria (Lupita)** — antes solo 4 base, ahora 7:
- 📝 Borradores (draft + maq_created)
- 🎯 Prueba cliente (proof_client)
- 📤 En salida (salidas)

**Preprensa (Noemí)** — antes 5, ahora 7:
- 📝 Drafts (draft)
- 🎨 En diseño (design)
- 👤 Esperando cliente (proof_client) — ya estaba

**Germán** — antes solo 4 base, ahora 7:
- 🖨️ Imprimir prueba (proof_printing)
- 🛠️ CTP pendiente (ctp)
- ✅ Placas listas (placas_listas)

**Producción (Gerardo)** — antes 6, ahora 8 (máximo):
- 🖱️ Sin máquina · ⚙️ En máquina · 📥 Maquila regresó · 📦 Empaque pendiente

**Karla** — antes 7, ahora 8:
- 📤 Salidas (nuevo, además de los 3 que ya tenía)

**Vendedor** — antes solo 4 base, ahora 7 (por estado agrupado de sus órdenes):
- 🎨 En diseño (todo el bloque de preprensa)
- ⚙️ En producción (ready + in_production)
- 📤 Lista entrega (packaging + salidas)

**Admin** — antes 5, ahora 8:
- 🚚 Maquila externa (ya estaba)
- 🎯 Esperando cliente · ⚙️ En máquina · 📤 Salidas (nuevos)

Todos respetan el límite de 8 chips para evitar ruido visual. La lógica del filtro es OR entre chips activos (consistente con v10.41.0).


## v10.43.18 — Auditoría: 4 quick wins (búsqueda, chips, cross-link) — 25-may-2026

Cuatro mejoras de alto valor / bajo esfuerzo en la vista Auditoría.

### QW1 — Búsqueda en vivo por folio o cliente
Input arriba de cada tab que filtra la lista en vivo. Funciona en ambos tabs:
- Tab Folios Fiscales: busca por folio (D-XXXX/R-XXXX), nombre del cliente o número de producción.
- Tab Producción: busca por P-XXXX, cliente o folio fiscal asignado.

Busca accent-insensitive y case-insensitive. Botón ✕ para limpiar.

### QW2 — Chips de filtro por status
Chips redondos arriba de la lista para enfocar la auditoría:

**Tab Folios Fiscales:** Todos · ⚠️ Solo gaps · Duplicados · Canceladas · ⚡ Pre-asignados.
**Tab Producción:** Todos · ⚠️ Solo gaps · Canceladas · 📄 Con folio fiscal · 💰 Sin folio (saldo Corona).

Búsqueda y chips se combinan (filtro AND).

### QW3 — Click en OC asociada → saltar a vista OC
En el modal de detalle, el ID de OC interna (`OC-XXX`) ahora es un botón clicable. Al click:
- Cierra el modal.
- Navega al tab "OC" automáticamente.
- Pre-selecciona esa OC.
- Si la OC está completada/cancelada, también switch al sub-tab "Histórico".

Refactor leve en `OrdenesCompraView` para aceptar prop `pendingOCId` y consumirla en useEffect.

### QW4 — Botón "Ver en pipeline" en el modal de detalle
Footer del modal ahora tiene 2 botones:
- **📊 Ver en pipeline** → cierra modal, navega a pipeline, abre el detail modal de la orden.
- **Cerrar** → solo cierra el modal de auditoría.

Útil cuando Marcelo audita y necesita tomar acción (cancelar, editar, mover de OC) en la orden sin perder contexto.


## v10.43.17 — Auditoría: folios fiscales también clicables — 25-may-2026

Marcelo: "aplicar lo mismo a la vista de D/R — click muestra detalle de la orden".

Cada fila de folio fiscal (D-/R-) en el tab "Folios Fiscales" ahora es clicable. Reusa el mismo `ProductionOrderDetailModal` que ya existía para P-XXXX → muestra todos los detalles de la orden: cliente, producto, importes, folio fiscal, fechas, asociaciones (OC interna, cart web, MP payment), IDs internos.

- Hover muestra fondo en color `C.sf` (consistencia con el tab P-XXXX).
- En **folios compartidos** (mismo folio en N órdenes de una OC), cada fila es clicable y abre el detalle de SU orden específica.
- Filas **gap** (folios faltantes) NO son clicables (no hay orden que mostrar).


## v10.43.16 — Auditoría: tabs (Folios Fiscales | Órdenes Producción) — 25-may-2026

Marcelo: "que el consecutivo de órdenes de producción sea una sub-ventana dentro de la ventana de Auditoría, no hasta abajo".

### Cambio
- Las dos secciones (Folios Fiscales D-/R- y Órdenes de Producción P-XXXX) ahora son **tabs** con underline activo en color azul.
- Solo se muestra una sección a la vez.
- **Filtro de periodo compartido** entre ambos tabs (se sacó fuera para que aplique a los dos).
- Toggle factura/remisión y botón Exportar CSV quedan solo dentro del tab de Folios Fiscales (donde aplican).
- Tab default: Folios Fiscales (igual que antes).


## v10.43.15 — Auditoría: consecutivo de Órdenes de Producción (P-XXXX) — 25-may-2026

Marcelo: "agregar un apartado en auditoría donde pueda ver el consecutivo de órdenes de producción · click muestra detalles, en qué folio se convirtió".

### Frontend — nueva sección en `AuditoriaView`
Después de la sección actual de folios fiscales (D-/R-), se agrega una sección dedicada:

**📋 Consecutivo de Órdenes de Producción**
- **Stats**: total P-XXXX, gaps detectados, con folio fiscal, canceladas, rango (P-min → P-max).
- **Lista clicable**: cada P-XXXX como fila compacta con badges (cliente, stage, folio fiscal asignado, canceladas, maquila, web, stock Corona, etc).
- **Gaps**: filas en rojo con "FALTANTE" (órdenes borradas).
- **Reusa el filtro de fecha** de la auditoría (90d / mes actual / mes pasado / todo).
- **Filtra automáticamente** el marcador interno `[SISTEMA]`.

### Modal de detalle al click
Nuevo componente `ProductionOrderDetailModal` que muestra info completa de la orden:
- Cliente (nombre/empresa/RFC/email/whatsapp)
- Producto + cantidad + especs
- Importes (precio sin IVA, maquila costo/precio, payment_status)
- **Folio fiscal en que se convirtió** (D-/R-, tipo, pre-asignado, asignado por quién/cuándo) o nota "Sin folio fiscal asignado"
- Fechas (creada, entregada, cancelada con motivo)
- Asociaciones (OC interna, cart web, MP payment)
- Identificadores internos


## v10.43.14 — Scan post-fixes: doble cobro Corona + UX confirming — 22-may-2026

Cuatro fixes del scan exhaustivo sobre v10.43.13.

### 🔴 A7 — Doble cobro si admin revierte stage + factura individual
**Escenario:** Karla aplica "Aplicar saldo (sin folio)" → CONSUMO por order_id. Admin revierte stage a `salidas`. Karla factura individualmente con D-YYYY → bridge crea OTRO CONSUMO por invoice_id. Cliente con doble cargo.

**Fix DB:** `sync_invoice_from_orders` rama Corona detecta CONSUMO previo por `source_order_id` y llama `credit_reverse_by_order` ANTES de hacer el nuevo `credit_consume` por `source_invoice_id`. Audit log `bridge_corona_revert_prev_consume`.

### 🔴 A8 — OC compartida refacturaba orders Corona ya entregadas con saldo
**Escenario:** Karla aplica saldo a una orden Corona dentro de OC-XXXX. Más tarde asigna folio compartido a OC-XXXX → `assign_folio_to_oc` incluía esa orden delivered (sin folio) en "pendientes" → segundo cobro vía `sync_invoice_from_oc`.

**Fix DB:** `assign_folio_to_oc` ahora excluye orders en stages `delivered`, `maq_delivered`, `stocked` (además de `cancelled`/`maq_cancelled`). Solo procesa orders aún sin entregar.

### 🟡 M13 — CoronaModal no refrescaba ledger al registrar nueva OC
Si Lucero/Karla tenían un cliente seleccionado y registraban una OC, el saldo en la lista se actualizaba pero el ledger del cliente seleccionado seguía mostrando lo viejo.

**Fix:** `RegisterCoronaPOModal.onSaved` ahora también llama `db.loadCreditLedger(selectedId, 200)` y actualiza `setLedger`.

### 🟡 M14 — Confirming view engañoso para `type='no_folio'`
El preview de confirmación mostraba "Vas a asignar:" + folio vacío + "(Remisión)" para órdenes Corona aplicar-saldo. Confuso.

**Fix:** branch dedicado de confirming view cuando `isNoFolio` muestra: *"💰 Vas a aplicar: Saldo a favor (Corona)"* con desglose saldo actual / descuento con IVA / saldo después.

### 🟢 Queda como mejora post-demo
- **B10** parseFloat con comas
- **B11** UI para cancelar OC a Crédito registrada por error
- **B12** saldo en realtime
- **B13** notif a tesorería cuando saldo cruza a negativo


## v10.43.13 — Scan post-Corona-rework: A6 + M10 + M12 — 22-may-2026

Tres fixes del scan exhaustivo sobre v10.43.10–12.

### 🔴 A6 — Cancelar orden Corona con saldo aplicado NO revertía el ledger
**Bug:** Si Karla aplicó "💰 Aplicar saldo (sin folio)" a una orden y después se canceló, el CONSUMO en `client_credit_ledger` quedaba sin reversar. El saldo del cliente quedaba descontado erróneamente.

**Causa:** `sync_cancellation_to_cobranza` solo manejaba el caso con `invoice_folio`. Para órdenes sin folio (caso Corona aplicar-saldo) hacía `RETURN NEW` sin tocar el ledger.

**Fix:**
- Nueva RPC `credit_reverse_by_order(client_id, source_order_id, user)` — idempotente, busca CONSUMO ligado a la orden y lo revierte.
- UNIQUE INDEX ampliado: `credit_ledger_order_tipo_uniq` por `(source_order_id, tipo)` — cubre CONSUMO y REVERSO sin duplicados.
- `sync_cancellation_to_cobranza` extendido: si la orden cancelada no tiene folio pero SÍ tiene CONSUMO ligado por `source_order_id`, llama `credit_reverse_by_order` y registra audit_log `bridge_reverse_credit_by_order`.

### 🟡 M10 — `RegisterCoronaPOModal` usaba `alert()` nativo
**Fix:** ahora recibe `showToast` como prop y lo usa para errores. Consistente con el resto de la UI.

### 🟡 M12 — `db.creditDeposit` helper con firma vieja
Quedó desactualizado después del rework v10.43.10. Si alguien lo invocara, fallaría.

**Fix:** firma actualizada a `{client_id, external_po_ref, folio_fiscal, amount_with_iva, due_date, user, notas}`. `RegisterCoronaPOModal` ahora usa el helper en lugar de `supabase.rpc` directo (consistencia).

### 🟢 Quedan como mejoras post-demo
- **B10** parseFloat con comas (`"348,000"` → 348)
- **B11** sin UI para cancelar OC a Crédito registrada por error
- **B12** saldo no se actualiza en realtime


## v10.43.12 — Corona OC: monto con IVA directo + PO 10 dígitos — 22-may-2026

Aclaración Marcelo:
- "El folio de Corona usualmente son 10 números XXXXXXXXXX" → es el número PO del cliente (referencia interna que ellos mandan).
- "La OC a crédito se debe registrar con IVA incluido" → el monto que captura Karla/Lucero YA incluye IVA. Sin cálculo `*1.16` en el RPC.
- "Cuando la orden se pasa con 'Aplicar saldo (sin folio)' se debe calcular el IVA y se pasa a cobranzaFlow" → ya implementado en v10.43.10: `apply_credit_no_folio` calcula `precio × 1.16` y el CONSUMO va al ledger (visible en CobranzaFlow).

### Cambios DB
- `credit_deposit` ya no calcula IVA. Parámetro renombrado: `p_subtotal_no_iva` → `p_amount_with_iva`. Se inserta tal cual en `cobranza.invoices.amount/balance` y en el ledger.

### Frontend (PrintFlow + CobranzaFlow)
- Modal "Registrar OC a Crédito": campo cambió de "Subtotal sin IVA" → "Monto total CON IVA" con placeholder *"348000.00 (IVA ya incluido)"*.
- Placeholder PO Corona ahora indica formato: *"ej. 1234567890 (10 dígitos)"* (no se valida estricto el conteo — Karla puede capturar el formato que llegue).

### Nota operativa
**FELIPE CORONA ALONSO NO es CORONA / Modelo.** Es otro cliente distinto que casualmente tiene "Corona" en su nombre. Solo `GRUPO MODELO` y `CERVECERIA MODELO DE MEXICO` son del grupo Corona/Modelo elegibles para `billing_mode='anticipo'`.


## v10.43.11 — Karla/Lupita pueden registrar OC a Crédito desde PrintFlow — 22-may-2026

Marcelo: "¿Que Karlita pueda registrar OC a crédito también, ventana en PrintFlow?". Sí, recomendable: Karla es quien tiene el folio fiscal emitido y la PO Corona.

### Frontend PrintFlow
- En el `CoronaModal` (botón header 🎱), nuevo botón **"🎱 + Nueva OC a Crédito"** visible para admin, karla y secretaria.
- Sub-modal `RegisterCoronaPOModal` con mismos campos que en CobranzaFlow:
  - Cliente (anticipo activo)
  - PO Corona (ref interna del cliente)
  - Folio fiscal D- o R- (emitido)
  - Subtotal sin IVA + preview en vivo con IVA
  - Fecha programada de pago (debe ser futura)
  - Notas

### DB — `credit_deposit` notifica a tesorería
La RPC ahora inserta automáticamente notificación en `cobranza.notifications` con `target_role='tesoreria'` cada vez que se registra una OC (sin importar desde qué app). Mensaje: *"🎱 Nueva OC a Crédito registrada · {cliente} · PO {ref} · {folio} · ${monto} · vence {fecha}"*.

Lucero verá la notif al refrescar CobranzaFlow. Mantiene a tesorería informada sin requerir que aprueben.

### Por qué es recomendable
- Karla tiene el folio + PO Corona primero (ella factura).
- Mismo RPC, mismo dato: la OC se ve igual en ambas apps.
- Cero duplicación; notificación cierra el loop con tesorería.


## v10.43.10 — Corona rework: OC a Crédito con folio fiscal + sin folio en órdenes — 22-may-2026

**Cambio de modelo importante** tras aclaración de Marcelo sobre el flujo real de Corona.

### El modelo correcto
Corona NO deposita dinero al banco anticipadamente. En su lugar:
1. Corona envía una **OC a Crédito** con su propio número de referencia (ej. `MC-2026-0042`). Karla tiene acceso a ese número.
2. Sygma **factura inmediatamente** esa OC → **factura D-XXXX por monto + IVA** se emite. Va a CXC de cobranza con `due_date` futuro (típicamente 6 meses).
3. Las órdenes de producción individuales de Corona **NO llevan folio fiscal propio** (caso normal) — solo se descuentan del saldo disponible.
4. Caso especial: Karla puede facturar una orden individual con D-/R- si Corona lo pide (variable, ella decide).
5. 6+ meses después, Corona deposita el pago → aplica a la factura D-XXXX en cobranza.

### Cambios técnicos

**DB:**
- Nueva columna `cobranza.invoices.external_po_ref` para el número PO Corona.
- Nueva columna `cobranza.client_credit_ledger.source_order_id` para idempotencia de CONSUMOs sin folio.
- **`credit_deposit` rediseñada**: ahora recibe `(client_id, external_po_ref, folio_fiscal, subtotal_no_iva, due_date, user, notas)`. Crea factura en cobranza con folio + monto con IVA + due_date. Crea DEPOSITO en ledger ligado a esa factura.
- **`apply_credit_no_folio` actualizada**: monto = `precio × 1.16` (con IVA, antes era sin IVA). YA NO crea pseudo-invoice SF-NNNN; solo registra CONSUMO en ledger. Idempotente por `source_order_id`.
- Counter `consumo_directo` eliminado (ya no se usa).
- `load_credit_ledger` ampliado para devolver `external_po_ref`, `folio_fiscal`, `due_date`.

**Frontend PrintFlow:**
- `InvoiceModal` ahora muestra **3 botones** cuando el cliente es Corona:
  - 📄 Factura (D-)
  - 📋 Remisión (R-)
  - 💰 **Aplicar saldo (sin folio fiscal)** ← nuevo, llama `apply_credit_no_folio`
- El banner verde de saldo se calcula con IVA en los 3 casos.
- Karla decide caso por caso según pida Corona.

**Frontend CobranzaFlow:**
- `CreditDepositModal` rediseñado como **"Registrar OC a Crédito Corona"** con campos:
  - Cliente, PO Corona, folio fiscal, subtotal sin IVA, fecha programada de pago, notas
  - Preview en vivo: monto facturado con IVA + fecha de vencimiento
- `CreditView` muestra PO Corona y folio fiscal en cada fila del ledger (badges visuales).
- Botones renombrados a "🎱 Registrar OC a Crédito" y "🎱 Nueva OC a Crédito".


## v10.43.8 — Karla puede crear OC y mover existentes (sin crear órdenes nuevas) — 22-may-2026

Marcelo: "Dale a Karla permisos para crear órdenes de compra igual que a Lupita, y ya puede mover las existentes dentro. **No le des permisos de crear órdenes de producción.**"

### 🔒 Permisos actualizados
- `ACTION_ROLES.createOCAndMove`: `["admin","secretaria","karla"]` (antes solo admin+secretaria).
- `canCreateOC` (header "+ Nueva OC"): incluye karla.
- Nuevo `canMoveExisting`: permite a Karla (y demás roles permitidos) **MOVER órdenes existentes a OC**, pero NO crear nuevas órdenes en la OC. Separado de `canAddProductHere` que sigue restringiendo "+ Agregar Producto Nuevo" a admin/secretaria/vendedor.

### Botones que Karla ve en la vista OC (3 nuevos + 2 ya tenía)
| Botón | Antes Karla | Ahora Karla |
|---|---|---|
| `+ Nueva OC` (header) | ❌ | ✅ |
| `+ Agregar Producto Nuevo` (crea orden de producción) | ❌ | ❌ (intencional) |
| `📦 Agregar Producto Existente` | ❌ | ✅ |
| `📄 Asignar folio` | ✅ | ✅ |
| `🔒 Pre-asignar folio` | ✅ | ✅ |
| `↔️ Cambiar OC` por card | ✅ | ✅ |

Total: Karla ve **3 botones nuevos** (Nueva OC, Agregar Existente) + los que ya tenía (Asignar folio, Pre-asignar folio, Cambiar OC en cards). Sigue sin poder crear órdenes de producción nuevas (lo cual es por diseño — eso lo hacen Lupita y vendedores).

### Hint en empty state
El mensaje cuando una OC está vacía ahora se adapta al rol: Lupita ve la guía completa; Karla solo ve la opción de "Agregar Producto Existente".


## v10.43.7 — Fix urgente: folio compartido en OC funciona — 22-may-2026

**Bug raíz encontrado y corregido.** Karla intentaba asignar D-5824 (modo "Un folio compartido") a una OC con 2 órdenes pendientes y obtenía `duplicate key value violates unique constraint "idx_orders_invoice_folio_unique"`.

### El problema
El `UNIQUE INDEX idx_orders_invoice_folio_unique` prohibía duplicados absolutos en `orders.invoice_folio`. Esto rompía el modo "Un folio compartido" porque setear el mismo folio a 2+ orders viola el constraint. Verificado: **NUNCA** ha existido en producción una OC con `shared_invoice_folio` funcionando porque el constraint siempre lo bloqueó silenciosamente. El modo shared era código aspiracional pero no funcional.

### El fix (DB)
- **Removido:** `idx_orders_invoice_folio_unique` (UNIQUE INDEX rígido).
- **Agregado:** `idx_orders_invoice_folio` (índice no-unique para performance).
- **Agregado:** trigger `trg_orders_validate_invoice_folio_uniq` que valida:
  - Misma OC → permitido compartir folio ✅
  - Otra OC distinta → bloquear
  - Una con OC y otra individual → bloquear
- **Agregado:** trigger `trg_po_validate_shared_folio_uniq` en `purchase_orders` que valida `shared_invoice_folio`:
  - Otra OC con mismo shared → bloquear
  - Existe ya como folio individual de orden fuera de esta OC → bloquear

### Resultado
- Karla puede asignar D-5824 a OC-0048 con sus 2 órdenes pendientes → ambas reciben el folio compartido sin conflicto.
- Sigue prohibido reutilizar D-5824 en otra OC o como folio individual.
- Mensajes de error explícitos en lugar del raw `duplicate key value`.


## v10.43.6 — Tercer bug scan fixes — 22-may-2026

Un alto + dos medios encontrados sobre v10.43.5.

### 🔴 A5 — `update()` actualiza `client_id` al editar cliente
**Bug:** `editableFields` no incluía `client_id`. Si admin editaba una orden cambiando el nombre del cliente, los campos `client*` se actualizaban pero `client_id` quedaba apuntando al cliente anterior → al facturar, el bridge usaba el cliente equivocado.

**Fix:**
- `editableFields` ahora incluye `client_id` (se persiste en UPDATE).
- `update()` llama `upsertClientFromOrder` si `client_id` queda NULL pero hay `client.trim()`, igual que `create()`. Resuelve el id correcto y lo guarda. No bloqueante.

### 🟡 M8 — Race condition en `upsert_client_from_order`
**Bug:** Dos vendedores creando órdenes simultáneas con el mismo cliente nuevo podían generar duplicados en `cobranza.clients` porque el RPC no tenía advisory lock y la tabla no tiene UNIQUE en (name) o (rfc).

**Fix:** `pg_advisory_xact_lock(hashtext('upsert_client:'||(rfc or lower(name))))` al inicio del bloque de búsqueda/insert. Serializa concurrentes con el mismo identificador. Mismo patrón que `record_stock_movement` y `credit_consume`.

### 🟡 M9 — Formato de WhatsApp inconsistente
**Bug:** El RPC guardaba whatsapp como `"+52 4771234567"` (con lada). Los clientes existentes lo tienen como `"4771234567"` o `"477 120 5353"` (sin lada). Mezclar ambos formatos rompía el typeahead+selC: al re-cargar un cliente con formato nuevo, el lada se duplicaría.

**Fix:** el RPC guarda **solo el número sin lada**, consistente con el resto de la BD. `p_lada` se recibe por compat pero se ignora (el lada se preserva aparte en `orders.client_lada`).

### 🟢 Quedan como mejoras post-demo
- **B7** Notas en payment Corona se concatenan sin límite
- **B8** `assigned_seller` por fuzzy match en cada upsert
- **B9** Audit log puede ser ruidoso si solo se llena `seller`


## v10.43.5 — Captura de cliente al crear orden persiste en cobranza — 22-may-2026

**Pain real de Lupita y vendedores:** capturaban datos completos de un cliente nuevo en una orden (nombre, RFC, email, whatsapp) pero al crear la siguiente orden del mismo cliente, el typeahead no lo encontraba y tenían que reescribir todo. Razón técnica: `resolve_client` solo se disparaba en el bridge al asignar folio fiscal, y solo guardaba el nombre.

### 🔧 Fix DB — RPC nuevo `upsert_client_from_order`
- **Match en cascada:**
  1. Por RFC normalizado (UPPER+TRIM) si está presente.
  2. Sino, por nombre case-insensitive.
- **Política:** **completar huecos, NUNCA sobrescribir.** Si el cliente ya tenía email "x@y.com", no se sobreescribe. Si tenía email NULL y la orden trae uno, se llena.
- **Crea nuevo si no encuentra match**, con todos los datos provistos + nota "Capturado desde PrintFlow al crear orden".
- **Resuelve `assigned_seller`** vía `cobranza.resolve_seller(agent)` para vincular automáticamente al vendedor.
- **Audit log:** `client_data_enriched` (cuando completa huecos) o `auto_create_client_from_order` (cuando crea nuevo) con detalle de qué campos se llenaron.

### 🎨 Frontend
- **`dbCols` whitelist incluye `client_id`** ahora — el id se persiste en la orden para que el bridge y typeahead lo encuentren.
- **`create()`** llama a `db.upsertClientFromOrder(...)` ANTES de `saveOrder` si `f.client_id` es NULL pero `f.client` está poblado.
- **Falla no bloqueante:** si la RPC falla, la orden se crea igual (sin client_id) y el bridge la resolverá al facturar.
- Para órdenes desde typeahead (con `client_id` ya resuelto), no se llama el upsert.

### Resultado para Lupita / vendedores
1. Captura "Juan Pérez" + RFC + email + WhatsApp en una orden nueva → orden se guarda + cliente se crea/enriquece en cobranza.
2. Siguiente orden, escribe "Juan" → typeahead encuentra "Juan Pérez" con todos sus datos → click → `selC` autocompleta.

### 🔒 Consideraciones
- **Solo en `create()`**, no en `update()`. La edición de datos del cliente en una orden existente NO se propaga (decisión: minimizar side-effects).
- **Match por RFC > nombre.** Dos clientes con el mismo nombre pero distinto RFC quedarán como dos registros distintos en cobranza (correcto).
- **No sobrescribe datos previos.** Si admin corrigió manualmente un email en cobranza, una orden no lo va a "des-corregir".


## v10.43.4 — Edición de precio post-factura propaga a CobranzaFlow — 22-may-2026

**Caso real:** Karla facturó una orden con D-XXXX pero la orden tenía precio $0 (no se había capturado). Editar el precio en PrintFlow ahora **propaga automáticamente** a `cobranza.invoices` (antes solo creaba una discrepancy informativa).

### 🔧 Fix DB — `sync_post_invoice_edit` ampliado
- **Antes:** solo creaba `audit_discrepancy` ("revisar monto fiscal").
- **Ahora:** además **UPDATE `cobranza.invoices.amount` + recalcula `balance`** preservando lo ya pagado (`paid = old_amount - old_balance` → `new_balance = max(0, new_amount - paid)`). Status se recalcula: `pagada` / `parcial` / `pendiente` según corresponda.

### Casos manejados
| Caso | Comportamiento |
|---|---|
| Invoice **pendiente** (sin pagos) | Actualiza `amount` y `balance` al nuevo monto |
| Invoice **parcial** (con pagos) | Mantiene lo pagado; ajusta `balance` (puede subir o bajar) |
| Invoice **pagada total** | Si baja el precio, `balance=0` se mantiene; si sube, queda con saldo pendiente |
| **OC con `shared_invoice_folio`** | Recalcula `SUM(price)` de TODAS las orders activas de la OC (no solo la editada) |
| **Cliente Corona** (`billing_mode='anticipo'`) | Hace `credit_adjust` por la diferencia (consumo adicional si sube; devolución si baja). Actualiza también el payment `saldo_a_favor`. Garantiza `balance=0, status='pagada'`. |
| Invoice **cancelada** | Skip — no se toca. Auditado en log. |

### Auditoría
- `cobranza.audit_log`: `bridge_post_invoice_edit_applied` con detalle completo (old/new amount, paid, status, si era Corona, si era OC compartida).
- `cobranza.audit_discrepancies`: entrada con `status='resuelta'` (porque el auto-update YA lo arregló).
- `EXCEPTION WHEN OTHERS` heredado — un fallo se loguea pero no rompe la edición en PrintFlow.

### 🔒 Permisos
La edición de orders con `invoice_folio` ya estaba restringida en frontend a admin (Marcelo). El nuevo bridge respeta ese gate — solo dispara cuando se hace un UPDATE legítimo a `price`.


## v10.43.3 — Fix urgente: folio OC menor al sugerido permitido — 22-may-2026

Karla necesita asignar folios menores al recomendado a OCs (caso real: corregir huecos retroactivos contra AlphaERP). El RPC `assign_folio_to_oc` los rechazaba con `RAISE EXCEPTION 'Folio inicial no puede ser <= último folio usado'`.

### 🔴 Fix DB — `assign_folio_to_oc`
- **Removido:** el check estricto contra `invoice_counters.last_number`. Ahora se permite cualquier folio numérico positivo del formato correcto.
- **Mantenido + reforzado:** detección de duplicados. Antes solo verificaba implícitamente; ahora chequea EXPLÍCITAMENTE:
  - Contra todos los `orders.invoice_folio` (modo shared y consecutive).
  - Contra `purchase_orders.shared_invoice_folio` de OTRAS OCs.
  - Si encuentra duplicado, lanza error con el folio específico que causa conflicto.
- **Counter solo avanza:** `UPDATE invoice_counters SET last_number = GREATEST(last_number, v_final_number)` para no retroceder y no afectar sugerencias futuras.
- **Lock del counter:** `SELECT FROM invoice_counters FOR UPDATE` para serializar contra `assign_invoice`.

### 🎨 Fix UI — `AssignOCFolioModal`
- Mensaje warning actualizado: ya no dice "la RPC rechazará si está por debajo del último usado". Ahora dice "se permite siempre que NO esté ya asignado a otra orden u OC".


## v10.43.2 — Segundo bug scan fixes — 22-may-2026

Un alto + dos medios encontrados en segundo scan. Tres bajos quedan para después del demo.

### 🔴 A4 — `selC` resetea campos stock al cambiar de cliente
**Bug:** Si el usuario selecciona primero un cliente Cuadra (stock), marca "Producción a stock" y elige producto, y luego cambia a otro cliente, los campos `stock_role`/`client_product_id` mantenían los valores del cliente anterior → orden inconsistente apuntando a un producto que pertenece a OTRO cliente.

**Fix:** `selC()` resetea `stock_role:null, client_product_id:null, stock_loaded:false` al pick de un cliente nuevo (excepto si la orden ya tiene `stock_loaded=true`, modo edición). El `onChange` de `ClientInput` (cuando se escribe a mano y se desvincula `client_id`) también resetea `billing_mode='normal'` y limpia los campos stock.

### 🟡 M5 — `humanizeStockError` extendido
**Bug:** Doble-click rápido en "Cargar a Stock" topaba con `UNIQUE INDEX stock_movements_order_kind_uniq` → toast mostraba "duplicate key value violates unique constraint…" (técnico, alarma al usuario).

**Fix:** helper extendido con traducciones para:
- `stock_movements_order_kind_uniq` → "ℹ️ Esta orden ya tuvo este movimiento. Recarga."
- `credit_ledger_consumo_uniq` → "ℹ️ El saldo de esta factura ya se aplicó previamente."
- `duplicate key value` (genérico) → "ℹ️ Movimiento duplicado detectado. Recarga."

### 🟡 M7-b — Refresh saldo Corona pre-confirm
**Bug:** `InvoiceModal`/`PreInvoiceModal` cargaban saldo una sola vez al montar. Si Lucero registraba un depósito mientras Karla tenía el modal abierto, ella veía saldo stale → confirmaba creyendo que el saldo era el viejo (negativo cuando ya no debía serlo, o viceversa).

**Fix:** `handleConfirm()` en ambos modales hace `db.getClientBillingInfo()` justo antes de llamar `onConfirm` cuando `isCorona`. Si el saldo cambió, actualiza `coronaInfo` (refleja en el siguiente render). La operación procede con el saldo más reciente.

### 🟢 No-fix (bajos, esperar feedback demo)
- **B4** Clientes Corona inactivos con saldo huérfanos en UI
- **B5** Edición de orden con stock_loaded cuyo cliente ya no es stock — panel oculto pero datos vigentes
- **B6** Bridge OC captura `invoiced_by` con `LIMIT 1` sin ORDER determinístico


## v10.43.1 — Bug scan fixes (Cuadra + Corona) — 22-may-2026

Tres altos + un medio encontrados en scan exhaustivo post-v10.43.0 / v2.8.1. Todos aplicados.

### 🔴 A1 — Bridge: `sync_cancellation_to_cobranza` revierte saldo Corona independiente del flag
**Bug:** Si el flag `corona_credit_bridge_enabled` se apagaba después de haber consumido saldo en una factura Corona, cancelar esa factura NO disparaba `credit_reverse` → el saldo del cliente quedaba descuadrado (el dinero no se le devolvía).

**Fix:** la rama de reverso ahora chequea si existe un CONSUMO ligado a la invoice (`source_invoice_id`) sin depender del flag ni del `billing_mode` actual del cliente. La RPC `credit_reverse` ya era idempotente; ahora se invoca correctamente en todos los casos de cancelación.

### 🔴 A2 — `cancelOrder` con stock_loaded: guard
**Bug:** Cancelar una orden Cuadra con `stock_loaded=true` (ya cargada al inventario) marcaba la orden como cancelada pero el saldo del producto en `client_products.stock_actual` seguía inflado/reducido — inventario fantasma.

**Fix:** `cancelOrder()` ahora rechaza la operación si `stock_loaded=true` con mensaje claro: *"Primero ajusta el stock manualmente desde el módulo Inventario, después cancela"*. Paralelo al guard existente de `invoice_folio`.

### 🔴 A3 — `deleteOrder` con stock_loaded: guard
**Bug:** Borrar una orden con `stock_loaded=true` dejaba registros huérfanos en `stock_movements` (FK con `ON DELETE SET NULL`) y el saldo del producto sin corregir.

**Fix:** mismo guard en `deleteOrder()`. Mensaje explícito con el ajuste manual previo necesario.

### 🟡 M4 — Toast translation: errores de saldo insuficiente
**Bug:** Cuando una RPC de stock (`record_stock_movement` o `sell_from_stock`) rechazaba por saldo insuficiente, el toast mostraba el `RAISE EXCEPTION` raw: `"stock insuficiente: actual=300 intento=-500"`.

**Fix:** helper `humanizeStockError()` traduce a *"❌ Stock insuficiente. Saldo actual: 300 pzas, intentaste mover 500 pzas."* y cubre otros errores comunes (`client_product no existe`, `qty debe ser > 0`, etc).

### 🟢 No-fix (queda como mejora futura)
- M2: `payment_type='saldo_a_favor'` se muestra como string literal (cosmético)
- M3: `reloadLedger` sin `alive` flag en CobranzaFlow (race condition leve)
- B1/B2/B3: indicadores UX y alertas de umbral

### ⚠️ Operación importante post-fix A2/A3
Si por error se cancela/borra una orden con stock_loaded ANTES de este fix, los saldos quedan inconsistentes. Para corregir, hacer ADJUST manual en el módulo Inventario con el delta correspondiente.


## v10.43.0 — Corona: Saldo a favor (anticipo abierto) — PrintFlow side — 22-may-2026

Feature nueva para clientes con flujo de anticipo abierto (caso Corona). Cliente deposita un monto open-ended ($300k) → registramos saldo a favor en ledger. Cada factura de Corona consume el saldo en vez de generar CXC. La factura aparece en `cobranza.invoices` como pagada con `payment_type='saldo_a_favor'`, y NO entra al embudo de cobranza.

**🚦 Toda la lógica está apagada por flag `corona_credit_bridge_enabled='false'` y NINGÚN cliente tiene `billing_mode='anticipo'` todavía** → la facturación de todos los clientes sigue 100% como hoy.

### 🗄️ DB (migrations aplicadas, schema cobranza + RPCs en public)
- Tabla `cobranza.client_credit_ledger` (DEPOSITO/CONSUMO/AJUSTE/REVERSO con `balance_despues` denormalizado, FK opcional a `cobranza.invoices`, índice único parcial anti-doble-consumo por folio). RLS espejando `cobranza.payments` (4 policies `auth_*`).
- 5 RPCs `SECURITY DEFINER` con `pg_advisory_xact_lock` por cliente:
  - `client_credit_balance(client_id)` lectura del último balance
  - `credit_deposit(client_id, monto, ref, periodo, user, notas)` registra DEPOSITO
  - `credit_consume(client_id, monto, source_invoice_id, ref, user)` permite saldo negativo + idempotente por `source_invoice_id`
  - `credit_adjust(client_id, monto, motivo, user)` motivo ≥3 chars obligatorio
  - `credit_reverse(client_id, source_invoice_id, user)` busca CONSUMO ligado y registra REVERSO (no-op si no existe; idempotente)
- 3 RPCs auxiliares: `list_anticipo_clients()`, `get_client_billing_info(client_id)`, `load_credit_ledger(client_id?, limit?)`.
- `cobranza.app_config('corona_credit_bridge_enabled', false)` — flag global.

### 🔧 Bridge (inyección quirúrgica en 3 triggers)
Las 3 funciones del bridge recibieron un bloque "RAMA CORONA" entre separadores visibles. La rama se ejecuta **solo si** `billing_mode='anticipo'` AND el flag está en `true` — si cualquiera falla, flujo idéntico al de hoy:
- **`sync_invoice_from_orders`** (ruta individual): después del INSERT invoice → `credit_consume` + INSERT payment `payment_type='saldo_a_favor'` + UPDATE invoice `balance=0,status='pagada'` → `RETURN NEW` (skip candados v10.36 y auto-payment normal).
- **`sync_invoice_from_oc`** (ruta OC con folio compartido): mismo patrón, **un solo CONSUMO por toda la OC** gracias a la idempotencia por `source_invoice_id`.
- **`sync_cancellation_to_cobranza`**: captura `invoice_id` antes del UPDATE de cancelación; si el cliente es anticipo → `credit_reverse` que devuelve saldo. Idempotente.

Para Corona, frontend manda `payment_status=NULL` así NO se topa con los candados v10.36 (efectivo + bank_ref) que validan al inicio del trigger.

### 🎨 Frontend PrintFlow
- **6 helpers nuevos en `db`**: `listAnticipoClients`, `getClientBillingInfo`, `creditBalance`, `creditDeposit`, `creditAdjust`, `loadCreditLedger`.
- **`InvoiceModal` y `PreInvoiceModal`**: al montar, cargan `billing_mode` + `current_balance` del cliente. Si es anticipo → reemplazan `PaymentStatusPicker` por un **banner verde "💰 Cliente con saldo a favor"** que muestra saldo actual / factura / saldo después. Permite saldo negativo (descubierto) con warning naranja. `handleConfirm` manda `payment_status=null, method=null, amount=null, bank_reference=null` → el bridge resuelve.
- **`CoronaModal`** nuevo (botón header `🎱` para admin/secretaria/karla): lista de clientes anticipo con saldo, vista de ledger por cliente (DEPOSITO/CONSUMO/AJUSTE/REVERSO con `balance_despues` corriente). Admin tiene `📊 Ajuste manual` que abre `CreditAdjustModal` con motivo obligatorio.
- **Los depósitos los registra Lucero en CobranzaFlow**, no en PrintFlow (separación de responsabilidades).

### ⚠️ Lo que falta para activar Corona en producción
1. **CobranzaFlow side**: modal Lucero "Registrar depósito (saldo a favor)" → `credit_deposit`, vista de saldo a favor en Tesorería, ledger viewer. (Siguiente sprint).
2. **E2E con flag**: probar flag off (bridge intacto) → flag on (rama Corona) → cancelación (credit_reverse).
3. Activar Corona real: `UPDATE cobranza.clients SET billing_mode='anticipo' WHERE name LIKE '%CORONA%'`. Solo después de E2E completo.


## v10.42.2 — Ajustes Cuadra: precio total + rescate Karla — 22-may-2026

Dos mejoras pedidas por Marcelo durante pruebas:

### #1 — Toggle precio en venta desde stock
`SellFromStockModal` ahora tiene un toggle "💰 Monto total" / "📐 Precio unitario". Default = monto total (la captura natural para Karla y Lupita: "se vendieron 500 pzas por $1,250"). El otro modo se mantiene para quien prefiera capturar unitario. El total y el unitario se calculan en vivo cruzados, y se envía siempre `unit_price` resuelto al RPC `sell_from_stock` (sin cambio de contrato backend).

### #2 — Rescate desde Salidas
Si Gerardo manda por accidente una orden de Cuadra a Salidas (en lugar de Cargar a Stock), Karla (y admin) ven el botón **`📦 Cargar a Stock (corrección)`** en la card. Solo aparece para órdenes con `stock_role='production'` y `stock_loaded=false` — invisible para órdenes normales. El handler `loadStock` ya funcionaba desde cualquier stage no-final, solo faltaba exponer el botón.


## v10.42.1 — Hotfix: dropdown cliente stock vacío — 22-may-2026

Bug encontrado en pruebas: `ProductFormModal` y `InventoryModal` filtraban el array `clients` por `billing_mode==='stock'`, pero ese array se construye de `orders` (no de `cobranza.clients`) y no incluye `id` ni `billing_mode` — el dropdown siempre salía vacío.

**Fix:** nuevo RPC `public.list_stock_clients()` que devuelve `(id, name, rfc, billing_mode)` de `cobranza.clients` con `billing_mode='stock'`. Los dos modales ahora cargan la lista directamente vía RPC en vez de filtrar el array local. Patrón: schema `cobranza` no está expuesto a PostgREST, todo se hace vía RPC SECURITY DEFINER (consistente con `search_clients_typeahead`, `get_last_contact_for_client`, etc).


## v10.42.0 — Cuadra: Producción a Stock + Inventario interno — 22-may-2026

Feature nueva para clientes con flujo de inventario (caso Cuadra). Cliente fabrica a stock y luego vende desde stock; solo lo vendido va a CXC. Las órdenes de producción-a-stock terminan en stage terminal `stocked` que **NO** setea `delivered_at` → no contamina los KPIs de revenue.

### 🗄️ DB (migrations aplicadas)
- `cobranza.clients.billing_mode` — text NOT NULL DEFAULT 'normal' CHECK ('normal'|'stock'|'anticipo'). Discriminador del flujo por cliente. No se marca ningún cliente real todavía — la activación de Cuadra requiere validar UI + carga inicial vs conteo Gerardo.
- `public.client_products` — catálogo por cliente: sku, name, specs jsonb, unit_price, `stock_actual` denormalizado. RLS `allow_all` (espejea `orders`/`purchase_orders`).
- `public.stock_movements` — bitácora inmutable: kind in `('PRODUCED','SOLD','ADJUST')`, qty signed, `balance_after`, FK a `orders` y `client_products`. Índice único parcial `(order_id, kind)` previene doble carga.
- `orders` columnas nuevas: `stock_role` (`'production'|'sale'|null`), `client_product_id` → FK, `stock_loaded` boolean.
- RPC `record_stock_movement(p_client_product_id, p_kind, p_qty, p_order_id?, p_notes?, p_created_by?)` — `pg_advisory_xact_lock` por producto + valida saldo ≥ 0 + actualiza `stock_actual` denormalizado en la misma TX.
- RPC `sell_from_stock(...)` — crea orden truncada en `salidas` con `stock_role='sale'`, `stock_loaded=true`, llama internamente a `record_stock_movement(SOLD)` (atómico).
- `search_clients_typeahead` extendido para devolver `billing_mode` (sin tocar el resto del comportamiento).

### 🎨 Frontend
- **Botón header `📦`** (admin/secretaria/produccion/karla) abre `InventoryModal` con dos pestañas: Productos (lista del catálogo + acciones Ajustar / Vender) y Movimientos (bitácora últimos 80).
- **Stage nuevo `stocked`** en `ALL_S` y `SM`; excluido de `getStale`, retorna 100% en `getProgress`, incluido en `finalStages`.
- **OrderForm**: cuando el cliente seleccionado tiene `billing_mode='stock'`, aparece panel verde "📦 Cliente con Inventario" con toggle "Producción a stock" + selector de producto del catálogo. Al seleccionar cliente, `selC` propaga `billing_mode`.
- **OCard en stage `packaging`** con `stock_role='production'`: botón `📦 Cargar a Stock` (handler `loadStock`) que dispara movimiento `PRODUCED` + transiciona a `stocked` + marca `stock_loaded=true`. No setea `delivered_at`.
- **Badges en OCard**: `📦 a Stock` (producción) y `🛒 desde Stock` (venta).
- **Modales**: `ProductFormModal` (alta de SKU), `AdjustStockModal` (ADJUST positivo/negativo con preview de saldo), `SellFromStockModal` (venta desde catálogo con cantidad validada vs `stock_actual`, precio, prioridad, due_date).
- **Guard de cantidad**: `update()` rechaza cambiar `quantity` cuando `stock_loaded=true` (desincronizaría el saldo). Toast contextual.
- **`duplicate()`** resetea `stock_role`, `client_product_id`, `stock_loaded` para no arrastrar a duplicados.
- **`saveOrder` dbCols whitelist** ampliada con las 3 columnas nuevas.

### 🔒 Roles
- `load_stock`: admin, secretaria, produccion, karla.
- `sell_from_stock`: admin, secretaria, vendedor (ownerBound), karla.

### ⚙️ Operación (siguiente paso para Marcelo)
1. Validar UI con cliente de prueba (no Cuadra).
2. Cargar catálogo real de Cuadra (productos) y ADJUST inicial vs conteo de Gerardo.
3. **Cuando todo cuadre**: marcar `cobranza.clients.billing_mode='stock'` para Cuadra. Hasta entonces el panel "Cliente con Inventario" no aparece para ellos.


## v10.41.1 — Fixes scan post-v10.41.0 — 22-may-2026

Pasada de bugs sobre v10.41.0. 3 altos + 2 medios + 1 cosmético aplicados. v10.41.0 verificado sound en general; estos son polish + 1 bug funcional real (#2).

### 🟠 Altos
- **#1 Logout no limpiaba `taskFilters` y `adminRoleFilter`.** El componente PrintFlow permanece montado durante logout → Login → re-login. State persistía entre sesiones (Lupita podía heredar el "Ver como Karla" de Marcelo + chips activos). **Fix:** handler de "Salir" ahora resetea ambos Set/string.
- **#2 Chip `Pre-asignados` (Karla) era inservible.** Karla pre-asigna folio a una orden en `in_production` → `o.invoice_pre_assigned=true` pero `o.stage='in_production'`. El `myTasks` de Karla solo incluía `[salidas, maq_received]` → chip contaba 0 aunque hubiera pre-asignados en otros stages. **Fix:** `myTasks` para Karla ahora incluye también `o.invoice_pre_assigned===true` (en cualquier stage no-terminal).
- **#3 Casing "Noémí" inconsistente.** Pill admin "🩷 Noémí" vs resto de app "Noemí" (acento solo en i final). **Fix:** 1 char.

### 🟡 Medios
- **#5 Predicate `late` no defensivo con due_date que traiga hora.** Si `o.due_date = "2026-05-21T08:00:00"` (importación externa), `due_date + "T23:59:59"` producía Invalid Date → predicate silently false. **Fix:** `String(o.due_date).slice(0,10) + "T23:59:59"` + check `!isNaN(due.getTime())` (patrón usado en `fD`/`fDT`).
- **#6 Subtítulo "filtrado de N" sin filtros realmente activos.** Si `taskFilters` contenía keys de un rol previo que no aplicaban al rol actual, el subtítulo mostraba "filtrado" sin filtro real. **Fix:** verificar `taskFilterConfigs.some(f=>taskFilters.has(f.key))` en lugar de solo `.size`.

### 🟢 Cosmético
- **#8 Predicate `stale` retornaba objeto en vez de boolean.** `getStale(o)` retorna `{lv, lb}` o null. Funcionaba por truthy/falsy en `.filter()`, pero el contrato del predicate es bool. **Fix:** `!!getStale(o)` para consistencia.

### Diferido a backlog
- #4 `staleTasks` no usa `effectiveRole` — funciona por coincidencia (admin pool ⊃ Karla pool), no urgente.
- #7 redundancia `isSec(role)||role==='secretaria'||role==='vendedor'`.
- #9 Chip count=0 sigue clickeable (atenuado pero no disabled).

### Sin cambios
- Lógica de getTaskFilters, TaskFilterChips component, OR semantics.

---


## v10.41.0 — Filtros chip en "Mis Pendientes" + admin "ver como otro rol" — 22-may-2026

Marcelo solicitó: chips redondos para filtrar Mis Pendientes; para admin, también poder filtrar viendo los pendientes de otro rol.

### Cambios

**Helpers nuevos top-level**
- `getTaskFilters(role)`: configs de filtros por rol. Cada filter tiene `{key, emoji, label, color, predicate}`.
  - **Base (todos los roles):**
    - 🔥 Urgentes — `priority === 'Urgente'`
    - ⏰ Retrasos — `due_date` pasado
    - 🐢 Estancadas — `getStale(o)` (reutiliza lógica existente de >24h sin avance)
    - 💰 Sin precio — `!price || Number(price)===0`
  - **Karla (sobre la base):**
    - 📥 Maquila recibida (`stage='maq_received'`)
    - 📋 OC pendiente folio (`purchase_order_id` y `!invoice_folio` en `salidas`)
    - 🔒 Pre-asignados (`invoice_pre_assigned`)
  - **Producción (sobre la base):**
    - 🖱️ Sin máquina (`stage='ready'` y `!current_machine`)
    - 📦 Empaque pendiente (`stage='packaging'`)
  - **Preprensa (sobre la base):**
    - 👤 Esperando cliente (`stage='proof_client'`)
  - **Admin (sobre la base):**
    - 🚚 Maquila externa (stages de cadena maquila)

**Componente `TaskFilterChips`**
- Chips redondos con `emoji + label + (count)`. Count en vivo derivado de `tasks` (pre-filtros), siempre visible.
- Active state: borde y fondo del color del filtro.
- Multi-select OR: si N chips activos, muestra órdenes que matchean al menos uno. Si 0, muestra todo.
- Hover/title tooltip con el conteo.
- Opacity reducido si count=0 e inactivo.

**Admin: "Ver como otro rol"**
- Barra adicional para admin: 7 botones-pill (Admin/Karla/Gerardo/Noémí/Germán/Lupita/Vendedor).
- Al seleccionar un rol, `myTasks` se recomputa con los stages de ese rol y los filtros chip cambian a los específicos de ese rol.
- Al cambiar de rol se limpian los chip filters activos (evita confusión).

**State y derived**
- `taskFilters: Set<string>` — keys activas.
- `adminRoleFilter: string` — rol "vista como" para admin.
- `taskFilterConfigs` (useMemo): configs según `effectiveRole`.
- `filteredMyTasks` (useMemo): `myTasks` filtrado con OR de predicates.

**UI en `view==='tasks'`**
- Subtítulo muestra count filtrado + total + indicador de filtro/búsqueda/rol activo.
- Barra admin "Ver como rol" (solo admin).
- Chips de filtro.
- Lista de tasks ahora usa `filteredMyTasks` en lugar de `myTasks`.
- `staleTasks` ahora se intersecta con `filteredMyTasks` (no se muestran estancadas que el filtro chip excluyó).
- Empty state mejorado: si hay chips activos y 0 resultados, muestra "Sin resultados con esos filtros" + botón "✕ Limpiar filtros".

### Sin cambios
- Schema, RPCs, lógica de `myTasks` base por rol.
- `staleTasks` cálculo (solo se intersecta para display).
- Nav bar contador `Pendientes (N)` muestra `myTasks.length` (respeta admin role filter pero no los chips).

---


## v10.40.2 — Polish post-scan v10.40 — 22-may-2026

Polish menor sobre v10.40.0. Solo 1 alto educativo + 1 medio cosmético. v10.40.0/v10.40.1 verificados SOUND.

### 🟠 Educativo
- **#1 Toast informativo cuando admin revierte desde `delivered`.** El `revertOrder` cambia `stage='salidas'` y limpia `delivered_at`, pero **no toca `invoice_folio`** ni la invoice en `cobranza.invoices`. Si admin va a reasignar folio nuevo, podría quedar invoice fantasma en cobranza (caso P-3516/D-5824 que tuvimos que limpiar manualmente). **Fix:** toast warning al abrir el modal *"La invoice fiscal en CobranzaFlow no se modifica. Si vas a cambiar el folio, revierte primero la invoice."* Solo educativo, no destructivo.

### 🟡 Cosmético
- **#3 Hint "antes de tu área" incorrecto para admin/karla.** Esos roles tienen como 2da opción literalmente "2 stages atrás" (no "antes del área del rol", que no aplica a admin/karla). **Fix:** detectar role admin/karla → hint "(2 stages atrás)".

### Diferido a backlog
- #2 memoization de `getRevertOptions` (~50ms con 100 órdenes, no urgente)
- #4 decisión de producto: ¿preprensa puede saltar de `proof_client` a `draft`?
- #5-#10 cosmético/edge cases

---


## v10.40.1 — Fix: ConfirmModal queda visible durante side effects largos — 22-may-2026

Marcelo reportó: al borrar una orden, el popup "Sí, borrar / No, cancelar" se mantenía visible aunque ya había clickeado "Sí" — daba la sensación de que el botón no respondía.

**Causa:** 5 call sites de `setConfirmModal` ponían `setConfirmModal(null)` **después** de los `await`. Para el delete de orden son 8 DELETEs secuenciales (~2-3s) — el modal quedaba pegado todo ese tiempo aunque el click ya se había procesado.

**Fix:** `setConfirmModal(null)` se llama **primero** en el `onConfirm`, antes de cualquier `await`. Side effects continúan en background; el modal cierra instantáneamente al click. Optimistic update local ya maneja la UI.

### Call sites corregidos
1. `deleteOrder` (App handleAction) — 8 DELETEs en cadena, era el más visible.
2. `revert` admin handler (línea 7538 area) — await doAdv + notifs.
3. `notify` resp en OperationalHealthView.
4. `cancelOrphanOC` en OperationalHealthView.
5. `markAllNotifsRead` en OperationalHealthView.

### Sin cambios
- Lógica de cada operación intacta — solo se reordenó el `setConfirmModal(null)` al inicio del callback.
- `ConfirmModal` component no se tocó (sigue genérico).

---


## v10.40.0 — Botón "Regresar" unificado (sustituye CTP + Devolver Diseño) — 22-may-2026

Marcelo solicitó generalizar el concepto de "Regresar a CTP" (v10.38.0) a cualquier área. Cada encargado puede regresar la orden a: (1) el stage anterior inmediato, o (2) el stage justo antes de su área. Karla en `salidas` puede ir hasta 2 stages atrás. Admin puede revertir desde `delivered`.

### Cambios

**Helpers nuevos (top-level)**
- `STAGE_SEQUENCE`: array lineal del workflow (draft → ... → delivered).
- `ROLE_AREAS`: stages que cada rol controla.
  - preprensa: design, proof_printing, proof_client
  - german: ctp, placas_listas
  - produccion: ready, in_production, packaging
  - karla: salidas
- `getRevertOptions(currentStage, role)`: devuelve hasta 2 stages destino válidos. Filtra por área, excluye stages terminales y rama maquila externa.

**Componente nuevo `RevertOrderModal`**
- 1 o 2 opciones (radio buttons + hint "stage anterior" / "antes de tu área").
- Si solo 1 opción → muestra label directo.
- Razón obligatoria (textarea, auto-focus).
- Color cyan `#0891b2` consistente con la versión específica anterior.

**Handler `revertOrder(id, targetStage, reason)`**
- Re-valida opción permitida (defensa en profundidad).
- Side effects por destino:
  - `targetStage='ctp'`: invalida `plate_log` (preserva historial con `voided_*`, como v10.38).
  - Limpia `current_machine` siempre (orden vuelve a flujo controlado).
  - Si veníamos de `delivered`: limpia `delivered_at`.
- Notif al rol responsable del stage destino + Preprensa/Secretaria si destino ∈ {ctp, placas_listas, design, proof_printing} + admin (skip self).
- Timeline + try/catch independientes para notif/timeline (no rompen la operación principal si fallan).
- Optimistic local update.

**UI en `OCard`**
- Nuevo botón **"↩️ Regresar"** (color cyan) aparece cuando `getRevertOptions(stage, role).length > 0`. Reemplaza los botones específicos:
  - ❌ Removido: `↩️ Regresar a CTP` (era v10.38.0, solo en placas_listas/ready)
  - ❌ Removido: `↩️ Devolver a Diseño` (era de in_production)
- Cada rol ve el botón solo en sus stages elegibles. Admin lo ve en todos los stages no-terminales.
- handleAction case `revert` formatea las opciones y abre `RevertOrderModal`.

**Compatibilidad**
- `handleAction('return_to_ctp')` se mantiene como pass-through al nuevo flujo (`revert`) — no rompe llamadas antiguas.
- `DevolverModal` y `returnToCtpModal`/`ReturnToCtpModal` quedan dormant (sin botones que los inicien) — no se removieron por seguridad; serán limpiados en una pasada futura si confirmamos cero uso.

### Casos de uso resueltos
- Gerardo (produccion) en `ready` o `placas_listas`: regresa a CTP para re-imprimir placas (Caso Hotel Hotsson).
- Noemí (preprensa) en `proof_client`: regresa a `proof_printing` o `design` (rechazo cliente o cambio de archivo).
- Karla (salidas): regresa a `packaging` o `in_production` (defecto descubierto al entregar).
- Admin: puede revertir desde `delivered` (caso de error de entrega, similar al revert manual de P-3516/D-5824).

### Sin cambios
- Schema, RPCs, triggers.
- Flujos de approve/reject (approveProof, devolver_design action) coexisten para el caso especial proof_client → design vía secretaria/vendedor.
- Lógica de maquila externa (ramificación lateral, fuera del flujo lineal del revert).

---


## v10.39.2 — Fixes scan post-v10.38/v10.39 — 22-may-2026

Pasada de bugs sobre v10.38/v10.39. 3 altos + 1 medio aplicados. 0 críticos. Adicionalmente, ventana de notificaciones de celular extendida de 09:00 a 18:59 (lun-vie) vía migration en `is_business_hours()`.

### 🟠 Altos
- **#2 Matching híbrido podía mezclar clientes homónimos.** v10.39.1 hizo el fallback por nombre como un OR no-estricto, lo que permitía que orden con `client_id=DEF` y nombre "Hotel Hotsson" matcheara con OC `client_id=ABC` también llamada "Hotel Hotsson" (dos sucursales fiscalmente distintas). **Fix:** ID-strict cuando ambos lo tienen; nombre solo como fallback cuando la orden NO tiene `client_id`. Evita conflación entre entidades fiscales.
- **#1 `confirmAddExisting` calculaba `fromId` DESPUÉS del RPC.** En redes rápidas, realtime actualizaba `orders` entre el `moveOrderToOC` y el `find` → notif al trío mostraba "De: OC-NUEVA → A: OC-NUEVA". **Fix:** capturar `o` y `fromId` ANTES del RPC dentro del loop.
- **#3 `returnToCtp` notificaba solo a Germán.** Preprensa puede tener archivos relevantes del retrabajo, Secretaria coordina; ambos quedaban sin enterarse. **Fix:** notificar también a `preprensa` y `secretaria` (skip si el usuario es uno de ellos).

### 🟡 Medio
- **#4 `confirmAddExisting` sin gate de permiso por orden.** El RPC `moveOrderToOC` individual valida `canExecuteAction("moveOrderToOC")` (admin/secretaria/karla); el flujo batch no lo hacía → vendedor podría disparar movimientos via el modal aunque no esté en `allowed`. **Fix:** mismo gate al inicio del loop. Backend ya validaría también, pero ahora frontend reporta correctamente y muestra `actionDeniedToast`.

### Backend (migration `is_business_hours_9am_to_7pm`)
- Actualizada función `public.is_business_hours()` para que la ventana activa sea **lun-vie 09:00 a 18:59** (antes era lun-vie con bordes en vie≥20 + lun<9). Notificaciones in-app y Telegram (via cadena BEFORE → AFTER triggers en `public.notifications`) se silencian fuera de esa ventana.
- Equipo ahora no recibirá notifs de celular en su casa después de las 7pm.

### Diferido a backlog
- #5 (excluir `draft` de TERMINAL en candidates)
- #6 (usar o eliminar `ocById` map)
- #7 (consolidar notifs por batch — N×4 hoy)
- #9, #12, #13 (edge cases UX)

### Sin cambios
- Schema `orders`/`plate_log`/`purchase_orders`/`notifications`.
- RPC `move_order_to_oc`.
- Lógica de Telegram (sigue siendo fire-and-forget vía n8n).

---


## v10.39.1 — Hotfix: matching híbrido en Agregar Producto Existente — 22-may-2026

Marcelo reportó: el modal "Agregar Producto Existente" en OC-0048 (BEATRIZ) decía "Sin órdenes elegibles" pero sí existían 2 órdenes activas del mismo cliente (P-3515 y P-3516).

**Causa:** mi filtro v10.39.0 hacía match estricto por `client_id` (UUID). Pero muchas órdenes legacy tienen `client_id = NULL` y solo guardan el campo text `client`. La OC sí tiene `client_id` (porque se crearon con el flujo moderno), así que las órdenes legacy nunca matcheaban.

Ejemplo del bug:
- OC-0048: `client="BEATRIZ"`, `client_id=741c9fde-...` ✓
- P-3515: `client="BEATRIZ "` (con espacio), `client_id=null` ❌ no matcheaba
- P-3516: `client="BEATRIZ"`, `client_id=null` ❌ no matcheaba

**Fix:** matching híbrido en `AddExistingProductsModal.candidates`:
1. **Preferido:** match por `client_id` cuando ambos (orden y OC) lo tienen.
2. **Fallback:** match por nombre normalizado (`client.trim().toLowerCase()`) cuando alguno no tiene client_id.

También relajado el guard inicial en `addExistingToOC` para aceptar OCs sin `client_id` siempre que tengan `client` (el modal hace fallback por nombre).

### Sin cambios
- Resto del feature v10.39.0 funciona igual.
- Lógica de `moveOrderToOC` (RPC backend).
- Permisos, otros filtros (sin folio, no terminal, no ya en esta OC).

---


## v10.39.0 — Agregar Producto Existente a OC — 22-may-2026

Solicitado por Marcelo: en la ventana de detalle de una OC, permitir agregar órdenes de producción YA EXISTENTES del mismo cliente (no solo crear órdenes nuevas). Caso de uso: Karla quiere juntar 2 órdenes de producción en una sola OC para asignarles un `shared_invoice_folio`.

### Cambios

**Frontend (`src/App.jsx`)**
- Botón existente **"+ Agregar producto"** renombrado a **"+ Agregar Producto Nuevo"** (sin cambio funcional — sigue creando órdenes desde cero vía `addProductToOC`).
- Botón nuevo **"📦 Agregar Producto Existente"** (color success/verde) junto al anterior. Mismos gates de permiso (`canAddProductToOC`).
- Nuevo componente `AddExistingProductsModal`:
  - Lista órdenes filtradas por `client_id` de la OC.
  - Filtros defensivos: excluye órdenes con `invoice_folio`, stages terminales (delivered/maq_delivered/cancelled/maq_cancelled/web_pending/web_rejected) y órdenes ya en esta OC.
  - **Multi-select** con checkboxes.
  - Badge "Actualmente en OC-XXX" cuando la orden ya está en otra OC (el move desde otra OC es válido y limpia la origen automáticamente vía RPC `move_order_to_oc`).
  - Badge "Sin OC" para órdenes huérfanas.
  - Search box por production_number, product_type o ID.
  - Empty state explicativo con causas posibles cuando no hay candidatos.
- Handler `addExistingToOC(oc)`:
  - Valida permisos (mismo gate que `addProductToOC`) y que la OC tenga `client_id` (sino no se puede filtrar).
  - Abre el modal.
- Handler `confirmAddExisting(oc, orderIds)`:
  - Loop sobre `db.moveOrderToOC(orderId, oc.id, user)` para cada ID seleccionado.
  - Notif al trío (secretaria/preprensa/produccion) + admin por cada orden movida.
  - Toast con resumen (ok/fallidos) y `reload()`.
- State `addExistingModal` agregado al árbol del App.
- Prop `onAddExisting` añadida a `OrdenesCompraView`.
- Hint del empty state actualizado para mencionar ambos botones.

### Permisos
- Misma gate que el botón actual: vendedor dueño / Karla / admin / secretaria. No-vendedor de la OC: bloqueado con toast.
- OCs web: bloqueadas igual que el botón actual.

### Sin cambios
- RPC `move_order_to_oc` reusado tal cual (atómico, ya hace cleanup de OC origen si queda vacía).
- Schema de `orders` y `purchase_orders`.
- Lógica de OC web, pre-assign folio, asignar folio compartido.
- Botón "+ Agregar Producto Nuevo" se comporta idéntico al anterior.

---


## v10.38.0 — Regresar orden a CTP (re-imprimir placas) — 21-may-2026

Gerardo (Producción) solicitó poder regresar una orden de `ready` o `placas_listas` de vuelta a `ctp` cuando se detecta que las placas necesitan re-imprimirse. Caso de uso: Hotel Hotsson — órdenes estaban en máquina, se quitaron, ahora están en Listas pero necesitan nuevas placas.

### Cambios

**DB (migration `v10_38_plate_log_void_columns`)**
- Agregadas columnas a `public.plate_log`: `voided_at`, `voided_reason`, `voided_by`. Permiten marcar placas como inválidas conservando el historial (no se borran).

**Frontend (`src/App.jsx`)**
- Nuevo botón **"↩️ Regresar a CTP"** color cyan en `OCard`, visible cuando `stage ∈ {placas_listas, ready}` Y `role ∈ {produccion, admin}`.
- Nuevo componente `ReturnToCtpModal`: captura razón obligatoria (textarea) con auto-focus + ejemplo en placeholder.
- Handler `action==='return_to_ctp'` en `handleAction`: valida rol + stage, abre modal.
- Función `returnToCtp(id, reason)`:
  - UPDATE `plate_log` SET voided_at/voided_reason/voided_by (solo plates que estén `voided_at IS NULL`).
  - UPDATE `orders` SET `stage='ctp'`, `current_machine=null` (va a Germán otra vez).
  - `db.addTimeline` con razón + quién + cuándo.
  - `db.notify('german', ...)` para que Germán reciba notificación in-app.
  - Optimistic local update de orders.
- State `returnToCtpModal` agregado al árbol del App.

### Permisos
- Solo `produccion` (Gerardo + equipo de máquinas) y `admin` (Marcelo) pueden disparar el regreso.
- Otros roles: el botón no se renderiza.

### Trazabilidad
- Placas viejas conservan registro (`voided_at` flagea invalidación).
- Timeline de la orden registra el regreso con razón.
- Audit: Germán recibe notif inmediata con el motivo.

### Sin cambios
- Lógica de avance normal del workflow (`advance`/`doAdv` intactos).
- Schema de `orders`.
- Otras transiciones de stage.

---


## v10.37.0 — Reordenar dashboard: Pipeline antes que MaquilaTracker — 21-may-2026

Marcelo solicitó ver el dashboard de producción interna (Pipeline con sus etapas) **primero**, y el recuadro "En Maquila" (`MaquilaTracker`) **al final**. Antes el `MaquilaTracker` ocupaba la primera posición visible y dominaba el dashboard, escondiendo el Pipeline interno debajo.

### Cambio

`view==='pipeline'` (línea ~7184) — orden de los componentes:

**ANTES:**
1. `WeeklyReport` (admin/sec)
2. `MaquilaTracker` (recuadro "En Maquila" 🚚 naranja)
3. `Pipeline` (workflow interno por etapas)

**AHORA:**
1. `WeeklyReport` (admin/sec) — sin cambio
2. `Pipeline` (workflow interno: captura → pre-prensa → producción → salida)
3. `MaquilaTracker` (al final, como resumen suplementario por proveedor)

### Sin cambios
- Otros lugares donde se renderiza `MaquilaTracker` (vista `board` para producción/admin y para karla): mantienen su orden actual; este cambio afecta solo el Dashboard.
- Otros componentes, lógica, schema, RPCs.

---


## v10.36.1 — Fixes scan post-v10.36.0 — 21-may-2026

Pasada de bugs sobre v10.36.0. 3 altos + 1 medio aplicados. El supuesto crítico "legacy orders un-editables" fue **falso positivo**: el trigger early-returns en UPDATEs que no cambian `invoice_folio` (líneas 21-22 de la migration), así que la validación solo dispara en la asignación inicial. Sin regresión sobre órdenes legacy.

### 🟠 Altos
- **#3 `bankReference` persistía entre métodos bancarios distintos.** Karla escribía SPEI clave en transferencia → cambiaba a cheque → SPEI clave quedaba guardado como número de cheque. Defeat el propósito del lock v10.36.0. **Fix:** cleanup handler ahora solo preserva ref si el método clickeado es igual al actual; cambiar entre bancarios (transferencia→cheque, tarjeta→transferencia, etc.) limpia para forzar re-entrada con el formato correcto.
- **#9 `bank_reference` orphan cuando `method='otro'`.** Si Karla escribía ref y luego cambiaba a 'otro' sin click en button (ej. flujo de teclado), el state retenía la ref → `bankRefToSend` enviaba ref orphan al backend. **Fix:** en `handleConfirm` de ambos modales (InvoiceModal + PreInvoiceModal), `bankRefToSend = null` si `paymentMethod` no está en `['transferencia','tarjeta','cheque']`.
- **#2 Toast no soportaba mensajes largos del backend RAISE.** Mensajes "candado de seguridad" del trigger (~180 chars) se cortaban/desaparecían en 7s, sin word-break ni line-height. Karla no alcanzaba a leer la guía. **Fix:** detección de mensajes con "candado de seguridad" → duración extendida a 15s + `maxWidth:520`, `whiteSpace:pre-wrap`, `wordBreak:break-word`, `lineHeight:1.45`, `textAlign:left` para legibilidad.

### 🟡 Medio
- **#5 Comentarios stale en `db.assignInvoice`** (líneas 401-403). Listaban `efectivo` (removido) y missing `cheque`. **Fix:** comentarios v10.29.0/v10.30.0/v10.35.0 actualizados con v10.36.0 — referencian Candado #3 + RAISE del backend.

### Diferido a v10.37 / backlog
- #6 `bankRefValid` acepta 1 char ("x" pasa) — tightening a `>= 4` con hint, UX trade-off
- #8 Trigger usa `source != 'web'` sin COALESCE — NULL hole defensivo

### Sin cambios
- Schema, RPCs, trigger SQL.
- Lógica de pago web Mercado Pago (`paid_via_mp`).
- Flujo natural Lucero-genera-vale → invoice-se-paga.

---


## v10.36.0 — Cierre de huecos de seguridad PrintFlow → CobranzaFlow — 21-may-2026

Auditoría de seguridad del flujo bridge (post-junta 21-may) detectó que la opción "Karla marca paid+efectivo en PrintFlow" bypaseaba el **Candado #3** del Manual de Cobranza Padilla V2 (efectivo solo pasa por Tesorería). Adicionalmente, `bank_reference` era opcional para transferencia/tarjeta — impedía conciliación bancaria automática 95%.

### Cambios

**Backend SQL (`sync_invoice_from_orders`, migration `v36_bridge_security_validations`)**
- Bloque nuevo de validaciones de seguridad al inicio del trigger (después del check `invoice_folio`).
- **Bloquea `payment_method='efectivo'` con `paid` o `partial`:** RAISE EXCEPTION con mensaje explícito redirige al flujo de vale en CobranzaFlow.
- **Bloquea `transferencia/tarjeta/tarjeta_credito/cheque` sin `bank_reference`:** mensaje guía indica qué hacer si no tiene la ref.
- Validación solo aplica cuando `NEW.source != 'web'` (no afecta el flujo de MP web).
- Errores con "candado de seguridad" se **re-RAISE** para que PrintFlow los muestre al usuario. Errores genéricos siguen comportamiento histórico (loguean, no propagan).
- Bloques `paid` y `partial` ahora excluyen `efectivo` con `AND NEW.payment_method != 'efectivo'`.
- Agregado `cheque` como método válido en el CASE del `v_payment_type_cobranza`.
- `bank_reference` incluida en `v_payment_notes` para trazabilidad explícita.

**Frontend (`PaymentStatusPicker`)**
- Array `METHODS` actualizado: removido `efectivo`, agregado `cheque`. Métodos disponibles: Transferencia, Tarjeta, Cheque, Otro.
- `showBankRef` incluye `cheque` (transferencia/tarjeta/cheque cuando paid/partial).
- Nueva variable `bankRefMissing` flagea cuando la ref es obligatoria y está vacía.
- Input `bank_reference`: atributo `required`, borde rojo + label ámbar cuando vacío, placeholder dinámico según método (SPEI, voucher terminal, banco+cheque).
- Mensaje rojo de error visible debajo cuando `bankRefMissing`.
- Banner azul informativo cuando `status='unpaid'`: explica el flujo de vale en CobranzaFlow para pagos en efectivo.
- Cleanup handler de método: bancarios (transferencia/tarjeta/cheque) preservan `bankReference`, no-bancarios lo limpian.
- Mensajes de éxito (paid/partial) ahora solo aparecen cuando `bankRefValid` (defensa visual contra mostrar "irá a CobranzaFlow como pagada" sin la ref).

**`paymentValid` (ambos modales: `InvoiceModal` + `PreInvoiceModal`)**
- Nueva constante `requiresBankRef = ['transferencia','tarjeta','cheque'].includes(paymentMethod)`.
- Nueva constante `bankRefValid = !requiresBankRef || (bankReference && bankReference.trim().length > 0)`.
- `paymentValid` exige `bankRefValid` para paid/partial. Defensa en profundidad junto con el backend.

### Sin cambios
- Lógica de pago web Mercado Pago (`paid_via_mp`): sigue funcionando sin afectación (validación es `NEW.source != 'web'`).
- Invoices históricas pagadas vía bridge: se conservan tal cual (sin migración de datos).
- Schema `cash_vouchers`, `payments`, `invoices`, `orders`: sin cambios.
- Flujo natural Lucero-genera-vale → invoice-se-paga en CobranzaFlow: sigue funcionando exactamente igual (v1.5+).

### Impacto operativo para Karla
- **Cliente paga en efectivo en mostrador:** Karla asigna folio fiscal y marca **"No pagada"**. Lucero genera vale de caja y el sistema aplica el pago automáticamente.
- **Cliente paga por transferencia/tarjeta/cheque:** Karla **debe** capturar la referencia bancaria obligatoriamente (folio SPEI, voucher de terminal, banco+cheque). Si no la tiene, marca "No pagada" y aplica después desde CobranzaFlow.

### Excepción operativa al Manual
Este cambio **NO crea nueva excepción** al Manual de Cobranza Padilla V2 — al contrario, **RESTAURA** cumplimiento del Candado #3 que estaba siendo bypaseado. Ver `docs/EXCEPCION_OPERATIVA_v2.7.md` en repo `cobranzaflow` para documentación de la decisión.

---


## v10.35.1 — Fixes scan post-v10.35.0 — 20-may-2026

Pasada de bugs sobre `PaymentStatusPicker` y datos de `orders.bank_reference`. Acompaña a CobranzaFlow v1.9.1.

### 🔴 Crítico
- **#4 `PaymentStatusPicker` defaulteaba método silenciosamente.** Al clickear "Parcial" o "Pagada" sin haber elegido método, `onChange` pasaba `method || "efectivo"` → se guardaba como efectivo aunque el usuario no eligió, perdiendo intent + bank_reference. Cambiado a `method || null`. La validación `paymentValid` ya requería método truthy para habilitar Confirm → ahora obliga al usuario a elegir.

### 🟠 Alto
- **#7 CHECK constraint en `orders.bank_reference`.** Defensa de DB contra futuros bugs que dejen persistir referencia bancaria con método no-bancario. Constraint `orders_bank_reference_method_check`: permite `bank_reference IS NULL` o `payment_method IN ('transferencia','tarjeta')`. Sin violaciones existentes (verificado pre-migration).

### Backend (Supabase project `uvhardaeooaxjrrgdjwa`)

- Migration `orders_bank_reference_check_constraint_v10_35_1` — agrega constraint validado.

---


## v10.35.0 — bank_reference en bridge para conciliación automática 95% — 20-may-2026

Hoy CobranzaFlow v1.9 LIVE introdujo conciliación bancaria automática contra TXT del banco (Scotiabank/Banorte) con 3 estrategias de match:
- **E1 (95% confianza):** `bank_reference` exacto contra el concepto SPEI / clave de rastreo
- **E2 (70% confianza):** monto exacto + fecha ±3 días
- **E3 (50% confianza):** nombre cliente fuzzy + monto + fecha ±7 días

**Problema previo:** los payments que crea el bridge desde PrintFlow al asignar folio con `payment_status='paid'` y método bancario llegaban **sin `bank_reference`** → solo matcheaban con E2 (70%). Más huérfanos para Lucero.

**Solución v10.35.0:** Karla ahora captura la referencia bancaria opcional al asignar folio. El bridge la propaga a `cobranza.payments.bank_reference` para que CobranzaFlow concilie al 95% automáticamente.

**Nota de numeración:** el brief decía v10.33.0 pero esa versión ya existe (PTYPES extendido). Aplicado como **v10.35.0** (siguiente disponible tras v10.34.4).

### Backend (Supabase, aplicado vía MCP Claude.ai antes de este commit)

- **Columna nueva** `public.orders.bank_reference TEXT NULLABLE`.
- **RPC `assign_invoice` ampliada a 10 params** con `p_bank_reference text DEFAULT NULL`.
- **Validaciones server-side:** rechaza con error legible si `bank_reference` está presente pero `payment_method` ∉ (transferencia, tarjeta) o `payment_status` ∉ (paid, partial).
- **Trigger `sync_invoice_from_orders`** propaga `NEW.bank_reference` a `cobranza.payments.bank_reference` en los bloques manual paid y manual partial.

### Frontend (App.jsx)

- **`db.assignInvoice`** ([App.jsx:402](src/App.jsx#L402)): +10º parámetro `bankReference` → mapea a `p_bank_reference`.
- **`dbCols` whitelist** ([App.jsx:227](src/App.jsx#L227)): incluye `bank_reference` para que el optimistic update persista bien.
- **`PaymentStatusPicker`** ([App.jsx:1369](src/App.jsx#L1369)):
  - Nuevo prop `bankReference`.
  - `onChange` ahora recibe 4 valores: `(status, method, amount, bankReference)`.
  - Campo "🔗 Referencia bancaria" visible **solo si** `status ∈ (paid, partial)` Y `method ∈ (transferencia, tarjeta)`.
  - Placeholder contextual: "PAGO FACT D5775, clave rastreo SPEI" para transferencia, "autorización, últimos 4 dígitos" para tarjeta.
  - **Auto-limpieza:** al cambiar a método no-bancario (efectivo/otro), el `bankReference` se setea a `null` automáticamente (evita rechazo del backend).
  - Tip explicativo: "💡 Captura lo que el cliente puso en el SPEI o la clave de rastreo del banco. Esto permite que CobranzaFlow concilie el pago automáticamente al 95%."
  - Confirmación visual: "Con ref para conciliación bancaria." aparece en los resúmenes de paid/partial cuando el campo está lleno.
- **`InvoiceModal` y `PreInvoiceModal`** ([App.jsx:1523, 1683](src/App.jsx#L1523)):
  - State nuevo `bankReference`.
  - Reseteado al cambiar tipo de comprobante (Factura ↔ Remisión).
  - `handleConfirm` trim()ea el valor y pasa `bankRefToSend` al callback (`null` si vacío).
- **Callbacks en App** ([App.jsx:7155, 7178](src/App.jsx#L7155)):
  - Reciben 6° (InvoiceModal) o 7° (PreInvoiceModal) argumento `bankReference`.
  - Lo pasan a `db.assignInvoice`.
  - Optimistic update incluye `bank_reference` para coherencia inmediata con el realtime.

### Casos cubiertos

- ✅ Karla escribe folio + Pagada + Transferencia + ref "D5775" → factura llega a cobranza pagada, payment con `bank_reference='D5775'`, conciliará al 95% cuando Lucero suba el TXT del banco con ese SPEI.
- ✅ Karla escribe folio + Pagada + Efectivo → campo de ref bancaria NO aparece (efectivo no aplica).
- ✅ Karla escribe folio + Pagada + Transferencia + ref → cambia método a Efectivo → ref se limpia automáticamente (no se envía).
- ✅ Karla escribe folio + Parcial + monto + Tarjeta + ref → mismo flujo, payment del anticipo con bank_reference.
- ✅ No pagada → ni método ni ref bancaria aparecen (campo unpaid).
- ✅ Backend valida defensa en profundidad: si por alguna razón se envía bank_reference con efectivo/otro/unpaid, RPC arroja error legible.

### Beneficio esperado

Las facturas con pago manual bancario llegarán a CobranzaFlow listas para conciliarse al 95% (estrategia `exact_ref`) en lugar de 70% (`amount_date`). Menos movimientos huérfanos para Lucero, conciliación más confiable.

### Sin cambios

- Schema (backend ya estaba aplicado antes de este commit)
- Pedidos web MP (siguen usando `mp_payment_id` como `bank_reference` automático; ese flujo no se toca — el bloque IF de MP en el trigger está intacto)
- Vouchers de efectivo en CobranzaFlow (no aplica)
- Funcionalidad de v10.29/v10.30/v10.31/v10.32/v10.33/v10.34 intacta


## v10.34.4 — Bug scan #6: críticos + medios fix bundle (8 fixes) — 19-may-2026

Scan exhaustivo de áreas no auditadas previamente + edge cases de v10.34.3. 8 fixes en un commit. Sin cambios SQL.

### 🟠 Altos

**1. Calendar pintaba "Retrasada" al día de hoy en vista Mes** ([App.jsx:2277](src/App.jsx#L2277))
`day=new Date(monthYear,monthIdx,d)` se crea a medianoche local; `today=new Date()` tiene hora actual. `day<today` siempre `true` para el día actual → celda de hoy aparecía con borde rojo todo el día. La vista semana no tenía el bug (preservaba la hora).
**Fix:** `todayMid=new Date(t.getFullYear(),t.getMonth(),t.getDate())` y comparar contra eso.

**2. Image upload race → imagen huérfana en storage** ([App.jsx:2616, 2826](src/App.jsx#L2616))
Si Lupita subía imagen pesada y clicaba "Crear Orden" antes de que terminara el upload, `f.image_url` aún era null → la orden se guardaba sin imagen, la imagen quedaba en storage sin referencia (huérfano). `FileUpload` tenía este flag pero el image picker no.
**Fix:** state `imgUploading` se setea durante compresión + upload; `canSubmit` lo incluye en su check; botón muestra "⏳ Subiendo imagen..." durante el upload.

**3. `update()` no detectaba orden cancelada por realtime → sobreescribía silenciosamente** ([App.jsx:6275](src/App.jsx#L6275))
Lupita editaba orden X. Marcelo la cancelaba en otro tab. Realtime actualizaba `orders` pero `editO` quedaba con versión vieja. Lupita guardaba → cambios se persistían sobre orden cancelada sin advertencia.
**Fix:** antes del UPDATE, si `orderBefore.stage` está en `[cancelled, maq_cancelled, web_rejected]`, abortar con toast claro "La orden cambió de estado mientras editabas. Recarga y vuelve a intentar." Bandera `_toasted` evita doble notificación en el catch.

**4. Analytics "vs mes anterior" calculaba -30 días, no mes calendario** ([App.jsx:4292](src/App.jsx#L4292))
`new Date(Date.now()-30*86400000)` no es lo mismo que "mes anterior". Si hoy era 31-mar, -30d caía en marzo → `prevM=curM` → `revChange=0%` siempre.
**Fix:** `new Date(); .setDate(1); .setMonth(-1);` para obtener inicio del mes calendario previo.

**5. pnValidation race + regex laxo permitía folios fuera de convención** ([App.jsx:2681, 6123](src/App.jsx#L2681))
Si Lupita tipeaba "P-3" y clicaba Save dentro de los 400ms del debounce, `pnValidation` seguía en `valid:true,message:null` (estado inicial) → guard del submit pasaba. El regex en create `/^P-\d+$/` aceptaba "P-3" → se persistía folio fuera de la convención de 4 dígitos.
**Fix:**
- Regex en create endurecido a `/^P-\d{4,}$/` (4 dígitos mínimo)
- Submit ahora hace "flush" del debounce: si hay timer pendiente, ejecuta validación síncrona antes de seguir

### 🟡 Medios

**6. `approveCartComplete` sin actionLoading → doble-click disparaba 2 RPCs** ([App.jsx:6663](src/App.jsx#L6663))
A diferencia de `webApprove`/`webReject`, no seteaba `actionLoading`. El `cartBusy` que calcula `WebCartCard` quedaba en false. Doble-click pasaba `confirm()` y disparaba 2 RPCs + 2 notifs (la 2ª RPC era idempotente pero las notifs se duplicaban).
**Fix:** `setActionLoading(firstOrderId)` + `finally{setActionLoading(null)}`.

**7. `nextPN` sugería P-0001 al rollover P-5000 (folio que ya existe)** ([App.jsx:2641](src/App.jsx#L2641))
`next=max>=5000?1:max+1` proponía "P-0001" cuando max≥5000. Si P-0001 ya existía (de años atrás), el placeholder sugería un folio que `validate_production_number` rechazaba sin razón obvia.
**Fix:** al hacer rollover, buscar el primer hueco libre entre 1 y 5000 con `while(used.has(next))next++;`. Si no hay hueco, fallback a `max+1` (overflow controlado). También simplifiqué el post-submit reset para que delegue al placeholder del useMemo.

**8. StorageTab `list("",{limit:1000})` truncaba silenciosamente** ([App.jsx:3736](src/App.jsx#L3736))
Con >1000 órdenes con archivo (cerca según `nextPN` rollover en 5000), folders más allá del 1000 nunca aparecían → cleanup nunca los detectaba como huérfanos, gauge de storage subestimado.
**Fix:** paginar con `offset` hasta agotar (safety cap 50k folders).

### Sin cambios

- DB schema
- Backend / RPCs / triggers / bridge
- Funcionalidad de v10.34.x intacta

### Lower priority bugs sin fix (cosméticos)

- ChemicalPanel doble fetch al guardar (#9): redundante pero inocuo
- WeeklyReport "atrasadas" oscila al mediodía (#10): edge cosmético
- Submit doble feedback toast+alert (#11): minor UX


## v10.34.3 — Hotfix: respetar folio P-XXXX que el usuario escribió — 19-may-2026

Bug reportado por Marcelo: Lupita guardó orden como **P-3523** pero se persistió como **P-3527** — el sistema ignoró lo que escribió.

### Causa raíz

En `create` ([App.jsx:6113](src/App.jsx#L6113)), el flujo era:

```js
let assignedPN = f.production_number;              // P-3523 escrito por Lupita
const {data:rpcPN} = await supabase.rpc("next_production_number");
assignedPN = rpcPN;                                // P-3527 — sobreescribe SIEMPRE
```

El RPC `next_production_number` se llamaba **incondicionalmente** y siempre sobreescribía el valor del usuario. La validación `validate_production_number` (debounced 400ms, muestra "✓ OK" en la UI) confirmaba que P-3523 estaba libre, pero el `create` ignoraba ese valor.

**Diff de 4 explicado:** entre que Lupita abrió el form (preview "P-3523") y le dio Guardar, 4 órdenes más se crearon en el sistema (Genaro, pedidos web). El contador atómico del RPC incrementó a 3527.

Comportamiento introducido en v10.20.0 para prevenir duplicados — pero hacía el input visualmente engañoso (parecía editable pero su valor se descartaba).

### Fix (Marcelo eligió: "Respetar lo que escriba siempre")

`create` ahora **respeta `f.production_number`** si tiene formato válido `P-\d+`. El RPC `next_production_number` queda como **fallback** solo si el campo está vacío o con formato inválido.

```js
let assignedPN = (f.production_number||"").trim();
if (!assignedPN || !/^P-\d+$/.test(assignedPN)) {
  // Fallback: RPC atómico si el usuario no escribió folio válido
  const {data:rpcPN} = await supabase.rpc("next_production_number");
  assignedPN = rpcPN;
}
// Si escribió uno válido, se usa directo. Validación + UNIQUE INDEX son las redes de seguridad.
```

### Defensa contra race conditions

Dos capas siguen vigentes:

1. **`validate_production_number` (debounced 400ms en UI)** — informa al usuario si el folio está tomado antes de guardar. Si Lupita ve "⚠️ Folio inválido", el submit ya retornaba early con alert (lógica existente intacta).

2. **`idx_orders_production_number_unique` (UNIQUE INDEX parcial en BD)** — atrapa colisiones atómicas en el INSERT. Verificado en BD:
   ```
   CREATE UNIQUE INDEX idx_orders_production_number_unique ON public.orders
   USING btree (production_number)
   WHERE (production_number IS NOT NULL AND production_number <> '');
   ```

### Mejora del error message

El `catch` del create ahora detecta violación de UNIQUE INDEX y muestra mensaje específico:

> ❌ El folio P-3523 fue tomado por otra orden mientras guardabas. Cámbialo y vuelve a intentar.

En lugar del genérico "❌ No se pudo crear: duplicate key value violates unique constraint...".

### Casos cubiertos

- ✅ Lupita escribe **P-3523** → se guarda como P-3523 (si libre)
- ✅ Lupita escribe **P-9999** (folio adelantado) → se guarda como P-9999
- ✅ Lupita deja vacío el campo → RPC asigna siguiente automáticamente (fallback)
- ✅ Lupita escribe folio inválido como "ABC" → RPC asigna siguiente (fallback)
- ✅ Race rara (2 usuarios escriben el mismo folio simultáneo) → UNIQUE INDEX rechaza el segundo, mensaje claro "fue tomado por otra orden"

### Sin cambios

- DB schema (el UNIQUE INDEX ya existía desde v10.20.0)
- RPC `next_production_number` (sigue intacto, se usa como fallback)
- RPC `validate_production_number` (sigue corriendo en UI mientras Lupita escribe)
- Lógica de `duplicate` y `webApprove` (esas seguirán usando RPC porque no hay input de usuario)


## v10.34.2 — Bug scan v10.33/v10.34 fix bundle (10 fixes) — 19-may-2026

Scan exhaustivo post-deploy de v10.33.0 (productos extendidos + tamaños estándar) y v10.34.0/v10.34.1 (combobox typeahead). 10 fixes en un solo commit. Sin cambios SQL.

### 🟠 Altos

**1. Búsqueda no encontraba órdenes por tamaño estándar** ([App.jsx:6924](src/App.jsx#L6924))
`searchFilter` no incluía `o.standard_size` ni su label. Buscar "carta" no traía órdenes con `standard_size="carta"` aunque la UI mostrara "Carta" en todas las tarjetas.
**Fix:** agregado `o.standard_size, ssLabel(o.standard_size)` al array de campos buscables.

**2. Combobox sin navegación por teclado** ([App.jsx:2627-2680](src/App.jsx#L2627))
El input no manejaba Enter/Arrows/Escape. Usuario escribía "fol" → solo aparecía "Folders" → Enter no hacía nada.
**Fix:** state `prodTypeHl` + `onKeyDown` con ArrowUp/Down para mover índice resaltado, Enter para seleccionar match resaltado (o "Otro" si está al final), Escape para cerrar.

**3. Filtro no accent-insensitive** ([App.jsx:2638](src/App.jsx#L2638))
Escribir "diptico" no encontraba "Dípticos". Real para hispanohablantes que escriben sin tildes; terminaban guardando "diptico" custom.
**Fix:** helper `normForSearch` con `.normalize("NFD").replace(/[combining-marks]/g,"")`. "Dípticos" matchea "diptico".

**4. Sentinel "Otro" invisible confundía al usuario** ([App.jsx:2671, 2645](src/App.jsx#L2671))
Click "Otro" sin escribir → state `"Otro"` pero input vacío con placeholder normal. Submit fallaba "Tipo faltante" sin pista visual.
**Fix:** al hacer click en "Otro", refocus inmediato al input + placeholder dinámico "Escribe el tipo personalizado..." cuando `f.product_type==="Otro"`.

### 🟡 Medios

**5. PrintOrder con sección "Impresión" casi vacía si solo hay standard_size** ([App.jsx:1003](src/App.jsx#L1003))
`hasSpecs` incluía `standard_size`, activando la tabla con celdas Papel/Gramaje/Tintas vacías y solo "Medidas" llena. Luce como error en PDF.
**Fix:** `hasSpecs=!!(o.paper_type||o.ink_front||o.width_cm)` — excluye standard_size del trigger.

**6. Casing inconsistente fragmentaba reportes** ([App.jsx:2653-2664](src/App.jsx#L2653))
Usuario escribía "folders" sin click → se guardaba literal. Reportes por `product_type` veían "folders" y "Folders" como categorías separadas.
**Fix:** en `onBlur` del combobox, si el texto matchea un PTYPE case-insensitive, normalizar a la versión canónica ("folders" → "Folders").

**7. `byType` en ClientHistory no manejaba product_type vacío** ([App.jsx:1239](src/App.jsx#L1239))
`byType[o.product_type]` con `product_type=""` o null generaba clave vacía y chip raro. Inconsistente con línea 2391 que ya tenía el patrón correcto.
**Fix:** `const k=o.product_type||"?"` antes del increment.

**8. Toggle medida perdía valores al alternar** ([App.jsx:2849](src/App.jsx#L2849))
Click "📐 Tamaño estándar" limpiaba `width_cm/height_cm`. Si volvía a "✏️ Medida en cm", cm seguían vacíos — usuario reescribiendo.
**Fix:** el toggle ya no limpia el campo opuesto (preserva ambos en state). Mutual exclusion enforced al guardar: en `create` y `update`, si `standard_size` truthy → `width_cm=null, height_cm=null`. BD queda limpia, usuario puede alternar libremente.

### 🟢 Bajos

**9. XSS potencial en PrintOrder via `standard_size` corrupto** ([App.jsx:932, 1011, 1022](src/App.jsx#L932))
Si la BD tuviera `standard_size="<img src=x onerror=...>"` (requiere acceso directo a BD, no por UI), `ssLabel` lo concatenaba sin escape en el template HTML del popup de impresión, ejecutando script en esa ventana.
**Fix:** helper `esc()` en PrintOrder que escapa `<>&"`. Aplicado a las 2 interpolaciones de `ssLabel(o.standard_size)`. Las demás interpolaciones de campos legacy (client, paper_type, etc.) tienen la misma vulnerabilidad pre-existente — fuera de scope.

**10. `addProductToOC` no pre-llenaba `product_type`** ([App.jsx:6153](src/App.jsx#L6153))
Antes de v10.34.1 había un default "Etiqueta colgante" útil. Ahora vacío. En OCs con múltiples productos del mismo tipo (e.g. 5 variantes de Etiquetas), Karla reseleccionaba cada vez.
**Fix:** derivar `product_type` de la orden más reciente de la OC (`orders.filter(x=>x.purchase_order_id===oc.id).sort(...)[0]?.product_type||""`).

### Sin cambios

- DB schema
- Backend / RPCs / triggers / bridge
- Funcionalidad de v10.33.0/v10.34.0/v10.34.1 intacta


## v10.34.1 — Hotfix: campo Tipo inicia vacío en orden nueva — 19-may-2026

Reportado por Marcelo inmediatamente tras v10.34.0: al abrir formulario de orden nueva, el campo "Tipo" tenía "Etiqueta colgante" precargado como default (heredado del antiguo `<select>` que necesitaba un valor inicial). Con el nuevo combobox typeahead, esto obligaba al usuario a borrar el valor antes de escribir/buscar lo que quería.

### Fix

`empty` object ([App.jsx:2608](src/App.jsx#L2608)): `product_type:"Etiqueta colgante"` → `product_type:""`.

Ahora al crear orden nueva:
- Input "Tipo" inicia vacío
- Placeholder visible: "Escribe o busca un tipo..."
- Al hacer focus se abre el dropdown con las 21 opciones
- Validación intacta: si se intenta enviar con campo vacío, marca "Tipo de Producto" como faltante

### Sin cambios

- DB schema, RPCs, triggers
- Edición de órdenes existentes (siguen cargando su `product_type` real)
- Funcionalidad del combobox v10.34.0


## v10.34.0 — Tipo de producto: combobox typeahead — 19-may-2026

Pedido de Marcelo (post v10.33.0): el dropdown del campo "Tipo" en el formulario de orden ahora es un **combobox typeahead** — input de escritura libre que filtra las opciones de `PTYPES` mientras escribes, con "Otro" siempre visible al final del dropdown.

### Comportamiento

- **Input siempre editable** — escribe el tipo libremente (búsqueda + valor en uno).
- **Al hacer focus** → dropdown abre y muestra todas las opciones de `PTYPES` (las 21 nuevas y existentes de v10.33.0).
- **Al escribir** → dropdown filtra por substring case-insensitive (ej. escribir "fol" muestra "Folleto", "Folders").
- **Click en una opción** → se selecciona y cierra el dropdown.
- **"✏️ Otro (escribir libre)" siempre al final** del dropdown como recordatorio visual de que se puede capturar cualquier valor.
- **Sin coincidencias** → muestra hint "Sin coincidencias en lista — se guardará como 'X'" + opción "Otro" sigue disponible.

### Cambios

- **State nuevo** `prodTypeOpen` ([App.jsx:2616](src/App.jsx#L2616)) — controla apertura del dropdown.
- **Bloque `<select>+<input>`** ([App.jsx:2744](src/App.jsx#L2744)) reemplazado por combobox: input `value={f.product_type==="Otro"?"":f.product_type}` con `onFocus/onBlur` para abrir/cerrar dropdown y `onChange` para captura libre.
- **`onBlur` con `setTimeout(200ms)`** para dar tiempo al `onMouseDown` de los items antes de cerrar.
- **Indicador visual ▼/▲** a la derecha del input.

### Compatibilidad

- **Backward compatible:** órdenes existentes con cualquier `product_type` (de PTYPES o custom) se cargan sin problema.
- **Sentinel "Otro" preservado** para órdenes legacy.
- **El campo se sigue persistiendo igual** — un string que puede o no estar en PTYPES.

### Sin cambios

- DB schema
- Backend / RPCs / triggers / bridge
- `PTYPES` constante (21 opciones de v10.33.0)
- Otras vistas (DetailModal, OCard, PrintOrder, CSV) — siguen mostrando `o.product_type` literal


## v10.33.1 — Bug scan v10.33.0: 3 fixes (Telegram label + sanitize + fallback) — 19-may-2026

Scan post-deploy de v10.33.0. 3 bugs reales corregidos en un solo commit. Sin cambios SQL.

### 🟡 Fix #1 — Telegram mostraba ID en vez de label legible

`fmtEditValue` ([App.jsx:86](src/App.jsx#L86)) para `standard_size` caía al fallback `String(v)` retornando `"carta"` en lugar de `"Carta"`. El mensaje de Telegram cuando alguien cambiaba el tamaño decía "Tamaño estándar: oficio → carta" — feo y confuso.
**Fix:** caso explícito `if(field==="standard_size")return ssLabel(v)||v;` antes del fallback. Ahora muestra "Oficio → Carta" correctamente.

### 🟡 Fix #2 — `standard_size=""` se persistía como string vacío en BD

Ni `create` ([App.jsx:6059](src/App.jsx#L6059)) ni `update` ([App.jsx:6172](src/App.jsx#L6172)) sanitizaban el campo `standard_size`. Cuando el usuario hacía toggle de "Estándar" a "Medida en cm", el state quedaba con `standard_size=""` y se persistía literalmente como `""` (no NULL). Display funcionaba (`""` es falsy en el ternario) pero:
- Queries SQL `WHERE standard_size IS NOT NULL` traerían filas con `""` (engañoso)
- Viola la semántica documentada en el comment de la columna
- CSV exportaría `""` como string vacío en vez de celda vacía
**Fix:** sanitización `""` → `null` en ambos handlers (consistente con el patrón existente de `due_date`).

### 🟡 Fix #3 — ID legacy/corrupto → display silenciosamente vacío

Si la BD tenía un `standard_size="some_id_que_no_existe"` (legacy, futuro rename, o seteado manualmente vía API), `ssLabel()` retornaba `""`. El display ternario `o.standard_size?ssLabel(...):(o.width_cm?...)` evaluaba el primer condicional como truthy pero mostraba string vacío — y nunca caía al fallback de `width_cm`. Si `width_cm` también era NULL, la orden parecía no tener medidas aunque sí las tuviera.
**Fix:** `ssLabel` ahora retorna `"⚠️ "+id` cuando el ID no se reconoce, en lugar de string vacío ([App.jsx:18](src/App.jsx#L18)). Aplica automáticamente a los 7 display points (DetailModal, 3 OCards, PrintOrder ×2, CSV) sin tocarlos.

### Falsos positivos verificados / aceptables (no fix)

- **`hasSpecs` incluye standard_size aunque resto esté vacío** — render con filas vacías es OK, ya pasa con otros campos.
- **Toggle cm→estándar dispara 3 cambios en Telegram** (width_cm→null, height_cm→null, standard_size→carta) — ruidoso pero técnicamente correcto.
- **Datos legacy con ambos seteados** — toggle prioriza estándar; comportamiento explícito al usuario.
- **`select` con ID inválido** — visualmente muestra la primera option pero state preserva el valor. Solo ocurre si la BD tiene corrupción; el usuario puede simplemente reseleccionar.

### Sin cambios

- DB schema
- Backend / RPCs / triggers / bridge
- Funcionalidad de v10.33.0 (PTYPES extendido, toggle UI, 17 tamaños) intacta


## v10.33.0 — Productos extendidos + Tamaños estándar — 19-may-2026

Solicitado por Lupita. Aplica a todos los que crean órdenes (Lupita, Genaro, Marcelo).

**Nota de numeración:** el brief proponía v10.13.0 (typo evidente — esa versión es de enero 2026); aplicado como v10.33.0 que es la siguiente en la secuencia post v10.32.3.

### Nuevas funcionalidades (2)

1. **11 productos nuevos en dropdown Tipo:** Lonas, Banners, Folders, Dípticos, Trípticos, Recetas, Hojas membretadas, Notas, Etiquetas (genérico) — además de los 12 existentes (Etiqueta colgante/adherible siguen como opciones distintas). Total 21 opciones.

2. **Selector de Tamaño Estándar** — Toggle mutuamente excluyente en el formulario de orden:
   - **✏️ Medida en cm** (modo actual con inputs Ancho/Alto)
   - **📐 Tamaño estándar** (dropdown con 17 tamaños comunes de imprenta MX agrupados por familia)
   - **17 tamaños** distribuidos en 5 grupos:
     - **Imprenta:** Pliego (70×95cm), Medio pliego, Doble oficio, Doble carta / Tabloide
     - **Oficio:** Oficio, Media oficio, 1/4 de oficio, 1/8 de oficio
     - **Carta:** Carta, Media carta, 1/4 de carta, 1/8 de carta
     - **ISO (A):** A3, A4, A5, A6
     - **Tarjetas:** Tarjeta de presentación (9×5.5cm)
   - Si se selecciona un estándar → `width_cm`/`height_cm` se limpian automáticamente (exclusión enforced en UI)
   - Si se vuelve a "Medida en cm" → `standard_size` se limpia
   - El **valor que se introdujo es el que se muestra** en DetailModal, OCard, orden impresa (literalmente "Carta" en lugar de "21.59 × 27.94 cm")

### Backend (Supabase)

- **Nueva columna** `orders.standard_size TEXT NULLABLE` — almacena el ID del tamaño elegido (`"carta"`, `"oficio"`, `"a4"`, etc).
- **Sin migración de datos existentes:** las ~3,500 órdenes existentes quedan con `standard_size=NULL` y siguen mostrando su `width_cm/height_cm` como hoy.

### Frontend (App.jsx)

- **Constante `PTYPES`** extendida de 12 → 21 productos ([App.jsx:14](src/App.jsx#L14)).
- **Constante nueva `STANDARD_SIZES`** ([App.jsx:15](src/App.jsx#L15)): 17 objetos `{id, label, w, h, group}` con dimensiones reales.
- **Helpers** `SS_BY_ID` (lookup) y `ssLabel(id)` (resuelve ID → label legible).
- **`TRACKED_EDIT_FIELDS`** ([App.jsx:56](src/App.jsx#L56)): agregado `standard_size:"Tamaño estándar"` — notifica vía Telegram cuando cambia.
- **`dbCols` whitelist + `editableFields`** ambos extendidos con `"standard_size"`.
- **`empty` form object** del OrderForm: `standard_size:""`.
- **`OrderForm`** ([App.jsx:2739](src/App.jsx#L2739)): bloque Ancho/Alto cm reemplazado por toggle ✏️/📐 con renderizado condicional (select con `<optgroup>` si estándar, inputs cm si no).
- **`DetailModal`** ([App.jsx:1155](src/App.jsx#L1155)): Row "Medidas" prioriza `standard_size` sobre `width_cm/height_cm`.
- **`PrintOrder`** ([App.jsx:996,1002,1013](src/App.jsx#L996)): `hasSpecs` incluye `standard_size`; "Tamaño Final" y columna Medidas priorizan estándar.
- **3 OCards de listado** ([App.jsx:3038](src/App.jsx#L3038), [4066](src/App.jsx#L4066), [4169](src/App.jsx#L4169)) actualizadas con misma lógica de prioridad.
- **CSV export** ([App.jsx:6943](src/App.jsx#L6943)): nueva columna `TamañoEstándar` al final con label legible.

### Aplicabilidad por rol

El formulario `OrderForm` es compartido entre todos los roles que crean órdenes. Sin gates adicionales:
- **Lupita** (secretaria) — crea órdenes desde +Nueva
- **Genaro** (vendedor) — crea órdenes desde +Nueva
- **Marcelo** (admin) — crea órdenes desde +Nueva o desde una OC existente

### Compatibilidad

- Órdenes con `width_cm/height_cm` previos siguen mostrándose como antes ("21.5 × 28 cm")
- Órdenes nuevas pueden usar cualquiera de los dos modos (mutuo excluyente en UI)
- Edición de orden existente con cm puede convertirse a estándar (limpia cm automáticamente) y viceversa

### Sin cambios

- RPCs, triggers, bridge a CobranzaFlow
- Permisos por rol
- Otras vistas / flujos


## v10.32.3 — Pestaña Histórico de OCs + CHANGELOG retroactivo — 18-may-2026

Complemento frontend del fix v10.32.2 (auto-complete OC). Las OCs cerradas (`completed` o `cancelled`) ahora aparecen en una pestaña separada "📚 Histórico" en lugar de contaminar la lista principal.

### Frontend (App.jsx)

- **Tabs en `OrdenesCompraView`** ([App.jsx:5567](src/App.jsx#L5567)): "📋 Activas" / "📚 Histórico" con conteo en cada tab (`tabCounts` useMemo independiente).
- **Filtro `complexOCs` ampliado** ([App.jsx:5439](src/App.jsx#L5439)): excluye `completed` y `cancelled` del tab Activas; en Histórico sólo muestra esos dos status.
- **Tab Histórico:** OCs ordenadas por `completed_at`/`cancelled_at` descendente (fallback `created_at`). Cards muestran timestamp y autor del cierre. Razón de cancelación visible si existe.
- **OCs históricas en read-only:** las acciones ("+ Agregar producto", "Asignar folio") ya estaban bloqueadas por status checks existentes en el detalle de OC ([App.jsx:5487-5488](src/App.jsx#L5487)). Cero cambio necesario allá.
- **Botón "+ Nueva OC"** oculto en tab Histórico ([App.jsx:5560](src/App.jsx#L5560)).
- **Subtítulo dinámico** según tab.

### Sin cambios

- DB schema (cero migración)
- Backend / triggers / RPCs (los SQL de v10.32.1 y v10.32.2 ya estaban aplicados antes de este commit)

### Estado al deploy

3 OCs complex en BD: 1 abierta (Activas), 1 completada + 1 cancelada (Histórico = 2).


## v10.32.2 — Hotfix: OCs fantasma + trigger auto-complete OC — 18-may-2026

Bug reportado por Marcelo: OC-6 (VICTOR FONSECA PRECIADO) y otras seguían apareciendo en la lista de Karla como "En proceso" aunque todas sus órdenes ya estuvieran entregadas con folio asignado.

### Causa

Cuando una orden pasaba a `delivered`/`maq_delivered`, el `purchase_orders.status` no se actualizaba. No existía mecanismo automático para cerrar la OC al completarse todas sus órdenes.

### Backend (Supabase, aplicado vía MCP de Claude.ai antes del commit)

- **Columnas nuevas en `purchase_orders`:**
  - `completed_at TIMESTAMP WITH TIME ZONE` — momento del cierre automático
  - `completed_by TEXT` — usuario que cerró la última orden activa (resuelto desde `NEW.invoiced_by` o `NEW.cancelled_by`)
- **Función nueva `auto_complete_purchase_order()`:** detecta cuándo una orden cambia a stage final (`delivered`, `maq_delivered`, `cancelled`, `maq_cancelled`); si la OC asociada ya no tiene órdenes activas, marca `status='completed'` con timestamp.
- **Trigger nuevo `trg_auto_complete_oc`** AFTER UPDATE OF stage ON orders: invoca la función automáticamente.
- **Limpieza retroactiva:** 4 OCs fantasma cerradas con `completed_by='system_cleanup_v10_32_2'` (OC-6, OC-11, OC-16, OC-17).

### Aplicación

Migration `v10_32_2_auto_complete_oc_when_all_orders_done` aplicada vía Claude.ai Supabase MCP. Documentación aplicada retroactivamente en v10.32.3.

### Sin cambios

- Frontend (esto se completa en v10.32.3)
- RPCs existentes
- Bridge a CobranzaFlow

### Validación post-fix

- ✅ 0 OCs fantasma restantes
- ✅ Trigger creado y verificado
- ✅ 4 OCs limpiadas con timestamps históricos correctos


## v10.32.1 — Hotfix: idx_one_active_per_machine bloqueaba mover orden activa entre máquinas — 18-may-2026

Bug reportado por Gerardo: al arrastrar una orden activa (`machine_queue_position = 0`) de una máquina a otra, PrintFlow rebotaba con error `duplicate key value violates unique constraint "idx_one_active_per_machine"`.

### Causa

La RPC `move_order_in_queue` (v10.26.0) hacía el shift de la máquina vieja ANTES de sacar la orden movida del índice parcial. Durante el shift, la orden vieja seguía con `position=0` mientras otra orden (la que estaba en posición 1) subía también a `position=0`, violando el UNIQUE INDEX que PostgreSQL evalúa al final de cada statement.

### Fix

Pre-paso al inicio del Caso 2 (MOVER) que setea `machine_queue_position = NULL` para la orden a mover, sacándola del índice parcial antes de cualquier shift. Los pasos existentes (2a, 2b, 2c, 2d) ahora ejecutan sin riesgo de duplicación temporal.

### Backend (Supabase, aplicado vía MCP)

Migration `v10_32_1_hotfix_move_order_in_queue_unique_violation` reemplaza la función `move_order_in_queue` con un pre-paso adicional. Firma idéntica (4 params, mismo retorno jsonb), backward compatible.

### Validación

- ✅ P-3503 movida exitosamente entre `ac_polar78` y `off_gto` (antes fallaba)
- ✅ Reordenar dentro misma máquina: sin regresión
- ✅ Sacar de cola (Caso 1): sin cambio
- ✅ Mover orden no-activa (position >= 1): sin cambio

### Aplicación

Aplicado vía Claude.ai Supabase MCP. Documentación aplicada retroactivamente en v10.32.3.

### Sin cambios

- Frontend (la RPC es transparente al cliente)
- Vercel deploy no requerido


## v10.32.0 — Salud Operativa habilitada para Lupita con scope limitado — 18-may-2026

Lupita (secretaria) ahora puede acceder a la vista creada en v10.28.0 con título adaptado **"📝 Datos Pendientes"** y scope restringido a captura/datos sin acciones administrativas.

### Caso de uso

Lupita necesita ver órdenes con datos incompletos para corregirlas (su trabajo es captura). La vista era admin-only desde v10.28.0; esta versión la habilita a secretaria.

### Frontend (App.jsx)

- **Gating ampliado** ([App.jsx:4835](src/App.jsx#L4835)): `OperationalHealthView` ahora acepta `role === "secretaria"` además de admin.
- **Título dinámico** ([App.jsx:4977](src/App.jsx#L4977)):
  - Secretaria → "📝 Datos Pendientes" / "Órdenes que requieren tu atención para completar datos."
  - Admin → "🩺 Salud Operativa" / "Supervisión diaria del taller." (sin cambio)
- **Tab en nav principal para Lupita** ([App.jsx:6837](src/App.jsx#L6837)): `{ id: "health", i: "📝", l: "Datos Pendientes" }` insertado entre "tasks" y "form" (flujo natural: tareas → datos pendientes → nueva orden). Cabe en los primeros 5 navs de Lupita; no va a "⋯ Más".
- **Card propia destacada** en "Pulso por Responsable" ([App.jsx:5031](src/App.jsx#L5031)): cuando Lupita ve su card de secretaría, borde `2px solid #5856d6` + badge "👤 Tú" en esquina superior derecha.
- **Renders condicionales admin-only:**
  - Botón "📣 Notificar responsable" en Top Prioridad ([App.jsx:5014](src/App.jsx#L5014)) — escalación es decisión de Marcelo
  - Sección completa "🧹 Limpieza Sugerida" ([App.jsx:5208](src/App.jsx#L5208)) — cancelar OCs huérfanas y marcar notifs leídas son acciones admin
- **Switch guard ampliado** ([App.jsx:6924](src/App.jsx#L6924)): `view==="health" && (user==="admin"||user==="secretaria")`.
- **Sin cambio para Lupita** en:
  - Botón "✏️ Editar" en Datos Incompletos (es su trabajo capturar)
  - Top Prioridad informativo (lectura, no acción)
  - Estancadas, Datos Incompletos, Estado de Máquinas (5 secciones útiles)

### Nota: Top 5 Clientes NO está en este componente

El brief mencionaba ocultar "Top 5 Clientes con dinero atorado" para Lupita. Esa sección está en `WIPDashboard` (vista "💰 Dinero en Proceso", admin-only desde v10.27.0), no en `OperationalHealthView`. Lupita nunca la verá porque no tiene acceso a WIPDashboard.

### Sin cambios

- DB schema (cero migración)
- SQL / RPCs / triggers
- `OrderForm` y `handleAction` (permisos por role ya estaban correctos)
- Vista para Marcelo (admin): sin regresión, todo igual que v10.31.1
- Otros roles (Gerardo, Noemí, Germán, Karla, Genaro): no ven la tab

### Decisiones de diseño

| ID | Decisión | Rationale |
|---|---|---|
| D-1 | Lupita ve secciones 1-5, NO ve Limpieza | Acciones admin afuera |
| D-2 | Card propia destacada con borde grueso + "👤 Tú" | Útil saber "esta soy yo" sin paternalismo |
| D-3 | Botón "📣 Notificar" solo admin | Decisión de escalación es de Marcelo |
| D-4 | Botón "✏️ Editar" sí lo ve Lupita | Es su trabajo capturar datos |
| D-5 | Título adaptado por rol | Reflejar el uso real |
| D-6 | Tab principal (insertado entre tasks/form) | Uso diario, visible sin overflow |
| D-7 | Marcelo sin regresión | Cero impacto en flujo existente |

### Validación post-deploy

- ✅ Login Lupita → tab "📝 Datos Pendientes" en nav principal entre Pendientes y Nueva
- ✅ Vista renderiza 5 secciones sin Limpieza ni botón Notificar
- ✅ Card propia con borde morado + badge "👤 Tú"
- ✅ Botón "✏️ Editar" en datos incompletos funciona
- ✅ Marcelo ve la versión completa sin regresión
- ✅ Otros roles (Gerardo/Noemí/Germán/Karla/Genaro) no ven la tab


## v10.31.1 — Bug scan #3 fix bundle (payment system + bridge defensa) — 18-may-2026

Tercer scan exhaustivo, enfocado en código nuevo de v10.29-v10.31 (payment system, modales, trigger SQL, RPC). 6 fixes en un commit, con cambios SQL en backend y frontend.

### 🔴 Críticos

**1. Trigger `sync_invoice_from_orders`: si no hay cxc user activo → invoice quedaba inconsistente.** El `IF v_cxc_user_id IS NOT NULL` saltaba silenciosamente el INSERT del payment cuando el SELECT no encontraba usuarios. El invoice quedaba ya creado con `balance=amount−payment_amount, status='parcial'` (para partial) o `status='pendiente'` con balance completo (para paid), pero sin payment record correspondiente. Hoy hay 1 cxc activo (karla), pero si alguien lo desactiva todas las facturas con pago manual quedarían inconsistentes.
**Fix:** `RAISE EXCEPTION` explícita en las 3 ramas (web MP, paid, partial) si `v_cxc_user_id IS NULL`. Esto hace que el trigger lance error y plpgsql rollback automático: el invoice no se crea, el RPC falla, el frontend muestra error al usuario.

**2. RPC `assign_invoice`: permitía asignar folio individual a orden cuya OC ya tenía `shared_invoice_folio`.** Caso: la orden parte de una OC con folio compartido, pero Karla asigna folio individual. La RPC actualizaba `payment_amount/status/method` en `orders` pero el trigger detectaba `v_oc_has_shared=true` y devolvía NEW sin crear invoice en cobranza. El dinero del anticipo se "perdía" — nunca llegaba a CobranzaFlow.
**Fix:** la RPC ahora valida `shared_invoice_folio` ANTES del UPDATE y lanza `RAISE EXCEPTION 'OC % ya tiene folio compartido %. Usa el folio compartido en lugar de uno individual.'`.

### 🟠 Altos

**3. Trigger: pedido web MP con `payment_status='partial'` manual capturado por error → MP sobreescribía inconsistente.** Si Karla editaba un pedido web post-aprobación y le ponía estado parcial, el balance/status inicial se calculaban con la rama partial primero, luego el bloque MP los forzaba a `balance=0, status='pagada'` pero con payment registrado por el monto total, no por el anticipo. Inconsistencia entre `orders.payment_*` y `cobranza.invoices/payments`.
**Fix:** nueva variable `v_effective_payment_status` que normaliza al inicio: si `source='web' AND mp_payment_id IS NOT NULL` → `paid_via_mp` y la rama partial nunca se ejecuta para órdenes web. Los IF/ELSIF se reordenaron para usar esta variable.

**4. Frontend: cambiar tipo de comprobante NO reseteaba payment_*** ([App.jsx:1550](src/App.jsx#L1550), [App.jsx:1748-1749](src/App.jsx#L1748)). Usuario eligió Factura, capturó parcial $900, cambió a Remisión. El paymentAmount $900 seguía válido en state aunque el total cambió de $1,160 a $1,000.
**Fix:** los tres botones de selector de tipo (InvoiceModal tBtn + PreInvoiceModal Factura + Remisión) ahora también llaman `setPaymentStatus(null); setPaymentMethod(null); setPaymentAmount("")`.

**5. `deliver_only` callback: UPDATE de stage sin validar `invoice_folio` en BD** ([App.jsx:7065](src/App.jsx#L7065)). Race condition: si entre la apertura del modal y la confirmación, otro tab nulleaba el folio (cancelación con NC), la orden quedaba `delivered` sin folio.
**Fix:** `.not("invoice_folio","is",null).select("id")` en el UPDATE y verificar que se actualizó 1 fila; si no, throw "La orden ya no tiene folio asignado (cancelada en otra sesión). Recarga la página."

### 🟡 Medios

**6. IVA rounding descalibrado frontend vs backend** ([App.jsx:1394](src/App.jsx#L1394), [App.jsx:1513](src/App.jsx#L1513), [App.jsx:1691](src/App.jsx#L1691), [App.jsx:1822](src/App.jsx#L1822)). Frontend: `orderBaseAmount * 1.16` (float). Backend: `ROUND(base * 1.16, 2)`. Para `price=87.069`: frontend mostraba $100.99... y permitía 100.99 pero el "total real" según backend era $101.00. Usuario podía teclear el total y el backend lo rechazaba al borde del céntimo.
**Fix:** `totalDisplay = Math.round(orderBaseAmount * 116) / 100` (ints, sin drift) aplicado en `PaymentStatusPicker`, ambos modales y `DeliverOnlyModal`.

### Falsos positivos descartados (verificados)

- **plpgsql `EXCEPTION WHEN OTHERS` deja invoice sin payment:** se probó con SQL directo que plpgsql crea savepoint implícito en cada BEGIN/EXCEPTION block; el invoice INSERT SÍ se rollbackea si el payment INSERT falla. La preocupación real era de visibilidad (operador no ve el error) — cubierto parcialmente por fix #1.
- **Optimistic update con NaN/string:** el flujo controla bien los casteos `Number(...)` y el constraint `orders_payment_amount_required_if_partial` ataja el caso degenerado.
- **`saveOrder` upsert con constraint violation:** solo se llama desde `create`/`duplicate` para órdenes nuevas; sin riesgo real.

### Sin cambios

- DB schema (cero migración nueva)
- Frontend de cobranza
- Bloque MP del trigger (lógica intacta, solo se mueve a la rama `paid_via_mp`)
- Otras vistas y flujos

### Validación

- ✅ Probado con SQL directo: si no hay cxc user activo, el trigger ahora lanza error claro y rollback funciona
- ✅ Probado: asignar folio individual a OC con shared folio devuelve error explícito
- ✅ Frontend: cambiar tipo Factura↔Remisión limpia el selector de pago
- ✅ `deliver_only` race: el UPDATE retorna 0 filas y el callback lanza error claro


## v10.31.0 — Bug fix: no pedir folio si ya tiene + modal de entrega contextual — 18-may-2026

Bug reportado por Karla: órdenes con **folio anticipado** al llegar a `salidas`/`maq_received` mostraban "📄 Asignar Folio y Entregar" como si nunca lo hubieran asignado. Si Karla intentaba reasignar, el RPC `assign_invoice` bloqueaba con `RAISE EXCEPTION 'ya tiene folio X asignado'` — funcional pero pésima UX.

Esta versión hace la UI inteligente: si `invoice_folio` existe → botón cambia a "✅ Marcar como Entregada" + modal contextual según `payment_status`.

### Caso real arreglado

**P-3510 ANDRES MATA** (R-1185, en `salidas` con folio anticipado pre-v10.29.0, `payment_status=NULL`): antes Karla veía "Asignar Folio y Entregar" → error al confirmar. Ahora ve **"✅ Marcar como Entregada"** → modal con warning legacy + entrega directa sin tocar el folio existente.

### Mapeo botón ↔ caso

| Caso | invoice_folio | payment_status | Botón | Modal abierto |
|---|---|---|---|---|
| E (normal) | NULL | NULL | "📄 Asignar Folio y Entregar" | `InvoiceModal` (folio + pago + entrega) — sin cambio |
| A (legacy) | tiene | NULL | "✅ Marcar como Entregada" | `DeliverOnlyModal` + warning "asumiré No pagada" |
| B (unpaid) | tiene | unpaid | "✅ Marcar como Entregada" | `DeliverOnlyModal` + info "saldo en cobranza" |
| C (paid) | tiene | paid | "✅ Marcar como Entregada" | `DeliverOnlyModal` + info "ya pagada" |
| D (partial) | tiene | partial | "✅ Marcar como Entregada" | `DeliverOnlyModal` + split total/anticipo/saldo |

### Implementación

- **Componente nuevo `DeliverOnlyModal`** (~120 líneas) entre `PreInvoiceModal` y `CancelInvoicedModal`. Muestra folio anticipado prominente + bloque contextual con color según `payment_status` (amarillo / naranja / verde / morado).
- **Handler nuevo `deliver_only`** en `handleAction` — valida que `invoice_folio` exista y abre el modal.
- **Lógica condicional en OCard** ([App.jsx:2949](src/App.jsx#L2949) + [App.jsx:2953](src/App.jsx#L2953)): un botón por caso (`!invoice_folio` vs `invoice_folio`).
- **Lógica condicional en Tablero Karla "Pendientes de Folio"** ([App.jsx:6778](src/App.jsx#L6778)): mismo split inline.
- **Callback del modal:** UPDATE de `stage` + `delivered_at` (ORDERS FIRST contra race con Realtime), timeline, notif `db.notifySecs`. NO toca `invoice_folio`, `payment_*` ni la factura en CobranzaFlow.

### Sin cambios

- DB schema (cero migración)
- Bridge SQL (`sync_invoice_from_orders` no se dispara — `invoice_folio` no cambió, solo `stage`)
- RPC `assign_invoice` (intacta)
- CobranzaFlow (la factura ya estaba creada desde el folio anticipado; no se duplica)
- Flujo normal sin folio anticipado: idéntico

### Decisiones de diseño

| ID | Decisión | Rationale |
|---|---|---|
| D-1 | Reemplazar botón según contexto (no agregar adicional) | UX limpia, no confunde a Karla |
| D-2 | Caso paid: no preguntar pago, ir directo a entrega | Pago ya está completo, nada que hacer |
| D-3 | Caso partial: saldo se gestiona en CobranzaFlow | Separación clara; Lucero/Karla aplican pago final allá |
| D-4 | Caso legacy NULL: warning informativo + asumir 'unpaid' | Educa al usuario sin asustar |
| D-5 | Cero cambios SQL | Toda la inteligencia en frontend |

### Validación post-deploy

- ✅ P-3510 (R-1185 ANDRES MATA, payment_status=NULL): botón cambia a "Marcar como Entregada", modal muestra warning legacy
- ✅ P-3506 cuando llegue a maq_received: mismo comportamiento
- ✅ Stage pasa a `delivered`/`maq_delivered`, `delivered_at` se setea
- ✅ Notif a admin/Lupita preservada
- ✅ CobranzaFlow no se duplica (R-1185 sigue intacta)
- ✅ Flujo sin folio anticipado funciona igual que v10.30.0


## v10.30.0 — Pago parcial (anticipo) con split a CobranzaFlow — 18-may-2026

Tercera opción en el selector de pago: **"🔶 Parcial"**. Karla captura el monto del anticipo recibido al asignar folio, y el bridge crea la factura en CobranzaFlow con `balance = total − anticipo` + un payment del anticipo. Lucero/Karla aplican pagos posteriores normalmente en CobranzaFlow hasta saldar.

### Caso de uso real

Cliente firma orden de $5,000 (sin IVA, factura D-XXXX) y entrega $1,500 en efectivo como anticipo. Antes Karla marcaba "No pagada" y luego iba a CobranzaFlow a aplicar el anticipo manualmente. Ahora marca "🔶 Parcial · $1,500 efectivo" y el bridge hace todo el split automáticamente: factura amount=$5,800, balance=$4,300, status='parcial', con un payment de $1,500.

### Backend (Supabase)

- **CHECK ampliado** `orders.payment_status` ahora acepta `paid` / `unpaid` / `partial`.
- **Columna nueva** `orders.payment_amount NUMERIC(12,2)` para guardar el anticipo en moneda literal del cliente.
- **2 constraints nuevos** para integridad: `payment_amount` obligatorio si partial / NULL si no partial.
- **Constraint renombrado:** `orders_payment_method_required_if_paid_or_partial` (antes solo paid).
- **RPC `assign_invoice` ampliada a 9 parámetros** con `p_payment_amount`. La versión 8-param de v10.29.0 fue dropada para evitar ambigüedad. Validaciones server-side: `0 < anticipo < total`, error claro si anticipo ≥ total ("usa payment_status=paid").
- **Trigger `sync_invoice_from_orders` actualizado** con nuevo bloque ELSIF para partial:
  - Invoice se inserta con `amount=total, balance=total−anticipo, status='parcial'`
  - Payment con `amount=anticipo, payment_type=método elegido`
  - Audit log nuevo: `bridge_apply_partial_payment` con detalle completo del split

### Frontend (App.jsx)

- **`PaymentStatusPicker` rediseñado:** 3 botones (No pagada / **🔶 Parcial** / Pagada) en grid `1fr 1fr 1fr`, color índigo `#5856d6` para parcial.
- **Input numérico de anticipo** aparece solo si Parcial. Muestra total visible ("Total con IVA: $5,800.00" o "sin IVA" según tipo de folio) y calcula saldo pendiente en vivo conforme escribe.
- **Validación inline:** `0 < anticipo < total`. Mensaje claro si anticipo ≥ total ("usa Pagada en su lugar"), borde rojo en input, botón Continuar disabled.
- **Captura en moneda literal del cliente** — con IVA si factura D-XXXX, sin IVA si remisión R-XXXX. Sin matemática mental para Karla.
- **`InvoiceModal` y `PreInvoiceModal`** integran nuevo state `paymentAmount`, validación `paymentValid` con caso partial, y paso del monto al callback.
- **`db.assignInvoice`** acepta 9° parámetro opcional `paymentAmount`.
- **Vista de confirmación** muestra "🔶 Parcial · $X.XX · método" + "Saldo pendiente a CobranzaFlow: $Y.YY".
- **DetailModal** Row "Pago" muestra el split: "🔶 Parcial · $1,500.00 (efectivo)".
- **OCard** badge inline al lado del folio: `🔶 PARCIAL · $1,500`.
- **`dbCols` whitelist** incluye `payment_amount`.

### Decisiones de diseño

| ID | Decisión | Rationale |
|---|---|---|
| D-1 | Captura en pesos (no porcentaje) | Karla evita matemática mental |
| D-2 | Moneda literal del cliente | Lo que físicamente recibió, sin conversiones |
| D-3 | Método de pago obligatorio | Trazabilidad |
| D-4 | Validar `0 < anticipo < total` con error explícito | Educa al usuario; previene errores |
| D-5 | Anticipo ≥ total bloquea con mensaje "usa Pagada" | Más explícito que auto-cambiar |
| D-6 | Aplica a ambos flujos (normal + anticipado) | Consistencia con v10.29.0 |
| D-7 | `cobranza.invoices.status='parcial'` ya nativo | Cero cambio en CobranzaFlow |
| D-8 | `payment_amount` guardado en orders | Auditoría: reconstruir split si necesario |

### Sin cambios

- Pedidos web Mercado Pago (siguen auto-pagando completos como `tarjeta_credito`)
- Bloque `bridge_apply_manual_payment` de v10.29.0 (paid completo, intacto)
- CobranzaFlow UI (los registros llegan con `status='parcial'`, el dashboard los trata como cualquier otra factura parcial)
- Bridge de cancelaciones

### Validación post-deploy esperada

- ✅ "Pagada"/"No pagada" funcionan igual que v10.29.0 (no regresión)
- ✅ "Parcial + monto válido" → factura con `balance correcto`, payment del anticipo, audit log `bridge_apply_partial_payment`
- ✅ Anticipo ≥ total → botón Continuar disabled + mensaje claro
- ✅ Anticipo = 0 → botón disabled
- ✅ Coherencia: `cobranza.invoices.amount = balance + cobranza.payments.amount` para parciales
- ✅ Pedidos web MP siguen auto-aplicando como `tarjeta_credito`


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
