import Icon from './Icon.jsx'

// Medidor de seguridad de la contraseña al crear una cuenta (Acceso.jsx y
// RegisterBusiness.jsx): barra de fuerza y lista de requisitos que se marcan
// mientras se escribe. Cuando se cumplen todos, la lista se oculta y queda
// solo la barra en verde. Adaptado del "Create A Strong Password" de
// CodeByGaurav; estilos .fuerza-* en index.css.

const REQUISITOS = [
  { id: 'largo', texto: 'Mínimo 8 caracteres', cumple: (v) => v.length >= 8 },
  { id: 'mayuscula', texto: 'Una mayúscula (A-Z)', cumple: (v) => /[A-Z]/.test(v) },
  { id: 'minuscula', texto: 'Una minúscula (a-z)', cumple: (v) => /[a-z]/.test(v) },
  { id: 'numero', texto: 'Un número (0-9)', cumple: (v) => /[0-9]/.test(v) },
  // Los mismos caracteres especiales que acepta la política de contraseñas de
  // Firebase: la ñ, tildes o espacios no cuentan (Firebase la rechazaría).
  { id: 'especial', texto: 'Un carácter especial (@#$…)', cumple: (v) => /[\^$*.[\]{}()?"!@#%&/\\,><':;|_~`=+-]/.test(v) },
]

/** true si la contraseña cumple todos los requisitos. */
export function contrasenaSegura(valor) {
  return REQUISITOS.every((r) => r.cumple(valor))
}

/**
 * Aviso bajo "Confirmar contraseña", solo cuando la contraseña ya es segura
 * (barra verde): { texto, ok } o null. Mientras lo escrito va coincidiendo
 * con el inicio de la contraseña no se marca error, para no regañar a medio
 * escribir.
 */
export function avisoConfirmacion(contrasena, confirmar) {
  if (!confirmar || !contrasenaSegura(contrasena)) return null
  if (confirmar === contrasena) return { texto: '✓ Las contraseñas coinciden', ok: true }
  if (contrasena.startsWith(confirmar)) return null
  return { texto: 'Las contraseñas no coinciden', ok: false }
}

const NIVELES = [
  { hasta: 2, nombre: 'Débil', clase: 'debil' },
  { hasta: 4, nombre: 'Media', clase: 'media' },
  { hasta: 5, nombre: 'Segura', clase: 'segura' },
]

export default function FuerzaContrasena({ valor }) {
  if (!valor) return null

  const cumplidos = REQUISITOS.map((r) => ({ ...r, ok: r.cumple(valor) }))
  const puntaje = cumplidos.filter((r) => r.ok).length
  const nivel = NIVELES.find((n) => puntaje <= n.hasta)
  const segura = puntaje === REQUISITOS.length

  return (
    <div className={`fuerza fuerza-${nivel.clase}`} aria-live="polite">
      <div className="fuerza-cabecera">
        <span>
          Seguridad de la contraseña <strong>{nivel.nombre}</strong>
        </span>
        <span className="fuerza-icono" aria-hidden="true">
          <Icon name={segura ? 'shieldCheck' : 'shield'} size={16} />
        </span>
      </div>

      <div className="fuerza-barra">
        <div style={{ width: `${Math.max(puntaje, 1) * 20}%` }} />
      </div>

      {/* Se pliega (no desaparece de golpe) al cumplirse todo. */}
      <div className={`fuerza-plegable${segura ? ' plegado' : ''}`} aria-hidden={segura || undefined}>
        <ul className="fuerza-requisitos">
          {cumplidos.map((r) => (
            <li key={r.id} className={r.ok ? 'cumple' : undefined}>
              <span className="fuerza-check"><Icon name="check" size={13} /></span>
              {r.texto}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
