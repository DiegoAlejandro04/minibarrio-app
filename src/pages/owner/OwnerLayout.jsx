import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'
import Icon from '../../components/Icon.jsx'
import Splash from '../../components/Splash.jsx'
import useIsMobile from '../../hooks/useIsMobile.js'
import { pasosPerfil } from '../../perfilNegocio.js'

// Shell del panel del comerciante: sidebar de cristal (estilos .panel-* en
// index.css) que se contrae a solo iconos, con navegación real + los datos
// del negocio y sus servicios, compartidos entre las sub-páginas via
// Outlet context (evita que cada página vuelva a suscribirse a lo mismo).

// Menú en grupos, separados por una línea en el panel.
const GRUPOS_NAV = [
  [
    { to: '/panel', label: 'Resumen', icon: 'grid', end: true },
    { to: '/panel/agenda', label: 'Agenda', icon: 'calendar' },
  ],
  [
    { to: '/panel/servicios', label: 'Servicios', icon: 'scissors' },
    { to: '/panel/identidad', label: 'Identidad', icon: 'store' },
    { to: '/panel/portafolio', label: 'Portafolio', icon: 'image' },
    { to: '/panel/resenas', label: 'Reseñas', icon: 'star' },
    { to: '/panel/clientes', label: 'Clientes', icon: 'users' },
  ],
  [
    { to: '/panel/configuracion', label: 'Configuración', icon: 'gear' },
  ],
]

// En el computador se recuerda si el dueño dejó el panel contraído.
const CLAVE_COLAPSADO = 'minibarrio:panelColapsado'

function leerColapsado() {
  try {
    return localStorage.getItem(CLAVE_COLAPSADO) === '1'
  } catch {
    return false
  }
}

