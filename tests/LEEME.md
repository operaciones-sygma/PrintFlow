# Pruebas «tratando de romperlo» de PrintFlow

Regla (Marcelo, 5-oct-2026): todo lo que se implementa se prueba como usuario **tratando de romperlo**, con pruebas que
afirman lo que DEBERÍA pasar; una prueba que falla es un bug que se arregla, no se anota; **cada bug deja su prueba aquí**; y
antes de cada subida corren **todas**. La regla completa vive en el CLAUDE.md global (`C:\Users\padil\.claude\CLAUDE.md`).

## Cómo se corre

```
npm run probar                 # todas las tandas, en paralelo (~2 min)
node scripts/probar.mjs --solo folio
node scripts/probar.mjs --base # si TODO pasa, guarda estos resultados como la base de la próxima comparación
```

Cada prueba se compara con la última corrida en verde (`.git/probar-base.json`, local de cada copia, fuera de git):

| clase | qué significa | qué se hace |
|---|---|---|
| **REGRESIÓN** | pasaba en la base y ahora falla | se arregla antes de subir |
| pendiente | falla, y no pasaba o es nueva | es un bug encontrado: se arregla antes de subir |
| **INESTABLE** | falló y a la segunda pasó (abajo) | se sube, se revisa en el mismo trabajo y se marca: la siguiente subida no pasa sin eso |
| arreglada | fallaba y ahora pasa | |
| nueva | no estaba en la base y pasa | |

Sale con código 1 si algo falla. **El candado de git** (`.githooks/pre-push`) revisa primero que no haya inestables sin revisar, luego
corre `npm run build` y `probar --base`, y no deja subir si algo falla (un push de puros documentos pasa directo). Se activa una vez por
copia del repo: `git config core.hooksPath .githooks`. Nunca se salta con `--no-verify`.

## La segunda oportunidad y sus candados (8-oct-2026)

La misma de CobranzaFlow (7-oct), el Cotizador y Almacén. Marcelo: *«sí es una mejora, aplica la misma metodología para todos los
proyectos»*. Con 600 pruebas, aunque cada una falle por mala suerte una vez en mil (el equipo cargado, la red), la mitad de las subidas se
frenaría por ruido; y aun así, lo que pasa a la segunda no siempre es suerte.

- **Lo que falla se repite UNA vez, y sólo eso**: en las tandas que aceptan `SOLO`, sólo sus casos que fallaron (por el principio de su
  id, «tab-105»); las que no (`ctp`, `permisos`, `firmas`, `carga`, `archivos`, `archivos-pantalla`), completas: son cortas.
- **Lo que vuelve a fallar frena**, con el detalle de las dos veces. Un bug de verdad falla las dos.
- **Lo que pasa a la segunda sale INESTABLE**: cuenta como que pasa y queda anotado en `scripts/inestables.mjs`
  (`.git/probar-inestables.json`, la misma para todas las copias de trabajo). Se revisa en el mismo trabajo (¿la prueba esperaba un
  tiempo fijo? ¿dos sesiones se pisan? ¿el equipo, la red, Supabase?) y se marca. **La siguiente subida no pasa con una sin revisar.**
- **Candados**: más de 3 a la vez frenan (no es suerte); **sin segunda oportunidad** —ni se repiten— las tandas de dinero (`folio`,
  `oc`, `partes`: folian y facturan) y toda prueba de doble acción (doble clic, toque o Enter, por su nombre): ahí fallar a veces ES el
  bug. La misma otra vez en 14 días frena. Una bitácora que no se puede leer frena (no cuenta como vacía).

```
node scripts/inestables.mjs                                       las pendientes y las de los últimos 14 días
node scripts/inestables.mjs revisada tab-105 "era la prueba: …"   la marca (la nota se pide: qué era y qué se hizo)
PROBAR_FINGIR_FALLA=pla-01-…,inv-01 node scripts/probar.mjs --solo planta,folio   finge fallas (PROBAR_FINGIR_SIEMPRE=1: las dos veces)
```

`scripts/reintento.mjs`, `inestables.mjs` y su prueba `probar-reintento.mjs` (la tanda `reintento`) son **iguales en las cuatro apps**: la
prueba compara la huella de los dos módulos (`rei-14`); si se cambian, se copian a los cuatro. `PROBAR_INESTABLES=<archivo>` cambia la
bitácora (para probar sin tocar la de verdad).

