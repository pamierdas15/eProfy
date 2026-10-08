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
