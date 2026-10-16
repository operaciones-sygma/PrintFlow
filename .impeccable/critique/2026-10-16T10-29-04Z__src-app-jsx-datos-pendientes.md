---
target: «Datos Pendientes» y «Salud Operativa» (OperationalHealthView, src/App.jsx)
total_score: 20
p0_count: 0
p1_count: 2
timestamp: 2026-10-16T10-29-04Z
slug: src-app-jsx-datos-pendientes
---
# /impeccable critique — «Datos Pendientes» (Lupita y Karla) / «Salud Operativa» (Dirección)

`OperationalHealthView` en `src/App.jsx`. Noche del 16-oct-2026 (el encargo de Marcelo de pasar critique por las apps). Evaluación A (diseño, con el
código y las capturas del recorrido en producción de las 03:52 como secretaria y karla) escrita antes de la B (el detector de la skill: la línea de
comandos y el navegador, inyectado en el banco con el reloj fijo). Sin subagentes: una después de la otra.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | sin lectura buena decía en verde «Sin órdenes estancadas», «Datos completos…», «Todas las máquinas operativas»; «Última actualización: ahora» siempre |
| 2 | El mundo real | 2 | «Warning», «Top Prioridad», «día(s)», «órd», «stage avanzado», «por secretaria» (el usuario), «h máx sin actividad» |
| 3 | Control y libertad | 3 | nada destructivo para Lupita/Karla; lo de Dirección pregunta |
| 4 | Consistencia | 2 | el título promete datos y la página es la de Dirección; «Sin precio» dos veces con reglas distintas; el pulso contradice a Estancadas; Karla sin «Tú» |
| 5 | Prevención de errores | 3 | poco que equivocar (pero ver P1-b: sin lectura, Dirección veía todas las OC como huérfanas, con «Cancelar») |
| 6 | Reconocer, no recordar | 2 | el cliente cortado a media palabra sin «…»; la «prioridad» no dice por qué cuando no hay razón |
| 7 | Flexibilidad y eficiencia | 1 | el teclado no llegaba a ninguna orden de las listas; «+ N más» sin salida |
| 8 | Estética y minimalismo | 1 | seis secciones con rojo, naranja y amarillo; la alarma salía aunque nada estuviera mal; «0 vencidas · 0 urgentes» con punto verde |
| 9 | Recuperarse de errores | 2 | la vista no ayudaba cuando la base no contesta (el aviso de App sí) |
| 10 | Ayuda | 2 | no decía qué hacer con cada sección |
| **Total** | | **20/40** | **Aceptable (en el borde)** |

## ¿Parece hecho por IA?

**Evaluación de diseño:** en parte. El «Pulso por responsable» es la plantilla hero-metric (tarjetas iguales con número de 24 px, tres renglones con
puntos de color y borde de color); la caja roja de 2 px con etiqueta en mayúsculas es de plantilla de tablero. Lo demás son listas densas de la app.

**El detector:** la línea de comandos no ve nada en estos renglones (los estilos van en línea, en JSX). En el navegador, antes del arreglo: 22 (Lupita),
22 (Karla), 25 (Dirección) y 42 (la lista larga abierta): contraste bajo (#ff3b30 sobre el gris de la página 3.2:1, blanco sobre #007aff 4.0, #ff9500
2.0, blanco sobre #ff9500 2.2, blanco sobre #ff3b30 3.5, #34c759 sobre blanco 2.2, #fbbf24 1.7, blanco sobre #fbbf24 1.7, el gris #73737b sobre
la página 4.2), letra de 11 px (la convención de la app: falso positivo a medias), Geist «muy usada» (falso positivo: es la letra de la marca), **Arial en
el 29 % del texto** (los botones sin `fontFamily` no heredan la letra: real, no lo había visto) y «gradient-text» (falso positivo: no hay ningún
degradado en la página; se buscó elemento por elemento y en las hojas de estilo). Después del arreglo: 13-14 por estado, sólo los 11 px, Geist y el
falso «gradient-text»; ningún contraste bajo; Arial 0 %.

## Impresión general

La vista de Lupita y Karla era la de Dirección con otro título. Lo que ellas pueden completar (el precio que falta) estaba bien hecho, pero abajo de
una alarma roja de algo que no pueden mover. La oportunidad más grande: que «Datos Pendientes» sea de verdad la lista de lo que falta capturar.

## Lo que funciona

