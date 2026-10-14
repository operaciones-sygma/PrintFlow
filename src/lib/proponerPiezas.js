// v10.84.102 — LAS PIEZAS DE UNA FACTURA QUE YA EXISTE, PROPUESTAS DESDE SU CFDI (Karla, 13-oct: F-143 y F-155 de PORTLAND cubren cada una
// un pedazo de los cuatro stickers de OC-0960, y las piezas había que copiarlas a mano de CobranzaFlow; la critique lo marcó). Los conceptos
// timbrados (public.conceptos_para_ligar_en_oc) se casan con las órdenes del plan por PRECIO UNITARIO (el mismo, a medio centavo o 1 %) y por
// las PALABRAS del nombre («STICKER REDONDO NEGRO DE PINOS 4 CM» con «STICKER #4 REDONDO NEGRO DE PINOS», no con «… DE PORTLAND»). Lo que
// no casa sin duda NO se adivina: sale en `sinCasar` o `dudosos` y Karla lo captura. Es una propuesta: el cuadre del plan contra el importe
// de la factura (±$0.02) la confirma o no. Puro, sin React: lo prueba tests/romper/proponer.mjs con Node.
const VACIAS = new Set(["DE", "DEL", "LA", "EL", "LOS", "LAS", "Y", "CON", "PARA", "EN", "A", "AL", "POR", "CM", "MM", "PZA", "PZAS", "PIEZA", "PIEZAS", "X", "NO", "N"]);
export const palabras = s => new Set(String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^A-Z0-9]+/g, " ").trim().split(/\s+/).filter(w => w && !VACIAS.has(w)));
const enComun = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n; };
export const mismoPrecio = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b > 0 && Math.abs(a - b) <= Math.max(0.005, b * 0.01);

// conceptos: [{line_no, cantidad, valor_unitario, importe, descuento, descripcion}]
// ordenes:   [{id, production_number, nombre, unitario, disponible}]
// → { piezas: {[id]: n}, casados: [{line_no, id, production_number, cantidad}], sinCasar: [concepto], dudosos: [{concepto, candidatas: [pn]}] }
export function proponerPiezas(conceptos, ordenes) {
  const piezas = {}, casados = [], sinCasar = [], dudosos = [];
  const ords = (ordenes || []).map(o => ({ ...o, _w: palabras(o.nombre) }));
  for (const c of conceptos || []) {
    const cant = Math.round(Number(c?.cantidad));
    if (!(cant > 0)) { sinCasar.push(c); continue; }
    const pal = palabras(c.descripcion), vu = Number(c.valor_unitario);
    const conPrecio = ords.filter(o => mismoPrecio(vu, Number(o.unitario)));
    const puntos = conPrecio.map(o => ({ o, n: enComun(pal, o._w) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
    if (!puntos.length) { sinCasar.push(c); continue; }
    const mejores = puntos.filter(x => x.n === puntos[0].n);
    if (mejores.length > 1) { dudosos.push({ concepto: c, candidatas: mejores.map(x => x.o.production_number) }); continue; }
    const o = puntos[0].o;
    piezas[o.id] = (piezas[o.id] || 0) + cant;
    casados.push({ line_no: c.line_no, id: o.id, production_number: o.production_number, cantidad: cant });
  }
  return { piezas, casados, sinCasar, dudosos };
}
