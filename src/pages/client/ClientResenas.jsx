import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import CalificarModal from '../../components/CalificarModal.jsx'

const FECHA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ClientResenas() {
  const { citas, resenas, negociosPorId } = useOutletContext()
  const [calificando, setCalificando] = useState(null) // negocio | null

  const resenasOrdenadas = useMemo(
    () => [...resenas].sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0)),
    [resenas]
  )

  const pendientesPorCalificar = useMemo(() => {
    const negociosConResena = new Set(resenas.map((r) => r.negocioId))
    const negociosCompletados = [...new Set(citas.filter((c) => c.estado === 'completada').map((c) => c.negocioId))]
    return negociosCompletados.filter((id) => !negociosConResena.has(id))
  }, [citas, resenas])

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Mis reseñas</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 20 }}>
        Reseñas que has escrito y citas completadas que aún no has calificado.
      </p>

      {pendientesPorCalificar.length > 0 && (
        <div className="card" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 10 }}>Pendientes por calificar</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendientesPorCalificar.map((negocioId) => (
              <div key={negocioId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{negociosPorId[negocioId]?.nombre || 'Negocio'}</span>
                <button
                  type="button"
                  onClick={() => setCalificando(negociosPorId[negocioId])}
                  className="btn btn-primary"
                  style={{ padding: '7px 14px', fontSize: 12 }}
                >
                  Calificar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 10 }}>Reseñas publicadas</div>
      {resenasOrdenadas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Todavía no has escrito reseñas.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resenasOrdenadas.map((r) => (
            <div key={r.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <Link to={`/negocio/${r.negocioId}`} style={{ fontWeight: 700, fontSize: 14 }}>
                  {negociosPorId[r.negocioId]?.nombre || 'Negocio'}
                </Link>
                <span style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>{'★'.repeat(r.calificacion || 0)}</span>
              </div>
              {r.comentario && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{r.comentario}</p>}
              {r.creadoEn?.toDate && (
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>{FECHA.format(r.creadoEn.toDate())}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {calificando && (
        <CalificarModal negocio={calificando} onClose={() => setCalificando(null)} />
      )}
    </div>
  )
}
