-- v10.84.6 / v3.7.671 — LO QUE CAZÓ EL TERCER SCAN de «facturar por partes» (31 agentes, 16 hallazgos, 10 confirmados,
-- 1 dudoso, 1 refutado, 4 P3 sin verificar; todos los de base cerrados aquí). SQL exacto en supabase_migrations:
-- v10_84_6_por_partes_scan3 + v10_84_6_definiciones_vivas (pg_get_functiondef de las 3 funciones parchadas por texto).
-- Ensayo punta a punta con rollback (7 escenarios) en verde antes de dar por cerrado.

-- ─── 1. P1 · El saldo a favor SIGUE AL DINERO al convertir una remisión en factura ───
-- convertir_remisiones_en_factura mueve los pagos a la factura nueva y DESPUÉS cancela la remisión. El trigger
-- saldo_a_favor_regresa_al_cancelar (v3.7.670) encontraba el CONSUMO sin vale —que seguía apuntando a la
-- remisión— y lo reversaba: la factura nueva mostraba el pago de saldo a favor Y el cliente volvía a tener ese
-- saldo libre. Un dinero, dos créditos, sin alarma.
-- (a) convertir re-apunta el consumo (parche de texto, tras `GET DIAGNOSTICS v_mov_pagos = ROW_COUNT;`):
--   UPDATE cobranza.client_credit_ledger
--      SET source_invoice_id = v_new_id,
--          referencia = 'Saldo a favor aplicado a ' || v_folio || ' (venia de ' || COALESCE(referencia, '?') || ')'
--    WHERE tipo = 'CONSUMO' AND source_invoice_id = ANY(v_ids) AND source_voucher_id IS NULL
--      AND referencia LIKE 'Saldo a favor aplicado a %';
-- (b) el trigger no reversa en una SUSTITUCIÓN:
--   IF NEW.sustituida_por_invoice_id IS NOT NULL THEN RETURN NEW; END IF;
-- refacturar_documento no entra aquí: rechaza documentos con pagos aplicados (el saldo a favor es un pago).

-- ─── 2. P2 · cancelar_saldo_por_cfdi_cancelado: la discrepancia «sobrante» NO cuenta el saldo a favor sin vale ───
-- Ese pago lo regresa solo el trigger AFTER (REVERSO en el ledger); contarlo como sobrante lo convertía en crédito
-- dos veces cuando Contabilidad resolvía la discrepancia. Se excluye de v_pagos/v_pagado/v_pago_id todo pago
-- payment_type='saldo_a_favor' cuyo CONSUMO es sin vale, y la nota/discrepancia dicen «los $X de saldo a favor
-- regresan solos».

