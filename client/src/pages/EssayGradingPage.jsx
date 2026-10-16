import { useState } from 'react'
import { API_BASE_URL } from '../config'
import { useClasses } from '../context/ClassContext'
import HighlightedEssay from '../components/HighlightedEssay'

/** Puhas parandatud tekst; vanad [vale → õige] märked eemaldatakse, jäetakse õige variant. */
function CorrectedText({ text }) {
  return String(text || '').replace(/\[[^\[\]]*?→([^\[\]]*?)\]/g, '$1')
}

export default function EssayGradingPage() {
  const { classes, loading: classesLoading } = useClasses()
  const [essayText, setEssayText] = useState('')
  const [grade, setGrade] = useState('')
  const [criteria, setCriteria] = useState('')
  const [subject, setSubject] = useState('')
  const [language, setLanguage] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gradedText, setGradedText] = useState('')

  const missing = [
    !grade && 'klass',
    !language && 'essee keel',
    !essayText.trim() && 'essee tekst',
  ].filter(Boolean)
  const canGrade = missing.length === 0

  const gradeEssay = async () => {
    if (!canGrade) { setError('Täida enne hindamist kohustuslikud väljad: ' + missing.join(', ') + '.'); return }
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/grade-essay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('eduai_token')}`
        },
        body: JSON.stringify({ text: essayText, language, context: `Klass: ${grade}. Aine/teema: ${subject || 'täpsustamata'}. Hindamiskriteeriumid: ${criteria || 'grammatika, sisu, ülesehitus'}.` })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error || `Essee hindamine ebaõnnestus (kood ${res.status}).`)
        return
      }
      if (!data.feedback && !data.corrected) {
        setError('AI ei tagastanud tagasisidet. Proovi uuesti.')
        return
      }
      setGradedText(essayText)
      setResult(data)
    } catch (err) {
      setError('Ühendus serveriga ebaõnnestus: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Esseede hindamine</h1>
      <p className="text-gray-500 text-sm mb-6">Kleebi õpilase essee siia — AI parandab grammatika ja annab tagasiside.</p>

      <div className="bg-white rounded-xl border border-black/10 p-6 mb-4">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Essee keel <span className="text-red-500">*</span></label>
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]">
              <option value="">— Vali keel —</option>
              <option value="et">Eesti keel</option>
              <option value="en">Inglise keel</option>
              <option value="ru">Vene keel</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Klass <span className="text-red-500">*</span></label>
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Õpilase essee tekst <span className="text-red-500">*</span></label>
        <textarea
          placeholder="Kleebi õpilase essee siia..."
          value={essayText}
          onChange={e => setEssayText(e.target.value)}
          rows={12}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] resize-none"
        />
        <button
          onClick={gradeEssay}
          disabled={loading || !canGrade}
          className="mt-4 bg-[#7F77DD] text-white rounded-lg px-6 py-2.5 text-sm hover:bg-[#534AB7] disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
              Hindan...
            </span>
          ) : 'Hinda essee'}
        </button>
        {!canGrade && (
          <p className="mt-2 text-xs text-gray-500">Hindamiseks vali: {missing.join(', ')}.</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">{error}</div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-black/10 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Üldine tagasiside</h2>
            <p className="text-sm text-gray-700">{result.feedback}</p>
          </div>
          <div className="bg-white rounded-xl border border-black/10 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Vead tekstis</h2>
            <p className="text-xs text-gray-500 mb-3">Vii hiir märgitud kohale, et näha parandust ja selgitust.</p>
            <HighlightedEssay text={gradedText} errors={result.errors} />
            {result.errors?.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm text-gray-700 border-t border-gray-100 pt-3">
                {result.errors.map((e, i) => (
                  <li key={i}><span className="text-red-700 line-through">{e.wrong}</span> → <span className="text-green-700 font-medium">{e.correct}</span>{e.note ? ` — ${e.note}` : ''}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white rounded-xl border border-black/10 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Grammatikaparandused</h2>
            <p className="text-xs text-gray-500 mb-3">Kogu essee parandatud kujul. Vigade loetelu on ülal kaardil "Vead tekstis".</p>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed"><CorrectedText text={result.corrected} /></pre>
          </div>
          {result.grade !== '' && (
            <div className="bg-[#EEEDFE] rounded-xl p-5">
              <p className="text-sm font-semibold text-[#534AB7]">Soovituslik hinne: <span className="text-2xl font-bold">{result.grade}%</span></p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
