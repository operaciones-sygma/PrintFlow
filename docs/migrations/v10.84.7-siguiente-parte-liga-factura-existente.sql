-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- v10.84.7 — facturar_siguiente_parte(…, p_allow_link) LIGA una factura que ya existe en cobranza
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- EL CASO (Portland P-0465, 18-sep-2026). Antes de que existiera «facturar por partes en el tiempo»
-- (v10.84.0) las dos primeras entregas de la orden se facturaron SIN ORDEN desde CobranzaFlow:
-- F-35 (26,100 pzas, $11,484) y F-66 (43,900 pzas, $19,316). Después alguien partió la orden desde
-- PrintFlow y salió F-65 (35,000 pzas, sin timbrar) por la primera parte: una factura duplicada y
-- con las piezas equivocadas. Karla: «¿se pueden ligar las facturas, aún faltando una por x monto?».
-- Sí: partes vivas + resto = orden (invariantes 31/34), y el resto se factura el 24-sep.
--
-- LO QUE FALTABA. `facturar_siguiente_parte` con el emisor activo siempre acuña folio nuevo y
-- rechaza `p_folio`; `assign_invoice_splits` sí sabe ligar (Opción A, `p_allow_link`) pero exige que
-- la orden no tenga partes vivas, y cancelar todas las partes cancela la orden. Aquí se le da a
-- `facturar_siguiente_parte` el mismo poder: con `p_allow_link := true` y un `p_folio` que ya vive
-- en cobranza, la parte nueva nace con ese folio (sin tocar el counter), el puente la salta
-- (`bridge_split_skip_duplicate`) y la factura recibe `source_order_id`. Mismos cuatro guards de la
-- Opción A: mismo cliente, sin orden previa, folio libre en PrintFlow, importe = parte × 1.16 ± 0.02.
--
-- FIRMA NUEVA (parámetro con DEFAULT): se hace DROP de la vieja (regla 4: cambiar la firma crea otra
-- función abierta) y se repiten REVOKE/GRANT como estaban (anon fuera; authenticated y service_role).
-- El front de PrintFlow llama con parámetros nombrados: sigue funcionando sin cambios. La opción en
-- el modal «Facturar siguiente parte» («ligar una factura que ya existe») va en el lote del lunes.
--
-- Aplicada como `v10_84_7_siguiente_parte_liga_factura_existente` (18-sep). Parche de texto con
-- md5 de la definición viva (a2125bc4…) y siete anclas contadas.

