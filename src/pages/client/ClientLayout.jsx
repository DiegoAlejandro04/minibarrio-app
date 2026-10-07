import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  collection, collectionGroup, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'
import { cambiarEstadoCita } from '../../turnosOcupados.js'
import Icon from '../../components/Icon.jsx'
import Splash from '../../components/Splash.jsx'
import useIsMobile from '../../hooks/useIsMobile.js'

// Shell del panel del cliente: sidebar de navegación + los datos del perfil,
// citas, favoritos y reseñas del cliente, compartidos entre las sub-páginas
// vía Outlet context (mismo patrón que src/pages/owner/OwnerLayout.jsx).
//
// Los enlaces entre secciones del panel usan "replace": moverse entre menús
// no deja historial, así que "atrás" sale del panel a la página desde donde
// se entró (normalmente la principal) en vez de recorrer cada menú visitado.

const NAV_ITEMS = [
  { to: '/perfil', label: 'Principal', icon: 'grid', end: true },
  { to: '/perfil/citas', label: 'Mis citas', icon: 'calendar' },
  { to: '/perfil/favoritos', label: 'Favoritos', icon: 'heart' },
  { to: '/perfil/resenas', label: 'Mis reseñas', icon: 'star' },
  { to: '/perfil/datos', label: 'Datos personales', icon: 'user' },
  { to: '/perfil/notificaciones', label: 'Notificaciones', icon: 'bell' },
  { to: '/perfil/configuracion', label: 'Configuración', icon: 'gear' },
]

function inicialesDe(nombre) {
  if (!nombre) return '?'
  const partes = nombre.trim().split(/\s+/)
  return partes.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}

