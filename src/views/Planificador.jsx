import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../store/store'
import * as act from '../store/actions'
import { useModal, useToast, Hero } from '../components/ui.jsx'
import { NoGroups } from '../components/common.jsx'
import { BlockModal, EventModal } from '../modals/CalendarModals.jsx'
import { PlanModal } from '../modals/ActModal.jsx'
import { BLOCK_TYPES, DLV, cvar, isFull } from '../lib/model'
import { metaOf, groupDoc, groupOf, sortedStudents, sname } from '../lib/grades'
import { agenda, blockedOn, actKind, taskStatus } from '../lib/schedule'
import { todayISO, addDays, diffDays, iso, parseISO, weekday, MESES, fmtLong, fmtRange, fmtDay, fmtShort } from '../lib/dates'

// Pestaña Planificador: dos bloques plegables.
//   Eventos → calendario del mes con exámenes, eventos y días no lectivos; cada día tiene su ficha
//             (Planificado, Realizado y Eventos y pendientes).
//   Tareas  → calendario del mes con el inicio y la entrega de cada tarea, y lista por grupo.

export default function Planificador({ params }) {
  const st = useAppState()
  const meta = metaOf(st.docs), t = todayISO()
  const ev = agenda(st.docs, t, addDays(t, 30)).filter(it => it.kind === 'ev' || (it.kind === 'act' && actKind(it.a) === 'exam'))
  let open = 0, prog = 0
  for (const g of meta.groups) for (const a of groupDoc(st.docs, g.id).activities) { const s = taskStatus(a, t); if (s === 'abierta') open++; else if (s === 'programada') prog++ }
  return (
    <>
      <div className="top"><div><h1>Planificador</h1><div className="sub">Eventos y exámenes del mes, y planificación de las tareas de cada grupo</div></div></div>
      {!meta.groups.length ? <NoGroups /> : null}
      <div className="stack" style={{ gap: 16 }}>
        <Hero title="Eventos" sub={ev.length ? ev.length + ' en los próximos 30 días · el siguiente: ' + (ev[0].kind === 'ev' ? ev[0].e.title : ev[0].a.name) + ', ' + fmtDay(ev[0].date) : 'Nada en los próximos 30 días'}>
          <Eventos />
        </Hero>
        <Hero title="Tareas" defaultOpen={!!params.open} sub={open + ' en curso · ' + prog + ' pendiente' + (prog === 1 ? '' : 's') + ' de empezar'}>
          <Tareas openId={params.open} />
        </Hero>
      </div>
    </>
  )
}

/* ---------- calendario del mes (lo usan los dos bloques) ---------- */
function MonthCal({ month, setMonth, sel, setSel, byDay, chip, extra, badge }) {
  const st = useAppState(), meta = metaOf(st.docs), t = todayISO()
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1), start = iso(new Date(y, m - 1, 1 - ((first.getDay() + 6) % 7)))
  const move = n => { if (n === 0) { setMonth(t.slice(0, 7)); setSel(t) } else setMonth(iso(new Date(y, m - 1 + n, 1)).slice(0, 7)) }
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), its = byDay[d] || [], out = d.slice(0, 7) !== month, blk = blockedOn(meta, d)
    cells.push(
      <button key={d} className={'day' + (out ? ' out' : '') + (d === t ? ' today' : '') + (d === sel ? ' sel' : '') + (blk ? ' blk' : '')}
        aria-label={fmtLong(d) + (blk ? ', ' + BLOCK_TYPES[blk.type].label : '') + (its.length ? ', ' + its.length + ' elementos' : '')}
        onClick={() => { setSel(d); if (out) setMonth(d.slice(0, 7)) }}>
        <span className="dn-row"><span className="dn">{parseISO(d).getDate()}</span>{badge ? badge(d) : null}</span>
        {blk ? <span className="blk-lbl">{blk.note || BLOCK_TYPES[blk.type].short}</span> : null}
        {its.slice(0, 3).map((it, k) => chip(it, k))}
        {its.length > 3 ? <span className="ev more">+{its.length - 3} más</span> : null}
      </button>
    )
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b style={{ textTransform: 'capitalize', fontFamily: 'var(--f-display)', fontSize: '1.1rem' }}>{MESES[m - 1]} {y}</b>
        <div className="row">
          <button className="btn sm" aria-label="Mes anterior" onClick={() => move(-1)}>←</button>
          <button className="btn sm" onClick={() => move(0)}>Hoy</button>
          <button className="btn sm" aria-label="Mes siguiente" onClick={() => move(1)}>→</button>
          {extra}
        </div>
      </div>
      <div className="cal">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="dow">{d}</div>)}
        {cells}
      </div>
    </div>
  )
}
const monthRange = month => { const [y, m] = month.split('-').map(Number); const first = new Date(y, m - 1, 1); const s = iso(new Date(y, m - 1, 1 - ((first.getDay() + 6) % 7))); return [s, addDays(s, 41)] }

