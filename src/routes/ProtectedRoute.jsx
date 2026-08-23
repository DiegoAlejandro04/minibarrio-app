// Guarda de rutas por autenticación y, opcionalmente, por rol.
//
// Uso:
//   <ProtectedRoute><Componente/></ProtectedRoute>                 → requiere sesión
//   <ProtectedRoute allowedRoles={['propietario']}><X/></ProtectedRoute> → requiere rol específico

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div style={{ padding: 40 }}>Cargando…</div>

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Usuario autenticado pero con el rol equivocado (p.ej. un cliente
    // intentando entrar al panel del comerciante) → lo mandamos a su home.
    const fallback = role === 'propietario' ? '/panel' : '/'
    return <Navigate to={fallback} replace />
  }

  return children
}
