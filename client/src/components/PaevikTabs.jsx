import { NavLink } from 'react-router-dom'

/** Päeviku alamvahekaardid nagu Stuudiumis: Ülevaade, Profil, Veel. */
export default function PaevikTabs() {
  const tab = ({ isActive }) =>
    `px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
      isActive ? 'border-[#14213D] text-[#14213D] font-medium' : 'border-transparent text-[#6B6B66] hover:text-[#14213D]'
    }`
  return (
    <div className="flex gap-1 border-b border-[#D9D4C7] mb-6">
      <NavLink to="/paevik" end className={tab}>Ülevaade</NavLink>
      <NavLink to="/profiil" className={tab}>Profil</NavLink>
      <NavLink to="/veel" className={tab}>Veel</NavLink>
    </div>
  )
}
