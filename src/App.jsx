import { useLayoutEffect, useRef, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
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

// Cuánto se muestra el splash al navegar a la vitrina o al panel del cliente:
// lo justo para que termine la animación de entrada del logo (la última pieza
// arranca a los 220 ms y dura 500 ms, ver Splash.jsx) más una breve pausa.
const SPLASH_NAVEGACION_MS = 900

// Navegaciones que muestran el splash: llegar a la vitrina ("/") desde otra
// página, o entrar al panel del cliente desde fuera de él. Moverse entre las
// secciones del propio panel (Principal, Mis citas…) no lo muestra.
function muestraSplash(desde, hacia) {
  if (desde === hacia) return false
  if (hacia === '/') return true
  return hacia.startsWith('/perfil') && !desde.startsWith('/perfil')
}

export default function App() {
  const { modoOscuro, modoOscuroPanel, loading } = useAuth()
  const location = useLocation()

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
    if (!muestraSplash(desde, location.pathname)) return undefined
    setSplashNavegacion(true)
    const t = setTimeout(() => setSplashNavegacion(false), SPLASH_NAVEGACION_MS)
    return () => {
      clearTimeout(t)
      setSplashNavegacion(false)
    }
  }, [location.pathname])

  // Mientras Firebase confirma si hay sesión (y, si la hay, trae el rol y el
  // modo oscuro desde Firestore), más vale no pintar nada todavía: antes de
  // este guard, la página se renderizaba de una vez en su estado "sin
  // sesión", y un instante después saltaba a la real — un parpadeo visible
  // cada vez que se recargaba con sesión iniciada. Para quien no tiene
  // sesión esto se resuelve casi al instante (no hay nada que traer de
  // Firestore), así que no se nota.
  if (loading) return <Splash />

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
          instante se alcanzaba a ver la página nueva por debajo. */}
      {splashNavegacion && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg)' }}>
          <Splash />
        </div>
      )}
    </>
  )
}
