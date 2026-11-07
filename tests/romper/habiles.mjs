// Tratar de ROMPER las cuentas de días hábiles con los festivos de ley (v10.84.186). Marcelo, 5-nov: «festivos no cuentan para entrega, y se descuentan de estancada». Una orden parada el viernes
// 13-nov no lleva horas el lunes 16, que es festivo; y una entrega no se propone en un día que no se trabaja. Sin navegador: las cuentas salen VIVAS de App.jsx con extraer.mjs, con el reloj puesto en cada caso.
// Vuelta 1: escritas antes del código. Las cifras se hicieron a mano con el calendario de 2026: el lunes 16-nov y el viernes 25-dic son de ley; el sábado 25-dic-2027, también, y ya no se trabajaba.
// Uso: node tests/romper/habiles.mjs   ·   SOLO=<regex> corre sólo los casos que coinciden
process.env.TZ = "America/Mexico_City";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extraer } from "../banco/extraer.mjs";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const res = [];
const ok = (n, c, x = "") => { if (process.env.SOLO && !new RegExp(process.env.SOLO).test(n)) return; res.push((c ? "PASA  " : "FALLA ") + n + (x ? "  · " + String(x).replace(/\s+/g, " ").slice(0, 260) : "")); };
// el reloj: cada caso dice en qué momento está
const D0 = Date;
let AHORA = D0.parse("2026-11-05T12:00:00-06:00");
globalThis.Date = class extends D0 { constructor(...a) { if (a.length) super(...a); else super(AHORA); } static now() { return AHORA; } };
const QUIERO = ["bizHoursAgo", "bizDaysUntil", "bizDaysBefore", "bizDaysSince", "calcDeliveryDate", "getStale"];
const { codigo } = extraer(fs.readFileSync(path.join(RAIZ, "src", "App.jsx"), "utf8"), QUIERO, { simulados: ["supabase"] });
const tmp = path.join(os.tmpdir(), "pf-habiles-" + process.pid + ".mjs");
fs.writeFileSync(tmp, `import { esFestivo } from ${JSON.stringify(pathToFileURL(path.join(RAIZ, "src", "lib", "tiempoPorEtapa.js")).href)};\n`
  + [...new Set(codigo.match(/\b[A-Z][A-Za-z0-9]*Icon\b/g) || [])].map(i => `const ${i} = () => null;`).join("\n")
  + "\nconst supabase = {};\n" + codigo + "\nexport const F = {" + QUIERO.map(n => `${n}: typeof ${n} === "undefined" ? null : ${n}`).join(", ") + "};\n");
const { F } = await import(pathToFileURL(tmp).href);
fs.rmSync(tmp, { force: true });

const H = s => s.replace(" ", "T") + "-06:00";
const a = f => { AHORA = D0.parse(H(f)); };
const dia = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const parada = desde => ({ stage: "ctp", created_at: H(desde), timeline: [{ date: H(desde), to: "ctp" }] });

// ── estancada ──
a("2026-11-17 10:00:00");
const h1 = F.bizHoursAgo(H("2026-11-13 14:00:00"));
ok("hab-01-el-festivo-no-suma-horas", h1 === 20, `del viernes 13 a las 14:00 al martes 17 a las 10:00: 10 + 10 = 20 h, sin sábado, domingo ni el lunes 16; salió ${h1}`);
ok("hab-02-todavia-no-es-sin-avance", F.getStale(parada("2026-11-13 14:00:00")) === null, JSON.stringify(F.getStale(parada("2026-11-13 14:00:00"))));
a("2026-11-18 09:00:00");
const e2 = F.getStale(parada("2026-11-13 09:00:00"));
ok("hab-03-estancada-sin-el-festivo", F.bizHoursAgo(H("2026-11-13 09:00:00")) === 48 && e2?.lv === "critical" && e2?.lb === "2d estancada", `viernes 15 + martes 24 + miércoles 9 = 48 h: ${JSON.stringify(e2)}`);
a("2026-11-11 09:00:00");
const h4 = F.bizHoursAgo(H("2026-11-06 09:00:00"));
ok("hab-04-una-semana-sin-festivo-no-cambia", h4 === 72, `viernes 15 + lunes 24 + martes 24 + miércoles 9 = 72 h; salió ${h4}`);
a("2026-11-17 10:00:00");
const h5 = F.bizHoursAgo(H("2026-11-16 10:00:00"));
ok("hab-05-lo-que-se-movio-en-festivo", h5 === 10, `se movió el mismo lunes 16 a las 10:00: sólo cuenta el martes, 10 h; salió ${h5}`);
a("2026-11-16 12:00:00");
const h6 = F.bizHoursAgo(H("2026-11-13 18:00:00"));
ok("hab-06-hoy-es-festivo", h6 === 6, `del viernes 13 a las 18:00 al mismo lunes 16: sólo las 6 h del viernes; salió ${h6}`);
a("2027-12-27 12:00:00");
const h7 = F.bizHoursAgo(H("2027-12-24 12:00:00"));
ok("hab-07-festivo-en-sabado-no-se-resta-dos-veces", h7 === 24, `el 25-dic-2027 es sábado: viernes 12 + lunes 12 = 24 h; salió ${h7}`);

