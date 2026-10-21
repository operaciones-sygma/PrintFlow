// v10.84.119 — La geometría del plano de la planta (la vista «Planta»: Gerardo acomoda las máquinas de la planta baja). Todo en CENTÍMETROS
//   y el giro en GRADOS, positivo a la derecha (como las manecillas: en la pantalla la «y» crece hacia abajo). Sin React ni la base, para que la
//   pantalla, la hoja impresa y las pruebas (tests/romper/plano.mjs, también con Node) midan igual.

export const IMAN = 5;              // cm: lo que avanza una pieza al arrastrarla o con las flechas
export const PASO_LARGO = 50;       // cm: con Shift
export const MEDIDA_MAX = 5000;     // cm (50 m): más que la planta entera; arriba de eso es un dedazo
export const NOMBRE_MAX = 40;       // el nombre de una máquina u objeto
export const VERSION_MAX = 80;      // el nombre de una versión (la base lo vuelve a revisar)
export const PIEZAS_MAX = 500;      // por versión (la base también)
const TOQUE = 0.5;                  // cm: dos cosas que se tocan lado con lado no se enciman

const rad = g => g * Math.PI / 180;
export const redondear = (v, d = 1) => { const f = 10 ** d; const r = Math.round(v * f) / f; return r === 0 ? 0 : r; };
const finito = v => typeof v === "number" && Number.isFinite(v);

// El giro entre -180 (sin incluirlo) y 180: 270 es -90, 360 es 0, y sin los 359.99 de las sumas
export function normalizarGiro(g) {
  let x = redondear(Number(g) || 0, 1) % 360;
  if (x > 180) x -= 360;
  if (x <= -180) x += 360;
  return redondear(x, 1);
}
export const conIman = (v, paso = IMAN) => redondear(Math.round(v / paso) * paso, 1);

// ── el contorno ──
// El de la pieza sin girar, alrededor de su centro: el rectángulo largo × ancho, o su forma (la dobladora y el tren son una «L»)
export function contornoLocal(p) {
  if (Array.isArray(p.forma) && p.forma.length >= 3) return p.forma.map(([x, y]) => [x, y]);
  const a = p.largo / 2, b = p.ancho / 2;
  return [[-a, -b], [a, -b], [a, b], [-a, b]];
}
// …y ya girado y en su lugar
export function esquinas(p) {
  const c = Math.cos(rad(p.giro || 0)), s = Math.sin(rad(p.giro || 0));
  return contornoLocal(p).map(([x, y]) => [p.x + x * c - y * s, p.y + x * s + y * c]);
}
export function caja(puntos) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of puntos) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, ancho: x1 - x0, alto: y1 - y0 };
}
export const cajaDe = p => caja(esquinas(p));
export function juntarCajas(cajas) {
  const v = cajas.filter(Boolean);
  if (!v.length) return null;
  return caja(v.flatMap(c => [[c.x0, c.y0], [c.x1, c.y1]]));
}
// Dónde va el nombre: el centro, o en una «L», donde más cabe un letrero acostado (el centro de su caja cae en el hueco, y el punto más
//   hondo, en la esquina de la «L»): lo que hay a los lados cuenta completo y lo que hay arriba y abajo, dos veces y media (un letrero es
//   más ancho que alto); entre los que dan igual, el más hondo (el centro de esa parte)
export function dentroDe([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// lo que hay desde q hasta la orilla, hacia los dos lados de una dirección (el menor de los dos)
function holgura([x, y], poly, horizontal) {
  let menos = Infinity, mas = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = horizontal ? poly[j] : [poly[j][1], poly[j][0]], [bx, by] = horizontal ? poly[i] : [poly[i][1], poly[i][0]];
    const [qx, qy] = horizontal ? [x, y] : [y, x];
    if ((ay > qy) === (by > qy)) continue;
    const cx = ax + (qy - ay) * (bx - ax) / (by - ay);
    if (cx < qx) menos = Math.min(menos, qx - cx); else mas = Math.min(mas, cx - qx);
  }
  return Math.min(menos, mas);
}
export function puntoDelNombre(p) {
  if (!Array.isArray(p.forma) || p.forma.length < 4) return [p.x, p.y];
  const loc = p.forma, cj = caja(loc), N = 30;
  let mejor = [0, 0], cabe = -1;
  for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) {
    const q = [cj.x0 + cj.ancho * i / N, cj.y0 + cj.alto * j / N];
    if (!dentroDe(q, loc)) continue;
    const h = holgura(q, loc, true), v = holgura(q, loc, false), d = Math.min(h, 2.5 * v) + 0.01 * Math.min(h, v) + 0.0001 * (h + v);
    if (d > cabe) { cabe = d; mejor = q; }
  }
  const cg = Math.cos(rad(p.giro || 0)), sg = Math.sin(rad(p.giro || 0));
  return [p.x + mejor[0] * cg - mejor[1] * sg, p.y + mejor[0] * sg + mejor[1] * cg];
}
// v10.84.164 — un nombre en dos renglones, por el espacio que deja más corto el renglón más largo («Manual 1» → «Manual» / «1»; sin espacio, null):
//   para los letreros que, ya en lo más chico, todavía chocan con otro. Lo usan la pantalla y la hoja impresa (las dos manuales, a 30 cm).
export function partirNombre(nombre) {
  let mejor = null;
  for (let i = nombre.indexOf(" "); i > 0; i = nombre.indexOf(" ", i + 1)) {
    const partes = [nombre.slice(0, i).trim(), nombre.slice(i + 1).trim()];
    if (partes.every(Boolean) && (!mejor || Math.max(...partes.map(t => t.length)) < Math.max(...mejor.map(t => t.length)))) mejor = partes;
  }
  return mejor;
}

