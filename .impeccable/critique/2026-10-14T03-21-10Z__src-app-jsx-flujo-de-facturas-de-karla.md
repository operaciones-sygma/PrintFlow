---
target: flujo de facturas de Karla (pasada 1)
total_score: 21
p0_count: 0
p1_count: 5
timestamp: 2026-10-14T03-21-10Z
slug: src-app-jsx-flujo-de-facturas-de-karla
---
# Critique: el flujo de facturas de Karla (PrintFlow, pasada 1)

**13-oct-2026, primera de varias pasadas pedidas por Marcelo** («varias pasadas de impeccable antes; dejar la UI robusta; después la
guía»). Evaluación A: un revisor independiente (sin critiques anteriores, CHANGELOG ni pruebas), la app real en producción (v10.84.95) con
la cuenta de pruebas como Karla y las escrituras cortadas, más el banco del plan matriz para lo que la cuenta no deja ver; recorrió las 4
tareas reales de Karla (PORTLAND OC-0960 con F-143 y F-155; Hotsson con 5 facturas sin orden; su cola de Folios; F-90 para P-0544).
Informe completo: `.banco-revisor-orden/revisor-facturas/informe.md`. Evaluación B: el detector de impeccable sobre el código y dentro
de la app real (la cola de Folios, OC-0960, su plan matriz, «Asignar folio y entregar»; 1366 y 1920). Nada se escribió en la base.

## Calificación (Nielsen)

| # | Heurística | Nota | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | «CUADRA con F-143 ✓» es ejemplar; pero «Asignar folio anticipado» no avisa que no pudo revisar las facturas sin orden (403 → siguió a emitir). |
| 2 | Lenguaje del usuario | 2 | Casi todo en palabras de Karla; se cuelan «grupo 2», «disp.», «pend», s/IVA y c/IVA juntos, «stage salidas o maq_received, sin splits» y tres nombres para el folio anticipado. |
| 3 | Control y libertad | 2 | El plan pregunta con `confirm()` del navegador; Esc en «Facturar a tercero» cerró el plan entero; «Cancelar» en «¿Retomarla?» borra el borrador sin decirlo. |
| 4 | Consistencia | 2 | Las demás ventanas siguen el contrato (diálogo, Esc, pie fijo, error adentro); el plan matriz, la pantalla clave, no (3 `confirm`, 1 `alert`, Esc propio, sin `role="dialog"`). Dos verdes para «Asignar Folio y Entregar». |
| 5 | Prevención de errores | 2 | Bien el cuadre contra el importe de la factura y el doble clic (1 escritura); mal: el plan crea o liga N facturas sin vista previa, y el folio anticipado sigue cuando la revisión falla. |
| 6 | Reconocer, no recordar | 2 | Las sugerencias «Sin orden: F-143 · F-155» ayudan; las porciones de cada factura hay que traerlas de CobranzaFlow; nada en la cola ni en P-0544 menciona F-90. |
| 7 | Flexibilidad y eficiencia | 2 | «Lo que falta» y «Repartir» son buenos atajos; el plan no se usa con teclado, sin Ctrl+Enter, y no abre hasta que TODAS las órdenes están en Salidas. |
| 8 | Estética y minimalismo | 2 | El plan apila descripción, nota, cifra héroe, modo y N antes de la matriz (a 1366 se ve 1 de 4 órdenes); la barra de la OC, 4 botones rellenos de 4 colores. |
| 9 | Recuperarse de errores | 2 | Bien «No se pudieron leer… Reintentar» en la columna; mal: el rechazo al crear el plan sale 7 s, crudo («solo lectura»), encima del botón. |
| 10 | Ayuda y documentación | 3 | Mucha ayuda en contexto bien escrita; falta lo esencial: cuál de las cuatro puertas usar para ligar una factura que ya existe. |
| | **Total** | **21/40** | **Aceptable: hacen falta mejoras de fondo para que Karla folie sin miedo.** |

## ¿Parece hecho por IA?

**Revisor:** en conjunto no (lienzo gris frío, folios en Geist Mono, el español del taller; «En la planta» es herramienta de piso de
verdad), pero el plan matriz y la barra de la OC tienen tics de plantilla: el único botón con degradado de la app («Plan matriz»,
violeta, `src/App.jsx:19023`) junto a otros tres rellenos de colores distintos; una cifra héroe («POR ASIGNAR $40,000.00» a 24 px, lo
más grande de la pantalla, más que la decisión); un emoji como ícono («🔢 se asigna solo»); y la cola «Por foliar» como rejilla de
tarjetas idénticas con el nombre repetido («PORTLAND LEATHER · PORTLAND LEATHER»).

