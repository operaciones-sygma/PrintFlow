---
target: El tablero de Producción (Kanban) y el del CTP de Germán
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-10-19T14-32-10Z
slug: src-app-jsx-kanban-tablero-de-produccion
---
# /impeccable critique — EL TABLERO DE PRODUCCIÓN (Gerardo, de un vistazo)

El `Kanban` de PrintFlow como Producción (Listas, las máquinas por grupo, Empaque, Salidas, Maquila) y el tablero del CTP de Germán
(`PreprensaBoard`). 19-oct-2026, mañana (Marcelo dormido, con autonomía hasta las 12:00). El tablero quedó cerrado el 8-oct por tres revisiones
independientes (20 → 25 → 24/40); desde entonces se le movió «Así va la planta» (v10.84.62), las acciones de Empaque (v10.84.63) y el reloj (v10.84.159).

Escena: Gerardo, de pie junto a la computadora de la planta (1366, a un metro), mira qué corre en cada máquina, qué sigue y qué está listo para
mandar. Medido contra la app publicada como Producción (la cuenta de pruebas `visor`, escrituras cortadas, el rol cambiado sólo en el navegador) a
1366 y 1920, con el detector dentro de la página, y en la base: **445 entradas a máquina en 30 días** (129 a Empaque, 111 al CTP y la procesadora,
el resto en offset y acabados); hoy, 16 en Listas, 12 en máquina, 5 en Empaque y 14 en Salidas. Lo que es cada orden (`product_type`) mide 34 letras
la mitad de las veces y 57 o más una de cada diez. Evaluación A antes de la B. Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 3 | «Así va la planta» con su reloj, las cuentas por columna, «Deshacer» |
| 2 | El mundo real | 3 | máquinas, turnos, «desde el vie 10:49» |
| 3 | Control y libertad | 3 | arrastrar o elegir, «A Listas», «Deshacer» |
| 4 | Consistencia | 2 | la fecha vencida en `dnInk` en Listas y la cola, en `dn` (sin AA) en Salidas y el CTP; tres maneras de pintar el contador de una columna |
| 5 | Prevención de errores | 3 | soltar en Empaque espera con «Deshacer»; Salidas pregunta |
| 6 | Reconocer, no recordar | 3 | cada máquina dice qué corre y qué sigue |
| 7 | Flexibilidad y eficiencia | 3 | «Enviar a máquina…» sin arrastrar |
| 8 | Estética y minimalismo | 2 | lo que se lee de cada orden, a 9 px; en Listas el folio come una columna a todo el alto |
| 9 | Recuperarse de errores | 3 | sin lectura no dice «vacío» (regla 12) |
| 10 | Ayuda | 2 | la guía de arriba; «clic para ver» en verde sin contraste |
| **Total** | | **27/40** | **Ordenado; lo que se lee de lejos no se lee** |

## Lo que dice el detector (dentro de la página publicada, metido con evaluate)

A 1366: **«1 vencida» 4.3:1** (blanco sobre el rojo pleno), **el «16» de Listas 3.1:1** y **«Órdenes Listas» 2.7:1** (verde pleno), el número de Empaque
4.1:1, el de Salidas y «clic para ver» 3.3:1, la fecha de la ficha de cada máquina 4.1:1 (gris `t3` sobre el gris de la ficha), «Reimprimir · v2
obsoleta», «Enviar a proveedor» (el gris de los textos de ejemplo), y **los textos de 9 px** de cada ficha: qué es la orden, el papel y la entrega
en Listas, en cada máquina, en la cola, en Salidas y en el CTP (también marca los de 11 px, que DESIGN.md permite). Y la letra de la casa (Geist) y el
morado de Empaque, que son del sistema.

## Lo que funciona

1. **«Así va la planta»**: qué corre en cada máquina y desde cuándo, en la primera pantalla, sin bajar.
2. **Las fichas con una acción llena** («Empaque», «A Salidas») y lo raro en «⋯».
3. **«Enviar a máquina…»**: no hace falta arrastrar.

## Prioridades

- **[P1] Lo que Gerardo lee de cada orden está a 9 px.** Qué es («Formatos · 5,000»), el papel y la entrega, en las fichas de las máquinas, la cola,
  Salidas y el CTP. A un metro de una pantalla de 1366, 9 px es una raya. DESIGN.md deja micro (9 px) para etiquetas y chips de posición; lo que se
  lee es meta (10). **Arreglo:** 10 px para todo lo que se lee; el folio «#P-…» y el turno «1°», chips, se quedan.
- **[P1] Los contadores y las alarmas sin AA.** El chip de vencidas es lo único rojo pleno de la pantalla y su letra no llega a 4.5; el número de
  Listas (16 hoy) y su título, 3.1 y 2.7; Salidas, 3.3; el «ACTIVA» del CTP de Germán, verde sobre blanco, 2.2. **Arreglo:** el fondo y la letra de
  cada uno en su tinta (`tintaAA`), y la fecha vencida en `dnInk` en todas las fichas.
- **[P2] La ficha de Listas desperdicia su ancho.** El folio «#P-0667» va en su propia columna a todo el alto de la ficha, y lo que es la orden se
  parte en ~117 px de los 183 que tiene: «REPORTE DE / INSPECCION DE / ABORDO / 0404FSVR0014 · 1,000 / pzas», cinco renglones; las fichas miden ~206 px
  y a 1366 se ve una fila. **Arreglo:** el folio en el renglón del cliente; lo que es, a todo lo ancho.
- **[P3] Tres maneras de un contador** (círculo verde, círculo morado, píldora verde). Se queda: cada columna con su color es la costumbre del tablero.

## Personas

- **Gerardo**: busca qué sigue en la Printmaster 52; «Formatos · 5,000» a 9 px gris en una ficha gris. Lo de Listas, en cinco renglones.
- **Germán**: «ACTIVA» del CTP en verde claro sobre blanco; su fecha de entrega en rojo pleno a 9 px.

## Preguntas

- Ninguna de fondo: es leerse. (La de «Así va la planta» y el ámbar del lunes sigue en el reporte de la mañana.)