/* ---------- bloque 1: eventos, con la ficha de cada día ---------- */
function Eventos() {
  const st = useAppState()
  const t = todayISO()
  const [month, setMonth] = useState(t.slice(0, 7))
  const [sel, setSel] = useState(t)
  const [from, to] = monthRange(month)
  const byDay = {}
  agenda(st.docs, from, to).filter(isEvent).forEach(it => (byDay[it.date] = byDay[it.date] || []).push(it))
  const chip = (it, k) => {
    const exam = it.kind === 'act'
    return <span key={k} className={'ev' + (exam ? ' exam' : '')} style={{ '--c': it.g ? cvar(it.g.color) : 'var(--ink-3)' }}>{exam ? 'Examen: ' + it.a.name : it.e.title}</span>
  }
  // En cada día: cuánto de lo planificado está hecho, y un punto si quedan pendientes míos
  const diary = st.docs.diary || {}
  const badge = d => {
    const x = diary[d]; if (!x) return null
    const done = x.plan.filter(i => i.done).length, todo = x.todo.filter(i => !i.done).length
    return <span className="day-badge">{x.plan.length ? <span className={done === x.plan.length ? 'ok' : ''}>{done}/{x.plan.length}</span> : null}{todo ? <i title={todo + ' pendientes'} /> : null}</span>
  }
  return (
    <div className="cal-wrap sheet-wrap">
      <MonthCal month={month} setMonth={setMonth} sel={sel} setSel={setSel} byDay={byDay} chip={chip} badge={badge} />
      <DaySheet date={sel} onGo={setSel} />
    </div>
  )
}
const isEvent = it => it.kind === 'ev' || (it.kind === 'act' && actKind(it.a) === 'exam')

/** Siguiente día lectivo (salta fines de semana y días no lectivos). */
function nextSchoolDay(meta, date) {
  let d = addDays(date, 1)
  for (let i = 0; i < 40 && (weekday(d) > 5 || blockedOn(meta, d)); i++) d = addDays(d, 1)
  return d
}

/** Lista con casillas: marcar, borrar y (opcional) añadir. */
function CheckList({ items, onToggle, onDel, empty }) {
  if (!items.length) return <p className="muted sheet-empty">{empty}</p>
  return (
    <ul className="checklist">{items.map(it => (
      <li key={it.id} className={it.done ? 'done' : ''}>
        <label><input type="checkbox" checked={!!it.done} onChange={() => onToggle(it)} /><span>{it.text}</span></label>
        {onDel ? <button type="button" className="x" aria-label={'Borrar ' + it.text} onClick={() => onDel(it)}>✕</button> : null}
      </li>
    ))}</ul>
  )
}
function AddLine({ placeholder, onAdd, id }) {
  const [v, setV] = useState('')
  const ref = useRef(null)
  const add = () => { const x = v.trim(); if (!x) return; onAdd(x); setV(''); ref.current && ref.current.focus() }
  return (
    <div className="addline">
      <input ref={ref} id={id} value={v} placeholder={placeholder} aria-label={placeholder} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
      <button type="button" className="btn sm" onClick={add} disabled={!v.trim()}>Añadir</button>
    </div>
  )
}

