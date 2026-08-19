import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'
import { isStaff } from '../constants/roles'

const formatWhen = iso => {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })
    : `${d.getDate()}.${d.getMonth() + 1}.`
}

export default function MessagesPage() {
  const { role } = useAuth()
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const staff = isStaff(role)

  const [conversations, setConversations] = useState([])
  const [contacts, setContacts] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [thread, setThread] = useState(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [composing, setComposing] = useState(false)
  const [newMsg, setNewMsg] = useState({ kind: 'direct', recipientId: '', subject: '', body: '' })

  const [assistModes, setAssistModes] = useState([])
  const [assisting, setAssisting] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [assistNote, setAssistNote] = useState('')

  const bottomRef = useRef(null)

  useEffect(() => {
    if (classesLoading) return
    loadAll()
  }, [classesLoading])

  useEffect(() => {
    if (!activeId) { setThread(null); return }
    openThread(activeId)
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread?.messages?.length])

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const c = await apiCall('/api/messages')
      setConversations(c.conversations || [])
      const k = await apiCall('/api/messages/contacts')
      setContacts(k.contacts || [])
      if (staff) {
        const m = await apiCall('/api/messages/assist/modes')
        setAssistModes(m.modes || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openThread = async (id) => {
    try {
      const t = await apiCall(`/api/messages/${id}`)
      setThread(t)
      setConversations(prev => prev.map(c => (c.id === id ? { ...c, unread: 0 } : c)))
    } catch (err) { setError(err.message) }
  }

  const send = async () => {
    if (!draft.trim() || !activeId) return
    setError('')
    try {
      await apiCall(`/api/messages/${activeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: draft.trim() }),
      })
      setDraft('')
      setSuggestion(null)
      await openThread(activeId)
      const c = await apiCall('/api/messages')
      setConversations(c.conversations || [])
    } catch (err) { setError(err.message) }
  }

  const startConversation = async () => {
    setError('')
    if (!newMsg.body.trim()) { setError('Kirjuta sõnum'); return }
    if (newMsg.kind === 'direct' && !newMsg.recipientId) { setError('Vali saaja'); return }
    if (newMsg.kind === 'class_announcement' && !selectedClassId) { setError('Vali klass'); return }
    try {
      const payload = newMsg.kind === 'class_announcement'
        ? { kind: 'class_announcement', classId: Number(selectedClassId), subject: newMsg.subject, body: newMsg.body }
        : { kind: 'direct', recipientId: Number(newMsg.recipientId), subject: newMsg.subject, body: newMsg.body }
      const r = await apiCall('/api/messages', { method: 'POST', body: JSON.stringify(payload) })
      setComposing(false)
      setNewMsg({ kind: 'direct', recipientId: '', subject: '', body: '' })
      setSuggestion(null)
      await loadAll()
      setActiveId(r.id)
    } catch (err) { setError(err.message) }
  }

  /** AI ei saada midagi — annab ainult teksti, mille sa ise üle vaatad (RULE A1). */
  const askAssist = async (mode, text, target) => {
    if (!text.trim()) { setAssistNote('Kirjuta esmalt sõnum.'); return }
    setAssisting(true)
    setAssistNote('')
    setSuggestion(null)
    try {
      const r = await apiCall('/api/messages/assist', {
        method: 'POST',
        body: JSON.stringify({ text, mode }),
      })
      if (r.suggestion) setSuggestion({ text: r.suggestion, target })
      if (r.fallback) setAssistNote(r.fallback)
    } catch (err) {
      setAssistNote(err.message)
    } finally {
      setAssisting(false)
    }
  }

  const applySuggestion = () => {
    if (!suggestion) return
    if (suggestion.target === 'new') setNewMsg({ ...newMsg, body: suggestion.text })
    else setDraft(suggestion.text)
    setSuggestion(null)
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  const AssistBar = ({ text, target }) => (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      <span className="text-[11px] text-gray-400">AI abi:</span>
      {assistModes.map(m => (
        <button key={m.value} disabled={assisting}
          onClick={() => askAssist(m.value, text, target)}
          className="text-[11px] border border-gray-200 rounded-full px-2.5 py-1 text-gray-500 hover:bg-[#EEEDFE] hover:text-[#534AB7] disabled:opacity-40">
          {m.label}
        </button>
      ))}
      {assisting && <span className="text-[11px] text-gray-400">mõtlen...</span>}
    </div>
  )

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Sõnumid</h1>
        <button onClick={() => { setComposing(!composing); setActiveId(null) }}
          className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
          {composing ? 'Sulge' : '+ Uus sõnum'}
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-5">
        {staff ? 'Kirjavahetus lapsevanemate ja õpilastega.' : 'Kirjavahetus kooliga.'}
      </p>

      {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>}

      {composing && (
        <div className="bg-white rounded-xl border border-black/10 p-5 mb-5">
          {staff && (
            <div className="flex gap-2 mb-3">
              {[['direct', 'Isiklik sõnum'], ['class_announcement', `Teade klassile ${selectedClass?.name || ''}`]].map(([v, l]) => (
                <button key={v} onClick={() => setNewMsg({ ...newMsg, kind: v })}
                  className={`text-xs rounded-lg px-3 py-1.5 border transition-colors ${
                    newMsg.kind === v
                      ? 'bg-[#EEEDFE] border-[#AFA9EC] text-[#534AB7] font-medium'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {newMsg.kind === 'direct' && (
            <select value={newMsg.recipientId} onChange={e => setNewMsg({ ...newMsg, recipientId: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-[#7F77DD] mb-2">
              <option value="">Vali saaja…</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.roleLabel}{c.studentName ? ` (${c.studentName})` : ''}
                </option>
              ))}
            </select>
          )}

          <input value={newMsg.subject} onChange={e => setNewMsg({ ...newMsg, subject: e.target.value })}
            placeholder="Teema (valikuline)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] mb-2" />
          <textarea value={newMsg.body} onChange={e => setNewMsg({ ...newMsg, body: e.target.value })}
            rows={5} placeholder="Kirjuta sõnum…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] resize-y" />

          {staff && assistModes.length > 0 && <AssistBar text={newMsg.body} target="new" />}
          {assistNote && <p className="text-[11px] text-gray-400 mt-2">{assistNote}</p>}

          {suggestion?.target === 'new' && (
            <div className="bg-[#EEEDFE] rounded-lg p-3 mt-3">
              <p className="text-[11px] text-[#534AB7] font-medium mb-1">AI ettepanek — vaata üle enne saatmist</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestion.text}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={applySuggestion}
                  className="text-xs bg-[#7F77DD] text-white rounded-lg px-3 py-1.5 hover:bg-[#534AB7]">Kasuta seda</button>
                <button onClick={() => setSuggestion(null)}
                  className="text-xs text-gray-500 px-2">Jäta oma tekst</button>
              </div>
            </div>
          )}

          <button onClick={startConversation}
            className="mt-3 bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
            Saada
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
        <div className="space-y-2">
          {loading && <p className="text-sm text-gray-400">Laadin...</p>}
          {!loading && !conversations.length && (
            <div className="bg-white rounded-xl border border-black/10 p-6 text-center text-sm text-gray-400">
              Vestlusi veel pole.
            </div>
          )}
          {conversations.map(c => (
            <button key={c.id} onClick={() => { setActiveId(c.id); setComposing(false) }}
              className={`w-full text-left bg-white rounded-xl border p-3 transition-colors ${
                activeId === c.id ? 'border-[#AFA9EC] bg-[#EEEDFE]' : 'border-black/10 hover:bg-gray-50'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-semibold text-gray-900 truncate flex-1">
                  {c.kind === 'class_announcement'
                    ? `📣 ${c.className || 'Klass'}`
                    : c.participants.map(p => p.name).join(', ') || 'Vestlus'}
                </span>
                {c.unread > 0 && (
                  <span className="bg-[#7F77DD] text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {c.unread}
                  </span>
                )}
              </div>
              {c.subject && <p className="text-[11px] text-gray-500 truncate">{c.subject}</p>}
              <p className="text-[11px] text-gray-400 truncate">{c.lastBody}</p>
              <p className="text-[10px] text-gray-300 mt-0.5">{formatWhen(c.lastMessageAt)}</p>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-black/10 flex flex-col min-h-[400px]">
          {!thread && (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 p-8">
              Vali vestlus vasakult.
            </div>
          )}
          {thread && (
            <>
              <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  {thread.conversation.subject || (thread.conversation.kind === 'class_announcement' ? 'Teade klassile' : 'Vestlus')}
                </span>
                {thread.conversation.kind === 'class_announcement' && <Badge variant="purple">Teade</Badge>}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[420px]">
                {thread.messages.map(m => (
                  <div key={m.id} className={`flex ${m.isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                      m.isMine ? 'bg-[#7F77DD] text-white' : 'bg-[#f5f5f3] text-gray-800'
                    }`}>
                      {!m.isMine && (
                        <p className="text-[10px] opacity-70 mb-0.5">{m.senderName} · {m.senderRoleLabel}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                      <p className={`text-[10px] mt-1 ${m.isMine ? 'text-white/60' : 'text-gray-400'}`}>
                        {formatWhen(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {thread.conversation.canPost ? (
                <div className="border-t border-black/5 p-3">
                  <textarea value={draft} onChange={e => setDraft(e.target.value)}
                    rows={2} placeholder="Kirjuta vastus…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] resize-y" />
                  {staff && assistModes.length > 0 && <AssistBar text={draft} target="reply" />}
                  {suggestion?.target === 'reply' && (
                    <div className="bg-[#EEEDFE] rounded-lg p-3 mt-2">
                      <p className="text-[11px] text-[#534AB7] font-medium mb-1">AI ettepanek — vaata üle enne saatmist</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestion.text}</p>
                      <div className="flex gap-2 mt-2">
                        <button onClick={applySuggestion}
                          className="text-xs bg-[#7F77DD] text-white rounded-lg px-3 py-1.5 hover:bg-[#534AB7]">Kasuta seda</button>
                        <button onClick={() => setSuggestion(null)}
                          className="text-xs text-gray-500 px-2">Jäta oma tekst</button>
                      </div>
                    </div>
                  )}
                  <button onClick={send} disabled={!draft.trim()}
                    className="mt-2 bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7] disabled:opacity-40">
                    Saada
                  </button>
                </div>
              ) : (
                <div className="border-t border-black/5 px-4 py-3">
                  <p className="text-xs text-gray-400">
                    See on ühesuunaline teade — vastata ei saa. Kirjuta õpetajale eraldi sõnum.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
