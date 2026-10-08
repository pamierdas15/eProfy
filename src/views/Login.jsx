import { useState } from 'react'
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth, configured } from '../firebase'
import { useToast } from '../components/ui.jsx'

const AUTH_ERR = {
  'auth/invalid-email': 'El correo no tiene un formato válido.',
  'auth/missing-password': 'Escribe la contraseña.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Entra con tu contraseña.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No hay ninguna cuenta con ese correo. Pulsa «Crear cuenta».',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'No hay conexión a internet.',
  'auth/popup-closed-by-user': 'Has cerrado la ventana de Google antes de terminar.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).',
  'auth/operation-not-allowed': 'Este método de acceso no está activado en Firebase.'
}
export const authMsg = e => AUTH_ERR[e && e.code] || ('No se pudo entrar' + (e && e.code ? ' (' + e.code + ')' : '') + '.')

export default function Login({ error, onError, onLocal }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn) {
    setBusy(true); onError('')
    try { await fn() } catch (e) { onError(authMsg(e)) } finally { setBusy(false) }
  }
  const google = () => run(async () => {
    const p = new GoogleAuthProvider()
    try { await signInWithPopup(auth, p) }
    catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) await signInWithRedirect(auth, p)
      else throw e
    }
  })
  const submit = mode => e => {
    e.preventDefault()
    run(() => mode === 'up' ? createUserWithEmailAndPassword(auth, email.trim(), pass) : signInWithEmailAndPassword(auth, email.trim(), pass))
  }
  const reset = () => {
    if (!email.trim()) { onError('Escribe tu correo y vuelve a pulsar «He olvidado la contraseña».'); return }
    run(async () => { await sendPasswordResetEmail(auth, email.trim()); toast('Te hemos enviado un correo para cambiar la contraseña') })
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit('in')} noValidate>
        <div className="brand"><div className="brand-mark">e</div><b>eProfy</b></div>
        <p>Tu cuaderno de clase: notas por criterios, asistencia, entregas, calendario y horario.</p>
        {!configured ? (
          <div className="setup">Falta conectar la base de datos. Rellena <b>src/firebase-config.js</b> siguiendo el LEEME. Mientras tanto puedes usar la app solo en este dispositivo.</div>
        ) : (
          <>
            <button type="button" className="btn" onClick={google} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
              Continuar con Google
            </button>
            <div className="or">o con tu correo</div>
            <div className="fld"><label htmlFor="au_email">Correo</label><input id="au_email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="fld"><label htmlFor="au_pass">Contraseña</label><input id="au_pass" type="password" autoComplete="current-password" value={pass} onChange={e => setPass(e.target.value)} /></div>
            {error ? <div className="auth-err" role="alert">{error}</div> : null}
            <div className="frow">
              <button className="btn primary" type="submit" disabled={busy}>Entrar</button>
              <button className="btn" type="button" onClick={submit('up')} disabled={busy}>Crear cuenta</button>
            </div>
            <button type="button" className="linkbtn" onClick={reset}>He olvidado la contraseña</button>
            <div className="or">o</div>
          </>
        )}
        <button type="button" className="linkbtn" onClick={onLocal}>Usar sin cuenta (solo en este dispositivo)</button>
      </form>
    </div>
  )
}
