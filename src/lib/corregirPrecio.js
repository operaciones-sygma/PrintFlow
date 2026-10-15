// v10.84.112 — «Corregir precio» contra la base (Karla, P-0600 de PRIME PET), sin React, para probarlo con Node (tests/romper/corregir.mjs) con
//   una base de mentira. Relee la orden (si mientras se corregía se folió, se entregó, se canceló o se pagó con saldo, no), le pregunta a la base
//   si ya va por partes o en el plan matriz (no son columnas: las calcula reload) y guarda el precio en SU columna (maquila: maq_price) con quién
//   lo cambió: el historial de la base (order_change_log) atribuye por last_edited_* y sin ellos lo anotaba como «sistema». Confirma que la base
//   lo guardó: un UPDATE que el permiso filtra no da error, sólo 0 renglones (regla 2). Una lectura que falla no es permiso: frena.
//   Ya guardado, anota el porqué en el historial de la orden (`anotar`, el order_timeline de App) y dice si quedó: el precio ya cambió aunque la
//   línea falle, y App avisa para que se anote a mano. Devuelve { error } en palabras, o { upd, antes, isMaq, precio, anotado } (antes = el precio
//   que la base tenía, no el de la pantalla).
export const COLUMNAS_PARA_CORREGIR = "id,price,maq_price,order_type,stage,invoice_folio,grouped_invoice_folio,credit_applied_at,invoice_reason,oc_invoice_group_id";
export async function corregirPrecioEnLaBase({ supabase, orden, nuevo, motivo = "", anotar = null, puede, enPalabras = e => String(e?.message || e || "error"),
  quien = {}, formato = n => "$" + Number(n).toFixed(2) }) {
  const nombre = orden?.production_number || "La orden";
  const precio = Math.round(Number(nuevo) * 100) / 100;
  // (vuelta 1, cor-17 y cor-18) la ventana ya lo valida y redondea; aquí también, porque esto es lo que llega a la base
  if (!orden?.id || !Number.isFinite(precio) || precio <= 0) return { error: "El precio nuevo no es válido: no se cambió." };
  if (!puede(orden)) return { error: nombre + ": el precio ya no se corrige aquí (ya se facturó, se entregó o se canceló)." };
  const { data: fr, error: fe } = await supabase.from("orders").select(COLUMNAS_PARA_CORREGIR).eq("id", orden.id).maybeSingle();
  if (fe) return { error: "No se pudo leer la orden (" + enPalabras(fe) + "): no se cambió el precio. Reintenta." };
  if (!fr) return { error: nombre + " ya no está en la base: no se cambió el precio." };
  const vivo = { ...orden, ...fr };
  if (!puede(vivo)) return { error: "Mientras corregías, " + nombre + " cambió (ya tiene folio, se entregó, se canceló o se pagó con saldo a favor): el precio ya no se corrige aquí." };
  const [r1, r2] = await Promise.all([
    supabase.from("order_invoice_splits").select("id", { count: "exact", head: true }).eq("order_id", orden.id).is("cancelled_at", null),
    supabase.from("oc_invoice_split_lines").select("id", { count: "exact", head: true }).eq("order_id", orden.id).is("cancelled_at", null)]);
  if (r1.error || r2.error) return { error: "No se pudo revisar si ya se factura por partes o en el plan matriz (" + enPalabras(r1.error || r2.error) + "): no se cambió el precio. Reintenta." };
  if ((r1.count || 0) > 0 || (r2.count || 0) > 0) return { error: nombre + " ya se factura por partes o en el plan matriz de su OC: el precio ya no se corrige aquí." };
  const isMaq = vivo.order_type === "maquila", col = isMaq ? "maq_price" : "price", antes = Number(vivo[col]) || 0;
  // (vuelta 1, cor-15) alguien ya lo dejó en ese precio mientras tanto: nada que escribir ni que anotar
  if (Math.round(antes * 100) === Math.round(precio * 100)) return { error: nombre + " ya vale " + formato(precio) + " sin IVA en la base (quizá alguien lo corrigió mientras tanto): no hay nada que cambiar." };
  // (vuelta 1, cor-02) con quién: el historial de la base lo atribuye por last_edited_* (como la forma de la orden)
  const upd = { [col]: precio, ...quien };
  const { data: g, error } = await supabase.from("orders").update(upd).eq("id", orden.id).select("id," + col);
  if (error) return { error: "La base no aceptó el precio (" + enPalabras(error) + "): no se cambió." };
  // (vuelta 1, cor-14) el permiso que filtra el renglón no da error: se confirma con lo que la base devolvió
  const fila = Array.isArray(g) ? g[0] : g;
  if (!fila || Math.round(Number(fila[col]) * 100) !== Math.round(precio * 100))
    return { error: "La base no guardó el precio de " + nombre + " (no dejó cambiar esa orden): no se cambió. Avísale a Dirección." };
  // (vuelta 3, cor-19 a cor-21) el porqué, después de guardar y sólo si se guardó
  let anotado = true;
  if (anotar) { try { await anotar("💰 Precio corregido: " + formato(antes) + " → " + formato(precio) + " sin IVA" + (isMaq ? " (maquila)" : "") + (motivo ? " · " + motivo : "")); } catch (e) { anotado = false; } }
  return { upd, antes, isMaq, precio, anotado };
}
