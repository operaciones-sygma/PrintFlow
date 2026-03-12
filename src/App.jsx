import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

// ═══ SUPABASE CONNECTION ═══
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const LOGO="data:image/png;base64,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";
// PRINTFLOW v7 — Compact Build
const MACHINES=[{id:"pp_ctp",name:"CTP",type:"preprensa",status:"active",sub:"Placas"},{id:"pp_proc",name:"Procesadora",type:"preprensa",status:"active",sub:"Limpieza"},{id:"off_pm74",name:"Printmaster 74",type:"offset",status:"active",sub:"Offset"},{id:"off_pm52",name:"Printmaster 52",type:"offset",status:"active",sub:"Offset"},{id:"off_gto",name:"GTO 1 Color",type:"offset",status:"active",sub:"1 torre"},{id:"dig_xerox252",name:"DocuColor 252",type:"digital",status:"active",sub:"Digital"},{id:"dig_xerox700",name:"CP 700",type:"digital",status:"inactive",sub:"No sirve"},{id:"dig_epson",name:"Epson P7570",type:"digital",status:"active",sub:"Pruebas"},{id:"ac_mm",name:"Müller Martini",type:"acabados",status:"active",sub:"Grapado"},{id:"ac_polar78",name:"Polar 78",type:"acabados",status:"active",sub:"Guillotina"},{id:"ac_polar115",name:"Polar 115",type:"acabados",status:"active",sub:"Guillotina"},{id:"ac_baum_lib",name:"Baumfolder",type:"acabados",status:"active",sub:"Dobladora"},{id:"ac_suaj_cil",name:"Cilíndrica",type:"acabados",status:"active",sub:"Suajadora"},{id:"ac_aspa1",name:"Aspa #1",type:"acabados",status:"active",sub:"Suajadora"},{id:"ac_aspa2",name:"Aspa #2",type:"acabados",status:"active",sub:"Suajadora"},{id:"ac_manual1",name:"Manual #1",type:"acabados",status:"active",sub:"Manual"},{id:"ac_manual2",name:"Manual #2",type:"acabados",status:"active",sub:"Manual"},{id:"ac_horizon",name:"Horizon BQ-4GO",type:"acabados",status:"active",sub:"Pegadora"},{id:"ac_duplo",name:"Duplo Trimmer",type:"acabados",status:"active",sub:"Compaginadora"}];
const PTYPES=["Etiqueta colgante","Etiqueta adherible","Póster","Flyer / Volante","Catálogo","Revista","Libro","Folleto","Tarjeta de presentación","Papelería corporativa","Empaque","Otro"];
const PRIOS=[{id:"urgente",l:"🔴 Urgente",c:"#ff3b30"},{id:"normal",l:"🟡 Normal",c:"#ff9500"},{id:"baja",l:"🟢 Baja",c:"#34c759"}];
const PM=Object.fromEntries(PRIOS.map(p=>[p.id,p]));
const INT_FLOW=[{id:"draft",l:"📝 Validar",c:"#aeaeb2",who:"both"},{id:"design",l:"🎨 Diseño",c:"#ec4899",who:"preprensa"},{id:"proof_printing",l:"🖨️ Prueba",c:"#8b5cf6",who:"preprensa"},{id:"proof_client",l:"👤 Aprobación",c:"#f59e0b",who:"preprensa"},{id:"ctp",l:"💿 CTP",c:"#0891b2",who:"preprensa"},{id:"ready",l:"✅ Lista",c:"#34c759",who:"produccion"},{id:"in_production",l:"⚙️ Máquina",c:"#ff9500",who:"produccion"},{id:"maquila_out",l:"🚚 Maquila",c:"#e67e22",who:"produccion"},{id:"maquila_in",l:"📥 De Maquila",c:"#32ade6",who:"produccion"},{id:"packaging",l:"📦 Empaque",c:"#af52de",who:"produccion"},{id:"delivered",l:"✅ Entregada",c:"#34c759",who:null}];
const MAQ_FLOW=[{id:"maq_created",l:"📋 Creada",c:"#aeaeb2",who:"secretaria"},{id:"maq_sent",l:"🚚 Enviada",c:"#e67e22",who:"secretaria"},{id:"maq_in_progress",l:"⚙️ Proceso",c:"#ff9500",who:"secretaria"},{id:"maq_received",l:"📥 Recibida",c:"#32ade6",who:"secretaria"},{id:"maq_delivered",l:"✅ Entregada",c:"#34c759",who:null}];
const ALL_S=[...INT_FLOW,...MAQ_FLOW];
const SM=Object.fromEntries(ALL_S.map(s=>[s.id,s]));

const gid=()=>"OP-"+Date.now().toString(36).toUpperCase()+Math.random().toString(36).substring(2,5).toUpperCase();
const fmt=n=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(n||0);
const fD=d=>d?new Date(d).toLocaleDateString("es-MX",{day:"2-digit",month:"short"}):"";
const fDT=d=>d?new Date(d).toLocaleDateString("es-MX",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"";
const pct=(c,p)=>p>0?Math.round(((p-c)/p)*100):0;
const fmtM=m=>{if(!m&&m!==0)return "—";const h=Math.floor(m/60);return h>0?h+"h "+(m%60)+"m":m+"m"};
const ld=async(k,fb)=>{try{const r=localStorage.getItem(k);return r?JSON.parse(r):fb}catch{return fb}};
const sv=async(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};

// ═══ SUPABASE DATA LAYER ═══
const db = {
  async loadOrders() {
    const { data: orders } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (!orders) return [];
    if (orders.length === 0) return [];
    // Load related data for each order
    const ids = orders.map(o => o.id);
    const [tl, cm, wl, ml] = await Promise.all([
      supabase.from("order_timeline").select("*").in("order_id", ids).order("created_at"),
      supabase.from("order_comments").select("*").in("order_id", ids).order("created_at"),
      supabase.from("order_waste").select("*").in("order_id", ids).order("created_at"),
      supabase.from("order_machine_log").select("*").in("order_id", ids).order("started_at"),
    ]);
    return orders.map(o => ({
      ...o,
      timeline: (tl.data || []).filter(t => t.order_id === o.id).map(t => ({ action: t.action, date: t.created_at, by: t.by_user, color: t.color })),
      comments: (cm.data || []).filter(c => c.order_id === o.id).map(c => ({ text: c.text, by: c.by_user, date: c.created_at })),
      waste_log: (wl.data || []).filter(w => w.order_id === o.id).map(w => ({ qty: w.qty, pliegos: w.pliegos, note: w.note, date: w.created_at })),
      machine_log: (ml.data || []).filter(m => m.order_id === o.id).map(m => ({ machine: m.machine_id, started: m.started_at, ended: m.ended_at, minutes: m.minutes, _id: m.id })),
    }));
  },
  async saveOrder(o) {
    const { timeline, comments, waste_log, machine_log, ...row } = o;
    // Map field names for DB
    const dbRow = { ...row, delivered_at: o.deliveredAt || o.delivered_at };
    delete dbRow.deliveredAt;
    await supabase.from("orders").upsert(dbRow);
  },
  async addTimeline(orderId, action, byUser, color) {
    await supabase.from("order_timeline").insert({ order_id: orderId, action, by_user: byUser, color });
  },
  async addComment(orderId, text, byUser) {
    await supabase.from("order_comments").insert({ order_id: orderId, text, by_user: byUser });
  },
  async addWaste(orderId, pliegos, qty, note) {
    await supabase.from("order_waste").insert({ order_id: orderId, pliegos, qty, note });
  },
  async addMachineLog(orderId, machineId) {
    await supabase.from("order_machine_log").insert({ order_id: orderId, machine_id: machineId });
  },
  async closeMachineLog(orderId) {
    const { data } = await supabase.from("order_machine_log").select("*").eq("order_id", orderId).is("ended_at", null).limit(1);
    if (data && data[0]) {
      const started = new Date(data[0].started_at);
      const ended = new Date();
      const minutes = Math.round((ended - started) / 60000);
      await supabase.from("order_machine_log").update({ ended_at: ended.toISOString(), minutes }).eq("id", data[0].id);
    }
  },
  async login(username, password) {
    const { data } = await supabase.from("users").select("*").eq("username", username).eq("password_hash", password).eq("active", true).single();
    return data;
  },
};
const hoursAgo=d=>d?Math.round((Date.now()-new Date(d).getTime())/3600000):0;
const recProof=o=>(o.paper_type||"").toLowerCase().includes("couch");
const prioSort=(a,b)=>{const p={urgente:0,normal:1,baja:2};return(p[a.priority]??1)-(p[b.priority]??1)};
const getStale=o=>{if(o.stage.includes("delivered"))return null;const last=o.timeline?.length>0?o.timeline[o.timeline.length-1].date:o.created_at;const h=hoursAgo(last);if(h>=48)return{lv:"critical",lb:Math.floor(h/24)+"d estancada"};if(h>=24)return{lv:"warning",lb:h+"h sin avance"};return null};
const getProgress=o=>{const flow=o.order_type==="maquila"?MAQ_FLOW:INT_FLOW;const idx=flow.findIndex(s=>s.id===o.stage);return{cur:idx+1,tot:flow.length,pct:Math.round(((idx+1)/flow.length)*100)}};

const C={bg:"#ffffff",sf:"#f8f8fa",bd:"#ebebef",tx:"#1c1c1e",t2:"#86868b",t3:"#aeaeb2",ph:"#c7c7cc",ac:"#546e7a",acL:"rgba(84,110,122,0.08)",ok:"#34c759",wn:"#ff9500",dn:"#ff3b30"};
const FNT="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap";
const inp={width:"100%",padding:"10px 14px",fontFamily:"'Poppins',sans-serif",fontSize:13,border:"none",borderRadius:12,background:"#fff",color:C.tx,boxSizing:"border-box",outline:"none",boxShadow:"0 0 0 0.5px rgba(0,0,0,0.06)",WebkitAppearance:"none"};
const lbl={display:"block",fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase",letterSpacing:.3,marginBottom:6};
const bt=(bg,c="#fff")=>({background:bg,color:c,border:"none",borderRadius:12,padding:"10px 18px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Poppins',sans-serif",display:"inline-flex",alignItems:"center",gap:6});
const bs=(bg,c="#fff")=>({...bt(bg,c),padding:"6px 14px",fontSize:11,borderRadius:10});

const GUIDES={produccion:{draft:"Revisa las specs y valida. Pre-prensa también debe validar",ready:"Arrastra al Tablero para asignar máquina",in_production:"Arrastra a siguiente máquina o envía a empaque",packaging:"Marca como entregada cuando esté lista"},preprensa:{draft:"Revisa y edita las specs si es necesario. Valida cuando estén correctas",design:"Noemí: prepara los archivos. Decide si necesita prueba de color",proof_printing:"Imprime prueba en Epson P7570",proof_client:"Esperando que el cliente apruebe",ctp:"Germán: hacer placas en CTP y pasar a procesadora"},secretaria:{maq_created:"Envía al proveedor",maq_sent:"Da seguimiento al proveedor"}};

// ─── LOGIN ─────────────────────────────────────────
function Login({onLogin}) {
  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  const submit = async () => {
    if (!username || !password) return setError("Escribe usuario y contraseña");
    setLoading(true); setError("");
    try {
      const user = await db.login(username.toLowerCase().trim(), password);
      if (user) { onLogin(user.role, user.display_name); }
      else { setError("Usuario o contraseña incorrectos"); }
    } catch { setError("Error de conexión"); }
    setLoading(false);
  };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Poppins',sans-serif"}}>
      <link href={FNT} rel="stylesheet"/>
      <div style={{textAlign:"center",maxWidth:400,width:"100%",padding:"0 24px"}}>
        <img src={LOGO} alt="PrintFlow" style={{width:120,height:120,marginBottom:12,borderRadius:20,display:"block",margin:"0 auto 12px"}}/>
        <h1 style={{fontSize:34,fontWeight:800,color:C.tx,textTransform:"uppercase",margin:"0 0 8px"}}>PrintFlow</h1>
        <p style={{fontSize:11,color:C.t2,textTransform:"uppercase",margin:"0 0 32px"}}>Sistema de Producción</p>
        <div style={{textAlign:"left",marginBottom:12}}>
          <label style={lbl}>Usuario</label>
          <input style={inp} value={username} onChange={e=>setUsername(e.target.value)} placeholder="Ej: gerardo, noemi, admin" onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <div style={{textAlign:"left",marginBottom:16}}>
          <label style={lbl}>Contraseña</label>
          <input style={inp} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contraseña" onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        {error && <div style={{color:C.dn,fontSize:12,fontWeight:600,marginBottom:12}}>{error}</div>}
        <button onClick={submit} disabled={loading} style={{...bt(loading?"#d1d1d6":C.ac),width:"100%",justifyContent:"center",padding:"14px",fontSize:15,borderRadius:14,cursor:loading?"not-allowed":"pointer"}}>{loading?"⏳ Verificando...":"Entrar"}</button>
      </div>
    </div>
  );
}

// ─── WELCOME ───────────────────────────────────────
function WelcomeGuide({role,onClose}) {
  const g={produccion:["📌 Pendientes — órdenes que necesitan tu atención","📝 Revisa specs y envía a Diseño","🏭 Arrastra órdenes a máquinas en el Tablero","📦 Envía a empaque y marca entregada"],preprensa:["📌 Pendientes — órdenes en diseño, prueba o CTP","🎨 Prepara archivos de diseño","🖨️ Imprime prueba en Epson si es couché","💿 Haz placas en CTP"],secretaria:["➕ Crea órdenes con datos del cliente y precio","🚚 Para maquila: proveedor, costo y precio","📅 Revisa Calendario de Entregas","💰 Producción no ve los precios"],admin:["📊 Dashboard — vista general","📊 Analytics — estadísticas","✏️ Edita cualquier orden","📥 Exporta todo a CSV"]};
  const titles={produccion:"👋 Producción",preprensa:"👋 Pre-prensa",secretaria:"👋 Secretaría",admin:"👋 Admin"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
      <div style={{background:C.bg,borderRadius:20,padding:32,maxWidth:420,width:"90%",textAlign:"center"}}>
        <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 16px"}}>{titles[role]}</h2>
        <div style={{textAlign:"left",marginBottom:20}}>
          {(g[role]||g.admin).map((s,i) => (
            <div key={i} style={{display:"flex",gap:10,marginBottom:12,alignItems:"flex-start"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:C.ac+"12",color:C.ac,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0}}>{i+1}</div>
              <div style={{fontSize:13,color:C.tx,lineHeight:1.5,paddingTop:3}}>{s}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{...bt(C.ac),width:"100%",justifyContent:"center",padding:"14px",fontSize:15,borderRadius:14}}>¡Entendido! →</button>
      </div>
    </div>
  );
}

// ─── FLOW DIAGRAM ──────────────────────────────────
function FlowDiagram({currentStage,orderType,onClose}) {
  const flow=orderType==="maquila"?MAQ_FLOW:INT_FLOW;
  const ci=flow.findIndex(s=>s.id===currentStage);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}} onClick={onClose}>
      <div style={{background:C.bg,borderRadius:20,padding:28,maxWidth:460,width:"90%",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 16px",textAlign:"center"}}>{orderType==="maquila"?"🚚 Flujo Maquila":"🏭 Flujo Producción"}</h3>
        {flow.map((s,i) => {
          const done=i<ci, active=i===ci;
          return (
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:i<flow.length-1?4:0}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:32}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:done?C.ok:active?s.c:C.sf,color:done||active?"#fff":C.t3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:done?14:12,fontWeight:700,border:active?"3px solid "+s.c:"none",boxShadow:active?"0 0 0 4px "+s.c+"20":"none"}}>{done?"✓":i+1}</div>
                {i<flow.length-1 && <div style={{width:2,height:20,background:done?C.ok:C.bd}}/>}
              </div>
              <div style={{flex:1,padding:"6px 0"}}>
                <div style={{fontSize:13,fontWeight:active?700:500,color:active?s.c:done?C.ok:C.tx}}>{s.l}</div>
                {active && <div style={{fontSize:11,color:C.t2}}>← Estás aquí</div>}
              </div>
            </div>
          );
        })}
        <button onClick={onClose} style={{...bt(C.sf,C.t2),width:"100%",justifyContent:"center",marginTop:16,border:"0.5px solid "+C.bd}}>Cerrar</button>
      </div>
    </div>
  );
}

