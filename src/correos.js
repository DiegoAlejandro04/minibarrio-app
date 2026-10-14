// Dominios de correo aceptados al crear una cuenta (cliente o negocio):
// solo proveedores reales de uso común. Las cuentas que ya existen no se
// revisan, por eso las de prueba con dominios como "ejemplo" siguen
// entrando; la regla aplica solo al registrarse.
export const DOMINIOS_PERMITIDOS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'outlook.es', 'hotmail.com', 'hotmail.es', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.es', 'ymail.com',
  'icloud.com', 'me.com', 'mac.com',
]

/** Dominio del correo en minúsculas ("" si aún no tiene "@"). */
function dominioDe(correo) {
  const arroba = correo.lastIndexOf('@')
  return arroba === -1 ? '' : correo.slice(arroba + 1).trim().toLowerCase()
}

/**
 * Mensaje para mostrar debajo del campo de correo, o null si el dominio está
 * permitido. Mientras se escribe ("juan@gma") no se avisa hasta que el
 * dominio tenga un punto; con `forzar` (al intentar enviar) se avisa siempre.
 */
export function avisoDominioCorreo(correo, forzar = false) {
  const dominio = dominioDe(correo)
  if (DOMINIOS_PERMITIDOS.includes(dominio)) return null
  if (!forzar && !dominio.includes('.')) return null
  return 'Usa un correo de Gmail, Outlook, Hotmail, Yahoo o iCloud.'
}

/** true si el correo es de un dominio permitido. */
export function correoPermitido(correo) {
  return DOMINIOS_PERMITIDOS.includes(dominioDe(correo))
}
