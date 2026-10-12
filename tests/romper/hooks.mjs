// Tanda «hooks»: las reglas de los hooks de React en src/App.jsx, leídas del código (sin navegador). Nació en v10.84.80: puse tres
// hooks en App (la vista de origen de la forma) DESPUÉS de sus «return» tempranos (`if(!authChecked) return …`, `if(!user) return …`);
// al entrar la sesión el número de hooks cambiaba y la app tronaba entera («React error #310»). Los bancos no lo ven (montan los
// componentes sin esos «return»): sólo la app real lo enseñó. Esta tanda lo caza antes de subir, en TODOS los componentes:
//   hooks-01 ningún hook después de un «return» temprano del componente;
//   hooks-02 ningún hook dentro de una condición, un ciclo o un «&&» (lo mismo: el número de hooks cambia entre renders).
// Uso: node tests/romper/hooks.mjs [ruta de App.jsx]   (lo corre scripts/probar.mjs)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ARCHIVO = process.argv[2] || path.join(RAIZ, "src", "App.jsx");
const ast = parse(fs.readFileSync(ARCHIVO, "utf8"), { sourceType: "module", plugins: ["jsx"] });

const esHook = n => /^use[A-Z0-9]/.test(n);
const nombreDe = p => {
  if (p.isFunctionDeclaration()) return p.node.id?.name || null;
  if ((p.isArrowFunctionExpression() || p.isFunctionExpression()) && p.parentPath.isVariableDeclarator() && p.parentPath.node.id.type === "Identifier") return p.parentPath.node.id.name;
  return null;
};
// los componentes y los hooks propios: funciones de módulo con nombre en mayúscula o «use…»
const funciones = [];
traverse(ast, { "FunctionDeclaration|ArrowFunctionExpression|FunctionExpression"(p) {
  const n = nombreDe(p); if (!n || !(/^[A-Z]/.test(n) || esHook(n))) return;
  if (p.getFunctionParent?.() && p.getFunctionParent() !== p && p.parentPath.getFunctionParent()) return;   // sólo las de módulo
  if (p.node.body.type !== "BlockStatement") return;
  funciones.push({ nombre: n, p });
} });
const despues = [], condicionales = [];
const linea = n => n.loc?.start.line;
for (const { nombre, p } of funciones) {
  // 1) el primer «return» temprano: un return directo en el cuerpo (que no sea el último enunciado) o un if cuyo bloque regresa
  const cuerpo = p.node.body.body;
  let primerReturn = null;
  cuerpo.forEach((st, i) => {
    if (primerReturn) return;
    const regresa = s => s && (s.type === "ReturnStatement" || (s.type === "BlockStatement" && s.body.some(regresa)) || (s.type === "IfStatement" && (regresa(s.consequent) || regresa(s.alternate))));
    if (st.type === "IfStatement" && regresa(st)) primerReturn = st;
    else if (st.type === "ReturnStatement" && i < cuerpo.length - 1) primerReturn = st;
  });
  // 2) cada llamada a un hook cuya función más cercana es ESTE componente
  p.traverse({ CallExpression(c) {
    const callee = c.node.callee; const n = callee.type === "Identifier" ? callee.name : null;
    if (!n || !esHook(n)) return;
    if (c.getFunctionParent() !== p) return;   // dentro de un efecto, un manejador o un componente interno: no cuenta aquí
    if (primerReturn && c.node.start > primerReturn.end) despues.push(`${nombre}: ${n} (línea ${linea(c.node)}) después del «return» temprano de la línea ${linea(primerReturn)}`);
    // sólo cuenta lo que PUEDE no evaluarse: el bloque de un if (no su condición), las ramas de «?:», el lado derecho de «&&»/«||»/«??»,
    // un ciclo, un case o un try. `useMemo(…)||x` (el hook a la izquierda) siempre se llama.
    let hijo = c;
    for (let a = c.parentPath; a && a !== p; hijo = a, a = a.parentPath) {
      const k = hijo.key;
      const cond = (a.isIfStatement() && k !== "test") || (a.isConditionalExpression() && k !== "test") || (a.isLogicalExpression() && k === "right")
        || a.isLoop() || a.isSwitchCase() || (a.isTryStatement() && k !== "block");
      if (cond) { condicionales.push(`${nombre}: ${n} (línea ${linea(c.node)}) dentro de ${a.node.type} (línea ${linea(a.node)})`); break; }
    }
  } });
}
const res = [];
// por componente, todos (una lista cortada escondía al de App detrás de los de otro)
const porComp = xs => Object.entries(xs.reduce((m, x) => { const [c, ...r] = x.split(": "); (m[c] = m[c] || []).push(r.join(": ")); return m; }, {})).map(([c, v]) => `${c} (${v.length}): ${v[0]}`).join(" | ");
res.push((despues.length ? "FALLA " : "PASA  ") + "hooks-01 ningún componente llama un hook después de un «return» temprano" + (despues.length ? "  · " + porComp(despues) : `  · ${funciones.length} componentes y hooks revisados`));
res.push((condicionales.length ? "FALLA " : "PASA  ") + "hooks-02 ningún hook dentro de una condición, un ciclo o un «&&»" + (condicionales.length ? "  · " + porComp(condicionales) : ""));
const fallas = res.filter(r => r.startsWith("FALLA")).length;
console.log(res.join("\n"));
console.log(`\n${res.length - fallas} de ${res.length} pasan` + (fallas ? ` · ${fallas} FALLAN` : ""));
process.exit(fallas ? 1 : 0);
