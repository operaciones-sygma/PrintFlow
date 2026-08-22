---
target: shell + navegación de PrintFlow (src/App.jsx)
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-06-22T22-57-18Z
slug: src-app-jsx-shell-navegaci-n
---
# Critique — Shell + Navegación (src/App.jsx)

Register: **product** (SaaS interno, app de tarea). Scope: el armazón que contiene las 16 vistas — Sidebar (L14848-14865), Header (L14869-14904), contenedor de layout (L14906). NO los componentes internos de cada vista.

> **Nota de scope:** el target original (nav-bar superior + menú "más", L14859-14884) es **código muerto** desde el redesign v10.60.0. `visibleNavs=[]` y `moreNavs=[]` (L14818-14819) → ese bloque del header no renderiza nada. La navegación real vive en el **Sidebar lateral**. La critique se reorientó al shell real.

## Design Health Score

| # | Heurística | Score | Issue clave |
|---|-----------|-------|-------------|
| 1 | Visibility of System Status | 3 | Dot de realtime siempre visible (incluso colapsado) + activo claro; falta eco del título de vista en el header |
| 2 | Match System / Real World | 3 | Labels y secciones (Operación/Comercial/Control/Registros) hablan el dominio de imprenta; el split emoji-vs-Phosphor enturbia |
| 3 | User Control & Freedom | 3 | Colapsar sidebar (persistido), Salir siempre visible; sin breadcrumb/back |
| 4 | Consistency & Standards | 2 | **El punto débil.** Código muerto en el shell, doble vocabulario de íconos (emoji `n.i` + Phosphor), badge de rol duplicado, max-width como ternario ad-hoc |
| 5 | Error Prevention | 3 | Salir limpia estado completo; poco destructivo en el shell |
| 6 | Recognition vs Recall | 3 | Sidebar muestra todo agrupado+etiquetado; colapsado = solo íconos (con title) |
| 7 | Flexibility & Efficiency | 2 | Sin atajos de teclado ni command palette para cambiar de vista; operador 100% mouse |
| 8 | Aesthetic & Minimalist | 3 | Sistema de tokens limpio y restrained; pero el header es una fila plana de 8 controles que pelea con el wrap <1500px |
| 9 | Error Recovery | 3 | RootErrorBoundary recuperable + dot de reconexión |
| 10 | Help & Documentation | 2 | El shell no tiene afordancia de ayuda (sin menú ?, solo title attrs) |
| **Total** | | **27/40** | **Good** |

## Anti-Patterns Verdict

**No es AI slop.** El sistema de diseño es real y coherente: `C` con neutrales tintados (canvas `#f0f3f7` frío, no gris puro), acento restrained (slate-teal `#4a6572`), vocabulario semántico (ok/wn/dn/fac/…), Badge component, helpers bt/bs. Un usuario fluido en Linear/Notion confiaría en esto.

**Scan determinista:** 5 warnings, 0 errores. Dentro del shell aplican 2 — `transition:width` del sidebar (L14849, anima propiedad de layout) y Geist marcada como "overused font" (L1437). Los otros 3 (layout-transition L9782/L10336, Arial de print L2220) caen fuera del armazón.

**Falso positivo descartado:** la barra de acento de 3px en el nav activo (L14859) NO es el ban "side-stripe border" — es un indicador de activo posicionado (patrón estándar tipo VS Code/Linear), no un borde decorativo en card.

**Navegador:** inspección visual en vivo no disponible en este entorno (sin automatización de browser). Sin overlay visible; reporto fallback.

## Overall Impression

El shell está **sólido y es deliberado** — el token system, el agrupamiento del sidebar y el role-awareness son trabajo de verdad, no plantilla. El techo no es estético sino de **consistencia estructural**: arrastra deuda de la migración v10.60.0 (un sistema de navegación entero quedó muerto pero presente) y duplica señales (íconos en dos vocabularios, rol en dos lugares). La mayor oportunidad: **terminar la migración del shell** — borrar lo muerto, unificar a un solo vocabulario de íconos, y sacar el max-width a un token derivable.

