// Tratar de ROMPER el candado (.githooks/pre-push), sin navegador. 15-oct-2026: el candado probaba la CARPETA, no el commit: con un arreglo
// sin commit (o un archivo sin «git add») todo pasaba y se subía el commit SIN el arreglo, y lo que se subía podía no ser HEAD. Lo cerró
// CobranzaFlow en v3.7.1009 y aquí se hace igual (Marcelo, 8-oct: «aplica la misma metodología para todos los proyectos»). Esta prueba arma
// un repo temporal con el gancho de verdad (las inestables, el build y las pruebas, de mentira) y le pasa por la entrada estándar lo que le
// pasa git al subir. Uso: node tests/romper/candado.mjs   ·   SOLO=<regex> corre sólo esos casos
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const GANCHO = fs.readFileSync(path.join(RAIZ, ".githooks", "pre-push"), "utf8");
// el sh de git: en el candado viene en el PATH (git corre el gancho con el suyo); desde PowerShell, no
const SH = (() => {
  if (!spawnSync("sh", ["-c", "exit 0"]).error) return "sh";
  const ex = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim();   // …/Git/mingw64/libexec/git-core
  for (const c of [path.resolve(ex, "../../../bin/sh.exe"), path.resolve(ex, "../../../usr/bin/sh.exe")]) if (fs.existsSync(c)) return c;
  return "sh";
})();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "candado-carpeta-"));
const git = (...a) => execFileSync("git", a, { cwd: tmp, encoding: "utf8" }).trim();
const escribir = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), txt); };
const res = [];
const ok = (n, c, x = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x.replace(/\s+/g, " ").slice(0, 220) : "")); };
// el gancho, con lo que git le da por la entrada estándar: «<ref local> <sha local> <ref remota> <sha remota>»
const correrGancho = (local, remoto) => {
  const r = spawnSync(SH, [".githooks/pre-push", "origin", "https://example.invalid/repo.git"], { cwd: tmp, encoding: "utf8",
    input: `refs/heads/main ${local} refs/heads/main ${remoto}\n` });
  return { codigo: r.status, salida: `${r.stdout || ""}${r.stderr || ""}${r.error ? " (error: " + r.error.message + ")" : ""}` };
};

try {
  git("init", "-q");
  git("config", "user.email", "pruebas@example.invalid"); git("config", "user.name", "Pruebas"); git("config", "core.autocrlf", "false");
  escribir(".githooks/pre-push", GANCHO);
  // lo que el gancho llama: las inestables, el build y las pruebas, de mentira (salen en 0)
  escribir("scripts/inestables.mjs", "process.exit(0);\n");
  escribir("scripts/probar.mjs", 'console.log("pruebas de mentira"); process.exit(0);\n');
  escribir("package.json", JSON.stringify({ name: "candado-prueba", private: true, scripts: { build: 'node -e "process.exit(0)"' } }));
  escribir("src/App.jsx", "export const v = 1;\n");
  escribir("LEEME.md", "uno\n");
  git("add", "-A"); git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD");
  escribir("src/App.jsx", "export const v = 2;\n");
  git("add", "-A"); git("commit", "-q", "-m", "un cambio de código");
  const head = git("rev-parse", "HEAD");

  // 1. limpio y subiendo HEAD: corre (aquí, sus pruebas de mentira) y pasa
  let r = correrGancho(head, base);
  ok("can-g01 con la carpeta limpia y subiendo HEAD, el candado corre y pasa", r.codigo === 0 && /todo en verde/.test(r.salida), r.salida);

  // 2. un arreglo sin commit en src/: no arranca (antes probaba el arreglo y subía el commit sin él)
  escribir("src/App.jsx", "export const v = 3; // el arreglo sin commit\n");
  r = correrGancho(head, base);
  ok("can-g02 con un cambio sin commit en src/, el candado no arranca y lo dice", r.codigo === 1 && /cambios sin commit/.test(r.salida) && !/pruebas de mentira/.test(r.salida), r.salida);
  git("checkout", "--", "src/App.jsx");

  // 3. un archivo nuevo sin «git add» en tests/: tampoco (una prueba nueva que nadie subió)
  escribir("tests/romper/nueva.mjs", "process.exit(1);\n");
  r = correrGancho(head, base);
  ok("can-g03 con un archivo sin «git add» en tests/, tampoco", r.codigo === 1 && /cambios sin commit/.test(r.salida), r.salida);
  fs.rmSync(path.join(tmp, "tests"), { recursive: true });

  // 4. subir un SHA que no es HEAD: no arranca (probaría otra cosa)
  r = correrGancho(base, base.replace(/./, c => (c === "0" ? "1" : "0")));
  ok("can-g04 si lo que se sube no es HEAD, no arranca", r.codigo === 1 && /no es lo que hay en la carpeta/.test(r.salida), r.salida);

  // 5. lo de siempre: un cambio sólo de documentos pasa directo (aunque haya documentos sin commit fuera de lo que prueba)
  escribir("LEEME.md", "dos\n"); git("add", "-A"); git("commit", "-q", "-m", "docs");
  const docs = git("rev-parse", "HEAD");
  escribir("LEEME.md", "tres, sin commit\n");
  r = correrGancho(docs, head);
  ok("can-g05 un cambio sólo de documentos pasa directo, como antes", r.codigo === 0 && /sólo documentos/.test(r.salida), r.salida);
  // vuelta 3, por donde no se diseñó: un documento sin commit FUERA de lo que se prueba no frena una subida de código; uno de tests/ sí
  // (tests/LEEME.md vive en lo que se prueba: el 14-oct se quedó sin commit tras un push de documentos que lo dejó fuera)
  escribir("src/App.jsx", "export const v = 4;\n"); git("add", "-A"); git("commit", "-q", "-m", "otro cambio de código");
  const head2 = git("rev-parse", "HEAD");
  escribir("CHANGELOG.md", "una entrada sin commit\n");
  r = correrGancho(head2, docs);
  ok("can-g06 un documento sin commit fuera de lo que se prueba (CHANGELOG.md) no frena una subida de código", r.codigo === 0 && /todo en verde/.test(r.salida), r.salida);
  fs.rmSync(path.join(tmp, "CHANGELOG.md"));
  escribir("tests/LEEME.md", "las tandas, sin commit\n");
  r = correrGancho(head2, docs);
  ok("can-g07 el LEEME de tests/ sin commit sí frena (vive en lo que se prueba): commit de todo antes de subir", r.codigo === 1 && /cambios sin commit/.test(r.salida) && /tests\//.test(r.salida), r.salida);
} catch (e) {
  ok("can-g00 la prueba armó su repo temporal", false, e?.message || String(e));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
for (const x of res) console.log(x);
const fallan = res.filter(x => x.startsWith("FALLA")).length;
console.log(`\ncandado: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
