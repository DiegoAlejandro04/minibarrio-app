// Servicios sumados a una cita: al reservar (NegocioDetalle.jsx) el cliente
// puede agregar otros servicios del mismo negocio a la cita (un corte y una
// barba). Se copian en la cita (cita.adicionales: [{ nombre, precio,
// minutos, servicioId }]) junto con su duración total (cita.duracionMinutos),
// para que la cita no cambie si el negocio edita sus servicios después.
//
// Funciones puras, probadas en adicionales.test.js.

export const MAX_ADICIONALES = 6
// Tope que aceptan las reglas para lo que suman los adicionales a la
// duración del servicio (firestore.rules, creación de citas).
export const MAX_MINUTOS_EXTRA = 240

const suma = (lista, campo) => (lista || []).reduce((s, a) => s + (Number(a?.[campo]) || 0), 0)

/** Precio y duración de un servicio con los adicionales elegidos. */
export function totalesConAdicionales(servicio, adicionales = []) {
  return {
    precio: (Number(servicio?.precio) || 0) + suma(adicionales, 'precio'),
    duracionMinutos: (Number(servicio?.duracionMinutos) || 0) + suma(adicionales, 'minutos'),
  }
}

/**
 * Duración de una cita: la guardada en la cita (si se reservó con
 * adicionales) o la de su servicio.
 */
export function duracionDeCita(cita, servicio) {
  return Number(cita?.duracionMinutos) || Number(servicio?.duracionMinutos) || undefined
}

/** Precio de una cita: el de su servicio más el de sus adicionales. */
export function precioDeCita(cita, servicio) {
  return (Number(servicio?.precio) || 0) + suma(cita?.adicionales, 'precio')
}

/** "Corte fade + Barba + Cejas" (o solo el nombre si no hay adicionales). */
export function nombreConAdicionales(nombreServicio, adicionales = []) {
  return [nombreServicio, ...(adicionales || []).map((a) => a.nombre)].filter(Boolean).join(' + ')
}

/** "+$8.000 · +20 min" para mostrar al lado de un adicional. */
export function detalleAdicional(adicional, formatoPrecio) {
  const partes = []
  if (Number(adicional.precio) > 0) partes.push(`+${formatoPrecio(Number(adicional.precio))}`)
  if (Number(adicional.minutos) > 0) partes.push(`+${adicional.minutos} min`)
  return partes.length ? partes.join(' · ') : 'Sin costo'
}
