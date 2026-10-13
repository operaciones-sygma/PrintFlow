-- v10.84.91 — LA CATEGORÍA DEL TRABAJO (Marcelo, 12-oct: «Categoría nueva aparte»; 13-oct: aprobó la lista y las recomendaciones).
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
  ALTER TABLE public.orders ADD CONSTRAINT orders_categoria_lista CHECK (categoria IS NULL OR categoria IN ('etiquetas', 'folletos', 'pop', 'formas', 'lonas', 'papeleria', 'libros', 'cuponeras', 'libretas', 'empaques', 'invitaciones', 'calendarios', 'otro'));
  COMMENT ON COLUMN public.orders.categoria IS 'v10.84.91: la categoría del trabajo (lista cerrada, src/lib/categorias.js); NULL en la venta de inventario o sin clasificar.';
  -- la app edita orders columna por columna (authenticated no tiene UPDATE en la tabla: 104 columnas con «authenticated=w», las
  -- fiscales sin él): sin este permiso, en cuanto la pantalla mande la categoría fallaría TODA edición de una orden y también crearla
  -- (el upsert de saveOrder pide UPDATE en las columnas que manda). Lo encontró la revisión antes del ensayo (13-oct).
  GRANT UPDATE (categoria) ON public.orders TO authenticated;

  -- 2. la función de las reglas
  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.categoria_sugerida(p_nombre text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- v10.84.91 — GENERADA por scripts/categorias-sql.mjs desde src/lib/categorias.js: no se edita a mano (se cambia allá y se
  -- regenera). La categoría que sugieren las reglas para un nombre de trabajo, o NULL si ninguna; la venta de inventario
  -- («stock», un canal) tampoco lleva. El ORDEN es la prioridad: gana la primera que coincide.
  SELECT CASE
    WHEN t ~ '^\s*STOCK\s*$' OR btrim(t) = '' THEN NULL
    WHEN t ~ '\m(ETIQUET\w*|STICKERS?|ADHERIBLES?|CALCOMAN\w*|HOLOGRAM\w*|CINTILLOS?|MARBETES?)\M|C[OÓ]DIGOS? DE BARRAS|IMG0' THEN 'etiquetas'
    WHEN t ~ '\m(LONAS?|VINIL(ES)?|ROLL ?UPS?|BANNERS?|MANTAS?|MICROPERFORADOS?|COROPLAST|ESTIRENO|GRAN FORMATO|PEND[OÓ]N(ES)?|TROVICEL|PLOTTER)\M' THEN 'lonas'
    WHEN t ~ '\m(POP|TENT ?CARDS?|DISPLAYS?|P[OÓ]STERS?|CENEFAS?|DANGLERS?|HABLADOR(ES)?|COPETES?|STOPPERS?|EXHIBIDOR(ES)?|SOPORTES?|PRECIADOR(ES)?|MANTELETAS?|TABLOIDES?|CARTEL(ES)?|LETREROS?|IMAN(ES)?|MEN[UÚ]S?)\M' THEN 'pop'
    WHEN t ~ '\m(FOLLETOS?|TR[IÍ]PTICOS?|D[IÍ]PTICOS?|VOLANTES?|FLYERS?|FLAYERS?|BROCHURES?|INSERTOS?|INSERT|C[OÓ]MICS?|POL[IÍ]PTICOS?|CUADR[IÍ]PTICOS?|INSTRUCTIVOS?|SEPARADOR(ES)?)\M' THEN 'folletos'
    WHEN t ~ '\mCALENDARIOS?\M' THEN 'calendarios'
    WHEN t ~ '\m(LIBRETAS?|CUADERNOS?|AGENDAS?|PLANNERS?)\M' THEN 'libretas'
    WHEN t ~ '\m(LIBROS?|REVISTAS?|ANUARIOS?|MANUAL(ES)?|CUADERNILLOS?|GACETAS?|PERI[OÓ]DICOS?|BOLET[IÍ]N(ES)?|CAT[AÁ]LOGOS?|CAR[AÁ]TULAS?|CONTRACAR[AÁ]TULAS?|M[OÓ]DULOS?)\M|C[OÓ]DIGO DE ([EÉ]TICA|CONDUCTA)|\mPOL[IÍ]TICA' THEN 'libros'
    WHEN t ~ '\m(CAJAS?|EMPAQUES?|ESTUCHES?|BOLSAS?|SOLAPAS?|FAJILLAS?|ENVOLTURAS?|CARTERITAS?|CONOS?|KRAFT)\M' THEN 'empaques'
    WHEN t ~ '\m(CUPONERAS?|CUPONES|CUP[OÓ]N|BOLETOS?|PORTABOLETOS?|RIFAS?|PASES?|ESTACIONAMIENTO|ENTRADAS)\M' THEN 'cuponeras'
    WHEN t ~ '\m(MEMBRETAD\w*|SOBRES?|FOLDERS?|CARPETAS?|GAFET\w*|PAPELER[IÍ]AS?)\M|TARJETAS? DE PRESENTACI' THEN 'papeleria'
    WHEN t ~ '\m(REMISI\w*|RECIBOS?|FACTURAS?|PAGAR[EÉ]S?|VALES?|NOTAS?|TALONARIOS?|BLOCKS?|BLOCS?|FORMATOS?|FOTMATOS?|CONTRATOS?|SOLICITUD(ES)?|REQUISICI\w*|BIT[AÁ]CORAS?|CHECK\w*|BOLETAS?|FORMAS?|PEDIDOS?|PLANILLAS?|CONTROL(ES)?|RECETA\w*|HISTORIA\w*|FICHAS?|RELACI\w*|DESGLOSES?|RETIROS?|REPORTES?|EXPEDIENTES?|COMANDAS?|LECTURAS?|SALIDAS?|AUTORIZACI\w*|CARNETS?|LICENCIAS?|REGISTROS?|ENCUESTAS?|EVALUACI\w*|ACUSES?|COMPROBANTES?|INVENTARIOS?|HOJAS?|MEMOR[AÁ]NDUMS?)\M|ORDEN(ES)? DE' THEN 'formas'
    WHEN t ~ '\m(INVITACI\w*|TARJET\w*|POSTAL(ES)?|CONSTANCIAS?|DIPLOMAS?|RECONOCIMIENTOS?|CERTIFICADOS?|ACTAS?|CARTAS?|ESTAMPAS?)\M' THEN 'invitaciones'
    ELSE NULL END
  FROM (SELECT upper(regexp_replace(COALESCE(p_nombre, ''), '^🔴 ATRASADA · ', '')) AS t) x;
$function$;
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
   WHERE categoria IS NULL AND COALESCE(product_type, '') !~* '^\s*stock\s*$';
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
