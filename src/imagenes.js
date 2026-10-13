// Recorte y compresión de imágenes en el navegador, para el logo y la foto de
// portada del negocio (ver OwnerIdentidad.jsx). El proyecto no tiene Firebase
// Storage (exige el plan Blaze), así que la imagen ya recortada y comprimida
// se guarda como texto (data URL) en Firestore: el logo dentro del documento
// del negocio (~15 KB) y la portada en un documento aparte (ver
// firestore.rules → medios). La imagen original nunca sale del navegador.

/** Lee un archivo de imagen elegido por el usuario y lo carga en memoria. */
export function cargarImagen(archivo) {
  return new Promise((resolve, reject) => {
    if (!archivo?.type?.startsWith('image/')) {
      reject(new Error('El archivo no es una imagen.'))
      return
    }
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    img.src = url
  })
}

/**
 * Escala base para que la imagen cubra por completo un marco de ancho×alto
 * (como object-fit: cover). El zoom del recorte multiplica esta escala.
 */
export function escalaCubrir(img, ancho, alto) {
  return Math.max(ancho / img.naturalWidth, alto / img.naturalHeight)
}

/**
 * Desplazamiento máximo (en px del marco) que se puede mover la imagen sin
 * dejar bordes vacíos, para un zoom dado.
 */
export function limitesDesplazamiento(img, ancho, alto, zoom) {
  const escala = escalaCubrir(img, ancho, alto) * zoom
  return {
    x: Math.max(0, (img.naturalWidth * escala - ancho) / 2),
    y: Math.max(0, (img.naturalHeight * escala - alto) / 2),
  }
}

/**
 * Exporta el recorte que el usuario ve en el marco (ancho×alto en pantalla)
 * a una imagen de salidaAncho×salidaAlto, comprimida. Usa WebP si el
 * navegador lo soporta (pesa menos) y si no, JPEG.
 */
export function exportarRecorte(img, { ancho, alto, zoom, dx, dy }, { salidaAncho, salidaAlto, calidad = 0.85 }) {
  const lienzo = document.createElement('canvas')
  lienzo.width = salidaAncho
  lienzo.height = salidaAlto
  const ctx = lienzo.getContext('2d')
  const proporcion = salidaAncho / ancho
  const escala = escalaCubrir(img, ancho, alto) * zoom
  const anchoImg = img.naturalWidth * escala
  const altoImg = img.naturalHeight * escala
  const izquierda = (ancho - anchoImg) / 2 + dx
  const arriba = (alto - altoImg) / 2 + dy
  // Fondo blanco: los PNG con transparencia no quedan con fondo negro al
  // pasar a JPEG.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, salidaAncho, salidaAlto)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, izquierda * proporcion, arriba * proporcion, anchoImg * proporcion, altoImg * proporcion)

  const webp = lienzo.toDataURL('image/webp', calidad)
  return webp.startsWith('data:image/webp') ? webp : lienzo.toDataURL('image/jpeg', calidad)
}

/** Tamaño aproximado en KB de un data URL (lo que ocupa en Firestore). */
export function pesoKb(dataUrl) {
  return Math.round(dataUrl.length / 1024)
}

/**
 * Reduce una foto sin recortarla (conserva su proporción) para que su lado
 * más largo mida como mucho `maxLado`, y la comprime. Para las fotos del
 * portafolio, que se muestran enteras.
 */
export function redimensionar(img, maxLado, calidad = 0.75) {
  const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight))
  const ancho = Math.round(img.naturalWidth * escala)
  const alto = Math.round(img.naturalHeight * escala)
  return exportarRecorte(img, { ancho, alto, zoom: 1, dx: 0, dy: 0 }, { salidaAncho: ancho, salidaAlto: alto, calidad })
}

/** Carga en memoria una imagen ya guardada como data URL. */
export function imagenDesdeDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    img.src = dataUrl
  })
}

/**
 * Miniatura 4:3 recortada al centro, para la tarjeta del negocio en la
 * vitrina. Va en el documento del negocio (la vitrina lee los documentos de
 * todos los negocios), así que tiene que pesar poco: ~15–25 KB.
 */
export function miniatura(img) {
  return exportarRecorte(img, { ancho: 480, alto: 360, zoom: 1, dx: 0, dy: 0 }, { salidaAncho: 480, salidaAlto: 360, calidad: 0.7 })
}
