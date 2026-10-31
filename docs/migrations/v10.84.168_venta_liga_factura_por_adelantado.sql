-- v10.84.168 — LA VENTA DE INVENTARIO SE LIGA A LA FACTURA HECHA POR ADELANTADO (Marcelo, 30-oct-2026: «la F234 queremos sacar un traslado con
-- esa factura, pero no aparece… esa factura no se creó desde el carrito de Cuadra en PrintFlow, se creó como una factura sin orden de producción»).
-- F-234 (MANUFACTURERA DE BOTAS CUADRA, $91,315.20, el pedido de cada semana) la hizo Karla en CobranzaFlow el 28-oct por adelantado («El cliente
-- solicita la factura antes de entregar el pedido») y la timbró. Su nota dice «Se liga en PrintFlow… PrintFlow la ofrece si el importe coincide al
-- centavo», y es cierto en las otras puertas (asignar folio a la orden o a la OC, el plan matriz, la siguiente parte), pero NO en el carrito de
-- inventario: bulk_sell_from_stock siempre acuña un folio nuevo. Sin poder registrar la venta (salía otra factura de $91,315.20) no había OC, y
-- Traslados (cobranza.traslado_ocs_candidatas) sólo busca entre órdenes con OC: F-234 no aparecía.
-- APLICADA el 30-oct-2026 ~18:54 con el OK escrito de Marcelo («Sí, aplícala tú»), por la API de administración, en una sola transacción, como
-- `v10_84_168_venta_liga_factura_por_adelantado` (20261031005425) y `…_definiciones_vivas` (20261031005426). Ensayada antes con rollback, como Karla:
-- 13 de 13 (frena otro importe, otro cliente, ya ligada, no existe, cancelada, sin permiso y folio sin forma; liga F-234 sin factura nueva ni contador;
-- Traslados la encuentra; el doble clic frena; el carrito de siempre igual). La vuelta atrás, ensayada: deja bulk_sell_from_stock con la misma huella
-- (md5 7eea7877ea4e16eb7ec49da9e818ffeb); aplicada, su huella es la del ensayo (4f2fbf49203298c9aa012e88769ae66d). Invariantes 91 de 91.
--   1. public.bulk_sell_from_stock (MISMA firma): si pf.venta_liga_folio trae un folio, la venta lleva ESE folio. No se acuña ninguno, el puente
--      no crea factura (ya existe: sync_invoice_from_oc la ve y anota skip_invoice_duplicate) y la factura sólo gana su OC (source_order_id), como
--      en link_invoice_to_oc: su importe, su saldo, sus cobros y su CFDI no se tocan. Se revisa que esté viva, hecha por adelantado (sin orden),
--      sin ligar, del MISMO cliente y por el mismo importe (±2 centavos, como link_invoice_to_oc), con candado sobre la factura. Las órdenes nacen
--      igual que las de siempre (source 'stock', order_type 'interna', stage 'delivered', stock_role 'sale': Almacén las lee así) y el inventario
--      se descuenta igual. Sin pf.venta_liga_folio, todo como antes.
--   2. public.vender_de_inventario_ligando (nueva): la única que pone pf.venta_liga_folio (es de la transacción; desde el navegador no se puede
--      poner) y llama al carrito de siempre, sin pagos (los cobros de una factura que ya existe van en CobranzaFlow). Dirección y Karla.
--   3. public.facturas_por_adelantado_para_venta (nueva, sólo lee): las facturas hechas por adelantado, vivas y sin ligar, del cliente al que se
--      vende y, si es de un apartado compartido (Cuadra), las de los demás clientes del apartado, para que el carrito avise si la venta va al
--      cliente equivocado. Con los permisos de list_linkable_invoices_for_oc.
-- Parche de texto con anclas contadas (la regla 7 de PrintFlow): si una ancla no aparece exactamente una vez, se detiene sin cambiar nada (alguien
-- cambió la función: hay que volver a mirarla). Registrar después como *_definiciones_vivas.
-- Vuelta atrás: v10.84.168_venta_liga_factura_por_adelantado_vuelta_atras.sql (el mismo parche, al revés, y las dos funciones nuevas fuera).
DO $parche$
DECLARE
  f_venta regprocedure := 'public.bulk_sell_from_stock(jsonb,numeric,uuid,text,text,text,jsonb,date,text,text,text,text)'::regprocedure;
  d text; n int; i int; de text[]; a text[];
  a1 text; r1 text; a2 text; r2 text; a3 text; r3 text; a4 text; r4 text; a5 text; r5 text;
  a6 text; r6 text; a7 text; r7 text; a8 text; r8 text; a9 text; r9 text; a10 text; r10 text;
