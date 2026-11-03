// Pruebas de integración de firestore.rules contra el emulador de Firestore.
// Se ejecutan con:  npm run test:reglas
// (firebase emulators:exec levanta el emulador, corre este archivo y lo apaga).
//
// Cubren tres requisitos arquitectónicamente significativos:
//   ASR-04  Control de acceso por rol (cliente / propietario / anónimo).
//   ASR-06  Ley 1581 de 2012: minimización y acceso restringido a datos personales.
//   ASR-02  Integridad de la agenda: 20 reservas simultáneas al mismo turno
//           terminan en exactamente 1 cita, 0 dobles reservas (CP-06).

import { readFileSync } from 'node:fs'
import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore'

const PROYECTO = 'demo-minibarrio'
const NEGOCIO = 'prop1'
const MIN = 60 * 1000

let env

// Una hora futura fija (en punto) para que los ids de turno sean estables.
function horaFutura(dias = 2, hora = 10, minutos = 0) {
  const f = new Date()
  f.setDate(f.getDate() + dias)
  f.setHours(hora, minutos, 0, 0)
  return Timestamp.fromMillis(f.getTime())
}

const idTurno = (ts) => String(ts.toMillis())
const comoCliente = (uid) => env.authenticatedContext(uid, { email: `${uid}@gmail.com` }).firestore()

// Datos base escritos sin reglas: 2 clientes, 1 propietario con su negocio y
// dos servicios (20 y 60 minutos).
async function sembrar(extra) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'usuarios/cli1'), { rol: 'cliente', nombre: 'Ana', correo: 'cli1@gmail.com', telefono: '3000000001' })
    await setDoc(doc(db, 'usuarios/cli2'), { rol: 'cliente', nombre: 'Beto', correo: 'cli2@gmail.com', telefono: '3000000002' })
    await setDoc(doc(db, 'usuarios/prop1'), { rol: 'propietario', nombre: 'Carla', correo: 'prop1@gmail.com' })
    await setDoc(doc(db, 'usuarios/prop2'), { rol: 'propietario', nombre: 'Dario', correo: 'prop2@gmail.com' })
    await setDoc(doc(db, `negocios/${NEGOCIO}`), { nombre: 'Barbería Uno', propietarioId: 'prop1', verificado: false })
    await setDoc(doc(db, `negocios/${NEGOCIO}/servicios/corte`), { nombre: 'Corte', precio: 20000, duracionMinutos: 20, visible: true })
    await setDoc(doc(db, `negocios/${NEGOCIO}/servicios/largo`), { nombre: 'Corte y barba', precio: 35000, duracionMinutos: 60, visible: true })
    if (extra) await extra(db)
  })
}

// Reserva como la hace la app (src/turnosOcupados.js): la cita y todos sus
// turnos de 20 minutos se escriben en un mismo batch.
function reservar(db, clienteId, fechaHora, servicioId = 'corte', duracion = 20) {
  const citaRef = doc(collection(db, 'citas'))
  const batch = writeBatch(db)
  batch.set(citaRef, {
    negocioId: NEGOCIO, clienteId, servicioId, fechaHora,
    estado: 'pendiente', creadoEn: serverTimestamp(),
  })
  for (let m = 0; m < duracion; m += 20) {
    const turno = Timestamp.fromMillis(fechaHora.toMillis() + m * MIN)
    batch.set(doc(db, `negocios/${NEGOCIO}/ocupados/${idTurno(turno)}`), { fechaHora: turno, citaId: citaRef.id })
  }
  return batch.commit().then(() => citaRef.id)
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
})

after(async () => {
  await env?.cleanup()
})

