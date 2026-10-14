import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../store/store'
import * as act from '../store/actions'
import { useNav } from '../nav'
import { useModal, useToast } from './ui.jsx'
import { ClassModal } from '../modals/CalendarModals.jsx'
import { cvar, isFull, SESSION_TYPES } from '../lib/model'
import { groupOf, attDoc } from '../lib/grades'
import { fmtShort, todayISO, nowHM } from '../lib/dates'

/** Tarjeta de una clase de un día concreto (fija o puntual), con sus acciones. */
export function ClassCard({ cls }) {
  const st = useAppState(), { go } = useNav(), { open } = useModal(), toast = useToast()
  const [menu, setMenu] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!menu) return
    const off = e => { if (ref.current && !ref.current.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [menu])

  const g = groupOf(st.docs, cls.groupId)
  const isClass = cls.type === 'clase'
  if (isClass && !g) return null
  const T = SESSION_TYPES[cls.type] || SESSION_TYPES.clase
  const day = g ? attDoc(st.docs, g.id).att[cls.date] : null
  const done = day && Object.keys(day).length
  const isNow = cls.date === todayISO() && !cls.cancelled && nowHM() >= cls.start && nowHM() < cls.end
  const run = (msg, fn) => { setMenu(false); toast(msg, fn()) }

  return (
    <div className={'class-card' + (isNow ? ' now' : '') + (cls.cancelled ? ' cancelled' : '') + (isClass ? '' : ' other')} style={{ '--c': isClass ? cvar(g.color) : T.color }}>
      <div className="when"><b>{cls.start}</b>{cls.end}</div>
      <div style={{ minWidth: 0 }}>
        <div className="ct">{isClass ? g.name : T.label + (g ? ' · ' + g.name : '')}</div>
        <div className="muted" style={{ fontSize: '.85rem' }}>{isClass ? g.subject || '' : cls.note || ''}{cls.room ? ((isClass ? g.subject : cls.note) ? ' · ' : '') + cls.room : ''}</div>
        <div className="badge-row">
          {isNow ? <span className="tag ok">Ahora</span> : null}
          {cls.cancelled ? <span className="tag warn">{cls.movedTo ? 'Movida al ' + fmtShort(cls.movedTo) : 'Cancelada'}</span> : null}
          {cls.added && cls.movedFrom ? <span className="tag amber">Movida desde el {fmtShort(cls.movedFrom)}</span> : null}
          {cls.added && !cls.movedFrom ? <span className="tag amber">Clase puntual</span> : null}
          {cls.reason ? <span className="tag">{cls.reason}</span> : null}
          {done && !cls.cancelled && isFull(st.school) ? <span className="tag">Lista pasada</span> : null}
        </div>
      </div>
      <div className="row acts">
        {cls.cancelled ? (
          <button className="btn sm" onClick={() => toast('Clase restaurada', act.restoreClass(cls))}>Restaurar clase</button>
        ) : (
          <>
            {!isClass ? null : isFull(st.school) ? <>
              <button className={'btn sm ' + (done ? '' : 'primary')} onClick={() => go('lista', { gid: g.id, date: cls.date })}>Pasar lista</button>
              <button className="btn sm" onClick={() => go('notas', { gid: g.id })}>Notas</button>
            </> : <button className="btn sm" onClick={() => go('grupos', { gid: g.id })}>Ver grupo</button>}
            <div className="menu" ref={ref}>
              <button className="btn sm ghost" aria-haspopup="menu" aria-expanded={menu} aria-label="Más acciones" onClick={() => setMenu(m => !m)}>⋯</button>
              {menu ? (
                <div className="menu-pop" role="menu">
                  <button role="menuitem" onClick={() => { setMenu(false); open(<ClassModal mode="move" cls={cls} />) }}>Mover a otro día u hora</button>
                  {cls.added
                    ? <button role="menuitem" className="danger" onClick={() => run(cls.movedFrom ? 'Clase devuelta a su día original' : 'Clase quitada', () => act.removeAdded(cls))}>{cls.movedFrom ? 'Devolver a su día original' : 'Quitar esta clase'}</button>
                    : <button role="menuitem" className="danger" onClick={() => run('Clase cancelada', () => act.cancelClass(cls))}>Cancelar solo este día</button>}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
