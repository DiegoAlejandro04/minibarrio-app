import { Link, useOutletContext } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'

export default function ClientFavoritos() {
  const { favoritos, negociosPorId, ratings, toggleFavorito } = useOutletContext()

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Favoritos</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 20 }}>
        Los negocios que has marcado con ♥ desde su perfil.
      </p>

      {favoritos.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
          Aún no tienes negocios favoritos. Ve al perfil de una barbería y toca el corazón para guardarla aquí.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {favoritos.map((f) => {
            const negocio = negociosPorId[f.negocioId]
            const r = ratings[f.negocioId]
            return (
              <div key={f.negocioId} className="card" style={{ overflow: 'hidden' }}>
                <Link to={`/negocio/${f.negocioId}`} style={{ display: 'block', color: 'inherit' }}>
                  <div style={{ height: 100, background: 'var(--surface-2)' }} />
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{negocio?.nombre || 'Negocio'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {r?.total ? `★ ${(r.suma / r.total).toFixed(1)} (${r.total})` : 'Sin reseñas aún'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>{negocio?.direccion}</div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleFavorito(f.negocioId)}
                  style={{
                    width: '100%', border: 'none', borderTop: '1px solid var(--border)', background: 'none',
                    padding: '10px 0', fontSize: 12.5, fontWeight: 700, color: 'var(--danger)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Icon name="heart" size={14} filled /> Quitar de favoritos
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
