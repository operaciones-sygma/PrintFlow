# 🗺️ ROADMAP — v10.11.0 · Flexibilidad de Órdenes de Compra y Folios Internos

**Fecha de planeación:** 8 de mayo, 2026
**Status:** Plan aprobado con decisiones tomadas. Listo para implementar cuando Marcelo regrese con energía.
**Estimación total:** 6-8 horas (dividido en 3 sub-fases)
**Dependencia:** v10.10.0 LIVE en operación real (validar 1-2 semanas antes de arrancar)

---

## 🎯 Visión

Hoy en v10.10.0 las OCs son contenedores estáticos: se crean, se les agregan productos, y los productos heredan información del cliente. Pero **una vez creadas, no se pueden reorganizar**, y Karla solo puede asignar folios producto por producto desde la pestaña Folios.

**v10.11.0 transforma las OCs en estructuras flexibles** que se adaptan a la realidad del negocio:
- Lupita puede mover productos entre OCs según el cliente cambie de opinión
- Karla puede asignar folios a nivel OC (compartido o N consecutivos) o seguir asignando individual
- Karla puede pre-asignar folios anticipados a nivel OC
- El sistema fiscal sigue siendo trazable e inmutable: una vez emitido un folio, no se puede sobreescribir

---

## ✅ Decisiones de diseño aprobadas (5)

| ID | Pregunta | Decisión | Implicación técnica |
|---|---|---|---|
| **D1** | Modo de asignación de folio a OC | Karla decide caso por caso (compartido vs N consecutivos) | Modal con toggle al asignar |
| **D2** | Folios parciales en OC | Modal avisa a Karla qué se respeta y qué se asigna | Confirmación pre-asignación |
| **D3** | Pre-asignación a nivel OC | Sí, con bloqueo automático de "+ Agregar producto" después | Nueva columna `purchase_orders.folios_locked` |
| **D4** | "Quitar producto de OC" semántica | = Cancelar orden (botón ❌ existente). Para no cancelar = usar Mover | NO agregar botón nuevo "Quitar"; reusar ❌ |
| **D5** | UX para mover entre OCs | Empezar con 1 a 1 (botón por orden); selección múltiple en v10.11.1 si hace falta | Botón ↔️ por orden, no checkboxes |

---

## 🧩 Sub-fases de implementación

### Sub-fase A — Mover órdenes entre OCs (1 a 1) ⏱️ ~2h

**Lo que entrega:**
- Botón **"↔️ Mover a otra OC"** en cada producto dentro del detalle de OC
- Modal **MoveOrderModal**:
  - "🆕 Crear OC nueva y mover" — abre flow de crear OC, tras crear, mueve la orden
  - "📋 Mover a OC existente" — dropdown con OCs activas (filtrable por cliente/búsqueda)
- Lógica: `UPDATE orders SET purchase_order_id = $newOC WHERE id = $orderId`
- Trigger existente `recalculate_oc_total` maneja recálculo automático de totales (ya construido en v10.10.0)
- Toast confirmación: "Orden movida de OC-1004 a OC-1005"

**Validaciones de negocio:**
- ❌ NO mover si la orden ya tiene `invoice_folio` asignado (folios fiscales son inmutables — moverlos rompería trazabilidad)
- ❌ NO mover si la orden está en stage `cancelled` o `maq_cancelled`
- ❌ NO mover hacia OC destino que tenga `folios_locked = true` (D3 — bloqueada por pre-asignación)
- ✅ Sí mover en cualquier otro stage de producción (draft, design, plates, presses, etc.)

**Cambios SQL:**
- Función RPC `move_order_to_oc(p_order_id TEXT, p_target_oc_id TEXT)` — atómico, valida invariantes y devuelve OK/error con mensaje claro

**Cambios App.jsx:**
- Componente nuevo `MoveOrderModal` (~80 líneas)
- Botón "↔️ Mover" en OCard cuando se renderea dentro de OC view (condicional: solo en `view==="oc"`)
- Handler `moveOrderToOC` en App component (~20 líneas)
- ~+150 líneas netas

---

### Sub-fase B — Folios fiscales a nivel OC ⏱️ ~3-4h

