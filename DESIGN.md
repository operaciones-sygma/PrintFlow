---
name: "SYGMA · El Taller Ordenado"
description: "Sistema visual de PrintFlow, la fuente de verdad de diseño para las apps internas SYGMA (CobranzaFlow lo adopta)."
colors:
  bg: "#fcfdfe"
  canvas: "#f0f3f7"
  surface: "#eff2f6"
  card: "#fcfdfe"
  border: "#e4e8ee"
  border-strong: "#d4dae2"
  text: "#1a1a1f"
  text-secondary: "#6c6c75"
  text-tertiary: "#73737b"
  placeholder: "#8c8c95"
  accent: "#4a6572"
  accent-hover: "#3a5460"
  accent-wash: "rgba(74,101,114,0.09)"
  success: "#30a85a"
  warn: "#e58a12"
  danger: "#e03b30"
  live: "#34c759"
  amber: "#ff9500"
  invoice: "#5856d6"
  info: "#007aff"
  cyan: "#0891B2"
  cyan-dark: "#22d3ee"
typography:
  title:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "1.3"
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "1.35"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "1.45"
  meta:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 500
  micro:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 600
  eyebrow:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.3px"
  data:
    fontFamily: "Geist Mono, ui-monospace, JetBrains Mono, monospace"
    fontSize: "13px"
    fontWeight: 500
rounded:
  sm: "10px"
  md: "14px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-small:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
    height: "40px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "16px"
  badge-identity:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "1px 6px"
    typography: "{typography.micro}"
  empty-state:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text-secondary}"
    padding: "40px 20px"
---

# Design System: SYGMA · El Taller Ordenado

## 1. Overview

**Creative North Star: "El Taller Ordenado"**

Esta es la herramienta de piso, no la vitrina. La usa Karla capturando folios, Gerardo planeando máquinas, Lucero conciliando depósitos: gente que la tiene abierta ocho horas y necesita leerla de un vistazo, no admirarla. La densidad es alta a propósito (mucha información por pantalla) pero nunca ruidosa: cada dato tiene su peso tipográfico, cada color tiene su significado, y el lienzo respira en gris frío para que las tarjetas floten sin gritar. Se siente como una app nativa de sistema (Geist limpio, semáforos estilo iOS, sombras apenas insinuadas), no como un SaaS con gradientes y hero-metrics.

El sistema rechaza el adorno decorativo. El color no pinta, informa: el acento slate aparece en lo seleccionado y en la identidad, y los semáforos (rojo peligro, ámbar aviso, verde éxito, verde-vivo para relojes) solo se encienden cuando de verdad hay algo que decir. Un tablero en calma es casi monocromo. Cuando algo se pone rojo, se nota porque es lo único rojo en pantalla.

La jerarquía la carga la tipografía, no las cajas. Antes de meter un borde o una sombra, se sube el peso o el tamaño. Las tarjetas existen porque una orden ES una unidad física de trabajo (una ficha), no porque "las cosas van en cards". Nada anida cards dentro de cards.

**Key Characteristics:**
- Densidad alta, ruido bajo: mucha info, poco color, jerarquía por tipografía.
- Neutrales fríos casi-blancos; un solo acento slate; semáforos iOS reservados para el significado.
- Tarjeta = ficha de trabajo. Táctil: se eleva al hover, da feedback de agarre al arrastrar.
- Geist para todo el UI, Geist Mono para los números (montos, folios).
- Nativo y calmo, nunca "SaaS landing".

## 2. Colors

Neutrales fríos casi-blancos como base, un único acento slate azul-verdoso apagado para identidad y selección, y una batería de semáforos vivos estilo iOS que se reservan para el significado. El color es escaso a propósito.

