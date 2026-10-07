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
| arreglada | fallaba y ahora pasa | |
| nueva | no estaba en la base y pasa | |

Sale con código 1 si algo falla. **El candado de git** (`.githooks/pre-push`) corre `npm run build` y `probar --base` antes de
cada subida y no deja subir si algo falla (un push de puros documentos pasa directo). Se activa una vez por copia del repo:
`git config core.hooksPath .githooks`. Nunca se salta con `--no-verify`.

## Qué hay

| tanda | banco (`tests/banco/`) | pruebas (`tests/romper/`) | cubre |
|---|---|---|---|
| partes | `gen-partes.mjs` | `partes.mjs` (50) | Facturar por partes, Facturar siguiente parte, Cancelar la parte |
| folio | `gen-folio.mjs` | `folio.mjs` (44) | Asignar folio y entregar, Folio anticipado, el selector de pagos |
| oc | `gen-oc.mjs` | `oc.mjs` (112) | Folio por OC: cuánto y a quién, la pregunta antes de crear (con su lista alineada), el emisor que no contesta (con «Reintentar» en los dos modos), dividir sin arrastrar («Mover a», «Una factura por orden», soltar en «Agregar»), lo capturado que no se pierde (eliminar con pagos pregunta; el doble clic en la papelera borra uno), un solo «seleccionado», el documento con el problema marcado, contraste medido en la página y en la pregunta, una sola palabra («producto»), «Todo en una factura», Ctrl+Enter, no crear mientras llegan el saldo y el traslado, y las vueltas por donde no se diseñó (doble clic, Esc, folios repetidos, la base que rechaza o que nunca contesta…). Variantes: `emisor=off|falla|falla1|falla2|colgado`, `lento=1|colgado`, `cliente=corona|cuadra|saldo`, `pre=1`, `traslado=no|falla`, `ordenes=N`, `facturadas=N`, `falla=1`; `abrir=1` y `split=1` para el detector |
| detalle | `gen-detalle.mjs` | `detalle.mjs` (112) | El detalle de la orden (DetailModal): borrar el archivo mirando lo que contesta la base, Tab que no se sale, el pie al ras (al abrir y al fondo) y en dos renglones a 1366 y 1920, una sola acción rellena por rol, lo raro en «⋯ Más» (con Esc, que regresa el foco, y clic fuera; «Poner en espera: no ha pedido factura» ahí), el encabezado de quién/qué/cuánto/para cuándo con miniatura y sin renglones vacíos, la guía de qué sigue aunque el rol no tenga botón, lo que un vendedor ajeno y producción no deben ver (sin rótulos vacíos), Ctrl+Enter (la acción del rol o «Imprimir»; no escribiendo, ni con «Más» abierto, ni doble, ni sobre una acción apagada; se mueve si la orden cambia con el detalle abierto), contraste en 14 etapas, tablet y nombres larguísimos; el «#HEX» de un Pantone que no guarda a medio teclear (aquí y en la forma de la orden), el botón trabado que se ve trabado con «Editar» de principal, el historial que no carga y lo dice, «Más» con flechas, y lo escrito que sobrevive a una actualización. Variantes: `caso=factura|partes|resto|espera|maquila|cancelada|borrador|salidas|remision|sinempaque|archivo`, `rol=…`, `etapa=…`, `cliente=…`, `login=…`, `sinentrega=1`, `falla=storage|tabla|alias|pantone|historial|historial1`, `caso=pantone`, `pantoneinput=1` (la forma de la orden); `window.__cambiar({…})` cambia la orden con el detalle abierto; `flujos=1` pinta los botones de flujo de todas las etapas y roles, como en el tablero (para comparar versiones) |
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

## Minas del banco (no de la app)

- La primera carga hace que vite prepare sus dependencias: `probar.mjs` las declara (`optimizeDeps.include`) y calienta el
  banco en un navegador antes de soltar la tanda. Sin eso, la primera prueba caía por «504 Outdated Optimize Dep».
- Una función de módulo nueva que el generador no extrae hace que todo truene al pintar («X is not defined»): se agrega al
  generador.
- Lo que en la app atrapa el padre (el split: App atrapa el error y saca un aviso) el banco lo imita; si no, sale un
  «Uncaught (in promise)» que no es de la app.
