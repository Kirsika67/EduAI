import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'
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
      navigate('/')
    } catch (err) {
      setError(err.message || 'Registreerimine ebaõnnestus')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div>
        <h1 className="text-3xl text-[#14213D]">Loo konto</h1>
        <p className="text-[#6B6B66] text-sm mt-2 mb-8">Koolitöötaja konto.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nimi</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="Sinu täisnimi"
              className="w-full bg-white border border-[#D9D4C7] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#14213D] transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Roll koolis</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full bg-white border border-[#D9D4C7] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#14213D] transition-colors bg-white">
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
              className="w-full bg-white border border-[#D9D4C7] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#14213D] transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parool</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="Vähemalt 8 tähemärki"
              className="w-full bg-white border border-[#D9D4C7] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#14213D] transition-colors" />
          </div>

          <div className="border-t border-black/5 pt-4">
            <p className="block text-sm font-medium text-gray-700 mb-2">Kool</p>
            <div className="flex gap-2 mb-3">
              {[['new', 'Loon uue kooli'], ['join', 'Liitun kooliga']].map(([value, label]) => (
                <button key={value} type="button" onClick={() => { setSchoolMode(value); setError('') }}
                  className={`flex-1 text-xs rounded-full px-3 py-1.5 border transition-colors ${
                    schoolMode === value
                      ? 'bg-[#14213D] border-[#14213D] text-white font-medium'
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
                  className="w-full bg-white border border-[#D9D4C7] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#14213D] transition-colors" />
                <p className="text-xs text-gray-400 mt-1">
                  Saad liitumiskoodi, millega kolleegid sama kooliga liituvad.
                </p>
              </>
            ) : (
              <>
                <input type="text" value={schoolCode}
                  onChange={e => setSchoolCode(e.target.value.toUpperCase())}
                  placeholder="Nt K7QM4XPD"
                  className="w-full bg-white border border-[#D9D4C7] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#14213D] transition-colors tracking-widest font-mono" />
                <p className="text-xs text-gray-400 mt-1">
                  Koodi saad oma kooli EduAI haldajalt.
                </p>
              </>
            )}
          </div>

          {error && <div className="bg-[#F4E5E5] text-[#8A2C2C] text-sm px-4 py-3 rounded-lg">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-[#14213D] hover:bg-[#1C3556] text-white font-medium rounded-lg py-3 text-sm transition-colors disabled:opacity-50">
            {loading ? 'Loon kontot...' : 'Registreeru'}
          </button>
        </form>
        <p className="text-sm text-[#6B6B66] mt-8">
          On juba konto?{' '}
          <Link to="/login" className="text-[#14213D] underline underline-offset-4 decoration-[#B08D57]">Logi sisse</Link>
        </p>
      </div>
    </AuthShell>
  )
}
