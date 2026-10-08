import { useEffect, useState } from 'react'
import { useAppState } from '../store/store'
import * as act from '../store/actions'
import { useModal, GroupChips, GDot } from '../components/ui.jsx'
import { NoGroups } from '../components/common.jsx'
import { ActModal } from '../modals/ActModal.jsx'
import { DLV } from '../lib/model'
import { metaOf, groupDoc, sortedStudents, sname } from '../lib/grades'
import { todayISO, diffDays, fmtDay } from '../lib/dates'

export default function Entregas({ params }) {
  const st = useAppState(), { open } = useModal()
  const meta = metaOf(st.docs), t = todayISO()
  const [gid, setGid] = useState(null)
  const [openId, setOpenId] = useState(params.open || null)
  useEffect(() => {
    if (params.open) setTimeout(() => { const el = document.getElementById('ent-' + params.open); if (el) el.scrollIntoView({ block: 'center' }) }, 50)
  }, [params.open])

  const head = (
    <div className="top">
      <div><h1>Tareas y entregas</h1><div className="sub">Quién ha entregado qué y cuándo</div></div>
      <button className="btn primary" onClick={() => open(<ActModal gid={gid} delivery />)}>+ Tarea</button>
    </div>
  )
  if (!meta.groups.length) return <>{head}<NoGroups /></>

  const items = []
  for (const g of meta.groups) {
    if (gid && g.id !== gid) continue
    const gd = groupDoc(st.docs, g.id)
    for (const a of gd.activities) if (a.delivery) items.push({ g, gd, a })
  }
  items.sort((x, y) => (y.a.date || '').localeCompare(x.a.date || ''))

  return (
    <>
      {head}
      <div className="stack">
        <GroupChips groups={meta.groups} value={gid} onChange={id => { setGid(id); setOpenId(null) }} all />
        {!items.length ? <div className="empty"><h2>No hay tareas con entrega</h2><p>Crea una tarea y marca «Controlar entregas» para seguir quién la ha entregado.</p></div> : items.map(({ g, gd, a }) => {
          const D = gd.delivery[a.id] || {}, n = gd.students.length
          const done = gd.students.filter(s => D[s.id] === 'E' || D[s.id] === 'T').length
          const dd = a.date ? diffDays(t, a.date) : null
          const due = dd == null ? <span className="tag">Sin fecha</span>
            : dd < 0 ? (done < n ? <span className="tag warn">Vencida hace {-dd} d</span> : <span className="tag ok">Completa</span>)
              : dd === 0 ? <span className="tag amber">Vence hoy</span> : <span className="tag">Vence en {dd} d</span>
          const isOpen = openId === a.id
          return (
            <div className="panel" id={'ent-' + a.id} key={a.id}>
              <button className="row clickable" style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}
                aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : a.id)}>
                <div className="row" style={{ minWidth: 0, flex: 1 }}>
                  <GDot color={g.color} />
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700 }}>{a.name}</div><div className="muted" style={{ fontSize: '.84rem' }}>{g.name}{a.date ? ' · ' + fmtDay(a.date) : ''}</div></div>
                </div>
                <div className="row">{due}<span className="num" style={{ fontSize: '.85rem' }}>{done}/{n}</span></div>
              </button>
              <div className="bar" style={{ marginTop: 10 }}><i style={{ width: (n ? done / n * 100 : 0) + '%' }} /></div>
              {isOpen ? (
                <>
                  <div className="list" style={{ marginTop: 8 }}>{sortedStudents(gd).map(s => (
                    <div className="item" key={s.id}>
                      <div className="grow">{sname(s)}</div>
                      <button className="dl-st" data-v={D[s.id] || ''} onClick={() => act.cycleDelivery(g.id, a.id, s.id)}>{DLV[D[s.id] || '']}</button>
                    </div>
                  ))}</div>
                  <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                    <button className="btn sm" onClick={() => act.restNotDelivered(g.id, a.id)}>Marcar resto como no entregado</button>
                    <button className="btn sm" onClick={() => open(<ActModal gid={g.id} aid={a.id} />)}>Editar tarea</button>
                  </div>
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </>
  )
}
