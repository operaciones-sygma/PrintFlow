---
target: src/App.jsx (Tablero/Dashboard + vistas, post rework de ancho)
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-06-16T21-49-30Z
slug: src-app-jsx-tablero-dashboard
---
# /impeccable critique — PrintFlow (src/App.jsx)

## Design Health Score
| # | Heuristica | Score | Issue clave |
|---|-----------|-------|-------------|
| 1 | Visibilidad del estado | 3 | dot de conexion color-only sin label al colapsar sidebar |
| 2 | Match con el mundo real | 4 | vocabulario 100% del piso, excelente |
| 3 | Control y libertad | 3 | falta undo tras acciones irreversibles |
| 4 | Consistencia | 2 | 2 verdes/2 azules de exito, 12+ colores fuera del tema, emoji-nav vs Phosphor, select+drag misma accion |
| 5 | Prevencion de errores | 3 | modal asignar con aviso de cola, validacion folios |
| 6 | Reconocimiento vs recall | 3 | OCard con 12 badges = busqueda visual |
| 7 | Flexibilidad y eficiencia | 2 | sin atajos teclado ni bulk-select |
| 8 | Estetico y minimalista | 2 | OCard clutter: 12 badges + 9 botones icono |
| 9 | Recuperacion de errores | 3 | algunos alert() lejos del campo |
| 10 | Ayuda y documentacion | 2 | hints dismiss-once no re-accesibles, folios sin glosario |
| Total | | 27/40 | ACEPTABLE (limite alto) |

## Anti-Patterns Verdict
No parece AI. Tell real: deuda de sistema de color + sin punto de vista de marca (acento teal-gris en una imprenta). Detector: 8 warnings, overused-font x2 falsos positivos (Arial print-CSS, Geist comentario), layout-transition x6 menores. Sin anti-patrones error-level; limpieza previa aguanto.

## Priority Issues
- [P1] A11y WCAG AA: contraste t3 (~2.7:1) y ph (~2:1) bajo 4.5:1 en texto 9-10px; botones icono-solo con title no aria-label; tablero drag-only sin ruta teclado; categoria color-only. -> audit, harden
- [P1] Sistema de color fracturado + sin POV de marca: consolidar tokens en C, un solo verde exito, acento intencional. -> colorize
- [P2] OCard sobrecargada: 12 badges + 9 botones icono, sin jerarquia; agrupar en 3 zonas, menu ..., un peso-800 por card; card por rol. -> distill, layout
- [P3] Sin atajos teclado ni bulk: Ctrl+K, foco busqueda /, bulk-select en Todas/Pendientes. -> optimize
- [P2] Ayuda no re-accesible + folios sin glosario: boton ? que reabre guia, leyenda inline de folios. -> onboard, clarify

## Persona Red Flags
- Alex: sin bulk-select (Karla factura una por una), sin Ctrl+K, select abre confirmacion redundante.
- Sam: tablero drag-only no por teclado, color-only, icono-solo, contraste t3/ph bajo.
- Gerardo: tap targets 8-9px, texto 8-9px ilegible de lejos, sin undo.

## Minor Observations
- confirm/alert nativos rompen cohesion; dos modelos para asignar maquina; nav activo cuadruple-codificado; transition:width anima layout; toast exito 3.2s corto para acciones financieras.

## Questions
- Imprenta sin opinion cromatica? El Tablero tiene alma, el Dashboard no. Costo de no tener bulk para Karla. OCard 60% ruido por rol. Momento de mas riesgo financiero = UI mas densa.
