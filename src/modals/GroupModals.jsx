import { useAppState } from '../store/store'
import * as act from '../store/actions'
import { Modal, Field, Grade, useModal, useToast } from '../components/ui.jsx'
import { GCOLORS, cvar, isFull } from '../lib/model'
import { groupDoc, attDoc, groupOf, metaOf, sname, sortedCriteria, critGrades, finalGrade, attCounts, fmtW, parseNum } from '../lib/grades'
import { todayISO, fmtDay } from '../lib/dates'

/* ---------- grupo ---------- */
export function GroupModal({ gid, onCreated, onDeleted }) {
  const st = useAppState(), toast = useToast(), { close } = useModal()
  const meta = metaOf(st.docs)
  const g = gid ? groupOf(st.docs, gid) : { name: '', subject: '', color: GCOLORS[meta.groups.length % 6] }
  if (!g) return null
  const del = () => { const undo = act.deleteGroup(gid); close(); onDeleted && onDeleted(); toast('Grupo «' + g.name + '» eliminado', undo) }
  return (
    <Modal title={gid ? 'Editar grupo' : 'Nuevo grupo'} left={gid ? <button type="button" className="btn danger" onClick={del}>Eliminar grupo</button> : null}
      onSubmit={fd => {
        const obj = { name: fd.get('name').trim(), subject: fd.get('subject').trim(), color: fd.get('color') || g.color }
        if (!obj.name) { toast('Escribe el nombre del grupo'); return false }
        if (gid) act.updateGroup(gid, obj); else { const id = act.addGroup(obj); onCreated && onCreated(id) }
      }}>
      <Field label="Nombre del grupo" id="f_name"><input id="f_name" name="name" required defaultValue={g.name} placeholder="3.º ESO A" /></Field>
      <Field label="Materia" id="f_subject"><input id="f_subject" name="subject" defaultValue={g.subject} placeholder="Tecnología y Digitalización" /></Field>
      <div className="fld"><span className="lb">Color</span>
        <div className="chips">{GCOLORS.map(c => (
          <label className="chip" key={c}><input type="radio" name="color" value={c} defaultChecked={g.color === c} /><span className="gdot" style={{ '--c': cvar(c), width: 14, height: 14 }} /></label>
        ))}</div>
      </div>
    </Modal>
  )
}

/* ---------- alumnos ---------- */
export function StudentsModal({ gid }) {
  const toast = useToast()
  return (
    <Modal title="Añadir alumnos" submitLabel="Añadir" onSubmit={fd => {
      const list = act.parseStudentList(fd.get('list') || '')
      if (!list.length) { toast('Escribe al menos un alumno'); return false }
      act.addStudents(gid, list); toast(list.length + (list.length === 1 ? ' alumno añadido' : ' alumnos añadidos'))
    }}>
      <Field label="Lista de alumnos" id="f_list" hint="Un alumno por línea. Formato «Apellidos, Nombre» o «Nombre Apellidos». Puedes pegarla desde Plumier o una hoja de cálculo.">
        <textarea id="f_list" name="list" placeholder={'García López, Ana\nMartínez Ruiz, Pablo\n…'} />
      </Field>
    </Modal>
  )
}

export function StudentModal({ gid, sid }) {
  const st = useAppState(), toast = useToast(), { open, close } = useModal()
  const gd = groupDoc(st.docs, gid), A = attDoc(st.docs, gid), meta = metaOf(st.docs)
  const s = gd.students.find(x => x.id === sid)
  if (!s) return null
  const cs = sortedCriteria(gd)
  const T = [1, 2, 3, 0], cg = T.map(t => critGrades(gd, sid, t))
  const c = attCounts(meta, A, sid, 0)
  const obs = A.obs.filter(o => o.sid === sid).sort((a, b) => b.date.localeCompare(a.date))
  const del = () => { const undo = act.deleteStudent(gid, sid); close(); toast(sname(s) + ' dado de baja', undo) }
  return (
    <Modal title={sname(s)} wide left={<button type="button" className="btn danger" onClick={del}>Dar de baja</button>}
      onSubmit={fd => { act.updateStudent(gid, sid, { name: fd.get('name').trim(), surname: fd.get('surname').trim(), notes: fd.get('notes') }) }}>
      <div className="frow">
        <Field label="Nombre" id="f_sname"><input id="f_sname" name="name" defaultValue={s.name} /></Field>
        <Field label="Apellidos" id="f_ssur"><input id="f_ssur" name="surname" defaultValue={s.surname} /></Field>
      </div>
      {isFull(st.school) ? <>
      <div>
        <div className="label" style={{ marginBottom: 6 }}>Calificación por criterios</div>
        {cs.length ? (
          <div className="tablewrap"><table className="book">
            <thead><tr><th className="st">Criterio</th><th>1T</th><th>2T</th><th>3T</th><th>Final</th></tr></thead>
            <tbody>{cs.map(cr => (
              <tr key={cr.id}><td className="st" title={cr.desc}><span className="num">{cr.code}</span> <span className="faint">{fmtW(cr.weight)} %</span></td>
                {cg.map((x, i) => <td key={i} style={{ padding: 4 }}><Grade v={x[cr.id]} /></td>)}</tr>
            ))}</tbody>
            <tfoot><tr><td className="st"><b>Nota</b></td>{T.map(t => <td key={t} style={{ padding: 4 }}><Grade v={finalGrade(gd, sid, t)} /></td>)}</tr></tfoot>
          </table></div>
        ) : <p className="muted">Sin criterios definidos.</p>}
      </div>
      <div className="row"><span className="label">Asistencia del curso</span><span className="tag warn">F {c.F}</span><span className="tag amber">R {c.R}</span><span className="tag">J {c.J}</span></div>
      </> : null}
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="label">Anotaciones</span>
          <button type="button" className="btn sm" onClick={() => open(<ObsModal gid={gid} sid={sid} back />)}>+ Anotación</button>
        </div>
        {obs.length ? <div className="list">{obs.map(o => (
          <div className="item" key={o.id}>
            <span className={'tag ' + (o.type === 'positiva' ? 'ok' : o.type === 'negativa' ? 'warn' : '')}>{fmtDay(o.date)}</span>
            <div className="grow" style={{ fontSize: '.9rem' }}>{o.text}</div>
            <button type="button" className="btn ghost sm" aria-label="Eliminar anotación" onClick={() => toast('Anotación eliminada', act.deleteObs(gid, o.id))}>✕</button>
          </div>
        ))}</div> : <p className="muted" style={{ margin: 0 }}>Sin anotaciones.</p>}
      </div>
      <Field label="Notas privadas" id="f_snotes" hint="Adaptaciones, contacto con la familia, etc."><textarea id="f_snotes" name="notes" style={{ minHeight: 70 }} defaultValue={s.notes || ''} /></Field>
    </Modal>
  )
}

