-- v10.84.90 — EL CANDADO DEL ANTICIPO TAMBIÉN EN «DIVIDIR» (la otra puerta de la OC). assign_folio_to_oc lo tiene desde F-111/F-115
-- (v3.7.931) y el plan matriz desde v10.84.89; assign_folios_split_oc («Asignar folio» → «Dividir»: grupos de órdenes enteras, un folio
-- por grupo) no: un documento NUEVO por justo el importe de una factura hecha sin orden del mismo cliente se acuñaba encima (dos CFDI
-- por el mismo trabajo). Revisión de CobranzaFlow del 13-oct: «es el mismo tema en otra puerta; aparte, justo después, con su ensayo».
-- Mismo predicado que list_linkable_invoices_for_oc y el plan (sin_orden, sin source_order_id, viva, ±$0.02 del importe del grupo,
-- del cliente del grupo o del que lo absorbió). Sólo con el emisor activo, como los otros dos.
DO $mig$
DECLARE v_def text; v_pares text[][]; i int; v_a text; v_b text;
BEGIN
  v_def := pg_get_functiondef('public.assign_folios_split_oc(text,jsonb,boolean,text,text)'::regprocedure);
  IF md5(v_def) <> 'd4d964da7c6c80723f2bee2a5be6ebca' THEN RAISE EXCEPTION 'assign_folios_split_oc cambió (md5 %)', md5(v_def); END IF;
  v_pares := ARRAY[
    ARRAY[$a$  v_corona_balance_per_group NUMERIC := 0;$a$,
          $a$  v_corona_balance_per_group NUMERIC := 0;
  v_emitter boolean := false; v_hit_doc text; v_hit_amount numeric;   -- v10.84.90: el candado del anticipo$a$],
    ARRAY[$a$  p_groups := public.emit_group_folios(p_groups); -- F1 emisor: si el flag esta ON, genera los folios$a$,
          $a$  p_groups := public.emit_group_folios(p_groups); -- F1 emisor: si el flag esta ON, genera los folios
  SELECT COALESCE((value->>'v')::boolean, false) INTO v_emitter FROM cobranza.app_config WHERE key = 'folio_emitter_enabled';
  v_emitter := COALESCE(v_emitter, false);$a$],
    ARRAY[$a$    v_invoice_amount_cents := ROUND(v_invoice_amount * 100)::BIGINT;$a$,
          $a$    v_invoice_amount_cents := ROUND(v_invoice_amount * 100)::BIGINT;
    -- v10.84.90 — EL CANDADO DEL ANTICIPO (el de assign_folio_to_oc y el del plan matriz): un documento NUEVO por justo el importe de
    -- una factura sin orden del cliente del grupo se frena y se dice cómo ligarla (aquí no se puede: los grupos son órdenes enteras).
    IF v_emitter THEN
      SELECT i.doc_number, i.amount INTO v_hit_doc, v_hit_amount
        FROM cobranza.invoices i
       WHERE i.client_id = ANY(ARRAY[v_group_client_id, COALESCE((SELECT merged_into FROM cobranza.clients WHERE id = v_group_client_id), v_group_client_id)])
         AND i.doc_type = v_doc_type AND i.source = 'sin_orden' AND i.source_order_id IS NULL AND i.status <> 'cancelada'
         AND ABS(i.amount - v_invoice_amount) <= 0.02
       ORDER BY i.issued_date, i.doc_number LIMIT 1;
      IF v_hit_doc IS NOT NULL THEN
        RAISE EXCEPTION 'Grupo %: este cliente ya tiene % hecha sin orden, por $%, que es justo el importe de este documento. Si es esa, no emitas otra: lígala (la OC entera, con «Asignar folio» → «Simple»; por pedazos, en el plan matriz con «Ya tiene factura: ligarla»), o se le cobraría dos veces el mismo trabajo.',
          v_idx+1, v_hit_doc, v_hit_amount USING ERRCODE = '22023';
      END IF;
    END IF;$a$]];
  FOR i IN 1 .. array_length(v_pares, 1) LOOP
    v_a := v_pares[i][1]; v_b := v_pares[i][2];
    IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla % de dividir', i; END IF;
    v_def := replace(v_def, v_a, v_b);
  END LOOP;
  EXECUTE v_def;
END $mig$;
