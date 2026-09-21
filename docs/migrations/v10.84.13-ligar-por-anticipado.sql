-- v10.84.13 — Ligar por anticipado una factura que ya existe (21-sep-2026, tercero del lote).
-- Marcelo (18-sep): «agiliza a Karla y no le aparecen en su lista». El candado de assign_invoice (v3.7.465)
-- frena en CUALQUIER etapa cuando el cliente ya tiene una factura sin orden por el mismo importe (F-25 de
-- Castores ↔ P-0437), pero link_invoice_to_order sólo ligaba en Salidas / Recibida de maquila: en etapas
-- tempranas Karla veía el mensaje sin el botón «Sí, ligar». Ahora, antes de Salidas, el ligado queda como
-- PRE-ASIGNADO (invoice_pre_assigned = true, la etapa no cambia, no se entrega); en Salidas, «Entregar»
-- (deliver_only) sólo entrega, como con cualquier folio pre-asignado. list_linkable_invoices_for_order
-- deja de exigir la etapa para que el front encuentre la candidata.
-- Parche de texto con anclas contadas sobre las dos funciones; definiciones vivas registradas aparte.

DO $$
DECLARE v_def text; v_new text;
BEGIN
  -- ── link_invoice_to_order ──
  v_def := pg_get_functiondef('public.link_invoice_to_order'::regproc);
  IF md5(v_def) <> '365b47d5304208f7e27b6bdaf56840e4' THEN
    RAISE EXCEPTION 'link_invoice_to_order cambió desde que se escribió este parche (md5 %); releer', md5(v_def);
  END IF;
  IF (SELECT count(*) FROM regexp_matches(v_def, 'v_pm text; v_ref text; v_pay_amount numeric; v_ex_credited numeric;  -- v3\.7\.442', 'g')) <> 1
     OR (SELECT count(*) FROM regexp_matches(v_def, 'IF v_order\.stage NOT IN \(''salidas'',''maq_received''\) THEN RAISE EXCEPTION ''Stage inválido para foliar: %'', v_order\.stage USING ERRCODE=''22023''; END IF;', 'g')) <> 1
     OR (SELECT count(*) FROM regexp_matches(v_def, 'invoiced_at = NOW\(\), invoiced_by = p_actor, invoice_pre_assigned = false,\n    stage = v_new_stage, delivered_at = NOW\(\),', 'g')) <> 1
     OR (SELECT count(*) FROM regexp_matches(v_def, '''invoice_status'', v_ex_status, ''amount'', v_ex_amount, ''payment_status'', v_pay, ''payment_method'', v_pm, ''bank_reference'', v_ref\);', 'g')) <> 1 THEN
    RAISE EXCEPTION 'anclas no únicas en link_invoice_to_order';
  END IF;
  v_new := replace(v_def,
    'v_pm text; v_ref text; v_pay_amount numeric; v_ex_credited numeric;  -- v3.7.442',
    'v_pm text; v_ref text; v_pay_amount numeric; v_ex_credited numeric;  -- v3.7.442' || E'\n' ||
    '  v_pre boolean := false;  -- v10.84.13: ligado por anticipado (antes de Salidas)');
  v_new := replace(v_new,
    'IF v_order.stage NOT IN (''salidas'',''maq_received'') THEN RAISE EXCEPTION ''Stage inválido para foliar: %'', v_order.stage USING ERRCODE=''22023''; END IF;',
    '-- v10.84.13 — antes de Salidas se liga como PRE-ASIGNADO (la etapa no cambia, no se entrega); en' || E'\n' ||
    '  -- Salidas / Recibida de maquila se liga y se entrega, como siempre. Terminales, stock y web no.' || E'\n' ||
    '  IF v_order.stage IN (''delivered'',''maq_delivered'',''cancelled'',''maq_cancelled'',''stocked'') OR v_order.source = ''web'' THEN' || E'\n' ||
    '    RAISE EXCEPTION ''Stage inválido para foliar: %'', v_order.stage USING ERRCODE=''22023''; END IF;' || E'\n' ||
    '  v_pre := v_order.stage NOT IN (''salidas'',''maq_received'');');
  v_new := replace(v_new,
    'invoiced_at = NOW(), invoiced_by = p_actor, invoice_pre_assigned = false,' || E'\n' ||
    '    stage = v_new_stage, delivered_at = NOW(),',
    'invoiced_at = NOW(), invoiced_by = p_actor, invoice_pre_assigned = v_pre,' || E'\n' ||
    '    invoice_reason = CASE WHEN v_pre THEN ''Ligada por anticipado: la factura ya existía en cobranza ('' || v_folio || '')'' ELSE invoice_reason END,' || E'\n' ||
    '    stage = CASE WHEN v_pre THEN stage ELSE v_new_stage END, delivered_at = CASE WHEN v_pre THEN delivered_at ELSE NOW() END,');
  v_new := replace(v_new,
    '''invoice_status'', v_ex_status, ''amount'', v_ex_amount, ''payment_status'', v_pay, ''payment_method'', v_pm, ''bank_reference'', v_ref);',
    '''invoice_status'', v_ex_status, ''amount'', v_ex_amount, ''payment_status'', v_pay, ''payment_method'', v_pm, ''bank_reference'', v_ref,' || E'\n' ||
    '    ''pre_assigned'', v_pre, ''stage'', CASE WHEN v_pre THEN v_order.stage ELSE v_new_stage END);');
  EXECUTE v_new;

  -- ── list_linkable_invoices_for_order: sin exigir la etapa ──
  v_def := pg_get_functiondef('public.list_linkable_invoices_for_order'::regproc);
  IF (SELECT count(*) FROM regexp_matches(v_def, 'IF v_order\.invoice_folio IS NOT NULL OR v_order\.stage NOT IN \(''salidas'',''maq_received''\) THEN RETURN; END IF;', 'g')) <> 1 THEN
    RAISE EXCEPTION 'ancla no única en list_linkable_invoices_for_order';
  END IF;
  v_new := replace(v_def,
    'IF v_order.invoice_folio IS NOT NULL OR v_order.stage NOT IN (''salidas'',''maq_received'') THEN RETURN; END IF;',
    '-- v10.84.13 — también antes de Salidas (ligado por anticipado, pre-asignado); no en terminales/stock/web.' || E'\n' ||
    '  IF v_order.invoice_folio IS NOT NULL OR v_order.stage IN (''delivered'',''maq_delivered'',''cancelled'',''maq_cancelled'',''stocked'') OR v_order.source = ''web'' THEN RETURN; END IF;');
  EXECUTE v_new;
END $$;
