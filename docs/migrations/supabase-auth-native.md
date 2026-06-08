# Plan de migración a Supabase Auth nativa

**Versión objetivo**: v10.59.0
**Estimado**: 1-2 días dedicados + ventana de mantenimiento de 1-2h
**Riesgo**: ALTO (si rompe el login, todo el equipo queda sin acceso)
**Pre-requisito de**: RLS verdadera en INSERT/UPDATE (cierra bypass via DevTools en cancelOrder + ~30 sitios)

---

## ¿Por qué migrar?

### Lo que se cierra

Hoy un vendedor con DevTools puede ejecutar:
```js
await supabase.from("orders").update({stage:"cancelled"}).eq("id","P-3540")
```
Y la operación pasa porque la policy `allow_update` tiene `qual=true`. Los gates `ACTION_ROLES` de UI son solo defense-in-depth — bypass total via DevTools.

Esto NO se puede arreglar sin saber **QUIÉN** está haciendo la query. Y para eso necesitas `auth.uid()`, que solo existe con Supabase Auth nativa.

### Lo que se gana

- RLS verdadera con `auth.uid() = created_by` o `seller_id`
- Audit trail confiable (sin posibilidad de suplantación)
- Password storage estándar (bcrypt + salt, no manual)
- Token rotation automático
- Recovery flow estándar (forgot password)
- Logout funcional cross-tab
- Compatibilidad con futuros patrones (magic links, social auth)

---

## Estado actual (auth custom)

### Cómo funciona hoy

1. **Tabla**: `public.users` con columnas `username`, `password_hash`, `role`, `display_name`, `active`
2. **Login** (App.jsx:429-436):
   ```js
   supabase.rpc("verify_user_password", { p_username, p_password })
   ```
   Returns `{username, role, display_name}` si match.
3. **Session restore** (App.jsx:9366-9415):
   - Lee `pf-session` de localStorage
   - Re-verifica con `get_user_session(p_username)`
   - Si user inactivo → invalidar
4. **State**: `setUser(role)`, `setUserName(name)`, `setUserLogin(username)`
5. **RPCs** reciben `p_actor` text con `userLogin || user`
6. **Verify_actor_role** valida ese p_actor contra `public.users` (y cobranza.users con mapping)

### Lo que NO existe

- `auth.uid()` no se usa en ningún lado (verified: 2 ocurrencias triviales)
- Ninguna policy usa `auth.uid()` — todas son `qual=true` o admin checks via RPC
- No hay Supabase Auth users configurados todavía

---

## Estado deseado

### Cómo funcionará

1. **Tabla mapping**: `public.user_profiles` (PK = `auth_user_id uuid REFERENCES auth.users(id)`, columns: `username text UNIQUE`, `role text`, `display_name text`, `active bool`)
2. **Login**: `supabase.auth.signInWithPassword({email, password})` con email=username@printflow.local (o real email)
3. **Session restore**: `supabase.auth.getSession()` — automático, sin localStorage manual
4. **State**: derivado de `user_profiles` joinado con `auth.users`
5. **RPCs**: siguen recibiendo `p_actor` (compatibilidad backward, solo cambian la fuente del username)
6. **verify_actor_role**: actualizada para resolver username desde `auth.uid()` si está disponible
7. **Policies RLS**: `(seller_id = auth.uid())` o `(created_by_uid = auth.uid())`

---

## Decisiones técnicas críticas

### A. Email vs username puro

**Decisión recomendada**: usar emails artificiales `{username}@printflow.local` para Supabase Auth.

Razón: Supabase Auth requiere email único. Los usernames de PrintFlow ya son únicos. Mapping 1:1.

Alternativa: hacer que cada usuario configure email real. Más invasivo, requiere onboarding de cada empleado.

### B. Password reset / migración inicial

**Decisión recomendada**: forzar reset de password al primer login post-migración.

Razón: NO podemos pasar los `password_hash` de PrintFlow (formato custom) directamente a `auth.users.encrypted_password` (formato bcrypt de Supabase). Tampoco queremos forzar a cada usuario a "registrarse de cero" desde la UI.

