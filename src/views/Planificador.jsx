import { useEffect, useState } from 'react'
import { useAppState } from '../store/store'
import * as act from '../store/actions'
import { useModal, GroupChips, Seg } from '../components/ui.jsx'
import { AgendaItem, NoGroups } from '../components/common.jsx'
import { BlockModal, AddModal } from '../modals/CalendarModals.jsx'
import { PlanModal } from '../modals/ActModal.jsx'
import { BLOCK_TYPES, DLV, cvar, isFull } from '../lib/model'
import { metaOf, groupDoc, sortedStudents, sname } from '../lib/grades'
import { agenda, blockedOn, actKind, taskStatus } from '../lib/schedule'
import { todayISO, addDays, diffDays, iso, parseISO, MESES, fmtLong, fmtRange, fmtDay } from '../lib/dates'

// Pestaña Planificador: calendario mensual (exámenes, entregas y eventos) y planificador de tareas.

export default function Planificador({ params }) {
  const st = useAppState()
  const meta = metaOf(st.docs)
  useEffect(() => {
    if (params.open) setTimeout(() => { const el = document.getElementById('task-' + params.open); if (el) el.scrollIntoView({ block: 'center' }) }, 60)
  }, [params.open])
  return (
    <>
      <div className="top"><div><h1>Planificador</h1><div className="sub">Calendario de exámenes, entregas y eventos, y planificación de las tareas de cada grupo</div></div></div>
      {!meta.groups.length ? <NoGroups /> : null}
      <div className="stack" style={{ gap: 22 }}>
        <Calendario />
        <Tareas openId={params.open} />
      </div>
    </>
  )
}

/* ---------- hero 1: calendario mensual ---------- */
function Calendario() {
  const st = useAppState(), { open } = useModal()
  const meta = metaOf(st.docs), t = todayISO()
  const [month, setMonth] = useState(t.slice(0, 7))
  const [sel, setSel] = useState(t)
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1), start = iso(new Date(y, m - 1, 1 - ((first.getDay() + 6) % 7)))
  const items = agenda(st.docs, start, addDays(start, 41)).filter(it => it.kind !== 'block')
  const byDay = {}
  items.forEach(it => (byDay[it.date] = byDay[it.date] || []).push(it))
  const moveMonth = n => { if (n === 0) { setMonth(t.slice(0, 7)); setSel(t) } else setMonth(iso(new Date(y, m - 1 + n, 1)).slice(0, 7)) }
  const label = it => it.kind === 'ev' ? it.e.title : (actKind(it.a) === 'exam' ? 'Examen: ' : 'Entrega: ') + it.a.name

  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), its = byDay[d] || [], out = d.slice(0, 7) !== month, blk = blockedOn(meta, d)
    cells.push(
      <button key={d} className={'day' + (out ? ' out' : '') + (d === t ? ' today' : '') + (d === sel ? ' sel' : '') + (blk ? ' blk' : '')}
        aria-label={fmtLong(d) + (blk ? ', ' + BLOCK_TYPES[blk.type].label : '') + (its.length ? ', ' + its.length + ' elementos' : '')}
        onClick={() => { setSel(d); if (out) setMonth(d.slice(0, 7)) }}>
        <span className="dn">{parseISO(d).getDate()}</span>
        {blk ? <span className="blk-lbl">{blk.note || BLOCK_TYPES[blk.type].short}</span> : null}
        {its.slice(0, 3).map((it, k) => <span key={k} className={'ev' + (it.kind === 'act' && actKind(it.a) === 'exam' ? ' exam' : '')} style={{ '--c': it.g ? cvar(it.g.color) : 'var(--ink-3)' }}>{label(it)}</span>)}
        {its.length > 3 ? <span className="ev more">+{its.length - 3} más</span> : null}
      </button>
    )
  }
  const blk = blockedOn(meta, sel)
  const dayItems = byDay[sel] || agenda(st.docs, sel, sel).filter(it => it.kind !== 'block')

  return (
    <section className="hero-sec">
      <div className="hero-h">
        <h2 style={{ textTransform: 'capitalize' }}>{MESES[m - 1]} {y}</h2>
        <div className="row">
          <button className="btn sm" aria-label="Mes anterior" onClick={() => moveMonth(-1)}>←</button>
          <button className="btn sm" onClick={() => moveMonth(0)}>Hoy</button>
          <button className="btn sm" aria-label="Mes siguiente" onClick={() => moveMonth(1)}>→</button>
          <button className="btn sm primary" onClick={() => open(<AddModal date={sel} />)}>+ Añadir</button>
        </div>
      </div>
      <div className="cal-wrap">
        <div className="cal">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="dow">{d}</div>)}
          {cells}
        </div>
        <div className="panel">
          <div className="panel-h"><h3>{fmtLong(sel)}</h3><button className="btn sm" onClick={() => open(<AddModal date={sel} />)}>+ Añadir</button></div>
          <div className="stack">
            {blk ? (
              <div className="blocked-banner">
                <div className="grow"><b>{BLOCK_TYPES[blk.type].label}{blk.note ? ': ' + blk.note : ''}</b><span className="muted" style={{ fontSize: '.88rem' }}>{fmtRange(blk.start, blk.end || blk.start)} · no hay clases</span></div>
                <button className="btn sm" onClick={() => open(<BlockModal id={blk.id} />)}>Editar</button>
              </div>
            ) : null}
            {dayItems.length ? <div className="list">{dayItems.map((it, i) => <AgendaItem key={i} it={it} />)}</div> : !blk ? <p className="muted" style={{ margin: 0 }}>Nada programado este día.</p> : null}
          </div>
          <div className="legend">Exámenes y entregas de tareas salen solos en el calendario. «Añadir» también permite bloquear días no lectivos.</div>
        </div>
      </div>
    </section>
  )
}

