// Un recurso de FUERA que no cargó no es un error de la app: los bancos y la app traen la letra (Geist) de Google Fonts, y cuando la red de la
// PC parpadea, Chrome escribe «Failed to load resource: net::ERR_NETWORK_CHANGED» (o ERR_NAME_NOT_RESOLVED) aunque la prueba sea en
// 127.0.0.1. El 14-oct eso frenó dos candados (la red se cayó a las 02:33 y a las 05:00). Lo que no carga de 127.0.0.1 o localhost (la app,
// el banco, su servidor) sigue contando. Uso: page.on("console", m => { if (m.type() === "error" && !deFuera(m)) … })
// v10.84.117 — y el canal de recarga en caliente de Vite («WebSocket connection to 'ws://127.0.0.1:5187/?token=…' failed», «[vite] failed to connect
//   to websocket»): es del servidor de pruebas, no de la app (en producción no existe), y sin él la página sigue igual. El 15-oct frenó el candado de
//   v10.84.117 por can-13, que SÍ pasó, en una tanda sin segunda oportunidad, con la red de Windows sin espacio (ERR_NO_BUFFER_SPACE). Un websocket
//   que no es local (el tiempo real de Supabase) sigue contando. Las tandas con filtro propio (cancelar, orden, plan) usan deVite.
export const deVite = m => /WebSocket connection to 'wss?:\/\/(127\.0\.0\.1|localhost):\d+\/[^']*' failed/.test(m.text()) || /\[vite\] (failed to connect to websocket|server connection lost)/i.test(m.text());
export const deFuera = m => deVite(m) || (/Failed to load resource/.test(m.text()) && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(m.location()?.url || ""));
