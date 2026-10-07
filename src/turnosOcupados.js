import {
  collection, doc, getDocs, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase/config'

// Turnos ocupados de cada negocio: "negocios/{negocioId}/ocupados/{citaId}",
// con SOLO la fecha y hora ({ fechaHora }) — sin cliente, servicio ni nada
// más. Es lo único que necesita ver un cliente para no reservar un turno ya
// tomado (NegocioDetalle.jsx).
//
// Antes la página del negocio leía directamente la colección "citas" de ese
// negocio, y para eso firestore.rules dejaba que cualquier usuario con sesión
// leyera TODAS las citas de todos los negocios (quién va a dónde, cuándo y a
// qué). Ahora cada cita solo la leen su cliente y su negocio, y lo público es
// esta copia mínima.
//
// La cita y su turno se escriben siempre juntos en un mismo batch: las reglas
// verifican con getAfter() que el turno coincida con una cita real (mismo
// negocio, misma fecha, no cancelada), así que nadie puede bloquear turnos
// falsos ni liberar turnos ajenos.

function refOcupado(negocioId, citaId) {
  return doc(db, 'negocios', negocioId, 'ocupados', citaId)
}

/** Crea la cita y marca su turno como ocupado. Devuelve la referencia de la cita. */
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
  batch.set(refOcupado(negocioId, citaRef.id), { fechaHora })
  await batch.commit()
  return citaRef
}

/**
 * Cambia el estado de una cita y mantiene su turno en sincronía: una cita
 * cancelada libera el turno; cualquier otro estado lo deja ocupado.
 * `extra` son campos adicionales para la cita (p. ej. canceladaPor).
 */
export async function cambiarEstadoCita(cita, estado, extra = {}) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'citas', cita.id), { estado, ...extra })
  if (estado === 'cancelada') {
    batch.delete(refOcupado(cita.negocioId, cita.id))
  } else {
    batch.set(refOcupado(cita.negocioId, cita.id), { fechaHora: cita.fechaHora })
  }
  await batch.commit()
}

/**
 * Para el panel del negocio: crea los turnos que falten de sus citas
 * futuras no canceladas (las que se reservaron antes de existir
 * "ocupados") y libera los de citas que ya se cancelaron. `citas` son las
 * citas del negocio tal como vienen de Firestore (fechaHora como Timestamp).
 */
export async function sincronizarOcupados(negocioId, citas) {
  const snap = await getDocs(collection(db, 'negocios', negocioId, 'ocupados'))
  const existentes = new Set(snap.docs.map((d) => d.id))
  const ahora = new Date()
  const batch = writeBatch(db)
  let cambios = 0
  citas.forEach((c) => {
    const fecha = c.fechaHora?.toDate ? c.fechaHora.toDate() : null
    if (!fecha) return
    if (c.estado === 'cancelada') {
      if (existentes.has(c.id)) {
        batch.delete(refOcupado(negocioId, c.id))
        cambios += 1
      }
    } else if (fecha >= ahora && !existentes.has(c.id)) {
      batch.set(refOcupado(negocioId, c.id), { fechaHora: c.fechaHora })
      cambios += 1
    }
  })
  if (cambios > 0) await batch.commit()
}
