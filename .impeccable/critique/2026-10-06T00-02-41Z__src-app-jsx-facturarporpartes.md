---
target: Facturar por partes (SplitInvoiceModal, FacturarSiguienteParteModal, CancelarParteModal)
total_score: 25
p0_count: 0
p1_count: 3
timestamp: 2026-10-06T00-02-41Z
slug: src-app-jsx-facturarporpartes
---
# Critique: Facturar por partes (PrintFlow)

Target: `src/App.jsx`: FacturarSiguienteParteModal (6844), CancelarParteModal (6991), SplitInvoiceModal (7032) y su puerta en la ficha (OCard 12263).

## Design Health Score

| # | Heurística | Score | Lo principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Semáforo vivo y resumen con cifras; las razones de bloqueo, a 10px gris bajo el botón |
| 2 | Lenguaje del mundo real | 2 | «Factura D-» con el emisor sacando F-; «splits», «Prefix», «stage», «v10.58.34» en pantalla |
| 3 | Control y libertad | 2 | Esc en «Folio ya existe» tira el plan entero; el clic fuera también |
| 4 | Consistencia | 2 | Tres mecanismos de Esc, window.confirm junto a ConfirmModal, emoji junto a Phosphor, «Cancelar» vs «Volver» |
| 5 | Prevención de errores | 3 | Centavos enteros, resto único y al final, destino del dinero sin default; falla la pérdida por Esc o clic |
| 6 | Reconocer antes que recordar | 3 | Precio por pieza implícito con «≠ orden»; candidatas con folio, importe y fecha |
| 7 | Flexibilidad y eficiencia | 3 | «Todo lo que queda», «Dividir igual», «El resto, después», «Cuadrar»; sin autofoco ni Enter |
| 8 | Estética y minimalismo | 2 | El split enseña todo a la vez: 8 controles, prosa, caja de anticipados, hasta 6 avisos |
| 9 | Recuperación de errores | 3 | «Cuadrar» con dos estrategias; el «ya registrado» se vuelve oferta de ligar; mensajes en jerga |
| 10 | Ayuda y documentación | 2 | La ayuda visible es prosa o nota de versión; la buena vive en tooltips, que en táctil no existen |
| **Total** | | **25/40** | **Aceptable** |

## Anti-Patterns Verdict

**LLM:** no parece hecho por IA. No hay gradientes, hero-metrics ni grids de cards idénticas: es una herramienta densa y honesta, con la cara de una pantalla que creció por parches (cada versión agregó su aviso y su explicación, hasta una nota «v10.58.34» visible). Los tells que sí tiene son de otra familia: emojis como íconos (📄📋⏳💎🔢❌) mezclados con Phosphor, y MAYÚSCULAS de énfasis («UNA orden», «NO lo sugiere», «TODOS los folios»).

**Detector:** 0 hallazgos (exit 0) sobre los 851 renglones extraídos. Falso negativo conocido: no resuelve colores que llegan por token en estilos inline (`color:C.wn`), así que no ve el contraste que sí falla (P1 abajo).

**Overlays:** sin inspección en navegador. PrintFlow pide su propio login (la cuenta de pruebas de Claude es de CobranzaFlow) y los tres modales piden una orden en salidas con precio y rol admin/karla. No hay overlay visible.

## Overall Impression

La lógica es de primera: centavos enteros, el resto único y al final, el cuadre automático con dos estrategias, el destino del dinero sin opción marcada. La pantalla no está a esa altura: habla en el idioma del código, pinta el dinero en colores que no se leen, y tiene una tecla (Esc) que tira un plan de seis partes con folios. La mayor oportunidad es el split: enseña cada mecanismo a la vez en lugar del camino normal.

## What's Working

1. **«Facturar siguiente parte» es chica a propósito.** Abre en «Todo lo que queda», con el tipo del plan y el folio automático: el caso normal es un clic. El resumen repite la acción con cifras («Se emite una factura por $X… Quedarán $Y sin IVA por facturar»).
2. **El semáforo del split dice el estado con ícono, número y palabra** («Faltan 200»), y si no cuadra ofrece «Cuadrar» con dos estrategias explicadas (piezas o importes). Es recuperación, no sólo detección.
3. **Cancelar una parte pregunta qué pasa con el dinero sin opción marcada**, y la salida dice «Volver», no «Cancelar». Las decisiones de Marcelo del 29-sep están bien traducidas.

## Priority Issues

**[P1] Esc en «Folio ya existe en cobranza» cierra también el plan**
- **Qué:** el ConfirmModal de ligar (zIndex 1100) cierra por el escStack; el SplitInvoiceModal tiene su propio listener en `window` (7078-7086), que también dispara. Una tecla cierra los dos. El clic fuera del panel (7412) también cierra el plan sin preguntar. Ninguno de los tres modales tiene role="dialog", aria-modal ni autofoco: el foco se queda en la tarjeta del tablero.
- **Por qué:** v10.84.6 se hizo para que el plan sobreviviera al «ya registrado». Karla arma 4-6 partes con folios, sale la pregunta, aprieta Esc para pensarlo y pierde todo.
- **Fix:** los tres modales a `useEscClose` (el stack cierra sólo el de arriba); role="dialog" + aria-modal + aria-labelledby; autofoco en la acción segura; el clic fuera no cierra si hay captura.
- **Comando:** /impeccable harden

