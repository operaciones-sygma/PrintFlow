---
target: Las puertas de cancelar (PrintFlow), tercera pasada sobre v10.84.74 (cierra)
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-10-12T11-43-51Z
slug: src-app-jsx-cancelar
---
Target: «las puertas de cancelar» en PrintFlow, v10.84.74 (`VentanaDeCancelar` y sus cuatro ventanas, con sus montajes en App). Tercera pasada: la que cierra.
Evaluación A: revisor independiente nuevo (agente aparte, ~339k tokens, 91 herramientas, ~19 min; no vio las revisiones anteriores) en el banco `.banco-revisor-cancelar/` con 8 scripts y capturas en `revisor3/`: las 18 puertas a 1366×768, 683×384, 683×340 (la laptop al 200 % con la barra del navegador) y 1920×1080; Tab, Esc, clic fuera, arrastre, Enter y Ctrl+Enter, doble clic, `falla=1`, `lento=20`, `fac=*`, `saldo=*`, los cambios en vivo, contraste, basura en el motivo, radios con flechas y el botón que se mueve con lo tardío. Evaluación B: el detector en 10 estados.

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | «Revisando…», tope, «Reintentar», «Cancelando…» y el aviso de los 10 s; pero en la del folio, si el folio cambia, se vuelve a leer sin avisar; y a 683 px no se ve ni el título. |
| 2 | Lenguaje del usuario | 3 | Cifras con «con IVA/sin IVA» y nombres reales; para quien suple queda jerga («timbrada ante el SAT», «de Alpha y se ligó después», «bolsa», «plan matriz», «con saldo 0»). |
| 3 | Control y libertad | 3 | Volver, Esc y el fondo preguntan; el rechazo deja lo escrito. Tras «clic fuera → Seguir aquí» el foco va al panel, no al campo. |
| 4 | Consistencia | 2 | En la de la orden con la factura de toda su OC, el botón dice lo contrario que el cuerpo; el mismo «restar» se nombra distinto en dos ventanas; «no se puede» va como botón quitado en una y apagado en otra; las indicaciones nombran botones que se llaman de otra forma. |
| 5 | Prevención de errores | 3 | Espera la lectura antes de dejar cancelar, frena lo timbrado cuando lo sabe, un doble clic llama una vez, lo que cambia en vivo bloquea. Huecos: a 683 px no se ve lo que cae; una respuesta tardía mueve el botón destructivo bajo el cursor; «.....» pasa como motivo. |
| 6 | Reconocer, no recordar | 3 | Casi todo con cifras; «¿está timbrada?» de partes, plan y agrupada hay que verlo en CobranzaFlow. |
| 7 | Flexibilidad y eficiencia | 2 | Teclado completo y el motivo pasa a «Cancelar con su folio»; pero cada «siguiente paso» es texto, no un camino («Inventario → Ajustar», «Cancelaciones», «Cancelar la parte», «Cancelar línea»). |
| 8 | Estética y minimalismo | 3 | Marco limpio, el rojo sólo en lo destructivo; ruido: renglones que no dicen nada, estados bloqueados con renglones que ya no aplican, el «si…» en ámbar como lo más fuerte de la parte, huecos reservados. |
| 9 | Recuperarse de errores | 3 | El rechazo adentro, en palabras, con el foco y lo escrito; no dice el siguiente paso; queda un renglón viejo cuando se libera el folio. |
| 10 | Ayuda y documentación | 3 | Cada renglón explica y el pie dice qué falta; sin explicación de términos ni enlace a donde manda ir. |
| **Total** | | **28/40** | **Bueno** (en la orilla) |

## Anti-Patterns Verdict

**Revisión (LLM):** no parece de IA: diálogo de producto sobrio, voz local («Les avisamos a Lupita y a Karla», «Corre en GTO 1 Color: sale de la máquina y empieza P-0716»). Rasgos menores: un ícono en cada renglón aunque no signifique nada, el ⊗ rojo en todos los títulos, y prosa encadenada con dos puntos.

**Detector (10 estados):** nada dentro de las ventanas (lo que marca es del cascarón del banco).

## What's Working

1. El marco aguanta que lo traten de romper (medido en las cuatro): Tab atrapado, Esc y el fondo preguntan con texto y el segundo Esc regresa al campo, el arrastre no cierra, el doble clic llama una vez y al abrir no cierra, trabajando `aria-busy` y el foco al panel, el rechazo con `role=alert`.
2. Dice lo que hace además de cancelar, con cifras y nombres; todo el texto ≥4.9:1, el botón rojo 6.47:1.
3. Lo que cambia en vivo se dice: el folio que llega (y Dirección salta a «Cancelar con su folio» con el motivo), la otra parte cancelada, el saldo que llega tarde.

