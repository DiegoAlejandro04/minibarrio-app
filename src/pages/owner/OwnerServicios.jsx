import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import Icon from '../../components/Icon.jsx'

// Gestión de servicios del negocio (RF-03, RF-04). CRUD directo sobre
// negocios/{uid}/servicios — permitido por firestore.rules para el dueño.

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const FORM_INICIAL = { nombre: '', descripcion: '', precio: '', duracionMinutos: '' }

export default function OwnerServicios() {
  const { servicios, uid } = useOutletContext()

  const [form, setForm] = useState(FORM_INICIAL)
  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function update(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  function empezarEdicion(servicio) {
    setEditandoId(servicio.id)
    setForm({
      nombre: servicio.nombre || '',
      descripcion: servicio.descripcion || '',
      precio: servicio.precio ?? '',
      duracionMinutos: servicio.duracionMinutos ?? '',
    })
    setError('')
  }

  function cancelar() {
    setEditandoId(null)
    setForm(FORM_INICIAL)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim() || !form.precio || !form.duracionMinutos) {
      setError('Completa nombre, precio y duración.')
      return
    }
    setError('')
    setGuardando(true)
    try {
      const datos = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        precio: Number(form.precio),
        duracionMinutos: Number(form.duracionMinutos),
      }
      if (editandoId) {
        await updateDoc(doc(db, 'negocios', uid, 'servicios', editandoId), datos)
      } else {
        await addDoc(collection(db, 'negocios', uid, 'servicios'), { ...datos, visible: true, fotoUrl: '' })
      }
      cancelar()
    } catch (err) {
      setError('No se pudo guardar el servicio. Intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  async function toggleVisible(servicio) {
    await updateDoc(doc(db, 'negocios', uid, 'servicios', servicio.id), { visible: !servicio.visible })
  }

  async function eliminar(servicio) {
    if (!window.confirm(`¿Eliminar "${servicio.nombre}"? Esta acción no se puede deshacer.`)) return
    await deleteDoc(doc(db, 'negocios', uid, 'servicios', servicio.id))
  }

  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Servicios</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 24 }}>
        Publica los servicios que ofrece tu negocio — aparecerán en tu portafolio público.
      </p>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 14 }}>
          {editandoId ? 'Editar servicio' : 'Agregar servicio'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Nombre</label>
            <input value={form.nombre} onChange={update('nombre')} placeholder="Corte fade + estilizado" style={{ marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Precio (COP)</label>
            <input type="number" min="0" value={form.precio} onChange={update('precio')} placeholder="22000" style={{ marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Duración (min)</label>
            <input type="number" min="1" value={form.duracionMinutos} onChange={update('duracionMinutos')} placeholder="40" style={{ marginTop: 4 }} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Descripción (opcional)</label>
          <textarea rows={2} value={form.descripcion} onChange={update('descripcion')} placeholder="Fade con diseño y acabado en navaja." style={{ marginTop: 4, resize: 'vertical' }} />
        </div>
        {error && <div className="error-text">{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar servicio'}
          </button>
          {editandoId && (
            <button type="button" onClick={cancelar} className="btn btn-outline">Cancelar</button>
          )}
        </div>
      </form>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Tus servicios ({servicios.length})</div>
        {servicios.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Aún no has agregado servicios.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {servicios.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0',
                  borderTop: '1px solid var(--border)', gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.nombre}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {COP.format(s.precio || 0)} · {s.duracionMinutos} min{s.descripcion ? ` · ${s.descripcion}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => toggleVisible(s)}
                    style={{
                      fontSize: 11.5, fontWeight: 700, padding: '5px 11px', borderRadius: 999, border: 'none',
                      background: s.visible ? 'var(--sage-soft)' : 'var(--surface-2)',
                      color: s.visible ? 'var(--sage-text)' : 'var(--text-faint)',
                    }}
                  >
                    {s.visible ? 'Visible' : 'Oculto'}
                  </button>
                  <button type="button" onClick={() => empezarEdicion(s)} className="btn btn-outline" style={{ padding: '7px 10px' }} title="Editar">
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminar(s)}
                    className="btn btn-outline"
                    style={{ padding: '7px 10px', color: 'var(--danger)' }}
                    title="Eliminar"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
