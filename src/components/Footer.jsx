import { useState } from 'react'
import { Link } from 'react-router-dom'
import useIsMobile from '../hooks/useIsMobile.js'
import ContactoModal from './ContactoModal.jsx'
import PqrsModal from './PqrsModal.jsx'

// Pie de página de las vistas públicas (vitrina, perfil de negocio). Reusa el
// mismo logo e identidad del encabezado (ver ClientHome.jsx/ClientLayout.jsx)
// y la paleta oscura "--ink" que index.css ya reserva para banners (la usa
// también el sidebar del propietario y el header de NegocioDetalle.jsx).

const ENLACES_EXPLORAR = [
  { to: '/', label: 'Inicio' },
  { to: '/#resultados', label: 'Barberías recomendadas' },
]

// "Cómo funciona" y "Categorías" todavía no tienen página propia — en el
// header (ClientHome.jsx) aparecen igual de deshabilitadas con el mismo
// tooltip "Próximamente", así que aquí se muestran del mismo modo en vez de
// simular un enlace que no lleva a ningún lado.
const PROXIMAMENTE_EXPLORAR = ['Cómo funciona', 'Categorías']

const ENLACES_CUENTA = [
  { to: '/registro/cliente', label: 'Crear cuenta de cliente' },
  { to: '/registro/negocio', label: 'Registra tu negocio' },
  { to: '/login', label: 'Iniciar sesión' },
]

// "Atención al cliente" y "PQRS" abren formularios que llegan por correo (ver
// emailjs.js) — el correo del proyecto no se muestra en ninguna parte.
const ESTILO_BOTON_AYUDA = {
  fontSize: 13.5, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'left',
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
}

export default function Footer() {
  const isMobile = useIsMobile()
  const anio = new Date().getFullYear()
  const [formularioAbierto, setFormularioAbierto] = useState(null) // null | 'contacto' | 'pqrs'

  return (
    <footer>
      {/* Banner: invitación a propietarios, con la paleta oscura reservada
          para esto en index.css (--ink/--ink-2/--ink-text). */}
      <div style={{ background: 'var(--ink)', color: 'var(--ink-text)' }}>
        <div
          style={{
            maxWidth: 1160, margin: '0 auto', padding: isMobile ? '28px 16px' : '34px 32px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800 }}>¿Tienes una barbería en Britalia?</div>
            <div style={{ fontSize: 13.5, opacity: 0.75, marginTop: 4 }}>
              Únete gratis y muestra tu portafolio a los clientes del barrio.
            </div>
          </div>
          <Link to="/registro/negocio" className="btn btn-primary" style={{ flexShrink: 0 }}>
            Registra tu negocio
          </Link>
        </div>
      </div>

      {/* Pie de página: logo, navegación y derechos. */}
      <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            maxWidth: 1160, margin: '0 auto', padding: isMobile ? '32px 16px 24px' : '40px 32px 28px',
            display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'space-between',
          }}
        >
          <div style={{ flex: '1 1 220px', maxWidth: 280 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 18, fontWeight: 800 }}>
              <span
                style={{
                  width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0,
                }}
              >
                MB
              </span>
              <span>
                <span style={{ color: 'var(--text)' }}>Mini</span><span style={{ color: 'var(--accent)' }}>Barrio</span>
              </span>
            </Link>
            <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 10, lineHeight: 1.6 }}>
              La vitrina digital de los microcomercios de Britalia, Kennedy.
            </p>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--text-faint)' }}>
              Explorar
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {ENLACES_EXPLORAR.map((e) => (
                <Link key={e.label} to={e.to} style={{ fontSize: 13.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {e.label}
                </Link>
              ))}
              {PROXIMAMENTE_EXPLORAR.map((label) => (
                <span
                  key={label}
                  title="Próximamente"
                  style={{ fontSize: 13.5, color: 'var(--text-faint)', fontWeight: 600, cursor: 'not-allowed' }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--text-faint)' }}>
              Cuenta
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {ENLACES_CUENTA.map((e) => (
                <Link key={e.label} to={e.to} style={{ fontSize: 13.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {e.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--text-faint)' }}>
              Ayuda
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, maxWidth: 200 }}>
              <button type="button" onClick={() => setFormularioAbierto('contacto')} style={ESTILO_BOTON_AYUDA}>
                Atención al cliente
              </button>
              <button type="button" onClick={() => setFormularioAbierto('pqrs')} style={ESTILO_BOTON_AYUDA}>
                PQRS
              </button>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div
            style={{
              maxWidth: 1160, margin: '0 auto', padding: isMobile ? '14px 16px' : '16px 32px',
              fontSize: 11.5, color: 'var(--text-faint)', textAlign: isMobile ? 'left' : 'center',
            }}
          >
            © {anio} MiniBarrio. Todos los derechos reservados.
          </div>
        </div>
      </div>

      {formularioAbierto === 'contacto' && <ContactoModal onClose={() => setFormularioAbierto(null)} />}
      {formularioAbierto === 'pqrs' && <PqrsModal onClose={() => setFormularioAbierto(null)} />}
    </footer>
  )
}
