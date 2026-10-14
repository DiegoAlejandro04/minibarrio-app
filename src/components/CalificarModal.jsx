import { useState } from 'react'
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config'
import { agregarAvisos } from '../notificaciones.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from './Icon.jsx'

// Formulario de reseña (RF-10). Reseña verificada: solo se abre con una cita
// del cliente en este negocio que ya pasó y no se canceló (la elige
// NegocioDetalle.jsx), y firestore.rules lo vuelve a comprobar en el servidor
// con esa misma cita (citaId). Se guarda también el nombre corto del cliente
// ("Laura M.") para mostrarlo con la reseña: las reglas no dejan leer
// perfiles ajenos, así que no se podría buscar después.

const MAX_COMENTARIO = 500 // mismo tope que exige firestore.rules

export default function CalificarModal({ negocio, citaId, nombreCliente, onClose, onCreada }) {
  const { currentUser } = useAuth()
  const [calificacion, setCalificacion] = useState(0)
  const [hover, setHover] = useState(0)
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (calificacion === 0) {
      setError('Elige una calificación de 1 a 5 estrellas.')
      return
    }
    setError('')
    setGuardando(true)
    try {
      // El id de la reseña es el uid del cliente: una sola reseña por cliente
      // en cada negocio. firestore.rules rechaza una segunda.
      // La reseña y la notificación al negocio van juntas (ver
      // notificaciones.js); por privacidad, el aviso no dice quién la escribió.
      const texto = comentario.trim().slice(0, MAX_COMENTARIO)
      const batch = writeBatch(db)
      batch.set(doc(db, 'negocios', negocio.id, 'resenas', currentUser.uid), {
        negocioId: negocio.id,
        clienteId: currentUser.uid,
        calificacion,
        comentario: texto,
        creadoEn: serverTimestamp(),
        citaId,
        ...(nombreCliente ? { nombreCliente: nombreCliente.slice(0, 40) } : {}),
      })
      agregarAvisos(batch, [{
        destinatarioId: negocio.id,
        tipo: 'nueva-resena',
        titulo: `Nueva reseña de ${'★'.repeat(calificacion)}`,
        texto: texto ? `"${texto.length > 140 ? `${texto.slice(0, 140)}…` : texto}"` : `Un cliente te calificó con ${calificacion} de 5 estrellas.`,
        enlace: '/panel/resenas',
      }])
      await batch.commit()
      onCreada?.()
      onClose()
    } catch (err) {
      setError(err.code === 'permission-denied'
        ? 'No se pudo publicar: solo puedes calificar una vez, y después de una cita tuya en este negocio.'
        : 'No se pudo publicar tu reseña. Intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      role="presentation"
      className="ventana-velo"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'oklch(20% 0.01 0 / 0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="card ventana-vidrio"
        style={{ width: 380, maxWidth: '100%', padding: 22 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Califica tu visita</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{negocio.nombre}</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 18 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCalificacion(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                color: n <= (hover || calificacion) ? 'var(--accent)' : 'var(--border-strong)',
              }}
            >
              <Icon name="star" size={26} filled />
            </button>
          ))}
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginTop: 16 }}>Comentario (opcional)</label>
        <textarea
          rows={3}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Cuéntanos cómo te fue…"
          maxLength={MAX_COMENTARIO}
          style={{ marginTop: 6, resize: 'vertical' }}
        />

        {error && <div className="error-text">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={guardando} style={{ width: '100%', marginTop: 16 }}>
          {guardando ? 'Publicando…' : 'Publicar reseña'}
        </button>
      </form>
    </div>
  )
}
