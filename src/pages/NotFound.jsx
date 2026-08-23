import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ fontSize: 22, fontWeight: 800 }}>Página no encontrada</div>
      <Link to="/" style={{ fontWeight: 700 }}>Volver al inicio</Link>
    </div>
  )
}
