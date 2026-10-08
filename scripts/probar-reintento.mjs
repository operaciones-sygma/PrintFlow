// Prueba de la segunda oportunidad y sus candados (scripts/reintento.mjs y scripts/inestables.mjs), IGUAL en las cuatro apps de SYGMA.
// Cada caso afirma lo que debe pasar para quien sube: lo que falla de verdad frena; lo que pasa a la segunda sale INESTABLE y se revisa;
// y los candados del 8-oct (más de 3 de golpe, doble acción y dinero sin segunda, la misma otra vez, no subir sin revisar).
// Uso: node scripts/probar-reintento.mjs   (una línea PASA/FALLA por caso; sale con 1 si alguno falla)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { leer, aRepetir, queRepetir, combinar, hacerSinSegunda, candados, TOPE_DE_GOLPE } from './reintento.mjs';
import { cargar, anotar, pendientes, revisar, textoDePendientes } from './inestables.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
// La huella de los dos módulos (sin finales de línea): la misma en los cuatro repos. Si cambias uno, cópialo a los cuatro y pon aquí la
// huella nueva en los cuatro (la prueba rei-14 dice cuál salió).
const HUELLA = '65560ec85d7debe1';
const res = [];
const ok = (id, cond, desc, detalle = '') => res.push(`${cond ? 'PASA ' : 'FALLA'} ${id} ${desc}${cond ? '' : '  · ' + detalle}`);
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const PRIMERA = [
  'PASA  cob-01 anotar dice a quién',
  'FALLA cob-57 si la primera carga falla  · tardó  ⟦karla-1366⟧',
  'FALLA cob-58 otra de la misma sesión  ⟦karla-1366⟧',
  'FALLA ses-04 «Salir» en una pestaña (la prueba se cayó)  ⟦ses-otra⟧',
  'FALLA cob-99 una falla que no dice su sesión',
  'FALLA cob-117 un doble clic en el botón de cobro prepara UN cobro  ⟦doble⟧',
  'FALLA tab-13-doble-clic-en-empaque  · 2 veces',
  'FALLA cob-102 «Cobranza» se dice una vez  ⟦titulos⟧',
  'basura que no es una prueba',
].join('\n');
const SEGUNDA = ['PASA  cob-57 si la primera carga falla', 'FALLA cob-58 otra vez  ⟦karla-1366⟧', 'PASA  ses-04 «Salir»', 'PASA  cob-117 ya pasó',
  'PASA  tab-13-doble-clic-en-empaque', 'PASA  cob-102 «Cobranza» se dice una vez'].join('\r\n');
const a = leer(PRIMERA), b = leer(SEGUNDA);
const sinSegunda = hacerSinSegunda({ tanda: 'cobranza' });

// ── lo de siempre (7-oct) ──
ok('rei-01', a.porPrueba['cob-01'] === 'PASA' && a.porPrueba['cob-57'] === 'FALLA' && a.sesionDe['cob-57'] === 'karla-1366' && !a.porPrueba.basura,
  'lee cada prueba, su estado y su sesión', JSON.stringify(a.porPrueba));
const c = combinar(a, b, sinSegunda);
ok('rei-02', c.porPrueba['cob-57'] === 'PASA' && c.inestables.includes('cob-57') && c.inestables.includes('ses-04') && c.inestables.includes('cob-102'),
  'lo que pasa a la segunda queda INESTABLE y cuenta como que pasa (también «se dice una vez», que no es de doble acción)', JSON.stringify(c.inestables));
ok('rei-03', c.porPrueba['cob-58'] === 'FALLA' && (c.detalle['cob-58'] || []).some(d => /a la segunda/.test(d)), 'lo que vuelve a fallar frena, con el detalle de las dos veces', JSON.stringify(c.detalle['cob-58']));
ok('rei-04', c.porPrueba['cob-99'] === 'FALLA', 'lo que no salió en la repetición sigue fallando', c.porPrueba['cob-99']);
ok('rei-15', igual(leer('').porPrueba, {}) && queRepetir(leer('PASA  x uno')).sesiones.length === 0 && leer('PASA  x uno\nFALLA x otra  ⟦s⟧').porPrueba.x === 'FALLA',
  'sin fallas nada se repite; una prueba que sale dos veces y falló una, falló', '');
// (los casos de la prueba del 7-oct de CobranzaFlow que no estaban arriba: las pruebas crecen, no se reescriben)
const q0 = queRepetir(a);
ok('rei-16', q0.sesiones.join(',') === 'doble,karla-1366,ses-otra,titulos', 'repite cada sesión una vez, sin repetir nombres (dos fallas de la misma sesión: una vez)', q0.sesiones.join(','));
ok('rei-17', q0.sinSesion.join(',') === 'cob-99,tab-13-doble-clic-en-empaque', 'la falla que no dice su sesión no se puede repetir sola (y se dice)', q0.sinSesion.join(','));
ok('rei-18', c.porPrueba['cob-01'] === 'PASA' && !c.inestables.includes('cob-01'), 'lo que pasó a la primera no se toca', JSON.stringify(c.porPrueba['cob-01']));
ok('rei-19', igual(combinar(a, null).porPrueba, a.porPrueba) && combinar(a, null).inestables.length === 0, 'sin repetición (la tanda no corrió), todo queda como estaba', '');