**Detector:** sobre el código, 6 hallazgos de toda la app y ninguno en este flujo (Arial en las hojas impresas, a propósito; Geist
«sobreusada», falso positivo: es la letra de la casa; dos `transition: width`, del menú y del almacenamiento). En la app real: la cola de
Folios 93 (48 de contraste, 45 de letra chica), el plan matriz 19 (4 de contraste, 14 de letra chica, un renglón de ~236 caracteres),
«Asignar folio» 2 (letra chica: es la ventana más limpia), y en la OC el degradado violeta marcado como paleta de IA. Coinciden en el
degradado y en los verdes; el detector añade el ámbar «2 errores» del plan (2.6:1) y el gris #73737b sobre #eff2f6 (4.2:1). La «letra
chica» de 10-11 px es la densidad decidida en DESIGN.md (falso positivo en general; no en montos y folios). El detector no reconoció el
plan como ventana (no es `role="dialog"`) y «Facturar por partes» no se pudo abrir desde la cola: su ficha no lo trae. Corrió sin
pantalla: no hay superposición visible.

## Impresión general

Las ventanas sueltas de dinero ya son buenas («Asignar folio y entregar» y el folio anticipado dicen cifras, nombres y el siguiente
folio, y el doble clic manda una vez). Lo que falla es el FLUJO: las puertas por orden no saben de la OC, el plan matriz (la pantalla
de las tareas grandes) está fuera del sistema de ventanas y no se deja ver ni confirmar, y una lectura fallida se vuelve permiso para
emitir. La oportunidad: que la app le diga a Karla «estas facturas sin orden suman esta OC; lígalas aquí», y que el plan se comporte
como las demás ventanas.

## Lo que funciona

1. El cuadre con nombre y cifra en el plan: «Factura 1: F-143 es por $3,066.78 con IVA y esta columna suma $0.00 (faltan $3,066.78)»,
   luego «CUADRA con F-143 ✓». Es «Muestra el porqué» bien hecho, y el mejor momento del flujo.
2. «Asignar folio y entregar» y el folio anticipado: encabezado con cliente, P-, subtotal y total, el siguiente folio a la vista, y una
   vista previa honesta («Vas a emitir (anticipado) Factura por $13,920.00 con IVA · a … · La orden se queda en su etapa»).
3. «En la planta»: una orden por renglón, dónde va y desde cuándo, «Pasar a Salidas» teñido, y quién recibe el aviso. Y en «Nueva OC»,
   «¿Quisiste decir…?» separa HOTEL HOTSSON de INMOBILIARIA HOTSSON.

## Problemas prioritarios

**[P1] El folio anticipado trata un error de lectura como «no hay anticipos» (P-0544 con F-90).** Al confirmar, la lectura de las
facturas sin orden contestó 403 y la app siguió a `assign_invoice` sin preguntar ni avisar (`candidatasParaLigar` da `null` al fallar y
quien la llama lo vuelve lista vacía: `:21803-21808`, `:23283`). Con un tropiezo de red, Karla emite $13,920.00 por un trabajo cuyo 50%
ya cobró F-90; y aun con la lectura bien, se entera de F-90 después de llenar la ventana equivocada. **Arreglo:** leer al abrir (como
«Asignar folio y entregar» desde v10.84.70); si hay una factura sin orden, decirlo arriba y ofrecer «Facturar por partes: ligar F-90
como 1ª parte»; si la lectura falla, «No pude revisar · Reintentar» y el botón apagado con su porqué. *Un error de lectura no es
permiso.* → `/impeccable harden`

**[P1] Las puertas por orden no saben de la OC: la cola lleva a Karla al camino equivocado (PORTLAND).** Las 4 fichas de «Por foliar»
(P-0592 a P-0595) no dicen OC-0960; «Asignar folio y entregar» le propondría ligar F-143 como parte de UNA orden (cabe en P-0595 y la
base lo aceptaría), aunque F-143 cubre piezas de los 4 stickers; el detalle de la OC no dice que F-143 y F-155 suman exacto la OC con
IVA ($46,400.00). Es su miedo literal: equivocarse de folio o de importe. **Arreglo:** en la ficha «OC-0960 · 4 órdenes»; en una orden
de OC, el aviso de facturas sin orden lleva al plan de la OC; en la OC, una línea arriba («F-143 y F-155, sin orden, suman esta OC con
IVA») con «Plan matriz» como la única acción rellena. → `/impeccable clarify`

**[P1] El plan matriz está fuera del sistema de ventanas.** 30 Tab cayeron en las fichas de atrás (la tercera, el «Asignar Folio y
Entregar» de P-0595, con el plan encima); Esc en «Facturar a tercero» dispara el `confirm()` del plan y con «Aceptar» se cerró todo;
«Cancelar» en «¿Retomarla?» borró el borrador sin avisar. Sin `role="dialog"`, `aria-modal`, `atraparTab` ni `useEscClose` (`:9163-9167`,
`:9101`, `:9128`, `:9346`, `:9409`, `:9675`); el detector ni lo reconoce como ventana. Karla pierde 10 a 30 minutos de captura con dos
teclas que en cualquier otra ventana son seguras. **Arreglo:** el contrato de las demás ventanas, y las tres preguntas con la ventana de
la app y botones que digan lo que hacen («Retomar el borrador de hace 1 min» / «Empezar de cero y borrarlo»). → `/impeccable harden`

