// Contexto de autenticación y rol de usuario.
//
// Cubre RF-01 (registro/autenticación de dos tipos de usuario: cliente y
// propietario de negocio) del documento de requerimientos. El rol se guarda
// en Firestore (colección "usuarios") junto con el perfil, no solo en Auth,
// para poder consultarlo y usarlo en las reglas de seguridad de Firestore.

import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { deleteField, doc, serverTimestamp, setDoc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { HORARIO_INICIAL } from '../horarios.js'

const AuthContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

// El modo oscuro vive en Firestore (para seguir a la cuenta entre
// dispositivos), pero leerlo de ahí tarda un round-trip de red — en ese
// instante la página ya se pintó en claro, y se ve un parpadeo al recargar.
// Se cachea también aquí, en este navegador, como respaldo síncrono: el
// primer render ya arranca con el valor correcto, sin esperar a Firestore
// (que igual se sigue consultando después, por si cambió desde otro
// dispositivo). Es solo un atajo visual — nunca la fuente de verdad.
const CLAVE_MODO_OSCURO = 'minibarrio:modoOscuro'
const CLAVE_MODO_OSCURO_PANEL = 'minibarrio:modoOscuroPanel'

function leerCache(clave) {
  try {
    return localStorage.getItem(clave) === '1'
  } catch {
    return false // localStorage puede no estar disponible (modo privado, etc.)
  }
}

// Como leerCache, pero distingue "nunca eligió" (null) de "eligió claro"
// (false): sin elección, la vitrina sigue el modo oscuro del dispositivo.
function leerPreferencia(clave) {
  try {
    const valor = localStorage.getItem(clave)
    return valor === '1' ? true : valor === '0' ? false : null
  } catch {
    return null
  }
}

function guardarCache(clave, valor) {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, valor ? '1' : '0')
  } catch {
    // sin esto no hay atajo síncrono la próxima vez, pero no es crítico
  }
}

// Preferencia guardada en el perfil: true/false si el cliente la eligió en
// Configuración, null si nunca la tocó (el campo no existe).
const preferenciaDe = (snap) =>
  snap.exists() && typeof snap.data().modoOscuro === 'boolean' ? snap.data().modoOscuro : null

