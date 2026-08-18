import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiCall } from '../api/client'
import { useClasses } from '../context/ClassContext'
import Badge from '../components/Badge'

const attLabels = { present: 'Kohal', late: 'Hilines', absent: 'Puudus' }
const behLabels = { positive: 'Tunnustus', concern: 'Mure', incident: 'Juhtum' }
const moodLabels = { good: 'Hea', ok: 'Keskmine', hard: 'Raske' }
const kindLabels = { academic: 'Akadeemiline', personal: 'Isiklik' }
const compLabels = { ok: 'korras', high: 'kõrge', medium: 'keskmine', improving: 'tõus' }

function Section({ title, hint, children }) {
  return (
    <div className="bg-white rounded-xl border border-black/10 p-5 mb-6">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {hint && <p className="text-xs text-gray-400 mt-0.5 mb-3">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  )
}

export default function StudentDetailPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const [student, setStudent] = useState(null)
  const [grades, setGrades] = useState([])
  const [abc, setAbc] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [behavior, setBehavior] = useState([])
  const [wellbeing, setWellbeing] = useState([])
  const [goals, setGoals] = useState([])
  const [mentorNotes, setMentorNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [parentLetter, setParentLetter] = useState('')
  const [smsVersion, setSmsVersion] = useState('')

  const [attStatus, setAttStatus] = useState('present')
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10))
  const [behKind, setBehKind] = useState('positive')
  const [behNote, setBehNote] = useState('')
  const [mood, setMood] = useState('ok')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalKind, setGoalKind] = useState('academic')
  const [mentorText, setMentorText] = useState('')

  useEffect(() => {
    if (classesLoading) return
    if (!selectedClassId) return
    loadStudent()
  }, [classesLoading, selectedClassId, studentId])

  const loadStudent = async () => {
    setLoading(true)
    try {
      const s = await apiCall(`/api/classes/${selectedClassId}/students/${studentId}/detail`)
      setStudent(s.student)
      setGrades(s.grades || [])
      setAbc(s.abc || null)
      setAttendance(s.attendance || [])
      setBehavior(s.behavior || [])
      setWellbeing(s.wellbeing || [])
      setGoals(s.goals || [])
      setMentorNotes(s.mentorNotes || [])
      if (s.lastAnalysis) {
        setAiAnalysis(s.lastAnalysis)
        setParentLetter(s.lastAnalysis.parentEmail || '')
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const runAI = async () => {
    if (!selectedClassId) return
    setAiLoading(true)
    try {
      const data = await apiCall(`/api/classes/${selectedClassId}/students/${studentId}/ai-analysis`, {
        method: 'POST',
      })
      setAiAnalysis(data.analysis || null)
      setParentLetter(data.analysis?.parentEmail || '')
    } catch (err) { console.error(err); alert('AI analüüs ebaõnnestus.') }
    finally { setAiLoading(false) }
  }

  const path = `/api/classes/${selectedClassId}/students/${studentId}`

  const addAttendance = async () => {
    try {
      await apiCall(`${path}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ date: attDate, status: attStatus }),
      })
      await loadStudent()
    } catch (err) { alert(err.message) }
  }

  const addBehavior = async () => {
    if (!behNote.trim()) return
    try {
      await apiCall(`${path}/behavior`, {
        method: 'POST',
        body: JSON.stringify({ kind: behKind, note: behNote.trim() }),
      })
      setBehNote('')
      await loadStudent()
    } catch (err) { alert(err.message) }
  }

  const addWellbeing = async () => {
    try {
      await apiCall(`${path}/wellbeing`, {
        method: 'POST',
        body: JSON.stringify({ mood }),
      })
      await loadStudent()
    } catch (err) { alert(err.message) }
  }

  const addGoal = async () => {
    if (!goalTitle.trim()) return
    try {
      await apiCall(`${path}/goals`, {
        method: 'POST',
        body: JSON.stringify({ title: goalTitle.trim(), kind: goalKind }),
      })
      setGoalTitle('')
      await loadStudent()
    } catch (err) { alert(err.message) }
  }

  const toggleGoal = async (goal) => {
    try {
      await apiCall(`${path}/goals/${goal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: goal.status === 'open' ? 'done' : 'open' }),
      })
      await loadStudent()
    } catch (err) { alert(err.message) }
  }

  const addMentorNote = async () => {
    if (!mentorText.trim()) return
    try {
      await apiCall(`${path}/mentor-notes`, {
        method: 'POST',
        body: JSON.stringify({ note: mentorText.trim() }),
      })
      setMentorText('')
      await loadStudent()
    } catch (err) { alert(err.message) }
  }

  if (classesLoading || loading) return <div className="p-8 text-gray-500">Laadin...</div>
  if (!student) return <div className="p-8 text-gray-500">Õpilast ei leitud.</div>

  const status = abc?.level || 'blue'
  const topicMap = {}
  grades.forEach(g => {
    const topicName = g.topicName || g.topic_name || g.topic || 'Teema'
    if (!topicMap[topicName] || new Date(g.date) > new Date(topicMap[topicName].date)) topicMap[topicName] = { ...g, topicName }
  })
  const topics = Object.values(topicMap)

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate('/opilased')}
        className="text-sm text-[#7F77DD] hover:underline mb-6 block">
        ← Tagasi õpilaste nimekirja
      </button>

      <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
      <p className="text-gray-500 text-sm mt-0.5">{selectedClass?.name} · {selectedClass?.subject}</p>
      <div className="mt-2 mb-4"><Badge variant={status}>{abc?.label || 'Hea tase'}</Badge></div>

      {abc && (
        <div className="bg-white rounded-xl border border-black/10 p-5 mb-8">
          <p className="text-sm font-semibold text-gray-900 mb-1">ABC-risk (läbipaistev)</p>
          <p className="text-xs text-gray-400 mb-3">
            Õpetaja otsustab alati — skoor on soovitus, mitte must kast.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              ['Kohalolek', abc.components?.attendance],
              ['Käitumine', abc.components?.behavior],
              ['Kursus', abc.components?.course],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] text-gray-400">{label}</p>
                <p className="text-sm font-semibold text-gray-800">{compLabels[value] || value || '—'}</p>
              </div>
            ))}
          </div>
          {abc.reasons?.length
            ? <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                {abc.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            : <p className="text-sm text-gray-400">Hetkel pole hoiatuse põhjuseid.</p>}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Hinded teemade kaupa</h2>
        {!topics.length && <p className="text-sm text-gray-400">Hindeid pole veel sisestatud.</p>}
        <div className="grid grid-cols-2 gap-3">
          {topics.map((g, i) => (
            <div key={i} className="bg-white rounded-xl border border-black/10 p-4">
              <p className="text-sm font-bold text-gray-900 mb-1">{g.topicName}</p>
              <p className={`text-3xl font-bold mb-1 ${
                Number(g.score) < 50 ? 'text-[#E24B4A]' : Number(g.score) < 70 ? 'text-[#EF9F27]' : 'text-[#639922]'
              }`}>{g.score}%</p>
              <p className="text-xs text-gray-400">{new Date(g.date).toLocaleDateString('et-EE')}</p>
            </div>
          ))}
        </div>
      </div>

      <Section title="Kohalolek" hint="Puudumised ja hilinemised mõjutavad ABC-riski.">
        <div className="flex gap-2 mb-4">
          <input type="date" value={attDate} onChange={e => setAttDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
          <select value={attStatus} onChange={e => setAttStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]">
            <option value="present">Kohal</option>
            <option value="late">Hilines</option>
            <option value="absent">Puudus</option>
          </select>
          <button onClick={addAttendance}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
            Lisa
          </button>
        </div>
        {!attendance.length && <p className="text-sm text-gray-400">Kirjeid pole.</p>}
        <div className="space-y-2">
          {attendance.map(row => (
            <div key={row.id} className="flex justify-between text-sm text-gray-700">
              <span>{new Date(row.date).toLocaleDateString('et-EE')}</span>
              <span className="font-medium">{attLabels[row.status] || row.status}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Käitumine" hint="Tunnustus, mure või distsiplinaarjuhtum.">
        <div className="flex gap-2 mb-4">
          <select value={behKind} onChange={e => setBehKind(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]">
            <option value="positive">Tunnustus</option>
            <option value="concern">Mure</option>
            <option value="incident">Juhtum</option>
          </select>
          <input type="text" value={behNote} onChange={e => setBehNote(e.target.value)}
            placeholder="Lühike märkus"
            onKeyDown={e => e.key === 'Enter' && addBehavior()}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
          <button onClick={addBehavior}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
            Lisa
          </button>
        </div>
        {!behavior.length && <p className="text-sm text-gray-400">Märkusi pole.</p>}
        <div className="space-y-2">
          {behavior.map(row => (
            <div key={row.id} className="text-sm">
              <span className="font-medium text-gray-900">{behLabels[row.kind]}</span>
              <span className="text-gray-400 text-xs ml-2">{new Date(row.date).toLocaleDateString('et-EE')}</span>
              <p className="text-gray-700">{row.note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Heaolu check-in" hint="Vabatahtlik, 1 klõps. See ei ole järelevalve — õpetaja märgib ainult siis, kui laps jagab.">
        <div className="flex gap-2 mb-4">
          {[['good', 'Hea'], ['ok', 'Keskmine'], ['hard', 'Raske']].map(([value, label]) => (
            <button key={value} onClick={() => setMood(value)}
              className={`text-sm rounded-full px-4 py-1.5 border ${
                mood === value ? 'bg-[#EEEDFE] border-[#7F77DD] text-[#534AB7]' : 'border-gray-200 text-gray-600'
              }`}>
              {label}
            </button>
          ))}
          <button onClick={addWellbeing}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-1.5 hover:bg-[#534AB7]">
            Salvesta täna
          </button>
        </div>
        {!wellbeing.length && <p className="text-sm text-gray-400">Check-ine pole.</p>}
        <div className="space-y-1">
          {wellbeing.map(row => (
            <p key={row.id} className="text-sm text-gray-700">
              {new Date(row.date).toLocaleDateString('et-EE')}: {moodLabels[row.mood]}
            </p>
          ))}
        </div>
      </Section>

      <Section title="Eesmärgid" hint="Akadeemilised ja isiklikud, jälgitavad üle kuude.">
        <div className="flex gap-2 mb-4">
          <select value={goalKind} onChange={e => setGoalKind(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]">
            <option value="academic">Akadeemiline</option>
            <option value="personal">Isiklik</option>
          </select>
          <input type="text" value={goalTitle} onChange={e => setGoalTitle(e.target.value)}
            placeholder="Nt kordab murde 2× nädalas"
            onKeyDown={e => e.key === 'Enter' && addGoal()}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
          <button onClick={addGoal}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
            Lisa
          </button>
        </div>
        {!goals.length && <p className="text-sm text-gray-400">Eesmärke pole.</p>}
        <div className="space-y-2">
          {goals.map(goal => (
            <button key={goal.id} onClick={() => toggleGoal(goal)}
              className="w-full text-left flex items-center gap-2 text-sm">
              <span className={`w-4 h-4 rounded border flex-shrink-0 ${
                goal.status === 'done' ? 'bg-[#7F77DD] border-[#7F77DD]' : 'border-gray-300'
              }`} />
              <span className={goal.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}>
                {goal.title}
              </span>
              <span className="text-xs text-gray-400">{kindLabels[goal.kind]}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Mentori märkmed" hint="Lühikesed 1:1 check-inid jäävad õpilase juurde püsima.">
        <textarea value={mentorText} onChange={e => setMentorText(e.target.value)}
          rows={3} placeholder="Mis räägiti, mis kokku lepiti..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] mb-2" />
        <button onClick={addMentorNote}
          className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7] mb-4">
          Lisa märge
        </button>
        {!mentorNotes.length && <p className="text-sm text-gray-400">Märkmeid pole.</p>}
        <div className="space-y-3">
          {mentorNotes.map(row => (
            <div key={row.id} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">{new Date(row.created_at).toLocaleString('et-EE')}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{row.note}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="bg-white rounded-xl border border-black/10 p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">AI analüüs</h2>
        {!aiAnalysis && (
          <button onClick={runAI} disabled={aiLoading}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-5 py-2.5 hover:bg-[#534AB7] disabled:opacity-50">
            {aiLoading
              ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Analüüsin...</span>
              : 'Käivita AI analüüs'}
          </button>
        )}
        {aiAnalysis && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">Põhiprobleem:</p>
              <p className="text-sm text-gray-700">{aiAnalysis.mainProblem}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">AI hüpotees:</p>
              <p className="text-sm text-gray-700">{aiAnalysis.hypothesis}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">4-nädalane plaan:</p>
              <div className="bg-[#EEEDFE] rounded-lg p-3">
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{aiAnalysis.plan4Weeks}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">Soovituslikud ülesanded:</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiAnalysis.suggestedTasks}</p>
            </div>
            <button onClick={runAI} disabled={aiLoading}
              className="text-sm border border-[#AFA9EC] text-[#534AB7] rounded-lg px-4 py-2 hover:bg-[#EEEDFE]">
              Genereeri uuesti
            </button>
          </div>
        )}
      </div>

      {parentLetter && (
        <div className="bg-white rounded-xl border border-black/10 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Kiri lapsevanemale</h2>
          <div className="bg-gray-50 rounded-lg p-4 mb-3">
            <p className="text-sm text-gray-700 italic">{parentLetter}</p>
          </div>
          <div className="flex gap-2">
            <button className="text-sm border border-[#AFA9EC] text-[#534AB7] rounded-lg px-4 py-2 hover:bg-[#EEEDFE]">
              Muuda kirja ↗
            </button>
            <button onClick={() => setSmsVersion(aiAnalysis?.parentSms || parentLetter.slice(0, 160))}
              className="text-sm border border-[#AFA9EC] text-[#534AB7] rounded-lg px-4 py-2 hover:bg-[#EEEDFE]">
              SMS versioon ↗
            </button>
          </div>
          {smsVersion && (
            <div className="mt-3 bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">SMS (maks 160 tähemärki):</p>
              <p className="text-sm text-gray-700">{smsVersion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
