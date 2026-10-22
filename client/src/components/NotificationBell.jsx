import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiCall } from '../api/client'

/** Kellaikoon päises: automatsioonide teavitused. Kontrollib uusi iga minut. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const data = await apiCall('/api/notifications?limit=10')
      setItems(data.notifications || [])
      setUnread(data.unread || 0)
    } catch { /* teavitused ei ole kriitilised */ }
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next) {
      await load()
      if (unread > 0) {
        try { await apiCall('/api/notifications/read-all', { method: 'POST' }); setUnread(0) } catch { /* ei ole kriitiline */ }
      }
    }
  }

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <button onClick={toggle} title="Teavitused"
        className="relative flex items-center px-2.5 py-1.5 rounded-lg text-white/90 hover:bg-white/10 transition-colors">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed left-2 right-2 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-[340px] max-h-[70vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-black/10 z-50">
          <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Teavitused</p>
            <Link to="/automatsioonid" onClick={() => setOpen(false)} className="text-xs text-[#2a6db0] hover:underline">Automatsioonid →</Link>
          </div>
          {items.length === 0 && <p className="px-4 py-6 text-sm text-gray-400 text-center">Teavitusi pole.</p>}
          <ul className="divide-y divide-gray-100">
            {items.map(n => (
              <li key={n.id}>
                <button onClick={() => { setOpen(false); if (n.link) navigate(n.link) }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  {n.body && <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">{n.body}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">{String(n.createdAt).slice(0, 16).replace('T', ' ')}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
