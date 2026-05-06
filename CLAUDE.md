# CLAUDE.md — Contexto para Claude Code en este repo

> **Instrucciones para Claude Code:** Lee este archivo al inicio de cada sesión. Contiene reglas técnicas, convenciones del proyecto, y contexto que SIEMPRE se aplica.

---

## 🏗️ Stack y arquitectura

- **Frontend:** React 18, single-file `src/App.jsx` (~4,500+ líneas, código compacto)
- **Backend:** Supabase project `uvhardaeooaxjrrgdjwa` (PostgreSQL + Realtime + Storage + Auth)
- **Storage:** Supabase Storage bucket `order-files` (auto-cleanup 30 días)
- **Hosting:** Vercel auto-deploy desde `main` branch → `print-flow-eosin.vercel.app`
- **Repo:** `operaciones-sygma/PrintFlow`
- **Build tool:** Vite (ver `vite.config.js`)
- **Styling:** Inline JSX styles con objeto `C` (colors) — **no hay CSS externo**, no hay Tailwind

**El proyecto es un SaaS interno** para Padilla Hnos. Impresora (León, Guanajuato, México). Manejado por el dueño/operador (Marcelo) como único desarrollador.

---

## 👥 Roles del sistema

| Role key (técnico) | Display name | Persona | Función principal |
|---|---|---|---|
| `admin` | Admin | Marcelo | Acceso total, configuración, edits sensibles |
| `secretaria` | **Lupita** | Lupita | Crear órdenes, atención cliente |
| `produccion` | Producción | Gerardo | Validar specs, operar tablero, planificar |
| `preprensa` | Pre-prensa | Noemí | Diseño, gestión de archivos, aprobar pruebas |
| `german` | Germán/CTP | Germán | CTP, procesadora, placas, químicos |
| `vendedor` | Vendedor | Genaro | Ventas, ve solo SUS órdenes (aislamiento) |
| `karla` | Facturación | Karla | Asignar folios fiscales D/R, marcar entregadas |

**Importante:** El display name "Secretaría" se renombró a "Lupita" en v10.7.0, pero el technical key es `secretaria` (no breaking change).

---

## ⚠️ 22 Reglas técnicas críticas (NO romper)

### React + Supabase
1. **`supabase.update()` NUNCA incluye `id`** — PostgREST rechaza silenciosamente updates que intentan modificar la PK.
2. **`wixData.update()` reemplaza TODO el documento** — siempre spread: `{...existingRecord, fieldToChange: value}`.
3. **Float a Mercado Pago siempre redondeado:** `Math.round(x * 100) / 100`.
4. **IPN endpoints responden 200 SIEMPRE** — incluso en error interno. Evita retry storms.
5. **`supabase.update()` nunca lanza** — siempre destructure `{data, error}` y `throw error` manualmente en operaciones críticas.
6. **`orders.id` es TEXT format `OP-XXXXX...`** (no UUID) — todas las funciones SQL deben usar `TEXT` type para parámetros.
7. **`users` table tiene `display_name TEXT NOT NULL`** — incluirlo en todos los INSERTs.
8. **`users_role_check` constraint** — debe ser dropped y recreated cuando agregas un nuevo rol.
9. **`orders.update` debe ejecutarse ANTES** de cualquier insert en tablas relacionadas (`order_timeline`, `order_machine_log`) para prevenir race conditions con Realtime.
10. **Realtime refs estables:** usar `useRef` para canales Realtime — previene recreación en re-renders.

### Hooks y estado
11. **Orden requerido de declaración** (JavaScript temporal dead zone): `viewOrders → searchFilter → filteredOrders → myTasks → staleTasks`.
12. **`.slice().sort()` en arrays memoizados** — nunca mutar in place.
13. **`isSec(role)`** — helper para identificar roles tipo secretaria.
14. **`secOwns`** — gate de acciones (bloquea secretaria + vendedor en órdenes ajenas).
15. **`vOwns`** — gate de visibilidad (bloquea solo vendedor).
16. **`userLogin`** — username autenticado, separado del `role`.
17. **`notifKey`** — vendedores cargan notificaciones por username, no por rol.
18. **Ownership en `created_by`** se guarda como username real, NO como rol.

### Notificaciones
19. **`db.addNotification` directo** — usar para casos donde el self-skip guard de `db.notify` interfiere.
20. **Admin notifications para maquila stage advances** requieren handling explícito.

### IPN / Mercado Pago
21. **`sessionId` (browser-generated)** sirve como `external_reference` a MP.
22. **HMAC-SHA256 validation** está implementada pero NO bloqueante (la seguridad real viene de verificar el pago directamente con MP API).

---

## 📐 Convenciones de código

### Estilo del archivo App.jsx
- **Single file**, código compacto, **mínimos saltos de línea** entre funciones cortas
- Inline styles con objeto `C` (colors) y helpers `bt()` (button), `Row` (detail row)
- Prefijo `🆕 vX.X.X — ` en comentarios cuando agregas features nuevas (para tracking)
- Prefijo `// ═══ SECTION ═══` para secciones grandes
- Prefijo `// ─── COMPONENT ───` para componentes principales

