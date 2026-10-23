-- v10.84.167 — LOS DATOS DE CFDI DE CADA PRODUCTO DE CUADRA (Marcelo, 22-oct-2026: «sigo con tus recomendaciones»; la forma la fijó la sesión de
-- CobranzaFlow, que hará que su siembra del CFDI la lea): client_products.specs.cfdi = {clave_prod_serv, clave_unidad, unidad, piezas_por_unidad},
-- como los timbró Karla en sus 67 renglones de sep-oct (cada producto, siempre la misma clave). Hoy la siembra pone 82121500 · H87 · PIEZA en todo y
-- ella cambia cada renglón a mano. Cargarlos no cambia nada hasta que la siembra los lea; «Precio y nombre» de PrintFlow los conserva (guarda el resto de
-- specs). Sólo donde todavía no hay. Vuelta atrás: v10.84.167_claves_sat_vuelta_atras.sql.
DO $sat$
DECLARE n int; v_total int := 0;
BEGIN
  UPDATE public.client_products SET specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('cfdi', jsonb_build_object('clave_prod_serv', '60121117', 'clave_unidad', 'KGM', 'unidad', 'KILOGRAMOS', 'piezas_por_unidad', 80))
    WHERE id = '4b03be82-63a4-4e16-b418-5c510e1cf8fd' AND NOT (coalesce(specs, '{}'::jsonb) ? 'cfdi');   -- China blanco (relleno): en kilos (80 hojas)
  GET DIAGNOSTICS n = ROW_COUNT; v_total := v_total + n;
  UPDATE public.client_products SET specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('cfdi', jsonb_build_object('clave_prod_serv', '60121117', 'clave_unidad', 'T3', 'unidad', 'MILLAR', 'piezas_por_unidad', 1000))
    WHERE id = 'cb65f0a1-0364-4705-b449-4286af51139e' AND NOT (coalesce(specs, '{}'::jsonb) ? 'cfdi');   -- China impreso: en millares
  GET DIAGNOSTICS n = ROW_COUNT; v_total := v_total + n;
  UPDATE public.client_products SET specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('cfdi', jsonb_build_object('clave_prod_serv', '55121505', 'clave_unidad', 'H87', 'unidad', 'PIEZA', 'piezas_por_unidad', 1))
    WHERE id = '572e3937-07d0-49fc-aeb1-9985b20d1043' AND NOT (coalesce(specs, '{}'::jsonb) ? 'cfdi');   -- Cordón para Etiqueta
  GET DIAGNOSTICS n = ROW_COUNT; v_total := v_total + n;
  UPDATE public.client_products SET specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('cfdi', jsonb_build_object('clave_prod_serv', '55121600', 'clave_unidad', 'H87', 'unidad', 'PIEZA', 'piezas_por_unidad', 1))
    WHERE id IN ('ceeab980-d8b4-4902-b001-7a28614c572b', '8f2e31d4-42a9-47f6-b28c-e59547acaf3d', '55481cbf-9b45-4698-86c4-a060cd852aa6')
      AND NOT (coalesce(specs, '{}'::jsonb) ? 'cfdi');   -- Etiqueta colgante, Etiqueta negra colgante interna, Tarjeta de billetera
  GET DIAGNOSTICS n = ROW_COUNT; v_total := v_total + n;
  UPDATE public.client_products SET specs = coalesce(specs, '{}'::jsonb) || jsonb_build_object('cfdi', jsonb_build_object('clave_prod_serv', '24141508', 'clave_unidad', 'H87', 'unidad', 'PIEZA', 'piezas_por_unidad', 1))
    WHERE id IN ('388c7baa-21b7-4038-96e9-da3d54f545f2', 'da1d9dac-bf27-48ca-bc00-daec72446ba7', '579e1d5a-410c-46a0-a041-554059739ff0')
      AND NOT (coalesce(specs, '{}'::jsonb) ? 'cfdi');   -- Soporte 3-25, CH-25 y No 2
  GET DIAGNOSTICS n = ROW_COUNT; v_total := v_total + n;
  IF v_total <> 9 THEN RAISE EXCEPTION 'esperaba 9 productos y salen %: no se aplica nada', v_total; END IF;
END $sat$;
