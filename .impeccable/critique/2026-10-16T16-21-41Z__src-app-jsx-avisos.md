---
target: los avisos (NotificationBell, NotificationTray y su base, src/App.jsx)
total_score: 19
p0_count: 0
p1_count: 3
timestamp: 2026-10-16T16-21-41Z
slug: src-app-jsx-avisos
---
# /impeccable critique — los AVISOS (la campana y su bandeja)

`NotificationBell` y `NotificationTray` en `src/App.jsx`, con la base de los avisos (`db.loadNotifications`, `markRead`, `markAllRead`,
`deleteNotification`, `deleteAllNotifications`) y su montaje en App. 16-oct-2026 por la mañana. Evaluación A (diseño, con el código) escrita antes de la
B (el detector de la skill en el navegador). Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | si la lectura de los avisos falla, «Sin notificaciones» (la regla 12); marcar o borrar «salen» aunque la base no lo haya hecho (la regla 2) |
| 2 | El mundo real | 3 | los mensajes dicen la orden y qué pasó |
| 3 | Control y libertad | 1 | «Borrar todas» borra todo de un clic, sin preguntar y sin deshacer |
| 4 | Consistencia | 2 | en toda la app tocar algo de una orden la abre; aquí no; no es una ventana como las demás |
| 5 | Prevención de errores | 1 | el botón rojo de borrar todo junto a «Leídas» |
| 6 | Reconocer, no recordar | 2 | el aviso dice la orden, pero para verla hay que buscarla a mano |
| 7 | Flexibilidad y eficiencia | 1 | el foco no entra; los avisos son renglones con clic; Esc cierra pero el foco se pierde |
| 8 | Estética y minimalismo | 3 | sobria |
| 9 | Recuperarse de errores | 1 | ningún error se dice |
| 10 | Ayuda | 3 | «Leídas» no dice qué hace (marca todas) |
| **Total** | | **19/40** | **Pobre** |

## Impresión general

La campana de todos, todos los días, que no lleva a ningún lado: el aviso dice «P-0611 · Gerardo pide atención» y para ver P-0611 hay que cerrar y
buscarla. Y lo que hace sobre la base (marcar, borrar todo) no revisa si la base lo hizo.

## ¿Parece hecho por IA?

No: es una lista sencilla. Le falta función, no le sobra adorno. **El detector (navegador):** antes, 9 hallazgos con 5 avisos y 33 con 30: la letra de
9 px de quién y cuándo (uno por aviso), el motivo en naranja #e58a12 (2.6:1), «Borrar todas» en rojo sobre el gris (3.9:1) y el número de la campana,
blanco sobre el rojo (4.3:1). Después: sólo los falsos positivos de siempre (Geist, «gradient-text»).

## Lo que funciona

- El mensaje de cada aviso dice la orden y qué pasó, y quién y cuándo.
- Esc cierra y el clic fuera también.

## Problemas

- **[P1] El aviso no llevaba a su orden:** tocarlo sólo lo marcaba como leído, y para ver la orden había que cerrar y buscarla. **Arreglo:** tocarlo abre
  su orden y lo marca; si la orden ya no está entre las cargadas, lo dice.
- **[P1] «Borrar todas» borraba todo de un clic**, sin preguntar y sin deshacer. **Arreglo:** pregunta con la cuenta («¿Borrar los 5 avisos? No se pueden
  recuperar.»), con «Cancelar» de primero; un doble clic en «Sí, borrar» borra una vez.
- **[P1] Sin lectura buena, «Sin notificaciones»; y marcar o borrar «salían» aunque la base no lo hubiera hecho** (las reglas 12 y 2: al recargar regresaban).
  **Arreglo:** la base de los avisos revisa su error; App sabe si los leyó (`avisosLeidos`) y la bandeja dice «No se pudieron leer los avisos · Reintentar»;
  si marcar o borrar falla, lo dice y no lo da por hecho.
- **[P2] No era una ventana:** el foco no entraba, los avisos eran renglones con clic, la X no decía cuál borraba. **Arreglo:** `role="dialog"`, el foco
  entra, Esc la cierra y regresa a la campana, el Tab no se sale; los avisos y la X son botones con su nombre.
- **[P2] Contraste y letra de 9 px** (ver el detector). **Arreglo:** las tintas de la app y 10 px.
- **[P3]** «Leídas» → «Marcar todas como leídas»; «Notificaciones» → «Avisos».

## Personas

- **Gerardo** (recibe «Lupita pide atención: P-0611»): lo toca y no pasa nada; tiene que buscar P-0611.
- **Karla** (limpia sus avisos al final del día): «Borrar todas» se llevaba todo sin preguntar.
- **Marcelo** (recibe la copia de todos): con la red cortada, «Sin notificaciones».

## Preguntas

- ¿Los avisos deberían agruparse por orden (tres avisos de P-0611 en uno)?
