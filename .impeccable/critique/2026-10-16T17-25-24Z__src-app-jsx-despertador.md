---
target: el Despertador (WakeupModal, getWakeupItems y lo de App que lo arma, src/App.jsx)
total_score: 17
p0_count: 0
p1_count: 2
timestamp: 2026-10-16T17-25-24Z
slug: src-app-jsx-despertador
---
# /impeccable critique — el DESPERTADOR (la ventana del día)

`WakeupModal` y `getWakeupItems` en `src/App.jsx`, con lo de App que lo arma (el efecto con `loaded`/`user`, `ackWakeup` y `log_wakeup_ack`) y su
montaje. 16-oct-2026, mañana. Evaluación A (diseño, con el código y el banco) escrita antes de la B (el detector de la skill en el navegador). Sin
subagentes. La regla de Marcelo (v10.58.51: «ventana GRANDE al entrar; sólo se cierra escribiendo SI ENTIENDO y queda registro») no se califica: es
del dueño y se respeta.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | si la primera lectura falla, ese día no sale y nadie lo dice; el campo no avisa cuando lo escrito ya no va a cerrar |
| 2 | El mundo real | 2 | «Buenos días» a las 5 de la tarde y «antes de empezar el día»; «Jueves, 16 De Octubre»; «TU» en mayúsculas |
| 3 | Control y libertad | 1 | ningún pendiente se puede abrir; Esc no hace nada ni dice nada; «Sí, entiendo» (con coma) deja a la persona atorada |
| 4 | Consistencia | 2 | no es una ventana como las demás (sin role=dialog, el Tab se sale a la app de atrás); colores fuera de las tintas; fondo con desenfoque |
| 5 | Prevención de errores | 2 | la frase exacta sólo perdona signos AL FINAL: «Sí, entiendo» o «¡Sí entiendo!» no cierran |
| 6 | Reconocer, no recordar | 1 | al confirmar, la lista se va por el resto del día: hay que recordar los P- y buscarlos a mano |
| 7 | Flexibilidad y eficiencia | 1 | dice «Ábrela…» y no abre; a Dirección le da una lista plana de todos con «Ve con X:» repetido |
| 8 | Estética y minimalismo | 2 | tres cajas de color por renglón (borde, el porqué con ícono Y emoji, la caja verde de «Qué hacer») |
| 9 | Recuperarse de errores | 1 | la lectura fallida no se recupera ese día; el registro de la confirmación se traga su error (la regla 2) |
| 10 | Ayuda | 3 | la instrucción es clara y cada pendiente dice qué hacer |
| **Total** | | **17/40** | **Pobre** |

## Impresión general

La ventana que todos ven primero cada día es un aviso sin salida: enumera lo que está atorado, dice «Ábrela» y no abre nada, y en cuanto la persona
escribe la frase, la lista desaparece hasta mañana. El mayor acierto (decir QUÉ hacer, no sólo qué está mal) se queda en texto. La oportunidad más grande
es convertir la lectura obligada en el primer paso de trabajo: que lo que se toca se abra al confirmar.

## ¿Parece hecho por IA?

No por el diseño: es una ventana grande, directa, con la voz de Marcelo. Lo que sí delata la prisa son las tres cajas de color por renglón y el ícono
repetido. **El detector (en el navegador, sobre el banco):** antes, 5 hallazgos con Lupita (3 pendientes) y 11 con Dirección (6): el porqué rojo `#e03b30`
(4.3:1, uno por pendiente rojo) y «Qué hacer» en verde `#30a85a` (3.0:1, uno por pendiente). Además los falsos positivos de siempre: «gradient-text»
(del banco) y la letra Geist (la del sistema de diseño). La medición de la tanda vio también lo que el detector no: la fecha y el folio en 10 px y el ámbar
del porqué a 4.1:1 sobre su tinte. Después del arreglo: sólo los falsos positivos.

## Lo que funciona

1. **Cada pendiente dice qué hacer, por etapa** (`STAGE_ACT`): «Asígnala a una máquina en el Tablero», «Llama al cliente para que apruebe la prueba». Es
   lo que hace útil la lista.
2. **Usa el mismo motor que la Torre** (`diagnoseOrder`) y no inunda: salta las fechas y los precios por capturar (`SKIP_KEYS`), no despierta a Gerardo por
   lo montado en máquina, y a Lupita le pasa las vencidas de los vendedores sin usuario (Manuel).