// ── la entrega lejana ──
a("2026-11-09 12:00:00");
ok("hab-08-cuanto-falta-sin-el-festivo", F.bizDaysUntil("2026-11-17") === 5, `del lunes 9 al martes 17: 10, 11, 12, 13 y 17 = 5; salió ${F.bizDaysUntil("2026-11-17")}`);
ok("hab-09-ya-no-es-lejana", !((o => F.getStale(o) === null)({ stage: "placas_listas", due_date: "2026-11-17", created_at: H("2026-11-02 09:00:00"), timeline: [{ date: H("2026-11-02 09:00:00"), to: "placas_listas" }] })), `con 5 días hábiles ya no es «entrega lejana», y a la semana de parada sí se avisa`);
ok("hab-10-una-mas-si-es-lejana", F.bizDaysUntil("2026-11-18") === 6 && F.getStale({ stage: "placas_listas", due_date: "2026-11-18", created_at: H("2026-11-02 09:00:00"), timeline: [{ date: H("2026-11-02 09:00:00"), to: "placas_listas" }] }) === null, `el miércoles 18 son 6: ${F.bizDaysUntil("2026-11-18")}`);
a("2026-11-13 12:00:00");
ok("hab-11-entrega-en-el-festivo-ya-llego", F.bizDaysUntil("2026-11-16") === 0, `del viernes 13 al lunes 16 no hay un día de trabajo; salió ${F.bizDaysUntil("2026-11-16")}`);
const lift = dia(F.bizDaysBefore("2026-11-20", 5));
ok("hab-12-cinco-dias-antes-sin-el-festivo", lift === "2026-11-12", `antes del viernes 20: 19, 18, 17, 13 y 12; salió ${lift}`);
ok("hab-13-cinco-dias-antes-sin-festivo-no-cambia", dia(F.bizDaysBefore("2026-11-13", 5)) === "2026-11-06", dia(F.bizDaysBefore("2026-11-13", 5)));

// ── los días en la etapa (la Torre) ──
a("2026-11-17 10:00:00");
ok("hab-14-el-martes-despues-del-festivo-es-un-dia", F.bizDaysSince(H("2026-11-13 12:00:00")) === 1, `de lo avanzado el viernes 13 al martes 17: 1; salió ${F.bizDaysSince(H("2026-11-13 12:00:00"))}`);
a("2026-11-16 10:00:00");
ok("hab-15-el-festivo-mismo-son-cero", F.bizDaysSince(H("2026-11-13 12:00:00")) === 0, `${F.bizDaysSince(H("2026-11-13 12:00:00"))}`);
a("2026-11-10 10:00:00");
ok("hab-16-una-semana-sin-festivo-no-cambia", F.bizDaysSince(H("2026-11-06 12:00:00")) === 2, `${F.bizDaysSince(H("2026-11-06 12:00:00"))}`);

