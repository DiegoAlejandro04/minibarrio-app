// Datos de identidad del negocio que se editan en el panel (OwnerIdentidad.jsx)
// y se muestran en su portafolio público (NegocioDetalle.jsx). Mismos límites
// que firestore.rules.

export const METODOS_PAGO = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
  { id: 'tarjeta', label: 'Tarjeta' },
  // Se muestra como Bre-B (las transferencias inmediatas del Banco de la
  // República); el id sigue siendo 'transferencia' para no tocar los
  // negocios que ya lo tenían marcado.
  { id: 'transferencia', label: 'Bre-B' },
]

export const etiquetaMetodoPago = (id) => METODOS_PAGO.find((m) => m.id === id)?.label || id

export const MAX_USUARIO_RED = 30

/**
 * Usuario de Instagram/TikTok a partir de lo que escriba el comerciante:
 * "@barberia", "barberia" o el enlace completo de su perfil → "barberia".
 */
export function limpiarUsuarioRed(valor) {
  let texto = (valor || '').trim()
  const enlace = texto.match(/(?:instagram\.com|tiktok\.com)\/@?([^/?#\s]+)/i)
  if (enlace) texto = enlace[1]
  return texto.replace(/^@+/, '').replace(/[^a-zA-Z0-9._]/g, '').slice(0, MAX_USUARIO_RED)
}

export const enlaceInstagram = (usuario) => `https://www.instagram.com/${usuario}`
export const enlaceTiktok = (usuario) => `https://www.tiktok.com/@${usuario}`

/**
 * Lo que le falta al perfil, en el orden en que más ayuda completarlo. El
 * primero pendiente es el "siguiente paso" de la barra "Perfil al X%" del
 * panel (OwnerLayout.jsx), con enlace directo a dónde se completa.
 */
export function pasosPerfil(negocio, servicios, tienePortada) {
  if (!negocio) return []
  const redes = negocio.canalesContacto || {}
  return [
    { listo: !!(negocio.nombre && negocio.descripcion && negocio.direccion), texto: 'Completa la descripción y dirección de tu negocio', ruta: '/panel/configuracion' },
    { listo: !!redes.whatsapp, texto: 'Agrega tu WhatsApp para que te escriban', ruta: '/panel/configuracion' },
    { listo: !!negocio.logo, texto: 'Sube tu logo para salir con él en el mapa', ruta: '/panel/identidad' },
    { listo: servicios.length > 0, texto: 'Publica tus servicios y precios', ruta: '/panel/servicios' },
    { listo: !!negocio.miniatura || (negocio.fotos || []).length > 0, texto: 'Sube fotos de tus trabajos', ruta: '/panel/portafolio' },
    { listo: (negocio.metodosPago || []).length > 0, texto: 'Indica qué métodos de pago aceptas', ruta: '/panel/identidad' },
    { listo: !!(redes.instagram || redes.tiktok), texto: 'Conecta tu Instagram o TikTok', ruta: '/panel/identidad' },
    { listo: !!tienePortada, texto: 'Sube una foto de portada de tu local', ruta: '/panel/identidad' },
  ]
}
