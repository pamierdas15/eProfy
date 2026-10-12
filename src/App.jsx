import { useCallback, useEffect, useState } from 'react'
import { NavCtx } from './nav'
import { onAuthStateChanged, getRedirectResult, signOut as fbSignOut } from 'firebase/auth'
import { auth, configured } from './firebase'
import { useAppState, startLocal, startCloud, stopCloud, setPhase, hasPendingWrites, closeSchool } from './store/store'
import { useLayout } from './lib/layout'
import { formatOf } from './lib/model'
import { Icon, useToast, InstallButton } from './components/ui.jsx'
import { Login, Colegios, authMsg } from './views/Acceso.jsx'
import Hoy from './views/Hoy.jsx'
import Grupos from './views/Grupos.jsx'
import Notas from './views/Notas.jsx'
import Asistencia from './views/Asistencia.jsx'
import Horario from './views/Horario.jsx'
import Planificador from './views/Planificador.jsx'
import Ajustes from './views/Ajustes.jsx'

const TAB_LABEL = { hoy: 'Hoy', grupos: 'Grupos', notas: 'Notas', lista: 'Asistencia', horario: 'Horario', planificador: 'Planificador' }
const VIEW_CMP = { hoy: Hoy, grupos: Grupos, notas: Notas, lista: Asistencia, horario: Horario, planificador: Planificador, ajustes: Ajustes }

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

  // Al abrir un colegio se empieza siempre en «Hoy»
  useEffect(() => { if (st.sid) go('hoy') }, [st.sid, go])

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
  if (st.phase === 'schools' || !st.school) return <Colegios onSignOut={signOut} />

  // Pestañas según el formato del colegio (Reducida o Completa). Ajustes va en la rueda dentada.
  const tabs = formatOf(st.school).tabs
  const view = nav.view === 'ajustes' || tabs.includes(nav.view) ? nav.view : 'hoy'
  const View = VIEW_CMP[view]
  return (
    <NavCtx.Provider value={{ ...nav, view, go, signOut, tabs }}>
      <div className="app">
        <aside className="side">
          <div className="brand"><div className="brand-mark">e</div><b>eProfy</b></div>
          <nav className="nav">
            {tabs.map(k => (
              <button key={k} aria-current={view === k ? 'page' : undefined} onClick={() => go(k)}><Icon name={k} /><span>{TAB_LABEL[k]}</span></button>
            ))}
          </nav>
          <SyncStatus st={st} />
        </aside>
        <main>
          <div className="topbar">
            <div className="left">
              <button className="school-switch" onClick={closeSchool} title="Cambiar de colegio">
                <Icon name="colegio" size={18} /><span className="school-name">{st.school.name}</span><span className="tag school-fmt">{formatOf(st.school).label}</span>
              </button>
              <SyncStatus st={st} />
            </div>
            <InstallButton className="btn sm primary tb-install" />
            <div className="seg layout-seg" role="group" aria-label="Formato de pantalla">
              {[['auto', 'Automático'], ['mobile', 'Móvil'], ['desktop', 'PC']].map(([k, l]) => (
                <button key={k} aria-pressed={layout === k} title={'Pantalla ' + l} onClick={() => setLayout(k)}><Icon name={k} size={16} /><span className="lt">{l}</span></button>
              ))}
            </div>
            <button className={'gear' + (view === 'ajustes' ? ' on' : '')} aria-label="Ajustes" title="Ajustes" aria-pressed={view === 'ajustes'} onClick={() => go(view === 'ajustes' ? 'hoy' : 'ajustes')}><Icon name="ajustes" size={20} /></button>
          </div>
          <View key={view + nav.n} params={nav.params} />
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
