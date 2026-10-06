# Product

## Register

product

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

## Brand Personality

La misma familia que CobranzaFlow: **preciso, confiable, calmo**. Herramienta de piso, densa pero legible; el color sólo cuando significa algo. Voz directa y sin ceremonia, sin signos de exclamación.

## Anti-references

- Dashboard oscuro tipo fintech o SaaS, con gradientes y números en neón.
- Software legacy tipo Excel: gris sobre gris, botones diminutos, sin jerarquía.
- SaaS genérico: cards idénticas en grid, la plantilla hero-metric con gradiente.

## Design Principles

- **El folio no se adivina.** Todo lo que toca un folio fiscal o dinero confirma con cifras y nombres, y dice lo que de verdad pasa, no lo que el botón parece hacer.
- **La acción común, a un clic** (mover una orden, foliar, entregar); lo raro y lo destructivo, detrás de un "Más".
- **Calma en el tablero.** Un tablero sano es casi monocromo; lo detenido resalta porque es raro.
- **Una sola familia SYGMA.** Se hereda "El Taller Ordenado" (ver DESIGN.md), no se reinventa.
- **Muestra el porqué.** Si algo no se puede (folio ocupado, parte ya facturada), se dice la causa y el siguiente paso.

## Accessibility & Inclusion

WCAG AA en lo que carga dinero o folios (montos, folios, estados), y el estado no depende sólo del color: color + ícono + palabra. Foco de teclado visible; los diálogos cierran con Escape y enfocan primero la acción segura. Se respeta `prefers-reduced-motion`.
