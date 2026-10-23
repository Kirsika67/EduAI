import { useState, useRef, useEffect } from 'react'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { splitPlan, RichText } from '../components/plannerHelpers'
import PlannerMobile from '../components/PlannerMobile'

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

export default function PlannerPage() {
  const { classes, selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const [chats, setChats] = useState([])
  const [retentionDays, setRetentionDays] = useState(20)
  const [activeId, setActiveId] = useState(null)
  const [activeClassId, setActiveClassId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [images, setImages] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [applied, setApplied] = useState({})
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  useEffect(() => {
    if (classesLoading) return
    loadChats()
  }, [classesLoading])

  const loadChats = async () => {
    try {
      const data = await apiCall('/api/planner/chats')
      setChats(data.chats || [])
      setRetentionDays(data.retentionDays || 20)
    } catch (err) {
      setError(err.message)
    }
  }

  if (classesLoading) return <div>Laadin...</div>

  const chatClass = classes.find(c => Number(c.id) === Number(activeId ? activeClassId : selectedClassId)) || selectedClass

  const openChat = async (id) => {
    setError(''); setNotice('')
    try {
      const data = await apiCall(`/api/planner/chats/${id}`)
      setActiveId(data.id)
      setActiveClassId(data.classId)
      setMessages(data.messages || [])
      setApplied({})
      setDraft(''); setImages([])
    } catch (err) {
      setError(err.message)
    }
  }

  const newChat = () => {
    setActiveId(null); setActiveClassId(null); setMessages([]); setDraft(''); setImages([])
    setError(''); setNotice(''); setApplied({})
  }

  const deleteChat = async (id) => {
    if (!window.confirm('Kustutan selle vestluse jäädavalt?')) return
    try {
      await apiCall(`/api/planner/chats/${id}`, { method: 'DELETE' })
      if (Number(id) === Number(activeId)) newChat()
      await loadChats()
    } catch (err) {
      setError(err.message)
    }
  }

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

  /** Lohistamine ja kleepimine (Cmd+V): võta kõik pildifailid. */
  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
  }
  const onDragOver = (e) => {
    if (Array.from(e.dataTransfer?.types || []).includes('Files')) { e.preventDefault(); setDragging(true) }
  }
  const onPaste = (e) => {
    const files = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'))
    if (files.length) { e.preventDefault(); addFiles(files) }
  }

  const send = async () => {
    if (sending || (!draft.trim() && images.length === 0)) return
    const classForChat = activeId ? activeClassId : selectedClassId
    if (!classForChat) { setError('Vali enne klass.'); return }
    const userMsg = { role: 'user', text: draft.trim(), images, imageCount: images.length || undefined }
    const next = [...messages, userMsg]
    setMessages(next)
    setDraft('')
    setImages([])
    setSending(true)
    setError('')
    try {
      const data = await apiCall('/api/planner/chat', {
        method: 'POST',
        body: JSON.stringify({
          chatId: activeId || undefined,
          classId: classForChat,
          text: userMsg.text,
          images: images.map(i => ({ mediaType: i.mediaType, data: i.data })),
        }),
      })
      setMessages([...next, { role: 'assistant', text: data.text }])
      if (!activeId) { setActiveId(data.chatId); setActiveClassId(classForChat) }
      await loadChats()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const applyPlan = async (index, plan) => {
    setError(''); setNotice('')
    const classId = activeId ? activeClassId : selectedClassId
    const subject = chatClass?.subject || 'Aine'
    try {
      let ls = 0
      for (const l of plan.lessons || []) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(l.date))) continue
        await apiCall('/api/lesson-plans', {
          method: 'POST',
          body: JSON.stringify({ classId, date: l.date, title: String(l.title || 'Tund').slice(0, 160), content: l.content || '' }),
        })
        ls++
      }
      let hw = 0
      for (const h of plan.homework || []) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(h.date))) continue
        await apiCall('/api/assignments', {
          method: 'POST',
          body: JSON.stringify({
            classId, subject,
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
          body: JSON.stringify({ classId, subject, title: String(e.title || 'Kontrolltöö').slice(0, 160), date: e.date }),
        })
        ex++
      }
      setApplied(prev => ({ ...prev, [index]: true }))
      setNotice(`Lisatud Päevikusse: ${ls} tunnikava, ${hw} kodutööd ja ${ex} kontrolltööd.`)
    } catch (err) {
      setError(err.message)
    }
  }

  const expiryLabel = (days) =>
    days <= 0 ? 'Kustutatakse täna' : `Kustutatakse ${days} päeva pärast`

  return (
    <>
    <div className="hidden md:block max-w-6xl">
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-gray-900">AI planeerija</h1>
        <p className="text-gray-500 text-sm">
          {chatClass ? `${chatClass.name} · ${chatClass.subject}` : 'Vali klass paremalt ülevalt.'}
        </p>
      </div>

      <div className="grid md:grid-cols-[260px_1fr] gap-4">
        <aside className="bg-white rounded-lg border border-black/10 p-3 h-fit">
          <button onClick={newChat}
            className="w-full bg-[#1c3556] text-white text-sm rounded-lg px-3 py-2 hover:bg-[#2a4a7a] mb-3">
            + Uus vestlus
          </button>
          {chats.length === 0 && <p className="text-xs text-gray-400 px-1">Salvestatud vestlusi veel pole.</p>}
          <ul className="space-y-1 max-h-[55vh] overflow-y-auto">
            {chats.map(c => {
              const urgent = c.daysLeft <= 10
              const active = Number(c.id) === Number(activeId)
              return (
                <li key={c.id}>
                  <div className={`rounded-lg border px-2.5 py-2 cursor-pointer ${active ? 'border-[#9ab7e0] bg-[#f4f8fd]' : 'border-transparent hover:bg-gray-50'}`}
                    onClick={() => openChat(c.id)}>
                    <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                    <p className="text-[11px] text-gray-500 truncate">{c.className}</p>
                    <div className="flex items-center justify-between">
                      <p className={`text-[11px] ${urgent ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                        {expiryLabel(c.daysLeft)}
                      </p>
                      <button onClick={(e) => { e.stopPropagation(); deleteChat(c.id) }}
                        className="text-[11px] text-gray-300 hover:text-red-600">Kustuta</button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="text-[11px] text-gray-400 mt-3 px-1">
            Vestlused säilivad {retentionDays} päeva pärast viimast sõnumit. Pilte ei salvestata.
          </p>
        </aside>

        <div
          className="relative"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
        >
          {dragging && (
            <div className="absolute inset-0 z-10 rounded-lg border-2 border-dashed border-[#2a6db0] bg-[#f4f8fd]/90 flex items-center justify-center text-[#1c3556] font-medium pointer-events-none">
              Lase pilt siia maha
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-xs mb-3">
            Enne pildi üleslaadimist kata kinni õpilaste nimed. Pildid saadetakse AI-le ja nimesid neil kaitsta ei saa. AI ettepanekud vaata alati ise üle.
          </div>

          <div className="bg-white rounded-lg border border-black/10 p-4 min-h-[320px] max-h-[60vh] overflow-y-auto space-y-3">
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-[#F7F4EE] text-sm text-gray-800">{GREETING}</div>
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
                      {!(m.images || []).length && m.imageCount > 0 && (
                        <p className="text-xs opacity-70 mb-1">[{m.imageCount} pilti, pilte ei salvestata]</p>
                      )}
                      {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                    </div>
                  </div>
                )
              }
              const { text, plan } = splitPlan(m.text)
              const hasItems = plan && ((plan.lessons || []).length || (plan.homework || []).length || (plan.exams || []).length)
              return (
                <div key={i} className="max-w-[92%] rounded-2xl px-4 py-2.5 bg-[#F7F4EE] text-sm text-gray-800 space-y-0.5">
                  <RichText text={text} />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button onClick={() => navigator.clipboard?.writeText(text)}
                      className="text-xs border border-gray-300 rounded px-2.5 py-1 text-gray-600 hover:bg-white">Kopeeri tekst</button>
                    {hasItems && (
                      <button onClick={() => applyPlan(i, plan)} disabled={applied[i]}
                        className="text-xs bg-[#1C3556] text-white rounded px-2.5 py-1 hover:bg-[#2A4A7A] disabled:opacity-50">
                        {applied[i] ? 'Lisatud Päevikusse' : 'Lisa tunnikavad, kodutööd ja kontrolltööd Päevikusse'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {sending && <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-[#F7F4EE] text-sm text-gray-400">Mõtlen... (plaani koostamine võib võtta kuni minuti)</div>}
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
              onPaste={onPaste}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Kirjuta tulemused, eesmärk või vastus küsimusele... Pildi saad lohistada siia või kleepida (Cmd+V). Enter saadab, Shift+Enter uus rida."
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
              <button onClick={send} disabled={sending || !(activeId ? activeClassId : selectedClassId) || (!draft.trim() && images.length === 0)}
                className="bg-[#1c3556] text-white text-sm rounded-lg px-5 py-1.5 hover:bg-[#2a4a7a] disabled:opacity-50">
                {sending ? 'Saadan...' : 'Saada'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <PlannerMobile
      chats={chats} activeId={activeId} messages={messages}
      draft={draft} setDraft={setDraft} images={images} setImages={setImages}
      sending={sending} error={error} notice={notice} applied={applied}
      send={send} newChat={newChat} openChat={openChat} deleteChat={deleteChat}
      addFiles={addFiles} applyPlan={applyPlan} expiryLabel={expiryLabel}
      chatClass={chatClass} retentionDays={retentionDays}
    />
    </>
  )
}