/** Ficha del día: Planificado, Realizado y Eventos y pendientes. */
function DaySheet({ date, onGo }) {
  const st = useAppState(), { open } = useModal(), toast = useToast()
  const meta = metaOf(st.docs)
  const day = (st.docs.diary || {})[date] || { plan: [], todo: [], ev: {} }
  const blk = blockedOn(meta, date)
  const evs = agenda(st.docs, date, date).filter(it => it.kind !== 'block')
  const evKey = it => it.kind === 'ev' ? 'ev:' + it.e.id : 'act:' + it.a.id
  const evText = it => it.kind === 'ev' ? it.e.title + (it.e.time ? ' · ' + it.e.time : '') + (it.g ? ' · ' + it.g.name : '')
    : (actKind(it.a) === 'exam' ? 'Examen: ' : 'Entrega: ') + it.a.name + ' · ' + it.g.name
  const planned = day.plan.filter(i => !i.done), done = day.plan.filter(i => i.done)
  const pend = planned.length + day.todo.filter(i => !i.done).length
  const next = nextSchoolDay(meta, date)
  const tog = list => it => act.diaryToggle(date, list, it.id)
  const del = list => it => toast('«' + it.text + '» borrado', act.diaryDel(date, list, it.id))
  return (
    <div className="panel sheet">
      <div className="panel-h">
        <div><h3>{fmtLong(date)}</h3>{day.plan.length ? <span className="muted" style={{ fontSize: '.82rem' }}>{done.length} de {day.plan.length} realizadas</span> : null}</div>
        <div className="row">
          <button className="btn sm ghost" aria-label="Día anterior" onClick={() => onGo(addDays(date, -1))}>‹</button>
          <button className="btn sm ghost" aria-label="Día siguiente" onClick={() => onGo(addDays(date, 1))}>›</button>
        </div>
      </div>
      {blk ? (
        <div className="blocked-banner" style={{ marginBottom: 12 }}>
          <div className="grow"><b>{BLOCK_TYPES[blk.type].label}{blk.note ? ': ' + blk.note : ''}</b><span className="muted" style={{ fontSize: '.88rem' }}>{fmtRange(blk.start, blk.end || blk.start)} · no hay clases</span></div>
          <button className="btn sm" onClick={() => open(<BlockModal id={blk.id} />)}>Editar</button>
        </div>
      ) : null}

      <section className="sheet-part">
        <h4>Planificado</h4>
        <CheckList items={planned} onToggle={tog('plan')} onDel={del('plan')} empty="Nada planificado. Escribe lo que prevés hacer este día." />
        <AddLine id={'f_plan_' + date} placeholder="Añadir a lo planificado…" onAdd={x => act.diaryAdd(date, 'plan', x)} />
      </section>

      <section className="sheet-part">
        <h4>Realizado</h4>
        <CheckList items={done} onToggle={tog('plan')} onDel={del('plan')} empty="Marca lo planificado al terminarlo y aparecerá aquí." />
      </section>

      <section className="sheet-part">
        <h4>Eventos y pendientes</h4>
        <CheckList items={evs.map(it => ({ id: evKey(it), text: evText(it), done: !!day.ev[evKey(it)] }))} onToggle={it => act.diaryEv(date, it.id)} empty="" />
        <CheckList items={day.todo} onToggle={tog('todo')} onDel={del('todo')} empty={evs.length ? '' : 'Sin eventos ni pendientes este día.'} />
        <AddLine id={'f_todo_' + date} placeholder="Añadir un pendiente mío…" onAdd={x => act.diaryAdd(date, 'todo', x)} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={() => open(<PlanModal kind="exam" date={date} />)}>+ Examen</button>
          <button className="btn sm" onClick={() => open(<EventModal date={date} />)}>+ Evento</button>
          {!blk ? <button className="btn sm ghost" onClick={() => open(<BlockModal date={date} />)}>Día no lectivo</button> : null}
        </div>
      </section>

      {pend ? <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => { toast(pend + ' sin hacer pasado' + (pend === 1 ? '' : 's') + ' al ' + fmtShort(next), act.diaryCarry(date, next)); onGo(next) }}>Pasar lo no hecho al {fmtShort(next)} →</button> : null}
    </div>
  )
}

/* ---------- bloque 2: tareas ---------- */
const STATUS = { programada: ['Pendiente', 'tag'], abierta: ['En curso', 'tag ok'], cerrada: ['Cerrada', 'tag'] }

