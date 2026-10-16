// Las letras de los bancos (Geist y Geist Mono, SIL Open Font License 1.1: fuentes/OFL.txt), servidas por el PROPIO banco (15-oct-2026, Marcelo: «sí,
// hagamos que los candados tarden menos»). Cada prueba abre un navegador limpio, y la liga a Google Fonts de cada página abría conexiones nuevas a
// internet (DNS, TLS y los archivos de letra): ~3,700 por candado, que se suman a lo que satura la red de Windows (ERR_NO_BUFFER_SPACE) y que fallaban
// cuando la red parpadeaba (ERR_NETWORK_CHANGED, 14-oct). Son los mismos archivos que Google servía (bajados una vez a fuentes/), así que las
// medidas de las pruebas de acomodo no cambian. Uso en un generador: `${LIGA_FUENTES}` en el index.html y copiarFuentes(outDir).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const AQUI = path.join(path.dirname(fileURLToPath(import.meta.url)), "fuentes");
export const LIGA_FUENTES = '<link rel="stylesheet" href="./fuentes/geist.css">';
export const copiarFuentes = outDir => fs.cpSync(AQUI, path.join(outDir, "fuentes"), { recursive: true });
