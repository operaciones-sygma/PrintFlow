---
target: el Tablero de Producción (Kanban)
total_score: 27
p0_count: 0
p1_count: 3
timestamp: 2026-07-15T18-50-23Z
slug: src-app-jsx-kanban-tablero-de-produccion
---
# Critique — Tablero de Producción (`Kanban`)

Target: `src/App.jsx` :: `Kanban` (L10730-11012) + `OrderThumb` (L10700) + `DragCard` (L10712). Register: **product** (herramienta interna de taller). Detector determinista: **0 hallazgos** (limpio). Browser overlay: no disponible (sin automatización) → revisión de fuente + dominio.

## Design Health Score

| # | Heurística | Score | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | `LiveTimer`/badges excelentes, pero `actionLoading` no llega a Kanban; `assignMachineLock` traga el 2º drop con `return` mudo |
| 2 | Sistema ↔ mundo real | 4 | El área más fuerte: "Fuera de servicio", "Aspa #2 · Suajadora", "pzas", "REIMPRIMIR". Cero traducción |
| 3 | Control y libertad | 3 | Esc cierra modal, "Volver a Lista" en máquina y cola; Salidas es puerta de un solo sentido, merma sin deshacer |
| 4 | Consistencia y estándares | 2 | El drag respeta mantenimiento, el select NO. `#N` = folio arriba y = turno de cola abajo. Maquila sin contador |
| 5 | Prevención de errores | 3 | Guardas reales (modal, lock anti doble-drop, RPC atómica, gates de rol) con 1 hueco: `quickAssign` no checa mantenimiento |
| 6 | Reconocer vs recordar | 3 | Miniaturas + nombres de piso ganan; el folio desaparece al entrar a máquina; 3 botones sin label en Empaque |
| 7 | Flexibilidad y eficiencia | 2 | Doble ruta (drag/select) es real y buena; pero sin Enter en el modal (40×/día), sin batch, sin filtro, `collapsed` no persiste |
| 8 | Estético y minimalista | 2 | Densidad correcta, pero 56px de redundancia arriba y noise floor tinte-sobre-tinte: nada domina |
| 9 | Recuperación de errores | 2 | Toasts específicos + reload, pero 4+ `return` mudos sin feedback |
| 10 | Ayuda y documentación | 3 | `FirstTimeHint` enseña el flujo hasta Karla, "clic para abrir", aria-labels personalizados |
| **Total** | | **27/40** | **Aceptable** (tope de banda) |

## Anti-Patterns Verdict

**¿Parece hecho por IA? No, pero el chrome sí es genérico mientras las tripas son artesanales.** Ninguna IA inventa "Aspa #2 · Suajadora", ni el handshake `qAutoScrollClaim`, ni la decisión de que la miniatura no tenga placeholder. Eso es conocimiento de piso.

Donde SÍ se cuela lo genérico: (1) **la barra de contadores** es literalmente el *hero-metric row* (7 pastillas tintadas idénticas, número 18/800 + label 11/600) — exactamente lo que emite un LLM cuando le pides "dashboard"; (2) **la paleta por alfa** (`X+"06"/"10"/"12"/"25"/"40"/"66"` del mismo hue en cada contenedor) produce un wash pastel donde todo pesa igual.

**Bans absolutos:** side-stripe borders NO · gradient text NO · glassmorphism NO · **hero-metric template SÍ** (la barra) · modal-como-primer-recurso PARCIAL (es el único y carga info real, pero se dispara en la acción más repetida del día). **Grids de cards idénticas: NO aplica** — las 11 tarjetas de Acabados son *drop targets* arrastrables; la geometría uniforme sirve a Fitts. Sameness funcional ≠ sameness decorativa.

**Scan determinista:** 0 hallazgos. **Dónde el detector se quedó corto:** no ve el hero-metric row ni los contrastes, porque son estilos inline en JSX (el detector busca patrones de markup/CSS). El juicio humano lo cazó; el detector confirma que no hay slop estructural.

## Overall Impression

Es una herramienta de piso genuina, y el vocabulario del taller la hace desaparecer en la tarea (por eso la heurística 2 saca 4). Lo que la frena no es fealdad: es **jerarquía plana + un chrome que no se gana su espacio**. Los 56px superiores repiten 7 números que ya están en pantalla, mientras el trabajo ACTIVO (lo único con reloj corriendo y dinero encima) se distingue por un borde 2px apenas más fuerte que el de la máquina que lo contiene. Y el pool le entrega a Gerardo las órdenes **más nuevas primero**, cuando planear el día ES ordenar por urgencia. La oportunidad más grande: que el tablero haga el trabajo que hoy Gerardo hace con los ojos.

## What's Working

