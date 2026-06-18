import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'   // Tailwind v4 utilities-only (sin preflight)
import PrintFlow from './App.jsx'

// v10.72.13 — ErrorBoundary raíz. Antes, cualquier throw en render (un dato raro de Supabase,
// un .map sobre null) dejaba PANTALLA BLANCA en el piso = media jornada perdida sin saber qué pasó.
// Ahora se muestra un fallback recuperable con botón Recargar (los datos viven en Supabase, no se pierden).
class RootErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={ error:null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error, info){ console.error("[RootErrorBoundary]", error, info); }
  render(){
    if(this.state.error){
      return (
        <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:"#f7f7f8",color:"#1c1c1e",fontFamily:"'Geist',system-ui,sans-serif"}}>
          <div style={{maxWidth:420,textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:8}}>⚠️</div>
            <h1 style={{fontSize:18,fontWeight:800,margin:"0 0 6px"}}>Algo salió mal</h1>
            <p style={{fontSize:13,color:"#6b6b70",lineHeight:1.5,margin:"0 0 18px"}}>
              La aplicación encontró un error inesperado. Tus datos están a salvo — recarga para continuar.
            </p>
            <button onClick={()=>window.location.reload()} style={{padding:"11px 22px",fontSize:14,fontWeight:700,color:"#fff",background:"#2563eb",border:"none",borderRadius:12,cursor:"pointer",fontFamily:"inherit"}}>
              Recargar
            </button>
            {this.state.error?.message&&<pre style={{marginTop:16,fontSize:10,color:"#9a9aa0",whiteSpace:"pre-wrap",wordBreak:"break-word",textAlign:"left",maxHeight:120,overflow:"auto"}}>{String(this.state.error.message)}</pre>}
          </div>
        </div>
      )
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <PrintFlow />
    </RootErrorBoundary>
  </React.StrictMode>
)
