import { useState } from 'react'
import { useAppState } from '../store/store'
import { useNav } from '../nav'
import { useModal, Grade, GDot } from '../components/ui.jsx'
import { NoGroups, AgendaItem } from '../components/common.jsx'
import { GroupModal, StudentsModal, StudentModal } from '../modals/GroupModals.jsx'
import { cvar, isFull } from '../lib/model'
import { metaOf, groupDoc, attDoc, groupOf, trimOf, sortedStudents, sname, finalGrade, avg, attCounts, fmtN } from '../lib/grades'
import { agenda, taskStatus } from '../lib/schedule'
import { todayISO, addDays } from '../lib/dates'

// Pestaña Grupos: grupos del colegio y sus alumnos. En formato Completo muestra también notas y faltas.

export default function Grupos({ params }) {
  const st = useAppState()
  const [gid, setGid] = useState(params.gid || null)
  if (gid && groupOf(st.docs, gid)) return <GroupDetail gid={gid} onBack={() => setGid(null)} />
  return <GroupList onOpen={setGid} />
}

function GroupList({ onOpen }) {
  const st = useAppState(), { open } = useModal()
  const meta = metaOf(st.docs), full = isFull(st.school), trim = trimOf(meta, todayISO()), t = todayISO()
  return (
    <>
      <div className="top">
        <div><h1>Grupos</h1><div className="sub">{meta.groups.length} grupo{meta.groups.length === 1 ? '' : 's'} en {st.school.name}</div></div>
        <button className="btn primary" onClick={() => open(<GroupModal onCreated={onOpen} />)}>+ Grupo</button>
      </div>
      {!meta.groups.length ? <NoGroups /> : (
        <div className="gcards">{meta.groups.map(g => {
          const gd = groupDoc(st.docs, g.id)
          const finals = gd.students.map(s => finalGrade(gd, s.id, trim))
          const openTasks = gd.activities.filter(a => taskStatus(a, t) === 'abierta').length
          return (
            <button key={g.id} className="gcard" style={{ '--c': cvar(g.color) }} onClick={() => onOpen(g.id)}>
              <div><h2>{g.name}</h2><div className="muted" style={{ fontSize: '.88rem' }}>{g.subject || 'Sin materia'}</div></div>
              <div className="stats">
                <div><span className="label">Alumnos</span><b>{gd.students.length}</b></div>
                <div><span className="label">Tareas abiertas</span><b>{openTasks}</b></div>
                {full ? <div><span className="label">Media {trim}T</span><b>{fmtN(avg(finals))}</b></div> : null}
              </div>
            </button>
          )
        })}</div>
      )}
    </>
  )
}

function GroupDetail({ gid, onBack }) {
  const st = useAppState(), { open } = useModal(), { go } = useNav()
  const meta = metaOf(st.docs), full = isFull(st.school), t = todayISO(), trim = trimOf(meta, t)
  const g = groupOf(st.docs, gid), gd = groupDoc(st.docs, gid), A = attDoc(st.docs, gid), sts = sortedStudents(gd)
  const next = agenda(st.docs, t, addDays(t, 30)).filter(it => (it.g && it.g.id === gid))
  return (
    <>
      <div className="top">
        <div>
          <button className="btn ghost sm" style={{ marginLeft: -8 }} onClick={onBack}>← Grupos</button>
          <div className="row" style={{ marginTop: 6 }}><GDot color={g.color} size={14} /><h1>{g.name}</h1></div>
          <div className="sub">{g.subject ? g.subject + ' · ' : ''}{gd.students.length} alumnos</div>
        </div>
        <div className="row">
          {full ? <><button className="btn" onClick={() => go('notas', { gid })}>Notas</button><button className="btn" onClick={() => go('lista', { gid })}>Pasar lista</button></> : null}
          <button className="btn" onClick={() => open(<GroupModal gid={gid} onDeleted={onBack} />)}>Editar grupo</button>
        </div>
      </div>
      <div className="grid2">
        <div className="panel" style={{ padding: '6px 18px' }}>
          <div className="panel-h" style={{ marginTop: 10 }}><h2>Alumnos</h2><button className="btn sm primary" onClick={() => open(<StudentsModal gid={gid} />)}>+ Alumnos</button></div>
          {!sts.length ? <p className="muted">Pega la lista de clase para empezar: un alumno por línea.</p> : (
            <div className="list">{sts.map(s => {
              const c = attCounts(meta, A, s.id, trim), no = A.obs.filter(o => o.sid === s.id).length
              return (
                <div key={s.id} className="item clickable" onClick={() => open(<StudentModal gid={gid} sid={s.id} />)}>
                  <div className="grow"><div className="t">{sname(s)}</div>
                    <div className="counts">{full ? `${trim}.º T: F ${c.F} · R ${c.R} · J ${c.J}` : ''}{no ? `${full ? ' · ' : ''}${no} anotaci${no === 1 ? 'ón' : 'ones'}` : ''}{s.notes ? (full || no ? ' · ' : '') + 'con notas privadas' : ''}</div></div>
                  {full ? <Grade v={finalGrade(gd, s.id, trim)} /> : null}
                </div>
              )
            })}</div>
          )}
        </div>
        <div className="panel">
          <div className="panel-h"><h2>Próximos 30 días</h2><button className="btn ghost sm" onClick={() => go('planificador')}>Planificador</button></div>
          {next.length ? <div className="list">{next.map((it, i) => <AgendaItem key={i} it={it} />)}</div> : <p className="muted" style={{ margin: 0 }}>Sin exámenes ni entregas para este grupo.</p>}
        </div>
      </div>
    </>
  )
}