- «Órdenes sin precio capturado» con su acción al lado y quién y cuándo: justo lo que Lupita y Karla necesitan.
- Estancadas usa la regla de la app (`getStale`), y la etapa sale con su ícono y su palabra.
- Lo de Dirección (notificar, cancelar una OC huérfana, marcar avisos) pregunta antes.

## Problemas

- **[P1-a] Lupita y Karla veían primero lo que no pueden mover.** El título promete «Datos Pendientes» y lo primero era «TOP PRIORIDAD DEL DÍA» en rojo
  (P-0611, en la máquina de Gerardo); «Datos incompletos» quedaba después del pulso y de las estancadas. Y la alarma salía aunque nada estuviera
  vencido, urgente ni estancado: era sólo la orden más cara, con su etiqueta en ámbar; una sana de $500,000 le ganaba a una estancada de $75,000.
  **Arreglo:** para Lupita y Karla, lo suyo primero y luego «Cómo va la planta»; la prioridad sólo entre las que tienen razón, y sin alarma para quien
  no la mueve. Dirección conserva su orden. *Comando: /impeccable layout.*
- **[P1-b] Sin una lectura buena decía que todo estaba bien** (la regla 12 de la app): «Sin órdenes estancadas», «Datos completos…», «Todas las
  máquinas operativas», «El taller está libre». Y a Dirección le ofrecía cancelar como huérfanas todas las OC (sin órdenes leídas, todas lo parecen).
  **Arreglo:** App le pasa `leido`; sin él, «Sin cifras mientras no se lea de la base» y nada más. *Comando: /impeccable harden.*
- **[P2] El teclado no llegaba a ninguna orden** (Estancadas, el pulso desplegado y Datos incompletos eran `div`/`span` con onClick) y «+ N más» no se
  abría. **Arreglo:** botones; «Ver las N»; las listas plegadas son botones con `aria-expanded`. *Comando: /impeccable harden.*
- **[P2] Contraste** (ver el detector) y los botones en Arial. **Arreglo:** las tintas de la app (`dnInk`, `wnInk`, `wnTx`, `okInk`), los botones con la
  letra de la app, el «Editar» neutro (el color va en el punto de la sección). *Comando: /impeccable polish.*
- **[P2] «Sin precio» dos veces** (su sección no cuenta las que están en espera y la de Datos incompletos sí). **Arreglo:** una vez, en su sección.
- **[P2] El pulso**: hero-metric; «0 vencidas · 0 urgentes» con punto verde; «158h máx sin actividad» de Karla contradecía «Estancadas (1)» (cuenta lo que
  espera su fecha, que la app no llama estancado); Karla no veía «Tú». **Arreglado:** «Sin vencidas ni urgentes», «Sin movimiento: hasta 6 días» (en días
  desde 48 h, como Estancadas), el «Tú» de Karla, la llave por persona. **Queda para Marcelo:** la plantilla y qué mide. *Comando: /impeccable distill.*
- **[P3] Palabras:** «Warning», «Top Prioridad», «día(s)», «órd», «stage avanzado», «por secretaria», «Tip: este dashboard…», «VENCIDA hace 6 día(s)» (los
  días contados desde el fin del día de entrega: con entrega el 7 y hoy 14, decía 6); el cliente cortado («JOSE DE JESUS RODRIGUE»). **Arreglado.**
  *Comando: /impeccable clarify.*

## Personas

- **Lupita** (captura): abría su vista y lo primero era una orden que no puede mover; bajaba para la que sí es suya; su tarjeta decía «87h máx sin
  actividad» sin decir cuál.
- **Karla** (folios): el mismo título que Lupita, su tarjeta sin «Tú», «158h» en gris sin decir cuál; «Editar Precio» en blanco sobre naranja (2.2:1).
- **Marcelo** (Dirección, usuario experto): sin teclado; «+ 290 más» sin salida; sin lectura, «Cancelar» en todas sus OC como huérfanas.

## Menores

- El ícono del menú (corazón de «Salud») no es el del título (lápiz). «Última actualización: ahora.» siempre (quitado). Dinero por máquina también para
  Lupita y Karla (queda: decisión de Marcelo).

## Preguntas

- ¿Qué necesita Lupita a las 9: la salud de la planta o lo que le falta capturar?
- ¿«Datos Pendientes» debería contar en el menú lo que falta, como «Pendientes (3)»?
- ¿Y si «Datos incompletos» dijera qué le falta a cada orden en vez de agrupar por dato?