// ── candado 2: doble acción y dinero, sin segunda oportunidad ──
ok('rei-05', c.porPrueba['cob-117'] === 'FALLA' && c.porPrueba['tab-13-doble-clic-en-empaque'] === 'FALLA' && !c.inestables.includes('cob-117')
  && (c.detalle['cob-117'] || []).some(d => /sin segunda oportunidad/.test(d)),
  'una prueba de doble clic que pasa a la segunda FRENA, y dice por qué', JSON.stringify({ e: c.porPrueba['cob-117'], d: c.detalle['cob-117'] }));
const q = queRepetir(a, sinSegunda), rep = aRepetir(a, sinSegunda);
ok('rei-06', !q.sesiones.includes('doble') && q.sesiones.includes('titulos') && !rep.includes('tab-13-doble-clic-en-empaque') && rep.includes('cob-57'),
  'lo de doble acción ni se repite (con espacios o con guiones); lo demás sí', JSON.stringify({ q, rep }));
ok('rei-07', ['doble clic', 'doble-toque', 'Doble Enter', 'doble Ctrl+Enter', 'doble_click'].every(t => sinSegunda('x', t))
  && !['se dice una vez', 'no dice dos veces lo mismo', 'dos máquinas a la vez', 'doblez de la caja'].some(t => sinSegunda('x', t)),
  'reconoce doble clic/toque/Enter/Ctrl+Enter y no confunde «una vez», «dos veces» ni «doblez»', '');
const dinero = hacerSinSegunda({ tandasDeDinero: ['timbrar', 'folio'], tanda: 'folio' }), otra = hacerSinSegunda({ tandasDeDinero: ['timbrar', 'folio'], tanda: 'tablero' });
ok('rei-08', dinero('inv-03', 'cualquier cosa') && !otra('tab-03', 'cualquier cosa') && hacerSinSegunda({ idsDeDinero: ['cob-500'] })('cob-500', ''),
  'una tanda de dinero (o una prueba de dinero dada por id) no tiene segunda oportunidad; las demás sí', '');

// ── candados 1 y 3: de golpe, y la misma otra vez ──
const ahora = new Date('2026-10-08T12:00:00Z');
const tres = ['t/a', 't/b', 't/c'].map(clave => ({ clave })), cuatro = [...tres, { clave: 't/d' }];
const k3 = candados({ inestables: tres, historial: [], ahora }), k4 = candados({ inestables: cuatro, historial: [], ahora });
ok('rei-09', TOPE_DE_GOLPE === 3 && !k3.deGolpe && k3.frenan.size === 0 && k4.deGolpe && k4.frenan.size === 4 && /4 pasaron a la segunda a la vez/.test(k4.motivos.join(' ')),
  'hasta 3 inestables pasan; 4 de golpe frenan las 4 y dicen por qué', JSON.stringify({ k3: [...k3.frenan], k4: [...k4.frenan], m: k4.motivos }));
const hist = [
  { clave: 't/reciente-revisada', fecha: '2026-10-01T10:00:00Z', revisada: { nota: 'era la prueba' } },
  { clave: 't/vieja-revisada', fecha: '2026-09-01T10:00:00Z', revisada: { nota: 'era la red' } },
  { clave: 't/vieja-sin-revisar', fecha: '2026-08-01T10:00:00Z', revisada: null },
];
// (con el tope alto: aquí se prueba «la misma otra vez», no «de golpe», que con 4 ya frenaría todas)
const kr = candados({ inestables: ['t/reciente-revisada', 't/vieja-revisada', 't/vieja-sin-revisar', 't/nueva'].map(clave => ({ clave })), historial: hist, ahora, tope: 99 });
ok('rei-10', kr.frenan.has('t/reciente-revisada') && !kr.frenan.has('t/vieja-revisada') && kr.frenan.has('t/vieja-sin-revisar') && !kr.frenan.has('t/nueva') && !kr.deGolpe,
  'la misma inestable otra vez en 14 días frena (revisada o no) y una sin revisar frena aunque sea vieja; pasados 14 días y revisada, no', JSON.stringify([...kr.frenan]));

