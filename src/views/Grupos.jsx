import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../store/store'
import { useNav } from '../nav'
import * as act from '../store/actions'
import { useModal, useToast, Grade, GDot, Seg } from '../components/ui.jsx'
import { NoGroups } from '../components/common.jsx'
import { GroupModal, StudentsModal, StudentModal, CritModal, BulkCritModal } from '../modals/GroupModals.jsx'
import { ActModal } from '../modals/ActModal.jsx'
import { ExcelModal } from '../modals/CalendarModals.jsx'
import { cvar } from '../lib/model'
import { metaOf, groupDoc, attDoc, groupOf, trimOf, sortedStudents, sortedCriteria, sname, actsIn, score, critGrades, finalGrade, avg, attCounts, fmtN, fmtW, parseNum } from '../lib/grades'
import { todayISO, fmtDay } from '../lib/dates'

export default function Grupos({ params }) {
  const st = useAppState()
  const [gid, setGid] = useState(params.gid || null)
  const [trim, setTrim] = useState(() => trimOf(metaOf(st.docs), todayISO()))
  if (gid && groupOf(st.docs, gid)) return <GroupDetail gid={gid} tab0={params.tab} trim={trim} setTrim={setTrim} onBack={() => setGid(null)} />
  return <GroupList trim={trim} onOpen={setGid} />
}

function GroupList({ trim, onOpen }) {
  const st = useAppState(), { open } = useModal()
  const meta = metaOf(st.docs)
  return (
    <>
      <div className="top">
        <div><h1>Grupos</h1><div className="sub">{meta.groups.length} grupo{meta.groups.length === 1 ? '' : 's'} este curso</div></div>
        <button className="btn primary" onClick={() => open(<GroupModal onCreated={onOpen} />)}>+ Grupo</button>
      </div>
      {!meta.groups.length ? <NoGroups /> : (
        <div className="gcards">{meta.groups.map(g => {
          const gd = groupDoc(st.docs, g.id)
          const finals = gd.students.map(s => finalGrade(gd, s.id, trim))
          const susp = finals.filter(f => f != null && f < 5).length
          return (
            <button key={g.id} className="gcard" style={{ '--c': cvar(g.color) }} onClick={() => onOpen(g.id)}>
              <div><h2>{g.name}</h2><div className="muted" style={{ fontSize: '.88rem' }}>{g.subject || 'Sin materia'}</div></div>
              <div className="stats">
                <div><span className="label">Alumnos</span><b>{gd.students.length}</b></div>
                <div><span className="label">Media {trim}T</span><b>{fmtN(avg(finals))}</b></div>
                <div><span className="label">Suspensos</span><b>{susp}</b></div>
              </div>
            </button>
          )
        })}</div>
      )}
    </>
  )
}

const TRIM_OPTS = [[1, '1.º T'], [2, '2.º T'], [3, '3.º T'], [0, 'Final']]

function GroupDetail({ gid, tab0, trim, setTrim, onBack }) {
  const st = useAppState(), { open } = useModal()
  const [tab, setTab] = useState(tab0 || 'cuaderno')
  const g = groupOf(st.docs, gid), gd = groupDoc(st.docs, gid)
  return (
    <>
      <div className="top">
        <div>
          <button className="btn ghost sm" style={{ marginLeft: -8 }} onClick={onBack}>← Grupos</button>
          <div className="row" style={{ marginTop: 6 }}><GDot color={g.color} size={14} /><h1>{g.name}</h1></div>
          <div className="sub">{g.subject ? g.subject + ' · ' : ''}{gd.students.length} alumnos · {gd.criteria.length} criterios</div>
        </div>
        <button className="btn" onClick={() => open(<GroupModal gid={gid} onDeleted={onBack} />)}>Editar grupo</button>
      </div>
      <div className="tabs">{[['cuaderno', 'Cuaderno'], ['criterios', 'Criterios'], ['alumnos', 'Alumnos']].map(([k, l]) => (
        <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>
      ))}</div>
      {tab === 'criterios' ? <Criterios gid={gid} /> : tab === 'alumnos' ? <Alumnos gid={gid} trim={trim} setTrim={setTrim} /> : <Cuaderno gid={gid} trim={trim} setTrim={setTrim} goTab={setTab} />}
    </>
  )
}

