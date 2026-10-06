-- v10.84.39 (5-oct-2026) — Tres RPC de PrintFlow dejan de escribir para el rol de sólo lectura y de creerle el autor a la
-- pantalla. Lo encontró el recorrido de toda la app (v10.84.36): register_print, log_wakeup_ack y save_app_config sólo
-- pedían ser «personal interno», así que el rol `visor` (Dulce, de sólo lectura desde v10.77) podía registrar impresiones,
-- firmar el «Buenos días» y cambiar los precios de los químicos; german y secretaria también cambiaban precios aunque la
-- pantalla sólo le enseña «Editar Precios» a admin; y quien imprimía o guardaba firmaba con el nombre que mandara.
-- Medido antes de cambiar (tests/romper/permisos.mjs, vuelta 1): 9 de 13 casos fallaban.
--
-- · register_print y log_wakeup_ack: además, public.pf_puede_escribir() (los 7 roles que escriben; visor no).
--   La hoja se imprime igual: la ventana de impresión no espera el registro (avisa que no se registró).
-- · save_app_config: sólo admin, como la pantalla. COALESCE: un rol NULL no abre.
-- · El autor sale de la SESIÓN (public.pf_uid_username()): printed_by / last_printed_by, updated_by y details.user del
--   «Buenos días». Medido: en 60 días printed_by siempre fue el username de quien imprimía, así que no cambia nada de lo que
--   se registra; sólo deja de poder falsearse. Los parámetros p_user / p_by_user se quedan en la firma (cambiarla crearía
--   otra función, abierta) y ya no se usan.
-- Sólo PrintFlow las llama (grep en las apps del 5-oct; sygma-web trae los tipos generados y ya no se usa).

