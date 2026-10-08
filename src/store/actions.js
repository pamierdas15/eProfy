// Acciones sobre los datos. Las que borran o deshacen trabajo devuelven una función «deshacer».
import { change, replaceAll, getState } from './store'
import { uid, defaultMeta } from '../lib/model'
import { todayISO } from '../lib/dates'
import { metaOf, groupDoc, trimOf } from '../lib/grades'

/* ---------- grupos ---------- */
export function addGroup({ name, subject, color }) {
  const id = uid()
  change(d => { d.meta.groups.push({ id, name, subject, color }); d.g(id); d.a(id) })
  ensureSince()
  return id
}
export const updateGroup = (gid, fields) => change(d => { Object.assign(d.meta.groups.find(g => g.id === gid), fields) })
export const deleteGroup = gid => change(d => {
  const m = d.meta
  m.groups = m.groups.filter(g => g.id !== gid)
  m.schedule = m.schedule.filter(s => s.groupId !== gid)
  m.overrides = (m.overrides || []).filter(o => o.groupId !== gid)
  m.events.forEach(e => { if (e.groupId === gid) e.groupId = '' })
  d.remove('g_' + gid); d.remove('a_' + gid)
})

/* ---------- alumnos ---------- */
export function parseStudentList(text) {
  return text.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
    if (l.includes(',')) { const [surname, ...rest] = l.split(','); return { id: uid(), surname: surname.trim(), name: rest.join(',').trim() } }
    const p = l.split(/\s+/); const name = p.shift(); return { id: uid(), name, surname: p.join(' ') }
  })
}
export const addStudents = (gid, list) => change(d => { d.g(gid).students.push(...list) })
export const updateStudent = (gid, sid, fields) => change(d => { Object.assign(d.g(gid).students.find(s => s.id === sid), fields) })
export const deleteStudent = (gid, sid) => change(d => {
  const g = d.g(gid)
  g.students = g.students.filter(s => s.id !== sid)
  for (const k in g.scores) delete g.scores[k][sid]
  for (const k in g.delivery) delete g.delivery[k][sid]
})
export const addObs = (gid, obs) => change(d => { d.a(gid).obs.push({ id: uid(), ...obs }) })
export const deleteObs = (gid, oid) => change(d => { const a = d.a(gid); a.obs = a.obs.filter(o => o.id !== oid) })

/* ---------- criterios ---------- */
export const saveCrit = (gid, cid, obj) => change(d => {
  const g = d.g(gid)
  if (cid) Object.assign(g.criteria.find(c => c.id === cid), obj); else g.criteria.push({ id: uid(), ...obj })
})
export const addCrits = (gid, list) => change(d => { d.g(gid).criteria.push(...list.map(c => ({ id: uid(), ...c }))) })
export const deleteCrit = (gid, cid) => change(d => {
  const g = d.g(gid)
  g.criteria = g.criteria.filter(c => c.id !== cid)
  g.activities.forEach(a => { a.criteria = (a.criteria || []).filter(id => id !== cid) })
})

/* ---------- actividades y notas ---------- */
export function saveAct(gid, aid, obj) {
  const meta = metaOf(getState().docs)
  const full = { ...obj, trim: obj.date ? trimOf(meta, obj.date) : (obj.trim || trimOf(meta, todayISO())) }
  return change(d => { const g = d.g(gid); if (aid) Object.assign(g.activities.find(a => a.id === aid), full); else g.activities.push({ id: uid(), ...full }) })
}
export const deleteAct = (gid, aid) => change(d => { const g = d.g(gid); g.activities = g.activities.filter(a => a.id !== aid); delete g.scores[aid]; delete g.delivery[aid] })
export const setScore = (gid, aid, sid, v) => change(d => {
  const g = d.g(gid); const S = g.scores[aid] || (g.scores[aid] = {})
  if (v == null) delete S[sid]; else S[sid] = v
})

/* ---------- asistencia ---------- */
export const setAtt = (gid, date, sid, code) => change(d => {
  const A = d.a(gid), day = A.att[date] || (A.att[date] = {})
  if (code) day[sid] = code; else delete day[sid]
  if (!Object.keys(day).length) delete A.att[date]
})
export const allPresent = (gid, date) => change(d => {
  const A = d.a(gid), day = A.att[date] || (A.att[date] = {})
  groupDoc(getState().docs, gid).students.forEach(s => { if (!day[s.id]) day[s.id] = 'P' })
})
export const clearAtt = (gid, date) => change(d => { delete d.a(gid).att[date] })

