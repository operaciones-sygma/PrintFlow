-- v10.84.5 — las PARTES de una orden por partes cambian desde otra pestaña de PrintFlow (Karla factura la
-- siguiente parte) o desde CobranzaFlow (cancelar el CFDI de una parte regresa su dinero al resto). PrintFlow
-- se suscribe a postgres_changes de esta tabla (canal orders-realtime); sin estar en la publicación, la
-- suscripción no recibe nada y la otra pestaña veía el resto viejo hasta recargar.
-- RLS de la tabla: allow_select para authenticated (realtime la respeta). Replica identity default (PK) basta:
-- las partes no se borran, se cancelan (UPDATE).
-- SQL exacto en supabase_migrations: v10_84_5_splits_en_realtime.
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_invoice_splits;
