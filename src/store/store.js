// Almacén de datos de eProfy.
//
// - Los datos viven en `state.docs` (ver lib/model.js) y se pintan con React (useAppState).
// - Todo cambio pasa por change(): devuelve una función que lo deshace (botón «Deshacer»).
// - Cada documento cambiado se guarda en Firestore pasado un momento (agrupa ráfagas de cambios)
//   y en una copia local del dispositivo, para arrancar rápido y funcionar sin conexión.
import { useSyncExternalStore } from 'react'
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { defaultDoc, migrate } from '../lib/model'

let state = {
  phase: 'loading',   // loading | auth | app
  mode: 'local',      // local | connecting | cloud
  user: null,
  docs: {},
  err: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: 0
}
const listeners = new Set()
const emit = () => { state = { ...state, pending: dirty.size }; listeners.forEach(f => f()) }
export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }
export const getState = () => state
export const useAppState = () => useSyncExternalStore(subscribe, getState)
export const setPhase = (phase, extra) => { state = { ...state, phase, ...(extra || {}) }; emit() }

// ---- guardado ----
let lsKey = 'eprofy.cache.local'
let col = null, unsub = null, first = true
const ver = {}, dirty = new Set(), timers = {}, writing = {}

const cacheLocal = () => { try { localStorage.setItem(lsKey, JSON.stringify(state.docs)) } catch (e) { /* sin espacio o modo privado */ } }
function loadLocal() {
  let docs = {}
  try { const s = localStorage.getItem(lsKey); if (s) docs = JSON.parse(s) || {} } catch (e) { docs = {} }
  for (const k of Object.keys(docs)) if (docs[k] == null) delete docs[k]
  return docs
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
  const v = ver[id], body = state.docs[id]
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

function commit(map) {
  const docs = { ...state.docs }
  for (const [id, v] of map) { if (v == null) delete docs[id]; else docs[id] = v; queueSave(id) }
  state = { ...state, docs }
  cacheLocal(); emit()
}

/**
 * Aplica un cambio y devuelve la función que lo deshace.
 *   change(d => { d.meta.events.push(ev); d.g(gid).students.push(s); d.remove('a_' + gid) })
 * d.meta, d.g(gid) y d.a(gid) son copias editables (se crean vacías si no existen).
 */
export function change(fn) {
  const touched = new Map(), prev = {}
  const take = id => {
    if (!touched.has(id) || touched.get(id) == null) {
      if (!(id in prev)) prev[id] = state.docs[id]
      touched.set(id, state.docs[id] != null ? structuredClone(state.docs[id]) : defaultDoc(id))
    }
    return touched.get(id)
  }
  const d = {
    get meta() { return take('meta') },
    g: gid => take('g_' + gid),
    a: gid => take('a_' + gid),
    doc: id => take(id),
    remove: id => { if (!(id in prev)) prev[id] = state.docs[id]; touched.set(id, null) },
    set: (id, value) => { if (!(id in prev)) prev[id] = state.docs[id]; touched.set(id, value) }
  }
  fn(d)
  commit(touched)
  return () => commit(new Map(Object.entries(prev).map(([id, v]) => [id, v == null ? null : v])))
}

/** Sustituye todos los datos (importar copia, borrar todo). Devuelve la función para deshacer. */
export function replaceAll(newDocs) {
  const { docs } = migrate(newDocs)
  return change(d => {
    for (const id of Object.keys(state.docs)) if (!(id in docs)) d.remove(id)
    for (const id of Object.keys(docs)) d.set(id, docs[id])
  })
}

// ---- arranque: local o nube ----
function applyMigrations() {
  const { docs, changed } = migrate(state.docs)
  if (changed.length) { state = { ...state, docs }; changed.forEach(queueSave); cacheLocal() }
}

export function startLocal() {
  stopCloud()
  lsKey = 'eprofy.cache.local'
  state = { ...state, mode: 'local', user: null, docs: loadLocal(), err: null, phase: 'app' }
  applyMigrations(); emit()
}

export function startCloud(user) {
  stopCloud()
  lsKey = 'eprofy.cache.' + user.uid
  first = true; dirty.clear()
  state = { ...state, mode: 'connecting', user: { uid: user.uid, email: user.email, name: user.displayName }, docs: loadLocal(), err: null, phase: 'app' }
  emit()
  col = collection(db, 'users', user.uid, 'docs')
  unsub = onSnapshot(col, { includeMetadataChanges: true }, onSnap, err => { console.error(err); state = { ...state, err: 'Sin conexión con la base de datos' }; emit() })
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
      Object.keys(state.docs).forEach(queueSave)
    } else {
      const fresh = {}
      snap.docs.forEach(d => { fresh[d.id] = d.data() })
      for (const k of Object.keys(state.docs)) if (!(k in fresh) && dirty.has(k)) fresh[k] = state.docs[k]
      state = { ...state, docs: fresh }
    }
    applyMigrations(); cacheLocal(); emit(); return
  }
  let changed = false
  const docs = { ...state.docs }
  for (const ch of snap.docChanges()) {
    const id = ch.doc.id
    if (dirty.has(id) || writing[id]) continue // nuestra versión local manda hasta que se guarde
    if (ch.type === 'removed') { if (id in docs) { delete docs[id]; changed = true } continue }
    const data = ch.doc.data()
    if (JSON.stringify(data) !== JSON.stringify(docs[id])) { docs[id] = data; changed = true }
  }
  if (changed) { state = { ...state, docs }; cacheLocal() }
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { state = { ...state, online: true }; emit() })
  window.addEventListener('offline', () => { state = { ...state, online: false }; emit() })
}
