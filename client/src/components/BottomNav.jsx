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

/** Alumine menüü telefonis: viis tähtsamat kohta. "Veel" või üles pühkimine avab kõik valikud. */
export default function BottomNav() {
  const { role } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const touchY = useRef(null)
  const items = itemsFor(role)
  const main = items.slice(0, -1)
  const moreActive = open || !main.some(([to]) => location.pathname.startsWith(to))

  useEffect(() => { setOpen(false) }, [location.pathname])

  const groups = isStaff(role)
    ? groupsForStaff(role)
    : [{ title: 'Menüü', items: navForRole(role).filter(t => !t.soon).map(t => [t.to, t.label, '']) }]

  const onTouchStart = (e) => { touchY.current = e.touches[0].clientY }
  const onTouchEnd = (e) => {
    if (touchY.current == null) return
    const dy = e.changedTouches[0].clientY - touchY.current
    touchY.current = null
    if (dy < -25) setOpen(true)
  }

  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-label="Kõik valikud">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div
            className="absolute bottom-0 inset-x-0 bg-[#F7F4EE] rounded-t-2xl max-h-[82vh] overflow-y-auto overscroll-contain"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
            onTouchStart={(e) => { touchY.current = e.touches[0].clientY }}
            onTouchEnd={(e) => {
              if (touchY.current == null) return
              const dy = e.changedTouches[0].clientY - touchY.current
              touchY.current = null
              if (dy > 70 && e.currentTarget.scrollTop <= 0) setOpen(false)
            }}
          >
            <div className="sticky top-0 bg-[#F7F4EE] pt-2 pb-3 flex flex-col items-center z-10">
              <button onClick={() => setOpen(false)} aria-label="Sulge" className="w-12 h-1.5 rounded-full bg-[#D9D4C7]" />
            </div>
            {groups.map(g => (
              <section key={g.title} className="px-4 mb-5">
                <h2 className="font-serif-brand text-lg text-[#14213D] mb-2">{g.title}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {g.items.map(([to, title, , ai]) => (
                    <Link key={to} to={to}
                      className="bg-white border border-[#D9D4C7] rounded-lg px-3 py-3 min-h-[52px] flex items-center justify-between gap-2 text-sm text-[#14213D]">
                      <span className="leading-tight">{title}</span>
                      {ai && <span className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded bg-[#7F77DD] text-white flex-shrink-0">AI</span>}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#14213D] border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Peamenüü"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button onClick={() => setOpen(true)} aria-label="Ava kõik valikud"
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#14213D] rounded-t-lg px-4 pt-1 pb-0.5">
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
            <button onClick={() => setOpen(o => !o)}
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
