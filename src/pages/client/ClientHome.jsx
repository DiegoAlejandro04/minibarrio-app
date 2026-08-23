import Navbar from '../../components/Navbar.jsx'

// Placeholder de la vista cliente. La UI definitiva ya está diseñada en el
// canvas de mockups (Home / Búsqueda / Perfil de barbería) — este componente
// es el punto de partida para implementarla en el Sprint 2 (búsqueda +
// recomendaciones) según el cronograma de la Fase 3.
export default function ClientHome() {
  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 640, margin: '80px auto', textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>¡Bienvenido a MiniBarrio!</div>
        <p style={{ color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
          Sesión de cliente activa. Aquí vivirán la exploración de barberías, la búsqueda con
          filtros y el perfil con agendamiento — según el diseño ya validado. Próximo en el
          backlog: RF-05 (búsqueda), RF-06 (mapa), RF-09 (recomendaciones).
        </p>
      </div>
    </div>
  )
}
