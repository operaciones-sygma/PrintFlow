---
target: src/App.jsx (Tablero/Dashboard)
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-06-16T17-15-11Z
slug: src-app-jsx-tablero-dashboard
---
# PrintFlow — Critique (Tablero / Dashboard) — Registro: product

## Design Health Score: 29/40 (Good)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Toasts, skeletons, realtime dot, stage badges; some async ops lack feedback |
| 2 | Match System / Real World | 4 | Fluent print-shop domain (folios D-/R-/P-, maquila, cuadra, Corona) |
| 3 | User Control and Freedom | 3 | Cancel/revert, Esc on modals; undo limited |
| 4 | Consistency and Standards | 3 | Cohesive after redesign; some stray radii/colors |
| 5 | Error Prevention | 3 | Confirms, immutable folio, RFC required, UNIQUE INDEX |
| 6 | Recognition vs Recall | 3 | Icons+labels, client typeahead, GUIDES; collapsed sidebar hurts recall |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts for daily high-volume users |
| 8 | Aesthetic and Minimalist | 3 | Cleaner after redesign; still side-stripe + badge noise |
| 9 | Error Recovery | 3 | Good toasts; some window.alert remains |
| 10 | Help and Documentation | 2 | Contextual GUIDES but no searchable help |

## Anti-Patterns Verdict
Partially AI-looking, concentrated in one place. Content is domain-specific (not generic), but card visual language relies on the #1 AI tell: colored left-accent border.

Deterministic scan (41 warnings):
- 33x side-tab (borderLeft 4px/3px solid colored accent) — dominant card language.
- 6x layout-transition (transition: width/height on progress bars + sidebar).
- 2x overused-font (Geist L1212; Arial L1920 = print template, false positive).

## Priority Issues
- [P1] Side-stripe accent border (33x), also color-only (a11y). Fix: leading colored dot + existing stage chip, OR subtle full tinted border, OR thin top-accent. Command: /impeccable distill or polish on OCard.
- [P1] No keyboard accelerators for daily power users (Karla/Lupita). Fix: / search, n new, j/k navigate, Enter open, Esc close. Command: /impeccable harden.
- [P2] window.alert / window.confirm still used. Fix: inline toasts / existing ConfirmModal. Command: /impeccable clarify.
- [P2] Color-only stage/urgency encoding (a11y, ~8% CVD). Fix: ensure every color carries icon/text. Command: /impeccable audit.

## Persona Red Flags
- Karla (power user): mouse-only, no shortcuts; split-invoice is many clicks; fatigue risk.
- Preprensa new-hire: collapsed sidebar icon-only (tooltips mitigate); dense day-1; GUIDES help.
- Color-blind operator: cannot tell urgente vs normal by the side-stripe (chip icon saves it).

## Minor Observations
- transition:width/height on progress bars/sidebar: prefer transform:scaleX. P3.
- Geist is now a common font; optional more-distinctive choice. Low value.
- Collapsed sidebar recall depends on tooltips. Acceptable.

## Questions
- Does the stage need a thick stripe, or would a single dot + the existing chip carry it (less AI-looking)?
- Who lives 6 hours/day here, and what would 5 keyboard shortcuts save them?
- Can a color-blind operator tell urgente from normal without color?
