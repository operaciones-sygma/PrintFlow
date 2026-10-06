---
target: Asignar folio (InvoiceModal, PreInvoiceModal, MultiPaymentPicker)
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-10-06T01-12-56Z
slug: src-app-jsx-asignarfolio
---
# Critique: Asignar folio (PrintFlow)

Target: `src/App.jsx`: InvoiceModal (asignar folio y entregar, 8949), PreInvoiceModal (folio anticipado, 9398), MultiPaymentPicker (6510) y lo que hacen al confirmar (App, 20093 y 20461). El folio por OC (AssignOCFolioModal) va en su propia pasada.

## Design Health Score

| # | Heurística | Score | Lo principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Carga del cliente con aviso y «Recargar», sumas de pagos en vivo; si falla saber quién asigna el folio, no lo dice |
| 2 | Lenguaje del mundo real | 2 | «stage», «billing_mode='stock'», Title Case, y la serie de Alpha en el modo manual |
| 3 | Control y libertad | 2 | Dos pasos con «Atrás»; pero un clic fuera o Esc tiran los pagos capturados |
| 4 | Consistencia | 2 | alert/confirm nativos junto a ConfirmModal; «Cancelar» en pantalla fiscal; colores en duro |
| 5 | Prevención de errores | 3 | Centavos exactos, folio menor, «¿Es efectivo?», tipos apagados mientras carga |
| 6 | Reconocer antes que recordar | 2 | El total del documento no se ve al confirmar |
| 7 | Flexibilidad y eficiencia | 3 | «Usar sugerido», varios pagos, tercero; camino largo |
| 8 | Estética y minimalismo | 2 | Paso 1 apila hasta ocho bloques; la sugerencia sale dos veces |
| 9 | Recuperación de errores | 3 | «Emitida por adelantado» se vuelve oferta de ligar; el error genérico sólo en un aviso |
| 10 | Ayuda y documentación | 2 | Explicaciones largas siempre visibles; la útil, en tooltips |
| **Total** | | **24/40** | **Aceptable** |

## Anti-Patterns Verdict

**LLM:** no parece hecho por IA. Es una pantalla de trabajo, densa, construida por capas (Corona, Cuadra, efectivo, tercero, anticipos), con la lógica de dinero muy cuidada. Los tells son de deriva, no de plantilla: emojis (🔢 📦 ⚠️), flechas «→», Title Case y colores escritos a mano.

**Detector:** 0 hallazgos (exit 0) sobre 990 renglones. Mismo falso negativo que en «Facturar por partes»: no resuelve colores que llegan por token en estilos inline, y el contraste es justo lo que falla.

**Overlays:** sin navegador (PrintFlow pide su propio login). Se probará en el banco.

## Overall Impression

La parte de dinero es de las más cuidadas de la app: pagos exactos al centavo, la omisión de la referencia como decisión consciente, el efectivo que crea su vale. Pero al confirmar un acto fiscal no se ve cuánto se factura, lo capturado se pierde con un clic fuera, y los botones principales de remisión y de folio anticipado tienen texto blanco sobre verde y naranja que casi no se lee.

## What's Working

1. **Dos pasos con «Atrás».** Continuar lleva a una vista previa que repite tipo, folio, estado de pago, a quién se factura y la consecuencia («quedará Entregada… no se puede deshacer»).
2. **El selector de pagos sabe del negocio.** Exacto en centavos, «Capturado / Falta / Cubierto» en vivo y anunciado (aria-live), la casilla «Cliente no proporcionó folio» que registra la intención, y el «¿Es efectivo?» que evita el doble conteo de R-1243.
3. **No deja elegir a ciegas.** Los tipos se apagan mientras carga el cliente (para no saltarse Corona o Cuadra), con aviso y «Recargar» si la red falla; y el rechazo «emitida por adelantado» se vuelve una oferta de ligar.

## Priority Issues

**[P1] Al confirmar no se ve cuánto se factura**
- **Qué:** ni el paso 1 ni la vista previa muestran el total del documento. Sólo aparece dentro del selector de pagos al elegir Parcial o Pagada; con «No pagada» no se ve nunca. El folio anticipado enseña el precio sin decir que es sin IVA.
- **Por qué:** «El folio no se adivina» (PRODUCT.md): un acto fiscal se confirma con cifras y nombres.
- **Fix:** en el encabezado, «Total $X con IVA (subtotal $Y)» o «$Y, remisión sin IVA»; en la vista previa, «Se emite una factura por $X con IVA a CLIENTE».
- **Comando:** /impeccable clarify

