import { memo } from 'react'
import { Link } from 'react-router-dom'
import useIsMobile from '../hooks/useIsMobile.js'

// "Lo que dicen los clientes" de la vitrina (ClientHome.jsx): reseñas reales
// recientes. Solo se muestra con MINIMO_RESENAS o más — una sección con una
// sola reseña se ve peor que no tenerla.
//
// Por privacidad no se muestra quién escribió cada reseña, solo el negocio y
// la fecha (el nombre corto sigue guardado, ver CalificarModal.jsx). La
// insignia "Verificada" solo va en
// las que se escribieron con una cita real ya pasada (citaId, comprobado por
// firestore.rules) — las anteriores a esa regla no la llevan.

export const MINIMO_RESENAS = 3
const TARJETAS_POR_VUELTA = 8

const FECHA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })

// Memorizado (memo): abrir el menú ☰ de la página principal la vuelve a
// dibujar entera; con memo esta sección se salta si sus datos no cambiaron.
export default memo(function ResenasRecientes({ resenas, nombresNegocios }) {
  const isMobile = useIsMobile()
  if (resenas.length < MINIMO_RESENAS) return null

  // Cada mitad del carrusel necesita ser más ancha que la pantalla, o al
  // final de cada vuelta se vería un hueco vacío: con pocas reseñas, se
  // repiten hasta tener TARJETAS_POR_VUELTA (8 × 342px ≈ 2700px, más que
  // cualquier pantalla común).
  const vuelta = []
  while (vuelta.length < TARJETAS_POR_VUELTA) vuelta.push(...resenas)

  const tarjeta = (r, i, copia) => (
    <Link
      key={`${copia ? 'b' : 'a'}-${i}-${r.id}`}
      to={`/negocio/${r.negocioId}`}
      className="resena-tarjeta"
      // La segunda copia solo existe para que el carrusel dé la vuelta sin
      // saltos: los lectores de pantalla y el teclado no la recorren.
      aria-hidden={copia || undefined}
      tabIndex={copia ? -1 : undefined}
    >
      <span className="resena-comilla" aria-hidden="true">“</span>
      <div className="resena-estrellas" aria-label={`${r.calificacion} de 5 estrellas`}>
        {'★'.repeat(r.calificacion)}<span style={{ opacity: 0.3 }}>{'★'.repeat(5 - r.calificacion)}</span>
      </div>
      <p className="resena-texto">{r.comentario}</p>
      <div className="resena-pie" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{nombresNegocios[r.negocioId] || 'Barbería'}</div>
          {r.fecha && (
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{FECHA.format(r.fecha)}</div>
          )}
        </div>
        {r.verificada && <span className="resena-verificada">✓ Verificada</span>}
      </div>
    </Link>
  )

  return (
    <section className="banda-resenas">
      <div style={{ maxWidth: 1224, margin: '0 auto', padding: isMobile ? '44px 16px 0' : '64px 32px 0' }}>
        <div className="seccion-kicker">Reseñas</div>
        <h2 className="seccion-titulo">Lo que dicen los clientes del barrio</h2>
        <p className="seccion-subtitulo">Opiniones recientes de clientes de MiniBarrio.</p>
      </div>

      {/* Carrusel a todo el ancho: se desliza solo, despacio, y se detiene al
          pasar el mouse o tocarlo (ver .carrusel-resenas en index.css). La
          lista va dos veces seguidas para que la vuelta sea continua. */}
      <div className="carrusel-resenas" style={{ marginTop: isMobile ? 28 : 40, paddingBottom: isMobile ? 44 : 64 }}>
        <div className="carrusel-resenas__pista" style={{ animationDuration: `${vuelta.length * 7}s` }}>
          {/* Las repeticiones de relleno (más allá de la primera aparición de
              cada reseña) también se marcan como copia. */}
          {vuelta.map((r, i) => tarjeta(r, i, i >= resenas.length))}
          {vuelta.map((r, i) => tarjeta(r, i, true))}
        </div>
      </div>
    </section>
  )
})