BEGIN
  -- Las anclas son renglones enteros de la función viva y los saltos van con E'\n' (no escritos en el archivo): así el parche no depende de cómo
  -- guarde los renglones el editor (CRLF en Windows).
  a1 := $a$  v_counter_type text; -- serie F: counter usado SOLO al EMITIR ('factura' hoy, 'factura_f' tras el corte)$a$;
  r1 := a1 || E'\n' || array_to_string(ARRAY[
    $a$  -- v10.84.168 — la venta que se liga a una factura hecha por adelantado: su folio lo pone public.vender_de_inventario_ligando en$a$,
    $a$  --   pf.venta_liga_folio, que dura lo que la transacción y no se puede poner desde el navegador. Sin él, todo como antes.$a$,
    $a$  v_liga text := NULLIF(btrim(COALESCE(current_setting('pf.venta_liga_folio', true), '')), '');$a$,
    $a$  v_liga_inv record; v_pay text; v_pagado numeric; v_cnt int; v_vend uuid;$a$
  ], E'\n');

  a2 := $a$  v_emitter := COALESCE(v_emitter, false);$a$;
  r2 := a2 || E'\n' || array_to_string(ARRAY[
    $a$  -- v10.84.168 — LIGAR LA VENTA A UNA FACTURA HECHA POR ADELANTADO (F-234 de MANUFACTURERA DE BOTAS CUADRA, 30-oct-2026). Karla la hizo en$a$,
    $a$  --   CobranzaFlow antes de entregar y este carrito sólo sabía acuñar otra: la venta no se podía registrar sin duplicar la factura, y sin venta$a$,
    $a$  --   no había OC con qué sacar el traslado. Ligando, la venta lleva ESE folio: no se acuña ninguno, el puente no crea factura (ya existe) y la$a$,
    $a$  --   factura sólo gana su OC (source_order_id), como en link_invoice_to_oc; su importe, su saldo y sus cobros no se tocan.$a$,
    $a$  IF v_liga IS NOT NULL THEN$a$,
    $a$    p_folio := upper(v_liga);$a$,
    $a$    IF p_folio !~ '^(F|D|RS|R)-[0-9]+$' OR public.doc_type_de_folio(p_folio) IS DISTINCT FROM p_invoice_type THEN$a$,
    $a$      RAISE EXCEPTION 'No se puede ligar % a una venta con %.', p_folio, p_invoice_type USING ERRCODE='22023';$a$,
    $a$    END IF;$a$,
    $a$    IF p_payment_status <> 'unpaid' OR (jsonb_typeof(p_payment_refs) = 'array' AND jsonb_array_length(p_payment_refs) > 0) THEN$a$,
    $a$      RAISE EXCEPTION 'Los cobros de % se registran en CobranzaFlow: la venta que se liga no lleva pagos.', p_folio USING ERRCODE='22023';$a$,
    $a$    END IF;$a$,
    $a$  END IF;$a$
  ], E'\n');

  a3 := $a$  IF NOT v_emitter THEN$a$ || E'\n'
        || $a$  IF p_folio IS NULL OR p_folio !~ ('^' || v_prefix || '[0-9]+$') THEN RAISE EXCEPTION 'Folio inválido: % (esperado %NNNN)', p_folio, v_prefix USING ERRCODE='22023'; END IF;$a$;
  r3 := $a$  IF NOT v_emitter AND v_liga IS NULL THEN  -- v10.84.168: la venta que se liga no transcribe folio$a$ || E'\n'
        || $a$  IF p_folio IS NULL OR p_folio !~ ('^' || v_prefix || '[0-9]+$') THEN RAISE EXCEPTION 'Folio inválido: % (esperado %NNNN)', p_folio, v_prefix USING ERRCODE='22023'; END IF;$a$;

  a4 := $a$  IF v_emitter THEN$a$ || E'\n'
        || $a$    UPDATE public.invoice_counters SET last_number = last_number + 1, updated_at = v_now WHERE type = v_counter_type RETURNING last_number INTO v_folio_num;$a$;
  r4 := $a$  IF v_emitter AND v_liga IS NULL THEN  -- v10.84.168: la venta que se liga no acuña folio (ya lo tiene su factura)$a$ || E'\n'
        || $a$    UPDATE public.invoice_counters SET last_number = last_number + 1, updated_at = v_now WHERE type = v_counter_type RETURNING last_number INTO v_folio_num;$a$;

  a5 := $a$  IF EXISTS (SELECT 1 FROM cobranza.invoices WHERE doc_type = p_invoice_type AND doc_number = p_folio AND status <> 'cancelada') THEN$a$;
  r5 := $a$  IF v_liga IS NULL AND EXISTS (SELECT 1 FROM cobranza.invoices WHERE doc_type = p_invoice_type AND doc_number = p_folio AND status <> 'cancelada') THEN  -- v10.84.168: la que se liga sí existe (se revisa abajo)$a$;

  a6 := $a$    RAISE EXCEPTION 'El total que llegó ($%) no cuadra con la suma de los productos ($%): vuelve a abrir el carrito.', p_total_amount, v_invoice_amount USING ERRCODE='22023';$a$
        || E'\n' || $a$  END IF;$a$;
  r6 := a6 || E'\n' || array_to_string(ARRAY[
    $a$  -- v10.84.168 — la factura que se liga: viva, hecha por adelantado (sin orden) y sin ligar, del MISMO cliente y por el mismo importe (±2$a$,
    $a$  --   centavos, como link_invoice_to_oc). Con candado: dos ventas no se ligan a la misma factura (la segunda ve source_order_id y se detiene).$a$,
    $a$  IF v_liga IS NOT NULL THEN$a$,
    $a$    SELECT i.id, i.client_id, i.source, i.source_order_id, i.amount, i.status, i.balance, i.credited_amount, i.seller$a$,
    $a$      INTO v_liga_inv$a$,
    $a$      FROM cobranza.invoices i$a$,
    $a$     WHERE i.doc_type = p_invoice_type AND i.doc_number = p_folio AND i.status <> 'cancelada'$a$,
    $a$     LIMIT 1 FOR UPDATE;$a$,
    $a$    IF NOT FOUND THEN RAISE EXCEPTION '% no existe viva en CobranzaFlow: no hay factura que ligar.', p_folio USING ERRCODE='22023'; END IF;$a$,
    $a$    IF v_liga_inv.source_order_id IS NOT NULL THEN$a$,
    $a$      RAISE EXCEPTION '% ya está ligada a %: no se liga dos veces.', p_folio, v_liga_inv.source_order_id USING ERRCODE='22023';$a$,
    $a$    END IF;$a$,
    $a$    IF v_liga_inv.source IS DISTINCT FROM 'sin_orden' THEN$a$,
    $a$      RAISE EXCEPTION '% no es una factura hecha por adelantado (sin orden): no se liga a una venta.', p_folio USING ERRCODE='22023';$a$,
    $a$    END IF;$a$,
    $a$    IF v_liga_inv.client_id IS DISTINCT FROM v_client.id THEN$a$,
    $a$      RAISE EXCEPTION '% es de otro cliente: esta venta es a %.', p_folio, v_client.name USING ERRCODE='22023';$a$,
    $a$    END IF;$a$,
    $a$    IF ABS(v_liga_inv.amount - v_invoice_amount) > 0.02 THEN$a$,
    $a$      RAISE EXCEPTION '% es por $% y esta venta suma $%: no es la misma venta.', p_folio, v_liga_inv.amount, v_invoice_amount USING ERRCODE='22023';$a$,
    $a$    END IF;$a$,
    $a$    v_pay := CASE WHEN v_liga_inv.status = 'pagada' THEN 'paid' WHEN v_liga_inv.status = 'parcial' THEN 'partial' ELSE 'unpaid' END;$a$,
    $a$    v_pagado := GREATEST(ROUND(v_liga_inv.amount - COALESCE(v_liga_inv.balance, 0) - COALESCE(v_liga_inv.credited_amount, 0), 2), 0);$a$,
    $a$  END IF;$a$
  ], E'\n');

  a7 := $a$      p_payment_status,$a$ || E'\n'
        || $a$      CASE WHEN p_payment_status IN ('partial','paid') AND jsonb_array_length(p_payment_refs) > 0 THEN (p_payment_refs->0->>'method') ELSE NULL END,$a$ || E'\n'
        || $a$      CASE WHEN p_payment_status = 'partial' THEN v_refs_total_cents/100.0 ELSE NULL END,$a$;
  r7 := array_to_string(ARRAY[
    $a$      COALESCE(v_pay, p_payment_status),  -- v10.84.168: la venta que se liga, como está su factura (link_invoice_to_oc)$a$,
    $a$      CASE WHEN v_pay IN ('paid','partial') THEN 'otro'$a$,
    $a$           WHEN v_liga IS NULL AND p_payment_status IN ('partial','paid') AND jsonb_array_length(p_payment_refs) > 0 THEN (p_payment_refs->0->>'method') ELSE NULL END,$a$,
    $a$      CASE WHEN v_pay = 'partial' THEN GREATEST(ROUND(v_pagado * v_order_price / v_subtotal, 2), 0.01)$a$,
    $a$           WHEN v_liga IS NULL AND p_payment_status = 'partial' THEN v_refs_total_cents/100.0 ELSE NULL END,$a$
  ], E'\n');

  a8 := $a$  IF p_payment_status IN ('partial','paid') THEN$a$ || E'\n'
        || $a$    FOR v_ref IN SELECT * FROM jsonb_array_elements(p_payment_refs) LOOP$a$;
  r8 := array_to_string(ARRAY[
    $a$  IF v_liga IS NOT NULL THEN$a$,
    $a$    -- v10.84.168 — la factura ya existe, con su importe, su saldo, sus cobros y su CFDI: no se tocan. Sólo gana su OC, como en link_invoice_to_oc.$a$,
    $a$    IF v_invoice_id IS DISTINCT FROM v_liga_inv.id THEN$a$,
    $a$      RAISE EXCEPTION '% ya no es la factura que se iba a ligar: no se registró nada.', p_folio USING ERRCODE='40001';$a$,
    $a$    END IF;$a$,
    $a$    UPDATE cobranza.invoices SET source_order_id = v_oc_id WHERE id = v_liga_inv.id AND source_order_id IS NULL;$a$,
    $a$    GET DIAGNOSTICS v_cnt = ROW_COUNT;$a$,
    $a$    IF v_cnt <> 1 THEN$a$,
    $a$      RAISE EXCEPTION '% la ligó otra operación al mismo tiempo: no se registró nada.', p_folio USING ERRCODE='40001';$a$,
    $a$    END IF;$a$,
    $a$    INSERT INTO public.order_timeline (order_id, action, by_user, color)$a$,
    $a$    SELECT o.id, '🔗 ' || p_folio || ' (emitida por adelantado) ligada a esta venta de inventario · ' || v_oc_id, p_actor, '#5856d6'$a$,
    $a$      FROM public.orders o WHERE o.purchase_order_id = v_oc_id;$a$,
    $a$    IF v_liga_inv.seller IS NULL THEN$a$,
    $a$      v_vend := cobranza.resolve_seller(p_agent);$a$,
    $a$      IF v_vend IS NOT NULL THEN$a$,
    $a$        BEGIN PERFORM cobranza.set_invoice_seller(v_liga_inv.id, v_vend, p_actor);$a$,
    $a$        EXCEPTION WHEN insufficient_privilege THEN NULL; END;$a$,
    $a$      END IF;$a$,
    $a$    END IF;$a$,
    $a$    INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)$a$,
    $a$    VALUES ('link_existing_invoice_to_oc', 'invoice', v_liga_inv.id,$a$,
    $a$      jsonb_build_object('oc_id', v_oc_id, 'folio', p_folio, 'orders', v_orders_created, 'amount', v_liga_inv.amount,$a$,
    $a$        'oc_total', v_invoice_amount, 'invoice_status', v_liga_inv.status, 'client_id', v_client.id,$a$,
    $a$        'desde', 'venta de inventario (v10.84.168)'), p_actor);$a$,
    $a$  ELSIF p_payment_status IN ('partial','paid') THEN$a$,
    $a$    FOR v_ref IN SELECT * FROM jsonb_array_elements(p_payment_refs) LOOP$a$
  ], E'\n');

  a9 := $a$'subtotal_sin_iva', v_subtotal, 'precio_por_renglon', true, 'payment_status', p_payment_status,$a$;
  r9 := $a$'subtotal_sin_iva', v_subtotal, 'precio_por_renglon', true, 'ligada_a_factura_existente', (v_liga IS NOT NULL), 'payment_status', COALESCE(v_pay, p_payment_status),$a$;

  a10 := $a$'items_count', v_items_count, 'total_amount', p_total_amount, 'payment_status', p_payment_status, 'orders_created', v_orders_created);$a$;
  r10 := $a$'items_count', v_items_count, 'total_amount', p_total_amount, 'payment_status', COALESCE(v_pay, p_payment_status), 'orders_created', v_orders_created,$a$
         || E'\n' || $a$    'ligada', (v_liga IS NOT NULL));$a$;

  d := pg_get_functiondef(f_venta);
  IF position('v10.84.168' in d) > 0 THEN
    RAISE EXCEPTION 'bulk_sell_from_stock ya tiene v10.84.168: no se aplica dos veces';
  END IF;
  de := ARRAY[a1, a2, a3, a4, a5, a6, a7, a8, a9, a10];
  a := ARRAY[r1, r2, r3, r4, r5, r6, r7, r8, r9, r10];
  FOR i IN 1..array_length(de, 1) LOOP
    n := (length(d) - length(replace(d, de[i], ''))) / length(de[i]);
    IF n <> 1 THEN RAISE EXCEPTION 'bulk_sell_from_stock: el ancla % aparece % veces (debe 1); no se cambió nada', i, n; END IF;
    d := replace(d, de[i], a[i]);
  END LOOP;
  EXECUTE d;
