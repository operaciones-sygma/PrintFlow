---
target: la ficha de la orden (OCard, src/App.jsx)
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-10-19T07-53-27Z
slug: src-app-jsx-ocard-tarjeta-de-orden
---
# /impeccable critique — LA FICHA DE LA ORDEN (OCard)

`OCard` (src/App.jsx), con `StageFlowButtons` en su modo de ficha: la tarjeta que sale en «Todas», en los pendientes de cada quien, en
«En espera», en la OC y en la lista de estancadas. La ve toda la planta todo el día; su última crítica era del 1-jul (28/40, leyendo el
código) y desde entonces le crecieron renglones. 19-oct-2026, madrugada (Marcelo dormido, con autonomía hasta las 12:00).

Escena: Lupita en la laptop de la oficina (1366×768) revisa dónde van sus órdenes; Gerardo, en el monitor del piso, trabaja su lista;
Karla, en «Todas», ve lo que está por llegar a Salidas. Medido en los bancos (Todas con 1002 órdenes; las 21 fichas del tablero; En
espera) a 1366, 1920 y 390, y en la base (60 días, sólo lectura). Evaluación A (diseño) antes de la B (el detector). Sin subagentes.

**Lo medido:**
- Alto de la ficha a 1366: **Lupita 361-412 px (2 fichas enteras por pantalla)**, Karla 261-334, Producción 241-340, Dirección
  286-292, vendedor 280-361. A 1920, Dirección ve 9 enteras de 12.
- En 60 días: Máquina → Empaque **286**; Máquina → Maquila **0**; mermas **0**; órdenes canceladas 8 (Dirección 6, **Lupita 1**);
  «Recordar a…» 7, todas de Karla.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 3 | la etapa, las alertas, el avance, quién la tiene y el reloj de la máquina, a la vista |
| 2 | El mundo real | 2 | «le toca a Gerardo: avanzar la orden de ✅ Lista para imprimir»; «Orden validada — solo lectura»; «Precio ✓» a Producción; el bote de basura es la merma |
| 3 | Control y libertad | 3 | lo de Dirección que destruye vive en «⋯ Más» con palabras; el de Lupita no |
| 4 | Consistencia | 2 | la misma orden ofrece «Enviar a maquila» y la merma al frente en la ficha y en «⋯» en el tablero (v10.84.63); colores fijos fuera de los tokens |
| 5 | Prevención de errores | 2 | «Cancelar» a un clic en cada ficha de Lupita (1 cancelación suya en 60 días); el bote con «+» junto al historial |
| 6 | Reconocer, no recordar | 3 | cliente, producto, cantidad, fechas, dinero (a quien le toca verlo) y a quién le toca |
| 7 | Flexibilidad y eficiencia | 2 | 2 fichas enteras por pantalla para Lupita; la misma guía en cada una de las 21 de Gerardo |
| 8 | Estética y minimalismo | 1 | hasta cuatro cajas apiladas bajo los datos (Cancelar, «le toca», «solo lectura», «Más»); tres filas de controles |
| 9 | Recuperarse de errores | 3 | «Procesando…» encima de la fila; el detalle y las ventanas dicen el error |
| 10 | Ayuda | 2 | la ayuda es la misma caja repetida en cada ficha, con «haz click en ❌» |
| **Total** | | **23/40** | **Aceptable** |

## ¿Parece hecho por IA?

No: es una ficha de trabajo con la historia de la casa (las alertas y banderas de una sola definición con el detalle, el «le toca a» con su
«Recordar»). Lo que falla es la acumulación: cada versión agregó un renglón y ninguno se fue.

**Detector (CLI):** `detect.mjs` sobre App.jsx: 6 hallazgos, **0 en la ficha** (15555-15871): Arial de la hoja impresa (papel), Geist (la
letra de la casa) y dos `transition: width` de otras vistas. **En la página** (los tres bancos, 1366, sin ventana para ti): 1 hallazgo
fuera de las fichas en Todas y en las fichas, y en «En espera» 8 «cramped-padding» dentro de la ficha: el botón «Ya pidió factura» con
`padding: 0 16px` y 40 px de alto (falso positivo: el alto lo da `minHeight`). **No vio** lo grande: el alto, las cajas repetidas, lo raro
al frente, la letra de 9 px del avance ni el botón de imprimir sin nombre.

## Problemas principales

