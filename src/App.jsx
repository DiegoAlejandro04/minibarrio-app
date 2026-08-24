import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import RegisterClient from './pages/RegisterClient.jsx'
import RegisterBusiness from './pages/RegisterBusiness.jsx'
import ClientHome from './pages/client/ClientHome.jsx'
import NegocioDetalle from './pages/client/NegocioDetalle.jsx'
import OwnerLayout from './pages/owner/OwnerLayout.jsx'
import OwnerResumen from './pages/owner/OwnerResumen.jsx'
import OwnerAgenda from './pages/owner/OwnerAgenda.jsx'
import OwnerServicios from './pages/owner/OwnerServicios.jsx'
import OwnerPortafolio from './pages/owner/OwnerPortafolio.jsx'
import OwnerClientes from './pages/owner/OwnerClientes.jsx'
import OwnerProximamente from './pages/owner/OwnerProximamente.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/registro/cliente" element={<RegisterClient />} />
      <Route path="/registro/negocio" element={<RegisterBusiness />} />

      {/* Vitrina pública de negocios (RF-05, RF-06, RF-09, RF-12): visible sin sesión */}
      <Route path="/" element={<ClientHome />} />
      <Route path="/negocio/:id" element={<NegocioDetalle />} />

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
        <Route path="resenas" element={<OwnerProximamente titulo="Reseñas" />} />
        <Route path="configuracion" element={<OwnerProximamente titulo="Configuración" />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
