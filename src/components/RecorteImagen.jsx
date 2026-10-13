import { useRef, useState } from 'react'
import { exportarRecorte, limitesDesplazamiento, escalaCubrir } from '../imagenes.js'

// Recorte de una imagen recién elegida (logo o portada, ver OwnerIdentidad.jsx):
// se arrastra para encuadrar y el control deslizante hace zoom. Lo que se ve
// dentro del marco es exactamente lo que se guarda. Con forma="circulo" el
// marco se oscurece por fuera del círculo, como se verá en el pin del mapa.

const limitar = (v, max) => Math.max(-max, Math.min(max, v))

export default function RecorteImagen({ imagen, ancho, alto, forma = 'rectangulo', salida, guardando, onGuardar, onCancelar }) {
  const { img, url } = imagen
  const [zoom, setZoom] = useState(1)
  const [desplazamiento, setDesplazamiento] = useState({ dx: 0, dy: 0 })
  const arrastre = useRef(null)

  const escala = escalaCubrir(img, ancho, alto) * zoom
  const anchoImg = img.naturalWidth * escala
  const altoImg = img.naturalHeight * escala

  function moverA(dx, dy, z = zoom) {
    const lim = limitesDesplazamiento(img, ancho, alto, z)
    setDesplazamiento({ dx: limitar(dx, lim.x), dy: limitar(dy, lim.y) })
  }

  function alPresionar(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    arrastre.current = { x: e.clientX, y: e.clientY, ...desplazamiento }
  }
  function alMover(e) {
    if (!arrastre.current) return
    moverA(arrastre.current.dx + e.clientX - arrastre.current.x, arrastre.current.dy + e.clientY - arrastre.current.y)
  }
  function alSoltar() {
    arrastre.current = null
  }

  function cambiarZoom(valor) {
    setZoom(valor)
    // Al alejar, el encuadre puede quedar fuera de límites: se reajusta.
    moverA(desplazamiento.dx, desplazamiento.dy, valor)
  }

  function guardar() {
    onGuardar(exportarRecorte(img, { ancho, alto, zoom, ...desplazamiento }, salida))
  }

  return (
    <div>
      <div
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        style={{
          position: 'relative', width: ancho, height: alto, maxWidth: '100%', overflow: 'hidden',
          borderRadius: forma === 'circulo' ? 'var(--radius-md)' : 'var(--radius-md)',
          background: 'var(--surface-2)', cursor: 'grab', touchAction: 'none', userSelect: 'none',
        }}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            position: 'absolute', maxWidth: 'none', pointerEvents: 'none',
            width: anchoImg, height: altoImg,
            left: (ancho - anchoImg) / 2 + desplazamiento.dx,
            top: (alto - altoImg) / 2 + desplazamiento.dy,
          }}
        />
        {forma === 'circulo' && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 6, borderRadius: '50%', pointerEvents: 'none',
              boxShadow: '0 0 0 999px oklch(15% 0.01 50 / 0.55)', border: '2px dashed #fff',
            }}
          />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, maxWidth: ancho }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Zoom</span>
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          onChange={(e) => cambiarZoom(Number(e.target.value))}
          aria-label="Zoom de la imagen"
          style={{ flex: 1, accentColor: 'var(--accent)', padding: 0, border: 'none', boxShadow: 'none' }}
        />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>Arrastra la imagen para encuadrarla.</div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={guardando} style={{ padding: '9px 16px', fontSize: 13.5 }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancelar} disabled={guardando} style={{ padding: '9px 16px', fontSize: 13.5 }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