// ── la fecha que se propone ──
const propone = (desde, metodo, acabados = "") => F.calcDeliveryDate(new Date(H(desde)), metodo, acabados);
ok("hab-17-digital-salta-el-festivo", propone("2026-11-11 10:00:00", "digital") === "2026-11-18", `4 días desde el miércoles 11: 12, 13, 17 y 18; salió ${propone("2026-11-11 10:00:00", "digital")}`);
ok("hab-18-nunca-propone-un-festivo", propone("2026-12-28 10:00:00", "digital") === "2027-01-04", `4 días desde el lunes 28: 29, 30, 31 y el lunes 4; el viernes 1-ene no se entrega; salió ${propone("2026-12-28 10:00:00", "digital")}`);
ok("hab-19-offset-salta-el-festivo", propone("2026-11-06 10:00:00", null) === "2026-11-19", `8 días desde el viernes 6: 9, 10, 11, 12, 13, 17, 18 y 19; salió ${propone("2026-11-06 10:00:00", null)}`);
ok("hab-20-con-acabados-salta-navidad", propone("2026-12-14 10:00:00", null, "barniz") === "2026-12-30", `8 + 3 desde el lunes 14: hasta el 24, el 28, 29 y 30, sin el viernes 25; salió ${propone("2026-12-14 10:00:00", null, "barniz")}`);
ok("hab-21-sin-festivo-no-cambia", propone("2026-11-03 10:00:00", "digital") === "2026-11-09", `4 días desde el martes 3: 4, 5, 6 y 9; salió ${propone("2026-11-03 10:00:00", "digital")}`);
// lo que no es de ley se trabaja (Marcelo: «sólo»): el 2-nov cuenta
a("2026-11-03 10:00:00");
ok("hab-22-el-2-de-noviembre-se-trabaja", F.bizDaysSince(H("2026-10-30 12:00:00")) === 2, `del viernes 30 al martes 3: el lunes 2 y el martes; salió ${F.bizDaysSince(H("2026-10-30 12:00:00"))}`);

