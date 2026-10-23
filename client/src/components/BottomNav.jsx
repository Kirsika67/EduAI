import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { navForRole, isStaff } from '../constants/roles'
import { groupsForStaff } from '../pages/VeelPage'

const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
}

const STAFF_ITEMS = [
  ['/paevik', 'Päevik', 'home'],
  ['/tunniplaan', 'Tunniplaan', 'calendar'],
  ['/planeerija', 'Planeerija', 'sparkle'],
  ['/sonumid', 'Suhtlus', 'chat'],
  ['/veel', 'Veel', 'grid'],
]

function itemsFor(role) {
  if (isStaff(role)) return STAFF_ITEMS
  const base = navForRole(role).filter(t => !t.soon).slice(0, 4)
  const icon = (to) => (to.includes('sonumid') ? 'chat' : to.includes('tunniplaan') ? 'calendar' : to.includes('minu-laps') ? 'heart' : 'clock')
  return [...base.map(t => [t.to, t.label, icon(t.to)]), ['/veel', 'Veel', 'grid']]
}

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)' // iOS-i vedru-laadne väljavõte
const DURATION = 420

/**
 * Alumine menüü telefonis. "Veel" või nupu ülalt üles tõmbamine avab kõik valikud
 * lehena, mis järgib sõrme (nagu iPhone'i juhtimiskeskus): vabastades otsustab kiirus ja
 * vahemaa, kas see jääb lahti või läheb kinni. Alla tõmmates sulgub.
 */
