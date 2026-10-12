import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../store/store'
import { useNav } from '../nav'
import * as act from '../store/actions'
import { useModal, useToast, Grade, Seg, GroupChips } from '../components/ui.jsx'
import { NoGroups } from '../components/common.jsx'
import { StudentsModal, StudentModal, CritModal, BulkCritModal } from '../modals/GroupModals.jsx'
import { ActModal } from '../modals/ActModal.jsx'
import { ExcelModal } from '../modals/CalendarModals.jsx'
import { metaOf, groupDoc, groupOf, trimOf, sortedStudents, sortedCriteria, sname, actsIn, score, critGrades, finalGrade, avg, fmtN, fmtW, parseNum } from '../lib/grades'
import { todayISO, fmtDay } from '../lib/dates'

// Pestaña Notas (formato Completo): cuaderno de calificaciones por criterios LOMLOE de cada grupo.

const TRIM_OPTS = [[1, '1.º T'], [2, '2.º T'], [3, '3.º T'], [0, 'Final']]

export default function Notas({ params }) {
  const st = useAppState(), { go } = useNav()
  const meta = metaOf(st.docs)
  const [gid, setGid] = useState(params.gid || (meta.groups[0] && meta.groups[0].id))
  const [tab, setTab] = useState(params.tab || 'cuaderno')
  const [trim, setTrim] = useState(() => trimOf(meta, todayISO()))
  const head = <div className="top"><div><h1>Notas</h1><div className="sub">Cuaderno de calificaciones por criterios de evaluación</div></div></div>
  if (!meta.groups.length) return <>{head}<NoGroups /></>
  const g = groupOf(st.docs, gid) || meta.groups[0]
  const gd = groupDoc(st.docs, g.id)
  return (
    <>
      {head}
      <div className="stack" style={{ gap: 14 }}>
        <GroupChips groups={meta.groups} value={g.id} onChange={setGid} />
        <div className="sub" style={{ marginTop: -4 }}>{g.subject ? g.subject + ' · ' : ''}{gd.students.length} alumnos · {gd.criteria.length} criterios · <button className="linkbtn" onClick={() => go('grupos', { gid: g.id })}>ver grupo</button></div>
        <div className="tabs" style={{ marginBottom: 0 }}>{[['cuaderno', 'Cuaderno'], ['criterios', 'Criterios']].map(([k, l]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}</div>
        <div>{tab === 'criterios' ? <Criterios gid={g.id} /> : <Cuaderno gid={g.id} trim={trim} setTrim={setTrim} goTab={setTab} />}</div>
      </div>
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