- **La doble ruta (arrastrar O "Enviar a máquina…").** No es un fallback: son dos modos mentales. El drag es espacial ("pon esto ALLÁ"), el select es nominal ("esto va a la Polar 115"). Un planeador llenando el día trabaja nominal; un operador reaccionando trabaja espacial. Casi todos los boards solo dan drag y fuerzan el modo espacial.
- **El vocabulario es del taller, no del software.** "Fuera de servicio — Cambio de mantilla", "En espera (3)", "pzas". Cero costo de traducción. Es lo más difícil de fingir y la razón principal de que la herramienta desaparezca.
- **El cap de cola + auto-scroll coordinado.** `maxHeight:400` + el handshake `qAutoScrollClaim` (la cola reclama el scroll 150ms, la ventana cede). Es un arreglo que nadie nota cuando funciona, que es la definición de craft: preserva lo que Gerardo realmente hace (apilar 15 trabajos para planear) sin que el renglón mate el drag.

## Priority Issues

### [P1] El menú "Enviar/Mover a máquina" ignora el mantenimiento
`machinesByType` filtra por `MACHINES.status==="active"` (catálogo estático) pero NO por `activeMaint(m.id)` (estado real). La ruta de arrastre sí bloquea (`onDrop={e=>{if(!inMaint)drop(...)}}`); `quickAssign` no.
**Por qué importa:** dos rutas a la misma acción, una con guarda y otra sin. Gerardo manda un trabajo a una máquina que **en ese mismo tablero, a 30cm, dice "Fuera de servicio"**. El trabajo entra a la cola de una máquina apagada y nadie lo nota. El tablero se contradice a sí mismo. **Nota: el dropdown nuevo de la cola EN ESPERA (v10.73.71) heredó este hueco.**
**Fix:** pasar `maintenance` a `machinesByType`; `<option disabled>{m.name} — en mantenimiento</option>` (mejor que ocultarla: Gerardo ve *por qué*); guarda `if(activeMaint(mid))return` en `quickAssign`.
**Comando:** `/impeccable harden`

### [P1] El pool está ordenado al revés de como se planea
`prioSort` solo ordena por `priority`; `Array.sort` es estable y `orders` viene `created_at DESC` → dentro del bucket "normal" el pool queda **más nueva primero**. Además "vencida + normal" pierde contra "urgente + entrega en 3 semanas".
**Por qué importa:** planear el día **es** ordenar por urgencia. La herramienta ya calcula el dato correcto (`isOverdue` pinta la fecha en rojo) y luego lo presenta en el peor orden, dejándole a Gerardo escanear 15 tarjetas a mano. Todas las mañanas.
**Fix:** desempate en `prioSort`: vencidas al tope de su bucket, luego `due_date` asc con nulls al final. Tres líneas, un solo sitio; beneficia también a PreprensaBoard que usa el mismo sort.
**Comando:** `/impeccable clarify`

### [P1] El folio desaparece al entrar a máquina, y "#N" significa dos cosas
La tarjeta del pool muestra `#{o.production_number}`; `DragCard` (activa + Empaque) no. La tarjeta de cola muestra `#{o.machine_queue_position}`: mismo token `#N`, 20px más arriba, otro significado.
**Por qué importa:** Gerardo trabaja con la hoja física en la mano; el folio impreso es su llave papel↔pantalla. Justo cuando necesita casarlos (trabajo ya montado) el folio no está. Y `#4` es folio arriba y turno abajo.
**Fix:** `#{o.production_number}` en `DragCard` y en la tarjeta de cola con el chip del pool; cambiar la posición de cola a `3º`/`Turno 3`.
**Comando:** `/impeccable clarify`

### [P2] La barra de contadores repite 7 números que ya están en pantalla
"Listas 12" está 40px arriba de un panel titulado "Órdenes Listas" con badge 12. "Offset/Acabados/Digital" duplica el badge "N en producción" de cada categoría (que se renderiza colapsada o no). "Empaque/Salidas" duplican los badges del sidebar. Y el único chip que ES botón ("N en espera") está disfrazado igual que los 6 que no lo son.
**Por qué importa:** es el hero-metric row genérico: consume los 56px superiores sin aportar un dato nuevo, y esconde la única acción real de la fila. Encima los labels dan 2.9-3.2:1.
**Fix:** matar los 6 chips redundantes; dejar "N en espera" y que **se vea como botón**; agregar lo único que no está en el tablero y sí importa: **cuántas vencidas y cuántas urgentes sin asignar**.
**Comando:** `/impeccable distill`

### [P2] El aviso de sobrecarga es el texto menos legible del modal

| Elemento | Color / fondo | Ratio | Necesita |
|---|---|---|---|
| "Esta máquina tiene N trabajos en cola" | `C.wn` / `C.wn+"08"` | **2.56:1** | 4.5 |
| Botón "Activar" | `C.live` / `#fff` | **2.22:1** | 4.5 |
| Header "Maquila" | `C.maq` / casi-blanco | **2.77:1** | 4.5 |
| Chips "Listas"/"Digital" | `C.ok` / `C.ok+"10"` | **2.96:1** | 4.5 |
| "Disponible" / "Arrastra aquí" | `C.ph` | **3.28:1** | 4.5 |

