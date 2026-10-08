// LA SEGUNDA OPORTUNIDAD DE LAS PRUEBAS — la misma en todas las apps de SYGMA (CobranzaFlow, PrintFlow, el Cotizador y Almacén).
// Este archivo y scripts/inestables.mjs son IGUALES en los cuatro repos: si se cambian, se cambian en los cuatro. La prueba de cada repo
// compara su huella (sin los finales de línea) con la misma constante: un cambio en uno solo la pone en rojo hasta que se copie.
//
// Por qué (CobranzaFlow, 7-oct-2026, Marcelo: «prefiero tu recomendación»): el candado corre TODAS las pruebas antes de cada subida y
// una sola que falle la frena. Con cientos de pruebas, aunque cada una falle por mala suerte (el equipo cargado, un corte de red) una
// vez en mil, la mitad de las subidas se frenaría por ruido. Por eso lo que falla se repite UNA vez, y sólo eso: lo que vuelve a fallar
// frena igual que antes (un bug de verdad falla las dos veces) y lo que pasa a la segunda sale INESTABLE: cuenta como que pasa, queda
// anotado (scripts/inestables.mjs) y se revisa (tests/LEEME.md de cada repo): si era la prueba, se arregla la prueba; si es la app (dos
// cosas que chocan por tiempos), es un bug.
//
// 🔑 LOS CANDADOS (8-oct-2026, Marcelo: «sí es una mejora, aplica la misma metodología para todos los proyectos»). Lo que pasa a la
// segunda no siempre es suerte: la repetición corre con el equipo desahogado (se repite sólo lo que falló), así que lo que falla sólo
// con carga —una lentitud, un choque de tiempos, que Karla sí vive en su laptop— pasa a la segunda casi siempre. Pasó el 7-oct: 15
// pruebas de CobranzaFlow fallaron a la vez por un cambio que hacía lenta una lectura, y a la segunda pasaron. Por eso:
//   1. MÁS DE 3 DE GOLPE FRENAN: varias a la vez no son mala suerte (la red, la carga del equipo, o un cambio que hace lenta la app).
//   2. SIN SEGUNDA OPORTUNIDAD: las pruebas de doble acción (doble clic, doble toque, doble Enter) y las de dinero (lo que timbra,
//      folia o factura; cada repo dice cuáles). Ahí fallar a veces ES el bug: un doble envío que se cuela una de cada dos veces.
//   3. LA MISMA, INESTABLE OTRA VEZ, FRENA: si ya salió inestable en los últimos 14 días (revisada o no), no es suerte.
//   4. NO SE SUBE CON UNA INESTABLE SIN REVISAR (lo hace el corredor de cada repo con scripts/inestables.mjs).

// Una línea por prueba: «PASA id …» o «FALLA id … ⟦sesión⟧». Si una prueba sale dos veces y alguna falló, falló.
export function leer(salida) {
  const porPrueba = {}, detalle = {}, sesionDe = {};
  for (const linea of String(salida || '').split(/\r?\n/)) {
    const m = /^(PASA|FALLA)\s+(\S+)/.exec(linea);
    if (!m) continue;
    const [, estado, id] = m;
    if (estado === 'FALLA') {
      porPrueba[id] = 'FALLA';
      (detalle[id] ||= []).push(linea.replace(/^FALLA\s+/, ''));
      const s = /⟦([^⟧]+)⟧\s*$/.exec(linea);
      if (s) sesionDe[id] = s[1];
    } else if (!porPrueba[id]) porPrueba[id] = 'PASA';
  }
  return { porPrueba, detalle, sesionDe };
}

// Las que fallaron y SÍ se repiten (las que no tienen segunda oportunidad se quedan como están). `sinSegunda(id, texto)` dice cuáles no.
export function aRepetir(leida, sinSegunda = () => false) {
  return Object.entries(leida.porPrueba)
    .filter(([id, estado]) => estado === 'FALLA' && !sinSegunda(id, (leida.detalle[id] || []).join(' | ')))
    .map(([id]) => id).sort();
}

