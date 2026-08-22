---
target: shell + navegación de PrintFlow (src/App.jsx)
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-06-22T23-43-05Z
slug: src-app-jsx-shell-navegaci-n
---
# Critique — Shell + Navegación (src/App.jsx) · run #3 post layout + polish

Register: **product**. Misma superficie (Sidebar + Header + contenedor de layout), medida tras v10.72.38 (/impeccable layout) y v10.72.39 (/impeccable polish).

## Design Health Score

| # | Heurística | Score | Issue clave |
|---|-----------|-------|-------------|
| 1 | Visibility of System Status | 3 | Dot de realtime siempre visible; aún sin eco del título de vista en el header |
| 2 | Match System / Real World | 3 | Secciones y labels hablan el dominio |
| 3 | User Control & Freedom | 3 | Colapsar sidebar persistido, Salir siempre visible; sin breadcrumb |
| 4 | Consistency & Standards | **4** ↑ | Subió de 3: un solo vocabulario de íconos, header agrupado, badge sin duplicar, alturas de control armonizadas (campana 40px), hover consistente. Residual menor: `#fff` del badge, `Row` 3× (fuera del shell) |
| 5 | Error Prevention | 3 | Salir limpia estado completo |
| 6 | Recognition vs Recall | 3 | Sidebar agrupado + etiquetado |
| 7 | Flexibility & Efficiency | 2 | **El piso.** Sigue sin atajos de teclado ni ⌘K (bet diferido) |
| 8 | Aesthetic & Minimalist | **4** ↑ | Subió de 3: header con ritmo (3 clusters, tight-dentro/suelto-entre) reemplaza la fila plana; campana pulida; badge dedup reduce clutter |
| 9 | Error Recovery | 3 | RootErrorBoundary + dot de reconexión |
| 10 | Help & Documentation | 2 | El shell aún no tiene afordancia de ayuda |
| **Total** | | **30/40** | **Good** (↑ desde 28) |

## Anti-Patterns Verdict

**No es slop.** Detector: **mismos 5 warnings, 0 errores** — los cambios de hover/campana no introdujeron patrones de slop. En el shell siguen aplicando 2: Geist "overused" (L1445) y `transition:width` del sidebar (L14860). El badge de la campana usa un anillo `box-shadow` (no glassmorphism, no side-stripe). **Navegador:** inspección en vivo no disponible (fallback).

## Overall Impression

Las dos pasadas (layout + polish) hicieron exactamente lo que prometían y el score lo refleja: **+2, todo concentrado en las dos heurísticas que tocamos** (Consistencia y Estética, ambas de 3 a 4). El header dejó de ser una fila plana de 8 controles y ahora es un toolbar agrupado con ritmo; la campana dejó de flotar; las acciones tienen feedback de hover y nombres accesibles. El shell-chrome está, para fines prácticos, **terminado y sólido**. El techo restante (28→30→¿más?) ya NO está en el chrome: está en las dos cosas que diferimos a propósito, **eficiencia (#7) y ayuda (#10)**, ambas en 2.

## What's Working

1. **Header con ritmo y jerarquía.** 3 clusters (Ver/buscar · Acciones · Sesión), spacing tight dentro / suelto entre + divisores. La squint-test ahora distingue grupos; antes era una tira uniforme.
2. **Detalle de la campana.** 40px (alineada + touch target), badge anclado al ícono con anillo. Es el tipo de detalle invisible que sube la percepción de calidad.
3. **Estados e identidad correctos.** Hover en todas las acciones, `aria-label` en los icon-only, y el badge de rol que aparece solo cuando el Sidebar colapsado esconde la identidad. Decisiones conscientes, no plantilla.
4. **Base intacta.** Token system coherente, IA del sidebar, activo multi-señal, RootErrorBoundary.

## Priority Issues (residual — el techo ya no está en el chrome)

### [P2] Cero atajos de teclado / command palette — ahora el lever #1
**Qué:** Cambiar de vista sigue siendo 100% click en el sidebar. Es la heurística más baja (#7 = 2).
**Por qué importa:** El usuario primario (Marcelo en admin, Gerardo/Lupita) cambia de vista decenas de veces al día. Es el único eje del shell que sigue en 2 y el que más siente el power user.
**Fix:** Hotkeys `g+<letra>` para las vistas top del rol y/o ⌘K alimentado por el array `navs` (ya tipado y filtrado por rol). El palette sale casi gratis del `navs` existente.
**Comando sugerido:** /impeccable craft

### [P3] Navegación sin landmarks semánticos ni aria-current
**Qué:** El polish agregó `aria-label` a los botones icon-only del header, pero el Sidebar/Header/main siguen siendo `<div>` y los botones de nav no anuncian el activo.
**Por qué importa:** Navegación por landmarks (lectores de pantalla) inexistente; el activo no se anuncia. Bajo riesgo para un operador interno, pero es la deuda de a11y que queda.
**Fix:** `<nav aria-label="Principal">` / `<header>` / `<main>` + `aria-current="page"` en el botón de vista activa.
**Comando sugerido:** /impeccable harden

### [P3] Sin afordancia de ayuda en el shell (#10 = 2)
**Qué:** No hay un "?" ni hint de atajos en el chrome. (Existen FirstTimeHints y WelcomeGuide, pero en el contenido, no en el shell.)
**Por qué importa:** Mantiene #10 en 2. Cobra sentido junto con ⌘K: un hint "⌘K para navegar" cierra ayuda + eficiencia de un tiro.
**Comando sugerido:** /impeccable onboard

## Minor Observations

- **`transition:width` del sidebar (L14860)** sigue animando layout (toggle infrecuente, aceptable).
- **`#fff`** en el texto del badge rojo de la campana (deliberado: tintar es invisible en 8px).
- **Dos lenguajes de hover** en el chrome: bg-tint (nav del sidebar, campana ghost) vs lift por sombra (botones sólidos de acción). Es defendible (tipos de botón distintos), pero vale tenerlo en el radar para no fragmentar.
- **`Row` definido 3×** (fuera del shell estricto).

## Questions to Consider

- ¿El ⌘K vale para esta base de usuarios? Marcelo (admin) sí es power user; ¿Gerardo/Lupita adoptarían un palette, o les sirven más los hotkeys `g+<letra>` visibles en un hint?
- ¿La versión "terminada" del shell incluye una historia mobile/tablet, o se asume desktop-only de forma permanente? (Sigue sin breakpoint.)
