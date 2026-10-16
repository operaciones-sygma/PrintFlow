# Saca el dibujo del plano de AutoCAD (PDF a escala 1:100) a vectores, capa por capa, en CENTÍMETROS reales y con la orientación con que se ve el
# PDF. Sólo lee el PDF. Deja trazos.json ({capa: [{d, cerrado, relleno, trazo}], textos: [{t, x, y, tam}]}) y una vista previa SVG por capa.
# Uso: python -I extraer-plano.py "<pdf>" <carpeta de salida>
import sys, json, math, os
from pypdf import PdfReader
from pypdf.generic import ContentStream, NameObject
PDF, SAL = sys.argv[1], sys.argv[2]
os.makedirs(SAL, exist_ok=True)
r = PdfReader(PDF)
p = r.pages[0]
W, H = float(p.mediabox.width), float(p.mediabox.height)
ROT = int(p.get("/Rotate", 0) or 0) % 360
PT_A_CM = 2.54 / 72 * 100          # 1 pt del papel a 1:100 = 3.5278 cm reales
props = p["/Resources"]["/Properties"].get_object()
NOMBRE = {k: str(v.get_object().get("/Name")) for k, v in props.items()}
cs = ContentStream(p.get_contents(), r)

def mul(m, n):   # m × n, matrices PDF [a b c d e f]
    a, b, c, d, e, f = m; A, B, C, D, E, F = n
    return [a*A + b*C, a*B + b*D, c*A + d*C, c*B + d*D, e*A + f*C + E, e*B + f*D + F]
def ap(m, x, y): return (m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5])
def vista(x, y):   # del espacio de la página a como se VE (la rotación de la página), en cm, con y hacia abajo
    if ROT == 90: x, y = y, x               # (90: lo que se ve tiene x = y de la página, y = x)
    elif ROT == 180: x, y = W - x, y
    elif ROT == 270: x, y = H - y, W - x
    else: y = H - y
    return (round(x * PT_A_CM, 2), round(y * PT_A_CM, 2))

ctm, pila_q, pila_capa = [1, 0, 0, 1, 0, 0], [], []
trazos, sub, actual = {}, [], []
def capa(): return next((c for c in reversed(pila_capa) if c), "(sin capa)")
def cerrar_sub():
    global actual
    if actual: sub.append(actual); actual = []
for operands, op in cs.operations:
    op = op.decode() if isinstance(op, bytes) else op
    if op == "q": pila_q.append(list(ctm))
    elif op == "Q": ctm = pila_q.pop() if pila_q else [1, 0, 0, 1, 0, 0]
    elif op == "cm": ctm = mul([float(x) for x in operands], ctm)
    elif op == "BDC":
        nm = operands[1] if len(operands) > 1 and operands[0] == NameObject("/OC") else None
        pila_capa.append(NOMBRE.get(str(nm)) if nm is not None else None)
    elif op == "BMC": pila_capa.append(None)
    elif op == "EMC":
        if pila_capa: pila_capa.pop()
    elif op == "m": cerrar_sub(); actual = [("M", ap(ctm, float(operands[0]), float(operands[1])))]
    elif op == "l": actual.append(("L", ap(ctm, float(operands[0]), float(operands[1]))))
    elif op == "c": x1, y1, x2, y2, x3, y3 = [float(x) for x in operands]; actual.append(("C", ap(ctm, x1, y1), ap(ctm, x2, y2), ap(ctm, x3, y3)))
    elif op == "v": x2, y2, x3, y3 = [float(x) for x in operands]; actual.append(("C", actual[-1][-1], ap(ctm, x2, y2), ap(ctm, x3, y3)))
    elif op == "y": x1, y1, x3, y3 = [float(x) for x in operands]; actual.append(("C", ap(ctm, x1, y1), ap(ctm, x3, y3), ap(ctm, x3, y3)))
    elif op == "h":
        if actual: actual.append(("Z",)); cerrar_sub()
    elif op == "re":
        cerrar_sub(); x, y, w, h = [float(v) for v in operands]
        sub.append([("M", ap(ctm, x, y)), ("L", ap(ctm, x + w, y)), ("L", ap(ctm, x + w, y + h)), ("L", ap(ctm, x, y + h)), ("Z",)])
    elif op in ("S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n"):
        if op in ("s", "b", "b*") and actual: actual.append(("Z",))
        cerrar_sub()
        if op != "n" and sub:
            for s in sub:
                partes = []
                for seg in s:
                    if seg[0] == "Z": partes.append("Z")
                    else: partes.append(seg[0] + " " + " ".join("%g %g" % vista(*pt) for pt in seg[1:]))
                trazos.setdefault(capa(), []).append({"d": " ".join(partes), "cerrado": s[-1][0] == "Z", "relleno": op not in ("S", "s"), "trazo": op not in ("f", "F", "f*")})
        sub = []
# los textos, con su posición (pypdf da la matriz del texto y la del dibujo)
textos = []
def visitante(t, cmx, tmx, fuente, tam):
    t = (t or "").strip()
    if not t: return
    m = mul(tmx, cmx)
    x, y = vista(m[4], m[5])
    textos.append({"t": t, "x": x, "y": y, "tam": round(abs(tam * math.hypot(m[0], m[1])) * PT_A_CM, 1)})
p.extract_text(visitor_text=visitante)
json.dump({"rotacion": ROT, "pagina_cm": [round(W * PT_A_CM), round(H * PT_A_CM)], "capas": trazos, "textos": textos}, open(os.path.join(SAL, "trazos.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("rotación de la página:", ROT, "· capas con dibujo:", len(trazos), "· trazos:", sum(len(v) for v in trazos.values()), "· textos:", len(textos))
for c, v in sorted(trazos.items(), key=lambda kv: -len(kv[1]))[:14]: print(f"  {c:26s} {len(v)}")
