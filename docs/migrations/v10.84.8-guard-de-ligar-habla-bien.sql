-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- v10.84.8 — El guard de «ligar una factura existente» habla bien y mira grouped_invoice_folio — 18-sep-2026
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- Hallazgo del verificador del 18-sep (P3). Los dos guards de ligar —la Opción A de
-- `assign_invoice_splits` y `facturar_siguiente_parte` (v10.84.7)— declaraban `v_ex_src uuid`, pero
-- `cobranza.invoices.source_order_id` es text ('OP-…'). Al toparse con una factura ya ligada a otra
-- orden tronaban con «invalid input syntax for type uuid: "OP-…"» en el SELECT INTO, antes de llegar
-- al mensaje «ya está ligada a otra orden». Cerraban bien (fail-closed), hablaban mal. Y ninguno de
-- los dos miraba `orders.grouped_invoice_folio` (facturación agrupada).
--
-- Cambios (parche de texto con md5 de las definiciones vivas 2e31abc7… y 5ebc67c7…):
--   · `v_ex_src uuid;` → `v_ex_src text;` en las dos.
--   · assign_invoice_splits: tras el check de `orders.invoice_folio`,
--       IF EXISTS (SELECT 1 FROM public.orders WHERE grouped_invoice_folio = v_folio) THEN RAISE … END IF;
--   · facturar_siguiente_parte: `OR EXISTS (SELECT 1 FROM public.orders WHERE grouped_invoice_folio = v_folio)`
--     dentro del bloque «ya está en uso en otra orden de PrintFlow».
-- Ensayo con rollback: ligar F-35 (ya parte de P-0465) → «El folio F-35 ya esta ligado a otra orden:
-- no se puede re-ligar». Aplicada como `v10_84_8_guard_de_ligar_habla_bien_y_mira_grouped_folio`.
-- Definiciones vivas registradas en `v3_7_723_definiciones_vivas` (cobranzaflow).

REVOKE EXECUTE ON FUNCTION public.assign_invoice_splits(text, jsonb, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.facturar_siguiente_parte(uuid, numeric, integer, text, text, text, text, boolean) FROM PUBLIC, anon;
