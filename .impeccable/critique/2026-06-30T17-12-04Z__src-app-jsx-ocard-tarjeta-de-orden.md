---
target: OCard (tarjeta de orden)
total_score: 27
p0_count: 0
p1_count: 3
timestamp: 2026-06-30T17-12-04Z
slug: src-app-jsx-ocard-tarjeta-de-orden
---
# /impeccable critique — OCard (la tarjeta de orden de "Mis Pendientes")

Componente: src/App.jsx:9577-9811 · Register: Product · Revisión source-only (sin navegador).

## Design Health Score

| # | Heurística | Score | Problema clave |
|---|-----------|:---:|---|
| 1 | Visibility of System Status | 3 | Fuerte (busy overlay, LiveTimer, ProgressBar, nudge); solo señal visual, sin live-region. |
| 2 | Match System / Real World | 4 | Habla el español del taller con fluidez (D-/R-, "le toca a Lupita"). Su mejor dimensión. |
| 3 | User Control & Freedom | 3 | Revert/cancelar/mover existen; card click-para-abrir con islas stopPropagation, fácil mis-tap. |
| 4 | Consistency & Standards | 2 | 8 tamaños de fuente, radios 6/8/10/14, 3 idiomas de botón (bs/bt/inline). |
| 5 | Error Prevention | 3 | Buenos guards; falta diferenciar el trío destructivo de iconos 15px pegados. |
| 6 | Recognition Rather Than Recall | 3 | title= por todos lados; clip pelón / id vs production_number exigen recall. |
| 7 | Flexibility & Efficiency | 2 | Cero accelerators en la card (mouse-only, sin multi-select). |
| 8 | Aesthetic & Minimalist | 1 | El ancla: 11 banners + 16 badges + 8 iconos compiten; ninguna señal domina. |
| 9 | Error Recovery | 3 | Patrón excelente (error+culpable+dónde); baja por ser flag, no recuperación interactiva. |
| 10 | Help & Documentation | 3 | GuideBanner por rol×etapa; ayuda real pero sepultada. |
| Total | | 27/40 | Acceptable (borde superior, rozando Good) |

## Anti-Patterns Verdict

No parece IA: lo contrario. La IA es genérica/plana/sub-especificada; esta card es sobre-especificada e hiper-consciente del dominio (cita incidentes reales: P-3562, D-5880, KFC). El problema no es el contenido, es la jerarquía: está "over-earned", le falta un editor.

Detector (detect.mjs, exit 0): CERO antipatrones dentro de OCard (9577-9811). Hits en otra parte: Arial en hojas de impresión (2711/2726, correcto), Geist UI font (1761, defendible), transition:width/height (10453/11007/15996, barras de progreso fuera de OCard). El detector y la revisión coinciden: la higiene de código/tokens está bien; lo roto es el ranking, que ningún detector de CSS ve.

Overlays visuales: sin automatización de navegador en este entorno; fallback = revisión sobre código.

## Overall Impression

Tarjeta de altísima integridad operativa cuyo defecto es de jerarquía, no de contenido. Todo grita al mismo volumen (un RETRASO P0 pesa lo mismo que un tag Web). Mayor oportunidad: re-rankear por rol (Germán: ETAPA+ARCHIVO; Karla: FOLIO+PAGO; Lupita: FALTA-DATO+RESPONSABLE) en vez de solo ocultar con !compact/hp/vOwns.

## What's Working

1. El nudge de responsable (9709-9727): "le toca a {respName}" + Recordar, role-aware. El alma de la card.
2. El sistema Badge + tonos semánticos (1854): vocabulario reusable con intención documentada.
3. Error-con-dueño-y-lugar (9651): elimina el ticket de soporte; la card es la documentación.

## Priority Issues

[P1] Fila de badges sin jerarquía (16 chips, mismo peso), 9633-9658. Causa directa del Aesthetic=1. Fix: 3 tiers (alertas / identidad / metadata), tope ~6 + "+N". Comando: /impeccable distill.

[P1] Clúster destructivo = muro de iconos sin etiqueta, 9680-9694. Hasta 10 iconos 15px; 3 rojos casi idénticos (cancel / cancel-NC / delete), label solo en title. Fix: separar destructivo a menú "⋯ Más" con etiquetas + divisor. Comando: /impeccable harden + /impeccable layout.

[P1] Crecimiento vertical desbocado: hasta 11 banners arriba del cliente, 9603-9632. Fix: fundir filas fiscales en 1 línea con pill; flags raros a badges; subir cliente al tope. Comando: /impeccable distill + /impeccable layout.

[P2] Escala tipográfica caótica (8 tamaños, varios a 1px). Fix: escala de 5 pasos como tokens F.*. Comando: /impeccable typeset.

[P2] a11y (div clickable no focusable, señales color-only) + cero accelerators para alto volumen. Fix: rol/foco/teclado, texto en señales, multi-select batch. Comando: /impeccable audit + /impeccable optimize.

## Persona Red Flags

Alex (power/admin): sin teclado a la acción primaria; 3 iconos rojos idénticos a hover-leer; set de 10 botones cambia por etapa/rol, sin memoria muscular.
Sam (a11y): div no focusable; estado por color/icono sin texto; sin live-region; contraste t3 9-10px al borde de AA.
Germán (piso, de lejos): etapa = chip 11px perdido entre 16; borde tintado ~40% alpha demasiado sutil; archivo en 2 señales, ninguna glanceable.
Karla (folios/dinero): primario "Asignar Folio" junto a 2 decisiones de dinero, ninguna domina; salvaguarda anti-doble-cobro en un title.

## Minor Observations
- Sin escala de radios (6/8/10/14). Elige 3.
- bs/bt/overrides inline: el helper no unifica; un parámetro size lo haría.
- marginBottom:4 repetido ~10× → usar gap.
- o.id a 9px junto a cart_folio 16px: casi invisible.
- Chip de pago inline sin flexWrap envuelve feo con folio largo.
- compact oculta ~70% de flags: misma orden distinta en Pipeline vs Mis Pendientes.

## Questions to Consider
1. ¿Una señal primaria por rol (re-rankear, no solo ocultar)?
2. ¿Los 11 banners como UNA línea de excepción que solo aparece si algo está mal?
3. ¿El trío destructivo es siquiera acción de card, o va al DetailModal?
4. ¿La fila de badges como componente ordenado/capado/overflow ("+N")?