## What's Working

1. **Sistema de tokens coherente (no slop).** `C` con neutrales tintados hacia el hue de marca, acento restrained al ≤10%, sombras sh1/sh2/sh3, tabular-nums. Es un design system de verdad.
2. **IA del sidebar.** Aplastar 10-16 vistas en 4 secciones escaneables (Operación/Comercial/Control/Registros) + nav por rol (cada quien ve solo lo suyo) es buena arquitectura de información.
3. **Estado de activo multi-señal.** Barra de acento izquierda + ícono en weight=fill + fondo tintado = activo inequívoco. Y el dot de realtime reubicándose al colapsar (badge sobre el logo) es craft fino.
4. **Recuperación.** RootErrorBoundary da fallback recuperable; focus-visible, reduced-motion, scrollbar custom — los detalles invisibles están.

## Priority Issues

### [P1] Código muerto del shell viejo + doble vocabulario de íconos
**Qué:** El header todavía renderiza `visibleNavs.map` y todo el bloque del menú hamburguesa "Más vistas" (L14872-14886), pero `visibleNavs` y `moreNavs` son `[]`. Además cada entrada de `navs` carga un emoji (`i:"📊"`) que el Sidebar **ignora** (usa `NAV_ICON[n.id]` de Phosphor) — el emoji solo se consumía en ese código muerto.
**Por qué importa:** Dos sistemas de navegación e íconos coexistiendo, uno fantasma. Es deuda que confunde a quien edite, y el emoji-vs-Phosphor se filtra a superficies vivas (los chips "ver como rol" L14917 usan 🟣🔵🩷, varios h3 usan emoji) → vocabulario de íconos inconsistente, un ban del register product.
**Fix:** Borrar el bloque `visibleNavs`/`moreNavs`/menú-hamburguesa del header. Quitar el campo `i:` emoji de `navs` (o convertirlo en la fuente única y matar Phosphor — elegir UNO). Auditar emojis en chips/headers vivos y migrarlos a Phosphor.
**Comando sugerido:** /impeccable distill

### [P1] El max-width por vista es un ternario anidado ilegible
**Qué:** L14906 calcula el ancho con `(view==="board"&&(user===...))?"none":(view==="form"?820:(["tasks","orders","oc","chemicals"].includes(view)?"none":(["pipeline","archive","wip","health","torre","audit","analytics"].includes(view)?1680:1300)))`.
**Por qué importa:** Agregar o re-anchar una vista exige descifrar un ternario de 4 niveles con listas de strings hardcodeadas. Es frágil y la lógica no es derivable de ningún token. Riesgo de que una vista nueva caiga en el ancho equivocado por descuido.
**Fix:** Mover el ancho a un mapa declarativo, p.ej. `VIEW_MAXW={board:"none",form:820,tasks:"none",...}` con default 1300, y leer `VIEW_MAXW[view]??1300`. Un solo lugar, legible, extensible.
**Comando sugerido:** /impeccable layout

### [P2] Header = toolbar plano de 8 controles sin agrupar
**Qué:** Filtro Mis/Todas, búsqueda, campana, botón Inventario (emerald), botón Corona (ctp), CSV, badge de rol, Salir — todo en una fila `gap:6` sin separadores ni grupos. El propio comentario (L14868) admite que pelea contra el wrap a 2ª fila en <1500px.
**Por qué importa:** Carga cognitiva y fragilidad de layout. Acciones de naturaleza distinta (filtro de datos vs lanzar modal vs exportar vs salir) se ven con el mismo peso. El badge de rol además **duplica** el rol que ya está en el footer del sidebar.
**Fix:** Agrupar con separadores finos: [búsqueda+filtro] | [campana] | [Inventario, Corona, CSV] | [salir]. Quitar el badge de rol del header (ya vive en el sidebar). Considerar colapsar Inventario/Corona/CSV en un overflow "•••" cuando el rol no los use seguido.
**Comando sugerido:** /impeccable layout

