import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

// Casilla "No soy un robot" (reCAPTCHA v2) para los formularios de registro,
// inicio de sesión, PQRS y Contáctanos.
//
// Ojo: en registro e inicio de sesión la casilla solo frena a quien usa la
// página; un script que le hable directo a Firebase no la ve. Lo que frena a
// los scripts ahí es App Check (ver firebase/config.js). En PQRS y
// Contáctanos sí se verifica del lado del servidor: EmailJS revisa el token
// con la clave secreta antes de enviar el correo.
//
// La clave de sitio es pública por diseño (la secreta solo vive en EmailJS).
export const CAPTCHA_SITE_KEY = '6Ldw9uItAAAAALIlGpHMwEnCDXj2Qt-Cf-pOxW2Q'

const SCRIPT_URL = 'https://www.google.com/recaptcha/api.js?render=explicit&hl=es'
let cargaScript = null

// Carga el script de reCAPTCHA una sola vez. App Check ya cargó antes el de
// reCAPTCHA Enterprise, que vive en window.grecaptcha.enterprise: por si
// este script reemplaza window.grecaptcha al cargar, se guarda y se repone
// esa parte para no romper App Check.
function cargarRecaptcha() {
  if (cargaScript) return cargaScript
  cargaScript = new Promise((resolve, reject) => {
    const enterprise = window.grecaptcha?.enterprise
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => {
      window.grecaptcha.ready(() => {
        if (enterprise && !window.grecaptcha.enterprise) window.grecaptcha.enterprise = enterprise
        resolve(window.grecaptcha)
      })
    }
    script.onerror = () => {
      cargaScript = null
      reject(new Error('No se pudo cargar reCAPTCHA'))
    }
    document.head.appendChild(script)
  })
  return cargaScript
}

/**
 * `onChange(token | null)`: el token cuando el usuario marca la casilla, y
 * null cuando caduca. Con ref se puede llamar `reiniciar()` después de un
 * envío (cada token sirve una sola vez).
 */
const Captcha = forwardRef(function Captcha({ onChange }, ref) {
  const contenedorRef = useRef(null)
  const widgetRef = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [error, setError] = useState(false)

  useImperativeHandle(ref, () => ({
    reiniciar() {
      if (widgetRef.current != null) window.grecaptcha?.reset(widgetRef.current)
      onChangeRef.current(null)
    },
  }))

  useEffect(() => {
    let cancelado = false
    cargarRecaptcha()
      .then((grecaptcha) => {
        if (cancelado || !contenedorRef.current || widgetRef.current != null) return
        widgetRef.current = grecaptcha.render(contenedorRef.current, {
          sitekey: CAPTCHA_SITE_KEY,
          theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
          callback: (token) => onChangeRef.current(token),
          'expired-callback': () => onChangeRef.current(null),
          'error-callback': () => onChangeRef.current(null),
        })
      })
      .catch(() => !cancelado && setError(true))
    return () => { cancelado = true }
  }, [])

  // En modo oscuro el widget de Google (304×78) trae un borde claro y una
  // sombra clara abajo y a la derecha que no se pueden cambiar (viven dentro
  // de su iframe): se recortan con un contenedor más pequeño y overflow
  // hidden — 2px arriba/izquierda y 3px abajo/derecha.
  const oscuro = document.documentElement.dataset.theme === 'dark'
  const base = oscuro ? { w: 299, h: 73 } : { w: 304, h: 78 }

  // El widget no tiene opción de tamaño intermedio (solo "normal" 304×78 o
  // "compact" 164×144, mucho más alto) — para que se vea más chico sin pedir
  // el compacto se encoge con CSS y se recorta el espacio sobrante que deja
  // el encogimiento, centrado en vez de pegado a la izquierda.
  const ESCALA = 0.82
  const ancho = Math.round(base.w * ESCALA)
  const alto = Math.round(base.h * ESCALA)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: ancho, height: alto, overflow: 'hidden' }}>
          <div style={{ transform: `scale(${ESCALA})`, transformOrigin: 'top left' }}>
            <div style={oscuro ? { width: base.w, height: base.h, overflow: 'hidden', borderRadius: 3 } : undefined}>
              <div ref={contenedorRef} style={oscuro ? { margin: -2 } : undefined} />
            </div>
          </div>
        </div>
      </div>
      {error && (
        <div className="error-text">No se pudo cargar la verificación. Revisa tu conexión y recarga la página.</div>
      )}
    </div>
  )
})

export default Captcha
