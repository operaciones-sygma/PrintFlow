-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- v10.84.0 — FACTURAR UNA ORDEN POR PARTES A LO LARGO DEL TIEMPO
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- EL CASO (Karla, 14-sep-2026). Un cliente grande pide que de una orden se le facture UNA parte
-- hoy y el resto DESPUES, conforme vaya pagando. No quiere una PPD por el total con complementos:
-- quiere facturas separadas, cada una en su momento.
--
-- LO QUE HABIA. «Facturar por partes» (order_invoice_splits) parte una orden en N facturas EN EL
-- MISMO ACTO: minimo dos partes, cada una acuña su folio ahi mismo, y la suma es el 100%. No
-- existia una parte que pudiera vivir SIN folio todavia. Y como la orden pasa a entregada, sale de
-- «Pendientes de Folio»: aunque la parte existiera, nadie la volveria a ver.
--
-- LO QUE SE HACE. Una parte mas del mismo mecanismo, doc_type = 'por_facturar': es EL RESTO.
-- Vive sin folio y dice cuanto falta por facturar. Cada vez que Karla factura la siguiente parte
-- (facturar_siguiente_parte) se INSERTA una parte normal con folio —el puente AFTER INSERT crea la
-- factura en cobranza como hoy— y el resto se descuenta; cuando llega a cero se cierra solo.
--
-- LA REGLA QUE LO SOSTIENE (invariante 31):
--     facturado (partes vivas) + resto por facturar + resto cerrado por decision = precio de la orden
-- Si se cancela una parte ya facturada, su dinero REGRESA al resto: no queda un hueco mudo.
--
-- Lo que NO cambia: el puente a cobranza, el timbrado, las comisiones (se pagan al cobrar cada
-- factura), la cancelacion por parte y los candados del split.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. El modelo admite la parte «por facturar» ────────────────────────────────────────────────
ALTER TABLE public.order_invoice_splits DROP CONSTRAINT chk_doc_type;
ALTER TABLE public.order_invoice_splits ADD CONSTRAINT chk_doc_type
  CHECK (doc_type = ANY (ARRAY['factura'::text, 'remision'::text, 'corona_saldo'::text, 'por_facturar'::text]));

ALTER TABLE public.order_invoice_splits DROP CONSTRAINT chk_folio_required_unless_corona;
ALTER TABLE public.order_invoice_splits ADD CONSTRAINT chk_folio_required_unless_corona
  CHECK ((doc_type IN ('corona_saldo','por_facturar') AND invoice_folio IS NULL)
      OR (doc_type IN ('factura','remision') AND invoice_folio IS NOT NULL));

-- ── 2. El puente ignora el resto: no hay factura que crear todavia ─────────────────────────────
DO $P$
DECLARE d text; a text; b text;
BEGIN
  d := pg_get_functiondef('public.sync_invoice_from_split'::regproc);
  a := E'  IF NEW.cancelled_at IS NOT NULL THEN RETURN NEW; END IF;\n';
  b := a || E'  -- v10.84.0: la parte «por facturar» es el RESTO de una orden facturada por partes en el\n'
         || E'  -- tiempo. No tiene folio ni factura todavia: no hay nada que crear en cobranza.\n'
         || E'  IF NEW.doc_type = ''por_facturar'' THEN RETURN NEW; END IF;\n';
  IF (length(d) - length(replace(d, a, ''))) / length(a) <> 1 THEN
    RAISE EXCEPTION 'sync_invoice_from_split: ancla no unica';
  END IF;
  EXECUTE replace(d, a, b);
END $P$;

