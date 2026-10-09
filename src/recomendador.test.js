// Pruebas del motor de recomendación (RF-09). Usan el runner que ya trae
// Node (node:test), sin dependencias extra: `npm test`.
// recomendador.js no toca Firestore a propósito, así que aquí basta con
// negocios de ejemplo armados a mano.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recomendar, coincideTermino } from './recomendador.js'

const FECHA = new Date(2026, 9, 8) // fija la rotación de empates
const CERCA = { lat: 4.628, lng: -74.172 }

function negocio(id, extra = {}) {
  return {
    id,
    nombre: id,
    servicios: [{ nombre: 'Corte clásico', precio: 15000 }],
    ratingProm: 4.5,
    ratingCount: 3,
    ubicacion: CERCA,
    estado: 'abierto',
    ...extra,
  }
}

const ids = (lista) => lista.map((n) => n.id)

test('sinónimos: "fade" encuentra un servicio llamado "Desvanecido"', () => {
  const resultado = recomendar(
    [
      negocio('con-fade', { servicios: [{ nombre: 'Desvanecido', precio: 15000 }] }),
      negocio('sin-fade'),
    ],
    { servicios: ['fade'] },
    {},
    { fecha: FECHA }
  )
  assert.deepEqual(ids(resultado), ['con-fade'])
})

test('palabra completa: "color" no coincide con "colorido"', () => {
  assert.equal(coincideTermino('color', ['corte', 'colorido']), false)
  assert.equal(coincideTermino('color', ['tinte']), true)
  assert.equal(coincideTermino('barba', ['barbas']), true)
})

test('"corte fade" exige el fade, no basta con hacer cortes', () => {
  assert.equal(coincideTermino('Corte fade', ['corte', 'clasico']), false)
  assert.equal(coincideTermino('Corte fade', ['fade']), true)
})

test('un perfil sin precios ya no le gana a uno completo un poco más caro', () => {
  const resultado = recomendar(
    [
      negocio('sin-servicios', { servicios: [], ratingProm: 5, ratingCount: 3 }),
      negocio('un-poco-caro', { servicios: [{ nombre: 'Corte', precio: 22000 }] }),
    ],
    { presupuesto: 20000 },
    {},
    { fecha: FECHA }
  )
  assert.equal(resultado[0].id, 'un-poco-caro')
})

test('un negocio sin coordenadas ya no se libra de la cercanía', () => {
  const resultado = recomendar(
    [
      negocio('sin-coordenadas', { ubicacion: undefined }),
      negocio('al-lado'),
    ],
    { ubicacion: CERCA },
    {},
    { fecha: FECHA }
  )
  assert.equal(resultado[0].id, 'al-lado')
})

test('un negocio cerrado baja frente a uno abierto equivalente', () => {
  const resultado = recomendar(
    [negocio('cerrado', { estado: 'cerrado' }), negocio('abierto')],
    {},
    {},
    { fecha: FECHA }
  )
  assert.deepEqual(ids(resultado), ['abierto', 'cerrado'])
})

test('los empates rotan entre días, pero el orden es estable dentro del mismo día', () => {
  const empatados = ['a', 'b', 'c', 'd', 'e'].map((id) => negocio(id))
  const hoy = ids(recomendar(empatados, {}, {}, { fecha: FECHA }))
  assert.deepEqual(ids(recomendar(empatados, {}, {}, { fecha: FECHA })), hoy)

  const primeros = new Set()
  for (let d = 1; d <= 20; d++) {
    primeros.add(recomendar(empatados, {}, {}, { fecha: new Date(2026, 9, d) })[0].id)
  }
  assert.ok(primeros.size > 1, 'el primer lugar debería cambiar en algún día')
})

test('la rotación nunca cruza diferencias reales de puntaje', () => {
  const resultado = recomendar(
    [
      negocio('malo', { ratingProm: 1, ratingCount: 30 }),
      negocio('bueno', { ratingProm: 5, ratingCount: 30 }),
    ],
    {},
    {},
    { fecha: FECHA }
  )
  assert.deepEqual(ids(resultado), ['bueno', 'malo'])
})
