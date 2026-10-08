// Fechas como texto "AAAA-MM-DD" en hora local (nunca UTC), para que un día sea siempre un día.
export const pad = n => String(n).padStart(2, '0')
export const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
export const todayISO = () => iso(new Date())
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d) }
export const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5)
/** 1 = lunes … 7 = domingo */
export const weekday = s => { const w = parseISO(s).getDay(); return w === 0 ? 7 : w }
export const mondayOf = s => addDays(s, 1 - weekday(s))
export const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()) }

export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const DIAS_CORTOS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export const fmtDay = s => { const d = parseISO(s); return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3) }
export const fmtLong = s => { const d = parseISO(s); return DIAS[weekday(s)] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] }
export const fmtShort = s => DIAS_CORTOS[weekday(s)] + ' ' + fmtDay(s)
export const fmtRange = (a, b) => a === b ? fmtLong(a) : fmtDay(a) + ' – ' + fmtDay(b)
