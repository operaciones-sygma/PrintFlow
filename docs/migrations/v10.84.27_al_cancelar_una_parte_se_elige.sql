-- v3.7.900 (CobranzaFlow) · v10.84.27 (PrintFlow) — AL CANCELAR UNA PARTE DE UN TRABAJO PARTIDO, SE ELIGE QUÉ PASA
-- CON SU DINERO (29-sep).
-- La pregunta `cancelar-una-parte-de-un-split-clasico` (scan 5): las dos puertas hacían cosas distintas. CobranzaFlow
-- (trigger split_sigue_a_su_cfdi, v10.84.6) SIEMPRE reabría el pedazo como «por facturar»; PrintFlow
-- (cancel_invoice_split_internal, v10.84.1) sólo si la orden había tenido resto alguna vez, y si no, lo perdía sin avisar
-- (su botón ni aparecía). Marcelo: «que sea flexible… que se puedan ambas opciones con una UI simple», y sin opción
-- marcada de entrada: sin elegir no se cancela.
--
--   1. public.order_invoice_splits.al_cancelar ('reabrir' | 'perder') y al_cancelar_por: la decisión se guarda EN LA
--      PARTE al momento del clic. En CobranzaFlow el documento pasa a «cancelada» cuando el SAT acepta, que puede ser días
--      después; el trigger la lee entonces.
--   2. cobranza.parte_de_orden(invoice): si un documento es parte de una orden viva, cuánto y de qué orden (para el modal).
--      cobranza.elegir_al_cancelar_parte(invoice, decisión): la guarda (Dirección, Tesorería, CxC, Contabilidad: los
--      mismos que pueden cancelar en el motor).
--   3. split_sigue_a_su_cfdi: con 'perder' el pedazo no regresa (la orden queda facturada de menos, a propósito, con
--      nombre). Sin decisión (una cancelación hecha por fuera, en el portal del SAT) se queda lo de antes: regresa.
--   4. PrintFlow: cancel_invoice_split(…, p_al_cancelar) EXIGE la decisión para una parte facturada de una orden viva;
--      'reabrir' regresa el pedazo aunque la orden nunca haya tenido resto. La cascada al cancelar la orden entera
--      (sync_cancellation_to_cobranza) no decide nada: pasa sin decisión y conserva lo de antes.
-- La invariante 31 se extiende a toda orden partida (antes sólo las que tuvieron resto: justo el hueco por donde PrintFlow
-- perdía dinero), contando lo perdido por decisión. Medido al escribirla: 8 órdenes con partes, 0 descuadradas.

ALTER TABLE public.order_invoice_splits
  ADD COLUMN IF NOT EXISTS al_cancelar text CHECK (al_cancelar IN ('reabrir', 'perder')),
  ADD COLUMN IF NOT EXISTS al_cancelar_por text;
COMMENT ON COLUMN public.order_invoice_splits.al_cancelar IS
  'v3.7.900: al cancelarse esta parte, su dinero vuelve a quedar por facturar (reabrir) o se da por perdido (perder). Lo elige quien cancela; NULL = no se eligió (cancelación por fuera o la cascada de la orden).';

CREATE OR REPLACE FUNCTION cobranza.parte_de_orden(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'cobranza', 'public', 'pg_temp'
AS $fn$
-- v3.7.900: ¿este documento es una parte de una orden viva? Lo que el modal de cancelar necesita para preguntar.
DECLARE v_inv record; v_split record; v_order record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cobranza.users WHERE id = auth.uid() AND active) THEN
    RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501';
  END IF;
  SELECT id, doc_number, doc_type, source_order_id INTO v_inv FROM cobranza.invoices WHERE id = p_invoice_id;
  IF v_inv.id IS NULL OR v_inv.source_order_id IS NULL THEN RETURN jsonb_build_object('es_parte', false); END IF;
  SELECT * INTO v_split FROM public.order_invoice_splits
   WHERE order_id = v_inv.source_order_id AND invoice_folio = v_inv.doc_number AND doc_type = v_inv.doc_type AND cancelled_at IS NULL
   LIMIT 1;
  IF v_split.id IS NULL THEN RETURN jsonb_build_object('es_parte', false); END IF;
  SELECT production_number, CASE WHEN order_type = 'maquila' THEN maq_price ELSE price END AS precio, cancelled_at, stage
    INTO v_order FROM public.orders WHERE id = v_inv.source_order_id;
  IF v_order.cancelled_at IS NOT NULL OR coalesce(v_order.stage, '') LIKE '%cancelled%' THEN
    RETURN jsonb_build_object('es_parte', false, 'nota', 'la orden ya está cancelada');
  END IF;
  RETURN jsonb_build_object('es_parte', true, 'orden', v_order.production_number, 'monto_parte', v_split.amount_portion,
    'piezas_parte', v_split.qty_portion, 'precio_orden', v_order.precio,
    'tiene_resto', EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE order_id = v_inv.source_order_id AND doc_type = 'por_facturar' AND cancelled_at IS NULL),
    'al_cancelar', v_split.al_cancelar);