export default function BottomNav() {
  const { role } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const navRef = useRef(null)
  const sheetRef = useRef(null)
  const backdropRef = useRef(null)
  const scrollRef = useRef(null)
  const openRef = useRef(false)
  const items = itemsFor(role)
  const main = items.slice(0, -1)
  const moreActive = open || !main.some(([to]) => location.pathname.startsWith(to))

  const groups = isStaff(role)
    ? groupsForStaff(role)
    : [{ title: 'Menüü', items: navForRole(role).filter(t => !t.soon).map(t => [t.to, t.label, '']) }]

  const height = () => sheetRef.current?.offsetHeight || window.innerHeight * 0.8
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  /** Lükkab lehe asendisse y (px, 0 = täiesti lahti). animate=false järgib sõrme. */
  const place = (y, animate) => {
    const sheet = sheetRef.current, back = backdropRef.current
    if (!sheet || !back) return
    const h = height()
    const t = animate && !reduce() ? `transform ${DURATION}ms ${EASE}` : 'none'
    const o = animate && !reduce() ? `opacity ${DURATION}ms ${EASE}` : 'none'
    sheet.style.transition = t
    back.style.transition = o
    sheet.style.transform = `translate3d(0, ${Math.max(0, y)}px, 0)`
    back.style.opacity = String(Math.max(0, Math.min(1, 1 - y / h)))
    const visible = y < h - 1
    sheet.style.visibility = visible || animate ? 'visible' : 'hidden'
    back.style.pointerEvents = y < h * 0.98 ? 'auto' : 'none'
  }

  const setState = (next, animate = true) => {
    openRef.current = next
    setOpen(next)
    place(next ? 0 : height(), animate)
    if (!next) {
      // peida, kui animatsioon läbi, et ei saaks kogemata fokuseerida
      setTimeout(() => { if (!openRef.current && sheetRef.current) sheetRef.current.style.visibility = 'hidden' }, DURATION + 30)
    }
  }

  // Algasend: kinni.
  useEffect(() => { place(height(), false); if (sheetRef.current) sheetRef.current.style.visibility = 'hidden' }, [])
  useEffect(() => { if (openRef.current) setState(false) }, [location.pathname])

  // Sõrmega järgimine: natiivsed kuulajad, sest peame saama scrolli peatada (passive: false).
  useEffect(() => {
    const nav = navRef.current, sheet = sheetRef.current, scroller = scrollRef.current
    if (!nav || !sheet || !scroller) return
    let mode = null // 'open' | 'close'
    let startY = 0, startT = 0, lastY = 0, lastT = 0, vel = 0, moved = false

    const begin = (e, m) => { mode = m; startY = lastY = e.touches[0].clientY; startT = lastT = performance.now(); vel = 0; moved = false }
    const track = (y) => { const now = performance.now(); vel = (y - lastY) / Math.max(1, now - lastT); lastY = y; lastT = now }

    const navStart = (e) => begin(e, 'open')
    const sheetStart = (e) => { if (openRef.current && scroller.scrollTop <= 0) begin(e, 'close') ; else mode = null }

    const move = (e) => {
      if (!mode) return
      const y = e.touches[0].clientY
      const dy = y - startY
      if (!moved && Math.abs(dy) < 6) return
      if (mode === 'open') {
        if (dy >= 0 && !moved) { mode = null; return }
        moved = true
        if (e.cancelable) e.preventDefault()
        track(y)
        const h = height()
        place(h + dy * 1.0, false) // dy negatiivne: leht tõuseb koos sõrmega
        sheet.style.visibility = 'visible'
      } else if (mode === 'close') {
        if (dy <= 0 && !moved) { mode = null; return }
        moved = true
        if (e.cancelable) e.preventDefault()
        track(y)
        place(dy > 0 ? dy * 0.92 : 0, false)
      }
    }

    const end = () => {
      if (!mode) return
      const m = mode
      mode = null
      if (!moved) return
      const h = height()
      const dy = lastY - startY
      if (m === 'open') {
        const open = -dy > h * 0.22 || vel < -0.45
        setState(open)
      } else {
        const close = dy > h * 0.25 || vel > 0.45
        setState(!close)
      }
    }

    nav.addEventListener('touchstart', navStart, { passive: true })
    sheet.addEventListener('touchstart', sheetStart, { passive: true })
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', end, { passive: true })
    window.addEventListener('touchcancel', end, { passive: true })
    return () => {
      nav.removeEventListener('touchstart', navStart)
      sheet.removeEventListener('touchstart', sheetStart)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', end)
    }
  }, [])

  return (
    <>
      <div ref={backdropRef} onClick={() => setState(false)}
        className="md:hidden fixed inset-0 z-40 bg-black/45" style={{ opacity: 0, pointerEvents: 'none' }} />
      <div ref={sheetRef} role="dialog" aria-label="Kõik valikud"
        className="md:hidden fixed bottom-0 inset-x-0 z-[45] bg-[#F7F4EE] rounded-t-[22px] shadow-[0_-8px_30px_rgba(0,0,0,0.18)] flex flex-col"
        style={{ maxHeight: '82vh', willChange: 'transform', visibility: 'hidden', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="pt-2.5 pb-3 flex justify-center flex-shrink-0" onClick={() => setState(false)}>
          <span className="w-10 h-[5px] rounded-full bg-[#CFC9BA]" />
        </div>
        <div ref={scrollRef} className="overflow-y-auto overscroll-contain px-4 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
          {groups.map(g => (
            <section key={g.title} className="mb-5">
              <h2 className="font-serif-brand text-lg text-[#14213D] mb-2">{g.title}</h2>
              <div className="grid grid-cols-2 gap-2">
                {g.items.map(([to, title, , ai]) => (
                  <Link key={to} to={to}
                    className="bg-white border border-[#D9D4C7] rounded-xl px-3 py-3 min-h-[52px] flex items-center justify-between gap-2 text-sm text-[#14213D] active:scale-[0.97] active:bg-[#F1EDE3] transition-transform duration-100">
                    <span className="leading-tight">{title}</span>
                    {ai && <span className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded bg-[#7F77DD] text-white flex-shrink-0">AI</span>}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <nav ref={navRef}
        className="md:hidden fixed bottom-0 inset-x-0 z-[50] bg-[#14213D] border-t border-white/10 select-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', touchAction: 'none' }}
        aria-label="Peamenüü">
        <button onClick={() => setState(!openRef.current)} aria-label="Ava kõik valikud"
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#14213D] rounded-t-lg px-5 pt-1.5 pb-0.5">
          <span className="block w-8 h-1 rounded-full bg-white/40" />
        </button>
        <ul className="flex">
          {main.map(([to, label, icon]) => (
            <li key={to} className="flex-1">
              <NavLink to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[11px] ${isActive && !open ? 'text-white' : 'text-white/55'}`}>
                {({ isActive }) => (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive && !open ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d={ICONS[icon]} />
                    </svg>
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li className="flex-1">
            <button onClick={() => setState(!openRef.current)}
              className={`w-full flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[11px] ${moreActive ? 'text-white' : 'text-white/55'}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={moreActive ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d={ICONS.grid} />
              </svg>
              <span>Veel</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}
