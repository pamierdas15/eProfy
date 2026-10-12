// Almacén de datos de eProfy.
//
// - Cada usuario tiene varios colegios. La lista está en el documento `schools`
//   ({ list: [{ id, name, format, created }] }) y los datos de cada colegio en documentos
//   con su prefijo: `<colegio>.meta`, `<colegio>.g_<grupo>`, `<colegio>.a_<grupo>` (ver lib/model.js).
// - `state.raw` guarda todos los documentos; `state.docs` es la vista del colegio abierto, sin
//   prefijo, que es lo que usan las pantallas (docs.meta, docs['g_' + gid]…).
// - Todo cambio pasa por change(): devuelve una función que lo deshace (botón «Deshacer»).
// - Cada documento cambiado se guarda en Firestore pasado un momento (agrupa ráfagas de cambios)
//   y en una copia local del dispositivo, para arrancar rápido y funcionar sin conexión.
import { useSyncExternalStore } from 'react'
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { defaultDoc, defaultMeta, migrate, uid } from '../lib/model'

let state = {
  phase: 'loading',   // loading | auth | schools | app
  mode: 'local',      // local | connecting | cloud
  user: null,
  raw: {},            // todos los documentos, con su id real
  sid: null,          // colegio abierto
  school: null,       // { id, name, format, created } del colegio abierto
  schools: [],        // lista de colegios
  docs: {},           // documentos del colegio abierto, sin prefijo
  err: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: 0
}
const listeners = new Set()
const SEP = '.'
const P = id => state.sid + SEP + id

/** Recalcula la vista del colegio abierto a partir de todos los documentos. */
function derive(next) {
  const raw = next.raw
  const schools = (raw.schools && raw.schools.list) || []
  let sid = next.sid
  if (sid && !schools.some(s => s.id === sid)) sid = null // borrado desde otro dispositivo
  const docs = {}
  if (sid) { const pre = sid + SEP; for (const k in raw) if (k.startsWith(pre) && raw[k] != null) docs[k.slice(pre.length)] = raw[k] }
  return { ...next, sid, schools, school: schools.find(s => s.id === sid) || null, docs, phase: next.phase === 'app' && !sid ? 'schools' : next.phase }
}
const emit = () => { state = { ...derive(state), pending: dirty.size }; listeners.forEach(f => f()) }
export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }
export const getState = () => state
export const useAppState = () => useSyncExternalStore(subscribe, getState)
export const setPhase = (phase, extra) => { state = { ...state, phase, ...(extra || {}) }; emit() }

// ---- guardado ----
let lsKey = 'eprofy.cache.local'
let col = null, unsub = null, first = true
const ver = {}, dirty = new Set(), timers = {}, writing = {}

const cacheLocal = () => { try { localStorage.setItem(lsKey, JSON.stringify(state.raw)) } catch (e) { /* sin espacio o modo privado */ } }
function loadLocal() {
  let raw = {}
  try { const s = localStorage.getItem(lsKey); if (s) raw = JSON.parse(s) || {} } catch (e) { raw = {} }
  for (const k of Object.keys(raw)) if (raw[k] == null) delete raw[k]
  return raw
}
const clean = o => JSON.parse(JSON.stringify(o)) // Firestore no acepta valores undefined

function queueSave(id) {
  ver[id] = (ver[id] || 0) + 1
  dirty.add(id)
  clearTimeout(timers[id])
  timers[id] = setTimeout(() => flush(id), 600)
}
async function flush(id) {
  if (state.mode !== 'cloud' || !col) { dirty.delete(id); emit(); return }
  if (writing[id]) { timers[id] = setTimeout(() => flush(id), 400); return }
  writing[id] = true; emit()
  const v = ver[id], body = state.raw[id]
  try {
    // Sin conexión, Firestore guarda la escritura en su caché y la envía al volver la red.
    if (body == null) await deleteDoc(doc(col, id))
    else await setDoc(doc(col, id), clean(body))
    if (ver[id] === v) dirty.delete(id)
    state = { ...state, err: null }
  } catch (e) {
    const code = e && e.code
    if (code === 'unavailable' || code === 'resource-exhausted' || code === 'deadline-exceeded') timers[id] = setTimeout(() => flush(id), 3000 + Math.random() * 3000)
    else if (code === 'permission-denied' || code === 'unauthenticated') state = { ...state, err: 'Sin permiso para guardar. Cierra sesión y vuelve a entrar.' }
    else if (code === 'invalid-argument') state = { ...state, err: 'Un grupo es demasiado grande para guardarse. Exporta una copia y divídelo.' }
    else { state = { ...state, err: 'No se pudo guardar. Se reintentará.' }; timers[id] = setTimeout(() => flush(id), 6000) }
  } finally { writing[id] = false; emit() }
}