### Edits seguros
- **Siempre validar sintaxis JSX** antes de guardar cambios grandes:
  ```bash
  cd /tmp && npm install acorn acorn-jsx
  node -e "
  const acorn = require('acorn');
  const jsx = require('acorn-jsx');
  const code = require('fs').readFileSync('PATH/App.jsx', 'utf8');
  acorn.Parser.extend(jsx()).parse(code, {sourceType:'module', ecmaVersion:'latest'});
  console.log('✅ Sintaxis válida — ' + code.split('\\n').length + ' líneas');
  "
  ```
- **Surgical edits only** — usar `str_replace` con strings únicos, NO rewrites completos
- **Verificar antes de editar:** grep para confirmar que el string a reemplazar existe y es único

### Helpers de formato (ya existen, NO reimplementar)
- `fmt(n)` → currency MXN
- `fD(d)` → fecha corta `5 may`
- `fDT(d)` → fecha + hora `5 may, 14:30`
- `pct(c, p)` → percentage
- `fmtM(m)` → minutes a `Xh Ym`
- `gid()` → genera ID `OP-XXXXX...`

---

## 🗄️ Schema importante (database)

### Tablas principales (14)
1. `orders` — órdenes de producción y maquila
2. `order_timeline` — historial de eventos
3. `order_comments` — comentarios
4. `order_waste` — registros de merma
5. `order_machine_log` — uso de máquinas
6. `order_notes` — notas rápidas
7. `users` — usuarios + roles
8. `notifications` — push notifications persistentes
9. `chemical_log` — químicos (revelador, reforzador)
10. `plate_log` — placas (chicas, grandes)
11. `maintenance_log` — mantenimiento de máquinas
12. `app_config` — configuración global
13. `invoice_counters` — contadores D/R/P/W (v10.7.0+)
14. `production_plans` — cola del Planificador (v10.8.x)

### RLS
**Patrón consistente:** Todas las tablas usan `CREATE POLICY "allow_all" FOR ALL USING (true) WITH CHECK (true)`. El control de acceso real está en la app (frontend).

### Folios importantes
- **P-XXXX** — production_number (P-1, P-2, ..., P-3434, P-3435...). Continuidad preservada vía `OP-SEED-P3434-DO-NOT-DELETE` phantom record. **NO BORRAR.**
- **D-XXXX** — facturas (empezó en D-5745)
- **R-XXXX** — remisiones (empezó en R-1172)
- **C-XXXX** — cart folio (web, pedidos agrupados)
- **W-XXXX** — web order folio (cada producto del cart)

---

## 🚦 Workflow de desarrollo

### Marcelo trabaja así (5 may 2026 en adelante)
1. **Planeación:** Chat web Claude.ai con Project Knowledge → decisiones, snippets, briefs
2. **Implementación:** Claude Code en VS Code → edita archivos, valida sintaxis
3. **Commit + Push:** VS Code Source Control → mensaje → Commit → Push
4. **Deploy:** Vercel auto-deploy desde `main` (~30-60 seg)
5. **Verificación:** abrir `print-flow-eosin.vercel.app`

### SQL migrations
- Si una feature requiere cambios de schema, **el SQL debe correrse en Supabase SQL Editor ANTES de hacer push** del App.jsx que lo usa.
- Naming convention: `migration_vX.X.X_description.sql`

### Documentación
- **Solo `CHANGELOG.md` se actualiza por sesión** (entrada nueva al inicio)
- **Base docs (`PrintFlow-Contexto.md`, `Roadmap.md`, `Documentacion.md`) NO se tocan** salvo en versiones mayores (v11, v12...)
- Edits surgicales, NUNCA rewrites completos de docs

---

## 🚫 Cosas que Claude Code NO debe hacer (sin pedir confirmación)

1. **NO hacer rewrites completos del App.jsx** — surgical str_replace only
2. **NO modificar `OP-SEED-P3434-DO-NOT-DELETE`** ni nada con sufijo `DO-NOT-DELETE`
3. **NO borrar tablas SQL** sin confirmación explícita
4. **NO hacer push directo a `main`** sin pedir review del diff primero
5. **NO ejecutar `npm install`** de paquetes nuevos sin discutirlo (puede romper Vercel build)
6. **NO modificar `package.json`** sin avisar
7. **NO modificar variables de entorno** (`.env`) — están en Vercel
8. **NO incluir `id` en `supabase.update()`** — regla #1
9. **NO hacer commits que mezclen features no relacionadas** — un cambio = un commit
10. **NO agregar dependencias externas** sin necesidad real (mantener minimal footprint)

---

## 🎯 Versión actual y próximos pasos

- **Versión LIVE:** v10.9.0+ (folio anticipado + captura manual + fecha creación visible)
- **Próximo:** v10.9.1 — Vista de Auditoría + Gap Detection (decisiones pendientes)
- **Roadmap mid-term:** v10.10 (purchase_orders) → v11 (invoices independientes) → CobranzaFlow (app separada)

Ver `CHANGELOG.md` para historial completo y `PrintFlow-Contexto.md` / `Roadmap.md` (en chat web project knowledge) para detalles.

---

## 💬 Comunicación con Marcelo

- Marcelo prefiere **implementación directa sobre explicaciones largas**
- Usa **español mexicano** en respuestas
- Para multi-step tasks: dar **checklist claro** y avanzar paso a paso
- Cuando hay dudas de diseño: **proponer 2-3 opciones** con pros/cons, no preguntar abierto
- **Validar sintaxis** antes de declarar un cambio "listo"

---

*Última actualización: 5 mayo 2026 — Setup inicial Claude Code*
