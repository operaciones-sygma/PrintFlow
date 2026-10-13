// v10.84.91 — Arma las dos migraciones de la categoría del trabajo con la función que generan las reglas de src/lib/categorias.js:
// docs/migrations/v10.84.91_categorias.sql (la columna, la función, el trigger, la historia y el log) y, APARTE y corta (revisión de
// CobranzaFlow: el ACCESS EXCLUSIVE de DISABLE TRIGGER frena también sus lecturas de orders), v10.84.91b_sin_atrasada.sql.
// Uso: node scripts/categorias-migracion.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { funcionSql, checkSql } from "./categorias-sql.mjs";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const sql = `-- v10.84.91 — LA CATEGORÍA DEL TRABAJO (Marcelo, 12-oct: «Categoría nueva aparte»; 13-oct: aprobó la lista y las recomendaciones).
-- El campo de hoy (product_type, el nombre del trabajo) se queda como está. Se agrega una categoría de LISTA CERRADA que alimenta
-- Analytics (antes, 596 barras: cada nombre escrito a mano era un «producto»).
--
-- 1. orders.categoria: 12 + «otro» (CHECK con la lista de src/lib/categorias.js; vacía = sin clasificar). La venta de inventario
--    (product_type «stock», Cuadra) es un canal y no lleva.
-- 2. public.categoria_sugerida(text): GENERADA por scripts/categorias-sql.mjs de las mismas reglas que la forma usa para sugerir (la
--    tanda «categorias» compara las dos sobre todos los nombres de órdenes: hoy 596, iguales).
-- 3. Lo que llega sin categoría (otras puertas: la OC, la tienda web, una RPC) toma la sugerida al crearse o al ponerle nombre.
-- 4. La historia, una vez: cada orden con su sugerida; las que ninguna regla reconoce (y las sin nombre: hoy 0), «otro» (Marcelo
--    aprobó «lo demás → Otro»):
--    hoy 754 de 779 vivas se clasifican solas (96.8 %, el 98.6 % del dinero); 25 van a «otro» (sellos, pulseras, ZAPATO CODE…).
-- 5. (aparte, v10.84.91b_sin_atrasada.sql) quitar «🔴 ATRASADA · » de las 37 importadas.
-- 6. log_order_field_changes registra también la categoría (desde aquí: la historia no llena el log).
DO $mig$
DECLARE v_def text; v_a text; v_b text; v_n int;
BEGIN
  -- 1. la columna
  ALTER TABLE public.orders ADD COLUMN categoria text;
  ALTER TABLE public.orders ADD CONSTRAINT orders_categoria_lista ${checkSql()};
  COMMENT ON COLUMN public.orders.categoria IS 'v10.84.91: la categoría del trabajo (lista cerrada, src/lib/categorias.js); NULL en la venta de inventario o sin clasificar.';
  -- la app edita orders columna por columna (authenticated no tiene UPDATE en la tabla: 104 columnas con «authenticated=w», las
  -- fiscales sin él): sin este permiso, en cuanto la pantalla mande la categoría fallaría TODA edición de una orden y también crearla
  -- (el upsert de saveOrder pide UPDATE en las columnas que manda). Lo encontró la revisión antes del ensayo (13-oct).
  GRANT UPDATE (categoria) ON public.orders TO authenticated;

  -- 2. la función de las reglas
  EXECUTE $fn$
${funcionSql()}
$fn$;
  REVOKE ALL ON FUNCTION public.categoria_sugerida(text) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.categoria_sugerida(text) TO authenticated, service_role;

  -- 3. lo que llega sin categoría toma la sugerida
  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.categoria_por_omision()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $f$
BEGIN
  -- v10.84.91 — la forma la pide (con la sugerencia puesta); las otras puertas (la OC, la tienda web, una RPC) no: aquí toma la
  -- sugerida, o se queda vacía («sin clasificar» en Analytics) si ninguna regla reconoce el nombre. Nunca pisa una ya puesta.
  IF NEW.categoria IS NULL THEN NEW.categoria := public.categoria_sugerida(NEW.product_type); END IF;
  RETURN NEW;
