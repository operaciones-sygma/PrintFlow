---
target: Las puertas de cancelar (PrintFlow), primera pasada sobre v10.84.72
total_score: 18
p0_count: 0
p1_count: 3
timestamp: 2026-10-12T09-00-23Z
slug: src-app-jsx-cancelar
---
Target: «las puertas de cancelar» en PrintFlow, v10.84.72: `CancelOrderModal` (la orden sin folio), `CancelInvoicedModal` («Cancelar con Nota de Crédito», la orden con folio), `CancelarParteModal` (una parte de una orden facturada por partes) y `MatrixCancelConfirmModal` (una línea o una factura entera del plan matriz de una OC), con sus montajes en App. Primera pasada, como UN objetivo.
Evaluación A: revisor independiente (agente aparte, ~343k tokens, 87 herramientas, ~19 min) en el banco `tests/banco/gen-cancelar.mjs` (9 variantes, `saldo=corona|falla`, `falla=1`, `lento=1`) a 1366×768, 1920×1080 y 683×384 (la laptop al 200 %); sus guiones y capturas en `.banco-cancelar/revisor/` (fuera del repo). Evaluación B: el detector de impeccable inyectado en el banco, 8 estados. Y la tanda de contrato `tests/romper/cancelar.mjs` contra el código de hoy: 16 pasan, 29 fallan.

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | El éxito de la 1 sale como aviso ROJO con ✕ y sin la orden; Esc a media «Cancelando…» cierra la 1 y la 2 y la cancelación sigue; en la 3 la consecuencia cambia sin avisar. |
| 2 | Lenguaje del usuario | 2 | La 2 se llama «Cancelar con Nota de Crédito» y su cuerpo dice que no emite ninguna; la 4 habla de «ledger Corona», «invoice», «líneas vivas», «(corona_saldo)». |
| 3 | Control y libertad | 2 | Esc y el clic fuera tiran el motivo; en el `confirm` de la 2, «Cancelar» quiere decir NO cancelar; la 1 promete que se deshace y borra el archivo de producción. |
| 4 | Consistencia | 1 | Cuatro ventanas, cuatro reglas: motivo de 1 o de 5 letras, cuatro rótulos, botón seguro «No, conservar» / «Cancelar» / «Volver», sólo 1 de 4 es diálogo, Esc por la pila o por un listener propio, el clic fuera no hace nada, cierra o pregunta, el error abajo o dentro. |
| 5 | Prevención de errores | 2 | La 2 deja confirmar lo que la base va a rechazar (CFDI timbrado); la 1, en manos de Dirección, cancela facturas por partes, del plan matriz o agrupadas sin decirlo. |
| 6 | Reconocer, no recordar | 2 | La 2 no enseña la orden ni el importe; la 2 y la 3 le piden a la persona saber si el CFDI está timbrado, cobrado o compartido. |
| 7 | Flexibilidad y eficiencia | 1 | En la 1, la 2 y la 4 el foco empieza fuera o el Tab se sale (8-9 de 10 paradas); la 4 no cierra con Esc al abrir. |
| 8 | Estética y minimalismo | 2 | Rojo por todos lados (títulos, recuadro del folio, campo vacío, asterisco, «irreversible»); la 2 trae un párrafo ámbar de 4 renglones y un `confirm` de 741 caracteres, y no dice cuánto. |
| 9 | Recuperarse de errores | 2 | El rechazo de la base sale en un aviso de 7 s con el foco en `<body>` en la 1, la 2 y la 4; la 1 además cierra y tira el motivo. Sólo la 3 lo dice dentro. |
| 10 | Ayuda y documentación | 2 | Lo que la 4 más necesita decir (los cobros quedan como discrepancia) vive en el `title` del botón que la abre; la 2 explica todos los casos en vez del suyo. |
| **Total** | | **18/40** | **Pobre** (sola, la 3 andaría en «Buena»; al conjunto lo bajan la 2 y la incoherencia) |

## Anti-Patterns Verdict

**Revisión (LLM):** en lo visual no parece de IA (hereda «El Taller Ordenado»: sin gradientes, glass ni tarjetas idénticas). En el texto sí: cubrir todos los casos en vez de saber cuál aplica (el `confirm` de 741 caracteres con cuatro «si»; «se reversa Corona si aplica»; «Si era la última línea viva…» cuando lo sabe) y el aviso genérico («Esta acción es irreversible», «0/500 caracteres»). Se siente como cuatro épocas pegadas (v10.9.0, v10.58.40, v10.84.18, v10.84.27-32).