// ── vuelta 2: por donde no se diseñó ──
// dos festivos con sus fines de semana: del jueves 24-dic al mediodía al lunes 4-ene al mediodía son 11 días, menos 25, 26, 27, 1, 2 y 3
a("2027-01-04 12:00:00");
const h23 = F.bizHoursAgo(H("2026-12-24 12:00:00"));
ok("hab-23-navidad-y-ano-nuevo-juntos", h23 === 120, `12 + 24 × 4 + 12 = 120 h; salió ${h23}`);
a("2026-11-16 12:00:00");
const h24 = F.bizHoursAgo(H("2026-11-16 10:00:00"));
ok("hab-24-todo-adentro-del-festivo", h24 === 0, `se movió y se mira el mismo lunes 16: nada cuenta; salió ${h24}`);
a("2026-11-17 09:00:00");
const h25 = F.bizHoursAgo(H("2026-11-14 10:00:00"));
ok("hab-25-del-sabado-al-martes-despues-del-festivo", h25 === 9, `el sábado, el domingo y el lunes 16 no cuentan: 9 h del martes; salió ${h25}`);
// un día antes nunca cae en lo que no se trabaja
const uno = [["2026-11-17", "2026-11-13"], ["2026-12-28", "2026-12-24"], ["2027-01-04", "2026-12-31"]].map(([d, e]) => [d, dia(F.bizDaysBefore(d, 1)), e]);
ok("hab-26-un-dia-antes-salta-el-festivo", uno.every(([, x, e]) => x === e), JSON.stringify(uno));
ok("hab-27-desde-el-festivo-mismo", propone("2026-11-16 10:00:00", "digital") === "2026-11-20", `el festivo no cuenta como arranque distinto: 17, 18, 19 y 20; salió ${propone("2026-11-16 10:00:00", "digital")}`);
// a las 7:30 de la noche en México ya es el día siguiente en UTC, y la fecha sale con toISOString: no se puede correr un día
ok("hab-28-de-noche-no-se-corre-al-dia-siguiente", propone("2026-11-11 19:30:00", "digital") === "2026-11-18", `${propone("2026-11-11 19:30:00", "digital")}`);
// lo que parece festivo y ya no lo es: la ley los movió a lunes (Marcelo: «sólo» los de ley), y el 1-oct sólo cada seis años
a("2027-02-04 12:00:00");
ok("hab-29-el-5-de-febrero-se-trabaja", F.bizDaysUntil("2027-02-08") === 2, `del jueves 4 al lunes 8: el viernes 5 y el lunes 8; salió ${F.bizDaysUntil("2027-02-08")}`);
a("2027-02-02 12:00:00");
ok("hab-30-el-primer-lunes-de-febrero-no", F.bizDaysSince(H("2027-01-29 12:00:00")) === 1, `del viernes 29 al martes 2: sólo el martes; salió ${F.bizDaysSince(H("2027-01-29 12:00:00"))}`);
a("2026-11-19 12:00:00");
ok("hab-31-el-20-de-noviembre-se-trabaja", F.bizDaysUntil("2026-11-20") === 1, `${F.bizDaysUntil("2026-11-20")}`);
a("2030-10-02 12:00:00");
ok("hab-32-el-1-de-octubre-del-cambio-de-gobierno", F.bizHoursAgo(H("2030-09-30 12:00:00")) === 24, `lunes 12 h + martes festivo + miércoles 12 h; salió ${F.bizHoursAgo(H("2030-09-30 12:00:00"))}`);
a("2026-10-02 12:00:00");
ok("hab-33-el-1-de-octubre-de-este-ano-se-trabaja", F.bizHoursAgo(H("2026-09-30 12:00:00")) === 48, `${F.bizHoursAgo(H("2026-09-30 12:00:00"))}`);
// las dos cuentas de la entrega lejana hablan igual: el día que la pausa se levanta (5 hábiles antes) es el día que ya faltan 5
const hablan = ["2026-11-10", "2026-11-17", "2026-11-20", "2026-12-30", "2027-01-05", "2027-02-03"].map(d => { a(dia(F.bizDaysBefore(d, 5)) + " 12:00:00"); return [d, F.bizDaysUntil(d)]; });
ok("hab-34-las-dos-cuentas-de-la-entrega-lejana-dicen-lo-mismo", hablan.every(([, n]) => n === 5), JSON.stringify(hablan));
// sin dato o con basura nadie truena. `bizDaysSince` no recibe vacío: quien la llama ya lo revisó
a("2026-11-17 10:00:00");
let basura = "";
try { basura = [F.bizHoursAgo(null), F.bizDaysUntil(null), F.bizDaysUntil(""), F.bizDaysUntil("no es fecha"), F.bizDaysSince("no es fecha")].join(); } catch (e) { basura = "truena: " + e.message; }
ok("hab-35-sin-dato-o-con-basura-no-truena", basura === "0,0,0,0,0", basura);