export default function OwnerLayout() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const uid = currentUser?.uid
  const isMobile = useIsMobile()
  // En el celular el panel queda siempre visible como barra de iconos y se
  // expande encima del contenido; en el computador se contrae o expande.
  const [abiertoMovil, setAbiertoMovil] = useState(false)
  const [colapsadoEscritorio, setColapsadoEscritorio] = useState(leerColapsado)
  const [busqueda, setBusqueda] = useState('')
  const buscadorRef = useRef(null)
  const colapsado = isMobile ? !abiertoMovil : colapsadoEscritorio

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_COLAPSADO, colapsadoEscritorio ? '1' : '0')
    } catch {
      // Sin almacenamiento (modo privado): solo no se recuerda.
    }
  }, [colapsadoEscritorio])

  const [negocio, setNegocio] = useState(null)
  const [servicios, setServicios] = useState([])
  const [portada, setPortada] = useState(null) // data URL de la foto de portada, ver OwnerIdentidad.jsx
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    const unsubs = [
      onSnapshot(doc(db, 'negocios', uid), (snap) => {
        setNegocio(snap.exists() ? snap.data() : null)
        setLoading(false)
      }),
      onSnapshot(collection(db, 'negocios', uid, 'servicios'), (snap) => {
        setServicios(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
      onSnapshot(doc(db, 'negocios', uid, 'medios', 'portada'), (snap) => {
        setPortada(snap.exists() ? snap.data().imagen : null)
      }),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [uid])

  // Barra "Perfil al X%": cuánto está completo y cuál es el siguiente paso
  // concreto (con enlace a dónde se hace), en vez de un consejo genérico.
  const pasos = useMemo(() => pasosPerfil(negocio, servicios, !!portada), [negocio, servicios, portada])
  const perfilCompletado = pasos.length ? Math.round((pasos.filter((p) => p.listo).length / pasos.length) * 100) : 0
  const siguientePaso = pasos.find((p) => !p.listo)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  if (loading) return <Splash animar={false} />

  if (!negocio) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Panel del comerciante</div>
        <p style={{ color: 'var(--text-muted)' }}>No se encontró el negocio asociado a esta cuenta.</p>
      </div>
    )
  }

  const texto = busqueda.trim().toLowerCase()
  const visible = (item) => !texto || item.label.toLowerCase().includes(texto)
  const grupos = GRUPOS_NAV.map((grupo) => grupo.filter(visible)).filter((grupo) => grupo.length > 0)
  const verCerrarSesion = !texto || 'cerrar sesión'.includes(texto)

  function alternar() {
    if (isMobile) setAbiertoMovil((v) => !v)
    else setColapsadoEscritorio((v) => !v)
  }

  // Al navegar en el celular el panel vuelve a quedar en solo iconos.
  function alNavegar() {
    setBusqueda('')
    if (isMobile) setAbiertoMovil(false)
  }

  function abrirBusqueda() {
    if (isMobile) setAbiertoMovil(true)
    else setColapsadoEscritorio(false)
    requestAnimationFrame(() => buscadorRef.current?.focus())
  }

  function alTeclearBusqueda(e) {
    if (e.key === 'Escape') {
      setBusqueda('')
    } else if (e.key === 'Enter' && grupos.length > 0) {
      navigate(grupos[0][0].to)
      alNavegar()
    }
  }

  return (
    <div className={`panel-negocio${isMobile ? ' es-movil' : ''}${colapsado ? ' colapsado' : ''}`}>
      {/* Manchas de color de la marca detrás del cristal: sin algo detrás,
          el desenfoque no se nota. */}
      <div className="panel-mancha panel-mancha-1" aria-hidden="true" />
      <div className="panel-mancha panel-mancha-2" aria-hidden="true" />

      {isMobile && abiertoMovil && (
        <div role="presentation" className="panel-velo" onClick={() => setAbiertoMovil(false)} />
      )}

      <aside className="panel-vidrio" aria-label="Menú del panel">
        <div className="panel-cabecera">
          <div className="panel-marca">
            <span className="panel-logo">MB</span>
            <span className="panel-oculto-colapsado">MiniBarrio</span>
          </div>
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

        <div className="panel-buscador" onClick={colapsado ? abrirBusqueda : undefined}>
          <Icon name="search" size={16} />
          <input
            ref={buscadorRef}
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={alTeclearBusqueda}
            placeholder="Buscar"
            aria-label="Buscar en el menú"
            maxLength={40}
            tabIndex={colapsado ? -1 : 0}
          />
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
                  onClick={alNavegar}
                  title={colapsado ? item.label : undefined}
                  className={({ isActive }) => `panel-item${isActive ? ' activo' : ''}`}
                >
                  <Icon name={item.icon} size={17} />
                  <span className="panel-oculto-colapsado">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
          {grupos.length === 0 && !verCerrarSesion && (
            <p className="panel-sin-resultados">Sin resultados</p>
          )}
        </nav>

        <div className="panel-pie">
          {!texto && (
            colapsado ? (
              <Link
                to={siguientePaso?.ruta || '/panel/identidad'}
                onClick={alNavegar}
                className="panel-progreso-anillo"
                style={{ '--avance': `${perfilCompletado * 3.6}deg` }}
                title={`Perfil al ${perfilCompletado}%`}
                aria-label={`Perfil al ${perfilCompletado}%`}
              >
                <span>{perfilCompletado}</span>
              </Link>
            ) : (
              <div className="panel-progreso">
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>Perfil al {perfilCompletado}%</div>
                <div className="panel-progreso-barra">
                  <div style={{ width: `${perfilCompletado}%` }} />
                </div>
                {siguientePaso ? (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>Siguiente paso:</div>
                    <Link to={siguientePaso.ruta} onClick={alNavegar} className="panel-progreso-paso">
                      <span style={{ color: 'var(--accent)' }}>→</span> {siguientePaso.texto}
                    </Link>
                  </>
                ) : (
                  <div style={{ fontSize: 11.5, color: 'var(--sage-text)', marginTop: 8, fontWeight: 700 }}>¡Tu perfil está completo!</div>
                )}
              </div>
            )
          )}

          {verCerrarSesion && (
            <>
              <div className="panel-divisor" />
              <button
                type="button"
                onClick={handleLogout}
                className="panel-item panel-salir"
                title={colapsado ? 'Cerrar sesión' : undefined}
              >
                <Icon name="logout" size={17} />
                <span className="panel-oculto-colapsado">Cerrar sesión</span>
              </button>
            </>
          )}
        </div>
      </aside>

      <main className="panel-contenido">
        <Outlet context={{ negocio, servicios, uid, portada }} />
      </main>
    </div>
  )
}