**Detector (8 estados):** `low-contrast` en la 1, la 2 y la 4 (título rojo 4.3:1, aviso de Corona ámbar 2.2:1, botón blanco sobre rojo 4.3:1, botón apagado 2.5:1); `tiny-text` (10-11 px); `all-caps-body` (el rótulo en mayúsculas del motivo); `flat-type-hierarchy` (10/11/12/13/16 px, razón 1.6); `gradient-text` es del banco (el cuerpo de la página de pruebas), no de las ventanas. La 3 sale limpia de contraste.

**Tanda de contrato (`tests/romper/cancelar.mjs`, 45 casos, 9 por puerta):** 29 fallan. Diálogo con nombre, foco y Tab: fallan la 1, la 2 y la 4. Esc con el motivo escrito: fallan las cinco variantes. Clic fuera: la 2 y la 4. `confirm` nativo: la 2. La base que rechaza: la 1 (cierra y tira el motivo), la 2 y la 4 (sólo en el aviso de abajo). AA: la 1, la 2 y la 4.

## Overall Impression

La 3 («Cancelar la parte») es el modelo: obliga a elegir qué pasa con el dinero, con el importe en cada opción, dice la consecuencia mayor en el botón y conserva lo capturado si la base rechaza. Las otras tres se quedaron en épocas anteriores, y la más delicada, la de la orden con folio, es la peor: no dice qué le va a pasar a ESTE folio.

## What's Working

1. La 3: sin opción marcada de entrada, la consecuencia mayor en tinta roja (6.35:1) y en el botón, diálogo con nombre, foco en «Volver», Tab atrapado, el error dentro y montada sobre la orden viva.
2. La 1 consulta el saldo de Corona al abrir, dice la cifra y que ya no se podrá deshacer, y distingue «no se pudo comprobar» de «cero».
3. En las cuatro un doble clic en confirmar hace una sola llamada (medido) y «Cancelando…» se ve mientras la base contesta.

## Priority Issues

### [P1] La 2 no dice qué va a pasar con ESTE folio
No enseña la orden ni el importe; el efecto en CobranzaFlow va en un `window.confirm` con cuatro escenarios hipotéticos; el título, el botón, el aviso posterior y el «⋯ Más» hablan de nota de crédito y el cuerpo (ámbar, 2.16:1) dice que no se emite ninguna; con una remisión dice lo mismo; si el CFDI está timbrado la base lo rechaza después de los dos pasos, en un aviso de 7 s.
Arreglo: leer al abrir lo que ya está a la mano (con tope y «Reintentar») y enseñar UN caso con cifras: sin timbrar → la factura se cancela con saldo 0; timbrada → sin botón, primero se cancela el CFDI en CobranzaFlow; compartida → no se cancela, se le resta lo de esta orden; cobrada → los cobros quedan como discrepancia. Título «Cancelar P-0688 y su factura F-131», botón que lo diga, fuera el `confirm`, el mismo texto en el «⋯ Más» y en el aviso a Karla.

### [P1] La 1 hace más de lo que dice
(a) Borra el archivo de producción sin decirlo mientras promete que Dirección puede deshacerlo; (b) en manos de Dirección se abre en órdenes ya facturadas por partes, agrupadas o del plan matriz y cancela sus facturas sin decirlo; (c) el inventario cargado se frena hasta después de escribir el motivo; (d) no dice que sale de la cola de su máquina, quién entra ni a quién se avisa.
Arreglo: con un vínculo fiscal, decir qué cae (o mandar a su puerta); decir el archivo; el inventario al abrir con el botón apagado; la cola y los avisos en una línea.

### [P1] Lo que carga dinero y folios no pasa AA
Aviso de Corona 2.16:1, «Esto no emite…» 2.16:1, «Era folio anticipado» 2.07:1, RS-1290 2.09:1, títulos rojos 4.26:1, «irreversible» 4.26:1, contador verde 3.00:1, botón blanco sobre rojo 4.34:1, botón apagado 1.7-2.3:1 sin decir por qué.
Arreglo: avisos en `C.wnInk`, títulos en `C.tx` con el ícono rojo, botones en `C.dnInk`, el folio con `tintaAA`, el botón apagado neutro con la línea que dice qué falta.

