---
target: la vista Planta de PrintFlow (el plano de Gerardo)
total_score: 30
p0_count: 0
p1_count: 1
timestamp: 2026-10-16T08-42-02Z
slug: src-plano-planoplanta-jsx
---
# Critique — «Planta» (v10.84.120), el plano de la planta baja para Gerardo

Fuente: `src/plano/PlanoPlanta.jsx`, `src/plano/hoja.js`. Revisada a 1366 y 1920 en su banco (al abrir, una pieza elegida y encimada, la forma
de agregar, la ventana de guardar, el conflicto, el menú de imprimir y la hoja a doble carta) y en producción (la captura del recorrido como
Producción). Evaluación A (diseño) y B (detector de la skill, CLI y en el navegador) por separado, en ese orden: sin subagentes (Marcelo no dio
OK de agentes esta noche).

## Design Health Score

| # | Heurística | Puntos | Lo principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | El estado (sin cambios / sin guardar / guardando / guardado a las…), lo rojo y el zoom se ven; pero la pieza elegida, si está en rojo, deja de verse elegida |
| 2 | El lenguaje del usuario | 3 | Centímetros, el número del plano, «Plano del levantamiento (como estaba)»; «Agregado» y «Listo» piden un segundo |
| 3 | Control y libertad | 3 | Deshacer/rehacer, Esc, el borrador que se ofrece, borrar con «Deshacer»; volver al levantamiento es abrir otra versión |
| 4 | Consistencia | 3 | Botones, ventanas y colores de la app; dos botones rellenos compiten («Agregar objeto» siempre y «Guardar» con cambios) |
| 5 | Prevenir errores | 3 | Medidas revisadas, nombre único, no pisa lo de otro, pregunta al salir; lo encimado se avisa pero no se mide cuánto falta |
| 6 | Reconocer, no recordar | 3 | La barra junto a la pieza y la lista; los atajos sólo salen con una pieza elegida |
| 7 | Flexibilidad | 3 | Flechas, R, Supr, Ctrl+Z/Y/D, la rueda; no hay mover varias a la vez |
| 8 | Estética minimalista | 3 | El plano manda; el subtítulo es una instrucción de 106 letras y hay dos primarios |
| 9 | Recuperarse de errores | 4 | Cada error dice qué pasó y qué hacer, y conserva el trabajo («Tus cambios siguen aquí», el conflicto con sus salidas) |
| 10 | Ayuda | 2 | Sólo el subtítulo y una línea de atajos cuando hay pieza elegida |
| **Total** | | **30/40** | **Bien: base sólida, atender lo débil** |

## Anti-Patterns Verdict

**Evaluación del diseño:** no parece hecha por IA. Es una herramienta de piso con el vocabulario de la app (los botones de 40 px, los tintes del
semáforo, Geist) y un dibujo de verdad (el levantamiento de AutoCAD con sus columnas, puertas y escaleras), no una plantilla. La barra flotante de
íconos junto a la pieza es un patrón conocido (Figma, Canva) bien usado.

**Detector (CLI):** 1 hallazgo, `overused-font` por Arial en `hoja.js`: **falso positivo**, la hoja se imprime en un marco aparte sin las letras
de la web y la letra del sistema asegura que salga igual en cualquier impresora.

**Detector (navegador, inyectado en el banco en 4 estados):** `line-length` (~106 letras: el subtítulo), `tiny-text` (10, 11 y 11.5 px: las
etiquetas en mayúsculas de 10 px son la convención de toda la app; el texto de ayuda del panel sí podría crecer), `overused-font` (Geist: la letra
de la app, falso positivo), `flat-type-hierarchy` (10 a 18 px: densidad de herramienta, aceptable) y `gradient-text` (**falso positivo**: el
`background-clip:content-box` de la barra de desplazamiento global de App, sin degradado ni texto).

## Overall Impression

