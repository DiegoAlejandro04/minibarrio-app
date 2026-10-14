import Icon from './Icon.jsx'

// Paginador "tipo Google" con un peine de barbero encima: cada diente es una
// página y el de la página actual se alarga y se pinta naranja (como las "o"
// de "Gooooogle"). Estilos .peine-* en index.css.
//
// Como Google, muestra a lo sumo `visibles` números (10; en celular menos,
// para que quepan): con 10, la página actual queda en la sexta posición y la
// ventana se corre con ella (5 6 7 … 14 en la página 10), sin pasarse del
// principio ni del final. "Anterior" y "Siguiente" solo aparecen cuando hay
// hacia dónde ir.

/** Páginas a mostrar alrededor de la actual (de 1 a total). */
export function ventanaDePaginas(actual, total, visibles = 10) {
  const posicionActual = Math.floor(visibles / 2) + 1
  let inicio = Math.max(1, actual - (posicionActual - 1))
  const fin = Math.min(total, inicio + visibles - 1)
  inicio = Math.max(1, fin - visibles + 1)
  return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i)
}

export default function PaginadorPeine({ pagina, total, onCambiar, visibles = 10 }) {
  if (total <= 1) return null
  const paginas = ventanaDePaginas(pagina, total, visibles)

  return (
    <nav className="peine" aria-label="Páginas del historial">
      {pagina > 1 ? (
        <button type="button" className="peine-flecha" onClick={() => onCambiar(pagina - 1)}>
          <Icon name="chevronLeft" size={20} />
          <span>Anterior</span>
        </button>
      ) : <span className="peine-flecha peine-flecha--vacia" aria-hidden="true" />}

      <div className="peine-cuerpo">
        {/* Base del peine; los dientes cuelgan de ella, uno por página. */}
        <div className="peine-lomo" aria-hidden="true" />
        <div className="peine-dientes">
          {/* Dientes pequeños de relleno entre los de cada página. */}
          <div className="peine-relleno" aria-hidden="true" />
          {paginas.map((p) => (
            <button
              key={p}
              type="button"
              className={`peine-pagina${p === pagina ? ' actual' : ''}`}
              onClick={() => p !== pagina && onCambiar(p)}
              aria-label={`Página ${p}`}
              aria-current={p === pagina ? 'page' : undefined}
            >
              <span className="peine-diente" aria-hidden="true" />
              <span className="peine-numero">{p}</span>
            </button>
          ))}
        </div>
      </div>

      {pagina < total ? (
        <button type="button" className="peine-flecha" onClick={() => onCambiar(pagina + 1)}>
          <Icon name="chevronRight" size={20} />
          <span>Siguiente</span>
        </button>
      ) : <span className="peine-flecha peine-flecha--vacia" aria-hidden="true" />}
    </nav>
  )
}
