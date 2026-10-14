import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import {
  collection, collectionGroup, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'
import { cambiarEstadoCita } from '../../turnosOcupados.js'
import PanelConMenu from '../../components/PanelConMenu.jsx'
import Splash from '../../components/Splash.jsx'

// Shell del panel del cliente: menú lateral de cristal (PanelConMenu.jsx,
// compartido con el panel del negocio) + los datos del perfil,
// citas, favoritos y reseñas del cliente, compartidos entre las sub-páginas
// vía Outlet context (mismo patrón que src/pages/owner/OwnerLayout.jsx).
//
// Los enlaces entre secciones del panel usan "replace": moverse entre menús
// no deja historial, así que "atrás" sale del panel a la página desde donde
// se entró (normalmente la principal) en vez de recorrer cada menú visitado.

// Menú en grupos, separados por una línea en el panel. "Ir al inicio" sale
// del panel (salir: deja historial, ver PanelConMenu.jsx).
const GRUPOS_NAV = [
  [
    { to: '/perfil', label: 'Principal', icon: 'grid', end: true },
    { to: '/perfil/citas', label: 'Mis citas', icon: 'calendar' },
  ],
  [
    { to: '/perfil/favoritos', label: 'Favoritos', icon: 'heart' },
    { to: '/perfil/resenas', label: 'Mis reseñas', icon: 'star' },
    { to: '/perfil/datos', label: 'Datos personales', icon: 'user' },
    { to: '/perfil/notificaciones', label: 'Notificaciones', icon: 'bell' },
  ],
  [
    { to: '/perfil/configuracion', label: 'Configuración', icon: 'gear' },
    { to: '/', label: 'Ir al inicio', icon: 'home', end: true, salir: true },
  ],
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

  const nombre = perfil?.nombre || currentUser?.displayName

  return (
    <PanelConMenu
      grupos={GRUPOS_NAV}
      claveColapsado="minibarrio:perfilColapsado"
      reemplazar
      centrado
      onSalir={handleLogout}
      pie={({ colapsado, alNavegar }) => (
        colapsado ? (
          <Link
            to="/perfil/datos"
            replace
            onClick={alNavegar}
            className="panel-perfil-avatar"
            title="Editar perfil"
            aria-label="Editar perfil"
          >
            {inicialesDe(nombre)}
          </Link>
        ) : (
          <div className="panel-progreso" style={{ textAlign: 'center' }}>
            <span className="panel-perfil-avatar">{inicialesDe(nombre)}</span>
            <div style={{ fontWeight: 800, fontSize: 14, marginTop: 8 }}>{nombre}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3, marginBottom: 12, lineHeight: 1.4 }}>
              Cliente{desde ? ` · desde ${desde}` : ''}
            </div>
            <Link
              to="/perfil/datos"
              replace
              onClick={alNavegar}
              className="btn btn-primary"
              style={{ display: 'block', width: '100%', padding: '8px 0', fontSize: 12.5, textAlign: 'center', color: '#fff' }}
            >
              Editar perfil
            </Link>
          </div>
        )
      )}
    >
      <Outlet context={context} />
    </PanelConMenu>
  )
}
