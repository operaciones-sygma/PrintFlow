// v10.84.189 — La fecha de entrega estándar. Marcelo, 6-nov, después de hablar con el equipo: «la fecha de entrega sólo la ponen a clientes que de verdad les urge el trabajo, a quienes
//   no se les pone, no hay como tal fecha de entrega, entonces estaría bien poner un standard… 8 días hábiles para un trabajo». Gerardo: que se alargue por el tiraje y por los productos de la orden.
//   Lo que escogió Marcelo, con lo medido en 690 órdenes internas entregadas desde junio (hasta quedar LISTAS, la misma vara de «a tiempo»; días hábiles sin festivos):
//     8 días fijos: se pasaría 13.8% (21% arriba de 10,000 piezas; 41% en una OC de 5 productos o más).
//     +2 arriba de 10,000 piezas y +3 desde el 5.º producto, sumados: 9.1%, con 8.9 días prometidos en promedio.
//     Los 3 de acabados de `calcDeliveryDate` se quedan fuera: con acabados pasa de 8 días el 8%, sin acabados el 19%. La regla de la web sigue en App (`calcDeliveryDate`).
//   El producto se cuenta al capturar: la OC no sabe cuántos vendrán. Si la planta cambia, se vuelve a medir.
// v10.84.192 — La segunda vuelta (Marcelo, 26-nov, con lo medido el 8-nov en 620 órdenes de la planta del 1-jun al 23-oct, sin las H- importadas que no pasaron por Salidas en la
//   bitácora ni las de «Entrega lejana»; con la regla de la 189, 8% llegaba tarde):
//     +3 a libros, libretas y calendarios: 22 órdenes, 9 días hábiles en el caso típico, 59% tarde → 9%.
//     El 5.º producto de una OC también recorre a los cuatro anteriores (`queSeRecorre`): sus primeros cuatro llegaban tarde el 28% (del 5.º en adelante, 5%) → 5%. Se capturan
//       juntos (9 de 12 OC grandes, del 1.º al 5.º en menos de 2 horas) y casi siempre antes de empezar (43 de 48). Sólo las que siguen en su estándar y no han entrado a máquina.
//     Nada más por tiraje (40,000 o 100,000 piezas tardan lo mismo que 15,000: etiquetas y formas, muchas por pliego) ni por acabados (con acabado, 5% tarde).
//     Con todo: 8% → 6% tarde, 8.9 días prometidos en promedio (eran 8.6). Volver a medir: `node scripts/medir-fecha-estandar.mjs` (sólo lee).
//   Y lo que dijo su crítica (26/40): la fecha en palabras y el festivo que no cuenta (`fechaEnPalabras`, `queNoCuenta`), y el riesgo de una fecha más corta que la estándar
//   (`riesgoDeFechaCorta`), con lo medido en las fechas pedidas a mano.
import { esFestivo } from "./tiempoPorEtapa.js";

export const DIAS_ESTANDAR = 8;
export const TIRAJE_LARGO = 10000, DIAS_POR_TIRAJE = 2;
export const PRODUCTOS_DE_OC_GRANDE = 5, DIAS_POR_PRODUCTOS = 3;
export const ENCUADERNADOS = ["libros", "libretas", "calendarios"], DIAS_POR_ENCUADERNADO = 3;   // los códigos de src/lib/categorias.js
// el 5.º producto recorre a los anteriores (lo lee scripts/medir-fecha-estandar.mjs para medir la regla como la usa la app)
export const RECORRE_LA_OC = true;
// las que todavía no se imprimen: mover su fecha no las marca para reimprimir (`auto_detect_post_print_edit` mira lo ya impreso)
export const ETAPAS_ANTES_DE_MAQUINA = ["draft", "design", "proof_printing", "proof_client", "ctp", "placas_listas", "ready"];
// las fechas pedidas a mano (1-jun al 13-nov-2026, 377 órdenes): cuántas quedaron LISTAS a tiempo según a cuántos días hábiles se pidieron. Medido con el script; si la planta cambia, se vuelve a medir
export const A_TIEMPO_SEGUN_LO_PEDIDO = { medido: "1-jun al 13-nov-2026", hasta3: { ordenes: 87, aTiempo: 0.48 }, de4a7: { ordenes: 221, aTiempo: 0.62 }, desde8: { ordenes: 69, aTiempo: 0.90 } };

const aNumero = v => { const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN; return Number.isFinite(n) ? n : 0; };
const esEncuadernado = c => typeof c === "string" && ENCUADERNADOS.includes(c.trim().toLowerCase());
const esHabil = d => { const w = d.getDay(); return w !== 0 && w !== 6 && !esFestivo(d); };

// el día de calendario de la computadora de quien captura, como lo guarda la columna `date`
export const diaLocal = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

export function diasEstandar({ piezas, productos, categoria } = {}) {
  const porTiraje = aNumero(piezas) > TIRAJE_LARGO ? DIAS_POR_TIRAJE : 0;
  const porProductos = aNumero(productos) >= PRODUCTOS_DE_OC_GRANDE ? DIAS_POR_PRODUCTOS : 0;
  const porEncuadernado = esEncuadernado(categoria) ? DIAS_POR_ENCUADERNADO : 0;
  return { dias: DIAS_ESTANDAR + porTiraje + porProductos + porEncuadernado, porTiraje, porProductos, porEncuadernado };
}

export function sumarDiasHabiles(desde, dias) {
  const d = new Date(desde);
  for (let sumados = 0; sumados < dias;) {
    d.setDate(d.getDate() + 1);
    if (esHabil(d)) sumados++;
  }
  return diaLocal(d);
}

