import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { ESPECIALIDADES } from '../especialidades.js'
import Icon from './Icon.jsx'
import ToggleIOS from './ToggleIOS.jsx'
import CampoDireccion from './CampoDireccion.jsx'
import MapaUbicacion from './MapaUbicacion.jsx'
import useIsMobile from '../hooks/useIsMobile.js'
import { geocodeDireccion } from '../maps/osm.js'
import { DIAS_ENTRE_SEMANA, DIAS_ESPECIALES, HORARIO_INICIAL, bloqueGuardado } from '../horarios.js'

// Modal de edición de la información pública del negocio (RF-06/RF-11):
// nombre, descripción, dirección, contacto y horarios. Escribe directamente
// sobre negocios/{uid}; OwnerLayout está suscrito con onSnapshot, así que
// los cambios se reflejan solos en el resto del panel al guardar.

// Horario inicial del formulario: un bloque por día (ver horarios.js),
// leyendo también los formatos anteriores ("lunesAViernes",
// "domingoFestivos") para negocios que aún no lo han vuelto a guardar.
function horariosIniciales(horarios) {
  return [...DIAS_ENTRE_SEMANA, ...DIAS_ESPECIALES].reduce((acc, d) => {
    const previo = bloqueGuardado(horarios, d.key) || HORARIO_INICIAL[d.key]
    acc[d.key] = {
      activo: previo.activo !== false && !!previo.apertura,
      apertura: previo.apertura || HORARIO_INICIAL[d.key].apertura,
      cierre: previo.cierre || HORARIO_INICIAL[d.key].cierre,
    }
    return acc
  }, {})
}

// "Mismo horario" arranca encendido si todos los días abiertos entre semana
// ya comparten horario — el caso más común.
function compartenHorario(horarios) {
  const abiertos = DIAS_ENTRE_SEMANA.map((d) => horarios[d.key]).filter((b) => b.activo)
  return abiertos.every((b) => b.apertura === abiertos[0].apertura && b.cierre === abiertos[0].cierre)
}

const TODOS_LOS_DIAS = [...DIAS_ENTRE_SEMANA, ...DIAS_ESPECIALES]

