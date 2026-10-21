// v10.84.119 — La hoja impresa del plano (y el PDF: «Guardar como PDF» en la ventana de imprimir del navegador): el acomodo A ESCALA (1:100
//   en doble carta, 1:200 en carta; la más grande que quepa), con su escala gráfica, qué versión es, quién y cuándo, lo que se encima y la
//   lista de máquinas con sus medidas. Es un HTML completo para un marco oculto, el mismo camino que el vale de caja de App.
import { esquinas, puntoDelNombre, cajaDe, juntarCajas, escalaParaHoja, areasLibres, partirNombre, HOJAS, LADO_DE_LA_HOJA, MARGEN_DE_LA_HOJA, HUECO_DE_LA_HOJA, redondear } from "../lib/plano.js";
import { CAJA, MUROS, VIDRIOS, PUERTAS, FIJOS, ESCALERAS, PUNTEADO, PROYECCION, DIVISIONES, AREAS } from "./plantaBaja.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const cm = v => String(redondear(v, 1));
export const medidas = p => cm(p.largo) + " × " + cm(p.ancho);
const FILAS_MAX = 44;   // lo que cabe en la columna de la derecha; si hay más, se dice cuántas faltan

// Lo que se dibuja: la planta completa y todo lo que esté fuera de ella (una pieza que se sacó), con 20 cm de aire
export function cajaParaImprimir(piezas) {
  const c = juntarCajas([{ x0: 0, y0: 0, x1: CAJA.ancho, y1: CAJA.alto }, ...piezas.map(cajaDe)]);
  const M = 20;
  return { x0: c.x0 - M, y0: c.y0 - M, x1: c.x1 + M, y1: c.y1 + M, ancho: c.ancho + 2 * M, alto: c.alto + 2 * M };
}
export const escalaDe = (piezas, hoja) => escalaParaHoja(HOJAS[hoja] || HOJAS.doble, cajaParaImprimir(piezas));

const fechaLarga = d => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) + ", " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

