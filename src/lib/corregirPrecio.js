// v10.84.112 — «Corregir precio» contra la base (Karla, P-0600 de PRIME PET), sin React, para probarlo con Node (tests/romper/corregir.mjs) con
//   una base de mentira. Relee la orden (si mientras se corregía se folió, se entregó, se canceló o se pagó con saldo, no), le pregunta a la base
//   si ya va por partes o en el plan matriz (no son columnas: las calcula reload) y guarda el precio en SU columna (maquila: maq_price) con quién
//   lo cambió: el historial de la base (order_change_log) atribuye por last_edited_* y sin ellos lo anotaba como «sistema». Confirma que la base
//   lo guardó: un UPDATE que el permiso filtra no da error, sólo 0 renglones (regla 2). Una lectura que falla no es permiso: frena.
//   Ya guardado, anota el porqué en el historial de la orden (`anotar`, el order_timeline de App) y dice si quedó: el precio ya cambió aunque la
//   línea falle, y App avisa para que se anote a mano. Devuelve { error } en palabras, o { upd, antes, isMaq, precio, anotado, avisado, fueraDeHorario }
//   (antes = el precio que la base tenía, no el de la pantalla).
// v10.84.115 — la revisión de CobranzaFlow y lo que decidió Marcelo (15-oct): el UPDATE lleva las mismas condiciones con que se revisó (sin folio,
//   agrupada, grupo de OC ni saldo aplicado, no entregada ni cancelada, y el precio que se leyó: si alguien la movió entre leer y escribir, no
//   escribe); el porqué de 8 letras; y avisa (`avisar`) a Dirección y a quien capturó la orden, con el antes, el después sin IVA y el porqué. Fuera
//   del horario de los avisos (`enHorarioDeAvisos`) la base los tira en silencio: el resultado lo dice para que la pantalla lo diga.
export const COLUMNAS_PARA_CORREGIR = "id,price,maq_price,order_type,stage,invoice_folio,grouped_invoice_folio,credit_applied_at,invoice_reason,oc_invoice_group_id,created_by,source,return_covered_by_folio,production_number,client";
// v10.84.115 — el horario en que la base entrega los avisos: is_business_hours (lunes a viernes, 9:00 a 18:59 de la Ciudad de México, UTC-6 todo el
//   año desde 2022); fuera de él, skip_silent_window_notifications los tira sin error.
export const enHorarioDeAvisos = (d = new Date()) => { const mx = new Date(d.getTime() - 6 * 3600000); const dia = mx.getUTCDay(), h = mx.getUTCHours();
  return dia >= 1 && dia <= 5 && h >= 9 && h < 19; };
// v10.84.115 — a quién se avisa (Marcelo, 15-oct: «a Dirección y a quien capturó la orden, para que no se repita»): Dirección y quien la capturó
//   (created_by: su usuario, como avisa la forma al editar), nunca quien corrige; los de sistema o importación, no.
export const destinosDelAviso = (orden, rol, usuario) => { const d = new Set(["admin"]); const c = String(orden?.created_by || "").trim();
  if (c && !["sistema", "import-historico", "web"].includes(c)) d.add(c); d.delete(rol); if (usuario) d.delete(usuario); return [...d]; };
