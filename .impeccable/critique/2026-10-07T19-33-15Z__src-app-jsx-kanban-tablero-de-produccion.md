---
target: el Tablero de Producción (Kanban), segunda pasada independiente
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-10-07T19-33-15Z
slug: src-app-jsx-kanban-tablero-de-produccion
---
# Critique: el Tablero de Producción (Kanban), segunda pasada independiente, v10.84.59 en producción

Evaluación A por un **revisor independiente** (producción y admin a 1366, producción a 1920 y a 768 de tableta; sus propios
scripts con las escrituras cortadas; «Órdenes Listas» estaba vacía y la simuló en su navegador leyendo 6 órdenes de Salidas como
listas). Evaluación B (detectores), mía y aislada. Primera pasada independiente: 20/40 (v10.84.55). Meta: 35 sin P1, o 3 pasadas.

## Calificación de salud (Nielsen)

| # | Heurística | Nota | Lo principal |
|---|---|---|---|
| 1 | Estado del sistema | 3 | Marco ACTIVA con reloj, «3 vencidas», «Pasa a Empaque en 6 s · Deshacer»; el aviso de asignar sólo nombra la máquina; Listas desaparece vacía; la fila interna corta la 4ª orden |
| 2 | Lenguaje | 3 | Español del piso; los íconos de Empaque engañan (camión = maquila, flecha = Salidas, bote = merma); «Maquila completa» se lee «terminada» |
| 3 | Control y libertad | 3 | Deshacer en Empaque, A Listas y asignar; Activar y Salidas preguntan; arrastrar a Empaque escribe sin Deshacer; reordenar no se deshace; Esc no cierra Merma ni Maquila (abren con el foco en un campo) |
| 4 | Consistencia | 2 | El mismo paso con dos redes; el folio falta en Salidas y «En Maquila»; botones de 21 px en la fila y 40 px en la activa |
| 5 | Prevención de errores | 3 | Preguntas con la orden, mantenimiento apagado, escudo, merma con enteros; P-0593 (en fila, no corriendo) entra a Salidas con la pregunta de una empacada; merma acepta 999,999 |
| 6 | Reconocer, no recordar | 2 | Empaque sólo con íconos; «no borra la orden» en un title; el destino de «A Listas» no se ve; el círculo negro no se explica |
| 7 | Flexibilidad | 2 | Arrastre y select, búsqueda que resalta; 0 de 28 fichas con foco; reordenar y mover la activa sólo arrastrando |
| 8 | Estética | 2 | 8 botones morados rellenos, verde y naranja en cada Empaque, llave ámbar en cada máquina, 65% del texto a 9-10 px, huecos de 309-557 px |
| 9 | Recuperarse de errores | 3 | «P-0591 no pasó a la Baumfolder: … El tablero se vuelve a leer de la base.»; sale abajo al centro, lejos de la ficha |
| 10 | Ayuda | 2 | La pista sale una vez por navegador; los title sólo con mouse; sin leyenda de colores |
| **Total** | | **25/40** | **Aceptable** |

## Veredicto de anti-patrones

**Revisor**: no es AI slop (P-folios, máquinas reales, «desde ayer 18:55»); falla de oficio: cajas dentro de cajas (sección →
máquina → marco ACTIVA → ficha), color pleno en botones de rutina; lo más de plantilla, la rejilla de 7 tarjetas iguales de
«Recibidas de maquila».
**Detectores**: los de la primera pasada (tiny-text, contraste) siguen como la mayor deuda visual; ver el CHANGELOG de v10.84.59
para lo que ya se corrigió.

## Lo que funciona

1. Red donde hay daño y con la orden: Activar y Salidas preguntan, la cuenta atrás y el escudo (un doble clic programó una sola
   espera).
2. «3 vencidas» enumera dónde está cada una y lleva a la ficha resaltada; la búsqueda resalta sin filtrar y lo dice.
3. La carga se ve al decidir: el select dice «1 activa · 3 en espera», «libre», «aquí está», «en mantenimiento».

## Problemas prioritarios

1. **[P1] La planta no se ve de un vistazo en la laptop**: a 1366 la primera pantalla enseña 3 de 16 máquinas; con 6 en Listas
   la primera máquina queda en y=770; filas de igual alto con cajas vacías; las libres ocupan lo mismo que las cargadas. Arreglo:
   franja compacta arriba (una línea por máquina), las libres en un renglón que acepta soltar, `align-items:start`, Listas
   plegable con «+N».
2. **[P1] El mismo paso tiene redes distintas**: el botón «Empaque» espera 6.5 s con Deshacer; arrastrar a la columna Empaque
   (lo que enseña la pista) escribe al instante, el aviso no nombra la orden y no hay Deshacer; reordenar no se deshace; el
   Deshacer de asignar vive en un aviso que el siguiente tapa. Arreglo: el arrastre por la misma espera; todo aviso con la orden.
3. **[P2] Las acciones de Empaque son ambiguas**: íconos fuera del borde, a 8 px de las fichas; adentro, con palabra; «Salidas»
   la fuerte; Maquila y Merma en «⋯».
4. **[P2] Se rompe fuera de 1366**: a 1920, 14 botones partidos en dos líneas («▶ / Activar»); en tableta, las zonas de destino a
   5 pantallas, objetivos de 21-27 px, sin hover, sin mover sin arrastrar.
5. **[P2] El tablero sano no está en calma**: color pleno, llave ámbar 2.6:1, el círculo negro, «Disponible» 3.3:1, la Horizon a
   ~2.4:1 con 70% de opacidad, el aviso de éxito 3.05:1.

## Menores

Salidas y «En Maquila» sin P-folio; «2 completas» se lee «terminadas»; la zona Maquila sin contador; el foco al body tras Esc en
Salidas y tras «ir a» una vencida; soltar en la Horizon no dice nada; rayas largas; Listas vacía no dice «todo asignado».

## Preguntas

- ¿Y si cada máquina fuera un renglón y la fila sólo se abriera en la que estás planeando?
- ¿Por qué una máquina libre ocupa lo mismo que una con cinco órdenes?
