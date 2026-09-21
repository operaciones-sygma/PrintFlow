-- v10.84.12 — Candidatas para LIGAR en «Facturar siguiente parte» (21-sep-2026, tercero del lote).
-- La RPC facturar_siguiente_parte ya sabía ligar una factura que existe en cobranza (v10.84.7, p_allow_link +
-- p_folio; caso Portland P-0465/P-0466 resuelto por SQL), pero el modal no lo ofrecía: Karla no podía hacerlo
-- sola. Esta lista alimenta el selector «Esta entrega ya tiene factura»: las facturas/remisiones del cliente
-- de la orden que viven en cobranza SIN orden, no canceladas y que ninguna orden/OC/parte de PrintFlow usa.
-- `cabe` = el importe no rebasa lo que queda por facturar (con IVA si es factura). El ligado real vuelve a
-- validar todo (cliente, sin orden, no en uso, importe = parte × 1.16 ± 0.02).
CREATE OR REPLACE FUNCTION public.list_linkable_invoices_for_split(p_split_id uuid)
RETURNS TABLE(doc_number text, doc_type text, amount numeric, balance numeric, issued_date date, status text, cfdi_status text,
              dias_sin_orden integer, cabe boolean, notas text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $$
DECLARE v_resto RECORD; v_order RECORD; v_eff uuid; v_resto_factura numeric; v_resto_remision numeric;
BEGIN
  IF NOT (cobranza.is_admin_role() OR COALESCE(public.pf_uid_role() IN ('admin','karla','secretaria'), false)) THEN
    RAISE EXCEPTION 'Acceso restringido' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_resto FROM public.order_invoice_splits WHERE id = p_split_id;
  IF NOT FOUND OR v_resto.doc_type <> 'por_facturar' OR v_resto.cancelled_at IS NOT NULL THEN RETURN; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = v_resto.order_id;
  IF NOT FOUND OR v_order.cancelled_at IS NOT NULL THEN RETURN; END IF;

  -- mismo cliente que usa facturar_siguiente_parte para ligar (client_id de la orden; sin bill_to)
  IF v_order.client_id IS NOT NULL THEN v_eff := v_order.client_id; ELSE v_eff := cobranza.resolve_client(v_order.client); END IF;
  IF v_eff IS NULL THEN RETURN; END IF;
  v_resto_factura  := ROUND(v_resto.amount_portion * 1.16, 2);
  v_resto_remision := v_resto.amount_portion;

  RETURN QUERY
  SELECT i.doc_number, i.doc_type, i.amount, i.balance, i.issued_date, i.status, i.cfdi_status,
         (CURRENT_DATE - i.issued_date)::int,
         (i.amount <= (CASE WHEN i.doc_type = 'factura' THEN v_resto_factura ELSE v_resto_remision END) + 0.02),
         i.notas
  FROM cobranza.invoices i
  WHERE i.client_id = v_eff
    AND i.doc_type IN ('factura','remision')
    AND i.source_order_id IS NULL AND i.status <> 'cancelada'
    AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.invoice_folio = i.doc_number)
    AND NOT EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.shared_invoice_folio = i.doc_number)
    AND NOT EXISTS (SELECT 1 FROM public.oc_invoice_groups g WHERE g.folio = i.doc_number)
    AND NOT EXISTS (SELECT 1 FROM public.order_invoice_splits s WHERE s.invoice_folio = i.doc_number AND s.cancelled_at IS NULL)
  ORDER BY (i.amount <= (CASE WHEN i.doc_type = 'factura' THEN v_resto_factura ELSE v_resto_remision END) + 0.02) DESC, i.issued_date DESC;
END $$;
REVOKE ALL ON FUNCTION public.list_linkable_invoices_for_split(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_linkable_invoices_for_split(uuid) TO authenticated;