// ── candado 4: la bitácora, y no subir sin revisar ──
const tmp = path.join(os.tmpdir(), `probar-inestables-${process.pid}-${Date.now()}.json`);
try {
  anotar(tmp, [{ clave: 'cobranza/cob-57', linea: 'FALLA cob-57 …' }, { clave: 'tablero/tab-13', linea: 'x', deGolpe: true }], ahora);
  const e1 = cargar(tmp);
  ok('rei-11', pendientes(e1).length === 2 && e1.entradas.every(x => x.revisada === null && x.fecha === ahora.toISOString()) && e1.entradas[1].deGolpe === true,
    'lo anotado nace pendiente, con su fecha', JSON.stringify(e1));
  let corta = '';
  try { revisar(tmp, ['cob-57'], 'ok'); } catch (e) { corta = e.message; }
  const n1 = revisar(tmp, ['cob-57'], 'era la prueba: esperaba 2 s fijos; ahora espera al diálogo');
  const e2 = cargar(tmp);
  ok('rei-12', /15 letras/.test(corta) && n1 === 1 && pendientes(e2).length === 1 && pendientes(e2)[0].clave === 'tablero/tab-13' && /tablero\/tab-13/.test(textoDePendientes(e2)) && /inestables\.mjs revisada/.test(textoDePendientes(e2)),
    'revisar pide una nota de verdad, se puede con el id solo, y lo pendiente se lista con cómo marcarlo', JSON.stringify({ corta, n1, p: pendientes(e2).map(x => x.clave) }));
  // el comando, como lo escribe una persona
  const cmd = args => spawnSync(process.execPath, [path.join(AQUI, 'inestables.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, PROBAR_INESTABLES: tmp } });
  const sinNota = cmd(['revisada', 'todas', 'ok']), lista = cmd([]), subidaCon = cmd(['--subida']), conNota = cmd(['revisada', 'todas', 'eran 4 de golpe: se cayó la red a las 11:58 (sin logins en edge_logs)']);
  const subidaSin = cmd(['--subida']);
  const e3 = cargar(tmp);
  ok('rei-13', sinNota.status === 1 && lista.status === 0 && /tablero\/tab-13/.test(lista.stdout) && conNota.status === 0 && pendientes(e3).length === 0 && textoDePendientes(e3) === '',
    'el comando: sin nota no marca; la lista enseña lo pendiente; «todas» con nota las marca', JSON.stringify({ s: sinNota.status, l: lista.stdout.slice(0, 80), c: conNota.stdout }));
  ok('rei-20', subidaCon.status === 1 && /no se sube/.test(subidaCon.stdout) && subidaSin.status === 0,
    'el candado (--subida): con una pendiente frena antes de correr nada; ya revisadas, deja pasar', JSON.stringify({ con: subidaCon.status, sin: subidaSin.status }));
  // (vuelta 2) una bitácora que no se puede leer NO es «ninguna pendiente»: frena, y nadie la sobrescribe ni la marca a ciegas
  fs.writeFileSync(tmp, '{"entradas": [ {"clave": "cobranza/cob-57", "revi');
  const rota = cargar(tmp);
  let anotoEnRota = 'no lanzó', revisoEnRota = 'no lanzó';
  try { anotar(tmp, [{ clave: 'x/y', linea: 'z' }], ahora); } catch (e) { anotoEnRota = e.message; }
  try { revisar(tmp, ['todas'], 'una nota suficientemente larga para pasar'); } catch (e) { revisoEnRota = e.message; }
  const subidaRota = cmd(['--subida']);
  ok('rei-21', !!rota.ilegible && /no se pudo leer/.test(textoDePendientes(rota)) && /no se pudo leer/.test(anotoEnRota) && /no se pudo leer/.test(revisoEnRota)
    && fs.readFileSync(tmp, 'utf8').startsWith('{"entradas": [ {"clave": "cobranza/cob-57"') && subidaRota.status === 1,
    'una bitácora que no se puede leer frena la subida (no cuenta como vacía) y no se sobrescribe ni se marca', JSON.stringify({ ilegible: rota.ilegible, anotoEnRota, revisoEnRota, subida: subidaRota.status }));
} finally { fs.rmSync(tmp, { force: true }); fs.rmSync(tmp + '.tmp', { force: true }); }

// ── la misma en los cuatro repos ──
const sinCR = f => fs.readFileSync(path.join(AQUI, f), 'utf8').replace(/\r\n/g, '\n');
const huella = crypto.createHash('sha256').update(sinCR('reintento.mjs') + '\n---\n' + sinCR('inestables.mjs')).digest('hex').slice(0, 16);
ok('rei-14', huella === HUELLA, 'reintento.mjs e inestables.mjs son los mismos que en las otras apps (su huella)', `salió ${huella}; si los cambiaste a propósito, cópialos a los cuatro repos y pon esa huella en los cuatro`);

for (const r of res) console.log(r);
const mal = res.filter(r => r.startsWith('FALLA')).length;
console.log(mal ? `\n${mal} de ${res.length} mal` : `\n✅ ${res.length} casos en verde`);
process.exit(mal ? 1 : 0);
