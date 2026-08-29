import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import CalificarModal from '../../components/CalificarModal.jsx'

// Panel del cliente — vista "Resumen". Conectado a datos reales de
// Firestore (citas, favoritos, reseñas) vía el contexto de ClientLayout.

const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
const HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

function primerNombre(nombre) {
  return nombre?.split(' ')[0] || 'ahí'
}

export default function ClientResumen() {
  const {
    perfil, citas, favoritos, resenas, negociosPorId, serviciosPorId, ratings, toggleFavorito, cancelarCita,
  } = useOutletContext()

  const [calificando, setCalificando] = useState(null) // negocio | null
  const [cancelandoId, setCancelandoId] = useState(null)

  const ahora = useMemo(() => new Date(), [])

  const citasConFecha = useMemo(
    () => citas.map((c) => ({ ...c, fecha: c.fechaHora?.toDate ? c.fechaHora.toDate() : null })).filter((c) => c.fecha),
    [citas]
  )

  const citasCompletadas = useMemo(() => citasConFecha.filter((c) => c.estado === 'completada').length, [citasConFecha])

  const proximaCita = useMemo(
    () => citasConFecha
      .filter((c) => c.fecha >= ahora && c.estado !== 'cancelada' && c.estado !== 'completada')
      .sort((a, b) => a.fecha - b.fecha)[0] || null,
    [citasConFecha, ahora]
  )

  const historial = useMemo(
    () => citasConFecha
      .filter((c) => c.id !== proximaCita?.id && (c.fecha < ahora || c.estado === 'completada' || c.estado === 'cancelada'))
      .sort((a, b) => b.fecha - a.fecha)
      .slice(0, 5),
    [citasConFecha, ahora, proximaCita]
  )

  const resenasOrdenadas = useMemo(
    () => [...resenas].sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0)),
    [resenas]
  )

  const pendientePorCalificar = useMemo(() => {
    const negociosConResena = new Set(resenas.map((r) => r.negocioId))
    const completadas = citasConFecha
      .filter((c) => c.estado === 'completada' && !negociosConResena.has(c.negocioId))
      .sort((a, b) => b.fecha - a.fecha)
    if (completadas.length === 0) return null
    return completadas[0]
  }, [citasConFecha, resenas])

  async function handleCancelar(citaId) {
    setCancelandoId(citaId)
    try {
      await cancelarCita(citaId)
    } finally {
      setCancelandoId(null)
    }
  }

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>Hola, {primerNombre(perfil?.nombre)}</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>
        Aquí puedes revisar tus citas, favoritos y reseñas.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginTop: 22 }}>
        <StatTile icon="calendar" value={citasCompletadas} label="Citas completadas" />
        <StatTile icon="heart" value={favoritos.length} label="Negocios favoritos" />
        <StatTile icon="star" value={resenas.length} label="Reseñas escritas" />
      </div>

      {proximaCita && (
        <div
          className="card"
          style={{
            marginTop: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 14,
            background: 'var(--accent-soft)', borderColor: 'var(--accent)',
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--surface)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                background: 'var(--accent)', color: '#fff',
              }}
            >
              Próxima cita
            </span>
            <div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 6 }}>
              {negociosPorId[proximaCita.negocioId]?.nombre || 'Negocio'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
              {serviciosPorId[`${proximaCita.negocioId}:${proximaCita.servicioId}`]?.nombre || 'Servicio'} ·{' '}
              {FECHA_CORTA.format(proximaCita.fecha)}, {HORA.format(proximaCita.fecha)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Link to={`/negocio/${proximaCita.negocioId}`} className="btn btn-outline" style={{ padding: '8px 14px', fontSize: 12.5 }}>
              Reprogramar
            </Link>
            <button
              type="button"
              onClick={() => handleCancelar(proximaCita.id)}
              disabled={cancelandoId === proximaCita.id}
              style={{
                padding: '8px 14px', fontSize: 12.5, fontWeight: 700, borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--danger)', background: 'var(--surface)', color: 'var(--danger)', cursor: 'pointer',
              }}
            >
              {cancelandoId === proximaCita.id ? 'Cancelando…' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Negocios favoritos</div>
            <Link to="/perfil/favoritos" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>Ver todos</Link>
          </div>
          {favoritos.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Aún no tienes negocios favoritos. Marca uno con el ♥ desde su perfil.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {favoritos.slice(0, 3).map((f) => {
                const negocio = negociosPorId[f.negocioId]
                const r = ratings[f.negocioId]
                return (
                  <div key={f.negocioId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--surface-2)', flexShrink: 0 }} />
                    <Link to={`/negocio/${f.negocioId}`} style={{ flex: 1, minWidth: 0, color: 'inherit' }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{negocio?.nombre || 'Negocio'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                        {r?.total ? `★ ${(r.suma / r.total).toFixed(1)} · ` : ''}Britalia
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleFavorito(f.negocioId)}
                      title="Quitar de favoritos"
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                    >
                      <Icon name="heart" size={17} filled />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Mis reseñas recientes</div>
            <Link to="/perfil/resenas" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>Ver todas</Link>
          </div>
          {resenasOrdenadas.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Todavía no has escrito reseñas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {resenasOrdenadas.slice(0, 2).map((r) => (
                <div key={r.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{negociosPorId[r.negocioId]?.nombre || 'Negocio'}</span>
                    <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{'★'.repeat(r.calificacion || 0)}</span>
                  </div>
                  {r.comentario && (
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>&ldquo;{r.comentario}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {pendientePorCalificar && (
            <div
              style={{
                marginTop: 14, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-soft)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
              }}
            >
              <div style={{ fontSize: 12, color: 'oklch(40% 0.1 75)' }}>
                {serviciosPorId[`${pendientePorCalificar.negocioId}:${pendientePorCalificar.servicioId}`]?.nombre || 'Cita'} en{' '}
                {negociosPorId[pendientePorCalificar.negocioId]?.nombre || 'negocio'} — pendiente por calificar
              </div>
              <button
                type="button"
                onClick={() => setCalificando(negociosPorId[pendientePorCalificar.negocioId])}
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: 11.5, flexShrink: 0 }}
              >
                Calificar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Historial de citas</div>
        {historial.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Aún no tienes citas pasadas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {historial.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>
                  <Icon name="calendar" size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{negociosPorId[c.negocioId]?.nombre || 'Negocio'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                    {serviciosPorId[`${c.negocioId}:${c.servicioId}`]?.nombre || 'Servicio'} · {FECHA_LARGA.format(c.fecha)}
                  </div>
                </div>
                <Link to={`/negocio/${c.negocioId}`} className="btn btn-outline" style={{ padding: '7px 12px', fontSize: 12, flexShrink: 0 }}>
                  Reservar de nuevo
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {calificando && (
        <CalificarModal negocio={calificando} onClose={() => setCalificando(null)} />
      )}
    </div>
  )
}

function StatTile({ icon, value, label }) {
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          width: 40, height: 40, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent-hover)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <Icon name={icon} size={18} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{label}</div>
      </div>
    </div>
  )
}
