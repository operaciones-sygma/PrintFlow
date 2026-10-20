// La contraseña de sitio para los recorridos (v10.84.162). Desde esa versión produccion.sygma.mx pide la contraseña de sitio del navegador
// antes de la app (middleware.js), como CobranzaFlow, Almacén, Contabilidad, Central y el Cotizador, la misma en todas (Marcelo, 19-oct-2026).
// Los recorridos contra la app PUBLICADA la mandan con `httpCredentials` de Playwright, limitada a ese dominio (`origin`: no va a la base ni
// a otro sitio); contra la copia local (vite preview en 127.0.0.1) no hace falta: el middleware sólo corre en Vercel.
// Vive sólo en C:\Users\padil\claude-navegador\credencial-sitio.json ({ "usuario": …, "contrasena": … }), o donde diga SITIO_CREDENCIAL, y
// nunca se imprime. Sin ella, contra producción el recorrido se detiene diciendo qué falta (si no, cada pantalla daría un 401 confuso).
// Lo vigila tests/romper/middleware.mjs (mw-08 y mw-09).
import fs from "node:fs";

const RUTA_POR_OMISION = "C:/Users/padil/claude-navegador/credencial-sitio.json";
export const rutaCredencialDeSitio = () => process.env.SITIO_CREDENCIAL || RUTA_POR_OMISION;

const esLocal = (url) => {
  if (!url) return true;
  try {
    const h = new URL(url).hostname;
    return h === "127.0.0.1" || h === "localhost" || h === "[::1]" || h === "::1";
  } catch { return true; }
};

// Lo que va en nav.newContext({ ..., ...contextoDeSitio(base) }).
export function contextoDeSitio(url) {
  if (esLocal(url)) return {};
  const ruta = rutaCredencialDeSitio();
  let cred = null;
  try { cred = JSON.parse(fs.readFileSync(ruta, "utf8")); } catch { cred = null; }
  if (!cred || typeof cred.usuario !== "string" || typeof cred.contrasena !== "string" || !cred.usuario || !cred.contrasena) {
    throw new Error(`${new URL(url).host} pide la contraseña de sitio (desde v10.84.162) y no está en ${ruta} ` +
      `({ "usuario": …, "contrasena": … }, la misma de las otras apps de SYGMA). Sin ella el recorrido de producción no se puede correr.`);
  }
  return { httpCredentials: { username: cred.usuario, password: cred.contrasena, origin: new URL(url).origin } };
}
