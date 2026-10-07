import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, verifyBeforeUpdateEmail,
} from 'firebase/auth'
import { useAuth } from '../../context/AuthContext.jsx'
import Icon from '../../components/Icon.jsx'
import ToggleIOS from '../../components/ToggleIOS.jsx'

// Configuración del cliente: cambio de correo (requiere reautenticación,
// Editar perfil/datos personales no lo permite a propósito) y preferencia
// de modo oscuro, persistida en su perfil de Firestore.

const ERRORES = {
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-credential': 'Contraseña incorrecta.',
  'auth/invalid-email': 'Ese correo no es válido.',
  'auth/email-already-in-use': 'Ese correo ya está en uso por otra cuenta.',
  'auth/requires-recent-login': 'Por seguridad, cierra sesión, vuelve a iniciarla e inténtalo de nuevo.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de confirmar.',
  'auth/too-many-requests': 'Hiciste demasiados intentos. Espera unos minutos e intenta de nuevo.',
}

function mensajeError(err) {
  return ERRORES[err?.code] || 'No se pudo actualizar el correo. Intenta de nuevo.'
}

export default function ClientConfiguracion() {
  const { perfil } = useOutletContext()
  const { currentUser, modoOscuro, actualizarModoOscuro } = useAuth()

  const esConGoogle = currentUser?.providerData?.[0]?.providerId === 'google.com'

  const [nuevoCorreo, setNuevoCorreo] = useState('')
  const [contrasenaActual, setContrasenaActual] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [correoPendiente, setCorreoPendiente] = useState('') // al que se envió el enlace de confirmación

  async function handleCambiarCorreo(e) {
    e.preventDefault()
    setError('')
    setExito(false)

    if (nuevoCorreo.trim().toLowerCase() === (perfil?.correo || '').toLowerCase()) {
      setError('Ese ya es tu correo actual.')
      return
    }

    setGuardando(true)
    try {
      if (esConGoogle) {
        await reauthenticateWithPopup(currentUser, new GoogleAuthProvider())
      } else {
        await reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(currentUser.email, contrasenaActual))
      }
      // Firebase ya no permite cambiar el correo de golpe (updateEmail queda
      // bloqueado por la protección contra enumeración de correos): primero
      // hay que confirmar el correo nuevo. Esto envía un enlace a ese correo,
      // y el cambio se aplica cuando el usuario lo abre. El perfil de
      // Firestore se pone al día solo en el siguiente inicio de sesión (ver
      // ClientLayout.jsx).
      await verifyBeforeUpdateEmail(currentUser, nuevoCorreo.trim(), { url: `${window.location.origin}/login` })
      setCorreoPendiente(nuevoCorreo.trim())
      setExito(true)
      setNuevoCorreo('')
      setContrasenaActual('')
    } catch (err) {
      setError(mensajeError(err))
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Configuración</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 20 }}>
        Seguridad de tu cuenta y preferencias de la aplicación.
      </p>

      <form onSubmit={handleCambiarCorreo} className="card" style={{ padding: 20, maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="mail" size={17} />
          <span style={{ fontWeight: 800, fontSize: 14.5 }}>Modificar correo electrónico</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: -8 }}>
          Correo actual: {perfil?.correo}
        </div>

        <div>
          <label style={{ fontSize: 12.5, fontWeight: 700 }}>Nuevo correo</label>
          <input
            type="email"
            value={nuevoCorreo}
            onChange={(e) => setNuevoCorreo(e.target.value)}
            required
            style={{ marginTop: 6 }}
          />
        </div>

        {esConGoogle ? (
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Iniciaste sesión con Google — para confirmar el cambio te pediremos que vuelvas a iniciar sesión con Google.
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Contraseña actual</label>
            <input
              type="password"
              value={contrasenaActual}
              onChange={(e) => setContrasenaActual(e.target.value)}
              required
              style={{ marginTop: 6 }}
            />
          </div>
        )}

        {error && <div className="error-text">{error}</div>}
        {exito && !error && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--sage-text)', lineHeight: 1.5 }}>
            Te enviamos un enlace a <strong>{correoPendiente}</strong>. Ábrelo para confirmar el cambio
            (revisa también spam). Después, inicia sesión con tu correo nuevo.
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={guardando} style={{ marginTop: 4 }}>
          {guardando ? 'Actualizando…' : 'Actualizar correo'}
        </button>
      </form>

      <div className="card" style={{ padding: 20, maxWidth: 420, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="moon" size={17} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>Modo oscuro</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
              Aplica a la vitrina y a tu panel de cliente.
            </div>
          </div>
        </div>
        <ToggleIOS checked={modoOscuro} onChange={actualizarModoOscuro} label="Modo oscuro" />
      </div>
    </div>
  )
}
