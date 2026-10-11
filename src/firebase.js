import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { firebaseConfig } from './firebase-config'

export const projectId = firebaseConfig.projectId
export const configured = !!firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith('PEGA')

let app = null, auth = null, db = null
if (configured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  try {
    // Caché en el dispositivo: la app funciona sin conexión y sincroniza al volver la red
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  } catch (e) {
    db = getFirestore(app)
  }
}
export { auth, db }