**[P1] El dinero y los avisos, en colores de semáforo como texto**
- **Qué:** C.wn (2.6:1), C.ok (3.0:1), C.amb (2.2:1), C.emr (2.5:1) y C.dn (4.3:1) sobre #fcfdfe: «Faltan/Sobran», «Diferencia $», «$X / $Y» del semáforo, «Quedarán $X», «facturada completa», los avisos del resto y de folios, la etiqueta de anticipados, el chip Corona, los errores, y en la ficha «faltan $» y «resto por facturar».
- **Por qué:** PRODUCT.md pide AA en lo que carga dinero o folios, y éstas son las cifras que Karla tiene que leer bien.
- **Fix:** el texto en tinta (C.tx, ámbar #b45309, rojo #b91c1c, verde de tinta); el color de semáforo se queda en ícono, borde y tinte.
- **Comando:** /impeccable polish

**[P1] La pantalla habla como el código, y con la serie vieja**
- **Qué:** «v10.58.34: la pre-asignación es uniforme (todos los splits o ninguno). Esto evita estados de stage ambiguos.»; razones «Prefix no coincide con tipo», «Hay splits con cantidad 0», «corona_saldo solo aplica…», «sin leading zeros». Los tipos dicen «Factura D-» / «Remisión R-» y el error de formato pide «D-NNNN o R-NNNN», cuando desde el 1-sep el emisor saca F- y RS-. «N facturas:» cuenta partes (incluye el resto y el saldo Corona).
- **Por qué:** «El folio no se adivina» (PRODUCT.md). Una pantalla de folios que nombra la serie equivocada siembra la duda justo ahí.
- **Fix:** tipos «Factura (con IVA)», «Remisión (sin IVA)», «Después (el resto)», «Saldo Corona»; la serie sólo en la columna Folio, según el emisor; razones en palabras de Karla; «Partes:»; fuera la nota de versión.
- **Comando:** /impeccable clarify

**[P2] El split enseña todos los mecanismos a la vez**
- **Qué:** párrafo de 4 frases (con emojis de botones), barra de 8 controles, modo de captura con explicación, la caja de anticipados siempre visible, hasta 6 avisos apilados, y bajo el botón la misma lista otra vez, en jerga.
- **Por qué:** el camino normal (2-3 partes, o una hoy y el resto después) queda enterrado entre lo raro (anticipados, Corona, ligar).
- **Fix:** intro de una línea; anticipados detrás de un enlace, abierto sólo si el plan los trae; los avisos en una sola lista «Falta para crear» junto al botón; fuera la lista duplicada.
- **Comando:** /impeccable distill

**[P2] Cancelar la parte esconde su consecuencia más grande**
- **Qué:** «Es la única parte que queda: la orden se cancela.» va a 10px gris como detalle de la opción, y el botón sigue diciendo «Cancelar la parte». El párrafo de entrada carga siempre la excepción «si ya está timbrado… se cancela en CobranzaFlow».
- **Por qué:** cancelar la orden entera es lo más irreversible de la pantalla y es lo que menos se ve.
- **Fix:** con la última parte y «Se da por perdido», un aviso en tinta y el botón «Cancelar la parte y la orden»; la excepción de CobranzaFlow a una nota corta bajo las opciones.
- **Comando:** /impeccable clarify

## Persona Red Flags

**Karla (folios, todos los días):** arma un plan de 4 partes con folios, «Crear 4 folios», sale «Folio ya existe en cobranza», aprieta Esc: se cierra todo. En el tipo lee «Factura D-» aunque le va a salir F-. Si algo no cuadra, abajo lee «• Prefix no coincide con tipo.»

**Alex (experto):** ningún modal pone el foco en su primer campo; Enter no hace nada; para facturar todo lo que queda hay que ir al ratón.

**Sam (lector de pantalla / teclado):** no se anuncia el diálogo; Tab recorre el tablero detrás del velo. Los campos de cada fila (cantidad, importe, tipo, folio) no tienen etiqueta. El semáforo cambia sin aria-live. El dinero en ámbar y verde no pasa AA.

**Riley (casos raros):** el resto vivo por realtime está bien cuidado (key + aviso). Pero el clic fuera del panel de 920px cierra un plan de N partes sin preguntar, además de la ruta de Esc.

## Minor Observations

- `window.confirm` en tres lugares (reducir N con datos, «El resto, después» sobre una fila capturada, ligar en Siguiente parte): diálogo del navegador, fuera del sistema; ya existe ConfirmModal.
- En Siguiente parte «ligar» es una caja con casilla y explicación siempre visible; en el split es un enlace «¿ya existe? ligar». Un concepto, dos formas.
- Emojis como íconos, también dentro de `<option>`; el resto de la app usa Phosphor.
- Caja de error con tinte en duro `#ff3b3010` y «❌»; los demás avisos usan WarningIcon.
- Títulos h3 a 16px, fuera de la escala F (15).
- «Cancelar» en dos modales que facturan: en este dominio «cancelar» es cancelar un documento. CancelarParte ya usa «Volver».
- Rayas largas en el copy (aviso histórico, saldo a favor, mensaje de ligar).
- «cancelar parte» de la ficha: 9px con 1px de relleno, objetivo diminuto.
- FolioAutoNote: «Ya no se captura a mano» es copy de transición del 1-sep.
- En CancelarParte la razón va antes de la decisión del dinero.

## Questions to Consider

- Si «una parte hoy y el resto después» es como de verdad se factura por partes, ¿no debería ser la forma con la que abre el split?
- ¿El split necesita enseñar Corona, anticipados y el modo de captura a todos, o sólo cuando la orden los trae?
- ¿Y si el semáforo fuera la acción: «Faltan 200 pzas · Cuadrar», en un solo lugar?
