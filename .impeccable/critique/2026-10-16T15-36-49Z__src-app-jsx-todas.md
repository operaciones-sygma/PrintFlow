---
target: «Todas» (la lista de todas las órdenes, src/App.jsx)
total_score: 22
p0_count: 0
p1_count: 2
timestamp: 2026-10-16T15-36-49Z
slug: src-app-jsx-todas
---
# /impeccable critique — «Todas» (la lista de todas las órdenes)

`view==="orders"` en `src/App.jsx` (desde v10.84.125, `VistaTodas`), con la ficha completa (`OCard`). 16-oct-2026 por la mañana (Marcelo: «sigamos con más
/impeccable critique en general y mejoras»). Evaluación A (diseño, con el código y la captura del recorrido en producción como Lupita, 1366×768) antes
de la B (el detector de la skill en el navegador, en un banco con 1002 órdenes como en producción). Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | «Todas (1002)» sin decir qué incluye; sin lectura buena, «Todas (0) · Sin órdenes que mostrar» |
| 2 | El mundo real | 3 | la ficha habla como la app |
| 3 | Control y libertad | 2 | nada para acotar salvo el buscador de arriba; 1002 fichas de corrido |
| 4 | Consistencia | 3 | la misma ficha que en «Pendientes» |
| 5 | Prevención de errores | 3 | cancelar pregunta |
| 6 | Reconocer, no recordar | 2 | sin filtros por estado hay que saber el folio o el cliente |
| 7 | Flexibilidad y eficiencia | 1 | tres órdenes por pantalla; la página de 137,000 px; 1.1 s para pintar las 1002 (en una PC más lenta, más) |
| 8 | Estética y minimalismo | 2 | cada ficha lo trae todo (teléfono, specs, avance, acciones, «le toca», «validada») |
| 9 | Recuperarse de errores | 2 | la regla 12 |
| 10 | Ayuda | 2 | nada |
| **Total** | | **22/40** | **Aceptable** |

## ¿Parece hecho por IA?

No: es la ficha de la app repetida. El problema es de densidad y de cuánto se pinta, no de plantilla. **El detector:** antes, 1003 hallazgos con
Lupita y Dirección (1002 son el teléfono de WhatsApp en verde #25d366 sobre blanco, 1.9:1, uno por ficha), y los falsos positivos de siempre (Geist,
«gradient-text»); la tanda midió además la etapa en su color (3.0:1), el avance «7/13» (3.3:1) y «Prod · Pre-p» (2.6:1). Después: sólo los falsos positivos.

## Impresión general

Una lista de 1002 órdenes hecha de fichas de tablero: sirve para encontrar una con el buscador, no para revisar. Y al abrir, arriba salían urgentes de
hace meses, no lo de hoy.

## Lo que funciona

- El buscador de arriba filtra bien (folio, cliente, producto) y la ficha abre su orden con el teclado.
- La ficha es la misma de toda la app: lo que se aprende en «Pendientes» sirve aquí.

## Problemas

- **[P1] Pintaba las 1002 de golpe** (1.1 s y una página de 137,356 px en el banco; tres órdenes por pantalla). **Arreglo:** de 40 en 40 con «Ver 40 más
  (quedan N)» y «Se ven 40 de 1,002»; abre en 180 ms y la página mide 7,844 px. *Comando: /impeccable optimize.*
- **[P1] Al abrir, arriba salían urgentes de hace meses** (el orden ponía TODAS las urgentes primero, también las entregadas): la orden más nueva quedaba
  debajo de ~60. **Arreglo:** las activas primero (las urgentes arriba) y luego lo cerrado por fecha.
- **[P2] Sin filtro por estado.** **Arreglo:** «Todas · Activas · Entregadas · Canceladas», cada una con su cuenta, con el teclado (`aria-pressed`); el
  filtro sin nada lo dice («No hay órdenes canceladas con «X».»).
- **[P2] Sin lectura buena: «Todas (0) · Sin órdenes que mostrar»** (la regla 12). **Arreglo:** «Sin cifras mientras no se lea de la base.»
- **[P2] Contraste dentro de la ficha (compartida):** el teléfono (1.9:1), la etapa (3.0), el avance (3.3) y «Prod · Pre-p» (2.6). **Arreglo:** en su tinta
  (`tintaAA`, `okInk`/`wnInk`), en todas las vistas que usan la ficha. *Comando: /impeccable polish.*
- **[P3, para Marcelo] La densidad:** aun de 40 en 40 son fichas grandes (dos por renglón). Una lista compacta (folio, cliente, producto, etapa, entrega,
  monto) que abra el detalle serviría más para revisar. *Comando: /impeccable distill.*

## Personas

- **Lupita** (busca una orden para contestarle a un cliente): sin buscador, desplazarse por fichas de 460 px; con él, bien.
- **Karla** (revisa lo entregado de la semana): no podía ver sólo lo entregado.
- **Marcelo** (revisa lo cancelado): ídem; y en una laptop las 1002 fichas tardaban en pintarse.

## Preguntas

- ¿«Todas» es para buscar o para revisar? Si es para revisar, ¿una lista compacta en vez de fichas?
