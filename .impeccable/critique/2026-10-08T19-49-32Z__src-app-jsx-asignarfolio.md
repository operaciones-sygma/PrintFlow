---
target: "Asignar folio y entregar (PrintFlow): InvoiceModal, MultiPaymentPicker y lo que App pregunta al confirmar"
total_score: 23
p0_count: 0
p1_count: 3
timestamp: 2026-10-08T19-49-32Z
slug: src-app-jsx-asignarfolio
---
Target: «Asignar folio y entregar» en PrintFlow — `InvoiceModal` (src/App.jsx:9564 en la copia de hoy), el `MultiPaymentPicker` de adentro (7087) y lo que App hace al confirmar (las preguntas por facturas hechas por adelantado, el aviso que frena el efectivo, «Sí, ligar», los avisos). `PreInvoiceModal` fuera, salvo lo que comparte.
Evaluación A: revisor independiente (agente aparte, sin ver critiques anteriores; ~322k tokens), en el banco (127.0.0.1:5288) a 1366 y 1920, con mouse y teclado, más tres capturas de la app real (tests/salida/ligar-anticipo/). Evaluación B: el detector en 5 estados del banco (headless) y el escaneo de src/App.jsx. Los P1-1 y P1-2 se comprobaron además por separado (`.banco-critica-folio/b-verificar-p1.mjs`).

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Si la base rechaza al confirmar, el diálogo vuelve a «Confirmar» sin decir nada adentro; el error sale abajo, crudo, 7 s. |
| 2 | Lenguaje del mundo real | 3 | «Folio» es el fiscal y también la referencia del banco («Folio SPEI»); Corona tiene tres nombres; métodos como ids («transferencia + efectivo»); «6 día(s)». |
| 3 | Control y libertad | 2 | «Volver» cierra y «No pagada» borra los pagos sin preguntar (Esc y clic fuera sí preguntan). |
| 4 | Consistencia | 2 | El color del tipo choca con el del pago (verde = Remisión y Pagada; violeta = Factura y Parcial); «Continuar» cambia de color; «Volver» y «Atrás»; tres reglas de DESIGN.md sin cumplir. |
| 5 | Prevención de errores | 2 | Enter-Enter salta la vista previa y emite; la rueda del mouse cambia el monto (66004 → 66003.99). |
| 6 | Reconocer, no recordar | 2 | El total se teclea a mano; con dos pagos el «Falta $X» sale de la vista; el anticipo manda a otra pantalla con un folio de memoria. |
| 7 | Flexibilidad y eficiencia | 2 | Sin Ctrl+Enter; 18 Tab hasta «Continuar»; los métodos no responden a flechas; a 1920 sigue en 460 px y hace scroll. |
| 8 | Estética y minimalismo | 2 | Tarjetas de tipo de 140 px aun elegidas; tres niveles de cajas; «Otro» enciende cinco señales ámbar; el total tres veces en la vista previa. |
| 9 | Recuperarse de errores | 2 | Los del formulario, buenos; el de la base, crudo, 7 s y fuera del diálogo; un monto negativo sólo dice «incompleto». |
| 10 | Ayuda y documentación | 3 | Buena ayuda en contexto; la ⚠ de «Ref bancaria» se explica sólo en un title; la información más valiosa (el anticipo) llega tarde. |
| **Total** | | **23/40** | **Aceptable (20-27): necesita mejoras serias** |

## Anti-Patterns Verdict

**Revisión (LLM):** no es slop; es una herramienta interna con decisiones reales del negocio (vale VC, Corona, Cuadra, «Cliente no proporcionó folio»). Lo que haría dudar a quien usa Linear o Stripe: las tarjetas de tipo de 140 px que no se encogen al elegir, un arcoíris de métodos de pago cuyo color no significa nada, hasta tres recuadros teñidos apilados, y `ConfirmModal` con el triángulo ámbar aun para una buena noticia («Sí, ligar F-9135»).

**Detector (determinista):**
- Código (src/App.jsx): 7 hallazgos, ninguno dentro de la ventana. Arial en las plantillas de impresión (el vale, ~7055: deliberado para la impresora), Geist como «letra sobreusada» (es la letra del sistema según DESIGN.md: falso positivo en contexto) y tres transiciones de ancho/alto en otras pantallas (14617, 15171, 21062).
- En el navegador (5 estados: factura sin pagar, pagada, con efectivo, emisor caído, Corona a 1920): `flat-type-hierarchy` en todos (8 tamaños entre 10 y 16 px, razón 1.6:1), que coincide con el revisor: la jerarquía la cargan cajas y colores, no la letra. `tiny-text` en los estados con pagos (10-11 px; el 11 es decisión del sistema, el 10 junto al dinero no). `overused-font: Arial`: lo real son los dos «Eliminar» de cada pago, en Arial de 10 px (no declaran la letra); lo demás eran los botones simulados del banco. `gradient-text`: falso positivo conocido (el detector se marca a sí mismo).
- Overlays: ninguno visible para la persona; el detector corrió sin pantalla y se leyó su consola.

