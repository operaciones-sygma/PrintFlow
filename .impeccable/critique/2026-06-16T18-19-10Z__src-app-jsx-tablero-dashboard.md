---
target: src/App.jsx (Tablero/Dashboard)
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-06-16T18-19-10Z
slug: src-app-jsx-tablero-dashboard
---
# PrintFlow — Critique (Tablero/Dashboard) — re-run — Registro: product

## Design Health Score: 32/40 (Good, upper) — up from 29

| # | Heuristic | Before | Now | Note |
|---|---|---|---|---|
| 1 | Visibility | 3 | 3 | Skeletons replaced spinners |
| 2 | Match real world | 4 | 4 | Print-shop domain fluency |
| 3 | User control | 3 | 3 | Esc explicit |
| 4 | Consistency | 3 | 4 | Unified subtle-border accent across ~37 cards/columns; side-stripe gone |
| 5 | Error prevention | 3 | 3 | Immutable folio, confirms, RFC |
| 6 | Recognition | 3 | 3 | Icons+labels, typeahead, GUIDES |
| 7 | Flexibility | 2 | 3 | Keyboard shortcuts / n ? Esc |
| 8 | Aesthetic | 3 | 4 | Side-tab AI tell removed; subtle accents + polished motion |
| 9 | Error recovery | 3 | 3 | Good toasts; some window.alert remains |
| 10 | Help | 2 | 2 | ? shortcut helps; no searchable docs |

## Anti-Patterns Verdict
Markedly less AI-looking. Detector 41 -> 8. side-tab 33 -> 0. Card visual language is now a unified subtle tinted-border system.
Remaining (8): 6x layout-transition (progress-bar width + sidebar; transform:scaleX would be smoother), 2x overused-font (Geist; Arial = print template false positive).

## Priority Issues (remaining)
- [P2] Color-only accent (a11y): border is color; backed by stage chip icon. Ensure chip icon/label always primary. Command: /impeccable audit.
- [P2] window.alert / window.confirm in some flows. Command: /impeccable clarify.
- [P3] transition:width on progress bars -> transform:scaleX. Command: /impeccable animate or optimize.

## Persona Red Flags
- Karla (power user): now has / and n shortcuts; still no bulk-action shortcuts.
- Color-blind operator: tinted border alone insufficient, but stage chip icon covers it (partial).

## Questions
- Worth a /impeccable clarify pass to remove the last window.alert, or too few to matter?
- Is the stage chip icon present on ALL surfaces, or any where color stands alone?
