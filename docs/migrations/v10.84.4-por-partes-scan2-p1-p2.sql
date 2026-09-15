-- v10.84.4 / v3.7.670 — LO QUE CAZÓ EL SEGUNDO SCAN de «facturar por partes en el tiempo»
-- (23 agentes, 16 confirmados, 0 refutados). Lado base. Los P1 eran DOS caminos para cobrar dos veces:
--   · convertir/facturar-mixto una remisión que es PARTE VIVA de una orden por partes emitía una
--     factura nueva SIN tocar el plan de la orden (la parte seguía viva + la factura nueva);
--   · y mi propio trigger split_sigue_a_su_cfdi (v10.84.2) trataba la SUSTITUCIÓN (convertir remisiones)
--     como cancelación y devolvía el dinero al resto: la remisión sustituida + la factura nueva + el resto.
-- Y un P1 de dinero del cliente: el saldo a favor SIN vale aplicado a una factura que después se cancela
-- se quedaba consumido (el cliente perdía su saldo).
-- SQL exacto en supabase_migrations: v10_84_4_por_partes_scan2_p1_p2 + v10_84_4_definiciones_vivas
-- (pg_get_functiondef de las 6 funciones parchadas por texto, para que un re-apply no resucite la versión mala).

-- ─── 1. P1 · convertir_remisiones_en_factura y facturar_remisiones_mixto rechazan una remisión-PARTE ───
-- Parche de texto con ancla contada (n debe ser 1). En convertir, ANTES del candado de «sustituida»:
--   SELECT string_agg(i.doc_number, ', ') INTO v_mal FROM cobranza.invoices i
--    WHERE i.id = ANY(v_ids) AND i.source_order_id IS NOT NULL
--      AND EXISTS (SELECT 1 FROM public.order_invoice_splits s
--                   WHERE s.order_id = i.source_order_id AND s.invoice_folio = i.doc_number
--                     AND s.doc_type = i.doc_type AND s.cancelled_at IS NULL);
--   IF v_mal IS NOT NULL THEN
--     RAISE EXCEPTION '% es una parte de una orden facturada por partes: no se convierte desde aqui. Si hay
--       que facturarla, cancela la parte desde su orden en PrintFlow y emite con «Facturar siguiente parte».'
--       USING ERRCODE='22023';
--   END IF;
-- En mixto, el mismo candado justo después de `v_n := jsonb_array_length(p_lineas);`, con un bloque
-- DECLARE local (v_parte) porque la función no tenía variable libre.

-- ─── 2. split_sigue_a_su_cfdi: sustitución NO es cancelación; el motivo dice lo que es ───
CREATE OR REPLACE FUNCTION public.split_sigue_a_su_cfdi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $T$
DECLARE v_split RECORD; v_order RECORD; v_motivo text; v_regresa boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status <> 'cancelada' THEN RETURN NEW; END IF;
  IF NEW.source_order_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_split FROM public.order_invoice_splits
   WHERE order_id = NEW.source_order_id AND invoice_folio = NEW.doc_number AND doc_type = NEW.doc_type
     AND cancelled_at IS NULL
   LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  -- solo órdenes «por partes en el tiempo» (tienen o tuvieron resto); los splits clásicos no se tocan
  IF NOT EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE order_id = NEW.source_order_id AND doc_type = 'por_facturar') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.source_order_id FOR UPDATE;
  v_motivo := CASE
    WHEN NEW.sustituida_por_invoice_id IS NOT NULL THEN
      'Sustituida por ' || COALESCE((SELECT doc_number FROM cobranza.invoices WHERE id = NEW.sustituida_por_invoice_id), '?')
    WHEN COALESCE(NEW.cfdi_status,'') = 'canceled' THEN 'CFDI cancelado ante el SAT'
    WHEN NEW.doc_type = 'remision' THEN 'Remision cancelada en cobranza'
    ELSE 'Documento cancelado en cobranza' END || ' (' || NEW.doc_number || ')';
  -- el dinero regresa al resto SOLO si de verdad se canceló (no sustituida) y la orden sigue viva
  v_regresa := NEW.sustituida_por_invoice_id IS NULL
               AND v_order.cancelled_at IS NULL AND v_order.stage NOT LIKE '%cancelled%';
  UPDATE public.order_invoice_splits
     SET cancelled_at = NOW(), cancelled_by = 'sistema_cfdi', cancellation_reason = v_motivo
   WHERE id = v_split.id;
  IF v_regresa THEN
    UPDATE public.order_invoice_splits
       SET amount_portion = amount_portion + v_split.amount_portion,
           qty_portion = qty_portion + v_split.qty_portion,
           notes = COALESCE(notes,'') || format(E'\n[%s] regresan $%s (%s pzas) de %s: %s',
                     to_char(NOW(),'YYYY-MM-DD'), v_split.amount_portion, v_split.qty_portion, NEW.doc_number, v_motivo)
     WHERE order_id = NEW.source_order_id AND doc_type = 'por_facturar' AND cancelled_at IS NULL;
    IF NOT FOUND THEN
      INSERT INTO public.order_invoice_splits (order_id, position, qty_portion, amount_portion, doc_type, invoice_folio, invoiced_by, notes)
      SELECT NEW.source_order_id, COALESCE(MAX(position),0)+1, v_split.qty_portion, v_split.amount_portion, 'por_facturar', NULL, 'sistema_cfdi',
             format('Reabierto: regresa %s (%s)', NEW.doc_number, v_motivo)
        FROM public.order_invoice_splits WHERE order_id = NEW.source_order_id;
    END IF;
  END IF;
  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('split_cerrada_por_documento_cancelado', 'order_invoice_split', v_split.id,
    jsonb_build_object('order_id', NEW.source_order_id, 'folio', NEW.doc_number, 'invoice_id', NEW.id,
      'invoice_source', NEW.source, 'motivo', v_motivo, 'sustituida_por', NEW.sustituida_por_invoice_id,
      'amount_portion', v_split.amount_portion, 'qty_portion', v_split.qty_portion,
      'regreso_al_resto', v_regresa), 'sistema_cfdi');
  RETURN NEW;
