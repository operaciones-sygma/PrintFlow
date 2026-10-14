-- v10.84.102 — LOS CONCEPTOS TIMBRADOS DE UNA FACTURA SIN ORDEN, PARA PROPONER SUS PIEZAS EN EL PLAN MATRIZ DE UNA OC.
-- Karla (13-oct): F-143 y F-155 de PORTLAND cubren, cada una, un pedazo de los cuatro stickers de OC-0960; las piezas de cada orden había
-- que copiarlas de CobranzaFlow a mano (la critique del flujo de facturas de Karla lo marcó). Esta función SÓLO LEE.
-- OK de Marcelo (14-oct, «Si te doy mi ok para el cambio en la base si es necesario»); revisada por CobranzaFlow (14-oct: la puerta con
-- COALESCE en las dos partes, «NOT IN con rol NULL abre»; devolver iva_rate y objeto_imp porque 36 de 327 renglones no son de 16 %).
-- Ensayada contra producción con rollback (DO … RAISE EXCEPTION 'ENSAYO'), 10 de 10: Karla F-143 → 4 renglones, 2,643.78 sin IVA, 0.16/02;
-- ' f-155 ' → 4, 37,356.22; RS-31 → 0; F-140 (otro cliente) → 0; OC-0944 con F-143 → 0; OC inexistente → 0; uid sin rol → 42501; sin
-- sesión → 42501; anon EXECUTE false; authenticated true.
-- Mismo candado y misma regla de cliente que list_linkable_invoices_for_oc: la factura del cliente de la OC (public.oc_para_ligar), hecha
-- sin orden y no cancelada; su CFDI de ingreso vigente (el último timbrado). Sin CFDI (remisión, o sin timbrar): ningún renglón.
-- Vuelta atrás: DROP FUNCTION public.conceptos_para_ligar_en_oc(text, text);  (la pantalla dice «No pude leer los conceptos» y nada más)
CREATE OR REPLACE FUNCTION public.conceptos_para_ligar_en_oc(p_oc_id text, p_folio text)
 RETURNS TABLE(line_no integer, cantidad numeric, valor_unitario numeric, importe numeric, descuento numeric, iva_rate numeric, objeto_imp text, descripcion text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $function$
DECLARE v_fac record; v_inv uuid; v_doc uuid;
BEGIN
  IF NOT (COALESCE(cobranza.is_admin_role(), false) OR COALESCE(public.pf_uid_role() IN ('admin','karla'), false)) THEN
    RAISE EXCEPTION 'Acceso restringido' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_fac FROM public.oc_para_ligar(p_oc_id, 'factura');
  IF COALESCE(v_fac.n, 0) = 0 OR v_fac.client_id IS NULL OR v_fac.clientes_distintos > 1 THEN RETURN; END IF;
  SELECT i.id INTO v_inv FROM cobranza.invoices i
   WHERE i.client_id = v_fac.client_id AND i.source = 'sin_orden' AND i.source_order_id IS NULL AND i.status <> 'cancelada'
     AND upper(trim(i.doc_number)) = upper(trim(p_folio))
   LIMIT 1;
  IF v_inv IS NULL THEN RETURN; END IF;
  SELECT d.id INTO v_doc FROM cobranza.cfdi_documents d
   WHERE d.invoice_id = v_inv AND d.cfdi_type = 'I' AND d.status = 'stamped'
   ORDER BY d.stamped_at DESC NULLS LAST, d.created_at DESC LIMIT 1;
  IF v_doc IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT li.line_no, li.cantidad, li.valor_unitario, COALESCE(li.importe, round(li.cantidad * li.valor_unitario, 2)), COALESCE(li.descuento, 0),
         li.iva_rate, li.objeto_imp, li.descripcion
    FROM cobranza.cfdi_line_items li WHERE li.cfdi_document_id = v_doc ORDER BY li.line_no;
END $function$;
REVOKE ALL ON FUNCTION public.conceptos_para_ligar_en_oc(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conceptos_para_ligar_en_oc(text, text) TO authenticated, service_role;
