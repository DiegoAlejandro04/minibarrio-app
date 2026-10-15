import { useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { addDoc, collection, deleteDoc, deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import Icon from '../../components/Icon.jsx'
import ToggleIOS from '../../components/ToggleIOS.jsx'
import ConfirmarModal from '../../components/ConfirmarModal.jsx'
import RecorteImagen from '../../components/RecorteImagen.jsx'
import AvatarProfesional from '../../components/AvatarProfesional.jsx'
import useEquipo from '../../hooks/useEquipo.js'
import useIsMobile from '../../hooks/useIsMobile.js'
import { cargarImagen, pesoKb } from '../../imagenes.js'
import { bloqueDeDia, diasAbiertos, formatoHora12 } from '../../horarios.js'
import {
  CARGOS_SUGERIDOS, DIAS_SEMANA, MAX_CARGO, MAX_EQUIPO, MAX_NOMBRE_PROFESIONAL,
  horarioDe, resumenDias, resumenHorario, tieneHorarioPorDia, textoRango,
} from '../../equipo.js'

// Panel del negocio → "Equipo": las personas que atienden, con su foto (o
// iniciales), su cargo y los días que trabaja (ver src/equipo.js). Con al
// menos una persona activa, el cliente elige con quién reservar y cada
// persona tiene su propia agenda (NegocioDetalle.jsx, turnosOcupados.js).
// Pausar a alguien (vacaciones) lo oculta al reservar sin borrar sus citas.
// Cada persona atiende en el horario del negocio o en uno propio (hora de
// entrada y salida), que puede cambiar en días puntuales; al reservar solo
// se ofrecen los turnos dentro de su horario.

const MAX_FOTO_KB = 140 // mismo tope que el logo en firestore.rules

export default function OwnerEquipo() {
  const { negocio, uid } = useOutletContext()
  const isMobile = useIsMobile()
  const { equipo, cargado } = useEquipo(uid)
  const [editando, setEditando] = useState(null) // null | 'nuevo' | profesional
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const abiertos = diasAbiertos(negocio.horarios)
  const activos = equipo.filter((p) => p.activo !== false).length

  async function eliminar() {
    setEliminando(true)
    try {
      await deleteDoc(doc(db, 'negocios', uid, 'profesionales', porEliminar.id))
      setPorEliminar(null)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Equipo</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
            Las personas que atienden en tu negocio y los días que trabajan. Tus clientes eligen con quién reservar, y cada persona tiene su propia agenda.
          </p>
        </div>
        {equipo.length > 0 && !editando && equipo.length < MAX_EQUIPO && (
          <button type="button" className="btn btn-primary" onClick={() => setEditando('nuevo')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="plus" size={16} /> Agregar persona
          </button>
        )}
      </div>

      {editando && (
        <FormularioProfesional
          uid={uid}
          profesional={editando === 'nuevo' ? null : editando}
          horariosNegocio={negocio.horarios}
          diasPorDefecto={abiertos}
          diasAbiertos={abiertos}
          isMobile={isMobile}
          onListo={() => setEditando(null)}
        />
      )}

      {cargado && equipo.length === 0 && !editando && (
        <section className="card equipo-vacio">
          <div className="equipo-vacio__avatares" aria-hidden="true">
            <span style={{ background: 'oklch(66% 0.15 48)' }}><Icon name="user" size={20} /></span>
            <span style={{ background: 'oklch(60% 0.09 160)' }}><Icon name="user" size={20} /></span>
            <span style={{ background: 'oklch(60% 0.12 250)' }}><Icon name="plus" size={20} /></span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 17, marginTop: 16 }}>Agrega a tu equipo</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.55, maxWidth: 440, margin: '6px auto 0' }}>
            Si en tu negocio atiende más de una persona, agrégalas aquí. Así dos clientes pueden reservar a la misma hora con personas distintas, y cada uno elige con quién.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setEditando('nuevo')} style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="plus" size={16} /> Agregar la primera persona
          </button>
          <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 14 }}>
            Mientras no tengas equipo, tus reservas funcionan con una sola agenda, como hasta ahora.
          </p>
        </section>
      )}

      {equipo.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Tu equipo</span>
            <span className="equipo-contador">{activos} {activos === 1 ? 'activa' : 'activas'}{equipo.length > activos ? ` · ${equipo.length - activos} en pausa` : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {equipo.map((p) => (
              <TarjetaProfesional
                key={p.id}
                profesional={p}
                uid={uid}
                onEditar={() => setEditando(p)}
                onEliminar={() => setPorEliminar(p)}
              />
            ))}
          </div>
        </>
      )}

      {porEliminar && (
        <ConfirmarModal
          titulo={`¿Eliminar a ${porEliminar.nombre}?`}
          mensaje="Ya no aparecerá al reservar. Sus citas ya reservadas se mantienen en tu agenda. Si solo sale unos días, mejor ponla en pausa."
          textoConfirmar="Eliminar"
          textoCargando="Eliminando…"
          icono="trash"
          cargando={eliminando}
          onConfirmar={eliminar}
          onCerrar={() => setPorEliminar(null)}
        />
      )}
    </div>
  )
}