function Tareas({ openId }) {
  const st = useAppState(), { open } = useModal()
  const meta = metaOf(st.docs), t = todayISO()
  const owner = openId ? meta.groups.find(g => groupDoc(st.docs, g.id).activities.some(a => a.id === openId)) : null
  const [gid, setGid] = useState(owner ? owner.id : '')
  const [month, setMonth] = useState(t.slice(0, 7))
  const [sel, setSel] = useState(t)
  const [showClosed, setShowClosed] = useState(false)
  const [openTask, setOpenTask] = useState(openId || null)
  const [from, to] = monthRange(month)
  useEffect(() => {
    if (openId) setTimeout(() => { const el = document.getElementById('task-' + openId); if (el) el.scrollIntoView({ block: 'center' }) }, 80)
  }, [openId])

  // Todas las tareas del grupo elegido (o de todos)
  const all = []
  for (const g of meta.groups) {
    if (gid && g.id !== gid) continue
    for (const a of groupDoc(st.docs, g.id).activities) if (actKind(a) === 'task') all.push({ g, a, s: taskStatus(a, t) })
  }
  // Calendario: inicio y entrega de cada tarea
  const byDay = {}
  for (const x of all) {
    const start = x.a.start || x.a.date
    if (start >= from && start <= to && start !== x.a.date) (byDay[start] = byDay[start] || []).push({ ...x, what: 'start' })
    if (x.a.date >= from && x.a.date <= to) (byDay[x.a.date] = byDay[x.a.date] || []).push({ ...x, what: 'due' })
  }
  const chip = (it, k) => <span key={k} className={'ev' + (it.what === 'due' ? ' due' : ' starts')} style={{ '--c': cvar(it.g.color) }}>{(it.what === 'due' ? 'Entrega: ' : 'Inicio: ') + it.a.name}</span>
  const dayItems = byDay[sel] || []
  const active = all.filter(x => x.s !== 'cerrada')
  const closed = all.filter(x => x.s === 'cerrada').sort((a, b) => b.a.date.localeCompare(a.a.date))
  const order = { abierta: 0, programada: 1 }
  active.sort((x, y) => order[x.s] - order[y.s] || x.a.date.localeCompare(y.a.date))

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="fld" style={{ minWidth: 200 }}>
          <label htmlFor="f_tgroup">Grupo</label>
          <select id="f_tgroup" value={gid} onChange={e => setGid(e.target.value)}>
            <option value="">Todos los grupos</option>
            {meta.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <button className="btn primary" onClick={() => open(<PlanModal kind="task" gid={gid || undefined} />)}>+ Nueva tarea</button>
      </div>

      <div className="cal-wrap">
        <MonthCal month={month} setMonth={setMonth} sel={sel} setSel={setSel} byDay={byDay} chip={chip} />
        <div className="panel">
          <div className="panel-h"><h3>{fmtLong(sel)}</h3></div>
          {dayItems.length ? <div className="list">{dayItems.map((x, i) => (
            <div key={i} className="item clickable" onClick={() => setOpenTask(x.a.id)}>
              <span className="gdot" style={{ '--c': cvar(x.g.color) }} />
              <div className="grow"><div className="t">{x.a.name}</div><div className="s">{x.what === 'due' ? 'Se entrega' : 'Se presenta'} · {x.g.name}</div></div>
            </div>
          ))}</div> : <p className="muted" style={{ margin: 0 }}>Ninguna tarea empieza ni se entrega este día.</p>}
          <button className="btn sm" style={{ marginTop: 12 }} onClick={() => open(<PlanModal kind="task" gid={gid || undefined} date={sel} />)}>+ Tarea con entrega este día</button>
        </div>
      </div>

      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <h3>{gid ? 'Tareas de ' + groupOf(st.docs, gid).name : 'Tareas de todos los grupos'}</h3>
          <span className="muted" style={{ fontSize: '.85rem' }}>En curso y pendientes de empezar</span>
        </div>
        {!active.length ? <div className="empty" style={{ padding: 20 }}><p style={{ margin: 0 }}>No hay tareas en curso ni pendientes{gid ? ' en este grupo' : ''}.</p></div>
          : <div className="stack">{active.map(x => <TaskCard key={x.a.id} {...x} t={t} isOpen={openTask === x.a.id} onToggle={() => setOpenTask(openTask === x.a.id ? null : x.a.id)} />)}</div>}
        {closed.length ? (
          <div style={{ marginTop: 12 }}>
            <button className="btn sm ghost" aria-expanded={showClosed} onClick={() => setShowClosed(v => !v)}>{showClosed ? 'Ocultar' : 'Ver'} tareas cerradas ({closed.length})</button>
            {showClosed ? <div className="stack" style={{ marginTop: 10 }}>{closed.map(x => <TaskCard key={x.a.id} {...x} t={t} isOpen={openTask === x.a.id} onToggle={() => setOpenTask(openTask === x.a.id ? null : x.a.id)} />)}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TaskCard({ g, a, s, t, isOpen, onToggle }) {
  const st = useAppState(), { open } = useModal()
  const full = isFull(st.school), gd = groupDoc(st.docs, g.id)
  const D = gd.delivery[a.id] || {}, n = gd.students.length
  const done = gd.students.filter(x => D[x.id] === 'E' || D[x.id] === 'T').length
  const start = a.start || a.date, total = Math.max(1, diffDays(start, a.date))
  const pct = s === 'programada' ? 0 : s === 'cerrada' ? 100 : Math.min(100, Math.max(0, diffDays(start, t) / total * 100))
  const dd = diffDays(t, a.date)
  const when = s === 'programada' ? 'Empieza en ' + diffDays(t, start) + ' d' : s === 'cerrada' ? 'Entregada hace ' + (-dd) + ' d' : dd === 0 ? 'Se entrega hoy' : 'Faltan ' + dd + ' d'
  const codes = (a.criteria || []).map(id => (gd.criteria.find(c => c.id === id) || {}).code).filter(Boolean)
  return (
    <div className="task" id={'task-' + a.id} style={{ '--c': cvar(g.color) }}>
      <button className="task-head" aria-expanded={isOpen} onClick={onToggle}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row" style={{ gap: 8 }}><span className={STATUS[s][1]}>{STATUS[s][0]}</span><b className="task-title">{a.name}</b></div>
          <div className="muted" style={{ fontSize: '.84rem', marginTop: 3 }}>{g.name} · {a.type}{a.format ? ' · ' + a.format : ''}{a.grouping ? ' · ' + a.grouping : ''}</div>
        </div>
        <div className="task-when">
          <span className="num">{fmtDay(start)} → {fmtDay(a.date)}</span>
          <span className={'tag ' + (s === 'abierta' && dd <= 2 ? 'amber' : '')}>{when}</span>
        </div>
      </button>
      <div className="task-time" aria-hidden="true"><i style={{ width: pct + '%' }} /></div>
      {a.delivery ? <div className="counts" style={{ marginTop: 6 }}>Entregas: {done}/{n}</div> : null}
      {isOpen ? (
        <div className="task-body">
          <dl className="task-dl">
            {a.desc ? <><dt>Instrucciones</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{a.desc}</dd></> : null}
            {a.materials ? <><dt>Materiales</dt><dd>{a.materials}</dd></> : null}
            {a.duration ? <><dt>Dedicación</dt><dd>{a.duration}</dd></> : null}
            <dt>Disponible</dt><dd>{fmtRange(start, a.date)} ({total} días)</dd>
            {full ? <><dt>Evaluación</dt><dd>{a.graded === false ? 'No se califica en el cuaderno' : codes.length ? 'Criterios ' + codes.join(', ') + ' · sobre ' + (a.max || 10) : 'Se califica, pero sin criterios vinculados'}</dd></> : null}
          </dl>
          {a.delivery ? (
            <>
              <div className="label" style={{ margin: '12px 0 4px' }}>Entregas</div>
              {n ? <div className="list">{sortedStudents(gd).map(x => (
                <div className="item" key={x.id}>
                  <div className="grow">{sname(x)}</div>
                  <button className="dl-st" data-v={D[x.id] || ''} onClick={() => act.cycleDelivery(g.id, a.id, x.id)}>{DLV[D[x.id] || '']}</button>
                </div>
              ))}</div> : <p className="muted">Este grupo no tiene alumnos.</p>}
            </>
          ) : null}
          <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
            {a.delivery && n ? <button className="btn sm" onClick={() => act.restNotDelivered(g.id, a.id)}>Marcar resto como no entregado</button> : null}
            <button className="btn sm primary" onClick={() => open(<PlanModal kind="task" gid={g.id} aid={a.id} />)}>Editar tarea</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
