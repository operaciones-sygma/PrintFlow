---
target: vista En espera (v10.73.28)
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-07-02T16-28-17Z
slug: src-app-jsx-view-espera
---
# /impeccable critique — Vista "En espera" (v10.73.28)

## Design Health Score

| # | Heurística | Score | Issue clave |
|---|-----------|-------|-------------|
| 1 | Visibilidad del estado | 4 | Estado sobre-comunicado (bien): contador role-scoped en sidebar+header, subtítulo, badge por grupo, banner motivo/quién/fecha. Fortaleza clara. |
| 2 | Match mundo real | 3 | "Volver a producción" miente para salidas/design/proof_client: nunca estuvieron "en producción". |
| 3 | Control y libertad | 3 | Reversible y visible; falta "volver todas" por grupo + sin undo/toast tras reactivar. |
| 4 | Consistencia | 3 | Reusa OCard/StageLbl/header/empty-state; el badge de conteo por grupo NO calca el chip del board de Karla (2 estilos). |
| 5 | Prevención de errores | 3 | Se puede AVANZAR de etapa una orden pausada sin resumirla (el muro de StageFlowButtons sigue visible). Recuperable. |
| 6 | Reconocer > recordar | 3 | Motivo/quién/etapa presentes; el botón idéntico para toda etapa obliga a recordar a dónde vuelve cada una. |
| 7 | Flexibilidad y eficiencia | 2 | Sin acción en lote, sin colapsar grupos, sin orden por urgencia. Admin = scroll largo todo expandido. |
| 8 | Estético y minimalista | 2 | "En espera" aparece 3× por card (título + chip T1 + banner) + chip de etapa duplica el header de grupo. |
| 9 | Recuperación de errores | 3 | Unsnooze accidental recuperable vía ⋯, sin undo inmediato. Aceptable. |
| 10 | Ayuda y documentación | 3 | Buen help inline (subtítulo + empty-state enseñan). Baja medio punto por desajuste botón/subtítulo. |
| **Total** | | **29/40** | **Bueno** (la mayoría de las interfaces reales caen 20-32) |

## Anti-Patterns Verdict

**LLM (slop):** NO es AI-slop. Pasa el product slop test — un usuario fluido en Linear/Notion confía sin frenarse. Lo nuevo es un calque fiel de patrones que ya existen en PrintFlow (header/subtítulo = vista Archivo al pixel, grid = vista Todas, banner = el mismo markup que la Torre). Vocabulario de iconos disciplinado (BellSlash=estado, BellRinging=reactivar). Ausentes los tells clásicos (gradientes, glass, emojis en UI, motion decorativo, empty-state marketing). Los defectos son de craft/token, no de slop.

**Detector (detect.mjs):** 6 warnings, TODOS falsos positivos / ruido app-wide preexistente, NINGUNO toca lo nuevo. Verificado leyendo el código: overused-font = Arial del CSS de impresión + "Geist" (la fuente oficial del app); layout-transition width/height = colapso del sidebar + progress-bars, fuera del bloque view==="espera". El banner nuevo usa border/background 100% estáticos (cero transition); el grid es CSS grid.

**Overlays visuales:** navegador headless → sin overlays; se reporta como fallback (no hay evidencia de browser).

## Overall Impression

Feature sólido y bien construido: el **agrupado por etapa** es la decisión más acertada (convierte "un montón de pausadas" en un tablero triage-able que sirve directo al "se echan la bolita"), y todo hereda gratis el ritmo ya afinado de la app. **La grieta es que la vista reusa `OCard` tal cual**, y esa card no fue diseñada para un tablero de triage: expone el muro completo de botones de avance sobre órdenes pausadas, repite la señal "En espera" tres veces, y deja el CTA que da nombre a la vista ("Volver a producción") como el elemento más pequeño de la card. **La oportunidad #1 es un "modo espera" de OCard** que la adelgace al propósito: motivo claro + un solo botón grande para reactivar.

## What's Working

1. **Agrupación por etapa (STAGE_SEQUENCE, maquila al final).** Triage instantáneo por área; cada responsable ve su columna de pendientes por soltar. Sirve al problema real.
2. **Calque fiel de las vistas hermanas.** Header 18/800 + BellSlashIcon, subtítulo 11/C.t2 con eco de búsqueda, grid minmax(440px)/gap10 = idénticos a Archivo/Todas. Cero costo de aprendizaje, se siente nativo desde el primer render.
3. **Restraint correcto.** Contador oculto cuando N=0 (a diferencia de "Pendientes (0)"), empty-state verde (estado sano) en vez de gris triste, y el CTA en acento tenue que no compite con las alertas rojas/ámbar.

## Priority Issues

**[P1] "Volver a producción" es semánticamente falso e inconsistente para etapas no-productivas.** El label está hard-coded para todas las etapas/roles. Para Karla (salidas / maq_received / awaiting_client_invoice) esas órdenes YA terminaron producción: esperan folio/entrega o que el cliente pida factura. Y la MISMA orden ofrece "Quitar espera" / "Ya pidió factura · Reactivar" en su Tablero de folios → dos etiquetas distintas para el mismo objeto erosionan la confianza en el botón.
- **Fix:** derivar la etiqueta por etapa/kind (reusar la lógica que ya existe en el card del board de Karla): producción → "Volver a producción"; salidas/maq_received → "Quitar espera"; awaiting_client_invoice → "Ya pidió factura · Reactivar". `unsnoozeLabel` ya es parametrizable.
- **Comando:** `/impeccable clarify`

