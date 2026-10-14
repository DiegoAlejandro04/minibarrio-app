import useIsMobile from '../hooks/useIsMobile.js'

// "Cómo funciona" de la vitrina (ClientHome.jsx): el recorrido del cliente en
// cuatro pasos, cada uno con una ilustración propia en SVG (no íconos de
// línea: estos cuentan el paso en miniatura). Estilo plano a propósito:
// colores sólidos, sin degradados, sin brillos ni resplandor detrás — con
// esos efectos se veían como ilustraciones genéricas "de IA". Estáticas.
// Los colores son fijos (no tokens del tema) porque son objetos con color
// propio — un mapa, una foto, un calendario — y se ven bien igual sobre el
// fondo claro y sobre el verde noche.

const PASOS = [
  { titulo: 'Regístrate o inicia sesión', detalle: 'Crea tu cuenta gratis en un minuto, con tu correo o con Google.', Ilustracion: IlustracionCuenta },
  { titulo: 'Busca', detalle: 'Por servicio, presupuesto o cercanía en el mapa.', Ilustracion: IlustracionBusca },
  { titulo: 'Compara', detalle: 'Precios reales, fotos de trabajos y reseñas.', Ilustracion: IlustracionCompara },
  { titulo: 'Reserva', detalle: 'Elige un turno libre y recibe tu comprobante.', Ilustracion: IlustracionReserva },
]

export default function ComoFunciona() {
  const isMobile = useIsMobile()
  return (
    <section id="como-funciona" style={{ maxWidth: 1224, margin: '0 auto', padding: isMobile ? '44px 16px' : '72px 32px' }}>
      <div className="seccion-kicker">Cómo funciona</div>
      <h2 className="seccion-titulo">Tu próxima cita, en cuatro pasos</h2>
      <p className="seccion-subtitulo">Sin llamadas ni filas, desde tu celular o tu computador.</p>

      <div
        style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))',
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

// Paleta plana compartida por las tres ilustraciones. Las piezas crema llevan
// un borde arena fino: sin él se perdían sobre el fondo crema del modo claro.
const C = {
  verdeOscuro: '#2F5A47',
  verdeCalle: '#3E6E58',
  verdeParque: '#5C9B76',
  verdeManzana: '#24463A',
  naranja: '#E8833A',
  terracota: '#C8693A',
  crema: '#FDF6EE',
  arena: '#E6DACB',
  arenaOscura: '#D2C3B1',
  piel: '#F1C9A5',
  verdeOk: '#2F7A55',
  blanco: '#FFFFFF',
}

function IlustracionBusca() {
  return (
    <svg viewBox="0 0 132 112" style={tamanoIlustracion} role="img" aria-label="Mapa del barrio con un pin y una lupa">
      <g transform="rotate(-6 62 64)">
        <rect x="18" y="34" width="86" height="62" rx="12" fill={C.verdeOscuro} />
        <rect x="18" y="60" width="86" height="8" fill={C.verdeCalle} />
        <rect x="50" y="34" width="8" height="62" fill={C.verdeCalle} />
        <rect x="27" y="41" width="17" height="13" rx="3" fill={C.verdeParque} />
        <rect x="65" y="74" width="28" height="14" rx="3" fill={C.verdeParque} />
        <rect x="65" y="41" width="14" height="12" rx="2" fill={C.verdeManzana} />
        <rect x="27" y="74" width="16" height="13" rx="2" fill={C.verdeManzana} />
      </g>
      <path d="M60 18c-9 0-16 7-16 16 0 12 16 27 16 27s16-15 16-27c0-9-7-16-16-16z" fill={C.naranja} />
      <circle cx="60" cy="34" r="6.5" fill={C.crema} />
      <circle cx="95" cy="73" r="15" fill={C.crema} stroke={C.arena} strokeWidth="1.5" />
      <circle cx="95" cy="73" r="10" fill="#CFE3D8" />
      <rect x="105" y="84" width="9" height="20" rx="4.5" transform="rotate(-45 109.5 94)" fill={C.terracota} />
    </svg>
  )
}

