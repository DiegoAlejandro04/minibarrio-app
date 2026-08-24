import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import Icon from '../../components/Icon.jsx'

// Agenda del negocio (RF-07/RF-08): calendario del mes con las citas
// agendadas por los clientes, y cambio de estado de cada cita (pendiente /
// cancelada / completada). La escritura la permite firestore.rules porque
// el propietario (uid == negocioId) ya puede actualizar cualquier cita de
// su negocio — no requiere cambios de reglas.

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
const MES_ANIO = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
const DIA_LARGO = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
// Semana con domingo primero y sábado al final; entre semana en el medio.
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
// Date.getDay() ya devuelve 0=domingo…6=sábado, que coincide con la
// posición de columna en DIAS_SEMANA — no hace falta remapear.

const ESTADO_BADGE = {
  pendiente: { label: 'Pendiente', bg: 'oklch(78% 0.15 65)', text: '#fff' },
  cancelada: { label: 'Cancelado', bg: 'oklch(60% 0.19 25)', text: '#fff' },
  completada: { label: 'Realizado', bg: 'oklch(62% 0.14 152)', text: '#fff' },
}

const OPCIONES_ESTADO = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'cancelada', label: 'Cancelado' },
  { value: 'completada', label: 'Realizado' },
]

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function OwnerAgenda() {
  const { servicios, uid } = useOutletContext()

  const [mesVisto, setMesVisto] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [citas, setCitas] = useState([])
  const [clientes, setClientes] = useState({}) // clienteId -> { nombre, correo, telefono }
  const [diaSeleccionado, setDiaSeleccionado] = useState(null) // Date | null
  const [citaAbierta, setCitaAbierta] = useState(null)
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('pendiente')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!uid) return
    const unsub = onSnapshot(query(collection(db, 'citas'), where('negocioId', '==', uid)), (snap) => {
      setCitas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [uid])

  useEffect(() => {
    const faltantes = [...new Set(citas.map((c) => c.clienteId))].filter((id) => id && !(id in clientes))
    if (faltantes.length === 0) return
    faltantes.forEach(async (clienteId) => {
      const snap = await getDoc(doc(db, 'usuarios', clienteId))
      setClientes((prev) => ({ ...prev, [clienteId]: snap.exists() ? snap.data() : { nombre: 'Cliente' } }))
    })
  }, [citas, clientes])

  const serviciosPorId = useMemo(() => Object.fromEntries(servicios.map((s) => [s.id, s])), [servicios])

  const citasConFecha = useMemo(
    () => citas
      .map((c) => ({ ...c, fecha: c.fechaHora?.toDate ? c.fechaHora.toDate() : null }))
      .filter((c) => c.fecha),
    [citas]
  )

  const citasPorDia = useMemo(() => {
    const mapa = {}
    citasConFecha.forEach((c) => {
      if (c.fecha.getFullYear() !== mesVisto.getFullYear() || c.fecha.getMonth() !== mesVisto.getMonth()) return
      const dia = c.fecha.getDate()
      if (!mapa[dia]) mapa[dia] = []
      mapa[dia].push(c)
    })
    Object.values(mapa).forEach((lista) => lista.sort((a, b) => a.fecha - b.fecha))
    return mapa
  }, [citasConFecha, mesVisto])

  const diasDelMes = useMemo(() => {
    const anio = mesVisto.getFullYear()
    const mes = mesVisto.getMonth()
    const totalDias = new Date(anio, mes + 1, 0).getDate()
    const primerDiaSemana = new Date(anio, mes, 1).getDay()
    const celdas = []
    for (let i = 0; i < primerDiaSemana; i++) celdas.push(null)
    for (let d = 1; d <= totalDias; d++) celdas.push(d)
    return celdas
  }, [mesVisto])

  const citasDelDiaSeleccionado = useMemo(() => {
    if (!diaSeleccionado) return []
    return citasPorDia[diaSeleccionado.getDate()] || []
  }, [diaSeleccionado, citasPorDia])

  function cambiarMes(delta) {
    setMesVisto((m) => {
      const d = new Date(m)
      d.setMonth(d.getMonth() + delta)
      return d
    })
    setDiaSeleccionado(null)
  }

  function abrirCita(cita) {
    setCitaAbierta(cita)
    setEstadoSeleccionado(OPCIONES_ESTADO.some((o) => o.value === cita.estado) ? cita.estado : 'pendiente')
  }

  async function confirmarEstado() {
    if (!citaAbierta) return
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'citas', citaAbierta.id), { estado: estadoSeleccionado })
      setCitaAbierta(null)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  const hoy = new Date()

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Agenda</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 20 }}>
        Revisa las citas agendadas por tus clientes y actualiza su estado.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: diaSeleccionado ? '1.3fr 1fr' : '1fr', gap: 20, alignItems: 'start' }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button type="button" onClick={() => cambiarMes(-1)} className="btn btn-outline" style={{ padding: '7px 9px' }}>
              <Icon name="chevronLeft" size={15} />
            </button>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{capitalize(MES_ANIO.format(mesVisto))}</div>
            <button type="button" onClick={() => cambiarMes(1)} className="btn btn-outline" style={{ padding: '7px 9px' }}>
              <Icon name="chevronRight" size={15} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {DIAS_SEMANA.map((d, i) => (
              <div
                key={d}
                style={{ fontSize: 11, fontWeight: 700, color: i === 0 || i === 6 ? 'oklch(68% 0.05 40)' : 'var(--text-faint)', textAlign: 'center', paddingBottom: 4 }}
              >
                {d}
              </div>
            ))}
            {diasDelMes.map((dia, idx) => {
              if (dia == null) return <div key={`vacio-${idx}`} />
              const columna = idx % 7
              const esFinDeSemana = columna === 0 || columna === 6
              const fechaCelda = new Date(mesVisto.getFullYear(), mesVisto.getMonth(), dia)
              const esHoy = isSameDay(fechaCelda, hoy)
              const citasDia = citasPorDia[dia] || []
              const seleccionado = diaSeleccionado && isSameDay(diaSeleccionado, fechaCelda)
              return (
                <div
                  key={dia}
                  style={{
                    minHeight: 74, borderRadius: 10, padding: '7px 6px', display: 'flex', flexDirection: 'column', gap: 6,
                    background: seleccionado
                      ? 'var(--accent-soft)'
                      : esHoy
                      ? 'oklch(96.5% 0.03 55)'
                      : esFinDeSemana
                      ? 'oklch(96.5% 0.012 50)'
                      : 'var(--surface)',
                    border: `1px solid ${seleccionado ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: esHoy ? 800 : 600, color: esHoy ? 'var(--accent-hover)' : 'var(--text-muted)' }}>
                    {dia}
                  </span>
                  {citasDia.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDiaSeleccionado(fechaCelda)}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: '4px 5px', borderRadius: 7, border: 'none',
                        background: 'var(--accent)', color: '#fff', cursor: 'pointer', lineHeight: 1.2,
                      }}
                    >
                      Ver reservas{citasDia.length > 1 ? ` (${citasDia.length})` : ''}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {diaSeleccionado && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{capitalize(DIA_LARGO.format(diaSeleccionado))}</div>
              <button type="button" onClick={() => setDiaSeleccionado(null)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}>
                <Icon name="x" size={16} />
              </button>
            </div>

            {citasDelDiaSeleccionado.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 10 }}>No hay reservas para este día.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {citasDelDiaSeleccionado.map((c) => {
                  const estilo = ESTADO_BADGE[c.estado] || ESTADO_BADGE.pendiente
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => abrirCita(c)}
                      className="card"
                      style={{ textAlign: 'left', padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 10 }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{clientes[c.clienteId]?.nombre || 'Cliente'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {serviciosPorId[c.servicioId]?.nombre || 'Servicio'} · {HORA.format(c.fecha)}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 8,
                          background: estilo.bg, color: estilo.text, whiteSpace: 'nowrap', flexShrink: 0,
                        }}
                      >
                        {estilo.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {citaAbierta && (
        <ModalCita
          cita={citaAbierta}
          cliente={clientes[citaAbierta.clienteId]}
          servicio={serviciosPorId[citaAbierta.servicioId]}
          estadoSeleccionado={estadoSeleccionado}
          onCambiarEstado={setEstadoSeleccionado}
          onConfirmar={confirmarEstado}
          onCancelar={() => setCitaAbierta(null)}
          guardando={guardando}
        />
      )}
    </div>
  )
}

function ModalCita({ cita, cliente, servicio, estadoSeleccionado, onCambiarEstado, onConfirmar, onCancelar, guardando }) {
  const estilo = ESTADO_BADGE[cita.estado] || ESTADO_BADGE.pendiente
  return (
    <div
      role="presentation"
      onClick={onCancelar}
      style={{
        position: 'fixed', inset: 0, background: 'oklch(20% 0.01 0 / 0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20,
      }}
    >
      <div className="card" style={{ width: 380, maxWidth: '100%', padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{cliente?.nombre || 'Cliente'}</div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 10, background: estilo.bg, color: estilo.text, whiteSpace: 'nowrap' }}>
            {estilo.label}
          </span>
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
          <Campo label="Contacto" valor={[cliente?.telefono, cliente?.correo].filter(Boolean).join(' · ') || '—'} />
          <Campo label="Servicio" valor={servicio?.nombre || '—'} />
          <Campo label="Pago" valor={servicio ? COP.format(servicio.precio || 0) : '—'} />
          <Campo label="Hora" valor={cita.fecha ? HORA.format(cita.fecha) : '—'} />
        </div>

        <div style={{ marginTop: 20 }}>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Estado de la reserva</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <select
              value={estadoSeleccionado}
              onChange={(e) => onCambiarEstado(e.target.value)}
              style={{ flex: 1 }}
            >
              {OPCIONES_ESTADO.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            <button type="button" onClick={onConfirmar} disabled={guardando} className="btn btn-primary" style={{ flexShrink: 0 }}>
              {guardando ? 'Guardando…' : 'Continuar'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancelar}
          style={{
            width: '100%', marginTop: 14, padding: '11px 0', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'var(--danger)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function Campo({ label, valor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ fontWeight: 700, textAlign: 'right' }}>{valor}</span>
    </div>
  )
}