## Qué hay

| tanda | banco (`tests/banco/`) | pruebas (`tests/romper/`) | cubre |
|---|---|---|---|
| partes | `gen-partes.mjs` | `partes.mjs` (65) | Facturar por partes, Facturar siguiente parte, Cancelar la parte; y ligar una factura por adelantado con el centavo de su CFDI (`?hakuna=`, v10.84.66) |
| folio | `gen-folio.mjs` | `folio.mjs` (93) | Asignar folio y entregar, Folio anticipado, el selector de pagos. Desde v10.84.70 (critique independiente, 23/40): las facturas hechas por adelantado al abrir (`anticipo=mismo\|otro\|ambos\|falla\|falla1\|lenta`, `adelantada=1`), los errores dentro del diálogo, Enter-Enter, el monto, las dos columnas, el color. Acepta `SOLO=` (sabotajes) |
| oc | `gen-oc.mjs` | `oc.mjs` (112) | Folio por OC: cuánto y a quién, la pregunta antes de crear (con su lista alineada), el emisor que no contesta (con «Reintentar» en los dos modos), dividir sin arrastrar («Mover a», «Una factura por orden», soltar en «Agregar»), lo capturado que no se pierde (eliminar con pagos pregunta; el doble clic en la papelera borra uno), un solo «seleccionado», el documento con el problema marcado, contraste medido en la página y en la pregunta, una sola palabra («producto»), «Todo en una factura», Ctrl+Enter, no crear mientras llegan el saldo y el traslado, y las vueltas por donde no se diseñó (doble clic, Esc, folios repetidos, la base que rechaza o que nunca contesta…). Variantes: `emisor=off|falla|falla1|falla2|colgado`, `lento=1|colgado`, `cliente=corona|cuadra|saldo`, `pre=1`, `traslado=no|falla`, `ordenes=N`, `facturadas=N`, `falla=1`; `abrir=1` y `split=1` para el detector |
| detalle | `gen-detalle.mjs` | `detalle.mjs` (183) | El detalle de la orden (DetailModal): borrar el archivo mirando lo que contesta la base, Tab que no se sale, el pie al ras (al abrir y al fondo) y en dos renglones a 1366 y 1920, una sola acción rellena por rol, lo raro en «⋯ Más» (con Esc, que regresa el foco, y clic fuera; «Poner en espera: no ha pedido factura» ahí), el encabezado de quién/qué/cuánto/para cuándo con miniatura y sin renglones vacíos, la guía de qué sigue aunque el rol no tenga botón, lo que un vendedor ajeno y producción no deben ver (sin rótulos vacíos), Ctrl+Enter (la acción del rol o «Imprimir»; no escribiendo, ni con «Más» abierto, ni doble, ni sobre una acción apagada; se mueve si la orden cambia con el detalle abierto), contraste en 14 etapas, tablet y nombres larguísimos; el «#HEX» de un Pantone que no guarda a medio teclear (aquí y en la forma de la orden), el botón trabado que se ve trabado con «Editar» de principal, el historial que no carga y lo dice, «Más» con flechas, y lo escrito que sobrevive a una actualización; arriba, lo que sabe la ficha (RETRASO, reimprimir, lo que le falta a la maquila, la máquina con su reloj, a quién le toca), sin comerse el diálogo; y en «Más», lo mismo que ofrece la ficha (espera, recordar, avisar que falta el archivo, merma, duplicar, cambiar OC, cancelar, borrar) con sus palabras, y la nota rápida; y actuar sin perder el detalle (la ventana de la acción encima, Esc que cierra sólo esa, el foco que regresa, también con ventanas sin rol ni foco, como seis de la app); el doble clic que no llega al tablero (`#tablero` anota los clics que le llegan), cerrar con algo escrito que pregunta, la nota que la base rechaza y regresa, y alarmas que dicen la verdad (en espera, reimprimir sólo antes de entregar, sin precio); cambiar de etapa que pregunta antes (a cuál, de cuál, qué máquina deja, a quién avisa; sin preguntar dos veces lo que ya pregunta App), con el foco en la respuesta segura, y la pregunta que se cierra sola si otra persona mueve la orden. `SOLO=<regex>` corre sólo los casos que coinciden (para los sabotajes). Variantes: `caso=factura|partes|resto|espera|maquila|cancelada|borrador|salidas|remision|sinempaque|archivo`, `rol=…`, `etapa=…`, `cliente=…`, `login=…`, `sinentrega=1`, `falla=storage|tabla|alias|pantone|historial|historial1`, `caso=pantone`, `pantoneinput=1` (la forma de la orden), `caso=alertas|todas` (las alertas de la ficha: retrasada, urgente, reimprimir, en una prensa; todas a la vez), `agente=Genaro` (la maquila de un vendedor con usuario), `caso=web` (un pedido web sin archivo), `ventana=sinrol|sinfoco|nunca` (cómo se comporta la ventana que abre la app para una acción), `falla=nota` (la base rechaza la nota rápida y la recarga la quita), `caso=empaque` (en Empaque, en la máquina que también se llama «Empaque»); `window.__cambiar({…})` cambia la orden con el detalle abierto; `flujos=1` pinta los botones de flujo de todas las etapas y roles, como en el tablero (para comparar versiones). En «Más», para Karla, «Ya está lista: pasar a Salidas» con dónde sigue y la pregunta encima del detalle, y para nadie más (det-160 a 162, v10.84.67) |
| tablero | `gen-tablero.mjs` (sobre `extraer.mjs`) | `tablero.mjs` (130) | El tablero (v10.84.56): el `Kanban` de Producción, el de Germán (`PreprensaBoard`) y las fichas (`OCard`), extraídos con TODO lo que usan por `extraer.mjs` (con `@babel/parser`: junta las declaraciones de módulo de las que depende cada raíz, sin lista a mano; la base y Storage, simulados). Lo de siempre: lo que corre en cada máquina medido por posición en pantalla, arrastrar y asignar sin arrastrar, abrir la orden, mantenimiento con trabajo montado, sin órdenes, buscar resalta sin filtrar, sin barra horizontal a 1366 y 1920, y el número de la orden en el tablero de Germán. Mover con red: «Empaque» y «A Listas» esperan con «Deshacer» (no escriben al instante; deshacer no escribe nada; si la orden cambia o la cancelan en la espera no se hace y se dice; al salir del tablero se hace; dos a la vez; con el teclado), «Activar» pregunta si detiene lo que corre (y no si la máquina está libre), y el doble clic en «Empaque» ya no manda también a la que sube (el banco sube la fila como `moveOrderInQueue`). Se lee qué corre (v10.84.57): el cliente completo en cada ficha a 1366 y 1920 (las órdenes del banco traen foto y hay nombres reales de 37 y 39 letras), un solo reloj en la activa, Empaque con el suyo, un nombre larguísimo o sin espacios que no se sale, la columna derecha a 260 y 330 px, la tableta sin barra horizontal. Lo atrasado y lo detenido (v10.84.58): «N vencidas» abre cuáles y dónde (Tab entra, Esc cierra y regresa al chip, ir a una la deja a la vista y resaltada aunque esté en una sección plegada), RETRASO y las demás alertas del detalle en Listas, la activa, la fila y Empaque (sin salirse de la ficha), «desde ayer 05:48» en lo que cruzó la noche (lo de hoy sigue en horas) y la búsqueda dice dónde. Merma y Maquila (v10.84.59, las ventanas REALES): de qué orden son, sólo enteros de 0 en adelante, «Enviar» apagado sin proveedor, un doble clic guarda o manda una vez, la base que rechaza deja lo escrito (`falla=merma|maquila`), diálogos de verdad; y el contraste de «Activar», «ACTIVA», «Empaque», «Fuera de servicio» y las pastillas. Soltar en Empaque con la misma espera que el botón (v10.84.60), y en Salidas esperar la fecha de entrega no es estar estancada (v10.84.61). La planta de un vistazo (v10.84.62): sin bajar, a 1366, se ve qué corre en cada máquina (también con 18 en Listas), la franja «Así va la planta» lleva a la máquina (abre Digital plegada; con el teclado le pasa el foco), sigue al tiempo real, acepta soltar en una libre y en una ocupada (también arrastrando desde una máquina de abajo: `alaFranja` imita el «dragover» continuo de Chrome, que Playwright sólo manda al mover el ratón), en su propia máquina no hace nada, en una fuera de servicio no asigna y lo dice (y ésa no sale entre las libres), no corta nombres ni números a 1366, 1920 y 768, y no sale con el tablero vacío; las libres miden lo suyo; Listas se pliega a 4 con más de 5 («Ver las N», «Ver menos» con el foco en el mismo botón, lo abierto se recuerda al volver al tablero) y se abre sola al buscar o al ir a una vencida de las de abajo. Las acciones de Empaque (v10.84.63): «A Salidas» con palabra dentro de la ficha (sin íconos sueltos, en un renglón a 1366 y 1920, que se lee, un doble clic manda una vez y no abre el detalle) y «⋯» con «Enviar a maquila» y «Registrar merma» en la misma ficha (Esc lo cierra y regresa el foco, el clic afuera lo cierra, uno abierto a la vez, se va con la orden si otra estación la mueve, todo con el teclado); la ficha activa no cambia; `abrirDe` abre el «⋯» si la acción vive ahí. El tablero sano en calma (v10.84.64): ningún botón de rutina relleno, «Disponible», la llave, la palomita y la máquina fuera de servicio (con y sin trabajo) que se leen, «3 órdenes» y «1 orden» con palabra, los avisos de los cuatro tipos con AA (el banco pinta el `Toast` real con `aviso=…`), los botones de la fila en un renglón a 1366, 1600 y 1920 contados por renglones de texto (no por alto), sin tapar el folio y sin que la fila los recorte, y en tableta táctil (`caso(…, viewport, { hasTouch, isMobile })`) los botones chicos de 40 px. Variantes: `vista=produccion|german|fichas`, `rol=…`, `caso=normal|vacio|lleno|mantenimiento`, `mant=off_gto` (otra máquina en mantenimiento), `aviso=success|error|warning|info` (el aviso de App), `lectura=cargando|fallo` (el tablero sin una lectura buena: «Leyendo el tablero…» o «No se pudo leer el tablero», nunca «vacío»; v10.84.65), `buscar=P-…`, `deshacer_ms=…` (acorta la espera para probar); `window.__cambiar(id, {…})`, `window.__vista(v)`, `window.__ordenes()`. `SOLO=<regex>` corre un caso suelto (sabotajes). |
| anticipos | (sin banco) | `tests/romper/anticipos.mjs` (9) | qué factura por adelantado se pregunta antes de asignar folio (v10.84.68, el caso de Karla con F-135 de Castores): extrae de `src/App.jsx` las funciones vivas `anticiposQuePreguntar` y `facturaDelMismoImporte`. Con una del mismo importe y tipo no se pregunta por las de otro (la base ofrece «Sí, ligar»); sin ella, sí (el anticipo de P-0544); una remisión no calla la pregunta de una factura; sin tipo, sin candidatas o con basura, no truena. La pantalla de punta a punta: `tests/recorrido/ligar-anticipo.mjs`. |
| cliente | `gen-cliente.mjs` | `cliente.mjs` (24) | «¿ya existe este cliente?» al capturar una orden o una OC (v10.84.69, con CobranzaFlow v3.7.999m): extrae de `src/App.jsx` la pregunta (`ClientConfirmModal`), su montaje en App, `resolverClienteNuevo` (la lógica de las dos puertas) y `mensajeDeCliente`, con la base simulada y una forma registrada en escStack como la de verdad. Lo seguro («Ya existe: elígelo», con su porqué, sin «Crear como nuevo»), lo dado de baja, lo que sólo se parece, la base de antes (sin porqué), el nombre idéntico, «Crear cliente nuevo» con el RFC y el contacto capturados, el RFC que también se busca, lo que la base contesta al frenarlo y sin conexión, la OC sin RFC; Escape (que no cierra la forma de atrás), el foco, Tab, Enter, el clic fuera, doble clic, muchos parecidos, 1366, 1920 y el celular. Variantes: `resolve=exacto|fuerte|parecido|mixto|baja|nada|viejo|muchos|falla`, `crear=ok|frena|baja|falla`, `oc=1`, `nombre=`, `rfc=`, `correo=`, `largo=1`. Sin `resolverClienteNuevo` en el App.jsx (el código anterior) el banco usa una copia de lo que hacía la forma en línea, para la corrida doble. |
| reintento | (sin banco) | `scripts/probar-reintento.mjs` (21) | la segunda oportunidad y sus candados (`scripts/reintento.mjs` e `inestables.mjs`, iguales en las cuatro apps; 8-oct): qué se repite, qué sale INESTABLE, más de 3 de golpe, doble acción y dinero sin segunda, la misma otra vez en 14 días, la bitácora (pendientes, revisar con nota, «--subida», ilegible frena) y la huella común. |
| planta | `gen-planta.mjs` (sobre `extraer.mjs`) | `planta.mjs` (39) | «En la planta» de Karla (v10.84.67), lo que todavía no llega a Salidas y pasar ella lo que ya está listo (`EnLaPlanta`), el aviso de la OC que no se puede foliar entera (`FaltanParaFoliar`) y la pregunta (`preguntaJalar` sobre la `ConfirmModal` real). **Qué enseña:** primero las OC que esperan a alguna orden («3 de 5 en Salidas»), luego Empaque y máquinas en su orden (Empaque de la más vieja, lo que corre, la fila); dónde va cada una («GTO 1 Color · corriendo», «3ª en la fila») y desde cuándo; botón sólo en Empaque o máquina (Listas, CTP, diseño y maquila plegados y sin botón); nada de lo cancelado, entregado o ya en Salidas. **La pregunta:** dice de qué máquina sale y cuál empieza (sin prometer a otra que también sale), la espera y la fila; Esc no mueve y regresa el foco; un doble clic pasa una vez y abre una pregunta; se vence si otra persona la mueve. **Lo demás:** buscar, sin nada y vacío; 1366, 1920, tableta y celular sin barra horizontal; todo el texto a 4.5; con el teclado de principio a fin (el foco va al siguiente «Pasar…», o a «Asignar folio» de la OC completa); datos a medias (sin máquina, sin cliente). **Variantes:** `vista=planta|oc`, `oc=OC-0657|OC-0660|OC-0665|OC-LISTA`, `caso=normal|vacio`, `buscar=…`, `falla=1`; `window.__cambiar(id, {…})`. Lo que hace App al confirmar va simulado: lo real lo prueba `tests/recorrido/karla-planta.mjs`. |
| carga | (sin banco) | `carga.mjs` (9) | que las consultas grandes lleguen COMPLETAS aunque esta Supabase conteste máximo 1,000 renglones (también con `.limit(5000)`): recorta el `todasLasFilas` vivo de `src/App.jsx` y lo corre contra una base simulada con tope (9,053 renglones, justo 1,000, vacía, un tope menor, una página que falla), y revisa que las órdenes, sus bitácoras, las OCs, las partes y el plan matriz lo usen y que la recarga traiga sólo lo activo (v10.84.61) |
| archivos | (sin banco) | `archivos.mjs` (12) | la lista de «Archivos» que da la base (`pf_archivos_del_bucket`): completa, sólo para admin/preprensa/german, y que nada que use una orden —o subido hace menos de un día— salga como huérfano (recalculados aparte, uno por uno). `--ensayar <migración>` |
| archivos-pantalla | `gen-archivos.mjs` | `archivos-pantalla.mjs` (12) | la pantalla «Archivos»: calcula el espacio, «Error» no es «0 MB», y los botones que BORRAN (limpiar huérfanos, el Top 5, la limpieza de +30 días) con Storage y la tabla de órdenes simulados: no sueltan una orden si Storage falla, no cuentan lo que no se borró, no borran lo de una orden no cargada |
| firmas | (sin banco) | `firmas.mjs` (10) | cómo se firman las fotos de las órdenes: recorta el código VIVO de `src/App.jsx` (de `pathDeOrderFile` a `useSignedFile`) y lo corre en Node contra un Storage simulado que cuenta peticiones: por lotes de 100, una sola vez por foto, que «Todas» quepa en el caché, y lo de antes (la que no existe y la red caída regresan su URL; la descarga va sola) |
| permisos | (sin banco) | `permisos.mjs` (13) | quién puede escribir con `register_print`, `log_wakeup_ack` y `save_app_config` (el `visor` no; los precios, sólo admin) y que el autor salga de la sesión. Cada caso llama la RPC como una persona real dentro de una transacción que se deshace; `--ensayar <migración>` prueba una migración sin aplicarla |
| ctp | (sin banco) | `ctp.mjs` (16) | que el contador de placas del CTP, y lo que enseña la pantalla CTP de SygmaAlmacen, no vuelvan a inflarse: el código lee las vistas que deduplican, y en la base sólo ellas leen el crudo y lo demás cuadra contra ellas (necesita `SUPABASE_ACCESS_TOKEN`; `--sabotajes` prueba que cada revisión se pone en rojo) |

