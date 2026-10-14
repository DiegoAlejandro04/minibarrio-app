import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'
import PanelConMenu from '../../components/PanelConMenu.jsx'
import Splash from '../../components/Splash.jsx'
import { pasosPerfil } from '../../perfilNegocio.js'

// Shell del panel del comerciante: menú lateral de cristal (PanelConMenu.jsx,
// compartido con el panel del cliente) + los datos
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

export default function OwnerLayout() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const uid = currentUser?.uid
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

  return (
    <PanelConMenu
      grupos={GRUPOS_NAV}
      claveColapsado="minibarrio:panelColapsado"
      onSalir={handleLogout}
      pie={({ colapsado, alNavegar }) => (
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
    >
      <Outlet context={{ negocio, servicios, uid, portada }} />
    </PanelConMenu>
  )
}
