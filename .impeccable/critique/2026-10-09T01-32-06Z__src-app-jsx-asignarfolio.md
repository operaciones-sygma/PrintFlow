---
target: Asignar folio y entregar (PrintFlow), tercera pasada sobre v10.84.70
total_score: 30
p0_count: 0
p1_count: 1
timestamp: 2026-10-09T01-32-06Z
slug: src-app-jsx-asignarfolio
---
Target: «Asignar folio y entregar» en PrintFlow, v10.84.70 con la segunda vuelta (`InvoiceModal`, `MultiPaymentPicker`, el montaje en App y `ligarAdelantada`). Tercera pasada.
Evaluación A: revisor independiente nuevo (agente aparte, ~421k tokens, 15 scripts y ~120 capturas en el banco a 1366×768, 1366×657 y 1920×1080, mouse y teclado), más las capturas de la app real del recorrido. Evaluación B: el detector en 7 estados (dos nuevos: ligar con el efectivo capturado y «No es de este trabajo») y la medición de la letra.

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Al tope de 8 s dice «falló la red» aunque sólo tardaba; el resultado tardío cambia el aviso sin decirlo; «✓ Cubierto» antes de elegir el método. |
| 2 | Lenguaje del usuario | 3 | «ligar», «folia», «descubierto», «Sin factura · Stock» sin explicar para quien suple; el monto sin comas; «PORTLAND STUDIO ·» con el tipo de producto vacío. |
| 3 | Control y libertad | 3 | Un doble clic en «Ligar F-9135 a esta orden» cierra la ventana; el clic fuera con algo capturado no hace nada ni dice por qué. |
| 4 | Consistencia | 3 | La ventana cambia de ancho (960 ↔ 520) según el camino; el encabezado conserva un total de otro camino. |
| 5 | Prevención de errores | 2 | El segundo clic de un doble clic cae en lo que la ventana acaba de mover (elige «Tarjeta» o «Remisión»); el saldo a favor no toca el monto propuesto; el efectivo al ligar queda sin vale; un folio a mano mayor al sugerido no avisa. |
| 6 | Reconocer, no recordar | 3 | El saldo a favor no está junto al monto ni en la vista previa; a 657 el encabezado se va con el scroll. |
| 7 | Flexibilidad y eficiencia | 3 | Sin teclas para tipo ni estado (~13 paradas de Tab para un pago). |
| 8 | Estética y minimalismo | 3 | Hasta 3 recuadros de colores sobre el pago; «¿Es efectivo?» de ~50 palabras y 6 negritas; la ventana sube 99 px al elegir «Pagada». |
| 9 | Recuperarse de errores | 4 | El rechazo vuelve adentro, dice lo que NO se hizo, conserva lo capturado y lleva el foco al aviso. |
| 10 | Ayuda y documentación | 3 | Se contradice sin precio; la nota del saldo a favor no dice cuánto cobrar. |
| **Total** | | **30/40** | **Bueno** |

## Anti-Patterns Verdict

**Revisión (LLM):** no parece hecha por IA: Geist, slate, tintes al 8-15 %, montos en Geist Mono, verbos en los botones. Rasgos débiles: casi todo aviso va en un recuadro teñido con ícono (cinco colores), y la vista previa con la cifra grande al centro (que aquí se gana el lugar).

**Detector (7 estados):** `tiny-text` (10-11.5 px), `flat-type-hierarchy` (9-10 medidas de 10 a 18 px), `all-caps-body` (las etiquetas en mayúsculas del sistema): las mismas de las pasadas anteriores, decisiones del sistema de diseño de PrintFlow. Falsos positivos: `overused-font: arial 19 %` (los botones simulados del banco, «tercero a medias» y «tercero listo»; la medición de la letra da 6 % fuera de Geist, todo del banco) y `gradient-text` en los 7 estados (la app no tiene `background-clip: text`; sólo `content-box` en la barra de desplazamiento global, que el banco ni siquiera carga).

## Overall Impression

La ventana ya es confiable en lo de todos los días: la vista previa antes de emitir, el pago a prueba de dedazos y los errores de la base que regresan adentro y con salida. Lo que queda es de orillas: el acomodo que se mueve con cada elección (y con él, el doble clic que elige lo que no se quería), el saldo a favor lejos del monto, y el efectivo al ligar, que la ventana explica pero no resuelve.

## What's Working

1. **La vista previa antes de emitir:** cifra, receptor, folio honesto («sería F-137 si nadie más folia antes»), vale, «no se puede deshacer» y el verbo en el botón; el foco va a ella y Ctrl+Enter sólo la abre; el escudo se traga el segundo clic de «Continuar» (probado a 0, 250 y 450 ms).
2. **El pago a prueba de dedazos:** «-500» → 500, «66004.004» → 66004.00, «66,004.00» → 66004.00, ni la rueda ni las flechas cambian el monto, centavos exactos con «faltan $0.01», «Cambiar a «Pagada»», y el botón apagado dice por qué (gris si falta hacer algo, ámbar si algo está mal). 0 textos bajo AA en 8 estados.
3. **Los errores de la base, dentro y con salida:** en palabras, con lo que no se hizo («No se cobró ni se creó el vale»), lo capturado conservado y el foco en el aviso; la factura que aparece por adelantado se vuelve la oferta de ligar, con la comparación orden/factura.