// ── v10.84.189: la fecha de entrega estándar. Marcelo y Gerardo, 6-nov: «un standard… 8 días hábiles para un trabajo», y que se alargue por el tiraje y los productos.
//    Lo que escogió Marcelo con lo medido: +2 si pasa de 10,000 piezas, +3 desde el 5.º producto de la OC, se suman; los acabados ya no suman 3. Las cifras, a mano con el calendario de 2026.
let FE = null, feError = "";
try { FE = await import(pathToFileURL(path.join(RAIZ, "src", "lib", "fechaEstandar.js")).href); } catch (e) { feError = String(e.message).split("\n")[0]; }
const est = (desde, x = {}) => { if (!FE) return "(sin src/lib/fechaEstandar.js)"; return FE.fechaEstandar({ desde: new Date(H(desde)), ...x }).fecha; };
const VIERNES = "2026-11-06 10:00:00";
ok("hab-36-ocho-dias-sin-el-festivo", est(VIERNES, { piezas: 1000, productos: 1 }) === "2026-11-19", `del viernes 6-nov: 9, 10, 11, 12, 13, (16 festivo), 17, 18, 19; salió ${est(VIERNES, { piezas: 1000, productos: 1 })} ${feError}`);
ok("hab-37-diez-mil-justas-no-alargan", est(VIERNES, { piezas: 10000, productos: 1 }) === "2026-11-19", `«pasa de 10,000»; salió ${est(VIERNES, { piezas: 10000, productos: 1 })}`);
ok("hab-38-diez-mil-una-suma-dos", est(VIERNES, { piezas: 10001, productos: 1 }) === "2026-11-23", `10 días: 20 y lunes 23; salió ${est(VIERNES, { piezas: 10001, productos: 1 })}`);
ok("hab-39-cuatro-productos-no-alargan", est(VIERNES, { piezas: 1000, productos: 4 }) === "2026-11-19", `salió ${est(VIERNES, { piezas: 1000, productos: 4 })}`);
ok("hab-40-el-quinto-producto-suma-tres", est(VIERNES, { piezas: 1000, productos: 5 }) === "2026-11-24", `11 días; salió ${est(VIERNES, { piezas: 1000, productos: 5 })}`);
ok("hab-41-tiraje-y-productos-se-suman", est(VIERNES, { piezas: 25000, productos: 7 }) === "2026-11-26", `13 días; salió ${est(VIERNES, { piezas: 25000, productos: 7 })}`);
ok("hab-42-capturada-en-fin-de-semana", est("2026-11-07 11:00:00", { piezas: 1000 }) === "2026-11-19" && est("2026-11-08 11:00:00", { piezas: 1000 }) === "2026-11-19", `sábado ${est("2026-11-07 11:00:00", { piezas: 1000 })}, domingo ${est("2026-11-08 11:00:00", { piezas: 1000 })}`);
ok("hab-43-cruza-navidad-y-ano-nuevo", est("2026-12-18 10:00:00", { piezas: 1000 }) === "2026-12-31" && est("2026-12-18 10:00:00", { piezas: 20000 }) === "2027-01-05", `8 días: ${est("2026-12-18 10:00:00", { piezas: 1000 })} (sin el 25); 10 días: ${est("2026-12-18 10:00:00", { piezas: 20000 })} (sin el 1-ene)`);
ok("hab-44-no-cae-en-festivo", est("2026-11-04 10:00:00", { piezas: 1000 }) === "2026-11-17", `del miércoles 4: 5, 6, 9, 10, 11, 12, 13, (16), 17; salió ${est("2026-11-04 10:00:00", { piezas: 1000 })}`);
ok("hab-45-de-noche-no-se-corre", est("2026-11-06 23:30:00", { piezas: 1000 }) === "2026-11-19" && est("2026-11-06 00:10:00", { piezas: 1000 }) === "2026-11-19", `23:30 ${est("2026-11-06 23:30:00", { piezas: 1000 })}; 00:10 ${est("2026-11-06 00:10:00", { piezas: 1000 })}`);
{
  const raros = [undefined, null, "", "abc", NaN, -5, 0, Infinity, "1,000,000", {}, []], malos = raros.filter(v => est(VIERNES, { piezas: v }) !== "2026-11-19" || est(VIERNES, { piezas: 1000, productos: v }) !== "2026-11-19");
  ok("hab-46-basura-es-el-estandar", malos.length === 0, `piezas o productos raros que no dieron 8 días: ${JSON.stringify(malos)}`);
}
ok("hab-47-sin-datos-tambien", (() => { if (!FE) return false; a(VIERNES); return FE.fechaEstandar().fecha === "2026-11-19"; })(), FE ? FE.fechaEstandar().fecha : feError);
a(VIERNES);
ok("hab-48-la-web-conserva-su-regla", F.calcDeliveryDate(new Date(H(VIERNES)), "offset", "Barniz UV") === "2026-11-24" && F.calcDeliveryDate(new Date(H(VIERNES)), "digital", "") === "2026-11-12" && F.calcDeliveryDate(new Date(H(VIERNES)), "offset", "") === "2026-11-19", `offset con acabados ${F.calcDeliveryDate(new Date(H(VIERNES)), "offset", "Barniz UV")}, digital ${F.calcDeliveryDate(new Date(H(VIERNES)), "digital", "")}`);
{
  const q = x => FE ? FE.porQueEsaFecha(x) : "";
  const t1 = q({ piezas: 1000, productos: 1 }), t2 = q({ piezas: 20000, productos: 1 }), t3 = q({ piezas: 1000, productos: 6 }), t4 = q({ piezas: 20000, productos: 6 });
  ok("hab-49-dice-por-que", /^8 días hábiles$/.test(t1) && /10 días hábiles/.test(t2) && /más de 10,000 piezas/.test(t2) && !/productos/.test(t2) && /11 días hábiles/.test(t3) && /5 o más productos/.test(t3) && !/piezas/.test(t3) && /13 días hábiles/.test(t4) && /piezas/.test(t4) && /productos/.test(t4), JSON.stringify([t1, t2, t3, t4]));
}

