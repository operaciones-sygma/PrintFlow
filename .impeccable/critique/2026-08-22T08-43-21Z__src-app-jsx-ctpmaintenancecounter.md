---
target: CTPMaintenanceCounter
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-08-22T08-43-21Z
slug: src-app-jsx-ctpmaintenancecounter
---
# /impeccable critique (2ª pasada) — CTPMaintenanceCounter (PrintFlow)

Register **product** · "El Taller Ordenado" · panel de 3 críticos + verificación adversarial. Tras los fixes del critique v10.80.2 + el scan v10.80.3.

## Design Health Score: **32/40** (subió de 27) — bien, sin P0/P1/P2

Críticos: 32 / 33 / 31. AI-slop: **no** (unánime). Detector determinista: **0**.

| # | Heurística | ~Score | Nota |
|---|---|---|---|
| 1 | Visibilidad del estado | 4 | skeleton, error+Reintentar, realtime a ctp_maintenance, barra, píldora. (menor: barra sin role=progressbar/aria-live) |
| 2 | Match mundo real | 4 | lenguaje del operador impecable |
| 5 | Prevención de errores | 4 | confirm accesible, busy guards, load fail-closed |
| 6 | Reconocer > recordar | 4 | todo etiquetado, umbral /350 visible |
| 8 | Estética/minimalismo | **2** | jerarquía invertida en reposo (ver P3-A) |
| resto (3,4,7,9,10) | 3 | sólidos; derivas menores de escala/copy |
| **Total** | **32/40** | **Aceptable-bueno; solo pulido P3** |

## Verificación adversarial: 10 hallazgos → 2 temas reales (todos P3), resto falsos positivos

### Reales (P3)
- **[P3-A · consenso de los 3 críticos] Jerarquía invertida en reposo.** En estado ok (95% del tiempo) el "Total m² procesados" (22px/800, negro ~15:1, ARRIBA) le gana visualmente al héroe "m² desde el último mantenimiento" (30px/800, cian C.ctp #0891b2 ~3.3:1): el número de CONTEXTO domina al de ACCIÓN por contraste. **Fix:** el héroe en ok va en tinta oscura C.tx (color reservado para alarma soon/due) y el Total se degrada a referencia (18px/600/C.t2). También sube el contraste del número del modal (V7 CONFIRMED: colTx #0891b2 a 12.5px reprobaba AA en el modal — el mismo fix lo cubre).
- **[P3-B · copy] Pulido.** "Placas histórico" (agramatical) → "Placas históricas"; comillas curvas del footer → rectas (consistencia con el modal).

### Falsos positivos refutados
- "El kicker TOTAL M² secuestra la gestalt" → FP: está inline en fila flex baseline junto a su número (par etiqueta-valor), no como eyebrow que titula el bloque.
- "El m² histórico aparece 2 veces" → FP: el m² del recuadro histórico es la "conversión a m²" que Marcelo pidió en la spec; par simétrico deliberado.
- "Colorear el héroe en ok = tell de slop" → FP: 30px es texto grande, pasa AA 3:1; era preferencia de gusto (igual se movió a C.tx por la jerarquía).
- Micro-labels 9px C.t3 + barra ámbar 2.16:1 → house-style / no-texto redundante (número+píldora ya lo dicen); cambiarlo divergiría del resto de la app.

## Lo que funciona (validado por el panel)
1. El fix de contraste aterrizó: tinta oscura #b45309/#b91c1c en soon/due; el semáforo brillante solo en barra/borde/tinte.
2. Estados robustos: skeleton anti-parpadeo, error con Reintentar, realtime propio a ctp_maintenance (evita falso "vencido" entre sesiones).
3. Manejo ejemplar del "sin mantenimiento base": oculta barra y /350, re-etiqueta, muestra "—" en vez de 0.
4. Confirm accesible de verdad (role/aria-modal/Escape/autofoco). Sin card-in-card. Barra por transform.

## Trend
27 → 32 (2 corridas). Los P3 reales cerrados en v10.80.4.
