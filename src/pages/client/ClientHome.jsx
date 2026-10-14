import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, collectionGroup, onSnapshot, query, where } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'
import {
  L, geocodeDireccion, acortarDireccion, CENTRO_BRITALIA, crearCapaTiles,
  crearIconoNegocio, crearIconoGrupo, crearIconoUsuario,
} from '../../maps/osm.js'
import useIsMobile from '../../hooks/useIsMobile.js'
import { recomendar, distanciaKm } from '../../recomendador.js'
import { ESPECIALIDADES } from '../../especialidades.js'
import Footer from '../../components/Footer.jsx'
import ComoFunciona from '../../components/ComoFunciona.jsx'
import ResenasRecientes from '../../components/ResenasRecientes.jsx'
import * as datosDemo from '../../demo.js'
import { estadoApertura } from '../../horarios.js'
import FotoNegocio, { ESTADO_APERTURA, inicialesDe } from '../../components/FotoNegocio.jsx'

// Vitrina pública de negocios (RF-05 búsqueda, RF-06 mapa, RF-09
// recomendaciones, RF-12 portafolio visible sin sesión). Muestra datos
// reales de Firestore; el mapa es una representación esquemática (no hay
// geocodificación en el modelo de datos todavía para negocios antiguos, ver
// docs/MODELO_DATOS.md). El orden y el filtrado de la vitrina los calcula el
// motor híbrido de src/recomendador.js (precio, cercanía, servicio,
// calificación e historial del cliente).

// Mismo vocabulario que el selector de especialidades de EditarNegocioModal
// (ver src/especialidades.js) — así un chip siempre puede coincidir con la
// especialidad marcada por algún negocio.
const FILTER_CHIPS = ESPECIALIDADES

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const MILES = new Intl.NumberFormat('es-CO') // solo separador de miles, sin símbolo — campo de presupuesto

// Tope del campo de presupuesto: estas son tiendas de barrio (ver Tabla 14 de
// la encuesta, precios reales entre $10.000 y $40.000), así que no tiene
// sentido dejar escribir cifras de varios millones — además de absurdo,
// rompe la alineación del campo con las flechas.
const PRESUPUESTO_MAXIMO = 200000

// Zoom máximo al encuadrar los negocios en el mapa. Sin este tope, con un
// solo negocio fitBounds se va al zoom máximo de los tiles (19) y solo se ven
// un par de cuadras sin contexto; 17 deja ver los nombres de calles alrededor.
const ZOOM_MAX_ENCUADRE = 17
// Con "Usar mi ubicación", el mapa encuadra al cliente con sus negocios más
// cercanos (ver encuadrar).
const NEGOCIOS_CERCA_ENCUADRE = 2

// "a 350 m" / "a 1,2 km" (HU-03: cada negocio muestra su distancia). Es la
// misma distancia (Haversine) con la que el recomendador calcula la cercanía.
const KM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
function textoDistancia(km) {
  if (km == null) return null
  if (km < 1) return `a ${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`
  return `a ${KM.format(km)} km`
}

// Datos de mentira para ver la vitrina con más negocios (?demo en localhost,
// ver src/demo.js). Solo existen en desarrollo.
const DEMO = import.meta.env.DEV ? datosDemo : null

// PC con mouse: pasar sobre un pin muestra ese negocio en la tarjeta y el
// clic abre su portafolio. Pantalla táctil (sin hover): el primer toque solo
// lo muestra en la tarjeta, y al portafolio se entra con su botón — si no,
// en el celular sería imposible ver la información de un pin sin salir.
const tieneHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches

// Cuándo la ubicación del cliente sirve para encuadrar el mapa. En celular
// el GPS acierta por metros, pero un PC sin GPS la estima por WiFi o IP y en
// Bogotá eso puede errar por kilómetros: encuadrar "tú + negocios" con un
// punto así aleja el mapa hasta media ciudad y las barberías quedan como
// puntitos. Más allá de estos límites el punto se dibuja igual (es honesto),
// pero el mapa se queda en el barrio y se avisa por qué.
const RADIO_BARRIO_KM = 2
const PRECISION_MAXIMA_M = 1000
// Por debajo de esto el halo de precisión no aporta (cabe dentro del punto).
const PRECISION_SIN_HALO_M = 40