## Overall Impression

La vista previa es lo mejor de la ventana y dice qué, cuánto y a quién antes de lo irreversible. Pero se puede saltar con Enter-Enter, lo capturado se pierde desde dos botones comunes, y lo más valioso que sabe la base (que ese trabajo ya se facturó por adelantado) llega después de confirmar, con la ventana ya cerrada. La mayor oportunidad: que la ventana sepa del anticipo al abrir y que su botón principal diga lo que va a pasar («Ligar F-135 y entregar»).

## What's Working

1. **La vista previa dice qué, cuánto y a quién** («Vas a emitir Factura por $66,004.00 · con IVA · a PORTLAND STUDIO»), y el total del encabezado cambia con el tipo (con IVA / remisión sin IVA). «El folio no se adivina», bien hecho.
2. **No decide a ciegas si la red falla:** el emisor con tres estados y «Reintentar», los tipos apagados mientras carga el cliente («Recargar»), Corona y Cuadra con su antes y después.
3. **La aritmética del pago en vivo** («Capturado · Falta / Cubierto / Excede $3,996.00», con aria-live), centavos exactos, «usa Pagada» cuando la parcial cubre todo, y «¿Es efectivo? No lo pongas como «Otro»», que viene de un doble conteo real.

## Priority Issues

**[P1] Enter-Enter emite el documento fiscal sin leer la vista previa.** «Continuar» y «Confirmar» son el mismo botón: tras el primer Enter el foco queda en «Confirmar» y el segundo emite (comprobado dos veces: `onConfirm` 1 vez). Con el mouse se salva por suerte (el diálogo se encoge y el segundo clic cae en otro lado). Arreglo: al entrar a la vista previa, el foco va al título o a «Atrás»; «Confirmar» con su propio `key`; `escudoDeClics` de 500 ms; Ctrl+Enter sólo abre la vista previa (`aria-keyshortcuts`). Comando: /impeccable harden.

**[P1] Lo capturado se pierde sin preguntar desde dos botones comunes.** «No pagada» borra todos los pagos (al volver a «Pagada», el monto sale vacío y el pago 2 ya no existe) y «Volver» cierra directo (comprobado). Esc y el clic fuera sí preguntan. Arreglo: «Volver» → «Cancelar» por la misma pregunta que Esc; «No pagada» con pagos pregunta («¿Quitar los 2 pagos ($66,004.00)?») o los guarda para regresar a «Pagada». Comando: /impeccable harden.

**[P1] Lo que sabe la base llega tarde y fuera del diálogo.** Las facturas por adelantado se consultan hasta después de «Confirmar»: la vista previa promete «Factura por $8,630.40 · Pagada · efectivo» aunque F-9135 ya existe por ese importe; con el mismo importe la ventana se cierra antes de «Sí, ligar» (y «No, cancelar» pierde lo capturado); con otro importe, «Asignar el folio de todos modos» va en blanco sobre ámbar a 2.6:1. Y un error de la base sale crudo en un aviso de 7 s, sin role=alert, con el diálogo como si nada. Arreglo: leer las candidatas al abrir; con una del mismo importe, decirlo en el paso 1 y que el botón principal sea «Ligar F-9135 y entregar»; con otro importe, decirlo dentro del diálogo con el camino a «Facturar por partes»; los errores al pie con `errorEnPalabras` y role=alert, conservando lo capturado. Comandos: /impeccable clarify y /impeccable harden.

**[P2] Capturar un pago es manual, largo y frágil.** El monto nunca viene prellenado, queda bajo el pliegue a 1366 (cuerpo de 857 px en 619 visibles), es `type=number` y la rueda lo cambia (66004 → 66003.99; con «Parcial» pasaría en silencio), acepta 66004.004, y los 5 métodos se repiten por pago (~280 px cada uno); a 1920 sigue en 460 px de ancho y hace scroll. Arreglo: el primer pago con el total y los siguientes con lo que falta; campo de texto con inputmode decimal, 2 decimales y sin rueda; métodos en un control segmentado de una línea; el tipo elegido encogido a «Factura · F-137 · Cambiar»; a 1920, dos columnas. Comandos: /impeccable layout y /impeccable distill.

