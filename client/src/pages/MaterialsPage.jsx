import { useState, useEffect } from 'react'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'
import MaterialView from '../components/MaterialView'

const typeLabels = { worksheet: 'Tööleht', theory: 'Teooria (reeglivihik)', test: 'Kontrolltöö', lesson_plan: 'Tunnikava' }
const typeHints = {
  worksheet: 'Harjutused tasemete kaupa (A, B, C), vähe seletust, ruum lahendamiseks.',
  theory: 'Teema täielikult selgeks: reeglid ja põhjendused, läbitöötatud näited, joonised, meelespea kastid.',
  test: 'Ainult ülesanded, ilma selgituste ja valemiteta. Lihtsamad ja raskemad, punktid, soovi korral variandid A ja B.',
  lesson_plan: 'Tunni eesmärgid, käik ja ajakava.',
}
const diffLabels = { easy: 'Kerge', medium: 'Keskmine', hard: 'Raske' }

export default function MaterialsPage() {
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState('worksheet')
  const [topic, setTopic] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [extraNotes, setExtraNotes] = useState('')
  const [variants, setVariants] = useState(1)
  const [includeAnswers, setIncludeAnswers] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedMaterial, setGeneratedMaterial] = useState(null)
  const [savedMaterials, setSavedMaterials] = useState([])
  const [topics, setTopics] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (classesLoading) return
    if (!selectedClassId) return
    loadAll()
  }, [classesLoading, selectedClassId])

  const loadAll = async () => {
    try {
      const t = await apiCall(`/api/classes/${selectedClassId}/topics`)
      setTopics(t.topics || [])
      const m = await apiCall(`/api/classes/${selectedClassId}/materials`)
      setSavedMaterials(m.materials || [])
    } catch (err) { console.error(err) }
  }

  const generate = async () => {
    const customTopicName = customTopic.trim()
    const topicId = topic ? Number(topic) : null
    if (!customTopicName && !topicId) { alert('Sisesta teema'); return }
    setGenerating(true)
    try {
      const res = await apiCall(`/api/classes/${selectedClassId}/materials/generate`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          topicId,
          customTopicName: customTopicName || undefined,
          difficulty: difficulty === 'easy' ? 'light' : difficulty,
          extraNotes,
          variants: type === 'test' ? Number(variants) : undefined,
          includeAnswers: (type === 'test' || type === 'worksheet') ? includeAnswers : undefined,
        }),
      })
      setGeneratedMaterial(res.material || null)
      await loadAll()
    } catch (err) { alert('Genereerimine ebaõnnestus: ' + err.message) }
    finally { setGenerating(false) }
  }

  const save = async () => {
    if (!generatedMaterial) return
    setGeneratedMaterial(null)
    setShowForm(false)
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Materjalid</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
          + Loo uus materjal
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-black/10 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Uus materjal</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Materjali tüüp</label>
            <div className="flex gap-4">
              {Object.entries(typeLabels).map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value={val} checked={type === val} onChange={() => setType(val)} className="accent-[#7F77DD]" />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">{typeHints[type]}</p>
          </div>

          {type === 'test' && (
            <div className="mb-4 flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Variandid</label>
              <select value={variants} onChange={e => setVariants(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]">
                <option value={1}>Üks variant</option>
                <option value={2}>Kaks varianti (A ja B)</option>
              </select>
            </div>
          )}
          {(type === 'test' || type === 'worksheet') && (
            <label className="mb-4 flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={includeAnswers} onChange={e => setIncludeAnswers(e.target.checked)} className="accent-[#7F77DD]" />
              Lisa õpetajale vastused eraldi lehele
            </label>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Teema</label>
            <div className="flex gap-3">
              <select value={topic} onChange={e => setTopic(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]">
                <option value="">— Vali olemasolev —</option>
                {topics.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
              </select>
              <input type="text" placeholder="Või sisesta uus teema" value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Raskusaste</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]">
              <option value="easy">Kerge</option>
              <option value="medium">Keskmine</option>
              <option value="hard">Raske</option>
            </select>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Lisajuhendid (valikuline)</label>
            <textarea placeholder="Lisajuhendid..." value={extraNotes} onChange={e => setExtraNotes(e.target.value)}
              rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] resize-none" />
          </div>

          <button onClick={generate} disabled={generating}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-5 py-2.5 hover:bg-[#534AB7] disabled:opacity-50">
            {generating
              ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Genereerin...</span>
              : 'Loo materjal'}
          </button>
        </div>
      )}

      {generatedMaterial && (
        <div className="print-area bg-white rounded-xl border-2 border-[#AFA9EC] p-6 mb-6">
          <div className="no-print flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">{typeLabels[generatedMaterial.type] || generatedMaterial.type}: {generatedMaterial.title}</h2>
            <div className="flex gap-2">
              <button onClick={() => window.print()}
                className="text-sm border border-gray-200 text-gray-600 rounded-lg px-4 py-2 hover:bg-gray-50">Prindi</button>
              <button onClick={save} disabled={saving}
                className="text-sm bg-[#7F77DD] text-white rounded-lg px-4 py-2 hover:bg-[#534AB7] disabled:opacity-50">
                Sule
              </button>
            </div>
          </div>
          <MaterialView content={generatedMaterial.content} />
        </div>
      )}

      <h2 className="text-base font-semibold text-gray-900 mb-3">Salvestatud materjalid</h2>
      {!savedMaterials.length && (
        <div className="bg-white rounded-xl border border-black/10 p-6 text-center text-gray-400 text-sm">Ühtegi salvestatud materjali pole.</div>
      )}
      <div className="space-y-3">
        {savedMaterials.map((m, i) => (
          <div key={i} className="bg-white rounded-xl border border-black/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="purple">{typeLabels[m.type] || m.type}</Badge>
              <div>
                <p className="text-sm font-medium text-gray-900">{m.title}</p>
                <p className="text-xs text-gray-400">{selectedClass?.name} · {new Date(m.created_at || m.date).toLocaleDateString('et-EE')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setGeneratedMaterial(m)}
                className="text-sm border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50">Vaata</button>
              <button onClick={() => { setGeneratedMaterial(m); setTimeout(() => window.print(), 400) }}
                className="text-sm border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50">Prindi</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
