---
target: «Cancelaciones» (CancelacionesView y OrderPickCard, src/App.jsx)
total_score: 22
p0_count: 0
p1_count: 1
timestamp: 2026-10-17T06-36-46Z
slug: src-app-jsx-cancelaciones
---
# /impeccable critique — «CANCELACIONES»

`CancelacionesView` en `src/App.jsx` (cancelar en lote y el historial; Dirección, Lupita y Karla), con su montaje en App y la ficha para elegir
(`OrderPickCard`, compartida con Devoluciones y «Agregar producto existente» de la OC). 17-oct-2026, madrugada. 6 órdenes canceladas en 30 días. Desde
v10.84.113 cada orden del lote se cancela completa, como en el detalle (`src/lib/cancelarEnLote.js`, tanda `cancelaciones`); esta pasada es la pantalla.
Evaluación A (diseño, con el código y el banco) antes de la B (el detector). Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | «N seleccionadas · M con folio (NC)» y el saldo total; nada de qué cae con cada una |
| 2 | El mundo real | 2 | «NC pend.», «NC ✓»; el buscador habla de «folio (D-/R-)», las series de Alpha |
| 3 | Control y libertad | 2 | un clic cancela N órdenes; no hay paso para revisar |
| 4 | Consistencia | 1 | «Cancelar orden» del detalle dice todo lo que cae y pregunta (v10.84.73); el lote no |
| 5 | Prevención de errores | 1 | con el motivo escrito, «Cancelar (N)» cancela de una vez, también lo facturado (Dirección) |
| 6 | Reconocer, no recordar | 3 | la ficha dice folio, etapa y cliente |
| 7 | Flexibilidad y eficiencia | 3 | buscar, elegir varias; el historial no se abre con el teclado |
| 8 | Estética y minimalismo | 3 | sobria |
| 9 | Recuperarse de errores | 3 | las que fallan se quedan elegidas para reintentar |
| 10 | Ayuda | 2 | la explicación de arriba es larga y en renglones de ~127 caracteres |
| **Total** | | **22/40** | **Aceptable** |

## ¿Parece hecho por IA?

No. **El detector (navegador, sobre el banco), antes:** el botón apagado a 1.4:1 (blanco sobre gris claro), el aviso del saldo en ámbar a 2.0:1, el
rojo de «N seleccionadas» a 4.3:1, renglones de ~127 caracteres; letra de 10 y 11 px (la de la app). **Después:** sólo la letra de la app.

## Problemas principales

- **[P1] El lote no pregunta ni dice qué cae.** Arreglo: «Revisar y cancelar» abre una confirmación con cada orden y lo que le pasa (las piezas del
  detalle: `HechoDeCancelar`, `filaAlCancelar`): su factura y la nota de crédito, las partes, la agrupada, el plan matriz, el saldo a favor que regresa (por
  orden: `ordenes_saldo_consumido` ya lo da), la fila de su máquina; el motivo citado y a quién se avisa. Esc y «Regresar» no pierden nada.
- **[P2] AA:** el ámbar del saldo, el rojo, «NC pend.» en ámbar, «CANCELADA», el botón apagado ilegible, 9 px en la ficha para elegir.
- **[P2] El historial no se abre con el teclado** (el número era un span con clic).
- **[P3]** «folio (D-/R-)» → «folio (F-…, RS-…)» (también en Devoluciones); «NC» en palabras.

## Lo que encontró la prueba en el arreglo (vueltas 2 a 4)

- La orden que se cancela en otra sesión con la confirmación abierta se seguía mandando.
- Lupita podía confirmar una orden que recibió su folio con la confirmación abierta (lo facturado es de Dirección).
- Mientras se lee el saldo a favor se podía confirmar sin haberlo visto; y si la lectura se colgaba, la confirmación se trababa (ahora, tope de 8 s; lo
  que llega después se dice).

## Preguntas

- La lista para elegir trae TODAS las órdenes no canceladas (también entregadas y facturadas), 30 a la vez: ¿convendría que empezara por las activas?
