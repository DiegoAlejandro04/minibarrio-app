// ─────────────────────────────────────────────────────────────────────────
// PÁGINA INACTIVA — lista para usarse a futuro, hoy no tiene ruta.
//
// Página propia para los enlaces que Firebase Authentication manda por correo
// (restablecer contraseña, verificar correo, confirmar el cambio de correo y
// revertirlo), con el diseño de MiniBarrio. Reemplazaría la página genérica
// de firebaseapp.com/__/auth/action, que no se puede personalizar.
//
// Por qué está apagada: para que los correos apunten aquí hay que cambiar la
// "URL de acción" de las plantillas de Firebase, y Firebase lo rechaza en
// este proyecto (la consola dice "Se produjo un error mientras se
// actualizaba la URL de acción"; la API responde
// EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED). Es una restricción de los proyectos en
// el plan gratuito Spark. Tampoco sirve pasar handleCodeInApp: true al
// enviar el correo — la página genérica lo ignora en los de recuperar
// contraseña (probado el 2026-10-13).
//
// Para activarla (requiere el plan Blaze):
//   1. En App.jsx, descomentar el import y la ruta "/cuenta/accion".
//   2. Publicar (npm run build + firebase deploy --only hosting).
//   3. Firebase → Authentication → Plantillas → editar cualquier plantilla →
//      "Personalizar URL de acción" → https://minibarrio-c8b21.web.app/cuenta/accion
//      (aplica a todas las plantillas a la vez, por eso esta página atiende
//      todos los modos).
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { applyActionCode, checkActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '../firebase/config'
import Icon from '../components/Icon.jsx'

const MINIMO_CONTRASENA = 6 // el mismo que exige Firebase y el registro

const ERRORES_CODIGO = {
  'auth/expired-action-code': 'Este enlace ya venció. Pide uno nuevo.',
  'auth/invalid-action-code': 'Este enlace ya se usó o no es válido. Pide uno nuevo.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/user-not-found': 'Ya no existe una cuenta con este correo.',
}

const mensajeError = (err) =>
  ERRORES_CODIGO[err?.code] || 'Algo salió mal. Revisa tu conexión e intenta de nuevo.'

// Indicador orientativo, no una regla: Firebase solo exige el mínimo.
function fuerzaDe(contrasena) {
  if (contrasena.length < MINIMO_CONTRASENA) return 0
  let puntos = 1
  if (contrasena.length >= 10) puntos++
  if (/[a-zA-Z]/.test(contrasena) && /\d/.test(contrasena)) puntos++
  if (/[^a-zA-Z0-9]/.test(contrasena) || (/[a-z]/.test(contrasena) && /[A-Z]/.test(contrasena))) puntos++
  return Math.min(puntos, 3)
}

const FUERZA = [
  null,
  { label: 'Débil', color: 'var(--danger)' },
  { label: 'Aceptable', color: 'var(--warning-text)' },
  { label: 'Fuerte', color: 'var(--sage)' },
]

// Íconos propios de esta página (el set compartido de components/Icon.jsx no
// los trae): se pintan con el mismo trazo que el resto de la app.
const ICONOS_PROPIOS = {
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4',
  check: 'M20 6 9 17l-5-5',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  alert: 'M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
}

function IconoPropio({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONOS_PROPIOS[name]} />
    </svg>
  )
}

