import { useState, useEffect } from 'react'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'

const WEEKDAYS = ['', 'esmaspäeval', 'teisipäeval', 'kolmapäeval', 'neljapäeval', 'reedel', 'laupäeval', 'pühapäeval']

function describe(a) {
  const c = a.config || {}
  const where = a.className ? `klassis ${a.className}` : 'kõigis minu klassides'
  if (a.type === 'grade_drop') return `Kui õpilase viimase 5 hinde keskmine on alla ${c.threshold}% ${where}, anna mulle teada.`
  if (a.type === 'deadline_reminder') return `${c.daysBefore === 1 ? 'Päev' : c.daysBefore + ' päeva'} enne tähtaega (${where}) tuleta mulle meelde${c.announce ? ' ja saada ka klassile teade' : ''}.`
  if (a.type === 'weekly_summary') return `Igal ${WEEKDAYS[c.weekday] || 'reedel'} koosta AI abil nädalakokkuvõte (${where}).`
  if (a.type === 'no_grades') return `Kui ${where} pole ${c.days} päeva hindeid lisatud, tuleta meelde.`
  return a.label
}

export default function AutomationsPage() {
  const { classes, loading: classesLoading } = useClasses()
  const [types, setTypes] = useState([])
  const [automations, setAutomations] = useState([])
  const [notes, setNotes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState('')
  const [classId, setClassId] = useState('')
  const [cfg, setCfg] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    if (classesLoading) return
    load()
  }, [classesLoading])

  const load = async () => {
    try {
      const t = await apiCall('/api/automations/types')
      setTypes(t.types || [])
      const a = await apiCall('/api/automations')
      setAutomations(a.automations || [])
      const n = await apiCall('/api/notifications?limit=15')
      setNotes(n.notifications || [])
    } catch (err) { setError(err.message) }
  }

  if (classesLoading) return <div>Laadin...</div>

  const pick = (t) => { setType(t.value); setCfg({ ...t.defaults }) }

  const create = async () => {
    if (!type) { setError('Vali automatsiooni tüüp.'); return }
    setError(''); setNotice('')
    try {
      await apiCall('/api/automations', { method: 'POST', body: JSON.stringify({ type, classId: classId || null, config: cfg }) })
      setShowForm(false); setType(''); setClassId(''); setCfg({})
      await load()
    } catch (err) { setError(err.message) }
  }

  const toggle = async (a) => {
    try { await apiCall(`/api/automations/${a.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !a.enabled }) }); await load() }
    catch (err) { setError(err.message) }
  }

  const remove = async (a) => {
    if (!window.confirm('Kustutan selle automatsiooni?')) return
    try { await apiCall(`/api/automations/${a.id}`, { method: 'DELETE' }); await load() }
    catch (err) { setError(err.message) }
  }

  const runNow = async (a) => {
    setBusyId(a.id); setError(''); setNotice('')
    try {
      const r = await apiCall(`/api/automations/${a.id}/run`, { method: 'POST' })
      setNotice(r.created ? `Käivitatud: ${r.created} uut teavitust (vaata kellaikoonilt).` : 'Käivitatud: praegu pole midagi teavitada.')
      await load()
    } catch (err) { setError(err.message) }
    finally { setBusyId(null) }
  }

  const selected = types.find(t => t.value === type)
  const input = 'border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2a6db0]'

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automatsioonid</h1>
          <p className="text-gray-500 text-sm">Sea reegel üks kord, server jälgib seda sinu eest ja annab teada kellaikoonil. Reegleid kontrollitakse iga 10 minuti tagant.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="bg-[#1c3556] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#2a4a7a] flex-shrink-0">
          {showForm ? 'Sulge' : '+ Uus automatsioon'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">{notice}</div>}

      {showForm && (
        <div className="bg-white rounded-lg border border-black/10 p-5 mb-5">
          <h2 className="text-base font-semibold text-gray-900 mb-3">1. Mis juhtub?</h2>
          <div className="grid md:grid-cols-2 gap-3 mb-5">
            {types.map(t => (
              <button key={t.value} onClick={() => pick(t)}
                className={`text-left rounded-lg border p-3 ${type === t.value ? 'border-[#2a6db0] bg-[#f4f8fd]' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-500 mt-1">{t.description}</p>
              </button>
            ))}
          </div>

          {selected && (
            <>
              <h2 className="text-base font-semibold text-gray-900 mb-3">2. Täpsusta</h2>
              <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-gray-700">
                <label>Klass
                  <select value={classId} onChange={e => setClassId(e.target.value)} className={input + ' ml-2'}>
                    <option value="">Kõik minu klassid</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}
                  </select>
                </label>
                {type === 'grade_drop' && (
                  <label>Piir (%)
                    <input type="number" min={10} max={95} value={cfg.threshold} onChange={e => setCfg({ ...cfg, threshold: Number(e.target.value) })} className={input + ' ml-2 w-24'} />
                  </label>
                )}
                {type === 'deadline_reminder' && (
                  <>
                    <label>Mitu päeva enne
                      <select value={cfg.daysBefore} onChange={e => setCfg({ ...cfg, daysBefore: Number(e.target.value) })} className={input + ' ml-2'}>
                        <option value={1}>1 päev</option><option value={2}>2 päeva</option><option value={3}>3 päeva</option><option value={7}>7 päeva</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!cfg.announce} onChange={e => setCfg({ ...cfg, announce: e.target.checked })} className="accent-[#7F77DD]" />
                      Saada ka klassile teade (Suhtlus)
                    </label>
                  </>
                )}
                {type === 'weekly_summary' && (
                  <label>Nädalapäev
                    <select value={cfg.weekday} onChange={e => setCfg({ ...cfg, weekday: Number(e.target.value) })} className={input + ' ml-2'}>
                      {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}
                    </select>
                  </label>
                )}
                {type === 'no_grades' && (
                  <label>Päeva ilma hinneteta
                    <input type="number" min={3} max={90} value={cfg.days} onChange={e => setCfg({ ...cfg, days: Number(e.target.value) })} className={input + ' ml-2 w-24'} />
                  </label>
                )}
              </div>
              <button onClick={create} className="bg-[#7F77DD] text-white text-sm rounded-lg px-5 py-2 hover:bg-[#534AB7]">Loo automatsioon</button>
            </>
          )}
        </div>
      )}

      <h2 className="text-base font-semibold text-gray-900 mb-2">Minu automatsioonid</h2>
      {automations.length === 0 && !showForm && (
        <div className="bg-white rounded-lg border border-black/10 p-6 text-sm text-gray-500 mb-5">
          Automatsioone veel pole. Vajuta "+ Uus automatsioon", näiteks "Tähtaja meeldetuletus" tuletab ise kodutööd klassile meelde.
        </div>
      )}
      <div className="space-y-3 mb-8">
        {automations.map(a => (
          <div key={a.id} className={`bg-white rounded-lg border p-4 ${a.enabled ? 'border-black/10' : 'border-black/5 opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{a.label}</p>
                <p className="text-sm text-gray-600 mt-0.5">{describe(a)}</p>
                <p className="text-[11px] text-gray-400 mt-1">{a.lastRunAt ? `Viimati kontrollitud ${String(a.lastRunAt).slice(0, 16)}` : 'Pole veel kontrollitud'}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => runNow(a)} disabled={busyId === a.id}
                  className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  {busyId === a.id ? 'Käivitan...' : 'Käivita nüüd'}
                </button>
                <button onClick={() => toggle(a)} role="switch" aria-checked={a.enabled} title={a.enabled ? 'Lülita välja' : 'Lülita sisse'}
                  className={`w-10 h-6 rounded-full relative transition-colors ${a.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${a.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
                <button onClick={() => remove(a)} className="text-xs text-gray-400 hover:text-red-600">Kustuta</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-base font-semibold text-gray-900 mb-2">Viimased teavitused</h2>
      {notes.length === 0 && <p className="text-sm text-gray-400">Teavitusi pole veel olnud.</p>}
      <ul className="bg-white rounded-lg border border-black/10 divide-y divide-gray-100">
        {notes.map(n => (
          <li key={n.id} className="px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{n.title}</p>
            {n.body && <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{n.body}</p>}
            <p className="text-[10px] text-gray-400 mt-1">{String(n.createdAt).slice(0, 16).replace('T', ' ')}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
