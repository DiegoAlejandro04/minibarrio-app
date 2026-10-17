import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'
import Icon from '../../components/Icon.jsx'
import CalificarModal from '../../components/CalificarModal.jsx'
import { nombreCorto } from '../../nombres.js'
import { enlaceInstagram, enlaceTiktok, etiquetaMetodoPago } from '../../perfilNegocio.js'
import { acortarDireccion } from '../../maps/direcciones.js'
import { usePortafolio } from '../../portafolio.js'
import Splash from '../../components/Splash.jsx'
import { MINUTOS_TURNO, reservarCita } from '../../turnosOcupados.js'
import { textoFechaCita } from '../../notificaciones.js'
import { bloqueDelDia, estadoApertura, formatoHora12, resumenHorario } from '../../horarios.js'
import ReciboCita from '../../components/ReciboCita.jsx'
import useIsMobile from '../../hooks/useIsMobile.js'
import useEquipo from '../../hooks/useEquipo.js'
import AvatarProfesional from '../../components/AvatarProfesional.jsx'
import {
  disponibilidadAgenda, disponibilidadCualquiera, disponibilidadProfesional, equipoDelDia, ocupadosDelDia,
  almuerzoDe, primerNombre, resumenHorario as horarioPersona, textoRango, trabajaEl, ventanaProfesional,
} from '../../equipo.js'

// Perfil público del negocio + reserva de citas (RF-05, RF-06, RF-07, RF-08,
// RF-10). La reserva exige al menos un día de anticipación (no el mismo
// día), turnos cada 20 minutos dentro del horario de atención del negocio,
// y descarta los turnos ya ocupados (ver turnosOcupados.js). El panel del
// comerciante (Resumen, Clientes, Servicios) ya escucha "citas" con
// onSnapshot, así que una reserva nueva se refleja ahí en tiempo real sin
// cambios adicionales.

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const SERVICIOS_VISIBLES = 6
const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
const DIA_SEMANA_CORTO = new Intl.DateTimeFormat('es-CO', { weekday: 'short' })
const MES_CORTO = new Intl.DateTimeFormat('es-CO', { month: 'short' })
// Días que se ofrecen para reservar, desde mañana.
const DIAS_RESERVABLES = 14

function toDateInputValue(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function generarSlots(bloque) {
  if (!bloque?.apertura || !bloque?.cierre) return []
  const [hA, mA] = bloque.apertura.split(':').map(Number)
  const [hC, mC] = bloque.cierre.split(':').map(Number)
  const inicio = hA * 60 + mA
  const fin = hC * 60 + mC
  const slots = []
  for (let m = inicio; m < fin; m += 20) {
    const h = String(Math.floor(m / 60)).padStart(2, '0')
    const min = String(m % 60).padStart(2, '0')
    slots.push(`${h}:${min}`)
  }
  return slots
}

const ESTADO_APERTURA_STYLES = {
  abierto: { label: 'Abierto', color: 'var(--sage-text)' },
  'cierra-pronto': { label: 'Cierra pronto', color: 'var(--warning-text)' },
  cerrado: { label: 'Cerrado', color: 'var(--text-faint)' },
}

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'resenas', label: 'Reseñas' },
  { value: 'horarios', label: 'Horarios' },
]

