-- v10.84.167 — LOS DATOS (Marcelo, 22-oct-2026: «¿no puedes sacar toda esa info de las facturas, y así ver sus precios y hacer los arreglos?…
-- y corrijamos el historial, y sigo tus recomendaciones»). No depende de v10.84.167_precio_por_renglon.sql. APLICADA el 22-oct ~12:36 con el OK escrito de
-- Marcelo («si aplica porfavor»), antes de las funciones (que van al subir la pantalla nueva), como `v10_84_167_datos`: 9 productos, 176 órdenes, 0
-- marcadas, 0 discrepancias, ninguna OC cambió de total; invariantes 87 de 87. Una sola transacción:
--   1. El precio de lista y el «nombre en la factura» de los 9 productos del apartado de Cuadra, de sus CFDI timbrados de septiembre y octubre (el
--      último de cada cliente): sólo donde todavía no hay (si Karla ya puso uno, se queda el suyo).
--   2. El precio de cada orden de las ventas de inventario de 2026 con 2 o más productos: 176 órdenes en 41 OC (13 F- con el importe de su renglón
--      del CFDI; 28 D- con los de lista, que cuadran al centavo). La suma de cada OC no cambia ($1,547,231.50 antes y después en esas 176; F-101 ya estaba bien). Si los datos ya no
--      son esos, se detiene sin cambiar nada. Lo de antes queda en cobranza.audit_log («v10.84.167_precios_del_historial»).
--   Pendientes para Karla: F-1 (su factura dice «ETIQUETA CUADRA COLGANTE» y la orden «Cordón para Etiqueta»: el inventario se descontó del cordón) y
--   D-6015 (no cuadra con los de lista por $120: se queda repartida).
-- Vuelta atrás: v10.84.167_datos_vuelta_atras.sql.
DO $datos$
DECLARE n int; v_cat int := 0; v_ocs int; v_antes numeric; v_despues numeric;
BEGIN
  UPDATE public.client_products SET unit_price = 40, specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('nombre_factura', 'PAPEL KRAFT PARA RELLENAR 25',
      'nombre_factura_cliente', jsonb_build_object('451519af-a50f-4cce-bf55-2b4630693c7a', 'PAPEL KRAFT BLANCO PARA RELLENO'))
    WHERE id = '4b03be82-63a4-4e16-b418-5c510e1cf8fd' AND unit_price IS NULL AND NOT (coalesce(specs, '{}'::jsonb) ? 'nombre_factura');   -- CHIN-BLA
  GET DIAGNOSTICS n = ROW_COUNT; v_cat := v_cat + n;
  UPDATE public.client_products SET unit_price = 0.62, specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('nombre_factura', 'PAPEL ESTAMPADO CUADRA CHINA')
    WHERE id = 'cb65f0a1-0364-4705-b449-4286af51139e' AND unit_price IS NULL AND NOT (coalesce(specs, '{}'::jsonb) ? 'nombre_factura');   -- CHIN-IMP
  GET DIAGNOSTICS n = ROW_COUNT; v_cat := v_cat + n;
  UPDATE public.client_products SET unit_price = 0.35, specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('nombre_factura', 'CORDON P/ETIQUETA 25')
    WHERE id = '572e3937-07d0-49fc-aeb1-9985b20d1043' AND unit_price IS NULL AND NOT (coalesce(specs, '{}'::jsonb) ? 'nombre_factura');   -- CORD-ETIQ
  GET DIAGNOSTICS n = ROW_COUNT; v_cat := v_cat + n;
  UPDATE public.client_products SET unit_price = 2.1, specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('nombre_factura', 'ETIQUETA CUADRA COLGANTE 25 CR',
      'nombre_factura_cliente', jsonb_build_object('451519af-a50f-4cce-bf55-2b4630693c7a', 'ETIQUETA COLGANTE CUADRA 25 C/HILO', 'b1b98e13-91b3-454c-b01a-fffb5306e450', 'ETIQUETA COLGANTE CUADRA 25'))
    WHERE id = 'ceeab980-d8b4-4902-b001-7a28614c572b' AND unit_price IS NULL AND NOT (coalesce(specs, '{}'::jsonb) ? 'nombre_factura');   -- ETIQ-COLG
  GET DIAGNOSTICS n = ROW_COUNT; v_cat := v_cat + n;
  UPDATE public.client_products SET unit_price = 0.25, specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('nombre_factura', 'ETIQUETA COLGANTE NEGRA')
    WHERE id = '8f2e31d4-42a9-47f6-b28c-e59547acaf3d' AND unit_price IS NULL AND NOT (coalesce(specs, '{}'::jsonb) ? 'nombre_factura');   -- ETIQ-NEG
  GET DIAGNOSTICS n = ROW_COUNT; v_cat := v_cat + n;
  UPDATE public.client_products SET unit_price = 3.41, specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('nombre_factura', 'SOPORTE CACHUCHA CUADRA NO.3-25')
    WHERE id = '388c7baa-21b7-4038-96e9-da3d54f545f2' AND unit_price IS NULL AND NOT (coalesce(specs, '{}'::jsonb) ? 'nombre_factura');   -- SOP-3-25
  GET DIAGNOSTICS n = ROW_COUNT; v_cat := v_cat + n;
  UPDATE public.client_products SET unit_price = 1.85, specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('nombre_factura', 'SOPORTE CACH CUADRA CH 25')
    WHERE id = 'da1d9dac-bf27-48ca-bc00-daec72446ba7' AND unit_price IS NULL AND NOT (coalesce(specs, '{}'::jsonb) ? 'nombre_factura');   -- SOP-CH-25
  GET DIAGNOSTICS n = ROW_COUNT; v_cat := v_cat + n;
  UPDATE public.client_products SET unit_price = 1.71, specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('nombre_factura', 'SOPORTE CACHUCHA CUADRA NO.2-25')
    WHERE id = '579e1d5a-410c-46a0-a041-554059739ff0' AND unit_price IS NULL AND NOT (coalesce(specs, '{}'::jsonb) ? 'nombre_factura');   -- SOP-NO-2
  GET DIAGNOSTICS n = ROW_COUNT; v_cat := v_cat + n;
  UPDATE public.client_products SET unit_price = 2.3, specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('nombre_factura', 'ETIQUETA P/BILLETERA CUADRA 25')
    WHERE id = '55481cbf-9b45-4698-86c4-a060cd852aa6' AND unit_price IS NULL AND NOT (coalesce(specs, '{}'::jsonb) ? 'nombre_factura');   -- TARJ-BILL
  GET DIAGNOSTICS n = ROW_COUNT; v_cat := v_cat + n;
  CREATE TEMP TABLE _v167 ON COMMIT DROP AS
  WITH lista(sku, precio) AS (VALUES ('CHIN-IMP',0.62::numeric),('ETIQ-COLG',2.10),('ETIQ-NEG',0.25),('SOP-3-25',3.41),('SOP-CH-25',1.85),('SOP-NO-2',1.71),('CORD-ETIQ',0.35)),
  ords AS (
    SELECT o.id, o.purchase_order_id oc, o.invoice_folio folio, cp.sku, o.quantity q, o.price
    FROM public.orders o JOIN public.client_products cp ON cp.id = o.client_product_id
    -- lo vendido hasta el 21-oct (lo que se midió): una venta de hoy en adelante no entra (con la base nueva ya nace con su precio)
    WHERE o.stock_role = 'sale' AND o.created_at >= '2026-01-01' AND o.created_at < '2026-10-22 00:00:00-06' AND o.cancelled_at IS NULL),
  multi AS (SELECT oc FROM ords GROUP BY oc HAVING count(*) > 1),
  lin AS (
    SELECT i.doc_number folio, l.importe,
      CASE WHEN l.descripcion ~* 'KRAFT|china blanco' THEN 'CHIN-BLA' WHEN l.descripcion ~* 'ESTAMPADO' THEN 'CHIN-IMP'
           WHEN l.descripcion ~* 'NEGRA' THEN 'ETIQ-NEG' WHEN l.descripcion ~* 'BILLETERA' THEN 'TARJ-BILL' WHEN l.descripcion ~* 'CORDON' THEN 'CORD-ETIQ'
           WHEN l.descripcion ~* 'COLGANTE' THEN 'ETIQ-COLG' WHEN l.descripcion ~* '3\.?-25' THEN 'SOP-3-25' WHEN l.descripcion ~* 'CH[ -]?25' THEN 'SOP-CH-25'
           WHEN l.descripcion ~* 'NO\.?\s*2-25' THEN 'SOP-NO-2' END sku
    FROM cobranza.invoices i JOIN cobranza.cfdi_documents d ON d.invoice_id = i.id AND d.status = 'stamped'
    JOIN cobranza.cfdi_line_items l ON l.cfdi_document_id = d.id
    WHERE i.doc_type = 'factura' AND i.doc_number LIKE 'F-%'),
  nuevo_f AS (
    SELECT o.*, (SELECT sum(l.importe) FROM lin l WHERE l.folio = o.folio
                  AND l.sku = CASE WHEN o.folio = 'F-1' AND o.sku = 'CORD-ETIQ' THEN 'ETIQ-COLG' ELSE o.sku END) nuevo
    FROM ords o WHERE o.folio LIKE 'F-%' AND o.oc IN (SELECT oc FROM multi) AND EXISTS (SELECT 1 FROM lin l WHERE l.folio = o.folio)),
  nuevo_d0 AS (
    SELECT o.*, CASE WHEN o.sku = 'CHIN-BLA' THEN (CASE WHEN o.q <= 2000 THEN o.q * 40 ELSE round(o.q / 80.0 * 40, 2) END)
                     WHEN o.sku = 'TARJ-BILL' THEN NULL ELSE o.q * l.precio END nuevo
    FROM ords o LEFT JOIN lista l ON l.sku = o.sku
    WHERE o.folio LIKE 'D-%' AND o.oc IN (SELECT oc FROM multi) AND o.folio <> 'D-6015'),
  nuevo_d AS (
    SELECT d.id, d.oc, d.folio, d.sku, d.q, d.price,
      coalesce(d.nuevo, (SELECT sum(x.price) FROM nuevo_d0 x WHERE x.oc = d.oc) - (SELECT sum(x.nuevo) FROM nuevo_d0 x WHERE x.oc = d.oc AND x.sku <> 'TARJ-BILL')) nuevo
    FROM nuevo_d0 d),
  todo AS (SELECT id, oc, folio, sku, q, price, nuevo FROM nuevo_f UNION ALL SELECT * FROM nuevo_d)
  SELECT id, oc, folio, sku, q, price, round(nuevo, 2) nuevo FROM todo WHERE nuevo IS DISTINCT FROM price;

  SELECT count(*), count(DISTINCT oc), coalesce(sum(price), 0), coalesce(sum(nuevo), 0) INTO n, v_ocs, v_antes, v_despues FROM _v167;
  IF n <> 176 OR v_ocs <> 41 OR v_antes <> 1547231.50 OR v_despues <> 1547231.50 THEN
    RAISE EXCEPTION 'esperaba 176 órdenes en 41 OC por $1,547,231.50 y salen % en % (antes % · después %): los datos cambiaron; no se aplica nada', n, v_ocs, v_antes, v_despues;
  END IF;
  SELECT count(*) INTO n FROM (SELECT oc FROM _v167 GROUP BY oc HAVING sum(nuevo) <> sum(price)) z;
  IF n > 0 THEN RAISE EXCEPTION '% OC no suman lo mismo: no se aplica nada', n; END IF;
  SELECT count(*) INTO n FROM _v167 WHERE nuevo IS NULL OR nuevo < 0;
  IF n > 0 THEN RAISE EXCEPTION '% órdenes sin precio nuevo: no se aplica nada', n; END IF;
  -- lo de antes y lo de después, en la bitácora de cobranza (no se borra ni se cambia): de ahí lee la vuelta atrás
  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('v10.84.167_precios_del_historial', 'order', NULL, jsonb_build_object(
    'nota', 'El precio de cada producto de las ventas de inventario de 2026 (antes: el total repartido por piezas). F- de su CFDI timbrado; D- con los de lista. La suma de cada OC no cambia.',
    'ordenes', (SELECT jsonb_agg(jsonb_build_object('id', id, 'oc', oc, 'folio', folio, 'sku', sku, 'piezas', q, 'antes', price, 'despues', nuevo) ORDER BY folio, sku) FROM _v167)), 'marcelo');
  -- Sin estos dos, cada precio corregido de una orden facturada se marcaría «editada después de facturar» y abriría una discrepancia (unas 190 falsas).
  -- Sólo dentro de esta transacción; la suma de cada OC no cambia, así que sus facturas tampoco.
  ALTER TABLE public.orders DISABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders DISABLE TRIGGER trg_sync_post_invoice_edit;
  UPDATE public.orders o SET price = v.nuevo, last_edited_at = now(), last_edited_by = 'marcelo'
    FROM _v167 v WHERE o.id = v.id AND o.price = v.price;
  GET DIAGNOSTICS n = ROW_COUNT;
  ALTER TABLE public.orders ENABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders ENABLE TRIGGER trg_sync_post_invoice_edit;
  IF n <> 176 THEN RAISE EXCEPTION 'se cambiaron % órdenes (esperaba 176): no se aplica nada', n; END IF;
  RAISE NOTICE 'v10.84.167: % productos con precio y nombre; 176 órdenes con su precio', v_cat;
END $datos$;
