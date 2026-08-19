import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import { ROLES, isStaff } from '../constants/roles'
import TimeField from '../components/TimeField'

const todayIso = () => new Date().toISOString().slice(0, 10)
const shift = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const formatEt = iso => {
  const d = new Date(`${iso}T12:00:00`)
  return `${d.getDate()}.${d.getMonth() + 1}.`
}

/**
 * Lapsevanema päev. Õpetaja loob ajapesad, vanem broneerib vaba aja.
 * Vanem näeb teiste broneeringuid ainult märkega "Broneeritud" — nimesid näeb
 * ainult õpetaja, et vanemate andmed ei leviks omavahel.
 */
export default function ParentMeetingsPage() {
  const { role, teacher } = useAuth()
  const { selectedClassId, loading: classesLoading } = useClasses()
  const staff = isStaff(role)
  const isParent = role === ROLES.PARENT

  const [slots, setSlots] = useState([])
  const [from, setFrom] = useState(todayIso())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ date: todayIso(), startTime: '15:00', durationMinutes: 15, count: 8 })

  const to = shift(from, 30)

  useEffect(() => {
    if (classesLoading) return
    load()
  }, [classesLoading, from, selectedClassId])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiCall(`/api/parent-meetings?from=${from}&to=${to}`)
      setSlots(data.slots || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createSlots = async () => {
    setError(''); setMessage('')
    try {
      const data = await apiCall('/api/parent-meetings/slots', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          durationMinutes: Number(form.durationMinutes),
          count: Number(form.count),
          classId: selectedClassId ? Number(selectedClassId) : undefined,
        }),
      })
      setMessage(`Loodud ${data.created} ajapesa.`)
      await load()
    } catch (err) { setError(err.message) }
  }

  const book = async (slotId) => {
    setError(''); setMessage('')
    try {
      await apiCall(`/api/parent-meetings/slots/${slotId}/book`, { method: 'POST', body: JSON.stringify({}) })
      setMessage('Aeg broneeritud.')
      await load()
    } catch (err) { setError(err.message) }
  }

  const cancel = async (slotId) => {
    setError(''); setMessage('')
    try {
      await apiCall(`/api/parent-meetings/slots/${slotId}/book`, { method: 'DELETE' })
      setMessage('Broneering tühistatud.')
      await load()
    } catch (err) { setError(err.message) }
  }

  const removeSlot = async (slotId) => {
    setError('')
    try {
      await apiCall(`/api/parent-meetings/slots/${slotId}`, { method: 'DELETE' })
      await load()
    } catch (err) { setError(err.message) }
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  const byDate = slots.reduce((acc, s) => {
    (acc[s.date] = acc[s.date] || []).push(s)
    return acc
  }, {})
  const dates = Object.keys(byDate).sort()

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Lapsevanema päev</h1>
        {staff && (
          <Link to="/tunniplaan" className="text-sm text-[#534AB7] hover:underline">← Tunniplaan</Link>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-6">
        {staff ? 'Loo ajapesad, vanemad broneerivad ise vaba aja.' : 'Vali endale sobiv aeg õpetajaga kohtumiseks.'}
      </p>

      {message && <div className="bg-[#EAF3DE] text-[#3B6D11] text-sm px-4 py-2.5 rounded-lg mb-4">{message}</div>}
      {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>}

      {staff && (
        <div className="bg-white rounded-xl border border-black/10 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Loo ajapesad</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kuupäev</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Algus</label>
              <TimeField value={form.startTime} onChange={v => setForm({ ...form, startTime: v })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kestus (min)</label>
              <input type="number" min="5" max="120" value={form.durationMinutes}
                onChange={e => setForm({ ...form, durationMinutes: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mitu pesa</label>
              <input type="number" min="1" max="40" value={form.count}
                onChange={e => setForm({ ...form, count: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
            </div>
          </div>
          <button onClick={createSlots}
            className="mt-3 bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
            Loo ajapesad
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <label className="text-xs text-gray-500">Alates</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#7F77DD]" />
      </div>

      {loading && <p className="text-sm text-gray-400">Laadin...</p>}
      {!loading && !dates.length && (
        <div className="bg-white rounded-xl border border-black/10 p-8 text-center text-sm text-gray-400">
          {staff ? 'Ajapesi pole veel loodud.' : 'Vabu aegu pole praegu välja kuulutatud.'}
        </div>
      )}

      <div className="space-y-5">
        {dates.map(date => (
          <div key={date}>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{formatEt(date)}</p>
            <div className="flex flex-wrap gap-2">
              {byDate[date].map(slot => {
                const free = !slot.booked
                const mine = slot.bookedByMe
                return (
                  <div key={slot.id}
                    className={`rounded-lg border px-3 py-2 text-sm min-w-[130px] ${
                      mine
                        ? 'bg-[#EEEDFE] border-[#AFA9EC] text-[#534AB7]'
                        : free
                          ? 'bg-[#EAF3DE] border-[#639922]/40 text-[#3B6D11]'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}>
                    <div className="font-medium">{slot.startTime}</div>
                    <div className="text-[11px] opacity-80">
                      {slot.durationMinutes} min
                      {staff && slot.teacherName ? ` · ${slot.teacherName}` : ''}
                    </div>
                    {!free && (
                      <div className="text-[11px] mt-0.5">
                        {slot.bookedByName
                          ? `${slot.bookedByName}${slot.studentName ? ` (${slot.studentName})` : ''}`
                          : 'Broneeritud'}
                      </div>
                    )}
                    {isParent && free && (
                      <button onClick={() => book(slot.id)}
                        className="mt-1.5 w-full bg-[#639922] text-white text-xs rounded px-2 py-1 hover:bg-[#3B6D11]">
                        Broneeri
                      </button>
                    )}
                    {mine && (
                      <button onClick={() => cancel(slot.id)}
                        className="mt-1.5 w-full border border-[#AFA9EC] text-xs rounded px-2 py-1 hover:bg-white">
                        Tühista
                      </button>
                    )}
                    {staff && free && (
                      <button onClick={() => removeSlot(slot.id)}
                        className="mt-1.5 w-full text-[11px] text-gray-400 hover:text-[#A32D2D]">
                        Kustuta
                      </button>
                    )}
                    {staff && !free && (
                      <button onClick={() => cancel(slot.id)}
                        className="mt-1.5 w-full text-[11px] text-gray-400 hover:text-[#A32D2D]">
                        Vabasta aeg
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {isParent && teacher?.children?.length > 1 && (
        <p className="text-[11px] text-gray-400 mt-6">
          Broneering läheb lapsele {teacher.children[0].name}. Mitme lapse valik lisandub hiljem.
        </p>
      )}
    </div>
  )
}
