import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { auth, db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext.jsx'
import Icon from '../../components/Icon.jsx'
import RecorteImagen from '../../components/RecorteImagen.jsx'
import ContenidoAvatar from '../../components/ContenidoAvatar.jsx'
import { cargarImagen, pesoKb } from '../../imagenes.js'

// Foto de perfil: recortada en círculo y comprimida en el navegador, guardada
// como data URL en usuarios/{uid}.foto (mismo tope que la foto del equipo en
// firestore.rules). Se ve en el panel, en el encabezado de la vitrina y en
// la agenda y la lista de clientes de los negocios donde reservó.
const MAX_FOTO_KB = 140

export default function ClientDatosPersonales() {
  const { uid, perfil } = useOutletContext()
  const { actualizarFotoPerfil } = useAuth()

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')

  const [imagen, setImagen] = useState(null) // imagen recién elegida, para recortar
  const [guardandoFoto, setGuardandoFoto] = useState(false)
  const [avisoFoto, setAvisoFoto] = useState('')
  const [errorFoto, setErrorFoto] = useState('')
  const entrada = useRef(null)

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

  async function elegirFoto(archivo) {
    setErrorFoto('')
    setAvisoFoto('')
    if (archivo.size > 15 * 1024 * 1024) {
      setErrorFoto('La foto pesa más de 15 MB. Elige una más liviana.')
      return
    }
    try {
      setImagen(await cargarImagen(archivo))
    } catch (err) {
      setErrorFoto(err.message)
    }
  }

  function descartarImagen() {
    if (imagen) URL.revokeObjectURL(imagen.url)
    setImagen(null)
  }

  async function guardarFoto(dataUrl) {
    if (dataUrl && pesoKb(dataUrl) > MAX_FOTO_KB) {
      setErrorFoto('La foto quedó muy pesada. Prueba con otra o acércala más con el zoom.')
      return
    }
    setGuardandoFoto(true)
    setErrorFoto('')
    try {
      await actualizarFotoPerfil(dataUrl)
      setAvisoFoto(dataUrl ? '¡Listo! Tu foto de perfil quedó guardada.' : 'Quitamos tu foto de perfil.')
      descartarImagen()
    } catch (err) {
      setErrorFoto('No pudimos guardar tu foto. Revisa tu conexión e inténtalo de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setGuardandoFoto(false)
    }
  }

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Datos personales</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 20 }}>
        Mantén actualizados tu foto, tu nombre y tu teléfono de contacto.
      </p>

      <section className="card perfil-foto" style={{ maxWidth: 420, marginBottom: 16 }}>
        {imagen ? (
          <RecorteImagen
            imagen={imagen}
            ancho={220}
            alto={220}
            forma="circulo"
            salida={{ salidaAncho: 256, salidaAlto: 256, calidad: 0.85 }}
            guardando={guardandoFoto}
            onGuardar={guardarFoto}
            onCancelar={descartarImagen}
          />
        ) : (
          <div className="perfil-foto__fila">
            <span className="perfil-foto__circulo">
              <ContenidoAvatar nombre={perfil?.nombre} foto={perfil?.foto} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>Foto de perfil</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 }}>
                Así te reconocerán los negocios cuando reserves. Es opcional: sin foto se ven tus iniciales.
              </div>
              <input
                ref={entrada}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  e.target.value = ''
                  if (archivo) elegirFoto(archivo)
                }}
              />
              <div className="perfil-foto__botones">
                <button type="button" className="btn btn-outline" onClick={() => entrada.current?.click()} disabled={guardandoFoto}>
                  <Icon name="upload" size={14} /> {perfil?.foto ? 'Cambiar foto' : 'Subir foto'}
                </button>
                {perfil?.foto && (
                  <button type="button" className="perfil-foto__quitar" onClick={() => guardarFoto(null)} disabled={guardandoFoto}>
                    {guardandoFoto ? 'Quitando…' : 'Quitar foto'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {errorFoto && <div className="error-text" style={{ marginTop: 10 }}>{errorFoto}</div>}
        {avisoFoto && !errorFoto && !imagen && (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--sage-text)', marginTop: 10 }}>{avisoFoto}</div>
        )}
      </section>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 20, maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 700 }}>Nombre completo</label>
          <input maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} required style={{ marginTop: 6 }} />
        </div>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 700 }}>Teléfono / WhatsApp</label>
          <input maxLength={20} value={telefono} onChange={(e) => setTelefono(e.target.value)} required style={{ marginTop: 6 }} />
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
