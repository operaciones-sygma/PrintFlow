---
target: panel «Tiempo por etapa» del detalle de la orden (v10.84.181)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Marcelo\\Projects\\PrintFlow\\src\\App.jsx#StageFlowHistory"
timestamp: 2026-11-05T10-16-10Z
slug: src-app-jsx-stageflowhistory
---
Method: A: agente independiente (370 mil tokens, 25 capturas de producción y el código) · B: detector, corrido después de A.

Versión evaluada: v10.84.181. Medido después en 868 órdenes de 180 días (sólo lectura).

| # | Heurística | Nota | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | El veredicto puede nombrar una etapa cerrada antes que a quien la tiene ahora |
| 2 | Lenguaje | 3 | «Lo normal» no significa lo que dice |
| 3 | Control | 3 | Abrir puede sacar de la vista el botón recién tocado |
| 4 | Consistencia | 2 | «47 días» y «≈34 días» de la misma pausa |
| 5 | Prevención (de lectura) | 2 | Rojo en una orden entregada 13 días antes de su fecha |
| 6 | Reconocimiento | 3 | Cerrado, «otros» y «y 1 más» obligan a abrir |
| 7 | Flexibilidad | 2 | Sin atajos; lo demás ya sería función nueva |
| 8 | Minimalismo | 3 | La misma pausa en cuatro lugares |
| 9 | Recuperarse de errores | 3 | La falla de lectura ya tiene salida |
| 10 | Ayuda | 2 | La regla de «lo normal» sólo sale si hay marca |
| | **Total** | **26/40** | **Aceptable** |

## Especificidad
Lo que dice es de este producto; cómo lo enseña es un rastreo de paquetes: una etapa de 3 minutos y una de 72 horas ocupan casi lo mismo. Detector: 227 hallazgos en App.jsx, 0 dentro del panel.

## Lo que funciona
Validar contesta la pregunta de Marcelo también cerrado; la columna de tiempos se recorre sola y los de adentro suman; explica lo que se repite y admite lo que no sabe.

## Problemas prioritarios
- [P1] El rojo afirma más de lo que la bitácora sabe: «Gerardo tardó 60h en Empaque» saca el nombre de una tabla fija; de 17 etapas con pausa del cliente que no es de factura, 5 siguen marcadas (P-0716). /impeccable clarify
- [P1] «Lo normal» es el tope del 90%: Validar, mediana 1.7 h y «lo normal» 5 h; P-0561 con Noemí en 4h 47m dice «ninguna etapa se pasó». De 344 entregadas con marca: 82 a tiempo, 144 tarde, 118 sin fecha. Decisión de Marcelo. /impeccable shape
- [P2] El resumen mezcla etapas, cosas y personas; «Salidas» o «Karla» cambian sin explicación. /impeccable distill
- [P2] Un mismo hecho, varias cifras: «lleva 31h» sin «hábiles», «47 días» y «≈34 días», «desde lun» y «desde el mar». /impeccable polish
- [P2] Abrir se lleva el botón que se acaba de tocar. /impeccable harden

No son fallas de la pantalla, serían funciones nuevas: vista por persona, cuánto costó un regreso, réplica del señalado, siguiente/anterior, barra proporcional.

## Banderas por persona
- Alex: sin atajos; «Ver fechas» es todo o nada; lo abierto se pierde con F5.
- Sam: foco fuera de la vista al abrir; horario en title; aria-controls sin destino cerrado; «Ver fechas» de 18 px; no se probó con un lector real.
- Gerardo: su nombre en rojo en una orden entregada antes de su fecha, sin dónde decir por qué; lo que podría decidir (fila o máquina) va a 10 px.

## Observaciones menores
Sábados; «al último» con 4 minutos de diferencia (51 de 742); «1h 6m» y «1h 05m»; «más» huérfano; sin hover; «Creada (Maquila) <1m» con peso desigual; a 300 px la columna de en medio queda en 60 px.

## Preguntas para considerar
1. ¿Este rojo es para Dirección o para todos?
2. ¿Cuánto se ha tardado o cuánto debería tardarse? Con una meta de Marcelo (Validar: 2 horas), el panel puede decir que toda una etapa va lenta.
3. ¿La pregunta es por esta orden o por las personas? Si es un patrón, este panel es la prueba, no la respuesta.
