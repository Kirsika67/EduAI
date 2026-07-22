import { useState, useEffect } from 'react'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'

export default function GradeEntryPage() {
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const [students, setStudents] = useState([])
  const [topics, setTopics] = useState([])
  const [selectedTopic, setSelectedTopic] = useState('')
  const [newTopicName, setNewTopicName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [grades, setGrades] = useState({})
  const [notes, setNotes] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (classesLoading) return
    if (!selectedClassId) return
    loadData()
  }, [classesLoading, selectedClassId])

  const loadData = async () => {
    setLoading(true)
    try {
      const s = await apiCall(`/api/classes/${selectedClassId}/students`)
      setStudents(s.students || [])
      const t = await apiCall(`/api/classes/${selectedClassId}/topics`)
      const list = t.topics || []
      setTopics(list)
      if (list.length) setSelectedTopic(String(list[0].id))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const addTopic = async () => {
    if (!newTopicName.trim()) return
    try {
      const created = await apiCall(`/api/classes/${selectedClassId}/topics`, {
        method: 'POST',
        body: JSON.stringify({ name: newTopicName.trim() }),
      })
      setSelectedTopic(String(created.topic?.id || ''))
      setNewTopicName('')
      const t = await apiCall(`/api/classes/${selectedClassId}/topics`)
      setTopics(t.topics || [])
    } catch (err) { alert('Viga: ' + err.message) }
  }

  const saveGrades = async () => {
    if (!selectedTopic) { alert('Vali teema'); return }
    setSaving(true); setSaved(false)
    try {
      const entries = []
      for (const student of students) {
        const score = grades[student.id]
        if (score === undefined || score === '') continue
        entries.push({
          studentId: Number(student.id),
          score: Number(score),
          notes: notes[student.id] || '',
        })
      }
      if (!entries.length) {
        alert('Sisesta vähemalt üks hinne')
        setSaving(false)
        return
      }
      await apiCall(`/api/classes/${selectedClassId}/grades`, {
        method: 'POST',
        body: JSON.stringify({ topicId: Number(selectedTopic), date, entries }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      setGrades({}); setNotes({})
    } catch (err) { alert('Salvestamine ebaõnnestus: ' + err.message) }
    finally { setSaving(false) }
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Hinnete sisestamine</h1>
      <p className="text-gray-500 text-sm mb-6">Klass {selectedClass?.name || '—'} · {selectedClass?.subject || '—'}</p>

      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Lisa uus teema</p>
        <div className="flex gap-3">
          <input type="text" placeholder="Teema nimi (nt Murdarvud)" value={newTopicName}
            onChange={e => setNewTopicName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTopic()}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
          <button onClick={addTopic}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">Lisa teema</button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Teema</label>
          <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#7F77DD]">
            <option value="">— Vali teema —</option>
            {topics.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hindamise kuupäev</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#7F77DD]" />
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Laadin õpilasi...</div>
      ) : !students.length ? (
        <div className="bg-white rounded-xl border border-black/10 p-6 text-center text-gray-400 text-sm">
          Selles klassis pole õpilasi.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-black/10 overflow-hidden mb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Õpilane</th>
                <th className="text-center text-xs font-medium text-gray-500 px-5 py-3">Hinne (0–110)</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Märkus (valikuline)</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, i) => (
                <tr key={student.id} className={`border-b border-gray-50 ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-gray-900">{student.name}</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <input type="number" min={0} max={110} placeholder="—"
                      value={grades[student.id] ?? ''}
                      onChange={e => setGrades(p => ({ ...p, [student.id]: e.target.value }))}
                      className="w-20 text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#7F77DD]" />
                  </td>
                  <td className="px-5 py-3">
                    <input type="text" placeholder="Valikuline märkus..."
                      value={notes[student.id] || ''}
                      onChange={e => setNotes(p => ({ ...p, [student.id]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#7F77DD]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button onClick={saveGrades} disabled={saving || !students.length}
          className="bg-[#7F77DD] text-white rounded-lg px-6 py-2.5 text-sm hover:bg-[#534AB7] disabled:opacity-50">
          {saving ? 'Salvestan...' : 'Salvesta kõik'}
        </button>
        {saved && <span className="text-sm text-[#3B6D11] font-medium">✓ Hinded salvestatud!</span>}
      </div>
    </div>
  )
}
