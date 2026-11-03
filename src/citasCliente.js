// Citas que ya tiene el cliente, para que no pueda reservar otra que se le
// cruce: una persona no puede estar en dos sillas a la vez, aunque sean dos
// personas distintas del equipo (cada una con su agenda, ver equipo.js) o
// dos negocios distintos. NegocioDetalle.jsx bloquea esos turnos y lo vuelve
// a revisar al confirmar.
//
// Funciones puras, probadas en citasCliente.test.js.

const MINUTO = 60000

/**
 * Intervalos [inicio, fin) en milisegundos de las citas vigentes del cliente
 * (no canceladas). `duracionDe(cita)` da los minutos de cada una; sin dato,
 * se cuenta un turno de 20 minutos.
 */
export function intervalosDeCitas(citas, duracionDe) {
  return citas
    .filter((c) => c.estado !== 'cancelada' && c.fechaHora)
    .map((c) => {
      const inicio = c.fechaHora.toMillis ? c.fechaHora.toMillis() : new Date(c.fechaHora).getTime()
      const minutos = Number(duracionDe(c)) || 20
      return { cita: c, inicio, fin: inicio + minutos * MINUTO }
    })
}

/** ¿Una cita nueva de `minutos` a partir de `inicio` (ms) se cruza con alguna? */
export function citaQueChoca(intervalos, inicio, minutos) {
  const fin = inicio + (Number(minutos) || 20) * MINUTO
  return intervalos.find((i) => inicio < i.fin && i.inicio < fin) || null
}

/**
 * Turnos ("HH:MM") de un día (`fechaClave`, "YYYY-MM-DD") en los que una
 * cita de `minutos` se cruzaría con las del cliente.
 */
export function turnosQueChocan(slots, fechaClave, minutos, intervalos) {
  const chocan = new Set()
  slots.forEach((s) => {
    const inicio = new Date(`${fechaClave}T${s}:00`).getTime()
    if (citaQueChoca(intervalos, inicio, minutos)) chocan.add(s)
  })
  return chocan
}
