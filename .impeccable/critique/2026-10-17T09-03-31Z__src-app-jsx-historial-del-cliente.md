---
target: el historial del cliente (ClientHistory y su puerta en App, src/App.jsx)
total_score: 22
p0_count: 0
p1_count: 1
timestamp: 2026-10-17T09-03-31Z
slug: src-app-jsx-historial-del-cliente
---
# /impeccable critique — el «HISTORIAL DEL CLIENTE»

`ClientHistory` en `src/App.jsx` (se abre al tocar el nombre del cliente en la ficha) y la puerta de App que decide quién lo abre (`handleAction`
«client_history»). 17-oct-2026, madrugada. Evaluación A antes de la B. Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | «4 ordenes · Total: $X» sin decir que es sin IVA y sin las canceladas |
| 2 | El mundo real | 2 | el id interno «OP-P-0802» en vez del folio; «ordenes» sin acento |
| 3 | Control y libertad | 3 | cierra con Esc, el fondo o «Cerrar» (es de sólo lectura) |
| 4 | Consistencia | 1 | para el vendedor, la ficha cuenta suya la orden que lleva como vendedor; la puerta y el historial sólo lo que él capturó |
| 5 | Prevención de errores | 3 | sólo lectura |
| 6 | Reconocer, no recordar | 3 | folio, producto, etapa e importe por orden |
| 7 | Flexibilidad y eficiencia | 2 | el foco se queda atrás; el Tab se sale |
| 8 | Estética y minimalismo | 3 | sobria |
| 9 | Recuperarse de errores | 1 | Genaro toca a su propio cliente y le sale «No tienes órdenes con este cliente» |
| 10 | Ayuda | 2 | nada dice qué entra al total |
| **Total** | | **22/40** | **Aceptable** |

## ¿Parece hecho por IA?

No. **El detector:** no se corrió aparte (la ventana es chica y la tanda mide su AA componiendo los tintes: la etapa a 3.0:1 y la fecha de 9 px).

## Problemas principales

- **[P1] El vendedor no abre el historial de sus clientes** si las órdenes se las capturó Lupita (caso real: PAOLA NUÑEZ y VETERINARIA DIVETCO de Genaro), y
  en los demás no ve las que ella le capturó (la Feria). Arreglo: una regla, la de la ficha: `esDelVendedor` (lo capturó o es su vendedor) en la puerta
  (`veHistorialDelCliente`) y en el historial.
- **[P2] No es un diálogo:** sin nombre, el foco atrás, el Tab se sale. Arreglo: `role="dialog"` con el nombre del cliente, se lleva el foco y lo regresa.
- **[P2] AA y 9 px:** la etapa en su color de semáforo, la fecha y el id; la cancelada sólo tenue. Arreglo: `tintaAA`, 10-11 px, tachada.
- **[P3]** el folio P- en vez del id interno; «Total sin IVA, sin las canceladas»; «órdenes».
