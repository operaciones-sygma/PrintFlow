---
target: OrderForm (la forma de captura de órdenes, src/App.jsx), segunda revisión independiente, v10.84.79
total_score: 28
p0_count: 0
p1_count: 1
timestamp: 2026-10-12T21-31-16Z
slug: src-app-jsx-orderform-formulario-orden-nueva
---
# Critique: la forma de la orden (OrderForm, v10.84.79), segunda revisión independiente

**28/40 (Bueno, en su borde de abajo) · 0 P0 · 1 P1 · 4 P2.** Evaluación A: un revisor independiente (agente aparte, sin ver critiques
anteriores; ~431 mil tokens; 4 entradas a producción con la cuenta de pruebas y las escrituras cortadas, el resto en el banco). Evaluación B:
el detector de impeccable inyectado en producción en 12 estados, y el análisis estático de `src/App.jsx`.

## Calificación por heurística (Nielsen)

| # | Heurística | Nota | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | «5 campos por completar», «Guardando…», «Revisando la factura…» y el rechazo en el pie, con el foco. Pero al crear te deja en el Dashboard a media página y el número dura 6.5 s; elegir un cliente en «¿ya existe?» crea sin enseñar a quién quedó ligada. |
| 2 | Lenguaje del usuario | 3 | «Sencillo / Avanzado» está al revés: Avanzado quita 8 campos. «Email o WhatsApp *» y «WhatsApp o email *» son una sola regla dicha dos veces. |
| 3 | Control y libertad | 3 | Salir con algo capturado pregunta, y hay «Deshacer». Pero elegir en «¿Quisiste decir…?» crea la orden sin vuelta, y «Cancelar» mientras guarda no cancela (se crea 3 s después). |
| 4 | Consistencia | 2 | Cinco formas de botón-opción en una pantalla; el cliente es combobox y el Tipo no; Title Case junto a sentence case; en la OC el botón que crea dice «Guardar». |
| 5 | Prevención de errores | 2 | Números, duplicados, candados de facturada y doble clic, bien. Se escapa lo más caro: la orden puede quedar con datos de dos clientes (P1), y Replicar trae notas de otra orden. |
| 6 | Reconocer, no recordar | 3 | El buscador trae RFC, WhatsApp y crédito; Replicar enseña miniatura, folio y precio; «el último fue P-0626». |
| 7 | Flexibilidad y eficiencia | 3 | Ctrl+Enter, la tecla N y el autollenado. No hay «Capturar otra»; 52 paradas de Tab; imágenes y archivo sólo con ratón. |
| 8 | Estética y minimalismo | 3 | Calma, y 0 de 88 textos bajo AA en la forma vacía. Pero sección y etiqueta se ven casi iguales, los placeholders van a 1.65:1, el «Tip» es permanente y hay dos botones rellenos. |
| 9 | Recuperarse de errores | 3 | «No se creó la orden: … Lo que capturaste sigue aquí» con foco y sin perder nada. Pero un faltante es un borde de 1 px a ~1.7:1, y «Ya existe: elígelo» no dice que el RFC de la forma es del cliente anterior. |
| 10 | Ayuda y documentación | 3 | La ayuda está donde se necesita («sin IVA», qué es «nuestro vendedor»). Falta el porqué del contacto obligatorio en un cliente que ya existe, y «% Ganancia» sólo se explica con el ratón. |
| | **Total** | **28/40** | **Bueno (borde de abajo)** |

## ¿Parece hecha por IA?

**Revisor:** no. Aplica «El Taller Ordenado» con disciplina: Geist, neutros fríos, un solo acento, nada de gradientes, vidrio, cifra-héroe
ni signos de exclamación. Lo que la acerca a lo genérico: un ícono delante de casi cada etiqueta, títulos y etiquetas en el mismo gris de
10 px en mayúsculas, y cinco estilos de botón-opción. Lo raro es deriva, no IA: «% Ganancia» en `#fff` puro, la prioridad «Normal» en ámbar
(el color de aviso) y el botón relleno de «Replicar» compitiendo con «Crear Orden».

**Detector** (12 estados en producción: nueva, faltantes, maquila, menú plegado, 1920, Avanzado, «Más» abierto, 683, cliente nuevo,
rechazo, editar a 1366 y a 1920; más el análisis estático de App.jsx):
- Ningún patrón de IA dentro de la forma (franjas laterales, texto con gradiente, vidrio, cifra-héroe).
- Letra de 11 px en todos los estados (83 marcas) y una etiqueta de 45 letras en mayúsculas («Notas de proceso / Aclaraciones (uso
  interno)»): coincide con el revisor en que sección y etiqueta pesan casi igual. Los 11 px son la escala del sistema (DESIGN.md), no algo
  de esta forma.