END $f$;
$fn$;
  REVOKE ALL ON FUNCTION public.categoria_por_omision() FROM PUBLIC, anon;
  CREATE TRIGGER trg_categoria_por_omision BEFORE INSERT OR UPDATE OF product_type ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.categoria_por_omision();

  -- 4. la historia, una vez (las canceladas también: si se reviven, ya traen la suya)
  --    (las sin nombre también: «NULL !~* …» da NULL y no entraban; hoy son 0, y si las hay, «otro» como lo que ninguna regla reconoce)
  UPDATE public.orders SET categoria = COALESCE(public.categoria_sugerida(product_type), 'otro')
   WHERE categoria IS NULL AND COALESCE(product_type, '') !~* '^\\s*stock\\s*$';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('v10_84_91_categorias', 'order', NULL, jsonb_build_object('clasificadas', v_n), 'sistema');

  -- 6. el log de cambios registra la categoría
  v_def := pg_get_functiondef('public.log_order_field_changes()'::regprocedure);
  IF md5(v_def) <> '7057d1ebb45521b95d276ac185650842' THEN RAISE EXCEPTION 'log_order_field_changes cambió (md5 %)', md5(v_def); END IF;
  v_a := $a$"distribution":"Distribución"$a$;
  v_b := $a$"distribution":"Distribución","categoria":"Categoría"$a$;
  IF (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 THEN RAISE EXCEPTION 'ancla del log de cambios'; END IF;
  EXECUTE replace(v_def, v_a, v_b);
END $mig$;
`;
const sinAtrasada = `-- v10.84.91b — SIN «🔴 ATRASADA · » (Marcelo, 12-oct): la marca de las 37 importadas atrasadas, en el nombre del trabajo (product_type)
-- y en la descripción (product), que la traen las mismas 37. Migración APARTE y CORTA (revisión de CobranzaFlow, 13-oct): el DISABLE
-- TRIGGER toma un ACCESS EXCLUSIVE sobre orders, que también frena sus lecturas, así que va solo, sin las 979 de la categoría.
-- 36 de las 37 están facturadas (21 con factura viva en cobranza; sin CFDI sólo R-1219 y R-1217, remisiones de Alpha) y ninguna
-- impresa: sin trg_auto_mark_post_invoice_edits mientras se limpian, no se marcan «editadas después de facturar» (sólo cambia el
-- texto). El antes queda en order_change_log (log_order_field_changes, por «sistema») y en el audit_log. El concepto de las facturas
-- en Por Timbrar no cambia (el motor usa la auto_description de la orden sólo de respaldo, y quitar la marca sólo la mejora).
DO $mig$
DECLARE v_atr jsonb; v_n int;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'tipo', product_type, 'descripcion', product)) INTO v_atr
    FROM public.orders WHERE product_type LIKE '🔴 ATRASADA · %' OR product LIKE '🔴 ATRASADA · %';
  ALTER TABLE public.orders DISABLE TRIGGER trg_auto_mark_post_invoice_edits;
  UPDATE public.orders SET product_type = regexp_replace(product_type, '^🔴 ATRASADA · ', ''),
                           product = regexp_replace(product, '^🔴 ATRASADA · ', '')
   WHERE product_type LIKE '🔴 ATRASADA · %' OR product LIKE '🔴 ATRASADA · %';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  ALTER TABLE public.orders ENABLE TRIGGER trg_auto_mark_post_invoice_edits;
  IF v_n <> 37 THEN RAISE EXCEPTION 'se esperaban 37 órdenes con la marca y son %', v_n; END IF;
  INSERT INTO cobranza.audit_log (action, entity_type, entity_id, details, by_username)
  VALUES ('v10_84_91b_sin_atrasada', 'order', NULL, jsonb_build_object('ordenes', v_n, 'antes', v_atr), 'sistema');
END $mig$;
`;
for (const [nombre, texto] of [["v10.84.91_categorias.sql", sql], ["v10.84.91b_sin_atrasada.sql", sinAtrasada]]) {
  const salida = path.join(RAIZ, "docs", "migrations", nombre);
  fs.writeFileSync(salida, texto, "utf8");
  console.log("migración en " + salida + " (" + texto.length + " caracteres)");
}
