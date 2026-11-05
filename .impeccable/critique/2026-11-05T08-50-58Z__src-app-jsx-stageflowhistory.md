---
target: panel «Tiempo por etapa» del detalle de la orden (v10.84.180)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Marcelo\\Projects\\PrintFlow\\src\\App.jsx#StageFlowHistory"
timestamp: 2026-11-05T08-50-58Z
slug: src-app-jsx-stageflowhistory
---
Method: A: agente independiente (351 mil tokens, 25 capturas de producción y el código) · B: detector, corrido después de A.

Versión evaluada: v10.84.180. Medido después en 868 órdenes de 180 días (sólo lectura).

| # | Heurística | Nota | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | El veredicto no dice si lo pasado sigue ahí |
| 2 | Lenguaje del mundo real | 3 | «148h hábiles», «cada quien cuenta desde aquí», «lo normal» sin explicar |
| 3 | Control y libertad | 3 | No hay salto del veredicto a su renglón |
| 4 | Consistencia | 2 | P-0717: Máquina es 31h, 16h y 30h 51m en la misma ventana |
| 5 | Prevención de errores | 2 | Aquí el error es culpar a quien no fue |
| 6 | Reconocimiento | 3 | Hay que recordar que un día son 9 h y sumar los «esperó su turno» |
| 7 | Flexibilidad | 2 | Sin atajos ni siguiente/anterior |
| 8 | Minimalismo | 3 | P-0733 dice «con CREATIVE» 5 veces; P-0624 trae tres «En espera» |
| 9 | Recuperarse de errores | 3 | La falla de lectura ya tiene salida |
| 10 | Ayuda | 2 | Nada explica de dónde sale «lo normal» |
| | **Total** | **26/40** | **Aceptable** |

## Especificidad
Lo que dice sólo podría ser de aquí; la forma sigue siendo la crónica de cualquier rastreo de pedidos. Detector: 227 hallazgos en App.jsx, 0 dentro del panel.

## Lo que funciona
Validar contesta en la forma de la pregunta; el regreso se cuenta como historia; una orden sana se siente en calma.

## Problemas prioritarios
- [P1] Señala a quien no fue y afirma lo que la bitácora no sabe: P-0431 pone a Karla en rojo bajo «el cliente no ha pedido factura» (24 de 70 Salidas o Recibida con marca traen esa pausa; 13 órdenes marcadas sólo por eso). «Esperó su turno 13h» de un paso de 13h 06m: en 34% de los pasos con ese dato (201 de 587) el «le tocó» se marcó a menos de 5 min de acabar, y ahí estaba 44% de las horas de «fila». /impeccable harden
- [P1] Un mismo tiempo con tres cifras: «lleva 31h», «Máquina 16h · Fila 15h» y «30h 51m». Arreglo: «Máquina 31h (15h en fila)»; sin «otros» cuando está abierto. /impeccable clarify
- [P2] El veredicto contesta otra pregunta: en 52% de las órdenes (389 de 742) hay más de 1 h entre Noemí y Gerardo, y en 315 de ésas no aparece nada al cerrar; «regresó 1 vez» junto a «nada fuera de lo normal» (9 órdenes). /impeccable shape
- [P2] A 1366 la causa queda abajo: lo que se pasó puede quedar bajo el corte; cada etapa trae su línea de fechas aunque no diga nada. /impeccable distill
- [P2] Horas que nadie se imagina: 148h son 16 días de trabajo. /impeccable clarify

## Banderas por persona
- Alex: sin siguiente/anterior; «¿Noemí tarda siempre?» no se contesta aquí.
- Sam: la marca es muda en el resumen; el botón lee 165 caracteres de corrido; sin encabezados.
- Gerardo: su defensa («esperó su turno») va en lo más chico; no puede contestar.

## Observaciones menores
«· hasta que cambie de etapa» parte el veredicto; con un solo rubro sobra la segunda línea; P-0629 dice «nada fuera de lo normal» en una orden cancelada; bitácora sin etapas desaparece en silencio (48 órdenes, 5 de inventario); caret de 10 px; sábados; el ámbar de LiveTimer significa otra cosa.

## Preguntas para considerar
1. ¿«Lo normal» es lo que pasa o lo que quieres que pase? Con una meta de 1 h en Validar, el veredicto cambiaría de sentido.
2. ¿La pregunta es de esta orden o de la semana? Una vista por persona podría ser la herramienta real.
3. ¿Para quién es el rojo? Si es un espejo compartido, el señalado necesita poder anotar por qué.