const ETAPAS_FINALES = "(delivered,maq_delivered,cancelled,maq_cancelled,stocked,web_pending,web_rejected)";
export async function corregirPrecioEnLaBase({ supabase, orden, nuevo, motivo = "", anotar = null, avisar = null, puede, enPalabras = e => String(e?.message || e || "error"),
  quien = {}, formato = n => "$" + Number(n).toFixed(2), rol = "", usuario = "", ahora = () => new Date() }) {
  const nombre = orden?.production_number || "La orden";
  const precio = Math.round(Number(nuevo) * 100) / 100;
  const m = String(motivo || "").trim();
  // (vuelta 1, cor-17 y cor-18) la ventana ya lo valida y redondea; aquí también, porque esto es lo que llega a la base
  if (!orden?.id || !Number.isFinite(precio) || precio <= 0) return { error: "El precio nuevo no es válido: no se cambió." };
  // (v10.84.115, cor-37) el porqué de 8 letras sin los espacios de las orillas, como Ajustar y Re-facturar de CobranzaFlow
  if (m.length < 8) return { error: "Escribe por qué cambia (8 letras o más): no se cambió el precio." };
  // (v10.84.118) por aquí sólo lo que no tiene folio: lo foliado va por la base (corregirPrecioFoliado), que revisa su factura
  if (orden.invoice_folio) return { error: nombre + " ya tiene folio (" + orden.invoice_folio + "): su precio se corrige revisando su factura. Cierra y vuelve a abrir «Corregir precio»." };
  if (!puede(orden)) return { error: nombre + ": el precio ya no se corrige aquí (ya se facturó, se entregó o se canceló)." };
  const { data: fr, error: fe } = await supabase.from("orders").select(COLUMNAS_PARA_CORREGIR).eq("id", orden.id).maybeSingle();
  if (fe) return { error: "No se pudo leer la orden (" + enPalabras(fe) + "): no se cambió el precio. Reintenta." };
  if (!fr) return { error: nombre + " ya no está en la base: no se cambió el precio." };
  const vivo = { ...orden, ...fr };
  // (v10.84.118, cor-07) si mientras se corregía le asignaron folio, ya no va por aquí: lo dice (la ventana se vuelve a abrir revisando su factura)
  if (vivo.invoice_folio) return { error: "Mientras corregías, " + nombre + " recibió el folio " + vivo.invoice_folio + " (ya tiene folio): no se cambió el precio. Cierra y vuelve a abrir «Corregir precio», que ahora revisa su factura." };
  if (!puede(vivo)) return { error: "Mientras corregías, " + nombre + " cambió (ya tiene folio, se entregó, se canceló o se pagó con saldo a favor): el precio ya no se corrige aquí." };
  const [r1, r2] = await Promise.all([
    supabase.from("order_invoice_splits").select("id", { count: "exact", head: true }).eq("order_id", orden.id).is("cancelled_at", null),
    supabase.from("oc_invoice_split_lines").select("id", { count: "exact", head: true }).eq("order_id", orden.id).is("cancelled_at", null)]);
  if (r1.error || r2.error) return { error: "No se pudo revisar si ya se factura por partes o en el plan matriz (" + enPalabras(r1.error || r2.error) + "): no se cambió el precio. Reintenta." };
  if ((r1.count || 0) > 0 || (r2.count || 0) > 0) return { error: nombre + " ya se factura por partes o en el plan matriz de su OC: el precio ya no se corrige aquí." };
  const isMaq = vivo.order_type === "maquila", col = isMaq ? "maq_price" : "price", antes = Number(vivo[col]) || 0;
  const previo = vivo[col] == null || vivo[col] === "" ? null : Number(vivo[col]);
  // (vuelta 1, cor-15) alguien ya lo dejó en ese precio mientras tanto: nada que escribir ni que anotar
  if (Math.round(antes * 100) === Math.round(precio * 100)) return { error: nombre + " ya vale " + formato(precio) + " sin IVA en la base (quizá alguien lo corrigió mientras tanto): no hay nada que cambiar." };
  // (vuelta 1, cor-02) con quién: el historial de la base lo atribuye por last_edited_* (como la forma de la orden)
  const upd = { [col]: precio, ...quien };
  // (v10.84.115, cor-26 a cor-29) con las mismas condiciones con que se revisó: si entre leer y escribir se folió, se agrupó, entró a un grupo de OC,
  //   se pagó con saldo, se entregó o se canceló, o alguien más le cambió el precio, la base no escribe (0 renglones)
  let q = supabase.from("orders").update(upd).eq("id", orden.id).is("invoice_folio", null).is("grouped_invoice_folio", null).is("oc_invoice_group_id", null)
    .is("credit_applied_at", null).not("stage", "in", ETAPAS_FINALES);
  q = previo == null ? q.is(col, null) : q.eq(col, previo);
  const { data: g, error } = await q.select("id," + col);
  if (error) return { error: "La base no aceptó el precio (" + enPalabras(error) + "): no se cambió." };
  // (vuelta 1, cor-14) 0 renglones no es error en PostgREST: se confirma con lo que la base devolvió
  const fila = Array.isArray(g) ? g[0] : g;
  if (!fila || Math.round(Number(fila[col]) * 100) !== Math.round(precio * 100))
    return { error: "Mientras corregías, " + nombre + " cambió (otro precio, un folio o su etapa) o la base no dejó cambiarla: no se cambió el precio. Ciérrala y vuelve a abrirla." };
  // (vuelta 3, cor-19 a cor-21) el porqué, después de guardar y sólo si se guardó
  let anotado = true;
  if (anotar) { try { await anotar("💰 Precio corregido: " + formato(antes) + " → " + formato(precio) + " sin IVA" + (isMaq ? " (maquila)" : "") + " · " + m); } catch (e) { anotado = false; } }
  // (v10.84.115, cor-30 a cor-34) los avisos: a Dirección y a quien la capturó, con el antes, el después sin IVA y el porqué
  let avisado = true;
  if (avisar) {
    const mensaje = "💰 Precio corregido · " + nombre + (vivo.client ? " · " + vivo.client : "") + ": " + formato(antes) + " → " + formato(precio) + " sin IVA"
      + (isMaq ? " (maquila)" : "") + " · por " + (usuario || rol || "?") + " · «" + m + "»";
    // (cor-38) el porqué va en el mensaje y sólo ahí: la bandeja pinta aparte el «reason» como «Motivo:» (dos veces), como dijo CobranzaFlow
    for (const d of destinosDelAviso(vivo, rol, usuario)) { try { await avisar(d, mensaje); } catch (e) { avisado = false; } }
  }
  return { upd, antes, isMaq, precio, anotado, avisado, fueraDeHorario: !enHorarioDeAvisos(ahora()) };
}
// v10.84.115 — «Capturar precio» (la orden sin precio al asignar folio, PriceCaptureModal): con quién lo capturó (el historial de la base decía
//   «sistema»), sólo si sigue sin precio ni folio (si mientras tanto alguien le puso uno, no se pisa) y confirmado con lo que la base devolvió.
//   Devuelve { error } en palabras, o { ok, precio, col }.
export async function capturarPrecioEnLaBase({ supabase, orden, nuevo, quien = {}, enPalabras = e => String(e?.message || e || "error") }) {
  const nombre = orden?.production_number || "la orden";
  const precio = Math.round(Number(nuevo) * 100) / 100;
  if (!orden?.id || !Number.isFinite(precio) || precio <= 0) return { error: "el precio no es válido: no se guardó" };
  const col = orden.order_type === "maquila" ? "maq_price" : "price";
  const { data: g, error } = await supabase.from("orders").update({ [col]: precio, ...quien }).eq("id", orden.id)
    .is("invoice_folio", null).or(col + ".is.null," + col + ".eq.0").select("id," + col);
  if (error) return { error: "la base no aceptó el precio (" + enPalabras(error) + ")" };
  const fila = Array.isArray(g) ? g[0] : g;
  if (!fila || Math.round(Number(fila[col]) * 100) !== Math.round(precio * 100)) return { error: "mientras lo capturabas, " + nombre + " ya tiene precio o folio: no se guardó" };
  return { ok: true, precio, col };
}
// v10.84.118 — LO YA FOLIADO SIN TIMBRAR va por la puerta de la base (la entrega 2 de CobranzaFlow, v3.7.1010, aplicada el 15-oct): una sola regla para
//   PrintFlow y CobranzaFlow. `corregir_precio_revisar` sólo lee: si se puede (timbrada, con un CFDI anterior, con cobros, cubierta por otra
//   factura… no, con su camino), en cuánto queda la factura con el mismo folio y lo que avisa. `corregir_precio_orden` corrige con todo bloqueado,
//   compara lo que se vio (precio, folio e importe), deja que el puente mueva el MISMO folio y, si la factura no queda al centavo, deshace todo; deja
//   el rastro y AVISA ella (aquí no se anota ni se avisa: saldrían dobles). Lo que la base rechaza a propósito ya viene en palabras: se dice tal cual.
//   Devuelven { data } / { ok, precio, columna, nota } o { error }.
const deLaRed = e => /Failed to fetch|NetworkError|network|timeout|ECONN|fetch failed|Load failed/i.test(String(e?.message || e || ""));
export async function revisarPrecioFoliado({ supabase, orden, nuevo = null, enPalabras = e => String(e?.message || e || "error") }) {
  const precio = nuevo == null ? null : Math.round(Number(nuevo) * 100) / 100;
  if (!orden?.id) return { error: "no hay orden que revisar" };
  if (precio != null && (!Number.isFinite(precio) || precio <= 0)) return { error: "el precio nuevo no es válido" };
  const { data, error } = await supabase.rpc("corregir_precio_revisar", { p_order_id: orden.id, p_precio_nuevo: precio });
  if (error) return { error: enPalabras(error) };
  if (!data || typeof data !== "object") return { error: "la base no contestó" };
  return { data };
}
export async function corregirPrecioFoliado({ supabase, orden, nuevo, motivo = "", visto = {}, enPalabras = e => String(e?.message || e || "error") }) {
  const precio = Math.round(Number(nuevo) * 100) / 100;
  const m = String(motivo || "").trim();
  if (!orden?.id || !Number.isFinite(precio) || precio <= 0) return { error: "El precio nuevo no es válido: no se cambió." };
  if (m.length < 8) return { error: "Escribe por qué cambia (8 letras o más): no se cambió el precio." };
  const { data, error } = await supabase.rpc("corregir_precio_orden", { p_order_id: orden.id, p_precio_nuevo: precio, p_motivo: m,
    p_precio_visto: visto?.precio ?? null, p_folio_visto: visto?.folio ?? null, p_importe_visto: visto?.importe ?? null, p_conceptos: null });
  if (error) {
    const msg = String(error.message || "").replace(/^ERROR:\s*/, "").trim(), cod = String(error.code || "");
    // dos que se cruzan con la misma orden: Postgres cancela una (40P01) y nada queda a medias
    if (cod === "40P01") return { error: "Otra operación tocó " + (orden.production_number || "la orden") + " al mismo tiempo: no se cambió nada. Vuelve a intentarlo." };
    if (msg && !deLaRed(error) && ["22023", "42501", "P0001"].includes(cod)) return { error: msg };
    return { error: "No se cambió el precio: " + enPalabras(error) + ". Reintenta." };
  }
  if (!data || data.ok !== true) return { error: "La base no confirmó el cambio, así que no se dice que quedó: revisa la orden antes de volver a intentarlo." };
  return { ok: true, precio, columna: orden.order_type === "maquila" ? "maq_price" : "price", nota: String(data.nota || ""), res: data };
}
