-- v10.84.167 — VUELTA ATRÁS de v10.84.167_d6015.sql: las 8 órdenes de D-6015 vuelven al precio repartido de antes (de cobranza.audit_log); una orden
-- cuyo precio ya no es el que se puso no se toca.
DO $vuelta$
DECLARE v_det jsonb; n int;
BEGIN
  SELECT details INTO v_det FROM cobranza.audit_log WHERE action = 'v10.84.167_d6015' ORDER BY created_at DESC LIMIT 1;
  IF v_det IS NULL THEN RAISE EXCEPTION 'no está el registro de D-6015 en cobranza.audit_log: no hay nada que regresar'; END IF;
  ALTER TABLE public.orders DISABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders DISABLE TRIGGER trg_sync_post_invoice_edit;
  UPDATE public.orders o SET price = (x->>'antes')::numeric, last_edited_at = now(), last_edited_by = 'marcelo'
    FROM jsonb_array_elements(v_det->'ordenes') x WHERE o.id = x->>'id' AND o.price = (x->>'despues')::numeric;
  GET DIAGNOSTICS n = ROW_COUNT;
  ALTER TABLE public.orders ENABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders ENABLE TRIGGER trg_sync_post_invoice_edit;
  RAISE NOTICE 'vuelta atrás de D-6015: % de % órdenes con su precio de antes', n, jsonb_array_length(v_det->'ordenes');
END $vuelta$;
