import { useAppState, replaceAll } from '../store/store'
import * as act from '../store/actions'
import { useNav } from '../nav'
import { useModal, useToast, Confirm } from '../components/ui.jsx'
import { ExcelModal } from '../modals/CalendarModals.jsx'
import { loadSample } from '../lib/sample'
import { exportJson } from '../lib/excel'
import { metaOf, trimOf } from '../lib/grades'
import { todayISO, fmtLong } from '../lib/dates'
import { APP_VERSION } from '../lib/model'

export default function Ajustes() {
  const st = useAppState(), { signOut } = useNav(), { open } = useModal(), toast = useToast()
  const meta = metaOf(st.docs), T = meta.settings.trims
  const who = st.user ? (st.user.email || st.user.name || 'tu cuenta') : ''

  const saveTrims = e => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const trims = [0, 1, 2].map(i => ({ start: fd.get('s' + i), end: fd.get('e' + i) }))
    if (trims.some(x => !x.start || !x.end || x.end < x.start)) { toast('Revisa las fechas: cada fin debe ser posterior a su inicio'); return }
    act.setTrims(trims); toast('Trimestres guardados · hoy es el ' + trimOf({ settings: { trims } }, todayISO()) + '.º trimestre')
  }
  const doExport = () => { toast('Copia descargada: ' + exportJson(st.docs)); act.markBackup() }
  const doImport = e => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      let o
      try { o = JSON.parse(r.result) } catch (x) { o = null }
      if (!o || !o.docs || !o.docs.meta) { toast('El archivo no es una copia válida de eProfy'); return }
      open(<Confirm title="Importar copia" label="Importar" message={'Los datos actuales se sustituirán por los de la copia' + (o.exported ? ' del ' + fmtLong(o.exported.slice(0, 10)) : '') + '. Podrás deshacerlo justo después.'}
        onYes={() => toast('Copia importada', replaceAll(o.docs))} />)
    }
    r.readAsText(f)
  }

  return (
    <>
      <div className="top"><div><h1>Ajustes</h1><div className="sub">Curso, trimestres, cuenta y copias de seguridad · eProfy {APP_VERSION}</div></div></div>
      <div className="grid2">
        <div className="panel">
          <h2 style={{ marginBottom: 12 }}>Trimestres</h2>
          <form className="stack" onSubmit={saveTrims} key={JSON.stringify(T)}>
            {T.map((t, i) => (
              <div className="frow" key={i}>
                <div className="fld"><label htmlFor={'ts' + i}>{i + 1}.º inicio</label><input type="date" id={'ts' + i} name={'s' + i} defaultValue={t.start} /></div>
                <div className="fld"><label htmlFor={'te' + i}>{i + 1}.º fin</label><input type="date" id={'te' + i} name={'e' + i} defaultValue={t.end} /></div>
              </div>
            ))}
            <div><button className="btn primary">Guardar trimestres</button></div>
          </form>
          <p className="legend">Las actividades nuevas se asignan al trimestre según su fecha. Los festivos y vacaciones se añaden en Calendario → Bloquear días.</p>
        </div>
        <div className="stack">
          <div className="panel">
            <h2 style={{ marginBottom: 8 }}>Cuenta y sincronización</h2>
            <p className="muted" style={{ margin: '0 0 12px' }}>
              {st.user ? <>Has entrado como <b>{who}</b>. Tus datos se guardan en tu base de datos de Firebase y se sincronizan entre todos los dispositivos donde entres con esta cuenta. Sin conexión puedes seguir trabajando: los cambios se envían al volver la red.</>
                : 'Estás usando eProfy sin cuenta: los datos solo se guardan en este navegador. Entra con una cuenta para sincronizarlos entre el móvil y el portátil; lo que tengas aquí se subirá la primera vez.'}
            </p>
            <button className="btn" onClick={signOut}>{st.user ? 'Cerrar sesión' : 'Entrar con una cuenta'}</button>
          </div>
          <div className="panel">
            <h2 style={{ marginBottom: 8 }}>Copia de seguridad</h2>
            <p className="muted" style={{ margin: '0 0 12px' }}>{meta.settings.lastBackup ? 'Última copia: ' + fmtLong(meta.settings.lastBackup) + '.' : 'Aún no has hecho ninguna copia.'}</p>
            <div className="row">
              <button className="btn primary" onClick={doExport}>Exportar copia (JSON)</button>
              <button className="btn" onClick={() => open(<ExcelModal />)}>Exportar notas a Excel</button>
              <label className="btn" htmlFor="importFile">Importar copia</label>
              <input type="file" id="importFile" accept="application/json,.json" hidden onChange={doImport} />
            </div>
            <p className="legend">La copia JSON guarda todo y sirve para restaurar la app. El Excel es para las sesiones de evaluación y para pasar notas a Plumier.</p>
          </div>
          <div className="panel">
            <h2 style={{ marginBottom: 12 }}>Datos</h2>
            <div className="row">
              <button className="btn" onClick={() => toast('Grupos de ejemplo añadidos', loadSample())}>Añadir grupos de ejemplo</button>
              <button className="btn danger" onClick={() => open(<Confirm title="Borrar todos los datos" label="Borrar todo"
                message="Se borrarán todos los grupos, notas, asistencia, eventos, días no lectivos y el horario, en todos tus dispositivos. Podrás deshacerlo justo después, pero conviene exportar antes una copia."
                onYes={() => toast('Datos borrados', act.wipeAll())} />)}>Borrar todos los datos</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
