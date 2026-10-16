---
target: «Dashboard» (Pipeline, WeeklyReport y MaquilaTracker, src/App.jsx)
total_score: 20
p0_count: 0
p1_count: 2
timestamp: 2026-10-16T11-42-47Z
slug: src-app-jsx-dashboard
---
# /impeccable critique — «Dashboard» (la vista con la que abren casi todos)

`view==="pipeline"` en `src/App.jsx`: el encabezado, `WeeklyReport` (Dirección, Lupita y los vendedores), `Pipeline` (el flujo por etapas, con las fichas
compactas) y `MaquilaTracker`. Noche del 16-oct-2026 (el encargo de Marcelo de pasar critique por las apps). Evaluación A (diseño, con el código y las
capturas del recorrido en producción de las 04:46 como secretaria y produccion, a 1366×768) escrita antes de la B (el detector de la skill en el
navegador, inyectado en el banco con el reloj fijo). Sin subagentes: una después de la otra.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | «1 orden sin avance en más de 24h» no decía cuál; sin lectura buena, «Sin órdenes» en cada columna y «0 activas» |
| 2 | El mundo real | 2 | «Facturado» no era lo facturado (es lo ENTREGADO en 7 días a precio de venta: el «Ingreso» de Analytics); «Resumen semanal» eran los últimos 7 días; «Con retraso» era de hoy |
| 3 | Control y libertad | 3 | sólo ver; las fichas abren su detalle |
| 4 | Consistencia | 2 | «Facturado» contra el «Ingreso» de Analytics; «Sin órdenes» en las internas y «—» en maquila |
| 5 | Prevención de errores | 3 | n/a |
| 6 | Reconocer, no recordar | 1 | a 1366 la primera pantalla eran cinco columnas VACÍAS estiradas a todo lo alto; las activas, a la derecha, fuera de la vista |
| 7 | Flexibilidad y eficiencia | 2 | siempre había que desplazarse de lado; el aviso de las quietas, sin teclado |
| 8 | Estética y minimalismo | 1 | hero-metric en el resumen; columnas vacías a todo lo alto; arcoíris de bordes |
| 9 | Recuperarse de errores | 2 | sin lectura, columnas «Sin órdenes» (el aviso de App sí dice) |
| 10 | Ayuda | 2 | sólo Producción tiene una pista |
| **Total** | | **20/40** | **Aceptable (en el borde)** |

## ¿Parece hecho por IA?

**Evaluación de diseño:** en dos partes. «RESUMEN SEMANAL» eran cuatro tarjetas iguales de número grande con etiqueta chica en mayúsculas (la plantilla
hero-metric), y las 12 columnas llevaban cada una un borde de su color. El flujo y las fichas son de la app.

**El detector (navegador):** antes, 49 a 51 hallazgos por estado (Lupita, Gerardo, Dirección): contraste bajo en casi todo lo de color —el nombre de cada
etapa en su color sobre el gris (de 2.0 a 4.1:1), «Sin órdenes» (3.0), las cifras verdes y rojas del resumen (3.0 y 4.3), el aviso ámbar (2.4), el naranja de
maquila (2.6-2.8)—, letra de 10-11 px (la convención de la app: falso positivo a medias), Geist «muy usada» (falso positivo: es la letra de la marca) y un
«gradient-text» que no existe (falso positivo, como en «Datos Pendientes»). Después del arreglo: 5 por estado (sólo esos falsos positivos y la letra chica).

## Impresión general

La vista con la que abren casi todos no enseñaba el trabajo: a 1366, cinco columnas vacías ocupaban toda la pantalla. Y el resumen decía «Facturado» a lo
que no se facturó. La oportunidad más grande: que la primera pantalla sea dónde está el trabajo hoy.

## Lo que funciona

- El flujo completo en su orden, con el ícono y la palabra de cada etapa; las fichas de siempre abren la orden.
- El aviso de las que no avanzan, arriba y con pocos colores.

## Problemas

- **[P1] La primera pantalla eran columnas vacías.** A 1366 caben cinco de las 12 y en producción esas cinco estaban en 0, estiradas a la altura de la más
  larga (741 px). **Arreglo:** la etapa vacía, un riel de 36 px en su lugar del flujo (ícono, 0 y su nombre de lado); las que tienen órdenes ocupan el ancho
  (de 180 a 280 px) y no se estiran. A 1366 se ven 4 de las 6 con órdenes sin desplazarse (antes, ninguna); a 1920, todas. *Comando: /impeccable layout.*
- **[P1] Sin una lectura buena decía «Sin órdenes» en las 12 columnas y «0 órdenes · 0 activas»** (la regla 12). **Arreglo:** «Sin cifras mientras no se
  lea de la base» (Pipeline recibe `leido`; el resumen no sale). *Comando: /impeccable harden.*
- **[P2] El aviso de las que no avanzan no decía cuáles** ni llevaba a ellas, y no tenía teclado. **Arreglo:** un botón que abre la lista (orden, cliente,
  etapa, cuánto lleva); cada una abre su detalle.
- **[P2] «Resumen semanal»:** hero-metric, «Facturado» que no es facturado, «Con retraso» de hoy, cifras sin AA. **Arreglo:** un renglón de cifras chicas
  con su nombre de verdad («Últimos 7 días», «Ingreso (lo entregado)», «Con retraso hoy»), en tinta. *Comando: /impeccable distill.*
- **[P2] El nombre del cliente en la ficha compacta no abría nada** (se tragaba el clic; también en la normal para quien no es el vendedor dueño): lo más
  grande de la ficha, con cursor de mano, era una zona muerta. **Arreglo:** sólo se detiene cuando abre el historial del cliente.
- **[P2] Contraste** (ver el detector). **Arreglo:** el color de la etapa va en su ícono, la letra en la del texto; la ficha compacta sin la etiqueta de su
  etapa (la columna ya lo dice, como en «En espera»); la fecha vencida de la ficha en su tinta; el seguimiento de maquila en tinta; el «Entendido» de las
  pistas sobre el fondo. *Comando: /impeccable polish.*
- **[P3]** «Entregadas» al final es el total de siempre (se dejó, en su tinta); «24h» sin espacio.

## Personas

- **Lupita** (abre aquí cada mañana): veía cinco columnas en 0 y «Facturado $316,744» (que no está facturado); tenía que desplazarse para ver una sola orden.
- **Gerardo** (Producción): la pista le dice que su trabajo está en el Tablero, y la vista no le enseñaba ni dónde estaban sus 37.
- **Marcelo** (Dirección): «Facturado» distinto del «Ingreso» de Analytics para el mismo periodo.

## Preguntas

- ¿La primera pantalla debería decir primero lo atorado (las vencidas y las quietas) y luego el flujo?
- ¿«Entregadas» (el total de siempre) le sirve a alguien, o es «entregadas hoy»?
