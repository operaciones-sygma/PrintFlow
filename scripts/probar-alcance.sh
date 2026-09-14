#!/usr/bin/env bash
# Caza la familia de defecto que ya mordio CUATRO veces: un identificador usado donde no existe.
# Compila perfecto y truena en runtime con "X is not defined", tumbando la vista entera detras
# del error boundary.
#
#   · anularCobro           — definido en HistorialView, usado en ExpandedDetail.
#                             Historial caido ~20 minutos en produccion.
#   · Warning               — usado sin importar en HistorialView (cazado antes de subir).
#   · documentosDelDeposito — definido en BankReconciliationView, usado en MovementsTable.
#                             Se lo encontro LUCERO el 7-sep-2026 al abrir Conciliados.
#   · <Input>               — usado sin importar en CommissionsAdminView (v3.7.581). ESTE SCRIPT
#                             LO DIJO VERDE. Ver abajo por que, y que se le hizo.
#
# No es una heuristica: es el analisis de alcance de ESLint, que entiende que una funcion declarada
# dentro de un componente NO existe dentro de otro. Se corre con npx y una config efimera a
# proposito: el proyecto no tiene ESLint y meterselo hoy traeria cientos de hallazgos de estilo.
#
# LAS TRES RAZONES POR LAS QUE MINTIO, Y COMO QUEDARON CERRADAS:
#   1. `no-undef` NO mira los nombres de componente JSX. `<Input>` sin importar le pasa de largo.
#      -> se le agrego la regla `componente-no-definido`, escrita aqui mismo, que resuelve el
#         nombre del elemento contra los alcances reales de ESLint.
#   2. Un `|| true` se tragaba los tronidos de ESLint: si el binario moria, el grep no encontraba
#      nada y el script cantaba verde.
#      -> ahora distingue "hallazgos" de "ESLint murio", y ANTES de revisar el codigo se prueba a
#         si mismo contra un archivo roto a proposito. Si esa prueba no sale roja, aborta.
#   3. Ese chequeo nuevo vivia dentro de un $(...), asi que su `exit` solo mataba la subshell y el
#      script seguia derechito hasta imprimir el ✅ — la MISMA fuga de alcance que este script
#      existe para cazar, adentro del script.
#      -> `corre` deja los hallazgos en un archivo y devuelve codigo; quien muere es el llamador.
#
# Uso:  bash scripts/probar-alcance.sh
set -uo pipefail
cd "$(dirname "$0")/.."

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP" src/__probe__' EXIT
CFG="$TMP/eslint.config.mjs"
cat > "$CFG" <<'EOF'
const G = {};
for (const g of ['window','document','console','navigator','localStorage','sessionStorage','fetch',
  'setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame',
  'cancelAnimationFrame','alert','confirm','prompt','Blob','File','FileReader','URL',
  'URLSearchParams','FormData','Image','Audio','crypto','IntersectionObserver','ResizeObserver',
  'MutationObserver','AbortController','TextEncoder','TextDecoder','structuredClone',
  'queueMicrotask','matchMedia','getComputedStyle','Event','CustomEvent','HTMLElement','Node',
  'WebSocket','performance','history','location','screen','atob','btoa','process','globalThis',
  'Intl','XMLHttpRequest','DOMException']) G[g] = 'readonly';

// no-undef NO mira los nombres de componente JSX. Esta regla si, resolviendolos contra los
// alcances reales de ESLint -- no con texto, que ya se probo y da ~66 falsos de cada 67.
const jsxScope = { rules: { 'componente-no-definido': { create(context) { return {
  JSXOpeningElement(node) {
    let n = node.name;
    while (n.type === 'JSXMemberExpression') n = n.object;   // <Foo.Bar> -> Foo
    if (n.type !== 'JSXIdentifier') return;                  // <a:b>
    const name = n.name;
    if (!/^[A-Z_$]/.test(name)) return;                      // minuscula = etiqueta HTML
    for (let s = context.sourceCode.getScope(node); s; s = s.upper)
      if (s.variables.some((v) => v.name === name)) return;
    context.report({ node: n, message: `'${name}' no esta definido en este alcance` });
  },
}; } } } };

// El codigo trae `eslint-disable-next-line react-hooks/exhaustive-deps`, y una config que no
// conoce esa regla lo reporta como error. Es ruido, no una fuga: se registra vacia.
const reactHooks = { rules: { 'exhaustive-deps': { create: () => ({}) },
                              'rules-of-hooks':  { create: () => ({}) } } };

export default [{
  files: ['**/*.jsx', '**/*.js'],
  linterOptions: { reportUnusedDisableDirectives: 'off' },
  plugins: { jsxScope, 'react-hooks': reactHooks },
  languageOptions: {
    ecmaVersion: 2023, sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: G,
  },
  rules: { 'no-undef': 'error', 'jsxScope/componente-no-definido': 'error' },
}];
EOF

PAT='no-undef|componente-no-definido'

# corre(archivos...) -> deja los hallazgos en $TMP/hallazgos; devuelve 2 si ESLint mismo murio.
corre() {
  local salida codigo
  salida="$(npx --yes eslint@9 --no-config-lookup -c "$CFG" "$@" 2>&1)"; codigo=$?
  printf '%s' "$salida" | grep -E "$PAT" > "$TMP/hallazgos" || true
  # ESLint sale 1 con hallazgos y 0 sin ellos. Cualquier otra cosa, o un 1 sin hallazgos, es que
  # trono: config mala, parser, un archivo ilegible. Eso NUNCA debe leerse como "limpio".
  if { [ "$codigo" -ne 0 ] && [ ! -s "$TMP/hallazgos" ]; } || [ "$codigo" -gt 1 ]; then
    echo "❌ ESLint no pudo correr (codigo $codigo). Esto NO es un verde:" >&2
    printf '%s\n' "$salida" | tail -20 >&2
    return 2
  fi
  return 0
}

# --- El chequeo se prueba a si mismo antes de opinar del codigo -------------------------------
mkdir -p src/__probe__
cat > src/__probe__/roto.jsx <<'EOF'
import React from 'react';
export default function X() {
  return <div><NoExisteEsteComponente a={1} /><span>{noExisteEstaFuncion()}</span></div>;
}
EOF
corre src/__probe__/roto.jsx || exit 2
AUTOPRUEBA="$(cat "$TMP/hallazgos")"
rm -rf src/__probe__
if ! printf '%s' "$AUTOPRUEBA" | grep -q "NoExisteEsteComponente" \
|| ! printf '%s' "$AUTOPRUEBA" | grep -q "noExisteEstaFuncion"; then
  echo "❌ la autoprueba no salio roja: el chequeo no esta cazando lo que dice cazar." >&2
  echo "   No sirve de nada seguir; un verde de aqui no significaria nada." >&2
  exit 2
fi

echo "Buscando identificadores fuera de alcance…"
corre src/*.jsx || exit 2
FUGAS="$(cat "$TMP/hallazgos")"

if [ -n "$FUGAS" ]; then
  echo
  printf '%s\n' "$FUGAS"
  echo
  echo "❌ hay identificadores usados fuera de su alcance: compilan y truenan en runtime."
  echo "   Sube el helper al modulo (si es funcion pura), pasalo como prop, o importa el componente."
  exit 1
fi
echo "✅ sin fugas de alcance entre componentes (autoprueba en rojo, codigo en verde)"
