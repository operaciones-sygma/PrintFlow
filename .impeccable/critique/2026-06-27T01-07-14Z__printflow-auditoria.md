---
target: Auditoría (AuditoriaView de PrintFlow) — re-run tras arco
total_score: 34
p0_count: 0
p1_count: 1
timestamp: 2026-06-27T01-07-14Z
slug: printflow-auditoria
---
## Design Health Score (re-run tras el arco v10.72.74-78)

| # | Heurística | Score | Δ | Issue clave |
|---|-----------|-------|---|-------------|
| 1 | Visibilidad del estado | **4** | +1 | Indicador "conciliando" + banner de error + Gaps atenuado: manejo de async mejor que la mayoría de apps en prod. |
| 2 | Match con el mundo real | **4** | = | Español, vocabulario fiscal, "Búscalo en Alpha", nombres del equipo. |
| 3 | Control y libertad | **3** | = | Esc/Limpiar/Reintentar; los filtros se resetean al cambiar tab (sin feedback). |
| 4 | Consistencia | **3** | +1 | Contrato de color fuerte; PERO el tab Producción/H- aún usa el párrafo "Cómo interpretar" en vez de la clave colapsable. |
| 5 | Prevención de errores | **3** | = | Read-only; el riesgo real (leer un gap falso como real) está mitigado, pero el número rojo sigue ahí mientras es provisional. |
| 6 | Reconocer vs recordar | **3** | +1 | Clave colapsable + contrato de color; con la clave cerrada, distinguir 9 badges aún pide algo de recall. |
| 7 | Flexibilidad y eficiencia | **4** | +1 | Period/type/search/chips/CSV/cards→modal. Power-tool que se gana la densidad. |
| 8 | Estético y minimalista | **3** | +1 | Muro de leyenda quitado, compartidos a modal. Las filas más densas (6+ chips) rozan el techo a 1280px. |
| 9 | Recuperación de errores | **4** | +1 | El banner de conciliación nombra la consecuencia, el badge sospechoso y ofrece Reintentar. Ejemplar. |
| 10 | Ayuda y documentación | **3** | = | Clave + tooltips buenos; falta un solo lugar que explique por qué 3 sistemas alimentan un consecutivo. |
| **Total** | | **34/40** | **+6** | **Excellent / power-tool tier** |

## Anti-Patterns Verdict
**¿Hecho por IA? NO (0.5/10).** Decisiones ganadas en el dominio: el contrato de color de 4 niveles, la fila FALTANTE con folios vecinos+fecha, el estado de conciliación que existe "porque la versión naíf se tragaba el error y mostraba gaps falsos". El único resabio template-ish: el grid de stat-cards (auto-fit minmax), pero está justificado por contenido.

**Detector:** mismos 6 warnings, **todos fuera de AuditoriaView** (Arial del template de impresión, Geist como fuente UI, transition:width/height en StorageView). Limpio dentro de la vista.

**Overlays:** no disponibles (herramienta autenticada).

## Overall Impression
Subió de 28 a **34/40**. El motor de reconciliación + la honestidad del estado async + la fila FALTANTE con contexto lo ponen en territorio de herramienta-profesional, por encima de la banda 20-32 donde cae la mayoría. Lo que queda es pulir bordes, no rediseñar.

## What's Working
1. **Honestidad del estado async** (cards + banner + retry): el conteo de Gaps se atenúa con tooltip mientras cargan los RPCs, y un fallo produce un banner nombrado y accionable en vez de gaps falsos silenciosos. Mejor que muchos dashboards fintech comerciales.
2. **La fila FALTANTE con contexto** (`gapBracket`): convierte un hueco abstracto en una tarea acotada ("D-5840·3jun → D-5843·5jun, ¿cancelado o sin capturar?").
3. **El contrato de color de 4 niveles + clave agrupada**: 9 badges colapsan en 4 tiers de comportamiento (contabilizado/inerte/revisar/acción). Information architecture real.

