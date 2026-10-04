import { useLayoutEffect, useRef } from 'react'

// Pantalla de carga a página completa, con el mismo lockup de marca que los
// headers (badge "MB" + MiniBarrio) en vez de un simple texto "Cargando…".
// Se usa en cualquier punto donde todavía no hay nada que mostrar: mientras
// se confirma la sesión (App.jsx) o mientras se trae el documento de
// Firestore que la página necesita para poder pintar algo (ClientLayout.jsx,
// OwnerLayout.jsx, NegocioDetalle.jsx).
//
// Dentro de una misma carga de página puede haber más de un motivo para
// mostrarlo en secuencia (primero mientras se confirma la sesión, después
// mientras esa página en particular trae sus propios datos) — cada uno es un
// montaje nuevo del componente. Sin este flag, cada montaje repetiría el
// salto de entrada y se vería como si la animación "se repitiera dos veces".
// Se anima una sola vez por carga de página; los montajes siguientes
// aparecen ya asentados, sin saltar de nuevo.
//
// La escritura de este flag va en un efecto, nunca directo en el render: in
// React 18 con StrictMode (ver main.jsx) cada montaje se renderiza dos veces
// a propósito para detectar justo este tipo de mutación impura — mutar la
// variable ahí mismo hacía que la segunda pasada ya viera el cambio de la
// primera y la animación terminaba en `false` siempre, desde el primer splash.
let yaAnimo = false

export default function Splash() {
  const animar = useRef(!yaAnimo).current
  useLayoutEffect(() => {
    yaAnimo = true
  }, [])

  return (
    <div
      className={animar ? 'splash-arranque' : undefined}
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        background: 'var(--bg)', fontSize: 17, fontWeight: 800,
      }}
    >
      <span
        className={animar ? 'splash-pieza' : undefined}
        style={{
          width: 30, height: 30, borderRadius: 9, background: 'var(--accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
          animationDelay: '0ms',
        }}
      >
        MB
      </span>
      <span>
        <span
          className={animar ? 'splash-pieza' : undefined}
          style={{ display: 'inline-block', color: 'var(--text)', animationDelay: '110ms' }}
        >
          Mini
        </span>
        <span
          className={animar ? 'splash-pieza' : undefined}
          style={{ display: 'inline-block', color: 'var(--accent)', animationDelay: '220ms' }}
        >
          Barrio
        </span>
      </span>
    </div>
  )
}
