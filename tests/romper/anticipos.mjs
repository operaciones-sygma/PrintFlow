// Tratar de ROMPER qué factura por adelantado se pregunta antes de asignar folio (v10.84.68). Sin banco: extrae de src/App.jsx (con
// extraer.mjs) las dos funciones VIVAS que lo deciden, anticiposQuePreguntar y facturaDelMismoImporte, y las corre con las candidatas
// como las da la base (list_linkable_invoices_for_order, con `monto_cuadra`). El caso de Karla (8-oct): P-0585 de Castores con F-135
// justo por su importe y F-140 de otro; la app preguntaba por F-140 («no se liga sola») y Karla entendió que F-135 tampoco se ligaba.
// La pantalla de punta a punta (la pregunta, «Sí, ligar», el efectivo frenado) la prueba tests/recorrido/ligar-anticipo.mjs.
// Uso: node tests/romper/anticipos.mjs   ·   SOLO=<regex> corre sólo los casos que coinciden
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extraer } from "../banco/extraer.mjs";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { codigo } = extraer(fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8"), ["anticiposQuePreguntar", "facturaDelMismoImporte"]);
const { anticiposQuePreguntar, facturaDelMismoImporte } = new Function(codigo + "\nreturn { anticiposQuePreguntar, facturaDelMismoImporte };")();
const res = [];
const ok = (id, cond, desc, detalle = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(id)) return; res.push(`${cond ? "PASA " : "FALLA"} ${id} ${desc}${cond ? "" : "  · " + detalle}`); };
const c = (doc_number, doc_type, amount, monto_cuadra) => ({ doc_number, doc_type, amount, monto_cuadra, dias_sin_orden: 2 });
const nums = xs => (xs || []).map(x => x.doc_number).join(",");
const CASTORES = [c("F-135", "factura", 8630.4, true), c("F-140", "factura", 2157.6, false)];

const a1 = anticiposQuePreguntar(CASTORES, "factura");
ok("ant-01", a1.length === 0, "Castores: con F-135 del mismo importe no se pregunta por F-140 (la base ofrece «Sí, ligar F-135»)", "pregunta por: " + nums(a1));
ok("ant-02", facturaDelMismoImporte(CASTORES, "factura")?.doc_number === "F-135", "la del mismo importe es F-135 (la que el efectivo no puede duplicar)", String(facturaDelMismoImporte(CASTORES, "factura")?.doc_number));
const a3 = anticiposQuePreguntar([c("F-90", "factura", 8004, false)], "factura");
ok("ant-03", nums(a3) === "F-90", "sólo una de otro importe (el anticipo de P-0544): sí se pregunta por ella, como desde v10.84.31", nums(a3));
// por donde no se diseñó
const mezcla = [c("R-0864", "remision", 7440, true), c("F-140", "factura", 2157.6, false)];
ok("ant-04", nums(anticiposQuePreguntar(mezcla, "factura")) === "F-140" && facturaDelMismoImporte(mezcla, "factura") === null,
  "una REMISIÓN del mismo importe no calla la pregunta de una FACTURA, ni cuenta como su factura", nums(anticiposQuePreguntar(mezcla, "factura")));
ok("ant-05", anticiposQuePreguntar(mezcla, "remision").length === 0 && facturaDelMismoImporte(mezcla, "remision")?.doc_number === "R-0864",
  "con una remisión del mismo importe, al asignar remisión no se pregunta (y es la que no se duplica)", nums(anticiposQuePreguntar(mezcla, "remision")));
ok("ant-06", anticiposQuePreguntar([...CASTORES, c("F-150", "factura", 500, false)], "factura").length === 0,
  "con una del mismo importe y varias de otro, no se pregunta por ninguna", "");
ok("ant-07", ["", "no_folio", "stock", undefined, null].every(t => anticiposQuePreguntar(CASTORES, t).length === 0),
  "sin factura ni remisión (no_folio, carga a stock) no se pregunta nada", "");
ok("ant-08", anticiposQuePreguntar([], "factura").length === 0 && anticiposQuePreguntar(null, "factura").length === 0 && facturaDelMismoImporte(null, "factura") === null
  && anticiposQuePreguntar([null, undefined, c("F-1", "factura", 1, false)], "factura").length === 1,
  "sin candidatas (o con basura en la lista) no truena", "");
const dos = [c("F-135", "factura", 8630.4, true), c("F-136", "factura", 8630.4, true)];
ok("ant-09", facturaDelMismoImporte(dos, "factura")?.doc_number === "F-135", "con dos del mismo importe, la primera (la base las da con la más vieja primero)", String(facturaDelMismoImporte(dos, "factura")?.doc_number));

for (const r of res) console.log(r);
const mal = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nanticipos: ${res.length - mal} pasan, ${mal} fallan`);
process.exit(mal ? 1 : 0);
