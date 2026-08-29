import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icon.jsx'
import GoogleIcon from '../components/GoogleIcon.jsx'

export default function Login() {
  const [tab, setTab] = useState('cliente') // solo cambia el copy; el rol real viene de Firestore
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrarContrasena, setMostrarContrasena] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, loginWithGoogle } = useAuth()
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

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      const rol = await loginWithGoogle(tab)
      const redirectTo = location.state?.from?.pathname || (rol === 'propietario' ? '/panel' : '/')
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (err.message === 'google-sin-cuenta-propietario') {
        setError('No encontramos un negocio registrado con esta cuenta de Google. Regístralo primero.')
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError('No se pudo iniciar sesión con Google. Intenta de nuevo.')
      }
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }}>
      <Link
        to="/"
        style={{
          position: 'absolute', top: 24, left: 24, fontSize: 13.5, fontWeight: 700, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Volver al inicio
      </Link>
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
          <div style={{ position: 'relative', marginTop: 6 }}>
            <input
              type={mostrarContrasena ? 'text' : 'password'}
              required
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="••••••••"
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setMostrarContrasena((v) => !v)}
              title={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              style={{
                position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer',
                display: 'flex', padding: 4,
              }}
            >
              <Icon name={mostrarContrasena ? 'eyeOff' : 'eye'} size={17} />
            </button>
          </div>

          {error && <div className="error-text">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 18 }}>
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0', color: 'var(--text-faint)', fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border, #e5e5e5)' }} />
          o
          <div style={{ flex: 1, height: 1, background: 'var(--border, #e5e5e5)' }} />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="btn"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            border: '1px solid var(--border, #e5e5e5)', background: '#fff', color: 'var(--ink)',
          }}
        >
          <GoogleIcon size={17} />
          Continuar con Google
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: 8 }}>
          Al continuar con Google autorizas el tratamiento de tus datos conforme a la Ley 1581 de 2012.
        </div>

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
