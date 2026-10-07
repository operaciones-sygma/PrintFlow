---
target: DetailModal (el detalle de la orden), tercera pasada
total_score: 38
p0_count: 0
p1_count: 0
timestamp: 2026-10-07T01-48-47Z
slug: src-app-jsx-detailmodal
---
# Critique: DetailModal (PrintFlow, el detalle de la orden), tercera pasada (v10.84.47)

Visto EN PRODUCCIÓN (cuenta de pruebas, sólo lectura) como admin, karla y producción a 1366. Nota de método: esta vez el
detector corrió antes de escribir la evaluación, como parte de la revisión del despliegue; la evaluación se apoya en las
capturas y el código.

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|-----------|-------|-----------|
| 1 | Visibilidad del estado | 4 | n/a: etapa, entrega, importe y folio con su pago, arriba |
| 2 | Lenguaje de la persona | 4 | n/a |
| 3 | Control y libertad | 4 | n/a: Esc cierra primero el menú; lo destructivo confirma |
| 4 | Consistencia | 4 | n/a: un relleno; «Más» como el de la ficha; Tab atrapado |
| 5 | Prevención de errores | 4 | n/a |
| 6 | Reconocer, no recordar | 4 | n/a |
| 7 | Flexibilidad | 3 | La acción del rol no tiene atajo de teclado |
| 8 | Estética y minimalismo | 4 | n/a: el «Nombre interno» bajó después del contacto y se lee |
| 9 | Recuperarse de errores | 4 | n/a |
| 10 | Ayuda | 3 | «El cliente no pide factura» no dice qué pasa (lo dice su diálogo en App) |
| **Total** | | **38/40** | **Excelente** |

## Anti-Patterns Verdict

**Evaluación de diseño:** no parece hecha por IA; es de la familia, con un solo relleno y lo raro en «Más».

**Detector (código):** 0 hallazgos en los 251 renglones del componente.

**Detector en la página (6 casos en producción):** sin contraste bajo ni renglones largos; sólo lo que es por diseño
(«tiny-text», «overused-font») y el falso «gradient-text».

## Overall Impression

23 → 37 → 38. Lo que faltaba de la segunda (la etiqueta del nombre interno en gris tenue y su lugar) quedó.

## Priority Issues

- **[P3] La acción del rol sin atajo.** → /impeccable polish
- **[P3] «El cliente no pide factura» no se explica en el pie.** → /impeccable clarify
