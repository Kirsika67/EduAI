import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLES, ROLE_LABELS, SELF_REGISTER_ROLES } from '../constants/roles'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(ROLES.TEACHER)
  const [schoolMode, setSchoolMode] = useState('new')
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Parool peab olema vähemalt 8 tähemärki pikk'); return }
    if (schoolMode === 'new' && !schoolName.trim()) { setError('Sisesta kooli nimi'); return }
    if (schoolMode === 'join' && !schoolCode.trim()) { setError('Sisesta kooli liitumiskood'); return }
    setLoading(true)
    try {
      await register({
        name,
        email,
        password,
        role,
        schoolName: schoolMode === 'new' ? schoolName.trim() : undefined,
        schoolCode: schoolMode === 'join' ? schoolCode.trim() : undefined,
      })
      navigate('/ulevaade')
    } catch (err) {
      setError(err.message || 'Registreerimine ebaõnnestus')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex items-center justify-center py-10">
      <div className="bg-white rounded-2xl shadow-sm border border-black/10 p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block bg-[#7F77DD] text-white text-xl font-bold px-6 py-3 rounded-xl mb-4">EduAI</div>
          <h1 className="text-2xl font-bold text-gray-900">Loo konto</h1>
          <p className="text-gray-500 text-sm mt-1">Koolitöötaja konto</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nimi</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="Sinu täisnimi"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Roll koolis</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD] bg-white">
              {SELF_REGISTER_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Lapsevanema ja õpilase kontod luuakse kooli kutse kaudu, mitte siit.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="sinu@kool.ee"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parool</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="Vähemalt 8 tähemärki"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD]" />
          </div>

          <div className="border-t border-black/5 pt-4">
            <p className="block text-sm font-medium text-gray-700 mb-2">Kool</p>
            <div className="flex gap-2 mb-3">
              {[['new', 'Loon uue kooli'], ['join', 'Liitun kooliga']].map(([value, label]) => (
                <button key={value} type="button" onClick={() => { setSchoolMode(value); setError('') }}
                  className={`flex-1 text-xs rounded-full px-3 py-1.5 border transition-colors ${
                    schoolMode === value
                      ? 'bg-[#EEEDFE] border-[#AFA9EC] text-[#534AB7] font-medium'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            {schoolMode === 'new' ? (
              <>
                <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
                  placeholder="Nt Tartu Kesklinna Kool"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD]" />
                <p className="text-xs text-gray-400 mt-1">
                  Saad liitumiskoodi, millega kolleegid sama kooliga liituvad.
                </p>
              </>
            ) : (
              <>
                <input type="text" value={schoolCode}
                  onChange={e => setSchoolCode(e.target.value.toUpperCase())}
                  placeholder="Nt K7QM4XPD"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD] tracking-widest font-mono" />
                <p className="text-xs text-gray-400 mt-1">
                  Koodi saad oma kooli EduAI haldajalt.
                </p>
              </>
            )}
          </div>

          {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-[#7F77DD] hover:bg-[#534AB7] text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50">
            {loading ? 'Loon kontot...' : 'Registreeru'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          On juba konto?{' '}
          <Link to="/login" className="text-[#7F77DD] hover:underline font-medium">Logi sisse</Link>
        </p>
      </div>
    </div>
  )
}
