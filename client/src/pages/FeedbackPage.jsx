import { useState, useEffect } from 'react'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'

const statusLabels = { red: 'Järelevastamine', yellow: 'Tugi vajalik', green: 'Edasijõudnud', blue: 'Hea tase' }
const avatarBg = { red: 'bg-[#FCEBEB] text-[#A32D2D]', yellow: 'bg-[#FAEEDA] text-[#854F0B]', green: 'bg-[#EAF3DE] text-[#3B6D11]', blue: 'bg-[#E6F1FB] text-[#185FA5]' }
const getInitials = name => name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
const sid = id => Number(id)

function getStatus(grades) {
  if (!grades.length) return 'blue'
  const avg = grades.reduce((s, g) => s + Number(g.score), 0) / grades.length
  const sorted = [...grades].sort((a, b) => new Date(b.date) - new Date(a.date))
  if (sorted.length >= 3 && sorted.slice(0, 3).every(g => Number(g.score) < 50)) return 'red'
  if (avg < 60) return 'yellow'
  return 'blue'
}

function latestGradeFeedback(grades) {
  const sorted = [...grades].sort(
    (a, b) => new Date(b.date) - new Date(a.date) || Number(b.id) - Number(a.id)
  )
  return sorted.find(g => g.ai_feedback)?.ai_feedback || null
}

function feedbackTextFromAnalysis(analysis) {
  return (
    analysis.suggestedTasks ||
    analysis.mainProblem ||
    'Tagasisidet ei tekkinud.'
  )
}

export default function FeedbackPage() {
  const { selectedClassId, loading: classesLoading } = useClasses()
  const [students, setStudents] = useState([])
  const [gradesMap, setGradesMap] = useState({})
  const [feedbackMap, setFeedbackMap] = useState({})
  const [letterMap, setLetterMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (classesLoading) return
    if (!selectedClassId) return
    loadData()
  }, [classesLoading, selectedClassId])

  const loadData = async () => {
    setLoading(true)
    setNotice('')
    try {
      const s = await apiCall(`/api/classes/${selectedClassId}/students`)
      const list = s.students || []
      setStudents(list)
      const map = {}
      const g = await apiCall(`/api/classes/${selectedClassId}/grades`)
      for (const grade of (g.grades || [])) {
        const studentId = sid(grade.student_id)
        if (!map[studentId]) map[studentId] = []
        map[studentId].push(grade)
      }
      setGradesMap(map)

      const existing = {}
      for (const student of list) {
        const text = latestGradeFeedback(map[sid(student.id)] || [])
        if (text) existing[sid(student.id)] = text
      }
      setFeedbackMap(existing)
    } catch (err) {
      setNotice(err.message || 'Andmete laadimine ebaõnnestus.')
    } finally {
      setLoading(false)
    }
  }

  const generateAll = async () => {
    if (!students.length) return
    setGenerating(true)
    setNotice('')
    const fb = { ...feedbackMap }
    let usedFallback = false
    let errors = 0

    try {
      for (let i = 0; i < students.length; i++) {
        const student = students[i]
        const id = sid(student.id)
        const grades = gradesMap[id] || []
        setProgress(`Genereerin ${i + 1}/${students.length}...`)

        if (!grades.length) {
          fb[id] = 'Hindeid pole veel sisestatud.'
          setFeedbackMap({ ...fb })
          continue
        }

        const cached = latestGradeFeedback(grades)
        if (cached && fb[id] === cached) {
          continue
        }

        try {
          const res = await apiCall(
            `/api/classes/${selectedClassId}/students/${id}/ai-analysis`,
            { method: 'POST' }
          )
          const analysis = res.analysis || {}
          fb[id] = feedbackTextFromAnalysis(analysis)
          if (res.fallback) usedFallback = true
          setFeedbackMap({ ...fb })
        } catch (err) {
          errors += 1
          fb[id] = `Genereerimine ebaõnnestus: ${err.message}`
          setFeedbackMap({ ...fb })
        }
      }

      if (errors === students.length) {
        setNotice('Ühegi õpilase tagasisidet ei õnnestunud luua. Kontrolli internetiühendust ja API võtit.')
      } else if (usedFallback) {
        setNotice('AI teenus ei vastanud. Näitasin tagasisidet, mis loodi automaatselt sinu sisestatud hinnete põhjal.')
      } else if (errors > 0) {
        setNotice(`${errors} õpilase puhul tekkis viga. Ülejäänud said tagasiside.`)
      }
    } finally {
      setGenerating(false)
      setProgress('')
    }
  }

  const generateLetter = async (student) => {
    const id = sid(student.id)
    setNotice('')
    try {
      const res = await apiCall(
        `/api/classes/${selectedClassId}/students/${id}/ai-analysis`,
        { method: 'POST' }
      )
      const analysis = res.analysis || {}
      setLetterMap(p => ({ ...p, [id]: analysis.parentEmail || '' }))
      if (res.fallback) {
        setNotice('AI teenus ei vastanud. Kiri loodi automaatselt hinnete põhjal.')
      }
    } catch (err) {
      setNotice(err.message || 'Kirja genereerimine ebaõnnestus.')
    }
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Tagasiside</h1>
        <button onClick={generateAll} disabled={generating || !students.length}
          className="bg-[#1C3556] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#2A4A7A] disabled:opacity-50">
          {generating ? (progress || 'Genereerin...') : 'Genereeri kõigile'}
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">AI automaatne tagasiside õpilastele viimase kontrolltöö põhjal.</p>

      {notice && (
        <div className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {notice}
        </div>
      )}

      {loading && <div className="text-gray-400 text-sm">Laadin...</div>}
      {!loading && !students.length && (
        <div className="bg-white rounded-xl border border-black/10 p-8 text-center text-gray-400">Selles klassis pole õpilasi.</div>
      )}

      <div className="space-y-4">
        {students.map(student => {
          const id = sid(student.id)
          const grades = gradesMap[id] || []
          const status = getStatus(grades)
          return (
            <div key={student.id} className="bg-white rounded-xl border border-black/10 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarBg[status]}`}>
                  {getInitials(student.name)}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{student.name}</p>
                  <Badge variant={status}>{statusLabels[status]}</Badge>
                </div>
              </div>

              {feedbackMap[id]
                ? <p className="text-sm text-gray-700 mb-3 bg-gray-50 rounded-lg p-3">{feedbackMap[id]}</p>
                : <p className="text-sm text-gray-400 mb-3 italic">Tagasiside pole veel genereeritud.</p>
              }

              <button onClick={() => generateLetter(student)}
                className="text-xs border border-[#AFA9EC] text-[#534AB7] rounded-lg px-3 py-1.5 hover:bg-[#EEEDFE]">
                Kiri lapsevanemale
              </button>

              {letterMap[id] && (
                <div className="mt-3 bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Kiri lapsevanemale:</p>
                  <p className="text-sm text-gray-700 italic">{letterMap[id]}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
