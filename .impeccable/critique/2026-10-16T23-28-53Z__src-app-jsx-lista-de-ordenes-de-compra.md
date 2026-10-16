---
target: la lista de Órdenes de Compra (OrdenesCompraView, src/App.jsx)
total_score: 24
p0_count: 0
p1_count: 1
timestamp: 2026-10-16T23-28-53Z
slug: src-app-jsx-lista-de-ordenes-de-compra
---
# /impeccable critique — la LISTA DE ÓRDENES DE COMPRA

`OrdenesCompraView` en `src/App.jsx` (Activas e Histórico, y la entrada al detalle de una OC; Karla, Lupita y Dirección), con su montaje en App. 16-oct-2026,
tarde. 38 OC de varios productos al mes (las 126 de un solo producto van ocultas). El detalle de la OC ya pasó por las críticas del flujo de facturas de
Karla (v10.84.96-106); esta pasada es la lista. Evaluación A (diseño, con el código y el banco) antes de la B (el detector). Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | sin una lectura buena: «Sin Órdenes de Compra complejas» y «Activas (0)» |
| 2 | El mundo real | 2 | «complejas», «Click en», «OCs» |
| 3 | Control y libertad | 3 | «← Volver a la lista»; Activas/Histórico |
| 4 | Consistencia | 2 | la tarjeta es un div con clic (las demás listas usan botones); las pestañas sin su papel; insignias fuera de las tintas |
| 5 | Prevención de errores | 3 | el candado y el folio compartido a la vista |
| 6 | Reconocer, no recordar | 3 | la tarjeta dice cliente, agente, productos, total, entrega y folio |
| 7 | Flexibilidad y eficiencia | 1 | con el teclado no se abre ninguna OC |
| 8 | Estética y minimalismo | 3 | tarjetas sobrias; el Histórico en carpetas año → mes |
| 9 | Recuperarse de errores | 2 | la falla de lectura se ve como «no hay» |
| 10 | Ayuda | 3 | «Ver también las de un solo producto» dice qué esconde |
| **Total** | | **24/40** | **Aceptable** |

## ¿Parece hecho por IA?

No: una lista de tarjetas con su información. **El detector (navegador, sobre el banco):** casi nada en las dos versiones (la letra chica de la app y los
falsos positivos). No vio lo que la tanda midió componiendo los tintes: «Abierta» a 2.8:1 y «Bloqueada» a 2.4:1 sobre su tinte, el motivo de la cancelada
en 9 px.

## Problemas principales

- **[P1] Sin lectura dice que no hay OC.** «Sin Órdenes de Compra complejas» y «Activas (0)» cuando la base no contestó (la regla 12). Arreglo: `leido`
  de App; sin cifras y «no se pudieron leer». `/impeccable harden`.
- **[P2] Con el teclado no se abre ninguna OC.** La tarjeta es un div con clic. Arreglo: `role="button"`, `tabIndex`, Enter y espacio, su nombre.
- **[P2] Sin AA.** La insignia del estado (verde y rojo plenos sobre su tinte), el candado (ámbar, 2.4:1), el folio de remisión (verde, 2.3:1), los totales
  del Histórico (4.49:1), el motivo de la cancelada en 9 px. Arreglo: las tintas y 10 px o más.
- **[P3] Jerga.** «complejas» (lo que el sistema llama a las OC de varios productos), «Click en», «OCs». Arreglo: «OC de varios productos», «Toca».

## Observaciones menores

- Al abrir una OC, React avisaba «don't mix shorthand and non-shorthand properties»: reusaba el contenedor de las pestañas (borderBottom) como la tarjeta del
  detalle (border). Pasaba igual antes; lo destapó abrirla con el teclado. Arreglo: la lista y el detalle con su `key`.

## Preguntas

- ¿La lista de Activas debería poder filtrarse por cliente o por estado (abierta, en proceso, con candado)?
