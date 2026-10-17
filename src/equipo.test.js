import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  disponibilidadAgenda, disponibilidadCualquiera, disponibilidadProfesional, ocupadosDelDia, ocupadosDe,
  resumenDias, resumenHorario, trabajaEl, inicialesProfesional, colorProfesional,
  almuerzoDe, resumenAlmuerzo,
} from './equipo.js'

const SLOTS = ['09:00', '09:20', '09:40', '10:00', '10:20', '10:40']
const turno = (hhmm) => new Date(`2026-10-16T${hhmm}:00`)

test('una agenda: ocupado, no cabe por la siguiente cita y no cabe por el cierre', () => {
  const mapa = disponibilidadAgenda(SLOTS, new Set(['10:00']), 40, '11:00')
  assert.equal(mapa.get('09:00'), 'libre')
  assert.equal(mapa.get('09:40'), 'no-cabe') // 9:40 + 40 min pisa las 10:00
  assert.equal(mapa.get('10:00'), 'ocupado')
  assert.equal(mapa.get('10:20'), 'libre')
  assert.equal(mapa.get('10:40'), 'no-cabe') // termina 11:20, después del cierre
})

test('los turnos se separan por persona; los viejos (sin persona) bloquean a todos', () => {
  const docs = [
    { id: 'x_carlos', fechaHora: turno('10:00') },
    { id: 'y_laura', fechaHora: turno('09:20') },
    { id: 'z', fechaHora: turno('09:00') }, // cita de antes de tener equipo
    { id: 'w_carlos', fechaHora: new Date('2026-10-17T10:00:00') }, // otro día
  ]
  const ocupados = ocupadosDelDia(docs, '2026-10-16')
  assert.deepEqual([...ocupadosDe(ocupados, 'carlos')].sort(), ['09:00', '10:00'])
  assert.deepEqual([...ocupadosDe(ocupados, 'laura')].sort(), ['09:00', '09:20'])
})

test('"Cualquiera": libre si alguien lo tiene libre, y asigna a esa persona', () => {
  const equipo = [{ id: 'carlos', nombre: 'Carlos' }, { id: 'laura', nombre: 'Laura' }]
  const ocupados = ocupadosDelDia([
    { id: 'a_carlos', fechaHora: turno('10:00') },
    { id: 'b_laura', fechaHora: turno('10:00') },
    { id: 'c_carlos', fechaHora: turno('09:00') },
  ], '2026-10-16')
  const { mapa, asignar } = disponibilidadCualquiera(SLOTS, ocupados, equipo, 20, '11:00')
  assert.equal(mapa.get('10:00'), 'ocupado') // los dos ocupados
  assert.equal(mapa.get('09:00'), 'libre') // Laura está libre
  assert.equal(asignar('09:00').id, 'laura')
  assert.equal(asignar('09:20').id, 'carlos') // el primero del equipo
})

test('días de trabajo y textos', () => {
  const carlos = { nombre: 'Carlos Méndez', dias: [1, 2, 3, 4, 5], activo: true }
  assert.equal(trabajaEl(carlos, new Date('2026-10-16T12:00:00')), true) // viernes
  assert.equal(trabajaEl(carlos, new Date('2026-10-17T12:00:00')), false) // sábado
  assert.equal(trabajaEl({ ...carlos, activo: false }, new Date('2026-10-16T12:00:00')), false)
  assert.equal(resumenDias([1, 2, 3, 4, 5]), 'Lunes a viernes')
  assert.equal(resumenDias([3, 4, 5, 6]), 'X · J · V · S')
  assert.equal(inicialesProfesional('Carlos Méndez'), 'CM')
  assert.equal(colorProfesional('Laura'), colorProfesional('Laura'))
})

