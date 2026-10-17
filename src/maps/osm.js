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

// Las funciones de direcciones viven en direcciones.js (sin Leaflet); se
// reexportan para quien ya usa el mapa.
export {
  CENTRO_BRITALIA, acortarDireccion, geocodeDireccion, buscarSugerenciasDireccion, reverseGeocodeDireccion,
} from './direcciones.js'

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


// Tiles estándar de OpenStreetMap — no hay una fuente de tiles oscuros
// realmente gratis y sin API key (CARTO, que sí la ofrecía, ahora la exige).
// El modo oscuro del mapa se logra aparte con un filtro CSS sobre estos
// mismos tiles (ver ".leaflet-tile-pane" en index.css), no cambiando de
// servidor.
//
// Cada cuadro se dibuja en un <canvas> en vez de un <img>: se ve igual, pero
// el navegador no cuenta un canvas como "contenido más grande" (LCP). Con
// <img>, en el celular el LCP era un cuadro del mapa — lo último en llegar —
// y la vitrina medía ~7-9 s en Lighthouse. OpenStreetMap permite dibujar sus
// cuadros en canvas (responde con CORS abierto).
const CapaCuadrosCanvas = L.GridLayer.extend({
  createTile(coords, listo) {
    const lienzo = document.createElement('canvas')
    const tamano = this.getTileSize()
    lienzo.width = tamano.x
    lienzo.height = tamano.y
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      lienzo.getContext('2d').drawImage(img, 0, 0, tamano.x, tamano.y)
      listo(null, lienzo)
    }
    img.onerror = (err) => listo(err, lienzo)
    img.src = `https://tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`
    return lienzo
  },
})

export function crearCapaTiles() {
  return new CapaCuadrosCanvas({
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  })
}

/**
 * Crea el mapa con el crédito "© OpenStreetMap" que exige la licencia de
 * OSM (ODbL), pero discreto: sin el prefijo "Leaflet" + bandera (Leaflet no
 * lo exige) y arriba a la izquierda, debajo del zoom — abajo lo tapaba la
 * tarjeta del negocio destacado (ClientHome.jsx). Estilo en index.css
 * (.leaflet-control-attribution).
 */
export function crearMapa(div, opciones = {}) {
  const mapa = L.map(div, { zoomControl: true, attributionControl: false, ...opciones })
  L.control.attribution({ prefix: false, position: 'topleft' }).addTo(mapa)
  return mapa
}
