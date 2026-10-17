---
target: «Auditoría» (AuditoriaView y sus ventanas, src/App.jsx)
total_score: 22
p0_count: 0
p1_count: 1
timestamp: 2026-10-17T07-41-36Z
slug: src-app-jsx-auditoria
---
# /impeccable critique — «AUDITORÍA»

`AuditoriaView` en `src/App.jsx` (los consecutivos de folios fiscales —huecos, duplicados, compartidos, conciliados con CobranzaFlow— y el de órdenes P-,
con el histórico H-; Dirección y Karla), con su montaje en App y sus dos ventanas (`ProductionOrderDetailModal`, `SharedFoliosModal`). 17-oct-2026,
madrugada. Ya había pasado por rondas de harden, clarify, distill y layout (v10.72.73-82) y por los arreglos de series del corte (v10.77, v10.80). Con los
datos reales la serie F no tiene huecos de verdad (191 folios: 142 en órdenes y 49 en la cartera). Evaluación A antes de la B. Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 3 | la conciliación dice cuándo concilia o falla (v10.72.76/80) |
| 2 | El mundo real | 1 | «gaps», «Read-only», «Click en»; la clave dice que lo de la cartera es «facturado directo en Alpha» y manda a comparar con AlphaERP: la F- y la RS- las timbra SYGMA desde el 1-sep |
| 3 | Control y libertad | 3 | filtros, búsqueda, exportar |
| 4 | Consistencia | 2 | la pestaña de órdenes escribe «P-601» (los folios son «P-0601»); tarjetas de número grande |
| 5 | Prevención de errores | 2 | «Duplicados» por número pelado: F-3 y C-3 contarían como duplicado (dormido mientras las series no se enciman) |
| 6 | Reconocer, no recordar | 3 | el hueco dice sus vecinos y dónde buscarlo |
| 7 | Flexibilidad y eficiencia | 1 | buscar «P-0601» no encuentra nada (armaba «P-601» y no buscaba en el folio de la orden); ni las filas ni «Compartidos» se abren con el teclado |
| 8 | Estética y minimalismo | 2 | cinco tarjetas de 22 px por pestaña; etiquetas en mayúsculas y colores de semáforo |
| 9 | Recuperarse de errores | 3 | sin la cartera, «?» y «Reintentar» |
| 10 | Ayuda | 2 | la clave plegable, con lo de Alpha |
| **Total** | | **22/40** | **Aceptable** |

## ¿Parece hecho por IA?

En las tarjetas, sí (la plantilla de número grande). **El detector (navegador, sobre el banco), antes:** verde a 3.0:1, gris sobre gris a 1.1:1, rojo a
4.3:1, ámbar a 2.6:1, las etapas en verde a 3.3:1 (13 veces), renglones de ~202 caracteres. **Después:** un aviso de verde sobre verde que es falso positivo
(toma el tinte translúcido como sólido; la tanda compone los tintes y pasa) y la letra de la app.

## Problemas principales

- **[P1] Buscar una orden como se escribe no la encuentra** («P-0601»), y la pestaña la escribe «P-601» en las filas, los huecos y el rango. Arreglo: con sus
  ceros, y buscar también en el folio de la orden (lo mismo en el histórico H-).
- **[P2] Duplicados por número pelado.** Arreglo: por serie (también el total).
- **[P2] La clave habla de Alpha para la serie propia.** Arreglo: la cartera de CobranzaFlow sin orden aquí (por partes, del plan, sin orden); comparar con
  CobranzaFlow (y con Alpha, las series D- y R-).
- **[P2] Teclado:** las filas, «Compartidos» y el encabezado del histórico; el detalle no se anunciaba como diálogo ni se llevaba el foco.
- **[P2] AA** en las etiquetas, los huecos, las fechas y las etapas.
- **[P3]** las tarjetas → un renglón de cifras; «huecos», «sólo lectura», «Anticipados»; el CSV dice «HUECO».

## Preguntas

- ¿Los huecos de la serie D- (Alpha) siguen sirviendo, o la pantalla debería auditar sólo F- y RS- desde el corte?