Implementación:
1. Crear `auth.users` rows con email y password temporal aleatorio
2. Marcar `user_profiles.must_reset_password = true`
3. Frontend al detectar el flag muestra modal "Cambia tu password antes de continuar"
4. Llamar `supabase.auth.updateUser({password})` con el nuevo password
5. Set `must_reset_password = false`

Alternativa: enviar magic link por email a cada empleado. Requiere emails reales y servicio SMTP configurado.

### C. Mantener `verify_actor_role` o eliminarlo

**Decisión recomendada**: MANTENER (deprecated pero funcional).

Razón: las 12 RPCs gateadas reciben `p_actor` text. Cambiar TODAS para que lean `auth.uid()` server-side es trabajo extra que no agrega seguridad (la verificación es la misma). Mejor:
1. Las RPCs siguen recibiendo `p_actor`
2. `verify_actor_role` agrega una capa más: si `auth.uid()` está disponible Y matchea el username, OK. Si NO matchea, RAISE (alguien está suplantando).
3. Con el tiempo se puede migrar a leer directamente de `auth.uid()`.

### D. Cómo mapear roles

**Decisión recomendada**: mantener `user_profiles.role` text.

Razón: los roles de PrintFlow son operativos (karla, secretaria, vendedor, etc.) y no semánticos de auth (admin/user). Mantenerlos en una tabla aparte separa concerns.

---

## Pasos detallados

### FASE 0 — Preparación (sin ventana, día anterior)

- [ ] Backup completo de `public.users` (export CSV con username + role + display_name + active)
- [ ] Confirmar lista final de usuarios a migrar (7 hoy: admin, karla, secretaria, vendedor, preprensa, produccion, german)
- [ ] Decidir si CobranzaFlow se migra al mismo tiempo (recomendado SÍ — comparten Supabase)
- [ ] Verificar SMTP de Supabase configurado (para password reset)
- [ ] Avisar al equipo del downtime planificado

### FASE 1 — Setup schema (ventana, 30 min)

- [ ] Crear tabla `public.user_profiles`:
  ```sql
  CREATE TABLE public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text UNIQUE NOT NULL,
    role text NOT NULL,
    display_name text,
    active boolean DEFAULT true,
    must_reset_password boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX idx_user_profiles_username ON public.user_profiles(username);
  ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "users can read their own profile" ON public.user_profiles
    FOR SELECT TO authenticated USING (id = auth.uid());
  CREATE POLICY "users can read any profile" ON public.user_profiles
    FOR SELECT TO authenticated USING (true);  -- para typeahead, etc.
  ```

- [ ] Insertar `auth.users` rows + `user_profiles` rows para los 7 usuarios. Password temporal aleatorio. `must_reset_password=true`.

- [ ] Actualizar `verify_actor_role` para resolver desde `auth.uid()` si está disponible, fallback a public.users como hoy:
  ```sql
  CREATE OR REPLACE FUNCTION public.verify_actor_role(p_actor text, p_allowed_roles text[])
  RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path TO 'public', 'cobranza', 'pg_temp' AS $$
  DECLARE v_role text; v_auth_username text;
  BEGIN
    -- ... validaciones existentes ...

    -- v10.59.0: si hay sesión Auth, validar que matchea p_actor
    IF auth.uid() IS NOT NULL THEN
      SELECT username INTO v_auth_username FROM public.user_profiles WHERE id = auth.uid();
      IF v_auth_username IS NOT NULL AND v_auth_username <> p_actor THEN
        RAISE EXCEPTION 'Actor "%" no coincide con la sesión Auth (%)', p_actor, v_auth_username
          USING ERRCODE='42501';
      END IF;
    END IF;

    -- 1) Buscar en user_profiles (PrintFlow native con Auth)
    SELECT role INTO v_role
      FROM public.user_profiles
     WHERE username = p_actor AND active = true LIMIT 1;

    -- 2) Fallback legacy public.users (durante transición)
    IF v_role IS NULL THEN
      SELECT role INTO v_role FROM public.users
       WHERE username = p_actor AND active = true LIMIT 1;
    END IF;

    -- 3) Fallback cobranza.users (cross-schema con mapping) — como hoy
    ...
  END$$;
  ```

### FASE 2 — Frontend PrintFlow (ventana, 1h)

