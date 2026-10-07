import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { leerPerfilCliente } from '../../perfilesClientes.js'
import useIsMobile from '../../hooks/useIsMobile.js'

// Clientes que han agendado una cita o dejado una reseña (RF-07, RF-10).
// El perfil de cada cliente se lee con leerPerfilCliente (perfilesClientes.js):
// firestore.rules solo lo permite para clientes con relación con el negocio.

const FECHA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

export default function OwnerClientes() {
  const { uid } = useOutletContext()
  const isMobile = useIsMobile()

  const [citas, setCitas] = useState([])
  const [resenas, setResenas] = useState([])
  const [clientesInfo, setClientesInfo] = useState({}) // clienteId -> { nombre, correo, telefono }

  useEffect(() => {
    if (!uid) return
    const unsubs = [
      onSnapshot(query(collection(db, 'citas'), where('negocioId', '==', uid)), (snap) => {
        setCitas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
      onSnapshot(collection(db, 'negocios', uid, 'resenas'), (snap) => {
        setResenas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [uid])

  const clientesAgregados = useMemo(() => {
    const mapa = {}
    citas.forEach((c) => {
      if (!c.clienteId) return
      if (!mapa[c.clienteId]) mapa[c.clienteId] = { citas: 0, ultimaCita: null, tieneResena: false }
      mapa[c.clienteId].citas += 1
      const fecha = c.fechaHora?.toDate ? c.fechaHora.toDate() : null
      if (fecha && (!mapa[c.clienteId].ultimaCita || fecha > mapa[c.clienteId].ultimaCita)) {
        mapa[c.clienteId].ultimaCita = fecha
      }
    })
    resenas.forEach((r) => {
      if (!r.clienteId) return
      if (!mapa[r.clienteId]) mapa[r.clienteId] = { citas: 0, ultimaCita: null, tieneResena: false }
      mapa[r.clienteId].tieneResena = true
    })
    return mapa
  }, [citas, resenas])

  useEffect(() => {
    const faltantes = Object.keys(clientesAgregados).filter((id) => !(id in clientesInfo))
    if (faltantes.length === 0) return
    faltantes.forEach(async (clienteId) => {
      // Prueba de la relación con este negocio (ver perfilesClientes.js): una
      // cita suya, o si solo dejó reseña, esa reseña.
      const cita = citas.find((c) => c.clienteId === clienteId)
      const evidencia = cita
        ? { citaId: cita.id }
        : { resenaId: resenas.find((r) => r.clienteId === clienteId).id }
      const perfil = await leerPerfilCliente(uid, clienteId, evidencia)
      setClientesInfo((prev) => ({
        ...prev,
        [clienteId]: perfil || { nombre: 'Cliente', correo: '', telefono: '' },
      }))
    })
  }, [clientesAgregados, clientesInfo, citas, resenas, uid])

  const lista = useMemo(
    () => Object.entries(clientesAgregados)
      .map(([clienteId, datos]) => ({ clienteId, ...datos, ...clientesInfo[clienteId] }))
      .sort((a, b) => (b.ultimaCita || 0) - (a.ultimaCita || 0)),
    [clientesAgregados, clientesInfo]
  )

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Clientes</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 24 }}>
        Personas que han agendado una cita o dejado una reseña en tu negocio.
      </p>

      <div className="card" style={{ padding: 20 }}>
        {lista.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
            Aún no tienes clientes registrados. Aparecerán aquí cuando reserven una cita o dejen una reseña.
          </p>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map((c) => (
              <div key={c.clienteId} className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nombre || 'Cargando…'}</div>
                <div style={{ marginTop: 8, fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Campo label="Contacto" value={c.telefono || c.correo || '—'} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <Campo label="Citas" value={c.citas} />
                    <Campo label="Reseña" value={c.tieneResena ? 'Sí' : '—'} />
                  </div>
                  <Campo label="Última cita" value={c.ultimaCita ? FECHA.format(c.ultimaCita) : '—'} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-faint)', fontSize: 11.5, textTransform: 'uppercase' }}>
                  <th style={{ paddingBottom: 10, fontWeight: 700 }}>Cliente</th>
                  <th style={{ paddingBottom: 10, fontWeight: 700 }}>Contacto</th>
                  <th style={{ paddingBottom: 10, fontWeight: 700 }}>Citas</th>
                  <th style={{ paddingBottom: 10, fontWeight: 700 }}>Última cita</th>
                  <th style={{ paddingBottom: 10, fontWeight: 700 }}>Reseña</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.clienteId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 0', fontWeight: 700 }}>{c.nombre || 'Cargando…'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.telefono || c.correo || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.citas}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.ultimaCita ? FECHA.format(c.ultimaCita) : '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.tieneResena ? 'Sí' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Campo({ label, value }) {
  return (
    <div>
      <div style={{ color: 'var(--text-faint)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ color: 'var(--text-muted)', marginTop: 2, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}
