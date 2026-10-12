---
target: OrderForm (crear y editar la orden)
total_score: 22
p0_count: 0
p1_count: 3
timestamp: 2026-10-12T16-15-36Z
slug: src-app-jsx-orderform-formulario-orden-nueva
---
# Critique · OrderForm (crear y editar la orden) · PrintFlow v10.84.76

Evaluación A: revisor independiente (1 agente, ~400 mil tokens) sobre la app compilada con la cuenta de pruebas y las escrituras
cortadas, a 1366, 1920 y 683×384, como Lupita, admin, Karla, Pre-prensa y vendedor (informe completo y evidencia en
`.banco-revisor-orden/revisor/`). Evaluación B: el detector de impeccable dentro de la página real, en 8 estados
(`.banco-revisor-orden/b-detector*.json`, capturas en `b-capturas/`). Además, el banco nuevo de la forma
(`tests/banco/gen-orden.mjs`: lo que hace App al guardar, copiado tal cual, con la base simulada) y 9 pruebas
(`tests/romper/orden.mjs`): contra el código de hoy fallan 7.

## Salud del diseño (la calificación es la del revisor independiente)

| # | Heurística | Cal. | Lo principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | «Agente de compras registrado» cuando la base lo rechazó; «Orden actualizada» cuando se tiraron la razón social y el RFC; «Guardando…» mientras espera la pregunta del cliente; «Editar Orden» no dice cuál |
| 2 | Lenguaje del usuario | 3 | Habla de imprenta; se cuelan «No se pudo asignar folio» (es el P-), el error de la base en inglés, «white-label», «pool compartido», «soft-delete», «(Fase 2)» |
| 3 | Control y libertad | 2 | «Cancelar» y el menú lateral tiran la captura sin preguntar; «Replicar» y la × sin deshacer |
| 4 | Consistencia | 2 | Tres buscadores y tres ventanas que se portan distinto; el botón principal cambia de color con el tipo; rompe foco, rojo y tinta de DESIGN.md |
| 5 | Prevención de errores | 2 | Frena el cliente duplicado y el doble clic; pero 1.5 → 15, −5 → 5, 1e3 → 13, −500 → 500, entrega en 2020, Enter borra el «Tipo» libre |
| 6 | Reconocer, no recordar | 3 | Buen buscador y Replicar con miniatura; al editar no se ve el P- (en «sólo specs», nunca) |
| 7 | Flexibilidad | 2 | Ctrl+Enter sí; el cliente no se elige con teclado; 57 Tab hasta «Crear Orden» |
| 8 | Estética y minimalismo | 2 | A 1366 la primera pantalla no tiene producto (Tipo y=724, Cantidad 1644, Precio 1861); rojo y naranja fuera de su significado |
| 9 | Recuperarse de errores | 1 | Si la base no da el P-, la forma se vacía; si falla sólo la bitácora o el aviso, dice «No se pudo crear» y el segundo clic DUPLICA la orden (banco) |
| 10 | Ayuda | 3 | Ayuda en su lugar; falta lo caro: qué pasa al editar una facturada y que la × borra |
| | **Total** | **22/40** | **Aceptable (20-27)** |

## ¿Lo hizo una IA?

**Revisor:** no, en conjunto: herramienta interna que creció por capas, cada parche con su caja o su aviso. Rasgos de plantilla: el
banner que repite el título («Nueva Orden» / «Crea la orden completa con datos, specs y precio»), ayudas con emoji (💡 tres veces, ⚡,
ℹ️, ⚠️ dentro de un `<option>`) junto a íconos Phosphor, el molde «casilla + ícono + título + explicación en caja» repetido
(Distribución, Sin empaque) y las tarjetas de ícono de Interna/Maquila.

