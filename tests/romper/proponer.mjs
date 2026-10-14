// Tratar de ROMPER la propuesta de piezas desde un CFDI (v10.84.102), sin navegador: src/lib/proponerPiezas.js con los conceptos
// timbrados DE VERDAD de F-143 y F-155 (PORTLAND, OC-0960) y los bordes. Cada caso afirma lo que DEBERÍA pasar.
// Uso: node tests/romper/proponer.mjs   ·   SOLO=<regex> corre sólo esos casos
import * as lib from "../../src/lib/proponerPiezas.js";
const { proponerPiezas, palabras, mismoPrecio } = lib;
// v10.84.109: el nombre de una orden para casar (su producto y su tipo); antes de v10.84.109 la app usaba `product || product_type`
const descripcionDeOrden = lib.descripcionDeOrden || (o => o.product || o.product_type);
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

// v10.84.109 — Hotsson (OC-0966, 14-oct): las 11 facturas hechas el 13-oct y ligadas en el plan. Sus conceptos dicen el producto en SINGULAR
// («LIBRETA / AGENDA», «CALENDARIO») y las órdenes en PLURAL («AGENDAS 2027 …», «CALENDARIOS 2027 …», tipo «LIBRETAS ENGARGOLADAS PASTA DURA»)
const P0621 = { id: "OP-MV1NON22D08", production_number: "P-0621", product: "AGENDAS 2027\nPORTADAS\nMEDIDA 18.5 X 23\nPASTA DURA\nPORTADA Y CONTRAPORTADA 4 X 4\nCON LAMINADO MATE F y V\n\nINTERIORES \nPAPEL BOND 90g\nIMP. I X 1\nCON 100 HOJAS TODAS IGUALES (MISMO DISEÑO)\nENGARGOLADO METÁLICO", product_type: "LIBRETAS ENGARGOLADAS PASTA DURA", quantity: 658, price: 80370 };
const P0623 = { id: "OP-MV1NXBC9N49", production_number: "P-0623", product: "CALENDARIOS 2027\n\nBASE\nMEDIDA EXT. 41 X 21\nCON 2 PLECA DE DOBLEZ\nCARTULINA SULFATADA 20 PTS.\nIMP. 4 X 0\nCON LAMINADO MATE FRENTE\n\nHOJAS \n13 HOJAS / 26 PÁGS.\nCOUCHE 250g\nIMP. 4 X 4\n21 X 15 CM\nCON LAMINADO MATE FRENTE Y VUELTA\nENGARGOLADO METÁLICO\n", product_type: "CALENDARIOS DE ESCRITORIO", quantity: 426, price: 33730 };
const OC0966 = [P0621, P0623].map(o => ({ id: o.id, production_number: o.production_number, nombre: descripcionDeOrden(o), unitario: o.price / o.quantity, disponible: o.quantity }));
const HOTSSON = {   // folio: [[cantidad, valor_unitario, descripcion] × 2] — cobranza, timbrados el 13-oct
  "F-159": [[110, 122.14, "HS HOTSSON HOTEL LEON LIBRETA /AGENDA"], [50, 79.1845, "HS HOTSSON HOTEL LEON  CALENDARIOS"]],
  "F-160": [[60, 122.14, "HS HOTSSON HOTEL SILAO LIBRETA/AGENDA"], [40, 79.1825, "HS HOTSSON HOTEL SILAO CALENDARIO"]],
  "F-161": [[50, 122.14, "CORPORATIVO APITALI GRUPO HOTELERO LIBRETA / AGENDA"], [30, 79.1825, "CORPORATIVO APITALI GRUPO HOTELERO CALENDARIO"]],
  "F-162": [[60, 122.142, "HS HOTSSON SMART LEON-CENTRO MAX LIBRETA / AGENDA"], [30, 79.18, "HS HOTSSON SMART LEON-CENTRO MAX CALENDARIO"]],
  "F-163": [[92, 122.1406, "HS HOTSSON ACAPULCO LIBRETA / AGENDA"], [30, 79.1845, "HS HOTSSON ACAPULCO CALENDARIO"]],
  "F-164": [[50, 122.14, "HS HOTSSON HOTEL TAMPICO Y SMART VALUE TAMPICO LIBRETA / AGE"], [50, 79.181, "HS HOTSSON HOTEL TAMPICO Y SMART VALUE TAMPICO CALENDARIO"]],
  "F-165": [[50, 122.14, "HS HOTSSON HOTEL QUERETARO LIBRETA / AGENDA"], [50, 79.181, "HS HOTSSON HOTEL QUERETARO CALENDARIO"]],
  "F-166": [[70, 122.142, "HS HOTSSON HOTEL IRAPUATO LIBRETA"], [30, 79.18, "HS HOTSSON HOTEL IRAPUATO CALENDARIO"]],
  "F-167": [[50, 122.14, "MORELIA MANSION SOLIS LIBRETA / AGENDA"], [50, 79.181, "MORELIA MANSION SOLIS  CALENDARIO"]],
  "F-168": [[50, 122.14, "LA ARBOLEDA LIBRETA / AGENDA"], [50, 79.181, "LA ARBOLEDA CALENDARIO"]],
  "F-169": [[16, 122.14125, "CORPORATIVO CAPITALI GRUPO HOTELERO LIBRETA / AGENDA"], [16, 79.18, "CORPORATIVO CAPITALI GRUPO HOTELERO CALENDARIO"]],
};
const conceptosDe = fol => HOTSSON[fol].map(([cantidad, valor_unitario, descripcion], k) => ({ line_no: k + 1, cantidad: String(cantidad), valor_unitario: String(valor_unitario), importe: "0", descuento: "0", descripcion }));
const de0966 = r => (r.piezas[P0621.id] || 0) + "," + (r.piezas[P0623.id] || 0);
r = proponerPiezas(conceptosDe("F-160"), OC0966);
ok("pp-14 «LIBRETA/AGENDA» y «CALENDARIO» (singular, en el CFDI de F-160) casan con «AGENDAS…» y «CALENDARIOS…» (plural, en la orden): 60 y 40", de0966(r) === "60,40" && r.sinCasar.length === 0 && r.dudosos.length === 0, de0966(r) + " · sin casar " + r.sinCasar.length);
r = proponerPiezas(conceptosDe("F-166"), OC0966);
ok("pp-15 «HS HOTSSON HOTEL IRAPUATO LIBRETA» (F-166, sólo «LIBRETA») casa con P-0621 por su tipo, «LIBRETAS ENGARGOLADAS PASTA DURA»: 70 y 30", de0966(r) === "70,30" && r.sinCasar.length === 0, de0966(r));
{
  let ag = 0, ca = 0, bien = 0; const mal = [];
  for (const fol of Object.keys(HOTSSON)) {
    const x = proponerPiezas(conceptosDe(fol), OC0966), quiere = HOTSSON[fol][0][0] + "," + HOTSSON[fol][1][0];
    if (de0966(x) === quiere && !x.sinCasar.length && !x.dudosos.length) bien++; else mal.push(fol + " " + de0966(x));
    ag += x.piezas[P0621.id] || 0; ca += x.piezas[P0623.id] || 0;
  }
  ok("pp-16 las 11 de Hotsson proponen las piezas de su CFDI y entre todas cubren las dos órdenes completas (658 agendas y 426 calendarios)", bien === 11 && ag === 658 && ca === 426, `${bien} de 11 · ${ag} y ${ca}` + (mal.length ? " · " + mal.join(" | ") : ""));
}