-- ─── 3. P2 · split_sigue_a_su_cfdi: splits CLÁSICOS también, y sustitución ante el SAT (motivo 01) ───
-- (a) Un split clásico (sin resto) cuya factura se cancelaba dejaba la PARTE VIVA con el documento muerto: dinero
--     sin CxC, «Dividida en N folios» en la ficha, y todas las salidas apuntaban a un resto que no existía (5 órdenes
--     así en prod: H-3641, P-0003, P-0203, P-0249, P-0351). Ahora la parte se cierra SIEMPRE y, si la orden sigue
--     viva, su dinero ABRE un resto «por facturar»: la orden pasa a ser por partes (aparece «Facturar siguiente
--     parte» y la invariante 31 la vigila).
-- (b) Cancelación ante el SAT con motivo 01: la sustituta vive en cfdi_documents.cancel_substitution_uuid (nadie
--     escribe invoices.sustituida_por_invoice_id). El trigger la resuelve por invoices.cfdi_uuid:
--       · sustituta = parte viva de la MISMA orden (salió del resto) → el dinero de la cancelada regresa al resto;
--       · sustituta = factura suelta del mismo cliente, sin orden, mismo importe (±$0.02) y sin parte → la parte
--         ADOPTA ese folio (sigue viva) y la sustituta queda ligada (source_order_id); nada regresa;
--       · si no cuadra → la parte se cierra «Sustituida ante el SAT por X», NO regresa dinero y se abre una
--         discrepancia cxc_vs_treasury para que alguien decida. La invariante 31 lo grita mientras tanto.
-- (c) Candados ORDEN → PARTE (antes tomaba la parte primero; los demás toman la orden primero).
CREATE OR REPLACE FUNCTION public.split_sigue_a_su_cfdi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $T$
DECLARE v_split RECORD; v_order RECORD; v_sub RECORD; v_motivo text; v_regresa boolean;
        v_sub_es_parte boolean := false; v_adopta boolean := false; v_esperado numeric; v_tuvo_resto boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status <> 'cancelada' THEN RETURN NEW; END IF;
  IF NEW.source_order_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_invoice_splits
                  WHERE order_id = NEW.source_order_id AND invoice_folio = NEW.doc_number AND doc_type = NEW.doc_type
                    AND cancelled_at IS NULL) THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.source_order_id FOR UPDATE;
  SELECT * INTO v_split FROM public.order_invoice_splits
   WHERE order_id = NEW.source_order_id AND invoice_folio = NEW.doc_number AND doc_type = NEW.doc_type
     AND cancelled_at IS NULL
   LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_tuvo_resto := EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE order_id = NEW.source_order_id AND doc_type = 'por_facturar');

  IF NEW.sustituida_por_invoice_id IS NOT NULL THEN
    SELECT * INTO v_sub FROM cobranza.invoices WHERE id = NEW.sustituida_por_invoice_id;
  ELSE
    SELECT i2.* INTO v_sub
      FROM cobranza.cfdi_documents d
      JOIN cobranza.invoices i2 ON upper(i2.cfdi_uuid::text) = upper(d.cancel_substitution_uuid::text)
     WHERE d.invoice_id = NEW.id AND d.cfdi_type = 'I' AND d.cancel_motive = '01'
       AND d.cancel_substitution_uuid IS NOT NULL AND i2.id <> NEW.id
     ORDER BY d.created_at DESC LIMIT 1;
  END IF;

  IF v_sub.id IS NOT NULL THEN
    v_sub_es_parte := v_sub.source_order_id = NEW.source_order_id AND EXISTS (
      SELECT 1 FROM public.order_invoice_splits s2
       WHERE s2.order_id = NEW.source_order_id AND s2.invoice_folio = v_sub.doc_number AND s2.doc_type = v_sub.doc_type
         AND s2.cancelled_at IS NULL AND s2.id <> v_split.id);
    IF NOT v_sub_es_parte THEN
      v_esperado := CASE WHEN v_sub.doc_type = 'factura' THEN ROUND(v_split.amount_portion * 1.16, 2) ELSE v_split.amount_portion END;
      v_adopta := v_sub.status <> 'cancelada' AND v_sub.client_id = NEW.client_id
                  AND v_sub.source_order_id IS NULL AND v_sub.doc_type IN ('factura','remision')
                  AND ABS(COALESCE(v_sub.amount,0) - v_esperado) <= 0.02
                  AND NOT EXISTS (SELECT 1 FROM public.order_invoice_splits s3 WHERE s3.invoice_folio = v_sub.doc_number AND s3.cancelled_at IS NULL);
    END IF;
  END IF;

  v_motivo := CASE
    WHEN v_sub.id IS NOT NULL AND NEW.sustituida_por_invoice_id IS NOT NULL THEN 'Sustituida por ' || v_sub.doc_number
    WHEN v_sub.id IS NOT NULL THEN 'Sustituida ante el SAT por ' || v_sub.doc_number
    WHEN COALESCE(NEW.cfdi_status,'') = 'canceled' THEN 'CFDI cancelado ante el SAT'
    WHEN NEW.doc_type = 'remision' THEN 'Remision cancelada en cobranza'
    ELSE 'Documento cancelado en cobranza' END || ' (' || NEW.doc_number || ')';

  IF v_adopta THEN
    UPDATE public.order_invoice_splits
       SET invoice_folio = v_sub.doc_number, doc_type = v_sub.doc_type,
           notes = COALESCE(notes,'') || format(E'\n[%s] %s: la parte adopta el folio %s', to_char(NOW(),'YYYY-MM-DD'), v_motivo, v_sub.doc_number)
     WHERE id = v_split.id;
    UPDATE cobranza.invoices SET source_order_id = NEW.source_order_id WHERE id = v_sub.id;
    INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
    VALUES ('split_adopta_sustituta', 'order_invoice_split', v_split.id,
      jsonb_build_object('order_id', NEW.source_order_id, 'folio_viejo', NEW.doc_number, 'folio_nuevo', v_sub.doc_number,
        'invoice_vieja', NEW.id, 'invoice_nueva', v_sub.id, 'motivo', v_motivo, 'amount_portion', v_split.amount_portion), 'sistema_cfdi');
    RETURN NEW;
  END IF;

  v_regresa := (v_sub.id IS NULL OR v_sub_es_parte)
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
             format('%s: regresa %s (%s)', CASE WHEN v_tuvo_resto THEN 'Reabierto' ELSE 'Abierto (la orden pasa a facturarse por partes)' END, NEW.doc_number, v_motivo)
        FROM public.order_invoice_splits WHERE order_id = NEW.source_order_id;
    END IF;
  ELSIF v_sub.id IS NOT NULL AND NOT v_sub_es_parte THEN
    INSERT INTO cobranza.audit_discrepancies (cross_type, description, amount_expected, amount_found, status)
    VALUES ('cxc_vs_treasury',
            'La parte ' || NEW.doc_number || ' de la orden ' || COALESCE(v_order.production_number, NEW.source_order_id)
            || ' se sustituyo por ' || v_sub.doc_number || ' ($' || COALESCE(v_sub.amount,0) || ', '
            || CASE WHEN v_sub.source_order_id IS NULL THEN 'sin orden' ELSE 'de otra orden' END
            || ') y no coincide con la parte ($' || v_split.amount_portion || ' sin IVA): decide si ' || v_sub.doc_number
            || ' es esa parte (ligala) o si el resto debe recuperar el dinero.',
            v_split.amount_portion, COALESCE(v_sub.amount,0), 'abierta');
  END IF;

  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('split_cerrada_por_documento_cancelado', 'order_invoice_split', v_split.id,
    jsonb_build_object('order_id', NEW.source_order_id, 'folio', NEW.doc_number, 'invoice_id', NEW.id,
      'invoice_source', NEW.source, 'motivo', v_motivo, 'sustituida_por', COALESCE(NEW.sustituida_por_invoice_id, v_sub.id),
      'sustituta_es_parte', v_sub_es_parte, 'tuvo_resto', v_tuvo_resto,
      'amount_portion', v_split.amount_portion, 'qty_portion', v_split.qty_portion,
      'regreso_al_resto', v_regresa), 'sistema_cfdi');
  RETURN NEW;