// { piezas, problemas: {id:{con,choca}}, version: {nombre, actualizado_por, actualizado_en} | null, sinGuardar, hoja: "doble"|"carta", quien, cuando }
export function hojaParaImprimir({ piezas, problemas = {}, version = null, sinGuardar = false, hoja = "doble", quien = "", cuando = new Date() }) {
  const H = HOJAS[hoja] || HOJAS.doble;
  const cj = cajaParaImprimir(piezas);
  const n = escalaParaHoja(H, cj);
  const enHoja = c => c * 10 / n;          // cm reales → mm en el papel
  const delDibujo = mm => mm * n / 10;     // mm en el papel → cm del dibujo (grosores y letras)
  const letra = n <= 100 ? 2.6 : 2.1, letraChica = n <= 100 ? 2.0 : 1.7;   // mm
  const trazos = (lista, color, grueso, extra = "") => `<g fill="none" stroke="${color}" stroke-width="${delDibujo(grueso)}" stroke-linecap="round" stroke-linejoin="round"${extra}>${lista.map(d => `<path d="${d}"/>`).join("")}</g>`;
  const nombrePorId = Object.fromEntries(piezas.map(p => [p.id, p.nombre]));
  const conProblema = p => { const r = problemas[p.id]; return !!r && (r.con.length > 0 || r.choca.length > 0); };
  const poligonoSvg = p => {
    const mal = conProblema(p);
    const pts = esquinas(p).map(([x, y]) => redondear(x, 1) + "," + redondear(y, 1)).join(" ");
    return `<polygon points="${pts}" fill="${mal ? "#fde2e2" : p.numero ? "#e8edf2" : "#fdf3e1"}" stroke="${mal ? "#b91c1c" : "#1f2933"}" stroke-width="${delDibujo(mal ? 0.45 : 0.3)}"/>`;
  };
  // v10.84.164 — los letreros que se pisan van sin medidas y con el nombre en dos renglones (la regla de la pantalla): las dos manuales, a 30 cm
  //   una de otra, se encimaban en Carta 1:200 (pln-108). Sólo los que chocan: los demás se quedan como estaban.
  const L = delDibujo(letra), Lc = delDibujo(letraChica);
  const cajaLetrero = (p, partes) => {
    const [lx, ly] = puntoDelNombre(p);
    if (partes) { const w = Math.max(...partes.map(t => t.length)) * 0.6 * L / 2; return [lx - w, ly - 1.05 * L, lx + w, ly + 1.15 * L]; }
    const w = Math.max(p.nombre.length * 0.6 * L, medidas(p).length * 0.55 * Lc) / 2;
    return [lx - w, ly - 1.2 * L, lx + w, ly + 1.4 * Lc];
  };
  const partidos = {};
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const cajas = piezas.map(p => cajaLetrero(p, partidos[p.id]));
    let cambio = false;
    for (let i = 0; i < piezas.length; i++) for (let j = i + 1; j < piezas.length; j++) {
      const a = cajas[i], b = cajas[j];
      if (!(a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3])) continue;
      for (const p of [piezas[i], piezas[j]]) if (!partidos[p.id]) { const t = partirNombre(p.nombre); if (t) { partidos[p.id] = t; cambio = true; } }
    }
    if (!cambio) break;
  }
  // (v10.84.121) los letreros van después de TODAS las piezas: dentro de cada una, el de la pieza de abajo lo tapaba la de arriba
  const letreroSvg = p => {
    const [lx, ly] = puntoDelNombre(p);
    const partes = partidos[p.id];
    if (partes) return `<text x="${redondear(lx, 1)}" y="${redondear(ly - L * 0.25, 1)}" font-size="${redondear(L, 1)}" font-weight="700" text-anchor="middle" fill="#111">`
      + partes.map((t, k) => `<tspan x="${redondear(lx, 1)}" dy="${k ? "1.1em" : "0"}">${esc(t)}</tspan>`).join("") + `</text>`;
    return `<text x="${redondear(lx, 1)}" y="${redondear(ly - delDibujo(letraChica) * 0.35, 1)}" font-size="${redondear(delDibujo(letra), 1)}" font-weight="700" text-anchor="middle" fill="#111">${esc(p.nombre)}</text>`
      + `<text x="${redondear(lx, 1)}" y="${redondear(ly + delDibujo(letraChica) * 1.05, 1)}" font-size="${redondear(delDibujo(letraChica), 1)}" text-anchor="middle" fill="#333">${esc(medidas(p))}</text>`;
  };
  const plano = `<svg class="plano" xmlns="http://www.w3.org/2000/svg" width="${redondear(enHoja(cj.ancho), 2)}mm" height="${redondear(enHoja(cj.alto), 2)}mm" viewBox="${cj.x0} ${cj.y0} ${cj.ancho} ${cj.alto}" font-family="Arial, Helvetica, sans-serif">
${trazos(PROYECCION, "#9aa5b1", 0.15, ` stroke-dasharray="${delDibujo(1.2)} ${delDibujo(0.8)}"`)}
${trazos(PUNTEADO, "#9aa5b1", 0.15)}
${trazos([...FIJOS, ...ESCALERAS], "#52606d", 0.18)}
${trazos(PUERTAS, "#7b8794", 0.15)}
${trazos(VIDRIOS, "#3e6d9c", 0.2)}
${trazos(MUROS, "#111", 0.35)}
${trazos(DIVISIONES, "#111", 0.3)}
${areasLibres(AREAS, piezas, delDibujo(letra * 1.15), piezas.map(p => { const [lx, ly] = puntoDelNombre(p), L = delDibujo(letra), Lc = delDibujo(letraChica), w = Math.max(p.nombre.length * 0.6 * L, medidas(p).length * 0.55 * Lc) / 2; return [lx - w, ly - 1.2 * L, lx + w, ly + 1.4 * Lc]; })).map(a => `<text x="${a.x}" y="${a.y}" font-size="${redondear(delDibujo(letra * 1.15), 1)}" fill="#7b8794" font-style="italic">${esc(a.t)}</text>`).join("")}
${piezas.map(poligonoSvg).join("\n")}
${piezas.map(letreroSvg).join("\n")}
</svg>`;
  // la escala gráfica: tramos de 1 m (de 2 m si el metro mide menos de 4 mm), hasta ~40 mm
  const metro = enHoja(100), tramo = metro >= 4 ? 1 : 2, nTramos = Math.max(2, Math.min(8, Math.floor(40 / (metro * tramo))));
  const anchoBarra = nTramos * tramo * metro;
  const barra = `<svg xmlns="http://www.w3.org/2000/svg" width="${redondear(anchoBarra + 6, 2)}mm" height="8mm" viewBox="-1 0 ${redondear(anchoBarra + 6, 2)} 8" font-family="Arial, Helvetica, sans-serif">`
    + Array.from({ length: nTramos }, (_, i) => `<rect x="${redondear(i * tramo * metro, 2)}" y="1" width="${redondear(tramo * metro, 2)}" height="1.6" fill="${i % 2 ? "#fff" : "#111"}" stroke="#111" stroke-width="0.2"/>`).join("")
    + Array.from({ length: nTramos + 1 }, (_, i) => `<text x="${redondear(i * tramo * metro, 2)}" y="5.6" font-size="2.3" text-anchor="middle" fill="#111">${i * tramo}</text>`).join("")
    + `<text x="${redondear(anchoBarra + 1.5, 2)}" y="2.6" font-size="2.3" fill="#111">m</text></svg>`;
  const malas = piezas.filter(conProblema);
  const lineaProblema = p => {
    const r = problemas[p.id], partes = [];
    if (r.con.length) partes.push("se encima con " + r.con.map(id => nombrePorId[id] || "otra").join(", "));
    if (r.choca.includes("muro")) partes.push("choca con un muro o columna");
    if (r.choca.includes("fijo")) partes.push("choca con la escalera o los baños");
    return `<li><b>${esc(p.nombre)}</b>: ${esc(partes.join("; "))}</li>`;
  };
  const filas = piezas.slice(0, FILAS_MAX).map(p => `<tr${conProblema(p) ? ' class="mal"' : ""}><td class="num">${esc(p.numero || "")}</td><td>${esc(p.nombre)}</td><td class="med">${esc(medidas(p))}</td><td class="med">${p.giro ? esc(cm(p.giro)) + "°" : ""}</td></tr>`).join("");
  const titulo = version ? version.nombre : "Plano del levantamiento";
  const persona = u => u ? String(u).charAt(0).toUpperCase() + String(u).slice(1) : "";
  const guardada = version && version.actualizado_en ? `Guardada por ${esc(persona(version.actualizado_por) || "—")} el ${esc(fechaLarga(new Date(version.actualizado_en)))}` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc("Planta baja · " + titulo)}</title>