const consultaOscuroSistema = () =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [role, setRole] = useState(null) // 'cliente' | 'propietario' | null
  // Foto de perfil del cliente (data URL, ver ClientDatosPersonales.jsx), para
  // el círculo del encabezado de la vitrina. null = se ven las iniciales.
  const [fotoPerfil, setFotoPerfil] = useState(null)
  // Dos señales de carga separadas, no una sola: `authReady` se resuelve
  // casi al instante (local, sin red) en cuanto Firebase confirma si hay
  // sesión o no — es lo único que hace falta para saber si mostrar la app o
  // mandar a /login. `loading` tarda más porque además trae el perfil (rol,
  // modo oscuro) de Firestore. Antes una sola bandera cubría ambas cosas, así
  // que ProtectedRoute.jsx esperaba el perfil completo (red) antes de dejar
  // montar la página protegida, y esa página recién ahí arrancaba su propia
  // consulta — las dos consultas quedaban en serie. Separarlas deja que la
  // página empiece a pedir sus datos apenas se sabe quién es el usuario, en
  // paralelo con la confirmación del rol, no después.
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)
  // Modo oscuro del CLIENTE: aplica a toda la vitrina y su panel, pero
  // nunca al panel del negocio. Si el cliente lo eligió en Configuración, esa
  // elección (persistida en su perfil de Firestore) manda; si nunca la tocó,
  // o no hay sesión, se sigue el modo oscuro del celular/PC.
  //
  // Seguir al dispositivo importa sobre todo en Android: con el tema oscuro
  // del teléfono, Chrome oscurecía por su cuenta la página clara ("tema
  // oscuro en sitios web"), pero no las imágenes — el mapa (que son
  // imágenes) quedaba claro en medio de todo oscuro. Ahora la app se pone en
  // su propio modo oscuro, mapa incluido, y Chrome no interviene (ver
  // <meta name="color-scheme"> en index.html).
  const [preferenciaOscuro, setPreferenciaOscuro] = useState(() => leerPreferencia(CLAVE_MODO_OSCURO))
  const [oscuroSistema, setOscuroSistema] = useState(() => !!consultaOscuroSistema()?.matches)
  useEffect(() => {
    const consulta = consultaOscuroSistema()
    if (!consulta) return undefined
    const alCambiar = (e) => setOscuroSistema(e.matches)
    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [])
  const modoOscuro = preferenciaOscuro ?? oscuroSistema
  // Preferencia de modo oscuro del PANEL DEL PROPIETARIO — independiente de
  // la anterior: solo afecta a /panel y nunca se filtra al resto del sitio
  // (ver el efecto de tema en App.jsx).
  const [modoOscuroPanel, setModoOscuroPanel] = useState(() => leerCache(CLAVE_MODO_OSCURO_PANEL))

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      setAuthReady(true)
      if (user) {
        const snap = await getDoc(doc(db, 'usuarios', user.uid))
        const oscuro = preferenciaDe(snap)
        const oscuroPanel = snap.exists() ? !!snap.data().modoOscuroPanel : false
        setRole(snap.exists() ? snap.data().rol : null)
        setFotoPerfil(snap.exists() ? snap.data().foto || null : null)
        setPreferenciaOscuro(oscuro)
        setModoOscuroPanel(oscuroPanel)
        guardarCache(CLAVE_MODO_OSCURO, oscuro)
        guardarCache(CLAVE_MODO_OSCURO_PANEL, oscuroPanel)
      } else {
        setRole(null)
        setFotoPerfil(null)
        setPreferenciaOscuro(null) // sin sesión: sigue al dispositivo
        setModoOscuroPanel(false)
        guardarCache(CLAVE_MODO_OSCURO, null)
        guardarCache(CLAVE_MODO_OSCURO_PANEL, false)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  /**
   * Guarda la preferencia de modo oscuro del cliente en su perfil (para que
   * se mantenga entre sesiones/dispositivos) y la aplica de inmediato.
   */
  async function actualizarModoOscuro(valor) {
    setPreferenciaOscuro(valor)
    guardarCache(CLAVE_MODO_OSCURO, valor)
    if (currentUser) {
      await updateDoc(doc(db, 'usuarios', currentUser.uid), { modoOscuro: valor })
    }
  }

  /** Igual que actualizarModoOscuro, pero para la preferencia del panel del propietario. */
  async function actualizarModoOscuroPanel(valor) {
    setModoOscuroPanel(valor)
    guardarCache(CLAVE_MODO_OSCURO_PANEL, valor)
    if (currentUser) {
      await updateDoc(doc(db, 'usuarios', currentUser.uid), { modoOscuroPanel: valor })
    }
  }

  /**
   * Registra un cliente (RF-01, HU-10 análogo para clientes).
   * Crea el usuario en Firebase Auth y su perfil en Firestore con rol "cliente".
   */
  async function registerClient({ nombre, correo, telefono, contrasena }) {
    const cred = await createUserWithEmailAndPassword(auth, correo, contrasena)
    await updateProfile(cred.user, { displayName: nombre })
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      rol: 'cliente',
      nombre,
      correo,
      telefono,
      consentimientoDatos: true, // Ley 1581 de 2012 — ver checkbox en el formulario
      creadoEn: serverTimestamp(),
    })
    setRole('cliente')
    return cred.user
  }

  /**
   * Registra un propietario de negocio (RF-01, RF-02, HU-10).
   * Crea el usuario en Auth, su perfil en "usuarios" con rol "propietario",
   * y el documento inicial del negocio en la colección "negocios".
   * El negocio queda vinculado al propietario mediante negocio.propietarioId.
   */
  async function registerBusinessOwner({
    nombrePropietario,
    correo,
    telefono,
    contrasena,
    nombreNegocio,
    direccion,
    descripcion,
    whatsapp,
    ubicacion, // { lat, lng } | null — geocodificada en RegisterBusiness.jsx (RF-06)
  }) {
    const cred = await createUserWithEmailAndPassword(auth, correo, contrasena)
    await updateProfile(cred.user, { displayName: nombrePropietario })

    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      rol: 'propietario',
      nombre: nombrePropietario,
      correo,
      telefono,
      consentimientoDatos: true,
      creadoEn: serverTimestamp(),
    })

    // El id del negocio = uid del propietario simplifica las reglas de
    // seguridad (1 propietario ⇄ 1 negocio en este prototipo). Ver
    // docs/MODELO_DATOS.md si en el futuro se necesita 1:N.
    await setDoc(doc(db, 'negocios', cred.user.uid), {
      propietarioId: cred.user.uid,
      nombre: nombreNegocio,
      categoria: 'Barbería y estética', // alcance fijo del prototipo
      direccion,
      ubicacion: ubicacion || null,
      descripcion,
      canalesContacto: { whatsapp, telefono, catalogo: true }, // RF-11 (≥3 canales)
      horarios: HORARIO_INICIAL, // un bloque por día, ver horarios.js
      fotos: [],
      verificado: false,
      creadoEn: serverTimestamp(),
    })

    setRole('propietario')
    return cred.user
  }

  async function login(correo, contrasena) {
    const cred = await signInWithEmailAndPassword(auth, correo, contrasena)
    const snap = await getDoc(doc(db, 'usuarios', cred.user.uid))
    const rol = snap.exists() ? snap.data().rol : null
    const oscuro = preferenciaDe(snap)
    const oscuroPanel = snap.exists() ? !!snap.data().modoOscuroPanel : false
    setRole(rol)
    setPreferenciaOscuro(oscuro)
    setModoOscuroPanel(oscuroPanel)
    guardarCache(CLAVE_MODO_OSCURO, oscuro)
    guardarCache(CLAVE_MODO_OSCURO_PANEL, oscuroPanel)
    return rol
  }

  /**
   * Inicia sesión con Google (RF-01). Si es la primera vez que esta cuenta
   * de Google entra a MiniBarrio, crea el perfil en "usuarios" con el rol
   * elegido en la pestaña de Login (solo "cliente": un propietario nuevo
   * debe pasar por /registro/negocio porque ese flujo también crea el
   * documento del negocio, que Google no puede completar por nosotros).
   */
  async function loginWithGoogle(rolSeleccionado) {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    const ref = doc(db, 'usuarios', cred.user.uid)
    const snap = await getDoc(ref)

    if (snap.exists()) {
      const rol = snap.data().rol
      setFotoPerfil(snap.data().foto || null)
      const oscuro = preferenciaDe(snap)
      const oscuroPanel = !!snap.data().modoOscuroPanel
      setRole(rol)
      setPreferenciaOscuro(oscuro)
      setModoOscuroPanel(oscuroPanel)
      guardarCache(CLAVE_MODO_OSCURO, oscuro)
      guardarCache(CLAVE_MODO_OSCURO_PANEL, oscuroPanel)
      return rol
    }

    if (rolSeleccionado !== 'cliente') {
      await signOut(auth)
      throw new Error('google-sin-cuenta-propietario')
    }

    await setDoc(ref, {
      rol: 'cliente',
      nombre: cred.user.displayName || '',
      correo: cred.user.email || '',
      telefono: '',
      consentimientoDatos: true, // Ley 1581 de 2012 — ver aviso junto al botón de Google
      creadoEn: serverTimestamp(),
    })
    setRole('cliente')
    return 'cliente'
  }

  /** Guarda (data URL) o quita (null) la foto de perfil de la cuenta. */
  async function actualizarFotoPerfil(foto) {
    await updateDoc(doc(db, 'usuarios', currentUser.uid), { foto: foto || deleteField() })
    setFotoPerfil(foto || null)
  }

  function logout() {
    return signOut(auth)
  }

  const value = {
    currentUser, role, authReady, loading, modoOscuro, actualizarModoOscuro, modoOscuroPanel, actualizarModoOscuroPanel,
    fotoPerfil, actualizarFotoPerfil,
    registerClient, registerBusinessOwner, login, loginWithGoogle, logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
