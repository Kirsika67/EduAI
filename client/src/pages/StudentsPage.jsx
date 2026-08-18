import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useClasses } from '../context/ClassContext'
import { apiCall } from '../api/client'
import Badge from '../components/Badge'
import ProgressBar from '../components/ProgressBar'

const getInitials = name => name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
const avatarBg = { red: 'bg-[#FCEBEB] text-[#A32D2D]', yellow: 'bg-[#FAEEDA] text-[#854F0B]', green: 'bg-[#EAF3DE] text-[#3B6D11]', blue: 'bg-[#E6F1FB] text-[#185FA5]' }

function getTrend(grades) {
  if (grades.length < 2) return 'Liiga vähe andmeid'
  const s = [...grades].sort((a, b) => new Date(b.date) - new Date(a.date))
  const r = s.slice(0, 3); const o = s.slice(3, 6)
  if (!o.length) return 'Stabiilne'
  const d = r.reduce((s, g) => s + Number(g.score), 0) / r.length - o.reduce((s, g) => s + Number(g.score), 0) / o.length
  return d > 10 ? 'Tõus ↑' : d < -10 ? 'Langus ↓' : 'Stabiilne'
}

export default function StudentsPage() {
  const { selectedClassId, selectedClass, loading: classesLoading } = useClasses()
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [gradesMap, setGradesMap] = useState({})
  const [riskMap, setRiskMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showAddMany, setShowAddMany] = useState(false)
  const [newName, setNewName] = useState('')
  const [bulkNames, setBulkNames] = useState('')
  const [adding, setAdding] = useState(false)
  const [addingMany, setAddingMany] = useState(false)

  const parsedBulkNamesCount = bulkNames
    .split('\n')
    .map(name => name.trim())
    .filter(Boolean).length

  useEffect(() => {
    if (classesLoading) return
    if (!selectedClassId) return
    load()
  }, [classesLoading, selectedClassId])

  const load = async () => {
    setLoading(true)
    try {
      const d = await apiCall(`/api/classes/${selectedClassId}/students`)
      const list = d.students || []
      setStudents(list)
      const map = {}
      const g = await apiCall(`/api/classes/${selectedClassId}/grades`)
      for (const grade of (g.grades || [])) {
        const studentId = Number(grade.student_id)
        if (!map[studentId]) map[studentId] = []
        map[studentId].push(grade)
      }
      setGradesMap(map)
      const r = await apiCall(`/api/classes/${selectedClassId}/abc-risks`)
      const rm = {}
      for (const row of (r.students || [])) rm[row.studentId] = row
      setRiskMap(rm)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const addStudent = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      await apiCall(`/api/classes/${selectedClassId}/students`, {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      })
      setNewName(''); setShowAdd(false); await load()
    } catch (err) { alert('Viga: ' + err.message) }
    finally { setAdding(false) }
  }

  const addManyStudents = async () => {
    const names = bulkNames
      .split('\n')
      .map(name => name.trim())
      .filter(Boolean)

    if (!names.length) return

    setAddingMany(true)
    try {
      await apiCall(`/api/classes/${selectedClassId}/students`, {
        method: 'POST',
        body: JSON.stringify({ names }),
      })
      setBulkNames('')
      setShowAddMany(false)
      await load()
    } catch (err) {
      alert('Mitme õpilase lisamine ebaõnnestus: ' + err.message)
    } finally {
      setAddingMany(false)
    }
  }

  if (classesLoading) return <div className="p-8 text-gray-500">Laadin...</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Õpilased</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowAdd(prev => !prev)
              setShowAddMany(false)
              setBulkNames('')
            }}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7]"
          >
            + Lisa õpilane
          </button>
          <button
            onClick={() => {
              setShowAddMany(prev => !prev)
              setShowAdd(false)
              setNewName('')
            }}
            className="border border-[#AFA9EC] text-[#534AB7] text-sm rounded-lg px-4 py-2 hover:bg-[#EEEDFE]"
          >
            + Lisa mitu õpilast
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-6">Klass: {selectedClass?.name || '—'} · {selectedClass?.subject || '—'}</p>

      {showAdd && (
        <div className="bg-[#EEEDFE] rounded-xl p-4 mb-6 flex gap-3 items-center">
          <input type="text" placeholder="Õpilase täisnimi" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStudent()}
            className="flex-1 border border-[#AFA9EC] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD]" />
          <button onClick={addStudent} disabled={adding}
            className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7] disabled:opacity-50">
            {adding ? 'Lisan...' : 'Lisa'}
          </button>
          <button onClick={() => { setShowAdd(false); setNewName('') }} className="text-gray-400 text-sm">Tühista</button>
        </div>
      )}

      {showAddMany && (
        <div className="bg-[#EEEDFE] rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Kleebi õpilaste nimed (iga nimi eraldi real)</p>
          <textarea
            value={bulkNames}
            onChange={e => setBulkNames(e.target.value)}
            rows={6}
            placeholder={'Mari Maasikas\nJaan Tamm\nKati Kask'}
            className="w-full border border-[#AFA9EC] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7F77DD] resize-y"
          />
          <p className="mt-2 text-xs text-gray-500">
            Lisatakse {parsedBulkNamesCount} {parsedBulkNamesCount === 1 ? 'õpilane' : 'õpilast'}.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={addManyStudents}
              disabled={addingMany}
              className="bg-[#7F77DD] text-white text-sm rounded-lg px-4 py-2 hover:bg-[#534AB7] disabled:opacity-50"
            >
              {addingMany ? 'Lisan...' : 'Lisa kõik'}
            </button>
            <button
              onClick={() => { setShowAddMany(false); setBulkNames('') }}
              className="text-gray-400 text-sm"
            >
              Tühista
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/10 p-4 mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Kohalolek ja käitumine</h2>
          <p className="text-xs text-gray-400">Kohaloleku märkimine ja käitumismärkused on nüüd omal lehel.</p>
        </div>
        <Link to="/kohalolek"
          className="text-sm bg-[#7F77DD] text-white rounded-lg px-4 py-2 hover:bg-[#534AB7] whitespace-nowrap">
          Ava kohaloleku leht
        </Link>
      </div>

      {loading && <div className="text-gray-400 text-sm">Laadin...</div>}
      {!loading && !students.length && (
        <div className="bg-white rounded-xl border border-black/10 p-8 text-center text-gray-400">
          Selles klassis pole õpilasi.
        </div>
      )}

      <div className="space-y-3">
        {students.map(student => {
          const grades = gradesMap[student.id] || []
          const risk = riskMap[student.id]
          const status = risk?.level || 'blue'
          const avg = grades.length ? Math.round(grades.reduce((s, g) => s + Number(g.score), 0) / grades.length) : 0
          return (
            <div key={student.id} onClick={() => navigate(`/opilased/${student.id}`)}
              className="bg-white rounded-xl border border-black/10 p-4 flex items-center gap-4 cursor-pointer hover:shadow-sm transition-shadow">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarBg[status] || avatarBg.blue}`}>
                {getInitials(student.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-bold text-gray-900 truncate">{student.name}</span>
                  <Badge variant={status}>{risk?.label || 'Hea tase'}</Badge>
                </div>
                <p className="text-[11px] text-gray-400 mb-1.5">
                  {risk?.reasons?.length ? risk.reasons[0] : getTrend(grades)}
                </p>
                <ProgressBar value={avg} />
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-[10px] text-gray-400">Keskmine hinne</p>
                <p className="text-lg font-bold text-gray-700">
                  {grades.length ? avg + '%' : '—'}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