## Priority Issues

**[P1] El segundo clic de un doble clic cae en lo que la ventana acaba de poner bajo el cursor.** La ventana está centrada y cambia de alto (y de ancho, 960 ↔ 520) con cada elección; el escudo sólo cubría «Continuar» y lo que emite. Doble clic en «Agregar otro pago» a 1366×768: el segundo elige «Tarjeta» en el pago 2 y la ventana queda lista para seguir (Cheque $30,000 + Tarjeta $36,004). En «No es de este trabajo»: elige «Remisión». En «Ligar F-9135 a esta orden»: la ventana se angosta, el segundo clic cae en el fondo y la cierra. Arreglo: anclar la ventana arriba, un solo ancho, `escudoDeClics` en todo lo que cambia el acomodo, y que el fondo cierre sólo si el clic empezó en el fondo. Comando: /impeccable harden (y /impeccable layout).

**[P2] La vista previa de ligar enseña un total viejo.** Tras ir y volver del camino normal, el encabezado dice «Total $56,900.00 · remisión, sin IVA» sobre «Vas a ligar F-9135… Factura por $66,004.00 con IVA». Arreglo: en modo ligar, el encabezado describe lo que se liga. Comando: /impeccable clarify.

**[P2] El saldo a favor no llega al monto.** Con saldo a favor, «Pagada» propone el total y la nota («no lo descuenta… para no cobrarle de más») está en la otra columna y no se repite en la vista previa: con efectivo se cobra de más. Arreglo: la nota junto al pago, con las cifras y un botón para cobrar sólo lo que falta; repetida en la vista previa. Comando: /impeccable clarify.

**[P2] Al ligar, el efectivo capturado queda sin vale.** La casilla «Lo registro en CobranzaFlow» es una promesa, no un candado; ligar no crea el vale. Arreglo: ligar y crear el vale en un paso, como ya lo hace emitir con efectivo (requiere cambio en la base). Comando: /impeccable harden.

**[P2] Sin precio, la ventana se contradice:** «va como No pagada» y, justo abajo, «elige Pagada o Parcial con Efectivo» (apagados); «irá a CobranzaFlow como pendiente» contra «CobranzaFlow no la ve hasta que se capture el precio». Arreglo: sin precio, una sola nota con lo que sí aplica. Comando: /impeccable clarify.

## Persona Red Flags

**Karla con prisa en la laptop:** el doble clic en «Agregar otro pago» elige «Tarjeta»; cada elección mueve la ventana (al elegir «Pagada» todo sube 99 px); a 657 el cliente y el total se van con el scroll; la nota del saldo a favor está en la columna que no mira al cobrar.

**Quien la suple:** vocabulario de la casa sin explicar; el bloque ámbar «¿Es efectivo?» la regaña antes de equivocarse; un doble clic en «No es de este trabajo» elige «Remisión»; sin precio, dos notas que se contradicen; con el cliente lento, «Aplicar saldo» aparece a los 10 s sin aviso.

**Teclado:** funciona bien (Tab no se sale, flechas, Ctrl+Enter con su pista, Esc pregunta y regresa el foco, el foco a la vista previa y al aviso de error). Banderas: tras «Quitar el pago 2» el foco cae al fondo y Ctrl+Enter deja de responder; tras «Atrás», unos 10 Tab para volver al monto.

## Minor Observations

- Al abrir, la mitad derecha queda vacía.
- «PORTLAND STUDIO ·» con el tipo de producto vacío; el título no cambia al cargar a stock ni al aplicar saldo.
- «✓ Cubierto» en verde con «falta el método» al lado.
- La vista previa no enseña la referencia de un pago único ni quién entregó el efectivo.
- Folio a mano: «RS-1250» en una factura recibe el mensaje genérico; «F-200» (63 arriba del sugerido) no avisa.
- El tope de 8 s dice «falló la red»; el resultado tardío cambia el aviso sin decirlo.
- Clic fuera con algo capturado: no pasa nada y no se dice por qué.
- Cinco colores de aviso; tras el caso «adelantada», tres alarmas a la vez (rojo y ámbar en el pie, el recuadro ámbar del efectivo).
- En Corona, «Saldo actual» en verde esmeralda, y es lo facturado por adelantado, no dinero del cliente.
- En el banco, un doble clic lento en «Emitir y entregar» envía dos veces porque el banco no cierra la ventana; en la app real «Procesando…» dura hasta que se cierra (conviene confirmarlo en la app real).

## Questions to Consider

- ¿Y si la ventana nunca se moviera (anclada arriba y de un solo ancho)? ¿Cuántos escudos dejarían de hacer falta?
- Si emitir con efectivo ya crea el vale en un paso, ¿por qué ligar con efectivo no?
- ¿El saldo a favor debería cambiar lo que «Pagada» propone, en vez de ser una nota al lado?
- ¿Podría la vista previa vivir en el pie, junto al botón final, para la entrega de todos los días?
- ¿Seguiría haciendo falta «Otro» con su muro ámbar si «Nota de crédito» y «Compensación» fueran métodos propios?