// vuelta 3 (v10.84.109), por donde no se diseñó: el singular/plural y el tipo no casan de más
r = proponerPiezas([{ line_no: 1, cantidad: 5, valor_unitario: 122.14, descripcion: "SERVICIOS DE FLETE Y MANIOBRAS" }], OC0966);   // (no «DISEÑO»: P-0621 dice «MISMO DISEÑO» en su descripción)
ok("pp-17 un servicio del mismo precio, con palabras en plural, sigue sin casarse (no comparte ninguna con la orden)", Object.keys(r.piezas).length === 0 && r.sinCasar.length === 1, JSON.stringify(r.piezas));
const MISMO = (id, pn, product, product_type) => ({ id, production_number: pn, nombre: descripcionDeOrden({ product, product_type }), unitario: 100, disponible: 500 });
const AG_LI = [MISMO("A", "P-9001", "AGENDAS 2027", "AGENDAS"), MISMO("B", "P-9002", "LIBRETAS PROFESIONALES", "LIBRETAS")];
r = proponerPiezas([{ line_no: 1, cantidad: 10, valor_unitario: 100, descripcion: "LIBRETA / AGENDA" }], AG_LI);
const r2 = proponerPiezas([{ line_no: 1, cantidad: 10, valor_unitario: 100, descripcion: "AGENDA EJECUTIVA" }], AG_LI);
ok("pp-18 dos órdenes del mismo precio, «AGENDAS» y «LIBRETAS»: «LIBRETA / AGENDA» queda dudoso con las dos (no se adivina) y «AGENDA EJECUTIVA» cae sólo en la de agendas",
  Object.keys(r.piezas).length === 0 && r.dudosos.length === 1 && r.dudosos[0].candidatas.join(",") === "P-9001,P-9002" && r2.piezas.A === 10 && !r2.piezas.B, JSON.stringify({ d: r.dudosos, p: r2.piezas }));
