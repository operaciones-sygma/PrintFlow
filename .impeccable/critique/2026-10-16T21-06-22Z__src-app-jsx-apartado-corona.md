---
target: el Apartado Corona (CoronaModal y su lectura, src/App.jsx)
total_score: 21
p0_count: 0
p1_count: 1
timestamp: 2026-10-16T21-06-22Z
slug: src-app-jsx-apartado-corona
---
# /impeccable critique — el APARTADO CORONA (saldos a favor)

`CoronaModal` en `src/App.jsx` (los clientes con saldo a favor, su saldo y su historial; Dirección, Karla y Lupita), con su lectura de la base. 16-oct-2026,
tarde. Es dinero de los clientes: 54 movimientos en la base (29 cargos por factura, 14 depósitos, 7 ajustes, 4 anticipos). Evaluación A (diseño, con el
código y el banco) escrita antes de la B (el detector de la skill). Sin subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 1 | si la lectura falla, «Aún no hay clientes con saldo a favor» o «Sin movimientos todavía»; «Recargar» vacía el historial y dice «Sin movimientos» mientras lee |
| 2 | El mundo real | 1 | «billing_mode=anticipo», DEPOSITO, CONSUMO, ANTICIPO; «$-1,200.00» |
| 3 | Control y libertad | 3 | se cierra con Esc y la X; el ajuste es de Dirección |
| 4 | Consistencia | 2 | la raya lateral de 3 px en el elegido (el sistema de diseño no la usa); colores fuera de las tintas |
| 5 | Prevención de errores | 2 | con una lectura fallida, Karla puede cobrarle a un cliente que tiene saldo |
| 6 | Reconocer, no recordar | 3 | el saldo y el historial a la vista, con el pool y sus sub-cuentas |
| 7 | Flexibilidad y eficiencia | 2 | el Tab se va a la app de atrás |
| 8 | Estética y minimalismo | 3 | dos columnas claras |
| 9 | Recuperarse de errores | 1 | sólo un aviso que se va; «Recargar» sin manejo de error |
| 10 | Ayuda | 3 | los vacíos explican de dónde sale el saldo |
| **Total** | | **21/40** | **Aceptable** |

## ¿Parece hecho por IA?

No, pero lleva la marca de una prisa: la raya lateral de color en el elegido. **El detector (navegador, sobre el banco):** antes, ~25 hallazgos de
contraste (el verde de los saldos a 2.3-2.5:1, el blanco sobre verde de «Nueva OC a Crédito» a 2.5:1, el ámbar de los ajustes a 1.9:1, el cian del
elegido a 3.6:1, los rojos a 4.3:1) y letra de 9 px. Después: sólo la letra chica de la app (10-11 px) y el «gradient-text» del banco.

## Lo que funciona

1. **El pool a la vista**: el líder con sus sub-cuentas y el aviso de que el saldo se comparte.
2. **Cada movimiento con su referencia, quién y su saldo después.**
3. **El ajuste manual es de Dirección y la OC a crédito de quien factura** (los botones por rol).

## Problemas principales

- **[P1] Una lectura fallida se ve como «nadie tiene saldo».** Si `listAnticipoClients` falla: un aviso que se va y «Aún no hay clientes con saldo a
  favor»; si falla el historial, «Sin movimientos todavía». Y «Recargar» vacía la lista y la dice vacía mientras lee (sin manejar su error). Con eso Karla
  puede cobrarle a un cliente con saldo a favor. Arreglo: la falla se dice con «Reintentar»; «leyendo» no es «vacío»; una respuesta vieja no pisa al cliente
  nuevo. `/impeccable harden`.
- **[P2] La pantalla habla en campos de la base.** «billing_mode=anticipo», DEPOSITO, CONSUMO, ANTICIPO. Arreglo: «Modo de cobro: con saldo a favor
  (anticipo)», «Depósito», «Cargo por factura», «Anticipo aplicado». `/impeccable clarify`.
- **[P2] El dinero negativo con el signo después del peso**: «$-1,200.00», «$-11,749.50». Arreglo: «−$1,200.00».
- **[P2] Sin AA y con la raya lateral.** Arreglo: las tintas; el elegido con su fondo y en negritas.

## Banderas por persona

- **Karla:** con la red mala, «Aún no hay clientes con saldo a favor»: le cobra a CORONA LEÓN una factura que su saldo cubría.
- **Lupita:** «billing_mode=anticipo» y «CONSUMO» no le dicen nada.
- **Dirección:** «$-1,200.00» se lee como un error de la pantalla.

## Preguntas

- ¿El historial debería decir a qué factura u orden se aplicó cada cargo, con liga a la orden?
- ¿Un saldo negativo (se usó más de lo depositado) debería avisarse a Tesorería?
