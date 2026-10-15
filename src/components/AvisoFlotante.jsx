import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Aviso breve arriba al centro (toast), p. ej. "Sesión cerrada" al volver a
// la vitrina. Se pide navegando con
// `state: { aviso: { titulo, texto } }` (ver handleLogout en ClientHome,
// ClientLayout y OwnerLayout). Se va solo a los DURACION_MS o con la ✕.
// Estilos .aviso-flotante en index.css (--aviso-duracion debe coincidir).

const DURACION_MS = 5000

export default function AvisoFlotante() {
  const location = useLocation()
  const navigate = useNavigate()
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    const nuevo = location.state?.aviso
    if (!nuevo) return
    setAviso(nuevo)
    // Se borra del historial: al recargar o volver atrás no se repite.
    navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, navigate])

  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(() => setAviso(null), DURACION_MS)
    return () => clearTimeout(t)
  }, [aviso])

  if (!aviso) return null
  return (
    <div className="aviso-flotante" role="status">
      <span className="aviso-flotante__icono" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span className="aviso-flotante__texto">
        <strong>{aviso.titulo}</strong>
        {aviso.texto && <span>{aviso.texto}</span>}
      </span>
      <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
