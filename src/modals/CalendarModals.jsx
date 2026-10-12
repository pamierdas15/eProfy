import { useState } from 'react'
import { useAppState } from '../store/store'
import * as act from '../store/actions'
import { Modal, Field, useModal, useToast } from '../components/ui.jsx'
import { EV_TYPES, BLOCK_TYPES } from '../lib/model'
import { metaOf, groupOf, groupDoc, trimOf } from '../lib/grades'
import { classesOn, actKind } from '../lib/schedule'
import { PlanModal } from './ActModal.jsx'
import { todayISO, DIAS, addDays, diffDays, fmtShort, fmtLong } from '../lib/dates'
import { exportExcel } from '../lib/excel'

const GroupSelect = ({ meta, name, value, none, id }) => (
  <select id={id} name={name} defaultValue={value || ''}>
    {none ? <option value="">— Ninguno —</option> : null}
    {meta.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
  </select>
)

/* ---------- añadir al calendario ---------- */
export function AddModal({ date }) {
  const { open } = useModal()
  const opts = [
    ['Examen', 'Fecha, contenidos y material permitido. Sale en el calendario.', () => open(<PlanModal kind="exam" date={date} />)],
    ['Tarea o proyecto', 'Con fechas de disponibilidad, instrucciones, formato y control de entregas.', () => open(<PlanModal kind="task" date={date} />)],
    ['Otro evento', 'Excursión, reunión, sesión de evaluación, actividad del centro…', () => open(<EventModal date={date} />)],
    ['Día no lectivo', 'Festivo, vacaciones o ausencia: ese día no aparecen clases.', () => open(<BlockModal date={date} />)]
  ]
  return (
    <Modal title={'Añadir · ' + fmtLong(date || todayISO())}>
      <div className="choose">{opts.map(([t, d, fn]) => (
        <button type="button" key={t} className="choose-opt" onClick={fn}><b>{t}</b><span>{d}</span></button>
      ))}</div>
    </Modal>
  )
}

/* ---------- eventos ---------- */
export function EventModal({ id, date }) {
  const st = useAppState(), toast = useToast(), { close } = useModal()
  const meta = metaOf(st.docs)
  const e = id ? meta.events.find(x => x.id === id) : { title: '', date: date || todayISO(), time: '', type: 'Examen', groupId: '', notes: '' }
  if (!e) return null
  const del = () => { const undo = act.deleteEvent(id); close(); toast('Evento eliminado', undo) }
  return (
    <Modal title={id ? 'Editar evento' : 'Nuevo evento'} left={id ? <button type="button" className="btn danger" onClick={del}>Eliminar</button> : null}
      onSubmit={fd => {
        const title = fd.get('title').trim(); if (!title || !fd.get('date')) { toast('Escribe el título y la fecha'); return false }
        act.saveEvent(id, { title, date: fd.get('date'), time: fd.get('time'), type: fd.get('type'), groupId: fd.get('groupId'), notes: fd.get('notes') })
      }}>
      <Field label="Título" id="f_etitle"><input id="f_etitle" name="title" required defaultValue={e.title} placeholder="Salida al Museo de la Ciencia" /></Field>
      <div className="frow">
        <Field label="Fecha" id="f_edate"><input type="date" id="f_edate" name="date" required defaultValue={e.date} /></Field>
        <Field label="Hora" id="f_etime"><input type="time" id="f_etime" name="time" defaultValue={e.time || ''} /></Field>
      </div>
      <div className="frow">
        <Field label="Tipo" id="f_etype"><select id="f_etype" name="type" defaultValue={e.type}>{EV_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Grupo" id="f_egroup"><GroupSelect meta={meta} name="groupId" value={e.groupId} none id="f_egroup" /></Field>
      </div>
      <Field label="Notas" id="f_enotes"><textarea id="f_enotes" name="notes" style={{ minHeight: 70 }} defaultValue={e.notes || ''} /></Field>
    </Modal>
  )
}

/* ---------- sesiones del horario semanal ---------- */
export function SessModal({ id, day }) {
  const st = useAppState(), toast = useToast(), { close } = useModal()
  const meta = metaOf(st.docs)
  if (!meta.groups.length) return <Modal title="Nueva sesión"><p style={{ margin: 0 }}>Crea primero un grupo.</p></Modal>
  const s = id ? meta.schedule.find(x => x.id === id) : { day: day || 1, start: '08:30', end: '09:25', groupId: meta.groups[0].id, room: '' }
  if (!s) return null
  const del = () => { const undo = act.deleteSess(id); close(); toast('Sesión eliminada del horario', undo) }
  return (
    <Modal title={id ? 'Editar sesión' : 'Nueva sesión'} left={id ? <button type="button" className="btn danger" onClick={del}>Eliminar</button> : null}
      onSubmit={fd => {
        if (fd.get('end') <= fd.get('start')) { toast('La hora de fin debe ser posterior al inicio'); return false }
        act.saveSess(id, { day: Number(fd.get('day')), start: fd.get('start'), end: fd.get('end'), groupId: fd.get('groupId'), room: fd.get('room').trim() })
      }}>
      <div className="frow">
        <Field label="Día" id="f_sday"><select id="f_sday" name="day" defaultValue={s.day}>{[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{DIAS[d]}</option>)}</select></Field>
        <Field label="Grupo" id="f_sgroup"><GroupSelect meta={meta} name="groupId" value={s.groupId} id="f_sgroup" /></Field>
      </div>
      <div className="frow">
        <Field label="Inicio" id="f_sstart"><input type="time" id="f_sstart" name="start" required defaultValue={s.start} /></Field>
        <Field label="Fin" id="f_send"><input type="time" id="f_send" name="end" required defaultValue={s.end} /></Field>
        <Field label="Aula" id="f_sroom"><input id="f_sroom" name="room" defaultValue={s.room} placeholder="Taller 1" /></Field>
      </div>
    </Modal>
  )
}

/* ---------- días no lectivos ---------- */
export function BlockModal({ id, date }) {
  const st = useAppState(), toast = useToast(), { close } = useModal()
  const meta = metaOf(st.docs)
  const b = id ? meta.blocked.find(x => x.id === id) : { start: date || todayISO(), end: date || todayISO(), type: 'festivo', note: '' }
  const [range, setRange] = useState({ start: b ? b.start : '', end: b ? (b.end || b.start) : '' })
  if (!b) return null

  // Qué se ve afectado: clases del horario y exámenes o entregas en esas fechas
  const days = range.start && range.end && range.end >= range.start ? Math.min(diffDays(range.start, range.end), 120) + 1 : 0
  const classes = [], acts = []
  for (let i = 0; i < days; i++) {
    const d = addDays(range.start, i)
    classesOn(meta, d).filter(c => !c.cancelled).forEach(c => classes.push(c))
  }
  for (const g of meta.groups) for (const a of groupDoc(st.docs, g.id).activities) {
    if (a.date && a.date >= range.start && a.date <= range.end && actKind(a) !== 'grade') acts.push({ a, g })
  }
  const del = () => { const undo = act.deleteBlock(id); close(); toast('Día no lectivo eliminado', undo) }
  return (
    <Modal title={id ? 'Editar día no lectivo' : 'Bloquear días'} left={id ? <button type="button" className="btn danger" onClick={del}>Eliminar</button> : null}
      onSubmit={fd => {
        const start = fd.get('start'), end = fd.get('end') || start
        if (!start || end < start) { toast('Revisa las fechas: el final no puede ser anterior al inicio'); return false }
        act.saveBlock(id, { start, end, type: fd.get('type'), note: fd.get('note').trim() })
        toast(id ? 'Día no lectivo actualizado' : 'Días bloqueados')
      }}>
      <div className="frow">
        <Field label="Desde" id="f_bstart"><input type="date" id="f_bstart" name="start" required value={range.start} onChange={e => setRange(r => ({ start: e.target.value, end: r.end < e.target.value ? e.target.value : r.end }))} /></Field>
        <Field label="Hasta" id="f_bend"><input type="date" id="f_bend" name="end" value={range.end} onChange={e => setRange(r => ({ ...r, end: e.target.value }))} /></Field>
      </div>
      <div className="frow">
        <Field label="Tipo" id="f_btype"><select id="f_btype" name="type" defaultValue={b.type}>{Object.entries(BLOCK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Nota (opcional)" id="f_bnote"><input id="f_bnote" name="note" defaultValue={b.note} placeholder="Navidad, baja médica, huelga…" /></Field>
      </div>
      {classes.length || acts.length ? (
        <div className="affected" role="status">
          {classes.length ? <div><b>{classes.length}</b> clase{classes.length === 1 ? '' : 's'} del horario no se darán{days === 1 ? ': ' + classes.map(c => (groupOf(st.docs, c.groupId) || {}).name + ' ' + c.start).join(', ') : ''}.</div> : null}
          {acts.map(({ a, g }) => <div key={a.id}>⚠ {actKind(a) === 'exam' ? 'Examen' : 'Entrega'} «{a.name}» de {g.name} el {fmtShort(a.date)}: quizá quieras cambiar la fecha.</div>)}
        </div>
      ) : null}
    </Modal>
  )
}

/* ---------- cambios puntuales de clase ---------- */
/** mode 'add' (clase puntual) o 'move' (cls = clase a mover). */
export function ClassModal({ mode, date, cls }) {
  const st = useAppState(), toast = useToast()
  const meta = metaOf(st.docs)
  if (!meta.groups.length) return <Modal title="Clase puntual"><p style={{ margin: 0 }}>Crea primero un grupo.</p></Modal>
  const moving = mode === 'move'
  const base = moving ? cls : { date: date || todayISO(), start: '08:30', end: '09:25', groupId: meta.groups[0].id, room: '' }
  const g = moving ? groupOf(st.docs, cls.groupId) : null
  return (
    <Modal title={moving ? 'Mover clase de ' + (g ? g.name : '') : 'Añadir clase puntual'} submitLabel={moving ? 'Mover' : 'Añadir'}
      onSubmit={fd => {
        const to = { date: fd.get('date'), start: fd.get('start'), end: fd.get('end'), room: fd.get('room').trim(), reason: fd.get('reason').trim() }
        if (!to.date || !to.start || !to.end) { toast('Indica fecha, inicio y fin'); return false }
        if (to.end <= to.start) { toast('La hora de fin debe ser posterior al inicio'); return false }
        if (moving) {
          if (to.date === cls.date && to.start === cls.start) { toast('Elige otra fecha u otra hora'); return false }
          toast('Clase movida al ' + fmtShort(to.date), act.moveClass(cls, to))
        } else {
          toast('Clase añadida el ' + fmtShort(to.date), act.addClass({ ...to, groupId: fd.get('groupId') }))
        }
      }}>
      {moving ? <p className="muted" style={{ margin: 0 }}>Original: {fmtLong(cls.date)}, {cls.start}–{cls.end}. Solo cambia esta vez; el horario semanal no se toca.</p> : (
        <Field label="Grupo" id="f_cgroup"><GroupSelect meta={meta} name="groupId" value={base.groupId} id="f_cgroup" /></Field>
      )}
      <div className="frow">
        <Field label={moving ? 'Nueva fecha' : 'Fecha'} id="f_cdate"><input type="date" id="f_cdate" name="date" required defaultValue={base.date} /></Field>
        <Field label="Inicio" id="f_cstart"><input type="time" id="f_cstart" name="start" required defaultValue={base.start} /></Field>
        <Field label="Fin" id="f_cend"><input type="time" id="f_cend" name="end" required defaultValue={base.end} /></Field>
      </div>
      <div className="frow">
        <Field label="Aula" id="f_croom"><input id="f_croom" name="room" defaultValue={base.room || ''} /></Field>
        <Field label="Motivo (opcional)" id="f_creason"><input id="f_creason" name="reason" placeholder={moving ? 'Excursión, examen de otra materia…' : 'Recuperación, refuerzo…'} /></Field>
      </div>
    </Modal>
  )
}

/* ---------- exportar a Excel ---------- */
export function ExcelModal({ gid, trim }) {
  const st = useAppState(), toast = useToast()
  const meta = metaOf(st.docs)
  const tr = trim == null ? trimOf(meta, todayISO()) : trim
  if (!meta.groups.length) return <Modal title="Exportar notas a Excel"><p style={{ margin: 0 }}>Crea primero un grupo.</p></Modal>
  return (
    <Modal title="Exportar notas a Excel" submitLabel="Descargar Excel" onSubmit={fd => {
      exportExcel(st.docs, fd.get('gid') || null, Number(fd.get('trim')))
        .then(name => toast('Excel descargado: ' + name))
        .catch(() => toast('No se pudo generar el Excel. Comprueba la conexión e inténtalo de nuevo.'))
    }}>
      <div className="frow">
        <Field label="Grupo" id="f_xg"><select id="f_xg" name="gid" defaultValue={gid || ''}>
          <option value="">Todos los grupos (una hoja por grupo)</option>
          {meta.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select></Field>
        <Field label="Periodo" id="f_xt"><select id="f_xt" name="trim" defaultValue={tr}>
          {[1, 2, 3].map(n => <option key={n} value={n}>{n}.º trimestre</option>)}
          <option value={0}>Evaluación final</option>
        </select></Field>
      </div>
      <p className="hint" style={{ margin: 0 }}>Incluye la nota de cada criterio, la nota del periodo, la calificación y las faltas. Si eliges un solo grupo, añade también las notas por actividad y la lista de criterios.</p>
    </Modal>
  )
}
