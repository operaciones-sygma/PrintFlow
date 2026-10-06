---
target: Folio por OC (AssignOCFolioModal), cuarta pasada
total_score: 39
p0_count: 0
p1_count: 0
timestamp: 2026-10-06T16-40-10Z
slug: src-app-jsx-folioporoc
---
# Critique: Folio por OC (PrintFlow), cuarta pasada (v10.84.44)

Target: `src/App.jsx`: AssignOCFolioModal. Visto en el banco `tests/banco/gen-oc.mjs` a 1366x768, 1920x1080 y tablet 834:
13 variantes, dividir con 1 y con 5 documentos, y las preguntas antes de crear.

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|-----------|-------|-----------|
| 1 | Visibilidad del estado | 4 | n/a: no deja crear mientras llegan el saldo y el traslado, y lo dice; con la base colgada, tope de 8 s |
| 2 | Lenguaje de la persona | 4 | n/a: una sola palabra, «producto» |
| 3 | Control y libertad | 4 | n/a: «Todo en una factura» deshace «Una factura por producto» de un clic |
| 4 | Consistencia | 4 | n/a |
| 5 | Prevención de errores | 4 | n/a: un clic rápido ya no se salta la opción del traslado |
| 6 | Reconocer, no recordar | 4 | n/a |
| 7 | Flexibilidad | 4 | n/a: arrastrar, «Mover a», los atajos de ida y vuelta, Ctrl+Enter |
| 8 | Estética y minimalismo | 3 | Simple apila tres recuadros (nota del folio, vista previa, tercero) y la vista previa repite el total |
| 9 | Recuperarse de errores | 4 | n/a |
| 10 | Ayuda | 4 | n/a: «Pasar a Dividir» donde se decide; la pista de Dividir según 1 producto, 1 documento o varios |
| **Total** | | **39/40** | **Excelente** |

## Anti-Patterns Verdict

**Evaluación de diseño:** no parece hecha por IA. Es de la familia «El Taller Ordenado»: un bloque relleno (la acción), lo
seleccionado teñido, tintas para el estado, Geist y números en Geist Mono.

**Detector (código):** 0 hallazgos en los 727 renglones del componente.

**Detector en la página (inyectado con Playwright, 7 variantes):** sólo lo que es por diseño (DESIGN.md: escala compacta de 9 a
15 px, Geist: «tiny-text», «flat-type-hierarchy», «overused-font») y el falso «gradient-text» (el único `background-clip` de la
app es `content-box` en las barras de scroll). El renglón largo que marcó en pre-asignar (el aviso del bloqueo, que esta
versión había alargado) se acortó y ya no sale.

**Overlays visuales:** no hay una pestaña que veas; el detector corrió en un navegador sin pantalla.

## Overall Impression

De 20 a 39 en cuatro pasadas. Lo último no era de pantalla sino de confianza: con Cuadra se podía crear la factura antes de que
apareciera la opción del traslado, y una red colgada dejaba «Revisando…» o «Consultando…» para siempre. Lo que queda es
pulido de Simple: tres recuadros donde basta uno.

## What's Working

- **Una sola palabra y un solo «seleccionado»**: lo que se aprende en Simple sirve en Dividir.
- **Los atajos de ida y vuelta**: «Una factura por producto» y «Todo en una factura» se alternan, y Ctrl+Enter abre la misma
  pregunta que el botón (nunca crea sin ella).
- **La ventana no se queda esperando**: lo que no llega a los 8 s sigue su camino de error, con «Reintentar» donde aplica.

## Priority Issues

- **[P3] Tres recuadros en Simple**: la nota del folio, la vista previa («Factura por $X a CLIENTE», que repite el total del
  encabezado) y el tercero. Juntar la nota del folio con la vista previa en uno solo. → /impeccable distill

## Persona Red Flags

**Karla o Dulce:** Ctrl+Enter y los dos atajos le ahorran clics; nada nuevo en contra.

**Quien factura a Cuadra:** antes, un clic rápido creaba la factura sin ofrecer el traslado; ya no.

**Teclado y lector de pantalla:** el botón principal declara `aria-keyshortcuts="Control+Enter"`; «Pasar a Dividir» es un botón.

## Minor Observations

- En Dividir, la nota del folio ocupa un recuadro entero para una línea.

## Questions to Consider

- ¿La vista previa de Simple debería existir sólo cuando dice algo que el encabezado no (un tercero, un folio a mano)?
