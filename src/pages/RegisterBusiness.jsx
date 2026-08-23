import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const initialForm = {
  nombrePropietario: '',
  correo: '',
  contrasena: '',
  confirmar: '',
  nombreNegocio: '',
  direccion: '',
  descripcion: '',
  whatsapp: '',
  telefono: '',
}

export default function RegisterBusiness() {
  const [form, setForm] = useState(initialForm)
  const [acepta, setAcepta] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { registerBusinessOwner } = useAuth()
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
    if (!acepta) {
      setError('Debes autorizar el tratamiento de los datos para continuar (Ley 1581 de 2012).')
      return
    }

    setLoading(true)
    try {
      await registerBusinessOwner(form)
      navigate('/panel', { replace: true })
    } catch (err) {
      setError(mapAuthError(err))
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
      <div className="card" style={{ width: 480, padding: 32, height: 'fit-content' }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Registra tu barbería en MiniBarrio</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
          Crea tu portafolio digital gratis y llega a más clientes del barrio.
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Datos del propietario</div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Nombre completo</label>
            <input required value={form.nombrePropietario} onChange={update('nombrePropietario')} placeholder="Álvaro Gómez" style={{ marginTop: 6 }} />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Correo electrónico</label>
            <input type="email" required value={form.correo} onChange={update('correo')} placeholder="negocio@ejemplo.com" style={{ marginTop: 6 }} />
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

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', marginTop: 8 }}>Datos del negocio</div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Nombre del negocio</label>
            <input required value={form.nombreNegocio} onChange={update('nombreNegocio')} placeholder="Barbería El Britalia" style={{ marginTop: 6 }} />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Categoría de servicio</label>
            <input disabled value="Barbería y estética" style={{ marginTop: 6, background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 5 }}>
              Este prototipo está enfocado exclusivamente en barberías y estética del barrio Britalia.
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Dirección</label>
            <input required value={form.direccion} onChange={update('direccion')} placeholder="Cra. 104 #146-22, Britalia" style={{ marginTop: 6 }} />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Descripción breve</label>
            <textarea rows={2} value={form.descripcion} onChange={update('descripcion')} placeholder="Fades, diseño y afeitado clásico en el corazón de Britalia." style={{ marginTop: 6, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700 }}>WhatsApp</label>
              <input required value={form.whatsapp} onChange={update('whatsapp')} placeholder="300 000 0000" style={{ marginTop: 6 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700 }}>Teléfono</label>
              <input required value={form.telefono} onChange={update('telefono')} placeholder="601 000 0000" style={{ marginTop: 6 }} />
            </div>
          </div>

          <label style={{ display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--text-muted)', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} style={{ width: 'auto', marginTop: 2 }} />
            Autorizo el tratamiento de los datos personales y del negocio conforme a la Ley 1581 de 2012.
          </label>

          {error && <div className="error-text">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Creando cuenta…' : 'Crear cuenta de negocio'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-muted)', marginTop: 18 }}>
          ¿Ya tienes cuenta? <Link to="/login" style={{ fontWeight: 700 }}>Inicia sesión</Link>
        </div>
      </div>
    </div>
  )
}

function mapAuthError(err) {
  const code = err?.code || ''
  if (code.includes('email-already-in-use')) return 'Ya existe una cuenta con ese correo.'
  if (code.includes('invalid-email')) return 'El correo electrónico no es válido.'
  if (code.includes('weak-password')) return 'La contraseña debe tener al menos 6 caracteres.'
  return 'No se pudo crear la cuenta. Intenta de nuevo en unos minutos.'
}