**[P2] El color del tipo choca con el del pago, el botón apagado no se lee ni dice por qué, y la letra se mezcla.** Remisión verde con parcial violeta se lee al revés; el verde vivo (reservado para «está pasando ahora») pinta Remisión y Efectivo; «No pagada», el caso normal a crédito, en ámbar de aviso. «Continuar» apagado a 1.69:1 sin decir qué falta; con Corona va en gris aunque esté activo. Los dos «Eliminar» de cada pago salen en Arial de 10 px y en negrita roja (DESIGN.md pide una «×» discreta). Arreglo: tipo en neutro o slate y el color sólo para el estado de pago; un color para la acción principal; botón apagado en `bt(C.sf,C.t2)` con su porqué en `C.wnInk`; «×» discreta con nombre accesible y la letra del sistema. Comandos: /impeccable colorize y /impeccable quieter.

## Persona Red Flags

**Karla (experta, ~84 entregas al mes):** sin atajos (Ctrl+Enter no hace nada); teclea «66004» copiándolo del encabezado; 18 Tab hasta «Continuar»; a 1366 baja con la rueda hasta el monto, y si el campo tiene el foco la rueda le cambia el dinero; con efectivo y un anticipo del mismo importe pasa por tres diálogos (aviso → Atrás → quitar el pago, y con un solo pago no hay «Eliminar»: tiene que cambiar a «No pagada» → Confirmar → «Sí, ligar»); el folio asignado le dura 3.2 s en un aviso; su costumbre de Enter-Enter emite sin leer.

**Sam (accesibilidad):** «No pagada / Parcial / Pagada» sin `aria-pressed` ni role (la elección sólo se ve por el borde); el aviso de éxito o error no se anuncia; `ConfirmModal` sin `aria-describedby`; los botones con role=radio no se mueven con flechas; el anillo de foco de la app (`rgba(74,101,114,.5)` sobre #fcfdfe) ronda 2.2:1, bajo el 3:1; textos de 9-10 px con contraste justo («SALDO ACTUAL (SIN IVA)» 9 px a 4.82:1).

**Riley (intentando romperlo):** monto negativo: «Capturado: $-66,004.00 · Falta $132,008.00» sin decir qué está mal; 66004.004 sale «Cubierto»; precio 0 con «Pagada»: «Total $0.00 ✓ Cubierto» pero no se puede completar; Corona con saldo negativo muestra «−$56,900.00» y «$-26,900.00» con signos distintos y deja seguir; con `?falla=1` el diálogo no cambia.

## Minor Observations

- La tarjeta promete «siguiente F-137» y la vista previa dice que el folio lo asigna el sistema al confirmar: con otra persona foliando puede salir otro.
- El encabezado de Corona nombra el modo («Facturado por adelantado (Corona)») en vez de la acción y el monto.
- Comillas mezcladas («» y "").
- «$ ESTADO DE PAGO *» en violeta y «TIPO DE COMPROBANTE» en gris.
- «No, cancelar» en «¿Cerrar sin asignar el folio?» es ambiguo: mejor «Seguir capturando».
- Las preguntas del anticipo y de «ligar» son párrafos centrados; DESIGN.md pide lista.
- El aviso cian usa #075985 escrito a mano, no un token.
- El aviso de cliente lento sale a los 5 s (DESIGN.md dice 8) y después deja seguir como cliente normal.
- La tercera tarjeta (Corona o Cuadra) no alinea su ícono con las otras dos.
- El total se repite en el encabezado, el bloque grande y el resumen.

## Questions to Consider

- ¿Y si la ventana ya supiera de F-9135 al abrir, y su botón principal dijera «Ligar F-9135 y entregar»?
- Si casi todo va «No pagada» a crédito, ¿por qué el caso normal va en ámbar y es un paso obligatorio, en vez de venir puesto con «Registrar un pago» como excepción?
- ¿Por qué el monto empieza vacío, si lo común es un pago por el total?
- ¿Para qué es la vista previa si Enter-Enter se la salta? ¿Debería ser un resumen pegado al botón, siempre a la vista?
- ¿El tipo de documento necesita color, si verde y violeta ya son estados de pago?
- ¿Qué necesita Karla en el segundo después de confirmar (el folio para la entrega, el vale para Tesorería), y por qué vive 3.2 s en un aviso?