CREATE OR REPLACE FUNCTION public.register_print(p_order_id text, p_user text, p_expected_hash text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_new_version int;
  v_now timestamptz := NOW();
  v_content_hash text;
  v_content_str text;
  v_last_hash text;
  v_is_reprint boolean := false;
  v_user text;
BEGIN
  IF NOT cobranza.is_internal_employee() THEN
    RAISE EXCEPTION 'Acceso restringido a personal interno' USING ERRCODE='42501'; END IF;
  -- v10.84.39 — el rol visor es de sólo lectura: la hoja sale, pero no sube la versión ni firma.
  IF NOT public.pf_puede_escribir() THEN
    RAISE EXCEPTION 'Tu usuario es de sólo lectura: la hoja se imprime, pero no queda registrada' USING ERRCODE='42501'; END IF;
  -- v10.84.39 — quién imprimió sale de la sesión, no del parámetro (p_user ya no se usa).
  v_user := public.pf_uid_username();
  IF v_user IS NULL OR TRIM(v_user) = '' THEN
    RAISE EXCEPTION 'Usuario requerido';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden % no encontrada', p_order_id;
  END IF;

  v_content_str := COALESCE(v_order.quantity::text,'') || '|' ||
    COALESCE(v_order.product,'') || '|' || COALESCE(v_order.product_type,'') || '|' ||
    COALESCE(v_order.standard_size,'') || '|' || COALESCE(v_order.width_cm::text,'') || '|' ||
    COALESCE(v_order.height_cm::text,'') || '|' || COALESCE(v_order.paper_type,'') || '|' ||
    COALESCE(v_order.paper_grammage::text,'') || '|' || COALESCE(v_order.ink_front,'') || '|' ||
    COALESCE(v_order.ink_back,'') || '|' || COALESCE(v_order.colors,'') || '|' ||
    COALESCE(array_to_string(v_order.pantone_front, ','),'') || '|' ||
    COALESCE(array_to_string(v_order.pantone_back, ','),'') || '|' ||
    COALESCE(v_order.finishes,'') || '|' || COALESCE(v_order.notes,'') || '|' ||
    COALESCE(v_order.due_date::text,'') || '|' || COALESCE(v_order.priority,'') || '|' ||
    COALESCE(v_order.image_url,'') || '|' || COALESCE(v_order.image_url_2,'') || '|' ||
    COALESCE(v_order.maq_provider,'') || '|' || COALESCE(v_order.maq_cost::text,'') || '|' ||
    COALESCE(v_order.maq_price::text,'') || '|' || COALESCE(v_order.maquila_provider,'') || '|' ||
    COALESCE(v_order.maquila_phone,'') || '|' || COALESCE(v_order.maquila_email,'') || '|' ||
    COALESCE(v_order.price::text,'') || '|' ||
    COALESCE(v_order.sin_empaque_sygma::text,'false') || '|' ||
    COALESCE(v_order.distribution::text,'') || '|' ||
    COALESCE(v_order.client,'') || '|' ||
    COALESCE(v_order.client_company,'') || '|' ||
    COALESCE(v_order.order_type,'');
  v_content_hash := UPPER(SUBSTRING(MD5(v_content_str) FOR 8));

  -- v10.58.61: la hoja se generó con un hash (peek). Si el contenido vivo ya no
  -- coincide, la hoja en mano quedó desactualizada → NO registrar, avisar.
  IF p_expected_hash IS NOT NULL AND p_expected_hash <> v_content_hash THEN
    RETURN jsonb_build_object('stale', true, 'order_id', p_order_id,
      'live_hash', v_content_hash, 'expected_hash', p_expected_hash);
  END IF;

  IF COALESCE(v_order.print_version,0) > 0 THEN
    SELECT content_hash INTO v_last_hash FROM public.print_audit
      WHERE order_id = p_order_id AND version = v_order.print_version
      ORDER BY printed_at DESC LIMIT 1;
  END IF;

  IF COALESCE(v_order.print_version,0) > 0 AND v_last_hash = v_content_hash THEN
    v_new_version := v_order.print_version;
    v_is_reprint := true;
    UPDATE public.orders SET
      last_printed_at = v_now, last_printed_by = v_user, needs_reprint = false
    WHERE id = p_order_id;
  ELSE
    v_new_version := COALESCE(v_order.print_version, 0) + 1;
    INSERT INTO public.print_audit (
      order_id, version, printed_at, printed_by, content_hash,
      invoice_folio, invoice_type, stage, notes_snapshot
    ) VALUES (
      p_order_id, v_new_version, v_now, v_user, v_content_hash,
      v_order.invoice_folio, v_order.invoice_type, v_order.stage,
      LEFT(COALESCE(v_order.notes,''), 200)
    );
    UPDATE public.orders SET
      print_version = v_new_version, last_printed_at = v_now,
      last_printed_by = v_user, needs_reprint = false
    WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', p_order_id, 'version', v_new_version, 'stale', false,
    'printed_at', v_now, 'printed_by', v_user,
    'content_hash', v_content_hash, 'is_reprint', v_is_reprint
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_wakeup_ack(p_user text, p_items_count integer, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $function$
DECLARE v_user text;
BEGIN
  IF NOT cobranza.is_internal_employee() THEN
    RAISE EXCEPTION 'Acceso restringido a personal interno' USING ERRCODE='42501'; END IF;
  -- v10.84.39 — el rol visor es de sólo lectura: no firma. La pantalla lo llama sin esperar respuesta y cierra igual.
  IF NOT public.pf_puede_escribir() THEN
    RAISE EXCEPTION 'Tu usuario es de sólo lectura' USING ERRCODE='42501'; END IF;
  -- v10.84.39 — quién firmó sale de la sesión (el disparador de audit_log ya sellaba by_username; details.user no).
  v_user := public.pf_uid_username();
  IF v_user IS NULL OR TRIM(v_user) = '' THEN RETURN; END IF;
  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('wakeup_acknowledged', 'user', NULL,
    jsonb_build_object('user', v_user, 'items_count', COALESCE(p_items_count, 0),
      -- lista compacta (folio · porqué) — tope 30 para no inflar el log
      'items', COALESCE((SELECT jsonb_agg(x) FROM (SELECT jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) x LIMIT 30) t), '[]'::jsonb)),
    v_user);
END $function$;

CREATE OR REPLACE FUNCTION public.save_app_config(p_key text, p_value jsonb, p_by_user text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $function$
BEGIN
  IF NOT cobranza.is_internal_employee() THEN
    RAISE EXCEPTION 'Acceso restringido a personal interno' USING ERRCODE='42501';
  END IF;
  -- v10.84.39 — sólo admin, como la pantalla («Editar Precios» sólo se le enseña a admin). COALESCE: un rol NULL no abre.
  IF COALESCE(public.pf_uid_role(), '') <> 'admin' THEN
    RAISE EXCEPTION 'Sólo un administrador cambia esta configuración' USING ERRCODE='42501';
  END IF;
  IF p_key NOT IN ('chemical_prices') THEN
    RAISE EXCEPTION 'Key % no es escribible desde frontend', p_key USING ERRCODE='42501';
  END IF;
  -- v10.84.39 — updated_by sale de la sesión (p_by_user ya no se usa).
  INSERT INTO public.app_config (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, NOW(), public.pf_uid_username())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by;
END $function$;
