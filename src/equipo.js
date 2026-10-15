// Equipo del negocio: las personas que atienden (barberos, estilistas,
// manicuristas…), en negocios/{id}/profesionales/{profesionalId}:
// { nombre, cargo, dias, activo, foto?, creadoEn }. `dias` son los días que
// trabaja, con la numeración de Date.getDay() (0 = domingo … 6 = sábado).
//
// Con equipo, cada persona tiene su propia agenda: el turno ocupado de una
// cita lleva el id "{ms}_{profesionalId}" (ver idTurno en turnosOcupados.js)
// y el cliente elige con quién reservar en NegocioDetalle.jsx. Un negocio
// sin equipo sigue con una sola agenda, como antes ("{ms}").
//
// Aquí solo hay funciones puras (sin Firebase), probadas en equipo.test.js.

export const MAX_EQUIPO = 12
export const MAX_NOMBRE_PROFESIONAL = 40
export const MAX_CARGO = 30
export const MINUTOS_TURNO = 20

// Orden de la semana para mostrar: lunes primero (como se piensa la semana
// laboral en Colombia), con el número de Date.getDay() de cada día.
export const DIAS_SEMANA = [
  { dia: 1, corto: 'L', nombre: 'Lunes' },
  { dia: 2, corto: 'M', nombre: 'Martes' },
  { dia: 3, corto: 'X', nombre: 'Miércoles' },
  { dia: 4, corto: 'J', nombre: 'Jueves' },
  { dia: 5, corto: 'V', nombre: 'Viernes' },
  { dia: 6, corto: 'S', nombre: 'Sábado' },
  { dia: 0, corto: 'D', nombre: 'Domingo' },
]

export const CARGOS_SUGERIDOS = ['Barbero', 'Estilista', 'Manicurista', 'Colorista', 'Esteticista']

// Colores para las iniciales de quien no tiene foto: siempre el mismo para
// el mismo nombre, para que el cliente lo reconozca de una vez a la otra.
const COLORES = [
  'oklch(66% 0.15 48)', // naranja (el de la marca)
  'oklch(60% 0.09 160)', // verde salvia
  'oklch(60% 0.12 250)', // azul
  'oklch(62% 0.13 320)', // magenta
  'oklch(64% 0.12 85)', // mostaza
  'oklch(58% 0.11 200)', // azul verdoso
]

export function colorProfesional(nombre = '') {
  let h = 0
  for (const letra of nombre) h = (h * 31 + letra.charCodeAt(0)) >>> 0
  return COLORES[h % COLORES.length]
}

