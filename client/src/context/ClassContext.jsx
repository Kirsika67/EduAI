import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { apiCall } from '../api/client'

const ClassContext = createContext(null)

export function ClassProvider({ children }) {
  const { teacher, loading: authLoading } = useAuth()
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchClasses = async () => {
    try {
      const data = await apiCall('/api/classes')
      const list = data.classes || []
      setClasses(list)
      setSelectedClassId((prev) => {
        if (prev && list.some((c) => Number(c.id) === Number(prev))) return Number(prev)
        return list.length ? Number(list[0].id) : null
      })
    } catch (err) {
      console.error('Klasside laadimine ebaõnnestus:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!teacher) { setLoading(false); return }
    fetchClasses()
  }, [authLoading, teacher])

  const selectedClass = classes.find(c => Number(c.id) === Number(selectedClassId)) || null

  return (
    <ClassContext.Provider value={{
      classes,
      selectedClassId,
      setSelectedClassId: (id) => setSelectedClassId(Number(id)),
      selectedClass,
      loading,
      refetchClasses: fetchClasses,
    }}>
      {children}
    </ClassContext.Provider>
  )
}

export function useClasses() {
  const ctx = useContext(ClassContext)
  if (!ctx) throw new Error('useClasses peab olema ClassProvider sees')
  return ctx
}
