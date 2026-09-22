import { useState } from 'react'
import { API_BASE_URL } from '../config'
import { useClasses } from '../context/ClassContext'

export default function EssayGradingPage() {
  const { classes } = useClasses()
  const [essayText, setEssayText] = useState('')
  const [grade, setGrade] = useState('')
  const [criteria, setCriteria] = useState('')
  const [subject, setSubject] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const gradeEssay = async () => {
    if (!essayText.trim()) { alert('Kleebi essee tekst sisse'); return }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/grade-essay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('eduai_token')}`
        },
        body: JSON.stringify({ text: essayText, context: `Klass: ${grade}. Aine/teema: ${subject || 'täpsustamata'}. Hindamiskriteeriumid: ${criteria || 'grammatika, sisu, ülesehitus'}.` })
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      alert('Viga: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Esseede hindamine</h1>
      <p className="text-gray-500 text-sm mb-6">Kleebi õpilase essee siia — AI parandab grammatika ja annab tagasiside.</p>

      <div className="bg-white rounded-xl border border-black/10 p-6 mb-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Klass</label>
            <select value={grade} onChange={e => setGrade(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]">
              <option value="">— Vali klass —</option>
              {classes.map(cls => <option key={cls.id} value={cls.name}>{cls.name} · {cls.subject}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Aine / teema (valikuline)</label>
            <input type="text" placeholder="nt: Eesti keel, kirjand" value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hindamiskriteeriumid</label>
            <input type="text" placeholder="nt: grammatika, sisu, ülesehitus" value={criteria} onChange={e => setCriteria(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
          </div>
        </div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Õpilase essee tekst</label>
        <textarea
          placeholder="Kleebi õpilase essee siia..."
          value={essayText}
          onChange={e => setEssayText(e.target.value)}
          rows={12}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] resize-none"
        />
        <button
          onClick={gradeEssay}
          disabled={loading}
          className="mt-4 bg-[#7F77DD] text-white rounded-lg px-6 py-2.5 text-sm hover:bg-[#534AB7] disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
              Hindan...
            </span>
          ) : 'Hinda essee'}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-black/10 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Üldine tagasiside</h2>
            <p className="text-sm text-gray-700">{result.feedback}</p>
          </div>
          <div className="bg-white rounded-xl border border-black/10 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Grammatikaparandused</h2>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{result.corrected}</pre>
          </div>
          {result.grade && (
            <div className="bg-[#EEEDFE] rounded-xl p-5">
              <p className="text-sm font-semibold text-[#534AB7]">Soovituslik hinne: <span className="text-2xl font-bold">{result.grade}</span></p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