describe('ASR-04 · Control de acceso por rol', () => {
  beforeEach(() => sembrar())

  it('un visitante sin sesión puede ver la vitrina pero no leer citas', async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(anon, `negocios/${NEGOCIO}`)))
    await assertFails(getDocs(query(collection(anon, 'citas'), where('clienteId', '==', 'cli1'))))
  })

  it('un cliente no puede crear un negocio', async () => {
    await assertFails(setDoc(doc(comoCliente('cli1'), 'negocios/cli1'), {
      nombre: 'Falso', propietarioId: 'cli1', verificado: false,
    }))
  })

  it('un propietario sí puede crear su negocio, pero no marcarlo como verificado', async () => {
    const db = comoCliente('prop2')
    await assertFails(setDoc(doc(db, 'negocios/prop2'), { nombre: 'Uñas Dos', propietarioId: 'prop2', verificado: true }))
    await assertSucceeds(setDoc(doc(db, 'negocios/prop2'), { nombre: 'Uñas Dos', propietarioId: 'prop2', verificado: false }))
  })

  it('un propietario no puede editar el negocio de otro', async () => {
    await assertFails(updateDoc(doc(comoCliente('prop2'), `negocios/${NEGOCIO}`), { nombre: 'Robado' }))
  })

  it('un propietario no puede reservar citas (solo el rol cliente)', async () => {
    await assertFails(reservar(comoCliente('prop2'), 'prop2', horaFutura()))
  })

  it('nadie puede cambiarse el rol', async () => {
    await assertFails(updateDoc(doc(comoCliente('cli1'), 'usuarios/cli1'), { rol: 'propietario' }))
  })

  it('una cita solo la leen su cliente y su negocio', async () => {
    const id = await reservar(comoCliente('cli1'), 'cli1', horaFutura())
    await assertSucceeds(getDoc(doc(comoCliente('cli1'), `citas/${id}`)))
    await assertSucceeds(getDoc(doc(comoCliente('prop1'), `citas/${id}`)))
    await assertFails(getDoc(doc(comoCliente('cli2'), `citas/${id}`)))
    await assertFails(getDoc(doc(comoCliente('prop2'), `citas/${id}`)))
  })

  it('el cliente solo puede cancelar su cita, no confirmarla ni completarla', async () => {
    const id = await reservar(comoCliente('cli1'), 'cli1', horaFutura())
    const db = comoCliente('cli1')
    await assertFails(updateDoc(doc(db, `citas/${id}`), { estado: 'completada' }))
    await assertSucceeds(updateDoc(doc(db, `citas/${id}`), { estado: 'cancelada', canceladaPor: 'cliente' }))
  })
})

