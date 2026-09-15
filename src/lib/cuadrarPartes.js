// v10.84.3 — CUADRAR EL REPARTO DE UNA ORDEN EN PARTES (piezas y dinero).
//
// Calcado del editor de conceptos de CobranzaFlow (src/lib/conceptosCfdi.js → cuadrarLineas), que
// ya resolvió el mismo problema para los renglones del CFDI. Las mismas reglas:
//   · lo dispara Karla, nunca solo: cambia piezas y dinero que van al CFDI del cliente;
//   · dos modos porque ninguno es «el bueno»:
//       'piezas'   — conserva las CANTIDADES que ella capturó; el dinero se recalcula al precio por
//                    pieza de la orden. Para el cliente que compara piezas contra su orden de compra.
//       'importes' — conserva los MONTOS que ella capturó; las piezas se recalculan en proporción.
//                    Para el cliente que concilia importes (gobierno, compras por presupuesto).
//   · el residuo (centavos, piezas sueltas) va al RESTO «por facturar» si existe —es lo que menos
//     duele mover— o, si no hay, a la parte mayor, donde el cambio de unitario es el más chico;
//   · fail-closed: si alguna parte quedaría en 0 piezas o $0, no toca nada y dice cuál;
//   · y dice exactamente qué cambió, parte por parte.
//
// v10.84.4 (scan 2) — PARTES FIJAS. Una parte marcada «¿ya existe? ligar» tiene el dinero que tiene
// LA FACTURA QUE YA EXISTE: si cuadrar se lo movía, el RPC rechazaba el enlace («no coincide») y la
// captura se perdía. Y una parte «saldo Corona» tampoco se mueve: su dinero sale de la bolsa del
// cliente, no de un reparto. Las fijas no se recalculan ni absorben residuo (flag `fijo`).
//
// Vive fuera de App.jsx para poder probarse con Node (scripts/probar-cuadrar-partes.mjs): la
// aritmética de dinero se prueba, no se confía.

const cents = (n) => Math.round((Number(n) || 0) * 100);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fmt = (n) => Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * @param {{q:number, sub:number, doc_type:string, fijo?:boolean}[]} base  piezas y SUBTOTAL (sin IVA) de cada parte
 * @param {number} totalQty      piezas de la orden
 * @param {number} totalSinIva   precio de la orden sin IVA
 * @param {'piezas'|'importes'} modo
 * @returns {{ls:object[], cambios:string[], firma:string}|{error:string}|null}
 */
export function cuadrarPartes(base, totalQty, totalSinIva, modo = "piezas") {
  if (!(totalQty > 0) || !(totalSinIva > 0) || !Array.isArray(base) || base.length === 0) return null;
  const unit = totalSinIva / totalQty;
  const b0 = base.map(x => ({ q: Math.floor(Number(x.q) || 0), sub: r2(x.sub), doc_type: x.doc_type,
                              fijo: !!x.fijo || x.doc_type === "corona_saldo" }));

  // las fijas no se recalculan
  let ls = b0.map(x => x.fijo ? { ...x } : (modo === "piezas"
    ? { ...x, sub: r2(x.q * unit) }
    : { ...x, q: Math.round(x.sub / unit) }));

  // quien absorbe el residuo: el resto; si no hay, la parte NO fija mayor; si todas son fijas, nadie
  const iResto = ls.findIndex(x => x.doc_type === "por_facturar");
  const candidatos = ls.map((x, i) => i).filter(i => !ls[i].fijo);
  const iAbs = iResto >= 0 ? iResto
             : candidatos.length ? candidatos.reduce((m, i) => (ls[i].sub > ls[m].sub ? i : m), candidatos[0]) : -1;
  const resQ = totalQty - ls.reduce((a, x) => a + x.q, 0);
  const resC = cents(totalSinIva) - ls.reduce((a, x) => a + cents(x.sub), 0);
  if ((resQ !== 0 || resC !== 0) && iAbs < 0) {
    return { error: "No hay ninguna parte que pueda absorber la diferencia: todas están fijas (ligadas o saldo Corona). Agrega una parte o ajusta a mano." };
  }
  if (iAbs >= 0) ls = ls.map((x, i) => (i === iAbs ? { ...x, q: x.q + resQ, sub: r2(x.sub + resC / 100) } : x));

  const mala = ls.findIndex(x => x.q < 1 || x.sub <= 0);
  if (mala >= 0) {
    const culpable = iAbs >= 0 && mala === iAbs && (resQ < 0 || resC < 0)
      ? ` Las otras partes se pasan del total (${resQ < 0 ? `${(-resQ).toLocaleString("es-MX")} pzas de más` : ""}${resQ < 0 && resC < 0 ? " y " : ""}${resC < 0 ? `$${fmt(-resC / 100)} de más` : ""}).`
      : "";
    return { error: `No se puede cuadrar así: la parte #${mala + 1} quedaría en ${ls[mala].q} pzas / $${fmt(ls[mala].sub)}.${culpable} Ajusta a mano o cambia de modo.` };
  }

  const cambios = [];
  ls.forEach((x, i) => {
    const b = b0[i];
    if (x.q !== b.q || cents(x.sub) !== cents(b.sub)) {
      const piezas = x.q !== b.q ? `${b.q.toLocaleString("es-MX")} → ${x.q.toLocaleString("es-MX")} pzas` : `${x.q.toLocaleString("es-MX")} pzas`;
      const dinero = cents(x.sub) !== cents(b.sub) ? `$${fmt(b.sub)} → $${fmt(x.sub)}` : `$${fmt(x.sub)}`;
      cambios.push(`#${i + 1}: ${piezas} · ${dinero}`);
    }
  });
  return { ls: ls.map(({ fijo, ...x }) => x), cambios, firma: ls.map(x => x.q + ":" + cents(x.sub)).join("|") };
}

/** true si el reparto ya cuadra: piezas exactas y dinero a un centavo (lo que exige el RPC). */
export const cuadra = (base, totalQty, totalSinIva) =>
  base.reduce((a, x) => a + (Math.floor(Number(x.q) || 0)), 0) === totalQty
  && Math.abs(base.reduce((a, x) => a + cents(x.sub), 0) - cents(totalSinIva)) <= 1;
