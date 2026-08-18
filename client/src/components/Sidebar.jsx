import { useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import { useState } from 'react'
import { ROLES, canInvite, isLeadership, isStaff } from '../constants/roles'

function SectionLabel({ children }) {
  return <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">{children}</p>
}

export default function Sidebar() {
  const { logout, teacher, role, school } = useAuth()
  const { classes, selectedClassId, setSelectedClassId, refetchClasses } = useClasses()
  const navigate = useNavigate()
  const [showAddClass, setShowAddClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [adding, setAdding] = useState(false)
  const [showCode, setShowCode] = useState(false)

  const staff = isStaff(role)

  const handleAddClass = async () => {
    if (!newClassName.trim() || !newSubject.trim()) return
    setAdding(true)
    try {
      await apiCall('/api/classes', {
        method: 'POST',
        body: JSON.stringify({ name: newClassName.trim(), subject: newSubject.trim() }),
      })
      setNewClassName('')
      setNewSubject('')
      setShowAddClass(false)
      await refetchClasses()
    } catch (err) {
      alert('Klassi lisamine ebaõnnestus: ' + err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="w-[280px] bg-white border-r border-black/10 flex flex-col h-full flex-shrink-0">
      <div className="p-4 flex items-center gap-3 border-b border-black/10">
        <div className="bg-[#7F77DD] text-white text-sm font-bold px-3 py-2 rounded-lg">EduAI</div>
        <div className="min-w-0">
          <p className="text-gray-600 text-sm font-medium truncate">{teacher?.roleLabel || 'Õpetaja'}</p>
          {school?.name && <p className="text-gray-400 text-xs truncate">{school.name}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!staff && (
          <>
            <SectionLabel>Minu vaade</SectionLabel>
            <p className="text-sm text-gray-500">
              Näed ainult {role === ROLES.STUDENT ? 'enda' : 'oma lapse'} andmeid.
            </p>
          </>
        )}

        {staff && (
          <>
            <SectionLabel>Aktiivsed klassid</SectionLabel>
            {classes.length === 0 && (
              <p className="text-sm text-gray-400 italic">Ühtegi klassi pole lisatud</p>
            )}
            {classes.map(cls => (
              <button
                key={cls.id}
                onClick={() => { setSelectedClassId(Number(cls.id)); navigate('/ulevaade') }}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  Number(cls.id) === Number(selectedClassId)
                    ? 'bg-[#EEEDFE] text-[#534AB7] font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="text-sm font-medium">{cls.name}</div>
                <div className="text-xs text-gray-500">{cls.subject}</div>
              </button>
            ))}
            {showAddClass && (
              <div className="mt-3 p-3 border border-[#AFA9EC] rounded-lg bg-[#EEEDFE]">
                <input
                  type="text"
                  placeholder="Klassi nimi (nt 8A)"
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 mb-2 outline-none focus:border-[#7F77DD]"
                />
                <input
                  type="text"
                  placeholder="Õppeaine (nt Matemaatika)"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 mb-2 outline-none focus:border-[#7F77DD]"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddClass} disabled={adding}
                    className="flex-1 bg-[#7F77DD] text-white text-sm rounded px-3 py-1.5 hover:bg-[#534AB7] disabled:opacity-50">
                    {adding ? 'Lisan...' : 'Lisa'}
                  </button>
                  <button onClick={() => { setShowAddClass(false); setNewClassName(''); setNewSubject('') }}
                    className="flex-1 border border-gray-300 text-gray-600 text-sm rounded px-3 py-1.5 hover:bg-gray-50">
                    Tühista
                  </button>
                </div>
              </div>
            )}

            {canInvite(role) && (
              <div className="mt-6">
                <SectionLabel>Pered</SectionLabel>
                <NavLink to="/kutsu"
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive ? 'bg-[#EEEDFE] text-[#534AB7] font-medium' : 'text-gray-700 hover:bg-gray-50'
                    }`}>
                  Kutsu vanem või õpilane
                </NavLink>
              </div>
            )}

            {isLeadership(role) && (
              <div className="mt-6">
                <SectionLabel>Juhtimine</SectionLabel>
                <span title="Valmib: Faas 6"
                  className="block px-3 py-2 rounded-lg text-sm text-gray-300 cursor-default">
                  Kooli ülevaade
                </span>
              </div>
            )}

            <div className="mt-6">
              <SectionLabel>Kool</SectionLabel>
              <NavLink to="/seaded"
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-[#EEEDFE] text-[#534AB7] font-medium' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                Kool ja konto
              </NavLink>
              {school?.joinCode && (
                showCode ? (
                  <div className="px-3 pt-2">
                    <p className="font-mono text-xs tracking-widest text-[#534AB7] bg-[#EEEDFE] rounded-lg px-2 py-1.5">
                      {school.joinCode}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">Liitumiskood kolleegile.</p>
                  </div>
                ) : (
                  <button onClick={() => setShowCode(true)}
                    className="text-xs text-gray-400 hover:text-[#534AB7] px-3 pt-2">
                    Näita liitumiskoodi
                  </button>
                )
              )}
            </div>
          </>
        )}
      </div>

      <div className="p-4 border-t border-black/10 space-y-2">
        {staff && !showAddClass && (
          <button onClick={() => setShowAddClass(true)}
            className="w-full text-sm border border-[#AFA9EC] text-[#534AB7] rounded-lg px-4 py-2 hover:bg-[#EEEDFE] transition-colors">
            + Lisa klass
          </button>
        )}
        <button onClick={logout}
          className="w-full text-sm text-gray-400 hover:text-red-500 transition-colors py-1">
          Logi välja
        </button>
      </div>
    </div>
  )
}
