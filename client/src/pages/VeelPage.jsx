import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { navForRole, isStaff, isLeadership, canInvite } from '../constants/roles'
import PaevikTabs from '../components/PaevikTabs'
import InstallHint from '../components/InstallHint'

/** "Veel": kõik rakenduse osad ühel lehel, rühmitatud, Stuudiumi "Veel"-menüü eeskujul. */
export function groupsForStaff(role) {
  const groups = [
    {
      title: 'Igapäevane töö',
      items: [
        ['/paevik', 'Päevik', 'Tänased tunnid, asendused, ülesanded ja kontrolltööd.'],
        ['/tera', 'Tera', 'Kursused ja klassid ühes nimekirjas.'],
        ['/tunniplaan', 'Tunniplaan', 'Nädala tunniplaan, asendused ja kontrolltööde kalender.'],
        ['/hinded', 'Hinded', 'Hinnete sisestus teemade kaupa.'],
        ['/kohalolek', 'Kohalolek ja käitumine', 'Puudumised ja käitumismärked.'],
        ['/opilased', 'Õpilased', 'Õpilaste andmed ja nende areng.'],
        ['/klassid', 'Klassid', 'Klasside haldus ja teemad.'],
      ],
    },
    {
      title: 'Suhtlus ja kool',
      items: [
        ['/sonumid', 'Suhtlus', 'Sõnumid, teated klassile, lemmikud ja kalender.'],
        ['/kooli-liikmed', 'Kooli liikmed', 'Kolleegid ja otsene sõnum neile.'],
        ['/tunniplaan/vanemapaev', 'Vanemate päev', 'Vanemate kohtumiste planeerimine.'],
        ['/huviringid', 'Huviringid', 'Ringid ja osalejad.'],
        ['/mentorlus', 'Mentorlus', 'Õpilaste eesmärgid ja vahesammud.'],
        ['/profiil', 'Minu profiil', 'Nimi, parool ja oma andmed.'],
        ['/seaded', 'Kool ja konto', 'Kooli nimi, roll ja liitumiskood.'],
      ],
    },
    {
      title: 'AI ja automaatika',
      items: [
        ['/ulevaade', 'Ülevaade', 'Klassi seis ja AI hoiatused.', true],
        ['/planeerija', 'AI planeerija', 'Vestlus, mis küsib täpsustusi ja koostab tunnikava ning kodutööd.', true],
        ['/materjalid', 'Materjalid', 'Teooria, tööleht ja kontrolltöö korralike valemitega.', true],
        ['/planeerimine', 'Planeerimine', 'Nädalaplaanid ja õppekoormus.', true],
        ['/tagasiside', 'Tagasiside', 'Tagasiside õpilastele ja lapsevanematele.', true],
        ['/esseede-hindamine', 'Esseede hindamine', 'Eesti, inglise ja vene keeles, hinne protsentides.', true],
        ['/automatsioonid', 'Automatsioonid', 'Reeglid, mis jälgivad ja annavad teada, ka n8n-i.'],
      ],
    },
  ]
  if (isLeadership(role)) {
    groups[1].items.unshift(['/kool', 'Kool', 'Kogu kooli ülevaade juhtkonnale.'])
  }
  if (canInvite(role)) {
    groups[1].items.push(['/kutsu', 'Kutsu pere', 'Kutse lapsevanemale või õpilasele.'])
  }
  return groups
}

export default function VeelPage() {
  const { role } = useAuth()
  const staff = isStaff(role)
  const groups = staff
    ? groupsForStaff(role)
    : [{ title: 'Menüü', items: navForRole(role).map(t => [t.to, t.label, '']) }]

  return (
    <div className="max-w-6xl">
      {staff && <PaevikTabs />}
      <InstallHint />
      <h1 className="text-3xl text-[#14213D] mb-1">Veel</h1>
      <p className="text-[#6B6B66] text-sm mb-8">Kõik EduAI osad ühes kohas.</p>
      {groups.map(g => (
        <section key={g.title} className="mb-10">
          <h2 className="font-serif-brand text-xl text-[#14213D] mb-3">{g.title}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-[#D9D4C7]">
            {g.items.map(([to, title, text, ai]) => (
              <Link key={to} to={to} className="bg-[#F7F4EE] hover:bg-white transition-colors p-5 block border-r border-b border-[#D9D4C7]">
                <p className="text-sm font-semibold text-[#14213D] flex items-center gap-2">
                  {title}
                  {ai && <span className="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded bg-[#7F77DD] text-white">AI</span>}
                </p>
                {text && <p className="text-xs text-[#6B6B66] mt-1.5 leading-relaxed">{text}</p>}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