**[P1] Un clic fuera o Esc tira los pagos capturados**
- **Qué:** el velo cierra el modal cuando no está guardando, y Esc también, con dos o tres pagos capturados (montos, referencias, quién entregó el efectivo).
- **Por qué:** es justo la captura que más cuesta rehacer.
- **Fix:** con algo capturado, el clic fuera no cierra y Esc pregunta (como el split en v10.84.33).
- **Comando:** /impeccable harden

**[P1] Botones y cifras que no se leen**
- **Qué:** «Continuar →» y «Confirmar Folio» del folio anticipado, blanco sobre naranja (2.2:1); los de remisión, blanco sobre verde (2.3:1); remisión en verde claro como texto (etiqueta, «sugerido», el folio de 28px en la vista previa); Corona y Cuadra en esmeralda; los avisos en ámbar, incluido el que dice que la orden ya no se podrá cancelar.
- **Por qué:** PRODUCT.md pide AA en lo que carga dinero o folios, y es el botón que confirma.
- **Fix:** botones en tintas oscuras (`C.wnInk`, `C.okInk`) o con el color de la acción ya probado (`C.fac`, `C.ac`); textos en tinta; el pleno sólo en borde, ícono y tinte.
- **Comando:** /impeccable polish

**[P2] Si falla saber quién asigna el folio, el modal se contradice**
- **Qué:** `getFolioEmitterEnabled` devuelve «apagado» cuando la lectura falla. El modal cae al modo manual, que sólo acepta D-/R- (la serie de Alpha), y la sugerencia que ofrece («→ Usar F-137», la vigente) no pasa su propia validación.
- **Fix:** distinguir «no se pudo saber» (aviso + Reintentar, sin dejar continuar) de «apagado»; el modo manual acepta F-/RS- y D-/R- como el split.
- **Comando:** /impeccable harden

**[P2] Diálogos del navegador y palabras de sistema**
- **Qué:** siete alert/confirm nativos (folio menor, cambiar de tipo, tercero incompleto, Cuadra que cambió). En pantalla: «stage», «billing_mode='stock'», «ESTADO DE PAGO *», Title Case, «🔢 Folio automático»; y en el flujo de entregar, si se dice que no a ligar, el aviso dice «Folio anticipado cancelado», copiado del otro flujo.
- **Fix:** ConfirmModal; palabras de Karla; el aviso según el flujo.
- **Comando:** /impeccable clarify

## Persona Red Flags

**Karla (folios, todos los días):** entrega con factura, captura una transferencia y un efectivo, y un clic fuera del modal se lleva los dos. Confirma sin ver el importe. En el folio anticipado, el botón naranja con texto blanco casi no se lee a media mañana.

**Sam (teclado y lector):** en modo emisor el foco se queda en la tarjeta de atrás; Tab se va del diálogo. Los avisos ámbar no pasan AA.

**Riley (casos raros):** un tropiezo de red al abrir: el modal pide el folio a mano, sugiere F-137 y lo rechaza por «Esperado: D-XXXX».

## Minor Observations

- La sugerencia sale dos veces (en la tarjeta de tipo y en «→ Usar»).
- «Cancelar» cierra el modal en una pantalla fiscal; en las de partes ya es «Volver».
- PreInvoice: «Datos completos. Cliente, producto…» se ve siempre que se puede usar el modal; ruido.
- «Solo Marcelo podrá cancelarla»: un nombre en lugar de un rol.
- Colores en duro en el selector de pagos (#fafafa, #fff, #e0f2fe, #0ea5e9, #075985, #8e8e93).
- Títulos a 16px/800 fuera de la escala F.

## Questions to Consider

- ¿Y si lo primero que se viera fuera «$X a CLIENTE», y el tipo y el folio vinieran después?
- ¿El folio anticipado necesita ser naranja, o el aviso de que ya no se puede cancelar basta para marcarlo?
- ¿La vista previa podría ser el mismo modal con el resumen arriba, en lugar de un segundo paso?
