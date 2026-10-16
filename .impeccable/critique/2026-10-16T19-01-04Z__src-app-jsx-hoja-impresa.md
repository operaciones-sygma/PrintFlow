---
target: "la hoja impresa de la orden (PrintOrder: la ventana para elegir la copia y la hoja que se imprime, src/App.jsx)"
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-10-16T19-01-04Z
slug: src-app-jsx-hoja-impresa
---
# /impeccable critique — la HOJA IMPRESA de la orden

`PrintOrder` en `src/App.jsx`: la ventana para elegir la copia (administrativa o de producción) y la hoja que arma en otra ventana para imprimir, con su
versión, su ajuste a una hoja Carta (`pfFit`) y su registro. 16-oct-2026, mediodía. Evaluación A (diseño, con el código y la hoja medida como se imprime:
el CSS de impresión, el ajuste y el PDF Carta de Chrome) escrita antes de la B (el detector de la skill). Sin subagentes. Es la hoja que la planta tiene en
la mano, muchas veces fotocopiada en blanco y negro.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 3 | la versión, «REIMPRESO», «SIN REGISTRO» y la marca de agua de cancelada se ven; la ventana dice la última impresión |
| 2 | El mundo real | 3 | sigue la forma de papel que la planta conoce (secciones, casillas, firmas) |
| 3 | Control y libertad | 2 | se imprime desde la ventana nueva con su botón; la ventana de elegir no tiene teclado |
| 4 | Consistencia | 2 | la ventana de elegir no es un diálogo como los demás (sin role, el foco no entra, el Tab se va a la app de atrás); colores sueltos en la hoja |
| 5 | Prevención de errores | 3 | la copia de producción esconde el dinero y los datos del cliente; la cancelada lo dice en grande |
| 6 | Reconocer, no recordar | 2 | lo elegido en «Procesos y acabados» se marca con una palomita de 9 px: el nombre se ve igual que los 14 que no |
| 7 | Flexibilidad y eficiencia | 2 | sin teclado no se imprime; la orden larga se encoge sola hasta no leerse |
| 8 | Estética y minimalismo | 2 | una sección entera para dos Pantones; «Cotización» siempre vacío; «Tipo de Orden» dos veces; una casilla vacía en la maquila |
| 9 | Recuperarse de errores | 3 | sin versión sale «SIN REGISTRO» y la app lo avisa; la ventana bloqueada se dice |
| 10 | Ayuda | 3 | «Se registra al imprimir»; los letreros explican la copia y la cancelación |
| **Total** | | **25/40** | **Aceptable** |

## Impresión general

El contenido es el correcto y la parte difícil (versiones, registro, la copia sin dinero, la cancelada) está bien resuelta. Lo que falla es lo físico:
la letra. Las etiquetas miden 7 px (5 pt) y, en una orden larga, el ajuste a una hoja encoge TODO hasta 5.3 px (4 pt). En el taller, impresa o
fotocopiada, la mitad de la hoja no se lee, y lo que se eligió no se distingue de lo que no. La oportunidad: que la hoja se lea a 60 cm en una fotocopia.

## ¿Parece hecho por IA?

No: es una forma de papel de imprenta, con su oficio (secciones, casillas, firmas, folio en rojo). Le falta cuidado de impresión, no le sobra adorno.
**El detector (en la ventana de la hoja, con el CSS de impresión):** antes, 17 hallazgos en P-0650 y 22 en P-0652: las firmas en `#999` (2.8:1, cuatro),
letra de 8 y 9 px, un espaciado ancho en el letrero de la copia, y lo propio de una forma impresa (mayúsculas en etiquetas, Arial, celdas de 7 px). En la
ventana para elegir la copia, letra de 10 px. Después: sin contraste bajo ni letra de 8-9 px; quedan los que en papel no aplican (la letra de 10-11 px que el
detector mide como pantalla: 7.5-8 pt, lo normal en una forma; las etiquetas en mayúsculas, que son la forma; Arial, la letra para imprimir) y el
«gradient-text» del banco. La tanda midió lo que el detector no ve: la letra con el zoom del ajuste (5.3 px en la orden larga) y lo elegido igual que lo no.