**Cómo funciona un banco.** PrintFlow no tiene (todavía) cuenta de pruebas, así que el generador EXTRAE de `src/App.jsx` los
componentes de la pantalla con sus dependencias reales (tokens, estilos, escStack, `atraparTab`, ConfirmModal…), les pone una
base simulada (`db` con variantes por URL: emisor apagado, orden histórica, Corona, Cuadra, la base que rechaza…) y una página
mínima con botones para abrirlos. `scripts/probar.mjs` lo sirve con vite en su propio puerto y lo recorre con Playwright
(Chrome instalado si falta el navegador de Playwright). Lo que NO cubre: lo que hace App al confirmar (los avisos, la RPC real)
y los componentes simulados (en folio, BillToSection y StageLbl).

## Agregar pruebas

- Una prueba nueva va en la tanda de su pantalla con un id que empieza la línea (`sig-22`, `inv-33`…): `probar.mjs` clasifica
  por ese id.
- El veredicto se decide **antes** de mirar qué hace el código, por lo que significa para la persona (la «medición
  autoconfirmante» del 23-sep). La primera corrida va contra lo que hay; lo que falla es la lista de bugs.
- Para comprobar que una tanda detecta algo, se corre contra el código anterior: `git show HEAD:src/App.jsx > /tmp/App.jsx`,
  el generador sobre ese archivo, y la tanda en otro puerto.
