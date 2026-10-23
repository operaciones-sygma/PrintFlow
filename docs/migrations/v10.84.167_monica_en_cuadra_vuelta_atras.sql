-- v10.84.167 — VUELTA ATRÁS de v10.84.167_monica_en_cuadra.sql: Mónica Cuadra Becerra vuelve a cliente normal, fuera del apartado de Cuadra. (Sus ventas
-- hechas desde el carrito mientras estuvo en el apartado se quedan como están.)
UPDATE cobranza.clients SET billing_mode = 'normal', stock_pool_id = NULL
 WHERE name = 'MONICA CUADRA BECERRA' AND billing_mode = 'stock' AND stock_pool_id = 'e13aeed1-fd25-4915-b8f9-9796188f671c';