## Lo que funciona

1. **Dos copias con propósito**: la de producción sin precio, RFC, correo ni teléfono del cliente (medido: no se cuela nada), la administrativa con todo.
2. **La versión por contenido** (v10.58.59): la hoja dice v3 y «REIMPRESO» o «SIN REGISTRO», y sólo se registra al imprimir de verdad.
3. **La cancelada no se puede confundir**: marca de agua y leyenda con el motivo (v10.81.3).

## Problemas principales

- **[P1] La letra no se lee impresa.** Medido en P-0650: 37 textos de menos de 7 pt (etiquetas de 7 px, títulos de sección de 8, firmas de 7, el pie de
  8). En P-0652 (dos fotos, 9 acabados, 6 renglones de notas, 4 lugares) el ajuste a una hoja pone zoom 0.761: la letra más chica queda de 5.3 px.
  Arreglo: nada de menos de 10 px; antes de encoger la letra, que cedan las fotos; compactar lo que ocupa de más. Comando: `/impeccable typeset`.
- **[P1] En fotocopia se pierde.** La fecha del pedido en `#888` (3.5:1), las firmas en `#999` (2.8:1), el folio web en `#94a3b8`, el folio de remisión
  en verde `#34c759` (2.3:1). Arreglo: grises de `#444` para arriba y tintas oscuras. Comando: `/impeccable colorize` (en este caso, quitar color).
- **[P2] Lo elegido no se distingue.** «Barniz Mate» (elegido) y «Barniz Brillante» (no) tienen la misma letra, el mismo peso y el mismo color: sólo
  cambia una palomita de 9 px dentro de su cuadro. Arreglo: el nombre elegido en negritas y negro, lo demás en gris (también Normal/Urgente/Baja).
- **[P2] La fecha de entrega, chica.** Es lo que más se pregunta en el piso y mide 12 px (9 pt), como cualquier dato. Arreglo: 15 px.
- **[P2] La ventana para elegir la copia no es un diálogo.** Sin `role="dialog"`, el foco no entra (con Enter no pasa nada) y el Tab se va a la app de
  atrás. Arreglo: diálogo con su nombre, el foco en el primer botón, `atraparTab`, el foco regresa al cerrar. Comando: `/impeccable audit`.

## Banderas por persona

- **Gerardo y los operadores (la hoja en la máquina, a veces fotocopiada):** las etiquetas de 5 pt no se leen; los acabados elegidos se buscan entre
  15 casillas; la entrega no destaca.
- **Lupita (la que imprime):** sin mouse no imprime; el foco se queda atrás.
- **Marcelo:** una orden larga sale en una hoja, sí, pero a 4 pt, sin aviso.

## Observaciones menores

- «Cotización» siempre vacío en la copia administrativa; «Tipo de Orden» dos veces en la de producción («Información Adicional» lo repite).
- Pantones: una sección con barra y renglón de encabezado para dos datos; la maquila externa con una casilla vacía (el correo, escondido) en la de producción.
- Los emojis de los títulos (🚚, 🎨) salen a color en una impresora a color y como manchas en una fotocopia.
- La ventana para elegir: «Elige la versión a imprimir» en `C.t3` de 10 px; la maquila en naranja `C.maq` (2.6:1).

## Preguntas

- ¿Las casillas de acabados que NO se eligieron deben salir? Una lista de lo elegido sería más corta y clara, pero la forma de casillas es la que la planta
  conoce (y deja ver de un vistazo que algo NO lleva barniz).
- Una orden muy larga: ¿una hoja aunque se encoja, o dos hojas legibles? (v10.71.5 eligió una hoja; con el arreglo la de prueba cabe a 7 pt.)
- ¿La copia de producción necesita el «Agente de compras» del cliente, o sólo el nombre?