**Detector (8 estados de la página real: nueva, faltantes, maquila, cliente nuevo, rechazo de la base, avanzado a 1920, 683×384,
editar):** 17 a 25 hallazgos por estado. En la forma: contraste bajo AA en todas las vistas (#73737b sobre el gris de la forma #eff2f6,
4.2:1, 52 veces: las ayudas y etiquetas grises; «Asignado automáticamente» #30a85a, 2.7:1; «Crear Orden» después de un intento, blanco
sobre #d4dae2, 1.4:1; «Crear Orden» de maquila, blanco sobre #e67e22, 2.8:1; la lista de faltantes en rojo pleno, 3.9:1; «(recomendado)»
en naranja, 2.5:1), texto de 9 px (22) y de 10 px (16), y mayúsculas en 45 caracteres de cuerpo. Coincide con lo que midió el revisor
(2.72, 1.41 y 2.85) y suma lo sistémico que él no contó: casi todo el texto gris de la forma no llega a 4.5:1 sobre su propio fondo.
Falsos positivos: «una sola fuente / fuente sobreusada» (Geist es la del sistema, DESIGN.md), el texto con degradado y la transición de
ancho (son del menú lateral, no de la forma) y, en parte, las mayúsculas (son las etiquetas del sistema; el problema es su tamaño).

**Overlays:** el detector corrió dentro de Chromium sin cabeza (Playwright); no hay pestaña [Human] a la vista. Capturas de cada estado
en `.banco-revisor-orden/b-capturas/`.

## Impresión general

La forma protege bien los momentos caros que ya conocía (el cliente duplicado, el doble clic) y falla donde a Lupita más le duele:
cuando algo sale mal y cuando se edita una orden con dinero. Ahí pierde lo capturado, duplica la orden, borra archivos antes de guardar
o dice «Orden actualizada» después de tirar cambios. La oportunidad más grande: que guardar sea honesto y recuperable (un error dentro
del pie y en palabras, sin perder nada, sin duplicar y sin borrar nada antes de guardar).

## Lo que funciona

1. **«¿Ya existe?» en el momento más caro.** Con «PADILLA HNOS IMPRESORA» (sin punto) dice «Ya existe: elígelo» con su motivo, RFC y
   días de crédito, no ofrece crearlo y Esc regresa sin perder nada; un cliente nuevo enseña razón social, RFC y contacto antes de
   crearlo en CobranzaFlow.
2. **A prueba de dedazos.** Doble clic en «Crear Orden» y Ctrl+Enter dos veces piden UN número y hacen UN insert (también en el banco:
   ord-10 y ord-11 pasan); «Guardando…» con la base lenta; el P- lo da la base y la forma lo dice.
3. **Lo obligatorio se dice bien.** El pie cuenta «N campos por completar», lista los faltantes por nombre y lleva el foco al primero.

## Problemas prioritarios

### [P1] Cuando la base falla al crear, la orden se pierde o se duplica
- **Qué:** si `next_production_number` falla, `create` hace `return` sin lanzar y la forma lo toma como éxito: se vacía todo (cliente,
  tipo, descripción, cantidad, vendedor, precio). Si la orden SÍ se guardó y después falló la bitácora o el aviso a Producción, sale «No
  se pudo crear: addTimeline: upstream…» con la forma llena, y el segundo clic crea OTRA orden con otro número (banco: P-0651 y P-0652).
  Si falla el INSERT, dos avisos rojos seguidos; el segundo, en inglés crudo, tapa el primero. Banco: ord-01 a ord-04 fallan.
- **Por qué:** ~50 órdenes a la semana, con prisa: un tropiezo de red le cuesta a Lupita la orden entera, o le deja dos órdenes del
  mismo trabajo en Validar con dos números.
- **Arreglo:** `create` lanza (con su aviso ya dado) en todo camino que no creó; la forma se limpia sólo con el número en la mano. Lo que
  pasa después de guardar la orden (bitácora, avisos) va aparte: la orden se da por creada con su P- y, si un aviso no salió, se dice a
  quién avisar. Un solo aviso, en palabras («No se creó la orden: sin conexión con la base. Lo que capturaste sigue aquí.»).
