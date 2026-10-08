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

// leaflet.markercluster es un plugin UMD que se cuelga del `L` global (Leaflet
// 1.x lo publica en window.L al importarse), por eso va después del import de
// arriba y no exporta nada propio.
import 'leaflet.markercluster'

export { L }

/**
 * Marcador de negocio para el mapa de la vitrina: la primera foto del
 * portafolio en un círculo con punta, o las iniciales del negocio si no hay
 * foto (o si la foto no carga). Se arma con nodos del DOM y textContent, no
 * con un string HTML — el nombre lo escribe cualquiera al registrarse (XSS).
 */
export function crearIconoNegocio({ nombre, foto, iniciales, abierto }) {
  const raiz = document.createElement('div')
  raiz.className = 'pin-negocio'

  const burbuja = document.createElement('div')
  burbuja.className = 'pin-negocio__burbuja'

  const ponerIniciales = () => {
    burbuja.replaceChildren()
    const texto = document.createElement('span')
    texto.className = 'pin-negocio__iniciales'
    texto.textContent = iniciales
    burbuja.appendChild(texto)
  }

  if (foto) {
    const img = document.createElement('img')
    img.src = foto
    img.alt = nombre || ''
    img.loading = 'lazy'
    img.addEventListener('error', ponerIniciales, { once: true })
    burbuja.appendChild(img)
  } else {
    ponerIniciales()
  }
  raiz.appendChild(burbuja)

  if (abierto) {
    const punto = document.createElement('span')
    punto.className = 'pin-negocio__abierto'
    raiz.appendChild(punto)
  }

  // El tamaño visual real lo controla el CSS (.pin-negocio); aquí solo se
  // ancla la punta del pin (abajo al centro) sobre la coordenada.
  return L.divIcon({ html: raiz, className: '', iconSize: [44, 52], iconAnchor: [22, 52], tooltipAnchor: [0, -46] })
}

/** Grupo de negocios cercanos: una burbuja con el número de negocios. */
export function crearIconoGrupo(cluster) {
  const raiz = document.createElement('div')
  raiz.className = 'pin-grupo'
  raiz.textContent = String(cluster.getChildCount())
  return L.divIcon({ html: raiz, className: '', iconSize: [40, 40] })
}

/** "Tú estás aquí": punto con pulso, distinto a propósito de los negocios. */
export function crearIconoUsuario() {
  const raiz = document.createElement('div')
  raiz.className = 'pin-usuario'
  raiz.appendChild(document.createElement('span'))
  return L.divIcon({ html: raiz, className: '', iconSize: [18, 18], iconAnchor: [9, 9] })
}

// Centro aproximado de Britalia, Kennedy — único barrio donde opera este
// prototipo (ver ClientHome.jsx). Se usa como punto de partida del mapa de
// ubicación cuando un negocio todavía no tiene coordenadas guardadas.
export const CENTRO_BRITALIA = { lat: 4.628, lng: -74.172 }

// Tiles estándar de OpenStreetMap — no hay una fuente de tiles oscuros
// realmente gratis y sin API key (CARTO, que sí la ofrecía, ahora la exige).
// El modo oscuro del mapa se logra aparte con un filtro CSS sobre estos
// mismos tiles (ver ".leaflet-tile-pane" en index.css), no cambiando de
// servidor.
export function crearCapaTiles() {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  })
}

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

/**
 * Recorta una dirección a sus primeros componentes útiles (calle + barrio),
 * descartando jerarquía administrativa de relleno. Se usa tanto al guardar
 * (autocompletado y pin, ver abajo) como al mostrar en espacios compactos —
 * ahí sirve además de respaldo para direcciones largas guardadas antes de
 * este recorte, o escritas a mano con ese mismo estilo verboso.
 */
export function acortarDireccion(displayName) {
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
