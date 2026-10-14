import { useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import ConfirmarModal from '../../components/ConfirmarModal.jsx'
import PaginadorPeine from '../../components/PaginadorPeine.jsx'
import useIsMobile from '../../hooks/useIsMobile.js'
import { codigoReserva } from '../../reservas.js'

const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
const HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })

const ESTADO_STYLES = {
  confirmada: { bg: 'var(--sage-soft)', text: 'var(--sage-text)', label: 'Confirmada' },
  // "pendiente" es el estado guardado de una cita activa; se muestra como
  // "Reservada" porque el turno ya quedó apartado (reserva inmediata).
  pendiente: { bg: 'var(--sage-soft)', text: 'var(--sage-text)', label: 'Reservada' },
  cancelada: { bg: 'var(--danger-soft)', text: 'var(--danger)', label: 'Cancelada' },
  completada: { bg: 'var(--surface-2)', text: 'var(--text-muted)', label: 'Completada' },
}

// El historial se muestra de a CITAS_POR_PAGINA, con el paginador del peine
// debajo cuando hay más (ver PaginadorPeine.jsx).
const CITAS_POR_PAGINA = 10

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function ClientCitas() {
  const { citas, negociosPorId, serviciosPorId, cancelarCita } = useOutletContext()
  const [cancelandoId, setCancelandoId] = useState(null)
  const [porCancelar, setPorCancelar] = useState(null) // cita que pide confirmación | null
  const [pagina, setPagina] = useState(1)
  const historialRef = useRef(null)
  const isMobile = useIsMobile()

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

  const totalPaginas = Math.max(1, Math.ceil(pasadas.length / CITAS_POR_PAGINA))
  // Si el historial se achica (p. ej. al recargar), no quedarse en una página vacía.
  const paginaActual = Math.min(pagina, totalPaginas)
  const pasadasDeLaPagina = pasadas.slice((paginaActual - 1) * CITAS_POR_PAGINA, paginaActual * CITAS_POR_PAGINA)

  // Al cambiar de página sube despacio hasta el título "Historial".
  function irAPagina(p) {
    setPagina(p)
    historialRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Se cancela solo después de confirmarlo en la ventana (ConfirmarModal),
  // igual que en la vista Principal (ClientResumen.jsx).
  async function handleCancelar(citaId) {
    setCancelandoId(citaId)
    try {
      await cancelarCita(citaId)
      setPorCancelar(null)
    } finally {
      setCancelandoId(null)
    }
  }

  function Fila({ c, mostrarCancelar }) {
    const estilo = ESTADO_STYLES[c.estado] || ESTADO_STYLES.pendiente

    const boton = mostrarCancelar ? (
      <button
        type="button"
        onClick={() => setPorCancelar(c)}
        disabled={cancelandoId === c.id}
        className="btn-cancelar-cita"
        style={{ flexShrink: 0 }}
      >
        {cancelandoId === c.id ? 'Cancelando…' : 'Cancelar'}
      </button>
    ) : (
      <Link to={`/negocio/${c.negocioId}`} className="btn btn-outline btn-reservar-de-nuevo" style={{ padding: '7px 12px', fontSize: 12, flexShrink: 0 }}>
        Reservar de nuevo
      </Link>
    )

    const pill = (
      <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: estilo.bg, color: estilo.text, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {estilo.label}
      </span>
    )

    const icono = (
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>
        <Icon name="calendar" size={16} />
      </div>
    )

    const texto = (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{negociosPorId[c.negocioId]?.nombre || 'Negocio'}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
          {serviciosPorId[`${c.negocioId}:${c.servicioId}`]?.nombre || 'Servicio'} ·{' '}
          {capitalize(FECHA_LARGA.format(c.fecha))}, {HORA.format(c.fecha)}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3, fontFamily: 'ui-monospace, Consolas, monospace' }}>
          Reserva #{codigoReserva(c.id)}
        </div>
      </div>
    )

    if (isMobile) {
      return (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            {icono}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              {texto}
              {pill}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            {boton}
          </div>
        </div>
      )
    }

    return (
      <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        {icono}
        <div style={{ flex: 1, minWidth: 0 }}>{texto}</div>
        {pill}
        {boton}
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

      <div ref={historialRef} style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, scrollMarginTop: 20 }}>
        Historial
        {totalPaginas > 1 && (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-faint)', marginLeft: 8 }}>
            Página {paginaActual} de {totalPaginas}
          </span>
        )}
      </div>
      {pasadas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Aún no tienes citas pasadas.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pasadasDeLaPagina.map((c) => <Fila key={c.id} c={c} mostrarCancelar={false} />)}
        </div>
      )}
      <PaginadorPeine pagina={paginaActual} total={totalPaginas} onCambiar={irAPagina} visibles={isMobile ? 5 : 10} />

      {porCancelar && (
        <ConfirmarModal
          icono="calendar"
          titulo="¿Seguro que quieres cancelar esta cita?"
          mensaje={(
            <>
              <strong style={{ color: 'var(--text)' }}>{negociosPorId[porCancelar.negocioId]?.nombre || 'Negocio'}</strong>
              {' · '}{serviciosPorId[`${porCancelar.negocioId}:${porCancelar.servicioId}`]?.nombre || 'Servicio'}
              <br />
              {capitalize(FECHA_LARGA.format(porCancelar.fecha))}, {HORA.format(porCancelar.fecha)}
              <br />
              El turno quedará libre para otra persona y no se puede deshacer.
            </>
          )}
          textoConfirmar="Sí, cancelar"
          textoCargando="Cancelando…"
          textoVolver="No, volver"
          cargando={cancelandoId === porCancelar.id}
          onConfirmar={() => handleCancelar(porCancelar.id)}
          onCerrar={() => setPorCancelar(null)}
        />
      )}
    </div>
  )
}
