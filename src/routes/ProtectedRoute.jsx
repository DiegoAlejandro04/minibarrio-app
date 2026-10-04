// Guarda de rutas por autenticación y, opcionalmente, por rol.
//
// Uso:
//   <ProtectedRoute><Componente/></ProtectedRoute>                 → requiere sesión
//   <ProtectedRoute allowedRoles={['propietario']}><X/></ProtectedRoute> → requiere rol específico

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Splash from '../components/Splash.jsx'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, role, authReady, loading } = useAuth()
  const location = useLocation()

  // Lo único que hace falta para esto es saber SI hay sesión — se resuelve
  // casi al instante (local). Confirmar además el rol tarda un poco más
  // (perfil de Firestore, ver authReady/loading en AuthContext.jsx).
  if (!authReady) return <Splash />

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Mientras el rol todavía se está confirmando, se deja montar la página
  // de una vez en vez de esperarlo: así ya puede arrancar su propia consulta
  // a Firestore en paralelo con esa confirmación, no después — antes las dos
  // consultas quedaban en serie (primero el perfil, recién ahí los datos de
  // la página) y la carga tardaba el doble. Si el rol termina siendo el
  // equivocado, se redirige apenas se sepa; la seguridad real de todas
  // formas la pone Firestore del lado del servidor (ver firestore.rules) —
  // esto solo evita mostrar el panel equivocado un instante de más.
  if (!loading && allowedRoles && !allowedRoles.includes(role)) {
    // Usuario autenticado pero con el rol equivocado (p.ej. un cliente
    // intentando entrar al panel del comerciante) → lo mandamos a su home.
    const fallback = role === 'propietario' ? '/panel' : '/'
    return <Navigate to={fallback} replace />
  }

  return children
}
