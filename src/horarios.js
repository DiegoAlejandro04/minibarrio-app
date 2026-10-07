// Horario de atención de un negocio (negocios/{id}.horarios). Cada día se
// guarda por separado con su propio interruptor de servicio:
//
//   { lunes, martes, miercoles, jueves, viernes, sabado, domingo, festivos }
//   cada uno: { activo: boolean, apertura: 'HH:MM', cierre: 'HH:MM' }
//
// Se edita en EditarNegocioModal.jsx y se lee aquí para todo lo demás: los
// turnos de reserva y la pestaña "Horarios" (NegocioDetalle.jsx) y el
// letrero Abierto/Cerrado (ClientHome.jsx, NegocioDetalle.jsx).
//
// Formatos anteriores que se siguen leyendo, para negocios que no han vuelto
// a guardar su horario: "lunesAViernes" (un solo horario para los cinco días)
// y "domingoFestivos" (uno compartido para domingo y festivos).

export const DIAS_ENTRE_SEMANA = [
  { key: 'lunes', label: 'Lunes', inicial: 'L' },
  { key: 'martes', label: 'Martes', inicial: 'M' },
  { key: 'miercoles', label: 'Miércoles', inicial: 'X' },
  { key: 'jueves', label: 'Jueves', inicial: 'J' },
  { key: 'viernes', label: 'Viernes', inicial: 'V' },
]

export const DIAS_ESPECIALES = [
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
  { key: 'festivos', label: 'Festivos' },
]

// Orden de Date.getDay(): 0 = domingo … 6 = sábado.
const KEY_POR_DIA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function respaldoAntiguo(horarios, key) {
  if (DIAS_ENTRE_SEMANA.some((d) => d.key === key)) return horarios?.lunesAViernes
  if (key === 'domingo' || key === 'festivos') return horarios?.domingoFestivos
  return undefined
}

/** El bloque de un día como está guardado (o su respaldo antiguo), abierto o no. */
export function bloqueGuardado(horarios, key) {
  return horarios?.[key] || respaldoAntiguo(horarios, key)
}

/** { apertura, cierre } si el negocio atiende ese día; null si está cerrado. */
export function bloqueDe(horarios, key) {
  const bloque = bloqueGuardado(horarios, key)
  if (!bloque || bloque.activo === false || !bloque.apertura || !bloque.cierre) return null
  return bloque
}

/** Bloque de atención de una fecha concreta (null si ese día no atiende). */
export function bloqueDelDia(horarios, fecha) {
  return bloqueDe(horarios, KEY_POR_DIA[fecha.getDay()])
}

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** 'abierto' | 'cierra-pronto' | 'cerrado' ahora mismo; null si no hay horario publicado. */
export function estadoApertura(horarios, ahora = new Date()) {
  if (!horarios) return null
  const bloque = bloqueDelDia(horarios, ahora)
  if (!bloque) return 'cerrado'
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const apertura = aMinutos(bloque.apertura)
  const cierre = aMinutos(bloque.cierre)
  if (minutosAhora < apertura || minutosAhora >= cierre) return 'cerrado'
  if (cierre - minutosAhora <= 60) return 'cierra-pronto'
  return 'abierto'
}

/** "9:00 a. m." a partir de "09:00". */
export function formatoHora12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h < 12 ? 'a. m.' : 'p. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

const SEMANA = [...DIAS_ENTRE_SEMANA, DIAS_ESPECIALES[0], DIAS_ESPECIALES[1]] // lunes … domingo

function nombreRango(dias) {
  const primero = dias[0].label
  if (dias.length === 1) return primero
  const ultimo = dias[dias.length - 1].label.toLowerCase()
  return dias.length === 2 ? `${primero} y ${ultimo}` : `${primero} a ${ultimo}`
}

/**
 * Horario resumido para mostrarlo al cliente: agrupa días seguidos con el
 * mismo horario ("Lunes a jueves", "Viernes", …). Cada fila es
 * { label, bloque } con bloque null si ese día o grupo está cerrado.
 * Devuelve [] si el negocio no atiende ningún día.
 */
export function resumenHorario(horarios) {
  const filas = []
  let grupo = []
  const clave = (b) => (b ? `${b.apertura}-${b.cierre}` : 'cerrado')
  const cerrarGrupo = () => {
    if (grupo.length) filas.push({ label: nombreRango(grupo), bloque: bloqueDe(horarios, grupo[0].key) })
    grupo = []
  }
  SEMANA.forEach((d) => {
    if (grupo.length && clave(bloqueDe(horarios, grupo[0].key)) !== clave(bloqueDe(horarios, d.key))) cerrarGrupo()
    grupo.push(d)
  })
  cerrarGrupo()
  filas.push({ label: 'Festivos', bloque: bloqueDe(horarios, 'festivos') })
  return filas.some((f) => f.bloque) ? filas : []
}

/** Horario con el que arranca un negocio recién registrado. */
export const HORARIO_INICIAL = {
  lunes: { activo: true, apertura: '09:00', cierre: '20:00' },
  martes: { activo: true, apertura: '09:00', cierre: '20:00' },
  miercoles: { activo: true, apertura: '09:00', cierre: '20:00' },
  jueves: { activo: true, apertura: '09:00', cierre: '20:00' },
  viernes: { activo: true, apertura: '09:00', cierre: '20:00' },
  sabado: { activo: true, apertura: '08:00', cierre: '21:00' },
  domingo: { activo: false, apertura: '09:00', cierre: '16:00' },
  festivos: { activo: false, apertura: '09:00', cierre: '16:00' },
}