3. **El registro de quién confirmó** (`log_wakeup_ack`) le da a Marcelo constancia, que es el punto de la regla.

## Problemas principales

- **[P1] No se puede actuar desde la lista, y al cerrar se pierde.** Por qué importa: es la lista de lo que cada quien debe destrabar hoy; sin abrir la
  orden, la persona cierra, olvida los números y el Despertador sólo estorbó. Arreglo: cada pendiente es un botón; el que se toca se abre al escribir SI
  ENTIENDO (la regla queda igual). Comando: `/impeccable onboard` (primer paso del día) + `/impeccable harden`.
- **[P1] Si la primera lectura de la base falla, ese día no hay Despertador** (la regla 12: una lectura fallida no es «nada pendiente»). El efecto se
  arma con `loaded` (que también se pone cuando falla) y cero órdenes, y la lectura buena de después ya no lo vuelve a armar. Arreglo: esperar una
  lectura buena (`lectura.ok`). Comando: `/impeccable harden`.
- **[P2] «Sí, entiendo» no cierra y no dice por qué.** `norm` sólo quita signos al final: la coma, el «¡» o escribirlo junto dejan a la persona atorada
  frente a una ventana que no se cierra. Arreglo: sin signos, sin acentos y sin espacios; si lo escrito se desvía, decirlo. Comando: `/impeccable clarify`.
- **[P2] No es una ventana.** Sin `role="dialog"` ni nombre; el Tab se va a la app de atrás (el buscador, «Salir»); el campo no tiene etiqueta (sólo
  «Escribe aquí...»). Arreglo: diálogo con su título, `atraparTab`, la instrucción como `<label>`, Esc que recuerda cómo se cierra. Comando: `/impeccable audit`.
- **[P2] Dirección recibe una lista plana de todos.** «Ve con Gerardo:» repetido en cada renglón, ordenado por días y mezclando personas; lo que Marcelo
  hace con esto es ir a ver a cada quien. Arreglo: agrupado por persona («Con Gerardo · 3»), la persona con lo más viejo primero. Comando: `/impeccable layout`.

## Banderas por persona

- **Lupita (captura, la que más pendientes recibe):** ve «P-0616 · El cliente no aprueba la prueba desde hace 4 días · Qué hacer: Dale seguimiento al
  cliente» y no lo puede abrir; escribe «Sí, entiendo» como escribe siempre y la ventana no se cierra, sin decir por qué.
- **Marcelo (Dirección):** seis o veinte renglones de todos, con «Ve con Gerardo:» tres veces; para saber a quién ir a ver tiene que leer todo.
- **Gerardo (producción, en la planta):** «🔁 Marcada para REIMPRIMIR» de P-0611 sin poder abrirla; después tiene que buscarla en el Tablero.
- **Quien usa el teclado o lector de pantalla:** el foco sale de la ventana al buscador de atrás; el campo no dice qué escribir; la ventana no se anuncia.

## Observaciones menores

- El porqué lleva un ícono de advertencia Y su emoji (dos íconos); la caja verde de «Qué hacer» con `C.ok` como letra (3.0:1); el porqué rojo en `C.dn`
  (3.9:1) y el ámbar en literales `#b45309`/`#f59e0b` fuera de las tintas; la fecha y el folio en 10 px; la fecha de entrega en `C.t3`.
- La fecha de entrega sale en ROJO con `late>0`, que son los días del diagnóstico: una orden «5 días sin avanzar» con entrega la semana que entra se ve
  vencida. Debe ser `isOverdue`.
- `backdropFilter: blur(3px)`: desenfoque decorativo (el fondo ya está a 78 % oscuro).
- «Hay N pendientes esperando TU acción antes de empezar el día:»: grita y no aplica en la tarde.

## Preguntas

- ¿Y si el Despertador se pudiera volver a abrir en el día (sin pedir SI ENTIENDO), desde la barra de arriba, para ver lo que sigue pendiente?
- ¿Las de los vendedores sin usuario (Manuel) le siguen tocando a Lupita en el Despertador, o sólo en la Torre?
- ¿Qué tendría que pasar para que el Despertador diga «nada pendiente hoy» en vez de no salir? (Hoy, sin pendientes, no sale: no hay forma de saber si
  no salió porque todo está bien o porque no leyó.)