END $fn$;
REVOKE ALL ON FUNCTION cobranza.parte_de_orden(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cobranza.parte_de_orden(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION cobranza.elegir_al_cancelar_parte(p_invoice_id uuid, p_al_cancelar text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'cobranza', 'public', 'pg_temp'
AS $fn$
-- v3.7.900: guarda en la parte qué pasa con su dinero cuando el documento termine de cancelarse (el trigger
-- split_sigue_a_su_cfdi la lee cuando el SAT acepta). Los mismos roles que pueden cancelar en el motor.
DECLARE v_role text; v_user text; v_inv record; v_split record;
BEGIN
  SELECT role, username INTO v_role, v_user FROM cobranza.users WHERE id = auth.uid() AND active;
  IF coalesce(v_role, '') NOT IN ('direccion', 'tesoreria', 'cxc', 'contabilidad') THEN
    RAISE EXCEPTION 'Sólo Dirección, Tesorería, CxC o Contabilidad cancelan documentos.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p_al_cancelar, '') NOT IN ('reabrir', 'perder') THEN
    RAISE EXCEPTION 'Di qué pasa con ese pedazo: vuelve a quedar por facturar o se da por perdido.' USING ERRCODE = '22023';
  END IF;
  SELECT id, doc_number, doc_type, source_order_id INTO v_inv FROM cobranza.invoices WHERE id = p_invoice_id;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Documento no encontrado' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_split FROM public.order_invoice_splits
   WHERE order_id = v_inv.source_order_id AND invoice_folio = v_inv.doc_number AND doc_type = v_inv.doc_type AND cancelled_at IS NULL
   LIMIT 1 FOR UPDATE;
  IF v_split.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'es_parte', false); END IF;
  UPDATE public.order_invoice_splits SET al_cancelar = p_al_cancelar, al_cancelar_por = v_user WHERE id = v_split.id;
  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_user, by_username, role)
  VALUES ('parte_al_cancelar_elegido', 'order_invoice_split', v_split.id,
          jsonb_build_object('folio', v_inv.doc_number, 'order_id', v_inv.source_order_id, 'al_cancelar', p_al_cancelar,
                             'amount_portion', v_split.amount_portion),
          (SELECT id FROM cobranza.users WHERE id = auth.uid()), v_user, v_role);
  RETURN jsonb_build_object('ok', true, 'es_parte', true, 'al_cancelar', p_al_cancelar);
END $fn$;
REVOKE ALL ON FUNCTION cobranza.elegir_al_cancelar_parte(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cobranza.elegir_al_cancelar_parte(uuid, text) TO authenticated;

DO $mig$
DECLARE v_def text; v_a text; v_b text; v_a2 text; v_b2 text;
BEGIN
  -- 3. el trigger de CobranzaFlow respeta 'perder'
  v_def := pg_get_functiondef('public.split_sigue_a_su_cfdi()'::regprocedure);
  IF md5(v_def) <> '17ed48e160a4e228d761a75d6822f258' THEN RAISE EXCEPTION 'split_sigue_a_su_cfdi cambió (md5 %)', md5(v_def); END IF;
  v_a := $a$  v_regresa := (v_sub.id IS NULL OR v_sub_es_parte)
               AND v_order.cancelled_at IS NULL AND v_order.stage NOT LIKE '%cancelled%';$a$;
  v_b := $a$  v_regresa := (v_sub.id IS NULL OR v_sub_es_parte)
               AND v_order.cancelled_at IS NULL AND v_order.stage NOT LIKE '%cancelled%';
  -- v3.7.900 (Marcelo, 29-sep: «que sea flexible»): quien canceló eligió qué pasa con el pedazo (al_cancelar, guardado al
  -- momento del clic). 'perder' = la orden queda facturada de menos, a propósito y con nombre. Sin elección (una
  -- cancelación hecha por fuera, en el portal del SAT) se queda lo de antes: regresa. Una sustitución no pregunta.
  IF v_regresa AND v_sub.id IS NULL AND v_split.al_cancelar = 'perder' THEN
    v_regresa := false;
    v_motivo := v_motivo || ' · se dio por perdido (lo eligió ' || coalesce(v_split.al_cancelar_por, '?') || ')';
  END IF;$a$;
  v_a2 := $a$'regreso_al_resto', v_regresa), 'sistema_cfdi');$a$;
  v_b2 := $a$'regreso_al_resto', v_regresa, 'al_cancelar', v_split.al_cancelar), 'sistema_cfdi');$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla 1 del trigger'; END IF;
  IF (length(v_def) - length(replace(v_def, v_a2, ''))) / length(v_a2) <> 1 THEN RAISE EXCEPTION 'ancla 2 del trigger'; END IF;
  EXECUTE replace(replace(v_def, v_a, v_b), v_a2, v_b2);

  -- 4. PrintFlow: la interna recibe la decisión (con DEFAULT NULL: la cascada de la orden la sigue llamando con 3)
  v_def := pg_get_functiondef('public.cancel_invoice_split_internal(uuid,text,text)'::regprocedure);
  IF md5(v_def) <> '7d9d9bc5a4cc4bb4f56b329fb76884c7' THEN RAISE EXCEPTION 'cancel_invoice_split_internal cambió (md5 %)', md5(v_def); END IF;
  v_a := $a$public.cancel_invoice_split_internal(p_split_id uuid, p_reason text, p_actor text)$a$;
  v_b := $a$public.cancel_invoice_split_internal(p_split_id uuid, p_reason text, p_actor text, p_al_cancelar text DEFAULT NULL::text)$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla firma'; END IF;
  v_def := replace(v_def, v_a, v_b);
  v_a := $a$  SET cancelled_at = NOW(), cancellation_reason = TRIM(p_reason), cancelled_by = p_actor$a$;
  v_b := $a$  SET cancelled_at = NOW(), cancellation_reason = TRIM(p_reason), cancelled_by = p_actor,
      al_cancelar = p_al_cancelar, al_cancelar_por = CASE WHEN p_al_cancelar IS NOT NULL THEN p_actor END  -- v10.84.27$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla cancelar parte'; END IF;
  v_def := replace(v_def, v_a, v_b);
  v_a := $a$     AND EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE order_id = v_split.order_id AND doc_type = 'por_facturar') THEN$a$;
  v_b := $a$     -- v10.84.27 (Marcelo, 29-sep: «que sea flexible»): quien cancela DICE qué pasa con el pedazo. 'reabrir' lo regresa
     -- aunque la orden nunca haya tenido resto; 'perder' no lo regresa aunque lo tenga. Sin decisión (la cascada al cancelar
     -- la orden, una llamada vieja) se queda lo de antes: regresa sólo si la orden alguna vez tuvo resto.
     -- (el CASE va entre paréntesis: PL/pgSQL lee la condición del IF hasta el primer THEN)
     AND (CASE p_al_cancelar WHEN 'reabrir' THEN true WHEN 'perder' THEN false
               ELSE EXISTS (SELECT 1 FROM public.order_invoice_splits WHERE order_id = v_split.order_id AND doc_type = 'por_facturar') END) THEN$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla regresa al resto'; END IF;
  v_def := replace(v_def, v_a, v_b);
  EXECUTE v_def;   -- crea la firma nueva (4 argumentos)
