import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../store/store'
import * as act from '../store/actions'
import { useNav } from '../nav'
import { useModal, useToast } from './ui.jsx'
import { ClassModal } from '../modals/CalendarModals.jsx'
import { cvar, isFull } from '../lib/model'
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
  if (!g) return null
  const day = attDoc(st.docs, g.id).att[cls.date]
  const done = day && Object.keys(day).length
  const isNow = cls.date === todayISO() && !cls.cancelled && nowHM() >= cls.start && nowHM() < cls.end
  const run = (msg, fn) => { setMenu(false); toast(msg, fn()) }

  return (
    <div className={'class-card' + (isNow ? ' now' : '') + (cls.cancelled ? ' cancelled' : '')} style={{ '--c': cvar(g.color) }}>
      <div className="when"><b>{cls.start}</b>{cls.end}</div>
      <div style={{ minWidth: 0 }}>
        <div className="ct">{g.name}</div>
        <div className="muted" style={{ fontSize: '.85rem' }}>{g.subject || ''}{cls.room ? ' · ' + cls.room : ''}</div>
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
            {isFull(st.school) ? <>
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