/* ---------- cuaderno ---------- */
function Cuaderno({ gid, trim, setTrim, goTab }) {
  const st = useAppState(), { open } = useModal()
  const [mode, setMode] = useState('act')
  const gd = groupDoc(st.docs, gid)
  const bar = (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
      <Seg label="Periodo" value={trim} onChange={setTrim} options={TRIM_OPTS} />
      <div className="row">
        <Seg value={mode} onChange={setMode} options={[['act', 'Actividades'], ['crit', 'Criterios']]} label="Vista" />
        <button className="btn" onClick={() => open(<ExcelModal gid={gid} trim={trim} />)}>Excel</button>
        <button className="btn primary" onClick={() => open(<ActModal gid={gid} />)}>+ Actividad</button>
      </div>
    </div>
  )
  if (!gd.students.length) return <>{bar}<div className="empty"><h2>Añade los alumnos del grupo</h2><p>Puedes pegar la lista completa de una vez, un alumno por línea.</p><div className="row"><button className="btn primary" onClick={() => open(<StudentsModal gid={gid} />)}>Añadir alumnos</button></div></div></>
  if (!gd.criteria.length) return <>{bar}<div className="empty"><h2>Define los criterios de evaluación</h2><p>La nota se calcula a partir de los criterios y sus pesos. Añádelos en la pestaña Criterios.</p><div className="row"><button className="btn primary" onClick={() => goTab('criterios')}>Ir a Criterios</button></div></div></>
  const sts = sortedStudents(gd), finLabel = trim ? trim + '.º T' : 'Final'
  const StudentBtn = ({ s }) => <button onClick={() => open(<StudentModal gid={gid} sid={s.id} />)}>{sname(s)}</button>

  if (mode === 'crit') {
    const cs = sortedCriteria(gd)
    return (
      <>{bar}
        <div className="tablewrap"><table className="book">
          <thead><tr><th className="st">Alumno</th>{cs.map(c => <th key={c.id} title={c.desc}><div className="ah" style={{ cursor: 'default' }}><span className="an num">{c.code}</span><span className="ac">{fmtW(c.weight)} %</span></div></th>)}<th className="fin">{finLabel}</th></tr></thead>
          <tbody>{sts.map(s => { const cg = critGrades(gd, s.id, trim); return (
            <tr key={s.id}><td className="st"><StudentBtn s={s} /></td>{cs.map(c => <td key={c.id} style={{ padding: 4 }}><Grade v={cg[c.id]} /></td>)}<td className="fin"><Grade v={finalGrade(gd, s.id, trim)} /></td></tr>
          ) })}</tbody>
        </table></div>
        <div className="legend">Cada criterio es la media ponderada de las actividades que lo evalúan en el periodo.</div>
      </>
    )
  }
  const acts = actsIn(gd, trim)
  if (!acts.length) return <>{bar}<div className="empty"><h2>No hay actividades en este periodo</h2><p>Crea un examen, tarea o proyecto y vincúlalo a uno o varios criterios.</p><div className="row"><button className="btn primary" onClick={() => open(<ActModal gid={gid} />)}>+ Actividad</button></div></div></>
  const cmap = Object.fromEntries(gd.criteria.map(c => [c.id, c.code]))
  return (
    <>{bar}
      <div className="tablewrap"><table className="book">
        <thead><tr><th className="st">Alumno</th>
          {acts.map(a => (
            <th key={a.id}><button className="ah" title={a.name} onClick={() => open(<ActModal gid={gid} aid={a.id} />)}>
              <span className="ac">{a.date ? fmtDay(a.date) : 'sin fecha'}{trim ? '' : ' · ' + a.trim + 'T'}</span>
              <span className="an">{a.name}</span>
              <span className="ac">{(a.criteria || []).length ? a.criteria.map(id => cmap[id] || '?').join(' ') : <span style={{ color: 'var(--ins)' }}>sin criterio</span>}</span>
            </button></th>
          ))}
          <th className="fin">{finLabel}</th></tr></thead>
        <tbody>{sts.map((s, ri) => (
          <tr key={s.id}><td className="st"><StudentBtn s={s} /></td>
            {acts.map((a, ci) => <td key={a.id}><Cell gid={gid} a={a} s={s} v={score(gd, a.id, s.id)} r={ri} c={ci} /></td>)}
            <td className="fin"><Grade v={finalGrade(gd, s.id, trim)} /></td></tr>
        ))}</tbody>
        <tfoot><tr><td className="st">Media</td>{acts.map(a => <td key={a.id}>{fmtN(avg(sts.map(s => score(gd, a.id, s.id))))}</td>)}<td className="fin">{fmtN(avg(sts.map(s => finalGrade(gd, s.id, trim))))}</td></tr></tfoot>
      </table></div>
      <div className="legend"><span>Escribe la nota y pulsa Intro para bajar a la siguiente fila.</span><span>Deja la casilla vacía si no hay nota.</span></div>
    </>
  )
}

