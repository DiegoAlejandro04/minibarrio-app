import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import Icon from '../../components/Icon.jsx'

// Panel del comerciante — vista "Resumen" (RF-02, RF-07). Conectado a datos
// reales del negocio vía onSnapshot (tiempo real).

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

export default function OwnerResumen() {
  const { negocio, servicios, uid } = useOutletContext()

  const [citas, setCitas] = useState([])
  const [resenas, setResenas] = useState([])
  const [visitas, setVisitas] = useState(0)
  const [clientes, setClientes] = useState({}) // uid -> nombre

  useEffect(() => {
    if (!uid) return
    const unsubs = [
      onSnapshot(collection(db, 'negocios', uid, 'resenas'), (snap) => {
        setResenas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
      onSnapshot(collection(db, 'negocios', uid, 'visitas'), (snap) => {
        setVisitas(snap.size)
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

  const fechaLarga = capitalize(FECHA_LARGA.format(ahora))

  return (
    <div>
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
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <StatTile
          icon="eye"
          label="Visitas al perfil"
          value={visitas.toLocaleString('es-CO')}
          sub={visitas === 0 ? 'Aún sin visitas' : 'Clientes únicos que vieron tu perfil'}
        />
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
            Aún no has publicado servicios. Agrégalos desde &ldquo;Servicios&rdquo; en el menú.
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
    </div>
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
