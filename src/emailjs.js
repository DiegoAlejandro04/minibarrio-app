// Envío de correos con EmailJS (https://www.emailjs.com), sin backend propio.
// Lo usan los formularios del pie de página (PqrsModal.jsx y
// ContactoModal.jsx). El correo destino vive en cada plantilla de EmailJS, no
// en este código, así que el usuario nunca lo ve.
//
// Estos valores son públicos por diseño (EmailJS los usa desde el navegador)
// y no dan acceso a la cuenta — por eso van aquí y no en .env, así los
// formularios funcionan en cualquier copia del repo. Lo que evita el abuso es
// la lista de dominios permitidos en EmailJS (Account → Security).
const EMAILJS_SERVICE_ID = 'service_kl7auqu'
const EMAILJS_PUBLIC_KEY = 'y1UDrQ5yudYs0NcDt'
const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send'

export const PLANTILLA_PQRS = 'template_hq5ndy8'
export const PLANTILLA_CONTACTO = 'template_z98qhzd'

// Espera mínima entre envíos de un mismo formulario desde el mismo navegador,
// para que nadie llene el buzón en ráfaga (EmailJS gratis da 200 al mes).
const ESPERA_ENTRE_ENVIOS_MS = 60 * 1000

function leerUltimoEnvio(clave) {
  try {
    return Number(localStorage.getItem(clave)) || 0
  } catch {
    return 0
  }
}

function guardarUltimoEnvio(clave) {
  try {
    localStorage.setItem(clave, String(Date.now()))
  } catch {
    // Sin almacenamiento (modo privado): simplemente no hay espera.
  }
}

/** Segundos que faltan para poder volver a enviar ese formulario (0 si ya puede). */
export function segundosParaReenviar(clave) {
  const restante = leerUltimoEnvio(clave) + ESPERA_ENTRE_ENVIOS_MS - Date.now()
  return restante > 0 ? Math.ceil(restante / 1000) : 0
}

/**
 * Envía un correo con la plantilla indicada. `parametros` debe tener las
 * mismas variables {{...}} que usa la plantilla en EmailJS. `clave` identifica
 * el formulario para la espera entre envíos.
 */
export async function enviarCorreo(plantilla, parametros, clave) {
  const resp = await fetch(EMAILJS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: plantilla,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: parametros,
    }),
  })
  if (!resp.ok) throw new Error(`EmailJS respondió ${resp.status}: ${await resp.text()}`)
  guardarUltimoEnvio(clave)
}
