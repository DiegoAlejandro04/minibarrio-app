import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Captcha from '../components/Captcha.jsx'
import Icon from '../components/Icon.jsx'
import GoogleIcon from '../components/GoogleIcon.jsx'
import RecuperarContrasenaModal from '../components/RecuperarContrasenaModal.jsx'
import { avisoDominioCorreo, correoPermitido } from '../correos.js'

// Inicio de sesión y registro de cliente en una sola tarjeta que gira en 3D
// entre sus dos caras (estilo "neumórfico": sombras suaves en relieve y
// hundidas, con los colores del tema de la app — ver ".acceso" en
// index.css). Adaptado del "Login & Sign Up Form UI" de CodeByGaurav.
//
// Se monta en /login y en /registro/cliente: la cara visible sale de la URL,
// y el botón redondo de abajo cambia la URL (sin sumar historial). Como las
// dos rutas usan este mismo componente, React no lo vuelve a montar y el
// giro se anima. El registro de negocios sigue en /registro/negocio: tiene
// demasiados campos (dirección, mapa…) para una tarjeta.

const RUTA_REGISTRO = '/registro/cliente'

export default function Acceso() {
  const location = useLocation()
  const navigate = useNavigate()
  const enRegistro = location.pathname === RUTA_REGISTRO

  const [recuperando, setRecuperando] = useState(null) // correo inicial | null
  const loginRef = useRef(null)
  const registroRef = useRef(null)
  const [alto, setAlto] = useState(null)

  // Las caras están superpuestas (position: absolute) para poder girar; la
  // tarjeta toma el alto de la cara visible y lo anima al girar.
  useLayoutEffect(() => {
    const cara = (enRegistro ? registroRef : loginRef).current
    if (!cara) return undefined
    const medir = () => setAlto(cara.offsetHeight)
    medir()
    const observer = new ResizeObserver(medir)
    observer.observe(cara)
    return () => observer.disconnect()
  }, [enRegistro])

  function girar() {
    // Conserva a dónde volver tras iniciar sesión (state.from).
    navigate(enRegistro ? '/login' : RUTA_REGISTRO, { replace: true, state: location.state })
  }

  return (
    <div className="acceso">
      <div className="acceso-burbuja acceso-burbuja-1" aria-hidden="true" />
      <div className="acceso-burbuja acceso-burbuja-2" aria-hidden="true" />
      <div className="acceso-burbuja acceso-burbuja-3" aria-hidden="true" />

      <Link to="/" className="acceso-volver">
        <Icon name="arrowLeft" size={15} /> Volver al inicio
      </Link>

      <div className="acceso-escena">
        <div className={`acceso-tarjeta${enRegistro ? ' girada' : ''}`} style={{ height: alto ?? undefined }}>
          <div ref={loginRef} className="acceso-cara" inert={enRegistro ? '' : undefined}>
            <CaraLogin onGirar={girar} onOlvido={(correo) => setRecuperando(correo)} />
          </div>
          <div ref={registroRef} className="acceso-cara acceso-cara-registro" inert={enRegistro ? undefined : ''}>
            <CaraRegistro onGirar={girar} />
          </div>
        </div>
      </div>

      {/* Fuera de la tarjeta: un position: fixed dentro de un elemento
          girado en 3D se ubicaría respecto a la tarjeta, no a la pantalla. */}
      {recuperando !== null && (
        <RecuperarContrasenaModal correoInicial={recuperando} onClose={() => setRecuperando(null)} />
      )}
    </div>
  )
}

// ── Cara 1: iniciar sesión ──────────────────────────────────────────────────

