---
target: el Inventario Cuadra (InventoryModal y su lectura, src/App.jsx)
total_score: 22
p0_count: 0
p1_count: 1
timestamp: 2026-10-16T19-45-27Z
slug: src-app-jsx-inventario-cuadra
---
# /impeccable critique — el INVENTARIO CUADRA

`InventoryModal` en `src/App.jsx` (el catálogo de productos a stock, sus movimientos y el historial de órdenes Cuadra; lo abren Dirección, Karla, Lupita y
Gerardo) con su lectura de la base. 16-oct-2026, tarde. En uso: 68 órdenes Cuadra y 209 ventas del catálogo registradas (SOLD) en la base. Evaluación A
(diseño, con el código y el banco) escrita antes de la B (el detector de la skill). Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 1 | si la lectura falla, dice «Sin productos en stock · Da de alta tu primer producto» (y lo mismo movimientos e historial) |
| 2 | El mundo real | 2 | los movimientos dicen PRODUCED, SOLD, ADJUST; «SKUs»; «Stage:» |
| 3 | Control y libertad | 2 | quitar pregunta con confirm() del navegador; sin «Reintentar» |
| 4 | Consistencia | 2 | no es un diálogo como los demás; las pestañas sin su papel; colores fuera de las tintas |
| 5 | Prevención de errores | 3 | sólo se quita lo que no tiene existencias; cada acción con su rol |
| 6 | Reconocer, no recordar | 3 | la tarjeta dice de quién es, su clave, su precio y cuánto hay |
| 7 | Flexibilidad y eficiencia | 2 | el foco no entra; el Tab se va a la app de atrás |
| 8 | Estética y minimalismo | 3 | tarjetas limpias |
| 9 | Recuperarse de errores | 1 | una falla de lectura sólo deja un aviso que se va; la pestaña se queda «vacía» |
| 10 | Ayuda | 3 | los vacíos dicen qué hacer |
| **Total** | | **22/40** | **Aceptable** |

## ¿Parece hecho por IA?

No: es un catálogo sobrio. **El detector (navegador, sobre el banco):** antes, 8 hallazgos con Gerardo: el verde `#10b981` de las existencias y las
pestañas (2.3:1 sobre el gris), el blanco sobre ese verde en «Nuevo Producto» (2.5:1), el rojo `#e03b30` de las existencias negativas (3.9:1) y letra de
9-10 px. Después: sólo la letra chica de la app y los falsos positivos de siempre («gradient-text», la escala).

## Lo que funciona

1. **Las acciones por rol** (`canExecuteAction`): Gerardo ajusta pero no vende ni quita; el carrito es de Dirección y Karla.
2. **Quitar sólo sin existencias** y como baja suave: los movimientos se conservan.
3. **El historial** junta a stock y desde stock con su folio fiscal y su vendedor.

## Problemas principales

- **[P1] Una lectura fallida se ve como vacío (la regla 12).** Con `Promise.all`, si la lectura del catálogo falla, la pantalla dice «Sin productos en
  stock · Da de alta tu primer producto» (invita a darlos de alta otra vez); los movimientos, «Sin movimientos todavía»; el historial, «Sin órdenes Cuadra
  todavía». Arreglo: cada lectura por su lado; la que falla lo dice en su pestaña con «Reintentar» y lo último bueno se queda. `/impeccable harden`.
- **[P2] Los movimientos en inglés.** PRODUCED, SOLD, ADJUST (209 ventas y 66 ajustes en la base). Arreglo: «Entrada de producción», «Venta», «Ajuste».
- **[P2] Quitar pregunta con confirm() del navegador.** Arreglo: la pregunta en la tarjeta, con qué pasa (los movimientos se conservan), «Cancelar»
  primero y una sola vez aunque haya doble clic.
- **[P2] Sin AA.** Las existencias y las pestañas en verde a 2.3:1, «Nuevo Producto» blanco sobre verde a 2.5:1, la existencia negativa a 3.9:1, letra
  de 9 px. Arreglo: las tintas (`C.emrInk`, `C.okInk`/`okTx`, `C.dnInk`, `C.wnTx`) y 10 px o más.
- **[P2] No es un diálogo.** Sin `role="dialog"`, las pestañas sin `role="tab"`, el foco no entra y el Tab se sale. Arreglo: diálogo con su nombre, pestañas,
  el foco en la pestaña elegida, `atraparTab`.

## Banderas por persona

- **Karla (vende del catálogo):** con la red mala ve «Sin productos en stock» y le dice que dé de alta su primer producto.
- **Gerardo (ajusta existencias):** ve «ADJUST» y «PRODUCED»; el verde de lo que hay casi no se lee sobre el gris.
- **Dirección:** quitar un producto le abre la ventana del navegador.

## Observaciones menores

- «Productos en stock · N SKUs»: «SKU» es jerga; «N productos en el catálogo».
- «Stage:» en el historial; «saldo:» en los movimientos.
- Si falla la lectura de los clientes, cada producto sale de «—» sin decir por qué (la regla 2: su error se tragaba).

## Preguntas

- ¿El inventario de un pool (Grupo Cuadra) debería decir cuánto se llevó cada cliente del pool?
- ¿Avisar cuando un producto queda en negativo (−20: se vendió más de lo que había)?
