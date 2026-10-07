---
target: "DetailModal (PrintFlow: el detalle de la orden, quinta pasada, revisor independiente)"
total_score: 23
p0_count: 0
p1_count: 3
timestamp: 2026-10-07T04-06-55Z
slug: src-app-jsx-detailmodal
---
# Critique: el detalle de la orden (DetailModal), quinta pasada, v10.84.48 en producción

Evaluación A por un **revisor independiente** (un agente que no vio las critiques anteriores ni sus números). Revisó 6 roles a
1366 y 2 a 1920, y probó con su propio Playwright, con las escrituras cortadas, Tab, Esc, Ctrl+Enter, «Más», el clic fuera y el
historial con error 500. La Evaluación B (detectores) la hice yo, aislada. **Las cuatro pasadas anteriores (23, 37, 38 y 35)
las califiqué yo mismo después de arreglar lo que yo había encontrado: estaban infladas.**

## Calificación de salud (Nielsen)

| # | Heurística | Nota | Lo principal |
|---|---|---|---|
| 1 | Estado del sistema | 2 | El detalle sabe menos que la ficha: no dice RETRASO (P-0583), «Reimprimir · v1 obsoleta» (P-0554), «Falta precio y costo» (P-0598), qué máquina ni cuánto lleva (P-0591), ni quién la tiene |
| 2 | Lenguaje real | 2 | El importe es sin IVA y no lo dice; «ID interno OP-MUV…» lo ven todos; «Asignado por karla», «1 pzas»; las secciones en el mismo orden para todos los roles |
| 3 | Control y libertad | 3 | Esc por pila, clic fuera y el foco que regresa; pero toda acción cierra el detalle antes de abrir su diálogo: con Esc en «Asignar folio», Karla queda en el tablero con el foco en el body |
| 4 | Consistencia | 2 | La ficha y el detalle tienen juegos de acciones distintos; las etiquetas cambian («El cliente no pide factura» y «Poner en espera: no ha pedido factura»; «Ya pidió factura · Reactivar» y «Quitar espera»); un botón apagado se pinta como activo |
| 5 | Prevención de errores | 3 | Ctrl+Enter pregunta y nunca crea; lo raro en «Más» con su consecuencia. Fallan «Cancelar» junto a «Cancelar con NC» y el «#HEX» de Pantone, que guarda en el catálogo de todos mientras se teclea (con 3 caracteres ya guarda) |
| 6 | Reconocer, no recordar | 2 | Hay que recordar qué acción vive en la ficha y cuál en el detalle; el porqué de lo apagado sólo en el `title` |
| 7 | Flexibilidad | 2 | Ctrl+Enter, Tab y Esc sí; no hay orden siguiente/anterior ni copiar folio, RFC o teléfono; «Más» es `role=menu` y las flechas no mueven el foco |
| 8 | Estética | 3 | Encabezado ejemplar; cuerpo plano («CLIENTE» y «CONTACTO» se ven igual: 10 px/600 en mayúsculas); a 1366 se ven 413 de 667 px del cuerpo |
| 9 | Recuperación de errores | 2 | El historial que falla dice «Sin cambios registrados todavía» (error = vacío); toasts con `error.message` crudo |
| 10 | Ayuda | 2 | Las líneas de «Más» y «Arrastra esta orden a…» ayudan; Ctrl+Enter y el porqué de lo apagado, sólo en tooltip |
| **Total** | | **23/40** | **Aceptable** |

## Veredicto de anti-patrones

