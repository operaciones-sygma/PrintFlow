---
target: "Analytics de PrintFlow: Productos por Ingreso y el Tipo de producto"
total_score: 14
p0_count: 1
p1_count: 2
timestamp: 2026-10-13T05-07-59Z
slug: src-app-jsx-analytics-productos-por-ingreso
---
# Critique: Analytics de PrintFlow («Productos por Ingreso» y el Tipo de producto)

**14/40 (pobre) · 1 P0 · 2 P1 · 2 P2.** Evaluación A: un revisor independiente (un agente aparte, sin ver critiques anteriores; ~322 mil
tokens; 1 entrada a producción con la cuenta de pruebas como Dirección, sin escrituras). Evaluación B: el detector de impeccable inyectado en
producción en 10 estados (las cinco pestañas a 1366 y a 1920) y el análisis estático de `src/App.jsx`. Más los datos medidos en la base
(sólo lectura).

## Calificación por heurística (Nielsen)

| # | Heurística | Nota | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | Ninguna cifra dice de qué periodo es; «Ingresos Totales» va desde una orden del 1-ene-2024 sin decirlo. Bien: la puerta «Cargar datos completos» y el aviso si falla. |
| 2 | Lenguaje del mundo real | 1 | Tipos que no son tipos («stock», «REMISIONES», «🔴 ATRASADA · …»); «Top 10 por Facturación» que suma lo cancelado; la lista no habla el idioma del taller (no tiene POP, remisiones, libretas). |
| 3 | Control y libertad | 2 | No se elige periodo; «Borrar Todos los Antiguos» irreversible tras un `confirm()` nativo. |
| 4 | Consistencia | 1 | Cuatro definiciones de «ingreso» en una pantalla; colores contra DESIGN.md; `alert()`/`confirm()`. |
| 5 | Prevención de errores | 1 | «Tipo» acepta cualquier texto (92 %); «Etiqueta» + Enter guarda «Etiqueta colgante»; el borrado masivo toma órdenes en producción. |
| 6 | Reconocer, no recordar | 2 | Hay que recordar qué incluye cada cifra; nada lleva a sus órdenes. |
| 7 | Flexibilidad y eficiencia | 1 | Sin periodo, sin orden, sin buscar entre 596 barras, sin bajar al detalle; «Cargar datos completos» cada vez. |
| 8 | Estética y minimalismo | 1 | 596 barras (19,759 px); arcoíris en ciclo; seis cifras gigantes que gritan igual; la tendencia no dibuja (seis rayas de 4 px). |
| 9 | Recuperarse de errores | 2 | El archivo que no carga se dice en palabras; pero el borrado avisa con `alert()` crudo y el tipo sucio no se corrige desde aquí. |
| 10 | Ayuda | 1 | Nada dice qué se cuenta ni de cuándo; «Tipo» en la forma no tiene línea de ayuda. |
| | **Total** | **14/40** | **Pobre: la pantalla no contesta las preguntas para las que existe.** |

## ¿Parece hecha por IA?

**Revisor:** sí, a primera vista: la plantilla de dashboard SaaS (hero-metric en cuatro colores, arcoíris en ciclo, podio con medallas,
dona que repite la cifra de al lado), justo la anti-referencia de PRODUCT.md. Es código de la era v10.34 que no pasó por las rondas de
pulido del resto de la app.

**Detector:** dentro de Analytics, 416 marcas de bajo contraste en los 10 estados (coincide con los 12 textos que el revisor midió bajo AA:
la medalla «2» a 1.82:1, los montos verdes a 2.72:1), 98 de letra de 9-10 px, 14 transiciones de layout (`height .5s` en la tendencia,
`width .8s` en el almacenamiento; el análisis estático marca la de la línea 16280) y 4 textos largos en mayúsculas. Fuera de Analytics
(el menú y la barra), lo de siempre (la fuente de la casa, que marca como «sobreusada»: falso positivo) y un degradado de texto en el
encabezado de la app que no es de esta pantalla. Sin capas visibles: corrió sin pantalla.

## Impresión general

La pantalla informa mal y no deja actuar. Lo que Marcelo vino a ver («qué producto me deja dinero») no se puede leer: 596 barras para
985 órdenes, porque el «Tipo» de la forma se usa como nombre del trabajo. Y varias cifras engañan (el «Mes actual ↓87 %» en rojo, la
utilización de máquinas 6 veces abajo). Lo más grave no es de diseño: «Archivos» sigue ofreciendo borrar en masa lo que se decidió
conservar el 12-oct.

## Lo que funciona

1. La carga del archivo completo es un estado claro: puerta explícita, y si falla lo dice y conserva lo que se veía.
2. «Ingresos Totales» usa la regla correcta (sólo lo entregado, maquila por su precio de maquila): coincide con la base. Y Maquila enseña
   su ganancia y su margen, el número más útil de la pantalla.
3. Las pestañas llevan ícono y palabra y el foco se ve; el combobox de «Tipo» tiene ARIA, flechas, Enter y Esc.

## Problemas prioritarios

**[P0] «Productos por Ingreso» no contesta: el «Tipo» se captura como nombre del trabajo.**
- 977-985 órdenes, 585-596 tipos distintos, 490-503 usados una sola vez; sólo 7.3-7.7 % trae un tipo de la lista (8.6 % del dinero
  entregado). Para ver el 80 % del dinero hay que leer 123 barras; a 1366 la sección empieza en y=616 y se ven 4.