export function ObsModal({ gid, sid, date, back }) {
  const st = useAppState(), toast = useToast(), { open } = useModal()
  const s = groupDoc(st.docs, gid).students.find(x => x.id === sid)
  if (!s) return null
  return (
    <Modal title={'Anotación · ' + sname(s)} onSubmit={fd => {
      const text = fd.get('text').trim(); if (!text) { toast('Escribe la anotación'); return false }
      act.addObs(gid, { sid, date: fd.get('date') || todayISO(), type: fd.get('type'), text })
      toast('Anotación guardada')
      if (back) { open(<StudentModal gid={gid} sid={sid} />); return false }
    }}>
      <div className="frow">
        <Field label="Fecha" id="f_odate"><input type="date" id="f_odate" name="date" defaultValue={date || todayISO()} /></Field>
        <Field label="Tipo" id="f_otype"><select id="f_otype" name="type"><option value="neutra">Neutra</option><option value="positiva">Positiva</option><option value="negativa">Negativa</option></select></Field>
      </div>
      <Field label="Texto" id="f_otext"><textarea id="f_otext" name="text" style={{ minHeight: 80 }} placeholder="Participa activamente en el proyecto del puente…" /></Field>
    </Modal>
  )
}

/* ---------- criterios ---------- */
export function CritModal({ gid, cid }) {
  const st = useAppState(), toast = useToast(), { close } = useModal()
  const gd = groupDoc(st.docs, gid)
  const c = cid ? gd.criteria.find(x => x.id === cid) : { code: '', desc: '', weight: '' }
  if (!c) return null
  const del = () => { const undo = act.deleteCrit(gid, cid); close(); toast('Criterio ' + c.code + ' eliminado', undo) }
  return (
    <Modal title={cid ? 'Editar criterio' : 'Nuevo criterio'} left={cid ? <button type="button" className="btn danger" onClick={del}>Eliminar</button> : null}
      onSubmit={fd => {
        const w = parseNum(fd.get('weight'))
        if (w == null || isNaN(w) || w < 0) { toast('El peso debe ser un número'); return false }
        act.saveCrit(gid, cid, { code: fd.get('code').trim(), desc: fd.get('desc').trim(), weight: w })
      }}>
      <div className="frow">
        <Field label="Código" id="f_ccode" hint="La parte antes del punto agrupa por competencia específica."><input id="f_ccode" name="code" required defaultValue={c.code} placeholder="1.1" /></Field>
        <Field label="Peso (%)" id="f_cw"><input id="f_cw" name="weight" inputMode="decimal" required defaultValue={String(c.weight).replace('.', ',')} placeholder="10" /></Field>
      </div>
      <Field label="Descripción" id="f_cdesc"><textarea id="f_cdesc" name="desc" style={{ minHeight: 80 }} defaultValue={c.desc} /></Field>
    </Modal>
  )
}

export function BulkCritModal({ gid }) {
  const toast = useToast()
  return (
    <Modal title="Pegar criterios" submitLabel="Añadir" onSubmit={fd => {
      const list = (fd.get('list') || '').split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
        const p = l.split(/\t|;/).map(x => x.trim()); const w = parseNum(p[1] || '0')
        return { code: p[0], weight: w == null || isNaN(w) ? 0 : w, desc: p.slice(2).join('; ') }
      }).filter(c => c.code)
      if (!list.length) { toast('No hay criterios en el texto'); return false }
      act.addCrits(gid, list); toast(list.length + ' criterios añadidos')
    }}>
      <Field label="Criterios" id="f_blist" hint="Una línea por criterio: código; peso; descripción. También vale con tabuladores (copiado de una hoja de cálculo).">
        <textarea id="f_blist" name="list" placeholder={'1.1; 10; Idear y planificar soluciones tecnológicas…\n1.2; 10; Seleccionar materiales…'} />
      </Field>
    </Modal>
  )
}
