import { useState } from 'react'
import { useAppState } from '../store/store'
import * as act from '../store/actions'
import { Modal, Field, useModal, useToast } from '../components/ui.jsx'
import { ACT_TYPES } from '../lib/model'
import { groupDoc, metaOf, sortedCriteria, parseNum } from '../lib/grades'
import { todayISO } from '../lib/dates'

/** Nueva actividad / tarea (gid opcional: se elige el grupo) o edición de una existente. */
export function ActModal({ gid: gid0, aid, delivery }) {
  const st = useAppState(), toast = useToast(), { close } = useModal()
  const meta = metaOf(st.docs)
  const [gid, setGid] = useState(gid0 || (meta.groups[0] && meta.groups[0].id))
  if (!gid) return <Modal title="Nueva actividad"><p style={{ margin: 0 }}>Crea primero un grupo.</p></Modal>
  const gd = groupDoc(st.docs, gid)
  const a = aid ? gd.activities.find(x => x.id === aid) : { name: '', type: delivery ? 'Tarea' : 'Examen', date: todayISO(), criteria: [], weight: 1, max: 10, delivery: !!delivery }
  if (!a) return null
  const cs = sortedCriteria(gd)
  const del = () => { const undo = act.deleteAct(gid, aid); close(); toast('«' + a.name + '» eliminada', undo) }
  return (
    <Modal title={aid ? 'Editar actividad' : delivery ? 'Nueva tarea' : 'Nueva actividad'}
      left={aid ? <button type="button" className="btn danger" onClick={del}>Eliminar</button> : null}
      onSubmit={fd => {
        const name = fd.get('name').trim(); if (!name) { toast('Escribe el nombre'); return false }
        const valid = new Set(gd.criteria.map(c => c.id))
        act.saveAct(gid, aid, {
          name, type: fd.get('type'), date: fd.get('date') || '',
          max: parseNum(fd.get('max')) || 10, weight: parseNum(fd.get('weight')) || 1,
          criteria: fd.getAll('crit').filter(id => valid.has(id)), delivery: !!fd.get('delivery')
        })
        toast(aid ? 'Actividad actualizada' : delivery ? 'Tarea creada' : 'Actividad creada')
      }}>
      {!aid ? (
        <Field label="Grupo" id="f_agid">
          <select id="f_agid" value={gid} onChange={e => setGid(e.target.value)}>{meta.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        </Field>
      ) : null}
      <Field label="Nombre" id="f_aname"><input id="f_aname" name="name" required defaultValue={a.name} placeholder="Examen tema 2: Estructuras" /></Field>
      <div className="frow">
        <Field label="Tipo" id="f_atype"><select id="f_atype" name="type" defaultValue={a.type}>{ACT_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
        <Field label={a.delivery ? 'Fecha de entrega' : 'Fecha'} id="f_adate"><input type="date" id="f_adate" name="date" defaultValue={a.date || ''} /></Field>
      </div>
      <div className="frow">
        <Field label="Nota máxima" id="f_amax"><input id="f_amax" name="max" inputMode="decimal" defaultValue={String(a.max || 10).replace('.', ',')} /></Field>
        <Field label="Peso en el criterio" id="f_aw" hint="1 = normal, 2 = cuenta el doble"><input id="f_aw" name="weight" inputMode="decimal" defaultValue={String(a.weight || 1).replace('.', ',')} /></Field>
      </div>
      <div className="fld"><span className="lb">Criterios que evalúa</span>
        {cs.length ? (
          <div className="checks">{cs.map(c => (
            <label key={c.id}><input type="checkbox" name="crit" value={c.id} defaultChecked={(a.criteria || []).includes(c.id)} /><span><b>{c.code}</b> {(c.desc || '').slice(0, 90)}</span></label>
          ))}</div>
        ) : <span className="hint">Este grupo aún no tiene criterios. La actividad no contará en la nota hasta que la vincules.</span>}
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}><input type="checkbox" name="delivery" defaultChecked={a.delivery} /> Controlar entregas</label>
    </Modal>
  )
}
