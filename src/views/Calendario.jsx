import { useState } from 'react'
import { useAppState } from '../store/store'
import { useModal } from '../components/ui.jsx'
import { ClassCard } from '../components/ClassCard.jsx'
import { AgendaItem } from '../components/common.jsx'
import { EventModal, BlockModal, ClassModal } from '../modals/CalendarModals.jsx'
import { BLOCK_TYPES } from '../lib/model'
import { metaOf } from '../lib/grades'
import { agenda, blockedOn, classesOn } from '../lib/schedule'
import { todayISO, addDays, iso, parseISO, MESES, fmtLong, fmtRange, weekday } from '../lib/dates'

export default function Calendario() {
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

  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), its = byDay[d] || [], out = d.slice(0, 7) !== month, blk = blockedOn(meta, d)
    cells.push(
      <button key={d} className={'day' + (out ? ' out' : '') + (d === t ? ' today' : '') + (d === sel ? ' sel' : '') + (blk ? ' blk' : '')}
        aria-label={fmtLong(d) + (blk ? ', ' + BLOCK_TYPES[blk.type].label : '') + (its.length ? ', ' + its.length + ' elementos' : '')}
        onClick={() => { setSel(d); if (out) setMonth(d.slice(0, 7)) }}>
        <span className="dn">{parseISO(d).getDate()}</span>
        {blk ? <span className="blk-lbl">{blk.note || BLOCK_TYPES[blk.type].short}</span> : null}
        {its.slice(0, 3).map((it, k) => <span key={k} className="ev" style={{ '--c': it.g ? `var(--${it.g.color})` : 'var(--ink-3)' }}>{it.kind === 'ev' ? it.e.title : it.a.name}</span>)}
        {its.length > 3 ? <span className="ev more">+{its.length - 3} más</span> : null}
      </button>
    )
  }

  const blk = blockedOn(meta, sel)
  const dayClasses = blk ? [] : classesOn(meta, sel)
  const dayItems = byDay[sel] || agenda(st.docs, sel, sel).filter(it => it.kind !== 'block')
  const blockedList = [...(meta.blocked || [])].sort((a, b) => a.start.localeCompare(b.start)).filter(b => (b.end || b.start) >= t)

  return (
    <>
      <div className="top">
        <div><h1 style={{ textTransform: 'capitalize' }}>{MESES[m - 1]} {y}</h1><div className="sub">Eventos, exámenes, entregas y días no lectivos</div></div>
        <div className="row">
          <button className="btn" aria-label="Mes anterior" onClick={() => moveMonth(-1)}>←</button>
          <button className="btn" onClick={() => moveMonth(0)}>Hoy</button>
          <button className="btn" aria-label="Mes siguiente" onClick={() => moveMonth(1)}>→</button>
          <button className="btn" onClick={() => open(<BlockModal date={sel} />)}>Bloquear días</button>
          <button className="btn primary" onClick={() => open(<EventModal date={sel} />)}>+ Evento</button>
        </div>
      </div>
      <div className="cal">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="dow">{d}</div>)}
        {cells}
      </div>

      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="panel">
          <div className="panel-h"><h2>{fmtLong(sel)}</h2>
            <div className="row">
              {!blk && weekday(sel) <= 5 ? <button className="btn sm" onClick={() => open(<ClassModal mode="add" date={sel} />)}>+ Clase puntual</button> : null}
              <button className="btn sm" onClick={() => open(<EventModal date={sel} />)}>+ Evento</button>
            </div>
          </div>
          <div className="stack">
            {blk ? (
              <div className="blocked-banner">
                <div className="grow"><b>{BLOCK_TYPES[blk.type].label}{blk.note ? ': ' + blk.note : ''}</b><span className="muted" style={{ fontSize: '.88rem' }}>{fmtRange(blk.start, blk.end || blk.start)} · no hay clases</span></div>
                <button className="btn sm" onClick={() => open(<BlockModal id={blk.id} />)}>Editar</button>
              </div>
            ) : dayClasses.map(c => <ClassCard key={c.key} cls={c} />)}
            {dayItems.length ? <div className="list">{dayItems.map((it, i) => <AgendaItem key={i} it={it} />)}</div> : null}
            {!blk && !dayClasses.length && !dayItems.length ? <p className="muted" style={{ margin: 0 }}>Sin clases ni eventos este día.</p> : null}
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><h2>Próximos días no lectivos</h2><button className="btn sm" onClick={() => open(<BlockModal date={sel} />)}>+ Añadir</button></div>
          {blockedList.length ? <div className="list">{blockedList.map(b => (
            <div key={b.id} className="item clickable" onClick={() => open(<BlockModal id={b.id} />)}>
              <span className="blk-tag">{BLOCK_TYPES[b.type].short}</span>
              <div className="grow"><div className="t">{b.note || BLOCK_TYPES[b.type].label}</div><div className="s">{fmtRange(b.start, b.end || b.start)}</div></div>
            </div>
          ))}</div> : <p className="muted" style={{ margin: 0 }}>Añade festivos, vacaciones y tus ausencias: esos días no aparecerán clases ni se pedirá pasar lista.</p>}
        </div>
      </div>
    </>
  )
}
