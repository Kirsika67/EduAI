import { useState, useRef, useEffect } from 'react'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'

const GREETING = 'Tere! Aitan sul planeerida tunnid, kodutööd ja kordamise. Lisa kontrolltöö tulemuste pilt (või kirjuta tulemused ja eesmärk) ning ma küsin vajalikud täpsustused.'

/** Pildid vähendatakse enne saatmist (kiirem, odavam ja mahub päringusse). */
function fileToImage(file, maxSide = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      resolve({ mediaType: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Pilti ei õnnestunud avada.')) }
    img.src = url
  })
}

/** Eraldab vastuse lõpust masinloetava plaaniploki; tagastab {text, plan}. */
function splitPlan(text) {
  const m = text.match(/```plan\s*([\s\S]*?)```/)
  if (!m) return { text, plan: null }
  let plan = null
  try { plan = JSON.parse(m[1]) } catch { plan = null }
  return { text: text.replace(m[0], '').trim(), plan }
}

function RichText({ text }) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-gray-900 mt-3 mb-1">{line.slice(3)}</h3>
    if (line.startsWith('# ')) return <h3 key={i} className="font-semibold text-gray-900 mt-3 mb-1">{line.slice(2)}</h3>
    const parts = line.split(/(\*\*[^*]+\*\*)/).map((p, j) =>
      p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p)
    return <p key={i} className={line.trim() === '' ? 'h-2' : ''}>{parts}</p>
  })
}

export default function PlannerPage() {
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [images, setImages] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [applied, setApplied] = useState({})
  const [notice, setNotice] = useState('')
  const fileRef = useRef(null)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  if (classesLoading) return <div>Laadin...</div>

  const addFiles = async (fileList) => {
    setError('')
    const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'))
    for (const f of files) {
      if (images.length >= 4) { setError('Ühes sõnumis kuni 4 pilti.'); break }
      try {
        const img = await fileToImage(f)
        setImages(prev => [...prev, img])
      } catch (err) {
        setError(err.message)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const send = async () => {
    if (sending || (!draft.trim() && images.length === 0)) return
    if (!selectedClassId) { setError('Vali enne klass.'); return }
    const userMsg = { role: 'user', text: draft.trim(), images }
    const next = [...messages, userMsg]
    setMessages(next)
    setDraft('')
    setImages([])
    setSending(true)
    setError('')
    try {
      const payload = next.map(m => ({
        role: m.role,
        text: m.text,
        images: (m.images || []).map(i => ({ mediaType: i.mediaType, data: i.data })),
      }))
      const data = await apiCall('/api/planner/chat', {
        method: 'POST',
        body: JSON.stringify({ classId: selectedClassId, messages: payload }),
      })
      setMessages([...next, { role: 'assistant', text: data.text }])
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const applyPlan = async (index, plan) => {
    setError(''); setNotice('')
    try {
      let hw = 0
      for (const h of plan.homework || []) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(h.date))) continue
        await apiCall('/api/assignments', {
          method: 'POST',
          body: JSON.stringify({
            classId: selectedClassId,
            subject: selectedClass?.subject || 'Aine',
            title: String(h.title || 'Kodutöö').slice(0, 160),
            description: h.description || '',
            kind: 'homework',
            dueDate: h.date,
          }),
        })
        hw++
      }
      let ex = 0
      for (const e of plan.exams || []) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.date))) continue
        await apiCall('/api/timetable/exams', {
          method: 'POST',
          body: JSON.stringify({
            classId: selectedClassId,
            subject: selectedClass?.subject || 'Aine',
            title: String(e.title || 'Kontrolltöö').slice(0, 160),
            date: e.date,
          }),
        })
        ex++
      }
      setApplied(prev => ({ ...prev, [index]: true }))
      setNotice(`Lisatud Päevikusse: ${hw} kodutööd ja ${ex} kontrolltööd.`)
    } catch (err) {
      setError(err.message)
    }
  }

  const reset = () => { setMessages([]); setDraft(''); setImages([]); setError(''); setNotice(''); setApplied({}) }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI planeerija</h1>
          <p className="text-gray-500 text-sm">
            {selectedClass ? `${selectedClass.name} · ${selectedClass.subject}` : 'Vali klass paremalt ülevalt.'}
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={reset} className="text-sm text-gray-500 hover:text-red-600">Alusta uuesti</button>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-xs mb-3">
        Enne pildi üleslaadimist kata kinni õpilaste nimed. Pildid saadetakse AI-le ja nimesid neil kaitsta ei saa. AI ettepanekud vaata alati ise üle.
      </div>

      <div className="bg-white rounded-lg border border-black/10 p-4 min-h-[320px] max-h-[60vh] overflow-y-auto space-y-3">
        <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-[#f4f6f9] text-sm text-gray-800">{GREETING}</div>
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-[#1c3556] text-white text-sm">
                  {(m.images || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {m.images.map((img, j) => <img key={j} src={img.preview} alt="" className="h-20 rounded" />)}
                    </div>
                  )}
                  {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                </div>
              </div>
            )
          }
          const { text, plan } = splitPlan(m.text)
          const hasItems = plan && ((plan.homework || []).length || (plan.exams || []).length)
          return (
            <div key={i} className="max-w-[92%] rounded-2xl px-4 py-2.5 bg-[#f4f6f9] text-sm text-gray-800 space-y-0.5">
              <RichText text={text} />
              <div className="flex flex-wrap gap-2 pt-2">
                <button onClick={() => navigator.clipboard?.writeText(text)}
                  className="text-xs border border-gray-300 rounded px-2.5 py-1 text-gray-600 hover:bg-white">Kopeeri tekst</button>
                {hasItems && (
                  <button onClick={() => applyPlan(i, plan)} disabled={applied[i]}
                    className="text-xs bg-[#7F77DD] text-white rounded px-2.5 py-1 hover:bg-[#534AB7] disabled:opacity-50">
                    {applied[i] ? 'Lisatud Päevikusse' : 'Lisa kodutööd ja kontrolltööd Päevikusse'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {sending && <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-[#f4f6f9] text-sm text-gray-400">Mõtlen... (plaani koostamine võib võtta kuni minuti)</div>}
        <div ref={endRef} />
      </div>

      {notice && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mt-3 text-sm">{notice}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mt-3 text-sm">{error}</div>}

      <div className="mt-3 bg-white rounded-lg border border-black/10 p-3">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.preview} alt="" className="h-16 rounded border border-gray-200" />
                <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 bg-gray-700 text-white rounded-full w-5 h-5 text-xs leading-none">×</button>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Kirjuta tulemused, eesmärk või vastus küsimusele... (Enter saadab, Shift+Enter uus rida)"
          rows={3}
          className="w-full text-sm outline-none resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <div>
            <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
              onChange={e => addFiles(e.target.files)} />
            <button onClick={() => fileRef.current?.click()}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50">
              + Lisa pilt
            </button>
          </div>
          <button onClick={send} disabled={sending || !selectedClassId || (!draft.trim() && images.length === 0)}
            className="bg-[#1c3556] text-white text-sm rounded-lg px-5 py-1.5 hover:bg-[#2a4a7a] disabled:opacity-50">
            {sending ? 'Saadan...' : 'Saada'}
          </button>
        </div>
      </div>
    </div>
  )
}
