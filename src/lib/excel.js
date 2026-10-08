// Exportar notas a Excel. La librería (xlsx) se descarga solo al usarla, para que la app arranque rápido.
import { metaOf, groupDoc, attDoc, groupOf, sortedStudents, sortedCriteria, critGrades, finalGrade, gradeWord, attCounts, avg, r1, actsIn, score } from './grades'
import { todayISO, fmtLong, fmtDay } from './dates'

export function saveBlob(name, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase()

/** gid = null → todos los grupos (una hoja por grupo). trim 0 = evaluación final. Devuelve el nombre del archivo. */
export async function exportExcel(docs, gid, trim) {
  const XLSX = await import('xlsx')
  const meta = metaOf(docs)
  const wb = XLSX.utils.book_new(), used = new Set(), per = trim ? trim + '.º trimestre' : 'Evaluación final'
  const sheetName = n => { const b = n.replace(/[[\]:*?/\\]/g, '').slice(0, 28) || 'Grupo'; let x = b, i = 2; while (used.has(x)) x = b.slice(0, 26) + ' ' + i++; used.add(x); return x }
  const groups = gid ? [groupOf(docs, gid)] : meta.groups
  for (const g of groups) {
    const gd = groupDoc(docs, g.id), A = attDoc(docs, g.id), st = sortedStudents(gd), cs = sortedCriteria(gd)
    const head = ['Apellidos', 'Nombre', ...cs.map(c => c.code + ' (' + c.weight + '%)'), 'Nota', 'Calificación', 'Faltas', 'Retrasos', 'Justificadas']
    const rows = st.map(s => {
      const cg = critGrades(gd, s.id, trim), f = finalGrade(gd, s.id, trim), a = attCounts(meta, A, s.id, trim)
      return [s.surname || '', s.name, ...cs.map(c => r1(cg[c.id])), r1(f), gradeWord(f), a.F, a.R, a.J]
    })
    const media = ['Media del grupo', '', ...cs.map(c => r1(avg(st.map(s => critGrades(gd, s.id, trim)[c.id])))), r1(avg(st.map(s => finalGrade(gd, s.id, trim)))), '', '', '', '']
    const ws = XLSX.utils.aoa_to_sheet([[g.name + (g.subject ? ' · ' + g.subject : '') + ' · ' + per], ['Exportado el ' + fmtLong(todayISO())], [], head, ...rows, [], media])
    ws['!cols'] = [{ wch: 24 }, { wch: 16 }, ...cs.map(() => ({ wch: 10 })), { wch: 7 }, { wch: 14 }, { wch: 8 }, { wch: 9 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, sheetName(g.name))
    if (gid) {
      const acts = actsIn(gd, trim)
      const code = id => (gd.criteria.find(c => c.id === id) || {}).code
      const wa = XLSX.utils.aoa_to_sheet([['Notas por actividad · ' + per], [],
        ['Apellidos', 'Nombre', ...acts.map(a => a.name + (a.date ? ' (' + fmtDay(a.date) + ')' : ''))],
        ['', 'Criterios', ...acts.map(a => (a.criteria || []).map(code).filter(Boolean).join(' '))],
        ...st.map(s => [s.surname || '', s.name, ...acts.map(a => score(gd, a.id, s.id))])])
      wa['!cols'] = [{ wch: 24 }, { wch: 16 }, ...acts.map(() => ({ wch: 14 }))]
      XLSX.utils.book_append_sheet(wb, wa, sheetName('Actividades'))
      const wc = XLSX.utils.aoa_to_sheet([['Código', 'Peso (%)', 'Descripción'], ...cs.map(c => [c.code, Number(c.weight) || 0, c.desc || ''])])
      wc['!cols'] = [{ wch: 8 }, { wch: 9 }, { wch: 90 }]
      XLSX.utils.book_append_sheet(wb, wc, sheetName('Criterios'))
    }
  }
  const name = 'eprofy-notas-' + slugify(gid ? groupOf(docs, gid).name : 'todos-los-grupos') + '-' + (trim ? trim + 'T' : 'final') + '-' + todayISO() + '.xlsx'
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveBlob(name, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  return name
}

export function exportJson(docs) {
  const clean = {}; for (const k in docs) if (docs[k] != null) clean[k] = docs[k]
  const name = 'eprofy-copia-' + todayISO() + '.json'
  saveBlob(name, new Blob([JSON.stringify({ app: 'eProfy', version: 2, exported: new Date().toISOString(), docs: clean }, null, 1)], { type: 'application/json' }))
  return name
}