function CaraLogin({ onGirar, onOlvido }) {
  const [tab, setTab] = useState('cliente') // solo cambia textos; el rol real viene de Firestore
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [captcha, setCaptcha] = useState(null) // token de reCAPTCHA v2, ver Captcha.jsx
  const captchaRef = useRef(null)

  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const esCliente = tab === 'cliente'

  function destino(rol) {
    return location.state?.from?.pathname || (rol === 'propietario' ? '/panel' : '/')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!captcha) {
      setError('Marca la casilla "No soy un robot".')
      return
    }
    setCargando(true)
    try {
      const rol = await login(correo, contrasena)
      navigate(destino(rol), { replace: true })
    } catch (err) {
      captchaRef.current?.reiniciar()
      setError('Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.')
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setCargando(true)
    try {
      const rol = await loginWithGoogle(tab)
      navigate(destino(rol), { replace: true })
    } catch (err) {
      if (err.message === 'google-sin-cuenta-propietario') {
        setError('No encontramos un negocio registrado con esta cuenta de Google. Regístralo primero.')
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError('No se pudo iniciar sesión con Google. Intenta de nuevo.')
      }
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      {/* key={tab}: al cambiar de pestaña el ícono y los textos se vuelven a
          montar y repiten su animación de entrada. */}
      <div key={`logo-${tab}`} className="acceso-logo acceso-entra">
        <Icon name={esCliente ? 'lock' : 'store'} size={30} />
      </div>
      <h1 className="acceso-titulo">Bienvenido</h1>
      <p key={`sub-${tab}`} className="acceso-subtitulo acceso-entra">
        {esCliente
          ? 'Inicia sesión para agendar en las barberías de Britalia'
          : 'Inicia sesión para administrar tu barbería'}
      </p>

      <div className="acceso-pestanas" role="tablist" aria-label="Tipo de cuenta">
        <span className={`acceso-pestana-indicador${esCliente ? '' : ' derecha'}`} aria-hidden="true" />
        <button type="button" role="tab" aria-selected={esCliente} className={esCliente ? 'activa' : ''} onClick={() => setTab('cliente')}>
          Cliente
        </button>
        <button type="button" role="tab" aria-selected={!esCliente} className={!esCliente ? 'activa' : ''} onClick={() => setTab('propietario')}>
          Propietario de negocio
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <Campo id="login-correo" label="Correo electrónico" type="email" autoComplete="email" maxLength={120} value={correo} onChange={setCorreo} />
        <Campo
          id="login-contrasena"
          label="Contraseña"
          type={mostrar ? 'text' : 'password'}
          autoComplete="current-password"
          value={contrasena}
          onChange={setContrasena}
          derecha={<BotonOjo mostrar={mostrar} onClick={() => setMostrar((v) => !v)} />}
        />

        <div className="acceso-opciones">
          <button type="button" className="acceso-enlace" onClick={() => onOlvido(correo)}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <div className="acceso-captcha">
          <Captcha ref={captchaRef} onChange={setCaptcha} />
        </div>

        {error && <div className="error-text acceso-error">{error}</div>}

        <button type="submit" className="acceso-boton" disabled={cargando}>
          {cargando ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>

      <BotonGoogle onClick={handleGoogle} disabled={cargando} />

      <div className="acceso-cambio">
        {esCliente ? (
          <>
            <span>¿No tienes cuenta?</span>
            <button type="button" className="acceso-circulo" onClick={onGirar} title="Crear cuenta de cliente" aria-label="Crear cuenta de cliente">
              <Icon name="plus" size={20} />
            </button>
          </>
        ) : (
          <>
            <span>¿Tu barbería aún no está en MiniBarrio?</span>
            <Link to="/registro/negocio" className="acceso-circulo" title="Registrar mi negocio" aria-label="Registrar mi negocio">
              <Icon name="plus" size={20} />
            </Link>
          </>
        )}
      </div>
    </>
  )
}

// ── Cara 2: crear cuenta de cliente ─────────────────────────────────────────

function CaraRegistro({ onGirar }) {
  const [form, setForm] = useState({ nombre: '', correo: '', telefono: '', contrasena: '', confirmar: '' })
  const [mostrar, setMostrar] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [captcha, setCaptcha] = useState(null)
  const captchaRef = useRef(null)

  const { registerClient, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const cambiar = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }))
  const [revisarCorreo, setRevisarCorreo] = useState(false) // se intentó enviar
  const avisoCorreo = avisoDominioCorreo(form.correo, revisarCorreo)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!correoPermitido(form.correo)) {
      setRevisarCorreo(true)
      document.getElementById('registro-correo')?.focus()
      return
    }
    if (form.contrasena !== form.confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (form.contrasena.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (!acepta) {
      setError('Debes autorizar el tratamiento de tus datos personales para continuar (Ley 1581 de 2012).')
      return
    }
    if (!captcha) {
      setError('Marca la casilla "No soy un robot".')
      return
    }
    setCargando(true)
    try {
      await registerClient({
        nombre: form.nombre,
        correo: form.correo,
        telefono: form.telefono,
        contrasena: form.contrasena,
      })
      navigate('/', { replace: true })
    } catch (err) {
      captchaRef.current?.reiniciar()
      setError(mapAuthError(err))
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setCargando(true)
    try {
      await loginWithGoogle('cliente')
      navigate('/', { replace: true })
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('No se pudo crear la cuenta con Google. Intenta de nuevo.')
      }
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      <div className="acceso-logo">
        <Icon name="user" size={30} />
      </div>
      <h1 className="acceso-titulo">Crea tu cuenta</h1>
      <p className="acceso-subtitulo">Agenda y guarda tus barberías favoritas</p>

      <form onSubmit={handleSubmit}>
        <Campo id="registro-nombre" label="Nombre completo" autoComplete="name" maxLength={80} value={form.nombre} onChange={cambiar('nombre')} />
        <Campo id="registro-correo" label="Correo electrónico" type="email" autoComplete="email" maxLength={120} value={form.correo} onChange={cambiar('correo')} aviso={avisoCorreo} />
        <Campo id="registro-telefono" label="Teléfono / WhatsApp" type="tel" autoComplete="tel" maxLength={20} value={form.telefono} onChange={cambiar('telefono')} />
        <Campo
          id="registro-contrasena"
          label="Contraseña"
          type={mostrar ? 'text' : 'password'}
          autoComplete="new-password"
          value={form.contrasena}
          onChange={cambiar('contrasena')}
          derecha={<BotonOjo mostrar={mostrar} onClick={() => setMostrar((v) => !v)} />}
        />
        <Campo
          id="registro-confirmar"
          label="Confirmar contraseña"
          type={mostrar ? 'text' : 'password'}
          autoComplete="new-password"
          value={form.confirmar}
          onChange={cambiar('confirmar')}
        />

        <label className="acceso-consentimiento">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
          <span>Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.</span>
        </label>

        <div className="acceso-captcha">
          <Captcha ref={captchaRef} onChange={setCaptcha} />
        </div>

        {error && <div className="error-text acceso-error">{error}</div>}

        <button type="submit" className="acceso-boton" disabled={cargando}>
          {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <BotonGoogle onClick={handleGoogle} disabled={cargando} />

      <div className="acceso-cambio">
        <span>¿Ya tienes cuenta?</span>
        <button type="button" className="acceso-circulo" onClick={onGirar} title="Volver a iniciar sesión" aria-label="Volver a iniciar sesión">
          <Icon name="arrowLeft" size={20} />
        </button>
      </div>
      <div className="acceso-nota">
        ¿Tienes una barbería? <Link to="/registro/negocio">Regístrala aquí</Link>
      </div>
    </>
  )
}

// ── Piezas compartidas ──────────────────────────────────────────────────────

// Campo con etiqueta flotante y borde "eléctrico" naranja al enfocarlo. El
// placeholder=" " es lo que permite saber con CSS (:placeholder-shown) si el
// campo tiene texto, para dejar la etiqueta arriba.
// `aviso` es un mensaje de error del propio campo, que se muestra debajo.
export function Campo({ id, label, type = 'text', value, onChange, autoComplete, maxLength, derecha, disabled = false, aviso }) {
  const campo = (
    <div className={`acceso-campo${derecha ? ' con-boton' : ''}${aviso ? ' con-aviso' : ''}`}>
      <div className="acceso-campo-brillo" aria-hidden="true" />
      <div className="acceso-campo-borde" aria-hidden="true" />
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder=" "
        autoComplete={autoComplete}
        maxLength={maxLength}
        required={!disabled}
        disabled={disabled}
        readOnly={!onChange}
        aria-invalid={aviso ? true : undefined}
        aria-describedby={aviso ? `${id}-aviso` : undefined}
      />
      <label htmlFor={id}>{label}</label>
      {derecha}
    </div>
  )
  if (!aviso) return campo
  return (
    <>
      {campo}
      <div id={`${id}-aviso`} className="acceso-aviso-campo" role="alert">{aviso}</div>
    </>
  )
}

export function BotonOjo({ mostrar, onClick }) {
  return (
    <button
      type="button"
      className="acceso-ojo"
      onClick={onClick}
      title={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
    >
      <Icon name={mostrar ? 'eyeOff' : 'eye'} size={17} />
    </button>
  )
}

function BotonGoogle({ onClick, disabled }) {
  return (
    <>
      <div className="acceso-separador">o</div>
      <button type="button" className="acceso-google" onClick={onClick} disabled={disabled}>
        <GoogleIcon size={17} />
        Continuar con Google
      </button>
      <p className="acceso-nota">
        Al continuar con Google autorizas el tratamiento de tus datos conforme a la Ley 1581 de 2012.
      </p>
    </>
  )
}

function mapAuthError(err) {
  const code = err?.code || ''
  if (code.includes('email-already-in-use')) return 'Ya existe una cuenta con ese correo.'
  if (code.includes('invalid-email')) return 'El correo electrónico no es válido.'
  if (code.includes('weak-password')) return 'La contraseña es demasiado débil.'
  return 'No se pudo crear la cuenta. Intenta de nuevo en unos minutos.'
}