- **Comando:** `/impeccable harden`

### [P1] La × de una imagen y «Quitar» del archivo borran del servidor al clic, antes de Guardar
- **Qué:** al editar (P-0618, P-0614) la × manda el DELETE en el clic; «Cancelar» no lo regresa y la orden queda apuntando a un archivo
  borrado. Después de un «Replicar» cuya copia falló, la × de la orden NUEVA borra la imagen de la orden fuente (P-0062). «Quitar» del
  archivo de producción (10 px, sin pregunta) hace lo mismo con el archivo de impresión, que desde v10.84.76 se queda como historial.
  Banco: ord-20 y ord-21 fallan.
- **Por qué:** la × se lee «quitar de esta orden», no «borrar para siempre», y el daño puede caer en otra orden.
- **Arreglo:** la × y «Quitar» sólo quitan la referencia en la forma; el borrado físico, sólo de lo que se subió en esa misma captura,
  nunca de lo guardado ni de lo de otra orden.
- **Comando:** `/impeccable harden`

### [P1] Editar una orden facturada deja tocar lo que no se guarda, y dice «Orden actualizada»
- **Qué:** en P-0543 (F-122), como admin, Razón social y RFC están abiertos; al guardar, `update` los quita en silencio y el aviso dice
  «Orden actualizada (marcada como editada post-factura)». Al vendedor le pasa con el precio y el cliente. Bajar cantidad y precio de
  una facturada no pregunta nada en la forma salvo que ya esté cobrada.
- **Por qué:** rompe «dice lo que de verdad pasa» (PRODUCT.md) justo donde está el dinero: quien edita cree que corrigió la factura y se
  entera en cobranza.
- **Arreglo:** lo que no se guarda no se deja tocar (candado con su porqué, como `financialsLocked`); antes de guardar una facturada, una
  pregunta con las cifras; si algo se descarta, el aviso lo nombra; el título dice cuál («Editar P-0543 · F-122»).
- **Comando:** `/impeccable clarify` y `/impeccable harden`

### [P2] Lo capturado se pierde o cambia sin aviso
- **Qué:** «Cancelar» y el menú lateral tiran la captura sin preguntar. «Replicar» sobrescribe lo escrito (cantidad 250 → 1000 y el
  precio). En «Tipo», la lista promete «se guardará como "Calendario de pared"» y Enter lo borra. Cantidad 1.5 → 15, −5 → 5, 1e3 → 13;
  precio −500 → 500 y con 3 decimales; entrega en 2020 sin aviso. «Registrar» del agente de compras dice «Agente de compras registrado»
  aunque la base lo rechace (banco: ord-30).
- **Por qué:** 15 en vez de 1.5, o 1000 en vez de 250, es una reimpresión o una factura mal hecha.
- **Arreglo:** salir con algo escrito pregunta («Seguir capturando» enfocado); Replicar sólo llena lo vacío o dice qué reemplazó; Enter
  acepta lo escrito en «Tipo»; cantidad y dinero validados (enteros, sin negativos, 2 decimales); entrega pasada con aviso; el agente
  mira el error.
- **Comando:** `/impeccable harden`

### [P2] A teclado y a la vista: sin foco visible, el foco bajo el pie y el gris sin AA
- **Qué:** los 20 campos de texto no cambian al enfocarse; 20 de 58 paradas de Tab quedan bajo el pie fijo; el cliente no se elige con
  flechas ni Enter, y escrito completo con Tab sale «Cliente nuevo» y pide RFC de uno que existe; las fichas de Replicar y «Nuevo agente
  de compras» no reciben foco (y Esc no cierra esa ventana). Detector: el texto gris de la forma a 4.2:1 (52 veces), 38 textos de 9-10 px,
  el botón principal a 1.4:1 después de un intento.
