import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { gradeClass, fmtN } from '../lib/grades'
import { cvar } from '../lib/model'
import { useInstall } from '../lib/layout'

/* ---------- avisos inferiores (con «Deshacer») ---------- */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [t, setT] = useState(null)
  const timer = useRef(null)
  const show = useCallback((msg, undo) => {
    clearTimeout(timer.current)
    setT({ msg, undo, k: Date.now() })
    timer.current = setTimeout(() => setT(null), undo ? 6000 : 2800)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t ? (
        <div className="toast" role="status" key={t.k}>
          <span>{t.msg}</span>
          {t.undo ? <button className="toast-undo" onClick={() => { t.undo(); setT(null); show('Deshecho') }}>Deshacer</button> : null}
        </div>
      ) : null}
    </ToastCtx.Provider>
  )
}

/* ---------- ventanas ---------- */
const ModalCtx = createContext({ open: () => {}, close: () => {} })
export const useModal = () => useContext(ModalCtx)

export function ModalProvider({ children }) {
  const [stack, setStack] = useState([])
  const open = useCallback(node => setStack([node]), [])
  const close = useCallback(() => setStack([]), [])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])
  return (
    <ModalCtx.Provider value={{ open, close }}>
      {children}
      {stack.length ? <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>{stack[stack.length - 1]}</div> : null}
    </ModalCtx.Provider>
  )
}

/**
 * Ventana con formulario. onSubmit(formData) devuelve false para no cerrar.
 * `left` = botón a la izquierda del pie (p. ej. Eliminar).
 */
export function Modal({ title, children, onSubmit, submitLabel = 'Guardar', danger, left, wide }) {
  const { close } = useModal()
  const ref = useRef(null)
  useEffect(() => {
    const f = ref.current && ref.current.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select')
    if (f) setTimeout(() => f.focus(), 30)
  }, [])
  const submit = e => {
    e.preventDefault()
    if (!onSubmit) return close()
    const fd = new FormData(e.currentTarget)
    if (onSubmit(fd) !== false) close()
  }
  return (
    <form className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} onSubmit={submit} ref={ref}>
      <div className="modal-h"><h2>{title}</h2><button type="button" className="btn ghost sm" onClick={close} aria-label="Cerrar">✕</button></div>
      <div className="modal-b">{children}</div>
      <div className="modal-f">
        {left ? <div className="left">{left}</div> : null}
        <button type="button" className="btn" onClick={close}>{onSubmit ? 'Cancelar' : 'Cerrar'}</button>
        {onSubmit ? <button className={'btn ' + (danger ? 'danger' : 'primary')} type="submit">{submitLabel}</button> : null}
      </div>
    </form>
  )
}

/** Confirmación para acciones que no se pueden deshacer (importar, borrar todo). */
export function Confirm({ title = 'Confirmar', message, label = 'Eliminar', onYes }) {
  return <Modal title={title} onSubmit={() => { onYes() }} submitLabel={label} danger><p style={{ margin: 0 }}>{message}</p></Modal>
}

/* ---------- piezas pequeñas ---------- */
export const Field = ({ label, hint, children, id }) => (
  <div className="fld"><label htmlFor={id}>{label}</label>{children}{hint ? <span className="hint">{hint}</span> : null}</div>
)
export const Grade = ({ v }) => <span className={'g ' + gradeClass(v)}>{fmtN(v)}</span>
export const GDot = ({ color, size }) => <span className="gdot" style={{ '--c': cvar(color), ...(size ? { width: size, height: size } : {}) }} />

export function Seg({ value, options, onChange, label, className }) {
  return (
    <div className={'seg ' + (className || '')} role="group" aria-label={label}>
      {options.map(([v, l, title]) => <button type="button" key={String(v)} aria-pressed={value === v} onClick={() => onChange(v)} title={title}>{l}</button>)}
    </div>
  )
}

export function GroupChips({ groups, value, onChange, all }) {
  return (
    <div className="chips">
      {all ? <button type="button" className="chip" aria-pressed={!value} onClick={() => onChange(null)}>Todos</button> : null}
      {groups.map(g => (
        <button type="button" key={g.id} className="chip" aria-pressed={value === g.id} onClick={() => onChange(g.id)}><GDot color={g.color} />{g.name}</button>
      ))}
    </div>
  )
}

const ICONS = {
  hoy: <><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /><circle cx="12" cy="12" r="4" /></>,
  grupos: <><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" /><path d="M4 17a3 3 0 0 1 3-3h12M9 8h6" /></>,
  lista: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" /></>,
  entregas: <><path d="M4 7l8-4 8 4v10l-8 4-8-4z" /><path d="M4 7l8 4 8-4M12 11v10" /></>,
  calendario: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  horario: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  auto: <><path d="M12 3a9 9 0 1 0 0 18V3z" /><circle cx="12" cy="12" r="9" /></>,
  mobile: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18h2" /></>,
  desktop: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></>
}
export const Icon = ({ name, size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
)

/* ---------- instalar como app ---------- */
export function InstallButton({ className = 'btn sm primary', label = 'Instalar app' }) {
  const install = useInstall(), { open } = useModal()
  if (!install.can) return null
  const go = async () => { if ((await install.run()) === 'ios') open(<IosInstallModal />) }
  return <button type="button" className={className} onClick={go}>{label}</button>
}
function IosInstallModal() {
  return (
    <Modal title="Instalar eProfy en el iPhone">
      <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <li>Abre esta página en <b>Safari</b> (en otros navegadores del iPhone no se puede instalar).</li>
        <li>Toca el botón <b>Compartir</b>: el cuadrado con una flecha hacia arriba.</li>
        <li>Elige <b>Añadir a pantalla de inicio</b> y pulsa <b>Añadir</b>.</li>
      </ol>
      <p className="muted" style={{ margin: 0 }}>eProfy aparecerá con su icono y se abrirá a pantalla completa, como una app más.</p>
    </Modal>
  )
}
