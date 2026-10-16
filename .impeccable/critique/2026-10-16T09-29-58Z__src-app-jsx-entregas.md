---
target: Entregas (el calendario de entregas de PrintFlow)
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-10-16T09-29-58Z
slug: src-app-jsx-entregas
---
# Critique — «Entregas» (el calendario de entregas de PrintFlow, v10.84.121)

Fuente: `Calendar` en `src/App.jsx` (y su ventana de cambiar la fecha). Revisada con las capturas del recorrido en producción (los 8 roles, 16-oct
02:18) y el código; evaluación A (diseño) y B (detector de la skill: CLI sobre App.jsx; en el navegador, sobre su banco nuevo
`tests/banco/gen-entregas.mjs`), en ese orden y sin subagentes. La usan todos los roles todos los días y nunca se había criticado.

## Design Health Score

| # | Heurística | Puntos | Lo principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | Hoy se ve (el círculo); al guardar, la ventana se cierra sin decir si quedó (lo dice App con un aviso); la misma fecha cierra sin decir nada |
| 2 | El lenguaje del usuario | 3 | «Calendario de Entregas», etapas con su nombre; «Haz click» (anglicismo) |
| 3 | Control y libertad | 2 | La ventana no cierra con un clic fuera ni con Esc estando en un campo; Esc y Cancelar tiran el motivo escrito sin preguntar |
| 4 | Consistencia | 2 | Usa `alert()` nativo (la regla de la app: nunca); la ventana no es como las demás (sin role="dialog", sin el Tab adentro, sin regresar el foco) |
| 5 | Prevenir errores | 2 | El motivo es obligatorio pero se avisa con un alert; se puede «guardar» la misma fecha (no hace nada y no lo dice) |
| 6 | Reconocer, no recordar | 3 | La leyenda de colores y la pista de arriba |
| 7 | Flexibilidad | 2 | Las fichas son `div` con `onClick`: con el teclado no se llega a ninguna |
| 8 | Estética minimalista | 3 | Limpio; letra de 7 a 10 px en las fichas; la entregada al 60 % de opacidad |
| 9 | Recuperarse de errores | 2 | El error del motivo en un alert, lejos del campo; el campo sale en rojo desde que se abre |
| 10 | Ayuda | 3 | La pista «Haz click en cualquier orden para cambiar su fecha» y la leyenda |
| **Total** | | **24/40** | **Aceptable: necesita mejoras antes de que la gente esté a gusto** |

## Anti-Patterns Verdict

**Evaluación del diseño:** no parece de IA; es una vista de la app con su vocabulario. Lo que falla es de oficio, no de estilo: una ventana armada
a mano que no se porta como las demás, y letra de nota al pie para lo que se lee todo el día.

**Detector (CLI, App.jsx):** 6 hallazgos en todo el archivo (Geist «sobreusada» ×4: la letra de la app, falso positivo; 2 `layout-transition`), ninguno en
el calendario. **Detector en el navegador** (inyectado en el banco nuevo, la semana y la ventana abierta, ya con el arreglo): `tight-leading` (el nombre a dos renglones con interlineado 1.25: subido a 1.3), `low-contrast` 3.3:1 (el «—» de los días sin entregas en `C.ph`: pasado a `C.t3`, 4.6:1), `all-caps-body` (las etiquetas `lbl` en mayúsculas: la convención de toda la app), y Geist única letra, la escala plana y `gradient-text`: falsos positivos (la letra de la app; el degradado no está en la página, sale del propio detector).

## Overall Impression

Hace su trabajo (dónde cae cada entrega), pero para quien la usa todo el día cansa: se lee con esfuerzo, el rojo dice dos cosas (retrasada y urgente)
y la ventana de cambiar la fecha se porta distinto a las demás de la app, con un alert nativo en el camino más común (olvidar el motivo).

## What's Working

- Semana y mes, con «Hoy» para regresar, y la semana arranca en lunes como en la planta.
- El motivo del cambio es obligatorio y llega al historial y a Lupita, Noemí y Gerardo (lo hace App).
- El vendedor sólo puede mover sus órdenes (la ficha de otro no abre la ventana).

## Priority Issues

- **[P1] Las fichas no se alcanzan con el teclado** (`div` con `onClick`): quien usa Tab no puede cambiar una fecha y el lector de pantalla no sabe que
  se puede. Arreglo: cada ficha un `<button>` con lo que dice («Entrega de COSQUIM (P-0645), Etiquetas, 20,000 piezas, retrasada 2 días. Cambiar su
  fecha»). Comando: /impeccable harden.
- **[P1] La ventana de cambiar la fecha no es una ventana de la app**: `alert()` nativo si falta el motivo, el campo del motivo en rojo desde que se abre,
  Esc no hace nada con el foco en un campo, el clic fuera no cierra, el Tab se sale, al cerrar el foco cae al principio, y la misma fecha se «guarda» sin
  decir nada. Arreglo: un componente con `role="dialog"`, el foco en la fecha, el error adentro y sólo después de intentar, Esc y el fondo cierran si no
  hay nada escrito, «Es la misma fecha que ya tiene», `atraparTab` y `useDevolverFoco`, y un doble clic guarda una vez. Comando: /impeccable harden.
- **[P2] No se lee**: el cliente a 10 px, el producto a 9 y la etapa a 8 (7 en el mes); la entregada al 60 % de opacidad en verde sobre verde. Arreglo:
  12/11/10.5 px, el nombre en dos renglones (completo en su título) y la entregada sin transparencia, en su tinta. Comando: /impeccable typeset.
- **[P2] El rojo dice dos cosas**: retrasada (el tinte) y urgente (el borde y un punto rojo). Arreglo: cada una con su palabra («Retrasada 2 d»,
  «Urgente») y la urgente en ámbar. Comando: /impeccable clarify.
- **[P3] El encabezado «SEMANA DEL 12-OCT»** no dice hasta cuándo: «Semana del 12 al 18 de octubre».

## Persona Red Flags

**Lupita (captura, todo el día)**: cambia fechas cuando el cliente llama; olvida el motivo y le sale un alert del navegador; busca la orden entre fichas
de 10 px.

**Sam (teclado y lector de pantalla)**: con Tab no llega a ninguna ficha; si llegara, el lector no diría de qué orden es ni si está retrasada.

**Genaro (vendedor)**: las órdenes de otros se ven igual que las suyas pero no abren nada, sin decir por qué.

## Minor Observations

- «Haz click en cualquier orden» → «Toca una entrega para cambiar su fecha».
- Los botones de anterior/siguiente sin nombre para el lector de pantalla.
- En el mes, letra de 7 a 9 px.

## Questions to Consider

- ¿Debería verse cuántas entregas hay por día cuando el día se llena?
- ¿Mover una fecha arrastrando la ficha a otro día (con el mismo motivo obligatorio)?
