import { useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import Icon from '../../components/Icon.jsx'
import { cargarImagen, imagenDesdeDataUrl, miniatura, pesoKb, redimensionar } from '../../imagenes.js'
import { MAX_FOTOS_PORTAFOLIO, usePortafolio } from '../../portafolio.js'

// Portafolio de fotos del negocio (RF-03). Las fotos se suben desde el
// celular o el computador: se reducen y comprimen en el navegador
// (imagenes.js) y cada una se guarda en su propio documento (ver
// portafolio.js y firestore.rules → fotosPortafolio). La foto principal
// además deja una miniatura en el documento del negocio, que es la que
// muestra su tarjeta en la vitrina.
//
// Las fotos antiguas agregadas con un enlace se siguen mostrando y se pueden
// quitar; agregar por enlace queda como opción secundaria.

const LADO_MAX = 1080 // px del lado más largo de cada foto
const MAX_FOTO_KB = 240 // mismo tope que firestore.rules
const MAX_TITULO = 60

export default function OwnerPortafolio() {
  const { negocio, servicios, uid } = useOutletContext()
  const { fotos, subidas } = usePortafolio({ ...negocio, id: uid })
  const entrada = useRef(null)
  const [subiendo, setSubiendo] = useState('') // texto de progreso, '' si no está subiendo
  const [error, setError] = useState('')

  const principalId = negocio.fotoPrincipalId || subidas[0]?.id
  const cupo = MAX_FOTOS_PORTAFOLIO - subidas.length

  // Miniatura de la tarjeta en la vitrina a partir de una foto ya guardada.
  async function fijarPrincipal(foto) {
    const img = await imagenDesdeDataUrl(foto.imagen)
    await updateDoc(doc(db, 'negocios', uid), { fotoPrincipalId: foto.id, miniatura: miniatura(img) })
  }

  async function subir(archivos) {
    setError('')
    const lista = [...archivos].slice(0, Math.max(0, cupo))
    if (archivos.length > lista.length) {
      setError(`Puedes tener hasta ${MAX_FOTOS_PORTAFOLIO} fotos. Se subirán solo ${lista.length}.`)
    }
    let primeraNueva = null
    for (let i = 0; i < lista.length; i++) {
      setSubiendo(`Subiendo ${i + 1} de ${lista.length}…`)
      try {
        const { img, url } = await cargarImagen(lista[i])
        let imagen = redimensionar(img, LADO_MAX, 0.75)
        if (pesoKb(imagen) > MAX_FOTO_KB) imagen = redimensionar(img, 900, 0.62)
        URL.revokeObjectURL(url)
        if (pesoKb(imagen) > MAX_FOTO_KB) {
          setError('Una de las fotos quedó muy pesada y no se subió. Prueba con otra.')
          continue
        }
        const ref = await addDoc(collection(db, 'negocios', uid, 'fotosPortafolio'), {
          imagen, titulo: '', orden: Date.now(), creadoEn: serverTimestamp(),
        })
        if (!primeraNueva) primeraNueva = { id: ref.id, imagen }
      } catch (err) {
        setError(err.message === 'El archivo no es una imagen.' ? 'Uno de los archivos no es una imagen.' : 'No se pudo subir una de las fotos. Intenta de nuevo.')
        console.error(err)
      }
    }
    // Si todavía no hay foto principal, la primera subida pasa a serlo.
    if (primeraNueva && !negocio.miniatura) {
      try { await fijarPrincipal(primeraNueva) } catch (err) { console.error(err) }
    }
    setSubiendo('')
  }

  async function quitar(foto) {
    if (foto.deEnlace) {
      await updateDoc(doc(db, 'negocios', uid), { fotos: arrayRemove(foto.imagen) })
      return
    }
    await deleteDoc(doc(db, 'negocios', uid, 'fotosPortafolio', foto.id))
    if (foto.id === principalId) {
      // La principal se fue: pasa a serlo la siguiente, o no queda miniatura.
      const siguiente = subidas.find((f) => f.id !== foto.id)
      if (siguiente) await fijarPrincipal(siguiente)
      else await updateDoc(doc(db, 'negocios', uid), { fotoPrincipalId: deleteField(), miniatura: deleteField() })
    }
  }

  async function guardarDatos(foto, cambios) {
    await updateDoc(doc(db, 'negocios', uid, 'fotosPortafolio', foto.id), cambios)
  }

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Portafolio</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 24, maxWidth: 640, lineHeight: 1.5 }}>
        Sube fotos de tus trabajos: es lo primero que miran los clientes antes de reservar. Ponle a cada una un
        texto corto y el servicio que muestra; la foto <strong>principal</strong> es la que aparece en tu tarjeta de la vitrina.
      </p>

      <div className="card" style={{ padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Fotos de tus trabajos</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            {subidas.length} de {MAX_FOTOS_PORTAFOLIO} · desde tu celular o computador · se comprimen solas
          </div>
        </div>
        <input
          ref={entrada}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const archivos = e.target.files
            if (archivos?.length) subir(archivos)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!!subiendo || cupo <= 0}
          onClick={() => entrada.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Icon name="upload" size={15} /> {subiendo || (cupo <= 0 ? 'Llegaste al máximo' : 'Subir fotos')}
        </button>
        {error && <div className="error-text" style={{ width: '100%', marginTop: 0 }}>{error}</div>}
      </div>

      {fotos.length === 0 ? (
        <div
          className="card"
          style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5, borderStyle: 'dashed' }}
        >
          Aún no tienes fotos. Sube las de tus mejores trabajos: cortes, barbas, diseños, color…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
          {fotos.map((foto) => (
            <TarjetaFoto
              key={foto.id}
              foto={foto}
              servicios={servicios}
              esPrincipal={foto.id === principalId}
              onPrincipal={() => fijarPrincipal(foto)}
              onQuitar={() => quitar(foto)}
              onGuardar={(cambios) => guardarDatos(foto, cambios)}
            />
          ))}
        </div>
      )}

      <AgregarPorEnlace uid={uid} fotos={negocio.fotos || []} />
    </div>
  )
}

