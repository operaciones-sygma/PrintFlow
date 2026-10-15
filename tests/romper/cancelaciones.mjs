// Tratar de ROMPER «Cancelaciones» (cancelar en lote, v10.84.113), sin navegador: src/lib/cancelarEnLote.js con una base de mentira. Cada orden se
// cancela COMPLETA, como «Cancelar orden» del detalle: sale de la fila de su máquina ANTES (cancel_order_safe le borra la máquina sin recorrer la
// fila: la máquina se quedaba sin activa), se anota en su historial con el motivo, deja el comentario y les avisa a Producción y a Dirección; si la
// base la rechaza (lo facturado es de Dirección), regresa a su lugar en la fila. P-0629 (15-oct): cancelada desde aquí sin historial ni aviso a
// Gerardo. Cada caso afirma lo que DEBERÍA pasar. Uso: node tests/romper/cancelaciones.mjs   ·   SOLO=<regex> corre sólo esos casos
import { cancelarUnaDelLote } from "../../src/lib/cancelarEnLote.js";

const res = [];
const ok = (n, c, x = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + String(x).replace(/\s+/g, " ").slice(0, 260) : "")); };

// la base de mentira: lo que App le pasa (la fila de la máquina, la RPC, el tiempo de máquina, el historial, el comentario y los avisos), en orden
function base(cfg = {}) {
  const llamadas = [];
  const db = {
    sacarDeLaFila: async id => { llamadas.push("sacar " + id); if (cfg.fallaSacar) throw new Error("upstream request timeout");
      return { action: "removed_from_queue", old_machine: cfg.maquina || "off_pm52", old_position: "posicion" in cfg ? cfg.posicion : 0, new_active_id: "siguiente" in cfg ? cfg.siguiente : "OP-SIG" }; },
    regresarALaFila: async (id, maq, pos) => { llamadas.push(`regresar ${id} ${maq} ${pos}`); },
    cancelarSegura: async (id, motivo, quien) => { llamadas.push(`cancelar ${id} «${motivo}» ${quien}`); if (cfg.rechaza) throw new Error(cfg.rechaza); return true; },
    arrancarSiguiente: async (id, maq) => { llamadas.push(`arrancar ${id} ${maq}`); },
    cerrarTiempoDeMaquina: async id => { llamadas.push("cerrar " + id); },
    anotar: async (id, texto) => { llamadas.push(`anotar ${id} ${texto}`); if (cfg.fallaAnotar) throw new Error("insert into order_timeline: timeout"); },
    comentar: async (id, texto) => { llamadas.push(`comentar ${id} ${texto}`); },
    avisar: async (rol, id, mensaje, motivo) => { llamadas.push(`avisar ${rol} ${id} ${mensaje} | ${motivo}`); },
  };
  return { db, llamadas };
}
const maquinas = { off_pm52: "Printmaster 52", vm_manual: "Empaque" };
const nombreDeMaquina = m => maquinas[m] || m;
// P-0629 como se canceló el 15-oct (en Empaque: la fila de Empaque es la de mano, vm_manual, que el detalle tampoco recorre) y una en una máquina de verdad
const P0629 = { id: "OP-29", production_number: "P-0629", client: "LIC. ORLANDO CASAS", product_type: "Folletos", stage: "packaging", current_machine: "vm_manual", machine_queue_position: 0 };
const ENMAQ = { id: "OP-30", production_number: "P-0630", client: "CASTORES", product_type: "Guías", stage: "in_production", current_machine: "off_pm52", machine_queue_position: 0 };
const MOTIVO = "No conseguimos el grapado";
const cancelar = (b, orden, { quien = "secretaria", rol = "secretaria", motivo = MOTIVO } = {}) => cancelarUnaDelLote({ orden, motivo, quien, rol, db: b.db, nombreDeMaquina });
const pos = (b, prefijo) => b.llamadas.findIndex(l => l.startsWith(prefijo));