## Priority Issues

### [P1] En la laptop al 200 %, las ventanas con más en juego abren desplazadas más allá del título y de lo que cae
En la de la orden facturada a 683×384, `scrollTop` 165: no se ven ni el título ni «Ya está facturada por partes… F-150»; a 683×340, lo mismo en la del plan matriz, la línea, el grupo pagado y la del folio que corre. Marcelo escribe el motivo y cancela sin haber visto qué facturas caen. (El foco en el motivo, de v10.84.74, desplaza el cuerpo.)
Arreglo: enfocar con `preventScroll` y dejar el cuerpo arriba; o el motivo en el pie fijo.

### [P1] La de la orden con la factura de toda su OC: el botón dice lo contrario que el cuerpo
El cuerpo: «Va en F-200, la factura de toda su OC… no se cancela; se le resta esta orden»; el botón: «Cancelar la orden y sus facturas» (también con «sin factura viva» y con la lectura fallida). La etiqueta y el renglón leen campos distintos.
Arreglo: un solo cálculo del desenlace que lean los dos: «Cancelar la orden y restarla de F-200».

### [P2] Una respuesta tardía mueve el botón destructivo bajo el cursor
Corona con el saldo a los 9.5 s: el cursor sobre «Volver» queda sobre «Cancelar y regresar el saldo» (Volver se recorre 65 px y baja 16).
Arreglo: el escudo cuando lo tardío cambia la acción, y «Volver» en un lugar fijo.

### [P2] Lo definitivo pesa poco y la hipótesis pesa mucho
«No se deshace desde PrintFlow» nunca tiene renglón propio; en la de la parte lo primero y más fuerte es «Si F-128 ya está timbrada…».
Arreglo: qué se cancela, el dinero, lo demás, «no se deshace» en su renglón, y la regla de lo timbrado al final y neutra. De fondo: una lectura de «¿timbrada?» por folio en la base (decisión de Marcelo).

### [P2] Los estados bloqueados o cambiados dicen cosas que ya no son ciertas
Con el folio liberado quedan renglones de la lectura vieja; la de la orden bloqueada sigue diciendo «puede deshacerla» y «Les avisamos…»; a Lupita el pie la manda a «Cancelar con su folio», que no tiene.
Arreglo: bloqueada, sólo la causa y la salida; el pie según el rol.

## Persona Red Flags

**Lupita:** lo normal es rápido (foco en el campo, 5 letras, un clic); «No se pagó con saldo a favor» sale en toda orden; el pie la manda a un botón que no tiene; acepta «.....».
**Quien suple:** jerga sin explicar; las indicaciones nombran botones que se llaman distinto («Cancelar la parte» / «cancelar parte», «Cancelar línea» / «Cancelar»).
**Marcelo con una orden facturada:** los dos P1; lo timbrado de partes, plan y agrupada se verifica en CobranzaFlow.
**Teclado:** muy bien; tras «clic fuera → Seguir aquí» el foco va al panel.

## Minor Observations

- [P3] Huecos: el renglón del saldo reserva 36 px vacíos en la facturada; el pie deja ~25 px cuando ya no falta nada.
- [P3] En la de la orden, el archivo se dice dos veces; en la del folio timbrada, el pie repite el renglón grave.
- [P3] «No se puede» como botón quitado en una y apagado en otras; anchos 500 y 520.
- [P3] «Volver» apagado mientras trabaja se ve igual que activo.
- [P3] «Factura F-131.» sola cuando falla la lectura; «$12,000.00 de $12,000.00» cuando la parte es la orden entera; el éxito de la del folio no dice qué pasó en CobranzaFlow.
- [P3] La de la parte, si la parte ya se canceló en otra sesión, se cierra con un aviso abajo y el motivo se pierde.
- [P3] El título de «¿Cerrar sin cancelar?» (ConfirmModal) en negro puro.
- [P3] La de la parte y la del plan matriz no dicen quién se entera.

## Questions to Consider

1. ¿Una lectura de «¿timbrada?» por folio (partes, agrupada, plan)?
2. ¿El motivo en el pie fijo, junto al botón?
3. ¿Cada «siguiente paso» como un botón que lleve?
4. ¿Hace falta el renglón del saldo a favor en un cliente que no es Corona?
5. ¿Cómo se entera Karla de que una parte vuelve a quedar por facturar o de que una línea regresa a Salidas?
6. ¿Debe Lupita ver «Cancelar orden» donde no puede usarlo?
