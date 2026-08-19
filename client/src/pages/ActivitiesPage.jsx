import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'
import { isStaff } from '../constants/roles'

const DAYS = ['', 'Esmaspäev', 'Teisipäev', 'Kolmapäev', 'Neljapäev', 'Reede', 'Laupäev', 'Pühapäev']

export default function ActivitiesPage() {
  const { role } = useAuth()
  const staff = isStaff(role)

  const [activities, setActivities] = useState([])
  const [myStudents, setMyStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', dayOfWeek: '', startTime: '', location: '', maxParticipants: '',
  })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const d = await apiCall('/api/activities')
      setActivities(d.activities || [])
      setMyStudents(d.myStudents || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const create = async () => {
    if (form.name.trim().length < 2) { setError('Sisesta ringi nimi'); return }
    setError(''); setMessage('')
    try {
      await apiCall('/api/activities', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          dayOfWeek: form.dayOfWeek ? Number(form.dayOfWeek) : undefined,
          maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : undefined,
        }),
      })
      setForm({ name: '', description: '', dayOfWeek: '', startTime: '', location: '', maxParticipants: '' })
      setCreating(false)
      await load()
    } catch (err) { setError(err.message) }
  }

  const join = async (activityId, studentId) => {
    setError(''); setMessage('')
    try {
      await apiCall(`/api/activities/${activityId}/participants`, {
        method: 'POST',
        body: JSON.stringify({ studentId: Number(studentId) }),
      })
      setMessage('Registreeritud.')
      await load()
    } catch (err) { setError(err.message) }
  }

  const leave = async (activityId, studentId) => {
    setError(''); setMessage('')
    try {
      await apiCall(`/api/activities/${activityId}/participants/${studentId}`, { method: 'DELETE' })
      setMessage('Registreering tühistatud.')
      await load()
    } catch (err) { setError(err.message) }
  }

  const toggleOpen = async (activity) => {
    try {
      await apiCall(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isOpen: !activity.isOpen }),
      })
      await load()
    } catch (err) { setError(err.message) }
  }

  const remove = async (id) => {
    try {
      await apiCall(`/api/activities/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Huviringid</h1>
        {staff && (
          <button onClick={() => setCreating(!creating)}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
            {creating ? 'Sulge' : '+ Lisa ring'}
          </button>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-5">
        {staff ? 'Kooli ringid ja osalejad.' : 'Vali lapsele ring — koht kinnitub kohe.'}
      </p>

      {message && <div className="bg-[#EAF3DE] text-[#3B6D11] text-sm px-4 py-2.5 rounded-lg mb-4">{message}</div>}
      {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>}

      {creating && (
        <div className="bg-white rounded-xl border border-black/10 p-5 mb-5">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Ringi nimi (nt Robootikaring)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] mb-2" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            rows={2} placeholder="Kirjeldus — kellele ja millest?"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] resize-y mb-2" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })}
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs bg-white outline-none">
              <option value="">Päev…</option>
              {DAYS.slice(1).map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}
            </select>
            <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none" />
            <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="Ruum"
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none" />
            <input type="number" min="1" value={form.maxParticipants}
              onChange={e => setForm({ ...form, maxParticipants: e.target.value })}
              placeholder="Kohti"
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs outline-none" />
          </div>
          <button onClick={create}
            className="mt-3 bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]">
            Loo ring
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">Laadin...</p>}
      {!loading && !activities.length && (
        <div className="bg-white rounded-xl border border-black/10 p-8 text-center text-sm text-gray-400">
          {staff ? 'Ringe pole veel loodud.' : 'Kool ei ole veel ringe välja kuulutanud.'}
        </div>
      )}

      <div className="space-y-3">
        {activities.map(a => (
          <div key={a.id} className={`bg-white rounded-xl border p-5 ${
            a.isOpen ? 'border-black/10' : 'border-black/10 opacity-70'
          }`}>
            <div className="flex items-start gap-2 mb-1 flex-wrap">
              <h2 className="text-base font-bold text-gray-900">{a.name}</h2>
              {!a.isOpen && <Badge variant="yellow">Registreerimine suletud</Badge>}
              {a.isFull && <Badge variant="red">Täis</Badge>}
              {staff && (
                <div className="ml-auto flex gap-2">
                  <button onClick={() => toggleOpen(a)} className="text-xs text-[#534AB7] hover:underline">
                    {a.isOpen ? 'Sulge registreerimine' : 'Ava registreerimine'}
                  </button>
                  <button onClick={() => remove(a.id)} className="text-gray-300 hover:text-[#A32D2D] text-sm">×</button>
                </div>
              )}
            </div>

            {a.description && <p className="text-sm text-gray-600 mb-2">{a.description}</p>}

            <p className="text-xs text-gray-400 mb-3">
              {a.dayOfWeek ? DAYS[a.dayOfWeek] : 'Aeg kokkuleppel'}
              {a.startTime ? ` ${a.startTime}` : ''}
              {a.location ? ` · ${a.location}` : ''}
              {a.leaderName ? ` · ${a.leaderName}` : ''}
              {' · '}
              {a.participantCount}
              {a.maxParticipants ? `/${a.maxParticipants}` : ''} osalejat
            </p>

            {staff && a.participants.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {a.participants.map(p => (
                  <span key={p.studentId}
                    className="text-[11px] bg-[#EEEDFE] text-[#534AB7] rounded-full px-2.5 py-1">
                    {p.studentName}
                    {p.className ? ` · ${p.className}` : ''}
                    <button onClick={() => leave(a.id, p.studentId)}
                      className="ml-1.5 opacity-50 hover:opacity-100">×</button>
                  </span>
                ))}
              </div>
            )}

            {!staff && myStudents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {myStudents.map(s => {
                  const joined = a.myStudents.includes(Number(s.id))
                  return joined ? (
                    <button key={s.id} onClick={() => leave(a.id, s.id)}
                      className="text-xs bg-[#EEEDFE] border border-[#AFA9EC] text-[#534AB7] rounded-lg px-3 py-1.5 hover:bg-white">
                      {s.name} osaleb · tühista
                    </button>
                  ) : (
                    <button key={s.id} onClick={() => join(a.id, s.id)}
                      disabled={a.isFull || !a.isOpen}
                      className="text-xs bg-[#639922] text-white rounded-lg px-3 py-1.5 hover:bg-[#3B6D11] disabled:opacity-40">
                      Registreeri {s.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
