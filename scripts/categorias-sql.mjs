// v10.84.91 — Genera, desde src/lib/categorias.js (las reglas viven ahí, una sola vez), la función de la base que sugiere la
// categoría de un trabajo: public.categoria_sugerida(text). La migración la lleva tal cual; la tanda `categorias` compara la de la
// base con la de la pantalla sobre todos los nombres de órdenes. Uso: node scripts/categorias-sql.mjs  (imprime el CREATE FUNCTION)
import { REGLAS, aSql, CODIGOS_CATEGORIA } from "../src/lib/categorias.js";

const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
export function funcionSql() {
  const casos = REGLAS.map(r => `    WHEN t ~ ${lit(aSql(r.patron))} THEN ${lit(r.codigo)}`).join("\n");
  return `CREATE OR REPLACE FUNCTION public.categoria_sugerida(p_nombre text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- v10.84.91 — GENERADA por scripts/categorias-sql.mjs desde src/lib/categorias.js: no se edita a mano (se cambia allá y se
  -- regenera). La categoría que sugieren las reglas para un nombre de trabajo, o NULL si ninguna; la venta de inventario
  -- («stock», un canal) tampoco lleva. El ORDEN es la prioridad: gana la primera que coincide.
  SELECT CASE
    WHEN t ~ '^\\s*STOCK\\s*$' OR btrim(t) = '' THEN NULL
${casos}
    ELSE NULL END
  FROM (SELECT upper(regexp_replace(COALESCE(p_nombre, ''), '^🔴 ATRASADA · ', '')) AS t) x;
$function$;`;
}
export const checkSql = () => `CHECK (categoria IS NULL OR categoria IN (${CODIGOS_CATEGORIA.map(lit).join(", ")}))`;

if (process.argv[1] && process.argv[1].endsWith("categorias-sql.mjs")) console.log(funcionSql() + "\n\n-- " + checkSql());
