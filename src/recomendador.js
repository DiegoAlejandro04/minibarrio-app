// Motor de recomendación híbrido para la plataforma de barberías de Britalia.
// Corre en el navegador (React), sin Cloud Functions: sirve con el plan Spark de Firebase.
// RF-09. Ver docs/MODELO_DATOS.md para el esquema real que asume este archivo:
// "servicios" y "resenas" son subcolecciones (no arrays dentro de "negocios"),
// y los servicios no tienen un campo "tipo" de catálogo fijo, solo "nombre"
// libre — por eso el emparejamiento de servicio es por texto, no por enum.

// Pesos derivados de la Tabla 14 de la encuesta (porcentajes normalizados a 1).
export const PESOS = {
  precio: 0.24,
  historial: 0.21,
  cercania: 0.19,
  servicio: 0.18,
  calificacion: 0.18,
}

const DISTANCIA_MAXIMA_KM = 2 // más lejos que esto puntúa 0 en cercanía
const RESENAS_DE_CONFIANZA = 5 // "votos previos" del promedio bayesiano
const NOTA_MINIMA_GUSTO = 4 // desde cuántas estrellas se considera que le gustó
const PALABRA_MINIMA = 3 // palabras de 1-2 letras ("de", "y") no cuentan como especialidad

const limitar = (x) => Math.max(0, Math.min(1, x))

// Sin acentos ni mayúsculas, para que "Barbería" y "barberia" coincidan.
const normalizar = (texto) =>
  (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

// Distancia en km entre dos puntos {lat, lng} (fórmula de Haversine).
export function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

function serviciosVisibles(negocio) {
  return (negocio.servicios || []).filter((s) => s.visible !== false)
}

// Bolsa de texto (nombre + descripción de servicios, + especialidades que el
// propietario marcó en EditarNegocioModal) para buscar coincidencias sin
// depender de un catálogo de "tipos" que no existe en el modelo de datos.
// Las especialidades importan aquí porque un chip como "Domicilio" casi
// nunca aparece como nombre de un servicio, pero sí como etiqueta marcada.
function bolsaBusqueda(negocio) {
  const textoServicios = serviciosVisibles(negocio)
    .map((s) => `${s.nombre || ''} ${s.descripcion || ''}`)
    .join(' ')
  const textoEspecialidades = (negocio.especialidades || []).join(' ')
  return normalizar(`${textoServicios} ${textoEspecialidades}`)
}

// Palabras de los nombres de servicio, usadas como proxy de "especialidad"
// solo si el negocio todavía no marcó especialidades explícitas (dato nuevo,
// ver EditarNegocioModal) — así los negocios antiguos no se quedan sin
// componente de historial.
function palabrasServicios(servicios) {
  const palabras = new Set()
  servicios.forEach((s) => {
    normalizar(s.nombre)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= PALABRA_MINIMA)
      .forEach((p) => palabras.add(p))
  })
  return palabras
}

function perfilEspecialidad(negocio) {
  if (negocio.especialidades?.length) return new Set(negocio.especialidades.map(normalizar))
  return palabrasServicios(serviciosVisibles(negocio))
}

// --- Componentes: cada uno devuelve un número de 0 a 1, o null si no aplica ---

// ¿Qué fracción de los términos buscados aparece en los servicios o en las
// especialidades marcadas del negocio?
function puntajeServicio(negocio, consulta) {
  if (!consulta.servicios?.length) return null
  const visibles = serviciosVisibles(negocio)
  if (!visibles.length && !negocio.especialidades?.length) return 0
  const bolsa = bolsaBusqueda(negocio)
  const terminos = consulta.servicios.map(normalizar).filter(Boolean)
  if (!terminos.length) return null
  const coinciden = terminos.filter((t) => bolsa.includes(t)).length
  return coinciden / terminos.length
}

