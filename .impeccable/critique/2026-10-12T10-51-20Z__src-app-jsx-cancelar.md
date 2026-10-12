---
target: Las puertas de cancelar (PrintFlow), segunda pasada sobre v10.84.73
total_score: 27
p0_count: 0
p1_count: 1
timestamp: 2026-10-12T10-51-20Z
slug: src-app-jsx-cancelar
---
Target: «las puertas de cancelar» en PrintFlow, v10.84.73 (`VentanaDeCancelar` + `CancelOrderModal`, `CancelInvoicedModal`, `CancelarParteModal`, `MatrixCancelConfirmModal` y sus montajes en App). Segunda pasada.
Evaluación A: revisor independiente nuevo (agente aparte, ~365k tokens, 95 herramientas, ~25 min; no vio la primera revisión) en el banco `.banco-revisor-cancelar/` con 12 scripts de Playwright y capturas en `revisor2/`: teclado, mouse, doble clic, `falla=1`, `lento=4|12`, `saldoMs=3000|10000`, los 7 casos de `fac=`, el dato que cambia con la ventana abierta, contraste, 1366×768, 1920×1080 y 683×384 (también con barras). Evaluación B: el detector en 10 estados.

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | El saldo que contesta después de los 8 s se tira; la del folio no vuelve a leer si el folio cambia; la del plan matriz va sobre una foto; trabajando no se anuncia nada. |
| 2 | Lenguaje del usuario | 3 | La de la orden habla como Lupita; la del folio cobrada y la de la parte usan «cobros amarrados… saldo otorgado… discrepancia», «pedazo», «facturada de menos, a propósito»; sin IVA y con IVA mezclados en renglones seguidos. |
| 3 | Control y libertad | 3 | Volver, Esc y el fondo preguntan; trabajando no cierra. Pero la puerta equivocada no lleva a la buena (al cerrar se tira el motivo) y «puede deshacerla» junto a un archivo que no regresa. |
| 4 | Consistencia | 2 | El marco es uno; lo que se dice, no: sólo la del folio lee la base; la del plan matriz no sigue el dato vivo; la misma acción se llama «Cancelar con su folio» en el detalle y «Cancelar con nota de crédito» en la ficha. |
| 5 | Prevención de errores | 2 | Lo común bien cuidado; lo fiscal no: la de la orden (facturada), la de la parte y la del plan matriz no saben si lo que cae está timbrado o cobrado ni a qué otras órdenes les quitan la factura; con el saldo sin saber, deja cancelar lo que «ya no se podrá deshacer». |
| 6 | Reconocer, no recordar | 3 | La de la parte pregunta si está timbrada; las salidas («Cancelar con su folio», «Cancelar la parte», «Inventario → Ajustar») no son enlaces. |
| 7 | Flexibilidad y eficiencia | 2 | El foco abre en «Volver» aunque lo único obligatorio es el campo; sin atajo para confirmar; no hay paso directo a la puerta correcta con el motivo ya escrito. |
| 8 | Estética y minimalismo | 3 | Todo el texto pasa AA (mínimo 4.52:1). En las bloqueadas sigue a la vista lo que no aplica; la de la orden facturada es un bloque rojo de 4 frases; el dinero de Corona va al último. |
| 9 | Recuperarse de errores | 3 | El rechazo vuelve adentro con la orden, el foco y lo escrito; a los 10 s el consejo es «recarga la página». |
| 10 | Ayuda y documentación | 3 | La lista de hechos ayuda en contexto; la advertencia de la parte (¿timbrada?) va al final, y los «ve a…» no son enlaces. |
| **Total** | | **27/40** | **Aceptable** (en la orilla de «Bueno») |

## Anti-Patterns Verdict

**Revisión (LLM):** en lo visual no parece de IA (El Taller Ordenado, tintas AA, sin tarjetas anidadas; el marco se porta como un diálogo de verdad). En el texto sí: frases armadas con piezas fijas que no se adaptan al caso («esas facturas» con una sola; «Cancelar la parte» con una factura agrupada o del plan matriz, donde no hay partes) y párrafos con punto y coma y paréntesis que explican de más.

**Detector (10 estados):** sin `low-contrast`, sin `all-caps-body` y sin `tiny-text` dentro de las ventanas (lo que marca es del cascarón del banco: su tipografía Arial y la bitácora de 10 px); queda `flat-type-hierarchy` (12/13/15 px, razón 1.25).

## What's Working

1. Un marco que se porta igual en las cuatro (medido): foco con anillo, Tab que da la vuelta, Esc y el fondo preguntan (también desde el campo o un radio) y «Seguir aquí» regresa el foco; arrastrar o el doble clic al abrir no cierran; un doble clic al confirmar llama una vez; trabajando no se cierra; el rechazo vuelve con `role=alert`.
2. Los botones dicen qué cancelan («Cancelar y regresar el saldo», «…y restarla de F-131», «Cancelar la línea y F-141», «Cancelar F-140 y sus 2 líneas») y van apagados hasta saber el saldo o el folio, con el porqué al lado.
3. Lo que saben, lo dicen y lo siguen: la del folio dice un caso con cifras; la de la orden sigue la fila de la máquina, el inventario, el folio y la cancelación de otra sesión en vivo; la de la parte avisa y borra la elección. Contraste: tinta roja 6.35:1, ámbar 4.93:1, botón 6.47:1.

## Priority Issues