export default function ClientLayout() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const uid = currentUser?.uid
  const isMobile = useIsMobile()
  const [drawerAbierto, setDrawerAbierto] = useState(false)

  const [perfil, setPerfil] = useState(null)
  const [citas, setCitas] = useState([])
  const [favoritos, setFavoritos] = useState([]) // [{ negocioId, creadoEn }]
  const [resenas, setResenas] = useState([])
  const [negociosPorId, setNegociosPorId] = useState({})
  const [serviciosPorId, setServiciosPorId] = useState({})
  const [ratings, setRatings] = useState({}) // negocioId -> { suma, total } (de TODOS los clientes, para mostrar el rating de cada negocio)
  const [loading, setLoading] = useState(true)

  // El cambio de correo (Configuración) se confirma desde un enlace que
  // Firebase envía al correo nuevo, fuera de la app: cuando el correo de la
  // sesión ya no coincide con el del perfil, se actualiza el perfil.
  useEffect(() => {
    const correoSesion = currentUser?.email
    if (!uid || !perfil || !correoSesion || perfil.correo === correoSesion) return
    updateDoc(doc(db, 'usuarios', uid), { correo: correoSesion }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err)
    })
  }, [uid, perfil, currentUser])

  useEffect(() => {
    if (!uid) return
    const unsubs = [
      onSnapshot(doc(db, 'usuarios', uid), (snap) => {
        setPerfil(snap.exists() ? snap.data() : null)
        setLoading(false)
      }),
      onSnapshot(query(collection(db, 'citas'), where('clienteId', '==', uid)), (snap) => {
        setCitas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
      onSnapshot(collection(db, 'usuarios', uid, 'favoritos'), (snap) => {
        setFavoritos(snap.docs.map((d) => ({ negocioId: d.id, ...d.data() })))
      }),
      onSnapshot(
        query(collectionGroup(db, 'resenas'), where('clienteId', '==', uid)),
        (snap) => {
          setResenas(snap.docs.map((d) => ({ id: d.id, negocioId: d.ref.parent.parent.id, ...d.data() })))
        },
        // Ver el mismo comentario en ClientHome.jsx: sin este callback, un
        // índice de Firestore faltante para esta consulta queda "sin
        // capturar" en vez de solo dejar vacía la sección de reseñas propias.
        // eslint-disable-next-line no-console
        (err) => console.error('No se pudieron cargar las reseñas del cliente:', err)
      ),
      onSnapshot(collectionGroup(db, 'resenas'), (snap) => {
        const acc = {}
        snap.docs.forEach((d) => {
          const negocioId = d.ref.parent.parent.id
          const calificacion = d.data().calificacion || 0
          if (!acc[negocioId]) acc[negocioId] = { suma: 0, total: 0 }
          acc[negocioId].suma += calificacion
          acc[negocioId].total += 1
        })
        setRatings(acc)
      }),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [uid])

  // Resuelve los negocios referenciados por citas/favoritos/reseñas (join
  // simple, ya que ninguna de esas colecciones guarda los datos del negocio).
  useEffect(() => {
    const ids = new Set([
      ...citas.map((c) => c.negocioId),
      ...favoritos.map((f) => f.negocioId),
      ...resenas.map((r) => r.negocioId),
    ])
    const faltantes = [...ids].filter((id) => id && !(id in negociosPorId))
    if (faltantes.length === 0) return
    faltantes.forEach(async (negocioId) => {
      const snap = await getDoc(doc(db, 'negocios', negocioId))
      setNegociosPorId((prev) => ({ ...prev, [negocioId]: snap.exists() ? { id: negocioId, ...snap.data() } : null }))
    })
  }, [citas, favoritos, resenas, negociosPorId])

  useEffect(() => {
    const faltantes = citas
      .filter((c) => c.negocioId && c.servicioId && !(`${c.negocioId}:${c.servicioId}` in serviciosPorId))
      .map((c) => [c.negocioId, c.servicioId])
    if (faltantes.length === 0) return
    faltantes.forEach(async ([negocioId, servicioId]) => {
      const snap = await getDoc(doc(db, 'negocios', negocioId, 'servicios', servicioId))
      setServiciosPorId((prev) => ({ ...prev, [`${negocioId}:${servicioId}`]: snap.exists() ? snap.data() : null }))
    })
  }, [citas, serviciosPorId])

  async function toggleFavorito(negocioId) {
    const ref = doc(db, 'usuarios', uid, 'favoritos', negocioId)
    const yaEsFavorito = favoritos.some((f) => f.negocioId === negocioId)
    if (yaEsFavorito) {
      await deleteDoc(ref)
    } else {
      await setDoc(ref, { creadoEn: serverTimestamp() })
    }
  }

  async function cancelarCita(citaId) {
    // "canceladaPor" le permite a la agenda del negocio ocultar las citas que
    // canceló el propio cliente (ver OwnerAgenda.jsx).
    // cambiarEstadoCita además libera el turno (ver turnosOcupados.js).
    const cita = citas.find((c) => c.id === citaId)
    await cambiarEstadoCita(cita, 'cancelada', { canceladaPor: 'cliente' })
  }

  const context = useMemo(
    () => ({ uid, perfil, citas, favoritos, resenas, negociosPorId, serviciosPorId, ratings, toggleFavorito, cancelarCita }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, perfil, citas, favoritos, resenas, negociosPorId, serviciosPorId, ratings]
  )

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  if (loading) {
    return <Splash animar={false} />
  }

  const desde = perfil?.creadoEn?.toDate
    ? new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(perfil.creadoEn.toDate())
    : null

  const sidebar = (
    <aside
      style={{
        width: isMobile ? 260 : 232, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16,
        ...(isMobile && {
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 51, background: 'var(--bg)',
          padding: 16, overflowY: 'auto', boxShadow: 'var(--shadow-md)',
        }),
      }}
    >
      <div className="card" style={{ padding: 20, textAlign: 'center' }}>
        <span
          style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 700, margin: '0 auto',
          }}
        >
          {inicialesDe(perfil?.nombre || currentUser?.displayName)}
        </span>
        <div style={{ fontWeight: 800, fontSize: 15, marginTop: 10 }}>{perfil?.nombre || currentUser?.displayName}</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 5, marginBottom: 18, lineHeight: 1.4 }}>
          Cliente{desde ? ` · desde ${desde}` : ''}
        </div>
        <Link
          to="/perfil/datos"
          replace
          onClick={() => setDrawerAbierto(false)}
          className="btn btn-outline"
          style={{ width: '100%', padding: '8px 0', fontSize: 12.5 }}
        >
          Editar perfil
        </Link>
      </div>

      <nav className="card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            replace
            onClick={() => setDrawerAbierto(false)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9,
              fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              color: isActive ? 'var(--accent-hover)' : 'var(--text-muted)',
            })}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </NavLink>
        ))}
        <div style={{ height: 1, background: 'var(--border)', margin: '8px 4px' }} />
        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
            borderRadius: 9, fontSize: 13.5, fontWeight: 700, color: 'var(--danger)', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <Icon name="logout" size={16} /> Cerrar sesión
        </button>
      </nav>
    </aside>
  )

  return (
    <div>
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '14px 16px' : '14px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12,
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 18, fontWeight: 800 }}>
          <span
            style={{
              width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
            }}
          >
            MB
          </span>
          <span>
            <span style={{ color: 'var(--text)' }}>Mini</span><span style={{ color: 'var(--accent)' }}>Barrio</span>
          </span>
        </Link>
        {!isMobile && (
          <nav style={{ display: 'flex', gap: 20, fontSize: 13.5, fontWeight: 700 }}>
            <Link to="/" style={{ color: 'var(--text-muted)' }}>Inicio</Link>
            <Link to="/#resultados" style={{ color: 'var(--text-muted)' }}>Recomendados para ti</Link>
          </nav>
        )}
        {isMobile ? (
          <button
            type="button"
            onClick={() => setDrawerAbierto(true)}
            aria-label="Abrir menú"
            style={{ background: 'none', border: 'none', color: 'var(--text)', display: 'flex', padding: 4 }}
          >
            <Icon name="menu" size={22} />
          </button>
        ) : (
          <span
            style={{
              width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700,
            }}
          >
            {inicialesDe(perfil?.nombre || currentUser?.displayName)}
          </span>
        )}
      </header>

      <div
        style={{
          display: 'flex', flexDirection: isMobile ? 'column' : 'row', maxWidth: 1160, margin: '0 auto',
          gap: isMobile ? 0 : 24, padding: isMobile ? 16 : '28px 32px', alignItems: 'flex-start',
        }}
      >
        {isMobile ? (
          <>
            {drawerAbierto && (
              <div
                role="presentation"
                onClick={() => setDrawerAbierto(false)}
                style={{ position: 'fixed', inset: 0, background: 'oklch(20% 0.01 0 / 0.45)', zIndex: 50 }}
              />
            )}
            {drawerAbierto && sidebar}
          </>
        ) : (
          sidebar
        )}

        <main style={{ flex: 1, minWidth: 0, width: isMobile ? '100%' : 'auto' }}>
          <Outlet context={context} />
        </main>
      </div>
    </div>
  )
}