**Revisor**: no parece hecho por IA. La paleta es contenida, usa Geist y Geist Mono, y no hay degradados, vidrio ni número
gigante. Lo que delata: dos «Cerrar» (la × y el botón), secciones que se ven igual que los rótulos, el pie con cinco estilos
de botón y campos sueltos («#HEX», «+ nombre interno») en una vista de lectura.

**Detectores**: `detect.mjs` sobre el código del componente, 0 hallazgos. El detector dentro de producción (6 casos):
- `gradient-text` en los 6 es **falso positivo**: el detector se marca a sí mismo (su código inyectado tiene ese texto); sale
  igual en una página vacía.
- `overused-font` (Geist) es la fuente de la familia, según DESIGN.md.
- `tiny-text` en 2 de 6: «Nombre interno» a **9 px** (el más chico y distinto de los demás rótulos, que van a 10 px), el botón
  «Historial de cambios» a 10 px y valores en pastilla a 10-11 px. Coincide con lo que el revisor vio a ojo: el cuerpo plano
  y los rótulos que no se distinguen de las secciones.

## Impresión general

El encabezado y el pie ya están bien hechos. El problema de fondo es otro: **el detalle es un segundo tablero que sabe y puede
menos que la ficha**, y se va justo cuando empieza la decisión (foliar, cancelar).

## Lo que funciona

1. El encabezado: quién, qué, cuánto, cuándo y folio en unos 100 px, con el dinero en Geist Mono.
2. El pie fijo fuera del scroll, con una sola acción rellena por rol. Ctrl+Enter abre la pregunta, el Tab queda atrapado y
   el foco regresa a la ficha y a «Más».
3. «Más» con la consecuencia de cada acción en su línea, color por riesgo y divisor antes de lo destructivo; la guía
   «Arrastra…» se conserva cuando el rol no tiene botón.

## Problemas prioritarios

1. **[P1] El detalle sabe menos que la ficha.**
   - Por qué importa: lo detenido no se ve donde se mira.
   - Arreglo: la fila de alertas de la ficha (RETRASO, falta precio, reimprimir) bajo el título, con los mismos badges; «Le
     toca a X» con «Recordar a X»; la máquina y el tiempo en la etapa junto al badge.
   - Comando: `/impeccable layout`.
2. **[P1] Dos juegos de acciones.**
   - Sólo en la ficha: Cancelar orden, Borrar, Poner en espera, Duplicar, Cambiar OC, Merma, Nota rápida, Recordar.
   - Sólo en el detalle: Folio anticipado, Liberar folio, Devolver saldo, Deshacer cancelación.
   - Arreglo: una sola definición de acciones, con las mismas palabras en los dos lugares.
   - Comando: `/impeccable distill`.
3. **[P1] Un botón apagado que parece vivo.**
   - Dónde: «Recibimos el Trabajo», con precio o costo faltante.
   - Qué pasa: se ve gris oscuro sólido, con cursor de mano y Ctrl+Enter asignado. El porqué está sólo en el title.
   - Arreglo: `bt(C.sf,C.t2)` como pide DESIGN.md, una línea en `C.wnInk` («Falta precio cliente y costo proveedor») y
     «Editar maquila» como la rellena.
   - Comando: `/impeccable harden`.
4. **[P2] Abrir una acción destruye el detalle.**
   - Qué pasa: el detalle se cierra antes de abrir el diálogo de la acción; con Esc o «Volver» no se regresa a la orden.
   - Arreglo: abrir la acción encima del detalle y volver a él; mientras, el RFC y el contacto en «Asignar folio».
   - Comando: `/impeccable harden`.
5. **[P2] La cancelación con nota de crédito se contradice.**
   - Qué pasa:
     - el menú dice «genera una nota de crédito pendiente» y el diálogo dice «esto no emite ninguna»;
     - tiene dos botones con el mismo verbo y termina en un `confirm()` del navegador;
     - no tiene `role=dialog`.
   - Arreglo: un ConfirmModal con `detalle` (folio, importe, pagada) y botones «No cancelar» / «Cancelar P-0554 · F-117».
   - Comando: `/impeccable clarify` (es de «puertas de cancelar»).

## Banderas rojas por persona

- **Karla en Salidas**:
  - el importe sin «+ IVA»;
  - el RFC genérico XAXX010101000 sin aviso;
  - el detalle se va al foliar;
  - «Quitar espera» aquí y «Ya pidió factura · Reactivar» en la ficha.
- **Germán en CTP**:
  - no dice cuántas placas ni de qué tamaño;
  - mover la orden es sólo arrastrando (difícil en tablet);
  - el «#HEX» sin rótulo escribe en el catálogo de todos.
- **Producción**:
  - «Máquina» sin decir cuál;
  - las notas al fondo;
  - «Empaque» es un sustantivo en un botón;
  - «Regresar» va relleno en la ficha y escondido en el detalle.
- **Vendedor**: con una orden ajena sólo ve «Cerrar», sin decir por qué; no responde «¿en qué va?».
- **Marcelo**:
  - «Imprimir» de principal sobre una copia obsoleta;
  - sin importe cuando no hay precio, sin decirlo;
  - no puede cancelar ni borrar desde el detalle.

## Observaciones menores

- Contraste del historial:
  - el antes y después va en rojo y verde plenos a 10 px;
  - «1d 1h» va en ámbar pleno;
  - el historial lleva un riel izquierdo de 2 px.
- El foco al abrir cae en el contenedor, no en la acción.
- «Nombre interno» llega tarde (la pantalla salta) y encabeza el cuerpo para producción.
- A los 500 ms de descargar el archivo pregunta si se borra del servidor.
- Admin en borrador ve «Editar specs» y «Editar» juntos.

## Preguntas

- ¿Y si el detalle fuera un panel lateral con ↑/↓ entre órdenes, que no tape el tablero ni se cierre al actuar?
- ¿Y si la ficha y el detalle salieran de una sola definición de alertas y acciones?
