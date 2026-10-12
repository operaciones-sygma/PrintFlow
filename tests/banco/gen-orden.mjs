// Banco de LA FORMA DE LA ORDEN (`OrderForm`: crear y editar), EXTRAÍDA de un App.jsx por extraer.mjs con todo lo que usa (el buscador
// de clientes, «¿ya existe?», los Pantones, las imágenes, el archivo de producción, «Replicar de orden anterior», el aviso de bajar el
// precio, el Toast). Lo que hace App al guardar NO va imitado: `create`, `update`, `addTL` y `navClick` se COPIAN de App.jsx por sus
// anclas y corren aquí, con la base simulada (si App cambia, el banco cambia con él); el montaje de la forma (`view==="form"`), los de
// las dos preguntas y el del Toast, también. Si lo copiado usa algo que el banco no sabe de dónde sale, el generador lo dice y para.
// Cada llamada a la base se anota en #log: «rpc <nombre> <args>», «saveOrder <orden>», «timeline …», «aviso <rol> …», «update <id>
// <cambios>», «storage …», «toast:<tipo>:<mensaje>», «vista:<vista>», «reload».
// Uso: node gen-orden.mjs <App.jsx> <dirSalida>
// Variantes por URL:
//   rol=secretaria|admin|vendedor|karla|preprensa|produccion (el rol de App; el login va con él: lupita, marcelo, genaro, karla…)
//   modo=nueva|editar|specs|candado|maquila|oc (editar: P-0650 de Genaro; specs: «Editar Specs»; candado: P-0645 con folio pre-asignado
//     F-140; maquila: P-0647; oc: «Agregar Producto a OC-0900»)
//   folio=ok|falla|falla1|lento (next_production_number; falla1: sólo la primera vez) · guardar=ok|falla|lento|timeline|aviso (saveOrder falla, o la orden SÍ se guarda y
//     falla la bitácora o el aviso) · cliente=nada|fuerte|parecido|exacto|falla|permiso (resolve_client_for_order) · crear=ok|falla
//     (create_client_from_printflow) · editar=ok|falla|lento (el UPDATE de la orden) · precio=normal|cobrada|timbrada|falla|lento (lo que
//     contesta pf_price_drop_check del folio de la orden: F-122 de P-0643, o F-200 de toda la OC-0950 de P-0644) ·
//     agente=ok|falla (add_client_agent) · img=ok|falla|lento (Storage) · lento=N (los segundos de lo «lento»; 4 por omisión)
// window.__cambiar({…}) cambia EN LA BASE la orden que se edita y la trae a App (como el tiempo real; la forma no se re-inicia, como en
// App); window.__estado() da {vista, editO, ordenes, base}; window.__ir(vista) es un clic en el menú lateral (el navClick de App);
// window.__editar(id, {…}) abre «Editar» de esa orden como la tenga la base (con `{_specsOnly:true}`, «Editar Specs»).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { extraer } from "./extraer.mjs";
const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const [, , srcPath, outDir] = process.argv;
const fuente = fs.readFileSync(srcPath, "utf8");
const L = fuente.replace(/\r\n/g, "\n").split("\n");
const iconos = L.find(l => /^import \{ Broadcast as BroadcastIcon/.test(l));
// v10.84.80 — el estilo global de los placeholders que App inyecta a nivel de módulo (sin él el banco medía el gris del navegador)
const estiloPlaceholder = L.some(l => l.startsWith('if(typeof document!=="undefined"&&!document.getElementById("pf-placeholder-style"))'))
  ? null : "";
if (!iconos) throw new Error("no encuentro la importación de los íconos");
// un pedazo de App por su ancla: la línea que empieza con `inicio` y, con `fin`, hasta la primera línea que empieza con `fin`
const pedazo = (inicio, fin, que) => {
  const s = L.findIndex(l => l.startsWith(inicio)); if (s < 0) throw new Error("no encuentro " + que);
  if (!fin) return L[s];
  let e = s; while (!L[e].startsWith(fin)) { if (++e > s + 700) throw new Error("sin cierre: " + que); }
  return L.slice(s, e + 1).join("\n");
};
const linea = (trozo, que) => { const l = L.find(x => x.includes(trozo)); if (!l) throw new Error("no encuentro " + que); return l.trim(); };
const placeholderGlobal = estiloPlaceholder === null ? pedazo('if(typeof document!=="undefined"&&!document.getElementById("pf-placeholder-style"))', "}", "el estilo global de los placeholders") : "";
const addTL = pedazo("  const addTL=", null, "addTL de App");
const create = pedazo("  const create=useCallback(async f=>{", "  },[", "create de App");
const update = pedazo("  const update=useCallback(async f=>{", "  },[", "update de App");
const navClick = pedazo("  const navClick=", null, "navClick de App");
// las dos preguntas de App (el cliente que ya existe y bajar el precio): el useEffect que registra window.__show…
const iHost = L.findIndex(l => l.includes("window.__showClientConfirmModal=(props)=>"));
if (iHost < 1 || !L[iHost - 1].startsWith("  useEffect(()=>{")) throw new Error("no encuentro dónde registra App las preguntas");
let fHost = iHost; while (!L[fHost].startsWith("  },[]);")) { if (++fHost > iHost + 30) throw new Error("sin cierre: las preguntas de App"); }
const preguntas = L.slice(iHost - 1, fHost + 1).join("\n");
const montaje = linea('{view==="form"&&<div><h2', "el montaje de la forma");
const montajeCliente = linea("{clientConfirmModal&&<ClientConfirmModal", "el montaje de la pregunta del cliente");
const montajePrecio = linea("{priceDropModal&&<PriceDropModal", "el montaje de la pregunta del precio");
const montajeToast = linea("{toast&&<Toast", "el montaje del Toast");
// v10.84.79 — el contenedor de las vistas y el menú lateral, COPIADOS de App: con un contenedor propio el banco medía otra forma (la app
// tenía un tope de 820 px para la forma que el banco no tenía: las dos columnas pasaban aquí y en la app no salían)
const contenedor = linea('<div style={{boxSizing:"border-box",width:"100%",maxWidth:view==="board"', "el contenedor de las vistas");
// v10.84.80 — la forma regresa a donde se abrió (la vista de origen y su desplazamiento) y el atajo N: copiados de App si los tiene
const origenForma = L.some(l => l.startsWith("  // v10.84.80 — la forma regresa a donde se abrió")) ? pedazo("  // v10.84.80 — la forma regresa a donde se abrió", "  const volverDeLaForma=", "la vista de origen de la forma") : "";
const atajos = L.some(l => l.startsWith("  // v10.65.1 — atajos de teclado")) ? pedazo("  // v10.65.1 — atajos de teclado", "  }, [user]);", "los atajos de teclado de App") : "";
const menuAncho = /width:sbPlegado\?(\d+):(\d+),flexShrink:0,height:"100vh"/.exec(fuente);
if (!menuAncho) throw new Error("no encuentro el ancho del menú lateral de App (width:sbPlegado?…:…)");
const menuUmbral = /const sbPlegado=anchoVentana<(\d+)\?/.exec(fuente);
if (!menuUmbral) throw new Error("no encuentro desde qué ancho de ventana App pliega el menú (const sbPlegado=anchoVentana<…)");

// lo que usan los pedazos copiados: lo de App lo pone el banco; lo de módulo se extrae; lo global es del navegador
const APP = new Set(["setOrders", "showToast", "reload", "setEditO", "setView", "user", "userLogin", "orders", "editO", "view", "clients",
  "create", "update", "addTL", "navClick", "toast", "setToast", "clientConfirmModal", "setClientConfirmModal", "priceDropModal", "setPriceDropModal",
  "purchaseOrders", "setDetailModalId", "ordersRef", "setPrintModal", "vistaDeOrigenRef", "scrollDeVistaRef", "vistaVivaRef", "volverDeLaForma"]);
const REACT = new Set(["React", "useState", "useEffect", "useCallback", "useMemo", "useRef", "useLayoutEffect"]);
const GLOBALES = new Set(["window", "document", "console", "Number", "String", "Error", "Set", "Map", "Date", "JSON", "Math", "Promise", "Array",
  "Object", "isNaN", "parseFloat", "parseInt", "setTimeout", "clearTimeout", "crypto", "navigator", "encodeURIComponent", "decodeURIComponent",
  "Boolean", "RegExp", "Intl", "location", "alert", "confirm", "fetch", "undefined", "NaN", "Infinity", "structuredClone", "DOMException"]);
function libres(codigo) {
  const ast = parse("function __w(){\n" + codigo + "\n}", { sourceType: "module", plugins: ["jsx"] });
  const fuera = new Set();
  traverse(ast, { "Identifier|JSXIdentifier"(p) {
    if (!p.isReferencedIdentifier() && !(p.isJSXIdentifier() && p.parentPath.isJSXOpeningElement())) return;
    const n = p.node.name;
    if (p.isJSXIdentifier() && /^[a-z]/.test(n)) return;   // etiquetas de HTML
    if (p.scope.getBinding(n)) return;
    fuera.add(n);
  } });
  return [...fuera];
}
const sueltos = libres([addTL, create, update, navClick, preguntas, origenForma, atajos, "return <>" + contenedor + montaje + "</div>" + montajeCliente + montajePrecio + montajeToast + "</>;"].join("\n"));
const delModulo = sueltos.filter(n => !APP.has(n) && !REACT.has(n) && !GLOBALES.has(n));
const RAICES = ["OrderForm", "ClientConfirmModal", "PriceDropModal", "Toast", ...delModulo];
const SIMULADOS = ["supabase", "db", "SignedImg", "firmarOrderFile", "propsArchivoFirmado", "useSignedFile", "abrirArchivoFirmado"];
const { codigo, nombres, simuladosUsados } = extraer(fuente, RAICES, { simulados: SIMULADOS });
const sinOrigen = delModulo.filter(n => !nombres.includes(n) && !SIMULADOS.includes(n));
if (sinOrigen.length) throw new Error("lo copiado de App usa algo que el banco no sabe de dónde sale: " + sinOrigen.join(", "));

const partes = [
  `import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";`,
  `import { createRoot } from "react-dom/client";`,
  iconos,
  `// ── la base, simulada (${simuladosUsados.join(", ") || "nada"}) ──
const Q = new URLSearchParams(location.search);
const ROL = Q.get("rol") || "secretaria", MODO = Q.get("modo") || "nueva";
const FOLIO = Q.get("folio") || "ok", GUARDAR = Q.get("guardar") || "ok", CLIENTE = Q.get("cliente") || "nada", CREAR = Q.get("crear") || "ok";
const EDITAR = Q.get("editar") || "ok", PRECIO = Q.get("precio") || "normal", AGENTE = Q.get("agente") || "ok", IMG = Q.get("img") || "ok";
let foliosPedidos = 0;
const LENTO_S = Number(Q.get("lento") || 4);
const LOGIN = { secretaria: "lupita", admin: "marcelo", vendedor: "genaro", karla: "karla", preprensa: "noemi", produccion: "gerardo" };
const bitacora = [];
const anotar = t => { bitacora.push(t); window.dispatchEvent(new Event("bitacora")); };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const espera = variante => dormir(variante === "lento" ? LENTO_S * 1000 : 120);
const sinConexion = { message: "upstream connect error or disconnect/reset before headers", code: "" };
const CLIENTES = [
  { id: "c-cosquim", name: "COSQUIM", rfc: "COS010101AB1", email: "compras@cosquim.mx", whatsapp: "", billing_mode: "normal", dias_credito: 30, aliases: [] },
  { id: "c-portland", name: "PORTLAND LEATHER", rfc: "PLE020202CD2", email: "", whatsapp: "", billing_mode: "normal", dias_credito: 0, aliases: [] },
  { id: "c-cuadra", name: "CUADRA BOOTS", rfc: "CBO030303EF3", email: "compras@cuadra.mx", whatsapp: "4771112233", billing_mode: "stock", dias_credito: 30, aliases: ["CUADRA"] },
  { id: "c-modelo", name: "CERVECERIA MODELO DE MEXICO", rfc: "CMM8601014G4", email: "eva@modelo.mx", whatsapp: "", billing_mode: "normal", dias_credito: 30, aliases: ["CORONA"] },
  // v10.84.80 — el parecido de «¿Quisiste decir…?», completo como lo da el buscador (la pregunta sólo trae id, nombre y RFC)
  { id: "c-papeleria", name: "PAPELERIA DEL BAJIO", rfc: "PBA040404IJ4", email: "ventas@papeleriabajio.mx", whatsapp: "4775556677", billing_mode: "normal", dias_credito: 0, aliases: [] },
];
const VENDEDOR_DE = { "c-cuadra": [{ username: "pepechuy", display_name: "Pepe Chuy" }], "c-cosquim": [{ username: "manuel", display_name: "Manuel" }] };
const CONTACTO_DE = { "c-portland": { last_email: "pedidos@portland.mx", last_phone: "", last_lada: "+52", last_rfc: "PLE020202CD2", last_company: "PORTLAND LEATHER" } };
const AGENTES_DE = { "c-cosquim": [{ id: "a1", name: "Eva", phone: "", email: "" }, { id: "a2", name: "Jorge", phone: "4779876543", email: "" }] };
const CUADRA_PRODUCTOS = [{ id: "p1", name: "Caja bota alta", sku: "CB-01", stock_actual: 1200 }, { id: "p2", name: "Etiqueta talla", sku: "ET-07", stock_actual: 0 }];
const MODELO = { id: "c-modelo", name: "CERVECERIA MODELO DE MEXICO", rfc: "CMM8601014G4", dias_credito: 30, aliases: ["CORONA"] };
const RESUELVE = {
  nada: { exact_match: null, similar_matches: [], dados_de_baja: [] },
  fuerte: { exact_match: null, similar_matches: [{ ...MODELO, motivo: "así le dicen en la casa", fuerte: true }], dados_de_baja: [] },
  parecido: { exact_match: null, similar_matches: [{ id: "c-papeleria", name: "PAPELERIA DEL BAJIO", rfc: null, dias_credito: 0, aliases: [], motivo: "se parece", fuerte: false }], dados_de_baja: [] },
  exacto: { exact_match: "c-modelo", exact_name: "CERVECERIA MODELO DE MEXICO", similar_matches: [], dados_de_baja: [] },
  // v10.84.80 — «Ya existe» por el RFC que quedó en la forma (era de otro cliente)
  rfc: { exact_match: null, similar_matches: [{ id: "c-cosquim", name: "COSQUIM", rfc: "COS010101AB1", dias_credito: 30, aliases: [], motivo: "mismo RFC", fuerte: true }], dados_de_baja: [] },
};
const IMG_URL = "https://x.supabase.co/storage/v1/object/public/order-files/OP-A1/img-1-abc.jpg";
// la base: las órdenes de verdad (lo que la base tiene); App trabaja con su copia (orders) y la recarga con reload()
const BASE = [
  { id: "OP-A1", production_number: "P-0648", client: "COSQUIM", client_id: "c-cosquim", client_company: "COSQUIM", client_email: "compras@cosquim.mx", product_type: "Etiquetas",
    product: "Etiqueta 5 x 4 cm couché adhesivo, 4 x 0", quantity: 1000, stage: "design", source: "internal", agent: "Manuel", created_by: "lupita", price: 4200,
    order_type: "interna", paper_type: "Couché adhesivo", ink_front: "4 tintas", width_cm: 5, height_cm: 4, finishes: "Suajado", image_url: IMG_URL, created_at: "2026-10-09T10:00:00Z",
    // v10.84.80 — lo que es de ESA orden (Replicar no lo copia) y lo del producto (sí)
    notes: "YA AUTORIZO PRUEBA DE COLOR", distribution: ["Sucursal Centro"], pantone_front: ["186 C"] },
  { id: "OP-A2", production_number: "P-0649", client: "COSQUIM", client_id: "c-cosquim", client_company: "COSQUIM", client_email: "compras@cosquim.mx", product_type: "Cintillos",
    product: "Cintillo set básico", quantity: 500, stage: "ctp", source: "internal", agent: "Manuel", created_by: "lupita", price: 2600, order_type: "interna", created_at: "2026-10-09T11:00:00Z" },
  { id: "OP-ED", production_number: "P-0650", client: "PORTLAND LEATHER", client_id: "c-portland", client_company: "PORTLAND LEATHER", client_email: "pedidos@portland.mx",
    product_type: "Recetarios", product: "Recetas Dr. Eduardo Fuentes", quantity: 500, stage: "draft", source: "internal", agent: "Genaro", created_by: "genaro", price: 1800,
    order_type: "interna", paper_type: "Bond", paper_grammage: 90, ink_front: "1 tinta", width_cm: 14, height_cm: 21.5, finishes: "Blocks EN BLOCKS DE 100", created_at: "2026-10-10T10:00:00Z" },
  { id: "OP-FO", production_number: "P-0645", client: "CABLESERV", client_id: "c-cableserv", client_company: "CABLESERV", client_email: "compras@cableserv.mx", product_type: "Folders",
    product: "Folder con pestaña", quantity: 3000, stage: "in_production", source: "internal", agent: "Manuel", created_by: "lupita", price: 21300, order_type: "interna",
    invoice_folio: "F-140", invoice_pre_assigned: true, invoice_type: "factura", created_at: "2026-10-05T10:00:00Z" },
  { id: "OP-MQ", production_number: "P-0647", client: "INMOBILIARIA HOTSSON", client_id: "c-hotsson", client_company: "INMOBILIARIA HOTSSON", client_email: "compras@hotsson.mx",
    product_type: "Calendarios", product: "Calendario 2027 base 41 x 21", quantity: 426, stage: "maq_created", source: "internal", agent: "Marcelo", created_by: "marcelo", order_type: "maquila",
    maq_provider: "Encuadernaciones del Bajío", maq_cost: 8000, maq_price: 12500, created_at: "2026-10-08T10:00:00Z" },
  // ya facturada con su folio (Dirección la edita), de una OC con el folio de toda la OC, y una que ya cargó al inventario
  { id: "OP-FA", production_number: "P-0643", client: "GRUPO TEXTIL LEON", client_id: "c-textil", client_company: "GRUPO TEXTIL LEON", client_email: "compras@textil.mx",
    client_rfc: "GTL050505GH5", product_type: "Etiquetas", product: "Etiqueta colgante", quantity: 1000, stage: "delivered", source: "internal", agent: "Manuel", created_by: "lupita",
    price: 2473, order_type: "interna", invoice_folio: "F-122", invoice_type: "factura", created_at: "2026-10-01T10:00:00Z" },
  { id: "OP-OC", production_number: "P-0644", client: "GOBIERNO DEL ESTADO", client_id: "c-gob", client_company: "GOBIERNO DEL ESTADO", client_email: "compras@guanajuato.gob.mx",
    client_rfc: "GEG850101AB1", product_type: "Folders", product: "Folder institucional", quantity: 2000, stage: "salidas", source: "internal", agent: "Manuel", created_by: "lupita",
    price: 30000, order_type: "interna", purchase_order_id: "OC-0950", created_at: "2026-10-02T10:00:00Z" },
  { id: "OP-ST", production_number: "P-0646", client: "CUADRA BOOTS", client_id: "c-cuadra", client_company: "CUADRA BOOTS", client_email: "compras@cuadra.mx",
    product_type: "Cajas", product: "Caja bota alta", quantity: 1000, stage: "packaging", source: "internal", agent: "Pepe Chuy", created_by: "lupita", price: 9000,
    order_type: "interna", billing_mode: "stock", stock_loaded: true, stock_role: "production", created_at: "2026-10-03T10:00:00Z" },
];
// como las de verdad (968 vivas, 12-oct): todas traen su prioridad y su lada (la forma las llena; sin ellas, «Guardar» sin tocar nada
//   parecería un cambio)
BASE.forEach(o => { o.priority = o.priority || "normal"; o.client_lada = o.client_lada || "+52"; });
const PURCHASE_ORDERS = [{ id: "OC-0950", client: "GOBIERNO DEL ESTADO", shared_invoice_folio: "F-200" }, { id: "OC-0900", client: "GOBIERNO DEL ESTADO", shared_invoice_folio: null }];
const OC = { id: "OC-0900", client: "GOBIERNO DEL ESTADO", client_id: "c-gob", client_email: "compras@guanajuato.gob.mx", client_rfc: "GEG850101AB1", vendedor: "Manuel", delivery_date: "2026-10-30" };
const RESUMEN = ["id", "production_number", "order_type", "stage", "priority", "client", "client_id", "client_email", "client_phone", "client_rfc", "client_agent", "product_type", "product",
  "quantity", "agent", "price", "maq_provider", "maq_cost", "maq_price", "due_date", "finishes", "distribution", "sin_empaque_sygma", "purchase_order_id", "plate_status", "image_url", "image_url_2", "file_url", "notes"];
const resumen = o => Object.fromEntries(RESUMEN.filter(k => k in o).map(k => [k, o[k]]));
function consulta(tabla) {
  const q = { tabla, filtros: [], accion: "select", valores: null };
  const api = {};
  ["select", "neq", "in", "is", "not", "or", "gte", "lte", "order", "limit", "range"].forEach(m => { api[m] = () => api; });
  api.eq = (c, v) => { q.filtros.push(["eq", c, v]); return api; };
  api.ilike = (c, v) => { q.filtros.push(["ilike", c, v]); return api; };
  api.update = v => { q.accion = "update"; q.valores = v; return api; };
  api.insert = v => { q.accion = "insert"; q.valores = v; return api; };
  api.upsert = v => { q.accion = "upsert"; q.valores = v; return api; };
  api.maybeSingle = api.single = () => api;
  api.then = (ok, mal) => correr(q).then(ok, mal);
  return api;
}
async function correr(q) {
  if (q.tabla === "orders" && q.accion === "update") {
    const id = (q.filtros.find(f => f[0] === "eq" && f[1] === "id") || [])[2];
    anotar("update " + id + " " + JSON.stringify(q.valores));
    await espera(EDITAR);
    if (EDITAR === "falla") return { data: null, error: sinConexion };
    const o = BASE.find(x => x.id === id); if (o) Object.assign(o, q.valores);
    return { data: null, error: null };
  }
  if (q.tabla === "orders" && q.accion === "select") {   // «Replicar de orden anterior»
    let rows = BASE.slice();
    for (const [op, c, v] of q.filtros) {
      if (op === "eq") rows = rows.filter(r => r[c] === v);
      if (op === "ilike") { const pre = String(v).replace(/%$/, "").replace(/\\\\(.)/g, "$1").toLowerCase(); rows = rows.filter(r => String(r[c] || "").toLowerCase().startsWith(pre)); }
    }
    await dormir(150);
    return { data: rows.map(r => ({ ...r })), error: null };
  }
  anotar("from " + q.tabla + " " + q.accion);
  return { data: [], error: null };
}
const supabase = {
  rpc: async (fn, args = {}) => {
    anotar("rpc " + fn + " " + JSON.stringify(args));
    if (fn === "search_clients_typeahead") { await dormir(60); const t = String(args.p_query || "").toLowerCase(); return { data: CLIENTES.filter(c => c.name.toLowerCase().includes(t)).slice(0, args.p_limit || 10), error: null }; }
    if (fn === "get_client_seller_label") return { data: VENDEDOR_DE[args.p_client_id] || null, error: null };
    if (fn === "get_last_contact_for_client") return { data: CONTACTO_DE[args.p_client_id] || null, error: null };
    if (fn === "list_client_agents") return { data: (AGENTES_DE[args.p_client_id] || []).map(a => ({ ...a })), error: null };
    if (fn === "add_client_agent") {
      await dormir(120);
      if (AGENTE === "falla") return { data: null, error: sinConexion };
      (AGENTES_DE[args.p_client_id] = AGENTES_DE[args.p_client_id] || []).push({ id: "a" + Date.now(), name: args.p_name, phone: args.p_phone || "", email: args.p_email || "" });
      return { data: null, error: null };
    }
    if (fn === "next_production_number") {
      await espera(FOLIO);
      foliosPedidos++;
      if (FOLIO === "falla" || (FOLIO === "falla1" && foliosPedidos === 1)) return { data: null, error: sinConexion };
      const n = Math.max(...BASE.map(o => parseInt(String(o.production_number || "").replace(/^P-/, ""), 10) || 0)) + 1;
      return { data: "P-" + String(n).padStart(4, "0"), error: null };
    }
    if (fn === "resolve_client_for_order") { await dormir(150); if (CLIENTE === "falla") return { data: null, error: sinConexion };
      if (CLIENTE === "permiso") return { data: null, error: { code: "42501", message: "permission denied for function resolve_client_for_order" } };
      return { data: RESUELVE[CLIENTE] || RESUELVE.nada, error: null }; }
    if (fn === "create_client_from_printflow") { await dormir(150); if (CREAR === "falla") return { data: null, error: sinConexion }; return { data: "c-nuevo", error: null }; }
    if (fn === "upsert_client_from_order") return { data: "c-nuevo", error: null };
    if (fn === "search_pantone") return { data: [{ code: "186 C", hex: "#C8102E", name: "186 C" }, { code: "286 C", hex: "#0033A0", name: "286 C" }], error: null };
    if (fn === "get_pantone_by_code") return { data: [{ code: args.p_code, hex: "#C8102E" }], error: null };
    if (fn === "validate_production_number") return { data: { valid: true }, error: null };
    return { data: null, error: null };
  },
  from: consulta,
  storage: { from: () => ({
    upload: async p => { anotar("storage upload " + p); await dormir(IMG === "lento" ? LENTO_S * 1000 : 150); return IMG === "falla" ? { data: null, error: sinConexion } : { data: { path: p }, error: null }; },
    remove: async ps => { anotar("storage remove " + ps.join(",")); return { data: null, error: null }; },
    getPublicUrl: p => ({ data: { publicUrl: "https://x.supabase.co/storage/v1/object/public/order-files/" + p } }),
    download: async p => { anotar("storage download " + p); return { data: new Blob(["x"], { type: "image/jpeg" }), error: null }; },
    createSignedUrls: async ps => ({ data: ps.map(p => ({ path: p, signedUrl: "data:," })), error: null }),
    createSignedUrl: async () => ({ data: { signedUrl: "data:," }, error: null }),
  }) },
  auth: { getSession: async () => ({ data: { session: { access_token: "falso" } } }) },
};
const db = {
  getClientBillingInfo: async () => ({ stock_pool_id: null }),
  loadClientProducts: async () => CUADRA_PRODUCTOS.map(p => ({ ...p })),
  async saveOrder(o) { anotar("saveOrder " + JSON.stringify(resumen(o))); await espera(GUARDAR); if (GUARDAR === "falla") throw new Error(sinConexion.message); BASE.unshift({ ...o }); },
  async addTimeline(id, accion) { anotar("timeline " + id + " " + accion); if (GUARDAR === "timeline") throw new Error("addTimeline: " + sinConexion.message); },
  async addNotification(rol, id, tipo, msg) { anotar("aviso " + rol + " " + tipo + " " + String(msg || "").split("\\n")[0]); if (GUARDAR === "aviso") throw new Error("addNotification: " + sinConexion.message); },
  async upsertClientFromOrder() { anotar("upsertClient"); return "c-nuevo"; },
  async checkPriceDrop(actor, id, np, nm) { anotar("check " + id + " " + np + " " + nm);
    await dormir(PRECIO === "lento" ? LENTO_S * 1000 : 150);
    if (PRECIO === "falla") throw new Error(sinConexion.message);
    const o = BASE.find(x => x.id === id); if (!o) return { aplica: false, motivo: "orden no encontrada" };
    const oc = o.purchase_order_id && PURCHASE_ORDERS.find(x => x.id === o.purchase_order_id);
    const folio = o.invoice_folio || oc?.shared_invoice_folio; if (!folio) return { aplica: false, motivo: "la orden no tiene folio" };
    const compartida = !o.invoice_folio;
    const base = x => Number(x.order_type === "maquila" ? x.maq_price : x.price) || 0;
    const nueva = o.order_type === "maquila" ? (nm ?? o.maq_price) : (np ?? o.price);
    const otras = compartida ? BASE.filter(x => x.purchase_order_id === o.purchase_order_id && x.id !== o.id).reduce((t, x) => t + base(x), 0) : 0;
    const monto = Math.round((base(o) + otras) * 116) / 100, recalculo = Math.round((Number(nueva) + otras) * 116) / 100;
    const cobrado = PRECIO === "cobrada" ? monto : 0;
    return { aplica: true, bloquea: recalculo < cobrado - 0.01, folio, monto_factura: monto, cobrado, recalculo, diferencia: Math.round((cobrado - recalculo) * 100) / 100,
      oc_compartida: compartida, cobro_conciliado: false, pagos_registrados: cobrado, timbrada: PRECIO === "timbrada" }; },
};
const propsArchivoFirmado = () => ({});
const firmarOrderFile = async src => src;
const useSignedFile = src => src;
const abrirArchivoFirmado = () => {};
function SignedImg({ alt, style }) { return <span style={{ ...style, display: "inline-block", background: "#ddd" }} aria-label={alt} />; }`,
  placeholderGlobal,
  `// ── extraído de App.jsx por extraer.mjs ──\n` + codigo,
  `// ── el banco: App, lo justo para la forma (lo que hace al guardar, copiado de App.jsx) ──
const ORDEN = id => ({ ...BASE.find(x => x.id === id) });
const editInicial = () => {
  if (MODO === "editar") return ORDEN("OP-ED");
  if (MODO === "specs") return { ...ORDEN("OP-ED"), _specsOnly: true };
  if (MODO === "candado") return { ...ORDEN("OP-FO"), _financialsLocked: true };
  if (MODO === "maquila") return ORDEN("OP-MQ");
  if (MODO === "oc") return { client: OC.client, client_id: OC.client_id, client_email: OC.client_email, client_phone: "", client_rfc: OC.client_rfc, client_agent: "",
    agent: OC.vendedor, due_date: OC.delivery_date, product_type: "Folders", purchase_order_id: OC.id, _fromOC: true };
  return null;
};
function Banco() {
  const user = ROL, userLogin = LOGIN[ROL] || ROL;
  const [orders, setOrders] = useState(() => BASE.map(o => ({ ...o })));
  const [view, setView] = useState("form");
  const [editO, setEditO] = useState(editInicial);
  const [toast, setToast] = useState(null);
  const [clientConfirmModal, setClientConfirmModal] = useState(null);
  const [priceDropModal, setPriceDropModal] = useState(null);
  const [log, setLog] = useState([]);
  useEffect(() => { const f = () => setLog([...bitacora]); window.addEventListener("bitacora", f); return () => window.removeEventListener("bitacora", f); }, []);
  const toastSeq = useRef(0);
  const showToast = useCallback((message, type = "success", action = null) => { anotar("toast:" + type + ":" + (typeof message === "string" ? message : "[jsx]")); setToast({ message, type, action, id: ++toastSeq.current }); }, []);
  const reload = useCallback(() => { anotar("reload"); setOrders(BASE.map(o => ({ ...o }))); }, []);
  const clients = [];
  const purchaseOrders = PURCHASE_ORDERS;
  const setDetailModalId = id => anotar("detalle " + id);
  const ordersRef = useRef(orders); ordersRef.current = orders;
  const setPrintModal = o => anotar("imprimir " + (o && o.id));
${preguntas}
${addTL}
${create}
${update}
${navClick}
${origenForma}
${atajos}
  useEffect(() => { anotar("vista:" + view); }, [view]);
  const vivo = useRef({}); vivo.current = { view, editO, orders, navClick };
  useEffect(() => {
    window.__estado = () => ({ vista: vivo.current.view, editO: vivo.current.editO, ordenes: vivo.current.orders, base: BASE });
    window.__ir = id => vivo.current.navClick(id);
    window.__cambiar = cambio => { const id = vivo.current.editO?.id; const o = BASE.find(x => x.id === id); if (o) Object.assign(o, cambio); setOrders(BASE.map(x => ({ ...x }))); };
    // «Editar» de una orden (como el ✏️ de la ficha: App la abre con la orden que tiene, recién leída)
    window.__editar = (id, extra = {}) => { setOrders(BASE.map(x => ({ ...x }))); setEditO({ ...BASE.find(x => x.id === id), ...extra }); setView("form"); };
  }, []);
  // el menú lateral como el de App (sus anchos y desde dónde se pliega solo); ?menu=plegado o window.__plegar(true) lo pliegan
  const [anchoVentana, setAnchoVentana] = useState(() => innerWidth);
  useEffect(() => { const f = () => setAnchoVentana(innerWidth); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);
  const [plegadoPref, setPlegadoPref] = useState(Q.get("menu") === "plegado");
  useEffect(() => { window.__plegar = v => setPlegadoPref(!!v); }, []);
  const sbPlegado = anchoVentana < ${menuUmbral[1]} ? true : plegadoPref;
  return <div style={{ display: "flex", background: C.canvas, minHeight: "100vh" }}>
    <div id="lateral" style={{ width: sbPlegado ? ${menuAncho[1]} : ${menuAncho[2]}, flexShrink: 0, height: "100vh", position: "sticky", top: 0, overflow: "hidden", borderRight: "0.5px solid #ddd" }}>
      <nav id="menu" style={{ display: "flex", flexDirection: "column", gap: 6, padding: 6 }}>
        {[["pipeline", "Dashboard"], ["form", "Nueva"], ["orders", "Todas"]].map(([id, t]) => <button key={id} id={"ir-" + id} title={t} style={{ fontSize: 10, overflow: "hidden", whiteSpace: "nowrap" }} onClick={() => navClick(id)}>{t}</button>)}
      </nav>
    </div>
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div id="barra" style={{ height: 57, flexShrink: 0, borderBottom: "0.5px solid #ddd" }}/>
      ${contenedor}
        {view !== "form" && <div id="fuera" data-vista={view} style={{ padding: 20, minHeight: 3000 }}>Vista: {view}</div>}
        ${montaje}
        <pre id="log" style={{ fontSize: 10, color: "#666", maxHeight: 140, overflow: "auto" }}>{log.join("\\n")}</pre>
      </div>
    </div>
    ${montajeCliente}
    ${montajePrecio}
    ${montajeToast}
  </div>;
}
createRoot(document.getElementById("root")).render(<Banco />);`,
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "banco.jsx"), partes.join("\n\n"), "utf8");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>banco orden</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap">
<style>body{margin:0;font-family:'Geist',sans-serif}*{box-sizing:border-box}@keyframes toastIn{from{opacity:0}to{opacity:1}}</style></head><body><div id="root"></div><script type="module" src="./banco.jsx"></script></body></html>`, "utf8");
// el archivo de producción sube por XHR a VITE_SUPABASE_URL: aquí es el propio banco («/__storage», contesta 200), nunca Supabase
fs.writeFileSync(path.join(outDir, ".env"), "VITE_SUPABASE_URL=/__storage\nVITE_SUPABASE_ANON_KEY=falsa\n", "utf8");
fs.writeFileSync(path.join(outDir, "vite.config.mjs"), `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
const raiz = path.dirname(fileURLToPath(import.meta.url));
const storageFalso = { name: "storage-falso", configureServer(s) { s.middlewares.use("/__storage", (req, res) => {
  req.on("data", () => {}); req.on("end", () => { res.statusCode = 200; res.setHeader("content-type", "application/json"); res.end('{"Key":"order-files/simulado"}'); }); }); } };
export default defineConfig({ root: raiz, envDir: raiz, plugins: [react(), storageFalso], server: { port: Number(process.env.BANCO_PORT || 5188), strictPort: true } });
`, "utf8");
console.log("banco de la orden listo en " + outDir + " (" + simuladosUsados.length + " simulados; de módulo para lo copiado: " + delModulo.join(", ") + ")");
