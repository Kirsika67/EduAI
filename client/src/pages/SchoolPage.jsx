import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'

const RISK_META = [
  { key: 'green', label: 'Hea tase', color: '#639922', bg: '#EAF3DE' },
  { key: 'blue', label: 'Stabiilne', color: '#378ADD', bg: '#E6F1FB' },
  { key: 'yellow', label: 'Jälgi', color: '#EF9F27', bg: '#FAEEDA' },
  { key: 'red', label: 'Kõrge risk', color: '#E24B4A', bg: '#FCEBEB' },
]

function Stat({ label, value, hint }) {
  return (
    <div className="bg-white rounded-xl border border-black/10 p-5">
      <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function SchoolPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [summaryNote, setSummaryNote] = useState('')
  const [summarising, setSummarising] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const d = await apiCall('/api/school/overview')
        if (!cancelled) setData(d)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const askSummary = async () => {
    setSummarising(true)
    setSummaryNote('')
    setSummary(null)
    try {
      const r = await apiCall('/api/school/ai-summary', { method: 'POST', body: JSON.stringify({}) })
      if (r.summary) setSummary(r.summary)
      if (r.fallback) setSummaryNote(r.fallback)
    } catch (err) {
      setSummaryNote(err.message)
    } finally {
      setSummarising(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Laadin...</div>
  if (error) {
    return <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg max-w-lg">{error}</div>
  }
  if (!data) return null

  const riskTotal = RISK_META.reduce((sum, r) => sum + (data.risk[r.key] || 0), 0)

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{data.school?.name || 'Kool'}</h1>
      <p className="text-gray-500 text-sm mb-5">Kogu kooli ülevaade</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Stat label="Õpilasi" value={data.totals.students} hint={`${data.totals.classes} klassi`} />
        <Stat label="Koolitöötajaid" value={data.totals.staff} hint={`${data.totals.families} pere kontot`} />
        <Stat label="Keskmine kohalolek"
          value={data.attendance.attendedPercent === null ? '—' : `${data.attendance.attendedPercent}%`}
          hint="viimased 30 päeva" />
        <Stat label="Kroonilisi puudujaid" value={data.attendance.chronicCount} hint="20%+ puudumisi" />
      </div>

      <div className="bg-white rounded-xl border border-black/10 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Riskijaotus</h2>
        {riskTotal === 0 ? (
          <p className="text-sm text-gray-400">Andmeid pole veel piisavalt.</p>
        ) : (
          <>
            <div className="flex h-3 rounded-full overflow-hidden mb-3">
              {RISK_META.map(r => {
                const n = data.risk[r.key] || 0
                if (!n) return null
                return (
                  <div key={r.key} title={`${r.label}: ${n}`}
                    style={{ width: `${(n / riskTotal) * 100}%`, backgroundColor: r.color }} />
                )
              })}
            </div>
            <div className="flex flex-wrap gap-4">
              {RISK_META.map(r => (
                <div key={r.key} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="text-xs text-gray-500">{r.label}</span>
                  <span className="text-xs font-semibold text-gray-900">{data.risk[r.key] || 0}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-black/10 p-5 mb-5">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI koondhinnang</h2>
            <p className="text-xs text-gray-400">
              Saadetakse ainult koondarvud — ühtegi nime ega üksikandmeid.
            </p>
          </div>
          <button onClick={askSummary} disabled={summarising}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7] disabled:opacity-40 whitespace-nowrap">
            {summarising ? 'Analüüsin...' : 'Koosta kokkuvõte'}
          </button>
        </div>
        {summary && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>}
        {summaryNote && <p className="text-xs text-gray-400">{summaryNote}</p>}
        {!summary && !summaryNote && (
          <p className="text-sm text-gray-400">Vajuta nuppu, et saada 3–4 lauseline hinnang.</p>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-900 mb-2">Klassid</h2>
      <p className="text-xs text-gray-400 mb-3">
        Tähestiku järjekorras, mitte tulemuse järgi — see ei ole õpetajate edetabel.
        Alla {data.minClassSizeForStats} õpilasega klassides on numbrid peidetud, sest need
        oleksid isikustatavad.
      </p>
      <div className="bg-white rounded-xl border border-black/10 overflow-hidden mb-6">
        <div className="grid grid-cols-[1.4fr_1fr_60px_80px_60px] gap-2 px-4 py-2 border-b border-black/5 text-[11px] text-gray-400 uppercase tracking-wider">
          <span>Klass</span><span>Õpetaja</span><span>Õpil.</span><span>Kohal</span><span>Risk</span>
        </div>
        {data.classes.map(c => (
          <div key={c.classId}
            className="grid grid-cols-[1.4fr_1fr_60px_80px_60px] gap-2 px-4 py-3 border-b border-black/5 last:border-0 items-center">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
              <p className="text-[11px] text-gray-400 truncate">{c.subject}</p>
            </div>
            <span className="text-[13px] text-gray-500 truncate">{c.teacherName}</span>
            <span className="text-[13px] text-gray-500">{c.students}</span>
            <span className="text-[13px] text-gray-700">
              {c.hidden ? <span className="text-gray-300">peidetud</span>
                : c.attendedPercent === null ? '—' : `${c.attendedPercent}%`}
            </span>
            <span>
              {c.hidden ? '' : c.red > 0
                ? <Badge variant="red">{c.red}</Badge>
                : c.yellow > 0
                  ? <Badge variant="yellow">{c.yellow}</Badge>
                  : <span className="text-[13px] text-gray-300">—</span>}
            </span>
          </div>
        ))}
        {!data.classes.length && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">Klasse pole veel loodud.</p>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-900 mb-2">
        Vajavad tähelepanu ({data.needsAttention.length})
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Kõrge riskiga või krooniliselt puuduvad õpilased. Nimekiri on tugimeetmete
        planeerimiseks, mitte hinnang lapsele.
      </p>
      <div className="space-y-2">
        {data.needsAttention.map(s => (
          <button key={s.studentId} onClick={() => navigate(`/opilased/${s.studentId}`)}
            className="w-full text-left bg-white rounded-xl border border-black/10 p-4 hover:bg-gray-50 flex items-center gap-3 flex-wrap">
            <span className="text-[13px] font-semibold text-gray-900">{s.studentName}</span>
            <span className="text-[11px] text-gray-400">{s.className}</span>
            {s.level === 'red' && <Badge variant="red">{s.riskLabel}</Badge>}
            {s.isChronic && <Badge variant="yellow">Krooniline puudumine</Badge>}
            <span className="text-[11px] text-gray-400 ml-auto">
              {s.attendedPercent === null ? '' : `kohal ${s.attendedPercent}%`}
            </span>
          </button>
        ))}
        {!data.needsAttention.length && (
          <div className="bg-white rounded-xl border border-black/10 p-8 text-center text-sm text-gray-400">
            Praegu ei ole ühtegi õpilast kõrge riski või kroonilise puudumise tasemel.
          </div>
        )}
      </div>
    </div>
  )
}
