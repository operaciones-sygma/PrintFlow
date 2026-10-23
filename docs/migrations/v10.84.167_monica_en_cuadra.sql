-- v10.84.167 — MÓNICA CUADRA BECERRA EN EL APARTADO DE CUADRA (Marcelo, 22-oct-2026: «si da de alta a Mónica, que esté en el grupo de Cuadra… sigo tu
-- recomendación»: Karla le vende desde el carrito, como a Manufacturera, Tiendas y Fábrica de Alta Calidad).
-- Desde el corte del 1-sep, Lupita le capturaba órdenes NORMALES con productos del mismo inventario (hilos, etiqueta colgante, etiqueta negra, china
-- impreso, paquetes de papel kraft; 7 órdenes, P-0415 a P-0672), todo en una orden y con un solo precio: no descontaban existencias y no se sabía cuánto
-- era de cada producto. Sus CFDI usan los mismos precios de lista y los mismos nombres que Manufacturera, así que el carrito le sirve tal cual. Su
-- «ETIQUETA CUADRA NUEVO DISE 017» no está en el catálogo (si es de inventario, se da de alta; si se imprime para ella, sigue como orden normal).
-- Con billing_mode='stock' sus órdenes normales siguen igual (PrintFlow sólo agrega la opción «cargar a stock»); CobranzaFlow sólo distingue 'anticipo'.
-- Ensayada con rollback: 1 cliente; list_stock_clients (como Karla) ofrece las cuatro. Lo de antes queda en cobranza.audit_log («v10.84.167_monica_en_cuadra»).
-- Vuelta atrás: v10.84.167_monica_en_cuadra_vuelta_atras.sql.
DO $monica$
DECLARE n int;
BEGIN
  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  SELECT 'v10.84.167_monica_en_cuadra', 'client', c.id, jsonb_build_object(
    'nota', 'Mónica Cuadra Becerra al apartado de Cuadra: Karla le vende desde el carrito de PrintFlow.',
    'antes', jsonb_build_object('billing_mode', c.billing_mode, 'stock_pool_id', c.stock_pool_id),
    'despues', jsonb_build_object('billing_mode', 'stock', 'stock_pool_id', 'e13aeed1-fd25-4915-b8f9-9796188f671c')), 'marcelo'
  FROM cobranza.clients c WHERE c.name = 'MONICA CUADRA BECERRA' AND c.billing_mode = 'normal' AND c.stock_pool_id IS NULL;
  UPDATE cobranza.clients SET billing_mode = 'stock', stock_pool_id = 'e13aeed1-fd25-4915-b8f9-9796188f671c'
   WHERE name = 'MONICA CUADRA BECERRA' AND billing_mode = 'normal' AND stock_pool_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Mónica: % cliente(s) cambiados (esperaba 1): no se aplica nada', n; END IF;
END $monica$;
