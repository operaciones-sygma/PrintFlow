// Sirve un banco de prueba (tests/banco/gen-*.mjs ya lo generó en `dir`) para que una tanda lo recorra con Playwright.
//
// 15-oct-2026 (Marcelo: «sí, hagamos que los candados tarden menos») — ARMADO de antemano: `vite build` en modo desarrollo (React con sus avisos de
// desarrollo, que las tandas cuentan como errores de consola; sin minificar) y servido estático con `vite preview`. Medido con la tanda «planta»:
// con el servidor de desarrollo cada página pedía 19 archivos y dejaba 6 conexiones en TIME_WAIT (180 en 30 páginas); armado, 5 archivos y menos de
// 1 conexión (25 en 30). Eso es lo que satura la red de Windows (net::ERR_NO_BUFFER_SPACE: frenó candados el 12, 13, 14 y 15-oct) y obligaba a
// correr de 2 en 2. Además se va el canal de recarga en caliente de Vite (el error de consola que frenó el candado de v10.84.117) y la primera carga
// de hasta 30 s. Armar cuesta ~3 s por banco.
//
// `dev: true` (o PROBAR_BANCO=dev) lo sirve como antes, con el servidor de desarrollo de Vite (para revisar algo a mano o si el armado diera guerra).
// Devuelve { modo: "armado" | "dev", cerrar }.
import path from "node:path";
import { build, preview, createServer } from "vite";

export async function servirBanco({ dir, puerto, raiz, nombre, dev = process.env.PROBAR_BANCO === "dev" }) {
  const configFile = path.join(dir, "vite.config.mjs");
  if (dev) {
    // Las dependencias se preparan TODAS al arrancar (si vite descubre una a media carga, reoptimiza y la página recibe 504 «Outdated Optimize Dep»),
    //   y cada banco con SU caché (con varios en paralelo compartían node_modules/.vite/deps y en Windows uno la borraba mientras otro la usaba).
    const server = await createServer({ configFile, logLevel: "error", clearScreen: false,
      cacheDir: path.join(raiz, "node_modules", ".vite-banco-" + nombre),
      server: { host: "127.0.0.1", port: puerto, strictPort: true },
      optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-dev-runtime", "@phosphor-icons/react"] } });
    await server.listen();
    return { modo: "dev", cerrar: () => server.close() };
  }
  const outDir = path.join(dir, "dist");
  // React de DESARROLLO: `mode` no basta (vite build pone NODE_ENV=production y React se arma de producción, sin sus avisos; lo cazó can-g09). Se
  //   fija aquí, en lo que se arma, y no en process.env: las demás tandas (la de la sesión arma la app real) siguen como estaban.
  await build({ configFile, logLevel: "error", mode: "development", define: { "process.env.NODE_ENV": JSON.stringify("development") },
    build: { outDir, emptyOutDir: true, minify: false, sourcemap: false, reportCompressedSize: false } });
  const server = await preview({ root: dir, configFile, logLevel: "error", build: { outDir },
    preview: { host: "127.0.0.1", port: puerto, strictPort: true } });
  return { modo: "armado", cerrar: () => new Promise(r => server.httpServer.close(() => r())) };
}
