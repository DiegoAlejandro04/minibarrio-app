import { useRef, useState } from 'react'
import Icon from './Icon.jsx'
import Captcha from './Captcha.jsx'
import { PLANTILLA_CONTACTO, enviarCorreo, segundosParaReenviar } from '../emailjs.js'

// Formulario de "Atención al cliente" del pie de página. Llega por correo con
// EmailJS (ver emailjs.js), con su propia plantilla aparte de la de PQRS.

const CLAVE_ULTIMO_ENVIO = 'contacto-ultimo-envio'

const FORM_VACIO = { nombre: '', correo: '', asunto: '', mensaje: '' }

export default function ContactoModal({ onClose }) {
  const [form, setForm] = useState(FORM_VACIO)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [captcha, setCaptcha] = useState(null) // token de reCAPTCHA v2, ver Captcha.jsx
  const captchaRef = useRef(null)

  function cambiar(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const datos = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]))
    if (Object.values(datos).some((v) => !v)) {
      setError('Completa todos los campos.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(datos.correo)) {
      setError('Escribe una dirección de e-mail válida.')
      return
    }
    if (!captcha) {
      setError('Marca la casilla "No soy un robot".')
      return
    }
    const espera = segundosParaReenviar(CLAVE_ULTIMO_ENVIO)
    if (espera) {
      setError(`Ya enviaste un mensaje hace poco. Espera ${espera} segundos para enviar otro.`)
      return
    }

    setError('')
    setEnviando(true)
    try {
      await enviarCorreo(PLANTILLA_CONTACTO, { ...datos, 'g-recaptcha-response': captcha }, CLAVE_ULTIMO_ENVIO)
      setEnviado(true)
    } catch (err) {
      setError('No se pudo enviar tu mensaje. Revisa tu conexión e intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setEnviando(false)
      captchaRef.current?.reiniciar() // cada token sirve una sola vez
    }
  }

  const etiqueta = { fontSize: 12.5, fontWeight: 700, display: 'block', marginTop: 14 }

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
        style={{ width: 460, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', padding: 22 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Contáctanos</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Escríbenos y te responderemos lo antes posible
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {enviado ? (
          <>
            <p style={{ fontSize: 14, marginTop: 18, lineHeight: 1.6 }}>
              ¡Gracias, {form.nombre.trim().split(' ')[0]}! Recibimos tu mensaje y te responderemos
              a <strong>{form.correo.trim()}</strong>.
            </p>
            <button type="button" className="btn btn-primary" onClick={onClose} style={{ width: '100%', marginTop: 16 }}>
              Cerrar
            </button>
          </>
        ) : (
          <>
            <label style={etiqueta} htmlFor="contacto-nombre">Nombre</label>
            <input id="contacto-nombre" value={form.nombre} onChange={cambiar('nombre')} autoComplete="name" maxLength={100} style={{ marginTop: 6 }} />

            <label style={etiqueta} htmlFor="contacto-correo">Dirección de e-mail</label>
            <input id="contacto-correo" type="email" value={form.correo} onChange={cambiar('correo')} autoComplete="email" maxLength={120} style={{ marginTop: 6 }} />

            <label style={etiqueta} htmlFor="contacto-asunto">Asunto del mensaje</label>
            <input id="contacto-asunto" value={form.asunto} onChange={cambiar('asunto')} maxLength={120} style={{ marginTop: 6 }} />

            <label style={etiqueta} htmlFor="contacto-mensaje">Mensaje</label>
            <textarea
              id="contacto-mensaje"
              rows={5}
              value={form.mensaje}
              onChange={cambiar('mensaje')}
              maxLength={2000}
              placeholder="Escribe tu mensaje…"
              style={{ marginTop: 6, resize: 'vertical' }}
            />

            <div style={{ marginTop: 16 }}>
              <Captcha ref={captchaRef} onChange={setCaptcha} />
            </div>

            {error && <div className="error-text">{error}</div>}

            <button type="submit" className="btn btn-primary" disabled={enviando} style={{ width: '100%', marginTop: 16 }}>
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
