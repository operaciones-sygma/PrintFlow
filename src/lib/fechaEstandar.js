// v10.84.189 — La fecha de entrega estándar. Marcelo, 6-nov, después de hablar con el equipo: «la fecha de entrega sólo la ponen a clientes que de verdad les urge el trabajo, a quienes
//   no se les pone, no hay como tal fecha de entrega, entonces estaría bien poner un standard… 8 días hábiles para un trabajo». Gerardo: que se alargue por el tiraje y por los productos de la orden.
//   Lo que escogió Marcelo, con lo medido en 690 órdenes internas entregadas desde junio (hasta quedar LISTAS, la misma vara de «a tiempo»; días hábiles sin festivos):
//     8 días fijos: se pasaría 13.8% (21% arriba de 10,000 piezas; 41% en una OC de 5 productos o más).
//     +2 arriba de 10,000 piezas y +3 desde el 5.º producto, sumados: 9.1%, con 8.9 días prometidos en promedio.
//     Los 3 de acabados de `calcDeliveryDate` se quedan fuera: con acabados pasa de 8 días el 8%, sin acabados el 19%. La regla de la web sigue en App (`calcDeliveryDate`).
//   El producto se cuenta al capturar: la OC no sabe cuántos vendrán, y el 5.º no mueve las fechas de los anteriores. Si la planta cambia, se vuelve a medir.
import { esFestivo } from "./tiempoPorEtapa.js";

export const DIAS_ESTANDAR = 8;
export const TIRAJE_LARGO = 10000, DIAS_POR_TIRAJE = 2;
export const PRODUCTOS_DE_OC_GRANDE = 5, DIAS_POR_PRODUCTOS = 3;

const aNumero = v => { const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN; return Number.isFinite(n) ? n : 0; };

// el día de calendario de la computadora de quien captura, como lo guarda la columna `date`
export const diaLocal = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

export function diasEstandar({ piezas, productos } = {}) {
  const porTiraje = aNumero(piezas) > TIRAJE_LARGO ? DIAS_POR_TIRAJE : 0;
  const porProductos = aNumero(productos) >= PRODUCTOS_DE_OC_GRANDE ? DIAS_POR_PRODUCTOS : 0;
  return { dias: DIAS_ESTANDAR + porTiraje + porProductos, porTiraje, porProductos };
}

export function sumarDiasHabiles(desde, dias) {
  const d = new Date(desde);
  for (let sumados = 0; sumados < dias;) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !esFestivo(d)) sumados++;
  }
  return diaLocal(d);
}

export function fechaEstandar({ desde = new Date(), piezas, productos } = {}) {
  const c = diasEstandar({ piezas, productos });
  return { ...c, fecha: sumarDiasHabiles(desde, c.dias) };
}

// lo que se le dice a quien captura, para que la cifra no sea un misterio
export function porQueEsaFecha({ piezas, productos } = {}) {
  const { dias, porTiraje, porProductos } = diasEstandar({ piezas, productos });
  const extras = [porTiraje ? "+" + porTiraje + " por más de " + TIRAJE_LARGO.toLocaleString("en-US") + " piezas" : null, porProductos ? "+" + porProductos + " por " + PRODUCTOS_DE_OC_GRANDE + " o más productos en la OC" : null].filter(Boolean);
  return dias + " días hábiles" + (extras.length ? " (" + DIAS_ESTANDAR + " " + extras.join(" ") + ")" : "");
}
