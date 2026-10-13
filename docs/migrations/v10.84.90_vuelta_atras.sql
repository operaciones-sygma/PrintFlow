-- VUELTA ATRÁS de v10.84.90 (el candado del anticipo en «Dividir»): la definición de assign_folios_split_oc de ANTES, tal cual la dio
-- pg_get_functiondef (md5 d4d964da7c6c80723f2bee2a5be6ebca). Sólo si hiciera falta quitar el candado: correrla tal cual.
CREATE OR REPLACE FUNCTION public.assign_folios_split_oc(p_oc_id text, p_groups jsonb, p_pre_assigned boolean, p_reason text, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cobranza', 'pg_temp'
 SET "TimeZone" TO 'America/Mexico_City'
AS $function$
DECLARE
  v_oc public.purchase_orders%ROWTYPE;
  v_pending_orders TEXT[]; v_pending_count INT; v_groups_count INT;
  v_group jsonb; v_idx INT;
  v_folio TEXT; v_doc_type TEXT; v_prefix TEXT; v_folio_num INT;
  v_max_folio_factura INT := 0; v_max_folio_remision INT := 0;
  v_max_folio_serie_f INT := 0;  -- corte F-: max de folios de la serie propia SYGMA; sube el contador SEPARADO 'factura_f'
  v_max_folio_remision_rs INT := 0;  -- v3.7.412: el gemelo para RS-; sube el contador SEPARADO 'remision_rs'
  v_order_ids TEXT[]; v_payment_refs jsonb;
  v_all_folios TEXT[] := ARRAY[]::TEXT[]; v_all_order_ids TEXT[] := ARRAY[]::TEXT[];
  v_dup_check TEXT; v_invalid_price TEXT[];
  v_group_id uuid; v_now TIMESTAMPTZ := NOW();
  v_client_id uuid; v_seller_id uuid;
  v_group_client_ids uuid[]; v_group_client_id uuid;
  v_billing_mode TEXT;
  v_corona_credit_enabled boolean := false;
  v_subtotal NUMERIC; v_invoice_amount NUMERIC; v_iva_applied BOOLEAN;
  v_invoice_id uuid; v_invoice_balance NUMERIC; v_invoice_status TEXT;
  v_metodo_pago text; v_forma_pago text; v_cfdi_status text; v_cfdi_enabled boolean; v_datos_fiscales_ok boolean;  -- F1 P5
  v_refs_total_cents BIGINT; v_invoice_amount_cents BIGINT;
  v_ref jsonb; v_payment_type TEXT; v_payment_notes TEXT;
  v_cxc_user_id uuid;
  v_result jsonb := '[]'::jsonb;
  v_amount_text TEXT;
  v_corona_total_subtotal NUMERIC := 0;
  v_corona_balance NUMERIC := 0;
  v_corona_balance_per_group NUMERIC := 0;
BEGIN
  -- v10.58.10: gate de rol antes de asignar split folios (Karla/Lucero entry point fiscal).
  PERFORM public.verify_actor_role(p_actor, ARRAY['admin','karla']);

  IF p_actor IS NULL OR TRIM(p_actor) = '' THEN RAISE EXCEPTION 'Actor requerido'; END IF;
  IF p_pre_assigned AND (p_reason IS NULL OR TRIM(p_reason) = '') THEN
    RAISE EXCEPTION 'Razón requerida para pre-asignación';
  END IF;
  IF p_groups IS NULL OR jsonb_typeof(p_groups) != 'array' THEN
    RAISE EXCEPTION 'p_groups debe ser array';
  END IF;
  v_groups_count := jsonb_array_length(p_groups);
  p_groups := public.emit_group_folios(p_groups); -- F1 emisor: si el flag esta ON, genera los folios
  IF v_groups_count < 1 THEN RAISE EXCEPTION 'Debe haber al menos 1 grupo'; END IF;

  SELECT * INTO v_oc FROM public.purchase_orders WHERE id = p_oc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OC % no existe', p_oc_id; END IF;
  IF v_oc.status = 'cancelled' THEN RAISE EXCEPTION 'OC cancelada'; END IF;
  IF v_oc.folios_locked THEN RAISE EXCEPTION 'OC ya está bloqueada'; END IF;
  IF v_oc.shared_invoice_folio IS NOT NULL THEN
    RAISE EXCEPTION 'OC ya tiene folio compartido: %', v_oc.shared_invoice_folio;
  END IF;
  IF EXISTS(SELECT 1 FROM public.oc_invoice_groups WHERE purchase_order_id = p_oc_id) THEN
    RAISE EXCEPTION 'OC ya tiene grupos de factura asignados';
  END IF;

  IF v_oc.client_id IS NOT NULL THEN
    SELECT billing_mode INTO v_billing_mode FROM cobranza.clients WHERE id = v_oc.client_id;
  END IF;
  IF v_billing_mode = 'anticipo' THEN
    v_corona_credit_enabled := cobranza.is_corona_bridge_enabled();
  END IF;

  IF v_oc.is_web_oc THEN RAISE EXCEPTION 'OC web no soporta división'; END IF;

  SELECT array_agg(id ORDER BY production_number NULLS LAST, created_at)
    INTO v_pending_orders
    FROM public.orders
    WHERE purchase_order_id = p_oc_id AND invoice_folio IS NULL
      -- v3.7.438 — LAS OTRAS TRES PATAS. "Pendiente de facturar" se decidia SOLO por invoice_folio,
      -- asi que una orden ya facturada por plan matriz (grouped_invoice_folio) o por partes
      -- (order_invoice_splits / oc_invoice_split_lines) se veia pendiente y se le acuñaba un
      -- SEGUNDO folio: dos CFDI por la misma mercancia, al mismo cliente, el mismo dia.
      -- public.orden_ya_facturada tiene las cuatro juntas para que no vuelvan a desincronizarse.
      AND NOT public.orden_ya_facturada(id)
      AND stage NOT IN ('cancelled','maq_cancelled','delivered','maq_delivered','stocked');
  v_pending_count := COALESCE(array_length(v_pending_orders, 1), 0);
  IF v_pending_count = 0 THEN RAISE EXCEPTION 'OC sin órdenes pendientes de facturar'; END IF;

  SELECT array_agg(COALESCE(production_number::TEXT, id)) INTO v_invalid_price
    FROM public.orders WHERE id = ANY(v_pending_orders)
      AND COALESCE(CASE WHEN order_type='maquila' THEN maq_price ELSE price END, 0) <= 0;
  IF v_invalid_price IS NOT NULL THEN
    RAISE EXCEPTION 'Órdenes sin precio válido: %.', array_to_string(v_invalid_price, ', ');
  END IF;

  FOR v_idx IN 0..v_groups_count-1 LOOP
    v_group := p_groups -> v_idx;
    IF jsonb_typeof(v_group) != 'object' THEN RAISE EXCEPTION 'Grupo % no es objeto', v_idx+1; END IF;
    v_doc_type := v_group->>'doc_type';
    v_folio := v_group->>'folio';
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_group->'order_ids') AS e WHERE jsonb_typeof(e) = 'null') THEN
      RAISE EXCEPTION 'Grupo %: order_ids contiene NULL', v_idx+1;
    END IF;
    v_order_ids := ARRAY(SELECT jsonb_array_elements_text(v_group->'order_ids'));
    IF v_doc_type NOT IN ('factura','remision') THEN RAISE EXCEPTION 'Grupo %: doc_type inválido: %', v_idx+1, v_doc_type; END IF;
    -- corte F-: una factura puede traer serie D- (Alpha/historico, se sigue registrando por meses)
    -- o F- (serie propia SYGMA post-corte). El prefijo se deriva del FOLIO, NO de la config vigente:
    -- asi una D- vieja sigue validando despues del corte y una F- valida desde antes.
    v_prefix := CASE
      WHEN v_doc_type='factura' AND v_folio LIKE 'F-%' THEN 'F-'
      WHEN v_doc_type='factura' THEN 'D-'
      -- v3.7.412: emit_group_folios acuna 'RS-N' tras el corte y este mismo CASE lo mandaba al
      -- ELSE 'R-', asi que el NOT LIKE de abajo rechazaba el folio que la funcion acababa de
      -- emitir. Misma forma que la rama F-: el prefijo sale del FOLIO, no de la config.
      WHEN v_folio LIKE 'RS-%' THEN 'RS-'
      ELSE 'R-' END;
    IF v_folio IS NULL OR v_folio NOT LIKE v_prefix || '%' THEN
      RAISE EXCEPTION 'Grupo %: folio inválido: %', v_idx+1, v_folio;
    END IF;
    BEGIN v_folio_num := SUBSTRING(v_folio FROM LENGTH(v_prefix)+1)::INT;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Grupo %: folio mal formado: %', v_idx+1, v_folio;
    END;
    IF v_folio_num <= 0 THEN RAISE EXCEPTION 'Grupo %: número de folio debe ser positivo', v_idx+1; END IF;
    IF array_length(v_order_ids, 1) IS NULL OR array_length(v_order_ids, 1) = 0 THEN
      RAISE EXCEPTION 'Grupo %: order_ids vacío', v_idx+1;
    END IF;
    IF v_doc_type = 'factura' AND v_prefix = 'F-' THEN v_max_folio_serie_f := GREATEST(v_max_folio_serie_f, v_folio_num);
    ELSIF v_doc_type = 'factura' THEN v_max_folio_factura := GREATEST(v_max_folio_factura, v_folio_num);
    ELSIF v_prefix = 'RS-' THEN v_max_folio_remision_rs := GREATEST(v_max_folio_remision_rs, v_folio_num);  -- v3.7.412
    ELSE v_max_folio_remision := GREATEST(v_max_folio_remision, v_folio_num); END IF;
    v_all_folios := v_all_folios || v_folio;
    v_all_order_ids := v_all_order_ids || v_order_ids;
  END LOOP;

  IF (SELECT COUNT(*) FROM unnest(v_all_folios)) != (SELECT COUNT(DISTINCT f) FROM unnest(v_all_folios) f) THEN
    RAISE EXCEPTION 'Folios duplicados entre grupos'; END IF;
  IF (SELECT COUNT(*) FROM unnest(v_all_order_ids)) != (SELECT COUNT(DISTINCT o) FROM unnest(v_all_order_ids) o) THEN
    RAISE EXCEPTION 'order_id duplicado entre grupos'; END IF;
  IF COALESCE(array_length(v_all_order_ids, 1), 0) != v_pending_count THEN
    RAISE EXCEPTION 'Cobertura incompleta: % pendientes vs % asignadas', v_pending_count, COALESCE(array_length(v_all_order_ids, 1), 0); END IF;
  IF EXISTS(SELECT 1 FROM unnest(v_all_order_ids) AS o(id) WHERE o.id NOT IN (SELECT unnest(v_pending_orders))) THEN
    RAISE EXCEPTION 'Algún order_id no pertenece a la OC o no está pendiente'; END IF;

  SELECT invoice_folio INTO v_dup_check FROM public.orders WHERE invoice_folio = ANY(v_all_folios) LIMIT 1;
  IF v_dup_check IS NOT NULL THEN RAISE EXCEPTION 'Folio % ya asignado a otra orden', v_dup_check; END IF;
  SELECT shared_invoice_folio INTO v_dup_check FROM public.purchase_orders WHERE shared_invoice_folio = ANY(v_all_folios) LIMIT 1;
  IF v_dup_check IS NOT NULL THEN RAISE EXCEPTION 'Folio % ya es folio compartido en otra OC', v_dup_check; END IF;
  SELECT folio INTO v_dup_check FROM public.oc_invoice_groups WHERE folio = ANY(v_all_folios) LIMIT 1;
  IF v_dup_check IS NOT NULL THEN RAISE EXCEPTION 'Folio % ya está en otro grupo OC', v_dup_check; END IF;

  IF v_max_folio_factura > 0 THEN PERFORM 1 FROM public.invoice_counters WHERE type='factura' FOR UPDATE; END IF;
  IF v_max_folio_serie_f > 0 THEN PERFORM 1 FROM public.invoice_counters WHERE type='factura_f' FOR UPDATE; END IF;
  IF v_max_folio_remision > 0 THEN PERFORM 1 FROM public.invoice_counters WHERE type='remision' FOR UPDATE; END IF;
  IF v_max_folio_remision_rs > 0 THEN PERFORM 1 FROM public.invoice_counters WHERE type='remision_rs' FOR UPDATE; END IF;  -- v3.7.412

  IF v_oc.client_id IS NOT NULL THEN v_client_id := v_oc.client_id;
  ELSE v_client_id := cobranza.resolve_client(v_oc.client); END IF;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'No se pudo resolver client_id de la OC'; END IF;
  v_seller_id := cobranza.resolve_seller(v_oc.vendedor);

  SELECT id INTO v_cxc_user_id FROM cobranza.users WHERE username = p_actor AND active = true LIMIT 1;
  IF v_cxc_user_id IS NULL THEN
    SELECT id INTO v_cxc_user_id FROM cobranza.users WHERE role = 'cxc' AND active = true ORDER BY created_at LIMIT 1;
  END IF;
  IF v_corona_credit_enabled AND v_cxc_user_id IS NULL THEN
    RAISE EXCEPTION 'OC Corona con flag activo: no hay usuario cxc para registrar saldo a favor';
  END IF;

  IF v_corona_credit_enabled THEN
    SELECT COALESCE(SUM(CASE WHEN order_type='maquila' THEN maq_price ELSE price END), 0)
      INTO v_corona_total_subtotal
      FROM public.orders WHERE id = ANY(v_all_order_ids);

    SELECT COALESCE(balance_despues, 0) INTO v_corona_balance
      FROM cobranza.client_credit_ledger
      WHERE client_id = cobranza.resolve_anticipo_leader(v_client_id)
      ORDER BY created_at DESC LIMIT 1;

    IF v_corona_balance < v_corona_total_subtotal - 0.001 THEN
      RAISE EXCEPTION 'Saldo Corona insuficiente: cliente tiene $%, requiere $% para los % grupos. Faltan $%.',
        ROUND(v_corona_balance, 2), ROUND(v_corona_total_subtotal, 2),
        v_groups_count, ROUND(v_corona_total_subtotal - v_corona_balance, 2);
    END IF;
  END IF;

  FOR v_idx IN 0..v_groups_count-1 LOOP
    v_group := p_groups -> v_idx;
    v_doc_type := v_group->>'doc_type';
    v_folio := v_group->>'folio';
    v_order_ids := ARRAY(SELECT jsonb_array_elements_text(v_group->'order_ids'));
    v_payment_refs := COALESCE(v_group->'payment_refs', '[]'::jsonb);

    -- v10.58.23 P0: derivar client_id POR GRUPO desde las órdenes (no de la OC).
    -- Un grupo = 1 factura = 1 RFC receptor. Si el grupo mezcla client_ids, RAISE.
    SELECT array_agg(DISTINCT client_id) FILTER (WHERE client_id IS NOT NULL)
      INTO v_group_client_ids
      FROM public.orders WHERE id = ANY(v_order_ids);
    IF COALESCE(array_length(v_group_client_ids, 1), 0) > 1 THEN
      RAISE EXCEPTION 'Grupo % (folio %): mezcla órdenes de % clientes distintos. Una factura = 1 RFC receptor — separa las órdenes por cliente en grupos distintos.',
        v_idx+1, v_folio, array_length(v_group_client_ids, 1);
    END IF;
    v_group_client_id := COALESCE(v_group_client_ids[1], v_client_id);
    IF v_corona_credit_enabled AND v_group_client_id <> v_client_id THEN
      RAISE EXCEPTION 'Grupo % (folio %): OC Corona no soporta facturar a cliente distinto del titular del anticipo.', v_idx+1, v_folio;
    END IF;

    SELECT COALESCE(SUM(CASE WHEN order_type='maquila' THEN maq_price ELSE price END), 0)
      INTO v_subtotal FROM public.orders WHERE id = ANY(v_order_ids);
    IF v_subtotal <= 0 THEN RAISE EXCEPTION 'Grupo % (folio %): subtotal <= 0', v_idx+1, v_folio; END IF;
    v_iva_applied := (v_doc_type = 'factura');
    v_invoice_amount := CASE WHEN v_iva_applied THEN ROUND(v_subtotal * 1.16, 2) ELSE v_subtotal END;
    v_invoice_amount_cents := ROUND(v_invoice_amount * 100)::BIGINT;

    IF v_corona_credit_enabled AND jsonb_array_length(v_payment_refs) > 0 THEN
      RAISE EXCEPTION 'Grupo % (folio %): OC Corona con bridge activo se paga con saldo automático', v_idx+1, v_folio;
    END IF;

    v_refs_total_cents := 0;
    IF jsonb_array_length(v_payment_refs) > 0 THEN
      FOR v_ref IN SELECT * FROM jsonb_array_elements(v_payment_refs) LOOP
        v_payment_type := v_ref->>'method';
        IF v_payment_type NOT IN ('transferencia','tarjeta','tarjeta_credito','cheque','otro') THEN
          RAISE EXCEPTION 'Grupo % ref: método inválido: %', v_idx+1, v_payment_type;
        END IF;
        v_amount_text := v_ref->>'amount';
        IF v_amount_text IS NULL OR TRIM(v_amount_text) = '' THEN RAISE EXCEPTION 'Grupo % ref: amount NULL', v_idx+1; END IF;
        IF v_amount_text::NUMERIC <= 0 THEN RAISE EXCEPTION 'Grupo % ref: amount debe ser > 0', v_idx+1; END IF;
        -- v10.72.12: ref bancaria OPCIONAL (recomendada) — ya no se exige (paridad con bulk_sell_from_stock)
        v_refs_total_cents := v_refs_total_cents + ROUND(v_amount_text::NUMERIC * 100)::BIGINT;
      END LOOP;
      IF v_refs_total_cents > v_invoice_amount_cents THEN
        RAISE EXCEPTION 'Grupo % (folio %): suma de pagos $% excede total $%', v_idx+1, v_folio, (v_refs_total_cents/100.0), v_invoice_amount;
      END IF;
      IF v_cxc_user_id IS NULL THEN RAISE EXCEPTION 'No hay usuario cxc activo para registrar payments'; END IF;
    END IF;

    INSERT INTO public.oc_invoice_groups (purchase_order_id, folio, doc_type, position, amount, created_by)
    VALUES (p_oc_id, v_folio, v_doc_type, v_idx+1, v_invoice_amount, p_actor)
    RETURNING id INTO v_group_id;

    UPDATE public.orders SET
      invoice_folio = v_folio, invoice_type = v_doc_type,
      oc_invoice_group_id = v_group_id,
      invoice_pre_assigned = p_pre_assigned,
      invoice_reason = CASE WHEN p_pre_assigned THEN p_reason ELSE NULL END,
      invoiced_at = v_now, invoiced_by = p_actor,
      stage = CASE
        WHEN NOT p_pre_assigned AND order_type = 'maquila' THEN 'maq_delivered'
        WHEN NOT p_pre_assigned THEN 'delivered'
        ELSE stage END,
      delivered_at = CASE WHEN NOT p_pre_assigned THEN v_now ELSE delivered_at END
    WHERE id = ANY(v_order_ids);

    IF v_corona_credit_enabled THEN
      v_invoice_balance := 0; v_invoice_status := 'pagada';
    ELSIF v_refs_total_cents = v_invoice_amount_cents AND v_refs_total_cents > 0 THEN
      v_invoice_balance := 0; v_invoice_status := 'pagada';
    ELSIF v_refs_total_cents > 0 THEN
      v_invoice_balance := v_invoice_amount - v_refs_total_cents/100.0;
      v_invoice_status := 'parcial';
    ELSE
      v_invoice_balance := v_invoice_amount; v_invoice_status := 'pendiente';
    END IF;

    -- F1 P5 (#5): datos fiscales del CFDI (antes NULL → motor default PPD/99 en venta pagada).
    IF v_invoice_status = 'pagada' THEN
      v_metodo_pago := 'PUE';
      v_forma_pago := CASE (v_payment_refs->0->>'method')
        WHEN 'transferencia' THEN '03' WHEN 'tarjeta' THEN '28'
        WHEN 'tarjeta_credito' THEN '04' WHEN 'cheque' THEN '02' ELSE '03' END;
    ELSE
      v_metodo_pago := 'PPD'; v_forma_pago := '99';
    END IF;
    SELECT COALESCE((value->>'v')::boolean,false) INTO v_cfdi_enabled FROM cobranza.app_config WHERE key='cfdi_enabled';
    SELECT COALESCE(datos_fiscales_ok,false) INTO v_datos_fiscales_ok FROM cobranza.clients WHERE id=v_group_client_id;
    v_cfdi_status := CASE WHEN COALESCE(v_cfdi_enabled,false) AND v_doc_type='factura' AND v_datos_fiscales_ok THEN 'pending' ELSE 'none' END;

    INSERT INTO cobranza.invoices (doc_type, doc_number, client_id, seller, amount, balance,
      issued_date, source, source_order_id, status, metodo_pago, forma_pago, cfdi_status)
    VALUES (v_doc_type, v_folio, v_group_client_id, v_seller_id, v_invoice_amount, v_invoice_balance,
      v_now::date, 'printflow_bridge_oc', p_oc_id, v_invoice_status, v_metodo_pago, v_forma_pago, v_cfdi_status)
    RETURNING id INTO v_invoice_id;

    IF v_corona_credit_enabled THEN
      SELECT COALESCE(balance_despues, 0) INTO v_corona_balance_per_group
        FROM cobranza.client_credit_ledger
        WHERE client_id = cobranza.resolve_anticipo_leader(v_client_id)
        ORDER BY created_at DESC LIMIT 1;

      IF v_corona_balance_per_group < v_subtotal - 0.001 THEN
        RAISE EXCEPTION 'Saldo Corona insuficiente al procesar grupo % (folio %): tiene $%, requiere $%.',
          v_idx+1, v_folio, ROUND(v_corona_balance_per_group, 2), ROUND(v_subtotal, 2);
      END IF;

      PERFORM public.credit_consume(p_client_id := v_client_id, p_monto := v_subtotal,
        p_source_invoice_id := v_invoice_id,
        p_referencia := 'Aplicación saldo a favor (sin IVA) — OC ' || p_oc_id ||
                        ' grupo ' || (v_idx+1) || ' folio ' || v_folio,
        p_user := p_actor);
      INSERT INTO cobranza.payments (invoice_id, payment_type, amount, applied_by, status, notes)
      VALUES (v_invoice_id, 'saldo_a_favor', v_invoice_amount, v_cxc_user_id, 'aplicado',
        'Saldo a favor aplicado — OC ' || p_oc_id || ' grupo ' || (v_idx+1) || ' folio ' || v_folio);
      INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
      VALUES ('oc_split_apply_credit_corona', 'invoice', v_invoice_id,
              jsonb_build_object('oc_id', p_oc_id, 'group_id', v_group_id, 'group_position', v_idx+1,
                'folio', v_folio, 'client_id', v_client_id,
                'subtotal_no_iva_consumed', v_subtotal,
                'invoice_amount_with_iva', v_invoice_amount,
                'balance_before_this_group', v_corona_balance_per_group), p_actor);
    ELSIF jsonb_array_length(v_payment_refs) > 0 THEN
      FOR v_ref IN SELECT * FROM jsonb_array_elements(v_payment_refs) LOOP
        v_payment_type := v_ref->>'method';
        v_payment_notes := 'Pago al facturar OC ' || p_oc_id || ' grupo ' || (v_idx+1) ||
          ' - ' || v_payment_type ||
          CASE WHEN v_ref->>'bank_reference' IS NOT NULL THEN ' - ref: ' || (v_ref->>'bank_reference') ELSE '' END ||
          ' - por ' || p_actor ||
          CASE WHEN p_pre_assigned THEN ' (folio anticipado)' ELSE '' END || CASE WHEN NULLIF(TRIM(v_ref->>'notes'),'') IS NOT NULL THEN ' · Motivo: ' || (v_ref->>'notes') ELSE '' END;
        INSERT INTO cobranza.payments (invoice_id, payment_type, amount, bank_reference, applied_by, status, notes, bank_ref_omitted_intentional)
        VALUES (v_invoice_id, v_payment_type, (v_ref->>'amount')::NUMERIC,
          v_ref->>'bank_reference', v_cxc_user_id, 'aplicado', v_payment_notes,
          COALESCE((v_ref->>'bank_ref_omitted_intentional')::boolean, false));
      END LOOP;
    END IF;

    INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
    VALUES ('oc_split_create_invoice', 'invoice', v_invoice_id,
      jsonb_build_object('oc_id', p_oc_id, 'group_id', v_group_id, 'group_position', v_idx+1,
        'folio', v_folio, 'doc_type', v_doc_type,
        'order_count', array_length(v_order_ids, 1), 'order_ids', v_order_ids,
        'subtotal', v_subtotal, 'amount_with_iva', v_invoice_amount,
        'refs_count', jsonb_array_length(v_payment_refs),
        'balance', v_invoice_balance, 'status', v_invoice_status,
        'pre_assigned', p_pre_assigned, 'billing_mode', v_billing_mode,
        'corona_bridge_consumed', v_corona_credit_enabled,
        'client_id', v_group_client_id, 'oc_client_id', v_client_id,
        'cross_client_group', v_group_client_id <> v_client_id), p_actor);

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'group_id', v_group_id, 'folio', v_folio, 'doc_type', v_doc_type,
      'invoice_id', v_invoice_id, 'amount', v_invoice_amount,
      'balance', v_invoice_balance, 'status', v_invoice_status,
      'order_count', array_length(v_order_ids, 1),
      'client_id', v_group_client_id,
      'billing_mode', v_billing_mode));
  END LOOP;

  IF v_max_folio_factura > 0 THEN
    UPDATE public.invoice_counters SET last_number = GREATEST(last_number, v_max_folio_factura), updated_at = v_now
    WHERE type = 'factura';
  END IF;
  IF v_max_folio_serie_f > 0 THEN
    UPDATE public.invoice_counters SET last_number = GREATEST(last_number, v_max_folio_serie_f), updated_at = v_now
    WHERE type = 'factura_f';
  END IF;
  IF v_max_folio_remision > 0 THEN
    UPDATE public.invoice_counters SET last_number = GREATEST(last_number, v_max_folio_remision), updated_at = v_now
    WHERE type = 'remision';
  END IF;
  IF v_max_folio_remision_rs > 0 THEN  -- v3.7.412
    UPDATE public.invoice_counters SET last_number = GREATEST(last_number, v_max_folio_remision_rs), updated_at = v_now
    WHERE type = 'remision_rs';
  END IF;

  IF p_pre_assigned THEN
    UPDATE public.purchase_orders SET folios_locked = true, folios_locked_at = v_now,
      folios_locked_by = p_actor, folios_lock_reason = p_reason WHERE id = p_oc_id;
  END IF;

  RETURN jsonb_build_object('oc_id', p_oc_id, 'groups_count', v_groups_count,
    'pre_assigned', p_pre_assigned, 'billing_mode', v_billing_mode,
    'corona_bridge_enabled', v_corona_credit_enabled,
    'corona_balance_after', CASE WHEN v_corona_credit_enabled THEN v_corona_balance - v_corona_total_subtotal ELSE NULL END,
    'groups', v_result);
END$function$;
