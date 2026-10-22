import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Sisselogimine ebaõnnestus')
    } finally {
      setLoading(false)
    }
  }

  const input = 'w-full bg-white border border-[#D9D4C7] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#14213D] transition-colors'

  return (
    <AuthShell>
      <h1 className="text-3xl text-[#14213D]">Tere tulemast tagasi</h1>
      <p className="text-[#6B6B66] text-sm mt-2 mb-8">Logi oma kontoga sisse.</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-[#14213D] mb-1.5">E-post</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="sinu@kool.ee" className={input} />
        </div>
        <div>
          <label className="block text-sm text-[#14213D] mb-1.5">Parool</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className={input} />
        </div>
        {error && <div className="bg-[#F4E5E5] text-[#8A2C2C] text-sm px-4 py-3 rounded-lg">{error}</div>}
        <button type="submit" disabled={loading}
          className="w-full bg-[#14213D] hover:bg-[#1C3556] text-white rounded-lg py-3 text-sm font-medium transition-colors disabled:opacity-50">
          {loading ? 'Laadin...' : 'Logi sisse'}
        </button>
      </form>
      <p className="text-sm text-[#6B6B66] mt-8">
        Pole kontot?{' '}
        <Link to="/register" className="text-[#14213D] underline underline-offset-4 decoration-[#B08D57]">Registreeru</Link>
      </p>
    </AuthShell>
  )
}
