import { useCallback, useEffect, useState } from 'react'
import { NavCtx } from './nav'
import { onAuthStateChanged, getRedirectResult, signOut as fbSignOut } from 'firebase/auth'
import { auth, configured } from './firebase'
import { useAppState, startLocal, startCloud, stopCloud, setPhase, hasPendingWrites } from './store/store'
import { useLayout } from './lib/layout'
import { Icon, useToast, InstallButton } from './components/ui.jsx'
import Login, { authMsg } from './views/Login.jsx'
import Hoy from './views/Hoy.jsx'
import Grupos from './views/Grupos.jsx'
import Asistencia from './views/Asistencia.jsx'
import Entregas from './views/Entregas.jsx'
import Calendario from './views/Calendario.jsx'
import Horario from './views/Horario.jsx'
import Ajustes from './views/Ajustes.jsx'

export const VIEWS = [['hoy', 'Hoy'], ['grupos', 'Grupos'], ['lista', 'Asistencia'], ['entregas', 'Entregas'], ['calendario', 'Calendario'], ['horario', 'Horario'], ['ajustes', 'Ajustes']]
const VIEW_CMP = { hoy: Hoy, grupos: Grupos, lista: Asistencia, entregas: Entregas, calendario: Calendario, horario: Horario, ajustes: Ajustes }


const LOCAL_KEY = 'eprofy.localMode'
const readView = () => { try { const v = localStorage.getItem('eprofy.view'); return VIEW_CMP[v] ? v : 'hoy' } catch (e) { return 'hoy' } }

export default function App() {
  const st = useAppState()
  const toast = useToast()
  const [authErr, setAuthErr] = useState('')
  const [nav, setNav] = useState({ view: readView(), params: {}, n: 0 })

  const go = useCallback((view, params) => {
    setNav(n => ({ view, params: params || {}, n: n.n + 1 }))
    try { localStorage.setItem('eprofy.view', view) } catch (e) { /* */ }
    window.scrollTo(0, 0)
  }, [])

  // ---- acceso ----
  useEffect(() => {
    let localPref = false
    try { localPref = localStorage.getItem(LOCAL_KEY) === '1' } catch (e) { /* */ }
    if (!configured) { if (localPref) startLocal(); else setPhase('auth'); return }
    getRedirectResult(auth).catch(e => setAuthErr(authMsg(e)))
    return onAuthStateChanged(auth, user => {
      if (user) { try { localStorage.removeItem(LOCAL_KEY) } catch (e) { /* */ } startCloud(user) }
      else if (localPref) { localPref = false; startLocal() }
      else { stopCloud(); setPhase('auth') }
    })
  }, [])

  const useLocal = () => { try { localStorage.setItem(LOCAL_KEY, '1') } catch (e) { /* */ } startLocal() }
  const signOut = async () => {
    if (st.mode === 'cloud' && hasPendingWrites()) { toast('Espera a que terminen de guardarse los cambios'); return }
    try { localStorage.removeItem(LOCAL_KEY) } catch (e) { /* */ }
    if (configured && st.user) await fbSignOut(auth)
    else { stopCloud(); setPhase('auth') }
  }

  const [layout, setLayout] = useLayout()

  if (st.phase === 'loading') return <div className="auth"><div className="brand"><div className="brand-mark">e</div><b>eProfy</b></div></div>
  if (st.phase === 'auth') return <Login error={authErr} onError={setAuthErr} onLocal={useLocal} />

  const View = VIEW_CMP[nav.view] || Hoy
  return (
    <NavCtx.Provider value={{ ...nav, go, signOut }}>
      <div className="app">
        <aside className="side">
          <div className="brand"><div className="brand-mark">e</div><b>eProfy</b></div>
          <nav className="nav">
            {VIEWS.map(([k, l]) => (
              <button key={k} aria-current={nav.view === k ? 'page' : undefined} onClick={() => go(k)}><Icon name={k} /><span>{l}</span></button>
            ))}
          </nav>
          <SyncStatus st={st} />
        </aside>
        <main>
          <div className="topbar">
            <div className="left"><div className="brand"><div className="brand-mark">e</div><b>eProfy</b></div><SyncStatus st={st} /></div>
            <InstallButton className="btn sm primary tb-install" />
            <div className="seg layout-seg" role="group" aria-label="Formato de la app">
              {[['auto', 'Automático'], ['mobile', 'Móvil'], ['desktop', 'PC']].map(([k, l]) => (
                <button key={k} aria-pressed={layout === k} title={'Formato ' + l} onClick={() => setLayout(k)}><Icon name={k} size={16} /><span className="lt">{l}</span></button>
              ))}
            </div>
          </div>
          <View key={nav.view + nav.n} params={nav.params} />
        </main>
      </div>
    </NavCtx.Provider>
  )
}

function SyncStatus({ st }) {
  let s, t
  if (st.err) { s = 'error'; t = st.err }
  else if (st.mode === 'connecting') { s = 'saving'; t = 'Conectando…' }
  else if (st.mode !== 'cloud') { s = 'local'; t = 'Solo en este dispositivo' }
  else if (!st.online) { s = 'saving'; t = 'Sin conexión · se sincronizará' }
  else if (st.pending) { s = 'saving'; t = 'Guardando…' }
  else { s = 'ok'; t = 'Sincronizado' }
  return <div className="sync" data-s={s} title={t}><span className="dot" /><span className="stx">{t}</span></div>
}