export default function NegocioDetalle() {
  const { id } = useParams()
  const { currentUser, role } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [negocio, setNegocio] = useState(null)
  const [servicios, setServicios] = useState([])
  const [resenas, setResenas] = useState([])
  // Foto de portada: va en su propio documento (ver OwnerIdentidad.jsx), así
  // la vitrina no la descarga para todos los negocios.
  const [portada, setPortada] = useState(null)
  const [ocupadosDocs, setOcupadosDocs] = useState([]) // turnos tomados: [{ id, fechaHora: Date }]
  const [loading, setLoading] = useState(true)

  const manana = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d
  }, [])
  const minFecha = useMemo(() => toDateInputValue(manana), [manana])

  const [servicioId, setServicioId] = useState(null)
  // Con muchos servicios se muestran los primeros SERVICIOS_VISIBLES y un
  // botón para ver el resto: 10 filas empujaban los "Trabajos" muy abajo.
  const [verTodosServicios, setVerTodosServicios] = useState(false)
  const [fecha, setFecha] = useState(minFecha)
  const [hora, setHora] = useState(null)
  // Con equipo: con quién reservar ('cualquiera' = la primera persona libre).
  const [profesionalId, setProfesionalId] = useState('cualquiera')
  const [reservando, setReservando] = useState(false)
  const [error, setError] = useState('')
  const [citaConfirmada, setCitaConfirmada] = useState(null) // datos del comprobante (ReciboCita)
  const [galeriaAbierta, setGaleriaAbierta] = useState(false)
  const [turnosExpandidos, setTurnosExpandidos] = useState(false)
  const [tab, setTab] = useState('general')
  const [esFavorito, setEsFavorito] = useState(false)
  const [calificando, setCalificando] = useState(false)

  useEffect(() => {
    const unsubs = [
      onSnapshot(doc(db, 'negocios', id), (snap) => {
        setNegocio(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      }),
      onSnapshot(collection(db, 'negocios', id, 'servicios'), (snap) => {
        setServicios(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.visible !== false))
      }),
      onSnapshot(collection(db, 'negocios', id, 'resenas'), (snap) => {
        setResenas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
      onSnapshot(doc(db, 'negocios', id, 'medios', 'portada'), (snap) => {
        setPortada(snap.exists() ? snap.data().imagen : null)
      }, () => setPortada(null)),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [id])

  // Registra la visita al perfil (solo clientes, una vez por cliente): crea
  // un marcador en negocios/{id}/visitas/{clienteId}. Las reglas de Firestore
  // solo permiten "create" ahí (no "update"), así que un mismo cliente jamás
  // puede duplicar su propia visita aunque vuelva a entrar varias veces.
  useEffect(() => {
    if (!currentUser || role !== 'cliente') return
    const visitaRef = doc(db, 'negocios', id, 'visitas', currentUser.uid)
    getDoc(visitaRef)
      .then((snap) => {
        if (snap.exists()) return undefined
        return setDoc(visitaRef, { visitadoEn: serverTimestamp() })
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err)
      })
  }, [currentUser, role, id])

  // Estado de favorito (RF análogo a "guardar barbería"): un marcador por
  // cliente en usuarios/{uid}/favoritos/{negocioId}, ver firestore.rules.
  useEffect(() => {
    if (!currentUser || role !== 'cliente') {
      setEsFavorito(false)
      return undefined
    }
    const unsub = onSnapshot(doc(db, 'usuarios', currentUser.uid, 'favoritos', id), (snap) => {
      setEsFavorito(snap.exists())
    })
    return unsub
  }, [currentUser, role, id])

  async function handleToggleFavorito() {
    if (!currentUser) {
      navigate('/login', { state: { from: { pathname: `/negocio/${id}` } } })
      return
    }
    const ref = doc(db, 'usuarios', currentUser.uid, 'favoritos', id)
    if (esFavorito) {
      await deleteDoc(ref)
    } else {
      await setDoc(ref, { creadoEn: serverTimestamp() })
    }
  }

  // Turnos ya tomados de este negocio: solo su fecha y hora, sin datos de
  // quién reservó (ver turnosOcupados.js). Las citas de otros clientes ya no
  // se pueden leer desde aquí.
  useEffect(() => {
    if (!currentUser) {
      setOcupadosDocs([])
      return undefined
    }
    // El id del turno dice de quién es la agenda ("{ms}_{profesionalId}",
    // ver turnosOcupados.js).
    const unsub = onSnapshot(collection(db, 'negocios', id, 'ocupados'), (snap) => {
      setOcupadosDocs(snap.docs.map((d) => ({ id: d.id, fechaHora: d.data().fechaHora?.toDate?.() || null })))
    })
    return unsub
  }, [currentUser, id])

  // Fotos del portafolio (subidas + antiguas por enlace), ver portafolio.js.
  // Va antes de los return tempranos (cargando / no encontrado): es un hook.
  const { fotos: fotosPortafolio } = usePortafolio(negocio)

  // Citas del propio cliente en este negocio: la reseña solo se habilita con
  // una que ya pasó y no se canceló (reseña verificada, ver firestore.rules).
  const [misCitas, setMisCitas] = useState([])
  useEffect(() => {
    if (!currentUser || role !== 'cliente') {
      setMisCitas([])
      return undefined
    }
    const consulta = query(collection(db, 'citas'), where('clienteId', '==', currentUser.uid), where('negocioId', '==', id))
    const unsub = onSnapshot(consulta, (snap) => setMisCitas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [currentUser, role, id])
  const citaParaResenar = useMemo(() => {
    const ahora = Date.now()
    return misCitas
      .filter((c) => c.estado !== 'cancelada' && c.fechaHora?.toMillis && c.fechaHora.toMillis() < ahora)
      .sort((a, b) => b.fechaHora.toMillis() - a.fechaHora.toMillis())[0] || null
  }, [misCitas])

  const rating = useMemo(() => {
    if (resenas.length === 0) return null
    return resenas.reduce((sum, r) => sum + (r.calificacion || 0), 0) / resenas.length
  }, [resenas])

  const yaCalifique = useMemo(
    () => !!currentUser && resenas.some((r) => r.clienteId === currentUser.uid),
    [resenas, currentUser]
  )

  const servicioSeleccionado = useMemo(
    () => servicios.find((s) => s.id === servicioId) || null,
    [servicios, servicioId]
  )

  // Equipo del negocio (ver equipo.js): solo las personas activas se pueden
  // elegir. Sin equipo, el negocio tiene una sola agenda, como antes.
  const { equipo } = useEquipo(id)
  const equipoActivo = useMemo(() => equipo.filter((p) => p.activo !== false), [equipo])
  const conEquipo = equipoActivo.length > 0
  const profesionalElegido = conEquipo && profesionalId !== 'cualquiera'
    ? equipoActivo.find((p) => p.id === profesionalId) || null
    : null
  // Si la persona elegida sale del equipo o se pausa, vuelve a "Cualquiera".
  useEffect(() => {
    if (profesionalId !== 'cualquiera' && conEquipo && !equipoActivo.some((p) => p.id === profesionalId)) setProfesionalId('cualquiera')
  }, [profesionalId, conEquipo, equipoActivo])

  // Próximos días para reservar (desde mañana), con si se puede ese día: el
  // negocio abre y, con equipo, la persona elegida (o alguien) trabaja ese
  // día y su horario cae dentro del horario del negocio.
  const diasReserva = useMemo(() => Array.from({ length: DIAS_RESERVABLES }, (_, i) => {
    const d = new Date(manana)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    const bloque = bloqueDelDia(negocio?.horarios, d)
    const slots = generarSlots(bloque)
    const atiendeEse = (p) => trabajaEl(p, d) && ventanaProfesional(p, slots, bloque?.cierre, d).slots.length > 0
    const atiende = !conEquipo || (profesionalElegido ? atiendeEse(profesionalElegido) : equipoActivo.some(atiendeEse))
    return { fecha: d, valor: toDateInputValue(d), disponible: !!bloque && atiende }
  }), [manana, negocio, conEquipo, profesionalElegido, equipoActivo])

  // Fila de días: las flechas (solo con mouse) la corren casi un ancho
  // completo, y se apagan al llegar a cada extremo.
  const diasRef = useRef(null)
  const [bordesDias, setBordesDias] = useState({ inicio: true, fin: false })
  function actualizarBordesDias() {
    const el = diasRef.current
    if (!el) return
    const inicio = el.scrollLeft <= 2
    const fin = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
    setBordesDias((prev) => (prev.inicio === inicio && prev.fin === fin ? prev : { inicio, fin }))
  }
  function moverDias(direccion) {
    const el = diasRef.current
    if (el) el.scrollBy({ left: direccion * el.clientWidth * 0.8 })
  }
  useEffect(() => {
    actualizarBordesDias()
    window.addEventListener('resize', actualizarBordesDias)
    return () => window.removeEventListener('resize', actualizarBordesDias)
  }, [diasReserva])

  // Si el día elegido deja de servir (otra persona elegida), pasa al primero
  // que sí.
  useEffect(() => {
    const actual = diasReserva.find((d) => d.valor === fecha)
    if (actual?.disponible) return
    const primero = diasReserva.find((d) => d.disponible)
    if (primero && primero.valor !== fecha) {
      setFecha(primero.valor)
      setHora(null)
    }
  }, [diasReserva, fecha])

  const fechaObj = useMemo(() => new Date(`${fecha}T00:00:00`), [fecha])
  const bloqueHorario = useMemo(() => bloqueDelDia(negocio?.horarios, fechaObj), [negocio, fechaObj])
  const equipoHoy = useMemo(() => equipoDelDia(equipoActivo, fechaObj), [equipoActivo, fechaObj])
  const slotsNegocio = useMemo(() => generarSlots(bloqueHorario), [bloqueHorario])

  const ocupados = useMemo(() => ocupadosDelDia(ocupadosDocs, fecha), [ocupadosDocs, fecha])

  // Turnos que se ofrecen y si cabe en cada uno la duración COMPLETA del
  // servicio elegido, en la agenda que corresponde: la de la persona elegida
  // (solo dentro de su horario), la de alguien del equipo ("Cualquiera",
  // sumando los horarios de todos) o la única del negocio. Ver equipo.js.
  const { slotsDelDia, disponibilidad, asignarProfesional } = useMemo(() => {
    const duracion = servicioSeleccionado?.duracionMinutos || MINUTOS_TURNO
    const cierre = bloqueHorario?.cierre
    if (!conEquipo) {
      // Sin equipo cuenta cualquier turno tomado (también los de personas
      // que ya no están en el equipo).
      const todos = new Set([...ocupados.general, ...[...ocupados.porProfesional.values()].flatMap((s) => [...s])])
      return { slotsDelDia: slotsNegocio, disponibilidad: disponibilidadAgenda(slotsNegocio, todos, duracion, cierre), asignarProfesional: () => null }
    }
    if (profesionalElegido) {
      if (!trabajaEl(profesionalElegido, fechaObj)) return { slotsDelDia: [], disponibilidad: new Map(), asignarProfesional: () => null }
      const { slots, mapa } = disponibilidadProfesional(profesionalElegido, slotsNegocio, ocupados, duracion, cierre, fechaObj)
      return { slotsDelDia: slots, disponibilidad: mapa, asignarProfesional: () => profesionalElegido }
    }
    const { slots, mapa, asignar } = disponibilidadCualquiera(slotsNegocio, ocupados, equipoHoy, duracion, cierre, fechaObj)
    return { slotsDelDia: slots, disponibilidad: mapa, asignarProfesional: asignar }
  }, [slotsNegocio, ocupados, servicioSeleccionado, bloqueHorario, conEquipo, profesionalElegido, equipoHoy, fechaObj])

  // Si al cambiar de servicio la hora elegida deja de caber, se deselecciona.
  useEffect(() => {
    if (hora && disponibilidad.get(hora) !== 'libre') setHora(null)
  }, [hora, disponibilidad])

  const estado = negocio ? estadoApertura(negocio.horarios) : null

  function elegirFecha(valor) {
    setFecha(valor)
    setHora(null)
    setTurnosExpandidos(false)
  }

  function elegirProfesional(valor) {
    setProfesionalId(valor)
    setHora(null)
    setCitaConfirmada(null)
  }

  // Al confirmar, el comprobante aparece debajo del panel — se desplaza la
  // vista hacia él para que el cliente vea la animación de impresión.
  const reciboRef = useRef(null)
  useEffect(() => {
    if (citaConfirmada) reciboRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [citaConfirmada])

  async function handleConfirmar() {
    if (!currentUser) {
      navigate('/login', { state: { from: { pathname: `/negocio/${id}` } } })
      return
    }
    if (role !== 'cliente') {
      setError('Solo las cuentas de cliente pueden reservar citas.')
      return
    }
    if (!servicioSeleccionado || !hora) return

    // Con equipo, la cita va a la agenda de la persona elegida o, con
    // "Cualquiera", de la primera libre a esa hora.
    const profesional = conEquipo ? asignarProfesional(hora) : null
    if (conEquipo && !profesional) {
      setError('Ese horario ya no está libre. Elige otro.')
      return
    }
    const conQuien = profesional ? ` con ${primerNombre(profesional.nombre)}` : ''

    setError('')
    setReservando(true)
    try {
      const fechaHora = new Date(`${fecha}T${hora}:00`)
      const cuando = textoFechaCita(fechaHora)
      const ref = await reservarCita({
        negocioId: id,
        clienteId: currentUser.uid,
        servicioId: servicioSeleccionado.id,
        fechaHora,
        duracionMinutos: servicioSeleccionado.duracionMinutos,
        profesional: profesional ? { id: profesional.id, nombre: profesional.nombre } : null,
        // Notificaciones: al negocio, la reserva nueva; al cliente, su
        // confirmación (ver notificaciones.js).
        avisos: [
          {
            destinatarioId: id,
            tipo: 'nueva-reserva',
            titulo: 'Nueva reserva',
            texto: `${currentUser.displayName || 'Un cliente'} reservó ${servicioSeleccionado.nombre}${conQuien} para el ${cuando}.`,
            enlace: '/panel/agenda',
          },
          {
            destinatarioId: currentUser.uid,
            tipo: 'reserva-confirmada',
            titulo: 'Reserva confirmada',
            texto: `Reservaste ${servicioSeleccionado.nombre}${conQuien} en ${negocio.nombre} para el ${cuando}.`,
            enlace: '/perfil/citas',
          },
        ],
      })
      setCitaConfirmada({
        id: ref.id,
        negocio: negocio.nombre,
        direccion: negocio.direccion,
        servicio: servicioSeleccionado.nombre,
        duracionMinutos: servicioSeleccionado.duracionMinutos,
        precio: servicioSeleccionado.precio,
        profesional: profesional?.nombre || null,
        fechaHora,
        reservadaEn: new Date(),
      })
      setHora(null)
    } catch (err) {
      // Las reglas rechazan la reserva si otra persona tomó ese turno justo
      // antes (ver turnosOcupados.js).
      setError(err.code === 'permission-denied'
        ? 'Ese horario se cruza con otra cita que acaban de reservar. Elige otro.'
        : 'No se pudo confirmar la cita. Intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setReservando(false)
    }
  }

  if (loading) return <Splash animar={false} />

  if (!negocio) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Negocio no encontrado</div>
        <Link to="/" style={{ fontWeight: 700 }}>Volver a la vitrina</Link>
      </div>
    )
  }

  const fotos = fotosPortafolio
  const servicioDe = (foto) => foto.servicioId && servicios.find((s) => s.id === foto.servicioId)
  const whatsapp = negocio.canalesContacto?.whatsapp
  const instagram = negocio.canalesContacto?.instagram
  const tiktok = negocio.canalesContacto?.tiktok
  const metodosPago = negocio.metodosPago || []

  // El dueño viendo su propio portafolio (botón "Ver como cliente" del
  // panel): una franja arriba le recuerda que es la vista pública y lo
  // devuelve al panel.
  const esMiNegocio = !!currentUser && currentUser.uid === id

  return (
    <div className="vitrina">
      {/* Manchas de color de fondo para el cristal (ver .vitrina en index.css). */}
      <div className="vitrina-fondo" aria-hidden="true"><span /><span /><span /><span /></div>
      {esMiNegocio && (
        <div className="franja-vista-cliente" role="status">
          <span className="franja-vista-cliente__icono" aria-hidden="true"><Icon name="eye" size={16} /></span>
          <span className="franja-vista-cliente__texto">
            <strong>Vista de cliente</strong>
            <span> · Así ven tu negocio los clientes</span>
          </span>
          <Link to="/panel" className="franja-vista-cliente__volver">
            <Icon name="arrowLeft" size={15} /> Volver al panel
          </Link>
        </div>
      )}
      <div className="vitrina-portada" style={{ padding: isMobile ? '18px 16px 20px' : '24px 32px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* En la vista de cliente del dueño sobra: ya tiene "Volver al panel"
              en la franja de arriba. */}
          {!esMiNegocio && <Link to="/" className="vitrina-volver">← Volver a la vitrina</Link>}

          {portada ? (
            <div style={{ position: 'relative', marginTop: 14 }}>
              <img
                src={portada}
                alt={`Portada de ${negocio.nombre}`}
                style={{ width: '100%', aspectRatio: '3 / 1', maxHeight: 340, objectFit: 'cover', borderRadius: 'var(--radius-lg)', display: 'block' }}
              />
              {fotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setGaleriaAbierta(true)}
                  style={{
                    position: 'absolute', right: 12, bottom: 12, fontSize: 12.5, fontWeight: 700, padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)', background: 'oklch(15% 0.01 50 / 0.65)', border: '1px solid oklch(100% 0 0 / 0.25)',
                    color: '#fff', cursor: 'pointer', backdropFilter: 'blur(4px)',
                  }}
                >
                  Ver fotos de trabajos ({fotos.length})
                </button>
              )}
            </div>
          ) : fotos.length === 0 ? (
            <div
              style={{
                marginTop: 14, height: 180, borderRadius: 'var(--radius-lg)', background: 'var(--vidrio)',
                border: '1px solid var(--vidrio-borde)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13,
              }}
            >
              Este negocio aún no ha publicado fotos
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setGaleriaAbierta(true)}
                  style={{
                    fontSize: 12.5, fontWeight: 700, padding: '8px 16px', borderRadius: 999,
                    background: 'var(--vidrio-campo)', border: '1px solid var(--vidrio-borde)', color: 'var(--text)', cursor: 'pointer',
                  }}
                >
                  Mostrar todas las fotos{fotos.length > 1 ? ` (${fotos.length})` : ''}
                </button>
              </div>

              {/* Fila "justificada" centrada: cada foto conserva su proporción
                  real (alto fijo, ancho automático) en vez de recortarse. */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {fotos.slice(0, 3).map((f) => (
                  <img
                    key={f.id}
                    src={f.imagen}
                    alt={f.titulo || ''}
                    title={f.titulo || undefined}
                    style={{ height: isMobile ? 160 : 240, width: 'auto', maxWidth: '100%', borderRadius: 'var(--radius-md)', objectFit: 'contain', flexShrink: 0 }}
                    onError={(e) => { e.currentTarget.style.opacity = 0.15 }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {galeriaAbierta && (
        <div
          role="presentation"
          className="ventana-velo"
          onClick={() => setGaleriaAbierta(false)}
          style={{
            position: 'fixed', inset: 0, background: 'oklch(20% 0.01 0 / 0.6)', zIndex: 1300,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card ventana-vidrio"
            style={{ width: '100%', maxWidth: 900, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Fotos de {negocio.nombre} ({fotos.length})</div>
              <button
                type="button"
                onClick={() => setGaleriaAbierta(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto' }}>
              <div style={{ columns: '220px 3', columnGap: 10 }}>
                {fotos.map((f) => {
                  const servicio = servicioDe(f)
                  return (
                    // Cada foto con su texto y el servicio que muestra (con
                    // precio): así la foto también vende.
                    <figure key={f.id} style={{ margin: '0 0 12px', breakInside: 'avoid' }}>
                      <img
                        src={f.imagen}
                        alt={f.titulo || ''}
                        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'var(--radius-sm)' }}
                        onError={(e) => { e.currentTarget.style.opacity = 0.15 }}
                      />
                      {(f.titulo || servicio) && (
                        <figcaption style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, marginTop: 6 }}>
                          <span style={{ fontWeight: 700 }}>{f.titulo || servicio?.nombre}</span>
                          {servicio && <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{f.titulo ? `${servicio.nombre} · ` : ''}{COP.format(servicio.precio || 0)}</span>}
                        </figcaption>
                      )}
                    </figure>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '18px 16px 40px' : '24px 32px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {negocio.logo && (
          <img
            src={negocio.logo}
            alt={`Logo de ${negocio.nombre}`}
            style={{
              width: isMobile ? 56 : 72, height: isMobile ? 56 : 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
              boxShadow: '0 0 0 3px var(--bg), 0 0 0 5px var(--accent)',
            }}
          />
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{negocio.nombre}</div>
            {negocio.verificado && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sage-text)', background: 'var(--sage-soft)', padding: '3px 9px', borderRadius: 999 }}>
                Verificado
              </span>
            )}
            {role !== 'propietario' && (
              <button
                type="button"
                onClick={handleToggleFavorito}
                title={esFavorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2,
                  color: esFavorito ? 'var(--danger)' : 'var(--text-faint)',
                }}
              >
                <Icon name="heart" size={19} filled={esFavorito} />
              </button>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {rating ? <span>★ {rating.toFixed(1)} ({resenas.length} reseñas)</span> : <span>Sin reseñas aún</span>}
            <span>·</span>
            <span title={negocio.direccion}>{acortarDireccion(negocio.direccion || '')}</span>
            {estado && (
              <>
                <span>·</span>
                <span style={{ color: ESTADO_APERTURA_STYLES[estado].color, fontWeight: 700 }}>{ESTADO_APERTURA_STYLES[estado].label}</span>
              </>
            )}
          </div>
          {negocio.descripcion && <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 8, maxWidth: 560 }}>{negocio.descripcion}</p>}
          {negocio.especialidades?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {negocio.especialidades.map((especialidad) => (
                <span
                  key={especialidad}
                  style={{
                    fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                    background: 'var(--accent-soft)', color: 'var(--accent-hover)',
                  }}
                >
                  {especialidad}
                </span>
              ))}
            </div>
          )}
          {metodosPago.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 700, marginRight: 2 }}>Aceptamos</span>
              {metodosPago.map((m) => (
                <span key={m} style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  {etiquetaMetodoPago(m)}
                </span>
              ))}
            </div>
          )}
          {(instagram || tiktok) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {instagram && (
                <a href={enlaceInstagram(instagram)} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12.5 }}>
                  Instagram · @{instagram}
                </a>
              )}
              {tiktok && (
                <a href={enlaceTiktok(tiktok)} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12.5 }}>
                  TikTok · @{tiktok}
                </a>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      <nav style={{ display: 'flex', gap: 22, marginTop: 18, borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px',
              color: tab === t.value ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: tab === t.value ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: 24, marginTop: 24, alignItems: 'start' }}>
        <div>
          {tab === 'general' && (
            <>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Servicios y precios</div>
              <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginBottom: 14 }}>Selecciona un servicio para reservar.</p>

              {servicios.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Este negocio todavía no ha publicado servicios.</p>
              ) : (
                // Filas a todo el ancho, como una carta de precios: con uno o con
                // diez servicios la columna queda llena (en dos columnas, un solo
                // servicio dejaba media columna vacía).
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {servicios
                    // Plegada, igual se muestra el seleccionado aunque esté
                    // más abajo de los primeros.
                    .filter((s, i) => verTodosServicios || i < SERVICIOS_VISIBLES || s.id === servicioId)
                    .map((s) => {
                    const seleccionado = s.id === servicioId
                    // Foto del servicio: la suya, o una del portafolio etiquetada
                    // con este servicio (ver OwnerPortafolio.jsx).
                    const foto = s.fotoUrl || fotos.find((f) => f.servicioId === s.id)?.imagen
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setServicioId(s.id); setHora(null); setCitaConfirmada(null) }}
                        className={`card servicio-fila${seleccionado ? ' servicio-fila--activo' : ''}`}
                        aria-pressed={seleccionado}
                      >
                        {foto ? (
                          <img src={foto} alt="" className="servicio-fila__foto" />
                        ) : (
                          <span className="servicio-fila__icono" aria-hidden="true"><Icon name="scissors" size={20} /></span>
                        )}
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 800, fontSize: 14.5 }}>{s.nombre}</span>
                          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                            {s.descripcion || `${s.duracionMinutos} min`}
                          </span>
                        </span>
                        <span style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{COP.format(s.precio || 0)}</span>
                          {s.descripcion && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{s.duracionMinutos} min</span>}
                        </span>
                        <span className="servicio-fila__marca" aria-hidden="true">{seleccionado && <Icon name="check" size={13} />}</span>
                      </button>
                    )
                  })}
                  {servicios.length > SERVICIOS_VISIBLES && (
                    <button type="button" className="servicios-mas" onClick={() => setVerTodosServicios((v) => !v)} aria-expanded={verTodosServicios}>
                      {verTodosServicios ? 'Ver menos ▴' : `Ver los ${servicios.length} servicios ▾`}
                    </button>
                  )}
                </div>
              )}

              {fotos.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>Trabajos</div>
                    {fotos.length > 6 && (
                      <button type="button" onClick={() => setGaleriaAbierta(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0 }}>
                        Ver las {fotos.length} fotos
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                    {fotos.slice(0, 6).map((f) => {
                      const servicio = servicioDe(f)
                      const texto = f.titulo || servicio?.nombre
                      return (
                        <button key={f.id} type="button" className="trabajo-mini" onClick={() => setGaleriaAbierta(true)} aria-label={texto || 'Ver foto'}>
                          <img src={f.imagen} alt={texto || ''} onError={(e) => { e.currentTarget.style.opacity = 0.15 }} />
                          {texto && <span className="trabajo-mini__texto">{texto}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'resenas' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, fontSize: 17 }}>Reseñas de clientes</div>
                {role !== 'propietario' && (
                  yaCalifique ? (
                    <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 700 }}>Ya calificaste este negocio</span>
                  ) : currentUser && !citaParaResenar ? (
                    <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 700, textAlign: 'right' }}>
                      Podrás calificar este negocio después de tu cita
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentUser) {
                          navigate('/login', { state: { from: { pathname: `/negocio/${id}` } } })
                          return
                        }
                        setCalificando(true)
                      }}
                      className="btn btn-outline"
                      style={{ padding: '7px 14px', fontSize: 12.5 }}
                    >
                      {currentUser ? 'Escribir una reseña' : 'Inicia sesión para calificar'}
                    </button>
                  )
                )}
              </div>
              {resenas.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 8 }}>Este negocio todavía no tiene reseñas.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                  {resenas.slice(0, 5).map((r) => (
                    <div key={r.id} className="card" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5 }}>★ {r.calificacion || 0}</span>
                          {/* Por privacidad no se muestra quién escribió la reseña. */}
                          {r.citaId && <span className="resena-verificada">✓ Verificada</span>}
                        </span>
                        {r.creadoEn?.toDate && (
                          <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                            {new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(r.creadoEn.toDate())}
                          </span>
                        )}
                      </div>
                      {r.comentario && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{r.comentario}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'horarios' && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14 }}>Horario de atención</div>
              {resumenHorario(negocio.horarios).length > 0 ? (
                <div className="card" style={{ padding: 18, maxWidth: 360 }}>
                  {resumenHorario(negocio.horarios).map((fila) => (
                    <div key={fila.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '5px 0', color: 'var(--text-muted)' }}>
                      <span>{fila.label}</span>
                      <span style={{ color: fila.bloque ? undefined : 'var(--text-faint)', textAlign: 'right' }}>
                        {fila.bloque ? `${formatoHora12(fila.bloque.apertura)} – ${formatoHora12(fila.bloque.cierre)}` : 'Cerrado'}
                      </span>
                    </div>
                  ))}
                  {negocio.canalesContacto?.telefono && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      {negocio.canalesContacto.telefono}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Este negocio todavía no publicó su horario de atención.</p>
              )}
            </div>
          )}
        </div>

        {/* Con el comprobante abierto el panel queda más alto que la pantalla:
            si siguiera "sticky", la parte de abajo del recibo nunca se vería.
            minWidth 0: las filas deslizables de personas y días no deben
            ensanchar la columna. */}
        {(!isMobile || tab === 'general') && (
        <div style={isMobile || citaConfirmada ? { minWidth: 0 } : { position: 'sticky', top: 20, minWidth: 0 }}>
        <div className="card" style={{ padding: 20, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Servicio seleccionado</div>
          {servicioSeleccionado ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{servicioSeleccionado.nombre}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                {servicioSeleccionado.duracionMinutos} min · {COP.format(servicioSeleccionado.precio || 0)}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Elige un servicio de la lista.</p>
          )}

          {conEquipo && (
            <div style={{ marginTop: 18 }}>
              <div className="reserva-etiqueta">¿Con quién?</div>
              <div className="reserva-personas" role="radiogroup" aria-label="Con quién quieres reservar">
                <button
                  type="button"
                  role="radio"
                  aria-checked={profesionalId === 'cualquiera'}
                  className={`reserva-persona${profesionalId === 'cualquiera' ? ' on' : ''}`}
                  onClick={() => elegirProfesional('cualquiera')}
                >
                  <span className="reserva-persona__cualquiera" aria-hidden="true"><Icon name="users" size={18} /></span>
                  <span className="reserva-persona__nombre">Cualquiera</span>
                  <span className="reserva-persona__cargo">La primera libre</span>
                </button>
                {equipoActivo.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={profesionalId === p.id}
                    className={`reserva-persona${profesionalId === p.id ? ' on' : ''}`}
                    onClick={() => elegirProfesional(p.id)}
                  >
                    <AvatarProfesional profesional={p} tamano={40} />
                    <span className="reserva-persona__nombre">{primerNombre(p.nombre)}</span>
                    <span className="reserva-persona__cargo">{p.cargo || 'Equipo'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <div className="reserva-etiqueta">
              Día{profesionalElegido ? ` · los que trabaja ${primerNombre(profesionalElegido.nombre)}` : ''}
            </div>
            {profesionalElegido && trabajaEl(profesionalElegido, fechaObj) && horarioPersona(profesionalElegido, fechaObj) !== 'Horario del negocio' && (
              <div className="reserva-horario-persona">
                <Icon name="clock" size={13} /> {primerNombre(profesionalElegido.nombre)} atiende ese día de {horarioPersona(profesionalElegido, fechaObj)}
              </div>
            )}
            {/* Su hora de almuerzo: esos turnos no se ofrecen (ver almuerzoDe en equipo.js). */}
            {profesionalElegido && trabajaEl(profesionalElegido, fechaObj) && almuerzoDe(profesionalElegido, fechaObj) && (
              <div className="reserva-horario-persona">
                <Icon name="almuerzo" size={13} /> Almuerza de {textoRango(almuerzoDe(profesionalElegido, fechaObj))}: en ese tiempo no hay turnos
              </div>
            )}
            <div className="reserva-dias-marco">
            {/* Flechas solo con mouse (ver .reserva-dias-flecha en index.css):
                en el celular los días se deslizan con el dedo. */}
            <button
              type="button"
              className="reserva-dias-flecha izquierda"
              onClick={() => moverDias(-1)}
              disabled={bordesDias.inicio}
              aria-label="Ver días anteriores"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <div
              ref={diasRef}
              className={`reserva-dias${bordesDias.inicio ? '' : ' con-antes'}${bordesDias.fin ? '' : ' con-despues'}`}
              role="radiogroup"
              aria-label="Día de la cita"
              onScroll={actualizarBordesDias}
            >
              {diasReserva.map((d) => (
                <button
                  key={d.valor}
                  type="button"
                  role="radio"
                  aria-checked={fecha === d.valor}
                  disabled={!d.disponible}
                  className={`reserva-dia${fecha === d.valor ? ' on' : ''}`}
                  onClick={() => elegirFecha(d.valor)}
                  title={d.disponible ? undefined : 'No hay atención ese día'}
                >
                  <span className="reserva-dia__semana">{DIA_SEMANA_CORTO.format(d.fecha).replace('.', '')}</span>
                  <span className="reserva-dia__numero">{d.fecha.getDate()}</span>
                  <span className="reserva-dia__mes">{MES_CORTO.format(d.fecha).replace('.', '')}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="reserva-dias-flecha derecha"
              onClick={() => moverDias(1)}
              disabled={bordesDias.fin}
              aria-label="Ver más días"
            >
              <Icon name="chevronRight" size={16} />
            </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
              Las citas se reservan con al menos un día de anticipación.
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>
              Turnos disponibles · {FECHA_CORTA.format(fechaObj)}
            </label>
            {hora && (
              <div className="reserva-resumen">
                <Icon name="check" size={14} />
                <span>
                  {formatoHora12(hora)}
                  {conEquipo && (profesionalElegido
                    ? ` con ${primerNombre(profesionalElegido.nombre)}`
                    : asignarProfesional(hora) ? ` con ${primerNombre(asignarProfesional(hora).nombre)}` : '')}
                </span>
              </div>
            )}
            {!currentUser ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
                Inicia sesión para ver los turnos disponibles y reservar.
              </p>
            ) : slotsDelDia.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
                {conEquipo && profesionalElegido ? `${primerNombre(profesionalElegido.nombre)} no atiende ese día.` : 'Este negocio no atiende ese día.'}
              </p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                  {(turnosExpandidos ? slotsDelDia : slotsDelDia.slice(0, 6)).map((s) => {
                    // Ocupado (tachado) o sin espacio para la duración del
                    // servicio (atenuado): en ambos casos no se puede elegir.
                    const libre = disponibilidad.get(s) === 'libre'
                    const ocupado = !libre
                    const tachado = disponibilidad.get(s) === 'ocupado'
                    const seleccionado = hora === s
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={ocupado}
                        onClick={() => { setHora(s); setCitaConfirmada(null) }}
                        style={{
                          fontSize: 12.5, fontWeight: 700, padding: '9px 0', borderRadius: 8,
                          border: `1px solid ${seleccionado ? 'var(--accent)' : 'var(--vidrio-borde)'}`,
                          background: ocupado ? 'var(--surface-2)' : seleccionado ? 'var(--accent)' : 'var(--vidrio-campo)',
                          color: ocupado ? 'var(--text-faint)' : seleccionado ? '#fff' : 'var(--text)',
                          cursor: ocupado ? 'not-allowed' : 'pointer',
                          textDecoration: tachado ? 'line-through' : 'none',
                          opacity: ocupado && !tachado ? 0.55 : 1,
                        }}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
                {slotsDelDia.length > 6 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => setTurnosExpandidos((v) => !v)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {turnosExpandidos ? 'Reducir' : 'Ampliar'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={reservando || !servicioSeleccionado || (!!currentUser && !hora)}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16 }}
          >
            {!currentUser
              ? 'Inicia sesión para reservar'
              : reservando
              ? 'Confirmando…'
              : 'Confirmar cita'}
          </button>

          {/* Por privacidad del negocio, su WhatsApp solo se abre con sesión iniciada. */}
          {whatsapp && !currentUser && (
            <button
              type="button"
              disabled
              className="btn btn-outline"
              style={{ width: '100%', marginTop: 10, opacity: 0.5, cursor: 'not-allowed' }}
            >
              Inicia sesión para escribir por WhatsApp
            </button>
          )}
          {whatsapp && currentUser && (
            <a
              href={`https://wa.me/57${whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline"
              style={{ width: '100%', marginTop: 10, display: 'block', textAlign: 'center' }}
            >
              Escribir por WhatsApp
            </a>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 12, textAlign: 'center' }}>
            {metodosPago.length > 0
              ? `Pagas en el local: ${metodosPago.map(etiquetaMetodoPago).join(', ')}.`
              : 'No se realizan pagos en la plataforma.'}
          </p>
        </div>

        {citaConfirmada && (
          <div ref={reciboRef}>
            <ReciboCita cita={citaConfirmada} onCerrar={() => setCitaConfirmada(null)} />
          </div>
        )}
        </div>
        )}
      </div>
      </div>

      {calificando && (
        <CalificarModal
          negocio={negocio}
          citaId={citaParaResenar?.id}
          nombreCliente={nombreCorto(currentUser?.displayName)}
          onClose={() => setCalificando(false)}
        />
      )}
    </div>
  )
}
