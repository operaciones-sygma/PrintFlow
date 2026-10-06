---
target: Folio por OC (AssignOCFolioModal), segunda pasada
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-10-06T06-46-19Z
slug: src-app-jsx-folioporoc
---
# Critique: Folio por OC (PrintFlow), segunda pasada (v10.84.42)

Target: `src/App.jsx`: AssignOCFolioModal (11786-12433). Visto en el banco `tests/banco/gen-oc.mjs` a 1366x768, 1920x1080 y
tablet 834, en 13 variantes, más dividir con 5 documentos y las dos preguntas antes de crear.

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|-----------|-------|-----------|
| 1 | Visibilidad del estado | 3 | El traslado, el saldo a favor y Corona llegan tarde y sin aviso: el contenido salta |
| 2 | Lenguaje de la persona | 3 | «hasta completar el ciclo fiscal», «(emisión SYGMA)», «en 1 documento · las facturas con IVA» |
| 3 | Control y libertad | 3 | «Eliminar Factura N» tira sus pagos capturados sin preguntar |
| 4 | Consistencia | 3 | Tres estilos de «seleccionado» en la misma ventana; la pregunta dice «documentos» y el botón «facturas» |
| 5 | Prevención de errores | 3 | El mismo hueco: eliminar un documento con pagos |
| 6 | Reconocer, no recordar | 3 | La pregunta de dividir sólo dice P-números |
| 7 | Flexibilidad | 3 | Arrastrar, «Mover a», «Una factura por orden», «Una por producto» |
| 8 | Estética y minimalismo | 3 | Segmentos rellenos que compiten con el botón principal; «El sistema pone el folio» en cada documento; con un documento, 2/3 de la rejilla vacíos |
| 9 | Recuperarse de errores | 3 | El porqué nombra el documento, pero no lo marca (un folio repetido no pone rojo ningún campo) |
| 10 | Ayuda | 3 | El renglón de cómo dividir, la nota del folio, Corona y el traslado |
| **Total** | | **30/40** | **Bueno** |

## Anti-Patterns Verdict

**Evaluación de diseño:** no parece hecha por IA. Es la misma familia que «Asignar folio» y «Facturar por partes»: grises fríos,
un acento, Geist, tintas para el estado, sin gradientes ni métricas de adorno. Lo que queda es de oficio, no de molde: tres
maneras de decir «seleccionado» y repeticiones en dividir.

**Detector (código):** 0 hallazgos en los 648 renglones del componente (no resuelve colores que llegan por token).

**Detector en la página (inyectado con Playwright, 7 variantes):** 7 a 11 por variante.
- Ya no hay contraste bajo ni texto en Arial: lo que la primera pasada encontró (1.4:1, 2.6:1, 4.2:1, 4.3:1, 25% en Arial)
  quedó arreglado.
- Real: un renglón de ~93 caracteres en pre-asignar (el aviso del bloqueo).
- Por diseño (DESIGN.md, escala compacta de 9 a 15 px y Geist como letra del sistema): «tiny-text», «flat-type-hierarchy»,
  «overused-font».
- Falso positivo: «gradient-text» (ningún elemento tiene `background-clip: text`).

**Overlays visuales:** no hay una pestaña que veas; el detector corrió en un navegador sin pantalla.

## Overall Impression

La ventana ya hace lo básico de un documento fiscal: dice cuánto y a quién, pregunta con cifras antes de crear, no pierde lo
capturado y se opera sin arrastrar. Lo que la separa de 35 es pulido de consistencia y de jerarquía. Hay tres estilos de
«seleccionado» y dos de ellos son rellenos que pesan lo mismo que «Crear la factura». Dividir repite lo que ya se sabe. Y un
campo obligatorio (la razón de pre-asignar) vive bajo el pliegue.

## What's Working

- **El pie que explica.** «Factura 2 no tiene órdenes: muévele alguna o elimínala.» junto al botón apagado: la persona nunca
  se queda sin saber qué falta.
- **La pregunta antes de crear** dice importe, receptor, productos y folios; el detector y la evaluación coinciden en que ya
  se lee.
- **«Una factura por orden»**: el caso común en un clic, con los folios consecutivos si van a mano.

## Priority Issues

- **[P2] Tres estilos de «seleccionado»** (pestaña elevada, relleno pleno, contorno teñido). Los rellenos de Tipo y Cuántos
  compiten con el botón principal. Arreglo: uno solo, el teñido con contorno (como el tipo de cada documento); el relleno
  pleno sólo para la acción. → /impeccable polish
- **[P2] La razón de pre-asignar es obligatoria y está al final, bajo el pliegue a 1366.** El pie pide «Escribe la razón» y no
  se ve dónde. Arreglo: el campo justo debajo del aviso del bloqueo, arriba. → /impeccable layout
- **[P2] «Eliminar Factura N» tira sus pagos capturados sin preguntar**, mientras «Una factura por orden» y cambiar el tipo sí
  preguntan. Arreglo: preguntar con cuántos pagos se pierden. → /impeccable harden
- **[P2] Dividir repite y deja huecos.** «El sistema pone el folio» va en cada documento; con un documento, 2/3 de la rejilla
  quedan vacíos y «Agregar otra factura» queda bajo el pliegue. Arreglo: decirlo una vez arriba y «Agregar» como celda de la
  rejilla. → /impeccable distill
- **[P2] La pregunta de dividir** centra cinco renglones (los importes no se alinean) y dice «documentos» cuando el botón dijo
  «facturas». Arreglo: lista alineada a la izquierda con los importes a la derecha, y el mismo sustantivo. → /impeccable clarify

## Persona Red Flags

**Karla o Dulce (lo hacen seguido):** con 5 órdenes «Una factura por orden» le ahorra todo, pero la pregunta final son cinco
renglones centrados que tiene que leer de lado a lado para comprobar importes.

**Marcelo pre-asignando a fin de mes:** el botón apagado dice «Escribe la razón de la pre-asignación» y el campo no está a la
vista: hay que bajar para encontrarlo.

**Teclado y lector de pantalla:** Tab, Esc y «Mover a» funcionan; los segmentos dicen aria-pressed. Sin hallazgos nuevos.

## Minor Observations

- El documento con el problema no se marca: un folio repetido no pone rojo ninguno de los dos campos.
- «hasta completar el ciclo fiscal» no dice qué tiene que pasar; «(emisión SYGMA)» sobra.
- La vista previa repite el total del encabezado (se gana cuando hay tercero: dice a quién).
- El traslado, el saldo y Corona aparecen tarde y empujan el contenido.

## Questions to Consider

- ¿Y si «seleccionado» se viera igual en toda la ventana, y el único bloque relleno fuera la acción?
- ¿Hace falta decir el folio en cada documento si siempre lo pone el sistema?
- ¿Y si la pregunta de dividir fuera una tablita: documento, órdenes, importe?