r = proponerPiezas([{ line_no: 1, cantidad: 10, valor_unitario: 100, descripcion: "AGENDA" }], [MISMO("C", "P-9003", null, null)]);
ok("pp-19 una orden sin producto ni tipo: nada casa con ella (y no truena), también con descripcionDeOrden(null)", Object.keys(r.piezas).length === 0 && r.sinCasar.length === 1 && descripcionDeOrden(null) === "" && descripcionDeOrden({}) === "", JSON.stringify(r.piezas));
r = proponerPiezas([{ line_no: 1, cantidad: 300, valor_unitario: 0.14, descripcion: "STICKER REDONDO NEGRO PINO 4" }], OC0960);
ok("pp-20 «PINO» en singular cae en «… DE PINOS» (P-0592), no en «… DE PORTLAND» (P-0594) del mismo precio", r.piezas["OP-1"] === 300 && !r.piezas["OP-3"] && !r.dudosos.length, JSON.stringify(r.piezas));
const CAL = [MISMO("D", "P-9004", "CALENDARIOS 2027", "CALENDARIOS DE ESCRITORIO"), MISMO("E", "P-9005", "CALENDARIO DE PARED", "CALENDARIOS")];
r = proponerPiezas([{ line_no: 1, cantidad: 10, valor_unitario: 100, descripcion: "CALENDARIO" }], CAL);
const r3 = proponerPiezas([{ line_no: 1, cantidad: 10, valor_unitario: 100, descripcion: "CALENDARIO DE ESCRITORIO" }], CAL);
ok("pp-21 la palabra repetida en producto y tipo («CALENDARIOS … / CALENDARIOS DE ESCRITORIO») cuenta una vez: «CALENDARIO» queda dudoso entre las dos y «… DE ESCRITORIO» cae en la de escritorio",
  r.dudosos.length === 1 && r.dudosos[0].candidatas.join(",") === "P-9004,P-9005" && r3.piezas.D === 10 && !r3.piezas.E, JSON.stringify({ d: r.dudosos, p: r3.piezas }));
ok("pp-22 «palabras» no cambia (pp-11): el singular sólo cuenta al comparar", [...palabras("CALENDARIOS de escritorio")].join(" ") === "CALENDARIOS ESCRITORIO", [...palabras("CALENDARIOS de escritorio")].join(" "));

for (const x of res) console.log(x);
const fallan = res.filter(x => x.startsWith("FALLA")).length;
console.log(`\nproponer: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
