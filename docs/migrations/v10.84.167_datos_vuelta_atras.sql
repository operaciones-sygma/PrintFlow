-- v10.84.167 — VUELTA ATRÁS de v10.84.167_datos.sql: el precio de antes de las 176 órdenes (de cobranza.audit_log) y el catálogo sin precio de
-- lista ni nombre en la factura. Una orden cuyo precio ya no es el que se puso no se toca (lo dice al final).
DO $vuelta$
DECLARE v_det jsonb; n int; v_total int;
BEGIN
  SELECT details INTO v_det FROM cobranza.audit_log WHERE action = 'v10.84.167_precios_del_historial' ORDER BY created_at DESC LIMIT 1;
  IF v_det IS NULL THEN RAISE EXCEPTION 'no está el registro de v10.84.167 en cobranza.audit_log: no hay nada que regresar'; END IF;
  v_total := jsonb_array_length(v_det->'ordenes');
  ALTER TABLE public.orders DISABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders DISABLE TRIGGER trg_sync_post_invoice_edit;
  UPDATE public.orders o SET price = (x->>'antes')::numeric, last_edited_at = now(), last_edited_by = 'marcelo'
    FROM jsonb_array_elements(v_det->'ordenes') x WHERE o.id = x->>'id' AND o.price = (x->>'despues')::numeric;
  GET DIAGNOSTICS n = ROW_COUNT;
  ALTER TABLE public.orders ENABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders ENABLE TRIGGER trg_sync_post_invoice_edit;
  UPDATE public.client_products SET unit_price = NULL, specs = specs - 'nombre_factura' - 'nombre_factura_cliente'
    WHERE id IN ('4b03be82-63a4-4e16-b418-5c510e1cf8fd', 'cb65f0a1-0364-4705-b449-4286af51139e', '572e3937-07d0-49fc-aeb1-9985b20d1043', 'ceeab980-d8b4-4902-b001-7a28614c572b', '8f2e31d4-42a9-47f6-b28c-e59547acaf3d', '388c7baa-21b7-4038-96e9-da3d54f545f2', 'da1d9dac-bf27-48ca-bc00-daec72446ba7', '579e1d5a-410c-46a0-a041-554059739ff0', '55481cbf-9b45-4698-86c4-a060cd852aa6');
  RAISE NOTICE 'vuelta atrás de v10.84.167: % de % órdenes con su precio de antes; el catálogo sin precio de lista ni nombre', n, v_total;
END $vuelta$;
