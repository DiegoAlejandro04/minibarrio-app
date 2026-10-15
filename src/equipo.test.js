import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  disponibilidadAgenda, disponibilidadCualquiera, ocupadosDelDia, ocupadosDe,
  resumenDias, trabajaEl, inicialesProfesional, colorProfesional,
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
