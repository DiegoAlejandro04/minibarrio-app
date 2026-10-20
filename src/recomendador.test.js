// Pruebas del motor de recomendación (RF-09). Usan el runner que ya trae
// Node (node:test), sin dependencias extra: `npm test`.
// recomendador.js no toca Firestore a propósito, así que aquí basta con
// negocios de ejemplo armados a mano.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recomendar, coincideTermino, PESOS } from './recomendador.js'

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

test('los pesos son los de la Tabla 16 del documento y suman 1', () => {
  assert.deepEqual(PESOS, { precio: 0.245, historial: 0.214, calificacion: 0.182, cercania: 0.182, servicio: 0.177 })
  const suma = Object.values(PESOS).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(suma - 1) < 1e-9)
})

test('sin presupuesto, el precio se compara con el rango del barrio', () => {
  const resultado = recomendar(
    [
      negocio('costoso', { servicios: [{ nombre: 'Corte', precio: 30000 }] }),
      negocio('economico', { servicios: [{ nombre: 'Corte', precio: 10000 }] }),
    ],
    {},
    {},
    { fecha: FECHA }
  )
  assert.equal(resultado[0].id, 'economico')
  assert.equal(resultado[0].componentes.precio, 1)
  assert.equal(resultado[1].componentes.precio, 0)
  assert.ok(resultado[0].razones.includes('De los más económicos'))
})

test('el rango de precios solo compara negocios que ofrecen lo buscado', () => {
  const resultado = recomendar(
    [
      negocio('solo-cortes', { servicios: [{ nombre: 'Corte clásico', precio: 10000 }] }),
      negocio('color', { servicios: [{ nombre: 'Tinte', precio: 40000 }] }),
    ],
    { servicios: ['tinte'] },
    {},
    { fecha: FECHA }
  )
  // Es el único que ofrece tinte: no se castiga por costar más que un corte.
  assert.deepEqual(ids(resultado), ['color'])
  assert.equal(resultado[0].componentes.precio, null)
})

test('H-01: un negocio sin reseñas no hereda las 5 estrellas del barrio', () => {
  const base = { ubicacion: null, horarios: null, servicios: [{ nombre: 'Corte', precio: 15000 }] }
  const calificado = { ...base, id: 'calificado', nombre: 'Calificado', ratingProm: 5, ratingCount: 2 }
  const nuevo = { ...base, id: 'nuevo', nombre: 'Nuevo', ratingProm: null, ratingCount: 0 }
  const [primero] = recomendar([nuevo, calificado], {}, {}, { fecha: new Date('2026-10-20T12:00:00') })
  assert.equal(primero.id, 'calificado')
  const porId = Object.fromEntries(recomendar([nuevo, calificado]).map((n) => [n.id, n.componentes.calificacion]))
  assert.ok(porId.calificado > porId.nuevo)
  assert.ok(porId.nuevo < 0.8) // ya no parte de 5/5 = 1
})