// ─── SMALL COMPONENTS ──────────────────────────────
function FC({label:lb,children,req,br}) {
  return <div style={{padding:"12px 20px",...(br?{borderRight:"0.5px solid "+C.bd}:{})}}><label style={lbl}>{lb}{req && <span style={{color:C.ac}}> *</span>}</label>{children}</div>;
}
function GuideBanner({text,color=C.ac}) {
  return <div style={{background:color+"08",border:"1px solid "+color+"20",borderRadius:12,padding:"10px 14px",marginBottom:10,fontSize:12,color:C.tx,fontWeight:500}}>{text}</div>;
}
function ProgressBar({order}) {
  const {cur,tot,pct:p}=getProgress(order); const s=SM[order.stage];
  return <div style={{marginTop:6}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:9,color:C.t2}}>Progreso</span><span style={{fontSize:9,color:s?.c,fontWeight:600}}>{cur}/{tot}</span></div><div style={{background:C.sf,borderRadius:4,height:6,overflow:"hidden"}}><div style={{width:p+"%",height:"100%",background:s?.c||C.ac,borderRadius:4,transition:"width .5s"}}/></div></div>;
}
function LiveTimer({started}) {
  const [el,setEl]=useState(0);
  useEffect(()=>{if(!started)return;const c=()=>Math.round((Date.now()-new Date(started).getTime())/60000);setEl(c());const iv=setInterval(()=>setEl(c()),30000);return ()=>clearInterval(iv)},[started]);
  if(!started) return null;
  return <span style={{fontSize:10,color:"#007aff",fontWeight:700,fontFamily:"monospace",background:"#007aff10",padding:"2px 6px",borderRadius:6}}>⏱ {fmtM(el)}</span>;
}
function Timeline({tl=[]}) {
  const [op,setOp]=useState(false);
  if(!tl?.length) return null;
  const show=op?tl:tl.slice(-3);
  return <div style={{marginTop:6}}><button onClick={()=>setOp(!op)} style={{...bs(C.sf,C.t2),boxShadow:"0 0 0 0.5px "+C.bd,padding:"4px 10px",fontSize:10}}>📜 ({tl.length}) {op?"▲":"▼"}</button>{(op||tl.length<=3)&&<div style={{marginTop:6,borderLeft:"2px solid "+C.bd,paddingLeft:12}}>{show.map((e,i)=><div key={i} style={{marginBottom:5}}><div style={{fontSize:10,color:C.tx,fontWeight:500}}>{e.action}</div><div style={{fontSize:8,color:C.t3}}>{fDT(e.date)}</div></div>)}</div>}</div>;
}
function ClientInput({value,onChange,onSelect,clients}) {
  const [show,setShow]=useState(false);
  const m=(value||"").length>=2?clients.filter(c=>c.client?.toLowerCase().includes(value.toLowerCase())).slice(0,5):[];
  return <div style={{position:"relative"}}><input style={inp} value={value} onChange={e=>{onChange(e.target.value);setShow(true)}} placeholder="Cliente" onFocus={()=>setShow(true)} onBlur={()=>setTimeout(()=>setShow(false),200)}/>{show&&m.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:C.bg,borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,.12)",zIndex:50,border:"0.5px solid "+C.bd,marginTop:4}}><div style={{padding:"5px 12px",fontSize:8,color:C.t2,fontWeight:600,textTransform:"uppercase",borderBottom:"0.5px solid "+C.bd}}>Clientes anteriores</div>{m.map((c,i)=><div key={i} onMouseDown={()=>{onSelect(c);setShow(false)}} style={{padding:"8px 12px",cursor:"pointer",borderBottom:i<m.length-1?"0.5px solid "+C.bd:"none"}} onMouseEnter={e=>e.currentTarget.style.background=C.sf} onMouseLeave={e=>e.currentTarget.style.background=C.bg}><div style={{fontSize:12,fontWeight:600}}>{c.client}</div><div style={{fontSize:10,color:C.t2}}>{[c.client_company,c.client_phone].filter(Boolean).join(" · ")}</div></div>)}</div>}</div>;
}
function CommentLog({comments=[],onAdd,role}) {
  const [text,setText]=useState("");const [show,setShow]=useState(false);
  const add=()=>{if(!text.trim())return;onAdd({text:text.trim(),by:role,date:new Date().toISOString()});setText("")};
  const rc={secretaria:"#5856d6",produccion:"#007aff",preprensa:"#ec4899",sistema:C.t3,admin:C.ok};
  return <div style={{marginTop:6}}>{comments.length>0&&<div style={{maxHeight:80,overflowY:"auto",marginBottom:4}}>{comments.map((c,i)=><div key={i} style={{padding:"2px 0",fontSize:10,borderBottom:i<comments.length-1?"0.5px solid "+C.bd:"none"}}><span style={{fontWeight:600,color:rc[c.by]||C.t3}}>{(c.by||"").slice(0,3)}</span> {c.text} <span style={{color:C.t3,fontSize:8}}>{fDT(c.date)}</span></div>)}</div>}{!show?<button onClick={()=>setShow(true)} style={{...bs(C.sf,C.t2),boxShadow:"0 0 0 0.5px "+C.bd,padding:"4px 10px",fontSize:10}}>💬 Nota</button>:<div style={{display:"flex",gap:4}}><input style={{...inp,flex:1,padding:"6px 10px",fontSize:11}} value={text} onChange={e=>setText(e.target.value)} placeholder="Nota..." onKeyDown={e=>e.key==="Enter"&&add()}/><button onClick={add} style={bs(C.ac)}>↑</button><button onClick={()=>setShow(false)} style={bs(C.sf,C.t2)}>✕</button></div>}</div>;
}

// ─── MODALS ────────────────────────────────────────
function PrintOrder({order:o,onClose}) {
  const printIt=()=>{const w=window.open("","_blank","width=800,height=600");if(!w)return;const rows=[["Cliente",o.client],["Producto",(o.product||"")+" · "+o.product_type],["Cantidad",o.quantity?Number(o.quantity).toLocaleString()+" pzas":"—"],["Papel",o.paper_type||"—"],["Medidas",(o.width_cm||"—")+"×"+(o.height_cm||"—")+"cm"],["Tintas",o.colors||"—"],["Acabados",o.finishes||"—"],["Entrega",o.due_date?fD(o.due_date):"—"],["Prioridad",(PM[o.priority]?.l)||"Normal"],["Notas",o.notes||"—"]];let h='<html><head><title>'+o.id+'</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:24px}.big{font-size:32px;font-weight:800;text-align:center;padding:16px;border:2px solid #1c1c1e;border-radius:12px;margin:8px 0 16px}.row{display:flex;border-bottom:1px solid #ddd;padding:6px 0}.lbl{width:120px;font-size:10px;font-weight:700;color:#888;text-transform:uppercase}.val{flex:1;font-size:12px}.sig{margin-top:30px;display:flex;gap:30px}.sig-box{flex:1;border-top:1px solid #000;padding-top:4px;text-align:center;font-size:9px;color:#888}</style></head><body>';h+='<div style="text-align:center"><img src="'+LOGO+'" style="width:60px;height:60px;border-radius:12px"/></div><h2 style="text-align:center;font-size:16px;margin-top:8px">PrintFlow</h2><div style="text-align:center;font-size:11px;color:#888">'+fDT(o.created_at)+'</div>';h+='<div class="big">'+(o.production_number||o.id)+'</div>';rows.forEach(([l,v])=>{h+='<div class="row"><div class="lbl">'+l+'</div><div class="val">'+v+'</div></div>'});h+='<div class="sig"><div class="sig-box">Producción</div><div class="sig-box">Calidad</div><div class="sig-box">Entrega</div></div></body></html>';w.document.write(h);w.document.close();w.print()};
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}><div style={{background:C.bg,borderRadius:20,padding:24,maxWidth:400,width:"90%",textAlign:"center"}}><div style={{fontSize:28,fontWeight:800,marginBottom:4}}>{o.production_number||o.id}</div><div style={{fontSize:12,color:C.t2,marginBottom:16}}>{o.client} · {o.product_type}</div><div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...bt(C.sf,C.t2),flex:1,justifyContent:"center",border:"0.5px solid "+C.bd}}>Cerrar</button><button onClick={printIt} style={{...bt(C.ac),flex:1,justifyContent:"center"}}>🖨️ Imprimir</button></div></div></div>;
}
function DetailModal({order:o,onClose,onPrint,role}) {
  const hp=role==="produccion"||role==="preprensa";const isMaq=o.order_type==="maquila";const st=SM[o.stage];
  const Row=({l,v})=>v&&v!=="—"?<div style={{display:"flex",padding:"8px 0",borderBottom:"0.5px solid "+C.bd}}><div style={{width:130,fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase",flexShrink:0}}>{l}</div><div style={{flex:1,fontSize:13,color:C.tx}}>{v}</div></div>:null;
  const printIt=()=>{onPrint(o);onClose()};
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:998}} onClick={onClose}>
    <div style={{background:C.bg,borderRadius:20,padding:24,maxWidth:520,width:"92%",maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontSize:9,color:C.t3}}>{o.id}</div>
          <div style={{fontSize:20,fontWeight:800}}>{o.production_number||o.client}</div>
          <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
            <span style={{background:(st?.c||C.t3)+"15",color:st?.c,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:600}}>{st?.l}</span>
            {o.priority!=="normal"&&PM[o.priority]&&<span style={{background:PM[o.priority].c+"15",color:PM[o.priority].c,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:600}}>{PM[o.priority].l}</span>}
          </div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.t3,padding:4}}>✕</button>
      </div>
      {o.image&&<img src={o.image} alt="" style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:12,marginBottom:12}}/>}
      <div style={{fontSize:10,fontWeight:600,color:C.ac,textTransform:"uppercase",marginBottom:4}}>Cliente</div>
      <Row l="Nombre" v={o.client}/>
      {!hp&&<><Row l="Empresa" v={o.client_company}/><Row l="Email" v={o.client_email}/><Row l="Teléfono" v={o.client_phone?(o.client_lada||"+52")+" "+o.client_phone:null}/><Row l="RFC" v={o.client_rfc}/></>}
      <div style={{fontSize:10,fontWeight:600,color:C.ac,textTransform:"uppercase",marginTop:12,marginBottom:4}}>Producto</div>
      <Row l="Descripción" v={o.product}/><Row l="Tipo" v={o.product_type}/><Row l="Cantidad" v={o.quantity?Number(o.quantity).toLocaleString()+" pzas":null}/><Row l="Entrega" v={o.due_date?fD(o.due_date):null}/>
      {!isMaq&&<><div style={{fontSize:10,fontWeight:600,color:C.ac,textTransform:"uppercase",marginTop:12,marginBottom:4}}>Especificaciones</div><Row l="Papel" v={o.paper_type}/><Row l="Medidas" v={o.width_cm?o.width_cm+"×"+o.height_cm+" cm":null}/><Row l="Tintas" v={o.colors}/><Row l="Acabados" v={o.finishes}/><Row l="Horas est." v={o.estimated_hours?o.estimated_hours+"h":null}/></>}
      {!hp&&!isMaq&&o.price&&<><div style={{fontSize:10,fontWeight:600,color:C.ac,textTransform:"uppercase",marginTop:12,marginBottom:4}}>Precio</div><Row l="Precio MXN" v={fmt(o.price)}/></>}
      {!hp&&isMaq&&<><div style={{fontSize:10,fontWeight:600,color:"#e67e22",textTransform:"uppercase",marginTop:12,marginBottom:4}}>Maquila</div><Row l="Proveedor" v={o.maq_provider}/><Row l="Costo" v={o.maq_cost?fmt(o.maq_cost):null}/><Row l="Precio" v={o.maq_price?fmt(o.maq_price):null}/></>}
      {o.maquila_provider&&<><div style={{fontSize:10,fontWeight:600,color:"#e67e22",textTransform:"uppercase",marginTop:12,marginBottom:4}}>🚚 Proveedor Maquila</div><Row l="Proveedor" v={o.maquila_provider}/>{o.maquila_phone&&<Row l="📱 Teléfono" v={o.maquila_phone}/>}{o.maquila_email&&<Row l="📧 Email" v={o.maquila_email}/>}</>}
      {o.file_url&&<div style={{marginTop:12}}><div style={{fontSize:10,fontWeight:600,color:C.ac,textTransform:"uppercase",marginBottom:4}}>📁 Archivo de Producción</div><a href={o.file_url} target="_blank" rel="noopener" download={o.file_name} style={{display:"flex",alignItems:"center",gap:8,background:C.sf,borderRadius:10,padding:"10px 14px",textDecoration:"none",border:"0.5px solid "+C.bd}}><span style={{fontSize:24}}>📄</span><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.tx}}>{o.file_name||"Archivo"}</div><div style={{fontSize:10,color:"#007aff",fontWeight:500}}>⬇ Click para descargar</div></div></a></div>}
      {o.notes&&<><div style={{fontSize:10,fontWeight:600,color:C.ac,textTransform:"uppercase",marginTop:12,marginBottom:4}}>Notas</div><div style={{fontSize:12,color:C.tx,padding:"8px 0",lineHeight:1.5}}>{o.notes}</div></>}
      {o.stage==="draft"&&<div style={{marginTop:12,padding:"8px 0",display:"flex",gap:6,fontSize:9,color:C.t2,borderTop:"0.5px solid "+C.bd}}><span style={{color:o.validated_by_production?C.ok:C.wn}}>{o.validated_by_production?"✅":"⏳"} Producción</span><span style={{color:o.validated_by_preprensa?C.ok:C.wn}}>{o.validated_by_preprensa?"✅":"⏳"} Pre-prensa</span></div>}
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <button onClick={onClose} style={{...bt(C.sf,C.t2),flex:1,justifyContent:"center",border:"0.5px solid "+C.bd}}>Cerrar</button>
        <button onClick={printIt} style={{...bt(C.ac),flex:1,justifyContent:"center"}}>🖨️ Imprimir Orden</button>
      </div>
    </div>
  </div>;
}
function ClientHistory({clientName,orders,onClose,role}) {
  const co=orders.filter(o=>o.client===clientName).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const total=co.reduce((s,o)=>s+(parseFloat(o.price)||parseFloat(o.maq_price)||0),0);
  const byType={};co.forEach(o=>{byType[o.product_type]=(byType[o.product_type]||0)+1});
  const hp=role==="produccion"||role==="preprensa";
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}} onClick={onClose}><div style={{background:C.bg,borderRadius:20,padding:24,maxWidth:480,width:"90%",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}><h3 style={{fontSize:18,fontWeight:800,margin:"0 0 4px"}}>👤 {clientName}</h3><p style={{fontSize:12,color:C.t2,margin:"0 0 14px"}}>{co.length} orden{co.length!==1?"es":""}{!hp?" · Total: "+fmt(total):""}</p>{Object.keys(byType).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:12}}>{Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([t,c])=><span key={t} style={{background:C.sf,padding:"4px 10px",borderRadius:8,fontSize:11}}>{t} <strong>{c}</strong></span>)}</div>}{co.map(o=><div key={o.id} style={{padding:"8px 0",borderBottom:"0.5px solid "+C.bd,display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:9,color:C.t3}}>{o.id} · {fD(o.created_at)}</div><div style={{fontSize:12}}>{o.product||o.product_type}{o.quantity?" · "+Number(o.quantity).toLocaleString():""}</div><span style={{background:(SM[o.stage]?.c||C.t3)+"15",color:SM[o.stage]?.c,padding:"1px 6px",borderRadius:6,fontSize:9,fontWeight:600}}>{SM[o.stage]?.l}</span></div>{!hp&&(o.price||o.maq_price)&&<div style={{fontSize:14,fontWeight:700}}>{fmt(parseFloat(o.price)||parseFloat(o.maq_price))}</div>}</div>)}<button onClick={onClose} style={{...bt(C.sf,C.t2),width:"100%",justifyContent:"center",marginTop:14,border:"0.5px solid "+C.bd}}>Cerrar</button></div></div>;
}
function ConfirmModal({title,message,confirmLabel,confirmColor,onConfirm,onClose}) {
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}><div style={{background:C.bg,borderRadius:20,padding:28,maxWidth:380,width:"90%",textAlign:"center"}}><div style={{fontSize:36,marginBottom:8}}>⚠️</div><h3 style={{fontSize:16,fontWeight:700,margin:"0 0 8px"}}>{title}</h3><p style={{fontSize:13,color:C.t2,margin:"0 0 20px"}}>{message}</p><div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...bt(C.sf,C.t2),flex:1,justifyContent:"center",border:"0.5px solid "+C.bd}}>No, cancelar</button><button onClick={onConfirm} style={{...bt(confirmColor||C.ok),flex:1,justifyContent:"center"}}>{confirmLabel}</button></div></div></div>;
}
function MaqModal({onSend,onClose,providers=[]}) {
  const [p,setP]=useState("");const [ph,setPh]=useState("");const [em,setEm]=useState("");const [n,setN]=useState("");const [showAC,setShowAC]=useState(false);
  const matches=(p||"").length>=2?providers.filter(x=>x.name?.toLowerCase().includes(p.toLowerCase())).slice(0,5):[];
  const selProv=pv=>{setP(pv.name);setPh(pv.phone||"");setEm(pv.email||"");setShowAC(false)};
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}><div style={{background:C.bg,borderRadius:20,padding:24,maxWidth:420,width:"90%"}}>
    <h3 style={{fontSize:16,fontWeight:700,margin:"0 0 14px"}}>🚚 Enviar a Maquila</h3>
    <div style={{marginBottom:10,position:"relative"}}>
      <label style={lbl}>Proveedor *</label>
      <input style={inp} value={p} onChange={e=>{setP(e.target.value);setShowAC(true)}} onFocus={()=>setShowAC(true)} onBlur={()=>setTimeout(()=>setShowAC(false),200)} placeholder="Nombre del proveedor"/>
      {showAC&&matches.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:C.bg,borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,.12)",zIndex:50,border:"0.5px solid "+C.bd,marginTop:4}}>
        <div style={{padding:"5px 12px",fontSize:8,color:C.t2,fontWeight:600,textTransform:"uppercase",borderBottom:"0.5px solid "+C.bd}}>Proveedores anteriores</div>
        {matches.map((pv,i)=><div key={i} onMouseDown={()=>selProv(pv)} style={{padding:"8px 12px",cursor:"pointer",borderBottom:i<matches.length-1?"0.5px solid "+C.bd:"none"}} onMouseEnter={e=>e.currentTarget.style.background=C.sf} onMouseLeave={e=>e.currentTarget.style.background=C.bg}>
          <div style={{fontSize:12,fontWeight:600}}>{pv.name}</div>
          <div style={{fontSize:10,color:C.t2}}>{[pv.phone,pv.email].filter(Boolean).join(" · ")||"Sin contacto"}</div>
        </div>)}
      </div>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
      <div><label style={lbl}>📱 Teléfono</label><input style={inp} type="tel" value={ph} onChange={e=>setPh(e.target.value)} placeholder="55 1234 5678"/></div>
      <div><label style={lbl}>📧 Email</label><input style={inp} type="email" value={em} onChange={e=>setEm(e.target.value)} placeholder="correo@ej.com"/></div>
    </div>
    <div style={{marginBottom:16}}><label style={lbl}>Notas (opcional)</label><input style={inp} value={n} onChange={e=>setN(e.target.value)} placeholder="Instrucciones..."/></div>
    <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...bt(C.sf,C.t2),flex:1,justifyContent:"center",border:"0.5px solid "+C.bd}}>Cancelar</button><button onClick={()=>{if(p)onSend(p,ph,em,n)}} style={{...bt("#e67e22"),flex:1,justifyContent:"center"}}>🚚 Enviar</button></div>
  </div></div>;
}
function WasteModal({onSave,onClose}) {
  const [pl,setPl]=useState("");const [pz,setPz]=useState("");const [n,setN]=useState("");
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}><div style={{background:C.bg,borderRadius:20,padding:24,maxWidth:400,width:"90%"}}><h3 style={{fontSize:16,fontWeight:700,margin:"0 0 6px"}}>🗑️ Registrar Merma</h3><p style={{fontSize:12,color:C.t2,margin:"0 0 14px"}}>¿Cuánto material se echó a perder?</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}><div><label style={lbl}>📄 Pliegos (Impresión)</label><input style={inp} type="number" value={pl} onChange={e=>setPl(e.target.value)} placeholder="0"/></div><div><label style={lbl}>📦 Piezas (Acabados)</label><input style={inp} type="number" value={pz} onChange={e=>setPz(e.target.value)} placeholder="0"/></div></div><div style={{marginBottom:16}}><label style={lbl}>¿Qué pasó?</label><input style={inp} value={n} onChange={e=>setN(e.target.value)} placeholder="Motivo..."/></div><div style={{display:"flex",gap:8}}><button onClick={onClose} style={{...bt(C.sf,C.t2),flex:1,justifyContent:"center",border:"0.5px solid "+C.bd}}>Cancelar</button><button onClick={()=>onSave(parseInt(pz,10)||0,parseInt(pl,10)||0,n)} style={{...bt(C.wn),flex:1,justifyContent:"center"}}>Guardar</button></div></div></div>;
}

