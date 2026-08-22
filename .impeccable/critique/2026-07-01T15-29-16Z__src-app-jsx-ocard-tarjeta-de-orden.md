---
target: OCard (tarjeta de orden)
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-07-01T15-29-16Z
slug: src-app-jsx-ocard-tarjeta-de-orden
---
# /impeccable critique — OCard (re-score #2) · 28/40 · reviewer independiente estricto

CAVEAT: trend 27→30→28 = reviewers LLM distintos (±2-3 varianza), NO regresión. La card mejoró en lo atacado
(bloque fiscal→Badge chips, a11y completa, escala F de punta a punta). Este reviewer #2 más estricto encontró
2 P1 válidos no atacados antes.

## Scores (0-4)
1 Visibility 3 | 2 Match 4 | 3 Control 3 | 4 Consistency 2 | 5 Error-prev 3 | 6 Recognition 3 | 7 Flexibility 2 |
8 Aesthetic 2 | 9 Error-recov 3 | 10 Help 3 = 28/40

## Anti-patterns: PASA. Detector 0 hits dentro de OCard. No slop; al contrario, over-considered (210 líneas, ~30 ramas).

## P1 (nuevos, válidos)
[P1] Cluster de acciones = 6-8 iconos icon-only (>4 opciones). El harden previo solo movió las destructivas al
menú ⋯; las utilitarias (duplicar/imprimir/flujo/editar/histórico/mover) siguen inline sin texto. Fix: demoter
las raras (flujo/duplicar/mover/histórico) al ⋯, dejar ~3 visibles. Cmd: /impeccable distill.

[P1 a11y] Chips PAGADA/PARCIAL = C.live/C.fac sobre tinte 15% del mismo hue, texto chico ~2:1 → falla WCAG AA.
Distinción crítica pagado-vs-parcial por color de bajo contraste. Fix: oscurecer foreground a AA + par icono/palabra.
Cmd: /impeccable harden.

## P2
[P2] El chip de ETAPA (identity primario) quedó como <span> bespoke, no migró a Badge; 5 footers divergen (bs/bt/
inline); misma acción Mover/Cancelar icon-only en cluster canAct vs texto en footer no-canAct. Cmd: /impeccable extract.
[P2] Bloque fiscal + fila de 5 flags NUNCA colapsan (el +N/⋯ solo colapsan T3 badges + destructivas). En orden
mega-flageada es la parte más alta. Cmd: /impeccable distill (colapsar tras "detalles fiscales").

## P3
[P3] Sin multi-select/bulk/atajos a acciones por card (techo de Lupita). Cmd: /impeccable optimize (nivel vista).

## Strengths (confirmados): triage 3 tiers; nudge card-muda→accionable; contención destructiva (menú+divisor+a11y).

## Persona: Lupita = mayor perdedora (cluster icon-only sin bulk, misma acción con 2 vocabularios). Germán: color-only
en pago/late muere a distancia. Karla: mejor servida, pero folios múltiples sin uno primario.
