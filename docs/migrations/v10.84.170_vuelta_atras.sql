-- v10.84.170, VUELTA ATRÁS de las dos partes (170a y 170b). PRIMERO la pantalla (git revert de su commit y subir: la de v10.84.170 llama a
-- vender_de_inventario_aunque_haya en «No es de esta venta»), y luego esto, en el editor SQL dentro de begin … commit:
--   1. bulk_sell_from_stock sin el freno (el mismo parche de 170b, al revés, con las mismas anclas): queda como con v10.84.168. Ensayada: la huella md5
--      regresa a la de antes.
--   2. Fuera public.vender_de_inventario_aunque_haya.
-- Lo que se vendió con «No es de esta venta» se queda (y su renglón en la bitácora): son ventas de verdad.
DO $parche$
DECLARE
  f_venta regprocedure := 'public.bulk_sell_from_stock(jsonb,numeric,uuid,text,text,text,jsonb,date,text,text,text,text)'::regprocedure;
  d text; n int; i int; de text[]; a text[];
  a1 text; r1 text; a2 text; r2 text;
BEGIN
  -- Las anclas son renglones enteros de la función viva (ya con v10.84.168) y los saltos van con E'\n' (CRLF en Windows no las rompe)
  a1 := $a$  v_liga_inv record; v_pay text; v_pagado numeric; v_cnt int; v_vend uuid;$a$;
  r1 := a1 || E'\n' || $a$  v_adel text[]; v_adel_monto numeric; v_adel_id uuid; v_vistas text[];  -- v10.84.170: el freno del folio nuevo$a$;

  a2 := $a$    v_pagado := GREATEST(ROUND(v_liga_inv.amount - COALESCE(v_liga_inv.balance, 0) - COALESCE(v_liga_inv.credited_amount, 0), 2), 0);$a$
        || E'\n' || $a$  END IF;$a$;
  r2 := a2 || E'\n' || array_to_string(ARRAY[
    $a$  -- v10.84.170 — ANTES DE CREAR LA OC: ¿este cliente ya tiene ESTA venta facturada por adelantado? Como assign_invoice (v3.7.465): la del MISMO$a$,
    $a$  --   cliente y tipo, viva, sin orden, sin ligar y por el mismo importe (±2 centavos) frena el folio nuevo, salvo «No es de esta venta» con las que$a$,
    $a$  --   la persona vio (pf.venta_nueva_aunque_haya, sólo de vender_de_inventario_aunque_haya). Una que llegó después de leer sigue frenando.$a$,
    $a$  IF v_liga IS NULL THEN$a$,
    $a$    SELECT array_agg(i.doc_number ORDER BY i.issued_date, i.doc_number), min(i.amount), (array_agg(i.id ORDER BY i.issued_date, i.doc_number))[1]$a$,
    $a$      INTO v_adel, v_adel_monto, v_adel_id$a$,
    $a$      FROM cobranza.invoices i$a$,
    $a$     WHERE i.client_id = v_client.id AND i.doc_type = p_invoice_type$a$,
    $a$       AND i.source = 'sin_orden' AND i.source_order_id IS NULL AND i.status <> 'cancelada'$a$,
    $a$       AND ABS(i.amount - v_invoice_amount) <= 0.02;$a$,
    $a$    IF v_adel IS NOT NULL THEN$a$,
    $a$      v_vistas := string_to_array(NULLIF(btrim(COALESCE(current_setting('pf.venta_nueva_aunque_haya', true), '')), ''), ',');$a$,
    $a$      IF v_vistas IS NULL OR NOT (v_adel <@ v_vistas) THEN$a$,
    $a$        RAISE EXCEPTION '% ya tiene % hecha por adelantado y sin ligar, por $%, el importe de esta venta: véndela ligándola («Vender y ligar») o, si de verdad es otra venta, elige «No es de esta venta» (si no lo ves, actualiza la página). Si no, se le cobraría dos veces.',$a$,
    $a$          v_client.name, array_to_string(v_adel, ' y '), v_adel_monto$a$,
    $a$          USING ERRCODE = 'PFADL', DETAIL = array_to_string(ARRAY(SELECT x FROM unnest(v_adel) x WHERE v_vistas IS NULL OR NOT (x = ANY (v_vistas))), ',');$a$,
    $a$      END IF;$a$,
    $a$      INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)$a$,
    $a$      VALUES ('venta_nueva_con_adelantada', 'invoice', v_adel_id,$a$,
    $a$        jsonb_build_object('adelantadas', to_jsonb(v_adel), 'importe', v_invoice_amount, 'folio_nuevo', p_folio, 'client_id', v_client.id,$a$,
    $a$          'desde', 'venta de inventario: «No es de esta venta» (v10.84.170)'), p_actor);$a$,
    $a$    END IF;$a$,
    $a$  END IF;$a$
  ], E'\n');

  d := pg_get_functiondef(f_venta);
  IF position('v10.84.170' in d) = 0 THEN
    RAISE EXCEPTION 'bulk_sell_from_stock no tiene v10.84.170: no hay nada que quitar';
  END IF;
  de := ARRAY[r1, r2];
  a := ARRAY[a1, a2];
  FOR i IN 1..array_length(de, 1) LOOP
    n := (length(d) - length(replace(d, de[i], ''))) / length(de[i]);
    IF n <> 1 THEN RAISE EXCEPTION 'bulk_sell_from_stock: el ancla % aparece % veces (debe 1); no se cambió nada', i, n; END IF;
    d := replace(d, de[i], a[i]);
  END LOOP;
  EXECUTE d;
END $parche$;

-- @@ corte
DROP FUNCTION IF EXISTS public.vender_de_inventario_aunque_haya(text[],jsonb,numeric,uuid,text,text,text,jsonb,date,text,text,text,text);
