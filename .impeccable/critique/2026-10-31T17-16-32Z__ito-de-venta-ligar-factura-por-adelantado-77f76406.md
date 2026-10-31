---
target: el carrito de venta de inventario (ligar la factura hecha por adelantado, v10.84.168)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Marcelo\\Projects\\PrintFlow\\src\\App.jsx carrito de venta (ligar factura por adelantado)"
timestamp: 2026-10-31T17-16-32Z
slug: ito-de-venta-ligar-factura-por-adelantado-77f76406
---
Método: dos agentes aislados (A: revisión de diseño · B: detector y navegador). Costo real ~584 mil tokens (284 mil y 300 mil).

# Crítica: el carrito de venta de inventario de PrintFlow (`BulkSellModal`, src/App.jsx 6248-6747), lo nuevo de v10.84.168 (ligar la factura hecha por adelantado)

## Calificación: 24/40 · Aceptable

| # | Heurística | Puntos | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | El rechazo del ligado vive sólo en un aviso de 7 s y el carrito cambia a «Vender y facturar todo» sin decirlo; la lectura no tiene tope; a 1366 el botón apagado no dice por qué |
| 2 | Lenguaje de Karla | 3 | «emitir factura nueva» con una remisión; «de otro importe» cuando lo distinto es el tipo o el IVA |
| 3 | Control y libertad | 3 | Ida y vuelta, Reintentar, Ya revisé, Esc; los pagos capturados se esconden sin cifras |
| 4 | Consistencia | 2 | Las palabras de «Asignar folio y entregar», no sus reglas: tope de 8 s, error en la ventana, foco, porqué del botón apagado |
| 5 | Prevención de errores | 3 | Mismo tipo, importe y cliente, doble clic; tras un rechazo queda listo para emitir otra |
| 6 | Reconocer | 2 | A 1366 el importe de F-234 y el total no se ven juntos; «hace 2 días»; «y 9 más» no se abre; sin conceptos |
| 7 | Flexibilidad | 2 | Sin Ctrl+Enter; «cámbialo arriba» sin botón; scroll dentro del pie a 1366 |
| 8 | Estética | 2 | A 1366 hasta 5 recuadros teñidos; con 12 facturas, «otro importe» ocupa 215 de 421 px |
| 9 | Recuperación | 2 | El aviso de lectura caída es ejemplar; el rechazo del ligado no (efímero, foco perdido, sin siguiente paso) |
| 10 | Ayuda | 3 | Explica qué pasa al ligar y dónde van los cobros; «revisa los precios» guía mal |

## Veredicto de especificidad
Hecho para PrintFlow/SYGMA (el texto del caso real, violeta = folio, ámbar = problema, Geist Mono en montos, el error de lectura no es permiso). Lo genérico es la forma: recuadros apilados sobre un pie con scroll, y la pregunta se contesta con un párrafo en vez de una comparación. Oportunidad: los conceptos de la factura (conceptos_para_ligar_en_oc) contra los renglones del carrito.
Detector: 227 hallazgos en App.jsx; 1 en el alcance (design-system-color en 6526, el fondo rgba(0,0,0,.6) de 7 modales, de antes: falta documentarlo). El CLI no lee estilos en línea. En el navegador: tiny-text en 11/11.5 px (falso positivo: DESIGN.md define 11 px de cuerpo), 0 de contraste con el pase por píxeles, 0 desbordes. Inyección en las 11 corridas, en Chromium sin cabeza (sin pestaña [Human]).

## Lo que funciona
1. El botón y el folio dicen lo que pasa («Vender y ligar F-234», «Folio F-234 · ya existe: no se emite otro») y la caja nombra las consecuencias reales.
2. Un error de lectura no es permiso: tres estados, la respuesta tardía no pisa, «Reintentar» y «Ya revisé».
3. Pensado para Cuadra: el aviso de otro cliente dice a quién cambiar, «No es» con regreso, el motivo larguísimo se corta; todo lo nuevo pasa AA mezclado (4.63-5.02:1) y nada desborda.

## Problemas prioritarios
1. [P1] Si la base rechaza el ligado, el carrito se vuelve «Vender y facturar todo» sin decirlo (la caja desaparece, el botón queda habilitado, nada en la ventana, el foco al body): el duplicado que v10.84.168 vino a evitar. Arreglo: el rechazo en la ventana con role=alert y foco, el botón apagado hasta elegir «Es otra venta: emitir factura nueva», key por camino. /impeccable harden
2. [P1] A 1366 la decisión y su evidencia no caben: el botón nunca se ve sin bajar el pie (140-245 px), «F-234 por $47,560.00» y el total nunca juntos, el botón apagado (1.69:1) sin su porqué cerca. Arreglo: pie fijo fuera del scroll con total, botón y lo que falta; la comparación junto al botón; desplazar el pie a la caja al aparecer. /impeccable layout
3. [P2] Foco y anuncios: Enter en «No es», «Ligar» o «Reintentar» deja el foco en el body; las cajas nacen con su texto sin región viva previa; la lectura sin tope de 8 s («Revisando…» para siempre); el select nuevo sin anillo de foco (inp trae outline:none). /impeccable harden
4. [P2] Los pagos capturados se esconden sin monto, método ni referencia, y no se anotan; el selector de pagos activo mientras «Revisando…». /impeccable clarify
5. [P2] «De otro importe» mezcla tipo e IVA con importe (RS-41 remisión, F-234 por el subtotal sin IVA), «revisa los precios» empuja a mover precios, y con una remisión la salida dice «emitir factura nueva». /impeccable clarify

## Banderas rojas por persona
- Alex: sin Ctrl+Enter; scroll dentro del pie a 1366; «cámbialo arriba» sin botón; «otro importe» no se pliega.
- Sam: la caja sin anuncio y el foco al body; el botón cambia de nombre en el mismo nodo; el select sin foco visible; el botón apagado sin aria-describedby; Factura/Remisión sin aria-pressed y Vendedor/Cliente destino sin nombre accesible (de antes).
- Karla: comparar a 1366 bajando dentro del pie; el botón grande ya contesta la pregunta; con dos iguales se liga la más vieja si no ve el select; el pago capturado desaparece sin cifra; tras un rechazo le ofrece el duplicado; en una remisión el botón dice «factura».

## Observaciones menores
Dos iguales: el título sigue en singular y F-240 no enseña su motivo; «Folio F-234 · ya existe» repite la caja y la casilla de pagos es ámbar dentro de violeta; el tipo sigue activo con la caja; «hace N días» sin fecha ni saldo; «y 9 más» no se abre; «sin orden» contra «por adelantado»; a 1920 la ventana se mueve ~8 px al llegar la lectura. De antes: sin emisor exige la serie D- de Alpha; Factura/Remisión desborda 4 px; «Vendedor *» pierde su gris.

## Preguntas para pensar
¿Una comparación renglón contra renglón en vez de un párrafo? ¿La pregunta al elegir el cliente y el carrito armado desde la factura? Si el folio no se adivina, ¿por qué ligar es la respuesta por omisión?
