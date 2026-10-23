import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { navForRole, isStaff } from '../constants/roles'

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

/** Alumine menüü telefonis: viis tähtsamat kohta pöidla ulatuses. */
export default function BottomNav() {
  const { role } = useAuth()
  const items = itemsFor(role)
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#14213D] border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Peamenüü"
    >
      <ul className="flex">
        {items.map(([to, label, icon]) => (
          <li key={to} className="flex-1">
            <NavLink to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-[11px] ${isActive ? 'text-white' : 'text-white/55'}`}>
              {({ isActive }) => (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d={ICONS[icon]} />
                  </svg>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
