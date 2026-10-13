---
target: «Mis Pendientes» de PrintFlow (la vista de tareas de cada rol)
total_score: 17
p0_count: 1
p1_count: 3
timestamp: 2026-10-13T12-33-38Z
slug: src-app-jsx-mis-pendientes
---
# Critique: «Mis Pendientes» de PrintFlow (la vista de tareas de cada rol)

**13-oct-2026, en la noche de `/impeccable critique`.** Evaluación A: un revisor independiente (sin critiques anteriores ni CHANGELOG),
con la app compilada y la cuenta de pruebas, el rol puesto sólo en el navegador y las escrituras cortadas: 7 entradas (karla, secretaria,
preprensa, german, produccion dos veces, vendedor), 1366 y 1920, y un banco sin base para lo que la cuenta no enseñaba. Evaluación B: el
detector de impeccable sobre el código (`detect.mjs`) y dentro de la página en producción (Lupita, Karla y Noemí, a 1366 y 1920). Informe
completo: `.banco-revisor-orden/revisor-pendientes/informe.md`. No se escribió nada en la base (comprobado después: P-0632 y P-0633 siguen
en «Validar»; la bitácora, sin renglones de las últimas 3 horas).

## Calificación por heurística (Nielsen)

| # | Heurística | Nota | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | El aviso tras actuar nombra la orden; pero el menú cuenta lo en espera («Pendientes (25)» con 10 activas) y con la base caída la lista dice «¡Sin pendientes!». |
| 2 | Lenguaje del usuario | 2 | El idioma del taller, pero con guías que ya no son ciertas: series D-/R- (hoy F-/RS-), «borra el viejo», el diálogo de placas que se retiró en v10.81.0. |
| 3 | Control y libertad | 2 | Esc y el foco bien; pero desde la ficha «Validar», «Cliente Aprobó», «Pide Cambios», «Directo a CTP» o «Empaque» actúan de un clic, sin «Deshacer». |
| 4 | Consistencia | 1 | «Cliente Aprobó» pregunta en el detalle y no en la ficha; Karla tiene dos colas para las mismas órdenes; «En espera» significa dos cosas; botones a todo color aquí y teñidos en el detalle. |
| 5 | Prevención de errores | 1 | **En vivo, un doble clic en «Validar Producción» de P-0633 validó también P-0632** (que se saltó CTP). La ficha no usaba `escudoDeClics`. |
| 6 | Reconocer, no recordar | 2 | Chips con su cuenta y alertas al frente; pero Germán y Gerardo tienen que recordar qué arrastrar en OTRA pantalla. |
| 7 | Flexibilidad y eficiencia | 2 | Tab, Enter y Esc funcionan; pero de 7 a 10 paradas por ficha, y mandar a CTP no se puede con teclado. |
| 8 | Estética y minimalismo | 1 | A 1366 se ven 1 o 2 fichas; la guía se repite en cada ficha (25 veces con Karla); una pared de botones a todo color. |
| 9 | Recuperarse de errores | 2 | `doAdv` explica con palabras y regresa la ficha; «Validar» y «Cliente Aprobó» enseñan el texto crudo de la base. |
| 10 | Ayuda y documentación | 2 | Hay ayuda en contexto, pero parte es falsa, y una vez descartada no se recupera. |
| | **Total** | **17/40** | **Pobre: la lista no dice a cada quien qué le toca ni lo deja hacerlo sin miedo.** |

## ¿Parece hecha por IA?

**Revisor:** no es plantilla de IA (sin gradientes ni hero-metric; habla el idioma del taller), pero sí una pantalla armada a parches:
emojis revueltos con Phosphor (que el lector de pantalla lee en el nombre de la etapa), un color saturado distinto por botón, colores a
mano fuera de los tokens (`#a855f7`, `#f59e0b`, `#25d366`), y la misma guía repetida en cada ficha.

**Detector:** sobre el código, nada dentro de la vista (6 hallazgos de toda la app: Arial en las hojas impresas, a propósito; Geist como
«sobreusada», falso positivo: es la letra de la casa; dos `transition: width`, del menú y del almacenamiento). En la página, dentro de la
vista: con Karla 69 (51 de bajo contraste, 15 de relleno apretado, 3 de letra chica), con Lupita 9 y con Noemí 7: coincide con el 24-45 %
de textos bajo AA que midió el revisor. Sin capas visibles (corrió sin pantalla).

## Impresión general

El sistema visual está bien elegido y la pantalla no lo respeta: enseña todo lo que está en las etapas del rol, no lo que esa persona tiene
que hacer hoy, pinta cada acción a todo color y repite instrucciones viejas. Y tenía dos fallas que rompen la confianza: un doble clic
movía otra orden, y con la base caída decía «¡Sin pendientes!».

## Lo que funciona

