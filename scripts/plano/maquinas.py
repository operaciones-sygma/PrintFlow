# Las máquinas del plano como piezas: cada contorno cerrado de la capa de máquinas (FORMATO_Pen_No__75) → centro, largo × ancho, giro y nombre
# (los textos que caen dentro o junto). Sólo lee trazos.json. Uso: python -I maquinas.py <salida>
import sys, json, math, os
SAL = sys.argv[1]
J = json.load(open(os.path.join(SAL, "trazos.json"), encoding="utf-8"))
def puntos(d):
    xs = [float(v) for v in d.replace("M", " ").replace("L", " ").replace("C", " ").replace("Z", " ").split()]
    return [(xs[i], xs[i + 1]) for i in range(0, len(xs) - 1, 2)]
piezas, abiertos = [], []
for t in J["capas"].get("FORMATO_Pen_No__75", []):
    pts = puntos(t["d"])
    cierra = len(pts) >= 4 and math.dist(pts[0], pts[-1]) < 1   # (AutoCAD cierra la polilínea repitiendo el primer punto, sin «h»)
    if len(pts) > 1 and math.dist(pts[0], pts[-1]) < 1: pts = pts[:-1]
    if not t["cerrado"] and not cierra: abiertos.append(pts); continue
    piezas.append(pts)
def rect(pts):
    # el giro por el lado más largo del contorno; medidas en ese marco
    lados = [(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]
    a, b = max(lados, key=lambda s: math.dist(*s))
    ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180
    if ang > 90: ang -= 180
    if abs(ang) > 45: ang = ang - 90 if ang > 0 else ang + 90   # el giro más chico (el largo puede quedar vertical)
    r = math.radians(-ang)
    loc = [(x * math.cos(r) - y * math.sin(r), x * math.sin(r) + y * math.cos(r)) for x, y in pts]
    xs, ys = [p[0] for p in loc], [p[1] for p in loc]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    r2 = math.radians(ang)
    centro = (cx * math.cos(r2) - cy * math.sin(r2), cx * math.sin(r2) + cy * math.cos(r2))
    return centro, max(xs) - min(xs), max(ys) - min(ys), ang, [(round(x - cx, 1), round(y - cy, 1)) for x, y in loc]
def dentro(pt, poly):
    x, y = pt; c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
salida = []
for pts in piezas:
    centro, w, h, ang, forma = rect(pts)
    es_rect = len(pts) == 4
    txt = [t for t in J["textos"] if dentro((t["x"], t["y"] - t["tam"] * 0.3), pts)]
    nombre = " ".join(t["t"] for t in sorted(txt, key=lambda t: (round(t["y"] / 20), t["x"])))
    salida.append({"nombre": nombre or "(sin nombre)", "x": round(centro[0], 1), "y": round(centro[1], 1), "largo": round(w, 1), "ancho": round(h, 1),
                   "giro": round(ang, 1), "forma": None if es_rect else forma, "vertices": len(pts)})
salida.sort(key=lambda m: (m["y"], m["x"]))
json.dump({"maquinas": salida, "abiertos": abiertos}, open(os.path.join(SAL, "maquinas.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for m in salida: print(f'{m["nombre"][:28]:28s} centro ({m["x"]:7.1f},{m["y"]:7.1f}) cm · {m["largo"]:6.1f} × {m["ancho"]:6.1f} cm · giro {m["giro"]:5.1f}° · {m["vertices"]} vértices')
print("líneas sueltas en la capa:", len(abiertos))
