import { useState, useEffect } from 'react'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'

const RISK_COLORS = {
  red: { ring: '#E24B4A', bg: '#FCEBEB', text: '#A32D2D' },
  yellow: { ring: '#EF9F27', bg: '#FAEEDA', text: '#854F0B' },
  green: { ring: '#639922', bg: '#EAF3DE', text: '#3B6D11' },
  blue: { ring: '#378ADD', bg: '#E6F1FB', text: '#185FA5' },
}

const DAY_COLORS = {
  present: '#639922',
  late: '#EF9F27',
  absent: '#E24B4A',
  excused: '#2E9C8E',
}

const KIND_META = {
  positive: { label: 'Positiivne', variant: 'green' },
  concern: { label: 'Muremärkus', variant: 'yellow' },
  incident: { label: 'Juhtum', variant: 'red' },
}

const formatEt = iso => {
  const d = new Date(`${iso}T12:00:00`)
  return `${d.getDate()}.${d.getMonth() + 1}.`
}

/**
 * Kohalolek, käitumine ja riskiskoor õpilase detaillehel.
 *
 * Riskiskoor EI OLE must kast: number on alati koos "Miks?" nupuga, mis näitab
 * täpselt need põhjused, millest see kokku tuli (RULE A2).
 */
export default function AttendanceBehaviorPanel({ studentId }) {
  const [data, setData] = useState(null)
  const [notes, setNotes] = useState([])
  const [showWhy, setShowWhy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    const load = async () => {
      try {
        const d = await apiCall(`/api/attendance/summary/${studentId}`)
        if (cancelled) return
        setData(d)
        const n = await apiCall(`/api/attendance/behavior/student/${studentId}`)
        if (cancelled) return
        setNotes(n.notes || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [studentId])

  if (error) {
    return <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg">{error}</div>
  }
  if (!data) return <p className="text-sm text-gray-400">Laadin kohaloleku andmeid...</p>

  const { summary, series, risk } = data
  const colors = RISK_COLORS[risk.level] || RISK_COLORS.blue
  const positives = notes.filter(n => n.kind === 'positive').length
  const negatives = notes.length - positives

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-black/10 p-5">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">Kohalolek (30 päeva)</p>
          <p className="text-3xl font-bold text-gray-900">
            {summary.attendedPercent === null ? '—' : `${summary.attendedPercent}%`}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {summary.absent} puudumist · {summary.late} hilinemist
            {summary.excused > 0 ? ` · ${summary.excused} vabastatud` : ''}
          </p>
          <div className="flex gap-[2px] mt-3 h-8 items-end">
            {series.length === 0 && <span className="text-[11px] text-gray-300">Andmeid pole</span>}
            {series.map(d => (
              <div key={d.date} title={`${formatEt(d.date)} · ${d.status}`}
                className="flex-1 min-w-[3px] rounded-sm"
                style={{
                  backgroundColor: DAY_COLORS[d.status] || '#ddd',
                  height: d.status === 'present' ? '100%' : d.status === 'late' ? '70%' : '45%',
                }} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-black/10 p-5">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">Käitumine (viimased)</p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-3xl font-bold text-[#3B6D11]">{positives}</span>
            <span className="text-lg text-gray-300">/</span>
            <span className="text-3xl font-bold text-[#A32D2D]">{negatives}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">positiivset · negatiivset</p>
        </div>

        <div className="bg-white rounded-xl border border-black/10 p-5">
          <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">Riskitase</p>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: colors.bg, border: `3px solid ${colors.ring}` }}>
              <span className="text-lg font-bold" style={{ color: colors.text }}>
                {risk.riskScore}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: colors.text }}>{risk.riskLabel}</p>
              <button onClick={() => setShowWhy(true)}
                className="text-xs text-[#534AB7] hover:underline">Miks?</button>
            </div>
          </div>
        </div>
      </div>

      {showWhy && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"
          onClick={() => setShowWhy(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Miks see riskitase?</h3>
            <p className="text-xs text-gray-400 mb-4">
              Skoor arvutatakse kohalolekust, käitumisest ja hinnetest. Ükski osa ei ole peidetud.
            </p>
            {risk.reasons?.length ? (
              <ul className="space-y-2 mb-4">
                {risk.reasons.map((r, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-gray-300">·</span>{r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 mb-4">
                Ühtegi hoiatusmärki ei leitud — tulemused, kohalolek ja käitumine on korras.
              </p>
            )}
            <div className="bg-[#f5f5f3] rounded-lg p-3 mb-4">
              <p className="text-[11px] text-gray-500">
                Hinded: {risk.components?.course} · Kohalolek: {risk.components?.attendance} ·
                Käitumine: {risk.components?.behavior}
              </p>
            </div>
            <p className="text-[11px] text-gray-400 mb-4">
              See on tööriist õpetajale, mitte hinnang lapsele. Otsuse teed sina.
            </p>
            <button onClick={() => setShowWhy(false)}
              className="w-full bg-[#7F77DD] text-white text-sm rounded-lg py-2.5 hover:bg-[#534AB7]">
              Sulge
            </button>
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Käitumise ajalugu</h3>
          <div className="space-y-2">
            {notes.map(n => {
              const meta = KIND_META[n.kind] || { label: n.kind, variant: 'blue' }
              return (
                <div key={n.id}
                  className={`bg-white rounded-xl border border-black/10 p-3 border-l-[3px] ${
                    n.sentiment === 'positive' ? 'border-l-[#639922]' : 'border-l-[#E24B4A]'
                  }`}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {n.category && <Badge variant="purple">{n.category}</Badge>}
                    <span className="text-[11px] text-gray-400 ml-auto">{formatEt(n.date)}</span>
                  </div>
                  <p className="text-[13px] text-gray-600">{n.note}</p>
                  {n.teacherName && <p className="text-[11px] text-gray-400 mt-1">{n.teacherName}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