function TarjetaFoto({ foto, servicios, esPrincipal, onPrincipal, onQuitar, onGuardar }) {
  const [titulo, setTitulo] = useState(foto.titulo || '')
  const [ocupado, setOcupado] = useState(false)

  const accion = (fn) => async () => {
    setOcupado(true)
    try { await fn() } catch (err) { console.error(err) } finally { setOcupado(false) }
  }

  return (
    <div className="card" style={{ overflow: 'hidden', opacity: ocupado ? 0.6 : 1, transition: 'opacity .15s' }}>
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: 'var(--surface-2)' }}>
        <img
          src={foto.imagen}
          alt={foto.titulo || ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => { e.currentTarget.style.opacity = 0.15 }}
        />
        {esPrincipal && (
          <span style={{ position: 'absolute', left: 8, top: 8, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: 'var(--accent)', color: '#fff' }}>
            ★ Principal
          </span>
        )}
        {foto.deEnlace && (
          <span style={{ position: 'absolute', left: 8, top: 8, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: 'oklch(20% 0.01 0 / 0.65)', color: '#fff' }}>
            Desde enlace
          </span>
        )}
        <button
          type="button"
          onClick={accion(onQuitar)}
          disabled={ocupado}
          title="Quitar foto"
          aria-label="Quitar foto"
          style={{
            position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'oklch(20% 0.01 0 / 0.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>

      {foto.deEnlace ? (
        <div style={{ padding: 12, fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.45 }}>
          Foto antigua agregada por enlace. Para ponerle texto o hacerla principal, súbela de nuevo desde tu dispositivo.
        </div>
      ) : (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={titulo}
            maxLength={MAX_TITULO}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => { if (titulo.trim() !== (foto.titulo || '')) accion(() => onGuardar({ titulo: titulo.trim() }))() }}
            placeholder="Ej: Fade con diseño"
            aria-label="Texto de la foto"
            style={{ fontSize: 13 }}
          />
          <select
            value={foto.servicioId || ''}
            onChange={(e) => accion(() => onGuardar({ servicioId: e.target.value || deleteField() }))()}
            aria-label="Servicio que muestra la foto"
            style={{ fontSize: 13 }}
          >
            <option value="">Servicio (opcional)</option>
            {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          {!esPrincipal && (
            <button type="button" onClick={accion(onPrincipal)} disabled={ocupado} className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12.5 }}>
              ★ Usar como principal
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Opción secundaria: agregar una foto pegando el enlace de una imagen.
function AgregarPorEnlace({ uid, fotos }) {
  const [abierto, setAbierto] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  async function agregar(e) {
    e.preventDefault()
    const valor = url.trim()
    let parsed
    try {
      parsed = new URL(valor)
    } catch {
      setError('Ingresa una URL válida (debe empezar con https://).')
      return
    }
    if (parsed.protocol !== 'https:') return setError('La URL debe usar https://.')
    if (fotos.includes(valor)) return setError('Esa foto ya está en tu portafolio.')
    setError('')
    try {
      await updateDoc(doc(db, 'negocios', uid), { fotos: arrayUnion(valor) })
      setUrl('')
    } catch (err) {
      setError('No se pudo agregar la foto. Intenta de nuevo.')
      console.error(err)
    }
  }

  return (
    <div style={{ marginTop: 22 }}>
      {!abierto ? (
        <button type="button" onClick={() => setAbierto(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          ¿Tu foto ya está en internet? Agrégala con un enlace
        </button>
      ) : (
        <form onSubmit={agregar} className="card" style={{ padding: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Enlace directo de la imagen</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <input maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" style={{ flex: '1 1 260px' }} />
            <button type="submit" className="btn btn-outline" style={{ padding: '9px 14px', fontSize: 13 }}>Agregar</button>
          </div>
          {error && <div className="error-text">{error}</div>}
        </form>
      )}
    </div>
  )
}
