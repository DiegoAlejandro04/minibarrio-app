import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  detalleAdicional, duracionDeCita, limpiarAdicionales, nombreConAdicionales, precioDeCita, totalesConAdicionales,
} from './adicionales.js'

const corte = { nombre: 'Corte fade', precio: 15000, duracionMinutos: 30 }
const barba = { nombre: 'Barba', precio: 8000, minutos: 20 }
const cejas = { nombre: 'Cejas', precio: 5000, minutos: 0 }
const pesos = (n) => `$${n}`

test('el total suma precio y tiempo de los adicionales elegidos', () => {
  assert.deepEqual(totalesConAdicionales(corte, [barba, cejas]), { precio: 28000, duracionMinutos: 50 })
  assert.deepEqual(totalesConAdicionales(corte), { precio: 15000, duracionMinutos: 30 })
})

test('una cita usa su duración guardada; las de antes, la del servicio', () => {
  assert.equal(duracionDeCita({ duracionMinutos: 50 }, corte), 50)
  assert.equal(duracionDeCita({}, corte), 30)
  assert.equal(precioDeCita({ adicionales: [barba] }, corte), 23000)
  assert.equal(precioDeCita({}, corte), 15000)
})

test('textos: nombre combinado y detalle de cada adicional', () => {
  assert.equal(nombreConAdicionales('Corte fade', [barba, cejas]), 'Corte fade + Barba + Cejas')
  assert.equal(nombreConAdicionales('Corte fade'), 'Corte fade')
  assert.equal(detalleAdicional(barba, pesos), '+$8000 · +20 min')
  assert.equal(detalleAdicional(cejas, pesos), '+$5000')
  assert.equal(detalleAdicional({ nombre: 'Lavado', precio: 0, minutos: 0 }, pesos), 'Sin costo')
})

test('al guardar se quitan las filas vacías y se limpian los números', () => {
  const filas = [
    { id: 'a', nombre: '  Barba  ', precio: '8000', minutos: '20' },
    { id: 'b', nombre: '', precio: '5000', minutos: '10' },
    { id: 'c', nombre: 'Cejas', precio: '', minutos: '' },
  ]
  assert.deepEqual(limpiarAdicionales(filas), [
    { id: 'a', nombre: 'Barba', precio: 8000, minutos: 20 },
    { id: 'c', nombre: 'Cejas', precio: 0, minutos: 0 },
  ])
})
