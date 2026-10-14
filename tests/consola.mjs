// Un recurso de FUERA que no cargó no es un error de la app: los bancos y la app traen la letra (Geist) de Google Fonts, y cuando la red de la
// PC parpadea, Chrome escribe «Failed to load resource: net::ERR_NETWORK_CHANGED» (o ERR_NAME_NOT_RESOLVED) aunque la prueba sea en
// 127.0.0.1. El 14-oct eso frenó dos candados (la red se cayó a las 02:33 y a las 05:00). Lo que no carga de 127.0.0.1 o localhost (la app,
// el banco, su servidor) sigue contando. Uso: page.on("console", m => { if (m.type() === "error" && !deFuera(m)) … })
export const deFuera = m => /Failed to load resource/.test(m.text()) && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(m.location()?.url || "");