- Pantalla nueva: un generador nuevo (copiar uno, cambiar qué se extrae, el `db` simulado y la página) y una tanda nueva;
  se agrega a `TANDAS` en `scripts/probar.mjs`.

## El recorrido de toda la app (`npm run recorrido`)

Las tandas cubren pantallas sueltas; el recorrido abre **toda** la app como cada rol, en un navegador, contra la base real,
y reporta lo que truena, lo lento y lo que intenta escribir con sólo abrir una vista. No corre en el candado (~4 min): se
corre a mano después de un cambio grande y después de subir, contra la app publicada.

```
npm run build && npm run recorrido                          # la app compilada (dist/) en 127.0.0.1:4273
node tests/recorrido/recorrido.mjs https://produccion.sygma.mx # la app publicada
node tests/recorrido/recorrido.mjs "" karla,german            # sólo esos roles
```

- Entra con la cuenta `claude-pruebas` (rol `visor`). La contraseña vive sólo en
  `C:\Users\padil\claude-navegador\credencial-printflow.json` (o en `PF_CREDENCIAL`) y nunca se imprime. Para compilar en
  local hace falta `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (la llave pública; está fuera de git).
- **Sólo lee.** El navegador deja pasar GET, entrar, firmar y listar archivos, y las RPC de la lista `LECTURAS` (todas
  STABLE/IMMUTABLE, comprobado en `pg_proc`); todo lo demás se contesta con 418 y sale en el reporte como «ESCRIBE al abrir».
  Una RPC nueva de lectura se agrega a `LECTURAS` sólo si es STABLE/IMMUTABLE. La base, además, ve un `visor`. El cierre de
  sesión se contesta sin llegar al servidor (un logout real es global).
- El rol de cada pasada se cambia **en el navegador** (la respuesta de `get_user_session`); el menú es el de ese rol.
- El reporte queda en `tests/salida/recorrido/reporte.txt` (y `.json`), con una captura por paso. Sale con 1 si algo truena.
  Lo «lento» (más de 5 s) dice qué peticiones lanzó el paso y cuáles se quedaron colgadas; no cambia la salida.
- Lo que la app escribe a propósito al entrar (la limpieza de archivos del admin, sus avisos de fondo, el «Buenos días»)
  está en `ESCRITURA_CONOCIDA` con su porqué. Una vista nueva del menú que no esté en `VISTAS` sale como «sin recorrer».

### La carga completa no se corta (`tests/recorrido/carga-completa.mjs`)

Desde v10.84.61. Con la app REAL (compilada en `127.0.0.1:4276`, o la publicada) contra la base real y las escrituras cortadas:
entra como admin, aprieta «Cargar Archivo Completo», provoca una recarga y mira que una orden activa con movimientos recientes
(por defecto P-0540) no salga «estancada» por una bitácora cortada. `DEPURAR=1` imprime cada respuesta con su «Content-Range»:
ahí se ve si una consulta llegó cortada en 1,000. Contra producción en v10.84.60 dio MAL; se corre a mano.

### Cuando la base rechaza lo que pide el tablero (`tests/recorrido/tablero-errores.mjs`)

Desde v10.84.59. Con la app REAL (compilada en `127.0.0.1:4275`, o la publicada si se le da la dirección) contra la base real
y las escrituras cortadas: aprieta «Empaque» en la primera orden que esté corriendo, no lo deshace, deja que la base «rechace» y
mira el aviso (qué orden, por qué en palabras, sin nombres internos) y que la orden ya esté en su máquina cuando sale. El banco
no lo puede probar: el aviso y el regreso de la orden los hace App. Se corre a mano antes de subir algo del tablero y después,
contra producción.

### Cuando no se puede leer de la base (`tests/recorrido/lectura-falla.mjs`)

Desde v10.84.65. Con la app REAL (compilada en `127.0.0.1:4277`, o la publicada si se le da la dirección) contra la base real,
sin escribir nada; las fallas de lectura se SIMULAN sólo en ese navegador (503 en `orders` o en `order_timeline`, o la primera
lectura que tarda 7 s). Cuatro escenarios, cada uno en su propia sesión (`SOLO=AB` corre algunos):
- **A**: mientras se hace la primera lectura, el Dashboard dice «Leyendo de la base…» y el tablero no dice «vacío», «libres» ni
  «trabajando»; ya leído, con la lectura caída, lo que se veía se queda, el aviso dice de qué hora es, el punto de conexión no
  dice «En tiempo real», y «Reintentar» (ya sin la falla) quita el aviso;
- **B**: la PRIMERA lectura falla: el tablero dice que no se pudo leer y «Reintentar» lo lee;
- **C**: falla sólo la bitácora: tampoco se presenta a medias;
- **D**: falla «Cargar Archivo Completo»: «Pendientes» y el tablero se quedan, lo dice, y el segundo intento lo carga.

Ojo: el cliente de Supabase reintenta solo un 503 tres veces (1, 2 y 4 s), así que una falla se ve a los ~7 s; una prueba que
quita la falla antes, ve una carga buena. La bienvenida del rol se cierra con Esc y el «Despertador» se espera hasta 8 s, también
al navegar. Contra v10.84.64 (producción) fallaban las 12 comprobaciones: A (6), B (2), C (1: sin aviso) y D (3: «Pendientes»
de 16 a 0, el tablero de 14 fichas a 0 y sin poder volver a pedir el archivo).

### Ligar la factura por adelantado del mismo importe (`tests/recorrido/ligar-anticipo.mjs`)

Desde v10.84.68; **desde v10.84.70 la ventana lee las facturas hechas por adelantado AL ABRIR** (la critique independiente del 8-oct).
Con la app REAL (compilada en `127.0.0.1:4279`, o la publicada), como Karla y sin escribir nada. Una orden de prueba (P-9585, Castores,
$7,440) existe sólo en ese navegador; `list_linkable_invoices_for_order`, el candado de `assign_invoice` y de `assign_invoice_cash` («emitida
por adelantado») y `link_invoice_to_order` (ligar) se contestan como la base. Escenarios (`SOLO=AB…`):
- **A**: con F-9135 del mismo importe (y F-9140 de otro), al abrir dice que F-9135 ya es la factura de este trabajo, la acción es «Ligar
  F-9135 y entregar», no se piden pagos, y al confirmar liga una vez sin intentar otro folio;
- **B**: con «No es de este trabajo» avisa que la base no deja otra por el mismo importe; con efectivo, el rechazo de la base sale DENTRO
  del diálogo y vuelve a ofrecer ligar, sin otra ventana encima;
- **C**: sólo con la de otro importe, lo dice al abrir con «Facturar por partes»; la vista previa dice que se queda sin ligar y al
  confirmar no sale otra pregunta;
- **E**: con efectivo y la lectura caída, lo dice al abrir, no deja continuar y no cobra;
- **F**: con efectivo y sin una del mismo importe, el efectivo sigue su camino (`assign_invoice_cash`);
- **G**: «Facturar por partes» desde el aviso cierra «Asignar folio» y abre la de partes con la orden.

Contra producción en v10.84.67 fallaban A1, A2, B1 y B2 (el flujo de entonces). En v10.84.70, 11 de 11 con el flujo nuevo.

### Karla pasa a Salidas lo que ya está listo (`tests/recorrido/karla-planta.mjs`)

Desde v10.84.67. Con la app REAL (compilada en `127.0.0.1:4278`, o la publicada) contra la base real, como Karla y sin escribir nada.
Una OC de prueba (OC-PRUEBA-KP: P-9901 en Salidas, P-9902 corriendo en la GTO y P-9903 en Empaque) existe sólo en ese navegador: se
agrega a lo que contesta la base al leer `orders` y `purchase_orders`. Toda escritura se corta y se anota; las de «pasar a Salidas»
se contestan como la base (y la OC cambia con ellas). Seis escenarios (`SOLO=AB` corre algunos):
- **A**: las dos pestañas de «Folios», buscar una que sigue en la planta (lo dice y lleva a ella), la OC a medias con sus botones, la
  pestaña que se recuerda, 1920 y 1366;
- **B**: pasar las dos de la OC escribe exactamente lo del «A Salidas» de Gerardo (la fila, la etapa con su candado), la bitácora dice
  que las pasó Karla, el aviso le llega a Gerardo y no a Karla misma, y dice que ya se puede foliar la OC;
- **C**: la base rechaza: el aviso nombra la que no pasó y la que no se intentó, y siguen en la planta;
- **D**: la OC dice cuáles faltan y dónde, sin «Asignar folio»;
- **E**: desde el detalle, en «Más», con la pregunta encima;
- **F**: otra persona la mueve con la pregunta abierta: se cierra sola, lo dice y no escribe.

Contra producción en v10.84.66 fallaba lo esperado (sin pestañas, y la OC callaba). Se corre a mano antes de subir algo de «Folios»,
de la OC o de `doAdv`, y después contra producción.

### Las ventanas de las acciones, encima del detalle (`tests/recorrido/ventanas-encima.mjs`)

Desde v10.84.53, actuar no cierra el detalle de la orden: la ventana de la acción se abre encima y, al cerrarla, se regresa a
la orden con el foco adentro. El banco del detalle simula esas ventanas; ésta prueba las REALES (asignar folio, regresar,
cancelar orden, poner en espera), con la misma cuenta y los mismos candados que el recorrido, sin confirmar nada. Encontró lo
que el banco no veía: dos ventanas que no toman el foco lo perdían al cerrarse (det-137 lo cuida ahora en el banco).

```
npm run build && node tests/recorrido/ventanas-encima.mjs              # la app compilada, en 127.0.0.1:4273
node tests/recorrido/ventanas-encima.mjs https://produccion.sygma.mx   # la app publicada
```

Usa órdenes reales (P-0589 en Salidas, P-0599 en CTP): si cambiaron de etapa el caso se salta; otras con `PF_VENTANAS`.

## Minas del banco (no de la app)

- La primera carga hace que vite prepare sus dependencias: `probar.mjs` las declara (`optimizeDeps.include`) y calienta el
  banco en un navegador antes de soltar la tanda. Sin eso, la primera prueba caía por «504 Outdated Optimize Dep».
- Una función de módulo nueva que el generador no extrae hace que todo truene al pintar («X is not defined»): se agrega al
  generador.
- Lo que en la app atrapa el padre (el split: App atrapa el error y saca un aviso) el banco lo imita; si no, sale un
  «Uncaught (in promise)» que no es de la app.