1. El teclado básico: cada ficha se enfoca, Enter abre el detalle, Esc regresa y el foco vuelve a la misma ficha (medido en 5 roles).
2. Las alertas de la orden (`alertasDeLaOrden`) con color, ícono y palabra en su tinta, las mismas que en el detalle.
3. El error de mover una etapa pide perdón con palabras y regresa la ficha a su lugar. Y la vista «En espera» es el modelo a copiar.

## Problemas prioritarios

**[P0] Un doble clic actúa sobre OTRA orden.** La ficha que avanza sale de la lista (o cambia de botones) y el segundo clic cae en lo que
queda bajo el cursor: en vivo, «Validar Producción» de P-0633 validó también P-0632; en el banco, «Empaque» y luego «Regresar» de la misma.
Arreglo: el escudo en cada botón de etapa (como el detalle); y que la ficha que avanza se quede plegada con «Deshacer». Comando:
`/impeccable harden`.

**[P1] Con la base caída, la lista dice «¡Sin pendientes!»** (con palomita verde, «Pendientes (0)» y los chips en 0): rompe la regla 12.
Arreglo: sin lectura buena, «Leyendo tus pendientes…» o «No se pudieron leer», sin cifras. Comando: `/impeccable harden`.

**[P1] «Mis Pendientes» no dice qué te toca.** Noemí ve 3 que ella ya validó; Lupita, 3 de 4 que esperan a otros; Germán, fichas que sólo
ofrecen «Regresar»; Gerardo, 19 de 22 que dicen «Arrastra… en el Tablero»; Karla, dos colas para lo mismo; lo en espera ocupa más que lo
que hay que hacer. Arreglo: «Te toca» y «Espera a otro» (plegado), lo en espera en una línea, el número del menú = «Te toca»; Karla, una
sola cola; Germán, un botón para mandar a CTP. Comandos: `/impeccable shape`, luego `/impeccable distill`.

**[P1] Los botones principales y los estados reprueban AA, en una pared de colores; «Regresar» va primero.** «Asignar Folio y Entregar»
3.05:1, «Enviar a Maquila» 2.85, «Recibimos el Trabajo» 2.54; del 24 al 45 % de los textos bajo AA según el rol. Arreglo: el criterio
del detalle en la ficha (una acción rellena en su tinta, las demás teñidas), «Regresar» a «⋯ Más». Comandos: `/impeccable quieter`,
`/impeccable audit`.

**[P2] La ayuda dice cosas que ya no son ciertas o contradicen la ficha** (series D-/R-, «borra el viejo», el diálogo de placas, «la
lista izquierda», «Arrastra… en el Tablero» encima del botón que hace eso). Arreglo: corregir los textos; la guía sólo cuando no hay
botón, una vez por etapa. Comando: `/impeccable clarify`.

## Banderas rojas por persona

- **Lupita:** 3 de sus 4 pendientes esperan a otros y cada uno lo dice tres veces; «Recibimos el Trabajo» a 2.54:1; su seguimiento de
  maquila al fondo del Dashboard.
- **Karla:** «Pendientes (25)» con 10 activas; la caja roja de estancadas llena la primera pantalla; series retiradas en cada ficha; su
  cola de verdad es «Folios».
- **Noemí:** sus 3 pendientes ya los validó ella; «Drafts» en inglés; el doble clic movía la orden de al lado.
- **Germán:** sus fichas sólo ofrecen «Regresar»; mandar a CTP es sólo arrastrar (sin teclado ni tableta); la pista le promete un diálogo
  que ya no existe.
- **Gerardo:** 22 pendientes que repiten el Tablero; en vivo, su doble clic validó dos órdenes; el 36 % de los textos bajo AA.
- **Genaro:** recibe los chips de Lupita (la rama de vendedor nunca corre) y lo que pregunta un vendedor no está ahí.

## Observaciones menores

Los chips sin `aria-pressed` y a 30 px; «Poner en espera» sin `role="dialog"`; la ficha `role="button"` con botones adentro; «¡Sin
pendientes!» con signos de exclamación; el aviso de error en Pendientes dice «El tablero se vuelve a leer»; `MaquilaTracker` cuenta días
corridos; con 32 tareas la página mide 11,203 px.

## Preguntas para pensar

1. Si «Pendientes» fuera sólo lo que te toca, con UNA acción por ficha, ¿cuántas de las 22 fichas de Gerardo quedarían?
2. ¿Para qué tiene Karla dos colas, si «Folios» ya es mejor?
3. ¿Una guía repetida en 25 fichas sigue siendo ayuda?
4. ¿Qué haría falta para que Germán mande a CTP sin soltar el teclado o desde la tableta?
5. Si el detalle pregunta antes de «Cliente Aprobó», ¿qué hace seguro no preguntar en la ficha?
