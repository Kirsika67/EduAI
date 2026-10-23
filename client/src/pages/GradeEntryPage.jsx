import { useState, useEffect } from 'react'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import { downloadFile, uploadForm } from '../api/download'

export default function GradeEntryPage() {
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const [students, setStudents] = useState([])
  const [topics, setTopics] = useState([])
  const [selectedTopic, setSelectedTopic] = useState('')
  const [newTopicName, setNewTopicName] = useState('')
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  const [grades, setGrades] = useState({})
  const [notes, setNotes] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [importing, setImporting] = useState(false)
  const [toolMsg, setToolMsg] = useState('')
  const [toolErr, setToolErr] = useState('')

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

  const importFile = async (file) => {
    if (!file) return
    if (!selectedTopic) { setToolErr('Vali enne teema.'); return }
    setImporting(true); setToolErr(''); setToolMsg('')
    try {
      const form = new FormData()
      form.append('topicId', selectedTopic)
      form.append('date', date)
      form.append('file', file)
      const r = await uploadForm(`/api/classes/${selectedClassId}/grades/import`, form)
      const extra = [...(r.warnings || []), ...(r.skipped || [])].length
      setToolMsg(`Imporditud ${r.imported} hinnet.${extra ? ` Märkusi/vahelejäetud ridu: ${extra}.` : ''}`)
    } catch (err) { setToolErr(err.message) }
    finally { setImporting(false) }
  }

  const exportGrades = async () => {
    setToolErr('')
    try { await downloadFile(`/api/classes/${selectedClassId}/export/grades.csv`, 'hinded.csv') }
    catch (err) { setToolErr(err.message) }
  }

  const downloadTemplate = () => {
    const rows = ['nimi;hinne', ...students.map(s => `${s.name};`)]
    const blob = new Blob(['\uFEFF' + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'hinnete-mall.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }


  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Hinnete sisestamine</h1>
      <p className="text-gray-500 text-sm mb-6">Klass {selectedClass?.name || '—'} · {selectedClass?.subject || '—'}</p>

      <div className="mb-6">
        <button onClick={() => setShowTools(v => !v)} className="text-sm text-[#2a6db0] hover:underline">
          {showTools ? 'Peida import ja eksport' : 'Import ja eksport (CSV, Excel)'}
        </button>
        {showTools && (
          <div className="mt-3 bg-white rounded-xl border border-black/10 p-4 space-y-3">
            <p className="text-sm text-gray-600">
              Import kasutab allpool valitud <strong>teemat</strong> ja <strong>kuupäeva</strong>. Fail vajab veerge <code>nimi</code> ja <code>hinne</code> (või <code>id</code> ja <code>hinne</code>).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="bg-[#1C3556] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#2A4A7A] cursor-pointer">
                {importing ? 'Impordin...' : 'Impordi fail'}
                <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" disabled={importing}
                  onChange={e => { importFile(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              <button onClick={downloadTemplate} className="text-sm border border-gray-300 rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-50">Lae alla mall</button>
              <button onClick={exportGrades} className="text-sm border border-gray-300 rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-50">Ekspordi hinded (CSV)</button>
            </div>
            {toolMsg && <p className="text-sm text-green-700">{toolMsg}</p>}
            {toolErr && <p className="text-sm text-red-700">{toolErr}</p>}
          </div>
        )}
      </div>

      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Lisa uus teema</p>
        <div className="flex gap-3">
          <input type="text" placeholder="Teema nimi (nt Murdarvud)" value={newTopicName}
            onChange={e => setNewTopicName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTopic()}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
          <button onClick={addTopic}
            className="bg-[#1C3556] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#2A4A7A]">Lisa teema</button>
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
          className="bg-[#1C3556] text-white rounded-lg px-6 py-2.5 text-sm hover:bg-[#2A4A7A] disabled:opacity-50">
          {saving ? 'Salvestan...' : 'Salvesta kõik'}
        </button>
        {saved && <span className="text-sm text-[#3B6D11] font-medium">✓ Hinded salvestatud!</span>}
      </div>
    </div>
  )
}