<style>
@page{size:${H.ancho}mm ${H.alto}mm;margin:${MARGEN_DE_LA_HOJA}mm}
html,body{margin:0;padding:0;background:#fff}
body{font-family:Arial,Helvetica,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hoja{display:flex;gap:${HUECO_DE_LA_HOJA}mm;align-items:flex-start}
.plano{flex:none;display:block}
.lado{width:${LADO_DE_LA_HOJA}mm;flex:none;font-size:7.5pt;line-height:1.3}
.eyebrow{font-size:6.5pt;letter-spacing:.06em;text-transform:uppercase;color:#52606d}
h1{font-size:12pt;margin:1mm 0 1.5mm;line-height:1.15}
.dato{margin:0 0 1mm;color:#333}
.aviso{margin:2mm 0;padding:1.5mm 2mm;border:0.3mm solid #b91c1c;color:#7f1d1d;border-radius:1mm}
.aviso ul{margin:1mm 0 0;padding-left:3.5mm}
.sin-guardar{margin:2mm 0;padding:1.5mm 2mm;border:0.3mm solid #b45309;color:#78350f;border-radius:1mm}
table{border-collapse:collapse;width:100%;margin-top:1mm;font-size:inherit}
th{text-align:left;font-size:6.5pt;color:#52606d;font-weight:700;border-bottom:0.3mm solid #111;padding:0.6mm 0.8mm}
td{padding:0.6mm 0.8mm;border-bottom:0.15mm solid #cbd2d9;vertical-align:top}
td.num{width:5mm;color:#52606d}
td.med{white-space:nowrap;text-align:right}
tr.mal td{color:#b91c1c;font-weight:700}
.pie{margin-top:2mm;color:#52606d;font-size:6.5pt}
</style></head><body><div class="hoja">
${plano}
<div class="lado">
  <div class="eyebrow">SYGMA · Planta baja</div>
  <h1>${esc(titulo)}</h1>
  ${guardada ? `<p class="dato">${guardada}</p>` : ""}
  <p class="dato">Impresa${quien ? " por " + esc(quien) : ""} el ${esc(fechaLarga(cuando))}</p>
  ${sinGuardar ? `<div class="sin-guardar"><b>Con cambios sin guardar:</b> esta hoja no es igual a la versión guardada.</div>` : ""}
  <p class="dato"><b>Escala 1:${n}</b> en ${esc(H.nombre.toLowerCase())} · medidas en centímetros</p>
  ${barra}
  ${malas.length ? `<div class="aviso"><b>${malas.length === 1 ? "1 pieza con problema" : malas.length + " piezas con problema"}</b><ul>${malas.slice(0, 8).map(lineaProblema).join("")}</ul>${malas.length > 8 ? `<div>y ${malas.length - 8} más</div>` : ""}</div>` : ""}
  <table><thead><tr><th>N.º</th><th>${piezas.length === 1 ? "1 pieza" : piezas.length + " piezas"}</th><th class="med">Largo × ancho</th><th class="med">Giro</th></tr></thead><tbody>${filas}</tbody></table>
  ${piezas.length > FILAS_MAX ? `<p class="dato">y ${piezas.length - FILAS_MAX} piezas más que no caben en la lista (están en el plano)</p>` : ""}
  <p class="pie">N.º = el número de la máquina en el plano del levantamiento. Lo que no tiene número se agregó después.</p>
</div>
</div></body></html>`;
}

// Imprime una hoja en un marco oculto (como el vale de caja de App): la ventana de imprimir del navegador deja guardarla como PDF
export function imprimirEnMarco(html) {
  const ifr = document.createElement("iframe");
  ifr.setAttribute("aria-hidden", "true");
  ifr.setAttribute("data-plano-hoja", "");
  ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(ifr);
  const idoc = ifr.contentWindow.document;
  idoc.open(); idoc.write(html); idoc.close();
  const go = () => { try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (e) { /* impresión best-effort */ }
    setTimeout(() => { try { document.body.removeChild(ifr); } catch (_) { /* ya no estaba */ } }, 3000); };
  setTimeout(go, 350);
}
