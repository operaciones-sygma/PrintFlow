---
target: Asignar folio y entregar (PrintFlow), segunda pasada sobre v10.84.70
total_score: 28
p0_count: 0
p1_count: 1
timestamp: 2026-10-08T21-23-12Z
slug: src-app-jsx-asignarfolio
---
Target: «Asignar folio y entregar» en PrintFlow, v10.84.70 en el worktree (`InvoiceModal`, `MultiPaymentPicker`, el manejador de `<InvoiceModal>` y `ligarAdelantada`). Segunda pasada.
Evaluación A: revisor independiente nuevo (agente aparte, ~404k tokens), 79 capturas en el banco a 1366×768, 1366×657 y 1920×1080, teclado y mouse, más las tres capturas de la app real. Evaluación B: el detector en 5 estados y el escaneo de App.jsx.

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Al pasar a ligar, el efectivo capturado desaparece sin decir que no se cobró; «Revisando…» dos veces; «✓ Cubierto» en verde con «Parcial» por el total. |
| 2 | Lenguaje del mundo real | 3 | «F-9135 ya es la factura de este trabajo» da por hecho una coincidencia de cliente e importe (y dice «factura» aunque sea remisión); Cuadra promete «Entregada» y queda «En stock». |
| 3 | Control y libertad | 3 | «Facturar por partes» cierra y tira lo capturado sin preguntar. |
| 4 | Consistencia | 2 | «Confirmar» contra «Confirmar: ligar F-9135»; ámbar para instrucciones neutras; dos caminos para la transferencia sin referencia; Corona y Cuadra con otro estilo (el folio se parte); el diálogo salta de 520 a 960. |
| 5 | Prevención de errores | 2 | El efectivo se tira al ligar (P1); «No es de este trabajo» deja confirmar lo que la base rechaza; «Facturar por partes» descarta lo capturado. |
| 6 | Reconocer, no recordar | 3 | Para decidir si F-9135 es de este trabajo no se enseña con qué compararla. |
| 7 | Flexibilidad y eficiencia | 3 | Ctrl+Enter no se ve en ningún lado; 6 Tab de «Factura» a «No pagada». |
| 8 | Estética y minimalismo | 3 | Cajas anidadas en el selector de pagos; avisos que salen siempre. |
| 9 | Recuperarse de errores | 3 | El rechazo de «adelantada» no dice qué pasó con el efectivo; la salida de «No es de este trabajo» no es una acción. |
| 10 | Ayuda y documentación | 3 | Falta justo lo que se necesita para decidir si se liga. |
| **Total** | | **28/40** | **Good (borde de abajo)** |

## Anti-Patterns Verdict

**Revisión (LLM):** no es slop (paleta contenida, Geist y Geist Mono, sin gradientes ni vidrio). Lo que la acerca a «genérica» es exceso de explicación: recuadros teñidos de cinco colores en un flujo, la tarjeta centrada de la vista previa y el botón punteado a todo lo ancho.

**Detector:** `flat-type-hierarchy` en los 5 estados (9 tamaños entre 10 y 16 px) y `tiny-text` (10.5 a 11.5 px), que coinciden con el revisor. `overused-font: Arial` es del banco (los botones simulados del tercero): en el código nuevo ya no hay texto real fuera de Geist (el «Eliminar» en Arial se fue). `gradient-text`: falso positivo conocido. En el código: los mismos 7 de la primera pasada, ninguno en la ventana. Sin capas visibles para la persona (corrió sin pantalla).

## Overall Impression

Mejoró de 23 a 28: la vista previa ya es un cerrojo fiscal comprobado (doble clic, Enter, Enter, Ctrl+Enter), el botón apagado siempre dice por qué y el monto se maneja como dinero. Lo que falta está en los caminos raros: el efectivo capturado se pierde al pasar a ligar, «No es de este trabajo» lleva a un rechazo seguro, y la decisión de ligar se toma sin con qué comparar.

## What's Working