// Las sesiones que hay que repetir (cada una una vez) y las fallas que no dicen su sesión (ésas no se pueden repetir solas: se quedan).
// (CobranzaFlow repite por sesión: cada FALLA trae la suya entre ⟦ ⟧.)
export function queRepetir(leida, sinSegunda = () => false) {
  const sesiones = new Set();
  const sinSesion = [];
  for (const id of aRepetir(leida, sinSegunda)) {
    if (leida.sesionDe[id]) sesiones.add(leida.sesionDe[id]); else sinSesion.push(id);
  }
  return { sesiones: [...sesiones].sort(), sinSesion: sinSesion.sort() };
}

// Junta la primera corrida con la repetición. Lo que falló y en la repetición pasa queda INESTABLE (cuenta como que pasa); lo que vuelve
// a fallar, o no salió en la repetición, o no tiene segunda oportunidad, sigue fallando (con el porqué). Lo que pasó a la primera no se toca.
export function combinar(primera, segunda, sinSegunda = () => false) {
  const porPrueba = { ...primera.porPrueba };
  const detalle = { ...primera.detalle };
  const inestables = [];
  for (const [id, estado] of Object.entries(primera.porPrueba)) {
    if (estado !== 'FALLA') continue;
    if (sinSegunda(id, (primera.detalle[id] || []).join(' | '))) {
      detalle[id] = [...(detalle[id] || []), '(sin segunda oportunidad: es de doble acción o de dinero; si falla a veces, eso es el bug)'];
      continue;
    }
    const otra = segunda?.porPrueba?.[id];
    if (otra === 'PASA') { porPrueba[id] = 'PASA'; inestables.push(id); }
    else if (otra === 'FALLA') detalle[id] = [...(detalle[id] || []), ...(segunda.detalle[id] || []).map(d => `(a la segunda) ${d}`)];
  }
  return { porPrueba, detalle, inestables: inestables.sort() };
}

// ── Los candados ──
export const TOPE_DE_GOLPE = 3;
export const DIAS_PARA_REPETIDA = 14;
// Las pruebas de doble acción, por su nombre: «doble clic», «doble-toque», «doble Enter», «doble Ctrl+Enter».
export const DOBLE_ACCION = /doble[\s_-]+(clic|click|toque|enter|ctrl)/i;
// ¿Esta prueba tiene segunda oportunidad? No, si es de doble acción o si es de una tanda de dinero (cada repo da las suyas).
export function hacerSinSegunda({ tandasDeDinero = [], tanda = '', idsDeDinero = [] } = {}) {
  const deDinero = tandasDeDinero.includes(tanda);
  return (id, texto = '') => deDinero || idsDeDinero.includes(id) || DOBLE_ACCION.test(id) || DOBLE_ACCION.test(texto);
}

// Decide qué de lo que pasó a la segunda NO se acepta. `inestables`: [{clave, linea}] de esta corrida (clave = «tanda/id»);
// `historial`: las anotadas antes ([{clave, fecha, revisada}], scripts/inestables.mjs); `ahora`: Date.
// Regresa { deGolpe, repetidas: [{clave, fecha, revisada}], frenan: Set(claves), motivos: [texto] }.
export function candados({ inestables = [], historial = [], ahora = new Date(), tope = TOPE_DE_GOLPE, dias = DIAS_PARA_REPETIDA } = {}) {
  const frenan = new Set();
  const motivos = [];
  const desde = ahora.getTime() - dias * 86400000;
  const repetidas = [];
  for (const { clave } of inestables) {
    const antes = historial.filter(h => h.clave === clave && (!h.revisada || Date.parse(h.fecha) >= desde))
      .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))[0];
    if (antes) { repetidas.push({ clave, fecha: antes.fecha, revisada: antes.revisada || null }); frenan.add(clave); }
  }
  if (repetidas.length) motivos.push(`${repetidas.length === 1 ? 'una ya había salido inestable' : repetidas.length + ' ya habían salido inestables'} hace poco (${repetidas.map(r => r.clave + ', el ' + String(r.fecha).slice(0, 10) + (r.revisada ? '' : ', sin revisar')).join('; ')}): no es suerte`);
  const deGolpe = inestables.length > tope;
  if (deGolpe) {
    for (const { clave } of inestables) frenan.add(clave);
    motivos.push(`${inestables.length} pasaron a la segunda a la vez (el tope es ${tope}): eso no es mala suerte. Revisa la red, la carga del equipo o un cambio que hace lenta la app, y vuelve a correr`);
  }
  return { deGolpe, repetidas, frenan, motivos };
}
