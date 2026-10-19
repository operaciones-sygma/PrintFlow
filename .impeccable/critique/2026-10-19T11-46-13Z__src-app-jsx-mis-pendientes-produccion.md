---
target: «Mis Pendientes» de Producción (la ficha y el reloj de la máquina)
total_score: 27
p0_count: 0
p1_count: 0
timestamp: 2026-10-19T11-46-13Z
slug: src-app-jsx-mis-pendientes-produccion
---
# /impeccable critique — «MIS PENDIENTES» DE PRODUCCIÓN (Gerardo, el lunes en la mañana)

La vista `tasks` de PrintFlow como Producción: sus fichas (`OCard`) y lo que las rodea; con eso, el reloj de la máquina en el detalle (`DetailModal`)
y en la columna «Activa» del CTP (`PreprensaBoard`). 19-oct-2026, mañana (Marcelo dormido, con autonomía hasta las 12:00). La crítica anterior de
«Mis Pendientes» fue la del 13-oct (17/40: «Te toca / Espera a otro»), y la de la ficha, la de esta misma madrugada (v10.84.157, 23/40).

Escena: Gerardo llega el lunes a las 7, prende la computadora de la planta (1366) y abre lo suyo. Medido contra la app publicada como Producción (la
cuenta de pruebas `visor`, escrituras cortadas, el rol cambiado sólo en el navegador) a 1366 y 1920, y en la base: Producción hizo **708 movimientos
en 30 días** (lo más de la app), en 174 órdenes. Evaluación A antes de la B. Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 3 | la etapa, urgente, retraso, la máquina; pero el reloj del lunes dice que todo lleva 60 horas |
| 2 | El mundo real | 2 | «66h 50m», «113h 23m», «160h 45m»: horas corridas que cuentan noches y fin de semana |
| 3 | Control y libertad | 3 | «Empaque» y «Enviar a Salidas» directos, lo raro en «⋯» |
| 4 | Consistencia | 2 | el mismo dato, dos formas: el tablero dice «desde el vie 10:49» (v10.84.58); la ficha, «66h 50m»; el detalle, «308h 38m» |
| 5 | Prevención de errores | 3 | escudo contra el doble clic, «Deshacer» del tablero |
| 6 | Reconocer, no recordar | 3 | «Ver flujo» sólo con ícono; «+2» sin decir de qué |
| 7 | Flexibilidad y eficiencia | 3 | filtros con su cuenta, «Ir al Tablero» al final |
| 8 | Estética y minimalismo | 2 | a 1366, 2 fichas enteras (de 227 a 263 px); «✓ Precio» en las 18 (todas lo tenían) |
| 9 | Recuperarse de errores | 3 | sin lectura, sin cifras (regla 12) |
| 10 | Ayuda | 3 | la guía de primera vez |
| **Total** | | **27/40** | **Bien hecha; el reloj y una marca que no distingue** |

## Lo que dice el detector (dentro de la página publicada, metido con evaluate)

3: dos textos de 11 px (el renglón de cuántas y la guía) y la letra de la casa (Geist, 94%). Las fichas, limpias: las pasadas anteriores ya les quitaron
lo que el detector ve.

## Lo que funciona

1. **Una acción llena por ficha** («Empaque», «Enviar a Salidas»): lo siguiente se ve sin leer.
2. **«18 te tocan · 16 en el Tablero»**: lo que es suyo y lo que se mueve en otra pantalla, separado.
3. **La pausa, la urgencia y el retraso** con su palabra y su tinta.

## Prioridades

- **[P2] El reloj de la máquina en horas corridas, distinto del tablero.** La ficha decía «66h 50m» de lo que entró el viernes a las 10:49, y el
  tablero, de la misma orden, «desde el vie 10:49» (v10.84.58 lo cambió allá porque «43h 5m» en Empaque se leía igual que unos minutos). El detalle,
  «308h 38m» de lo que entró el 6-oct; la columna «Activa» del CTP, igual. **Arreglo:** `LiveTimer` con `desde` en `OCard`, `DetailModal` y
  `PreprensaBoard`: antes de hoy, «desde el vie 10:49»; lo de hoy, en minutos.
- **[P3] «✓ Precio» en las 18 fichas.** Producción no ve el monto, ve si hay precio; todas lo tenían, así que la palomita no distinguía nada, y la que no
  lo tiene era un reloj de arena sin palabra. **Arreglo:** sólo cuando falta, con su palabra: «Sin precio».
- **[P3] Densidad.** A 1366 caben 2 fichas enteras; la barra «Progreso 8/13» repite la etapa. Se queda: la barra es de todas las vistas y de todos los
  roles (pide decisión).

## Personas

- **Gerardo**: el lunes, todas sus máquinas dicen 60 horas; lo que de verdad lleva días no se distingue.
- **Germán**: su CTP decía «65h 0m» de lo que cargó el viernes, y su tablero, al lado, «desde el vie».

## Preguntas

- ¿Que una orden lleve desde el viernes en la máquina es una alarma el lunes? Hoy «Así va la planta» lo pinta en ámbar (todo lo de antes de hoy).
- ¿La barra de avance le sirve a Producción, o basta la etapa?
