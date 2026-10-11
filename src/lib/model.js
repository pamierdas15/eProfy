// Modelo de datos de eProfy y migraciones.
//
// Todo se guarda como documentos JSON (en Firestore: users/{uid}/docs/{id}):
//   meta        → grupos, horario semanal, eventos, días no lectivos, cambios puntuales y ajustes
//   g_<grupo>   → alumnos, criterios, actividades, notas y entregas de un grupo
//   a_<grupo>   → asistencia y anotaciones de un grupo
//
// SCHEMA sube cada vez que cambia la forma de los datos. migrate() convierte los
// datos antiguos al formato actual: se ejecuta al abrir la app y al importar una copia.

export const SCHEMA = 2
/** Versión visible de la app (se muestra en Ajustes). */
export const APP_VERSION = 'Prueba 03'

export const defaultTrims = () => [
  { start: '2026-09-08', end: '2026-12-22' },
  { start: '2027-01-08', end: '2027-03-26' },
  { start: '2027-04-06', end: '2027-06-23' }
]

export const defaultMeta = () => ({
  schema: SCHEMA,
  groups: [],      // { id, name, subject, color }
  schedule: [],    // { id, day (1-5), start, end, groupId, room }
  events: [],      // { id, title, date, time, type, groupId, notes }
  blocked: [],     // { id, start, end, type: festivo|vacaciones|ausencia, note }
  overrides: [],   // { id, kind: 'cancel', sessId, date, reason } | { id, kind: 'add', date, start, end, groupId, room, reason, fromId? }
  settings: { trims: defaultTrims() }
})
export const defaultGroupDoc = () => ({ students: [], criteria: [], activities: [], scores: {}, delivery: {} })
export const defaultAttDoc = () => ({ att: {}, obs: [] })

export function defaultDoc(id) {
  if (id === 'meta') return defaultMeta()
  if (id.startsWith('g_')) return defaultGroupDoc()
  if (id.startsWith('a_')) return defaultAttDoc()
  return {}
}

/** Devuelve { docs, changed: [ids] } con los documentos en el formato actual. No modifica la entrada. */
export function migrate(input) {
  const docs = { ...input }
  const changed = new Set()
  const m = docs.meta ? { ...docs.meta } : null
  if (m && (m.schema || 1) < SCHEMA) {
    // v1 → v2: días no lectivos, cambios puntuales de clase y número de versión
    if (!Array.isArray(m.blocked)) m.blocked = []
    if (!Array.isArray(m.overrides)) m.overrides = []
    m.groups = m.groups || []; m.schedule = m.schedule || []; m.events = m.events || []
    m.settings = { trims: defaultTrims(), ...(m.settings || {}) }
    m.schema = SCHEMA
    docs.meta = m
    changed.add('meta')
  }
  for (const id of Object.keys(docs)) {
    const d = docs[id]
    if (!d) continue
    if (id.startsWith('g_')) {
      const fixed = { ...defaultGroupDoc(), ...d }
      if (JSON.stringify(fixed) !== JSON.stringify(d)) { docs[id] = fixed; changed.add(id) }
    } else if (id.startsWith('a_')) {
      const fixed = { ...defaultAttDoc(), ...d }
      if (JSON.stringify(fixed) !== JSON.stringify(d)) { docs[id] = fixed; changed.add(id) }
    }
  }
  return { docs, changed: [...changed] }
}

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)

export const GCOLORS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']
export const cvar = c => `var(--${c || 'g1'})`
export const ACT_TYPES = ['Examen', 'Tarea', 'Proyecto', 'Práctica', 'Exposición', 'Cuaderno', 'Observación', 'Otro']
export const EV_TYPES = ['Examen', 'Excursión', 'Reunión', 'Evaluación', 'Claustro', 'Recordatorio', 'Otro']
export const ATT = { P: 'Presente', F: 'Falta', R: 'Retraso', J: 'Justificada' }
export const DLV = { '': 'Pendiente', E: 'Entregado', T: 'Fuera de plazo', N: 'No entregado' }
export const BLOCK_TYPES = {
  festivo: { label: 'Festivo', short: 'Festivo' },
  vacaciones: { label: 'Vacaciones', short: 'Vacaciones' },
  ausencia: { label: 'Ausencia docente', short: 'Ausencia' }
}
