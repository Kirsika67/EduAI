import { useState } from 'react'
import { API_BASE_URL } from '../config'

export default function EssayGradingPage() {
  const [essayText, setEssayText] = useState('')
  const [context, setContext] = useState('')
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
        body: JSON.stringify({ text: essayText, context })
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Kontekst õpetajalt (valikuline)</label>
        <input
          type="text"
          placeholder="nt: 8. klassi kirjand teemal 'Minu unistused', hindamiskriteeriumid..."
          value={context}
          onChange={e => setContext(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] mb-4"
        />
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
