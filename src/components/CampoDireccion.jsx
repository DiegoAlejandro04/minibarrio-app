import { useEffect, useRef, useState } from 'react'
import { buscarSugerenciasDireccion } from '../maps/osm.js'

// Input de dirección con autocompletado de Nominatim/OpenStreetMap: mientras
// se escribe, sugiere direcciones reales de Bogotá para elegir, en vez de
// solo geocodificar el texto libre al guardar (ver RegisterBusiness.jsx y
// EditarNegocioModal.jsx, que llaman a onSeleccion con las coordenadas de la
// sugerencia elegida).
export default function CampoDireccion({ value, onChange, onSeleccion, required, placeholder, style }) {
  const [sugerencias, setSugerencias] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const contenedorRef = useRef(null)

  useEffect(() => {
    if (!abierto) return
    let cancelado = false
    setCargando(true)
    const id = setTimeout(async () => {
      try {
        const resultados = await buscarSugerenciasDireccion(value)
        if (!cancelado) setSugerencias(resultados)
      } catch {
        if (!cancelado) setSugerencias([])
      } finally {
        if (!cancelado) setCargando(false)
      }
    }, 400) // deja de escribir un momento antes de consultar Nominatim
    return () => { cancelado = true; clearTimeout(id) }
  }, [value, abierto])

  useEffect(() => {
    function onClickFuera(e) {
      if (!contenedorRef.current?.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [])

  function elegir(sugerencia) {
    onChange(sugerencia.direccion)
    onSeleccion?.({ direccion: sugerencia.direccion, ubicacion: { lat: sugerencia.lat, lng: sugerencia.lng } })
    setSugerencias([])
    setAbierto(false)
  }

  const mostrarDropdown = abierto && (cargando || sugerencias.length > 0)

  return (
    <div ref={contenedorRef} style={{ position: 'relative' }}>
      <input
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        style={style}
        autoComplete="off"
      />
      {mostrarDropdown && (
        <div
          className="card"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20, maxHeight: 220, overflowY: 'auto', padding: 4 }}
        >
          {cargando && <div style={{ padding: '8px 10px', fontSize: 12.5, color: 'var(--text-faint)' }}>Buscando…</div>}
          {!cargando && sugerencias.map((s, i) => (
            <button
              key={`${s.lat}-${s.lng}-${i}`}
              type="button"
              onClick={() => elegir(s)}
              className="campo-direccion-sugerencia"
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 13,
                background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--text)', cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