### Primary
- **Slate de Taller** (#4a6572): el acento único. Bordes de lo seleccionado, folios de identidad, íconos activos, botón primario. Su versión hover es **Slate Profundo** (#3a5460). El lavado **Slate Wash** (rgba(74,101,114,0.09)) tiñe fondos de chips de identidad y estados activos sutiles.

### Secondary (semáforos, solo con significado)
- **Verde Éxito** (#30a85a): confirmaciones, pagado, en-sistema. Fondo tinte al 12%.
- **Ámbar Aviso** (#e58a12) y **Ámbar iOS** (#ff9500): revisar, pendiente, recordatorio. Fondo tinte al 15%.
- **Rojo Peligro** (#e03b30): vencido, error, acción destructiva, faltante. Fondo tinte al 15%.
- **Verde Vivo** (#34c759): relojes corriendo, actividad en tiempo real (timers de máquina). Reservado para "esto está pasando ahora".
- **Violeta Factura** (#5856d6): folio fiscal, estado de facturación. En CobranzaFlow es el color natural de lo timbrado.
- **Azul Info** (#007aff): enlaces, información neutra, estados de sistema.
- **Cyan Respaldo** (#0891B2; oscuro #22d3ee): respaldo real pero no bancario (chip *Reporte de Alpha* / *Declarado a mano*) y avisos informativos que NO son error ni advertencia (Conceptos «cuadra · el SAT verá 1 centavo menos», banner de Aplicar pago). No es el slate del chrome ni el Azul Info de enlaces; no reusarlo para otro significado (v3.7.673-674).

### Neutral
- **Blanco Frío** (#fcfdfe): fondo base y superficie de tarjeta.
- **Lienzo Gris** (#f0f3f7): el gris detrás de las tarjetas, para que floten.
- **Superficie** (#eff2f6): fondos de chips de contexto, filas alternas.
- **Borde** (#e4e8ee) y **Borde Fuerte** (#d4dae2): divisores; los inputs simulan borde con un `box-shadow: 0 0 0 1px`, no con `border`.
- **Tinta** (#1a1a1f) texto principal, **Gris Texto** (#6c6c75) secundario, **Gris Tenue** (#73737b) terciario, **Placeholder** (#8c8c95).

### Named Rules
**La Regla del Color con Significado.** El color nunca decora. Slate = identidad/selección; rojo/ámbar/verde = estado semántico; verde-vivo = actividad en curso. Si un color no comunica un estado, va en neutro. Un tablero sano es casi monocromo; el rojo resalta porque es raro.

**La Regla del Tinte al 12-15%.** Los badges de estado nunca usan el color pleno de fondo: usan el color a 12-15% de alpha como fondo y el color pleno como texto/ícono (`bg: danger+"15"`, `fg: danger`). El color pleno se guarda para bordes, íconos y texto, no para rellenos grandes.

## 3. Typography

**Body / UI Font:** Geist (con system-ui, -apple-system fallback)
**Data Font:** Geist Mono (para números: montos, folios, cantidades)
**Display Font:** Geist (no hay serif de display; el sistema es sans puro, sin hero-headlines)

**Character:** Geist es un grotesco neutro y legible a tamaños chicos, ideal para densidad alta sin fatiga. Geist Mono da tabularidad a los números para que los montos y folios se alineen y escaneen en columna. No hay tipografía editorial ni de display: esto es instrumentación, no una portada.

### Hierarchy
La escala es de 5 pasos, deliberadamente compacta (el UI vive entre 9 y 15px porque la densidad es el punto):
- **Title** (700, 15px, line-height 1.3, tracking -0.01em): el dato dominante de una ficha. Nombre del cliente, monto, folio principal.
- **Label** (600, 13px): dato secundario. Folio fiscal, subtítulo, botones.
- **Body** (400, 11px): texto de contenido. Etapa, producto, descripción.
- **Meta** (500, 10px): metadato. Agente, fechas, contenido de badges.
- **Micro** (600, 9px): tags ultra-densos, chips de posición.
- **Eyebrow** (600, 10px, uppercase, tracking 0.3px): etiquetas de campo (labels de formulario), encabezados de sección. El único uso de mayúsculas.

### Named Rules
**La Regla del Peso Antes de la Caja.** Para crear jerarquía, primero se sube el peso (600 → 700) o el tamaño (un paso de la escala), no se agrega un borde ni una sombra. La tipografía carga la jerarquía; las cajas son el último recurso.

**La Regla del Número Monoespaciado.** Todo número que se lea en columna o se compare (montos, folios, cantidades, saldos) va en Geist Mono. Los números en prosa pueden ir en Geist normal.

## 4. Elevation

El sistema NO es plano: usa sombras, pero apenas insinuadas y tintadas hacia la tinta fría (nunca negro puro). La profundidad es sutil en reposo y responde al estado: una tarjeta descansa con una sombra mínima y se ELEVA al hover (sombra más profunda + translateY de -1px), lo que la vuelve táctil. Ese lift es la firma del sistema; es lo que hace que se sienta "vivo pero calmo".

### Shadow Vocabulary
- **Reposo** (`box-shadow: 0 1px 3px rgba(26,26,31,.08), 0 1px 2px rgba(26,26,31,.04)`): sombra por defecto de una tarjeta. Casi imperceptible.
- **Mínima** (`box-shadow: 0 1px 2px rgba(26,26,31,.05)`): elementos secundarios, chips elevados.
- **Lift / Hover** (`box-shadow: 0 14px 34px -10px rgba(26,26,31,.20), 0 0 0 .5px rgba(0,0,0,.04)`): la tarjeta al pasar el cursor. Combinada con `transform: translateY(-1px)`.

### Named Rules
**La Regla del Lift Táctil.** Las tarjetas responden al hover elevándose (sombra Lift + translateY -1px), con transición `box-shadow .18s cubic-bezier(.22,1,.36,1), transform .18s cubic-bezier(.22,1,.36,1)`. Nunca se anima con bounce ni elastic: ease-out exponencial. El cursor cambia a `grab`/`grabbing` en lo arrastrable.

## 5. Components

### Buttons
- **Shape:** esquinas suaves (10px radius). Nunca cuadradas, nunca pill salvo chips.
- **Primary:** fondo Slate de Taller (#4a6572), texto blanco, padding 10px 18px, peso 600, Geist. Hover a Slate Profundo (#3a5460).
- **Small:** mismo estilo, padding 6px 14px, `min-height: 40px` (touch target sin ensanchar la fila).
- **Semantic:** los botones destructivos/de estado usan el semáforo correspondiente como fondo (rojo peligro para borrar/cancelar), no el slate. El fondo del botón rojo es la **tinta** del rojo (`--danger-ink`, #C42A20): el rojo pleno (#e03b30) con texto blanco da 4.3:1 y no pasa AA; la tinta da 5.7:1 (v3.7.919). Lo mismo con el verde: el botón verde va en `--success-ink` (#157F3C, 5.1:1; el verde pleno #30a85a daba 3.1:1, v3.7.921).
- **Hover/Focus:** transición de fondo suave; los elementos con foco de teclado reciben un anillo de acento (`outline`), no se suprime nunca.

### Chips / Badges
- **Style:** fondo del color de estado al 12-15% de alpha, ícono en el color pleno y **texto en su tinta** (`successInk`, `warningInk`, `dangerInk`, `orangeInk`): en claro, el verde pleno sobre su tinte da 3.0:1 y el ámbar 2.6:1; la tinta, 4.7-5.1:1 (`Badge`, v3.7.939; en oscuro la tinta vale lo mismo que el pleno). El cian no tiene tinta todavía (3.4:1). Radius 10px, padding 1px 6px, tipografía micro (9px, 600).
- **Tonos (BADGE_TONES):** `context` (gris neutro), `identity` (slate wash), `danger`, `warn`, `success`, `info`. Un badge elige su tono por significado, no por decoración.
- **Regla:** el estado se codifica en color + ícono + palabra cuando el contraste del color solo no basta (accesibilidad: los tintes claros a veces fallan AA, así que el ícono y la palabra hacen el trabajo pesado).

### Cards / Containers
- **Corner Style:** 14px las tarjetas (fichas), 16px los contenedores grandes, 10px los elementos internos (chips, inputs).
- **Background:** Blanco Frío (#fcfdfe) sobre el Lienzo Gris (#f0f3f7). El contraste blanco-sobre-gris es lo que las hace flotar; no necesitan borde.
- **Shadow Strategy:** sombra Reposo en reposo, Lift al hover (ver Elevación).
- **Border:** en contenedores genéricos, normalmente ninguno; cuando hay, es de 1px full neutro (jamás una franja lateral gruesa de color). **Excepción — la OCard firma:** lleva SIEMPRE un borde completo de 1.5px tintado con el color de su etapa al ~40% (ver §OCard); es contorno entero sutil, no franja lateral.
- **Internal Padding:** 16px por defecto; las tarjetas densas (modo compacto) bajan a 10px.
- **Anidamiento:** prohibido. Una card nunca contiene otra card.

### Inputs / Fields
- **Style:** fondo blanco, sin `border` real: el contorno es un `box-shadow: 0 0 0 1px #e4e8ee`. Radius 10px, padding 10px 14px, Geist 13px.
- **Label:** encima, en eyebrow (10px, 600, uppercase, tracking 0.3px, color gris texto).
- **Focus:** el anillo se intensifica (shadow a acento); nunca se elimina el foco visible.
- **Error:** el anillo pasa a rojo peligro; el mensaje va inline debajo, nunca en un `alert()`.

### OCard (componente firma)
La tarjeta de orden/registro, y el patrón a replicar en CobranzaFlow para facturas/cobros. Anatomía en tres tiers de jerarquía:
- **Tier 1 (alertas):** una fila de badges de estado fuerte primero (vencida, urgente, faltante), solo si aplican.
- **Tier 2 (identidad):** el dato dominante en Title (cliente / monto), con el folio o identificador al lado en badge de identidad (slate wash).
- **Tier 3 (metadata):** debajo, en Meta/Micro, colapsable tras un chip "+N" cuando hay muchos: agente, fechas, flags fiscales.
- El bloque de estado/dinero va DEBAJO del "para quién / qué", no encima (primero se lee la entidad, luego su estado).
- Acciones: 3-4 utilitarias visibles como íconos; las destructivas/raras se esconden tras un menú "⋯ Más" con etiquetas de texto.
- La card es enfocable por teclado (role=button, tabIndex=0, Enter/Espacio abre el detalle) y tiene aria-label.
- **Borde-acento (firma):** a diferencia de la card genérica, la OCard SIEMPRE lleva un borde completo de 1.5px tintado con el color de su etapa al ~40% (`+"66"`); urgente lo pinta en rojo peligro. No es una franja lateral: es el contorno entero, sutil. Reemplaza al viejo side-tab. El color aquí SÍ tiene significado (codifica etapa), así que no rompe la regla "color con significado"; convive con el chip de etapa (icono+palabra) para a11y. Aplica igual a las cards de lista derivadas (salidas, archivo, resultados de búsqueda).

### EmptyState (componente firma)
Estado vacío compuesto y reutilizable: ícono (46px), título (15px, 700), hint que GUÍA (12px, gris, max ~330px, explica qué hacer o cuándo aparecen las cosas), y una acción opcional (botón). `tone="positive"` (ícono verde relleno) para estados sanos ("nada pendiente"); `tone="neutral"` para vacíos comunes. Un vacío nunca es una pantalla en blanco: siempre dice por qué está vacío y qué sigue.

### Toast
Notificación efímera abajo-centro, fondo del color semántico (éxito/error/aviso/info), texto blanco, radius 14px. Puede llevar una acción ("Deshacer"). Identidad por contador monotónico + key para que dos toasts seguidos no se pisen.

## 6. Do's and Don'ts

### Do:
- **Do** usar Geist para todo el UI y Geist Mono para los números que se leen en columna (montos, folios, saldos).
- **Do** reservar el color para el significado: slate (#4a6572) para identidad/selección, semáforos para estado, verde-vivo (#34c759) para actividad en curso.
- **Do** cargar la jerarquía con la escala tipográfica de 5 pasos (title 15 / label 13 / body 11 / meta 10 / micro 9) antes de agregar bordes o sombras.
- **Do** dar a las tarjetas el lift táctil al hover (sombra Lift + translateY -1px, ease-out exponencial) y feedback de agarre (`grab`/`grabbing`) en lo arrastrable.
- **Do** usar el badge por tono semántico (BADGE_TONES) con fondo al 12-15% + tinta en el texto (color pleno en el ícono); triple-codificar estado crítico (color + ícono + palabra) para accesibilidad.
- **Do** darle a cada estado vacío un EmptyState que explique qué sigue; nunca una pantalla en blanco.
- **Do** hacer las cards y controles accesibles por teclado (focus visible, role/aria, Enter/Espacio).

### Don't:
- **Don't** usar `#000` ni `#fff` puros: los neutrales van tintados en frío (bg #fcfdfe sobre lienzo #f0f3f7).
- **Don't** pintar rellenos grandes con el color pleno de un semáforo: usa el tinte al 12-15%. El color pleno es para texto, íconos y bordes.
- **Don't** usar franjas laterales de color (`border-left` grueso) en cards, filas o alertas. Borde full de 1px, tinte de fondo, o nada.
- **Don't** anidar una card dentro de otra card. Jamás.
- **Don't** caer en la plantilla hero-metric (número gigante + label + stats + gradiente): es cliché SaaS y este sistema es una herramienta de piso, no una landing.
- **Don't** usar gradientes de texto, glassmorphism decorativo, ni sombras negras puras: la profundidad es sutil y tintada en frío.
- **Don't** meter todo en un modal por reflejo: agota primero lo inline y la revelación progresiva (el "⋯ Más", el "+N" colapsable).
- **Don't** animar propiedades de layout ni usar bounce/elastic: solo `box-shadow`/`transform` con ease-out exponencial.
- **Don't** usar `alert()` para errores: mensaje inline debajo del campo, con el anillo en rojo peligro.
- **Don't** pintar de rojo un saldo sólo porque es mayor que cero: el rojo pide cobrar, así que va en lo **vencido**. Un saldo
  «En tiempo» va en el color del texto, como en la lista de Documentos (v3.7.918; el detalle del documento lo tuvo rojo al lado
  de la etiqueta verde «En tiempo»). Lo mismo con el verde: no va en un importe que todavía no se sabe de quién es (v3.7.913).
- **Don't** pintar de rojo el botón de una acción de todos los días sólo porque es irreversible: en una lista, una columna de
  botones rojos le quita el significado al rojo de los errores. En Por Timbrar el botón de la fila va en slate y el rojo vive en la
  confirmación («Se emite el CFDI FISCAL ante el SAT. Es irreversible») y en «Timbrar de todos modos» (v3.7.919). Lo mismo en
  el REP (v3.7.926). Y la acción RARA y destructiva de una tabla (Cancelar un CFDI) no se repite en cada fila: va en «⋯ Más»
  con su texto; la fila lleva lo que se usa (consultar, bajar) en íconos con nombre accesible (Cancelaciones, v3.7.926).
- **Don't** pintar el tipo de un documento con un color de estado: factura, complemento, traslado y nota van en gris; el color
  lo pone el estado. El complemento iba en el cian reservado al respaldo y la nota en el ámbar de «revisar» (v3.7.926).
- **Don't** llamar a una cifra por una sola de sus partes: `credited_amount` son las notas de crédito **y** lo condonado
  (v3.7.918b). Si la pantalla no sabe qué parte es cuál, usa el nombre del total («Acreditado»).
- **Don't** poner en negrita la acción de quitar un renglón de una lista: pesa más que el dato. Va como una «×» discreta
  (`textMuted`) con su nombre accesible («Quitar <lo que quita>»), igual en los nombres internos y en los contactos de la
  ficha (v3.7.930). La acción rara junto a la de todos los días va en texto discreto, no en otro botón igual de fuerte
  («Usar como principal» junto a «Agregar»).
- **Don't** meter en la caja teñida del confirm la frase que sólo da contexto: esa caja es para avisar o confirmar algo que
  pesa. En un diálogo de elegir (a quién se manda), la frase va en texto normal y dice de qué y de quién es; la ayuda sale
  cuando hace falta, no siempre, y el botón dice lo que va a pasar («Enviar a 3 correos», v3.7.930).
- **Don't** meter dos ciclos de vida en una sola columna «Estado». En Comisiones, «Por cobrar» (el cliente debe), «Por pagar»
  (le debemos al vendedor) y «Pagada» (ya se le pagó) iban juntos y casi iguales (critique 23/40). Lo de uno va como grupo
  («No han pagado» / «Ya pagaron») y lo del otro como su columna, con palabras que digan a quién («Por pagarle»,
  v3.7.934). Y un reporte que se le entrega a alguien habla desde SU lado («Pendiente de pago»), no desde el de la empresa.
- **Don't** dejar un estado de dinero sin su porqué a un clic. Lo que respalda un cobro (el depósito y quién lo concilió, o
  el vale y quién cerró la caja) va al abrir el renglón; la orden de producción, si hace falta, como botón secundario
  (v3.7.934). Y **don't** nombrar una pestaña igual que una entrada del menú: «Historial» ya existía y el clic se fue ahí.
- **Don't** dejar visible una columna de acciones vacía: parece que algo no cargó. Sale sólo si algún renglón tiene qué
  hacer («Todas las comisiones», v3.7.934).
- **Don't** hacer aparecer arriba de todo la barra de lo que se seleccionó. Va junto a las casillas, en un renglón que mide lo
  mismo con o sin selección (el título del grupo, con «Marca las que…» cuando no hay nada). En Comisiones aparecía sobre las
  dos tablas: en laptop quedaba fuera de la vista (y=−189) y en monitor empujaba la tabla 70 px bajo el cursor (v3.7.935).
- **Don't** poner dos tablas lado a lado sin medir el ancho que piden. A 1366 cada columna mide 526 px y la tabla pedía
  720-760: se cortaba justo el dinero. Lado a lado sólo cuando caben (`repeat(auto-fit, minmax(min(100%, N), 1fr))`, con N =
  lo que pide la tabla compacta), una debajo de otra si no; y lo que el renglón no necesita (una estimada que ya está
  arriba) va al detalle (Comisiones, v3.7.935).
- **Don't** avisar dos veces el mismo hecho. El aviso de un cobro lo da quien sabe qué pasó (el diálogo, que sabe si se
  duplicó); quien lo abrió sólo cierra. En Documentos salía «Pago aplicado correctamente» debajo de «no se duplicó»
  (Aplicar pago, v3.7.936).
- **Don't** dejar los botones de un diálogo debajo del borde. Cuando el diálogo se desplaza por dentro (a 1366x768 pasa en
  cuanto aparece un aviso), los botones van fijos abajo; y el texto de un aviso va en la tinta de su color (`successInk`,
  `warningInk`, `dangerInk`), no en el pleno: «quedará completamente pagada» en verde pleno daba 3.0:1 (v3.7.936).
- **Don't** estilizar una página aislada con el CSS de la app. Los portales (`?ec=`, `?vc=`) se montan sin `App.jsx`: todo
  lo que usen se define en su propio `<style>`. El logo del portal del cliente usó una clase de `App.jsx` y salió a 921x400
  del 24-ago al 30-sep; `scripts/probar-portal-aislado.mjs` lo revisa en cada build (v3.7.937). Y sobre un fondo oscuro, el
  logo va en su copia blanca recortada, no invertido con `filter` ni con el margen vacío del PNG original.
- **Don't** obligar a guardar para comprobar. Si lo que la persona quiere es saber si algo está bien (los datos de un cliente
  contra el SAT), la comprobación va sola y no escribe, y su resultado se ve donde se decide (la fila de Por Timbrar dice
  «Validado con el SAT el …»). Guardar es para cuando algo cambió: Karla re-guardaba los mismos datos fiscales 34 veces al
  mes sólo para ver la validación (v3.7.938). Y un error de formato sale al salir del campo, no con la primera letra.
- **Don't** pedirle a la persona lo que el archivo ya dice. La cuenta de un TXT del banco la dicen su formato y el número
  escrito en cada renglón: el selector venía en Scotiabank y 29 de 48 archivos de Lucero eran de Banorte (Importar, v3.7.939).
  Se dice como hecho («la dice el archivo») con un «Cambiar» discreto; el selector sale sólo si el archivo no lo dice. Y lo
  que se deduce se confirma con lo que el documento trae (un PDF sin número ni periodo que lo confirme pide la cuenta).
- **Don't** enseñar el archivo crudo como vista previa. Una vista previa dice qué trae (de qué días, cuántos depósitos y
  retiros, por cuánto) y si ese mismo archivo ya se subió; tres renglones `1206511774|28/09/2026|…` no le dicen nada a nadie
  (v3.7.939). Y un aviso que nunca cambia («la importación es idempotente») no es un aviso: se dice cuando aplica.
- **Don't** recetar en un aviso un botón que no está donde la persona va a buscarlo. El aviso de Tesorería mandaba a «No
  falta nada aquí», que en el hueco que llega hasta ayer no existe; y el botón «Subir archivos ahora» aterrizaba en otra
  pestaña porque un salto automático pisaba la que pedía el enlace (v3.7.939). Un enlace a una pestaña gana siempre.
- **Don't** confiar en que `75ch` son 75 caracteres: en Geist (proporcional) caben ~95. Para renglones de lectura de ~75-78
  caracteres, `64ch` (v3.7.939; el detector lo mide en caracteres reales).
- **Don't** separar la revisión de la acción que la sigue. Si alguien abre un editor para revisar antes de imprimir (19 de 19
  veces en la remisión), el editor imprime; y si no cambió nada, no obliga a guardar (v3.7.940). Y un texto que se revisa se
  lee completo: un campo de una línea con 262 caracteres adentro no se revisa.
- **Don't** mandarle a un cliente un papel que se cobra sin decir cuándo vence, cómo pagarlo y qué escribir en la
  transferencia: la remisión no lo decía y sus depósitos son los que más cuesta identificar (v3.7.940). Al cliente se le habla
  de tú, igual en el portal, los mensajes y el papel.
- **Don't** meter una imagen en jsPDF sin compresión: `addImage(img, 'PNG', x, y, w, h, alias, 'FAST')`. Sin el último
  argumento el logo (22 KB) se volvía ~700 KB en cada PDF (los cuatro de la app, hasta v3.7.940). Y en jspdf-autotable,
  `columnStyles` alinea sólo el cuerpo: los títulos se alinean en `didParseCell` (v3.7.857, v3.7.940).
- **Don't** darle a alguien una cifra para teclear en otra pantalla sin medir cómo la usa esa pantalla. Para que PrintFlow
  ligue una factura hecha por adelantado, la orden tiene que ir por el **subtotal**: ahí el precio va sin IVA y se compara
  precio × 1.16 contra el total. Decir el total («es lo que lleva el CFDI») la habría dejado sin ligar siempre (Factura sin
  orden, v3.7.941). Y una instrucción que nombra un camino nombra todos: las parcialidades se ligan por otro (5 de 12).
- **Don't** explicar una firma con un flujo que nadie midió. La tarjeta de Contabilidad decía «Tesorería registró estos cobros»
  (Karla, 47 de 48) y que la firma «hace válida la entrega» (el efectivo no va a Contabilidad). Se dice quién lo hizo, de la
  base, y qué falta; lo que no se sabe no se explica (Vales de Caja, v3.7.942).
- **Don't** contar un pendiente sobre la lista filtrada y actuar sobre otra. La tarjeta contaba los vales visibles y su
  botón acusaba otros; el resumen de arriba sumaba los 100 cargados y lo llamaba «recientes» (eran toda la historia). La
  cifra y la acción leen lo mismo, de la base, y un resumen dice de cuándo es («Hoy: 2 vales · $99,653.00», v3.7.942).
- **Don't** ordenar una cola de cobro sin medir qué cubren los primeros renglones con cada orden. Cobranza iba por la factura
  más vieja: las 10 primeras eran el 5.3% de lo vencido (por dinero, el 82%). Se mide, se ordena por lo que más recupera y lo
  otro queda a un clic; lo que no compite (la cartera de hace más de un año) va aparte, plegado (v3.7.943).
- **Don't** construir el botón principal alrededor de algo que nadie hace. «Registrar gestión» tuvo 0 usos en 6 semanas; lo
  que sí se hacía (mandar el cobro) ya se registraba y nadie lo leía. Lo que la persona ya hace se registra solo y se enseña;
  lo que se pide a mano, en los menos pasos posibles (v3.7.943).
- **Don't** dejar que lo de arriba esconda la lista. En Documentos, dos avisos abiertos y la cifra gigante empujaban la tabla
  a y=714 de 768 en la laptop: se abría la pantalla y no se veía ni un documento. Un aviso que se repite cada visita va
  plegado (cuántos, por cuánto, el más antiguo) y se abre ahí mismo; la cifra va en el título. Se mide dónde sale la primera
  fila a 1366 (v3.7.944).
- **Don't** apilar las acciones de una fila. Tres botones en una celda angosta hicieron cada documento de 118 px; van en una
  línea que no se parte, con lo de todos los días en texto discreto y lo demás en íconos con nombre (v3.7.944).
- **Don't** mandar un enlace «para pagar» que no lleva a pagar. El enlace de un documento bajaba solo a media página y la
  cuenta estaba abajo, con las dos CLABE y la equivocada primero. Un enlace de pago empieza por lo que pide el banco y en su
  orden (la cuenta de ese documento, el monto, el concepto), cada cosa copiable, y no mueve la página (portal, v3.7.946).
- **Don't** prometerle al cliente lo que el sistema no hace. «Aplicamos tu pago al instante» (mediana: 2 días hábiles) y
  «evitas recordatorios» (la cola de cobro no leía los avisos). Lo que se le promete a alguien de fuera se mide, se escribe
  con la cifra, y si la promesa vale la pena, se construye lo que la cumple (v3.7.946-947).
- **Don't** ordenar una lista por el reloj de otro. El portal del vendedor iba por el vencimiento del cliente, y lo que le
  cuesta al vendedor es la fecha en que se le baja la comisión: la venta que se le bajaba en 2 días salía tercera, y el rojo
  estaba en el reloj que no le baja nada. Se ordena por lo que le importa a quien la lee, se agrupa por a quién se le habla
  (un cliente, una llamada) y se dice lo que necesita para actuar (cuánto debe) (v3.7.950).

---

## Notas de PrintFlow: lo que el sistema no dice y el código sí hace

> Este archivo es copia del DESIGN.md de CobranzaFlow (es el mismo sistema, "El Taller Ordenado"). Lo de abajo son las diferencias reales de los tokens de PrintFlow (`const C` y `const F` en `src/App.jsx`), medidas el 5-oct-2026.

- **`C.bg` y `C.card` son el mismo color (#fcfdfe).** Un recuadro con fondo `C.bg` dentro de una tarjeta es invisible. Para zonas dentro de una card se usa `C.sf` (#eff2f6).
- **Tintas para el texto de estado (desde v10.84.32): `C.wnInk` #b45309, `C.dnInk` #b91c1c, `C.okInk` #15803d, `C.emrInk` #047857** (4.9 a 6.4:1 sobre `C.bg`). El color pleno del semáforo como texto reprueba AA (`C.amb` 2.2:1, `C.emr` 2.5:1, `C.wn` 2.6:1, `C.ok` 3.0:1, `C.dn` 4.3:1) y se queda en barra, borde, ícono y tinte al 12-15%. Hay pantallas viejas con el pleno como texto o con estos hex escritos a mano: al tocarlas, a la tinta.
- **`C.ctp` es cian (#0891b2, 3.3:1 sobre blanco).** Es el color de la etapa CTP, no el acento; como texto chico se ve tenue.
- **Los colores de etapa** (`ctp`, `dsn`, `fac`, `emp`, `maq`, `sal`…) codifican la etapa de la orden. Tienen significado, pero no son color de estado (vencido, ok).
- **Escala `F`:** title 15, label 13, body 11, meta 10, micro 9. Los números grandes de medidores y tableros (18 a 36px) son decisión, no deriva.
- **Diálogos:** `useEscClose(onClose)` (escStack) y se montan sólo cuando están abiertos. El patrón accesible es `role="dialog"` + `aria-modal` + `aria-labelledby` + autofoco en la acción segura + `onKeyDown={atraparTab}` en el panel (sin eso, Tab y Mayús+Tab se van al tablero de atrás; v10.84.33). **Nunca un listener propio de Escape en `window`**: el escStack cierra sólo el diálogo de arriba, y un listener propio cierra también el de abajo (el split perdía el plan entero con un Esc sobre «Folio ya existe», v10.84.32). Las preguntas van con `ConfirmModal` (`zIndex` mayor que el del modal), no con `window.confirm`; el clic fuera no cierra un diálogo que ya tiene captura, y Esc pregunta antes de tirarla. Un diálogo que puede crecer (pagos, partes) lleva el **pie fijo** con los errores y los botones, y sólo hace scroll el cuerpo: en la laptop el botón principal quedaba debajo del pliegue (v10.84.32-34). Un diálogo que crea un documento fiscal dice **cuánto y a quién** en el encabezado y en la vista previa, y **pregunta antes de crear** con las cifras, el receptor y los folios (v10.84.42).
- **Arrastrar nunca es la única forma** (v10.84.42): lo que se acomoda arrastrando (las órdenes entre documentos del folio por OC) también se mueve con un `<select>` «Mover a» en cada ficha, que funciona con teclado, en tablet y con lector de pantalla. Y el caso común se arma de un clic («Una factura por orden»).
- **Un solo «seleccionado» por ventana, y el relleno pleno es sólo de la acción** (v10.84.43): las opciones elegidas (tipo,
  cuántos documentos) van teñidas al 8% con contorno y la letra en su color. Si una opción elegida va rellena, pesa lo mismo
  que el botón principal y compiten. Las pestañas de modo (Simple / Dividir) son otro componente y se quedan elevadas.
- **La pregunta antes de crear varios documentos es una lista, no un párrafo centrado** (v10.84.43): `ConfirmModal` con
  `detalle` ({filas:[{titulo, sub, monto}], total}) pinta cada documento con su importe alineado a la derecha.
- **El problema tiene lugar** (v10.84.43): lo que el pie dice que falta se marca donde está (el borde rojo del documento,
  los dos campos de un folio repetido).
- **No se decide antes de tiempo, ni se espera para siempre** (v10.84.44): mientras llega lo que puede cambiar la decisión (el
  saldo del cliente, el traslado), el botón principal se apaga y el pie dice «Revisando…»; y todo lo que se consulta al abrir
  lleva un tope (8 s) que lo trata como un error con su salida («Reintentar»).
- **Ctrl+Enter abre la pregunta, nunca crea** (v10.84.44): el atajo del botón principal hace exactamente lo que hace el botón,
  con la misma pregunta antes de crear; el botón lo declara en `aria-keyshortcuts`.
- **El pie fijo va FUERA del área que hace scroll** (v10.84.46): el diálogo es una columna (encabezado, cuerpo con
  `overflowY:auto` y `minHeight:0`, pie). Un pie `position:sticky` dentro del cuerpo deja asomar los renglones por debajo
  (el padding del panel queda bajo el pie): pasó en el detalle de la orden a 1366 y a 1920.
- **La tinta de un color se calcula, no se inventa** (v10.84.46): `tintaAA(color)` oscurece el token hasta que el blanco
  encima (o el color como texto) pase AA, y `tenueAA(color)` es su botón teñido. Para los colores de etapa, que no tienen
  tinta escrita; los semáforos usan la suya (`C.okInk`, `C.wnInk`, `C.dnInk`, `C.emrInk`).
- **Lo raro en «⋯ Más» también en los diálogos** (v10.84.46): como en la ficha, cada acción con su explicación de una línea
  y su propia confirmación. El menú se cierra con Esc por el `escStack` (un componente con `useEscClose`), nunca con un
  listener propio, para que el primer Esc cierre el menú y no el diálogo. **Y Esc regresa el foco al botón que lo abrió**
  (v10.84.48): la opción enfocada desaparece con el menú y el foco se iba al `<body>`, fuera del diálogo (sin Tab atrapado
  ni atajos).
- **La guía de qué sigue nunca se esconde con su renglón** (v10.84.48): cuando el rol no tiene botón, la línea «Arrastra esta
  orden a…» ES lo que el detalle tiene que decir; un renglón que se oculta por no traer botón se lleva la guía con él (le pasó
  a Germán en CTP). Y un rótulo de sección sólo sale si algo de la sección se ve para ese rol.
- **Lo que va a un catálogo de todos se guarda terminado** (v10.84.49): un campo que escribe en algo compartido (el color de
  un Pantone) guarda con Enter o al salir con el valor completo, nunca mientras se teclea; un selector guarda al soltarlo; y
  el valor se pone en pantalla cuando la base lo guardó (si falla, lo escrito se queda para reintentar).
- **Un componente se define fuera de otro** (v10.84.49): `const Row=(…)=>…` dentro de un componente es un componente NUEVO en
  cada render, y React vuelve a montar todo lo de adentro (se pierde lo escrito y se repiten las consultas). Si hace falta
  el nombre corto, `const Row=FilaDelDetalle` apunta a uno de afuera.
- **El botón trabado se ve trabado y lo que lo destraba es la acción principal** (v10.84.49): apagado en `bt(C.sf,C.t2)` con
  cursor `not-allowed`, su porqué a la vista en `C.wnInk` (no sólo en el title), y el relleno y el atajo van a la acción que
  lo destraba («Editar Maquila» cuando falta el precio).
- **Después de actuar, el segundo clic no llega a nada** (v10.84.54): un botón que avanza, abre una ventana o cierra algo deja
  medio segundo una capa invisible que se traga los clics (`escudoDeClics`). Sin ella, el segundo clic de un doble clic (o el
  doble toque en tablet) caía en lo que quedaba debajo: en el tablero, sobre el botón de OTRA orden. El tablero tiene el
  mismo riesgo en sus propios botones (para su critique).
- **Cerrar con algo escrito pregunta** (v10.84.54): Esc, el clic fuera, la × y «Cerrar» preguntan si hay texto sin guardar en
  un campo, y lo que la base rechaza regresa al campo con su aviso. «Seguir escribiendo» regresa el foco a ese campo
  (v10.84.55; caía al `<body>`).
- **Un aviso de error dice qué orden, qué no se hizo y por qué en palabras** (v10.84.59): «P-0578 no pasó a «Empaque»: sin
  conexión», nunca el nombre de una función ni el mensaje crudo de la base (`errorEnPalabras`; el crudo, a la consola). Y lo que
  se movió en pantalla antes de que la base contestara se regresa en cuanto contesta que no. **Una ventana que guarda dice de
  qué orden es y no acepta basura** (en el campo, con su porqué), y un doble clic guarda una vez.
- **Un contador que alarma dice cuáles** (v10.84.58): «N vencidas» se aprieta y abre la lista con dónde está cada una y lleva
  a su ficha; un número rojo que no se puede seguir es ruido. **Y un reloj que cruzó la noche dice desde cuándo** («desde ayer
  05:48», en ámbar): las horas corridas cuentan las noches y se leen igual que unos minutos. **Las alertas de una orden son las
  mismas en todas las fichas** (`AlertasDeFicha`: `alertasDeLaOrden` + `banderasDeLaOrden`), también en el tablero.
- **La planta se ve de un vistazo** (v10.84.62): lo que corre va arriba, en «Así va la planta», una línea por máquina con
  trabajo o fuera de servicio (la orden, el cliente recortado con «…», el reloj, cuántas en la fila) y las libres en un
  renglón. Cada una lleva a su máquina (abre su categoría si está plegada y le pasa el foco) y acepta soltar como su tarjeta,
  por el mismo `drop()`. Una fuera de servicio no va entre las libres, y soltar en ella dice por qué no. **En una rejilla de
  tarjetas, cada una mide lo que trae** (`alignItems:"start"`): una libre no se estira al alto de la cargada de al lado.
  **Una lista que empuja lo importante fuera de la pantalla se pliega a sus primeras**: Listas enseña las 4 más urgentes,
  con «+N más · Ver las N». «Ver menos» es el mismo botón, para que el foco no se pierda. Se abre sola cuando se busca o se
  va a una de las de abajo, y lo abierto se recuerda en la pestaña.
- **Una acción va dentro de la ficha que mueve, y con palabra** (v10.84.63): en Empaque eran tres íconos sueltos debajo de
  cada ficha, a 8 px de la siguiente, y el bote de basura (merma) se leía «borrar». Lo de todos los días va al frente
  («A Salidas»: 286 en 60 días) y lo raro en «⋯» («Enviar a maquila» y «Registrar merma»: 0 y 0 en 60 días), cada opción
  con su explicación: **se mide antes de esconder algo**. Un «⋯» dentro de una lista con scroll se abre en la misma ficha,
  no flotando (lo recortaría el scroll). Su «clic afuera» se escucha con el **clic en captura**: sin captura, la ficha que
  detiene sus clics lo esconde y quedaban dos abiertos; con `mousedown`, cerrarlo encoge la ficha, lo de abajo se mueve antes
  de soltar el botón, y el clic ya no llega al «⋯» que se quería abrir.
- **Un error no es un «vacío»** (v10.84.65): sin una lectura buena, ninguna pantalla dice «vacío», «libres», «0» ni «nada
  pendiente». Mientras se hace la primera lectura se dice que se está leyendo («Leyendo de la base…», «Leyendo el tablero…»).
  Si una lectura falla, lo que se ve se queda (es lo último que se leyó bien) y un aviso arriba dice **de qué hora es** y da
  «Reintentar»; el punto de conexión deja de decir «En tiempo real». Antes, `loadOrders` devolvía `[]` ante un error y la
  recarga dejaba el tablero vacío y verde; el archivo completo que fallaba dejaba toda la app en 0. El cliente de Supabase ya
  reintenta solo un 503 tres veces (a 1, 2 y 4 s): el aviso sale a los ~7 s, no al primer tropiezo.
- **Un botón que no se puede usar no desaparece sin decir por qué** (v10.84.67): en la OC, «Asignar folio» sólo existe con todas
  sus órdenes en Salidas, y se esfumaba sin explicación (Karla esperaba sin saber a cuál). Donde iría, ahora se dice cuáles faltan
  y dónde está cada una, con la salida que sí existe (pasar las que ya están listas, o «Pre-asignar folio»). **Lo que espera a
  otra persona se ve, y lo que ya está listo se puede pasar** («En la planta» de Karla), con la pregunta que dice qué le pasa a
  la máquina y a quién se avisa. **Al terminar, el foco no se pierde**: lo que lo tenía se fue a Salidas, así que va al siguiente
  «Pasar…» de la lista, o a «Asignar folio» si la OC quedó completa.
- **Una pregunta no dice «no» de lo que otra va a ofrecer** (v10.84.68): antes de asignar folio, la app preguntaba por la factura
  por adelantado de OTRO importe («no se liga sola») y callaba la del mismo importe, que la base iba a ofrecer después; Karla leyó
  que F-135 no se ligaba. Si hay lo que sí se puede hacer, eso va primero, y lo demás no se pregunta. **Un aviso que detiene dinero
  se queda en pantalla** (`ConfirmModal` sin `onConfirm`: un solo botón, «Entendido»), no en un aviso abajo que se borra antes de
  leerlo, y dice qué hacer para seguir.
- **El tablero sano está en calma** (v10.84.64): lo de rutina va **teñido** (fondo al 8%, contorno y letra en su tinta:
  «Empaque» de cada máquina, «A Salidas»); el relleno de color queda para las alarmas («N vencidas», «urgente»). Un estado
  no se dice con opacidad (la máquina fuera de servicio al 70% dejaba su nombre a 1.8:1): se dice con su llave, su borde y su
  texto, en su tinta. Los avisos de toda la app llevan su color en tinta (`tintaAA(…, 4.6)`: el verde de éxito daba
  3.05:1). Un número que nadie explica se dice con palabra («3 órdenes», no un círculo negro). **Cuando no caben, los botones
  bajan a su renglón y el folio no se encoge**: con «▶ Activar» sin partirse, el botón tapaba el «#P-0593». En pantalla
  táctil (`pointer: coarse`), los botones chicos del tablero miden 40 px; con mouse, 28.
- **En una ficha, el nombre primero y completo** (v10.84.57): el cliente va solo en su línea (hasta tres, a 12 px) y lo que
  lo acompaña (la asa, el folio, el reloj) en la segunda; un dato que el marco ya dice (el reloj de la activa) no se repite
  adentro. Se mide a 1366 con foto en la ficha: la miniatura le quita ~46 px al nombre.
- **En el tablero, lo de todos los días se deshace y lo que detiene se pregunta** (v10.84.56): «Empaque» y «A Listas» (antes
  ⟳, el ícono de recargar) ESPERAN `DESHACER_MS` (6.5 s, lo mismo que vive el «Deshacer» de asignar) con «Pasa a Empaque en
  N s · Deshacer» en el lugar de sus botones, y sólo entonces llaman a App por el camino de siempre: deshacer no escribe nada y
  los manejadores de App (que cargan los arreglos contra minutos de máquina corruptos) no cambian. Si en la espera la orden
  cambió de etapa o de máquina, no se hace y se dice; al salir del tablero, lo pendiente se hace. «Activar» detiene lo que
  corre (cierra su reloj): eso se pregunta, con las dos órdenes y cuánto lleva; con la máquina libre no se pregunta. La
  confirmación sigue al daño, no a la costumbre (lo preguntó el revisor del tablero). El detalle de la orden pregunta porque
  ahí no hay dónde dejar el «Deshacer»: se cierra al actuar. **El mismo paso tiene la misma red por cualquier camino** (v10.84.60): soltar en Empaque
  espera con «Deshacer» igual que el botón; un aviso de éxito dice qué orden se movió y a dónde.
- **Cambiar de etapa pregunta antes** (v10.84.55): en el detalle, un botón que mueve la orden de etapa (avanzar, «Cliente
  Aprobó», «Cargar a Stock») pregunta a cuál pasa, de cuál sale, qué máquina deja y a quién le avisa: lo que hace la función de
  App (`doAdv`, `approveProof`, `loadStock`), no lo que el botón parece. La pregunta abre con el escudo (el segundo clic de un
  doble clic no la confirma), al cancelarla el foco regresa al botón, y si la orden cambia de etapa con ella abierta se cierra
  sola y lo dice (confirmarla la movería desde la etapa nueva, de Salidas de regreso a Empaque). Salidas y entregar ya
  preguntaban en App: no se pregunta dos veces. Los botones del tablero, en su critique.
- **Actuar no cierra el detalle** (v10.84.53): una acción que abre su propia ventana (folio, cancelar, regresar, espera…) la
  abre ENCIMA del detalle (las ventanas van en zIndex 999-1000 y cierran con Esc por la pila; el detalle es 998), y al
  cerrarla se regresa a la orden, actualizada y con el foco donde estaba. Sólo cierra lo que lleva a otra pantalla (editar,
  duplicar, imprimir) o se hace de una vez (avanzar, validar, recordar). Una ventana nueva va encima de 998 y usa
  `useEscClose`; si no, Esc cerraría también el detalle de abajo.
- **Lo que una pantalla sabe de una orden, lo sabe la otra** (v10.84.50): las alertas y banderas de una orden salen de UNA
  definición (`alertasDeLaOrden`, `banderasDeLaOrden`) que usan la ficha del tablero y el detalle; «a quién le toca», de
  `orderResponsible`. Una regla escrita dos veces se separa: el detalle no decía RETRASO ni «Reimprimir» y la ficha sí.
- **La pastilla (`Badge`) pinta el texto en su tinta** (v10.84.50): ya no sólo lo dice este documento, lo hace el componente
  (`BADGE_TONES` con `dnInk`/`wnInk`/`okInk`, y `tintaAA(color)` cuando recibe `color`).
- **Un error no es un vacío** (v10.84.49): una lista que no cargó dice «No se pudo cargar…» con «Reintentar»; nunca «Sin
  registros».
- **Ctrl+Enter en el detalle de la orden** (v10.84.48): hace la acción del rol (la rellena) o, si no hay, «Imprimir». No con el
  foco en un campo, ni con un menú abierto (si no, apretaría la opción enfocada), y si la orden cambia con el diálogo abierto
  el atajo se mueve a la nueva acción principal (un solo botón lo declara).
- **Un recuadro por idea** (v10.84.45): lo que se va a crear (qué, por cuánto, a quién y cómo va el folio) es UN resumen, no
  una nota y una vista previa seguidas. Una nota que sólo repite lo que otro recuadro ya enmarca se mete en él.
- **Una palabra por cosa** (v10.84.44): en «Folio por OC», «producto» (lo que la OC agrega), nunca «orden» para lo mismo.
- **El botón apagado dice por qué**: en el pie, junto al botón, una línea en `C.wnInk` con lo que falta («Remisión 1 no tiene órdenes», «Falta confirmar cómo se asigna el folio»). El botón apagado va en `bt(C.sf, C.t2)`, que se lee; blanco sobre gris daba 1.4:1.
