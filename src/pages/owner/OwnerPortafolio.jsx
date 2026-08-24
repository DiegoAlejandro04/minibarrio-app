import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import Icon from '../../components/Icon.jsx'

// Portafolio de fotos del negocio (RF-03). El proyecto no tiene Firebase
// Storage configurado todavía, así que las fotos se agregan pegando la URL
// de una imagen ya subida a otro servicio (Google Fotos, Instagram, Imgur…)
// en vez de subir el archivo directamente.

export default function OwnerPortafolio() {
  const { negocio, uid } = useOutletContext()
  const [url, setUrl] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const fotos = negocio.fotos || []

  async function handleAgregar(e) {
    e.preventDefault()
    const valor = url.trim()
    if (!valor) return

    let parsed
    try {
      parsed = new URL(valor)
    } catch {
      setError('Ingresa una URL válida (debe empezar con https://).')
      return
    }
    if (parsed.protocol !== 'https:') {
      setError('La URL debe usar https://.')
      return
    }
    if (fotos.includes(valor)) {
      setError('Esa foto ya está en tu portafolio.')
      return
    }

    setError('')
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'negocios', uid), { fotos: arrayUnion(valor) })
      setUrl('')
    } catch (err) {
      setError('No se pudo agregar la foto. Intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  async function handleQuitar(fotoUrl) {
    await updateDoc(doc(db, 'negocios', uid), { fotos: arrayRemove(fotoUrl) })
  }

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Portafolio</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 24, maxWidth: 620, lineHeight: 1.5 }}>
        Agrega fotos de tus trabajos para que los clientes las vean en tu perfil público. Por ahora
        se agregan pegando el enlace de una imagen ya subida a otro sitio (Google Fotos, Instagram, Imgur…).
      </p>

      <form onSubmit={handleAgregar} className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>URL de la imagen</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" style={{ marginTop: 4 }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={guardando} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="plus" size={15} /> {guardando ? 'Agregando…' : 'Agregar foto'}
          </button>
        </div>
        {error && <div className="error-text">{error}</div>}
      </form>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Fotos publicadas ({fotos.length})</div>
        {fotos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Aún no has agregado fotos a tu portafolio.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
            {fotos.map((foto) => (
              <div
                key={foto}
                style={{
                  position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  aspectRatio: '1', background: 'var(--surface-2)',
                }}
              >
                <img
                  src={foto}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { e.currentTarget.style.opacity = 0.15 }}
                />
                <button
                  type="button"
                  onClick={() => handleQuitar(foto)}
                  title="Quitar foto"
                  style={{
                    position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', border: 'none',
                    background: 'oklch(20% 0.01 0 / 0.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
