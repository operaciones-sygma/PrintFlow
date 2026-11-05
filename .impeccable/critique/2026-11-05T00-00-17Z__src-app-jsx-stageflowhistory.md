---
target: Tiempo por etapa (StageFlowHistory), v10.84.176
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\Marcelo\\Projects\\PrintFlow\\src\\App.jsx#StageFlowHistory"
timestamp: 2026-11-05T00-00-17Z
slug: src-app-jsx-stageflowhistory
---
# Critique: «Tiempo por etapa» (StageFlowHistory), primera pasada independiente, v10.84.176 en producción

Evaluación A por un revisor independiente (agente aislado, 263 mil tokens; no abrió `.impeccable/critique/`, `CHANGELOG.md` ni la memoria, aunque el sistema le inyectó el `CLAUDE.md` del repo y el índice de memoria, que no traen calificación de este panel). Sin navegador: CobranzaFlow corría sus suites hasta ~18:30; trabajó con el código y las capturas de la versión final. Hover, foco, Tab y lector de pantalla son deducidos. Evaluación B (detector), mía y después de A.

## Calificación de salud (Nielsen)

| # | Heurística | Nota | Lo principal |
|---|---|---|---|
| 1 | Estado del sistema | 2 | «Dónde va» se dice tres veces, pero hasta el final y a veces bajo el pie; «en curso · 8.1h · en espera» no dice que el reloj está parado |
| 2 | Lenguaje real | 3 | Habla como la planta; se cae en «2.3h», «regresión», «Administrador» |
| 3 | Control y libertad | 3 | Sólo lee; falta ver sólo lo lento |
| 4 | Consistencia | 2 | «2d» son 18 h aquí y 48 h en «2d estancada» (`getStale`) de la misma ventana; la misma hora sale de dos formas |
| 5 | Prevención de errores | 1 | El error es de lectura y juzga personas: Lupita en rojo por un maquilador; la pausa sin rastro |
| 6 | Reconocer, no recordar | 2 | Cada renglón se explica solo; la negrita y los colores no tienen clave |
| 7 | Flexibilidad | 1 | Al fondo, cerrado en cada orden, dos clics en la ficha |
| 8 | Estética | 2 | Limpio y alineado; ocho tonos y tres renglones de aviso cada vez |
| 9 | Recuperación de errores | 3 | Los huecos se dicen; no avisa si un regreso no trae razón |
| 10 | Ayuda | 3 | El horario va antes de los números; no explica negrita ni colores |
| **Total** | | **22/40** | **Aceptable** |

## Veredicto de especificidad

Revisor: a la medida en lo que dice, de catálogo en cómo lo acomoda. Es una crónica, y la pregunta del dueño no es cronológica. Detector: 0 hallazgos en el panel y en `tiempoPorEtapa.js`; los 227 de `App.jsx` están en otras pantallas.

## Lo que funciona

1. Validar por persona y primero, el último en negritas, sin desplazarse.
2. Cada etapa con sus pasos; lo que regresó dice por qué.
3. No inventa: «—» y «la bitácora no guardó la hora».

## Problemas prioritarios

1. **[P1] Señala a quien no la detuvo.** El nombre es el dueño del rol, no quien tiene la orden: «Proceso en Maquila · Lupita · 3d 2h» en rojo; «Printmaster 74 · turno 3 · 2d 5h» no distingue fila de impresión. Medido (180 días): Máquina es 42% de todo el tiempo; Proceso en Maquila, 54 órdenes, mediana 13 h; «Aprobación» casi no pasa (7 veces, 4 h). Arreglo: «con el maquilador · la sigue Lupita», sin rojo; en Máquina, «en turno» aparte de «en máquina» (medir qué tan completo está el dato). `/impeccable clarify`
2. **[P1] No contesta; hay que sacar la cuenta.** Sin total, sin lo que más pesó, sin suma por persona; la columna mezcla unidades. Medido: Máquina mediana 23 h (más de la mitad en rojo); Validar mediana 1.7 h, p90 5.2 h (casi nunca se prende). Arreglo: una línea arriba y en el botón cerrado, junto con el 1 y el 3. `/impeccable shape`
3. **[P1] La pausa se borra sin dejar rastro.** P-0609: del 9 al 29-oct en Salidas y dice «2d 3h». Medido: 180 de 820 órdenes (22%) con pausa, mediana 27 h de trabajo, p90 159 h; 146 de 215 son «el cliente no ha pedido factura». Arreglo: renglón propio con quién y por qué; mientras corre, desde cuándo. `/impeccable harden`
4. **[P1] Hay que ir por él, orden por orden.** Al fondo del detalle, cerrado cada vez; dos clics en la ficha. Arreglo: en el encabezado, «lleva 2d 1h en Máquina»; para Dirección arriba y abierto, y recordarlo entre órdenes. `/impeccable layout`
5. **[P2] Dos sistemas de color pelean.** El rojo significa «regresó» y «más de 2 días». Arreglo: nombre en tinta neutra, color sólo en el punto, rojo y ámbar sólo para tiempo, pastilla sólo en lo que rebasa. `/impeccable quieter`

## Por persona

- **Marcelo:** bajar y dar clic en cada orden; 7 pastillas grises en P-0726; «Salidas 2d 3h» no cuadra con sus fechas.
- **Karla y Lupita:** se ven en rojo por lo que hizo un cliente o un maquilador, sin cómo contestar.
- **Lector de pantalla y sólo teclado (deducido):** renglones sueltos, sin lista ni encabezados; la negrita de «llegó al último» no se oye; rojo y ámbar sin palabra, contra PRODUCT.md.
- **Experto con prisa:** sin atajo, el estado no se recuerda, el aviso no se pliega.

## Observaciones menores

El redondeo (P-0705: 2d 5h + 2d = 4d 6h); «<1m» con dos significados; los festivos sin descontar ni decirlo (16-nov); fechas sin día de la semana; «Administrador» en vez de quién; el ícono de reproductor de video; doble raya arriba del panel al abrirse.

## Preguntas

1. Salud Operativa ya agrupa órdenes por responsable: ¿la lista de «quién tiene qué y desde cuándo» debería vivir ahí, y este panel quedar como evidencia?
2. ¿Cuánto es mucho en Validar? Con la bitácora se puede sacar lo normal de cada etapa.
3. Un tiempo largo, ¿es de la persona o de la fila? ¿Debería llevar un «por qué» de quien tuvo la orden?

## Dónde se va el tiempo (medido, órdenes terminadas de 180 días, horas de trabajo)

Máquina 42% (mediana 22.9 h, p90 55.6) · Salidas 15% (5.0, 22.6) · Empaque 14% (4.6, 24.0) · Diseño 10% (0.0, 29.4) · Lista 6% (0.4, 11.1) · Validar 4% (1.7, 5.2) · Proceso en Maquila 3% (13.4, 53.7) · Recibida de Maquila 2% (6.6, 63.7) · CTP 2% (1.6, 8.2).
