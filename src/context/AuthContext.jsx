// Contexto de autenticación y rol de usuario.
//
// Cubre RF-01 (registro/autenticación de dos tipos de usuario: cliente y
// propietario de negocio) del documento de requerimientos. El rol se guarda
// en Firestore (colección "usuarios") junto con el perfil, no solo en Auth,
// para poder consultarlo y usarlo en las reglas de seguridad de Firestore.

import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [role, setRole] = useState(null) // 'cliente' | 'propietario' | null
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        const snap = await getDoc(doc(db, 'usuarios', user.uid))
        setRole(snap.exists() ? snap.data().rol : null)
      } else {
        setRole(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

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
      descripcion,
      canalesContacto: { whatsapp, telefono, catalogo: true }, // RF-11 (≥3 canales)
      horarios: {
        lunesAViernes: { apertura: '09:00', cierre: '20:00' },
        sabado: { apertura: '08:00', cierre: '21:00' },
        domingoFestivos: { apertura: '09:00', cierre: '16:00' },
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
    setRole(rol)
    return rol
  }

  function logout() {
    return signOut(auth)
  }

  const value = { currentUser, role, loading, registerClient, registerBusinessOwner, login, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