describe('ASR-06 · Ley 1581: minimización y acceso a datos personales', () => {
  // R-02a: el negocio solo ve el perfil de un cliente con quien tiene relación
  // registrada (una cita o una reseña), nunca el de cualquier usuario.
  it('R-02a · el propietario no lee el perfil de un cliente sin relación', async () => {
    await sembrar()
    await assertFails(getDoc(doc(comoCliente('prop1'), 'usuarios/cli2')))
  })

  it('R-02a · con una cita registrada como relación, sí lo lee', async () => {
    await sembrar(async (db) => {
      await setDoc(doc(db, 'citas/c1'), { negocioId: NEGOCIO, clienteId: 'cli1', servicioId: 'corte', fechaHora: horaFutura(), estado: 'pendiente' })
    })
    const db = comoCliente('prop1')
    await assertSucceeds(setDoc(doc(db, `negocios/${NEGOCIO}/clientes/cli1`), { citaId: 'c1', creadoEn: serverTimestamp() }))
    await assertSucceeds(getDoc(doc(db, 'usuarios/cli1')))
  })

  it('R-02a · no se puede fabricar la relación con la cita de otro cliente', async () => {
    await sembrar(async (db) => {
      await setDoc(doc(db, 'citas/c1'), { negocioId: NEGOCIO, clienteId: 'cli1', servicioId: 'corte', fechaHora: horaFutura(), estado: 'pendiente' })
    })
    await assertFails(setDoc(doc(comoCliente('prop1'), `negocios/${NEGOCIO}/clientes/cli2`), { citaId: 'c1', creadoEn: serverTimestamp() }))
  })

  // R-02b: el perfil guarda solo los campos previstos (minimización).
  it('R-02b · el registro rechaza campos personales no previstos', async () => {
    await sembrar()
    const db = comoCliente('cli9')
    await assertFails(setDoc(doc(db, 'usuarios/cli9'), {
      rol: 'cliente', nombre: 'Eva', correo: 'cli9@gmail.com', consentimientoDatos: true, cedula: '1020304050',
    }))
    await assertSucceeds(setDoc(doc(db, 'usuarios/cli9'), {
      rol: 'cliente', nombre: 'Eva', correo: 'cli9@gmail.com', consentimientoDatos: true, creadoEn: serverTimestamp(),
    }))
  })

  // R-02c: ninguna cuenta existe sin la autorización de tratamiento de datos.
  it('R-02c · el registro exige la autorización de tratamiento de datos', async () => {
    await sembrar()
    const db = comoCliente('cli8')
    await assertFails(setDoc(doc(db, 'usuarios/cli8'), { rol: 'cliente', nombre: 'Fede', correo: 'cli8@gmail.com' }))
    await assertFails(setDoc(doc(db, 'usuarios/cli8'), { rol: 'cliente', nombre: 'Fede', correo: 'cli8@gmail.com', consentimientoDatos: false }))
    await assertSucceeds(setDoc(doc(db, 'usuarios/cli8'), { rol: 'cliente', nombre: 'Fede', correo: 'cli8@gmail.com', consentimientoDatos: true }))
  })

  // R-02d: lo que ve cualquiera de la agenda es solo la hora ocupada.
  it('R-02d · un turno ocupado no puede llevar datos del cliente', async () => {
    await sembrar()
    const db = comoCliente('cli1')
    const fecha = horaFutura()
    const citaRef = doc(collection(db, 'citas'))
    const batch = writeBatch(db)
    batch.set(citaRef, { negocioId: NEGOCIO, clienteId: 'cli1', servicioId: 'corte', fechaHora: fecha, estado: 'pendiente', creadoEn: serverTimestamp() })
    batch.set(doc(db, `negocios/${NEGOCIO}/ocupados/${idTurno(fecha)}`), { fechaHora: fecha, citaId: citaRef.id, clienteId: 'cli1' })
    await assertFails(batch.commit())
  })

  // R-02e: los avisos de una cuenta solo los lee esa cuenta.
  it('R-02e · nadie lee las notificaciones de otra cuenta', async () => {
    await sembrar(async (db) => {
      await setDoc(doc(db, 'usuarios/cli1/notificaciones/n1'), { tipo: 'recordatorio', titulo: 'Mañana', texto: 'Cita 10:00', leida: false })
    })
    await assertSucceeds(getDoc(doc(comoCliente('cli1'), 'usuarios/cli1/notificaciones/n1')))
    await assertFails(getDoc(doc(comoCliente('prop1'), 'usuarios/cli1/notificaciones/n1')))
  })

  it('R-02f · las cuentas no se pueden borrar desde el cliente (trazabilidad)', async () => {
    await sembrar()
    await assertFails(deleteDoc(doc(comoCliente('cli1'), 'usuarios/cli1')))
  })
})

describe('ASR-11 · Reseña verificada (función crítica)', () => {
  const resena = (citaId) => ({
    negocioId: NEGOCIO, clienteId: 'cli1', calificacion: 5, comentario: 'Muy bien',
    creadoEn: serverTimestamp(), citaId,
  })
  const ayer = () => horaFutura(-1, 10)

  it('sin una cita pasada no se puede reseñar', async () => {
    await sembrar(async (db) => {
      await setDoc(doc(db, 'citas/futura'), { negocioId: NEGOCIO, clienteId: 'cli1', servicioId: 'corte', fechaHora: horaFutura(), estado: 'pendiente' })
    })
    await assertFails(setDoc(doc(comoCliente('cli1'), `negocios/${NEGOCIO}/resenas/cli1`), resena('futura')))
  })

  it('con la cita de otro cliente o una cita cancelada tampoco', async () => {
    await sembrar(async (db) => {
      await setDoc(doc(db, 'citas/ajena'), { negocioId: NEGOCIO, clienteId: 'cli2', servicioId: 'corte', fechaHora: ayer(), estado: 'completada' })
      await setDoc(doc(db, 'citas/cancelada'), { negocioId: NEGOCIO, clienteId: 'cli1', servicioId: 'corte', fechaHora: ayer(), estado: 'cancelada' })
    })
    const db = comoCliente('cli1')
    await assertFails(setDoc(doc(db, `negocios/${NEGOCIO}/resenas/cli1`), resena('ajena')))
    await assertFails(setDoc(doc(db, `negocios/${NEGOCIO}/resenas/cli1`), resena('cancelada')))
  })

  it('con su cita pasada sí, una sola vez por negocio y sin poder firmar por otro', async () => {
    await sembrar(async (db) => {
      await setDoc(doc(db, 'citas/pasada'), { negocioId: NEGOCIO, clienteId: 'cli1', servicioId: 'corte', fechaHora: ayer(), estado: 'pendiente' })
    })
    const db = comoCliente('cli1')
    await assertFails(setDoc(doc(db, `negocios/${NEGOCIO}/resenas/cli2`), { ...resena('pasada'), clienteId: 'cli2' }))
    await assertSucceeds(setDoc(doc(db, `negocios/${NEGOCIO}/resenas/cli1`), resena('pasada')))
    // Repetir la creación es una edición del mismo documento: no cambia el autor ni duplica la reseña.
    await assertFails(setDoc(doc(db, `negocios/${NEGOCIO}/resenas/cli1`), { ...resena('pasada'), negocioId: 'otro' }))
  })
})

