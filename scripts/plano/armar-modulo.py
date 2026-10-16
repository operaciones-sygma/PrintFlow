# Escribe src/plano/plantaBaja.js (lo fijo de la planta baja y las máquinas como estaban) desde planta-baja.json, que sale del PDF del
# levantamiento con extraer-plano.py → maquinas.py → armar-planta.py (los cuatro en esta carpeta; el PDF, «zigma imprenta-Layout con
# maquinaria.pdf», no vive en el repo). Uso: python -I scripts/plano/armar-modulo.py <planta-baja.json> src/plano/plantaBaja.js
import sys, json, math
ENTRA, SALE = sys.argv[1], sys.argv[2]
P = json.load(open(ENTRA, encoding="utf-8"))
F = P["fondo"]
def puntos(d):
    v = [float(x) for x in d.replace("M", " ").replace("L", " ").replace("C", " ").replace("Z", " ").split()]
    return [(v[i], v[i + 1]) for i in range(0, len(v) - 1, 2)]
# el origen: la esquina de arriba a la izquierda de los muros (redondeada a 10 cm hacia afuera); todo lo demás se mide desde ahí
xs = [x for d in F["muros"] for x, _ in puntos(d)]
ys = [y for d in F["muros"] for _, y in puntos(d)]
OX, OY = math.floor(min(xs) / 10) * 10, math.floor(min(ys) / 10) * 10
ANCHO, ALTO = math.ceil((max(xs) - OX) / 10) * 10, math.ceil((max(ys) - OY) / 10) * 10
def mover(d):
    out, tok, i = [], d.split(), 0
    while i < len(tok):
        t = tok[i]
        if t in ("M", "L", "C", "Z"): out.append(t); i += 1; continue
        out.append("%g" % round(float(t) - OX, 1)); out.append("%g" % round(float(tok[i + 1]) - OY, 1)); i += 2
    return " ".join(out)
def dentro_de_la_planta(d):
    return all(-50 <= x - OX <= ANCHO + 50 and -50 <= y - OY <= ALTO + 50 for x, y in puntos(d))
GRUPOS = ["muros", "vidrios", "puertas", "fijos", "punteado", "proyeccion", "divisiones"]
fijo = {g: [mover(d) for d in F[g] if dentro_de_la_planta(d)] for g in GRUPOS}
# las dos escaleras vienen en la capa de proyección, junto con la orilla del tapanco de arriba (que no estorba): se separan por su lugar
# (cm de la planta), para que una máquina encima de una escalera salga en rojo y debajo del tapanco no
ESCALERAS = [(80, 430, 195, 710), (2170, 2180, 2310, 2500)]
def en_escalera(d):
    p = puntos(d)
    return any(all(x0 <= x <= x1 and y0 <= y <= y1 for x, y in p) for x0, y0, x1, y1 in ESCALERAS)
fijo["escaleras"] = [d for d in fijo["proyeccion"] if en_escalera(d)]
fijo["proyeccion"] = [d for d in fijo["proyeccion"] if not en_escalera(d)]
GRUPOS = GRUPOS + ["escaleras"]
areas = [{"t": a["t"], "x": round(a["x"] - OX, 1), "y": round(a["y"] - OY, 1)} for a in F["areas"]]
# las máquinas: un id que no cambia (el número del plano; las dos «Aspas» comparten el 11), el centro movido al nuevo origen
vistos = {}
maquinas = []
for m in sorted(P["maquinas"], key=lambda m: (int(m["numero"] or 0), m["x"])):
    n = m["numero"]
    vistos[n] = vistos.get(n, 0) + 1
    ident = "m-" + n + ("" if vistos[n] == 1 and sum(1 for k in P["maquinas"] if k["numero"] == n) == 1 else "abcdef"[vistos[n] - 1])
    # en cm enteros: lo de 250.2 × 570.2 es el trazo del CAD, no la máquina (y en la pantalla y la hoja «130 × 130.4» se lee como error)
    forma = [[round(a), round(b)] for a, b in m["forma"]] if m["forma"] else None
    largo = (max(a for a, _ in forma) - min(a for a, _ in forma)) if forma else round(m["largo"])
    ancho = (max(b for _, b in forma) - min(b for _, b in forma)) if forma else round(m["ancho"])
    maquinas.append({"id": ident, "nombre": m["nombre"], "numero": n, "x": round(m["x"] - OX), "y": round(m["y"] - OY),
                     "largo": largo, "ancho": ancho, "giro": m["giro"], "forma": forma})
J = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"))
with open(SALE, "w", encoding="utf-8", newline="\n") as f:
    f.write("// v10.84.119 — La planta baja de la imprenta, del levantamiento de AutoCAD («zigma imprenta-Layout con maquinaria.pdf», 1:100), en\n")
    f.write("//   centímetros desde la esquina de arriba a la izquierda de los muros. Lo FIJO (muros y columnas, ventanas, puertas, escaleras, baños,\n")
    f.write("//   las divisiones de Diseño y, aparte, lo punteado de la capa «0»: la cisterna y una raya que pasa bajo la pegadora, que no estorban)\n")
    f.write("//   y las máquinas como estaban en ese plano. Lo genera scripts/plano/armar-modulo.py: no se edita\n")
    f.write("//   a mano (un cambio del local se hace en el PDF y se vuelve a generar). Las versiones guardadas guardan sus piezas completas, así que\n")
    f.write("//   regenerar esto no mueve lo que ya se guardó.\n")
    f.write("export const CAJA = " + J({"ancho": ANCHO, "alto": ALTO}) + ";\n")
    for g in GRUPOS: f.write("export const " + g.upper() + " = " + J(fijo[g]) + ";\n")
    f.write("export const AREAS = " + J(areas) + ";\n")
    f.write("export const MAQUINAS = [\n" + ",\n".join("  " + J(m) for m in maquinas) + ",\n];\n")
print("origen", OX, OY, "caja", ANCHO, "x", ALTO, "·", {g: len(v) for g, v in fijo.items()}, "· máquinas", len(maquinas))
for m in maquinas: print("  ", m["id"], m["nombre"], m["x"], m["y"], m["largo"], "x", m["ancho"], m["giro"])