/** Aplica cambios por id real (null = borrar). */
function commit(map) {
  const raw = { ...state.raw }
  for (const [id, v] of map) { if (v == null) delete raw[id]; else raw[id] = v; queueSave(id) }
  state = { ...state, raw }
  cacheLocal(); emit()
}
/** Cambio genérico sobre ids reales; devuelve la función que lo deshace. */
function changeRaw(fn) {
  const touched = new Map(), prev = {}
  const keep = id => { if (!(id in prev)) prev[id] = state.raw[id] }
  const r = {
    take: (id, def) => {
      if (!touched.has(id) || touched.get(id) == null) { keep(id); touched.set(id, state.raw[id] != null ? structuredClone(state.raw[id]) : def()) }
      return touched.get(id)
    },
    remove: id => { keep(id); touched.set(id, null) },
    set: (id, value) => { keep(id); touched.set(id, value) }
  }
  fn(r)
  commit(touched)
  return () => commit(new Map(Object.entries(prev).map(([id, v]) => [id, v == null ? null : v])))
}

/**
 * Aplica un cambio en el colegio abierto y devuelve la función que lo deshace.
 *   change(d => { d.meta.events.push(ev); d.g(gid).students.push(s); d.remove('a_' + gid) })
 * d.meta, d.g(gid) y d.a(gid) son copias editables (se crean vacías si no existen).
 */
export function change(fn) {
  if (!state.sid) return () => {}
  return changeRaw(r => {
    const take = id => r.take(P(id), () => defaultDoc(id))
    fn({
      get meta() { return take('meta') },
      g: gid => take('g_' + gid),
      a: gid => take('a_' + gid),
      doc: take,
      remove: id => r.remove(P(id)),
      set: (id, value) => r.set(P(id), value)
    })
  })
}

/** Sustituye los datos del colegio abierto (importar copia, borrar todo). Devuelve la función para deshacer. */
export function replaceAll(newDocs) {
  const { docs } = migrate(newDocs)
  return change(d => {
    for (const id of Object.keys(state.docs)) if (!(id in docs)) d.remove(id)
    for (const id of Object.keys(docs)) d.set(id, docs[id])
  })
}

// ---- colegios ----
export function openSchool(sid) {
  state = { ...state, sid, phase: 'app' }
  try { localStorage.setItem('eprofy.school', sid) } catch (e) { /* */ }
  emit()
}
export function closeSchool() { state = { ...state, sid: null, phase: 'schools' }; emit() }
export function addSchool({ name, format }) {
  const id = 'c' + uid()
  changeRaw(r => {
    r.take('schools', () => ({ list: [] })).list.push({ id, name, format, created: new Date().toISOString().slice(0, 10) })
    r.set(id + SEP + 'meta', defaultMeta())
  })
  return id
}
export const updateSchool = (sid, fields) => changeRaw(r => { Object.assign(r.take('schools', () => ({ list: [] })).list.find(s => s.id === sid), fields) })
export const deleteSchool = sid => changeRaw(r => {
  const s = r.take('schools', () => ({ list: [] }))
  s.list = s.list.filter(x => x.id !== sid)
  for (const k of Object.keys(state.raw)) if (k.startsWith(sid + SEP)) r.remove(k)
})

