---
target: "DetailModal (PrintFlow: el detalle de la orden, segunda pasada independiente)"
total_score: 24
p0_count: 0
p1_count: 1
timestamp: 2026-10-07T13-50-37Z
slug: src-app-jsx-detailmodal
---
# Critique: el detalle de la orden (DetailModal), segunda pasada independiente, v10.84.53 en producción

Evaluación A por un **revisor independiente**. Revisó seis roles a 1366, tres a 1920 y producción en tablet (820×1180), y probó
teclado, Esc, Ctrl+Enter, clic fuera, doble clic y fallas de la base con su propio Playwright y las escrituras cortadas (cortó
`order_notes`, `orders` y `move_order_in_queue`; nada se escribió). Evaluación B (detectores), mía y aislada. Avisó que los
comentarios de `DetailModal` citan calificaciones anteriores; calificó por lo observado.

## Calificación de salud (Nielsen)

| # | Heurística | Nota | Lo principal |
|---|---|---|---|
| 1 | Estado del sistema | 3 | Encabezado completo (folio, reloj, «Le toca a»); falta «Sin precio» (P-0580, P-0607) y arriba dice RETRASO de una orden en espera (P-0583) |
| 2 | Lenguaje real | 3 | Vocabulario de taller; se cuelan «ID interno», «Stage destino / 2 stages atrás» y «Cancelar con NC» |
| 3 | Control y libertad | 2 | Avanzar cierra el detalle sin Deshacer; «Regresar Orden» no cierra con Esc (el foco en su campo) |
| 4 | Consistencia | 2 | La ficha pone «Regresar», «El cliente no pide factura» y «Recordar» a la vista y el detalle en «Más»; «Mover»/«Cambiar OC»; «Asignado por: karla»; un `window.confirm` |
| 5 | Prevención de errores | 2 | El folio confirma ejemplar; pero un doble clic actúa sobre otra orden, se ofrece «Borrar» en una orden con folio, y la × del nombre interno borra sin preguntar |
| 6 | Reconocer, no recordar | 3 | «Más» dice qué hace cada opción; el botón trabado dice por qué; la única acción del vendedor está escondida |
| 7 | Flexibilidad | 3 | Ctrl+Enter, Tab atrapado, flechas en el menú; sin siguiente/anterior, sin mover a máquina desde aquí |
| 8 | Estética | 2 | Datos repetidos, ID interno para todos, caja de alias vacía, secciones que se confunden con los rótulos, 413 px útiles a 1366 |
| 9 | Recuperación de errores | 2 | La nota que la base rechaza se pierde y los avisos enseñan el error crudo |
| 10 | Ayuda | 2 | Buena línea en «Más»; lo que explica alertas y «Facturar por partes» vive en `title` |
| **Total** | | **24/40** | **Aceptable** |

## Veredicto de anti-patrones

**Revisor**: no parece hecho por IA; herramienta de piso hecha a mano. Genérico: la lista de datos con rótulos grises en mayúsculas,
ventanas encimadas hasta tres niveles, pastillas grandes para «Tiempo por etapa»/«Historial», emoji en los diálogos que abre.

**Detectores**: `detect.mjs` sobre el código, 0. En producción: `gradient-text` es falso positivo (el detector se marca a sí mismo);
Geist es la fuente de la familia; lo de menos de 12 px está dentro de la escala de DESIGN.md (meta 10, cuerpo 11). Coincide con el
revisor en la raya larga de la franja de espera.

## Lo que funciona

1. Un encabezado que contesta todo sin bajar.
2. Una sola acción rellena por rol; lo raro en «Más» con su explicación; el botón trabado dice por qué y lo que lo destraba es la
   principal.
3. Las acciones grandes se abren encima y regresan a la orden con el foco en su lugar; el folio confirma paso a paso.

## Problemas prioritarios

1. **[P1] Un doble clic actúa sobre otra orden.** Producción, P-0591, «Empaque»: el primer clic avanza y cierra el detalle; el
   segundo cae en el tablero y abre P-0590 con su propio «Empaque» bajo el cursor; un tercero la movería. Arreglo: ignorar los
   clics al tablero ~500 ms después de actuar, apagar el botón al primer clic, o que avanzar no cierre el detalle.
2. **[P2] Alarmas falsas y la real callada.** RETRASO en rojo de una orden en espera (P-0583); «Reimprimir · v1 obsoleta» y
   «Reimprimir» de principal en una orden entregada y pagada (P-0554), también al vendedor; no dice «Sin precio».
3. **[P2] Lo escrito se pierde.** Una nota escrita y un clic fuera cierran sin preguntar; la nota que la base rechaza ya se vació,
   con el error crudo.
4. **[P2] La acción del rol no está en el detalle.** El vendedor sólo tiene «Recordar» escondido en «Más» (en la ficha es visible);
   producción lee «Arrastra… en el Tablero» y no tiene el «Mover a máquina…» del tablero; Germán no ve placas.
5. **[P2] Las salidas de los diálogos que abre fallan.** «Regresar Orden» no cierra con Esc; «Borrar orden» se ofrece y se
   rechaza (P-0554 tiene folio) y el foco cae fuera; dice «stage».

## Banderas rojas por persona

- **Karla en Salidas**: no ve «Sin precio» antes de foliar; RETRASO en lo que ella estacionó; sin siguiente/anterior; correos de
  SYGMA mostrados como del cliente (luceropg@ en CERVECERIA MODELO, padhnos@ en varios).
- **Germán en CTP**: el detalle es de sólo lectura y su principal es «Imprimir»; no ve placas.
- **Producción**: el doble clic; «Empaque · Empaque 40h 18m» (P-0585); «Empaque» sin verbo.
- **Vendedor**: una alarma roja que no puede atender, el ID interno, su única acción escondida.
- **Marcelo**: 7 opciones en «Más»; «Borrar» en una orden facturada; la pregunta de borrar no nombra el P-número.

## Observaciones menores

«Diseño» dos veces en «Tiempo por etapa»; un encabezado «Notas» vacío (P-0591); el anillo de foco a 50% (~2.2:1); el historial
tarda ~7 s en decir que falló; el teléfono no se puede tocar para llamar; el mismo ícono para «El cliente no pide factura» y «Poner
en espera»; «SELECCION DE COLOR» pide HEX; rayas largas en el aviso de espera.

## Preguntas

- ¿Y si el detalle fuera la cola: Karla folia P-0589 y el detalle le ofrece la siguiente de Salidas?
- ¿Germán necesita este detalle, o una ficha de CTP con placas, archivo y un solo botón?