**[P1] El plan matriz no se deja ver ni confirmar.** Crea o liga N facturas al primer clic, sin vista previa (`handleSubmit`,
`:9603-9654`); el rechazo sale 7 s en el aviso de abajo, crudo, encima del botón; el botón principal queda bajo el borde (1366: y=808-845;
1920: y=1052-1089). A 1366 se ve 1 de 4 órdenes; con 7 facturas la tabla mide 1560 px en 1258 (scroll horizontal también a 1920: el
plan no pasa de 1300 px); «Ya tiene factura: ligarla» es un enlace de 10 px; sólo salen 4 sugerencias y Hotsson tiene 5. **Arreglo:**
encabezado en un renglón y sin cifra héroe; la matriz con todo el alto y el ancho; pie fijo con el error en palabras y `role="alert"`;
antes de crear, una vista previa con una fila por factura (ligar o nueva, importe, a cargo de quién) y el total; «Nueva / Ya existe:
F-…» como elección visible de cada columna. → `/impeccable layout`, `/impeccable harden`

**[P1] Lo que carga dinero no pasa AA en la cola y en la OC** (PRODUCT.md: AA en montos, folios y estados). Medido por los dos: 27
importes en verde a 3.0:1 y 10 «Asignar Folio y Entregar» blanco sobre verde a 3.1:1 en la cola de Folios (sus fichas propias: el
arreglo de v10.84.94 fue a OCard, no a éstas); en la OC, «Pre-asignar folio» 2.6:1, «Agregar Producto Existente» 3.3:1 y el degradado
violeta de «Plan matriz»; fechas vencidas en rojo a 4.3:1; el ámbar «2 errores» del plan 2.6:1. **Arreglo:** el criterio de la ficha y
del detalle (una acción rellena en su tinta, las demás teñidas; textos en su tinta), sin degradado. → `/impeccable quieter`, `/impeccable audit`

## Banderas rojas por persona

**Karla:** PORTLAND son 9 clics, 4 cantidades y 2-3 scrolls, más ir a CobranzaFlow por los conceptos de F-143, y desde su cola no lo
encuentra sola. Hotsson (estimado): 28-32 clics y 12-14 números en 6 pantallas, y se pierde en cuatro lugares: OC-0944 y OC-0949 no
salen en la lista («las OC simples están ocultas por diseño»), el plan no abre hasta que P-0621 y P-0623 lleguen a Salidas, 7 columnas
con scroll y sólo 4 de las 5 sugerencias, y la regla del dueño (el saldo con quien pidió) está arriba, no junto a cada factura. En su
cola, la ficha no trae «Facturar por partes»; «Asignar folio» de P-0631 dice «falló la red» cuando fue un 403. F-90: el P1 del anticipo.

**Sam (accesibilidad):** los contrastes de arriba, y el plan no se usa con teclado.

**Alex (experto; Marcelo o Karla ya entrenada):** el plan sin Ctrl+Enter, sin poder prepararse antes de Salidas, sin traer las porciones
de un CFDI ya timbrado, y la lista de OC sin «ver todas» para las simples.

## Observaciones menores

Karla entra a «Dashboard» y no a su cola; «3×nullcm» en las 4 órdenes de OC-0960 (`:14658` sólo revisa el ancho); el nombre repetido en
las fichas de «Por foliar» y «En espera» (`:22775`); dos verdes de «Asignar Folio y Entregar»; «grupo 2» donde el plan dice «Factura 2»;
«Crear OC» apagado con opacidad 0.5 y «Nueva OC» se cierra con un clic fuera aunque tenga datos; el plan vacío habla en código; el ícono
🔢 y «mejor que se asigne solo»; «Agregar Producto Existente» sin `role="dialog"`; la chapita «en OC-0944» ~2.3:1; un párrafo del plan de
~236 caracteres por renglón; el plan se queda en 1300 px a 1920.

## Preguntas para pensar

1. ¿Y si ligar fuera la primera pregunta del plan («F-143 y F-155 suman exactamente esta OC: ¿son de este trabajo?») y no un enlace de
   10 px dentro de una columna?
2. ¿El plan podría leer los conceptos de F-143 (timbrada en la misma base) y proponer las porciones?
3. ¿Qué haría falta para que «Por foliar» agrupe por OC y por cliente con facturas sin orden?
4. ¿Por qué el plan no deja anotar a nombre de quién va cada CFDI, para que «Por Timbrar» lo traiga ya elegido?
5. Si «un error de lectura no es vacío» (la regla 12), ¿no debería ser también «un error de lectura no es permiso» en todo lo que decide
   si se emite un CFDI?
