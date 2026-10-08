// LA BITÁCORA DE LAS INESTABLES — la misma en todas las apps de SYGMA (8-oct-2026). Lo que pasa a la segunda (scripts/reintento.mjs) se
// anota aquí y se REVISA: la próxima subida no pasa mientras haya una sin revisar, y la misma prueba inestable otra vez en 14 días frena.
// Vive en la carpeta de git del repo (`git rev-parse --git-common-dir`/probar-inestables.json): fuera de git, y la misma para todas las
// copias de trabajo del repo (una subida desde otra copia no se salta lo pendiente). PROBAR_INESTABLES=<archivo> la cambia (las pruebas).
//
// Uso (desde la raíz del repo; en el Cotizador, desde app/):
//   node scripts/inestables.mjs                                  las pendientes y las de los últimos 14 días
//   node scripts/inestables.mjs revisada <id…|todas> "qué era"   las marca revisadas, con qué era y qué se hizo (la nota se pide)
//   node scripts/inestables.mjs --subida                         (el candado de git, antes de todo) sale con 1 si hay una sin revisar
// Revisar es averiguar si era la prueba o la app (tests/LEEME.md: tiempo, aislamiento, entorno, infraestructura), arreglar lo que sea, y
// entonces marcarla. Una nota corta como «ok» no se acepta: la siguiente persona tiene que entender qué pasó.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function rutaDelEstado(raiz) {
  if (process.env.PROBAR_INESTABLES) return path.resolve(process.env.PROBAR_INESTABLES);
  const comun = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: raiz, encoding: 'utf8' }).trim();
  return path.resolve(raiz, comun, 'probar-inestables.json');
}

// Sin archivo: ninguna anotada. Un archivo que no se puede leer NO es «ninguna pendiente» (dejaría subir con lo que esconde): trae
// `ilegible`, la subida se frena y nadie lo sobrescribe ni lo marca hasta que una persona lo vea.
export function cargar(ruta) {
  let texto;
  try { texto = fs.readFileSync(ruta, 'utf8'); }
  catch (e) { return e?.code === 'ENOENT' ? { entradas: [] } : { entradas: [], ilegible: `no se pudo leer ${ruta}: ${e?.message || e}` }; }
  try {
    const e = JSON.parse(texto);
    return Array.isArray(e?.entradas) ? e : { entradas: [], ilegible: `no se pudo leer ${ruta}: no trae «entradas»` };
  } catch (e) { return { entradas: [], ilegible: `no se pudo leer ${ruta}: ${e?.message || e}` }; }
}
const legible = estado => { if (estado.ilegible) throw new Error(`la bitácora de las inestables ${estado.ilegible}. Ábrela (es JSON) y arréglala, o bórrala a propósito si ya no sirve.`); return estado; };

function guardar(ruta, estado) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const tmp = ruta + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(estado, null, 1));
  fs.renameSync(tmp, ruta);
}

// Las de esta corrida: [{clave, linea, deGolpe?, repetida?}]. Nacen pendientes (sin `revisada`).
export function anotar(ruta, nuevas, ahora = new Date()) {
  if (!nuevas?.length) return;
  const estado = legible(cargar(ruta));
  for (const n of nuevas) estado.entradas.push({ clave: n.clave, linea: String(n.linea || '').slice(0, 600), fecha: ahora.toISOString(),
    ...(n.deGolpe ? { deGolpe: true } : {}), ...(n.repetida ? { repetida: true } : {}), revisada: null });
  guardar(ruta, estado);
}

export const pendientes = estado => estado.entradas.filter(e => !e.revisada);

// La clave es «tanda/id»; se puede dar sólo el id (marca la de cualquier tanda) o «todas».
const coincide = (e, pedida) => pedida === 'todas' || e.clave === pedida || e.clave.endsWith('/' + pedida);

export function revisar(ruta, pedidas, nota, ahora = new Date()) {
  const n = String(nota || '').trim();
  if (n.length < 15) throw new Error('la nota tiene que decir qué era y qué se hizo (al menos 15 letras): «era la prueba: esperaba 2 s fijos; ahora espera a que aparezca el diálogo»');
  const estado = legible(cargar(ruta));
  let marcadas = 0;
  for (const e of estado.entradas) if (!e.revisada && pedidas.some(p => coincide(e, p))) { e.revisada = { fecha: ahora.toISOString(), nota: n }; marcadas++; }
  guardar(ruta, estado);
  return marcadas;
}

// Lo que se dice antes de correr: en una subida, si hay pendientes no se corre nada (no tiene caso esperar media hora para frenar).
export function textoDePendientes(estado) {
  if (estado.ilegible) return `La bitácora de las inestables ${estado.ilegible}: no se sabe si hay pruebas inestables sin revisar.\n`
    + 'Ábrela (es JSON) y arréglala, o bórrala a propósito si ya no sirve; luego vuelve a correr.';
  const p = pendientes(estado);
  if (!p.length) return '';
  return `${p.length === 1 ? 'Hay 1 prueba inestable sin revisar' : `Hay ${p.length} pruebas inestables sin revisar`}:\n`
    + p.map(e => `  ${e.clave}  (${e.fecha.slice(0, 16).replace('T', ' ')}${e.deGolpe ? ', de golpe' : ''}${e.repetida ? ', repetida' : ''})`).join('\n')
    + '\nRevísalas (tests/LEEME.md: ¿era la prueba o la app?), arregla lo que sea, y márcalas:\n'
    + '  node scripts/inestables.mjs revisada <id|todas> "qué era y qué se hizo"';
}

// ── Como comando ──
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = process.cwd();
  const ruta = rutaDelEstado(raiz);
  const [orden, ...resto] = process.argv.slice(2);
  if (orden === 'revisada') {
    const nota = resto.pop();
    if (!resto.length) { console.error('uso: node scripts/inestables.mjs revisada <id…|todas> "qué era y qué se hizo"'); process.exit(1); }
    try {
      const n = revisar(ruta, resto, nota);
      console.log(n ? `${n} marcada${n === 1 ? '' : 's'} como revisada${n === 1 ? '' : 's'}.` : `ninguna pendiente con ${resto.join(', ')}.`);
      process.exit(n ? 0 : 1);
    } catch (e) { console.error(e.message); process.exit(1); }
  }
  const estado = cargar(ruta);
  const t = textoDePendientes(estado);
  // --subida (lo pone el candado de git ANTES de correr nada): con una pendiente, sale con 1 y no se sube
  if (orden === '--subida') { if (t) { console.log(t + '\n\ncandado: no se sube con una inestable sin revisar.'); process.exit(1); } process.exit(0); }
  const desde = Date.now() - 14 * 86400000;
  const recientes = estado.entradas.filter(e => e.revisada && Date.parse(e.fecha) >= desde);
  console.log(t || 'Ninguna inestable sin revisar.');
  if (recientes.length) console.log('\nRevisadas en los últimos 14 días (si una de éstas vuelve a salir inestable, frena):\n'
    + recientes.map(e => `  ${e.clave}  (${e.fecha.slice(0, 10)}): ${e.revisada.nota}`).join('\n'));
  process.exit(0);
}
