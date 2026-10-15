import { useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { deleteDoc, deleteField, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import Icon from '../../components/Icon.jsx'
import RecorteImagen from '../../components/RecorteImagen.jsx'
import useIsMobile from '../../hooks/useIsMobile.js'
import { cargarImagen, pesoKb } from '../../imagenes.js'
import { METODOS_PAGO, MAX_USUARIO_RED, limpiarUsuarioRed } from '../../perfilNegocio.js'
import FotoNegocio from '../../components/FotoNegocio.jsx'
import { estadoApertura } from '../../horarios.js'
import { acortarDireccion } from '../../maps/osm.js'

// Identidad del negocio: logo, foto de portada, métodos de pago y redes. Lo
// que se configura aquí se ve en el mapa, en las tarjetas de la vitrina y en
// el portafolio público (NegocioDetalle.jsx).
//
// Logo y portada se recortan y comprimen en el navegador (imagenes.js) y se
// guardan como texto en Firestore: el logo en el documento del negocio
// (pesa poco y el mapa lo necesita para todos los negocios), la portada en
// negocios/{id}/medios/portada (pesa más y solo se descarga al abrir el
// portafolio de ese negocio).

// Topes de peso, en KB del texto guardado (mismos que firestore.rules).
const MAX_LOGO_KB = 140
const MAX_PORTADA_KB = 650

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

function iniciales(nombre) {
  return (nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}

export default function OwnerIdentidad() {
  const { negocio, uid, portada, servicios } = useOutletContext()
  const isMobile = useIsMobile()

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Identidad</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 24, lineHeight: 1.5 }}>
        Así te reconocen los clientes en el mapa, en la vitrina y en tu portafolio.
      </p>

      <VistaPrevia negocio={negocio} servicios={servicios} uid={uid} isMobile={isMobile} />
      <SeccionLogo negocio={negocio} uid={uid} />
      <SeccionPortada uid={uid} portada={portada} isMobile={isMobile} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        <SeccionPagos negocio={negocio} uid={uid} />
        <SeccionRedes negocio={negocio} uid={uid} />
      </div>
    </div>
  )
}

