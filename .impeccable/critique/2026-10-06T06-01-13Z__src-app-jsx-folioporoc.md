---
target: Folio por OC (AssignOCFolioModal)
total_score: 20
p0_count: 0
p1_count: 4
timestamp: 2026-10-06T06-01-13Z
slug: src-app-jsx-folioporoc
---
# Critique: Folio por OC (PrintFlow)

Target: `src/App.jsx`: AssignOCFolioModal (11776-12322) y lo que hace App al confirmar: `assignFolioToOC` (17974) y
`assignFoliosSplitOC` (18081). Visto en un banco nuevo (`tests/banco/gen-oc.mjs`: la ventana real con la base simulada) a
1366x768 y 1920x1080, en 13 variantes: simple, emisor apagado, emisor que falla, dividir, Corona, Cuadra con y sin traslado,
pre-asignar, saldo a favor y tablet.

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|-----------|-------|-----------|
| 1 | Visibilidad del estado | 2 | En modo simple no hay ni un importe en toda la ventana; si falla la consulta del emisor, pasa callada a captura manual |
| 2 | Lenguaje de la persona | 2 | «Factura (D-)» cuando el sistema emite F-; «inmutables»; «el bridge automático YA NO… (v10.57.0)»; «Factura #1» en un grupo de remisión; «Dividir en 1 facturas» |
| 3 | Control y libertad | 1 | Esc y el clic fuera tiran un plan de dividir con folios y pagos capturados, sin preguntar |
| 4 | Consistencia | 2 | Las ventanas hermanas ya son diálogo accesible, con pie fijo, ConfirmModal y tintas; ésta no. Tres estilos de «seleccionado»; botones en Arial; emojis 🔢 ⚠ junto a Phosphor |
| 5 | Prevención de errores | 2 | Crea N documentos fiscales con un clic, sin confirmar cuánto ni a quién; el folio sugerido F-137 se rechaza solo |
| 6 | Reconocer, no recordar | 2 | «5 pendientes» sin decir cuáles; en dividir, las fichas sólo dicen P-número y subtotal |
| 7 | Flexibilidad | 1 | Dividir sólo se puede arrastrando: sin teclado, sin táctil, sin «una factura por orden» |
| 8 | Estética y minimalismo | 3 | Limpia y dentro del sistema; ruido en los avisos de dividir y de Corona, fichas estiradas a 80 px |
| 9 | Recuperarse de errores | 2 | Mensajes secos en ámbar ilegible («Grupo 1: pagos exceden total»); el emisor que falla no tiene Reintentar |
| 10 | Ayuda | 3 | Cada modo dice qué hace; el traslado dice por qué no y dónde hacerlo |
| **Total** | | **20/40** | **Aceptable (borde bajo)** |

## Anti-Patterns Verdict

**Evaluación de diseño:** no parece hecha por IA. Es una herramienta de oficina dentro de «El Taller Ordenado»: grises fríos,
un acento, Geist, sin gradientes ni cards de métricas. Lo que la delata es la edad: se quedó atrás de sus hermanas («Asignar
folio» y «Facturar por partes», ya rehechas), y eso se nota en los detalles: emojis como íconos, colores plenos como texto,
textos de sistema («bridge», versiones) y un modo dividir que sólo se opera arrastrando.

**Detector (código):** 0 hallazgos sobre los 547 renglones del componente. Es el falso negativo de siempre: no resuelve colores
que llegan por token en estilos inline.

**Detector en la página (inyectado en el banco con Playwright, 6 variantes):** 5 a 11 hallazgos por variante.
- Reales, y tres que la evaluación de diseño no vio:
  - en modo dividir el 25% del texto sale en Arial: los botones «Factura», «Remisión» y las «×» de cada orden no heredan la
    fuente;
  - el error «Formato inválido» en rojo pleno da 4.3:1;
  - los folios ya asignados, en gris tenue sobre la superficie, 4.2:1;
  - el botón apagado (blanco sobre gris) da 1.4:1: no se lee qué haría.
- Reales y ya vistos: el naranja de pre-asignar y del traslado como texto, 2.6:1; un renglón de ~89 caracteres.
- Por diseño (DESIGN.md: escala compacta de 9 a 15 px): «tiny-text» y «flat-type-hierarchy».
- Falso positivo: «gradient-text»; ningún elemento de la página tiene degradado ni `background-clip: text`.

**Overlays visuales:** no hay una pestaña que veas; el detector corrió dentro de un navegador sin pantalla y lo de arriba es lo
que reportó.

## Overall Impression

Hace bien lo difícil (validar que un plan de dividir cuadre, ligar la factura hecha por adelantado en vez de acuñar otra, el
traslado después del folio) y mal lo básico de un documento fiscal: nunca dice cuánto, no confirma antes de crear, y si algo
falla o se cierra por accidente, se pierde el trabajo o se queda sin salida. La mayor oportunidad: que esta ventana diga lo
que va a pasar, con importes, como ya lo dicen «Asignar folio» y «Facturar por partes».

## What's Working

1. **La validación de dividir es seria.** No deja confirmar con órdenes sin asignar, folios repetidos, pagos que no cuadran o
   «pagada» con subtotal cero, y el botón dice por qué está apagado.
2. **No duplica facturas.** Si la OC ya se facturó por adelantado, en vez de acuñar otro folio ofrece ligar la que existe (la
   lección de OC-0877), y el traslado de Cuadra va después del folio, en su propio intento, con los casos «se timbró» y «no
   sabemos» bien distinguidos.
