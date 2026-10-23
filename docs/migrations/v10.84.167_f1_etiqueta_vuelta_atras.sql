-- v10.84.167 — VUELTA ATRÁS de v10.84.167_f1_etiqueta.sql: la orden de F-1 vuelve a «Cordón para Etiqueta» (sólo si sigue como la dejó el arreglo).
DO $vuelta$
DECLARE n int;
BEGIN
  ALTER TABLE public.orders DISABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders DISABLE TRIGGER trg_sync_post_invoice_edit;
  UPDATE public.orders SET client_product_id = '572e3937-07d0-49fc-aeb1-9985b20d1043', product = 'Cordón para Etiqueta', last_edited_at = now(), last_edited_by = 'marcelo'
   WHERE id = 'fa5f3b14-2c42-4911-981b-fc1e5445b434' AND client_product_id = 'ceeab980-d8b4-4902-b001-7a28614c572b' AND invoice_folio = 'F-1';
  GET DIAGNOSTICS n = ROW_COUNT;
  ALTER TABLE public.orders ENABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders ENABLE TRIGGER trg_sync_post_invoice_edit;
  RAISE NOTICE 'vuelta atrás de F-1: % orden(es) de regreso a «Cordón para Etiqueta»', n;
END $vuelta$;
