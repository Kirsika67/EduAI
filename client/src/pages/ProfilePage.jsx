import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiCall } from '../api/client'
import { isStaff } from '../constants/roles'

export default function ProfilePage() {
  const { teacher, role, school, applyAccount } = useAuth()
  const [name, setName] = useState(teacher?.name || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true); setError(''); setMessage('')
    try {
      const body = { name: name.trim() }
      if (newPassword) { body.currentPassword = currentPassword; body.newPassword = newPassword }
      const data = await apiCall('/api/account/profile', { method: 'PATCH', body: JSON.stringify(body) })
      applyAccount(data.teacher)
      setCurrentPassword(''); setNewPassword('')
      setMessage(newPassword ? 'Andmed ja parool salvestatud.' : 'Andmed salvestatud.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2a6db0]'

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Profiil</h1>
      {message && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">{message}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <section className="bg-white rounded-lg border border-black/10 p-5 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Minu andmed</h2>
        <label className="block text-sm text-gray-700 mb-1">Nimi</label>
        <input value={name} onChange={e => setName(e.target.value)} className={input + ' mb-3'} />
        <dl className="text-sm grid grid-cols-[120px_1fr] gap-y-1.5 text-gray-700">
          <dt className="text-gray-500">E-post</dt><dd>{teacher?.email}</dd>
          <dt className="text-gray-500">Roll</dt><dd>{teacher?.roleLabel}</dd>
          {school?.name && (<><dt className="text-gray-500">Kool</dt><dd>{school.name}</dd></>)}
        </dl>
        {isStaff(role) && (
          <p className="text-xs text-gray-500 mt-3">Kooli nime ja rolli muutmine: <Link to="/seaded" className="text-[#2a6db0] hover:underline">Kool ja konto</Link>.</p>
        )}
      </section>

      <section className="bg-white rounded-lg border border-black/10 p-5 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Parooli vahetus</h2>
        <label className="block text-sm text-gray-700 mb-1">Praegune parool</label>
        <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={input + ' mb-3'} autoComplete="current-password" />
        <label className="block text-sm text-gray-700 mb-1">Uus parool (vähemalt 8 märki)</label>
        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={input} autoComplete="new-password" />
      </section>

      <button onClick={save} disabled={saving || name.trim().length < 2}
        className="bg-[#1c3556] text-white text-sm rounded-lg px-5 py-2 hover:bg-[#2a4a7a] disabled:opacity-50">
        {saving ? 'Salvestan...' : 'Salvesta'}
      </button>
    </div>
  )
}
