import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import Splash from './components/Splash.jsx'
import Login from './pages/Login.jsx'
import RegisterClient from './pages/RegisterClient.jsx'
import RegisterBusiness from './pages/RegisterBusiness.jsx'
import ClientHome from './pages/client/ClientHome.jsx'
import NegocioDetalle from './pages/client/NegocioDetalle.jsx'
import ClientLayout from './pages/client/ClientLayout.jsx'
import ClientResumen from './pages/client/ClientResumen.jsx'
import ClientCitas from './pages/client/ClientCitas.jsx'
import ClientFavoritos from './pages/client/ClientFavoritos.jsx'
import ClientResenas from './pages/client/ClientResenas.jsx'
import ClientDatosPersonales from './pages/client/ClientDatosPersonales.jsx'
import ClientConfiguracion from './pages/client/ClientConfiguracion.jsx'
import OwnerLayout from './pages/owner/OwnerLayout.jsx'
import OwnerResumen from './pages/owner/OwnerResumen.jsx'
import OwnerAgenda from './pages/owner/OwnerAgenda.jsx'
import OwnerServicios from './pages/owner/OwnerServicios.jsx'
import OwnerPortafolio from './pages/owner/OwnerPortafolio.jsx'
import OwnerClientes from './pages/owner/OwnerClientes.jsx'
import OwnerResenas from './pages/owner/OwnerResenas.jsx'
import OwnerConfiguracion from './pages/owner/OwnerConfiguracion.jsx'
import Proximamente from './components/Proximamente.jsx'
import NotFound from './pages/NotFound.jsx'

// Cuánto se muestra el splash (al arrancar con sesión iniciada, o al navegar
// a la vitrina o al panel del cliente): lo justo para que termine la
// animación de entrada del logo (la última pieza arranca a los 220 ms y dura
// 500 ms, ver Splash.jsx) más una breve pausa — nunca se corta a la mitad.
const DURACION_SPLASH_MS = 900

// Navegaciones que muestran el splash: llegar a la vitrina ("/") desde otra
// página, entrar al panel del cliente desde fuera de él, o entrar al
// portafolio público de un negocio. Moverse entre las secciones del propio
// panel (Principal, Mis citas, Datos personales…) no lo muestra.
function muestraSplash(desde, hacia) {
  if (desde === hacia) return false
  if (hacia === '/') return true
  if (hacia.startsWith('/perfil') && !desde.startsWith('/perfil')) return true
  if (hacia.startsWith('/negocio/') && !desde.startsWith('/negocio/')) return true
  return false
}

export default function App() {
  const { currentUser, modoOscuro, modoOscuroPanel, authReady } = useAuth()
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
  // Para quien NO tiene sesión no hay nada que ocultar ni que esperar (no
  // hay perfil que traer de Firestore), así que ahí se quita apenas se sepa
  // — solo se compromete al mínimo de la animación cuando sí hay alguien
  // detrás.
  const [splashInicial, setSplashInicial] = useState(true)
  useEffect(() => {
    if (!authReady) return undefined
    if (!currentUser) {
      setSplashInicial(false)
      return undefined
    }
    const t = setTimeout(() => setSplashInicial(false), DURACION_SPLASH_MS)
    return () => clearTimeout(t)
  }, [authReady, currentUser])

  const mostrarSplash = splashInicial || splashNavegacion

  return (
    <>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro/cliente" element={<RegisterClient />} />
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
          <Route path="notificaciones" element={<Proximamente titulo="Notificaciones" />} />
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
          <Route path="portafolio" element={<OwnerPortafolio />} />
          <Route path="clientes" element={<OwnerClientes />} />
          <Route path="agenda" element={<OwnerAgenda />} />
          <Route path="resenas" element={<OwnerResenas />} />
          <Route path="configuracion" element={<OwnerConfiguracion />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Fondo opaco propio: el Splash entra con un fade desde transparente
          (".splash-arranque" en index.css) y, sin este fondo, durante ese
          instante se alcanzaba a ver la página de abajo (ya sea la nueva al
          navegar, o la real mientras se confirma la sesión al arrancar). */}
      {mostrarSplash && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg)' }}>
          <Splash />
        </div>
      )}
    </>
  )
}
