import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Icon from './Icon.jsx'
import useIsMobile from '../hooks/useIsMobile.js'

// Estructura compartida del panel del negocio (OwnerLayout.jsx) y del panel
// del cliente (ClientLayout.jsx): menú lateral de cristal (estilos .panel-*
// en index.css) que en el computador se contrae a solo iconos, y en el
// celular queda siempre visible como barra de iconos que se expande encima
// del contenido.
//
// - grupos: opciones del menú en grupos, separados por una línea.
// - claveColapsado: dónde se recuerda (localStorage) si quedó contraído.
// - reemplazar: navegar sin sumar historial (panel del cliente).
// - pie({ colapsado, alNavegar }): contenido sobre "Cerrar sesión".
// - centrado: en el computador, panel y contenido en una columna centrada
//   (panel del cliente) en vez del menú pegado al borde a todo lo alto.
// - acciones: botones fijos arriba a la derecha del contenido, en todas las
//   secciones (p. ej. la campana de notificaciones del negocio).

function leerColapsado(clave) {
  try {
    return localStorage.getItem(clave) === '1'
  } catch {
    return false
  }
}

export default function PanelConMenu({ grupos, claveColapsado, reemplazar = false, centrado = false, onSalir, pie, acciones, children }) {
  const isMobile = useIsMobile()
  const [abiertoMovil, setAbiertoMovil] = useState(false)
  const [colapsadoEscritorio, setColapsadoEscritorio] = useState(() => leerColapsado(claveColapsado))
  const colapsado = isMobile ? !abiertoMovil : colapsadoEscritorio

  useEffect(() => {
    try {
      localStorage.setItem(claveColapsado, colapsadoEscritorio ? '1' : '0')
    } catch {
      // Sin almacenamiento (modo privado): solo no se recuerda.
    }
  }, [claveColapsado, colapsadoEscritorio])

  function alternar() {
    if (isMobile) setAbiertoMovil((v) => !v)
    else setColapsadoEscritorio((v) => !v)
  }

  // Al navegar en el celular el panel vuelve a quedar en solo iconos.
  function alNavegar() {
    if (isMobile) setAbiertoMovil(false)
  }

  const panel = (
    <div className={`panel-negocio${isMobile ? ' es-movil' : ''}${colapsado ? ' colapsado' : ''}${centrado ? ' centrado' : ''}`}>
      {/* Manchas de color de la marca detrás del cristal: sin algo detrás,
          el desenfoque no se nota. */}
      <div className="panel-manchas" aria-hidden="true">
        <div className="panel-mancha panel-mancha-1" />
        <div className="panel-mancha panel-mancha-2" />
      </div>

      {isMobile && abiertoMovil && (
        <div role="presentation" className="panel-velo" onClick={() => setAbiertoMovil(false)} />
      )}

      <aside className="panel-vidrio" aria-label="Menú del panel">
        {/* Contraído: solo queda el botón ☰. */}
        <div className="panel-cabecera">
          <Link to="/" className="panel-marca" title="Ir al inicio">
            <span className="panel-logo">MB</span>
            <span className="panel-oculto-colapsado">MiniBarrio</span>
          </Link>
          <button
            type="button"
            className="panel-alternar"
            onClick={alternar}
            aria-label={colapsado ? 'Expandir menú' : 'Contraer menú'}
            aria-expanded={!colapsado}
          >
            <Icon name={colapsado ? 'menu' : 'x'} size={18} />
          </button>
        </div>

        <nav className="panel-menu">
          {grupos.map((grupo, i) => (
            <div key={grupo[0].to} className="panel-grupo">
              {i > 0 && <div className="panel-divisor" />}
              {grupo.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  // "salir": enlace fuera del panel (p. ej. al inicio), que sí
                  // deja historial para poder volver.
                  replace={reemplazar && !item.salir}
                  onClick={alNavegar}
                  title={colapsado ? item.label : undefined}
                  className={({ isActive }) => `panel-item${isActive && !item.salir ? ' activo' : ''}`}
                >
                  <span className="panel-item-icono">
                    <Icon name={item.icon} size={17} />
                    {/* "insignia": cuántas hay sin ver (p. ej. notificaciones). */}
                    {item.insignia > 0 && (
                      <span className="panel-insignia" aria-label={`${item.insignia} sin leer`}>
                        {item.insignia > 9 ? '9+' : item.insignia}
                      </span>
                    )}
                  </span>
                  <span className="panel-oculto-colapsado">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="panel-pie">
          {pie?.({ colapsado, alNavegar })}

          <div className="panel-divisor" />
          <button
            type="button"
            onClick={onSalir}
            className="panel-item panel-salir"
            title={colapsado ? 'Cerrar sesión' : undefined}
          >
            <Icon name="logout" size={17} />
            <span className="panel-oculto-colapsado">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="panel-contenido vitrina">
        {acciones && <div className="panel-acciones">{acciones}</div>}
        {children}
      </main>
    </div>
  )

  if (!centrado) return panel
  // Centrado: las manchas de fondo van a todo el ancho de la página (las
  // del panel quedarían encerradas en la columna).
  return (
    <div className="vitrina">
      <div className="vitrina-fondo" aria-hidden="true"><span /><span /><span /><span /></div>
      {panel}
    </div>
  )
}