// ─── CALENDAR ──────────────────────────────────────
function Calendar({orders,onChangeDate}) {
  const [wo,setWo]=useState(0);const [editOrder,setEditOrder]=useState(null);const [newDate,setNewDate]=useState("");
  const today=new Date();const dow=today.getDay()||7;const sow=new Date(today);sow.setDate(today.getDate()-dow+1+wo*7);
  const days=Array.from({length:7},(_,i)=>{const d=new Date(sow);d.setDate(sow.getDate()+i);return d});
  const dn=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const saveDate=()=>{if(editOrder&&newDate){onChangeDate(editOrder.id,newDate);setEditOrder(null);setNewDate("")}};
  return <div style={{background:C.sf,borderRadius:16,padding:16}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <span style={{fontSize:11,fontWeight:600,color:C.t2,textTransform:"uppercase"}}>📅 Semana del {fD(sow)}</span>
      <div style={{display:"flex",gap:4}}><button onClick={()=>setWo(w=>w-1)} style={bs(C.bg,C.t2)}>‹</button><button onClick={()=>setWo(0)} style={bs(wo===0?C.ac:C.bg,wo===0?"#fff":C.t2)}>Hoy</button><button onClick={()=>setWo(w=>w+1)} style={bs(C.bg,C.t2)}>›</button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
      {days.map((day,i)=>{const ds=day.getFullYear()+"-"+String(day.getMonth()+1).padStart(2,"0")+"-"+String(day.getDate()).padStart(2,"0");const isT=day.toDateString()===today.toDateString();
        const pend=orders.filter(o=>o.due_date===ds&&!o.stage.includes("delivered"));
        const done=orders.filter(o=>o.due_date===ds&&o.stage.includes("delivered"));
        return <div key={i} style={{background:isT?C.ac+"08":C.bg,border:"0.5px solid "+(isT?C.ac+"30":C.bd),borderRadius:10,padding:8,minHeight:90}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:9,color:C.t2,fontWeight:600}}>{dn[i]}</span>
            <span style={{fontSize:12,fontWeight:700,color:isT?"#fff":C.tx,background:isT?C.ac:"transparent",width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{day.getDate()}</span>
          </div>
          {pend.map(o=><div key={o.id} onClick={()=>{setEditOrder(o);setNewDate(o.due_date)}} style={{background:day<today?C.dn+"10":C.ac+"08",borderRadius:6,padding:"3px 6px",marginBottom:3,borderLeft:"2px solid "+(day<today?C.dn:C.ac),cursor:"pointer"}} title="Click para cambiar fecha">
            <div style={{fontSize:9,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.client}</div>
            <div style={{fontSize:8,color:C.t2}}>{o.product_type}</div>
          </div>)}
          {done.map(o=><div key={o.id} style={{background:C.ok+"08",borderRadius:6,padding:"3px 6px",marginBottom:3,borderLeft:"2px solid "+C.ok,opacity:.5}}>
            <div style={{fontSize:9,color:C.ok,textDecoration:"line-through"}}>{o.client}</div>
          </div>)}
          {!pend.length&&!done.length&&<div style={{color:C.ph,fontSize:9,textAlign:"center",marginTop:14}}>—</div>}
        </div>})}
    </div>
    {editOrder&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
      <div style={{background:C.bg,borderRadius:20,padding:24,maxWidth:380,width:"90%"}}>
        <h3 style={{fontSize:16,fontWeight:700,margin:"0 0 4px"}}>📅 Cambiar Fecha de Entrega</h3>
        <p style={{fontSize:12,color:C.t2,margin:"0 0 14px"}}>{editOrder.client} — {editOrder.product||editOrder.product_type}</p>
        <div style={{marginBottom:6}}><label style={lbl}>Fecha actual</label><div style={{fontSize:13,fontWeight:600,color:C.tx,padding:"8px 0"}}>{fD(editOrder.due_date)}</div></div>
        <div style={{marginBottom:16}}><label style={lbl}>Nueva fecha de entrega</label><input style={inp} type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}/></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setEditOrder(null);setNewDate("")}} style={{...bt(C.sf,C.t2),flex:1,justifyContent:"center",border:"0.5px solid "+C.bd}}>Cancelar</button>
          <button onClick={saveDate} style={{...bt(C.ac),flex:1,justifyContent:"center"}}>💾 Guardar Nueva Fecha</button>
        </div>
      </div>
    </div>}
  </div>;
}