END $parche$;
-- @@ corte
CREATE OR REPLACE FUNCTION public.vender_de_inventario_ligando(p_folio text, p_items jsonb, p_total_amount numeric, p_client_id uuid,
  p_agent text DEFAULT NULL, p_notes text DEFAULT NULL, p_actor text DEFAULT NULL, p_client_agent text DEFAULT NULL, p_due_date date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $f$
-- v10.84.168 — la venta de inventario que se liga a una factura hecha por adelantado (F-234 de Cuadra, 30-oct-2026). Es el carrito de siempre
--   (public.bulk_sell_from_stock: las mismas revisiones, el mismo descuento del inventario y las mismas órdenes) con el folio de la factura que ya
--   existe en vez de uno nuevo, y sin pagos: los cobros de esa factura se registran en CobranzaFlow. La única que pone pf.venta_liga_folio.
DECLARE
  v_folio text := upper(btrim(COALESCE(p_folio, '')));
  v_tipo text;
  v_res jsonb;
BEGIN
  PERFORM public.verify_actor_role(p_actor, ARRAY['admin','karla']);
  v_tipo := public.doc_type_de_folio(v_folio);
  IF v_folio !~ '^(F|D|RS|R)-[0-9]+$' OR v_tipo IS NULL THEN
    RAISE EXCEPTION 'Folio inválido para ligar: %', p_folio USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('pf.venta_liga_folio', v_folio, true);
  v_res := public.bulk_sell_from_stock(p_items, p_total_amount, p_client_id, v_tipo, v_folio, 'unpaid', NULL::jsonb,
                                       p_due_date, p_agent, p_notes, p_actor, p_client_agent);
  PERFORM set_config('pf.venta_liga_folio', '', true);
  RETURN v_res;
END $f$;
-- @@ corte
REVOKE ALL ON FUNCTION public.vender_de_inventario_ligando(text, jsonb, numeric, uuid, text, text, text, text, date) FROM PUBLIC, anon;
-- @@ corte
GRANT EXECUTE ON FUNCTION public.vender_de_inventario_ligando(text, jsonb, numeric, uuid, text, text, text, text, date) TO authenticated, service_role;
-- @@ corte
CREATE OR REPLACE FUNCTION public.facturas_por_adelantado_para_venta(p_client_id uuid)
 RETURNS TABLE(doc_number text, doc_type text, amount numeric, balance numeric, status text, cfdi_status text, issued_date date,
               dias_sin_orden integer, notas text, client_id uuid, cliente text, es_de_otro_cliente boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $f$
-- v10.84.168 — lo que el carrito de inventario revisa antes de vender: las facturas hechas por adelantado (sin orden, vivas y sin ligar) del cliente
--   al que se vende y, si es de un apartado compartido (Cuadra), las de los demás clientes del apartado (para avisar si la venta va al cliente
--   equivocado). Con los permisos de list_linkable_invoices_for_oc.
DECLARE v_pool uuid;
BEGIN
  IF NOT (cobranza.is_admin_role() OR COALESCE(public.pf_uid_role() IN ('admin','karla'), false)) THEN
    RAISE EXCEPTION 'Acceso restringido' USING ERRCODE = '42501';
  END IF;
  IF p_client_id IS NULL THEN RETURN; END IF;
  SELECT c.stock_pool_id INTO v_pool FROM cobranza.clients c WHERE c.id = p_client_id;
  RETURN QUERY
  SELECT i.doc_number, i.doc_type, i.amount, i.balance, i.status, i.cfdi_status, i.issued_date,
         ((now() AT TIME ZONE 'America/Mexico_City')::date - i.issued_date)::int,
         i.notas, i.client_id, c.name, (i.client_id <> p_client_id)
    FROM cobranza.invoices i
    JOIN cobranza.clients c ON c.id = i.client_id
   WHERE i.source = 'sin_orden' AND i.source_order_id IS NULL AND i.status <> 'cancelada'
     AND (i.client_id = p_client_id OR (v_pool IS NOT NULL AND c.stock_pool_id = v_pool))
   ORDER BY (i.client_id <> p_client_id), i.issued_date, i.doc_number;
END $f$;
-- @@ corte
REVOKE ALL ON FUNCTION public.facturas_por_adelantado_para_venta(uuid) FROM PUBLIC, anon;
-- @@ corte
GRANT EXECUTE ON FUNCTION public.facturas_por_adelantado_para_venta(uuid) TO authenticated, service_role;
