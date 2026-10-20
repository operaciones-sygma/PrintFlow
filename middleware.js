// middleware.js — Vercel Edge Middleware (v10.84.162).
// Protege PrintFlow con HTTP Basic Auth a nivel sitio: la contraseña de sitio del navegador ANTES de la pantalla de entrar, la misma
// capa que CobranzaFlow, Almacén, Contabilidad, Central y el Cotizador. Marcelo, 19-oct-2026: «quiero que el acceso a todas las apps sea
// igual como en cobranzaflow», con la MISMA contraseña en todas: por eso lee las mismas variables de Vercel (BASIC_AUTH_USER y
// BASIC_AUTH_PASSWORD) que las demás. Hasta v10.84.161 produccion.sygma.mx abría directo en su pantalla de entrar.
//
// PrintFlow no tiene páginas públicas (nada con token, como el portal de CobranzaFlow), así que se protege TODO el HTML y TODO el JS:
// la app entera va dentro del bundle. El matcher deja fuera sólo lo que el navegador pide sin la contraseña y no dice nada: los íconos,
// el logo (las hojas impresas lo cargan desde una ventana en blanco con window.location.origin + "/sygma-logo.png"), el CSS y la letra.
// Sin las variables, la puerta se queda CERRADA (503), no abierta.
//
// Capas de protección:  1) Basic Auth de sitio  2) login Supabase (el usuario del área)  3) RLS por rol.
// Runtime: edge (no Node): se usa atob, NO Buffer. Lo vigila tests/romper/middleware.mjs.

export const config = {
  matcher: [
    '/((?!_vercel/|favicon\\.ico|robots\\.txt|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|woff|woff2|ttf|otf|eot|webmanifest)).*)',
  ],
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function unauthorized() {
  return new Response('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="SYGMA PrintFlow", charset="UTF-8"',
      'Cache-Control': 'no-store',
      'Vary': 'Authorization',
    },
  })
}

function misconfigured() {
  return new Response('Server misconfigured', { status: 503, headers: { 'Cache-Control': 'no-store' } })
}

export default function middleware(request) {
  // Credenciales desde env. Si faltan, FAIL CLOSED (503).
  const expectedUser = process.env.BASIC_AUTH_USER
  const expectedPass = process.env.BASIC_AUTH_PASSWORD
  if (!expectedUser || !expectedPass) return misconfigured()

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.toLowerCase().startsWith('basic ')) return unauthorized()

  const b64 = authHeader.slice(6).trim()
  if (b64.length > 1024) return unauthorized()
  let decoded
  try { decoded = atob(b64) } catch { return unauthorized() }

  const sep = decoded.indexOf(':')
  if (sep === -1) return unauthorized()
  const user = decoded.slice(0, sep)
  const pass = decoded.slice(sep + 1)
  if (!user || !pass) return unauthorized()

  const userOk = timingSafeEqual(user, expectedUser)
  const passOk = timingSafeEqual(pass, expectedPass)
  if (!(userOk && passOk)) return unauthorized()

  return // OK
}
