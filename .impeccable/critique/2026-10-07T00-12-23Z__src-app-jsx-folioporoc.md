---
target: Folio por OC (AssignOCFolioModal), quinta pasada
total_score: 40
p0_count: 0
p1_count: 0
timestamp: 2026-10-07T00-12-23Z
slug: src-app-jsx-folioporoc
---
# Critique: Folio por OC (PrintFlow), quinta pasada (v10.84.45)

Target: `src/App.jsx`: AssignOCFolioModal. Visto en el banco `tests/banco/gen-oc.mjs` a 1366x768 en Simple (normal, Corona,
Cuadra, a mano, pre-asignar).

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|-----------|-------|-----------|
| 1 | Visibilidad del estado | 4 | n/a |
| 2 | Lenguaje de la persona | 4 | n/a |
| 3 | Control y libertad | 4 | n/a |
| 4 | Consistencia | 4 | n/a |
| 5 | Prevención de errores | 4 | n/a |
| 6 | Reconocer, no recordar | 4 | n/a |
| 7 | Flexibilidad | 4 | n/a |
| 8 | Estética y minimalismo | 4 | n/a: en Simple, un solo recuadro dice qué se crea, por cuánto, a quién y cómo va el folio |
| 9 | Recuperarse de errores | 4 | n/a |
| 10 | Ayuda | 4 | n/a |
| **Total** | | **40/40** | **Excelente** |

## Anti-Patterns Verdict

**Evaluación de diseño:** no parece hecha por IA. Un bloque relleno (la acción), lo seleccionado teñido, un recuadro por idea.

**Detector (código):** 0 hallazgos en los 727 renglones del componente.

**Detector en la página (7 variantes):** sólo lo que es por diseño (escala compacta de 9 a 15 px y Geist: «tiny-text»,
«flat-type-hierarchy», «overused-font») y el falso «gradient-text» (el único `background-clip` de la app es `content-box`).

## Overall Impression

20 → 30 → 35 → 39 → 40 en cinco pasadas. La última juntó la nota del folio con la vista previa: Simple quedó con un solo
resumen de la acción y, a 1366, cabe completa sin bajar.

## Minor Observations

- En Dividir la nota del folio sigue en su propio recuadro: es la única vez que se dice ahí y se queda.
