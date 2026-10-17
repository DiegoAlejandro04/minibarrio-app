import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'
import PanelConMenu from '../../components/PanelConMenu.jsx'
import CampanaNotificaciones from '../../components/CampanaNotificaciones.jsx'
import Splash from '../../components/Splash.jsx'
import Icon from '../../components/Icon.jsx'
import { pasosPerfil } from '../../perfilNegocio.js'
import { crearAvisoPropio } from '../../notificaciones.js'
import { leerPerfilCliente } from '../../perfilesClientes.js'
import useNotificaciones from '../../hooks/useNotificaciones.js'

// Shell del panel del comerciante: menú lateral de cristal (PanelConMenu.jsx,
// compartido con el panel del cliente) + los datos
// del negocio y sus servicios, compartidos entre las sub-páginas via
// Outlet context (evita que cada página vuelva a suscribirse a lo mismo).

// Menú en grupos, separados por una línea en el panel.
const GRUPOS_NAV = [
  [
    { to: '/panel', label: 'Resumen', icon: 'grid', end: true },
    { to: '/panel/agenda', label: 'Agenda', icon: 'calendar' },
    { to: '/panel/caja', label: 'Caja', icon: 'caja' },
  ],
  [
    { to: '/panel/servicios', label: 'Servicios', icon: 'scissors' },
    { to: '/panel/equipo', label: 'Equipo', icon: 'equipo' },
    { to: '/panel/identidad', label: 'Identidad', icon: 'store' },
    { to: '/panel/portafolio', label: 'Portafolio', icon: 'image' },
    { to: '/panel/resenas', label: 'Reseñas', icon: 'star' },
    { to: '/panel/clientes', label: 'Clientes', icon: 'users' },
  ],
  [
    { to: '/panel/configuracion', label: 'Configuración', icon: 'gear' },
  ],
]

const HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
// Con una cita "En proceso", cuánto antes de la siguiente de la misma
// persona se avisa para confirmar si se va a tiempo.
const AVISO_SIGUIENTE_MS = 15 * 60 * 1000

