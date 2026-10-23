-- v10.84.167 — D-6015 (OC-0491) CON LOS RENGLONES DE ALPHA (Marcelo, 22-oct-2026: «si necesitas datos de Alpha dímelo y se lo pido»; los trajo la sesión
-- del servidor de Alpha de su copia de sólo lectura). Era la única venta de inventario de 2026 que no cuadraba con los precios de lista (por $120) y se
-- había quedado repartida por piezas: el Soporte No 2 se cobró a $1.75 (no $1.71). Los 8 renglones de la factura (subtotal $79,300):
--   papel estampado 5 millares × $620 = 3,100 · soporte NO.3-25 5,000 × $3.41 = 17,050 · soporte CH-25 4,000 × $1.85 = 7,400 · soporte NO.2-25 3,000 ×
--   $1.75 = 5,250 · etiqueta colgante 15,000 × $2.10 = 31,500 · papel kraft 250 kg × $40 = 10,000 · etiqueta negra 6,000 × $0.25 = 1,500 · etiqueta de
--   billetera 2,000 × $1.75 = 3,500.
-- (Alpha la fecha el 08-jul-2026; PrintFlow y cobranza la tienen el 28-jul, el día que se capturó.) Sin los dos disparadores del puente sólo dentro de
-- la transacción, como v10.84.167_datos.sql; lo de antes queda en cobranza.audit_log («v10.84.167_d6015»). Ensayada con rollback: 8 órdenes, OC-0491 en
-- $79,300 antes y después, 0 marcadas, 0 discrepancias. Vuelta atrás: v10.84.167_d6015_vuelta_atras.sql.
DO $d6015$
DECLARE n int; v_antes numeric; v_despues numeric;
BEGIN
  CREATE TEMP TABLE _d6015 ON COMMIT DROP AS
  WITH alpha(sku, qty, importe) AS (VALUES ('CHIN-BLA', 20000, 10000.00), ('CHIN-IMP', 5000, 3100.00), ('ETIQ-COLG', 15000, 31500.00), ('ETIQ-NEG', 6000, 1500.00),
                                           ('SOP-3-25', 5000, 17050.00), ('SOP-CH-25', 4000, 7400.00), ('SOP-NO-2', 3000, 5250.00), ('TARJ-BILL', 2000, 3500.00))
  SELECT o.id, cp.sku, o.quantity, o.price antes, a.importe despues
  FROM public.orders o JOIN public.client_products cp ON cp.id = o.client_product_id
  JOIN alpha a ON a.sku = cp.sku AND a.qty = o.quantity
  WHERE o.invoice_folio = 'D-6015' AND o.stock_role = 'sale' AND o.cancelled_at IS NULL;
  SELECT count(*), sum(t.antes), sum(t.despues) INTO n, v_antes, v_despues FROM _d6015 t;
  IF n <> 8 OR v_antes <> 79300 OR v_despues <> 79300 THEN
    RAISE EXCEPTION 'D-6015: % órdenes, antes %, después % (esperaba 8, 79,300 y 79,300): no se aplica nada', n, v_antes, v_despues;
  END IF;
  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('v10.84.167_d6015', 'order', NULL, jsonb_build_object(
    'nota', 'D-6015 con los renglones de su factura en Alpha (antes: el total repartido por piezas). La suma de la OC no cambia.',
    'ordenes', (SELECT jsonb_agg(jsonb_build_object('id', id, 'sku', sku, 'piezas', quantity, 'antes', antes, 'despues', despues) ORDER BY sku) FROM _d6015)), 'marcelo');
  ALTER TABLE public.orders DISABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders DISABLE TRIGGER trg_sync_post_invoice_edit;
  UPDATE public.orders o SET price = d.despues, last_edited_at = now(), last_edited_by = 'marcelo' FROM _d6015 d WHERE o.id = d.id AND o.price = d.antes;
  GET DIAGNOSTICS n = ROW_COUNT;
  ALTER TABLE public.orders ENABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders ENABLE TRIGGER trg_sync_post_invoice_edit;
  IF n <> 8 THEN RAISE EXCEPTION 'D-6015: se cambiaron % órdenes (esperaba 8): no se aplica nada', n; END IF;
END $d6015$;