**Lo que entrega:**
- Botón **"📄 Asignar folio a OC"** (Karla) — para entregar OC completa
- Botón **"📋 Pre-asignar folio a OC"** (Karla) — para emitir factura anticipadamente
- Modal **AssignOCFolioModal** con campos:
  - **Tipo de folio:** Factura (D-) / Remisión (R-)
  - **Modo (D1):** UN folio compartido / N folios consecutivos
  - **Resumen visual:** "OC-1004 tiene 4 productos · 2 ya tienen folio · 2 pendientes"
  - **Decisión Karla (D2):** "Solo asignar a los pendientes" (default y único válido — los folios existentes son inmutables)
  - **Modo pre-asignación:** checkbox "Pre-asignar (la OC quedará bloqueada para nuevos productos)"
- Función SQL `assign_folio_to_oc(p_oc_id, p_type, p_mode, p_pre_assigned)`:
  - Si `p_mode = 'shared'`: incrementa contador 1 vez, asigna mismo folio a todas las órdenes pendientes de la OC
  - Si `p_mode = 'consecutive'`: incrementa contador N veces, asigna folios secuenciales a las órdenes pendientes
  - Respeta folios existentes (skip órdenes que ya tienen `invoice_folio`)
  - Si `p_pre_assigned = true`: marca `invoice_pre_assigned=true` en orders + `folios_locked=true` en OC

**Validaciones de negocio:**
- ❌ NO asignar a OC sin productos
- ❌ NO reasignar folios a órdenes que ya los tienen (siempre skip)
- ❌ NO asignar si TODOS los productos ya tienen folio (modal informa "OC-1004 ya está completamente facturada")
- ✅ Modo `shared` permite que múltiples `orders.invoice_folio` apunten al mismo folio (ver Riesgo 1)

**⚠️ Decisión técnica importante a resolver al inicio de Sub-fase B:**

Hoy `orders.invoice_folio` se usa con la asunción implícita de "un folio por orden". Si vamos con D1 modo compartido, múltiples órdenes pueden compartir el mismo folio. Necesitamos verificar y decidir:

1. **¿Hay UNIQUE constraint en `orders.invoice_folio`?** Probablemente NO (era para folio interno único por orden, no por sistema), pero verificar.
2. **¿La auditoría de v10.9.1 (gap detection + duplicates) maneja bien folios compartidos?** Probablemente NO — detectaría falsos duplicados cuando son compartidos legítimos.
3. **¿Necesitamos columna nueva `purchase_orders.shared_invoice_folio`** para indicar el folio a nivel OC?

**Mi instinto técnico:** Agregar columna `purchase_orders.shared_invoice_folio TEXT NULL`. Si está poblada, todas las órdenes de esa OC heredan ese folio para visualización pero también lo guardan en `orders.invoice_folio` para retrocompatibilidad con todo el código existente que lee `orders.invoice_folio`. La auditoría de v10.9.1 se modifica para detectar "este folio aparece N veces porque pertenece a OC con `shared_invoice_folio` = X" y NO marcarlo como duplicado.

Esta decisión técnica vale la pena platicarla en la sesión de implementación, no en este roadmap.

**Cambios SQL:**
- Nueva columna `purchase_orders.shared_invoice_folio TEXT` (nullable)
- Nueva columna `purchase_orders.folios_locked BOOLEAN DEFAULT false` (D3)
- Función RPC `assign_folio_to_oc(p_oc_id, p_type, p_mode, p_pre_assigned)` — atómico, SECURITY DEFINER
- Modificación de la función v10.9.1 de auditoría: ignorar duplicados que sean folios compartidos legítimos (verificar con join a purchase_orders)

**Cambios App.jsx:**
- Componente nuevo `AssignOCFolioModal` (~150 líneas)
- Lógica de bloqueo "+ Agregar producto" cuando `folios_locked = true` (~10 líneas)
- Display del folio compartido en card de OC + detalle (~20 líneas)
- Botones nuevos para Karla en vista de OC
- ~+200 líneas netas

---

### Sub-fase C — Validación visual de Cancelar desde OC ⏱️ ~30 min