export default function AccionCuenta() {
  const [params] = useSearchParams()
  const modo = params.get('mode')
  const codigo = params.get('oobCode')

  const [estado, setEstado] = useState('cargando') // cargando | formulario | listo | error
  const [correo, setCorreo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    const terminar = (siguiente, correoMostrado = '') => {
      if (cancelado) return
      setCorreo(correoMostrado)
      setEstado(siguiente)
    }
    const fallar = (err, mensaje = mensajeError(err)) => {
      if (cancelado) return
      setError(mensaje)
      setEstado('error')
    }

    if (!codigo || !modo) {
      fallar(null, 'Este enlace está incompleto. Ábrelo de nuevo desde el correo.')
      return () => { cancelado = true }
    }

    if (modo === 'resetPassword') {
      verifyPasswordResetCode(auth, codigo).then((c) => terminar('formulario', c), fallar)
    } else if (modo === 'verifyEmail' || modo === 'verifyAndChangeEmail' || modo === 'recoverEmail') {
      // checkActionCode primero: después de aplicarlo el código ya no sirve
      // para leer a qué correo correspondía.
      checkActionCode(auth, codigo)
        // data.email es el correo verificado, el nuevo (cambio) o el
        // restaurado (recuperación), según el modo.
        .then((info) => applyActionCode(auth, codigo).then(() => terminar('listo', info.data.email)))
        .catch(fallar)
    } else {
      fallar(null, 'Este enlace no es válido.')
    }
    return () => { cancelado = true }
  }, [modo, codigo])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }}>
      <Link
        to="/"
        style={{
          position: 'absolute', top: 24, left: 24, fontSize: 13.5, fontWeight: 700, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Volver al inicio
      </Link>

      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        <Marca />
        {estado === 'cargando' && <Cargando />}
        {estado === 'error' && <ErrorEnlace mensaje={error} modo={modo} />}
        {estado === 'formulario' && modo === 'resetPassword' && (
          <FormularioContrasena codigo={codigo} correo={correo} onListo={() => setEstado('listo')} />
        )}
        {estado === 'listo' && <Listo modo={modo} correo={correo} />}
      </div>
    </div>
  )
}

function Marca() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 17, fontWeight: 800, marginBottom: 24 }}>
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
    </div>
  )
}