END $T$;
REVOKE ALL ON FUNCTION public.split_sigue_a_su_cfdi() FROM PUBLIC, anon;

-- ─── 3. P1 · Saldo a favor SIN vale aplicado a una factura que después se cancela: REGRESA al cliente ───
-- Espejo de lo que ya hacían las cinco puertas con vale (void_prepayment, cancel_invoice_split_internal…).
CREATE OR REPLACE FUNCTION cobranza.saldo_a_favor_regresa_al_cancelar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'cobranza', 'public', 'pg_temp'
AS $T$
DECLARE v_c RECORD; v_pool numeric; v_leader uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status <> 'cancelada' THEN RETURN NEW; END IF;
  FOR v_c IN
    SELECT l.* FROM cobranza.client_credit_ledger l
     WHERE l.tipo = 'CONSUMO' AND l.source_invoice_id = NEW.id AND l.source_voucher_id IS NULL
       AND l.referencia LIKE 'Saldo a favor aplicado a %'
       AND NOT EXISTS (SELECT 1 FROM cobranza.client_credit_ledger r
                        WHERE r.tipo = 'REVERSO' AND r.source_invoice_id = NEW.id AND r.source_voucher_id IS NULL)
  LOOP
    v_leader := v_c.client_id;
    PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:'||v_leader::text));
    SELECT COALESCE(balance_despues,0) INTO v_pool FROM cobranza.client_credit_ledger
     WHERE client_id = v_leader ORDER BY created_at DESC, id DESC LIMIT 1;
    INSERT INTO cobranza.client_credit_ledger
      (client_id, tipo, monto, balance_despues, source_invoice_id, source_voucher_id, referencia, created_by)
    VALUES (v_leader, 'REVERSO', -v_c.monto, COALESCE(v_pool,0) - v_c.monto, NEW.id, NULL,
            'Reverso: ' || NEW.doc_number || ' cancelada; el saldo a favor regresa al cliente', 'sistema');
    -- el pago «saldo_a_favor» se cancela; si un candado (REP vigente) lo impide, queda en audit y NO se
    -- pierde el reverso del ledger (el dinero del cliente vale más que la foto del pago)
    BEGIN
      UPDATE cobranza.payments
         SET status = 'cancelado',
             notes = COALESCE(notes,'') || ' | CANCELADO: la factura se cancelo y el saldo a favor regreso al cliente'
       WHERE invoice_id = NEW.id AND payment_type = 'saldo_a_favor' AND status IN ('aplicado','verificado');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
      VALUES ('saldo_a_favor_reverso_pago_no_cancelado', 'invoice', NEW.id,
        jsonb_build_object('error', SQLERRM, 'folio', NEW.doc_number), 'sistema');
    END;
    INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
    VALUES ('saldo_a_favor_regresa', 'invoice', NEW.id,
      jsonb_build_object('folio', NEW.doc_number, 'client_id', v_leader, 'monto', -v_c.monto), 'sistema');
  END LOOP;
  RETURN NEW;
END $T$;
REVOKE ALL ON FUNCTION cobranza.saldo_a_favor_regresa_al_cancelar() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS trg_saldo_a_favor_regresa_al_cancelar ON cobranza.invoices;
CREATE TRIGGER trg_saldo_a_favor_regresa_al_cancelar
  AFTER UPDATE ON cobranza.invoices FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelada')
  EXECUTE FUNCTION cobranza.saldo_a_favor_regresa_al_cancelar();

