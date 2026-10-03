import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, collectionGroup, onSnapshot, query, where } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'
import { geocodeDireccion, loadGoogleMaps } from '../../maps/googleMaps.js'
import useIsMobile from '../../hooks/useIsMobile.js'
import { recomendar } from '../../recomendador.js'
import { ESPECIALIDADES } from '../../especialidades.js'

// Vitrina pública de negocios (RF-05 búsqueda, RF-06 mapa, RF-09
// recomendaciones, RF-12 portafolio visible sin sesión). Muestra datos
// reales de Firestore; el mapa es una representación esquemática (no hay
// geocodificación en el modelo de datos todavía para negocios antiguos, ver
// docs/MODELO_DATOS.md). El orden y el filtrado de la vitrina los calcula el
// motor híbrido de src/recomendador.js (precio, cercanía, servicio,
// calificación e historial del cliente).

// Mismo vocabulario que el selector de especialidades de EditarNegocioModal
// (ver src/especialidades.js) — así un chip siempre puede coincidir con la
// especialidad marcada por algún negocio.
const FILTER_CHIPS = ESPECIALIDADES

// Propuestas de valor de la portada: en vez de contadores (negocios
// registrados, etc.) que con pocos datos de prueba comunican lo contrario de
// lo que buscan — "1 barbería registrada" no inspira confianza — estas
// frases son ciertas sin importar cuántos negocios haya en la plataforma.
const PROPUESTAS_VALOR = [
  { icono: 'tag', titulo: 'Precios reales', detalle: 'Sin sorpresas al llegar' },
  { icono: 'calendar', titulo: 'Reserva en minutos', detalle: 'Desde el portafolio' },
  { icono: 'star', titulo: 'Reseñas verificadas', detalle: 'De clientes que ya fueron' },
]

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

function formatCompacto(precio) {
  if (precio == null) return null
  if (precio >= 1000) return `$${Math.round(precio / 1000)}k`
  return COP.format(precio)
}

const ESTADO_APERTURA = {
  abierto: { label: 'Abierto', bg: 'var(--sage-soft)', text: 'var(--sage-text)' },
  'cierra-pronto': { label: 'Cierra pronto', bg: 'var(--warning-soft)', text: 'var(--warning-text)' },
  cerrado: { label: 'Cerrado', bg: 'var(--surface-2)', text: 'var(--text-faint)' },
}

function inicialesDe(nombre) {
  if (!nombre) return '?'
  const partes = nombre.trim().split(/\s+/)
  return partes.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}

// Domingo y festivos se guardan por separado, cada uno con su propio
// interruptor de "hay servicio" (ver EditarNegocioModal.jsx). Los negocios
// creados antes de este cambio solo tienen "domingoFestivos": se usa como
// respaldo.
function bloqueDomingo(horarios) {
  const bloque = horarios.domingo || horarios.domingoFestivos
  if (!bloque || bloque.activo === false) return null
  return bloque
}

function estadoApertura(horarios) {
  if (!horarios) return null
  const ahora = new Date()
  const dia = ahora.getDay() // 0 = domingo … 6 = sábado
  const bloque = dia === 0 ? bloqueDomingo(horarios) : dia === 6 ? horarios.sabado : horarios.lunesAViernes
  if (!bloque?.apertura || !bloque?.cierre) return null

  const [hA, mA] = bloque.apertura.split(':').map(Number)
  const [hC, mC] = bloque.cierre.split(':').map(Number)
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const minutosApertura = hA * 60 + mA
  const minutosCierre = hC * 60 + mC

  if (minutosAhora < minutosApertura || minutosAhora >= minutosCierre) return 'cerrado'
  if (minutosCierre - minutosAhora <= 60) return 'cierra-pronto'
  return 'abierto'
}

