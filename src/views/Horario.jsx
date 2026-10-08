import { useAppState } from '../store/store'
import { useModal } from '../components/ui.jsx'
import { NoGroups } from '../components/common.jsx'
import { SessModal } from '../modals/CalendarModals.jsx'
import { cvar } from '../lib/model'
import { metaOf, groupOf } from '../lib/grades'
import { todayISO, weekday, DIAS } from '../lib/dates'

export default function Horario() {
  const st = useAppState(), { open } = useModal()
  const meta = metaOf(st.docs), wd = weekday(todayISO())
  return (
    <>
      <div className="top">
        <div><h1>Horario semanal</h1><div className="sub">Tus sesiones fijas de lunes a viernes. Los cambios de un solo día se hacen desde Hoy o Calendario.</div></div>
        <button className="btn primary" onClick={() => open(<SessModal />)}>+ Sesión</button>
      </div>
      {!meta.groups.length ? <NoGroups /> : (
        <div className="tt">{[1, 2, 3, 4, 5].map(d => {
          const ss = meta.schedule.filter(s => s.day === d && groupOf(st.docs, s.groupId)).sort((a, b) => a.start.localeCompare(b.start))
          return (
            <div key={d} className={'tt-col' + (d === wd ? ' today' : '')}>
              <h3>{DIAS[d]}</h3>
              {ss.length ? ss.map(s => {
                const g = groupOf(st.docs, s.groupId)
                return (
                  <button key={s.id} className="sess" style={{ '--c': cvar(g.color) }} onClick={() => open(<SessModal id={s.id} />)}>
                    <span className="h">{s.start}–{s.end}{s.room ? ' · ' + s.room : ''}</span><b>{g.name}</b><span className="muted" style={{ fontSize: '.8rem' }}>{g.subject || ''}</span>
                  </button>
                )
              }) : <span className="faint" style={{ fontSize: '.85rem', padding: 4 }}>Sin sesiones</span>}
              <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => open(<SessModal day={d} />)}>+ Añadir</button>
            </div>
          )
        })}</div>
      )}
    </>
  )
}