export function inicialesProfesional(nombre = '') {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return partes.slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

/** Primer nombre, para textos cortos: "con Carlos". */
export function primerNombre(nombre = '') {
  return nombre.trim().split(/\s+/)[0] || nombre
}

/** "L, M, X, J, V" o "Todos los días" / "Lunes a viernes" cuando aplica. */
export function resumenDias(dias = []) {
  const set = new Set(dias)
  if (set.size === 7) return 'Todos los días'
  if (set.size === 0) return 'Sin días asignados'
  const entreSemana = [1, 2, 3, 4, 5]
  if (set.size === 5 && entreSemana.every((d) => set.has(d))) return 'Lunes a viernes'
  if (set.size === 6 && !set.has(0)) return 'Lunes a sábado'
  return DIAS_SEMANA.filter((d) => set.has(d.dia)).map((d) => d.corto).join(' · ')
}

export function trabajaEl(profesional, fecha) {
  return profesional.activo !== false && (profesional.dias || []).includes(fecha.getDay())
}

/** Quiénes del equipo atienden ese día (activos y con ese día marcado). */
export function equipoDelDia(equipo, fecha) {
  return equipo.filter((p) => trabajaEl(p, fecha))
}

const aMinutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/**
 * Estado de cada turno ("HH:MM") de un día para UNA agenda: 'libre',
 * 'ocupado' (ese turno ya es de otra cita) o 'no-cabe' (el servicio no
 * alcanza a terminar antes de la siguiente cita o del cierre).
 * `ocupados`: Set de "HH:MM" ya tomados en esa agenda.
 */
export function disponibilidadAgenda(slots, ocupados, duracionMinutos, cierre) {
  const duracion = Number(duracionMinutos) || MINUTOS_TURNO
  const bloques = Math.max(1, Math.ceil(duracion / MINUTOS_TURNO))
  const fin = cierre ? aMinutos(cierre) : null
  const mapa = new Map()
  slots.forEach((s) => {
    const inicio = aMinutos(s)
    if (ocupados.has(s)) return mapa.set(s, 'ocupado')
    for (let i = 1; i < bloques; i++) {
      if (ocupados.has(aHora(inicio + i * MINUTOS_TURNO))) return mapa.set(s, 'no-cabe')
    }
    if (fin != null && inicio + duracion > fin) return mapa.set(s, 'no-cabe')
    mapa.set(s, 'libre')
  })
  return mapa
}

/**
 * Turnos ocupados de un día, separados por agenda. `docs` son los
 * documentos de negocios/{id}/ocupados como { id, fechaHora: Date }.
 * Devuelve { general: Set, porProfesional: Map(profesionalId → Set) }:
 * "general" son los turnos sin persona (citas de antes de tener equipo), que
 * cuentan como ocupados para TODO el equipo — así una cita vieja nunca queda
 * con otra encima.
 */
export function ocupadosDelDia(docs, fechaClave) {
  const general = new Set()
  const porProfesional = new Map()
  docs.forEach(({ id, fechaHora }) => {
    if (!fechaHora) return
    const clave = `${fechaHora.getFullYear()}-${String(fechaHora.getMonth() + 1).padStart(2, '0')}-${String(fechaHora.getDate()).padStart(2, '0')}`
    if (clave !== fechaClave) return
    const hhmm = `${String(fechaHora.getHours()).padStart(2, '0')}:${String(fechaHora.getMinutes()).padStart(2, '0')}`
    const separador = id.indexOf('_')
    if (separador === -1) {
      general.add(hhmm)
      return
    }
    const profesionalId = id.slice(separador + 1)
    if (!porProfesional.has(profesionalId)) porProfesional.set(profesionalId, new Set())
    porProfesional.get(profesionalId).add(hhmm)
  })
  return { general, porProfesional }
}

/** Ocupados de la agenda de una persona: los suyos más los generales. */
export function ocupadosDe(ocupados, profesionalId) {
  return new Set([...ocupados.general, ...(ocupados.porProfesional.get(profesionalId) || [])])
}

/**
 * Disponibilidad para la opción "Cualquiera": un turno está libre si al
 * menos una persona de las que trabajan ese día lo tiene libre. Devuelve
 * { mapa: Map(turno → estado), asignar: (turno) → profesional | null }; al
 * confirmar se le asigna la primera persona libre en ese turno (en el orden
 * del equipo).
 */
export function disponibilidadCualquiera(slots, ocupados, equipoDia, duracionMinutos, cierre) {
  const porPersona = equipoDia.map((p) => ({
    profesional: p,
    mapa: disponibilidadAgenda(slots, ocupadosDe(ocupados, p.id), duracionMinutos, cierre),
  }))
  const mapa = new Map()
  slots.forEach((s) => {
    const estados = porPersona.map((x) => x.mapa.get(s))
    if (estados.includes('libre')) mapa.set(s, 'libre')
    else if (estados.length > 0 && estados.every((e) => e === 'ocupado')) mapa.set(s, 'ocupado')
    else mapa.set(s, 'no-cabe')
  })
  const asignar = (turno) => porPersona.find((x) => x.mapa.get(turno) === 'libre')?.profesional || null
  return { mapa, asignar }
}
