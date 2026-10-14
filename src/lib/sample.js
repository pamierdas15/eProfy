// Grupos de ejemplo para probar la app (marcados como «ejemplo»).
import { change } from '../store/store'
import { uid } from './model'
import { todayISO, addDays, weekday } from './dates'
import { metaOf, trimOf } from './grades'
import { getState } from '../store/store'

const NAMES = ['Alonso Pérez, Lucía', 'Benítez Ruiz, Hugo', 'Cano Martínez, Irene', 'Díaz Sánchez, Marcos', 'Escudero Gil, Paula', 'Fernández López, Álvaro', 'García Navarro, Sara', 'Hernández Ros, Daniel', 'Ibáñez Molina, Carla', 'Jiménez Vidal, Pablo', 'López Ortega, Noa', 'Martín Serrano, Iker']

export function loadSample() {
  const meta0 = metaOf(getState().docs)
  let seed = 7
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  const t = todayISO()
  return change(d => {
    const M = d.meta
    const mk = (name, subject, color) => { const id = uid(); M.groups.push({ id, name, subject, color }); return id }
    const g1 = mk('3.º ESO A (ejemplo)', 'Tecnología y Digitalización', 'g1')
    const g2 = mk('1.º Bach B (ejemplo)', 'Tecnología e Ingeniería I', 'g2')
    const fill = (gid, crit, acts, nStu) => {
      const gd = d.g(gid), A = d.a(gid)
      gd.students = NAMES.slice(0, nStu).map(n => { const [surname, name] = n.split(', '); return { id: uid(), name, surname } })
      gd.criteria = crit.map(([code, weight, desc]) => ({ id: uid(), code, weight, desc }))
      const C = Object.fromEntries(gd.criteria.map(c => [c.code, c.id]))
      acts.forEach(([name, type, off, codes, delivery]) => {
        const date = addDays(t, off)
        const full = !getState().school || getState().school.format !== 'reducida'
        const a = { id: uid(), name, type, date, trim: trimOf(meta0, date), max: 10, weight: 1, criteria: codes.map(k => C[k]), delivery,
          kind: type === 'Examen' ? 'exam' : delivery ? 'task' : 'grade', graded: full }
        if (a.kind === 'task') Object.assign(a, { start: addDays(date, type === 'Proyecto' ? -21 : -7), format: type === 'Práctica' ? 'Presencial en clase' : 'Digital', grouping: type === 'Proyecto' ? 'Grupos' : 'Individual', duration: type === 'Proyecto' ? '4 sesiones' : '1 sesión + casa', desc: 'Ejemplo: instrucciones de la tarea, pasos a seguir y cómo se valora.', materials: type === 'Proyecto' ? 'Palillos, cola blanca, plantilla en el aula virtual' : 'Ficha en el aula virtual' })
        if (a.kind === 'exam') Object.assign(a, { desc: 'Ejemplo: contenidos que entran en el examen.', materials: 'Calculadora' })
        gd.activities.push(a)
        if (off <= 0) { gd.scores[a.id] = {}; gd.students.forEach((s, i) => { const base = 4 + ((i * 37) % 6) + rnd() * 1.6; gd.scores[a.id][s.id] = Math.min(10, Math.round(base * 2) / 2) }) }
        if (delivery) { gd.delivery[a.id] = {}; gd.students.forEach((s, i) => { if (off < 0 || i % 3 === 0) gd.delivery[a.id][s.id] = i % 7 === 3 ? 'N' : i % 5 === 1 ? 'T' : 'E' }) }
      })
      for (let k = 1; k <= 12; k++) {
        const day = addDays(t, -k); if (weekday(day) > 5) continue
        A.att[day] = {}; gd.students.forEach((s, i) => { A.att[day][s.id] = (i + k) % 11 === 0 ? 'F' : (i * k) % 13 === 5 ? 'R' : 'P' })
      }
      A.obs.push({ id: uid(), sid: gd.students[1].id, date: addDays(t, -3), type: 'positiva', text: 'Ayuda a sus compañeros con el montaje del circuito.' })
      A.obs.push({ id: uid(), sid: gd.students[3].id, date: addDays(t, -2), type: 'negativa', text: 'No trae el material de taller por segunda vez.' })
    }
    fill(g1, [['1.1', 15, 'Idear y planificar soluciones tecnológicas aplicando el proceso de resolución de problemas.'], ['1.2', 10, 'Seleccionar y utilizar materiales y técnicas adecuados en la construcción de prototipos.'], ['2.1', 20, 'Analizar estructuras y mecanismos sencillos identificando esfuerzos y transmisión del movimiento.'], ['3.1', 20, 'Diseñar y montar circuitos eléctricos y electrónicos básicos, calculando magnitudes.'], ['4.1', 20, 'Programar aplicaciones y sistemas de control con entornos de programación por bloques.'], ['5.1', 15, 'Hacer un uso seguro, responsable y crítico de los dispositivos y servicios digitales.']],
      [['Proyecto: puente de palillos', 'Proyecto', -24, ['1.1', '1.2'], true], ['Examen estructuras', 'Examen', -15, ['2.1'], false], ['Ficha ley de Ohm', 'Tarea', -8, ['3.1'], true], ['Práctica Scratch: semáforo', 'Práctica', -3, ['4.1'], true], ['Examen electricidad', 'Examen', 6, ['3.1'], false], ['Infografía identidad digital', 'Tarea', 9, ['5.1'], true]], 12)
    fill(g2, [['1.1', 20, 'Investigar y diseñar productos aplicando técnicas de ideación y gestión de proyectos.'], ['2.1', 25, 'Seleccionar materiales según sus propiedades y su impacto ambiental.'], ['3.1', 25, 'Calcular y montar sistemas mecánicos y eléctricos analizando su funcionamiento.'], ['4.1', 30, 'Programar sistemas automáticos con microcontroladores y sensores.']],
      [['Informe propiedades de materiales', 'Tarea', -18, ['2.1'], true], ['Examen mecanismos', 'Examen', -6, ['3.1'], false], ['Arduino: sensor de temperatura', 'Práctica', 4, ['4.1'], true]], 9)
    const sch = [[1, '08:30', '09:25', g1, 'Taller 1'], [1, '11:45', '12:40', g2, 'Aula 2.3'], [2, '09:25', '10:20', g1, 'Taller 1'], [3, '10:20', '11:15', g2, 'Lab. informática'], [4, '08:30', '09:25', g1, 'Aula 1.4'], [4, '12:40', '13:35', g2, 'Taller 1'], [5, '10:20', '11:15', g2, 'Aula 2.3']]
    sch.forEach(([day, start, end, groupId, room]) => M.schedule.push({ id: uid(), day, start, end, groupId, room }))
    M.schedule.push({ id: uid(), type: 'guardia', day: 2, start: '11:45', end: '12:40', groupId: '', room: 'Sala de profesores', note: 'Guardia de aula' })
    M.schedule.push({ id: uid(), type: 'tutoria', day: 3, start: '12:40', end: '13:35', groupId: g1, room: 'Aula 1.4', note: 'Atención a familias' })
    M.schedule.push({ id: uid(), type: 'reunion', day: 4, start: '09:25', end: '10:20', groupId: '', room: 'Departamento', note: 'Reunión de departamento' })
    M.schedule.push({ id: uid(), type: 'libre', day: 5, start: '08:30', end: '09:25', groupId: '', room: '', note: '' })
    M.events.push({ id: uid(), title: 'Sesión de evaluación 1.ª', date: addDays(t, 12), time: '16:00', type: 'Evaluación', groupId: '', notes: '' })
    M.events.push({ id: uid(), title: 'Visita al FabLab', date: addDays(t, 5), time: '09:00', type: 'Excursión', groupId: g2, notes: 'Autorizaciones firmadas antes del viernes.' })
    M.events.push({ id: uid(), title: 'Reunión de departamento', date: addDays(t, 1), time: '14:30', type: 'Reunión', groupId: '', notes: '' })
    M.blocked.push({ id: uid(), start: '2026-10-12', end: '2026-10-12', type: 'festivo', note: 'Fiesta Nacional de España' })
    M.blocked.push({ id: uid(), start: '2026-12-23', end: '2027-01-07', type: 'vacaciones', note: 'Navidad (ejemplo: comprueba el calendario escolar oficial)' })
    if (!M.settings.since) M.settings.since = t
  })
}
