// Número de reserva que ve el cliente en su comprobante (ReciboCita.jsx), en
// "Mis citas" y en "Principal", y con el que el negocio la busca en su
// agenda (OwnerAgenda.jsx). No es un campo guardado en Firestore: son los
// primeros 6 caracteres del id del documento de la cita, en mayúsculas — así
// funciona igual para las citas que ya existían, sin migrar nada.
export function codigoReserva(citaId) {
  return citaId.slice(0, 6).toUpperCase()
}

/** Normaliza lo que escribe el negocio al buscar ("#6kk3bz " → "6KK3BZ"). */
export function normalizarCodigo(texto) {
  return texto.replace(/[#\s]/g, '').toUpperCase()
}

/**
 * Cita con la que el cliente califica un negocio: la realizada más reciente
 * en ese negocio. firestore.rules exige que la reseña indique una cita suya
 * ya pasada y no cancelada (citaParaResena); sin ella se rechaza.
 */
export function citaParaCalificar(citas, negocioId) {
  return citas
    .filter((c) => c.negocioId === negocioId && c.estado === 'completada')
    .sort((a, b) => (b.fechaHora?.toMillis?.() || 0) - (a.fechaHora?.toMillis?.() || 0))[0]?.id
}
