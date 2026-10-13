// v10.84.91 — LA CATEGORÍA DEL TRABAJO (Marcelo, 12/13-oct: «Categoría nueva aparte», de lista cerrada, que alimenta Analytics; el
// campo de hoy, `product_type`, se queda como el nombre del trabajo). Las reglas viven AQUÍ, una sola vez: la forma sugiere con
// `categoriaSugerida` y la base clasifica (la historia, una vez, y lo que llegue sin categoría) con el SQL que `reglasSql` genera de
// estas mismas reglas (scripts/categorias-sql.mjs). La tanda `categorias` compara las dos sobre todos los nombres de la base.
//
// Mini-sintaxis de los patrones (para escribirlos una vez y traducirlos a JavaScript y a PostgreSQL):
//   ⟨ … ⟩  principio y fin de palabra (con acentos: «TRÍPTICO»; «POPOTE» no es «POP»)
//   ~      letras o números que siguen (como \w* de PostgreSQL, que cuenta las acentuadas)
//   lo demás es una expresión regular común: [OÓ], (ES)?, S?, |, ( ), espacios literales. El texto llega en MAYÚSCULAS.
// El ORDEN es la prioridad: gana la primera regla que coincide («HOJAS MEMBRETADAS» es papelería antes que formas).

export const CATEGORIAS = [
  { codigo: "etiquetas", nombre: "Etiquetas y stickers" },
  { codigo: "folletos", nombre: "Folletos, trípticos y volantes" },
  { codigo: "pop", nombre: "Material POP y carteles" },
  { codigo: "formas", nombre: "Formas, talonarios y formatos" },
  { codigo: "lonas", nombre: "Lonas y gran formato" },
  { codigo: "papeleria", nombre: "Papelería corporativa" },
  { codigo: "libros", nombre: "Libros, revistas y manuales" },
  { codigo: "cuponeras", nombre: "Cuponeras y boletos" },
  { codigo: "libretas", nombre: "Libretas, cuadernos y agendas" },
  { codigo: "empaques", nombre: "Cajas y empaques" },
  { codigo: "invitaciones", nombre: "Invitaciones, tarjetas y diplomas" },
  { codigo: "calendarios", nombre: "Calendarios" },
  { codigo: "otro", nombre: "Otro" },
];
export const CODIGOS_CATEGORIA = CATEGORIAS.map(c => c.codigo);
export const nombreDeCategoria = codigo => (CATEGORIAS.find(c => c.codigo === codigo) || {}).nombre || null;

// La venta de inventario (Cuadra: `sell_from_stock` pone «stock» en el nombre) no es un producto: es un canal y no lleva categoría.
export const esVentaDeInventario = nombre => /^\s*STOCK\s*$/i.test(String(nombre || ""));