- Un botón con 3 px de relleno vertical al editar a 1920.
- Falsos positivos: «fuente sobreusada» (Geist es la del sistema, y el registro de producto la permite) y tres transiciones de ancho o
  alto que están fuera de la forma (el menú lateral y otras dos pantallas).
- Lo que el detector no ve y el revisor sí: los placeholders a 1.65:1, la pregunta de la factura cobrada (1.96:1, sin foco ni Esc), subir
  archivos sin teclado y la mezcla de clientes (es conducta, no estilo).

**Capas visuales:** el detector corrió en un navegador sin pantalla (Playwright headless); no hay pestaña marcada a la vista.

## Impresión general

Lo que más dolía en la primera revisión ya no duele: guardar no pierde nada, la orden facturada se trata como dinero y todo se lee. El
riesgo se movió al dato más caro de la forma, el cliente: se puede mezclar sin que nadie lo note. La oportunidad grande es el flujo de
Lupita: capturar varias seguidas sin que la forma la saque, y con el vendedor y el precio a la vista en su laptop.

## Lo que funciona

1. **Guardar no pierde nada.** El rechazo sale en el pie con `role="alert"`, foco y lo capturado intacto, al crear y al editar; doble clic
   pide un solo número (medido); salir pregunta con «Seguir capturando» enfocado.
2. **La orden facturada se trata como dinero.** El título dice cuál es («Editar P-0577 · RS-34»); razón social y RFC con candado y su
   porqué, también si la facturan con la forma abierta; la pregunta trae cifras («$2,473.00 → $1,978.00 · F-122 $2,868.68 (no cambia)»)
   con «Volver a la forma» enfocado.
3. **Contraste y números.** 0 textos bajo AA en vacía, faltantes, cliente nuevo, maquila y «Specs»; un número mal escrito se queda como se
   tecleó, con su porqué.

## Problemas prioritarios

**[P1] El cliente de una orden se puede mezclar.**
- Qué: (1) Elegir un cliente y luego escribir otro nombre deja el RFC, el WhatsApp y el vendedor del primero (en producción: de GODI a
  «Taller Ficticio…» se quedaron `CPG030311GT2`, `4776777770` y «Manuel»), y el aviso de «Cliente nuevo» ya no sale. (2) La base contesta
  «Ya existe: elígelo — mismo RFC» con GODI y nadie dice que ese RFC venía del cliente anterior: sólo se puede cancelar o ligar a GODI.
  (3) Elegir una sugerencia en «¿Quisiste decir…?» crea la orden ahí mismo con datos de dos clientes (en el banco: nombre «Cerveceria
  Modelo Norte», `client_id` de PAPELERIA DEL BAJIO y RFC `CMN010101AB1`), y el primer Tab de esa pregunta cae justo en la sugerencia.
- Por qué importa: es la identidad fiscal de la orden. Dice un nombre y un RFC y queda ligada a otro cliente, o Lupita se atora con un dato
  viejo que no ve.
- Arreglo: al cambiar el nombre, limpiar lo que llenó el cliente anterior y decirlo en una línea; que elegir en la pregunta regrese a la
  forma con ese cliente completo (nombre, RFC y contacto suyos) en vez de crear; con «mismo RFC», decir de quién es y ofrecer «Corregir el
  RFC».
- Comandos: `/impeccable harden`, `/impeccable clarify`.

**[P2] Replicar trae instrucciones de otra orden sin decirlo.**
- Qué: copia las notas de proceso, los Pantones, la distribución y la imagen, pero la ventana promete «producto, papel, medidas, tintas,
  acabados, precio». En producción trajo la nota «YA AUTORIZO PRUEBA DE COLOR» de un trabajo del 30 de septiembre.
- Por qué importa: le dice a producción que una prueba está autorizada cuando nadie la ha visto, la merma clásica de imprenta.
- Arreglo: no copiar notas ni distribución (si sirven, enseñarlas aparte como cita) y que el aviso diga exactamente qué llenó.
- Comando: `/impeccable harden`.

**[P2] Al terminar, la forma te deja en otro lado.**
- Qué: crear, guardar, «Sin cambios» y Cancelar mandan siempre al Dashboard, aunque se haya abierto desde «Todas»; el Dashboard abre a media
  página y sin resaltar la orden; el número dura 6.5 s en un aviso cuyo botón «Ver P-…» mide 3.22:1.
- Arreglo: volver a donde se abrió; en «Nueva», un renglón fijo «P-0627 creada · Ver · Imprimir · Capturar otra»; el botón del aviso a 4.5:1
  o más.
- Comandos: `/impeccable shape`, luego `/impeccable polish`.

