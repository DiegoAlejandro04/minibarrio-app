import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { formatoHora12 } from '../horarios.js'

// Selector de hora con el estilo de la app (en vez del <input type="time"> del
// navegador, que se ve distinto en cada uno y no respeta los saltos de 20
// minutos de los turnos). Un botón con la hora; al tocarlo se despliega una
// tarjeta con las horas posibles agrupadas en mañana, tarde y noche. Se
// cierra al elegir, al tocar fuera o con Escape. Estilos .selector-hora* en
// index.css. Se usa en el horario de cada persona del equipo
// (OwnerEquipo.jsx).

const GRUPOS = [
  { titulo: 'Mañana', desde: '00:00', hasta: '12:00' },
  { titulo: 'Tarde', desde: '12:00', hasta: '18:00' },
  { titulo: 'Noche', desde: '18:00', hasta: '24:00' },
]

export default function SelectorHora({ valor, opciones, onCambiar, etiqueta, compacto = false }) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef(null)
  const panel = useRef(null)
  // Si la hora guardada no está entre las opciones (p. ej. el negocio cambió
  // su horario), igual se muestra para poder verla y cambiarla.
  const lista = opciones.includes(valor) || !valor ? opciones : [...opciones, valor].sort()

  useEffect(() => {
    if (!abierto) return undefined
    const alTocar = (e) => { if (!raiz.current?.contains(e.target)) setAbierto(false) }
    const alTeclear = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('pointerdown', alTocar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alTocar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  // Al abrir, la hora elegida queda a la vista dentro de la lista.
  useLayoutEffect(() => {
    if (!abierto) return
    const elegida = panel.current?.querySelector('.on')
    if (elegida) panel.current.scrollTop = elegida.offsetTop - panel.current.clientHeight / 2 + elegida.clientHeight / 2
  }, [abierto])

  return (
    <div className={`selector-hora${compacto ? ' compacto' : ''}`} ref={raiz}>
      <button
        type="button"
        className={`selector-hora__boton${abierto ? ' abierto' : ''}`}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={etiqueta ? `${etiqueta}: ${valor ? formatoHora12(valor) : 'sin elegir'}` : undefined}
      >
        <Icon name="clock" size={15} />
        <span>{valor ? formatoHora12(valor) : 'Elegir'}</span>
        <svg className="selector-hora__flecha" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <div className="selector-hora__panel" ref={panel} role="listbox" aria-label={etiqueta}>
          {lista.length === 0 && <div className="selector-hora__vacio">No hay horas disponibles.</div>}
          {GRUPOS.map((g) => {
            const horas = lista.filter((h) => h >= g.desde && h < g.hasta)
            if (horas.length === 0) return null
            return (
              <div key={g.titulo} className="selector-hora__grupo">
                <div className="selector-hora__titulo">{g.titulo}</div>
                <div className="selector-hora__horas">
                  {horas.map((h) => (
                    <button
                      key={h}
                      type="button"
                      role="option"
                      aria-selected={h === valor}
                      className={h === valor ? 'on' : ''}
                      onClick={() => { onCambiar(h); setAbierto(false) }}
                    >
                      {formatoHora12(h)}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
