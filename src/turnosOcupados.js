import {
  collection, doc, getDoc, getDocs, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase/config'

// Turnos ocupados de cada negocio: "negocios/{negocioId}/ocupados/{turno}",
// con solo { fechaHora, citaId } — sin cliente ni servicio. Es lo único que
// necesita ver un cliente para no reservar un turno ya tomado
// (NegocioDetalle.jsx); las citas en sí solo las leen su cliente y su negocio.
//
// El id del documento es la hora del turno (milisegundos desde 1970, ver
// idTurno): así un turno solo puede tener UNA cita. La cita y su turno se
// escriben juntos en un batch, y firestore.rules exige que vayan juntos y
// coincidan (mismo negocio, misma hora, cita no cancelada). Si el turno ya
// es de otra cita, las reglas rechazan el batch completo y la cita no se
// crea: no hay doble reserva aunque dos clientes confirmen a la vez.

/** Id del documento del turno: la hora en milisegundos, como texto. */
export function idTurno(fechaHora) {
  const ms = fechaHora?.toMillis ? fechaHora.toMillis() : fechaHora.getTime()
  return String(ms)
}

function refOcupado(negocioId, fechaHora) {
  return doc(db, 'negocios', negocioId, 'ocupados', idTurno(fechaHora))
}

/** Crea la cita y ocupa su turno. Devuelve la referencia de la cita. */
export async function reservarCita({ negocioId, clienteId, servicioId, fechaHora }) {
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
  batch.set(refOcupado(negocioId, fechaHora), { fechaHora, citaId: citaRef.id })
  await batch.commit()
  return citaRef
}

/**
 * Cambia el estado de una cita y mantiene su turno en sincronía: cancelada
 * libera el turno; cualquier otro estado lo ocupa. Si al reactivar una cita
 * cancelada su turno ya es de otra cita, las reglas rechazan el cambio.
 * `extra` son campos adicionales para la cita (p. ej. canceladaPor).
 */
export async function cambiarEstadoCita(cita, estado, extra = {}) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'citas', cita.id), { estado, ...extra })
  if (estado === 'cancelada') {
    // Solo se libera el turno si es de esta cita: con citas de antes de este
    // formato puede no existir, o (doble reserva vieja) ser de otra cita.
    const turno = await getDoc(refOcupado(cita.negocioId, cita.fechaHora))
    if (turno.exists() && turno.data().citaId === cita.id) {
      batch.delete(turno.ref)
    }
  } else {
    batch.set(refOcupado(cita.negocioId, cita.fechaHora), { fechaHora: cita.fechaHora, citaId: cita.id })
  }
  await batch.commit()
}

/**
 * Para el panel del negocio: ocupa los turnos que falten de sus citas
 * futuras no canceladas, libera los de citas canceladas y borra los turnos
 * del formato anterior (id = id de la cita, sin campo citaId). `citas` son
 * las citas del negocio tal como vienen de Firestore (fechaHora Timestamp).
 */
export async function sincronizarOcupados(negocioId, citas) {
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
    const turno = idTurno(c.fechaHora)
    if (c.estado === 'cancelada') {
      if (citaPorTurno.get(turno) === c.id) {
        batch.delete(refOcupado(negocioId, c.fechaHora))
        citaPorTurno.delete(turno)
        cambios += 1
      }
    } else if (c.fechaHora.toDate() >= ahora && !citaPorTurno.has(turno)) {
      batch.set(refOcupado(negocioId, c.fechaHora), { fechaHora: c.fechaHora, citaId: c.id })
      citaPorTurno.set(turno, c.id)
      cambios += 1
    }
  })
  if (cambios > 0) await batch.commit()
}
