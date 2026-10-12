import { useState } from 'react'
import { useAppState } from '../store/store'
import { useNav } from '../nav'
import { useModal } from '../components/ui.jsx'
import { ClassCard } from '../components/ClassCard.jsx'
import { NoGroups, AgendaItem } from '../components/common.jsx'
import { PlanModal } from '../modals/ActModal.jsx'
import { AddModal, ClassModal, BlockModal, ExcelModal } from '../modals/CalendarModals.jsx'
import { metaOf, groupDoc, trimOf } from '../lib/grades'
import { classesOn, blockedOn, agenda, actKind, taskStatus } from '../lib/schedule'
import { cvar, BLOCK_TYPES, isFull } from '../lib/model'
import { todayISO, addDays, diffDays, weekday, mondayOf, parseISO, DIAS, DIAS_CORTOS, MESES, fmtDay, fmtRange } from '../lib/dates'
import { exportJson } from '../lib/excel'
import * as act from '../store/actions'

function backupDue(meta) {
  const s = meta.settings, t = todayISO()
  if (!meta.groups.length) return null
  let snooze = ''; try { snooze = localStorage.getItem('eprofy.backupSnooze') || '' } catch (e) { /* */ }
  if (snooze && snooze > t) return null
  if (s.lastBackup) { const d = diffDays(s.lastBackup, t); return d > 30 ? d : null }
  if (!s.since) return null
  return diffDays(s.since, t) >= 14 ? -1 : null
}

