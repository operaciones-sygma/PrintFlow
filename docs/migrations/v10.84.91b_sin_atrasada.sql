-- v10.84.91b — SIN «🔴 ATRASADA · » (Marcelo, 12-oct): la marca de las 37 importadas atrasadas, en el nombre del trabajo (product_type)
-- y en la descripción (product), que la traen las mismas 37. Migración APARTE y CORTA (revisión de CobranzaFlow, 13-oct): el DISABLE
-- TRIGGER toma un ACCESS EXCLUSIVE sobre orders, que también frena sus lecturas, así que va solo, sin las 979 de la categoría.
-- 36 de las 37 están facturadas (21 con factura viva en cobranza; sin CFDI sólo R-1219 y R-1217, remisiones de Alpha) y ninguna
-- impresa: sin trg_auto_mark_post_invoice_edits mientras se limpian, no se marcan «editadas después de facturar» (sólo cambia el
-- texto). El antes queda en order_change_log (log_order_field_changes, por «sistema») y en el audit_log. El concepto de las facturas
-- en Por Timbrar no cambia (el motor usa la auto_description de la orden sólo de respaldo, y quitar la marca sólo la mejora).
DO $mig$
DECLARE v_atr jsonb; v_n int;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'tipo', product_type, 'descripcion', product)) INTO v_atr
    FROM public.orders WHERE product_type LIKE '🔴 ATRASADA · %' OR product LIKE '🔴 ATRASADA · %';
  ALTER TABLE public.orders DISABLE TRIGGER trg_auto_mark_post_invoice_edits;
  UPDATE public.orders SET product_type = regexp_replace(product_type, '^🔴 ATRASADA · ', ''),
                           product = regexp_replace(product, '^🔴 ATRASADA · ', '')
   WHERE product_type LIKE '🔴 ATRASADA · %' OR product LIKE '🔴 ATRASADA · %';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  ALTER TABLE public.orders ENABLE TRIGGER trg_auto_mark_post_invoice_edits;
  IF v_n <> 37 THEN RAISE EXCEPTION 'se esperaban 37 órdenes con la marca y son %', v_n; END IF;
  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('v10_84_91b_sin_atrasada', 'order', NULL, jsonb_build_object('ordenes', v_n, 'antes', v_atr), 'sistema');
END $mig$;
