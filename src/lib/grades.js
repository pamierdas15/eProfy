// Cálculo de notas por criterios de evaluación (LOMLOE) y utilidades del cuaderno.
import { defaultMeta, defaultGroupDoc, defaultAttDoc } from './model'

// ---- lectura segura de documentos ----
export const metaOf = docs => docs.meta || defaultMeta()
export const groupDoc = (docs, gid) => docs['g_' + gid] || defaultGroupDoc()
export const attDoc = (docs, gid) => docs['a_' + gid] || defaultAttDoc()
export const groupOf = (docs, gid) => metaOf(docs).groups.find(g => g.id === gid)

// ---- formato ----
export const fmtN = v => v == null || isNaN(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ',')
export const fmtW = v => fmtN(v).replace(',0', '')
export const gradeClass = v => v == null ? 'none' : v < 5 ? 'ins' : v < 6 ? 'suf' : v < 7 ? 'bien' : v < 9 ? 'not' : 'sob'
export const gradeWord = v => v == null ? '' : v < 5 ? 'Insuficiente' : v < 6 ? 'Suficiente' : v < 7 ? 'Bien' : v < 9 ? 'Notable' : 'Sobresaliente'
/** Convierte "7,5" o "7.5" en número; '' → null; texto no numérico → NaN */
export const parseNum = s => { s = String(s ?? '').trim().replace(',', '.'); if (s === '') return null; const n = Number(s); return isNaN(n) ? NaN : n }
export const r1 = v => v == null || isNaN(v) ? null : Math.round(v * 10) / 10

// ---- trimestres ----
export function trimOf(meta, dateS) {
  const t = meta.settings.trims
  for (let i = 0; i < t.length; i++) if (dateS >= t[i].start && dateS <= t[i].end) return i + 1
  if (dateS < t[0].start) return 1
  for (let i = t.length - 1; i >= 0; i--) if (dateS > t[i].end) return Math.min(i + 2, 3)
  return 1
}

// ---- alumnos ----
export const sortedStudents = g => [...g.students].sort((a, b) => ((a.surname || '') + a.name).localeCompare((b.surname || '') + b.name, 'es'))
export const sname = s => s.surname ? `${s.surname}, ${s.name}` : s.name
export const sortedCriteria = g => [...g.criteria].sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }))

// ---- notas ----
export function score(g, aid, sid) { const v = g.scores[aid] && g.scores[aid][sid]; return typeof v === 'number' ? v : null }
export function actsIn(g, trim) {
  return g.activities.filter(a => !trim || a.trim === trim)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.name.localeCompare(b.name))
}
/**
 * Nota de cada criterio: media ponderada (por el peso de cada actividad) de las
 * actividades del periodo que lo evalúan, normalizadas a 10. trim 0 = todo el curso.
 */
export function critGrades(g, sid, trim) {
  const res = {}
  for (const c of g.criteria) {
    let s = 0, w = 0
    for (const a of g.activities) {
      if (trim && a.trim !== trim) continue
      if (!(a.criteria || []).includes(c.id)) continue
      const v = score(g, a.id, sid); if (v == null) continue
      const aw = Number(a.weight) || 1
      s += (v / (Number(a.max) || 10)) * 10 * aw; w += aw
    }
    res[c.id] = w ? s / w : null
  }
  return res
}
/** Nota del periodo: media de los criterios evaluados, ponderada por su peso (se reparte entre los evaluados). */
export function finalGrade(g, sid, trim) {
  const cg = critGrades(g, sid, trim); let s = 0, w = 0
  for (const c of g.criteria) if (cg[c.id] != null) { const cw = Number(c.weight) || 0; s += cg[c.id] * cw; w += cw }
  return w ? s / w : null
}
export function avg(arr) { const v = arr.filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }

// ---- asistencia ----
export function attCounts(meta, a, sid, trim) {
  const c = { F: 0, R: 0, J: 0 }
  for (const d in a.att) { if (trim && trimOf(meta, d) !== trim) continue; const v = a.att[d][sid]; if (c[v] != null) c[v]++ }
  return c
}