**Lo que entrega:**
- El botón **❌ Cancelar** ya existe en cada OCard desde v10.4.2 (D4 dice reusarlo, no crear nuevo)
- Solo necesitamos asegurar que sea visible y accesible cuando la orden se renderea dentro del detalle de OC
- Verificar que al cancelar la orden, el trigger `recalculate_oc_total` descuenta su precio del total de la OC (esto ya funciona desde v10.10.0)

**Cambios:**
- ZERO código nuevo
- Solo validación visual durante implementación
- Si OCard se ve apretada o el botón está oculto, ajuste menor de UI

---

## 📅 Orden recomendado de ejecución

```
Sesión 1 (~2.5h):
  ├─ Sub-fase A (mover) — 2h
  ├─ Sub-fase C (validar cancel) — 30 min
  ├─ Commit + push + Vercel deploy
  └─ Validación visual (Lupita prueba mover)
  
Sesión 2 (~3-4h):
  ├─ Discusión técnica al inicio (15 min): resolver Riesgo 1
  ├─ Sub-fase B (folios OC) — 3h
  ├─ Commit + push + Vercel deploy
  ├─ Validación con Karla (importante involucrarla)
  └─ Si todo OK: CHANGELOG v10.11.0
```

**Total estimado realista:** 6-8 horas distribuidas en 2 sesiones.

**Recomendación de espaciado:** dejar 1-2 días entre sesiones para que Lupita pruebe Sub-fase A en operación real antes de meter Sub-fase B.

---

## ⚠️ Riesgos y mitigaciones

### 🔴 Riesgo 1: Cambiar el modelo de `orders.invoice_folio` puede romper v10.9.1 (Auditoría)
**Probabilidad:** Alta
**Impacto:** Falsos positivos en gap detection / duplicates
**Mitigación:** 
- Discusión técnica al inicio de Sub-fase B
- Probable solución: columna nueva `purchase_orders.shared_invoice_folio` + modificar auditoría para ignorar duplicados legítimos
- Test de regresión: correr la query de auditoría con datos de prueba que incluyan folios compartidos antes de deployar

### 🟡 Riesgo 2: Karla se confunde con tantas opciones de asignación
**Probabilidad:** Media
**Impacto:** Errores de asignación de folios fiscales
**Mitigación:**
- Modal `AssignOCFolioModal` muy claro visualmente
- Mostrar preview ("Se asignarán los folios D-5750 a D-5753 a 4 productos")
- Considerar default sensato (compartido si todos los productos son del mismo cliente, consecutivos si hay variedad)
- Que Karla revise el wireframe ANTES de implementación

### 🟡 Riesgo 3: Lupita ya pre-asignó folio a OC y luego necesita agregar un producto
**Probabilidad:** Media
**Impacto:** Lupita confundida o frustrada
**Mitigación:**
- El bloqueo "+ Agregar producto" se acepta como diseño (D3)
- UI clara: "OC-1004 está bloqueada por folios. Para agregar este producto, créalo en una OC nueva."
- Considerar si el botón "+ Agregar producto" se oculta o se muestra deshabilitado con tooltip explicativo

### 🟡 Riesgo 4: "Mover orden" deja OCs vacías
**Probabilidad:** Media
**Impacto:** OCs huérfanas en la lista
**Mitigación:**
- **Decisión a tomar al implementar Sub-fase A:**
  - Opción a) Auto-cancelar OCs que queden con 0 productos activos (status → 'cancelled')
  - Opción b) Mantenerlas como 'open' con 0 productos y dejar que Lupita las cancele manualmente
  - Opción c) Auto-eliminar OCs simples vacías, mantener OCs complejas vacías

### 🟢 Riesgo 5: Conflicto en mover si dos usuarios mueven la misma orden simultáneamente
**Probabilidad:** Baja
**Impacto:** Race condition
**Mitigación:**
- La función RPC `move_order_to_oc` es atómica
- El último UPDATE gana; el frontend recarga vía Realtime y muestra estado correcto

---

## 🚧 Decisiones técnicas pendientes para la sesión de implementación