-- ─── 4. P2 · client_credit_libre sabe si ESA factura ya recibió saldo (el botón no se ofrece dos veces) ───
-- Cambia la firma → DROP primero (si no, queda la vieja abierta como sobrecarga; inv 9/16).
DROP FUNCTION IF EXISTS public.client_credit_libre(uuid);
CREATE FUNCTION public.client_credit_libre(p_client_id uuid, p_invoice_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'cobranza', 'public', 'pg_temp'
AS $F$
  WITH lid AS (SELECT cobranza.resolve_anticipo_leader(p_client_id) AS id),
  pool AS (SELECT COALESCE((SELECT balance_despues FROM cobranza.client_credit_ledger
                             WHERE client_id = (SELECT id FROM lid) ORDER BY created_at DESC, id DESC LIMIT 1), 0) AS b),
  ap AS (SELECT COALESCE(SUM(v.amount - COALESCE((SELECT SUM(-l.monto) FROM cobranza.client_credit_ledger l
                                                   WHERE l.tipo='CONSUMO' AND l.source_voucher_id = v.id), 0)), 0) AS a
           FROM cobranza.cash_vouchers v
          WHERE v.concept='anticipo' AND v.status='activo'
            AND cobranza.resolve_anticipo_leader(v.client_id) = (SELECT id FROM lid))
  SELECT jsonb_build_object(
    'modo', COALESCE((SELECT billing_mode FROM cobranza.clients WHERE id = (SELECT id FROM lid)), 'normal'),
    'saldo', (SELECT b FROM pool),
    'apartado_en_vales', (SELECT a FROM ap),
    'libre', GREATEST(ROUND((SELECT b FROM pool) - (SELECT a FROM ap), 2), 0),
    'ya_aplicado_en_factura', p_invoice_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM cobranza.client_credit_ledger l
         WHERE l.tipo='CONSUMO' AND l.source_invoice_id = p_invoice_id AND l.source_voucher_id IS NULL));
$F$;
REVOKE ALL ON FUNCTION public.client_credit_libre(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_credit_libre(uuid, uuid) TO authenticated, service_role;

-- ─── 5. P3 · Las cascadas de cancelación cierran el resto AL ÚLTIMO ───
-- sync_cancellation_to_cobranza y cancel_invoiced_order: `ORDER BY position` →
--   `ORDER BY (doc_type = 'por_facturar'), position`
-- Si el resto se cerraba primero, la parte que se cancelaba después intentaba regresarle dinero a un
-- resto ya cerrado (y lo reabría). Parche de texto con ancla contada.

-- ─── 6. P3 · cancel_invoice_split_internal toma los candados ORDEN → PARTE ───
-- Mismo orden que facturar_siguiente_parte y cancel_invoiced_order; antes tomaba PARTE → ORDEN y podía
-- abrazarse (40P01) con el trigger del CFDI cancelado. El front reintenta una vez si aun así choca.
--   SELECT * INTO v_split FROM public.order_invoice_splits WHERE id = p_split_id;      -- sin candado
--   IF NOT FOUND THEN RAISE ... END IF;
--   PERFORM 1 FROM public.orders WHERE id = v_split.order_id FOR UPDATE;               -- 1º la orden
--   SELECT * INTO v_split FROM public.order_invoice_splits WHERE id = p_split_id FOR UPDATE;  -- 2º la parte

-- ─── 7. P2 · Si cambia el precio de una orden por partes, el resto SIGUE al precio (si puede absorberlo) ───
-- En sync_post_invoice_edit, antes del bloque de «splits / plan matriz» (v10.58.43 Fix #7):
--   DECLARE v_delta numeric; v_resto RECORD;
--   BEGIN
--     v_delta := CASE WHEN NEW.order_type = 'maquila'
--                     THEN COALESCE(NEW.maq_price,0) - COALESCE(OLD.maq_price,0)
--                     ELSE COALESCE(NEW.price,0) - COALESCE(OLD.price,0) END;
--     SELECT * INTO v_resto FROM public.order_invoice_splits
--      WHERE order_id = NEW.id AND doc_type = 'por_facturar' AND cancelled_at IS NULL LIMIT 1 FOR UPDATE;
--     IF v_resto.id IS NOT NULL AND v_delta <> 0 AND v_resto.amount_portion + v_delta > 0 THEN
--       UPDATE public.order_invoice_splits
--          SET amount_portion = amount_portion + v_delta,
--              notes = COALESCE(notes,'') || format(E'\n[%s] el precio de la orden cambio: el resto absorbe %s',
--                        to_char(NOW(),'YYYY-MM-DD'), v_delta)
--        WHERE id = v_resto.id;
--       INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
--       VALUES ('bridge_post_edit_resto_sigue_precio', 'order', NULL,
--               jsonb_build_object('order_id', NEW.id, 'delta', v_delta, 'resto_antes', v_resto.amount_portion,
--                                  'resto_despues', v_resto.amount_portion + v_delta), 'system_bridge');
--       RETURN NEW;
--     END IF;
--   END;
-- Si el resto NO puede absorber la baja (quedaría ≤ 0), no se toca: la invariante 31 lo grita y alguien decide.
