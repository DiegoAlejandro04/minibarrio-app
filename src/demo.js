// Modo demo SOLO para desarrollo: con `?demo` en la dirección de localhost
// (p. ej. http://localhost:5173/?demo=1), la vitrina agrega negocios y reseñas
// de mentira para ver cómo se ve con más datos. No escribe nada en Firestore
// — vive solo en el navegador de quien lo abre — y no llega a la versión
// publicada: `import.meta.env.DEV` es false en `npm run build`, así que Vite
// descarta este código del bundle de producción.
//
// ?demo=N agrega N negocios (1 a 4); ?demo solo, 1. Los portafolios de los
// negocios demo no existen ("Ver portafolio" lleva a "no encontrado").

import { HORARIO_INICIAL } from './horarios.js'

export function negociosDemoActivos() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return 0
  const params = new URLSearchParams(window.location.search)
  if (!params.has('demo')) return 0
  const n = Number(params.get('demo')) || 1
  return Math.min(Math.max(n, 1), NEGOCIOS_DEMO.length)
}

// Todos los días abiertos de 6 a. m. a 11 p. m.: así salen "Abiertos" casi a
// cualquier hora en que se pruebe.
const HORARIO_AMPLIO = Object.fromEntries(
  Object.keys(HORARIO_INICIAL).map((dia) => [dia, { activo: true, apertura: '06:00', cierre: '23:00' }])
)

export const NEGOCIOS_DEMO = [
  {
    id: 'demo-kings',
    nombre: 'Kings Barber',
    descripcion: 'Fades, barba clásica y diseño',
    direccion: 'Carrera 81H, Britalia',
    ubicacion: { lat: 4.6272, lng: -74.1735 },
    especialidades: ['Corte fade', 'Barba'],
    horarios: HORARIO_AMPLIO,
    fotos: [],
  },
  {
    id: 'demo-estilo51',
    nombre: 'Estilo 51',
    descripcion: 'Cortes para niños y adultos',
    direccion: 'Calle 49 Sur, Britalia',
    ubicacion: { lat: 4.6295, lng: -74.1702 },
    especialidades: ['Niños', 'Clásico'],
    horarios: HORARIO_AMPLIO,
    fotos: [],
  },
  {
    id: 'demo-glow',
    nombre: 'Glow Estética',
    descripcion: 'Cejas, color y cuidado facial',
    direccion: 'Carrera 80I, Britalia',
    ubicacion: { lat: 4.6262, lng: -74.1708 },
    especialidades: ['Cejas', 'Color'],
    horarios: HORARIO_INICIAL,
    fotos: [],
  },
  {
    id: 'demo-navaja',
    nombre: 'La Navaja',
    descripcion: 'Barbería tradicional con domicilio',
    direccion: 'Calle 51 Sur, Gran Britalia',
    ubicacion: { lat: 4.6301, lng: -74.1741 },
    especialidades: ['Domicilio', 'Barba'],
    horarios: HORARIO_AMPLIO,
    fotos: [],
  },
]

export const SERVICIOS_DEMO = {
  'demo-kings': [{ id: 's1', nombre: 'Corte fade', precio: 12000, duracionMinutos: 30, visible: true }],
  'demo-estilo51': [{ id: 's1', nombre: 'Corte clásico', precio: 10000, duracionMinutos: 30, visible: true }],
  'demo-glow': [{ id: 's1', nombre: 'Diseño de cejas', precio: 18000, duracionMinutos: 40, visible: true }],
  'demo-navaja': [{ id: 's1', nombre: 'Barba con toalla caliente', precio: 15000, duracionMinutos: 30, visible: true }],
}

export const RATINGS_DEMO = {
  'demo-kings': { suma: 47, total: 10 },
  'demo-estilo51': { suma: 18, total: 4 },
  'demo-glow': { suma: 14, total: 3 },
  'demo-navaja': { suma: 9, total: 2 },
}

export const RESENAS_DEMO = [
  { id: 'demo-r1', negocioId: 'demo-kings', calificacion: 5, comentario: 'Excelente fade, puntual y a buen precio.', fecha: new Date(2026, 9, 12), nombreCliente: 'Camilo R.', verificada: true },
  { id: 'demo-r2', negocioId: 'demo-glow', calificacion: 5, comentario: 'Reservé en un minuto, sin hacer fila. Muy recomendado.', fecha: new Date(2026, 9, 10), nombreCliente: 'Laura M.', verificada: true },
  { id: 'demo-r3', negocioId: 'demo-estilo51', calificacion: 4, comentario: 'Muy buen corte para mi hijo, volveremos pronto.', fecha: new Date(2026, 9, 8), nombreCliente: 'Julián P.', verificada: true },
]
