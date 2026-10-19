---
target: el marco de PrintFlow (la barra de arriba y el menú lateral)
total_score: 25
p0_count: 0
p1_count: 0
timestamp: 2026-10-19T09-25-00Z
slug: src-app-jsx-shell-navegaci-n
---
# /impeccable critique — EL MARCO DE PRINTFLOW (la barra de arriba y el menú lateral)

`App` (src/App.jsx ~23880-23935): lo que rodea a todas las vistas, para los 8 roles. La crítica anterior era del 23-jun (33/40); desde entonces le
crecieron entradas (Planta, Datos Pendientes con su número, el sol del Despertador, el Apartado Corona). 19-oct-2026, madrugada (Marcelo dormido,
con autonomía hasta las 12:00).

Escena: Gerardo en el monitor del piso y Lupita en la laptop abren PrintFlow; cada pantalla que ven trae el mismo marco. Visto con las capturas del
recorrido de producción de esa noche (los 8 roles a 1366, la app real con la cuenta de pruebas visor) y el código; medido en la base (30 días): el
Inventario Cuadra lo movieron Karla (43 ventas, 4 ajustes) y Dirección (4 producciones); **Gerardo y Lupita, 0**. Evaluación A antes de la B. Sin
subagentes.

## Calificación (Nielsen)

| # | Heurística | Cal. | Lo principal |
|---|-----------|------|--------------|
| 1 | Estado del sistema | 3 | el punto de conexión, los conteos del menú, la campana |
| 2 | El mundo real | 2 | la paleta se llama «Ctrl K»; el sol con un número sin palabra; «Mis Órdenes» sin decir de quién |
| 3 | Control y libertad | 3 | el menú se pliega; «Salir» a la vista |
| 4 | Consistencia | 2 | tres botones llenos de color junto a la campana tenue; el color de una etapa puesto en una herramienta |
| 5 | Prevención de errores | 3 | salir con algo capturado pregunta (v10.84.78) |
| 6 | Reconocer, no recordar | 2 | cubo, cartera y flecha sin palabra |
| 7 | Flexibilidad y eficiencia | 3 | Ctrl K, el buscador, el menú plegable |
| 8 | Estética y minimalismo | 2 | lo más llamativo de la pantalla es lo que menos se usa |
| 9 | Recuperarse de errores | 3 | sin lectura, el punto dice «No se pudo leer» |
| 10 | Ayuda | 2 | lo que hace cada ícono sólo en el title |
| **Total** | | **25/40** | **Aceptable** |

## ¿Parece hecho por IA?

No: es el marco de una herramienta de piso, con sus secciones y sus conteos. Lo que desentona es una fila de tres botones de color lleno, sólo con
ícono, que se lee como una barra de «acciones rápidas» genérica.

**Detector (CLI):** `detect.mjs` sobre App.jsx: 6 hallazgos; en el marco, la `transition: width` del menú (las otras: Arial de la hoja impresa, Geist,
otra transición de `width`). **En la página** (producción, como Lupita, metido por el depurador: la página es https y un script por http no carga;
sin ventana para ti): 7, 2 en el marco: la misma `transition: width` y «una sola letra» (Geist, la de la casa: falso positivo). No vio lo grande: el
peso de los tres botones de color ni los letreros que no dicen qué hacen.

## Problemas principales

- **[P2] Tres botones llenos de color, sólo con ícono** (Inventario Cuadra verde, Apartado Corona turquesa, Exportar CSV pizarra): lo más saturado de
  cada pantalla, sin palabra, y a Gerardo y a Lupita, que no los usan. **Arreglo:** teñidos (no llenos), con su palabra desde 1200 px de ancho
  («Inventario», «Corona», «CSV»), el nombre completo para el lector de pantalla como hoy. /impeccable quieter.
- **[P2] La paleta se anuncia con su atajo**: «Ctrl K» al lado de «Buscar orden…»; lo que hace («Comandos y navegación») sólo en el title.
  **Arreglo:** «Ir a…» con el atajo al lado. /impeccable clarify.
- **[P3]** El sol con un número («17»): «Tus pendientes de hoy» sólo en el title; su color fijo (#b45309). **Arreglo:** «17 hoy», en su tinta.
- **[P3]** La transición de `width` del menú (anima una propiedad de acomodo: cada cuadro recalcula todo). **Arreglo:** sin animar el ancho.
- **[P3]** «Mis Órdenes | Todas» a 10 px.

## Personas

- **Gerardo** (piso): un cubo verde lleno en cada pantalla que nunca usa; un sol con «17».
- **Lupita** (laptop): «Ctrl K» que no dice qué es; tres íconos de color sin palabra.
- **Karla** (la que sí usa el inventario y Corona): sabe qué son; le basta con la palabra.

## Lo que funciona

1. **El menú por secciones** (Operación, Comercial, Control, Registros) con sus conteos, y sólo lo de cada rol.
2. **El punto de conexión** dice si lo que se ve está en tiempo real o de cuándo es.
3. **La paleta** (Ctrl K) llega a todo sin el mouse.