- **[P1] La ficha de Lupita mide 400 px por tres renglones que no le sirven.** «Cancelar» a la vista en cada ficha (en 60 días canceló 1;
  PRODUCT.md: lo destructivo detrás de «⋯»), «Orden validada — solo lectura» en cada orden validada (le dice lo que no puede) con un ícono de
  imprimir sin nombre, y el «le toca a…» en una caja ámbar. A 1366 caben 2 fichas enteras. **Arreglo:** un renglón al pie: «Le toca a
  Gerardo · Lista para imprimir», «Recordar», «Imprimir» con su nombre y «⋯» (Cambiar de OC, Cancelar orden). /impeccable distill.
- **[P1] En Máquina y Empaque, la ficha pone al frente lo que nunca se usa, y el tablero ya no.** «Enviar a Maquila» del mismo tamaño que
  «Empaque» (0 contra 286 en 60 días) y el bote de basura de la merma (0; se lee «borrar»). En el tablero viven en «⋯» desde v10.84.63: la
  misma orden ofrece otra cosa según dónde se vea. **Arreglo:** «Empaque» (o «Enviar a Salidas») al frente; «Enviar a maquila» y
  «Registrar merma» en el «⋯» de la ficha, con las palabras e íconos del tablero. /impeccable distill.
- **[P2] La misma guía en cada ficha.** «Al terminar, pásala a Empaque o a Maquila…» 21 veces en la lista de Gerardo, «Asigna el folio
  fiscal…» encima de «Asignar Folio y Entregar»: la caja dice lo que el botón ya dice. **Arreglo:** sin la caja; la guía queda en el
  `title` de la fila de acciones. /impeccable distill.
- **[P2] Tres filas de controles.** Las acciones, los íconos (que a 551 px bajan a su renglón) y «Más ⟲2»/merma. **Arreglo:** «Historial»
  dentro del grupo de íconos; la merma al «⋯». /impeccable layout.
- **[P2] 9 px, colores fijos y emoji en frases.** «Progreso» y «7/13» a 9 px; «Recordar a…» a 10 px con `#f59e0b`/`#b45309` fuera de los
  tokens; «avanzar la orden de ✅ Lista para imprimir». **Arreglo:** 10 px o más, tokens y la etapa con su nombre sin emoji. /impeccable polish.
- **[P3]** El folio P- (como la gente nombra la orden) en una insignia gris de 10 px; «Precio ✓» a Producción no le dice nada; «Más ⟲2» no
  dice qué abre; a 390 px la cuadrícula de 440 px se sale de la pantalla (Todas, pendientes, En espera, estancadas).

## Personas

- **Lupita** (laptop, captura y coordina): 2 fichas enteras por pantalla; en cada una «Cancelar» en rojo y «solo lectura»; para imprimir la
  hoja, un ícono sin nombre en el renglón que le dice que no puede.
- **Gerardo** (monitor del piso): 21 fichas con la misma frase arriba; «Enviar a Maquila» del tamaño de «Empaque»; el bote de basura con
  «+» junto al historial.
- **Karla** («Todas», Salidas): «Asigna el folio fiscal…» encima de «Asignar Folio y Entregar»; en lo que no es suyo, la caja ámbar con
  «Recordar a Gerardo» (lo usa: 7 en 60 días).
- **Sam** (lector de pantalla): el ícono de imprimir de Lupita y del vendedor no tiene nombre; la ficha es un botón con botones adentro.

## Lo que funciona

1. **A quién le toca, con salida**: la ficha que no es tuya dice quién la tiene y deja recordárselo (Karla lo usa).
2. **Alertas y banderas de una sola definición** (`alertasDeLaOrden`, `banderasDeLaOrden`): la ficha y el detalle dicen lo mismo.
3. **Lo destructivo de Dirección en «⋯ Más» con palabras** (Regresar, Cancelar orden, Cancelar con su folio, Borrar), y una sola acción
  rellena en su tinta (v10.84.94).

## Observaciones menores

- La caja de la orden web en borrador (pre-prensa) usa colores fijos (`#fff8e1`, `#ffe082`, `#e65100`): de las pocas que quedan.
- «Arrastra al Tablero» arriba, la guía «Arrastra al Tablero para asignar máquina» y el «Arrastra esta orden a una máquina en el Tablero»
  de la fila: tres veces lo mismo en una ficha de Lista (ya no sale el primero en las listas con `noDragHint`).

## Preguntas

- ¿La ficha que no es tuya necesita algo más que «quién la tiene» y «Recordar»? (lo demás está a un clic en el detalle)
- ¿Y si el número P- fuera el título junto al cliente, como lo dice la gente en el piso?
