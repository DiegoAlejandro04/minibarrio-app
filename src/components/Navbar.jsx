import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Navbar() {
  const { currentUser, role, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    // A la vitrina (se puede ver sin cuenta), no al formulario de login, con
    // un aviso breve (AvisoFlotante.jsx). Primero se navega y luego se cierra
    // la sesión: al revés, los paneles protegidos (ProtectedRoute) alcanzan a
    // saltar un instante a /login.
    navigate('/', { state: { aviso: { titulo: 'Sesión cerrada', texto: '¡Vuelve pronto! Puedes seguir viendo los negocios del barrio.' } } })
    await logout()
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 18, fontWeight: 800 }}>
        <span style={{ color: 'var(--text)' }}>Mini</span><span style={{ color: 'var(--accent)' }}>Barrio</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {currentUser ? (
          <>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
              {currentUser.displayName} · {role === 'propietario' ? 'Propietario' : 'Cliente'}
            </span>
            <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '8px 14px', fontSize: 13 }}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link to="/login" style={{ fontSize: 14, fontWeight: 700 }}>Iniciar sesión</Link>
        )}
      </div>
    </div>
  )
}
