---
target: shell + navegación de PrintFlow (src/App.jsx)
total_score: 28
p0_count: 0
p1_count: 0
timestamp: 2026-06-22T23-14-25Z
slug: src-app-jsx-shell-navegaci-n
---
# Critique — Shell + Navegación (src/App.jsx) · re-run post-higiene

Register: **product**. Scope: el armazón (Sidebar + Header + contenedor de layout). Re-corrida tras la tanda de higiene v10.72.19 (borrado del shell viejo muerto, vocabulario de íconos unificado a Phosphor, max-width declarativo).

## Design Health Score

| # | Heurística | Score | Issue clave |
|---|-----------|-------|-------------|
| 1 | Visibility of System Status | 3 | Dot de realtime siempre visible; falta eco del título de vista en el header |
| 2 | Match System / Real World | 3 | Íconos ya unificados (Phosphor); labels y secciones hablan el dominio |
| 3 | User Control & Freedom | 3 | Colapsar sidebar (persistido), Salir siempre visible; sin breadcrumb |
| 4 | Consistency & Standards | **3** ↑ | Subió de 2: código muerto borrado, vocabulario de íconos unificado, max-width a mapa declarativo. Residual: badge de rol duplicado (sidebar+header), `Row` definido 3× |
| 5 | Error Prevention | 3 | Salir limpia estado completo |
| 6 | Recognition vs Recall | 3 | Sidebar agrupado + etiquetado; colapsado = íconos con title |
| 7 | Flexibility & Efficiency | 2 | Sin atajos de teclado ni ⌘K (P2 diferido por decisión de scope) |
| 8 | Aesthetic & Minimalist | 3 | Clutter latente del shell viejo removido; el header sigue siendo fila plana de 8 controles (P2 diferido) |
| 9 | Error Recovery | 3 | RootErrorBoundary recuperable + dot de reconexión |
| 10 | Help & Documentation | 2 | El shell no tiene afordancia de ayuda |
| **Total** | | **28/40** | **Good** (↑ desde 27) |

## Anti-Patterns Verdict

**No es AI slop** (sin cambio: el design system sigue siendo coherente y real). El scan determinista devuelve los **mismos 5 warnings, 0 errores** — esperado, porque la higiene no tocaba patrones de slop. En el shell aplican 2: Geist "overused font" (L1444) y `transition:width` del sidebar (L14855), ambos conocidos y diferidos. **Navegador:** inspección en vivo no disponible (fallback, sin overlay).

## Overall Impression

La tanda de higiene hizo exactamente lo que prometía: cerró la deuda de **consistencia estructural** del shell. La heurística #4 sube de 2 a 3 — el sistema de navegación fantasma de v10.60.0 ya no existe, el vocabulario de íconos es uno solo (Phosphor), y el ancho por vista es legible y extensible. El score sube modestamente (27→28) porque lo que queda son los ejes que **se difirieron a propósito**: eficiencia (#7, sin atajos) y ayuda (#10), más el layout del header. No son deuda nueva; son backlog triado.

## What's Working

1. **Higiene cerrada.** Cero referencias colgantes, un solo vocabulario de íconos en el chrome, `VIEW_MAXW` declarativo. El shell quedó −15 líneas y más legible. Build + sintaxis verdes.
2. **Chips de rol mejorados.** El dot de color con `rC[rol]` + `UserIcon` es más sobrio y consistente que el emoji de círculo, sin perder la codificación de color por rol.
3. **El núcleo sólido sigue intacto.** Token system coherente, IA del sidebar por secciones, role-awareness, RootErrorBoundary, estado de activo multi-señal.

## Priority Issues (residual — backlog diferido)

### [P2] Header = toolbar plano de 8 controles + badge de rol duplicado
**Qué:** Filtro, búsqueda, campana, Inventario, Corona, CSV, badge de rol, Salir en fila `gap:6` sin separadores ni grupos; el badge de rol repite el del footer del sidebar.
**Por qué importa:** Carga cognitiva y fragilidad de layout (<1500px). Acciones de naturaleza distinta con el mismo peso.
**Fix:** Agrupar con separadores `[búsqueda+filtro] | [campana] | [Inventario/Corona/CSV] | [salir]`; quitar el badge de rol redundante.
**Comando sugerido:** /impeccable layout

### [P2] Cero atajos de teclado / command palette
**Qué:** Cambiar de vista es 100% click en el sidebar.
**Por qué importa:** El usuario primario cambia de vista decenas de veces al día.
**Fix:** Hotkeys `g+<letra>` y/o ⌘K alimentado por el array `navs` (ya tipado por rol).
**Comando sugerido:** /impeccable craft

### [P3] Faltan landmarks semánticos y aria-current
**Qué:** Sidebar/header/main son `<div>`; los botones de nav no anuncian el activo.
**Fix:** `<nav>/<header>/<main>` + `aria-current="page"`.
**Comando sugerido:** /impeccable harden

## Minor Observations

- **`transition:width` del sidebar (L14855)** sigue animando una propiedad de layout (warning del detector). Es un toggle infrecuente; aceptable, o migrar a `transform`/`grid-template-columns`.
- **`Row` definido 3×** con firmas distintas — vocabulario de componentes fragmentado (fuera del shell estricto).
- **`#fff` directo** en texto sobre acento (nit del shared-law).
- **Geist como fuente primaria** en la lista de "overused"; para app interna la familiaridad es feature (no-acción).

## Questions to Consider

- ¿El siguiente movimiento de mayor ROI es eficiencia (atajos/⌘K, sube #7) o layout del header (sube #8 y quita la duplicación del badge)?
- ¿Vale ya cerrar el `Row` definido 3× en una sola fuente, o se deja como deuda separada del shell?