function IlustracionCompara() {
  return (
    <svg viewBox="0 0 132 112" style={tamanoIlustracion} role="img" aria-label="Tarjetas de fotos con estrellas y precio">
      <g transform="rotate(-11 48 60)">
        <rect x="20" y="24" width="56" height="70" rx="10" fill={C.verdeOscuro} />
        <rect x="27" y="31" width="42" height="32" rx="6" fill={C.verdeCalle} />
      </g>
      <g transform="rotate(6 78 60)">
        <rect x="48" y="18" width="62" height="80" rx="11" fill={C.crema} stroke={C.arena} strokeWidth="1.5" />
        <rect x="55" y="25" width="48" height="38" rx="7" fill={C.terracota} />
        <circle cx="79" cy="39" r="8" fill={C.piel} />
        <path d="M66 63c2-9 7-13 13-13s11 4 13 13z" fill={C.piel} />
        <g fill={C.naranja}>
          <circle cx="59" cy="73" r="3.3" /><circle cx="68" cy="73" r="3.3" /><circle cx="77" cy="73" r="3.3" />
          <circle cx="86" cy="73" r="3.3" />
        </g>
        <circle cx="95" cy="73" r="3.3" fill={C.arenaOscura} />
        <rect x="56" y="83" width="30" height="5" rx="2.5" fill={C.arena} />
      </g>
      <g transform="rotate(-8 104 89)">
        <rect x="86" y="80" width="36" height="19" rx="9.5" fill={C.verdeOk} />
        <text x="104" y="93.5" textAnchor="middle" fontSize="10" fontWeight="800" fill={C.blanco} fontFamily="inherit">$15k</text>
      </g>
    </svg>
  )
}

function IlustracionReserva() {
  return (
    <svg viewBox="0 0 132 112" style={tamanoIlustracion} role="img" aria-label="Calendario con el día elegido y un check">
      <g transform="rotate(-5 62 62)">
        <rect x="26" y="24" width="72" height="72" rx="12" fill={C.crema} stroke={C.arena} strokeWidth="1.5" />
        <path d="M26 36a12 12 0 0 1 12-12h48a12 12 0 0 1 12 12v9H26z" fill={C.naranja} />
        <rect x="41" y="16" width="7" height="15" rx="3.5" fill={C.verdeOscuro} />
        <rect x="76" y="16" width="7" height="15" rx="3.5" fill={C.verdeOscuro} />
        <g fill={C.arena}>
          <rect x="35" y="53" width="10" height="9" rx="2" /><rect x="50" y="53" width="10" height="9" rx="2" />
          <rect x="65" y="53" width="10" height="9" rx="2" /><rect x="80" y="53" width="10" height="9" rx="2" />
          <rect x="35" y="67" width="10" height="9" rx="2" /><rect x="65" y="67" width="10" height="9" rx="2" />
          <rect x="80" y="67" width="10" height="9" rx="2" />
          <rect x="35" y="81" width="10" height="9" rx="2" /><rect x="50" y="81" width="10" height="9" rx="2" />
        </g>
        <rect x="50" y="67" width="10" height="9" rx="2" fill={C.naranja} />
      </g>
      <circle cx="98" cy="80" r="18" fill={C.verdeOk} />
      <path d="M90 80l5.5 5.5L107 74" stroke={C.blanco} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IlustracionCuenta() {
  return (
    <svg viewBox="0 0 132 112" style={tamanoIlustracion} role="img" aria-label="Celular con el formulario de cuenta y un candado">
      <g transform="rotate(-7 60 58)">
        <rect x="34" y="10" width="52" height="92" rx="11" fill={C.verdeOscuro} />
        <rect x="39" y="18" width="42" height="76" rx="7" fill={C.crema} stroke={C.arena} strokeWidth="1.5" />
        <circle cx="60" cy="37" r="10" fill={C.terracota} />
        <circle cx="60" cy="34" r="4" fill={C.piel} />
        <path d="M52.5 44.5c1.6-4.3 4.3-6.2 7.5-6.2s5.9 1.9 7.5 6.2a10 10 0 0 1-15 0z" fill={C.piel} />
        <rect x="45" y="54" width="30" height="6" rx="3" fill={C.arena} />
        <rect x="45" y="64" width="30" height="6" rx="3" fill={C.arena} />
        <rect x="45" y="76" width="30" height="9" rx="4.5" fill={C.naranja} />
      </g>
      <circle cx="98" cy="78" r="18" fill={C.verdeOk} />
      <path d="M92 76v-4a6 6 0 0 1 12 0v4" stroke={C.blanco} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <rect x="89" y="75" width="18" height="13" rx="3.5" fill={C.blanco} />
      <circle cx="98" cy="81.5" r="2.2" fill={C.verdeOk} />
    </svg>
  )
}
