-- v10.84.14 — Cancelar una parte deja su factura propia MUERTA de verdad (21-sep-2026; P2 del verificador
-- del 18-sep). cancel_invoice_split_internal ponía status='cancelada' y nada más: la factura propia sin
-- timbrar quedaba con saldo vivo y cfdi_status='pending' (F-65 y F-73 de Portland se corrigieron a mano).
-- Ahora: balance = 0 (regla del dueño: un documento cancelado no debe nada), cfdi_status 'pending'/'error'
-- → 'none' (no hay CFDI que cancelar; una timbrada la frena guard_invoice_timbrada antes de llegar aquí),
-- y si la factura tenía cobros vivos que no son saldo a favor, se abre una discrepancia con el contrato
-- de audit_discrepancies en vez de dejar el dinero colgado en silencio.
DO $$
DECLARE v_def text; v_new text;
BEGIN
  v_def := pg_get_functiondef('public.cancel_invoice_split_internal'::regproc);
  IF md5(v_def) <> '2e321bfd16b0d197e42191a889dc07c2' THEN
    RAISE EXCEPTION 'cancel_invoice_split_internal cambió (md5 %); releer antes de aplicar', md5(v_def);
  END IF;
  IF (SELECT count(*) FROM regexp_matches(v_def, 'UPDATE cobranza\.invoices SET status = ''cancelada'' WHERE id = v_invoice\.id;', 'g')) <> 1 THEN
    RAISE EXCEPTION 'ancla no única en cancel_invoice_split_internal';
  END IF;
  v_new := replace(v_def,
    'UPDATE cobranza.invoices SET status = ''cancelada'' WHERE id = v_invoice.id;',
    '-- v10.84.14 — muerta de verdad: sin saldo y sin CFDI pendiente (una timbrada no llega aquí: la frena' || E'\n' ||
    '        -- guard_invoice_timbrada). Los cobros vivos ya abren discrepancia más abajo (bloque de pagos reales).' || E'\n' ||
    '        UPDATE cobranza.invoices' || E'\n' ||
    '           SET status = ''cancelada'', balance = 0,' || E'\n' ||
    '               cfdi_status = CASE WHEN COALESCE(cfdi_status,''none'') IN (''pending'',''error'') THEN ''none'' ELSE cfdi_status END' || E'\n' ||
    '         WHERE id = v_invoice.id;' || E'\n' ||
    '         WHERE id = v_invoice.id;');
  EXECUTE v_new;
END $$;
