# Propuesta: la categoría del trabajo (para Analytics)

**Para Marcelo · 13-oct-2026.** Lo decidiste el 12-oct («Categoría nueva aparte»): el campo de hoy («Tipo de producto», que en la
práctica es el nombre del trabajo) se queda como está y se agrega una **categoría de lista cerrada** que alimenta las barras de Analytics;
la historia se clasifica una vez; «stock» va aparte como canal; y se limpia «🔴 ATRASADA · » de las 37 importadas. **Antes de tocar la
base falta que apruebes la lista.** Todo lo de abajo es sólo lectura (medido sobre las 985 órdenes no canceladas).

## La lista que propongo (12 + «Otro»)

| # | Categoría | Órdenes | Dinero | Ejemplos (los que más dejan) |
|---|---|---:|---:|---|
| 1 | Etiquetas y stickers | 182 (18.6 %) | $1,729,247 (17.0 %) | ETIQUETA PLG · ETIQUETAS · ETIQUETA Y SOPORTE · STICKER 9-10 |
| 2 | Folletos, trípticos y volantes | 107 (11.0 %) | $1,784,696 (17.5 %) | TRÍPTICOS DE ACTA · los folletos de la cooperativa · INSTRUCTIVOS |
| 3 | Material POP y carteles | 52 (5.3 %) | $1,750,705 (17.2 %) | IMPRESIÓN POP (Pacífico, Oaxaca) · SOPORTES · PÓSTER · TENT CARDS |
| 4 | Formas, talonarios y formatos | 220 (22.5 %) | $1,132,401 (11.1 %) | REMISIONES · PEDIDOS CON PAGARÉ · BOLETAS · RECIBOS · los formatos 0404F… |
| 5 | Lonas y gran formato | 34 (3.5 %) | $429,510 (4.2 %) | LONAS · ROLL UP · VINIL |
| 6 | Papelería corporativa | 68 (7.0 %) | $386,246 (3.8 %) | HOJAS MEMBRETADAS · FOLDERS · SOBRES · TARJETAS DE PRESENTACIÓN |
| 7 | Libros, revistas y manuales | 12 (1.2 %) | $315,200 (3.1 %) | ANUARIOS · REVISTA · CATÁLOGOS · CÓDIGO DE ÉTICA |
| 8 | Cuponeras y boletos | 32 (3.3 %) | $268,258 (2.6 %) | CUPONERAS · BOLETOS · PASES |
| 9 | Libretas, cuadernos y agendas | 7 (0.7 %) | $184,720 (1.8 %) | LIBRETAS ENGARGOLADAS · AGENDAS |
| 10 | Cajas y empaques | 7 (0.7 %) | $107,976 (1.1 %) | SOLAPAS · BOLSAS · CONOS |
| 11 | Invitaciones, tarjetas y diplomas | 17 (1.7 %) | $83,553 (0.8 %) | CONSTANCIAS · RECONOCIMIENTOS · TARJETAS |
| 12 | Calendarios | 3 (0.3 %) | $69,830 (0.7 %) | CALENDARIOS DE ESCRITORIO · 2027 |
| 13 | Otro | (lo que no cabe: sellos, pulseras, listones…) | | |

**Aparte, como canal (no se elige en la forma): Venta de inventario** — 200 órdenes, $1,733,572 (17.0 %). Son las ventas de stock de
Cuadra (`sell_from_stock` pone «stock» en el tipo). En Analytics sale como su propio renglón, no como producto.

Con estas reglas se clasifican solas **949 de 985 órdenes (96.3 %) y el 97.8 % del dinero**. Quedan **36 órdenes ($219,561)**:

ZAPATO CODE / ZAPATO MED NUEVO ($52,600) · CARÁTULA Y CONTRACARÁTULA ($35,000, y 2 más de carátulas, $11,466) · PLANTILLA DE
EMOTICONES ($30,150) · MÓDULOS (2, $43,060) · PLIEGOS PAPEL IMPRESO ($7,600) · ARANCELES C/TARIFAS ($6,963) · IMPRESIÓN DE COPAS
($5,040) · PORTABOLETO ($4,800) · SELLOS (8, ~$5,400) · LISTÓN, HAWAIANAS, ARAÑAS Y PENDÓN, TROVICEL, PULSERAS, CANDADOS, MENÚS, MEMORÁNDUM,
SCORE, VARIOS, IMPRESIÓN PLOTTER / SERIGRAFÍA (de $160 a $2,240 cada una).

## Lo que te toca decidir

1. **¿La lista va así?** Nombres, cuáles juntar o separar (p. ej. ¿«Lonas» y «POP» juntos?, ¿«Calendarios» merece la suya con 3
   órdenes?). Lo fácil es ahora; después de la migración, cambiar una categoría es otra migración.
2. **Las 36 sueltas:** las clasifico yo con mi mejor lectura (carátulas y módulos → Libros; pendón, trovicel y plotter → Lonas y gran
   formato; menús → POP; memorándum → Formas; portaboleto → Cuponeras; lo demás → Otro) o quedan «Sin clasificar» y Lupita las corrige.
   ¿Y «ZAPATO CODE»? ($52,600: no sé qué es.)
3. **¿La categoría es obligatoria al capturar?** Propongo que sí, con la sugerencia ya puesta según el nombre del trabajo (las mismas
   reglas): Lupita sólo confirma o cambia. Sin obligatoria, en un mes volvemos a las 596 barras.

## Cómo se haría (cuando apruebes)

- **La base** (con ensayo y vuelta atrás, y el acuse de CobranzaFlow y Almacén): `orders.categoria` (texto, con la lista cerrada como
  `CHECK`; vacía = sin clasificar). La clasificación de la historia, una sola vez, guardando el antes. Quitar «🔴 ATRASADA · » de las 37
  importadas, guardando el texto de antes. Nada de lo que ya existe cambia de nombre: el campo de hoy sigue igual y sigue saliendo en la
  hoja impresa.
- **La forma:** la categoría junto al nombre del trabajo, con la sugerencia puesta.
- **Analytics:** las barras por categoría (las 12, «Otro», «Sin clasificar: N · $X» y «Venta de inventario» aparte), y cada barra abre sus
  órdenes.
- Las reglas de palabras (con límites de palabra; el orden es la prioridad) quedan en la migración para que se puedan revisar.