// Los nombres de las áreas que NO tapa una pieza (vuelta 4: el que quedaba debajo de una máquina se asomaba a medias, «Duplo e» de «Diseño»).
//   `alto`: el de la letra, en cm del dibujo (en la pantalla cambia con el zoom; en la hoja, con la escala). `letreros`: las cajas [x0, y0, x1, y1]
//   en cm de los letreros de las máquinas, que también tapan (el «Almacén» de adentro lo cortaba el letrero de la Guillotina 78)
export function areasLibres(areas, piezas, alto, letreros = []) {
  const cajas = [...piezas.map(cajaDe), ...letreros.map(([x0, y0, x1, y1]) => ({ x0, y0, x1, y1 }))];
  return areas.filter(a => {
    const c = { x0: a.x, y0: a.y - alto, x1: a.x + String(a.t).length * 0.55 * alto, y1: a.y + 0.25 * alto };
    return !cajas.some(k => k.x0 < c.x1 && c.x0 < k.x1 && k.y0 < c.y1 && c.y0 < k.y1);
  });
}

// ── encimadas y choques ──
const area2 = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return a; };
const cruz = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function enTriangulo(p, a, b, c) {
  const d1 = cruz(a, b, p), d2 = cruz(b, c, p), d3 = cruz(c, a, p);
  return (d1 > 1e-9 && d2 > 1e-9 && d3 > 1e-9) || (d1 < -1e-9 && d2 < -1e-9 && d3 < -1e-9);
}
// sin puntos repetidos ni los que quedan en medio de un lado recto
function limpiar(pts) {
  let v = pts.filter((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6; });
  let otra = true;
  while (otra && v.length > 3) {
    otra = false;
    for (let i = 0; i < v.length; i++) {
      const a = v[(i + v.length - 1) % v.length], b = v[i], c = v[(i + 1) % v.length];
      if (Math.abs(cruz(a, b, c)) < 1e-6 * Math.max(1, Math.hypot(c[0] - a[0], c[1] - a[1]))) { v = v.filter((_, k) => k !== i); otra = true; break; }
    }
  }
  return v;
}
function esConvexo(v) {
  let signo = 0;
  for (let i = 0; i < v.length; i++) {
    const z = cruz(v[i], v[(i + 1) % v.length], v[(i + 2) % v.length]);
    if (Math.abs(z) < 1e-9) continue;
    if (!signo) signo = Math.sign(z); else if (Math.sign(z) !== signo) return false;
  }
  return true;
}
// Un contorno en partes convexas (orejas): la «L» queda en triángulos; un rectángulo, entero
export function triangulos(pts) {
  let v = limpiar(pts);
  if (v.length <= 3 || esConvexo(v)) return [v];
  const ccw = area2(v) > 0;
  const out = [];
  for (let vueltas = 0; v.length > 3 && vueltas < 200; vueltas++) {
    let corto = -1;
    for (let i = 0; i < v.length && corto < 0; i++) {
      const a = v[(i + v.length - 1) % v.length], b = v[i], c = v[(i + 1) % v.length];
      const z = cruz(a, b, c);
      if (ccw ? z <= 1e-9 : z >= -1e-9) continue;   // esquina hacia adentro: no es oreja
      if (v.some(p => p !== a && p !== b && p !== c && enTriangulo(p, a, b, c))) continue;
      out.push([a, b, c]); corto = i;
    }
    if (corto < 0) break;   // (un contorno que se cruza a sí mismo: lo que quede va como está)
    v = v.filter((_, k) => k !== corto);
  }
  out.push(v);
  return out;
}
export const partesDe = p => triangulos(esquinas(p));

