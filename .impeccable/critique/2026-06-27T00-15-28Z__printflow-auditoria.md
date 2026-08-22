---
target: Auditoría (AuditoriaView de PrintFlow)
total_score: 28
p0_count: 0
p1_count: 1
timestamp: 2026-06-27T00-15-28Z
slug: printflow-auditoria
---
## Design Health Score

| # | Heurística | Score | Issue clave |
|---|-----------|-------|-------------|
| 1 | Visibilidad del estado | 3/4 | Stat-cards + conteos en vivo, excelente; pero las 3 cargas RPC async (Corona/Cobranza) no tienen loading state → los números cambian solos al cargar. |
| 2 | Match con el mundo real | 4/4 | Español, vocabulario fiscal, prefijos D-/R-/P-/H-, "Lupita" en vez de `secretaria`. Habla el idioma exacto de la oficina. |
| 3 | Control y libertad | 3/4 | Esc-close, Limpiar, filas clickeables. Falta "limpiar todos los filtros"; el periodo es compartido entre tabs pero los chips se resetean al cambiar de tab (modelo mental inconsistente). |
| 4 | Consistencia y estándares | 2/4 | El sistema de color de badges COLISIONA: 4 verdes (ok/live/emr/sal) y 3 azulados (ac/fac/ios) con significados distintos. COMPARTIDO (verde) vs EN COBRANZAFLOW (azul) vs Con folio (índigo) no se aprenden de un vistazo. |
| 5 | Prevención de errores | 3/4 | Read-only = bajo radio de daño (fuerte). CSV se deshabilita en 0. Pero nada evita malinterpretar un gap falso como real antes de que llegue la data async. |
| 6 | Reconocer vs recordar | 2/4 | El "zoo de badges" (9+) fuerza recall. La leyenda está al FONDO, después de la lista: hay que pasar por todo lo que no entendiste para aprender qué significaba. |
| 7 | Flexibilidad y eficiencia | 3/4 | Búsqueda + chips + CSV + cross-link a OC/pipeline = potente para Marcelo. Falta: navegación por teclado de la secuencia, stat-cards sticky, deep-link a un folio. |
| 8 | Estético y minimalista | 2/4 | Las filas limpias, pero cada una apila 6+ chips inline + la leyenda final es un párrafo, no una clave. La relación señal/ruido cae en filas Corona/Cobranza. |
| 9 | Recuperación de errores | 3/4 | La fila FALTANTE · Verificar en AlphaERP dice qué y a dónde ir. Bien. Pero no distingue cuáles gaps falsos ya se auto-resolvieron sin leer la leyenda. |
| 10 | Ayuda y documentación | 3/4 | Los tooltips de los badges son documentación real y específica. La leyenda existe. Penalización: docs ancladas al fondo y sin diferenciar por tab. |
| **Total** | | **28/40** | **Bueno / profesional, con un techo de aprendibilidad** |

## Anti-Patterns Verdict

**¿Parece hecho por IA? NO.** Tiene cicatrices de dominio que una IA no inventaría: reconciliar el consecutivo contra TRES fuentes (Alpha + CobranzaFlow + Corona) para matar gaps FALSOS; badges como AUTO-FACTURA $0 / PAGADA EN ALPHA; historial versionado quirúrgico (v10.43→v10.72.73) con comentarios de razón. Restraint correcto para un ledger (sin gradient hero, sin glassmorphism, folios en monospace). El único residuo IA-ish leve: el mega-párrafo "Cómo interpretar" del fondo (humano sobre-explicando bajo ansiedad de auditoría, mal formateado).

**Detector determinista:** 6 warnings, **TODOS fuera de AuditoriaView** → dentro de la vista el scan está limpio. Arial (líneas 2491/2506) es del template de IMPRESIÓN (intencional, falso positivo); Geist (1614) es la fuente UI (legítima en el registro product — falso positivo); 3 `transition:width/height` (10157/10711/15380) están en StorageView/otras vistas (nit de perf real, pero no aquí — Auditoría correctamente usa transition de transform/color). El detector NO ve el problema real (el contrato de color); eso lo cazó la revisión humana.

**Overlays visuales:** no disponibles (herramienta interna autenticada, sin inyección en navegador / sin URL en vivo). Fallback: revisión de fuente.

## Overall Impression
Una herramienta fiscal interna genuinamente buena que se gana la confianza (28/40). El motor de reconciliación es la fortaleza; la LEGIBILIDAD de su salida es la deuda. El techo lo fijan dos cosas: un lenguaje de color que se quedó sin colores distintos, y una documentación entregada al final. Arregla el contrato de color y el triage del gap real y salta a ~33/40.

## What's Working
1. **Reconciliación de gaps falsos = UX de dominio de primer nivel.** Cruzar el consecutivo contra Alpha + CobranzaFlow + Corona DENTRO de la vista, con badges y tooltips por fila, hace que el auditor no tenga que recordar "ah pero D-5912 se canceló en Alpha". El sistema recuerda las excepciones por el humano. Por esto la herramienta se gana la confianza.
2. **Flip de color a verde en 0** (Gaps/Duplicados `?C.dn:C.ok`). Diminuto pero es la diferencia entre "leer un número" y "sentirse seguro" en un checkpoint fiscal.
3. **Profundidad de cross-linking.** De una fila anómala → ProductionOrderDetailModal → "Ir a la OC" / "Ver en pipeline" / expandir folio compartido. Marcelo baja de la anomalía al registro fuente en 2 clicks sin perder el hilo. El SharedFoliosModal (expandir → órdenes vinculadas) es elegante.

## Priority Issues