### [P2] Tres de cuatro no siguen el patrón de diálogos de DESIGN.md
Sin `role="dialog"` ni nombre; el foco se queda en lo que las abrió y el Tab sale (9, 8 y 8 de 10 paradas); Esc con el motivo escrito cierra sin preguntar (las cuatro); el clic fuera y el arrastre que termina fuera tiran el motivo (2 y 4); Esc a media «Cancelando…» cierra la 1 y la 2; el error abajo con el foco en `<body>` y la 1 se cierra; el éxito de la 1 en rojo; la 4 con su propio listener de Escape en `window`.
Arreglo: una sola cáscara (sacada de la 3) para las cuatro: foco en la salida segura, `atraparTab`, Esc y el fondo preguntan, trabajando no cierra, el error dentro, `escudoDeClics`, el mismo mínimo de motivo, los mismos rótulos; el éxito en verde con la P-xxxx o el folio.

### [P2] La 4 dice «irreversible» pero no dice lo que sabe
«Si era la última línea viva…» con `group.lines` a la mano; no lista las órdenes del grupo; no dice qué pasa con el dinero ni los cobros (sólo en el `title` del botón que la abre); «se reversa Corona si aplica» sin cifra; jerga; el total sólo sin IVA.
Arreglo: calcular si es la última, listar las líneas con su importe, decir los cobros y Corona en palabras, el total con y sin IVA.

## Persona Red Flags

**Karla:** no abre ninguna (la 2, la 3 y la 4 son de Dirección; la 1, de Dirección, Lupita y el vendedor en lo suyo). De la 2 le llega «NC pendiente» sin decir si le toca algo; de la 3 y la 4, nada.
**Quien suple (sin la jerga):** en la 1 «salvo si la cancelación devolvió saldo» sale aunque sea 0; el aviso de Corona, lo único grave, a 2.16:1; el aviso rojo de éxito invita a reintentar. En la 2-4: «NC», «CFDI timbrado», «ledger», «invoice», «líneas vivas», y el «Cancelar» del navegador que no cancela.
**Teclado:** foco y Tab (arriba); la 4 no cierra con Esc al abrir; en la 3 Esc no hace nada con el foco en una opción; el motivo de la 1, la 2 y la 4 se llama como su ejemplo para el lector de pantalla; sin anillo de foco en los campos; al cerrar el foco cae a `<body>`.

## Minor Observations

- [P2] La 3 cambia en silencio: con «Se da por perdido» elegido, si en otra sesión se cancela la otra parte, la opción pasa a «se cancela completa» y el botón a «Cancelar la parte y la orden» sin avisar.
- [P2] La 1: la consulta del saldo no dice «Revisando…», no tiene tope ni «Reintentar», y la ventana salta 37 px cuando llega.
- [P2] La 1: si la orden recibe folio en otra sesión, el aviso le dice a Lupita «Usa 'Cancelar con NC'», que ella no tiene.
- [P3] El mismo campo con cuatro rótulos; mínimo de 1 letra en la 1 y de 5 en las demás; contador «/500» en la 2 y «25/5 mínimo» en la 4.
- [P3] El campo vacío trae borde rojo antes de escribir (1 y 2) y doble borde.
- [P3] La 2: el folio en un recuadro teñido de rojo; «Era folio anticipado» en pasado.
- [P3] Un doble clic en lo que abre la 2, la 3 o la 4 la abre y la cierra.
- [P3] Al 200 % la 1 y la 2 esconden los botones bajo el pliegue (sin pie fijo) y la 4 no tiene `maxHeight`.
- [P3] Mayúsculas de título («Cancelar Orden», «Sí, Cancelar Orden»); la ficha de Lupita trae un «✕ Cancelar» suelto a 3.87:1.

## Questions to Consider

1. ¿Cancelar debe borrar el archivo de producción? (Marcelo)
2. Dirección con una orden por partes, del plan matriz o agrupada: ¿«Cancelar orden» la manda a su puerta o enumera las facturas que caen?
3. ¿Qué pasa con el dinero de una línea del plan matriz? ¿La misma pregunta que en la 3? (base)
4. ¿Karla debe recibir las cancelaciones de partes y del plan matriz, y con qué instrucción?