// Separación por ejes: dos figuras convexas (o una figura y un segmento) NO se enciman si en algún eje sus sombras se tocan apenas o no se tocan
function separados(A, B, holgura) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
      let nx = y1 - y2, ny = x2 - x1; const L = Math.hypot(nx, ny);
      if (L < 1e-9) continue;
      nx /= L; ny /= L;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const [x, y] of A) { const d = x * nx + y * ny; if (d < a0) a0 = d; if (d > a1) a1 = d; }
      for (const [x, y] of B) { const d = x * nx + y * ny; if (d < b0) b0 = d; if (d > b1) b1 = d; }
      if (a1 <= b0 + holgura || b1 <= a0 + holgura) return true;
    }
  }
  return false;
}
const cajasLejos = (a, b, h = TOQUE) => a.x1 <= b.x0 + h || b.x1 <= a.x0 + h || a.y1 <= b.y0 + h || b.y1 <= a.y0 + h;
const prepara = p => ({ p, partes: partesDe(p), cj: cajaDe(p) });
const seTocan = (A, B) => !cajasLejos(A.cj, B.cj) && A.partes.some(a => B.partes.some(b => !separados(a, b, TOQUE)));
export const seEnciman = (a, b) => seTocan(prepara(a), prepara(b));

// Lo fijo que estorba, como segmentos: los muros (y columnas, ventanas y las divisiones de Diseño) y lo fijo (escaleras, baños, cisterna).
//   Las puertas no: su abanico es el paso, no un muro.
export function segmentosDe(trazos, tipo) {
  const out = [];
  for (const d of trazos || []) {
    const t = String(d).trim().split(/\s+/);
    let i = 0, cur = null, ini = null;
    const lado = (a, b) => { if (a && b && (a[0] !== b[0] || a[1] !== b[1])) out.push({ a, b, tipo, cj: caja([a, b]) }); };
    while (i < t.length) {
      const k = t[i];
      if (k === "M") { cur = [+t[i + 1], +t[i + 2]]; ini = cur; i += 3; }
      else if (k === "L") { const p = [+t[i + 1], +t[i + 2]]; lado(cur, p); cur = p; i += 3; }
      else if (k === "C") { const p = [+t[i + 5], +t[i + 6]]; lado(cur, p); cur = p; i += 7; }   // (la curva, por su cuerda)
      else if (k === "Z") { lado(cur, ini); cur = ini; i += 1; }
      else i += 1;
    }
  }
  return out.filter(s => [s.a, s.b].every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
}
function chocaCon(A, obstaculos) {
  const tipos = new Set();
  for (const o of obstaculos) {
    if (tipos.has(o.tipo) || cajasLejos(A.cj, o.cj)) continue;
    if (A.partes.some(t => !separados(t, [o.a, o.b], TOQUE))) tipos.add(o.tipo);
  }
  return [...tipos];
}
export const choques = (p, obstaculos) => chocaCon(prepara(p), obstaculos);

// Lo que está mal en el acomodo: por pieza, con qué otras se encima y con qué fijo choca. { [id]: { con: [ids], choca: ["muro"|"fijo"] } }
export function problemas(piezas, obstaculos = []) {
  const prep = piezas.map(prepara);
  const r = {};
  const de = id => (r[id] ||= { con: [], choca: [] });
  for (let i = 0; i < prep.length; i++) {
    for (let j = i + 1; j < prep.length; j++) {
      if (seTocan(prep[i], prep[j])) { de(prep[i].p.id).con.push(prep[j].p.id); de(prep[j].p.id).con.push(prep[i].p.id); }
    }
    const ch = chocaCon(prep[i], obstaculos);
    if (ch.length) de(prep[i].p.id).choca.push(...ch);
  }
  return r;
}

// ── cuánto queda libre ──
// v10.84.121 (la critique de «Planta», P1): lo que se decide con el plano son los pasillos. A cada lado de la pieza (por su caja), lo más cercano
//   que tiene ENFRENTE (un muro, columna, escalera o baño, u otra pieza): la distancia en cm y la línea de la cota. Lo que pasa de `max`, nada.
//   { der|izq|arr|aba: { cm, linea: [[x, y], [x, y]] } | null }
export function holguras(p, piezas, obstaculos, max = 1500) {
  const c = cajaDe(p);
  const cajas = [...obstaculos.map(o => o.cj), ...piezas.filter(q => q.id !== p.id).map(cajaDe)];
  const medio = (a0, a1, b0, b1) => (Math.max(a0, b0) + Math.min(a1, b1)) / 2;   // el centro de lo que se tienen enfrente
  const enY = k => k.y0 < c.y1 - TOQUE && k.y1 > c.y0 + TOQUE, enX = k => k.x0 < c.x1 - TOQUE && k.x1 > c.x0 + TOQUE;
  const lados = {
    der: { frente: k => enY(k) && k.x0 >= c.x1 - TOQUE, dist: k => k.x0 - c.x1, linea: (k, d) => { const y = medio(c.y0, c.y1, k.y0, k.y1); return [[c.x1, y], [c.x1 + d, y]]; } },
    izq: { frente: k => enY(k) && k.x1 <= c.x0 + TOQUE, dist: k => c.x0 - k.x1, linea: (k, d) => { const y = medio(c.y0, c.y1, k.y0, k.y1); return [[c.x0, y], [c.x0 - d, y]]; } },
    aba: { frente: k => enX(k) && k.y0 >= c.y1 - TOQUE, dist: k => k.y0 - c.y1, linea: (k, d) => { const x = medio(c.x0, c.x1, k.x0, k.x1); return [[x, c.y1], [x, c.y1 + d]]; } },
    arr: { frente: k => enX(k) && k.y1 <= c.y0 + TOQUE, dist: k => c.y0 - k.y1, linea: (k, d) => { const x = medio(c.x0, c.x1, k.x0, k.x1); return [[x, c.y0], [x, c.y0 - d]]; } },
  };
  const res = {};
  for (const [lado, L] of Object.entries(lados)) {
    let mejor = null;
    for (const k of cajas) { if (!L.frente(k)) continue; const d = Math.max(0, L.dist(k)); if (!mejor || d < mejor.d) mejor = { d, k }; }
    res[lado] = mejor && mejor.d <= max ? { cm: redondear(mejor.d, 0), linea: L.linea(mejor.k, mejor.d) } : null;
  }
  return res;
}
// «85 cm», «1.20 m»
export const distancia = cm => cm < 100 ? `${Math.round(cm)} cm` : `${(cm / 100).toFixed(2)} m`;

// ── lo que se captura ──
// Una medida en cm: «120», «120.5», «120,5» o «120 cm». Abajo de 10 cm se acepta, con aviso (¿eran metros?)
export function leerMedida(texto) {
  const t = String(texto ?? "").trim().replace(/\s*cm$/i, "").replace(",", ".");
  if (!t) return { error: "Escribe la medida en centímetros" };
  if (/^-/.test(t)) return { error: "La medida no puede ser negativa" };
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(t)) return { error: "Escribe sólo el número, en centímetros" };
  const v = Number(t);
  if (!(v > 0)) return { error: "La medida tiene que ser mayor que 0" };
  if (v < 1) return { error: "Menos de 1 cm: las medidas van en centímetros" };
  if (v > MEDIDA_MAX) return { error: "Más de 50 m: revisa la medida (va en centímetros)" };
  const valor = redondear(v, 1);
  return v < 10 ? { valor, aviso: `¿${valor} cm? Las medidas van en centímetros (${valor} m serían ${redondear(valor * 100, 0)})` } : { valor };
}
// Un giro en grados: «90», «-45», «12.5°»
export function leerGiro(texto) {
  const t = String(texto ?? "").trim().replace(/\s*°$/, "").replace(",", ".");
  if (!t) return { error: "Escribe el giro en grados" };
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { error: "Escribe sólo el número de grados" };
  const v = Number(t);
  if (Math.abs(v) > 3600) return { error: "Revisa el giro (en grados)" };
  return { valor: normalizarGiro(v) };
}
export function leerNombre(texto, max = NOMBRE_MAX, que = "el nombre") {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return { error: "Escribe " + que };
  if (t.length > max) return { error: `Máximo ${max} letras (lleva ${t.length})` };
  return { valor: t };
}