END $mig$;
DROP FUNCTION public.cancel_invoice_split_internal(uuid, text, text);
REVOKE ALL ON FUNCTION public.cancel_invoice_split_internal(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_invoice_split_internal(uuid, text, text, text) TO service_role;

-- La pública de PrintFlow: exige la decisión para una parte facturada de una orden viva.
DROP FUNCTION public.cancel_invoice_split(uuid, text, text);
CREATE FUNCTION public.cancel_invoice_split(p_split_id uuid, p_reason text, p_actor text, p_al_cancelar text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $fn$
BEGIN
  PERFORM public.verify_actor_role(p_actor, ARRAY['admin']);
  -- v10.84.27 (Marcelo, 29-sep): una parte facturada de una orden viva no se cancela sin decir qué pasa con su dinero.
  IF p_al_cancelar IS NOT NULL AND p_al_cancelar NOT IN ('reabrir', 'perder') THEN
    RAISE EXCEPTION 'al_cancelar va «reabrir» o «perder»' USING ERRCODE = '22023';
  END IF;
  IF p_al_cancelar IS NULL AND EXISTS (
       SELECT 1 FROM public.order_invoice_splits s JOIN public.orders o ON o.id = s.order_id
        WHERE s.id = p_split_id AND s.doc_type IN ('factura', 'remision', 'corona_saldo') AND s.cancelled_at IS NULL
          AND o.cancelled_at IS NULL AND coalesce(o.stage, '') NOT LIKE '%cancelled%') THEN
    RAISE EXCEPTION 'Di qué pasa con ese pedazo: vuelve a quedar por facturar o se da por perdido. (Si ves esto sin que te lo hayan preguntado, recarga la página: F5.)' USING ERRCODE = '22023';
  END IF;
  RETURN public.cancel_invoice_split_internal(p_split_id, p_reason, p_actor, p_al_cancelar);
END $fn$;
REVOKE ALL ON FUNCTION public.cancel_invoice_split(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_invoice_split(uuid, text, text, text) TO authenticated, service_role;