DO $do$
DECLARE
  v_def text; v_new text; v_n int;
  a1 text := 'p_folio text DEFAULT NULL::text)';
  a2 text := E'  v_pre boolean := false; v_pre_reason text;\n';
  a3 text := E'  IF COALESCE(v_emitter, false) THEN\n    IF NULLIF(TRIM(COALESCE(p_folio, '''')), '''') IS NOT NULL THEN\n      RAISE EXCEPTION ''Con el emisor activo el folio lo asigna el sistema: no mandes p_folio'' USING ERRCODE=''22023'';\n    END IF;\n    UPDATE public.invoice_counters SET last_number = last_number + 1, updated_at = NOW()\n';
  a4 text := E'      RAISE EXCEPTION ''Emisor: el counter genero folio % ya asignado a otra orden (drift).'', v_folio USING ERRCODE=''22023'';\n    END IF;\n  ELSE\n    v_folio := UPPER(TRIM(COALESCE(p_folio, '''')));\n';
  a5 text := E'  RETURNING id INTO v_new_id;\n\n  IF v_cerrado THEN\n';
  a6 text := '''cerrado'', v_cerrado, ''pre_assigned'', v_pre, ''notes'', p_notes), p_actor);';
  a7 text := '''cerrado'', v_cerrado, ''order_id'', v_order_id);';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'facturar_siguiente_parte';
  IF md5(v_def) <> 'a2125bc410985eb8b57e93b81ef5d9b0' THEN
    RAISE EXCEPTION 'facturar_siguiente_parte cambió (md5 %): releer antes de parchar', md5(v_def);
  END IF;
  IF (length(v_def) - length(replace(v_def, a1, ''))) / length(a1) <> 1 THEN RAISE EXCEPTION 'ancla 1'; END IF;
  IF (length(v_def) - length(replace(v_def, a2, ''))) / length(a2) <> 1 THEN RAISE EXCEPTION 'ancla 2'; END IF;
  IF (length(v_def) - length(replace(v_def, a3, ''))) / length(a3) <> 1 THEN RAISE EXCEPTION 'ancla 3'; END IF;
  IF (length(v_def) - length(replace(v_def, a4, ''))) / length(a4) <> 1 THEN RAISE EXCEPTION 'ancla 4'; END IF;
  IF (length(v_def) - length(replace(v_def, a5, ''))) / length(a5) <> 1 THEN RAISE EXCEPTION 'ancla 5'; END IF;
  IF (length(v_def) - length(replace(v_def, a6, ''))) / length(a6) <> 1 THEN RAISE EXCEPTION 'ancla 6'; END IF;
  IF (length(v_def) - length(replace(v_def, a7, ''))) / length(a7) <> 1 THEN RAISE EXCEPTION 'ancla 7'; END IF;

  v_new := replace(v_def, a1, 'p_folio text DEFAULT NULL::text, p_allow_link boolean DEFAULT false)');
  v_new := replace(v_new, a2, a2 ||
    E'  -- v10.84.7: ligar una factura que ya existe en cobranza como la siguiente parte\n' ||
    E'  v_link boolean := false; v_ex_id uuid; v_ex_client uuid; v_ex_src uuid; v_ex_amount numeric;\n' ||
    E'  v_part_con_iva numeric; v_client_id uuid; v_cnt int;\n');
  v_new := replace(v_new, a3,
    E'  IF COALESCE(v_emitter, false) THEN\n' ||
    E'    IF NULLIF(TRIM(COALESCE(p_folio, '''')), '''') IS NOT NULL AND NOT COALESCE(p_allow_link, false) THEN\n' ||
    E'      RAISE EXCEPTION ''Con el emisor activo el folio lo asigna el sistema: no mandes p_folio (para LIGAR una factura que ya existe en cobranza manda p_allow_link)'' USING ERRCODE=''22023'';\n' ||
    E'    END IF;\n' ||
    E'    IF NULLIF(TRIM(COALESCE(p_folio, '''')), '''') IS NOT NULL THEN\n' ||
    E'      -- v10.84.7 — LIGAR (espejo de la Opción A de assign_invoice_splits): la parte nace con un\n' ||
    E'      -- folio que YA vive en cobranza; el counter no se toca y el puente la salta. Caso Portland\n' ||
    E'      -- P-0465: dos entregas facturadas sin orden antes de que existiera facturar por partes.\n' ||
    E'      v_folio := UPPER(TRIM(p_folio));\n' ||
    E'      IF v_folio !~ (CASE WHEN p_doc_type = ''factura'' THEN ''^(D|F)-[0-9]+$'' ELSE ''^(RS|R)-[0-9]+$'' END) THEN\n' ||
    E'        RAISE EXCEPTION ''Folio invalido: %'', v_folio USING ERRCODE=''22023'';\n' ||
    E'      END IF;\n' ||
    E'      IF v_order.client_id IS NOT NULL THEN v_client_id := v_order.client_id; ELSE v_client_id := cobranza.resolve_client(v_order.client); END IF;\n' ||
    E'      SELECT id, client_id, source_order_id, amount INTO v_ex_id, v_ex_client, v_ex_src, v_ex_amount\n' ||
    E'        FROM cobranza.invoices WHERE doc_type = p_doc_type AND doc_number = v_folio AND status <> ''cancelada'' LIMIT 1 FOR UPDATE;\n' ||
    E'      IF v_ex_id IS NULL THEN\n' ||
    E'        RAISE EXCEPTION ''El folio % no existe en cobranza: escribe uno solo para LIGAR una factura que ya exista'', v_folio USING ERRCODE=''22023'';\n' ||
    E'      END IF;\n' ||
    E'      IF v_ex_client IS DISTINCT FROM v_client_id THEN\n' ||
    E'        RAISE EXCEPTION ''El folio % existe en cobranza para OTRO cliente: no se puede ligar'', v_folio USING ERRCODE=''22023'';\n' ||
    E'      END IF;\n' ||
    E'      IF v_ex_src IS NOT NULL THEN\n' ||
    E'        RAISE EXCEPTION ''El folio % ya esta ligado a otra orden: no se puede re-ligar'', v_folio USING ERRCODE=''22023'';\n' ||
    E'      END IF;\n' ||
    E'      IF EXISTS (SELECT 1 FROM public.orders WHERE invoice_folio = v_folio)\n' ||
    E'         OR EXISTS (SELECT 1 FROM public.purchase_orders WHERE shared_invoice_folio = v_folio)\n' ||
    E'         OR EXISTS (SELECT 1 FROM public.oc_invoice_groups WHERE folio = v_folio)\n' ||
    E'         OR EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE invoice_folio = v_folio AND cancelled_at IS NULL) THEN\n' ||
    E'        RAISE EXCEPTION ''El folio % ya esta en uso en otra orden de PrintFlow'', v_folio USING ERRCODE=''22023'';\n' ||
    E'      END IF;\n' ||
    E'      v_part_con_iva := CASE WHEN p_doc_type = ''factura'' THEN ROUND(v_amount * 1.16, 2) ELSE v_amount END;\n' ||
    E'      IF ABS(v_ex_amount - v_part_con_iva) > 0.02 THEN\n' ||
    E'        RAISE EXCEPTION ''El folio % existe en cobranza por $% pero esta parte es $% (con IVA): no coincide, verifica que sea la misma venta'', v_folio, v_ex_amount, v_part_con_iva USING ERRCODE=''22023'';\n' ||
    E'      END IF;\n' ||
    E'      v_folio_num := SUBSTRING(v_folio FROM ''[0-9]+$'')::int;\n' ||
    E'      v_link := true;\n' ||
    E'    ELSE\n' ||
    E'    UPDATE public.invoice_counters SET last_number = last_number + 1, updated_at = NOW()\n');
  v_new := replace(v_new, a4,
    E'      RAISE EXCEPTION ''Emisor: el counter genero folio % ya asignado a otra orden (drift).'', v_folio USING ERRCODE=''22023'';\n' ||
    E'    END IF;\n' ||
    E'    END IF;  -- v10.84.7: fin de acuñar (vs ligar)\n' ||
    E'  ELSE\n' ||
    E'    v_folio := UPPER(TRIM(COALESCE(p_folio, '''')));\n');
  v_new := replace(v_new, a5,
    E'  RETURNING id INTO v_new_id;\n\n' ||
    E'  -- v10.84.7 — la factura existente recibe su orden. El puente ya la saltó (skip_duplicate);\n' ||
    E'  -- si otra operación la ligó en paralelo, el UPDATE cuadra 0 filas y se aborta (espejo de\n' ||
    E'  -- assign_invoice_splits / link_invoice_to_order F2).\n' ||
    E'  IF v_link THEN\n' ||
    E'    UPDATE cobranza.invoices SET source_order_id = v_order_id\n' ||
    E'     WHERE id = v_ex_id AND source_order_id IS NULL AND status <> ''cancelada'';\n' ||
    E'    GET DIAGNOSTICS v_cnt = ROW_COUNT;\n' ||
    E'    IF v_cnt <> 1 THEN\n' ||
    E'      RAISE EXCEPTION ''La factura % fue ligada por otra operacion en paralelo: reintenta.'', v_folio USING ERRCODE=''40001'';\n' ||
    E'    END IF;\n' ||
    E'    INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)\n' ||
    E'    VALUES (''siguiente_parte_liga_factura_existente'', ''invoice'', v_ex_id,\n' ||
    E'      jsonb_build_object(''order_id'', v_order_id, ''production_number'', v_order.production_number,\n' ||
    E'        ''split_id'', v_new_id, ''folio'', v_folio, ''amount'', v_amount, ''qty'', p_qty,\n' ||
    E'        ''invoice_amount'', v_ex_amount, ''notes'', p_notes), p_actor);\n' ||
    E'  END IF;\n\n' ||
    E'  IF v_cerrado THEN\n');
  v_new := replace(v_new, a6, '''cerrado'', v_cerrado, ''pre_assigned'', v_pre, ''linked'', v_link, ''notes'', p_notes), p_actor);');
  v_new := replace(v_new, a7, '''cerrado'', v_cerrado, ''linked'', v_link, ''order_id'', v_order_id);');

  -- la firma cambia: la vieja se va (regla 4)
  DROP FUNCTION public.facturar_siguiente_parte(uuid, numeric, integer, text, text, text, text);
  EXECUTE v_new;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'facturar_siguiente_parte';
  IF v_n <> 1 THEN RAISE EXCEPTION 'facturar_siguiente_parte tiene % firmas', v_n; END IF;
END $do$;

REVOKE ALL ON FUNCTION public.facturar_siguiente_parte(uuid, numeric, integer, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.facturar_siguiente_parte(uuid, numeric, integer, text, text, text, text, boolean) TO authenticated, service_role;

DO $chk$
BEGIN
  IF has_function_privilege('anon', 'public.facturar_siguiente_parte(uuid, numeric, integer, text, text, text, text, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon puede ejecutar facturar_siguiente_parte';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.facturar_siguiente_parte(uuid, numeric, integer, text, text, text, text, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated perdió EXECUTE sobre facturar_siguiente_parte';
  END IF;
END $chk$;
