---
target: el Tablero de Producción (Kanban), primera pasada independiente
total_score: 20
p0_count: 0
p1_count: 3
timestamp: 2026-10-07T16-33-31Z
slug: src-app-jsx-kanban-tablero-de-produccion
---
# Critique: el Tablero de Producción (Kanban), primera pasada independiente, v10.84.55 en producción

Evaluación A por un **revisor independiente** (producción y admin a 1366, producción a 1920 y a 768 de tableta; 17 pruebas suyas
con Playwright, con todas las escrituras cortadas en el navegador; Listas estaba vacía y se evaluó por el código; el «Deshacer»
de asignar, por el código). Evaluación B (detectores), mía y aislada. Las dos calificaciones de julio (25/40) eran propias.
Meta aprobada: 35 sin P1, o 3 pasadas independientes.

## Calificación de salud (Nielsen)

| # | Heurística | Nota | Lo principal |
|---|---|---|---|
| 1 | Estado del sistema | 2 | Relojes, «ACTIVA» y contadores; a 1366 los 7 trabajos que corren salen con el nombre cortado; relojes que cuentan las noches («40h 43m», «43h 5m» en Empaque) |
| 2 | Lenguaje del taller | 3 | Español del piso; fallan ⟳, el bote y «clic para ver» en tableta |
| 3 | Control y libertad | 2 | Asignar tiene «Deshacer»; Empaque, ⟳ y «Activar» no preguntan ni se deshacen |
| 4 | Consistencia | 2 | URGENTE como punto, palabra o nada; el folio con «#», sin «#» o ausente; tarjetas anidadas y color pleno como texto |
| 5 | Prevención de errores | 2 | Mantenimiento y «aquí está» apagados, Salidas pregunta; el doble clic cae en otra orden, Merma acepta vacío o «-50» |
| 6 | Reconocer, no recordar | 2 | 23 ⟳ y las 3 acciones de Empaque sólo con ícono; «3 vencidas» no dice cuáles; la búsqueda no dice dónde |
| 7 | Flexibilidad | 2 | Arrastre, «Mover a máquina…» y búsqueda que resalta; 0 de 30 fichas con Tab; reordenar o mover la activa sólo arrastrando |
| 8 | Estética | 1 | 28 botones de color sólido, 13 llaves ámbar, 16 «Activar» verdes sin hacer nada; el reloj repetido le quita el ancho al nombre |
| 9 | Recuperarse de errores | 2 | Todo error avisa y recarga; el aviso no dice qué orden, enseña nombres internos y no ofrece Reintentar |
| 10 | Ayuda | 2 | Pista de primera vez y subtítulo; nada explica que «Activar» detiene lo que corre; `title` no aparece al tocar |
| **Total** | | **20/40** | **Aceptable, en el borde bajo** |

## Veredicto de anti-patrones

**Revisor**: no parece hecho por IA (máquinas, colas y decisiones reales del taller). Se nota acumulado: cajas dentro de cajas
hasta 4 niveles, un color por zona y por botón, íconos que dicen otra cosa (⟳ es «volver a Lista», el bote es merma).
**Detectores**: `detect.mjs` sobre Kanban, DragCard y MaquilaTracker (532 renglones), 0. En producción (sólo la vista, sin el
menú): 269 (producción) y 294 (admin): **tiny-text ×201** (9-11 px), **low-contrast ×61** (el verde de «Activar» 2.2:1, el blanco
sobre el morado de «Empaque» 4.1:1, el rojo de lo vencido 3.9:1, el gris #73737b sobre #eff2f6 4.2:1), nested-cards ×7,
ai-color-palette (el morado), dark-glow (la sombra verde). `gradient-text` es el detector marcándose a sí mismo y
`body-text-viewport-edge` sale de aislar la vista.

## Lo que funciona

1. La cola se lee como secuencia (1º, 2º…) con el folio a la vista; «Mover a máquina…» trae la carga de cada máquina y apaga
   «aquí está» y «en mantenimiento».
2. El mantenimiento es honesto: la máquina sale en ámbar con su motivo y la rechazan las listas y el arrastre.
3. La pregunta de Salidas nombra la orden y lo que pasa después, con el foco en «No, cancelar»; la búsqueda resalta sin filtrar.

## Problemas prioritarios

1. **[P1] No se lee qué corre en cada máquina**: a 1366 las activas dicen «CALZA…», «P…», «AL…»; en Empaque «TR…», «C…»; a 1920
   todo Acabados. El marco ACTIVA repite el reloj y la fila mete miniatura, asa, folio y reloj en ~200 px; Empaque mide 260 px.
2. **[P1] Mover órdenes no tiene red**: ⟳ (23), «Activar» (16) y «Empaque» (7) actúan al primer clic; el doble clic en «Empaque»
   de la GTO cae en el «Mover a máquina…» de la siguiente orden (3 de 5 puntos); «Activar» cierra el reloj de lo que corre.
3. **[P1] No se ve lo atrasado ni lo detenido**: «3 vencidas» sin clic (repartidas en una página de 2,935 px); lo vencido sólo con
   la fecha en rojo a 3.9:1; 43 h en Empaque se ve igual que 12 min; la cola no usa `alertasDeLaOrden`.
4. **[P2] Cuando la base rechaza**: el aviso no dice qué orden y enseña nombres internos («closeMachineLog update:»); la orden se
   ve movida mientras sale el aviso; Merma acepta vacío o negativo; Maquila y Merma no dicen de qué orden son.
5. **[P2] Un tablero sano parece arcoíris**: contrastes que no pasan; acciones en color neutro y color sólo en el destino, lo
   vencido y lo parado.

## Banderas rojas por persona

- **Gerardo en la laptop**: los 7 nombres cortados; las vencidas repartidas; siete botones morados iguales sin «Deshacer».
- **Gerardo en el monitor**: Acabados y Empaque cortan nombres; «Recibidas de maquila» (trabajo de Karla) ocupa pantalla.
- **Tableta**: el menú de 222 px abierto; Empaque en y=4,931; sin arrastre no hay cómo mover la activa ni reordenar; `title` no
  aparece al tocar.
- **Marcelo**: no distingue una orden atascada de una que trabaja; «3 vencidas» sin lista; relojes inválidos a la vista.

## Observaciones menores

«2 ordenes» sin acento; emoji en «📤 Salidas»; el círculo negro sólo cuenta activa más espera; el resaltado de una orden medio
tapado por el scroll de la cola; 14 de 16 órdenes en cola sin fecha; Maquila y Merma sin `role="dialog"` ni foco inicial.

## Preguntas

- ¿Y si cada máquina dijera primero qué corre, de quién y desde cuándo en horas de turno, y los botones salieran al tocar la ficha?
- ¿Por qué detener lo que corre cuesta un clic y mandar a Salidas cuesta una pregunta? ¿La confirmación sigue al daño o a la costumbre?
