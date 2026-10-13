// Configuración e inicialización de Firebase (Auth + Firestore).
//
// Los valores vienen de variables de entorno (ver .env.example) para que
// nadie suba credenciales reales al repositorio. Cada integrante del equipo
// debe crear su propio archivo .env local con las credenciales del proyecto
// de Firebase compartido (Firebase Console > Configuración del proyecto).

import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

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
// Correos de Firebase Auth (p. ej. recuperar contraseña) y ventanas de
// Google en español.
auth.languageCode = 'es'
// Caché local de Firestore (IndexedDB): en la segunda visita la vitrina, el
// mapa y los paneles pintan al instante con la última copia guardada y luego
// se actualizan solos con los datos del servidor (onSnapshot dispara dos
// veces). Compartida entre pestañas abiertas. Si el navegador no permite
// IndexedDB (p. ej. algunas ventanas privadas), Firestore sigue funcionando
// sin caché.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
