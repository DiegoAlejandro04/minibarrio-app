// Mapa y geocodificación con OpenStreetMap — gratis, sin API key ni tarjeta
// (reemplaza al Google Maps JS API que se usaba antes, ver git log de
// src/maps/googleMaps.js). El mapa visual se arma con Leaflet (npm, sin
// script externo); direcciones → coordenadas y el autocompletado de
// direcciones usan Nominatim.
//
// Nominatim es un servicio gratuito compartido: pide como máximo una
// solicitud en vuelo a la vez y nada de ráfagas (ver
// https://operations.osmfoundation.org/policies/nominatim/). Como esto es un
// prototipo de un solo barrio, alcanza con debounce en el autocompletado
// (ver CampoDireccion.jsx) — no hace falta más.

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import marker2x from 'leaflet/dist/images/marker-icon-2x.png'
import marker from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Vite reescribe las rutas relativas que Leaflet arma por defecto para sus
// iconos, así que quedan rotas sin este ajuste.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: marker2x, iconUrl: marker, shadowUrl: markerShadow })

export { L }

// Centro aproximado de Britalia, Kennedy — único barrio donde opera este
// prototipo (ver ClientHome.jsx). Se usa como punto de partida del mapa de
// ubicación cuando un negocio todavía no tiene coordenadas guardadas.
export const CENTRO_BRITALIA = { lat: 4.628, lng: -74.172 }

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'

async function buscarNominatim(texto, limite) {
  const url = `${NOMINATIM_SEARCH_URL}?format=json&limit=${limite}&countrycodes=co&q=${encodeURIComponent(`${texto}, Bogotá, Colombia`)}`
  const resp = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!resp.ok) throw new Error(`Nominatim respondió ${resp.status}`)
  return resp.json()
}

// Nominatim devuelve la jerarquía administrativa completa (calle, barrio,
// UPZ, localidad, ciudad, departamento, código postal, país...). Para un
// campo de formulario eso es ilegible — solo interesan los primeros
// componentes útiles, descartando las etiquetas genéricas de relleno.
const SEGMENTOS_GENERICOS = /^(upzs? de .+|bogot[áa] ciudad|distrito capital|rap \(especial\) central|colombia)$/i

function acortarDireccion(displayName) {
  const partes = displayName
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^\d+$/.test(p) && !SEGMENTOS_GENERICOS.test(p))
  return partes.slice(0, 2).join(', ') || displayName
}

/** Geocodifica una dirección de texto a { lat, lng }. */
export async function geocodeDireccion(direccion) {
  const resultados = await buscarNominatim(direccion, 1)
  if (!resultados.length) throw new Error('No se pudo geocodificar la dirección.')
  return { lat: Number(resultados[0].lat), lng: Number(resultados[0].lon) }
}

/**
 * Sugerencias de direcciones para autocompletado: [{ label, direccion, lat,
 * lng }]. `label` es el texto completo (sirve para diferenciar sugerencias
 * parecidas en el dropdown); `direccion` es la versión corta que se guarda y
 * se muestra en el campo una vez elegida.
 */
export async function buscarSugerenciasDireccion(texto) {
  if (!texto || texto.trim().length < 3) return []
  const resultados = await buscarNominatim(texto, 5)
  return resultados.map((r) => ({
    label: r.display_name,
    direccion: acortarDireccion(r.display_name),
    lat: Number(r.lat),
    lng: Number(r.lon),
  }))
}

/** Geocodificación inversa: de { lat, lng } a una dirección en texto (corta). */
export async function reverseGeocodeDireccion({ lat, lng }) {
  const url = `${NOMINATIM_REVERSE_URL}?format=json&lat=${lat}&lon=${lng}`
  const resp = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!resp.ok) throw new Error(`Nominatim respondió ${resp.status}`)
  const resultado = await resp.json()
  if (!resultado?.display_name) throw new Error('No se pudo obtener la dirección de ese punto.')
  return acortarDireccion(resultado.display_name)
}