test('horario propio: solo sus turnos y no se pasa de su salida', () => {
  const laura = { id: 'laura', nombre: 'Laura', horario: { inicio: '09:20', fin: '10:20' } }
  const vacio = ocupadosDelDia([], '2026-10-16')
  const { slots, mapa } = disponibilidadProfesional(laura, SLOTS, vacio, 40, '11:00')
  assert.deepEqual(slots, ['09:20', '09:40', '10:00'])
  assert.equal(mapa.get('09:20'), 'libre') // 9:20–10:00
  assert.equal(mapa.get('09:40'), 'libre') // 9:40–10:20, justo a su salida
  assert.equal(mapa.get('10:00'), 'no-cabe') // terminaría 10:40, después de su salida
  assert.equal(resumenHorario(laura), '9:20 a. m. – 10:20 a. m.')
  assert.equal(resumenHorario({ nombre: 'Carlos' }), 'Horario del negocio')
})

test('"Cualquiera" con horarios distintos: suma los turnos de todos', () => {
  const manana = { id: 'm', nombre: 'Mañana', horario: { inicio: '09:00', fin: '09:40' } }
  const tarde = { id: 't', nombre: 'Tarde', horario: { inicio: '10:20', fin: '11:00' } }
  const vacio = ocupadosDelDia([], '2026-10-16')
  const { slots, asignar } = disponibilidadCualquiera(SLOTS, vacio, [manana, tarde], 20, '11:00')
  assert.deepEqual(slots, ['09:00', '09:20', '10:20', '10:40']) // 9:40 y 10:00 no los cubre nadie
  assert.equal(asignar('09:20').id, 'm')
  assert.equal(asignar('10:40').id, 't')
})

test('horario por día: el del día manda sobre el general', () => {
  const laura = {
    id: 'laura',
    nombre: 'Laura',
    horario: { inicio: '09:00', fin: '10:00' },
    horariosDia: { 5: { inicio: '10:00', fin: '11:00' } }, // viernes
  }
  const vacio = ocupadosDelDia([], '2026-10-16')
  const viernes = new Date('2026-10-16T00:00:00')
  const jueves = new Date('2026-10-15T00:00:00')
  assert.deepEqual(disponibilidadProfesional(laura, SLOTS, vacio, 20, '11:00', viernes).slots, ['10:00', '10:20', '10:40'])
  assert.deepEqual(disponibilidadProfesional(laura, SLOTS, vacio, 20, '11:00', jueves).slots, ['09:00', '09:20', '09:40'])
  assert.equal(resumenHorario(laura), 'Horario según el día')
  assert.equal(resumenHorario(laura, 5), '10:00 a. m. – 11:00 a. m.')
})

test('la hora del almuerzo no se reserva y un servicio no puede cruzarla', () => {
  const sinTurnos = { general: new Set(), porProfesional: new Map() }
  const ana = { id: 'ana', nombre: 'Ana', almuerzo: { inicio: '09:40', fin: '10:20' } }
  const { slots, mapa } = disponibilidadProfesional(ana, SLOTS, sinTurnos, 40, '11:00', 3)
  assert.deepEqual(slots, ['09:00', '09:20', '10:20', '10:40'])
  assert.equal(mapa.get('09:00'), 'libre') // 9:00–9:40, justo antes del almuerzo
  assert.equal(mapa.get('09:20'), 'no-cabe') // terminaría 10:00, ya en el almuerzo
  assert.equal(resumenAlmuerzo(ana), 'Almuerzo 9:40 a. m. – 10:20 a. m.')
})

test('el almuerzo puede cambiar según el día', () => {
  const sinTurnos = { general: new Set(), porProfesional: new Map() }
  const ana = { id: 'ana', nombre: 'Ana', almuerzosDia: { 1: { inicio: '09:00', fin: '09:40' }, 6: { inicio: '10:00', fin: '10:40' } } }
  assert.deepEqual(disponibilidadProfesional(ana, SLOTS, sinTurnos, 20, '11:00', 1).slots, ['09:40', '10:00', '10:20', '10:40'])
  assert.deepEqual(disponibilidadProfesional(ana, SLOTS, sinTurnos, 20, '11:00', 6).slots, ['09:00', '09:20', '09:40', '10:40'])
  assert.equal(almuerzoDe(ana, 2), null) // ese día no tiene almuerzo
  assert.equal(resumenAlmuerzo(ana), 'Almuerzo según el día')
})
