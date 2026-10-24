import { useState, useEffect } from 'react'
import { apiCall } from '../api/client'

const FIELDS = [
  ['streakCount', 'Järjestikuseid nõrku hindeid', 'tk', 'Nii mitu nõrka hinnet järjest annab kursuse riski "kõrge".'],
  ['streakBelow', 'Nõrk hinne on alla', '%', 'Hinne, mis loetakse nõrgaks.'],
  ['courseAvgBelow', 'Kursuse keskmine alla', '%', 'Madal keskmine annab riski "keskmine".'],
  ['trendChange', 'Keskmise muutus kuuga', '%-punkti', 'Langus (või tõus) viimase 30 päeva vs eelneva 30 päeva keskmises.'],
  ['windowDays', 'Kohaloleku ja käitumise vaatluspeaeg', 'päeva', 'Kui kaua tagasi puudumisi ja märkeid arvestatakse.'],
  ['absencesMedium', 'Puudumisi: tugi vajalik alates', 'tk', 'Selle arvu puudumisega muutub kohalolek "keskmiseks".'],
  ['absencesHigh', 'Puudumisi: tähelepanu alates', 'tk', 'Selle arvu puudumisega muutub kohalolek "kõrgeks".'],
  ['latesMedium', 'Hilinemisi: tugi vajalik alates', 'tk', 'Selle arvu hilinemisega muutub kohalolek "keskmiseks".'],
  ['concernsMedium', 'Muremärkusi: tugi vajalik alates', 'tk', 'Selle arvu muremärkusega muutub käitumine "keskmiseks".'],
]

export default function RiskSettings() {
  const [data, setData] = useState(null)
  const [values, setValues] = useState({})
  const [summary, setSummary] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  /** Järjest, mitte Promise.all — projekti kõva reegel. */
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const s = await apiCall('/api/risk/settings')
        if (cancelled) return
        setData(s)
        setValues(s.thresholds)
        const sum = await apiCall('/api/risk/feedback/summary')
        if (!cancelled) setSummary(sum)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const apply = (next, text) => {
    setData(next)
    setValues(next.thresholds)
    setMessage(text)
  }

  const save = async () => {
    setSaving(true); setError(''); setMessage('')
    try {
      const next = await apiCall('/api/risk/settings', {
        method: 'PUT',
        body: JSON.stringify({ thresholds: values }),
      })
      apply(next, 'Hoiatuspiirid salvestatud. Uued piirid kehtivad kohe kõigil õpilaste lehtedel.')
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const reset = async () => {
    if (!window.confirm('Taastan algsed piirid?')) return
    setSaving(true); setError(''); setMessage('')
    try {
      const next = await apiCall('/api/risk/settings', { method: 'DELETE' })
      apply(next, 'Algsed piirid taastatud.')
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  if (!data) {
    return error
      ? <p className="text-sm text-red-600">{error}</p>
      : <p className="text-sm text-gray-400">Laadin...</p>
  }

  const changed = FIELDS.some(([k]) => Number(values[k]) !== Number(data.thresholds[k]))

  return (
    <div className="bg-white rounded-xl border border-black/10 p-5 mb-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Varajase hoiatuse piirid</h2>
      <p className="text-xs text-gray-400 mb-4">
        Need piirid on algne soovitus ega ole teaduslikult kontrollitud — kohanda neid oma klassi järgi.
        Õpilase lehel on alati näha, milline piir hoiatuse käivitas.
        {data.custom ? ' Kasutusel on sinu enda piirid.' : ' Praegu kasutad algseid piire.'}
      </p>

      {message && <div className="bg-[#EAF3DE] text-[#3B6D11] text-sm px-3 py-2 rounded-lg mb-3">{message}</div>}
      {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}

      <div className="space-y-3">
        {FIELDS.map(([key, label, unit, hint]) => {
          const [min, max] = data.limits[key]
          return (
            <div key={key}>
              <label className="flex items-center gap-3">
                <span className="flex-1 text-sm text-gray-800">{label}</span>
                <input type="number" min={min} max={max} value={values[key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:border-[#7F77DD]" />
                <span className="w-16 text-xs text-gray-400">{unit}</span>
              </label>
              <p className="text-[11px] text-gray-400">{hint} Vahemik {min}–{max}, algne {data.defaults[key]}.</p>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-4">
        <button onClick={save} disabled={saving || !changed}
          className="bg-[#1C3556] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#2A4A7A] disabled:opacity-40">
          {saving ? 'Salvestan...' : 'Salvesta piirid'}
        </button>
        {data.custom && (
          <button onClick={reset} disabled={saving} className="text-sm text-gray-500 hover:underline">
            Taasta algsed
          </button>
        )}
      </div>

      <div className="border-t border-black/10 mt-5 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Kui täpsed on hoiatused?</h3>
        {summary?.total
          ? <>
              <p className="text-sm text-gray-700">
                Sinu hinnangute järgi oli {summary.flagged.was_risk} hoiatust {summary.total}-st õigustatud
                ({summary.precision}%).
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Loetud on punased ja kollased hoiatused, mille kohta oled vajutanud "Oli risk" või "Ei olnud risk".
                Vähem kui ~20 hinnangu põhjal ei maksa järeldusi teha.
              </p>
            </>
          : <p className="text-sm text-gray-400">
              Hinnanguid veel pole. Vajuta õpilase lehel hoiatuse all "Oli risk" või "Ei olnud risk".
            </p>}
      </div>
    </div>
  )
}
