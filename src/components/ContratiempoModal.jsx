import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { codigoReserva } from '../reservas.js'

// Opciones del cliente cuando el negocio avisa un contratiempo con su cita
// (OwnerAgenda.jsx → notificación → Mis citas con ?contratiempo={citaId}):
// escribir al negocio por WhatsApp, reprogramar (cancela la cita y abre el
// portafolio para elegir otra hora) o esperar. Mismo cristal que
// ConfirmarModal.jsx.

const HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })

export default function ContratiempoModal({ cita, negocio, servicio, onReprogramar, onCerrar }) {
  const [confirmando, setConfirmando] = useState(false)
  const [reprogramando, setReprogramando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === 'Escape' && !reprogramando) onCerrar()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [reprogramando, onCerrar])

  const nombreNegocio = negocio?.nombre || 'El negocio'
  const hora = cita?.fecha ? HORA.format(cita.fecha) : ''
  const whatsapp = negocio?.canalesContacto?.whatsapp?.replace(/\D/g, '')
  const mensaje = cita
    ? `Hola ${nombreNegocio}, recibí el aviso del contratiempo con mi cita de ${servicio?.nombre || 'hoy'} a las ${hora} (reserva #${codigoReserva(cita.id)}).`
    : ''
  const vigente = cita && cita.estado === 'pendiente'

  async function reprogramar() {
    setReprogramando(true)
    setError('')
    try {
      await onReprogramar(cita)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err)
      setError('No pudimos liberar tu turno. Revisa tu conexión e inténtalo de nuevo.')
      setReprogramando(false)
    }
  }

  let contenido
  if (!cita) {
    contenido = <div className="siguiente-titulo">Buscando tu cita…</div>
  } else if (!vigente) {
    contenido = (
      <>
        <div className="siguiente-titulo">Esta cita ya no está pendiente</div>
        <p className="siguiente-texto">No hace falta que hagas nada más con ella.</p>
      </>
    )
  } else if (confirmando) {
    contenido = (
      <>
        <div className="siguiente-titulo">¿Reprogramamos tu cita?</div>
        <p className="siguiente-texto">
          Liberaremos tu turno de las {hora} en {nombreNegocio} y te llevaremos a su página para que elijas otro día u hora que te quede mejor.
        </p>
        {error && <p className="siguiente-error">{error}</p>}
        <div className="siguiente-botones">
          <button type="button" className="btn btn-primary" onClick={reprogramar} disabled={reprogramando}>
            {reprogramando ? 'Liberando tu turno…' : 'Sí, elegir otra hora'}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setConfirmando(false)} disabled={reprogramando}>Volver</button>
        </div>
      </>
    )
  } else {
    contenido = (
      <>
        <div className="siguiente-titulo">{nombreNegocio} tiene un contratiempo</div>
        <p className="siguiente-texto">
          Tu cita de {servicio?.nombre || 'hoy'} a las {hora} podría empezar un poco más tarde. Lamentamos la espera, ¿qué prefieres hacer?
        </p>
        <div className="siguiente-botones">
          {whatsapp && (
            <a
              className="contratiempo-opcion whatsapp"
              href={`https://wa.me/57${whatsapp}?text=${encodeURIComponent(mensaje)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="contratiempo-opcion__icono"><Icon name="chat" size={18} /></span>
              <span>
                <strong style={{ display: 'block', fontSize: 14 }}>Escribir por WhatsApp</strong>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Habla directamente con el negocio</span>
              </span>
            </a>
          )}
          <button type="button" className="contratiempo-opcion" onClick={() => setConfirmando(true)}>
            <span className="contratiempo-opcion__icono"><Icon name="calendar" size={18} /></span>
            <span>
              <strong style={{ display: 'block', fontSize: 14 }}>Reprogramar mi cita</strong>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Elige otro día u hora</span>
            </span>
          </button>
        </div>
      </>
    )
  }

  return (
    <div
      role="presentation"
      className="ventana-velo"
      onClick={reprogramando ? undefined : onCerrar}
      style={{
        position: 'fixed', inset: 0, background: 'oklch(20% 0.01 0 / 0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Contratiempo con tu cita"
        className="card ventana-vidrio"
        style={{ width: 400, maxWidth: '100%', padding: 24, textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="confirmar-icono siguiente-icono" aria-hidden="true"><Icon name="clock" size={22} /></span>
        {contenido}
        {!confirmando && (
          <button type="button" className="btn btn-outline siguiente-boton" onClick={onCerrar}>
            {vigente ? 'Esperaré, no hay problema' : 'Cerrar'}
          </button>
        )}
      </div>
    </div>
  )
}
