import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiCall } from '../api/client'
import { ROLES, ROLE_LABELS, landingPathForRole } from '../constants/roles'

export default function AcceptInvitePage() {
  const { token } = useParams()
  const { acceptInvite } = useAuth()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState(null)
  const [checking, setChecking] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiCall(`/api/invitations/token/${token}`)
      .then(data => {
        setInvitation(data.invitation)
        if (data.invitation.email) setEmail(data.invitation.email)
      })
      .catch(err => setLoadError(err.message || 'Kutset ei leitud'))
      .finally(() => setChecking(false))
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Parool peab olema vähemalt 8 tähemärki pikk'); return }
    setSubmitting(true)
    try {
      const data = await acceptInvite(token, { name, email, password })
      navigate(landingPathForRole(data.teacher.role))
    } catch (err) {
      setError(err.message || 'Konto loomine ebaõnnestus')
    } finally {
      setSubmitting(false)
    }
  }

  const isStudent = invitation?.role === ROLES.STUDENT

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex items-center justify-center py-10">
      <div className="bg-white rounded-2xl shadow-sm border border-black/10 p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block bg-[#7F77DD] text-white text-xl font-bold px-6 py-3 rounded-xl mb-4">EduAI</div>
          {checking && <p className="text-gray-500 text-sm">Kontrollin kutset...</p>}
          {!checking && loadError && (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Kutse ei kehti</h1>
              <p className="text-gray-500 text-sm mt-2">{loadError}</p>
            </>
          )}
          {!checking && invitation && (
            <>
              <h1 className="text-2xl font-bold text-gray-900">
                {isStudent ? 'Loo oma õpilaskonto' : 'Loo lapsevanema konto'}
              </h1>
              <p className="text-gray-500 text-sm mt-2">
                {invitation.schoolName} kutsub sind{' '}
                {isStudent ? 'oma tulemusi jälgima' : `jälgima, kuidas läheb lapsel ${invitation.studentName}`}
                {invitation.className ? ` (${invitation.className})` : ''}.
              </p>
              <p className="text-[11px] text-gray-400 mt-2">
                Roll: {ROLE_LABELS[invitation.role]} · näed ainult
                {isStudent ? ' enda' : ' oma lapse'} andmeid
              </p>
            </>
          )}
        </div>

        {!checking && invitation && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nimi</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                placeholder="Sinu täisnimi"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                readOnly={Boolean(invitation.email)}
                placeholder="sinu@kodu.ee"
                className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD] ${
                  invitation.email ? 'bg-gray-50 text-gray-500' : ''
                }`} />
              {invitation.email && (
                <p className="text-xs text-gray-400 mt-1">Kool määras selle aadressi ette.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parool</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="Vähemalt 8 tähemärki"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD]" />
            </div>
            {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg">{error}</div>}
            <button type="submit" disabled={submitting}
              className="w-full bg-[#7F77DD] hover:bg-[#534AB7] text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50">
              {submitting ? 'Loon kontot...' : 'Loo konto'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          On juba konto?{' '}
          <Link to="/login" className="text-[#7F77DD] hover:underline font-medium">Logi sisse</Link>
        </p>
      </div>
    </div>
  )
}
