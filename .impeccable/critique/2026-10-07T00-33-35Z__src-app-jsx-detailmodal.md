---
target: DetailModal (el detalle de la orden)
total_score: 23
p0_count: 0
p1_count: 2
timestamp: 2026-10-07T00-33-35Z
slug: src-app-jsx-detailmodal
---
# Critique: DetailModal (PrintFlow, el detalle de la orden)

Target: `src/App.jsx`: DetailModal (4214-4457, 244 renglones). Visto EN PRODUCCIÓN con la cuenta de pruebas (sólo lectura, el
rol cambiado en el navegador) a 1366x768 y 1920x1080, como karla, admin y producción, en 8 órdenes reales: P-0554 factura
pagada, P-0571 por partes, P-0598 maquila, P-0405 cancelada, P-0607 borrador, P-0577 remisión, P-0568 sin empaque SYGMA, P-0580
en Salidas sin folio.

## Design Health Score

| # | Heurística | Puntos | Problema principal |
|---|-----------|-------|-----------|
| 1 | Visibilidad del estado | 2 | El encabezado no dice cuánto ni para cuándo; «NC emitida en SAT: Pendiente» en una cancelada sin folio; borrar el archivo no avisa si falló |
| 2 | Lenguaje de la persona | 3 | El id interno «OP-MUH77BVYVQW» en el encabezado; «Click para descargar»; «PRECIO» y «PRECIO MXN»; emojis ⏱️ ⏳ |
| 3 | Control y libertad | 3 | El aviso de borrar el archivo aparece solo, medio segundo después de dar clic en descargarlo |
| 4 | Consistencia | 2 | Tres «editar» en el borrador; un arcoíris de botones rellenos; Tab se sale (los demás diálogos ya atrapan el foco); la ficha pone el cliente arriba y el detalle no |
| 5 | Prevención de errores | 2 | «Cancelar Orden (con NC)» enorme y roja al final de cada orden facturada; borrar el archivo deja la orden sin archivo aunque Storage no lo haya borrado |
| 6 | Reconocer, no recordar | 2 | Para saber de quién es la orden hay que pasar la imagen; «Entrega» y «Precio» quedan a 1-2 pantallas |
| 7 | Flexibilidad | 2 | Se avanza la orden desde el detalle, pero sin atajos y con Tab inservible |
| 8 | Estética y minimalismo | 2 | El contenido se asoma debajo del pie fijo; tarjetas de colores para acciones raras; «FLUJO» sin botones; ningún botón de color pasa contraste |
| 9 | Recuperarse de errores | 2 | El borrado del archivo traga los errores |
| 10 | Ayuda | 3 | Las tarjetas de acción explican qué hacen; «Tiempo por etapa» e «Historial de cambios» |
| **Total** | | **23/40** | **Aceptable** |

## Anti-Patterns Verdict

**Evaluación de diseño:** no parece hecha por IA; parece hecha por capas. Cada versión agregó su bloque (facturar anticipado,
cancelar con NC, deshacer cancelación, liberar folio, devolver saldo) con su propio color y tamaño, y nadie volvió a ordenar el
conjunto. El resultado es una ficha técnica larga con un pie de botones de colores.

**Detector (código):** 0 hallazgos en los 244 renglones (no resuelve colores que llegan por token).

**Detector en la página (inyectado en el detalle abierto, 6 casos):** 3 a 9 por caso.
- Reales, y más de lo que vio la evaluación: **ningún botón de color pasa AA**. Naranja «Asignar Folio Anticipado» 2.2:1,
  ámbar «Deshacer cancelación» 2.6:1, verde «Asignar Folio y Entregar»/«Validar Producción» 3.1:1, rosa «Editar Specs»/«Enviar
  a Diseño» 3.5:1, turquesa «Regresar» 3.7:1, azul «Editar» 4.0:1, rojo «Cancelar con NC» 4.3:1. Y el gris tenue sobre gris de
  los botones plegables, 4.2:1. Los títulos de las tarjetas, en el color pleno: naranja 2.2:1, ámbar 2.6:1, rojo 4.3:1.
- Por diseño (escala compacta de 9 a 15 px y Geist): «tiny-text», «overused-font».
- Falso positivo: «gradient-text» (el único `background-clip` de la app es `content-box` en las barras de scroll).