describe('ASR-02 · Integridad de la agenda bajo concurrencia (CP-06)', () => {
  const N = 20
  const clientes = Array.from({ length: N }, (_, i) => `conc${String(i + 1).padStart(2, '0')}`)

  beforeEach(() => sembrar(async (db) => {
    for (const uid of clientes) {
      await setDoc(doc(db, `usuarios/${uid}`), { rol: 'cliente', nombre: uid, correo: `${uid}@gmail.com` })
    }
  }))

  it(`${N} clientes reservan el mismo turno a la vez: 1 cita, 0 dobles reservas`, async () => {
    const fecha = horaFutura(3, 15)
    const resultados = await Promise.allSettled(clientes.map((uid) => reservar(comoCliente(uid), uid, fecha)))
    const exitos = resultados.filter((r) => r.status === 'fulfilled')

    let citasEnElTurno = 0
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDocs(query(collection(ctx.firestore(), 'citas'), where('fechaHora', '==', fecha)))
      citasEnElTurno = snap.size
    })

    console.log(`  reservas aceptadas: ${exitos.length} · rechazadas: ${N - exitos.length} · citas guardadas en el turno: ${citasEnElTurno}`)
    assert.equal(exitos.length, 1, 'debe aceptarse exactamente una reserva')
    assert.equal(citasEnElTurno, 1, 'no puede quedar más de una cita en el mismo turno')
  })

  it('una cita de 60 min bloquea también los turnos de +20 y +40 min', async () => {
    const fecha = horaFutura(3, 11)
    await assertSucceeds(reservar(comoCliente('conc01'), 'conc01', fecha, 'largo', 60))
    const encima = Timestamp.fromMillis(fecha.toMillis() + 20 * MIN)
    await assertFails(reservar(comoCliente('conc02'), 'conc02', encima))
    const despues = Timestamp.fromMillis(fecha.toMillis() + 60 * MIN)
    await assertSucceeds(reservar(comoCliente('conc02'), 'conc02', despues))
  })

  it('no se puede reservar en el pasado', async () => {
    const ayer = horaFutura(-1, 10)
    await assertFails(reservar(comoCliente('conc01'), 'conc01', ayer))
  })

  it('al cancelar, el turno se libera y otro cliente puede tomarlo', async () => {
    const fecha = horaFutura(4, 9)
    const db1 = comoCliente('conc01')
    const id = await reservar(db1, 'conc01', fecha)
    const batch = writeBatch(db1)
    batch.update(doc(db1, `citas/${id}`), { estado: 'cancelada', canceladaPor: 'cliente' })
    batch.delete(doc(db1, `negocios/${NEGOCIO}/ocupados/${idTurno(fecha)}`))
    await assertSucceeds(batch.commit())
    await assertSucceeds(reservar(comoCliente('conc02'), 'conc02', fecha))
  })
})
