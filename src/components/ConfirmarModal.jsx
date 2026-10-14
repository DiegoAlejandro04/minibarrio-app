import { useEffect } from 'react'
import Icon from './Icon.jsx'

// Ventana de confirmación para acciones que no se pueden deshacer (p. ej.
// cancelar una cita, ver ClientResumen.jsx). Mismo cristal que PQRS y
// Contáctanos (.ventana-vidrio en index.css). Se cierra con "Volver", con
// Escape o tocando fuera — salvo mientras la acción está en curso.

export default function ConfirmarModal({
  titulo, mensaje, textoConfirmar = 'Confirmar', textoCargando = 'Un momento…',
  textoVolver = 'Volver', icono = 'x', cargando = false, onConfirmar, onCerrar,
}) {
  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === 'Escape' && !cargando) onCerrar()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [cargando, onCerrar])

  return (
    <div
      role="presentation"
      className="ventana-velo"
      onClick={cargando ? undefined : onCerrar}
      style={{
        position: 'fixed', inset: 0, background: 'oklch(20% 0.01 0 / 0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 20,
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        aria-describedby="confirmar-mensaje"
        onClick={(e) => e.stopPropagation()}
        className="card ventana-vidrio"
        style={{ width: 380, maxWidth: '100%', padding: 24, textAlign: 'center' }}
      >
        <span className="confirmar-icono" aria-hidden="true">
          <Icon name={icono} size={22} />
        </span>
        <div id="confirmar-titulo" style={{ fontSize: 18, fontWeight: 800, marginTop: 14 }}>{titulo}</div>
        <div id="confirmar-mensaje" style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 8 }}>
          {mensaje}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button type="button" className="btn btn-outline" onClick={onCerrar} disabled={cargando} style={{ flex: 1 }}>
            {textoVolver}
          </button>
          <button type="button" className="btn btn-peligro" onClick={onConfirmar} disabled={cargando} style={{ flex: 1 }} autoFocus>
            {cargando ? textoCargando : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
