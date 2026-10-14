import { useState } from 'react'

// Foto de un negocio en sus tarjetas ("Recomendado para ti" en ClientHome.jsx
// y "Favoritos" del panel del cliente): la miniatura de su foto principal o,
// si no hay, la primera foto antigua por enlace, con el logo en la esquina.
// Sin fotos, el logo al centro; sin ninguno de los dos, sus iniciales sobre
// un fondo de color — nunca un recuadro gris vacío. El estado (abierto /
// cerrado, ver horarios.js) va encima. Estilos .tarjeta-negocio__* en
// index.css.

export const ESTADO_APERTURA = {
  abierto: { label: 'Abierto', bg: 'var(--sage-soft)', text: 'var(--sage-text)' },
  'cierra-pronto': { label: 'Cierra pronto', bg: 'var(--warning-soft)', text: 'var(--warning-text)' },
  cerrado: { label: 'Cerrado', bg: 'var(--surface-2)', text: 'var(--text-faint)' },
}

export function inicialesDe(nombre) {
  if (!nombre) return '?'
  const partes = nombre.trim().split(/\s+/)
  return partes.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}

export default function FotoNegocio({ negocio, estado, alto = 130, minAlto }) {
  const [fallo, setFallo] = useState(false)
  const foto = !fallo && (negocio.miniatura || negocio.fotos?.[0])
  const insignia = estado && ESTADO_APERTURA[estado]
  return (
    <div className="tarjeta-negocio__foto" style={{ height: alto, minHeight: minAlto }}>
      {foto ? (
        <img src={foto} alt="" loading="lazy" onError={() => setFallo(true)} />
      ) : negocio.logo ? (
        <img src={negocio.logo} alt="" className="tarjeta-negocio__logo-centro" />
      ) : (
        <span className="tarjeta-negocio__iniciales">{inicialesDe(negocio.nombre)}</span>
      )}
      {foto && negocio.logo && <img src={negocio.logo} alt="" className="tarjeta-negocio__logo" />}
      {insignia && (
        <span className="tarjeta-negocio__estado" style={{ background: insignia.bg, color: insignia.text }}>
          ● {insignia.label}
        </span>
      )}
    </div>
  )
}
