// Horario: sesiones fijas semanales + cambios puntuales + días no lectivos.
//
// Cambios puntuales (meta.overrides), solo afectan a una fecha:
//   { kind: 'cancel', sessId, date }                    → esa sesión fija no se da ese día
//   { kind: 'add', date, start, end, groupId, room }    → clase extra ese día
//   mover = un 'cancel' en su día + un 'add' con fromId = id del 'cancel'
import { weekday } from './dates'
import { metaOf, groupDoc, groupOf } from './grades'
import { sessType, SESSION_TYPES } from './model'

/** Nombre corto de una sesión: el grupo si es clase; si no, el tipo (y el grupo o detalle si lo tiene). */
export function sessLabel(meta, s) {
  const type = sessType(s), g = meta.groups.find(x => x.id === s.groupId)
  if (type === 'clase') return g ? g.name : 'Clase'
  return SESSION_TYPES[type].label + (g ? ' · ' + g.name : s.note ? ' · ' + s.note : '')
}

/** Día no lectivo que cubre esa fecha (o null). */
export function blockedOn(meta, date) {
  return (meta.blocked || []).find(b => date >= b.start && date <= (b.end || b.start)) || null
}

/**
 * Clases de un día, ordenadas por hora. Cada una:
 * { key, date, groupId, start, end, room, sessId?, overrideId?, fixed, added, cancelled, cancelId?, movedTo?, movedFrom?, reason? }
 */
export function classesOn(meta, date) {
  const wd = weekday(date)
  const ov = (meta.overrides || []).filter(o => o.date === date)
  const all = meta.overrides || []
  const out = []
  for (const s of meta.schedule) {
    const type = sessType(s)
    // Las clases necesitan un grupo que exista; guardias, tutorías, reuniones y horas libres no
    if (s.day !== wd || (type === 'clase' && !meta.groups.some(g => g.id === s.groupId))) continue
    const cancel = ov.find(o => o.kind === 'cancel' && o.sessId === s.id)
    const dest = cancel ? all.find(o => o.fromId === cancel.id) : null
    out.push({ key: 's-' + s.id, date, type, note: s.note || '', groupId: meta.groups.some(g => g.id === s.groupId) ? s.groupId : '', start: s.start, end: s.end, room: s.room, sessId: s.id, fixed: true,
      cancelled: !!cancel, cancelId: cancel ? cancel.id : null, movedTo: dest ? dest.date : null, reason: cancel ? cancel.reason : '' })
  }
  for (const o of ov) {
    const type = sessType(o)
    if (o.kind !== 'add' || (type === 'clase' && !meta.groups.some(g => g.id === o.groupId))) continue
    const from = o.fromId ? all.find(x => x.id === o.fromId) : null
    out.push({ key: 'o-' + o.id, date, type, note: o.note || '', groupId: o.groupId, start: o.start, end: o.end, room: o.room, overrideId: o.id, added: true,
      movedFrom: from ? from.date : null, reason: o.reason || '' })
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

/**
 * Tipo de actividad del grupo:
 *   'task' → tarea del planificador (con fechas de disponibilidad y, si se quiere, control de entregas)
 *   'exam' → examen (sale en el calendario)
 *   'grade'→ otra actividad calificable (solo en Notas)
 */
export const actKind = a => a.kind || (a.type === 'Examen' ? 'exam' : a.delivery ? 'task' : 'grade')
/** Estado de una tarea según sus fechas: programada (aún no disponible), abierta o cerrada (pasó la entrega). */
export function taskStatus(a, today) {
  if (actKind(a) !== 'task') return null
  if (a.date && a.date < today) return 'cerrada'
  if (a.start && a.start > today) return 'programada'
  return 'abierta'
}

/** Eventos, exámenes y entregas entre dos fechas, más los días no lectivos que se solapan. */
export function agenda(docs, from, to) {
  const meta = metaOf(docs), out = []
  for (const e of meta.events) if (e.date >= from && e.date <= to) out.push({ kind: 'ev', date: e.date, time: e.time || '', e, g: groupOf(docs, e.groupId) })
  for (const g of meta.groups) for (const a of groupDoc(docs, g.id).activities) {
    if (a.date && a.date >= from && a.date <= to && actKind(a) !== 'grade') out.push({ kind: 'act', date: a.date, time: '', a, g })
  }
  for (const b of meta.blocked || []) {
    if ((b.end || b.start) >= from && b.start <= to) out.push({ kind: 'block', date: b.start < from ? from : b.start, time: '', b })
  }
  return out.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time))
}