/* ---------- hero 2: planificador de tareas ---------- */
const STATUS = { programada: ['Programada', 'tag'], abierta: ['Abierta', 'tag ok'], cerrada: ['Cerrada', 'tag'] }

function Tareas({ openId }) {
  const st = useAppState(), { open } = useModal()
  const meta = metaOf(st.docs), t = todayISO()
  const [gid, setGid] = useState(null)
  const [filter, setFilter] = useState('activas')
  const [openTask, setOpenTask] = useState(openId || null)

  const tasks = []
  for (const g of meta.groups) {
    if (gid && g.id !== gid) continue
    for (const a of groupDoc(st.docs, g.id).activities) {
      if (actKind(a) !== 'task') continue
      const s = taskStatus(a, t)
      if (filter === 'activas' ? s === 'cerrada' : filter !== 'todas' && s !== filter) continue
      tasks.push({ g, a, s })
    }
  }
  const order = { abierta: 0, programada: 1, cerrada: 2 }
  tasks.sort((x, y) => order[x.s] - order[y.s] || (x.s === 'cerrada' ? (y.a.date || '').localeCompare(x.a.date || '') : (x.a.date || '').localeCompare(y.a.date || '')))

  return (
    <section className="hero-sec">
      <div className="hero-h">
        <h2>Planificador de tareas</h2>
        <button className="btn sm primary" onClick={() => open(<PlanModal kind="task" gid={gid} />)}>+ Nueva tarea</button>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <GroupChips groups={meta.groups} value={gid} onChange={setGid} all />
        <Seg label="Estado" value={filter} onChange={setFilter} options={[['activas', 'Activas'], ['abierta', 'Abiertas'], ['programada', 'Programadas'], ['cerrada', 'Cerradas'], ['todas', 'Todas']]} />
      </div>
      {!tasks.length ? (
        <div className="empty" style={{ padding: 22 }}>
          <h2>{filter === 'cerrada' ? 'No hay tareas cerradas' : 'No hay tareas ' + (filter === 'todas' ? 'todavía' : 'en esta vista')}</h2>
          <p>Crea una tarea con sus fechas de disponibilidad y entrega, instrucciones, materiales y formato. Su entrega aparecerá en el calendario.</p>
        </div>
      ) : <div className="stack">{tasks.map(x => <TaskCard key={x.a.id} {...x} t={t} isOpen={openTask === x.a.id} onToggle={() => setOpenTask(openTask === x.a.id ? null : x.a.id)} />)}</div>}
    </section>
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
