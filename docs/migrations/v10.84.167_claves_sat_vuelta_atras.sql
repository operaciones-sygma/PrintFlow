-- v10.84.167 — VUELTA ATRÁS de v10.84.167_claves_sat.sql: quita specs.cfdi de los 9 productos de Cuadra (lo demás de specs se queda).
UPDATE public.client_products SET specs = specs - 'cfdi'
 WHERE id IN ('4b03be82-63a4-4e16-b418-5c510e1cf8fd', 'cb65f0a1-0364-4705-b449-4286af51139e', '572e3937-07d0-49fc-aeb1-9985b20d1043',
              'ceeab980-d8b4-4902-b001-7a28614c572b', '8f2e31d4-42a9-47f6-b28c-e59547acaf3d', '55481cbf-9b45-4698-86c4-a060cd852aa6',
              '388c7baa-21b7-4038-96e9-da3d54f545f2', 'da1d9dac-bf27-48ca-bc00-daec72446ba7', '579e1d5a-410c-46a0-a041-554059739ff0');