-- ── 3. assign_invoice_splits acepta partes «por facturar» ──────────────────────────────────────
DO $P$
DECLARE d text; a text; b text; n int;
BEGIN
  d := pg_get_functiondef('public.assign_invoice_splits'::regproc);

  -- 3a. una variable para contar los restos
  a := E'  v_emitter boolean := false;  -- F1: modo emisor (folio nace del counter)\n';
  b := a || E'  v_por_facturar int := 0;     -- v10.84.0: partes que se facturan DESPUES\n';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign_invoice_splits 3a: ancla x%', n; END IF;
  d := replace(d, a, b);

  -- 3b. el resto no cuenta para «todos pre-asignados / ninguno», y no se puede dejar TODO pendiente
  a := E'  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP\n'
    || E'    IF COALESCE((v_split->>''pre_assigned'')::boolean, false) THEN v_none_pre_assigned := false; ELSE v_all_pre_assigned := false; END IF;\n'
    || E'    IF v_split->>''doc_type'' = ''corona_saldo'' THEN v_has_corona_saldo := true; END IF;\n'
    || E'  END LOOP;\n';
  b := E'  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP\n'
    || E'    -- v10.84.0: el resto «por facturar» no es pre-asignado ni normal: se factura despues.\n'
    || E'    IF v_split->>''doc_type'' = ''por_facturar'' THEN v_por_facturar := v_por_facturar + 1; CONTINUE; END IF;\n'
    || E'    IF COALESCE((v_split->>''pre_assigned'')::boolean, false) THEN v_none_pre_assigned := false; ELSE v_all_pre_assigned := false; END IF;\n'
    || E'    IF v_split->>''doc_type'' = ''corona_saldo'' THEN v_has_corona_saldo := true; END IF;\n'
    || E'  END LOOP;\n'
    || E'  IF v_por_facturar = v_splits_count THEN\n'
    || E'    RAISE EXCEPTION ''Para dejarlo todo por facturar no hace falta partir la orden: pon al menos una parte que se facture ahora'' USING ERRCODE=''22023'';\n'
    || E'  END IF;\n'
    || E'  IF v_por_facturar > 1 THEN\n'
    || E'    RAISE EXCEPTION ''Solo puede haber UNA parte por facturar: es el resto, y se va partiendo conforme se factura'' USING ERRCODE=''22023'';\n'
    || E'  END IF;\n';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign_invoice_splits 3b: ancla x%', n; END IF;
  d := replace(d, a, b);

  -- 3c. el tipo es valido
  a := E'IF v_doc_type NOT IN (''factura'',''remision'',''corona_saldo'') THEN RAISE EXCEPTION ''Split %: doc_type debe ser factura, remision o corona_saldo''';
  b := E'IF v_doc_type NOT IN (''factura'',''remision'',''corona_saldo'',''por_facturar'') THEN RAISE EXCEPTION ''Split %: doc_type debe ser factura, remision, corona_saldo o por_facturar''';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign_invoice_splits 3c: ancla x%', n; END IF;
  d := replace(d, a, b);

  -- 3d. el resto no lleva folio ni pasa por la validacion de folios
  a := E'    IF v_doc_type = ''corona_saldo'' THEN\n'
    || E'      IF v_folio != '''' THEN RAISE EXCEPTION ''Split %: corona_saldo no debe tener folio fiscal'', v_position USING ERRCODE=''22023''; END IF;\n';
  b := E'    IF v_doc_type = ''por_facturar'' THEN\n'
    || E'      IF v_folio != '''' THEN RAISE EXCEPTION ''Split %: la parte por facturar no lleva folio todavia'', v_position USING ERRCODE=''22023''; END IF;\n'
    || E'    ELSIF v_doc_type = ''corona_saldo'' THEN\n'
    || E'      IF v_folio != '''' THEN RAISE EXCEPTION ''Split %: corona_saldo no debe tener folio fiscal'', v_position USING ERRCODE=''22023''; END IF;\n';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign_invoice_splits 3d: ancla x%', n; END IF;
  d := replace(d, a, b);

  -- 3e. al insertar y al reportar, el resto va sin folio (dos sitios: INSERT y v_created)
  a := E'CASE WHEN v_doc_type = ''corona_saldo'' THEN NULL ELSE v_folio END';
  b := E'CASE WHEN v_doc_type IN (''corona_saldo'',''por_facturar'') THEN NULL ELSE v_folio END';
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 2 THEN RAISE EXCEPTION 'assign_invoice_splits 3e: ancla x%', n; END IF;
  d := replace(d, a, b);

  -- 3f. que la orden diga que queda algo por facturar
  a := E'        CASE WHEN v_has_corona_saldo THEN '' + saldo Corona'' ELSE '''' END\n';
  b := E'        CASE WHEN v_por_facturar > 0 THEN '' · resto por facturar despues'' ELSE '''' END ||\n' || a;
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'assign_invoice_splits 3f: ancla x%', n; END IF;
  d := replace(d, a, b);

  EXECUTE d;
END $P$;

-- ── 4. Cancelar una parte facturada REGRESA su dinero al resto ─────────────────────────────────
DO $P$
DECLARE d text; a text; b text; n int;
BEGIN
  d := pg_get_functiondef('public.cancel_invoice_split_internal'::regproc);
  a := E'  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)\n'
    || E'  VALUES (''cancel_invoice_split'', ''order_invoice_split'', v_split.id,\n';
  b := E'  -- v10.84.0 — ORDEN FACTURADA POR PARTES EN EL TIEMPO: si se cancela una parte ya facturada, su\n'
    || E'  -- dinero REGRESA al resto por facturar. Sin esto quedaba un hueco mudo entre lo facturado y el\n'
    || E'  -- precio de la orden, y nadie lo volveria a facturar. Solo aplica a ordenes que alguna vez\n'
    || E'  -- tuvieron un resto: las demas conservan su comportamiento (cancelacion parcial deliberada).\n'
    || E'  IF v_split.doc_type IN (''factura'',''remision'')\n'
    || E'     AND EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE order_id = v_split.order_id AND doc_type = ''por_facturar'') THEN\n'
    || E'    UPDATE public.order_invoice_splits\n'
    || E'       SET amount_portion = amount_portion + v_split.amount_portion,\n'
    || E'           qty_portion = qty_portion + v_split.qty_portion,\n'
    || E'           notes = COALESCE(notes,'''') || format(E''\\n[%s] regresan $%s (%s pzas) de la parte %s cancelada: %s'',\n'
    || E'                     to_char(NOW(),''YYYY-MM-DD''), v_split.amount_portion, v_split.qty_portion, v_split.invoice_folio, TRIM(p_reason))\n'
    || E'     WHERE order_id = v_split.order_id AND doc_type = ''por_facturar'' AND cancelled_at IS NULL;\n'
    || E'    IF NOT FOUND THEN\n'
    || E'      INSERT INTO public.order_invoice_splits (order_id, position, qty_portion, amount_portion, doc_type, invoice_folio, invoiced_by, notes)\n'
    || E'      SELECT v_split.order_id, COALESCE(MAX(position),0)+1, v_split.qty_portion, v_split.amount_portion, ''por_facturar'', NULL, p_actor,\n'
    || E'             format(''Reabierto: regresa la parte %s cancelada (%s)'', v_split.invoice_folio, TRIM(p_reason))\n'
    || E'        FROM public.order_invoice_splits WHERE order_id = v_split.order_id;\n'
    || E'    END IF;\n'
    || E'    INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)\n'
    || E'    VALUES (''cancel_invoice_split_regresa_a_resto'', ''order_invoice_split'', v_split.id,\n'
    || E'      jsonb_build_object(''order_id'', v_split.order_id, ''folio'', v_split.invoice_folio,\n'
    || E'        ''amount_portion'', v_split.amount_portion, ''qty_portion'', v_split.qty_portion), p_actor);\n'
    || E'  END IF;\n\n' || a;
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  IF n <> 1 THEN RAISE EXCEPTION 'cancel_invoice_split_internal: ancla x%', n; END IF;
  EXECUTE replace(d, a, b);
