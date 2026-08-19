import { createContext, useContext, useState, useEffect } from 'react'
import { apiCall } from '../api/client'
import { ROLES } from '../constants/roles'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  /**
   * Serveri väli on ajaloolistel põhjustel `teacher`, aga seal võib olla ka
   * vanema või õpilase konto. Uus kood kasutagu `user`/`role`.
   */
  const [teacher, setTeacher] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('eduai_token')
    if (!token) { setLoading(false); return }
    apiCall('/api/auth/me')
      .then(data => setTeacher(data.teacher))
      .catch(() => localStorage.removeItem('eduai_token'))
      .finally(() => setLoading(false))
  }, [])

  /**
   * Väljalogimine ühes sakis peab jõudma ka teistesse. localStorage on sakkide
   * vahel jagatud, aga Reacti olek mitte: ilma selleta näitab teine sakk edasi
   * sisselogitud liidest, kuni järgmine päring ootamatult 401 annab.
   */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'eduai_token' && !e.newValue) {
        setTeacher(null)
        if (window.location.pathname !== '/login') window.location.href = '/login'
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = async (email, password) => {
    const data = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem('eduai_token', data.token)
    setTeacher(data.teacher)
    return data
  }

  const register = async ({ name, email, password, role, schoolName, schoolCode }) => {
    const data = await apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role, schoolName, schoolCode }),
    })
    localStorage.setItem('eduai_token', data.token)
    setTeacher(data.teacher)
    return data
  }

  /** Vanema/õpilase konto loomine kutselingi kaudu. */
  const acceptInvite = async (token, { name, email, password }) => {
    const data = await apiCall(`/api/invitations/token/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    localStorage.setItem('eduai_token', data.token)
    setTeacher(data.teacher)
    return data
  }

  /** Pärast rolli või kooli muutmist — server tagastab uuendatud konto. */
  const applyAccount = (updated) => setTeacher(updated)

  const refreshAccount = async () => {
    const data = await apiCall('/api/auth/me')
    setTeacher(data.teacher)
    return data.teacher
  }

  const logout = () => {
    localStorage.removeItem('eduai_token')
    setTeacher(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{
      teacher,
      user: teacher,
      role: teacher?.role || null,
      school: teacher?.school || null,
      isFamily: teacher?.role === ROLES.PARENT || teacher?.role === ROLES.STUDENT,
      loading,
      login,
      register,
      acceptInvite,
      applyAccount,
      refreshAccount,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth peab olema AuthProvider sees')
  return ctx
}