/** Casilla de nota: se edita en local y se guarda al salir o pulsar Intro. */
function Cell({ gid, a, s, v, r, c }) {
  const toast = useToast()
  const show = x => x == null ? '' : String(x).replace('.', ',')
  const [val, setVal] = useState(show(v))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setVal(show(v)) }, [v])
  const max = a.max || 10
  const commit = () => {
    const n = parseNum(val)
    if (n != null && (isNaN(n) || n < 0 || n > max)) { toast('La nota debe estar entre 0 y ' + fmtW(max)); setVal(show(v)); return }
    if (n !== v) act.setScore(gid, a.id, s.id, n)
  }
  const onKey = e => {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const next = document.querySelector(`.cell[data-r="${r + (e.key === 'ArrowUp' ? -1 : 1)}"][data-c="${c}"]`)
    if (next) { next.focus(); next.select() } else e.currentTarget.blur()
  }
  const n = parseNum(val)
  return (
    <input className={'cell' + (n != null && !isNaN(n) && n / max < 0.5 ? ' ins' : '')} inputMode="decimal" data-r={r} data-c={c}
      aria-label={a.name + ' — ' + sname(s)} value={val}
      onFocus={() => { focused.current = true }} onBlur={() => { focused.current = false; commit() }}
      onChange={e => setVal(e.target.value)} onKeyDown={onKey} />
  )
}

/* ---------- criterios ---------- */
function Criterios({ gid }) {
  const st = useAppState(), { open } = useModal()
  const gd = groupDoc(st.docs, gid), cs = sortedCriteria(gd)
  const total = cs.reduce((s, c) => s + (Number(c.weight) || 0), 0)
  const cnt = id => gd.activities.filter(a => (a.criteria || []).includes(id)).length
  let lastCe = null
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="row"><span className="label">Suma de pesos</span><span className={'tag num ' + (Math.abs(total - 100) < 0.01 ? 'ok' : 'amber')}>{fmtW(total)} %</span></div>
        <div className="row"><button className="btn" onClick={() => open(<BulkCritModal gid={gid} />)}>Pegar lista</button><button className="btn primary" onClick={() => open(<CritModal gid={gid} />)}>+ Criterio</button></div>
      </div>
      {!cs.length ? <div className="empty"><h2>Sin criterios todavía</h2><p>Añade los criterios de evaluación de la programación (por ejemplo 1.1, 1.2…) con su peso en porcentaje.</p></div> : (
        <div className="panel" style={{ padding: '6px 18px' }}><div className="list">{cs.map(c => {
          const ce = c.code.split('.')[0], sep = ce !== lastCe
          lastCe = ce
          return (
            <div key={c.id}>
              {sep ? <div className="label" style={{ padding: '12px 0 2px' }}>Competencia específica {ce}</div> : null}
              <div className="item clickable" onClick={() => open(<CritModal gid={gid} cid={c.id} />)}>
                <span className="num" style={{ fontWeight: 600, minWidth: 42 }}>{c.code}</span>
                <div className="grow"><div style={{ fontSize: '.92rem' }}>{c.desc || 'Sin descripción'}</div><div className="s">{cnt(c.id)} actividad{cnt(c.id) === 1 ? '' : 'es'}</div></div>
                <span className="tag num">{fmtW(c.weight)} %</span>
              </div>
            </div>
          )
        })}</div></div>
      )}
      <p className="legend">Si en un trimestre solo se evalúan algunos criterios, sus pesos se reparten proporcionalmente para calcular la nota del periodo.</p>
    </>
  )
}

/* ---------- alumnos ---------- */
function Alumnos({ gid, trim, setTrim }) {
  const st = useAppState(), { open } = useModal()
  const meta = metaOf(st.docs), gd = groupDoc(st.docs, gid), A = attDoc(st.docs, gid), sts = sortedStudents(gd)
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Seg label="Periodo" value={trim} onChange={setTrim} options={TRIM_OPTS} />
        <button className="btn primary" onClick={() => open(<StudentsModal gid={gid} />)}>+ Alumnos</button>
      </div>
      {!sts.length ? <div className="empty"><h2>Sin alumnos</h2><p>Pega la lista de clase para empezar.</p></div> : (
        <div className="panel" style={{ padding: '6px 18px' }}><div className="list">{sts.map(s => {
          const c = attCounts(meta, A, s.id, trim), no = A.obs.filter(o => o.sid === s.id).length
          return (
            <div key={s.id} className="item clickable" onClick={() => open(<StudentModal gid={gid} sid={s.id} />)}>
              <div className="grow"><div className="t">{sname(s)}</div><div className="counts">F {c.F} · R {c.R} · J {c.J}{no ? ` · ${no} anotaci${no === 1 ? 'ón' : 'ones'}` : ''}</div></div>
              <Grade v={finalGrade(gd, s.id, trim)} />
            </div>
          )
        })}</div></div>
      )}
    </>
  )
}