// ── mover, girar, medir ──
export const mover = (p, dx, dy) => ({ ...p, x: redondear(p.x + dx), y: redondear(p.y + dy) });
export const girar = (p, grados) => ({ ...p, giro: normalizarGiro((p.giro || 0) + grados) });
// Cambiar el largo o el ancho de una pieza con forma estira su forma en esa dirección
export function conMedidas(p, largo, ancho) {
  const fx = largo / p.largo, fy = ancho / p.ancho;
  const forma = Array.isArray(p.forma) && p.forma.length >= 3 ? p.forma.map(([x, y]) => [redondear(x * fx), redondear(y * fy)]) : null;
  return { ...p, largo, ancho, forma };
}
export function nuevoId(piezas, pref = "o") {
  const usados = new Set(piezas.map(p => p.id));
  let n = piezas.length + 1, id;
  do { id = pref + "-" + Math.random().toString(36).slice(2, 7) + n++; } while (usados.has(id));
  return id;
}
export const piezaNueva = ({ nombre, largo, ancho }, centro, id) =>
  ({ id, nombre, numero: "", x: conIman(centro.x), y: conIman(centro.y), largo, ancho, giro: 0, forma: null });
// Un nombre que no se repite: «GTO-1» → «GTO-1 (2)», «GTO-1 (2)» → «GTO-1 (3)» (en la lista, en lo rojo y en la hoja se sabe cuál es cuál)
export function nombreLibre(nombre, usados) {
  const base = String(nombre).replace(/\s*\(\d+\)$/, "").trim() || "Objeto", ya = new Set(usados.map(n => String(n).toLowerCase()));
  for (let k = 2; k < 1000; k++) { const suf = ` (${k})`, n = base.slice(0, NOMBRE_MAX - suf.length) + suf; if (!ya.has(n.toLowerCase())) return n; }
  return base;
}
// La copia es una pieza NUEVA (otra mesa, otra máquina que se piensa comprar): sin el número del plano y con su propio nombre
export const duplicar = (p, id, piezas = []) => ({ ...p, id, nombre: nombreLibre(p.nombre, piezas.map(q => q.nombre)), numero: "",
  x: redondear(p.x + PASO_LARGO), y: redondear(p.y + PASO_LARGO), forma: p.forma ? p.forma.map(([x, y]) => [x, y]) : null });

