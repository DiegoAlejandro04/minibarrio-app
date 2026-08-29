import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { auth, db } from '../../firebase/config'

export default function ClientDatosPersonales() {
  const { uid, perfil } = useOutletContext()

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setNombre(perfil?.nombre || '')
    setTelefono(perfil?.telefono || '')
  }, [perfil])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setGuardado(false)
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'usuarios', uid), { nombre, telefono })
      if (auth.currentUser && auth.currentUser.displayName !== nombre) {
        await updateProfile(auth.currentUser, { displayName: nombre })
      }
      setGuardado(true)
    } catch (err) {
      setError('No se pudieron guardar los cambios. Intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Datos personales</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 20 }}>
        Mantén actualizados tu nombre y teléfono de contacto.
      </p>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 20, maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 700 }}>Nombre completo</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required style={{ marginTop: 6 }} />
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 700 }}>Teléfono / WhatsApp</label>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} required style={{ marginTop: 6 }} />
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 700 }}>Correo electrónico</label>
          <input value={perfil?.correo || ''} disabled style={{ marginTop: 6, background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 5 }}>El correo no se puede cambiar desde aquí.</div>
        </div>

        {error && <div className="error-text">{error}</div>}
        {guardado && !error && (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--sage-text)' }}>Cambios guardados.</div>
        )}

        <button type="submit" className="btn btn-primary" disabled={guardando} style={{ marginTop: 4 }}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
