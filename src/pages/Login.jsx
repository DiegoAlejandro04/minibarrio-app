import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const [tab, setTab] = useState('cliente') // solo cambia el copy; el rol real viene de Firestore
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isClient = tab === 'cliente'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const rol = await login(correo, contrasena)
      const redirectTo = location.state?.from?.pathname || (rol === 'propietario' ? '/panel' : '/')
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError('Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: 380, padding: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Inicia sesión en MiniBarrio</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
          {isClient
            ? 'Encuentra y agenda en las barberías de Britalia.'
            : 'Administra el portafolio y las citas de tu barbería.'}
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 20, background: 'var(--surface-2)', borderRadius: 10, padding: 4 }}>
          <button
            type="button"
            onClick={() => setTab('cliente')}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none',
              background: isClient ? 'var(--ink)' : 'transparent', color: isClient ? '#fff' : 'var(--text-muted)',
            }}
          >
            Cliente
          </button>
          <button
            type="button"
            onClick={() => setTab('propietario')}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none',
              background: !isClient ? 'var(--ink)' : 'transparent', color: !isClient ? '#fff' : 'var(--text-muted)',
            }}
          >
            Propietario de negocio
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700 }}>Correo electrónico</label>
          <input
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            style={{ marginTop: 6, marginBottom: 14 }}
          />

          <label style={{ fontSize: 12.5, fontWeight: 700 }}>Contraseña</label>
          <input
            type="password"
            required
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            placeholder="••••••••"
            style={{ marginTop: 6 }}
          />

          {error && <div className="error-text">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 18 }}>
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-muted)', marginTop: 20 }}>
          {isClient ? (
            <>¿No tienes cuenta? <Link to="/registro/cliente" style={{ fontWeight: 700 }}>Regístrate como cliente</Link></>
          ) : (
            <>¿Tu barbería aún no está en MiniBarrio? <Link to="/registro/negocio" style={{ fontWeight: 700 }}>Regístrala aquí</Link></>
          )}
        </div>
      </div>
    </div>
  )
}
