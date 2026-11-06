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

for (const r of res) console.log(r);
const fallan = res.filter(r => r.startsWith("FALLA")).length;
console.log(`\nhabiles: ${res.length - fallan} pasan, ${fallan} fallan`);
process.exitCode = fallan ? 1 : 0;
