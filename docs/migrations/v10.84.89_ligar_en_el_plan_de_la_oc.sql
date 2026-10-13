-- v10.84.89 — LIGAR EN EL PLAN DE LA OC UNA FACTURA QUE YA EXISTE (Karla, 13-oct: «que la OC funcione como facturar por partes,
-- donde hay una opción que dice ya hay una factura, ligarla, y deja escribir el folio»; Marcelo: «empieza. La F155 y F143»).
--
-- El caso: F-143 (6-oct, $3,066.78) y F-155 (13-oct, $43,333.22), de PORTLAND LEATHER, se hicieron sin orden en CobranzaFlow y
-- cubren, cada una, un PEDAZO de los cuatro stickers de OC-0960 (P-0592 a P-0595, 80,000 piezas cada uno): F-143 lleva 4,380 +
-- 3,528 + 7,395 + 5,520 piezas y F-155 el resto. Es justo el «plan matriz» de la OC (N facturas × M órdenes, con porciones), pero
-- el plan sólo sabía ACUÑAR: rechazaba todo folio que ya existiera en cobranza y su puente siempre creaba la factura.
--
-- 1. oc_invoice_split_groups.ligada: el grupo cuya factura ya existía y sólo se ligó (un nombre por dato: el puente, cancelar y
--    la pantalla lo leen de aquí, no lo adivinan por el origen de la factura).
-- 2. emit_plan_folios: el grupo con «ligar» conserva su folio y no gasta el contador.
-- 3. assign_oc_invoice_split_plan: un grupo con «ligar» pasa los candados del ligado (los de assign_invoice_splits y
--    link_invoice_to_oc): la factura existe y está viva (FOR UPDATE), es del cliente de la OC, no está ligada a nada, su importe
--    es el del grupo con IVA (±$0.02, el redondeo del CFDI) y, con el emisor activo, no pasa del contador; sin «Facturar a
--    tercero», sólo factura o remisión, y no para clientes de saldo a favor (Corona). Se liga (source_order_id = la OC), el
--    vendedor si no traía, la bitácora de cada orden y el audit_log; el grupo nace con el estado de pago de su factura (la regla de
--    sync_badge_pago_plan_matriz: saldo e importe). Y el CANDADO DEL ANTICIPO que esta puerta no tenía (el de assign_folio_to_oc
--    desde F-111/F-115): con el emisor activo, un grupo NUEVO cuyo importe es justo el de una factura sin orden del mismo cliente se
--    frena y se dice que se ligue (sin esto, olvidar «ligar» acuñaba F-156 y F-157 encima de F-143 y F-155).
-- 4. sync_invoice_from_oc_split_group: el grupo ligado no crea factura (con el índice único, el plan entero tronaba).
-- 5. cancel_oc_invoice_split_group: cancelar un grupo ligado la DESLIGA (vuelve a «Facturas esperando orden», como era) y no la
--    cancela ni toca sus cobros; las órdenes regresan a Salidas como siempre (reconcile_order_after_matrix_cancel). El audit dice
--    si de verdad se desligó (si ya se había cancelado en CobranzaFlow, no había nada que desligar).
-- 6. cancel_oc_split_line_internal: a un grupo ligado no se le quita un renglón (su importe no cambiaría); también frena la
--    cascada de cancelar una orden que va en él, diciendo qué hacer.
-- 7. cobranza.sync_badge_pago_plan_matriz (el texto es de CobranzaFlow, con su visto bueno): el cobro de la factura ligada también
--    pinta el estado de pago de su grupo, sólo el ligado de su OC y de su tipo.
-- Revisado por CobranzaFlow (13-oct) antes del ensayo: el paso 7 no por folio a secas, el estado de pago por saldo, «ligar» sólo
-- en factura o remisión con los escalares limpios en cada vuelta, y el ROW_COUNT al desligar. Después se registran las definiciones
-- vivas de las siete (v10_84_89_..._definiciones_vivas).
DO $mig$
DECLARE v_def text; v_pares text[][]; i int; v_a text; v_b text;
BEGIN
  -- 1. la columna
  ALTER TABLE public.oc_invoice_split_groups ADD COLUMN ligada boolean NOT NULL DEFAULT false;
  COMMENT ON COLUMN public.oc_invoice_split_groups.ligada IS
    'v10.84.89: la factura de este grupo ya existía en cobranza (hecha sin orden) y se LIGÓ: el puente no crea otra; cancelar el grupo la desliga, no la cancela.';

  -- 2. emit_plan_folios
  v_def := pg_get_functiondef('public.emit_plan_folios(jsonb)'::regprocedure);
  IF md5(v_def) <> '3341f33911f18d4bb1d9257675738f6b' THEN RAISE EXCEPTION 'emit_plan_folios cambió (md5 %)', md5(v_def); END IF;
  v_a := $a$    IF v_doc_type = 'factura' THEN
      v_next_factura := v_next_factura + 1;$a$;
  v_b := $a$    -- v10.84.89: el grupo que LIGA una factura que ya existe en cobranza conserva su folio y no gasta el contador
    IF COALESCE((v_group->>'ligar')::boolean, false) THEN
      v_out := v_out || jsonb_build_array(v_group);
    ELSIF v_doc_type = 'factura' THEN
      v_next_factura := v_next_factura + 1;$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla de emit_plan_folios'; END IF;
  EXECUTE replace(v_def, v_a, v_b);

  -- 3. assign_oc_invoice_split_plan
  v_def := pg_get_functiondef('public.assign_oc_invoice_split_plan(text,jsonb,text)'::regprocedure);
  IF md5(v_def) <> '7ce60591d4f5e4de44884c889a983a48' THEN RAISE EXCEPTION 'assign_oc_invoice_split_plan cambió (md5 %)', md5(v_def); END IF;
  v_pares := ARRAY[
    -- 3a. las variables
    ARRAY[$a$  v_bill_to jsonb; v_bt_id uuid; v_bt cobranza.clients; v_producer_mode text;$a$,
          $a$  v_bill_to jsonb; v_bt_id uuid; v_bt cobranza.clients; v_producer_mode text;
  -- v10.84.89: ligar en el plan una factura que ya existe en cobranza (escalares: un record sin asignar truena aunque la rama no corra)
  v_ligar boolean; v_ligar_folios text[]; v_client_eff uuid; v_emitter boolean; v_con_iva numeric; v_folio_vivo int; v_cnt int;
  v_ex_id uuid; v_ex_client uuid; v_ex_src text; v_ex_amount numeric; v_ex_balance numeric; v_ex_status text; v_ex_seller uuid; v_pay text;
  v_linked text[] := ARRAY[]::text[]; v_hit_doc text; v_hit_amount numeric;$a$],
    -- 3b. el cliente efectivo, los folios que se ligan en este plan, Corona y el emisor
    ARRAY[$a$  IF v_client_id IS NULL THEN RAISE EXCEPTION 'No se pudo resolver cliente de OC %', p_oc_id USING ERRCODE='22023'; END IF;$a$,
          $a$  IF v_client_id IS NULL THEN RAISE EXCEPTION 'No se pudo resolver cliente de OC %', p_oc_id USING ERRCODE='22023'; END IF;
  -- v10.84.89: el cliente al que de verdad se factura (el puente sigue merged_into) y los folios que este plan LIGA
  v_client_eff := COALESCE((SELECT merged_into FROM cobranza.clients WHERE id = v_client_id), v_client_id);
  v_ligar_folios := ARRAY(SELECT UPPER(TRIM(g->>'folio')) FROM jsonb_array_elements(v_groups_arr) g
                           WHERE COALESCE((g->>'ligar')::boolean, false) AND COALESCE(TRIM(g->>'folio'), '') <> '');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_groups_arr) g WHERE COALESCE((g->>'ligar')::boolean, false))
     AND (SELECT billing_mode FROM cobranza.clients WHERE id = v_client_id) = 'anticipo' THEN
    RAISE EXCEPTION 'El cliente de la OC % es de saldo a favor (Corona): ligar una factura que ya existe se ve con CxC.', p_oc_id USING ERRCODE='22023';
  END IF;
  SELECT COALESCE((value->>'v')::boolean, false) INTO v_emitter FROM cobranza.app_config WHERE key = 'folio_emitter_enabled';
  v_emitter := COALESCE(v_emitter, false);$a$],
    -- 3c. ¿este grupo liga?
    ARRAY[$a$    v_reason := v_group->>'reason';
    v_lines := v_group->'lines';$a$,
          $a$    v_reason := v_group->>'reason';
    v_lines := v_group->'lines';
    -- v10.84.89: ¿este grupo LIGA una factura que ya existe? Los v_ex_* se limpian en cada vuelta: lo de la vuelta anterior no
    -- se cuela en la comparación de ésta (la lección del RECORD que se llena en una rama, ahora con escalares; revisión de CobranzaFlow)
    v_ligar := COALESCE((v_group->>'ligar')::boolean, false); v_pay := 'unpaid';
    v_ex_id := NULL; v_ex_client := NULL; v_ex_src := NULL; v_ex_amount := NULL; v_ex_balance := NULL; v_ex_status := NULL; v_ex_seller := NULL;
    IF v_ligar AND v_doc_type NOT IN ('factura','remision') THEN
      RAISE EXCEPTION 'Grupo %: sólo una factura o una remisión se liga (un saldo Corona no tiene folio que ligar)', v_position USING ERRCODE='22023'; END IF;$a$],
    -- 3d. los candados del ligado (el importe va abajo, cuando ya se sumó el grupo); el grupo nuevo sigue con el suyo
    ARRAY[$a$      IF EXISTS (SELECT 1 FROM cobranza.invoices WHERE doc_type = v_doc_type AND doc_number = v_folio AND status != 'cancelada') THEN RAISE EXCEPTION 'Grupo %: folio % ya en cobranza', v_position, v_folio USING ERRCODE='22023'; END IF;$a$,
          $a$      IF v_ligar THEN
        -- v10.84.89 (Karla, 13-oct): el grupo que LIGA no acuña ni crea otra factura; la que ya existe se queda como está y se
        -- liga a la OC. Los candados del ligado, los de assign_invoice_splits y link_invoice_to_oc.
        IF v_bt_id IS NOT NULL THEN
          RAISE EXCEPTION 'Grupo %: una factura que ya existe se liga sin «Facturar a tercero» (su cliente ya está en el documento)', v_position USING ERRCODE='22023'; END IF;
        IF EXISTS (SELECT 1 FROM public.orders WHERE grouped_invoice_folio = v_folio) THEN
          RAISE EXCEPTION 'Grupo %: folio % ya está en una facturación agrupada', v_position, v_folio USING ERRCODE='22023'; END IF;
        SELECT i.id, i.client_id, i.source_order_id, i.amount, i.balance, i.status, i.seller
          INTO v_ex_id, v_ex_client, v_ex_src, v_ex_amount, v_ex_balance, v_ex_status, v_ex_seller
          FROM cobranza.invoices i WHERE i.doc_type = v_doc_type AND i.doc_number = v_folio AND i.status <> 'cancelada' LIMIT 1 FOR UPDATE;
        IF v_ex_id IS NULL THEN
          RAISE EXCEPTION 'Grupo %: % no existe en cobranza: no hay nada que ligar', v_position, v_folio USING ERRCODE='22023'; END IF;
        IF v_ex_client IS DISTINCT FROM v_client_id AND v_ex_client IS DISTINCT FROM v_client_eff THEN
          RAISE EXCEPTION 'Grupo %: % es de OTRO cliente: no se puede ligar a la OC %', v_position, v_folio, p_oc_id USING ERRCODE='22023'; END IF;
        IF v_ex_src IS NOT NULL THEN
          RAISE EXCEPTION 'Grupo %: % ya está ligada a %: no se re-liga', v_position, v_folio, v_ex_src USING ERRCODE='22023'; END IF;
        v_folio_vivo := SUBSTRING(v_folio FROM '[0-9]+$')::int;
        IF v_emitter AND v_folio_vivo > (SELECT last_number FROM public.invoice_counters
             WHERE type = CASE WHEN v_folio LIKE 'F-%' THEN 'factura_f' WHEN v_folio LIKE 'RS-%' THEN 'remision_rs' ELSE v_doc_type END) THEN
          RAISE EXCEPTION 'Grupo %: % pasa del último folio emitido: no se liga un folio por encima del contador', v_position, v_folio USING ERRCODE='22023'; END IF;
        -- el estado de pago con la regla de sync_badge_pago_plan_matriz (saldo e importe, no el status: con una nota de crédito
        -- pueden no decir lo mismo), para que el grupo nazca como el trigger lo pintará en el siguiente cobro
        v_pay := CASE WHEN COALESCE(v_ex_balance, 0) <= 0.01 AND COALESCE(v_ex_amount, 0) > 0 THEN 'paid'
                      WHEN COALESCE(v_ex_balance, 0) < COALESCE(v_ex_amount, 0) THEN 'partial'
                      ELSE 'unpaid' END;
        v_linked := array_append(v_linked, v_folio);
      ELSE
      IF EXISTS (SELECT 1 FROM cobranza.invoices WHERE doc_type = v_doc_type AND doc_number = v_folio AND status != 'cancelada') THEN RAISE EXCEPTION 'Grupo %: folio % ya en cobranza', v_position, v_folio USING ERRCODE='22023'; END IF;
      END IF;$a$],
    -- 3e. el importe del ligado y el candado del anticipo para el grupo nuevo
    ARRAY[$a$      v_total_amount := v_total_amount + (v_line->>'amount')::numeric;
    END LOOP;$a$,
          $a$      v_total_amount := v_total_amount + (v_line->>'amount')::numeric;
    END LOOP;
    -- v10.84.89: lo que el grupo vale con IVA, con la regla de los puentes (importe_con_iva)
    v_con_iva := public.importe_con_iva(v_total_amount, v_doc_type,
      (SELECT max(o.source) FROM public.orders o WHERE o.id IN (SELECT l->>'order_id' FROM jsonb_array_elements(v_lines) l)));
    IF v_ligar THEN
      IF ABS(v_ex_amount - v_con_iva) > 0.02 THEN
        RAISE EXCEPTION 'Grupo %: % es por $% y esta factura del plan suma $% (con IVA): no coincide, verifica que sea la misma venta', v_position, v_folio, v_ex_amount, v_con_iva USING ERRCODE='22023'; END IF;
    ELSIF v_emitter AND v_doc_type IN ('factura','remision') THEN
      -- v10.84.89: EL CANDADO DEL ANTICIPO, que esta puerta no tenía (el de assign_folio_to_oc desde F-111/F-115): un grupo
      -- nuevo cuyo importe es justo el de una factura sin orden del mismo cliente se frena (las que este plan liga no cuentan).
      SELECT i.doc_number, i.amount INTO v_hit_doc, v_hit_amount
        FROM cobranza.invoices i
       WHERE i.client_id = ANY(CASE WHEN v_bt_id IS NOT NULL THEN ARRAY[v_bt_id] ELSE ARRAY[v_client_id, v_client_eff] END)
         AND i.doc_type = v_doc_type AND i.source = 'sin_orden' AND i.source_order_id IS NULL AND i.status <> 'cancelada'
         AND NOT (i.doc_number = ANY(v_ligar_folios))
         AND ABS(i.amount - v_con_iva) <= 0.02
       ORDER BY i.issued_date, i.doc_number LIMIT 1;
      IF v_hit_doc IS NOT NULL THEN
        RAISE EXCEPTION 'Grupo %: este cliente ya tiene % hecha sin orden, por $%, que es justo el importe de esta factura del plan. Márcala «Ya tiene factura: ligarla» en vez de emitir un folio nuevo, o se le cobraría dos veces el mismo trabajo.',
          v_position, v_hit_doc, v_hit_amount USING ERRCODE='22023';
      END IF;
    END IF;$a$],
    -- 3f. el grupo nace ligado y con el estado de pago de su factura
    ARRAY[$a$      bill_to_client_id, bill_to_name, bill_to_rfc
    ) VALUES (
      p_oc_id, v_position, v_label, v_folio, v_doc_type, v_total_amount,
      v_pre_assigned, v_reason, 'unpaid', p_actor,$a$,
          $a$      bill_to_client_id, bill_to_name, bill_to_rfc, ligada
    ) VALUES (
      p_oc_id, v_position, v_label, v_folio, v_doc_type, v_total_amount,
      v_pre_assigned, v_reason, v_pay, p_actor,$a$],
    ARRAY[$a$      CASE WHEN v_bt_id IS NOT NULL THEN v_bt.rfc ELSE NULL END
    ) RETURNING id INTO v_group_id;$a$,
          $a$      CASE WHEN v_bt_id IS NOT NULL THEN v_bt.rfc ELSE NULL END,
      v_ligar
    ) RETURNING id INTO v_group_id;$a$],
    -- 3g. ya con sus renglones: se liga (el puente no creó nada), el vendedor, la bitácora de cada orden y el audit_log
    ARRAY[$a$      v_lines_result := v_lines_result || jsonb_build_array(jsonb_build_object('id', v_line_id, 'order_id', v_line->>'order_id', 'qty', (v_line->>'qty')::int, 'amount', (v_line->>'amount')::numeric));
    END LOOP;$a$,
          $a$      v_lines_result := v_lines_result || jsonb_build_array(jsonb_build_object('id', v_line_id, 'order_id', v_line->>'order_id', 'qty', (v_line->>'qty')::int, 'amount', (v_line->>'amount')::numeric));
    END LOOP;
    IF v_ligar THEN
      UPDATE cobranza.invoices SET source_order_id = p_oc_id WHERE id = v_ex_id AND source_order_id IS NULL;
      GET DIAGNOSTICS v_cnt = ROW_COUNT;
      IF v_cnt <> 1 THEN RAISE EXCEPTION 'La factura % fue ligada por otra operación en paralelo: reintenta.', v_folio USING ERRCODE='40001'; END IF;
      -- el vendedor de la OC si la factura no traía (la salvedad de link_invoice_to_oc: 42501 no tumba el ligado)
      IF v_ex_seller IS NULL AND cobranza.resolve_seller(v_oc.vendedor) IS NOT NULL THEN
        BEGIN PERFORM cobranza.set_invoice_seller(v_ex_id, cobranza.resolve_seller(v_oc.vendedor), p_actor);
        EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      END IF;
      INSERT INTO public.order_timeline (order_id, action, by_user, color)
      SELECT DISTINCT l->>'order_id', '🔗 ' || v_folio || ' (hecha sin orden) ligada: factura ' || v_position || ' del plan de ' || p_oc_id,
             p_actor, '#5856d6'
        FROM jsonb_array_elements(v_lines) l;
      INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
      VALUES ('oc_split_plan_link_existing_invoice', 'invoice', v_ex_id,
        jsonb_build_object('oc_id', p_oc_id, 'group_id', v_group_id, 'position', v_position, 'folio', v_folio,
          'amount', v_ex_amount, 'group_total_no_iva', v_total_amount, 'group_total_con_iva', v_con_iva,
          'invoice_status', v_ex_status, 'client_id', v_ex_client), p_actor);
    END IF;$a$],
    -- 3h. lo que contesta
    ARRAY[$a$      'bill_to_client_id', v_bt_id, 'lines', v_lines_result));$a$,
          $a$      'bill_to_client_id', v_bt_id, 'ligada', v_ligar, 'lines', v_lines_result));$a$],
    ARRAY[$a$    'unique_orders_count', array_length(v_unique_orders, 1), 'position_start', v_position_start, 'groups', v_result);$a$,
          $a$    'unique_orders_count', array_length(v_unique_orders, 1), 'position_start', v_position_start,
    'linked_folios', to_jsonb(v_linked), 'groups', v_result);$a$]];
  FOR i IN 1 .. array_length(v_pares, 1) LOOP
    v_a := v_pares[i][1]; v_b := v_pares[i][2];
    IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla % del plan', i; END IF;
    v_def := replace(v_def, v_a, v_b);
  END LOOP;
  EXECUTE v_def;

  -- 4. el puente
  v_def := pg_get_functiondef('public.sync_invoice_from_oc_split_group()'::regprocedure);
  IF md5(v_def) <> '210de5436f2fc78d56e7a456fea5cf5b' THEN RAISE EXCEPTION 'sync_invoice_from_oc_split_group cambió (md5 %)', md5(v_def); END IF;
  v_a := $a$  IF NEW.cancelled_at IS NOT NULL THEN RETURN NEW; END IF;$a$;
  v_b := $a$  IF NEW.cancelled_at IS NOT NULL THEN RETURN NEW; END IF;
  -- v10.84.89: el grupo que LIGA una factura que ya existe no crea otra (assign_oc_invoice_split_plan la liga con sus candados
  -- en cuanto el grupo tiene sus renglones). Sin esto, el índice único de cobranza.invoices tumbaba el plan.
  IF NEW.ligada THEN
    INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
    VALUES ('bridge_oc_split_skip_linked', 'oc_invoice_split_group', NEW.id,
      jsonb_build_object('oc_id', NEW.purchase_order_id, 'folio', NEW.folio, 'reason', 'la factura ya existía: se liga, no se crea'),
      NEW.invoiced_by);
    RETURN NEW;
  END IF;$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla del puente'; END IF;
  EXECUTE replace(v_def, v_a, v_b);

  -- 5. cancelar el grupo
  v_def := pg_get_functiondef('public.cancel_oc_invoice_split_group(uuid,text,text)'::regprocedure);
  IF md5(v_def) <> '53546e65e64fe509d52c4ca53eb61b39' THEN RAISE EXCEPTION 'cancel_oc_invoice_split_group cambió (md5 %)', md5(v_def); END IF;
  v_pares := ARRAY[
    ARRAY[$a$  v_puente jsonb;  -- v3.7.736: resultado de cancelar_cobros_del_puente$a$,
          $a$  v_puente jsonb;  -- v3.7.736: resultado de cancelar_cobros_del_puente
  v_desligadas int;  -- v10.84.89: si de verdad se desligó la factura del grupo ligado$a$],
    ARRAY[$a$  IF v_group.doc_type IN ('factura','remision') AND v_group.folio IS NOT NULL THEN$a$,
          $a$  IF v_group.ligada THEN
    -- v10.84.89: la factura de este grupo ya existía (hecha sin orden) y sólo se LIGÓ: cancelar el grupo la DESLIGA (vuelve a
    -- «Facturas esperando orden» en CobranzaFlow, como era antes de ligarla) y no la cancela ni toca sus cobros; las órdenes
    -- regresan a Salidas (abajo). Si ese trabajo de verdad ya no se cobra, el documento se cancela en CobranzaFlow.
    UPDATE cobranza.invoices SET source_order_id = NULL
     WHERE doc_type = v_group.doc_type AND doc_number = v_group.folio
       AND source_order_id = v_group.purchase_order_id AND status <> 'cancelada';
    GET DIAGNOSTICS v_desligadas = ROW_COUNT;
    INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
    VALUES ('cancel_oc_split_group_detached_linked', 'oc_invoice_split_group', v_group.id,
      jsonb_build_object('oc_id', v_oc.id, 'folio', v_group.folio, 'desligada', v_desligadas = 1,
        'note', CASE WHEN v_desligadas = 1 THEN 'Factura que ya existía: DESLIGADA, no cancelada'
                     ELSE 'La factura ya no estaba viva y ligada a la OC (¿cancelada en CobranzaFlow?): nada que desligar' END,
        'reason', TRIM(p_reason)), p_actor);
  ELSIF v_group.doc_type IN ('factura','remision') AND v_group.folio IS NOT NULL THEN$a$]];
  FOR i IN 1 .. array_length(v_pares, 1) LOOP
    v_a := v_pares[i][1]; v_b := v_pares[i][2];
    IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla % de cancelar el grupo', i; END IF;
    v_def := replace(v_def, v_a, v_b);
  END LOOP;
  EXECUTE v_def;

  -- 6. cancelar un renglón (y la cascada de cancelar una orden)
  v_def := pg_get_functiondef('public.cancel_oc_split_line_internal(uuid,text,text)'::regprocedure);
  IF md5(v_def) <> 'a440751edc5475d4ac61876f12286625' THEN RAISE EXCEPTION 'cancel_oc_split_line_internal cambió (md5 %)', md5(v_def); END IF;
  v_a := $a$    RAISE EXCEPTION 'El grupo ya está cancelado. Cancelar línea individual no aplica.' USING ERRCODE='22023';
  END IF;$a$;
  v_b := $a$    RAISE EXCEPTION 'El grupo ya está cancelado. Cancelar línea individual no aplica.' USING ERRCODE='22023';
  END IF;
  -- v10.84.89: la factura de un grupo LIGADO ya existía y no la hizo PrintFlow: quitarle un renglón no cambiaría su importe.
  -- Frena también la cascada de cancelar una orden que va en ella, diciendo qué hacer. El mensaje nombra el CFDI A PROPÓSITO:
  -- sync_cancellation_to_cobranza degrada a discrepancia todo error que no hable de lo fiscal (v10.80.14: «si el mensaje nombra
  -- al SAT, no se degrada») y la orden se cancelaba con su factura viva (lo encontró el ensayo).
  IF v_group.ligada THEN
    RAISE EXCEPTION '% va en %, una factura que ya existía y se ligó al plan de %: PrintFlow no le cambia el importe a un CFDI o una remisión que no hizo, así que no se le quita un pedazo. Cancela la factura entera del plan (se desliga y las órdenes regresan a Salidas) o corrige % en CobranzaFlow.',
      COALESCE((SELECT production_number FROM public.orders WHERE id = v_line.order_id), v_line.order_id),
      v_group.folio, v_group.purchase_order_id, v_group.folio USING ERRCODE='22023';
  END IF;$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla de cancelar el renglón'; END IF;
  EXECUTE replace(v_def, v_a, v_b);

  -- 7. el estado de pago del grupo (cobranza: el texto es de CobranzaFlow, con su visto bueno). No por folio a secas: la factura
  --    del puente como siempre, y la ligada sólo en el grupo ligado de SU OC y de su tipo (otra con el mismo número, cancelada o de
  --    otra OC, no le pinta el pago); y sin buscar en cada update de una factura que no es del puente ni está ligada a nada.
  v_def := pg_get_functiondef('cobranza.sync_badge_pago_plan_matriz()'::regprocedure);
  IF md5(v_def) <> '8f9da51aa23ab5aa2d8602c9ab6f4e15' THEN RAISE EXCEPTION 'sync_badge_pago_plan_matriz cambió (md5 %)', md5(v_def); END IF;
  v_pares := ARRAY[
    ARRAY[$a$  IF COALESCE(NEW.source, '') <> 'printflow_bridge_oc_split' THEN RETURN NEW; END IF;$a$,
          $a$  -- PrintFlow v10.84.89: también la factura que ya existía y se ligó a un grupo del plan (oc_invoice_split_groups.ligada)
  IF COALESCE(NEW.source,'') <> 'printflow_bridge_oc_split' AND NEW.source_order_id IS NULL THEN RETURN NEW; END IF;$a$],
    ARRAY[$a$   WHERE g.folio = NEW.doc_number AND g.cancelled_at IS NULL AND COALESCE(g.payment_status, 'unpaid') IS DISTINCT FROM v_estado;$a$,
          $a$   WHERE g.folio = NEW.doc_number AND g.cancelled_at IS NULL
     AND (COALESCE(NEW.source,'') = 'printflow_bridge_oc_split'
          OR (g.ligada AND g.doc_type = NEW.doc_type AND g.purchase_order_id = NEW.source_order_id))
     AND COALESCE(g.payment_status,'unpaid') IS DISTINCT FROM v_estado;$a$]];
  FOR i IN 1 .. array_length(v_pares, 1) LOOP
    v_a := v_pares[i][1]; v_b := v_pares[i][2];
    IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla % del estado de pago', i; END IF;
    v_def := replace(v_def, v_a, v_b);
  END LOOP;
  EXECUTE v_def;
END $mig$;
