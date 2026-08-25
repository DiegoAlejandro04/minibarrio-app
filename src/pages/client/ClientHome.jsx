import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, collectionGroup, getDocs, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'

// Vitrina pública de negocios (RF-05 búsqueda, RF-06 mapa, RF-09
// recomendaciones, RF-12 portafolio visible sin sesión). Muestra datos
// reales de Firestore; el mapa es una representación esquemática (no hay
// geocodificación en el modelo de datos todavía, ver docs/MODELO_DATOS.md),
// y el filtrado por servicio/precio es una búsqueda simple por nombre y
// descripción hasta que exista un motor de recomendación real (Sprint 2).

const FILTER_CHIPS = ['Corte fade', 'Barba', 'Cejas', 'Color', 'Niños', 'Clásico', 'Domicilio']

const PIN_POSITIONS = [
  { top: '28%', left: '38%' },
  { top: '18%', left: '68%' },
  { top: '46%', left: '78%' },
  { top: '58%', left: '30%' },
  { top: '72%', left: '58%' },
  { top: '12%', left: '18%' },
]

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

function formatCompacto(precio) {
  if (precio == null) return null
  if (precio >= 1000) return `$${Math.round(precio / 1000)}k`
  return COP.format(precio)
}

const ESTADO_APERTURA = {
  abierto: { label: 'Abierto', bg: 'var(--sage-soft)', text: 'var(--sage-text)' },
  'cierra-pronto': { label: 'Cierra pronto', bg: 'var(--warning-soft)', text: 'oklch(45% 0.11 75)' },
  cerrado: { label: 'Cerrado', bg: 'var(--surface-2)', text: 'var(--text-faint)' },
}