// "2026-10-14": id de los avisos que se crean una vez al día.
function claveDia(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "conecta-tu-instagram-o-tiktok": id del aviso de cada paso del perfil.
function claveTexto(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

export default function OwnerLayout() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const uid = currentUser?.uid
  const [negocio, setNegocio] = useState(null)
  const [servicios, setServicios] = useState([])
  const [portada, setPortada] = useState(null) // data URL de la foto de portada, ver OwnerIdentidad.jsx
  const [loading, setLoading] = useState(true)
  const [citas, setCitas] = useState([])
  const { notificaciones, idsExistentes, sinLeer, cargadas } = useNotificaciones(uid)

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
      // Solo para los avisos propios de abajo (citas de hoy y por cerrar).
      onSnapshot(query(collection(db, 'citas'), where('negocioId', '==', uid)), (snap) => {
        setCitas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [uid])

  // Barra "Perfil al X%": cuánto está completo y cuál es el siguiente paso
  // concreto (con enlace a dónde se hace), en vez de un consejo genérico.
  const pasos = useMemo(() => pasosPerfil(negocio, servicios, !!portada), [negocio, servicios, portada])
  const perfilCompletado = pasos.length ? Math.round((pasos.filter((p) => p.listo).length / pasos.length) * 100) : 0
  const siguientePaso = pasos.find((p) => !p.listo)

  // Avisos propios del negocio, creados al abrir el panel con un id fijo para
  // no repetirlos (ver notificaciones.js): las citas de hoy y las ya pasadas
  // sin cerrar (uno por día), y el siguiente paso para completar el perfil.
  useEffect(() => {
    if (!uid || !cargadas || !negocio) return
    // Incluye las ocultas, para no volver a crear las que se eliminaron.
    const existentes = idsExistentes
    const ahora = new Date()
    const hoy = claveDia(ahora)
    const conFecha = citas
      .map((c) => ({ ...c, fecha: c.fechaHora?.toDate?.() }))
      .filter((c) => c.fecha && c.estado !== 'cancelada')

    const deHoy = conFecha
      .filter((c) => claveDia(c.fecha) === hoy)
      .sort((a, b) => a.fecha - b.fecha)
    if (deHoy.length > 0) {
      crearAvisoPropio(uid, `citas-hoy-${hoy}`, {
        tipo: 'citas-hoy',
        titulo: `Hoy tienes ${deHoy.length} cita${deHoy.length === 1 ? '' : 's'}`,
        texto: `La primera es a las ${HORA.format(deHoy[0].fecha)}. Revisa tu agenda del día.`,
        enlace: '/panel/agenda',
      }, existentes)
    }

    const porCerrar = conFecha.filter((c) => c.fecha < ahora && c.estado !== 'completada')
    if (porCerrar.length > 0) {
      crearAvisoPropio(uid, `citas-por-cerrar-${hoy}`, {
        tipo: 'citas-por-cerrar',
        titulo: `${porCerrar.length} cita${porCerrar.length === 1 ? '' : 's'} por cerrar`,
        texto: `Ya pasaron y no las has marcado como completadas. Al marcarlas, el cliente recibe la invitación a calificarte.`,
        enlace: '/panel/agenda',
      }, existentes)
    }

    if (siguientePaso) {
      crearAvisoPropio(uid, `perfil-${claveTexto(siguientePaso.texto)}`, {
        tipo: 'perfil',
        titulo: `Tu perfil está al ${perfilCompletado}%`,
        texto: `Siguiente paso: ${siguientePaso.texto}.`,
        enlace: siguientePaso.ruta,
      }, existentes)
    }
  }, [uid, cargadas, idsExistentes, negocio, citas, siguientePaso, perfilCompletado])

  // Aviso "tu próxima cita es en 15 minutos": mientras haya una cita En
  // proceso, revisa cada 30 s si la siguiente de esa misma persona (o del
  // negocio, sin equipo) empieza dentro de 15 minutos. Al tocarlo, la Agenda
  // pregunta si va a tiempo o si hay un contratiempo (OwnerAgenda.jsx).
  const [reloj, setReloj] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setReloj(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  const avisosEnCamino = useRef(new Set())
  useEffect(() => {
    if (!uid || !cargadas) return
    const conFecha = citas
      .map((c) => ({ ...c, fecha: c.fechaHora?.toDate?.() }))
      .filter((c) => c.fecha)
    const persona = (c) => c.profesionalId || ''
    conFecha.filter((c) => c.estado === 'en-proceso').forEach((actual) => {
      const siguiente = conFecha
        .filter((c) => c.estado === 'pendiente'
          && persona(c) === persona(actual)
          && c.fecha > actual.fecha
          && claveDia(c.fecha) === claveDia(actual.fecha))
        .sort((a, b) => a.fecha - b.fecha)[0]
      if (!siguiente) return
      const falta = siguiente.fecha.getTime() - reloj
      if (falta <= 0 || falta > AVISO_SIGUIENTE_MS) return
      const id = `siguiente-cita-${siguiente.id}`
      if (idsExistentes.has(id) || avisosEnCamino.current.has(id)) return
      avisosEnCamino.current.add(id)
      leerPerfilCliente(uid, siguiente.clienteId, { citaId: siguiente.id })
        .catch(() => null)
        .then((perfil) => {
          const minutos = Math.max(1, Math.round((siguiente.fecha.getTime() - Date.now()) / 60000))
          crearAvisoPropio(uid, id, {
            tipo: 'siguiente-cita',
            titulo: `En ${minutos} min tienes cita con ${perfil?.nombre || 'tu cliente'}`,
            texto: `Es a las ${HORA.format(siguiente.fecha)}${siguiente.profesionalNombre ? `, con ${siguiente.profesionalNombre}` : ''}. Toca aquí para confirmar si vas a tiempo con la cita en proceso.`,
            enlace: `/panel/agenda?siguiente=${siguiente.id}`,
            citaId: siguiente.id,
          }, idsExistentes)
        })
    })
  }, [uid, cargadas, idsExistentes, citas, reloj])

  async function handleLogout() {
    // A la vitrina (se puede ver sin cuenta), no al formulario de login, con
    // un aviso breve (AvisoFlotante.jsx). Primero se navega y luego se cierra
    // la sesión: al revés, los paneles protegidos (ProtectedRoute) alcanzan a
    // saltar un instante a /login.
    navigate('/', { state: { aviso: { titulo: 'Sesión cerrada', texto: '¡Vuelve pronto! Puedes seguir viendo los negocios del barrio.' } } })
    await logout()
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
      // Arriba a la derecha en todas las secciones del panel: "Ver como
      // cliente" (abre el portafolio público, con la franja de vista previa
      // de NegocioDetalle.jsx) y la campana.
      acciones={(
        <>
          <Link to={`/negocio/${uid}`} className="boton-ver-cliente" title="Ver tu portafolio como lo ven los clientes">
            <Icon name="eye" size={17} />
            <span>Ver como cliente</span>
          </Link>
          <CampanaNotificaciones uid={uid} notificaciones={notificaciones} sinLeer={sinLeer} />
        </>
      )}
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
