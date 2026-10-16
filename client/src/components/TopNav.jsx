import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { navForRole } from '../constants/roles'

/** Stuudiumi-laadne tumesinine päis: kõik lehed on ühe klõpsu kaugusel. */
export default function TopNav() {
  const { role } = useAuth()
  const tabs = navForRole(role)

  return (
    <nav className="flex-1 min-w-0 px-6 py-3 flex flex-wrap items-center gap-x-1 gap-y-2 flex-shrink-0">
      {tabs.map(tab => (
        tab.soon ? (
          <span key={tab.label} title={`Valmib: ${tab.soon}`}
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-white/30 cursor-default">
            {tab.label}
          </span>
        ) : (
          <NavLink key={tab.to} to={tab.to}
            className={({ isActive }) =>
              `px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isActive ? 'bg-white text-[#1c3556] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}>
            {tab.label}
            {tab.ai && (
              <span className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded bg-[#7F77DD] text-white">AI</span>
            )}
          </NavLink>
        )
      ))}
    </nav>
  )
}
