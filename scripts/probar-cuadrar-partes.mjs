// Prueba de la aritmetica de «Cuadrar» del modal de partes (v10.84.3).
// Se corre contra el modulo REAL:  node scripts/probar-cuadrar-partes.mjs
import { cuadrarPartes, cuadra } from '../src/lib/cuadrarPartes.js';

let ok = 0, mal = 0;
const t = (n, c) => { if (c) ok++; else { mal++; console.log(`  FALLA ${n}`); } };
const sum = (ls, k) => ls.reduce((a, x) => a + x[k], 0);
const c2 = (n) => Math.round(n * 100);

// EL CASO REAL: P-0070 Castores, $21,700 / 70,000 pzas (unitario 0.31)
const Q = 70000, P = 21700;

// 1. Karla captura 8,000 pzas por $2,480 y deja el resto en cero: el resto absorbe TODO lo que falta
let r = cuadrarPartes([{ q: 8000, sub: 2480, doc_type: 'factura' }, { q: 0, sub: 0, doc_type: 'por_facturar' }], Q, P, 'piezas');
t('resto vacio: piezas', r.ls[1].q === 62000);
t('resto vacio: dinero', c2(r.ls[1].sub) === c2(19220));
t('cuadra despues', cuadra(r.ls, Q, P));
t('dice que cambio', r.cambios.length === 1 && /#2/.test(r.cambios[0]));

// 2. Dinero capturado a mano (el cliente pidio $20,000 EXACTOS), piezas sin poner: modo importes
r = cuadrarPartes([{ q: 0, sub: 20000, doc_type: 'factura' }, { q: 0, sub: 0, doc_type: 'por_facturar' }], Q, P, 'importes');
t('importes: conserva los $20,000', c2(r.ls[0].sub) === c2(20000));
t('importes: piezas en proporcion', r.ls[0].q === Math.round(20000 / (P / Q)));
t('importes: el resto se lleva el residuo y cuadra', cuadra(r.ls, Q, P));

// 3. Mismo caso en modo piezas: conserva las piezas (0 → no se puede) -> fail-closed
r = cuadrarPartes([{ q: 0, sub: 20000, doc_type: 'factura' }, { q: 0, sub: 0, doc_type: 'por_facturar' }], Q, P, 'piezas');
t('piezas con 0 pzas en la parte 1: no toca nada y lo dice', !!r.error && /#1/.test(r.error));

// 4. Sin resto: el residuo va a la parte MAYOR, no a la primera
r = cuadrarPartes([{ q: 10000, sub: 3100, doc_type: 'factura' }, { q: 50000, sub: 15500, doc_type: 'factura' }, { q: 9990, sub: 3096.9, doc_type: 'factura' }], Q, P, 'piezas');
t('sin resto: la mayor absorbe las 10 piezas', r.ls[1].q === 50010);
t('sin resto: cuadra', cuadra(r.ls, Q, P));

// 5. Centavos: unitario con decimales largos ($21,700 / 70,000 = 0.31 exacto; probemos uno feo)
const Q2 = 333, P2 = 1000;   // unitario 3.003003...
r = cuadrarPartes([{ q: 100, sub: 300.3, doc_type: 'factura' }, { q: 233, sub: 699.7, doc_type: 'por_facturar' }], Q2, P2, 'piezas');
t('centavos: cuadra al centavo', cuadra(r.ls, Q2, P2));
t('centavos: ninguna parte en cero', r.ls.every(x => x.q >= 1 && x.sub > 0));

// 6. Ya cuadraba: no cambia nada
r = cuadrarPartes([{ q: 8000, sub: 2480, doc_type: 'factura' }, { q: 62000, sub: 19220, doc_type: 'por_facturar' }], Q, P, 'piezas');
t('ya cuadraba: cero cambios', r.cambios.length === 0);

// 7. Los dos modos dan lo mismo cuando piezas y dinero ya van en proporcion -> un solo boton
const a = cuadrarPartes([{ q: 8000, sub: 2480, doc_type: 'factura' }, { q: 0, sub: 0, doc_type: 'por_facturar' }], Q, P, 'piezas');
const b = cuadrarPartes([{ q: 8000, sub: 2480, doc_type: 'factura' }, { q: 0, sub: 0, doc_type: 'por_facturar' }], Q, P, 'importes');
t('misma firma => un solo boton', a.firma === b.firma);

// 8. Y difieren cuando Karla capturo dinero fuera de proporcion -> dos botones
const a2 = cuadrarPartes([{ q: 8000, sub: 5000, doc_type: 'factura' }, { q: 0, sub: 0, doc_type: 'por_facturar' }], Q, P, 'piezas');
const b2 = cuadrarPartes([{ q: 8000, sub: 5000, doc_type: 'factura' }, { q: 0, sub: 0, doc_type: 'por_facturar' }], Q, P, 'importes');
t('piezas conserva 8,000 pzas y baja el dinero a $2,480', a2.ls[0].q === 8000 && c2(a2.ls[0].sub) === c2(2480));
t('importes conserva $5,000 y sube las piezas', c2(b2.ls[0].sub) === c2(5000) && b2.ls[0].q === Math.round(5000 / 0.31));
t('firmas distintas => dos botones', a2.firma !== b2.firma);

// 9. Entradas invalidas: no revienta
t('orden sin precio -> null', cuadrarPartes([{ q: 1, sub: 1, doc_type: 'factura' }], 10, 0, 'piezas') === null);
t('lista vacia -> null', cuadrarPartes([], 10, 100, 'piezas') === null);

// CONTROL NEGATIVO: la prueba tiene que poder reprobar
t('autoprueba en rojo: distingue un reparto que NO cuadra', !cuadra([{ q: 1, sub: 1 }], Q, P));

console.log(`\n${mal === 0 ? '✅' : '❌'} ${ok} pasan, ${mal} fallan`);
process.exit(mal === 0 ? 0 : 1);