- **Por qué:** quien captura rápido usa Tab y escribe en un campo que no ve; y DESIGN.md ya pide AA en todo el texto (v10.84.64).
- **Arreglo:** anillo de foco; `scroll-padding-bottom` del alto del pie; combobox en `ClientInput` (flechas, Enter, elegir el idéntico al
  salir); las dos ventanas con el contrato de diálogos; tinta AA para el texto gris y nada de 9 px; el botón principal no se lava.
- **Comando:** `/impeccable audit` y `/impeccable harden`

## Banderas por persona

- **Lupita con prisa (su décima orden):** el cliente la obliga al mouse; dos pantallas de scroll por orden a 1366; Replicar le pisa la
  cantidad; Enter le borra el tipo; un tropiezo de red le borra la orden; termina en el Dashboard sin un «Ver P-…».
- **Quien la suple:** «Maquila Completa», «Nueva CTP / Ya existe» y «al validar ambos roles» sin explicar; «Sin empaque» en rojo parece
  error; «Email *» y «WhatsApp *» parecen obligatorios los dos; el RFC del cliente nuevo se pide hasta el final; «folio» confunde.
- **Genaro corrigiendo una suya (por código):** ve precio y cliente abiertos y se tiran en silencio; se entera hasta guardar si la orden
  ya entró a producción.
- **Pre-prensa:** «Gestionar Archivo», «Editar Orden» y «Pre-prensa: edita…» para lo mismo; no ve el P- en ninguna parte; la × borra la
  imagen.
- **Teclado:** sin anillo y con el foco tapado; cliente y Pantone sin teclado; Replicar y el agente sin foco. Lo bueno: Ctrl+Enter.

## Observaciones menores

- «Asignado automáticamente» 2.7:1; «(recomendado)» y «(USO INTERNO)» 2.3:1 a 9 px; prioridad «Normal» 2.8:1; «% Ganancia» 2.6:1; el
  aviso «Cliente nuevo» 1.85:1, y sale con dos letras escritas, con el contacto ya en rojo.
- «Sin empaque de SYGMA» se pinta con el rojo de error y un `role="alert"`.
- El aviso abajo al centro tapa «Crear Orden»; el de «cliente creado en CobranzaFlow» lo pisa el de la orden al instante.
- «Guardando…» mientras la pregunta del cliente espera; «Guardar» sin cambios dice «Orden actualizada»; mientras se edita, el menú marca
  «Nueva».
- Lo escrito en Sencillo se guarda aunque se cambie a Avanzado o a Maquila y ya no se vea.
- «Quitar lugar» es una × roja; «Ancho cm» y «Alto cm» en minúsculas; «1 órdenes históricas»; «(Fase 2)» en pantalla; `alert()` muerto
  en el P- editable.
- A 683×384 no se ve ni un campo al abrir (Razón social en y=368) y el pie ocupa el 23 %; WhatsApp mide 28 px. A 1920, una columna de
  760 px y 2.2 pantallas de scroll.

## Preguntas

1. ¿Cuántas de las ~50 órdenes semanales repiten una anterior? Si son muchas, Replicar podría ser la puerta de entrada.
2. ¿Qué debe poder cambiarse desde aquí en una orden facturada?
3. ¿Lo raro (Distribución, Sin empaque, Placa CTP, imágenes, archivo) en un «Más de esta orden», para que lo esencial quepa en la
   primera pantalla de la laptop?
4. ¿«Tipo» debe aceptar texto libre? (P-0624 trae una descripción en «Tipo».)
5. ¿Un borrador por pestaña, para que ni la red ni un clic al menú tiren la captura?

## Quedó sin probar

Precio bloqueado y Genaro con una suya (por código: la cuenta de pruebas no tiene esas órdenes), «Agregar Producto a OC» (0 OCs activas
hoy), el dato que cambia con la forma abierta, las subidas reales, el panel de Cuadra, la pregunta de bajar el precio y un lector de
pantalla real.
