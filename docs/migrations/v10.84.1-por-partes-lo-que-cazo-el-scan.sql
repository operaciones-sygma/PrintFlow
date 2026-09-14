-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- v10.84.1 — LO QUE CAZO EL SCAN de "facturar por partes en el tiempo" (28 agentes, 20 confirmados,
-- 9 causas raiz). Cada bloque dice que defecto cierra.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. cancel_invoice_split_internal ───────────────────────────────────────────────────────────
-- (a) CANCELAR LA ORDEN ENTERA DEJABA UN RESTO VIVO. La cascada (sync_cancellation_to_cobranza)
--     recorre las partes vivas con un cursor de foto fija; al cancelar una parte facturada mi bloque
--     "regresa al resto" REABRIA un resto que el cursor ya no veia. Quedaba una parte viva colgando
--     de una orden cancelada. El dinero de una orden muerta no regresa a ningun resto: se condiciona
--     a que la orden siga viva (en el trigger AFTER, v_order ya trae cancelled_at).
-- (b) corona_saldo tambien regresa al resto: el pool se reembolsa y ese dinero vuelve a estar por
--     facturar. Sin esto la invariante 31 quedaba en rojo permanente.
DO $P$
DECLARE d text; a text; b text; n int;
BEGIN
  d := pg_get_functiondef('public.cancel_invoice_split_internal'::regproc);

  a := E'  IF v_split.doc_type IN (''factura'',''remision'')\n'
    || E'     AND EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE order_id = v_split.order_id AND doc_type = ''por_facturar'') THEN\n';
  b := E'  -- v10.84.1: SOLO si la orden sigue viva (la cascada de cancelacion ya puso cancelled_at) y\n'
    || E'  -- tambien para corona_saldo (el pool se reembolsa: ese dinero vuelve a estar por facturar).\n'
    || E'  IF v_split.doc_type IN (''factura'',''remision'',''corona_saldo'')\n'
    || E'     AND v_order.cancelled_at IS NULL AND v_order.stage NOT LIKE ''%cancelled%''\n'
    || E'     AND EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE order_id = v_split.order_id AND doc_type = ''por_facturar'') THEN\n';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'cancel_internal 1a: ancla x%', n; END IF;
  d := replace(d, a, b);

  a := E'to_char(NOW(),''YYYY-MM-DD''), v_split.amount_portion, v_split.qty_portion, v_split.invoice_folio, TRIM(p_reason))';
  b := E'to_char(NOW(),''YYYY-MM-DD''), v_split.amount_portion, v_split.qty_portion, COALESCE(v_split.invoice_folio, ''saldo Corona''), TRIM(p_reason))';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'cancel_internal 1b: ancla x%', n; END IF;
  d := replace(d, a, b);

  a := E'format(''Reabierto: regresa la parte %s cancelada (%s)'', v_split.invoice_folio, TRIM(p_reason))';
  b := E'format(''Reabierto: regresa la parte %s cancelada (%s)'', COALESCE(v_split.invoice_folio, ''saldo Corona''), TRIM(p_reason))';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'cancel_internal 1c: ancla x%', n; END IF;
  d := replace(d, a, b);

  EXECUTE d;
END $P$;