**[P1] La card expone el muro de avance de etapa sobre órdenes pausadas (contradice el propósito del tablero).** En el path `canAct`, cada OCard renderiza StageFlowButtons + el cluster de iconos + el menú ⋯. En una vista cuyo trabajo es "esto está en pausa, decide si lo reactivas", ver todos los botones de avance sube las decisiones visibles por encima de 4 y permite avanzar una orden sin resumirla conscientemente.
- **Fix:** un "modo espera" para OCard (prop análoga a `inOCView`) que suprima StageFlowButtons/cluster de avance y deje solo el reactivar + abrir detalle.
- **Comando:** `/impeccable distill`

**[P2] El CTA principal es el elemento más pequeño de la card.** "Volver a producción" es el verbo de toda la pantalla pero está a `fontSize:10` (piso de la escala F.meta), padding 3px 9px, ghost, encajado a la derecha del banner. Contraste directo con el botón reactivar de Karla en el board: full-width, centrado, claramente mayor. La intención "esta vista existe para reactivar" no se lee en el peso del control (y 10px+3px es target chico para uso operativo).
- **Fix:** en el contexto de la vista espera, subir a `F.body` (11) + padding un punto mayor (o dar más presencia al banner). No hace falta gritar en herramienta interna densa, pero este es EL botón.
- **Comando:** `/impeccable layout`

**[P2] Falso "todo bien": el empty-state verde dispara durante la carga y bajo búsqueda sin match.** `esperaOrders` sale de datos async → antes de que carguen, la vista muestra el verde "Nada en espera" (all-clear). Y como `filteredOrders` aplica el search global, si el término no matchea ninguna pausada la vista cae al mismo verde tranquilizador aunque HAYA órdenes atoradas. El chip pequeño del subtítulo no compite con el CheckCircle verde grande.
- **Fix:** gate de loading (skeleton) mientras no resuelve la primera carga; y cuando hay búsqueda activa y 0 resultados, mostrar un empty-state neutro "Sin resultados para '<término>'" + "Limpiar búsqueda" (patrón que ya usa Todas), reservando el verde solo para 0 pausadas SIN búsqueda.
- **Comando:** `/impeccable harden`

**[P2] Duplicación de la señal "En espera" + borde punteado semánticamente flojo.** Dentro de esta vista una card dice "En espera" hasta 3× (título de página + chip T1 + banner) y el chip de etapa repite el StageLbl que ya es el header del grupo. Además el banner usa `1px dashed` — en registro product el punteado es vocabulario de "zona vacía / placeholder", pero aquí envuelve contenido REAL y vigente (la única línea que justifica por qué la orden no avanza), así que lee más suave que el estado que carga.
- **Fix:** suprimir el chip T1 y el chip de etapa cuando la card vive en esta vista agrupada (prop `inEsperaView`). Cambiar el punteado a **borde sólido 1px C.bd** o un **tinte de fondo** sutil (p.ej. C.amb+"0d") para leerlo como status-callout. (NO usar side-stripe / borde-izquierdo de color: viola el ban de impeccable.)
- **Comando:** `/impeccable distill`

## Persona Red Flags

**Gerardo (Producción, revisa a diario sus pausadas):** funciona bien para él (sus etapas SON producción, el copy es literal). Pero el botón vive dentro de un banner deliberadamente quieto (C.sf + dashed) → puede leerlo como informativo, no como el CTA; y el único color vivo es el botón mismo.

**Karla (Folios/Salidas):** el copy le rompe. Sus órdenes esperan folio/factura, no producción — "Volver a producción" suena falso ("¿por qué mandaría esto de vuelta a producción?") y las `awaiting_client_invoice` pierden su affordance específica ("Ya pidió factura"). Inconsistente con lo que la misma orden dice en su board.

**Nadia (Pre-prensa, primer uso, 0 pausadas):** el empty-state enseña, pero el copy "Las órdenes que pauses aparecerán aquí" asume que el viewer puede pausar; un rol que casi nunca es responsable ve una promesa hueca. Y el verde "Nada en espera" combinado con la falta de loading produce falsos "todo bien".

## Minor Observations

- Badge de conteo por grupo en `C.t3` sobre `C.sf` (el texto más apagado sobre la superficie más apagada) → el único dato cuantitativo del header queda como lo más débil de leer. Subir a `C.t2` o al color de la etapa.
- Empty-state hecho a mano (46/15/12 sueltos) en vez del componente `EmptyState` canónico que usa Todas. Consistencia.
- El unsnooze aparece 2× para roles canAct (banner + menú ⋯), ambos con la misma etiqueta. Redundancia.
- El banner está duplicado byte-a-byte en los paths canAct/!canAct + la variante Torre = 3 copias → riesgo de drift. Extraer a `SnoozeBanner`.
- El banner atribuye a `snoozed_by` (quién pausó), no al responsable actual del área.
- Header 18/800 NO es slop: calca exactamente Archivo/Todas/Calendario (convención propia de PrintFlow).

## Questions to Consider

- Dentro de cada grupo se ordena por cliente A-Z. Para un tablero de "atoradas", ¿no querría el operador las más viejas / próximas a vencer primero (ordenar por `snooze_until` / `due_date`)?
- Para el caso admin-todas (scroll largo), ¿colapsar grupos con `<details open>` como ya hace el board de Karla?
- ¿Vale una acción en lote "volver todo el grupo" para el admin?
