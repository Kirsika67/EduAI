import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { navForRole } from '../constants/roles'

export default function TopNav() {
  const { role } = useAuth()
  const tabs = navForRole(role)

  return (
    <nav className="bg-white border-b border-black/10 px-8 py-3 flex gap-2 flex-shrink-0 overflow-x-auto">
      {tabs.map(tab => (
        tab.soon ? (
          <span key={tab.label} title={`Valmib: ${tab.soon}`}
            className="px-4 py-1.5 rounded-full text-sm font-medium text-gray-300 cursor-default flex-shrink-0">
            {tab.label}
          </span>
        ) : (
          <NavLink key={tab.to} to={tab.to}
            className={({ isActive }) =>
              `px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                isActive ? 'bg-[#7F77DD] text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}>
            {tab.label}
          </NavLink>
        )
      ))}
    </nav>
  )
}