**[P1] El sistema de color de los badges se quedó sin colores distintos.** 4 verdes (ok/live/emr/sal) y 3 azulados (ac/fac/ios) codifican estados distintos; COMPARTIDO ≠ Con folio ≠ EN COBRANZAFLOW no son distinguibles por un no-power-user. *Por qué importa:* Lupita y hasta Karla pueden confundir "este folio está bien" con "es compartido" con "está en cartera"; en auditoría fiscal, un mal-leído = perseguir un no-problema o perder uno real. *Fix:* colapsar a un **contrato semántico de 3 niveles** (verde=benigno/resuelto, ámbar=requiere atención, rojo=acción) y diferenciar los sub-casos por **icono + etiqueta, NO por matiz**. Reservar un acento (índigo) solo para "tiene folio fiscal". → `/impeccable colorize`

**[P2] Las filas FALTANTE reales están sub-triadas.** Un gap genuino muestra solo FALTANTE · Verificar en AlphaERP: sin contexto vecino, sin monto, sin cliente esperado. *Por qué importa:* es la ÚNICA fila que de verdad requiere trabajo de Karla, y es la más pobre en información de la pantalla. *Fix:* en un gap real, mostrar las **fechas de los folios adyacentes** ("entre D-5910 del 12-jun y D-5912 del 13-jun") + un affordance de **"marcar revisado / cancelado en Alpha"** para que un gap se vuelva una tarea cerrable, no una etiqueta sin salida. → `/impeccable clarify`

**[P3] La reconciliación async no tiene loading state.** 3 RPCs alimentan los conteos sin skeleton; los números se mueven solos. *Por qué importa:* un conteo fiscal que cambia solo se lee como "el sistema no está seguro", erosionando la confianza justo donde la confianza ES el producto. *Fix:* skeleton en las stat-cards + una línea sutil "conciliando con Alpha/CobranzaFlow…" hasta que las 3 resuelvan; congelar el conteo de gaps hasta terminar. → `/impeccable harden`

**[P3] La leyenda es un glosario disfrazado de prosa.** ~150 palabras al fondo re-explicando cada badge. *Por qué importa:* es la documentación que el usuario necesita PRIMERO, entregada al FINAL y no escaneable. *Fix:* convertir a una **clave compacta de 2 columnas** (swatch+icono → significado de una línea), colapsable, anclada cerca de los chips (arriba); default colapsada para Marcelo, abierta para primerizos. Quitar el emoji 🎱 (choca con el sistema de iconos). → `/impeccable distill`

## Persona Red Flags

**Marcelo (dueño/admin, desktop power-user):** las **7 bandas de control antes de la fila 1** frenan su acción más común (vistazo → "¿estamos limpios?"); querría las stat-cards sticky + un titular "todo conciliado". No hay **deep-link a un folio** (no puede mandarle a Karla "mira D-5947 en Auditoría" como link).

**Karla (facturación, precisión fiscal es su trabajo):** el **conteo de gaps que se mueve solo al cargar** la hará desconfiar del número en una mañana lenta. La **fila FALTANTE pelona** le da una tarea sin manija: tiene que alt-tab a Alpha y reconstruir el contexto a mano. La herramienta deja de ayudar justo donde empieza su trabajo.

**Lupita (secretaria, menos técnica):** el **zoo de badges + leyenda al fondo** es una trampa de recall: ve AUTO-FACTURA $0 / PAGADA EN ALPHA sin saber que son benignos a menos que baje al muro de texto. Alta probabilidad de escalar un no-problema a Karla. Con 3 dimensiones de filtro (periodo + tipo + 5 chips) sin "reset", es fácil caer en un estado vacío sin saber cuál filtro lo causó.

## Minor Observations
- `t2` (#6c6c75) y `t3` (#73737b) son grises **visualmente idénticos** usados con pesos semánticos distintos.
- `XCircleIcon` se usa para AUTO-FACTURA $0 **y** CANCELADA EN ALPHA (mismo icono, distinto gris) → el icono no desambigua donde el color es el único diferenciador.
- El emoji 🎱 (Corona OC) es el único emoji en un sistema de iconos Phosphor → fuera de registro.
- En tablet angosta los 6+ chips hacen `flexWrap` y la fila se ve irregular (vista asumida desktop).
- La sección histórica H- corta el gap-fill en (maxH−minH)≤4000 y cae a lista dispersa **en silencio** — auditar la serie vieja pierde gaps sin avisar.
- El CSV ("compáralo contra AlphaERP") es la escotilla de escape real → admite que la auditoría in-app no se confía del todo como fuente de verdad.

## Questions to Consider
1. Si todo el punto es reconciliar contra Alpha+CobranzaFlow+Corona, ¿por qué la leyenda TERMINA con "exporta el CSV y compáralo contra AlphaERP"? O la reconciliación in-app es confiable (¿entonces para qué el ritual del CSV?) o no lo es (entonces ESE es el titular). ¿Cuál es?
2. La card de Gaps se pone verde en 0 — pero "0 gaps DESPUÉS de auto-explicar 8" es un hecho distinto a "0 gaps, corrida limpia". ¿Debería la card distinguir **"limpio"** de **"reconciliado-a-limpio"**?
3. Moviste compartidos inline→modal (bien). ¿La leyenda merece lo mismo? Y más radical: ¿deberían los gaps REALES ser lo único visible por default, con todo lo benigno/reconciliado colapsado tras un "ver todo el consecutivo"? El trabajo del auditor son las excepciones, no las 400 filas limpias.
4. Tres personas, una pantalla, necesidades opuestas: Marcelo quiere un veredicto de una línea, Karla una lista de gaps reales, Lupita no asustarse. ¿Un solo ledger denso es el vehículo correcto, o esto pide un split **"Resumen / Por revisar / Consecutivo completo"**?
