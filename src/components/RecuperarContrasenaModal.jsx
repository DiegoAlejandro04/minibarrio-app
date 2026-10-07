import { useRef, useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase/config'
import Icon from './Icon.jsx'
import Captcha from './Captcha.jsx'

// "¿Olvidaste tu contraseña?" del inicio de sesión. Usa la recuperación que
// ya trae Firebase Authentication: Firebase envía el correo (en español, ver
// auth.languageCode en firebase/config.js) con un enlace para elegir una
// contraseña nueva. No pasa por EmailJS ni gasta su cupo.
//
// El mensaje de éxito es el mismo exista o no una cuenta con ese correo,
// para que el formulario no sirva para averiguar qué correos están
// registrados.

export default function RecuperarContrasenaModal({ correoInicial = '', onClose }) {
  const [correo, setCorreo] = useState(correoInicial)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [captcha, setCaptcha] = useState(null) // token de reCAPTCHA v2, ver Captcha.jsx
  const captchaRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const limpio = correo.trim()
    if (!/^\S+@\S+\.\S+$/.test(limpio)) {
      setError('Escribe un correo electrónico válido.')
      return
    }
    if (!captcha) {
      setError('Marca la casilla "No soy un robot".')
      return
    }

    setError('')
    setEnviando(true)
    try {
      // Después de elegir la contraseña nueva, la página de Firebase muestra
      // un botón "Continuar" que regresa al inicio de sesión de la app.
      await sendPasswordResetEmail(auth, limpio, { url: `${window.location.origin}/login` })
      setEnviado(true)
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setEnviado(true) // mismo mensaje que si existiera, ver arriba
      } else if (err.code === 'auth/too-many-requests') {
        setError('Hiciste demasiados intentos. Espera unos minutos e intenta de nuevo.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Escribe un correo electrónico válido.')
      } else {
        setError('No se pudo enviar el correo. Revisa tu conexión e intenta de nuevo.')
        // eslint-disable-next-line no-console
        console.error(err)
      }
    } finally {
      setEnviando(false)
      captchaRef.current?.reiniciar() // cada token sirve una sola vez
    }
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'oklch(20% 0.01 0 / 0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="card"
        noValidate
        style={{ width: 400, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', padding: 22 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Recuperar contraseña</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Te enviaremos un enlace para crear una nueva
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {enviado ? (
          <>
            <p style={{ fontSize: 14, marginTop: 18, lineHeight: 1.6 }}>
              Si <strong>{correo.trim()}</strong> tiene una cuenta en MiniBarrio, te enviamos un enlace para
              restablecer tu contraseña. Revisa también la carpeta de spam.
            </p>
            <button type="button" className="btn btn-primary" onClick={onClose} style={{ width: '100%', marginTop: 16 }}>
              Volver a iniciar sesión
            </button>
          </>
        ) : (
          <>
            <label htmlFor="recuperar-correo" style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginTop: 18 }}>
              Correo electrónico
            </label>
            <input
              id="recuperar-correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              autoComplete="email"
              maxLength={120}
              placeholder="tucorreo@ejemplo.com"
              style={{ marginTop: 6 }}
            />

            <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8, lineHeight: 1.5 }}>
              Si creaste tu cuenta con Google, no tienes contraseña en MiniBarrio: entra con el botón
              &ldquo;Continuar con Google&rdquo;.
            </p>

            <div style={{ marginTop: 14 }}>
              <Captcha ref={captchaRef} onChange={setCaptcha} />
            </div>

            {error && <div className="error-text">{error}</div>}

            <button type="submit" className="btn btn-primary" disabled={enviando} style={{ width: '100%', marginTop: 16 }}>
              {enviando ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
