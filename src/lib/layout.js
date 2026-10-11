// Formato de la app: Automático (según la pantalla), Móvil o PC.
import { useEffect, useState } from 'react'

const VP_DEVICE = 'width=device-width,initial-scale=1,viewport-fit=cover'
const read = () => { try { const v = localStorage.getItem('eprofy.layout'); return ['auto', 'mobile', 'desktop'].includes(v) ? v : 'auto' } catch (e) { return 'auto' } }

function apply(pref) {
  const vp = document.querySelector('meta[name=viewport]')
  // «PC» en un móvil: se dibuja la versión de escritorio a 1200 px y el navegador la encoge
  const want = pref === 'desktop' && window.screen.width < 900 ? 'width=1200,viewport-fit=cover' : VP_DEVICE
  if (vp && vp.getAttribute('content') !== want) vp.setAttribute('content', want)
  const narrow = window.matchMedia('(max-width: 820px)').matches
  const mobile = pref === 'mobile' || (pref === 'auto' && narrow)
  document.documentElement.classList.toggle('m', mobile)
  document.documentElement.classList.toggle('framed', pref === 'mobile' && window.innerWidth > 520)
}

export function useLayout() {
  const [pref, setPrefState] = useState(read)
  useEffect(() => {
    apply(pref)
    const mq = window.matchMedia('(max-width: 820px)')
    let t
    const on = () => apply(pref)
    const onResize = () => { clearTimeout(t); t = setTimeout(on, 150) }
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on)
    window.addEventListener('resize', onResize)
    return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on); window.removeEventListener('resize', onResize) }
  }, [pref])
  const setPref = v => { try { localStorage.setItem('eprofy.layout', v) } catch (e) { /* */ } setPrefState(v) }
  return [pref, setPref]
}

/* ---------- instalar como app ---------- */
// El navegador avisa de que se puede instalar con «beforeinstallprompt» (Chrome, Edge, Samsung…).
// Se guarda en cuanto llega, aunque la pantalla que muestra el botón aún no exista.
let deferred = null
const subs = new Set()
const notify = () => subs.forEach(f => f())
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; notify() })
  window.addEventListener('appinstalled', () => { deferred = null; notify() })
}
export const isStandalone = () => typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
export const isIOS = () => typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/**
 * { can, run, ios }: `can` = se puede ofrecer instalar; `run()` abre el aviso del navegador
 * o, en iPhone/iPad (Safari no tiene aviso), muestra cómo hacerlo a mano.
 */
export function useInstall() {
  const [, force] = useState(0)
  useEffect(() => { const f = () => force(x => x + 1); subs.add(f); return () => subs.delete(f) }, [])
  const ios = isIOS()
  const can = !isStandalone() && (!!deferred || ios)
  const run = async () => {
    if (deferred) { const d = deferred; deferred = null; notify(); d.prompt(); try { await d.userChoice } catch (e) { /* */ } return 'prompt' }
    return 'ios'
  }
  return { can, run, ios }
}
