// Tratar de ROMPER los chips de «Mis Pendientes» y las guías de las fichas, sin navegador: extrae de App.jsx (con extraer.mjs) los chips
// de cada rol (`getTaskFilters`) y las guías (`GUIDES`), y los evalúa en Node con los íconos de mentira (v10.84.88, la critique de «Mis
// Pendientes»: chips que nunca podían contar nada de la lista de su rol, uno en inglés, y guías que contradecían los botones de la ficha
// o decían cosas que ya no son ciertas). Cada caso afirma lo que DEBERÍA pasar.
// Uso: node tests/romper/chips.mjs [App.jsx=src/App.jsx]   ·   SOLO=<regex> corre sólo los casos que coinciden
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extraer } from "../banco/extraer.mjs";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP = process.argv[2] || path.join(RAIZ, "src", "App.jsx");
const fuente = fs.readFileSync(APP, "utf8");
const { codigo } = extraer(fuente, ["getTaskFilters", "GUIDES"], { simulados: ["supabase"] });
// los íconos (Phosphor) se importan en App.jsx: aquí, de mentira
const iconos = [...new Set(codigo.match(/\b[A-Z][A-Za-z0-9]*Icon\b/g) || [])];
const tmp = path.join(os.tmpdir(), "pf-chips-" + process.pid + ".mjs");
fs.writeFileSync(tmp, iconos.map(i => `const ${i} = () => null;`).join("\n") + "\nconst supabase = {};\n" + codigo + "\nexport { getTaskFilters, GUIDES };\n");
const { getTaskFilters, GUIDES } = await import(pathToFileURL(tmp).href);
fs.rmSync(tmp, { force: true });
const res = [];
const ok = (n, c, x = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : "")); };
const llaves = r => getTaskFilters(r).map(f => f.key);
const etiquetas = r => getTaskFilters(r).map(f => f.label);

// ── v10.84.88 — vuelta 1: escritas ANTES del cambio, contra v10.84.87 ──
// lo que trae la lista de cada rol (myTasks, src/App.jsx cerca de la línea 22223; si cambia allá, cambia aquí): un chip que no puede
//   contar nada de su lista es ruido (con su 0 al 50 % de opacidad). La orden de mentira trae todas las banderas para no fallar por ellas.
const LISTAS = { produccion: ["draft", "ready", "in_production", "maquila_out", "maquila_in", "packaging", "placas_listas"], preprensa: ["draft", "design", "proof_client"],
  german: ["proof_printing", "ctp"], karla: ["salidas", "maq_received"], secretaria: ["draft", "proof_client", "maq_created", "maq_sent", "maq_in_progress"],
  vendedor: ["draft", "proof_client", "maq_created", "maq_sent", "maq_in_progress"] };
const deMentira = stage => ({ stage, priority: "urgente", due_date: "2000-01-01", order_type: "maquila", purchase_order_id: "OC-1", invoice_folio: null,
  invoice_pre_assigned: true, price: 0, current_machine: null, timeline: [], machine_log: [] });
// (Urgentes, Retrasos, Estancadas y Sin precio no dependen de la etapa: cualquier orden de la lista puede tenerlos; se revisan los de etapa)
const GENERALES = new Set(["urgent", "late", "stale", "no_price"]);
const muertos = Object.entries(LISTAS).flatMap(([r, sts]) => getTaskFilters(r).filter(f => !GENERALES.has(f.key) && !sts.some(st => { try { return !!f.predicate(deMentira(st)); } catch { return false; } })).map(f => r + ": " + f.label));
ok("ch-01-ningun-chip-muerto", muertos.length === 0, `chips que nunca pueden contar nada de la lista de su rol: [${muertos.join(", ") || "ninguno"}]`);
ok("ch-02-lupita-y-el-vendedor", JSON.stringify(llaves("secretaria")) === JSON.stringify(["urgent", "late", "drafts", "maquilas", "proof_client"]) && JSON.stringify(llaves("vendedor")) === JSON.stringify(llaves("secretaria")),
  `Lupita ve [${etiquetas("secretaria").join(", ")}]; el vendedor [${etiquetas("vendedor").join(", ")}] (los mismos: su lista es la misma)`);
ok("ch-03-sin-ingles", ["produccion", "preprensa", "german", "secretaria", "karla", "vendedor", "admin"].every(r => !etiquetas(r).some(l => /\b(Drafts|Specs|Click)\b/.test(l))),
  `chips en inglés: [${["produccion", "preprensa", "german", "secretaria", "karla", "vendedor", "admin"].flatMap(r => etiquetas(r).filter(l => /\b(Drafts|Specs|Click)\b/.test(l)).map(l => r + ": " + l)).join(", ") || "ninguno"}]`);
ok("ch-04-sin-llaves-repetidas", ["produccion", "preprensa", "german", "secretaria", "karla", "vendedor", "admin"].every(r => new Set(llaves(r)).size === llaves(r).length),
  "cada rol con sus llaves una vez");
const todas = Object.entries(GUIDES).flatMap(([r, g]) => Object.entries(g).map(([st, t]) => ({ r, st, t })));
const falsas = todas.filter(x => /D-XXXX|R-XXXX|borra el viejo|Borra el documento anterior|cuántas placas/.test(x.t));
ok("ch-05-guias-sin-lo-retirado", falsas.length === 0, `guías con series D-/R-, «borra el viejo» o placas al soltar: [${falsas.map(x => x.r + "/" + x.st).join(", ") || "ninguna"}]`);
// las fichas de Gerardo en máquina y en Empaque TIENEN los botones de Empaque, Maquila y Salidas: la guía no puede decir que se arrastra
const contradice = ["in_production", "packaging"].filter(st => /Arrastra a (Salidas|otra máquina, Empaque)/.test(GUIDES.produccion?.[st] || ""));
ok("ch-06-guia-de-gerardo-con-los-botones", contradice.length === 0, `guías de Gerardo que mandan a arrastrar lo que tiene botón: [${contradice.map(st => st + ": «" + GUIDES.produccion[st] + "»").join(" · ") || "ninguna"}]`);

for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nchips: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