### [P1] Lo que la base sabe de las facturas sólo lo lee la del folio
La de la orden en manos de Dirección, con factura agrupada o del plan matriz: «Cancelarla aquí cancela también esas facturas y sus cobros…» sin folios, importes, lo cobrado, si está timbrada ni a qué otras órdenes les pega, y recomienda «Cancelar la parte», que ahí no existe. La de la parte pregunta «¿Ya está timbrada…?» en una nota gris debajo del motivo. La del plan matriz promete «F-140 baja de … a …» sin saber si está timbrada y dice «Si tenía cobros…» aunque el plan ya marca PAGADA.
Arreglo: leer por cada factura que cae lo que la base sabe (folio, importe, cobrado, timbrada, quién más la comparte); timbrada apaga el botón antes de escribir; «Cancelar la parte» sólo con partes vivas, con plan matriz mandar a su ventana; en la de la parte, la nota como hecho y arriba.

### [P2] El contrato es uno; lo que se dice, no
La del folio borra el archivo de producción y avisa a Lupita y a Karla sin decirlo, y con folio anticipado y la orden corriendo no menciona la máquina (y el montaje no la saca de la fila). La de la parte no dice qué le pasa a la factura en CobranzaFlow, si se deshace ni a quién se avisa (y no trae cliente ni piezas). La del plan matriz no dice si se deshace ni a quién se avisa. La de la orden pone «puede deshacerla» debajo de «se borra su archivo».
Arreglo: una sola fuente de los hechos de la orden (fila, archivo, avisos, deshacer) para las cuatro; «puede regresarla, pero sin su archivo».

### [P2] Mientras dice «Cancelando…», el teclado se sale
Al confirmar se apagan el botón, «Volver» y el campo y el foco cae al `<body>`; con `lento=4`, Tab fue a los botones de atrás y Enter abrió OTRA ventana de cancelar con la primera trabajando.
Arreglo: el foco al panel antes de apagar, `aria-busy`, un «Cancelando P-0712…» con `role=status`.

### [P2] El saldo a favor puede quedar sin saberse
En la de la orden, la respuesta que llega después de los 8 s se tira (con `saldoMs=10000` sigue «no contestó» y el botón vivo); en la del folio, una falla al leer el saldo no se dice.
Arreglo: decir lo que llega tarde y cambiar el botón; en la del folio, el mismo renglón con «Reintentar».

### [P2] La puerta equivocada no lleva a la buena
A la de la orden le llega folio y dice «Ciérrala y cancélala con «Cancelar con su folio»», que en la ficha se llama «Cancelar con nota de crédito» (y el aviso que frena a los demás dice «…con nota de crédito»); al cerrar se pierde el motivo.
Arreglo: un solo nombre; un botón que abra la del folio con el motivo ya escrito (Dirección).

## Persona Red Flags

**Lupita (laptop):** cabe a 1366; un clic de más (el foco en «Volver»); «se borra su archivo» junto a «puede deshacerla»; bloqueada por inventario el campo sigue vivo y «Inventario → Ajustar» no es enlace; si llega el folio no puede avisarle a Dirección con su motivo.
**Quien suple a Marcelo:** «timbrada ante el SAT», «CFDI», «saldo 0», «discrepancia», «cobros amarrados», «plan matriz», «pedazo», sin explicación; sin IVA y con IVA mezclados.
**Marcelo con una orden ya facturada:** la de la orden es vaga (P1); la del folio calla archivo, avisos y máquina; la nota de timbrada de la parte va al final; la del plan matriz es una foto; desde la ficha la puerta se llama «…con nota de crédito».
**Teclado:** bien, salvo el foco al `<body>` mientras trabaja y al cerrar (fuera del detalle), sin `aria-describedby` en el diálogo ni en el botón apagado, sin atajo para confirmar.

## Minor Observations

- [P3] Huecos: el renglón del saldo reserva 36 px con una línea (~19 px de hueco); un renglón vacío de 17 px entre el error y los botones.
- [P3] El radio elegido azul nativo (falta `accent-color`); «Volver» y el botón apagado, gemelos.
- [P3] «¿Cerrar sin cancelar?» con un triángulo ámbar de 36 px, centrada sobre una ventana anclada arriba.
- [P3] La del folio sin factura viva: «Factura F-131.» sin importe y «no hay la factura viva»; si el folio cambia o se libera con la ventana abierta, los hechos siguen siendo de F-131 («con su folio» vacío, «. no está pagada»).
- [P3] En la timbrada y en las bloqueadas, el campo sigue vivo.
- [P3] La del plan matriz sin folio empieza en minúscula («la factura 2 baja…»).
- [P3] Los avisos de éxito de la orden facturada y de Corona no confirman las facturas ni el saldo.
- [P3] «Lo que escribiste sigue aquí» sólo en la de la orden; «mínimo 5 letras» cuenta cualquier carácter; «Dirección puede deshacerla» le habla a Marcelo en tercera persona; «No se pagó con saldo a favor» es ruido.
- [P3] Entradas: en el «⋯» de la ficha «Cancelar orden» en #e03b30 (4.3:1); en la OC, «Cancelar» de la línea a 9 px, «Cancelar factura» a 10 px, «cancelar parte» a 10 px con 3×8 de relleno; el tooltip de la OC dice «La NC en SAT se emite aparte».

## Questions to Consider

1. ¿La base frena hoy cancelar desde la de la orden, la de la parte y la del plan matriz algo timbrado? ¿Puede contestarlo al abrir, por cada factura que cae?
2. Con factura agrupada, de toda la OC o del plan matriz, ¿el puente cancela la factura entera o le resta la orden?
3. ¿`cancel_invoiced_order` saca de la fila una orden con folio anticipado que todavía corre?
4. ¿Se debe borrar el archivo en la del folio (hoy se borra sin decirlo) y en la de la parte cuando «perder» cancela la orden (hoy no)?
5. ¿`pf_price_drop_check` puede separar lo cobrado entre «se anula» y «queda como discrepancia»?
6. ¿Karla debe enterarse de la orden facturada, la parte y el plan matriz?
7. ¿El foco puede abrir en el motivo?
