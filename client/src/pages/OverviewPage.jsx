import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'

function computeAlerts(students, allGrades) {
  const alerts = []
  students.forEach(student => {
    const sg = allGrades.filter(g => Number(g.student_id) === Number(student.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    if (sg.length >= 3 && sg.slice(0, 3).every(g => Number(g.score) < 50))
      alerts.push({ type: 'red', studentName: student.name })
    const now = new Date()
    const last30 = sg.filter(g => (now - new Date(g.date)) / 86400000 <= 30)
    const prev30 = sg.filter(g => { const d = (now - new Date(g.date)) / 86400000; return d > 30 && d <= 60 })
    if (last30.length > 0 && prev30.length > 0) {
      const a1 = last30.reduce((s, g) => s + Number(g.score), 0) / last30.length
      const a2 = prev30.reduce((s, g) => s + Number(g.score), 0) / prev30.length
      if (a1 - a2 > 15) alerts.push({ type: 'green', studentName: student.name })
    }
  })
  const topicMap = {}
  allGrades.forEach(g => {
    const topicName = g.topic_name || g.topic || 'Teema puudub'
    if (!topicMap[topicName]) topicMap[topicName] = []
    topicMap[topicName].push(Number(g.score))
  })
  Object.entries(topicMap).forEach(([topic, scores]) => {
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length
    if (avg < 65) alerts.push({ type: 'yellow', topic, avg: Math.round(avg) })
  })
  return alerts
}

export default function OverviewPage() {
  const { classes, selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [allGrades, setAllGrades] = useState([])
  const [topics, setTopics] = useState([])
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [activeDrilldown, setActiveDrilldown] = useState('')

  useEffect(() => {
    if (classesLoading) return
    if (!selectedClassId) return
    loadData()
  }, [classesLoading, selectedClassId])

  const loadData = async () => {
    setDataLoading(true)

    try {
      const s = await apiCall(`/api/classes/${selectedClassId}/students`)
      setStudents(s.students || [])
      const t = await apiCall(`/api/classes/${selectedClassId}/topics`)
      setTopics(t.topics || [])
      const g = await apiCall(`/api/classes/${selectedClassId}/grades`)
      setAllGrades(g.grades || [])
    } catch (err) {
      console.error(err)
      setStudents([])
      setTopics([])
      setAllGrades([])
    }
    finally { setDataLoading(false) }

    // Lae AI ülevaade automaatselt peale andmete laadimist
    loadAI()
  }

  const loadAI = async () => {
    if (!selectedClassId) return
    setAiLoading(true)
    try {
      const data = await apiCall(`/api/dashboard/overview?classId=${selectedClassId}`)
      const text = (data.aiSummary || data.aiSummaryFallback || '').trim()
      setAiText(text || 'AI ülevaade pole hetkel saadaval.')
    } catch (err) {
      console.error('AI ülevaade ebaõnnestus', err)
      setAiText(err?.message || 'AI ülevaade pole hetkel saadaval. Proovi lehte värskendada.')
    }
    finally { setAiLoading(false) }
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>
  if (!selectedClass && classes.length === 0) return (
    <div className="p-8 text-center text-gray-500">Ühtegi klassi pole. Lisa klass vasakul külgribal.</div>
  )

  const alerts = computeAlerts(students, allGrades)
  const totalStudents = students.length
  const needsAttention = alerts.filter(a => a.type === 'red' || a.type === 'yellow').length
  const classAvg = allGrades.length > 0
    ? Math.round(allGrades.reduce((s, g) => s + Number(g.score), 0) / allGrades.length) : 0
  let ungradedWork = 0
  const missingByStudent = []
  students.forEach(s => topics.forEach(t => {
    if (!allGrades.some(g => Number(g.student_id) === Number(s.id) && Number(g.topic_id) === Number(t.id))) ungradedWork++
  }))
  students.forEach(s => {
    const missingTopics = topics
      .filter(t => !allGrades.some(g => Number(g.student_id) === Number(s.id) && Number(g.topic_id) === Number(t.id)))
      .map(t => t.name)
    if (missingTopics.length) missingByStudent.push({ studentId: s.id, studentName: s.name, missingTopics })
  })

  const cards = [
    {
      key: 'total',
      label: 'Kokku õpilasi jälgitakse',
      value: totalStudents,
      sub: 'valitud klass: ' + (selectedClass?.name || ''),
      color: 'text-gray-900',
      onClick: () => navigate('/opilased'),
    },
    {
      key: 'attention',
      label: 'Vajavad tähelepanu',
      value: needsAttention,
      sub: 'punane või kollane hoiatus',
      color: 'text-[#E24B4A]',
      onClick: () => setActiveDrilldown(prev => prev === 'attention' ? '' : 'attention'),
    },
    {
      key: 'avg',
      label: 'Klassi keskmine %',
      value: classAvg + '%',
      sub: 'valitud klass: ' + (selectedClass?.name || ''),
      color: 'text-gray-900',
      onClick: () => navigate('/hinded'),
    },
    {
      key: 'ungraded',
      label: 'Hindamata tööd',
      value: ungradedWork,
      sub: 'õpilane × teema ilma hindeta',
      color: 'text-gray-900',
      onClick: () => setActiveDrilldown(prev => prev === 'ungraded' ? '' : 'ungraded'),
    },
  ]

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Ülevaade</h1>
      <p className="text-gray-500 text-sm mb-8">Peamised näitajad, hoiatused ja lühike AI ülevaade valitud klassi kohta.</p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {cards.map(card => (
          <button
            key={card.key}
            onClick={card.onClick}
            className="bg-white rounded-[10px] border border-black/10 p-5 text-left hover:border-[#AFA9EC] hover:shadow-sm transition"
          >
            <p className="text-xs text-gray-500 mb-2">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color} mb-1`}>{dataLoading ? '...' : card.value}</p>
            <p className="text-xs text-gray-400">{card.sub} · Vajuta</p>
          </button>
        ))}
      </div>

      {activeDrilldown === 'attention' && (
        <div className="bg-white rounded-[10px] border border-black/10 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Vajavad tähelepanu (detail)</h2>
          {!alerts.length && <p className="text-sm text-gray-400">Hetkel pole hoiatusi.</p>}
          <div className="space-y-2">
            {alerts
              .filter(a => a.type === 'red' || a.type === 'yellow')
              .map((a, i) => (
                <p key={i} className="text-sm text-gray-700">
                  {a.type === 'red'
                    ? `${a.studentName}: 3 järjestikust hinnet alla 50%`
                    : `${a.topic}: klassi keskmine ${a.avg}%`}
                </p>
              ))}
          </div>
        </div>
      )}

      {activeDrilldown === 'ungraded' && (
        <div className="bg-white rounded-[10px] border border-black/10 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Hindamata tööde detail</h2>
          {!missingByStudent.length && <p className="text-sm text-gray-400">Kõik tööd on hinnatud.</p>}
          <div className="space-y-2">
            {missingByStudent.map(item => (
              <p key={item.studentId} className="text-sm text-gray-700">
                <span className="font-semibold">{item.studentName}:</span> puudu — {item.missingTopics.join(', ')}
              </p>
            ))}
          </div>
          <button
            onClick={() => navigate('/hinded')}
            className="mt-4 border border-[#AFA9EC] text-[#534AB7] rounded-lg px-4 py-2 text-sm hover:bg-[#EEEDFE] transition-colors"
          >
            Ava hinnete sisestamine
          </button>
        </div>
      )}

      <div className="bg-[#EEEDFE] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#7F77DD]" />
            <span className="text-xs text-[#534AB7] font-medium">AI ülevaade täna</span>
          </div>
          <button onClick={loadAI} disabled={aiLoading}
            className="text-xs border border-[#AFA9EC] text-[#534AB7] rounded-full px-3 py-1 hover:bg-[#7F77DD] hover:text-white transition-colors disabled:opacity-50">
            {aiLoading ? 'Laadin...' : 'Küsi detaile ↗'}
          </button>
        </div>
        <p className="text-sm text-[#3C3489]">{aiText || 'Vajuta "Küsi detaile" et saada AI ülevaade.'}</p>
      </div>

      <div className="bg-white rounded-[10px] border border-black/10 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Viimased hoiatused</h2>
        {alerts.length === 0 && <p className="text-sm text-gray-400">Hetkel pole automaatseid hoiatusi.</p>}
        {alerts.map((alert, i) => (
          <div key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
            <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
              alert.type === 'red' ? 'bg-[#E24B4A]' : alert.type === 'yellow' ? 'bg-[#EF9F27]' : 'bg-[#639922]'
            }`} />
            <div>
              {alert.type === 'red' && <>
                <p className="text-sm font-semibold text-gray-900">{alert.studentName} — Järelevastamine vajalik</p>
                <p className="text-xs text-gray-400">Kolm järjestikust hinnet alla 50%.</p>
              </>}
              {alert.type === 'yellow' && <>
                <p className="text-sm font-semibold text-gray-900">{alert.topic} — Klass vajab kordamist</p>
                <p className="text-xs text-gray-400">Klassi keskmine teemas: {alert.avg}%</p>
              </>}
              {alert.type === 'green' && <>
                <p className="text-sm font-semibold text-gray-900">{alert.studentName} — Edasijõudnud</p>
                <p className="text-xs text-gray-400">Kiire areng viimase 30 päevaga.</p>
              </>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate('/opilased')}
          className="border border-[#AFA9EC] text-[#534AB7] rounded-lg px-5 py-2.5 text-sm hover:bg-[#EEEDFE] transition-colors">
          Halda õpilasi
        </button>
        <button onClick={() => navigate('/hinded')}
          className="bg-[#7F77DD] text-white rounded-lg px-5 py-2.5 text-sm hover:bg-[#534AB7] transition-colors">
          Sisesta hinded
        </button>
      </div>
    </div>
  )
}