1. La vista previa como cerrojo fiscal: doble clic en «Continuar» sólo la abre, doble clic en «Confirmar» hace una sola llamada, el foco va al resumen y Ctrl+Enter nunca emite.
2. El botón apagado siempre dice por qué, y lo que se lee al abrir tiene tope y salida; con efectivo y sin poder leer, no cobra a ciegas.
3. El monto como dinero («Pagada» trae el total exacto; -500 → 500; dos decimales), «No pagada» que guarda, flechas, y ligar como acción principal cuando corresponde.

## Priority Issues

**[P1] El efectivo capturado se pierde sin aviso cuando la base ofrece ligar.** Con efectivo capturado y el rechazo «adelantada» (o tras «No es de este trabajo»), el diálogo pasa a ligar, el pago desaparece y ligar no lo registra (`linkInvoiceToOrder(…, null, null)`); ni el error ni la vista previa lo dicen. Arreglo: decirlo en el primer paso y en la vista previa, exigir que se reconozca, anotarlo en la orden y que el error diga «No se cobró ni se creó el vale». Comando: /impeccable harden.

**[P2] «No es de este trabajo» lleva a un camino que la base rechaza.** Con el mismo tipo de documento que la adelantada, «Continuar» se enciende y la vista previa promete una factura que la base va a rechazar. Arreglo: apagar «Continuar» con su razón y decir la salida real (ligarla desde su propia orden). Comandos: /impeccable harden, /impeccable clarify.

**[P2] El foco se sale del diálogo y los campos no muestran foco.** Tras las preguntas, «No es de este trabajo» y un error, el foco cae al `<body>`; `inp` lleva `outline:none` en línea y le gana al anillo global. Arreglo: regresar el foco al que abrió la pregunta, mandarlo dentro del diálogo, y el anillo en los campos. Comandos: /impeccable harden, /impeccable polish.

**[P2] «Facturar por partes» tira lo capturado sin preguntar.** Arreglo: la misma pregunta de cerrar. Comando: /impeccable harden.

**[P2] Se decide ligar sin evidencia, y el título lo da por hecho.** Arreglo: título como pregunta, la orden junto a la factura para compararlas, «la factura» o «la remisión» según su tipo, y «No es de este trabajo» como botón. Comando: /impeccable clarify.

## Persona Red Flags

**Karla:** Ctrl+Enter sin pista visible; a 1366×657 el pago agregado queda bajo el pie; con «Parcial» por el total, tres señales que se contradicen.

**Sam (teclado y lector):** los campos sin foco visible; el foco al `<body>` tras cada pregunta; los tipos al 50% de opacidad mientras carga (3.32:1); blancos chicos («No es de este trabajo» de 15 px de alto).

**Riley:** el bucle de «No es de este trabajo»; el efectivo que se pierde; Cuadra que dice «Entregada»; precio 0 sin elegir «No pagada» solo.

## Minor Observations

- «Elige si es factura o remisión.» en ámbar al abrir (una instrucción, no un error), y con Corona o Cuadra hay tres opciones.
- «Revisando…» en el cuerpo y en el pie.
- Con tres tipos a 1366, «RS-1250» se parte en dos renglones.
- El desglose de pagos y «Saldo pendiente a CobranzaFlow» en 10 px.
- «Otro (especificar)» dice «falta el motivo» cuando falta escribirlo.
- Corona: la vista previa no repite que el saldo queda negativo.
- Mientras se consulta el emisor no se puede capturar el pago.
- La primera flecha sin método elegido marca el enfocado en vez de pasar al siguiente.
- La pregunta de cambiar el tipo no dice cuántos pagos se borran.

## Questions to Consider

- Si la base ya sabe que F-9135 es del mismo importe y el cliente paga en efectivo en el mostrador, ¿por qué el vale no se hace aquí contra F-9135?
- ¿Qué tendría que ver Karla para decidir en dos segundos si la factura es de este trabajo?
- ¿Y si el botón final dijera exactamente lo que va a existir después del clic?
