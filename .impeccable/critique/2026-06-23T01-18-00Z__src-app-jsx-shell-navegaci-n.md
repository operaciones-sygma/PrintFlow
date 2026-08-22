---
target: shell + navegación de PrintFlow (src/App.jsx)
total_score: 33
p0_count: 0
p1_count: 0
timestamp: 2026-06-23T01-18-00Z
slug: src-app-jsx-shell-navegaci-n
---
# Critique — Shell + Navegación (src/App.jsx) · run #4 post command palette

Register: **product**. Misma superficie (Sidebar + Header + contenedor de layout), medida tras v10.72.40 (/impeccable craft: command palette Ctrl/⌘+K).

## Design Health Score

| # | Heurística | Score | Issue clave |
|---|-----------|-------|-------------|
| 1 | Visibility of System Status | 3 | Dot de realtime + marca "actual" en el palette; aún sin eco del título de vista en el header |
| 2 | Match System / Real World | 3 | Labels de dominio en sidebar y palette |
| 3 | User Control & Freedom | 3 | Esc/backdrop en el palette, colapsar persistido, Salir visible; sin breadcrumb |
| 4 | Consistency & Standards | 4 | Un vocabulario de íconos, header agrupado, palette usa los mismos tokens/popIn |
| 5 | Error Prevention | 3 | Salir limpia estado; el palette no expone acciones destructivas sin gate |
| 6 | Recognition vs Recall | 3 | Sidebar agrupado + el palette hace todo buscable (recognition on-demand) |
| 7 | Flexibility & Efficiency | **4** ↑ | Subió de 2 (era el piso): command palette searchable + 100% teclado + role-aware. El acelerador para expertos que pedía la heurística |
| 8 | Aesthetic & Minimalist | 4 | Header con ritmo, palette limpio y restrained |
| 9 | Error Recovery | 3 | RootErrorBoundary + dot de reconexión |
| 10 | Help & Documentation | **3** ↑ | Subió de 2: pista visible ⌘K + footer de hints (↑↓/↵/esc) enseñan el feature; aún sin ayuda general del shell |
| **Total** | | **33/40** | **Great** (↑ desde 30) |

## Anti-Patterns Verdict

**No es slop.** Detector: **mismos 5 warnings, 0 errores** — el palette no introdujo patrones de slop. Decisiones que lo evitan: el backdrop es rgba plano (sin blur → sin glassmorphism), el anillo del badge es box-shadow, el popIn se hereda del CSS global de `[role=dialog]` (transform/opacity, no layout). En el shell siguen aplicando los 2 conocidos: Geist "overused" (L1445) y `transition:width` del sidebar (L14938). **Navegador:** inspección en vivo no disponible (fallback).

## Overall Impression

El command palette hizo lo que ningún pase de chrome podía: movió el **piso real** del shell. #7 Eficiencia pasó de 2 (cero teclado, todo mouse) a 4 (navegación + acciones por teclado, buscable, por rol). Y la pista ⌘K subió #10 de paso. **El shell cruzó de "Good" (30) a "Great" (33)** en cuatro pasadas (27→28→30→33), cada salto atribuible a lo que se tocó. El chrome ya no es el cuello de botella: lo que queda son refinamientos (no gaps) y deuda de código conocida.

## What's Working

1. **El acelerador correcto.** Un command palette role-aware, searchable y 100% teclado es exactamente el remedio de #7. Para Marcelo (admin) y quien capture todo el día, es el cambio que más se siente.
2. **Descubrible, no secreto.** La pista ⌘K visible + el footer de hints convierten un atajo de power-user en algo que el equipo encuentra solo. Eso es lo que subió #10.
3. **Cero costo de consistencia.** El palette reusa tokens, popIn, el tinte de activo del Sidebar. Se siente parte de la app, no un injerto.
4. **Verificado.** Review adversarial de 3 agentes: 0 regresiones, 3 hallazgos (correctness/a11y) corregidos antes de shipear.

## Priority Issues (residual — refinamientos, ya no gaps)

### [P3] El palette es v1: substring match, sin fuzzy/recientes/frecuencia
**Qué:** El filtro es `includes()` sin acentos/case. No hay ranking por uso reciente ni fuzzy ("tbl" no encuentra "Tablero").
**Por qué importa:** Cementaría #7 de "bueno" a "world-class". Para un palette que se usa decenas de veces al día, recientes + fuzzy ahorran tecleo.
**Fix:** Ranking simple (recientes primero, vía localStorage) + match por subsecuencia (fuzzy) antes que substring.
**Comando sugerido:** /impeccable polish

### [P3] Navegación sin landmarks semánticos ni aria-current (sigue abierto)
**Qué:** Sidebar/Header/main siguen siendo `<div>`; el botón de nav activo no anuncia `aria-current`. (El palette SÍ quedó accesible; el Sidebar no.)
**Fix:** `<nav>/<header>/<main>` + `aria-current="page"` en el activo del Sidebar.
**Comando sugerido:** /impeccable harden

### [P3] Ayuda general del shell aún ausente (#10 = 3, no 4)
**Qué:** Fuera de las pistas del palette, no hay un "?" ni un atajo a la WelcomeGuide desde el chrome.
**Fix:** Un acceso ligero a la guía/atajos (incluso como comando "Ayuda" dentro del propio palette).
**Comando sugerido:** /impeccable onboard

## Minor Observations

- **Deuda de código (no UI):** lógica CSV duplicada (header inline + `exportCSV`), pendiente de unificar (v10.72.41).
- **Foco al cerrar** el palette no vuelve al trigger (menor a11y).
- **Abrir el palette sobre otro modal** no está bloqueado (z-index 2000 lo deja usable; caso borde).
- **`transition:width` del sidebar** (L14938) sigue animando layout (toggle infrecuente).

## Questions to Consider

- ¿El palette merece fuzzy + recientes ya, o se deja correr en uso real y se refina con datos de cómo lo usan?
- ¿Vale cerrar la a11y del Sidebar (landmarks/aria-current) ahora que el palette ya quedó accesible, o es bajo-prioridad para un operador interno?
- El shell está en 33/40 (Great). ¿Hay apetito de empujar a 35+ (refinar #7/#10 + a11y), o el chrome ya cumple y conviene mover el foco a otra superficie (DetailModal→panel lateral, Tablero)?
