---
target: «Dinero en Proceso» (WIPDashboard, src/App.jsx)
total_score: 17
p0_count: 0
p1_count: 2
timestamp: 2026-10-17T05-04-22Z
slug: src-app-jsx-dinero-en-proceso
---
# /impeccable critique — «DINERO EN PROCESO»

`WIPDashboard` en `src/App.jsx` (sólo Dirección), con su montaje en App. 16-oct-2026, noche. Escena: Marcelo, en la oficina con la laptop (1366) o el
monitor (1920), revisa cuánto dinero hay en lo que no se ha entregado y dónde está atorado, para decidir a quién apurar; ese mismo día reportó que el
calendario y los reportes daban «números falsos» por las órdenes listas que esperan la factura del cliente (v10.84.140). Medido en producción a las 21:55:
58 activas, $660,062 sin IVA; **$296,287 (45 %) son 21 órdenes LISTAS «En espera: el cliente no ha pedido factura»** (las 14 de Salidas y las 7 recibidas
de maquila). Evaluación A (diseño, con el código y el banco) antes de la B (el detector). Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 1 | sin una lectura buena: «Total $0», «Órdenes activas 0», «Sin precio ✓ 0» en verde |
| 2 | El mundo real | 1 | «capital atorado» incluye lo LISTO que espera al cliente; «d prom» es desde la captura; «órd», «M $», «Total $$$» |
| 3 | Control y libertad | 2 | «+ N más» no se abre: de la sexta orden en adelante no se ven |
| 4 | Consistencia | 2 | cuatro tarjetas de número grande (la plantilla que el Dashboard ya dejó); colores de semáforo como texto |
| 5 | Prevención de errores | 2 | mezclar lo listo con la planta lleva a apurar a producción por dinero que espera al cliente |
| 6 | Reconocer, no recordar | 2 | no dice que es sin IVA; «M» sin decir que es el margen de la maquila |
| 7 | Flexibilidad y eficiencia | 2 | ni las zonas ni las órdenes se abren con el teclado (div con clic) |
| 8 | Estética y minimalismo | 2 | la cuarta tarjeta usa el NOMBRE de un cliente de etiqueta; oro, plata y bronce en el top 5 |
| 9 | Recuperarse de errores | 1 | la falla de lectura se ve como «$0» |
| 10 | Ayuda | 2 | la línea de arriba dice qué excluye, no lo que importa (qué es en proceso y qué espera al cliente) |
| **Total** | | **17/40** | **Flojo** |

## ¿Parece hecho por IA?

Sí, en su forma: la plantilla de cuatro tarjetas de número grande con etiqueta chica en mayúsculas y las medallas del top 5. **El detector (navegador,
sobre el banco), antes:** 6 avisos: texto ámbar a 2.0:1 (`#ff9500` sobre `#f0f3f7`), blanco sobre ámbar a 2.2:1 («Editar Precio»), gris a 4.2:1, letra de
10 px, renglones de ~177 caracteres; y lo de toda la app (la letra Geist única). «gradient-text» sale en todos los estados, también con la página casi vacía:
viene de fuera de la vista (falso positivo aquí). No vio lo que la tanda midió componiendo los tintes: el color de cada zona como texto (Producción 2.1:1,
Captura 2.2:1, «M $3,000» 2.2:1). **Después:** sólo lo de toda la app (la letra única, la jerarquía plana de 12 a 20 px, que es la de las demás vistas).

## Problemas principales

- **[P1] El 45 % del «dinero atorado» está listo y espera al cliente.** Las órdenes en Salidas o recibidas de maquila «En espera: el cliente no ha pedido
  factura» se sumaban por zona, revueltas con lo que de verdad está en proceso. Arreglo: aparte, «En proceso» y «Listo, espera que el cliente pida su
  factura» (`esperaAlCliente`), con cuáles son. `/impeccable clarify`.
- **[P1] Sin lectura, «$0» y una palomita verde** (la regla 12). Arreglo: `leido` de App; «Sin cifras mientras no se lea de la base». `/impeccable harden`.
- **[P2] «d prom» mide desde la captura.** Arreglo: días hábiles EN LA ETAPA (`daysInStage`), en palabras.
- **[P2] Teclado.** Zonas y órdenes son div con clic. Arreglo: botones, `aria-expanded`.
- **[P2] Sin AA.** El color de cada zona como texto, «sin precio» en ámbar, el margen en verde de semáforo, gris claro de 9 y 10 px, el oro del top 5.
  Arreglo: `tintaAA`, `C.wnInk`, `C.okInk`, `C.t2`, 11 px o más.
- **[P2] La plantilla de cifras.** Arreglo: un renglón con lo que importa.
- **[P3]** «+ N más» sin salida → «Ver las N»; «órdenes», «Margen de la maquila», «sin IVA»; el top 5 de lo que está en proceso, sin medallas; `C.bg`.

## Lo que encontró la prueba (no la crítica)

- «En Stock» (final en toda la app) y la orden con su cancelación contaban en el total y encabezaban el top 5 sin caer en ninguna zona: en el banco el total
  decía $254,000 con $66,000 en proceso. Hoy no hay ninguna en producción.
- El margen de la maquila tomaba todo el precio de la que no tiene costo.
- En los arreglos (vueltas 2 a 4): con centavos las zonas no sumaban lo de arriba; un precio negativo restaba; «Ver las 7» con el teclado perdía el foco;
  el doble clic en «Ver las 7» abría la orden que aparece bajo el ratón; el doble clic en una zona la cerraba; el doble clic en «Editar precio» pedía dos
  veces la forma.

## Preguntas

- Lo listo que espera al cliente es dinero por cobrar en cuanto el cliente pida su factura: ¿se le recuerda al cliente desde aquí (a Karla o al vendedor),
  o eso es de «En espera»?
- ¿Las 21 listas de hoy esperan de verdad al cliente, o algunas ya se entregaron sin marcar? (la más vieja dice cuántos días lleva lista).
