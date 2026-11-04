// v10.84.175 — «Tiempo por etapa» (Marcelo, 4-nov: «la etapa de validación tiene 2, Noemí y Gerardo, veo que tardan horas en aprobarla, pero no sé quién tardó» y
//   «en algunas órdenes se repite el proceso varias veces, diseño o CTP aparece varias veces, eso no lo entiendo»). Sin React para probarlo con Node contra las
//   bitácoras de producción. Reconstruye de `order_timeline` por qué etapas pasó la orden, y arregla lo que medido en 120 días estaba mal:
//   1. CADA PASO DE MÁQUINA ERA UN RENGLÓN DE LA ETAPA, SIN NOMBRE. La bitácora marca «🏭 Printmaster 52» y «🏭 Polar 115» con `to_stage` in_production, y «🏭 CTP» y
//      «🏭 Procesadora» con ctp: se pintaba «Máquina, Máquina» (295 órdenes) y «CTP, CTP, CTP» (238). Ahora es UNA etapa con sus pasos, cada uno con su nombre; lo de
//      antes del primer paso es «En fila». Una etapa que de verdad se repite (regresó y volvió) sí es otro renglón, con «2.ª vez» y la razón que se escribió al regresar.
//   2. EL DOBLE ES OTRA COSA: «Ambos validaron» escrito dos veces segundos después (41 órdenes en 120 días; App ya no lo escribe, pero la bitácora se queda): el
//      mismo destino sin máquina nueva no abre renglón.
//   3. VALIDAR LO HACEN DOS A LA VEZ, y se pintaba un solo tiempo. Cada quien cuenta desde que la orden entró a Validar hasta su «✅ Validada por…».
//   4. LO ENTREGADO SEGUÍA «EN CURSO» EN SALIDAS (508 de 120 días; 40 de maquila): la entrega no lleva `to_stage`. La orden terminada se cierra con su fecha.
//   5. LAS NOCHES CONTABAN COMO HORAS HÁBILES: lo capturado a las 18:40 y validado a las 15:08 del día siguiente decía 20 h. Las horas son de JORNADA.
//   También quién responde de cada etapa (`responsable`): el renglón de CTP decía «Noemí», la que la pasó, y de ese tiempo responde Germán.

// La jornada, medida de la bitácora (120 días, ~10,000 eventos, 3-nov): de 9:00 a 19:30, con la comida de 14:00 a 15:00 (un quinto de los movimientos de las demás
//   horas); antes de las 8:30 y después de las 20:30, ninguno; los sábados, 35 en total. En horas del día, cada tramo [desde, hasta).
export const JORNADA_TRAMOS = [[9, 14], [15, 19.5]];
export const HORAS_DE_UN_DIA = JORNADA_TRAMOS.reduce((s, [a, b]) => s + b - a, 0);

const aMs = d => new Date(d).getTime();
const alReloj = (dia, h) => new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), Math.floor(h), Math.round((h % 1) * 60)).getTime();

export function msDeJornada(a, b) {
  const ini = aMs(a), fin = aMs(b);
  if (!(fin > ini)) return 0;
  let ms = 0, tope = 0;
  const dia = new Date(ini); dia.setHours(0, 0, 0, 0);
  while (dia.getTime() < fin && tope++ < 3660) {
    const dow = dia.getDay();
    if (dow !== 0 && dow !== 6) for (const [de, hasta] of JORNADA_TRAMOS) {
      const s = Math.max(ini, alReloj(dia, de)), e = Math.min(fin, alReloj(dia, hasta));
      if (e > s) ms += e - s;
    }
    dia.setDate(dia.getDate() + 1);
  }
  return ms;
}

// horas de jornada entre a y b, sin las ventanas de pausa «En espera»
export function horasDeJornada(a, b, pausas) {
  let ms = msDeJornada(a, b);
  (pausas || []).forEach(p => { const s = Math.max(aMs(a), aMs(p.start)), e = Math.min(aMs(b), aMs(p.end)); if (e > s) ms -= msDeJornada(s, e); });
  return Math.max(0, ms) / 3600000;
}

// «<1m», «14m», «2.3h», «2d 5h»: un día son las horas de una jornada
export function duracion(h) {
  if (h == null) return "—";
  const m = Math.round(h * 60);
  if (m < 1) return "<1m";
  if (m < 60) return m + "m";
  if (h < HORAS_DE_UN_DIA) return h.toFixed(1) + "h";
  const d = Math.floor(h / HORAS_DE_UN_DIA), r = Math.round(h - d * HORAS_DE_UN_DIA);
  return d + "d" + (r ? " " + r + "h" : "");
}

