-- v3.7.900c — LO QUE ENCONTRÓ LA VERIFICACIÓN DE v3.7.900 (29-sep). El P1 ya se arregló en v3.7.900b; esto es lo demás.
--   1. split_sigue_a_su_cfdi
--      · Una SUSTITUCIÓN no aplica la elección, y ahora tampoco la deja pegada: la parte que adopta el folio nuevo la
--        borra (seguía viva con 'perder' y una cancelación posterior por el portal del SAT la habría aplicado sin que
--        nadie la viera), y la parte cerrada guarda lo que PASÓ, no lo que se pidió. La invariante 31 cuenta 'perder'
--        como dinero que se fue a propósito: con la elección pegada en una sustitución que sí regresó el dinero al
--        resto, lo contaba dos veces.
--      · La ÚLTIMA parte viva no se da por perdida desde CobranzaFlow: la orden quedaba entregada con 0 partes vivas y
--        orden_ya_facturada() = false (editable, borrable y re-facturable completa: lo contrario de «perder»). PrintFlow,
--        en el mismo caso, cancela la orden. Si la elección se hizo cuando todavía no era la última, regresa y lo dice.
--   2. elegir_al_cancelar_parte rechaza 'perder' sobre la última parte viva, diciendo qué hacer.
--   3. parte_de_orden devuelve es_la_ultima (el modal apaga la opción y dice por qué).
--   4. cancel_invoice_split_internal (PrintFlow v10.84.28): desde la pantalla (con decisión) ya no se cancela una parte
--      ligada a un documento que PrintFlow no creó (Alpha, conciliación, manual). Sólo lo desligaba: el documento seguía
--      vivo y cobrado, «vuelve a quedar por facturar» lo facturaba dos veces y «se da por perdido» afirmaba algo falso.
--      Se cancela el documento en CobranzaFlow; la parte se cierra sola con la misma pregunta. La cascada de la orden
--      entera (sin decisión) sigue desligando como siempre.
--   5. cancelar_cobros_del_puente: la discrepancia de un cobro amarrado decía «La orden P-0003 se canceló en PrintFlow»
--      cuando sólo se canceló una parte y la orden sigue entregada. La interna le pasa ahora un motivo que distingue la
--      parte (la orden sigue viva), la cascada de la orden entera y la última parte dada por perdida (la orden se cancela):
--      el primer ensayo, con un solo motivo para todo, hizo decir «la orden sigue viva» a la cascada que la estaba cancelando.
DO $mig$
DECLARE v_def text; v_pares text[][]; i int; v_a text; v_b text;
BEGIN
  -- 1. el trigger
  v_def := pg_get_functiondef('public.split_sigue_a_su_cfdi()'::regprocedure);
  IF md5(v_def) <> 'ca44f3f60497f7928dec94805826ed75' THEN RAISE EXCEPTION 'split_sigue_a_su_cfdi cambió (md5 %)', md5(v_def); END IF;
  v_pares := ARRAY[
    ARRAY[$a$        v_sub_es_parte boolean := false; v_adopta boolean := false; v_esperado numeric; v_tuvo_resto boolean;$a$,
          $a$        v_sub_es_parte boolean := false; v_adopta boolean := false; v_esperado numeric; v_tuvo_resto boolean;
        v_perdido boolean := false;  -- v3.7.900c: se dio por perdido DE VERDAD (no sólo se pidió)$a$],
    ARRAY[$a$       SET invoice_folio = v_sub.doc_number, doc_type = v_sub.doc_type,$a$,
          $a$       SET invoice_folio = v_sub.doc_number, doc_type = v_sub.doc_type,
           al_cancelar = NULL, al_cancelar_por = NULL,  -- v3.7.900c: la elección era para ESTE documento, no para el que la sustituye$a$],
    ARRAY[$a$  IF v_regresa AND v_sub.id IS NULL AND v_split.al_cancelar = 'perder' THEN
    v_regresa := false;
    v_motivo := v_motivo || ' · se dio por perdido (lo eligió ' || coalesce(v_split.al_cancelar_por, '?') || ')';
  END IF;$a$,
          $a$  IF v_regresa AND v_sub.id IS NULL AND v_split.al_cancelar = 'perder' THEN
    -- v3.7.900c: la ÚLTIMA parte viva no se da por perdida aquí: la orden quedaría entregada, con 0 partes vivas y
    -- orden_ya_facturada() = false (editable, borrable, re-facturable completa). Darla por perdida es cancelar la orden en
    -- PrintFlow. elegir_al_cancelar_parte ya lo rechaza; esto cubre una elección hecha cuando todavía no era la última.
    IF EXISTS (SELECT 1 FROM public.order_invoice_splits
                WHERE order_id = NEW.source_order_id AND cancelled_at IS NULL AND id <> v_split.id) THEN
      v_regresa := false; v_perdido := true;
      v_motivo := v_motivo || ' · se dio por perdido (lo eligió ' || coalesce(v_split.al_cancelar_por, '?') || ')';
    ELSE
      v_motivo := v_motivo || ' · se pidió darlo por perdido, pero era la última parte viva: vuelve a quedar por facturar'
                  || ' (para darlo por perdido, se cancela la orden en PrintFlow)';
    END IF;
  END IF;$a$],
    ARRAY[$a$     SET cancelled_at = NOW(), cancelled_by = 'sistema_cfdi', cancellation_reason = v_motivo
   WHERE id = v_split.id;$a$,
          $a$     SET cancelled_at = NOW(), cancelled_by = 'sistema_cfdi', cancellation_reason = v_motivo,
         -- v3.7.900c: la parte cerrada guarda lo que PASÓ, no lo que se pidió (la invariante 31 cuenta 'perder' como
         -- dinero que se fue a propósito; pegado en una sustitución que sí regresó, lo contaba dos veces)
         al_cancelar = CASE WHEN v_perdido THEN 'perder' WHEN v_regresa AND v_split.al_cancelar = 'reabrir' THEN 'reabrir' END,
         al_cancelar_por = CASE WHEN v_perdido OR (v_regresa AND v_split.al_cancelar = 'reabrir') THEN v_split.al_cancelar_por END
   WHERE id = v_split.id;$a$],
    ARRAY[$a$'regreso_al_resto', v_regresa, 'al_cancelar', v_split.al_cancelar)$a$,
          $a$'regreso_al_resto', v_regresa, 'al_cancelar', v_split.al_cancelar, 'se_dio_por_perdido', v_perdido)$a$]];
  FOR i IN 1 .. array_length(v_pares, 1) LOOP
    v_a := v_pares[i][1]; v_b := v_pares[i][2];
    IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla % del trigger', i; END IF;
    v_def := replace(v_def, v_a, v_b);
  END LOOP;
  EXECUTE v_def;

  -- 2. elegir
  v_def := pg_get_functiondef('cobranza.elegir_al_cancelar_parte(uuid,text)'::regprocedure);
  IF md5(v_def) <> 'f88241c9ec94214e9ca469201077afc6' THEN RAISE EXCEPTION 'elegir_al_cancelar_parte cambió (md5 %)', md5(v_def); END IF;
  v_a := $a$  UPDATE public.order_invoice_splits SET al_cancelar = p_al_cancelar, al_cancelar_por = v_user WHERE id = v_split.id;$a$;
  v_b := $a$  -- v3.7.900c: la última parte viva no se da por perdida desde aquí (la orden quedaría entregada y sin nada facturado)
  IF p_al_cancelar = 'perder' AND NOT EXISTS (SELECT 1 FROM public.order_invoice_splits
                                               WHERE order_id = v_split.order_id AND cancelled_at IS NULL AND id <> v_split.id) THEN
    RAISE EXCEPTION '% es la única parte viva de su orden: darla por perdida la dejaría entregada y sin nada facturado. Si ese trabajo ya no se cobra, cancela la orden en PrintFlow; si no, elige «vuelve a quedar por facturar».',
      v_inv.doc_number USING ERRCODE = '22023';
  END IF;
  UPDATE public.order_invoice_splits SET al_cancelar = p_al_cancelar, al_cancelar_por = v_user WHERE id = v_split.id;$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla de elegir'; END IF;
  EXECUTE replace(v_def, v_a, v_b);

  -- 3. parte_de_orden
  v_def := pg_get_functiondef('cobranza.parte_de_orden(uuid)'::regprocedure);
  IF md5(v_def) <> '57edd8fabb8aa0ae410dfbbcf2ec4006' THEN RAISE EXCEPTION 'parte_de_orden cambió (md5 %)', md5(v_def); END IF;
  v_a := $a$    'al_cancelar', v_split.al_cancelar);$a$;
  v_b := $a$    'al_cancelar', v_split.al_cancelar,
    -- v3.7.900c: la última parte viva no se da por perdida desde CobranzaFlow
    'es_la_ultima', NOT EXISTS (SELECT 1 FROM public.order_invoice_splits
                                 WHERE order_id = v_split.order_id AND cancelled_at IS NULL AND id <> v_split.id));$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla de parte_de_orden'; END IF;
  EXECUTE replace(v_def, v_a, v_b);

  -- 4. la interna de PrintFlow
  v_def := pg_get_functiondef('public.cancel_invoice_split_internal(uuid,text,text,text)'::regprocedure);
  IF md5(v_def) <> '60cf2b956d70629e5b2b61fb02d56639' THEN RAISE EXCEPTION 'cancel_invoice_split_internal cambió (md5 %)', md5(v_def); END IF;
  v_a := $a$        -- v10.75.11 (scan w7yyjrpws P4): esta factura la creó OTRO flujo$a$;
  v_b := $a$        -- v10.84.28 (verificación de v3.7.900): desde la pantalla (con decisión) una parte ligada a un documento que
        -- PrintFlow no creó no se cancela: aquí sólo se desligaría, el documento seguiría vivo y cobrado, «vuelve a quedar
        -- por facturar» lo facturaría dos veces y «se da por perdido» afirmaría algo falso. Se cancela el documento en
        -- CobranzaFlow y la parte se cierra sola, con la misma pregunta. La cascada de la orden entera (sin decisión) sigue
        -- desligando como siempre.
        IF p_al_cancelar IS NOT NULL THEN
          RAISE EXCEPTION 'La parte % está ligada a %, que no creó PrintFlow y sigue «%» en cobranza: cancelarla aquí sólo la desligaría y ese documento se seguiría cobrando. Cancela % en CobranzaFlow (si es de Alpha: «Registrar que Alpha canceló esta factura»); la parte se cierra sola y ahí se elige qué pasa con ese pedazo.',
            v_split.position, v_invoice.doc_number, v_invoice.status, v_invoice.doc_number USING ERRCODE = '22023';
        END IF;
        -- v10.75.11 (scan w7yyjrpws P4): esta factura la creó OTRO flujo$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla de la interna'; END IF;
  v_def := replace(v_def, v_a, v_b);
  -- el motivo que recibe cancelar_cobros_del_puente dice si la orden sigue viva: sin decisión es la cascada de la orden
  -- entera (cancel_invoiced_order, sync_cancellation_to_cobranza); con 'perder' sobre la última viva, la orden se cancela
  -- más abajo (v_all_cancelled). La parte ya se cerró arriba, así que «ninguna viva» = era la última.
  v_a := $a$v_order.production_number, 'Parte cancelada en PrintFlow');$a$;
  v_b := $a$v_order.production_number,
            CASE WHEN p_al_cancelar IS NULL THEN 'Orden cancelada en PrintFlow'   -- v3.7.900c
                 WHEN p_al_cancelar = 'perder' AND NOT EXISTS (SELECT 1 FROM public.order_invoice_splits
                                                                 WHERE order_id = v_split.order_id AND cancelled_at IS NULL)
                   THEN 'Última parte cancelada en PrintFlow: la orden se cancela'
                 ELSE 'Parte cancelada en PrintFlow' END);$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla del motivo de la interna'; END IF;
  EXECUTE replace(v_def, v_a, v_b);

  -- 5. el texto de la discrepancia del cobro amarrado
  v_def := pg_get_functiondef('cobranza.cancelar_cobros_del_puente(uuid,text,text,text,text)'::regprocedure);
  IF md5(v_def) <> 'bb627e01508a8487be5a20f014593ab3' THEN RAISE EXCEPTION 'cancelar_cobros_del_puente cambió (md5 %)', md5(v_def); END IF;
  v_a := $a$        'La orden ' || v_orden || ' se canceló en PrintFlow y su factura ' || p_folio$a$;
  v_b := $a$        -- v3.7.900c: una PARTE cancelada no es la orden cancelada (la orden sigue viva)
        CASE WHEN p_motivo = 'Parte cancelada en PrintFlow'
             THEN 'Se canceló en PrintFlow una parte de la orden ' || v_orden || ' (la orden sigue viva) y su factura ' || p_folio
             ELSE 'La orden ' || v_orden || ' se canceló en PrintFlow y su factura ' || p_folio END$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla del puente'; END IF;
  EXECUTE replace(v_def, v_a, v_b);
END $mig$;
