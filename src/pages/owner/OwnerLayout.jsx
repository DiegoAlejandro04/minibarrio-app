import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'
import Icon from '../../components/Icon.jsx'

// Shell del panel del comerciante: sidebar con navegación real + los datos
// del negocio y sus servicios, compartidos entre las sub-páginas via
// Outlet context (evita que cada página vuelva a suscribirse a lo mismo).

const NAV_ITEMS = [
  { to: '/panel', label: 'Resumen', icon: 'grid', end: true },
  { to: '/panel/agenda', label: 'Agenda', icon: 'calendar' },
  { to: '/panel/servicios', label: 'Servicios', icon: 'scissors' },
  { to: '/panel/portafolio', label: 'Portafolio', icon: 'image' },
  { to: '/panel/resenas', label: 'Reseñas', icon: 'star' },
  { to: '/panel/clientes', label: 'Clientes', icon: 'users' },
  { to: '/panel/configuracion', label: 'Configuración', icon: 'gear' },
]

export default function OwnerLayout() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const uid = currentUser?.uid

  const [negocio, setNegocio] = useState(null)
  const [servicios, setServicios] = useState([])
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
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [uid])

  const perfilCompletado = useMemo(() => {
    if (!negocio) return 0
    const checks = [
      !!negocio.nombre,
      !!negocio.descripcion,
      !!negocio.direccion,
      !!negocio.canalesContacto?.whatsapp,
      (negocio.fotos || []).length > 0,
      servicios.length > 0,
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [negocio, servicios])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Cargando panel…
      </div>
    )
  }

  if (!negocio) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Panel del comerciante</div>
        <p style={{ color: 'var(--text-muted)' }}>No se encontró el negocio asociado a esta cuenta.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 232, background: 'var(--ink)', color: 'var(--ink-text)', flexShrink: 0,
          display: 'flex', flexDirection: 'column', padding: '22px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 16.5, fontWeight: 800, padding: '0 6px' }}>
          <span
            style={{
              width: 30, height: 30, borderRadius: 9, background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
            }}
          >
            MB
          </span>
          MiniBarrio
        </div>

        <div style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: 'oklch(70% 0.02 165)', margin: '26px 6px 10px' }}>
          Panel del comerciante
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9,
                fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
                background: isActive ? 'var(--ink-2)' : 'transparent',
                color: isActive ? '#fff' : 'oklch(70% 0.02 165)',
              })}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--ink-2)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>Perfil al {perfilCompletado}%</div>
            <div style={{ height: 6, background: 'oklch(35% 0.03 165)', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${perfilCompletado}%`, background: 'var(--accent)', borderRadius: 999 }} />
            </div>
            {perfilCompletado < 100 && (
              <div style={{ fontSize: 11, color: 'oklch(70% 0.02 165)', marginTop: 8, lineHeight: 1.4 }}>
                Completa tu perfil (fotos, servicios y datos de contacto) para aparecer mejor posicionado.
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent', border: '1px solid oklch(38% 0.03 165)', color: 'oklch(85% 0.01 165)',
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 13, fontWeight: 700,
              borderRadius: 'var(--radius-sm)', padding: '10px 16px',
            }}
          >
            <Icon name="logout" size={15} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, background: 'var(--bg)', padding: '28px 36px' }}>
        <Outlet context={{ negocio, servicios, uid }} />
      </main>
    </div>
  )
}
