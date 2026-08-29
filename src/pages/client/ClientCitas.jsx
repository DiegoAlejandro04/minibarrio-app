import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'

const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
const HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })

const ESTADO_STYLES = {
  confirmada: { bg: 'var(--sage-soft)', text: 'var(--sage-text)', label: 'Confirmada' },
  pendiente: { bg: 'var(--warning-soft)', text: 'oklch(45% 0.11 75)', label: 'Pendiente' },
  cancelada: { bg: 'oklch(93% 0.035 25)', text: 'var(--danger)', label: 'Cancelada' },
  completada: { bg: 'var(--surface-2)', text: 'var(--text-muted)', label: 'Completada' },
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function ClientCitas() {
  const { citas, negociosPorId, serviciosPorId, cancelarCita } = useOutletContext()
  const [cancelandoId, setCancelandoId] = useState(null)

  const ahora = useMemo(() => new Date(), [])

  const citasConFecha = useMemo(
    () => citas.map((c) => ({ ...c, fecha: c.fechaHora?.toDate ? c.fechaHora.toDate() : null })).filter((c) => c.fecha),
    [citas]
  )

  const proximas = useMemo(
    () => citasConFecha
      .filter((c) => c.fecha >= ahora && c.estado !== 'cancelada' && c.estado !== 'completada')
      .sort((a, b) => a.fecha - b.fecha),
    [citasConFecha, ahora]
  )

  const pasadas = useMemo(
    () => citasConFecha
      .filter((c) => c.fecha < ahora || c.estado === 'completada' || c.estado === 'cancelada')
      .sort((a, b) => b.fecha - a.fecha),
    [citasConFecha, ahora]
  )

  async function handleCancelar(citaId) {
    setCancelandoId(citaId)
    try {
      await cancelarCita(citaId)
    } finally {
      setCancelandoId(null)
    }
  }

  function Fila({ c, mostrarCancelar }) {
    const estilo = ESTADO_STYLES[c.estado] || ESTADO_STYLES.pendiente
    return (
      <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>
          <Icon name="calendar" size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{negociosPorId[c.negocioId]?.nombre || 'Negocio'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
            {serviciosPorId[`${c.negocioId}:${c.servicioId}`]?.nombre || 'Servicio'} ·{' '}
            {capitalize(FECHA_LARGA.format(c.fecha))}, {HORA.format(c.fecha)}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: estilo.bg, color: estilo.text, whiteSpace: 'nowrap' }}>
          {estilo.label}
        </span>
        {mostrarCancelar ? (
          <button
            type="button"
            onClick={() => handleCancelar(c.id)}
            disabled={cancelandoId === c.id}
            style={{
              padding: '7px 12px', fontSize: 12, fontWeight: 700, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--danger)', background: 'var(--surface)', color: 'var(--danger)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            {cancelandoId === c.id ? 'Cancelando…' : 'Cancelar'}
          </button>
        ) : (
          <Link to={`/negocio/${c.negocioId}`} className="btn btn-outline" style={{ padding: '7px 12px', fontSize: 12, flexShrink: 0 }}>
            Reservar de nuevo
          </Link>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Mis citas</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 20 }}>
        Tus próximas citas y tu historial en las barberías de Britalia.
      </p>

      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Próximas</div>
      {proximas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 24 }}>No tienes citas próximas.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {proximas.map((c) => <Fila key={c.id} c={c} mostrarCancelar />)}
        </div>
      )}

      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Historial</div>
      {pasadas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Aún no tienes citas pasadas.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pasadas.map((c) => <Fila key={c.id} c={c} mostrarCancelar={false} />)}
        </div>
      )}
    </div>
  )
}
