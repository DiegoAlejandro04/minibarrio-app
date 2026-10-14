import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
import ListaNotificaciones from './ListaNotificaciones.jsx'
import { marcarLeida, marcarTodasLeidas } from '../notificaciones.js'

// Campana de notificaciones del panel del negocio (OwnerResumen.jsx). Al
// tocarla, el propio botón "crece" hasta volverse un panel de cristal que se
// pone encima de toda la página: un rectángulo fijo arranca con el tamaño y
// la posición exactos de la campana y se anima hasta su tamaño final; al
// cerrar hace el camino de vuelta. Va en un portal a <body> para quedar por
// encima de todo (menú lateral incluido). Estilos .campana-* en index.css.

const DURACION_MS = 420
const MARGEN = 12

// Tamaño y posición finales: alineado al borde derecho de la campana y
// pegado a su borde superior, sin salirse de la pantalla.
function destinoDesde(origen) {
  const ancho = Math.min(400, window.innerWidth - MARGEN * 2)
  const alto = Math.min(560, window.innerHeight - origen.top - MARGEN)
  const izquierda = Math.min(Math.max(MARGEN, origen.right - ancho), window.innerWidth - ancho - MARGEN)
  return { top: origen.top, left: izquierda, width: ancho, height: alto }
}

export default function CampanaNotificaciones({ uid, notificaciones, sinLeer }) {
  const navigate = useNavigate()
  const botonRef = useRef(null)
  // cerrada → abriendo (tamaño de la campana) → abierta (tamaño final)
  // → cerrando (de vuelta al tamaño de la campana) → cerrada.
  const [fase, setFase] = useState('cerrada')
  const [origen, setOrigen] = useState(null)

  function abrir() {
    setOrigen(botonRef.current.getBoundingClientRect())
    setFase('abriendo')
  }

  function cerrar() {
    setOrigen(botonRef.current?.getBoundingClientRect() || origen)
    setFase('cerrando')
  }

  // Un cuadro después de pintar el tamaño de la campana, pasa al final: así
  // el navegador anima el cambio en vez de saltar directo.
  useLayoutEffect(() => {
    if (fase !== 'abriendo') return undefined
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setFase('abierta')))
    return () => cancelAnimationFrame(id)
  }, [fase])

  useEffect(() => {
    if (fase !== 'cerrando') return undefined
    const id = setTimeout(() => setFase('cerrada'), DURACION_MS)
    return () => clearTimeout(id)
  }, [fase])

  // Escape cierra; si cambia el tamaño de la ventana se cierra (la posición
  // calculada ya no serviría).
  useEffect(() => {
    if (fase !== 'abierta') return undefined
    const alTeclear = (e) => { if (e.key === 'Escape') cerrar() }
    const alRedimensionar = () => setFase('cerrada')
    document.addEventListener('keydown', alTeclear)
    window.addEventListener('resize', alRedimensionar)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      window.removeEventListener('resize', alRedimensionar)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase])

  function abrirNotificacion(n) {
    if (!n.leida) marcarLeida(uid, n.id)
    if (n.enlace) {
      setFase('cerrada')
      navigate(n.enlace)
    }
  }

  const visible = fase !== 'cerrada'
  const expandida = fase === 'abierta'
  const caja = origen && (expandida
    ? { ...destinoDesde(origen), borderRadius: 22 }
    : { top: origen.top, left: origen.left, width: origen.width, height: origen.height, borderRadius: 10 })

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className="campana-boton"
        onClick={abrir}
        aria-label={sinLeer ? `Notificaciones: ${sinLeer} sin leer` : 'Notificaciones'}
        aria-expanded={expandida}
        // Mientras está abierta, la campana "es" el panel: se oculta aquí.
        style={{ visibility: visible ? 'hidden' : undefined }}
      >
        <Icon name="bell" size={16} />
        {sinLeer > 0 && <span className="campana-contador">{sinLeer > 9 ? '9+' : sinLeer}</span>}
      </button>

      {visible && caja && createPortal(
        <>
          <div
            className={`campana-velo${expandida ? ' visible' : ''}`}
            role="presentation"
            onClick={expandida ? cerrar : undefined}
          />
          <section
            className={`campana-panel${expandida ? ' expandida' : ''}`}
            style={caja}
            role="dialog"
            aria-modal="true"
            aria-label="Notificaciones"
          >
            {/* La campana se ve mientras el rectángulo crece o se encoge. */}
            <span className="campana-panel-icono" aria-hidden="true"><Icon name="bell" size={16} /></span>

            <div className="campana-contenido">
              <header className="campana-cabecera">
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Notificaciones</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {sinLeer ? `${sinLeer} sin leer` : 'Todo al día'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {sinLeer > 0 && (
                    <button type="button" className="notif-marcar-todas" onClick={() => marcarTodasLeidas(uid, notificaciones)}>
                      Marcar todas
                    </button>
                  )}
                  <button type="button" className="campana-cerrar" onClick={cerrar} aria-label="Cerrar notificaciones">
                    <Icon name="x" size={17} />
                  </button>
                </div>
              </header>
              <div className="campana-lista">
                <ListaNotificaciones notificaciones={notificaciones} onAbrir={abrirNotificacion} />
              </div>
            </div>
          </section>
        </>,
        document.body,
      )}
    </>
  )
}
