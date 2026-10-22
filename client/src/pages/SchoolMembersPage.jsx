import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiCall } from '../api/client'
import { useClasses } from '../context/ClassContext'

const getInitials = name => name?.split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?'

export default function SchoolMembersPage() {
  const { loading: classesLoading } = useClasses()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (classesLoading) return
    const load = async () => {
      try {
        const d = await apiCall('/api/account/school/members')
        setMembers(d.members || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [classesLoading])

  if (classesLoading) return <div>Laadin...</div>

  const q = search.trim().toLowerCase()
  const filtered = members.filter(m =>
    !q ||
    m.name?.toLowerCase().includes(q) ||
    m.roleLabel?.toLowerCase().includes(q) ||
    m.email?.toLowerCase().includes(q)
  )

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Kooli liikmed</h1>
      <p className="text-gray-500 text-sm mb-6">Kõik õpetajad ja töötajad, kes on EduAI-ga liitunud.</p>
      <input type="text" placeholder="Otsi nime, rolli või e-posti järgi..." value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD] mb-6" />
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}
      {loading && <p className="text-gray-400 text-sm">Laadin...</p>}
      {!loading && !error && !filtered.length && <p className="text-gray-400 text-sm">Liikmeid ei leitud.</p>}
      <div className="space-y-3">
        {filtered.map(member => (
          <div key={member.id} className="bg-white rounded-xl border border-black/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#EEEDFE] text-[#534AB7] flex items-center justify-center text-sm font-bold flex-shrink-0">
                {getInitials(member.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {member.name}{member.isMe ? ' (mina)' : ''}
                </p>
                <p className="text-xs text-gray-400 truncate">{member.roleLabel || member.role}{member.email ? ` · ${member.email}` : ''}</p>
              </div>
            </div>
            {!member.isMe && (
              <button
                onClick={() => navigate('/sonumid', { state: { recipientId: member.id } })}
                className="text-sm bg-[#1C3556] text-white rounded-lg px-4 py-2 hover:bg-[#2A4A7A] transition-colors flex-shrink-0">
                Saada sõnum
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
