import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'
import { isStaff } from '../constants/roles'

const DAYS = [
  { n: 1, short: 'E', long: 'Esmaspäev' },
  { n: 2, short: 'T', long: 'Teisipäev' },
  { n: 3, short: 'K', long: 'Kolmapäev' },
  { n: 4, short: 'N', long: 'Neljapäev' },
  { n: 5, short: 'R', long: 'Reede' },
  { n: 6, short: 'L', long: 'Laupäev' },
  { n: 7, short: 'P', long: 'Pühapäev' },
]

const todayIso = () => new Date().toISOString().slice(0, 10)

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

function shiftDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const formatEt = iso => {
  const d = new Date(`${iso}T12:00:00`)
  return `${d.getDate()}.${d.getMonth() + 1}`
}

/** Üks tunniplokk. Muudatused on nähtavad kaardil endal, mitte peidetud. */
function LessonCard({ entry, onDelete, canEdit }) {
  const sub = entry.substitution
  const cancelled = sub?.cancelled
  return (
    <div className={`bg-white rounded-lg border border-black/10 p-2.5 group relative ${
      sub && !cancelled ? 'border-l-[3px] border-l-[#EF9F27]' : ''
    } ${cancelled ? 'border-l-[3px] border-l-[#E24B4A]' : ''}`}>
      <div className={`text-xs font-bold text-gray-900 ${cancelled ? 'line-through text-gray-400' : ''}`}>
        {entry.subject}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">
        {entry.lessonNumber}. tund
        {entry.startTime ? ` · ${entry.startTime}` : ''}
        {entry.room ? ` · ${sub?.newRoom || entry.room}` : ''}
      </div>
      {entry.teacherName && (
        <div className="text-[10px] text-gray-400">
          {sub?.substituteName || entry.teacherName}
        </div>
      )}
      {cancelled && <Badge variant="red" className="mt-1">Ära jäänud</Badge>}
      {sub && !cancelled && <Badge variant="yellow" className="mt-1">Muudetud</Badge>}
      {sub?.note && <p className="text-[10px] text-gray-500 mt-1">{sub.note}</p>}
      {canEdit && (
        <button onClick={() => onDelete(entry.id)}
          title="Kustuta tund"
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-[#A32D2D] text-xs transition-opacity">
          ×
        </button>
      )}
    </div>
  )
}

export default function TimetablePage() {
  const { role } = useAuth()
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const canEdit = isStaff(role)

  const [view, setView] = useState('week')
  const [weekStart, setWeekStart] = useState(mondayOf(todayIso()))
  const [dayIso, setDayIso] = useState(todayIso())
  const [entries, setEntries] = useState([])
  const [exams, setExams] = useState([])
  const [workload, setWorkload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showAddLesson, setShowAddLesson] = useState(false)
  const [lessonForm, setLessonForm] = useState({ subject: '', dayOfWeek: 1, lessonNumber: 1, room: '', startTime: '' })
  const [showAddExam, setShowAddExam] = useState(false)
  const [examForm, setExamForm] = useState({ subject: '', title: '', date: todayIso() })

  /** RULE 3 — ClassContext peab olema laetud enne fetch'i. */
  useEffect(() => {
    if (classesLoading) return
    if (!selectedClassId) { setEntries([]); setExams([]); setWorkload(null); return }
    load()
  }, [classesLoading, selectedClassId, weekStart])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const weekEnd = shiftDays(weekStart, 6)
      const t = await apiCall(`/api/timetable?classId=${selectedClassId}&week=${weekStart}`)
      setEntries(t.entries || [])
      const e = await apiCall(`/api/timetable/exams?classId=${selectedClassId}&from=${weekStart}&to=${weekEnd}`)
      setExams(e.exams || [])
      if (canEdit) {
        const w = await apiCall(`/api/timetable/workload?classId=${selectedClassId}&week=${weekStart}`)
        setWorkload(w)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const addLesson = async () => {
    if (!lessonForm.subject.trim()) { setError('Sisesta aine'); return }
    try {
      await apiCall('/api/timetable', {
        method: 'POST',
        body: JSON.stringify({ classId: Number(selectedClassId), ...lessonForm }),
      })
      setLessonForm({ ...lessonForm, subject: '', room: '' })
      setShowAddLesson(false)
      await load()
    } catch (err) { setError(err.message) }
  }

  const deleteLesson = async (id) => {
    try {
      await apiCall(`/api/timetable/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) { setError(err.message) }
  }

  const addExam = async () => {
    if (!examForm.subject.trim()) { setError('Sisesta aine'); return }
    try {
      await apiCall('/api/timetable/exams', {
        method: 'POST',
        body: JSON.stringify({ classId: Number(selectedClassId), ...examForm }),
      })
      setExamForm({ subject: '', title: '', date: todayIso() })
      setShowAddExam(false)
      await load()
    } catch (err) { setError(err.message) }
  }

  const deleteExam = async (id) => {
    try {
      await apiCall(`/api/timetable/exams/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) { setError(err.message) }
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  const weekEnd = shiftDays(weekStart, 6)
  const hasWeekendLessons = entries.some(e => e.dayOfWeek > 5)
  const visibleDays = DAYS.filter(d => d.n <= 5 || hasWeekendLessons)
  const dayOfWeekForDate = ((new Date(`${dayIso}T12:00:00`).getDay() + 6) % 7) + 1
  const dayEntries = entries
    .filter(e => e.dayOfWeek === dayOfWeekForDate)
    .sort((a, b) => a.lessonNumber - b.lessonNumber)

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-1 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tunniplaan</h1>
          <p className="text-gray-500 text-sm">
            Klass: {selectedClass?.name || '—'} · nädal {formatEt(weekStart)}–{formatEt(weekEnd)}
          </p>
        </div>
        {canEdit && (
          <Link to="/tunniplaan/vanemapaev"
            className="text-sm border border-[#AFA9EC] text-[#534AB7] rounded-lg px-4 py-2 hover:bg-[#EEEDFE] whitespace-nowrap">
            Lapsevanema päev
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 mb-5 flex-wrap">
        {[['week', 'Nädal'], ['day', 'Päev'], ['exams', 'Eksamid']].map(([value, label]) => (
          <button key={value} onClick={() => setView(value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              view === value ? 'bg-[#7F77DD] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}>
            {label}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setWeekStart(shiftDays(weekStart, -7))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">←</button>
          <button onClick={() => { setWeekStart(mondayOf(todayIso())); setDayIso(todayIso()) }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Täna</button>
          <button onClick={() => setWeekStart(shiftDays(weekStart, 7))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">→</button>
        </div>
      </div>

      {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>}

      {workload?.load?.level === 'warning' && (
        <div className="bg-[#FAEEDA] rounded-xl p-5 mb-5">
          <p className="text-sm font-semibold text-[#854F0B] mb-1">⚠️ Õpikoormuse hoiatus</p>
          <p className="text-[13px] text-[#854F0B]/90">{workload.load.message}</p>
          {workload.aiSuggestion && (
            <p className="text-[13px] text-[#854F0B]/90 mt-2 leading-relaxed">{workload.aiSuggestion}</p>
          )}
          {workload.aiFallback && (
            <p className="text-[11px] text-[#854F0B]/70 mt-2">{workload.aiFallback}</p>
          )}
          <p className="text-[11px] text-[#854F0B]/70 mt-2">
            Hoiatus on arvutatud tööde arvust. Soovitus on ettepanek — otsustad sina.
          </p>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 mb-3">Laadin...</p>}

      {view === 'week' && (
        <>
          {canEdit && (
            <div className="mb-4">
              {showAddLesson ? (
                <div className="bg-[#EEEDFE] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs text-gray-500 mb-1">Aine</label>
                    <input value={lessonForm.subject} onChange={e => setLessonForm({ ...lessonForm, subject: e.target.value })}
                      placeholder="Matemaatika"
                      className="w-full border border-[#AFA9EC] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#7F77DD]" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Päev</label>
                    <select value={lessonForm.dayOfWeek} onChange={e => setLessonForm({ ...lessonForm, dayOfWeek: Number(e.target.value) })}
                      className="w-full border border-[#AFA9EC] rounded-lg px-2 py-1.5 text-sm bg-white outline-none">
                      {DAYS.map(d => <option key={d.n} value={d.n}>{d.long}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tund</label>
                    <select value={lessonForm.lessonNumber} onChange={e => setLessonForm({ ...lessonForm, lessonNumber: Number(e.target.value) })}
                      className="w-full border border-[#AFA9EC] rounded-lg px-2 py-1.5 text-sm bg-white outline-none">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}.</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ruum</label>
                    <input value={lessonForm.room} onChange={e => setLessonForm({ ...lessonForm, room: e.target.value })}
                      placeholder="204"
                      className="w-full border border-[#AFA9EC] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#7F77DD]" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addLesson}
                      className="flex-1 bg-[#7F77DD] text-white text-sm rounded-lg px-3 py-1.5 hover:bg-[#534AB7]">Lisa</button>
                    <button onClick={() => setShowAddLesson(false)} className="text-gray-400 text-sm px-2">Tühista</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddLesson(true)}
                  className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
                  + Lisa tund
                </button>
              )}
            </div>
          )}

          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))` }}>
            {visibleDays.map(day => {
              const dayLessons = entries
                .filter(e => e.dayOfWeek === day.n)
                .sort((a, b) => a.lessonNumber - b.lessonNumber)
              return (
                <div key={day.n}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 text-center">
                    {day.short} <span className="text-gray-300">{formatEt(shiftDays(weekStart, day.n - 1))}</span>
                  </p>
                  <div className="space-y-2">
                    {dayLessons.map(entry => (
                      <LessonCard key={entry.id} entry={entry} onDelete={deleteLesson} canEdit={canEdit} />
                    ))}
                    {!dayLessons.length && (
                      <div className="border border-dashed border-gray-200 rounded-lg p-3 text-center text-[11px] text-gray-300">
                        —
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {!entries.length && !loading && (
            <p className="text-sm text-gray-400 mt-6 text-center">
              Tunniplaan on tühi.{canEdit ? ' Lisa esimene tund ülalt.' : ''}
            </p>
          )}
        </>
      )}

      {view === 'day' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <input type="date" value={dayIso} onChange={e => setDayIso(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#7F77DD]" />
            <span className="text-sm text-gray-500">
              {DAYS.find(d => d.n === dayOfWeekForDate)?.long}
            </span>
          </div>
          <div className="space-y-2">
            {dayEntries.map(entry => (
              <div key={entry.id} className="flex gap-3 items-stretch">
                <div className="w-14 flex-shrink-0 text-right pt-2.5">
                  <span className="text-xs text-gray-400">{entry.startTime || `${entry.lessonNumber}.`}</span>
                </div>
                <div className="flex-1"><LessonCard entry={entry} onDelete={deleteLesson} canEdit={canEdit} /></div>
              </div>
            ))}
            {!dayEntries.length && (
              <p className="text-sm text-gray-400">Sel päeval tunde ei ole.</p>
            )}
          </div>
        </div>
      )}

      {view === 'exams' && (
        <div>
          {exams.length >= 3 && (
            <div className="bg-[#FCEBEB] rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-[#A32D2D]">
                Sellel nädalal on {selectedClass?.name} klassil {exams.length} hindelist tööd — kaalu ümberplaneerimist.
              </p>
            </div>
          )}

          {canEdit && (
            <div className="mb-4">
              {showAddExam ? (
                <div className="bg-[#EEEDFE] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Aine</label>
                    <input value={examForm.subject} onChange={e => setExamForm({ ...examForm, subject: e.target.value })}
                      className="w-full border border-[#AFA9EC] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#7F77DD]" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Teema</label>
                    <input value={examForm.title} onChange={e => setExamForm({ ...examForm, title: e.target.value })}
                      placeholder="Murrud"
                      className="w-full border border-[#AFA9EC] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#7F77DD]" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Kuupäev</label>
                    <input type="date" value={examForm.date} onChange={e => setExamForm({ ...examForm, date: e.target.value })}
                      className="w-full border border-[#AFA9EC] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#7F77DD]" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addExam}
                      className="flex-1 bg-[#7F77DD] text-white text-sm rounded-lg px-3 py-1.5 hover:bg-[#534AB7]">Lisa</button>
                    <button onClick={() => setShowAddExam(false)} className="text-gray-400 text-sm px-2">Tühista</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddExam(true)}
                  className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
                  + Lisa kontrolltöö
                </button>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-black/10 overflow-hidden">
            <div className="grid grid-cols-[100px_1fr_1fr_40px] gap-2 px-4 py-2 border-b border-black/5 text-[11px] text-gray-400 uppercase tracking-wider">
              <span>Kuupäev</span><span>Aine</span><span>Teema</span><span></span>
            </div>
            {exams.map(ex => (
              <div key={ex.id} className="grid grid-cols-[100px_1fr_1fr_40px] gap-2 px-4 py-3 border-b border-black/5 last:border-0 items-center">
                <span className="text-sm text-gray-500">{formatEt(ex.date)}</span>
                <span className="text-sm font-medium text-gray-900">{ex.subject}</span>
                <span className="text-sm text-gray-500">{ex.title || '—'}</span>
                {canEdit && (
                  <button onClick={() => deleteExam(ex.id)}
                    className="text-gray-300 hover:text-[#A32D2D] text-sm">×</button>
                )}
              </div>
            ))}
            {!exams.length && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                Sellel nädalal pole hindelisi töid.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
