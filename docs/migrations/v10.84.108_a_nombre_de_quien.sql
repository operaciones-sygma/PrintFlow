-- v10.84.108 — A NOMBRE DE QUIÉN SALIÓ CADA FACTURA (y quién la paga), para que PrintFlow lo diga donde liga o enseña una factura.
-- Marcelo (14-oct, Hotsson, opción 1): «paso deuda de esas 6 facturas a hotsson, pero el detalle se debe ver todo, tal vez a quién se le facturó y
-- la orden de producción que es». SÓLO LEE. Aplicada el 14-oct ~10:40 (migración v10_84_108_a_nombre_de_quien) con el OK de base de Marcelo
-- («Si te doy mi ok para el cambio en la base si es necesario»; «si, opcion 1 … el detalle se debe ver todo»).
-- Revisada por CobranzaFlow (14-oct): el receptor timbrado se congela en cfdi_documents (v3.7.649: lo que tiene el SAT) y se compara por RFC contra
-- el de quien paga (así sale bien aunque algún día un receptor distinto no tenga facturado_a; la invariante 28 lo prohíbe); antes de timbrar, la ficha
-- de facturado_a_client_id («CFDI a nombre de», set_invoice_facturado_a, la regla 23 de CobranzaFlow).
-- Ensayada contra producción con rollback (DO … RAISE EXCEPTION 'ENSAYO'): como Karla, F-70 y F-71 → PODER JUDICIAL / CONGREGACION DEL ORATORIO…
-- COS930618J21; F-123 → GOBIERNO DEL ESTADO / MARIA XOCHILT OLVERA GALLEGOS OEGX770617Q92; F-159 y F-161 sin «a nombre de»; ' f-161 ' normalizado;
-- F-999999 nada; arreglo vacío 0; vendedor 42501; sin sesión 42501; anon sin EXECUTE; authenticated con EXECUTE. Después de aplicar: anon false,
-- authenticated true, una sola versión.
-- Vuelta atrás: DROP FUNCTION public.a_nombre_de_quien(text[]);  (la pantalla no dice «a nombre de» y nada más)
CREATE OR REPLACE FUNCTION public.a_nombre_de_quien(p_folios text[])
 RETURNS TABLE(doc_number text, doc_type text, paga text, a_nombre_de text, a_nombre_de_rfc text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'cobranza', 'pg_temp'
AS $fn$
BEGIN
  IF NOT (COALESCE(cobranza.is_admin_role(), false) OR COALESCE(public.pf_uid_role() IN ('admin','karla','secretaria'), false)) THEN
    RAISE EXCEPTION 'Acceso restringido' USING ERRCODE = '42501';
  END IF;
  IF p_folios IS NULL OR array_length(p_folios, 1) IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT i.doc_number::text, i.doc_type::text, c.name::text,
         (CASE WHEN d.id IS NOT NULL THEN
                 CASE WHEN upper(trim(COALESCE(d.receptor_rfc, ''))) <> upper(trim(COALESCE(c.rfc, ''))) THEN d.receptor_razon_social END
               WHEN i.facturado_a_client_id IS NOT NULL AND i.facturado_a_client_id <> i.client_id THEN COALESCE(NULLIF(trim(f.razon_social), ''), f.name)
          END)::text,
         (CASE WHEN d.id IS NOT NULL THEN
                 CASE WHEN upper(trim(COALESCE(d.receptor_rfc, ''))) <> upper(trim(COALESCE(c.rfc, ''))) THEN d.receptor_rfc END
               WHEN i.facturado_a_client_id IS NOT NULL AND i.facturado_a_client_id <> i.client_id THEN f.rfc
          END)::text
    FROM cobranza.invoices i
    JOIN cobranza.clients c ON c.id = i.client_id
    LEFT JOIN cobranza.clients f ON f.id = i.facturado_a_client_id
    LEFT JOIN LATERAL (SELECT dd.id, dd.receptor_rfc, dd.receptor_razon_social FROM cobranza.cfdi_documents dd
                        WHERE dd.invoice_id = i.id AND dd.cfdi_type = 'I' AND dd.status = 'stamped'
                        ORDER BY dd.stamped_at DESC NULLS LAST, dd.created_at DESC LIMIT 1) d ON true
   WHERE upper(trim(i.doc_number)) IN (SELECT upper(trim(x)) FROM unnest(p_folios) x)
     AND i.status <> 'cancelada'
   ORDER BY i.doc_number
   LIMIT 200;
END $fn$;
REVOKE ALL ON FUNCTION public.a_nombre_de_quien(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.a_nombre_de_quien(text[]) TO authenticated, service_role;
