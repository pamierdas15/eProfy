import { useAppState } from '../store/store'
import { useModal, Hero } from '../components/ui.jsx'
import { SessModal } from '../modals/CalendarModals.jsx'
import { cvar, SESSION_TYPES, sessType } from '../lib/model'
import { metaOf, groupOf } from '../lib/grades'
import { sessLabel } from '../lib/schedule'
import { todayISO, weekday, DIAS, DIAS_CORTOS } from '../lib/dates'

// Pestaña Horario: «Horario semanal» (cuadrícula por hora y día) y «Configurador» (lista para editar sesiones).

const colorOf = (meta, s) => {
  const type = sessType(s)
  if (type === 'clase') { const g = meta.groups.find(x => x.id === s.groupId); return g ? cvar(g.color) : 'var(--ink-3)' }
  return SESSION_TYPES[type].color
}

export default function Horario() {
  const st = useAppState(), { open } = useModal()
  const meta = metaOf(st.docs), wd = weekday(todayISO())
  const sched = meta.schedule.filter(s => sessType(s) !== 'clase' || groupOf(st.docs, s.groupId))
  const count = t => sched.filter(s => sessType(s) === t).length
  const summary = sched.length
    ? [count('clase') + ' clases', ...['guardia', 'tutoria', 'reunion', 'libre'].filter(count).map(t => count(t) + ' ' + SESSION_TYPES[t].label.toLowerCase() + (count(t) === 1 ? '' : t === 'reunion' ? 'es' : 's'))].join(' · ')
    : 'Todavía no hay sesiones'

  // Franjas horarias: cada par inicio–fin distinto es una fila
  const slots = [...new Map(sched.map(s => [s.start + '-' + s.end, { start: s.start, end: s.end }])).values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))

  return (
    <>
      <div className="top">
        <div><h1>Horario</h1><div className="sub">Tu semana tipo: clases, guardias, tutorías, reuniones y horas libres. Los cambios de un solo día se hacen desde Hoy.</div></div>
        <button className="btn primary" onClick={() => open(<SessModal />)}>+ Sesión</button>
      </div>
      <div className="stack" style={{ gap: 16 }}>
        <Hero title="Horario semanal" sub={summary} actions={<button className="btn sm" onClick={() => open(<SessModal />)}>+ Sesión</button>}>
          {!slots.length ? <p className="muted" style={{ margin: 0 }}>Añade sesiones con «+ Sesión» o desde el Configurador y aquí verás toda la semana de un vistazo.</p> : (
            <div className="tt-scroll">
              <table className="tt-grid">
                <thead><tr><th className="tt-h">Hora</th>{[1, 2, 3, 4, 5].map(d => <th key={d} className={d === wd ? 'today' : ''}>{DIAS_CORTOS[d]}</th>)}</tr></thead>
                <tbody>{slots.map(sl => (
                  <tr key={sl.start + sl.end}>
                    <th className="tt-h num">{sl.start}<br /><span className="faint">{sl.end}</span></th>
                    {[1, 2, 3, 4, 5].map(d => {
                      const here = sched.filter(s => s.day === d && s.start === sl.start && s.end === sl.end)
                      return (
                        <td key={d} className={d === wd ? 'today' : ''}>
                          {here.length ? here.map(s => (
                            <button key={s.id} className={'tt-cell' + (sessType(s) === 'libre' ? ' libre' : '')} style={{ '--c': colorOf(meta, s) }} onClick={() => open(<SessModal id={s.id} />)} title={sessLabel(meta, s) + (s.room ? ' · ' + s.room : '')}>
                              <b>{sessLabel(meta, s)}</b>{s.room ? <span>{s.room}</span> : null}
                            </button>
                          )) : <button className="tt-empty" aria-label={'Añadir sesión el ' + DIAS[d] + ' a las ' + sl.start} onClick={() => open(<SessModal day={d} start={sl.start} end={sl.end} />)}>+</button>}
                        </td>
                      )
                    })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className="legend">{Object.entries(SESSION_TYPES).map(([k, t]) => <span key={k} className="row" style={{ gap: 5 }}><span className="gdot" style={{ '--c': t.color || 'var(--accent)' }} />{t.label}{k === 'clase' ? ' (color del grupo)' : ''}</span>)}</div>
        </Hero>

        <Hero title="Configurador" sub="Añade, cambia o borra las sesiones de cada día" actions={<button className="btn sm" onClick={() => open(<SessModal />)}>+ Sesión</button>}>
          <div className="tt">{[1, 2, 3, 4, 5].map(d => {
            const ss = sched.filter(s => s.day === d).sort((a, b) => a.start.localeCompare(b.start))
            return (
              <div key={d} className={'tt-col' + (d === wd ? ' today' : '')}>
                <h3>{DIAS[d]}</h3>
                {ss.length ? ss.map(s => {
                  const g = groupOf(st.docs, s.groupId), type = sessType(s)
                  return (
                    <button key={s.id} className="sess" style={{ '--c': colorOf(meta, s) }} onClick={() => open(<SessModal id={s.id} />)}>
                      <span className="h">{s.start}–{s.end}{s.room ? ' · ' + s.room : ''}</span>
                      <b>{sessLabel(meta, s)}</b>
                      <span className="muted" style={{ fontSize: '.8rem' }}>{type === 'clase' ? (g && g.subject) || '' : s.note || SESSION_TYPES[type].label}</span>
                    </button>
                  )
                }) : <span className="faint" style={{ fontSize: '.85rem', padding: 4 }}>Sin sesiones</span>}
                <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => open(<SessModal day={d} />)}>+ Añadir</button>
              </div>
            )
          })}</div>
        </Hero>
      </div>
    </>
  )
}
