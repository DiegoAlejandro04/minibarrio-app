import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase/config'

// Notificaciones de clientes y negocios, guardadas en Firestore en
// "usuarios/{uid}/notificaciones/{id}" con:
//   { tipo, titulo, texto, enlace, citaId?, leida, creadoEn }
// Se leen en tiempo real (hooks/useNotificaciones.js), así "leída" queda
// igual en todos los dispositivos de la cuenta.
//
// Dos orígenes:
// - Eventos entre cliente y negocio (reservar, cancelar, completar, reseñar):
//   se escriben en el MISMO batch que la cita o la reseña, y firestore.rules
//   solo deja escribírsela al otro si quien la escribe es parte de esa cita
//   (o autor de esa reseña).
// - Avisos propios (recordatorios, citas de hoy, perfil incompleto): los crea
//   la propia cuenta al abrir su panel, con un id fijo por aviso (p. ej.
//   "recordatorio-dia-{citaId}") para no repetirlos: si dos dispositivos lo
//   crean a la vez, el segundo lo encuentra ya hecho y las reglas lo rechazan
//   sin daño.

export const TIPOS_NOTIFICACION = {
  'nueva-reserva': { icono: 'calendar', tono: 'acento' },
  'reserva-confirmada': { icono: 'check', tono: 'exito' },
  'cita-cancelada': { icono: 'x', tono: 'peligro' },
  recordatorio: { icono: 'bell', tono: 'acento' },
  calificar: { icono: 'star', tono: 'acento' },
  'nueva-resena': { icono: 'star', tono: 'acento' },
  'citas-hoy': { icono: 'calendar', tono: 'exito' },
  'citas-por-cerrar': { icono: 'check', tono: 'aviso' },
  perfil: { icono: 'store', tono: 'aviso' },
}

const FECHA_CITA = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
const HORA_CITA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })

/** "jue 15 oct, 9:20 a. m." — fecha y hora de una cita para los textos. */
export function textoFechaCita(fecha) {
  const d = fecha?.toDate ? fecha.toDate() : fecha
  return `${FECHA_CITA.format(d)}, ${HORA_CITA.format(d)}`
}

function refNotificacion(uid, id) {
  const coleccion = collection(db, 'usuarios', uid, 'notificaciones')
  return id ? doc(coleccion, id) : doc(coleccion)
}

function datosNotificacion({ tipo, titulo, texto, enlace = null, citaId }) {
  return {
    tipo,
    titulo: titulo.slice(0, 80),
    texto: texto.slice(0, 300),
    enlace,
    ...(citaId ? { citaId } : {}),
    leida: false,
    creadoEn: serverTimestamp(),
  }
}

/**
 * Agrega a un batch las notificaciones de un evento. Cada aviso es
 * { destinatarioId, tipo, titulo, texto, enlace? }; citaId se le pone a todos.
 */
export function agregarAvisos(batch, avisos = [], citaId) {
  avisos.forEach(({ destinatarioId, ...aviso }) => {
    batch.set(refNotificacion(destinatarioId), datosNotificacion({ ...aviso, citaId }))
  })
}

/**
 * Crea un aviso propio con id fijo si todavía no existe. `existentes` son los
 * ids que ya trajo la suscripción; si otro dispositivo se adelantó, las reglas
 * rechazan el duplicado y se ignora.
 */
export function crearAvisoPropio(uid, id, aviso, existentes) {
  if (existentes.has(id)) return
  setDoc(refNotificacion(uid, id), datosNotificacion(aviso)).catch(() => {})
}

export function marcarLeida(uid, id) {
  return setDoc(refNotificacion(uid, id), { leida: true }, { merge: true })
}

/**
 * Quita una notificación de la lista (la ✕ de cada una). Las de eventos se
 * borran. Los avisos propios (id fijo con guiones, p. ej.
 * "recordatorio-dia-{citaId}", ver crearAvisoPropio) se ocultan en vez de
 * borrarse: si se borraran, el panel los volvería a crear la próxima vez que
 * se abre, porque no los encontraría. Los ids automáticos de Firestore nunca
 * tienen guiones.
 */
export function eliminarNotificacion(uid, notificacion) {
  const ref = refNotificacion(uid, notificacion.id)
  if (notificacion.id.includes('-')) return updateDoc(ref, { oculta: true, leida: true })
  return deleteDoc(ref)
}

export async function marcarTodasLeidas(uid, notificaciones) {
  const pendientes = notificaciones.filter((n) => !n.leida)
  if (pendientes.length === 0) return
  const batch = writeBatch(db)
  pendientes.forEach((n) => batch.update(refNotificacion(uid, n.id), { leida: true }))
  await batch.commit()
}

const RELATIVO = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' })
const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })

/** "hace 5 minutos", "ayer", "12 oct" — cuándo llegó una notificación. */
export function haceCuanto(fecha, ahora = new Date()) {
  if (!fecha) return 'ahora'
  const minutos = Math.round((ahora - fecha) / 60000)
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return RELATIVO.format(-minutos, 'minute')
  const horas = Math.round(minutos / 60)
  if (horas < 24) return RELATIVO.format(-horas, 'hour')
  const dias = Math.round(horas / 24)
  if (dias < 7) return RELATIVO.format(-dias, 'day')
  return FECHA_CORTA.format(fecha)
}
