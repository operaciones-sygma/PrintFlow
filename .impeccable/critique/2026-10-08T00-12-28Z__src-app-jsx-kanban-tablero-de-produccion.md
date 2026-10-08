---
target: el Tablero de Producción (Kanban), tercera y última pasada independiente
total_score: 24
p0_count: 0
p1_count: 1
timestamp: 2026-10-08T00-12-28Z
slug: src-app-jsx-kanban-tablero-de-produccion
---
# Critique: el Tablero de Producción (Kanban), tercera y última pasada independiente, v10.84.64 en producción

Evaluación A por un **revisor independiente** (7-oct, 17:45-18:10; producción y admin a 1366, producción a 1920 y a 768 de
tableta; el banco con Listas llena, mantenimiento, vacío y una falla de lectura simulada a 1144 px, el ancho de la app a 1366 sin la
barra lateral; leyó `Kanban`, `DragCard`, `MaquilaTracker` y los manejadores de App; ninguna escritura salió: cortadas con 418 o
simuladas; 438k tokens). Evaluación B (detectores), mía y aislada. Pasadas independientes: 20 (v10.84.55) → 25 (v10.84.59) →
**24** (v10.84.64). Con esta, tres: **el tablero queda cerrado** (meta: 35 sin P1, o 3 pasadas), con su P1 arreglado.

## Calificación de salud (Nielsen)

| # | Heurística | Nota | Lo principal |
|---|---|---|---|
| 1 | Estado del sistema | 2 | Franja con reloj y fila, «Deshacer» con cuenta atrás, avisos con la orden; pero al cargar, o si falla la lectura, dice «Tablero vacío · 0 trabajando · 15 libres» en verde |
| 2 | Lenguaje | 3 | Español de planta; «8 en producción» (cuenta la fila) junto a «7 trabajando»; el botón dice «Activar» y la pregunta «¿Arrancar…?» |
| 3 | Control y libertad | 3 | Empaque y A Listas esperan con «Deshacer»; el «Deshacer» de asignar va en un aviso que el siguiente borra; reordenar no tiene vuelta |
| 4 | Consistencia | 2 | Tres anatomías de ficha para la misma orden; el naranja es Acabados y Maquila; la llave es categoría, «poner en mantenimiento» y avería; Esc regresa el foco en Activar y no en Salidas |
| 5 | Prevención de errores | 3 | Activar y Salidas preguntan con nombres; doble clic bloqueado (verificado); la flecha ↓ sobre «Enviar a máquina…» mueve la orden al instante (sólo 6.5 s de «Deshacer») |
| 6 | Reconocer, no recordar | 3 | Todo con palabra, el select dice la carga; Salidas (27) y En Maquila sin folio: seis «LIC. ORLANDO CASAS» iguales |
| 7 | Flexibilidad | 2 | Sin atajos; las fichas no reciben foco; encabezados de categoría y Salidas sin teclado; sin lotes; reordenar sólo arrastrando |
| 8 | Estética | 2 | La franja, en calma; abajo, 16 tarjetas repiten lo mismo (la mitad «Disponible»), 7 marcos verdes, 7 botones morados y 13 llaves ámbar en un día sano |
| 9 | Recuperarse de errores | 2 | Al escribir, claro y la ficha regresa; sin «Reintentar», el aviso tapa la primera fila; al leer, ningún mensaje |
| 10 | Ayuda | 2 | La pista de primera vez sólo enseña a arrastrar; los `title` no existen en tableta; nada dice qué acepta cada zona |
| **Total** | | **24/40** | **Aceptable** |

## Veredicto de anti-patrones