**[P2] En la laptop con el menú abierto, lo comercial queda bajo el pie.**
- Qué: a 1366 con el menú abierto la forma es una columna de 760 px en 1,111 disponibles; «Nuestro vendedor» (y=739) y «Precio» (y=835)
  quedan bajo el pie (677). Con el menú plegado ya son dos columnas, pero siguen en 727 y 854. A 683×384 el pie ocupa el 24 % de la
  pantalla, y el 38 % cuando enseña los faltantes.
- Arreglo: subir vendedor y precio junto a Tipo, Cantidad y Entrega; un pie compacto cuando hay poco alto.
- Comandos: `/impeccable layout`, `/impeccable adapt`.

**[P2] Lo que sólo funciona con ratón y buena vista.**
- Qué: los faltantes son un borde de 1 px a ~1.7:1, sin `aria-invalid` ni texto, y el resumen no se anuncia. Subir imágenes y el archivo de
  producción: el campo está oculto (`display:none`) dentro de una etiqueta y Tab se lo salta (confirmado en el código), también en «Specs»,
  la tarea principal de Pre-prensa. «Tipo» no es combobox: Tab entra a la lista y el foco cae a `<body>`. La pregunta de la factura cobrada
  (`PriceDropModal`) abre sin foco, no cierra con Esc (no tiene manejo de teclas; confirmado), sus opciones no dicen cuál está elegida y
  «Sobrarían $574.20» va a 1.96:1. Los placeholders, a 1.65:1.
- Arreglo: indicar el faltante en el campo (aria y texto); un `<button>` real para subir; el combobox de `ClientInput` también en Tipo; el
  contrato de diálogo en `PriceDropModal`; placeholders en `#8c8c95`.
- Comandos: `/impeccable audit`, `/impeccable harden`.

## Banderas rojas por persona

- **Lupita (captura todos los días):** si se equivoca de cliente y escribe el bueno, le quedan los datos del primero y termina mandada con
  Karla; vendedor y precio le piden desplazar en cada orden; el número se le va en 6.5 s y tiene que volver a «Nueva»; Replicar le mete una
  autorización vieja; un cliente que ya existe sin contacto la frena sin decir por qué.
- **Genaro (vendedor):** al crear puede marcar a cualquiera de los 7 vendedores y no se pone él por omisión; al editar, los vendedores van
  apagados con opacidad .55 (2.19:1); «Los datos del cliente los cambia Lupita o Dirección» sale con el correo y el WhatsApp editables.
- **Alex (experto con prisa):** no hay «Capturar otra»; 52 Tabs sin flechas; las imágenes piden ratón; la N con el foco en un botón
  pregunta «¿Salir sin guardar?» estando ya en «Nueva Orden».
- **Sam (teclado y lector de pantalla):** faltantes sin `aria-invalid`; no puede subir imágenes ni el archivo; «Tipo» suelta el foco; la
  pregunta de la factura cobrada no recibe el foco ni cierra con Esc; el foco cae a `<body>` tras Esc o «Seguir capturando» en «¿Quisiste
  decir…?» y en el diálogo del agente.
- **Riley (prueba los bordes):** la orden sale con datos de dos clientes; una sugerencia débil la liga a otro cliente; «Cancelar» mientras
  guarda no cancela.

## Observaciones menores

- «Sencillo / Avanzado» se entendería mejor como «Por campos / Texto libre».
- Mayúsculas a la inglesa («Crear Orden»), «...» junto a «…» y rayas largas en placeholders.
- «Tip: Ctrl/⌘»: ⌘ no existe en Windows y la línea ocupa espacio siempre.
- «No se pudo revisar el cliente (no tienes permiso)… Intenta de nuevo»: lo que falló fue crearlo, y reintentar un permiso no sirve.
- La prioridad «Normal» por omisión va en ámbar; «Medida en cm» elegida se ve apagada; en la OC no se puede elegir interna o maquila.
- «Nuevo agente de compras»: Esc cierra y se pierde el teléfono escrito.
- El error del precio queda tapado por el pie fijo.
- El título va centrado; en las demás vistas, a la izquierda.

## Preguntas para pensar

1. ¿Y si elegir un cliente en «¿ya existe?» sólo eligiera, y crear siguiera siendo el botón de siempre?
2. Si Lupita captura varias órdenes seguidas, ¿por qué la forma la saca después de cada una?
3. Si una nota de proceso es de una orden, ¿qué hace dentro de Replicar?
4. ¿«Modo de captura» tiene que ser una decisión?

## Lo que no se revisó en la app real

El revisor paró en su cuarta entrada (el choque de Auth con el candado de CobranzaFlow); esto lo vio sólo en el banco: «Agregar producto» a
una OC (producción no tiene OC activas), «Specs» (no encontró el botón en el Dashboard de Pre-prensa), el vendedor editando lo suyo, la
facturada con cifras (`pf_price_drop_check` va cortada en la app real) y guardar con red lenta. Tampoco: lector de pantalla real, tablet,
alto contraste de Windows.
