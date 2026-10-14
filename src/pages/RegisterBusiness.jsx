import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Captcha from '../components/Captcha.jsx'
import { geocodeDireccion } from '../maps/osm.js'
import CampoDireccion from '../components/CampoDireccion.jsx'
import MapaUbicacion from '../components/MapaUbicacion.jsx'
import Icon from '../components/Icon.jsx'
import { BotonOjo, Campo } from './Acceso.jsx'
import { avisoDominioCorreo, correoPermitido } from '../correos.js'
import FuerzaContrasena, { avisoConfirmacion, contrasenaSegura } from '../components/FuerzaContrasena.jsx'
import { soloDigitos } from '../telefonos.js'

const initialForm = {
  nombrePropietario: '',
  correo: '',
  contrasena: '',
  confirmar: '',
  nombreNegocio: '',
  direccion: '',
  descripcion: '',
  whatsapp: '',
  telefono: '',
}

export default function RegisterBusiness() {
  const [form, setForm] = useState(initialForm)
  const [acepta, setAcepta] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [captcha, setCaptcha] = useState(null) // token de reCAPTCHA v2, ver Captcha.jsx
  const captchaRef = useRef(null)
  // Coordenadas elegidas directamente de una sugerencia del autocompletado o
  // moviendo el pin del mapa, si las hay; si el usuario termina escribiendo
  // una dirección distinta a mano, se ignoran y se re-geocodifica al enviar.
  const [ubicacion, setUbicacion] = useState(null)
  const [direccionDeUbicacion, setDireccionDeUbicacion] = useState('')

  const { registerBusinessOwner } = useAuth()
  const navigate = useNavigate()

  const [mostrar, setMostrar] = useState(false) // ver/ocultar contraseñas
  const [revisarCorreo, setRevisarCorreo] = useState(false) // se intentó enviar
  const confirmacion = avisoConfirmacion(form.contrasena, form.confirmar)
  const cambiar = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!correoPermitido(form.correo)) {
      setRevisarCorreo(true)
      document.getElementById('negocio-correo')?.focus()
      return
    }
    if (form.contrasena !== form.confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!contrasenaSegura(form.contrasena)) {
      setError('La contraseña no cumple todos los requisitos de seguridad.')
      return
    }
    if (!acepta) {
      setError('Debes autorizar el tratamiento de los datos para continuar (Ley 1581 de 2012).')
      return
    }
    if (!captcha) {
      setError('Marca la casilla "No soy un robot".')
      return
    }

    setLoading(true)
    try {
      // La ubicación en el mapa es un extra visual (RF-06): si la
      // geocodificación falla (dirección no reconocida, key sin cuota, etc.)
      // el registro del negocio no debe bloquearse por eso.
      let ubicacionFinal = ubicacion
      if (form.direccion.trim() !== direccionDeUbicacion) {
        try {
          ubicacionFinal = await geocodeDireccion(form.direccion)
        } catch (geoErr) {
          ubicacionFinal = null
          // eslint-disable-next-line no-console
          console.error(geoErr)
        }
      }
      await registerBusinessOwner({ ...form, ubicacion: ubicacionFinal })
      navigate('/panel', { replace: true })
    } catch (err) {
      captchaRef.current?.reiniciar()
      setError(mapAuthError(err))
      // eslint-disable-next-line no-console
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Mismo estilo neumórfico que el inicio de sesión (ver Acceso.jsx y
  // ".acceso" en index.css), pero en una tarjeta fija y más ancha: este
  // formulario es demasiado largo para la tarjeta que gira.
  return (
    <div className="acceso">
      <div className="acceso-burbuja acceso-burbuja-1" aria-hidden="true" />
      <div className="acceso-burbuja acceso-burbuja-2" aria-hidden="true" />
      <div className="acceso-burbuja acceso-burbuja-3" aria-hidden="true" />

      <Link to="/" className="acceso-volver">
        <Icon name="arrowLeft" size={15} /> Volver al inicio
      </Link>

      <div className="acceso-escena acceso-escena-ancha">
        <div className="acceso-cara acceso-cara-fija">
          <div className="acceso-logo">
            <Icon name="store" size={30} />
          </div>
          <h1 className="acceso-titulo">Registra tu barbería</h1>
          <p className="acceso-subtitulo">Crea tu portafolio digital gratis y llega a más clientes del barrio</p>

          <form onSubmit={handleSubmit}>
            <div className="acceso-seccion">Datos del propietario</div>
            <Campo id="negocio-propietario" label="Nombre completo" autoComplete="name" maxLength={80} value={form.nombrePropietario} onChange={cambiar('nombrePropietario')} />
            <Campo id="negocio-correo" label="Correo electrónico" type="email" autoComplete="email" maxLength={120} value={form.correo} onChange={cambiar('correo')} aviso={avisoDominioCorreo(form.correo, revisarCorreo)} />
            <div className="acceso-fila">
              <Campo
                id="negocio-contrasena"
                label="Contraseña"
                type={mostrar ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.contrasena}
                onChange={cambiar('contrasena')}
                derecha={<BotonOjo mostrar={mostrar} onClick={() => setMostrar((v) => !v)} />}
              />
              <Campo
                id="negocio-confirmar"
                label="Confirmar contraseña"
                type={mostrar ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirmar}
                onChange={cambiar('confirmar')}
              />
            </div>
            <FuerzaContrasena valor={form.contrasena} />
            {/* El aviso de confirmación va debajo de la fila (no dentro, que
                es de dos columnas). */}
            {confirmacion && (
              <div className={`acceso-aviso-campo${confirmacion.ok ? ' ok' : ''}`} role={confirmacion.ok ? 'status' : 'alert'}>
                {confirmacion.texto}
              </div>
            )}

            <div className="acceso-seccion">Datos del negocio</div>
            <Campo id="negocio-nombre" label="Nombre del negocio" autoComplete="organization" maxLength={80} value={form.nombreNegocio} onChange={cambiar('nombreNegocio')} />
            <Campo id="negocio-categoria" label="Categoría de servicio" value="Barbería y estética" disabled />
            <p className="acceso-ayuda">
              Este prototipo está enfocado exclusivamente en barberías y estética del barrio Britalia.
            </p>

            <div className="acceso-libre">
              <label htmlFor="negocio-direccion">Dirección</label>
              <CampoDireccion
                id="negocio-direccion"
                required
                value={form.direccion}
                onChange={(direccion) => setForm((f) => ({ ...f, direccion }))}
                onSeleccion={({ direccion, ubicacion: nuevaUbicacion }) => {
                  setForm((f) => ({ ...f, direccion }))
                  setUbicacion(nuevaUbicacion)
                  setDireccionDeUbicacion(direccion)
                }}
                placeholder="Cra. 104 #146-22, Britalia"
              />
            </div>
            <div className="acceso-mapa">
              <MapaUbicacion
                ubicacion={ubicacion}
                onCambiar={({ direccion, ubicacion: nuevaUbicacion }) => {
                  setUbicacion(nuevaUbicacion)
                  if (direccion) {
                    setForm((f) => ({ ...f, direccion }))
                    setDireccionDeUbicacion(direccion)
                  } else {
                    setDireccionDeUbicacion(form.direccion)
                  }
                }}
              />
            </div>

            <div className="acceso-libre">
              <label htmlFor="negocio-descripcion">Descripción breve</label>
              <textarea
                id="negocio-descripcion"
                maxLength={600}
                rows={3}
                value={form.descripcion}
                onChange={(e) => cambiar('descripcion')(e.target.value)}
                placeholder="Fades, diseño y afeitado clásico en el corazón de Britalia."
              />
            </div>

            <div className="acceso-fila">
              <Campo id="negocio-whatsapp" label="WhatsApp" type="tel" inputMode="numeric" autoComplete="tel" maxLength={15} value={form.whatsapp} onChange={(v) => cambiar('whatsapp')(soloDigitos(v))} />
              <Campo id="negocio-telefono" label="Teléfono" type="tel" inputMode="numeric" maxLength={15} value={form.telefono} onChange={(v) => cambiar('telefono')(soloDigitos(v))} />
            </div>

            <label className="acceso-consentimiento">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
              <span>Autorizo el tratamiento de los datos personales y del negocio conforme a la Ley 1581 de 2012.</span>
            </label>

            <div className="acceso-captcha">
              <Captcha ref={captchaRef} onChange={setCaptcha} />
            </div>

            {error && <div className="error-text acceso-error">{error}</div>}

            <button type="submit" className="acceso-boton" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear cuenta de negocio'}
            </button>
          </form>

          <div className="acceso-cambio">
            <span>¿Ya tienes cuenta?</span>
            <Link to="/login" className="acceso-circulo" title="Iniciar sesión" aria-label="Iniciar sesión">
              <Icon name="arrowLeft" size={20} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function mapAuthError(err) {
  const code = err?.code || ''
  if (code.includes('email-already-in-use')) return 'Ya existe una cuenta con ese correo.'
  if (code.includes('invalid-email')) return 'El correo electrónico no es válido.'
  if (code.includes('weak-password') || code.includes('password-does-not-meet-requirements')) return 'La contraseña no cumple todos los requisitos de seguridad.'
  return 'No se pudo crear la cuenta. Intenta de nuevo en unos minutos.'
}
