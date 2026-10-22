-- v10.84.167 — VUELTA ATRÁS de v10.84.167_precio_por_renglon.sql: el mismo parche al revés (las mismas anclas). Regresa bulk_sell_from_stock al
-- reparto por piezas y auto_description a como era. Antes de correrla, regresar PrintFlow a v10.84.166: el carrito de v10.84.167 manda el importe
-- de cada renglón y la función de antes lo ignora (volvería a repartir el total).
DO $vuelta$
DECLARE
  f_venta regprocedure := 'public.bulk_sell_from_stock(jsonb,numeric,uuid,text,text,text,jsonb,date,text,text,text,text)'::regprocedure;
  f_desc regprocedure := 'public.auto_description(public.orders)'::regprocedure;
  d text; n int; i int; de text[]; a text[];
  a1 text; r1 text; a2 text; r2 text; a3 text; r3 text; a4 text; r4 text; a5 text; r5 text; a6 text; r6 text;
BEGIN
  -- Las anclas son renglones enteros de las funciones vivas y los saltos van con E'\n' (no escritos en el archivo): así el parche no depende
  -- de cómo guarde los renglones el editor (CRLF en Windows).
  a1 := $a$  v_subtotal_assigned numeric := 0;$a$;
  r1 := a1 || E'\n' || $a$  v_amount numeric; v_suma_importes numeric := 0; v_iva_renglones numeric := 0;  -- v10.84.167: el importe de cada renglón, su suma y su IVA$a$;
  a2 := $a$    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Item %: qty debe ser > 0', v_idx+1; END IF;$a$;
  r2 := a2 || E'\n' || array_to_string(ARRAY[
    $a$    -- v10.84.167 — el importe del renglón, sin IVA (kilos o piezas × su precio: lo calcula el carrito). Sin él, la pantalla es de antes.$a$,
    $a$    IF NOT (v_item ? 'amount') OR jsonb_typeof(v_item->'amount') = 'null' THEN$a$,
    $a$      RAISE EXCEPTION 'Esta venta viene de una pantalla de antes: actualiza PrintFlow (F5) y captura el precio de cada producto.' USING ERRCODE='22023';$a$,
    $a$    END IF;$a$,
    $a$    BEGIN v_amount := (v_item->>'amount')::numeric;$a$,
    $a$    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Item %: el importe no es un número', v_idx+1 USING ERRCODE='22023';$a$,
    $a$    END;$a$,
    $a$    IF v_amount < 0 THEN RAISE EXCEPTION 'Item %: el importe no puede ser negativo', v_idx+1 USING ERRCODE='22023'; END IF;$a$,
    $a$    IF v_amount <> ROUND(v_amount, 2) THEN RAISE EXCEPTION 'Item %: el importe lleva más de 2 decimales (%)', v_idx+1, v_amount USING ERRCODE='22023'; END IF;$a$,
    $a$    v_suma_importes := v_suma_importes + v_amount;$a$,
    $a$    v_iva_renglones := v_iva_renglones + ROUND(v_amount * 0.16, 2);$a$
  ], E'\n');
  a3 := $a$  IF p_invoice_type = 'factura' THEN v_subtotal := ROUND(p_total_amount / 1.16, 2); v_invoice_amount := p_total_amount;$a$
        || E'\n' || $a$  ELSE v_subtotal := p_total_amount; v_invoice_amount := p_total_amount; END IF;$a$;
  r3 := array_to_string(ARRAY[
    $a$  -- v10.84.167 — el subtotal es la suma de los importes (antes: el total entre 1.16, que luego se repartía por piezas) y el total que llega$a$,
    $a$  --   se revisa contra los renglones: con IVA, el de cada renglón redondeado, como lo suma el CFDI y como lo calcula el carrito.$a$,
    $a$  v_subtotal := v_suma_importes;$a$,
    $a$  IF v_subtotal <= 0 THEN RAISE EXCEPTION 'La venta suma $0: ponle precio a lo que se cobra.' USING ERRCODE='22023'; END IF;$a$,
    $a$  v_invoice_amount := CASE WHEN p_invoice_type = 'factura' THEN v_subtotal + v_iva_renglones ELSE v_subtotal END;$a$,
    $a$  IF p_total_amount <> v_invoice_amount THEN$a$,
    $a$    RAISE EXCEPTION 'El total que llegó ($%) no cuadra con la suma de los productos ($%): vuelve a abrir el carrito.', p_total_amount, v_invoice_amount USING ERRCODE='22023';$a$,
    $a$  END IF;$a$
  ], E'\n');
  a4 := $a$    IF v_idx = v_items_count - 1 THEN v_order_price := ROUND(v_subtotal - v_subtotal_assigned, 2);$a$
        || E'\n' || $a$    ELSE v_order_price := ROUND(v_subtotal * (v_qty::numeric / v_total_qty::numeric), 2); v_subtotal_assigned := v_subtotal_assigned + v_order_price; END IF;$a$;
  r4 := $a$    v_order_price := ROUND((v_item->>'amount')::numeric, 2);  -- v10.84.167: el importe de su renglón (antes: el subtotal repartido por piezas)$a$;
  a5 := $a$'subtotal_sin_iva', v_subtotal, 'payment_status', p_payment_status,$a$;
  r5 := $a$'subtotal_sin_iva', v_subtotal, 'precio_por_renglon', true, 'payment_status', p_payment_status,$a$;
  a6 := $a$  v_human := btrim(coalesce(o.product,''));$a$;
  r6 := array_to_string(ARRAY[
    $a$  -- v10.84.167 — LA VENTA DE INVENTARIO SALE CON EL NOMBRE QUE PIDE EL CLIENTE (Marcelo, 22-oct-2026: «Nosotros lo conocemos como china, pero$a$,
    $a$  --   el cliente a veces lo pide con nombre en la factura»): el de su cliente (client_products.specs.nombre_factura_cliente) o el general$a$,
    $a$  --   (specs.nombre_factura). Sin ninguno, como siempre: el nombre del catálogo (orders.product).$a$,
    $a$  if o.stock_role = 'sale' and o.client_product_id is not null then$a$,
    $a$    select coalesce(nullif(btrim(cp.specs->'nombre_factura_cliente'->>(o.client_id::text)), ''), nullif(btrim(cp.specs->>'nombre_factura'), ''))$a$,
    $a$      into v_human from public.client_products cp where cp.id = o.client_product_id;$a$,
    $a$    if v_human is not null then return v_human; end if;$a$,
    $a$  end if;$a$,
    a6
  ], E'\n');

  -- 1. public.bulk_sell_from_stock
  d := pg_get_functiondef(f_venta);
  IF (position('v10.84.167' in d) > 0) = false THEN
    RAISE EXCEPTION 'bulk_sell_from_stock no tiene v10.84.167: no hay nada que regresar';
  END IF;
  de := ARRAY[r1, r2, r3, r4, r5];
  a := ARRAY[a1, a2, a3, a4, a5];
  FOR i IN 1..array_length(de, 1) LOOP
    n := (length(d) - length(replace(d, de[i], ''))) / length(de[i]);
    IF n <> 1 THEN RAISE EXCEPTION 'bulk_sell_from_stock: el ancla % aparece % veces (debe 1); no se cambió nada', i, n; END IF;
    d := replace(d, de[i], a[i]);
  END LOOP;
  EXECUTE d;

  -- 2. public.auto_description
  d := pg_get_functiondef(f_desc);
  IF (position('v10.84.167' in d) > 0) = false THEN
    RAISE EXCEPTION 'auto_description no tiene v10.84.167: no hay nada que regresar';
  END IF;
  n := (length(d) - length(replace(d, r6, ''))) / length(r6);
  IF n <> 1 THEN RAISE EXCEPTION 'auto_description: el ancla aparece % veces (debe 1); no se cambió nada', n; END IF;
  d := replace(d, r6, a6);
  EXECUTE d;
END $vuelta$;