// 1 si el precio cabe en el presupuesto; baja en línea recta hasta 0 al doble.
// Se abstiene (null) si el negocio no tiene servicios publicados — ahí no hay
// nada que comparar, y no es justo castigarlo como si fuera caro.
function puntajePrecio(negocio, consulta) {
  if (!consulta.presupuesto) return null
  const visibles = serviciosVisibles(negocio)
  if (!visibles.length) return null
  const terminos = consulta.servicios?.map(normalizar).filter(Boolean) ?? []
  const relevantes = terminos.length
    ? visibles.filter((s) => terminos.some((t) => bolsaBusqueda({ servicios: [s] }).includes(t)))
    : visibles
  const base = relevantes.length ? relevantes : visibles
  const precios = base.map((s) => s.precio).filter((p) => typeof p === 'number')
  if (!precios.length) return null
  const precio = Math.min(...precios)
  if (precio <= consulta.presupuesto) return 1
  return limitar(2 - precio / consulta.presupuesto)
}

// Más cerca, más puntaje. Solo si el cliente compartió su ubicación y el
// negocio ya tiene coordenadas (algunos antiguos solo tienen dirección).
function puntajeCercania(negocio, consulta) {
  if (!consulta.ubicacion || !negocio.ubicacion) return null
  const km = distanciaKm(consulta.ubicacion, negocio.ubicacion)
  return limitar(1 - km / DISTANCIA_MAXIMA_KM)
}

// Promedio bayesiano: un negocio con pocas reseñas se acerca al promedio del
// barrio, así no queda castigado (ni inflado) frente a los más activos.
function puntajeCalificacion(negocio, promedioBarrio) {
  const n = negocio.ratingCount ?? 0
  const promedio = n > 0 ? negocio.ratingProm : promedioBarrio
  const ajustado = (RESENAS_DE_CONFIANZA * promedioBarrio + n * promedio) / (RESENAS_DE_CONFIANZA + n)
  return ajustado / 5
}

// Parecido (Jaccard de especialidades, o de palabras de servicios si el
// negocio no tiene especialidades marcadas) con los negocios que al cliente
// le gustaron.
function puntajeHistorial(negocio, gustados) {
  if (!gustados.length) return null
  const propias = perfilEspecialidad(negocio)
  if (!propias.size) return null
  const parecidos = gustados.map((g) => {
    const otras = perfilEspecialidad(g)
    if (!otras.size) return 0
    const comunes = [...propias].filter((p) => otras.has(p)).length
    const union = new Set([...propias, ...otras]).size
    return union ? comunes / union : 0
  })
  return Math.max(...parecidos)
}

// Mejor señal directa de que a este cliente ya le gusta ESTE negocio, sin
// necesidad de inferir parecido con otros: su propia calificación manda
// sobre "favorito" (más reciente/matizada), y ambas mandan sobre haber
// vuelto a reservar (más débil: pudo no repetir por otras razones).
function senalDirecta({ esFavorito, notaPropia, yaReservo }) {
  const senales = []
  if (esFavorito) senales.push(1)
  if (notaPropia != null) senales.push(notaPropia / 5)
  if (yaReservo) senales.push(0.6)
  return senales.length ? Math.max(...senales) : null
}

// Texto corto para explicarle al cliente por qué le aparece cada tarjeta.
function razonesDe(componentes, negocio, { esFavorito, yaReservo }) {
  const razones = []
  if (esFavorito) razones.push('En tus favoritos')
  else if (yaReservo) razones.push('Ya reservaste aquí')
  if (componentes.servicio != null && componentes.servicio >= 0.999) razones.push('Tiene lo que buscas')
  else if (componentes.servicio > 0) razones.push('Tiene parte de lo que buscas')
  if (componentes.precio != null && componentes.precio >= 0.999) razones.push('Dentro de tu presupuesto')
  if (componentes.cercania != null && componentes.cercania >= 0.6) razones.push('Cerca de ti')
  if (!esFavorito && !yaReservo && componentes.historial != null && componentes.historial >= 0.4) {
    razones.push('Parecido a tus favoritos')
  }
  if ((negocio.ratingCount ?? 0) >= RESENAS_DE_CONFIANZA && componentes.calificacion >= 0.84) razones.push('Muy bien calificado')
  return razones
}

