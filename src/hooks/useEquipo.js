import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

// Equipo de un negocio en tiempo real (ver src/equipo.js), en el orden en
// que se agregó. `cargado` distingue "sin equipo" de "todavía cargando".
export default function useEquipo(negocioId) {
  const [equipo, setEquipo] = useState([])
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    if (!negocioId) return undefined
    return onSnapshot(
      collection(db, 'negocios', negocioId, 'profesionales'),
      (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        lista.sort((a, b) => (a.creadoEn?.toMillis?.() ?? Infinity) - (b.creadoEn?.toMillis?.() ?? Infinity))
        setEquipo(lista)
        setCargado(true)
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.error(err)
        setCargado(true)
      },
    )
  }, [negocioId])

  return { equipo, cargado }
}