**Revisor**: no es AI slop (vocabulario propio: «Así va la planta», «+1 en la fila», «desde ayer 18:55»; sin gradientes ni cifra
gigante). Lo que se nota acumulado: cajas redondeadas una dentro de otra (sección › máquina › marco ACTIVA › ficha › pastilla),
paneles pastel por zona, más de diez estilos de botón.
**Detectores** (producción, rol producción): 102 hallazgos. `tiny-text` ×80 (11, 10 y 9 px), `low-contrast` ×14 («N vencidas»
#fcfdfe sobre #e03b30 a 4.3:1, #73737b sobre #eff2f6 a 4.2:1, el contador de Empaque #fff sobre #af52de a 4.1:1, uno a 3.3:1),
`nested-cards` ×7, `ai-color-palette` (el morado de Empaque), `body-text-viewport-edge` ×2, y `gradient-text` ×1 (el propio
detector inyectado: se marca a sí mismo). Admin: 131 (más letra chica y contraste en lo que sólo ve admin).

## Lo que funciona

1. **«Así va la planta»**: una línea por máquina con orden, cliente, reloj y fila; lo fuera de servicio se ve; las libres, en chips;
   cada línea lleva a la máquina y acepta soltar. A 1366 contesta sin bajar.
2. **La red sigue al daño**: confirmaciones con nombres, espera con «Deshacer», doble clic bloqueado; los errores dicen orden,
   destino y causa en palabras, y la ficha regresa.
3. **Lo atrasado se sigue**: «N vencidas» abre cuáles y dónde y lleva a la ficha; «desde ayer 18:55»; la búsqueda resalta sin
   filtrar y dice dónde.

## Problemas prioritarios

1. **[P1] El tablero dice «vacío» cuando no sabe.** En cada entrada, «Tablero vacío» de 0.9 a 1.9 s. Con un 503 simulado en la
   lectura de órdenes: «0 trabajando · 15 libres» y «Pendientes (0)», sin aviso a los 9 s; a media sesión, las fichas pasan de 15 a
   0 con el punto de conexión verde. `loadOrders` devuelve `[]` ante un error, la recarga reemplaza todo y el Kanban decide
   «vacío» sin saber si ya cargó. A Gerardo le dice que las prensas están libres; a Marcelo, que la planta está parada. Arreglo:
   conservar lo último bueno con «No se pudo leer · hace N min · Reintentar», esqueleto mientras carga, «vacío» sólo después de
   una lectura buena.
2. **[P2] Teclado y tableta a medias**: fichas sin foco ni rol (el detalle sólo con mouse), encabezados `div` con clic, reordenar
   sólo arrastrando, los select con `onChange` (la flecha mueve la orden) de 22-28 px también en táctil, nombres accesibles sin la
   orden ni la máquina.
3. **[P2] Un día sano no está en calma y los colores chocan**: 13 llaves ámbar siempre a la vista; el naranja de Acabados y de
   Maquila; encabezados y contadores en color pleno («Órdenes Listas» 2.7:1, «Salidas» 2.9:1, «Maquila» 2.5:1, «5d» 2.8:1, «2
   vencidas» 4.26:1).
4. **[P2] La misma orden con tres caras, y dos listas sin folio**: el folio arriba a la derecha en Listas, bajo el nombre en la
   activa, primero en la fila; en Salidas y En Maquila no aparece.
5. **[P3] La franja no dice qué va tarde ni qué sigue**: P-0544 (vencida desde el 05-oct) se ve igual; «sigue P-0593»; el
   «Deshacer» de asignar, en la ficha.

## Banderas rojas por persona

- **Gerardo en la laptop**: con Listas llena la primera máquina cae en el pliegue; el aviso de error tapa la primera fila 7 s;
  tras cada «Empaque», el foco cae al `<body>`.
- **Gerardo en el monitor**: la página mide 2,809 px y Acabados empieza bajo el pliegue; las fichas de En Maquila miden 1,650 px.
- **Tableta (768)**: la barra lateral ocupa 222 px; la página mide 5,805 px; Empaque a ~4,500 px; reordenar imposible.
- **Marcelo**: su página mide 4,049 px (abajo, seis «Guardar» verdes activos con el costo vacío, 3.0:1, y el Tablero Germán); en
  una caída ve «Tablero vacío».

## Menores

La pista de primera vez dice «(verde)» y hay fichas rojas y azules; «en 7 s» para 6.5 s; «1 urgente sin asignar» parece botón;
el renglón de la búsqueda no lleva a la ficha; al asignar, la franja crece y empuja Listas bajo el cursor; «Horizon BQ-4GO está
fuera de servicio.» no dice qué hacer; Digital y Salidas se vuelven a plegar en cada visita; el reloj en azul info; guiones
largos en los textos.

## Preguntas

- Si la franja ya dice qué corre, ¿la rejilla necesita pintar las máquinas libres?
- ¿Y si el tablero dijera cuándo lo leyó? Un «vacío» sin hora no se puede creer.

Capturas y scripts del revisor: `scratchpad/critica-tablero-3/` (el vacío falso: `produccion-1366-Tablero-0.png`; la falla a
media sesión: `prod/produccion-1366-falla-tarde-9000.png`; la flecha que mueve la orden: `banco/select-flecha.png`).
