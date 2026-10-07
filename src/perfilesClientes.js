import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase/config'

// Lectura del perfil de un cliente (nombre, correo, teléfono) desde el panel
// del negocio. Por protección de datos (Ley 1581), firestore.rules solo deja
// que un propietario lea el perfil de un cliente que tenga relación con su
// negocio: debe existir la marca "negocios/{negocioId}/clientes/{clienteId}".
// Antes cualquier propietario podía leer el perfil de cualquier cliente.
//
// La marca la crea el propio negocio, pero las reglas solo la aceptan con
// una prueba real de la relación: el id de una cita de ese cliente en ese
// negocio, o de una reseña que ese cliente le dejó. Así un negocio no puede
// "adueñarse" de clientes ajenos.

/**
 * Devuelve los datos del perfil del cliente, o null si no se pudieron leer.
 * `evidencia` es { citaId } o { resenaId } de una cita/reseña de ese cliente
 * en este negocio — se usa solo si la marca todavía no existe.
 */
export async function leerPerfilCliente(negocioId, clienteId, evidencia) {
  const perfilRef = doc(db, 'usuarios', clienteId)
  try {
    const snap = await getDoc(perfilRef)
    return snap.exists() ? snap.data() : null
  } catch (err) {
    if (err.code !== 'permission-denied') return null
  }

  // Sin permiso: falta la marca (p. ej. clientes que reservaron antes de
  // existir esta regla). Se crea con la evidencia y se vuelve a intentar.
  try {
    await setDoc(doc(db, 'negocios', negocioId, 'clientes', clienteId), {
      ...evidencia,
      creadoEn: serverTimestamp(),
    })
    const snap = await getDoc(perfilRef)
    return snap.exists() ? snap.data() : null
  } catch {
    return null
  }
}
