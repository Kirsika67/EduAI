import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-black/10 p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block bg-[#1C3556] text-white text-xl font-bold px-6 py-3 rounded-xl mb-4">EduAI</div>
          <h1 className="text-2xl font-bold text-gray-900">Logi sisse oma kontoga</h1>
          <p className="text-gray-500 text-sm mt-1">Tere tulemast tagasi</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="sinu@kool.ee"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parool</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD]" />
          </div>
          {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-[#1C3556] hover:bg-[#2A4A7A] text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50">
            {loading ? 'Laadin...' : 'Logi sisse'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Pole kontot?{' '}
          <Link to="/register" className="text-[#7F77DD] hover:underline font-medium">Registreeru</Link>
        </p>
      </div>
    </div>
  )
}
