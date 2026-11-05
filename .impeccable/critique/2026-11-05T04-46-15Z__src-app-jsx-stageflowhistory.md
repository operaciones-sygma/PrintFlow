---
target: panel «Tiempo por etapa» del detalle de la orden (v10.84.178)
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\Marcelo\\Projects\\PrintFlow\\src\\App.jsx#StageFlowHistory"
timestamp: 2026-11-05T04-46-15Z
slug: src-app-jsx-stageflowhistory
---
Method: A: agente independiente (340 mil tokens, 25 capturas de producción y el código) · B: detector, corrido después de A (por presupuesto, un solo agente).

Versión evaluada: v10.84.178. Medido después en 868 órdenes de 180 días (sólo lectura).

| # | Heurística | Nota | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | En activas va bien; en terminadas no hay panel ni aviso |
| 2 | Coincidencia con el mundo real | 2 | «38h de trabajo» no es trabajo: es tiempo dentro del horario, con fila incluida |
| 3 | Control y libertad | 3 | Abre, cierra, recuerda; no hay forma de ver sólo lo que se pasó |
| 4 | Consistencia | 2 | El rojo dice «más de lo normal» arriba y «el doble» en la leyenda; el ámbar también pinta «falta validar» |
| 5 | Prevención de errores | 2 | Invita a conclusiones falsas: negritas al mayor, alarma con el reloj parado |
| 6 | Reconocimiento | 2 | «Lo normal» nunca se enseña |
| 7 | Flexibilidad | 1 | Recuerda abierto o cerrado, y nada más |
| 8 | Minimalismo | 2 | «<1m» pesa igual que «31h»; cadenas de 5 datos a 10 px |
| 9 | Recuperarse de errores | 1 | Lo terminado sin bitácora no tiene mensaje ni salida |
| 10 | Ayuda | 3 | El aviso del horario está donde hace falta; no dice cuánto es lo normal |
| | **Total** | **20/40** | **Aceptable, en el piso de la banda** |

## Especificidad
Contenido de SYGMA, forma de bitácora de cualquier ERP: se lee como crónica, no como instrumento. Lo más propio de la planta, lo normal de cada etapa medido con sus órdenes, está escondido en el código. Detector: 227 hallazgos en App.jsx, 0 dentro del panel (renglones 3381-3494).

## Lo que funciona
- Validar partido por persona: dos renglones, dos cifras.
- Lo repetido explicado con estructura: pasos, «2.ª vez», la razón.
- Calma y honestidad: lo sano casi monocromo, lo de fuera no se le carga a nadie.

## Problemas prioritarios
- [P0] Lo terminado se queda sin panel y nadie lo dice: desde «Todas» o la búsqueda, una orden entregada o cancelada abre sin bitácora, notas ni merma hasta apretar «Cargar Archivo Completo» (1,092 de 1,127 órdenes). Arreglo: leer lo de esa orden al abrir, con «Leyendo…», «No se pudo leer · Reintentar» y «Sin movimientos». /impeccable harden
- [P1] El resumen dice lo más grande, no quién la detuvo: en 71% de las órdenes las negritas caen en una etapa que no se pasó; de 12 activas con marca, en 9 la marca está en una etapa anterior y cerrado no dice nada. Arreglo: veredicto en el botón y la cifra de lo normal junto a cada marca. /impeccable shape
- [P1] En pausa, alarma con el reloj parado y dos relojes con el mismo nombre: P-0431 «en espera · 58h» y «En espera (302h)», «lleva 58h» en rojo. Hoy 3 de 9 pausadas activas, 2 en rojo. Arreglo: «58h hasta la pausa», sin alarma en el encabezado, el motivo primero y en tinta. /impeccable clarify
- [P1] Números que dicen más de lo que la bitácora sabe: «En fila 4h 32m · CTP <1m · Procesadora <1m» (88% de los CTP se marcan de golpe: 272 de 308); «Máquina» junta fila y corrida; «de trabajo» se lee como esfuerzo; 10h + 20h bajo 31h (23 de 673 etapas con pasos). Arreglo: juntar lo marcado de golpe, «Fila» y «Máquina» aparte cuando se sabe, «hábiles», minutos en los renglones de adentro. /impeccable clarify
- [P2] A 1366 lo que importa queda abajo: 3 renglones de aviso antes de los datos; 19% de las etapas (929 de 4,857) duran menos de 5 minutos y ocupan lo mismo; «1h 41m» es más ancho que «31h». Arreglo: un solo renglón de aviso, las etapas de paso en una línea, los minutos en gris. /impeccable distill

## Banderas por persona
- Alex (Marcelo recorriendo órdenes; que sean decenas no está medido): sin siguiente ni anterior, los rubros cambian de lugar, una orden tiene panel y la siguiente no.
- Sam: aria-label en un span sin rol no es válido; ámbar y rojo sólo por color; información sólo en title; no se probó con un lector real.
- Germán (piso): sale como quien dejó dormir la orden y luego hizo la placa en un minuto, por cómo marca sus pasos.

## Observaciones menores
«Sáb 31-oct» con un panel que dice que el fin de semana no cuenta (medido: sábados, 74 movimientos en 7 de 25 fechas, 11 al día contra ~80 entre semana; casi todos de Producción); «302h» no se siente como tiempo; cada etapa arma sus propias columnas; 12 px no está en la escala de DESIGN.md; dos «lleva» casi juntos con cifras distintas; el anillo de foco toca el texto.

## Preguntas para considerar
1. ¿La pregunta es de una orden o de decenas? Una tabla persona × etapa contestaría de un vistazo, y el panel sería el detalle al que se llega.
2. ¿De quién es el tiempo, o qué esperaba la orden? Repartir por trabajo de alguien, fila, cliente, proveedor y pausa cambiaría a quién se señala.
3. ¿Para quién es esta vara, y quién vigila la pausa? Todo el piso ve nombres en rojo, y poner «En espera» detiene el propio reloj.
