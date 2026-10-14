// Tratar de ROMPER la propuesta de piezas desde un CFDI (v10.84.102), sin navegador: src/lib/proponerPiezas.js con los conceptos
// timbrados DE VERDAD de F-143 y F-155 (PORTLAND, OC-0960) y los bordes. Cada caso afirma lo que DEBERÍA pasar.
// Uso: node tests/romper/proponer.mjs   ·   SOLO=<regex> corre sólo esos casos
import { proponerPiezas, palabras, mismoPrecio } from "../../src/lib/proponerPiezas.js";
const res = [];
const ok = (n, c, x = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + x : "")); };
// las órdenes de OC-0960 como las tiene la base (product vacío, el nombre en product_type, con su espacio al final)
const OC0960 = [
  { id: "OP-1", production_number: "P-0592", nombre: "STICKER #4 REDONDO NEGRO DE PINOS ", unitario: 0.14, disponible: 80000 },
  { id: "OP-2", production_number: "P-0593", nombre: "STICKER #3 REDONDO NEGRO DE PINOS ", unitario: 0.11, disponible: 80000 },
  { id: "OP-3", production_number: "P-0594", nombre: "STICKER #4 REDONDO NEGRO DE PORTLAND ", unitario: 0.14, disponible: 80000 },
  { id: "OP-4", production_number: "P-0595", nombre: "STICKER #3 REDONDO NEGRO DE PORTLAND ", unitario: 0.11, disponible: 80000 },
];
// los conceptos timbrados (cobranza.cfdi_line_items, 14-oct)
const F143 = [
  { line_no: 1, cantidad: "4380", valor_unitario: "0.14", importe: "613.20", descuento: "0", descripcion: "STK-NGO-PN04 STICKER REDONDO NEGRO DE PINOS 4 CM" },
  { line_no: 2, cantidad: "7395", valor_unitario: "0.14", importe: "1035.30", descuento: "0", descripcion: "STK-NGO-PRL4 STICKER REDONDO NEGRO PORTLAND 4 CM" },
  { line_no: 3, cantidad: "3528", valor_unitario: "0.11", importe: "388.08", descuento: "0", descripcion: "STK-NGO-PN03 STICKER REDONDO NEGRO DE PINOS 3 CM" },
  { line_no: 4, cantidad: "5520", valor_unitario: "0.11", importe: "607.20", descuento: "0", descripcion: "STK-NGO-PRL3 STICKER REDONDO NEGRO PORTLAND 3 CM" },
];
const F155 = [
  { line_no: 1, cantidad: "75620", valor_unitario: "0.14", importe: "10586.80", descuento: "0", descripcion: "STK-NGO-PNO4 STICKER REDONDO NEGRO DE PINOS 4 CM" },
  { line_no: 2, cantidad: "72605", valor_unitario: "0.14", importe: "10164.70", descuento: "0", descripcion: "STK-NGO-PRL4 STICKER REDONDO NEGRO PORTLAND 4 CM" },
  { line_no: 3, cantidad: "76472", valor_unitario: "0.11", importe: "8411.92", descuento: "0", descripcion: "STK-NGO-PNO3-STICKER REDONDO NEGRO DE PINOS 3 CM" },
  { line_no: 4, cantidad: "74480", valor_unitario: "0.11", importe: "8192.80", descuento: "0", descripcion: "STK-NGO-PRL3 STICKER REDONDO NEGRO PORTLAND 3 CM" },
];
const piezasDe = r => OC0960.map(o => r.piezas[o.id] || 0).join(",");