- [ ] Actualizar `db.login` (App.jsx:429-436):
  ```js
  async login(username, password) {
    const email = username + "@printflow.local";
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Credenciales incorrectas");
    // Obtener profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("username,role,display_name,must_reset_password")
      .eq("id", data.user.id)
      .single();
    return profile;
  }
  ```

- [ ] Actualizar session restore (App.jsx:9366-9415):
  ```js
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("username,role,display_name,must_reset_password")
          .eq("id", session.user.id)
          .single();
        if (profile?.active === false) {
          await supabase.auth.signOut();
          return;
        }
        setUser(profile.role);
        setUserName(profile.display_name);
        setUserLogin(profile.username);
        if (profile.must_reset_password) setShowPasswordResetModal(true);
      } else {
        setUser(null);
      }
      setAuthChecked(true);
    });
    return () => subscription?.unsubscribe();
  }, []);
  ```

- [ ] Crear `PasswordResetModal`: input nuevo password + confirmación + llama `supabase.auth.updateUser({password})` + RPC `clear_must_reset_password(actor)`.

- [ ] Logout: `await supabase.auth.signOut()` en lugar de `localStorage.removeItem("pf-session")`.

- [ ] Eliminar `pf-session` localStorage handling completo.

### FASE 3 — Frontend CobranzaFlow (ventana, 30 min)

CobranzaFlow YA USA Supabase Auth nativa (confirmed: vive en cobranza schema con Auth). Solo verificar:
- Los usernames de cobranza.users matchean con auth.users via algún campo
- Si comparten algunos usernames (karla, genaro), unificar el auth.user.id

Posiblemente NO requiere cambios en CobranzaFlow.

### FASE 4 — Aplicar RLS verdadera (post-ventana, durante semana)

Esto NO bloquea el go-live. Una vez que login funciona via Auth, se pueden ir agregando policies que usen `auth.uid()`:

- [ ] Crear columna `created_by_uid uuid` en `public.orders`
- [ ] Migration que copia desde `created_by` (text) → `created_by_uid` (uuid) via join con user_profiles
- [ ] Policy UPDATE/DELETE: `auth.uid() = created_by_uid OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'`
- [ ] Migrar `cancelOrder` y `cancel_with_nc` a RPCs (ahora ya tienen verify_actor_role + RLS doble)

### FASE 5 — Cleanup (post-go-live)

- [ ] Verificar que nadie usa `db.login` viejo
- [ ] DROP `verify_user_password` y `get_user_session` RPCs viejas
- [ ] Después de 1 semana sin issues: DROP `public.users.password_hash` (mantener username + role + display_name)
- [ ] Después de 2 semanas: eliminar fallback a `public.users` en `verify_actor_role` (solo user_profiles)

---

## Rollback plan

Si el go-live falla y nadie puede entrar:

1. **Inmediato (< 5 min)**:
   - Revertir el commit del frontend en Vercel (rollback de deployment)
   - Marcelo accede a Supabase dashboard → re-activa `public.users` policies
   - Equipo vuelve a usar el login custom temporalmente

2. **Si la BD también necesita rollback**:
   - DROP tabla `user_profiles` (los `auth.users` quedan)
   - Restaurar `verify_actor_role` desde la migration anterior
   - No tocar `auth.users` (no causan daño)

3. **Si todo se complica**:
   - Backup pre-ventana → restore parcial

---

## Testing checklist (post-deploy)

### Smoke tests críticos
- [ ] Login de admin funciona
- [ ] Login de karla funciona
- [ ] Login de cada uno de los 7 roles
- [ ] Session persiste al refrescar
- [ ] Logout funciona y limpia state
- [ ] Re-login después de logout funciona

### Smoke tests por flujo
- [ ] Karla: asignar folio fiscal
- [ ] Karla: registrar OC a crédito Corona
- [ ] Karla: aplicar saldo Corona sin folio
- [ ] Karla: cancelar orden
- [ ] Karla: mover orden a otra OC (validar nuevo filtro mismo cliente)
- [ ] Marcelo: ajustar saldo Corona
- [ ] Lucero: registrar OC a crédito desde CobranzaFlow
- [ ] Gerardo (produccion): asignar máquina + actualizar stage
- [ ] Noemi (preprensa): aprobar diseño
- [ ] Genaro (vendedor): crear orden + cobrar
- [ ] German: imprimir + cerrar máquina log
- [ ] Búsqueda con tildes funciona
- [ ] Realtime sync funciona entre tabs

