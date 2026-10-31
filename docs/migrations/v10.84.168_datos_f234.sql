-- v10.84.168 (datos) — LA VENTA DEL PEDIDO SEMANAL DE MANUFACTURERA DE BOTAS CUADRA LIGADA A F-234. APLICADA el 30-oct-2026 ~18:55, con el OK escrito
-- de Marcelo en la conversación «Factura F234 en cobranzaflow» («Sí, regístrala ya»), por la API de administración, firmada como él (admin), en cuanto
-- quedó la base v10.84.168. Antes de correrla se revisó que nada hubiera cambiado: F-234 sin ligar, ningún traslado ni venta de Cuadra desde el 28-oct
-- y el mismo inventario.
-- F-234 ($91,315.20; subtotal $78,720.00) la hizo Karla en CobranzaFlow el 28-oct por adelantado («El cliente solicita la factura antes de entregar el
-- pedido») y la timbró; sus 5 conceptos son los del pedido de cada semana (F-186, F-217): 7,000 soportes No.3-25 a $3.41, 5,000 soportes CH-25 a $1.85,
-- 10,000 etiquetas colgantes a $2.10, 2,000 tarjetas de billetera a $2.30 y 500 kg de papel kraft para rellenar (40,000 hojas de China blanco) a $40.
-- Quedó: OC-1074 (completa, con F-234, vendedor Pepe Chuy) con sus 5 órdenes de venta de inventario (source 'stock', order_type 'interna', stage
-- 'delivered', sin pagar), el inventario descontado (5 movimientos SOLD), F-234 con el mismo importe, saldo, estado y CFDI y ahora con su OC
-- (source_order_id = 'OC-1074'), ninguna factura nueva y el contador de la serie F sin moverse. En la bitácora de cobranza: skip_invoice_duplicate,
-- link_existing_invoice_to_oc y bulk_sell_from_stock (admin). Invariantes 91 de 91 (la 79: una factura hecha sin orden y ligada a una OC está en esa OC).
-- Revisado en producción, sólo leyendo, como Karla en CobranzaFlow: en Traslados, buscar «F-234» trae OC-1074 y «Traer» los 5 conceptos timbrados.
-- Vuelta atrás (no ensayada; sólo con OK y ensayo antes): quitar la OC de F-234 (source_order_id a NULL), regresar el inventario con un movimiento
-- PRODUCED por cada renglón y cancelar las 5 órdenes y la OC sin tocar F-234 (cancelar desde la pantalla una orden con folio la cae con su factura).
WITH sesion AS MATERIALIZED (
  SELECT set_config('request.jwt.claims', '{"sub":"80fa4231-bff6-4e14-9943-6cc5a418c481","role":"authenticated"}', true) AS x
)
SELECT public.vender_de_inventario_ligando(
  'F-234',
  '[{"client_product_id":"388c7baa-21b7-4038-96e9-da3d54f545f2","qty":7000,"amount":23870},
    {"client_product_id":"da1d9dac-bf27-48ca-bc00-daec72446ba7","qty":5000,"amount":9250},
    {"client_product_id":"ceeab980-d8b4-4902-b001-7a28614c572b","qty":10000,"amount":21000},
    {"client_product_id":"55481cbf-9b45-4698-86c4-a060cd852aa6","qty":2000,"amount":4600},
    {"client_product_id":"4b03be82-63a4-4e16-b418-5c510e1cf8fd","qty":40000,"amount":20000}]'::jsonb,
  91315.20,
  '04c8080b-35ff-48e4-a8ef-8fcefbff5c35'::uuid,
  'Pepe Chuy',
  'F-234 hecha por adelantado el 28-oct; ligada con el OK de Marcelo, 30-oct',
  'admin',
  NULL,
  NULL
) AS resultado
FROM sesion;
