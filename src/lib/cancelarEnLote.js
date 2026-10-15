// v10.84.113 — «Cancelaciones» (cancelar en lote) cancela cada orden COMPLETA, como «Cancelar orden» del detalle (cancelOrder de App), sin React para
//   probarlo con Node (tests/romper/cancelaciones.mjs). Antes sólo llamaba la RPC cancel_order_safe: la orden quedaba cancelada sin su línea en el
//   historial, sin comentario y sin aviso a Producción ni a Dirección (P-0629, 15-oct, cancelada en Empaque: Gerardo no se enteró), y si estaba en
//   la fila de una máquina, la RPC le borraba la máquina sin recorrer la fila (la máquina se quedaba sin activa). Ahora:
//   1. si está en la fila de una máquina de verdad (no la de mano, vm_manual, que el detalle tampoco recorre), sale de la fila ANTES de la RPC;
//   2. la RPC de siempre cancela (rutea por facturación: lo facturado sólo lo deja a Dirección); si la rechaza, la orden regresa a su lugar en la
//      fila y el rechazo se dice con sus palabras;
//   3. ya cancelada: arranca la siguiente de esa máquina, cierra su tiempo de máquina, la anota en su historial, deja el comentario y avisa a
//      Producción y a Dirección (nadie se avisa a sí mismo). Lo que falle de aquí se dice («quedo»): la orden ya está cancelada.
//   `db` lo pone App: sacarDeLaFila, regresarALaFila, cancelarSegura, arrancarSiguiente, cerrarTiempoDeMaquina, anotar, comentar, avisar.
//   `pendientes`: las que faltan de este lote; si la nueva activa de la máquina es una de ellas, no se arranca (se va a cancelar enseguida y le
//   quedaría un tiempo de máquina de segundos; vuelta 3, cl-10: el cliente cancela una OC entera con dos seguidas en la misma prensa).
//   Devuelve { error } en palabras, o { ok: true, quedo: [lo que no se pudo] }.
export async function cancelarUnaDelLote({ orden, motivo, quien, rol, db, pendientes = null, nombreDeMaquina = m => m }) {
  const nombre = orden?.production_number || orden?.id || "La orden";
  const m = String(motivo || "").trim();
  if (!orden?.id || m.length < 5) return { error: nombre + ": escribe el motivo (5 letras o más). No se canceló." };
  const quedo = [];
  const intentar = async (que, fn) => { try { return await fn(); } catch (e) { quedo.push(que); return null; } };
  // 1. fuera de la fila ANTES de la RPC (ella le borra current_machine y la posición sin recorrer a las demás)
  const enFila = orden.machine_queue_position != null && !!orden.current_machine && orden.current_machine !== "vm_manual";
  const maq = nombreDeMaquina(orden.current_machine);
  let fila = null;
  if (enFila) fila = await intentar("sacarla de la fila de " + maq + " (reacomoda esa fila en el Tablero)", () => db.sacarDeLaFila(orden.id));
  // 2. cancelar; si la base la rechaza, regresa a su lugar
  try { await db.cancelarSegura(orden.id, m, quien); }
  catch (e) {
    if (fila && fila.old_machine) {
      // (vuelta 3, cl-11) sin su lugar no se «regresa»: regresar sin posición es SACAR otra vez
      if (fila.old_position == null) return { error: nombre + ": " + (e?.message || "la base no la canceló") + " — salió de la fila de " + maq + ": acomódala en el Tablero." };
      try { await db.regresarALaFila(orden.id, fila.old_machine, fila.old_position); }
      catch (e2) { return { error: nombre + ": " + (e?.message || "la base no la canceló") + " — y no se pudo regresar a su lugar en la fila de " + maq + ": acomódala en el Tablero." }; }
    }
    return { error: nombre + ": " + (e?.message || "la base no la canceló") };
  }
  // 3. ya cancelada: lo demás, cada cosa por su lado
  if (fila?.new_active_id && !(pendientes && pendientes.has(fila.new_active_id))) await intentar("arrancar la siguiente en " + nombreDeMaquina(fila.old_machine), () => db.arrancarSiguiente(fila.new_active_id, fila.old_machine));
  await intentar("cerrar su tiempo de máquina", () => db.cerrarTiempoDeMaquina(orden.id));
  await intentar("anotarla en su historial", () => db.anotar(orden.id, "❌ Cancelada: " + m));
  await intentar("dejar el comentario", () => db.comentar(orden.id, "❌ Cancelada: " + m));
  const mensaje = "❌ Orden cancelada: " + (orden.client || "") + " — " + (orden.product_type || "") + ". Motivo: " + m;
  await intentar("avisarles a Producción y a Dirección", async () => {
    if (rol !== "admin") await db.avisar("admin", orden.id, mensaje, m);
    if (rol !== "produccion") await db.avisar("produccion", orden.id, mensaje, m);
  });
  return { ok: true, quedo };
}
