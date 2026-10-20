import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiCall } from '../api/client'

const roleLabels = {
  teacher: 'Aineõpetaja',
  homeroom_teacher: 'Klassijuhataja',
  support_specialist: 'Tugispetsialist',
  headteacher: 'Õppealajuhataja',
  principal: 'Direktor',
}

const getInitials = name => name?.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?'

export default function SchoolMembersPage() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    apiCall('/api/school/members')
      .then(d => setMembers(d.members || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = members.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    roleLabels[m.role]?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Kooli liikmed</h1>
      <p className="text-gray-500 text-sm mb-6">Kõik õpetajad ja töötajad kes on EduAI-ga liitunud.</p>

      <input type="text" placeholder="Otsi nime või rolli järgi..." value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#7F77DD] mb-6" />

      {loading && <p className="text-gray-400 text-sm">Laadin...</p>}
      {!loading && !filtered.length && <p className="text-gray-400 text-sm">Liikmeid ei leitud.</p>}

      <div className="space-y-3">
        {filtered.map(member => (
          <div key={member.id} className="bg-white rounded-xl border border-black/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EEEDFE] text-[#534AB7] flex items-center justify-center text-sm font-bold flex-shrink-0">
                {getInitials(member.name)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                <p className="text-xs text-gray-400">{roleLabels[member.role] || member.role}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/sonumid',
cat > /tmp/fix_members.js << 'EOF'
const fs = require('fs')

const appPath = '/Users/kirsikavaidla/Documents/EduAI/client/src/App.jsx'
let app = fs.readFileSync(appPath, 'utf8')
if (!app.includes('SchoolMembersPage')) {
  app = app.replace("import PlanningPage from './pages/PlanningPage'", "import PlanningPage from './pages/PlanningPage'\nimport SchoolMembersPage from './pages/SchoolMembersPage'")
  app = app.replace("<Route path=\"esseede-hindamine\" element={<EssayGradingPage />} />", "<Route path=\"esseede-hindamine\" element={<EssayGradingPage />} />\n
cat > /tmp/fix_members.js << 'EOF'
const fs = require('fs')

const appPath = '/Users/kirsikavaidla/Documents/EduAI/client/src/App.jsx'
let app = fs.readFileSync(appPath, 'utf8')
if (!app.includes('SchoolMembersPage')) {
  app = app.replace("import PlanningPage from './pages/PlanningPage'", "import PlanningPage from './pages/PlanningPage'\nimport SchoolMembersPage from './pages/SchoolMembersPage'")
  app = app.replace("<Route path=\"esseede-hindamine\" element={<EssayGradingPage />} />", "<Route path=\"esseede-hindamine\" element={<EssayGradingPage />} />\n        <Route path=\"kooli-liikmed\" element={<SchoolMembersPage />} />")
  fs.writeFileSync(appPath, app)
}

const rolesPath = '/Users/kirsikavaidla/Documents/EduAI/client/src/constants/roles.js'
let roles = fs.readFileSync(rolesPath, 'utf8')
if (!roles.includes('kooli-liikmed')) {
  roles = roles.replace("  { to: '/esseede-hindamine', label: 'Esseede hindamine' },", "  { to: '/esseede-hindamine', label: 'Esseede hindamine' },\n  { to: '/kooli-liikmed', label: 'Kooli liikmed' },")
  fs.writeFileSync(rolesPath, roles)
}

console.log('Valmis!')