END $P$;

-- ── 5. Facturar la siguiente parte ─────────────────────────────────────────────────────────────
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
DECLARE
  v_resto RECORD; v_order RECORD; v_emitter boolean := false;
  v_folio text; v_folio_num int; v_pos int; v_new_id uuid; v_cerrado boolean;
  v_resto_nuevo numeric; v_qty_nuevo int; v_amount numeric;
BEGIN
  PERFORM public.lock_serie_vigente();
  IF p_actor IS NULL OR TRIM(p_actor) = '' THEN RAISE EXCEPTION 'p_actor requerido' USING ERRCODE='22023'; END IF;
  PERFORM public.verify_actor_role(p_actor, ARRAY['admin','karla']);
  IF p_doc_type NOT IN ('factura','remision') THEN
    RAISE EXCEPTION 'p_doc_type debe ser factura o remision' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_resto FROM public.order_invoice_splits WHERE id = p_split_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa parte no existe' USING ERRCODE='22023'; END IF;
  IF v_resto.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ese resto ya se cerro el % (%)', v_resto.cancelled_at::date, v_resto.cancellation_reason USING ERRCODE='22023';
  END IF;
  IF v_resto.doc_type <> 'por_facturar' THEN
    RAISE EXCEPTION 'Esa parte ya esta facturada (%): solo se factura desde el resto', COALESCE(v_resto.invoice_folio, v_resto.doc_type) USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_resto.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La orden % no existe', v_resto.order_id USING ERRCODE='22023'; END IF;
  IF v_order.cancelled_at IS NOT NULL OR v_order.stage LIKE '%cancelled%' THEN
    RAISE EXCEPTION 'La orden % esta cancelada' , COALESCE(v_order.production_number, v_order.id) USING ERRCODE='22023';
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
    IF p_qty >= v_resto.qty_portion THEN
      RAISE EXCEPTION 'Si facturas solo una parte del dinero, deja al menos una pieza en el resto' USING ERRCODE='22023';
    END IF;
    v_amount := ROUND(p_amount, 2);
  END IF;

  -- el folio: en modo emisor nace del counter; si no, lo trae el usuario y se valida como en el split
  SELECT COALESCE((value->>'v')::boolean, false) INTO v_emitter FROM cobranza.app_config WHERE key = 'folio_emitter_enabled';
  PERFORM 1 FROM public.invoice_counters WHERE type IN ('factura','factura_f','remision','remision_rs') ORDER BY type FOR UPDATE;
  IF COALESCE(v_emitter, false) THEN
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
    IF EXISTS (SELECT 1 FROM public.orders WHERE invoice_folio = v_folio)
       OR EXISTS (SELECT 1 FROM public.purchase_orders WHERE shared_invoice_folio = v_folio)
       OR EXISTS (SELECT 1 FROM public.oc_invoice_groups WHERE folio = v_folio)
       OR EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE invoice_folio = v_folio AND cancelled_at IS NULL)
       OR EXISTS (SELECT 1 FROM cobranza.invoices WHERE doc_type = p_doc_type AND doc_number = v_folio AND status <> 'cancelada') THEN
      RAISE EXCEPTION 'El folio % ya esta en uso', v_folio USING ERRCODE='22023';
    END IF;
    v_folio_num := SUBSTRING(v_folio FROM '[0-9]+$')::int;
    UPDATE public.invoice_counters SET last_number = GREATEST(last_number, v_folio_num), updated_at = NOW()
      WHERE type = CASE WHEN v_folio LIKE 'F-%' THEN 'factura_f' WHEN v_folio LIKE 'RS-%' THEN 'remision_rs' ELSE p_doc_type END;
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_pos FROM public.order_invoice_splits WHERE order_id = v_resto.order_id;

  -- la parte nueva, CON folio: el puente AFTER INSERT crea la factura en cobranza
  INSERT INTO public.order_invoice_splits
    (order_id, position, qty_portion, amount_portion, doc_type, invoice_folio, invoice_pre_assigned, payment_status, invoiced_by, notes)
  VALUES
    (v_resto.order_id, v_pos, p_qty, v_amount, p_doc_type, v_folio, false, 'unpaid', p_actor,
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
    jsonb_build_object('order_id', v_resto.order_id, 'production_number', v_order.production_number,
      'resto_split_id', p_split_id, 'folio', v_folio, 'doc_type', p_doc_type, 'position', v_pos,
      'amount', v_amount, 'qty', p_qty, 'resto_antes', v_resto.amount_portion, 'resto_despues', v_resto_nuevo,
      'cerrado', v_cerrado, 'notes', p_notes), p_actor);

  RETURN jsonb_build_object('folio', v_folio, 'split_id', v_new_id, 'position', v_pos,
    'amount', v_amount, 'qty', p_qty, 'resto', v_resto_nuevo, 'resto_qty', v_qty_nuevo,
    'cerrado', v_cerrado, 'order_id', v_resto.order_id);
END $F$;

-- ⚠ una funcion nueva nace con EXECUTE para PUBLIC: se cierra y se abre igual que su hermana
REVOKE ALL ON FUNCTION public.facturar_siguiente_parte(uuid, numeric, integer, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.facturar_siguiente_parte(uuid, numeric, integer, text, text, text, text) TO authenticated, service_role;

-- ── 6. (v10.84.0b) La invariante 9 la cazo: seguia ejecutable por anon ─────────────────────────
-- En Supabase el schema public tiene DEFAULT ACL que concede EXECUTE a anon/authenticated/
-- service_role a toda funcion nueva; REVOKE FROM PUBLIC no toca ese grant EXPLICITO. Se nombra.
REVOKE EXECUTE ON FUNCTION public.facturar_siguiente_parte(uuid, numeric, integer, text, text, text, text) FROM anon;
