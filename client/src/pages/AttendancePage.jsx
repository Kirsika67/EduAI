import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'

const todayIso = () => new Date().toISOString().slice(0, 10)

const STATUSES = [
  { value: 'present', label: 'Kohal', row: '', btn: 'bg-[#EAF3DE] border-[#639922] text-[#3B6D11]' },
  { value: 'late', label: 'Hilines', row: 'bg-[#FAEEDA]/60', btn: 'bg-[#FAEEDA] border-[#EF9F27] text-[#854F0B]' },
  { value: 'absent', label: 'Puudub', row: 'bg-[#FCEBEB]/60', btn: 'bg-[#FCEBEB] border-[#E24B4A] text-[#A32D2D]' },
  { value: 'excused', label: 'Vabastatud', row: 'bg-[#E5F5F3]/60', btn: 'bg-[#E5F5F3] border-[#2E9C8E] text-[#1B6156]' },
]

const KINDS = [
  { value: 'positive', label: 'Positiivne', variant: 'green' },
  { value: 'concern', label: 'Muremärkus', variant: 'yellow' },
  { value: 'incident', label: 'Juhtum', variant: 'red' },
]

const formatEt = iso => {
  const d = new Date(`${iso}T12:00:00`)
  return `${d.getDate()}.${d.getMonth() + 1}.`
}

