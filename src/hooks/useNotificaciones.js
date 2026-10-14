import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config'

// Notificaciones de una cuenta en tiempo real (ver src/notificaciones.js):
// las 50 más recientes, cuántas no se han leído, y `cargadas` para saber
// cuándo ya llegó la primera respuesta (antes no se crean avisos propios,
// para no duplicar los que ya existen).
export default function useNotificaciones(uid) {
  const [notificaciones, setNotificaciones] = useState([])
  const [cargadas, setCargadas] = useState(false)

  useEffect(() => {
    if (!uid) return undefined
    const consulta = query(collection(db, 'usuarios', uid, 'notificaciones'), orderBy('creadoEn', 'desc'), limit(50))
    return onSnapshot(
      consulta,
      (snap) => {
        // creadoEn llega null un instante mientras el servidor pone la hora.
        setNotificaciones(snap.docs.map((d) => ({ id: d.id, ...d.data(), fecha: d.data().creadoEn?.toDate?.() || null })))
        setCargadas(true)
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.error(err)
        setCargadas(true)
      },
    )
  }, [uid])

  // Las ocultas (avisos propios que la persona quitó con la ✕, ver
  // eliminarNotificacion) no se muestran, pero siguen existiendo para que no
  // se vuelvan a crear.
  const visibles = notificaciones.filter((n) => !n.oculta)
  return {
    notificaciones: visibles,
    sinLeer: visibles.filter((n) => !n.leida).length,
    cargadas,
  }
}