**Por qué importa:** el patrón `color:X / background:X+"08"` se rompe **sistemáticamente** con verdes, ámbares y naranjas saturados (`C.t2` 5.13:1 y `C.t3` 4.63:1 sí pasan: el problema es exclusivo de los tonos de marca). Y pega justo donde no debe: el aviso que previene apilar un cuarto trabajo, y el botón "Activar". En una nave industrial esto no se lee.
**Fix:** variantes oscurecidas para texto sobre tinte (`C.wnD`/`C.liveD`/`C.maqD`/`C.salD` ~4.5:1); el hue saturado se queda para fills/bordes/badges sólidos.
**Comando:** `/impeccable harden`

## Persona Red Flags

**Gerardo (planeador + operador, persona del proyecto):** vive 8h/día aquí, desktop+mouse, con la hoja física en la mano.
- El folio no está en las tarjetas de máquina ni de cola → su llave papel↔pantalla desaparece cuando la necesita.
- El pool le entrega las más nuevas primero → su tarea central empieza con trabajo manual que la máquina podía hacer.
- El select le ofrece máquinas que el tablero declara fuera de servicio → la herramienta se contradice, y eso cuesta confianza en todo lo demás.
- El aviso "esta máquina ya trae 2h30" a 2.56:1 bajo luz de nave → el único dato que previene su error es el que no se ve.
- `collapsed` no persiste → cada recarga le deshace la vista que se armó.

**Alex (power user):** 40 asignaciones/día × modal sin `autoFocus` y sin Enter = 40 viajes de mouse. Esc sí cierra; Enter no confirma. Sin asignación múltiple: vaciar 5 tarjetas = 5 drags + 5 modales, y Gerardo *es* un planeador batch.

**Riley (stress tester):** manda un trabajo por el select a una máquina en mantenimiento y **el sistema lo acepta**. Doble-drop rápido → `assignMachineLock` lo traga con `return` mudo (parece que no pasó nada → reintenta). Cliente de 60 chars en `DragCard`: el `<span>` no tiene `minWidth:0`/ellipsis → empuja al `LiveTimer` fuera de la tarjeta. 40 órdenes en Listas sin filtro ni búsqueda.

## Minor Observations

- **Salidas expandido no tiene tope de altura**: el fix de v10.73.71 se aplicó a Empaque (`maxHeight:500`) y a las colas (400), pero no a Salidas. Con 20 órdenes el sidebar sticky se vuelve a estirar. Lo tapa que arranca colapsada, pero es un hueco del arreglo recién shipeado.
- **Tokens:** `#fafafa` y `#fff` hardcodeados en las tarjetas de cola en vez de `C.sf`/`C.card`. La cola es el único sitio del tablero fuera del sistema.
- **Los 3 botones de Empaque** (Salidas/Maquila/Merma) no tienen `title` ni `aria-label`; los de la cola sí. Uno de los tres es un bote de basura sin etiqueta.
- **Maquila es la única zona del sidebar sin contador.** Se suelta y el trabajo desaparece del tablero (vive en `MaquilaTracker`, fuera del viewport).
- **Salidas es puerta de un solo sentido en el tablero**: máquina y cola tienen "Volver a Lista"; Empaque y Salidas no. Un "Deshacer" en el toast bastaría.
- `cursor:"grab"` sin `:active{cursor:grabbing}` en ninguna tarjeta.
- `onDragLeave` dispara al entrar a los hijos de la zona → parpadeo del borde de 2px durante el hover.
- **El estado vacío miente:** "Cuando una orden esté lista, arrástrala aquí". Gerardo no puede arrastrar nada *al* pool; las órdenes llegan solas desde Diseño/CTP.

## Questions to Consider

1. **Si la barra de contadores desapareciera mañana, ¿Gerardo lo notaría?** Y si no, ¿por qué ocupa el espacio donde cabría "3 vencidas · 2 urgentes sin asignar"?
2. **El modal pregunta 40 veces al día por una acción que "Volver a Lista" deshace en un clic.** ¿Previene un error o compra la *sensación* de prevenirlo? Si hay `audit_log`, cuántas veces se le dio "Cancelar" es medible, y eso decide si el modal se queda.
3. **`totalMins` ya se calcula, pero solo existe DENTRO del modal**, o sea después de que Gerardo decidió. El header de la máquina muestra "3" pero no "≈4h 30m". ¿Por qué el dato que informa la decisión solo aparece cuando ya está tomada?
4. **Gerardo usa las colas como plan del día, pero el tablero no distingue "planeado para hoy" de "planeado para el jueves".** ¿La cola es una cola o es una agenda? Si es agenda le falta el eje del tiempo, y ese es el siguiente arco de esta pantalla, no otro pase de pulido.
5. **Si el único chip clicable de la fila se ve idéntico a los 6 que no lo son**, ¿cuánto tardó Gerardo en descubrir que "N en espera" era un botón? ¿O nunca lo descubrió?