## Priority Issues
- **[P1] El número rojo de Gaps es accionable antes de ser confiable.** Mientras concilia, la card muestra el conteo final atenuado (0.45); en ERROR de conciliación, el banner aparece pero el número rojo inflado se queda a fuerza completa. Marcelo ve "Gaps: 7" y escala, cuando el real es 2 (o el error lo hace irrelevante). **Fix:** mientras `reconciling` o `reconcileError`, renderizar el valor como skeleton / "—" / "?" en vez de un entero rojo confiado. → `/impeccable harden`
- **[P2] Dos idiomas de explicación entre tabs.** Folios usa la clave colapsable; Producción y H- aún terminan en el párrafo gris "Cómo interpretar" (el patrón que se quitó de Folios). Inconsistencia + el peak-end se arregló solo en Folios. Lupita, que vive en el tab P-, recibe la peor versión. **Fix:** portar la clave colapsable a Producción/H-. → `/impeccable distill`
- **[P2] Las filas más densas rozan el techo de legibilidad.** Una fila puede llevar folio + ícono + 3 badges + ANTICIPADO + CANCELADA·NC + cliente + P-XXXX + PO Corona + monto + fecha·productor, todo con flexWrap → a 1280px envuelve irregular y se rompe el escaneo tipo tabla. **Fix:** demotar metadata secundaria (monto, productor) a una 2ª línea muted o hover/expand; o capar badges visibles con un "+2". → `/impeccable layout`
- **[P3] Los filtros se resetean al cambiar de tab sin avisar.** `search` + `statusChip` se borran (intencional porque los chips difieren), pero invisible: un usuario a medio-búsqueda que cambia de tab pierde su query. **Fix:** preservar `search` (es agnóstico al tab) aunque los chips reseteen; o un toast "filtros reiniciados". → `/impeccable clarify`
- **[P3] Discoverability de la card "Compartidos".** Solo esa card es clickeable→modal; las otras 4 son inertes, así que el usuario aprende "las cards no son botones" y luego esta sí. El "VER ›" es sutil. **Fix:** afordancia persistente de botón en la card clickeable. → `/impeccable polish`

## Persona Red Flags
- **Karla (auditora principal) — MAYORMENTE PASA.** La fila FALTANTE con contexto y los badges con tooltip resuelven sus falsas alarmas. ⚠️ Falla en el número rojo provisional (P1): ella es quien actúa sobre él.
- **Marcelo (vistazo) — PARCIAL.** Las cards le dan el read de 5 segundos; ⚠️ el vistazo es riesgoso durante la conciliación (un rojo 7 atenuado sigue leyéndose "7 problemas").
- **Lupita (vive en el tab P-) — PARCIAL.** El strikethrough de venta-stock la protege; ⚠️ recibe la explicación de 2ª clase (muro gris "Cómo interpretar" en vez de la clave colapsable). Su tab más usado es el menos pulido.

## Minor Observations
- El `Rango` usa `D-5840 ↓ D-6012` con `<br/>↓<br/>` — el glifo "↓" pelón desentona en una herramienta fiscal precisa; un ícono de flecha matchearía.
- La sección H- capa el gap-fill en `(maxH-minH)<=4000` → cliff silencioso (si un import ensancha el rango, la detección degrada sin aviso).
- El badge gris externo empaca 3 estados (auto_zero/pagada_alpha/cancelada) en un solo gris, distinguidos por ícono (✓ vs ✗) + tooltip a 10px (mucha carga semántica en el ícono).
- `invoiced_by==="secretaria"?"Lupita"` está hardcodeado en 3 lugares — quiere ser un helper.

## Questions to Consider
1. ¿Debería existir el conteo de Gaps ANTES de que termine la conciliación? Ya decidiste que los gaps falsos son el pecado capital (3 RPCs + banner lo prueban). Si es así, ¿por qué renderizar CUALQUIER número, aun atenuado, hasta que el dato sea confiable? Un skeleton elimina el valle del P1.
2. ¿Tres secciones de consecutivo (Folios/P-/H-) son tres vistas o una repetida 3 veces? Comparten ~80% de estructura con vocabularios de chip sutilmente distintos. ¿La duplicación ayuda a construir un modelo mental o fuerza a re-aprender tres?
3. ¿Quién es la audiencia de la clave de badges cuando arranca cerrada? Si los expertos nunca la abren y los primerizos no saben que existe, el vocabulario de 9 badges queda sin documentar en el momento de la confusión.
4. El CSV se enmarca como la auditoría "a fondo". Si la auditoría más profunda pasa en Excel contra Alpha, ¿esta vista es un dashboard de TRIAGE más que una herramienta de auditoría, y debería optimizar más el vistazo de 10 segundos ("¿hay algo rojo?") que el read denso fila por fila?
