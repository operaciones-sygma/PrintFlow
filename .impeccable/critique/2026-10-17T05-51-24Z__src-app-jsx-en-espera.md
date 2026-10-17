---
target: «En espera» (la vista de App y OCard en su modo inEsperaView, src/App.jsx)
total_score: 20
p0_count: 0
p1_count: 2
timestamp: 2026-10-17T05-51-24Z
slug: src-app-jsx-en-espera
---
# /impeccable critique — «EN ESPERA»

La vista de App `view==="espera"` (todos los roles menos el visor; cada quien lo suyo, Dirección todo), con la ficha (`OCard` en su modo `inEsperaView`).
16-oct-2026, noche. Escena: Karla, en la oficina a 1366, revisa lo pausado para decidir qué se mueve. Medido en producción: **las 21 pausadas son «En
espera: el cliente no ha pedido factura»** (14 en Salidas y 7 recibidas de maquila), todas de Karla, sin fecha límite, 7 con la entrega vencida, $296,286.54
sin IVA; la más vieja, P-0070 (Castores), lleva 82 días lista. Lo que sigue con cada una es **preguntarle al cliente** si ya quiere su factura y, cuando la
pide, foliarla. Evaluación A (diseño, con el código y el banco) antes de la B (el detector). Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | el título cuenta y la píldora dice los días en espera; nada de cuánto es |
| 2 | El mundo real | 1 | el subtítulo manda a «Volver a producción», que no existe para ninguna de las 21; «se reactivan solas al vencer»: éstas no tienen fecha |
| 3 | Control y libertad | 3 | reactivar, una o en lote, tiene «Deshacer» |
| 4 | Consistencia | 2 | «Reactivar las N» es un botón dentro del `<summary>` (un botón dentro de otro); semáforo como texto |
| 5 | Prevención de errores | 1 | «Reactivar las 14» afirma que los 14 clientes pidieron su factura a la vez y las regresa a «vencidas» |
| 6 | Reconocer, no recordar | 2 | en la vista cuya acción es llamar al cliente, la ficha esconde el teléfono, el agente de compras y el importe |
| 7 | Flexibilidad y eficiencia | 2 | dentro de cada etapa, alfabético: la de 82 días queda donde caiga su nombre |
| 8 | Estética y minimalismo | 3 | fichas tranquilas, el motivo arriba |
| 9 | Recuperarse de errores | 3 | sin lectura ya no dice «Nada en espera» (v10.84.132) |
| 10 | Ayuda | 1 | el subtítulo explica otra cosa |
| **Total** | | **20/40** | **Aceptable** |

## ¿Parece hecho por IA?

No: fichas de trabajo con su motivo. **El detector (navegador, sobre el banco, con los grupos abiertos):** renglones de ~202 caracteres en el subtítulo,
letra de 10 y 11 px (la de las fichas de toda la app), interlineado de 1.3 en el motivo; después, renglones de ~95 → ~80 y lo de toda la app. **No vio el
contraste:** las píldoras de antigüedad (más de 7 días en ámbar a 1.8:1, más de 21 en rojo a 3.5:1), «1 atrasada de producción» (3.6:1), «Motivo:» (4.2:1),
la cuenta de los chips con opacidad (3.3:1), «Le toca a…» (4.2:1): los midió la tanda componiendo los tintes.

## Problemas principales

- **[P1] «Reactivar las N» en lote para lo que espera al cliente.** Cada cliente pide la suya; el lote lo afirmaba de N a la vez y las regresaba a
  «vencidas» (también en la maquila recibida). Arreglo: sin lote para ese motivo; para los del taller se queda, fuera del `<summary>`.
- **[P1] El subtítulo decía lo contrario de lo que hay.** Arreglo: qué es cada cosa y qué hacer cuando el cliente pida su factura.
- **[P2] La más vieja primero** (lo que vuelve solo con fecha, antes, como antes).
- **[P2] En la ficha de la que espera al cliente: su agente, su WhatsApp y el importe** (con los permisos de siempre: Producción no ve dinero; el
  vendedor, sólo lo suyo).
- **[P2] AA** en las píldoras, los avisos, «Motivo:», los chips y «Le toca a…» (también en las fichas pausadas de las otras vistas: la franja es una).
- **[P3]** «— karla» → «· la pausó Karla»; «82d» → «82 días».

## Preguntas

- «Ya pidió factura» regresa la orden a Salidas y Karla la folia en «Folios»: ¿convendría que desde aquí abriera de una vez «Asignar folio y entregar»?
- P-0070 lleva 82 días lista: ¿espera de verdad al cliente o ya se entregó sin marcar?
