# Arma lo que usa la vista «Planta» de PrintFlow, sólo la PLANTA BAJA: el fondo fijo (muros, puertas, vidrios, fijos, cisterna, las divisiones de
# diseño, los nombres de las áreas y, aparte, cotas y ejes) y las máquinas como piezas (centro, largo × ancho, giro, forma si no es rectángulo),
# en cm desde la esquina de arriba a la izquierda de la planta. Uso: python -I armar-planta.py salida
import sys, json, os, math
SAL = sys.argv[1]
J = json.load(open(os.path.join(SAL, "trazos.json"), encoding="utf-8"))
M = json.load(open(os.path.join(SAL, "maquinas.json"), encoding="utf-8"))
X0, Y0, X1, Y1 = 700, 1450, 4720, 4650          # la planta baja (con sus cotas y ejes), en cm del papel
def pts(d):
    v = [float(x) for x in d.replace("M", " ").replace("L", " ").replace("C", " ").replace("Z", " ").split()]
    return [(v[i], v[i + 1]) for i in range(0, len(v) - 1, 2)]
def adentro(d):
    p = pts(d)
    return bool(p) and all(X0 <= x <= X1 and Y0 <= y <= Y1 for x, y in p)
def mover(d):   # al origen de la planta, con 1 decimal
    out, tok = [], d.split()
    i = 0
    while i < len(tok):
        t = tok[i]
        if t in ("M", "L", "C", "Z"): out.append(t); i += 1; continue
        out.append("%g" % round(float(t) - X0, 1)); out.append("%g" % round(float(tok[i + 1]) - Y0, 1)); i += 2
    return " ".join(out)
GRUPOS = {"muros": ["NTR-muros", "C01 calidad de muro", "A04 muros", "Estructura"], "puertas": ["NTR-puertas"], "vidrios": ["NTR-vidrios"],
          "fijos": ["A-MUEB- FIJOS", "A-MUEB", "A-MUEB-FAUX"], "punteado": ["0"], "proyeccion": ["A13 proyeccion", "NTR-piso", "A03 niveles"],
          "cotas": ["NTR-cotas", "NTR- COTAS", "COTASYTEXTOS"], "ejes": ["NTR-ejes"]}
fondo = {g: [mover(t["d"]) for c in capas for t in J["capas"].get(c, []) if adentro(t["d"])] for g, capas in GRUPOS.items()}
# las divisiones de diseño (líneas sueltas de la capa de máquinas): fijas
fondo["divisiones"] = ["M " + " L ".join("%g %g" % (round(x - X0, 1), round(y - Y0, 1)) for x, y in a) for a in M["abiertos"] if len(a) == 2]
# los nombres de las áreas (no los de las máquinas ni las cotas)
AREAS = {"almacen": "Almacén", "cisterna": "Cisterna", "diseño": "Diseño", "oficinas": "Oficinas", "gerardo": "Gerardo", "wc": "WC", "site": "Site"}
fondo["areas"] = [{"t": AREAS[t["t"].lower()], "x": round(t["x"] - X0, 1), "y": round(t["y"] - Y0, 1)} for t in J["textos"]
                  if t["t"].lower() in AREAS and X0 <= t["x"] <= X1 and Y0 <= t["y"] <= Y1]
# las cotas con su texto (los números de medida dentro de la planta)
fondo["textos_cotas"] = [{"t": t["t"], "x": round(t["x"] - X0, 1), "y": round(t["y"] - Y0, 1), "tam": t["tam"]} for t in J["textos"]
                         if X0 <= t["x"] <= X1 and Y0 <= t["y"] <= Y1 and all(ch in "0123456789." for ch in t["t"]) and "." in t["t"]]
fondo["ejes_textos"] = [{"t": t["t"], "x": round(t["x"] - X0, 1), "y": round(t["y"] - Y0, 1)} for t in J["textos"]
                        if t["t"] in ("A", "B", "1", "2") and X0 <= t["x"] <= X1 and Y0 <= t["y"] <= Y1 and t["tam"] > 30]
fondo["ancho"], fondo["alto"] = X1 - X0, Y1 - Y0
# las máquinas, con su nombre de la planta (número del plano entre paréntesis) y las que comparten número
NOMBRES = {"2 PM-74": ("PM-74", "2"), "TREN 3": ("Tren", "3"), "5": ("Guillotina 78", "5"), "1": ("GTO-1", "1"), "6": ("Guillotina 115", "6"),
           "(sin nombre)": ("Aspas", "11"), "11": ("Aspas", "11"), "GTO-4 8": ("GTO-4", "8"), "9": ("Cilíndrica", "9"), "13 CTP": ("CTP", "13"),
           "FOIL 10": ("Foil", "10"), "7 PEGADORA": ("Pegadora", "7")}
piezas = []
for m in M["maquinas"]:
    nom = m["nombre"]
    if nom.endswith("12"): n, num = "Duplo", "12"
    elif nom == "4": continue                     # la parte larga de la dobladora: va junto con su cuerpo (abajo)
    else: n, num = NOMBRES.get(nom, (nom, ""))
    piezas.append({"nombre": n, "numero": num, "x": round(m["x"] - X0, 1), "y": round(m["y"] - Y0, 1), "largo": m["largo"], "ancho": m["ancho"],
                   "giro": m["giro"], "forma": m["forma"]})
# la dobladora (4): su parte larga (120 × 440) + su cuerpo (el dibujo de 3 lados, 270 × 350), una sola pieza en «L»
largo4 = next(m for m in M["maquinas"] if m["nombre"] == "4")
cuerpo = next(a for a in M["abiertos"] if len(a) == 5)
xs, ys = [p[0] for p in cuerpo], [p[1] for p in cuerpo]
cx0, cx1, cy0, cy1 = min(xs), max(xs), min(ys), max(ys)
lx0, lx1, ly0 = largo4["x"] - largo4["largo"] / 2, largo4["x"] + largo4["largo"] / 2, largo4["y"] - largo4["ancho"] / 2
poly = [(lx0, ly0), (lx1, ly0), (lx1, cy0), (cx1, cy0), (cx1, cy1), (cx0, cy1)]
bx0, bx1, by0, by1 = min(p[0] for p in poly), max(p[0] for p in poly), min(p[1] for p in poly), max(p[1] for p in poly)
cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
piezas.append({"nombre": "Dobladora", "numero": "4", "x": round(cx - X0, 1), "y": round(cy - Y0, 1), "largo": round(bx1 - bx0, 1), "ancho": round(by1 - by0, 1),
               "giro": 0, "forma": [(round(x - cx, 1), round(y - cy, 1)) for x, y in poly]})
# el tren, igual: su forma relativa al centro de su caja ya viene de maquinas.json
for p in piezas:
    if p["forma"]: p["forma"] = [[round(a, 1), round(b, 1)] for a, b in p["forma"]]
json.dump({"fondo": fondo, "maquinas": piezas}, open(os.path.join(SAL, "planta-baja.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("fondo:", {k: (len(v) if isinstance(v, list) else v) for k, v in fondo.items()})
for p in piezas: print(f'  {p["nombre"]:15s} n.º {p["numero"]:3s} ({p["x"]:7.1f},{p["y"]:7.1f}) {p["largo"]:6.1f} × {p["ancho"]:6.1f} giro {p["giro"]:5.1f}{" forma " + str(len(p["forma"])) if p["forma"] else ""}')
