// "Laura Martínez Gómez" → "Laura M.": nombre corto con el que se firma una
// reseña (ver CalificarModal.jsx). Solo nombre + inicial del primer
// apellido, para no exponer el nombre completo del cliente.
export function nombreCorto(nombre) {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return ''
  return partes.length > 1 ? `${partes[0]} ${partes[1][0].toUpperCase()}.` : partes[0]
}
