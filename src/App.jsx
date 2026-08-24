import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import RegisterClient from './pages/RegisterClient.jsx'
import RegisterBusiness from './pages/RegisterBusiness.jsx'
import ClientHome from './pages/client/ClientHome.jsx'
import OwnerDashboard from './pages/owner/OwnerDashboard.jsx'
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

      {/* Panel del comerciante (RF-02, RF-03, RF-04, RF-07…) */}
      <Route
        path="/panel"
        element={
          <ProtectedRoute allowedRoles={['propietario']}>
            <OwnerDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
