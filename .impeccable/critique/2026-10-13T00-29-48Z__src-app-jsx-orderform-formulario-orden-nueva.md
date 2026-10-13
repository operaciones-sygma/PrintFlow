---
target: OrderForm (la forma de captura de órdenes, src/App.jsx), tercera revisión independiente, v10.84.80
total_score: 29
p0_count: 0
p1_count: 1
timestamp: 2026-10-13T00-29-48Z
slug: src-app-jsx-orderform-formulario-orden-nueva
---
# Critique: la forma de la orden (OrderForm, v10.84.80), tercera revisión independiente

**29/40 (Bueno) · 0 P0 · 1 P1 por confirmar · 4 P2.** Evaluación A: un revisor independiente (agente aparte, sin ver critiques
anteriores; ~496 mil tokens; 2 entradas a producción con la cuenta de pruebas y las escrituras cortadas, el resto en el banco). Evaluación B:
el detector de impeccable inyectado en producción en 12 estados, y el análisis estático de `src/App.jsx`.

## Calificación por heurística (Nielsen)

| # | Heurística | Nota | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | «Guardando», «Revisando la factura», «Subiendo imagen» y «P-0651 creada · Ver · Imprimir · Capturar otra», bien. Una vez en producción ese renglón quedó fuera de la pantalla (P1 por confirmar). |
| 2 | Lenguaje del usuario | 3 | Habla el idioma del taller. Pero «Sencillo» enseña 14 controles y «Avanzado» los quita; «Email o WhatsApp *» y «WhatsApp o email *» juntos; «Offset 8d» sólo en el tooltip de «Sugerir fecha». |
| 3 | Control y libertad | 3 | Salir con algo capturado pregunta; Replicar y quitar imagen tienen «Deshacer». Esc en esas preguntas deja el foco en `<body>`. |
| 4 | Consistencia | 2 | Cuatro controles distintos para elegir una opción, más los chips; «Ya existe (reutilizar)» elegido en verde y «Nueva CTP» en slate; ámbar en «Normal» y en «(recomendado)»; dos o tres botones rellenos a la vez; «Tipo de Producto» en el resumen y «Tipo» en el campo. |
| 5 | Prevención de errores | 3 | Excelente en lo facturado y en «¿ya existe?». Se escapan: lo escondido de un modo que se guarda, el precio de Replicar con otra cantidad, el cliente de la OC. |
| 6 | Reconocer, no recordar | 3 | El buscador muestra los alias («corona» → CERVECERIA MODELO) y al elegir llena RFC, contacto y vendedor; el vendedor sugerido no dice que es sugerencia. |
| 7 | Flexibilidad y eficiencia | 3 | Ctrl+Enter, la N, listas con teclado, y la forma se queda para la siguiente. Pero el foco no empieza en el cliente, 51 paradas de Tab (la fecha se come 4) y después de una maquila vuelve a «Interna». |
| 8 | Estética y minimalismo | 3 | Tranquila. Pero «Sencillo» abre los 14 opcionales, y con faltantes la lista de 21 tipos se abre sola encima del resumen. |
| 9 | Recuperarse de errores | 3 | Al guardar es ejemplar (en producción, con la escritura cortada, todo se quedó). Pero la imagen que no sube da un aviso crudo en inglés que se borra solo, «no tienes permiso… vuelve a intentar» no ayuda, y a los 8 s dice «No se pudo leer» cuando sólo tardó. |
| 10 | Ayuda y documentación | 3 | La ayuda llega a tiempo; faltan los modos y la regla de la fecha. |
| | **Total** | **29/40** | **Bueno** |

## ¿Parece hecha por IA?

**Revisor:** no. Parece herramienta interna pulida muchas veces, dentro de «El Taller Ordenado» (sin gradientes, vidrio, franjas ni
cifra-héroe). Lo que delata es la acumulación de parches: cinco maneras de elegir una opción (segmentado, píldoras con circulito, dos
botones anchos, botones con ✓ y chips), seis estilos de aviso con emojis, «Sencillo / Avanzado» al revés y «Normal» en ámbar.

**Detector** (12 estados en producción: nueva, faltantes, maquila, menú plegado, 1920, Avanzado, «Más» abierto, 683, cliente nuevo,
rechazo, editar a 1366 y a 1920; y el análisis estático):
- Ningún patrón de IA dentro de la forma.
- Sólo la letra de 11 px (81 marcas): la escala del sistema, no algo de esta forma.
- Ya no salen la etiqueta de 45 letras en mayúsculas ni el botón de 3 px de relleno de la segunda revisión.
- Falsos positivos: «fuente sobreusada» (Geist es la del sistema) y tres transiciones de ancho o alto fuera de la forma.
- Lo que no ve y el revisor sí: los modos, Replicar con el precio, el cliente de la OC, el foco invisible en «Subir» (es conducta o estilo en
  línea).

**Capas visuales:** el detector corrió sin pantalla (headless); no hay pestaña marcada a la vista.

## Impresión general

Lo que cuesta dinero o identidad ya está bien hecho: la orden facturada, guardar sin perder, el cliente que no se mezcla y el contraste
(0 fallas en 90 textos en producción). Lo que queda es el flujo diario de Lupita en la laptop: lo más usado está lejos, el modo de captura
esconde pero guarda, y Replicar copia un precio que no cuadra con la cantidad. Y un posible P1 que hay que confirmar.

## Lo que funciona

1. **La orden facturada.** Candados con su porqué y la pregunta con cifras («$2,473.00 → $2,000.00 · F-122 con IVA $2,868.68 →
   $2,320.00»), con su versión timbrada, cobrada, sin poder leer y lenta.
