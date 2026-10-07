// Configuración e inicialización de Firebase (Auth + Firestore).
//
// Los valores vienen de variables de entorno (ver .env.example) para que
// nadie suba credenciales reales al repositorio. Cada integrante del equipo
// debe crear su propio archivo .env local con las credenciales del proyecto
// de Firebase compartido (Firebase Console > Configuración del proyecto).

import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
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

// Firebase App Check con reCAPTCHA Enterprise (invisible): cada petición a
// Firebase lleva una prueba de que viene de esta app en un navegador real.
// Con "Aplicar" (Enforce) activado en la consola de Firebase, Firestore
// rechaza lo que llegue de scripts — p. ej. registros masivos de negocios
// falsos. La clave de sitio es pública por diseño.
initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('6Let9-ItAAAAACMB0VDImi72Pn7rMCDT1Bz8HSl7'),
  isTokenAutoRefreshEnabled: true,
})

export const auth = getAuth(app)
export const db = getFirestore(app)
