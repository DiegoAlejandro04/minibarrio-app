import { useEffect, useRef } from 'react'
import { L, CENTRO_BRITALIA, reverseGeocodeDireccion } from '../maps/osm.js'

const EPS = 1e-7
const mismaUbicacion = (a, b) => a && b && Math.abs(a.lat - b.lat) < EPS && Math.abs(a.lng - b.lng) < EPS

// Mapa con un pin: arrastrarlo o hacer clic en otro punto fija la ubicación
// exacta del negocio. Cada vez que el pin se mueve por una acción del
// usuario se recalcula la dirección en texto con geocodificación inversa
// (Nominatim) y se reporta hacia arriba junto a las coordenadas — igual
// forma que una sugerencia elegida en CampoDireccion.jsx, para que ambos
// caminos (escribir la dirección o mover el pin) mantengan sincronizados el
// texto y las coordenadas.
export default function MapaUbicacion({ ubicacion, onCambiar, altura = 200 }) {
  const divRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const colocarRef = useRef(null)
  const ultimaEmitidaRef = useRef(null)
  const onCambiarRef = useRef(onCambiar)
  onCambiarRef.current = onCambiar

  useEffect(() => {
    const centro = ubicacion || CENTRO_BRITALIA
    const mapa = L.map(divRef.current, { zoomControl: true }).setView([centro.lat, centro.lng], ubicacion ? 17 : 15)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapa)
    mapRef.current = mapa

    function colocar(lat, lng, { reportar }) {
      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapa)
        markerRef.current.on('dragend', () => {
          const p = markerRef.current.getLatLng()
          colocar(p.lat, p.lng, { reportar: true })
        })
      } else {
        markerRef.current.setLatLng([lat, lng])
      }
      if (reportar) {
        ultimaEmitidaRef.current = { lat, lng }
        reverseGeocodeDireccion({ lat, lng })
          .then((direccion) => onCambiarRef.current({ direccion, ubicacion: { lat, lng } }))
          .catch(() => onCambiarRef.current({ direccion: null, ubicacion: { lat, lng } }))
      }
    }
    colocarRef.current = colocar

    if (ubicacion) colocar(ubicacion.lat, ubicacion.lng, { reportar: false })

    mapa.on('click', (e) => colocar(e.latlng.lat, e.latlng.lng, { reportar: true }))

    return () => {
      mapa.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // El mapa se crea una sola vez; los cambios posteriores de `ubicacion`
    // (p. ej. al elegir una sugerencia del autocompletado) los sincroniza el
    // efecto de abajo, sin recrear el mapa ni el pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ubicacion || !colocarRef.current || mismaUbicacion(ultimaEmitidaRef.current, ubicacion)) return
    colocarRef.current(ubicacion.lat, ubicacion.lng, { reportar: false })
    mapRef.current?.panTo([ubicacion.lat, ubicacion.lng])
  }, [ubicacion])

  return (
    <div>
      <div
        ref={divRef}
        style={{ height: altura, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      />
      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>
        Arrastra el pin o haz clic en el mapa para ajustar la ubicación exacta.
      </div>
    </div>
  )
}
