import { useState, useEffect } from 'react'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'

const todayIso = () => new Date().toISOString().slice(0, 10)
const formatEt = iso => {
  if (!iso) return '—'
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '—' : `${d.getDate()}.${d.getMonth() + 1}.`
}

export default function MentoringPage() {
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()

  const [overview, setOverview] = useState(null)
  const [activeStudent, setActiveStudent] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [goalForm, setGoalForm] = useState({ title: '', detail: '', kind: 'academic', category: '', targetDate: '' })
  const [noteForm, setNoteForm] = useState({ note: '', date: todayIso(), nextMeetingDate: '', isPrivate: true })
  const [suggestion, setSuggestion] = useState(null)
  const [suggesting, setSuggesting] = useState(false)
  const [aiNote, setAiNote] = useState('')

  useEffect(() => {
    if (classesLoading) return
    if (!selectedClassId) { setOverview(null); setActiveStudent(null); return }
    loadOverview()
  }, [classesLoading, selectedClassId])

  useEffect(() => {
    if (!activeStudent) { setDetail(null); return }
    loadDetail(activeStudent.studentId)
  }, [activeStudent?.studentId])

  const loadOverview = async () => {
    setLoading(true)
    setError('')
    try {
      const o = await apiCall(`/api/mentoring/overview/${selectedClassId}`)
      setOverview(o)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (studentId) => {
    try {
      const d = await apiCall(`/api/mentoring/student/${studentId}`)
      setDetail(d)
    } catch (err) { setError(err.message) }
  }

  const addGoal = async () => {
    if (goalForm.title.trim().length < 3) { setError('Sõnasta eesmärk pikemalt'); return }
    setError('')
    try {
      await apiCall('/api/mentoring/goals', {
        method: 'POST',
        body: JSON.stringify({ ...goalForm, studentId: activeStudent.studentId }),
      })
      setGoalForm({ title: '', detail: '', kind: 'academic', category: '', targetDate: '' })
      setSuggestion(null)
      await loadDetail(activeStudent.studentId)
      await loadOverview()
    } catch (err) { setError(err.message) }
  }

  const updateProgress = async (goalId, progress) => {
    try {
      await apiCall(`/api/mentoring/goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ progress }),
      })
      await loadDetail(activeStudent.studentId)
    } catch (err) { setError(err.message) }
  }

  const toggleStatus = async (goal) => {
    try {
      await apiCall(`/api/mentoring/goals/${goal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: goal.status === 'done' ? 'open' : 'done' }),
      })
      await loadDetail(activeStudent.studentId)
      await loadOverview()
    } catch (err) { setError(err.message) }
  }

  const deleteGoal = async (id) => {
    try {
      await apiCall(`/api/mentoring/goals/${id}`, { method: 'DELETE' })
      await loadDetail(activeStudent.studentId)
      await loadOverview()
    } catch (err) { setError(err.message) }
  }

  const addNote = async () => {
    if (!noteForm.note.trim()) { setError('Kirjuta vestluse kokkuvõte'); return }
    setError('')
    try {
      await apiCall('/api/mentoring/notes', {
        method: 'POST',
        body: JSON.stringify({ ...noteForm, studentId: activeStudent.studentId }),
      })
      setNoteForm({ note: '', date: todayIso(), nextMeetingDate: '', isPrivate: true })
      await loadDetail(activeStudent.studentId)
      await loadOverview()
    } catch (err) { setError(err.message) }
  }

  const deleteNote = async (id) => {
    try {
      await apiCall(`/api/mentoring/notes/${id}`, { method: 'DELETE' })
      await loadDetail(activeStudent.studentId)
    } catch (err) { setError(err.message) }
  }

  /** AI ei loo eesmärki — annab sammud, mille sa ise kirjeldusse paned. */
  const askSuggestion = async () => {
    if (goalForm.title.trim().length < 3) { setAiNote('Sõnasta eesmärk enne.'); return }
    setSuggesting(true)
    setAiNote('')
    setSuggestion(null)
    try {
      const r = await apiCall('/api/mentoring/goals/suggest', {
        method: 'POST',
        body: JSON.stringify({ studentId: activeStudent.studentId, title: goalForm.title }),
      })
      if (r.suggestion) setSuggestion(r.suggestion)
      if (r.fallback) setAiNote(r.fallback)
    } catch (err) {
      setAiNote(err.message)
    } finally {
      setSuggesting(false)
    }
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  const students = overview?.students || []
  const needs = overview?.needsCheckIn || []

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Mentorlus</h1>
      <p className="text-gray-500 text-sm mb-5">
        Klass {selectedClass?.name || '—'} · eesmärgid ja vestlused
      </p>

      {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>}

      {needs.length > 0 && (
        <div className="bg-[#FAEEDA] rounded-xl p-5 mb-5">
          <p className="text-sm font-semibold text-[#854F0B] mb-2">
            {needs.length} {needs.length === 1 ? 'õpilane ootab' : 'õpilast ootavad'} vestlust
            <span className="font-normal"> — pole rääkinud {overview.checkInDueDays}+ päeva</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {needs.map(s => (
              <button key={s.studentId} onClick={() => setActiveStudent(s)}
                className="text-xs bg-white border border-[#EF9F27]/40 rounded-lg px-3 py-1.5 text-[#854F0B] hover:bg-[#FAEEDA]">
                {s.studentName}
                <span className="opacity-60">
                  {' · '}{s.lastCheckIn ? `${s.daysSinceCheckIn} p tagasi` : 'pole kunagi'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <div className="space-y-2">
          {loading && <p className="text-sm text-gray-400">Laadin...</p>}
          {!loading && !students.length && (
            <div className="bg-white rounded-xl border border-black/10 p-6 text-center text-sm text-gray-400">
              Selles klassis pole õpilasi.
            </div>
          )}
          {students.map(s => (
            <button key={s.studentId} onClick={() => setActiveStudent(s)}
              className={`w-full text-left bg-white rounded-xl border p-3 transition-colors ${
                activeStudent?.studentId === s.studentId
                  ? 'border-[#AFA9EC] bg-[#EEEDFE]'
                  : 'border-black/10 hover:bg-gray-50'
              }`}>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-gray-900 truncate flex-1">{s.studentName}</span>
                {s.needsCheckIn && <span className="w-2 h-2 rounded-full bg-[#EF9F27]" title="Ootab vestlust" />}
              </div>
              <p className="text-[11px] text-gray-400">
                {s.openGoals} avatud · {s.doneGoals} tehtud · viimati {formatEt(s.lastCheckIn)}
              </p>
            </button>
          ))}
        </div>

        <div>
          {!activeStudent && (
            <div className="bg-white rounded-xl border border-black/10 p-8 text-center text-sm text-gray-400">
              Vali õpilane vasakult.
            </div>
          )}

          {activeStudent && detail && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-black/10 p-5">
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900">{activeStudent.studentName}</h2>
                  <span className="text-xs text-gray-400">
                    Viimane vestlus: {formatEt(detail.lastCheckIn)}
                    {detail.daysSinceCheckIn !== null && ` (${detail.daysSinceCheckIn} p tagasi)`}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-gray-900 mb-2">Eesmärgid</h3>
                {!detail.goals.length && <p className="text-sm text-gray-400 mb-3">Eesmärke pole veel seatud.</p>}
                <div className="space-y-3 mb-4">
                  {detail.goals.map(g => (
                    <div key={g.id} className={`rounded-lg border p-3 ${
                      g.status === 'done' ? 'border-[#639922]/30 bg-[#EAF3DE]/40' : 'border-black/10'
                    }`}>
                      <div className="flex items-start gap-2 mb-1">
                        <button onClick={() => toggleStatus(g)}
                          title={g.status === 'done' ? 'Ava uuesti' : 'Märgi tehtuks'}
                          className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 ${
                            g.status === 'done'
                              ? 'bg-[#639922] border-[#639922] text-white text-[10px] leading-none'
                              : 'border-gray-300 hover:border-[#7F77DD]'
                          }`}>
                          {g.status === 'done' ? '✓' : ''}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            g.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'
                          }`}>
                            {g.title}
                          </p>
                          {g.detail && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{g.detail}</p>}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {g.category && <Badge variant="purple">{g.category}</Badge>}
                            <Badge variant={g.kind === 'personal' ? 'blue' : 'yellow'}>
                              {g.kind === 'personal' ? 'Isiklik' : 'Õppimine'}
                            </Badge>
                            {g.targetDate && (
                              <span className="text-[11px] text-gray-400">tähtaeg {formatEt(g.targetDate)}</span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => deleteGoal(g.id)}
                          className="text-gray-300 hover:text-[#A32D2D] text-sm">×</button>
                      </div>
                      {g.status !== 'done' && (
                        <div className="flex items-center gap-2 mt-2">
                          <input type="range" min="0" max="100" step="10" value={g.progress}
                            onChange={e => updateProgress(g.id, Number(e.target.value))}
                            className="flex-1 accent-[#7F77DD]" />
                          <span className="text-xs text-gray-500 w-10 text-right">{g.progress}%</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-[#f5f5f3] rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Uus eesmärk</p>
                  <input value={goalForm.title} onChange={e => setGoalForm({ ...goalForm, title: e.target.value })}
                    placeholder="Nt: Esitan kodutööd õigeks ajaks"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] mb-2 bg-white" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    <select value={goalForm.category} onChange={e => setGoalForm({ ...goalForm, category: e.target.value })}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none">
                      <option value="">Kategooria…</option>
                      {(detail.goalCategories || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={goalForm.kind} onChange={e => setGoalForm({ ...goalForm, kind: e.target.value })}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none">
                      <option value="academic">Õppimine</option>
                      <option value="personal">Isiklik</option>
                    </select>
                    <input type="date" value={goalForm.targetDate}
                      onChange={e => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none" />
                  </div>
                  <textarea value={goalForm.detail} onChange={e => setGoalForm({ ...goalForm, detail: e.target.value })}
                    rows={2} placeholder="Vahesammud (valikuline)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] resize-y bg-white" />

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <button onClick={addGoal}
                      className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
                      Lisa eesmärk
                    </button>
                    <button onClick={askSuggestion} disabled={suggesting}
                      className="text-xs border border-gray-200 rounded-full px-3 py-1.5 text-gray-500 hover:bg-[#EEEDFE] hover:text-[#534AB7] disabled:opacity-40">
                      {suggesting ? 'mõtlen...' : 'AI: paku vahesammud'}
                    </button>
                  </div>
                  {aiNote && <p className="text-[11px] text-gray-400 mt-2">{aiNote}</p>}
                  {suggestion && (
                    <div className="bg-[#EEEDFE] rounded-lg p-3 mt-2">
                      <p className="text-[11px] text-[#534AB7] font-medium mb-1">
                        AI ettepanek — sina otsustad, mis eesmärgi juurde jõuab
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestion}</p>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => { setGoalForm({ ...goalForm, detail: suggestion }); setSuggestion(null) }}
                          className="text-xs bg-[#7F77DD] text-white rounded-lg px-3 py-1.5 hover:bg-[#534AB7]">
                          Pane kirjeldusse
                        </button>
                        <button onClick={() => setSuggestion(null)} className="text-xs text-gray-500 px-2">Sulge</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-black/10 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Vestluse märkmed</h3>
                <p className="text-xs text-gray-400 mb-3">
                  Vaikimisi näevad neid ainult koolitöötajad. Kui laps usaldab vestluses midagi
                  isiklikku, ei tohi see kogemata koju minna.
                </p>

                <textarea value={noteForm.note} onChange={e => setNoteForm({ ...noteForm, note: e.target.value })}
                  rows={3} placeholder="Millest rääkisite? Milles kokku leppisite?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] resize-y mb-2" />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Vestluse kuupäev</label>
                    <input type="date" value={noteForm.date} onChange={e => setNoteForm({ ...noteForm, date: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Järgmine kohtumine</label>
                    <input type="date" value={noteForm.nextMeetingDate}
                      onChange={e => setNoteForm({ ...noteForm, nextMeetingDate: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={addNote}
                    className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
                    Salvesta märge
                  </button>
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={!noteForm.isPrivate}
                      onChange={e => setNoteForm({ ...noteForm, isPrivate: !e.target.checked })}
                      className="rounded border-gray-300" />
                    Jaga ka lapsevanemaga
                  </label>
                </div>

                <div className="space-y-2 mt-4">
                  {!detail.notes.length && <p className="text-sm text-gray-400">Märkmeid pole veel.</p>}
                  {detail.notes.map(n => (
                    <div key={n.id} className="border border-black/10 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[11px] text-gray-500">{formatEt(n.date)}</span>
                        {n.isPrivate
                          ? <Badge variant="yellow">Ainult koolile</Badge>
                          : <Badge variant="green">Jagatud koduga</Badge>}
                        {n.nextMeetingDate && (
                          <span className="text-[11px] text-[#534AB7]">
                            järgmine {formatEt(n.nextMeetingDate)}
                          </span>
                        )}
                        <button onClick={() => deleteNote(n.id)}
                          className="text-gray-300 hover:text-[#A32D2D] text-sm ml-auto">×</button>
                      </div>
                      <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{n.note}</p>
                      {n.mentorName && <p className="text-[11px] text-gray-400 mt-1">{n.mentorName}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