export function fechaEstandar({ desde = new Date(), piezas, productos, categoria } = {}) {
  const c = diasEstandar({ piezas, productos, categoria });
  return { ...c, fecha: sumarDiasHabiles(desde, c.dias) };
}

// lo que se le dice a quien captura, para que la cifra no sea un misterio
export function porQueEsaFecha({ piezas, productos, categoria } = {}) {
  const { dias, porTiraje, porProductos, porEncuadernado } = diasEstandar({ piezas, productos, categoria });
  const extras = [porTiraje ? "+" + porTiraje + " por más de " + TIRAJE_LARGO.toLocaleString("en-US") + " piezas" : null, porProductos ? "+" + porProductos + " por " + PRODUCTOS_DE_OC_GRANDE + " o más productos en la OC" : null, porEncuadernado ? "+" + porEncuadernado + " por ser libro, libreta o calendario" : null].filter(Boolean);
  return dias + " días hábiles" + (extras.length ? " (" + DIAS_ESTANDAR + " " + extras.join(" ") + ")" : "");
}

// v10.84.192 — la fecha como la dice Lupita al teléfono: «jueves 19-nov» («jue 19-nov» en corto). Una fecha que no existe (o de dedazo, antes de 1900) no se dice
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"], DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const aFecha = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "")); if (!m) return null; const y = +m[1], mo = +m[2], d = +m[3]; if (y < 1900) return null; const f = new Date(y, mo - 1, d, 12); return f.getFullYear() === y && f.getMonth() === mo - 1 && f.getDate() === d ? f : null; };
export function fechaEnPalabras(iso, { corto = false } = {}) {
  const f = aFecha(iso); if (!f) return "";
  return (corto ? DIAS_CORTOS : DIAS)[f.getDay()] + " " + f.getDate() + "-" + MESES[f.getMonth()];
}

// días hábiles del día siguiente a `desde` hasta `iso` (la cuenta de fechaEstandar al revés): a cuántos días se está prometiendo
export function habilesHasta(desde, iso) {
  const fin = aFecha(iso), d = new Date(desde); if (!fin || isNaN(d)) return 0;
  d.setHours(12, 0, 0, 0); let n = 0;
  for (let g = 0; g < 800; g++) { d.setDate(d.getDate() + 1); if (d > fin) break; if (esHabil(d)) n++; }
  return n;
}

// los festivos de ley que caen entre semana del día siguiente a `desde` hasta `iso`: «no cuenta el lunes 16-nov, festivo»
export function queNoCuenta(desde, iso) {
  const fin = aFecha(iso), d = new Date(desde); if (!fin || isNaN(d)) return "";
  d.setHours(12, 0, 0, 0); const f = [];
  for (let g = 0; g < 800; g++) { d.setDate(d.getDate() + 1); if (d > fin) break; const w = d.getDay(); if (w !== 0 && w !== 6 && esFestivo(d)) f.push(diaLocal(d)); }
  if (!f.length) return "";
  const dicho = f.map(x => "el " + fechaEnPalabras(x));
  return f.length === 1 ? "no cuenta " + dicho[0] + ", festivo" : "no cuentan " + dicho.slice(0, -1).join(", ") + " ni " + dicho[dicho.length - 1] + ", festivos";
}

// cuando alguien promete menos que la estándar: cuántas fechas así de cerca se cumplieron (A_TIEMPO_SEGUN_LO_PEDIDO). De 8 días en adelante, sin cifra: la planta suele llegar
export function riesgoDeFechaCorta(dias) {
  const d = Number(dias); if (!Number.isFinite(d)) return "";
  if (d <= 3) return "Pedidas a 3 días hábiles o menos, la mitad quedó lista a tiempo.";
  if (d <= 7) return "Pedidas a 4 a 7 días hábiles, 6 de cada 10 quedaron listas a tiempo.";
  return "";
}

// v10.84.192 — al llegar la OC a 5 productos (o más), cuáles de los anteriores se recorren y a qué fecha: los que siguen en su estándar (nadie la cambió: delivery_calculated_at),
//   vivos, que todavía no entran a máquina, y cuya estándar con la OC grande va más lejos que la que tienen. Cada uno desde su propio día de captura, con su tiraje y su categoría.
//   `hermanas`: las otras órdenes de la OC (como estén); `productos`: cuántas vivas trae la OC contando la nueva.
export function queSeRecorre({ hermanas, productos } = {}) {
  const n = aNumero(productos); if (!Array.isArray(hermanas) || n < PRODUCTOS_DE_OC_GRANDE) return [];
  const r = [];
  for (const h of hermanas) {
    if (!h || typeof h !== "object" || !h.delivery_calculated_at || h.cancelled_at || /cancel/.test(String(h.stage || "")) || !ETAPAS_ANTES_DE_MAQUINA.includes(h.stage)) continue;
    const desde = new Date(h.created_at); if (!h.created_at || isNaN(desde)) continue;
    const { fecha } = fechaEstandar({ desde, piezas: h.quantity, productos: n, categoria: h.categoria });
    const antes = h.due_date ? String(h.due_date).slice(0, 10) : null;
    if (!antes || fecha > antes) r.push({ id: h.id, pn: h.production_number || h.id, fecha, antes, calculada: h.delivery_calculated_at });   // calculada: la condición del UPDATE (si otra sesión la cambió, no se pisa)
  }
  return r;
}
