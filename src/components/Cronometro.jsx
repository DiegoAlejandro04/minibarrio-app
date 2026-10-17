import { useEffect, useState } from 'react'

// Tiempo que lleva una cita "En proceso" (desde que el negocio la inició, ver
// OwnerAgenda.jsx), contando cada segundo: "4:07" o "1:02:30".

const dos = (n) => String(n).padStart(2, '0')

function inicioEnMs(desde) {
  if (!desde) return null
  if (desde.toDate) return desde.toDate().getTime()
  if (desde instanceof Date) return desde.getTime()
  return null
}

export default function Cronometro({ desde }) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const inicio = inicioEnMs(desde) ?? ahora
  const total = Math.max(0, Math.floor((ahora - inicio) / 1000))
  const horas = Math.floor(total / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  const segundos = total % 60
  const texto = horas ? `${horas}:${dos(minutos)}:${dos(segundos)}` : `${minutos}:${dos(segundos)}`
  return <span className="cronometro">{texto}</span>
}
