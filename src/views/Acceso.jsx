import { useState } from 'react'
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth, configured } from '../firebase'
import { isStandalone } from '../lib/layout'

// Pantallas de entrada: acceso (Login) y elección de colegio (Colegios).
import { useToast, useModal, Modal, Field, Confirm, InstallButton } from '../components/ui.jsx'
import { useAppState, addSchool, updateSchool, deleteSchool, openSchool } from '../store/store'
import { FORMATS, formatOf } from '../lib/model'
import { fmtLong } from '../lib/dates'

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
  'auth/cancelled-popup-request': 'Se ha cancelado la ventana de Google. Vuelve a intentarlo.',
  'auth/web-storage-unsupported': 'El navegador bloquea el almacenamiento necesario para entrar. Desactiva el modo privado o usa Chrome o Safari.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase: añádelo en Authentication → Configuración → Dominios autorizados (por ejemplo, tu-app.vercel.app).',
  'auth/configuration-not-found': 'El inicio de sesión no está activado: en Firebase ve a Authentication → Comenzar y activa Correo electrónico/contraseña y Google.',
  'auth/invalid-api-key': 'La apiKey de src/firebase-config.js no es válida: cópiala de nuevo desde la consola de Firebase.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'La apiKey de src/firebase-config.js no es válida: cópiala de nuevo desde la consola de Firebase.',
  'auth/operation-not-allowed': 'Este método de acceso no está activado: en Firebase ve a Authentication → Método de acceso y actívalo.'
}
export const authMsg = e => AUTH_ERR[e && e.code] || ('No se pudo entrar' + (e && e.code ? ' (' + e.code + ')' : '') + '.')

export function Login({ error, onError, onLocal }) {
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
    p.setCustomParameters({ prompt: 'select_account' })
    // En el móvil y en la app instalada, las ventanas emergentes fallan sin avisar: se usa redirección
    if (isStandalone() || /android|iphone|ipad|ipod|mobi/i.test(navigator.userAgent)) { await signInWithRedirect(auth, p); return }
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
          <>
            <button type="button" className="btn primary" onClick={onLocal}>Empezar a usar eProfy</button>
            <InstallButton className="btn" label="Instalar como app" />
            <div className="setup">
              <b>La sincronización entre dispositivos aún no está activada.</b> Puedes usar eProfy ya en este dispositivo: cuando se active, lo que tengas aquí se subirá solo.
              <br /><span className="muted">Para activarla hay que pegar los datos de tu proyecto de Firebase en <b>src/firebase-config.js</b> (ver README).</span>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={google} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
              {busy ? 'Abriendo Google…' : 'Continuar con Google'}
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
        {configured ? <>
          <button type="button" className="linkbtn" onClick={onLocal}>Usar sin cuenta (solo en este dispositivo)</button>
          <InstallButton className="btn" label="Instalar como app" />
        </> : null}
      </form>
    </div>
  )
}

/* ---------- colegios ---------- */
export function Colegios({ onSignOut }) {
  const st = useAppState(), { open } = useModal(), toast = useToast()
  const count = sid => Object.keys(st.raw).filter(k => k.startsWith(sid + '.g_')).length
  const who = st.user ? (st.user.email || st.user.name) : 'Sin cuenta: solo en este dispositivo'
  return (
    <div className="schools-wrap">
      <div className="schools-head">
        <div className="brand"><div className="brand-mark">e</div><b>eProfy</b></div>
        <div className="row"><span className="muted" style={{ fontSize: '.85rem' }}>{who}</span><button className="btn sm ghost" onClick={onSignOut}>{st.user ? 'Cerrar sesión' : 'Salir'}</button></div>
      </div>
      <div className="top">
        <div><h1>Tus colegios</h1><div className="sub">Elige el centro con el que vas a trabajar. Cada uno tiene sus propios grupos, horario y tareas.</div></div>
        <button className="btn primary" onClick={() => open(<SchoolModal onCreated={id => openSchool(id)} />)}>+ Nuevo colegio</button>
      </div>
      {st.mode === 'connecting' && !st.schools.length ? <p className="muted">Cargando tus colegios…</p> : !st.schools.length ? (
        <div className="empty">
          <h2>Todavía no tienes ningún colegio</h2>
          <p>Crea el primero: le pondrás nombre y elegirás si quieres la versión Reducida o la Completa de la app.</p>
          <div className="row"><button className="btn primary" onClick={() => open(<SchoolModal onCreated={id => openSchool(id)} />)}>Crear colegio</button></div>
        </div>
      ) : (
        <div className="gcards">{st.schools.map(s => (
          <div key={s.id} className="gcard school-card">
            <button className="school-open" onClick={() => openSchool(s.id)} aria-label={'Abrir ' + s.name}>
              <div><h2>{s.name}</h2><div className="muted" style={{ fontSize: '.88rem' }}>Desde el {fmtLong(s.created)}</div></div>
              <div className="row"><span className={'tag ' + (s.format === 'reducida' ? '' : 'ok')}>{formatOf(s).label}</span><span className="tag">{count(s.id)} grupo{count(s.id) === 1 ? '' : 's'}</span></div>
            </button>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn sm ghost" onClick={() => open(<SchoolModal sid={s.id} />)}>Editar</button>
              <button className="btn sm ghost danger-txt" onClick={() => open(<Confirm title="Eliminar colegio" message={'Se borrará «' + s.name + '» con todos sus grupos, notas, horario y tareas, en todos tus dispositivos. Podrás deshacerlo justo después.'} label="Eliminar colegio" onYes={() => toast('Colegio eliminado', deleteSchool(s.id))} />)}>Eliminar</button>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  )
}

/** Crear o editar un colegio (nombre y formato de la app). */
export function SchoolModal({ sid, onCreated }) {
  const st = useAppState(), toast = useToast()
  const s = sid ? st.schools.find(x => x.id === sid) : { name: '', format: '' }
  const [format, setFormat] = useState(s ? s.format : '')
  if (!s) return null
  return (
    <Modal title={sid ? 'Editar colegio' : 'Nuevo colegio'} wide submitLabel={sid ? 'Guardar' : 'Crear colegio'} onSubmit={fd => {
      const name = fd.get('name').trim()
      if (!name) { toast('Escribe el nombre del colegio'); return false }
      if (!format) { toast('Elige el formato de la app: Reducida o Completa'); return false }
      if (sid) { updateSchool(sid, { name, format }); toast('Colegio actualizado') }
      else { const id = addSchool({ name, format }); onCreated && onCreated(id) }
    }}>
      <Field label="Nombre del colegio" id="f_school"><input id="f_school" name="name" defaultValue={s.name} placeholder="IES Isaac Peral" /></Field>
      <div className="fld"><span className="lb">Formato de la app</span>
        <div className="format-pick" role="radiogroup" aria-label="Formato de la app">
          {Object.entries(FORMATS).map(([k, f]) => (
            <button type="button" key={k} role="radio" aria-checked={format === k} className="format-opt" onClick={() => setFormat(k)}>
              <span className="format-title">{f.label}</span>
              <span className="format-desc">{f.desc}</span>
              <ul>{f.points.map(p => <li key={p}>{p}</li>)}</ul>
            </button>
          ))}
        </div>
        {sid ? <span className="hint">Puedes cambiar el formato cuando quieras: los datos no se pierden, solo se muestran u ocultan pestañas.</span> : null}
      </div>
    </Modal>
  )
}
