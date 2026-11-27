// Tratar de ROMPER la segunda oportunidad de lo que ni empezó (27-nov-2026, sólo pruebas; Marcelo: «sí, da una segunda oportunidad», la
// decisión del 6-nov en ../cobranzaflow/docs/PENDIENTES.md). scripts/reintento.mjs es el mismo en las cuatro apps: una prueba de dinero o de doble acción
// cuyas FALLA dicen TODAS que ni empezó (`NO_EMPEZO`) se repite una vez, como las demás; si pasa, sale INESTABLE con sus candados. Aquí lo dice
// el `caso` de cada tanda de dinero con navegador: prende `page.empezo` justo antes de sus pruebas, y si se cae antes (la página ni abrió:
// net::ERR_NO_BUFFER_SPACE, como el 5-nov, cuando frenó tres candados), su «se cayó» y su «errores de consola» llevan la marca. Lo que ya llamó a
// sus pruebas pudo apretar un botón de dinero: sin marca, sin segunda oportunidad (como antes).
// Cada caso afirma lo que DEBERÍA pasar. Uso: node tests/romper/no-empezo.mjs   ·   SOLO=<regex> corre sólo esos casos (emp-0 lee el código, emp-1 corre)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as reintento from "../../scripts/reintento.mjs";   // por nombre: si la copia de antes no trae NO_EMPEZO, sus casos fallan en vez de tronar

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { leer, aRepetir, hacerSinSegunda } = reintento;
const NO_EMPEZO = reintento.NO_EMPEZO;
const res = [];
const ok = (n, c, x = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + String(x).replace(/\s+/g, " ").slice(0, 300) : "")); };
const quiere = n => !process.env.SOLO || new RegExp(process.env.SOLO).test(n);

// Las tandas de dinero que abren una página (las de scripts/probar.mjs; «corregir» y «cancelaciones» no abren ninguna; «orden-2» es orden.mjs).
const TANDAS = ["folio", "oc", "plan", "partes", "cancelar", "orden", "venta-inventario"];
const fuente = t => fs.readFileSync(path.join(RAIZ, "tests", "romper", t + ".mjs"), "utf8").replace(/\r\n/g, "\n");
const casoDe = s => { const i = s.indexOf("async function caso("), f = i >= 0 ? s.indexOf("\n}\n", i) : -1; return f > i ? s.slice(i, f) : ""; };

try {
  if (!NO_EMPEZO) ok("emp-00 scripts/reintento.mjs dice con qué se marca lo que ni empezó (NO_EMPEZO)", false, "la copia de reintento.mjs no lo trae");

  // ── emp-01 a emp-07: lo que dice el código de cada `caso` (sin correr nada) ──
  for (const [i, t] of TANDAS.entries()) {
    const id = `emp-0${i + 1}`;
    if (!quiere(id)) continue;
    const s = fuente(t), caso = casoDe(s);
    const prende = (caso.match(/page\.empezo = true;/g) || []).length;
    const justoAntes = /page\.empezo = true;[^\n]*\n\s*await fn\(page\);/.test(caso);
    const marcas = (caso.match(/\(page\.empezo \? "" : "  " \+ NO_EMPEZO\)/g) || []).length;
    const importa = /^import \{ NO_EMPEZO \} from "\.\.\/\.\.\/scripts\/reintento\.mjs";/m.test(s);
    ok(`${id} ${t}: la marca se prende una vez, justo antes de sus pruebas, y «se cayó» y «errores de consola» la llevan sólo si no se prendió`,
      !!caso && prende === 1 && justoAntes && marcas === 2 && importa, JSON.stringify({ caso: !!caso, prende, justoAntes, marcas, importa }));
  }

  // ── emp-11 a emp-17: de verdad, cada tanda contra un puerto donde la página no abre (el 9: Chromium ni lo intenta, ERR_UNSAFE_PORT) ──
  // Con SOLO, cinco de sus casos (los primeros del archivo); la que no lo entiende (oc, partes) corre todos: fallan en milisegundos.
  for (const [i, t] of TANDAS.entries()) {
    const id = `emp-1${i + 1}`;
    if (!quiere(id)) continue;
    const s = fuente(t);
    const ids = [...s.matchAll(/await caso\(\s*"([a-z]+-\d+[a-z]?)\b/g)].map(m => m[1]).slice(0, 5);
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "no-empezo-"));
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [path.join(RAIZ, "tests", "romper", t + ".mjs"), out, "9"], {
      cwd: RAIZ, encoding: "utf8", timeout: 6 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, PROBAR_INTENTO: "1", SOLO: ids.length ? "^(?:" + ids.join("|") + ")(?![0-9])" : "" },
    });
    const seg = Math.round((Date.now() - t0) / 1000);
    fs.rmSync(out, { recursive: true, force: true });
    const salida = `${r.stdout || ""}\n${r.stderr || ""}`;
    const cayeron = salida.split(/\r?\n/).filter(l => /^FALLA\s.*\(la prueba se cayó\)/.test(l));
    const sinMarca = cayeron.filter(l => !NO_EMPEZO || !l.includes(NO_EMPEZO));
    const idsCaidos = [...new Set(cayeron.map(l => /^FALLA\s+(\S+)/.exec(l)[1]))];
    let repite = [];
    try { repite = aRepetir(leer(salida), hacerSinSegunda({ tandasDeDinero: TANDAS, tanda: t })); } catch (e) { repite = ["(truena: " + e.message + ")"]; }
    const noRepite = idsCaidos.filter(x => !repite.includes(x));
    ok(`${id} ${t} contra un puerto donde la página no abre: cada caso que ni empezó lleva la marca y el candado lo repite, aunque la tanda sea de dinero`,
      cayeron.length > 0 && !sinMarca.length && !noRepite.length,
      `${cayeron.length} se cayeron (${seg} s), ${sinMarca.length} sin la marca${sinMarca[0] ? ": " + sinMarca[0].slice(0, 140) : ""}; no se repetirían ${noRepite.length}${noRepite.length ? " (" + noRepite.slice(0, 4).join(", ") + ")" : ""}`
        + (cayeron.length ? "" : ` · salió ${r.status}${r.error ? " " + r.error.message : ""}: ${salida.slice(-200)}`));
  }

  // ── emp-21: el control con la regla compartida: el caso que ya empezó (sin la marca) de una tanda de dinero NO se repite, y basta una FALLA
  //    sin la marca para que no se repita aunque otra la lleve ──
  if (quiere("emp-21")) {
    const marca = String(NO_EMPEZO);
    const l = leer([`FALLA inv-90 el total a la vista (la prueba se cayó)  · page.goto: net::ERR_NO_BUFFER_SPACE  ${marca}`,
      "FALLA inv-91 un solo folio (la prueba se cayó)  · locator.click: Timeout 6000ms exceeded.",
      `FALLA inv-92 dos folios (la prueba se cayó)  · page.goto: net::ERR_NO_BUFFER_SPACE  ${marca}`, "FALLA inv-92 salieron 2 folios"].join("\n"));
    const rep = aRepetir(l, hacerSinSegunda({ tandasDeDinero: TANDAS, tanda: "folio" }));
    ok("emp-21 en folio, sólo se repite el caso que ni empezó; el que ya empezó y el que tiene una FALLA sin la marca, no", rep.join(",") === "inv-90", rep.join(",") || "(nada)");
  }
} catch (e) {
  ok("emp-99 la prueba corrió sin tronar", false, e?.stack || e?.message || String(e));
}
for (const x of res) console.log(x);
const fallan = res.filter(x => x.startsWith("FALLA")).length;
console.log(`\nno-empezo: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
