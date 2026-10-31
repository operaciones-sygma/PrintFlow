# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipo interno de producción de SYGMA (Padilla Hnos. Impresora, León, Gto.). No es para clientes externos (la tienda web es otra superficie).

- **Gerardo** (producción): mueve órdenes entre máquinas en el Tablero (Kanban) todo el día, en monitor y a veces en tablet del piso.
- **Noemí** (preprensa): diseño y pruebas; manda las órdenes a CTP.
- **Germán** (CTP): quema placas, registra las placas de cada orden (chicas y grandes) y vigila el mantenimiento del CTP.
- **Lupita** (secretaría y ventas): captura las órdenes de producción en el formulario, todos los días.
- **Karla** (folios y entregas): asigna el folio fiscal (factura o remisión) y entrega; parte facturas, factura por partes y liga folios. Es la usuaria principal del puente con CobranzaFlow.
- **Vendedores** (Genaro, Víctor, Manuel…): consultan sus órdenes.
- **Marcelo** (dueño, admin): ve todo; Torre de control, salud operativa, analítica.

Contexto: oficina y piso del taller, monitor de escritorio y laptop (se mide a 1366 y a 1920 de ancho), jornadas largas, mucho dato por pantalla. Comparte la base Supabase con CobranzaFlow: foliar aquí crea el documento allá (el puente).

## Product Purpose

PrintFlow lleva cada orden de producción desde que se captura hasta que se entrega: diseño, prueba, CTP y placas, máquinas, empaque, salidas, folio fiscal y entrega. Es la contraparte de producción de CobranzaFlow: PrintFlow produce y folia, CobranzaFlow cobra.

El éxito es que nadie pregunte "¿en qué va mi orden?", que Karla folie sin miedo a equivocarse de folio o de importe, y que el tablero diga la verdad: lo detenido se ve, lo sano se ve tranquilo.

## Positioning

PrintFlow está hecha a la medida de la planta de SYGMA, no es un ERP genérico: sus etapas son las de la planta y está ligada por la base a CobranzaFlow, así que foliar una orden aquí crea su documento allá y lo que se factura no se captura dos veces. Las reglas del dinero (el folio, el importe y quién paga) viven en la base y se revisan al entregar, igual por cualquier puerta.

## Operating Context

- La orden nace en la forma (Lupita) o en una OC; pasa por diseño, prueba, CTP (Germán), máquinas (Gerardo), empaque y Salidas; Karla la folia (factura o remisión) y la entrega.
- Desde el 1-sep-2026 SYGMA emite sus propios CFDI (series F- y RS-); las de Alpha (D-, R-) están retiradas.
- Se trabaja en la oficina y en el piso: monitores de 1366 y 1920, tablet en la planta; la hoja impresa de la orden acompaña el trabajo.
- Cada mañana, el Despertador con los pendientes del día (se cierra escribiendo SI ENTIENDO y queda el registro).
- Inventario Cuadra (las ventas de inventario, con su carrito), Apartado Corona, la maquila y «Planta» (el plano donde Gerardo acomoda las máquinas).
- Comparte la base y las cuentas con Almacén; Marcelo es el único que programa.

## Brand Personality

La misma familia que CobranzaFlow: **preciso, confiable, calmo**. Herramienta de piso, densa pero legible; el color sólo cuando significa algo. Voz directa y sin ceremonia, sin signos de exclamación.

## Anti-references

- Dashboard oscuro tipo fintech o SaaS, con gradientes y números en neón.
- Software legacy tipo Excel: gris sobre gris, botones diminutos, sin jerarquía.
- SaaS genérico: cards idénticas en grid, la plantilla hero-metric con gradiente.

## Evidence on Hand

- Los datos reales viven en la base de producción; las pruebas usan bancos con datos simulados (`tests/banco/`) y nunca escriben en producción.
- El plano de la planta sale del levantamiento en PDF (`scripts/plano/`, `src/plano/plantaBaja.js`).
- Las críticas de diseño anteriores, en `.impeccable/critique/`.
- No hay testimonios, casos de clientes ni material de mercadotecnia: es una herramienta interna, y no se inventan.

## Product Principles

- **El folio no se adivina.** Todo lo que toca un folio fiscal o dinero confirma con cifras y nombres, y dice lo que de verdad pasa, no lo que el botón parece hacer.
- **La misma regla en todas las puertas.** Asignar folio, la OC, el plan matriz y el carrito preguntan igual, y la base lo vuelve a frenar.
- **Un error de lectura no es «vacío» ni permiso.** Si no se pudo leer, se dice, y se frena lo que dependa de esa lectura.
- **Muestra el porqué.** Si algo no se puede (folio ocupado, parte ya facturada), se dice la causa y el siguiente paso.

## Design Principles

- **La acción común, a un clic** (mover una orden, foliar, entregar); lo raro y lo destructivo, detrás de un "Más".
- **Calma en el tablero.** Un tablero sano es casi monocromo; lo detenido resalta porque es raro.
- **Una sola familia SYGMA.** Se hereda "El Taller Ordenado" (ver DESIGN.md), no se reinventa.

## Accessibility & Inclusion

WCAG AA en lo que carga dinero o folios (montos, folios, estados), y el estado no depende sólo del color: color + ícono + palabra. Foco de teclado visible; los diálogos cierran con Escape y enfocan primero la acción segura. Se respeta `prefers-reduced-motion`.