// Círculo con ícono que encabeza cada estado (candado, check, alerta).
function IconoEstado({ icono, fondo, color }) {
  return (
    <div
      style={{
        width: 48, height: 48, borderRadius: '50%', background: fondo, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}
    >
      <IconoPropio name={icono} size={22} />
    </div>
  )
}

function Cargando() {
  return (
    <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
      <span className="dots-cargando" aria-label="Verificando el enlace…">
        <span /><span /><span />
      </span>
      <div style={{ marginTop: 10 }}>Verificando el enlace…</div>
    </div>
  )
}

function FormularioContrasena({ codigo, correo, onListo }) {
  const [contrasena, setContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const largoOk = contrasena.length >= MINIMO_CONTRASENA
  const coinciden = confirmacion.length > 0 && confirmacion === contrasena
  const fuerza = FUERZA[fuerzaDe(contrasena)]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!largoOk) {
      setError(`La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`)
      return
    }
    if (!coinciden) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setError('')
    setGuardando(true)
    try {
      await confirmPasswordReset(auth, codigo, contrasena)
      onListo()
    } catch (err) {
      setError(err.code === 'auth/weak-password' ? 'Esa contraseña es demasiado débil. Prueba con una más larga.' : mensajeError(err))
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <IconoEstado icono="lock" fondo="var(--accent-soft)" color="var(--accent)" />
      <div style={{ fontSize: 21, fontWeight: 800 }}>Crea una contraseña nueva</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
        Para la cuenta <strong style={{ color: 'var(--text)' }}>{correo}</strong>
      </div>

      <label htmlFor="nueva" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginTop: 22 }}>Nueva contraseña</label>
      <div style={{ position: 'relative', marginTop: 6 }}>
        <input
          id="nueva"
          type={mostrar ? 'text' : 'password'}
          autoComplete="new-password"
          autoFocus
          maxLength={128}
          value={contrasena}
          onChange={(e) => { setContrasena(e.target.value); setError('') }}
          placeholder="••••••••"
          style={{ paddingRight: 40 }}
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          title={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          style={{
            position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', padding: 4,
          }}
        >
          <Icon name={mostrar ? 'eyeOff' : 'eye'} size={17} />
        </button>
      </div>

      {/* Barra de fuerza: tres segmentos que se llenan con el color del nivel. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 16 }}>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {[1, 2, 3].map((nivel) => (
            <div
              key={nivel}
              style={{
                flex: 1, height: 4, borderRadius: 999, transition: 'background .2s',
                background: fuerza && fuerzaDe(contrasena) >= nivel ? fuerza.color : 'var(--surface-2)',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: fuerza?.color || 'var(--text-faint)', minWidth: 62, textAlign: 'right' }}>
          {fuerza?.label || ''}
        </span>
      </div>

      <label htmlFor="confirmar" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginTop: 14 }}>Confirma la contraseña</label>
      <input
        id="confirmar"
        type={mostrar ? 'text' : 'password'}
        autoComplete="new-password"
        maxLength={128}
        value={confirmacion}
        onChange={(e) => { setConfirmacion(e.target.value); setError('') }}
        placeholder="••••••••"
        style={{ marginTop: 6 }}
      />

      <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Requisito cumplido={largoOk}>Al menos {MINIMO_CONTRASENA} caracteres</Requisito>
        <Requisito cumplido={coinciden}>Las dos contraseñas coinciden</Requisito>
      </ul>

      {error && <div className="error-text" role="alert">{error}</div>}

      <button type="submit" className="btn btn-primary" disabled={guardando} style={{ width: '100%', marginTop: 20 }}>
        {guardando ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  )
}

function Requisito({ cumplido, children }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: cumplido ? 'var(--sage-text)' : 'var(--text-faint)', transition: 'color .2s' }}>
      <span
        style={{
          width: 16, height: 16, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: cumplido ? 'var(--sage)' : 'transparent', border: cumplido ? 'none' : '1.5px solid var(--border-strong)',
          color: '#fff', transition: 'background .2s',
        }}
      >
        {cumplido && <IconoPropio name="check" size={11} />}
      </span>
      {children}
    </li>
  )
}

const TEXTOS_LISTO = {
  resetPassword: {
    titulo: 'Contraseña actualizada',
    detalle: () => 'Ya puedes iniciar sesión con tu contraseña nueva.',
  },
  verifyEmail: {
    titulo: 'Correo verificado',
    detalle: (c) => <>Confirmamos <strong style={{ color: 'var(--text)' }}>{c}</strong>. Tu cuenta ya está lista.</>,
  },
  verifyAndChangeEmail: {
    titulo: 'Correo actualizado',
    detalle: (c) => <>Desde ahora inicias sesión con <strong style={{ color: 'var(--text)' }}>{c}</strong>.</>,
  },
  recoverEmail: {
    titulo: 'Recuperamos tu correo',
    detalle: (c) => <>Tu cuenta vuelve a usar <strong style={{ color: 'var(--text)' }}>{c}</strong>. Si no fuiste tú quien pidió el cambio, cambia también tu contraseña.</>,
  },
}

function Listo({ modo, correo }) {
  const texto = TEXTOS_LISTO[modo] || TEXTOS_LISTO.resetPassword
  return (
    <div>
      <IconoEstado icono="checkCircle" fondo="var(--sage-soft)" color="var(--sage-text)" />
      <div style={{ fontSize: 21, fontWeight: 800 }}>{texto.titulo}</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>{texto.detalle(correo)}</div>
      <Link to="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', marginTop: 24 }}>
        Iniciar sesión
      </Link>
    </div>
  )
}

function ErrorEnlace({ mensaje, modo }) {
  return (
    <div>
      <IconoEstado icono="alert" fondo="var(--warning-soft)" color="var(--warning-text)" />
      <div style={{ fontSize: 21, fontWeight: 800 }}>No pudimos usar este enlace</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>{mensaje}</div>
      <Link to="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', marginTop: 24 }}>
        {modo === 'resetPassword' ? 'Pedir un enlace nuevo' : 'Ir a iniciar sesión'}
      </Link>
    </div>
  )
}
