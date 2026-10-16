---
target: la Torre de Control (ControlTowerView, src/App.jsx)
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-10-16T16-09-44Z
slug: src-app-jsx-torre
---
# /impeccable critique — la «Torre de Control» (con la que abre Dirección)

`ControlTowerView` en `src/App.jsx` (y `diagnoseOrder`, que decide qué está detenido). 16-oct-2026 por la mañana. Evaluación A (diseño, con el código y la
captura del recorrido en producción como Dirección, 1366×768) escrita antes de la B (el detector de la skill en el navegador). Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | «19 órdenes detenidas · $140,881.50 atorados» contaba 14 que sólo están sin fecha de entrega; sin lectura buena, «✅ Nada detenido» |
| 2 | El mundo real | 2 | «detenida» para un dato por capturar; «Viernes, 16 De Octubre»; rayas largas («CRÓNICAS — …», «Lupita — 14 bloqueos») |
| 3 | Control y libertad | 3 | recordar, resolver, poner en espera y reactivar, a la mano |
| 4 | Consistencia | 2 | lo que diagnoseOrder llama «no bloqueante de flujo» salía como crónica en rojo; colores sueltos (#b45309, #f59e0b) |
| 5 | Prevención de errores | 3 | poner en espera pide razón |
| 6 | Reconocer, no recordar | 3 | cada renglón dice qué pasa y a quién le toca |
| 7 | Flexibilidad y eficiencia | 2 | el folio y las sanas no se alcanzan con el teclado; los botones de sólo ícono sin nombre |
| 8 | Estética y minimalismo | 2 | rojo por todos lados: la caja de crónicas, los renglones, el semáforo |
| 9 | Recuperarse de errores | 2 | la regla 12 |
| 10 | Ayuda | 2 | sin ayuda, aunque los textos de cada renglón explican |
| **Total** | | **23/40** | **Aceptable** |

## Impresión general

Una buena idea (lo detenido por persona, con su acción) que grita más de la cuenta: de 19 «detenidas», 14 eran fechas por capturar, y hasta salían
como crónicas. Lo que de verdad está parado se perdía entre ellas.

## ¿Parece hecho por IA?

No: es una lista de trabajo de la app. Lo que falla es el tono (todo en rojo) y lo que cuenta. **El detector (navegador, en un banco con 6 paradas, 7
datos por capturar, 3 sanas y 1 en espera):** antes, 20 hallazgos (14 de ellos el rojo #e03b30 como letra, 3.9:1) y 10 con sólo datos por capturar; la
tanda midió además el gris claro (4.2), los verdes sobre su tinte (4.2-4.4) y los textos dentro de las crónicas (4.0-4.4, dos capas de tinte rojo sobre
el gris). Después: 6 y 2 (la letra de 10-11 px de la app, una escala que el detector llama plana, el renglón de arriba largo, Geist y el falso
«gradient-text»).

## Lo que funciona

- Lo detenido, por persona y con su acción (recordar, resolver, poner en espera) a la mano; «Recordarle los N» de un jalón.
- Cada renglón dice qué pasa y a quién le toca, con los días.

## Problemas

- **[P1] «Detenidas» contaba los datos por capturar** (sin fecha de entrega, sin precio; para diagnoseOrder, «no bloqueantes de flujo»): en producción 14
  de las 19, con su dinero «atorado» ($140,881.50), en el semáforo (Lupita 14) y en las crónicas en rojo. **Arreglo:** lo detenido, las crónicas, el
  semáforo y lo atorado son trabajo parado; los datos van aparte («N con datos por capturar», plegados, por persona, con sus mismas acciones y sin alarma).
- **[P1] Sin lectura buena: «✅ Nada detenido — todo el flujo avanza normal.»** (la regla 12). **Arreglo:** «Sin cifras mientras no se lea de la base.»
- **[P2] El texto en rojo y ámbar sin AA y el rojo en todo** (las crónicas, los renglones, el semáforo). **Arreglo:** las tintas de la app; fondo sólido
  y el color en el borde.
- **[P2] El teclado:** el folio era un texto con clic (sólo el ojo llegaba), las sanas eran renglones con clic, los botones de sólo ícono sin nombre.
  **Arreglo:** botones, con su nombre para el lector de pantalla.
- **[P3] Palabras:** «13 ordenes detenidas» (sin acento: «orden»+«es»), «Miércoles, 14 De Octubre», las rayas largas («CRÓNICAS — …», «Lupita — 14»).

## Personas

- **Marcelo** (abre aquí cada mañana): «19 detenidas, $140k atorados» para lo que eran sobre todo fechas por capturar; lo de verdad parado (reimprimir,
  sin folio, vencidas) se perdía entre ellas.
- **Lupita** (a quien se le «recuerda»): le llegaban recordatorios de «bloqueos» que eran datos por capturar.

## Preguntas

- ¿Una orden sin fecha de entrega debería recordársele a quien vendió desde el primer día, o sólo cuando ya corre en la planta?
