-- v10.84.170 (datos) — LA OC-1060 DE PORTLAND LEATHER PASA DE F-236 (CANCELADA) A F-253 (Marcelo, 2-nov-2026: «me dice Karla que canceló la factura 236,
-- pero las órdenes ligadas a esa factura no se liberaron… puedes arreglarlo e investigarlo»).
-- F-236 ($26,680.00) salió el 29-oct del folio compartido de la OC-1060 (P-0685 y P-0686, $11,500 + IVA cada una) y Karla la canceló desde CobranzaFlow
-- esa tarde, motivo 03, sin sustituta (el barrido del 30-oct la anotó como «cfdi_cancelado_fuera_de_la_app»: la app no la había visto aceptada; corregido
-- el 2-nov, después de aplicar: decía «por fuera de la app»; quién la pidió está en cfdi_documents.canceled_by). Cancelar NO suelta las órdenes (regla de
-- CobranzaFlow desde v3.7.1033: la factura que reemplaza las adopta). Hoy Karla hizo F-253 por lo mismo, sin orden. Pero el «Ligar a P-…» de CobranzaFlow
-- no pasa órdenes de una OC con folio compartido («se libera y se liga desde la OC, en PrintFlow»), y en PrintFlow el camino («Liberar folio cancelado de
-- la OC», en el detalle de la OC, en «Histórico») no se ve desde las órdenes. Además, liberar las regresa a Salidas y ligar las da por entregadas HOY.
-- Lo que hace, en una transacción y firmado como Marcelo (admin), por las dos puertas de siempre y con sus candados, como pasar_orden_a_factura:
--   1. release_cancelled_oc_shared_folio('OC-1060'): suelta F-236 de la OC y de sus órdenes.
--   2. link_invoice_to_oc('OC-1060', 'F-253'): F-253 gana su OC y las órdenes su folio.
--   3. Las órdenes conservan su entrega del 29-oct y la OC vuelve a completada (ligar las daba por entregadas hoy: los $23,000 se iban a noviembre).
--   4. Comprueba que todo quedó así (si no, no cambia nada) y lo deja en la bitácora.
-- Antes revisa que todo siga como se midió: si alguien ya movió algo, se detiene sin tocar nada.
-- Vuelta atrás: no aplica tal cual (F-236 está cancelada ante el SAT y no regresa); si hiciera falta soltar F-253, por la misma puerta:
-- release (cuando F-253 se cancele) o a mano con lo que dice la bitácora 'oc_pasada_a_factura_nueva'.
DO $datos$
DECLARE
  c_oc constant text := 'OC-1060';
  c_entrega constant timestamptz := '2026-10-29 19:46:01.024844+00';
  c_f253 constant uuid := 'ef02e50f-d443-43a9-87ae-25732884c0ab';
  v_uid uuid; v_suelta jsonb; v_liga jsonb; v_n int; v_oc text;
BEGIN
  SET LOCAL lock_timeout = '5s';
  -- 0. todo sigue como se midió
  IF (SELECT shared_invoice_folio FROM public.purchase_orders WHERE id = c_oc) IS DISTINCT FROM 'F-236' THEN
    RAISE EXCEPTION 'La OC-1060 ya no tiene F-236: alguien la movió; no se cambió nada.'; END IF;
  SELECT count(*) INTO v_n FROM public.orders
   WHERE purchase_order_id = c_oc AND invoice_folio = 'F-236' AND stage = 'delivered' AND delivered_at = c_entrega AND cancelled_at IS NULL;
  IF v_n <> 2 THEN RAISE EXCEPTION 'Las órdenes de la OC-1060 ya no están como se midieron (% de 2): no se cambió nada.', v_n; END IF;
  IF (SELECT status FROM cobranza.invoices WHERE doc_type = 'factura' AND doc_number = 'F-236') IS DISTINCT FROM 'cancelada' THEN
    RAISE EXCEPTION 'F-236 no está cancelada: no se cambió nada.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM cobranza.invoices WHERE id = c_f253 AND doc_number = 'F-253' AND status <> 'cancelada'
                  AND source = 'sin_orden' AND source_order_id IS NULL) THEN
    RAISE EXCEPTION 'F-253 ya no está viva y sin ligar: no se cambió nada.'; END IF;

  -- 1 y 2. como Marcelo (admin de PrintFlow), por las dos puertas de siempre
  SELECT user_id INTO v_uid FROM public.users WHERE username = 'admin' AND role = 'admin';
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No encuentro la cuenta de Marcelo (admin).'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_suelta := public.release_cancelled_oc_shared_folio(c_oc, 'admin');
  v_liga := public.link_invoice_to_oc(c_oc, 'F-253', 'admin');
  RESET ROLE;

  -- 3. su entrega del 29-oct, y la OC completada como estaba
  UPDATE public.orders SET delivered_at = c_entrega
   WHERE purchase_order_id = c_oc AND invoice_folio = 'F-253' AND delivered_at IS DISTINCT FROM c_entrega;
  UPDATE public.purchase_orders SET status = 'completed', completed_at = c_entrega, completed_by = 'karla'
   WHERE id = c_oc AND (status IS DISTINCT FROM 'completed' OR completed_at IS DISTINCT FROM c_entrega OR completed_by IS DISTINCT FROM 'karla');

  -- 4. quedó como debía
  SELECT count(*) INTO v_n FROM public.orders
   WHERE purchase_order_id = c_oc AND invoice_folio = 'F-253' AND stage = 'delivered' AND delivered_at = c_entrega;
  IF v_n <> 2 THEN RAISE EXCEPTION 'Las órdenes no quedaron con F-253 y su entrega del 29-oct (% de 2): no se cambió nada.', v_n; END IF;
  SELECT shared_invoice_folio || '/' || status INTO v_oc FROM public.purchase_orders WHERE id = c_oc;
  IF v_oc IS DISTINCT FROM 'F-253/completed' THEN RAISE EXCEPTION 'La OC-1060 quedó %: no se cambió nada.', v_oc; END IF;
  IF (SELECT source_order_id FROM cobranza.invoices WHERE id = c_f253) IS DISTINCT FROM c_oc THEN
    RAISE EXCEPTION 'F-253 no quedó ligada a la OC-1060: no se cambió nada.'; END IF;
  IF EXISTS (SELECT 1 FROM cobranza.invoices WHERE doc_type = 'factura' AND doc_number = 'F-236' AND source_order_id IS NOT NULL) THEN
    RAISE EXCEPTION 'F-236 sigue colgada de la OC: no se cambió nada.'; END IF;

  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('oc_pasada_a_factura_nueva', 'invoice', c_f253,
    jsonb_build_object('oc_id', c_oc, 'ordenes', jsonb_build_array('P-0685', 'P-0686'), 'folio_viejo', 'F-236', 'folio_nuevo', 'F-253',
      'monto', 26680.00, 'entregadas', c_entrega,
      'por', 'datos v10.84.170 (Marcelo, 2-nov-2026): F-236 se canceló ante el SAT sin sustituta y la OC seguía con ella; Karla hizo F-253 por lo mismo',
      'suelta', v_suelta, 'liga', v_liga),
    'admin');
END $datos$;
