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

## Minas del banco (no de la app)

- La primera carga hace que vite prepare sus dependencias: `probar.mjs` las declara (`optimizeDeps.include`) y calienta el
  banco en un navegador antes de soltar la tanda. Sin eso, la primera prueba caía por «504 Outdated Optimize Dep».
- Una función de módulo nueva que el generador no extrae hace que todo truene al pintar («X is not defined»): se agrega al
  generador.
- Lo que en la app atrapa el padre (el split: App atrapa el error y saca un aviso) el banco lo imita; si no, sale un
  «Uncaught (in promise)» que no es de la app.