// ─── WEEKLY REPORT ─────────────────────────────────
function WeeklyReport({orders}) {
  const now=new Date();const wa=new Date(now);wa.setDate(now.getDate()-7);
  const created=orders.filter(o=>new Date(o.created_at)>=wa);const delivered=orders.filter(o=>(o.deliveredAt||o.delivered_at)&&new Date(o.deliveredAt||o.delivered_at)>=wa);
  const rev=delivered.reduce((s,o)=>s+(parseFloat(o.price)||parseFloat(o.maq_price)||0),0);
  const late=orders.filter(o=>o.due_date&&new Date(o.due_date)<now&&!o.stage.includes("delivered")).length;
  const St=({l,v,c=C.tx})=><div style={{background:C.bg,borderRadius:10,padding:10,flex:"1 1 90px",textAlign:"center"}}><div style={{fontSize:8,color:C.t2,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{l}</div><div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div></div>;
  return <div style={{background:C.sf,borderRadius:14,padding:16,marginBottom:14}}><div style={{fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:8}}>📊 Resumen Semanal</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><St l="Creadas" v={created.length} c={C.ac}/><St l="Entregadas" v={delivered.length} c={C.ok}/><St l="Facturado" v={fmt(rev)} c={C.ok}/><St l="Con retraso" v={late} c={late>0?C.dn:C.ok}/></div></div>;
}

// ─── FILE UPLOAD ──────────────────────────────────
function FileUpload({orderId,fileUrl,fileName,onUploaded,onRemoved,canUpload}) {
  const [uploading,setUploading]=useState(false);const [progress,setProgress]=useState(0);
  const maxSize=50*1024*1024; // 50MB
  const upload=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    if(file.size>maxSize){alert("Archivo muy grande (máx 50MB)");return}
    setUploading(true);setProgress(10);
    try{
      const parts=file.name.split(".");const ext=parts.length>1?parts.pop():"pdf";
      const path=(orderId||"new-"+Date.now())+"/"+Date.now()+"."+ext;
      setProgress(30);
      const{error}=await supabase.storage.from("order-files").upload(path,file,{upsert:true});
      if(error)throw error;
      setProgress(80);
      const{data:urlData}=supabase.storage.from("order-files").getPublicUrl(path);
      setProgress(100);
      onUploaded(urlData.publicUrl,file.name);
    }catch(err){alert("Error al subir: "+(err.message||err))}
    finally{setUploading(false);setProgress(0);e.target.value=""}
  };
  const remove=async()=>{
    if(!fileUrl)return;
    try{const path=fileUrl.split("/order-files/")[1];if(path)await supabase.storage.from("order-files").remove([decodeURIComponent(path)])}catch{}
    onRemoved();
  };
  const fSize=fileName?fileName.length>25?fileName.slice(0,22)+"..."+fileName.split(".").pop():fileName:"";
  return <div style={{padding:"12px 20px",borderBottom:"0.5px solid "+C.bd}}>
    <label style={lbl}>📁 Archivo de Producción</label>
    {fileUrl?<div style={{display:"flex",alignItems:"center",gap:8,background:C.bg,borderRadius:10,padding:"8px 12px",border:"0.5px solid "+C.bd}}>
      <span style={{fontSize:20}}>📄</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{fSize}</div>
        <a href={fileUrl} target="_blank" rel="noopener" download={fileName} style={{fontSize:10,color:"#007aff",textDecoration:"none",fontWeight:500}}>⬇ Descargar</a>
      </div>
      {canUpload&&<button onClick={remove} style={{background:C.dn+"12",color:C.dn,border:"none",borderRadius:8,padding:"4px 8px",fontSize:10,fontWeight:600,cursor:"pointer"}}>✕ Quitar</button>}
    </div>
    :canUpload?<label style={{...inp,display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:uploading?"wait":"pointer",color:uploading?"#007aff":C.t2,background:uploading?"#007aff08":C.bg,position:"relative",overflow:"hidden"}}>
      {uploading?<><span style={{fontWeight:600}}>⏳ Subiendo... {progress}%</span><div style={{position:"absolute",bottom:0,left:0,height:3,background:"#007aff",borderRadius:2,width:progress+"%",transition:"width .3s"}}/></>:"📁 Subir archivo (PDF, AI, PSD — máx 50MB)"}
      <input type="file" accept=".pdf,.ai,.psd,.eps,.indd,.tiff,.tif,.jpg,.jpeg,.png,.zip,.rar" style={{display:"none"}} onChange={upload} disabled={uploading}/>
    </label>
    :<div style={{fontSize:11,color:C.t3,padding:"8px 0"}}>Sin archivo adjunto</div>}
  </div>;
}

// ─── ORDER FORM ────────────────────────────────────
function OrderForm({role,onSubmit,editOrder,onCancel,clients}) {
  const empty={order_type:"interna",priority:"normal",production_number:"",client:"",client_company:"",client_email:"",client_phone:"",client_lada:"+52",client_rfc:"",product:"",product_type:"Etiqueta colgante",quantity:"",paper_type:"",width_cm:"",height_cm:"",colors:"",finishes:"",notes:"",price:"",estimated_hours:"",due_date:"",maq_provider:"",maq_cost:"",maq_price:"",image:null};
  const [f,setF]=useState(editOrder?{...empty,...Object.fromEntries(Object.entries(editOrder).map(([k,v])=>[k,v===null&&typeof empty[k]==="string"?"":v]))}:empty);const [saving,setSaving]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  useEffect(()=>{if(editOrder)setF({...empty,...Object.fromEntries(Object.entries(editOrder).map(([k,v])=>[k,v===null&&typeof empty[k]==="string"?"":v]))})},[editOrder]);
  const isMaq=f.order_type==="maquila";const margin=isMaq&&f.maq_cost&&f.maq_price?pct(parseFloat(f.maq_cost),parseFloat(f.maq_price)):null;
  const canP=role==="secretaria"||role==="admin";const hideC=role==="produccion"||role==="preprensa";
  const specsOnly=editOrder?._specsOnly;
  const submit=async()=>{if(!f.client||!f.product_type)return alert("Completa: Cliente y Tipo");setSaving(true);try{const clean={...f};delete clean._specsOnly;await onSubmit(clean);if(!editOrder)setF(empty)}catch(e){alert(e.message)}finally{setSaving(false)}};
  const selC=c=>setF(p=>({...p,client:c.client,client_company:c.client_company||"",client_email:c.client_email||"",client_phone:c.client_phone||"",client_lada:c.client_lada||"+52",client_rfc:c.client_rfc||""}));

  return <div style={{background:C.sf,borderRadius:16,overflow:"hidden",maxWidth:700,margin:"0 auto"}}>
    {!editOrder&&canP&&<GuideBanner text={isMaq?"🚚 Orden de maquila — incluye proveedor, costo y precio":"📋 Crea la orden completa con datos, specs y precio"} color={isMaq?"#e67e22":"#5856d6"}/>}
    {editOrder&&specsOnly&&<GuideBanner text="✏️ Pre-prensa: edita las especificaciones técnicas" color="#ec4899"/>}
    {editOrder&&hideC&&!specsOnly&&<GuideBanner text="🔍 Revisa y completa las especificaciones"/>}
    {!editOrder&&canP&&<div style={{padding:"14px 20px",borderBottom:"0.5px solid "+C.bd,display:"flex",gap:8}}>{["interna","maquila"].map(t=><button key={t} onClick={()=>s("order_type",t)} style={{flex:1,padding:12,borderRadius:12,border:"1.5px solid "+(f.order_type===t?(t==="maquila"?"#e67e22":C.ac):C.bd),background:f.order_type===t?(t==="maquila"?"#e67e2208":C.acL):C.bg,cursor:"pointer",fontFamily:"'Poppins',sans-serif"}}><div style={{fontSize:22}}>{t==="interna"?"🏭":"🚚"}</div><div style={{fontSize:12,fontWeight:700}}>{t==="interna"?"Producción Interna":"Maquila Completa"}</div></button>)}</div>}
    {!specsOnly&&<div style={{padding:"14px 20px",borderBottom:"0.5px solid "+C.bd}}><label style={lbl}>Prioridad</label><div style={{display:"flex",gap:6}}>{PRIOS.map(p=><button key={p.id} onClick={()=>s("priority",p.id)} style={{flex:1,padding:"10px 4px",borderRadius:10,border:"1.5px solid "+(f.priority===p.id?p.c:C.bd),background:f.priority===p.id?p.c+"10":C.bg,cursor:"pointer",fontSize:12,fontWeight:600,color:f.priority===p.id?p.c:C.t2,fontFamily:"'Poppins',sans-serif"}}>{p.l}</button>)}</div></div>}
    <div style={{padding:"12px 20px 4px",fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase"}}>Cliente</div>
    {hideC||specsOnly?<div style={{padding:"8px 20px 14px",borderBottom:"0.5px solid "+C.bd}}><div style={{fontSize:15,fontWeight:700}}>{f.client||"—"}</div></div>:<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:"0.5px solid "+C.bd}}><FC label="Nombre" req br><ClientInput value={f.client} onChange={v=>s("client",v)} onSelect={selC} clients={clients}/></FC><FC label="Empresa"><input style={inp} value={f.client_company} onChange={e=>s("client_company",e.target.value)} placeholder="Razón social"/></FC></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:"0.5px solid "+C.bd}}><FC label="📧 Email" br><input style={inp} type="email" value={f.client_email} onChange={e=>s("client_email",e.target.value)} placeholder="correo@ej.com"/></FC><FC label="📱 WhatsApp" br><div style={{display:"flex",gap:4}}><select style={{...inp,width:70,padding:"10px 4px",fontSize:11}} value={f.client_lada||"+52"} onChange={e=>s("client_lada",e.target.value)}><option value="+52">🇲🇽+52</option><option value="+1">🇺🇸+1</option></select><input style={{...inp,flex:1}} type="tel" value={f.client_phone} onChange={e=>s("client_phone",e.target.value)} placeholder="55 1234 5678"/></div></FC><FC label="RFC"><input style={inp} value={f.client_rfc} onChange={e=>s("client_rfc",e.target.value.toUpperCase())} placeholder="XAXX010101000" maxLength={13}/></FC></div></>}
    <div style={{padding:"12px 20px 4px",fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase"}}>Producto</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:"0.5px solid "+C.bd}}><FC label="Descripción" br><input style={inp} value={f.product} onChange={e=>s("product",e.target.value)} placeholder="Etiquetas..."/></FC><FC label="Tipo" req><select style={{...inp,paddingRight:32}} value={f.product_type} onChange={e=>s("product_type",e.target.value)}>{PTYPES.map(t=><option key={t}>{t}</option>)}</select></FC></div>
    {!specsOnly&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:"0.5px solid "+C.bd}}><FC label="Cantidad" br><input style={inp} type="number" value={f.quantity} onChange={e=>s("quantity",e.target.value)} placeholder="Tiraje"/></FC><FC label="📅 Entrega" br><input style={inp} type="date" value={f.due_date} onChange={e=>s("due_date",e.target.value)}/></FC><FC label="# Producción"><input style={inp} value={f.production_number} onChange={e=>s("production_number",e.target.value)} placeholder="P-0001"/></FC></div>}
    {isMaq&&!specsOnly&&<><div style={{padding:"12px 20px 4px",fontSize:10,fontWeight:600,color:"#e67e22",textTransform:"uppercase"}}>🚚 Maquila</div><div style={{padding:"12px 20px",borderBottom:"0.5px solid "+C.bd}}><label style={lbl}>Proveedor *</label><input style={inp} value={f.maq_provider} onChange={e=>s("maq_provider",e.target.value)} placeholder="Nombre"/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:"0.5px solid "+C.bd}}><FC label="Costo" br><input style={inp} type="number" step=".01" value={f.maq_cost} onChange={e=>s("maq_cost",e.target.value)} placeholder="$0"/></FC><FC label="Precio cliente" br><input style={inp} type="number" step=".01" value={f.maq_price} onChange={e=>s("maq_price",e.target.value)} placeholder="$0"/></FC><FC label="% Ganancia"><div style={{padding:10,background:"#fff",borderRadius:12,fontSize:18,fontWeight:800,color:margin!==null?(margin>=20?C.ok:margin>=10?C.wn:C.dn):C.ph,textAlign:"center"}}>{margin!==null?margin+"%":"—"}</div></FC></div></>}
    {!isMaq&&<><div style={{padding:"12px 20px 4px",fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase"}}>Especificaciones</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:"0.5px solid "+C.bd}}><FC label="Papel" br><input style={inp} value={f.paper_type} onChange={e=>s("paper_type",e.target.value)} placeholder="Couché 150g"/></FC><FC label="Tintas"><input style={inp} value={f.colors} onChange={e=>s("colors",e.target.value)} placeholder="4×4, CMYK"/></FC></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:"0.5px solid "+C.bd}}><FC label="Ancho cm" br><input style={inp} type="number" step="0.1" value={f.width_cm} onChange={e=>s("width_cm",e.target.value)}/></FC><FC label="Alto cm" br><input style={inp} type="number" step="0.1" value={f.height_cm} onChange={e=>s("height_cm",e.target.value)}/></FC><FC label="Horas"><input style={inp} type="number" step=".5" value={f.estimated_hours} onChange={e=>s("estimated_hours",e.target.value)}/></FC></div><div style={{padding:"12px 20px",borderBottom:"0.5px solid "+C.bd}}><label style={lbl}>Acabados</label><input style={inp} value={f.finishes} onChange={e=>s("finishes",e.target.value)} placeholder="Barniz UV, Laminado, Suaje"/></div></>}
    {!isMaq&&canP&&<div style={{padding:"12px 20px",borderBottom:"0.5px solid "+C.bd}}><label style={lbl}>💰 Precio MXN</label><input style={inp} type="number" step=".01" value={f.price} onChange={e=>s("price",e.target.value)} placeholder="$0.00"/></div>}
    <div style={{padding:"12px 20px",borderBottom:"0.5px solid "+C.bd}}><label style={lbl}>📷 Imagen (opcional)</label><div style={{display:"flex",alignItems:"center",gap:8}}>{f.image&&<div style={{position:"relative"}}><img src={f.image} alt="" style={{width:48,height:48,objectFit:"cover",borderRadius:8}}/><button onClick={()=>s("image",null)} style={{position:"absolute",top:-4,right:-4,width:14,height:14,borderRadius:"50%",background:C.dn,color:"#fff",border:"none",fontSize:8,cursor:"pointer"}}>✕</button></div>}<label style={{...inp,display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",color:C.t2,flex:1}}>📷 Subir<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const file=e.target.files[0];if(!file||file.size>2e6)return;const r=new FileReader();r.onload=ev=>s("image",ev.target.result);r.readAsDataURL(file);e.target.value=""}}/></label></div></div>
    {(canP||role==="preprensa")&&<FileUpload orderId={f.id} fileUrl={f.file_url} fileName={f.file_name} onUploaded={(url,name)=>{s("file_url",url);s("file_name",name)}} onRemoved={()=>{s("file_url",null);s("file_name",null)}} canUpload={canP}/>}
    <div style={{padding:"12px 20px",borderBottom:"0.5px solid "+C.bd}}><label style={lbl}>Notas</label><textarea style={{...inp,minHeight:48,resize:"vertical"}} value={f.notes} onChange={e=>s("notes",e.target.value)} placeholder="Instrucciones..."/></div>
    <div style={{padding:"12px 20px 16px",display:"flex",gap:8}}>{onCancel&&<button onClick={onCancel} style={{...bt(C.sf,C.t2),border:"0.5px solid "+C.bd}}>Cancelar</button>}<button onClick={submit} disabled={saving} style={{...bt(saving?"#d1d1d6":isMaq?"#e67e22":C.ac),flex:1,justifyContent:"center",fontSize:15,padding:"14px",borderRadius:14,cursor:saving?"not-allowed":"pointer"}}>{saving?"⏳...":editOrder?"💾 Guardar":"📝 Crear Orden"}</button></div>
  </div>;
}

// ─── ORDER CARD ────────────────────────────────────
function OCard({o,role,onAction,compact}) {
  const st=SM[o.stage];const isMaq=o.order_type==="maquila";const late=o.due_date&&new Date(o.due_date)<new Date()&&!o.stage.includes("delivered");
  const canAct=st?.who===role||st?.who==="both"&&(role==="produccion"||role==="preprensa")||role==="admin";const stale=getStale(o);const hp=role==="produccion"||role==="preprensa";
  const guide=GUIDES[role]?.[o.stage];

  return <div draggable={o.stage==="ready"||o.stage==="in_production"} onDragStart={e=>e.dataTransfer.setData("orderId",o.id)}
    onClick={()=>onAction(o.id,"detail")}
    style={{background:C.bg,borderRadius:14,padding:compact?10:16,marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.04),0 0 0 0.5px rgba(0,0,0,0.06)",cursor:"pointer",borderLeft:"4px solid "+(o.priority==="urgente"?C.dn:st?.c||C.t3)}}>
    {canAct&&guide&&!compact&&<GuideBanner text={guide} color={st?.c}/>}
    <div style={{display:"flex",gap:10}}>
      {o.image&&<img src={o.image} alt="" style={{width:compact?32:48,height:compact?32:48,objectFit:"cover",borderRadius:10,flexShrink:0}}/>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2,flexWrap:"wrap"}}>
          <span style={{fontSize:8,color:C.t3}}>{o.id}</span>
          <span style={{background:(st?.c||C.t3)+"15",color:st?.c,padding:"2px 8px",borderRadius:8,fontSize:9,fontWeight:600}}>{st?.l}</span>
          {o.priority!=="normal"&&PM[o.priority]&&<span style={{background:PM[o.priority].c+"15",color:PM[o.priority].c,padding:"1px 6px",borderRadius:6,fontSize:8,fontWeight:700}}>{PM[o.priority].l}</span>}
          {o.production_number&&<span style={{background:C.acL,color:C.ac,padding:"1px 6px",borderRadius:6,fontSize:8,fontWeight:600}}>#{o.production_number}</span>}
          {late&&<span style={{background:C.dn+"12",color:C.dn,padding:"1px 5px",borderRadius:5,fontSize:7,fontWeight:700}}>⚠️ RETRASO</span>}
          {stale&&<span style={{background:(stale.lv==="critical"?C.dn:C.wn)+"12",color:stale.lv==="critical"?C.dn:C.wn,padding:"1px 5px",borderRadius:5,fontSize:7,fontWeight:700}}>{stale.lb}</span>}
          {o.proof_approved&&<span style={{background:C.ok+"12",color:C.ok,padding:"1px 5px",borderRadius:5,fontSize:7}}>✓Prueba</span>}
          {o.file_url&&<span style={{background:"#007aff12",color:"#007aff",padding:"1px 5px",borderRadius:5,fontSize:7}}>📁</span>}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{color:C.tx,fontWeight:700,fontSize:compact?12:14,cursor:"pointer"}} onClick={e=>{e.stopPropagation();!compact&&onAction(o.id,"client_history")}}>{o.client}{!hp&&!compact&&o.client_company&&<span style={{fontWeight:400,color:C.t2,fontSize:11}}> · {o.client_company}</span>}</div>
            {!compact&&!hp&&o.client_phone&&<div style={{fontSize:10,color:"#25d366",marginTop:1}}>📱 {o.client_lada||"+52"} {o.client_phone}</div>}
            <div style={{color:C.t2,fontSize:compact?10:11,marginTop:1}}>{o.product||o.product_type}{o.quantity?" · "+Number(o.quantity).toLocaleString()+" pzas":""}</div>
            {!compact&&o.paper_type&&<div style={{color:C.t3,fontSize:10,marginTop:2}}>📄 {o.paper_type}{o.width_cm?" | "+o.width_cm+"×"+o.height_cm+"cm":""}{o.colors?" | "+o.colors:""}</div>}
            {o.due_date&&!compact&&<div style={{color:late?C.dn:C.t3,fontSize:10,marginTop:1}}>📅 {fD(o.due_date)}</div>}
          </div>
          {!compact&&<div style={{textAlign:"right",minWidth:70,flexShrink:0}}>
            {!hp?(o.price?<div style={{fontSize:15,fontWeight:800}}>{fmt(o.price)}</div>:isMaq&&o.maq_price?<div style={{fontSize:15,fontWeight:800}}>{fmt(o.maq_price)}</div>:<span style={{fontSize:10,color:C.t2}}>Sin precio</span>):(o.price||o.maq_price?<span style={{fontSize:10,color:C.ok}}>✓Precio</span>:<span style={{fontSize:10,color:C.wn}}>⏳</span>)}
          </div>}
        </div>
        {!compact&&o.stage==="in_production"&&(()=>{const a=(o.machine_log||[]).find(e=>!e.ended);return a?<div style={{marginTop:3}}><span style={{fontSize:10,color:C.ac}}>🏭 {MACHINES.find(x=>x.id===a.machine)?.name}</span> <LiveTimer started={a.started}/></div>:null})()}
        {!compact&&<ProgressBar order={o}/>}
      </div>
    </div>

    {!compact&&canAct&&<div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
      {o.stage==="draft"&&(role==="produccion"||role==="preprensa"||role==="admin")&&<>{(role==="preprensa"||role==="admin")&&<button onClick={()=>onAction(o.id,"edit_specs")} style={bt("#ec4899")}>✏️ Editar Specs</button>}{(role==="produccion"||role==="admin")&&<button onClick={()=>onAction(o.id,"edit")} style={bt("#007aff")}>🔍 Revisar Specs</button>}{role==="produccion"&&!o.validated_by_production&&<button onClick={()=>onAction(o.id,"validate_prod")} style={bt(C.ok)}>✅ Validar Producción</button>}{role==="produccion"&&o.validated_by_production&&<span style={{fontSize:10,color:C.ok,fontWeight:600,padding:"8px 0"}}>✅ Ya validaste</span>}{role==="preprensa"&&!o.validated_by_preprensa&&<button onClick={()=>onAction(o.id,"validate_pre")} style={bt(C.ok)}>✅ Validar Pre-prensa</button>}{role==="preprensa"&&o.validated_by_preprensa&&<span style={{fontSize:10,color:C.ok,fontWeight:600,padding:"8px 0"}}>✅ Ya validaste</span>}{role==="admin"&&<button onClick={()=>onAction(o.id,"advance","design")} style={bt("#ec4899")}>🎨 Enviar a Diseño</button>}<div style={{display:"flex",gap:4,fontSize:9,color:C.t2,alignItems:"center",padding:"4px 0"}}><span style={{color:o.validated_by_production?C.ok:C.wn}}>{o.validated_by_production?"✅":"⏳"} Prod</span><span style={{color:o.validated_by_preprensa?C.ok:C.wn}}>{o.validated_by_preprensa?"✅":"⏳"} Pre-p</span></div></>}
      {o.stage==="design"&&(role==="preprensa"||role==="produccion"||role==="admin")&&<><button onClick={()=>onAction(o.id,"advance","proof_printing")} style={bt("#8b5cf6")}>🖨️ Prueba de Color{recProof(o)?" (Rec.)":""}</button><button onClick={()=>onAction(o.id,"advance","ctp")} style={bt("#0891b2")}>💿 Directo a CTP</button><button onClick={()=>onAction(o.id,"advance","ready")} style={bt(C.ok)}>⏩ Sin CTP, Lista</button></>}
      {o.stage==="proof_printing"&&(role==="preprensa"||role==="produccion"||role==="admin")&&<button onClick={()=>onAction(o.id,"advance","proof_client")} style={bt("#f59e0b")}>📤 Enviar Prueba al Cliente</button>}
      {o.stage==="proof_client"&&(role==="preprensa"||role==="produccion"||role==="admin")&&<><button onClick={()=>onAction(o.id,"approve_proof")} style={bt(C.ok)}>✅ Cliente Aprobó</button><button onClick={()=>onAction(o.id,"advance","design")} style={bt(C.dn)}>❌ Pide Cambios</button></>}
      {o.stage==="ctp"&&(role==="preprensa"||role==="produccion"||role==="admin")&&<button onClick={()=>onAction(o.id,"advance","ready")} style={bt(C.ok)}>✅ Placas Listas</button>}
      {o.stage==="ready"&&<div style={{fontSize:12,color:C.ac,padding:"8px 0"}}>👆 Arrastra esta orden a una máquina en el <strong>Tablero</strong></div>}
      {o.stage==="in_production"&&<><button onClick={()=>onAction(o.id,"advance","packaging")} style={bt(C.ok)}>📦 Enviar a Empaque</button><button onClick={()=>onAction(o.id,"send_maquila")} style={bt("#e67e22")}>🚚 Enviar a Maquila</button></>}
      {o.stage==="maquila_out"&&<button onClick={()=>onAction(o.id,"advance","maquila_in")} style={bt("#32ade6")}>📥 Recibido de Maquila</button>}
      {o.stage==="maquila_in"&&<button onClick={()=>onAction(o.id,"advance","in_production")} style={bt("#007aff")}>🔄 Continuar Producción</button>}
      {o.stage==="packaging"&&<button onClick={()=>onAction(o.id,"advance","delivered")} style={bt(C.ok)}>✅ Marcar Entregada</button>}
      {o.stage==="maq_created"&&<button onClick={()=>onAction(o.id,"advance","maq_sent")} style={bt("#e67e22")}>🚚 Marcar Enviada</button>}
      {o.stage==="maq_sent"&&<button onClick={()=>onAction(o.id,"advance","maq_in_progress")} style={bt(C.wn)}>⚙️ Proveedor Trabajando</button>}
      {o.stage==="maq_in_progress"&&<button onClick={()=>onAction(o.id,"advance","maq_received")} style={bt("#32ade6")}>📥 Recibimos el Trabajo</button>}
      {o.stage==="maq_received"&&<button onClick={()=>onAction(o.id,"advance","maq_delivered")} style={bt(C.ok)}>✅ Entregada al Cliente</button>}
      <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
        {(o.stage.includes("delivered")||role==="admin")&&<button onClick={()=>onAction(o.id,"duplicate")} style={bs(C.sf,"#5856d6")} title="Duplicar">📋</button>}
        <button onClick={()=>onAction(o.id,"print")} style={bs(C.sf,C.t2)} title="Imprimir">🖨️</button>
        <button onClick={()=>onAction(o.id,"flow")} style={bs(C.sf,C.t2)} title="Ver flujo">🔀</button>
        {role==="admin"&&!o.stage.includes("delivered")&&<button onClick={()=>onAction(o.id,"edit")} style={bs(C.sf,C.t2)} title="Editar">✏️</button>}
        {role==="admin"&&o.stage!=="draft"&&o.stage!=="maq_created"&&<button onClick={()=>onAction(o.id,"revert")} style={bs(C.sf,C.wn)} title="Regresar">↩️</button>}
      </div>
    </div>}

    {!compact&&(role==="produccion"||role==="admin")&&["in_production","maquila_out","maquila_in","packaging","delivered"].includes(o.stage)&&<div onClick={e=>e.stopPropagation()} style={{marginTop:6,padding:"8px 12px",background:C.wn+"06",borderRadius:10}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:C.wn,fontWeight:600}}>🗑️ Merma</span><button onClick={()=>onAction(o.id,"waste")} style={bs(C.wn)}>+ Registrar</button></div>
      {(o.waste_log||[]).length>0&&<div style={{marginTop:4,display:"flex",gap:4,flexWrap:"wrap"}}>{(o.waste_log||[]).map((w,i)=><span key={i} style={{fontSize:9,color:C.wn,background:C.bg,padding:"2px 8px",borderRadius:6}}>{w.pliegos?"📄"+w.pliegos+"pl":""}{w.pliegos&&w.qty?" ":""}{w.qty?"📦"+w.qty+"pz":""}{w.note?" — "+w.note:""}</span>)}</div>}
    </div>}
    {!compact&&o.timeline?.length>0&&<div onClick={e=>e.stopPropagation()}><Timeline tl={o.timeline}/></div>}
    {!compact&&(isMaq||o.comments?.length>0)&&<div onClick={e=>e.stopPropagation()}><CommentLog comments={o.comments||[]} onAdd={c=>onAction(o.id,"comment",c)} role={role}/></div>}
  </div>;
}

// ─── PIPELINE ──────────────────────────────────────
// ─── MAQUILA TRACKER ──────────────────────────────
function MaquilaTracker({orders,onAction,role}) {
  // Partial maquila: orders from production sent to vendor
  const partial=orders.filter(o=>o.stage==="maquila_out");
  // Full maquila: orders that are entirely external (not delivered)
  const full=orders.filter(o=>o.order_type==="maquila"&&!o.stage.includes("delivered"));
  const all=[...partial,...full];
  if(all.length===0)return null;

  // Get days since order entered maquila stage
  const getDays=o=>{const tl=(o.timeline||[]).slice().reverse();const entry=tl.find(t=>t.action?.includes("Maquila")||t.action?.includes("🚚"));const d=entry?entry.date:o.created_at;return Math.max(0,Math.round((Date.now()-new Date(d).getTime())/86400000))};

  // Group by provider
  const byProv={};all.forEach(o=>{const p=o.maquila_provider||o.maq_provider||"Sin proveedor";if(!byProv[p])byProv[p]={orders:[],totalDays:0};byProv[p].orders.push(o);byProv[p].totalDays+=getDays(o)});
  const provs=Object.entries(byProv).sort((a,b)=>b[1].orders.length-a[1].orders.length);

  return <div style={{background:"#e67e22"+"08",border:"1.5px solid #e67e22"+"25",borderRadius:16,padding:16,marginBottom:16}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14,fontWeight:800,color:"#e67e22"}}>🚚 En Maquila</span>
        <div style={{background:"#e67e22",color:"#fff",padding:"2px 10px",borderRadius:10,fontSize:11,fontWeight:700}}>{all.length}</div>
      </div>
      <div style={{display:"flex",gap:8,fontSize:10,color:C.t2}}>
        {partial.length>0&&<span>🔄 {partial.length} parcial{partial.length>1?"es":""}</span>}
        {full.length>0&&<span>📋 {full.length} completa{full.length>1?"s":""}</span>}
      </div>
    </div>

    {provs.map(([prov,d])=>{const sample=d.orders.find(o=>o.maquila_phone||o.maquila_email);return <div key={prov} style={{marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
        <div style={{background:"#e67e22"+"15",padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:700,color:"#e67e22"}}>{prov}</div>
        <span style={{fontSize:10,color:C.t2}}>{d.orders.length} orden{d.orders.length>1?"es":""}</span>
        {sample?.maquila_phone&&<a href={"https://wa.me/"+(sample.maquila_phone.replace(/\D/g,"").replace(/^(?!52|1)/,"52"))} target="_blank" rel="noopener" style={{fontSize:10,color:"#25d366",textDecoration:"none",fontWeight:500}}>📱 {sample.maquila_phone}</a>}
        {sample?.maquila_email&&<a href={"mailto:"+sample.maquila_email} style={{fontSize:10,color:"#007aff",textDecoration:"none",fontWeight:500}}>📧 {sample.maquila_email}</a>}
      </div>
      {d.orders.map(o=>{const days=getDays(o);const st=SM[o.stage];const hp=role==="produccion"||role==="preprensa";
        return <div key={o.id} onClick={()=>onAction(o.id,"detail")} style={{background:C.bg,borderRadius:10,padding:12,marginBottom:6,cursor:"pointer",borderLeft:"3px solid "+(days>=7?"#ff3b30":days>=3?"#ff9500":"#e67e22"),boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700}}>{o.client}</div>
              <div style={{fontSize:10,color:C.t2}}>{o.product_type}{o.quantity?" · "+Number(o.quantity).toLocaleString()+" pzas":""}</div>
              <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                <span style={{background:(st?.c||C.t3)+"15",color:st?.c,padding:"1px 6px",borderRadius:6,fontSize:9,fontWeight:600}}>{st?.l}</span>
                {o.order_type==="maquila"?<span style={{background:"#e67e22"+"12",color:"#e67e22",padding:"1px 6px",borderRadius:6,fontSize:9}}>Maquila completa</span>:<span style={{background:"#32ade6"+"12",color:"#32ade6",padding:"1px 6px",borderRadius:6,fontSize:9}}>Maquila parcial</span>}
                {o.priority==="urgente"&&<span style={{background:C.dn+"12",color:C.dn,padding:"1px 6px",borderRadius:6,fontSize:9,fontWeight:700}}>🔴 Urgente</span>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:16,fontWeight:800,color:days>=7?C.dn:days>=3?C.wn:"#e67e22"}}>{days}d</div>
              <div style={{fontSize:8,color:C.t3}}>en maquila</div>
              {!hp&&(o.price||o.maq_price)&&<div style={{fontSize:11,fontWeight:600,color:C.ok,marginTop:2}}>{fmt(parseFloat(o.price)||parseFloat(o.maq_price))}</div>}
            </div>
          </div>
          {o.due_date&&<div style={{fontSize:9,color:new Date(o.due_date)<new Date()?C.dn:C.t3,marginTop:4}}>📅 Entrega: {fD(o.due_date)}{new Date(o.due_date)<new Date()?" ⚠️ RETRASO":""}</div>}
        </div>})}
    </div>})}
  </div>;
}

function Pipeline({orders,role,onAction}) {
  const iSt=INT_FLOW.filter(s=>s.id!=="delivered");const mSt=MAQ_FLOW.filter(s=>s.id!=="maq_delivered");
  const intO=orders.filter(o=>o.order_type!=="maquila"&&o.stage!=="delivered");const maqO=orders.filter(o=>o.order_type==="maquila"&&o.stage!=="maq_delivered");
  const delC=orders.filter(o=>o.stage.includes("delivered")).length;const staleC=orders.filter(o=>getStale(o)).length;
  return <div>
    {staleC>0&&<div style={{background:C.wn+"08",border:"1px solid "+C.wn+"20",borderRadius:10,padding:"8px 14px",marginBottom:12,fontSize:12,color:C.wn,fontWeight:600}}>⚠️ {staleC} orden{staleC>1?"es":""} sin avance en más de 24h</div>}
    <div style={{fontSize:11,fontWeight:600,color:C.ac,textTransform:"uppercase",marginBottom:8}}>🏭 Internas ({intO.length})</div>
    <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:16}}>
      {iSt.map(st=>{const so=intO.filter(o=>o.stage===st.id).sort(prioSort);return <div key={st.id} style={{minWidth:190,maxWidth:230,flex:"0 0 auto",background:C.sf,borderRadius:14,padding:12,borderTop:"3px solid "+st.c}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:10,fontWeight:700,color:st.c}}>{st.l}</div><div style={{background:st.c+"15",color:st.c,width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{so.length}</div></div>{so.length===0?<div style={{textAlign:"center",padding:"12px 0",color:C.ph,fontSize:10}}>Sin órdenes</div>:so.map(o=><OCard key={o.id} o={o} role={role} onAction={onAction} compact/>)}</div>})}
      <div style={{minWidth:90,flex:"0 0 auto",background:C.ok+"08",borderRadius:14,padding:12,borderTop:"3px solid "+C.ok,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:22,fontWeight:800,color:C.ok}}>{delC}</div><div style={{fontSize:9,color:C.t2}}>Entregadas</div></div>
    </div>
    {maqO.length>0&&<><div style={{fontSize:11,fontWeight:600,color:"#e67e22",textTransform:"uppercase",marginBottom:8}}>🚚 Maquila ({maqO.length})</div><div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10}}>{mSt.map(st=>{const so=maqO.filter(o=>o.stage===st.id);return <div key={st.id} style={{minWidth:190,maxWidth:230,flex:"0 0 auto",background:C.sf,borderRadius:14,padding:12,borderTop:"3px solid "+st.c}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:10,fontWeight:700,color:st.c}}>{st.l}</div><div style={{background:st.c+"15",color:st.c,width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{so.length}</div></div>{so.length===0?<div style={{textAlign:"center",padding:"12px 0",color:C.ph,fontSize:10}}>—</div>:so.map(o=><OCard key={o.id} o={o} role={role} onAction={onAction} compact/>)}</div>})}</div></>}
  </div>;
}

// ─── KANBAN ────────────────────────────────────────
function Kanban({orders,onDrop,onAction,role}) {
  const ready=orders.filter(o=>o.stage==="ready").sort(prioSort);const inProd=orders.filter(o=>o.stage==="in_production");
  const [dO,setDO]=useState(null);const [collapsed,setCollapsed]=useState({});
  const [dropConfirm,setDropConfirm]=useState(null);
  const drop=(mid,e)=>{e.preventDefault();setDO(null);const oid=e.dataTransfer.getData("orderId");if(!oid)return;const o=orders.find(x=>x.id===oid);const m=MACHINES.find(x=>x.id===mid);if(!o||!m)return;if(o.current_machine===mid)return;const fromM=o.current_machine?MACHINES.find(x=>x.id===o.current_machine):null;setDropConfirm({oid,mid,order:o,machine:m,fromMachine:fromM})};
  const confirmDrop=()=>{if(dropConfirm)onDrop(dropConfirm.oid,dropConfirm.mid);setDropConfirm(null)};
  const cc={preprensa:"#0891b2",offset:C.ac,digital:"#7c3aed",acabados:"#e67e22"};
  const catLabel={preprensa:"💿 Pre-prensa",offset:"⚙️ Offset",digital:"🖨️ Digital",acabados:"🔧 Acabados"};
  const catCount=type=>inProd.filter(o=>{const m=MACHINES.find(x=>x.id===o.current_machine);return m?.type===type}).length;
  const toggle=type=>setCollapsed(p=>({...p,[type]:!p[type]}));

  return <div>
    {/* Summary bar */}
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
      <div style={{background:C.ok+"10",border:"1px solid "+C.ok+"30",borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:18,fontWeight:800,color:C.ok}}>{ready.length}</span><span style={{fontSize:11,color:C.ok,fontWeight:600}}>Listas</span>
      </div>
      {["offset","digital","acabados","preprensa"].map(type=>{const cnt=catCount(type);return <div key={type} style={{background:cc[type]+"10",border:"1px solid "+cc[type]+"30",borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:18,fontWeight:800,color:cc[type]}}>{cnt}</span><span style={{fontSize:11,color:cc[type],fontWeight:600}}>{type==="preprensa"?"Pre-p":type.charAt(0).toUpperCase()+type.slice(1)}</span>
      </div>})}
      <div style={{background:C.sf,borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:18,fontWeight:800,color:C.tx}}>{inProd.length}</span><span style={{fontSize:11,color:C.t2,fontWeight:600}}>Total en máquina</span>
      </div>
    </div>

    {/* Ready orders */}
    {ready.length>0&&<div style={{marginBottom:20,background:C.ok+"06",border:"1.5px solid "+C.ok+"25",borderRadius:16,padding:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{background:C.ok,color:"#fff",width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800}}>{ready.length}</div>
          <div><div style={{fontSize:13,fontWeight:700,color:C.ok}}>Órdenes Listas para Producción</div><div style={{fontSize:10,color:C.t2}}>Arrastra a una máquina para iniciar</div></div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8}}>{ready.map(o=><div key={o.id} draggable onDragStart={e=>e.dataTransfer.setData("orderId",o.id)} onClick={()=>onAction(o.id,"detail")} style={{background:C.bg,borderRadius:12,padding:12,cursor:"grab",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",borderLeft:"4px solid "+(o.priority==="urgente"?C.dn:C.ok)}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:12,fontWeight:700}}>⠿ {o.client}</div>
            <div style={{fontSize:10,color:C.t2,marginTop:1}}>{o.product_type}{o.quantity?" · "+Number(o.quantity).toLocaleString()+" pzas":""}</div>
            {o.paper_type&&<div style={{fontSize:9,color:C.t3,marginTop:1}}>📄 {o.paper_type}</div>}
          </div>
          <div style={{display:"flex",gap:3,flexShrink:0}}>
            {o.priority==="urgente"&&<span style={{background:C.dn+"15",color:C.dn,padding:"1px 6px",borderRadius:6,fontSize:8,fontWeight:700}}>🔴 Urgente</span>}
            {o.production_number&&<span style={{background:C.acL,color:C.ac,padding:"1px 6px",borderRadius:6,fontSize:8,fontWeight:600}}>#{o.production_number}</span>}
          </div>
        </div>
        {o.due_date&&<div style={{fontSize:9,color:new Date(o.due_date)<new Date()?C.dn:C.t3,marginTop:3}}>📅 Entrega: {fD(o.due_date)}</div>}
      </div>)}</div>
    </div>}

    {/* Empty state */}
    {ready.length===0&&inProd.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.t3}}><div style={{fontSize:48}}>🏭</div><div style={{fontSize:15,fontWeight:700,color:C.tx,marginTop:8}}>Tablero vacío</div><div style={{fontSize:12,color:C.t2,marginTop:4}}>Cuando una orden esté en "Lista", arrástrala aquí</div></div>}

    {/* Machine categories */}
    {["offset","digital","acabados","preprensa"].map(type=>{const ms=MACHINES.filter(m=>m.type===type&&m.status==="active");if(!ms.length)return null;
      const cnt=catCount(type);const isCol=collapsed[type];
      return <div key={type} style={{marginBottom:20}}>
        {/* Category header */}
        <div onClick={()=>toggle(type)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:cc[type]+"10",borderRadius:isCol?"12px":"12px 12px 0 0",cursor:"pointer",border:"1px solid "+cc[type]+"25",borderBottom:isCol?"1px solid "+cc[type]+"25":"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:14,fontWeight:800,color:cc[type]}}>{catLabel[type]}</span>
            <span style={{fontSize:10,color:C.t2}}>{ms.length} máquinas</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {cnt>0&&<div style={{background:cc[type],color:"#fff",padding:"2px 10px",borderRadius:10,fontSize:11,fontWeight:700}}>{cnt} en producción</div>}
            <span style={{fontSize:14,color:C.t2,transition:"transform .2s",transform:isCol?"rotate(-90deg)":"rotate(0)"}}>{isCol?"›":"▼"}</span>
          </div>
        </div>

        {/* Machines grid */}
        {!isCol&&<div style={{border:"1px solid "+cc[type]+"25",borderTop:"none",borderRadius:"0 0 12px 12px",padding:12,background:C.sf+"80"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
            {ms.map(m=>{const mo=orders.filter(o=>o.stage==="in_production"&&o.current_machine===m.id);const isD=dO===m.id;const hasWork=mo.length>0;
              return <div key={m.id} onDragOver={e=>{e.preventDefault();setDO(m.id)}} onDragLeave={()=>setDO(null)} onDrop={e=>drop(m.id,e)}
                style={{background:isD?cc[type]+"12":C.bg,borderRadius:14,padding:14,border:isD?"2px solid "+cc[type]:hasWork?"1.5px solid "+cc[type]+"40":"1.5px dashed "+C.bd,minHeight:100,transition:"all .15s",boxShadow:hasWork?"0 2px 8px "+cc[type]+"15":"none"}}>

                {/* Machine header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,paddingBottom:8,borderBottom:"0.5px solid "+C.bd}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:C.tx}}>{m.name}</div>
                    <div style={{fontSize:9,color:cc[type],fontWeight:500}}>{m.sub}</div>
                  </div>
                  {hasWork?<div style={{background:cc[type],color:"#fff",width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800}}>{mo.length}</div>
                  :<div style={{background:C.sf,color:C.ph,width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>—</div>}
                </div>

                {/* Drop zone or orders */}
                {mo.length===0?<div style={{textAlign:"center",padding:"12px 0",color:isD?cc[type]:C.ph,fontSize:isD?12:10,fontWeight:isD?600:400,transition:"all .15s"}}>
                  {isD?"⬇ Soltar aquí":"Disponible"}
                </div>
                :mo.map(o=><div key={o.id} draggable onDragStart={e=>e.dataTransfer.setData("orderId",o.id)} onClick={()=>onAction(o.id,"detail")}
                  style={{background:C.sf,borderRadius:10,padding:10,marginBottom:6,cursor:"grab",borderLeft:"3px solid "+(o.priority==="urgente"?C.dn:cc[type]),boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:700}}>⠿ {o.client}</span>
                    {(()=>{const a=(o.machine_log||[]).find(e=>!e.ended);return a?<LiveTimer started={a.started}/>:null})()}
                  </div>
                  <div style={{fontSize:9,color:C.t2,marginTop:2}}>{o.product_type}{o.quantity?" · "+Number(o.quantity).toLocaleString():""}</div>
                  {o.priority==="urgente"&&<span style={{background:C.dn+"12",color:C.dn,padding:"1px 5px",borderRadius:5,fontSize:7,fontWeight:700,marginTop:3,display:"inline-block"}}>🔴 URGENTE</span>}
                  {o.due_date&&<div style={{fontSize:8,color:new Date(o.due_date)<new Date()?C.dn:C.t3,marginTop:2}}>📅 {fD(o.due_date)}</div>}
                  <div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:4,marginTop:6}}>
                    <button onClick={()=>onAction(o.id,"advance","packaging")} style={bs(C.ok)}>📦 Empaque</button>
                    <button onClick={()=>onAction(o.id,"send_maquila")} style={{...bs("#e67e22"),padding:"4px 8px"}}>🚚 Maquila</button>
                    <button onClick={()=>onAction(o.id,"waste")} style={{...bs(C.sf,C.t2),padding:"4px 8px",boxShadow:"0 0 0 0.5px "+C.bd}}>🗑️</button>
                  </div>
                </div>)}
              </div>})}
          </div>
        </div>}
      </div>})}

    {/* Drop confirmation modal */}
    {dropConfirm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
      <div style={{background:C.bg,borderRadius:20,padding:28,maxWidth:420,width:"90%",textAlign:"center"}}>
        <div style={{fontSize:36,marginBottom:8}}>{dropConfirm.fromMachine?"🔄":"🏭"}</div>
        <h3 style={{fontSize:16,fontWeight:700,margin:"0 0 8px"}}>{dropConfirm.fromMachine?"¿Mover de máquina?":"¿Asignar a máquina?"}</h3>
        <div style={{background:C.sf,borderRadius:12,padding:14,marginBottom:16,textAlign:"left"}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{dropConfirm.order.client}</div>
          <div style={{fontSize:11,color:C.t2}}>{dropConfirm.order.product_type}{dropConfirm.order.quantity?" · "+Number(dropConfirm.order.quantity).toLocaleString()+" pzas":""}</div>
          {dropConfirm.order.priority==="urgente"&&<span style={{background:C.dn+"15",color:C.dn,padding:"1px 6px",borderRadius:6,fontSize:9,fontWeight:700,marginTop:4,display:"inline-block"}}>🔴 Urgente</span>}
          <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
            {dropConfirm.fromMachine&&<><span style={{fontSize:12,fontWeight:600,color:C.dn}}>{dropConfirm.fromMachine.name}</span><span style={{fontSize:14}}>→</span></>}
            <span style={{fontSize:12,fontWeight:700,color:C.ok}}>{dropConfirm.machine.name}</span>
            <span style={{fontSize:9,color:C.t2}}>({dropConfirm.machine.sub})</span>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setDropConfirm(null)} style={{...bt(C.sf,C.t2),flex:1,justifyContent:"center",border:"0.5px solid "+C.bd}}>Cancelar</button>
          <button onClick={confirmDrop} style={{...bt(dropConfirm.fromMachine?C.wn:C.ok),flex:1,justifyContent:"center"}}>{dropConfirm.fromMachine?"🔄 Sí, mover":"✅ Sí, asignar"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

// ─── STORAGE TAB ──────────────────────────────────
function StorageTab({orders,onReload}) {
  const [cleaning,setCleaning]=useState(false);const [cleaned,setCleaned]=useState(0);
  const [storageUsed,setStorageUsed]=useState(null);const [loadingSize,setLoadingSize]=useState(true);
  const [deleting,setDeleting]=useState(null);
  const maxStorage=1024; // 1GB in MB
  const withFile=orders.filter(o=>o.file_url);
  const oldFiles=withFile.filter(o=>{const d=new Date(o.created_at);return(Date.now()-d.getTime())>30*86400000});

  // Calculate storage usage from Supabase
  useEffect(()=>{
    (async()=>{
      setLoadingSize(true);
      try{
        const{data}=await supabase.storage.from("order-files").list("",{limit:1000});
        if(!data){setStorageUsed(0);setLoadingSize(false);return}
        // List all folders and their files
        let totalBytes=0;
        for(const folder of data){
          if(folder.id){totalBytes+=folder.metadata?.size||0;continue}
          const{data:files}=await supabase.storage.from("order-files").list(folder.name,{limit:100});
          if(files)files.forEach(f=>{totalBytes+=f.metadata?.size||0});
        }
        setStorageUsed(Math.round(totalBytes/1024/1024*10)/10);
      }catch{setStorageUsed(null)}
      setLoadingSize(false);
    })();
  },[cleaned,deleting]);

  const usedPct=storageUsed!==null?Math.min((storageUsed/maxStorage)*100,100):0;
  const barColor=usedPct>=90?"#ff3b30":usedPct>=70?"#ff9500":"#34c759";

  const cleanup=async()=>{if(!confirm("¿Borrar archivos de órdenes con más de 30 días? ("+oldFiles.length+" archivos)\n\nEsta acción no se puede deshacer."))return;setCleaning(true);let c=0;for(const o of oldFiles){try{const path=o.file_url.split("/order-files/")[1];if(path)await supabase.storage.from("order-files").remove([decodeURIComponent(path)]);await supabase.from("orders").update({file_url:null,file_name:null}).eq("id",o.id);c++}catch{}}setCleaned(c);setCleaning(false);if(c>0&&onReload)onReload()};

  const deleteOne=async(o)=>{if(!confirm("¿Borrar archivo de "+o.client+"?\n"+o.file_name))return;setDeleting(o.id);try{const path=o.file_url.split("/order-files/")[1];if(path)await supabase.storage.from("order-files").remove([decodeURIComponent(path)]);await supabase.from("orders").update({file_url:null,file_name:null}).eq("id",o.id);if(onReload)onReload()}catch{alert("Error al borrar")}setDeleting(null)};

  const Stat=({l,v,s:sub,c=C.tx})=><div style={{background:C.sf,borderRadius:12,padding:18,flex:"1 1 180px",minWidth:150}}><div style={{fontSize:9,color:C.t2,fontWeight:600,textTransform:"uppercase",marginBottom:3}}>{l}</div><div style={{fontSize:24,fontWeight:800,color:c}}>{v}</div>{sub&&<div style={{fontSize:9,color:C.t3,marginTop:1}}>{sub}</div>}</div>;

  return <div>
    {/* Storage usage bar */}
    <div style={{background:C.sf,borderRadius:14,padding:20,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:700}}>💾 Almacenamiento Supabase</div>
        <div style={{fontSize:12,fontWeight:700,color:barColor}}>{loadingSize?"⏳ Calculando...":(storageUsed!==null?storageUsed+" MB":"Error")}<span style={{color:C.t3,fontWeight:400}}> / {maxStorage>=1024?"1 GB":maxStorage+" MB"}</span></div>
      </div>
      <div style={{background:C.bg,borderRadius:8,height:20,overflow:"hidden",border:"0.5px solid "+C.bd}}>
        <div style={{width:usedPct+"%",height:"100%",background:barColor,borderRadius:8,transition:"width .8s ease",minWidth:usedPct>0?"8px":"0"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
        <span style={{fontSize:9,color:C.t3}}>{usedPct.toFixed(1)}% usado</span>
        <span style={{fontSize:9,color:C.t3}}>{storageUsed!==null?(maxStorage-storageUsed).toFixed(1)+" MB libres":"—"}</span>
      </div>
      {usedPct>=70&&<div style={{marginTop:8,padding:"6px 10px",background:barColor+"10",border:"1px solid "+barColor+"30",borderRadius:8,fontSize:11,color:barColor,fontWeight:600}}>{usedPct>=90?"⚠️ Almacenamiento casi lleno — limpia archivos antiguos":"⚡ Más del 70% usado — considera limpiar archivos antiguos"}</div>}
    </div>

    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
      <Stat l="📁 Total con Archivo" v={withFile.length} s={orders.length+" órdenes totales"} c={C.ac}/>
      <Stat l="📦 Archivos >30 días" v={oldFiles.length} s="elegibles para limpieza" c={oldFiles.length>0?C.wn:C.ok}/>
    </div>

    {/* Bulk cleanup */}
    {oldFiles.length>0&&<div style={{background:C.wn+"08",border:"1px solid "+C.wn+"25",borderRadius:14,padding:16,marginBottom:16}}>
      <div style={{fontSize:12,fontWeight:600,color:C.wn,marginBottom:8}}>🗑️ Limpieza Masiva — Archivos +30 días</div>
      <p style={{fontSize:11,color:C.t2,margin:"0 0 12px"}}>Hay {oldFiles.length} archivo{oldFiles.length>1?"s":""} de órdenes con más de 30 días.</p>
      <button onClick={cleanup} disabled={cleaning} style={{...bt(cleaning?"#d1d1d6":C.wn),cursor:cleaning?"wait":"pointer"}}>{cleaning?"⏳ Limpiando...":cleaned>0?"✅ "+cleaned+" borrados":"🗑️ Borrar Todos los Antiguos ("+oldFiles.length+")"}</button>
    </div>}
    {oldFiles.length===0&&<div style={{background:C.ok+"08",border:"1px solid "+C.ok+"25",borderRadius:14,padding:16,marginBottom:16,textAlign:"center"}}><div style={{fontSize:14,fontWeight:700,color:C.ok}}>✅ Sin archivos antiguos</div><div style={{fontSize:11,color:C.t2,marginTop:4}}>Todos los archivos tienen menos de 30 días</div></div>}

    {/* File list with individual delete */}
    <div style={{background:C.sf,borderRadius:14,padding:16}}>
      <div style={{fontSize:11,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:10}}>📁 Todos los Archivos ({withFile.length})</div>
      {withFile.map(o=>{const age=Math.round((Date.now()-new Date(o.created_at).getTime())/86400000);const isDel=deleting===o.id;return <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"0.5px solid "+C.bd,opacity:isDel?.5:1}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:16}}>📄</span>
            <div style={{minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.client}</div>
              <div style={{fontSize:9,color:C.t3}}>{o.file_name} · {age} días · {o.product_type}</div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
          {age>30&&<span style={{background:C.wn+"15",color:C.wn,padding:"1px 6px",borderRadius:6,fontSize:8,fontWeight:600}}>+30d</span>}
          <a href={o.file_url} target="_blank" rel="noopener" download={o.file_name} style={{...bs("#007aff"),textDecoration:"none"}}>⬇</a>
          <button onClick={()=>deleteOne(o)} disabled={isDel} style={{...bs(C.sf,C.dn),border:"0.5px solid "+C.dn+"30",cursor:isDel?"wait":"pointer"}} title="Borrar archivo">🗑️</button>
        </div>
      </div>})}
      {withFile.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:C.t3,fontSize:12}}>Sin archivos subidos aún</div>}
    </div>
  </div>;
}

// ─── ANALYTICS ─────────────────────────────────────
function Analytics({orders,onReload}) {
  const [selMachine,setSelMachine]=useState(null);const [tab,setTab]=useState("finance");
  const del=orders.filter(o=>o.stage.includes("delivered"));
  const intOrders=orders.filter(o=>o.order_type!=="maquila");
  const maqOrders=orders.filter(o=>o.order_type==="maquila");
  const tR=intOrders.reduce((s,o)=>s+(parseFloat(o.price)||0),0);
  const mR=maqOrders.reduce((s,o)=>s+(parseFloat(o.maq_price)||0),0);
  const mC=maqOrders.reduce((s,o)=>s+(parseFloat(o.maq_cost)||0),0);
  const totalRev=tR+mR;
  const avgTicket=del.length>0?del.reduce((s,o)=>s+(parseFloat(o.price)||parseFloat(o.maq_price)||0),0)/del.length:0;

  // Monthly revenue trend
  const byMonth={};orders.forEach(o=>{const d=o.created_at?o.created_at.slice(0,7):"";if(!d)return;if(!byMonth[d])byMonth[d]={rev:0,cnt:0,del:0};byMonth[d].rev+=(parseFloat(o.price)||parseFloat(o.maq_price)||0);byMonth[d].cnt++;if(o.stage.includes("delivered"))byMonth[d].del++});
  const months=Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
  const maxMR=Math.max(...months.map(([,d])=>d.rev),1);
  const curM=new Date().toISOString().slice(0,7);const prevM=new Date(Date.now()-30*86400000).toISOString().slice(0,7);
  const curRev=byMonth[curM]?.rev||0;const prevRev=byMonth[prevM]?.rev||0;
  const revChange=prevRev>0?Math.round(((curRev-prevRev)/prevRev)*100):0;

  // Machine stats with revenue calculation
  const byM={};orders.forEach(o=>{const price=parseFloat(o.price)||parseFloat(o.maq_price)||0;const totalMin=(o.machine_log||[]).reduce((s,e)=>s+(e.minutes||0),0);(o.machine_log||[]).forEach(e=>{if(!e.minutes)return;if(!byM[e.machine])byM[e.machine]={j:0,m:0,rev:0,types:{},orders:[]};byM[e.machine].j++;byM[e.machine].m+=e.minutes;if(totalMin>0)byM[e.machine].rev+=price*(e.minutes/totalMin);byM[e.machine].types[o.product_type]=(byM[e.machine].types[o.product_type]||0)+1;byM[e.machine].orders.push({id:o.id,client:o.client,type:o.product_type,min:e.minutes,price})})});
  const mStats=Object.entries(byM).map(([mid,d])=>{const m=MACHINES.find(x=>x.id===mid);const hrs=d.m/60;return{mid,m,j:d.j,t:d.m,hrs,a:Math.round(d.m/d.j),rev:d.rev,mxnHr:hrs>0?d.rev/hrs:0,types:d.types,orders:d.orders}}).filter(x=>x.m).sort((a,b)=>b.rev-a.rev);
  const maxMRev=Math.max(...mStats.map(x=>x.rev),1);

  // Product type stats
  const byType={};orders.forEach(o=>{const p=o.product_type;if(!byType[p])byType[p]={cnt:0,rev:0};byType[p].cnt++;byType[p].rev+=(parseFloat(o.price)||parseFloat(o.maq_price)||0)});
  const sT=Object.entries(byType).sort((a,b)=>b[1].rev-a[1].rev);const mxT=sT[0]?.[1]?.rev||1;

  // Top clients
  const byClient={};orders.forEach(o=>{const c=o.client;if(!c)return;if(!byClient[c])byClient[c]={cnt:0,rev:0,last:o.created_at};byClient[c].cnt++;byClient[c].rev+=(parseFloat(o.price)||parseFloat(o.maq_price)||0);if(o.created_at>byClient[c].last)byClient[c].last=o.created_at});
  const topClients=Object.entries(byClient).sort((a,b)=>b[1].rev-a[1].rev).slice(0,10);

  // Efficiency metrics
  const onTime=del.filter(o=>o.due_date&&(o.delivered_at||o.deliveredAt)&&new Date(o.delivered_at||o.deliveredAt)<=new Date(o.due_date+"T23:59:59")).length;
  const late=del.filter(o=>o.due_date&&(o.delivered_at||o.deliveredAt)&&new Date(o.delivered_at||o.deliveredAt)>new Date(o.due_date+"T23:59:59")).length;
  const onTimePct=(onTime+late)>0?Math.round((onTime/(onTime+late))*100):del.length>0?100:0;
  const totalWastePl=orders.reduce((s,o)=>(o.waste_log||[]).reduce((ss,w)=>ss+(w.pliegos||0),s),0);
  const totalWastePz=orders.reduce((s,o)=>(o.waste_log||[]).reduce((ss,w)=>ss+(w.qty||0),s),0);
  const avgProdTime=del.filter(o=>(o.delivered_at||o.deliveredAt)&&o.created_at).map(o=>Math.round((new Date(o.delivered_at||o.deliveredAt)-new Date(o.created_at))/86400000));
  const avgDays=avgProdTime.length>0?Math.round(avgProdTime.reduce((s,d)=>s+d,0)/avgProdTime.length):0;

  const cls=["#546e7a","#34c759","#ff3b30","#ff9500","#5856d6","#32ade6","#af52de","#007aff"];
  const tc={preprensa:"#0891b2",offset:C.ac,digital:"#7c3aed",acabados:"#e67e22"};
  const Stat=({l,v,s:sub,c=C.tx,big})=><div style={{background:C.sf,borderRadius:12,padding:big?18:14,flex:big?"1 1 180px":"1 1 130px",minWidth:big?150:120}}><div style={{fontSize:9,color:C.t2,fontWeight:600,textTransform:"uppercase",marginBottom:3}}>{l}</div><div style={{fontSize:big?24:18,fontWeight:800,color:c}}>{v}</div>{sub&&<div style={{fontSize:9,color:C.t3,marginTop:1}}>{sub}</div>}</div>;

  const selM=selMachine?mStats.find(x=>x.mid===selMachine):null;

  return <div>
    {/* Tab navigation */}
    <div style={{display:"flex",gap:4,marginBottom:16,overflowX:"auto"}}>
      {[{id:"finance",l:"💰 Financiero"},{id:"machines",l:"🏭 Máquinas"},{id:"efficiency",l:"📊 Eficiencia"},{id:"clients",l:"👥 Clientes"},{id:"storage",l:"📁 Archivos"}].map(t=>
        <button key={t.id} onClick={()=>{setTab(t.id);setSelMachine(null)}} style={{background:tab===t.id?C.ac:C.sf,color:tab===t.id?"#fff":C.t2,border:"none",padding:"8px 16px",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Poppins',sans-serif",whiteSpace:"nowrap"}}>{t.l}</button>
      )}
    </div>

    {/* ══ FINANCIERO ══ */}
    {tab==="finance"&&<div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        <Stat l="💰 Ingresos Totales" v={fmt(totalRev)} s={orders.length+" órdenes"} c={C.ok} big/>
        <Stat l="🏭 Producción Interna" v={fmt(tR)} s={intOrders.length+" órdenes"} c={C.ac} big/>
        <Stat l="🚚 Maquila" v={fmt(mR)} s={"Ganancia: "+fmt(mR-mC)+" ("+(mR>0?Math.round(((mR-mC)/mR)*100):0)+"%)"} c="#e67e22" big/>
        <Stat l="🎫 Ticket Promedio" v={fmt(avgTicket)} s={del.length+" entregadas"} c="#5856d6" big/>
      </div>

      {/* Mes actual vs anterior */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
        <div style={{background:C.sf,borderRadius:14,padding:16}}>
          <div style={{fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:6}}>📅 Mes Actual</div>
          <div style={{fontSize:28,fontWeight:800,color:C.ok}}>{fmt(curRev)}</div>
          <div style={{fontSize:11,color:revChange>=0?C.ok:C.dn,fontWeight:600,marginTop:4}}>{revChange>=0?"▲":"▼"} {Math.abs(revChange)}% vs mes anterior</div>
          <div style={{fontSize:10,color:C.t3,marginTop:2}}>{byMonth[curM]?.cnt||0} órdenes · {byMonth[curM]?.del||0} entregadas</div>
        </div>
        <div style={{background:C.sf,borderRadius:14,padding:16}}>
          <div style={{fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:6}}>📅 Mes Anterior</div>
          <div style={{fontSize:28,fontWeight:800,color:C.t2}}>{fmt(prevRev)}</div>
          <div style={{fontSize:10,color:C.t3,marginTop:4}}>{byMonth[prevM]?.cnt||0} órdenes · {byMonth[prevM]?.del||0} entregadas</div>
        </div>
      </div>

      {/* Revenue trend */}
      {months.length>1&&<div style={{background:C.sf,borderRadius:14,padding:16,marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:12}}>📈 Tendencia Mensual</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:8,height:120}}>
          {months.map(([m,d])=>{const h=Math.max((d.rev/maxMR)*100,4);const isCur=m===curM;return <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{fontSize:9,fontWeight:700,color:isCur?C.ok:C.t2}}>{fmt(d.rev).replace("MXN","").trim()}</div>
            <div style={{width:"100%",height:h+"%",background:isCur?C.ok:C.ac+"60",borderRadius:6,minHeight:4,transition:"height .5s"}}/>
            <div style={{fontSize:8,color:C.t3,fontWeight:600}}>{m.slice(5)}/{m.slice(2,4)}</div>
          </div>})}
        </div>
      </div>}

      {/* Products by revenue */}
      <div style={{background:C.sf,borderRadius:14,padding:16}}>
        <div style={{fontSize:11,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:10}}>📊 Productos por Ingreso</div>
        {sT.map(([t,d],i)=><div key={t} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12}}>{t}</span><span style={{fontSize:11,color:C.t2}}>{fmt(d.rev)} · {d.cnt} órdenes</span></div>
          <div style={{background:C.bg,borderRadius:3,height:6,overflow:"hidden"}}><div style={{width:((d.rev/mxT)*100)+"%",height:"100%",background:cls[i%cls.length],borderRadius:3}}/></div>
        </div>)}
      </div>
    </div>}

    {/* ══ MÁQUINAS ══ */}
    {tab==="machines"&&<div>
      {!selMachine?<>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          <Stat l="⏱ Horas Totales" v={fmtM(mStats.reduce((s,x)=>s+x.t,0))} c="#007aff" big/>
          <Stat l="💰 MXN/Hora Promedio" v={fmt(mStats.reduce((s,x)=>s+x.rev,0)/(mStats.reduce((s,x)=>s+x.hrs,0)||1))} c={C.ok} big/>
          <Stat l="🔧 Máquinas Usadas" v={mStats.length+"/"+MACHINES.filter(m=>m.status==="active").length} c={C.ac} big/>
        </div>
        <div style={{fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:8}}>Click en una máquina para ver detalle</div>
        {["preprensa","offset","digital","acabados"].map(type=>{const ms=mStats.filter(x=>x.m?.type===type);if(!ms.length)return null;
          return <div key={type} style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:tc[type],textTransform:"uppercase",marginBottom:8}}>{type==="preprensa"?"💿 Pre-prensa":type==="offset"?"⚙️ Offset":type==="digital"?"🖨️ Digital":"🔧 Acabados"}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
              {ms.map(x=><div key={x.mid} onClick={()=>setSelMachine(x.mid)} style={{background:C.sf,borderRadius:12,padding:14,cursor:"pointer",border:"0.5px solid "+C.bd,transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,.08)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:13,fontWeight:700}}>{x.m.name}</div>
                  <div style={{background:tc[type]+"15",color:tc[type],padding:"2px 8px",borderRadius:6,fontSize:9,fontWeight:600}}>{x.m.sub}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><div style={{fontSize:8,color:C.t3,textTransform:"uppercase"}}>MXN/Hora</div><div style={{fontSize:15,fontWeight:800,color:C.ok}}>{fmt(x.mxnHr)}</div></div>
                  <div><div style={{fontSize:8,color:C.t3,textTransform:"uppercase"}}>Trabajos</div><div style={{fontSize:15,fontWeight:800,color:C.ac}}>{x.j}</div></div>
                  <div><div style={{fontSize:8,color:C.t3,textTransform:"uppercase"}}>Horas</div><div style={{fontSize:13,fontWeight:700,color:"#007aff"}}>{fmtM(x.t)}</div></div>
                  <div><div style={{fontSize:8,color:C.t3,textTransform:"uppercase"}}>Ingreso</div><div style={{fontSize:13,fontWeight:700,color:C.ok}}>{fmt(x.rev)}</div></div>
                </div>
                <div style={{background:C.bg,borderRadius:3,height:4,overflow:"hidden",marginTop:8}}><div style={{width:((x.rev/maxMRev)*100)+"%",height:"100%",background:tc[type],borderRadius:3}}/></div>
              </div>)}
            </div>
          </div>})}
        {mStats.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.t3}}><div style={{fontSize:48}}>🏭</div><div style={{fontSize:14,fontWeight:700,color:C.tx,marginTop:8}}>Sin datos de máquinas</div><div style={{fontSize:12,marginTop:4}}>Los tiempos se registran al mover órdenes en el Tablero</div></div>}
      </>:selM&&<div>
        {/* Machine detail view */}
        <button onClick={()=>setSelMachine(null)} style={{...bt(C.sf,C.t2),border:"0.5px solid "+C.bd,marginBottom:14}}>← Volver a todas</button>
        <div style={{background:C.sf,borderRadius:16,padding:20,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div><div style={{fontSize:22,fontWeight:800}}>{selM.m.name}</div><div style={{fontSize:12,color:tc[selM.m.type],fontWeight:600}}>{selM.m.type.charAt(0).toUpperCase()+selM.m.type.slice(1)} · {selM.m.sub}</div></div>
            <div style={{background:tc[selM.m.type]+"15",color:tc[selM.m.type],padding:"8px 16px",borderRadius:12,fontSize:20,fontWeight:800}}>{fmt(selM.mxnHr)}<span style={{fontSize:10,fontWeight:600}}>/hr</span></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
            <div style={{background:C.bg,borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:8,color:C.t3,textTransform:"uppercase",marginBottom:2}}>Ingresos</div><div style={{fontSize:18,fontWeight:800,color:C.ok}}>{fmt(selM.rev)}</div></div>
            <div style={{background:C.bg,borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:8,color:C.t3,textTransform:"uppercase",marginBottom:2}}>Horas</div><div style={{fontSize:18,fontWeight:800,color:"#007aff"}}>{selM.hrs.toFixed(1)}h</div></div>
            <div style={{background:C.bg,borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:8,color:C.t3,textTransform:"uppercase",marginBottom:2}}>Trabajos</div><div style={{fontSize:18,fontWeight:800,color:C.ac}}>{selM.j}</div></div>
            <div style={{background:C.bg,borderRadius:10,padding:12,textAlign:"center"}}><div style={{fontSize:8,color:C.t3,textTransform:"uppercase",marginBottom:2}}>Promedio</div><div style={{fontSize:18,fontWeight:800,color:"#5856d6"}}>{fmtM(selM.a)}</div></div>
          </div>

          {/* Products for this machine */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:8}}>📊 Productos en esta máquina</div>
            {Object.entries(selM.types).sort((a,b)=>b[1]-a[1]).map(([t,c],i)=>{const mx2=Object.values(selM.types).reduce((a,b)=>Math.max(a,b),1);return <div key={t} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:11}}>{t}</span><span style={{fontSize:10,color:C.t2}}>{c} ({Math.round(c/selM.j*100)}%)</span></div>
              <div style={{background:C.bg,borderRadius:3,height:5,overflow:"hidden"}}><div style={{width:((c/mx2)*100)+"%",height:"100%",background:cls[i%cls.length],borderRadius:3}}/></div>
            </div>})}
          </div>

          {/* Recent jobs on this machine */}
          <div>
            <div style={{fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:8}}>📋 Últimos trabajos ({Math.min(selM.orders.length,10)})</div>
            {selM.orders.slice(-10).reverse().map((job,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<9?"0.5px solid "+C.bd:"none"}}>
              <div><div style={{fontSize:12,fontWeight:600}}>{job.client}</div><div style={{fontSize:9,color:C.t3}}>{job.type} · {job.id}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:12,fontWeight:700,color:"#007aff"}}>{fmtM(job.min)}</div>{job.price>0&&<div style={{fontSize:9,color:C.ok}}>{fmt(job.price)}</div>}</div>
            </div>)}
          </div>
        </div>
      </div>}
    </div>}

    {/* ══ EFICIENCIA ══ */}
    {tab==="efficiency"&&<div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        <Stat l="✅ Entregas a Tiempo" v={onTimePct+"%"} s={onTime+" de "+(onTime+late)} c={onTimePct>=80?C.ok:onTimePct>=60?C.wn:C.dn} big/>
        <Stat l="⏱ Días Promedio" v={avgDays+"d"} s="creación → entrega" c="#007aff" big/>
        <Stat l="📄 Merma Pliegos" v={totalWastePl} s="total acumulado" c={C.wn} big/>
        <Stat l="📦 Merma Piezas" v={totalWastePz} s="total acumulado" c={C.wn} big/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {/* On-time visual */}
        <div style={{background:C.sf,borderRadius:14,padding:16}}>
          <div style={{fontSize:11,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:12}}>📅 Puntualidad de Entregas</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
            <div style={{position:"relative",width:120,height:120}}>
              <svg viewBox="0 0 36 36" style={{width:120,height:120,transform:"rotate(-90deg)"}}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={C.bd} strokeWidth="3"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={onTimePct>=80?C.ok:onTimePct>=60?C.wn:C.dn} strokeWidth="3" strokeDasharray={onTimePct+" "+(100-onTimePct)} strokeLinecap="round"/>
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
                <div style={{fontSize:24,fontWeight:800,color:onTimePct>=80?C.ok:onTimePct>=60?C.wn:C.dn}}>{onTimePct}%</div>
                <div style={{fontSize:8,color:C.t3}}>a tiempo</div>
              </div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:16,fontSize:11}}>
            <span style={{color:C.ok}}>✅ {onTime} a tiempo</span>
            <span style={{color:C.dn}}>⚠️ {late} retrasadas</span>
          </div>
        </div>

        {/* Stale orders */}
        <div style={{background:C.sf,borderRadius:14,padding:16}}>
          <div style={{fontSize:11,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:12}}>⚠️ Órdenes Estancadas</div>
          {orders.filter(o=>getStale(o)).map(o=>{const s=getStale(o);return <div key={o.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"0.5px solid "+C.bd}}>
            <div><div style={{fontSize:11,fontWeight:600}}>{o.client}</div><div style={{fontSize:9,color:C.t3}}>{SM[o.stage]?.l} · {o.product_type}</div></div>
            <span style={{background:(s.lv==="critical"?C.dn:C.wn)+"15",color:s.lv==="critical"?C.dn:C.wn,padding:"2px 8px",borderRadius:6,fontSize:9,fontWeight:700,alignSelf:"center"}}>{s.lb}</span>
          </div>})}
          {orders.filter(o=>getStale(o)).length===0&&<div style={{textAlign:"center",padding:"20px 0",color:C.ok,fontSize:12}}>✅ Sin órdenes estancadas</div>}
        </div>
      </div>
    </div>}

    {/* ══ CLIENTES ══ */}
    {tab==="clients"&&<div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        <Stat l="👥 Clientes Únicos" v={Object.keys(byClient).length} c={C.ac} big/>
        <Stat l="💰 Ingreso/Cliente" v={fmt(totalRev/(Object.keys(byClient).length||1))} c={C.ok} big/>
        <Stat l="📋 Órdenes/Cliente" v={(orders.length/(Object.keys(byClient).length||1)).toFixed(1)} c="#5856d6" big/>
      </div>

      <div style={{background:C.sf,borderRadius:14,padding:16}}>
        <div style={{fontSize:11,fontWeight:600,color:C.t2,textTransform:"uppercase",marginBottom:12}}>🏆 Top 10 Clientes por Facturación</div>
        {topClients.map(([name,d],i)=>{const mxC=topClients[0]?.[1]?.rev||1;return <div key={name} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:i<3?[C.wn,"#c0c0c0","#cd7f32"][i]:C.sf,color:i<3?"#fff":C.t2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0}}>{i+1}</div>
              <div><div style={{fontSize:13,fontWeight:600}}>{name}</div><div style={{fontSize:9,color:C.t3}}>{d.cnt} órdenes · última: {fD(d.last)}</div></div>
            </div>
            <div style={{fontSize:14,fontWeight:800,color:C.ok}}>{fmt(d.rev)}</div>
          </div>
          <div style={{background:C.bg,borderRadius:3,height:5,overflow:"hidden",marginLeft:32}}><div style={{width:((d.rev/mxC)*100)+"%",height:"100%",background:i<3?C.ok:C.ac+"80",borderRadius:3}}/></div>
        </div>})}
        {topClients.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:C.t3,fontSize:12}}>Sin datos de clientes aún</div>}
      </div>
    </div>}

    {/* ══ ARCHIVOS ══ */}
    {tab==="storage"&&<StorageTab orders={orders} onReload={onReload}/>}
  </div>;
}

