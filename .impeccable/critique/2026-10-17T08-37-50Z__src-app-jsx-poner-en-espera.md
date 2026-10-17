---
target: «Poner en espera» (SnoozeModal, src/App.jsx)
total_score: 21
p0_count: 0
p1_count: 2
timestamp: 2026-10-17T08-37-50Z
slug: src-app-jsx-poner-en-espera
---
# /impeccable critique — «PONER EN ESPERA»

`SnoozeModal` en `src/App.jsx` (la razón, el motivo y por cuántos días; se abre desde la ficha y el detalle), con su montaje en App. 17-oct-2026, madrugada.
En 30 días: 7 pausas por esta ventana (y 33 por el atajo «El cliente no pide factura», que no la abre). Evaluación A antes de la B. Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 2 | no dice qué día vuelve sola |
| 2 | El mundo real | 2 | «preset», «mín. 5 caracteres», «≤5 días hábiles», rayas largas |
| 3 | Control y libertad | 1 | un clic en el fondo tira la razón ya escrita |
| 4 | Consistencia | 2 | las demás ventanas de la app son diálogos que se llevan el foco y preguntan al salir con algo escrito |
| 5 | Prevención de errores | 1 | «0» o «-2» días la ponen en espera «hasta que cambie de etapa» sin decirlo; «1.5» la redondea a 1 |
| 6 | Reconocer, no recordar | 3 | los motivos a la vista; «Entrega lejana» se esconde cuando no aplica y dice por qué |
| 7 | Flexibilidad y eficiencia | 2 | el foco se queda atrás al abrir; el Tab se sale a la página |
| 8 | Estética y minimalismo | 3 | sobria |
| 9 | Recuperarse de errores | 3 | si la base rechaza, se queda con lo escrito |
| 10 | Ayuda | 2 | «vacío = hasta que cambie de etapa» en el lugar del número |
| **Total** | | **21/40** | **Aceptable** |

## ¿Parece hecho por IA?

No. **El detector (navegador, sobre el banco):** antes, el botón apagado a 1.4:1 (blanco sobre gris claro); después, sólo la jerarquía de letra de la app.

## Problemas principales

- **[P1] El fondo tira lo escrito.** Arreglo: Esc o el fondo con algo escrito preguntan dentro de la ventana («¿Salir sin ponerla en espera?»: «Seguir
  escribiendo» regresa el cursor a la razón, «Salir sin guardar»); un segundo Esc sale. Con el cursor en la razón, Esc es del campo (la regla de la app).
- **[P1] Los días se convierten en silencio.** Arreglo: enteros de 1 a 365 o vacío; si no, lo dice y no deja ponerla.
- **[P2] No es un diálogo.** Arreglo: `role="dialog"` con su nombre, se lleva el foco, el Tab no se sale, al cerrar regresa.
- **[P2] No dice cuándo vuelve.** Arreglo: «En espera hasta el lunes 19 de octubre (o hasta que cambie de etapa)».
- **[P3]** el botón apagado legible; sin rayas largas ni «preset»; «en 5 días hábiles o menos».

## Preguntas

- Si se elige un motivo y luego se reescribe la razón por completo, el motivo se queda (y así se cuenta en los filtros de «En espera»): ¿debería volver a
  «Otro»?
