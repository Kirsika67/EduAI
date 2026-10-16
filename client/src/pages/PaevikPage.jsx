import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'

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
  const [exams, setExams] = useState([])
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
      } else {
        setLessons([])
        setExams([])
      }
      const m = await apiCall('/api/messages')
      setConversations(m.conversations || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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

        <Panel title="Lähimad kontrolltööd" action={<Link to="/tunniplaan" className="text-sm text-[#2a6db0] hover:underline">Kõik →</Link>}>
          {!loading && exams.length === 0 && <p className="text-sm text-gray-500">Järgmise 14 päeva jooksul kontrolltöid pole.</p>}
          <ul className="divide-y divide-gray-100">
            {exams.map(e => (
              <li key={e.id} className="py-2.5">
                <p className="text-sm font-medium text-gray-900">{e.title || e.subject}</p>
                <p className="text-xs text-gray-500">{e.subject} · {formatDate(String(e.date).slice(0, 10))}</p>
              </li>
            ))}
          </ul>
        </Panel>

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
