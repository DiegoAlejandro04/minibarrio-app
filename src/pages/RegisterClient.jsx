import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function RegisterClient() {
  const [form, setForm] = useState({ nombre: '', correo: '', telefono: '', contrasena: '', confirmar: '' })
  const [acepta, setAcepta] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { registerClient } = useAuth()
  const navigate = useNavigate()

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.contrasena !== form.confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (form.contrasena.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (!acepta) {
      setError('Debes autorizar el tratamiento de tus datos personales para continuar (Ley 1581 de 2012).')
      return
    }

    setLoading(true)
    try {
      await registerClient({
        nombre: form.nombre,
        correo: form.correo,
        telefono: form.telefono,
        contrasena: form.contrasena,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(mapAuthError(err))
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: 400, padding: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Crea tu cuenta de cliente</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
          Regístrate para agendar y guardar tus barberías favoritas.
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Nombre completo</label>
            <input required value={form.nombre} onChange={update('nombre')} placeholder="Camilo Rodríguez" style={{ marginTop: 6 }} />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Correo electrónico</label>
            <input type="email" required value={form.correo} onChange={update('correo')} placeholder="tucorreo@ejemplo.com" style={{ marginTop: 6 }} />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Teléfono / WhatsApp</label>
            <input required value={form.telefono} onChange={update('telefono')} placeholder="300 000 0000" style={{ marginTop: 6 }} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700 }}>Contraseña</label>
              <input type="password" required value={form.contrasena} onChange={update('contrasena')} placeholder="••••••••" style={{ marginTop: 6 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700 }}>Confirmar</label>
              <input type="password" required value={form.confirmar} onChange={update('confirmar')} placeholder="••••••••" style={{ marginTop: 6 }} />
            </div>
          </div>

          <label style={{ display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--text-muted)', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} style={{ width: 'auto', marginTop: 2 }} />
            Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.
          </label>

          {error && <div className="error-text">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-muted)', marginTop: 18 }}>
          ¿Ya tienes cuenta? <Link to="/login" style={{ fontWeight: 700 }}>Inicia sesión</Link>
        </div>
        <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6 }}>
          ¿Tienes una barbería? <Link to="/registro/negocio" style={{ fontWeight: 700 }}>Regístrala aquí</Link>
        </div>
      </div>
    </div>
  )
}

function mapAuthError(err) {
  const code = err?.code || ''
  if (code.includes('email-already-in-use')) return 'Ya existe una cuenta con ese correo.'
  if (code.includes('invalid-email')) return 'El correo electrónico no es válido.'
  if (code.includes('weak-password')) return 'La contraseña es demasiado débil.'
  return 'No se pudo crear la cuenta. Intenta de nuevo en unos minutos.'
}
