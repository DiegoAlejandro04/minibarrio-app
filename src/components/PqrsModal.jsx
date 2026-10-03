import { useState } from 'react'
import Icon from './Icon.jsx'
import { PLANTILLA_PQRS, enviarCorreo, segundosParaReenviar } from '../emailjs.js'

// Formulario de PQRS (peticiones, quejas, reclamos y sugerencias — Ley 1581
// de 2012). Llega por correo con EmailJS (ver emailjs.js).

const TIPOS = ['Petición', 'Queja', 'Reclamo', 'Sugerencia']
const CLAVE_ULTIMO_ENVIO = 'pqrs-ultimo-envio'

const FORM_VACIO = { nombre: '', correo: '', telefono: '', titulo: '', tipo: '', resumen: '' }

export default function PqrsModal({ onClose }) {
  const [form, setForm] = useState(FORM_VACIO)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

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
      setError('Escribe un correo electrónico válido.')
      return
    }
    if (!/^[\d\s+()-]{7,}$/.test(datos.telefono)) {
      setError('Escribe un número de teléfono válido.')
      return
    }
    const espera = segundosParaReenviar(CLAVE_ULTIMO_ENVIO)
    if (espera) {
      setError(`Ya enviaste una PQRS hace poco. Espera ${espera} segundos para enviar otra.`)
      return
    }

    setError('')
    setEnviando(true)
    try {
      await enviarCorreo(PLANTILLA_PQRS, datos, CLAVE_ULTIMO_ENVIO)
      setEnviado(true)
    } catch (err) {
      setError('No se pudo enviar tu PQRS. Revisa tu conexión e intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setEnviando(false)
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
            <div style={{ fontWeight: 800, fontSize: 17 }}>PQRS</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Peticiones, quejas, reclamos y sugerencias
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {enviado ? (
          <>
            <p style={{ fontSize: 14, marginTop: 18, lineHeight: 1.6 }}>
              ¡Gracias, {form.nombre.trim().split(' ')[0]}! Recibimos tu {form.tipo.toLowerCase()} y te
              responderemos a <strong>{form.correo.trim()}</strong>.
            </p>
            <button type="button" className="btn btn-primary" onClick={onClose} style={{ width: '100%', marginTop: 16 }}>
              Cerrar
            </button>
          </>
        ) : (
          <>
            <label style={etiqueta} htmlFor="pqrs-nombre">Nombre completo</label>
            <input id="pqrs-nombre" value={form.nombre} onChange={cambiar('nombre')} autoComplete="name" maxLength={100} style={{ marginTop: 6 }} />

            <label style={etiqueta} htmlFor="pqrs-correo">Correo electrónico</label>
            <input id="pqrs-correo" type="email" value={form.correo} onChange={cambiar('correo')} autoComplete="email" maxLength={120} style={{ marginTop: 6 }} />

            <label style={etiqueta} htmlFor="pqrs-telefono">Número de teléfono</label>
            <input id="pqrs-telefono" type="tel" value={form.telefono} onChange={cambiar('telefono')} autoComplete="tel" maxLength={20} style={{ marginTop: 6 }} />

            <label style={etiqueta} htmlFor="pqrs-titulo">Título de la incidencia</label>
            <input id="pqrs-titulo" value={form.titulo} onChange={cambiar('titulo')} maxLength={120} style={{ marginTop: 6 }} />

            <label style={etiqueta} htmlFor="pqrs-tipo">Tipo de incidencia</label>
            <select id="pqrs-tipo" value={form.tipo} onChange={cambiar('tipo')} style={{ marginTop: 6 }}>
              <option value="" disabled>Selecciona una opción</option>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <label style={etiqueta} htmlFor="pqrs-resumen">Resumen de la incidencia</label>
            <textarea
              id="pqrs-resumen"
              rows={5}
              value={form.resumen}
              onChange={cambiar('resumen')}
              maxLength={2000}
              placeholder="Cuéntanos qué pasó…"
              style={{ marginTop: 6, resize: 'vertical' }}
            />

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