Estas NO se decidieron hoy y se deben resolver al inicio de la sub-fase correspondiente:

1. **Sub-fase A:** ¿Una OC vacía (sin productos) qué status tiene? Auto-cancelar / mantener / auto-eliminar
2. **Sub-fase A:** Si Lupita mueve la última orden de una OC compleja, ¿qué pasa con la OC vacía?
3. **Sub-fase B:** Modelo del folio compartido (columna nueva `shared_invoice_folio` vs solo modificar auditoría)
4. **Sub-fase B:** Default sensato del modo de asignación al abrir el modal (compartido vs consecutivos)
5. **Sub-fase B:** Si Karla pre-asigna folios y luego una orden se cancela, ¿el folio queda quemado o se libera?
6. **Sub-fase B:** ¿Cómo se ve un folio compartido en la pestaña Auditoría? (no debe contar como duplicado)

---

## 🎁 Out of scope v10.11.0 (para v10.11.x o futuro)

Cosas que NO entrega v10.11.0 pero vale la pena tener mapeadas:

- **v10.11.1 — Mover varias a la vez (selección múltiple)** — D5 dice empezar con 1 a 1, agregar después si Lupita lo pide
- **v10.11.x — Drag & drop entre OCs** — más visual pero requiere ambas OCs visibles, problemático en mobile
- **v10.11.x — Editar metadata de OC** (cliente, vendedor, fecha entrega, notas) después de crearla
- **v10.11.x — Cancelar OC completa** (no solo individual) — propaga cancelación a todos los productos de la OC
- **v10.11.x — Reabrir OC cancelada** — si Pepsi cambia de opinión

Cualquiera de estos puede ser un mini-patch o v10.11.x según necesidad real.

---

## 🔄 Integración con CobranzaFlow (futuro lejano, NO en v10.11.0)

Cuando llegue CobranzaFlow:
- Las OCs con folio D-XXXX entran al pipeline de Facturación
- Las OCs con folio R-XXXX entran al pipeline de Crédito
- v10.11.0 prepara las OCs para que sean la entidad bridge entre PrintFlow y CobranzaFlow
- El campo `purchase_orders.shared_invoice_folio` (si se implementa) será el equivalente a `orders.invoice_folio` actual pero a nivel agregado, ideal para CobranzaFlow

No requiere acción ahora, pero se documenta para que cuando llegue CobranzaFlow, ya tengamos las bases.

---

## 📊 Resumen ejecutivo

| Aspecto | Detalle |
|---|---|
| **Versión** | v10.11.0 |
| **Sub-fases** | 3 (A: mover, B: folios OC, C: validación cancel) |
| **Horas estimadas** | 6-8 horas en 2 sesiones |
| **Líneas App.jsx esperadas** | ~+350 netas |
| **Cambios SQL** | 2 columnas nuevas, 2 funciones RPC nuevas, 1 modificación de auditoría |
| **Componentes nuevos** | `MoveOrderModal`, `AssignOCFolioModal` |
| **Riesgo principal** | Modelo de folio compartido vs unicidad actual (Riesgo 1) |
| **Cuándo arrancar** | Después de 1-2 semanas de v10.10.0 en uso real |
| **Validación pre-arranque** | Karla y Lupita han usado v10.10.0 y dado feedback |

---

## ✅ Checklist antes de arrancar v10.11.0

Cuando regreses para implementar (en 1-2 semanas):

- [ ] v10.10.0 lleva al menos 1 semana en uso real con Lupita y Karla
- [ ] No hay bugs críticos pendientes de v10.10.0
- [ ] Karla y Lupita dieron feedback sobre las OCs (puede modificar prioridades de v10.11.0)
- [ ] Resolver las 6 decisiones técnicas pendientes (sección anterior)
- [ ] Hacer wireframe rápido de `AssignOCFolioModal` y validarlo con Karla antes de implementar
- [ ] Backup `orders_backup_v10_10_0` puede borrarse antes de empezar v10.11.0
- [ ] Confirmar que ningún cliente real ya usó folios compartidos manualmente (eso afecta migración)

---

**Fin del roadmap. Listo para implementar cuando regreses con energía. 🚀**