// ─── MAIN ──────────────────────────────────────────
export default function PrintFlow() {
  const [user,setUser]=useState(null);const [userName,setUserName]=useState("");const [orders,setOrders]=useState([]);const [view,setView]=useState("pipeline");
  const [editO,setEditO]=useState(null);const [search,setSearch]=useState("");const [loaded,setLoaded]=useState(false);
  const [clients,setClients]=useState([]);const [maqModal,setMaqModal]=useState(null);const [wasteModal,setWasteModal]=useState(null);
  const [confirmModal,setConfirmModal]=useState(null);const [printModal,setPrintModal]=useState(null);const [clientHistory,setClientHistory]=useState(null);
  const [flowDiagram,setFlowDiagram]=useState(null);const [showWelcome,setShowWelcome]=useState(false);const [detailModalId,setDetailModalId]=useState(null);

  // Load orders from Supabase
  const reload = useCallback(async () => {
    const data = await db.loadOrders();
    setOrders(data);
    setLoaded(true);
  }, []);

  useEffect(() => { if (user) reload(); }, [user, reload]);

  // Realtime subscription — reload when any client makes changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => reload())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_timeline" }, () => reload())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_comments" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_waste" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_machine_log" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, reload]);

  // Extract clients for autocomplete
  useEffect(() => {
    if (!loaded) return;
    const cm = {};
    orders.forEach(o => { if (o.client && !cm[o.client]) cm[o.client] = { client: o.client, client_company: o.client_company, client_email: o.client_email, client_phone: o.client_phone, client_lada: o.client_lada, client_rfc: o.client_rfc }; });
    setClients(Object.values(cm));
  }, [orders, loaded]);

  // Auto-fix: if a draft order has both validations, advance to design (handles race condition)
  useEffect(() => {
    if (!loaded || !user) return;
    orders.forEach(o => {
      if (o.stage === "draft" && o.validated_by_production && o.validated_by_preprensa) {
        (async () => {
          await supabase.from("orders").update({ stage: "design" }).eq("id", o.id).eq("stage", "draft");
          await db.addTimeline(o.id, "📝 → 🎨 Ambos validaron → Diseño (auto)", user || "sistema", "#ec4899");
          setOrders(p => p.map(x => x.id === o.id && x.stage === "draft" ? { ...x, stage: "design" } : x));
        })();
      }
    });
  }, [orders, loaded, user]);

  // Auto-cleanup: delete files older than 30 days from Supabase Storage
  useEffect(() => {
    if (!loaded || !user) return;
    const cleanup = async () => {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: old } = await supabase.from("orders").select("id,file_url,file_name").not("file_url", "is", null).lt("created_at", cutoff);
      if (!old || old.length === 0) return;
      for (const o of old) {
        try {
          const path = o.file_url.split("/order-files/")[1];
          if (path) await supabase.storage.from("order-files").remove([decodeURIComponent(path)]);
          await supabase.from("orders").update({ file_url: null, file_name: null }).eq("id", o.id);
        } catch {}
      }
      reload();
    };
    cleanup();
  }, [loaded, user]); // runs once per session after first load

  const addTL=(o,action,extra={})=>[...(o.timeline||[]),{action,date:new Date().toISOString(),by:user||"sistema",color:SM[extra.to]?.c||C.t3,...extra}];
  const closeML=o=>{const l=[...(o.machine_log||[])];const i=l.findIndex(e=>!e.ended);if(i>=0){const s=new Date(l[i].started);const e=new Date();l[i]={...l[i],ended:e.toISOString(),minutes:Math.round((e-s)/60000)}}return l};

  const create=useCallback(async f=>{
    const isMaq=f.order_type==="maquila";
    const newOrder={...f,id:gid(),stage:isMaq?"maq_created":"draft",priority:f.priority||"normal",created_at:new Date().toISOString(),created_by:user,validated_by_production:false,validated_by_preprensa:false,price:f.price?parseFloat(f.price):null,quantity:f.quantity?parseInt(f.quantity,10):null,estimated_hours:f.estimated_hours?parseFloat(f.estimated_hours):null,maq_cost:f.maq_cost?parseFloat(f.maq_cost):null,maq_price:f.maq_price?parseFloat(f.maq_price):null,machine_log:[],waste_log:[],comments:[],current_machine:null,proof_approved:null,timeline:[{action:"📋 Orden creada",date:new Date().toISOString(),by:user,color:C.ac}]};
    setOrders(p=>[newOrder,...p]);
    await db.saveOrder(newOrder);
    await db.addTimeline(newOrder.id,"📋 Orden creada",user,C.ac);
    setView("pipeline");
  },[user]);

  const update=useCallback(async f=>{
    setOrders(p=>p.map(o=>o.id===f.id?{...o,...f,price:f.price?parseFloat(f.price):o.price,timeline:addTL(o,"✏️ Editada")}:o));
    await db.saveOrder({...f,price:f.price?parseFloat(f.price):null});
    await db.addTimeline(f.id,"✏️ Editada",user,C.t3);
    setEditO(null);setView("pipeline");
  },[user]);

  const doAdv=useCallback(async(id,ns)=>{
    setOrders(p=>p.map(o=>{if(o.id!==id)return o;const u={...o,stage:ns,timeline:addTL(o,(SM[o.stage]?.l||"")+" → "+(SM[ns]?.l||""),{to:ns})};if(o.current_machine&&["packaging","delivered","maquila_out","ready"].includes(ns)){u.machine_log=closeML(o);u.current_machine=null}if(ns.includes("delivered")){u.deliveredAt=new Date().toISOString();u.delivered_at=u.deliveredAt}if(ns==="draft"){u.validated_by_production=false;u.validated_by_preprensa=false}return u}));
    // Sync to Supabase
    const o=orders.find(x=>x.id===id);if(!o)return;
    const upd={id,stage:ns};
    if(o.current_machine&&["packaging","delivered","maquila_out","ready"].includes(ns)){upd.current_machine=null;await db.closeMachineLog(id)}
    if(ns.includes("delivered"))upd.delivered_at=new Date().toISOString();
    if(ns==="draft"){upd.validated_by_production=false;upd.validated_by_preprensa=false}
    await supabase.from("orders").update(upd).eq("id",id);
    await db.addTimeline(id,(SM[o.stage]?.l||"")+" → "+(SM[ns]?.l||""),user,SM[ns]?.c);
  },[user,orders]);

  const advance=useCallback((id,ns)=>{if(["delivered","maq_delivered","packaging"].includes(ns)){setConfirmModal({title:SM[ns]?.l||"Confirmar",message:"¿Estás seguro?",confirmLabel:"Sí, confirmar",confirmColor:ns.includes("delivered")?C.ok:"#af52de",onConfirm:()=>{doAdv(id,ns);setConfirmModal(null)}})}else doAdv(id,ns)},[doAdv]);

  const approveProof=useCallback(async id=>{
    const now=new Date().toISOString();
    setOrders(p=>p.map(o=>o.id===id?{...o,stage:"ctp",proof_approved:now,timeline:addTL(o,"✅ Prueba aprobada",{to:"ctp"}),comments:[...(o.comments||[]),{text:"✅ Prueba aprobada",by:"sistema",date:now}]}:o));
    await supabase.from("orders").update({stage:"ctp",proof_approved:now}).eq("id",id);
    await db.addTimeline(id,"✅ Prueba aprobada",user,"#0891b2");
    await db.addComment(id,"✅ Prueba aprobada","sistema");
  },[user]);

  const assignMachine=useCallback(async(oid,mid)=>{
    setOrders(p=>p.map(o=>{if(o.id!==oid)return o;const l=closeML(o);l.push({machine:mid,started:new Date().toISOString()});return{...o,stage:"in_production",current_machine:mid,machine_log:l,timeline:addTL(o,"🏭 "+MACHINES.find(x=>x.id===mid)?.name,{to:"in_production"})}}));
    await db.closeMachineLog(oid);
    await db.addMachineLog(oid,mid);
    await supabase.from("orders").update({stage:"in_production",current_machine:mid}).eq("id",oid);
    await db.addTimeline(oid,"🏭 "+(MACHINES.find(x=>x.id===mid)?.name||mid),user,"#ff9500");
  },[user]);

  const sendMaquila=useCallback(async(oid,prov,phone,email,note)=>{
    setOrders(p=>p.map(o=>{if(o.id!==oid)return o;const l=closeML(o);return{...o,stage:"maquila_out",maquila_provider:prov,maquila_phone:phone||null,maquila_email:email||null,current_machine:null,machine_log:l,timeline:addTL(o,"🚚 "+prov,{to:"maquila_out"}),comments:[...(o.comments||[]),{text:"🚚 "+prov+(phone?" | 📱"+phone:"")+(email?" | 📧"+email:"")+(note?" — "+note:""),by:"sistema",date:new Date().toISOString()}]}}));
    await db.closeMachineLog(oid);
    await supabase.from("orders").update({stage:"maquila_out",maquila_provider:prov,maquila_phone:phone||null,maquila_email:email||null,current_machine:null}).eq("id",oid);
    await db.addTimeline(oid,"🚚 "+prov,user,"#e67e22");
    await db.addComment(oid,"🚚 "+prov+(phone?" | 📱"+phone:"")+(email?" | 📧"+email:"")+(note?" — "+note:""),"sistema");
    setMaqModal(null);
  },[user]);

  const addWaste=useCallback(async(oid,pz,pl,note)=>{
    setOrders(p=>p.map(o=>o.id===oid?{...o,waste_log:[...(o.waste_log||[]),{qty:pz,pliegos:pl,note,date:new Date().toISOString()}],timeline:addTL(o,"🗑️ Merma")}:o));
    await db.addWaste(oid,pl,pz,note);
    await db.addTimeline(oid,"🗑️ Merma",user,C.wn);
    setWasteModal(null);
  },[user]);

  const duplicate=useCallback(async id=>{
    const orig=orders.find(o=>o.id===id);if(!orig)return;
    const dup={...orig,id:gid(),stage:orig.order_type==="maquila"?"maq_created":"draft",created_at:new Date().toISOString(),created_by:user,validated_by_production:false,validated_by_preprensa:false,machine_log:[],waste_log:[],comments:[],current_machine:null,proof_approved:null,deliveredAt:null,delivered_at:null,maquila_provider:null,maquila_phone:null,maquila_email:null,file_url:null,file_name:null,timeline:[{action:"📋 Duplicada de "+orig.id,date:new Date().toISOString(),by:user,color:"#5856d6"}]};
    setOrders(p=>[dup,...p]);
    await db.saveOrder(dup);
    await db.addTimeline(dup.id,"📋 Duplicada de "+orig.id,user,"#5856d6");
  },[orders,user]);

  const addComment=useCallback(async(oid,c)=>{
    setOrders(p=>p.map(o=>o.id===oid?{...o,comments:[...(o.comments||[]),c]}:o));
    await db.addComment(oid,c.text,c.by);
  },[]);

  const changeDate=useCallback(async(oid,newDate)=>{
    setOrders(p=>p.map(o=>o.id===oid?{...o,due_date:newDate,timeline:[...(o.timeline||[]),{action:"📅 Fecha cambiada a "+fD(newDate),date:new Date().toISOString(),by:user||"sistema",color:C.wn}]}:o));
    await supabase.from("orders").update({due_date:newDate}).eq("id",oid);
    await db.addTimeline(oid,"📅 Fecha cambiada a "+fD(newDate),user,C.wn);
  },[user]);

  const handleAction=useCallback((id,action,payload)=>{
    if(action==="edit"){setEditO(orders.find(o=>o.id===id));setView("form")}
    if(action==="edit_specs"){const o=orders.find(x=>x.id===id);if(o){setEditO({...o,_specsOnly:true});setView("form")}}
    if(action==="detail"){setDetailModalId(id)}
    if(action==="advance")advance(id,payload);
    if(action==="approve_proof")approveProof(id);
    if(action==="send_maquila")setMaqModal(id);
    if(action==="waste")setWasteModal(id);
    if(action==="comment")addComment(id,payload);
    if(action==="duplicate")duplicate(id);
    if(action==="print"){const o=orders.find(x=>x.id===id);if(o)setPrintModal(o)}
    if(action==="client_history"){const o=orders.find(x=>x.id===id);if(o)setClientHistory(o.client)}
    if(action==="flow"){const o=orders.find(x=>x.id===id);if(o)setFlowDiagram({stage:o.stage,type:o.order_type})}
    if(action==="validate_prod"){(async()=>{setOrders(p=>p.map(o=>{if(o.id!==id)return o;const u={...o,validated_by_production:true,timeline:addTL(o,"✅ Validada por Producción")};if(o.validated_by_preprensa){u.stage="design";u.timeline=addTL(u,"📝 → 🎨 Ambos validaron → Diseño",{to:"design"})}return u}));const o=orders.find(x=>x.id===id);await supabase.from("orders").update({validated_by_production:true,...(o?.validated_by_preprensa?{stage:"design"}:{})}).eq("id",id);await db.addTimeline(id,"✅ Validada por Producción",user,C.ok);if(o?.validated_by_preprensa)await db.addTimeline(id,"📝 → 🎨 Ambos validaron → Diseño",user,"#ec4899")})()}
    if(action==="validate_pre"){(async()=>{setOrders(p=>p.map(o=>{if(o.id!==id)return o;const u={...o,validated_by_preprensa:true,timeline:addTL(o,"✅ Validada por Pre-prensa")};if(o.validated_by_production){u.stage="design";u.timeline=addTL(u,"📝 → 🎨 Ambos validaron → Diseño",{to:"design"})}return u}));const o=orders.find(x=>x.id===id);await supabase.from("orders").update({validated_by_preprensa:true,...(o?.validated_by_production?{stage:"design"}:{})}).eq("id",id);await db.addTimeline(id,"✅ Validada por Pre-prensa",user,"#ec4899");if(o?.validated_by_production)await db.addTimeline(id,"📝 → 🎨 Ambos validaron → Diseño",user,"#ec4899")})()}
    if(action==="revert"){const o=orders.find(x=>x.id===id);if(!o)return;const flow=o.order_type==="maquila"?MAQ_FLOW:INT_FLOW;const ci=flow.findIndex(s=>s.id===o.stage);if(ci>0){const prev=flow[ci-1];setConfirmModal({title:"↩️ Regresar",message:"¿A \""+SM[prev.id]?.l+"\"?",confirmLabel:"Sí",confirmColor:C.wn,onConfirm:()=>{doAdv(id,prev.id);setConfirmModal(null)}})}}
  },[orders,advance,approveProof,addComment,duplicate,doAdv]);

  const myTasks=useMemo(()=>{const srt=l=>l.sort(prioSort);if(user==="admin")return srt(orders.filter(o=>!o.stage.includes("delivered")));if(user==="produccion")return srt(orders.filter(o=>["draft","ready","in_production","maquila_out","maquila_in","packaging"].includes(o.stage)));if(user==="preprensa")return srt(orders.filter(o=>["draft","design","proof_printing","proof_client","ctp"].includes(o.stage)));if(user==="secretaria")return srt(orders.filter(o=>["maq_created","maq_sent","maq_in_progress","maq_received"].includes(o.stage)));return []},[orders,user]);

  if(!user) return (
    <Login onLogin={(role, name)=>{setUser(role);setUserName(name);setView("pipeline");ld("pf-welcome-"+role,false).then(seen=>{if(!seen){setShowWelcome(true);sv("pf-welcome-"+role,true)}})}}/>
  );

  const rL={produccion:"Producción",preprensa:"Pre-prensa",secretaria:"Secretaría",admin:"Admin"};
  const rC={produccion:"#007aff",preprensa:"#ec4899",secretaria:"#5856d6",admin:C.ok};
  const navs=[{id:"pipeline",i:"📊",l:"Dashboard"},{id:"tasks",i:"📌",l:"Pendientes ("+myTasks.length+")"}];
  if(user==="secretaria"||user==="admin")navs.push({id:"form",i:"➕",l:"Nueva"});
  if(user!=="secretaria")navs.push({id:"board",i:"🏭",l:"Tablero"});
  navs.push({id:"calendar",i:"📅",l:"Entregas"});
  navs.push({id:"orders",i:"📋",l:"Todas"});
  if(user==="admin")navs.push({id:"analytics",i:"📊",l:"Analytics"});

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Poppins',sans-serif",color:C.tx}}>
      <link href={FNT} rel="stylesheet"/>
      <div style={{borderBottom:"0.5px solid "+C.bd,padding:"8px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}><img src={LOGO} alt="" style={{width:28,height:28,borderRadius:6}}/><span style={{fontWeight:800,fontSize:15,textTransform:"uppercase"}}>PrintFlow</span></div>
        <div style={{display:"flex",gap:2,overflowX:"auto"}}>{navs.map(n=><button key={n.id} onClick={()=>{setView(n.id);if(n.id!=="form")setEditO(null)}} style={{background:view===n.id?C.acL:"transparent",border:"none",color:view===n.id?C.ac:C.t2,padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:10,fontWeight:600,fontFamily:"'Poppins',sans-serif",whiteSpace:"nowrap"}}>{n.i} {n.l}</button>)}</div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {(user==="admin"||user==="secretaria")&&<button onClick={()=>{const h=["ID","Fecha","Tipo","Prioridad","#Prod","Cliente","Empresa","Tel","Email","RFC","Producto","TipoProd","Cant","Papel","Ancho","Alto","Tintas","Acabados","Hrs","Precio","CostoMaq","PrecioMaq","Margen","Proveedor","ProvTel","ProvEmail","Etapa","Entrega","PlMerma","PzMerma","MinMaq","Prueba","Archivo","Notas"];const r=orders.map(o=>{const mg=o.maq_cost&&o.maq_price?pct(parseFloat(o.maq_cost),parseFloat(o.maq_price)):"";return[o.id,fDT(o.created_at),o.order_type,o.priority,o.production_number,o.client,o.client_company,o.client_phone?(o.client_lada||"+52")+" "+o.client_phone:"",o.client_email||"",o.client_rfc||"",o.product,o.product_type,o.quantity,o.paper_type,o.width_cm,o.height_cm,o.colors,o.finishes,o.estimated_hours,o.price,o.maq_cost,o.maq_price,mg,o.maq_provider||o.maquila_provider,o.maquila_phone||"",o.maquila_email||"",SM[o.stage]?.l,o.due_date,(o.waste_log||[]).reduce((s,w)=>s+(w.pliegos||0),0),(o.waste_log||[]).reduce((s,w)=>s+(w.qty||0),0),(o.machine_log||[]).reduce((s,e)=>s+(e.minutes||0),0),o.proof_approved?fDT(o.proof_approved):"",o.file_name||"",o.notes]});const out="\uFEFF"+[h,...r].map(row=>row.map(c=>'"'+String(c||"").replace(/"/g,'""')+'"').join(",")).join("\n");const b=new Blob([out],{type:"text/csv;charset=utf-8;"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="PrintFlow_"+new Date().toISOString().slice(0,10)+".csv";a.click()}} style={bs(C.ac)}>📥 CSV</button>}
          <div style={{background:rC[user]+"12",color:rC[user],padding:"4px 10px",borderRadius:8,fontSize:10,fontWeight:600}}>{rL[user]}</div>
          <button onClick={()=>setUser(null)} style={{...bs(C.sf,C.t2),border:"0.5px solid "+C.bd}}>Salir</button>
        </div>
      </div>

      <div style={{maxWidth:1300,margin:"0 auto",padding:"14px 16px"}}>
        {view==="pipeline"&&<div><h2 style={{fontSize:18,fontWeight:800,margin:"0 0 4px",textTransform:"uppercase"}}>Dashboard</h2><p style={{fontSize:11,color:C.t2,margin:"0 0 14px"}}>{orders.length} órdenes · {orders.filter(o=>!o.stage.includes("delivered")).length} activas</p>{(user==="admin"||user==="secretaria")&&<WeeklyReport orders={orders}/>}<MaquilaTracker orders={orders} onAction={handleAction} role={user}/><Pipeline orders={orders} role={user} onAction={handleAction}/></div>}
        {view==="tasks"&&<div><h2 style={{fontSize:18,fontWeight:800,margin:"0 0 4px",textTransform:"uppercase"}}>Mis Pendientes</h2><p style={{fontSize:11,color:C.t2,margin:"0 0 14px"}}>{myTasks.length} pendiente{myTasks.length!==1?"s":""}</p>{myTasks.length===0?<div style={{textAlign:"center",padding:"40px 20px"}}><div style={{fontSize:48}}>✅</div><div style={{fontSize:15,fontWeight:700,marginTop:8}}>¡Sin pendientes!</div><div style={{fontSize:12,color:C.t2,marginTop:4}}>Las órdenes aparecerán aquí cuando necesiten tu atención</div></div>:myTasks.map(o=><OCard key={o.id} o={o} role={user} onAction={handleAction}/>)}</div>}
        {view==="form"&&<div><h2 style={{fontSize:18,fontWeight:800,margin:"0 0 14px",textTransform:"uppercase",textAlign:"center"}}>{editO?"Editar Orden":"Nueva Orden"}</h2><OrderForm role={user} onSubmit={editO?update:create} editOrder={editO} onCancel={()=>{setEditO(null);setView("pipeline")}} clients={clients}/></div>}
        {view==="board"&&<div><h2 style={{fontSize:18,fontWeight:800,margin:"0 0 4px",textTransform:"uppercase"}}>Tablero de Producción</h2><p style={{fontSize:11,color:C.t2,margin:"0 0 14px"}}>Arrastra órdenes entre máquinas · ⠿ para mover</p><Kanban orders={orders} onDrop={assignMachine} onAction={handleAction} role={user}/><MaquilaTracker orders={orders} onAction={handleAction} role={user}/></div>}
        {view==="calendar"&&<div><h2 style={{fontSize:18,fontWeight:800,margin:"0 0 14px",textTransform:"uppercase"}}>Calendario de Entregas</h2><Calendar orders={orders} onChangeDate={changeDate}/></div>}
        {view==="orders"&&<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:8,flexWrap:"wrap"}}><h2 style={{fontSize:18,fontWeight:800,margin:0,textTransform:"uppercase"}}>Todas ({orders.length})</h2><input style={{...inp,width:200,padding:"8px 14px",fontSize:12}} placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/></div>{orders.filter(o=>{if(!search)return true;const q=search.toLowerCase();return[o.client,o.product,o.id,o.product_type,o.maq_provider,o.maquila_provider,o.client_company,o.production_number].some(x=>x?.toLowerCase().includes(q))}).sort(prioSort).map(o=><OCard key={o.id} o={o} role={user} onAction={handleAction}/>)}</div>}
        {view==="analytics"&&user==="admin"&&<div><h2 style={{fontSize:18,fontWeight:800,margin:"0 0 14px",textTransform:"uppercase",textAlign:"center"}}>Analytics</h2><Analytics orders={orders} onReload={reload}/></div>}
      </div>

      {showWelcome&&<WelcomeGuide role={user} onClose={()=>setShowWelcome(false)}/>}
      {maqModal&&<MaqModal onSend={(p,ph,em,n)=>sendMaquila(maqModal,p,ph,em,n)} onClose={()=>setMaqModal(null)} providers={(()=>{const pm={};orders.forEach(o=>{const n=o.maquila_provider||o.maq_provider;if(!n)return;if(!pm[n])pm[n]={name:n,phone:o.maquila_phone||"",email:o.maquila_email||""};if(!pm[n].phone&&o.maquila_phone)pm[n].phone=o.maquila_phone;if(!pm[n].email&&o.maquila_email)pm[n].email=o.maquila_email});return Object.values(pm)})()}/>}
      {wasteModal&&<WasteModal onSave={(pz,pl,n)=>addWaste(wasteModal,pz,pl,n)} onClose={()=>setWasteModal(null)}/>}
      {confirmModal&&<ConfirmModal {...confirmModal} onClose={()=>setConfirmModal(null)}/>}
      {printModal&&<PrintOrder order={printModal} onClose={()=>setPrintModal(null)}/>}
      {clientHistory&&<ClientHistory clientName={clientHistory} orders={orders} role={user} onClose={()=>setClientHistory(null)}/>}
      {flowDiagram&&<FlowDiagram currentStage={flowDiagram.stage} orderType={flowDiagram.type} onClose={()=>setFlowDiagram(null)}/>}
      {detailModalId&&orders.find(x=>x.id===detailModalId)&&<DetailModal order={orders.find(x=>x.id===detailModalId)} role={user} onClose={()=>setDetailModalId(null)} onPrint={o=>setPrintModal(o)}/>}
    </div>
  );
}