**Overlays visuales:** no hay una pestaña que veas; el detector corrió en un navegador sin pantalla con una copia del diálogo.

## Overall Impression

Hace bien lo difícil: avanzar la orden sin salir del detalle, explicar cada acción rara, separar lo que un vendedor no debe ver.
Y mal lo de todos los días: abrir una orden no dice de quién es ni cuánto ni para cuándo sin bajar, el pie mezcla siete colores, y
dos cosas no funcionan (Tab y borrar el archivo cuando Storage falla). La mayor oportunidad: un encabezado que conteste
«¿de quién, qué, cuánto, para cuándo?» y un pie con UNA acción del rol, lo raro en «⋯ Más».

## What's Working

- **Actuar desde el detalle**: los botones de flujo del rol están en el pie fijo, sin cerrar ni buscar la tarjeta.
- **Lo raro se explica**: «Deshacer cancelación» y «Liberar folio» dicen qué hacen y qué no.
- **Lo que un vendedor no debe ver no se pinta** (precios, contactos, notas e historial de órdenes ajenas).

## Priority Issues

- **[P1] Borrar el archivo de producción traga los errores.** `deleteFile` no mira lo que contestan Storage ni la tabla
  (supabase-js no lanza): si Storage falla, la orden queda sin archivo y el archivo huérfano; si la tabla falla, la pantalla no
  dice nada. Es el mismo bug que v10.84.41 arregló en «Archivos». Arreglo: mirar `error` en cada paso y avisar.
  → /impeccable harden
- **[P1] Tab se sale del diálogo**: 36 de 40 Tab llevan el foco al menú de atrás. Arreglo: `atraparTab` en el panel, como los
  demás diálogos (v10.84.33). → /impeccable harden
- **[P2] El pie fijo no queda al ras**: 24 px de renglones se asoman debajo de «Cerrar / Imprimir» en todas las órdenes, a 1366 y
  a 1920. Arreglo: el pie fuera del área que hace scroll (diálogo en columna: cuerpo con scroll, pie fijo). → /impeccable layout
- **[P2] Un arcoíris donde debería haber una acción.** El pie llega a tener seis botones rellenos de colores distintos, tres de
  ellos para editar, y ninguno pasa contraste. Lo raro y destructivo («Cancelar Orden (con NC)», «Asignar Folio Anticipado»,
  «Regresar», «Devolver saldo») va como bloque enorme o botón lleno. Arreglo: una acción del rol rellena (en tinta que pase AA),
  lo demás teñido, y lo raro en «⋯ Más», como en la ficha. → /impeccable distill
- **[P2] El encabezado no contesta de quién, qué, cuánto ni para cuándo.** Trae el id interno y la imagen va antes que el
  cliente. Arreglo: cliente, producto y cantidad, importe y entrega arriba, con la imagen como miniatura que se amplía.
  → /impeccable layout

## Persona Red Flags

**Karla (folios y entregas):** abre P-0580 para foliar y tiene que pasar el logo para ver de quién es; su acción («Asignar Folio y
Entregar», verde 3.1:1) compite con «Imprimir» relleno y «Regresar» turquesa.

**Gerardo y producción en el piso:** en el borrador, «Revisar y Editar» y «Validar Producción» rellenos y «Prod / Pre-p» en ámbar
tenue; con el teclado, Tab lo saca al tablero.

**Marcelo (admin):** en cada orden facturada, una tarjeta roja enorme de «Cancelar con NC»; en el borrador, tres botones de editar.

## Minor Observations

- «NC emitida en SAT: Pendiente» en una cancelada SIN folio (no hubo factura que acreditar).
- «FLUJO» sale sin botones en una cancelada.
- «Nueva placa CTP requerida» en una orden ya entregada.
- «PRECIO» como sección y «PRECIO MXN» como renglón; «Click para descargar»; emojis ⏱️ ⏳.
- El ícono de «Info Fiscal» en verde vivo cuando la orden no tiene folio.

## Questions to Consider

- ¿Qué tiene que ver cada rol en los primeros 300 px? Karla: folio, importe, pago. Producción: especificaciones y entrega.
- ¿La imagen necesita 280 px de alto antes que el cliente, o una miniatura que se amplía?
- ¿Y si el pie fuera siempre «Cerrar · ⋯ Más · [la acción del rol]»?
