import useIsMobile from '../hooks/useIsMobile.js'

// "Cómo funciona" de la vitrina (ClientHome.jsx): el recorrido del cliente en
// tres pasos, cada uno con una ilustración propia en SVG (no íconos de
// línea: estos cuentan el paso en miniatura). Estáticas a propósito. Los
// colores de las ilustraciones son fijos (no tokens del tema) porque son
// objetos con color propio — un mapa, una foto, un calendario — y se ven
// bien igual sobre el fondo claro y sobre el verde noche.

const PASOS = [
  { titulo: 'Busca', detalle: 'Por servicio, presupuesto o cercanía en el mapa.', Ilustracion: IlustracionBusca },
  { titulo: 'Compara', detalle: 'Precios reales, fotos de trabajos y reseñas.', Ilustracion: IlustracionCompara },
  { titulo: 'Reserva', detalle: 'Elige un turno libre y recibe tu comprobante.', Ilustracion: IlustracionReserva },
]

export default function ComoFunciona() {
  const isMobile = useIsMobile()
  return (
    <section id="como-funciona" style={{ maxWidth: 1224, margin: '0 auto', padding: isMobile ? '44px 16px' : '72px 32px' }}>
      <div className="seccion-kicker">Cómo funciona</div>
      <h2 className="seccion-titulo">Tu próxima cita, en tres pasos</h2>
      <p className="seccion-subtitulo">Sin llamadas ni filas, desde tu celular o tu computador.</p>

      <div
        style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
          gap: isMobile ? 32 : 24, marginTop: isMobile ? 28 : 40,
        }}
      >
        {PASOS.map(({ titulo, detalle, Ilustracion }, i) => (
          <div key={titulo} style={{ textAlign: 'center', maxWidth: 300, margin: '0 auto' }}>
            <Ilustracion />
            <span className="paso-etiqueta">Paso {i + 1}</span>
            <div style={{ fontSize: 17, fontWeight: 800, marginTop: 6 }}>{titulo}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 6 }}>{detalle}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

const tamanoIlustracion = { width: 168, height: 142, display: 'block', margin: '0 auto 14px' }

function IlustracionBusca() {
  return (
    <svg viewBox="0 0 132 112" style={tamanoIlustracion} role="img" aria-label="Mapa del barrio con un pin y una lupa">
      <defs>
        <radialGradient id="cf-brillo-1" cx="50%" cy="55%" r="55%">
          <stop offset="0" stopColor="oklch(72% .16 48)" stopOpacity=".26" />
          <stop offset="1" stopColor="oklch(72% .16 48)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cf-mapa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(34% .05 165)" />
          <stop offset="1" stopColor="oklch(25% .035 168)" />
        </linearGradient>
        <linearGradient id="cf-pin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(80% .15 55)" />
          <stop offset="1" stopColor="oklch(64% .17 42)" />
        </linearGradient>
      </defs>
      <ellipse cx="66" cy="62" rx="62" ry="46" fill="url(#cf-brillo-1)" />
      <g transform="rotate(-8 60 64)">
        <rect x="22" y="34" width="78" height="58" rx="12" fill="url(#cf-mapa)" stroke="oklch(45% .05 165)" />
        <rect x="22" y="58" width="78" height="7" fill="oklch(40% .04 168)" />
        <rect x="52" y="34" width="7" height="58" fill="oklch(40% .04 168)" />
        <rect x="30" y="40" width="16" height="12" rx="3" fill="oklch(48% .09 152)" />
        <rect x="66" y="71" width="24" height="14" rx="3" fill="oklch(48% .09 152)" />
        <rect x="66" y="40" width="12" height="10" rx="2" fill="oklch(32% .03 168)" />
        <rect x="30" y="72" width="14" height="12" rx="2" fill="oklch(32% .03 168)" />
      </g>
      <path d="M62 22c-9 0-16 7-16 16 0 12 16 26 16 26s16-14 16-26c0-9-7-16-16-16z" fill="url(#cf-pin)" />
      <circle cx="62" cy="38" r="6" fill="#fff" />
      <ellipse cx="57" cy="29" rx="4" ry="2.5" fill="#fff" opacity=".35" />
      <circle cx="94" cy="74" r="15" fill="oklch(85% .03 200 / .18)" stroke="#fff" strokeWidth="4" />
      <path d="M88 69a8 8 0 0 1 7-4" stroke="#fff" strokeWidth="2" fill="none" opacity=".6" strokeLinecap="round" />
      <rect x="104" y="84" width="8" height="20" rx="4" transform="rotate(-45 108 94)" fill="oklch(78% .15 50)" />
    </svg>
  )
}

function IlustracionCompara() {
  return (
    <svg viewBox="0 0 132 112" style={tamanoIlustracion} role="img" aria-label="Tarjetas de fotos con estrellas y precio">
      <defs>
        <radialGradient id="cf-brillo-2" cx="50%" cy="55%" r="55%">
          <stop offset="0" stopColor="oklch(70% .12 170)" stopOpacity=".24" />
          <stop offset="1" stopColor="oklch(70% .12 170)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cf-foto-frente" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(62% .12 52)" />
          <stop offset="1" stopColor="oklch(42% .08 40)" />
        </linearGradient>
        <linearGradient id="cf-foto-atras" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(50% .07 170)" />
          <stop offset="1" stopColor="oklch(32% .04 170)" />
        </linearGradient>
      </defs>
      <ellipse cx="66" cy="62" rx="62" ry="46" fill="url(#cf-brillo-2)" />
      <g transform="rotate(-12 50 60)">
        <rect x="24" y="24" width="56" height="70" rx="10" fill="oklch(28% .03 168)" stroke="oklch(40% .04 168)" />
        <rect x="30" y="30" width="44" height="34" rx="6" fill="url(#cf-foto-atras)" />
      </g>
      <g transform="rotate(7 76 60)">
        <rect x="48" y="20" width="62" height="78" rx="11" fill="oklch(96% .01 80)" stroke="oklch(88% .015 80)" />
        <rect x="54" y="26" width="50" height="38" rx="7" fill="url(#cf-foto-frente)" />
        <circle cx="79" cy="40" r="8" fill="oklch(85% .05 60)" />
        <path d="M66 64c2-9 8-13 13-13s11 4 13 13z" fill="oklch(85% .05 60)" />
        <g fill="oklch(72% .16 48)">
          <circle cx="58" cy="74" r="3.2" /><circle cx="67" cy="74" r="3.2" /><circle cx="76" cy="74" r="3.2" />
          <circle cx="85" cy="74" r="3.2" /><circle cx="94" cy="74" r="3.2" opacity=".35" />
        </g>
        <rect x="55" y="83" width="30" height="5" rx="2.5" fill="oklch(80% .01 80)" />
      </g>
      <g transform="rotate(-10 104 88)">
        <rect x="88" y="80" width="34" height="18" rx="9" fill="oklch(48% .1 152)" />
        <text x="105" y="93" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="inherit">$15k</text>
      </g>
    </svg>
  )
}

function IlustracionReserva() {
  return (
    <svg viewBox="0 0 132 112" style={tamanoIlustracion} role="img" aria-label="Calendario con el día elegido y un check">
      <defs>
        <radialGradient id="cf-brillo-3" cx="50%" cy="55%" r="55%">
          <stop offset="0" stopColor="oklch(72% .16 48)" stopOpacity=".32" />
          <stop offset="1" stopColor="oklch(72% .16 48)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cf-calendario" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(80% .15 55)" />
          <stop offset="1" stopColor="oklch(66% .17 44)" />
        </linearGradient>
        <linearGradient id="cf-check" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(76% .15 150)" />
          <stop offset="1" stopColor="oklch(56% .13 155)" />
        </linearGradient>
      </defs>
      <ellipse cx="66" cy="62" rx="62" ry="46" fill="url(#cf-brillo-3)" />
      <g transform="rotate(-6 62 62)">
        <rect x="28" y="24" width="68" height="70" rx="12" fill="oklch(96% .01 80)" stroke="oklch(88% .015 80)" />
        <path d="M28 36a12 12 0 0 1 12-12h44a12 12 0 0 1 12 12v8H28z" fill="url(#cf-calendario)" />
        <rect x="42" y="17" width="6" height="14" rx="3" fill="oklch(45% .03 168)" />
        <rect x="76" y="17" width="6" height="14" rx="3" fill="oklch(45% .03 168)" />
        <g fill="oklch(82% .01 80)">
          <rect x="36" y="52" width="9" height="8" rx="2" /><rect x="50" y="52" width="9" height="8" rx="2" />
          <rect x="64" y="52" width="9" height="8" rx="2" /><rect x="78" y="52" width="9" height="8" rx="2" />
          <rect x="36" y="65" width="9" height="8" rx="2" /><rect x="64" y="65" width="9" height="8" rx="2" />
          <rect x="78" y="65" width="9" height="8" rx="2" />
          <rect x="36" y="78" width="9" height="8" rx="2" /><rect x="50" y="78" width="9" height="8" rx="2" />
        </g>
        <rect x="49" y="64" width="11" height="10" rx="3" fill="oklch(72% .16 48)" />
      </g>
      <circle cx="98" cy="80" r="17" fill="url(#cf-check)" stroke="var(--bg)" strokeWidth="4" />
      <path d="M90 80l5.5 5.5L107 74" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M108 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="oklch(85% .12 70)" />
      <circle cx="22" cy="40" r="2.2" fill="oklch(85% .12 70)" />
    </svg>
  )
}
