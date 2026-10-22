import { useState, useEffect } from 'react'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'

const weekDays = ['Esmaspäev', 'Teisipäev', 'Kolmapäev', 'Neljapäev', 'Reede']

export default function PlanningPage() {
  const { classes, selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const [plan, setPlan] = useState(weekDays.map(day => ({ day, className: '', topic: '' })))
  const [reminders, setReminders] = useState([])
  const [aiPlan, setAiPlan] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (classesLoading) return
    if (!selectedClassId) return
    apiCall(`/api/classes/${selectedClassId}/weekly-plans`)
      .then(d => {
        const latest = (d.plans || [])[0]
        setReminders(latest?.reminders || [])
        setAiPlan(latest?.plan_text || '')
      })
      .catch(() => {
        setReminders([])
      })
  }, [classesLoading, selectedClassId])

  const generatePlan = async () => {
    if (!selectedClassId) return
    setAiLoading(true)
    try {
      const focusNotes = plan
        .map(item => `${item.day}: ${item.className || '—'} ${item.topic || ''}`.trim())
        .join('\n')
      const data = await apiCall(`/api/classes/${selectedClassId}/weekly-plans/generate`, {
        method: 'POST',
        body: JSON.stringify({ focusNotes }),
      })
      setAiPlan(data.plan?.plan_text || '')
      setReminders(data.plan?.reminders || [])
    } catch { setAiPlan('Tunnikava genereerimine ebaõnnestus.') }
    finally { setAiLoading(false) }
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Planeerimine</h1>

      <div className="bg-white rounded-xl border border-black/10 p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Järgmine nädal</h2>
        <div className="space-y-3">
          {plan.map((item, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">{item.day}</span>
              <select value={item.className}
                onChange={e => setPlan(p => p.map((x, j) => j === i ? { ...x, className: e.target.value } : x))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]">
                <option value="">— Vali klass —</option>
                {classes.map(cls => <option key={cls.id} value={cls.name}>{cls.name}</option>)}
              </select>
              <input type="text" placeholder="Teema" value={item.topic}
                onChange={e => setPlan(p => p.map((x, j) => j === i ? { ...x, topic: e.target.value } : x))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-black/10 p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Meeldetuletused</h2>
        {!reminders.length
          ? <p className="text-sm text-gray-400">Aktiivseid meeldetuletusi pole.</p>
          : <ul className="space-y-2">
              {reminders.map((r, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                  <div className="w-2 h-2 rounded-full bg-[#EF9F27] flex-shrink-0" />
                  {r.text || r.message || r}
                </li>
              ))}
            </ul>
        }
      </div>

      <button onClick={generatePlan} disabled={aiLoading}
        className="bg-[#1C3556] text-white text-sm rounded-lg px-5 py-2.5 hover:bg-[#2A4A7A] disabled:opacity-50 mb-4">
        {aiLoading
          ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Genereerin...</span>
          : 'Loo lõbus tunnikava ↗'}
      </button>

      {aiPlan && (
        <div className="bg-[#EEEDFE] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#1C3556]" />
            <span className="text-xs text-[#534AB7] font-medium">AI genereeritud tunnikava</span>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-[#3C3489] leading-relaxed">{aiPlan}</pre>
        </div>
      )}
    </div>
  )
}
