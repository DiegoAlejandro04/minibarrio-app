import {
  collection, doc, getDocs, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase/config'

// Turnos ocupados de cada negocio: "negocios/{negocioId}/ocupados/{turno}",
// con solo { fechaHora, citaId } — sin cliente ni servicio. Es lo único que
// necesita ver un cliente para no reservar un turno ya tomado
// (NegocioDetalle.jsx); las citas en sí solo las leen su cliente y su negocio.
//
// El id del documento es la hora del turno (milisegundos desde 1970, ver
// idTurno): así un turno solo puede tener UNA cita. Una cita ocupa TODOS los
// turnos de 20 minutos que cubre su servicio: un fade de 50 min a las 10:00
// ocupa 10:00, 10:20 y 10:40 (antes solo ocupaba el de inicio, y dejaba
// reservar otra cita encima a las 10:20). La cita y sus turnos se escriben
// juntos en un batch, y firestore.rules exige que cada turno caiga dentro de
// la duración del servicio de esa cita. Si alguno ya es de otra cita, las
// reglas rechazan el batch completo y la cita no se crea: no hay doble
// reserva ni citas encimadas, aunque dos clientes confirmen a la vez.

export const MINUTOS_TURNO = 20

/** Id del documento del turno: la hora en milisegundos, como texto. */
export function idTurno(fechaHora) {
  const ms = fechaHora?.toMillis ? fechaHora.toMillis() : fechaHora.getTime()
  return String(ms)
}

const comoFecha = (fechaHora) => (fechaHora?.toDate ? fechaHora.toDate() : fechaHora)

/**
 * Turnos de 20 minutos que ocupa una cita: desde su hora de inicio hasta
 * cubrir la duración del servicio (al menos uno). Sin duración conocida, uno.
 */
export function turnosCubiertos(fechaHora, duracionMinutos) {
  const inicio = comoFecha(fechaHora).getTime()
  const cantidad = Math.max(1, Math.ceil((Number(duracionMinutos) || MINUTOS_TURNO) / MINUTOS_TURNO))
  return Array.from({ length: cantidad }, (_, i) => new Date(inicio + i * MINUTOS_TURNO * 60000))
}

function refOcupado(negocioId, fechaHora) {
  return doc(db, 'negocios', negocioId, 'ocupados', idTurno(fechaHora))
}

/** Crea la cita y ocupa sus turnos. Devuelve la referencia de la cita. */
export async function reservarCita({ negocioId, clienteId, servicioId, fechaHora, duracionMinutos }) {
  const citaRef = doc(collection(db, 'citas'))
  const batch = writeBatch(db)
  batch.set(citaRef, {
    negocioId,
    clienteId,
    servicioId,
    fechaHora,
    estado: 'pendiente',
    creadoEn: serverTimestamp(),
  })
  turnosCubiertos(fechaHora, duracionMinutos).forEach((turno) => {
    batch.set(refOcupado(negocioId, turno), { fechaHora: turno, citaId: citaRef.id })
  })
  await batch.commit()
  return citaRef
}

/**
 * Cambia el estado de una cita y mantiene sus turnos en sincronía: cancelada
 * libera todos los turnos de esa cita; cualquier otro estado los ocupa. Si al
 * reactivar una cita cancelada alguno de sus turnos ya es de otra cita, las
 * reglas rechazan el cambio. `extra` son campos adicionales para la cita (p.
 * ej. canceladaPor); `duracionMinutos`, la del servicio de la cita.
 */
export async function cambiarEstadoCita(cita, estado, extra = {}, duracionMinutos) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'citas', cita.id), { estado, ...extra })
  if (estado === 'cancelada') {
    // Solo se liberan los turnos que son de esta cita.
    const turnos = await getDocs(query(collection(db, 'negocios', cita.negocioId, 'ocupados'), where('citaId', '==', cita.id)))
    turnos.docs.forEach((t) => batch.delete(t.ref))
  } else {
    turnosCubiertos(cita.fechaHora, duracionMinutos).forEach((turno) => {
      batch.set(refOcupado(cita.negocioId, turno), { fechaHora: turno, citaId: cita.id })
    })
  }
  await batch.commit()
}

/**
 * Para el panel del negocio: ocupa los turnos que falten de sus citas
 * futuras no canceladas (también los que cubre su duración, para las citas
 * reservadas antes de que se ocupara la duración completa), libera los de
 * citas canceladas y borra los turnos del formato anterior (id = id de la
 * cita, sin campo citaId). `citas` son las citas del negocio tal como vienen
 * de Firestore (fechaHora Timestamp); `duraciones`, servicioId → minutos.
 *
 * Un turno que ya es de otra cita no se toca: si dos citas viejas quedaron
 * encimadas, el dueño las ve en su agenda y decide cuál cancelar.
 */
export async function sincronizarOcupados(negocioId, citas, duraciones = {}) {
  const snap = await getDocs(collection(db, 'negocios', negocioId, 'ocupados'))
  const batch = writeBatch(db)
  let cambios = 0
  const citaPorTurno = new Map()
  snap.docs.forEach((d) => {
    if (d.data().citaId) {
      citaPorTurno.set(d.id, d.data().citaId)
    } else {
      batch.delete(d.ref)
      cambios += 1
    }
  })

  const ahora = new Date()
  citas.forEach((c) => {
    if (!c.fechaHora?.toDate) return
    if (c.estado === 'cancelada') {
      citaPorTurno.forEach((citaId, turno) => {
        if (citaId !== c.id) return
        batch.delete(doc(db, 'negocios', negocioId, 'ocupados', turno))
        citaPorTurno.delete(turno)
        cambios += 1
      })
    } else if (c.fechaHora.toDate() >= ahora) {
      turnosCubiertos(c.fechaHora, duraciones[c.servicioId]).forEach((turno) => {
        const id = idTurno(turno)
        if (citaPorTurno.has(id)) return
        batch.set(refOcupado(negocioId, turno), { fechaHora: turno, citaId: c.id })
        citaPorTurno.set(id, c.id)
        cambios += 1
      })
    }
  })
  if (cambios > 0) await batch.commit()
}
