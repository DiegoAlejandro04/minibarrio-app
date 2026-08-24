import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext.jsx'
import { db } from '../../firebase/config'

// Perfil público del negocio + reserva de citas (RF-05, RF-06, RF-07, RF-08,
// RF-10). La reserva exige al menos un día de anticipación (no el mismo
// día), turnos cada 20 minutos dentro del horario de atención del negocio,
// y descarta los turnos que ya tienen una cita activa. El panel del
// comerciante (Resumen, Clientes, Servicios) ya escucha "citas" con
// onSnapshot, así que una reserva nueva se refleja ahí en tiempo real sin
// cambios adicionales.

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })

const DIAS_HORARIO = [
  { key: 'lunesAViernes', label: 'Lunes a viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingoFestivos', label: 'Domingo y festivos' },
]

function toDateInputValue(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function bloqueDelDia(horarios, fecha) {
  const dia = fecha.getDay() // 0 = domingo … 6 = sábado
  if (dia === 0) return horarios?.domingoFestivos
  if (dia === 6) return horarios?.sabado
  return horarios?.lunesAViernes
}

function generarSlots(bloque) {
  if (!bloque?.apertura || !bloque?.cierre) return []
  const [hA, mA] = bloque.apertura.split(':').map(Number)
  const [hC, mC] = bloque.cierre.split(':').map(Number)
  const inicio = hA * 60 + mA
  const fin = hC * 60 + mC
  const slots = []
  for (let m = inicio; m < fin; m += 20) {
    const h = String(Math.floor(m / 60)).padStart(2, '0')
    const min = String(m % 60).padStart(2, '0')
    slots.push(`${h}:${min}`)
  }
  return slots
}

function formatoHora12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h < 12 ? 'a. m.' : 'p. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function estadoApertura(horarios) {
  const bloque = bloqueDelDia(horarios, new Date())
  if (!bloque?.apertura || !bloque?.cierre) return null
  const [hA, mA] = bloque.apertura.split(':').map(Number)
  const [hC, mC] = bloque.cierre.split(':').map(Number)
  const ahora = new Date()
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const minutosApertura = hA * 60 + mA
  const minutosCierre = hC * 60 + mC
  if (minutosAhora < minutosApertura || minutosAhora >= minutosCierre) return 'cerrado'
  if (minutosCierre - minutosAhora <= 60) return 'cierra-pronto'
  return 'abierto'
}

const ESTADO_APERTURA_STYLES = {
  abierto: { label: 'Abierto', color: 'var(--sage-text)' },
  'cierra-pronto': { label: 'Cierra pronto', color: 'oklch(45% 0.11 75)' },
  cerrado: { label: 'Cerrado', color: 'var(--text-faint)' },
}

