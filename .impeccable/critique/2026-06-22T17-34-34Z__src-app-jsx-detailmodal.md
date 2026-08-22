---
target: DetailModal (src/App.jsx)
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-06-22T17-34-34Z
slug: src-app-jsx-detailmodal
---
# Critique — DetailModal (src/App.jsx, L2523-2663)

Register: product. Objetivo: el modal de detalle de una orden (se abre al tocar una card).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Muestra etapa, pago, post-factura, validación, historial; bien |
| 2 | Match System / Real World | 4 | Secciones lógicas (Cliente→Producto→Specs→Fiscal), lenguaje del dominio |
| 3 | User Control & Freedom | 4 | X (40px), Esc, backdrop, Cerrar; salidas excelentes |
| 4 | Consistency & Standards | 3 | Usa Row + section headers; los badges del header siguen inline (no migrados a <Badge>) |
| 5 | Error Prevention | 3 | Confirm para borrar archivo; cancelar-con-NC gateado a admin |
| 6 | Recognition vs Recall | 3 | Todo visible en secciones; el scroll largo obliga a recordar dónde está cada cosa |
| 7 | Flexibility & Efficiency | 2 | Sin navegación por teclado; para ACTUAR hay que scrollear hasta el fondo |
| 8 | Aesthetic & Minimalist | 3 | Render condicional (no filas vacías); pero lista label-valor plana + headers multicolor |
| 9 | Error Recovery | 3 | Hereda los toasts de la app |
| 10 | Help & Documentation | 2 | Sin tooltips/ayuda en el modal |
| **Total** | | **30/40** | **Good** (ligeramente arriba del 29 global) |

## Anti-Patterns Verdict
No es AI slop. Determinista limpio en este componente (los 5 hallazgos del detector caen fuera). El render condicional (solo muestra secciones con datos) es buena disciplina anti-clutter. La señal a vigilar es de la lista de bans del skill: "modal as first thought".

## Overall Impression
Es un detalle **completo, ordenado y consciente de rol** (vOwns oculta precios/contactos a quien no es dueño): hace bien su trabajo. El techo lo ponen dos cosas estructurales: (1) las **acciones viven al fondo**, después de ~20 filas de lectura, así que para avanzar etapa / editar / imprimir hay que scrollear todo; (2) es un **modal para una superficie profunda y rica en acciones** (520px, 85vh con scroll), justo el caso que el ban "modal as first thought" señala. No está roto, pero un panel lateral lo serviría mejor.

## What's Working
1. **Control y libertad (4/4).** Cuatro formas de salir (X de 40px, Esc, backdrop, Cerrar) + role=dialog/aria-modal. Impecable.
2. **Completo sin ruido.** El render condicional evita filas vacías; cada sección aparece solo si hay dato. Densidad sin basura.
3. **Acciones dentro del modal (v10.72.14).** Los botones de flujo + el Editar que agregamos hoy evitan el round-trip "cerrar → buscar card". Buena dirección.

## Priority Issues

**[P2] Las acciones están enterradas bajo el scroll.** Flujo / Editar / Imprimir están al FONDO, después de Cliente, Producto, Specs, Fiscal, Archivo, Notas, Historial. En una orden con datos, actuar = scrollear ~20 filas. Fix: **footer de acciones sticky** (y/o header sticky con folio+etapa para no perder contexto al scrollear). Comando: `/impeccable layout`.

**[P2] Modal para una superficie profunda + accionable.** 520px / 85vh con scroll, secciones + acciones. Es el caso clásico que pide un **slide-over (panel lateral)**: mantiene el tablero visible detrás, da más ancho (filas a 2 columnas), y las acciones caben sin scroll. Es cambio más grande; lo dejo señalado. Comando: `/impeccable shape` (re-shape de la superficie de detalle).

**[P3] Densidad label-valor plana + headers multicolor.** ~20 filas en una columna; los headers de sección usan 3-4 colores (ac/maq/fac/ok). Fix: 2 columnas para valores cortos + unificar el color de los headers de sección. Comando: `/impeccable layout`.

**[P3] Los badges del header siguen inline.** El chip de etapa + Web/priority/post-factura del header NO usan el `<Badge>` nuevo (la migración no llegó aquí). Deriva residual. Comando: continuar `/impeccable extract`.

**[P3] a11y menor.** Imágenes de producto con `alt=""` (son contenido, merecen alt); las filas son `<div>` en vez de `<dl>/<dt>/<dd>` semántico.

## Persona Red Flags

**Lupita (secretaria):** abre el detalle para verificar/editar; el botón Editar (que agregamos hoy) está al fondo → scrollea para llegar. Un footer sticky le ahorra ese scroll en cada orden.

**Gerardo (producción):** abre para ver specs + avanzar etapa; los botones de flujo están bajo la info fiscal que a él no le importa. Las acciones cerca del top (o sticky) lo desbloquean más rápido.

## Minor Observations
- El botón Cerrar ya es más tenue que Editar/Imprimir (bt gris vs color); jerarquía correcta ahí.
- maxWidth 520 fuerza scroll vertical de filas que a más ancho serían 2 columnas.
- Click en imagen abre window.open (tab nueva); para herramienta interna está bien, sin lightbox.

## Questions to Consider
- ¿El detalle debería ser panel lateral en vez de modal, dado que se abre decenas de veces al día?
- ¿Las acciones (flujo/editar/imprimir) merecen estar fijas arriba, no enterradas al fondo?
- ¿Cuánta info fiscal necesita ver producción, vs el operador de caja?