// ---- arranque: local o nube ----
/** Convierte los datos antiguos (sin colegios) y aplica las migraciones de cada colegio. */
function applyMigrations() {
  const raw = { ...state.raw }, changed = new Set()
  // Datos de antes de existir los colegios: pasan a un colegio «Mi colegio» en formato completo
  const legacy = Object.keys(raw).filter(k => k === 'meta' || /^[ga]_/.test(k))
  if (legacy.length) {
    const id = 'c' + uid()
    const list = (raw.schools && raw.schools.list) || []
    raw.schools = { list: [...list, { id, name: 'Mi colegio', format: 'completa', created: new Date().toISOString().slice(0, 10) }] }
    changed.add('schools')
    for (const k of legacy) { raw[id + SEP + k] = raw[k]; delete raw[k]; changed.add(k); changed.add(id + SEP + k) }
  }
  for (const s of (raw.schools && raw.schools.list) || []) {
    const pre = s.id + SEP, sub = {}
    for (const k in raw) if (k.startsWith(pre)) sub[k.slice(pre.length)] = raw[k]
    const { docs, changed: ch } = migrate(sub)
    for (const k of ch) { raw[pre + k] = docs[k]; changed.add(pre + k) }
  }
  if (changed.size) { state = { ...state, raw }; changed.forEach(queueSave); cacheLocal() }
}

export function startLocal() {
  stopCloud()
  lsKey = 'eprofy.cache.local'
  state = { ...state, mode: 'local', user: null, raw: loadLocal(), sid: null, err: null, phase: 'schools' }
  applyMigrations(); emit()
}

export function startCloud(user) {
  stopCloud()
  lsKey = 'eprofy.cache.' + user.uid
  first = true; dirty.clear()
  state = { ...state, mode: 'connecting', user: { uid: user.uid, email: user.email, name: user.displayName }, raw: loadLocal(), sid: null, err: null, phase: 'schools' }
  emit()
  col = collection(db, 'users', user.uid, 'docs')
  unsub = onSnapshot(col, { includeMetadataChanges: true }, onSnap, err => {
    console.error(err)
    // La app sigue funcionando con los datos de este dispositivo; al arreglarlo, se suben solos
    unsub = null
    state = { ...state, mode: 'local', err: firestoreMsg(err) }
    emit()
  })
}
/** Explica en castellano por qué Firestore no responde y cómo arreglarlo. */
export function firestoreMsg(e) {
  const c = e && e.code
  if (c === 'permission-denied') return 'Firebase no deja leer los datos: publica las reglas de firestore.rules en Firestore Database → Reglas.'
  if (c === 'not-found' || c === 'failed-precondition') return 'La base de datos no existe todavía: créala en Firebase → Firestore Database → Crear base de datos.'
  if (c === 'unauthenticated') return 'La sesión ha caducado: cierra sesión y vuelve a entrar.'
  if (c === 'unavailable') return 'No hay conexión con Firebase. Los cambios se guardan en este dispositivo.'
  return 'No hay conexión con la base de datos' + (c ? ' (' + c + ')' : '') + '. Los cambios se guardan en este dispositivo.'
}
export function stopCloud() { if (unsub) { unsub(); unsub = null } col = null }
export const hasPendingWrites = () => dirty.size > 0

function onSnap(snap) {
  if (first) {
    // Esperar a la respuesta del servidor (o a una caché offline con datos) antes de decidir nada
    if (snap.metadata.fromCache && snap.empty) return
    first = false
    state = { ...state, mode: 'cloud' }
    if (snap.empty) {
      // Base de datos vacía: se sube lo que hubiera en este dispositivo
      Object.keys(state.raw).forEach(queueSave)
    } else {
      const fresh = {}
      snap.docs.forEach(d => { fresh[d.id] = d.data() })
      for (const k of Object.keys(state.raw)) if (!(k in fresh) && dirty.has(k)) fresh[k] = state.raw[k]
      state = { ...state, raw: fresh }
    }
    applyMigrations(); cacheLocal(); emit(); return
  }
  let changed = false
  const raw = { ...state.raw }
  for (const ch of snap.docChanges()) {
    const id = ch.doc.id
    if (dirty.has(id) || writing[id]) continue // nuestra versión local manda hasta que se guarde
    if (ch.type === 'removed') { if (id in raw) { delete raw[id]; changed = true } continue }
    const data = ch.doc.data()
    if (JSON.stringify(data) !== JSON.stringify(raw[id])) { raw[id] = data; changed = true }
  }
  if (changed) { state = { ...state, raw }; cacheLocal() }
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { state = { ...state, online: true }; emit() })
  window.addEventListener('offline', () => { state = { ...state, online: false }; emit() })
}