### Smoke tests de security
- [ ] anon NO puede SELECT user_profiles sin sesión
- [ ] vendedor NO puede ejecutar credit_adjust (verify_actor_role rechaza)
- [ ] vendedor NO puede UPDATE orders ajenas (RLS rechaza una vez aplicada FASE 4)

### Tests de regresión
- [ ] Audit log se popula con username correcto
- [ ] Notifications llegan al rol correcto
- [ ] OCs se crean con cliente correcto
- [ ] Facturas se asignan con folio correcto

---

## Ventana óptima

**Recomendación**: viernes 8 PM o sábado 7 AM. Razones:
- Operación de impresión activa Lunes-Viernes 8 AM - 6 PM
- Karla trabaja hasta ~6 PM (operación más sensible)
- Vie 8 PM da fin de semana para fix si rompe
- Sábado 7 AM permite Marcelo monitorear sin interrupciones

**Pre-ventana** (mismo día):
- Anuncio en grupo de WhatsApp: "Mantenimiento de 2h, 8-10 PM, sistema indisponible"
- Backup BD completo
- Verificar Vercel rollback configurado

**Post-ventana**:
- Sesión de validación con Karla, Marcelo, Lucero, Lupita (cada uno hace 1-2 acciones reales)
- Monitorear audit_log + console errors durante 30 min
- Si todo OK → cerrar ventana

---

## Riesgos identificados

### 🔴 Alto
- **Login no funciona post-deploy**: rollback inmediato (5 min)
- **Password reset modal no aparece y usuarios bloqueados**: rollback (10 min)
- **`auth.uid()` returns NULL silenciosamente y todas las RPCs gateadas fallan**: rollback (10 min)

### 🟠 Medio
- **Session restore lento (>3s)**: degrada UX pero no bloquea — fix en hot-fix
- **Cross-schema verify_actor_role rompe**: solo afecta CobranzaFlow → rollback parcial
- **Realtime auth fails**: se desconecta pero polling sigue → degrada pero no bloquea

### 🟡 Bajo
- **must_reset_password no se limpia y aparece infinitamente**: hot-fix
- **Email artificial (`@printflow.local`) bloquea futuros patrones**: no crítico hoy
- **Audit log con usernames stale**: hot-fix

---

## Estimación de tiempo

| Fase | Estimado | Cuándo |
|---|---|---|
| 0 Preparación | 1h | Día anterior |
| 1 Setup schema BD | 30 min | Ventana |
| 2 Frontend PrintFlow | 1h | Ventana |
| 3 Frontend CobranzaFlow | 30 min (o 0) | Ventana |
| 4 RLS verdadera (incremental) | 4-6h | Durante semana, no bloquea |
| 5 Cleanup | 1h | 1-2 semanas después |

**Total ventana**: 2-3h (con buffer para troubleshooting)
**Total trabajo completo**: 8-12h spread sobre 2-3 semanas

---

## Decisión pendiente

Antes de ejecutar, Marcelo debe decidir:

1. **¿Emails artificiales `@printflow.local` o emails reales?** (recomendado: artificiales para ya)
2. **¿Cuándo es la ventana?** (recomendado: viernes 8 PM o sábado AM)
3. **¿Migrar CobranzaFlow al mismo tiempo o después?** (recomendado: al mismo tiempo si comparten Supabase)
4. **¿Password reset al primer login o magic link por email?** (recomendado: reset modal si no hay SMTP listo)
5. **¿Mantener `public.users` para fallback o eliminar de una?** (recomendado: mantener 2 semanas)

---

## Notas finales

- Este plan se ejecutó hipotéticamente — NO tocó BD ni código
- Las migrations propuestas están escritas pero no aplicadas
- El frontend cambia ~50 líneas en App.jsx (login + session restore + logout)
- El backend cambia ~30 líneas en verify_actor_role + nuevas tablas + policies

**Para ejecutar**: revisar este documento, responder las 5 decisiones pendientes, agendar ventana, ejecutar paso por paso siguiendo el checklist.
