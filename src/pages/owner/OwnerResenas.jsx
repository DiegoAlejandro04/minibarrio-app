import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { leerPerfilCliente } from '../../perfilesClientes.js'

// Reseñas recibidas por el negocio (RF-10, lado propietario): lista en
// tiempo real de negocios/{uid}/resenas, con el nombre del cliente resuelto
// vía join simple contra "usuarios" (igual patrón que OwnerResumen.jsx).

const FECHA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

export default function OwnerResenas() {
  const { uid } = useOutletContext()
  const [resenas, setResenas] = useState([])
  const [clientes, setClientes] = useState({}) // clienteId -> nombre

  useEffect(() => {
    if (!uid) return
    const unsub = onSnapshot(collection(db, 'negocios', uid, 'resenas'), (snap) => {
      setResenas(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0))
      )
    })
    return unsub
  }, [uid])

  useEffect(() => {
    const faltantes = [...new Set(resenas.map((r) => r.clienteId))].filter((id) => id && !(id in clientes))
    if (faltantes.length === 0) return
    faltantes.forEach(async (clienteId) => {
      const resena = resenas.find((r) => r.clienteId === clienteId)
      const perfil = await leerPerfilCliente(uid, clienteId, { resenaId: resena.id })
      setClientes((prev) => ({ ...prev, [clienteId]: perfil?.nombre || 'Cliente' }))
    })
  }, [resenas, clientes, uid])

  const promedio = useMemo(() => {
    if (resenas.length === 0) return null
    return resenas.reduce((sum, r) => sum + (r.calificacion || 0), 0) / resenas.length
  }, [resenas])

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Reseñas</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 20 }}>
        Lo que tus clientes opinan de tu negocio.
      </p>

      <div className="card" style={{ padding: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{promedio === null ? '—' : promedio.toFixed(1)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>calificación promedio</div>
        </div>
        <div style={{ height: 40, width: 1, background: 'var(--border)' }} />
        <div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{resenas.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>reseña{resenas.length === 1 ? '' : 's'} en total</div>
        </div>
      </div>

      {resenas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Todavía no tienes reseñas de clientes.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resenas.map((r) => (
            <div key={r.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{clientes[r.clienteId] || 'Cliente'}</span>
                <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>{'★'.repeat(r.calificacion || 0)}</span>
              </div>
              {r.comentario && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{r.comentario}</p>}
              {r.creadoEn?.toDate && (
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>{FECHA.format(r.creadoEn.toDate())}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