export default function AttendancePage() {
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayIso())
  const [lessonNumber, setLessonNumber] = useState(0)
  const [board, setBoard] = useState(null)
  const [notes, setNotes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({ studentId: '', kind: 'positive', category: '', note: '', isPrivate: false })
  const [reasonFor, setReasonFor] = useState({})

  /** RULE 3 — ClassContext peab olema laetud enne fetch'i. */
  useEffect(() => {
    if (classesLoading) return
    if (!selectedClassId) { setBoard(null); setNotes([]); return }
    load()
  }, [classesLoading, selectedClassId, date, lessonNumber])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const b = await apiCall(`/api/attendance/board/${selectedClassId}?date=${date}&lessonNumber=${lessonNumber}`)
      setBoard(b)
      setCategories(b.behaviorCategories || [])
      const reasons = {}
      for (const row of b.students || []) {
        if (row.today?.reason) reasons[row.studentId] = row.today.reason
      }
      setReasonFor(reasons)
      const n = await apiCall(`/api/attendance/behavior/class/${selectedClassId}`)
      setNotes(n.notes || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const mark = async (studentId, status) => {
    setSaving(`${studentId}`)
    setError('')
    try {
      await apiCall(`/api/classes/${selectedClassId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({
          date,
          lessonNumber,
          entries: [{ studentId, status, reason: reasonFor[studentId] || undefined }],
        }),
      })
      const b = await apiCall(`/api/attendance/board/${selectedClassId}?date=${date}&lessonNumber=${lessonNumber}`)
      setBoard(b)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving('')
    }
  }

  const addNote = async () => {
    if (!form.studentId) { setError('Vali õpilane'); return }
    if (!form.note.trim()) { setError('Kirjelda, mis juhtus'); return }
    setError('')
    try {
      await apiCall('/api/attendance/behavior', {
        method: 'POST',
        body: JSON.stringify({ ...form, studentId: Number(form.studentId), date }),
      })
      setForm({ studentId: '', kind: 'positive', category: '', note: '', isPrivate: false })
      await load()
    } catch (err) { setError(err.message) }
  }

  const deleteNote = async (id) => {
    try {
      await apiCall(`/api/attendance/behavior/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) { setError(err.message) }
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  const students = board?.students || []

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Kohalolek ja käitumine</h1>
      <p className="text-gray-500 text-sm mb-5">
        Klass {selectedClass?.name || '—'} · {formatEt(date)}
        {lessonNumber > 0 ? ` · ${lessonNumber}. tund` : ' · terve päev'}
      </p>

      {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>}

      {board?.chronic?.length > 0 && (
        <div className="bg-[#FCEBEB] rounded-xl p-5 mb-5">
          <p className="text-sm font-semibold text-[#A32D2D] mb-2">
            🔴 {board.chronic.length} {board.chronic.length === 1 ? 'õpilane on' : 'õpilast on'} viimase 30 päeva
            jooksul puudunud {board.chronicThresholdPercent}%+ tundidest
          </p>
          <div className="flex flex-wrap gap-2">
            {board.chronic.map(c => (
              <button key={c.studentId} onClick={() => navigate(`/opilased/${c.studentId}`)}
                className="text-xs bg-white border border-[#E24B4A]/30 rounded-lg px-3 py-1.5 text-[#A32D2D] hover:bg-[#FCEBEB]">
                {c.studentName} · {c.absencePercent}%
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/10 overflow-hidden mb-6">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/5 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Kohaloleku sisestus</h2>
            <p className="text-xs text-gray-400">Märgi kohe — läheb ABC-riski ja kohaloleku protsenti sisse.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={lessonNumber} onChange={e => setLessonNumber(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:border-[#7F77DD]">
              <option value={0}>Terve päev</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}. tund</option>
              ))}
            </select>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#7F77DD]" />
          </div>
        </div>

        {loading && <p className="px-4 py-6 text-sm text-gray-400">Laadin...</p>}
        {!loading && !students.length && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">Selles klassis pole õpilasi.</p>
        )}

        {students.map(row => {
          const status = row.today?.status
          const meta = STATUSES.find(s => s.value === status)
          const needsReason = status === 'absent' || status === 'late' || status === 'excused'
          return (
            <div key={row.studentId}
              className={`px-4 py-2.5 border-b border-black/5 last:border-0 ${meta?.row || ''}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => navigate(`/opilased/${row.studentId}`)}
                  className="text-sm text-gray-800 w-44 truncate text-left hover:text-[#534AB7]">
                  {row.studentName}
                </button>
                <div className="flex gap-1 flex-wrap">
                  {STATUSES.map(s => (
                    <button key={s.value} disabled={saving === String(row.studentId)}
                      onClick={() => mark(row.studentId, s.value)}
                      className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                        status === s.value ? s.btn : 'border-gray-200 text-gray-500 hover:bg-gray-50 bg-white'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-gray-400 ml-auto whitespace-nowrap">
                  {row.summary.attendedPercent === null
                    ? 'andmeid pole'
                    : `kohal ${row.summary.attendedPercent}% (30 p)`}
                </span>
              </div>
              {needsReason && (
                <input
                  value={reasonFor[row.studentId] || ''}
                  onChange={e => setReasonFor({ ...reasonFor, [row.studentId]: e.target.value })}
                  onBlur={() => status && mark(row.studentId, status)}
                  placeholder="Põhjus (nt haigus, arsti juures)"
                  className="mt-2 ml-0 sm:ml-[188px] w-full sm:w-80 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#7F77DD] bg-white"
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-black/10 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Lisa käitumismärkus</h2>
        <p className="text-xs text-gray-400 mb-3">
          Märkust ei näe kunagi klassikaaslased. Vaikimisi näeb seda ka lapsevanem ja laps ise.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <select value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-[#7F77DD]">
            <option value="">Vali õpilane…</option>
            {students.map(s => <option key={s.studentId} value={s.studentId}>{s.studentName}</option>)}
          </select>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-[#7F77DD]">
            <option value="">Kategooria (valikuline)</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-1">
            {KINDS.map(k => (
              <button key={k.value} onClick={() => setForm({ ...form, kind: k.value })}
                className={`flex-1 text-xs rounded-lg px-2 py-2 border transition-colors ${
                  form.kind === k.value
                    ? 'bg-[#EEEDFE] border-[#AFA9EC] text-[#534AB7] font-medium'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
          rows={2} placeholder="Mis juhtus? Ole konkreetne — seda loeb hiljem ka teine õpetaja."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] resize-y" />
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <button onClick={addNote}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
            Salvesta märkus
          </button>
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={form.isPrivate}
              onChange={e => setForm({ ...form, isPrivate: e.target.checked })}
              className="rounded border-gray-300" />
            Ainult õpetajatele (vanem ei näe)
          </label>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-900 mb-3">Klassi käitumismärkused</h2>
      {!notes.length && (
        <div className="bg-white rounded-xl border border-black/10 p-8 text-center text-sm text-gray-400">
          Märkusi pole veel lisatud.
        </div>
      )}
      <div className="space-y-2">
        {notes.map(n => (
          <div key={n.id}
            className={`bg-white rounded-xl border border-black/10 p-4 border-l-[3px] ${
              n.sentiment === 'positive' ? 'border-l-[#639922]' : 'border-l-[#E24B4A]'
            }`}>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <button onClick={() => navigate(`/opilased/${n.studentId}`)}
                className="text-[13px] font-bold text-gray-900 hover:text-[#534AB7]">
                {n.studentName}
              </button>
              <Badge variant={KINDS.find(k => k.value === n.kind)?.variant || 'blue'}>
                {KINDS.find(k => k.value === n.kind)?.label || n.kind}
              </Badge>
              {n.category && <Badge variant="purple">{n.category}</Badge>}
              <span className="text-[11px] text-gray-400 ml-auto">{formatEt(n.date)}</span>
              <button onClick={() => deleteNote(n.id)}
                className="text-gray-300 hover:text-[#A32D2D] text-sm">×</button>
            </div>
            <p className="text-[13px] text-gray-600">{n.note}</p>
            {n.teacherName && <p className="text-[11px] text-gray-400 mt-1">{n.teacherName}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
