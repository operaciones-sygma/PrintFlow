---
target: vista En espera (post-polish v10.73.29)
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-07-02T16-55-02Z
slug: src-app-jsx-view-espera
---
# /impeccable critique #2 — Vista "En espera" (post-polish v10.73.29)

**32/40 (↑ desde 29).** El polish cerró los P1/P2 de la primera pasada (verificado en código, no cosmético). Sin P0/P1. Lo que queda es craft fino + carryover.

## Design Health Score

| # | Heurística | Score | Δ | Nota |
|---|-----------|-------|---|------|
| 1 | Visibilidad del estado | 3 | = | Bien; el gate `!loaded` pinta "Cargando…" plano (sin skeleton). |
| 2 | Match mundo real | **4** | ↑ | `reactLabel` por etapa/kind: ya no miente en salidas/factura. Resuelto. |
| 3 | Control y libertad | 3 | = | Reactivar gateado por `canSnooze`; edge sin botón (abajo). |
| 4 | Consistencia | 3 | = | Banner deduplicado; el 3er empty-state (`!loaded`) usa texto ad-hoc, no `EmptyState`. |
| 5 | Prevención de errores | **4** | ↑ | Suprimir acciones destructivas/fiscales de una vista de solo-triage = correcto. Fuerte. |
| 6 | Reconocer > recordar | 3 | = | Razón/autor/fecha en el banner; etapa como header de grupo. |
| 7 | Flexibilidad | **3** | ↑ | Reactivar en 1 clic; sigue sin colapsar grupos (carryover). |
| 8 | Estético/minimalista | **3** | ↑ | Una sola mención "En espera" por card. Pero el tinte ámbar es invisible. |
| 9 | Recuperación de errores | 3 | = | Empty-states distinguen búsqueda vs vacío real. Falso "todo bien" resuelto. |
| 10 | Ayuda/docs | 3 | = | Subtítulo explica el mecanismo. |
| **Total** | | **32/40** | **↑3** | **Bueno, subiendo** (el panel converge 32-34) |

**Trend:** 29 → 32.

## Lo que el polish arregló (verificado en código)
- **Etiqueta por etapa** → RESUELTO (`reactLabel`).
- **Muro de avance en triage** → RESUELTO (`inEsperaView` suprime cluster + chips + GuideBanner + Cancelar/Mover + folio histórico).
- **CTA con peso** → RESUELTO parcial (subió a F.body+padding; sigue ghost, ver abajo).
- **Falsos "todo bien"** → RESUELTO (gate carga + "Sin resultados" vs verde).
- **Duplicación "En espera" 3×** → RESUELTO (chips suprimidos; queda 1 mención).
- **Banner dashed + duplicado byte-a-byte** → RESUELTO (1 def `snoozeBanner`, borde sólido).

## Issues restantes (todos P2/P3, sin P0/P1)

**[P2] Contraste del badge de conteo (regresión de mi propio polish).** Puse el número al color de la etapa sobre `C.sf`; para etapas claras el contraste cae bajo 3:1 (draft ~2.0:1, proof_client ~2.7:1). El pill es el único indicador de "cuántas por etapa" y queda casi ilegible. **Fix:** número en `C.t2`/`C.tx` y el color de etapa como **fondo tintado** (`+"18"`), no como texto. → `/impeccable polish`

**[P2] El único CTA de la vista se ve secundario.** "En espera" tiene un solo propósito (regresar al flujo), pero el botón es ghost (`bs(C.ac+"15")`, texto acento). `inEsperaView` subió tamaño, no jerarquía. **Fix:** en `inEsperaView`, promover a sólido (`bt(C.ac)`) o borde+peso mayor — debe leerse como LA acción. → `/impeccable layout`

**[P2] Grupos no colapsables (carryover no atacado).** El admin (usuario primario) ve todas las etapas expandidas, scroll largo, sin plegar las revisadas ni header sticky. Pendientes y el board de Karla ya usan `<details open>`; esta vista no lo heredó. **Fix:** envolver cada grupo de etapa en `<details open>`. → `/impeccable layout`

**[P2] Edge `canSnooze=false` → card muda.** `myTasks` de Karla incluye pre-asignadas en etapas ajenas (producción); ahí `orderResponsible≠karla` → sin botón reactivar, y `snoozeActive` corta el nudge "le toca a X" → la card se ve igual que las accionables pero no ofrece nada. **Fix:** cuando `snoozeActive && !canSnooze` en la vista, mostrar "En producción con Gerardo — abre el detalle" (reusar `resp.name`) o un affordance "Abrir detalle". → `/impeccable clarify`

**[P3] Tinte ámbar invisible (mi polish).** `C.amb+"0d"` (~5%) sobre `C.card` casi blanco + borde neutro → el token ámbar no rinde; el banner se lee solo por icono+texto. **Fix:** decidir — en una vista donde TODO está pausado, lo correcto es quieto: quitar el tinte (fondo `C.sf` neutro limpio). O comprometer (`C.amb+"14"` / borde ámbar). El 5% no hace ninguna. → `/impeccable distill`

**[P3] Sin orden por urgencia.** Intra-grupo es A→Z por cliente; para triage, el admin querría las próximas a vencer / más viejas primero (`snooze_until`), que hoy está enterrado en el texto del banner. **Fix:** ordenar por `snooze_until` asc (indefinidas al final) o chip "hasta X" escaneable. → `/impeccable layout`

## Persona red flags
- **Gerardo:** pierde la vía de "avanzar directo" (que auto-limpiaba el snooze); ahora reactiva aquí y va al Tablero. Paso extra, aceptable en triage.
- **Karla:** el caso común quedó correcto; el edge pre-asignada queda muda (arriba).
- **Marcelo/admin:** scroll largo sin colapsar (arriba); al reactivar la última de un grupo, el header de etapa se esfuma sin transición.

## Minor
- La alerta RETRASO sigue en cards pausadas (`late` no se exime por snooze, solo `stale`). Probablemente intencional.
- ProgressBar redundante con el header de grupo (inofensivo).
- Loading plano vs skeleton.

## Questions
- El color de etapa en el pill de conteo, ¿eco intencional del StageLbl o basta un neutro?
- El banner en la vista dedicada (todo pausado), ¿debería ser deliberadamente más quieto que en Pipeline (donde una pausada entre activas sí necesita destacar)? Eso justifica quitar el ámbar aquí.
