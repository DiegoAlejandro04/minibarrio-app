import Icon from './Icon.jsx'
import { TIPOS_NOTIFICACION, haceCuanto } from '../notificaciones.js'

// Lista de notificaciones (panel del cliente y campana del negocio): ícono
// según el tipo, título, texto y hace cuánto llegó. Las no leídas van
// resaltadas y con un punto naranja. Al tocar una se llama onAbrir(n) (que
// la marca como leída y lleva a su enlace). Estilos .notif-* en index.css.

export default function ListaNotificaciones({ notificaciones, onAbrir }) {
  if (notificaciones.length === 0) {
    return (
      <div className="notif-vacio">
        <span className="notif-vacio-icono"><Icon name="bell" size={22} /></span>
        <div style={{ fontWeight: 800, marginTop: 12 }}>No tienes notificaciones</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Aquí verás tus reservas, recordatorios y novedades.
        </div>
      </div>
    )
  }

  const ahora = new Date()
  return (
    <ul className="notif-lista">
      {notificaciones.map((n) => {
        const tipo = TIPOS_NOTIFICACION[n.tipo] || { icono: 'bell', tono: 'acento' }
        return (
          <li key={n.id}>
            <button type="button" className={`notif-item${n.leida ? '' : ' sin-leer'}`} onClick={() => onAbrir(n)}>
              <span className={`notif-icono notif-tono-${tipo.tono}`} aria-hidden="true">
                <Icon name={tipo.icono} size={17} />
              </span>
              <span className="notif-cuerpo">
                <span className="notif-titulo">{n.titulo}</span>
                <span className="notif-texto">{n.texto}</span>
                <span className="notif-hora">{haceCuanto(n.fecha, ahora)}</span>
              </span>
              {!n.leida && <span className="notif-punto" aria-label="Sin leer" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