END $T$;
REVOKE ALL ON FUNCTION public.split_sigue_a_su_cfdi() FROM PUBLIC, anon;

-- ─── 4. P2 (dudoso, se cerró igual) · Si cambia la CANTIDAD de una orden por partes, el resto sigue a las piezas ───
-- sync_post_invoice_edit sólo seguía al precio; el pedido bajaba de 1,000 a 800 pzas y la última parte salía con
-- las piezas viejas (el CFDI declaraba 1,000 piezas de un pedido de 800). Parche de texto al inicio de la función:
--   IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
--     v_dq := NEW.quantity - OLD.quantity; resto FOR UPDATE;
--     IF resto.qty_portion + v_dq >= 1 → UPDATE qty_portion += v_dq + audit 'bridge_post_edit_resto_sigue_piezas'
--     ELSE → discrepancia cxc_vs_treasury «el resto no puede absorberlo: ajusta las partes a mano»
--   END IF;
-- y el trigger dispara también por cantidad:
DROP TRIGGER IF EXISTS trg_sync_post_invoice_edit ON public.orders;
CREATE TRIGGER trg_sync_post_invoice_edit AFTER UPDATE ON public.orders FOR EACH ROW
  WHEN (new.has_post_invoice_edits IS DISTINCT FROM old.has_post_invoice_edits
        OR (new.has_post_invoice_edits IS TRUE AND (new.price IS DISTINCT FROM old.price
                                                    OR new.maq_price IS DISTINCT FROM old.maq_price
                                                    OR new.quantity IS DISTINCT FROM old.quantity)))
  EXECUTE FUNCTION public.sync_post_invoice_edit();
-- Invariante 34 (cobranzaflow/supabase/invariantes.sql): piezas de partes vivas + restos por decisión = quantity.

-- ─── 5. P3 · La tercera puerta: cobranza.facturar_remision_parcial también rechaza una remisión-PARTE ───
-- (convertir y mixto ya la rechazaban desde v3.7.670; ésta conservaba EXECUTE aunque ya no tiene botón.)
--   IF v_rem.source_order_id IS NOT NULL AND EXISTS (parte viva con ese folio) THEN
--     RAISE EXCEPTION '% es una parte de una orden facturada por partes: se factura desde su orden en PrintFlow ...'
--   END IF;

-- Invariante 33 (nueva): ninguna parte viva cuelga de un documento cancelado. Probada en rojo.
