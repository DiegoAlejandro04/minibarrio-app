import { useNavigate, useOutletContext } from 'react-router-dom'
import ListaNotificaciones from '../../components/ListaNotificaciones.jsx'

// Panel del cliente — "Notificaciones": sus reservas, recordatorios, citas
// canceladas por el negocio e invitaciones a calificar, en tiempo real (ver
// ClientLayout.jsx y src/notificaciones.js).
export default function ClientNotificaciones() {
  const { notificaciones, marcarLeida, marcarTodasLeidas, eliminarNotificacion } = useOutletContext()
  const navigate = useNavigate()
  const hayPendientes = notificaciones.some((n) => !n.leida)

  function abrir(n) {
    if (!n.leida) marcarLeida(n.id)
    if (n.enlace) navigate(n.enlace, { replace: n.enlace.startsWith('/perfil') })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Notificaciones</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
            Tus reservas, recordatorios y novedades de las barberías.
          </p>
        </div>
        {hayPendientes && (
          <button type="button" className="notif-marcar-todas" onClick={marcarTodasLeidas}>
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 8 }}>
        <ListaNotificaciones notificaciones={notificaciones} onAbrir={abrir} onEliminar={eliminarNotificacion} />
      </div>
    </div>
  )
}
