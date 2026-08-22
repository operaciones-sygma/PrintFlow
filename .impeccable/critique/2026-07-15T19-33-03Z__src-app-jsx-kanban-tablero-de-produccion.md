---
target: el Tablero de Producción (Kanban) — re-medición
total_score: 25
p0_count: 0
p1_count: 1
timestamp: 2026-07-15T19-33-03Z
slug: src-app-jsx-kanban-tablero-de-produccion
---
# Critique #2 — Tablero de Producción (`Kanban`) — re-medición tras el arco v10.73.74-77

Target: `src/App.jsx` :: `Kanban` (L10742-11042) + `OrderThumb` (L10709) + `DragCard` (L10721). Register: **product**. Detector: **0 hallazgos** (limpio). Browser overlay: no disponible. Reviewer **fresco e independiente** (no vio la critique #1 ni su score, para no anclar).

## Design Health Score

| # | Heurística | Score | Δ vs #1 | Problema clave |
|---|---|---|---|---|
| 1 | Visibilidad del estado | 2 | −1 | Kanban es la ÚNICA superficie mayor sin `actionLoading`; drops rechazados sin mensaje |
| 2 | Sistema ↔ mundo real | 3 | −1 | Vocabulario de taller fluido; se rompe en el bote de basura = merma (el tooltip se disculpa por el ícono) |
| 3 | Control y libertad | 3 | = | Esc, "Volver a Lista", reorder; Salidas sigue sin vuelta en el tablero |
| 4 | Consistencia y estándares | 2 | = | **4 contratos de confirmación para el mismo gesto**; maxHeight 400/500/420 sin razón derivable |
| 5 | Prevención de errores | 2 | −1 | El modal caro está en la acción reversible; la irreversible dice "¿Estás seguro?" sin decir de qué orden |
| 6 | Reconocer vs recordar | 3 | = | Miniaturas + chips de folio (el mejor acierto); la carga de la máquina se revela DESPUÉS de elegirla |
| 7 | Flexibilidad y eficiencia | 2 | = | Selects ✅; sin atajos, sin lote, `collapsed` no persiste |
| 8 | Estético y minimalista | 3 | +1 | La barra de riesgo condicional es ejemplar; residual: LiveTimer duplicado |
| 9 | Recuperación de errores | 2 | = | El error más frecuente (drop rechazado) no produce NINGÚN mensaje |
| 10 | Ayuda y documentación | 3 | = | FirstTimeHint + el empty state enseña el sistema |
| **Total** | | **25/40** | **−2** | **Aceptable (banda alta)** — fundamentos sólidos, contratos desalineados |

**El −2 NO es una regresión.** Es un reviewer fresco distinto, con lente más estricta y más profunda. La lección ya registrada del arco OCard aplica igual: el score heurístico por LLM varía ±2-3 entre reviewers; **perseguir el número es fútil, lo que valen son los hallazgos**. Este reviewer subió Aesthetic (+1, por la barra) y bajó los de estado/errores, que la critique #1 no había mirado con esta lupa.

## Anti-Patterns Verdict

**No es slop.** Cero side-stripes, cero gradient text, cero glassmorphism, cero motion decorativo. Cita textual: *"El hero-metric row **ya fue asesinado** en v10.73.76 y reemplazado por una barra que solo existe cuando tiene algo que decir. Eso es lo contrario de slop, es edición."* El pool sí es un grid de cards idénticas, pero son objetos homogéneos arrastrables, no relleno.

**Pero falla el product slop test por otra vía:** no por rareza, sino por **incoherencia de contrato**. El mismo gesto (arrastrar a una zona) tiene **4 comportamientos distintos** y ninguno es predecible desde la superficie. *"Este tablero no está feo. Está desalineado."*

**Detector:** 0 hallazgos, consistente con el veredicto. Sigue sin ver estilos inline (contrastes, hero-metric): el juicio humano cubre esa capa.

## Lo que el arco SÍ ganó (confirmado por un reviewer que no sabía del arco)

- **La barra de riesgo** (v10.73.76): *"no es que se vea bien, es que no existe cuando no tiene nada que decir... es edición, no decoración"*. Y el chip que ES botón ahora **parece** botón; los que no, no. **Forma = función.**
- **`OrderThumb`** (v10.73.69): *"el movimiento más inteligente del archivo"*. Un impresor reconoce el trabajo por cómo se ve el pliego, no por el texto. Las 3 decisiones alrededor (sin placeholder, `draggable={false}`, reset de `failed`) las validó una por una.
- **Los chips `#folio`** (v10.73.75): *"su llave papel↔pantalla, y están en las tres superficies. Esa consistencia sí está bien resuelta"*.
- **El empty state** (v10.73.75): *"enseña la interfaz y le quita ansiedad: no está roto, no te toca a ti. Es lo que product.md pide y casi nadie hace"*.
- **El borde como gramática de estado**: 4 estados en una propiedad, legibles en periferia, sin leyenda. *"Eso es un sistema, no un estilo."*

## Priority Issues (hallazgos NUEVOS)

### [P1] El presupuesto de confirmación está exactamente invertido
4 contratos para el mismo gesto: drop en máquina → **modal rico**; Empaque → **nada**; Salidas → **modal genérico** (`"📤 Salidas"` / `"¿Estás seguro?"`, sin decir de qué orden); Maquila → otro modal.
**Por qué importa:** el costo está al revés del daño. Asignar máquina es **trivialmente reversible** ("Volver a Lista" a 3cm) y paga el modal más caro ~30 veces al día. Mandar a Salidas **dispara efectos fuera de PrintFlow** (notifica a Karla, arranca el reloj de facturación) y **no tiene vuelta desde el tablero** — y su modal no contiene la info que permitiría detectar un mis-drop. Remate: el único dato único del modal de máquina es **la carga (`N en cola · ~ETA`)**, y se enseña DESPUÉS de elegir; un planeador elige POR carga.
**Fix:** (1) subir la carga a la decisión (header de la card + label del `<option>`); (2) matar el modal de asignación → optimista + toast con **Deshacer** (`return_to_ready` ya existe); (3) darle a Salidas el modal rico con cliente/folio/producto + la consecuencia explícita.
**Comando:** `/impeccable shape`

### [P2 — bug] El subtítulo del pool promete un drop que el código rechaza en silencio
L10818 dice *"Arrastra a máquinas, Empaque o Salidas"*, pero Salidas rechaza `stage:"ready"` y hace `return` **mudo**. Una card del pool es `ready` o `maquila_in`: **`maquila_in` entra, `ready` no**. Dos cards idénticas, comportamientos opuestos, cero explicación. Y el `FirstTimeHint` tiene la regla CORRECTA ("cuando estén empacadas") → el hint y el subtítulo **se contradicen entre ellos**. No es aislado: **los 5 rechazos del `drop()` son silenciosos**.
**Por qué importa:** un drop mudo es indistinguible de un bug o de un dedo torpe. El operador reintenta 2-3 veces y concluye que la app falla. Es el peor error: el que la interfaz **invitó por copy** y luego no reconoció.
**Fix:** corregir el subtítulo a la verdad; que ningún `return` sea mudo (toast); mejor aún, **atenuar durante el drag las zonas que no admiten el stage en vuelo** (el estado `dO` ya existe).
**Comando:** `/impeccable clarify`

### [P2] El tablero es la única superficie sin estado "ocupado", y `reorder_in_machine` no tiene lock
`busy`/`disabled` aparece 171 veces en App.jsx; `<Kanban>` **no recibe `actionLoading`**. `reorder_in_machine` encadena 4 awaits + `reload()` completo sin optimista → 1-3s en los que "Activar" se ve idéntico y **sigue clickeable**. Doble clic: el guard lee `orders` del closure (todavía sin cambiar) → pasa → **doble `closeMachineLog`/`addMachineLog` = minutos de máquina corruptos**. Esta lección ya se aprendió DOS veces en el archivo (`assignMachineLock`, `duplicateLock`) y `reorder_in_machine`/`return_to_ready` quedaron fuera.
**Fix:** pasar `actionLoading` a Kanban + `disabled`/`opacity:.5`/`cursor:wait` en Activar/Empaque/Volver a Lista; `reorderLock=useRef(false)` con el patrón existente.
**Comando:** `/impeccable harden`

### [P2] El mantenimiento está disponible al revés de cuando ocurre
La llave inglesa **solo aparece si la máquina está VACÍA** (`!inMaint && !hasWork`), pero las máquinas se descomponen **corriendo un pliego**. Y quitar el mantenimiento es `role==="admin"`: **Gerardo puede sacar una máquina de servicio pero no regresarla** — con la máquina ya reparada, necesita a un admin. En ambos casos la UI **no dice nada**: el botón simplemente no está.
**Fix:** permitir marcar mantenimiento con trabajo montado (el modal ofrece destino del activo); si el gate de admin es intencional, **decirlo** (botón deshabilitado con `title`) en vez de ausencia silenciosa.
**Comando:** `/impeccable adapt`

### [P3] LiveTimer duplicado en la card activa
El header "ACTIVA" renderiza `<LiveTimer>` y el `<DragCard>` de abajo renderiza **la misma expresión** sobre el mismo `machine_log`. Dos relojes idénticos a ~20px.
**CORRECCIÓN al reviewer:** lo atribuyó a v10.73.75; **es PRE-EXISTENTE** — `DragCard` ya traía el timer desde antes del arco (v10.73.75 agregó el chip de folio, no el timer). El hallazgo es real; la atribución no.
**Fix:** quitar el `<LiveTimer>` del header de ACTIVA y dejar el de `DragCard` → el timer vive siempre en el mismo lugar (máquina y Empaque). Un solo contrato.
**Comando:** `/impeccable distill`

## Persona Red Flags

**Gerardo (planeador + operador):** tiene que **memorizar qué caja acepta qué** porque las cajas no se lo dicen y el copy le miente · **planea sin ver la carga** (la cola y el ETA solo aparecen después de elegir) · **la máquina se descompone corriendo y la llave no está** (lo obliga a mentirle al sistema para decirle la verdad) · **no puede reactivar su propia máquina reparada**. ✅ Las miniaturas y los chips `#folio` sí resuelven su llave papel↔pantalla en las 3 superficies.

**Alex (power user):** sin asignación en lote (planea el día una-por-una × modal) · confirmación redundante en acción de bajo riesgo · cero atajos (el resto de la app tiene Command Palette).

**Riley (stress tester):** arrastra del pool a Salidas siguiendo el subtítulo → **falla en silencio** · doble clic en "Activar" → `machine_log` duplicado · con `maquila_out=3` y todo lo demás en 0 dice **"Tablero vacío"** mientras el badge de Maquila muestra 3 y hay 16 cajas debajo.

**Sam (a11y):** los headers de categoría y de Salidas son `<div onClick>` sin foco/`role`/`aria-expanded` — son los controles estructurales de la pantalla. ✅ Crédito real: aria-labels en selects, mantenimiento y los 3 botones de Empaque; `role="dialog"`+Esc en el modal.

## Minor Observations

- **El bote de basura = merma**: el tooltip *"(no borra la orden)"* es la interfaz disculpándose por su propio ícono. **Cambia el ícono, no agregues nota al pie.**
- **maxHeight mágicos**: 400 (cola) / 500 (Empaque) / 420 (Salidas) — tres listas equivalentes, tres números sin razón derivable. Tokenizar o unificar.
- **La card ACTIVA no tiene select "Mover a máquina…"** — el pool sí, la cola sí. Es la única sin salida no-drag, y es justo el trabajo montado en la máquina equivocada. `machineOpts` ya existe.
- **"clic para abrir" / "clic para ver"** como texto permanente: el caret rotado ya lo dice. Hint de onboarding fosilizado.
- `collapsed` no persiste · los toasts filtran `e?.message` de Supabase al operador · contrastes texto-sobre-tinte (ya en backlog app-wide; en este tablero se concentran en los labels de CATEGORÍA, que es donde más se nota por ser títulos).

## Questions to Consider

1. **Si asignar máquina es reversible en un clic, ¿qué compra el modal — o solo paga el miedo de quien lo escribió?** Si nadie le da "Cancelar" nunca, no es un guardrail: es un impuesto de 30 clics/día. Es medible en `audit_log`.
2. **¿Por qué el gate de admin para quitar mantenimiento?** Si el objetivo es auditoría, se logra con un log inmutable, no dejando a Gerardo esperando con una máquina ya reparada.
3. **Gerardo apila las colas para planear el día. ¿Dónde está "el día"?** El tablero muestra el AHORA pero nunca el CUÁNDO: sin horizonte, sin carga total por máquina, sin "esta cola termina a las 16:00 y la entrega es hoy". **¿El tablero es la herramienta de planeación, o solo donde se registra la planeación que ya se hizo en la cabeza?** Probablemente el próximo arco.
4. **El pool se ordena por urgencia administrativa, no por eficiencia de taller.** ¿Nunca ha pedido agrupar por producto (todos los volantes juntos, que corren en el mismo pliego)?
5. **La barra dice "3 vencidas". ¿Y luego qué?** No es clickeable, a diferencia de "N en espera". El dato más urgente de la pantalla es el único que no lleva a ningún lado.