-- ── 2. assign_invoice_splits ────────────────────────────────────────────────────────────────────
-- (a) EL RESTO VA AL FINAL. Con el resto en medio, la cascada lo cancelaba antes que las partes
--     que venian despues, y cada una "regresaba" reabriendo. Ademas es lo que el boton produce.
-- (b) El resto no es "anticipado" ni lleva razon aunque el plan sea pre-asignado.
-- (c) invoice_reason, splits_count y el toast contaban el resto como una factura mas.
-- (d) CON EL EMISOR ACTIVO NO HABIA FORMA DE LIGAR UN FOLIO EXISTENTE: el bloque de ligado vivia
--     dentro de `IF NOT v_emitter`, asi que un folio tecleado se ignoraba y se acuñaba uno nuevo
--     (CxC duplicada). Ahora, con emisor ON, un folio escrito + p_allow_link LIGA la factura que ya
--     existe (mismo cliente, mismo monto, sin orden) en vez de acuñar. Es justo el caso de Karla:
--     parte 1 = la factura que ya emitio, parte 2 = el resto.
DO $P$
DECLARE d text; a text; b text; n int;
BEGIN
  d := pg_get_functiondef('public.assign_invoice_splits'::regproc);

  -- 2a. el resto, al final
  a := E'  IF v_por_facturar > 1 THEN\n'
    || E'    RAISE EXCEPTION ''Solo puede haber UNA parte por facturar: es el resto, y se va partiendo conforme se factura'' USING ERRCODE=''22023'';\n'
    || E'  END IF;\n';
  b := a
    || E'  -- v10.84.1: el resto va AL FINAL. En medio, la cascada de cancelacion lo cerraba antes que las\n'
    || E'  -- partes posteriores y cada una lo reabria. Y es lo que produce el boton «El resto, despues».\n'
    || E'  IF v_por_facturar = 1 AND (p_splits->(v_splits_count - 1))->>''doc_type'' <> ''por_facturar'' THEN\n'
    || E'    RAISE EXCEPTION ''La parte por facturar tiene que ser la ULTIMA: es el resto'' USING ERRCODE=''22023'';\n'
    || E'  END IF;\n';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign 2a: ancla x%', n; END IF;
  d := replace(d, a, b);

  -- 2b. el resto no es anticipado ni lleva razon (INSERT y v_created)
  a := E'      COALESCE((v_split->>''pre_assigned'')::boolean, false), v_split->>''reason'',\n';
  b := E'      CASE WHEN v_doc_type = ''por_facturar'' THEN false ELSE COALESCE((v_split->>''pre_assigned'')::boolean, false) END,\n'
    || E'      CASE WHEN v_doc_type = ''por_facturar'' THEN NULL ELSE v_split->>''reason'' END,\n';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign 2b: ancla x%', n; END IF;
  d := replace(d, a, b);

  a := E'      ''pre_assigned'', COALESCE((v_split->>''pre_assigned'')::boolean, false),\n';
  b := E'      ''pre_assigned'', CASE WHEN v_doc_type = ''por_facturar'' THEN false ELSE COALESCE((v_split->>''pre_assigned'')::boolean, false) END,\n';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign 2b2: ancla x%', n; END IF;
  d := replace(d, a, b);

  -- 2c. no contar el resto como factura
  a := E'''Pre-asignados '' || v_splits_count || '' folios (splits anticipados)''';
  b := E'''Pre-asignados '' || (v_splits_count - v_por_facturar) || '' folios (splits anticipados)'' || CASE WHEN v_por_facturar > 0 THEN '' · resto por facturar despues'' ELSE '''' END';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign 2c1: ancla x%', n; END IF;
  d := replace(d, a, b);

  a := E'''Dividida en '' || v_splits_count || '' facturas (splits)''';
  b := E'''Dividida en '' || (v_splits_count - v_por_facturar) || '' facturas (splits)''';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign 2c2: ancla x%', n; END IF;
  d := replace(d, a, b);

  a := E'  RETURN jsonb_build_object(''order_id'', p_order_id, ''splits_count'', v_splits_count,';
  b := E'  RETURN jsonb_build_object(''order_id'', p_order_id, ''splits_count'', v_splits_count - v_por_facturar, ''por_facturar'', v_por_facturar,';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign 2c3: ancla x%', n; END IF;
  d := replace(d, a, b);

  -- 2d. ligar un folio existente TAMBIEN con el emisor activo
  a := E'      IF NOT v_emitter THEN\n'
    || E'      -- v3.7.412: el prefijo pasa a ser solo ETIQUETA del mensaje';
  b := E'      -- v10.84.1: con emisor ON, TODO folio escrito pasa por aqui: sin p_allow_link levanta «ya esta\n'
    || E'      -- registrado» (el front pregunta y reintenta con p_allow_link); con el se LIGA; si no existe, se rechaza.\n'
    || E'      IF NOT v_emitter OR v_folio <> '''' THEN\n'
    || E'      -- v3.7.412: el prefijo pasa a ser solo ETIQUETA del mensaje';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign 2d1: ancla x%', n; END IF;
  d := replace(d, a, b);

  a := E'        v_link_folios := array_append(v_link_folios, v_folio);\n'
    || E'      END IF;\n'
    || E'      END IF;  -- F1: fin del bloque NOT v_emitter\n';
  b := E'        v_link_folios := array_append(v_link_folios, v_folio);\n'
    || E'      END IF;\n'
    || E'      IF v_emitter AND v_ex_id IS NULL THEN\n'
    || E'        RAISE EXCEPTION ''Split %: con el emisor activo el folio lo asigna el sistema; escribe uno solo para LIGAR una factura que ya exista en cobranza (% no existe)'', v_position, v_folio USING ERRCODE=''22023'';\n'
    || E'      END IF;\n'
    || E'      END IF;  -- F1: fin del bloque NOT v_emitter (o ligado con emisor)\n';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign 2d2: ancla x%', n; END IF;
  d := replace(d, a, b);

  a := E'    IF v_emitter AND v_doc_type IN (''factura'',''remision'') THEN\n';
  b := E'    IF v_emitter AND v_doc_type IN (''factura'',''remision'') AND NOT (v_folio = ANY(v_link_folios)) THEN\n';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign 2d3: ancla x%', n; END IF;
  d := replace(d, a, b);

  EXECUTE d;
END $P$;

-- ── 3. facturar_siguiente_parte ─────────────────────────────────────────────────────────────────
-- (a) Orden de candados invertido (resto -> orden) frente a las cancelaciones (orden -> partes):
--     posible deadlock. Ahora: leer la parte sin candado, candado a la ORDEN, luego a la parte.
-- (b) Con emisor ON un p_folio no se ignora en silencio: se rechaza. Con emisor OFF, folio_num > 0.
-- (c) Si el plan es pre-asignado y la orden sigue en produccion, la parte nueva hereda la marca y
--     la razon de anticipado (antes nacia sin ellas y la orden seguia sin stage final).
CREATE OR REPLACE FUNCTION public.facturar_siguiente_parte(
  p_split_id uuid, p_amount numeric, p_qty integer, p_actor text,
  p_notes text DEFAULT NULL, p_doc_type text DEFAULT 'factura', p_folio text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $F$
-- v10.84.0 — Toma la parte «por facturar» de una orden (el resto) y factura una porcion, o todo.
-- p_amount y p_qty son la porcion que SE FACTURA HOY, en SUBTOTAL (sin IVA), igual que amount_portion.
-- Inserta una parte normal con folio (el puente AFTER INSERT crea la factura en cobranza) y
-- descuenta el resto; si el resto se agota, se cierra con motivo «Consumida: ...».
-- v10.84.1 — candados orden->parte; p_folio con emisor se rechaza; hereda pre-asignado.
DECLARE
  v_order_id text; v_resto RECORD; v_order RECORD; v_emitter boolean := false;
  v_folio text; v_folio_num int; v_pos int; v_new_id uuid; v_cerrado boolean;
  v_resto_nuevo numeric; v_qty_nuevo int; v_amount numeric;
  v_pre boolean := false; v_pre_reason text;
BEGIN
  PERFORM public.lock_serie_vigente();
  IF p_actor IS NULL OR TRIM(p_actor) = '' THEN RAISE EXCEPTION 'p_actor requerido' USING ERRCODE='22023'; END IF;
  PERFORM public.verify_actor_role(p_actor, ARRAY['admin','karla']);
  IF p_doc_type NOT IN ('factura','remision') THEN
    RAISE EXCEPTION 'p_doc_type debe ser factura o remision' USING ERRCODE='22023';
  END IF;

  -- candados en el MISMO orden que las cancelaciones: primero la orden, luego la parte
  SELECT order_id INTO v_order_id FROM public.order_invoice_splits WHERE id = p_split_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa parte no existe' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La orden % no existe', v_order_id USING ERRCODE='22023'; END IF;
  IF v_order.cancelled_at IS NOT NULL OR v_order.stage LIKE '%cancelled%' THEN
    RAISE EXCEPTION 'La orden % esta cancelada', COALESCE(v_order.production_number, v_order.id) USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_resto FROM public.order_invoice_splits WHERE id = p_split_id FOR UPDATE;
  IF v_resto.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ese resto ya se cerro el % (%)', v_resto.cancelled_at::date, v_resto.cancellation_reason USING ERRCODE='22023';
  END IF;
  IF v_resto.doc_type <> 'por_facturar' THEN
    RAISE EXCEPTION 'Esa parte ya esta facturada (%): solo se factura desde el resto', COALESCE(v_resto.invoice_folio, v_resto.doc_type) USING ERRCODE='22023';
  END IF;

  -- la porcion
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a cero' USING ERRCODE='22023'; END IF;
  IF p_amount > v_resto.amount_portion + 0.01 THEN
    RAISE EXCEPTION 'Quieres facturar $% pero solo quedan $% por facturar', p_amount, v_resto.amount_portion USING ERRCODE='22023';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 OR p_qty > v_resto.qty_portion THEN
    RAISE EXCEPTION 'Cantidad invalida: quedan % piezas por facturar', v_resto.qty_portion USING ERRCODE='22023';
  END IF;
  v_cerrado := ABS(p_amount - v_resto.amount_portion) <= 0.01;
  IF v_cerrado THEN
    IF p_qty <> v_resto.qty_portion THEN
      RAISE EXCEPTION 'Si facturas todo el resto ($%) las piezas tambien tienen que ser todas (%)', v_resto.amount_portion, v_resto.qty_portion USING ERRCODE='22023';
    END IF;
    v_amount := v_resto.amount_portion;          -- absorbe el centavo: el resto cierra EXACTO
  ELSE
    IF v_resto.qty_portion = 1 THEN
      RAISE EXCEPTION 'El resto tiene UNA sola pieza: solo se puede facturar completo ($%)', v_resto.amount_portion USING ERRCODE='22023';
    END IF;
    IF p_qty >= v_resto.qty_portion THEN
      RAISE EXCEPTION 'Si facturas solo una parte del dinero, deja al menos una pieza en el resto' USING ERRCODE='22023';
    END IF;
    v_amount := ROUND(p_amount, 2);
  END IF;

  -- pre-asignado: si el plan nacio anticipado y la orden sigue en produccion, la parte nueva hereda
  v_pre := COALESCE(v_order.invoice_pre_assigned, false) AND v_order.stage NOT IN ('delivered','maq_delivered');
  IF v_pre THEN
    SELECT invoice_reason INTO v_pre_reason FROM public.order_invoice_splits
     WHERE order_id = v_order_id AND invoice_pre_assigned AND invoice_reason IS NOT NULL ORDER BY position LIMIT 1;
    v_pre_reason := COALESCE(NULLIF(TRIM(p_notes), ''), v_pre_reason, 'Siguiente parte de un plan anticipado');
  END IF;

  -- el folio: en modo emisor nace del counter; si no, lo trae el usuario y se valida como en el split
  SELECT COALESCE((value->>'v')::boolean, false) INTO v_emitter FROM cobranza.app_config WHERE key = 'folio_emitter_enabled';
  PERFORM 1 FROM public.invoice_counters WHERE type IN ('factura','factura_f','remision','remision_rs') ORDER BY type FOR UPDATE;
  IF COALESCE(v_emitter, false) THEN
    IF NULLIF(TRIM(COALESCE(p_folio, '')), '') IS NOT NULL THEN
      RAISE EXCEPTION 'Con el emisor activo el folio lo asigna el sistema: no mandes p_folio' USING ERRCODE='22023';
    END IF;
    UPDATE public.invoice_counters SET last_number = last_number + 1, updated_at = NOW()
      WHERE type = CASE WHEN p_doc_type = 'factura' THEN public.counter_factura_vigente() ELSE public.counter_remision_vigente() END
      RETURNING last_number INTO v_folio_num;
    IF v_folio_num IS NULL THEN RAISE EXCEPTION 'No existe counter para %', p_doc_type USING ERRCODE='22023'; END IF;
    v_folio := (CASE WHEN p_doc_type = 'factura' THEN public.serie_factura_vigente() ELSE public.serie_remision_vigente() END) || '-' || v_folio_num;
    IF EXISTS (SELECT 1 FROM cobranza.invoices WHERE doc_type = p_doc_type AND doc_number = v_folio AND status <> 'cancelada') THEN
      RAISE EXCEPTION 'Emisor: el counter genero folio % que ya vive en cobranza (drift) - reconcilia el counter antes de facturar.', v_folio USING ERRCODE='22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.orders WHERE invoice_folio = v_folio) THEN
      RAISE EXCEPTION 'Emisor: el counter genero folio % ya asignado a otra orden (drift).', v_folio USING ERRCODE='22023';
    END IF;
  ELSE
    v_folio := UPPER(TRIM(COALESCE(p_folio, '')));
    IF v_folio !~ (CASE WHEN p_doc_type = 'factura' THEN '^(D|F)-[0-9]+$' ELSE '^(RS|R)-[0-9]+$' END) THEN
      RAISE EXCEPTION 'Folio invalido: %', v_folio USING ERRCODE='22023';
    END IF;
    v_folio_num := SUBSTRING(v_folio FROM '[0-9]+$')::int;
    IF v_folio_num <= 0 THEN RAISE EXCEPTION 'Numero de folio invalido: %', v_folio USING ERRCODE='22023'; END IF;
    IF EXISTS (SELECT 1 FROM public.orders WHERE invoice_folio = v_folio)
       OR EXISTS (SELECT 1 FROM public.purchase_orders WHERE shared_invoice_folio = v_folio)
       OR EXISTS (SELECT 1 FROM public.oc_invoice_groups WHERE folio = v_folio)
       OR EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE invoice_folio = v_folio AND cancelled_at IS NULL)
       OR EXISTS (SELECT 1 FROM cobranza.invoices WHERE doc_type = p_doc_type AND doc_number = v_folio AND status <> 'cancelada') THEN
      RAISE EXCEPTION 'El folio % ya esta en uso', v_folio USING ERRCODE='22023';
    END IF;
    UPDATE public.invoice_counters SET last_number = GREATEST(last_number, v_folio_num), updated_at = NOW()
      WHERE type = CASE WHEN v_folio LIKE 'F-%' THEN 'factura_f' WHEN v_folio LIKE 'RS-%' THEN 'remision_rs' ELSE p_doc_type END;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_pos FROM public.order_invoice_splits WHERE order_id = v_order_id;

  -- la parte nueva, CON folio: el puente AFTER INSERT crea la factura en cobranza
  INSERT INTO public.order_invoice_splits
    (order_id, position, qty_portion, amount_portion, doc_type, invoice_folio, invoice_pre_assigned, invoice_reason, payment_status, invoiced_by, notes)
  VALUES
    (v_order_id, v_pos, p_qty, v_amount, p_doc_type, v_folio, v_pre, CASE WHEN v_pre THEN v_pre_reason END, 'unpaid', p_actor,
     COALESCE(NULLIF(TRIM(p_notes), ''), 'Siguiente parte de una orden facturada por partes'))
  RETURNING id INTO v_new_id;

  -- y el resto se descuenta, o se cierra
  IF v_cerrado THEN
    UPDATE public.order_invoice_splits
       SET cancelled_at = NOW(), cancelled_by = p_actor,
           cancellation_reason = 'Consumida: facturada completa como parte ' || v_pos || ' (' || v_folio || ')'
     WHERE id = p_split_id;
    v_resto_nuevo := 0; v_qty_nuevo := 0;
  ELSE
    v_resto_nuevo := ROUND(v_resto.amount_portion - v_amount, 2);
    v_qty_nuevo := v_resto.qty_portion - p_qty;
    UPDATE public.order_invoice_splits
       SET amount_portion = v_resto_nuevo, qty_portion = v_qty_nuevo,
           notes = COALESCE(notes, '') || format(E'\n[%s] se facturo $%s (%s pzas) como parte %s (%s); quedan $%s',
                     to_char(NOW(), 'YYYY-MM-DD'), v_amount, p_qty, v_pos, v_folio, v_resto_nuevo)
     WHERE id = p_split_id;
  END IF;

  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('facturar_siguiente_parte', 'order_invoice_split', v_new_id,
    jsonb_build_object('order_id', v_order_id, 'production_number', v_order.production_number,
      'resto_split_id', p_split_id, 'folio', v_folio, 'doc_type', p_doc_type, 'position', v_pos,
      'amount', v_amount, 'qty', p_qty, 'resto_antes', v_resto.amount_portion, 'resto_despues', v_resto_nuevo,
      'cerrado', v_cerrado, 'pre_assigned', v_pre, 'notes', p_notes), p_actor);

  RETURN jsonb_build_object('folio', v_folio, 'split_id', v_new_id, 'position', v_pos, 'doc_type', p_doc_type,
    'amount', v_amount, 'qty', p_qty, 'resto', v_resto_nuevo, 'resto_qty', v_qty_nuevo,
    'cerrado', v_cerrado, 'order_id', v_order_id);
END $F$;
REVOKE ALL ON FUNCTION public.facturar_siguiente_parte(uuid, numeric, integer, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.facturar_siguiente_parte(uuid, numeric, integer, text, text, text, text) TO authenticated, service_role;

-- ── 4. Cuando el CFDI de una parte se cancela ante el SAT, la parte se cierra y su dinero regresa ──
-- La unica puerta para cancelar una parte TIMBRADA es cancelar su CFDI desde CobranzaFlow; eso
-- pone invoices.status='cancelada' (cancelar_saldo_por_cfdi_cancelado) pero NO tocaba la parte:
-- seguia viva en PrintFlow y el dinero nunca regresaba al resto. Este trigger cierra la parte y
-- regresa el importe al resto. NO toca pagos (la regla del dueño del 4-sep los deja registrados
-- para decidir a donde van) y NO cancela la orden: solo aplica a ordenes que tienen un resto.
CREATE OR REPLACE FUNCTION public.split_sigue_a_su_cfdi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $T$
DECLARE v_split RECORD; v_order RECORD;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status <> 'cancelada' THEN RETURN NEW; END IF;
  IF NEW.source IS DISTINCT FROM 'printflow_bridge_split' OR NEW.source_order_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_split FROM public.order_invoice_splits
   WHERE order_id = NEW.source_order_id AND invoice_folio = NEW.doc_number AND doc_type = NEW.doc_type
     AND cancelled_at IS NULL
   LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;                      -- ya la cerro alguien (p.ej. cancel_invoice_split)
  IF NOT EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE order_id = NEW.source_order_id AND doc_type = 'por_facturar') THEN
    RETURN NEW;                                              -- orden sin resto: comportamiento de siempre
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = NEW.source_order_id FOR UPDATE;

  UPDATE public.order_invoice_splits
     SET cancelled_at = NOW(), cancelled_by = 'sistema_cfdi',
         cancellation_reason = 'CFDI cancelado ante el SAT (' || NEW.doc_number || ')'
   WHERE id = v_split.id;

  IF v_order.cancelled_at IS NULL AND v_order.stage NOT LIKE '%cancelled%' THEN
    UPDATE public.order_invoice_splits
       SET amount_portion = amount_portion + v_split.amount_portion,
           qty_portion = qty_portion + v_split.qty_portion,
           notes = COALESCE(notes,'') || format(E'\n[%s] regresan $%s (%s pzas) de %s: CFDI cancelado ante el SAT',
                     to_char(NOW(),'YYYY-MM-DD'), v_split.amount_portion, v_split.qty_portion, NEW.doc_number)
     WHERE order_id = NEW.source_order_id AND doc_type = 'por_facturar' AND cancelled_at IS NULL;
    IF NOT FOUND THEN
      INSERT INTO public.order_invoice_splits (order_id, position, qty_portion, amount_portion, doc_type, invoice_folio, invoiced_by, notes)
      SELECT NEW.source_order_id, COALESCE(MAX(position),0)+1, v_split.qty_portion, v_split.amount_portion, 'por_facturar', NULL, 'sistema_cfdi',
             format('Reabierto: regresa %s (CFDI cancelado ante el SAT)', NEW.doc_number)
        FROM public.order_invoice_splits WHERE order_id = NEW.source_order_id;
    END IF;
  END IF;

  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('split_cerrada_por_cfdi_cancelado', 'order_invoice_split', v_split.id,
    jsonb_build_object('order_id', NEW.source_order_id, 'folio', NEW.doc_number, 'invoice_id', NEW.id,
      'amount_portion', v_split.amount_portion, 'qty_portion', v_split.qty_portion,
      'regreso_al_resto', v_order.cancelled_at IS NULL), 'sistema_cfdi');
  RETURN NEW;
END $T$;

DROP TRIGGER IF EXISTS trg_split_sigue_a_su_cfdi ON cobranza.invoices;
-- ⚠ sin `UPDATE OF status`: esa forma mira las columnas LISTADAS en el UPDATE, no las que cambian.
CREATE TRIGGER trg_split_sigue_a_su_cfdi
  AFTER UPDATE ON cobranza.invoices
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelada' AND NEW.source = 'printflow_bridge_split')
  EXECUTE FUNCTION public.split_sigue_a_su_cfdi();
