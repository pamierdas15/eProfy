import { useNav } from '../nav'
import { useModal, useToast } from './ui.jsx'
import { GroupModal } from '../modals/GroupModals.jsx'
import { EventModal, BlockModal } from '../modals/CalendarModals.jsx'
import { loadSample } from '../lib/sample'
import { cvar, BLOCK_TYPES } from '../lib/model'
import { parseISO, MESES, fmtRange } from '../lib/dates'

export function NoGroups() {
  const { go } = useNav(), { open } = useModal(), toast = useToast()
  return (
    <div className="empty">
      <h2>Todavía no tienes grupos</h2>
      <p>Crea tu primer grupo para empezar a pasar lista, calificar y llevar las entregas.</p>
      <div className="row">
        <button className="btn primary" onClick={() => open(<GroupModal onCreated={id => go('grupos', { gid: id, tab: 'alumnos' })} />)}>Crear grupo</button>
        <button className="btn" onClick={() => toast('Grupos de ejemplo añadidos', loadSample())}>Cargar datos de ejemplo</button>
      </div>
    </div>
  )
}

const When = ({ date }) => <div className="when"><b>{parseISO(date).getDate()}</b>{MESES[parseISO(date).getMonth()].slice(0, 3)}</div>

/** Fila de la agenda: evento, examen/entrega o día no lectivo. */
export function AgendaItem({ it }) {
  const { go } = useNav(), { open } = useModal()
  if (it.kind === 'block') {
    return (
      <div className="item clickable" onClick={() => open(<BlockModal id={it.b.id} />)}>
        <When date={it.date} /><span className="gdot" style={{ '--c': 'var(--suf)' }} />
        <div className="grow"><div className="t">{BLOCK_TYPES[it.b.type].label}{it.b.note ? ': ' + it.b.note : ''}</div><div className="s">{fmtRange(it.b.start, it.b.end || it.b.start)} · sin clases</div></div>
      </div>
    )
  }
  const c = it.g ? cvar(it.g.color) : 'var(--ink-3)'
  if (it.kind === 'ev') {
    return (
      <div className="item clickable" onClick={() => open(<EventModal id={it.e.id} />)}>
        <When date={it.date} /><span className="gdot" style={{ '--c': c }} />
        <div className="grow"><div className="t">{it.e.title}</div><div className="s">{it.e.type}{it.e.time ? ' · ' + it.e.time : ''}{it.g ? ' · ' + it.g.name : ''}</div></div>
      </div>
    )
  }
  return (
    <div className="item clickable" onClick={() => it.a.delivery ? go('entregas', { open: it.a.id }) : go('grupos', { gid: it.g.id })}>
      <When date={it.date} /><span className="gdot" style={{ '--c': c }} />
      <div className="grow"><div className="t">{it.a.name}</div><div className="s">{it.a.delivery ? 'Entrega' : it.a.type} · {it.g.name}</div></div>
    </div>
  )
}
