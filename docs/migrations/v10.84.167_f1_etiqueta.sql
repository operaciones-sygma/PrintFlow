-- v10.84.167 — F-1 (OC-0680): LA ORDEN DICE LO QUE SE FACTURÓ (Marcelo, 22-oct-2026: «si arranca con lo tuyo… y sigo con tus recomendaciones»).
-- Su CFDI timbrado cobra «ETIQUETA CUADRA COLGANTE 25 CR» 5,000 × $2.10 = $10,500, pero la orden se capturó en el carrito como «Cordón para Etiqueta»
-- (el precio ya se corrigió con v10.84.167_datos.sql). Se liga al producto «Etiqueta colgante»: los reportes por producto y la descripción que lee
-- CobranzaFlow (auto_description) dicen lo mismo que la factura. El INVENTARIO no se mueve aquí (se descontó del cordón el 1-sep): lo arregla el
-- reconteo total que hará SYGMA (Marcelo: «después haremos un reconteo total de todo el inventario»).
-- Sin los dos disparadores del puente sólo dentro de la transacción (la orden está facturada: sin esto nacería una discrepancia falsa). Lo de antes
-- queda en cobranza.audit_log («v10.84.167_f1_etiqueta»). Ensayada con rollback: 1 orden, descripción «ETIQUETA CUADRA COLGANTE 25 CR», sin marca,
-- OC-0680 en $65,920 antes y después, 0 discrepancias. Vuelta atrás: v10.84.167_f1_etiqueta_vuelta_atras.sql.
DO $f1$
DECLARE n int;
BEGIN
  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('v10.84.167_f1_etiqueta', 'order', NULL, jsonb_build_object(
    'nota', 'F-1: la orden se capturó como Cordón para Etiqueta y su CFDI cobra ETIQUETA CUADRA COLGANTE 25 CR; se liga a Etiqueta colgante. El inventario lo arregla el reconteo total.',
    'orden', 'fa5f3b14-2c42-4911-981b-fc1e5445b434', 'oc', 'OC-0680',
    'antes', jsonb_build_object('client_product_id', '572e3937-07d0-49fc-aeb1-9985b20d1043', 'product', 'Cordón para Etiqueta'),
    'despues', jsonb_build_object('client_product_id', 'ceeab980-d8b4-4902-b001-7a28614c572b', 'product', 'Etiqueta colgante')), 'marcelo');
  ALTER TABLE public.orders DISABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders DISABLE TRIGGER trg_sync_post_invoice_edit;
  UPDATE public.orders SET client_product_id = 'ceeab980-d8b4-4902-b001-7a28614c572b', product = 'Etiqueta colgante', last_edited_at = now(), last_edited_by = 'marcelo'
   WHERE id = 'fa5f3b14-2c42-4911-981b-fc1e5445b434' AND client_product_id = '572e3937-07d0-49fc-aeb1-9985b20d1043' AND invoice_folio = 'F-1';
  GET DIAGNOSTICS n = ROW_COUNT;
  ALTER TABLE public.orders ENABLE TRIGGER trg_auto_mark_post_invoice_edits;
  ALTER TABLE public.orders ENABLE TRIGGER trg_sync_post_invoice_edit;
  IF n <> 1 THEN RAISE EXCEPTION 'F-1: se cambiaron % órdenes (esperaba 1): no se aplica nada', n; END IF;
END $f1$;
