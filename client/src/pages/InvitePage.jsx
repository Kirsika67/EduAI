import { useState, useEffect } from 'react'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'
import { ROLES, ROLE_LABELS } from '../constants/roles'

const STATUS_META = {
  pending: { variant: 'blue', label: 'Ootel' },
  accepted: { variant: 'green', label: 'Kasutatud' },
  expired: { variant: 'yellow', label: 'Aegunud' },
  revoked: { variant: 'red', label: 'Tühistatud' },
}

export default function InvitePage() {
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const [students, setStudents] = useState([])
  const [invitations, setInvitations] = useState([])
  const [studentId, setStudentId] = useState('')
  const [role, setRole] = useState(ROLES.PARENT)
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [freshLink, setFreshLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  /** RULE 3 — ClassContext peab olema laetud enne igasugust fetch'i. */
  useEffect(() => {
    if (classesLoading) return
    if (!selectedClassId) { setStudents([]); return }
    load()
  }, [classesLoading, selectedClassId])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const s = await apiCall(`/api/classes/${selectedClassId}/students`)
      setStudents(s.students || [])
      const i = await apiCall('/api/invitations')
      setInvitations(i.invitations || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createInvite = async () => {
    if (!studentId) { setError('Vali õpilane'); return }
    setCreating(true)
    setError('')
    setFreshLink(null)
    setCopied(false)
    try {
      const data = await apiCall('/api/invitations', {
        method: 'POST',
        body: JSON.stringify({
          role,
          studentId: Number(studentId),
          email: email.trim() || undefined,
        }),
      })
      setFreshLink({
        url: `${window.location.origin}${data.path}`,
        role: data.invitation.role,
        studentName: students.find(s => Number(s.id) === Number(studentId))?.name || '',
      })
      setEmail('')
      const i = await apiCall('/api/invitations')
      setInvitations(i.invitations || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id) => {
    try {
      await apiCall(`/api/invitations/${id}`, { method: 'DELETE' })
      const i = await apiCall('/api/invitations')
      setInvitations(i.invitations || [])
    } catch (err) {
      setError(err.message)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(freshLink.url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Kutsu lapsevanem või õpilane</h1>
      <p className="text-gray-500 text-sm mb-6">
        Klass: {selectedClass?.name || '—'} · vanema ja õpilase kontod tekivad ainult siit
      </p>

      <div className="bg-white rounded-xl border border-black/10 p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Kes kutsutakse</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] bg-white">
              <option value={ROLES.PARENT}>{ROLE_LABELS[ROLES.PARENT]}</option>
              <option value={ROLES.STUDENT}>{ROLE_LABELS[ROLES.STUDENT]}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Õpilane</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] bg-white">
              <option value="">Vali õpilane…</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">E-post (valikuline)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="vanem@kodu.ee"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Kui lisad e-posti, saab kutsega luua konto ainult selle aadressiga.
        </p>
        <button onClick={createInvite} disabled={creating}
          className="mt-3 bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7] disabled:opacity-50">
          {creating ? 'Loon kutset...' : 'Loo kutselink'}
        </button>
        {error && (
          <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg mt-3">{error}</div>
        )}
      </div>

      {freshLink && (
        <div className="bg-[#EAF3DE] border border-[#639922]/30 rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-[#3B6D11] mb-1">
            Kutselink loodud — {ROLE_LABELS[freshLink.role]}, {freshLink.studentName}
          </p>
          <p className="text-xs text-[#3B6D11]/80 mb-3">
            Kopeeri see kohe ja saada adressaadile. Linki näidatakse ainult üks kord — andmebaasis
            hoitakse ainult räsi. Kui link kaob, tühista kutse ja loo uus.
          </p>
          <div className="flex gap-2">
            <input readOnly value={freshLink.url}
              onFocus={e => e.target.select()}
              className="flex-1 border border-[#639922]/40 rounded-lg px-3 py-2 text-xs font-mono bg-white outline-none" />
            <button onClick={copyLink}
              className="bg-[#639922] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#3B6D11]">
              {copied ? 'Kopeeritud' : 'Kopeeri'}
            </button>
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-900 mb-3">Kooli kutsed</h2>
      {loading && <p className="text-sm text-gray-400">Laadin...</p>}
      {!loading && !invitations.length && (
        <div className="bg-white rounded-xl border border-black/10 p-8 text-center text-gray-400 text-sm">
          Ühtegi kutset pole veel loodud.
        </div>
      )}
      <div className="space-y-2">
        {invitations.map(inv => {
          const meta = STATUS_META[inv.status] || STATUS_META.pending
          return (
            <div key={inv.id}
              className="bg-white rounded-xl border border-black/10 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-bold text-gray-900 truncate">
                    {inv.studentName || 'Kustutatud õpilane'}
                  </span>
                  <Badge variant="purple">{ROLE_LABELS[inv.role] || inv.role}</Badge>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                <p className="text-[11px] text-gray-400">
                  {inv.className ? `${inv.className} · ` : ''}
                  {inv.email || 'e-post määramata'}
                  {inv.createdByName ? ` · kutsus ${inv.createdByName}` : ''}
                </p>
              </div>
              {inv.status === 'pending' && (
                <button onClick={() => revoke(inv.id)}
                  className="text-xs text-gray-400 hover:text-[#A32D2D] flex-shrink-0">
                  Tühista
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
