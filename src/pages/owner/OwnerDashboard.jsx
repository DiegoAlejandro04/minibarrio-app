import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import Navbar from '../../components/Navbar.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'

// Placeholder del panel del comerciante. La UI definitiva (métricas, agenda
// del día, tabla de servicios) ya está diseñada en el canvas de mockups —
// este componente confirma que el negocio se creó correctamente en Firestore
// al registrarse y es el punto de partida para el Sprint 1 (RF-03/RF-04:
// gestión del portafolio).
export default function OwnerDashboard() {
  const { currentUser } = useAuth()
  const [negocio, setNegocio] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchNegocio() {
      if (!currentUser) return
      const snap = await getDoc(doc(db, 'negocios', currentUser.uid))
      setNegocio(snap.exists() ? snap.data() : null)
      setLoading(false)
    }
    fetchNegocio()
  }, [currentUser])

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 640, margin: '80px auto', textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>Panel del comerciante</div>
        {loading ? (
          <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Cargando datos del negocio…</p>
        ) : negocio ? (
          <div className="card" style={{ marginTop: 20, padding: 20, textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{negocio.nombre}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{negocio.categoria} · {negocio.direccion}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>{negocio.descripcion}</div>
            <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 14 }}>
              Próximo en el backlog: RF-03/RF-04 (portafolio de servicios), RF-07/RF-08 (disponibilidad y citas).
            </p>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>No se encontró el negocio asociado a esta cuenta.</p>
        )}
      </div>
    </div>
  )
}