### [P2] Cero atajos de teclado / command palette
**Qué:** Cambiar de vista es 100% click en el sidebar. No hay hotkeys (p.ej. g+t Tablero, g+p Pendientes) ni command palette (⌘K).
**Por qué importa:** El usuario primario (Gerardo en Tablero, Lupita capturando) cambia de vista decenas de veces al día. Sin teclado, cada cambio es un viaje del mouse al sidebar. Es justo el red-flag del power user.
**Fix:** Atajos g+<letra> para las vistas top del rol, y/o un ⌘K que liste `navs` filtrados por rol. El array `navs` ya existe y está tipado — alimenta el palette gratis.
**Comando sugerido:** /impeccable craft

### [P3] Falta de landmarks semánticos y aria-current
**Qué:** Sidebar, header y main son `<div>`. Los botones de nav no tienen `aria-current="page"`. No hay `<nav>`/`<header>`/`<main>`.
**Por qué importa:** Navegación por landmarks (lectores de pantalla) inexistente; el activo no se anuncia. Para una app interna de un operador es bajo riesgo, pero es deuda de accesibilidad barata de saldar.
**Fix:** Envolver en `<nav aria-label="Principal">`, `<header>`, `<main>`. Añadir `aria-current="page"` al botón de vista activa.
**Comando sugerido:** /impeccable harden

## Persona Red Flags

**Alex (Power User) — Gerardo/Lupita todo el día:** Sin atajos de teclado ni ⌘K: cada cambio de vista es mouse→sidebar. El header de 8 controles obliga a buscar visualmente la acción cada vez. Inventario y Corona compiten en peso con Salir.

**Jordan (First-Timer) — contratación nueva:** El sidebar etiquetado y agrupado lo salva (recognition fuerte). Pero si la sesión previa dejó el sidebar colapsado (estado persistido), aterriza en una columna de íconos sin texto y depende de hover→title. El split emoji/Phosphor lo hace dudar de si son cosas distintas.

**Gerardo (Producción, heads-down) [proyecto]:** Colapsa el sidebar para ganar pantalla en el Tablero. La animación de `width` al colapsar (L14849) puede tironear en una PC de taller modesta. Sin hotkey para saltar Tablero↔Pendientes, sale del modo heads-down para navegar.

## Minor Observations

- **`transition:width` del sidebar (L14849)** anima una propiedad de layout (warning del detector). Para colapsar 222↔64px, considerar `transform`/`grid-template-columns` o aceptar el costo (es un toggle infrecuente).
- **`#fff` directo** en texto de botones/badges (bt/bs default, badge de rol). El shared-law prohíbe `#fff` puro; tintar levemente hacia el hue. Nit menor (texto sobre acento).
- **Geist como fuente primaria** está en la lista de "overused fonts" del detector. Para una app interna la familiaridad es feature, no bug — bajo a no-acción, pero queda anotado.
- **`Row` definido 3 veces** (L2584, L12000, L12585) con firmas distintas. Fuera del shell estricto, pero es señal de vocabulario de componentes fragmentado.
- **Badge de rol duplicado** sidebar-footer + header (ya cubierto en P2).

## Questions to Consider

- ¿El shell debe seguir asumiendo desktop-only? No hay breakpoint: en tablet/teléfono el sidebar fijo + contenido a 1680px da scroll horizontal. ¿Algún rol lo abre en tablet en piso?
- ¿Un solo vocabulario de íconos (Phosphor) en TODA la app, retirando los emoji de chips y headers — o los emoji son intencionales como señal cálida de rol?
- ¿Qué se sentiría como la versión "terminada" de la migración v10.60.0 — borrar lo muerto es higiene, pero hay algo del shell viejo que valga rescatar?
