---
target: Folio por OC (AssignOCFolioModal), tercera pasada
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-10-06T07-40-07Z
slug: src-app-jsx-folioporoc
---
# Critique: Folio por OC (PrintFlow), tercera pasada (v10.84.43)

Target: `src/App.jsx`: AssignOCFolioModal y `ConfirmModal` (su `detalle`). Visto en el banco `tests/banco/gen-oc.mjs` a
1366x768, 1920x1080 y tablet 834: 13 variantes, dividir con 5 documentos y las dos preguntas antes de crear.

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|-----------|-------|-----------|
| 1 | Visibilidad del estado | 3 | El saldo a favor, Corona y el traslado llegan tarde y empujan el contenido |
| 2 | Lenguaje de la persona | 4 | n/a: el aviso del bloqueo dice lo que la base hace; sin «(emisión SYGMA)» |
| 3 | Control y libertad | 4 | n/a: eliminar con pagos pregunta y el doble clic en la papelera borra uno |
| 4 | Consistencia | 3 | «Una por producto» (Simple) y «Una factura por orden» (Dividir) hacen lo mismo con dos nombres |
| 5 | Prevención de errores | 4 | n/a |
| 6 | Reconocer, no recordar | 4 | n/a: los productos en la ficha y en la pregunta |
| 7 | Flexibilidad | 3 | Varios caminos (arrastrar, «Mover a», un clic), sin atajos |
| 8 | Estética y minimalismo | 3 | Cada ficha lleva «Mover a…» y «×», y «×» repite «Mover a → sin documento» |
| 9 | Recuperarse de errores | 4 | n/a: el documento con el problema se marca y el pie dice el arreglo |
| 10 | Ayuda | 3 | No dice cuándo conviene Dividir contra «Una por producto» |
| **Total** | | **35/40** | **Bueno (borde alto)** |

## Anti-Patterns Verdict

**Evaluación de diseño:** no parece hecha por IA. Simple quedó en calma: el único bloque relleno es «Crear la factura». Dividir
se lee como un tablero de documentos con la celda «Agregar» donde va el siguiente.

**Detector (código):** 0 hallazgos en los 702 renglones del componente.

**Detector en la página (inyectado con Playwright, 7 variantes):** 7 a 11 por variante, todos por diseño o falsos.
- El renglón largo de pre-asignar desapareció (el aviso nuevo es más corto).
- Por diseño (DESIGN.md: escala compacta de 9 a 15 px, Geist): «tiny-text», «flat-type-hierarchy», «overused-font».
- Falso positivo: «gradient-text». El único `background-clip` de la app es `content-box` en las barras de scroll.

**Overlays visuales:** no hay una pestaña que veas; el detector corrió en un navegador sin pantalla.

## Overall Impression

La ventana pasó de crear documentos fiscales a ciegas (20/40) a una que dice cuánto, a quién y qué, pregunta con una lista
alineada antes de crear, no pierde lo capturado y marca dónde está el problema. Lo que queda es de vocabulario y de ruido en
las fichas de dividir, no de confianza.

## What's Working

- **La pregunta antes de crear** es una lista: cada documento con sus productos, el importe alineado y el total a quién.
- **Un solo bloque relleno**: la jerarquía se lee de un vistazo; lo seleccionado se distingue sin competir con la acción.
- **El problema tiene lugar**: el pie lo dice, el documento lleva el borde rojo y los folios repetidos se marcan en los dos.

## Priority Issues

- **[P3] Dos nombres para lo mismo**: «Una por producto (5)» en Simple y «Una factura por orden» en Dividir. Elegir una
  palabra (la de la OC es «producto»). → /impeccable clarify
- **[P3] «×» repite «Mover a → sin documento»** en cada ficha de dividir. → /impeccable distill
- **[P3] Llegadas tarde**: el saldo, Corona y el traslado aparecen después y empujan el contenido. → /impeccable polish

## Persona Red Flags

**Karla o Dulce:** con 5 órdenes, «Una factura por orden» y la lista de la pregunta le dejan comprobar cada importe en segundos.
Ninguna bandera nueva.

**Marcelo pre-asignando:** la razón está arriba, junto al aviso; el pie dice qué falta. Ninguna bandera nueva.

**Teclado y lector de pantalla:** «Agregar otra factura» es un botón y entra en el orden de Tab; los segmentos dicen
aria-pressed. Sin hallazgos.

## Minor Observations

- La vista previa de Simple repite el total del encabezado (se gana cuando hay tercero: dice a quién).
- Tres renglones de texto antes de la rejilla en Dividir (encabezado, cómo dividir, el folio del sistema).

## Questions to Consider

- ¿Hace falta «Una por producto» en Simple si Dividir lo hace de un clic y además deja capturar pagos?
- ¿Y si la ficha sólo tuviera «Mover a…», con «sin documento» como su última opción?
