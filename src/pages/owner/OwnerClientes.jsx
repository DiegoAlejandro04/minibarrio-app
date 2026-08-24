import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'

// Clientes que han agendado una cita o dejado una reseña (RF-07, RF-10).
// Requiere que firestore.rules permita al propietario leer el perfil básico
// de sus clientes (ver comentario en firestore.rules, regla de "usuarios").

const FECHA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

export default function OwnerClientes() {
  const { uid } = useOutletContext()

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
      const snap = await getDoc(doc(db, 'usuarios', clienteId))
      setClientesInfo((prev) => ({
        ...prev,
        [clienteId]: snap.exists() ? snap.data() : { nombre: 'Cliente', correo: '', telefono: '' },
      }))
    })
  }, [clientesAgregados, clientesInfo])

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
