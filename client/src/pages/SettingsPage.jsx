import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'

export default function SettingsPage() {
  const { teacher, school, role, applyAccount } = useAuth()
  const [permissions, setPermissions] = useState(null)
  const [members, setMembers] = useState([])
  const [schoolName, setSchoolName] = useState(school?.name || '')
  const [chosenRole, setChosenRole] = useState(role || '')
  const [savingSchool, setSavingSchool] = useState(false)
  const [savingRole, setSavingRole] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showCode, setShowCode] = useState(false)

  /** Järjest, mitte Promise.all — see on projekti kõva reegel (vt AGENTS.md). */
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const p = await apiCall('/api/account/permissions')
        if (cancelled) return
        setPermissions(p)
        const m = await apiCall('/api/account/school/members')
        if (cancelled) return
        setMembers(m.members || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => { setSchoolName(school?.name || '') }, [school?.name])
  useEffect(() => { setChosenRole(role || '') }, [role])

  const saveSchool = async () => {
    setSavingSchool(true); setError(''); setMessage('')
    try {
      const data = await apiCall('/api/account/school', {
        method: 'PATCH',
        body: JSON.stringify({ name: schoolName.trim() }),
      })
      applyAccount(data.teacher)
      setMessage('Kooli nimi salvestatud.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingSchool(false)
    }
  }

  const saveRole = async () => {
    setSavingRole(true); setError(''); setMessage('')
    try {
      const data = await apiCall('/api/account/role', {
        method: 'PATCH',
        body: JSON.stringify({ role: chosenRole }),
      })
      applyAccount(data.teacher)
      setMessage(`Roll on nüüd: ${data.teacher.roleLabel}.`)
      const m = await apiCall('/api/account/school/members')
      setMembers(m.members || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingRole(false)
    }
  }

  const canManage = permissions?.canManageSchool
  const availableRoles = permissions?.availableRoles || []

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Kool ja konto</h1>
      <p className="text-gray-500 text-sm mb-6">
        {school?.name || 'Kool'} · {teacher?.roleLabel}
      </p>

      {message && (
        <div className="bg-[#EAF3DE] text-[#3B6D11] text-sm px-4 py-2.5 rounded-lg mb-4">{message}</div>
      )}
      {error && (
        <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>
      )}

      {permissions && !canManage && (
        <div className="bg-[#FAEEDA] text-[#854F0B] text-sm px-4 py-2.5 rounded-lg mb-4">
          {permissions.reason}
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/10 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Kooli nimi</h2>
        <p className="text-xs text-gray-400 mb-3">
          Vanadele kontodele pandi nimi automaatselt, kui koolid kasutusele võeti — pane siia päris nimi.
        </p>
        <div className="flex gap-2">
          <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
            disabled={!canManage}
            placeholder="Nt Tartu Kesklinna Kool"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] disabled:bg-gray-50 disabled:text-gray-400" />
          <button onClick={saveSchool}
            disabled={!canManage || savingSchool || !schoolName.trim() || schoolName.trim() === school?.name}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7] disabled:opacity-40">
            {savingSchool ? 'Salvestan...' : 'Salvesta'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-black/10 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Minu roll</h2>
        <p className="text-xs text-gray-400 mb-3">
          Roll otsustab, mida sa näed. Klassijuhataja, õppealajuhataja ja direktor saavad kutsuda
          lapsevanemaid ja õpilasi. Iga muudatus läheb auditilogisse.
        </p>
        <div className="flex gap-2">
          <select value={chosenRole} onChange={e => setChosenRole(e.target.value)}
            disabled={!canManage}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] bg-white disabled:bg-gray-50 disabled:text-gray-400">
            {availableRoles.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button onClick={saveRole}
            disabled={!canManage || savingRole || chosenRole === role}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7] disabled:opacity-40">
            {savingRole ? 'Salvestan...' : 'Salvesta'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-black/10 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Kooli liitumiskood</h2>
        <p className="text-xs text-gray-400 mb-3">
          Kolleeg saab sellega registreeruda sama kooli alla, mitte eraldi kooli.
        </p>
        {showCode ? (
          <p className="font-mono text-sm tracking-widest text-[#534AB7] bg-[#EEEDFE] rounded-lg px-3 py-2 inline-block">
            {school?.joinCode || '—'}
          </p>
        ) : (
          <button onClick={() => setShowCode(true)}
            className="text-sm text-[#534AB7] hover:underline">
            Näita koodi
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-black/10 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Kooli töötajad ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3">
              <span className="text-sm text-gray-800 flex-1 truncate">
                {m.name}
                {m.isMe && <span className="text-gray-400 text-xs"> · sina</span>}
              </span>
              <Badge variant="purple">{m.roleLabel}</Badge>
            </div>
          ))}
          {!members.length && (
            <p className="text-sm text-gray-400">Ainult sina.</p>
          )}
        </div>
      </div>
    </div>
  )
}
