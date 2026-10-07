// Extrae de App.jsx lo que unas RAÍCES necesitan (componentes, funciones, constantes de módulo), sin listarlo a mano: parsea con
// @babel/parser, mira a qué declaraciones de módulo se refiere cada una (con su alcance real, no por texto) y junta la
// cerradura en el orden original del archivo. Las sentencias sueltas de módulo (un `forEach` que llena un mapa, el `if` que
// engancha el escStack) entran si tocan algo que ya entró.
// `simulados`: nombres que NO se extraen (la base, Storage, lo que firma archivos…): el banco pone su versión.
// Uso como módulo: extraer(fuente, raices, { simulados }) → { codigo, nombres, simuladosUsados }
// Uso suelto (para ver qué jala): node extraer.mjs <App.jsx> Raiz1,Raiz2 [simulado1,simulado2]
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;

export function extraer(fuente, raices, { simulados = [] } = {}) {
  const src = fuente.replace(/\r\n/g, "\n");
  const ast = parse(src, { sourceType: "module", plugins: ["jsx"], errorRecovery: false });
  const cuerpo = ast.program.body;
  // qué nombres declara cada sentencia de módulo y a cuáles de módulo se refiere
  const decl = new Map();   // nombre → índice de la sentencia
  const info = cuerpo.map(() => ({ declara: [], usa: new Set() }));
  cuerpo.forEach((n, i) => {
    if (n.type === "FunctionDeclaration" || n.type === "ClassDeclaration") info[i].declara.push(n.id.name);
    else if (n.type === "VariableDeclaration") n.declarations.forEach(d => { if (d.id.type === "Identifier") info[i].declara.push(d.id.name); });
    info[i].declara.forEach(x => decl.set(x, i));
  });
  traverse(ast, {
    "Identifier|JSXIdentifier"(p) {
      if (!p.isReferencedIdentifier() && !(p.isJSXIdentifier() && p.parentPath.isJSXOpeningElement())) return;
      const nombre = p.node.name, b = p.scope.getBinding(nombre);
      if (!b || !b.scope.path.isProgram()) return;
      let q = p; while (q.parentPath && !q.parentPath.isProgram()) q = q.parentPath;
      const i = cuerpo.indexOf(q.node);
      if (i >= 0) info[i].usa.add(nombre);
    },
  });
  const sim = new Set(simulados), dentro = new Set(), nombres = new Set(), simuladosUsados = new Set();
  const pendientes = [...raices];
  const meter = nombre => {
    if (sim.has(nombre)) { simuladosUsados.add(nombre); return; }
    const i = decl.get(nombre);
    if (i === undefined || dentro.has(i)) return;
    dentro.add(i); info[i].declara.forEach(x => nombres.add(x));
    info[i].usa.forEach(x => { if (!info[i].declara.includes(x)) pendientes.push(x); });
  };
  for (;;) {
    while (pendientes.length) meter(pendientes.pop());
    // sentencias sueltas (sin declarar nada) que tocan algo que ya entró; no las que sólo tocan simulados o importaciones
    let nuevas = 0;
    cuerpo.forEach((n, i) => {
      if (dentro.has(i) || info[i].declara.length || n.type === "ImportDeclaration" || n.type.startsWith("Export")) return;
      const usa = [...info[i].usa];
      if (!usa.some(x => nombres.has(x))) return;
      if (usa.some(x => !sim.has(x) && !decl.has(x))) return;
      dentro.add(i); nuevas++; usa.forEach(x => pendientes.push(x));
    });
    if (!pendientes.length && !nuevas) break;
  }
  const orden = [...dentro].sort((a, b) => a - b);
  const codigo = orden.map(i => src.slice(cuerpo[i].start, cuerpo[i].end)).join("\n");
  const lineas = orden.map(i => ({ linea: cuerpo[i].loc.start.line, nombres: info[i].declara.join(",") || "(sentencia)" }));
  return { codigo, nombres: [...nombres], simuladosUsados: [...simuladosUsados], lineas };
}

if (process.argv[1] && process.argv[1].endsWith("extraer.mjs")) {
  const [, , app, raices, simulados = ""] = process.argv;
  const t0 = Date.now();
  const r = extraer(fs.readFileSync(app, "utf8"), raices.split(","), { simulados: simulados.split(",").filter(Boolean) });
  console.log(r.lineas.map(x => x.linea + ":" + x.nombres).join("  "));
  console.log("\n" + r.lineas.length + " sentencias, " + r.codigo.length + " caracteres; simulados usados: " + r.simuladosUsados.join(",") + " · " + (Date.now() - t0) + " ms");
}