export default function ClientHome() {
  const { currentUser, role, logout } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [negocios, setNegocios] = useState([])
  const [ratings, setRatings] = useState({}) // negocioId -> { suma, total }
  const [serviciosPorNegocio, setServiciosPorNegocio] = useState({}) // negocioId -> [{ nombre, precio, visible }]
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [terminoActivo, setTerminoActivo] = useState('')
  const [chipsActivos, setChipsActivos] = useState(() => new Set())
  const [presupuesto, setPresupuesto] = useState('')

  // Ubicación del cliente para el componente de cercanía del recomendador:
  // nunca se pide sola al cargar la página (RNF de privacidad), solo si el
  // cliente toca "Usar mi ubicación".
  const [ubicacionCliente, setUbicacionCliente] = useState(null)
  const [ubicacionEstado, setUbicacionEstado] = useState('inactiva') // inactiva | cargando | activa | error

  // Señales de historial (RF-09): solo existen si hay un cliente con sesión.
  const [favoritosCliente, setFavoritosCliente] = useState([])
  const [resenasCliente, setResenasCliente] = useState([])
  const [citasCliente, setCitasCliente] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'negocios'), (snap) => {
      setNegocios(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, 'resenas'), (snap) => {
      const acc = {}
      snap.docs.forEach((d) => {
        const negocioId = d.ref.parent.parent.id
        const calificacion = d.data().calificacion || 0
        if (!acc[negocioId]) acc[negocioId] = { suma: 0, total: 0 }
        acc[negocioId].suma += calificacion
        acc[negocioId].total += 1
      })
      setRatings(acc)
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, 'servicios'), (snap) => {
      const acc = {}
      snap.docs.forEach((d) => {
        const negocioId = d.ref.parent.parent.id
        if (!acc[negocioId]) acc[negocioId] = []
        acc[negocioId].push({ id: d.id, ...d.data() })
      })
      setServiciosPorNegocio(acc)
    })
    return unsub
  }, [])

  // Favoritos y reseñas propias del cliente (si hay sesión de cliente): la
  // única fuente de "historial" que usa el recomendador, ver src/recomendador.js.
  useEffect(() => {
    if (!currentUser?.uid || role !== 'cliente') {
      setFavoritosCliente([])
      setResenasCliente([])
      setCitasCliente([])
      return
    }
    const unsubs = [
      onSnapshot(collection(db, 'usuarios', currentUser.uid, 'favoritos'), (snap) => {
        setFavoritosCliente(snap.docs.map((d) => ({ negocioId: d.id, ...d.data() })))
      }),
      onSnapshot(
        query(collectionGroup(db, 'resenas'), where('clienteId', '==', currentUser.uid)),
        (snap) => {
          setResenasCliente(snap.docs.map((d) => ({ negocioId: d.ref.parent.parent.id, ...d.data() })))
        }
      ),
      // Haber completado una cita es una señal de historial más (RF-09):
      // volver donde ya te atendieron antes vale casi tanto como marcar ♥.
      onSnapshot(query(collection(db, 'citas'), where('clienteId', '==', currentUser.uid)), (snap) => {
        setCitasCliente(snap.docs.map((d) => d.data()))
      }),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [currentUser?.uid, role])

  function solicitarUbicacion() {
    if (!navigator.geolocation) {
      setUbicacionEstado('error')
      return
    }
    setUbicacionEstado('cargando')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacionCliente({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setUbicacionEstado('activa')
      },
      () => setUbicacionEstado('error'),
      { timeout: 8000 }
    )
  }

  const negociosConDatos = useMemo(
    () => negocios.map((n) => {
      const r = ratings[n.id]
      const servicios = serviciosPorNegocio[n.id] || []
      const preciosVisibles = servicios.filter((s) => s.visible !== false).map((s) => s.precio || 0)
      return {
        ...n,
        servicios,
        ratingProm: r && r.total > 0 ? r.suma / r.total : null,
        ratingCount: r?.total || 0,
        precioDesde: preciosVisibles.length ? Math.min(...preciosVisibles) : null,
        estado: estadoApertura(n.horarios),
      }
    }),
    [negocios, ratings, serviciosPorNegocio]
  )

  // Mapa real de Google (RF-06). Usa negocio.ubicacion (lat/lng) cuando ya
  // fue geocodificada al registrar el negocio (ver RegisterBusiness.jsx); si
  // un negocio antiguo no la tiene, geocodifica su dirección al vuelo aquí
  // mismo (sin persistirla — solo el propio dueño puede escribir su
  // documento, ver firestore.rules).
  const mapDivRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    let cancelado = false

    loadGoogleMaps()
      .then((maps) => {
        if (cancelado || !mapDivRef.current) return

        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapDivRef.current, {
            center: { lat: 4.711, lng: -74.0721 }, // Bogotá — se ajusta con fitBounds al ubicar los negocios
            zoom: 12,
            disableDefaultUI: true,
            zoomControl: true,
          })
        }

        markersRef.current.forEach((m) => m.setMap(null))
        markersRef.current = []

        const bounds = new maps.LatLngBounds()

        negociosConDatos.forEach(async (n) => {
          let posicion = n.ubicacion
          if (!posicion) {
            if (!n.direccion) return
            try {
              posicion = await geocodeDireccion(n.direccion)
            } catch {
              return
            }
          }
          if (cancelado || !mapRef.current) return

          const precio = formatCompacto(n.precioDesde)
          const marker = new maps.Marker({
            map: mapRef.current,
            position: posicion,
            title: precio ? `${n.nombre} · ${precio}` : n.nombre,
          })
          marker.addListener('click', () => navigate(`/negocio/${n.id}`))
          markersRef.current.push(marker)

          bounds.extend(posicion)
          mapRef.current.fitBounds(bounds, 60)
        })
      })
      .catch((err) => {
        setMapError(true)
        // eslint-disable-next-line no-console
        console.error(err)
      })

    return () => { cancelado = true }
  }, [negociosConDatos, navigate])

  const consulta = useMemo(() => {
    const servicios = [...chipsActivos]
    if (terminoActivo) servicios.push(terminoActivo)
    const presupuestoNum = Number(presupuesto)
    return {
      servicios: servicios.length ? servicios : undefined,
      presupuesto: presupuestoNum > 0 ? presupuestoNum : undefined,
      ubicacion: ubicacionCliente || undefined,
    }
  }, [chipsActivos, terminoActivo, presupuesto, ubicacionCliente])

  const hayFiltrosActivos = Boolean(consulta.servicios || consulta.presupuesto || consulta.ubicacion)

  // RF-09: orden y filtrado reales (no solo texto) vía src/recomendador.js.
  // Sin filtros, igual personaliza con historial + calificación bayesiana.
  const recomendaciones = useMemo(
    () => recomendar(negociosConDatos, consulta, {
      favoritos: favoritosCliente,
      resenas: resenasCliente,
      citas: citasCliente,
    }),
    [negociosConDatos, consulta, favoritosCliente, resenasCliente, citasCliente]
  )

  const destacado = recomendaciones[0] || null

  function handleBuscar(e) {
    e.preventDefault()
    setTerminoActivo(busqueda.trim())
  }

  function handleChip(chip) {
    setChipsActivos((prev) => {
      const next = new Set(prev)
      if (next.has(chip)) next.delete(chip)
      else next.add(chip)
      return next
    })
  }

  function limpiarFiltros() {
    setBusqueda('')
    setTerminoActivo('')
    setChipsActivos(new Set())
    setPresupuesto('')
    setUbicacionCliente(null)
    setUbicacionEstado('inactiva')
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div>
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '14px 16px' : '14px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 18, fontWeight: 800 }}>
            <span
              style={{
                width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
              }}
            >
              MB
            </span>
            <span>
              <span style={{ color: 'var(--text)' }}>Mini</span><span style={{ color: 'var(--accent)' }}>Barrio</span>
            </span>
          </Link>
          {!isMobile && (
            <nav style={{ display: 'flex', gap: 20, fontSize: 13.5, fontWeight: 700 }}>
              <a href="#resultados" style={{ color: 'var(--text-muted)' }}>Explorar</a>
              <span style={{ color: 'var(--text-faint)', cursor: 'not-allowed' }} title="Próximamente">Cómo funciona</span>
              <span style={{ color: 'var(--text-faint)', cursor: 'not-allowed' }} title="Por ahora solo barberías y estética">Categorías</span>
              <Link to="/registro/negocio" style={{ color: 'var(--text-muted)' }}>Para negocios</Link>
            </nav>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {!isMobile && (
            <span
              style={{
                fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-2)',
                padding: '7px 12px', borderRadius: 999,
              }}
            >
              Britalia, Kennedy
            </span>
          )}
          {currentUser ? (
            <>
              {role === 'propietario' && (
                <Link to="/panel" className="btn btn-outline" style={{ padding: '8px 14px', fontSize: 13 }}>
                  Ir a mi panel
                </Link>
              )}
              {role === 'cliente' ? (
                <Link
                  to="/perfil"
                  title="Mi perfil"
                  style={{
                    width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                  }}
                >
                  {inicialesDe(currentUser.displayName)}
                </Link>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {currentUser.displayName}
                </span>
              )}
              <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '8px 14px', fontSize: 13 }}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Iniciar sesión</Link>
              <Link to="/registro/negocio" className="btn btn-primary" style={{ padding: '9px 16px', fontSize: 13.5 }}>
                Registra tu negocio
              </Link>
            </>
          )}
        </div>
      </header>

      <section style={{ background: 'var(--surface-2)', padding: isMobile ? '28px 16px' : '48px 32px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 24 : 40, alignItems: 'start' }}>
          <div>
            <span
              style={{
                display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, color: 'var(--sage-text)',
                background: 'var(--sage-soft)', padding: '6px 12px', borderRadius: 999,
              }}
            >
              PROTOTIPO · BRITALIA, KENNEDY
            </span>
            <h1 style={{ fontSize: isMobile ? 26 : 34, fontWeight: 800, lineHeight: 1.15, marginTop: 16 }}>
              La vitrina digital de los microcomercios de tu barrio
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginTop: 12, lineHeight: 1.6 }}>
              Compara precios, mira el portafolio real de cada negocio y revisa la disponibilidad
              de los servicios de cada barbería registrada.
            </p>

            <form
              onSubmit={handleBuscar}
              className="card"
              style={{ marginTop: 22, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
            >
              <div style={{ flex: '1 1 160px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Servicio</label>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Corte fade"
                  style={{ marginTop: 4, border: 'none', padding: '6px 0', fontSize: 14 }}
                />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Ubicación</label>
                <button
                  type="button"
                  onClick={solicitarUbicacion}
                  disabled={ubicacionEstado === 'cargando'}
                  title={ubicacionEstado === 'error' ? 'No pudimos acceder a tu ubicación' : undefined}
                  style={{
                    display: 'block', width: '100%', marginTop: 4, border: 'none', background: 'transparent',
                    padding: '6px 0', fontSize: 14, fontWeight: ubicacionCliente ? 700 : 400,
                    color: ubicacionEstado === 'error' ? 'var(--danger)' : ubicacionCliente ? 'var(--sage-text)' : 'var(--text-muted)',
                    textAlign: 'left', cursor: ubicacionEstado === 'cargando' ? 'default' : 'pointer',
                  }}
                >
                  {ubicacionEstado === 'cargando' && (
                    <span className="dots-cargando" aria-label="Ubicando…">
                      <span /><span /><span />
                    </span>
                  )}
                  {ubicacionEstado === 'error' && 'Ubicación no disponible'}
                  {ubicacionEstado === 'activa' && '● Cerca de ti'}
                  {ubicacionEstado === 'inactiva' && 'Usar mi ubicación'}
                </button>
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Presupuesto</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  inputMode="numeric"
                  value={presupuesto}
                  onChange={(e) => setPresupuesto(e.target.value)}
                  placeholder="Cualquier precio"
                  style={{ marginTop: 4, border: 'none', padding: '6px 0', fontSize: 14, width: '100%' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="search" size={15} /> Buscar
              </button>
            </form>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {FILTER_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChip(chip)}
                  style={{
                    fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999,
                    border: `1px solid ${chipsActivos.has(chip) ? 'var(--accent)' : 'var(--border-strong)'}`,
                    background: chipsActivos.has(chip) ? 'var(--accent-soft)' : 'var(--surface)',
                    color: chipsActivos.has(chip) ? 'var(--accent-hover)' : 'var(--text-muted)',
                  }}
                >
                  {chip}
                </button>
              ))}
              {hayFiltrosActivos && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 10px', color: 'var(--text-faint)', background: 'none', border: 'none' }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          <div>
            <div
              style={{
                position: 'relative', height: isMobile ? 220 : 300, borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                background: 'var(--map-gradient)',
                border: '1px solid var(--border)',
              }}
            >
              <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

              {mapError && (
                <div
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '0 30px',
                  }}
                >
                  No se pudo cargar el mapa en este momento.
                </div>
              )}

              {!mapError && negociosConDatos.length === 0 && !loading && (
                <div
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '0 30px',
                  }}
                >
                  Aún no hay negocios registrados para mostrar en el mapa.
                </div>
              )}
            </div>

            {destacado && (
              <div className="card" style={{ marginTop: isMobile ? -28 : -40, marginLeft: isMobile ? 8 : 16, marginRight: isMobile ? 8 : 16, position: 'relative', padding: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: 46, height: 46, borderRadius: 10, background: 'var(--surface-2)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5 }}>{destacado.nombre}</span>
                    {destacado.estado && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: ESTADO_APERTURA[destacado.estado].text }}>
                        ● {ESTADO_APERTURA[destacado.estado].label}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {destacado.ratingProm ? (
                      <>★ {destacado.ratingProm.toFixed(1)} ({destacado.ratingCount}) · </>
                    ) : (
                      'Sin reseñas aún · '
                    )}
                    {destacado.direccion}
                  </div>
                  {destacado.razones[0] && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginTop: 3 }}>
                      {destacado.razones[0]}
                    </div>
                  )}
                </div>
                <Link
                  to={`/negocio/${destacado.id}`}
                  className="btn btn-primary"
                  style={{ fontSize: 12.5, padding: '8px 12px' }}
                >
                  Ver portafolio
                </Link>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            maxWidth: 1160, margin: `${isMobile ? 24 : 36}px auto 0`, paddingTop: isMobile ? 20 : 26,
            borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap',
            gap: isMobile ? 20 : 28, justifyContent: isMobile ? 'flex-start' : 'space-between',
          }}
        >
          {PROPUESTAS_VALOR.map((v) => (
            <div key={v.titulo} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: '1 1 180px', maxWidth: 280 }}>
              <span
                style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: 'var(--accent-soft)', color: 'var(--accent-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name={v.icono} size={17} />
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.25 }}>{v.titulo}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 1 }}>{v.detalle}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="resultados" style={{ maxWidth: 1160, margin: '0 auto', padding: isMobile ? '28px 16px' : '40px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {hayFiltrosActivos ? 'Resultados de tu búsqueda' : 'Recomendado para ti'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {hayFiltrosActivos
                ? `${recomendaciones.length} negocio${recomendaciones.length === 1 ? '' : 's'} encontrado${recomendaciones.length === 1 ? '' : 's'}`
                : 'Barberías registradas en Britalia, Kennedy.'}
            </div>
          </div>
          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={limpiarFiltros}
              style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none' }}
            >
              Limpiar búsqueda
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', marginTop: 24 }}>Cargando negocios…</p>
        ) : recomendaciones.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', marginTop: 24 }}>
            {hayFiltrosActivos ? 'No encontramos negocios que coincidan con tu búsqueda.' : 'Aún no hay negocios registrados en MiniBarrio.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 20 }}>
            {recomendaciones.map((n) => (
              <Link key={n.id} to={`/negocio/${n.id}`} className="card" style={{ overflow: 'hidden', display: 'block', color: 'inherit' }}>
                <div style={{ height: 110, background: 'var(--surface-2)' }} />
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{n.nombre}</div>
                    {n.ratingProm && (
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>★ {n.ratingProm.toFixed(1)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{n.descripcion || n.categoria}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>{n.direccion}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {n.precioDesde != null ? `Desde ${COP.format(n.precioDesde)}` : 'Consulta precios'}
                    </span>
                    {n.estado && (
                      <span
                        style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                          background: ESTADO_APERTURA[n.estado].bg, color: ESTADO_APERTURA[n.estado].text,
                        }}
                      >
                        {ESTADO_APERTURA[n.estado].label}
                      </span>
                    )}
                  </div>
                  {n.razones.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
                      {n.razones.slice(0, 2).map((razon) => (
                        <span
                          key={razon}
                          style={{
                            fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                            background: 'var(--accent-soft)', color: 'var(--accent-hover)',
                          }}
                        >
                          {razon}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const ICON_PATHS = {
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  tag: 'M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3ZM6 6h.008v.008H6V6Z',
  calendar: 'M5 8h14v12H5zM5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2M7 3v4M17 3v4M5 12h14',
  star: 'M12 2.5l2.9 6.3 6.6.7-5 4.6 1.4 6.6L12 17.6 6.1 20.7l1.4-6.6-5-4.6 6.6-.7z',
}

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}