function TarjetaProfesional({ profesional, uid, onEditar, onEliminar }) {
  const activo = profesional.activo !== false
  const dias = new Set(profesional.dias || [])

  return (
    <article className={`card equipo-tarjeta${activo ? '' : ' en-pausa'}`}>
      <AvatarProfesional profesional={profesional} tamano={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{profesional.nombre}</span>
          <span className={`equipo-estado${activo ? '' : ' pausa'}`}>{activo ? 'Activo' : 'En pausa'}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
          {profesional.cargo || 'Sin cargo'} · {resumenDias(profesional.dias)}
        </div>
        <div className="equipo-dias" aria-label={`Trabaja: ${resumenDias(profesional.dias)}`}>
          {DIAS_SEMANA.map((d) => {
            const propio = dias.has(d.dia) && horarioDe(profesional, d.dia)
            return (
              <span
                key={d.dia}
                className={dias.has(d.dia) ? 'on' : ''}
                title={dias.has(d.dia) ? `${d.nombre}: ${propio ? textoRango(propio) : 'horario del negocio'}` : `${d.nombre}: no trabaja`}
              >
                {d.corto}
              </span>
            )
          })}
        </div>
        <div className="equipo-horario">
          <Icon name="clock" size={13} /> {resumenHorario(profesional)}
        </div>
      </div>
      <div className="equipo-acciones">
        <ToggleIOS
          checked={activo}
          label={activo ? `Poner en pausa a ${profesional.nombre}` : `Activar a ${profesional.nombre}`}
          onChange={(v) => updateDoc(doc(db, 'negocios', uid, 'profesionales', profesional.id), { activo: v })}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="equipo-boton" onClick={onEditar} aria-label={`Editar a ${profesional.nombre}`} title="Editar">
            <Icon name="edit" size={15} />
          </button>
          <button type="button" className="equipo-boton peligro" onClick={onEliminar} aria-label={`Eliminar a ${profesional.nombre}`} title="Eliminar">
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
    </article>
  )
}

// Horario que se propone al activar "Horario propio": el del primer día que
// abre el negocio, o 9:00 a 6:00 si no tiene horario publicado.
function horarioSugerido(horariosNegocio, abiertos) {
  const bloque = abiertos.length ? bloqueDeDia(horariosNegocio, abiertos[0]) : null
  return { inicio: bloque?.apertura || '09:00', fin: bloque?.cierre || '18:00' }
}

function FormularioProfesional({ uid, profesional, horariosNegocio, diasPorDefecto, diasAbiertos: abiertos, isMobile, onListo }) {
  const [nombre, setNombre] = useState(profesional?.nombre || '')
  const [cargo, setCargo] = useState(profesional?.cargo || '')
  const [dias, setDias] = useState(() => new Set(profesional?.dias || diasPorDefecto))
  // Horario: el del negocio, o uno propio (entrada y salida) que se puede
  // cambiar en días puntuales (horariosDia).
  const [horarioPropio, setHorarioPropio] = useState(() => !!(horarioDe(profesional) || tieneHorarioPorDia(profesional)))
  const [horario, setHorario] = useState(() => horarioDe(profesional) || horarioSugerido(horariosNegocio, abiertos))
  const [porDia, setPorDia] = useState(() => tieneHorarioPorDia(profesional))
  const [horariosDia, setHorariosDia] = useState(() => ({ ...(profesional?.horariosDia || {}) }))
  const [foto, setFoto] = useState(profesional?.foto || null)
  const [imagen, setImagen] = useState(null) // imagen recién elegida, para recortar
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const entrada = useRef(null)

  function alternarDia(dia) {
    setDias((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(dia)) nuevo.delete(dia)
      else nuevo.add(dia)
      return nuevo
    })
  }

  async function elegirFoto(archivo) {
    setError('')
    if (archivo.size > 15 * 1024 * 1024) {
      setError('La foto pesa más de 15 MB. Elige una más liviana.')
      return
    }
    try {
      setImagen(await cargarImagen(archivo))
    } catch (err) {
      setError(err.message)
    }
  }

  function descartarImagen() {
    if (imagen) URL.revokeObjectURL(imagen.url)
    setImagen(null)
  }

  function usarRecorte(dataUrl) {
    if (pesoKb(dataUrl) > MAX_FOTO_KB) {
      setError('La foto quedó muy pesada. Prueba con otra o acércala más con el zoom.')
      return
    }
    setFoto(dataUrl)
    descartarImagen()
  }

  // Horario de un día en el formulario: el suyo si lo cambió, o el general.
  const horarioDelDia = (dia) => horariosDia[dia] || horario

  function cambiarHorarioDia(dia, campo, valor) {
    setHorariosDia((prev) => ({ ...prev, [dia]: { ...horarioDelDia(dia), [campo]: valor } }))
  }

  async function guardar(e) {
    e.preventDefault()
    const limpio = nombre.trim().replace(/\s+/g, ' ')
    if (limpio.length < 2) {
      setError('Escribe el nombre de la persona.')
      return
    }
    if (dias.size === 0) {
      setError('Marca al menos un día de trabajo.')
      return
    }
    const diasOrdenados = DIAS_SEMANA.map((d) => d.dia).filter((d) => dias.has(d))
    // Solo se guardan los días con un horario distinto al general.
    const excepciones = {}
    if (horarioPropio && porDia) {
      diasOrdenados.forEach((d) => {
        const h = horariosDia[d]
        if (h && (h.inicio !== horario.inicio || h.fin !== horario.fin)) excepciones[String(d)] = { inicio: h.inicio, fin: h.fin }
      })
    }
    if (horarioPropio) {
      const rangos = [horario, ...Object.values(excepciones)]
      if (rangos.some((h) => !h.inicio || !h.fin || h.inicio >= h.fin)) {
        setError('Revisa el horario: la hora de salida tiene que ser después de la de entrada.')
        return
      }
    }
    setError('')
    setGuardando(true)
    const datos = {
      nombre: limpio,
      cargo: cargo.trim(),
      dias: diasOrdenados,
    }
    const conExcepciones = Object.keys(excepciones).length > 0
    try {
      if (profesional) {
        await updateDoc(doc(db, 'negocios', uid, 'profesionales', profesional.id), {
          ...datos,
          foto: foto || deleteField(),
          horario: horarioPropio ? { inicio: horario.inicio, fin: horario.fin } : deleteField(),
          horariosDia: conExcepciones ? excepciones : deleteField(),
        })
      } else {
        await addDoc(collection(db, 'negocios', uid, 'profesionales'), {
          ...datos,
          activo: true,
          ...(foto ? { foto } : {}),
          ...(horarioPropio ? { horario: { inicio: horario.inicio, fin: horario.fin } } : {}),
          ...(conExcepciones ? { horariosDia: excepciones } : {}),
          creadoEn: serverTimestamp(),
        })
      }
      onListo()
    } catch (err) {
      setError('No se pudo guardar. Intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  const vistaPrevia = { nombre: nombre || '?', foto }

  return (
    <form onSubmit={guardar} className="card equipo-formulario">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{profesional ? `Editar a ${profesional.nombre}` : 'Nueva persona del equipo'}</div>
        <button type="button" className="equipo-boton" onClick={onListo} aria-label="Cerrar formulario"><Icon name="x" size={16} /></button>
      </div>

      {imagen ? (
        <RecorteImagen
          imagen={imagen}
          ancho={220}
          alto={220}
          forma="circulo"
          salida={{ salidaAncho: 256, salidaAlto: 256, calidad: 0.85 }}
          guardando={false}
          onGuardar={usarRecorte}
          onCancelar={descartarImagen}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '150px 1fr', gap: isMobile ? 18 : 24, alignItems: 'start' }}>
          <div className="equipo-foto">
            <AvatarProfesional profesional={vistaPrevia} tamano={96} />
            <input
              ref={entrada}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const archivo = e.target.files?.[0]
                e.target.value = ''
                if (archivo) elegirFoto(archivo)
              }}
            />
            <button type="button" className="equipo-enlace" onClick={() => entrada.current?.click()}>
              <Icon name="upload" size={14} /> {foto ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {foto && (
              <button type="button" className="equipo-enlace tenue" onClick={() => setFoto(null)}>Quitar foto</button>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>Opcional. Sin foto se muestran sus iniciales.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div>
              <label className="equipo-etiqueta" htmlFor="equipo-nombre">Nombre</label>
              <input id="equipo-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={MAX_NOMBRE_PROFESIONAL} placeholder="Carlos Méndez" autoComplete="off" />
            </div>
            <div>
              <label className="equipo-etiqueta" htmlFor="equipo-cargo">Cargo <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
              <input id="equipo-cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={MAX_CARGO} placeholder="Barbero" autoComplete="off" />
              <div className="equipo-sugerencias">
                {CARGOS_SUGERIDOS.map((c) => (
                  <button type="button" key={c} className={cargo === c ? 'on' : ''} onClick={() => setCargo(c)}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <span className="equipo-etiqueta">Días que trabaja</span>
              <div className="equipo-selector-dias">
                {DIAS_SEMANA.map((d) => {
                  const cerrado = abiertos.length > 0 && !abiertos.includes(d.dia)
                  return (
                    <button
                      type="button"
                      key={d.dia}
                      className={`${dias.has(d.dia) ? 'on' : ''}${cerrado ? ' cerrado' : ''}`}
                      onClick={() => alternarDia(d.dia)}
                      aria-pressed={dias.has(d.dia)}
                      title={cerrado ? `${d.nombre}: tu negocio no abre ese día` : d.nombre}
                    >
                      <span className="corto">{d.corto}</span>
                      <span className="largo">{d.nombre.slice(0, 3)}</span>
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>
                {resumenDias([...dias])}. Los días que tu negocio no abre no se ofrecen al reservar.
              </div>
            </div>

            <div>
              <span className="equipo-etiqueta">Horario</span>
              <div className="equipo-segmentado" role="radiogroup" aria-label="Horario de la persona">
                <button type="button" role="radio" aria-checked={!horarioPropio} className={!horarioPropio ? 'on' : ''} onClick={() => setHorarioPropio(false)}>
                  Igual que el negocio
                </button>
                <button type="button" role="radio" aria-checked={horarioPropio} className={horarioPropio ? 'on' : ''} onClick={() => setHorarioPropio(true)}>
                  Horario propio
                </button>
              </div>

              {horarioPropio && (
                <div className="equipo-horario-editor">
                  <div className="equipo-horas">
                    <label>
                      <span>Entra</span>
                      <input type="time" step={1200} value={horario.inicio} onChange={(e) => setHorario((h) => ({ ...h, inicio: e.target.value }))} />
                    </label>
                    <span className="equipo-horas__guion" aria-hidden="true">–</span>
                    <label>
                      <span>Sale</span>
                      <input type="time" step={1200} value={horario.fin} onChange={(e) => setHorario((h) => ({ ...h, fin: e.target.value }))} />
                    </label>
                  </div>

                  <label className="equipo-check">
                    <input type="checkbox" checked={porDia} onChange={(e) => setPorDia(e.target.checked)} />
                    <span>Algún día tiene otro horario</span>
                  </label>

                  {porDia && (
                    <div className="equipo-dias-horario">
                      {DIAS_SEMANA.filter((d) => dias.has(d.dia)).map((d) => {
                        const h = horarioDelDia(d.dia)
                        const bloque = bloqueDeDia(horariosNegocio, d.dia)
                        const distinto = h.inicio !== horario.inicio || h.fin !== horario.fin
                        return (
                          <div key={d.dia} className={`equipo-dia-fila${distinto ? ' distinto' : ''}`}>
                            <span className="equipo-dia-fila__nombre">{d.nombre}</span>
                            <input type="time" step={1200} value={h.inicio} onChange={(e) => cambiarHorarioDia(d.dia, 'inicio', e.target.value)} aria-label={`${d.nombre}: entra`} />
                            <span aria-hidden="true">–</span>
                            <input type="time" step={1200} value={h.fin} onChange={(e) => cambiarHorarioDia(d.dia, 'fin', e.target.value)} aria-label={`${d.nombre}: sale`} />
                            <span className="equipo-dia-fila__negocio">
                              {bloque ? `Negocio: ${formatoHora12(bloque.apertura)} – ${formatoHora12(bloque.cierre)}` : 'El negocio no abre'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8 }}>
                    Solo se le reservan turnos dentro de este horario y del horario del negocio.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}

      {!imagen && (
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={onListo}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? 'Guardando…' : profesional ? 'Guardar cambios' : 'Agregar al equipo'}
          </button>
        </div>
      )}
    </form>
  )
}