const ES_FINAL = s => /delivered|cancelled|stocked|maq_delivered|maq_cancelled|web_rejected/.test(s || "");
const VALIDADORES = [
  { rol: "preprensa", bandera: "validated_by_preprensa", patron: /Validada por Pre-prensa/ },
  { rol: "produccion", bandera: "validated_by_production", patron: /Validada por Producci[oó]n/ },
];
// a qué etapa lleva: hasta junio algunas «Ambos validaron» se escribieron sin `to_stage` (y la «(auto)» hasta v10.84.175): se lee de su texto
const aDonde = t => t.to || (/Ambos validaron/.test(t.action || "") ? (/Lista/.test(t.action) ? "ready" : "design") : undefined);
// «🏭 Printmaster 52 (turno 5)» → la máquina y su turno; «🏭 📦 Empaque» es la misma etapa, no un paso
const maquinaDe = t => {
  const m = /^🏭\s*(.+)$/su.exec(String(t.action || "").trim());
  if (!m) return { maquina: null, turno: null };
  const conTurno = /\s*\((?:turno|cola)\s*#?\s*(\d+)\)\s*$/i.exec(m[1]);   // «(turno 5)» y, hasta septiembre, «(cola #2)»
  const nombre = (conTurno ? m[1].slice(0, conTurno.index) : m[1]).replace(/^[^\p{L}\p{N}]+/u, "").trim();
  return { maquina: !nombre || /^empaque$/i.test(nombre) ? null : nombre, turno: conTurno ? Number(conTurno[1]) : null };
};

// `ahora`: ISO · `topePausa`: hasta cuándo corre una pausa todavía abierta (ISO o null) · `secuencia`: el orden de las etapas, para saber qué es regresar ·
// `responsable(etapa)`: quién responde de ella · `persona(quien)`: su nombre, de lo que la bitácora guarda (rol o usuario).
// Devuelve { bloques, regs }. Cada bloque: stage, at, by, responsable, hours, vez, isReg, razon, current, endpoint, inicial, pasos[{ etiqueta, maquina, turno, at, by, hours, current }]
// y, en Validar, validaciones[{ rol, quien, por, at, hours, falta, sinHora, noValido, pasoPor, ultima }].
export function tiempoPorEtapa(o, { ahora, topePausa = null, secuencia = [], responsable = () => null, persona = x => x } = {}) {
  const tl = (o?.timeline || []).filter(t => t?.date && !isNaN(aMs(t.date))).slice().sort((a, b) => aMs(a.date) - aMs(b.date));
  // ventana de pausa: desde «🔕 En espera» hasta el primer evento posterior que sea «🔔 Reactivada» o una transición real (los neutros —edición, merma, precio— no la
  //   cortan); si sigue abierta cierra en `topePausa` (si ya pasó) o ahora.
  const pausas = [];
  tl.forEach((t, i) => {
    if (!/En espera/i.test(t.action || "")) return;
    let fin = null;
    for (let j = i + 1; j < tl.length; j++) if (/Reactivada|En espera/i.test(tl[j].action || "") || tl[j].to) { fin = tl[j].date; break; }
    if (!fin) { fin = ahora; if (topePausa && aMs(topePausa) < aMs(fin)) fin = topePausa; }
    if (aMs(fin) < aMs(t.date)) fin = t.date;
    pausas.push({ start: t.date, end: fin });
  });
  // «📋 Orden creada» ya trae la etapa inicial y quién: no es una transición
  const creada = tl.find(t => /Orden creada/i.test(t.action || ""));
  const trans = tl.filter(t => aDonde(t) && !/Orden creada/i.test(t.action || ""));
  const idx = s => secuencia.indexOf(s);
  const bloques = [];
  const nuevo = (stage, at, by, extra = {}) => { const p = bloques.length ? bloques[bloques.length - 1].stage : null;
    const isReg = !!extra.regreso || (!!p && idx(stage) >= 0 && idx(p) >= 0 && idx(stage) < idx(p));
    bloques.push({ stage, at, by, isReg, razon: extra.razon || null, inicial: !!extra.inicial, vez: bloques.filter(b => b.stage === stage).length + 1,
      responsable: stage === "draft" || ES_FINAL(stage) ? null : responsable(stage) || null,
      pasos: [{ maquina: extra.maquina || null, turno: extra.turno ?? null, at, by }] }); };
  if (!trans.length) {
    // sin transiciones: sigue en su etapa. La que nació terminada (la venta de inventario) no tiene etapas que contar; la que se canceló sin moverse sí (P-0628, en Validar)
    const donde = ES_FINAL(o?.stage) ? creada?.to : o?.stage;
    if (o?.created_at && donde && !ES_FINAL(donde)) nuevo(donde, o.created_at, creada?.by || o.created_by, { inicial: true });
  } else {
    const inicial = creada?.to || (o.order_type === "maquila" ? "maq_created" : "draft");
    if (o.created_at && aMs(o.created_at) < aMs(trans[0].date)) nuevo(inicial, o.created_at, creada?.by || o.created_by, { inicial: true });
    trans.forEach(t => {
      const stage = aDonde(t), { maquina, turno } = maquinaDe(t), ult = bloques[bloques.length - 1];
      if (ult && ult.stage === stage) {   // la misma etapa: un paso nuevo si es otra máquina; si no, nada (el doble de la bitácora, o un cambio de turno en la misma máquina)
        if (maquina && maquina !== ult.pasos[ult.pasos.length - 1].maquina) ult.pasos.push({ maquina, turno, at: t.date, by: t.by });
        return;
      }
      nuevo(stage, t.date, t.by, { maquina, turno, regreso: /^↩️/.test(t.action || ""), razon: (/Razón:\s*(.+)$/su.exec(t.action || "") || [])[1]?.trim() });
    });
  }
  // la orden terminada se cierra con su fecha: la entrega y la cancelación no llevan `to_stage`
  let cierre = null, porCierre = null;
  const ultimo = bloques[bloques.length - 1];
  if (ultimo && ES_FINAL(o.stage) && !ES_FINAL(ultimo.stage)) {
    const ev = [...tl].reverse().find(t => /Entregada|ligada a esta orden|Cancelad|Rechazad/i.test(t.action || ""));
    const fechas = /cancel|reject/.test(o.stage) ? [o.cancelled_at, o.delivered_at] : [o.delivered_at, o.cancelled_at];
    cierre = fechas[0] || fechas[1] || ev?.date || tl[tl.length - 1]?.date || ultimo.at;
    if (aMs(cierre) < aMs(ultimo.at)) cierre = ultimo.at;
    porCierre = ev?.by || null;
  }
  const horas = (a, b) => horasDeJornada(a, b, pausas);
  bloques.forEach((b, i) => {
    const esUltimo = i === bloques.length - 1;
    b.endpoint = esUltimo && ES_FINAL(b.stage);
    const fin = esUltimo ? (b.endpoint ? b.at : (cierre || ahora)) : bloques[i + 1].at;
    b.current = esUltimo && !b.endpoint && !cierre && o.stage === b.stage;
    b.hours = horas(b.at, fin);
    b.pasos.forEach((p, j) => { const ultPaso = j === b.pasos.length - 1;
      p.hours = horas(p.at, ultPaso ? fin : b.pasos[j + 1].at);
      p.current = b.current && ultPaso;
      p.etiqueta = p.maquina || (b.pasos.length > 1 ? "En fila" : null); });
    if (b.stage !== "draft") return;
    const salio = esUltimo ? null : trans.find(t => aMs(t.date) === aMs(fin) && aDonde(t) === bloques[i + 1].stage);
    b.validaciones = VALIDADORES.map(v => {
      const ev = tl.find(t => v.patron.test(t.action || "") && aMs(t.date) >= aMs(b.at) && aMs(t.date) <= aMs(fin));
      const quien = persona(v.rol);
      if (ev) { const firma = persona(ev.by); return { rol: v.rol, quien, por: firma && firma !== quien ? firma : null, at: ev.date, hours: horas(b.at, ev.date) }; }
      if (b.current) return o[v.bandera] ? { rol: v.rol, quien, sinHora: true } : { rol: v.rol, quien, falta: true, hours: b.hours };
      // salió sin ese «✅ Validada por…»: sólo «📝 Validar → …» es que alguien la pasó sin esa validación. «Ambos validaron» dice que validó, y «🎨 Diseño → 💿 CTP» que ya iba en
      //   Diseño (P-0544, P-0540 y 6 más, de septiembre: la bitácora perdió ese paso). En los dos no se inventa un tiempo; sin salida es que se canceló en Validar.
      if (salio && !/^📝\s*Validar/.test(salio.action || "")) return { rol: v.rol, quien, sinHora: true };
      return { rol: v.rol, quien, noValido: true, pasoPor: salio ? persona(salio.by) : null };
    }).sort((x, y) => (x.at ? aMs(x.at) : Infinity) - (y.at ? aMs(y.at) : Infinity));
    // quién la detuvo: el que llegó al último (o el que falta), si son dos con tiempo y no es el mismo
    const conTiempo = b.validaciones.filter(v => v.hours != null);
    if (conTiempo.length === 2 && conTiempo[0].hours !== conTiempo[1].hours) (conTiempo[0].hours > conTiempo[1].hours ? conTiempo[0] : conTiempo[1]).ultima = true;
  });
  if (cierre) bloques.push({ stage: o.stage, at: cierre, by: porCierre, endpoint: true, current: false, isReg: false, razon: null, inicial: false, vez: 1, responsable: null, hours: null, pasos: [] });
  return { bloques, regs: bloques.filter(b => b.isReg).length };
}
