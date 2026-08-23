// Configuración e inicialización de Firebase (Auth + Firestore).
//
// Los valores vienen de variables de entorno (ver .env.example) para que
// nadie suba credenciales reales al repositorio. Cada integrante del equipo
// debe crear su propio archivo .env local con las credenciales del proyecto
// de Firebase compartido (Firebase Console > Configuración del proyecto).

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.apiKey) {
  // Aviso amigable en consola si alguien olvidó crear su .env local.
  // eslint-disable-next-line no-console
  console.warn(
    '[MiniBarrio] Faltan las variables de entorno de Firebase. ' +
    'Copia .env.example a .env y complétalo con los datos del proyecto de Firebase.'
  )
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
