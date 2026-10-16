import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { isStaff, isLeadership } from '../constants/roles'

const WEEKDAYS = ['pühapäev', 'esmaspäev', 'teisipäev', 'kolmapäev', 'neljapäev', 'reede', 'laupäev']
const isoDate = (d) => d.toISOString().slice(0, 10)

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00`)
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function Panel({ title, action, children }) {
  return (
    <section className="bg-white rounded-lg border border-black/10 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function PaevikPage() {
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const [lessons, setLessons] = useState([])
  const { role } = useAuth()
  const staff = isStaff(role)
  const [exams, setExams] = useState([])
  const [assignments, setAssignments] = useState([])
  const [subsToday, setSubsToday] = useState([])
  const [absences, setAbsences] = useState([])
  const [showAbsence, setShowAbsence] = useState(false)
  const [absenceForm, setAbsenceForm] = useState({ dateFrom: '', dateTo: '', note: '', teacherId: '' })
  const [schoolTeachers, setSchoolTeachers] = useState([])
  const [recentGrades, setRecentGrades] = useState([])
  const [recentNotes, setRecentNotes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ subject: '', title: '', description: '', kind: 'homework', dueDate: '' })
  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem('eduai_done_assignments') || '[]') } catch { return [] }
  })
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const today = new Date()
  const todayIso = isoDate(today)
  const dayNumber = ((today.getDay() + 6) % 7) + 1

  useEffect(() => {
    if (classesLoading) return
    load()
  }, [classesLoading, selectedClassId])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      if (selectedClassId) {
        const t = await apiCall(`/api/timetable?classId=${selectedClassId}&week=${todayIso}`)
        const todays = (t.entries || [])
          .filter(e => Number(e.dayOfWeek) === dayNumber)
          .sort((a, b) => Number(a.lessonNumber) - Number(b.lessonNumber))
        setLessons(todays.map(e => ({
          ...e,
          substitution: e.substitution && e.substitution.date === todayIso ? e.substitution : null,
        })))
        const from = todayIso
        const to = isoDate(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000))
        const ex = await apiCall(`/api/timetable/exams?classId=${selectedClassId}&from=${from}&to=${to}`)
        setExams(ex.exams || [])
        const as = await apiCall(`/api/assignments?classId=${selectedClassId}&from=${from}&to=${to}`)
        setAssignments(as.assignments || [])
        if (staff) {
          const sb = await apiCall('/api/timetable/substitutions/today')
          setSubsToday(sb.substitutions || [])
          const g = await apiCall(`/api/classes/${selectedClassId}/grades`)
          setRecentGrades((g.grades || []).slice(0, 6))
          const b = await apiCall(`/api/attendance/behavior/class/${selectedClassId}`)
          setRecentNotes((b.notes || []).slice(0, 6))
        }
      } else {
        setRecentGrades([])
        setRecentNotes([])
        setSubsToday([])
        setLessons([])
        setExams([])
        setAssignments([])
      }
      if (staff) {
        const ab = await apiCall('/api/absences')
        setAbsences(ab.absences || [])
        if (isLeadership(role)) {
          const tl = await apiCall('/api/absences/teachers')
          setSchoolTeachers(tl.teachers || [])
        }
      }
      const m = await apiCall('/api/messages')
      setConversations(m.conversations || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleDone = (id) => {
    const next = done.includes(Number(id)) ? done.filter(x => x !== Number(id)) : [...done, Number(id)]
    setDone(next)
    try { localStorage.setItem('eduai_done_assignments', JSON.stringify(next)) } catch { /* ei ole kriitiline */ }
  }

  const addAssignment = async () => {
    if (!form.subject.trim() || !form.title.trim() || !form.dueDate) {
      setError('Täida aine, pealkiri ja tähtaeg.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiCall('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({ ...form, classId: selectedClassId }),
      })
      setForm({ subject: '', title: '', description: '', kind: 'homework', dueDate: '' })
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const addAbsence = async () => {
    if (!absenceForm.dateFrom) { setError('Vali puudumise algus.'); return }
    setError('')
    try {
      await apiCall('/api/absences', { method: 'POST', body: JSON.stringify(absenceForm) })
      setAbsenceForm({ dateFrom: '', dateTo: '', note: '', teacherId: '' })
      setShowAbsence(false)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const removeAbsence = async (id) => {
    try {
      await apiCall(`/api/absences/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const removeAssignment = async (id) => {
    try {
      await apiCall(`/api/assignments/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (classesLoading) return <div>Laadin...</div>

  const unread = conversations.reduce((sum, c) => sum + Number(c.unread || 0), 0)

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Päevik</h1>
      <p className="text-gray-500 text-sm mb-5">
        {formatDate(todayIso)}{selectedClass ? ` · ${selectedClass.name} · ${selectedClass.subject}` : ''}
      </p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      {unread > 0 && (
        <Link to="/sonumid" className="block bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 mb-4 text-sm hover:bg-amber-100">
          Sul on {unread} lugemata sõnumit. Ava Suhtlus →
        </Link>
      )}

      {!selectedClass && (
        <div className="bg-white rounded-lg border border-black/10 p-5 mb-4 text-sm text-gray-600">
          Klass pole valitud. Vali klass paremalt ülevalt või lisa uus.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Täna" action={<Link to="/tunniplaan" className="text-sm text-[#2a6db0] hover:underline">Tunniplaan →</Link>}>
          {loading && <p className="text-sm text-gray-400">Laadin...</p>}
          {!loading && lessons.length === 0 && <p className="text-sm text-gray-500">Täna tunde pole.</p>}
          <ul className="divide-y divide-gray-100">
            {lessons.map(l => (
              <li key={l.id} className="py-2.5 flex items-start gap-3">
                <span className="w-7 h-7 rounded bg-[#1c3556] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{l.lessonNumber}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${l.substitution?.cancelled ? 'line-through text-gray-400' : 'text-gray-900'}`}>{l.subject}</p>
                  <p className="text-xs text-gray-500">
                    {[l.startTime && `${l.startTime}${l.endTime ? `–${l.endTime}` : ''}`, l.room && `ruum ${l.room}`, l.teacherName].filter(Boolean).join(' · ')}
                  </p>
                  {l.substitution && (
                    <p className="text-xs text-red-600 mt-0.5">
                      {l.substitution.cancelled ? 'Tund jääb ära' : `Asendab ${l.substitution.substituteName || 'asendusõpetaja'}`}
                      {l.substitution.newRoom ? ` · uus ruum ${l.substitution.newRoom}` : ''}
                      {l.substitution.note ? ` · ${l.substitution.note}` : ''}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {staff && (
          <Panel
            title="Õpetajate puudumised ja asendused"
            action={<button onClick={() => setShowAbsence(v => !v)} className="text-sm text-[#2a6db0] hover:underline">{showAbsence ? 'Sulge' : isLeadership(role) ? '+ Lisa puudumine' : '+ Teata oma puudumisest'}</button>}
          >
            {showAbsence && (
              <div className="mb-4 p-3 border border-[#9ab7e0] rounded-lg bg-[#f4f8fd] space-y-2">
                {isLeadership(role) && (
                  <select value={absenceForm.teacherId} onChange={e => setAbsenceForm({ ...absenceForm, teacherId: e.target.value })}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm">
                    <option value="">Mina ise</option>
                    {schoolTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-500">Algus
                    <input type="date" value={absenceForm.dateFrom} onChange={e => setAbsenceForm({ ...absenceForm, dateFrom: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                  </label>
                  <label className="text-xs text-gray-500">Lõpp (kui erineb)
                    <input type="date" value={absenceForm.dateTo} onChange={e => setAbsenceForm({ ...absenceForm, dateTo: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                  </label>
                </div>
                <input placeholder="Märkus (valikuline)" value={absenceForm.note} onChange={e => setAbsenceForm({ ...absenceForm, note: e.target.value })}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                <button onClick={addAbsence} className="bg-[#1c3556] text-white text-sm rounded px-4 py-1.5 hover:bg-[#2a4a7a]">Salvesta</button>
              </div>
            )}
            {absences.map(a => (
              <p key={a.id} className="text-sm text-gray-900 py-1.5 border-b border-gray-100">
                <span className="font-medium">{a.teacherName}</span> puudub
                {a.dateTo !== a.dateFrom ? ` ${a.dateFrom.slice(8, 10)}.${a.dateFrom.slice(5, 7)}.–${a.dateTo.slice(8, 10)}.${a.dateTo.slice(5, 7)}.` : ' täna'}
                {a.note ? <span className="text-gray-500"> · {a.note}</span> : null}
                {a.isMine && <button onClick={() => removeAbsence(a.id)} className="ml-3 text-xs text-gray-400 hover:text-red-600">Kustuta</button>}
              </p>
            ))}
            {!loading && absences.length === 0 && subsToday.length === 0 && <p className="text-sm text-gray-500">Täna puudumisi, asendusi ega ärajäämisi pole.</p>}
            <ul className="divide-y divide-gray-100">
              {subsToday.map(x => (
                <li key={x.id} className="py-2.5">
                  <p className="text-sm font-medium text-gray-900">{x.subject}, {x.lessonNumber}. tund · {x.className}</p>
                  <p className="text-xs text-red-600">
                    {x.cancelled
                      ? 'Tund jääb ära'
                      : `${x.teacherName ? `puudub ${x.teacherName} → ` : ''}asendab ${x.substituteName || 'asendusõpetaja'}`}
                    {x.newRoom ? ` · uus ruum ${x.newRoom}` : ''}{x.note ? ` · ${x.note}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel
          title="Ülesanded, kodutööd ja kontrolltööd"
          action={staff && selectedClass && (
            <button onClick={() => setShowForm(v => !v)} className="text-sm text-[#2a6db0] hover:underline">
              {showForm ? 'Sulge' : '+ Lisa ülesanne'}
            </button>
          )}
        >
          {showForm && (
            <div className="mb-4 p-3 border border-[#9ab7e0] rounded-lg bg-[#f4f8fd] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Aine" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                  className="border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-[#2a6db0]" />
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  className="border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-[#2a6db0]" />
              </div>
              <input placeholder="Pealkiri" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-[#2a6db0]" />
              <textarea placeholder="Kirjeldus (valikuline)" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-[#2a6db0] resize-none" />
              <div className="flex items-center gap-3">
                <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}
                  className="border border-gray-200 rounded px-2 py-1.5 text-sm">
                  <option value="homework">Kodutöö</option>
                  <option value="task">Ülesanne</option>
                </select>
                <button onClick={addAssignment} disabled={saving}
                  className="bg-[#1c3556] text-white text-sm rounded px-4 py-1.5 hover:bg-[#2a4a7a] disabled:opacity-50">
                  {saving ? 'Salvestan...' : 'Salvesta'}
                </button>
              </div>
            </div>
          )}
          {!loading && assignments.length === 0 && exams.length === 0 && (
            <p className="text-sm text-gray-500">Järgmise 14 päeva jooksul ülesandeid ega kontrolltöid pole.</p>
          )}
          <ul className="divide-y divide-gray-100">
            {[...assignments.map(a => ({ ...a, type: 'assignment', date: a.dueDate })),
              ...exams.map(e => ({ ...e, type: 'exam', date: String(e.date).slice(0, 10) }))]
              .sort((a, b) => String(a.date).localeCompare(String(b.date)))
              .map(item => item.type === 'exam' ? (
                <li key={`e${item.id}`} className="py-2.5">
                  <p className="text-sm font-medium text-gray-900">
                    <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 rounded px-1.5 py-0.5 mr-2">Kontrolltöö</span>
                    {item.title || item.subject}
                  </p>
                  <p className="text-xs text-gray-500">{item.subject} · {formatDate(item.date)}</p>
                </li>
              ) : (
                <li key={`a${item.id}`} className="py-2.5 flex items-start gap-3">
                  <input type="checkbox" checked={done.includes(Number(item.id))} onChange={() => toggleDone(item.id)} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${done.includes(Number(item.id)) ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 mr-2">
                        {item.kind === 'task' ? 'Ülesanne' : 'Kodutöö'}
                      </span>
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500">{item.subject} · tähtaeg {formatDate(item.date)}</p>
                    {item.description && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{item.description}</p>}
                  </div>
                  {staff && (
                    <button onClick={() => removeAssignment(item.id)} className="text-xs text-gray-400 hover:text-red-600">Kustuta</button>
                  )}
                </li>
              ))}
          </ul>
        </Panel>

        {staff && selectedClass && (
          <Panel title="Viimati lisatud hinded ja märked" action={<Link to="/hinded" className="text-sm text-[#2a6db0] hover:underline">Hinded →</Link>}>
            {!loading && recentGrades.length === 0 && recentNotes.length === 0 && (
              <p className="text-sm text-gray-500">Hindeid ega märkeid pole veel lisatud.</p>
            )}
            <ul className="divide-y divide-gray-100">
              {recentGrades.map(g => (
                <li key={`g${g.id}`} className="py-2.5 flex items-start gap-3">
                  <span className="min-w-[2.5rem] text-center text-sm font-bold bg-[#eef3fa] text-[#1c3556] rounded px-2 py-1">{g.score}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{g.student_name}</p>
                    <p className="text-xs text-gray-500">{g.topic_name} · {String(g.date).slice(0, 10)}{g.notes ? ` · ${g.notes}` : ''}</p>
                  </div>
                </li>
              ))}
              {recentNotes.map(n => (
                <li key={`n${n.id}`} className="py-2.5">
                  <p className="text-sm font-medium text-gray-900">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${n.sentiment === 'positive' ? 'bg-green-500' : n.sentiment === 'negative' ? 'bg-red-500' : 'bg-gray-400'}`} />
                    {n.studentName}{n.isPrivate ? ' (privaatne)' : ''}
                  </p>
                  <p className="text-xs text-gray-500">{n.category ? `${n.category} · ` : ''}{String(n.date).slice(0, 10)}{n.note ? ` · ${n.note}` : ''}</p>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="Viimased sõnumid" action={<Link to="/sonumid" className="text-sm text-[#2a6db0] hover:underline">Suhtlus →</Link>}>
          {!loading && conversations.length === 0 && <p className="text-sm text-gray-500">Sõnumeid pole.</p>}
          <ul className="divide-y divide-gray-100">
            {conversations.slice(0, 4).map(c => (
              <li key={c.id} className="py-2.5">
                <p className="text-sm font-medium text-gray-900">
                  {Number(c.unread) > 0 && <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-2" />}
                  {c.subject || 'Vestlus'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {c.participants?.map(p => p.name).join(', ')}{c.lastBody ? ` — ${c.lastBody}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="AI-abiline">
          <ul className="space-y-2 text-sm">
            <li><Link to="/ulevaade" className="text-[#2a6db0] hover:underline">Klassi AI-ülevaade ja hoiatused</Link></li>
            <li><Link to="/materjalid" className="text-[#2a6db0] hover:underline">Loo töölehti, teste ja tunnikavasid</Link></li>
            <li><Link to="/planeerimine" className="text-[#2a6db0] hover:underline">Planeeri nädal</Link></li>
            <li><Link to="/esseede-hindamine" className="text-[#2a6db0] hover:underline">Hinda esseesid (eesti, inglise, vene)</Link></li>
            <li><Link to="/tagasiside" className="text-[#2a6db0] hover:underline">Kirjuta õpilasele tagasisidet</Link></li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}
