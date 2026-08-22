---
target: OCard (tarjeta de orden)
total_score: 30
p0_count: 0
p1_count: 2
timestamp: 2026-06-30T19-53-11Z
slug: src-app-jsx-ocard-tarjeta-de-orden
---
# /impeccable critique — OCard (re-score tras el arco) · src/App.jsx ~9606-9825 · Product

## Design Health Score

| # | Heurística | Score | Δ | Problema clave |
|---|-----------|:---:|:--:|---|
| 1 | Visibility of System Status | 3 | = | Fuerte (busy role=status, LiveTimer, ProgressBar); el toggle "+N" no anuncia aria-expanded |
| 2 | Match System / Real World | 4 | = | Español del taller exacto (D-/R-, "le toca a Karla", "REIMPRIMIR v2 obsoleta") |
| 3 | User Control & Freedom | 3 | = | Menú destructivo con Escape+clic-fuera; sin undo por-card |
| 4 | Consistency & Standards | 3 | +1 | Escala F + Badge; PERO el bloque fiscal son 9 divs inline que esquivan el sistema Badge |
| 5 | Error Prevention | 3 | = | Menú destructivo con etiquetas+divisor (gran fix); resta el clic-toda-la-card |
| 6 | Recognition Rather Than Recall | 3 | = | Tooltips; pero los iconos de utilidad son icon-only con label solo en hover |
| 7 | Flexibility & Efficiency | 3 | +1 | Teclado abre detalle, drag, nudge; sin multi-select ni atajo a las acciones |
| 8 | Aesthetic & Minimalist | 2 | +1 | Triage de badges aterrizó; el bloque fiscal sigue siendo un muro de 6-9 chips sin rango |
| 9 | Error Recovery | 3 | = | Estados con remedio nombrado ("lo captura Lupita en Editar Maquila") + nudge |
| 10 | Help & Documentation | 3 | = | GuideBanner por rol×etapa, contextual |
| **Total** | | **30/40** | **+3** | **Good** (subió de 27/40 "Acceptable") |

## Anti-Patterns Verdict
Pasa. No es slop: escala F real y referenciada, vocabulario Badge semántico, triage de 3 tiers, progressive disclosure (+N, ⋯), lógica de dominio. Detector determinista = **0 hits dentro de OCard** (los 6 del archivo son del template de impresión / otros componentes). Sin overlay de navegador (no disponible). El riesgo residual NO es genericidad, es fatiga de densidad en el bloque fiscal.

## Overall Impression
El trabajo de jerarquía es real y ATERRIZÓ en la fila de badges (T1/T2/T3 con Badge real) y en la seguridad de acciones destructivas (menú ⋯). NO aterrizó en el bloque fiscal/flags (sigue siendo 9 chips a medida que esquivan el sistema Badge) ni en la fila de iconos de utilidad. El bloque fiscal es el mayor lever restante, y golpea a Karla, la persona que vive ahí.

## What's Working
1. Triage T1/T2/T3 de la fila de badges (alertas→identidad→metadata+N): hace escaneable una fila densa, con Badge real.
2. Hardening destructivo: Regresar/Cancelar/NC/Borrar a un menú role=menu con etiquetas+divisor+Escape, espejo exacto de los gates.
3. Patrón "card muda → contexto accionable" (le toca a X + Recordar): empatía codificada para un worklist multi-rol.

## Priority Issues
[P1] Bloque fiscal/flags = muro plano de 9 chips a medida (sin Badge, sin rango). Líneas ~9705-9734. Es el mayor contribuidor de carga cognitiva y el valle emocional; golpea a Karla. Fix: tiered como la fila de badges (1 señal fiscal primaria = folio+pago; degradar agrupada/splits/post-edit/etc a chips Badge; colapsar la lista de splits). Comando: /impeccable distill + /impeccable extract.

[P1] Iconos de utilidad no accesibles como grupo. Líneas ~9746-9752. duplicate/print/flow/edit/move son icon-only con label solo en title (no es accessible name confiable). Fix: aria-label en cada uno + role=group aria-label. Comando: /impeccable harden.

[P2] Toggle "+N" sin estado anunciado (~9684). Falta aria-expanded/aria-label (el menú ⋯ sí lo tiene). Comando: /impeccable harden.

[P2] Clic-toda-la-card compite con zonas internas (nombre cliente abre client_history, indistinguible). Comando: /impeccable clarify.

[P3] Migración F incompleta: el bloque fiscal usa px crudos (11/10/9) en vez de F.body/meta/micro. Comando: /impeccable typeset.

## Persona Red Flags
- Sam (a11y): iconos de utilidad con title-only; +N sin aria-expanded. (Pero la card SÍ es focusable con anillo + Enter/Espacio — crédito.)
- Karla (folios): vive en el bloque fiscal, la parte MENOS diseñada; su folio (F.label 13) compite con el cart folio (F.title 15) que lo out-shout.
- Germán (de lejos): el chip de etapa (11px) puede envolver detrás de las alertas en flexWrap; su señal primaria debería ser la más grande/fija.
- Lupita (alto volumen): escanea decenas/día; el muro fiscal + la fila de 6-8 iconos gravan justo su escaneo.

## Questions to Consider
1. La fila de badges recibió el fix riguroso (tier+collapse) y el bloque fiscal (problema más difícil) solo una reubicación. La disciplina de jerarquía se detuvo en el fold.
2. ¿OCard es un componente o seis con gabardina? El role-gating es excelente pero ningún rol ve una card diseñada para él. ¿Variantes por rol sobre el mismo sistema Badge/token?
3. Para Germán (de lejos), ¿la etapa debería ser el elemento más grande y fijo, más que el nombre del cliente?
4. Si "iconos rojos casi idénticos → mis-click" justificó el menú ⋯, ¿"5-6 iconos slate casi idénticos" no justifica el mismo trato para los de utilidad?
