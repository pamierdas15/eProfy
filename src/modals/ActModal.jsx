import { useState } from 'react'
import { useAppState } from '../store/store'
import * as act from '../store/actions'
import { Modal, Field, useModal, useToast } from '../components/ui.jsx'
import { ACT_TYPES, TASK_TYPES, TASK_FORMATS, isFull } from '../lib/model'
import { groupDoc, metaOf, sortedCriteria, parseNum } from '../lib/grades'
import { actKind } from '../lib/schedule'
import { todayISO, addDays } from '../lib/dates'

/** Selector de grupo para actividades nuevas (cambia el grupo sin cerrar la ventana). */
function GroupPick({ meta, gid, setGid }) {
  return (
    <Field label="Grupo" id="f_agid">
      <select id="f_agid" value={gid} onChange={e => setGid(e.target.value)}>{meta.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
    </Field>
  )
}

/** Bloque de evaluación (formato Completo): criterios, nota máxima y peso. */
function GradeFields({ gd, a, toggle }) {
  const cs = sortedCriteria(gd)
  const [on, setOn] = useState(a.graded !== false)
  return (
    <div className="stack" style={{ gap: 12 }}>
      {toggle ? <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}><input type="checkbox" name="graded" checked={on} onChange={e => setOn(e.target.checked)} /> Calificar en el cuaderno de notas</label> : <input type="hidden" name="graded" value="on" />}
      {on ? (
        <>
          <div className="frow">
            <Field label="Nota máxima" id="f_amax"><input id="f_amax" name="max" inputMode="decimal" defaultValue={String(a.max || 10).replace('.', ',')} /></Field>
            <Field label="Peso en el criterio" id="f_aw" hint="1 = normal, 2 = cuenta el doble"><input id="f_aw" name="weight" inputMode="decimal" defaultValue={String(a.weight || 1).replace('.', ',')} /></Field>
          </div>
          <div className="fld"><span className="lb">Criterios que evalúa</span>
            {cs.length ? (
              <div className="checks">{cs.map(c => (
                <label key={c.id}><input type="checkbox" name="crit" value={c.id} defaultChecked={(a.criteria || []).includes(c.id)} /><span><b>{c.code}</b> {(c.desc || '').slice(0, 90)}</span></label>
              ))}</div>
            ) : <span className="hint">Este grupo aún no tiene criterios (Notas → Criterios). No contará en la nota hasta que la vincules.</span>}
          </div>
        </>
      ) : null}
    </div>
  )
}
const gradeValues = (fd, gd) => {
  const valid = new Set(gd.criteria.map(c => c.id))
  return { graded: !!fd.get('graded'), max: parseNum(fd.get('max')) || 10, weight: parseNum(fd.get('weight')) || 1, criteria: fd.getAll('crit').filter(id => valid.has(id)) }
}