// Lo que viene de la base (o de un borrador) se revisa pieza por pieza: una dañada no tumba el plano, se deja fuera y se dice
export function limpiarPiezas(lista) {
  if (!Array.isArray(lista)) return { piezas: [], descartadas: 0, error: "La versión no trae piezas" };
  const piezas = [], ids = new Set();
  let descartadas = 0;
  for (const p of lista) {
    const ok = p && typeof p === "object" && typeof p.id === "string" && p.id && !ids.has(p.id) && typeof p.nombre === "string" && p.nombre.trim()
      && [p.x, p.y, p.largo, p.ancho].every(finito) && p.largo > 0 && p.ancho > 0 && p.largo <= MEDIDA_MAX && p.ancho <= MEDIDA_MAX
      && (p.giro == null || finito(p.giro))
      && (p.forma == null || (Array.isArray(p.forma) && p.forma.length >= 3 && p.forma.every(q => Array.isArray(q) && q.length === 2 && q.every(finito))));
    if (!ok) { descartadas++; continue; }
    ids.add(p.id);
    piezas.push({ id: p.id, nombre: p.nombre.trim().slice(0, NOMBRE_MAX), numero: typeof p.numero === "string" ? p.numero : "", x: redondear(p.x), y: redondear(p.y),
      largo: redondear(p.largo), ancho: redondear(p.ancho), giro: normalizarGiro(p.giro || 0), forma: p.forma ? p.forma.map(([x, y]) => [x, y]) : null });
  }
  return { piezas, descartadas };
}
export const mismasPiezas = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── la hoja impresa ──
export const HOJAS = { carta: { nombre: "Carta", ancho: 279.4, alto: 215.9 }, doble: { nombre: "Doble carta", ancho: 431.8, alto: 279.4 } };   // mm, horizontal
export const ESCALAS = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500];
// mm: la columna de la derecha (título y lista), los márgenes y el hueco entre los dos. Medidos para que la planta (35.4 × 25.1 m) quepa a
//   1:100 en doble carta, que es la escala del levantamiento y la que se mide con regla (con 8 + 56 salía a 1:125: tanda plano, pln-06)
export const LADO_DE_LA_HOJA = 54, MARGEN_DE_LA_HOJA = 7, HUECO_DE_LA_HOJA = 4;
// La escala más grande (1:100 antes que 1:200) con la que lo dibujado cabe en la hoja junto a su columna
export function escalaParaHoja(hoja, cj) {
  const ancho = hoja.ancho - 2 * MARGEN_DE_LA_HOJA - LADO_DE_LA_HOJA - HUECO_DE_LA_HOJA, alto = hoja.alto - 2 * MARGEN_DE_LA_HOJA;
  return ESCALAS.find(n => cj.ancho * 10 / n <= ancho && cj.alto * 10 / n <= alto) || ESCALAS[ESCALAS.length - 1];
}
