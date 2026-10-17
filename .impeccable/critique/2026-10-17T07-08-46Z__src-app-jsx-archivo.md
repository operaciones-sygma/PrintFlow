---
target: el «Archivo» (Archive, src/App.jsx)
total_score: 22
p0_count: 0
p1_count: 2
timestamp: 2026-10-17T07-08-46Z
slug: src-app-jsx-archivo
---
# /impeccable critique — el «ARCHIVO» (de completadas)

`Archive` en `src/App.jsx` (lo entregado y lo cancelado por año → mes → semana, con su ingreso; todos los roles, con el archivo completo cargado), con su
montaje en App. 17-oct-2026, madrugada. Evaluación A (diseño, con el código y el banco) antes de la B (el detector). Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | «Total: 6» revuelve entregadas y canceladas; la cancelada dice «Cancelada: 20-sep», que es su captura |
| 2 | El mundo real | 1 | «Facturado total» a lo entregado sin IVA (hay remisiones; el Dashboard ya lo corrigió en la 124); «Semana 3» sin días; «NC pendiente» |
| 3 | Control y libertad | 3 | carpetas que se abren y cierran |
| 4 | Consistencia | 2 | para el vendedor cuenta sólo lo que él capturó; la ficha del tablero ya cuenta lo que lleva como vendedor |
| 5 | Prevención de errores | 3 | sólo lectura |
| 6 | Reconocer, no recordar | 2 | el id interno «OP-…» junto al folio P-; la semana no dice qué días |
| 7 | Flexibilidad y eficiencia | 2 | las fichas no se abren con el teclado |
| 8 | Estética y minimalismo | 2 | insignias de 9 px en colores de semáforo |
| 9 | Recuperarse de errores | 3 | sin el archivo cargado no dice cifras (ofrece cargarlo) |
| 10 | Ayuda | 2 | «Órdenes entregadas organizadas por fecha» |
| **Total** | | **22/40** | **Aceptable** |

## ¿Parece hecho por IA?

No: carpetas de año, mes y semana. **El detector (navegador, sobre el banco):** sólo letra chica (10 y 11 px, la de la app); no vio el contraste: lo midió
la tanda componiendo los tintes (el dinero en verde sobre la carpeta abierta, 4.1-4.5:1; «Canceladas» en rojo, 3.7:1; las insignias de 9 px).

## Problemas principales

- **[P1] «Facturado total» a lo entregado.** Es el ingreso de lo entregado, sin IVA (y hay remisiones). Arreglo: «Ingreso, lo entregado sin IVA».
- **[P1] El vendedor ve de menos.** Cuenta sólo lo que capturó; lo que Lupita le captura (él es el vendedor) no: a Genaro le faltaban $34,660 de $338,765
  en 120 días. Arreglo: la regla de la ficha (`isVendedorOwnerByAgent`).
- **[P2] La cancelada va por su captura.** Una capturada en septiembre y cancelada en octubre salía en septiembre y decía «Cancelada: 20-sep». Arreglo: por
  `cancelled_at`.
- **[P2] El resumen revuelve.** «Total: 6» → «Entregadas: 5 · Canceladas: 1».
- **[P2] Teclado y AA:** las fichas son div con clic; insignias de 9 px en ámbar y rojo; el dinero sobre los tintes. Arreglo: botón, 10 px, tintas.
- **[P3]** «Semana 3» → «Del 11 al 17»; sin el id interno; «órdenes» con acento; «nota de crédito pendiente», «Editada después de facturar».

## Preguntas

- Con «Todas» arriba, el vendedor ve las entregadas de todos y su ingreso es sólo lo suyo: ¿el Archivo del vendedor debería enseñar sólo lo suyo?