export default function Hoy({ params }) {
  const st = useAppState(), { go } = useNav(), { open } = useModal()
  const meta = metaOf(st.docs), t = todayISO()
  const [sel, setSel] = useState(params.date || t)
  const [, force] = useState(0)

  const d = parseISO(sel)
  const head = (
    <div className="top">
      <div>
        <div className="label">{trimOf(meta, sel)}.º trimestre{sel !== t ? ' · ' + (diffDays(t, sel) > 0 ? 'dentro de ' + diffDays(t, sel) + ' d' : 'hace ' + diffDays(sel, t) + ' d') : ''}</div>
        <div className="hero-date">{DIAS[weekday(sel)]} <span>{d.getDate()}</span> de {MESES[d.getMonth()]}</div>
      </div>
      <div className="row">
        <button className="btn" onClick={() => open(<AddModal date={sel} />)}>+ Añadir al calendario</button>
        <button className="btn primary" onClick={() => open(<PlanModal kind="task" />)}>+ Tarea</button>
      </div>
    </div>
  )
  if (!meta.groups.length) return <>{head}<NoGroups /></>

  const due = backupDue(meta)
  const notice = due ? (
    <div className="notice" role="status">
      <div className="grow"><b>{due > 0 ? 'Hace ' + due + ' días que no haces una copia de seguridad' : 'Todavía no has hecho ninguna copia de seguridad'}</b>
        <span className="muted" style={{ fontSize: '.88rem' }}>Descarga una copia para tener tus notas y la asistencia también fuera de la app.</span></div>
      <button className="btn primary sm" onClick={() => { exportJson(st.docs); act.markBackup() }}>Hacer copia ahora</button>
      {isFull(st.school) ? <button className="btn sm" onClick={() => open(<ExcelModal />)}>Notas a Excel</button> : null}
      <button className="btn ghost sm" onClick={() => { try { localStorage.setItem('eprofy.backupSnooze', addDays(t, 7)) } catch (e) { /* */ } force(x => x + 1) }}>Recordar en una semana</button>
    </div>
  ) : null

  // Tira semanal
  const mon = mondayOf(sel)
  const week = (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label">Semana del {fmtDay(mon)} al {fmtDay(addDays(mon, 6))}</span>
        <div className="daynav">
          <button className="btn sm ghost" aria-label="Semana anterior" onClick={() => setSel(addDays(sel, -7))}>‹</button>
          {sel !== t ? <button className="btn sm" onClick={() => setSel(t)}>Hoy</button> : null}
          <button className="btn sm ghost" aria-label="Semana siguiente" onClick={() => setSel(addDays(sel, 7))}>›</button>
        </div>
      </div>
      <div className="week">
        {[0, 1, 2, 3, 4, 5, 6].map(i => {
          const day = addDays(mon, i), blk = blockedOn(meta, day), n = blk ? 0 : classesOn(meta, day).filter(c => !c.cancelled).length
          return (
            <button key={day} aria-pressed={day === sel} className={day === t ? 'today' : ''} onClick={() => setSel(day)} aria-label={DIAS[weekday(day)] + ' ' + parseISO(day).getDate() + (blk ? ', no lectivo' : n ? ', ' + n + ' clases' : '')}>
              <span>{DIAS_CORTOS[i + 1]}</span><b>{parseISO(day).getDate()}</b>
              <span className="mark">{blk ? <i className="blk" /> : n ? <i /> : null}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  // Clases del día elegido
  const blk = blockedOn(meta, sel)
  const classes = blk ? [] : classesOn(meta, sel)
  const classesHtml = blk ? (
    <div className="blocked-banner">
      <div className="grow"><b>{BLOCK_TYPES[blk.type].label}{blk.note ? ': ' + blk.note : ''}</b><span className="muted" style={{ fontSize: '.88rem' }}>{fmtRange(blk.start, blk.end || blk.start)} · no hay clases</span></div>
      <button className="btn sm" onClick={() => open(<BlockModal id={blk.id} />)}>Editar</button>
    </div>
  ) : classes.length ? classes.map(c => <ClassCard key={c.key} cls={c} />) : (
    <div className="empty" style={{ padding: 20 }}>
      {weekday(sel) > 5 ? 'Fin de semana: no hay clases.' : meta.schedule.length ? 'No tienes clases este día.' : <>Añade tus sesiones en <button className="btn sm" onClick={() => go('horario')}>Horario</button> y aparecerán aquí cada día.</>}
    </div>
  )

  const up = agenda(st.docs, t, addDays(t, 14))
  // Tareas abiertas del planificador y entregas vencidas que aún tienen alumnos sin entregar
  const open_ = [], pend = []
  for (const g of meta.groups) {
    const gd = groupDoc(st.docs, g.id)
    for (const a of gd.activities) {
      if (actKind(a) !== 'task') continue
      const s = taskStatus(a, t)
      if (s === 'abierta') open_.push({ g, a })
      else if (s === 'cerrada' && a.delivery && diffDays(a.date, t) <= 30) {
        const miss = gd.students.filter(x => !(gd.delivery[a.id] || {})[x.id] || gd.delivery[a.id][x.id] === 'N').length
        if (miss) pend.push({ g, a, miss })
      }
    }
  }
  open_.sort((x, y) => x.a.date.localeCompare(y.a.date))
  pend.sort((x, y) => y.a.date.localeCompare(x.a.date))

  return (
    <>
      {head}{notice}
      <div className="grid2">
        <section className="stack">
          {week}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="label">{sel === t ? 'Clases de hoy' : 'Clases del ' + fmtDay(sel)}</span>
            <div className="row">
              {!blk ? <button className="btn sm ghost" onClick={() => open(<BlockModal date={sel} />)}>Bloquear día</button> : null}
              <button className="btn sm" onClick={() => open(<ClassModal mode="add" date={sel} />)}>+ Clase puntual</button>
            </div>
          </div>
          {classesHtml}
        </section>
        <section className="stack">
          <div className="panel">
            <div className="panel-h"><h2>Próximos 14 días</h2><button className="btn ghost sm" onClick={() => go('planificador')}>Planificador</button></div>
            {up.length ? <div className="list">{up.map((it, i) => <AgendaItem key={i} it={it} />)}</div> : <p className="muted">Nada programado en las próximas dos semanas.</p>}
          </div>
          <div className="panel">
            <div className="panel-h"><h2>Tareas abiertas</h2><button className="btn ghost sm" onClick={() => open(<PlanModal kind="task" />)}>+ Tarea</button></div>
            {open_.length || pend.length ? <div className="list">
              {open_.slice(0, 8).map(p => {
                const dd = diffDays(t, p.a.date)
                return (
                  <div key={p.a.id} className="item clickable" onClick={() => go('planificador', { open: p.a.id })}>
                    <span className="gdot" style={{ '--c': cvar(p.g.color) }} />
                    <div className="grow"><div className="t">{p.a.name}</div><div className="s">{p.g.name} · {p.a.type} · entrega el {fmtDay(p.a.date)}</div></div>
                    <span className={'tag ' + (dd <= 2 ? 'amber' : '')}>{dd === 0 ? 'Hoy' : 'Faltan ' + dd + ' d'}</span>
                  </div>
                )
              })}
              {pend.slice(0, 6).map(p => (
                <div key={p.a.id} className="item clickable" onClick={() => go('planificador', { open: p.a.id })}>
                  <span className="gdot" style={{ '--c': cvar(p.g.color) }} />
                  <div className="grow"><div className="t">{p.a.name}</div><div className="s">{p.g.name} · venció el {fmtDay(p.a.date)}</div></div>
                  <span className="tag warn">{p.miss} sin entregar</span>
                </div>
              ))}
            </div> : <p className="muted">No hay tareas abiertas. Créalas en el Planificador.</p>}
          </div>
        </section>
      </div>
    </>
  )
}