export default function EditarNegocioModal({ negocio, uid, onClose }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState(() => ({
    nombre: negocio.nombre || '',
    descripcion: negocio.descripcion || '',
    direccion: negocio.direccion || '',
    correo: negocio.correo || '',
    telefono: negocio.canalesContacto?.telefono || '',
    whatsapp: negocio.canalesContacto?.whatsapp || '',
    especialidades: negocio.especialidades || [],
    horarios: horariosIniciales(negocio.horarios),
  }))
  const [mismoHorario, setMismoHorario] = useState(() => compartenHorario(form.horarios))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  // ubicacion viaja aparte de `form` porque solo cambia cuando se elige una
  // sugerencia del autocompletado, no con cada tecla del input de texto.
  const [ubicacion, setUbicacion] = useState(negocio.ubicacion || null)
  // Dirección a la que corresponden las coordenadas guardadas en `ubicacion`.
  // Si el dueño edita el texto a mano (sin elegir una sugerencia), deja de
  // coincidir y al guardar se re-geocodifica.
  const [direccionDeUbicacion, setDireccionDeUbicacion] = useState(negocio.direccion || '')

  function update(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  function updateHorario(dia, campo) {
    return (e) => setForm((f) => ({
      ...f,
      horarios: { ...f.horarios, [dia]: { ...f.horarios[dia], [campo]: e.target.value } },
    }))
  }

  function toggleDia(dia) {
    return (activo) => setForm((f) => ({
      ...f,
      horarios: { ...f.horarios, [dia]: { ...f.horarios[dia], activo } },
    }))
  }

  // Con "mismo horario" encendido, un solo par de horas vale para los cinco
  // días entre semana (también los cerrados, para que al abrirlos ya tengan
  // ese horario).
  function updateHorarioSemana(campo) {
    return (e) => setForm((f) => {
      const horarios = { ...f.horarios }
      DIAS_ENTRE_SEMANA.forEach((d) => { horarios[d.key] = { ...horarios[d.key], [campo]: e.target.value } })
      return { ...f, horarios }
    })
  }

  function cambiarMismoHorario(valor) {
    setMismoHorario(valor)
    if (!valor) return
    // Al volver a "mismo horario", todos toman el del primer día abierto.
    setForm((f) => {
      const base = DIAS_ENTRE_SEMANA.map((d) => f.horarios[d.key]).find((b) => b.activo) || f.horarios.lunes
      const horarios = { ...f.horarios }
      DIAS_ENTRE_SEMANA.forEach((d) => {
        horarios[d.key] = { ...horarios[d.key], apertura: base.apertura, cierre: base.cierre }
      })
      return { ...f, horarios }
    })
  }

  function toggleEspecialidad(especialidad) {
    setForm((f) => ({
      ...f,
      especialidades: f.especialidades.includes(especialidad)
        ? f.especialidades.filter((e) => e !== especialidad)
        : [...f.especialidades, especialidad],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim() || !form.direccion.trim()) {
      setError('El nombre y la dirección son obligatorios.')
      return
    }
    const horarioInvalido = TODOS_LOS_DIAS.find((d) => {
      const b = form.horarios[d.key]
      return b.activo && (!b.apertura || !b.cierre || b.apertura >= b.cierre)
    })
    if (horarioInvalido) {
      setError(`Revisa el horario del ${horarioInvalido.label.toLowerCase()}: la hora de cierre debe ser después de la de apertura.`)
      return
    }
    setError('')
    setGuardando(true)
    try {
      // Si el texto ya no coincide con la dirección que arrojó la última
      // coordenada conocida (p. ej. el dueño la editó a mano sin elegir una
      // sugerencia del autocompletado), se re-geocodifica como respaldo. Si
      // falla, se guarda igual: la ubicación en el mapa es un extra (RF-06).
      let ubicacionFinal = ubicacion
      if (form.direccion.trim() !== direccionDeUbicacion) {
        try {
          ubicacionFinal = await geocodeDireccion(form.direccion)
        } catch (geoErr) {
          ubicacionFinal = null
          // eslint-disable-next-line no-console
          console.error(geoErr)
        }
      }

      await updateDoc(doc(db, 'negocios', uid), {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        direccion: form.direccion.trim(),
        ubicacion: ubicacionFinal || null,
        correo: form.correo.trim(),
        canalesContacto: {
          ...negocio.canalesContacto,
          telefono: form.telefono.trim(),
          whatsapp: form.whatsapp.trim(),
        },
        especialidades: form.especialidades,
        horarios: form.horarios,
      })
      onClose()
    } catch (err) {
      setError('No se pudo guardar la información. Intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'oklch(20% 0.01 0 / 0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20, overflowY: 'auto',
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 560, maxWidth: '100%', padding: 22, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Editar información del negocio</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Estos datos se muestran en tu vitrina pública.
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginTop: 18 }}>Nombre del negocio</label>
        <input maxLength={80} value={form.nombre} onChange={update('nombre')} style={{ marginTop: 6 }} />

        <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginTop: 14 }}>Descripción</label>
        <textarea maxLength={600} rows={2} value={form.descripcion} onChange={update('descripcion')} style={{ marginTop: 6, resize: 'vertical' }} />

        <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginTop: 14 }}>Dirección</label>
        <CampoDireccion
          value={form.direccion}
          onChange={(direccion) => setForm((f) => ({ ...f, direccion }))}
          onSeleccion={({ direccion, ubicacion: nuevaUbicacion }) => {
            setForm((f) => ({ ...f, direccion }))
            setUbicacion(nuevaUbicacion)
            setDireccionDeUbicacion(direccion)
          }}
          style={{ marginTop: 6 }}
        />

        <div style={{ marginTop: 10 }}>
          <MapaUbicacion
            ubicacion={ubicacion}
            onCambiar={({ direccion, ubicacion: nuevaUbicacion }) => {
              setUbicacion(nuevaUbicacion)
              if (direccion) {
                setForm((f) => ({ ...f, direccion }))
                setDireccionDeUbicacion(direccion)
              } else {
                // La geocodificación inversa falló: igual se guardan las
                // coordenadas del pin, pero el texto se deja como está.
                setDireccionDeUbicacion(form.direccion)
              }
            }}
          />
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginTop: 14 }}>Especialidades</label>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2, marginBottom: 8 }}>
          Ayudan a que tu negocio aparezca en las búsquedas y recomendaciones correctas.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ESPECIALIDADES.map((especialidad) => {
            const activa = form.especialidades.includes(especialidad)
            return (
              <button
                key={especialidad}
                type="button"
                onClick={() => toggleEspecialidad(especialidad)}
                style={{
                  fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999,
                  border: `1px solid ${activa ? 'var(--accent)' : 'var(--border-strong)'}`,
                  background: activa ? 'var(--accent-soft)' : 'var(--surface)',
                  color: activa ? 'var(--accent-hover)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'border-color .15s, background .15s, color .15s',
                }}
              >
                {activa ? '✓ ' : ''}{especialidad}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block' }}>Correo de contacto</label>
            <input maxLength={120} type="email" value={form.correo} onChange={update('correo')} placeholder="negocio@ejemplo.com" style={{ marginTop: 6 }} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block' }}>Teléfono</label>
            <input maxLength={20} type="tel" value={form.telefono} onChange={update('telefono')} style={{ marginTop: 6 }} />
          </div>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginTop: 14 }}>WhatsApp</label>
        <input maxLength={20} type="tel" value={form.whatsapp} onChange={update('whatsapp')} style={{ marginTop: 6 }} />

        <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 18 }}>Horarios de atención</div>

        {/* Entre semana: un círculo por día (estilo "Repetir" de iOS) para
            abrirlo o cerrarlo, y debajo el horario — uno compartido o uno
            por día, según "Mismo horario todos los días". */}
        <div className="card" style={{ padding: 14, marginTop: 10, background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Entre semana</span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'right' }}>{resumenDiasAbiertos(form.horarios)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
            {DIAS_ENTRE_SEMANA.map((d) => (
              <button
                key={d.key}
                type="button"
                className="dia-circulo"
                aria-pressed={form.horarios[d.key].activo}
                aria-label={`${d.label}: ${form.horarios[d.key].activo ? 'abierto' : 'cerrado'}`}
                title={d.label}
                onClick={() => toggleDia(d.key)(!form.horarios[d.key].activo)}
              >
                {d.inicial}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8, textAlign: 'center' }}>
            Toca un día para abrirlo o cerrarlo.
          </div>

          {DIAS_ENTRE_SEMANA.some((d) => form.horarios[d.key].activo) && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '14px 0 12px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Mismo horario todos los días</span>
                <ToggleIOS checked={mismoHorario} onChange={cambiarMismoHorario} label="Mismo horario todos los días" />
              </div>

              {mismoHorario ? (
                <RangoHoras
                  bloque={DIAS_ENTRE_SEMANA.map((d) => form.horarios[d.key]).find((b) => b.activo)}
                  onApertura={updateHorarioSemana('apertura')}
                  onCierre={updateHorarioSemana('cierre')}
                />
              ) : (
                DIAS_ENTRE_SEMANA.filter((d) => form.horarios[d.key].activo).map((d) => (
                  <div
                    key={d.key}
                    style={{
                      display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                      alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 0 : 10,
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', width: isMobile ? 'auto' : 82, flexShrink: 0, marginTop: 10 }}>
                      {d.label}
                    </span>
                    <div style={{ flex: 1 }}>
                      <RangoHoras
                        bloque={form.horarios[d.key]}
                        onApertura={updateHorario(d.key, 'apertura')}
                        onCierre={updateHorario(d.key, 'cierre')}
                      />
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 14, marginBottom: 2 }}>
          Fin de semana y festivos: activa o desactiva el servicio de cada uno.
        </div>
        {DIAS_ESPECIALES.map((d) => {
          const bloque = form.horarios[d.key]
          return (
            <div
              key={d.key}
              className="card"
              style={{ padding: '10px 14px', marginTop: 8, background: 'var(--surface-2)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{d.label}</span>
                <ToggleIOS checked={bloque.activo} onChange={toggleDia(d.key)} label={`Servicio los ${d.label.toLowerCase()}`} />
              </div>
              {bloque.activo ? (
                <RangoHoras
                  bloque={bloque}
                  onApertura={updateHorario(d.key, 'apertura')}
                  onCierre={updateHorario(d.key, 'cierre')}
                />
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>Sin servicio</div>
              )}
            </div>
          )
        })}

        {error && <div className="error-text">{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={guardando} style={{ flex: 1 }}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Par de horas apertura – cierre de un día (o del horario compartido).
function RangoHoras({ bloque, onApertura, onCierre }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
      <input type="time" value={bloque.apertura} onChange={onApertura} aria-label="Hora de apertura" style={{ flex: 1, minWidth: 0 }} />
      <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}>–</span>
      <input type="time" value={bloque.cierre} onChange={onCierre} aria-label="Hora de cierre" style={{ flex: 1, minWidth: 0 }} />
    </div>
  )
}

// Texto corto de qué días abre entre semana: "Lunes a viernes",
// "Lun, mar y jue", "Cerrado"…
function resumenDiasAbiertos(horarios) {
  const abiertos = DIAS_ENTRE_SEMANA.filter((d) => horarios[d.key].activo)
  if (abiertos.length === 0) return 'Cerrado'
  if (abiertos.length === DIAS_ENTRE_SEMANA.length) return 'Lunes a viernes'
  const cortos = abiertos.map((d, i) => (i === 0 ? d.label.slice(0, 3) : d.label.slice(0, 3).toLowerCase()))
  return cortos.length === 1 ? abiertos[0].label : `${cortos.slice(0, -1).join(', ')} y ${cortos[cortos.length - 1]}`
}
