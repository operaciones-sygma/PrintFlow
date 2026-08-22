---
target: CTPMaintenanceCounter
total_score: 36
p0_count: 0
p1_count: 0
timestamp: 2026-08-22T09-36-17Z
slug: src-app-jsx-ctpmaintenancecounter
---
# /impeccable critique (3ª pasada) — CTPMaintenanceCounter (PrintFlow v10.80.5)

Score **36/40** (críticos 36/37/34), trend 27 → 32 → 36. AI-slop: **no** ("clearly artisanal", unánime). Detector: 0. Cero P0/P1/P2.

## Verificación adversarial: 4 reales (todos P3), resto falsos positivos. TODOS cerrados en v10.80.5:
- [P3 CONFIRMED] El fallo al registrar mantenimiento caía a `alert()` nativo (única costura sin diseñar) → error INLINE dentro de CTPResetConfirm (busy+err propios; doReset ahora solo lanza).
- [P3] "Placas históricas" (referencia) pesaba igual que el ciclo (18/800) → degradado a 18/600/C.t2, consistente con el "Total" degradado.
- [P3] Título 14 → F.title(15).
- [P3 CONFIRMED] Micro-labels 9px uppercase en C.t3 sobre C.sf ≈ 4.19:1 (bajo AA) → C.t2 (~4.63:1, pasa).

## Falsos positivos refutados
- "El héroe 30px viola hero-metric / excede el techo 9-15px" → FP: F es escala de TEXTO, no tope de números display; la app usa 24-36px de display por doquier; el ban de hero-metric es la plantilla SaaS con gradiente, no un número grande.
- micro-labels/barra ámbar bajo AA = house-style app-wide (número+píldora ya lo dicen; se mejoró igual el t3→t2 aquí).

## Lo que funciona (validado)
Punto focal inequívoco (héroe 30px domina), "sano=casi monocromo" bien ejecutado, ritmo referencia-arriba/acción-abajo, disciplina de contraste, robustez visible (skeleton/error/—/barra oculta), confirm accesible modelo.

**Meseta:** widget en 36/40, solo quedaban P3 triviales, ya cerrados. Más pasadas = rendimientos decrecientes.
