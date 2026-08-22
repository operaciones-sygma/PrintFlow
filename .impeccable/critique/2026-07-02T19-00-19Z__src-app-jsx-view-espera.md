---
target: vista En espera (v10.73.31, minimizada)
total_score: 31
p0_count: 0
p1_count: 1
timestamp: 2026-07-02T19-00-19Z
slug: src-app-jsx-view-espera
---
# /impeccable critique #3 — Vista "En espera" (v10.73.31, grupos minimizados)

**~31/40 (heurísticas) · panel converge 31-33 · esencialmente PLANO vs 32.** Honestamente: el colapso-total-por-defecto que aplicamos es un **movimiento lateral, no una victoria** — cambió un problema de scroll por uno de descubrimiento. La IDEA (minimizar) es buena; el DEFAULT (todo colapsado) es demasiado romo.

## Design Health Score

| # | Heurística | Score | Δ | Nota |
|---|-----------|-------|---|------|
| 1 | Visibilidad del estado | 3 | = | Conteo por etapa comunica volumen; la urgencia (cuántas vencen hoy) queda enterrada en grupos cerrados. |
| 2 | Match mundo real | 4 | = | Vocabulario correcto; reactLabel por etapa/kind. |
| 3 | Control y libertad | 3 | = | Expandir/colapsar libre; falta expandir-todo + persistencia. |
| 4 | Consistencia | 3 | = | Patrón details/caret consistente, PERO el default diverge: esta vista colapsa, las secciones "En espera" de Tareas/Karla usan `<details open>`. |
| 5 | Prevención de errores | 4 | ↑ | Sin destructivas, reversible, "Le toca a X". Contenido. |
| 6 | **Reconocer > recordar** | **2** | **↓** | **Regresión:** una vista cuyo único fin es MOSTRAR las pausadas no muestra ninguna al entrar (solo headers). Reconoces volumen, no contenido. |
| 7 | Flexibilidad | 3 | = | Mata el scroll a alto volumen (bien), pero cobra click-tax en el caso común (abres para ver 2 tarjetas). |
| 8 | **Estético/minimalista** | 3 | ↑ | Índice compacto + card adelgazada + banner neutro = vista calmada. La mejora más fuerte. |
| 9 | Recuperación | 3 | = | Empty-states tipados; "Le toca a X · abre el detalle". |
| 10 | Ayuda/docs | 3 | = | Subtítulo + títulos autodocumentan. |
| **Total** | | **31/40** | **~igual** | (craft lens: 33; el neto es plano) |

**Trend:** 29 → 32 → 31.

## El diagnóstico central (las 3 lentes coinciden)
El **all-collapsed es el default equivocado**. Optimiza el caso raro (admin con 15+ pausadas en muchas etapas → scroll) y **grava el caso común** (un rol con 1-3 órdenes en 1-2 etapas → entra, ve cero tarjetas, tiene que clickear para ver lo que vino a ver). Para una vista cuyo único propósito es mostrar y reactivar, ocultar todo por defecto es un antipatrón. All-open (v30) reintroduce el scroll a alto N. **La respuesta correcta es adaptativa.**

## Issues

**[P1] Landing vacío / default no-adaptativo.** Entras a "En espera (N)" y no ves ninguna orden, solo headers colapsados. **Fix:** abrir por defecto el grupo **más urgente** (el que contiene la orden con `snooze_until` más próximo), Y abrir **todo** cuando hay pocas (total ≤ ~6 o ≤ 2 grupos); colapsar solo el overflow. Así ves órdenes al entrar + el índice sigue matando el scroll del resto. → `/impeccable layout`

**[P2] El índice no comunica urgencia, y los grupos se ordenan por etapa, no por urgencia.** La etapa con la orden que vence hoy puede quedar hasta abajo y cerrada. El eje más importante de una cola (el tiempo) es invisible al entrar. **Fix:** ordenar los grupos por su orden más urgente (o al menos auto-abrir el urgente), y/o un mini-resumen "N vencen hoy" en el header. → `/impeccable layout`

**[P2] La card en la vista no está del todo "adelgazada".** El `ProgressBar` y el timer de máquina siguen renderizando dentro de OCard con `inEsperaView` — en una orden PAUSADA la barra de avance es ruido (está detenida por definición). **Fix:** gatearlos con `!inEsperaView` para que el adelgazamiento sea real. → `/impeccable distill`

**[P3] Sin persistencia del estado de expansión.** `<details>` es DOM no controlado; al salir y volver todo re-colapsa. Un rol que siempre quiere su etapa abierta re-clickea. **Fix:** recordar el estado (o resolverlo con el auto-open adaptativo del P1). → `/impeccable harden`

## Lo que quedó bien (mantener)
- Banner neutro `C.sf` + borde sólido (corrigió el ámbar invisible + el dashed).
- CTA de reactivar **sólido** `bt(C.ac)` — apropiado para una vista cuyo único fin es reactivar.
- "Le toca a X · abre el detalle" para `canSnooze=false`.
- 3 empty-states tipados (cargando / sin-resultados / positivo).
- Sort intra-grupo por `snooze_until`.
- **El puente al Tablero** (ocultar del pool + chip "N en espera →") es una mejora neta sin contras.

## No es slop
Las 3 lentes coinciden: craft de PRODUCT disciplinado, sin adornos genéricos. Detector: mismos 6 falsos positivos app-wide, cero en la vista.

## Questions
- ¿El grupo que auto-abre debería ser el MÁS URGENTE, o el de la ETAPA DEL ROL (Gerardo → "Lista para imprimir")?
- ¿Vale un mini-resumen de urgencia en el header ("N vencen hoy") ya que los grupos arrancan cerrados?
