import { test } from 'node:test'
import assert from 'node:assert/strict'
import { citaQueChoca, intervalosDeCitas, turnosQueChocan } from './citasCliente.js'

const SLOTS = ['09:20', '09:40', '10:00', '10:20', '10:40', '11:00']
const cita = (hhmm, extra = {}) => ({ id: hhmm, fechaHora: new Date(`2026-11-03T${hhmm}:00`), estado: 'pendiente', ...extra })

test('con una cita de 40 min a las 10:00 no puede tomar otra que se le cruce', () => {
  const intervalos = intervalosDeCitas([cita('10:00')], () => 40)
  // Otra cita de 40 min: 9:20 cabe justo antes (termina 10:00); 9:40 a 10:20 chocan; 10:40 cabe justo después.
  assert.deepEqual([...turnosQueChocan(SLOTS, '2026-11-03', 40, intervalos)], ['09:40', '10:00', '10:20'])
})

test('las citas canceladas no bloquean nada', () => {
  const intervalos = intervalosDeCitas([cita('10:00', { estado: 'cancelada' })], () => 40)
  assert.equal(turnosQueChocan(SLOTS, '2026-11-03', 40, intervalos).size, 0)
})

test('dice con cuál cita choca, y sin duración cuenta 20 minutos', () => {
  const intervalos = intervalosDeCitas([cita('10:00')], () => undefined)
  assert.equal(citaQueChoca(intervalos, new Date('2026-11-03T10:10:00').getTime(), 20).cita.id, '10:00')
  assert.equal(citaQueChoca(intervalos, new Date('2026-11-03T10:20:00').getTime(), 20), null)
})