export default function NegocioDetalle() {
  const { id } = useParams()
  const { currentUser, role } = useAuth()
  const navigate = useNavigate()

  const [negocio, setNegocio] = useState(null)
  const [servicios, setServicios] = useState([])
  const [resenas, setResenas] = useState([])
  const [citas, setCitas] = useState([])
  const [loading, setLoading] = useState(true)

  const manana = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d
  }, [])
  const minFecha = useMemo(() => toDateInputValue(manana), [manana])

  const [servicioId, setServicioId] = useState(null)
  const [fecha, setFecha] = useState(minFecha)
  const [hora, setHora] = useState(null)
  const [reservando, setReservando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  useEffect(() => {
    const unsubs = [
      onSnapshot(doc(db, 'negocios', id), (snap) => {
        setNegocio(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      }),
      onSnapshot(collection(db, 'negocios', id, 'servicios'), (snap) => {
        setServicios(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.visible !== false))
      }),
      onSnapshot(collection(db, 'negocios', id, 'resenas'), (snap) => {
        setResenas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      }),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [id])

  // Registra la visita al perfil (solo clientes, una vez por cliente): crea
  // un marcador en negocios/{id}/visitas/{clienteId}. Las reglas de Firestore
  // solo permiten "create" ahí (no "update"), así que un mismo cliente jamás
  // puede duplicar su propia visita aunque vuelva a entrar varias veces.
  useEffect(() => {
    if (!currentUser || role !== 'cliente') return
    const visitaRef = doc(db, 'negocios', id, 'visitas', currentUser.uid)
    getDoc(visitaRef)
      .then((snap) => {
        if (snap.exists()) return undefined
        return setDoc(visitaRef, { visitadoEn: serverTimestamp() })
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err)
      })
  }, [currentUser, role, id])

  // Los turnos ocupados solo se pueden calcular con sesión iniciada: la
  // regla de "citas" exige estar autenticado para leerlas.
  useEffect(() => {
    if (!currentUser) {
      setCitas([])
      return undefined
    }
    const unsub = onSnapshot(query(collection(db, 'citas'), where('negocioId', '==', id)), (snap) => {
      setCitas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [currentUser, id])

  const rating = useMemo(() => {
    if (resenas.length === 0) return null
    return resenas.reduce((sum, r) => sum + (r.calificacion || 0), 0) / resenas.length
  }, [resenas])

  const servicioSeleccionado = useMemo(
    () => servicios.find((s) => s.id === servicioId) || null,
    [servicios, servicioId]
  )

  const fechaObj = useMemo(() => new Date(`${fecha}T00:00:00`), [fecha])
  const bloqueHorario = useMemo(() => bloqueDelDia(negocio?.horarios, fechaObj), [negocio, fechaObj])
  const slotsDelDia = useMemo(() => generarSlots(bloqueHorario), [bloqueHorario])

  const ocupados = useMemo(() => {
    const set = new Set()
    citas.forEach((c) => {
      if (c.estado === 'cancelada') return
      const d = c.fechaHora?.toDate ? c.fechaHora.toDate() : null
      if (!d || toDateInputValue(d) !== fecha) return
      set.add(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    })
    return set
  }, [citas, fecha])

  const estado = negocio ? estadoApertura(negocio.horarios) : null

  function handleCambiarFecha(e) {
    setFecha(e.target.value)
    setHora(null)
  }

  async function handleConfirmar() {
    if (!currentUser) {
      navigate('/login', { state: { from: { pathname: `/negocio/${id}` } } })
      return
    }
    if (role !== 'cliente') {
      setError('Solo las cuentas de cliente pueden reservar citas.')
      return
    }
    if (!servicioSeleccionado || !hora) return

    setError('')
    setReservando(true)
    try {
      const fechaHora = new Date(`${fecha}T${hora}:00`)
      await addDoc(collection(db, 'citas'), {
        negocioId: id,
        clienteId: currentUser.uid,
        servicioId: servicioSeleccionado.id,
        fechaHora,
        estado: 'pendiente',
        creadoEn: serverTimestamp(),
      })
      setExito(true)
      setHora(null)
    } catch (err) {
      setError('No se pudo confirmar la cita. Intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setReservando(false)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Cargando…</div>
  }

  if (!negocio) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Negocio no encontrado</div>
        <Link to="/" style={{ fontWeight: 700 }}>Volver a la vitrina</Link>
      </div>
    )
  }

  const fotos = negocio.fotos || []
  const whatsapp = negocio.canalesContacto?.whatsapp

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px 60px' }}>
      <Link to="/" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>← Volver a la vitrina</Link>

      <div
        style={{
          marginTop: 14, height: 220, display: 'grid',
          gridTemplateColumns: fotos.length > 1 ? '1.6fr 1fr' : '1fr', gap: 6,
          borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative',
        }}
      >
        {fotos.length === 0 ? (
          <div style={{ background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
            Este negocio aún no ha publicado fotos
          </div>
        ) : (
          <>
            <img src={fotos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.opacity = 0.15 }} />
            {fotos.length > 1 && (
              <div style={{ display: 'grid', gridTemplateRows: fotos.length > 2 ? '1fr 1fr' : '1fr', gap: 6, height: '100%' }}>
                {fotos.slice(1, 3).map((f) => (
                  <img key={f} src={f} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.opacity = 0.15 }} />
                ))}
              </div>
            )}
            {fotos.length > 3 && (
              <span
                style={{
                  position: 'absolute', bottom: 10, right: 10, fontSize: 11.5, fontWeight: 700, color: '#fff',
                  background: 'oklch(20% 0.01 0 / 0.65)', padding: '5px 10px', borderRadius: 999,
                }}
              >
                Ver las {fotos.length} fotos
              </span>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 18, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{negocio.nombre}</div>
            {negocio.verificado && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sage-text)', background: 'var(--sage-soft)', padding: '3px 9px', borderRadius: 999 }}>
                Verificado
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {rating ? <span>★ {rating.toFixed(1)} ({resenas.length} reseñas)</span> : <span>Sin reseñas aún</span>}
            <span>·</span>
            <span>{negocio.direccion}</span>
            {estado && (
              <>
                <span>·</span>
                <span style={{ color: ESTADO_APERTURA_STYLES[estado].color, fontWeight: 700 }}>{ESTADO_APERTURA_STYLES[estado].label}</span>
              </>
            )}
          </div>
          {negocio.descripcion && <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 8, maxWidth: 560 }}>{negocio.descripcion}</p>}
        </div>
      </div>

      <nav style={{ display: 'flex', gap: 22, marginTop: 18, borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
        <a href="#servicios" style={{ color: 'var(--text)', padding: '0 0 10px', borderBottom: '2px solid var(--accent)' }}>Servicios</a>
        <a href="#resenas" style={{ color: 'var(--text-muted)', padding: '0 0 10px' }}>Reseñas</a>
        <a href="#horarios" style={{ color: 'var(--text-muted)', padding: '0 0 10px' }}>Horarios</a>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, marginTop: 24, alignItems: 'start' }}>
        <div>
          <div id="servicios" style={{ fontWeight: 800, fontSize: 17, marginBottom: 4, scrollMarginTop: 20 }}>Servicios y precios</div>
          <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginBottom: 14 }}>Selecciona un servicio para reservar.</p>

          {servicios.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Este negocio todavía no ha publicado servicios.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {servicios.map((s) => {
                const seleccionado = s.id === servicioId
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setServicioId(s.id); setHora(null); setExito(false) }}
                    className="card"
                    style={{
                      textAlign: 'left', padding: 14, cursor: 'pointer', display: 'flex', gap: 12,
                      border: `1.5px solid ${seleccionado ? 'var(--accent)' : 'var(--border)'}`,
                      background: seleccionado ? 'var(--accent-soft)' : 'var(--surface)',
                    }}
                  >
                    {s.fotoUrl ? (
                      <img src={s.fotoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--surface-2)', flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.nombre}</div>
                      {s.descripcion && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{s.descripcion}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13, gap: 10 }}>
                        <span style={{ fontWeight: 700 }}>{COP.format(s.precio || 0)}</span>
                        <span style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{s.duracionMinutos} min</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div id="resenas" style={{ marginTop: 32, scrollMarginTop: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Reseñas de clientes</div>
            {resenas.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 8 }}>Este negocio todavía no tiene reseñas.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                {resenas.slice(0, 5).map((r) => (
                  <div key={r.id} className="card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>★ {r.calificacion || 0}</span>
                      {r.creadoEn?.toDate && (
                        <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                          {new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(r.creadoEn.toDate())}
                        </span>
                      )}
                    </div>
                    {r.comentario && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{r.comentario}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Servicio seleccionado</div>
          {servicioSeleccionado ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{servicioSeleccionado.nombre}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                {servicioSeleccionado.duracionMinutos} min · {COP.format(servicioSeleccionado.precio || 0)}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Elige un servicio de la lista.</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
            <div style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Fecha</label>
              <input
                type="date"
                min={minFecha}
                value={fecha}
                onChange={handleCambiarFecha}
                style={{ marginTop: 2, border: 'none', padding: '2px 0', fontSize: 13, fontWeight: 700 }}
              />
            </div>
            <div style={{ border: `1px solid ${hora ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Hora</label>
              <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: hora ? 'var(--accent-hover)' : 'var(--text-faint)' }}>
                {hora ? formatoHora12(hora) : 'Elige un turno'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
            Las citas se reservan con al menos un día de anticipación.
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>
              Turnos disponibles · {FECHA_CORTA.format(fechaObj)}
            </label>
            {!currentUser ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
                Inicia sesión para ver los turnos disponibles y reservar.
              </p>
            ) : slotsDelDia.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>Este negocio no atiende ese día.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                {slotsDelDia.map((s) => {
                  const ocupado = ocupados.has(s)
                  const seleccionado = hora === s
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={ocupado}
                      onClick={() => { setHora(s); setExito(false) }}
                      style={{
                        fontSize: 12.5, fontWeight: 700, padding: '9px 0', borderRadius: 8,
                        border: `1px solid ${seleccionado ? 'var(--accent)' : 'var(--border-strong)'}`,
                        background: ocupado ? 'var(--surface-2)' : seleccionado ? 'var(--accent)' : 'var(--surface)',
                        color: ocupado ? 'var(--text-faint)' : seleccionado ? '#fff' : 'var(--text)',
                        cursor: ocupado ? 'not-allowed' : 'pointer',
                        textDecoration: ocupado ? 'line-through' : 'none',
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}
          {exito && (
            <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: 'var(--sage-text)', background: 'var(--sage-soft)', padding: '10px 12px', borderRadius: 8 }}>
              ¡Listo! Tu cita quedó pendiente de confirmación por el negocio.
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={reservando || !servicioSeleccionado || (!!currentUser && !hora)}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16 }}
          >
            {!currentUser
              ? 'Inicia sesión para reservar'
              : reservando
              ? 'Confirmando…'
              : 'Confirmar cita'}
          </button>

          {whatsapp && (
            <a
              href={`https://wa.me/57${whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline"
              style={{ width: '100%', marginTop: 10, display: 'block', textAlign: 'center' }}
            >
              Escribir por WhatsApp
            </a>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 12, textAlign: 'center' }}>
            No se realizan pagos en la plataforma.
          </p>
        </div>

        {DIAS_HORARIO.some((d) => negocio.horarios?.[d.key]?.apertura) && (
          <div id="horarios" className="card" style={{ padding: 18, scrollMarginTop: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Horario de atención</div>
            {DIAS_HORARIO.map((d) => {
              const bloque = negocio.horarios?.[d.key]
              if (!bloque?.apertura) return null
              return (
                <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0', color: 'var(--text-muted)' }}>
                  <span>{d.label}</span>
                  <span>{formatoHora12(bloque.apertura)} – {formatoHora12(bloque.cierre)}</span>
                </div>
              )
            })}
            {negocio.canalesContacto?.telefono && (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                {negocio.canalesContacto.telefono}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