// "Así te ven los clientes": el pin del mapa y la tarjeta de la vitrina con
// los datos guardados del negocio, dibujados con los mismos estilos que en
// ClientHome.jsx (.pin-negocio, .tarjeta-negocio). Se actualiza sola al
// guardar un logo o una foto, porque el negocio llega en tiempo real
// (OwnerLayout.jsx).
function VistaPrevia({ negocio, servicios = [], uid, isMobile }) {
  const estado = estadoApertura(negocio.horarios)
  const abierto = estado === 'abierto' || estado === 'cierra-pronto'
  const precios = servicios.filter((s) => s.visible !== false).map((s) => s.precio || 0)
  const precioDesde = precios.length ? Math.min(...precios) : null
  const fotoPin = negocio.logo || negocio.miniatura || negocio.fotos?.[0]

  return (
    <section className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="eye" size={17} /> Así te ven los clientes
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.45 }}>
            Tu pin en el mapa y tu tarjeta en la vitrina. Cambian al guardar tu logo o tus fotos.
          </div>
        </div>
        <Link to={`/negocio/${uid}`} className="vista-previa__enlace">
          Ver portafolio completo <Icon name="chevronRight" size={15} />
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.15fr', gap: 14, marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="vista-previa__etiqueta">En el mapa</div>
          <div className="vista-previa__mapa" aria-hidden="true">
            <div className="vista-previa__pin">
              <div className="pin-negocio pin-negocio--destacado">
                <div className="pin-negocio__burbuja">
                  {fotoPin
                    ? <img src={fotoPin} alt="" />
                    : <span className="pin-negocio__iniciales">{iniciales(negocio.nombre)}</span>}
                </div>
                {abierto && <span className="pin-negocio__abierto" />}
              </div>
              <span className="vista-previa__nombre-pin">{negocio.nombre}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="vista-previa__etiqueta">En la vitrina</div>
          <div className="card tarjeta-negocio" style={{ overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
            <FotoNegocio negocio={negocio} estado={estado} alto={118} />
            <div className="tarjeta-negocio__cuerpo" style={{ padding: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>{negocio.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {negocio.descripcion || negocio.categoria}
              </div>
              {negocio.direccion && (
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {acortarDireccion(negocio.direccion)}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                  {precioDesde != null ? `Desde ${COP.format(precioDesde)}` : 'Consulta precios'}
                </span>
                {negocio.especialidades?.[0] && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    {negocio.especialidades[0]}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Tarjeta({ titulo, detalle, children }) {
  return (
    <section className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>{titulo}</div>
      {detalle && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.45 }}>{detalle}</div>}
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  )
}

// Botón que abre el selector de archivos (el <input type="file"> va oculto).
function BotonArchivo({ texto, onArchivo }) {
  const entrada = useRef(null)
  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          e.target.value = '' // permite volver a elegir el mismo archivo
          if (archivo) onArchivo(archivo)
        }}
      />
      <button type="button" className="btn btn-primary" onClick={() => entrada.current?.click()} style={{ padding: '9px 16px', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Icon name="upload" size={15} /> {texto}
      </button>
    </>
  )
}

// Carga la imagen elegida o explica por qué no se pudo.
function useImagenElegida() {
  const [imagen, setImagen] = useState(null)
  const [error, setError] = useState('')
  async function elegir(archivo) {
    setError('')
    if (archivo.size > 15 * 1024 * 1024) {
      setError('La imagen pesa más de 15 MB. Elige una más liviana.')
      return
    }
    try {
      setImagen(await cargarImagen(archivo))
    } catch (err) {
      setError(err.message)
    }
  }
  function descartar() {
    if (imagen) URL.revokeObjectURL(imagen.url)
    setImagen(null)
  }
  return { imagen, error, setError, elegir, descartar }
}

function SeccionLogo({ negocio, uid }) {
  const { imagen, error, setError, elegir, descartar } = useImagenElegida()
  const [guardando, setGuardando] = useState(false)

  async function guardar(dataUrl) {
    if (pesoKb(dataUrl) > MAX_LOGO_KB) {
      setError('La imagen quedó muy pesada. Prueba con otra o acércala más con el zoom.')
      return
    }
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'negocios', uid), { logo: dataUrl })
      descartar()
    } catch (err) {
      setError('No se pudo guardar el logo. Intenta de nuevo.')
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  async function quitar() {
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'negocios', uid), { logo: deleteField() })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta titulo="Logo" detalle="Aparece en tu pin del mapa, en tu tarjeta de la vitrina y en tu portafolio. Se guarda en forma de círculo.">
      {imagen ? (
        <RecorteImagen
          imagen={imagen}
          ancho={240}
          alto={240}
          forma="circulo"
          salida={{ salidaAncho: 256, salidaAlto: 256, calidad: 0.85 }}
          guardando={guardando}
          onGuardar={guardar}
          onCancelar={descartar}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 92, height: 92, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, oklch(74% 0.15 52), oklch(52% 0.14 36))',
                color: '#fff', fontSize: 28, fontWeight: 800, boxShadow: '0 0 0 3px var(--surface), 0 0 0 5px var(--accent)',
              }}
            >
              {negocio.logo ? <img src={negocio.logo} alt="Tu logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : iniciales(negocio.nombre)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8 }}>{negocio.logo ? 'Tu logo' : 'Sin logo: tus iniciales'}</div>
          </div>

          {/* Vista previa del pin del mapa, con las mismas clases que el real. */}
          <div style={{ textAlign: 'center' }}>
            <div className="pin-negocio pin-negocio--destacado" style={{ margin: '0 auto' }}>
              <div className="pin-negocio__burbuja">
                {negocio.logo
                  ? <img src={negocio.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span className="pin-negocio__iniciales">{iniciales(negocio.nombre)}</span>}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8 }}>Así se ve en el mapa</div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <BotonArchivo texto={negocio.logo ? 'Cambiar logo' : 'Subir logo'} onArchivo={elegir} />
            {negocio.logo && (
              <button type="button" className="btn btn-outline" onClick={quitar} disabled={guardando} style={{ padding: '9px 16px', fontSize: 13.5 }}>
                Quitar
              </button>
            )}
          </div>
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
    </Tarjeta>
  )
}

function SeccionPortada({ uid, portada, isMobile }) {
  const { imagen, error, setError, elegir, descartar } = useImagenElegida()
  const [guardando, setGuardando] = useState(false)
  const ancho = isMobile ? Math.max(240, Math.min(540, window.innerWidth - 72)) : 540
  const alto = Math.round(ancho / 3)

  async function guardar(dataUrl) {
    if (pesoKb(dataUrl) > MAX_PORTADA_KB) {
      setError('La imagen quedó muy pesada. Prueba con otra.')
      return
    }
    setGuardando(true)
    try {
      await setDoc(doc(db, 'negocios', uid, 'medios', 'portada'), { imagen: dataUrl, actualizadoEn: serverTimestamp() })
      descartar()
    } catch (err) {
      setError('No se pudo guardar la portada. Intenta de nuevo.')
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  async function quitar() {
    setGuardando(true)
    try {
      await deleteDoc(doc(db, 'negocios', uid, 'medios', 'portada'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta titulo="Foto de portada" detalle="Una foto ancha de tu local o de tu trabajo, para el encabezado de tu portafolio. Es opcional.">
      {imagen ? (
        <RecorteImagen
          imagen={imagen}
          ancho={ancho}
          alto={alto}
          salida={{ salidaAncho: 1200, salidaAlto: 400, calidad: 0.78 }}
          guardando={guardando}
          onGuardar={guardar}
          onCancelar={descartar}
        />
      ) : (
        <>
          {portada ? (
            <img src={portada} alt="Tu portada" style={{ width: '100%', maxWidth: 540, aspectRatio: '3 / 1', objectFit: 'cover', borderRadius: 'var(--radius-md)', display: 'block' }} />
          ) : (
            <div
              style={{
                maxWidth: 540, aspectRatio: '3 / 1', borderRadius: 'var(--radius-md)', border: '1.5px dashed var(--border-strong)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13,
              }}
            >
              Aún no tienes foto de portada
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <BotonArchivo texto={portada ? 'Cambiar portada' : 'Subir portada'} onArchivo={elegir} />
            {portada && (
              <button type="button" className="btn btn-outline" onClick={quitar} disabled={guardando} style={{ padding: '9px 16px', fontSize: 13.5 }}>
                Quitar
              </button>
            )}
          </div>
        </>
      )}
      {error && <div className="error-text">{error}</div>}
    </Tarjeta>
  )
}

function SeccionPagos({ negocio, uid }) {
  const elegidos = negocio.metodosPago || []
  const [error, setError] = useState('')

  async function alternar(id) {
    const nuevos = elegidos.includes(id) ? elegidos.filter((m) => m !== id) : [...elegidos, id]
    setError('')
    try {
      // Se guarda en el orden de la lista, no en el orden en que se marcaron.
      await updateDoc(doc(db, 'negocios', uid), { metodosPago: METODOS_PAGO.map((m) => m.id).filter((m) => nuevos.includes(m)) })
    } catch (err) {
      setError('No se pudo guardar. Intenta de nuevo.')
      console.error(err)
    }
  }

  return (
    <Tarjeta titulo="Métodos de pago" detalle="Toca los que aceptas. Se guardan al instante.">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {METODOS_PAGO.map((m) => {
          const activo = elegidos.includes(m.id)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => alternar(m.id)}
              aria-pressed={activo}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                background: activo ? 'var(--accent-soft)' : 'var(--surface)',
                color: activo ? 'var(--accent-hover)' : 'var(--text-muted)',
                border: `1px solid ${activo ? 'var(--accent)' : 'var(--border-strong)'}`,
              }}
            >
              {activo && <Icon name="check" size={13} />}
              {m.label}
            </button>
          )
        })}
      </div>
      {error && <div className="error-text">{error}</div>}
    </Tarjeta>
  )
}

function SeccionRedes({ negocio, uid }) {
  const redes = negocio.canalesContacto || {}
  const [instagram, setInstagram] = useState(redes.instagram || '')
  const [tiktok, setTiktok] = useState(redes.tiktok || '')
  const [estado, setEstado] = useState('') // '' | 'guardando' | 'guardado' | 'error'

  async function guardar(e) {
    e.preventDefault()
    const ig = limpiarUsuarioRed(instagram)
    const tt = limpiarUsuarioRed(tiktok)
    setInstagram(ig)
    setTiktok(tt)
    setEstado('guardando')
    try {
      await updateDoc(doc(db, 'negocios', uid), {
        'canalesContacto.instagram': ig || deleteField(),
        'canalesContacto.tiktok': tt || deleteField(),
      })
      setEstado('guardado')
    } catch (err) {
      setEstado('error')
      console.error(err)
    }
  }

  const campo = (etiqueta, valor, setValor, icono) => (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{etiqueta}</span>
      <span style={{ position: 'relative', display: 'block', marginTop: 4 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', display: 'flex', fontSize: 14 }}>
          {icono}
        </span>
        <input
          value={valor}
          maxLength={80}
          onChange={(e) => { setValor(e.target.value); setEstado('') }}
          placeholder="usuario o enlace del perfil"
          style={{ paddingLeft: 30 }}
        />
      </span>
    </label>
  )

  return (
    <Tarjeta titulo="Redes sociales" detalle="Tus clientes ven aquí tus trabajos más recientes.">
      <form onSubmit={guardar}>
        {campo('Instagram', instagram, setInstagram, '@')}
        {campo('TikTok', tiktok, setTiktok, '@')}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={estado === 'guardando'} style={{ padding: '9px 16px', fontSize: 13.5 }}>
            {estado === 'guardando' ? 'Guardando…' : 'Guardar redes'}
          </button>
          {estado === 'guardado' && <span style={{ fontSize: 12.5, color: 'var(--sage-text)', fontWeight: 700 }}>Guardado</span>}
          {estado === 'error' && <span className="error-text" style={{ marginTop: 0 }}>No se pudo guardar.</span>}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8 }}>Máximo {MAX_USUARIO_RED} caracteres por usuario.</div>
      </form>
    </Tarjeta>
  )
}
