import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'

// Panel del comerciante — vista "Resumen" (RF-02, RF-07). Conectado a datos
// reales del negocio vía onSnapshot (tiempo real). El resto de la navegación
// (Agenda, Servicios, Portafolio, Reseñas, Clientes, Configuración) todavía
// no tiene páginas propias — se muestra pero no navega, ver docs del canvas
// de mockups para el diseño completo de esas secciones.

const NAV_ITEMS = [
  { key: 'resumen', label: 'Resumen', icon: 'grid' },
  { key: 'agenda', label: 'Agenda', icon: 'calendar' },
  { key: 'servicios', label: 'Servicios', icon: 'scissors' },
  { key: 'portafolio', label: 'Portafolio', icon: 'image' },
  { key: 'resenas', label: 'Reseñas', icon: 'star' },
  { key: 'clientes', label: 'Clientes', icon: 'users' },
  { key: 'configuracion', label: 'Configuración', icon: 'gear' },
]

const ESTADO_STYLES = {
  confirmada: { bg: 'var(--sage-soft)', text: 'var(--sage-text)', label: 'Confirmada' },
  pendiente: { bg: 'var(--warning-soft)', text: 'oklch(45% 0.11 75)', label: 'Pendiente' },
  cancelada: { bg: 'oklch(93% 0.035 25)', text: 'var(--danger)', label: 'Cancelada' },
  completada: { bg: 'var(--surface-2)', text: 'var(--text-muted)', label: 'Completada' },
}

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function startOfWeek(date) {
  const d = new Date(date)
  const dia = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - dia)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export default function OwnerDashboard() {
  const { currentUser } = useAuth()
  const uid = currentUser?.uid

  const [negocio, setNegocio] = useState(null)
  const [servicios, setServicios] = useState([])
  const [citas, setCitas] = useState([])
  const [resenas, setResenas] = useState([])
  const [clientes, setClientes] = useState({}) // uid -> nombre
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    const unsubs = [
      onSnapshot(doc(db, 'negocios', uid), (snap) => {
        setNegocio(snap.exists() ? snap.data() : null)
        setLoading(false)
      }),
      onSnapshot(collection(db, 'negocios', uid, 'servicios'), (snap) => {
        setServicios(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
      onSnapshot(collection(db, 'negocios', uid, 'resenas'), (snap) => {
        setResenas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
      onSnapshot(query(collection(db, 'citas'), where('negocioId', '==', uid)), (snap) => {
        setCitas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [uid])

  // Resuelve el nombre de cada cliente que aparece en las citas (join simple
  // contra "usuarios", ya que "citas" solo guarda clienteId por diseño).
  useEffect(() => {
    const faltantes = [...new Set(citas.map((c) => c.clienteId))].filter((id) => id && !(id in clientes))
    if (faltantes.length === 0) return
    faltantes.forEach(async (clienteId) => {
      const snap = await getDoc(doc(db, 'usuarios', clienteId))
      setClientes((prev) => ({ ...prev, [clienteId]: snap.exists() ? snap.data().nombre : 'Cliente' }))
    })
  }, [citas, clientes])

  const ahora = useMemo(() => new Date(), [])
  const inicioSemana = useMemo(() => startOfWeek(ahora), [ahora])

  const citasConFecha = useMemo(
    () => citas.map((c) => ({ ...c, fecha: c.fechaHora?.toDate ? c.fechaHora.toDate() : null })),
    [citas]
  )

  const citasHoy = useMemo(
    () => citasConFecha.filter((c) => c.fecha && isSameDay(c.fecha, ahora)).sort((a, b) => a.fecha - b.fecha),
    [citasConFecha, ahora]
  )

  const citasEstaSemana = useMemo(
    () => citasConFecha.filter((c) => c.fecha && c.fecha >= inicioSemana).length,
    [citasConFecha, inicioSemana]
  )

  const serviciosPorId = useMemo(() => Object.fromEntries(servicios.map((s) => [s.id, s])), [servicios])

  const ingresosSemana = useMemo(
    () => citasConFecha
      .filter((c) => c.estado === 'completada' && c.fecha && c.fecha >= inicioSemana)
      .reduce((sum, c) => sum + (serviciosPorId[c.servicioId]?.precio || 0), 0),
    [citasConFecha, inicioSemana, serviciosPorId]
  )

  const calificacionPromedio = useMemo(() => {
    if (resenas.length === 0) return null
    return resenas.reduce((sum, r) => sum + (r.calificacion || 0), 0) / resenas.length
  }, [resenas])

  const resenasNuevas = useMemo(
    () => resenas.filter((r) => r.creadoEn?.toDate && r.creadoEn.toDate() >= inicioSemana).length,
    [resenas, inicioSemana]
  )

  const reservasPorServicio = useMemo(() => {
    const conteo = {}
    citasConFecha.forEach((c) => {
      if (c.fecha && isSameMonth(c.fecha, ahora) && c.servicioId) {
        conteo[c.servicioId] = (conteo[c.servicioId] || 0) + 1
      }
    })
    return conteo
  }, [citasConFecha, ahora])

  const perfilCompletado = useMemo(() => {
    if (!negocio) return 0
    const checks = [
      !!negocio.nombre,
      !!negocio.descripcion,
      !!negocio.direccion,
      !!negocio.canalesContacto?.whatsapp,
      (negocio.fotos || []).length > 0,
      servicios.length > 0,
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [negocio, servicios])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Cargando panel…
      </div>
    )
  }

  if (!negocio) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Panel del comerciante</div>
        <p style={{ color: 'var(--text-muted)' }}>No se encontró el negocio asociado a esta cuenta.</p>
      </div>
    )
  }

  const fechaLarga = capitalize(FECHA_LARGA.format(ahora))

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar perfilCompletado={perfilCompletado} />

      <main style={{ flex: 1, background: 'var(--bg)', padding: '28px 36px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>Hola, {negocio.nombre}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>
              {fechaLarga} ·{' '}
              {citasHoy.length === 0
                ? 'sin citas programadas para hoy'
                : `${citasHoy.length} cita${citasHoy.length === 1 ? '' : 's'} programada${citasHoy.length === 1 ? '' : 's'} para hoy`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              title="Aún no hay notificaciones"
              style={{
                width: 38, height: 38, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
              }}
            >
              <Icon name="bell" size={16} />
            </span>
            <button
              className="btn btn-primary"
              disabled
              title="Próximamente: gestión de servicios"
              style={{ opacity: 0.55, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Icon name="plus" size={15} /> Nuevo servicio
            </button>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
          <StatTile icon="eye" label="Visitas al perfil" value={(negocio.visitas || 0).toLocaleString('es-CO')} sub="Aún sin datos de tráfico" />
          <StatTile icon="calendar" label="Citas agendadas" value={citas.length.toLocaleString('es-CO')} sub={`${citasEstaSemana} esta semana`} />
          <StatTile
            icon="star"
            label="Calificación"
            value={calificacionPromedio === null ? '—' : calificacionPromedio.toFixed(1)}
            sub={resenas.length === 0 ? 'Sin reseñas aún' : `${resenasNuevas} reseña${resenasNuevas === 1 ? '' : 's'} nueva${resenasNuevas === 1 ? '' : 's'}`}
          />
          <StatTile icon="trending" label="Ingresos estimados" value={COP.format(ingresosSemana)} sub="Semana en curso" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginTop: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Visitas al portafolio</div>
            <div style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 2 }}>
              Aún no hay datos de tráfico para mostrar.
            </div>
            <div
              style={{
                marginTop: 20, height: 140, borderRadius: 'var(--radius-md)', background: 'var(--surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '0 20px',
              }}
            >
              Comparte tu perfil para empezar a recibir visitas
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Citas de hoy</div>
            {citasHoy.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>No tienes citas programadas para hoy.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {citasHoy.map((c) => {
                  const estilo = ESTADO_STYLES[c.estado] || ESTADO_STYLES.pendiente
                  return (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--text-faint)', width: 64, flexShrink: 0 }}>
                          {HORA.format(c.fecha)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{clientes[c.clienteId] || 'Cliente'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{serviciosPorId[c.servicioId]?.nombre || 'Servicio'}</div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                          background: estilo.bg, color: estilo.text, whiteSpace: 'nowrap',
                        }}
                      >
                        {estilo.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16, padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Servicios publicados</div>
          {servicios.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
              Aún no has publicado servicios. Podrás agregarlos próximamente desde &ldquo;Servicios&rdquo; en el menú.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-faint)', fontSize: 11.5, textTransform: 'uppercase' }}>
                    <th style={{ paddingBottom: 10, fontWeight: 700 }}>Servicio</th>
                    <th style={{ paddingBottom: 10, fontWeight: 700 }}>Duración</th>
                    <th style={{ paddingBottom: 10, fontWeight: 700 }}>Precio</th>
                    <th style={{ paddingBottom: 10, fontWeight: 700 }}>Reservas (mes)</th>
                    <th style={{ paddingBottom: 10, fontWeight: 700 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {servicios.map((s) => (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 0', fontWeight: 700 }}>{s.nombre}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{s.duracionMinutos} min</td>
                      <td style={{ color: 'var(--text-muted)' }}>{COP.format(s.precio || 0)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{reservasPorServicio[s.id] || 0}</td>
                      <td>
                        <span
                          style={{
                            fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                            background: s.visible ? 'var(--sage-soft)' : 'var(--surface-2)',
                            color: s.visible ? 'var(--sage-text)' : 'var(--text-faint)',
                          }}
                        >
                          {s.visible ? 'Visible' : 'Oculto'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Sidebar({ perfilCompletado }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      style={{
        width: 232, background: 'var(--ink)', color: 'var(--ink-text)', flexShrink: 0,
        display: 'flex', flexDirection: 'column', padding: '22px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 16.5, fontWeight: 800, padding: '0 6px' }}>
        <span
          style={{
            width: 30, height: 30, borderRadius: 9, background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
          }}
        >
          MB
        </span>
        MiniBarrio
      </div>

      <div style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: 'oklch(70% 0.02 165)', margin: '26px 6px 10px' }}>
        Panel del comerciante
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const activo = item.key === 'resumen'
          return (
            <div
              key={item.key}
              title={activo ? undefined : 'Próximamente'}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9,
                fontSize: 13.5, fontWeight: 700,
                background: activo ? 'var(--ink-2)' : 'transparent',
                color: activo ? '#fff' : 'oklch(70% 0.02 165)',
                cursor: activo ? 'default' : 'not-allowed',
              }}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </div>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'var(--ink-2)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Perfil al {perfilCompletado}%</div>
          <div style={{ height: 6, background: 'oklch(35% 0.03 165)', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${perfilCompletado}%`, background: 'var(--accent)', borderRadius: 999 }} />
          </div>
          {perfilCompletado < 100 && (
            <div style={{ fontSize: 11, color: 'oklch(70% 0.02 165)', marginTop: 8, lineHeight: 1.4 }}>
              Completa tu perfil (fotos, servicios y datos de contacto) para aparecer mejor posicionado.
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent', border: '1px solid oklch(38% 0.03 165)', color: 'oklch(85% 0.01 165)',
            display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 13, fontWeight: 700,
            borderRadius: 'var(--radius-sm)', padding: '10px 16px',
          }}
        >
          <Icon name="logout" size={15} /> Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

function StatTile({ icon, label, value, sub }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>
        <div style={{ color: 'var(--text-faint)' }}>
          <Icon name={icon} size={16} />
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

const ICON_PATHS = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  calendar: 'M5 8h14v12H5zM5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2M7 3v4M17 3v4M5 12h14',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12',
  image: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM21 15l-5.5-5.5L4 21',
  star: 'M12 2.5l2.9 6.3 6.6.7-5 4.6 1.4 6.6L12 17.6 6.1 20.7l1.4-6.6-5-4.6 6.6-.7z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15 1.65 1.65 0 0 0 3.17 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  plus: 'M12 5v14M5 12h14',
  eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  trending: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
}

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}