try {
  // 1. P-0629: lo que pasó el 15-oct, ahora completo
  let b = base(); let r = await cancelar(b, P0629);
  ok("cl-01 P-0629 desde «Cancelaciones»: se cancela con su motivo, queda en su historial y en sus comentarios, y les avisa a Producción y a Dirección",
    r.ok && b.llamadas.includes("cancelar OP-29 «No conseguimos el grapado» secretaria") && b.llamadas.includes("anotar OP-29 ❌ Cancelada: No conseguimos el grapado")
    && b.llamadas.includes("comentar OP-29 ❌ Cancelada: No conseguimos el grapado") && pos(b, "avisar produccion OP-29") >= 0 && pos(b, "avisar admin OP-29") >= 0
    && /Motivo: No conseguimos el grapado/.test(b.llamadas[pos(b, "avisar produccion OP-29")]), JSON.stringify(b.llamadas));
  ok("cl-02 en Empaque (la fila de mano) no se mueve ninguna fila, como en el detalle", pos(b, "sacar") < 0 && pos(b, "arrancar") < 0, JSON.stringify(b.llamadas));
  // 3. en una máquina de verdad: sale de la fila ANTES de la RPC, y la siguiente arranca
  b = base(); r = await cancelar(b, ENMAQ);
  ok("cl-03 la activa de Printmaster 52: sale de la fila ANTES de cancelarla (la RPC le borra la máquina sin recorrer la fila) y arranca la siguiente",
    r.ok && pos(b, "sacar OP-30") >= 0 && pos(b, "sacar OP-30") < pos(b, "cancelar OP-30") && b.llamadas.includes("arrancar OP-SIG off_pm52") && b.llamadas.includes("cerrar OP-30"),
    JSON.stringify(b.llamadas));
  b = base({ posicion: 2, siguiente: null }); r = await cancelar(b, { ...ENMAQ, machine_queue_position: 2 });
  ok("cl-04 si no era la activa (la tercera de la fila), sale de la fila y no arranca a nadie", r.ok && pos(b, "sacar OP-30") >= 0 && pos(b, "arrancar") < 0, JSON.stringify(b.llamadas));
  // 5. la base la rechaza: regresa a su lugar, y nada de historial ni avisos
  b = base({ rechaza: "La orden P-0630 tiene vínculo fiscal con CobranzaFlow — solo Dirección puede cancelarla (con nota de crédito)" }); r = await cancelar(b, ENMAQ);
  ok("cl-05 si la base la rechaza (facturada: es de Dirección), lo dice con sus palabras, regresa a su lugar en la fila y no anota ni avisa nada",
    !!r.error && /solo Dirección/.test(r.error) && b.llamadas.includes("regresar OP-30 off_pm52 0") && pos(b, "anotar") < 0 && pos(b, "avisar") < 0 && pos(b, "arrancar") < 0,
    JSON.stringify({ r, llamadas: b.llamadas }));
  // 6. quién avisa a quién: como el detalle (nadie se avisa a sí mismo)
  b = base(); r = await cancelar(b, P0629, { quien: "admin", rol: "admin" });
  ok("cl-06 si cancela Dirección: le avisa a Producción y no a sí misma", r.ok && pos(b, "avisar produccion") >= 0 && pos(b, "avisar admin") < 0, JSON.stringify(b.llamadas));
  // 7. lo de después falla: la orden YA está cancelada; se dice qué faltó
  b = base({ fallaAnotar: true }); r = await cancelar(b, P0629);
  ok("cl-07 si no se pudo anotar en el historial, la orden sí quedó cancelada y se dice qué faltó (los avisos sí salen)",
    r.ok && (r.quedo || []).some(q => /historial/.test(q)) && pos(b, "avisar produccion") >= 0, JSON.stringify(r));
  b = base({ fallaSacar: true }); r = await cancelar(b, ENMAQ);
  ok("cl-08 si no se pudo sacar de la fila, se cancela igual (es lo que se pidió) y se dice que hay que reacomodar Printmaster 52 en el Tablero",
    r.ok && pos(b, "cancelar OP-30") >= 0 && (r.quedo || []).some(q => /Printmaster 52/.test(q) && /Tablero/.test(q)) && pos(b, "arrancar") < 0, JSON.stringify(r));
  // 9. un motivo de menos de 5 letras no llega a la base
  b = base(); r = await cancelar(b, P0629, { motivo: "mal" });
  ok("cl-09 un motivo de menos de 5 letras no llega a la base", !!r.error && b.llamadas.length === 0, JSON.stringify({ r, llamadas: b.llamadas }));
  // 10. vuelta 3, por donde no se diseñó: dos seguidas de la misma máquina en UN lote (el cliente cancela la OC entera). La fila de verdad:
  //   Printmaster 52 con A (activa), B y C. Sacar A hace activa a B, que también se va a cancelar: B no se arranca (le abriría un tiempo de
  //   máquina de segundos); al sacar B, la activa es C, y C sí arranca.
  {
    const fila = ["OP-A", "OP-B", "OP-C"]; const llamadas = [];
    const db = {
      sacarDeLaFila: async id => { const i = fila.indexOf(id); llamadas.push("sacar " + id + "@" + i); if (i < 0) return { action: "removed_from_queue", old_machine: null, old_position: null, new_active_id: null };
        fila.splice(i, 1); return { action: "removed_from_queue", old_machine: "off_pm52", old_position: i, new_active_id: i === 0 ? (fila[0] || null) : null }; },
      regresarALaFila: async (id, maq, pos) => { llamadas.push(`regresar ${id} ${maq} ${pos}`); fila.splice(pos, 0, id); },
      cancelarSegura: async id => { llamadas.push("cancelar " + id); },
      arrancarSiguiente: async (id, maq) => { llamadas.push(`arrancar ${id} ${maq}`); },
      cerrarTiempoDeMaquina: async () => {}, anotar: async () => {}, comentar: async () => {}, avisar: async () => {},
    };
    const ord = (id, i) => ({ id, production_number: "P-" + id.slice(3), client: "PRIME PET", product_type: "Bolsas", stage: "in_production", current_machine: "off_pm52", machine_queue_position: i });
    const lote = [ord("OP-A", 0), ord("OP-B", 1)]; const pendientes = new Set(lote.map(o => o.id)); const rs = [];
    for (const o of lote) { pendientes.delete(o.id); rs.push(await cancelarUnaDelLote({ orden: o, motivo: MOTIVO, quien: "secretaria", rol: "secretaria", db, pendientes, nombreDeMaquina })); }
    ok("cl-10 dos seguidas de la misma máquina en un lote: B (que también se cancela) no arranca; C, la que queda, sí",
      rs.every(x => x.ok) && !llamadas.includes("arrancar OP-B off_pm52") && llamadas.includes("arrancar OP-C off_pm52") && fila.join() === "OP-C", JSON.stringify({ llamadas, fila }));
  }
  // 11. si la base la rechaza y no se sabe dónde estaba (la fila no dijo su lugar), no se «regresa» a ciegas: regresar sin lugar la volvería a sacar
  b = base({ rechaza: "La orden P-0630 tiene vínculo fiscal con CobranzaFlow — solo Dirección puede cancelarla (con nota de crédito)", posicion: null }); r = await cancelar(b, ENMAQ);
  ok("cl-11 rechazada y sin saber su lugar en la fila: no la «regresa» a ciegas y dice que hay que acomodarla en el Tablero",
    !!r.error && pos(b, "regresar") < 0 && /Tablero/.test(r.error), JSON.stringify({ r, llamadas: b.llamadas }));
} catch (e) {
  ok("cl-00 la prueba corrió sin tronar", false, e?.stack || e?.message || String(e));
}
for (const x of res) console.log(x);
const fallan = res.filter(x => x.startsWith("FALLA")).length;
console.log(`\ncancelaciones: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
