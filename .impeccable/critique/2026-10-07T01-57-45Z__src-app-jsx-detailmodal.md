---
target: DetailModal (el detalle de la orden), cuarta pasada
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-10-07T01-57-45Z
slug: src-app-jsx-detailmodal
---
# Critique: DetailModal (PrintFlow, el detalle de la orden), cuarta pasada (v10.84.47 en producción)

Visto EN PRODUCCIÓN (cuenta de pruebas, sólo lectura), con más roles y etapas reales que la tercera: german en CTP (P-0599),
producción en Máquina (P-0591) y Empaque (P-0585), karla en Salidas (P-0589) y en espera (P-0583), admin en Lista (P-0607) y
entregada (P-0554), secretaría en maquila (P-0598).

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|-----------|-------|-----------|
| 1 | Visibilidad del estado | 3 | Sin botón, el detalle no dice qué sigue: la guía («Arrastra esta orden a una máquina en el Tablero») se escondía con el renglón (regresión de v10.84.46) |
| 2 | Lenguaje de la persona | 4 | n/a |
| 3 | Control y libertad | 4 | n/a |
| 4 | Consistencia | 3 | «CLIENTE» sin nada debajo para producción, preprensa y Germán |
| 5 | Prevención de errores | 4 | n/a |
| 6 | Reconocer, no recordar | 4 | n/a |
| 7 | Flexibilidad | 3 | La acción del rol no tiene atajo |
| 8 | Estética y minimalismo | 3 | En Salidas, el pie de karla tiene tres renglones de botones |
| 9 | Recuperarse de errores | 4 | n/a |
| 10 | Ayuda | 3 | «El cliente no pide factura» sólo se explica en un title |
| **Total** | | **35/40** | **Bueno** |

La tercera pasada dio 38 viendo menos roles; ésta mira los roles de piso y encuentra una regresión de v10.84.46.

## Anti-Patterns Verdict

**Evaluación de diseño:** no parece hecha por IA.

**Detector (código):** 0 hallazgos en 251 renglones. **En la página (6 casos):** sólo lo que es por diseño («tiny-text»,
«overused-font») y el falso «gradient-text». Lo de esta pasada es de comportamiento y estructura: no lo ve un detector.

## Priority Issues

- **[P2] La guía «qué sigue» se esconde cuando no hay botón.** El renglón del flujo se mostraba sólo si había un botón; la guía
  es texto. Arreglo: el renglón sale si trae algo (botón o guía); «Imprimir» va relleno sólo si no hay botón. → /impeccable harden
- **[P2] «CLIENTE» vacío para los roles de piso.** Arreglo: el rótulo sólo con los datos de contacto; el «Nombre interno» trae
  el suyo. → /impeccable distill
- **[P2] «El cliente no pide factura» sin explicación y el pie en tres renglones.** Arreglo: a «⋯ Más» como «Poner en espera:
  no ha pedido factura», con la explicación que hoy vive en el title. → /impeccable clarify
- **[P3] Sin atajo para la acción del rol.** Arreglo: Ctrl+Enter, como en «Folio por OC», sin dispararse escribiendo en un
  campo. → /impeccable polish
- **[P3] El renglón de datos vacío deja un hueco en el encabezado.** → /impeccable polish
