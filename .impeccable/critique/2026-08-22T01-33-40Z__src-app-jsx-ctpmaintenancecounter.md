---
target: CTPMaintenanceCounter
total_score: 27
p0_count: 0
p1_count: 0
timestamp: 2026-08-22T01-33-40Z
slug: src-app-jsx-ctpmaintenancecounter
---
# /impeccable critique — CTPMaintenanceCounter (medidor CTP · PrintFlow)

Register **product** · sistema "El Taller Ordenado" · panel de 3 directores + verificación adversarial. PrintFlow no tiene PRODUCT.md (contexto dado inline).

## Design Health Score

| # | Heurística | Score | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado | 3 | Muestra total/ciclo/placas/último mantenimiento/base. Falta skeleton: mientras carga muestra 0.0 (parpadeo de ceros). |
| 2 | Match con el mundo real | 3 | Lenguaje de piso perfecto. Pero "≈ 40,624.1 m²" cuando ese total es la lectura EXACTA de la máquina (el "≈" sobra). |
| 3 | Control y libertad | 3 | Confirm cancelable antes de reiniciar. Sin Escape; sin deshacer un mantenimiento mal registrado. |
| 4 | Consistencia y estándares | 2 | El recuadro grande repite chrome de card DENTRO de la card (card-in-card limítrofe); los 2 de abajo NO se ven como recuadros (C.bg === C.card); ámbar/rojo crudos como texto; el confirm no sigue el patrón de diálogo de la app. |
| 5 | Prevención de errores | 3 | Confirm con consecuencia clara ("se reinicia a 0" + m²/placas actuales) + gate por rol. |
| 6 | Reconocer > recordar | 3 | Todo etiquetado, umbral /350 visible, footer con contexto. |
| 7 | Flexibilidad y eficiencia | 3 | Medidor de lectura + 1 acción; correcto para su alcance. |
| 8 | Estético y minimalista | 2 | El diseño de "3 recuadros" que pediste NO se lee (2 son invisibles); el total m² compite/duplica; ámbar ilegible. |
| 9 | Recuperación de errores | 2 | `load()` falla en silencio → muestra ceros como si el CTP estuviera en cero (fail-open); reset usa `alert()`. |
| 10 | Ayuda y documentación | 3 | Buena ayuda inline (footer, "sin mantenimiento base aún", subtítulo con la fuente). |
| **Total** | | **27/40** | **Aceptable, con arreglos claros** (widget nuevo sin pulir). |

## Anti-patrones — veredicto

**¿AI-slop? NO** (unánime): matemática de dominio real, baseline estático como lo pediste, copy calmo, íconos semánticos, estado no depende solo del color (píldora con TEXTO). Los "tells" son de gusto/a11y, no de slop.

**Detector determinista:** 1 hallazgo — la barra de progreso anima `width` (propiedad de layout; usar `transform`).

## Verificación adversarial: ~12 crudos → 4 reales (3 falsos positivos)

### Reales (arreglar)

- **[P2] Ámbar/rojo como TEXTO reprueban contraste — justo cuando importa.** *Consenso de los 3 críticos.* En estado "soon", `col = C.amb #ff9500` sobre el panel casi-blanco da **~2.2:1** (reprueba hasta el 3:1 de texto grande); el rojo #e03b30 da ~4.26 (la píldora de 11px reprueba 4.5). El número héroe de 30px y la píldora de aviso usan `col` como color de texto. Germán lee esto en tablet del taller con reflejo, en el momento exacto de "por vencer/vencido". **Fix:** separar relleno de texto — barra/borde siguen en #ff9500, pero el número y el texto de la píldora en un ámbar-tinta oscuro (~#b45309 ≈ 4.95:1) y un rojo de texto más oscuro. PrintFlow no tiene token *Ink, así que hay que agregarlo o usar el hex.
- **[P2] Los "3 recuadros" no se leen como recuadros.** `C.bg` y `C.card` son el **mismo hex** (#fcfdfe): los 2 recuadros de placas (fondo C.bg, sin borde) son invisibles contra la card → solo padding. Y el recuadro grande sí repite chrome de card (borde 1.5px + radio) DENTRO de la card = card-in-card limítrofe. Resultado: el layout de 3 recuadros que pediste no se distingue. **Fix:** dar a los 3 un fondo que sí contraste (`C.sf` #eff2f6) sin repetir chrome de card, o separarlos con hairlines; quitarle al grande la lectura card-in-card.
- **[P3] El confirm no usa el patrón de diálogo de la app + `load()` falla en silencio.** El confirm no tiene `role="dialog"`/`aria-modal`/Escape/foco (DetailModal sí, vía `useEscClose`). Y si Supabase falla al cargar, solo hace `console.error` y muestra ceros (fail-open, patrón conocido del proyecto). **Fix:** `useEscClose` + role/aria + autofoco en el confirm; estado de error de carga con reintento en vez de ceros.
- **[P3 trivial] "≈" en un número exacto + barra anima `width` + em-dash en el aviso.** El "≈ {m²}" del histórico contradice que es la lectura exacta; la barra anima layout (`transition: width`); "Mantenimiento vencido — ya pasó…" usa em-dash (DON'T de copy). **Fix:** quitar "≈"; barra a `transform: scaleX`; em-dash → dos puntos.

### Falsos positivos refutados
- "El total compite/duplica con el accionable" → FP: hay un divisor de 1px que los separa; la jerarquía por tamaño (30 > 22 > 18) ya orienta bien; el m² en el histórico lo pediste tú en la spec.
- "No se distingue estático (máquina) de live (PrintFlow)" → FP: el subtítulo nombra ambas fuentes explícitamente.
- "Tipografía fuera de escala / 800 en todo" → FP: es estilo de casa; el número accionable sí domina por tamaño.

## Lo que funciona
1. **El número accionable ES el más grande** (30px ciclo > 22px total > 18px placas): jerarquía por tamaño bien orientada.
2. **El estado NO depende solo del color:** píldora con texto ("Se acerca…"/"Vencido…") + ícono, que desaparece en sano (calma). Bien para daltonismo.
3. **Tus decisiones respetadas y documentadas:** total estático de la máquina, sin alarma sin base, medidor debajo de los recuadros.

## Personas
- **Germán (único lector, tablet del taller):** el contraste ámbar es el que más le duele — la alarma se vuelve ilegible con reflejo justo cuando toca actuar.
- **Marcelo (admin):** el layout de 3 recuadros que pidió no se lee como 3 cajas (2 invisibles).

## Preguntas
- ¿Agrego un token de ámbar-tinta para texto (como el dangerInk de CBF) o uso el hex #b45309 inline? (PrintFlow no tiene *Ink.)
- ¿Los 3 recuadros con fondo `C.sf` (gris muy sutil) o prefieres separarlos solo con líneas?
