import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'
import { inicialesDe } from './FotoNegocio.jsx'

// Menú de la cuenta en el encabezado de la vitrina (ClientHome.jsx): la foto
// con una flechita; al tocarla se despliega debajo con el nombre y el tipo
// de cuenta, los accesos (cada uno con su ícono en un cuadrito y, si hay, un
// dato al lado: `extras`, p. ej. { '/perfil/citas': '1 próxima' }) y
// "Cerrar sesión" como botón aparte, en rojo. Se cierra al tocar fuera, con
// Escape o al elegir una opción. Estilos .menu-cuenta* en index.css.

const TIPO_CUENTA = { cliente: 'Cliente · Britalia', propietario: 'Negocio · Britalia' }

const OPCIONES = {
  cliente: [
    { to: '/perfil', icono: 'user', texto: 'Mi perfil' },
    { to: '/perfil/citas', icono: 'calendar', texto: 'Mis citas' },
    { to: '/perfil/favoritos', icono: 'heart', texto: 'Favoritos' },
    // Las notificaciones ya tienen su campanita al lado de la foto.
    { to: '/perfil/configuracion', icono: 'gear', texto: 'Configuración' },
  ],
  propietario: [
    { to: '/panel', icono: 'grid', texto: 'Mi panel' },
    { to: '/panel/agenda', icono: 'calendar', texto: 'Agenda' },
    { to: '/panel/identidad', icono: 'store', texto: 'Identidad' },
    { to: '/panel/configuracion', icono: 'gear', texto: 'Configuración' },
  ],
}

export default function MenuCuenta({ usuario, role, extras = {}, onSalir }) {
  const [abierto, setAbierto] = useState(false)
  const raizRef = useRef(null)

  useEffect(() => {
    if (!abierto) return undefined
    const alTocar = (e) => { if (!raizRef.current?.contains(e.target)) setAbierto(false) }
    const alTeclear = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('pointerdown', alTocar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alTocar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  const opciones = OPCIONES[role] || []
  const cerrar = () => setAbierto(false)

  return (
    <div className="menu-cuenta" ref={raizRef}>
      <button
        type="button"
        className={`menu-cuenta__boton${abierto ? ' abierto' : ''}`}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Menú de tu cuenta"
      >
        <span className="menu-cuenta__avatar">{inicialesDe(usuario.displayName)}</span>
        <svg className="menu-cuenta__flecha" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <div className="menu-cuenta__panel" role="menu">
          <div className="menu-cuenta__usuario">
            <span className="menu-cuenta__avatar grande">{inicialesDe(usuario.displayName)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="menu-cuenta__nombre">{usuario.displayName || 'Mi cuenta'}</div>
              <div className="menu-cuenta__correo">{usuario.email}</div>
              {TIPO_CUENTA[role] && <span className="menu-cuenta__tipo">{TIPO_CUENTA[role]}</span>}
            </div>
          </div>
          <div className="menu-cuenta__grupo">
            {opciones.map((o) => (
              <Link key={o.to} to={o.to} className="menu-cuenta__opcion" role="menuitem" onClick={cerrar}>
                <span className="menu-cuenta__icono"><Icon name={o.icono} size={16} /></span>
                <span className="menu-cuenta__texto">{o.texto}</span>
                {extras[o.to] != null && <span className="menu-cuenta__extra">{extras[o.to]}</span>}
                <span className="menu-cuenta__chevron" aria-hidden="true"><Icon name="chevronRight" size={15} /></span>
              </Link>
            ))}
          </div>
          <div className="menu-cuenta__pie">
            <button type="button" className="menu-cuenta__salir" role="menuitem" onClick={() => { cerrar(); onSalir() }}>
              <Icon name="logout" size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
