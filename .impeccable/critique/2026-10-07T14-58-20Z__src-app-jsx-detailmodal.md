---
target: "DetailModal (PrintFlow: el detalle de la orden, tercera pasada independiente)"
total_score: 27
p0_count: 0
p1_count: 1
timestamp: 2026-10-07T14-58-20Z
slug: src-app-jsx-detailmodal
---
# Critique: el detalle de la orden (DetailModal), tercera pasada independiente, v10.84.54 en producción

Evaluación A por un **revisor independiente** (6 roles a 1366, 4 a 1920, producción a 768×1024; teclado, Esc, Ctrl+Enter,
doble clic, cerrar con una nota escrita, un 503 simulado del historial, y abrir y cancelar las ventanas de folio, cancelar,
espera y regresar, sin confirmar nada; la única escritura cortada fue `log_wakeup_ack`). Evaluación B (detectores), mía y
aislada. **Con ésta son 3 pasadas independientes: se cierra la pantalla** (meta aprobada: 35 sin P1, o 3 pasadas); el P1 se
arregla igual.

## Calificación de salud (Nielsen)

| # | Heurística | Nota | Lo principal |
|---|---|---|---|
| 1 | Estado del sistema | 3 | Encabezado completo; P-0591 no dice en qué máquina está; el reloj del encabezado es corrido y el historial cuenta horas hábiles; «En espera» y RETRASO a la vez |
| 2 | Lenguaje | 3 | Su idioma («Asignar Folio y Entregar», «sin IVA»); se cuelan «Elige el stage destino», «modal OC», «1 pzas», «Le toca a Karla» visto por Karla |
| 3 | Control y libertad | 2 | Esc, clic fuera, ×, lo escrito protegido y el foco que regresa; pero avanzar de etapa es un clic o Ctrl+Enter, sin pregunta ni Deshacer |
| 4 | Consistencia | 2 | El relleno es «Imprimir» cuando no hay nada pendiente; «No, conservar»/«Cancelar»/«Volver» para lo mismo; el mismo bote para merma y borrar |
| 5 | Prevención de errores | 3 | El folio, cancelar con motivo, el escudo del doble clic (verificado), el botón trabado con su porqué; los huecos, en los avances de piso |
| 6 | Reconocer, no recordar | 3 | Todo lleva texto; «Más» explica; el tiempo en la etapa, plegado |
| 7 | Flexibilidad | 2 | Ctrl+Enter, flechas, Tab atrapado; sin anterior/siguiente, sin alternativa a arrastrar |
| 8 | Estética | 3 | Encabezado limpio; encabezado y pie 240 de 653 px a 1366; datos repetidos; 5 controles en 4 estilos en el pie de Karla |
| 9 | Recuperarse de errores | 3 | El historial que falla lo dice; la nota rechazada regresa; un avance que falla ya cerró el detalle y deja el error crudo |
| 10 | Ayuda | 3 | Explicación en «Más» y junto a lo trabado; lo de las acciones principales y el atajo, sólo en title |
| **Total** | | **27/40** | **Aceptable, en el tope de esa banda** |

## Veredicto de anti-patrones

**Revisor**: no parece hecho por IA; herramienta nativa y sobria. Genérico: la etiqueta de 10 px en mayúsculas en cada renglón,
cuatro tonos de botón teñido en un mismo pie, editores sueltos dentro de una vista de lectura.
**Detectores**: `detect.mjs`, 0. En producción, `gradient-text` es falso positivo (el detector se marca a sí mismo), Geist es la
fuente de la familia, y lo de menos de 12 px está en la escala de DESIGN.md.

## Lo que funciona

1. El encabezado responde quién, qué, cuánto, cuándo y a quién le toca; el pie fijo nunca queda bajo el pliegue.
2. Actuar no destruye el contexto: las ventanas se abren encima y Esc regresa al detalle con el foco; el doble clic no cae en
   nada; lo escrito no se pierde.
3. Lo trabado se explica y lo que lo destraba es la principal (P-0598, «Editar Maquila»).

## Problemas prioritarios

1. **[P1] Avanzar de etapa desde el detalle es irreversible en un clic** (P-0591, «Empaque», relleno y con Ctrl+Enter; igual
   «Cliente Aprobó», «Pide Cambios», «Prueba de Color», «Directo a CTP», «Recoger Placas», «Marcar Enviada»). Saca la orden de
   su máquina; el detalle se cierra con un aviso sin Deshacer.
2. **[P2] El relleno se asigna por descarte**: «Imprimir» relleno y con Ctrl+Enter cuando el rol no tiene nada pendiente; con
   la orden en espera, lo importante («Ya pidió factura · Reactivar») va teñido.
3. **[P2] Las ventanas que se abren encima no son diálogos**: «Cancelar orden», «Cancelar con nota de crédito», «Poner en
   espera», «Regresar» e «Imprimir» sin `role="dialog"`, sin foco inicial ni Tab atrapado; tras «Seguir escribiendo» el foco cae
   al body.
4. **[P2] «Cancelar con nota de crédito» no hace lo que dice** (P-0554): menú y ventana se contradicen; no recuerda que está
   pagada.
5. **[P2] Falta en el encabezado el dato de cada oficio**: placas para Germán, la máquina (o que no tiene) para Gerardo con el
   mismo reloj que el historial, el tiempo en Salidas para Karla.

## Banderas rojas por persona

- **Karla**: el RFC de público en general sin aviso; «Facturar por partes» pesa como la principal; RETRASO de lo que sólo espera
  la factura; sin siguiente orden; «Poner en espera» con motivos de producción.
- **Germán**: «Arrastra… en el Tablero» sin «Mover a…»; «Imprimir» relleno; el «#HEX» escribe al catálogo de todos; la miniatura
  en blanco sin aviso.
- **Producción**: «Empaque» sustantivo junto a «Enviar a Maquila»; «NOMBRE INTERNO» arriba del cuerpo; historial con etapas
  repetidas; un ícono de fábrica suelto antes del reloj.
- **Vendedor**: se le esconde todo sin decir por qué, pero el encabezado le enseña el folio.
- **Marcelo**: la nota de crédito; «Editar» en una entregada y pagada sin avisar; `window.confirm` en «Deshacer cancelación»; el
  mismo bote en merma y borrar; 7 opciones en «Más».

## Observaciones menores

El relleno mide 37 px y los teñidos 39-40; la impresión de una entregada pide reimprimir; «Diseño · Diseño» en el historial; HEX
para «SELECCION DE COLOR»; Esc dentro de un campo no hace nada y el aviso de cerrar no dice qué está escrito; los rótulos de
sección no son encabezados; la caja vacía de «Nombre interno»; colores escritos a mano en los chips de Pantone.

## Preguntas

- ¿Y si el relleno fuera una promesa («esto te toca, ahora») y sin pendientes no hubiera ninguno?
- ¿Y si mover una orden desde el detalle la dejara abierta en su etapa nueva, con Deshacer?
