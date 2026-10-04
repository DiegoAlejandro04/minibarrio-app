// Pantalla de carga a página completa, con el mismo lockup de marca que los
// headers (badge "MB" + MiniBarrio) en vez de un simple texto "Cargando…".
//
// Dos usos, con la animación prendida o apagada a propósito:
// - El splash de TRANSICIÓN (App.jsx: al arrancar con sesión iniciada, o al
//   navegar a ciertas pantallas, ver muestraSplash) es un overlay que se
//   queda encima el tiempo justo para que su animación de salto termine —
//   ahí `animar` va en true. Se usa una sola vez por transición, así que
//   siempre puede volver a saltar sin que se vea repetido.
// - El splash de RESPALDO de cada página (ClientLayout.jsx, OwnerLayout.jsx,
//   NegocioDetalle.jsx) es lo que se ve solo si esa página en particular
//   tarda más de la cuenta en traer sus datos — normalmente queda tapado
//   por el overlay de arriba y nunca llega a verse. Ahí `animar` va en
//   false: si llega a aparecer, aparece ya asentado, sin saltar de nuevo
//   encima de la animación que ya se vio un instante antes.
export default function Splash({ animar = true }) {
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