export const REGLAS = [
  { codigo: "etiquetas", patron: "⟨(ETIQUET~|STICKERS?|ADHERIBLES?|CALCOMAN~|HOLOGRAM~|CINTILLOS?|MARBETES?)⟩|C[OÓ]DIGOS? DE BARRAS|IMG0" },
  { codigo: "lonas", patron: "⟨(LONAS?|VINIL(ES)?|ROLL ?UPS?|BANNERS?|MANTAS?|MICROPERFORADOS?|COROPLAST|ESTIRENO|GRAN FORMATO|PEND[OÓ]N(ES)?|TROVICEL|PLOTTER)⟩" },
  { codigo: "pop", patron: "⟨(POP|TENT ?CARDS?|DISPLAYS?|P[OÓ]STERS?|CENEFAS?|DANGLERS?|HABLADOR(ES)?|COPETES?|STOPPERS?|EXHIBIDOR(ES)?|SOPORTES?|PRECIADOR(ES)?|MANTELETAS?|TABLOIDES?|CARTEL(ES)?|LETREROS?|IMAN(ES)?|MEN[UÚ]S?)⟩" },
  { codigo: "folletos", patron: "⟨(FOLLETOS?|TR[IÍ]PTICOS?|D[IÍ]PTICOS?|VOLANTES?|FLYERS?|FLAYERS?|BROCHURES?|INSERTOS?|INSERT|C[OÓ]MICS?|POL[IÍ]PTICOS?|CUADR[IÍ]PTICOS?|INSTRUCTIVOS?|SEPARADOR(ES)?)⟩" },
  { codigo: "calendarios", patron: "⟨CALENDARIOS?⟩" },
  { codigo: "libretas", patron: "⟨(LIBRETAS?|CUADERNOS?|AGENDAS?|PLANNERS?)⟩" },
  { codigo: "libros", patron: "⟨(LIBROS?|REVISTAS?|ANUARIOS?|MANUAL(ES)?|CUADERNILLOS?|GACETAS?|PERI[OÓ]DICOS?|BOLET[IÍ]N(ES)?|CAT[AÁ]LOGOS?|CAR[AÁ]TULAS?|CONTRACAR[AÁ]TULAS?|M[OÓ]DULOS?)⟩|C[OÓ]DIGO DE ([EÉ]TICA|CONDUCTA)|⟨POL[IÍ]TICA" },
  { codigo: "empaques", patron: "⟨(CAJAS?|EMPAQUES?|ESTUCHES?|BOLSAS?|SOLAPAS?|FAJILLAS?|ENVOLTURAS?|CARTERITAS?|CONOS?|KRAFT)⟩" },
  { codigo: "cuponeras", patron: "⟨(CUPONERAS?|CUPONES|CUP[OÓ]N|BOLETOS?|PORTABOLETOS?|RIFAS?|PASES?|ESTACIONAMIENTO|ENTRADAS)⟩" },
  { codigo: "papeleria", patron: "⟨(MEMBRETAD~|SOBRES?|FOLDERS?|CARPETAS?|GAFET~|PAPELER[IÍ]AS?)⟩|TARJETAS? DE PRESENTACI" },
  { codigo: "formas", patron: "⟨(REMISI~|RECIBOS?|FACTURAS?|PAGAR[EÉ]S?|VALES?|NOTAS?|TALONARIOS?|BLOCKS?|BLOCS?|FORMATOS?|FOTMATOS?|CONTRATOS?|SOLICITUD(ES)?|REQUISICI~|BIT[AÁ]CORAS?|CHECK~|BOLETAS?|FORMAS?|PEDIDOS?|PLANILLAS?|CONTROL(ES)?|RECETA~|HISTORIA~|FICHAS?|RELACI~|DESGLOSES?|RETIROS?|REPORTES?|EXPEDIENTES?|COMANDAS?|LECTURAS?|SALIDAS?|AUTORIZACI~|CARNETS?|LICENCIAS?|REGISTROS?|ENCUESTAS?|EVALUACI~|ACUSES?|COMPROBANTES?|INVENTARIOS?|HOJAS?|MEMOR[AÁ]NDUMS?)⟩|ORDEN(ES)? DE" },
  { codigo: "invitaciones", patron: "⟨(INVITACI~|TARJET~|POSTAL(ES)?|CONSTANCIAS?|DIPLOMAS?|RECONOCIMIENTOS?|CERTIFICADOS?|ACTAS?|CARTAS?|ESTAMPAS?)⟩" },
];

// el nombre como lo leen las reglas: sin la marca de las importadas atrasadas y en mayúsculas
export const textoDeReglas = nombre => String(nombre || "").replace(/^🔴 ATRASADA · /, "").toUpperCase();

const aJs = p => new RegExp(p.replace(/⟨/g, "(?<![\\p{L}\\p{N}_])").replace(/⟩/g, "(?![\\p{L}\\p{N}_])").replace(/~/g, "[\\p{L}\\p{N}_]*"), "u");
const REGLAS_JS = REGLAS.map(r => ({ codigo: r.codigo, re: aJs(r.patron) }));

// La categoría que sugieren las reglas para un nombre de trabajo, o null si ninguna (la venta de inventario tampoco lleva).
export function categoriaSugerida(nombre) {
  if (esVentaDeInventario(nombre)) return null;
  const t = textoDeReglas(nombre);
  if (!t.trim()) return null;
  const r = REGLAS_JS.find(x => x.re.test(t));
  return r ? r.codigo : null;
}

// Las mismas reglas en PostgreSQL (\m y \M son principio y fin de palabra; \w cuenta las letras acentuadas), para generar el SQL.
export const aSql = p => p.replace(/⟨/g, "\\m").replace(/⟩/g, "\\M").replace(/~/g, "\\w*");
export const reglasSql = () => REGLAS.map(r => ({ codigo: r.codigo, patron: aSql(r.patron) }));