3. **El total con IVA por grupo** en dividir: es la cifra que Karla compara contra la OC.

## Priority Issues

**[P1] Crea documentos fiscales sin decir cuánto ni pedir confirmación**
- Por qué importa: es el principio «El folio no se adivina». En modo simple no aparece ni un importe; un clic acuña el folio
  (o N, en consecutivos) y crea los documentos en CobranzaFlow. Ni App ni la ventana confirman.
- Arreglo: el encabezado con el cliente y el total (con IVA en factura); la lista de lo que entra (producto, cantidad,
  importe); la vista previa «Factura por $111,627.38 con IVA a PORTLAND STUDIO», también con el emisor encendido; y un
  ConfirmModal antes de la RPC con folio(s), importes, receptor (tercero) y traslado.
- Comando: /impeccable clarify + /impeccable harden

**[P1] Si falla la consulta del emisor, la ventana queda sin salida**
- Por qué importa: pasa callada a captura manual con la serie de Alpha (D-/R-), sugiere F-137 y lo rechaza: «Debe ser
  D-NNNN». Es el mismo bug que se arregló en «Asignar folio» (v10.84.34).
- Arreglo: el emisor en tres estados (consultando, sí/no, «no se pudo confirmar» con Reintentar), y Asignar apagado mientras
  no se sepa; en manual, aceptar la serie que corresponde.
- Comando: /impeccable harden

**[P1] Dividir sólo se opera arrastrando**
- Por qué importa: sin teclado, sin pantalla táctil y sin lector de pantalla no se puede dividir una OC. Y con muchas órdenes,
  arrastrar una por una es lento.
- Arreglo: en cada ficha, «Mover a: Factura 1 · 2 · 3» con botones o un selector; las fichas enfocables; y un atajo
  «Una factura por orden». Arrastrar se queda como extra.
- Comando: /impeccable adapt

**[P1] Se pierde el trabajo y la ventana no se comporta como diálogo**
- Por qué importa: Esc o un clic fuera tiran un plan de dividir con folios y pagos capturados, sin preguntar. Cambiar el tipo
  usa `window.confirm`. No es `role="dialog"`: Tab se escapa al tablero de atrás. Sin pie fijo: con Corona en dividir, a 1366
  los botones quedan bajo el borde.
- Arreglo: el patrón de v10.84.34: «capturado» (el clic fuera no cierra y Esc pregunta), ConfirmModal, `role="dialog"` +
  `aria-modal` + `aria-labelledby` + `atraparTab`, y el pie fijo con el error y los botones.
- Comando: /impeccable harden

**[P2] Textos y color que no pasan, o dicen otra cosa**
- Por qué importa: el texto de estado en el color pleno no pasa AA: el verde de «ya facturados», el ámbar del aviso de
  dividir, el naranja de pre-asignar y del traslado. Los botones de Remisión y de Pre-asignar llevan blanco sobre verde o
  naranja. Y los textos hablan de otro tiempo o de otro: «Factura (D-)», «capturado por Karla, verificado contra AlphaERP»,
  «bridge… (v10.57.0)», «Factura #1» en una remisión, «Dividir en 1 facturas», «inmutables».
- Arreglo: las tintas (`C.okInk`, `C.wnInk`, `C.dnInk`) y los botones en tinta; textos que digan lo de hoy; Phosphor en vez de
  🔢 ⚠; `fontFamily: inherit` en los botones del grupo.
- Comando: /impeccable clarify + /impeccable polish

## Persona Red Flags

**Karla (folia y entrega; usuaria principal):** abre la OC de PORTLAND con 5 productos y no ve cuánto va a facturar ni cuáles
son. Le da «Asignar Factura» y ya: se crearon los documentos, sin un «¿seguro?» con cifras. Si un día falla la consulta del
emisor, le sugiere F-137 y se lo rechaza. Arma un dividir de 3 facturas con pagos, se le va un Esc y lo pierde todo.

**Sam (teclado y lector de pantalla):** no puede dividir: mover órdenes sólo se hace arrastrando. El lector no anuncia un
diálogo. Las «×» de cada orden miden 14 px y se llaman «Quitar op0» (el id interno, no la P-0610). El ámbar del aviso y el
naranja del traslado no se leen.

**Alex (usuario experto):** para dividir 8 órdenes en 8 facturas arrastra 7 fichas una por una; no hay «una por orden» ni
atajos.

## Minor Observations

- `C.t1` no existe en los tokens: el título del traslado hereda su color por accidente.
- Con un solo grupo, las fichas de órdenes se estiran a 80 px de alto.
- La razón de pre-asignar sale con borde rojo antes de que la persona escriba.
- Los botones de tipo dentro de cada grupo van a 10 px: blanco chico para un clic que borra pagos.
- «Folios ya asignados» lista folios sin decir de qué producto.
- Los avisos de éxito usan emojis (📄 🔒 🚚); es algo de toda la app.

## Questions to Consider

- ¿Y si el modo simple fuera un recibo: la lista de lo que entra, con importes, y el total arriba?
- ¿Hacen falta «folios consecutivos» ahora que el sistema acuña cada folio, o lo cubre «una factura por orden» en dividir?
- ¿Y si dividir se armara palomeando qué va en cada factura, en vez de arrastrando?
