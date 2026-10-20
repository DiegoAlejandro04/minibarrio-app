import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import Splash from './components/Splash.jsx'
import ClientHome from './pages/client/ClientHome.jsx'

// División del código: cada página de abajo se descarga solo cuando se entra
// a ella (React.lazy). Así el primer arranque, casi siempre en la vitrina,
// no carga el login, los registros ni los paneles. Mientras llega una, se ve
// el splash (ver <Suspense> abajo).
const Acceso = lazy(() => import('./pages/Acceso.jsx'))
const RegisterBusiness = lazy(() => import('./pages/RegisterBusiness.jsx'))
const NegocioDetalle = lazy(() => import('./pages/client/NegocioDetalle.jsx'))
const ClientLayout = lazy(() => import('./pages/client/ClientLayout.jsx'))
const ClientResumen = lazy(() => import('./pages/client/ClientResumen.jsx'))
const ClientCitas = lazy(() => import('./pages/client/ClientCitas.jsx'))
const ClientFavoritos = lazy(() => import('./pages/client/ClientFavoritos.jsx'))
const ClientResenas = lazy(() => import('./pages/client/ClientResenas.jsx'))
const ClientDatosPersonales = lazy(() => import('./pages/client/ClientDatosPersonales.jsx'))
const ClientConfiguracion = lazy(() => import('./pages/client/ClientConfiguracion.jsx'))
const OwnerLayout = lazy(() => import('./pages/owner/OwnerLayout.jsx'))
const OwnerResumen = lazy(() => import('./pages/owner/OwnerResumen.jsx'))
const OwnerAgenda = lazy(() => import('./pages/owner/OwnerAgenda.jsx'))
const OwnerCaja = lazy(() => import('./pages/owner/OwnerCaja.jsx'))
const OwnerServicios = lazy(() => import('./pages/owner/OwnerServicios.jsx'))
const OwnerEquipo = lazy(() => import('./pages/owner/OwnerEquipo.jsx'))
const OwnerPortafolio = lazy(() => import('./pages/owner/OwnerPortafolio.jsx'))
const OwnerIdentidad = lazy(() => import('./pages/owner/OwnerIdentidad.jsx'))
const OwnerClientes = lazy(() => import('./pages/owner/OwnerClientes.jsx'))
const OwnerResenas = lazy(() => import('./pages/owner/OwnerResenas.jsx'))
const OwnerConfiguracion = lazy(() => import('./pages/owner/OwnerConfiguracion.jsx'))
const ClientNotificaciones = lazy(() => import('./pages/client/ClientNotificaciones.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))
// Página inactiva a futuro (enlaces de los correos de Firebase con diseño
// propio). Ver el encabezado de AccionCuenta.jsx para saber cómo activarla.
// import AccionCuenta from './pages/AccionCuenta.jsx'

// Cuánto se muestra el splash (al arrancar, con o sin sesión, o al navegar
// a la vitrina o al panel del cliente): lo justo para que termine la
// animación de entrada del logo (la última pieza arranca a los 220 ms y dura
// 500 ms, ver Splash.jsx) más una breve pausa — nunca se corta a la mitad.
const DURACION_SPLASH_MS = 900
// Al recargar: la misma animación en versión corta (la última pieza arranca
// a los 110 ms y dura 300 ms, ver .splash-rapido en index.css).
const DURACION_SPLASH_RAPIDO_MS = 450

// Navegaciones que muestran el splash: llegar a la vitrina ("/") desde otra
// página, entrar al panel del cliente desde fuera de él, o entrar al
// portafolio público de un negocio. Moverse entre las secciones del propio
// panel (Principal, Mis citas, Datos personales…) no lo muestra.
// El splash animado del arranque se ve una sola vez por sesión del navegador
// (pestaña): al recargar o volver después, solo se espera a la sesión.
const CLAVE_SPLASH_VISTO = 'minibarrio:splashVisto'

function splashYaVisto() {
  try {
    return sessionStorage.getItem(CLAVE_SPLASH_VISTO) === '1'
  } catch {
    return false
  }
}

function muestraSplash(desde, hacia) {
  if (desde === hacia) return false
  if (hacia === '/') return true
  if (hacia.startsWith('/perfil') && !desde.startsWith('/perfil')) return true
  if (hacia.startsWith('/negocio/') && !desde.startsWith('/negocio/')) return true
  return false
}

export default function App() {
  const { modoOscuro, modoOscuroPanel, authReady } = useAuth()
  const location = useLocation()
  const tipoNavegacion = useNavigationType() // 'PUSH' (clic/navigate normal) | 'POP' (atrás/adelante del navegador) | 'REPLACE'

  // Dos preferencias de modo oscuro independientes, cada una con su propio
  // alcance: la del cliente aplica a todo MENOS /panel, y la del panel del
  // propietario aplica SOLO dentro de /panel — nunca se mezclan ni se filtran
  // fuera de su zona, aunque sea la misma persona navegando.
  useLayoutEffect(() => {
    const enPanelDelNegocio = location.pathname.startsWith('/panel')
    const oscuro = enPanelDelNegocio ? modoOscuroPanel : modoOscuro
    document.documentElement.dataset.theme = oscuro ? 'dark' : 'light'
  }, [modoOscuro, modoOscuroPanel, location.pathname])

  // Splash al navegar (ver muestraSplash). Va encima de la página nueva, que
  // se monta y carga sus datos por debajo mientras tanto. useLayoutEffect
  // para que aparezca antes de pintar la página nueva, sin parpadeo.
  const rutaAnterior = useRef(location.pathname)
  const [splashNavegacion, setSplashNavegacion] = useState(false)
  useLayoutEffect(() => {
    const desde = rutaAnterior.current
    rutaAnterior.current = location.pathname
    // Atrás/adelante del navegador no muestra el splash, aunque el cambio de
    // ruta sea uno de los que normalmente sí lo harían (ver muestraSplash) —
    // solo clics y navegación normal dentro de la página.
    if (tipoNavegacion === 'POP') return undefined
    if (!muestraSplash(desde, location.pathname)) return undefined
    setSplashNavegacion(true)
    const t = setTimeout(() => setSplashNavegacion(false), DURACION_SPLASH_MS)
    return () => {
      clearTimeout(t)
      setSplashNavegacion(false)
    }
  }, [location.pathname, tipoNavegacion])

  // Splash del primer arranque. Antes esto reemplazaba todo el árbol
  // mientras `authReady` era false — evitaba el parpadeo de "sin sesión",
  // pero con sesión iniciada bloqueaba también el panel/perfil de abajo, que
  // ya no podían ni montarse para empezar a pedir sus propios datos (ver
  // ProtectedRoute.jsx). Ahora es un overlay: las rutas de abajo se montan y
  // cargan sus datos en paralelo con lo que falta de sesión, sin esperar —
  // el splash solo se queda encima el tiempo justo para que su animación
  // termine, en vez de cortarse apenas los datos ya estén listos.
  //
  // Rendimiento en el celular: la animación corre MIENTRAS Firebase confirma
  // la sesión (no después, como antes, que sumaba los dos tiempos). La
  // completa, solo la primera vez por sesión del navegador; al recargar, una
  // versión corta (DURACION_SPLASH_RAPIDO_MS), que casi siempre termina antes
  // de que llegue la sesión, así que no hace esperar más.
  const [primeraVez] = useState(() => !splashYaVisto())
  const [animacionLista, setAnimacionLista] = useState(false)
  useEffect(() => {
    if (primeraVez) {
      try {
        sessionStorage.setItem(CLAVE_SPLASH_VISTO, '1')
      } catch {
        // Sin almacenamiento: se anima cada vez, como antes.
      }
    }
    const t = setTimeout(() => setAnimacionLista(true), primeraVez ? DURACION_SPLASH_MS : DURACION_SPLASH_RAPIDO_MS)
    return () => clearTimeout(t)
  }, [primeraVez])
  const splashInicial = !authReady || !animacionLista

  const mostrarSplash = splashInicial || splashNavegacion

  return (
    <>
      <Suspense fallback={<Splash animar={false} />}>
      <Routes>
        {/* Rutas públicas */}
        {/* Inicio de sesión y registro de cliente: la misma tarjeta que gira (ver Acceso.jsx) */}
        <Route path="/login" element={<Acceso />} />
        {/* <Route path="/cuenta/accion" element={<AccionCuenta />} /> — inactiva, ver AccionCuenta.jsx */}
        <Route path="/registro/cliente" element={<Acceso />} />
        <Route path="/registro/negocio" element={<RegisterBusiness />} />

        {/* Vitrina pública de negocios (RF-05, RF-06, RF-09, RF-12): visible sin sesión */}
        <Route path="/" element={<ClientHome />} />
        <Route path="/negocio/:id" element={<NegocioDetalle />} />

        {/* Panel del cliente: citas, favoritos, reseñas y datos personales */}
        <Route
          path="/perfil"
          element={
            <ProtectedRoute allowedRoles={['cliente']}>
              <ClientLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ClientResumen />} />
          <Route path="citas" element={<ClientCitas />} />
          <Route path="favoritos" element={<ClientFavoritos />} />
          <Route path="resenas" element={<ClientResenas />} />
          <Route path="datos" element={<ClientDatosPersonales />} />
          <Route path="notificaciones" element={<ClientNotificaciones />} />
          <Route path="configuracion" element={<ClientConfiguracion />} />
        </Route>

        {/* Panel del comerciante (RF-02, RF-03, RF-04, RF-07…) */}
        <Route
          path="/panel"
          element={
            <ProtectedRoute allowedRoles={['propietario']}>
              <OwnerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OwnerResumen />} />
          <Route path="servicios" element={<OwnerServicios />} />
          <Route path="equipo" element={<OwnerEquipo />} />
          <Route path="identidad" element={<OwnerIdentidad />} />
          <Route path="portafolio" element={<OwnerPortafolio />} />
          <Route path="clientes" element={<OwnerClientes />} />
          <Route path="agenda" element={<OwnerAgenda />} />
          <Route path="caja" element={<OwnerCaja />} />
          <Route path="resenas" element={<OwnerResenas />} />
          <Route path="configuracion" element={<OwnerConfiguracion />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>

      {/* Fondo opaco propio: el Splash entra con un fade desde transparente
          (".splash-arranque" en index.css) y, sin este fondo, durante ese
          instante se alcanzaba a ver la página de abajo (ya sea la nueva al
          navegar, o la real mientras se confirma la sesión al arrancar). */}
      {mostrarSplash && (
        // zIndex por encima de todo lo de la página: controles de Leaflet
        // (hasta 1001) y el encabezado de la vitrina con su menú móvil (1100).
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--bg)' }}>
          {/* Animado la primera vez y al navegar; al recargar, en versión rápida. */}
          <Splash animar rapido={!primeraVez && !splashNavegacion} />
        </div>
      )}
    </>
  )
}
