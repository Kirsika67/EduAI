import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { splitPlan, RichText } from './plannerHelpers'

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DURATION = 340

/** Tervitus vastavalt kellaajale, nagu Claude'i ja ChatGPT telefonirakenduses. */
function greeting(firstName) {
  const h = new Date().getHours()
  const name = firstName ? `, ${firstName}` : ''
  if (h < 5) return `Tere, öökull${name}!`
  if (h < 10) return `Tere hommikust${name}!`
  if (h < 17) return `Tere päevast${name}!`
  if (h < 22) return `Tere õhtust${name}!`
  return `Hilisõhtust, öökull${name}!`
}

const SUGGESTIONS = [
  'Planeeri kordamine pärast kontrolltööd',
  'Koosta kolme tunni kava järgmiseks teemaks',
  'Aita mul panna kokku kodutööd nädalaks',
]

const Icon = ({ d, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)
const I = {
  menu: 'M4 7h16M4 12h16M4 17h10',
  plus: 'M12 5v14M5 12h14',
  compose: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  close: 'M6 6l12 12M18 6L6 18',
  up: 'M12 19V5M5 12l7-7 7 7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
}

/**
 * AI planeerija telefonis: täisekraani vestlus (nagu Claude/ChatGPT), vasakult
 * väljalibisev vestluste paneel, ümar sisestuskast all.
 */
export default function PlannerMobile(p) {
  const { teacher } = useAuth()
  const navigate = useNavigate()
  const [drawer, setDrawer] = useState(false)
  const drawerRef = useRef(null)
  const backRef = useRef(null)
  const rootRef = useRef(null)
  const scrollRef = useRef(null)
  const taRef = useRef(null)
  const fileRef = useRef(null)
  const openRef = useRef(false)
  const firstName = (teacher?.name || '').split(' ')[0]
  const hello = useMemo(() => greeting(firstName), [firstName, p.messages.length === 0])
  const empty = p.messages.length === 0
  const canSend = !p.sending && (p.draft.trim() || p.images.length > 0)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [p.messages, p.sending])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [p.draft])

  const width = () => drawerRef.current?.offsetWidth || 300
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const place = (x, animate) => {
    const d = drawerRef.current, b = backRef.current
    if (!d || !b) return
    const w = width()
    const dur = animate && !reduce() ? DURATION : 0
    d.style.transition = dur ? `transform ${dur}ms ${EASE}` : 'none'
    b.style.transition = dur ? `opacity ${dur}ms ${EASE}` : 'none'
    d.style.transform = `translate3d(${Math.min(0, x - w)}px, 0, 0)`
    b.style.opacity = String(Math.max(0, Math.min(1, x / w)))
    b.style.pointerEvents = x > 2 ? 'auto' : 'none'
    d.style.visibility = x > 0 || animate ? 'visible' : 'hidden'
    d.style.boxShadow = x > 2 ? '8px 0 30px rgba(0,0,0,0.18)' : 'none'
  }

  const setState = (next, animate = true) => {
    openRef.current = next
    setDrawer(next)
    place(next ? width() : 0, animate)
    if (!next) setTimeout(() => { if (!openRef.current && drawerRef.current) drawerRef.current.style.visibility = 'hidden' }, DURATION + 30)
  }

  useEffect(() => { place(0, false); if (drawerRef.current) drawerRef.current.style.visibility = 'hidden' }, [])

  // Sõrmega järgimine: servast paremale tõmme avab, vasakule tõmme sulgeb.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let mode = null, startX = 0, startY = 0, lastX = 0, lastT = 0, vel = 0, moved = false
    const start = (e) => {
      const t = e.touches[0]
      startX = lastX = t.clientX; startY = t.clientY; lastT = performance.now(); vel = 0; moved = false
      if (!openRef.current && t.clientX < 24) mode = 'open'
      else if (openRef.current) mode = 'close'
      else mode = null
    }
    const move = (e) => {
      if (!mode) return
      const t = e.touches[0]
      const dx = t.clientX - startX, dy = t.clientY - startY
      if (!moved) {
        if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 8) { if (Math.abs(dy) > 10) mode = null; return }
        if ((mode === 'open' && dx < 0) || (mode === 'close' && dx > 0)) { mode = null; return }
      }
      moved = true
      if (e.cancelable) e.preventDefault()
      const now = performance.now()
      vel = (t.clientX - lastX) / Math.max(1, now - lastT); lastX = t.clientX; lastT = now
      const w = width()
      place(mode === 'open' ? Math.max(0, Math.min(w, dx)) : Math.max(0, Math.min(w, w + dx)), false)
    }
    const end = () => {
      if (!mode || !moved) { mode = null; return }
      const w = width(), dx = lastX - startX
      const m = mode; mode = null
      if (m === 'open') setState(dx > w * 0.3 || vel > 0.4)
      else setState(!(-dx > w * 0.3 || vel < -0.4))
    }
    root.addEventListener('touchstart', start, { passive: true })
    root.addEventListener('touchmove', move, { passive: false })
    root.addEventListener('touchend', end, { passive: true })
    root.addEventListener('touchcancel', end, { passive: true })
    return () => {
      root.removeEventListener('touchstart', start); root.removeEventListener('touchmove', move)
      root.removeEventListener('touchend', end); root.removeEventListener('touchcancel', end)
    }
  }, [])

  const choose = (fn) => { setState(false); fn() }

  const title = p.activeId ? (p.chats.find(c => Number(c.id) === Number(p.activeId))?.title || 'Vestlus') : 'AI planeerija'

  return (
    <div ref={rootRef} className="md:hidden fixed top-0 left-0 w-full z-[60] bg-[#F7F4EE] flex flex-col"
      style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Ülariba */}
      <header className="flex items-center justify-between px-2 h-14 flex-shrink-0">
        <button onClick={() => setState(true)} aria-label="Ava vestlused" className="w-11 h-11 flex items-center justify-center text-[#14213D] rounded-full active:bg-black/5">
          <Icon d={I.menu} size={24} />
        </button>
        <div className="text-center min-w-0 px-2">
          <p className="text-[15px] font-medium text-[#14213D] truncate">{title}</p>
          {p.chatClass && <p className="text-[11px] text-[#6B6B66] truncate">{p.chatClass.name} · {p.chatClass.subject}</p>}
        </div>
        <button onClick={p.newChat} aria-label="Uus vestlus" className="w-11 h-11 flex items-center justify-center text-[#14213D] rounded-full active:bg-black/5">
          <Icon d={I.compose} size={22} />
        </button>
      </header>

      {/* Vestlus */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        {empty ? (
          <div className="min-h-full flex flex-col items-center justify-center text-center pb-10">
            <div className="w-10 h-px bg-[#B08D57] mb-6" />
            <h1 className="font-serif-brand text-[32px] leading-tight text-[#14213D]" style={{ fontSize: '2rem' }}>{hello}</h1>
            <p className="text-[#6B6B66] mt-3">Mille kallal täna töötame?</p>
            <div className="mt-8 w-full max-w-sm space-y-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { p.setDraft(s); taRef.current?.focus() }}
                  className="w-full text-left text-sm text-[#14213D] bg-white border border-[#D9D4C7] rounded-2xl px-4 py-3 active:bg-[#F1EDE3]">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-3 space-y-5">
            {p.messages.map((m, i) => {
              if (m.role === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] bg-[#E9E4D8] text-[#14213D] rounded-3xl px-4 py-2.5 text-[15px]">
                      {(m.images || []).length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {m.images.map((img, j) => <img key={j} src={img.preview} alt="" className="h-20 rounded-lg" />)}
                        </div>
                      )}
                      {!(m.images || []).length && m.imageCount > 0 && <p className="text-xs opacity-60 mb-1">[{m.imageCount} pilti, pilte ei salvestata]</p>}
                      {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                    </div>
                  </div>
                )
              }
              const { text, plan } = splitPlan(m.text)
              const hasItems = plan && ((plan.lessons || []).length || (plan.homework || []).length || (plan.exams || []).length)
              return (
                <div key={i} className="text-[15px] leading-relaxed text-[#14213D] space-y-0.5">
                  <RichText text={text} />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button onClick={() => navigator.clipboard?.writeText(text)}
                      className="text-xs border border-[#D9D4C7] rounded-full px-3 py-1.5 text-[#14213D] active:bg-[#F1EDE3]">Kopeeri</button>
                    {hasItems && (
                      <button onClick={() => p.applyPlan(i, plan)} disabled={p.applied[i]}
                        className="text-xs bg-[#14213D] text-white rounded-full px-3 py-1.5 disabled:opacity-50">
                        {p.applied[i] ? 'Lisatud Päevikusse' : 'Lisa Päevikusse'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {p.sending && (
              <div className="flex gap-1.5 items-center text-[#6B6B66] text-sm py-1">
                <span className="w-2 h-2 rounded-full bg-[#B08D57] animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-[#B08D57] animate-pulse [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-[#B08D57] animate-pulse [animation-delay:300ms]" />
                <span className="ml-2">Mõtlen…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sisestuskast */}
      <div className="flex-shrink-0 px-3 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        {p.notice && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-3 py-2 mb-2 text-xs">{p.notice}</div>}
        {p.error && <div className="bg-[#F4E5E5] text-[#8A2C2C] rounded-xl px-3 py-2 mb-2 text-xs">{p.error}</div>}
        <div className="bg-white border border-[#D9D4C7] rounded-[26px] shadow-sm px-2 py-2">
          {p.images.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2 pt-1 pb-2">
              {p.images.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img.preview} alt="" className="h-14 rounded-lg border border-[#D9D4C7]" />
                  <button onClick={() => p.setImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 bg-[#14213D] text-white rounded-full w-5 h-5 flex items-center justify-center"><Icon d={I.close} size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => p.addFiles(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} aria-label="Lisa pilt"
              className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-[#14213D] active:bg-black/5">
              <Icon d={I.plus} size={22} />
            </button>
            <textarea ref={taRef} rows={1} value={p.draft} onChange={e => p.setDraft(e.target.value)}
              placeholder="Kirjuta planeerijale…"
              className="flex-1 min-w-0 resize-none bg-transparent outline-none py-2.5 text-[16px] text-[#14213D] placeholder:text-[#9A978F] max-h-40" />
            <button onClick={p.send} disabled={!canSend} aria-label="Saada"
              className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-colors ${canSend ? 'bg-[#14213D] text-white' : 'bg-[#E4E0D6] text-[#9A978F]'}`}>
              <Icon d={I.up} size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Vasakult väljalibisev vestluste paneel */}
      <div ref={backRef} onClick={() => setState(false)} className="absolute inset-0 bg-black/45 z-10" style={{ opacity: 0, pointerEvents: 'none' }} />
      <aside ref={drawerRef} aria-label="Vestlused"
        className="absolute top-0 left-0 bottom-0 z-20 bg-[#F7F4EE] flex flex-col"
        style={{ width: '78%', maxWidth: 340, transform: 'translate3d(-100%,0,0)', visibility: 'hidden', willChange: 'transform', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 h-14 flex-shrink-0">
          <p className="font-serif-brand text-xl text-[#14213D]">Vestlused</p>
          <button onClick={() => setState(false)} aria-label="Sulge" className="w-10 h-10 flex items-center justify-center rounded-full text-[#14213D] active:bg-black/5"><Icon d={I.close} size={20} /></button>
        </div>
        <div className="px-3 pb-2">
          <button onClick={() => choose(p.newChat)}
            className="w-full flex items-center gap-2 bg-[#14213D] text-white rounded-xl px-4 py-3 text-sm active:opacity-90">
            <Icon d={I.plus} size={18} /> Uus vestlus
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          {p.chats.length === 0 && <p className="text-xs text-[#6B6B66] px-2 py-3">Salvestatud vestlusi veel pole.</p>}
          <ul className="space-y-1">
            {p.chats.map(c => {
              const urgent = c.daysLeft <= 10
              const active = Number(c.id) === Number(p.activeId)
              return (
                <li key={c.id}>
                  <div className={`flex items-center gap-1 rounded-xl px-3 py-2.5 ${active ? 'bg-[#E9E4D8]' : 'active:bg-[#EFEBE0]'}`}>
                    <button onClick={() => choose(() => p.openChat(c.id))} className="flex-1 min-w-0 text-left">
                      <p className="text-[15px] text-[#14213D] truncate">{c.title}</p>
                      <p className="text-[11px] text-[#6B6B66] truncate">{c.className}</p>
                      <p className={`text-[11px] ${urgent ? 'text-red-600 font-semibold' : 'text-[#9A978F]'}`}>{p.expiryLabel(c.daysLeft)}</p>
                    </button>
                    <button onClick={() => p.deleteChat(c.id)} aria-label="Kustuta" className="w-9 h-9 flex items-center justify-center text-[#9A978F] active:text-red-600"><Icon d={I.trash} size={17} /></button>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="text-[11px] text-[#9A978F] px-2 mt-4 leading-relaxed">
            Vestlused säilivad {p.retentionDays} päeva pärast viimast sõnumit. Pilte ei salvestata.
          </p>
        </div>
        <div className="border-t border-[#D9D4C7] p-3 space-y-1" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
          <button onClick={() => navigate('/paevik')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#14213D] active:bg-[#EFEBE0]"><Icon d={I.home} size={18} /> Päevik</button>
          <button onClick={() => navigate('/veel')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#14213D] active:bg-[#EFEBE0]"><Icon d={I.grid} size={18} /> Kõik osad</button>
        </div>
      </aside>
    </div>
  )
}