// ── v10.84.189: los avisos en festivo, con la migración tal cual, en un Postgres de verdad (PGlite, el de Almacén). Marcelo, 6-nov: «que los avisos respeten los festivos también»
{
  const archivo = path.join(RAIZ, "docs", "migrations", "v10.84.189_avisos_respetan_festivos.sql");
  const sql = fs.existsSync(archivo) ? fs.readFileSync(archivo, "utf8").replace(/\r\n/g, "\n") : "";
  ok("hab-50-la-migracion-existe-en-un-bloque", /^begin;$/m.test(sql) && /^commit;$/m.test(sql) && /is_business_hours/.test(sql) && /es_festivo_de_ley/.test(sql), archivo);
  const pgl = path.join(RAIZ, "..", "sygma-almacen", "node_modules", "@electric-sql", "pglite", "dist", "index.js");
  if (!fs.existsSync(pgl)) ok("hab-51-sin-pglite", true, "no se corrió lo de la base: esta copia no tiene ../sygma-almacen con PGlite");
  else if (sql) {
    const { PGlite } = await import(pathToFileURL(pgl).href);
    const db = new PGlite();
    await db.exec("create role anon; create role authenticated; create role service_role; create table public.notifications(id serial primary key, target_role text, message text); grant select, insert on public.notifications to authenticated, service_role; grant usage, select on sequence public.notifications_id_seq to authenticated, service_role;");
    // la función tal cual, con el reloj de la prueba en vez de NOW() (lo único que cambia); la de hoy también vive aquí: `cobranza` y `extensions` no existen en PGlite y no estorban
    await db.exec("create table public.reloj_de_la_prueba(ahora timestamptz not null); insert into public.reloj_de_la_prueba values (now()); grant select on public.reloj_de_la_prueba to public; create function public.reloj() returns timestamptz language sql stable as 'select ahora from public.reloj_de_la_prueba';");
    await db.exec(sql.replace(/NOW\(\) AT TIME ZONE/, "public.reloj() AT TIME ZONE"));
    await db.exec(`create function public.skip_silent_window_notifications() returns trigger language plpgsql as $f$ begin if not public.is_business_hours() then return null; end if; return new; end; $f$;
      create trigger trg_skip_silent_window before insert on public.notifications for each row execute function public.skip_silent_window_notifications();`);
    const enHora = async (cuando) => { await db.query("update public.reloj_de_la_prueba set ahora = $1::timestamptz", [H(cuando)]); return (await db.query("select public.is_business_hours() v")).rows[0].v; };
    // todos los días de 2024 a 2040: la lista de la base y la de la app, iguales
    const { esFestivo } = await import(pathToFileURL(path.join(RAIZ, "src", "lib", "tiempoPorEtapa.js")).href);
    const filas = (await db.query("select d::date::text f, public.es_festivo_de_ley(d::date) v from generate_series('2024-01-01'::date, '2040-12-31'::date, '1 day') d")).rows;
    const distintos = filas.filter(r => { const [y, m, d] = r.f.split("-").map(Number); return esFestivo(new D0(y, m - 1, d, 12)) !== r.v; }).map(r => r.f);
    ok("hab-51-la-base-y-la-app-tienen-la-misma-lista", filas.length > 6000 && distintos.length === 0, `${filas.length} días; distintos: ${distintos.slice(0, 8).join(", ")}`);
    const festivos2026 = filas.filter(r => r.v && r.f.startsWith("2026-")).map(r => r.f.slice(5)).join(" ");
    ok("hab-52-los-de-2026-a-mano", festivos2026 === "01-01 02-02 03-16 05-01 09-16 11-16 12-25", festivos2026);
    ok("hab-53-el-1-de-octubre-de-cambio-de-gobierno", filas.find(r => r.f === "2030-10-01")?.v === true && filas.find(r => r.f === "2024-10-01")?.v === true && filas.find(r => r.f === "2026-10-01")?.v === false, "2024 y 2030 sí; 2026 no");
    const casos = [["2026-11-16 10:00:00", false, "el lunes 16-nov, festivo, en horario"], ["2026-11-16 09:00:00", false, "abriendo"], ["2026-11-16 18:59:00", false, "cerrando"], ["2026-12-25 12:00:00", false, "viernes 25-dic"], ["2027-01-01 12:00:00", false, "viernes 1-ene"],
      ["2026-11-17 10:00:00", true, "el martes siguiente"], ["2026-11-13 10:00:00", true, "el viernes anterior"], ["2026-11-17 09:00:00", true, "a las 9:00"], ["2026-11-17 18:59:00", true, "a las 18:59"], ["2026-11-17 08:59:00", false, "a las 8:59"], ["2026-11-17 19:00:00", false, "a las 19:00"],
      ["2026-11-14 10:00:00", false, "sábado"], ["2026-11-15 10:00:00", false, "domingo"], ["2026-11-02 10:00:00", true, "2-nov: no es de ley"], ["2026-12-24 10:00:00", true, "24-dic: no es de ley"]];
    const mal = []; for (const [c, e, q] of casos) { const v = await enHora(c); if (v !== e) mal.push(`${q} (${c}): ${v}`); }
    ok("hab-54-is-business-hours", mal.length === 0, mal.join("; ") || `${casos.length} instantes`);
    // el día se toma en México, no en UTC: la noche del domingo 15 (ya es 16 en UTC) y la del lunes 16 (ya es martes en UTC)
    const noche = [await enHora("2026-11-16 18:30:00"), await enHora("2026-11-17 09:30:00")];
    ok("hab-55-el-dia-es-el-de-mexico", noche[0] === false && noche[1] === true, JSON.stringify(noche));
    await enHora("2026-11-16 10:00:00");
    await db.query("insert into public.notifications(target_role, message) values ('admin','en festivo')");
    const nF = (await db.query("select count(*)::int n from public.notifications")).rows[0].n;
    await enHora("2026-11-17 10:00:00");
    await db.query("insert into public.notifications(target_role, message) values ('admin','en martes')");
    const nM = (await db.query("select count(*)::int n from public.notifications")).rows[0].n;
    ok("hab-56-en-festivo-el-aviso-no-se-guarda-y-al-dia-siguiente-si", nF === 0 && nM === 1, `festivo ${nF}, martes ${nM}`);
    // la regla 5 (toda función nueva, cerrada a anon) no puede tumbar el aviso: el disparador corre como quien inserta (la lección de la vista invoker y la función privada: 42501)
    let comoApp = "";
    try { await db.exec("set role authenticated"); await db.query("insert into public.notifications(target_role, message) values ('admin','como la app')"); await db.exec("reset role"); await db.exec("set role service_role"); await db.query("insert into public.notifications(target_role, message) values ('admin','como una función de borde')"); comoApp = "ok"; } catch (e) { comoApp = e.message; } finally { await db.exec("reset role"); }
    const nA = (await db.query("select count(*)::int n from public.notifications")).rows[0].n;
    ok("hab-57-la-app-y-las-funciones-de-borde-pueden-avisar", comoApp === "ok" && nA === 3, `${comoApp}; ${nA} avisos`);
    let comoAnon = ""; try { await db.exec("set role anon"); await db.query("select public.es_festivo_de_ley('2026-11-16')"); comoAnon = "ABIERTA"; } catch (e) { comoAnon = /permission denied/.test(e.message) ? "cerrada" : e.message; } finally { await db.exec("reset role"); }
    ok("hab-58-cerrada-a-anon", comoAnon === "cerrada", comoAnon);
    await db.close();
  }
}

for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nhabiles: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