// --- Función principal ---
// negocios: documentos de "negocios" ya enriquecidos por el caller con
//   - servicios: [{ nombre, descripcion?, precio, visible }] (subcolección "servicios")
//   - ratingProm, ratingCount: agregados de la subcolección "resenas"
//   - ubicacion: { lat, lng } (puede faltar en negocios antiguos sin geocodificar)
// consulta: { servicios: ['corte', 'barba'], presupuesto: 25000, ubicacion: {lat, lng} }
// contextoCliente: { favoritos: [{ negocioId }], resenas: [{ negocioId, calificacion }],
//   citas: [{ negocioId, estado }] } del cliente que consulta (vacío si no hay
//   sesión o es propietario)
export function recomendar(negocios, consulta = {}, contextoCliente = {}) {
  const conResenas = negocios.filter((n) => n.ratingCount > 0)
  const promedioBarrio = conResenas.length
    ? conResenas.reduce((s, n) => s + n.ratingProm, 0) / conResenas.length
    : 3.5

  const favoritoIds = new Set((contextoCliente.favoritos || []).map((f) => f.negocioId))
  const notasPropias = new Map(
    (contextoCliente.resenas || []).map((r) => [r.negocioId, r.calificacion])
  )
  // Una cita completada es una visita real, más fuerte que un simple clic en
  // ♥ pero sin la certeza explícita de una calificación o un favorito.
  const citasCompletadasIds = new Set(
    (contextoCliente.citas || []).filter((c) => c.estado === 'completada').map((c) => c.negocioId)
  )
  const idsGustados = new Set([
    ...favoritoIds,
    ...citasCompletadasIds,
    ...[...notasPropias].filter(([, nota]) => nota >= NOTA_MINIMA_GUSTO).map(([id]) => id),
  ])
  const gustados = negocios.filter((n) => idsGustados.has(n.id))

  return negocios
    .map((negocio) => {
      const esFavorito = favoritoIds.has(negocio.id)
      const notaPropia = notasPropias.get(negocio.id)
      const yaReservo = citasCompletadasIds.has(negocio.id)

      const directa = senalDirecta({ esFavorito, notaPropia, yaReservo })
      const parecido = puntajeHistorial(negocio, gustados)

      const componentes = {
        precio: puntajePrecio(negocio, consulta),
        // La señal directa (favorito/calificación/visita) manda, pero si el
        // parecido con otros favoritos es aún mayor, se queda con ese.
        historial: directa != null ? Math.max(directa, parecido ?? 0) : parecido,
        cercania: puntajeCercania(negocio, consulta),
        servicio: puntajeServicio(negocio, consulta),
        calificacion: puntajeCalificacion(negocio, promedioBarrio),
      }

      // Suma ponderada. Los componentes en null (sin ubicación, sin
      // historial…) se omiten y su peso se reparte entre los demás.
      let suma = 0
      let pesoUsado = 0
      for (const [nombre, valor] of Object.entries(componentes)) {
        if (valor === null) continue
        suma += PESOS[nombre] * valor
        pesoUsado += PESOS[nombre]
      }
      const puntaje = pesoUsado ? suma / pesoUsado : 0

      return {
        ...negocio,
        puntaje: Math.round(puntaje * 100),
        componentes,
        esFavorito,
        razones: razonesDe(componentes, negocio, { esFavorito, yaReservo }),
      }
    })
    // Si se pidió un servicio, se descartan los negocios que no ofrecen ninguno.
    .filter((n) => n.componentes.servicio !== 0)
    .sort((a, b) => b.puntaje - a.puntaje || (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
}

/* ---------------------------------------------------------------------------
   USO EN REACT + FIRESTORE (ver src/pages/client/ClientHome.jsx)

   El caller debe unir cada negocio con sus subcolecciones antes de llamar a
   recomendar() — este módulo no toca Firestore a propósito, para poder
   probarlo con datos de ejemplo sin mockear la base de datos.

   const negociosEnriquecidos = negocios.map((n) => ({
     ...n,
     servicios: serviciosPorNegocio[n.id] || [],
     ratingProm: ratings[n.id] ? ratings[n.id].suma / ratings[n.id].total : null,
     ratingCount: ratings[n.id]?.total || 0,
   }))

   const resultados = recomendar(negociosEnriquecidos, consulta, {
     favoritos: favoritosDelCliente,
     resenas: resenasDelCliente,
     citas: citasDelCliente, // opcional — ver EditarNegocioModal.jsx para
     // cómo el propietario marca "especialidades" (también opcional) en
     // negocio.especialidades, usadas aquí si existen en vez del proxy de
     // palabras de los nombres de servicio.
   })
--------------------------------------------------------------------------- */
