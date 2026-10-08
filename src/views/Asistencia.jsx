import { useState } from 'react'
import { useAppState } from '../store/store'
import * as act from '../store/actions'
import { useModal, useToast, GroupChips } from '../components/ui.jsx'
import { NoGroups } from '../components/common.jsx'
import { ObsModal } from '../modals/GroupModals.jsx'
import { ATT, BLOCK_TYPES } from '../lib/model'
import { metaOf, groupDoc, attDoc, groupOf, trimOf, sortedStudents, sname, attCounts } from '../lib/grades'
import { blockedOn, classesOn } from '../lib/schedule'
import { todayISO, fmtLong, weekday } from '../lib/dates'

export default function Asistencia({ params }) {
  const st = useAppState(), { open } = useModal(), toast = useToast()
  const meta = metaOf(st.docs)
  const [date, setDate] = useState(params.date || todayISO())
  const firstToday = () => { const c = classesOn(meta, date).find(x => !x.cancelled); return c ? c.groupId : (meta.groups[0] && meta.groups[0].id) }
  const [gid, setGid] = useState(params.gid || firstToday)
  const [force, setForce] = useState(false)

  const head = (
    <div className="top">
      <div><h1>Asistencia</h1><div className="sub">{fmtLong(date)}</div></div>
      <input type="date" className="inp" style={{ width: 'auto' }} value={date} aria-label="Fecha" onChange={e => { setDate(e.target.value || todayISO()); setForce(false) }} />
    </div>
  )
  if (!meta.groups.length) return <>{head}<NoGroups /></>
  const g = groupOf(st.docs, gid) || meta.groups[0]
  const gd = groupDoc(st.docs, g.id), A = attDoc(st.docs, g.id), day = A.att[date] || {}
  const sts = sortedStudents(gd), tr = trimOf(meta, date)
  const sum = { P: 0, F: 0, R: 0, J: 0 }; sts.forEach(s => { if (day[s.id]) sum[day[s.id]]++ })
  const blk = blockedOn(meta, date)
  const hasClass = classesOn(meta, date).some(c => c.groupId === g.id && !c.cancelled)
  const todays = blk ? [] : classesOn(meta, date).filter(c => !c.cancelled)

  return (
    <>
      {head}
      <div className="stack">
        <GroupChips groups={meta.groups} value={g.id} onChange={setGid} />
        {todays.length ? <div className="legend" style={{ marginTop: 0 }}>Clases este día: {todays.map(c => (groupOf(st.docs, c.groupId) || {}).name + ' (' + c.start + ')').join(' · ')}</div> : null}
        {blk && !force ? (
          <div className="blocked-banner">
            <div className="grow"><b>{BLOCK_TYPES[blk.type].label}{blk.note ? ': ' + blk.note : ''}</b><span className="muted" style={{ fontSize: '.88rem' }}>Es un día no lectivo: no hace falta pasar lista.</span></div>
            <button className="btn sm" onClick={() => setForce(true)}>Pasar lista igualmente</button>
          </div>
        ) : (
          <div className="panel">
            <div className="panel-h">
              <div className="row"><span className="tag ok">P {sum.P}</span><span className="tag warn">F {sum.F}</span><span className="tag amber">R {sum.R}</span><span className="tag">J {sum.J}</span></div>
              <div className="row">
                <button className="btn sm" onClick={() => act.allPresent(g.id, date)}>Todos presentes</button>
                {Object.keys(day).length ? <button className="btn sm ghost" onClick={() => toast('Lista del día borrada', act.clearAtt(g.id, date))}>Borrar día</button> : null}
              </div>
            </div>
            {!hasClass && weekday(date) <= 5 && meta.schedule.length ? <p className="legend" style={{ marginTop: 0 }}>Este grupo no tiene clase este día según tu horario.</p> : null}
            {sts.length ? sts.map(s => {
              const v = day[s.id] || '', c = attCounts(meta, A, s.id, tr)
              return (
                <div className="att-row" key={s.id}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{sname(s)}</div>
                    <div className="counts">{tr}.º T: F {c.F} · R {c.R} · J {c.J} <button className="btn ghost sm" style={{ padding: '0 6px' }} onClick={() => open(<ObsModal gid={g.id} sid={s.id} date={date} />)}>+ anotación</button></div>
                  </div>
                  <div className="pfr">{Object.keys(ATT).map(k => (
                    <button key={k} data-v={k} aria-pressed={v === k} title={ATT[k]} aria-label={ATT[k] + ' — ' + sname(s)} onClick={() => act.setAtt(g.id, date, s.id, v === k ? null : k)}>{k}</button>
                  ))}</div>
                </div>
              )
            }) : <p className="muted">Este grupo no tiene alumnos.</p>}
          </div>
        )}
        <div className="legend">P presente · F falta · R retraso · J falta justificada. Pulsa de nuevo para desmarcar.</div>
      </div>
    </>
  )
}
