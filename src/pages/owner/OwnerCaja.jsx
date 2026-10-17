import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import Icon from '../../components/Icon.jsx'
import ConfirmarModal from '../../components/ConfirmarModal.jsx'
import useIsMobile from '../../hooks/useIsMobile.js'

// Panel del negocio → "Caja": servicios atendidos fuera de MiniBarrio (el
// cliente llegó al local, llamó o escribió por WhatsApp). Cada registro se
// guarda en negocios/{uid}/atenciones y se suma en el Resumen a "Citas
// agendadas" e "Ingresos estimados" (OwnerResumen.jsx), para que el dueño
// lleve la cuenta completa. Tres caminos: un servicio del catálogo cobrado a
// su precio, el mismo cobrado a un valor mayor, o uno personalizado.

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const MILES = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
const COBRO_MAXIMO = 10000000 // mismo tope que en firestore.rules
const RECIENTES = 10
const PERSONALIZADO = 'personalizado'

const conPuntos = (digitos) => (digitos === '' ? '' : MILES.format(Number(digitos)))

export default function OwnerCaja() {
  const { servicios, uid } = useOutletContext()
  const isMobile = useIsMobile()

  const [eleccion, setEleccion] = useState(null) // id del servicio | PERSONALIZADO
  const [cobroMayor, setCobroMayor] = useState(null) // null | false | true
  const [monto, setMonto] = useState('') // solo dígitos
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(null) // { nombre, cobrado } del último registro

  const [registros, setRegistros] = useState([])
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    if (!uid) return undefined
    const q = query(collection(db, 'negocios', uid, 'atenciones'), orderBy('creadoEn', 'desc'), limit(RECIENTES))
    return onSnapshot(q, (snap) => {
      setRegistros(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })))
    })
  }, [uid])

  const catalogo = useMemo(
    () => [...servicios].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')),
    [servicios]
  )
  const servicio = eleccion && eleccion !== PERSONALIZADO ? catalogo.find((s) => s.id === eleccion) : null
  const esPersonalizado = eleccion === PERSONALIZADO
  const precio = servicio?.precio || 0

  // Lo que se va a registrar, o null si todavía falta algo.
  const montoNumero = Number(monto) || 0
  let cobrado = null
  let aviso = ''
  if (servicio && cobroMayor === false) cobrado = precio
  if (servicio && cobroMayor === true && montoNumero > 0) {
    if (montoNumero > precio) cobrado = montoNumero
    else aviso = `Escribe un valor mayor a ${COP.format(precio)}. Si le cobraste lo mismo, elige "No".`
  }
  if (esPersonalizado && montoNumero > 0) cobrado = montoNumero

  function elegir(id) {
    setEleccion(id)
    setCobroMayor(null)
    setMonto('')
    setError('')
    setListo(null)
  }

  function cambiarMonto(e) {
    let digitos = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
    if (Number(digitos) > COBRO_MAXIMO) digitos = String(COBRO_MAXIMO)
    setMonto(digitos)
  }

  async function registrar(e) {
    e.preventDefault()
    if (cobrado == null || guardando) return
    setGuardando(true)
    setError('')
    try {
      const datos = esPersonalizado
        ? { tipo: 'personalizado', servicioNombre: 'Servicio personalizado', cobrado }
        : { tipo: 'catalogo', servicioId: servicio.id, servicioNombre: servicio.nombre, precioServicio: precio, cobrado }
      await addDoc(collection(db, 'negocios', uid, 'atenciones'), { ...datos, creadoEn: serverTimestamp() })
      setListo({ nombre: datos.servicioNombre, cobrado })
      setEleccion(null)
      setCobroMayor(null)
      setMonto('')
    } catch {
      setError('No pudimos guardar el registro. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    setEliminando(true)
    try {
      await deleteDoc(doc(db, 'negocios', uid, 'atenciones', porEliminar.id))
      setPorEliminar(null)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Caja</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5 }}>
          ¿Atendiste a alguien que no reservó por MiniBarrio? Regístralo aquí y lo sumamos a tus citas y a tus ingresos estimados del Resumen, para que lleves la cuenta completa de tu negocio.
        </p>
      </div>

      {listo && (
        <div className="caja-listo" role="status">
          <span className="caja-listo__icono" aria-hidden="true"><Icon name="check" size={16} /></span>
          <span>
            <strong>¡Listo, quedó registrado!</strong> {listo.nombre} por {COP.format(listo.cobrado)}. Ya lo puedes ver en tu Resumen.
          </span>
        </div>
      )}

      <form className="card" onSubmit={registrar} style={{ padding: isMobile ? '18px 14px' : 24 }}>
        <div className="caja-paso">
          <span className="caja-paso__numero">1</span>
          <span>¿Qué servicio hiciste?</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {catalogo.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 4px' }}>
              Aún no tienes servicios publicados. Puedes agregarlos en &ldquo;Servicios&rdquo; o registrar este como personalizado.
            </p>
          )}
          {catalogo.map((s) => {
            const activo = eleccion === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => elegir(s.id)}
                className={`card servicio-fila caja-fila${activo ? ' servicio-fila--activo' : ''}`}
                aria-pressed={activo}
              >
                <span className="servicio-fila__icono" aria-hidden="true"><Icon name="scissors" size={20} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="caja-fila__nombre">{s.nombre}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {isMobile && <strong className="caja-fila__precio-movil">{COP.format(s.precio || 0)} · </strong>}
                    {s.duracionMinutos} min{s.visible === false ? ' · Oculto en tu portafolio' : ''}
                  </span>
                </span>
                {!isMobile && <span style={{ fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{COP.format(s.precio || 0)}</span>}
                <span className="servicio-fila__marca" aria-hidden="true">{activo && <Icon name="check" size={13} />}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => elegir(PERSONALIZADO)}
            className={`card servicio-fila caja-fila caja-personalizado${esPersonalizado ? ' servicio-fila--activo' : ''}`}
            aria-pressed={esPersonalizado}
          >
            <span className="servicio-fila__icono" aria-hidden="true"><Icon name="edit" size={19} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="caja-fila__nombre">Personalizado</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                Un trabajo especial que no está en tu catálogo
              </span>
            </span>
            <span className="servicio-fila__marca" aria-hidden="true">{esPersonalizado && <Icon name="check" size={13} />}</span>
          </button>
        </div>

        {servicio && (
          <div className="caja-bloque">
            <div className="caja-paso">
              <span className="caja-paso__numero">2</span>
              <span>¿Le cobraste más de lo que cuesta?</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: isMobile ? '6px 0 0' : '6px 0 0 34px' }}>
              En tu catálogo, {servicio.nombre} cuesta {COP.format(precio)}.
            </p>
            <div className="caja-opciones" role="radiogroup" aria-label="¿Le cobraste más de lo que cuesta?">
              <button
                type="button"
                role="radio"
                aria-checked={cobroMayor === false}
                className={`caja-opcion${cobroMayor === false ? ' activa' : ''}`}
                onClick={() => { setCobroMayor(false); setMonto('') }}
              >
                No, le cobré {COP.format(precio)}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={cobroMayor === true}
                className={`caja-opcion${cobroMayor === true ? ' activa' : ''}`}
                onClick={() => setCobroMayor(true)}
              >
                Sí, le cobré más
              </button>
            </div>
          </div>
        )}

        {((servicio && cobroMayor === true) || esPersonalizado) && (
          <div className="caja-bloque">
            <div className="caja-paso">
              <span className="caja-paso__numero">{esPersonalizado ? 2 : 3}</span>
              <span>{esPersonalizado ? '¿Cuánto le cobraste al cliente?' : '¿Cuánto le cobraste en total?'}</span>
            </div>
            <div className="caja-monto">
              <span aria-hidden="true">$</span>
              <input
                inputMode="numeric"
                autoFocus
                value={conPuntos(monto)}
                onChange={cambiarMonto}
                placeholder={servicio ? MILES.format(precio + 5000) : '30.000'}
                aria-label="Valor cobrado en pesos colombianos"
              />
            </div>
            {aviso && <p className="caja-aviso">{aviso}</p>}
            {servicio && cobrado != null && (
              <p style={{ color: 'var(--sage-text)', fontSize: 12.5, fontWeight: 700, margin: isMobile ? '8px 0 0' : '8px 0 0 34px' }}>
                {COP.format(cobrado - precio)} más que el precio del catálogo
              </p>
            )}
          </div>
        )}

        {error && <p className="caja-aviso" style={{ marginLeft: 0 }}>{error}</p>}

        {eleccion && (
          <div className="caja-pie">
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {cobrado != null
                ? <>Vas a registrar <strong style={{ color: 'var(--text)' }}>{COP.format(cobrado)}</strong></>
                : 'Completa los pasos para registrar'}
            </div>
            <button type="submit" className="btn btn-primary" disabled={cobrado == null || guardando}>
              {guardando ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        )}
      </form>

      <section className="card" style={{ marginTop: 16, padding: isMobile ? '18px 16px' : 22 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Tus últimos registros</div>
        {registros.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 8 }}>
            Aquí verás los servicios que registres. Si te equivocas en alguno, lo puedes eliminar.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
            {registros.map((r) => {
              const fecha = r.creadoEn?.toDate?.()
              const extra = r.tipo === 'catalogo' && r.cobrado > (r.precioServicio || 0) ? r.cobrado - (r.precioServicio || 0) : 0
              return (
                <div key={r.id} className="caja-registro">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {r.servicioNombre}
                      {r.tipo === 'personalizado' && <span className="caja-etiqueta">Personalizado</span>}
                      {extra > 0 && <span className="caja-etiqueta extra">+{COP.format(extra)}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{fecha ? FECHA_CORTA.format(fecha) : 'Guardando…'}</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{COP.format(r.cobrado || 0)}</div>
                  <button type="button" className="caja-eliminar" onClick={() => setPorEliminar(r)} aria-label={`Eliminar ${r.servicioNombre}`} title="Eliminar">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {porEliminar && (
        <ConfirmarModal
          titulo="¿Eliminar este registro?"
          mensaje={`${porEliminar.servicioNombre} por ${COP.format(porEliminar.cobrado || 0)} dejará de sumarse a tus citas e ingresos del Resumen.`}
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