/* ---------- entregas ---------- */
const DLV_ORDER = ['', 'E', 'T', 'N']
export const cycleDelivery = (gid, aid, sid) => change(d => {
  const g = d.g(gid), D = g.delivery[aid] || (g.delivery[aid] = {})
  const nx = DLV_ORDER[(DLV_ORDER.indexOf(D[sid] || '') + 1) % 4]
  if (nx) D[sid] = nx; else delete D[sid]
})
export const restNotDelivered = (gid, aid) => change(d => {
  const g = d.g(gid), D = g.delivery[aid] || (g.delivery[aid] = {})
  g.students.forEach(s => { if (!D[s.id]) D[s.id] = 'N' })
})

/* ---------- eventos y horario ---------- */
export const saveEvent = (id, obj) => change(d => { const m = d.meta; if (id) Object.assign(m.events.find(e => e.id === id), obj); else m.events.push({ id: uid(), ...obj }) })
export const deleteEvent = id => change(d => { d.meta.events = d.meta.events.filter(e => e.id !== id) })
export const saveSess = (id, obj) => change(d => { const m = d.meta; if (id) Object.assign(m.schedule.find(s => s.id === id), obj); else m.schedule.push({ id: uid(), ...obj }) })
export const deleteSess = id => change(d => {
  const m = d.meta
  m.schedule = m.schedule.filter(s => s.id !== id)
  const cancels = (m.overrides || []).filter(o => o.sessId === id).map(o => o.id)
  m.overrides = (m.overrides || []).filter(o => o.sessId !== id && !cancels.includes(o.fromId))
})

/* ---------- días no lectivos ---------- */
export const saveBlock = (id, obj) => change(d => { const m = d.meta; if (id) Object.assign(m.blocked.find(b => b.id === id), obj); else m.blocked.push({ id: uid(), ...obj }) })
export const deleteBlock = id => change(d => { d.meta.blocked = d.meta.blocked.filter(b => b.id !== id) })

/* ---------- cambios puntuales de clase (cls = elemento de classesOn) ---------- */
export const cancelClass = (cls, reason) => change(d => {
  d.meta.overrides.push({ id: uid(), kind: 'cancel', sessId: cls.sessId, date: cls.date, reason: reason || '' })
})
/** Vuelve a activar una clase fija cancelada; si se había movido, quita también la clase del otro día. */
export const restoreClass = cls => change(d => {
  d.meta.overrides = d.meta.overrides.filter(o => o.id !== cls.cancelId && o.fromId !== cls.cancelId)
})
export const addClass = obj => change(d => { d.meta.overrides.push({ id: uid(), kind: 'add', ...obj }) })
export const moveClass = (cls, to) => change(d => {
  const m = d.meta
  if (cls.added) { Object.assign(m.overrides.find(o => o.id === cls.overrideId), to); return }
  const cancelId = uid()
  m.overrides.push({ id: cancelId, kind: 'cancel', sessId: cls.sessId, date: cls.date, reason: to.reason || '' })
  m.overrides.push({ id: uid(), kind: 'add', groupId: cls.groupId, room: cls.room, ...to, fromId: cancelId })
})
/** Quita una clase añadida. Si venía de mover una fija, la fija vuelve a su día. */
export const removeAdded = cls => change(d => {
  const m = d.meta, o = m.overrides.find(x => x.id === cls.overrideId)
  m.overrides = m.overrides.filter(x => x.id !== cls.overrideId && !(o && o.fromId && x.id === o.fromId))
})

/* ---------- ajustes y copias ---------- */
export const setTrims = trims => change(d => { d.meta.settings.trims = trims })
export const markBackup = () => change(d => { d.meta.settings.lastBackup = todayISO() })
export function ensureSince() {
  const m = metaOf(getState().docs)
  if (!m.settings.since) change(d => { d.meta.settings.since = todayISO() })
}
export const wipeAll = () => replaceAll({ meta: defaultMeta() })
