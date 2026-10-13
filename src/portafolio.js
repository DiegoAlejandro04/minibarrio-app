import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase/config'

// Fotos del portafolio de un negocio. Hay dos orígenes:
//   - Las subidas desde el panel (OwnerPortafolio.jsx): comprimidas en el
//     navegador (imagenes.js), una por documento en
//     negocios/{id}/fotosPortafolio, con un texto opcional y el servicio
//     relacionado. Van aparte del documento del negocio porque la vitrina
//     lee los documentos de todos los negocios; en él solo queda una
//     miniatura de la foto principal (campo `miniatura`) para su tarjeta.
//   - Las antiguas, agregadas pegando un enlace (campo `fotos` del negocio).
//     Se siguen mostrando, después de las subidas.

export const MAX_FOTOS_PORTAFOLIO = 12

export function usePortafolio(negocio) {
  const negocioId = negocio?.id
  const [subidas, setSubidas] = useState([])

  useEffect(() => {
    if (!negocioId) return undefined
    return onSnapshot(
      collection(db, 'negocios', negocioId, 'fotosPortafolio'),
      (snap) => setSubidas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setSubidas([])
    )
  }, [negocioId])

  const principalId = negocio?.fotoPrincipalId
  const ordenadas = [...subidas].sort((a, b) => {
    // La principal primero; después, en el orden en que se subieron.
    if (a.id === principalId) return -1
    if (b.id === principalId) return 1
    return (a.orden || 0) - (b.orden || 0)
  })
  const deEnlace = (negocio?.fotos || []).map((url) => ({ id: `enlace:${url}`, imagen: url, titulo: '', deEnlace: true }))
  return { fotos: [...ordenadas, ...deEnlace], subidas: ordenadas }
}