- Por qué: el tipo ES el nombre en la hoja impresa y en media app (la ficha de planta, los avisos, las ventanas de folio), y la lista no
  tiene lo que SYGMA vende (POP: $1.15 M; remisiones, libretas, calendarios, gafetes, cuponeras) y encima tres de etiquetas.
  «Etiqueta» + Enter guarda «Etiqueta colgante»; «Tarjetas» y «Volantes» no encuentran nada.
- Los dos «tipos» más raros tienen origen (contestado en la base): **«stock»** (204 órdenes, $1.76 M, 17 %) lo pone `sell_from_stock`,
  la venta de inventario de Cuadra, cuando el producto del catálogo no trae tipo: es un canal, no un producto. **«🔴 ATRASADA ·»** (37
  órdenes, $1.03 M) son las 37 históricas atrasadas importadas en v10.72.55; dos pantallas ya lo borran al mostrar, pero el dato sigue así.
- La gráfica suma también lo cancelado y lo que sigue en producción: $800,555 más que «Ingresos Totales». Sin periodo, sin tope, sin
  «Otros»; el monto a 794 px de su nombre (1,331 a 1920); ocho colores sin significado.
- Arreglo: separar el nombre del trabajo de una categoría de lista cerrada (12-15 que no se encimen, sacadas de los trabajos reales);
  clasificar lo que ya existe una vez (reglas de palabras clave: 85 % sin revisar a mano; el resto, una lista por dinero para decidir);
  y la gráfica de sólo lo entregado, con periodo, las 8 primeras + «Otros» + «Sin clasificar: N · $X», un color, y cada barra abre sus
  órdenes.
- Comandos: `/impeccable shape` (la captura y la clasificación), `/impeccable distill` (la gráfica).

**[P1] Las cifras no dicen qué cuentan, y varias engañan.**
- «Mes actual ↓87 %» en rojo: compara 12 días contra un mes completo y sólo cuenta lo creado este mes; lo entregado en octubre es
  $508,954, no $243,647. La tendencia mensual no dibuja. La utilización de máquinas cuenta 726 días hábiles desde una orden de 2024 (la
  operación real: 117): sale 6 veces abajo; y «Empaque» suma el 41 % de las horas (mide espera). «A tiempo 41 %» deja fuera 431 de 925
  entregadas sin decirlo. Merma «0» en ámbar es «sin dato».
- Arreglo: una sola definición de ingreso (entregado, por fecha de entrega), selector de periodo, cada cifra con su base en una línea,
  comparar periodos del mismo largo.
- Comando: `/impeccable clarify`.

**[P1] «Archivos» borra en masa lo que Dirección decidió conservar.**
- «Borrar Todos los Antiguos» toma toda orden creada hace más de 30 días, también las que siguen en producción, con un `confirm()` que no
  dice cuáles. Contradice la decisión del 12-oct (v10.84.76: el archivo de impresión se queda como historial). Hoy son 2; crece cada día.
- Arreglo: quitar el borrado masivo de los archivos de impresión (dejar sólo los huérfanos, con su candado) y sacar «Archivos» de
  Analytics.
- Comando: `/impeccable harden`.

**[P2] El color no significa nada y doce textos no pasan AA** (arcoíris, verde de éxito en todos los montos, medallas; la «2» a 1.82:1).
Comandos: `/impeccable quieter`, `/impeccable typeset`.

**[P2] No se puede bajar al detalle ni con el teclado** (pestañas sin semántica de pestaña; las tarjetas de máquina son `div` con clic;
nada lleva a sus órdenes). Comando: `/impeccable harden`.

## Banderas rojas por persona

- **Marcelo (Dirección):** la gráfica no contesta; el «↓87 %» falso el día 12; la utilización 6 veces abajo; no elige periodo ni abre
  una barra; «Cargar datos completos» cada vez.
- **Lupita (captura, de ella sale el dato):** «TIPO *» sin ayuda e invita a escribir; la lista no tiene lo de todos los días; lo escrito se
  acepta callado; y el campo es el nombre en la hoja impresa: usarlo de nombre es lo racional.
- **Alex (experto):** sin periodo, orden ni búsqueda; la pestaña vuelve a «Financiero»; el detalle de máquina sólo con mouse.
- **Sam (accesibilidad):** pestañas sin estado; máquinas fuera del Tab; doce textos bajo AA; estado de máquina sólo por color.

## Observaciones menores

«Analytics», «Ticket Promedio», «MXN/Hr Real» y «MXN/Hora Real» juntos; «Almacenamiento Supabase» y «100 GB» a mano; los clientes con
la misma enfermedad, más leve (189 nombres, 169 al normalizar); el mes en UTC (lo de después de las 18:00 del último día cuenta para el
siguiente); el `<h2>` centrado y lo demás a la izquierda; la dona repite la tarjeta.

## Preguntas para pensar

1. ¿Qué tiene que contestar esta pantalla el lunes a las 9? Si es «cómo vamos este mes y qué nos deja dinero», ¿por qué lo primero es un
   total desde 2024?
2. ¿Y si la categoría no se tecleara nunca, y el nombre del trabajo tuviera su propio campo?
3. ¿«stock» es un producto o un canal (el inventario de Cuadra) que debe verse aparte?
4. ¿«Archivos» es analítica? ¿Qué pasa el día que «Borrar Todos los Antiguos» diga 300?
