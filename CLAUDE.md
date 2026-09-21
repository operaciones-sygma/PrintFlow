# CLAUDE.md — Contexto para Claude Code en PrintFlow

> Léelo al inicio de cada sesión. **Se actualiza cuando cambia la arquitectura o una regla**, no por
> sesión (para eso está `CHANGELOG.md`). Última actualización: **18-sep-2026** (v10.84.9). La versión
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
  etiqueta).
- **Marcelo** es dueño y único desarrollador; **Karla** factura; **Lupita** captura; **Gerardo/Noemí/
  Germán** producción/pre-prensa/CTP; **Genaro** vende (ve sólo lo suyo); rol `visor` sólo lectura.

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

## 🎯 Estado (18-sep-2026)

- **LIVE:** v10.84.10 (v10.84.9: «Facturar a un tercero» dice que el tercero PAGA y cuándo NO usarlo; v10.84.10: `precioVenta(o)` = maquila→`maq_price`, lo demás→`price`, la misma regla que la base; antes las tarjetas y los reportes hacían `price||maq_price`). Corte del 1-sep hecho: SYGMA emite sus propios CFDI (F-/RS-), Alpha ya no.
- **Lo último (18-sep):** `facturar_siguiente_parte(…, p_folio, p_allow_link := true)` **liga una
  factura que ya existe en cobranza** como la siguiente parte, sin acuñar folio (mismos guards que la
  Opción A de `assign_invoice_splits`; el puente la salta). Caso Portland P-0465: F-35 y F-66 hechas
  sin orden antes de «por partes», F-65 duplicada cancelada, resto $13,200 / 30,000 pzas. Firma nueva
  → DROP de la vieja + REVOKE/GRANT. **Sin botón todavía** (se llamó desde SQL); la opción en el modal
  «Facturar siguiente parte» va en el lote del lunes.
- **Antes (14-sep):** facturar por partes a lo largo del tiempo (v10.84.0-6), realtime de partes, Cuadrar.
- **Pendientes de PrintFlow para el lunes 22-sep:** la opción «ligar factura existente» en el modal;
  ligar por anticipado F-25 ↔ P-0437 (`link_invoice_to_order` sólo liga en Salidas); **P2
  `cancel_invoice_split`**: cancelar una parte con factura propia sin timbrar la deja `cancelada` con
  saldo vivo y `cfdi_status = 'pending'` (F-65 se corrigió a mano; debe poner saldo 0 y `none`).
- **Backlog conocido:** Tablero activa fantasma (`delivered` en pos 0 bloquea auto-promoción);
  validaciones pendientes del roadmap de estabilización; decisiones de Marcelo en PENDIENTES.

---

## 💬 Comunicación con Marcelo

- **Ejecución sobre análisis**: haz la tarea y para; respuestas cortas, en español mexicano, liderando
  con el resultado. Nada de «opciones» cuando hay una obvia.
- Si algo huele mal, decirlo en una línea y seguir; parar sólo si seguir sería inseguro.
- **Reportar lo que pasó de verdad**: si una prueba falló, decirlo con la salida; si algo se saltó,
  decirlo.
