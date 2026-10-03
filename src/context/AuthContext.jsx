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
import { doc, serverTimestamp, setDoc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

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

function guardarCache(clave, valor) {
  try {
    localStorage.setItem(clave, valor ? '1' : '0')
  } catch {
    // sin esto no hay atajo síncrono la próxima vez, pero no es crítico
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [role, setRole] = useState(null) // 'cliente' | 'propietario' | null
  const [loading, setLoading] = useState(true)
  // Preferencia de modo oscuro del CLIENTE (persistida en su perfil de
  // Firestore para que se mantenga si inicia sesión de nuevo). Aplica a toda
  // la vitrina y su panel, pero nunca al panel del negocio. Al cerrar sesión
  // vuelve a false: el modo oscuro es de la cuenta, no del navegador.
  const [modoOscuro, setModoOscuro] = useState(() => leerCache(CLAVE_MODO_OSCURO))
  // Preferencia de modo oscuro del PANEL DEL PROPIETARIO — independiente de
  // la anterior: solo afecta a /panel y nunca se filtra al resto del sitio
  // (ver el efecto de tema en App.jsx).
  const [modoOscuroPanel, setModoOscuroPanel] = useState(() => leerCache(CLAVE_MODO_OSCURO_PANEL))

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        const snap = await getDoc(doc(db, 'usuarios', user.uid))
        const oscuro = snap.exists() ? !!snap.data().modoOscuro : false
        const oscuroPanel = snap.exists() ? !!snap.data().modoOscuroPanel : false
        setRole(snap.exists() ? snap.data().rol : null)
        setModoOscuro(oscuro)
        setModoOscuroPanel(oscuroPanel)
        guardarCache(CLAVE_MODO_OSCURO, oscuro)
        guardarCache(CLAVE_MODO_OSCURO_PANEL, oscuroPanel)
      } else {
        setRole(null)
        setModoOscuro(false)
        setModoOscuroPanel(false)
        guardarCache(CLAVE_MODO_OSCURO, false)
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
    setModoOscuro(valor)
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
      horarios: {
        lunesAViernes: { apertura: '09:00', cierre: '20:00' },
        sabado: { apertura: '08:00', cierre: '21:00' },
        domingo: { activo: false, apertura: '09:00', cierre: '16:00' },
        festivos: { activo: false, apertura: '09:00', cierre: '16:00' },
      },
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
    const oscuro = snap.exists() ? !!snap.data().modoOscuro : false
    const oscuroPanel = snap.exists() ? !!snap.data().modoOscuroPanel : false
    setRole(rol)
    setModoOscuro(oscuro)
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
      const oscuro = !!snap.data().modoOscuro
      const oscuroPanel = !!snap.data().modoOscuroPanel
      setRole(rol)
      setModoOscuro(oscuro)
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

  function logout() {
    return signOut(auth)
  }

  const value = {
    currentUser, role, loading, modoOscuro, actualizarModoOscuro, modoOscuroPanel, actualizarModoOscuroPanel,
    registerClient, registerBusinessOwner, login, loginWithGoogle, logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