/** Actividad calificable del cuaderno de notas (pestaña Notas). */
export function ActModal({ gid: gid0, aid }) {
  const st = useAppState(), toast = useToast(), { close } = useModal()
  const meta = metaOf(st.docs)
  const [gid, setGid] = useState(gid0 || (meta.groups[0] && meta.groups[0].id))
  if (!gid) return <Modal title="Nueva actividad"><p style={{ margin: 0 }}>Crea primero un grupo.</p></Modal>
  const gd = groupDoc(st.docs, gid)
  const a = aid ? gd.activities.find(x => x.id === aid) : { name: '', type: 'Examen', date: todayISO(), criteria: [], weight: 1, max: 10 }
  if (!a) return null
  const del = () => { const undo = act.deleteAct(gid, aid); close(); toast('«' + a.name + '» eliminada', undo) }
  return (
    <Modal title={aid ? 'Editar actividad' : 'Nueva actividad'} left={aid ? <button type="button" className="btn danger" onClick={del}>Eliminar</button> : null}
      onSubmit={fd => {
        const name = fd.get('name').trim(); if (!name) { toast('Escribe el nombre'); return false }
        const type = fd.get('type')
        const kind = aid ? (actKind(a) === 'task' ? 'task' : type === 'Examen' ? 'exam' : 'grade') : (type === 'Examen' ? 'exam' : 'grade')
        act.saveAct(gid, aid, { name, type, kind, date: fd.get('date') || '', ...gradeValues(fd, gd), graded: true })
        toast(aid ? 'Actividad actualizada' : 'Actividad creada')
      }}>
      {!aid ? <GroupPick meta={meta} gid={gid} setGid={setGid} /> : null}
      <Field label="Nombre" id="f_aname"><input id="f_aname" name="name" required defaultValue={a.name} placeholder="Examen tema 2: Estructuras" /></Field>
      <div className="frow">
        <Field label="Tipo" id="f_atype"><select id="f_atype" name="type" defaultValue={a.type}>{ACT_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Fecha" id="f_adate"><input type="date" id="f_adate" name="date" defaultValue={a.date || ''} /></Field>
      </div>
      <GradeFields key={gid} gd={gd} a={a} />
      {actKind(a) === 'task' ? <p className="hint" style={{ margin: 0 }}>Es una tarea del Planificador: sus fechas de disponibilidad y entregas se editan allí.</p> : null}
    </Modal>
  )
}

/**
 * Tarea del planificador (kind 'task') o examen (kind 'exam'), con todos sus detalles.
 * En formato Completo se puede calificar en el cuaderno de notas.
 */
export function PlanModal({ kind = 'task', gid: gid0, aid, date }) {
  const st = useAppState(), toast = useToast(), { close } = useModal()
  const meta = metaOf(st.docs), full = isFull(st.school)
  const [gid, setGid] = useState(gid0 || (meta.groups[0] && meta.groups[0].id))
  const exam = kind === 'exam'
  if (!gid) return <Modal title={exam ? 'Nuevo examen' : 'Nueva tarea'}><p style={{ margin: 0 }}>Crea primero un grupo en la pestaña Grupos.</p></Modal>
  const gd = groupDoc(st.docs, gid)
  const t = date || todayISO()
  const a = aid ? gd.activities.find(x => x.id === aid) : exam
    ? { name: '', type: 'Examen', kind: 'exam', date: t, time: '', desc: '', materials: '', graded: full, criteria: [], max: 10, weight: 1 }
    : { name: '', type: 'Tarea', kind: 'task', start: date ? addDays(date, -7) < todayISO() ? todayISO() : addDays(date, -7) : t, date: date || addDays(t, 7), desc: '', materials: '', format: 'Digital', duration: '', grouping: 'Individual', delivery: true, graded: full, criteria: [], max: 10, weight: 1 }
  if (!a) return null
  const del = () => { const undo = act.deleteAct(gid, aid); close(); toast('«' + a.name + '» eliminada', undo) }
  return (
    <Modal wide title={exam ? (aid ? 'Editar examen' : 'Nuevo examen') : (aid ? 'Editar tarea' : 'Nueva tarea')}
      left={aid ? <button type="button" className="btn danger" onClick={del}>Eliminar</button> : null}
      onSubmit={fd => {
        const name = fd.get('name').trim(); if (!name) { toast('Escribe el título'); return false }
        const base = { name, kind, desc: fd.get('desc').trim(), materials: fd.get('materials').trim() }
        let obj
        if (exam) obj = { ...base, type: 'Examen', date: fd.get('date'), time: fd.get('time') || '' }
        else {
          const start = fd.get('start'), end = fd.get('date')
          if (!end) { toast('Indica la fecha de entrega'); return false }
          if (start && start > end) { toast('La fecha de entrega no puede ser anterior a la de inicio'); return false }
          obj = { ...base, type: fd.get('type'), start: start || '', date: end, format: fd.get('format'), duration: fd.get('duration').trim(), grouping: fd.get('grouping'), delivery: !!fd.get('delivery') }
        }
        if (!obj.date) { toast('Indica la fecha'); return false }
        const gv = full ? gradeValues(fd, gd) : { graded: aid ? a.graded : false }
        act.saveAct(gid, aid, { ...obj, ...gv })
        toast(aid ? 'Guardado' : exam ? 'Examen añadido al calendario' : 'Tarea añadida al planificador')
      }}>
      {!aid ? <GroupPick meta={meta} gid={gid} setGid={setGid} /> : null}
      <Field label={exam ? 'Título del examen' : 'Título de la tarea'} id="f_pname"><input id="f_pname" name="name" required defaultValue={a.name} placeholder={exam ? 'Examen tema 3: Electricidad' : 'Proyecto: puente de palillos'} /></Field>
      {exam ? (
        <div className="frow">
          <Field label="Fecha" id="f_pdate"><input type="date" id="f_pdate" name="date" required defaultValue={a.date || ''} /></Field>
          <Field label="Hora (opcional)" id="f_ptime"><input type="time" id="f_ptime" name="time" defaultValue={a.time || ''} /></Field>
        </div>
      ) : (
        <>
          <div className="frow">
            <Field label="Tipo" id="f_ptype"><select id="f_ptype" name="type" defaultValue={a.type}>{TASK_TYPES.map(x => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Disponible desde" id="f_pstart" hint="Cuándo se presenta a los alumnos"><input type="date" id="f_pstart" name="start" defaultValue={a.start || ''} /></Field>
            <Field label="Fecha de entrega" id="f_pdate"><input type="date" id="f_pdate" name="date" required defaultValue={a.date || ''} /></Field>
          </div>
          <div className="frow">
            <Field label="Formato de entrega" id="f_pformat"><select id="f_pformat" name="format" defaultValue={a.format || 'Digital'}>{TASK_FORMATS.map(x => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Agrupamiento" id="f_pgroup"><select id="f_pgroup" name="grouping" defaultValue={a.grouping || 'Individual'}>{['Individual', 'Parejas', 'Grupos', 'Toda la clase'].map(x => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Dedicación" id="f_pdur" hint="Sesiones de clase o tiempo"><input id="f_pdur" name="duration" defaultValue={a.duration || ''} placeholder="3 sesiones + casa" /></Field>
          </div>
        </>
      )}
      <Field label={exam ? 'Contenidos que entran' : 'Descripción e instrucciones'} id="f_pdesc"><textarea id="f_pdesc" name="desc" style={{ minHeight: 90 }} defaultValue={a.desc || ''} placeholder={exam ? 'Temas 3 y 4: ley de Ohm, circuitos en serie y paralelo…' : 'Qué tienen que hacer, pasos, requisitos y cómo se valora…'} /></Field>
      <Field label={exam ? 'Material permitido' : 'Materiales y recursos'} id="f_pmat"><input id="f_pmat" name="materials" defaultValue={a.materials || ''} placeholder={exam ? 'Calculadora, regla' : 'Palillos, cola blanca, plantilla en el aula virtual'} /></Field>
      {!exam ? <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}><input type="checkbox" name="delivery" defaultChecked={a.delivery !== false} /> Controlar quién la entrega</label> : null}
      {full ? <div className="panel" style={{ padding: 14, background: 'var(--surface-2)' }}><div className="label" style={{ marginBottom: 8 }}>Evaluación</div><GradeFields key={gid} gd={gd} a={a} toggle /></div> : null}
    </Modal>
  )
}
