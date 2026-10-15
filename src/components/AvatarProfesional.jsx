import { colorProfesional, inicialesProfesional } from '../equipo.js'

// Foto de una persona del equipo en círculo o, si no tiene, sus iniciales
// sobre su color (siempre el mismo para el mismo nombre, ver equipo.js).
// Se usa en el panel (Equipo, Agenda) y al reservar (NegocioDetalle.jsx).
export default function AvatarProfesional({ profesional, tamano = 40, anillo = false }) {
  const estilo = {
    width: tamano,
    height: tamano,
    borderRadius: '50%',
    flexShrink: 0,
    boxShadow: anillo ? '0 0 0 2px var(--surface), 0 0 0 4px var(--accent)' : undefined,
  }
  if (profesional?.foto) {
    return <img src={profesional.foto} alt="" style={{ ...estilo, objectFit: 'cover', display: 'block' }} />
  }
  return (
    <span
      aria-hidden="true"
      style={{
        ...estilo,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colorProfesional(profesional?.nombre),
        color: '#fff',
        fontWeight: 800,
        fontSize: Math.round(tamano * 0.36),
        letterSpacing: '.02em',
      }}
    >
      {inicialesProfesional(profesional?.nombre)}
    </span>
  )
}