let r = proponerPiezas(F143, OC0960);
ok("pp-01 F-143: sus 4 conceptos caen en P-0592 a P-0595 con sus piezas (4,380 · 3,528 · 7,395 · 5,520)", piezasDe(r) === "4380,3528,7395,5520" && r.sinCasar.length === 0 && r.dudosos.length === 0, piezasDe(r));
r = proponerPiezas(F155, OC0960);
ok("pp-02 F-155: «PNO4» y «PNO3-STICKER» (con O y con guion) caen igual (75,620 · 76,472 · 72,605 · 74,480)", piezasDe(r) === "75620,76472,72605,74480" && r.sinCasar.length === 0 && r.dudosos.length === 0, piezasDe(r));
r = proponerPiezas([...F143].reverse(), OC0960);
ok("pp-03 el orden de los conceptos no importa", piezasDe(r) === "4380,3528,7395,5520", piezasDe(r));
// los bordes
r = proponerPiezas([{ line_no: 1, cantidad: 100, valor_unitario: 0.50, descripcion: "STICKER REDONDO NEGRO DE PINOS 4 CM" }], OC0960);
ok("pp-04 un concepto con otro precio no se casa (sale sin casar, no se adivina)", Object.keys(r.piezas).length === 0 && r.sinCasar.length === 1);
const GEMELAS = [OC0960[0], { ...OC0960[0], id: "OP-9", production_number: "P-0599" }];
r = proponerPiezas([F143[0]], GEMELAS);
ok("pp-05 dos órdenes iguales (mismo nombre y precio): dudoso, con las dos candidatas; no se reparte a ciegas", Object.keys(r.piezas).length === 0 && r.dudosos.length === 1 && r.dudosos[0].candidatas.join(",") === "P-0592,P-0599", JSON.stringify(r.dudosos));
r = proponerPiezas([{ line_no: 1, cantidad: 10, valor_unitario: 0.14, descripcion: "SERVICIO DE DISEÑO" }], OC0960);
ok("pp-06 un concepto del mismo precio pero sin palabras en común (un servicio) no se casa", Object.keys(r.piezas).length === 0 && r.sinCasar.length === 1);
r = proponerPiezas([], OC0960);
ok("pp-07 sin conceptos (una remisión, o sin timbrar): nada propuesto, nada dudoso", Object.keys(r.piezas).length === 0 && r.sinCasar.length === 0 && r.dudosos.length === 0);
r = proponerPiezas([{ line_no: 1, cantidad: "0", valor_unitario: 0.14, descripcion: "STICKER PINOS 4" }, { line_no: 2, cantidad: null, valor_unitario: 0.14, descripcion: "STICKER PINOS 4" }], OC0960);
ok("pp-08 cantidades en cero o vacías no proponen piezas", Object.keys(r.piezas).length === 0 && r.sinCasar.length === 2);
r = proponerPiezas([{ line_no: 1, cantidad: "4380.4", valor_unitario: "0.14", descripcion: "STICKER REDONDO NEGRO DE PINOS 4 CM" }], OC0960);
ok("pp-09 una cantidad con decimales se redondea a piezas enteras", r.piezas["OP-1"] === 4380, JSON.stringify(r.piezas));
r = proponerPiezas([F143[0], { ...F143[0], line_no: 9, cantidad: "20" }], OC0960);
ok("pp-10 dos conceptos de la misma orden se suman", r.piezas["OP-1"] === 4400 && r.casados.length === 2, JSON.stringify(r.piezas));
ok("pp-11 las palabras: sin acentos, sin «de»/«cm», con los números («#4» da «4»)", [...palabras("Stícker #4 redondo DE pinos 4 cm")].join(" ") === "STICKER 4 REDONDO PINOS", [...palabras("Stícker #4 redondo DE pinos 4 cm")].join(" "));
ok("pp-12 el precio: a medio centavo o 1 % (0.1404 sí, 0.15 no; precio 0 nunca)", mismoPrecio(0.1404, 0.14) && !mismoPrecio(0.15, 0.14) && !mismoPrecio(0.14, 0));
r = proponerPiezas(F143, null);
ok("pp-13 sin órdenes en el plan: nada se casa (y no truena)", Object.keys(r.piezas).length === 0 && r.sinCasar.length === 4);

for (const x of res) console.log(x);
const fallan = res.filter(x => x.startsWith("FALLA")).length;
console.log(`\nproponer: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