Hace lo que se pidió y se recupera bien de todo lo que sale mal. La mayor oportunidad está en lo que Gerardo de verdad decide con el plano:
**cuánto espacio queda**. Hoy la herramienta dice si algo se encima, pero no cuánto pasillo hay entre una máquina y el muro o la de al lado;
hay que contar cuadros de 1 m.

## What's Working

- **El error nunca cuesta el trabajo**: la base que falla, la sesión vencida, otro que guardó o borró la versión, la tabla que faltaba: cada caso lo
  dice en palabras, conserva lo acomodado y ofrece la salida (guardar como nueva, reintentar, recuperar el borrador).
- **La barra junto a la pieza** (girar a un lado y al otro, duplicar, quitar) pone lo más usado donde está la mano, con el atajo en el `title`.
- **La hoja a 1:100 en doble carta**, con su escala gráfica, la lista con medidas y lo encimado, sirve para llevarla a la planta y medir con regla.

## Priority Issues

- **[P1] No dice cuánto espacio queda.** Por qué importa: el acomodo se decide por los pasillos (¿pasa el montacargas? ¿cabe el operador entre la
  PM-74 y el muro?); hoy hay que contar cuadros. Arreglo: al elegir o arrastrar una pieza, cotas a lo más cercano (muro, columna, escalera u otra
  pieza) a los cuatro lados, con la distancia en metros, y la misma cuenta en el panel para quien no ve el dibujo. Comando: /impeccable shape.
- **[P2] La pieza elegida en rojo deja de verse elegida.** Con dos encimadas, las dos rojas iguales: no se sabe a cuál le pegan los botones.
  Arreglo: el contorno de la elegida (azul, más grueso) va siempre encima del rojo. Comando: /impeccable polish.
- **[P2] Dos primarios compiten.** «Agregar objeto» relleno siempre y «Guardar» relleno con cambios: el ojo no sabe cuál es la acción.
  Arreglo: «Agregar objeto» como secundario; el único relleno, «Guardar» cuando hay algo que guardar. Comando: /impeccable quieter.
- **[P2] La ayuda llega tarde.** Los gestos (arrastrar, tocar, la rueda, el fondo) están en un subtítulo de 106 letras y los atajos sólo con una
  pieza elegida. Arreglo: subtítulo corto y, en el panel vacío, «Cómo se usa» en tres renglones con los atajos. Comando: /impeccable onboard.

## Persona Red Flags

**Gerardo (producción, en su monitor o la tablet del piso)**: quiere saber si la cortadora cabe junto a la PM-74 dejando 80 cm de paso; mueve,
cuenta cuadros, se equivoca por medio metro. En la tablet no hay pellizco para acercar (sólo los botones + y −).

**Alex (usuario experto)**: tiene atajos para todo lo de una pieza, pero no para varias (no hay seleccionar varias ni mover un grupo); «Ver todo»
y el zoom no tienen tecla.

**Sam (teclado y lector de pantalla)**: las piezas del dibujo no se alcanzan con Tab; sí desde la lista del panel, y luego las flechas, R y Supr
funcionan. Lo rojo además se dice con texto. Las cotas propuestas deben ir también como texto en el panel.

## Minor Observations

- En la hoja impresa, el letrero de una pieza tapada por otra queda debajo de la de arriba (cada letrero va dentro de su pieza): dibujar los
  letreros al final, como en la pantalla.
- «la guardó Marcelo a las 02:36 a.m..»: punto doble (la hora ya trae «a.m.»).
- La tabla de la hoja no hereda la letra si la hoja se abre sin su `<!doctype>` (modo antiguo): `table{font-size:inherit}`.
- El texto de ayuda del panel (11.5 px) es chico para la planta; las etiquetas de 10 px son la convención de la app.

## Questions to Consider

- ¿Y si al arrastrar una máquina el plano dijera, en vivo, «1.20 m al muro»?
- ¿Hace falta un «pasillo mínimo» configurable (80 cm) que pinte de ámbar lo que quede más angosto?
- ¿Gerardo usará la tablet para esto? Si sí: pellizcar para acercar.
