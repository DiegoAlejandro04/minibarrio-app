// Pantalla de carga a página completa, con el mismo lockup de marca que los
// headers (badge "MB" + MiniBarrio) en vez de un simple texto "Cargando…".
// Se usa en cualquier punto donde todavía no hay nada que mostrar: mientras
// se confirma la sesión (App.jsx) o mientras se trae el documento de
// Firestore que la página necesita para poder pintar algo (ClientLayout.jsx,
// OwnerLayout.jsx, NegocioDetalle.jsx).
export default function Splash() {
  return (
    <div
      className="splash-arranque"
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        background: 'var(--bg)', fontSize: 17, fontWeight: 800,
      }}
    >
      <span
        className="splash-pieza"
        style={{
          width: 30, height: 30, borderRadius: 9, background: 'var(--accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
          animationDelay: '0ms',
        }}
      >
        MB
      </span>
      <span>
        <span className="splash-pieza" style={{ display: 'inline-block', color: 'var(--text)', animationDelay: '110ms' }}>Mini</span>
        <span className="splash-pieza" style={{ display: 'inline-block', color: 'var(--accent)', animationDelay: '220ms' }}>Barrio</span>
      </span>
    </div>
  )
}
