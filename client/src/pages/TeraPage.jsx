import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useClasses } from '../context/ClassContext'

export default function TeraPage() {
  const { classes, selectedClassId, setSelectedClassId, loading: classesLoading } = useClasses()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  if (classesLoading) return <div>Laadin...</div>

  const q = query.trim().toLowerCase()
  const shown = classes.filter(c => !q || `${c.name} ${c.subject}`.toLowerCase().includes(q))

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Tera</h1>
      <div className="grid lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 bg-white rounded-lg border border-black/10 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Sinu kursused</h2>
          <input
            type="text"
            placeholder="Otsi kursust nime või õppeaine järgi"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full border-2 border-[#9ab7e0] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2a6db0] mb-3"
          />
          {classes.length === 0 && <p className="text-sm text-gray-500">Ühtegi klassi pole lisatud. Lisa klass paremalt ülevalt klassimenüüst.</p>}
          {classes.length > 0 && shown.length === 0 && <p className="text-sm text-gray-500">Otsingule ei vasta ükski kursus.</p>}
          <ul className="divide-y divide-gray-100">
            {shown.map(c => (
              <li key={c.id}>
                <button
                  onClick={() => { setSelectedClassId(Number(c.id)); navigate('/ulevaade') }}
                  className="w-full text-left py-3 flex items-center justify-between hover:bg-gray-50 px-2 rounded"
                >
                  <span>
                    <span className="block text-base font-semibold text-[#2a6db0]">{c.name} · {c.subject}</span>
                    <span className="block text-xs text-gray-500">{c.student_count ?? 0} õpilast</span>
                  </span>
                  {Number(c.id) === Number(selectedClassId) && (
                    <span className="text-xs bg-[#EEEDFE] text-[#534AB7] rounded px-2 py-0.5">Valitud</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-lg border border-black/10 p-5 h-fit">
          <h2 className="text-base font-semibold text-gray-900 mb-3">AI-tööriistad</h2>
          <ul className="space-y-2 text-sm">
            <li><Link to="/materjalid" className="text-[#2a6db0] hover:underline">Õppematerjalid</Link></li>
            <li><Link to="/planeerimine" className="text-[#2a6db0] hover:underline">Planeerimine</Link></li>
            <li><Link to="/tagasiside" className="text-[#2a6db0] hover:underline">Tagasiside</Link></li>
            <li><Link to="/esseede-hindamine" className="text-[#2a6db0] hover:underline">Esseede hindamine</Link></li>
          </ul>
        </section>
      </div>
    </div>
  )
}
