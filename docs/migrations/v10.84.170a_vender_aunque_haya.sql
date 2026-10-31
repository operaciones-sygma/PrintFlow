-- v10.84.170a — «NO ES DE ESTA VENTA» CON NOMBRE: la función que la pantalla de v10.84.170 llama cuando Karla dice que la factura hecha por adelantado
-- del mismo importe NO es de esta venta (Marcelo, 31-oct-2026, a «¿lo aplico en la base cuando pase su ensayo y sus pruebas?»: «Sí, aplícalo tú»).
-- Va ANTES de la pantalla: sin el freno de v10.84.170b se porta igual que la venta de siempre (pone un GUC que nadie lee todavía). El freno va DESPUÉS
-- de la pantalla, para que ninguna se quede sin poder vender.
--   public.vender_de_inventario_aunque_haya (nueva): la venta de siempre (bulk_sell_from_stock, con sus pagos) con folio NUEVO aunque el cliente tenga
--   una factura hecha por adelantado del mismo tipo e importe sin ligar. La persona dice cuáles vio (p_vistas): el freno sólo deja pasar si todas las
--   que frenan están entre ellas (una que llegó después de leer sigue frenando), y deja la venta en la bitácora. pf.venta_nueva_aunque_haya dura lo
--   que la transacción y desde el navegador no se puede poner. Dirección y Karla, como el carrito.
-- Vuelta atrás: v10.84.170_vuelta_atras.sql (el freno primero, luego esta función; y la pantalla ANTES que la base).
CREATE OR REPLACE FUNCTION public.vender_de_inventario_aunque_haya(p_vistas text[], p_items jsonb, p_total_amount numeric, p_client_id uuid,
  p_invoice_type text, p_folio text, p_payment_status text DEFAULT 'unpaid', p_payment_refs jsonb DEFAULT NULL, p_due_date date DEFAULT NULL,
  p_agent text DEFAULT NULL, p_notes text DEFAULT NULL, p_actor text DEFAULT NULL, p_client_agent text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
-- v10.84.170 — «No es de esta venta»: la venta con folio nuevo aunque el cliente tenga una hecha por adelantado del mismo importe sin ligar, nombrando
--   las que la persona vio. Las demás reglas del carrito, las de siempre (bulk_sell_from_stock).
DECLARE
  v_res jsonb; v_vistas text;
BEGIN
  PERFORM public.verify_actor_role(p_actor, ARRAY['admin','karla']);
  v_vistas := array_to_string(ARRAY(SELECT DISTINCT upper(btrim(x)) FROM unnest(COALESCE(p_vistas, '{}'::text[])) x
                                     WHERE btrim(COALESCE(x, '')) <> '' ORDER BY 1), ',');
  IF COALESCE(v_vistas, '') = '' THEN
    RAISE EXCEPTION '«No es de esta venta» necesita las facturas hechas por adelantado que viste: vuelve a abrir el carrito.' USING ERRCODE='22023';
  END IF;
  PERFORM set_config('pf.venta_nueva_aunque_haya', v_vistas, true);
  v_res := public.bulk_sell_from_stock(p_items, p_total_amount, p_client_id, p_invoice_type, p_folio, p_payment_status, p_payment_refs,
                                       p_due_date, p_agent, p_notes, p_actor, p_client_agent);
  PERFORM set_config('pf.venta_nueva_aunque_haya', '', true);
  RETURN v_res;
END
$function$;
-- @@ corte
REVOKE ALL ON FUNCTION public.vender_de_inventario_aunque_haya(text[],jsonb,numeric,uuid,text,text,text,jsonb,date,text,text,text,text) FROM PUBLIC, anon;
-- @@ corte
GRANT EXECUTE ON FUNCTION public.vender_de_inventario_aunque_haya(text[],jsonb,numeric,uuid,text,text,text,jsonb,date,text,text,text,text) TO authenticated, service_role;
