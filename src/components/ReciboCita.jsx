import { useEffect, useState } from 'react'
import { acortarDireccion } from '../maps/osm.js'
import { codigoReserva } from '../reservas.js'

// Comprobante de reserva con animación de "impresora de recibos": aparece
// debajo del panel de reserva (NegocioDetalle.jsx) cuando el cliente confirma
// una cita. Adaptado de "Receipt Printer" de dqnamo
// (https://zosasounds.com/ui/receipt-printer, libre para copiar) — el
// original usa Tailwind + Motion; aquí son estilos en línea y keyframes CSS
// (".recibo-*" en index.css) para no sumar dependencias.
//
// Tres etapas, igual que el original: "procesando" (spinner, papel oculto),
// "imprimiendo" (el papel sale de la ranura a saltos, línea por línea) y
// "listo" (check verde, papel completo).

const PROCESANDO_MS = 1600
const IMPRIMIENDO_MS = 2200

const ETIQUETAS = {
  procesando: 'Procesando tu reserva',
  imprimiendo: 'Imprimiendo tu comprobante',
  listo: 'Cita reservada',
}

// Borde inferior dentado del papel (40 dientes de 4px), con clip-path.
const DIENTES = 40
const PROFUNDIDAD_DIENTE = 4
const PUNTOS_DIENTES = Array.from({ length: DIENTES * 2 }, (_, i) => {
  const x = 100 - ((i + 1) * 100) / (DIENTES * 2)
  const y = i % 2 === 0 ? '100%' : `calc(100% - ${PROFUNDIDAD_DIENTE}px)`
  return `${x}% ${y}`
}).join(', ')
const CLIP_PAPEL = `polygon(0 0, 100% 0, 100% calc(100% - ${PROFUNDIDAD_DIENTE}px), ${PUNTOS_DIENTES})`

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const FECHA_CITA = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })

// "28 SEP 2026 · 14:32", como el pie del recibo original.
function sello(fecha) {
  const dia = String(fecha.getDate()).padStart(2, '0')
  const mes = fecha.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '').toUpperCase()
  const hh = String(fecha.getHours()).padStart(2, '0')
  const mm = String(fecha.getMinutes()).padStart(2, '0')
  return `${dia} ${mes} ${fecha.getFullYear()} · ${hh}:${mm}`
}

function Fila({ etiqueta, valor, fuerte, tenue }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontWeight: fuerte ? 700 : 400, color: tenue ? '#6b6b6b' : undefined }}>
      <dt>{etiqueta}</dt>
      <dd style={{ margin: 0, textAlign: 'right' }}>{valor}</dd>
    </div>
  )
}

function IconoEstado({ listo }) {
  return listo ? (
    <svg key="listo" className="recibo-icono" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="oklch(62% 0.15 150)" />
      <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg key="trabajando" className="recibo-icono recibo-spinner" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * `cita`: { id, negocio, direccion, servicio, duracionMinutos, precio,
 * fechaHora (Date), reservadaEn (Date) }. `onCerrar` se llama con el botón
 * "Aceptar", que aparece al terminar de imprimir.
 */
export default function ReciboCita({ cita, onCerrar }) {
  const [etapa, setEtapa] = useState('procesando')

  useEffect(() => {
    setEtapa('procesando')
    const aImprimiendo = setTimeout(() => setEtapa('imprimiendo'), PROCESANDO_MS)
    const aListo = setTimeout(() => setEtapa('listo'), PROCESANDO_MS + IMPRIMIENDO_MS)
    return () => {
      clearTimeout(aImprimiendo)
      clearTimeout(aListo)
    }
  }, [cita.id])

  const codigo = codigoReserva(cita.id)

  return (
    <section className="recibo" data-etapa={etapa} aria-label="Comprobante de reserva">
      <div className="recibo-maquina">
        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'rgb(255 255 255 / 0.8)', padding: '2px 0 12px' }}>
          MiniBarrio
        </div>

        <div className="recibo-pantalla">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{cita.servicio}</div>
              <div style={{ color: 'rgb(255 255 255 / 0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cita.negocio}
              </div>
            </div>
            <strong style={{ fontWeight: 700, flexShrink: 0 }}>{COP.format(cita.precio || 0)}</strong>
          </div>
          {/* minHeight reserva el alto del botón "Aceptar" desde el inicio,
              para que la pantalla no salte cuando aparece. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, minHeight: 30 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, color: 'rgb(255 255 255 / 0.6)' }}>
              <IconoEstado listo={etapa === 'listo'} />
            </span>
            <div role="status" aria-live="polite" key={etapa} className="recibo-estado">
              {ETIQUETAS[etapa]}
            </div>
            {etapa === 'listo' && (
              <button type="button" className="recibo-aceptar" onClick={onCerrar}>
                Aceptar
              </button>
            )}
          </div>
        </div>

        <div className="recibo-ranura" aria-hidden="true" />
      </div>

      <div className="recibo-salida">
        <div className="recibo-sombra-ranura" aria-hidden="true" />
        <div className="recibo-papel-mov" aria-hidden={etapa !== 'listo'}>
          <article className="recibo-papel" style={{ clipPath: CLIP_PAPEL }}>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, margin: 0 }}>MiniBarrio</p>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#6b6b6b', margin: '4px 0 0' }}>Comprobante de reserva</p>

            <hr className="recibo-separador" />

            <dl style={{ display: 'grid', gap: 6, margin: 0 }}>
              <Fila etiqueta={cita.servicio} valor={COP.format(cita.precio || 0)} />
              <Fila etiqueta="Duración" valor={`${cita.duracionMinutos} min`} tenue />
              <Fila etiqueta="Fecha" valor={FECHA_CITA.format(cita.fechaHora)} tenue />
              <Fila etiqueta="Hora" valor={HORA.format(cita.fechaHora)} fuerte />
              <Fila etiqueta="Total a pagar" valor={COP.format(cita.precio || 0)} fuerte />
            </dl>

            <hr className="recibo-separador" />

            <dl style={{ display: 'grid', gap: 4, margin: 0, fontSize: 11, color: '#6b6b6b' }}>
              <Fila etiqueta="Negocio" valor={cita.negocio} />
              {cita.direccion && <Fila etiqueta="Dirección" valor={acortarDireccion(cita.direccion)} />}
              <Fila etiqueta="Reserva" valor={`#${codigo}`} />
              <Fila etiqueta="Estado" valor="Pendiente" />
              <Fila etiqueta="Reservada" valor={sello(cita.reservadaEn)} />
            </dl>

            <p style={{ textAlign: 'center', fontSize: 10.5, color: '#6b6b6b', margin: '18px 0 0', lineHeight: 1.5 }}>
              El negocio debe confirmar tu cita.<br />El pago se hace en el local.
            </p>
            <p style={{ textAlign: 'center', fontSize: 10, letterSpacing: '0.3em', color: '#a3a3a3', margin: '14px 0 0' }}>
              RES {codigo}
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
