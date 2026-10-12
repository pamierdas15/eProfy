import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { firebaseConfig } from './firebase-config'

export const projectId = firebaseConfig.projectId
export const configured = !!firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith('PEGA')

// En la web publicada, el inicio de sesión con Google pasa por el propio dominio de la app
// (vercel.json reenvía /__/auth a Firebase). Así funciona en móviles y en la app instalada,
// donde los navegadores bloquean el ir y volver entre dominios distintos.
const host = typeof window !== 'undefined' ? window.location.host : ''
const isLocal = !host || /^(localhost|127\.0\.0\.1)(:|$)/.test(host)
export const authDomain = isLocal ? firebaseConfig.authDomain : host

let app = null, auth = null, db = null
if (configured) {
  app = initializeApp({ ...firebaseConfig, authDomain })
  auth = getAuth(app)
  try {
    // Caché en el dispositivo: la app funciona sin conexión y sincroniza al volver la red
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  } catch (e) {
    db = getFirestore(app)
  }
}
export { auth, db }
