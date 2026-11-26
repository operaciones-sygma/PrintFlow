---
target: la fecha de entrega estándar en la forma de la orden y el detalle
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Marcelo\\Projects\\PrintFlow\\src\\App.jsx OrderForm fecha de entrega"
timestamp: 2026-11-08T10-14-03Z
slug: src-app-jsx-orderform-fecha-de-entrega
---
⚠️ DEGRADED: single-context (sin agentes: la regla de Marcelo pide OK escrito para usarlos; A y B corrieron en este contexto, A primero)

# Crítica: la fecha de entrega en la forma de la orden (PrintFlow)

Revisada en el banco (datos simulados) a 1366 y 1920: orden nueva, 20,000 piezas, cambiada a mano, vacía, 5.º producto de una OC; y la fila «Entrega» del detalle.

| # | Heurística | Calif. | Lo principal |
|---|---|---|---|
| 1 | Se ve qué pasa | 3 | La fecha se llena sola y la nota dice por qué; al pasar de 10,000 piezas brinca 2 días sin más marca que la nota. |
| 2 | Habla como la planta | 3 | «días hábiles», «si al cliente le urge»; la fecha va sólo en números, sin el día de la semana. |
| 3 | Control y salida | 3 | Se cambia, se borra, «Sugerir fecha» la regresa; abrir y cancelar no pregunta. |
| 4 | Consistencia | 2 | En una OC de 5, los primeros cuatro prometen el 19-nov y el quinto el 24-nov; el asterisco de «Entrega» se ve como punto. |
| 5 | Prevenir errores | 2 | Una fecha más corta que la estándar entra sin aviso; a libros/libretas/calendarios les promete 8 días y tardan 9 a 11. |
| 6 | Reconocer, no recordar | 2 | Al cambiarla, la estándar desaparece; la regla vive en el `title` de un botón. |
| 7 | Rapidez | 3 | Cero clics para lo normal; se teclea; Ctrl+Enter. |
| 8 | Limpieza | 3 | Una línea tranquila; en la OC, a 1920, baja a 4 renglones. |
| 9 | Recuperarse | 3 | «Falta la fecha de entrega: si no urge, «Sugerir fecha» pone la estándar» dice el arreglo; el aviso de fecha pasada no lo oye el lector. |
| 10 | Ayuda | 2 | No dice qué hacer cuando la fecha es más corta (a quién avisar) ni que los festivos no cuentan. |
| **Total** | | **26/40** | **Aceptable** |

**¿Hecha para SYGMA?** Sí en el contenido (días hábiles, piezas, productos de la OC); en lo visual usa la nota de ayuda del sistema, lo correcto en una pantalla de trabajo. **Detector:** 227 marcas en App.jsx (190 colores fuera de DESIGN.md), ninguna en la línea de la fecha (14729) ni en la fila del detalle (5278); dentro de la página, 41-42 marcas por caso, todas de toda la forma (etiquetas de 10-11 px, notas chicas —también la de la fecha—, letra Geist): decisiones de DESIGN.md que las críticas anteriores de la forma conservaron. Corrió en un navegador de pruebas, sin pestaña abierta para Marcelo.

**Impresión:** lo grande ya está (la forma propone una fecha y dice por qué). Lo que falla es la promesa: calla cuando alguien promete menos de lo que la planta suele lograr, y en dos tipos de trabajo la estándar misma promete de menos.

**Funciona:** la fecha nace llena y con su porqué; se recalcula mientras se captura y se detiene en cuanto alguien la toca; el error dice el arreglo y el detalle distingue «· estándar» de la pedida.

## Problemas

1. **[P1] Una fecha más corta que la estándar entra sin aviso.** Jun–oct: las fechas pedidas a 3 días hábiles o menos se cumplieron el 48% (77 órdenes); a 4–7 días, 58–63%; a 8 o más, 90%. Lupita promete sin saber el riesgo y nadie le avisa a Gerardo. **Arreglo:** abajo del campo, «Es antes de la estándar (jueves 19-nov): a 3 días, la mitad llegó a tiempo» con «Marcar urgente» y «Usar la estándar». (/impeccable harden)
2. **[P1] La estándar promete lo que la planta no cumple en dos casos.** Libros, libretas y calendarios: 22 órdenes, mediana 9 días, 59% tarde con la regla de hoy. OC de 5 o más: sus primeros cuatro productos 28% tarde (del 5.º en adelante, 5%), y la misma OC queda con dos fechas. **Arreglo:** +3 a esas categorías, y al entrar el 5.º producto, +3 a los primeros cuatro si nadie les cambió la fecha y no han entrado a máquina (9 de las 12 OC grandes se capturaron en menos de 2 horas; al entrar el quinto, 43 de los 48 anteriores no habían empezado). (/impeccable harden)
3. **[P2] La fecha sólo en números.** 19/11/2026 y «8 días hábiles», sin el día de la semana; el festivo del 16-nov se brinca sin decirlo. **Arreglo:** «Estándar: jueves 19-nov · 8 días hábiles (no cuenta el lunes 16, festivo)», y en el detalle «jue 19-nov · estándar». (/impeccable clarify)
4. **[P2] Al cambiarla, la estándar desaparece.** Queda «Sugerir fecha», que no dice qué fecha. **Arreglo:** siempre a la vista «La estándar: jueves 19-nov · Usar esa». (/impeccable clarify)
5. **[P3] Lo menor:** el asterisco parece punto; el aviso de fecha pasada no va ligado al campo (`aria-describedby`); el brinco de 2 días a las 10,001 piezas no se marca. (/impeccable polish)

**Por persona.** Lupita, con el cliente al teléfono: ve 19/11/2026 y tiene que sacar el día; si el cliente pide el miércoles, lo teclea y la forma calla. Gerardo, en la planta: «29-sep · estándar» no dice si el cliente pidió una fecha corta. Lector de pantalla: oye la nota de la estándar, no el aviso de fecha pasada; la regla de «Sugerir fecha» sólo en su `title`.

**Menores:** a 1920 la columna de la fecha es angosta; el formato del campo depende del idioma del navegador (el de pruebas mostró mes/día/año).

**Para pensar:** ¿y si la forma dijera la fecha como la dice Lupita al teléfono? ¿Una OC no debería tener una sola fecha?