2. **Guardar sin perder nada.** En producción, con la escritura cortada, el aviso salió en el pie con el foco y se quedaron cliente, cantidad
   y precio; el doble clic con la base lenta guardó una vez.
3. **La identidad del cliente y el contraste.** El buscador con alias, «¿ya existe?» con su motivo, «Cambiaste de cliente: se quitaron…»;
   AA medido texto por texto (en el banco, 2 fallas en ~800: la ayuda del catálogo de Cuadra a 4.45:1 y el placeholder del RFC con candado
   a 4.19:1).

## Problemas prioritarios

**[P1 por confirmar] «P-… creada» fuera de la pantalla.**
- Qué: en producción, a 1366, después de Ctrl+Enter desde la descripción, la forma quedó vacía con el renglón en y=−91 (scrollY 199) y el
  foco puesto en él. 0 de 8 en el banco.
- Por qué importa: si no se ve que se creó, se recaptura y quedan dos órdenes.
- Arreglo: subir al principio de la forma sin animación ANTES de enfocar el renglón (y no depender de que `focus()` lo traiga).
- Comando: `/impeccable harden`.

**[P2] Lo más usado está detrás de 14 controles opcionales.**
- Qué: la imagen va en el 94 % de las órdenes, las notas en el 56 % y la placa en el 52 %; a 1366 con el menú abierto están a 934, 1,016 y
  858 px (la página mide 1,872). Con el menú plegado, 300 px; a 1920, a la vista.
- Arreglo: «Para producción» justo después de vendedor y precio, y las especificaciones de «Sencillo» plegadas con su resumen.
- Comandos: `/impeccable layout`, `/impeccable distill`.

**[P2] «Sencillo / Avanzado» al revés, y lo escondido se guarda.**
- Qué: en producción, papel y tintas capturados en Sencillo y luego Avanzado: la orden salió con `paper_type` y `ink_front` que ya no se
  veían, junto al texto libre.
- Arreglo: nombres que digan qué hay («Por campos» / «Texto libre») o un solo modo; al cambiar, decir qué más se guarda, con «Quitar».
- Comandos: `/impeccable clarify`, `/impeccable harden`.

**[P2] Replicar copia el precio total de otra cantidad.**
- Qué: P-0572 (1,000 pzas, $19,600) replicada sobre 777 dejó 777 pzas a $19,600; el aviso («sus notas no se copia») tapa el precio y se
  va solo.
- Arreglo: con otra cantidad, no copiar el precio (o una nota fija bajo Precio).
- Comando: `/impeccable harden`.

**[P2] En «Agregar producto a OC-0900» se puede cambiar el cliente de la OC.**
- Qué: en el banco se guardó COSQUIM con `purchase_order_id: OC-0900`, que es de GOBIERNO DEL ESTADO, sin aviso (en producción no había
  OC activas).
- Arreglo: el cliente de una OC con candado y su porqué, como la facturada.
- Comando: `/impeccable harden`.

## Banderas rojas por persona

- **Lupita:** al abrir, el foco se queda en «Nueva» del menú; la imagen a 934 px; una serie de maquilas regresa a «Interna» cada vez; con un
  agente sin contacto (Eva) sale una tarjeta ámbar con un botón relleno café; si falta el Tipo, la lista se abre sobre el resumen.
- **Vendedor:** con candado, bajo el precio sigue «Captura el precio sin IVA…»; en una orden nueva el vendedor se llena con el del cliente
  sin decir que es sugerido (la comisión se va a otro sin que nada lo señale).
- **Sam (teclado y lector):** «Subir 1ra/2da» y «Subir archivo» no enseñan el foco (el estilo `inp` trae `outline:none` en línea y le gana a
  la regla de foco: confirmado en el código; es de v10.84.80); el calendario de la fecha tampoco; Esc en las preguntas deja el foco en
  `<body>`; las secciones no son encabezados; «-500» en el precio no lleva `aria-invalid`.
- **Riley:** los P2; con un nombre IDÉNTICO que no se eligió de la lista, la orden se liga al cliente existente con el RFC tecleado y sin
  preguntar; el rechazo del pie se queda aunque ya se corrigió.
- **A 683×384:** el pie mide 55 px (88 con faltantes), bien; «Esta factura ya está cobrada» abre desplazada al fondo y esconde el título y
  las cifras.

## Observaciones menores

- Tres botones rellenos a la vez; «Ctrl+Enter crea la orden» bajo «Agregar a OC-0900»; los nombres del resumen no coinciden con los de los
  campos.
- El aviso «Cambiar el vendedor aquí no mueve la comisión…» sale siempre al editar una facturada, aunque no se toque el vendedor.
- Un em dash en «Sin coincidencias en lista — se guardará como…»; la caja de «% Ganancia» en #fff; la × roja de quitar imagen.

## Preguntas para pensar

1. ¿Y si la forma no tuviera modos?
2. Si la imagen va en el 94 % de las órdenes, ¿por qué es lo último a 1366?
3. ¿Replicar debería copiar dinero?
4. ¿Qué haría falta para capturar la quinta orden seguida sin tocar el mouse?

## Lo que no se revisó en la app real

El revisor paró en su segunda entrada (la pausa por el candado de CobranzaFlow): la facturada real, «Specs» real, el vendedor con lo suyo y
repetir el P1 los vio sólo en el banco; «Agregar producto» real no (no había OC activas). Un guion suyo para repetir el P1 en producción lo
negó el clasificador de permisos. Tampoco: lector de pantalla real, subir una imagen real, la fecha con el navegador en español.
