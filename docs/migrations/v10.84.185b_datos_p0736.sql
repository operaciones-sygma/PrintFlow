-- v10.84.185b (datos) — P-0736 DE 20 A 40 PIEZAS, COMO DICE F-268 (Marcelo, 5-nov-2026: «si arregla lo que falta porfavor»).
-- Rio Grande, de Genaro. F-267 decía 20 piezas y se rehízo como F-268: 40 piezas a $150, $6,000 + IVA. A las 18:29-18:30 Karla liberó el folio, subió el precio
-- de la orden a $6,000 («PORQUE CAMBIARON LAS PIEZAS») y le ligó F-268, pero la cantidad se quedó en 20: la hoja de producción habría salido con la mitad.
--
-- Lo mismo que hace la pantalla al guardar (src/App.jsx, ~22916): la orden con quién y cuándo, y su renglón en la línea de tiempo. Firmado como Marcelo (admin), con
-- su sesión y sus permisos, para pasar por los mismos candados. Aplicado el 5-nov a las 19:14:08 por la API de administración, en un solo bloque: si la orden ya no
-- estaba como se midió, o algo no quedaba como en el ensayo, se deshacía todo.
--
-- Lo que hicieron los disparadores: has_post_invoice_edits = true («Editada tras facturar»: una etiqueta en PrintFlow, no le deja tarea a nadie), order_change_log (quantity 20 → 40, admin) y
-- needs_reprint sigue en true. sync_post_invoice_edit no movió dinero: con el mismo precio no abre discrepancia ni toca la factura. F-268, su CFDI y sus renglones
-- quedaron idénticos por huella (md5). La siguiente hoja sale como versión 2 (peek_print_version).
--
-- SIN AVISO EN LA CAMPANA, a propósito: de 19:00 a 9:00 y en fin de semana, skip_silent_window_notifications descarta en silencio todo INSERT en notifications.
-- Marcelo les avisa a Gerardo y a Karla; en PrintFlow la orden ya dice «REIMPRIMIR».
--
-- NO se tocó F-268: dice «11X08 CM» y la orden y F-267 dicen 11×28. Corregirla obliga a rehacerla y a otra cancelación ante el SAT.

DO $do$
DECLARE filas int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '80fa4231-bff6-4e14-9943-6cc5a418c481', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.orders SET quantity = 40, last_edited_by = 'admin', last_edited_by_uid = '80fa4231-bff6-4e14-9943-6cc5a418c481', last_edited_at = now()
   WHERE id = 'OP-MW2GF6P7G40' AND quantity = 20 AND price = 6000 AND invoice_folio = 'F-268' AND stage = 'ready' AND delivered_at IS NULL AND cancelled_at IS NULL;
  GET DIAGNOSTICS filas = ROW_COUNT; IF filas <> 1 THEN RAISE EXCEPTION 'P-0736 ya no está como se midió: no se cambió nada'; END IF;
  INSERT INTO public.order_timeline (order_id, action, by_user, color, by_uid)
  VALUES ('OP-MW2GF6P7G40', '⚠️ Editada después de facturar · Cantidad: 20 → 40, como dice F-268', 'admin', '#ff9500', '80fa4231-bff6-4e14-9943-6cc5a418c481');
  RESET ROLE;
END $do$;

-- VUELTA ATRÁS (ensayada con reversa el 5-nov a las 19:16: la cantidad regresa a 20; F-268 y las discrepancias no cambian; la etiqueta «Editada tras facturar» se queda).
-- Sólo tiene sentido si las 20 piezas eran las correctas, y entonces lo que estaría mal es F-268.
--
-- DO $do$
-- DECLARE filas int;
-- BEGIN
--   PERFORM set_config('request.jwt.claims', json_build_object('sub', '80fa4231-bff6-4e14-9943-6cc5a418c481', 'role', 'authenticated')::text, true);
--   SET LOCAL ROLE authenticated;
--   UPDATE public.orders SET quantity = 20, last_edited_by = 'admin', last_edited_by_uid = '80fa4231-bff6-4e14-9943-6cc5a418c481', last_edited_at = now()
--    WHERE id = 'OP-MW2GF6P7G40' AND quantity = 40 AND invoice_folio = 'F-268' AND delivered_at IS NULL AND cancelled_at IS NULL;
--   GET DIAGNOSTICS filas = ROW_COUNT; IF filas <> 1 THEN RAISE EXCEPTION 'P-0736 no está en 40: no se cambió nada'; END IF;
--   INSERT INTO public.order_timeline (order_id, action, by_user, color, by_uid)
--   VALUES ('OP-MW2GF6P7G40', '⚠️ Editada después de facturar · Cantidad: 40 → 20 (se regresó)', 'admin', '#ff9500', '80fa4231-bff6-4e14-9943-6cc5a418c481');
--   RESET ROLE;
-- END $do$;