export default function ClientHome() {
  const { currentUser, role, logout } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [negocios, setNegocios] = useState([])
  const [ratings, setRatings] = useState({}) // negocioId -> { suma, total }
  const [serviciosPorNegocio, setServiciosPorNegocio] = useState({}) // negocioId -> [{ nombre, precio, visible }]
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [terminoActivo, setTerminoActivo] = useState('')
  const [chipsActivos, setChipsActivos] = useState(() => new Set())
  const [presupuesto, setPresupuesto] = useState('')

  // Ubicación del cliente para el componente de cercanía del recomendador:
  // nunca se pide sola al cargar la página (RNF de privacidad), solo si el
  // cliente toca "Usar mi ubicación".
  const [ubicacionCliente, setUbicacionCliente] = useState(null)
  const [ubicacionEstado, setUbicacionEstado] = useState('inactiva') // inactiva | cargando | activa | error
  const [precisionUbicacion, setPrecisionUbicacion] = useState(null) // metros (coords.accuracy)
  const [avisoUbicacionCerrado, setAvisoUbicacionCerrado] = useState(false)

  // Señales de historial (RF-09): solo existen si hay un cliente con sesión.
  const [favoritosCliente, setFavoritosCliente] = useState([])
  const [resenasCliente, setResenasCliente] = useState([])
  const [citasCliente, setCitasCliente] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'negocios'), (snap) => {
      setNegocios(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  // Reseñas para "Lo que dicen los clientes": las buenas (4★ o más) con un
  // comentario de verdad, las más recientes primero. La sección solo se
  // muestra si hay suficientes (ver ResenasRecientes.jsx).
  const [resenasRecientes, setResenasRecientes] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, 'resenas'), (snap) => {
      const acc = {}
      const destacadas = []
      snap.docs.forEach((d) => {
        const negocioId = d.ref.parent.parent.id
        const datos = d.data()
        const calificacion = datos.calificacion || 0
        if (!acc[negocioId]) acc[negocioId] = { suma: 0, total: 0 }
        acc[negocioId].suma += calificacion
        acc[negocioId].total += 1
        const comentario = (datos.comentario || '').trim()
        if (calificacion >= 4 && comentario.length >= 8) {
          destacadas.push({
            id: d.ref.path, negocioId, calificacion, comentario,
            fecha: datos.creadoEn?.toDate?.() || null,
            nombreCliente: datos.nombreCliente || null,
            verificada: !!datos.citaId, // ver citaParaResena en firestore.rules
          })
        }
      })
      setRatings(acc)
      destacadas.sort((a, b) => (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0))
      setResenasRecientes(destacadas.slice(0, 6))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, 'servicios'), (snap) => {
      const acc = {}
      snap.docs.forEach((d) => {
        const negocioId = d.ref.parent.parent.id
        if (!acc[negocioId]) acc[negocioId] = []
        acc[negocioId].push({ id: d.id, ...d.data() })
      })
      setServiciosPorNegocio(acc)
    })
    return unsub
  }, [])

  // Favoritos y reseñas propias del cliente (si hay sesión de cliente): la
  // única fuente de "historial" que usa el recomendador, ver src/recomendador.js.
  useEffect(() => {
    if (!currentUser?.uid || role !== 'cliente') {
      setFavoritosCliente([])
      setResenasCliente([])
      setCitasCliente([])
      return
    }
    const unsubs = [
      onSnapshot(collection(db, 'usuarios', currentUser.uid, 'favoritos'), (snap) => {
        setFavoritosCliente(snap.docs.map((d) => ({ negocioId: d.id, ...d.data() })))
      }),
      onSnapshot(
        query(collectionGroup(db, 'resenas'), where('clienteId', '==', currentUser.uid)),
        (snap) => {
          setResenasCliente(snap.docs.map((d) => ({ negocioId: d.ref.parent.parent.id, ...d.data() })))
        },
        // Sin este segundo callback, un error del listener (p. ej. un índice de
        // Firestore faltante para esta consulta, ver firestore.indexes.json)
        // queda "sin capturar" en vez de solo degradar el historial del
        // recomendador — las reseñas propias del cliente son un extra, no
        // deberían poder tumbar el resto de la página.
        // eslint-disable-next-line no-console
        (err) => console.error('No se pudieron cargar las reseñas del cliente:', err)
      ),
      // Haber completado una cita es una señal de historial más (RF-09):
      // volver donde ya te atendieron antes vale casi tanto como marcar ♥.
      onSnapshot(query(collection(db, 'citas'), where('clienteId', '==', currentUser.uid)), (snap) => {
        setCitasCliente(snap.docs.map((d) => d.data()))
      }),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [currentUser?.uid, role])

  function solicitarUbicacion() {
    if (!navigator.geolocation) {
      setUbicacionEstado('error')
      return
    }
    setUbicacionEstado('cargando')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacionCliente({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setPrecisionUbicacion(pos.coords.accuracy ?? null)
        setAvisoUbicacionCerrado(false)
        setUbicacionEstado('activa')
      },
      () => setUbicacionEstado('error'),
      { timeout: 8000 }
    )
  }

  // Modo demo (solo en desarrollo, con ?demo en la dirección): suma negocios
  // y reseñas de mentira a los reales, solo en memoria. Ver src/demo.js.
  // DEMO es null en `npm run build` (import.meta.env.DEV es false): todo lo
  // que cuelga de él se elimina del bundle de producción.
  const [cantidadDemo] = useState(() => (DEMO ? DEMO.negociosDemoActivos() : 0))
  const negociosVista = useMemo(
    () => (DEMO && cantidadDemo ? [...negocios, ...DEMO.NEGOCIOS_DEMO.slice(0, cantidadDemo)] : negocios),
    [negocios, cantidadDemo]
  )
  // Memorizados: así el carrusel de reseñas (memo) no se vuelve a dibujar
  // cada vez que cambia algo de la página, como al abrir el menú ☰.
  const resenasVista = useMemo(
    () => (DEMO && cantidadDemo ? [...DEMO.RESENAS_DEMO, ...resenasRecientes] : resenasRecientes),
    [cantidadDemo, resenasRecientes]
  )
  const nombresNegocios = useMemo(
    () => Object.fromEntries([...negocios, ...(DEMO ? DEMO.NEGOCIOS_DEMO : [])].map((n) => [n.id, n.nombre])),
    [negocios]
  )

  const negociosConDatos = useMemo(
    () => negociosVista.map((n) => {
      const r = ratings[n.id] || (DEMO && cantidadDemo ? DEMO.RATINGS_DEMO[n.id] : undefined)
      const servicios = serviciosPorNegocio[n.id] || (DEMO && cantidadDemo ? DEMO.SERVICIOS_DEMO[n.id] : undefined) || []
      const preciosVisibles = servicios.filter((s) => s.visible !== false).map((s) => s.precio || 0)
      return {
        ...n,
        servicios,
        ratingProm: r && r.total > 0 ? r.suma / r.total : null,
        ratingCount: r?.total || 0,
        precioDesde: preciosVisibles.length ? Math.min(...preciosVisibles) : null,
        estado: estadoApertura(n.horarios),
      }
    }),
    [negociosVista, ratings, serviciosPorNegocio, cantidadDemo]
  )

  // Mapa real con OpenStreetMap vía Leaflet (RF-06), gratis y sin API key.
  // Usa negocio.ubicacion (lat/lng) cuando ya fue geocodificada al registrar
  // el negocio (ver RegisterBusiness.jsx); si un negocio antiguo no la
  // tiene, geocodifica su dirección al vuelo aquí mismo (sin persistirla —
  // solo el propio dueño puede escribir su documento, ver firestore.rules).
  const mapDivRef = useRef(null)
  const mapRef = useRef(null)
  const grupoRef = useRef(null) // capa de leaflet.markercluster con los negocios
  const markersRef = useRef(new Map()) // negocioId -> marker, para resaltar el destacado
  const puntosRef = useRef([])
  const destacadoIdRef = useRef(null)
  const usuarioCapaRef = useRef(null) // punto + halo de precisión del cliente
  const ubicacionEncuadreRef = useRef(null) // ubicación del cliente solo si sirve para encuadrar
  const primerEncuadreHechoRef = useRef(false)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    let cancelado = false
    if (!mapDivRef.current) return undefined

    try {
      if (!mapRef.current) {
        // Arranca ya sobre Britalia, no sobre todo Bogotá: mientras llegan los
        // negocios de Firestore el cliente ve su barrio (y se descargan los
        // tiles del zoom correcto), en vez de una ciudad entera que luego
        // salta de golpe al encuadre real.
        mapRef.current = L.map(mapDivRef.current, { zoomControl: true })
          .setView([CENTRO_BRITALIA.lat, CENTRO_BRITALIA.lng], 16)
        crearCapaTiles().addTo(mapRef.current)
        // Tocar el mapa vacío devuelve la tarjeta al recomendado (los clics
        // sobre un pin no llegan aquí: Leaflet no los propaga al mapa).
        mapRef.current.on('click', () => setSeleccionadoId(null))
        // Las barberías de un barrio suelen quedar a una o dos cuadras entre
        // sí: sin agrupar, los círculos con foto se tapan unos a otros. A
        // partir del zoom 18 ya hay espacio de sobra y se muestran todos.
        grupoRef.current = L.markerClusterGroup({
          iconCreateFunction: crearIconoGrupo,
          maxClusterRadius: 44,
          disableClusteringAtZoom: 18,
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: false,
        }).addTo(mapRef.current)
      }

      grupoRef.current.clearLayers()
      markersRef.current = new Map()

      Promise.all(
        negociosConDatos.map(async (n) => {
          let posicion = n.ubicacion
          if (!posicion) {
            if (!n.direccion) return null
            try {
              posicion = await geocodeDireccion(n.direccion)
            } catch {
              return null
            }
          }
          return { n, posicion }
        })
      ).then((resultados) => {
        if (cancelado || !mapRef.current) return
        const puntos = resultados.filter(Boolean)

        const markers = puntos.map(({ n, posicion }) => {
          // Sin tooltip: la tarjeta bajo el mapa ya muestra el negocio al
          // pasar el mouse o tocar el pin (ver tieneHover arriba).
          const marker = L.marker([posicion.lat, posicion.lng], {
            icon: crearIconoNegocio({
              nombre: n.nombre,
              // El logo identifica al negocio; si no hay, la primera foto.
              foto: n.logo || n.miniatura || n.fotos?.[0],
              iniciales: inicialesDe(n.nombre),
              abierto: n.estado === 'abierto' || n.estado === 'cierra-pronto',
            }),
            alt: n.nombre,
            riseOnHover: true,
          })
          marker.on('mouseover', () => setSeleccionadoId(n.id))
          marker.on('click', () => {
            if (tieneHover()) navigate(`/negocio/${n.id}`)
            else setSeleccionadoId(n.id)
          })
          // Al salir de un grupo, Leaflet vuelve a insertar el icono: hay que
          // reponerle el resaltado si es el destacado.
          marker.on('add', () => aplicarDestacado(destacadoIdRef.current))
          markersRef.current.set(n.id, marker)
          return marker
        })
        grupoRef.current.addLayers(markers)
        aplicarDestacado(destacadoIdRef.current)

        puntosRef.current = puntos
        // El primer encuadre, sin animación: los pines aparecen ya en su
        // sitio. Los siguientes (llegan reseñas o servicios nuevos) sí animan.
        encuadrar({ animar: primerEncuadreHechoRef.current })
        primerEncuadreHechoRef.current = true
      })
    } catch (err) {
      setMapError(true)
      // eslint-disable-next-line no-console
      console.error(err)
    }

    return () => { cancelado = true }
  }, [negociosConDatos, navigate])

  // El negocio de la tarjeta de abajo del mapa (el primero que recomienda el
  // motor) se ve más grande y con anillo de acento, para que la tarjeta y su
  // pin se lean como la misma cosa.
  function aplicarDestacado(id) {
    markersRef.current.forEach((marker, negocioId) => {
      const esDestacado = negocioId === id
      marker.setZIndexOffset(esDestacado ? 1000 : 0)
      marker.getElement()?.querySelector('.pin-negocio')?.classList.toggle('pin-negocio--destacado', esDestacado)
    })
  }

  // Encuadra los negocios y, si el cliente compartió su ubicación, a él con
  // los negocios más cercanos: lo que importa es ver qué queda cerca de uno.
  function encuadrar({ animar = true } = {}) {
    if (!mapRef.current) return
    const usuario = ubicacionEncuadreRef.current
    let coords = puntosRef.current.map((p) => [p.posicion.lat, p.posicion.lng])
    if (usuario) {
      // Solo los NEGOCIOS_CERCA_ENCUADRE más cercanos: uno lejano obligaba a
      // alejar el mapa hasta que el cliente y los negocios quedaban como
      // puntitos. Los demás pines siguen ahí, a un arrastre.
      coords = puntosRef.current
        .map((p) => ({ p, km: distanciaKm(usuario, p.posicion) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, NEGOCIOS_CERCA_ENCUADRE)
        .map(({ p }) => [p.posicion.lat, p.posicion.lng])
      coords.push([usuario.lat, usuario.lng])
    }
    if (coords.length) {
      const limites = L.latLngBounds(coords)
      // Abajo hay más margen: la tarjeta del destacado se monta ~40px sobre
      // el borde inferior del mapa y taparía un pin que quede ahí. Con la
      // ubicación el margen es menor, para que no aleje de más.
      const margenArriba = usuario ? [40, 45] : [60, 70]
      const margenAbajo = usuario ? [40, 75] : [60, 100]
      // Sin ubicación, la vista de inicio queda un nivel más lejos de lo que
      // cabría, para ver el barrio alrededor de los negocios.
      const zoomQueCabe = mapRef.current.getBoundsZoom(
        limites, false, L.point(margenArriba[0] + margenAbajo[0], margenArriba[1] + margenAbajo[1])
      )
      const zoomMaximo = usuario ? ZOOM_MAX_ENCUADRE : Math.min(zoomQueCabe, ZOOM_MAX_ENCUADRE) - 1
      mapRef.current.fitBounds(limites, {
        paddingTopLeft: margenArriba,
        paddingBottomRight: margenAbajo,
        maxZoom: zoomMaximo,
        animate: animar,
      })
    } else {
      mapRef.current.setView([CENTRO_BRITALIA.lat, CENTRO_BRITALIA.lng], 15, { animate: animar })
    }
  }

  // null si la ubicación sirve; si no, por qué no: 'lejos' (fuera del
  // barrio) o 'imprecisa' (estimada por WiFi/IP con un error enorme).
  const problemaUbicacion = useMemo(() => {
    if (!ubicacionCliente) return null
    if (precisionUbicacion != null && precisionUbicacion > PRECISION_MAXIMA_M) return 'imprecisa'
    if (distanciaKm(ubicacionCliente, CENTRO_BRITALIA) > RADIO_BARRIO_KM) return 'lejos'
    return null
  }, [ubicacionCliente, precisionUbicacion])

  // Punto "tú estás aquí": solo existe si el cliente tocó "Usar mi
  // ubicación" (nunca se pide sola, ver arriba).
  useEffect(() => {
    ubicacionEncuadreRef.current = ubicacionCliente && !problemaUbicacion ? ubicacionCliente : null
    if (!mapRef.current) return
    usuarioCapaRef.current?.remove()
    usuarioCapaRef.current = null
    if (!ubicacionCliente) return

    const capa = L.layerGroup()
    const centro = [ubicacionCliente.lat, ubicacionCliente.lng]
    // Halo de precisión, como en Google Maps: dice "estás por aquí" en vez
    // de fingir una exactitud que no hay. Con errores de kilómetros no se
    // dibuja: teñiría de azul el mapa entero (para eso ya está el aviso).
    if (precisionUbicacion != null && precisionUbicacion > PRECISION_SIN_HALO_M && precisionUbicacion <= PRECISION_MAXIMA_M) {
      L.circle(centro, {
        radius: precisionUbicacion,
        className: 'halo-usuario',
        interactive: false,
      }).addTo(capa)
    }
    L.marker(centro, {
      icon: crearIconoUsuario(),
      interactive: false,
      keyboard: false,
      zIndexOffset: 2000,
    }).addTo(capa)
    usuarioCapaRef.current = capa.addTo(mapRef.current)
    encuadrar()
  }, [ubicacionCliente, precisionUbicacion, problemaUbicacion])

  // Leaflet mide su contenedor una sola vez, al crearse. Si el layout
  // (grid de dos columnas, fuentes que todavía cargan) termina de acomodarse
  // después de ese instante, el mapa queda calculado para un ancho angosto y
  // deja una franja gris sin tiles al lado — un ResizeObserver lo mantiene
  // sincronizado con el tamaño real cada vez que cambia.
  useEffect(() => {
    if (!mapDivRef.current) return undefined
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize())
    observer.observe(mapDivRef.current)
    return () => observer.disconnect()
  }, [])

  // Vuelve a encuadrar los negocios visibles tal como al cargar — para
  // cuando el cliente se pierde navegando el mapa a mano.
  function recentrarMapa() {
    encuadrar()
  }

  const consulta = useMemo(() => {
    const servicios = [...chipsActivos]
    if (terminoActivo) servicios.push(terminoActivo)
    const presupuestoNum = Number(presupuesto)
    return {
      servicios: servicios.length ? servicios : undefined,
      presupuesto: presupuestoNum > 0 ? presupuestoNum : undefined,
      // Una ubicación lejana o muy imprecisa no se le pasa al recomendador:
      // premiaría o castigaría negocios por una cercanía que no es real. Se
      // omite igual que si el cliente no la hubiera compartido.
      ubicacion: ubicacionCliente && !problemaUbicacion ? ubicacionCliente : undefined,
    }
  }, [chipsActivos, terminoActivo, presupuesto, ubicacionCliente, problemaUbicacion])

  const hayFiltrosActivos = Boolean(consulta.servicios || consulta.presupuesto || ubicacionCliente)

  // RF-09: orden y filtrado reales (no solo texto) vía src/recomendador.js.
  // Sin filtros, igual personaliza con historial + calificación bayesiana.
  const recomendaciones = useMemo(
    () => recomendar(negociosConDatos, consulta, {
      favoritos: favoritosCliente,
      resenas: resenasCliente,
      citas: citasCliente,
    }),
    [negociosConDatos, consulta, favoritosCliente, resenasCliente, citasCliente]
  )

  // La tarjeta bajo el mapa muestra el primero del ranking, o el negocio
  // cuyo pin el cliente señaló o tocó. Si un filtro lo sacó del ranking, se
  // sigue mostrando (su pin sigue en el mapa), solo que sin razones.
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const tarjetasHorizontales = !isMobile && recomendaciones.length <= 2

  // Distancia del cliente a cada negocio, solo con una ubicación que sirve
  // (la misma que usa el recomendador: ni lejana ni muy imprecisa).
  const distanciaDe = (n) => (consulta.ubicacion && n?.ubicacion
    ? textoDistancia(distanciaKm(consulta.ubicacion, n.ubicacion))
    : null)

  const destacado = useMemo(() => {
    if (seleccionadoId) {
      const enRanking = recomendaciones.find((n) => n.id === seleccionadoId)
      if (enRanking) return enRanking
      const enMapa = negociosConDatos.find((n) => n.id === seleccionadoId)
      if (enMapa) return { ...enMapa, razones: [] }
    }
    return recomendaciones[0] || null
  }, [seleccionadoId, recomendaciones, negociosConDatos])

  useEffect(() => {
    destacadoIdRef.current = destacado?.id ?? null
    aplicarDestacado(destacadoIdRef.current)
  }, [destacado?.id])

  function handleBuscar(e) {
    e.preventDefault()
    setTerminoActivo(busqueda.trim())
    // Baja despacio hasta los resultados, ya con la búsqueda aplicada (un
    // cuadro después, cuando React volvió a pintar). scroll-margin-top en
    // index.css deja el título libre de la barra flotante.
    requestAnimationFrame(() => {
      document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleChip(chip) {
    setChipsActivos((prev) => {
      const next = new Set(prev)
      if (next.has(chip)) next.delete(chip)
      else next.add(chip)
      return next
    })
  }

  function limpiarFiltros() {
    setBusqueda('')
    setTerminoActivo('')
    setChipsActivos(new Set())
    setPresupuesto('')
    setUbicacionCliente(null)
    setUbicacionEstado('inactiva')
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  // Menú ☰ del encabezado en celular: ahí no caben el logo, "Iniciar sesión"
  // y "Registra tu negocio" en una sola fila (~420px en una pantalla de 375),
  // así que queda la acción principal a la vista y el resto en el menú. Se
  // cierra al tocar fuera, con Escape o al elegir una opción.
  const [menuAbierto, setMenuAbierto] = useState(false)
  const headerRef = useRef(null)
  useEffect(() => {
    if (!menuAbierto) return undefined
    const alTocarFuera = (e) => {
      if (!headerRef.current?.contains(e.target)) setMenuAbierto(false)
    }
    const alTeclear = (e) => {
      if (e.key === 'Escape') setMenuAbierto(false)
    }
    document.addEventListener('pointerdown', alTocarFuera)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alTocarFuera)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [menuAbierto])
  useEffect(() => {
    if (!isMobile) setMenuAbierto(false)
  }, [isMobile])

  // Enlace resaltado de la barra según la sección que se está viendo.
  const [seccionActiva, setSeccionActiva] = useState('inicio')
  useEffect(() => {
    let pendiente = false
    const revisar = () => {
      pendiente = false
      const pasada = (id) => {
        const el = document.getElementById(id)
        return el && el.getBoundingClientRect().top <= 140
      }
      setSeccionActiva(pasada('como-funciona') ? 'como-funciona' : pasada('resultados') ? 'resultados' : 'inicio')
    }
    const alDesplazar = () => {
      if (pendiente) return
      pendiente = true
      requestAnimationFrame(revisar)
    }
    revisar()
    window.addEventListener('scroll', alDesplazar, { passive: true })
    return () => window.removeEventListener('scroll', alDesplazar)
  }, [])

  function irArriba(e) {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const claseEnlace = (id) => `nav-enlace${seccionActiva === id ? ' activo' : ''}`

  return (
    <div className="vitrina">
      {/* Manchas de color de fondo: le dan algo que desenfocar al cristal
          de las tarjetas (estilos .vitrina* en index.css). */}
      <div className="vitrina-fondo" aria-hidden="true"><span /><span /><span /><span /></div>
      {/* Barra flotante de cristal (estilos .nav-* en index.css). Ocupa 0 de
          alto: flota sobre la portada, que deja el espacio arriba. z-index
          1100: por encima del mapa (Leaflet llega a 1000). */}
      <header ref={headerRef} className="nav-flotante">
        <div className="nav-pastilla">
          <Link to="/" className="nav-marca" onClick={irArriba}>
            <span className="nav-marca-icono">MB</span>
            <span>Mini<span style={{ color: 'var(--accent)' }}>Barrio</span></span>
          </Link>

          {!isMobile && (
            <nav className="nav-menu" aria-label="Secciones">
              <a href="#inicio" className={claseEnlace('inicio')} onClick={irArriba} title="Inicio">
                <Icon name="home" size={16} /> <span>Inicio</span>
              </a>
              <a href="#resultados" className={claseEnlace('resultados')} title="Explorar">
                <Icon name="search" size={16} /> <span>Explorar</span>
              </a>
              <a href="#como-funciona" className={claseEnlace('como-funciona')} title="Cómo funciona">
                <Icon name="info" size={16} /> <span>Cómo funciona</span>
              </a>
              <Link to="/registro/negocio" className="nav-enlace" title="Para negocios">
                <Icon name="store" size={16} /> <span>Para negocios</span>
              </Link>
            </nav>
          )}

          {isMobile ? (
            <div className="nav-acciones">
              {!currentUser && (
                <Link to="/login" className="nav-cta">Iniciar sesión</Link>
              )}
              {currentUser && role === 'cliente' && (
                <Link to="/perfil" title="Mi perfil" className="nav-avatar">
                  {inicialesDe(currentUser.displayName)}
                </Link>
              )}
              {currentUser && role === 'propietario' && (
                <Link to="/panel" className="nav-cta">Mi panel</Link>
              )}
              <button
                type="button"
                className={`nav-boton-menu${menuAbierto ? ' abierto' : ''}`}
                onClick={() => setMenuAbierto((v) => !v)}
                aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
                aria-expanded={menuAbierto}
                aria-controls="menu-movil"
              >
                <Icon name={menuAbierto ? 'x' : 'menu'} size={18} />
              </button>
            </div>
          ) : (
            <div className="nav-acciones">
              {/* Sin sesión no cabe junto a los dos botones de registro (y la
                  portada ya dice "Britalia, Kennedy" justo debajo). */}
              {currentUser && <span className="nav-zona">Britalia, Kennedy</span>}
              {currentUser ? (
                <>
                  {role === 'cliente' ? (
                    <Link to="/perfil" title="Mi perfil" className="nav-avatar">
                      {inicialesDe(currentUser.displayName)}
                    </Link>
                  ) : (
                    <span className="nav-nombre">{currentUser.displayName}</span>
                  )}
                  <button type="button" onClick={handleLogout} className="nav-enlace nav-salir">
                    <Icon name="logout" size={16} /> <span>Cerrar sesión</span>
                  </button>
                  {role === 'propietario' && (
                    <Link to="/panel" className="nav-cta">Ir a mi panel</Link>
                  )}
                </>
              ) : (
                <>
                  <Link to="/login" className="nav-enlace">Inicia sesión</Link>
                  <Link to="/registro/cliente" className="nav-cta nav-cta-secundario">Regístrate</Link>
                  <Link to="/registro/negocio" className="nav-cta">Registra tu negocio</Link>
                </>
              )}
            </div>
          )}

        {isMobile && menuAbierto && (
          <>
            {/* Velo sobre la página: enfoca el menú y tocarlo lo cierra. Vive
                dentro del <header>, así que el listener de "tocar fuera" no
                lo cuenta como fuera — por eso su propio onClick. */}
            <div className="menu-movil-velo" aria-hidden="true" onClick={() => setMenuAbierto(false)} />
            <nav id="menu-movil" className="menu-movil" aria-label="Menú principal">
              {currentUser && (
                <div className="menu-movil__usuario">
                  <span className="menu-movil__avatar">{inicialesDe(currentUser.displayName)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="menu-movil__nombre">{currentUser.displayName || 'Mi cuenta'}</div>
                    <div className="menu-movil__correo">{currentUser.email}</div>
                  </div>
                </div>
              )}

              <div className="menu-movil__lista">
                <OpcionMenu href="#resultados" icono="search" titulo="Explorar negocios" detalle="Barberías y estéticas: precios, mapa y portafolios" onElegir={() => setMenuAbierto(false)} />
                {currentUser && role === 'cliente' && (
                  <OpcionMenu to="/perfil" icono="user" titulo="Mi perfil" detalle="Citas, favoritos y reseñas" onElegir={() => setMenuAbierto(false)} />
                )}
                {currentUser && role === 'propietario' && (
                  <OpcionMenu to="/panel" icono="store" titulo="Mi panel" detalle="Agenda, servicios y portafolio" onElegir={() => setMenuAbierto(false)} />
                )}
                {!currentUser && (
                  <OpcionMenu to="/registro/cliente" icono="user" titulo="Crear cuenta de cliente" detalle="Guarda favoritos y reserva citas" onElegir={() => setMenuAbierto(false)} />
                )}
                <OpcionMenu href="#como-funciona" icono="info" titulo="Cómo funciona" detalle="Busca, compara y reserva en 3 pasos" onElegir={() => setMenuAbierto(false)} />
              </div>

              {!currentUser ? (
                <div className="menu-movil__negocio">
                  <span className="menu-movil__negocio-icono"><Icon name="store" size={20} /></span>
                  <div className="menu-movil__negocio-titulo">¿Tienes una barbería o estética?</div>
                  <div className="menu-movil__negocio-detalle">Muestra tus precios y trabajos, y recibe reservas de clientes del barrio. Es gratis.</div>
                  <Link to="/registro/negocio" className="btn btn-primary" onClick={() => setMenuAbierto(false)}>
                    Registra tu negocio
                  </Link>
                </div>
              ) : (
                <button type="button" onClick={handleLogout} className="menu-movil__salir">
                  <Icon name="logout" size={17} />
                  Cerrar sesión
                </button>
              )}
            </nav>
          </>
        )}
        </div>
      </header>

      {/* Arriba deja el espacio de la barra flotante (ver .nav-flotante). */}
      <section id="inicio" className="vitrina-portada" style={{ padding: isMobile ? '92px 16px 28px' : '124px 32px 48px' }}>
        {/* alignItems center: texto y mapa quedan centrados uno frente al
            otro en vez de alineados arriba con alturas distintas. */}
        {/* Dos columnas iguales con un espacio amplio entre texto y mapa
            (80px en PC), dentro de los mismos márgenes laterales. */}
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 24 : 80, alignItems: 'center' }}>
          <div>
            <span
              style={{
                display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, color: 'var(--sage-text)',
                background: 'var(--sage-soft)', padding: '6px 12px', borderRadius: 999,
              }}
            >
              PROTOTIPO · BRITALIA, KENNEDY
            </span>
            <h1 style={{ fontSize: isMobile ? 26 : 34, fontWeight: 800, lineHeight: 1.15, marginTop: 16 }}>
              La vitrina digital de los microcomercios de tu barrio
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginTop: 12, lineHeight: 1.6 }}>
              Compara precios, mira el portafolio real de cada negocio y revisa la disponibilidad
              de los servicios de cada barbería y estética registrada.
            </p>

            <form
              onSubmit={handleBuscar}
              className="card"
              style={{ marginTop: 22, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
            >
              <div style={{ flex: '1 1 160px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Servicio</label>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Ejemplo: Corte fade"
                  style={{ marginTop: 4, border: 'none', padding: '6px 0', fontSize: 14 }}
                />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Ubicación</label>
                <button
                  type="button"
                  onClick={solicitarUbicacion}
                  disabled={ubicacionEstado === 'cargando'}
                  title={ubicacionEstado === 'error' ? 'No pudimos acceder a tu ubicación' : undefined}
                  style={{
                    display: 'block', width: '100%', marginTop: 4, border: 'none', background: 'transparent',
                    padding: '6px 0', fontSize: 14, fontWeight: ubicacionCliente ? 700 : 400,
                    color: ubicacionEstado === 'error' ? 'var(--danger)'
                      : problemaUbicacion ? 'var(--warning-text)'
                      : ubicacionCliente ? 'var(--sage-text)' : 'var(--text-muted)',
                    textAlign: 'left', cursor: ubicacionEstado === 'cargando' ? 'default' : 'pointer',
                  }}
                >
                  {ubicacionEstado === 'cargando' && (
                    <span className="dots-cargando" aria-label="Ubicando…">
                      <span /><span /><span />
                    </span>
                  )}
                  {ubicacionEstado === 'error' && 'Ubicación no disponible'}
                  {ubicacionEstado === 'activa' && !problemaUbicacion && '● Cerca de ti'}
                  {ubicacionEstado === 'activa' && problemaUbicacion === 'lejos' && '● Lejos de Britalia'}
                  {ubicacionEstado === 'activa' && problemaUbicacion === 'imprecisa' && '● Ubicación aproximada'}
                  {ubicacionEstado === 'inactiva' && 'Usar mi ubicación'}
                </button>
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Presupuesto</label>
                <div className="campo-monto" style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
                  {presupuesto && (
                    <span style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }}>$</span>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={presupuesto ? MILES.format(Number(presupuesto)) : ''}
                    onChange={(e) => {
                      const digitos = e.target.value.replace(/\D/g, '')
                      setPresupuesto(digitos === '' ? '' : String(Math.min(Number(digitos), PRESUPUESTO_MAXIMO)))
                    }}
                    placeholder="Cualquier precio"
                    style={{
                      border: 'none', padding: '6px 0', fontSize: 14, width: '100%', background: 'transparent',
                      textAlign: presupuesto ? 'right' : 'left',
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, marginLeft: 4 }}>
                    <button
                      type="button"
                      aria-label="Subir presupuesto en $1.000"
                      onClick={() => setPresupuesto((prev) => String(Math.min(PRESUPUESTO_MAXIMO, (Number(prev) || 0) + 1000)))}
                      style={{ border: 'none', background: 'none', padding: 0, lineHeight: 1, fontSize: 8, color: 'var(--text-faint)', cursor: 'pointer' }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label="Bajar presupuesto en $1.000"
                      onClick={() => setPresupuesto((prev) => String(Math.max(0, (Number(prev) || 0) - 1000)))}
                      style={{ border: 'none', background: 'none', padding: 0, lineHeight: 1, fontSize: 8, color: 'var(--text-faint)', cursor: 'pointer' }}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="search" size={15} /> Buscar
              </button>
            </form>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {FILTER_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChip(chip)}
                  style={{
                    fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999,
                    border: `1px solid ${chipsActivos.has(chip) ? 'var(--accent)' : 'var(--vidrio-borde)'}`,
                    background: chipsActivos.has(chip) ? 'var(--accent-soft)' : 'var(--vidrio-campo)',
                    color: chipsActivos.has(chip) ? 'var(--accent-hover)' : 'var(--text-muted)',
                  }}
                >
                  {chip}
                </button>
              ))}
              {hayFiltrosActivos && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 10px', color: 'var(--text-faint)', background: 'none', border: 'none' }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          <div>
            <div
              style={{
                // En PC, proporción fija (no alto fijo): con un alto fijo, en
                // pantallas anchas el mapa crecía solo a lo ancho y quedaba
                // como una franja. Así mantiene la misma forma en cualquier
                // ancho de ventana.
                position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                ...(isMobile ? { height: 240 } : { aspectRatio: '1.85 / 1', minHeight: 280 }),
                background: 'var(--map-gradient)',
                border: '1px solid var(--border)',
                isolation: 'isolate', // atrapa el z-index alto de los controles de Leaflet para que no floten por encima de la tarjeta "destacado" de abajo
              }}
            >
              <div ref={mapDivRef} style={{ position: 'absolute', inset: 0 }} />

              {!mapError && (
                <button
                  type="button"
                  onClick={recentrarMapa}
                  title="Volver a ver los negocios en el mapa"
                  style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 1001, // por encima de los controles internos de Leaflet (z-index hasta 1000)
                    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--surface)', color: 'var(--text)', border: 'none', borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
                  }}
                >
                  <Icon name="target" size={16} />
                </button>
              )}

              {!mapError && problemaUbicacion && !avisoUbicacionCerrado && (
                <div className="aviso-mapa" role="status">
                  <span>
                    {problemaUbicacion === 'lejos'
                      ? 'Estás lejos de Britalia · te mostramos los negocios del barrio'
                      : 'Tu ubicación es aproximada · te mostramos los negocios del barrio'}
                  </span>
                  <button type="button" onClick={() => setAvisoUbicacionCerrado(true)} aria-label="Cerrar aviso">
                    <Icon name="x" size={12} />
                  </button>
                </div>
              )}

              {mapError && (
                <div
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '0 30px',
                  }}
                >
                  No se pudo cargar el mapa en este momento.
                </div>
              )}

              {!mapError && negociosConDatos.length === 0 && !loading && (
                <div
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '0 30px',
                  }}
                >
                  Aún no hay negocios registrados para mostrar en el mapa.
                </div>
              )}
            </div>

            {/* Alto fijo y miniatura siempre presente (foto o iniciales): si la
                tarjeta cambiaba de alto al cambiar de negocio (con o sin foto,
                con o sin la línea de razones), todo el bloque se recentraba y
                parecía que el mapa cambiaba de tamaño. */}
            {destacado && (
              <div className="card" style={{ marginTop: isMobile ? -28 : -40, marginLeft: isMobile ? 8 : 16, marginRight: isMobile ? 8 : 16, position: 'relative', padding: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', minHeight: isMobile ? undefined : 82 }}>
                {destacado.logo || destacado.miniatura || destacado.fotos?.[0] ? (
                  <img
                    src={destacado.logo || destacado.miniatura || destacado.fotos[0]}
                    alt=""
                    style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 46, height: 46, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, oklch(74% 0.15 52), oklch(52% 0.14 36))', color: '#fff', fontSize: 15, fontWeight: 800,
                    }}
                  >
                    {inicialesDe(destacado.nombre)}
                  </span>
                )}
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5 }}>{destacado.nombre}</span>
                    {destacado.estado && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: ESTADO_APERTURA[destacado.estado].text, flexShrink: 0 }}>
                        ● {ESTADO_APERTURA[destacado.estado].label}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12, color: 'var(--text-muted)', marginTop: 2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                    title={destacado.direccion}
                  >
                    {destacado.ratingProm ? (
                      <>★ {destacado.ratingProm.toFixed(1)} ({destacado.ratingCount}) · </>
                    ) : (
                      'Sin reseñas aún · '
                    )}
                    {destacado.precioDesde != null && <>Desde {COP.format(destacado.precioDesde)} · </>}
                    {/* La distancia antes de la dirección: si la línea no cabe
                        se recorta con "…" por el final, y así nunca se pierde. */}
                    {distanciaDe(destacado) && <><strong style={{ color: 'var(--text)' }}>{distanciaDe(destacado)}</strong> · </>}
                    {destacado.direccion ? acortarDireccion(destacado.direccion) : ''}
                  </div>
                  {destacado.razones[0] && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginTop: 3 }}>
                      {destacado.razones[0]}
                    </div>
                  )}
                </div>
                <Link
                  to={`/negocio/${destacado.id}`}
                  className="btn btn-primary"
                  style={{ fontSize: 12.5, padding: '8px 12px' }}
                >
                  Ver portafolio
                </Link>
              </div>
            )}
          </div>
        </div>

      </section>

      {/* 1224 = 1160 + 2×32 de padding: el contenido queda en 1160 y empieza
          en el mismo borde que el texto del hero (el hero aplica su padding
          fuera del ancho máximo). Mismo criterio en ComoFunciona,
          ResenasRecientes y Footer. */}
      <section id="resultados" style={{ maxWidth: 1224, margin: '0 auto', padding: isMobile ? '28px 16px' : '40px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {hayFiltrosActivos ? 'Resultados de tu búsqueda' : 'Recomendado para ti'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {hayFiltrosActivos
                ? `${recomendaciones.length} negocio${recomendaciones.length === 1 ? '' : 's'} encontrado${recomendaciones.length === 1 ? '' : 's'}`
                : 'Barberías y estéticas de Britalia, Kennedy.'}
            </div>
          </div>
          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={limpiarFiltros}
              style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none' }}
            >
              Limpiar búsqueda
            </button>
          )}
        </div>

        {loading ? (
          // Tarjetas fantasma con la misma forma que las reales: la página no
          // salta cuando llegan los datos y se lee como "ya casi", no como
          // vacía (en celular, la primera carga puede tardar un par de
          // segundos — después la caché de Firestore la vuelve inmediata).
          <div
            aria-label="Cargando negocios…"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 20 }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="card" style={{ overflow: 'hidden' }}>
                <div className="esqueleto" style={{ height: 110, borderRadius: 0 }} />
                <div style={{ padding: 14 }}>
                  <div className="esqueleto" style={{ height: 14, width: '60%' }} />
                  <div className="esqueleto" style={{ height: 11, width: '85%', marginTop: 10 }} />
                  <div className="esqueleto" style={{ height: 11, width: '45%', marginTop: 8 }} />
                  <div className="esqueleto" style={{ height: 22, width: '100%', marginTop: 16 }} />
                </div>
              </div>
            ))}
          </div>
        ) : recomendaciones.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', marginTop: 24 }}>
            {hayFiltrosActivos ? 'No encontramos negocios que coincidan con tu búsqueda.' : 'Aún no hay negocios registrados en MiniBarrio.'}
          </p>
        ) : (
          // auto-fit (no auto-fill): las tarjetas llenan la fila en vez de
          // dejar media fila vacía. Con 1 o 2 negocios en PC, cada tarjeta
          // ocupa más de 600px: en vertical la foto quedaba como una franja
          // delgada, así que ahí pasan a horizontal (foto a la izquierda).
          <div
            style={{
              display: 'grid', gap: 16, marginTop: 20,
              gridTemplateColumns: `repeat(auto-fit, minmax(${tarjetasHorizontales ? 420 : 230}px, 1fr))`,
              maxWidth: recomendaciones.length === 1 ? (tarjetasHorizontales ? 640 : 520) : undefined,
            }}
          >
            {recomendaciones.map((n) => (
              <Link
                key={n.id}
                to={`/negocio/${n.id}`}
                className={`card tarjeta-negocio${tarjetasHorizontales ? ' tarjeta-negocio--horizontal' : ''}`}
                style={{ overflow: 'hidden', color: 'inherit' }}
              >
                <FotoNegocio negocio={n} estado={n.estado} alto={tarjetasHorizontales ? '100%' : 130} minAlto={tarjetasHorizontales ? 190 : undefined} />
                <div className="tarjeta-negocio__cuerpo" style={{ padding: tarjetasHorizontales ? '18px 20px' : 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{n.nombre}</div>
                    {n.ratingProm && (
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>★ {n.ratingProm.toFixed(1)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{n.descripcion || n.categoria}</div>
                  <div
                    style={{
                      fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                    title={n.direccion}
                  >
                    {distanciaDe(n) && <><strong style={{ color: 'var(--text)' }}>{distanciaDe(n)}</strong> · </>}
                    {n.direccion ? acortarDireccion(n.direccion) : ''}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {n.precioDesde != null ? `Desde ${COP.format(n.precioDesde)}` : 'Consulta precios'}
                    </span>
                    {n.especialidades?.[0] && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                        {n.especialidades[0]}
                      </span>
                    )}
                  </div>
                  {n.razones.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
                      {n.razones.slice(0, 2).map((razon) => (
                        <span
                          key={razon}
                          style={{
                            fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                            background: 'var(--accent-soft)', color: 'var(--accent-hover)',
                          }}
                        >
                          {razon}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ComoFunciona />
      <ResenasRecientes
        resenas={resenasVista}
        nombresNegocios={nombresNegocios}
      />

      <Footer />
    </div>
  )
}

const ICON_PATHS = {
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  menu: 'M3 6h18M3 12h18M3 18h18',
  x: 'M18 6 6 18M6 6l12 12',
  target: 'M12 2a10 10 0 1 0 .01 0zM12 9a3 3 0 1 0 .01 0zM12 2v3M12 19v3M2 12h3M19 12h3',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  store: 'M3 9l1.5-5h15L21 9M3 9h18M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8M10 20v-5h4v5',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  chevron: 'M9 18l6-6-6-6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
}

// Opción del menú móvil: ícono en círculo, título, detalle corto y flecha.
// Con `to` es un Link de la app; con `href`, un ancla de esta página; con
// `inactiva`, un aviso de "muy pronto" que no lleva a ninguna parte.
function OpcionMenu({ to, href, icono, titulo, detalle, inactiva = false, onElegir }) {
  const contenido = (
    <>
      <span className="menu-movil__icono"><Icon name={icono} size={18} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="menu-movil__titulo">{titulo}</span>
        <span className="menu-movil__detalle">{detalle}</span>
      </span>
      {inactiva ? <span className="menu-movil__pronto">Pronto</span> : <span className="menu-movil__flecha"><Icon name="chevron" size={16} /></span>}
    </>
  )
  if (inactiva) return <div className="menu-movil__opcion menu-movil__opcion--inactiva" aria-disabled="true">{contenido}</div>
  if (to) return <Link to={to} className="menu-movil__opcion" onClick={onElegir}>{contenido}</Link>
  return <a href={href} className="menu-movil__opcion" onClick={onElegir}>{contenido}</a>
}

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}