function estadoApertura(horarios) {
  if (!horarios) return null
  const ahora = new Date()
  const dia = ahora.getDay() // 0 = domingo … 6 = sábado
  const bloque = dia === 0 ? horarios.domingoFestivos : dia === 6 ? horarios.sabado : horarios.lunesAViernes
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

  const [negocios, setNegocios] = useState([])
  const [ratings, setRatings] = useState({}) // negocioId -> { suma, total }
  const [preciosMin, setPreciosMin] = useState({}) // negocioId -> precio
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [terminoActivo, setTerminoActivo] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'negocios'), (snap) => {
      setNegocios(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    getDocs(collectionGroup(db, 'resenas')).then((snap) => {
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
  }, [])

  useEffect(() => {
    getDocs(collectionGroup(db, 'servicios')).then((snap) => {
      const acc = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        if (data.visible === false) return
        const negocioId = d.ref.parent.parent.id
        const precio = data.precio || 0
        if (acc[negocioId] == null || precio < acc[negocioId]) acc[negocioId] = precio
      })
      setPreciosMin(acc)
    })
  }, [])

  const negociosConDatos = useMemo(
    () => negocios.map((n) => {
      const r = ratings[n.id]
      return {
        ...n,
        ratingProm: r && r.total > 0 ? r.suma / r.total : null,
        ratingCount: r?.total || 0,
        precioDesde: preciosMin[n.id] ?? null,
        estado: estadoApertura(n.horarios),
      }
    }),
    [negocios, ratings, preciosMin]
  )

  const resultados = useMemo(() => {
    if (!terminoActivo) return negociosConDatos
    const q = terminoActivo.toLowerCase()
    return negociosConDatos.filter(
      (n) => n.nombre?.toLowerCase().includes(q) || n.descripcion?.toLowerCase().includes(q)
    )
  }, [negociosConDatos, terminoActivo])

  const destacado = useMemo(() => {
    if (negociosConDatos.length === 0) return null
    return [...negociosConDatos].sort((a, b) => (b.ratingProm || 0) - (a.ratingProm || 0))[0]
  }, [negociosConDatos])

  const calificacionGeneral = useMemo(() => {
    const vals = Object.values(ratings).filter((r) => r.total > 0)
    if (vals.length === 0) return null
    return vals.reduce((s, r) => s + r.suma / r.total, 0) / vals.length
  }, [ratings])

  function handleBuscar(e) {
    e.preventDefault()
    setTerminoActivo(busqueda.trim())
  }

  function handleChip(chip) {
    setBusqueda(chip)
    setTerminoActivo(chip)
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
          padding: '14px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12,
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
          <nav style={{ display: 'flex', gap: 20, fontSize: 13.5, fontWeight: 700 }}>
            <a href="#resultados" style={{ color: 'var(--text-muted)' }}>Explorar</a>
            <span style={{ color: 'var(--text-faint)', cursor: 'not-allowed' }} title="Próximamente">Cómo funciona</span>
            <span style={{ color: 'var(--text-faint)', cursor: 'not-allowed' }} title="Por ahora solo barberías y estética">Categorías</span>
            <Link to="/registro/negocio" style={{ color: 'var(--text-muted)' }}>Para negocios</Link>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-2)',
              padding: '7px 12px', borderRadius: 999,
            }}
          >
            Britalia, Kennedy
          </span>
          {currentUser ? (
            <>
              {role === 'propietario' && (
                <Link to="/panel" className="btn btn-outline" style={{ padding: '8px 14px', fontSize: 13 }}>
                  Ir a mi panel
                </Link>
              )}
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                {currentUser.displayName}
              </span>
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

      <section style={{ background: 'var(--surface-2)', padding: '48px 32px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
          <div>
            <span
              style={{
                display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, color: 'var(--sage-text)',
                background: 'var(--sage-soft)', padding: '6px 12px', borderRadius: 999,
              }}
            >
              PROTOTIPO · BRITALIA, KENNEDY
            </span>
            <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, marginTop: 16 }}>
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
              <div style={{ flex: '1 1 140px', opacity: 0.55 }} title="Por ahora el prototipo cubre solo Britalia, Kennedy">
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Ubicación</label>
                <input disabled value="A menos de 1 km" style={{ marginTop: 4, border: 'none', padding: '6px 0', fontSize: 14, background: 'transparent' }} />
              </div>
              <div style={{ flex: '1 1 140px', opacity: 0.55 }} title="Filtro de precio: próximamente">
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Precio</label>
                <input disabled value="Cualquier precio" style={{ marginTop: 4, border: 'none', padding: '6px 0', fontSize: 14, background: 'transparent' }} />
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
                    border: `1px solid ${terminoActivo === chip ? 'var(--accent)' : 'var(--border-strong)'}`,
                    background: terminoActivo === chip ? 'var(--accent-soft)' : 'var(--surface)',
                    color: terminoActivo === chip ? 'var(--accent-hover)' : 'var(--text-muted)',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 36, marginTop: 30 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{negocios.length}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>barberías registradas</div>
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{calificacionGeneral === null ? '—' : calificacionGeneral.toFixed(1)}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>calificación promedio</div>
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{'< 3 s'}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>carga del portafolio</div>
              </div>
            </div>
          </div>

          <div>
            <div
              style={{
                position: 'relative', height: 300, borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                background: 'linear-gradient(135deg, oklch(93% 0.02 165), oklch(96% 0.012 80))',
                border: '1px solid var(--border)',
              }}
            >
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
                <line x1="0" y1="40%" x2="100%" y2="40%" stroke="white" strokeWidth="6" />
                <line x1="55%" y1="0" x2="55%" y2="100%" stroke="white" strokeWidth="6" />
              </svg>

              {negociosConDatos.slice(0, PIN_POSITIONS.length).map((n, i) => (
                <div
                  key={n.id}
                  title={n.nombre}
                  style={{
                    position: 'absolute', top: PIN_POSITIONS[i].top, left: PIN_POSITIONS[i].left, transform: 'translate(-50%, -100%)',
                    background: 'var(--ink)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 9px',
                    borderRadius: 999, whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {formatCompacto(n.precioDesde) || n.nombre.slice(0, 12)}
                </div>
              ))}

              {negociosConDatos.length === 0 && !loading && (
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
              <div className="card" style={{ marginTop: -40, marginLeft: 16, marginRight: 16, position: 'relative', padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
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
      </section>

      <section id="resultados" style={{ maxWidth: 1160, margin: '0 auto', padding: '40px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {terminoActivo ? `Resultados para "${terminoActivo}"` : 'Recomendado para ti'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {terminoActivo ? `${resultados.length} negocio${resultados.length === 1 ? '' : 's'} encontrado${resultados.length === 1 ? '' : 's'}` : 'Barberías registradas en Britalia, Kennedy.'}
            </div>
          </div>
          {terminoActivo && (
            <button
              type="button"
              onClick={() => { setBusqueda(''); setTerminoActivo('') }}
              style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none' }}
            >
              Limpiar búsqueda
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', marginTop: 24 }}>Cargando negocios…</p>
        ) : resultados.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', marginTop: 24 }}>
            {terminoActivo ? 'No encontramos negocios que coincidan con tu búsqueda.' : 'Aún no hay negocios registrados en MiniBarrio.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 20 }}>
            {resultados.map((n) => (
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
}

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}
