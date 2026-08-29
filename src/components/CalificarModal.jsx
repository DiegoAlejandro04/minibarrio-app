import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from './Icon.jsx'

// Formulario de reseña (RF-10). Se asocia al negocio, no a una cita puntual
// específica: el modelo de datos (ver docs/MODELO_DATOS.md) guarda "resenas"
// como subcolección de "negocios" sin referencia a la cita de origen.

export default function CalificarModal({ negocio, onClose, onCreada }) {
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
      await addDoc(collection(db, 'negocios', negocio.id, 'resenas'), {
        negocioId: negocio.id,
        clienteId: currentUser.uid,
        calificacion,
        comentario: comentario.trim(),
        creadoEn: serverTimestamp(),
      })
      onCreada?.()
      onClose()
    } catch (err) {
      setError('No se pudo publicar tu reseña. Intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setGuardando(false)
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
